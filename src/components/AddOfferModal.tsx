import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { X, Plus, ImageIcon, CalendarIcon, Clock, Eye, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CreateOfferData, adminOfferApi } from '@/services/adminOfferApi';
import { useToast } from '@/hooks/use-toast';
import { partnerApi } from '@/services/partnerApi';
import { API_BASE_URL } from '../services/apiConfig';

interface AddOfferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOfferCreated?: () => void;
}

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
  { code: 'PE', name: 'Peru' },
  { code: 'IN', name: 'India' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'CN', name: 'China' },
  { code: 'SG', name: 'Singapore' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'TH', name: 'Thailand' },
  { code: 'PH', name: 'Philippines' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'EG', name: 'Egypt' },
  { code: 'MA', name: 'Morocco' },
  { code: 'KE', name: 'Kenya' },
  { code: 'GH', name: 'Ghana' },
  { code: 'TN', name: 'Tunisia' },
  { code: 'DZ', name: 'Algeria' },
  { code: 'AO', name: 'Angola' }
];

const LANGUAGES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi'];
const OS_OPTIONS = ['iOS', 'Android', 'Windows', 'Mac', 'Linux'];
const BROWSER_OPTIONS = ['Chrome', 'Safari', 'Firefox', 'Edge', 'Opera'];
const CARRIER_OPTIONS = ['Verizon', 'AT&T', 'T-Mobile', 'Sprint', 'Vodafone', 'Orange'];
const TIMEZONE_OPTIONS = ['UTC', 'EST', 'PST', 'GMT', 'CET', 'JST', 'IST'];

const NETWORKS = [
  'AdGate Media', 'SuperRewards', 'CPAlead', 'OfferToro', 'RevenueUniverse',
  'Wannads', 'Adscend Media', 'Persona.ly', 'Kiwi Wall', 'Offerdaddy'
];

const TRAFFIC_TYPES = [
  'Email', 'Search', 'Display', 'Push', 'Native', 'Incent', 'Non-Incent',
  'Social', 'Video', 'Mobile', 'Desktop', 'Contextual'
];

const DISALLOWED_TRAFFIC = ['Adult', 'Fraud', 'Brand Bidding', 'Spam', 'Incentivized'];

const NETWORK_PARTNERS = ['PepperAds', 'PepeLeads', 'MaxBounty', 'ClickDealer', 'CPAlead'];

// 10 Predefined Verticals (replaces category)
const VALID_VERTICALS = [
  'Finance', 'Gaming', 'Dating', 'Health', 'E-commerce',
  'Entertainment', 'Education', 'Travel', 'Utilities', 'Lifestyle'
];

// Schedule + Smart Rules constants
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const RULE_TYPES = ['Backup', 'Rotation', 'GEO', 'Time'];
const SCHEDULE_STATUS = ['Active', 'Paused'];

// Smart Rule interface
interface SmartRule {
  id: string;
  type: string;
  destinationUrl: string;
  geo: string[];
  splitPercentage: number;
  cap: number;
  priority: number;
  active: boolean;
}

// Helper function to get flag image URL
const getFlagUrl = (countryCode: string) => {
  return `https://flagcdn.com/24x18/${countryCode.toLowerCase()}.png`;
};

export const AddOfferModal: React.FC<AddOfferModalProps> = ({
  open,
  onOpenChange,
  onOfferCreated,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedAllowedCountries, setSelectedAllowedCountries] = useState<string[]>([]);  // NEW: For geo-restriction
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedOS, setSelectedOS] = useState<string[]>([]);
  const [selectedBrowsers, setSelectedBrowsers] = useState<string[]>([]);
  const [selectedCarriers, setSelectedCarriers] = useState<string[]>([]);
  const [selectedAllowedTraffic, setSelectedAllowedTraffic] = useState<string[]>([]);
  const [selectedDisallowedTraffic, setSelectedDisallowedTraffic] = useState<string[]>([]);
  const [capAlertEmails, setCapAlertEmails] = useState<string[]>([]);
  const [allowedTrafficSources, setAllowedTrafficSources] = useState<string[]>([]);
  const [blockedTrafficSources, setBlockedTrafficSources] = useState<string[]>([]);
  const [bannerCodes, setBannerCodes] = useState<string[]>([]);
  const [landingPageVariants, setLandingPageVariants] = useState<string[]>([]);
  const [newUser, setNewUser] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newTrafficSource, setNewTrafficSource] = useState('');
  const [newBannerCode, setNewBannerCode] = useState('');
  const [newLandingPage, setNewLandingPage] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [partners, setPartners] = useState<any[]>([]);

  // Schedule + Smart Rules state
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedWeekdays, setSelectedWeekdays] = useState<string[]>([]);
  const [scheduleStatus, setScheduleStatus] = useState('Active');
  const [smartRules, setSmartRules] = useState<SmartRule[]>([]);
  const [showJsonPreview, setShowJsonPreview] = useState(false);

  // Promo code state
  const [promoCodes, setPromoCodes] = useState<any[]>([]);
  const [selectedPromoCode, setSelectedPromoCode] = useState('');

  // Fetch partners and promo codes on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await partnerApi.getPartners('active');
        setPartners(data.partners);
      } catch (error) {
        console.error('Error fetching partners:', error);
      }

      // Fetch promo codes
      try {
        const response = await fetch(`${API_BASE_URL}/api/admin/promo-codes`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setPromoCodes(data.promo_codes || []);
        }
      } catch (error) {
        console.error('Error fetching promo codes:', error);
      }
    };
    if (open) {
      fetchData();
    }
  }, [open]);

  const [formData, setFormData] = useState<CreateOfferData>({
    campaign_id: '',
    name: '',
    description: '',
    status: 'pending',
    vertical: 'Lifestyle',  // NEW: Replaces category - one of 10 predefined values
    countries: [],
    allowed_countries: [],  // NEW: Geo-restriction - allowed country codes
    non_access_url: '',  // NEW: Fallback URL for geo-blocked users
    payout: 0,
    revenue_share_percent: 0,  // NEW: 0-100 percentage for revenue sharing
    incentive_type: 'Incent',  // NEW: Auto-calculated - 'Incent' or 'Non-Incent'
    network: '',
    partner_id: '',
    affiliates: 'all',
    selected_users: [],
    image_url: '',
    thumbnail_url: '',
    hash_code: '',
    limit: undefined,
    target_url: '',
    preview_url: '',
    device_targeting: 'all',
    // Creative fields
    creative_type: 'image',
    html_code: '',
    email_template: '',
    uploaded_file_name: '',
    uploaded_file_size: 0,
    // 🔥 APPROVAL WORKFLOW FIELDS - Initialize with defaults
    approval_type: 'auto_approve',
    auto_approve_delay: 0,
    require_approval: false,
    approval_message: '',
    max_inactive_days: 30
  });

  // Update image preview when image_url changes
  useEffect(() => {
    setImagePreview(formData.image_url || '');
  }, [formData.image_url]);

  const handleInputChange = (field: keyof CreateOfferData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addCountry = (countryCode: string) => {
    if (!selectedCountries.includes(countryCode)) {
      const updated = [...selectedCountries, countryCode];
      setSelectedCountries(updated);
      handleInputChange('countries', updated);
    }
  };

  const removeCountry = (countryCode: string) => {
    const updated = selectedCountries.filter(c => c !== countryCode);
    setSelectedCountries(updated);
    handleInputChange('countries', updated);
  };

  const addUser = () => {
    if (newUser && !selectedUsers.includes(newUser)) {
      const updated = [...selectedUsers, newUser];
      setSelectedUsers(updated);
      handleInputChange('selected_users', updated);
      setNewUser('');
    }
  };

  const removeUser = (user: string) => {
    const updated = selectedUsers.filter(u => u !== user);
    setSelectedUsers(updated);
    handleInputChange('selected_users', updated);
  };

  // Helper functions for multi-select management
  const toggleArrayItem = (array: string[], setArray: (arr: string[]) => void, item: string, field: keyof CreateOfferData) => {
    const updated = array.includes(item)
      ? array.filter(i => i !== item)
      : [...array, item];
    setArray(updated);
    handleInputChange(field, updated);
  };

  const addArrayItem = (array: string[], setArray: (arr: string[]) => void, item: string, field: keyof CreateOfferData, setNewItem: (item: string) => void) => {
    if (item && !array.includes(item)) {
      const updated = [...array, item];
      setArray(updated);
      handleInputChange(field, updated);
      setNewItem('');
    }
  };

  const removeArrayItem = (currentArray: string[], setArray: React.Dispatch<React.SetStateAction<string[]>>, item: string, field?: string) => {
    const updated = currentArray.filter(i => i !== item);
    setArray(updated);
    if (field && field in formData) {
      handleInputChange(field as keyof CreateOfferData, updated);
    }
  };

  const addSmartRule = () => {
    const newRule: SmartRule = {
      id: Date.now().toString(),
      type: 'Backup',
      destinationUrl: '',
      geo: [],
      splitPercentage: 0,
      cap: 0,
      priority: smartRules.length + 1,
      active: true
    };
    setSmartRules([...smartRules, newRule]);
  };

  const updateSmartRule = (id: string, field: keyof SmartRule, value: any) => {
    setSmartRules(rules => rules.map(rule =>
      rule.id === id ? { ...rule, [field]: value } : rule
    ));
  };

  const removeSmartRule = (id: string) => {
    setSmartRules(rules => rules.filter(rule => rule.id !== id));
  };

  const toggleWeekday = (day: string) => {
    setSelectedWeekdays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const generateScheduleJson = () => {
    return {
      schedule: {
        startDate: startDate ? format(startDate, 'yyyy-MM-dd') : null,
        endDate: endDate ? format(endDate, 'yyyy-MM-dd') : null,
        startTime,
        endTime,
        isRecurring,
        weekdays: selectedWeekdays,
        status: scheduleStatus
      },
      smartRules: smartRules.map(rule => ({
        type: rule.type,
        destinationUrl: rule.destinationUrl,
        geo: rule.geo,
        splitPercentage: rule.splitPercentage,
        cap: rule.cap,
        priority: rule.priority,
        active: rule.active
      }))
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const submitData: any = {
        ...formData,
        countries: selectedCountries,
        selected_users: formData.affiliates === 'selected' ? selectedUsers : [],
        payout: Number(formData.payout),
        limit: formData.limit ? Number(formData.limit) : undefined,
        // Compliance data
        allowed_traffic_types: selectedAllowedTraffic,
        disallowed_traffic_types: selectedDisallowedTraffic,
        // Other targeting data
        os_targeting: selectedOS,
        browser_targeting: selectedBrowsers,
        carrier_targeting: selectedCarriers,
        languages: selectedLanguages,
        // 🔥 APPROVAL WORKFLOW DATA: Include all approval settings
        approval_type: formData.approval_type || 'auto_approve',
        auto_approve_delay: formData.auto_approve_delay || 0,
        require_approval: formData.require_approval || false,
        approval_message: formData.approval_message || '',
        max_inactive_days: formData.max_inactive_days || 30,
        // 🔥 CRITICAL FIX: Include Schedule + Smart Rules data
        schedule: {
          startDate: startDate ? format(startDate, 'yyyy-MM-dd') : null,
          endDate: endDate ? format(endDate, 'yyyy-MM-dd') : null,
          startTime,
          endTime,
          isRecurring,
          weekdays: selectedWeekdays,
          status: scheduleStatus
        },
        smartRules: smartRules.map(rule => ({
          type: rule.type,
          destinationUrl: rule.destinationUrl,
          geo: rule.geo,
          splitPercentage: rule.splitPercentage,
          cap: rule.cap,
          priority: rule.priority,
          active: rule.active
        })),
        // 🔥 PROMO CODE ASSIGNMENT
        promo_code_id: selectedPromoCode || undefined
      };

      // Remove partner_id if it's empty
      if (!submitData.partner_id) {
        delete submitData.partner_id;
      }

      // 🔍 QA VERIFICATION: Debug logs
      console.log('🔍 Schedule Data Being Sent:', submitData.schedule);
      console.log('🔍 Smart Rules Data Being Sent:', submitData.smartRules);
      console.log('🔍 Compliance Data Being Sent:', {
        allowed_traffic_types: selectedAllowedTraffic,
        disallowed_traffic_types: selectedDisallowedTraffic,
        creative_approval_required: formData.creative_approval_required,
        affiliate_terms: formData.affiliate_terms,
        brand_guidelines: formData.brand_guidelines,
        terms_notes: formData.terms_notes
      });

      await adminOfferApi.createOffer(submitData);

      toast({
        title: "Success",
        description: "Offer created successfully!",
      });

      // Reset form
      setFormData({
        campaign_id: '',
        name: '',
        description: '',
        status: 'pending',
        countries: [],
        payout: 0,
        network: '',
        affiliates: 'all',
        selected_users: [],
        image_url: '',
        thumbnail_url: '',
        hash_code: '',
        limit: undefined,
        target_url: '',
        preview_url: '',
        device_targeting: 'all',
        // Creative fields
        creative_type: 'image',
        html_code: '',
        email_template: '',
        uploaded_file_name: '',
        uploaded_file_size: 0,
        // 🔥 APPROVAL WORKFLOW FIELDS - Reset to defaults
        approval_type: 'auto_approve',
        auto_approve_delay: 0,
        require_approval: false,
        approval_message: '',
        max_inactive_days: 30
      });
      setSelectedCountries([]);
      setSelectedUsers([]);
      setSelectedLanguages([]);
      setSelectedOS([]);
      setSelectedBrowsers([]);
      setSelectedCarriers([]);
      setSelectedAllowedTraffic([]);
      setSelectedDisallowedTraffic([]);
      // Reset schedule and smart rules
      setStartDate(undefined);
      setEndDate(undefined);
      setStartTime('');
      setEndTime('');
      setIsRecurring(false);
      setSelectedWeekdays([]);
      setScheduleStatus('Active');
      setSmartRules([]);
      setShowJsonPreview(false);

      onOpenChange(false);
      onOfferCreated?.();

    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create offer",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Offer</DialogTitle>
          <DialogDescription>
            Create a comprehensive offer with all required details
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs defaultValue="identification" className="w-full">
            <TabsList className="grid w-full grid-cols-10 text-xs">
              <TabsTrigger value="identification">ID</TabsTrigger>
              <TabsTrigger value="targeting">Target</TabsTrigger>
              <TabsTrigger value="payout">Payout</TabsTrigger>
              <TabsTrigger value="tracking">Track</TabsTrigger>
              <TabsTrigger value="access">Access</TabsTrigger>
              <TabsTrigger value="creatives">Creative</TabsTrigger>
              <TabsTrigger value="schedule-rules">Schedule + Rules</TabsTrigger>
              <TabsTrigger value="compliance">Comply</TabsTrigger>

              <TabsTrigger value="reporting">Report</TabsTrigger>
            </TabsList>

            {/* SECTION 1: OFFER IDENTIFICATION */}
            <TabsContent value="identification" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Offer Identification</CardTitle>
                  <CardDescription>Basic offer details and identification</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="offer_id">Offer ID (from upward partner) *</Label>
                      <Input
                        id="offer_id"
                        value={formData.campaign_id}
                        onChange={(e) => handleInputChange('campaign_id', e.target.value)}
                        placeholder="VBFS6"
                        required
                      />
                      <p className="text-sm text-gray-500 mt-1">Enter the survey_id/offer_id from upward partner</p>
                    </div>
                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="paused">Paused</SelectItem>
                          <SelectItem value="hidden">Hidden</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="name">Offer Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="Premium Survey Offer"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description || ''}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Detailed offer description"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="vertical">Vertical</Label>
                      <Select value={formData.vertical || 'Lifestyle'} onValueChange={(value) => handleInputChange('vertical', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select vertical" />
                        </SelectTrigger>
                        <SelectContent>
                          {VALID_VERTICALS.map(vertical => (
                            <SelectItem key={vertical} value={vertical}>{vertical}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="offer_type">Offer Type</Label>
                      <Select value={formData.offer_type || ''} onValueChange={(value) => handleInputChange('offer_type', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CPA">CPA</SelectItem>
                          <SelectItem value="CPL">CPL</SelectItem>
                          <SelectItem value="CPS">CPS</SelectItem>
                          <SelectItem value="CPI">CPI</SelectItem>
                          <SelectItem value="CPC">CPC</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SECTION 2: TARGETING RULES */}
            <TabsContent value="targeting" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Targeting Rules</CardTitle>
                  <CardDescription>Define who can see this offer</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Countries *</Label>
                    <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-gray-50 max-h-32 overflow-y-auto">
                      {COUNTRIES.map(country => (
                        <Badge
                          key={country.code}
                          variant={selectedCountries.includes(country.code) ? "default" : "outline"}
                          className="cursor-pointer hover:bg-blue-100 flex items-center gap-2 px-2 py-1"
                          onClick={() => selectedCountries.includes(country.code) ? removeCountry(country.code) : addCountry(country.code)}
                          title={country.name}
                        >
                          <img
                            src={getFlagUrl(country.code)}
                            alt={`${country.name} flag`}
                            className="w-6 h-4 object-cover rounded-sm"
                            onError={(e) => {
                              // Fallback to text if image fails to load
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <span className="font-medium">{country.code}</span>
                        </Badge>
                      ))}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Selected: {selectedCountries.length} countries
                    </p>
                  </div>

                  {/* NEW: Allowed Countries for Geo-Restriction */}
                  <div>
                    <Label>Allowed Countries (Geo-Restriction)</Label>
                    <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-gray-50 max-h-32 overflow-y-auto">
                      {COUNTRIES.map(country => (
                        <Badge
                          key={`allowed-${country.code}`}
                          variant={selectedAllowedCountries.includes(country.code) ? "default" : "outline"}
                          className="cursor-pointer hover:bg-green-100 flex items-center gap-2 px-2 py-1"
                          onClick={() => {
                            const updated = selectedAllowedCountries.includes(country.code)
                              ? selectedAllowedCountries.filter(c => c !== country.code)
                              : [...selectedAllowedCountries, country.code];
                            setSelectedAllowedCountries(updated);
                            handleInputChange('allowed_countries', updated);
                          }}
                          title={country.name}
                        >
                          <img
                            src={getFlagUrl(country.code)}
                            alt={`${country.name} flag`}
                            className="w-6 h-4 object-cover rounded-sm"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <span className="font-medium">{country.code}</span>
                        </Badge>
                      ))}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {selectedAllowedCountries.length === 0 
                        ? 'No restriction - all countries allowed' 
                        : `Only ${selectedAllowedCountries.length} countries can access this offer`}
                    </p>
                  </div>

                  {/* Languages Selection */}
                  <div>
                    <Label>Languages</Label>
                    <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-gray-50 max-h-32 overflow-y-auto">
                      {LANGUAGES.map(language => (
                        <Badge
                          key={language}
                          variant={selectedLanguages.includes(language) ? "default" : "outline"}
                          className="cursor-pointer hover:bg-blue-100"
                          onClick={() => toggleArrayItem(selectedLanguages, setSelectedLanguages, language, 'languages')}
                        >
                          {language.toUpperCase()}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Selected: {selectedLanguages.length} languages
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="device_targeting">Device Targeting *</Label>
                      <Select value={formData.device_targeting} onValueChange={(value) => handleInputChange('device_targeting', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Devices</SelectItem>
                          <SelectItem value="mobile">Mobile Only</SelectItem>
                          <SelectItem value="desktop">Desktop Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="connection_type">Connection Type</Label>
                      <Select value={formData.connection_type || ''} onValueChange={(value) => handleInputChange('connection_type', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Any connection" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Connections</SelectItem>
                          <SelectItem value="wifi">WiFi Only</SelectItem>
                          <SelectItem value="mobile">Mobile Data Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* OS Targeting */}
                  <div>
                    <Label>OS Targeting</Label>
                    <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-gray-50">
                      {OS_OPTIONS.map(os => (
                        <Badge
                          key={os}
                          variant={selectedOS.includes(os) ? "default" : "outline"}
                          className="cursor-pointer hover:bg-blue-100"
                          onClick={() => toggleArrayItem(selectedOS, setSelectedOS, os, 'os_targeting')}
                        >
                          {os}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Browser Targeting */}
                  <div>
                    <Label>Browser Targeting</Label>
                    <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-gray-50">
                      {BROWSER_OPTIONS.map(browser => (
                        <Badge
                          key={browser}
                          variant={selectedBrowsers.includes(browser) ? "default" : "outline"}
                          className="cursor-pointer hover:bg-blue-100"
                          onClick={() => toggleArrayItem(selectedBrowsers, setSelectedBrowsers, browser, 'browser_targeting')}
                        >
                          {browser}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Carrier Targeting */}
                    <div>
                      <Label>Carrier Targeting</Label>
                      <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-gray-50 max-h-24 overflow-y-auto">
                        {CARRIER_OPTIONS.map(carrier => (
                          <Badge
                            key={carrier}
                            variant={selectedCarriers.includes(carrier) ? "default" : "outline"}
                            className="cursor-pointer hover:bg-blue-100 text-xs"
                            onClick={() => toggleArrayItem(selectedCarriers, setSelectedCarriers, carrier, 'carrier_targeting')}
                          >
                            {carrier}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Timezone */}
                    <div>
                      <Label htmlFor="timezone">Timezone</Label>
                      <Select value={formData.timezone || 'UTC'} onValueChange={(value) => handleInputChange('timezone', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIMEZONE_OPTIONS.map(tz => (
                            <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SECTION 3: PAYOUT & FINANCE */}
            <TabsContent value="payout" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Payout & Finance</CardTitle>
                  <CardDescription>Configure payout and financial settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="payout">Payout Amount *</Label>
                      <Input
                        id="payout"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.payout}
                        onChange={(e) => {
                          const payout = parseFloat(e.target.value) || 0;
                          handleInputChange('payout', payout);
                          // Auto-calculate incentive type
                          const revenueShare = formData.revenue_share_percent || 0;
                          handleInputChange('incentive_type', revenueShare > 0 ? 'Non-Incent' : 'Incent');
                        }}
                        placeholder="5.00"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="currency">Currency</Label>
                      <Select value={formData.currency || 'USD'} onValueChange={(value) => handleInputChange('currency', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="GBP">GBP</SelectItem>
                          <SelectItem value="CAD">CAD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="payout_type">Payout Type</Label>
                      <Select value={formData.payout_type || 'fixed'} onValueChange={(value) => handleInputChange('payout_type', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">Fixed</SelectItem>
                          <SelectItem value="tiered">Tiered</SelectItem>
                          <SelectItem value="percentage">Percentage</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* NEW: Revenue Share and Incentive Type */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="revenue_share_percent">Revenue Share %</Label>
                      <Input
                        id="revenue_share_percent"
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={formData.revenue_share_percent || 0}
                        onChange={(e) => {
                          const percent = parseFloat(e.target.value) || 0;
                          handleInputChange('revenue_share_percent', percent);
                          // Auto-calculate incentive type
                          handleInputChange('incentive_type', percent > 0 ? 'Non-Incent' : 'Incent');
                        }}
                        placeholder="0"
                      />
                      <p className="text-sm text-gray-500 mt-1">% of upward payout to forward</p>
                    </div>
                    <div>
                      <Label htmlFor="incentive_type">Incentive Type</Label>
                      <Input
                        id="incentive_type"
                        value={formData.incentive_type || 'Incent'}
                        disabled
                        className="bg-gray-100"
                      />
                      <p className="text-sm text-gray-500 mt-1">Auto-calculated</p>
                    </div>
                    <div>
                      <Label htmlFor="non_access_url">Non-Access URL</Label>
                      <Input
                        id="non_access_url"
                        value={formData.non_access_url || ''}
                        onChange={(e) => handleInputChange('non_access_url', e.target.value)}
                        placeholder="https://example.com/fallback"
                      />
                      <p className="text-sm text-gray-500 mt-1">Redirect for geo-blocked users</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="revenue">Revenue (Optional)</Label>
                      <Input
                        id="revenue"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.revenue || ''}
                        onChange={(e) => handleInputChange('revenue', e.target.value ? parseFloat(e.target.value) : undefined)}
                        placeholder="7.50"
                      />
                      <p className="text-sm text-gray-500 mt-1">Network earnings per conversion</p>
                    </div>
                    <div className="flex items-center space-x-2 mt-6">
                      <Switch
                        id="auto_pause_on_cap"
                        checked={formData.auto_pause_on_cap || false}
                        onCheckedChange={(checked) => handleInputChange('auto_pause_on_cap', checked)}
                      />
                      <Label htmlFor="auto_pause_on_cap">Auto-pause when cap reached</Label>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="daily_cap">Daily Cap</Label>
                      <Input
                        id="daily_cap"
                        type="number"
                        min="0"
                        value={formData.daily_cap || ''}
                        onChange={(e) => handleInputChange('daily_cap', e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="100"
                      />
                    </div>
                    <div>
                      <Label htmlFor="weekly_cap">Weekly Cap</Label>
                      <Input
                        id="weekly_cap"
                        type="number"
                        min="0"
                        value={formData.weekly_cap || ''}
                        onChange={(e) => handleInputChange('weekly_cap', e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="500"
                      />
                    </div>
                    <div>
                      <Label htmlFor="monthly_cap">Monthly Cap</Label>
                      <Input
                        id="monthly_cap"
                        type="number"
                        min="0"
                        value={formData.monthly_cap || ''}
                        onChange={(e) => handleInputChange('monthly_cap', e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="2000"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SECTION 4: TRACKING SETUP */}
            <TabsContent value="tracking" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Tracking Setup</CardTitle>
                  <CardDescription>Basic tracking configuration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="partner_id">Partner (Upward Partner Source) *</Label>
                    <Select value={formData.partner_id || 'none'} onValueChange={(value) => handleInputChange('partner_id', value === 'none' ? '' : value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select upward partner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {partners.map(partner => (
                          <SelectItem key={partner.partner_id} value={partner.partner_id}>
                            {partner.partner_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-gray-500 mt-1">Select the upstream partner providing this offer</p>
                  </div>

                  <div>
                    <Label htmlFor="network">Network *</Label>
                    <Input
                      id="network"
                      value={formData.network}
                      onChange={(e) => handleInputChange('network', e.target.value)}
                      placeholder="e.g., Direct, CPA Network"
                      required
                    />
                    <p className="text-sm text-gray-500 mt-1">Network or source label (required by system)</p>
                  </div>

                  <div>
                    <Label htmlFor="target_url">Target URL (Offer Link) *</Label>
                    <Input
                      id="target_url"
                      type="url"
                      value={formData.target_url}
                      onChange={(e) => handleInputChange('target_url', e.target.value)}
                      placeholder="https://example.com/offer-landing"
                      required
                    />
                    <p className="text-sm text-gray-500 mt-1">The actual offer landing page URL</p>
                  </div>

                  <div>
                    <Label htmlFor="expiry_date">Expiry Date (Optional)</Label>
                    <Input
                      id="expiry_date"
                      type="date"
                      value={formData.expiry_date || ''}
                      onChange={(e) => handleInputChange('expiry_date', e.target.value)}
                    />
                    <p className="text-sm text-gray-500 mt-1">When this offer should stop being available</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SECTION 5: ACCESS & AFFILIATES */}
            <TabsContent value="access" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Access & Affiliates</CardTitle>
                  <CardDescription>Control who can access this offer</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="affiliates">Affiliate Access *</Label>
                    <Select value={formData.affiliates} onValueChange={(value) => handleInputChange('affiliates', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Affiliates</SelectItem>
                        <SelectItem value="selected">Selected Affiliates</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.affiliates === 'selected' && (
                    <div>
                      <Label>Selected Users</Label>
                      <div className="flex gap-2 mb-2">
                        <Input
                          value={newUser}
                          onChange={(e) => setNewUser(e.target.value)}
                          placeholder="Enter username"
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addUser())}
                        />
                        <Button type="button" onClick={addUser} size="sm">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedUsers.map(user => (
                          <Badge key={user} variant="secondary" className="flex items-center gap-1">
                            {user}
                            <X
                              className="h-3 w-3 cursor-pointer"
                              onClick={() => removeUser(user)}
                            />
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Approval Workflow Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Approval Workflow</CardTitle>
                  <CardDescription>Configure how publishers get access to this offer</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="approval_type">Approval Type *</Label>
                    <Select
                      value={formData.approval_type || 'auto_approve'}
                      onValueChange={(value) => handleInputChange('approval_type', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto_approve">Auto Approve (Immediate)</SelectItem>
                        <SelectItem value="time_based">Time-based Approval</SelectItem>
                        <SelectItem value="manual">Manual Approval</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">
                      Choose how publisher access requests are handled
                    </p>
                  </div>

                  {formData.approval_type === 'time_based' && (
                    <div>
                      <Label htmlFor="auto_approve_delay">Auto-approve Delay (minutes)</Label>
                      <Input
                        id="auto_approve_delay"
                        type="number"
                        min="1"
                        max="10080"
                        value={formData.auto_approve_delay || 60}
                        onChange={(e) => handleInputChange('auto_approve_delay', parseInt(e.target.value))}
                        placeholder="60"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Requests will be auto-approved after this delay (1-10080 minutes)
                      </p>
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="require_approval"
                      checked={formData.require_approval || false}
                      onCheckedChange={(checked) => handleInputChange('require_approval', checked)}
                    />
                    <Label htmlFor="require_approval">Always require approval</Label>
                  </div>
                  <p className="text-xs text-gray-500">
                    Override auto-approval and always require manual approval
                  </p>

                  <div>
                    <Label htmlFor="approval_message">Custom Approval Message</Label>
                    <Textarea
                      id="approval_message"
                      value={formData.approval_message || ''}
                      onChange={(e) => handleInputChange('approval_message', e.target.value)}
                      placeholder="Enter a custom message for publishers requesting access..."
                      rows={3}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This message will be shown to publishers when they request access
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="max_inactive_days">Auto-lock after inactive days</Label>
                    <Input
                      id="max_inactive_days"
                      type="number"
                      min="1"
                      max="365"
                      value={formData.max_inactive_days || 30}
                      onChange={(e) => handleInputChange('max_inactive_days', parseInt(e.target.value))}
                      placeholder="30"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Automatically lock offer access if not used for this many days (1-365)
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* PROMO CODE ASSIGNMENT */}
              <Card>
                <CardHeader>
                  <CardTitle>🎉 Assign Promo Code</CardTitle>
                  <CardDescription>Optionally assign a promo code to this offer</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="promo_code">Promo Code (Optional)</Label>
                    <Select value={selectedPromoCode || "none"} onValueChange={(value) => setSelectedPromoCode(value === "none" ? "" : value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a promo code..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {promoCodes.map((code: any) => (
                          <SelectItem key={code._id} value={code._id}>
                            {code.code} - {code.bonus_amount}% Bonus
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">
                      Publishers will receive an email notification when you assign a code to this offer
                    </p>
                  </div>

                  {selectedPromoCode && promoCodes.find((c: any) => c._id === selectedPromoCode) && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm font-medium text-blue-900">
                        ✅ Promo Code Selected
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        Code: <span className="font-mono font-bold">{promoCodes.find((c: any) => c._id === selectedPromoCode)?.code}</span>
                      </p>
                      <p className="text-xs text-blue-700">
                        Bonus: {promoCodes.find((c: any) => c._id === selectedPromoCode)?.bonus_amount}% ({promoCodes.find((c: any) => c._id === selectedPromoCode)?.bonus_type})
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* SECTION 6: CREATIVES & VISUALS */}
            <TabsContent value="creatives" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Creatives & Visuals</CardTitle>
                  <CardDescription>Add images and creative assets</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Creative Type Selector */}
                  <div>
                    <Label htmlFor="creative_type">Creative Type</Label>
                    <Select value={formData.creative_type || 'image'} onValueChange={(value) => handleInputChange('creative_type', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select creative type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="image">Image URL</SelectItem>
                        <SelectItem value="html">HTML Code</SelectItem>
                        <SelectItem value="email">Email Creative</SelectItem>
                        <SelectItem value="upload">File Upload</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">
                      Choose how you want to display this offer to users
                    </p>
                  </div>

                  {/* Creative Content Input */}
                  {(formData.creative_type === 'image' || !formData.creative_type) && (
                    <div>
                      <Label htmlFor="image_url">Image URL</Label>
                      <Input
                        id="image_url"
                        type="url"
                        value={formData.image_url || ''}
                        onChange={(e) => handleInputChange('image_url', e.target.value)}
                        placeholder="https://example.com/image.jpg"
                      />
                    </div>
                  )}

                  {formData.creative_type === 'html' && (
                    <div>
                      <Label htmlFor="html_code">HTML Banner Code</Label>
                      <Textarea
                        id="html_code"
                        value={formData.html_code || ''}
                        onChange={(e) => handleInputChange('html_code', e.target.value)}
                        placeholder="<div style='background: linear-gradient(45deg, #ff6b6b, #4ecdc4); color: white; padding: 20px; text-align: center; border-radius: 8px;'><h2>🎯 Special Offer!</h2><p>Get 50% OFF Today Only!</p><button style='background: white; color: #333; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;'>Claim Now</button></div>"
                        rows={6}
                        className="font-mono text-sm"
                      />
                      <div className="flex gap-2 mt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => navigator.clipboard.writeText(formData.html_code || '')}
                        >
                          Copy HTML
                        </Button>
                      </div>
                    </div>
                  )}

                  {formData.creative_type === 'email' && (
                    <div>
                      <Label htmlFor="email_template">Email HTML Banner Code</Label>
                      <Textarea
                        id="email_template"
                        value={formData.email_template || ''}
                        onChange={(e) => handleInputChange('email_template', e.target.value)}
                        placeholder="<div style='background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px; font-family: Arial, sans-serif;'><h1 style='margin: 0 0 15px 0; font-size: 28px;'>🚀 Exclusive Offer!</h1><p style='margin: 0 0 20px 0; font-size: 18px;'>Limited Time: Get {offer_name} for just ${payout}!</p><a href='{tracking_link}' style='background: #fff; color: #667eea; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;'>Claim Your Offer Now!</a><p style='margin: 20px 0 0 0; font-size: 12px; opacity: 0.8;'>This offer expires soon. Don't miss out!</p></div>"
                        rows={8}
                        className="font-mono text-sm"
                      />
                      <div className="flex gap-2 mt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => navigator.clipboard.writeText(formData.email_template || '')}
                        >
                          Copy HTML
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Paste HTML email banner code. Use variables: {`{offer_name}, {payout}, {tracking_link}`}
                      </p>
                    </div>
                  )}

                  {formData.creative_type === 'upload' && (
                    <div>
                      <Label htmlFor="file_upload">Upload Banner File</Label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50">
                        <input
                          type="file"
                          id="file_upload"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                // Check file size (10MB limit)
                                if (file.size > 10 * 1024 * 1024) {
                                  toast({
                                    title: "Error",
                                    description: "File size must be less than 10MB",
                                    variant: "destructive",
                                  });
                                  return;
                                }

                                // Check if it's an image
                                if (!file.type.startsWith('image/')) {
                                  toast({
                                    title: "Error",
                                    description: "Please select an image file (PNG, JPG, GIF)",
                                    variant: "destructive",
                                  });
                                  return;
                                }

                                // Create preview URL
                                const previewUrl = URL.createObjectURL(file);
                                handleInputChange('image_url', previewUrl);
                                // Store file info
                                handleInputChange('uploaded_file_name', file.name);
                                handleInputChange('uploaded_file_size', file.size);

                                toast({
                                  title: "Success",
                                  description: `Image "${file.name}" uploaded successfully!`,
                                });
                              } catch (error) {
                                console.error('File upload error:', error);
                                toast({
                                  title: "Error",
                                  description: "Failed to process file. Please try again.",
                                  variant: "destructive",
                                });
                              }
                            }
                          }}
                          className="hidden"
                        />
                        <label htmlFor="file_upload" className="cursor-pointer">
                          <div className="flex flex-col items-center">
                            <ImageIcon className="h-12 w-12 text-gray-400 mb-4" />
                            <p className="text-sm font-medium text-gray-700 mb-2">
                              Click to upload banner image
                            </p>
                            <p className="text-xs text-gray-500">
                              PNG, JPG, GIF up to 10MB
                            </p>
                          </div>
                        </label>
                      </div>
                      {formData.uploaded_file_name && (
                        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                          <p className="text-sm text-green-700">
                            ✓ Uploaded: {formData.uploaded_file_name}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Offer Picture Preview */}
                  <div>
                    <Label>Offer Picture Preview</Label>
                    <div className="border rounded-lg p-4 bg-gray-50">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        This is how your offer will appear to users:
                      </p>
                      <div className="bg-white p-4 rounded border shadow-sm max-w-md">
                        {(formData.creative_type === 'image' || formData.creative_type === 'upload' || !formData.creative_type) ? (
                          imagePreview ? (
                            <img
                              src={imagePreview}
                              alt="Offer display"
                              className="w-full h-40 object-cover rounded mb-2"
                              onError={() => setImagePreview('')}
                            />
                          ) : (
                            <div className="w-full h-40 bg-gray-200 rounded mb-2 flex items-center justify-center">
                              <ImageIcon className="h-8 w-8 text-gray-400" />
                            </div>
                          )
                        ) : formData.creative_type === 'html' && formData.html_code ? (
                          <div
                            dangerouslySetInnerHTML={{ __html: formData.html_code }}
                            className="max-w-full overflow-hidden mb-2"
                          />
                        ) : formData.creative_type === 'email' && formData.email_template ? (
                          <div
                            dangerouslySetInnerHTML={{ __html: formData.email_template.replace('{offer_name}', formData.name || 'Sample Offer').replace('{payout}', formData.payout?.toString() || '0.00').replace('{tracking_link}', '#') }}
                            className="max-w-full overflow-hidden mb-2"
                          />
                        ) : (
                          <div className="w-full h-40 bg-gray-200 rounded mb-2 flex items-center justify-center">
                            <p className="text-gray-500">No creative content</p>
                          </div>
                        )}

                        <h3 className="font-bold text-lg">{formData.name || 'Offer Name'}</h3>
                        <p className="text-sm text-gray-600 mb-2">
                          {formData.description || 'Offer description will appear here...'}
                        </p>
                        <div className="flex justify-between items-center">
                          <span className="text-green-600 font-bold">${formData.payout || '0.00'}</span>
                          <button className="bg-blue-500 text-white px-4 py-2 rounded text-sm">
                            Get Offer
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Landing Page Variants */}
                  <div>
                    <Label>Landing Page Variants</Label>
                    <div className="flex gap-2 mb-2">
                      <Input
                        value={newLandingPage}
                        onChange={(e) => setNewLandingPage(e.target.value)}
                        placeholder="Enter landing page URL"
                        type="url"
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addArrayItem(landingPageVariants, setLandingPageVariants, newLandingPage, 'landing_page_variants', setNewLandingPage))}
                      />
                      <Button
                        type="button"
                        onClick={() => addArrayItem(landingPageVariants, setLandingPageVariants, newLandingPage, 'landing_page_variants', setNewLandingPage)}
                        size="sm"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {landingPageVariants.map(url => (
                        <Badge key={url} variant="secondary" className="flex items-center gap-1 max-w-xs">
                          <span className="truncate">{url}</span>
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() => removeArrayItem(landingPageVariants, setLandingPageVariants, url, 'landing_page_variants')}
                          />
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>


            {/* SECTION 7: SCHEDULE + SMART RULES */}
            <TabsContent value="schedule-rules" className="space-y-4">
              {/* Schedule Offer Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Schedule Offer
                  </CardTitle>
                  <CardDescription>Configure offer timing and scheduling</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Start Date & Time */}
                    <div className="space-y-2">
                      <Label>Start Date & Time</Label>
                      <div className="flex gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "flex-1 justify-start text-left font-normal",
                                !startDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {startDate ? format(startDate, "PPP") : <span>Pick start date</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={startDate}
                              onSelect={setStartDate}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <Input
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="w-32"
                        />
                      </div>
                    </div>

                    {/* End Date & Time */}
                    <div className="space-y-2">
                      <Label>End Date & Time</Label>
                      <div className="flex gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "flex-1 justify-start text-left font-normal",
                                !endDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {endDate ? format(endDate, "PPP") : <span>Pick end date</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={endDate}
                              onSelect={setEndDate}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <Input
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="w-32"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Recurring & Status */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="recurring"
                          checked={isRecurring}
                          onCheckedChange={setIsRecurring}
                        />
                        <Label htmlFor="recurring">Recurring Schedule</Label>
                      </div>

                      {isRecurring && (
                        <div>
                          <Label className="text-sm">Select Weekdays</Label>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {WEEKDAYS.map(day => (
                              <Badge
                                key={day}
                                variant={selectedWeekdays.includes(day) ? "default" : "outline"}
                                className="cursor-pointer hover:bg-blue-100"
                                onClick={() => toggleWeekday(day)}
                              >
                                {day.slice(0, 3)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Schedule Status</Label>
                      <Select value={scheduleStatus} onValueChange={setScheduleStatus}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SCHEDULE_STATUS.map(status => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Smart Rules Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-5 w-5" />
                      Smart Rules
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowJsonPreview(!showJsonPreview)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Preview JSON
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addSmartRule}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Rule
                      </Button>
                    </div>
                  </CardTitle>
                  <CardDescription>Configure advanced routing and automation rules</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* JSON Preview */}
                  {showJsonPreview && (
                    <div className="p-4 bg-gray-50 border rounded-lg">
                      <Label className="text-sm font-medium">Configuration Preview</Label>
                      <pre className="mt-2 text-xs overflow-auto max-h-48 bg-white p-3 rounded border">
                        {JSON.stringify(generateScheduleJson(), null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Smart Rules List */}
                  {smartRules.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No smart rules configured</p>
                      <p className="text-sm">Click "Add Rule" to create your first rule</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {smartRules.map((rule, index) => (
                        <div key={rule.id} className="p-4 border rounded-lg bg-gray-50">
                          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                            {/* Rule Type */}
                            <div>
                              <Label className="text-xs">Type</Label>
                              <Select
                                value={rule.type}
                                onValueChange={(value) => updateSmartRule(rule.id, 'type', value)}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {RULE_TYPES.map(type => (
                                    <SelectItem key={type} value={type}>
                                      {type}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Destination URL */}
                            <div className="md:col-span-2">
                              <Label className="text-xs">Destination URL</Label>
                              <Input
                                value={rule.destinationUrl}
                                onChange={(e) => updateSmartRule(rule.id, 'destinationUrl', e.target.value)}
                                placeholder="https://example.com"
                                className="h-8"
                              />
                            </div>

                            {/* Split % */}
                            <div>
                              <Label className="text-xs">Split %</Label>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={rule.splitPercentage}
                                onChange={(e) => updateSmartRule(rule.id, 'splitPercentage', Number(e.target.value))}
                                className="h-8"
                              />
                            </div>

                            {/* Cap */}
                            <div>
                              <Label className="text-xs">Cap</Label>
                              <Input
                                type="number"
                                min="0"
                                value={rule.cap}
                                onChange={(e) => updateSmartRule(rule.id, 'cap', Number(e.target.value))}
                                className="h-8"
                              />
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1">
                              <Switch
                                checked={rule.active}
                                onCheckedChange={(checked) => updateSmartRule(rule.id, 'active', checked)}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeSmartRule(rule.id)}
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {/* GEO Selection */}
                          <div className="mt-3">
                            <Label className="text-xs">GEO Targeting</Label>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {COUNTRIES.slice(0, 10).map(country => (
                                <Badge
                                  key={country.code}
                                  variant={rule.geo.includes(country.code) ? "default" : "outline"}
                                  className="cursor-pointer hover:bg-blue-100 text-xs"
                                  onClick={() => {
                                    const newGeo = rule.geo.includes(country.code)
                                      ? rule.geo.filter(g => g !== country.code)
                                      : [...rule.geo, country.code];
                                    updateSmartRule(rule.id, 'geo', newGeo);
                                  }}
                                >
                                  {country.code}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* SECTION 8: COMPLIANCE */}
            <TabsContent value="compliance" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Compliance</CardTitle>
                  <CardDescription>Traffic restrictions and compliance settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Allowed Traffic Types */}
                  <div>
                    <Label>Allowed Traffic Types</Label>
                    <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-gray-50">
                      {TRAFFIC_TYPES.map(type => (
                        <Badge
                          key={type}
                          variant={selectedAllowedTraffic.includes(type) ? "default" : "outline"}
                          className="cursor-pointer hover:bg-blue-100"
                          onClick={() => toggleArrayItem(selectedAllowedTraffic, setSelectedAllowedTraffic, type, 'allowed_traffic_types')}
                        >
                          {type}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Selected: {selectedAllowedTraffic.length} traffic types
                    </p>
                  </div>

                  {/* Disallowed Traffic Types */}
                  <div>
                    <Label>Disallowed Traffic Types</Label>
                    <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-red-50">
                      {DISALLOWED_TRAFFIC.map(type => (
                        <Badge
                          key={type}
                          variant={selectedDisallowedTraffic.includes(type) ? "destructive" : "outline"}
                          className="cursor-pointer hover:bg-red-100"
                          onClick={() => toggleArrayItem(selectedDisallowedTraffic, setSelectedDisallowedTraffic, type, 'disallowed_traffic_types')}
                        >
                          {type}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Selected: {selectedDisallowedTraffic.length} restricted types
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="creative_approval_required"
                      checked={formData.creative_approval_required || false}
                      onCheckedChange={(checked) => handleInputChange('creative_approval_required', checked)}
                    />
                    <Label htmlFor="creative_approval_required">Creative Approval Required</Label>
                  </div>

                  <div>
                    <Label htmlFor="affiliate_terms">Affiliate Terms / Notes</Label>
                    <Textarea
                      id="affiliate_terms"
                      value={formData.affiliate_terms || ''}
                      onChange={(e) => handleInputChange('affiliate_terms', e.target.value)}
                      placeholder="Terms and conditions for affiliates..."
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="brand_guidelines">Brand Guidelines / Notes</Label>
                    <Textarea
                      id="brand_guidelines"
                      value={formData.brand_guidelines || ''}
                      onChange={(e) => handleInputChange('brand_guidelines', e.target.value)}
                      placeholder="Brand guidelines and do's/don'ts..."
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="terms_notes">Additional Terms & Notes</Label>
                    <Textarea
                      id="terms_notes"
                      value={formData.terms_notes || ''}
                      onChange={(e) => handleInputChange('terms_notes', e.target.value)}
                      placeholder="Additional terms and conditions..."
                      rows={3}
                    />
                  </div>

                  {/* Compliance Summary */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">📋 Compliance Summary</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-blue-700">Allowed Traffic:</span>
                        <div className="text-blue-900 font-medium">
                          {selectedAllowedTraffic.length > 0 ? `${selectedAllowedTraffic.length} types selected` : 'None selected'}
                        </div>
                      </div>
                      <div>
                        <span className="text-blue-700">Restricted Traffic:</span>
                        <div className="text-blue-900 font-medium">
                          {selectedDisallowedTraffic.length > 0 ? `${selectedDisallowedTraffic.length} types restricted` : 'None restricted'}
                        </div>
                      </div>
                      <div>
                        <span className="text-blue-700">Creative Approval:</span>
                        <div className="text-blue-900 font-medium">
                          {formData.creative_approval_required ? 'Required' : 'Not Required'}
                        </div>
                      </div>
                      <div>
                        <span className="text-blue-700">Terms & Guidelines:</span>
                        <div className="text-blue-900 font-medium">
                          {(formData.affiliate_terms || formData.brand_guidelines || formData.terms_notes) ? 'Configured' : 'Not Set'}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SECTION 10: INTEGRATIONS */}

            {/* SECTION 11: REPORTING & MONITORING */}
            <TabsContent value="reporting" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Reporting & Monitoring</CardTitle>
                  <CardDescription>Analytics and monitoring settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="hit_limit">Hit Limit</Label>
                      <Input
                        id="hit_limit"
                        type="number"
                        min="0"
                        value={formData.hit_limit || ''}
                        onChange={(e) => handleInputChange('hit_limit', e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="1000"
                      />
                    </div>
                    <div>
                      <Label htmlFor="conversion_goal">Conversion Goal</Label>
                      <Select value={formData.conversion_goal || 'lead'} onValueChange={(value) => handleInputChange('conversion_goal', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lead">Lead</SelectItem>
                          <SelectItem value="sale">Sale</SelectItem>
                          <SelectItem value="install">Install</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs >

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Offer'}
            </Button>
          </div>
        </form >
      </DialogContent >
    </Dialog >
  );
};
