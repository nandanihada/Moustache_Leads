/**
 * Offerwall Reports — Enhanced Tracking Tab
 * 
 * Subtabs: Performance · Conversions · Click Tracking · Insights · Activity Log
 * Connects to existing /api/admin/reports/* endpoints for real data.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp, FileText, MousePointerClick, BarChart3, Activity,
  Search, RefreshCw, Download, Filter, ChevronLeft, ChevronRight,
  ArrowUp, ArrowDown, ArrowUpDown, MoreHorizontal, CheckCircle,
  Clock, XCircle, AlertCircle, Loader2, Flame
} from 'lucide-react';
import { toast } from 'sonner';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line } from 'recharts';
import { ColumnSelector, ColumnDefinition } from '@/components/reports/ColumnSelector';
import { Checkbox } from '@/components/ui/checkbox';

// ===================== HELPERS =====================

function formatDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function formatCurrency(val: number): string {
  if (!val && val !== 0) return '—';
  return `$${val.toFixed(2)}`;
}

function formatPercent(val: number): string {
  return `${val.toFixed(1)}%`;
}

// Ensure value is rendered as string (not object)
function safeStr(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return val.ip_address || val.country || val.type || JSON.stringify(val).substring(0, 30);
  return String(val);
}

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  } catch { return ts || '—'; }
}

// API helper for offerwall-specific tracking data
import { getApiBaseUrl } from '@/services/apiConfig';

const API_BASE = `${getApiBaseUrl()}/api/admin`;

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}

// Fetch offerwall-only tracking logs (uses the dedicated offerwall endpoint)
async function fetchOfferwallLogs(params: { status?: string; page?: number; per_page?: number; search?: string }) {
  const searchParams = new URLSearchParams();
  if (params.status && params.status !== 'all') searchParams.append('status', params.status);
  if (params.page) searchParams.append('page', String(params.page));
  if (params.per_page) searchParams.append('per_page', String(params.per_page));
  if (params.search) searchParams.append('search', params.search);
  const res = await fetch(`${API_BASE}/offerwall-management/tracking-logs?${searchParams}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch offerwall tracking logs');
  return res.json();
}

// ===================== SHARED FILTER HEADER =====================

interface FilterState {
  search: string;
  publisher: string;
  advertiser: string;
  device: string;
  network: string;
  postback: string;
  vertical: string;
  offer: string;
  countries: string[];
  dateFrom: string;
  dateTo: string;
  perPage: number;
}

const defaultFilters: FilterState = {
  search: '', publisher: '', advertiser: '', device: '', network: '',
  postback: '', vertical: '', offer: '', countries: [],
  dateFrom: formatDate(30), dateTo: formatDate(0), perPage: 50
};

interface ReportFiltersProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  showFilters: boolean;
  setShowFilters: (v: boolean) => void;
  onRefresh: () => void;
  onExport: () => void;
  loading: boolean;
  filterOptions: { publishers: { id: string; name: string }[]; offers: { id: string; name: string }[]; countries: string[]; verticals: string[]; networks: string[]; devices: string[] };
  children?: React.ReactNode;
}

const ReportFilters: React.FC<ReportFiltersProps> = ({ filters, setFilters, showFilters, setShowFilters, onRefresh, onExport, loading, filterOptions, children }) => {
  const activeCount = Object.entries(filters).filter(([k, v]) => {
    if (k === 'search' || k === 'dateFrom' || k === 'dateTo' || k === 'perPage') return false;
    if (k === 'countries') return (v as string[]).length > 0;
    return !!v;
  }).length;

  const [offerSearch, setOfferSearch] = useState('');
  const [pubSearch, setPubSearch] = useState('');
  const filteredOffers = filterOptions.offers.filter(o => 
    o.name.toLowerCase().includes(offerSearch.toLowerCase()) || o.id.toLowerCase().includes(offerSearch.toLowerCase())
  ).slice(0, 20);
  const filteredPublishers = filterOptions.publishers.filter(p =>
    p.name.toLowerCase().includes(pubSearch.toLowerCase()) || p.id.toLowerCase().includes(pubSearch.toLowerCase())
  ).slice(0, 20);

  return (
    <div className="space-y-3">
      {/* Top row: Search + Date + Filters toggle + Refresh + Export */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search publisher, offer, geo..."
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="h-4 w-4" /> Filters {activeCount > 0 && <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">{activeCount}</Badge>}
        </Button>
        <Button variant="outline" size="sm" className="h-9" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
        <Button size="sm" className="h-9 gap-1.5 bg-purple-600 hover:bg-purple-700" onClick={onExport}>
          <Download className="h-4 w-4" /> Export
        </Button>
        {children}
      </div>

      {/* Extended filters row */}
      {showFilters && (
        <div className="flex items-center gap-2 flex-wrap p-3 bg-gray-50 rounded-lg border">
          {/* Publisher (searchable) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1 max-w-[160px]">
                <Search className="h-3 w-3" />
                {filters.publisher ? filterOptions.publishers.find(p => p.id === filters.publisher)?.name?.substring(0, 12) || 'Selected' : 'Publisher: All'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[220px] p-2">
              <Input placeholder="Search publishers..." value={pubSearch} onChange={e => setPubSearch(e.target.value)} className="h-7 text-xs mb-2" />
              <div className="max-h-[200px] overflow-y-auto space-y-0.5">
                <DropdownMenuItem onClick={() => setFilters(f => ({ ...f, publisher: '' }))} className="text-xs">All Publishers</DropdownMenuItem>
                {filteredPublishers.map(p => (
                  <DropdownMenuItem key={p.id} onClick={() => setFilters(f => ({ ...f, publisher: p.id }))} className="text-xs truncate">
                    {p.name}
                  </DropdownMenuItem>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Advertiser (network = advertiser who owns the offer) */}
          <Select value={filters.advertiser || 'all'} onValueChange={v => setFilters(f => ({ ...f, advertiser: v === 'all' ? '' : v }))}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Advertiser: All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Advertiser: All</SelectItem>
              {filterOptions.networks.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
          {/* Device */}
          <Select value={filters.device || 'all'} onValueChange={v => setFilters(f => ({ ...f, device: v === 'all' ? '' : v }))}>
            <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="Device: All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Device: All</SelectItem>
              {filterOptions.devices.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          {/* Network */}
          <Select value={filters.network || 'all'} onValueChange={v => setFilters(f => ({ ...f, network: v === 'all' ? '' : v }))}>
            <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="Network: All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Network: All</SelectItem>
              {filterOptions.networks.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
          {/* Vertical */}
          <Select value={filters.vertical || 'all'} onValueChange={v => setFilters(f => ({ ...f, vertical: v === 'all' ? '' : v }))}>
            <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="Vertical: All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Vertical: All</SelectItem>
              {filterOptions.verticals.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          {/* Offer name (searchable) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1 max-w-[160px]">
                {filters.offer ? filterOptions.offers.find(o => o.id === filters.offer)?.name?.substring(0, 15) || 'Selected' : 'Offer: All'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[250px] p-2">
              <Input placeholder="Search offers..." value={offerSearch} onChange={e => setOfferSearch(e.target.value)} className="h-7 text-xs mb-2" />
              <div className="max-h-[200px] overflow-y-auto space-y-0.5">
                <DropdownMenuItem onClick={() => setFilters(f => ({ ...f, offer: '' }))} className="text-xs">All Offers</DropdownMenuItem>
                {filteredOffers.map(o => (
                  <DropdownMenuItem key={o.id} onClick={() => setFilters(f => ({ ...f, offer: o.id }))} className="text-xs truncate">
                    {o.name} <span className="text-muted-foreground ml-1">({o.id})</span>
                  </DropdownMenuItem>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Country (multi-select) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                Country{filters.countries.length > 0 ? ` (${filters.countries.length})` : ': All'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[200px] p-2">
              <div className="max-h-[250px] overflow-y-auto space-y-1">
                {filters.countries.length > 0 && (
                  <Button variant="ghost" size="sm" className="w-full h-6 text-[10px] text-red-500" onClick={() => setFilters(f => ({ ...f, countries: [] }))}>
                    Clear all
                  </Button>
                )}
                {filterOptions.countries.slice(0, 50).map(c => (
                  <div key={c} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer"
                    onClick={() => setFilters(f => ({ ...f, countries: f.countries.includes(c) ? f.countries.filter(x => x !== c) : [...f.countries, c] }))}>
                    <Checkbox checked={filters.countries.includes(c)} className="h-3.5 w-3.5" />
                    <span className="text-xs">{c}</span>
                  </div>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Per page */}
          <Select value={String(filters.perPage)} onValueChange={v => setFilters(f => ({ ...f, perPage: Number(v) }))}>
            <SelectTrigger className="w-[85px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20/page</SelectItem>
              <SelectItem value="50">50/page</SelectItem>
              <SelectItem value="100">100/page</SelectItem>
            </SelectContent>
          </Select>
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-red-500" onClick={() => setFilters(defaultFilters)}>Clear all</Button>
          )}
        </div>
      )}
    </div>
  );
};


// ===================== PERFORMANCE TAB =====================

type GroupByKey = 'publisher' | 'offer' | 'advertiser' | 'enduser' | 'vertical' | 'country' | 'date';
type Granularity = 'hourly' | 'daily' | 'weekly' | 'monthly';
type ChartMode = 'dual' | 'single' | 'top5';

const GROUP_BY_OPTIONS: { key: GroupByKey; label: string }[] = [
  { key: 'publisher', label: 'Publisher' },
  { key: 'offer', label: 'Offer' },
  { key: 'advertiser', label: 'Network' },
  { key: 'enduser', label: 'End User' },
  { key: 'vertical', label: 'Vertical' },
  { key: 'country', label: 'Geo' },
  { key: 'date', label: 'Date' },
];

const GRANULARITY_OPTIONS: { key: Granularity; label: string }[] = [
  { key: 'hourly', label: 'Hourly' },
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
];

const groupByToApiParam = (g: GroupByKey): string => {
  switch (g) {
    case 'publisher': return 'publisher_id'; // Groups by publisher_id field (actual publisher ObjectId)
    case 'offer': return 'offer_id';
    case 'advertiser': return 'offer_id'; // Group by offer, then re-aggregate by network name
    case 'enduser': return 'user_id'; // Groups by user_id field (end user from iframe)
    case 'vertical': return 'offer_id'; // Group by offer, then re-aggregate by category
    case 'country': return 'country';
    case 'date': return 'date';
    default: return 'date';
  }
};

interface PerfSortState { field: string; order: 'asc' | 'desc'; }

// All 21 performance columns grouped by category
const PERF_COLUMNS: ColumnDefinition[] = [
  // Volume
  { id: 'clicks', label: 'Clicks', defaultVisible: true },
  { id: 'unique_clicks', label: 'Unique', defaultVisible: false },
  { id: 'gross_clicks', label: 'Opened', defaultVisible: false },
  { id: 'conversions', label: 'Conv', defaultVisible: true },
  { id: 'pending_conversions', label: 'Pending', defaultVisible: false },
  { id: 'rejected_conversions', label: 'Reversed', defaultVisible: false },
  // Rates
  { id: 'cr', label: 'CR', defaultVisible: true },
  { id: 'rev_rate', label: 'Rev rate', defaultVisible: false },
  { id: 'open_rate', label: 'Open rate', defaultVisible: false },
  { id: 'dup_rate', label: 'Dup rate', defaultVisible: false },
  { id: 'vpn_rate', label: 'VPN rate', defaultVisible: false },
  { id: 'avg_fraud', label: 'Avg fraud', defaultVisible: true },
  // Money
  { id: 'epc', label: 'EPC', defaultVisible: true },
  { id: 'total_revenue', label: 'Revenue', defaultVisible: true },
  { id: 'total_payout', label: 'Payout', defaultVisible: true },
  { id: 'profit', label: 'Margin', defaultVisible: true },
  { id: 'margin_pct', label: 'Margin %', defaultVisible: false },
  { id: 'ecpa', label: 'eCPA', defaultVisible: false },
  { id: 'avg_payout', label: 'Avg payout', defaultVisible: false },
  // Quality
  { id: 'geo_match_pct', label: 'Geo-match %', defaultVisible: false },
  { id: 'postback_pct', label: 'Postback %', defaultVisible: false },
];

const PERF_COLUMN_CATEGORIES = [
  { title: 'VOLUME', ids: ['clicks', 'unique_clicks', 'gross_clicks', 'conversions', 'pending_conversions', 'rejected_conversions'] },
  { title: 'RATES', ids: ['cr', 'rev_rate', 'open_rate', 'dup_rate', 'vpn_rate', 'avg_fraud'] },
  { title: 'MONEY', ids: ['epc', 'total_revenue', 'total_payout', 'profit', 'margin_pct', 'ecpa', 'avg_payout'] },
  { title: 'QUALITY', ids: ['geo_match_pct', 'postback_pct'] },
];

// Helper to get default visible columns
function getDefaultVisibleColumns(): Record<string, boolean> {
  const v: Record<string, boolean> = {};
  PERF_COLUMNS.forEach(c => { v[c.id] = c.defaultVisible; });
  return v;
}

const PerformanceSubTab: React.FC<{ filters: FilterState; dateRange: { start: string; end: string }; logs: any[]; loading: boolean; pickedCount: number; onRowClick?: (key: string, value: string) => void }> = ({ filters, dateRange, logs: allLogs, loading: parentLoading, pickedCount, onRowClick }) => {
  const [groupBy, setGroupBy] = useState<GroupByKey>('publisher');
  const [granularity, setGranularity] = useState<Granularity>('daily');
  const [chartMode, setChartMode] = useState<ChartMode>('dual');
  const [sort, setSort] = useState<PerfSortState>({ field: 'clicks', order: 'desc' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(getDefaultVisibleColumns);
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const [localDateFrom, setLocalDateFrom] = useState(filters.dateFrom);
  const [localDateTo, setLocalDateTo] = useState(filters.dateTo);

  // Fetch from the real performance API with source=offerwall
  const fetchPerformance = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('start_date', localDateFrom || dateRange.start);
      params.append('end_date', localDateTo || dateRange.end);
      params.append('source', 'offerwall');
      params.append('group_by', groupByToApiParam(groupBy));
      params.append('granularity', granularity);
      params.append('page', String(page));
      params.append('per_page', String(filters.perPage || 50));
      params.append('sort_field', sort.field);
      params.append('sort_order', sort.order);
      if (filters.publisher) params.append('publisher_id', filters.publisher);
      if (filters.countries && filters.countries.length > 0) params.append('country', filters.countries.join(','));
      if (filters.vertical) params.append('category', filters.vertical);
      if (filters.network || filters.advertiser) params.append('network', filters.network || filters.advertiser);
      if (filters.device) params.append('device_type', filters.device);
      if (filters.offer) params.append('offer_id', filters.offer);

      const res = await fetch(`${API_BASE}/reports/performance?${params}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch performance');
      const json = await res.json();
      const report = json.report || json;
      setData(report.data || []);
      setSummary(report.summary || {});
      setTotalPages(report.pagination?.pages || 1);

      // Post-process: if groupBy is 'advertiser' (network), re-aggregate by network name
      if (groupBy === 'advertiser' && report.data) {
        const networkGroups: Record<string, any> = {};
        for (const row of report.data) {
          const net = row.network || 'Unknown';
          if (!networkGroups[net]) {
            networkGroups[net] = { ...row, network: net, clicks: 0, conversions: 0, total_payout: 0, total_revenue: 0, profit: 0, unique_clicks: 0, suspicious_clicks: 0 };
          }
          networkGroups[net].clicks += row.clicks || 0;
          networkGroups[net].conversions += row.conversions || 0;
          networkGroups[net].total_payout += row.total_payout || 0;
          networkGroups[net].total_revenue += row.total_revenue || 0;
          networkGroups[net].profit += row.profit || 0;
          networkGroups[net].unique_clicks += row.unique_clicks || 0;
        }
        const merged = Object.values(networkGroups).map((r: any) => ({
          ...r,
          cr: r.clicks > 0 ? (r.conversions / r.clicks) * 100 : 0,
          epc: r.clicks > 0 ? r.total_revenue / r.clicks : 0,
        }));
        setData(merged);
      }

      // Post-process: if groupBy is 'vertical' (category), re-aggregate by category name
      if (groupBy === 'vertical' && report.data) {
        const catGroups: Record<string, any> = {};
        for (const row of report.data) {
          const cat = row.category || 'Uncategorized';
          if (!catGroups[cat]) {
            catGroups[cat] = { ...row, category: cat, clicks: 0, conversions: 0, total_payout: 0, total_revenue: 0, profit: 0, unique_clicks: 0, suspicious_clicks: 0 };
          }
          catGroups[cat].clicks += row.clicks || 0;
          catGroups[cat].conversions += row.conversions || 0;
          catGroups[cat].total_payout += row.total_payout || 0;
          catGroups[cat].total_revenue += row.total_revenue || 0;
          catGroups[cat].profit += row.profit || 0;
          catGroups[cat].unique_clicks += row.unique_clicks || 0;
        }
        const merged = Object.values(catGroups).map((r: any) => ({
          ...r,
          cr: r.clicks > 0 ? (r.conversions / r.clicks) * 100 : 0,
          epc: r.clicks > 0 ? r.total_revenue / r.clicks : 0,
        }));
        setData(merged);
      }

      // Post-process: if groupBy is 'publisher', the backend now groups by publisher_id correctly
      // Just ensure publisher_name is shown (enrichment handles it)
    } catch (e) {
      console.error('Performance fetch error:', e);
      toast.error('Failed to load performance data');
    } finally {
      setLoading(false);
    }
  }, [groupBy, granularity, sort, page, fetchTrigger]);

  useEffect(() => { fetchPerformance(); }, [fetchPerformance]);

  // KPI totals from summary
  const totals = useMemo(() => ({
    clicks: summary.total_clicks || 0,
    conversions: summary.total_conversions || 0,
    payout: summary.total_payout || 0,
    revenue: summary.total_revenue || 0,
    cr: summary.total_clicks > 0 ? ((summary.total_conversions || 0) / summary.total_clicks) * 100 : 0,
    epc: summary.total_clicks > 0 ? (summary.total_revenue || 0) / summary.total_clicks : 0,
    margin: (summary.total_revenue || 0) - (summary.total_payout || 0),
  }), [summary]);

  const handleSort = (field: string) => {
    setSort(s => ({ field, order: s.field === field && s.order === 'desc' ? 'asc' : 'desc' }));
    setPage(1);
  };

  const getGroupLabel = (row: any): string => {
    switch (groupBy) {
      case 'publisher': return row.publisher_name || row.publisher_id || '—';
      case 'offer': return row.offer_name || row.offer_id || '—';
      case 'advertiser': return row.network || '—';
      case 'enduser': return row.user_id || '—'; // user_id in offerwall = end user
      case 'vertical': return row.category || '—';
      case 'country': return row.country || '—';
      case 'date': return row.date || '—';
      default: return '—';
    }
  };

  const SortHeader: React.FC<{ label: string; field: string }> = ({ label, field }) => (
    <TableHead className="cursor-pointer select-none text-xs whitespace-nowrap" onClick={() => handleSort(field)}>
      <div className="flex items-center gap-1">
        {label}
        {sort.field === field ? (sort.order === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* KPI Strip — compact, single row */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
        {[
          { label: 'PICKED', value: pickedCount.toString(), icon: '👆', bg: 'from-purple-50 to-purple-100/50 border-purple-200', text: 'text-purple-700' },
          { label: 'CLICKS', value: totals.clicks.toString(), icon: '🖱️', bg: 'from-blue-50 to-blue-100/50 border-blue-200', text: 'text-blue-700' },
          { label: 'CONV', value: totals.conversions.toString(), icon: '✅', bg: 'from-green-50 to-green-100/50 border-green-200', text: 'text-green-700' },
          { label: 'CR', value: formatPercent(totals.cr), icon: '📈', bg: 'from-indigo-50 to-indigo-100/50 border-indigo-200', text: 'text-indigo-700' },
          { label: 'EPC', value: formatCurrency(totals.epc), icon: '💰', bg: 'from-orange-50 to-orange-100/50 border-orange-200', text: 'text-orange-700' },
          { label: 'REVENUE', value: formatCurrency(totals.revenue), icon: '💵', bg: 'from-emerald-50 to-emerald-100/50 border-emerald-200', text: 'text-emerald-700' },
          { label: 'PAYOUT', value: formatCurrency(totals.payout), icon: '🏆', bg: 'from-amber-50 to-amber-100/50 border-amber-200', text: 'text-amber-700' },
          { label: 'MARGIN', value: `${totals.margin >= 0 ? '+' : ''}${formatCurrency(totals.margin)}`, icon: '📊', bg: totals.margin >= 0 ? 'from-green-50 to-green-100/50 border-green-200' : 'from-red-50 to-red-100/50 border-red-200', text: totals.margin >= 0 ? 'text-green-700' : 'text-red-700' },
        ].map(kpi => (
          <div key={kpi.label} className={`bg-gradient-to-br ${kpi.bg} border rounded-lg px-3 py-2 transition-all hover:shadow-sm`}>
            <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">{kpi.label}</p>
            <p className={`text-base font-black ${kpi.text}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-5">
        {/* Left control rail */}
        <div className="w-[170px] space-y-5 flex-shrink-0">
          {/* Group By */}
          <div className="bg-gray-50/80 rounded-xl p-3 border">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">GROUP BY</p>
            <div className="space-y-1">
              {GROUP_BY_OPTIONS.map(g => (
                <button
                  key={g.key}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                    groupBy === g.key 
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-200' 
                      : 'text-gray-600 hover:bg-white hover:shadow-sm'
                  }`}
                  onClick={() => { setGroupBy(g.key); setPage(1); }}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Granularity + Date Range */}
          <div className="bg-gray-50/80 rounded-xl p-3 border">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">GRANULARITY</p>
            <p className="text-[8px] text-gray-400 mb-2">Filter data by time period</p>
            <div className="grid grid-cols-2 gap-1">
              {GRANULARITY_OPTIONS.map(g => (
                <button
                  key={g.key}
                  className={`px-2 py-1.5 rounded-md text-[10px] font-semibold transition-all duration-200 ${
                    granularity === g.key
                      ? 'bg-orange-500 text-white shadow-sm shadow-orange-200' 
                      : 'bg-white text-gray-600 hover:bg-orange-50 border border-gray-200'
                  }`}
                  onClick={() => { setGranularity(g.key); if (groupBy !== 'date') setGroupBy('date'); setPage(1); setFetchTrigger(t => t + 1); }}
                >
                  {g.label}
                </button>
              ))}
            </div>
            {/* Date Range */}
            <div className="mt-3 pt-3 border-t space-y-2">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">DATE RANGE</p>
              <Input type="date" value={localDateFrom} onChange={e => setLocalDateFrom(e.target.value)} className="h-7 text-[10px]" />
              <Input type="date" value={localDateTo} onChange={e => setLocalDateTo(e.target.value)} className="h-7 text-[10px]" />
              <Button size="sm" className="w-full h-7 text-[10px] bg-purple-600 hover:bg-purple-700" onClick={() => setFetchTrigger(t => t + 1)}>
                Apply Date
              </Button>
            </div>
          </div>

          {/* Column Selector - moved to top bar */}
        </div>

        {/* Main content: Table + Chart */}
        <div className="flex-1 space-y-4 min-w-0">
          {/* Column selector at top of main content */}
          <div className="flex justify-end">
            <ColumnSelector
              columns={PERF_COLUMNS}
              visibleColumns={visibleColumns}
              onColumnChange={(id, visible) => setVisibleColumns(prev => ({ ...prev, [id]: visible }))}
              onSelectAll={() => { const all: Record<string, boolean> = {}; PERF_COLUMNS.forEach(c => { all[c.id] = true; }); setVisibleColumns(all); }}
              onClearAll={() => { const none: Record<string, boolean> = {}; PERF_COLUMNS.forEach(c => { none[c.id] = c.defaultVisible; }); setVisibleColumns(none); }}
            />
          </div>
          {/* Performance Table */}
          <div className="border rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-gray-50 to-gray-100/50">
                  <SortHeader label={groupBy === 'advertiser' ? 'NETWORK' : groupBy === 'enduser' ? 'END USER' : groupBy.toUpperCase()} field={groupBy === 'date' ? 'date' : groupBy === 'publisher' ? 'publisher_name' : groupBy === 'offer' ? 'offer_name' : groupBy === 'advertiser' ? 'network' : groupBy === 'enduser' ? 'user_id' : groupBy === 'vertical' ? 'category' : groupBy === 'country' ? 'country' : 'date'} />
                  {visibleColumns.clicks && <SortHeader label="CLICKS" field="clicks" />}
                  {visibleColumns.unique_clicks && <SortHeader label="UNIQUE" field="unique_clicks" />}
                  {visibleColumns.gross_clicks && <SortHeader label="OPENED" field="gross_clicks" />}
                  {visibleColumns.conversions && <SortHeader label="CONV" field="conversions" />}
                  {visibleColumns.pending_conversions && <TableHead className="text-xs">PENDING</TableHead>}
                  {visibleColumns.rejected_conversions && <TableHead className="text-xs">REVERSED</TableHead>}
                  {visibleColumns.cr && <SortHeader label="CR" field="cr" />}
                  {visibleColumns.rev_rate && <TableHead className="text-xs">REV RATE</TableHead>}
                  {visibleColumns.open_rate && <TableHead className="text-xs">OPEN RATE</TableHead>}
                  {visibleColumns.dup_rate && <TableHead className="text-xs">DUP RATE</TableHead>}
                  {visibleColumns.vpn_rate && <TableHead className="text-xs">VPN RATE</TableHead>}
                  {visibleColumns.avg_fraud && <SortHeader label="AVG FRAUD" field="suspicious_clicks" />}
                  {visibleColumns.epc && <SortHeader label="EPC" field="epc" />}
                  {visibleColumns.total_revenue && <SortHeader label="REVENUE" field="total_revenue" />}
                  {visibleColumns.total_payout && <SortHeader label="PAYOUT" field="total_payout" />}
                  {visibleColumns.profit && <SortHeader label="MARGIN" field="profit" />}
                  {visibleColumns.margin_pct && <TableHead className="text-xs">MARGIN %</TableHead>}
                  {visibleColumns.ecpa && <TableHead className="text-xs">eCPA</TableHead>}
                  {visibleColumns.avg_payout && <TableHead className="text-xs">AVG PAY</TableHead>}
                  {visibleColumns.geo_match_pct && <TableHead className="text-xs">GEO %</TableHead>}
                  {visibleColumns.postback_pct && <TableHead className="text-xs">PB %</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length + 1} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                      <span className="text-sm text-muted-foreground">Loading performance data...</span>
                    </div>
                  </TableCell></TableRow>
                ) : data.length === 0 ? (
                  <TableRow><TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length + 1} className="text-center py-12 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-200" />
                    <p className="font-medium">No data for this period</p>
                    <p className="text-xs mt-1">Try adjusting your date range or filters</p>
                  </TableCell></TableRow>
                ) : data.map((row: any, i: number) => {
                  const clicks = row.clicks || 0;
                  const convs = row.conversions || 0;
                  const rev = row.total_revenue || 0;
                  const pay = row.total_payout || 0;
                  const margin = row.profit || (rev - pay);
                  const marginPct = rev > 0 ? (margin / rev) * 100 : 0;
                  const ecpa = convs > 0 ? pay / convs : 0;
                  const avgPay = convs > 0 ? pay / convs : 0;
                  const drillKey = groupBy === 'publisher' ? 'publisher_id' : groupBy === 'offer' ? 'offer_id' : groupBy === 'advertiser' ? 'network' : groupBy === 'enduser' ? 'user_id' : groupBy === 'vertical' ? 'category' : groupBy === 'country' ? 'country' : '';
                  const drillValue = groupBy === 'publisher' ? (row.publisher_id || row.user_id || '') : groupBy === 'offer' ? (row.offer_id || '') : groupBy === 'advertiser' ? (row.network || '') : groupBy === 'enduser' ? (row.user_id || '') : groupBy === 'vertical' ? (row.category || '') : groupBy === 'country' ? (row.country || '') : '';
                  return (
                  <TableRow key={i} className="hover:bg-purple-50/40 cursor-pointer transition-colors duration-150 border-b border-gray-50" onClick={() => { if (onRowClick && drillKey && drillValue) onRowClick(drillKey, drillValue); }}>
                    <TableCell className="font-semibold text-sm max-w-[200px] truncate text-gray-800">{getGroupLabel(row)}</TableCell>
                    {visibleColumns.clicks && <TableCell className="font-bold text-sm">{clicks}</TableCell>}
                    {visibleColumns.unique_clicks && <TableCell className="text-sm">{row.unique_clicks || 0}</TableCell>}
                    {visibleColumns.gross_clicks && <TableCell className="text-sm">{row.gross_clicks || clicks}</TableCell>}
                    {visibleColumns.conversions && <TableCell className="text-sm">{convs}</TableCell>}
                    {visibleColumns.pending_conversions && <TableCell className="text-sm text-amber-600">{row.pending_conversions || 0}</TableCell>}
                    {visibleColumns.rejected_conversions && <TableCell className="text-sm text-red-500">{row.rejected_conversions || 0}</TableCell>}
                    {visibleColumns.cr && <TableCell className="text-sm font-medium text-green-600">{formatPercent(row.cr || 0)}</TableCell>}
                    {visibleColumns.rev_rate && <TableCell className="text-sm">{clicks > 0 ? formatPercent((rev / clicks) * 100) : '—'}</TableCell>}
                    {visibleColumns.open_rate && <TableCell className="text-sm">{clicks > 0 ? formatPercent(((row.gross_clicks || clicks) / clicks) * 100) : '—'}</TableCell>}
                    {visibleColumns.dup_rate && <TableCell className="text-sm">{clicks > 0 ? formatPercent(((row.suspicious_clicks || 0) / clicks) * 100) : '—'}</TableCell>}
                    {visibleColumns.vpn_rate && <TableCell className="text-sm">—</TableCell>}
                    {visibleColumns.avg_fraud && <TableCell className="text-sm text-orange-500">{row.suspicious_clicks || 0}</TableCell>}
                    {visibleColumns.epc && <TableCell className="text-sm font-medium text-blue-600">{formatCurrency(row.epc || 0)}</TableCell>}
                    {visibleColumns.total_revenue && <TableCell className="text-sm font-semibold text-emerald-600">{formatCurrency(rev)}</TableCell>}
                    {visibleColumns.total_payout && <TableCell className="text-sm">{formatCurrency(pay)}</TableCell>}
                    {visibleColumns.profit && <TableCell className={`text-sm font-semibold ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{margin >= 0 ? '+' : ''}{formatCurrency(margin)}</TableCell>}
                    {visibleColumns.margin_pct && <TableCell className="text-sm">{formatPercent(marginPct)}</TableCell>}
                    {visibleColumns.ecpa && <TableCell className="text-sm">{formatCurrency(ecpa)}</TableCell>}
                    {visibleColumns.avg_payout && <TableCell className="text-sm">{formatCurrency(avgPay)}</TableCell>}
                    {visibleColumns.geo_match_pct && <TableCell className="text-sm">—</TableCell>}
                    {visibleColumns.postback_pct && <TableCell className="text-sm">—</TableCell>}
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Showing {data.length} rows. Tap a column header to sort. Click a row to drill into Click Tracking.
          </p>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}

          {/* Chart */}
          <div className="border rounded-xl p-5 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold text-gray-700">Trend</p>
              <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
                {(['dual', 'single', 'top5'] as ChartMode[]).map(m => (
                  <button key={m}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-semibold transition-all duration-200 ${
                      chartMode === m ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setChartMode(m)}>
                    {m === 'dual' ? '📊 Clicks×CR' : m === 'single' ? 'Single' : '→ Top 5'}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[220px]">
              {data.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.slice(0, 10)} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey={groupBy === 'date' ? 'date' : groupBy === 'publisher' ? 'publisher_name' : groupBy === 'offer' ? 'offer_name' : groupBy === 'country' ? 'country' : groupBy === 'enduser' ? 'publisher_name' : 'network'} tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={50} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                    {chartMode === 'dual' && <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />}
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Bar yAxisId="left" dataKey="clicks" fill="#7c3aed" opacity={0.8} radius={[6, 6, 0, 0]} name="Clicks" />
                    {chartMode === 'dual' && <Line yAxisId="right" type="monotone" dataKey="cr" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981' }} name="CR %" />}
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  <p>No chart data available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


// ===================== CONVERSIONS TAB =====================

const ConversionsSubTab: React.FC<{ filters: FilterState; dateRange: { start: string; end: string }; logs: any[]; loading: boolean }> = ({ filters, dateRange }) => {
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [conversions, setConversions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState<{ field: string; order: 'asc' | 'desc' }>({ field: 'time', order: 'desc' });
  const [localDateFrom, setLocalDateFrom] = useState(filters.dateFrom || dateRange.start);
  const [localDateTo, setLocalDateTo] = useState(filters.dateTo || dateRange.end);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  // Fetch conversions from real API with source=offerwall
  const fetchConversions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('source', 'offerwall');
      params.append('start_date', localDateFrom);
      params.append('end_date', localDateTo);
      params.append('page', String(page));
      params.append('per_page', String(filters.perPage || 50));
      params.append('sort_field', sort.field === 'time' ? 'timestamp' : sort.field);
      params.append('sort_order', sort.order);
      if (filters.publisher) params.append('publisher_id', filters.publisher);
      if (filters.offer) params.append('offer_id', filters.offer);
      if (filters.network || filters.advertiser) params.append('network', filters.network || filters.advertiser);
      if (filters.vertical) params.append('category', filters.vertical);
      if (filters.device) params.append('device_type', filters.device);
      if (filters.countries && filters.countries.length > 0) params.append('country', filters.countries[0]);
      if (filters.search) params.append('search', filters.search);

      const res = await fetch(`${API_BASE}/reports/conversions?${params}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch conversions');
      const json = await res.json();
      const report = json.report || json;
      setConversions(report.conversions || []);
      setTotal(report.pagination?.total || 0);
      setTotalPages(report.pagination?.pages || 1);
    } catch (e) {
      console.error('Conversions fetch error:', e);
      toast.error('Failed to load conversion data');
    } finally {
      setLoading(false);
    }
  }, [page, filters, localDateFrom, localDateTo, fetchTrigger, sort]);

  useEffect(() => { fetchConversions(); }, [fetchConversions]);

  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'approved' || s === 'completed' || s === 'credited') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">● Completed</span>;
    if (s === 'pending' || s === 'processing') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">● Pending</span>;
    if (s === 'reversed' || s === 'rejected') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">● Reversed</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">● {status}</span>;
  };

  const getPostbackBadge = (conv: any) => {
    const fwd = conv.forward_status || '';
    if (fwd === 'forwarded' || fwd === 'success') return <span className="text-[10px] font-bold text-green-600">◉ Fired</span>;
    if (fwd === 'pending') return <span className="text-[10px] font-bold text-orange-500">◉ Pending</span>;
    if (fwd === 'failed') return <span className="text-[10px] font-bold text-red-500">◉ Failed</span>;
    if (conv.reversed_at) return <span className="text-[10px] font-bold text-red-500">◉ Reversed</span>;
    return <span className="text-[10px] text-gray-400">—</span>;
  };

  const SortHeader: React.FC<{ label: string; field: string }> = ({ label, field }) => (
    <TableHead className="cursor-pointer select-none text-[10px] whitespace-nowrap uppercase" onClick={() => { setSort(s => ({ field, order: s.field === field && s.order === 'desc' ? 'asc' : 'desc' })); setPage(1); }}>
      <div className="flex items-center gap-1">
        {label}
        {sort.field === field ? (sort.order === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-muted-foreground">{total} offerwall conversions</span>
        <div className="flex items-center gap-1.5 ml-auto">
          <Input type="date" value={localDateFrom} onChange={e => setLocalDateFrom(e.target.value)} className="h-7 w-[130px] text-[10px]" />
          <span className="text-xs text-muted-foreground">→</span>
          <Input type="date" value={localDateTo} onChange={e => setLocalDateTo(e.target.value)} className="h-7 w-[130px] text-[10px]" />
          <Button size="sm" className="h-7 text-[10px] bg-purple-600 hover:bg-purple-700 px-3" onClick={() => { setPage(1); setFetchTrigger(t => t + 1); }}>
            Apply
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <SortHeader label="TIME" field="time" />
              <SortHeader label="PUBLISHER" field="publisher_name" />
              <SortHeader label="USER" field="user_id" />
              <SortHeader label="OFFER" field="offer_name" />
              <SortHeader label="ADVERTISER" field="network" />
              <SortHeader label="VERTICAL" field="category" />
              <SortHeader label="STATUS" field="status" />
              <SortHeader label="PAYOUT" field="payout" />
              <SortHeader label="REVENUE" field="revenue" />
              <SortHeader label="MARGIN" field="profit" />
              <TableHead className="text-[10px] uppercase">CLICK ID</TableHead>
              <TableHead className="text-[10px] uppercase">POSTBACK</TableHead>
              <TableHead className="text-[10px] uppercase">⋯</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={13} className="text-center py-8">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                  <span className="text-xs text-muted-foreground">Loading conversions...</span>
                </div>
              </TableCell></TableRow>
            ) : conversions.length === 0 ? (
              <TableRow><TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 text-gray-200" />
                <p className="font-medium">No conversions found</p>
                <p className="text-xs mt-1">Conversions from offerwall postbacks will appear here</p>
              </TableCell></TableRow>
            ) : conversions.map((conv: any, i: number) => {
              const margin = conv.profit || (conv.revenue - conv.payout) || 0;
              return (
                <TableRow key={conv._id || conv.conversion_id || i} className="hover:bg-purple-50/20 text-xs">
                  <TableCell className="whitespace-nowrap text-muted-foreground">{conv.time || formatTime(conv.timestamp)}</TableCell>
                  <TableCell className="font-medium max-w-[120px] truncate">{conv.publisher_name || '—'}</TableCell>
                  <TableCell className="font-mono text-[10px] text-muted-foreground max-w-[80px] truncate" title={conv.user_id}>{conv.user_id || '—'}</TableCell>
                  <TableCell className="max-w-[150px] truncate font-medium">{conv.offer_name || '—'}</TableCell>
                  <TableCell className="text-muted-foreground text-[10px] max-w-[90px] truncate">{conv.advertiser_name || conv.network || '—'}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[8px] uppercase">{conv.category || '—'}</Badge></TableCell>
                  <TableCell>{getStatusBadge(conv.status)}</TableCell>
                  <TableCell className="font-semibold text-green-600">{conv.payout > 0 ? formatCurrency(conv.payout) : '—'}</TableCell>
                  <TableCell className="font-medium">{conv.revenue > 0 ? formatCurrency(conv.revenue) : '—'}</TableCell>
                  <TableCell className={`font-medium ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{margin !== 0 ? (margin >= 0 ? '+' : '') + formatCurrency(margin) : '—'}</TableCell>
                  <TableCell className="font-mono text-[9px] text-muted-foreground max-w-[80px] truncate" title={conv.click_id}>{conv.click_id ? conv.click_id.substring(0, 8) + '...' : '—'}</TableCell>
                  <TableCell>{getPostbackBadge(conv)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="text-xs w-[200px]">
                        <DropdownMenuItem onClick={() => toast.info('Mark completed')}>
                          <CheckCircle className="h-3.5 w-3.5 mr-2 text-green-600" /> Mark completed (credit user)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.info('Reverse conversion')}>
                          <XCircle className="h-3.5 w-3.5 mr-2 text-red-500" /> Reverse conversion
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed">🔒 Pause offer</DropdownMenuItem>
                        <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed">🔒 Block user</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Page {page} of {totalPages} ({total} total)</p>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
};


// ===================== CLICK TRACKING TAB =====================

type ClickStatus = 'all' | 'picked' | 'clicked' | 'pending' | 'completed' | 'reversed';

interface ClickTrackingProps {
  filters: FilterState;
  dateRange: { start: string; end: string };
  logs: any[];
  loading: boolean;
  drillFilter?: { key: string; value: string } | null;
  onClearDrill?: () => void;
}

const ClickTrackingSubTab: React.FC<ClickTrackingProps> = ({ filters, dateRange, drillFilter, onClearDrill }) => {
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusTab, setStatusTab] = useState<ClickStatus>('all');
  const [clicks, setClicks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({ all: 0, picked: 0, clicked: 0, pending: 0, completed: 0, reversed: 0 });
  const [scrollSection, setScrollSection] = useState<'identity' | 'funnel'>('identity');
  const [localDateFrom, setLocalDateFrom] = useState(filters.dateFrom || dateRange.start);
  const [localDateTo, setLocalDateTo] = useState(filters.dateTo || dateRange.end);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  // Fetch clicks from real API with source=offerwall
  const fetchClicks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('source', 'offerwall');
      params.append('start_date', localDateFrom);
      params.append('end_date', localDateTo);
      params.append('page', String(page));
      params.append('per_page', String(filters.perPage || 50));
      if (statusTab !== 'all') params.append('status', statusTab);
      if (filters.publisher) params.append('publisher_id', filters.publisher);
      if (filters.offer) params.append('offer_id', filters.offer);
      if (filters.network || filters.advertiser) params.append('network', filters.network || filters.advertiser);
      if (filters.vertical) params.append('category', filters.vertical);
      if (filters.device) params.append('device_type', filters.device);
      if (filters.countries && filters.countries.length > 0) params.append('country', filters.countries[0]);
      if (filters.search) params.append('search', filters.search);
      // Apply drill-down filter from Performance tab row click
      if (drillFilter) {
        if (drillFilter.key === 'publisher_id') params.set('publisher_id', drillFilter.value);
        else if (drillFilter.key === 'offer_id') params.set('offer_id', drillFilter.value);
        else if (drillFilter.key === 'network') params.set('network', drillFilter.value);
        else if (drillFilter.key === 'category') params.set('category', drillFilter.value);
        else if (drillFilter.key === 'country') params.set('country', drillFilter.value);
        else if (drillFilter.key === 'user_id') params.set('user_id', drillFilter.value);
      }

      const res = await fetch(`${API_BASE}/reports/clicks?${params}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch clicks');
      const json = await res.json();
      setClicks(json.clicks || []);
      setTotal(json.pagination?.total || 0);
      setTotalPages(json.pagination?.pages || 1);
      if (json.status_counts && Object.keys(json.status_counts).length > 0) {
        setStatusCounts(json.status_counts);
      }
    } catch (e) {
      console.error('Click fetch error:', e);
      toast.error('Failed to load click tracking data');
    } finally {
      setLoading(false);
    }
  }, [page, statusTab, filters, localDateFrom, localDateTo, drillFilter, fetchTrigger]);

  useEffect(() => { fetchClicks(); }, [fetchClicks]);
  useEffect(() => { setPage(1); }, [statusTab]);

  const getStatusColor = (status: string): string => {
    switch ((status || '').toLowerCase()) {
      case 'completed': return 'bg-green-100 text-green-700 border-green-200';
      case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'reversed': return 'bg-red-100 text-red-700 border-red-200';
      case 'picked': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const getStatusPillBg = (s: ClickStatus): string => {
    switch (s) {
      case 'all': return 'bg-purple-600';
      case 'picked': return 'bg-purple-500';
      case 'clicked': return 'bg-blue-500';
      case 'pending': return 'bg-amber-500';
      case 'completed': return 'bg-green-600';
      case 'reversed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getFraudBadge = (score: number) => {
    if (score >= 70) return <span className="text-[9px] font-bold text-red-600">🔴 {score}</span>;
    if (score >= 30) return <span className="text-[9px] font-bold text-orange-500">🟠 {score}</span>;
    if (score > 0) return <span className="text-[9px] font-bold text-green-600">🟢 {score}</span>;
    return <span className="text-[9px] text-gray-400">—</span>;
  };

  const handleAction = (action: string, click: any) => {
    switch (action) {
      case 'mark_completed':
        toast.info(`Mark completed: ${click.offer_name} for user ${click.end_user_id || click.user_id}`);
        break;
      case 'reverse':
        toast.info(`Reverse conversion: ${click.click_id}`);
        break;
      case 'pause_offer':
        toast.info(`Pause offer: ${click.offer_name}`);
        break;
      case 'block_user':
        toast.info(`Block user: ${click.end_user_id || click.user_id}`);
        break;
      case 'block_ip':
        toast.info(`Block IP: ${click.ip_address}`);
        break;
      case 'change_payout_all':
        toast.info(`Change payout (all): ${click.offer_name}`);
        break;
      case 'change_payout_user':
        toast.info(`Change payout (user): ${click.end_user_id || click.user_id}`);
        break;
      case 'send_warning':
        toast.info(`Send warning to publisher: ${click.publisher_name}`);
        break;
      case 'request_proof':
        toast.info(`Request proof: ${click.click_id}`);
        break;
    }
  };

  return (
    <div className="space-y-4">
      {/* Drill-down banner */}
      {drillFilter && (
        <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg">
          <span className="text-xs font-medium text-purple-700">Filtered by {drillFilter.key.replace('_', ' ')}: <span className="font-bold">{drillFilter.value}</span></span>
          <Button variant="ghost" size="sm" className="h-6 text-[10px] text-purple-600 hover:text-purple-800" onClick={onClearDrill}>✕ Clear</Button>
        </div>
      )}

      {/* Date range + Status filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Input type="date" value={localDateFrom} onChange={e => setLocalDateFrom(e.target.value)} className="h-7 w-[130px] text-[10px]" />
          <span className="text-xs text-muted-foreground">→</span>
          <Input type="date" value={localDateTo} onChange={e => setLocalDateTo(e.target.value)} className="h-7 w-[130px] text-[10px]" />
          <Button size="sm" className="h-7 text-[10px] bg-purple-600 hover:bg-purple-700 px-3" onClick={() => { setPage(1); setFetchTrigger(t => t + 1); }}>
            Apply
          </Button>
        </div>
        <div className="h-5 w-px bg-gray-200 mx-1" />
        {(['all', 'picked', 'clicked', 'pending', 'completed', 'reversed'] as ClickStatus[]).map(s => (
          <Button
            key={s}
            size="sm"
            variant={statusTab === s ? 'default' : 'outline'}
            className={`h-7 text-[11px] gap-1 ${statusTab === s ? getStatusPillBg(s) + ' text-white' : ''}`}
            onClick={() => setStatusTab(s)}
          >
            {s === 'all' ? `All ${statusCounts.all || total}` : `● ${s.charAt(0).toUpperCase() + s.slice(1)} ${statusCounts[s] || 0}`}
          </Button>
        ))}
        <span className="text-xs text-muted-foreground ml-2">{total} total clicks</span>
      </div>

      {/* Section toggle */}
      <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg w-fit">
        <button
          className={`px-3 py-1.5 rounded-md text-[10px] font-semibold transition-all ${scrollSection === 'identity' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setScrollSection('identity')}>
          🆔 Identity + Offer
        </button>
        <button
          className={`px-3 py-1.5 rounded-md text-[10px] font-semibold transition-all ${scrollSection === 'funnel' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setScrollSection('funnel')}>
          🔄 Funnel + Time + Integrity + Postback
        </button>
      </div>

      {/* Click Tracking Table */}
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            {scrollSection === 'identity' ? (
              <>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-[9px] uppercase font-bold text-gray-600" colSpan={1}>TIME</TableHead>
                  <TableHead className="text-[9px] uppercase font-bold text-purple-600" colSpan={4}>IDENTITY</TableHead>
                  <TableHead className="text-[9px] uppercase font-bold text-blue-600" colSpan={7}>OFFER</TableHead>
                  <TableHead className="text-[9px] uppercase font-bold text-teal-600" colSpan={3}>GEO + DEVICE</TableHead>
                  <TableHead className="text-[9px] uppercase font-bold text-green-600" colSpan={1}>STATUS</TableHead>
                  <TableHead className="text-[9px] uppercase">⋯</TableHead>
                </TableRow>
                <TableRow className="bg-gray-50/50">
                  <TableHead className="text-[10px] whitespace-nowrap">Timestamp</TableHead>
                  <TableHead className="text-[10px] whitespace-nowrap">Publisher</TableHead>
                  <TableHead className="text-[10px] whitespace-nowrap">Pub ID</TableHead>
                  <TableHead className="text-[10px] whitespace-nowrap">Role</TableHead>
                  <TableHead className="text-[10px] whitespace-nowrap">User</TableHead>
                  <TableHead className="text-[10px] whitespace-nowrap">Advertiser</TableHead>
                  <TableHead className="text-[10px] whitespace-nowrap">Offer</TableHead>
                  <TableHead className="text-[10px] whitespace-nowrap">Offer ID</TableHead>
                  <TableHead className="text-[10px] whitespace-nowrap">Vertical</TableHead>
                  <TableHead className="text-[10px] whitespace-nowrap">Reward</TableHead>
                  <TableHead className="text-[10px] whitespace-nowrap">Revenue</TableHead>
                  <TableHead className="text-[10px] whitespace-nowrap">Margin</TableHead>
                  <TableHead className="text-[10px] whitespace-nowrap">IP Address</TableHead>
                  <TableHead className="text-[10px] whitespace-nowrap">Country</TableHead>
                  <TableHead className="text-[10px] whitespace-nowrap">Device</TableHead>
                  <TableHead className="text-[10px] whitespace-nowrap">Status</TableHead>
                  <TableHead className="text-[10px] whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </>
            ) : (
              <>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-[9px] uppercase font-bold text-green-600" colSpan={1}>STATUS</TableHead>
                  <TableHead className="text-[9px] uppercase font-bold text-blue-600" colSpan={3}>FUNNEL + TIME</TableHead>
                  <TableHead className="text-[9px] uppercase font-bold text-orange-600" colSpan={5}>INTEGRITY</TableHead>
                  <TableHead className="text-[9px] uppercase font-bold text-indigo-600" colSpan={3}>POSTBACK</TableHead>
                  <TableHead className="text-[9px] uppercase">⋯</TableHead>
                </TableRow>
                <TableRow className="bg-gray-50/50">
                  <TableHead className="text-[10px] whitespace-nowrap">Status</TableHead>
                  <TableHead className="text-[10px] whitespace-nowrap">Opened?</TableHead>
                  <TableHead className="text-[10px] whitespace-nowrap">Timestamp</TableHead>
                  <TableHead className="text-[10px] whitespace-nowrap">Time Spent</TableHead>
                  <TableHead className="text-[10px] whitespace-nowrap">Geo</TableHead>
                  <TableHead className="text-[10px] whitespace-nowrap">Device</TableHead>
                  <TableHead className="text-[10px] whitespace-nowrap">VPN</TableHead>
                  <TableHead className="text-[10px] whitespace-nowrap">Dup</TableHead>
                  <TableHead className="text-[10px] whitespace-nowrap">Fraud</TableHead>
                  <TableHead className="text-[10px] whitespace-nowrap">Adv PB</TableHead>
                  <TableHead className="text-[10px] whitespace-nowrap">Pub PB</TableHead>
                  <TableHead className="text-[10px] whitespace-nowrap">PB Status</TableHead>
                  <TableHead className="text-[10px] whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </>
            )}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={17} className="text-center py-8">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                  <span className="text-xs text-muted-foreground">Loading click data...</span>
                </div>
              </TableCell></TableRow>
            ) : clicks.length === 0 ? (
              <TableRow><TableCell colSpan={17} className="text-center py-8 text-muted-foreground">
                <MousePointerClick className="h-8 w-8 mx-auto mb-2 text-gray-200" />
                <p className="font-medium">No clicks found</p>
                <p className="text-xs mt-1">Try adjusting your date range or filters</p>
              </TableCell></TableRow>
            ) : clicks.map((cl: any, i: number) => {
              const status = (cl.status || 'clicked');
              const statusDisplay = status.charAt(0).toUpperCase() + status.slice(1);

              if (scrollSection === 'identity') {
                return (
                  <TableRow key={cl._id || cl.click_id || i} className="hover:bg-purple-50/30 text-xs border-b border-gray-50">
                    <TableCell className="whitespace-nowrap text-[10px] text-muted-foreground">{cl.time || cl.when_clicked || (cl.timestamp ? formatTime(String(cl.timestamp)) : '—')}</TableCell>
                    <TableCell className="font-medium max-w-[110px] truncate">{cl.publisher_name || '—'}</TableCell>
                    <TableCell className="font-mono text-[9px] text-muted-foreground max-w-[80px] truncate" title={cl.publisher_id || ''}>{cl.publisher_id ? String(cl.publisher_id).substring(0, 8) + '...' : '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-[10px]">{cl.publisher_role || 'partner'}</TableCell>
                    <TableCell className="font-mono text-[9px] max-w-[80px] truncate" title={cl.end_user_id || cl.user_id}>{cl.end_user_id || cl.user_id || '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-[10px] max-w-[90px] truncate">{cl.advertiser_name || cl.network || '—'}</TableCell>
                    <TableCell className="max-w-[140px] truncate font-medium" title={cl.offer_name}>{cl.offer_name || '—'}</TableCell>
                    <TableCell className="font-mono text-[9px] text-muted-foreground max-w-[70px] truncate">{cl.offer_id || '—'}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[8px] uppercase">{cl.category || '—'}</Badge></TableCell>
                    <TableCell className="font-semibold text-green-600">{(cl.payout || 0) > 0 ? formatCurrency(cl.payout) : '—'}</TableCell>
                    <TableCell className="text-sm">{(cl.revenue || 0) > 0 ? formatCurrency(cl.revenue) : '—'}</TableCell>
                    <TableCell className={`font-medium ${(cl.margin || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{cl.margin != null ? ((cl.margin >= 0 ? '+' : '') + formatCurrency(cl.margin)) : '—'}</TableCell>
                    <TableCell className="font-mono text-[9px] text-muted-foreground max-w-[100px] truncate" title={safeStr(cl.ip_address)}>{safeStr(cl.ip_address) || '—'}</TableCell>
                    <TableCell className="text-[10px] whitespace-nowrap">{safeStr(cl.country) || '—'}{cl.city && typeof cl.city === 'string' && cl.city !== 'Unknown' ? `, ${cl.city}` : ''}</TableCell>
                    <TableCell className="text-[10px]">{safeStr(cl.device_type) || '—'}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${getStatusColor(status)}`}>
                        ● {statusDisplay}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="text-xs w-[200px]">
                          <DropdownMenuItem onClick={() => handleAction('mark_completed', cl)}>
                            <CheckCircle className="h-3.5 w-3.5 mr-2 text-green-600" /> Mark completed (credit user)
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAction('reverse', cl)}>
                            <XCircle className="h-3.5 w-3.5 mr-2 text-red-500" /> Reverse conversion
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed">?? Pause offer</DropdownMenuItem>
                          <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed">?? Block user</DropdownMenuItem>
                          <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed">?? Block IP</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed">?? Change payout (all)</DropdownMenuItem>
                          <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed">?? Change payout (user)</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed">?? Send warning</DropdownMenuItem>
                          <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed">?? Request proof</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              } else {
                // FUNNEL + TIME + INTEGRITY + POSTBACK view
                return (
                  <TableRow key={cl._id || cl.click_id || i} className="hover:bg-purple-50/30 text-xs border-b border-gray-50">
                    <TableCell>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${getStatusColor(status)}`}>
                        ● {statusDisplay}
                      </span>
                    </TableCell>
                    <TableCell className="text-[10px]">{cl.beacon_received || cl.when_closed ? '✓ Yes' : '—'}</TableCell>
                    <TableCell className="whitespace-nowrap text-[10px] text-muted-foreground">{cl.time || cl.when_clicked || '—'}</TableCell>
                    <TableCell className="text-[10px] font-medium">{cl.time_spent || '—'}</TableCell>
                    <TableCell className="text-[10px]">{safeStr(cl.country) || '—'}{cl.city && typeof cl.city === 'string' ? `, ${cl.city}` : ''}</TableCell>
                    <TableCell className="text-[10px]">{safeStr(cl.device_type) || '—'}</TableCell>
                    <TableCell>{cl.is_vpn && cl.is_vpn !== false ? <span className="text-[9px] font-bold text-red-600">⚠ VPN</span> : <span className="text-[9px] text-green-600">✓</span>}</TableCell>
                    <TableCell>{cl.is_duplicate ? <span className="text-[9px] font-bold text-orange-500">⚠ Dup</span> : <span className="text-[9px] text-green-600">✓</span>}</TableCell>
                    <TableCell>{getFraudBadge(cl.fraud_score || 0)}</TableCell>
                    <TableCell className="text-[10px]">
                      {cl.adv_postback_status === 'received' ? <span className="text-green-600 font-bold">✓ Recv</span> : <span className="text-gray-400">—</span>}
                    </TableCell>
                    <TableCell className="text-[10px]">
                      {cl.pub_postback_status === 'forwarded' || cl.pub_postback_status === 'success' 
                        ? <span className="text-green-600 font-bold">✓ Fwd</span> 
                        : cl.pub_postback_status === 'failed' 
                          ? <span className="text-red-500 font-bold">✕ Fail</span>
                          : <span className="text-gray-400">—</span>}
                    </TableCell>
                    <TableCell className="text-[10px]">
                      {cl.adv_postback_status === 'received' && cl.pub_postback_status === 'forwarded' 
                        ? <Badge variant="outline" className="text-[8px] bg-green-50 text-green-700 border-green-200">Complete</Badge>
                        : cl.adv_postback_status === 'received' 
                          ? <Badge variant="outline" className="text-[8px] bg-amber-50 text-amber-700 border-amber-200">Partial</Badge>
                          : <span className="text-gray-400">—</span>}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="text-xs w-[200px]">
                          <DropdownMenuItem onClick={() => handleAction('mark_completed', cl)}>
                            <CheckCircle className="h-3.5 w-3.5 mr-2 text-green-600" /> Mark completed (credit user)
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAction('reverse', cl)}>
                            <XCircle className="h-3.5 w-3.5 mr-2 text-red-500" /> Reverse conversion
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed">?? Pause offer</DropdownMenuItem>
                          <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed">?? Block user</DropdownMenuItem>
                          <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed">?? Block IP</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed">?? Change payout (all)</DropdownMenuItem>
                          <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed">?? Change payout (user)</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed">?? Send warning</DropdownMenuItem>
                          <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed">?? Request proof</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              }
            })}
          </TableBody>
        </Table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
        <span>● <span className="text-green-600">genuine 0–29</span></span>
        <span>● <span className="text-orange-500">suspicious 30–69</span></span>
        <span>● <span className="text-red-600">fraud 70+</span></span>
        <span className="ml-4">VPN = VPN/proxy detected · Dup = duplicate click · Fraud = fraud score</span>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Page {page} of {totalPages} ({total} total)</p>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
};


// ===================== MAIN COMPONENT =====================

export const OfferwallReports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'performance' | 'conversions' | 'clicks' | 'insights' | 'activity'>('performance');
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [filterOptions, setFilterOptions] = useState<{ publishers: { id: string; name: string }[]; offers: { id: string; name: string }[]; countries: string[]; verticals: string[]; networks: string[]; devices: string[] }>({
    publishers: [], offers: [], countries: [], verticals: [], networks: [], devices: []
  });
  const [dateRange, setDateRange] = useState({ start: formatDate(30), end: formatDate(0) });
  const [drillFilter, setDrillFilter] = useState<{ key: string; value: string } | null>(null);
  const [globalRefresh, setGlobalRefresh] = useState(0);

  // Load filter options from the real reports API
  const loadFilterOptions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/reports/filters`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setFilterOptions({
          publishers: (data.publishers || []).map((p: any) => ({ id: p.id || p.username, name: p.name || p.username })),
          offers: (data.offers || []).map((o: any) => ({ id: o.id, name: o.name })),
          countries: data.countries || [],
          verticals: data.categories || [],
          networks: data.networks || [],
          devices: data.device_types || [],
        });
      }
    } catch (e) { console.error('Failed to load filter options:', e); }
  }, []);

  // Fetch all offerwall logs once for Conversions/Click tracking tabs
  const fetchAllLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchOfferwallLogs({ status: 'all', per_page: 1000, search: '' });
      const logs = res.logs || [];
      setAllLogs(logs);
    } catch (e) {
      console.error('Failed to load offerwall logs:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAllLogs(); loadFilterOptions(); }, [fetchAllLogs, loadFilterOptions]);

  // Apply filters to logs for Conversions/Click tracking tabs
  const filteredLogs = useMemo(() => {
    return allLogs.filter(log => {
      if (filters.dateFrom && log.timestamp) {
        const logDate = log.timestamp.substring(0, 10);
        if (logDate < filters.dateFrom) return false;
      }
      if (filters.dateTo && log.timestamp) {
        const logDate = log.timestamp.substring(0, 10);
        if (logDate > filters.dateTo) return false;
      }
      if (filters.publisher && log.publisher_name !== filters.publisher && log.publisher_id !== filters.publisher) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const match = (log.offer_name || '').toLowerCase().includes(q) ||
          (log.publisher_name || '').toLowerCase().includes(q) ||
          (log.user_id || '').toLowerCase().includes(q) ||
          (log.offer_id || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [allLogs, filters]);

  // Count picks from tracking logs
  const pickedCount = useMemo(() => allLogs.filter(l => l.status === 'picked').length, [allLogs]);

  const handleRefresh = () => { 
    fetchAllLogs(); 
    // Update dateRange.end to today and trigger subtab refreshes
    const today = formatDate(0);
    setDateRange(r => ({ ...r, end: today }));
    setFilters(f => ({ ...f, dateTo: today }));
    setGlobalRefresh(r => r + 1); 
  };

  const handleExport = () => {
    const headers = ['Offer', 'Offer ID', 'Publisher', 'User', 'Status', 'Reward', 'Timestamp'];
    const rows = filteredLogs.map(l => [l.offer_name, l.offer_id, l.publisher_name, l.user_id, l.status, l.reward || 0, l.timestamp]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `offerwall_tracking_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a); a.click(); URL.revokeObjectURL(url);
    toast.success('Export downloaded');
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-purple-600" />
          Offerwall reports
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">Performance, conversions and raw clicks — who, what, when, and whether it paid back.</p>
      </div>

      {/* Shared Filters */}
      <ReportFilters
        filters={filters}
        setFilters={setFilters}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        onRefresh={handleRefresh}
        onExport={handleExport}
        loading={loading}
        filterOptions={filterOptions}
      />

      {/* Sub-tabs */}
      <div className="flex gap-0.5 border-b">
        <button
          onClick={() => setActiveTab('performance')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'performance' ? 'border-purple-600 text-purple-700' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'}`}
        >
          <TrendingUp className="h-4 w-4" /> Performance
        </button>
        <button
          onClick={() => setActiveTab('conversions')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'conversions' ? 'border-purple-600 text-purple-700' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'}`}
        >
          <FileText className="h-4 w-4" /> Conversions
        </button>
        <button
          onClick={() => { setActiveTab('clicks'); setDrillFilter(null); }}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'clicks' ? 'border-purple-600 text-purple-700' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'}`}
        >
          <MousePointerClick className="h-4 w-4" /> Click tracking
        </button>
        <button
          onClick={() => setActiveTab('insights')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'insights' ? 'border-purple-600 text-purple-700' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'}`}
        >
          <BarChart3 className="h-4 w-4" /> Insights
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'activity' ? 'border-purple-600 text-purple-700' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'}`}
        >
          <Activity className="h-4 w-4" /> Activity log
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'performance' && <PerformanceSubTab filters={filters} dateRange={dateRange} logs={filteredLogs} loading={loading} pickedCount={pickedCount} onRowClick={(key, value) => { setDrillFilter({ key, value }); setActiveTab('clicks'); }} />}
      {activeTab === 'conversions' && <ConversionsSubTab filters={filters} dateRange={dateRange} logs={filteredLogs} loading={loading} />}
      {activeTab === 'clicks' && <ClickTrackingSubTab filters={filters} dateRange={dateRange} logs={filteredLogs} loading={loading} drillFilter={drillFilter} onClearDrill={() => setDrillFilter(null)} />}
      {activeTab === 'insights' && (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          <BarChart3 className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Insights</p>
          <p className="text-sm">Top-5 performance panels by publisher, offer, advertiser, vertical, and geo will appear here.</p>
        </div>
      )}
      {activeTab === 'activity' && (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          <Activity className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Activity Log</p>
          <p className="text-sm">Admin actions on offerwall tracking (mark completed, reverse, block, etc.) will appear here.</p>
        </div>
      )}
    </div>
  );
};

export default OfferwallReports;
