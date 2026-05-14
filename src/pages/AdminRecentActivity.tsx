import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { BulkMailScheduler, QueueItem } from '@/components/BulkMailScheduler';
import { RefreshCw, Search, Clock, Mail, ChevronDown, ChevronRight, Activity, MapPin, Globe, FileText, Send, MoreVertical, AlertTriangle, User, PauseCircle, ShieldAlert, XCircle, CheckCircle, BarChart3, Users, CalendarClock, Filter, Plus, Minus, Zap, ExternalLink, Settings, LogIn, ShieldCheck, MessageSquare, Package, Phone, MousePointerClick, Monitor, Fingerprint, AlertCircle } from 'lucide-react';
import loginLogsService, { LoginLog } from '@/services/loginLogsService';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { AdminPageGuard } from '@/components/AdminPageGuard';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import UserIntelligenceProfile from '@/components/UserIntelligenceProfile';
import { BulkOfferAutomationDialog } from '@/components/BulkOfferAutomationDialog';
import { OfferQueueDashboardModal } from '@/components/OfferQueueDashboardModal';
import { AutomationQueueDashboardModal } from '@/components/AutomationQueueDashboardModal';
import { SmartMessagePanel } from '@/components/SmartMessagePanel';
import { SupportHubContent } from './AdminSupportHub';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const COUNTRY_COORDS: Record<string, [number, number]> = {
  'IN': [20.5937, 78.9629],
  'BD': [23.6850, 90.3563],
  'US': [37.0902, -95.7129],
  'GB': [55.3781, -3.4360],
  'PK': [30.3753, 69.3451],
  'XX': [0, 0],
  'INDIA': [20.5937, 78.9629],
  'BANGLADESH': [23.6850, 90.3563],
  'LOCAL/INDIA': [20.5937, 78.9629],
  'UK': [55.3781, -3.4360],
  'CA': [56.1304, -106.3468], 'AU': [-25.2744, 133.7751], 'DE': [51.1657, 10.4515], 'FR': [46.2276, 2.2137],
  'JP': [36.2048, 138.2529], 'CN': [35.8617, 104.1954], 'BR': [-14.2350, -51.9253], 'RU': [61.5240, 105.3188],
  'ZA': [-30.5595, 22.9375], 'NG': [9.0820, 8.6753], 'KE': [-0.0236, 37.9062], 'SG': [1.3521, 103.8198],
  'MY': [4.2105, 101.9758], 'ID': [-0.7893, 113.9213], 'PH': [12.8797, 121.7740], 'VN': [14.0583, 108.2772],
  'TH': [15.8700, 100.9925], 'KR': [35.9078, 127.7669], 'ES': [40.4637, -3.7492], 'IT': [41.8719, 12.5674],
  'NL': [52.1326, 5.2913], 'CH': [46.8182, 8.2275], 'SE': [60.1282, 18.6435], 'NO': [60.4720, 8.4689],
  'DK': [56.2639, 9.5018], 'FI': [61.9241, 25.7482], 'PL': [51.9194, 19.1451], 'UA': [48.3794, 31.1656],
  'TR': [38.9637, 35.2433], 'EG': [26.8206, 30.8025], 'SA': [23.8859, 45.0792], 'AE': [23.4241, 53.8478],
  'IL': [31.0461, 34.8516], 'MX': [23.6345, -102.5528], 'AR': [-38.4161, -63.6167], 'CO': [4.5709, -74.2973],
  'PE': [-9.1900, -75.0152], 'CL': [-35.6751, -71.5430], 'NZ': [-40.9006, 174.8860],
  'LK': [7.8731, 80.7718], 'NP': [28.3949, 84.1240], 'RO': [45.9432, 24.9668],
  // Full name fallbacks
  'UNITED STATES': [37.0902, -95.7129],
  'UNITED KINGDOM': [55.3781, -3.4360], 'HONG KONG': [22.3193, 114.1694], 'GLOBAL': [0, 0]
};

// Common Sense City Fallbacks for high-traffic regions
const CITY_COORDS: Record<string, [number, number]> = {
  'LUCKNOW': [26.8467, 80.9462],
  'PITHAMPUR': [22.6111, 75.6791],
  'JESSORE': [23.1667, 89.2167],
  'BILASPUR': [22.0790, 82.1391],
  'DEHRADUN': [30.3165, 78.0322],
  'AGRA': [27.1767, 78.0081],
  'DHAKA': [23.8103, 90.4125],
  'KOLKATA': [22.5726, 88.3639],
  'MUMBAI': [19.0760, 72.8777],
  'DELHI': [28.6139, 77.2090],
  'BANGALORE': [12.9716, 77.5946],
  'HYDERABAD': [17.3850, 78.4867],
  'CHENNAI': [13.0827, 80.2707],
  'PUNE': [18.5204, 73.8567],
  'AHMEDABAD': [23.0225, 72.5714],
  'CHITTAGONG': [22.3569, 91.7832],
  'SYLHET': [24.8949, 91.8687],
  'RAJSHAHI': [24.3745, 88.6042],
  'DEORI': [21.4500, 82.6100]
};

const ABBREVIATIONS = ['CPA', 'CPI', 'CPL', 'CPS', 'CRYPTO', 'ROI', 'EPC', 'AI', 'GPT'];

const normalizeVertical = (v: string) => {
  const str = String(v || '').trim();
  if (!str) return '';
  const upper = str.toUpperCase();
  if (ABBREVIATIONS.includes(upper)) return upper;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

const parseVerticals = (raw: any): string[] => {
  if (!raw) return [];
  let list: string[] = [];
  
  const process = (val: any) => {
    if (!val) return;
    if (Array.isArray(val)) {
      val.forEach(v => process(v));
    } else if (typeof val === 'string') {
      val.split(',').forEach(s => {
        const trimmed = s.trim();
        if (trimmed) list.push(trimmed);
      });
    } else if (typeof val === 'object') {
      // Handle maps/objects (e.g., { "INSURANCE": 5 }) by taking keys
      Object.keys(val).forEach(k => {
        if (k && k !== '_id' && k !== 'updated_at') {
          list.push(k.trim());
        }
      });
    } else {
      list.push(String(val).trim());
    }
  };

  process(raw);
  return Array.from(new Set(list.map(v => normalizeVertical(v)).filter(Boolean)));
};

const getLocationString = (log: any) => {
  if (!log) return "Unknown";
  const city = getCity(log);
  const country = getCountry(log);

  if (city !== 'Unknown' && country !== 'Unknown') return `${city}, ${country}`;
  if (country !== 'Unknown') return country;
  if (city !== 'Unknown') return city;
  return "Unknown";
};

const getCountry = (log: any, profile?: any) => {
  const ip = log?.ip_address || log?.ip || log?.location?.ip || '';

  // 1. Try to get from log.location object
  if (log && log.location && typeof log.location !== 'string') {
    const loc = log.location;
    const countryVal = loc.country_name || loc.country || loc.country_code;
    if (countryVal && countryVal !== 'Unknown' && countryVal !== 'XX' && countryVal !== 'Location Tracking...') {
      if (countryVal.length > 2) return countryVal;
      try {
        const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
        return regionNames.of(countryVal.toUpperCase()) || countryVal;
      } catch (e) { return countryVal; }
    }
  }

  // 2. Strong IP Pattern Matching (Reliable Fallback)
  if (ip) {
    const cleanIp = ip.trim().replace('::ffff:', '');

    // Localhost / Private IP Handling - Map internal testing directly to India/System
    if (cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp === '0.0.0.0' ||
      cleanIp.startsWith('192.168.') || cleanIp.startsWith('10.') || cleanIp.startsWith('172.')) {
      return 'Local/India';
    }

    // 🇧🇩 Bangladesh: High Priority Specific Ranges
    if (cleanIp.startsWith('103.232') || cleanIp.startsWith('119.') || cleanIp.startsWith('27.147') ||
      cleanIp.startsWith('43.231') || cleanIp.startsWith('45.115') || cleanIp.startsWith('203.112') ||
      cleanIp.startsWith('103.242') || cleanIp.startsWith('103.197') || cleanIp.startsWith('103.147') ||
      cleanIp.startsWith('103.230') || cleanIp.startsWith('103.151')) return 'Bangladesh';

    // 🇮🇳 India: Expanded ranges
    if (cleanIp.startsWith('106.') || cleanIp.startsWith('115.') || cleanIp.startsWith('122.') ||
      cleanIp.startsWith('157.') || cleanIp.startsWith('182.') || cleanIp.startsWith('49.') ||
      cleanIp.startsWith('124.') || cleanIp.startsWith('117.') || cleanIp.startsWith('27.') ||
      cleanIp.startsWith('223.') || cleanIp.startsWith('103.') || cleanIp.startsWith('203.') ||
      cleanIp.startsWith('101.') || cleanIp.startsWith('110.') || cleanIp.startsWith('111.')) return 'India';

    // 🇺🇸 US / 🇬🇧 UK
    if (cleanIp.startsWith('104.') || cleanIp.startsWith('107.') || cleanIp.startsWith('108.') ||
      cleanIp.startsWith('34.') || cleanIp.startsWith('35.') || cleanIp.startsWith('52.') ||
      cleanIp.startsWith('13.') || cleanIp.startsWith('23.')) return 'United States';
    if (cleanIp.startsWith('31.') || cleanIp.startsWith('51.') || cleanIp.startsWith('62.') ||
      cleanIp.startsWith('25.')) return 'United Kingdom';
    if (cleanIp.startsWith('41.')) return 'Nigeria';
    if (cleanIp.startsWith('197.')) return 'Egypt';
  }

  // 3. Profile Fallback
  if (profile && profile.geos && profile.geos.length > 0) {
    const code = profile.geos[0];
    if (code === 'WW') return 'Global';
    try {
      const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
      return regionNames.of(code.toUpperCase()) || code;
    } catch (e) { return code; }
  }

  return "Tracking...";
};


const getCity = (log: any, profile?: any) => {
  if (log && log.location && typeof log.location !== 'string') {
    if (log.location.city && log.location.city !== 'Unknown') return log.location.city;
  }

  const ip = log?.ip_address || log?.ip || log?.location?.ip || '';
  if (ip) {
    // Specific city hints for common IPs in the system
    if (ip.startsWith('103.232.')) return 'Dhaka';
    if (ip.startsWith('103.147.')) return 'Chittagong';
    if (ip.startsWith('106.213.') || ip.startsWith('106.208.')) return 'Bhopal';
    if (ip.startsWith('106.192.')) return 'Indore';
    if (ip.startsWith('157.34.')) return 'Indore';
  }

  if (profile && profile.city && profile.city !== 'Unknown') return profile.city;

  return "";
};

const getLatLng = (locationObj: any, logObj: any, userProfile: any) => {
  let lat: number | undefined;
  let lng: number | undefined;

  lat = locationObj?.latitude !== undefined && locationObj?.latitude !== null ? Number(locationObj.latitude) : undefined;
  lng = locationObj?.longitude !== undefined && locationObj?.longitude !== null ? Number(locationObj.longitude) : undefined;

  const city = (locationObj?.city || logObj?.city || '').toUpperCase();
  if ((!lat || !lng || lat === 0) && city && CITY_COORDS[city]) {
    const cityFallback = CITY_COORDS[city];
    const seed = String(logObj?.user_id || logObj?.username || 'fixed');
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i);

    const cityJitter = 0.5;
    lat = cityFallback[0] + ((Math.abs(hash) % 1000) / 1000 - 0.5) * cityJitter;
    lng = cityFallback[1] + ((Math.abs(hash * 31) % 1000) / 1000 - 0.5) * cityJitter;
    return { lat, lng };
  }

  if (lat === undefined || lng === undefined || (lat === 0 && lng === 0) || isNaN(lat) || isNaN(lng)) {
    let countryCode = locationObj?.country_code || locationObj?.country;

    let countryName = '';
    if (!countryCode) {
      countryName = getCountry(logObj, userProfile);
      if (countryName === 'India' || countryName === 'Local/India' || countryName.includes('India')) countryCode = 'IN';
      else if (countryName === 'Bangladesh' || countryName.includes('Bangladesh')) countryCode = 'BD';
      else if (countryName === 'United States' || countryName === 'US') countryCode = 'US';
      else if (countryName === 'United Kingdom' || countryName === 'UK') countryCode = 'GB';
    }

    if (!countryCode || countryCode === 'Unknown' || countryCode === 'Tracking...' || countryCode === 'Location Tracking...') {
      const raw = String(countryName || getCountry(logObj, userProfile) || '').toUpperCase();
      if (raw.includes('INDIA')) countryCode = 'IN';
      else if (raw.includes('BANGLADESH')) countryCode = 'BD';
      else if (raw.includes('UNITED STATES') || raw.includes('US')) countryCode = 'US';
      else if (raw.includes('UNITED KINGDOM') || raw.includes('UK')) countryCode = 'GB';
      else countryCode = 'XX';
    }

    if (countryCode && typeof countryCode === 'string') {
      const upper = countryCode.toUpperCase();
      const fallback = COUNTRY_COORDS[upper] || COUNTRY_COORDS['IN'];
      
      if (fallback) {
        const seed = String(logObj?.user_id || logObj?.username || 'fixed');
        let hash = 0;
        for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i);

        // Substantially reduced jitter for better visual accuracy
        const countryJitter = 0.8; 
        lat = fallback[0] + ((Math.abs(hash) % 1000) / 1000 - 0.5) * countryJitter;
        lng = fallback[1] + ((Math.abs(hash * 31) % 1000) / 1000 - 0.5) * countryJitter;
      }
    }
  }

  return { lat, lng };
};

interface AggregatedUser {
  user_id: string;
  username: string;
  email: string;
  latest_login: string;
  login_count: number;
  logs: LoginLog[];
  first_name?: string;
  last_name?: string;
  lat?: number;
  lng?: number;
  country?: string;
  city?: string;
  isSuspicious: boolean;
  hasDifferentLocations?: boolean;
  isPaused?: boolean;
  welcomeMailSentAt?: string;
  referralMailSentAt?: string;
  totalMails: number;
  sharedAccount?: boolean;
  hasNewDevice?: boolean;
  failedLogin?: boolean;
  verticals?: string[];
  geoPreferences?: string[];
  hasSearchActivity?: boolean;
  account_status?: string;
  role?: string;
  approvedCount?: number;
  requestedCount?: number;
  rejectedCount?: number;
  clickCount?: number;
  viewedCount?: number;
}

interface AdvancedFilters {
  geos: string[];
  cities: string[];
  geoPreferences: string[];
  verticals: string[];
  status: string[];
  loginCount: string;
  mailStatus: string[];
  countries: string[];
  activityStatus: string;
}



const ExpandedUserDetails: React.FC<{
  user: AggregatedUser;
  automationQueueItem?: any;
  onMailSent?: () => void;
  onAutomateOffers?: (userId: string) => void;
}> = ({ user, automationQueueItem, onMailSent, onAutomateOffers }) => {
  const [pageVisits, setPageVisits] = useState<any[]>([]);
  const [offerViews, setOfferViews] = useState<any[]>([]);
  const [searchLogs, setSearchLogs] = useState<any[]>([]);
  const [signals, setSignals] = useState<any>(null);
  const [offerTargeting, setOfferTargeting] = useState<any>({});
  const [scheduledActivity, setScheduledActivity] = useState<any[]>([]);
  const [automation, setAutomation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('login');
  const handleQuickAction = (tab: string) => {
    setActiveTab(tab);
    setTimeout(() => {
      document.getElementById('intelligence-dashboard')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  };

  const [scheduleMailOpen, setScheduleMailOpen] = useState(false);
  const [scheduleType, setScheduleType] = useState<'welcome' | 'referral' | 'warning' | string>('welcome');
  const [scheduleTime, setScheduleTime] = useState("");
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const sendSingleMail = async (type: 'welcome' | 'referral' | 'warning' | string, time?: string) => {
    setIsSending(true);
    let subject = '';
    let body = '';
    if (type === 'welcome') {
      subject = 'Welcome to Moustache Leads! 🚀';
      body = `Hey there! Welcome ${user.username} 😊<br/><br/>Here’s our Teams link — feel free to join anytime. We’re there to help you with offers, tracking, or anything you need:<br/><a href="https://teams.live.com/l/invite/FEAkABBHjfqCMqxtR8?v=g1">https://teams.live.com/l/invite/FEAkABBHjfqCMqxtR8?v=g1</a><br/><br/>You can also ask questions anytime — we’re happy to help.<br/>By the way, what traffic sources are you currently working with?<br/><br/>Please set up your placement and postback here:<br/><a href="https://www.moustacheleads.com/dashboard/placements">https://www.moustacheleads.com/dashboard/placements</a><br/><br/>If you need help, reach us on Teams or Telegram: @mlaffil<br/>Support is also available here:<br/><a href="https://www.moustacheleads.com/dashboard/support">https://www.moustacheleads.com/dashboard/support</a><br/><br/>Looking forward to working with you! 🚀<br/><br/>Best regards,<br/>Team Moustache Leads`;
    } else if (type === 'referral') {
      subject = 'Have you seen our Referral Program?';
      body = `Hey ${user.username}<br/><br/>Hope you're doing well 😊<br/><br/>Just wanted to check — have you had a chance to look at our referral program?<br/><br/>If yes, we’d love to hear your thoughts. And if you have any doubts or need clarity on anything, feel free to share — we’re happy to help.<br/><br/>Looking forward to your response!<br/><br/>Best regards,<br/>Team Moustache Leads`;
    } else if (type === 'warning') {
      subject = 'Important Notice Regarding Your Account Activity';
      body = `Hey ${user.username},<br/><br/>We have detected some unusual activity on your account recently.<br/>Please review your account security and ensure your postbacks are set up correctly.<br/>If you have any questions or believe this is an error, please reach out to support immediately.<br/><br/>Best regards,<br/>Team Moustache Leads`;
    } else if (type === 'welcome_referral') {
      subject = 'Welcome to Moustache Leads & Our Referral Program! 🚀';
      body = `Hey there! Welcome ${user.username} 😊<br/><br/>Here’s our Teams link — feel free to join anytime. We’re there to help you with offers, tracking, or anything you need:<br/><a href="https://teams.live.com/l/invite/FEAkABBHjfqCMqxtR8?v=g1">https://teams.live.com/l/invite/FEAkABBHjfqCMqxtR8?v=g1</a><br/><br/>You can also ask questions anytime — we’re happy to help.<br/>By the way, what traffic sources are you currently working with?<br/><br/>Please set up your placement and postback here:<br/><a href="https://www.moustacheleads.com/dashboard/placements">https://www.moustacheleads.com/dashboard/placements</a><br/><br/>If you need help, reach us on Teams or Telegram: @mlaffil<br/>Support is also available here:<br/><a href="https://www.moustacheleads.com/dashboard/support">https://www.moustacheleads.com/dashboard/support</a><br/><br/>Also, have you had a chance to look at our referral program? If yes, we’d love to hear your thoughts. And if you have any doubts or need clarity on anything, feel free to share — we’re happy to help.<br/><br/>Looking forward to working with you! 🚀<br/><br/>Best regards,<br/>Team Moustache Leads`;
    }

    try {
      await loginLogsService.sendCustomMail([user.email], subject, body, time ? new Date(time).toISOString() : undefined);
      toast({
        title: time ? 'Mail Scheduled' : 'Mail Sent',
        description: `Successfully ${time ? 'scheduled' : 'sent'} ${type} mail to ${user.username}.`
      });
      setScheduleMailOpen(false);
      if (onMailSent) onMailSent();
    } catch (e) {
      console.error(`Failed to send mail to ${user.email}`, e);
      toast({ title: 'Error', description: 'Failed to send mail', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const [offRes, searchRes, signalsRes, offerTargetingRes, scheduledRes, automationRes] = await Promise.all([
        loginLogsService.getOfferViews(user.user_id, 20, user.username, user.email).catch(() => ({ views: [] })),
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/search-logs?user=${user.user_id}&username=${user.username}&email=${user.email}&per_page=10`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.json()).catch(() => ({ logs: [] })),
        loginLogsService.getUserSignals(user.user_id, user.username, user.email).catch(() => null),
        loginLogsService.getInventoryMatchedOffers(user.user_id).catch(() => ({})),
        loginLogsService.getScheduledActivity(user.user_id).catch(() => ([])),
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/automation/queue/${user.user_id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()).catch(() => ({ item: null }))
      ]);

      setOfferViews(offRes?.views || []);
      setSearchLogs(searchRes?.logs || []);
      setSignals(signalsRes);
      setOfferTargeting(offerTargetingRes);
      setScheduledActivity(scheduledRes?.scheduled_activity || scheduledRes?.activities || (Array.isArray(scheduledRes) ? scheduledRes : []));
      setAutomation(automationRes?.item || automationRes);

      const latestSessionId = user.logs.find(l => l.session_id)?.session_id;
      if (latestSessionId) {
        const pvRes = await loginLogsService.getPageVisits(latestSessionId, 10).catch(() => ({ visits: [] }));
        setPageVisits(pvRes?.visits || []);
      }
    } catch (e) {
      console.error("Error fetching detailed user data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user.user_id]);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading real user data...</div>;
  }

  const mockLog = user.logs.length > 0 ? user.logs[0] : {
    _id: user.user_id,
    username: user.username,
    email: user.email,
    login_time: user.latest_login,
    location: { city: 'Unknown', country: user.country || 'Unknown' },
    ip_address: '0.0.0.0',
    device: { type: 'desktop', os: 'Windows', browser: 'Chrome' },
    status: user.isSuspicious ? 'suspicious' : 'success'
  };

  return (
    <div className="p-4 md:p-6 bg-slate-50/50 rounded-b-xl border-t border-slate-100">
      <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-8 mb-6">
        <div>
          <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Sessions in Range</h4>
          {user.logs.slice(0, 5).map((log: any, idx: number) => (
            <div key={idx} className="flex justify-between items-center text-xs py-1.5 border-b last:border-0 border-slate-100">
              <span className="font-medium text-foreground">{new Date(log.login_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="text-muted-foreground text-[11px]">{log.ip_address}</span>
              <span className="text-muted-foreground text-[11px]">
                {log.ip_address === '127.0.0.1' || log.ip_address === '::1' ? 'Localhost' : (() => {
                  if (typeof log.location === 'string') return log.location !== 'Unknown' ? log.location : (user.country || 'Unknown');
                  const validCity = log.location?.city && log.location.city !== 'Unknown' ? log.location.city : null;
                  const validCountry = log.location?.country && log.location.country !== 'Unknown' ? log.location.country : null;
                  const validCountryCode = log.location?.country_code && log.location.country_code !== 'Unknown' ? log.location.country_code : null;

                  if (validCity && validCountry) return `${validCity}, ${validCountry}`;
                  if (validCity) return validCity;
                  if (validCountry) return validCountry;
                  if (validCountryCode) return validCountryCode;

                  return user.country || 'Unknown Location';
                })()}
              </span>
            </div>
          ))}
        </div>
        <div>
          <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</h4>
          <div className="flex flex-wrap gap-2">
            <Badge onClick={() => handleQuickAction('activity')} variant="secondary" className="cursor-pointer hover:bg-blue-50 hover:text-blue-600 bg-blue-50/50 text-blue-600 font-normal rounded-full px-3 py-1">Page visits</Badge>
            <Badge onClick={() => handleQuickAction('browsing')} variant="secondary" className="cursor-pointer hover:bg-blue-50 hover:text-blue-600 bg-blue-50/50 text-blue-600 font-normal rounded-full px-3 py-1">Offer views</Badge>
            <Badge onClick={() => handleQuickAction('activity')} variant="secondary" className="cursor-pointer hover:bg-blue-50 hover:text-blue-600 bg-blue-50/50 text-blue-600 font-normal rounded-full px-3 py-1">Search logs</Badge>
            <Badge onClick={() => handleQuickAction('reco')} variant="secondary" className="cursor-pointer bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-100 shadow-sm rounded-full px-3 py-1"><Activity className="w-3 h-3 mr-1" /> AI Profile</Badge>
            <Badge onClick={() => sendSingleMail('welcome')} variant="secondary" className="cursor-pointer bg-green-50 hover:bg-green-100 text-green-700 font-normal rounded-full px-3 py-1">Welcome mail</Badge>
            <Badge onClick={() => sendSingleMail('referral')} variant="secondary" className="cursor-pointer bg-green-50 hover:bg-green-100 text-green-700 font-normal rounded-full px-3 py-1">Referral mail</Badge>
            <Badge onClick={() => sendSingleMail('warning')} variant="secondary" className="cursor-pointer bg-red-50 hover:bg-red-100 text-red-700 font-normal rounded-full px-3 py-1">Warn user</Badge>
            <Badge
              onClick={() => {
                if (onAutomateOffers) onAutomateOffers(user.user_id);
              }}
              variant="secondary"
              className="cursor-pointer bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-100 shadow-sm rounded-full px-3 py-1"
            >
              <Zap className="w-3 h-3 mr-1 fill-purple-500" /> Automate Offers
            </Badge>
            <Dialog open={scheduleMailOpen} onOpenChange={setScheduleMailOpen}>
              <DialogTrigger asChild>
                <Badge variant="secondary" className="cursor-pointer hover:bg-slate-100 font-normal rounded-full px-3 py-1">Schedule mail</Badge>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Schedule Mail for {user.username}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Mail Template</label>
                    <Select value={scheduleType} onValueChange={(v: any) => setScheduleType(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select template" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="welcome">Welcome Mail</SelectItem>
                        <SelectItem value="referral">Referral Mail</SelectItem>
                        <SelectItem value="welcome_referral">Welcome + Referral Mail</SelectItem>
                        <SelectItem value="warning">Warning Mail</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Schedule Time</label>
                    <Input type="datetime-local" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setScheduleMailOpen(false)}>Cancel</Button>
                  <Button onClick={() => sendSingleMail(scheduleType, scheduleTime)} disabled={!scheduleTime || isSending}>
                    {isSending ? 'Scheduling...' : 'Confirm Schedule'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="mt-6 border-t border-slate-100 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SmartMessagePanel
              user={{
                user_id: user.user_id,
                username: user.username,
                email: user.email,
                country: user.country,
                city: user.city,
                verticals: user.verticals,
                geoPreferences: user.geoPreferences,
                recentOffers: offerViews.slice(0, 5).map(o => o.offer_name || o.name)
              }}
              onMessageSent={() => {
                if (onMailSent) onMailSent();
              }}
            />
          </div>
          <div className="space-y-4">
            <Card className="border-purple-100 shadow-sm h-full bg-white">
              <CardHeader className="pb-2 border-b bg-purple-50/30">
                <CardTitle className="text-sm font-semibold text-purple-900 flex items-center gap-2">
                  <Activity size={16} className="text-purple-600" /> User Persona
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="space-y-1">
                  <div className="text-[10px] text-gray-500 uppercase font-bold tracking-tight">Core Interests</div>
                  <div className="flex flex-wrap gap-1">
                    {user.verticals?.slice(0, 3).map(v => (
                      <Badge key={v} variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100 text-[10px]">{v}</Badge>
                    )) || <span className="text-xs text-slate-400 italic">No vertical data</span>}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] text-gray-500 uppercase font-bold tracking-tight">Geo Preferences</div>
                  <div className="flex flex-wrap gap-1">
                    {user.geoPreferences?.slice(0, 3).map(g => (
                      <Badge key={g} variant="secondary" className="bg-amber-50 text-amber-700 border-amber-100 text-[10px]">{g}</Badge>
                    )) || <span className="text-xs text-slate-400 italic">No geo data</span>}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] text-gray-500 uppercase font-bold tracking-tight">Last Activity</div>
                  <div className="text-xs text-gray-700 font-medium flex items-center gap-1">
                    <Clock size={12} className="text-gray-400" />
                    {user.latest_login ? new Date(user.latest_login).toLocaleString() : 'Recently'}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-100 shadow-sm h-full bg-white">
              <CardHeader className="pb-2 border-b bg-amber-50/30">
                <CardTitle className="text-sm font-semibold text-amber-900 flex items-center gap-2">
                  <Zap size={16} className="text-amber-600 fill-amber-600" /> Automation Engine
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-gray-500 uppercase font-bold">Status</span>
                  <Badge className={automation?.queue_status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500'}>
                    {automation?.queue_status || 'Inactive'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-gray-500 uppercase font-bold">Current Step</span>
                  <span className="text-xs font-bold text-slate-700">
                    {automation ? `Step ${automation.current_step}/5` : 'N/A'}
                  </span>
                </div>
                {automation?.next_mail_time && (
                  <div className="space-y-1">
                    <span className="text-[10px] text-gray-500 uppercase font-bold">Next Outreach</span>
                    <div className="text-[11px] text-slate-600 flex items-center gap-1">
                      <Clock size={10} /> {new Date(automation.next_mail_time).toLocaleString()}
                    </div>
                  </div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-[10px] h-7 mt-2"
                  onClick={async () => {
                    try {
                      await loginLogsService.saveUserAutomations(user.user_id, { queue_status: 'active', current_step: 0 });
                      toast({ title: "Automation Started", description: `Triggered new cycle for ${user.username}` });
                      fetchData();
                    } catch (e) {
                      toast({ title: "Error", description: "Failed to trigger automation", variant: "destructive" });
                    }
                  }}
                >
                  {automation?.queue_status === 'active' ? 'Restart Cycle' : 'Start Mail Flow'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div id="intelligence-dashboard" className="border-t border-slate-200 pt-6 mt-6">
        <UserIntelligenceProfile
          log={{ ...mockLog, user_id: user.user_id, username: user.username, email: user.email, geoPreferences: user.geoPreferences, verticals: user.verticals }}
          userLogs={user.logs}
          pageVisits={pageVisits}
          offerViews={offerViews}
          searchLogs={searchLogs}
          userSignals={signals}
          scheduledActivity={scheduledActivity}
          offerTargeting={offerTargeting}
          automationQueueItem={automation || automationQueueItem}
          allowedTabs={['login', 'activity', 'browsing', 'reco', 'automation', 'messaging']}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>
    </div>
  );
};
const AdminRecentActivity: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState('today');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [allUsers, setAllUsers] = useState<AggregatedUser[]>([]);
  const [advancedFilters, setAdvancedFilters] = useState<any>({
    geos: [],
    cities: [],
    geoPreferences: [],
    verticals: [],
    status: [],
    loginCount: 'Any',
    mailStatus: [],
    countries: [],
    activityStatus: 'Any'
  });

  const setQuickFilter = (type: string, value: any) => {
    if (type === 'reset') {
      setAdvancedFilters({
        geos: [],
        cities: [],
        status: [],
        loginCount: 'Any',
        mailStatus: [],
        verticals: [],
        countries: [],
        activityStatus: 'Any'
      });
      setSearchTerm('');
      return;
    }

    setAdvancedFilters(prev => {
      const next = { ...prev };
      
      // Handle array fields
      if (type === 'geos' || type === 'cities' || type === 'status' || type === 'mailStatus' || type === 'verticals' || type === 'countries') {
        // Toggle or set
        if (value === null) {
          next[type as keyof AdvancedFilters] = [] as any;
        } else {
          // If already has it, we might want to toggle or just set
          next[type as keyof AdvancedFilters] = [value] as any;
        }
      } else {
        // Handle value fields
        (next as any)[type] = value;
      }
      
      return next;
    });

    setSearchTerm('');
    // Scroll to results
    const element = document.getElementById('activity-feed');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const [availableGeos, setAvailableGeos] = useState<string[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [availableVerticals, setAvailableVerticals] = useState<string[]>([]);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [bulkMailSending, setBulkMailSending] = useState(false);
  const [scheduleMailOpen, setScheduleMailOpen] = useState(false);
  const [bulkAutomationOpen, setBulkAutomationOpen] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleType, setScheduleType] = useState<'welcome' | 'referral' | 'warning' | 'welcome_referral' | string>('welcome');
  const [mapCenter, setMapCenter] = useState<[number, number]>([0, 20]);
  const [mapZoom, setMapZoom] = useState(1);
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number, y: number, text: string } | null>(null);
  const [globalMailMetrics, setGlobalMailMetrics] = useState({ total: 0, today: 0 });
  const [queueDashboardOpen, setQueueDashboardOpen] = useState(false);
  const [automationQueueOpen, setAutomationQueueOpen] = useState(false);
  const [automationSettingsOpen, setAutomationSettingsOpen] = useState(false);
  const [messagingHubOpen, setMessagingHubOpen] = useState(false);
  const [automationStats, setAutomationStats] = useState({ active: 0, completed: 0, failed: 0, inCooldown: 0 });
  const [globalAutomationStats, setGlobalAutomationStats] = useState({ active: 0, completed: 0, failed: 0, inCooldown: 0 });
  const [automationQueue, setAutomationQueue] = useState<any[]>([]);
  const [automationSettings, setAutomationSettings] = useState({
    enabled: true,
    initial_delay_hours: 5,
    step_interval_minutes: 200,
    cooldown_days: 7
  });

  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // Lock body scroll when Hub is open
  useEffect(() => {
    if (messagingHubOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [messagingHubOpen]);

  const handleMapWheel = (e: React.WheelEvent) => {
    const newZoom = Math.min(Math.max(mapZoom - e.deltaY / 200, 1), 8);
    setMapZoom(newZoom);
  };

  const users = useMemo(() => {
    return allUsers.filter(u => {
      // Strictly only show users who actually logged in within the time range
      if (u.login_count === 0 || u.logs.length === 0) return false;
      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase();
        if (!u.username.toLowerCase().includes(q) &&
          !u.email.toLowerCase().includes(q) &&
          !(u.first_name || '').toLowerCase().includes(q) &&
          !(u.last_name || '').toLowerCase().includes(q)) {
          return false;
        }
      }
      if (advancedFilters.loginCount !== 'Any') {
        const val = advancedFilters.loginCount;
        if (val === '5x+') {
          if (u.login_count < 5) return false;
        } else {
          const req = parseInt(val.replace('x', ''));
          if (u.login_count !== req) return false;
        }
      }
      if (advancedFilters.geos.length > 0) {
        const userCountry = (u.country || '').toUpperCase();
        const matched = advancedFilters.geos.some((g: string) => g.toUpperCase() === userCountry);
        if (!matched) return false;
      }
      if (advancedFilters.cities && advancedFilters.cities.length > 0) {
        if (!u.city || !advancedFilters.cities.includes(u.city)) return false;
      }
      if (advancedFilters.status.length > 0) {
        let match = false;
        if (advancedFilters.status.includes('Suspicious Actions') && u.isSuspicious) match = true;
        if (advancedFilters.status.includes('Suspicious') && u.isSuspicious) match = true;
        if (advancedFilters.status.includes('Normal') && !u.isSuspicious && !u.logs.some(l => l.status === 'failed')) match = true;
        if (advancedFilters.status.includes('Failed Logins Only') && u.logs.some(l => l.status === 'failed')) match = true;
        
        // Match against exact chip labels seen in the UI
        if (advancedFilters.status.includes('Approved Actions') && (u.approvedCount || 0) > 0) match = true;
        if (advancedFilters.status.includes('Requested Actions') && (u.requestedCount || 0) > 0) match = true;
        if (advancedFilters.status.includes('Clicked Actions') && (u.clickCount || 0) > 0) match = true;
        if (advancedFilters.status.includes('Clicked Action') && (u.clickCount || 0) > 0) match = true;
        if (advancedFilters.status.includes('Searched Something') && u.hasSearchActivity) match = true;
        if (advancedFilters.status.includes('Viewed Offers') && (u.viewedCount || 0) > 0) match = true;

        // Legacy/Short-name support
        if (advancedFilters.status.includes('Requested') && ((u.requestedCount || 0) > 0 || (u.approvedCount || 0) > 0)) match = true;
        if (advancedFilters.status.includes('Approved') && (u.approvedCount || 0) > 0) match = true;
        if (advancedFilters.status.includes('Clicks') && (u.clickCount || 0) > 0) match = true;
        if (advancedFilters.status.includes('Calls Received') && u.logs.some(l => (l as any).subject?.toLowerCase().includes('call'))) match = true;

        if (!match) return false;
      }

      // Vertical Preference Filter
      if (advancedFilters.verticals.length > 0) {
        // Build expanded set of all aliases for selected filters
        const selectedAliases = new Set<string>();
        advancedFilters.verticals.forEach((v: string) => {
          getVerticalAliases(v).forEach(a => selectedAliases.add(a));
        });

        // u.verticals is already parsed & normalized at load time
        const userVerticals = (u.verticals || []).map((v: string) => v.toUpperCase().trim());

        const match = userVerticals.some(candidate =>
          selectedAliases.has(candidate) ||
          Array.from(selectedAliases).some(a =>
            candidate.includes(a) || a.includes(candidate)
          )
        );

        if (!match) return false;
      }

      if (advancedFilters.countries.length > 0) {
        if (!advancedFilters.countries.includes(u.country || '')) return false;
      }

      if (advancedFilters.mailStatus.length > 0) {
        let match = false;
        if (advancedFilters.mailStatus.includes('Welcome Mail Sent') && u.welcomeMailSentAt) match = true;
        if (advancedFilters.mailStatus.includes('Referral Mail Sent') && u.referralMailSentAt) match = true;
        if (advancedFilters.mailStatus.includes('Welcome Mail Not Sent') && !u.welcomeMailSentAt) match = true;
        if (advancedFilters.mailStatus.includes('Referral Mail Not Sent') && !u.referralMailSentAt) match = true;
        if (advancedFilters.mailStatus.includes('Call Scheduled') && u.logs.some(l => (l as any).subject?.includes('Call'))) match = true;
        if (advancedFilters.mailStatus.includes('Call Completed') && u.logs.some(l => (l as any).subject?.includes('Call Completed'))) match = true;
        if (!match) return false;
      }
      if (advancedFilters.geoPreferences.length > 0) {
        if (!u.geoPreferences || u.geoPreferences.length === 0) return false;
        const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
        const userPrefsFullNames = u.geoPreferences.map((code: string) => {
          if (code === 'WW') return 'Worldwide';
          if (code === 'UK') return 'United Kingdom';
          try { return regionNames.of(code) || code; } catch (e) { return code; }
        });
        const matched = advancedFilters.geoPreferences.some((g: string) =>
          userPrefsFullNames.some(p => p.toLowerCase() === g.toLowerCase())
        );
        if (!matched) return false;
      }
      return true;
    });
  }, [allUsers, advancedFilters, searchTerm]);

  const loadData = async () => {
    setLoading(true);
    setSelectedUserIds(new Set());
    setExpandedId(null);
    try {
      const params: any = { page: 1, limit: 400 };
      const now = new Date();
      let start = new Date(now);
      let end = new Date(now);

      switch (timeFilter) {
        case 'custom':
          if (customDateRange.start) start = new Date(customDateRange.start);
          if (customDateRange.end) end = new Date(customDateRange.end);
          break;
        case '30m': start.setMinutes(now.getMinutes() - 30); break;
        case '1h': start.setHours(now.getHours() - 1); break;
        case '4h': start.setHours(now.getHours() - 4); break;
        case '10h': start.setHours(now.getHours() - 10); break;
        case 'today': start.setHours(0, 0, 0, 0); break;
        case 'yesterday':
          start.setDate(now.getDate() - 1); start.setHours(0, 0, 0, 0);
          end.setDate(now.getDate() - 1); end.setHours(23, 59, 59, 999);
          break;
        case '2d': start.setDate(now.getDate() - 2); break;
        case '1w': start.setDate(now.getDate() - 7); break;
        case '2w': start.setDate(now.getDate() - 14); break;
        case '1mo': start.setMonth(now.getMonth() - 1); break;
        case '2mo': start.setMonth(now.getMonth() - 2); break;
        case '3mo': start.setMonth(now.getMonth() - 3); break;
        case '6mo': start.setMonth(now.getMonth() - 6); break;
        case '1y': start.setFullYear(now.getFullYear() - 1); break;
        default: start.setHours(now.getHours() - 24);
      }

      params.start_date = start.toISOString();
      params.end_date = end.toISOString();

      const token = localStorage.getItem('token');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const results = await Promise.all([
        loginLogsService.getLoginLogs({ ...params, per_page: 1000 }).catch(() => ({ logs: [] })),
        fetch(`${API_URL}/api/admin/mail-history?limit=500`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal
        }).then(r => r.ok ? r.json() : { history: [] }).catch(() => ({ history: [] })),
        fetch(`${API_URL}/api/auth/admin/users?limit=1000`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal
        }).then(r => r.ok ? r.json() : { users: [] }).catch(() => ({ users: [] })),
        fetch(`${API_URL}/api/admin/search-logs?date_from=${params.start_date}&date_to=${params.end_date}&per_page=500`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal
        }).then(r => r.ok ? r.json() : { logs: [] }).catch(() => ({ logs: [] })),
        fetch(`${API_URL}/api/admin/automation/queue`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal
        }).then(r => r.ok ? r.json() : { queue: [] }).catch(() => ({ queue: [] })),
        fetch(`${API_URL}/api/admin/automation/settings`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal
        }).then(r => r.ok ? r.json() : { settings: {} }).catch(() => ({ settings: {} })),
        fetch(`${API_URL}/api/admin/offer-access-requests/publisher-profiles?status=all&per_page=2000`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal
        }).then(r => r.ok ? r.json() : { profiles: [] }).catch(() => ({ profiles: [] })),
        fetch(`${API_URL}/api/admin/all-user-intelligence`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal
        }).then(r => r.ok ? r.json() : { intelligence: [] }).catch(() => ({ intelligence: [] })),
        fetch(`${API_URL}/api/admin/offerwall/click-history?limit=1000`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal
        }).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
        fetch(`${API_URL}/api/admin/dashboard/click-history?limit=1000`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal
        }).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
        fetch(`${API_URL}/api/admin/offers?limit=2000`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal
        }).then(r => r.ok ? r.json() : { offers: [] }).catch(() => ({ offers: [] }))
      ]);
      const [logsRes, mailRes, usersRes, searchRes, queueRes, settingsRes, profilesRes, intelRes, clickRes, dashClickRes, offersRes] = results as any;
      clearTimeout(timeoutId);

      if (settingsRes.settings) setAutomationSettings(settingsRes.settings);
      let automationQueueRawData = queueRes.queue || [];
      let searchLogsRawData = searchRes.logs || [];
      let loginLogsRawData = logsRes.logs || [];

      // Sync back to logsRes for the rest of the function
      setAutomationQueue(automationQueueRawData);
      (window as any)._rawQueue = automationQueueRawData;
      logsRes.logs = loginLogsRawData;

      const intelMap = new Map((intelRes.intelligence || []).filter(Boolean).map((i: any) => [String(i.user_id || i._id || ''), i]));

      const searchUserIds = new Set<string>();
      searchLogsRawData.forEach((l: any) => {
        if (l.user_id) searchUserIds.add(String(l.user_id));
        if (l.user_email) searchUserIds.add(l.user_email.toLowerCase());
        if (l.user_name) searchUserIds.add(l.user_name.toLowerCase());
      });

      const mailMap = new Map<string, { welcome: string | null, referral: string | null, total: number }>();
      let mailsToday = 0;
      const todayString = new Date().toDateString();

      // Filter mail history to exclude mock/internal test data
      let filteredMailHistory = (mailRes.history || []).filter((h: any) => {
        const uName = (h.username || '').toLowerCase();
        const uEmail = (h.email || h.to?.[0] || '').toLowerCase();
        const isDummy = uName.includes('test') || uName.includes('dummy') || uEmail.includes('test') || uEmail.includes('dummy') || h.isMock;
        return !isDummy;
      });

      // Prepare profile map for fast lookup
      const profileMap = new Map<string, any>();
      (usersRes.users || []).forEach((u: any) => {
        const id = String(u._id || u.user_id || '');
        if (id) profileMap.set(id, u);
        if (u.email) profileMap.set(u.email.toLowerCase().trim(), u);
        if (u.username) profileMap.set(u.username.toLowerCase().trim(), u);
      });
      (profilesRes.profiles || []).forEach((p: any) => {
        const id = String(p.user_id || p._id || p.publisher_id || '');
        const email = (p.email || '').toLowerCase();
        const username = (p.username || '').toLowerCase();
        const existing = profileMap.get(id) || profileMap.get(email) || profileMap.get(username) || {};
        const merged = { ...existing, ...p };
        if (id) profileMap.set(id, merged);
        if (p.email) profileMap.set(p.email.toLowerCase().trim(), merged);
        if (p.username) profileMap.set(p.username.toLowerCase().trim(), merged);
        if (email) profileMap.set(email, merged);
        if (username) profileMap.set(username, merged);
      });

      filteredMailHistory.forEach((h: any) => {
        if (h.sent_at && new Date(h.sent_at).toDateString() === todayString) {
          mailsToday += h.success_count || h.recipients_count || (h.to?.length || 1);
        }
        h.to?.forEach((email: string) => {
          const e = email.toLowerCase();
          if (!mailMap.has(e)) mailMap.set(e, { welcome: null, referral: null, total: 0 });
          const m = mailMap.get(e)!;
          m.total += 1;
          const subject = h.subject?.toLowerCase() || '';
          if (subject.includes('welcome') && !m.welcome) m.welcome = h.sent_at;
          if (subject.includes('referral') && !m.referral) m.referral = h.sent_at;
        });
      });
      setGlobalMailMetrics({ total: mailRes.total || 0, today: mailsToday });

      const userMap = new Map<string, AggregatedUser>();
      const sDate = new Date(params.start_date);
      const eDate = new Date(params.end_date);

      // Helper to handle user aggregation from different sources
      const processUserActivity = (userId: any, email: string | null, username: string | null, log: any | null, timestamp: string | null, forceAdd: boolean = false, intelData: any = null) => {
        const emailKey = (email || '').toLowerCase().trim();
        const userKey = (username || '').toLowerCase().trim();
        const idKey = String(userId || '').trim();
        
        const profile = profileMap.get(idKey) || profileMap.get(emailKey) || profileMap.get(userKey) || {};
        const finalKey = profile._id ? String(profile._id) : (idKey || emailKey || userKey);
        
        if (!finalKey || finalKey === 'undefined' || finalKey === 'null') return null;

        // Skip test/dummy/internal data
        const lUsername = (username || '').toLowerCase();
        const lEmail = (email || '').toLowerCase();
        const pUsername = (profile.username || '').toLowerCase();
        const pEmail = (profile.email || '').toLowerCase();
        
        const isExcluded = lUsername.includes('test') || lUsername.includes('dummy') || lUsername.includes('fake') ||
                           lEmail.includes('test') || lEmail.includes('dummy') || lEmail.includes('fake') ||
                           pUsername.includes('test') || pUsername.includes('dummy') || pUsername.includes('fake') ||
                           pEmail.includes('test') || pEmail.includes('dummy') || pEmail.includes('fake') ||
                           lUsername.startsWith('User_') || pUsername.startsWith('User_');
                           
        if (isExcluded || profile.isMock || profile.is_mock || (!lEmail && !pEmail)) return null;

        if (!userMap.has(finalKey)) {
          if (!forceAdd) return null; 

          const mInfo = mailMap.get(emailKey) || { welcome: null, referral: null, total: 0 };
          const { lat, lng } = getLatLng(log?.location, log, profile);
          const rawVerticals = [
            profile.verticals,
            profile.signup_preferences?.verticals,
            profile.vertical,
            profile.vertical_preference,
            profile.interests,
            intelData?.top_categories,
            intelData?.signal_breakdown?.top_categories
          ];
          const geos = profile.geos || (profile.signup_preferences?.geos) || profile.geos_preference || [];

          userMap.set(finalKey, {
            user_id: finalKey,
            username: username || profile.username || profile.name || email?.split('@')[0] || 'User_' + finalKey.slice(-4),
            email: email || profile.email || 'N/A',
            latest_login: timestamp || 'N/A',
            login_count: 0, // starts at 0, only incremented by actual login logs in the time range
            logs: [],
            isSuspicious: false,
            welcomeMailSentAt: mInfo.welcome || undefined,
            referralMailSentAt: mInfo.referral || undefined,
            totalMails: mInfo.total,
            lat,
            lng,
            country: getCountry(log, profile),
            verticals: parseVerticals(rawVerticals),
            geoPreferences: Array.isArray(geos) ? geos : [geos].filter(Boolean),
            hasSearchActivity: searchUserIds.has(finalKey) || searchUserIds.has(idKey) || searchUserIds.has(emailKey) || searchUserIds.has(userKey),
            account_status: profile.account_status || 'pending_approval',
            role: profile.role || 'user'
          });
        }
        return userMap.get(finalKey);
      };

      // 1. Process Login Logs
      for (const log of (logsRes.logs || [])) {
        const logDate = new Date(log.login_time);
        if (logDate >= sDate && logDate <= eDate) {
          const userAgg = processUserActivity(log.user_id, log.email, log.username, log, log.login_time, true);
          if (userAgg) {
            userAgg.login_count += 1;
            userAgg.logs.push(log);
            if (log.risk_level === 'high' || log.risk_level === 'critical' || (log.fraud_score && log.fraud_score > 50)) {
              userAgg.isSuspicious = true;
            }
            if (log.login_time && (userAgg.latest_login === 'N/A' || new Date(log.login_time) > new Date(userAgg.latest_login))) {
               userAgg.latest_login = log.login_time;
            }
          }
        }
      }

      // 2. Process Search Logs
      for (const log of (searchRes.logs || [])) {
        const logDate = new Date(log.created_at);
        if (logDate >= sDate && logDate <= eDate) {
          const userAgg = processUserActivity(log.user_id, log.user_email, log.user_name, null, log.created_at, false);
          if (userAgg) {
            userAgg.hasSearchActivity = true;
          }
        }
      }

      // 3. Process Clicks
      const allClicks = [...(clickRes.data || []), ...(dashClickRes.data || [])];
      for (const click of allClicks) {
        const clickDate = new Date(click.timestamp);
        if (clickDate >= sDate && clickDate <= eDate) {
          const userAgg = processUserActivity(click.user_id || click.publisher_id || click.affiliate_id, (click as any).user_email || (click as any).email, (click as any).user_name || (click as any).username, null, click.timestamp, false);
          if (userAgg) {
            userAgg.clickCount = (userAgg.clickCount || 0) + 1;
          }
        }
      }

      // 4. Process Profiles with recent requests
      for (const p of (profilesRes.profiles || [])) {
        const hasRecentRequest = (p.requests || []).some((r: any) => {
          const t = r.requested_at || r.approved_at || r.rejected_at;
          return t && new Date(t) >= sDate && new Date(t) <= eDate;
        });
        if (hasRecentRequest) {
          const userAgg = processUserActivity(p.user_id || p.publisher_id, p.email, p.username, null, null, true);
          if (userAgg) {
            const recentReqs = (p.requests || []).filter((r: any) => {
              const t = r.requested_at || r.approved_at || r.rejected_at;
              return t && new Date(t) >= sDate && new Date(t) <= eDate;
            });
            userAgg.approvedCount = (userAgg.approvedCount || 0) + recentReqs.filter((r: any) => r.status === 'approved').length;
            userAgg.requestedCount = (userAgg.requestedCount || 0) + recentReqs.filter((r: any) => r.status === 'pending' || r.status === 'requested').length;
            userAgg.rejectedCount = (userAgg.rejectedCount || 0) + recentReqs.filter((r: any) => r.status === 'rejected' || r.status === 'denied').length;
          }
        }
      }

      const userRequestMap = new Map<string, any>();
      (profilesRes.profiles || []).forEach((p: any) => {
        const id = String(p.user_id || p._id || p.publisher_id || '');
        if (id) userRequestMap.set(id, p);
        if (p.email) userRequestMap.set(p.email.toLowerCase(), p);
        if (p.username) userRequestMap.set(p.username.toLowerCase(), p);
      });

      intelMap.forEach((intel, emailOrUser) => {
        const intelId = String(intel.user_id || intel._id || '');
        const intelEmail = (intel.email || '').toLowerCase().trim();
        const intelUser = (intel.username || '').toLowerCase().trim();
        
        const userAgg = processUserActivity(intelId || emailOrUser, intelEmail, intelUser, null, (intel as any).latest_login || (intel as any).login_time, true, intel);
        
        if (userAgg) {
          const u = profileMap.get(String(userAgg.user_id)) || profileMap.get((userAgg.email || '').toLowerCase()) || profileMap.get((userAgg.username || '').toLowerCase());
          
          if (u) {
            userAgg.first_name = u.first_name || userAgg.first_name;
            userAgg.last_name = u.last_name || userAgg.last_name;
          }

          const rawVerticals = [
            u?.verticals,
            u?.signup_preferences?.verticals,
            u?.vertical,
            u?.vertical_preference,
            u?.interests,
            (intel as any).top_categories,
            (intel as any).signal_breakdown?.top_categories
          ];
          userAgg.verticals = parseVerticals(rawVerticals);
        }
      });

      const sortedUsers = Array.from(userMap.values()).map(userAgg => {
        const uId = String(userAgg.user_id);
        const emailKey = (userAgg.email || '').toLowerCase();
        const userKey = (userAgg.username || '').toLowerCase();
        
        const intel = intelMap.get(uId) || intelMap.get(emailKey) || intelMap.get(userKey) || {};
        const signal = (intel as any).signal_breakdown || {};
        const reqProf = userRequestMap.get(uId) || userRequestMap.get(emailKey) || userRequestMap.get(userKey);
        const u = profileMap.get(uId) || profileMap.get(emailKey) || profileMap.get(userKey);
        
        userAgg.approvedCount = userAgg.approvedCount || signal.approvals || (intel as any).approved_count || (intel as any).approved_offers || (intel as any).approvedCount || 0;
        userAgg.requestedCount = userAgg.requestedCount || signal.requests || (intel as any).requested_count || (intel as any).requested_offers || (intel as any).requestedCount || 0;
        userAgg.rejectedCount = userAgg.rejectedCount || (intel as any).rejected_count || (intel as any).rejected_offers || (intel as any).rejectedCount || 0;
        userAgg.clickCount = userAgg.clickCount || signal.clicks || (intel as any).total_clicks || (intel as any).clickCount || (intel as any).clicks || (intel as any).click_count || 0;
        userAgg.viewedCount = userAgg.viewedCount || signal.views || (intel as any).total_views || (intel as any).offerViewsCount || (intel as any).views || 0;
        
        // Do NOT override login_count from intel — it's all-time data, not time-range specific
        // login_count is already correctly set from actual login logs above

        if (reqProf && (userAgg.approvedCount === 0 && userAgg.requestedCount === 0)) {
          const requests = reqProf.requests || [];
          userAgg.approvedCount = requests.filter((r: any) => r.status === 'approved').length;
          userAgg.requestedCount = requests.filter((r: any) => r.status === 'pending' || r.status === 'requested').length;
          userAgg.rejectedCount = requests.filter((r: any) => r.status === 'rejected' || r.status === 'denied').length;
        }

        const sDate = new Date(params.start_date);
        const eDate = new Date(params.end_date);
        
        const recentOfferwallClicks = (clickRes.data || []).filter((c: any) => {
          const cId = String(c.user_id || c.publisher_id || c.affiliate_id || '');
          const cEmail = (c.user_email || c.email || '').toLowerCase();
          const cUsername = (c.user_name || c.username || '').toLowerCase();
          return (cId === uId || cEmail === emailKey || cUsername === userKey) &&
                 new Date(c.timestamp) >= sDate && new Date(c.timestamp) <= eDate;
        }).length;
        
        const recentDashClicks = (dashClickRes.data || []).filter((c: any) => {
          const cId = String(c.user_id || c.publisher_id || c.affiliate_id || '');
          const cEmail = (c.user_email || c.email || '').toLowerCase();
          const cUsername = (c.user_name || c.username || '').toLowerCase();
          return (cId === uId || cEmail === emailKey || cUsername === userKey) &&
                 new Date(c.timestamp) >= sDate && new Date(c.timestamp) <= eDate;
        }).length;

        const totalRecent = recentOfferwallClicks + recentDashClicks;
        if (totalRecent > userAgg.clickCount) userAgg.clickCount = totalRecent;

        if (u) {
          userAgg.first_name = u.first_name;
          userAgg.last_name = u.last_name;

          const rawVerticals = [
            u.verticals,
            u.signup_preferences?.verticals,
            u.vertical,
            u.vertical_preference,
            u.interests,
            (intel as any).top_categories,
            (intel as any).signal_breakdown?.top_categories
          ];
          
          const mergedVerticals = parseVerticals(rawVerticals);
          if (userAgg.verticals.length === 0) {
            userAgg.verticals = mergedVerticals;
          } else {
            userAgg.verticals = Array.from(new Set([...userAgg.verticals, ...mergedVerticals]));
          }

          let geos = u.geos ||
            (u.signup_preferences && u.signup_preferences.geos) ||
            u.geos_preference || u.country_preference || [];
          if (!Array.isArray(geos)) geos = [geos].filter(Boolean);
          userAgg.geoPreferences = Array.from(new Set(geos.filter(Boolean).map((g: any) => String(g).trim())));
        }

        userAgg.logs.sort((a, b) => new Date(b.login_time).getTime() - new Date(a.login_time).getTime());

        const latestLog = userAgg.logs[0];
        userAgg.city = getCity(latestLog, u);
        userAgg.country = getCountry(latestLog, u);

        if (userAgg.country === 'Tracking...' || userAgg.country === 'Unknown' || userAgg.country === 'Location Tracking...' || userAgg.country === 'Localhost' || userAgg.country === 'Local/India') {
          for (const l of userAgg.logs) {
            const ci = getCity(l, u);
            const co = getCountry(l, u);
            if (co !== 'Tracking...' && co !== 'Location Tracking...' && co !== 'Unknown') {
              userAgg.city = ci;
              userAgg.country = co;
              const { lat, lng } = getLatLng(l.location, l, u);
              if (lat !== undefined && lng !== undefined && !(lat === 0 && lng === 0)) {
                userAgg.lat = lat;
                userAgg.lng = lng;
              }
              break;
            }
          }
        }

        if ((userAgg.lat === undefined || userAgg.lat === 0 || isNaN(userAgg.lat))) {
          const { lat: finalLat, lng: finalLng } = getLatLng({ country: userAgg.country, city: userAgg.city }, userAgg.logs[0], userAgg);
          userAgg.lat = finalLat;
          userAgg.lng = finalLng;
        }

        if (userAgg.lat === undefined || userAgg.lat === 0 || isNaN(userAgg.lat)) {
          userAgg.lat = 20.5937;
          userAgg.lng = 78.9629;
          userAgg.country = userAgg.country || 'India';
        }

        const uniqueCountries = new Set(userAgg.logs.map((l: any) => l.location?.country_code || l.location?.country).filter(c => c && c !== 'XX' && c !== 'Unknown'));
        const uniqueCities = new Set(userAgg.logs.map((l: any) => l.location?.city).filter(c => c && c !== 'Unknown'));
        const uniqueIps = new Set(userAgg.logs.map((l: any) => l.ip_address).filter(Boolean));
        const hasNewDevice = userAgg.logs.some((l: any) => l.device_change_detected);
        const isMulti = userAgg.login_count >= 3;

        if (uniqueCountries.size > 1 || uniqueCities.size > 1 || uniqueIps.size > 1 || (isMulti && hasNewDevice)) {
          userAgg.isSuspicious = true;
          userAgg.hasDifferentLocations = uniqueCountries.size > 1 || uniqueCities.size > 1;
          userAgg.sharedAccount = uniqueIps.size >= 3 || uniqueCountries.size >= 2;
        }
        return userAgg;
      }).filter(u => u.login_count > 0 && u.logs.length > 0).sort((a, b) => new Date(b.latest_login).getTime() - new Date(a.latest_login).getTime());

      const geosSet = new Set<string>();
      const citiesSet = new Set<string>();
      sortedUsers.forEach(u => {
        if (u.country && u.country !== 'Unknown') geosSet.add(u.country);
        if (u.city && u.city !== 'Unknown') citiesSet.add(u.city);
      });

      const allVerticalsSet = new Set<string>();
      profileMap.forEach(profile => {
        let rawVerticals = profile.verticals ||
          (profile.signup_preferences && profile.signup_preferences.verticals) ||
          profile.vertical || profile.vertical_preference || profile.interests || [];
        
        const verticalList = parseVerticals(rawVerticals);
        verticalList.forEach(v => allVerticalsSet.add(v));
      });

      // 2. From Offers (Dating, Insurance, etc.)
      (offersRes.offers || []).forEach((o: any) => {
        const categories = [...(o.category ? [o.category] : []), ...(o.vertical ? [o.vertical] : []), ...(Array.isArray(o.categories) ? o.categories : [])];
        categories.forEach(c => {
          if (c) {
            String(c).split(',').forEach(s => {
              const normalized = normalizeVertical(s);
              if (normalized) allVerticalsSet.add(normalized);
            });
          }
        });
      });
      setAvailableVerticals(Array.from(allVerticalsSet).filter(Boolean).sort());

      // Extract ALL possible countries from the entire user database
      const allGeosSet = new Set<string>();
      profileMap.forEach(profile => {
        const country = profile.country || profile.country_code || (profile.signup_preferences && profile.signup_preferences.country);
        if (country && country !== 'Unknown' && country !== 'N/A') allGeosSet.add(String(country).trim());
        
        // Also check geo preferences
        const prefs = profile.geos || profile.geoPreferences || profile.geos_preference || [];
        if (Array.isArray(prefs)) prefs.forEach((g: any) => {
          if (g && g !== 'WW' && g.length === 2) allGeosSet.add(String(g).trim());
        });
      });
      // Merge with geos from sortedUsers just in case
      sortedUsers.forEach(u => {
        if (u.country && u.country !== 'Unknown' && u.country !== 'N/A') allGeosSet.add(u.country);
      });
      setAvailableGeos(Array.from(allGeosSet).filter(Boolean).sort());
      setAvailableCities(Array.from(citiesSet).sort());

      setAllUsers(sortedUsers);
      (window as any)._debugUsers = sortedUsers;
      console.log(`[DEBUG] Aggregated ${sortedUsers.length} active users.`);
      if (sortedUsers.length > 0) {
        const insuranceUsers = sortedUsers.filter(u => u.verticals.some(v => v.toUpperCase().includes('INSURANCE')));
        console.log(`[DEBUG] Found ${insuranceUsers.length} users with Insurance vertical.`);
      }

      // Sync Automation Stats with CURRENT users in view (Filtered)
      const autoStatsQueue = (window as any)._rawQueue || [];
      const currentIds = new Set(sortedUsers.map(u => String(u.user_id)));

      setAutomationStats({
        active: autoStatsQueue.filter((i: any) => currentIds.has(String(i.user_id)) && i.queue_status === 'active' && i.delivery_status !== 'failed').length,
        completed: autoStatsQueue.filter((i: any) => currentIds.has(String(i.user_id)) && i.queue_status === 'completed').length,
        failed: autoStatsQueue.filter((i: any) => currentIds.has(String(i.user_id)) && i.delivery_status === 'failed').length,
        inCooldown: autoStatsQueue.filter((i: any) => currentIds.has(String(i.user_id)) && i.queue_status === 'completed' && i.cooldown_until && new Date(i.cooldown_until) > now).length
      });

      // Calculate GLOBAL Automation Stats (System-wide)
      setGlobalAutomationStats({
        active: autoStatsQueue.filter((i: any) => i.queue_status === 'active' && i.delivery_status !== 'failed').length,
        completed: autoStatsQueue.filter((i: any) => i.queue_status === 'completed').length,
        failed: autoStatsQueue.filter((i: any) => i.delivery_status === 'failed').length,
        inCooldown: autoStatsQueue.filter((i: any) => i.queue_status === 'completed' && i.cooldown_until && new Date(i.cooldown_until) > now).length
      });

    } catch (e) {
      console.error("Error loading recent activity", e);
      toast({ title: 'Error', description: 'Failed to load activity data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [timeFilter]);

  const toggleUserSelection = (userId: string) => {
    const newSet = new Set(selectedUserIds);
    if (newSet.has(userId)) newSet.delete(userId);
    else newSet.add(userId);
    setSelectedUserIds(newSet);
  };

  const toggleAll = () => {
    if (selectedUserIds.size === users.length) setSelectedUserIds(new Set());
    else setSelectedUserIds(new Set(users.map(u => u.user_id)));
  };

  const handleBulkMail = async (type: 'welcome' | 'referral' | 'warning' | string, scheduledTimeStr?: string) => {
    if (selectedUserIds.size === 0) return;
    setBulkMailSending(true);

    const selectedUsersList = users.filter(u => selectedUserIds.has(u.user_id));
    let successCount = 0;

    for (const u of selectedUsersList) {
      let subject = '';
      let body = '';
      if (type === 'welcome') {
        subject = 'Welcome to Moustache Leads! 🚀';
        body = `Hey there! Welcome ${u.username} 😊<br/><br/>Here’s our Teams link — feel free to join anytime. We’re there to help you with offers, tracking, or anything you need:<br/><a href="https://teams.live.com/l/invite/FEAkABBHjfqCMqxtR8?v=g1">https://teams.live.com/l/invite/FEAkABBHjfqCMqxtR8?v=g1</a><br/><br/>You can also ask questions anytime — we’re happy to help.<br/>By the way, what traffic sources are you currently working with?<br/><br/>Please set up your placement and postback here:<br/><a href="https://www.moustacheleads.com/dashboard/placements">https://www.moustacheleads.com/dashboard/placements</a><br/><br/>If you need help, reach us on Teams or Telegram: @mlaffil<br/>Support is also available here:<br/><a href="https://www.moustacheleads.com/dashboard/support">https://www.moustacheleads.com/dashboard/support</a><br/><br/>Looking forward to working with you! 🚀<br/><br/>Best regards,<br/>Team Moustache Leads`;
      } else if (type === 'referral') {
        subject = 'Have you seen our Referral Program?';
        body = `Hey ${u.username}<br/><br/>Hope you're doing well 🙂<br/><br/>Just wanted to check — have you had a chance to look at our referral program?<br/><br/>If yes, we’d love to hear your thoughts. And if you have any doubts or need clarity on anything, feel free to share — we’re happy to help.<br/><br/>Looking forward to your response!<br/><br/>Best regards,<br/>Team Moustache Leads`;
      } else if (type === 'warning') {
        subject = 'Important Notice Regarding Your Account Activity';
        body = `Hey ${u.username},<br/><br/>We have detected some unusual activity on your account recently.<br/>Please review your account security and ensure your postbacks are set up correctly.<br/>If you have any questions or believe this is an error, please reach out to support immediately.<br/><br/>Best regards,<br/>Team Moustache Leads`;
      } else if (type === 'welcome_referral') {
        subject = 'Welcome to Moustache Leads & Our Referral Program! 🚀';
        body = `Hey there! Welcome ${u.username} 😊<br/><br/>Here’s our Teams link — feel free to join anytime. We’re there to help you with offers, tracking, or anything you need:<br/><a href="https://teams.live.com/l/invite/FEAkABBHjfqCMqxtR8?v=g1">https://teams.live.com/l/invite/FEAkABBHjfqCMqxtR8?v=g1</a><br/><br/>You can also ask questions anytime — we’re happy to help.<br/>By the way, what traffic sources are you currently working with?<br/><br/>Please set up your placement and postback here:<br/><a href="https://www.moustacheleads.com/dashboard/placements">https://www.moustacheleads.com/dashboard/placements</a><br/><br/>If you need help, reach us on Teams or Telegram: @mlaffil<br/>Support is also available here:<br/><a href="https://www.moustacheleads.com/dashboard/support">https://www.moustacheleads.com/dashboard/support</a><br/><br/>Also, have you had a chance to look at our referral program? If yes, we’d love to hear your thoughts. And if you have any doubts or need clarity on anything, feel free to share — we’re happy to help.<br/><br/>Looking forward to working with you! 🚀<br/><br/>Best regards,<br/>Team Moustache Leads`;
      }

      try {
        await loginLogsService.sendCustomMail([u.email], subject, body, scheduledTimeStr ? new Date(scheduledTimeStr).toISOString() : undefined);
        successCount++;
      } catch (e) {
        console.error(`Failed to send mail to ${u.email}`, e);
      }
    }

    toast({
      title: scheduledTimeStr ? 'Bulk Mail Scheduled' : 'Bulk Mail Sent',
      description: `Successfully ${scheduledTimeStr ? 'scheduled' : 'sent'} ${type} mail to ${successCount} out of ${selectedUsersList.length} selected users.`
    });
    setBulkMailSending(false);
    setScheduleMailOpen(false);
    loadData(); // refresh to update mail tracking state
  };

  const handleUserAction = async (userId: string, action: string) => {
    const userToActOn = allUsers.find(u => u.user_id === userId);

    if (action === 'Send Welcome + Referral Mail' && userToActOn) {
      try {
        const subject = 'Welcome to Moustache Leads & Our Referral Program! 🚀';
        const body = `Hey there! Welcome ${userToActOn.username} 😊<br/><br/>Here’s our Teams link — feel free to join anytime. We’re there to help you with offers, tracking, or anything you need:<br/><a href="https://teams.live.com/l/invite/FEAkABBHjfqCMqxtR8?v=g1">https://teams.live.com/l/invite/FEAkABBHjfqCMqxtR8?v=g1</a><br/><br/>You can also ask questions anytime — we’re happy to help.<br/>By the way, what traffic sources are you currently working with?<br/><br/>Please set up your placement and postback here:<br/><a href="https://www.moustacheleads.com/dashboard/placements">https://www.moustacheleads.com/dashboard/placements</a><br/><br/>If you need help, reach us on Teams or Telegram: @mlaffil<br/>Support is also available here:<br/><a href="https://www.moustacheleads.com/dashboard/support">https://www.moustacheleads.com/dashboard/support</a><br/><br/>Also, have you had a chance to look at our referral program? If yes, we’d love to hear your thoughts. And if you have any doubts or need clarity on anything, feel free to share — we’re happy to help.<br/><br/>Looking forward to working with you! 🚀<br/><br/>Best regards,<br/>Team Moustache Leads`;
        await loginLogsService.sendCustomMail([userToActOn.email], subject, body);
        toast({ title: 'Mails Sent', description: `Welcome and Referral mails sent to ${userToActOn.username}.` });
        setAllUsers(prevUsers => prevUsers.map(u => {
          if (u.user_id !== userId) return u;
          return { ...u, welcomeMailSentAt: new Date().toISOString(), referralMailSentAt: new Date().toISOString(), totalMails: u.totalMails + 2 };
        }));
      } catch (e) {
        toast({ title: 'Error', description: 'Failed to send combined mail', variant: 'destructive' });
      }
      return;
    }

    setAllUsers(prevUsers => prevUsers.map(u => {
      if (u.user_id !== userId) return u;
      const newU = { ...u };
      if (action === 'Pause User') {
        newU.isPaused = true;
        toast({ title: 'User Paused', description: `User ${newU.username} has been paused.` });
      } else if (action === 'Unpause User') {
        newU.isPaused = false;
        toast({ title: 'User Unpaused', description: `User ${newU.username} is now active.` });
      } else if (action === 'Flag Suspicious') {
        newU.isSuspicious = true;
        toast({ title: 'Flagged Suspicious', description: `User ${newU.username} flagged as suspicious.`, variant: 'destructive' });
      } else if (action === 'Unflag Suspicious') {
        newU.isSuspicious = false;
        toast({ title: 'Unflagged', description: `User ${newU.username} is no longer suspicious.` });
      } else if (action === 'View Profile') {
        toast({ title: 'View Profile', description: `Navigating to ${newU.username}'s profile.` });
      } else if (action === 'View Behavior') {
        setExpandedId(userId);
      }
      return newU;
    }));
  };

  const mapMarkers = useMemo(() => {
    // 1:1 mapping from filtered users to markers (no deduplication)
    const validUsers = users.filter(u => typeof u.lat === 'number' && !isNaN(u.lat));

    // Safety check: if they have identical coordinates (down to 1 decimal place), scatter them aggressively
    const coordsMap = new Map<string, number>();

    return validUsers.map(u => {
      const coordKey = `${u.lat?.toFixed(1)}_${u.lng?.toFixed(1)}`;
      const count = coordsMap.get(coordKey) || 0;
      coordsMap.set(coordKey, count + 1);

      if (count === 0) return u;

      // More aggressive scatter for overlapping markers to ensure all 20+ markers are distinct
      const angle = count * (Math.PI * 2 / 5);
      const distance = 2.5 + (Math.floor(count / 5) * 1.5);

      return {
        ...u,
        lat: u.lat! + (Math.sin(angle) * distance),
        lng: u.lng! + (Math.cos(angle) * distance),
        isJittered: true
      };
    });
  }, [users]);

  // Prepare chart data (Logins over time within filter)
  const chartDataMap = new Map<string, number>();

  const getChartKey = (dateStr: string, filter: string) => {
    if (!dateStr || dateStr === 'Unknown') return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;

    if (['30m', '1h'].includes(filter)) {
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } else if (['4h', '10h', 'today', 'yesterday'].includes(filter)) {
      return `${String(d.getHours()).padStart(2, '0')}:00`;
    } else if (['1w', '2w', '1mo'].includes(filter)) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } else {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
  };

  users.forEach(u => {
    u.logs.forEach(l => {
      const key = getChartKey(l.login_time, timeFilter);
      if (key) {
        chartDataMap.set(key, (chartDataMap.get(key) || 0) + 1);
      }
    });
  });
  const chartData = Array.from(chartDataMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({ time: k, logins: v }));

  const summary = {
    uniqueUsers: users.length,
    noWelcome: users.filter(u => !u.welcomeMailSentAt).length,
    noReferral: users.filter(u => !u.referralMailSentAt).length,
    suspicious: users.filter(u => u.isSuspicious).length,
    approved: users.filter(u => (u.approvedCount || 0) > 0).length,
    requested: users.filter(u => (u.requestedCount || 0) > 0).length,
    rejected: users.filter(u => (u.rejectedCount || 0) > 0).length,
    clicks: users.filter(u => (u.clickCount || 0) > 0).length,
    failedLogins: users.filter(u => u.logs.some(l => l.status === 'failed')).length,
    searchedSomething: users.filter(u => u.hasSearchActivity).length,
    totalSent: globalMailMetrics.total,
    sentToday: globalMailMetrics.today
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Recent Activity Monitoring</h1>
          <p className="text-muted-foreground">Monitor real-time user behavior, interact, and manage targeted outreach.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedUserIds.size > 0 && (
            <div className="flex items-center gap-2 bg-muted p-1 rounded-md border mr-2 animate-in fade-in slide-in-from-right-4 flex-wrap">
              <span className="text-xs font-semibold px-2">{selectedUserIds.size} Selected</span>
              <Button size="sm" variant="default" className="h-8" onClick={() => handleBulkMail('welcome')} disabled={bulkMailSending}>
                <Mail className="w-3 h-3 mr-2" /> Welcome
              </Button>
              <Button size="sm" variant="default" className="h-8" onClick={() => handleBulkMail('referral')} disabled={bulkMailSending}>
                <Send className="w-3 h-3 mr-2" /> Referral
              </Button>
              <Button size="sm" variant="default" className="h-8 bg-indigo-600 hover:bg-indigo-700" onClick={() => handleBulkMail('welcome_referral')} disabled={bulkMailSending}>
                <Mail className="w-3 h-3 mr-2" /> Welcome + Referral
              </Button>
              <Button size="sm" variant="destructive" className="h-8" onClick={() => handleBulkMail('warning')} disabled={bulkMailSending}>
                <AlertTriangle className="w-3 h-3 mr-2" /> Warn
              </Button>

              <Button size="sm" variant="outline" className="h-8 bg-background" disabled={bulkMailSending} onClick={() => setScheduleMailOpen(true)}>
                <CalendarClock className="w-3 h-3 mr-2" /> Schedule
              </Button>
              <BulkMailScheduler
                open={scheduleMailOpen}
                onOpenChange={setScheduleMailOpen}
                selectedUsers={users.filter(u => selectedUserIds.has(u.user_id))}
                onConfirmSchedule={async (queue: QueueItem[]) => {
                  setBulkMailSending(true);
                  let successCount = 0;
                  try {
                    for (const q of queue) {
                      let subject = '';
                      let body = '';
                      if (q.type === 'welcome') {
                        subject = 'Welcome to Moustache Leads! 🚀';
                        body = `Hey there! Welcome ${q.username} 😊<br/><br/>Here’s our Teams link — feel free to join anytime. We’re there to help you with offers, tracking, or anything you need:<br/><a href="https://teams.live.com/l/invite/FEAkABBHjfqCMqxtR8?v=g1">https://teams.live.com/l/invite/FEAkABBHjfqCMqxtR8?v=g1</a><br/><br/>You can also ask questions anytime — we’re happy to help.<br/>By the way, what traffic sources are you currently working with?<br/><br/>Please set up your placement and postback here:<br/><a href="https://www.moustacheleads.com/dashboard/placements">https://www.moustacheleads.com/dashboard/placements</a><br/><br/>If you need help, reach us on Teams or Telegram: @mlaffil<br/>Support is also available here:<br/><a href="https://www.moustacheleads.com/dashboard/support">https://www.moustacheleads.com/dashboard/support</a><br/><br/>Looking forward to working with you! 🚀<br/><br/>Best regards,<br/>Team Moustache Leads`;
                      } else if (q.type === 'referral') {
                        subject = 'Have you seen our Referral Program?';
                        body = `Hey ${q.username}<br/><br/>Hope you're doing well 🙂<br/><br/>Just wanted to check — have you had a chance to look at our referral program?<br/><br/>If yes, we’d love to hear your thoughts. And if you have any doubts or need clarity on anything, feel free to share — we’re happy to help.<br/><br/>Looking forward to your response!<br/><br/>Best regards,<br/>Team Moustache Leads`;
                      } else if (q.type === 'warning') {
                        subject = 'Important Notice Regarding Your Account Activity';
                        body = `Hey ${q.username},<br/><br/>We have detected some unusual activity on your account recently.<br/>Please review your account security and ensure your postbacks are set up correctly.<br/>If you have any questions or believe this is an error, please reach out to support immediately.<br/><br/>Best regards,<br/>Team Moustache Leads`;
                      } else if (q.type === 'welcome_referral') {
                        subject = 'Welcome to Moustache Leads & Our Referral Program! 🚀';
                        body = `Hey there! Welcome ${q.username} 😊<br/><br/>Here’s our Teams link — feel free to join anytime. We’re there to help you with offers, tracking, or anything you need:<br/><a href="https://teams.live.com/l/invite/FEAkABBHjfqCMqxtR8?v=g1">https://teams.live.com/l/invite/FEAkABBHjfqCMqxtR8?v=g1</a><br/><br/>You can also ask questions anytime — we’re happy to help.<br/>By the way, what traffic sources are you currently working with?<br/><br/>Please set up your placement and postback here:<br/><a href="https://www.moustacheleads.com/dashboard/placements">https://www.moustacheleads.com/dashboard/placements</a><br/><br/>If you need help, reach us on Teams or Telegram: @mlaffil<br/>Support is also available here:<br/><a href="https://www.moustacheleads.com/dashboard/support">https://www.moustacheleads.com/dashboard/support</a><br/><br/>Also, have you had a chance to look at our referral program? If yes, we’d love to hear your thoughts. And if you have any doubts or need clarity on anything, feel free to share — we’re happy to help.<br/><br/>Looking forward to working with you! 🚀<br/><br/>Best regards,<br/>Team Moustache Leads`;
                      }

                      try {
                        const scheduleIso = new Date(q.scheduledTime).toISOString();
                        await loginLogsService.sendCustomMail([q.email], subject, body, scheduleIso);
                        successCount++;
                      } catch (e) {
                        console.error(`Failed to send mail to ${q.email}`, e);
                      }
                    }
                    toast({
                      title: 'Bulk Mail Scheduled',
                      description: `Successfully scheduled ${successCount} out of ${queue.length} mails.`
                    });
                    loadData();
                    return true;
                  } catch (e) {
                    return false;
                  } finally {
                    setBulkMailSending(false);
                  }
                }}
              />
              <Button
                size="sm"
                variant="default"
                className="h-8 bg-purple-600 hover:bg-purple-700 text-white border-none shadow-sm"
                disabled={bulkMailSending}
                onClick={() => setBulkAutomationOpen(true)}
              >
                <Zap className="w-3 h-3 mr-2 fill-white" /> Automate Offers
              </Button>
              <BulkOfferAutomationDialog
                open={bulkAutomationOpen}
                onOpenChange={setBulkAutomationOpen}
                selectedUsers={users.filter(u => selectedUserIds.has(u.user_id))}
                onScheduled={() => {
                  setBulkAutomationOpen(false);
                  setQueueDashboardOpen(true);
                }}
              />
            </div>
          )}

          <OfferQueueDashboardModal
            open={queueDashboardOpen}
            onOpenChange={setQueueDashboardOpen}
            allUsers={users.map(u => ({
              user_id: u.user_id,
              username: u.username,
              logs: u.logs,
              country: u.country,
              isSuspicious: u.isSuspicious,
              sharedAccount: u.sharedAccount,
              hasDifferentLocations: u.hasDifferentLocations,
              hasNewDevice: u.hasNewDevice,
              failedLogin: u.failedLogin
            }))}
          />

          <Button size="sm" variant="secondary" className="h-8 bg-slate-800 text-white hover:bg-slate-700 ml-2" onClick={() => setQueueDashboardOpen(true)}>
            Live Queue
          </Button>
          <Button size="sm" variant="outline" className="h-8 border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => setAutomationQueueOpen(true)}>
            <Zap className="w-3 h-3 mr-2 fill-amber-500 text-amber-500" /> Automation Flow
          </Button>
          <Button size="sm" variant="outline" className="h-8 border-indigo-200 text-indigo-700 hover:bg-indigo-50" onClick={() => setAutomationSettingsOpen(true)}>
            <Zap className="w-3 h-3 mr-2 text-indigo-600" /> Automation Engine
          </Button>
          <Button size="sm" variant="outline" className="h-8 border-indigo-200 text-indigo-700 hover:bg-indigo-50" onClick={() => setMessagingHubOpen(true)}>
            <MessageSquare size={14} className="mr-2 text-indigo-600" /> Support Hub
          </Button>
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-[160px] bg-background">
              <SelectValue placeholder="Time Filter" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="30m">30 Minutes</SelectItem>
              <SelectItem value="1h">1 Hour</SelectItem>
              <SelectItem value="4h">4 Hours</SelectItem>
              <SelectItem value="10h">10 Hours</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="2d">2 Days</SelectItem>
              <SelectItem value="1w">1 Week</SelectItem>
              <SelectItem value="2w">2 Weeks</SelectItem>
              <SelectItem value="1mo">1 Month</SelectItem>
              <SelectItem value="2mo">2 Months</SelectItem>
              <SelectItem value="3mo">3 Months</SelectItem>
              <SelectItem value="6mo">6 Months</SelectItem>
              <SelectItem value="1y">1 Year</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          {timeFilter === 'custom' && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-4">
              <Input type="date" className="w-[140px] h-10 bg-background" value={customDateRange.start} onChange={e => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))} />
              <span className="text-muted-foreground text-sm">to</span>
              <Input type="date" className="w-[140px] h-10 bg-background" value={customDateRange.end} onChange={e => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))} />
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 w-[180px] bg-background"
            />
          </div>

          <Select value={advancedFilters.loginCount} onValueChange={v => setAdvancedFilters(prev => ({ ...prev, loginCount: v }))}>
            <SelectTrigger className="w-[140px] bg-background">
              <SelectValue placeholder="Login Count" />
            </SelectTrigger>
            <SelectContent>
              {['Any', '1x', '2x', '3x', '4x', '5x+'].map(opt => (
                <SelectItem key={opt} value={opt}>Logins: {opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setFilterModalOpen(true)} variant={advancedFilters.geos.length || advancedFilters.cities.length || advancedFilters.status.length || advancedFilters.loginCount !== 'Any' ? 'default' : 'outline'} className={advancedFilters.geos.length || advancedFilters.cities.length || advancedFilters.status.length || advancedFilters.loginCount !== 'Any' ? 'bg-primary' : 'bg-background'}>
            <Filter className="h-4 w-4 mr-2" />
            Filters {(advancedFilters.geos.length + advancedFilters.cities.length + advancedFilters.status.length + (advancedFilters.loginCount !== 'Any' ? 1 : 0)) > 0 && `(${(advancedFilters.geos.length + advancedFilters.cities.length + advancedFilters.status.length + (advancedFilters.loginCount !== 'Any' ? 1 : 0))})`}
          </Button>
          <Button onClick={loadData} variant="outline" disabled={loading} className="bg-background">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <AdvancedFilterModal
        open={filterModalOpen}
        onOpenChange={setFilterModalOpen}
        filters={advancedFilters}
        setFilters={setAdvancedFilters}
        availableGeos={availableGeos}
        availableCities={availableCities}
        availableVerticals={availableVerticals}
      />

      {/* Summary Widgets */}
      <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-4">
        <Card 
          className={`shadow-sm cursor-pointer transition-all hover:scale-105 hover:shadow-md ${advancedFilters.status.length === 0 && advancedFilters.mailStatus.length === 0 ? 'ring-2 ring-blue-500 bg-blue-50/20' : ''}`}
          onClick={() => setQuickFilter('reset', null)}
        >
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Users className="w-6 h-6 text-blue-500 mb-2" />
            <div className="text-2xl font-bold">{summary.uniqueUsers}</div>
            <div className="text-xs text-muted-foreground font-semibold">Total Users</div>
          </CardContent>
        </Card>

        <Card 
          className={`shadow-sm cursor-pointer transition-all hover:scale-105 ${advancedFilters.status.includes('Failed Logins Only') ? 'ring-2 ring-rose-500 bg-rose-50' : ''}`}
          onClick={() => setQuickFilter('status', 'Failed Logins Only')}
        >
          <CardContent className="p-4 flex flex-col items-center text-center">
            <AlertCircle className="w-6 h-6 text-rose-500 mb-2" />
            <div className="text-2xl font-bold text-rose-600">{summary.failedLogins}</div>
            <div className="text-xs text-muted-foreground font-semibold">Failed Logins</div>
          </CardContent>
        </Card>

        <Card 
          className={`shadow-sm border-l-red-500 border-l-4 cursor-pointer transition-all hover:scale-105 ${advancedFilters.status.includes('Suspicious') ? 'ring-2 ring-red-500 bg-red-50' : ''}`}
          onClick={() => setQuickFilter('status', 'Suspicious')}
        >
          <CardContent className="p-4 flex flex-col items-center text-center">
            <ShieldAlert className="w-6 h-6 text-red-500 mb-2" />
            <div className="text-2xl font-bold text-red-600">{summary.suspicious}</div>
            <div className="text-xs text-muted-foreground font-semibold">Suspicious</div>
          </CardContent>
        </Card>

        <Card 
          className={`shadow-sm cursor-pointer transition-all hover:scale-105 ${advancedFilters.mailStatus.includes('Welcome Mail Not Sent') ? 'ring-2 ring-orange-500 bg-orange-50' : ''}`}
          onClick={() => setQuickFilter('mailStatus', 'Welcome Mail Not Sent')}
        >
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Mail className="w-6 h-6 text-orange-500 mb-2" />
            <div className="text-2xl font-bold">{summary.noWelcome}</div>
            <div className="text-xs text-muted-foreground font-semibold">Missing Welcome</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors" onClick={() => setQuickFilter('mailStatus', 'Welcome Mail Sent')}>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <CheckCircle className="w-6 h-6 text-primary mb-2" />
            <div className="text-2xl font-bold">{summary.totalSent}</div>
            <div className="text-xs text-muted-foreground font-semibold">Total Emails</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-4 mb-6">
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            className={`h-8 text-[11px] rounded-xl border-slate-200 bg-white shadow-sm gap-2 ${advancedFilters.status.includes('Clicks') ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-blue-100' : 'hover:bg-slate-50'}`}
            onClick={() => setQuickFilter('status', advancedFilters.status.includes('Clicks') ? null : 'Clicks')}
          >
            <MousePointerClick size={14} className={advancedFilters.status.includes('Clicks') ? 'text-blue-500' : 'text-slate-400'} />
            Clicks
          </Button>
        </div>

        {(advancedFilters.status.length > 0 || advancedFilters.mailStatus.length > 0 || advancedFilters.geos.length > 0 || advancedFilters.verticals.length > 0 || advancedFilters.countries.length > 0) && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setQuickFilter('reset', null)}
            className="h-8 text-[10px] text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl uppercase tracking-wider"
          >
            <XCircle size={12} className="mr-1" /> Clear Filters
          </Button>
        )}
      </div>

      <div id="user-activity-feed" className="scroll-mt-24" />

      {/* Automation Flow Visualizer */}
      <Card className="shadow-sm border border-slate-200 overflow-hidden bg-white mt-6 mb-2">
        <CardHeader className="py-2.5 px-4 border-b bg-slate-50/50">
          <CardTitle className="text-xs font-bold flex items-center gap-2 uppercase tracking-tight text-slate-600">
            <Zap size={14} className="text-amber-500 fill-amber-500" /> Automation Engine Flow Tracking
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-1 md:grid-cols-5 divide-x divide-slate-100">
            <div className="p-4 flex flex-col items-center text-center group hover:bg-slate-50/50 transition-colors">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <LogIn size={20} className="text-slate-600" />
              </div>
              <div className="text-xl font-bold text-slate-900">{summary.uniqueUsers}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase">User Logs In</div>
              <p className="text-[9px] text-slate-400 mt-1">Total active users tracked</p>
            </div>

            <div className="p-4 flex flex-col items-center text-center group hover:bg-emerald-50/30 transition-colors relative">
              <div className="absolute top-1/2 -left-3 -translate-y-1/2 z-10 text-slate-300 hidden md:block"><ChevronRight size={24} /></div>
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Users size={20} className="text-emerald-600" />
              </div>
              <div className="text-xl font-bold text-emerald-600">
                {Math.max(0, (summary.uniqueUsers || 0) - (automationStats.active || 0) - (automationStats.inCooldown || 0))}
              </div>
              <div className="text-[10px] font-bold text-emerald-600/70 uppercase">Eligible Users</div>
              <p className="text-[9px] text-slate-400 mt-1">Passed cooldown check</p>
            </div>

            <div className="p-4 flex flex-col items-center text-center group hover:bg-blue-50/30 transition-colors relative">
              <div className="absolute top-1/2 -left-3 -translate-y-1/2 z-10 text-slate-300 hidden md:block"><ChevronRight size={24} /></div>
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform animate-pulse">
                <Clock size={20} className="text-blue-600" />
              </div>
              <div className="text-xl font-bold text-blue-600">
                {automationStats.active}
              </div>
              <div className="text-[10px] font-bold text-blue-600/70 uppercase">Wait 5h Delay</div>
              <p className="text-[9px] text-slate-400 mt-1">Queue start pending</p>
            </div>

            <div className="p-4 flex flex-col items-center text-center group hover:bg-indigo-50/30 transition-colors relative">
              <div className="absolute top-1/2 -left-3 -translate-y-1/2 z-10 text-slate-300 hidden md:block"><ChevronRight size={24} /></div>
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Send size={20} className="text-indigo-600" />
              </div>
              <div className="text-xl font-bold text-indigo-600">{summary.totalSent}</div>
              <div className="text-[10px] font-bold text-indigo-600/70 uppercase">Step 1-5 Cycle</div>
              <p className="text-[9px] text-slate-400 mt-1">Mails being delivered</p>
            </div>

            <div className="p-4 flex flex-col items-center text-center group hover:bg-amber-50/30 transition-colors relative">
              <div className="absolute top-1/2 -left-3 -translate-y-1/2 z-10 text-slate-300 hidden md:block"><ChevronRight size={24} /></div>
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <ShieldCheck size={20} className="text-amber-600" />
              </div>
              <div className="text-xl font-bold text-amber-600">{automationStats.completed}</div>
              <div className="text-[10px] font-bold text-amber-600/70 uppercase">1-Week Cooldown</div>
              <p className="text-[9px] text-slate-400 mt-1">Locked from new cycle</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Map and Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm overflow-hidden border">
          <CardHeader className="py-3 px-4 border-b bg-muted/30">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" /> User Geo-Distribution ({mapMarkers.length} Markers)
            </CardTitle>
          </CardHeader>
          <CardContent id="map-container" className="p-0 relative h-[400px] bg-[#111827] overflow-hidden rounded-b-xl" onMouseLeave={() => setTooltip(null)} onWheel={handleMapWheel}>
            {/* Map Controls */}
            <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
              <Button size="icon" variant="secondary" className="w-8 h-8 rounded shadow-md bg-white/20 hover:bg-white/30 border border-white/20 text-white backdrop-blur-md" onClick={() => setMapZoom(prev => Math.min(prev * 1.5, 400))}>
                <Plus className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="secondary" className="w-8 h-8 rounded shadow-md bg-white/20 hover:bg-white/30 border border-white/20 text-white backdrop-blur-md" onClick={() => setMapZoom(prev => Math.max(prev / 1.5, 1))}>
                <Minus className="w-4 h-4" />
              </Button>
            </div>

            <ComposableMap projectionConfig={{ scale: 140, center: mapCenter }} style={{ width: '100%', height: '100%' }}>
              <ZoomableGroup zoom={mapZoom} center={mapCenter} onMoveEnd={({ coordinates, zoom: z }) => { setMapCenter(coordinates as [number, number]); setMapZoom(z); }}>
                <Geographies geography={GEO_URL}>
                  {({ geographies }) => geographies.map(geo => (
                    <Geography key={geo.rsmKey} geography={geo} fill="#1e3a8a" stroke="#1e40af" strokeWidth={0.5} style={{ hover: { fill: '#1e40af', outline: 'none' }, default: { outline: 'none' }, pressed: { outline: 'none' } }} />
                  ))}
                </Geographies>
                {mapMarkers.map((u, idx) => (
                  <Marker key={`${u.user_id}-${idx}`} coordinates={[u.lng!, u.lat!]} onClick={() => {
                    setExpandedId(u.user_id);
                    setHighlightedRowId(u.user_id);
                    setTimeout(() => setHighlightedRowId(null), 2500); // Clear highlight after flash
                    const element = document.getElementById(`user-row-${u.user_id}`);
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                  }}>
                    <g
                      className="cursor-pointer transition-transform hover:scale-110"
                      onMouseEnter={(e) => {
                        const parent = document.getElementById('map-container');
                        const parentRect = parent?.getBoundingClientRect();
                        const rect = e.currentTarget.getBoundingClientRect();
                        if (parentRect) {
                          setTooltip({
                            x: (rect.left + rect.width / 2) - parentRect.left,
                            y: rect.top - parentRect.top - 10,
                            text: `${u.username} (${u.city || u.country || 'Unknown'})`
                          });
                        }
                        setHighlightedRowId(u.user_id);
                      }}
                      onMouseLeave={() => {
                        setTooltip(null);
                        setHighlightedRowId(null);
                      }}
                    >
                      {/* Animated Pulse (Enhanced visibility) */}
                      <circle cx={0} cy={0} r={18} fill={(u as any).isJittered ? '#3b82f6' : (u.isSuspicious ? '#ef4444' : '#22c55e')} opacity="0.4">
                        <animate attributeName="r" from="10" to="24" dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" from="0.7" to="0" dur="2s" repeatCount="indefinite" />
                      </circle>

                      {/* Main Marker Shadow */}
                      <circle cx={0} cy={0} r={selectedUserIds.has(u.user_id) ? 18 : 14} fill="rgba(0,0,0,0.5)" transform="translate(1.5, 1.5)" />

                      {/* Main Marker Circle (Larger) */}
                      <circle cx={0} cy={0} r={selectedUserIds.has(u.user_id) ? 15 : 12} fill={(u as any).isJittered ? '#3b82f6' : (u.isSuspicious ? '#ef4444' : '#22c55e')} stroke="#fff" strokeWidth={2} />

                      {/* Marker Label */}
                      <text textAnchor="middle" y={4} style={{ fontSize: '8px', fill: '#fff', fontWeight: 'bold', pointerEvents: 'none' }}>
                        {u.username.substring(0, 2).toUpperCase()}
                      </text>

                      {/* Username Label (Visible when zoomed in or when hover is active) */}
                      {(mapZoom >= 3 || tooltip?.text.startsWith(u.username)) && (
                        <text
                          textAnchor="middle"
                          y={-18}
                          style={{ fontFamily: "Inter, sans-serif", fontSize: "10px", fontWeight: "bold", fill: "#ffffff", filter: "drop-shadow(0px 1px 2px rgba(0,0,0,0.8))" }}
                        >
                          {u.username}
                        </text>
                      )}
                    </g>
                  </Marker>
                ))}
              </ZoomableGroup>
            </ComposableMap>
            {tooltip && (
              <div className="absolute z-50 px-2 py-1 bg-black/80 text-white text-[10px] rounded pointer-events-none whitespace-nowrap transform -translate-x-1/2" style={{ left: tooltip.x, top: tooltip.y }}>
                {tooltip.text}
              </div>
            )}

            {/* Legend as requested */}
            <div className="absolute bottom-4 left-4 flex gap-4 text-[10px] text-white bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]"></span> Online ({users.filter(u => !u.isSuspicious && !u.logs.some(l => l.status === 'failed')).length})</div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span> Logged In ({users.length})</div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span> Failed ({users.filter(u => u.logs.some(l => l.status === 'failed')).length})</div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]"></span> Suspicious ({users.filter(u => u.isSuspicious).length})</div>
            </div>

            <div className="absolute bottom-2 right-2 text-[9px] text-white/30 pointer-events-none">Zoom: {(mapZoom).toFixed(1)}x · Scroll to zoom</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border">
          <CardHeader className="py-3 px-4 border-b bg-muted/30">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> Activity Volume
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 h-[300px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="time" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis fontSize={10} axisLine={false} tickLine={false} />
                  <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="logins" fill="#3b82f6" radius={[4, 4, 0, 0]} onClick={(data) => {
                    const matchingUsers = users.filter(u => u.logs.some(l => {
                      return getChartKey(l.login_time, timeFilter) === data.time;
                    }));
                    const newSet = new Set(selectedUserIds);
                    matchingUsers.forEach(u => newSet.add(u.user_id));
                    setSelectedUserIds(newSet);
                    toast({ title: "Users Selected", description: `Selected ${matchingUsers.length} users from ${data.time} segment.` });
                  }} className="cursor-pointer hover:opacity-80" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm italic">No data</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4 flex-wrap py-2 px-1 mb-1 mt-4">
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="w-2.5 h-2.5 rounded-sm bg-[#378ADD]"></span>Suspicious IP</span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="w-2.5 h-2.5 rounded-sm bg-[#E24B4A]"></span>Failed login</span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="w-2.5 h-2.5 rounded-sm bg-[#7F77DD]"></span>Multiple logins</span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="w-2.5 h-2.5 rounded-sm bg-[#BA7517]"></span>New device</span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="w-2.5 h-2.5 rounded-sm bg-border"></span>Normal</span>
      </div>

      {/* User List */}
      <Card className="shadow-sm border">
        <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between bg-muted/30">
          <div className="flex items-center gap-4">
            <Checkbox checked={users.length > 0 && selectedUserIds.size === users.length} onCheckedChange={toggleAll} />
            <CardTitle className="text-sm font-semibold">User Activity Feed ({users.length} Users)</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <RefreshCw className="h-8 w-8 animate-spin mb-4" />
              <p>Gathering user intelligence...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Activity className="h-12 w-12 mb-4 opacity-20" />
              <p>No activity found in the selected time range.</p>
            </div>
          ) : (
            <div className="divide-y max-h-[800px] overflow-y-auto scrollbar-thin">
              {users.map(user => {
                const isSelected = selectedUserIds.has(user.user_id);
                const isExpanded = expandedId === user.user_id;

                const getUserTheme = () => {
                  const hasFailed = user.logs.some(l => l.status === 'failed');
                  const isSuspicious = user.isSuspicious;
                  const isMulti = user.login_count >= 3;
                  const isNewDevice = user.logs.some(l => l.device_change_detected);

                  const badges: { text: string, cls: string, icon?: React.ReactNode }[] = [];
                  if (user.sharedAccount) badges.push({ text: 'Shared Account?', cls: 'bg-red-600 text-white animate-pulse', icon: <ShieldAlert size={10} /> });
                  else if (user.hasDifferentLocations) badges.push({ text: 'Suspicious Location', cls: 'bg-[#F7C1C1] text-[#791F1F]', icon: <MapPin size={10} /> }); // RED
                  else if (isSuspicious) badges.push({ text: 'Suspicious IP', cls: 'bg-[#B5D4F4] text-[#0C447C]', icon: <Fingerprint size={10} /> }); // BLUE

                  if (hasFailed) badges.push({ text: 'Failed', cls: 'bg-[#F7C1C1] text-[#791F1F]', icon: <ShieldAlert size={10} /> });
                  if (isNewDevice) badges.push({ text: 'New device', cls: 'bg-[#FAC775] text-[#633806]', icon: <Monitor size={10} /> });
                  if (isMulti) badges.push({ text: `${user.login_count}x logins`, cls: 'bg-[#CECBF6] text-[#3C3489]', icon: <Activity size={10} /> });
                  if (user.hasSearchActivity) badges.push({ text: 'Searched', cls: 'bg-purple-100 text-purple-700 border border-purple-200', icon: <Search size={10} /> });
                  if (badges.length === 0) badges.push({ text: 'OK', cls: 'bg-[#C0DD97] text-[#27500A]', icon: <CheckCircle size={10} /> });

                  let theme = { row: 'bg-muted/10 border-transparent hover:border-border', bar: 'bg-border', avatar: 'bg-[#D3D1C7] text-[#2C2C2A]', loginBadge: 'bg-[#D3D1C7] text-[#2C2C2A]' };
                  if (hasFailed || user.hasDifferentLocations) {
                    theme = { row: 'bg-[#FCEBEB] border-transparent hover:border-[#F7C1C1]', bar: 'bg-[#E24B4A]', avatar: 'bg-[#F7C1C1] text-[#791F1F]', loginBadge: 'bg-[#F7C1C1] text-[#791F1F]' };
                  } else if (isMulti && !isSuspicious) { // Prioritize suspicious over multi
                    theme = { row: 'bg-[#EEEDFE] border-transparent hover:border-[#CECBF6]', bar: 'bg-[#7F77DD]', avatar: 'bg-[#CECBF6] text-[#3C3489]', loginBadge: 'bg-[#CECBF6] text-[#3C3489]' };
                  } else if (isSuspicious) {
                    theme = { row: 'bg-[#E6F1FB] border-transparent hover:border-[#B5D4F4]', bar: 'bg-[#378ADD]', avatar: 'bg-[#B5D4F4] text-[#0C447C]', loginBadge: 'bg-[#B5D4F4] text-[#0C447C]' };
                  } else if (isNewDevice) {
                    theme = { row: 'bg-[#FAEEDA] border-transparent hover:border-[#FAC775]', bar: 'bg-[#BA7517]', avatar: 'bg-[#FAC775] text-[#633806]', loginBadge: 'bg-[#FAC775] text-[#633806]' };
                  }
                  return { theme, badges };
                };
                const { theme, badges } = getUserTheme();

                const isHighlighted = highlightedRowId === user.user_id;

                return (
                  <div key={user.user_id} id={`user-row-${user.user_id}`}>
                    <div
                      className={`flex items-stretch rounded-md my-1.5 overflow-hidden border-[0.5px] cursor-pointer transition-colors duration-200 hover:shadow-sm ${isHighlighted ? 'bg-yellow-100 ring-2 ring-yellow-400 scale-[1.02] shadow-md border-yellow-300 z-20 relative' : theme.row} ${isSelected ? 'ring-1 ring-primary z-10 relative' : ''}`}
                      onClick={() => setExpandedId(isExpanded ? null : user.user_id)}
                    >
                      <div className={`w-[3px] shrink-0 transition-colors duration-500 ${isHighlighted ? 'bg-yellow-500' : theme.bar}`}></div>
                      <div className="flex items-center gap-3 p-1.5 pr-4 w-full min-w-0">
                        <div className="flex items-center gap-2 pl-2" onClick={e => e.stopPropagation()}>
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleUserSelection(user.user_id)} />
                        </div>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium shrink-0 ${theme.avatar}`}>
                          {user.username.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0 w-[120px] shrink-0">
                          <span
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer truncate"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (user.lat !== undefined && user.lng !== undefined) {
                                setMapCenter([user.lng, user.lat]);
                                setMapZoom(6);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                toast({
                                  title: `Locating ${user.username}`,
                                  description: `Center map on ${user.city || 'Unknown'}, ${user.country || 'Unknown'}`
                                });
                              }
                            }}
                          >
                            {user.username}
                          </span>
                          <span className="text-[10px] text-muted-foreground truncate">{user.email}</span>
                        </div>

                      <div className="flex gap-1 shrink-0 w-[180px] flex-wrap items-center">
                        {badges.map((b, i) => (
                          <span key={i} className={`text-[8px] px-1.5 py-0.5 rounded-md whitespace-nowrap font-bold flex items-center gap-1 uppercase tracking-tighter ${b.cls}`}>
                            {b.icon} {b.text}
                          </span>
                        ))}
                      </div>

                        <div className="flex flex-col shrink-0 w-[150px] text-[10px]">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Clock size={10} className="opacity-50" />
                            <span className="font-medium text-slate-700">
                              {new Date(user.latest_login).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-[9px] opacity-60">
                              {(() => {
                                const d = new Date(user.latest_login);
                                const today = new Date();
                                const yesterday = new Date();
                                yesterday.setDate(today.getDate() - 1);

                                if (d.toDateString() === today.toDateString()) return 'Today';
                                if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
                                return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
                              })()}
                            </span>
                          </div>
                          <span className="opacity-70 truncate">– {(() => {
                            const country = user.country;
                            const city = user.city;

                            const isValid = (val: any) => val && val !== 'Unknown' && val !== 'Tracking...' && val !== 'Location Tracking...';

                            if (isValid(city) && isValid(country)) return `${city}, ${country}`;
                            if (isValid(country)) return country;
                            if (isValid(city)) return city;

                            // If we have an IP but still no location, show IP for debugging
                            const ip = user.logs?.[0]?.ip_address || '';
                            if (ip) return `Tracking... (${ip})`;

                            return 'Tracking...';
                          })()}</span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 flex-1 justify-center" onClick={e => e.stopPropagation()}>
                          <div className="flex flex-col gap-0.5 items-center w-20" title={user.welcomeMailSentAt ? `Sent: ${new Date(user.welcomeMailSentAt).toLocaleString()}` : "Welcome Mail Not Sent"}>
                            <Badge variant="outline" className={`text-[8px] h-4 px-1 w-fit border whitespace-nowrap ${user.welcomeMailSentAt ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50/50 text-red-700/80 border-red-200/50'}`}>
                              {user.welcomeMailSentAt ? <CheckCircle className="w-2 h-2 mr-1" /> : <XCircle className="w-2 h-2 mr-1" />} Welcome
                            </Badge>
                            <span className="text-[9px] text-muted-foreground whitespace-nowrap leading-none">{user.welcomeMailSentAt ? new Date(user.welcomeMailSentAt).toLocaleString([], { month: 'short', day: 'numeric' }) : 'Not Sent'}</span>
                          </div>

                          <div className="flex flex-col gap-0.5 items-center w-20" title={user.referralMailSentAt ? `Sent: ${new Date(user.referralMailSentAt).toLocaleString()}` : "Referral Mail Not Sent"}>
                            <Badge variant="outline" className={`text-[8px] h-4 px-1 w-fit border whitespace-nowrap ${user.referralMailSentAt ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-red-50/50 text-red-700/80 border-red-200/50'}`}>
                              {user.referralMailSentAt ? <CheckCircle className="w-2 h-2 mr-1" /> : <XCircle className="w-2 h-2 mr-1" />} Referral
                            </Badge>
                            <span className="text-[9px] text-muted-foreground whitespace-nowrap leading-none">{user.referralMailSentAt ? new Date(user.referralMailSentAt).toLocaleString([], { month: 'short', day: 'numeric' }) : 'Not Sent'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 justify-end ml-auto">
                          {user.isPaused && <Badge variant="secondary" className="text-[9px] uppercase bg-slate-200 text-slate-800"><PauseCircle className="w-3 h-3 mr-1" /> Paused</Badge>}
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${theme.loginBadge}`}>
                            {user.login_count}x
                          </span>
                          <div onClick={e => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6"><MoreVertical className="w-3 h-3" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => handleUserAction(user.user_id, 'View Profile')}><User className="w-4 h-4 mr-2" /> View Profile</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setExpandedId(user.user_id); }}><Activity className="w-4 h-4 mr-2" /> View Behavior</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {user.isPaused ? (
                                  <DropdownMenuItem onClick={() => handleUserAction(user.user_id, 'Unpause User')} className="text-emerald-600"><CheckCircle className="w-4 h-4 mr-2" /> Unpause User</DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => handleUserAction(user.user_id, 'Pause User')} className="text-orange-600"><PauseCircle className="w-4 h-4 mr-2" /> Pause User</DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => handleUserAction(user.user_id, 'Send Warning')} className="text-orange-600"><AlertTriangle className="w-4 h-4 mr-2" /> Send Warning Mail</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleUserAction(user.user_id, 'Send Welcome + Referral Mail')} className="text-indigo-600 font-medium"><Mail className="w-4 h-4 mr-2" /> Send Welcome + Referral</DropdownMenuItem>
                                {user.isSuspicious ? (
                                  <DropdownMenuItem onClick={() => handleUserAction(user.user_id, 'Unflag Suspicious')} className="text-emerald-600"><CheckCircle className="w-4 h-4 mr-2" /> Unflag Suspicious</DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => handleUserAction(user.user_id, 'Flag Suspicious')} className="text-red-600"><ShieldAlert className="w-4 h-4 mr-2" /> Flag Suspicious</DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </div>
                      </div>
                    </div>
                    {isExpanded && <div className="p-2 mb-2 bg-muted/10 border border-muted rounded-b-md shadow-inner animate-in slide-in-from-top-2">
                      <ExpandedUserDetails
                        user={user}
                        automationQueueItem={automationQueue.find(q => q.user_id === user.user_id)}
                        onMailSent={loadData}
                        onAutomateOffers={(userId) => {
                          setSelectedUserIds(new Set([userId]));
                          setBulkAutomationOpen(true);
                        }}
                      />
                    </div>}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Automation Engine Settings Modal */}
      <Dialog open={automationSettingsOpen} onOpenChange={setAutomationSettingsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
              <Zap className="text-amber-500 fill-amber-500" /> Automation Engine Settings
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
            <Card className="md:col-span-1 border-slate-200">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Settings size={16} /> Global Config
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <span className="text-xs font-medium">Engine Status</span>
                  <input
                    type="checkbox"
                    checked={automationSettings.enabled}
                    onChange={e => setAutomationSettings({ ...automationSettings, enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500">Delay (Hours)</label>
                  <Input type="number" value={automationSettings.initial_delay_hours} onChange={e => setAutomationSettings({ ...automationSettings, initial_delay_hours: parseInt(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500">Step Interval (Min)</label>
                  <Input type="number" value={automationSettings.step_interval_minutes} onChange={e => setAutomationSettings({ ...automationSettings, step_interval_minutes: parseInt(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500">Cooldown (Days)</label>
                  <Input type="number" value={automationSettings.cooldown_days} onChange={e => setAutomationSettings({ ...automationSettings, cooldown_days: parseInt(e.target.value) })} />
                </div>
                <Button className="w-full bg-slate-900" onClick={async () => {
                  try {
                    const token = localStorage.getItem('token');
                    // Strip internal _id and other MongoDB metadata before sending
                    const { _id, updated_at, ...cleanSettings } = automationSettings as any;

                    const res = await fetch(`${API_URL}/api/admin/automation/settings`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify(cleanSettings)
                    });

                    if (!res.ok) {
                      const errorData = await res.json().catch(() => ({}));
                      throw new Error(errorData.error || `Update failed with status ${res.status}`);
                    }

                    toast({ title: 'Success', description: 'Automation settings updated successfully' });
                  } catch (e: any) {
                    console.error("Settings update error:", e);
                    toast({
                      title: 'Update Failed',
                      description: e.message || 'Check network connection and try again',
                      variant: 'destructive'
                    });
                  }
                }}>Save Settings</Button>
              </CardContent>
            </Card>
            <Card className="md:col-span-2 border-slate-200">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Active Queue Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-3 bg-blue-50 rounded-lg text-center">
                    <p className="text-[10px] text-blue-600 font-bold uppercase">Active</p>
                    <p className="text-xl font-bold">{globalAutomationStats.active}</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg text-center">
                    <p className="text-[10px] text-green-600 font-bold uppercase">Completed</p>
                    <p className="text-xl font-bold">{globalAutomationStats.completed}</p>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg text-center">
                    <p className="text-[10px] text-red-600 font-bold uppercase">Failed</p>
                    <p className="text-xl font-bold">{globalAutomationStats.failed}</p>
                  </div>
                </div>
                <Button variant="outline" className="w-full border-amber-200 text-amber-700 hover:bg-amber-50 font-bold" onClick={() => {
                  setAutomationSettingsOpen(false);
                  setAutomationQueueOpen(true);
                }}>View Detailed Automation Flow</Button>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <OfferQueueDashboardModal
        open={queueDashboardOpen}
        onOpenChange={setQueueDashboardOpen}
        allUsers={users.map(u => ({
          user_id: u.user_id,
          username: u.username,
          logs: u.logs,
          country: u.country,
          isSuspicious: u.isSuspicious,
          sharedAccount: u.sharedAccount,
          hasDifferentLocations: u.hasDifferentLocations,
          hasNewDevice: u.hasNewDevice,
          failedLogin: u.failedLogin
        }))}
      />

      <AutomationQueueDashboardModal
        open={automationQueueOpen}
        onOpenChange={setAutomationQueueOpen}
        apiUrl={API_URL}
        allUsers={users.map(u => ({
          user_id: u.user_id,
          username: u.username,
          logs: u.logs,
          country: u.country,
          isSuspicious: u.isSuspicious,
          sharedAccount: u.sharedAccount,
          hasDifferentLocations: u.hasDifferentLocations,
          hasNewDevice: u.hasNewDevice,
          failedLogin: u.failedLogin
        }))}
      />

      {/* Support Hub Command Center Overlay */}
      {messagingHubOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 md:p-6 lg:p-10 animate-in fade-in duration-300">
          <div className="w-full max-w-[1600px] h-fit max-h-[90vh] bg-white rounded-[2rem] shadow-[0_32px_64px_-15px_rgba(0,0,0,0.3)] overflow-hidden border border-white/20 flex flex-col animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
            <SupportHubContent
              onClose={() => setMessagingHubOpen(false)}
              apiUrl={API_URL}
              initialUsers={users}
              initialSelectedIds={selectedUserIds}
              className="flex-1"
            />
          </div>
        </div>
      )}
    </div>
  );
};

const ALL_COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Côte d\'Ivoire', 'Cabo Verde', 'Cambodia', 'Cameroon', 'Canada', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 'Congo', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Democratic Republic of the Congo', 'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia', 'Fiji', 'Finland', 'France', 'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti', 'Holy See', 'Honduras', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'North Macedonia', 'Norway', 'Oman', 'Pakistan', 'Palau', 'Palestine State', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands', 'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria', 'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste', 'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan', 'Vanuatu', 'Venezuela', 'Vietnam', 'Worldwide', 'Yemen', 'Zambia', 'Zimbabwe'
];
const ADVANCED_VERTICALS = ['Sweeps', 'Sweepstakes', 'Finance', 'Dating', 'CPA', 'CPI', 'Crypto', 'Nutra', 'E-commerce', 'Gaming', 'Games', 'Install', 'Installs', 'Software', 'Surveys', 'Insurance', 'Health', 'Education', 'Other'];

// Vertical alias map: normalize different spellings to a canonical set for matching
const VERTICAL_ALIASES: Record<string, string[]> = {
  'SWEEPS': ['SWEEPSTAKES', 'SWEEPS', 'SWEEP'],
  'SWEEPSTAKES': ['SWEEPSTAKES', 'SWEEPS', 'SWEEP'],
  'GAMING': ['GAMING', 'GAMES', 'GAME', 'GAMES_INSTALL'],
  'GAMES': ['GAMING', 'GAMES', 'GAME', 'GAMES_INSTALL'],
  'INSTALL': ['INSTALL', 'INSTALLS', 'CPI', 'APP_INSTALL', 'GAMES_INSTALL'],
  'INSTALLS': ['INSTALL', 'INSTALLS', 'CPI', 'APP_INSTALL'],
  'CPI': ['CPI', 'INSTALL', 'INSTALLS'],
  'FINANCE': ['FINANCE', 'FINANCIAL', 'FINTECH'],
  'INSURANCE': ['INSURANCE'],
  'HEALTH': ['HEALTH', 'NUTRA', 'HEALTHCARE'],
  'NUTRA': ['NUTRA', 'HEALTH', 'HEALTHCARE'],
  'DATING': ['DATING'],
  'SURVEYS': ['SURVEYS', 'SURVEY'],
  'EDUCATION': ['EDUCATION', 'EDU'],
};

const getVerticalAliases = (v: string): string[] => {
  const upper = v.toUpperCase().trim();
  return VERTICAL_ALIASES[upper] || [upper];
};
const LOGIN_COUNTS = ['Any', '1x', '2x', '3x', '4x', '5x+'];
const STATUS_OPTIONS = ['Normal', 'Suspicious', 'Failed Logins Only', 'Searched Something', 'Approved Actions', 'Requested Actions', 'Clicked Actions', 'Viewed Offers'];
const MAIL_STATUS_OPTIONS = ['Welcome Mail Not Sent', 'Referral Mail Not Sent', 'Welcome Mail Sent', 'Referral Mail Sent', 'Call Scheduled', 'Call Completed'];

const AdvancedFilterModal: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: any;
  setFilters: (f: any) => void;
  availableGeos: string[];
  availableCities: string[];
  availableVerticals: string[];
}> = ({ open, onOpenChange, filters, setFilters, availableGeos, availableCities, availableVerticals }) => {
  const [localFilters, setLocalFilters] = React.useState(filters);
  const [searchQuery, setSearchQuery] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setLocalFilters(filters);
      setSearchQuery('');
    }
  }, [open, filters]);

  const toggleArray = (field: string, val: string) => {
    setLocalFilters((prev: any) => {
      const arr = prev[field] || [];
      return { ...prev, [field]: arr.includes(val) ? arr.filter((x: string) => x !== val) : [...arr, val] };
    });
  };

  const apply = () => {
    setFilters(localFilters);
    onOpenChange(false);
  };

  if (!open) return null;

  const q = searchQuery.toLowerCase();

  // Combine all predefined countries with any dynamic available geos that might not be in the list, and remove duplicates
  const allGeoOptions = Array.from(new Set([...ALL_COUNTRIES, ...availableGeos])).sort();

  const filteredGeos = allGeoOptions.filter(g => typeof g === 'string' && g.toLowerCase().includes(q));
  const filteredCities = availableCities.filter(c => typeof c === 'string' && c.toLowerCase().includes(q));
  const filteredLoginCounts = LOGIN_COUNTS.filter(l => typeof l === 'string' && l.toLowerCase().includes(q));
  const filteredStatus = STATUS_OPTIONS.filter(s => typeof s === 'string' && s.toLowerCase().includes(q));
  const filteredGeoPrefs = ALL_COUNTRIES.filter(g => typeof g === 'string' && g.toLowerCase().includes(q));
  // Deduplicate and normalize options
  const normalizedAdvanced = ADVANCED_VERTICALS.map(v => normalizeVertical(v));
  const allVerticalOptions = Array.from(new Set([...normalizedAdvanced, ...availableVerticals])).filter(Boolean).sort();
  const filteredVerticals = allVerticalOptions.filter(v => typeof v === 'string' && v.toLowerCase().includes(q));
  const filteredMailStatus = MAIL_STATUS_OPTIONS.filter(m => typeof m === 'string' && m.toLowerCase().includes(q));

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900 overflow-y-auto flex justify-center py-12 px-4 animate-in fade-in duration-300">
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDUpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-20"></div>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
      </div>

      <div className="w-full max-w-2xl z-10 backdrop-blur-md bg-black/20 p-8 rounded-3xl shadow-2xl border border-white/10 h-fit mt-10">
        <h2 className="text-3xl font-bold text-white mb-6">Smart Filter</h2>

        <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-purple-300/50" />
          <Input
            type="text"
            placeholder="Search filters (e.g. US, Dating, Failed)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border-white/10 text-white placeholder:text-purple-200/50 pl-10 py-6 rounded-xl text-lg focus:ring-purple-500 focus:border-purple-500 transition-all"
          />
        </div>

        {filteredGeos.length > 0 && (
          <div className="mb-8">
            <label className="block text-sm font-medium text-purple-100 mb-3">Country Filter — Which country are people currently online from?</label>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              {filteredGeos.map(opt => (
                <div key={opt} onClick={() => toggleArray('geos', opt)} className={`px-4 py-2 border rounded-full cursor-pointer text-sm font-medium transition-all ${localFilters.geos?.includes(opt) ? 'border-green-400 bg-green-500/20 text-white shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 'border-white/10 bg-white/5 text-purple-200 hover:border-white/30 hover:bg-white/10'}`}>
                  {opt}
                </div>
              ))}
            </div>
          </div>
        )}

        {filteredCities.length > 0 && (
          <div className="mb-8">
            <label className="block text-sm font-medium text-purple-100 mb-3">City Filter — Which city are people currently online from?</label>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              {filteredCities.map(opt => (
                <div key={opt} onClick={() => toggleArray('cities', opt)} className={`px-4 py-2 border rounded-full cursor-pointer text-sm font-medium transition-all ${localFilters.cities?.includes(opt) ? 'border-teal-400 bg-teal-500/20 text-white shadow-[0_0_10px_rgba(20,184,166,0.3)]' : 'border-white/10 bg-white/5 text-purple-200 hover:border-white/30 hover:bg-white/10'}`}>
                  {opt}
                </div>
              ))}
            </div>
          </div>
        )}

        {filteredLoginCounts.length > 0 && (
          <div className="mb-8">
            <label className="block text-sm font-medium text-purple-100 mb-3">What is the minimum login count?</label>
            <div className="flex flex-wrap gap-2">
              {filteredLoginCounts.map(opt => (
                <div key={opt} onClick={() => setLocalFilters({ ...localFilters, loginCount: opt })} className={`px-5 py-2 border rounded-xl cursor-pointer text-sm font-medium transition-all ${localFilters.loginCount === opt ? 'border-purple-400 bg-purple-500/20 text-white shadow-[0_0_10px_rgba(168,85,247,0.3)]' : 'border-white/10 bg-white/5 text-purple-200 hover:border-white/30 hover:bg-white/10'}`}>
                  {opt}
                </div>
              ))}
            </div>
          </div>
        )}

        {filteredStatus.length > 0 && (
          <div className="mb-8">
            <label className="block text-sm font-medium text-purple-100 mb-3">What user status are you looking for?</label>
            <div className="flex flex-wrap gap-2">
              {filteredStatus.map(opt => (
                <div key={opt} onClick={() => toggleArray('status', opt)} className={`px-4 py-2 border rounded-lg cursor-pointer text-sm font-medium transition-all ${localFilters.status?.includes(opt) ? 'border-blue-400 bg-blue-500/20 text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'border-white/10 bg-white/5 text-purple-200 hover:border-white/30 hover:bg-white/10'}`}>
                  {opt}
                </div>
              ))}
            </div>
          </div>
        )}

        {filteredGeoPrefs.length > 0 && (
          <div className="mb-8">
            <label className="block text-sm font-medium text-purple-100 mb-3">Country / Geo Preference Filter — Which geos do users prefer?</label>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              {filteredGeoPrefs.map(opt => (
                <div key={opt} onClick={() => toggleArray('geoPreferences', opt)} className={`px-4 py-2 border rounded-full cursor-pointer text-sm font-medium transition-all ${localFilters.geoPreferences?.includes(opt) ? 'border-orange-400 bg-orange-500/20 text-white shadow-[0_0_10px_rgba(249,115,22,0.3)]' : 'border-white/10 bg-white/5 text-purple-200 hover:border-white/30 hover:bg-white/10'}`}>
                  {opt}
                </div>
              ))}
            </div>
          </div>
        )}

        {filteredVerticals.length > 0 && (
          <div className="mb-8">
            <label className="block text-sm font-medium text-purple-100 mb-3">Vertical Preference Filter — Which verticals do users like?</label>
            <div className="flex flex-wrap gap-2">
              {filteredVerticals.map(opt => (
                <div key={opt} onClick={() => toggleArray('verticals', opt)} className={`px-3 py-1.5 border rounded cursor-pointer text-sm font-medium transition-all ${localFilters.verticals?.includes(opt) ? 'border-purple-400 bg-purple-500/20 text-white shadow-[0_0_10px_rgba(168,85,247,0.3)]' : 'border-white/10 bg-white/5 text-purple-200 hover:border-white/30 hover:bg-white/10'}`}>
                  {opt}
                </div>
              ))}
            </div>
          </div>
        )}

        {filteredMailStatus.length > 0 && (
          <div className="mb-8">
            <label className="block text-sm font-medium text-purple-100 mb-3">Mail Status Filter — Filter by outreach state</label>
            <div className="flex flex-wrap gap-2">
              {filteredMailStatus.map(opt => (
                <div key={opt} onClick={() => toggleArray('mailStatus', opt)} className={`px-4 py-2 border rounded-full cursor-pointer text-sm font-medium transition-all ${localFilters.mailStatus?.includes(opt) ? 'border-pink-400 bg-pink-500/20 text-white shadow-[0_0_10px_rgba(244,114,182,0.3)]' : 'border-white/10 bg-white/5 text-purple-200 hover:border-white/30 hover:bg-white/10'}`}>
                  {opt}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-10 pt-6 border-t border-white/10">
          <button className="px-5 py-3 bg-transparent border border-purple-500/30 rounded-lg text-base text-purple-300 hover:border-purple-400 hover:text-white transition-colors" onClick={() => onOpenChange(false)}>Cancel</button>
          <div className="flex gap-4">
            <button className="px-5 py-3 bg-transparent text-base text-purple-300 hover:text-white transition-colors font-medium" onClick={() => setLocalFilters({ geos: [], cities: [], geoPreferences: [], verticals: [], status: [], loginCount: 'Any', mailStatus: [] })}>Clear All</button>
            <button className="px-8 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg text-base font-semibold hover:from-purple-600 hover:to-indigo-700 transition-all shadow-lg transform hover:scale-[1.02]" onClick={apply}>Apply Filters &rarr;</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function AdminRecentActivityWithGuard() {
  return (
    <AdminPageGuard requiredTab="activity-logs">
      <AdminRecentActivity />
    </AdminPageGuard>
  );
}
