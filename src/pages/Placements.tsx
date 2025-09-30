import { useState, useCallback, useMemo } from "react";
import { Grid, Calendar, Play, BarChart, Settings, Bell, Info, Send, Clipboard, Globe, DollarSign, Edit, Trash2, X, Plus } from "lucide-react";

// --- Data Structures ---

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
  platformType: 'Website',
  // Testing tab fields initialization
  userId: 'user_12345',
  rewardValue: '100',
  offerName: 'Survey - Top Offers',
  status: 'Completed',
  offerId: 'OFR-54321',
  userIp: '192.168.1.1',
  // Mock event data now part of the placement object
  events: [
    { id: 'EVT001', name: 'Black Friday Bonus', message: '2x earnings', multiplier: '2.0x', status: 'Active', startDate: '2024-11-20', endDate: '2024-11-30' },
    { id: 'EVT002', name: 'Holiday Surge', message: '1.5x earnings', multiplier: '1.5x', status: 'Inactive', startDate: '2024-12-15', endDate: '2024-12-31' },
  ],
};

// Initial state for a NEW placement (empty form)
const NEW_PLACEMENT_DATA = {
  platformName: '',
  offerwallTitle: '',
  platformLink: '',
  placementIdentifier: '',
  currencyName: '',
  exchangeRate: '',
  postbackUri: '',
  description: '',
  postbackFailureNotification: false,
  platformType: '',
  userId: '',
  rewardValue: '',
  offerName: '',
  status: 'Completed',
  offerId: '',
  userIp: '',
  events: [],
};

// --- Utility Components (Moved to top for readability) ---

const Modal = ({ title, children, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-70 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto transform transition-all duration-300 scale-100">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

const Card = ({ title, description, children, className = '' }) => (
  <div className={`bg-white shadow-xl rounded-xl p-6 transition-all duration-300 border border-gray-200 ${className}`}>
    {title && (
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
      className={`w-full py-3 px-3 rounded-lg border bg-white text-gray-900 appearance-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition duration-150 ease-in-out shadow-sm
        ${
          readOnly 
            ? 'border-gray-200 text-gray-500 cursor-not-allowed bg-gray-50' 
            : 'border-gray-300'
        }
      `}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} disabled={opt.disabled}>
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
    case 'danger':
        styles = 'bg-red-600 hover:bg-red-700 text-white font-semibold shadow-lg shadow-red-500/30';
        break;
    default:
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
  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 shadow-inner">
    <div className="flex items-center">
      <Bell className="h-5 w-5 text-yellow-600 mr-3" />
      <span className="text-sm font-medium text-gray-900">{label}</span>
      <Info className="h-3 w-3 ml-1 text-gray-400 cursor-pointer hover:text-violet-500 transition" />
    </div>
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
      <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-violet-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
    </label>
  </div>
);


// --- Event CRUD Modal ---

const EventModal = ({ eventData, isEditing, isOpen, onClose, onSubmit }) => {
    const [formData, setFormData] = useState(eventData || { name: '', message: '', multiplier: '', status: 'Active', startDate: '', endDate: '' });

    // Update form data when eventData changes (i.e., when opening for a new/different event)
    useMemo(() => {
        setFormData(eventData || { name: '', message: '', multiplier: '', status: 'Active', startDate: '', endDate: '' });
    }, [eventData]);

    const handleFormChange = (key, value) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmit = () => {
        // Basic validation
        if (!formData.name || !formData.multiplier || !formData.startDate) {
            console.error("Please fill in Name, Multiplier, and Start Date.");
            return;
        }
        onSubmit(formData);
    };

    const STATUS_OPTIONS = [
        { value: 'Active', label: 'Active' },
        { value: 'Inactive', label: 'Inactive' },
        { value: 'Upcoming', label: 'Upcoming' },
        { value: 'Expired', label: 'Expired' },
    ];
    
    return (
        <Modal title={isEditing ? 'Edit Event' : 'Create New Event'} isOpen={isOpen} onClose={onClose}>
            <div className="space-y-6">
                <Input 
                    label="Event Name" 
                    placeholder="e.g., Summer Bonus" 
                    value={formData.name} 
                    onChange={(e) => handleFormChange('name', e.target.value)} 
                    icon={Calendar} 
                />
                <Input 
                    label="Promotion Message" 
                    placeholder="e.g., 2x earnings on all offers" 
                    value={formData.message} 
                    onChange={(e) => handleFormChange('message', e.target.value)} 
                    icon={Info} 
                />
                <div className="grid grid-cols-2 gap-4">
                    <Input 
                        label="Multiplier (e.g., 2.0)" 
                        placeholder="e.g., 2.0" 
                        type="number"
                        value={formData.multiplier} 
                        onChange={(e) => handleFormChange('multiplier', e.target.value)} 
                        icon={DollarSign} 
                    />
                    <Select
                        label="Status"
                        value={formData.status}
                        onChange={(e) => handleFormChange('status', e.target.value)}
                        options={STATUS_OPTIONS}
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Input 
                        label="Start Date" 
                        type="date"
                        value={formData.startDate} 
                        onChange={(e) => handleFormChange('startDate', e.target.value)} 
                    />
                    <Input 
                        label="End Date (Optional)" 
                        type="date"
                        value={formData.endDate} 
                        onChange={(e) => handleFormChange('endDate', e.target.value)} 
                    />
                </div>
                <Button onClick={handleSubmit} className="w-full" icon={isEditing ? Edit : Plus}>
                    {isEditing ? 'Save Changes' : 'Create Event'}
                </Button>
            </div>
        </Modal>
    );
}

// 1. Placement Configuration Tab
const PlacementConfiguration = ({ data, onChange, onSubmit, isNew }) => {
  // isPlatformLocked determines if the user can still change the platform type
  const isPlatformLocked = useMemo(() => !isNew && !!data.placementIdentifier, [isNew, data.placementIdentifier]);

  const onSelectPlatform = (platform) => {
      if (!isPlatformLocked) {
        onChange('platformType', platform);
      }
  };

  const renderPlatformSelection = () => {
    return (
        <div className="mb-8 flex space-x-4 p-2 bg-gray-100 rounded-xl shadow-inner border border-gray-300">
            {['Android', 'iOS', 'Website'].map(platform => {
                const isActive = data.platformType === platform;
                return (
                    <button
                        key={platform}
                        onClick={() => onSelectPlatform(platform)}
                        disabled={isPlatformLocked} 
                        className={`flex-1 py-3 px-6 text-sm font-semibold rounded-lg transition duration-200 ease-in-out transform hover:scale-[1.01] active:scale-[0.99] ${
                            isActive
                                ? 'bg-violet-600 text-white shadow-md shadow-violet-500/30'
                                : 'bg-transparent text-gray-700 hover:bg-gray-200'
                        } ${isPlatformLocked ? 'cursor-not-allowed opacity-75' : ''}`}
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

        <h2 className="text-3xl font-extrabold text-gray-900 mt-2">Platform Selection</h2>
        {renderPlatformSelection()}
        
        <Card title="Core Configuration">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Platform Name" // Now fully editable
              placeholder="e.g., MyApp Name"
              value={data.platformName}
              onChange={(e) => onChange('platformName', e.target.value)}
              icon={Globe}
            />
            <Input
              label="Offerwall Title" // Now fully editable
              placeholder="e.g., Daily Rewards Hub"
              value={data.offerwallTitle}
              onChange={(e) => onChange('offerwallTitle', e.target.value)}
              icon={Info}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            {data.placementIdentifier ? (
                // Placement Identifier is now editable
                <Input
                  label="Placement Identifier (Edit with caution)"
                  placeholder="Enter unique ID"
                  value={data.placementIdentifier}
                  onChange={(e) => onChange('placementIdentifier', e.target.value)}
                  icon={Clipboard}
                />
            ) : (
               // If no ID exists (new placement), show the platform link for setup
               <Input
                  label="Platform Link (Web/App Store)"
                  placeholder="Enter Platform Link"
                  value={data.platformLink}
                  onChange={(e) => onChange('platformLink', e.target.value)}
                  icon={Clipboard}
                />
            )}

            <Input
              label="Currency Name"
              placeholder="e.g., Coins, Points, Gems"
              value={data.currencyName}
              onChange={(e) => onChange('currencyName', e.target.value)}
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
              icon={BarChart}
            />
            <Input
              label="Postback Uri"
              placeholder="Enter your server's postback URL"
              value={data.postbackUri}
              onChange={(e) => onChange('postbackUri', e.target.value)}
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
            <div className="flex justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
              <span className="text-gray-600 font-medium">Status:</span>
              <span className={`font-bold ${data.placementIdentifier ? 'text-green-600' : 'text-yellow-600'}`}>
                {data.placementIdentifier ? 'LIVE' : 'DRAFT'}
              </span>
            </div>
            <div className="flex justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
              <span className="text-gray-600 font-medium">Platform:</span>
              <span className="font-bold text-violet-600">
                {data.platformType || 'UNSELECTED'}
              </span>
            </div>
            <div className="flex justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
              <span className="text-gray-600 font-medium">Placement ID:</span>
              <span className="font-bold text-gray-900 truncate" title={data.placementIdentifier || 'N/A'}>
                {data.placementIdentifier ? `${data.placementIdentifier.substring(0, 10)}...` : 'N/A'}
              </span>
            </div>
            
            <hr className="border-gray-200 my-4" />
            <div className="pt-2">
              <h4 className="text-lg font-bold text-gray-900 mb-2">Platform Notes</h4>
              <p className="text-sm text-gray-700 border-l-4 border-violet-600 pl-3 py-1 bg-violet-50 rounded-r-lg">
                {data.platformType ? `Traffic is currently configured for the ${data.platformType} environment.` : 'Select a platform type (Android, iOS, or Website) to continue setup.'}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

// 2. Events Tab
const EventsManager = ({ events, onAdd, onEdit, onDelete }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null); // null for new, object for edit

    const handleOpenModal = (event = null) => {
        setEditingEvent(event);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingEvent(null);
    };

    const handleSubmitEvent = (formData) => {
        if (editingEvent) {
            onEdit({ ...formData, id: editingEvent.id });
        } else {
            // New event logic
            onAdd(formData);
        }
        handleCloseModal();
    };


    return (
        <Card title="Event Management" description="Set up temporary bonuses and multipliers for your offerwall." className="p-0">
            <div className="flex justify-end p-4">
                <Button onClick={() => handleOpenModal(null)} icon={Plus} className="text-sm">Create New Event</Button>
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
                                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full ${
                                            event.status === 'Active' ? 'bg-green-100 text-green-700' : 
                                            event.status === 'Upcoming' ? 'bg-blue-100 text-blue-700' :
                                            'bg-yellow-100 text-yellow-700'
                                        }`}>
                                            {event.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{event.startDate}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{event.endDate || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="flex space-x-2">
                                            <button 
                                                title="Edit" 
                                                onClick={() => handleOpenModal(event)}
                                                className="text-violet-600 hover:text-violet-800 transition p-1 rounded-md hover:bg-gray-200">
                                                <Edit className="h-4 w-4" />
                                            </button>
                                            <button 
                                                title="Delete" 
                                                onClick={() => onDelete(event.id)}
                                                className="text-red-600 hover:text-red-800 transition p-1 rounded-md hover:bg-gray-200">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
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

            <EventModal
                eventData={editingEvent}
                isEditing={!!editingEvent}
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSubmit={handleSubmitEvent}
            />
        </Card>
    );
};

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

  // Simple state to hold the currently selected placement configuration and events
  const initialData = useMemo(() => isNewPlacement ? NEW_PLACEMENT_DATA : EXISTING_PLACEMENT_DATA, [isNewPlacement]);
  const [placementData, setPlacementData] = useState(initialData);

  // Sync placementData state when initialData changes (i.e., when switching between existing/new)
  useMemo(() => {
    setPlacementData(initialData);
    setActiveTab('placement'); 
  }, [initialData]);


  // --- Placement Configuration Handlers ---

  const handleInputChange = useCallback((key, value) => {
    // Allows editing of all top-level fields (including testing fields)
    setPlacementData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handlePlacementSubmit = () => {
    const action = placementData.placementIdentifier ? 'Updated' : 'Created';
    
    if (action === 'Created') {
        // Simulate creation: set a mock identifier and switch back to view mode
        const newId = 'MOCK-' + Math.random().toString(36).substring(2, 10).toUpperCase();
        const newPlatformName = placementData.platformName || 'New Platform';
        const newPlatformType = placementData.platformType || 'Website';
        
        setPlacementData(prev => ({ 
            ...prev, 
            placementIdentifier: newId, 
            platformName: newPlatformName,
            platformType: newPlatformType
        }));
        setIsNewPlacement(false);
        console.log(`Placement '${newPlatformName}' created with ID: ${newId}`);
    } else {
        // Simulate update
        console.log(`Placement '${placementData.platformName}' configuration updated. Placement ID: ${placementData.placementIdentifier}`);
        // In a real app, this is where you'd call a Firestore 'setDoc' or 'updateDoc'
    }
    console.log("Submitted Data:", placementData);
  };

  // --- Event Management Handlers ---

  const handleAddEvent = (newEvent) => {
    setPlacementData(prev => {
        const newId = 'EVT' + (prev.events.length + 1).toString().padStart(3, '0');
        return {
            ...prev,
            events: [...prev.events, { ...newEvent, id: newId }]
        };
    });
    console.log("New Event Added:", newEvent);
  };

  const handleUpdateEvent = (updatedEvent) => {
    setPlacementData(prev => ({
        ...prev,
        events: prev.events.map(e => e.id === updatedEvent.id ? updatedEvent : e)
    }));
    console.log(`Event ${updatedEvent.id} Updated:`, updatedEvent);
  };

  const handleDeleteEvent = (eventId) => {
    setPlacementData(prev => ({
        ...prev,
        events: prev.events.filter(e => e.id !== eventId)
    }));
    console.log(`Event ${eventId} Deleted.`);
  };


  // --- Postback Testing Handler ---

  const handleTestPostback = () => {
    console.log('--- Test Postback Sent (Simulated) ---');
    console.log({
      userId: placementData.userId,
      rewardValue: placementData.rewardValue,
      offerName: placementData.offerName,
      status: placementData.status,
      offerId: placementData.offerId,
      userIp: placementData.userIp,
      postbackUri: placementData.postbackUri,
    });
    console.log("Test postback initiated! Check your server logs for data sent to:", placementData.postbackUri);
  };

  // --- Rendering Logic ---

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
        // Disable event management if no placement is active (i.e., creating a new one)
        return isNewPlacement 
          ? <Card title="Events" description="Events can only be managed after a placement is created." className="h-64 flex items-center justify-center text-center">
              <p className="text-gray-500">Please first <span className="text-violet-600 font-medium">Create</span> or <span className="text-violet-600 font-medium">Select</span> a placement to manage events.</p>
            </Card> 
          : <EventsManager 
                events={placementData.events} 
                onAdd={handleAddEvent}
                onEdit={handleUpdateEvent}
                onDelete={handleDeleteEvent}
            />;
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
      className={`flex items-center justify-center space-x-2 py-3 px-6 rounded-t-xl transition-all duration-200 text-base font-semibold ${
        activeTab === tabKey
          ? 'bg-white text-violet-700 border-b-2 border-violet-600 shadow-t'
          : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
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

export default Placements;
