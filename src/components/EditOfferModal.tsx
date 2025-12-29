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
import { CalendarIcon, X, Plus, Info, ImageIcon, ExternalLink, Clock, Eye, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Offer, CreateOfferData, adminOfferApi } from '@/services/adminOfferApi';
import { fileUploadApi } from '@/services/accessControlApi';
import { partnerApi } from '@/services/partnerApi';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '../services/apiConfig';

interface EditOfferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: Offer | null;
  onOfferUpdated?: () => void;
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

// Helper function to get flag image URL
const getFlagUrl = (countryCode: string) => {
  return `https://flagcdn.com/24x18/${countryCode.toLowerCase()}.png`;
};

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

const NETWORKS = [
  'AdGate Media', 'SuperRewards', 'CPAlead', 'OfferToro', 'RevenueUniverse',
  'Wannads', 'Adscend Media', 'Persona.ly', 'Kiwi Wall', 'Offerdaddy'
];

export const EditOfferModal: React.FC<EditOfferModalProps> = ({
  open,
  onOpenChange,
  offer,
  onOfferUpdated
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
  const [expirationDate, setExpirationDate] = useState<Date>();
  const [startDate, setStartDate] = useState<Date>();
  const [newCountry, setNewCountry] = useState('');
  const [newUser, setNewUser] = useState('');
  const [imagePreview, setImagePreview] = useState<string>('');
  const [thumbnailPreview, setThumbnailPreview] = useState<string>('');

  // Schedule + Smart Rules state
  const [endDate, setEndDate] = useState<Date>();
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedWeekdays, setSelectedWeekdays] = useState<string[]>([]);
  const [scheduleStatus, setScheduleStatus] = useState('Active');
  const [smartRules, setSmartRules] = useState<SmartRule[]>([]);
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [partners, setPartners] = useState<any[]>([]);

  // Promo code state
  const [promoCodes, setPromoCodes] = useState<any[]>([]);
  const [selectedPromoCode, setSelectedPromoCode] = useState('');

  const [formData, setFormData] = useState<any>({
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
    expiration_date: '',
    device_targeting: 'all',
    partner_id: '',
    // Additional comprehensive fields
    category: '',
    offer_type: '',
    currency: 'USD',
    revenue: undefined,
    daily_cap: undefined,
    weekly_cap: undefined,
    monthly_cap: undefined,
    auto_pause_on_cap: false,
    postback_url: '',
    click_expiration: 7,
    conversion_window: 30,
    manager: '',
    approval_notes: '',
    languages: [],
    os_targeting: [],
    browser_targeting: [],
    carrier_targeting: [],
    timezone: '',
    connection_type: '',
    start_date: '',
    random_redirect: false,
    rotation_enabled: false,
    creative_approval_required: false,
    external_offer_id: '',
    conversion_goal: '',
    // Creative fields
    creative_type: 'image',
    banner_300x250: '',
    banner_728x90: '',
    banner_160x600: '',
    banner_320x50: '',
    html_code: '',
    email_template: '',
    email_subject: '',
    uploaded_file_name: '',
    uploaded_file_size: 0,
    uploaded_file_id: '',
    uploaded_file_url: '',
    file_description: '',
    // Promo code field
    promo_code_id: '',
    // 🔥 APPROVAL WORKFLOW FIELDS - Initialize with defaults
    approval_type: 'auto_approve',
    auto_approve_delay: 0,
    require_approval: false,
    approval_message: '',
    max_inactive_days: 30
  });

  // Load offer data when modal opens
  useEffect(() => {
    if (offer && open) {
      setFormData({
        campaign_id: offer.campaign_id,
        name: offer.name,
        description: offer.description || '',
        status: offer.status,
        vertical: (offer as any).vertical || (offer as any).category || 'Lifestyle',  // NEW: Vertical (replaces category)
        countries: offer.countries,
        allowed_countries: (offer as any).allowed_countries || [],  // NEW: Geo-restriction
        non_access_url: (offer as any).non_access_url || '',  // NEW: Fallback URL
        payout: offer.payout,
        revenue_share_percent: (offer as any).revenue_share_percent || 0,  // NEW: Revenue share
        incentive_type: (offer as any).incentive_type || 'Incent',  // NEW: Auto-calculated
        network: offer.network,
        affiliates: offer.affiliates,
        selected_users: offer.selected_users || [],
        image_url: offer.image_url || '',
        thumbnail_url: offer.thumbnail_url || '',
        hash_code: offer.hash_code || '',
        limit: offer.limit,
        target_url: offer.target_url,
        preview_url: offer.preview_url || '',
        expiration_date: offer.expiration_date || '',
        device_targeting: offer.device_targeting,
        partner_id: (offer as any).partner_id || '',
        // Additional fields (using any to handle missing type definitions)
        category: (offer as any).category || '',
        offer_type: (offer as any).offer_type || '',
        currency: (offer as any).currency || 'USD',
        revenue: (offer as any).revenue,
        daily_cap: (offer as any).daily_cap,
        weekly_cap: (offer as any).weekly_cap,
        monthly_cap: (offer as any).monthly_cap,
        auto_pause_on_cap: (offer as any).auto_pause_on_cap || false,
        postback_url: (offer as any).postback_url || '',
        click_expiration: (offer as any).click_expiration || 7,
        conversion_window: (offer as any).conversion_window || 30,
        manager: (offer as any).manager || '',
        approval_notes: (offer as any).approval_notes || '',
        languages: (offer as any).languages || [],
        os_targeting: (offer as any).os_targeting || [],
        browser_targeting: (offer as any).browser_targeting || [],
        carrier_targeting: (offer as any).carrier_targeting || [],
        timezone: (offer as any).timezone || '',
        connection_type: (offer as any).connection_type || '',
        start_date: (offer as any).start_date || '',
        random_redirect: (offer as any).random_redirect || false,
        rotation_enabled: (offer as any).rotation_enabled || false,
        creative_approval_required: (offer as any).creative_approval_required || false,
        external_offer_id: (offer as any).external_offer_id || '',
        conversion_goal: (offer as any).conversion_goal || '',
        // Creative fields
        creative_type: (offer as any).creative_type || 'image',
        banner_300x250: (offer as any).banner_300x250 || '',
        banner_728x90: (offer as any).banner_728x90 || '',
        banner_160x600: (offer as any).banner_160x600 || '',
        banner_320x50: (offer as any).banner_320x50 || '',
        html_code: (offer as any).html_code || '',
        email_template: (offer as any).email_template || '',
        email_subject: (offer as any).email_subject || '',
        uploaded_file_name: (offer as any).uploaded_file_name || '',
        uploaded_file_size: (offer as any).uploaded_file_size || 0,
        uploaded_file_id: (offer as any).uploaded_file_id || '',
        uploaded_file_url: (offer as any).uploaded_file_url || '',
        file_description: (offer as any).file_description || '',
        // Promo code field
        promo_code_id: (offer as any).promo_code_id || '',
        // 🔥 APPROVAL WORKFLOW FIELDS - Load from offer
        approval_type: (offer as any).approval_settings?.type || 'auto_approve',
        auto_approve_delay: (offer as any).approval_settings?.auto_approve_delay || 0,
        require_approval: (offer as any).approval_settings?.require_approval || false,
        approval_message: (offer as any).approval_settings?.approval_message || '',
        max_inactive_days: (offer as any).approval_settings?.max_inactive_days || 30
      });

      // Set selected promo code if offer has one
      if ((offer as any).promo_code_id) {
        setSelectedPromoCode((offer as any).promo_code_id);
      }

      setSelectedCountries(offer.countries);
      setSelectedAllowedCountries((offer as any).allowed_countries || []);  // NEW: Load allowed countries
      setSelectedUsers(offer.selected_users || []);
      setSelectedLanguages((offer as any).languages || []);
      setSelectedOS((offer as any).os_targeting || []);
      setSelectedBrowsers((offer as any).browser_targeting || []);
      setSelectedCarriers((offer as any).carrier_targeting || []);
      setImagePreview(offer.image_url || '');
      setThumbnailPreview(offer.thumbnail_url || '');

      if (offer.expiration_date) {
        try {
          setExpirationDate(parseISO(offer.expiration_date));
        } catch {
          setExpirationDate(undefined);
        }
      } else {
        setExpirationDate(undefined);
      }

      if ((offer as any).start_date) {
        try {
          setStartDate(parseISO((offer as any).start_date));
        } catch {
          setStartDate(undefined);
        }
      } else {
        setStartDate(undefined);
      }
    }
  }, [offer, open]);

  // Fetch partners list and promo codes
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await partnerApi.getPartners();
        setPartners(response.partners || []);
      } catch (error) {
        console.error('Failed to fetch partners:', error);
        toast({
          title: "Error",
          description: "Failed to load partners list",
          variant: "destructive"
        });
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

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Update image previews
    if (field === 'image_url') {
      setImagePreview(value);
    }
    if (field === 'thumbnail_url') {
      setThumbnailPreview(value);
    }
  };

  const addCountry = (countryCode?: string) => {
    const country = countryCode || newCountry;
    if (country && !selectedCountries.includes(country)) {
      const updated = [...selectedCountries, country];
      setSelectedCountries(updated);
      handleInputChange('countries', updated);
      setNewCountry('');
    }
  };

  const removeCountry = (country: string) => {
    const updated = selectedCountries.filter(c => c !== country);
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

  // Helper function for toggling array items
  const toggleArrayItem = (
    currentArray: string[],
    setterFunction: React.Dispatch<React.SetStateAction<string[]>>,
    item: string,
    formField: string
  ) => {
    const updated = currentArray.includes(item)
      ? currentArray.filter(i => i !== item)
      : [...currentArray, item];
    setterFunction(updated);
    handleInputChange(formField, updated);
  };

  // Schedule + Smart Rules helper functions
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
    if (!offer) return;

    setLoading(true);

    try {
      // Prepare data for submission
      const submitData = {
        ...formData,
        countries: selectedCountries,
        selected_users: formData.affiliates === 'selected' ? selectedUsers : [],
        languages: selectedLanguages,
        os_targeting: selectedOS,
        browser_targeting: selectedBrowsers,
        carrier_targeting: selectedCarriers,
        expiration_date: expirationDate ? format(expirationDate, 'yyyy-MM-dd') : '',
        start_date: startDate ? format(startDate, 'yyyy-MM-dd') : '',
        payout: Number(formData.payout),
        revenue: formData.revenue ? Number(formData.revenue) : undefined,
        limit: formData.limit ? Number(formData.limit) : undefined,
        daily_cap: formData.daily_cap ? Number(formData.daily_cap) : undefined,
        weekly_cap: formData.weekly_cap ? Number(formData.weekly_cap) : undefined,
        monthly_cap: formData.monthly_cap ? Number(formData.monthly_cap) : undefined,
        click_expiration: Number(formData.click_expiration) || 7,
        conversion_window: Number(formData.conversion_window) || 30,
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
        promo_code_id: selectedPromoCode || undefined,
        // 🔥 APPROVAL WORKFLOW DATA: Include all approval settings
        approval_type: formData.approval_type || 'auto_approve',
        auto_approve_delay: formData.auto_approve_delay || 0,
        require_approval: formData.require_approval || false,
        approval_message: formData.approval_message || '',
        max_inactive_days: formData.max_inactive_days || 30
      };

      // 🔍 QA VERIFICATION: Debug logs
      console.log('🔍 EDIT - Schedule Data Being Sent:', submitData.schedule);
      console.log('🔍 EDIT - Smart Rules Data Being Sent:', submitData.smartRules);

      await adminOfferApi.updateOffer(offer.offer_id, submitData);

      toast({
        title: "Success",
        description: "Offer updated successfully!",
      });

      onOpenChange(false);
      onOfferUpdated?.();

    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update offer",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!offer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Offer: {offer.offer_id}</DialogTitle>
          <DialogDescription>
            Update offer configuration and settings.
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
              <TabsTrigger value="integrations">Integrate</TabsTrigger>
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
                      <Label htmlFor="campaign_id">Campaign ID *</Label>
                      <Input
                        id="campaign_id"
                        value={formData.campaign_id}
                        onChange={(e) => handleInputChange('campaign_id', e.target.value)}
                        placeholder="CAMP-001"
                        required
                      />
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

                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-blue-900">Offer Statistics</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm text-blue-700">
                      <div>
                        <strong>Offer ID:</strong> {offer.offer_id}
                      </div>
                      <div>
                        <strong>Total Hits:</strong> {offer.hits.toLocaleString()}
                      </div>
                      <div>
                        <strong>Created:</strong> {offer.created_at ? new Date(offer.created_at).toLocaleDateString() : 'N/A'}
                      </div>
                      <div>
                        <strong>Updated:</strong> {offer.updated_at ? new Date(offer.updated_at).toLocaleDateString() : 'N/A'}
                      </div>
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

                  <div>
                    <Label>Carrier Targeting</Label>
                    <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-gray-50">
                      {CARRIER_OPTIONS.map(carrier => (
                        <Badge
                          key={carrier}
                          variant={selectedCarriers.includes(carrier) ? "default" : "outline"}
                          className="cursor-pointer hover:bg-blue-100"
                          onClick={() => toggleArrayItem(selectedCarriers, setSelectedCarriers, carrier, 'carrier_targeting')}
                        >
                          {carrier}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select value={formData.timezone || ''} onValueChange={(value) => handleInputChange('timezone', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONE_OPTIONS.map(tz => (
                          <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SECTION 3: PAYOUT & FINANCE */}
            <TabsContent value="payout" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Payout & Finance</CardTitle>
                  <CardDescription>Configure payout rates and financial settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="payout">Payout ($) *</Label>
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
                        placeholder="2.50"
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
                      <Label htmlFor="revenue">Revenue ($)</Label>
                      <Input
                        id="revenue"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.revenue || ''}
                        onChange={(e) => handleInputChange('revenue', parseFloat(e.target.value) || undefined)}
                        placeholder="3.00"
                      />
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

                  <div className="grid grid-cols-4 gap-4">
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
                    <div>
                      <Label htmlFor="limit">Total Limit</Label>
                      <Input
                        id="limit"
                        type="number"
                        min="0"
                        value={formData.limit || ''}
                        onChange={(e) => handleInputChange('limit', e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="10000"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="auto_pause_on_cap"
                      checked={formData.auto_pause_on_cap || false}
                      onCheckedChange={(checked) => handleInputChange('auto_pause_on_cap', checked)}
                    />
                    <Label htmlFor="auto_pause_on_cap">Auto-pause when cap reached</Label>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SECTION 4: TRACKING SETUP */}
            <TabsContent value="tracking" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Tracking Setup</CardTitle>
                  <CardDescription>Configure tracking URLs and parameters</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="network">Network *</Label>
                    <Select value={formData.network} onValueChange={(value) => handleInputChange('network', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select network" />
                      </SelectTrigger>
                      <SelectContent>
                        {NETWORKS.map(network => (
                          <SelectItem key={network} value={network}>{network}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="partner_id">Partner (for Postbacks)</Label>
                    <Select value={formData.partner_id || 'none'} onValueChange={(value) => handleInputChange('partner_id', value === 'none' ? '' : value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select partner (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Partner</SelectItem>
                        {partners.map(partner => (
                          <SelectItem key={partner._id} value={partner.partner_id}>
                            {partner.partner_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Assign a partner to enable postback notifications when conversions occur
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="target_url">Target URL *</Label>
                    <Input
                      id="target_url"
                      type="url"
                      value={formData.target_url}
                      onChange={(e) => handleInputChange('target_url', e.target.value)}
                      placeholder="https://example.com/offer"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="preview_url">Preview URL</Label>
                    <div className="flex gap-2">
                      <Input
                        id="preview_url"
                        type="url"
                        value={formData.preview_url}
                        onChange={(e) => handleInputChange('preview_url', e.target.value)}
                        placeholder="https://example.com/preview"
                        className="flex-1"
                      />
                      {formData.preview_url && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(formData.preview_url, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="hash_code">Hash Code</Label>
                      <Input
                        id="hash_code"
                        value={formData.hash_code}
                        onChange={(e) => handleInputChange('hash_code', e.target.value)}
                        placeholder="Tracking hash for postbacks"
                      />
                    </div>
                    <div>
                      <Label htmlFor="postback_url">Postback URL</Label>
                      <Input
                        id="postback_url"
                        type="url"
                        value={formData.postback_url || ''}
                        onChange={(e) => handleInputChange('postback_url', e.target.value)}
                        placeholder="https://example.com/postback"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="click_expiration">Click Expiration (days)</Label>
                      <Input
                        id="click_expiration"
                        type="number"
                        min="1"
                        value={formData.click_expiration || 7}
                        onChange={(e) => handleInputChange('click_expiration', parseInt(e.target.value) || 7)}
                        placeholder="7"
                      />
                    </div>
                    <div>
                      <Label htmlFor="conversion_window">Conversion Window (days)</Label>
                      <Input
                        id="conversion_window"
                        type="number"
                        min="1"
                        value={formData.conversion_window || 30}
                        onChange={(e) => handleInputChange('conversion_window', parseInt(e.target.value) || 30)}
                        placeholder="30"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SECTION 5: ACCESS & AFFILIATES */}
            <TabsContent value="access" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Access & Affiliates</CardTitle>
                  <CardDescription>Control which users can access this offer</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Access Level</Label>
                    <Select value={formData.affiliates} onValueChange={(value) => handleInputChange('affiliates', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        <SelectItem value="premium">Premium Users Only</SelectItem>
                        <SelectItem value="selected">Selected Users Only</SelectItem>
                        <SelectItem value="request">Request-based Access</SelectItem>
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
                          placeholder="Enter username or user ID"
                          className="flex-1"
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

                  <div>
                    <Label htmlFor="manager">Manager</Label>
                    <Input
                      id="manager"
                      value={formData.manager || ''}
                      onChange={(e) => handleInputChange('manager', e.target.value)}
                      placeholder="Campaign manager name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="approval_notes">Approval Notes</Label>
                    <Textarea
                      id="approval_notes"
                      value={formData.approval_notes || ''}
                      onChange={(e) => handleInputChange('approval_notes', e.target.value)}
                      placeholder="Notes for affiliate approval process"
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* PROMO CODE ASSIGNMENT */}
              <Card>
                <CardHeader>
                  <CardTitle>🎉 Assign Promo Code</CardTitle>
                  <CardDescription>Optionally assign or update promo code for this offer</CardDescription>
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
                  <CardDescription>Manage offer images and creative assets</CardDescription>
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
                  {/* Conditional Creative Content Based on Type */}
                  {(formData.creative_type === 'image' || !formData.creative_type) && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <Label htmlFor="image_url">Main Image URL</Label>
                          <Input
                            id="image_url"
                            type="url"
                            value={formData.image_url}
                            onChange={(e) => handleInputChange('image_url', e.target.value)}
                            placeholder="https://example.com/image.jpg"
                            className="mb-3"
                          />

                          {imagePreview ? (
                            <div className="border rounded-lg p-2 bg-gray-50">
                              <img
                                src={imagePreview}
                                alt="Offer preview"
                                className="w-full h-32 object-cover rounded"
                                onError={() => setImagePreview('')}
                              />
                              <p className="text-xs text-gray-500 mt-1 text-center">Main Image Preview</p>
                            </div>
                          ) : (
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50">
                              <ImageIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                              <p className="text-sm text-gray-500">No image URL provided</p>
                            </div>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="thumbnail_url">Thumbnail URL</Label>
                          <Input
                            id="thumbnail_url"
                            type="url"
                            value={formData.thumbnail_url}
                            onChange={(e) => handleInputChange('thumbnail_url', e.target.value)}
                            placeholder="https://example.com/thumb.jpg"
                            className="mb-3"
                          />

                          {thumbnailPreview ? (
                            <div className="border rounded-lg p-2 bg-gray-50">
                              <img
                                src={thumbnailPreview}
                                alt="Thumbnail preview"
                                className="w-full h-32 object-cover rounded"
                                onError={() => setThumbnailPreview('')}
                              />
                              <p className="text-xs text-gray-500 mt-1 text-center">Thumbnail Preview</p>
                            </div>
                          ) : (
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50">
                              <ImageIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                              <p className="text-sm text-gray-500">No thumbnail URL provided</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <Label>Banner Assets</Label>
                        <div className="grid grid-cols-2 gap-4 mt-2">
                          <div>
                            <Label htmlFor="banner_300x250">Banner 300x250</Label>
                            <Input
                              id="banner_300x250"
                              type="url"
                              value={formData.banner_300x250 || ''}
                              onChange={(e) => handleInputChange('banner_300x250', e.target.value)}
                              placeholder="https://example.com/banner-300x250.jpg"
                            />
                          </div>
                          <div>
                            <Label htmlFor="banner_728x90">Banner 728x90</Label>
                            <Input
                              id="banner_728x90"
                              type="url"
                              value={formData.banner_728x90 || ''}
                              onChange={(e) => handleInputChange('banner_728x90', e.target.value)}
                              placeholder="https://example.com/banner-728x90.jpg"
                            />
                          </div>
                          <div>
                            <Label htmlFor="banner_160x600">Banner 160x600</Label>
                            <Input
                              id="banner_160x600"
                              type="url"
                              value={formData.banner_160x600 || ''}
                              onChange={(e) => handleInputChange('banner_160x600', e.target.value)}
                              placeholder="https://example.com/banner-160x600.jpg"
                            />
                          </div>
                          <div>
                            <Label htmlFor="banner_320x50">Banner 320x50</Label>
                            <Input
                              id="banner_320x50"
                              type="url"
                              value={formData.banner_320x50 || ''}
                              onChange={(e) => handleInputChange('banner_320x50', e.target.value)}
                              placeholder="https://example.com/banner-320x50.jpg"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {formData.creative_type === 'html' && (
                    <div className="space-y-6">
                      <div>
                        <Label htmlFor="html_code">HTML Banner Code</Label>
                        <Textarea
                          id="html_code"
                          value={formData.html_code || ''}
                          onChange={(e) => handleInputChange('html_code', e.target.value)}
                          placeholder="<iframe src='https://example.com/banner' width='300' height='250'></iframe>"
                          rows={8}
                          className="font-mono text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Paste your HTML banner code, iframe, or JavaScript tracking code here
                        </p>
                      </div>

                      {formData.html_code && (
                        <div>
                          <Label>HTML Code Preview</Label>
                          <div className="border rounded-lg p-4 bg-gray-50">
                            <div className="bg-white p-2 rounded border">
                              <div
                                dangerouslySetInnerHTML={{ __html: formData.html_code }}
                                className="max-w-full overflow-hidden"
                              />
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                              ⚠️ Preview may not show interactive elements. Test on live site.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {formData.creative_type === 'email' && (
                    <div className="space-y-6">
                      <div>
                        <Label htmlFor="email_template">Email Template</Label>
                        <Textarea
                          id="email_template"
                          value={formData.email_template || ''}
                          onChange={(e) => handleInputChange('email_template', e.target.value)}
                          placeholder="Subject: Amazing Offer Inside!

Hi {name},

Check out this exclusive offer: {offer_name}

Get {payout} for each conversion!

Click here: {tracking_link}

Best regards,
Your Team"
                          rows={12}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Use variables: {`{name}, {offer_name}, {payout}, {tracking_link}`}
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="email_subject">Email Subject</Label>
                        <Input
                          id="email_subject"
                          value={formData.email_subject || ''}
                          onChange={(e) => handleInputChange('email_subject', e.target.value)}
                          placeholder="🎯 Exclusive Offer - {offer_name}"
                        />
                      </div>
                    </div>
                  )}

                  {formData.creative_type === 'upload' && (
                    <div className="space-y-6">
                      <div>
                        <Label htmlFor="file_upload">Upload Creative File</Label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50">
                          <input
                            type="file"
                            id="file_upload"
                            accept="image/*,video/*,.pdf,.zip"
                            className="hidden"
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

                                  // Create preview URL for images only
                                  if (file.type.startsWith('image/')) {
                                    const previewUrl = URL.createObjectURL(file);
                                    handleInputChange('image_url', previewUrl);
                                  } else {
                                    // For non-images, clear the image preview
                                    handleInputChange('image_url', '');
                                  }

                                  // Store file info
                                  handleInputChange('uploaded_file_name', file.name);
                                  handleInputChange('uploaded_file_size', file.size);

                                  toast({
                                    title: "Success",
                                    description: `File "${file.name}" selected successfully!`,
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
                          />
                          <label htmlFor="file_upload" className="cursor-pointer">
                            <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-lg font-medium text-gray-700 mb-2">
                              Click to upload creative file
                            </p>
                            <p className="text-sm text-gray-500">
                              Images, videos, PDFs, or ZIP files up to 10MB
                            </p>
                          </label>
                        </div>

                        {formData.uploaded_file_name && (
                          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-sm font-medium text-green-800">
                              📁 {formData.uploaded_file_name}
                            </p>
                            <p className="text-xs text-green-600">
                              Size: {Math.round((formData.uploaded_file_size || 0) / 1024)} KB
                            </p>
                          </div>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="file_description">File Description</Label>
                        <Textarea
                          id="file_description"
                          value={formData.file_description || ''}
                          onChange={(e) => handleInputChange('file_description', e.target.value)}
                          placeholder="Describe this creative file and how it should be used..."
                          rows={3}
                        />
                      </div>
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
                        {formData.creative_type === 'image' || !formData.creative_type ? (
                          imagePreview ? (
                            <img
                              src={imagePreview}
                              alt="Offer display"
                              className="w-full h-40 object-cover rounded mb-2"
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
                        ) : formData.creative_type === 'email' ? (
                          <div className="p-4 bg-blue-50 rounded mb-2">
                            <p className="text-sm font-medium">📧 Email Creative</p>
                            <p className="text-xs text-gray-600">
                              Subject: {formData.email_subject || 'Amazing Offer Inside!'}
                            </p>
                          </div>
                        ) : formData.creative_type === 'upload' && formData.uploaded_file_name ? (
                          <div className="p-4 bg-green-50 rounded mb-2">
                            <p className="text-sm font-medium">📁 {formData.uploaded_file_name}</p>
                            <p className="text-xs text-gray-600">Uploaded file</p>
                          </div>
                        ) : (
                          <div className="w-full h-40 bg-gray-200 rounded mb-2 flex items-center justify-center">
                            <p className="text-gray-500">No creative selected</p>
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

            {/* SECTION 9: COMPLIANCE */}
            <TabsContent value="compliance" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Compliance & Restrictions</CardTitle>
                  <CardDescription>Traffic quality and compliance settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="creative_approval_required"
                      checked={formData.creative_approval_required || false}
                      onCheckedChange={(checked) => handleInputChange('creative_approval_required', checked)}
                    />
                    <Label htmlFor="creative_approval_required">Require creative approval</Label>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SECTION 10: INTEGRATIONS */}
            <TabsContent value="integrations" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Integrations</CardTitle>
                  <CardDescription>External system integrations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="external_offer_id">External Offer ID</Label>
                    <Input
                      id="external_offer_id"
                      value={formData.external_offer_id || ''}
                      onChange={(e) => handleInputChange('external_offer_id', e.target.value)}
                      placeholder="External system offer ID"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SECTION 11: REPORTING */}
            <TabsContent value="reporting" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Reporting & Monitoring</CardTitle>
                  <CardDescription>Analytics and performance tracking</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="conversion_goal">Conversion Goal</Label>
                    <Select value={formData.conversion_goal || ''} onValueChange={(value) => handleInputChange('conversion_goal', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select goal" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lead">Lead</SelectItem>
                        <SelectItem value="sale">Sale</SelectItem>
                        <SelectItem value="install">Install</SelectItem>
                        <SelectItem value="signup">Sign Up</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update Offer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
