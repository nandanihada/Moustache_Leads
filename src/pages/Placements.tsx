import { useState, useCallback, useMemo } from "react";
import { Search, Grid, Calendar, Play, Pause, BarChart, Settings, Bell, Info, Send, Clipboard, Globe, DollarSign, Edit, Trash2 } from "lucide-react";

// Mock data structures, inspired by the reference images' fields.
const MOCK_EVENTS_DATA = [
  { id: 'EVT001', name: 'Black Friday Bonus', message: '2x earnings', multiplier: '2.0x', status: 'Active', startDate: '2024-11-20', endDate: '2024-11-30' },
  { id: 'EVT002', name: 'Holiday Surge', message: '1.5x earnings', multiplier: '1.5x', status: 'Inactive', startDate: '2024-12-15', endDate: '2024-12-31' },
];

// Initial state for an EXISTING placement (kingopinions)
const EXISTING_PLACEMENT_DATA = {
  platformName: 'kingopinions',
  offerwallTitle: 'king',
  platformLink: 'https://kingopinions.com',
  placementIdentifier: '5b3d3dbde22db907b1d2d5a806d65bbe6d0516c8b00dead652e58c8b',
  currencyName: 'usd',
  exchangeRate: '60',
  postbackUri: 'https://hostslice.onrender.com/postback-handler/108395a6-1ddb-433e-b2d9-2d1b7b7e8d1a',
  description: 'Provide a comprehensive overview of the app\'s traffic patterns across different geographical locations, the strategies employed for promotion, and the measures implemented to prevent fraud.',
  postbackFailureNotification: true,
  platformType: 'Website', // <-- Added platform type
  // Testing tab fields initialization
  userId: 'user_12345',
  rewardValue: '100',
  offerName: 'Survey - Top Offers',
  status: 'Completed',
  offerId: 'OFR-54321',
  userIp: '192.168.1.1',
};

// Initial state for a NEW placement (empty form)
const NEW_PLACEMENT_DATA = {
  platformName: '',
  offerwallTitle: '',
  platformLink: '',
  placementIdentifier: '', // Empty ID signifies a new placement
  currencyName: '',
  exchangeRate: '',
  postbackUri: '',
  description: '',
  postbackFailureNotification: false,
  platformType: '', // <-- Added platform type, initially unselected
  // Testing tab fields initialization (cleared for a new placement)
  userId: '',
  rewardValue: '',
  offerName: '',
  status: 'Completed',
  offerId: '',
  userIp: '',
};

// --- Utility Components (Tailwind Recreations of UI Primitives) ---

const Card = ({ title, description, children, className = '' }) => (
  // Updated Card background to white for a clean look
  <div className={`bg-white shadow-xl rounded-xl p-6 transition-all duration-300 border border-gray-200 ${className}`}>
    {title && (
      // Updated border color and text color
      <div className="mb-5 border-b border-gray-200 pb-3">
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h2>
        {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
      </div>
    )}
    <div className="text-gray-700">{children}</div>
  </div>
);

const Input = ({ label, placeholder, value, onChange, type = 'text', icon: Icon, readOnly = false }) => (
  <div className="space-y-1.5">
    <label className="text-sm font-medium text-gray-700 flex items-center">
      {label}
      <Info className="h-3 w-3 ml-1 text-gray-400 cursor-pointer hover:text-violet-500 transition" />
    </label>
    <div className="relative">
      {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        // Updated background, border, and text colors for light mode
        className={`w-full py-3 px-3 rounded-lg border bg-white transition duration-150 ease-in-out placeholder-gray-400 shadow-sm
          ${
            readOnly 
              ? 'border-gray-200 text-gray-500 cursor-not-allowed pl-3 bg-gray-50' 
              : 'border-gray-300 text-gray-900 pl-10 focus:ring-2 focus:ring-violet-500 focus:border-violet-500'
          }
        `}
      />
    </div>
  </div>
);

const Select = ({ label, value, onChange, options, readOnly = false }) => (
  <div className="space-y-1.5">
    <label className="text-sm font-medium text-gray-700 flex items-center">
      {label}
      <Info className="h-3 w-3 ml-1 text-gray-400 cursor-pointer hover:text-violet-500 transition" />
    </label>
    <select
      value={value}
      onChange={onChange}
      disabled={readOnly}
      // Updated background, border, and text colors for light mode
      className={`w-full py-3 px-3 rounded-lg border bg-white text-gray-900 appearance-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition duration-150 ease-in-out shadow-sm
        ${
          readOnly 
            ? 'border-gray-200 text-gray-500 cursor-not-allowed bg-gray-50' 
            : 'border-gray-300'
        }
      `}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

const Textarea = ({ label, placeholder, value, onChange }) => (
  <div className="space-y-1.5">
    <label className="text-sm font-medium text-gray-700 flex items-center">
      {label}
      <Info className="h-3 w-3 ml-1 text-gray-400 cursor-pointer hover:text-violet-500 transition" />
    </label>
    <textarea
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      rows={4}
      // Updated background, border, and text colors for light mode
      className="w-full py-3 px-4 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition duration-150 ease-in-out placeholder-gray-400 shadow-sm"
    />
  </div>
);

const Button = ({ children, onClick, variant = 'primary', icon: Icon, className = '', disabled = false }) => {
  let styles;
  switch (variant) {
    case 'secondary':
      styles = 'bg-gray-200 hover:bg-gray-300 text-gray-800';
      break;
    case 'outline':
      styles = 'bg-transparent border border-gray-300 hover:bg-gray-100 text-gray-700';
      break;
    default:
      // Violet primary button style remains for accent
      styles = disabled 
        ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
        : 'bg-violet-600 hover:bg-violet-700 text-white font-semibold shadow-lg shadow-violet-500/30';
      break;
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center px-6 py-3 rounded-lg font-medium transition duration-200 ease-in-out transform hover:scale-[1.01] active:scale-[0.99] ${styles} ${className}`}
    >
      {Icon && <Icon className="h-5 w-5 mr-2" />}
      {children}
    </button>
  );
};

const ToggleSwitch = ({ label, checked, onChange }) => (
  // Updated background and border for light mode
  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 shadow-inner">
    <div className="flex items-center">
      <Bell className="h-5 w-5 text-yellow-600 mr-3" />
      <span className="text-sm font-medium text-gray-900">{label}</span>
      <Info className="h-3 w-3 ml-1 text-gray-400 cursor-pointer hover:text-violet-500 transition" />
    </div>
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
      {/* Updated toggle colors */}
      <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-violet-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
    </label>
  </div>
);

// --- Tab Content Components ---

// 1. Placement Configuration Tab
const PlacementConfiguration = ({ data, onChange, onSubmit, isNew }) => {
  const isReadOnly = useMemo(() => !isNew && data.placementIdentifier !== '', [isNew, data.placementIdentifier]);

  const onSelectPlatform = (platform) => {
      if (isNew) {
        onChange('platformType', platform);
      }
  };

  const renderPlatformSelection = () => {
    return (
        // Updated container for platform selection
        <div className="mb-8 flex space-x-4 p-2 bg-gray-100 rounded-xl shadow-inner border border-gray-300">
            {['Android', 'iOS', 'Website'].map(platform => {
                const isActive = data.platformType === platform;
                return (
                    <button
                        key={platform}
                        onClick={() => onSelectPlatform(platform)}
                        disabled={!isNew} 
                        // Updated inactive styles for light mode
                        className={`flex-1 py-3 px-6 text-sm font-semibold rounded-lg transition duration-200 ease-in-out transform hover:scale-[1.01] active:scale-[0.99] ${
                            isActive
                                ? 'bg-violet-600 text-white shadow-md shadow-violet-500/30'
                                : 'bg-transparent text-gray-700 hover:bg-gray-200'
                        } ${!isNew ? 'cursor-not-allowed opacity-75' : ''}`}
                    >
                        {platform}
                    </button>
                );
            })}
        </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">

        {isNew && (
            <>
                <h2 className="text-3xl font-extrabold text-gray-900 mt-2">Platform Selection</h2>
                {renderPlatformSelection()} 
            </>
        )}
        
        <Card title="Core Configuration">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Platform Name"
              placeholder="e.g., MyApp Name"
              value={data.platformName}
              onChange={(e) => onChange('platformName', e.target.value)}
              readOnly={isReadOnly}
              icon={Globe}
            />
            <Input
              label="Offerwall Title"
              placeholder="e.g., Daily Rewards Hub"
              value={data.offerwallTitle}
              onChange={(e) => onChange('offerwallTitle', e.target.value)}
              readOnly={isReadOnly}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            {data.placementIdentifier ? (
                <Input
                  label="Placement Identifier (Read-Only)"
                  placeholder="Generated ID"
                  value={data.placementIdentifier}
                  readOnly={true}
                  icon={Clipboard}
                />
            ) : (
               <Input
                  label="Platform Link (Web/App Store)"
                  placeholder="Enter Platform Link"
                  value={data.platformLink}
                  onChange={(e) => onChange('platformLink', e.target.value)}
                  readOnly={isReadOnly}
                  icon={Clipboard}
                />
            )}

            <Input
              label="Currency Name"
              placeholder="e.g., Coins, Points, Gems"
              value={data.currencyName}
              onChange={(e) => onChange('currencyName', e.target.value)}
              readOnly={isReadOnly}
              icon={DollarSign}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <Input
              label="Exchange Rate (1 USD = X Currency)"
              placeholder="e.g., 60"
              type="number"
              value={data.exchangeRate}
              onChange={(e) => onChange('exchangeRate', e.target.value)}
              readOnly={isReadOnly}
              icon={BarChart}
            />
            <Input
              label="Postback Uri"
              placeholder="Enter your server's postback URL"
              value={data.postbackUri}
              onChange={(e) => onChange('postbackUri', e.target.value)}
              readOnly={isReadOnly}
              icon={Send}
            />
          </div>
        </Card>

        <Card title="Advanced Settings">
          <Textarea
            label="Description"
            placeholder="Provide a comprehensive overview of the app's traffic patterns, promotion strategies, and fraud prevention measures."
            value={data.description}
            onChange={(e) => onChange('description', e.target.value)}
          />

          <div className="mt-6">
            <ToggleSwitch
              label="Enable Postback Failure Notification"
              checked={data.postbackFailureNotification}
              onChange={(e) => onChange('postbackFailureNotification', e.target.checked)}
            />
          </div>
        </Card>

        {/* Updated alert box for light mode */}
        <p className="text-sm p-4 rounded-xl bg-violet-50/70 border border-violet-300 text-violet-800 shadow-inner">
          <Info className="h-4 w-4 inline mr-2 text-violet-600" />
          **Documentation Tip:** Review the "Postback URI" section in our API docs before deploying.
        </p>

        <Button onClick={onSubmit} className="w-full mt-6" icon={data.placementIdentifier ? Edit : Play}>
          {data.placementIdentifier ? 'Save Configuration Changes' : 'Create New Placement'}
        </Button>
      </div>

      <div className="lg:col-span-1">
        <Card title="Current Status" className="sticky top-4">
          <div className="space-y-4">
            {/* Updated status blocks for light mode */}
            <div className="flex justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
              <span className="text-gray-600 font-medium">Status:</span>
              <span className={`font-bold ${isReadOnly ? 'text-green-600' : 'text-yellow-600'}`}>
                {isReadOnly ? 'LIVE' : 'DRAFT'}
              </span>
            </div>
            <div className="flex justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
              <span className="text-gray-600 font-medium">Platform:</span>
              <span className="font-bold text-violet-600">
                {data.platformType || 'UNSELECTED'}
              </span>
            </div>
            <div className="flex justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
              <span className="text-gray-600 font-medium">Last Modified:</span>
              <span className="font-bold text-gray-900">2025-09-30</span>
            </div>
            
            <hr className="border-gray-200 my-4" />
            <div className="pt-2">
              <h4 className="text-lg font-bold text-gray-900 mb-2">Platform Notes</h4>
              {/* Updated note style for light mode */}
              <p className="text-sm text-gray-700 border-l-4 border-violet-600 pl-3 py-1 bg-violet-50 rounded-r-lg">
                {data.platformType ? `Traffic is primarily routed for the ${data.platformType} environment.` : 'Select a platform type (Android, iOS, or Website) to continue setup.'}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

// 2. Events Tab
const EventsManager = ({ events }) => (
  <Card title="Event Management" description="Set up temporary bonuses and multipliers for your offerwall." className="p-0">
    <div className="flex justify-end p-4">
      <Button icon={Calendar} className="text-sm">Create New Event</Button>
    </div>
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-100">
          <tr>
            {['ID', 'Name', 'Message', 'Multiplier', 'Status', 'Start Date', 'End Date', 'Actions'].map(header => (
              <th key={header} className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {events.length > 0 ? (
            events.map((event) => (
              <tr key={event.id} className="hover:bg-gray-100 transition duration-100">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-violet-600">{event.id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{event.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{event.message}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">{event.multiplier}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full ${event.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {event.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{event.startDate}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{event.endDate}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <button title="Edit" className="text-violet-600 hover:text-violet-800 transition p-1 rounded-md hover:bg-gray-200"><Edit className="h-4 w-4" /></button>
                    <button title="Delete" className="text-red-600 hover:text-red-800 transition p-1 rounded-md hover:bg-gray-200"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="8" className="px-6 py-10 text-center text-gray-500">
                <Calendar className="h-10 w-10 mx-auto mb-3 text-gray-400" />
                No events found. Click "Create New Event" to start a new promotion.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </Card>
);

// 3. Testing Tab
const TestingPostback = ({ data, onChange, onSubmit }) => {
  const STATUS_OPTIONS = [
    { value: 'Completed', label: 'Completed' },
    { value: 'Rejected', label: 'Rejected' },
    { value: 'Pending', label: 'Pending' },
  ];

  const isPlacementReady = data.postbackUri && data.placementIdentifier;

  return (
    <Card title="Test Postback" description="Simulate a conversion to verify your postback URI configuration." className="space-y-6">
      {/* Updated warning box for light mode */}
      {!isPlacementReady && (
        <p className="text-base p-4 rounded-xl bg-yellow-50 border border-yellow-300 text-yellow-800 shadow-inner">
          <Info className="h-4 w-4 inline mr-2" />
          **Setup Required:** Please ensure the Postback URI and Placement Identifier are configured before running tests.
        </p>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label="User ID"
          placeholder="e.g., user_12345"
          value={data.userId}
          onChange={(e) => onChange('userId', e.target.value)}
          icon={Settings}
        />
        <Input
          label="Reward Value (In Local Currency)"
          placeholder="e.g., 100"
          type="number"
          value={data.rewardValue}
          onChange={(e) => onChange('rewardValue', e.target.value)}
          icon={DollarSign}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label="Offer Name"
          placeholder="e.g., Survey - Platinum Tier"
          value={data.offerName}
          onChange={(e) => onChange('offerName', e.target.value)}
          icon={BarChart}
        />
        <Select
          label="Status"
          value={data.status}
          onChange={(e) => onChange('status', e.target.value)}
          options={STATUS_OPTIONS}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label="Offer ID (Unique Transaction ID)"
          placeholder="e.g., OFR-67890"
          value={data.offerId}
          onChange={(e) => onChange('offerId', e.target.value)}
          icon={Play}
        />
        <Input
          label="User IP (Optional)"
          placeholder="e.g., 192.168.1.1"
          value={data.userIp}
          onChange={(e) => onChange('userIp', e.target.value)}
          icon={Globe}
        />
      </div>

      {/* Updated caution box for light mode */}
      <p className="text-sm p-4 rounded-xl bg-red-50 border border-red-300 text-red-800 shadow-inner">
        <Info className="h-4 w-4 inline mr-2" />
        **Caution:** Test postbacks do not affect live user accounts or revenue reports.
      </p>

      <Button onClick={onSubmit} className="w-full" icon={Send} disabled={!isPlacementReady}>
        Send Test Postback
      </Button>
    </Card>
  );
};


// --- Main Component ---

export const Placements = () => {
  const [activeTab, setActiveTab] = useState('placement');
  const [isNewPlacement, setIsNewPlacement] = useState(false); 

  const initialData = useMemo(() => isNewPlacement ? NEW_PLACEMENT_DATA : EXISTING_PLACEMENT_DATA, [isNewPlacement]);
  const [placementData, setPlacementData] = useState(initialData);

  useMemo(() => {
    setPlacementData(initialData);
    setActiveTab('placement'); 
  }, [initialData]);


  const handleInputChange = useCallback((key, value) => {
    setPlacementData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handlePlacementSubmit = () => {
    const action = placementData.placementIdentifier ? 'Updated' : 'Created';
    console.log(`--- Placement ${action} Configuration Submitted ---`);
    console.log(placementData);
    
    const message = `Placement configuration ${action.toLowerCase()}! Check the console for the submitted data.`;
    console.log(message); 

    if (action === 'Created') {
        setPlacementData(prev => ({ 
            ...prev, 
            placementIdentifier: 'MOCK-' + Math.random().toString(36).substring(2, 10).toUpperCase(), 
            platformName: prev.platformName || 'New Platform',
            platformType: prev.platformType || 'Website' 
        }));
        setIsNewPlacement(false);
    }
  };

  const handleTestPostback = () => {
    console.log('--- Test Postback Sent ---');
    console.log({
      userId: placementData.userId,
      rewardValue: placementData.rewardValue,
      offerName: placementData.offerName,
      status: placementData.status,
      offerId: placementData.offerId,
      userIp: placementData.userIp,
      postbackUri: placementData.postbackUri,
    });
    console.log("Test postback initiated! Check the console for the data being sent.");
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'placement':
        return (
          <PlacementConfiguration
            data={placementData}
            onChange={handleInputChange}
            onSubmit={handlePlacementSubmit}
            isNew={isNewPlacement}
          />
        );
      case 'events':
        return isNewPlacement 
          ? <Card title="Events" description="Events can only be managed after a placement is created." className="h-64 flex items-center justify-center text-center">
              <p className="text-gray-500">Please first <span className="text-violet-600">Create</span> or <span className="text-violet-600">Select</span> a placement to manage events.</p>
            </Card> 
          : <EventsManager events={MOCK_EVENTS_DATA} />;
      case 'testing':
        return (
          <TestingPostback
            data={placementData}
            onChange={handleInputChange}
            onSubmit={handleTestPostback}
          />
        );
      default:
        return null;
    }
  };

  // Tab Button Helper
  const TabButton = ({ tabKey, Icon, label }) => (
    <button
      onClick={() => setActiveTab(tabKey)}
      // Updated styling for light mode tabs
      className={`flex items-center justify-center space-x-2 py-3 px-6 rounded-t-xl transition-all duration-200 text-base font-semibold ${
        activeTab === tabKey
          ? 'bg-white text-violet-700 border-b-2 border-violet-600 shadow-t' // Active: White background, violet text
          : 'bg-gray-50 text-gray-600 hover:bg-gray-100' // Inactive: Light gray background, gray text
      }`}
      disabled={isNewPlacement && tabKey !== 'placement'}
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </button>
  );
  
  // Navigation Button Helper for top bar
  const NavButton = ({ label, secondaryLabel, isActive, onClick }) => (
    <button
      onClick={onClick}
      // Updated styling for light mode navigation
      className={`px-5 py-3 text-left rounded-xl transition-all duration-200 transform hover:scale-[1.02] border ${
        isActive 
          ? 'bg-violet-600 border-violet-700 shadow-lg shadow-violet-500/30 text-white' 
          : 'bg-white border-gray-300 hover:bg-gray-100 text-gray-700 shadow-sm'
      }`}
    >
      <p className={`font-bold text-base ${isActive ? 'text-white' : 'text-gray-900'}`}>{label}</p>
      {secondaryLabel && <p className={`text-xs ${isActive ? 'text-violet-200' : 'text-gray-500'}`}>{secondaryLabel}</p>}
    </button>
  );

  return (
    // Updated overall background to light gray
    <div className="min-h-screen bg-gray-50 font-sans p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Top Navigation Buttons */}
        <div className="flex space-x-4 mb-10 items-center">
            <NavButton 
                label="Add New Placement" 
                isActive={isNewPlacement} 
                onClick={() => setIsNewPlacement(true)} 
            />
            <NavButton 
                label={EXISTING_PLACEMENT_DATA.platformName} 
                secondaryLabel={EXISTING_PLACEMENT_DATA.platformLink.split('//')[1]}
                isActive={!isNewPlacement} 
                onClick={() => setIsNewPlacement(false)} 
            />
        </div>

        {/* Header (Changed dynamically) */}
        <header className="mb-8">
          <h1 className="text-5xl font-extrabold text-gray-900 tracking-tight">
            {isNewPlacement ? 'New Ad Placement Setup' : placementData.platformName}
          </h1>
          <p className="text-gray-600 mt-2 text-lg">
            {isNewPlacement ? 'Define the platform type and core settings for your new offerwall.' : `Manage and monitor the configuration for your existing ${placementData.platformName} placement.`}
          </p>
        </header>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-0 border-b border-gray-300">
          <TabButton tabKey="placement" Icon={Grid} label="Placement Details" />
          <TabButton tabKey="events" Icon={Calendar} label="Event Management" />
          <TabButton tabKey="testing" Icon={Play} label="Postback Testing" />
        </div>

        {/* Tab Content */}
        <div className="pt-8">
            {renderActiveTab()}
        </div>
      </div>
    </div>
  );
};

// Main export to render the component
export default Placements;
