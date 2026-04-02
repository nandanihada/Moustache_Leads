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
} from 'lucide-react';
import { API_BASE_URL } from '@/services/apiConfig';
import { AdminPageGuard } from '@/components/AdminPageGuard';
import { useAuth } from '@/contexts/AuthContext';
import PublisherRow from '@/pages/offer-requests/PublisherRow';
import SendOffersModal from '@/pages/offer-requests/SendOffersModal';
import BulkMessageModal from '@/pages/offer-requests/BulkMessageModal';
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

type TabId = 'all_requests' | 'approved' | 'rejected' | 'in_review' | 'direct_partner' | 'affiliate' | 'most_requested' | 'history';

const TAB_CONFIG: { id: TabId; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
  { id: 'all_requests', label: 'All Requests', icon: Eye },
  { id: 'approved', label: 'Approved', icon: ThumbsUp },
  { id: 'rejected', label: 'Rejected', icon: ThumbsDown, adminOnly: true },
  { id: 'in_review', label: 'In Review', icon: AlertTriangle },
  { id: 'direct_partner', label: 'Direct Partner', icon: Briefcase },
  { id: 'affiliate', label: 'Affiliate', icon: UserCheck },
  { id: 'most_requested', label: 'Most Requested', icon: TrendingUp },
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
    all_requests: 0, approved: 0, rejected: 0, in_review: 0, direct_partner: 0, affiliate: 0, most_requested: 0, history: 0,
  });

  // ── In Review tab state (existing publisher-profile view) ──
  const [profiles, setProfiles] = useState<PProf[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('pending');
  const [riskFilter, setRiskFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState<Summary>({ total_publishers: 0, high_risk: 0, warn: 0, new: 0, none: 0 });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sendModal, setSendModal] = useState<{ pub: PProf; offers?: Inv[] } | null>(null);
  const [bulkMsgModal, setBulkMsgModal] = useState<{ mode: 'email' | 'support' } | null>(null);
  const token = localStorage.getItem('token');

  // Fetch tab counts
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/admin/offer-access-requests/tab-counts`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()).then(d => {
      setTabCounts({
        all_requests: d.all_requests || 0,
        in_review: d.in_review || 0,
        approved: d.approved || 0,
        rejected: d.rejected || 0,
        direct_partner: d.direct_partner || 0,
        affiliate: d.affiliate || 0,
        most_requested: d.most_requested || 0,
        history: 0,
      });
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

      {/* Tab System */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {visibleTabs.map(t => (
            <TabsTrigger key={t.id} value={t.id} className="gap-1.5 text-xs data-[state=active]:bg-background">
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
              {tabCounts[t.id] > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1 min-w-[20px] justify-center">
                  {tabCounts[t.id]}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── All Requests Tab: Existing publisher-profile view ── */}
        <TabsContent value="all_requests">
          <div className="space-y-5 mt-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
