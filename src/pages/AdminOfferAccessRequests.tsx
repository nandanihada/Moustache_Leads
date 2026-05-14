import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Search, Users, AlertTriangle, AlertCircle, Sparkles, RefreshCw,
  Mail, MessageSquare, CheckCircle2, Inbox,
  ThumbsUp, ThumbsDown, Eye, Briefcase, UserCheck, TrendingUp,
  ChevronDown, ChevronUp, Plus, Edit, Trash2, Clock, FileImage, MousePointerClick, Send,
  Download,
} from 'lucide-react';
import { API_BASE_URL } from '@/services/apiConfig';
import { AdminPageGuard } from '@/components/AdminPageGuard';
import { useAuth } from '@/contexts/AuthContext';
import PublisherRow from '@/pages/offer-requests/PublisherRow';
import SendOffersModal from '@/pages/offer-requests/SendOffersModal';
import SendScheduleModal from '@/pages/offer-requests/SendScheduleModal';
import BulkMessageModal from '@/pages/offer-requests/BulkMessageModal';
import RequestCharts from '@/pages/offer-requests/RequestCharts';
import TabContent from '@/pages/offer-requests/TabContent';
import CampaignWizardModal from '@/pages/offer-requests/CampaignWizardModal';
import CampaignQueueTab from '@/pages/offer-requests/CampaignQueueTab';
import ExportModal from '@/pages/offer-requests/ExportModal';

// ─── Exported Types ──────────────────────────────────────────────────────────

export interface OfferReq {
  _id: string;
  request_id: string;
  offer_id: string;
  offer_name: string;
  offer_payout: number;
  offer_network: string;
  offer_category: string;
  offer_status: string;
  offer_countries: string[];
  offer_target_url?: string;
  status: string;
  requested_at: string;
  message: string;
  request_count: number;
  offer_stats: {
    total_requests: number;
    approved_count: number;
    rejected_count: number;
    pending_count: number;
    total_clicks?: number;
  };
  offer_health: { status: string; failures: { criterion: string; detail?: string }[] };
  clicks: number;
  conversions: number;
  conv_rate: number;
  last_conversion: string | null;
  approved_at?: string;
  rejected_at?: string;
  marked_for_review_at?: string;
  approved_by_username?: string;
  rejected_by_username?: string;
  marked_for_review_by?: string;
}

export interface PProf {
  user_id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  company_name: string;
  website: string;
  created_at: string;
  account_status: string;
  risk_level: string;
  fraud_score: number;
  total_clicks: number;
  total_conversions: number;
  conversion_rate: number;
  postback_url: string;
  postback_tested: boolean;
  postback_status: string;
  has_proofs: boolean;
  requests: OfferReq[];
  pending_count: number;
  latest_offer_name: string;
  latest_offer_id: string;
  mail_sent_today?: number;
  mail_total_sent?: number;
  mail_last_sent?: string | null;
  // Registration preferences
  verticals?: string[];
  geos?: string[];
  traffic_sources?: string[];
  registration_profile_completed?: boolean;
}

export interface PSt {
  totals: { clicks: number; conversions: number; conversion_rate: number; epc: number };
  daily_stats: { date: string; clicks: number; conversions: number }[];
  traffic_sources: { name: string; type: string; clicks: number; conv_rate: number }[];
  offer_views?: { offer_id: string; offer_name: string; view_count: number; global_view_count?: number }[];
}

export interface Inv {
  _id: string;
  offer_id: string;
  name: string;
  network: string;
  payout: number;
  match_strength: string;
  keywords?: string;
  request_status?: string;
  health?: { status: string; failures: { criterion: string; detail?: string }[] };
  status?: string;
  visibility?: 'active' | 'inactive' | 'running' | 'rotating';
  is_rotation_running?: boolean;
  is_in_rotation?: boolean;
  grant_count?: number;
  already_sent?: boolean;
  image_url?: string;
  thumbnail_url?: string;
  countries?: string[];
  category?: string;
  vertical?: string;
  description?: string;
  target_url?: string;
  preview_url?: string;
  tracking_url?: string;
}

// ─── Exported Helpers ────────────────────────────────────────────────────────

export function fd(d: string | Date | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return '—'; }
}

export function rsk(level: string) {
  switch (level) {
    case 'high_risk': return { bg: 'bg-red-100 dark:bg-red-900/30', t: 'text-red-700 dark:text-red-400', bd: 'border-red-300 text-red-700', lb: 'High Risk' };
    case 'warn': return { bg: 'bg-amber-100 dark:bg-amber-900/30', t: 'text-amber-700 dark:text-amber-400', bd: 'border-amber-300 text-amber-700', lb: 'Warning' };
    case 'new': return { bg: 'bg-blue-100 dark:bg-blue-900/30', t: 'text-blue-700 dark:text-blue-400', bd: 'border-blue-300 text-blue-700', lb: 'New' };
    default: return { bg: 'bg-emerald-100 dark:bg-emerald-900/30', t: 'text-emerald-700 dark:text-emerald-400', bd: '', lb: '' };
  }
}

// ─── Tab Config ──────────────────────────────────────────────────────────────

type TabId = 'all_requests' | 'approved' | 'rejected' | 'in_review' | 'direct_partner' | 'affiliate' | 'most_requested' | 'placement_proofs' | 'recent_changes' | 'history' | 'campaign_queue';

const TAB_CONFIG: { id: TabId; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
  { id: 'all_requests', label: 'All Requests', icon: Eye },
  { id: 'approved', label: 'Approved', icon: ThumbsUp },
  { id: 'rejected', label: 'Rejected', icon: ThumbsDown, adminOnly: true },
  { id: 'in_review', label: 'In Review', icon: AlertTriangle },
  { id: 'direct_partner', label: 'Direct Partner', icon: Briefcase },
  { id: 'affiliate', label: 'Affiliate', icon: UserCheck },
  { id: 'most_requested', label: 'Most Requested', icon: TrendingUp },
  { id: 'placement_proofs', label: 'Placement Proofs', icon: FileImage },
  { id: 'recent_changes', label: 'Recent Changes', icon: Clock },
  { id: 'history', label: 'Send History', icon: Inbox },
  { id: 'campaign_queue', label: 'Campaign Queue', icon: Send },
];

// ─── Summary Type ────────────────────────────────────────────────────────────

interface Summary {
  total_publishers: number;
  high_risk: number;
  warn: number;
  new: number;
  none: number;
}

// ─── Main Component ──────────────────────────────────────────────────────────

function AdminOfferAccessRequests() {
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabId) || 'all_requests';

  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [tabCounts, setTabCounts] = useState<Record<TabId, number>>({
    all_requests: 0, approved: 0, rejected: 0, in_review: 0, direct_partner: 0, affiliate: 0, most_requested: 0, placement_proofs: 0, recent_changes: 0, history: 0, campaign_queue: 0,
  });
  const [tabBreakdowns, setTabBreakdowns] = useState<Record<string, { total: number; today: number; week: number; pending?: number; approved?: number; rejected?: number }>>({});
  const [recentlyAdded, setRecentlyAdded] = useState<{ offer_id: string; name: string; network: string; at: string }[]>([]);
  const [recentlyEdited, setRecentlyEdited] = useState<{ offer_id: string; name: string; network: string; at: string }[]>([]);
  const [recentlyDeleted, setRecentlyDeleted] = useState<{ offer_id: string; name: string; network: string; at: string }[]>([]);
  const [recentCounts, setRecentCounts] = useState({ added: 0, edited: 0, deleted: 0 });
  const [recentExpanded, setRecentExpanded] = useState(false);
  const [recentDateFilter, setRecentDateFilter] = useState('today');
  const [recentSelectedOffers, setRecentSelectedOffers] = useState<Set<string>>(new Set());
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleOfferIds, setScheduleOfferIds] = useState<string[]>([]);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // Filtered recently data based on date filter
  const filterByDate = (items: { offer_id: string; name: string; network: string; at: string }[]) => {
    if (recentDateFilter === 'today') {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      return items.filter(o => o.at && new Date(o.at) >= today);
    }
    const days = recentDateFilter === '3d' ? 3 : recentDateFilter === '7d' ? 7 : 30;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
    return items.filter(o => o.at && new Date(o.at) >= cutoff);
  };
  const filteredRecentlyAdded = filterByDate(recentlyAdded);
  const filteredRecentlyEdited = filterByDate(recentlyEdited);
  const filteredRecentlyDeleted = filterByDate(recentlyDeleted);

  // ── In Review tab state (existing publisher-profile view) ──
  const [profiles, setProfiles] = useState<PProf[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('pending');
  const [riskFilter, setRiskFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState<Summary>({ total_publishers: 0, high_risk: 0, warn: 0, new: 0, none: 0 });
  const [emailStats, setEmailStats] = useState({ total_mails_sent: 0, today_mails_sent: 0, total_publishers_mailed: 0, today_publishers_mailed: 0, total_interactions: 0, today_interactions: 0, offers_interacted_total: 0, offers_interacted_today: 0, total_clicks: 0, today_clicks: 0 });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [sendModal, setSendModal] = useState<{ pub: PProf; offers?: Inv[] } | null>(null);
  const [bulkMsgModal, setBulkMsgModal] = useState<{ mode: 'email' | 'support' } | null>(null);
  const [campaignWizardOpen, setCampaignWizardOpen] = useState(false);
  const token = localStorage.getItem('token');

  // Fetch tab counts
  const fetchTabCounts = useCallback(() => {
    fetch(`${API_BASE_URL}/api/admin/offer-access-requests/tab-counts`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()).then(d => {
      // Parse counts - handle both old format (number) and new format ({total, today, week})
      const getTotal = (v: any) => typeof v === 'number' ? v : (v?.total || 0);
      const getBreakdown = (v: any) => typeof v === 'number' ? { total: v, today: 0, week: 0 } : { total: v?.total || 0, today: v?.today || 0, week: v?.week || 0 };

      setTabCounts({
        all_requests: getTotal(d.all_requests),
        in_review: getTotal(d.in_review),
        approved: getTotal(d.approved),
        rejected: getTotal(d.rejected),
        direct_partner: getTotal(d.direct_partner),
        affiliate: getTotal(d.affiliate),
        most_requested: getTotal(d.most_requested),
        placement_proofs: getTotal(d.placement_proofs),
        recent_changes: 0,
        history: 0,
        campaign_queue: 0,
      });
      const allReqData = typeof d.all_requests === 'number' ? { total: d.all_requests, today: 0, week: 0 } : (d.all_requests || {});
      setTabBreakdowns({
        all_requests: { ...getBreakdown(d.all_requests), pending: allReqData.pending || 0, approved: allReqData.approved || 0, rejected: allReqData.rejected || 0 },
        approved: getBreakdown(d.approved),
        rejected: getBreakdown(d.rejected),
        in_review: getBreakdown(d.in_review),
        direct_partner: getBreakdown(d.direct_partner),
        affiliate: getBreakdown(d.affiliate),
        most_requested: getBreakdown(d.most_requested),
        placement_proofs: getBreakdown(d.placement_proofs),
      });
      setRecentlyAdded(d.recently_added || []);
      setRecentlyEdited(d.recently_edited || []);
      setRecentlyDeleted(d.recently_deleted || []);
      setRecentCounts({ added: d.added_today || 0, edited: d.edited_today || 0, deleted: d.deleted_today || 0 });
    }).catch(() => {});
  }, [token]);

  useEffect(() => { fetchTabCounts(); }, [fetchTabCounts, activeTab]);

  // Sync tab to URL
  const handleTabChange = (tab: string) => {
    setActiveTab(tab as TabId);
    setSearchParams({ tab });
  };

  // ── In Review: fetch publisher profiles ──
  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status, risk: riskFilter, page: String(page), per_page: '20',
        ...(search && { search }),
        ...(dateFrom && { date_from: dateFrom }),
        ...(dateTo && { date_to: dateTo }),
        ...(countryFilter && { country: countryFilter }),
      });
      const res = await fetch(`${API_BASE_URL}/api/admin/offer-access-requests/publisher-profiles?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProfiles(data.profiles || []);
      setTotalPages(data.pagination?.pages || 1);
      setSummary(data.summary || { total_publishers: 0, high_risk: 0, warn: 0, new: 0, none: 0 });

      // Fetch email stats
      try {
        const statsRes = await fetch(`${API_BASE_URL}/api/admin/email-send-stats`, { headers: { Authorization: `Bearer ${token}` } });
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setEmailStats(statsData);
        }
      } catch {}
    } catch {
      toast.error('Failed to load publisher profiles');
    } finally {
      setLoading(false);
    }
  }, [status, riskFilter, page, search, dateFrom, dateTo, countryFilter, token]);

  useEffect(() => { if (activeTab === 'all_requests') fetchProfiles(); }, [fetchProfiles, activeTab]);
  useEffect(() => { setPage(1); }, [status, riskFilter, search, dateFrom, dateTo, countryFilter]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const selectedPubs = profiles.filter(p => selectedIds.has(p.user_id));

  // Filter tabs based on role
  const visibleTabs = TAB_CONFIG.filter(t => !t.adminOnly || isAdmin);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Inbox className="h-6 w-6" /> Offer Access Requests
          </h2>
          <p className="text-sm text-muted-foreground">Review publisher offer access requests and send matching offers</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setExportModalOpen(true)}>
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
          {activeTab === 'all_requests' && (
            <Button variant="outline" size="sm" onClick={() => { fetchProfiles(); fetchTabCounts(); }} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Analytics Charts */}
      <RequestCharts />

      {/* Tab System */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {visibleTabs.map(t => {
            const bd = tabBreakdowns[t.id];
            const isAllRequests = t.id === 'all_requests';
            return (
            <TabsTrigger key={t.id} value={t.id} className="gap-1.5 text-xs data-[state=active]:bg-background flex-col items-start py-1.5 px-3">
              <div className="flex items-center gap-1.5">
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
                {tabCounts[t.id] > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1 min-w-[20px] justify-center">
                    {tabCounts[t.id]}
                  </Badge>
                )}
              </div>
              {isAllRequests && bd && bd.total > 0 ? (
                <div className="text-[9px] text-muted-foreground font-normal">
                  {bd.today > 0 && <span className="text-green-600">today {bd.today}</span>}
                  {bd.today > 0 && <span> · </span>}
                  {bd.pending !== undefined && bd.pending > 0 && <span className="text-amber-600 font-medium">pending {bd.pending}</span>}
                  {bd.pending !== undefined && bd.pending > 0 && <span> · </span>}
                  {bd.approved !== undefined && bd.approved > 0 && <span className="text-green-600">approved {bd.approved}</span>}
                  {bd.approved !== undefined && bd.approved > 0 && <span> · </span>}
                  {bd.rejected !== undefined && bd.rejected > 0 && <span className="text-red-500">rejected {bd.rejected}</span>}
                </div>
              ) : bd && bd.total > 0 && (
                <div className="text-[9px] text-muted-foreground font-normal">
                  {bd.today > 0 && <span className="text-green-600">today {bd.today}</span>}
                  {bd.today > 0 && bd.week > 0 && <span> · </span>}
                  {bd.week > 0 && <span>week {bd.week}</span>}
                  {(bd.today > 0 || bd.week > 0) && <span> · </span>}
                  <span>total {bd.total}</span>
                </div>
              )}
            </TabsTrigger>
            );
          })}
        </TabsList>

        {/* ── Recent Changes Tab ── */}
        <TabsContent value="recent_changes">
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Offer Changes</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Filter:</span>
                {['today', '3d', '7d', '30d'].map(period => (
                  <button key={period} type="button"
                    onClick={() => setRecentDateFilter(period)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${recentDateFilter === period ? 'bg-purple-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                    {period === 'today' ? 'Today' : period === '3d' ? 'Last 3 Days' : period === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
                  </button>
                ))}
                {recentSelectedOffers.size > 0 && (
                  <Button size="sm" className="h-7 px-3 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => {
                      const ids = Array.from(recentSelectedOffers);
                      if (ids.length > 0) {
                        setScheduleOfferIds(ids);
                        setScheduleModalOpen(true);
                      }
                    }}>
                    <Send className="w-3 h-3" />Send {recentSelectedOffers.size} offers to publishers
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Added */}
              <div className="border rounded-lg p-4">
                <div className="text-sm font-medium text-green-700 mb-3 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                  <Plus className="h-4 w-4" /> Recently Added
                  <Badge variant="secondary" className="ml-auto text-[10px]">{filteredRecentlyAdded.length}</Badge>
                </div>
                <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                  {filteredRecentlyAdded.length > 0 ? filteredRecentlyAdded.map((o, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs py-1.5 px-2 rounded hover:bg-muted/50 border border-transparent hover:border-green-100">
                      <input type="checkbox" className="w-3.5 h-3.5 rounded cursor-pointer accent-green-600" checked={recentSelectedOffers.has(o.offer_id)} onChange={() => setRecentSelectedOffers(prev => { const n = new Set(prev); n.has(o.offer_id) ? n.delete(o.offer_id) : n.add(o.offer_id); return n; })} />
                      <span className="font-medium truncate flex-1">{o.name}</span>
                      <span className="text-muted-foreground shrink-0">{o.network}</span>
                      <span className="text-muted-foreground shrink-0 text-[10px]">{o.at ? new Date(o.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}</span>
                    </div>
                  )) : <div className="text-xs text-muted-foreground text-center py-4">No offers added in this period</div>}
                </div>
              </div>

              {/* Edited */}
              <div className="border rounded-lg p-4">
                <div className="text-sm font-medium text-amber-700 mb-3 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  <Edit className="h-4 w-4" /> Recently Edited
                  <Badge variant="secondary" className="ml-auto text-[10px]">{filteredRecentlyEdited.length}</Badge>
                </div>
                <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                  {filteredRecentlyEdited.length > 0 ? filteredRecentlyEdited.map((o, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs py-1.5 px-2 rounded hover:bg-muted/50 border border-transparent hover:border-amber-100">
                      <input type="checkbox" className="w-3.5 h-3.5 rounded cursor-pointer accent-amber-600" checked={recentSelectedOffers.has(o.offer_id)} onChange={() => setRecentSelectedOffers(prev => { const n = new Set(prev); n.has(o.offer_id) ? n.delete(o.offer_id) : n.add(o.offer_id); return n; })} />
                      <span className="font-medium truncate flex-1">{o.name}</span>
                      <span className="text-muted-foreground shrink-0">{o.network}</span>
                      <span className="text-muted-foreground shrink-0 text-[10px]">{o.at ? new Date(o.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}</span>
                    </div>
                  )) : <div className="text-xs text-muted-foreground text-center py-4">No offers edited in this period</div>}
                </div>
              </div>

              {/* Deleted */}
              <div className="border rounded-lg p-4">
                <div className="text-sm font-medium text-red-700 mb-3 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  <Trash2 className="h-4 w-4" /> Recently Deleted
                  <Badge variant="secondary" className="ml-auto text-[10px]">{filteredRecentlyDeleted.length}</Badge>
                </div>
                <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                  {filteredRecentlyDeleted.length > 0 ? filteredRecentlyDeleted.map((o, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs py-1.5 px-2 rounded hover:bg-muted/50 border border-transparent hover:border-red-100">
                      <input type="checkbox" className="w-3.5 h-3.5 rounded cursor-pointer accent-red-600" checked={recentSelectedOffers.has(o.offer_id)} onChange={() => setRecentSelectedOffers(prev => { const n = new Set(prev); n.has(o.offer_id) ? n.delete(o.offer_id) : n.add(o.offer_id); return n; })} />
                      <span className="font-medium truncate flex-1">{o.name}</span>
                      <span className="text-muted-foreground shrink-0">{o.network}</span>
                      <span className="text-muted-foreground shrink-0 text-[10px]">{o.at ? new Date(o.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}</span>
                    </div>
                  )) : <div className="text-xs text-muted-foreground text-center py-4">No offers deleted in this period</div>}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── All Requests Tab: Existing publisher-profile view ── */}
        <TabsContent value="all_requests">
          <div className="space-y-5 mt-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-3">
              {[
                { label: 'Total Publishers', value: summary.total_publishers, icon: Users, color: 'text-foreground' },
                { label: 'High Risk', value: summary.high_risk, icon: AlertTriangle, color: 'text-red-500' },
                { label: 'Warning', value: summary.warn, icon: AlertCircle, color: 'text-amber-500' },
                { label: 'New Users', value: summary.new, icon: Sparkles, color: 'text-blue-500' },
                { label: 'Clean', value: summary.none, icon: CheckCircle2, color: 'text-emerald-500' },
              ].map(s => (
                <Card key={s.label} className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <s.icon className={`h-4 w-4 ${s.color}`} />
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                  </div>
                  <p className="text-xl font-bold">{s.value}</p>
                </Card>
              ))}
              {/* Email Stats Boxes */}
              <Card className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="h-4 w-4 text-violet-500" />
                  <span className="text-xs text-muted-foreground">Mails Sent</span>
                </div>
                <p className="text-xl font-bold">{emailStats.total_mails_sent}</p>
                <p className="text-[10px] text-green-600 font-medium">today {emailStats.today_mails_sent}</p>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <UserCheck className="h-4 w-4 text-indigo-500" />
                  <span className="text-xs text-muted-foreground">Publishers Mailed</span>
                </div>
                <p className="text-xl font-bold">{emailStats.total_publishers_mailed}</p>
                <p className="text-[10px] text-green-600 font-medium">today {emailStats.today_publishers_mailed}</p>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <MousePointerClick className="h-4 w-4 text-orange-500" />
                  <span className="text-xs text-muted-foreground">Users Interacted</span>
                </div>
                <p className="text-xl font-bold">{emailStats.total_interactions}</p>
                <p className="text-[10px] text-green-600 font-medium">today {emailStats.today_interactions}</p>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Briefcase className="h-4 w-4 text-cyan-500" />
                  <span className="text-xs text-muted-foreground">Offers Interacted</span>
                </div>
                <p className="text-xl font-bold">{emailStats.offers_interacted_total}</p>
                <p className="text-[10px] text-green-600 font-medium">today {emailStats.offers_interacted_today}</p>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-pink-500" />
                  <span className="text-xs text-muted-foreground">Total Clicks</span>
                </div>
                <p className="text-xl font-bold">{emailStats.total_clicks}</p>
                <p className="text-[10px] text-green-600 font-medium">today {emailStats.today_clicks}</p>
              </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search publishers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending ({tabBreakdowns.all_requests?.pending ?? tabCounts.in_review})</SelectItem>
                  <SelectItem value="approved">Approved ({tabCounts.approved})</SelectItem>
                  <SelectItem value="rejected">Rejected ({tabCounts.rejected})</SelectItem>
                  <SelectItem value="all">All ({tabCounts.all_requests})</SelectItem>
                </SelectContent>
              </Select>
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risk</SelectItem>
                  <SelectItem value="high_risk">High Risk</SelectItem>
                  <SelectItem value="warn">Warning</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="none">Clean</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-[140px]"
                placeholder="From date"
                title="Request date from"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-[140px]"
                placeholder="To date"
                title="Request date to"
              />
              <Input
                value={countryFilter}
                onChange={e => setCountryFilter(e.target.value)}
                className="w-[120px]"
                placeholder="Country..."
                title="Filter by user geo preference"
              />
            </div>

            {/* Bulk Actions */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-xl border bg-muted/50">
                <Badge>{selectedIds.size} selected</Badge>
                <Button size="sm" className="gap-1.5 bg-orange-500 hover:bg-orange-600 text-white" onClick={() => setCampaignWizardOpen(true)}>
                  <Sparkles className="h-3.5 w-3.5" /> Launch Campaign
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setBulkMsgModal({ mode: 'email' })}>
                  <Mail className="h-3.5 w-3.5" /> Email Selected
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setBulkMsgModal({ mode: 'support' })}>
                  <MessageSquare className="h-3.5 w-3.5" /> Support Message
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
              </div>
            )}

            {/* Publisher List */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" /> Loading...
              </div>
            ) : profiles.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No publisher profiles found</div>
            ) : (
              <div className="space-y-3">
                {profiles.map(pub => (
                  <PublisherRow
                    key={pub.user_id}
                    pub={pub}
                    isExpanded={expandedId === pub.user_id}
                    isSelected={selectedIds.has(pub.user_id)}
                    onToggleExpand={() => setExpandedId(prev => prev === pub.user_id ? null : pub.user_id)}
                    onToggleSelect={() => toggleSelect(pub.user_id)}
                    onSendOffers={(p, offers) => setSendModal({ pub: p, offers })}
                    onRefreshList={() => { fetchProfiles(); fetchTabCounts(); }}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
                <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Other Tabs: Card-based view (includes In Review) ── */}
        {visibleTabs.filter(t => t.id !== 'all_requests' && t.id !== 'recent_changes' && t.id !== 'campaign_queue').map(t => (
          <TabsContent key={t.id} value={t.id}>
            <div className="mt-4">
              <TabContent tab={t.id} isActive={activeTab === t.id} />
            </div>
          </TabsContent>
        ))}

        {/* ── Campaign Queue Tab ── */}
        <TabsContent value="campaign_queue">
          <div className="mt-4">
            <CampaignQueueTab isActive={activeTab === 'campaign_queue'} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Send Offers Modal (In Review tab) */}
      {sendModal && (
        <SendOffersModal
          open={!!sendModal}
          onClose={() => setSendModal(null)}
          publisher={sendModal.pub}
          preselectedOffers={sendModal.offers}
        />
      )}

      {/* Schedule/Send Modal for Recently Added/Edited offers */}
      <SendScheduleModal
        open={scheduleModalOpen}
        onClose={() => { setScheduleModalOpen(false); setScheduleOfferIds([]); }}
        offerIds={scheduleOfferIds}
        defaultMode="send_now"
        sourceTab="recently_changed"
      />

      {/* Bulk Message Modal (In Review tab) */}
      {bulkMsgModal && (
        <BulkMessageModal
          open={!!bulkMsgModal}
          onClose={() => setBulkMsgModal(null)}
          publishers={selectedPubs}
          defaultMode={bulkMsgModal.mode}
        />
      )}

      {/* Campaign Wizard Modal */}
      <CampaignWizardModal
        open={campaignWizardOpen}
        onClose={() => setCampaignWizardOpen(false)}
        selectedUsers={selectedPubs}
        sourceTab={activeTab}
        onSuccess={() => {
          setSelectedIds(new Set());
          fetchProfiles();
          fetchTabCounts();
        }}
      />

      {/* Export Modal */}
      <ExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        tabCounts={tabCounts}
      />
    </div>
  );
}

export default function AdminOfferAccessRequestsPage() {
  return (
    <AdminPageGuard requiredTab="offer-access-requests">
      <AdminOfferAccessRequests />
    </AdminPageGuard>
  );
}
