import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Download, RefreshCw, Search, Eye, FileText, TrendingUp,
  ArrowUpDown, ArrowUp, ArrowDown, BarChart3, Globe, Wifi, Shield,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { DatePresets } from '@/components/reports/DatePresets';
import { ColumnSelector, ColumnDefinition } from '@/components/reports/ColumnSelector';
import { AdminPageGuard } from '@/components/AdminPageGuard';
import {
  adminReportsApi, AdminPerformanceRow, AdminConversion,
  AdminPerformanceFilters, ChartDataPoint, FilterOptions,
} from '@/services/adminReportsApi';

// ===== PERFORMANCE TAB COLUMNS =====
const PERF_COLUMNS: ColumnDefinition[] = [
  { id: 'date', label: 'Date', defaultVisible: true, alwaysVisible: true },
  { id: 'publisher_name', label: 'Publisher', defaultVisible: true },
  { id: 'publisher_email', label: 'Publisher Email', defaultVisible: false },
  { id: 'publisher_role', label: 'Role', defaultVisible: false },
  { id: 'user_id', label: 'Publisher ID', defaultVisible: false },
  { id: 'offer_name', label: 'Offer Name', defaultVisible: true },
  { id: 'offer_id', label: 'Offer ID', defaultVisible: false },
  { id: 'network', label: 'Network', defaultVisible: false },
  { id: 'category', label: 'Category', defaultVisible: false },
  { id: 'promo_code', label: 'Promo Code', defaultVisible: false },
  { id: 'click_id', label: 'Click ID', defaultVisible: false },
  { id: 'referer', label: 'Source / Referrer', defaultVisible: false },
  { id: 'country', label: 'Country', defaultVisible: true },
  { id: 'city', label: 'City', defaultVisible: false },
  { id: 'region', label: 'Region', defaultVisible: false },
  { id: 'browser', label: 'Browser', defaultVisible: true },
  { id: 'device_type', label: 'Device', defaultVisible: true },
  { id: 'os', label: 'OS', defaultVisible: false },
  { id: 'ip_address', label: 'IP Address', defaultVisible: false },
  { id: 'clicks', label: 'Clicks', defaultVisible: true },
  { id: 'unique_clicks', label: 'Unique Clicks', defaultVisible: false },
  { id: 'suspicious_clicks', label: 'Suspicious', defaultVisible: false },
  { id: 'conversions', label: 'Conversions', defaultVisible: true },
  { id: 'approved_conversions', label: 'Approved', defaultVisible: false },
  { id: 'total_payout', label: 'Payout', defaultVisible: true },
  { id: 'total_revenue', label: 'Revenue', defaultVisible: false },
  { id: 'profit', label: 'Profit', defaultVisible: false },
  { id: 'cr', label: 'CR%', defaultVisible: true },
  { id: 'epc', label: 'EPC', defaultVisible: true },
  { id: 'currency', label: 'Currency', defaultVisible: false },
];

// ===== CONVERSION TAB COLUMNS =====
const CONV_COLUMNS: ColumnDefinition[] = [
  { id: 'time', label: 'Conversion Time', defaultVisible: true, alwaysVisible: true },
  { id: 'click_time', label: 'Click Time', defaultVisible: true },
  { id: 'publisher_name', label: 'Publisher', defaultVisible: true },
  { id: 'user_email', label: 'Publisher Email', defaultVisible: false },
  { id: 'user_role', label: 'Role', defaultVisible: false },
  { id: 'username', label: 'End User', defaultVisible: true },
  { id: 'offer_name', label: 'Offer', defaultVisible: true },
  { id: 'offer_id', label: 'Offer ID', defaultVisible: false },
  { id: 'click_id', label: 'Click ID', defaultVisible: false },
  { id: 'conversion_id', label: 'Conversion ID', defaultVisible: false },
  { id: 'click_source', label: 'Source', defaultVisible: false },
  { id: 'points', label: 'Payout', defaultVisible: true },
  { id: 'revenue', label: 'Revenue', defaultVisible: false },
  { id: 'profit', label: 'Profit', defaultVisible: false },
  { id: 'currency', label: 'Currency', defaultVisible: false },
  { id: 'status', label: 'Status', defaultVisible: true },
  { id: 'country', label: 'Country', defaultVisible: true },
  { id: 'city', label: 'City', defaultVisible: false },
  { id: 'region', label: 'Region', defaultVisible: false },
  { id: 'postal_code', label: 'Postal Code', defaultVisible: false },
  { id: 'device_type', label: 'Device', defaultVisible: true },
  { id: 'browser', label: 'Browser', defaultVisible: true },
  { id: 'os', label: 'OS', defaultVisible: false },
  { id: 'ip_address', label: 'IP Address', defaultVisible: false },
  { id: 'asn', label: 'ASN', defaultVisible: false },
  { id: 'isp', label: 'ISP', defaultVisible: false },
  { id: 'organization', label: 'Organization', defaultVisible: false },
  { id: 'referer', label: 'Referrer', defaultVisible: false },
  { id: 'placement_title', label: 'Placement', defaultVisible: true },
  { id: 'fraud_status', label: 'Fraud Status', defaultVisible: false },
  { id: 'sub_id1', label: 'Sub ID 1', defaultVisible: false },
  { id: 'sub_id2', label: 'Sub ID 2', defaultVisible: false },
  { id: 'sub_id3', label: 'Sub ID 3', defaultVisible: false },
  { id: 'forward_status', label: 'Forward Status', defaultVisible: false },
  { id: 'actions', label: 'Details', defaultVisible: true, alwaysVisible: true },
];

// ===== SORTABLE TABLE HEADER =====
function SortableHeader({ label, field, sortField, sortOrder, onSort }: {
  label: string; field: string;
  sortField: string; sortOrder: 'asc' | 'desc';
  onSort: (field: string) => void;
}) {
  const isActive = sortField === field;
  return (
    <TableHead className="cursor-pointer select-none hover:bg-muted/50 transition-colors" onClick={() => onSort(field)}>
      <div className="flex items-center gap-1">
        {label}
        {isActive ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
      </div>
    </TableHead>
  );
}

// ===== CHART SECTION =====
function ChartSection({ dateRange, tab }: { dateRange: { start: string; end: string }; tab: 'performance' | 'conversion' }) {
  const [chartData, setChartData] = useState<{ clicks: ChartDataPoint[]; conversions: ChartDataPoint[]; revenue: ChartDataPoint[] }>({ clicks: [], conversions: [], revenue: [] });
  const [loading, setLoading] = useState(false);
  const [showCharts, setShowCharts] = useState(false);

  const fetchChartData = useCallback(async () => {
    if (!showCharts) return;
    setLoading(true);
    try {
      const metrics = tab === 'performance' ? ['clicks', 'conversions'] : ['conversions', 'revenue'];
      const results = await Promise.all(metrics.map(m => adminReportsApi.getChartData({ start_date: dateRange.start, end_date: dateRange.end, metric: m })));
      const newData = { ...chartData };
      metrics.forEach((m, i) => { if (results[i].success) (newData as any)[m] = results[i].chart_data || []; });
      setChartData(newData);
    } catch { toast.error('Failed to load chart data'); }
    finally { setLoading(false); }
  }, [dateRange, tab, showCharts]);

  useEffect(() => { fetchChartData(); }, [fetchChartData]);

  if (!showCharts) return <Card className="p-4"><Button variant="outline" size="sm" onClick={() => setShowCharts(true)}><BarChart3 className="h-4 w-4 mr-2" />Show Charts</Button></Card>;

  const mergedData = tab === 'performance'
    ? chartData.clicks.map((c, i) => ({ date: c.date, clicks: c.value, conversions: chartData.conversions[i]?.value || 0 }))
    : chartData.conversions.map((c, i) => ({ date: c.date, conversions: c.value, revenue: chartData.revenue[i]?.value || 0 }));

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium">{tab === 'performance' ? 'Clicks & Conversions Over Time' : 'Conversions & Revenue Over Time'}</h3>
        <Button variant="ghost" size="sm" onClick={() => setShowCharts(false)}>Hide</Button>
      </div>
      {loading ? <div className="text-center py-8 text-muted-foreground">Loading charts...</div> : mergedData.length === 0 ? <div className="text-center py-8 text-muted-foreground">No chart data</div> : (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={mergedData}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Legend />
            {tab === 'performance' ? (<><Area type="monotone" dataKey="clicks" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} name="Clicks" /><Area type="monotone" dataKey="conversions" stroke="#10b981" fill="#10b981" fillOpacity={0.1} name="Conversions" /></>) : (<><Area type="monotone" dataKey="conversions" stroke="#10b981" fill="#10b981" fillOpacity={0.1} name="Conversions" /><Area type="monotone" dataKey="revenue" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} name="Revenue ($)" /></>)}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

// ===== DETAIL MODAL (shared for both tabs) =====
function DetailModal({ data, open, onClose, type }: { data: any; open: boolean; onClose: () => void; type: 'performance' | 'conversion' }) {
  if (!data) return null;
  const Section = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">{icon}{title}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">{children}</div>
    </div>
  );
  const Field = ({ label, value }: { label: string; value: any }) => (
    <div><span className="text-muted-foreground">{label}:</span> <span className="font-mono text-xs">{value || '-'}</span></div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{type === 'performance' ? 'Click Details' : 'Conversion Details'}</DialogTitle>
          <DialogDescription>Full network, geo-location, and tracking information</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {/* Basic Info */}
          <Section icon={<FileText className="h-4 w-4" />} title="Basic Information">
            {type === 'conversion' && <><Field label="Conversion Time" value={data.time} /><Field label="Click Time" value={data.click_time} /></>}
            {type === 'performance' && <Field label="Date" value={data.date} />}
            <Field label="Publisher" value={data.publisher_name} />
            <Field label="Publisher Email" value={data.publisher_email || data.user_email} />
            <Field label="Role" value={data.publisher_role || data.user_role} />
            <Field label="Publisher ID" value={data.publisher_id || data.user_id} />
            <Field label="Offer" value={data.offer_name} />
            <Field label="Offer ID" value={data.offer_id} />
            {type === 'conversion' && <><Field label="End User" value={data.username} /><Field label="Status" value={data.status} /></>}
            <Field label="Click ID" value={data.click_id} />
            {type === 'conversion' && <Field label="Conversion ID" value={data.conversion_id} />}
            {data.network && <Field label="Network" value={data.network} />}
            {data.promo_code && <Field label="Promo Code" value={data.promo_code} />}
            {data.placement_title && <Field label="Placement" value={data.placement_title} />}
            {data.click_source && <Field label="Click Source" value={data.click_source} />}
            {data.referer && <Field label="Referrer" value={data.referer} />}
          </Section>

          {/* Financial */}
          {type === 'conversion' && (
            <Section icon={<TrendingUp className="h-4 w-4" />} title="Financial">
              <Field label="Payout" value={`$${(data.points || data.payout || 0).toFixed(2)}`} />
              <Field label="Revenue" value={`$${(data.revenue || 0).toFixed(2)}`} />
              <Field label="Profit" value={`$${(data.profit || 0).toFixed(2)}`} />
              <Field label="Currency" value={data.currency || 'USD'} />
            </Section>
          )}
          {type === 'performance' && (
            <Section icon={<TrendingUp className="h-4 w-4" />} title="Metrics">
              <Field label="Clicks" value={data.clicks} />
              <Field label="Conversions" value={data.conversions} />
              <Field label="Payout" value={`$${(data.total_payout || 0).toFixed(2)}`} />
              <Field label="CR%" value={`${(data.cr || 0).toFixed(2)}%`} />
              <Field label="EPC" value={`$${(data.epc || 0).toFixed(4)}`} />
            </Section>
          )}

          {/* Network Information */}
          <Section icon={<Wifi className="h-4 w-4" />} title="Network Information">
            <Field label="IP Address" value={data.ip_address} />
            <Field label="ASN" value={data.asn} />
            <Field label="ISP" value={data.isp} />
            <Field label="Organization" value={data.organization} />
          </Section>

          {/* Geo-Location */}
          <Section icon={<Globe className="h-4 w-4" />} title="Geo-Location">
            <Field label="Country" value={data.country ? `${data.country}${data.country_code ? ` (${data.country_code})` : ''}` : '-'} />
            <Field label="Region" value={data.region} />
            <Field label="City" value={data.city} />
            <Field label="Postal Code" value={data.postal_code} />
            {(data.latitude || data.longitude) && <Field label="Coordinates" value={`${data.latitude}, ${data.longitude}`} />}
            {data.timezone && <Field label="Timezone" value={data.timezone} />}
          </Section>

          {/* Device */}
          <Section icon={<BarChart3 className="h-4 w-4" />} title="Device Information">
            <Field label="Device Type" value={data.device_type} />
            <Field label="Browser" value={data.browser} />
            <Field label="OS" value={data.os} />
          </Section>

          {/* Fraud Indicators (if available) */}
          {(data.fraud_status || data.vpn_detected !== undefined) && (
            <Section icon={<Shield className="h-4 w-4" />} title="Fraud Indicators">
              <Field label="Fraud Status" value={data.fraud_status} />
              <Field label="Fraud Score" value={data.fraud_score} />
              <Field label="VPN Detected" value={data.vpn_detected ? 'Yes' : 'No'} />
              <Field label="Proxy Detected" value={data.proxy_detected ? 'Yes' : 'No'} />
              {data.tor_detected !== undefined && <Field label="Tor Detected" value={data.tor_detected ? 'Yes' : 'No'} />}
            </Section>
          )}

          {/* Sub IDs */}
          {(data.sub_id1 || data.sub_id2 || data.sub_id3) && (
            <Section icon={<FileText className="h-4 w-4" />} title="Sub IDs">
              {data.sub_id1 && <Field label="Sub ID 1" value={data.sub_id1} />}
              {data.sub_id2 && <Field label="Sub ID 2" value={data.sub_id2} />}
              {data.sub_id3 && <Field label="Sub ID 3" value={data.sub_id3} />}
            </Section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===== PERFORMANCE TAB =====
function PerformanceTab() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AdminPerformanceRow[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0, pages: 0 });
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [selectedRow, setSelectedRow] = useState<AdminPerformanceRow | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const [dateRange, setDateRange] = useState(() => {
    const today = new Date(); const ago = new Date(); ago.setDate(today.getDate() - 30);
    return { start: ago.toISOString().split('T')[0], end: today.toISOString().split('T')[0] };
  });
  const [filters, setFilters] = useState<Partial<AdminPerformanceFilters>>({ group_by: 'date,offer_id' });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('admin_perf_cols_v3');
    if (saved) try { return JSON.parse(saved); } catch { /* */ }
    return PERF_COLUMNS.reduce((acc, col) => { acc[col.id] = col.defaultVisible; return acc; }, {} as Record<string, boolean>);
  });
  useEffect(() => { localStorage.setItem('admin_perf_cols_v3', JSON.stringify(visibleColumns)); }, [visibleColumns]);

  useEffect(() => { adminReportsApi.getFilterOptions().then(res => { if (res.success) setFilterOptions(res as any); }).catch(() => {}); }, []);

  const fetchData = async (page = 1) => {
    setLoading(true);
    try {
      const res = await adminReportsApi.getPerformanceReport({ start_date: dateRange.start, end_date: dateRange.end, page, per_page: 20, sort_field: sortField, sort_order: sortOrder, ...filters });
      if (res.success && res.report) { setData(res.report.data || []); setSummary(res.report.summary || null); setPagination(res.report.pagination || { page: 1, per_page: 20, total: 0, pages: 0 }); }
    } catch { toast.error('Failed to load performance report'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [dateRange, filters, sortField, sortOrder]);

  const handleSort = (field: string) => {
    if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('desc'); }
  };

  const filteredData = data.filter(row => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (row.offer_name?.toLowerCase().includes(s) || row.offer_id?.toLowerCase().includes(s) || row.date?.includes(s) || row.country?.toLowerCase().includes(s) || row.publisher_name?.toLowerCase().includes(s) || row.ip_address?.includes(s));
  });

  const handleExport = async () => {
    try { await adminReportsApi.exportReport('performance', { start_date: dateRange.start, end_date: dateRange.end, ...filters } as AdminPerformanceFilters); toast.success('Report exported'); }
    catch { toast.error('Export failed'); }
  };

  const formatCell = (col: ColumnDefinition, row: AdminPerformanceRow) => {
    const v = (row as any)[col.id];
    switch (col.id) {
      case 'total_payout': case 'total_revenue': return `$${(v || 0).toFixed(2)}`;
      case 'profit': return <span className={(v || 0) >= 0 ? 'text-green-600' : 'text-red-600'}>${(v || 0).toFixed(2)}</span>;
      case 'cr': return `${(v || 0).toFixed(2)}%`;
      case 'epc': return `$${(v || 0).toFixed(4)}`;
      case 'offer_name': return <span className="max-w-[200px] truncate block" title={row.offer_name}>{row.offer_name || '-'}</span>;
      case 'ip_address': case 'click_id': case 'user_id': return v ? <span className="font-mono text-xs">{v}</span> : '-';
      case 'publisher_name': return v || '-';
      case 'referer': return v ? <span className="max-w-[150px] truncate block text-xs" title={v}>{v}</span> : '-';
      default: return v ?? '-';
    }
  };

  return (
    <div className="space-y-4">
      <ChartSection dateRange={dateRange} tab="performance" />
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card className="p-4"><div className="text-xs text-muted-foreground">Total Clicks</div><div className="text-2xl font-bold">{summary.total_clicks?.toLocaleString()}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Conversions</div><div className="text-2xl font-bold">{summary.total_conversions?.toLocaleString()}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Payout</div><div className="text-2xl font-bold">${summary.total_payout?.toFixed(2)}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Avg CR%</div><div className="text-2xl font-bold">{summary.avg_cr?.toFixed(2)}%</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Avg EPC</div><div className="text-2xl font-bold">${summary.avg_epc?.toFixed(4)}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Rows</div><div className="text-2xl font-bold">{pagination.total}</div></Card>
        </div>
      )}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div><label className="text-xs font-medium">Start Date</label><Input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="w-40" /></div>
          <div><label className="text-xs font-medium">End Date</label><Input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="w-40" /></div>
          <DatePresets onPresetSelect={p => setDateRange({ start: p.start, end: p.end })} />
          <div><label className="text-xs font-medium">Group By</label>
            <Select value={filters.group_by || 'date,offer_id'} onValueChange={v => setFilters(prev => ({ ...prev, group_by: v }))}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date Only</SelectItem><SelectItem value="date,offer_id">Date + Offer</SelectItem>
                <SelectItem value="offer_id">Offer Only</SelectItem><SelectItem value="date,country">Date + Country</SelectItem>
                <SelectItem value="country">Country Only</SelectItem><SelectItem value="device_type">Device Type</SelectItem><SelectItem value="browser">Browser</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {filterOptions && filterOptions.publishers.length > 0 && (
            <div><label className="text-xs font-medium">Publisher</label>
              <Select value={filters.publisher_id || 'all'} onValueChange={v => setFilters(prev => ({ ...prev, publisher_id: v === 'all' ? undefined : v }))}>
                <SelectTrigger className="w-44"><SelectValue placeholder="All Publishers" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Publishers</SelectItem>{filterOptions.publishers.map(p => <SelectItem key={p.id} value={p.id}>{p.name || p.username}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {filterOptions && filterOptions.offers.length > 0 && (
            <div><label className="text-xs font-medium">Offer</label>
              <Select value={filters.offer_id || 'all'} onValueChange={v => setFilters(prev => ({ ...prev, offer_id: v === 'all' ? undefined : v }))}>
                <SelectTrigger className="w-48"><SelectValue placeholder="All Offers" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Offers</SelectItem>{filterOptions.offers.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {filterOptions && filterOptions.countries.length > 0 && (
            <div><label className="text-xs font-medium">Country</label>
              <Select value={(filters.country as string) || 'all'} onValueChange={v => setFilters(prev => ({ ...prev, country: v === 'all' ? undefined : v }))}>
                <SelectTrigger className="w-36"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Countries</SelectItem>{filterOptions.countries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div><label className="text-xs font-medium">Device</label>
            <Select value={filters.device_type || 'all'} onValueChange={v => setFilters(prev => ({ ...prev, device_type: v === 'all' ? undefined : v }))}>
              <SelectTrigger className="w-32"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="desktop">Desktop</SelectItem><SelectItem value="mobile">Mobile</SelectItem><SelectItem value="tablet">Tablet</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8 w-52" /></div>
          <ColumnSelector columns={PERF_COLUMNS} visibleColumns={visibleColumns} onColumnChange={(id, v) => setVisibleColumns(prev => ({ ...prev, [id]: v }))} onSelectAll={() => setVisibleColumns(PERF_COLUMNS.reduce((a, c) => ({ ...a, [c.id]: true }), {}))} onClearAll={() => setVisibleColumns(PERF_COLUMNS.reduce((a, c) => ({ ...a, [c.id]: c.alwaysVisible || false }), {}))} />
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1" />Export</Button>
          <Button size="sm" onClick={() => fetchData()}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
        </div>
      </Card>
      <Card>
        <div className="overflow-x-auto">
          {loading ? <div className="text-center py-12 text-muted-foreground">Loading...</div> : filteredData.length === 0 ? <div className="text-center py-12 text-muted-foreground">No data found.</div> : (
            <Table>
              <TableHeader><TableRow>{PERF_COLUMNS.filter(c => visibleColumns[c.id]).map(col => <SortableHeader key={col.id} label={col.label} field={col.id} sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />)}</TableRow></TableHeader>
              <TableBody>{filteredData.map((row, i) => (
                <TableRow key={i} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedRow(row); setShowDetail(true); }}>
                  {PERF_COLUMNS.filter(c => visibleColumns[c.id]).map(col => <TableCell key={col.id}>{formatCell(col, row)}</TableCell>)}
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </div>
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <span className="text-sm text-muted-foreground">Page {pagination.page} of {pagination.pages} ({pagination.total} rows)</span>
            <div className="flex gap-2"><Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => fetchData(pagination.page - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={pagination.page >= pagination.pages} onClick={() => fetchData(pagination.page + 1)}>Next</Button></div>
          </div>
        )}
      </Card>
      <DetailModal data={selectedRow} open={showDetail} onClose={() => setShowDetail(false)} type="performance" />
    </div>
  );
}

// ===== CONVERSION TAB =====
function ConversionTab() {
  const [loading, setLoading] = useState(false);
  const [conversions, setConversions] = useState<AdminConversion[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0, pages: 0 });
  const [selectedConversion, setSelectedConversion] = useState<AdminConversion | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);

  const [dateRange, setDateRange] = useState(() => {
    const today = new Date(); const ago = new Date(); ago.setDate(today.getDate() - 30);
    return { start: ago.toISOString().split('T')[0], end: today.toISOString().split('T')[0] };
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<Record<string, string | undefined>>({});
  const [sortField, setSortField] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('admin_conv_cols_v3');
    if (saved) try { return JSON.parse(saved); } catch { /* */ }
    return CONV_COLUMNS.reduce((acc, col) => { acc[col.id] = col.defaultVisible; return acc; }, {} as Record<string, boolean>);
  });
  useEffect(() => { localStorage.setItem('admin_conv_cols_v3', JSON.stringify(visibleColumns)); }, [visibleColumns]);

  useEffect(() => { adminReportsApi.getFilterOptions().then(res => { if (res.success) setFilterOptions(res as any); }).catch(() => {}); }, []);

  const fetchData = async (page = 1) => {
    setLoading(true);
    try {
      const params: any = { start_date: dateRange.start, end_date: dateRange.end, page, per_page: 20, sort_field: sortField, sort_order: sortOrder };
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await adminReportsApi.getConversionReport(params);
      if (res.success && res.report) { setConversions(res.report.conversions || []); setSummary(res.report.summary || null); setPagination(res.report.pagination || { page: 1, per_page: 20, total: 0, pages: 0 }); }
    } catch { toast.error('Failed to load conversion report'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [dateRange, filters, sortField, sortOrder]);

  const handleSort = (field: string) => {
    if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('desc'); }
  };

  const filteredConversions = conversions.filter(conv => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (conv.offer_name?.toLowerCase().includes(s) || conv.publisher_name?.toLowerCase().includes(s) || conv.username?.toLowerCase().includes(s) || conv.click_id?.toLowerCase().includes(s) || conv.offer_id?.toLowerCase().includes(s) || conv.ip_address?.includes(s));
  });

  const handleExport = async () => {
    try { await adminReportsApi.exportReport('conversions', { start_date: dateRange.start, end_date: dateRange.end } as AdminPerformanceFilters); toast.success('Report exported'); }
    catch { toast.error('Export failed'); }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'approved') return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
    if (status === 'pending') return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
    if (status === 'rejected') return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  const getFraudBadge = (status: string) => {
    if (!status) return '-';
    if (status === 'clean') return <Badge className="bg-green-100 text-green-800">Clean</Badge>;
    if (status === 'suspicious') return <Badge className="bg-yellow-100 text-yellow-800">Suspicious</Badge>;
    return <Badge className="bg-red-100 text-red-800">{status}</Badge>;
  };

  const renderCell = (col: ColumnDefinition, conv: AdminConversion) => {
    switch (col.id) {
      case 'time': return conv.time || '-';
      case 'click_time': return conv.click_time || '-';
      case 'publisher_name': return conv.publisher_name || '-';
      case 'user_email': return conv.user_email || '-';
      case 'user_role': return conv.user_role || '-';
      case 'username': return conv.username || '-';
      case 'offer_name': return <span className="max-w-[180px] truncate block" title={conv.offer_name}>{conv.offer_name || '-'}</span>;
      case 'offer_id': return conv.offer_id || '-';
      case 'click_id': return conv.click_id ? <span className="font-mono text-xs">{conv.click_id}</span> : '-';
      case 'conversion_id': return conv.conversion_id ? <span className="font-mono text-xs">{conv.conversion_id.slice(0, 12)}...</span> : '-';
      case 'click_source': return conv.click_source || '-';
      case 'points': return `$${(conv.points || conv.payout || 0).toFixed(2)}`;
      case 'revenue': return `$${(conv.revenue || 0).toFixed(2)}`;
      case 'profit': { const p = conv.profit || 0; return <span className={p >= 0 ? 'text-green-600' : 'text-red-600'}>${p.toFixed(2)}</span>; }
      case 'currency': return conv.currency || 'USD';
      case 'status': return getStatusBadge(conv.status);
      case 'country': return conv.country || '-';
      case 'city': return conv.city || '-';
      case 'region': return conv.region || '-';
      case 'postal_code': return conv.postal_code || '-';
      case 'device_type': return conv.device_type || '-';
      case 'browser': return conv.browser || '-';
      case 'os': return conv.os || '-';
      case 'ip_address': return conv.ip_address ? <span className="font-mono text-xs">{conv.ip_address}</span> : '-';
      case 'asn': return conv.asn || '-';
      case 'isp': return conv.isp || '-';
      case 'organization': return conv.organization || '-';
      case 'referer': return conv.referer ? <span className="max-w-[150px] truncate block text-xs" title={conv.referer}>{conv.referer}</span> : '-';
      case 'placement_title': return conv.placement_title || '-';
      case 'fraud_status': return getFraudBadge(conv.fraud_status || '');
      case 'sub_id1': return conv.sub_id1 || '-';
      case 'sub_id2': return conv.sub_id2 || '-';
      case 'sub_id3': return conv.sub_id3 || '-';
      case 'forward_status': return conv.forward_status === 'success' ? <Badge className="bg-green-100 text-green-800">Success</Badge> : <Badge variant="secondary">{conv.forward_status || '-'}</Badge>;
      case 'actions': return <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedConversion(conv); setShowDetail(true); }}><Eye className="h-4 w-4" /></Button>;
      default: return (conv as any)[col.id] ?? '-';
    }
  };

  return (
    <div className="space-y-4">
      <ChartSection dateRange={dateRange} tab="conversion" />
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4"><div className="text-xs text-muted-foreground">Total Conversions</div><div className="text-2xl font-bold">{summary.total_conversions?.toLocaleString()}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Approved Payout</div><div className="text-2xl font-bold">${(summary.approved_payout || 0).toFixed(2)}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Pending Payout</div><div className="text-2xl font-bold">${(summary.pending_payout || 0).toFixed(2)}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Approved</div><div className="text-2xl font-bold">{summary.approved_conversions || 0}</div></Card>
        </div>
      )}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div><label className="text-xs font-medium">Start Date</label><Input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="w-40" /></div>
          <div><label className="text-xs font-medium">End Date</label><Input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="w-40" /></div>
          <DatePresets onPresetSelect={p => setDateRange({ start: p.start, end: p.end })} />
          {filterOptions && filterOptions.publishers.length > 0 && (
            <div><label className="text-xs font-medium">Publisher</label>
              <Select value={filters.publisher_id || 'all'} onValueChange={v => setFilters(prev => ({ ...prev, publisher_id: v === 'all' ? undefined : v }))}>
                <SelectTrigger className="w-44"><SelectValue placeholder="All Publishers" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Publishers</SelectItem>{filterOptions.publishers.map(p => <SelectItem key={p.id} value={p.id}>{p.name || p.username}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {filterOptions && filterOptions.offers.length > 0 && (
            <div><label className="text-xs font-medium">Offer</label>
              <Select value={filters.offer_id || 'all'} onValueChange={v => setFilters(prev => ({ ...prev, offer_id: v === 'all' ? undefined : v }))}>
                <SelectTrigger className="w-48"><SelectValue placeholder="All Offers" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Offers</SelectItem>{filterOptions.offers.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {filterOptions && filterOptions.countries.length > 0 && (
            <div><label className="text-xs font-medium">Country</label>
              <Select value={filters.country || 'all'} onValueChange={v => setFilters(prev => ({ ...prev, country: v === 'all' ? undefined : v }))}>
                <SelectTrigger className="w-36"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Countries</SelectItem>{filterOptions.countries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div><label className="text-xs font-medium">Device</label>
            <Select value={filters.device_type || 'all'} onValueChange={v => setFilters(prev => ({ ...prev, device_type: v === 'all' ? undefined : v }))}>
              <SelectTrigger className="w-32"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="desktop">Desktop</SelectItem><SelectItem value="mobile">Mobile</SelectItem><SelectItem value="tablet">Tablet</SelectItem></SelectContent>
            </Select>
          </div>
          <div><label className="text-xs font-medium">Status</label>
            <Select value={filters.status || 'all'} onValueChange={v => setFilters(prev => ({ ...prev, status: v === 'all' ? undefined : v }))}>
              <SelectTrigger className="w-32"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8 w-56" /></div>
          <ColumnSelector columns={CONV_COLUMNS} visibleColumns={visibleColumns} onColumnChange={(id, v) => setVisibleColumns(prev => ({ ...prev, [id]: v }))} onSelectAll={() => setVisibleColumns(CONV_COLUMNS.reduce((a, c) => ({ ...a, [c.id]: true }), {}))} onClearAll={() => setVisibleColumns(CONV_COLUMNS.reduce((a, c) => ({ ...a, [c.id]: c.alwaysVisible || false }), {}))} />
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1" />Export</Button>
          <Button size="sm" onClick={() => fetchData()}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
        </div>
      </Card>
      <Card>
        <div className="overflow-x-auto">
          {loading ? <div className="text-center py-12 text-muted-foreground">Loading...</div> : filteredConversions.length === 0 ? <div className="text-center py-12 text-muted-foreground">No conversions found.</div> : (
            <Table>
              <TableHeader><TableRow>{CONV_COLUMNS.filter(c => visibleColumns[c.id]).map(col => col.id === 'actions' ? <TableHead key={col.id}>{col.label}</TableHead> : <SortableHeader key={col.id} label={col.label} field={col.id} sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />)}</TableRow></TableHeader>
              <TableBody>{filteredConversions.map((conv, i) => (
                <TableRow key={conv._id || i} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedConversion(conv); setShowDetail(true); }}>
                  {CONV_COLUMNS.filter(c => visibleColumns[c.id]).map(col => <TableCell key={col.id}>{renderCell(col, conv)}</TableCell>)}
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </div>
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <span className="text-sm text-muted-foreground">Page {pagination.page} of {pagination.pages} ({pagination.total} total)</span>
            <div className="flex gap-2"><Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => fetchData(pagination.page - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={pagination.page >= pagination.pages} onClick={() => fetchData(pagination.page + 1)}>Next</Button></div>
          </div>
        )}
      </Card>
      <DetailModal data={selectedConversion} open={showDetail} onClose={() => setShowDetail(false)} type="conversion" />
    </div>
  );
}

// ===== MAIN PAGE =====
function AdminReportsTrackingContent() {
  const [activeTab, setActiveTab] = useState<'performance' | 'conversion'>('performance');
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold tracking-tight">Tracking Reports</h1><p className="text-muted-foreground">Performance and conversion reports across all publishers</p></div>
      </div>
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        <button onClick={() => setActiveTab('performance')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'performance' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}><TrendingUp className="h-4 w-4" />Performance Report</button>
        <button onClick={() => setActiveTab('conversion')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'conversion' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}><FileText className="h-4 w-4" />Conversion Report</button>
      </div>
      {activeTab === 'performance' ? <PerformanceTab /> : <ConversionTab />}
    </div>
  );
}

const AdminReportsTracking = () => (<AdminPageGuard requiredTab="tracking"><AdminReportsTrackingContent /></AdminPageGuard>);
export default AdminReportsTracking;
