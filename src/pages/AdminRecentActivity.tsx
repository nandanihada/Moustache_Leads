import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { RefreshCw, Search, Clock, Mail, ChevronDown, ChevronRight, Activity, MapPin, Globe, FileText, Send, MoreVertical, AlertTriangle, User, PauseCircle, ShieldAlert, XCircle, CheckCircle, BarChart3, Users, CalendarClock, Filter, Plus, Minus } from 'lucide-react';
import loginLogsService, { LoginLog } from '@/services/loginLogsService';
import { useToast } from '@/hooks/use-toast';
import { AdminPageGuard } from '@/components/AdminPageGuard';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { UserIntelligenceProfile } from '@/components/UserIntelligenceProfile';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const COUNTRY_COORDS: Record<string, [number, number]> = {
  'US': [37.0902, -95.7129], 'IN': [20.5937, 78.9629], 'GB': [55.3781, -3.4360], 'UK': [55.3781, -3.4360],
  'CA': [56.1304, -106.3468], 'AU': [-25.2744, 133.7751], 'DE': [51.1657, 10.4515], 'FR': [46.2276, 2.2137],
  'JP': [36.2048, 138.2529], 'CN': [35.8617, 104.1954], 'BR': [-14.2350, -51.9253], 'RU': [61.5240, 105.3188],
  'ZA': [-30.5595, 22.9375], 'NG': [9.0820, 8.6753], 'KE': [-0.0236, 37.9062], 'SG': [1.3521, 103.8198],
  'MY': [4.2105, 101.9758], 'ID': [-0.7893, 113.9213], 'PH': [12.8797, 121.7740], 'VN': [14.0583, 108.2772],
  'TH': [15.8700, 100.9925], 'KR': [35.9078, 127.7669], 'ES': [40.4637, -3.7492], 'IT': [41.8719, 12.5674],
  'NL': [52.1326, 5.2913], 'CH': [46.8182, 8.2275], 'SE': [60.1282, 18.6435], 'NO': [60.4720, 8.4689],
  'DK': [56.2639, 9.5018], 'FI': [61.9241, 25.7482], 'PL': [51.9194, 19.1451], 'UA': [48.3794, 31.1656],
  'TR': [38.9637, 35.2433], 'EG': [26.8206, 30.8025], 'SA': [23.8859, 45.0792], 'AE': [23.4241, 53.8478],
  'IL': [31.0461, 34.8516], 'MX': [23.6345, -102.5528], 'AR': [-38.4161, -63.6167], 'CO': [4.5709, -74.2973],
  'PE': [-9.1900, -75.0152], 'CL': [-35.6751, -71.5430], 'NZ': [-40.9006, 174.8860], 'PK': [30.3753, 69.3451],
  'BD': [23.6850, 90.3563], 'LK': [7.8731, 80.7718], 'NP': [28.3949, 84.1240], 'RO': [45.9432, 24.9668],
  'XX': [0, 0] // Unknown locations map to Null Island
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
  isSuspicious: boolean;
  hasDifferentLocations?: boolean;
  isPaused?: boolean;
  welcomeMailSentAt?: string;
  referralMailSentAt?: string;
  totalMails: number;
  verticals?: string[];
  geoPreferences?: string[];
}



const ExpandedUserDetails: React.FC<{ user: AggregatedUser; onMailSent?: () => void }> = ({ user, onMailSent }) => {
  const [pageVisits, setPageVisits] = useState<any[]>([]);
  const [offerViews, setOfferViews] = useState<any[]>([]);
  const [searchLogs, setSearchLogs] = useState<any[]>([]);
  const [signals, setSignals] = useState<any>(null);
  const [offerTargeting, setOfferTargeting] = useState<any>({});
  const [scheduledActivity, setScheduledActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('login');
  const handleQuickAction = (tab: string) => {
    setActiveTab(tab);
    setTimeout(() => {
      document.getElementById('intelligence-dashboard')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  };
  
  // Restored Email State
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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const [offRes, searchRes, signalsRes, offerTargetingRes, scheduledRes] = await Promise.all([
          loginLogsService.getOfferViews(user.user_id, 20).catch(() => ({ views: [] })),
          fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/search-logs?user=${user.user_id}&per_page=10`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }).then(res => res.json()).catch(() => ({ logs: [] })),
          loginLogsService.getUserSignals(user.user_id).catch(() => null),
          loginLogsService.getInventoryMatchedOffers(user.user_id).catch(() => ({})),
          loginLogsService.getScheduledActivity(user.user_id).catch(() => ([]))
        ]);
        
        setOfferViews(offRes?.views || []);
        setSearchLogs(searchRes?.logs || []);
        setSignals(signalsRes);
        setOfferTargeting(offerTargetingRes);
        setScheduledActivity(scheduledRes?.scheduled_activity || scheduledRes?.activities || (Array.isArray(scheduledRes) ? scheduledRes : []));
        
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
              <span className="font-medium text-foreground">{new Date(log.login_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
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

      <div id="intelligence-dashboard" className="border-t border-slate-200 pt-6 mt-6">
        <UserIntelligenceProfile
          log={{...mockLog, user_id: user.user_id, username: user.username, email: user.email, geoPreferences: user.geoPreferences, verticals: user.verticals}}
          userLogs={user.logs}
          pageVisits={pageVisits}
          offerViews={offerViews}
          searchLogs={searchLogs}
          userSignals={signals}
          scheduledActivity={scheduledActivity}
          offerTargeting={offerTargeting}
          allowedTabs={['login', 'activity', 'browsing', 'reco', 'automation']}
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
  const [advancedFilters, setAdvancedFilters] = useState({
    geos: [] as string[],
    geoPreferences: [] as string[],
    verticals: [] as string[],
    status: [] as string[],
    loginCount: 'Any',
    mailStatus: [] as string[]
  });
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [bulkMailSending, setBulkMailSending] = useState(false);
  const [scheduleMailOpen, setScheduleMailOpen] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleType, setScheduleType] = useState<'welcome' | 'referral' | 'warning' | 'welcome_referral' | string>('welcome');
  const [mapCenter, setMapCenter] = useState<[number, number]>([0, 20]);
  const [mapZoom, setMapZoom] = useState(1);
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number, y: number, text: string } | null>(null);
  const [globalMailMetrics, setGlobalMailMetrics] = useState({ total: 0, today: 0 });

  const { toast } = useToast();

  const handleMapWheel = (e: React.WheelEvent) => {
    const newZoom = Math.min(Math.max(mapZoom - e.deltaY / 200, 1), 8);
    setMapZoom(newZoom);
  };

  const users = useMemo(() => {
    return allUsers.filter(u => {
      // 0. Search Term
      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase();
        if (!u.username.toLowerCase().includes(q) &&
            !u.email.toLowerCase().includes(q) &&
            !(u.first_name || '').toLowerCase().includes(q) &&
            !(u.last_name || '').toLowerCase().includes(q)) {
          return false;
        }
      }
      // 1. Login Count
      if (advancedFilters.loginCount !== 'Any') {
        const val = advancedFilters.loginCount;
        if (val === '5x+') {
           if (u.login_count < 5) return false;
        } else {
           const req = parseInt(val.replace('x', ''));
           if (u.login_count !== req) return false;
        }
      }
      // 2. Online Location (Geos)
      if (advancedFilters.geos.length > 0) {
        if (!u.country || !advancedFilters.geos.includes(u.country)) return false;
      }
      // 3. Status
      if (advancedFilters.status.length > 0) {
        let match = false;
        if (advancedFilters.status.includes('Suspicious') && u.isSuspicious) match = true;
        if (advancedFilters.status.includes('Normal') && !u.isSuspicious && !u.logs.some(l => l.status === 'failed')) match = true;
        if (advancedFilters.status.includes('Failed Logins Only')) {
           // Show ONLY users with failed logins
           if (u.logs.some(l => l.status === 'failed')) match = true;
        }
        if (!match) return false;
      }
      // 4. Mail Status
      if (advancedFilters.mailStatus && advancedFilters.mailStatus.length > 0) {
        let match = false;
        if (advancedFilters.mailStatus.includes('Welcome Mail Not Sent') && !u.welcomeMailSentAt) match = true;
        if (advancedFilters.mailStatus.includes('Referral Mail Not Sent') && !u.referralMailSentAt) match = true;
        if (advancedFilters.mailStatus.includes('Welcome Mail Sent') && u.welcomeMailSentAt) match = true;
        if (advancedFilters.mailStatus.includes('Referral Mail Sent') && u.referralMailSentAt) match = true;
        if (!match) return false;
      }
      // 5. Geo Preferences
      if (advancedFilters.geoPreferences.length > 0) {
        if (!u.geoPreferences || !advancedFilters.geoPreferences.some(g => u.geoPreferences!.includes(g))) return false;
      }
      // 6. Vertical Preferences
      if (advancedFilters.verticals.length > 0) {
        if (!u.verticals || !advancedFilters.verticals.some(v => u.verticals!.includes(v))) return false;
      }
      return true;
    });
  }, [allUsers, advancedFilters, searchTerm]);

  const loadData = async () => {
    setLoading(true);
    setSelectedUserIds(new Set());
    setExpandedId(null);
    try {
      const params: any = { page: 1, limit: 2000 };
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

      // Fetch logs and mail history in parallel
      const token = localStorage.getItem('token');
      const [logsRes, mailRes, usersRes] = await Promise.all([
        loginLogsService.getLoginLogs(params).catch(() => ({ logs: [] })),
        loginLogsService.getMailHistory(undefined, 2000).catch(() => ({ history: [] })),
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/admin/users`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()).catch(() => ({ users: [] }))
      ]);

      // Process mail history
      const mailMap = new Map<string, { welcome: string | null, referral: string | null, total: number }>();
      let mailsToday = 0;
      const todayString = new Date().toDateString();

      mailRes.history?.forEach((h: any) => {
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

      // Process users for profiles
      const profileMap = new Map<string, any>();
      usersRes.users?.forEach((u: any) => {
        profileMap.set(u._id, u);
        if (u.email) profileMap.set(u.email, u);
      });

      // Aggregate by user
      const userMap = new Map<string, AggregatedUser>();
      for (const log of logsRes.logs) {
        // Group by user_id, fallback to email if user_id is missing (e.g. failed logins)
        const key = log.user_id || log.email || log.username || log._id;
        const getLatLng = (locationObj: any, logObj: any) => {
          if (!locationObj) return { lat: undefined, lng: undefined };
          let lat = locationObj.latitude !== undefined && locationObj.latitude !== null ? Number(locationObj.latitude) : undefined;
          let lng = locationObj.longitude !== undefined && locationObj.longitude !== null ? Number(locationObj.longitude) : undefined;

          if (lat === undefined || lng === undefined || (lat === 0 && lng === 0) || isNaN(lat) || isNaN(lng)) {
            let countryCode = locationObj.country_code || locationObj.country;
            
            // Fallback for test IPs that resolve to XX
            if (!countryCode || countryCode.toUpperCase() === 'XX') {
              const ip = logObj.ip_address || '';
              if (ip.startsWith('103.150.')) countryCode = 'BD';
              else if (ip.startsWith('157.34.') || ip.startsWith('103.179.')) countryCode = 'IN';
              else if (ip.startsWith('127.0.0.1') || ip === '::1') countryCode = 'US';
              else countryCode = 'US'; // Default fallback so they are always visible
            }

            if (countryCode && typeof countryCode === 'string') {
              const fallback = COUNTRY_COORDS[countryCode.toUpperCase()];
              if (fallback && countryCode.toUpperCase() !== 'XX') {
                lat = fallback[0];
                lng = fallback[1];
              }
            }
          }
          
          if (lat === 0 && lng === 0) {
             return { lat: undefined, lng: undefined };
          }
          
          return { lat, lng };
        };

        if (!userMap.has(key)) {
          const profile = profileMap.get(log.user_id) || profileMap.get(log.email) || {};
          const userEmail = (log.email || '').toLowerCase();
          const mInfo = mailMap.get(userEmail) || { welcome: null, referral: null, total: 0 };
          const { lat, lng } = getLatLng(log.location, log);
          userMap.set(key, {
            user_id: key, // fallback to key so actions don't break
            username: log.username || log.email?.split('@')[0] || 'Unknown',
            email: log.email || 'Unknown',
            latest_login: log.login_time,
            login_count: 0,
            logs: [],
            isSuspicious: false,
            welcomeMailSentAt: mInfo.welcome || undefined,
            referralMailSentAt: mInfo.referral || undefined,
            totalMails: mInfo.total,
            lat,
            lng,
            country: log.location?.country_code || log.location?.country,
            verticals: profile.verticals || [],
            geoPreferences: profile.geos || []
          });
        }
        const userAgg = userMap.get(key)!;
        userAgg.login_count += 1;
        userAgg.logs.push(log);

        const { lat: newLat, lng: newLng } = getLatLng(log.location, log);

        if (userAgg.lat === undefined && newLat !== undefined) {
          userAgg.lat = newLat;
          userAgg.lng = newLng;
          userAgg.country = log.location?.country_code || log.location?.country || userAgg.country;
        }

        if (new Date(log.login_time) > new Date(userAgg.latest_login)) {
          userAgg.latest_login = log.login_time;
          if (newLat !== undefined) {
            userAgg.lat = newLat;
            userAgg.lng = newLng;
            userAgg.country = log.location?.country_code || log.location?.country || userAgg.country;
          }
        }
        if (log.risk_level === 'high' || log.risk_level === 'critical' || (log.fraud_score && log.fraud_score > 50)) {
          userAgg.isSuspicious = true;
        }
      }

      const sortedUsers = Array.from(userMap.values()).map(userAgg => {
        const u = profileMap.get(userAgg.user_id) || profileMap.get(userAgg.email) || profileMap.get(userAgg.username);
        
        // Find a valid 2-letter country code for mapping
        let mapCountryCode = undefined;
        // Try logs first
        for (const log of userAgg.logs) {
          if (log.location?.country_code && log.location.country_code !== 'XX' && COUNTRY_COORDS[log.location.country_code]) {
            mapCountryCode = log.location.country_code;
            break;
          }
        }
        
        if (u) {
          userAgg.first_name = u.first_name;
          userAgg.last_name = u.last_name;
          userAgg.verticals = u.verticals;
          userAgg.geoPreferences = u.geos;
          
          // If no code from logs, use the user's primary geo preference
          if (!mapCountryCode && u.geos && u.geos.length > 0 && COUNTRY_COORDS[u.geos[0]]) {
            mapCountryCode = u.geos[0];
          }
        }
        
        // Default to US if completely unknown so they show on the map
        userAgg.country = mapCountryCode || 'US';

        const uniqueCountries = new Set(userAgg.logs.map((l: any) => l.location?.country_code).filter(Boolean));
        const uniqueCities = new Set(userAgg.logs.map((l: any) => l.location?.city).filter(Boolean));
        const uniqueIps = new Set(userAgg.logs.map((l: any) => l.ip_address).filter(Boolean));
        const hasNewDevice = userAgg.logs.some((l: any) => l.device_change_detected);
        const isMulti = userAgg.login_count >= 3;

        if (uniqueCountries.size > 1 || uniqueCities.size > 1 || uniqueIps.size > 1 || (isMulti && hasNewDevice)) {
          userAgg.isSuspicious = true;
          userAgg.hasDifferentLocations = uniqueCountries.size > 1 || uniqueCities.size > 1 || uniqueIps.size > 1;
        }
        return userAgg;
      }).sort((a, b) => new Date(b.latest_login).getTime() - new Date(a.latest_login).getTime());

      setAllUsers(sortedUsers);

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
      } else if (action === 'Send Warning') {
        toast({ title: 'Warning Sent', description: `Warning mail queued for ${newU.username}.` });
      } else if (action === 'View Profile') {
        toast({ title: 'View Profile', description: `Navigating to ${newU.username}'s profile.` });
      } else if (action === 'View Behavior') {
        setExpandedId(userId);
      }
      return newU;
    }));
  };

  const mapMarkers = useMemo(() => {
    const validUsers = users.filter(u => typeof u.lat === 'number' && !isNaN(u.lat) && typeof u.lng === 'number' && !isNaN(u.lng));
    const coordsMap = new Map<string, number>();

    return validUsers.map(u => {
      const key = `${u.lat}_${u.lng}`;
      const count = coordsMap.get(key) || 0;
      coordsMap.set(key, count + 1);

      if (count === 0) return u;

      // Jitter overlapping markers into a circular cluster
      const angle = count * (Math.PI * 2 / 8);
      const distance = 6.0 + (Math.floor(count / 8) * 4.0);

      return {
        ...u,
        lat: u.lat! + (Math.sin(angle) * distance),
        lng: u.lng! + (Math.cos(angle) * distance)
      };
    });
  }, [users]);

  // Prepare chart data (Logins over time within filter)
  const chartDataMap = new Map<string, number>();

  const getChartKey = (dateStr: string, filter: string) => {
    const d = new Date(dateStr);
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
      chartDataMap.set(key, (chartDataMap.get(key) || 0) + 1);
    });
  });
  const chartData = Array.from(chartDataMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({ time: k, logins: v }));

  const summary = {
    uniqueUsers: users.length,
    totalLogins: users.reduce((acc, u) => acc + u.logs.length, 0),
    noWelcome: users.filter(u => !u.welcomeMailSentAt).length,
    noReferral: users.filter(u => !u.referralMailSentAt).length,
    suspicious: users.filter(u => u.isSuspicious).length,
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

              <Dialog open={scheduleMailOpen} onOpenChange={setScheduleMailOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="h-8 bg-background" disabled={bulkMailSending}>
                    <CalendarClock className="w-3 h-3 mr-2" /> Schedule
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Schedule Bulk Mail</DialogTitle>
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
                    <Button onClick={() => handleBulkMail(scheduleType, scheduleTime)} disabled={!scheduleTime || bulkMailSending}>
                      Confirm Schedule
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
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
              <Input type="date" className="w-[140px] h-10 bg-background" value={customDateRange.start} onChange={e => setCustomDateRange(prev => ({...prev, start: e.target.value}))} />
              <span className="text-muted-foreground text-sm">to</span>
              <Input type="date" className="w-[140px] h-10 bg-background" value={customDateRange.end} onChange={e => setCustomDateRange(prev => ({...prev, end: e.target.value}))} />
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

          <Select value={advancedFilters.loginCount} onValueChange={v => setAdvancedFilters(prev => ({...prev, loginCount: v}))}>
            <SelectTrigger className="w-[140px] bg-background">
              <SelectValue placeholder="Login Count" />
            </SelectTrigger>
            <SelectContent>
              {['Any', '1x', '2x', '3x', '4x', '5x+'].map(opt => (
                <SelectItem key={opt} value={opt}>Logins: {opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setFilterModalOpen(true)} variant={advancedFilters.geos.length || advancedFilters.status.length || advancedFilters.loginCount !== 'Any' ? 'default' : 'outline'} className={advancedFilters.geos.length || advancedFilters.status.length || advancedFilters.loginCount !== 'Any' ? 'bg-primary' : 'bg-background'}>
            <Filter className="h-4 w-4 mr-2" /> 
            Filters {(advancedFilters.geos.length + advancedFilters.status.length + (advancedFilters.loginCount !== 'Any' ? 1 : 0)) > 0 && `(${(advancedFilters.geos.length + advancedFilters.status.length + (advancedFilters.loginCount !== 'Any' ? 1 : 0))})`}
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
      />

      {/* Summary Widgets */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Users className="w-6 h-6 text-blue-500 mb-2" />
            <div className="text-2xl font-bold">{summary.uniqueUsers}</div>
            <div className="text-xs text-muted-foreground">Unique Users</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm bg-blue-50/50">
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Activity className="w-6 h-6 text-blue-400 mb-2" />
            <div className="text-2xl font-bold">{summary.totalLogins}</div>
            <div className="text-xs text-muted-foreground">Total Logins</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Mail className="w-6 h-6 text-orange-500 mb-2" />
            <div className="text-2xl font-bold">{summary.noWelcome}</div>
            <div className="text-xs text-muted-foreground">Missing Welcome Mail</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Send className="w-6 h-6 text-purple-500 mb-2" />
            <div className="text-2xl font-bold">{summary.noReferral}</div>
            <div className="text-xs text-muted-foreground">Missing Referral Mail</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-l-red-500 border-l-4">
          <CardContent className="p-4 flex flex-col items-center text-center">
            <ShieldAlert className="w-6 h-6 text-red-500 mb-2" />
            <div className="text-2xl font-bold text-red-600">{summary.suspicious}</div>
            <div className="text-xs text-muted-foreground">Suspicious Users</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm bg-primary/5">
          <CardContent className="p-4 flex flex-col items-center text-center">
            <CalendarClock className="w-6 h-6 text-indigo-500 mb-2" />
            <div className="text-2xl font-bold">{summary.sentToday}</div>
            <div className="text-xs text-muted-foreground">Mails Sent Today</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm bg-primary/5">
          <CardContent className="p-4 flex flex-col items-center text-center">
            <CheckCircle className="w-6 h-6 text-primary mb-2" />
            <div className="text-2xl font-bold">{summary.totalSent}</div>
            <div className="text-xs text-muted-foreground">Total Emails Sent</div>
          </CardContent>
        </Card>
      </div>

      {/* Map and Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm overflow-hidden border">
          <CardHeader className="py-3 px-4 border-b bg-muted/30">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" /> User Geo-Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 relative h-[400px] bg-[#111827] overflow-hidden rounded-b-xl" onMouseLeave={() => setTooltip(null)} onWheel={handleMapWheel}>
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
                {mapMarkers.map(u => (
                  <Marker key={u.user_id} coordinates={[u.lng!, u.lat!]} onClick={() => {
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
                        const rect = (e.target as SVGElement).closest('svg')?.getBoundingClientRect();
                        if (rect) setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top - 30, text: `${u.username} (${u.login_count} logins)` });
                      }}
                    >
                      {/* Glowing effect */}
                      <circle cx={0} cy={0} r={selectedUserIds.has(u.user_id) ? 14 : 10} fill={u.isSuspicious ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'} />
                      <circle cx={0} cy={0} r={selectedUserIds.has(u.user_id) ? 8 : 6} fill={u.isSuspicious ? '#ef4444' : '#22c55e'} />
                      
                      {/* Stickman Icon */}
                      <g transform="translate(-3.5, -4) scale(0.3)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="5" r="3"></circle>
                          <line x1="12" y1="8" x2="12" y2="15"></line>
                          <line x1="12" y1="15" x2="9" y2="22"></line>
                          <line x1="12" y1="15" x2="15" y2="22"></line>
                          <line x1="9" y1="10" x2="15" y2="10"></line>
                        </svg>
                      </g>
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

                  const badges: { text: string, cls: string }[] = [];
                  if (user.hasDifferentLocations) badges.push({ text: 'Suspicious Location', cls: 'bg-[#F7C1C1] text-[#791F1F]' }); // RED
                  else if (isSuspicious) badges.push({ text: 'Suspicious IP', cls: 'bg-[#B5D4F4] text-[#0C447C]' }); // BLUE

                  if (hasFailed) badges.push({ text: 'Failed', cls: 'bg-[#F7C1C1] text-[#791F1F]' });
                  if (isNewDevice) badges.push({ text: 'New device', cls: 'bg-[#FAC775] text-[#633806]' });
                  if (isMulti) badges.push({ text: `${user.login_count}x logins`, cls: 'bg-[#CECBF6] text-[#3C3489]' });
                  if (badges.length === 0) badges.push({ text: 'OK', cls: 'bg-[#C0DD97] text-[#27500A]' });

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
                      className={`flex items-stretch rounded-md my-1.5 overflow-hidden border-[0.5px] cursor-pointer transition-all duration-500 hover:shadow-sm ${isHighlighted ? 'bg-yellow-100 ring-2 ring-yellow-400 scale-[1.02] shadow-md border-yellow-300 z-20 relative' : theme.row} ${isSelected ? 'ring-1 ring-primary z-10 relative' : ''}`}
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
                          <span className="text-xs font-medium text-foreground truncate">{user.username}</span>
                          <span className="text-[10px] text-muted-foreground truncate">{user.email}</span>
                        </div>

                        <div className="flex gap-1 shrink-0 w-[180px] flex-wrap items-center">
                          {badges.map((b, i) => (
                            <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded-full whitespace-nowrap font-medium ${b.cls}`}>{b.text}</span>
                          ))}
                        </div>

                        <div className="flex items-center gap-2 shrink-0 w-[120px] text-[10px] text-muted-foreground">
                          <span>{new Date(user.latest_login).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {user.logs[0]?.location?.country_code && <span className="opacity-70">{user.logs[0].location.country_code}</span>}
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
                    {isExpanded && <div className="p-2 mb-2 bg-muted/10 border border-muted rounded-b-md shadow-inner animate-in slide-in-from-top-2"><ExpandedUserDetails user={user} onMailSent={loadData} /></div>}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const ADVANCED_GEOS = [
  'US', 'UK', 'CA', 'AU', 'DE', 'FR', 'IT', 'ES', 'BR', 'IN', 'JP', 'WW',
  'AE', 'AF', 'AL', 'AM', 'AO', 'AR', 'AT', 'AZ', 'BA', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BO', 'BS', 'BY', 'BZ', 'CD', 'CF', 'CG', 'CH', 'CI', 'CL', 'CM', 'CN', 'CO', 'CR', 'CU', 'CV', 'CY', 'CZ', 'DJ', 'DK', 'DO', 'DZ', 'EC', 'EE', 'EG', 'EH', 'ER', 'ET', 'FI', 'FJ', 'GA', 'GE', 'GH', 'GM', 'GN', 'GQ', 'GR', 'GT', 'GW', 'GY', 'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IQ', 'IR', 'IS', 'JM', 'JO', 'KE', 'KG', 'KH', 'KP', 'KR', 'KW', 'KZ', 'LA', 'LB', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MD', 'ME', 'MG', 'MK', 'ML', 'MM', 'MN', 'MR', 'MW', 'MX', 'MY', 'MZ', 'NA', 'NE', 'NG', 'NI', 'NL', 'NO', 'NP', 'NZ', 'OM', 'PA', 'PE', 'PG', 'PH', 'PK', 'PL', 'PR', 'PT', 'PY', 'QA', 'RO', 'RS', 'RU', 'RW', 'SA', 'SD', 'SE', 'SG', 'SI', 'SK', 'SL', 'SN', 'SO', 'SR', 'SS', 'SV', 'SY', 'SZ', 'TD', 'TG', 'TH', 'TJ', 'TL', 'TM', 'TN', 'TR', 'TT', 'TW', 'TZ', 'UA', 'UG', 'UY', 'UZ', 'VE', 'VN', 'YE', 'ZA', 'ZM', 'ZW'
];
const ADVANCED_VERTICALS = ['Sweeps', 'Finance', 'Dating', 'CPA', 'CPI', 'Crypto', 'Nutra', 'E-commerce', 'Gaming', 'Software', 'Surveys', 'Other'];
const LOGIN_COUNTS = ['Any', '1x', '2x', '3x', '4x', '5x+'];
const STATUS_OPTIONS = ['Normal', 'Suspicious', 'Failed Logins Only'];
const MAIL_STATUS_OPTIONS = ['Welcome Mail Not Sent', 'Referral Mail Not Sent', 'Welcome Mail Sent', 'Referral Mail Sent'];

const AdvancedFilterModal: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: any;
  setFilters: (f: any) => void;
}> = ({ open, onOpenChange, filters, setFilters }) => {
  const [localFilters, setLocalFilters] = React.useState(filters);

  React.useEffect(() => {
    if (open) setLocalFilters(filters);
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

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900 overflow-y-auto flex justify-center py-12 px-4 animate-in fade-in duration-300">
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDUpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-20"></div>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
      </div>

      <div className="w-full max-w-2xl z-10 backdrop-blur-md bg-black/20 p-8 rounded-3xl shadow-2xl border border-white/10 h-fit mt-10">
        <h2 className="text-3xl font-bold text-white mb-8">Smart Filter</h2>

        <div className="mb-8">
          <label className="block text-sm font-medium text-purple-100 mb-3">Country Filter — Which country are people currently online from?</label>
          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
            {ADVANCED_GEOS.map(opt => (
              <div key={opt} onClick={() => toggleArray('geos', opt)} className={`px-4 py-2 border rounded-full cursor-pointer text-sm font-medium transition-all ${localFilters.geos?.includes(opt) ? 'border-green-400 bg-green-500/20 text-white shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 'border-white/10 bg-white/5 text-purple-200 hover:border-white/30 hover:bg-white/10'}`}>
                {opt}
              </div>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <label className="block text-sm font-medium text-purple-100 mb-3">What is the minimum login count?</label>
          <div className="flex flex-wrap gap-2">
            {LOGIN_COUNTS.map(opt => (
              <div key={opt} onClick={() => setLocalFilters({...localFilters, loginCount: opt})} className={`px-5 py-2 border rounded-xl cursor-pointer text-sm font-medium transition-all ${localFilters.loginCount === opt ? 'border-purple-400 bg-purple-500/20 text-white shadow-[0_0_10px_rgba(168,85,247,0.3)]' : 'border-white/10 bg-white/5 text-purple-200 hover:border-white/30 hover:bg-white/10'}`}>
                {opt}
              </div>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <label className="block text-sm font-medium text-purple-100 mb-3">What user status are you looking for?</label>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map(opt => (
              <div key={opt} onClick={() => toggleArray('status', opt)} className={`px-4 py-2 border rounded-lg cursor-pointer text-sm font-medium transition-all ${localFilters.status?.includes(opt) ? 'border-blue-400 bg-blue-500/20 text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'border-white/10 bg-white/5 text-purple-200 hover:border-white/30 hover:bg-white/10'}`}>
                {opt}
              </div>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <label className="block text-sm font-medium text-purple-100 mb-3">Country / Geo Preference Filter — Which geos do users prefer?</label>
          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
            {ADVANCED_GEOS.map(opt => (
              <div key={opt} onClick={() => toggleArray('geoPreferences', opt)} className={`px-4 py-2 border rounded-full cursor-pointer text-sm font-medium transition-all ${localFilters.geoPreferences?.includes(opt) ? 'border-orange-400 bg-orange-500/20 text-white shadow-[0_0_10px_rgba(249,115,22,0.3)]' : 'border-white/10 bg-white/5 text-purple-200 hover:border-white/30 hover:bg-white/10'}`}>
                {opt}
              </div>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <label className="block text-sm font-medium text-purple-100 mb-3">Vertical Preference Filter — Which verticals do users like?</label>
          <div className="flex flex-wrap gap-2">
            {ADVANCED_VERTICALS.map(opt => (
              <div key={opt} onClick={() => toggleArray('verticals', opt)} className={`px-3 py-1.5 border rounded cursor-pointer text-sm font-medium transition-all ${localFilters.verticals?.includes(opt) ? 'border-purple-400 bg-purple-500/20 text-white shadow-[0_0_10px_rgba(168,85,247,0.3)]' : 'border-white/10 bg-white/5 text-purple-200 hover:border-white/30 hover:bg-white/10'}`}>
                {opt}
              </div>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <label className="block text-sm font-medium text-purple-100 mb-3">Mail Status Filter — Filter by outreach state</label>
          <div className="flex flex-wrap gap-2">
            {MAIL_STATUS_OPTIONS.map(opt => (
              <div key={opt} onClick={() => toggleArray('mailStatus', opt)} className={`px-4 py-2 border rounded-full cursor-pointer text-sm font-medium transition-all ${localFilters.mailStatus?.includes(opt) ? 'border-pink-400 bg-pink-500/20 text-white shadow-[0_0_10px_rgba(244,114,182,0.3)]' : 'border-white/10 bg-white/5 text-purple-200 hover:border-white/30 hover:bg-white/10'}`}>
                {opt}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between mt-10 pt-6 border-t border-white/10">
          <button className="px-5 py-3 bg-transparent border border-purple-500/30 rounded-lg text-base text-purple-300 hover:border-purple-400 hover:text-white transition-colors" onClick={() => onOpenChange(false)}>Cancel</button>
          <div className="flex gap-4">
            <button className="px-5 py-3 bg-transparent text-base text-purple-300 hover:text-white transition-colors font-medium" onClick={() => setLocalFilters({geos:[], geoPreferences:[], verticals:[], status:[], loginCount:'Any', mailStatus: []})}>Clear All</button>
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
