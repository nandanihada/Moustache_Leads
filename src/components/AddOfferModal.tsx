import React, { useState, useEffect, useCallback } from 'react';
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
import { TrafficSourceDisplay } from './TrafficSourceDisplay';
import { TrafficSourceRules, getDefaultRulesForCategory } from '@/services/trafficSourceApi';
import EmailSettingsPanel, { DEFAULT_EMAIL_SETTINGS, type EmailSettings } from '@/components/EmailSettingsPanel';
import { ImagePickerComponent } from '@/components/ImagePickerComponent';
import { DescriptionGeneratorComponent } from '@/components/DescriptionGeneratorComponent';
import { VerticalSuggesterComponent } from '@/components/VerticalSuggesterComponent';
import LinkMasker from '@/components/LinkMasker';

interface AddOfferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOfferCreated?: () => void;
}

const COUNTRIES = [
  { code: 'WW', name: 'Worldwide' },
  // North America
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'MX', name: 'Mexico' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'BZ', name: 'Belize' },
  { code: 'HN', name: 'Honduras' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'PA', name: 'Panama' },
  { code: 'CU', name: 'Cuba' },
  { code: 'JM', name: 'Jamaica' },
  { code: 'HT', name: 'Haiti' },
  { code: 'DO', name: 'Dominican Republic' },
  { code: 'PR', name: 'Puerto Rico' },
  { code: 'TT', name: 'Trinidad and Tobago' },
  { code: 'BB', name: 'Barbados' },
  { code: 'LC', name: 'Saint Lucia' },
  { code: 'VC', name: 'Saint Vincent and the Grenadines' },
  { code: 'GD', name: 'Grenada' },
  { code: 'AG', name: 'Antigua and Barbuda' },
  { code: 'DM', name: 'Dominica' },
  { code: 'KN', name: 'Saint Kitts and Nevis' },
  { code: 'BS', name: 'Bahamas' },
  // South America
  { code: 'BR', name: 'Brazil' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
  { code: 'PE', name: 'Peru' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'GY', name: 'Guyana' },
  { code: 'SR', name: 'Suriname' },
  // Western Europe
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'PT', name: 'Portugal' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'IE', name: 'Ireland' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'IS', name: 'Iceland' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'AT', name: 'Austria' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'MC', name: 'Monaco' },
  { code: 'AD', name: 'Andorra' },
  { code: 'MT', name: 'Malta' },
  { code: 'CY', name: 'Cyprus' },
  // Oceania
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'FJ', name: 'Fiji' },
  { code: 'PG', name: 'Papua New Guinea' },
  { code: 'SB', name: 'Solomon Islands' },
  { code: 'VU', name: 'Vanuatu' },
  { code: 'WS', name: 'Samoa' },
  { code: 'TO', name: 'Tonga' },
  { code: 'KI', name: 'Kiribati' },
  { code: 'TV', name: 'Tuvalu' },
  { code: 'NR', name: 'Nauru' },
  { code: 'PW', name: 'Palau' },
  { code: 'MH', name: 'Marshall Islands' },
  { code: 'FM', name: 'Micronesia' },
  // Eastern Europe
  { code: 'PL', name: 'Poland' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'HU', name: 'Hungary' },
  { code: 'RO', name: 'Romania' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'HR', name: 'Croatia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'RS', name: 'Serbia' },
  { code: 'BA', name: 'Bosnia and Herzegovina' },
  { code: 'ME', name: 'Montenegro' },
  { code: 'MK', name: 'North Macedonia' },
  { code: 'AL', name: 'Albania' },
  { code: 'GR', name: 'Greece' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'BY', name: 'Belarus' },
  { code: 'MD', name: 'Moldova' },
  { code: 'RU', name: 'Russia' },
  { code: 'EE', name: 'Estonia' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'XK', name: 'Kosovo' },
  // Asia – South & Southeast
  { code: 'IN', name: 'India' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'NP', name: 'Nepal' },
  { code: 'BT', name: 'Bhutan' },
  { code: 'MV', name: 'Maldives' },
  { code: 'AF', name: 'Afghanistan' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'SG', name: 'Singapore' },
  { code: 'TH', name: 'Thailand' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'PH', name: 'Philippines' },
  { code: 'MM', name: 'Myanmar' },
  { code: 'KH', name: 'Cambodia' },
  { code: 'LA', name: 'Laos' },
  { code: 'TL', name: 'Timor-Leste' },
  { code: 'BN', name: 'Brunei' },
  // Asia – East
  { code: 'CN', name: 'China' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'KP', name: 'North Korea' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'MN', name: 'Mongolia' },
  // Asia – Central
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'UZ', name: 'Uzbekistan' },
  { code: 'TM', name: 'Turkmenistan' },
  { code: 'KG', name: 'Kyrgyzstan' },
  { code: 'TJ', name: 'Tajikistan' },
  // Middle East
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'QA', name: 'Qatar' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'OM', name: 'Oman' },
  { code: 'YE', name: 'Yemen' },
  { code: 'IL', name: 'Israel' },
  { code: 'JO', name: 'Jordan' },
  { code: 'LB', name: 'Lebanon' },
  { code: 'SY', name: 'Syria' },
  { code: 'IQ', name: 'Iraq' },
  { code: 'IR', name: 'Iran' },
  { code: 'TR', name: 'Turkey' },
  { code: 'AM', name: 'Armenia' },
  { code: 'AZ', name: 'Azerbaijan' },
  { code: 'GE', name: 'Georgia' },
  // Africa – North
  { code: 'EG', name: 'Egypt' },
  { code: 'LY', name: 'Libya' },
  { code: 'TN', name: 'Tunisia' },
  { code: 'DZ', name: 'Algeria' },
  { code: 'MA', name: 'Morocco' },
  { code: 'SD', name: 'Sudan' },
  // Africa – West
  { code: 'NG', name: 'Nigeria' },
  { code: 'GH', name: 'Ghana' },
  { code: 'SN', name: 'Senegal' },
  { code: 'CI', name: "Côte d'Ivoire" },
  { code: 'CM', name: 'Cameroon' },
  { code: 'ML', name: 'Mali' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'NE', name: 'Niger' },
  { code: 'GN', name: 'Guinea' },
  { code: 'BJ', name: 'Benin' },
  { code: 'TG', name: 'Togo' },
  { code: 'SL', name: 'Sierra Leone' },
  { code: 'LR', name: 'Liberia' },
  { code: 'GW', name: 'Guinea-Bissau' },
  { code: 'GM', name: 'Gambia' },
  { code: 'MR', name: 'Mauritania' },
  { code: 'CV', name: 'Cape Verde' },
  // Africa – East
  { code: 'KE', name: 'Kenya' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'UG', name: 'Uganda' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'BI', name: 'Burundi' },
  { code: 'SO', name: 'Somalia' },
  { code: 'DJ', name: 'Djibouti' },
  { code: 'ER', name: 'Eritrea' },
  { code: 'SS', name: 'South Sudan' },
  { code: 'MG', name: 'Madagascar' },
  { code: 'MU', name: 'Mauritius' },
  { code: 'SC', name: 'Seychelles' },
  { code: 'KM', name: 'Comoros' },
  // Africa – Central
  { code: 'CD', name: 'DR Congo' },
  { code: 'CG', name: 'Republic of Congo' },
  { code: 'GA', name: 'Gabon' },
  { code: 'GQ', name: 'Equatorial Guinea' },
  { code: 'CF', name: 'Central African Republic' },
  { code: 'TD', name: 'Chad' },
  // Africa – South
  { code: 'ZA', name: 'South Africa' },
  { code: 'ZW', name: 'Zimbabwe' },
  { code: 'ZM', name: 'Zambia' },
  { code: 'MW', name: 'Malawi' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'AO', name: 'Angola' },
  { code: 'NA', name: 'Namibia' },
  { code: 'BW', name: 'Botswana' },
  { code: 'LS', name: 'Lesotho' },
  { code: 'SZ', name: 'Eswatini' },
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

// 12 Predefined Categories (new categorization system)
const VALID_CATEGORIES = [
  'HEALTH', 'SURVEY', 'SWEEPSTAKES', 'EDUCATION', 'INSURANCE', 'LOAN', 
  'FINANCE', 'DATING', 'FREE_TRIAL', 'INSTALLS', 'GAMES_INSTALL', 'OTHER'
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

// Fallback Redirect interface
interface FallbackRedirect {
  enabled: boolean;
  url: string;
  timer: number;  // Timer in seconds
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
  const [sendEmail, setSendEmail] = useState(false);
  const [emailSendMode, setEmailSendMode] = useState<'now' | 'schedule'>('now');
  const [emailScheduleDate, setEmailScheduleDate] = useState('');
  const [emailScheduleTime, setEmailScheduleTime] = useState('');
  const [scheduledEmails, setScheduledEmails] = useState<Array<{_id: string; subject: string; scheduled_at: string; status: string; offer_names?: string[]}>>([]);
  const [loadingScheduled, setLoadingScheduled] = useState(false);
  const [emailSettings, setEmailSettings] = useState<EmailSettings>(DEFAULT_EMAIL_SETTINGS);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [excludeUserIds, setExcludeUserIds] = useState<string[]>([]);
  const [includeUserIds, setIncludeUserIds] = useState<string[]>([]);
  const [recipientMode, setRecipientMode] = useState<'all' | 'include' | 'exclude'>('all');
  const [userSearchInput, setUserSearchInput] = useState('');
  const [availableUsers, setAvailableUsers] = useState<Array<{_id: string; username: string; email: string}>>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedAllowedCountries, setSelectedAllowedCountries] = useState<string[]>([]);  // NEW: For geo-restriction
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);  // Multi-select device targeting
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

  // Fallback Redirect state
  const [fallbackRedirect, setFallbackRedirect] = useState<FallbackRedirect>({
    enabled: false,
    url: '',
    timer: 30  // Default 30 seconds
  });

  // Promo code state
  const [promoCodes, setPromoCodes] = useState<any[]>([]);
  const [selectedPromoCode, setSelectedPromoCode] = useState('');

  // Traffic source rules state (auto-generated based on vertical)
  const [trafficSourceRules, setTrafficSourceRules] = useState<TrafficSourceRules>(
    getDefaultRulesForCategory('OTHER')
  );
  const [hasTrafficSourceOverrides, setHasTrafficSourceOverrides] = useState(false);

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

  // Fetch scheduled emails when user enables email sending
  const fetchScheduledEmails = async () => {
    setLoadingScheduled(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/admin/offers/scheduled-emails`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setScheduledEmails(data.scheduled || []);
      }
    } catch { /* ignore */ }
    finally { setLoadingScheduled(false); }
  };

  const handleEmailToggle = (checked: boolean) => {
    setSendEmail(checked);
    if (checked) {
      fetchScheduledEmails();
    }
  };

  const [offerSource, setOfferSource] = useState<'upward_partner' | 'advertiser'>('upward_partner');
  const [selectedAdvertiser, setSelectedAdvertiser] = useState<string>('');
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [advertisers, setAdvertisers] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  const fetchAdvertiserData = async () => {
    try {
      const token = localStorage.getItem('token');
      const advRes = await fetch(`${API_BASE_URL}/api/admin/advertisers?status=approved`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const advData = await advRes.json();
      if (advData && Array.isArray(advData.advertisers)) {
        setAdvertisers(advData.advertisers);
      } else if (advData && Array.isArray(advData)) {
        setAdvertisers(advData);
      }

      const campRes = await fetch(`${API_BASE_URL}/api/admin/advertiser-campaigns`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const campData = await campRes.json();
      if (campData && Array.isArray(campData.campaigns)) {
        setCampaigns(campData.campaigns);
      } else if (campData && Array.isArray(campData)) {
        setCampaigns(campData);
      }
    } catch (err) {
      console.error('Failed to fetch advertiser data:', err);
    }
  };

  useEffect(() => {
    if (open) {
      fetchAdvertiserData();
    }
  }, [open]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const token = localStorage.getItem('token');
      const formDataObj = new FormData();
      formDataObj.append('file', file);
      
      const response = await fetch(`${API_BASE_URL}/api/files/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formDataObj
      });
      
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Upload failed');
      }
      
      handleInputChange('image_url', data.access_url || data.file_url || `/api/files/${data.file_id}`);
      toast({
        title: "Success",
        description: "Image uploaded successfully!",
      });
    } catch (err: any) {
      toast({
        title: "Upload Failed",
        description: err.message || "Failed to upload image",
        variant: "destructive"
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const [formData, setFormData] = useState<CreateOfferData>({
    campaign_id: '',
    name: '',
    description: '',
    status: 'pending',
    vertical: 'OTHER',  // Category - one of 7 predefined values
    countries: [],
    allowed_countries: [],  // NEW: Geo-restriction - allowed country codes
    non_access_url: '',  // NEW: Fallback URL for geo-blocked users
    payout: 0,
    payout_type: 'fixed',  // fixed/percentage/tiered
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
    auto_approve_delay_unit: 'minutes',
    require_approval: false,
    approval_message: '',
    max_inactive_days: 30,
    // 🔥 IFRAME DISPLAY SETTINGS
    show_in_iframe: true,
    star_rating: 5,
    urgency_type: '',
    timer_enabled: false,
    timer_end_date: '',
    // Smart Link selection fields
    priority: 0,
    rotation_weight: 1.0
  });

  // Update traffic source rules when vertical changes
  useEffect(() => {
    const vertical = formData.vertical || 'OTHER';
    if (!hasTrafficSourceOverrides) {
      setTrafficSourceRules(getDefaultRulesForCategory(vertical));
    }
  }, [formData.vertical, hasTrafficSourceOverrides]);

  // Handle traffic source rules change
  const handleTrafficSourceRulesChange = useCallback((rules: TrafficSourceRules, hasOverrides: boolean) => {
    setTrafficSourceRules(rules);
    setHasTrafficSourceOverrides(hasOverrides);
    // Update the selected traffic arrays for backward compatibility
    setSelectedAllowedTraffic(rules.allowed);
    setSelectedDisallowedTraffic(rules.disallowed);
  }, []);

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
      })),
      fallbackRedirect: {
        enabled: fallbackRedirect.enabled,
        url: fallbackRedirect.url,
        timer: fallbackRedirect.timer
      }
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let submitData: any;
      if (offerSource === 'advertiser') {
        submitData = {
          offer_source: 'advertiser',
          advertiser_id: selectedAdvertiser,
          campaign_request_id: selectedCampaign,
          campaign_id: formData.campaign_id || selectedCampaign,
          name: formData.name,
          description: formData.description,
          vertical: formData.vertical || 'OTHER',
          status: formData.status || 'pending',
          payout: Number(formData.payout) || 0,
          target_url: formData.target_url,
          network: formData.network || 'Advertiser',
          image_url: formData.image_url || '',
          star_rating: Number(formData.star_rating) || 5,
          offer_type: formData.offer_type || 'CPA',
          allowed_countries: formData.allowed_countries || [],
          countries: formData.allowed_countries || [],
          // Expanded targeting options
          device_targeting: formData.device_targeting || 'all',
          os_targeting: formData.os_targeting || [],
          browser_targeting: formData.browser_targeting || [],
          languages: formData.languages || [],
          connection_type: formData.connection_type || 'All',
          vpn: formData.vpn || 'all',
          zone_mode: formData.zone_mode || 'include',
          zones: formData.zones || '',
          retarget: formData.retarget || 'none',
          pricing: formData.pricing || 'cpa',
          format: formData.format || 'popunder',
          // Defaults for required validation on backend
          payout_type: 'fixed',
          affiliates: 'all',
          show_in_iframe: true,
          approval_type: 'auto_approve',
          auto_approve_delay: 0,
          require_approval: false,
          max_inactive_days: 30,
          priority: 0,
          rotation_weight: 1.0,
          //   EMAIL NOTIFICATION TOGGLE
          send_email: sendEmail,
          email_template_style: emailSettings.templateStyle,
          email_visible_fields: emailSettings.visibleFields,
          email_see_more_fields: emailSettings.seeMoreFields,
          email_default_image: emailSettings.defaultImage,
          email_payout_type: emailSettings.payoutType,
          email_mask_preview_links: emailSettings.maskPreviewLinks,
          email_payment_terms: emailSettings.paymentTerms,
          email_subject: emailSubject || undefined,
          email_message: emailMessage || undefined,
          email_exclude_user_ids: excludeUserIds.length > 0 ? excludeUserIds : undefined,
          email_include_user_ids: includeUserIds.length > 0 ? includeUserIds : undefined,
          email_send_mode: emailSendMode,
          email_schedule_at: emailSendMode === 'schedule' && emailScheduleDate ? `${emailScheduleDate}T${emailScheduleTime || '09:00'}:00` : undefined,
        };
      } else {
        submitData = {
          ...formData,
          offer_source: 'upward_partner',
          countries: selectedCountries,
          selected_users: formData.affiliates === 'selected' ? selectedUsers : [],
          payout: Number(formData.payout),
          limit: formData.limit ? Number(formData.limit) : undefined,
          // Traffic source rules (auto-generated based on vertical)
          allowed_traffic_sources: trafficSourceRules.allowed,
          risky_traffic_sources: trafficSourceRules.risky,
          disallowed_traffic_sources: trafficSourceRules.disallowed,
          traffic_source_overrides: hasTrafficSourceOverrides ? trafficSourceRules : null,
          // Compliance data (backward compatibility)
          allowed_traffic_types: trafficSourceRules.allowed,
          disallowed_traffic_types: trafficSourceRules.disallowed,
          // Other targeting data
          os_targeting: selectedOS,
          device_targeting: selectedDevices.length === 0 ? 'all' : selectedDevices,
          browser_targeting: selectedBrowsers,
          carrier_targeting: selectedCarriers,
          languages: selectedLanguages,
          //   APPROVAL WORKFLOW DATA: Include all approval settings
          approval_type: formData.approval_type || 'auto_approve',
          auto_approve_delay: formData.auto_approve_delay || 0,
          require_approval: formData.require_approval || false,
          approval_message: formData.approval_message || '',
          max_inactive_days: formData.max_inactive_days || 30,
          //   CRITICAL FIX: Include Schedule + Smart Rules data
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
          //   FALLBACK REDIRECT WITH TIMER
          fallback_redirect_enabled: fallbackRedirect.enabled,
          fallback_redirect_url: fallbackRedirect.url,
          fallback_redirect_timer: fallbackRedirect.timer,
          //   PROMO CODE ASSIGNMENT
          promo_code_id: selectedPromoCode || undefined,
          // Smart Link selection fields
          priority: Number(formData.priority) || 0,
          rotation_weight: Number(formData.rotation_weight) || 1.0,
          //   EMAIL NOTIFICATION TOGGLE
          send_email: sendEmail,
          email_template_style: emailSettings.templateStyle,
          email_visible_fields: emailSettings.visibleFields,
          email_see_more_fields: emailSettings.seeMoreFields,
          email_default_image: emailSettings.defaultImage,
          email_payout_type: emailSettings.payoutType,
          email_mask_preview_links: emailSettings.maskPreviewLinks,
          email_payment_terms: emailSettings.paymentTerms,
          email_subject: emailSubject || undefined,
          email_message: emailMessage || undefined,
          email_exclude_user_ids: excludeUserIds.length > 0 ? excludeUserIds : undefined,
          email_include_user_ids: includeUserIds.length > 0 ? includeUserIds : undefined,
          email_send_mode: emailSendMode,
          email_schedule_at: emailSendMode === 'schedule' && emailScheduleDate ? `${emailScheduleDate}T${emailScheduleTime || '09:00'}:00` : undefined,
          //   LEVEL-BASED PAYOUTS (conversion event levels)
          level_payouts: {
            enabled: formData.level_payouts_enabled || false,
            levels: (formData.level_payouts_list || []).filter((l: any) => l.name && l.payout > 0)
          },
          //   GEO-SPLIT PAYOUTS (country-wise payouts)
          geo_payouts: (formData.geo_payouts_list || []).filter((g: any) => g.country && g.payout > 0)
        };
      }

      // Remove partner_id if it's empty
      if (offerSource !== 'advertiser' && !submitData.partner_id) {
        delete submitData.partner_id;
      }

      //   QA VERIFICATION: Debug logs
      if (offerSource !== 'advertiser') {
        console.log('  Schedule Data Being Sent:', submitData.schedule);
        console.log('  Smart Rules Data Being Sent:', submitData.smartRules);
        console.log('  Fallback Redirect Data Being Sent:', {
          enabled: fallbackRedirect.enabled,
          url: fallbackRedirect.url,
          timer: fallbackRedirect.timer
        });
        console.log('  Compliance Data Being Sent:', {
          allowed_traffic_types: selectedAllowedTraffic,
          disallowed_traffic_types: selectedDisallowedTraffic,
          creative_approval_required: formData.creative_approval_required,
          affiliate_terms: formData.affiliate_terms,
          brand_guidelines: formData.brand_guidelines,
          terms_notes: formData.terms_notes
        });
      }

      await adminOfferApi.createOffer(submitData);

      // Automatically approve the campaign on the advertiser panel if linked
      if (offerSource === 'advertiser' && selectedCampaign) {
        try {
          const token = localStorage.getItem('token');
          await fetch(`${API_BASE_URL}/api/admin/advertiser-campaigns/${selectedCampaign}/status`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: 'approved' })
          });
        } catch (err) {
          console.error("Failed to automatically update advertiser campaign status:", err);
        }
      }

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
        vertical: 'OTHER',
        countries: [],
        allowed_countries: [],
        payout: 0,
        payout_type: 'fixed',
        revenue_share_percent: 0,
        incentive_type: 'Incent',
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
        creative_type: 'image',
        html_code: '',
        email_template: '',
        uploaded_file_name: '',
        uploaded_file_size: 0,
        approval_type: 'auto_approve',
        auto_approve_delay: 0,
        auto_approve_delay_unit: 'minutes',
        require_approval: false,
        approval_message: '',
        max_inactive_days: 30,
        show_in_iframe: true,
        star_rating: 5,
        urgency_type: '',
        timer_enabled: false,
        timer_end_date: '',
        priority: 0,
        rotation_weight: 1.0
      });
      setSelectedCountries([]);
      setSelectedUsers([]);
      setSelectedLanguages([]);
      setSelectedOS([]);
      setSelectedDevices([]);
      setSelectedBrowsers([]);
      setSelectedCarriers([]);
      setSelectedAllowedTraffic([]);
      setSelectedDisallowedTraffic([]);

      if (offerSource !== 'advertiser') {
        setEndDate(undefined);
        setStartTime('');
        setEndTime('');
        setIsRecurring(false);
        setSelectedWeekdays([]);
        setScheduleStatus('Active');
        setSmartRules([]);
        setShowJsonPreview(false);
        setFallbackRedirect({ enabled: false, url: '', timer: 30 });
      }

      // Reset advertiser specific states
      setOfferSource('upward_partner');
      setSelectedAdvertiser('');
      setSelectedCampaign('');

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
            {offerSource === 'upward_partner' && (
              <TabsList className="grid w-full grid-cols-12 text-xs">
                <TabsTrigger value="identification">ID</TabsTrigger>
                <TabsTrigger value="targeting">Target</TabsTrigger>
                <TabsTrigger value="payout">Payout</TabsTrigger>
                <TabsTrigger value="levels">Level</TabsTrigger>
                <TabsTrigger value="geosplit">Geo</TabsTrigger>
                <TabsTrigger value="tracking">Track</TabsTrigger>
                <TabsTrigger value="access">Access</TabsTrigger>
                <TabsTrigger value="creatives">Creative</TabsTrigger>
                <TabsTrigger value="schedule-rules">Schedule + Rules</TabsTrigger>
                <TabsTrigger value="compliance">Comply</TabsTrigger>
                <TabsTrigger value="reporting">Report</TabsTrigger>
              </TabsList>
            )}

            {/* SECTION 1: OFFER IDENTIFICATION */}
            <TabsContent value="identification" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Offer Identification</CardTitle>
                  <CardDescription>Basic offer details and identification</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Offer Source Toggle */}
                  <div className="space-y-2 border-b pb-4">
                    <Label className="text-sm font-semibold">Offer Source *</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={offerSource === 'upward_partner' ? 'default' : 'outline'}
                        onClick={() => {
                          setOfferSource('upward_partner');
                          setSelectedAdvertiser('');
                          setSelectedCampaign('');
                        }}
                        className="flex items-center gap-1.5"
                      >
                        Upward Partner
                      </Button>
                      <Button
                        type="button"
                        variant={offerSource === 'advertiser' ? 'default' : 'outline'}
                        onClick={() => setOfferSource('advertiser')}
                        className="flex items-center gap-1.5"
                      >
                        Advertiser
                      </Button>
                    </div>
                  </div>

                  {offerSource === 'advertiser' ? (
                    /* ADVERTISER MODE FORM FIELDS */
                    <div className="space-y-4 pt-2">
                      {/* Map to advertiser Box */}
                      <div className="p-4 rounded-lg border border-orange-200 bg-orange-50/20 space-y-4">
                        <div className="flex items-center gap-2 font-semibold text-orange-850 text-sm">
                          <span className="p-1 rounded bg-orange-100">🗺️</span>
                          Map to advertiser
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-gray-700">Advertiser *</Label>
                            <Select 
                              value={selectedAdvertiser} 
                              onValueChange={(val) => {
                                setSelectedAdvertiser(val);
                                setSelectedCampaign('');
                              }}
                            >
                              <SelectTrigger className="bg-white border-gray-200">
                                <SelectValue placeholder="Select advertiser..." />
                              </SelectTrigger>
                              <SelectContent>
                                {advertisers.map((adv: any) => (
                                  <SelectItem key={adv._id || adv.id} value={adv._id || adv.id}>
                                    {adv.company_name || adv.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-gray-700">Submitted campaign *</Label>
                            <Select 
                              value={selectedCampaign} 
                              onValueChange={(val) => {
                                setSelectedCampaign(val);
                                const camp = campaigns.find((c: any) => (c._id || c.id) === val);
                                if (camp) {
                                  const fd = camp.form_data || {};
                                  const countriesList = camp.target_countries || camp.countries || fd.countries || [];
                                  
                                  setSelectedCountries(countriesList);
                                  handleInputChange('allowed_countries', countriesList);
                                  handleInputChange('countries', countriesList);
                                  
                                  handleInputChange('name', camp.name || '');
                                  handleInputChange('description', camp.description || fd.description || '');
                                  handleInputChange('vertical', camp.category || camp.vertical || fd.vertical || 'OTHER');
                                  handleInputChange('payout', camp.payout || camp.bid_amount || fd.cpaGoal || fd.bid_amount || 0);
                                  handleInputChange('target_url', camp.landing_url || fd.targetUrl || camp.target_url || '');
                                  handleInputChange('campaign_id', camp._id || camp.id);
                                  handleInputChange('image_url', camp.image_url || fd.image_url || '');
                                  
                                  // Map all campaign targeting properties from database columns or form_data
                                  handleInputChange('device_targeting', camp.target_devices || fd.devices || 'all');
                                  handleInputChange('os_targeting', camp.target_os || fd.os || []);
                                  handleInputChange('browser_targeting', camp.target_browsers || fd.browsers || []);
                                  handleInputChange('languages', camp.target_languages || fd.browserLanguages || []);
                                  handleInputChange('connection_type', fd.connection || 'All');
                                  handleInputChange('vpn', fd.vpn || 'all');
                                  handleInputChange('zone_mode', fd.zoneMode || 'include');
                                  handleInputChange('zones', fd.zones || '');
                                  handleInputChange('retarget', fd.retarget || 'none');
                                  handleInputChange('pricing', fd.pricing || camp.pricing || 'cpa');
                                  handleInputChange('format', fd.format || camp.campaign_type || 'popunder');
                                }
                              }}
                              disabled={!selectedAdvertiser}
                            >
                              <SelectTrigger className="bg-white border-gray-200">
                                <SelectValue placeholder={selectedAdvertiser ? "Select campaign..." : "Pick advertiser first"} />
                              </SelectTrigger>
                              <SelectContent>
                                {campaigns
                                  .filter((c: any) => c.advertiser_id === selectedAdvertiser)
                                  .map((camp: any) => (
                                    <SelectItem key={camp._id || camp.id} value={camp._id || camp.id}>
                                      {camp.name} ({camp.status})
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      {/* Basic Fields Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="adv_campaign_id">Offer ID (from advertiser submission) *</Label>
                          <Input
                            id="adv_campaign_id"
                            value={formData.campaign_id}
                            onChange={(e) => handleInputChange('campaign_id', e.target.value)}
                            placeholder="auto-filled from submission"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="adv_status">Status</Label>
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

                      {/* Name */}
                      <div>
                        <Label htmlFor="adv_name">Offer Name *</Label>
                        <Input
                          id="adv_name"
                          value={formData.name}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          placeholder="Premium Survey Offer"
                          required
                        />
                      </div>

                      {/* Description with AI Description Generator */}
                      <div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="adv_description">Description</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-purple-600" title="AI Description Generator">
                                <img src="https://i.postimg.cc/XB0zjj5r/description.png" alt="" className="w-4 h-4 mr-1" />Generate
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[450px] p-3" align="end">
                              <DescriptionGeneratorComponent
                                offerName={formData.name || 'New Offer'}
                                existingDescription={formData.description || ''}
                                vertical={formData.vertical}
                                onDescriptionSaved={(newDesc) => handleInputChange('description', newDesc)}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <Textarea
                          id="adv_description"
                          value={formData.description || ''}
                          onChange={(e) => handleInputChange('description', e.target.value)}
                          placeholder="Detailed offer description"
                          rows={3}
                        />
                      </div>

                      {/* Target URL */}
                      <div>
                        <Label htmlFor="adv_target_url">Target URL *</Label>
                        <Input
                          id="adv_target_url"
                          type="url"
                          value={formData.target_url}
                          onChange={(e) => handleInputChange('target_url', e.target.value)}
                          placeholder="https://example.com/landing?subid={subid}"
                          required
                        />
                      </div>

                      {/* Grid: Category, Offer Type, Star Rating, Payout */}
                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <Label htmlFor="adv_vertical">Category</Label>
                          <Select value={formData.vertical ?? 'OTHER'} onValueChange={(value) => handleInputChange('vertical', value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {VALID_CATEGORIES.map(category => (
                                <SelectItem key={category} value={category}>{category}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="adv_offer_type">Offer Type</Label>
                          <Select value={formData.offer_type || 'CPA'} onValueChange={(value) => handleInputChange('offer_type', value)}>
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
                        <div>
                          <Label htmlFor="adv_star_rating">Star Rating (1-5)</Label>
                          <Select value={String(formData.star_rating || 5)} onValueChange={(value) => handleInputChange('star_rating', parseInt(value))}>
                            <SelectTrigger>
                              <SelectValue placeholder="5 Stars" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="5">⭐⭐⭐⭐⭐ (5 Stars)</SelectItem>
                              <SelectItem value="4">⭐⭐⭐⭐ (4 Stars)</SelectItem>
                              <SelectItem value="3">⭐⭐⭐ (3 Stars)</SelectItem>
                              <SelectItem value="2">⭐⭐ (2 Stars)</SelectItem>
                              <SelectItem value="1">⭐ (1 Star)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="adv_payout">Payout ($) *</Label>
                          <Input
                            id="adv_payout"
                            type="number"
                            step="0.01"
                            value={formData.payout}
                            onChange={(e) => handleInputChange('payout', e.target.value)}
                            placeholder="1.50"
                            required
                          />
                        </div>
                      </div>

                      {/* Image Upload Banner (Mandatory) */}
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Upload Campaign Banner / Image *</Label>
                        <div className="flex items-center gap-4">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            disabled={uploadingImage}
                            className="cursor-pointer"
                            required={!formData.image_url}
                          />
                          {uploadingImage && <span className="text-xs text-muted-foreground">Uploading...</span>}
                        </div>
                        {formData.image_url && (
                          <div className="mt-2 relative inline-block">
                            <img 
                              src={formData.image_url.startsWith('http') ? formData.image_url : `${API_BASE_URL}${formData.image_url}`} 
                              alt="Preview" 
                              className="h-24 rounded border object-cover" 
                            />
                            <button
                              type="button"
                              onClick={() => handleInputChange('image_url', '')}
                              className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-1 w-6 h-6 flex items-center justify-center text-xs hover:bg-destructive/90"
                            >
                              ×
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* ORIGINAL UPWARD PARTNER FORM FIELDS */
                    <div className="space-y-4 pt-2">
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
                        <div className="flex items-center justify-between">
                          <Label htmlFor="description">Description</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-purple-600" title="AI Description Generator">
                                <img src="https://i.postimg.cc/XB0zjj5r/description.png" alt="" className="w-4 h-4 mr-1" />Generate
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[450px] p-3" align="end">
                              <DescriptionGeneratorComponent
                                offerName={formData.name || 'New Offer'}
                                existingDescription={formData.description || ''}
                                vertical={formData.vertical}
                                onDescriptionSaved={(newDesc) => handleInputChange('description', newDesc)}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
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
                          <div className="flex items-center justify-between">
                            <Label htmlFor="vertical">Category</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-blue-600" title="AI Vertical Suggester">
                                  <img src="https://i.postimg.cc/bw1GTwsg/categorization.png" alt="" className="w-4 h-4 mr-1" />Suggest
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[400px] p-3" align="end">
                                <VerticalSuggesterComponent
                                  offerName={formData.name || 'New Offer'}
                                  description={formData.description || ''}
                                  currentVertical={formData.vertical || ''}
                                  onVerticalSaved={(newVertical) => handleInputChange('vertical', newVertical)}
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                          <Select value={formData.vertical ?? 'OTHER'} onValueChange={(value) => handleInputChange('vertical', value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {VALID_CATEGORIES.map(category => (
                                <SelectItem key={category} value={category}>{category}</SelectItem>
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
                        <div>
                          <Label htmlFor="star_rating">Star Rating (1-5)</Label>
                          <Select value={String(formData.star_rating || 5)} onValueChange={(value) => handleInputChange('star_rating', parseInt(value))}>
                            <SelectTrigger>
                              <SelectValue placeholder="5 Stars" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="5">⭐⭐⭐⭐⭐ (5 Stars)</SelectItem>
                              <SelectItem value="4">⭐⭐⭐⭐ (4 Stars)</SelectItem>
                              <SelectItem value="3">⭐⭐⭐ (3 Stars)</SelectItem>
                              <SelectItem value="2">⭐⭐ (2 Stars)</SelectItem>
                              <SelectItem value="1">⭐ (1 Star)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="priority">Selection Priority (Smart Link)</Label>
                          <Input
                            id="priority"
                            type="number"
                            value={formData.priority || 0}
                            onChange={(e) => handleInputChange('priority', parseInt(e.target.value) || 0)}
                            placeholder="0"
                          />
                          <p className="text-xs text-muted-foreground mt-1">Higher values are prioritized in Smart Link redirection.</p>
                        </div>
                        <div>
                          <Label htmlFor="rotation_weight">Rotation Weight (0.1 - 10)</Label>
                          <Input
                            id="rotation_weight"
                            type="number"
                            step="0.1"
                            min="0"
                            value={formData.rotation_weight || 1.0}
                            onChange={(e) => handleInputChange('rotation_weight', parseFloat(e.target.value) || 1.0)}
                            placeholder="1.0"
                          />
                          <p className="text-xs text-muted-foreground mt-1">Relative probability for weighted random rotation.</p>
                        </div>
                      </div>

                      {/* Iframe Display Settings */}
                      <Card className="border-purple-200 bg-purple-50/50">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-semibold text-purple-800">📱 Iframe Display Settings</CardTitle>
                          <CardDescription className="text-xs">Configure how this offer appears in the offerwall iframe</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label htmlFor="show_in_iframe" className="text-sm font-medium">Show in Iframe</Label>
                              <p className="text-xs text-gray-500">Enable to display this offer in the offerwall</p>
                            </div>
                            <Switch
                              id="show_in_iframe"
                              checked={formData.show_in_iframe !== false}
                              onCheckedChange={(checked) => handleInputChange('show_in_iframe', checked)}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="urgency_type">Urgency Booster (Optional)</Label>
                              <Select value={formData.urgency_type || 'none'} onValueChange={(value) => handleInputChange('urgency_type', value === 'none' ? '' : value)}>
                                <SelectTrigger>
                                  <SelectValue placeholder="No urgency" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">❌ No Urgency</SelectItem>
                                  <SelectItem value="limited_slots">🔥 Limited slots today</SelectItem>
                                  <SelectItem value="high_demand">⚡ High demand</SelectItem>
                                  <SelectItem value="expires_soon">⏰ Expires soon</SelectItem>
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-gray-500 mt-1">Shows urgency badge on offer card</p>
                            </div>
                            <div>
                              <Label htmlFor="timer_enabled">Enable Countdown Timer</Label>
                              <div className="flex items-center gap-2 mt-2">
                                <Switch
                                  id="timer_enabled"
                                  checked={formData.timer_enabled || false}
                                  onCheckedChange={(checked) => handleInputChange('timer_enabled', checked)}
                                />
                                <span className="text-sm text-gray-600">{formData.timer_enabled ? 'Timer ON' : 'Timer OFF'}</span>
                              </div>
                            </div>
                          </div>

                          {formData.timer_enabled && (
                            <div>
                              <Label htmlFor="timer_end_date">Timer End Date & Time</Label>
                              <Input
                                id="timer_end_date"
                                type="datetime-local"
                                value={formData.timer_end_date || ''}
                                onChange={(e) => handleInputChange('timer_end_date', e.target.value)}
                                className="mt-1"
                              />
                              <p className="text-xs text-gray-500 mt-1">Countdown timer will show on offer card until this date</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  )}
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
                      <Label>Device Targeting</Label>
                      <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-gray-50">
                        {[
                          { value: 'all', label: 'All Devices' },
                          { value: 'mobile', label: 'Mobile Only' },
                          { value: 'desktop', label: 'Desktop Only' },
                          { value: 'ios', label: 'iOS' },
                          { value: 'android', label: 'Android' },
                          { value: 'windows', label: 'Windows' },
                          { value: 'mac', label: 'Mac' },
                          { value: 'linux', label: 'Linux' },
                        ].map(device => (
                          <Badge
                            key={device.value}
                            variant={
                              (selectedDevices.length === 0 && device.value === 'all') || selectedDevices.includes(device.value)
                                ? "default"
                                : "outline"
                            }
                            className="cursor-pointer hover:bg-blue-100"
                            onClick={() => {
                              if (device.value === 'all') {
                                setSelectedDevices([]);
                              } else {
                                const updated = selectedDevices.includes(device.value)
                                  ? selectedDevices.filter(d => d !== device.value)
                                  : [...selectedDevices, device.value];
                                setSelectedDevices(updated);
                              }
                            }}
                          >
                            {device.label}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {selectedDevices.length === 0 ? 'All devices targeted' : `Selected: ${selectedDevices.join(', ')}`}
                      </p>
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
                      <Label htmlFor="payout">Payout Amount</Label>
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
                          const payoutType = (formData as any).payout_type || 'fixed';
                          handleInputChange('incentive_type', (payoutType === 'percentage' || revenueShare > 0) ? 'Non-Incent' : 'Incent');
                        }}
                        placeholder="5.00"
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
                          // Auto-calculate incentive type based on payout_type
                          const payoutType = (formData as any).payout_type || 'fixed';
                          handleInputChange('incentive_type', (payoutType === 'percentage' || percent > 0) ? 'Non-Incent' : 'Incent');
                        }}
                        placeholder={((formData as any).payout_type === 'percentage') ? "e.g. 80" : "0"}
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        {(formData as any).payout_type === 'percentage' 
                          ? '⚡ This IS the payout (% of revenue per conversion)' 
                          : '% of upward payout to forward'}
                      </p>
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

            {/* SECTION 3.1: LEVEL-BASED PAYOUTS (Own Tab) */}
            <TabsContent value="levels" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Level-Based Payouts</CardTitle>
                  <CardDescription>Configure different payouts for each conversion stage (Click, Registration, Deposit, Purchase, etc.)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm text-gray-600">Enable level-based payouts to set different amounts for each conversion event.</p>
                      <p className="text-xs text-amber-600 mt-1">💡 Publishers will see 80% of each level payout.</p>
                    </div>
                    <Switch
                      checked={formData.level_payouts_enabled || false}
                      onCheckedChange={(checked) => handleInputChange('level_payouts_enabled', checked)}
                    />
                  </div>

                  {formData.level_payouts_enabled && (
                    <div className="space-y-3">
                      {/* Column headers */}
                      <div className="grid grid-cols-12 gap-2 items-center text-xs text-gray-500 font-medium px-1">
                        <div className="col-span-1">#</div>
                        <div className="col-span-4">Level Name</div>
                        <div className="col-span-3">Payout (Admin)</div>
                        <div className="col-span-3">Type</div>
                        <div className="col-span-1"></div>
                      </div>

                      {(formData.level_payouts_list || []).map((level: any, idx: number) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-1">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-bold">{level.level}</span>
                          </div>
                          <div className="col-span-4">
                            <Input
                              placeholder="e.g. Click, Registration, Deposit"
                              value={level.name}
                              onChange={(e) => {
                                const updated = [...(formData.level_payouts_list || [])];
                                updated[idx] = { ...updated[idx], name: e.target.value };
                                handleInputChange('level_payouts_list', updated);
                              }}
                              className="text-sm"
                            />
                          </div>
                          <div className="col-span-3">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Amount"
                              value={level.payout || ''}
                              onChange={(e) => {
                                const updated = [...(formData.level_payouts_list || [])];
                                updated[idx] = { ...updated[idx], payout: parseFloat(e.target.value) || 0 };
                                handleInputChange('level_payouts_list', updated);
                              }}
                              className="text-sm"
                            />
                          </div>
                          <div className="col-span-3">
                            <Select
                              value={level.type}
                              onValueChange={(val) => {
                                const updated = [...(formData.level_payouts_list || [])];
                                updated[idx] = { ...updated[idx], type: val };
                                handleInputChange('level_payouts_list', updated);
                              }}
                            >
                              <SelectTrigger className="text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="CPC">CPC (Click)</SelectItem>
                                <SelectItem value="CPL">CPL (Lead)</SelectItem>
                                <SelectItem value="CPA">CPA (Action)</SelectItem>
                                <SelectItem value="CPI">CPI (Install)</SelectItem>
                                <SelectItem value="CPS">CPS (Sale)</SelectItem>
                                <SelectItem value="RevShare">RevShare</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const updated = (formData.level_payouts_list || []).filter((_: any, i: number) => i !== idx);
                                handleInputChange('level_payouts_list', updated);
                              }}
                              className="text-red-500 hover:text-red-700 p-1"
                            >
                              ×
                            </Button>
                          </div>
                        </div>
                      ))}

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const list = formData.level_payouts_list || [];
                          const nextLevel = list.length + 1;
                          const defaultNames = ['Click', 'Registration', 'First Deposit', 'Purchase', 'Subscription'];
                          const defaultTypes = ['CPC', 'CPL', 'CPA', 'CPS', 'CPA'];
                          handleInputChange('level_payouts_list', [...list, {
                            level: nextLevel,
                            name: defaultNames[list.length] || `Level ${nextLevel}`,
                            payout: 0,
                            type: defaultTypes[list.length] || 'CPA'
                          }]);
                        }}
                        className="w-full"
                      >
                        + Add Level
                      </Button>

                      {(formData.level_payouts_list || []).length > 0 && (
                        <div className="mt-4 p-3 rounded-lg bg-gray-50 border">
                          <p className="text-xs font-medium text-gray-700 mb-2">Publisher Preview:</p>
                          <div className="space-y-1">
                            {(formData.level_payouts_list || []).filter((l: any) => l.payout > 0).map((level: any, idx: number) => (
                              <div key={idx} className="flex justify-between text-xs">
                                <span className="text-gray-600">Level {level.level}: {level.name} ({level.type})</span>
                                <span className="font-medium text-emerald-600">${(level.payout * 0.8).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {!formData.level_payouts_enabled && (
                    <div className="text-center py-8 text-gray-400">
                      <p className="text-sm">Level payouts are disabled for this offer.</p>
                      <p className="text-xs mt-1">Toggle the switch above to add conversion level tiers.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* SECTION 3.2: GEO-SPLIT PAYOUTS (Own Tab) */}
            <TabsContent value="geosplit" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Geo-Split Payouts</CardTitle>
                  <CardDescription>Set different payout amounts per country. Base payout applies to all other GEOs.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Add new geo payout */}
                  <div className="flex items-end gap-2 p-3 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                    <div className="flex-1">
                      <Label className="text-xs text-gray-500">Country Code</Label>
                      <Input
                        placeholder="e.g. US, CH, NL"
                        value={formData.geo_payout_country || ''}
                        onChange={(e) => handleInputChange('geo_payout_country', e.target.value.toUpperCase().slice(0, 2))}
                        className="text-sm uppercase"
                        maxLength={2}
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs text-gray-500">Payout (Admin)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Amount"
                        value={formData.geo_payout_amount || ''}
                        onChange={(e) => handleInputChange('geo_payout_amount', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="w-32">
                      <Label className="text-xs text-gray-500">Type</Label>
                      <Select value={formData.geo_payout_type || 'CPA'} onValueChange={(v) => handleInputChange('geo_payout_type', v)}>
                        <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CPA">CPA</SelectItem>
                          <SelectItem value="CPL">CPL</SelectItem>
                          <SelectItem value="CPS">CPS</SelectItem>
                          <SelectItem value="CPI">CPI</SelectItem>
                          <SelectItem value="RevShare">RevShare</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        const country = formData.geo_payout_country || '';
                        const amount = parseFloat(String(formData.geo_payout_amount || '0'));
                        const type = formData.geo_payout_type || 'CPA';
                        if (country.length === 2 && amount > 0) {
                          const list = formData.geo_payouts_list || [];
                          const exists = list.find((g: any) => g.country === country);
                          if (exists) {
                            handleInputChange('geo_payouts_list', list.map((g: any) => g.country === country ? { ...g, payout: amount, type } : g));
                          } else {
                            handleInputChange('geo_payouts_list', [...list, { country, payout: amount, type }]);
                          }
                          handleInputChange('geo_payout_country', '');
                          handleInputChange('geo_payout_amount', '');
                        }
                      }}
                      className="bg-violet-600 hover:bg-violet-700 text-white"
                    >
                      Add
                    </Button>
                  </div>

                  {/* Geo payouts list */}
                  {(formData.geo_payouts_list || []).length > 0 ? (
                    <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                      {(formData.geo_payouts_list || []).sort((a: any, b: any) => b.payout - a.payout).map((gp: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 border border-gray-100">
                          <div className="flex items-center gap-2">
                            <img src={`https://flagcdn.com/20x15/${gp.country.toLowerCase()}.png`} alt={gp.country} className="w-5 h-3.5 rounded-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            <span className="font-mono text-sm font-semibold">{gp.country}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-emerald-600">${gp.payout.toFixed(2)}</span>
                            <span className="text-xs text-gray-400">→ ${(gp.payout * 0.8).toFixed(2)} pub</span>
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-100">{gp.type}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleInputChange('geo_payouts_list', (formData.geo_payouts_list || []).filter((_: any, i: number) => i !== idx))}
                              className="text-red-500 hover:text-red-700 h-6 px-2 text-xs"
                            >
                              ×
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <p className="text-sm">No geo-split payouts configured.</p>
                      <p className="text-xs mt-1">Add country-specific payouts above.</p>
                    </div>
                  )}
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
                      value={formData.expiry_date instanceof Date ? formData.expiry_date.toISOString().split('T')[0] : (formData.expiry_date as string || '')}
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
                  <CardTitle>🔒 Offer Visibility & Approval</CardTitle>
                  <CardDescription>Control how and when publishers can access this offer</CardDescription>
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
                        <SelectItem value="auto_approve">
                          <div className="flex items-center gap-2">
                            <span>🟢</span>
                            <span>Direct Access (Immediate)</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="time_based">
                          <div className="flex items-center gap-2">
                            <span>⏰</span>
                            <span>Time-based Auto-Approval</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="manual">
                          <div className="flex items-center gap-2">
                            <span>🔐</span>
                            <span>Manual Approval Required</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    
                    {/* Approval Type Description */}
                    <div className="mt-2 p-3 rounded-lg bg-gray-50 border">
                      {formData.approval_type === 'auto_approve' && (
                        <p className="text-sm text-green-700">
                          <strong>🟢 Direct Access:</strong> Offer will be immediately visible and accessible to all publishers in the iframe and offers section.
                        </p>
                      )}
                      {formData.approval_type === 'time_based' && (
                        <p className="text-sm text-yellow-700">
                          <strong>⏰ Time-based:</strong> Offer will be visible but LOCKED until the specified time passes. Publishers will see a lock icon and countdown timer.
                        </p>
                      )}
                      {formData.approval_type === 'manual' && (
                        <p className="text-sm text-red-700">
                          <strong>🔐 Manual Approval:</strong> Offer will be visible but LOCKED. Publishers must request access and you must manually approve each request from the Offer Requests section.
                        </p>
                      )}
                    </div>
                  </div>

                  {formData.approval_type === 'time_based' && (
                    <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg space-y-3">
                      <Label htmlFor="auto_approve_delay" className="text-yellow-800 font-semibold">
                        ⏰ Auto-approve Delay
                      </Label>
                      
                      {/* Quick preset buttons */}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant={formData.auto_approve_delay === 30 ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleInputChange('auto_approve_delay', 30)}
                        >
                          30 min
                        </Button>
                        <Button
                          type="button"
                          variant={formData.auto_approve_delay === 60 ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleInputChange('auto_approve_delay', 60)}
                        >
                          1 hour
                        </Button>
                        <Button
                          type="button"
                          variant={formData.auto_approve_delay === 360 ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleInputChange('auto_approve_delay', 360)}
                        >
                          6 hours
                        </Button>
                        <Button
                          type="button"
                          variant={formData.auto_approve_delay === 720 ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleInputChange('auto_approve_delay', 720)}
                        >
                          12 hours
                        </Button>
                        <Button
                          type="button"
                          variant={formData.auto_approve_delay === 1440 ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleInputChange('auto_approve_delay', 1440)}
                        >
                          1 day
                        </Button>
                        <Button
                          type="button"
                          variant={formData.auto_approve_delay === 4320 ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleInputChange('auto_approve_delay', 4320)}
                        >
                          3 days
                        </Button>
                        <Button
                          type="button"
                          variant={formData.auto_approve_delay === 10080 ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleInputChange('auto_approve_delay', 10080)}
                        >
                          7 days
                        </Button>
                      </div>
                      
                      {/* Custom input with unit selector */}
                      <div className="flex gap-2 items-center flex-wrap">
                        <span className="text-sm text-yellow-700">Or custom:</span>
                        <Input
                          id="auto_approve_delay_value"
                          type="number"
                          min="1"
                          value={
                            (formData as any).auto_approve_delay_unit === 'days' 
                              ? Math.floor((formData.auto_approve_delay || 60) / 1440)
                              : (formData as any).auto_approve_delay_unit === 'hours'
                                ? Math.floor((formData.auto_approve_delay || 60) / 60)
                                : (formData.auto_approve_delay || 60)
                          }
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 1;
                            const unit = (formData as any).auto_approve_delay_unit || 'minutes';
                            let minutes = value;
                            if (unit === 'hours') minutes = value * 60;
                            if (unit === 'days') minutes = value * 1440;
                            handleInputChange('auto_approve_delay', minutes);
                          }}
                          placeholder="60"
                          className="w-20"
                        />
                        <Select
                          value={(formData as any).auto_approve_delay_unit || 'minutes'}
                          onValueChange={(unit) => {
                            // Convert current value to new unit
                            const currentMinutes = formData.auto_approve_delay || 60;
                            handleInputChange('auto_approve_delay_unit', unit);
                            // Keep the same total time, just change display unit
                          }}
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="minutes">Minutes</SelectItem>
                            <SelectItem value="hours">Hours</SelectItem>
                            <SelectItem value="days">Days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="bg-yellow-100 p-2 rounded text-sm text-yellow-800">
                        <strong>Current setting:</strong> Offer will auto-unlock after{' '}
                        {formData.auto_approve_delay >= 1440 
                          ? `${Math.floor(formData.auto_approve_delay / 1440)} day(s) ${formData.auto_approve_delay % 1440 > 0 ? `${Math.floor((formData.auto_approve_delay % 1440) / 60)} hour(s)` : ''}`
                          : formData.auto_approve_delay >= 60
                            ? `${Math.floor(formData.auto_approve_delay / 60)} hour(s) ${formData.auto_approve_delay % 60 > 0 ? `${formData.auto_approve_delay % 60} min` : ''}`
                            : `${formData.auto_approve_delay} minutes`
                        }
                      </div>
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="require_approval"
                      checked={formData.require_approval || false}
                      onCheckedChange={(checked) => handleInputChange('require_approval', checked)}
                    />
                    <Label htmlFor="require_approval">Always require manual approval (override)</Label>
                  </div>
                  <p className="text-xs text-gray-500">
                    When enabled, this overrides the approval type and always requires manual admin approval
                  </p>

                  <div>
                    <Label htmlFor="approval_message">Custom Lock Message (Optional)</Label>
                    <Textarea
                      id="approval_message"
                      value={formData.approval_message || ''}
                      onChange={(e) => handleInputChange('approval_message', e.target.value)}
                      placeholder="Enter a custom message shown to publishers when the offer is locked..."
                      rows={3}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This message will be displayed on the lock overlay when publishers view this offer
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
                      <div className="flex gap-2">
                        <Input
                          id="image_url"
                          type="url"
                          value={formData.image_url || ''}
                          onChange={(e) => handleInputChange('image_url', e.target.value)}
                          placeholder="https://example.com/image.jpg"
                          className="flex-1"
                        />
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button type="button" size="sm" variant="outline" className="h-9 px-2 shrink-0" title="AI Image Generator">
                              <ImageIcon className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[500px] p-3" align="end">
                            <ImagePickerComponent
                              offerName={formData.name || 'New Offer'}
                              vertical={formData.vertical}
                              onImageSelected={(url) => handleInputChange('image_url', url)}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
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

              {/* Fallback Redirect Section */}
              <Card className="border-orange-200 bg-orange-50/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-orange-800">
                    <Clock className="h-5 w-5" />
                    Fallback Redirect with Timer
                  </CardTitle>
                  <CardDescription>
                    Redirect users to a fallback URL after a specified time. Useful for time-limited offers or backup redirects.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="fallback_redirect_enabled"
                      checked={fallbackRedirect.enabled}
                      onCheckedChange={(checked) => setFallbackRedirect(prev => ({ ...prev, enabled: checked }))}
                    />
                    <Label htmlFor="fallback_redirect_enabled" className="font-medium">
                      Enable Fallback Redirect
                    </Label>
                  </div>

                  {fallbackRedirect.enabled && (
                    <div className="space-y-4 pt-2">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Fallback URL */}
                        <div className="md:col-span-2 space-y-2">
                          <Label htmlFor="fallback_redirect_url">Fallback URL *</Label>
                          <Input
                            id="fallback_redirect_url"
                            value={fallbackRedirect.url}
                            onChange={(e) => setFallbackRedirect(prev => ({ ...prev, url: e.target.value }))}
                            placeholder="https://example.com/fallback"
                            className="bg-white"
                          />
                          <p className="text-xs text-gray-500">URL to redirect users to after the timer expires</p>
                        </div>

                        {/* Timer in Seconds */}
                        <div className="space-y-2">
                          <Label htmlFor="fallback_redirect_timer">Timer (seconds) *</Label>
                          <Input
                            id="fallback_redirect_timer"
                            type="number"
                            min="1"
                            max="3600"
                            value={fallbackRedirect.timer}
                            onChange={(e) => setFallbackRedirect(prev => ({ ...prev, timer: Number(e.target.value) }))}
                            className="bg-white"
                          />
                          <p className="text-xs text-gray-500">Time before redirect (1-3600 seconds)</p>
                        </div>
                      </div>

                      {/* Timer Preview */}
                      <div className="p-3 bg-orange-100 rounded-lg border border-orange-200">
                        <div className="flex items-center gap-2 text-orange-800">
                          <Clock className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            Preview: User will be redirected to fallback URL after {fallbackRedirect.timer} second{fallbackRedirect.timer !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {fallbackRedirect.url && (
                          <p className="text-xs text-orange-600 mt-1 truncate">
                            → {fallbackRedirect.url}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
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
                  {/* Traffic Source Rules - Auto-generated based on category */}
                  <TrafficSourceDisplay
                    category={formData.vertical || 'OTHER'}
                    country={selectedAllowedCountries.length === 1 ? selectedAllowedCountries[0] : undefined}
                    initialRules={trafficSourceRules}
                    editable={true}
                    onRulesChange={handleTrafficSourceRulesChange}
                  />

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

          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => handleEmailToggle(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-muted-foreground">Send email notification to publishers</span>
              </label>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Offer'}
                </Button>
              </div>
            </div>
            {sendEmail && (
              <div className="space-y-2 p-3 bg-muted/30 rounded-lg border">
                {/* Send Now vs Schedule */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">When to send?</Label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEmailSendMode('now')}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${emailSendMode === 'now' ? 'bg-green-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                      🚀 Send Immediately
                    </button>
                    <button type="button" onClick={() => setEmailSendMode('schedule')}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${emailSendMode === 'schedule' ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                      📅 Schedule for Later
                    </button>
                  </div>
                  {emailSendMode === 'schedule' && (
                    <div className="flex gap-2 mt-2">
                      <Input type="date" value={emailScheduleDate} onChange={e => setEmailScheduleDate(e.target.value)} className="h-8 text-xs w-40" />
                      <Input type="time" value={emailScheduleTime} onChange={e => setEmailScheduleTime(e.target.value)} className="h-8 text-xs w-32" />
                    </div>
                  )}
                </div>

                {/* Already Scheduled Emails */}
                {scheduledEmails.length > 0 && (
                  <div className="space-y-1.5 p-2 bg-amber-50 dark:bg-amber-950/20 rounded border border-amber-200 dark:border-amber-800">
                    <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">⚠️ Already scheduled emails in queue:</p>
                    <div className="max-h-24 overflow-y-auto space-y-1">
                      {scheduledEmails.map(s => (
                        <div key={s._id} className="text-[10px] text-amber-600 dark:text-amber-500 flex items-center justify-between">
                          <span className="truncate flex-1">{s.subject || 'No subject'}</span>
                          <span className="shrink-0 ml-2">{s.scheduled_at ? new Date(s.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-xs">Email Subject (optional — auto-generated if empty)</Label>
                  <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="🚀 Happy Monday! New Offer: {offer_name} - Push More Traffic!" className="mt-1 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Email Message (optional — shown above offer card)</Label>
                  <Textarea value={emailMessage} onChange={e => setEmailMessage(e.target.value)} placeholder="Please push more traffic on this offer!" rows={2} className="mt-1 text-sm" />
                </div>

                {/* Include/Exclude Users */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Recipients</Label>
                  <div className="flex gap-2">
                    {(['all', 'include', 'exclude'] as const).map(mode => (
                      <button key={mode} type="button" onClick={() => {
                        setRecipientMode(mode);
                        if (mode !== 'all' && availableUsers.length === 0) {
                          const token = localStorage.getItem('token');
                          fetch(`${API_BASE_URL}/api/auth/admin/users`, {
                            headers: { Authorization: `Bearer ${token}` }
                          }).then(r => r.json()).then(d => setAvailableUsers(d.users || [])).catch(() => {});
                        }
                      }}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${recipientMode === mode ? 'bg-purple-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                        {mode === 'all' ? '📧 All Publishers' : mode === 'include' ? '✅ Include Only' : '❌ Exclude'}
                      </button>
                    ))}
                  </div>
                  {recipientMode !== 'all' && (
                    <div className="space-y-1.5">
                      <Input
                        value={userSearchInput}
                        onChange={e => setUserSearchInput(e.target.value)}
                        placeholder={`Filter users to ${recipientMode}...`}
                        className="h-8 text-xs"
                      />
                      <div className="max-h-40 overflow-y-auto border rounded-lg bg-background">
                        {availableUsers.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-muted-foreground text-center">Loading users...</div>
                        ) : (
                          availableUsers
                            .filter(u => !userSearchInput || u.username.toLowerCase().includes(userSearchInput.toLowerCase()) || u.email.toLowerCase().includes(userSearchInput.toLowerCase()))
                            .slice(0, 50)
                            .map(u => {
                              const list = recipientMode === 'include' ? includeUserIds : excludeUserIds;
                              const isSelected = list.includes(u._id);
                              return (
                                <button key={u._id} type="button"
                                  className={`w-full text-left px-2 py-1.5 text-xs hover:bg-muted flex items-center justify-between border-b border-border/30 last:border-0 ${isSelected ? 'bg-purple-50 dark:bg-purple-950/20' : ''}`}
                                  onClick={() => {
                                    if (recipientMode === 'include') {
                                      setIncludeUserIds(prev => isSelected ? prev.filter(id => id !== u._id) : [...prev, u._id]);
                                    } else {
                                      setExcludeUserIds(prev => isSelected ? prev.filter(id => id !== u._id) : [...prev, u._id]);
                                    }
                                  }}>
                                  <span className="flex items-center gap-2">
                                    <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${isSelected ? 'bg-purple-600 border-purple-600 text-white' : 'border-gray-300'}`}>
                                      {isSelected && '✓'}
                                    </span>
                                    <span>{u.username}</span>
                                    <span className="text-muted-foreground">({u.email})</span>
                                  </span>
                                </button>
                              );
                            })
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {recipientMode === 'include' ? `${includeUserIds.length} users selected to receive email` : `${excludeUserIds.length} users excluded from email`}
                      </p>
                    </div>
                  )}
                </div>

                <EmailSettingsPanel settings={emailSettings} onChange={setEmailSettings} compact />
              </div>
            )}
          </div>
        </form >
      </DialogContent >
    </Dialog >
  );
};
