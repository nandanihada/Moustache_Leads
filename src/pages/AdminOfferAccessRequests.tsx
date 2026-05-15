import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Search, Users, AlertTriangle, AlertCircle, Sparkles, RefreshCw,
  Mail, MessageSquare, CheckCircle2, Inbox,
  ThumbsUp, ThumbsDown, Eye, Briefcase, UserCheck, TrendingUp,
  ChevronDown, ChevronUp, Plus, Edit, Trash2, Clock, FileImage, MousePointerClick,
} from 'lucide-react';
import { API_BASE_URL } from '@/services/apiConfig';
import { AdminPageGuard } from '@/components/AdminPageGuard';
import { useAuth } from '@/contexts/AuthContext';
import PublisherRow from '@/pages/offer-requests/PublisherRow';
import SendOffersModal from '@/pages/offer-requests/SendOffersModal';
import BulkMessageModal from '@/pages/offer-requests/BulkMessageModal';
import RequestCharts from '@/pages/offer-requests/RequestCharts';
import TabContent from '@/pages/offer-requests/TabContent';

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

type TabId = 'all_requests' | 'approved' | 'rejected' | 'in_review' | 'direct_partner' | 'affiliate' | 'most_requested' | 'placement_proofs' | 'history';

const TAB_CONFIG: { id: TabId; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
  { id: 'all_requests', label: 'All Requests', icon: Eye },
  { id: 'approved', label: 'Approved', icon: ThumbsUp },
  { id: 'rejected', label: 'Rejected', icon: ThumbsDown, adminOnly: true },
  { id: 'in_review', label: 'In Review', icon: AlertTriangle },
  { id: 'direct_partner', label: 'Direct Partner', icon: Briefcase },
  { id: 'affiliate', label: 'Affiliate', icon: UserCheck },
  { id: 'most_requested', label: 'Most Requested', icon: TrendingUp },
  { id: 'placement_proofs', label: 'Placement Proofs', icon: FileImage },
  { id: 'history', label: 'Send History', icon: Inbox },
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
    all_requests: 0, approved: 0, rejected: 0, in_review: 0, direct_partner: 0, affiliate: 0, most_requested: 0, placement_proofs: 0, history: 0,
  });
  const [tabBreakdowns, setTabBreakdowns] = useState<Record<string, { total: number; today: number; week: number }>>({});
  const [recentlyAdded, setRecentlyAdded] = useState<{ offer_id: string; name: string; network: string; at: string }[]>([]);
  const [recentlyEdited, setRecentlyEdited] = useState<{ offer_id: string; name: string; network: string; at: string }[]>([]);
  const [recentlyDeleted, setRecentlyDeleted] = useState<{ offer_id: string; name: string; network: string; at: string }[]>([]);
  const [recentCounts, setRecentCounts] = useState({ added: 0, edited: 0, deleted: 0 });
  const [recentExpanded, setRecentExpanded] = useState(false);

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
  const [sendModal, setSendModal] = useState<{ pub: PProf; offers?: Inv[] } | null>(null);
  const [bulkMsgModal, setBulkMsgModal] = useState<{ mode: 'email' | 'support' } | null>(null);
  const [detailMetric, setDetailMetric] = useState<string | null>(null);
  const [detailFilter, setDetailFilter] = useState('all');
  const [detailSearch, setDetailSearch] = useState('');
  const [detailItems, setDetailItems] = useState<any[]>([]);
  const [detailTotalCount, setDetailTotalCount] = useState<number | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const token = localStorage.getItem('token');

  // Fetch tab counts
  useEffect(() => {
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
        history: 0,
      });
      setTabBreakdowns({
        all_requests: getBreakdown(d.all_requests),
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
  }, [token, activeTab]);

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
  }, [status, riskFilter, page, search, token]);

  useEffect(() => { if (activeTab === 'all_requests') fetchProfiles(); }, [fetchProfiles, activeTab]);
  useEffect(() => { setPage(1); }, [status, riskFilter, search]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const fetchDetailMetric = useCallback(async () => {
    if (!detailMetric) return;
    const serverMetric = detailMetric === 'total_publishers_mailed' ? 'publishers_mailed' : detailMetric;
    setDetailLoading(true);
    setDetailError('');

    try {
      const params = new URLSearchParams({
        metric: serverMetric,
        filter: detailFilter,
        search: detailSearch,
        limit: '1000'
      });
      const res = await fetch(`${API_BASE_URL}/api/admin/email-send-stat-details?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDetailItems(data.items || []);
      setDetailTotalCount(data.total_count);
    } catch (error) {
      setDetailError('Failed to load details');
    } finally {
      setDetailLoading(false);
    }
  }, [detailMetric, detailFilter, detailSearch, token]);

  useEffect(() => {
    fetchDetailMetric();
  }, [fetchDetailMetric]);

  const toggleDetailMetric = (metric: string) => {
    if (detailMetric === metric) {
      setDetailMetric(null);
    } else {
      setDetailMetric(metric);
      setDetailSearch('');
      setDetailFilter('all');
    }
  };

  const metricLabels: Record<string, { title: string; subtitle: string }> = {
    total_mails_sent: { title: 'Recent Mail Recipients', subtitle: 'Email recipients and send times' },
    total_publishers_mailed: { title: 'Publishers Mailed', subtitle: 'Unique publisher recipients' },
    total_interactions: { title: 'Users Interacted', subtitle: 'Unique interaction sources and dates' },
    offers_interacted_total: { title: 'Offers Interacted', subtitle: 'Offers that saw interaction' },
    total_clicks: { title: 'Total Clicks', subtitle: 'Top clicked offers and items' },
  };

  const activeMetricCount = detailMetric ? (emailStats as Record<string, number>)[detailMetric] : undefined;

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
        {activeTab === 'all_requests' && (
          <Button variant="outline" size="sm" onClick={fetchProfiles} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        )}
      </div>

      {/* Analytics Charts */}
      <RequestCharts />

      {/* Tab System */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {visibleTabs.map(t => {
            const bd = tabBreakdowns[t.id];
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
              {bd && bd.total > 0 && (
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

        {/* Recently Added/Edited/Deleted Section */}
        {(recentlyAdded.length > 0 || recentlyEdited.length > 0 || recentlyDeleted.length > 0) && (
          <div className="mt-3">
            <button
              onClick={() => setRecentExpanded(!recentExpanded)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              {recentExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <span className="flex items-center gap-4">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500 inline-block" /> Recently added <span className="text-green-600 font-semibold">{recentCounts.added} today</span></span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500 inline-block" /> Recently edited <span className="text-amber-600 font-semibold">{recentCounts.edited} today</span></span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 inline-block" /> Recently deleted <span className="text-red-600 font-semibold">{recentCounts.deleted} today</span></span>
              </span>
            </button>
            {recentExpanded && (
              <div className="grid grid-cols-3 gap-4 mt-2 p-3 bg-muted/30 rounded-lg border">
                <div>
                  <div className="text-xs font-medium text-green-700 mb-1.5 flex items-center gap-1"><Plus className="h-3 w-3" /> Recently Added</div>
                  {recentlyAdded.length > 0 ? recentlyAdded.map((o, i) => (
                    <div key={i} className="flex justify-between text-xs py-0.5">
                      <span className="truncate max-w-[200px]">{o.name}</span>
                      <span className="text-muted-foreground ml-2 shrink-0">{o.at ? new Date(o.at).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : ''}</span>
                    </div>
                  )) : <div className="text-xs text-muted-foreground">None recently</div>}
                </div>
                <div>
                  <div className="text-xs font-medium text-amber-700 mb-1.5 flex items-center gap-1"><Edit className="h-3 w-3" /> Recently Edited</div>
                  {recentlyEdited.length > 0 ? recentlyEdited.map((o, i) => (
                    <div key={i} className="flex justify-between text-xs py-0.5">
                      <span className="truncate max-w-[200px]">{o.name}</span>
                      <span className="text-muted-foreground ml-2 shrink-0">{o.at ? new Date(o.at).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : ''}</span>
                    </div>
                  )) : <div className="text-xs text-muted-foreground">None recently</div>}
                </div>
                <div>
                  <div className="text-xs font-medium text-red-700 mb-1.5 flex items-center gap-1"><Trash2 className="h-3 w-3" /> Recently Deleted</div>
                  {recentlyDeleted.length > 0 ? recentlyDeleted.map((o, i) => (
                    <div key={i} className="flex justify-between text-xs py-0.5">
                      <span className="truncate max-w-[200px]">{o.name}</span>
                      <span className="text-muted-foreground ml-2 shrink-0">{o.at ? new Date(o.at).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : ''}</span>
                    </div>
                  )) : <div className="text-xs text-muted-foreground">None recently</div>}
                </div>
              </div>
            )}
          </div>
        )}

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
            </div>
            {/* Email Stats Boxes */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { key: 'total_mails_sent', label: 'Mails Sent', total: emailStats.total_mails_sent, today: emailStats.today_mails_sent, icon: Mail, color: 'text-violet-500' },
                { key: 'total_publishers_mailed', label: 'Publishers Mailed', total: emailStats.total_publishers_mailed, today: emailStats.today_publishers_mailed, icon: UserCheck, color: 'text-indigo-500' },
                { key: 'total_interactions', label: 'Users Interacted', total: emailStats.total_interactions, today: emailStats.today_interactions, icon: MousePointerClick, color: 'text-orange-500' },
                { key: 'offers_interacted_total', label: 'Offers Interacted', total: emailStats.offers_interacted_total, today: emailStats.offers_interacted_today, icon: Briefcase, color: 'text-cyan-500' },
                { key: 'total_clicks', label: 'Total Clicks', total: emailStats.total_clicks, today: emailStats.today_clicks, icon: TrendingUp, color: 'text-pink-500' },
              ].map(s => (
                <Card 
                  key={s.key} 
                  className={`p-3 cursor-pointer transition-all duration-200 border-2 ${detailMetric === s.key ? 'border-primary shadow-md bg-primary/5' : 'hover:shadow-md'}`} 
                  onClick={() => toggleDetailMetric(s.key)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <s.icon className={`h-4 w-4 ${s.color}`} />
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-xl font-bold">{s.total}</p>
                    <p className="text-[10px] text-green-600 font-medium">today {s.today}</p>
                  </div>
                </Card>
              ))}
            </div>

            {/* Metric Detailed Table (Expandable below cards) */}
            {detailMetric && (
              <Card className="border-2 border-primary/20 bg-muted/20 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="p-4 border-b bg-background/50 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold flex items-center gap-2 text-lg">
                      {metricLabels[detailMetric]?.title}
                      <Badge variant="secondary">{detailTotalCount ?? 0} records</Badge>
                    </h3>
                    <p className="text-sm text-muted-foreground">{metricLabels[detailMetric]?.subtitle}</p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Search by name, email or offer..." 
                        value={detailSearch} 
                        onChange={(e) => setDetailSearch(e.target.value)}
                        className="pl-9 h-9"
                      />
                    </div>
                    <Select value={detailFilter} onValueChange={setDetailFilter}>
                      <SelectTrigger className="w-[130px] h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="week">This Week</SelectItem>
                        <SelectItem value="all">All Time</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="sm" onClick={() => setDetailMetric(null)}>Close</Button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[500px]">
                  {detailLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                      <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Fetching detailed data...</p>
                    </div>
                  ) : detailError ? (
                    <div className="text-center py-20 text-destructive">{detailError}</div>
                  ) : detailItems.length === 0 ? (
                    <div className="text-center py-20 text-muted-foreground">No records found matching your criteria.</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 sticky top-0 z-10 border-b">
                        <tr className="text-left font-medium text-muted-foreground">
                          {detailMetric === 'total_mails_sent' && (
                            <>
                              <th className="p-3">Publisher Name</th>
                              <th className="p-3">Email</th>
                              <th className="p-3">Offers Sent</th>
                              <th className="p-3">Sent At</th>
                              <th className="p-3">Status</th>
                            </>
                          )}
                          {detailMetric === 'total_publishers_mailed' && (
                            <>
                              <th className="p-3">Publisher Name</th>
                              <th className="p-3">Email</th>
                              <th className="p-3">Total Mails</th>
                              <th className="p-3">Last Mailed</th>
                              <th className="p-3">Risk Level</th>
                            </>
                          )}
                          {detailMetric === 'total_interactions' && (
                            <>
                              <th className="p-3">User Name</th>
                              <th className="p-3">Email</th>
                              <th className="p-3">Action Type</th>
                              <th className="p-3">Offer Name</th>
                              <th className="p-3">Exact Date & Time</th>
                            </>
                          )}
                          {detailMetric === 'offers_interacted_total' && (
                            <>
                              <th className="p-3">User Name</th>
                              <th className="p-3">Offer Name</th>
                              <th className="p-3">Action</th>
                              <th className="p-3">Date & Time</th>
                              <th className="p-3">Status</th>
                            </>
                          )}
                          {detailMetric === 'total_clicks' && (
                            <>
                              <th className="p-3">User Name</th>
                              <th className="p-3">Offer Clicked</th>
                              <th className="p-3">Email</th>
                              <th className="p-3">Country</th>
                              <th className="p-3">Date & Time</th>
                              <th className="p-3">Device</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y bg-background">
                        {detailItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-muted/30 transition-colors">
                            {detailMetric === 'total_mails_sent' && (
                              <>
                                <td className="p-3 font-medium">{item.publisher_name}</td>
                                <td className="p-3 text-muted-foreground">{item.email}</td>
                                <td className="p-3"><Badge variant="outline">{item.offers_sent}</Badge></td>
                                <td className="p-3 text-muted-foreground whitespace-nowrap">{new Date(item.sent_at).toLocaleString()}</td>
                                <td className="p-3">
                                  <Badge className={item.status === 'Sent' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}>
                                    {item.status}
                                  </Badge>
                                </td>
                              </>
                            )}
                            {detailMetric === 'total_publishers_mailed' && (
                              <>
                                <td className="p-3 font-medium">{item.publisher_name}</td>
                                <td className="p-3 text-muted-foreground">{item.email}</td>
                                <td className="p-3"><Badge variant="outline">{item.total_mails_sent}</Badge></td>
                                <td className="p-3 text-muted-foreground whitespace-nowrap">{new Date(item.last_mailed_at).toLocaleString()}</td>
                                <td className="p-3">
                                  <Badge className={
                                    item.risk_level === 'high_risk' ? 'bg-red-100 text-red-700' : 
                                    item.risk_level === 'warn' ? 'bg-amber-100 text-amber-700' : 
                                    'bg-emerald-100 text-emerald-700'
                                  }>
                                    {item.risk_level === 'high_risk' ? 'High Risk' : item.risk_level === 'warn' ? 'Warning' : 'Clean'}
                                  </Badge>
                                </td>
                              </>
                            )}
                            {detailMetric === 'total_interactions' && (
                              <>
                                <td className="p-3 font-medium">{item.user_name}</td>
                                <td className="p-3 text-muted-foreground">{item.email}</td>
                                <td className="p-3"><Badge variant="secondary">{item.action}</Badge></td>
                                <td className="p-3 font-medium">{item.offer_name}</td>
                                <td className="p-3 text-muted-foreground whitespace-nowrap">{new Date(item.date_time).toLocaleString()}</td>
                              </>
                            )}
                            {detailMetric === 'offers_interacted_total' && (
                              <>
                                <td className="p-3 font-medium">{item.user_name}</td>
                                <td className="p-3 font-medium">{item.offer_name}</td>
                                <td className="p-3"><Badge variant="outline">{item.action}</Badge></td>
                                <td className="p-3 text-muted-foreground whitespace-nowrap">{new Date(item.date_time).toLocaleString()}</td>
                                <td className="p-3 text-green-600 font-medium">{item.status}</td>
                              </>
                            )}
                            {detailMetric === 'total_clicks' && (
                              <>
                                <td className="p-3 font-medium">{item.user_name}</td>
                                <td className="p-3 font-medium">{item.offer_name}</td>
                                <td className="p-3 text-muted-foreground">{item.email}</td>
                                <td className="p-3">{item.country}</td>
                                <td className="p-3 text-muted-foreground whitespace-nowrap">{new Date(item.date_time).toLocaleString()}</td>
                                <td className="p-3"><Badge variant="secondary">{item.device}</Badge></td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                
                <div className="p-3 border-t bg-muted/30 flex justify-between items-center">
                  <p className="text-xs text-muted-foreground">Showing {detailItems.length} records</p>
                  <Button variant="ghost" size="xs" className="h-7 text-xs" onClick={() => setDetailMetric(null)}>Collapse Table</Button>
                </div>
              </Card>
            )}

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search publishers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="all">All</SelectItem>
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
            </div>

            {/* Bulk Actions */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-xl border bg-muted/50">
                <Badge>{selectedIds.size} selected</Badge>
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
                    onRefreshList={fetchProfiles}
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
        {visibleTabs.filter(t => t.id !== 'all_requests').map(t => (
          <TabsContent key={t.id} value={t.id}>
            <div className="mt-4">
              <TabContent tab={t.id} isActive={activeTab === t.id} />
            </div>
          </TabsContent>
        ))}
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

      {/* Bulk Message Modal (In Review tab) */}
      {bulkMsgModal && (
        <BulkMessageModal
          open={!!bulkMsgModal}
          onClose={() => setBulkMsgModal(null)}
          publishers={selectedPubs}
          defaultMode={bulkMsgModal.mode}
        />
      )}

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
