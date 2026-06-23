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
  country: string;
  vertical: string;
  publisher: string;
  network: string;
  device: string;
  dateFrom: string;
  dateTo: string;
  perPage: number;
}

const defaultFilters: FilterState = {
  search: '', country: '', vertical: '', publisher: '', network: '',
  device: '', dateFrom: formatDate(30), dateTo: formatDate(0), perPage: 50
};

interface ReportFiltersProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  showFilters: boolean;
  setShowFilters: (v: boolean) => void;
  onRefresh: () => void;
  onExport: () => void;
  loading: boolean;
  filterOptions: { publishers: string[]; countries: string[]; verticals: string[]; networks: string[] };
}

const ReportFilters: React.FC<ReportFiltersProps> = ({ filters, setFilters, showFilters, setShowFilters, onRefresh, onExport, loading, filterOptions }) => {
  const activeCount = Object.entries(filters).filter(([k, v]) => v && k !== 'search' && k !== 'dateFrom' && k !== 'dateTo' && k !== 'perPage').length;

  return (
    <div className="space-y-3">
      {/* Top row */}
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
        {/* Date range */}
        <Input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} className="w-[130px] h-9 text-xs" />
        <span className="text-xs text-muted-foreground">to</span>
        <Input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} className="w-[130px] h-9 text-xs" />
        <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="h-4 w-4" /> Filters {activeCount > 0 && <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">{activeCount}</Badge>}
        </Button>
        <Button variant="outline" size="sm" className="h-9" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
        <Button size="sm" className="h-9 gap-1.5 bg-purple-600 hover:bg-purple-700" onClick={onExport}>
          <Download className="h-4 w-4" /> Export
        </Button>
      </div>

      {/* Extended filters row */}
      {showFilters && (
        <div className="flex items-center gap-2 flex-wrap p-3 bg-gray-50 rounded-lg border">
          <Select value={filters.publisher || 'all'} onValueChange={v => setFilters(f => ({ ...f, publisher: v === 'all' ? '' : v }))}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Publisher: All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Publisher: All</SelectItem>
              {filterOptions.publishers.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.network || 'all'} onValueChange={v => setFilters(f => ({ ...f, network: v === 'all' ? '' : v }))}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Partner: All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Partner: All</SelectItem>
              {filterOptions.networks.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.country || 'all'} onValueChange={v => setFilters(f => ({ ...f, country: v === 'all' ? '' : v }))}>
            <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="Country: All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Country: All</SelectItem>
              {filterOptions.countries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.vertical || 'all'} onValueChange={v => setFilters(f => ({ ...f, vertical: v === 'all' ? '' : v }))}>
            <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="Vertical: All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Vertical: All</SelectItem>
              {filterOptions.verticals.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          {/* Per page selector */}
          <Select value={String(filters.perPage)} onValueChange={v => setFilters(f => ({ ...f, perPage: Number(v) }))}>
            <SelectTrigger className="w-[90px] h-8 text-xs"><SelectValue placeholder="Per page" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20 / page</SelectItem>
              <SelectItem value="50">50 / page</SelectItem>
              <SelectItem value="100">100 / page</SelectItem>
            </SelectContent>
          </Select>
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-red-500" onClick={() => setFilters(defaultFilters)}>
              Clear all
            </Button>
          )}
        </div>
      )}
    </div>
  );
};


// ===================== PERFORMANCE TAB =====================

type GroupByKey = 'publisher' | 'offer' | 'advertiser' | 'vertical' | 'country' | 'date';
type Granularity = 'hourly' | 'daily' | 'weekly' | 'monthly';
type ChartMode = 'dual' | 'single' | 'top5';

const GROUP_BY_OPTIONS: { key: GroupByKey; label: string }[] = [
  { key: 'publisher', label: 'Publisher' },
  { key: 'offer', label: 'Offer' },
  { key: 'advertiser', label: 'Advertiser' },
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
    case 'publisher': return 'publisher_id';
    case 'offer': return 'offer_id';
    case 'advertiser': return 'network';
    case 'vertical': return 'category';
    case 'country': return 'country';
    case 'date': return 'date';
    default: return 'date';
  }
};

interface PerfSortState { field: string; order: 'asc' | 'desc'; }

const PerformanceSubTab: React.FC<{ filters: FilterState; dateRange: { start: string; end: string }; logs: any[]; loading: boolean }> = ({ filters, dateRange, logs: allLogs, loading }) => {
  const [groupBy, setGroupBy] = useState<GroupByKey>('publisher');
  const [granularity, setGranularity] = useState<Granularity>('daily');
  const [chartMode, setChartMode] = useState<ChartMode>('dual');
  const [sort, setSort] = useState<PerfSortState>({ field: 'total_clicks', order: 'desc' });
  const [page, setPage] = useState(1);

  // Aggregate logs by groupBy key
  const data = useMemo(() => {
    const groups: Record<string, { name: string; clicks: number; conversions: number; picked: number; reward: number }> = {};
    
    for (const log of allLogs) {
      let key = '';
      switch (groupBy) {
        case 'publisher': key = log.publisher_name || 'Unknown'; break;
        case 'offer': key = log.offer_name || 'Unknown'; break;
        case 'advertiser': key = log.publisher_name || 'Unknown'; break; // advertiser from placement context
        case 'vertical': key = 'General'; break; // not tracked per-log
        case 'country': key = 'Global'; break; // not tracked per-log
        case 'date': key = log.timestamp?.substring(0, 10) || 'Unknown'; break;
        default: key = 'Unknown';
      }
      
      if (!groups[key]) groups[key] = { name: key, clicks: 0, conversions: 0, picked: 0, reward: 0 };
      
      const status = (log.status || '').toLowerCase();
      if (status === 'clicked') groups[key].clicks++;
      else if (status === 'completed') { groups[key].conversions++; groups[key].reward += log.reward || 0; }
      else if (status === 'picked') groups[key].picked++;
      else if (status === 'pending') groups[key].clicks++; // pending = clicked but not converted yet
    }

    // Convert to array and sort
    let rows = Object.values(groups).map(g => ({
      ...g,
      total_clicks: g.clicks + g.conversions, // total clicks includes those that converted
      cr: (g.clicks + g.conversions) > 0 ? (g.conversions / (g.clicks + g.conversions)) * 100 : 0,
      epc: (g.clicks + g.conversions) > 0 ? g.reward / (g.clicks + g.conversions) : 0,
      total_payout: g.reward,
    }));

    // Sort
    rows.sort((a, b) => {
      const aVal = (a as any)[sort.field] || 0;
      const bVal = (b as any)[sort.field] || 0;
      return sort.order === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return rows;
  }, [allLogs, groupBy, sort]);

  // Paginate data
  const perPage = filters.perPage || 50;
  const totalPages = Math.max(1, Math.ceil(data.length / perPage));
  const paginatedData = useMemo(() => {
    const start = (page - 1) * perPage;
    return data.slice(start, start + perPage);
  }, [data, page, perPage]);

  // KPI totals
  const totals = useMemo(() => {
    const t = { clicks: 0, conversions: 0, picked: 0, reward: 0 };
    allLogs.forEach(log => {
      const s = (log.status || '').toLowerCase();
      if (s === 'clicked' || s === 'pending') t.clicks++;
      else if (s === 'completed') { t.conversions++; t.reward += log.reward || 0; }
      else if (s === 'picked') t.picked++;
    });
    const totalClicks = t.clicks + t.conversions;
    return {
      ...t,
      totalClicks,
      cr: totalClicks > 0 ? (t.conversions / totalClicks) * 100 : 0,
      epc: totalClicks > 0 ? t.reward / totalClicks : 0,
    };
  }, [allLogs]);

  const handleSort = (field: string) => {
    setSort(s => ({ field, order: s.field === field && s.order === 'desc' ? 'asc' : 'desc' }));
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
    <div className="space-y-4">
      {/* KPI Strip */}
      <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
        {[
          { label: 'PICKED', value: totals.picked.toString(), sub: '', color: 'border-l-purple-400' },
          { label: 'CLICKS', value: totals.totalClicks.toString(), sub: '', color: 'border-l-blue-400' },
          { label: 'CONVERSIONS', value: totals.conversions.toString(), sub: '', color: 'border-l-green-400' },
          { label: 'CR', value: formatPercent(totals.cr), sub: 'conv ÷ clicks', color: 'border-l-indigo-400' },
          { label: 'EPC', value: formatCurrency(totals.epc), sub: 'reward ÷ clicks', color: 'border-l-orange-400' },
          { label: 'TOTAL REWARD', value: formatCurrency(totals.reward), sub: '', color: 'border-l-emerald-400' },
        ].map(kpi => (
          <div key={kpi.label} className={`border rounded-lg p-3 border-l-4 ${kpi.color} bg-white`}>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{kpi.label}</p>
            <p className="text-lg font-black mt-0.5">{kpi.value}</p>
            {kpi.sub && <p className="text-[9px] text-muted-foreground">{kpi.sub}</p>}
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        {/* Left control rail */}
        <div className="w-[160px] space-y-4 flex-shrink-0">
          {/* Group By */}
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">GROUP BY</p>
            <div className="space-y-1">
              {GROUP_BY_OPTIONS.map(g => (
                <Button
                  key={g.key}
                  size="sm"
                  variant={groupBy === g.key ? 'default' : 'ghost'}
                  className={`w-full justify-start h-8 text-xs ${groupBy === g.key ? 'bg-purple-600 text-white' : ''}`}
                  onClick={() => { setGroupBy(g.key); }}
                >
                  {g.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Granularity */}
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">GRANULARITY <span className="text-[8px] opacity-60">(DATE GROUPING ONLY)</span></p>
            <div className="flex flex-wrap gap-1">
              {GRANULARITY_OPTIONS.map(g => (
                <Button
                  key={g.key}
                  size="sm"
                  variant={granularity === g.key ? 'default' : 'outline'}
                  className={`h-7 text-[10px] px-2 ${granularity === g.key ? 'bg-orange-500 text-white border-orange-500' : ''}`}
                  disabled={groupBy !== 'date'}
                  onClick={() => setGranularity(g.key)}
                >
                  {g.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Main content: Table + Chart */}
        <div className="flex-1 space-y-4 min-w-0">
          {/* Performance Table */}
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <SortHeader label={groupBy.toUpperCase()} field="name" />
                  <SortHeader label="CLICKS" field="total_clicks" />
                  <SortHeader label="CONV" field="conversions" />
                  <SortHeader label="CR" field="cr" />
                  <TableHead className="text-xs whitespace-nowrap">AVG FRAUD</TableHead>
                  <SortHeader label="EPC" field="epc" />
                  <SortHeader label="REWARD" field="total_payout" />
                  <SortHeader label="PICKED" field="picked" />
                  <TableHead className="text-xs whitespace-nowrap">PENDING</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-purple-600" />
                  </TableCell></TableRow>
                ) : paginatedData.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-6 w-6 mx-auto mb-2 text-gray-300" />
                    No data for this period
                  </TableCell></TableRow>
                ) : paginatedData.map((row, i) => (
                  <TableRow key={i} className="hover:bg-purple-50/30 cursor-pointer text-sm">
                    <TableCell className="font-medium max-w-[180px] truncate">{row.name}</TableCell>
                    <TableCell className="font-semibold">{row.total_clicks || 0}</TableCell>
                    <TableCell>{row.conversions || 0}</TableCell>
                    <TableCell className="text-green-600">{formatPercent(row.cr || 0)}</TableCell>
                    <TableCell className="text-orange-600">—</TableCell>
                    <TableCell className="text-blue-600">{formatCurrency(row.epc || 0)}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(row.total_payout || 0)}</TableCell>
                    <TableCell>{row.picked || 0}</TableCell>
                    <TableCell className="text-muted-foreground">{row.clicks || 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Showing {paginatedData.length} of {data.length} {groupBy === 'publisher' ? 'publishers' : groupBy === 'offer' ? 'offers' : 'rows'}. Click a row to drill into Click tracking. Tap a column header to sort.
          </p>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Page {page} of {totalPages} ({data.length} total)</p>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}

          {/* Chart */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Trend</p>
              <div className="flex gap-1">
                {(['dual', 'single', 'top5'] as ChartMode[]).map(m => (
                  <Button key={m} size="sm" variant={chartMode === m ? 'default' : 'outline'}
                    className={`h-7 text-[10px] px-2 ${chartMode === m ? 'bg-purple-600 text-white' : ''}`}
                    onClick={() => setChartMode(m)}>
                    {m === 'dual' ? '📊 Clicks×CR' : m === 'single' ? 'Single' : '→ Top 5'}
                  </Button>
                ))}
              </div>
            </div>
            <div className="h-[200px]">
              {data.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey={groupBy === 'date' ? 'date' : 'publisher_name'} tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                    {chartMode === 'dual' && <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />}
                    <Tooltip />
                    <Bar yAxisId="left" dataKey="clicks" fill="#7c3aed" opacity={0.7} radius={[4, 4, 0, 0]} />
                    {chartMode === 'dual' && <Line yAxisId="right" type="monotone" dataKey="cr" stroke="#10b981" strokeWidth={2} dot={false} />}
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No chart data</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


// ===================== CONVERSIONS TAB =====================

const ConversionsSubTab: React.FC<{ filters: FilterState; dateRange: { start: string; end: string }; logs: any[]; loading: boolean }> = ({ filters, dateRange, logs: allLogs, loading }) => {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ field: string; order: 'asc' | 'desc' }>({ field: 'time', order: 'desc' });

  // Filter to only completed + pending from pre-filtered logs
  const data = useMemo(() => {
    return allLogs.filter((l: any) => l.status === 'completed' || l.status === 'pending');
  }, [allLogs]);

  const perPage = filters.perPage || 50;
  const totalPages = Math.max(1, Math.ceil(data.length / perPage));

  // Paginate locally
  const paginatedData = useMemo(() => {
    const start = (page - 1) * perPage;
    return data.slice(start, start + perPage);
  }, [data, page, perPage]);

  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'approved' || s === 'completed' || s === 'credited') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">● Completed</span>;
    if (s === 'pending' || s === 'processing') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">● Pending</span>;
    if (s === 'reversed' || s === 'rejected') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">● Reversed</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">● {status}</span>;
  };

  const getPostbackBadge = (conv: AdminConversion) => {
    const fwd = conv.forward_status || '';
    if (fwd === 'forwarded' || fwd === 'success') return <span className="text-[10px] font-bold text-green-600">◉ Fired</span>;
    if (fwd === 'pending') return <span className="text-[10px] font-bold text-orange-500">◉ Pending</span>;
    if (fwd === 'failed') return <span className="text-[10px] font-bold text-red-500">◉ Failed</span>;
    if (conv.reversed_at) return <span className="text-[10px] font-bold text-red-500">◉ Reversed</span>;
    return <span className="text-[10px] text-gray-400">—</span>;
  };

  const SortHeader: React.FC<{ label: string; field: string }> = ({ label, field }) => (
    <TableHead className="cursor-pointer select-none text-[10px] whitespace-nowrap uppercase" onClick={() => setSort(s => ({ field, order: s.field === field && s.order === 'desc' ? 'asc' : 'desc' }))}>
      <div className="flex items-center gap-1">
        {label}
        {sort.field === field ? (sort.order === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <SortHeader label="TIME" field="time" />
              <SortHeader label="PUBLISHER" field="publisher_name" />
              <TableHead className="text-[10px] uppercase">USER</TableHead>
              <SortHeader label="OFFER" field="offer_name" />
              <TableHead className="text-[10px] uppercase">ADVERTISER</TableHead>
              <TableHead className="text-[10px] uppercase">VERTICAL</TableHead>
              <SortHeader label="STATUS" field="status" />
              <SortHeader label="PAYOUT" field="points" />
              <SortHeader label="REVENUE" field="revenue" />
              <TableHead className="text-[10px] uppercase">MARGIN</TableHead>
              <TableHead className="text-[10px] uppercase">EVENT</TableHead>
              <TableHead className="text-[10px] uppercase">POSTBACK</TableHead>
              <TableHead className="text-[10px] uppercase">CLEARS ON</TableHead>
              <TableHead className="text-[10px] uppercase">⋯</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={14} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-purple-600" /></TableCell></TableRow>
            ) : paginatedData.length === 0 ? (
              <TableRow><TableCell colSpan={14} className="text-center py-8 text-muted-foreground">No conversions found</TableCell></TableRow>
            ) : paginatedData.map((conv: any, i: number) => {
              return (
                <TableRow key={conv.id || i} className="hover:bg-purple-50/20 text-xs">
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatTime(conv.timestamp)}</TableCell>
                  <TableCell className="font-medium max-w-[120px] truncate">{conv.publisher_name || '—'}</TableCell>
                  <TableCell className="font-mono text-[10px] text-muted-foreground max-w-[80px] truncate">{conv.user_id || '—'}</TableCell>
                  <TableCell className="max-w-[150px] truncate font-medium">{conv.offer_name || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">—</TableCell>
                  <TableCell><Badge variant="outline" className="text-[9px] uppercase">—</Badge></TableCell>
                  <TableCell>{getStatusBadge(conv.status)}</TableCell>
                  <TableCell className="font-semibold">{conv.reward > 0 ? formatCurrency(conv.reward) : '—'}</TableCell>
                  <TableCell className="font-medium">—</TableCell>
                  <TableCell className="text-muted-foreground">—</TableCell>
                  <TableCell className="text-muted-foreground">—</TableCell>
                  <TableCell className="text-muted-foreground">—</TableCell>
                  <TableCell className="text-muted-foreground text-[10px]">—</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="text-xs">
                        <DropdownMenuItem onClick={() => toast.info('Mark completed')}>
                          <CheckCircle className="h-3.5 w-3.5 mr-2 text-green-600" /> Mark completed (credit user)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.info('Reverse conversion')}>
                          <XCircle className="h-3.5 w-3.5 mr-2 text-red-500" /> Reverse conversion
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => toast.info('Pause offer')}>Pause offer</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.info('Block user')}>Block user</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.info('Block IP')}>Block IP</DropdownMenuItem>
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
          <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
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

const ClickTrackingSubTab: React.FC<{ filters: FilterState; dateRange: { start: string; end: string }; logs: any[]; loading: boolean }> = ({ filters, dateRange, logs: allLogs, loading }) => {
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusTab, setStatusTab] = useState<ClickStatus>('all');

  // Counts per status from pre-filtered logs
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: allLogs.length, picked: 0, clicked: 0, pending: 0, completed: 0, reversed: 0 };
    allLogs.forEach((l: any) => {
      const s = (l.status || '').toLowerCase();
      if (c[s] !== undefined) c[s]++;
      else c.clicked++;
    });
    return c;
  }, [allLogs]);

  // Filter by status tab and paginate
  const filteredData = useMemo(() => {
    let filtered = allLogs;
    if (statusTab !== 'all') {
      filtered = allLogs.filter((l: any) => (l.status || '').toLowerCase() === statusTab);
    }
    const perPage = filters.perPage || 50;
    const tp = Math.max(1, Math.ceil(filtered.length / perPage));
    setTotalPages(tp);
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [allLogs, statusTab, page, filters.perPage]);

  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'completed': return 'bg-green-100 text-green-700 border-green-200';
      case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'reversed': return 'bg-red-100 text-red-700 border-red-200';
      case 'picked': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  return (
    <div className="space-y-4">
      {/* Status filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'picked', 'clicked', 'pending', 'completed', 'reversed'] as ClickStatus[]).map(s => (
          <Button
            key={s}
            size="sm"
            variant={statusTab === s ? 'default' : 'outline'}
            className={`h-7 text-[11px] gap-1 ${statusTab === s ? (
              s === 'all' ? 'bg-purple-600' :
              s === 'picked' ? 'bg-purple-500' :
              s === 'clicked' ? 'bg-blue-500' :
              s === 'pending' ? 'bg-amber-500' :
              s === 'completed' ? 'bg-green-600' :
              'bg-red-500'
            ) + ' text-white' : ''}`}
            onClick={() => setStatusTab(s)}
          >
            {s === 'all' ? `All ${counts.all}` : `● ${s.charAt(0).toUpperCase() + s.slice(1)} ${counts[s] || 0}`}
          </Button>
        ))}
      </div>

      {/* Click Tracking Table */}
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="text-[10px] uppercase" colSpan={4}>IDENTITY</TableHead>
              <TableHead className="text-[10px] uppercase" colSpan={3}>OFFER</TableHead>
              <TableHead className="text-[10px] uppercase" colSpan={2}>FUNNEL</TableHead>
            </TableRow>
            <TableRow className="bg-gray-50/50">
              <TableHead className="text-[10px]">PUBLISHER</TableHead>
              <TableHead className="text-[10px]">PUB ID</TableHead>
              <TableHead className="text-[10px]">ROLE</TableHead>
              <TableHead className="text-[10px]">USER</TableHead>
              <TableHead className="text-[10px]">ADVERTISER</TableHead>
              <TableHead className="text-[10px]">OFFER</TableHead>
              <TableHead className="text-[10px]">OFFER ID</TableHead>
              <TableHead className="text-[10px]">VERTICAL</TableHead>
              <TableHead className="text-[10px]">REWARD</TableHead>
              <TableHead className="text-[10px]">REVENUE</TableHead>
              <TableHead className="text-[10px]">MARGIN</TableHead>
              <TableHead className="text-[10px]">STATUS</TableHead>
              <TableHead className="text-[10px]">⋯</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={13} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-purple-600" /></TableCell></TableRow>
            ) : filteredData.length === 0 ? (
              <TableRow><TableCell colSpan={13} className="text-center py-8 text-muted-foreground">No clicks found</TableCell></TableRow>
            ) : filteredData.map((cl: any, i: number) => {
              const status = (cl.status || 'clicked').charAt(0).toUpperCase() + (cl.status || 'clicked').slice(1);
              return (
                <TableRow key={cl.id || i} className="hover:bg-purple-50/20 text-xs">
                  <TableCell className="font-medium max-w-[100px] truncate">{cl.publisher_name || '—'}</TableCell>
                  <TableCell className="font-mono text-[9px] text-muted-foreground max-w-[80px] truncate">{cl.publisher_id || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">partner</TableCell>
                  <TableCell className="font-mono text-[9px] max-w-[80px] truncate">{cl.user_id || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">—</TableCell>
                  <TableCell className="max-w-[140px] truncate font-medium">{cl.offer_name || '—'}</TableCell>
                  <TableCell className="font-mono text-[9px] text-muted-foreground">{cl.offer_id || '—'}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[8px] uppercase">—</Badge></TableCell>
                  <TableCell className="font-semibold">{cl.reward > 0 ? formatCurrency(cl.reward) : '—'}</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell className="text-muted-foreground">—</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${getStatusColor(status)}`}>
                      ● {status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="text-xs">
                        <DropdownMenuItem onClick={() => toast.info('Mark completed (credit user)')}>
                          <CheckCircle className="h-3.5 w-3.5 mr-2 text-green-600" /> Mark completed (credit user)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.info('Reverse conversion')}>
                          <XCircle className="h-3.5 w-3.5 mr-2 text-red-500" /> Reverse conversion
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>Pause offer</DropdownMenuItem>
                        <DropdownMenuItem>Block user</DropdownMenuItem>
                        <DropdownMenuItem>Block IP</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
        <span>● <span className="text-green-600">genuine 0–29</span></span>
        <span>● <span className="text-orange-500">suspicious 30–69</span></span>
        <span>● <span className="text-red-600">fraud 70+</span></span>
      </div>

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
  const [filterOptions, setFilterOptions] = useState<{ publishers: string[]; countries: string[]; verticals: string[]; networks: string[] }>({
    publishers: [], countries: [], verticals: [], networks: []
  });
  const [dateRange, setDateRange] = useState({ start: formatDate(30), end: formatDate(0) });

  // Fetch all offerwall logs once, then filter/aggregate locally
  const fetchAllLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchOfferwallLogs({ status: 'all', per_page: 1000, search: '' });
      const logs = res.logs || [];
      setAllLogs(logs);
      
      // Build filter options from actual data
      const pubs = new Set<string>();
      const networks = new Set<string>();
      logs.forEach((l: any) => {
        if (l.publisher_name) pubs.add(l.publisher_name);
        if (l.iframe_title) networks.add(l.iframe_title);
      });
      setFilterOptions({
        publishers: Array.from(pubs).sort(),
        countries: [], // not available in current tracking logs
        verticals: [], // not available in current tracking logs  
        networks: Array.from(networks).sort(),
      });
    } catch (e) {
      console.error('Failed to load offerwall logs:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAllLogs(); }, [fetchAllLogs]);

  // Apply filters (date, publisher, search) to all logs
  const filteredLogs = useMemo(() => {
    return allLogs.filter(log => {
      // Date filter
      if (filters.dateFrom && log.timestamp) {
        const logDate = log.timestamp.substring(0, 10);
        if (logDate < filters.dateFrom) return false;
      }
      if (filters.dateTo && log.timestamp) {
        const logDate = log.timestamp.substring(0, 10);
        if (logDate > filters.dateTo) return false;
      }
      // Publisher filter
      if (filters.publisher && log.publisher_name !== filters.publisher) return false;
      // Network/iframe filter  
      if (filters.network && log.iframe_title !== filters.network) return false;
      // Search filter
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

  const handleRefresh = () => { fetchAllLogs(); };

  const handleExport = () => {
    // Export filtered data as CSV
    const headers = ['Offer', 'Offer ID', 'Publisher', 'User', 'Status', 'Reward', 'Timestamp'];
    const rows = filteredLogs.map(l => [l.offer_name, l.offer_id, l.publisher_name, l.user_id, l.status, l.reward || 0, l.timestamp]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
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
          onClick={() => setActiveTab('clicks')}
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
      {activeTab === 'performance' && <PerformanceSubTab filters={filters} dateRange={dateRange} logs={filteredLogs} loading={loading} />}
      {activeTab === 'conversions' && <ConversionsSubTab filters={filters} dateRange={dateRange} logs={filteredLogs} loading={loading} />}
      {activeTab === 'clicks' && <ClickTrackingSubTab filters={filters} dateRange={dateRange} logs={filteredLogs} loading={loading} />}
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
