import { useState, useCallback, useMemo, useEffect } from "react";
import { Grid, Calendar, Play, BarChart, Settings, Bell, Info, Send, Clipboard, Globe, DollarSign, Edit, Trash2, X, Plus, CheckCircle, AlertCircle, Loader2, Package, Code, Copy, Clock, Smartphone, Monitor, Wifi, Shield, Activity, XCircle, PauseCircle, Layout } from "lucide-react";
import { placementApi } from "../services/placementApi";
import { clearPlacementCache } from "../hooks/usePlacementApproval";
import { OfferwallIframeEnhanced } from "../components/OfferwallIframeEnhanced";
import { OfferwallProfessional } from "../components/OfferwallProfessional";
import { useAuth } from "../contexts/AuthContext";

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
  <div className={`bg-white rounded-2xl p-6 border border-gray-100 hover:border-gray-200 transition-all duration-300 ${className}`}>
    {title && (
      <div className="mb-5 pb-4 border-b border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
      </div>
    )}
    <div className="text-gray-700">{children}</div>
  </div>
);

const Input = ({ label, placeholder, value, onChange, type = 'text', icon: Icon, readOnly = false }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center">
      {label}
    </label>
    <div className="relative">
      {Icon && <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        className={`w-full py-2.5 px-3.5 rounded-xl border bg-white transition duration-150 ease-in-out placeholder-gray-400 text-sm
          ${
            readOnly 
              ? 'border-gray-200 text-gray-500 cursor-not-allowed bg-gray-50' 
              : 'border-gray-200 text-gray-900 pl-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-300'
          }
        `}
      />
    </div>
  </div>
);

const Select = ({ label, value, onChange, options, readOnly = false }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center">
      {label}
    </label>
    <select
      value={value}
      onChange={onChange}
      disabled={readOnly}
      className={`w-full py-2.5 px-3.5 rounded-xl border bg-white text-gray-900 appearance-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out text-sm
        ${
          readOnly 
            ? 'border-gray-200 text-gray-500 cursor-not-allowed bg-gray-50' 
            : 'border-gray-200 hover:border-gray-300'
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
    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center">
      {label}
    </label>
    <textarea
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      rows={3}
      className="w-full py-2.5 px-3.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out placeholder-gray-400 text-sm hover:border-gray-300"
    />
  </div>
);

const Button = ({ children, onClick, variant = 'primary', icon: Icon, className = '', disabled = false }) => {
  let styles;
  switch (variant) {
    case 'secondary':
      styles = 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200';
      break;
    case 'outline':
      styles = 'bg-white border-2 border-gray-200 hover:bg-gray-50 text-gray-700 hover:border-gray-300';
      break;
    case 'danger':
        styles = 'bg-red-600 hover:bg-red-700 text-white';
        break;
    default:
      styles = disabled 
        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
        : 'bg-blue-600 hover:bg-blue-700 text-white';
      break;
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center px-5 py-2.5 rounded-xl font-medium text-sm transition duration-200 ease-in-out ${styles} ${className}`}
    >
      {Icon && <Icon className="h-4 w-4 mr-2" />}
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
    { value: 'LIVE', icon: '●', color: 'bg-emerald-500', hoverBorder: 'hover:border-emerald-400', description: 'Live', ring: 'ring-emerald-500/40' },
    { value: 'PAUSED', icon: '●', color: 'bg-amber-500', hoverBorder: 'hover:border-amber-400', description: 'Paused', ring: 'ring-amber-500/40' },
    { value: 'INACTIVE', icon: '●', color: 'bg-gray-400', hoverBorder: 'hover:border-gray-300', description: 'Inactive', ring: 'ring-gray-400/40' }
  ];

  return (
    <div className="flex items-center space-x-2">
      {statusOptions.map(option => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange('status', option.value)}
          className={`
            w-8 h-8 rounded-lg border-2 transition-all duration-200 flex items-center justify-center
            ${status === option.value 
              ? `${option.color} border-transparent shadow-sm ring-2 ring-offset-1 ${option.ring}` 
              : `bg-white border-gray-200 ${option.hoverBorder}`
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
          title={option.description}
        >
          <div className={`w-2.5 h-2.5 rounded-full ${status === option.value ? 'bg-white' : option.color}`}></div>
        </button>
      ))}
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
                        placeholder=""
                        value={formData.startDate} 
                        onChange={(e) => handleFormChange('startDate', e.target.value)}
                        icon={Calendar}
                    />
                    <Input 
                        label="End Date (Optional)" 
                        type="date"
                        placeholder=""
                        value={formData.endDate} 
                        onChange={(e) => handleFormChange('endDate', e.target.value)}
                        icon={Calendar}
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
  const [showPlatformSelect, setShowPlatformSelect] = useState(!data.platformType);

  const onSelectPlatform = (platform) => {
      if (!isPlatformLocked) {
        onChange('platformType', platform);
        setShowPlatformSelect(false);
      }
  };

  const renderPlatformSelection = () => {
    const platforms = [
      { name: 'Android', icon: Smartphone, gradient: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
      { name: 'iOS', icon: Smartphone, gradient: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
      { name: 'Website', icon: Monitor, gradient: 'from-purple-500 to-pink-600', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' }
    ];

    return (
        <div className="grid grid-cols-3 gap-2">
            {platforms.map(({ name, icon: Icon, gradient, bg, border, text }) => {
                const isActive = data.platformType === name;
                return (
                    <button
                        key={name}
                        onClick={() => onSelectPlatform(name)}
                        disabled={isPlatformLocked}
                        className={`group relative overflow-hidden rounded-lg p-3 transition-all duration-300 ${
                            isActive
                                ? `bg-gradient-to-br ${gradient} text-white shadow-sm`
                                : `${bg} ${border} border ${text} hover:scale-[1.02] hover:shadow-sm`
                        } ${isPlatformLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                    >
                        {/* Animated background gradient on hover */}
                        {!isActive && (
                            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
                        )}
                        
                        <div className="relative flex flex-col items-center space-y-1.5">
                            <div className={`p-1.5 rounded-lg transition-all duration-300 ${
                                isActive 
                                    ? 'bg-white/20 backdrop-blur-sm' 
                                    : `${bg} group-hover:scale-110`
                            }`}>
                                <Icon className={`h-4 w-4 ${isActive ? 'text-white' : text}`} />
                            </div>
                            <span className={`font-semibold text-xs ${isActive ? 'text-white' : text}`}>
                                {name}
                            </span>
                        </div>

                        {/* Active indicator */}
                        {isActive && (
                            <div className="absolute top-1.5 right-1.5">
                                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                            </div>
                        )}
                    </button>
                );
            })}
        </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <div className="lg:col-span-2 space-y-2.5">

        {/* Platform Selection Section - Collapsible */}
        {data.platformType && !showPlatformSelect ? (
          <button
            onClick={() => !isPlatformLocked && setShowPlatformSelect(true)}
            disabled={isPlatformLocked}
            className={`w-full flex items-center justify-between p-2 rounded-lg border transition-all ${
              isPlatformLocked 
                ? 'bg-gray-50 border-gray-200 cursor-not-allowed' 
                : 'bg-white border-gray-200 hover:border-gray-300 cursor-pointer'
            }`}
          >
            <div className="flex items-center gap-2">
              {(data.platformType || '').toLowerCase() === 'android' ? <Smartphone className="h-4 w-4 text-emerald-600" /> :
               (data.platformType || '').toLowerCase() === 'ios' ? <Smartphone className="h-4 w-4 text-blue-600" /> :
               <Monitor className="h-4 w-4 text-purple-600" />}
              <span className="text-sm font-medium text-gray-900 capitalize">{data.platformType}</span>
            </div>
            {!isPlatformLocked && (
              <Edit className="h-3.5 w-3.5 text-gray-400" />
            )}
          </button>
        ) : (
          <div className="bg-gradient-to-br from-gray-50 to-white rounded-lg p-2.5 border border-gray-100">
            <div className="mb-2">
              <h3 className="text-xs font-semibold text-gray-900">Select Platform</h3>
            </div>
            {renderPlatformSelection()}
          </div>
        )}
        
        {/* Core Configuration Card */}
        <div className="bg-white rounded-lg p-3 border border-gray-100 hover:border-gray-200 transition-all duration-300">
          <div className="mb-3 pb-2 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <Settings className="h-3 w-3 text-white" />
              </div>
              Core Configuration
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <Input
              label="Exchange Rate (1 USD = X Currency)"
              placeholder="e.g., 60"
              type="number"
              value={data.exchangeRate}
              onChange={(e) => onChange('exchangeRate', e.target.value)}
              icon={BarChart}
            />
            <Input
              label="Postback URL"
              placeholder="https://yourserver.com/postback?click_id={click_id}&user_id={username}&points={points}"
              value={data.postbackUri}
              onChange={(e) => onChange('postbackUri', e.target.value)}
              icon={Send}
            />
          </div>

          {/* Postback URL Builder */}
          <div className="mt-3 p-3 bg-gradient-to-br from-violet-50 to-indigo-50 rounded-lg border border-violet-200">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-violet-900 flex items-center gap-1.5">
                <Code className="h-3.5 w-3.5" />
                Postback URL Builder
              </h4>
            </div>

            <p className="text-[11px] text-gray-500 mb-3">Add your parameters below. We'll build the postback URL automatically. On each conversion, we replace our macros with real data and hit your URL.</p>

            {/* Base URL */}
            <div className="mb-3">
              <label className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Your Server Base URL</label>
              <input
                type="text"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-200 focus:border-violet-400 outline-none font-mono"
                placeholder="https://yourserver.com/postback"
                value={data._postbackBaseUrl || (data.postbackUri ? data.postbackUri.split('?')[0] : '')}
                onChange={(e) => {
                  onChange('_postbackBaseUrl', e.target.value);
                  // Rebuild full URL
                  const params = (data._postbackParams || []).filter((p: any) => p.theirParam && p.ourMacro);
                  const qs = params.map((p: any) => `${p.theirParam}=${p.ourMacro}`).join('&');
                  onChange('postbackUri', qs ? `${e.target.value}?${qs}` : e.target.value);
                }}
              />
            </div>

            {/* Parameter Rows */}
            <div className="space-y-2 mb-3">
              <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-1">
                <span>Your Parameter Name</span>
                <span>=</span>
                <span>Our Data (MoustacheLeads)</span>
                <span></span>
              </div>
              {(data._postbackParams || [
                { theirParam: '', ourMacro: '{click_id}' },
                { theirParam: '', ourMacro: '{username}' },
                { theirParam: '', ourMacro: '{points}' },
              ]).map((param: any, idx: number) => (
                <div key={idx} className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center">
                  <input
                    type="text"
                    className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-200 focus:border-violet-400 outline-none font-mono"
                    placeholder="e.g. uid, txn_id, reward"
                    value={param.theirParam}
                    onChange={(e) => {
                      const params = [...(data._postbackParams || [{ theirParam: '', ourMacro: '{click_id}' }, { theirParam: '', ourMacro: '{username}' }, { theirParam: '', ourMacro: '{points}' }])];
                      params[idx] = { ...params[idx], theirParam: e.target.value };
                      onChange('_postbackParams', params);
                      // Rebuild URL
                      const base = data._postbackBaseUrl || (data.postbackUri ? data.postbackUri.split('?')[0] : '');
                      const qs = params.filter((p: any) => p.theirParam && p.ourMacro).map((p: any) => `${p.theirParam}=${p.ourMacro}`).join('&');
                      onChange('postbackUri', qs ? `${base}?${qs}` : base);
                    }}
                  />
                  <span className="text-violet-400 text-sm font-bold">=</span>
                  <select
                    className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-200 focus:border-violet-400 outline-none bg-white font-mono text-violet-700"
                    value={param.ourMacro}
                    onChange={(e) => {
                      const params = [...(data._postbackParams || [{ theirParam: '', ourMacro: '{click_id}' }, { theirParam: '', ourMacro: '{username}' }, { theirParam: '', ourMacro: '{points}' }])];
                      params[idx] = { ...params[idx], ourMacro: e.target.value };
                      onChange('_postbackParams', params);
                      const base = data._postbackBaseUrl || (data.postbackUri ? data.postbackUri.split('?')[0] : '');
                      const qs = params.filter((p: any) => p.theirParam && p.ourMacro).map((p: any) => `${p.theirParam}=${p.ourMacro}`).join('&');
                      onChange('postbackUri', qs ? `${base}?${qs}` : base);
                    }}
                  >
                    <option value="{click_id}">click_id — Unique Click ID</option>
                    <option value="{username}">username — User who completed</option>
                    <option value="{points}">points — Reward amount</option>
                    <option value="{payout}">payout — Payout in USD</option>
                    <option value="{offer_id}">offer_id — Offer identifier</option>
                    <option value="{offer_name}">offer_name — Offer name</option>
                    <option value="{status}">status — Conversion status</option>
                    <option value="{user_ip}">user_ip — User IP address</option>
                    <option value="{affiliate_id}">affiliate_id — Affiliate ID</option>
                    <option value="{transaction_id}">transaction_id — Transaction ID</option>
                    <option value="{sub_id1}">sub_id1 — Sub ID 1</option>
                    <option value="{sub_id2}">sub_id2 — Sub ID 2</option>
                    <option value="{sub_id3}">sub_id3 — Sub ID 3</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const params = [...(data._postbackParams || [])];
                      params.splice(idx, 1);
                      onChange('_postbackParams', params);
                      const base = data._postbackBaseUrl || (data.postbackUri ? data.postbackUri.split('?')[0] : '');
                      const qs = params.filter((p: any) => p.theirParam && p.ourMacro).map((p: any) => `${p.theirParam}=${p.ourMacro}`).join('&');
                      onChange('postbackUri', qs ? `${base}?${qs}` : base);
                    }}
                    className="w-6 h-6 flex items-center justify-center rounded-full text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Remove parameter"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const params = [...(data._postbackParams || [{ theirParam: '', ourMacro: '{click_id}' }, { theirParam: '', ourMacro: '{username}' }, { theirParam: '', ourMacro: '{points}' }])];
                  params.push({ theirParam: '', ourMacro: '{payout}' });
                  onChange('_postbackParams', params);
                }}
                className="flex items-center gap-1 text-[11px] text-violet-600 hover:text-violet-800 font-medium mt-1"
              >
                <Plus className="h-3 w-3" /> Add Parameter
              </button>
            </div>

            {/* Generated URL Preview */}
            {data.postbackUri && (
              <div className="p-2.5 bg-white rounded-lg border border-violet-100">
                <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Generated Postback URL:</p>
                <code className="text-[11px] text-violet-700 break-all block font-mono">{data.postbackUri}</code>
              </div>
            )}

            {/* Expandable Reference Info */}
            <button
              type="button"
              onClick={() => onChange('_showParamHelp', !data._showParamHelp)}
              className="flex items-center gap-1 text-[11px] text-violet-500 hover:text-violet-700 mt-2"
            >
              <Info className="h-3 w-3" />
              {data._showParamHelp ? 'Hide detailed reference ▲' : 'Show detailed reference & how it works ▼'}
            </button>

            {data._showParamHelp && (
              <div className="mt-2 p-3 bg-white rounded-lg border border-violet-100 text-xs text-gray-600 space-y-2">
                <p className="font-medium text-violet-800">📋 How Postback Works:</p>
                <p>When a user completes an offer on your offerwall, our system sends a GET request to your Postback URL. We replace the macros (like <code className="bg-violet-100 px-1 rounded text-violet-700">{'{click_id}'}</code>) with actual conversion data.</p>
                <p className="font-medium text-violet-800 mt-2">Available Macros:</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { macro: '{click_id}', desc: 'Unique Click ID for this conversion' },
                    { macro: '{username}', desc: 'User who completed the offer' },
                    { macro: '{points}', desc: 'Calculated reward (in your currency)' },
                    { macro: '{payout}', desc: 'Payout amount in USD' },
                    { macro: '{offer_id}', desc: 'Offer identifier (e.g. ML-00123)' },
                    { macro: '{offer_name}', desc: 'Name of the completed offer' },
                    { macro: '{status}', desc: 'Always "approved" on conversion' },
                    { macro: '{user_ip}', desc: 'IP address of the user' },
                    { macro: '{sub_id1}', desc: 'Sub ID 1 — custom tracking tag' },
                    { macro: '{sub_id2}', desc: 'Sub ID 2 — custom tracking tag' },
                    { macro: '{sub_id3}', desc: 'Sub ID 3 — custom tracking tag' },
                  ].map((m, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-gray-50 rounded px-2 py-1">
                      <code className="text-violet-700 font-mono text-[11px]">{m.macro}</code>
                      <span className="text-gray-400 text-[10px]">{m.desc}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 p-2 bg-blue-50 rounded-md text-[10px] text-blue-700 leading-relaxed">
                  💡 <span className="font-semibold">Tip:</span> You can map any parameter name to any data value. For example, if your system expects <code className="bg-white px-1 rounded font-mono">subid</code>, you can map it to <code className="bg-white px-1 rounded font-mono">{'{username}'}</code>, <code className="bg-white px-1 rounded font-mono">{'{click_id}'}</code>, or any other value. Just type your parameter name on the left side and select the data you want on the right.
                </div>
                <p className="font-medium text-violet-800 mt-2">Example:</p>
                <code className="block bg-gray-50 p-2 rounded text-[11px] break-all">
                  https://yoursite.com/postback?uid={'{username}'}&reward={'{points}'}&txn={'{click_id}'}&status={'{status}'}
                </code>
                <p className="text-gray-400 text-[10px] mt-1">After conversion: https://yoursite.com/postback?uid=john_doe&reward=100&txn=abc123&status=approved</p>
              </div>
            )}
          </div>
        </div>

        {/* Advanced Settings Card */}
        <div className="bg-white rounded-lg p-3 border border-gray-100 hover:border-gray-200 transition-all duration-300">
          <div className="mb-3 pb-2 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                <BarChart className="h-3 w-3 text-white" />
              </div>
              Advanced Settings
            </h3>
          </div>
          <Textarea
            label="Description"
            placeholder="Provide a comprehensive overview of the app's traffic patterns, promotion strategies, and fraud prevention measures."
            value={data.description}
            onChange={(e) => onChange('description', e.target.value)}
          />

          <div className="mt-3 p-2.5 bg-gradient-to-br from-gray-50 to-white rounded-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-medium text-gray-700">Status</span>
                <StatusToggle
                  status={data.status || 'LIVE'}
                  onChange={onChange}
                  disabled={false}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Bell className="h-3.5 w-3.5 text-yellow-600" />
                <span className="text-xs text-gray-600">Postback alerts</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={data.postbackFailureNotification} onChange={(e) => onChange('postbackFailureNotification', e.target.checked)} className="sr-only peer" />
                  <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-violet-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600"></div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button 
            onClick={onSubmit} 
            disabled={loading}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg font-medium text-xs transition-all duration-300 ${
              loading 
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm hover:shadow-md'
            }`}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                {data.placementIdentifier ? <Edit className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                <span>{data.placementIdentifier ? 'Save' : 'Create'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="lg:col-span-1">
        {/* Current Status Sidebar */}
        <div className="bg-white rounded-lg p-3 border border-gray-100 hover:border-gray-200 transition-all duration-300 sticky top-4">
          <div className="mb-3 pb-2 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Activity className="h-3 w-3 text-white" />
              </div>
              Current Status
            </h3>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100 hover:border-gray-200 transition-colors">
              <div className="flex items-center space-x-2">
                <Shield className="h-3.5 w-3.5 text-gray-500" />
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Approval</span>
              </div>
              {data.approvalStatus === 'APPROVED' ? (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                </div>
              ) : data.approvalStatus === 'REJECTED' ? (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                  <XCircle className="h-4 w-4 text-red-500" />
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></div>
                  <Clock className="h-4 w-4 text-amber-500" />
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100 hover:border-gray-200 transition-colors">
              <div className="flex items-center space-x-2">
                <Activity className="h-3.5 w-3.5 text-gray-500" />
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Status</span>
              </div>
              {(data.status || 'DRAFT') === 'LIVE' ? (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-xs font-semibold text-emerald-600 px-2 py-0.5 bg-emerald-50 rounded-lg">Live</span>
                </div>
              ) : (data.status || 'DRAFT') === 'PAUSED' ? (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                  <span className="text-xs font-semibold text-amber-600 px-2 py-0.5 bg-amber-50 rounded-lg">Paused</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                  <span className="text-xs font-semibold text-gray-600 px-2 py-0.5 bg-gray-50 rounded-lg">Draft</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100 hover:border-gray-200 transition-colors">
              <div className="flex items-center space-x-2">
                <Layout className="h-3.5 w-3.5 text-gray-500" />
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Platform</span>
              </div>
              {data.platformType ? (
                <div className="flex items-center gap-1.5">
                  {data.platformType === 'Android' && (
                    <div className="px-2 py-0.5 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg flex items-center gap-1">
                      <Smartphone className="h-3 w-3 text-white" />
                      <span className="text-xs font-semibold text-white">Android</span>
                    </div>
                  )}
                  {data.platformType === 'iOS' && (
                    <div className="px-2 py-0.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center gap-1">
                      <Smartphone className="h-3 w-3 text-white" />
                      <span className="text-xs font-semibold text-white">iOS</span>
                    </div>
                  )}
                  {data.platformType === 'Website' && (
                    <div className="px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg flex items-center gap-1">
                      <Monitor className="h-3 w-3 text-white" />
                      <span className="text-xs font-semibold text-white">Website</span>
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-xs text-gray-400">—</span>
              )}
            </div>
            
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100 hover:border-gray-200 transition-colors">
              <div className="flex items-center space-x-2">
                <Clipboard className="h-3.5 w-3.5 text-gray-500" />
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">ID</span>
              </div>
              <div className="flex items-center gap-1.5">
                {data.placementIdentifier ? (
                  <>
                    <code className="text-xs font-mono text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                      {data.placementIdentifier.substring(0, 8)}...
                    </code>
                    <button 
                      onClick={() => navigator.clipboard.writeText(data.placementIdentifier)}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                      title="Copy ID"
                    >
                      <Copy className="h-3 w-3 text-gray-500" />
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-gray-400">Not generated</span>
                )}
              </div>
            </div>
            
            {!data.platformType && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500 text-center">Select a platform to continue</p>
              </div>
            )}
          </div>
        </div>
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
                                <td colSpan={8} className="px-6 py-10 text-center text-gray-500">
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
  
  const offerwallUrl = 'https://offerwall.moustacheleads.com';
  const iframeSnippet = `<iframe 
  src="${offerwallUrl}/offerwall?placement_id=${data.placementIdentifier || 'YOUR_PLACEMENT_ID'}&user_id={user_id}&api_key=${data.apiKey || 'YOUR_API_KEY'}"
  style="height:100vh;width:100%;border:0;"
  title="${data.offerwallTitle || 'Offerwall'}">
</iframe>`;

  const previewUrl = `${offerwallUrl}/offerwall?placement_id=${data.placementIdentifier || 'YOUR_PLACEMENT_ID'}&user_id=${testUserId}&api_key=${data.apiKey || 'YOUR_API_KEY'}`;

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
                {offerwallUrl}/offerwall?placement_id={data.placementIdentifier || 'YOUR_PLACEMENT_ID'}&user_id=test_user&api_key={data.apiKey || 'YOUR_API_KEY'}
              </code>
            </div>
            {isReady && (
              <button
                onClick={() => window.open(`${offerwallUrl}/offerwall?placement_id=${data.placementIdentifier}&user_id=test_user&api_key=${data.apiKey}`, '_blank')}
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

// 4. Testing Tab - Shows publisher's actual postback URL with editable test values per macro
const TestingPostback = ({ data, onChange, onSubmit, loading = false }) => {
  const [testValues, setTestValues] = useState({
    username: 'test_user_' + Math.floor(Math.random() * 9999),
    click_id: 'click_' + Math.floor(Math.random() * 999999),
    points: String(Math.floor(Math.random() * 500) + 10),
    payout: (Math.random() * 5 + 0.5).toFixed(2),
    offer_id: 'ML-TEST-' + Math.floor(Math.random() * 99999),
    offer_name: 'Test Survey Offer',
    status: 'approved',
    user_ip: '192.168.1.' + Math.floor(Math.random() * 255),
    user_id: 'test_user_' + Math.floor(Math.random() * 9999),
    affiliate_id: 'aff_test',
    transaction_id: 'txn_' + Math.floor(Math.random() * 999999),
  });
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  const postbackUrl = data.postbackUri || '';
  const hasUrl = !!postbackUrl.trim();

  // Detect which macros are used in the URL
  const usedMacros = useMemo(() => {
    const macros = [];
    const allMacros = [
      { key: 'username', label: 'Username / User ID', icon: '👤' },
      { key: 'user_id', label: 'User ID', icon: '👤' },
      { key: 'click_id', label: 'Click ID', icon: '🔗' },
      { key: 'points', label: 'Points / Reward', icon: '💰' },
      { key: 'payout', label: 'Payout (USD)', icon: '💵' },
      { key: 'offer_id', label: 'Offer ID', icon: '📋' },
      { key: 'offer_name', label: 'Offer Name', icon: '📝' },
      { key: 'status', label: 'Status', icon: '✅' },
      { key: 'user_ip', label: 'User IP', icon: '🌐' },
      { key: 'affiliate_id', label: 'Affiliate ID', icon: '🤝' },
      { key: 'transaction_id', label: 'Transaction ID', icon: '🔑' },
    ];
    for (const m of allMacros) {
      if (postbackUrl.includes(`{${m.key}}`)) {
        macros.push(m);
      }
    }
    // If no macros detected, show common ones so they can still test
    if (macros.length === 0 && hasUrl) {
      return allMacros.slice(0, 5);
    }
    return macros;
  }, [postbackUrl, hasUrl]);

  // Build the final URL with test values injected
  const finalUrl = useMemo(() => {
    let url = postbackUrl;
    for (const [key, value] of Object.entries(testValues)) {
      url = url.replace(new RegExp(`\\{${key}\\}`, 'g'), encodeURIComponent(value));
    }
    return url;
  }, [postbackUrl, testValues]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const startTime = Date.now();
      // Use backend proxy to hit the publisher's postback URL (avoids CORS)
      const { API_BASE_URL } = await import('../services/apiConfig');
      const token = localStorage.getItem('token');
      const proxyRes = await fetch(`${API_BASE_URL}/api/placements/test-postback-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ url: finalUrl }),
      });
      const elapsed = Date.now() - startTime;
      const proxyData = await proxyRes.json();
      
      if (proxyData.error) {
        setTestResult({
          success: false,
          statusCode: 0,
          responseTime: elapsed,
          message: proxyData.error,
          responseBody: '',
        });
      } else {
        setTestResult({
          success: proxyData.success,
          statusCode: proxyData.status_code || 0,
          responseTime: proxyData.response_time || elapsed,
          message: proxyData.message || (proxyData.success ? 'Postback received successfully!' : 'Failed to reach your server'),
          responseBody: proxyData.response_body || '',
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        statusCode: 0,
        responseTime: 0,
        message: `Error: ${err.message}. Make sure the backend server is running.`,
        responseBody: '',
      });
    } finally {
      setTesting(false);
    }
  };

  const randomize = () => {
    setTestValues({
      username: 'test_user_' + Math.floor(Math.random() * 9999),
      click_id: 'click_' + Math.floor(Math.random() * 999999),
      points: String(Math.floor(Math.random() * 500) + 10),
      payout: (Math.random() * 5 + 0.5).toFixed(2),
      offer_id: 'ML-TEST-' + Math.floor(Math.random() * 99999),
      offer_name: 'Test Survey Offer',
      status: 'approved',
      user_ip: '192.168.1.' + Math.floor(Math.random() * 255),
      user_id: 'test_user_' + Math.floor(Math.random() * 9999),
      affiliate_id: 'aff_test',
      transaction_id: 'txn_' + Math.floor(Math.random() * 999999),
    });
    setTestResult(null);
  };

  return (
    <Card title="🧪 Test Your Postback" description="We'll hit your postback URL with test data so you can verify it works." className="space-y-5">
      {!hasUrl ? (
        <div className="p-4 rounded-xl bg-yellow-50 border border-yellow-300 text-yellow-800">
          <Info className="h-4 w-4 inline mr-2" />
          <span className="font-medium">No Postback URL configured.</span> Go to the Details tab and add your Postback URL first.
        </div>
      ) : (
        <>
          {/* Your Postback URL */}
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Your Postback URL</p>
            <code className="text-xs text-gray-700 break-all block">{postbackUrl}</code>
          </div>

          {/* Editable test values per macro */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-gray-700">Test Values (edit to customize)</h4>
              <button type="button" onClick={randomize} className="text-[10px] bg-violet-100 hover:bg-violet-200 text-violet-700 px-2 py-1 rounded font-medium transition-colors">
                🎲 Randomize
              </button>
            </div>
            <div className="space-y-1.5">
              {usedMacros.map(m => (
                <div key={m.key} className="grid grid-cols-[140px_auto_1fr] gap-2 items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{m.icon}</span>
                    <code className="text-[11px] text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">{`{${m.key}}`}</code>
                  </div>
                  <span className="text-gray-300">→</span>
                  <input
                    type="text"
                    value={testValues[m.key] || ''}
                    onChange={e => setTestValues(prev => ({ ...prev, [m.key]: e.target.value }))}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:border-violet-400 focus:ring-1 focus:ring-violet-200 outline-none transition-colors font-mono"
                    placeholder={`Test value for ${m.key}`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Final URL Preview */}
          <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
            <p className="text-[10px] font-semibold text-indigo-600 uppercase mb-1">Final URL (will be hit)</p>
            <code className="text-[11px] text-indigo-800 break-all block">{finalUrl}</code>
          </div>

          {/* Test Result */}
          {testResult && (
            <div className={`p-3 rounded-lg border ${testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                {testResult.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className={`text-sm font-semibold ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
                  {testResult.success ? 'Success' : 'Failed'} — HTTP {testResult.statusCode}
                </span>
                <span className="text-xs text-gray-500 ml-auto">{testResult.responseTime}ms</span>
              </div>
              <p className="text-xs text-gray-600">{testResult.message}</p>
              {testResult.responseBody && (
                <pre className="mt-2 text-[10px] bg-white p-2 rounded border max-h-24 overflow-auto font-mono text-gray-600">{testResult.responseBody}</pre>
              )}
            </div>
          )}

          {/* Info */}
          <p className="text-xs p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-700">
            <Info className="h-3.5 w-3.5 inline mr-1" />
            When you click "Test Postback", we'll send a GET request to your URL with the test values above. Check your server to confirm it received the data. This does not affect live accounts.
          </p>

          {/* Test Button */}
          <button
            onClick={handleTest}
            disabled={testing}
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-sm transition-all duration-300 ${
              testing ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-lg shadow-violet-200'
            }`}
          >
            {testing ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Testing...</>
            ) : (
              <><Send className="h-4 w-4" /> Test Postback</>
            )}
          </button>
        </>
      )}
    </Card>
  );
};


// --- Main Component ---

export const Placements = () => {
  const { isAccountApproved, user, isAdminOrSubadmin } = useAuth();
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
        
        // Clear placement cache so the new placement is recognized
        clearPlacementCache();
        
        // Add to placements list and select it
        setPlacements(prev => [...prev, newPlacement]);
        setSelectedPlacementIndex(placements.length); // Select the new placement
        setIsNewPlacement(false);
        
        console.log(`Placement '${newPlacement.offerwallTitle}' created with ID: ${newPlacement.placementIdentifier}`);
        showToast(`Placement "${newPlacement.offerwallTitle}" created successfully!`, 'success');
      } else {
        // Update existing placement via API
        const updatedPlacement = await placementApi.updatePlacement(placementData.id, placementData);
        
        // Clear placement cache so the updated placement is recognized
        clearPlacementCache();
        
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
    // Show account pending message if account is not approved
    if (!isAccountApproved) {
      return (
        <Card title="Account Under Review" description="Your account is being reviewed by our team">
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
              <Clock className="h-8 w-8 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Account Pending Approval</h3>
            <p className="text-gray-500 text-center mb-4 max-w-md">
              Your account is currently under review. Once approved, you'll be able to create placements and start earning.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 max-w-md">
              <p className="text-sm text-amber-800">
                <strong>What happens next?</strong><br/>
                Our team will review your application and you'll receive an email once your account is approved. This usually takes 1-3 business days.
              </p>
            </div>
          </div>
        </Card>
      );
    }

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
        // Lock event management for non-admin users
        if (!isAdminOrSubadmin) {
          return (
            <Card title="Event Management" description="This feature is restricted.">
              <EmptyState
                icon={Calendar}
                title="Admin Access Required"
                description="Event management is only available to administrators. Contact your admin to manage events and multipliers."
                actionButton={null}
              />
            </Card>
          );
        }
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
  const TabButton = ({ tabKey, Icon, label, locked = false }) => {
    const isLocked = locked || (tabKey === 'events' && !isAdminOrSubadmin);
    const isDisabled = (isNewPlacement && tabKey !== 'placement') || isLocked;
    
    return (
      <button
        onClick={() => !isDisabled && setActiveTab(tabKey)}
        className={`flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded-md transition-all duration-200 text-xs font-medium ${
          activeTab === tabKey
            ? 'bg-white text-gray-900 shadow-sm'
            : isDisabled
              ? 'text-gray-400 cursor-not-allowed'
              : 'text-gray-600 hover:text-gray-900'
        }`}
        disabled={isDisabled}
        title={label}
      >
        <Icon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{label}</span>
        {isLocked && <Clock className="h-2.5 w-2.5 ml-0.5 text-amber-500" />}
      </button>
    );
  };
  
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

  // State for collapsible sections
  const [showPlacements, setShowPlacements] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <div className="max-w-[1400px] mx-auto px-6 py-4">
        {/* Compact Header */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Placements</h1>
            
            {/* Collapsible Placements Icon */}
            {placements.length > 0 && (
              <button
                onClick={() => setShowPlacements(!showPlacements)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:border-gray-300 transition-all text-sm"
                title="View placements"
              >
                <Layout className="h-4 w-4 text-gray-600" />
                <span className="text-gray-700 font-medium">{placements.length}</span>
              </button>
            )}
          </div>
          
          <button
            onClick={() => setIsNewPlacement(true)}
            className="inline-flex items-center px-3 py-1.5 rounded-lg font-medium text-sm transition-all duration-200 bg-blue-600 text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add New
          </button>
        </div>

        {/* Collapsible Placement Cards */}
        {showPlacements && placements.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-4 animate-in slide-in-from-top-2 duration-200">
            {loading ? (
              <div className="col-span-full flex justify-center py-2">
                <LoadingSpinner size="sm" text="Loading..." />
              </div>
            ) : (
              placements.map((placement, index) => {
                const isSelected = !isNewPlacement && selectedPlacementIndex === index;
                const platformColors = {
                  'Android': { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: 'text-emerald-600', activeBg: 'bg-emerald-600', activeBorder: 'border-emerald-700' },
                  'iOS': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: 'text-blue-600', activeBg: 'bg-blue-600', activeBorder: 'border-blue-700' },
                  'Website': { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', icon: 'text-purple-600', activeBg: 'bg-purple-600', activeBorder: 'border-purple-700' }
                };
                const colors = platformColors[placement.platformType] || platformColors['Website'];
                
                return (
                  <button 
                    key={placement.id || index}
                    onClick={() => {
                      setIsNewPlacement(false);
                      setSelectedPlacementIndex(index);
                      setShowPlacements(false);
                    }}
                    className={`p-2.5 rounded-lg transition-all duration-200 border text-center ${
                      isSelected
                        ? `${colors.activeBg} ${colors.activeBorder} text-white shadow-sm` 
                        : `${colors.bg} ${colors.border} ${colors.text} hover:shadow-sm hover:scale-[1.02]`
                    }`}
                  >
                    <div className={`flex items-center justify-center mb-1.5 ${isSelected ? 'text-white' : colors.icon}`}>
                      {placement.platformType === 'Android' ? <Smartphone className="h-4 w-4" /> :
                       placement.platformType === 'iOS' ? <Smartphone className="h-4 w-4" /> :
                       <Monitor className="h-4 w-4" />}
                    </div>
                    <p className="font-semibold text-[10px] truncate">{placement.platformName || placement.offerwallTitle}</p>
                  </button>
                );
              })
            )}
          </div>
        )}

        {error && !localStorage.getItem('token') && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center space-x-2 mb-4">
            <AlertCircle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-800">Login required to manage placements</p>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-1.5 bg-gray-100 p-1 rounded-lg mb-3">
          <TabButton tabKey="placement" Icon={Grid} label="Details" />
          <TabButton tabKey="events" Icon={Calendar} label="Events" />
          <TabButton tabKey="integration" Icon={Code} label="Integration" />
          <TabButton tabKey="testing" Icon={Play} label="Testing" />
        </div>

        {/* Tab Content */}
        <div className="pt-3">
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
