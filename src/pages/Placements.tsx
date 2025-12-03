import { useState, useCallback, useMemo, useEffect } from "react";
import { Grid, Calendar, Play, BarChart, Settings, Bell, Info, Send, Clipboard, Globe, DollarSign, Edit, Trash2, X, Plus, CheckCircle, AlertCircle, Loader2, Package, Code, Copy } from "lucide-react";
import { placementApi } from "../services/placementApi";
import { OfferwallIframeEnhanced } from "../components/OfferwallIframeEnhanced";
import { OfferwallProfessional } from "../components/OfferwallProfessional";

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
  status: 'LIVE',
  // Testing tab fields initialization
  userId: 'user_12345',
  rewardValue: '100',
  offerName: 'Survey - Top Offers',
  testStatus: 'Completed',
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
  status: 'LIVE',
  userId: '',
  rewardValue: '',
  offerName: '',
  testStatus: 'Completed',
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

const StatusToggle = ({ status, onChange, disabled = false }) => {
  const statusOptions = [
    { value: 'LIVE', label: 'Live', color: 'bg-green-500', description: 'Placement is active and receiving traffic' },
    { value: 'PAUSED', label: 'Paused', color: 'bg-yellow-500', description: 'Placement is temporarily disabled' },
    { value: 'INACTIVE', label: 'Inactive', color: 'bg-red-500', description: 'Placement is permanently disabled' }
  ];

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-700 flex items-center">
        Placement Status
        <Info className="h-3 w-3 ml-1 text-gray-400 cursor-pointer hover:text-violet-500 transition" />
      </label>
      <div className="grid grid-cols-3 gap-2">
        {statusOptions.map(option => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange('status', option.value)}
            className={`
              p-3 rounded-lg border-2 transition-all duration-200 text-sm font-medium
              ${status === option.value 
                ? `${option.color} text-white border-transparent shadow-lg` 
                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md'}
            `}
            title={option.description}
          >
            <div className="flex items-center justify-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${status === option.value ? 'bg-white' : option.color}`}></div>
              <span>{option.label}</span>
            </div>
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        {statusOptions.find(opt => opt.value === status)?.description || 'Select a status for this placement'}
      </p>
    </div>
  );
};

const Toast = ({ message, type, isVisible, onClose }) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000); // Auto-close after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
  const Icon = type === 'success' ? CheckCircle : AlertCircle;

  return (
    <div className={`fixed top-4 right-4 z-50 ${bgColor} text-white px-6 py-4 rounded-lg shadow-lg flex items-center space-x-3 transform transition-all duration-300 ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}>
      <Icon className="h-5 w-5" />
      <span className="font-medium">{message}</span>
      <button onClick={onClose} className="ml-4 text-white hover:text-gray-200">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

const LoadingSpinner = ({ size = 'md', text = 'Loading...' }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };

  return (
    <div className="flex items-center justify-center space-x-2">
      <Loader2 className={`${sizeClasses[size]} animate-spin text-violet-600`} />
      <span className="text-gray-600 font-medium">{text}</span>
    </div>
  );
};

const EmptyState = ({ icon: Icon = Package, title, description, actionButton }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 text-center mb-6 max-w-sm">{description}</p>
      {actionButton && actionButton}
    </div>
  );
};


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
const PlacementConfiguration = ({ data, onChange, onSubmit, isNew, loading = false }) => {
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
            <StatusToggle
              status={data.status || 'LIVE'}
              onChange={onChange}
              disabled={false}
            />
          </div>

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

        <Button onClick={onSubmit} className="w-full mt-6" icon={data.placementIdentifier ? Edit : Play} disabled={loading}>
          {loading ? (
            <div className="flex items-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{data.placementIdentifier ? 'Saving...' : 'Creating...'}</span>
            </div>
          ) : (
            data.placementIdentifier ? 'Save Configuration Changes' : 'Create New Placement'
          )}
        </Button>
      </div>

      <div className="lg:col-span-1">
        <Card title="Current Status" className="sticky top-4">
          <div className="space-y-4">
            <div className="flex justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
              <span className="text-gray-600 font-medium">Approval Status:</span>
              <span className={`font-bold px-2 py-1 rounded text-xs ${
                data.approvalStatus === 'APPROVED' ? 'bg-green-100 text-green-800' :
                data.approvalStatus === 'REJECTED' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {data.approvalStatus || 'PENDING_APPROVAL'}
              </span>
            </div>
            <div className="flex justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
              <span className="text-gray-600 font-medium">Status:</span>
              <span className={`font-bold ${data.placementIdentifier ? 'text-green-600' : 'text-yellow-600'}`}>
                {data.status || 'DRAFT'}
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
            
            {data.reviewMessage && (
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <h5 className="font-medium text-blue-900 mb-1">Review Message</h5>
                <p className="text-sm text-blue-800">{data.reviewMessage}</p>
              </div>
            )}
            
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

// 3. Integration Tab - Iframe Generator with Live Preview
const IntegrationGuide = ({ data }) => {
  const [copied, setCopied] = useState(false);
  const [testUserId, setTestUserId] = useState('test_user_123');
  const [showPreview, setShowPreview] = useState(true);
  
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const iframeSnippet = `<iframe 
  src="${baseUrl}/offerwall?placement_id=${data.placementIdentifier || 'YOUR_PLACEMENT_ID'}&user_id={user_id}&api_key=${data.apiKey || 'YOUR_API_KEY'}"
  style="height:100vh;width:100%;border:0;"
  title="${data.offerwallTitle || 'Offerwall'}">
</iframe>`;

  const previewUrl = `${baseUrl}/offerwall?placement_id=${data.placementIdentifier || 'YOUR_PLACEMENT_ID'}&user_id=${testUserId}&api_key=${data.apiKey || 'YOUR_API_KEY'}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(iframeSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const isReady = data.placementIdentifier && data.apiKey;

  return (
    <div className="space-y-6">
      {/* Live Preview Section */}
      {isReady && (
        <Card title="🎬 Live Offerwall Preview" description="See how your offerwall looks in real-time" className="space-y-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Test User ID</label>
              <input
                type="text"
                value={testUserId}
                onChange={(e) => setTestUserId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="test_user_123"
              />
            </div>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="mt-6 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </button>
          </div>

          {showPreview && (
            <div className="border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50">
              <div className="bg-gradient-to-r from-violet-600 to-purple-600 text-white px-4 py-3 text-sm font-medium">
                📱 Live Offerwall Preview ({data.offerwallTitle || 'Offerwall'})
              </div>
              <div style={{
                width: '100%',
                height: '800px',
                overflow: 'auto',
                borderRadius: '0 0 8px 8px'
              }} className="bg-slate-900">
                <OfferwallProfessional
                  placementId={data.placementIdentifier || 'YOUR_PLACEMENT_ID'}
                  userId={testUserId}
                  subId="test_sub"
                  country="US"
                />
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Integration Code Section */}
      <Card title="📋 Iframe Integration" description="Copy and embed this code on your website" className="space-y-6">
        {!isReady && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center">
              <Info className="h-5 w-5 text-yellow-600 mr-2" />
              <p className="text-yellow-800">
                <strong>Setup Required:</strong> Please save your placement configuration first to generate the iframe snippet.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Iframe Code Snippet
            </label>
            <div className="relative">
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto font-mono">
                <code>{iframeSnippet}</code>
              </pre>
              <button
                onClick={copyToClipboard}
                className="absolute top-2 right-2 bg-gray-700 hover:bg-gray-600 text-white p-2 rounded transition-colors"
                title="Copy to clipboard"
              >
                {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            {copied && (
              <p className="text-sm text-green-600 mt-1">✓ Copied to clipboard!</p>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2 flex items-center">
              <Code className="h-4 w-4 mr-2" />
              Implementation Notes
            </h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Replace <code className="bg-blue-100 px-1 rounded">{'{user_id}'}</code> with your actual user ID dynamically</li>
              <li>• The iframe will automatically track impressions and clicks</li>
              <li>• Ensure your domain is whitelisted for CORS if needed</li>
              <li>• The offerwall is fully responsive and mobile-friendly</li>
            </ul>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h5 className="font-medium text-gray-900 mb-2">Placement Details</h5>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Placement ID:</span>
                  <code className="bg-gray-200 px-2 py-1 rounded text-xs">
                    {data.placementIdentifier || 'Not generated yet'}
                  </code>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">API Key:</span>
                  <code className="bg-gray-200 px-2 py-1 rounded text-xs">
                    {data.apiKey ? `${data.apiKey.substring(0, 8)}...` : 'Not generated yet'}
                  </code>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    data.status === 'LIVE' ? 'bg-green-100 text-green-800' : 
                    data.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-800' : 
                    'bg-red-100 text-red-800'
                  }`}>
                    {data.status || 'DRAFT'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h5 className="font-medium text-gray-900 mb-2">Security Notes</h5>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• API key validates placement access</li>
                <li>• Only LIVE placements are accessible</li>
                <li>• All interactions are tracked securely</li>
                <li>• User data is handled per privacy policy</li>
              </ul>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-900 mb-2 flex items-center">
              <Info className="h-4 w-4 mr-2" />
              Testing Your Integration
            </h4>
            <p className="text-sm text-green-800 mb-3">
              You can test your offerwall integration by visiting the direct URL:
            </p>
            <div className="bg-white border rounded p-2 mb-3">
              <code className="text-sm text-gray-800 break-all">
                {baseUrl}/offerwall?placement_id={data.placementIdentifier || 'YOUR_PLACEMENT_ID'}&user_id=test_user&api_key={data.apiKey || 'YOUR_API_KEY'}
              </code>
            </div>
            {isReady && (
              <button
                onClick={() => window.open(`${baseUrl}/offerwall?placement_id=${data.placementIdentifier}&user_id=test_user&api_key=${data.apiKey}`, '_blank')}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
              >
                Open in New Tab
              </button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

// 4. Testing Tab
const TestingPostback = ({ data, onChange, onSubmit, loading = false }) => {
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

      <Button onClick={onSubmit} className="w-full" icon={Send} disabled={!isPlacementReady || loading}>
        {loading ? (
          <div className="flex items-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Testing Postback...</span>
          </div>
        ) : (
          'Send Test Postback'
        )}
      </Button>
    </Card>
  );
};


// --- Main Component ---

export const Placements = () => {
  const [activeTab, setActiveTab] = useState('placement');
  const [isNewPlacement, setIsNewPlacement] = useState(false); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [placements, setPlacements] = useState([]);
  const [selectedPlacementIndex, setSelectedPlacementIndex] = useState(0);
  
  // Toast notification state
  const [toast, setToast] = useState({ message: '', type: '', isVisible: false });

  // Helper function to show toast notifications
  const showToast = (message, type = 'info') => {
    setToast({ message, type, isVisible: true });
  };

  const hideToast = () => {
    setToast(prev => ({ ...prev, isVisible: false }));
  };

  // Simple state to hold the currently selected placement configuration and events
  const initialData = useMemo(() => {
    if (isNewPlacement) {
      return NEW_PLACEMENT_DATA;
    }
    // Use data from API if available, otherwise fallback to existing data
    return placements.length > 0 ? placements[selectedPlacementIndex] : EXISTING_PLACEMENT_DATA;
  }, [isNewPlacement, placements, selectedPlacementIndex]);
  
  const [placementData, setPlacementData] = useState(initialData);

  // Load placements from API on component mount
  useEffect(() => {
    loadPlacements();
  }, []);

  // Sync placementData state when initialData changes
  useMemo(() => {
    setPlacementData(initialData);
    setActiveTab('placement'); 
  }, [initialData]);

  const loadPlacements = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if user is authenticated
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please login first to access placements');
        setPlacements([EXISTING_PLACEMENT_DATA]); // Fallback to demo data
        setLoading(false);
        return;
      }
      
      const response = await placementApi.getPlacements();
      setPlacements(response.placements);
      
      // If no placements exist, show new placement form
      if (response.placements.length === 0) {
        setIsNewPlacement(true);
      }
    } catch (err) {
      console.error('Error loading placements:', err);
      
      // Handle authentication errors
      if (err.message.includes('authentication') || err.message.includes('login')) {
        setError('Authentication required. Please login to access placements.');
      } else {
        setError(err.message);
      }
      
      // Fallback to existing data if API fails
      setPlacements([EXISTING_PLACEMENT_DATA]);
    } finally {
      setLoading(false);
    }
  };


  // --- Placement Configuration Handlers ---

  const handleInputChange = useCallback((key, value) => {
    // Allows editing of all top-level fields (including testing fields)
    setPlacementData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handlePlacementSubmit = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check authentication first
      const token = localStorage.getItem('token');
      if (!token) {
        showToast('Please login first to create or update placements', 'error');
        return;
      }
      
      const action = placementData.placementIdentifier ? 'Updated' : 'Created';
      
      if (action === 'Created') {
        // Create new placement via API
        const newPlacement = await placementApi.createPlacement(placementData);
        
        // Add to placements list and select it
        setPlacements(prev => [...prev, newPlacement]);
        setSelectedPlacementIndex(placements.length); // Select the new placement
        setIsNewPlacement(false);
        
        console.log(`Placement '${newPlacement.offerwallTitle}' created with ID: ${newPlacement.placementIdentifier}`);
        showToast(`Placement "${newPlacement.offerwallTitle}" created successfully!`, 'success');
      } else {
        // Update existing placement via API
        const updatedPlacement = await placementApi.updatePlacement(placementData.id, placementData);
        
        // Update in placements list
        setPlacements(prev => prev.map((p, index) => 
          index === selectedPlacementIndex ? updatedPlacement : p
        ));
        
        console.log(`Placement '${updatedPlacement.offerwallTitle}' updated. ID: ${updatedPlacement.placementIdentifier}`);
        showToast(`Placement "${updatedPlacement.offerwallTitle}" updated successfully!`, 'success');
      }
    } catch (err) {
      console.error('Error saving placement:', err);
      
      // Handle authentication errors
      if (err.message.includes('authentication') || err.message.includes('login')) {
        setError('Authentication required. Please login to manage placements.');
        showToast('Please login first to create or update placements', 'error');
      } else {
        setError(err.message);
        showToast(`Error ${placementData.placementIdentifier ? 'updating' : 'creating'} placement: ${err.message}`, 'error');
      }
    } finally {
      setLoading(false);
    }
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

  const handleTestPostback = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const testData = {
        userId: placementData.userId,
        rewardValue: placementData.rewardValue,
        offerName: placementData.offerName,
        status: placementData.status,
        offerId: placementData.offerId,
        userIp: placementData.userIp,
        postbackUri: placementData.postbackUri,
        placementIdentifier: placementData.placementIdentifier
      };
      
      const result = await placementApi.testPostback(testData);
      
      console.log('--- Test Postback Result ---');
      console.log(result);
      
      if (result.success) {
        showToast(`Test postback sent successfully! ${result.message}`, 'success');
      } else {
        showToast(`Test postback failed: ${result.message}`, 'error');
      }
    } catch (err) {
      console.error('Error testing postback:', err);
      setError(err.message);
      showToast(`Error testing postback: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // --- Rendering Logic ---

  const renderActiveTab = () => {
    // Show empty state if user is authenticated but has no placements and isn't creating a new one
    if (!isNewPlacement && placements.length === 0 && localStorage.getItem('token') && !loading) {
      return (
        <Card title="Welcome to Placement Management" description="Get started with your first placement">
          <EmptyState
            icon={Package}
            title="No Placements Yet"
            description="Get started by creating your first ad placement. You can configure offerwalls, set exchange rates, and manage postback URLs."
            actionButton={
              <Button onClick={() => setIsNewPlacement(true)} icon={Plus} className="bg-violet-600 hover:bg-violet-700">
                Create Your First Placement
              </Button>
            }
          />
        </Card>
      );
    }

    switch (activeTab) {
      case 'placement':
        return (
          <PlacementConfiguration
            data={placementData}
            onChange={handleInputChange}
            onSubmit={handlePlacementSubmit}
            isNew={isNewPlacement}
            loading={loading}
          />
        );
      case 'events':
        // Disable event management if no placement is active (i.e., creating a new one)
        return isNewPlacement 
          ? <Card title="Events" description="Events can only be managed after a placement is created.">
              <EmptyState
                icon={Calendar}
                title="No Events Yet"
                description="Create a placement first, then you can add events and multipliers to boost your earnings."
                actionButton={
                  <Button onClick={() => setActiveTab('placement')} icon={Grid} className="text-sm">
                    Go to Placement Setup
                  </Button>
                }
              />
            </Card> 
          : <EventsManager 
                events={placementData.events} 
                onAdd={handleAddEvent}
                onEdit={handleUpdateEvent}
                onDelete={handleDeleteEvent}
            />;
      case 'integration':
        return (
          <IntegrationGuide
            data={placementData}
          />
        );
      case 'testing':
        return (
          <TestingPostback
            data={placementData}
            onChange={handleInputChange}
            onSubmit={handleTestPostback}
            loading={loading}
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
        {/* Authentication Status */}
        <div className="mb-4">
          {!localStorage.getItem('token') ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center">
                <Info className="h-5 w-5 text-yellow-600 mr-2" />
                <p className="text-yellow-800">
                  <strong>Authentication Required:</strong> Please login first to create and manage real placements. 
                  Currently showing demo data only.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <Info className="h-5 w-5 text-green-600 mr-2" />
                <p className="text-green-800">
                  <strong>Authenticated:</strong> You can now create and manage real placements.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Top Navigation Buttons */}
        <div className="flex space-x-4 mb-10 items-center flex-wrap">
            <NavButton 
                label="Add New Placement" 
                isActive={isNewPlacement} 
                onClick={() => setIsNewPlacement(true)} 
            />
            {loading ? (
              <LoadingSpinner size="sm" text="Loading placements..." />
            ) : placements.length > 0 ? (
              placements.map((placement, index) => (
                <NavButton 
                  key={placement.id || index}
                  label={placement.platformName || placement.offerwallTitle} 
                  secondaryLabel={placement.platformLink ? placement.platformLink.split('//')[1] : placement.placementIdentifier?.substring(0, 8) + '...'}
                  isActive={!isNewPlacement && selectedPlacementIndex === index} 
                  onClick={() => {
                    setIsNewPlacement(false);
                    setSelectedPlacementIndex(index);
                  }} 
                />
              ))
            ) : !error && localStorage.getItem('token') ? (
              <div className="px-4 py-2 text-gray-500 text-sm italic">
                No placements yet. Create your first one!
              </div>
            ) : null}
            {error && (
              <div className="px-4 py-2 text-red-500 text-sm">Error: {error}</div>
            )}
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
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl shadow-inner border border-gray-300">
          <TabButton tabKey="placement" Icon={Grid} label="Placement Details" />
          <TabButton tabKey="events" Icon={Calendar} label="Event Management" />
          <TabButton tabKey="integration" Icon={Code} label="Iframe Integration" />
          <TabButton tabKey="testing" Icon={Play} label="Postback Testing" />
        </div>

        {/* Tab Content */}
        <div className="pt-8">
            {renderActiveTab()}
        </div>
      </div>

      {/* Toast Notifications */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
    </div>
  );
};

export default Placements;
