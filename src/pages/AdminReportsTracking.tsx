import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Download, RefreshCw, Search, Eye, FileText, TrendingUp, ArrowUpDown, ArrowUp, ArrowDown, BarChart3, Globe, Wifi, Shield, ChevronDown, ChevronRight, MousePointerClick, ChevronsUpDown, Check } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DatePresets } from '@/components/reports/DatePresets';
import { ColumnSelector, ColumnDefinition } from '@/components/reports/ColumnSelector';
import { AdminPageGuard } from '@/components/AdminPageGuard';
import { adminReportsApi, AdminPerformanceRow, AdminConversion, AdminClick, AdminPerformanceFilters, ChartDataPoint, FilterOptions } from '@/services/adminReportsApi';
import { EventFunnel } from '@/components/reports/EventFunnel';
import { AffiliateComparison } from '@/components/reports/AffiliateComparison';
import { AffiliateIntelligence } from '@/components/reports/AffiliateIntelligence';
import { GeoAnalytics } from '@/components/reports/GeoAnalytics';
import { AdminActionsLog } from '@/components/reports/AdminActionsLog';
import { actionsApi } from '@/services/trafficIntelligenceApi';

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
  { id: 'postback_url', label: 'Postback Link', defaultVisible: false },
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

const CONV_COLUMNS: ColumnDefinition[] = [
  { id: 'time', label: 'Time', defaultVisible: true, alwaysVisible: true },
  { id: 'publisher_name', label: 'Publisher', defaultVisible: true },
  { id: 'user_email', label: 'Publisher Email', defaultVisible: false },
  { id: 'user_role', label: 'Role', defaultVisible: false },
  { id: 'username', label: 'Username', defaultVisible: false },
  { id: 'offer_name', label: 'Offer', defaultVisible: true },
  { id: 'offer_id', label: 'Offer ID', defaultVisible: false },
  { id: 'click_id', label: 'Click ID', defaultVisible: true },
  { id: 'conversion_id', label: 'Conversion ID', defaultVisible: false },
  { id: 'click_source', label: 'Click Source', defaultVisible: false },
  { id: 'click_time', label: 'Click Time', defaultVisible: false },
  { id: 'status', label: 'Status', defaultVisible: true },
  { id: 'points', label: 'Payout', defaultVisible: true },
  { id: 'revenue', label: 'Revenue', defaultVisible: false },
  { id: 'profit', label: 'Profit', defaultVisible: false },
  { id: 'currency', label: 'Currency', defaultVisible: false },
  { id: 'country', label: 'Country', defaultVisible: true },
  { id: 'city', label: 'City', defaultVisible: false },
  { id: 'region', label: 'Region', defaultVisible: false },
  { id: 'postal_code', label: 'Postal Code', defaultVisible: false },
  { id: 'device_type', label: 'Device', defaultVisible: false },
  { id: 'browser', label: 'Browser', defaultVisible: false },
  { id: 'os', label: 'OS', defaultVisible: false },
  { id: 'ip_address', label: 'IP Address', defaultVisible: false },
  { id: 'asn', label: 'ASN', defaultVisible: false },
  { id: 'isp', label: 'ISP', defaultVisible: false },
  { id: 'organization', label: 'Organization', defaultVisible: false },
  { id: 'referer', label: 'Referrer', defaultVisible: false },
  { id: 'placement_title', label: 'Placement', defaultVisible: false },
  { id: 'fraud_status', label: 'Fraud Status', defaultVisible: false },
  { id: 'sub_id1', label: 'Sub ID 1', defaultVisible: false },
  { id: 'sub_id2', label: 'Sub ID 2', defaultVisible: false },
  { id: 'sub_id3', label: 'Sub ID 3', defaultVisible: false },
  { id: 'forward_status', label: 'Forward Status', defaultVisible: false },
  { id: 'actions', label: 'Actions', defaultVisible: true, alwaysVisible: true },
];

const CLICK_COLUMNS: ColumnDefinition[] = [
  { id: 'time', label: 'Time', defaultVisible: true, alwaysVisible: true },
  { id: 'click_id', label: 'Click ID', defaultVisible: true },
  { id: 'publisher_name', label: 'Publisher', defaultVisible: true },
  { id: 'publisher_email', label: 'Publisher Email', defaultVisible: false },
  { id: 'publisher_role', label: 'Role', defaultVisible: false },
  { id: 'user_id', label: 'Publisher ID', defaultVisible: false },
  { id: 'offer_name', label: 'Offer Name', defaultVisible: true },
  { id: 'offer_id', label: 'Offer ID', defaultVisible: false },
  { id: 'network', label: 'Network', defaultVisible: false },
  { id: 'category', label: 'Category', defaultVisible: false },
  { id: 'payout', label: 'Payout', defaultVisible: true },
  { id: 'currency', label: 'Currency', defaultVisible: false },
  { id: 'country', label: 'Country', defaultVisible: true },
  { id: 'city', label: 'City', defaultVisible: false },
  { id: 'region', label: 'Region', defaultVisible: false },
  { id: 'device_type', label: 'Device', defaultVisible: true },
  { id: 'browser', label: 'Browser', defaultVisible: true },
  { id: 'os', label: 'OS', defaultVisible: false },
  { id: 'ip_address', label: 'End User IP', defaultVisible: true },
  { id: 'referer', label: 'Referrer', defaultVisible: false },
  { id: 'postback_url', label: 'Postback Link', defaultVisible: false },
  { id: 'target_url', label: 'Target URL', defaultVisible: false },
  { id: 'converted', label: 'Converted', defaultVisible: false },
  { id: 'user_agent', label: 'User Agent', defaultVisible: false },
  { id: 'sub_id1', label: 'Placement / Source', defaultVisible: true },
  { id: 'sub_id2', label: 'End User / Sub2', defaultVisible: false },
  { id: 'sub_id3', label: 'Sub ID 3', defaultVisible: false },
  { id: 'sub_id4', label: 'Sub ID 4', defaultVisible: false },
  { id: 'sub_id5', label: 'Sub ID 5', defaultVisible: false },
  { id: 'when_clicked', label: 'When Clicked', defaultVisible: false },
  { id: 'time_spent', label: 'Time Spent', defaultVisible: false },
  { id: 'when_closed', label: 'When Closed', defaultVisible: false },
  // Phase 1.3: Postback mapping columns
  { id: 'postback_status', label: 'Postback Status', defaultVisible: true },
  { id: 'event_type', label: 'Event Type', defaultVisible: false },
  { id: 'event_revenue', label: 'Event Revenue', defaultVisible: false },
  { id: 'event_status', label: 'Event Status', defaultVisible: false },
  { id: 'fraud_score', label: 'Fraud Score', defaultVisible: false },
  { id: 'fraud_class', label: 'Fraud Class', defaultVisible: false },
  { id: 'actions', label: 'Actions', defaultVisible: true, alwaysVisible: true },
];

function SortableHeader({ label, field, sortField, sortOrder, onSort }: { label: string; field: string; sortField: string; sortOrder: 'asc' | 'desc'; onSort: (f: string) => void }) {
  return (
    <TableHead className="cursor-pointer select-none" onClick={() => onSort(field)}>
      <div className="flex items-center gap-1">{label}{sortField === field ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}</div>
    </TableHead>
  );
}

function SearchablePublisherSelect({ publishers, value, onChange }: { publishers: { id: string; name: string; username: string; email?: string; role?: string }[]; value: string | undefined; onChange: (v: string | undefined) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => {
    if (!search) return publishers;
    const s = search.toLowerCase();
    return publishers.filter(p => p.name?.toLowerCase().includes(s) || p.username?.toLowerCase().includes(s) || p.email?.toLowerCase().includes(s));
  }, [publishers, search]);
  const selectedName = value ? (publishers.find(p => p.id === value)?.name || publishers.find(p => p.id === value)?.username || 'Selected') : 'All Publishers';
  useEffect(() => { if (open && inputRef.current) inputRef.current.focus(); }, [open]);
  return (
    <div>
      <label className="text-xs font-medium">Publisher</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-52 justify-between font-normal">
            <span className="truncate">{selectedName}</span>
            <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-0" align="start">
          <div className="p-2 border-b">
            <Input ref={inputRef} placeholder="Search publishers..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="max-h-60 overflow-y-auto">
            <div className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted ${!value ? 'bg-muted' : ''}`} onClick={() => { onChange(undefined); setOpen(false); setSearch(''); }}>
              {!value && <Check className="h-3 w-3" />}
              <span>All Publishers</span>
            </div>
            {filtered.map(p => (
              <div key={p.id} className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted ${value === p.id ? 'bg-muted' : ''}`} onClick={() => { onChange(p.id); setOpen(false); setSearch(''); }}>
                {value === p.id && <Check className="h-3 w-3" />}
                <div className="flex flex-col min-w-0">
                  <span className="truncate">{p.name || p.username}</span>
                  {p.email && <span className="text-xs text-muted-foreground truncate">{p.email}</span>}
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div className="px-3 py-4 text-sm text-muted-foreground text-center">No publishers found</div>}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ChartSection({ dateRange, tab }: { dateRange: { start: string; end: string }; tab: 'performance' | 'conversion' }) {
  const [open, setOpen] = useState(false);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [metric, setMetric] = useState(tab === 'performance' ? 'clicks' : 'conversions');
  const fetchChart = useCallback(async () => {
    if (!open) return;
    try {
      const res = await adminReportsApi.getChartData({ start_date: dateRange.start, end_date: dateRange.end, metric, granularity: 'day' });
      if (res.success) setChartData(res.chart_data || []);
    } catch { /* silent */ }
  }, [dateRange, metric, open]);
  useEffect(() => { fetchChart(); }, [fetchChart]);
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setOpen(prev => !prev)}>
        <div className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-muted-foreground" /><span className="font-medium">Trend Chart</span></div>
        <div className="flex items-center gap-2">
          {open && <Select value={metric} onValueChange={setMetric}><SelectTrigger className="w-40" onClick={e => e.stopPropagation()}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="clicks">Clicks</SelectItem><SelectItem value="conversions">Conversions</SelectItem><SelectItem value="revenue">Revenue</SelectItem><SelectItem value="payout">Payout</SelectItem></SelectContent></Select>}
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </div>
      {open && (
        <div className="mt-3">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Legend /><Area type="monotone" dataKey="value" name={metric} stroke="#6366f1" fill="#6366f1" fillOpacity={0.1} /></AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

function DetailModal({ data, open, onClose, type }: { data: any; open: boolean; onClose: () => void; type: 'performance' | 'conversion' | 'click' }) {
  if (!data) return null;
  const sections = type === 'conversion'
    ? [
        { title: 'Conversion Info', icon: <FileText className="h-4 w-4" />, fields: [['Time', data.time], ['Status', data.status], ['Payout', `${(data.payout || 0).toFixed(2)}`], ['Revenue', `${(data.revenue || 0).toFixed(2)}`], ['Profit', `${(data.profit || 0).toFixed(2)}`], ['Click ID', data.click_id], ['Conversion ID', data.conversion_id], ['Click Source', data.click_source], ['Click Time', data.click_time]] },
        { title: 'Offer & Publisher', icon: <TrendingUp className="h-4 w-4" />, fields: [['Offer', data.offer_name], ['Offer ID', data.offer_id], ['Publisher', data.publisher_name], ['Email', data.user_email], ['Role', data.user_role], ['Placement', data.placement_title], ['Network', data.network], ['Category', data.category]] },
        { title: 'Geo-Location', icon: <Globe className="h-4 w-4" />, fields: [['Country', data.country], ['City', data.city], ['Region', data.region], ['Postal Code', data.postal_code], ['Latitude', data.latitude], ['Longitude', data.longitude], ['Timezone', data.timezone]] },
        { title: 'Network Info', icon: <Wifi className="h-4 w-4" />, fields: [['IP Address', data.ip_address], ['Device', data.device_type], ['Browser', data.browser], ['OS', data.os], ['ASN', data.asn], ['ISP', data.isp], ['Organization', data.organization]] },
        { title: 'Fraud Indicators', icon: <Shield className="h-4 w-4" />, fields: [['Fraud Status', data.fraud_status], ['VPN', data.vpn_detected ? 'Yes' : 'No'], ['Proxy', data.proxy_detected ? 'Yes' : 'No'], ['Tor', data.tor_detected ? 'Yes' : 'No']] },
        { title: 'Sub IDs & Tracking', fields: [['Sub ID 1', data.sub_id1], ['Sub ID 2', data.sub_id2], ['Sub ID 3', data.sub_id3], ['Sub ID 4', data.sub_id4], ['Sub ID 5', data.sub_id5], ['Referrer', data.referer], ['Forward Status', data.forward_status]] },
      ]
    : type === 'click'
    ? [
        { title: 'Click Info', icon: <MousePointerClick className="h-4 w-4" />, fields: [['Time', data.time], ['Click ID', data.click_id], ['Offer', data.offer_name], ['Offer ID', data.offer_id], ['Publisher', data.publisher_name], ['Publisher ID', data.user_id]] },
        { title: 'Geo & Device', icon: <Globe className="h-4 w-4" />, fields: [['Country', data.country], ['City', data.city], ['Region', data.region], ['Device', data.device_type], ['Browser', data.browser], ['OS', data.os], ['IP', data.ip_address], ['Referrer', data.referer]] },
        { title: 'Sub IDs', fields: [['Sub ID 1', data.sub_id1], ['Sub ID 2', data.sub_id2], ['Sub ID 3', data.sub_id3]] },
      ]
    : [
        { title: 'Performance Info', icon: <TrendingUp className="h-4 w-4" />, fields: [['Date', data.date], ['Offer', data.offer_name], ['Offer ID', data.offer_id], ['Publisher', data.publisher_name], ['Email', data.publisher_email], ['Role', data.publisher_role], ['Network', data.network], ['Category', data.category], ['Postback Link', data.postback_url]] },
        { title: 'Metrics', fields: [['Clicks', data.clicks], ['Unique Clicks', data.unique_clicks], ['Suspicious', data.suspicious_clicks], ['Conversions', data.conversions], ['Approved', data.approved_conversions], ['Payout', `${(data.total_payout || 0).toFixed(2)}`], ['Revenue', `${(data.total_revenue || 0).toFixed(2)}`], ['Profit', `${(data.profit || 0).toFixed(2)}`], ['CR%', `${(data.cr || 0).toFixed(2)}%`], ['EPC', `${(data.epc || 0).toFixed(2)}`]] },
        { title: 'Geo & Device', icon: <Globe className="h-4 w-4" />, fields: [['Country', data.country], ['City', data.city], ['Region', data.region], ['Browser', data.browser], ['Device', data.device_type], ['OS', data.os], ['IP', data.ip_address], ['Referrer', data.referer]] },
      ];
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{type === 'conversion' ? 'Conversion Details' : type === 'click' ? 'Click Details' : 'Performance Details'}</DialogTitle><DialogDescription>Full details for this record</DialogDescription></DialogHeader>
        <div className="space-y-4">
          {sections.map((sec, i) => (
            <div key={i} className="border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2 font-medium text-sm">{sec.icon}{sec.title}</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {sec.fields.map(([label, value]: any, j: number) => (
                  <div key={j} className="flex justify-between py-0.5"><span className="text-muted-foreground">{label}</span><span className="font-mono text-xs text-right max-w-[200px] truncate">{value ?? '-'}</span></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PerformanceTab() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AdminPerformanceRow[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0, pages: 0 });
  const [perPage, setPerPage] = useState(20);
  const [selectedRow, setSelectedRow] = useState<AdminPerformanceRow | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date(); const ago = new Date(); ago.setDate(today.getDate() - 30);
    return { start: ago.toISOString().split('T')[0], end: today.toISOString().split('T')[0] };
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<Record<string, string | undefined>>({});
  const [sortField, setSortField] = useState('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('admin_perf_cols_v3');
    if (saved) try { return JSON.parse(saved); } catch { /* */ }
    return PERF_COLUMNS.reduce((acc, col) => { acc[col.id] = col.defaultVisible; return acc; }, {} as Record<string, boolean>);
  });
  useEffect(() => { localStorage.setItem('admin_perf_cols_v3', JSON.stringify(visibleColumns)); }, [visibleColumns]);
  useEffect(() => { adminReportsApi.getFilterOptions().then(res => { if (res.success) setFilterOptions(res as any); }).catch(() => {}); }, []);
  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params: any = { start_date: dateRange.start, end_date: dateRange.end, page, per_page: perPage, sort_field: sortField, sort_order: sortOrder };
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await adminReportsApi.getPerformanceReport(params);
      if (res.success && res.report) { setRows(res.report.data || []); setSummary(res.report.summary || null); setPagination(res.report.pagination || { page: 1, per_page: perPage, total: 0, pages: 0 }); }
    } catch { toast.error('Failed to load performance report'); }
    finally { setLoading(false); }
  }, [dateRange, filters, sortField, sortOrder, perPage]);
  useEffect(() => { fetchData(); }, [fetchData]);
  const handleSort = (field: string) => { if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); else { setSortField(field); setSortOrder('desc'); } };
  const filteredRows = rows.filter(row => { if (!searchTerm) return true; const s = searchTerm.toLowerCase(); return (row.offer_name?.toLowerCase().includes(s) || row.publisher_name?.toLowerCase().includes(s) || row.offer_id?.toLowerCase().includes(s) || row.ip_address?.includes(s)); });
  const handleExport = async () => { try { await adminReportsApi.exportReport('performance', { start_date: dateRange.start, end_date: dateRange.end } as AdminPerformanceFilters); toast.success('Report exported'); } catch { toast.error('Export failed'); } };
  const renderCell = (col: ColumnDefinition, row: AdminPerformanceRow) => {
    switch (col.id) {
      case 'date': return row.date || '-';
      case 'publisher_name': return row.publisher_name || '-';
      case 'publisher_email': return row.publisher_email || '-';
      case 'publisher_role': return row.publisher_role || '-';
      case 'user_id': return row.user_id || '-';
      case 'offer_name': return <span className="max-w-[180px] truncate block" title={row.offer_name}>{row.offer_name || '-'}</span>;
      case 'offer_id': return row.offer_id || '-';
      case 'network': return row.network || '-';
      case 'category': return row.category || '-';
      case 'promo_code': return row.promo_code || '-';
      case 'click_id': return row.click_id ? <span className="font-mono text-xs">{row.click_id}</span> : '-';
      case 'referer': return row.referer ? <span className="max-w-[150px] truncate block text-xs" title={row.referer}>{row.referer}</span> : '-';
      case 'postback_url': return row.postback_url ? <span className={`block text-xs break-all ${row.postback_url === 'Not Configured' ? 'text-muted-foreground italic' : 'font-mono'}`} title={row.postback_url}>{row.postback_url}</span> : <span className="text-muted-foreground italic text-xs">Not Configured</span>;
      case 'country': return row.country || '-';
      case 'city': return row.city || '-';
      case 'region': return row.region || '-';
      case 'browser': return row.browser || '-';
      case 'device_type': return row.device_type || '-';
      case 'os': return row.os || '-';
      case 'ip_address': return row.ip_address ? <span className="font-mono text-xs">{row.ip_address}</span> : '-';
      case 'clicks': return row.clicks?.toLocaleString() || '0';
      case 'unique_clicks': return row.unique_clicks?.toLocaleString() || '0';
      case 'suspicious_clicks': return row.suspicious_clicks || 0;
      case 'conversions': return row.conversions?.toLocaleString() || '0';
      case 'approved_conversions': return row.approved_conversions || 0;
      case 'total_payout': return `$${(row.total_payout || 0).toFixed(2)}`;
      case 'total_revenue': return `$${(row.total_revenue || 0).toFixed(2)}`;
      case 'profit': { const p = row.profit || 0; return <span className={p >= 0 ? 'text-green-600' : 'text-red-600'}>${p.toFixed(2)}</span>; }
      case 'cr': return `${(row.cr || 0).toFixed(2)}%`;
      case 'epc': return `$${(row.epc || 0).toFixed(2)}`;
      case 'currency': return row.currency || 'USD';
      default: return (row as any)[col.id] ?? '-';
    }
  };
  return (
    <div className="space-y-4">
      <ChartSection dateRange={dateRange} tab="performance" />
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="p-4"><div className="text-xs text-muted-foreground">Total Clicks</div><div className="text-2xl font-bold">{summary.total_clicks?.toLocaleString()}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Conversions</div><div className="text-2xl font-bold">{summary.total_conversions?.toLocaleString()}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Total Payout</div><div className="text-2xl font-bold">${(summary.total_payout || 0).toFixed(2)}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Revenue</div><div className="text-2xl font-bold">${(summary.total_revenue || 0).toFixed(2)}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Avg CR</div><div className="text-2xl font-bold">{(summary.avg_cr || 0).toFixed(2)}%</div></Card>
        </div>
      )}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div><label className="text-xs font-medium">Start Date</label><Input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="w-40" /></div>
          <div><label className="text-xs font-medium">End Date</label><Input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="w-40" /></div>
          <DatePresets onPresetSelect={p => setDateRange({ start: p.start, end: p.end })} />
          {filterOptions && filterOptions.publishers.length > 0 && <SearchablePublisherSelect publishers={filterOptions.publishers} value={filters.publisher_id} onChange={v => setFilters(prev => ({ ...prev, publisher_id: v }))} />}
          {filterOptions && filterOptions.offers.length > 0 && (<div><label className="text-xs font-medium">Offer</label><Select value={filters.offer_id || 'all'} onValueChange={v => setFilters(prev => ({ ...prev, offer_id: v === 'all' ? undefined : v }))}><SelectTrigger className="w-48"><SelectValue placeholder="All Offers" /></SelectTrigger><SelectContent>{[<SelectItem key="all" value="all">All Offers</SelectItem>, ...filterOptions.offers.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)]}</SelectContent></Select></div>)}
          {filterOptions && filterOptions.countries.length > 0 && (<div><label className="text-xs font-medium">Country</label><Select value={filters.country || 'all'} onValueChange={v => setFilters(prev => ({ ...prev, country: v === 'all' ? undefined : v }))}><SelectTrigger className="w-36"><SelectValue placeholder="All" /></SelectTrigger><SelectContent>{[<SelectItem key="all" value="all">All Countries</SelectItem>, ...filterOptions.countries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)]}</SelectContent></Select></div>)}
          {filterOptions && filterOptions.regions && filterOptions.regions.length > 0 && (<div><label className="text-xs font-medium">Region</label><Select value={filters.region || 'all'} onValueChange={v => setFilters(prev => ({ ...prev, region: v === 'all' ? undefined : v }))}><SelectTrigger className="w-36"><SelectValue placeholder="All" /></SelectTrigger><SelectContent>{[<SelectItem key="all" value="all">All Regions</SelectItem>, ...filterOptions.regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)]}</SelectContent></Select></div>)}
          {filterOptions && filterOptions.cities && filterOptions.cities.length > 0 && (<div><label className="text-xs font-medium">City</label><Select value={filters.city || 'all'} onValueChange={v => setFilters(prev => ({ ...prev, city: v === 'all' ? undefined : v }))}><SelectTrigger className="w-36"><SelectValue placeholder="All" /></SelectTrigger><SelectContent>{[<SelectItem key="all" value="all">All Cities</SelectItem>, ...filterOptions.cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)]}</SelectContent></Select></div>)}
          {filterOptions && filterOptions.categories && filterOptions.categories.length > 0 && (<div><label className="text-xs font-medium">Category</label><Select value={filters.category || 'all'} onValueChange={v => setFilters(prev => ({ ...prev, category: v === 'all' ? undefined : v }))}><SelectTrigger className="w-36"><SelectValue placeholder="All" /></SelectTrigger><SelectContent>{[<SelectItem key="all" value="all">All Categories</SelectItem>, ...filterOptions.categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)]}</SelectContent></Select></div>)}
          {filterOptions && filterOptions.networks && filterOptions.networks.length > 0 && (<div><label className="text-xs font-medium">Network</label><Select value={filters.network || 'all'} onValueChange={v => setFilters(prev => ({ ...prev, network: v === 'all' ? undefined : v }))}><SelectTrigger className="w-36"><SelectValue placeholder="All" /></SelectTrigger><SelectContent>{[<SelectItem key="all" value="all">All Networks</SelectItem>, ...filterOptions.networks.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)]}</SelectContent></Select></div>)}
          <div><label className="text-xs font-medium">Device</label><Select value={filters.device_type || 'all'} onValueChange={v => setFilters(prev => ({ ...prev, device_type: v === 'all' ? undefined : v }))}><SelectTrigger className="w-32"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="desktop">Desktop</SelectItem><SelectItem value="mobile">Mobile</SelectItem><SelectItem value="tablet">Tablet</SelectItem></SelectContent></Select></div>
          <div><label className="text-xs font-medium">Per Page</label><Select value={String(perPage)} onValueChange={v => setPerPage(Number(v))}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem></SelectContent></Select></div>
          <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8 w-56" /></div>
          <ColumnSelector columns={PERF_COLUMNS} visibleColumns={visibleColumns} onColumnChange={(id, v) => setVisibleColumns(prev => ({ ...prev, [id]: v }))} onSelectAll={() => setVisibleColumns(PERF_COLUMNS.reduce((a, c) => ({ ...a, [c.id]: true }), {}))} onClearAll={() => setVisibleColumns(PERF_COLUMNS.reduce((a, c) => ({ ...a, [c.id]: c.alwaysVisible || false }), {}))} />
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1" />Export</Button>
          <Button size="sm" onClick={() => fetchData()}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
        </div>
      </Card>
      <Card>
        <div className="overflow-x-auto">
          {loading ? <div className="text-center py-12 text-muted-foreground">Loading...</div> : filteredRows.length === 0 ? <div className="text-center py-12 text-muted-foreground">No data found.</div> : (
            <Table>
              <TableHeader><TableRow>{PERF_COLUMNS.filter(c => visibleColumns[c.id]).map(col => <SortableHeader key={col.id} label={col.label} field={col.id} sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />)}</TableRow></TableHeader>
              <TableBody>{filteredRows.map((row, i) => (<TableRow key={i} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedRow(row); setShowDetail(true); }}>{PERF_COLUMNS.filter(c => visibleColumns[c.id]).map(col => <TableCell key={col.id}>{renderCell(col, row)}</TableCell>)}</TableRow>))}</TableBody>
            </Table>
          )}
        </div>
        {pagination.pages > 1 && (<div className="flex items-center justify-between p-4 border-t"><span className="text-sm text-muted-foreground">Page {pagination.page} of {pagination.pages} ({pagination.total} total)</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => fetchData(pagination.page - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={pagination.page >= pagination.pages} onClick={() => fetchData(pagination.page + 1)}>Next</Button></div></div>)}
      </Card>
      <DetailModal data={selectedRow} open={showDetail} onClose={() => setShowDetail(false)} type="performance" />
    </div>
  );
}

function ConversionTab() {
  const [loading, setLoading] = useState(false);
  const [conversions, setConversions] = useState<AdminConversion[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0, pages: 0 });
  const [perPage, setPerPage] = useState(20);
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
  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params: any = { start_date: dateRange.start, end_date: dateRange.end, page, per_page: perPage, sort_field: sortField, sort_order: sortOrder };
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await adminReportsApi.getConversionReport(params);
      if (res.success && res.report) { setConversions(res.report.conversions || []); setSummary(res.report.summary || null); setPagination(res.report.pagination || { page: 1, per_page: perPage, total: 0, pages: 0 }); }
    } catch { toast.error('Failed to load conversion report'); }
    finally { setLoading(false); }
  }, [dateRange, filters, sortField, sortOrder, perPage]);
  useEffect(() => { fetchData(); }, [fetchData]);
  const handleSort = (field: string) => { if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); else { setSortField(field); setSortOrder('desc'); } };
  const filteredConversions = conversions.filter(conv => { if (!searchTerm) return true; const s = searchTerm.toLowerCase(); return (conv.offer_name?.toLowerCase().includes(s) || conv.publisher_name?.toLowerCase().includes(s) || conv.username?.toLowerCase().includes(s) || conv.click_id?.toLowerCase().includes(s) || conv.offer_id?.toLowerCase().includes(s) || conv.ip_address?.includes(s)); });
  const handleExport = async () => { try { await adminReportsApi.exportReport('conversions', { start_date: dateRange.start, end_date: dateRange.end } as AdminPerformanceFilters); toast.success('Report exported'); } catch { toast.error('Export failed'); } };
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
          {filterOptions && filterOptions.publishers.length > 0 && <SearchablePublisherSelect publishers={filterOptions.publishers} value={filters.publisher_id} onChange={v => setFilters(prev => ({ ...prev, publisher_id: v }))} />}
          {filterOptions && filterOptions.offers.length > 0 && (<div><label className="text-xs font-medium">Offer</label><Select value={filters.offer_id || 'all'} onValueChange={v => setFilters(prev => ({ ...prev, offer_id: v === 'all' ? undefined : v }))}><SelectTrigger className="w-48"><SelectValue placeholder="All Offers" /></SelectTrigger><SelectContent>{[<SelectItem key="all" value="all">All Offers</SelectItem>, ...filterOptions.offers.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)]}</SelectContent></Select></div>)}
          {filterOptions && filterOptions.countries.length > 0 && (<div><label className="text-xs font-medium">Country</label><Select value={filters.country || 'all'} onValueChange={v => setFilters(prev => ({ ...prev, country: v === 'all' ? undefined : v }))}><SelectTrigger className="w-36"><SelectValue placeholder="All" /></SelectTrigger><SelectContent>{[<SelectItem key="all" value="all">All Countries</SelectItem>, ...filterOptions.countries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)]}</SelectContent></Select></div>)}
          {filterOptions && filterOptions.regions && filterOptions.regions.length > 0 && (<div><label className="text-xs font-medium">Region</label><Select value={filters.region || 'all'} onValueChange={v => setFilters(prev => ({ ...prev, region: v === 'all' ? undefined : v }))}><SelectTrigger className="w-36"><SelectValue placeholder="All" /></SelectTrigger><SelectContent>{[<SelectItem key="all" value="all">All Regions</SelectItem>, ...filterOptions.regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)]}</SelectContent></Select></div>)}
          {filterOptions && filterOptions.cities && filterOptions.cities.length > 0 && (<div><label className="text-xs font-medium">City</label><Select value={filters.city || 'all'} onValueChange={v => setFilters(prev => ({ ...prev, city: v === 'all' ? undefined : v }))}><SelectTrigger className="w-36"><SelectValue placeholder="All" /></SelectTrigger><SelectContent>{[<SelectItem key="all" value="all">All Cities</SelectItem>, ...filterOptions.cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)]}</SelectContent></Select></div>)}
          {filterOptions && filterOptions.categories && filterOptions.categories.length > 0 && (<div><label className="text-xs font-medium">Category</label><Select value={filters.category || 'all'} onValueChange={v => setFilters(prev => ({ ...prev, category: v === 'all' ? undefined : v }))}><SelectTrigger className="w-36"><SelectValue placeholder="All" /></SelectTrigger><SelectContent>{[<SelectItem key="all" value="all">All Categories</SelectItem>, ...filterOptions.categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)]}</SelectContent></Select></div>)}
          {filterOptions && filterOptions.networks && filterOptions.networks.length > 0 && (<div><label className="text-xs font-medium">Network</label><Select value={filters.network || 'all'} onValueChange={v => setFilters(prev => ({ ...prev, network: v === 'all' ? undefined : v }))}><SelectTrigger className="w-36"><SelectValue placeholder="All" /></SelectTrigger><SelectContent>{[<SelectItem key="all" value="all">All Networks</SelectItem>, ...filterOptions.networks.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)]}</SelectContent></Select></div>)}
          <div><label className="text-xs font-medium">Device</label><Select value={filters.device_type || 'all'} onValueChange={v => setFilters(prev => ({ ...prev, device_type: v === 'all' ? undefined : v }))}><SelectTrigger className="w-32"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="desktop">Desktop</SelectItem><SelectItem value="mobile">Mobile</SelectItem><SelectItem value="tablet">Tablet</SelectItem></SelectContent></Select></div>
          <div><label className="text-xs font-medium">Status</label><Select value={filters.status || 'all'} onValueChange={v => setFilters(prev => ({ ...prev, status: v === 'all' ? undefined : v }))}><SelectTrigger className="w-32"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent></Select></div>
          <div><label className="text-xs font-medium">Per Page</label><Select value={String(perPage)} onValueChange={v => setPerPage(Number(v))}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem></SelectContent></Select></div>
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
              <TableBody>{filteredConversions.map((conv, i) => (<TableRow key={conv._id || i} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedConversion(conv); setShowDetail(true); }}>{CONV_COLUMNS.filter(c => visibleColumns[c.id]).map(col => <TableCell key={col.id}>{renderCell(col, conv)}</TableCell>)}</TableRow>))}</TableBody>
            </Table>
          )}
        </div>
        {pagination.pages > 1 && (<div className="flex items-center justify-between p-4 border-t"><span className="text-sm text-muted-foreground">Page {pagination.page} of {pagination.pages} ({pagination.total} total)</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => fetchData(pagination.page - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={pagination.page >= pagination.pages} onClick={() => fetchData(pagination.page + 1)}>Next</Button></div></div>)}
      </Card>
      <DetailModal data={selectedConversion} open={showDetail} onClose={() => setShowDetail(false)} type="conversion" />
    </div>
  );
}

function ClickTrackingTab() {
  const [loading, setLoading] = useState(false);
  const [clicks, setClicks] = useState<AdminClick[]>([]);
  const [pagination, setPagination] = useState({ page: 1, per_page: 50, total: 0, pages: 0 });
  const [perPage, setPerPage] = useState(50);
  const [selectedClick, setSelectedClick] = useState<AdminClick | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date(); const ago = new Date(); ago.setDate(today.getDate() - 7);
    return { start: ago.toISOString().split('T')[0], end: today.toISOString().split('T')[0] };
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<Record<string, string | undefined>>({});
  const [sortField, setSortField] = useState('time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('admin_click_cols_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Always ensure alwaysVisible columns are visible
        CLICK_COLUMNS.forEach(col => { if (col.alwaysVisible) parsed[col.id] = true; });
        // Ensure new columns that don't exist in saved state get their defaults
        CLICK_COLUMNS.forEach(col => { if (!(col.id in parsed)) parsed[col.id] = col.defaultVisible; });
        return parsed;
      } catch { /* */ }
    }
    return CLICK_COLUMNS.reduce((acc, col) => { acc[col.id] = col.defaultVisible; return acc; }, {} as Record<string, boolean>);
  });
  useEffect(() => { localStorage.setItem('admin_click_cols_v3', JSON.stringify(visibleColumns)); }, [visibleColumns]);
  useEffect(() => { adminReportsApi.getFilterOptions().then(res => { if (res.success) setFilterOptions(res as any); }).catch(() => {}); }, []);
  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params: any = { start_date: dateRange.start, end_date: dateRange.end, page, per_page: perPage };
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await adminReportsApi.getClicksReport(params);
      if (res.success) { setClicks(res.clicks || []); setPagination(res.pagination || { page: 1, per_page: perPage, total: 0, pages: 0 }); }
    } catch { toast.error('Failed to load clicks'); }
    finally { setLoading(false); }
  }, [dateRange, filters, perPage]);
  useEffect(() => { fetchData(); }, [fetchData]);
  const handleSort = (field: string) => { if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); else { setSortField(field); setSortOrder('desc'); } };
  const filteredClicks = useMemo(() => {
    let result = clicks;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(click => click.offer_name?.toLowerCase().includes(s) || click.publisher_name?.toLowerCase().includes(s) || click.click_id?.toLowerCase().includes(s) || click.ip_address?.includes(s) || click.offer_id?.toLowerCase().includes(s) || click.network?.toLowerCase().includes(s));
    }
    if (sortField) {
      result = [...result].sort((a, b) => {
        const aVal = (a as any)[sortField] ?? '';
        const bVal = (b as any)[sortField] ?? '';
        if (typeof aVal === 'number' && typeof bVal === 'number') return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        return sortOrder === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
      });
    }
    return result;
  }, [clicks, searchTerm, sortField, sortOrder]);
  const renderCell = (col: ColumnDefinition, click: AdminClick) => {
    switch (col.id) {
      case 'time': return click.time || '-';
      case 'click_id': return click.click_id ? <span className="font-mono text-xs">{click.click_id}</span> : '-';
      case 'offer_name': return <span className="max-w-[180px] truncate block" title={click.offer_name}>{click.offer_name || '-'}</span>;
      case 'offer_id': return click.offer_id || '-';
      case 'publisher_name': return click.publisher_name || '-';
      case 'publisher_email': return click.publisher_email || '-';
      case 'publisher_role': return click.publisher_role || '-';
      case 'user_id': return click.user_id || '-';
      case 'network': return click.network || '-';
      case 'category': return click.category || '-';
      case 'payout': return `$${(click.payout || 0).toFixed(2)}`;
      case 'currency': return click.currency || 'USD';
      case 'country': return click.country || '-';
      case 'city': return click.city || '-';
      case 'region': return click.region || '-';
      case 'device_type': return click.device_type || '-';
      case 'browser': return click.browser || '-';
      case 'os': return click.os || '-';
      case 'ip_address': return click.ip_address ? <span className="font-mono text-xs">{click.ip_address}</span> : '-';
      case 'referer': return click.referer ? <span className="max-w-[150px] truncate block text-xs" title={click.referer}>{click.referer}</span> : '-';
      case 'postback_url': return click.postback_url ? <span className="max-w-[150px] truncate block text-xs font-mono" title={click.postback_url}>{click.postback_url}</span> : <span className="text-muted-foreground italic text-xs">Not Configured</span>;
      case 'target_url': return click.target_url ? <span className="max-w-[150px] truncate block text-xs" title={click.target_url}>{click.target_url}</span> : '-';
      case 'converted': return click.converted ? <Badge className="bg-green-100 text-green-800 text-xs">Yes</Badge> : <Badge variant="outline" className="text-xs">No</Badge>;
      case 'user_agent': return click.user_agent ? <span className="max-w-[150px] truncate block text-xs" title={click.user_agent}>{click.user_agent}</span> : '-';
      case 'sub_id1': return click.sub_id1 || '-';
      case 'sub_id2': return click.sub_id2 || '-';
      case 'sub_id3': return click.sub_id3 || '-';
      case 'sub_id4': return click.sub_id4 || '-';
      case 'sub_id5': return click.sub_id5 || '-';
      case 'when_clicked': return click.when_clicked || click.time || '-';
      case 'time_spent': {
        const ts = click.time_spent;
        if (!ts) return <span className="text-muted-foreground text-xs">—</span>;
        if (ts === 'Opened') return <Badge className="bg-blue-100 text-blue-800 text-xs">Opened</Badge>;
        return <span className="text-xs font-medium">{ts}</span>;
      }
      case 'when_closed': return click.when_closed || <span className="text-muted-foreground text-xs">—</span>;
      // Phase 1.3: Postback mapping columns
      case 'postback_status': {
        const received = (click as any).postback_received;
        if (received) return <Badge className="bg-green-100 text-green-800 text-xs">✅ Received</Badge>;
        if (click.converted) return <Badge className="bg-yellow-100 text-yellow-800 text-xs">⏳ Converted</Badge>;
        return <Badge variant="outline" className="text-xs text-muted-foreground">❌ No Postback</Badge>;
      }
      case 'event_type': {
        const et = (click as any).postback_event_type;
        if (!et) return <span className="text-muted-foreground text-xs">—</span>;
        const colors: Record<string, string> = { install: 'bg-blue-100 text-blue-800', signup: 'bg-purple-100 text-purple-800', ftd: 'bg-emerald-100 text-emerald-800', purchase: 'bg-green-100 text-green-800' };
        return <Badge className={`${colors[et] || 'bg-gray-100 text-gray-800'} text-xs`}>{et}</Badge>;
      }
      case 'event_revenue': {
        const rev = (click as any).postback_revenue;
        return rev ? <span className="text-xs font-medium text-green-600">${Number(rev).toFixed(2)}</span> : <span className="text-muted-foreground text-xs">—</span>;
      }
      case 'event_status': {
        const es = (click as any).event_status;
        if (es === 'full_conversion') return <Badge className="bg-green-100 text-green-800 text-xs">Full</Badge>;
        if (es === 'partial_event') return <Badge className="bg-yellow-100 text-yellow-800 text-xs">Partial</Badge>;
        return <span className="text-muted-foreground text-xs">No Event</span>;
      }
      case 'fraud_score': {
        const fs = (click as any).fraud_score || 0;
        const color = fs >= 70 ? 'text-red-600' : fs >= 30 ? 'text-yellow-600' : 'text-green-600';
        return <span className={`text-xs font-bold ${color}`}>{fs}</span>;
      }
      case 'fraud_class': {
        const fc = (click as any).fraud_classification || 'genuine';
        const colors: Record<string, string> = { genuine: 'bg-green-100 text-green-800', suspicious: 'bg-yellow-100 text-yellow-800', fraud: 'bg-red-100 text-red-800' };
        return <Badge className={`${colors[fc] || 'bg-gray-100 text-gray-800'} text-xs`}>{fc}</Badge>;
      }
      case 'actions': return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={e => e.stopPropagation()}>⋯</Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48" onClick={e => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => { actionsApi.blockUser(click.user_id || '').then(() => toast.success('User blocked')).catch(() => toast.error('Failed to block user')); }}>🚫 Block User</DropdownMenuItem>
            <DropdownMenuItem onClick={() => { actionsApi.pauseOffer(click.offer_id || '').then(() => toast.success('Offer paused')).catch(() => toast.error('Failed to pause offer')); }}>⏸️ Pause Offer</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { const p = prompt('New payout amount:'); if (p) actionsApi.changePayout(click.offer_id || '', parseFloat(p)).then(() => toast.success('Payout changed')).catch(() => toast.error('Failed')); }}>💰 Change Payout (All)</DropdownMenuItem>
            <DropdownMenuItem onClick={() => { const p = prompt('New payout for this user:'); if (p) actionsApi.changePayout(click.offer_id || '', parseFloat(p), click.user_id).then(() => toast.success('User payout set')).catch(() => toast.error('Failed')); }}>👤 Change Payout (User)</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { actionsApi.sendWarning(click.user_id || '').then(() => toast.success('Warning sent')).catch(() => toast.error('Failed')); }}>⚠️ Send Warning</DropdownMenuItem>
            <DropdownMenuItem onClick={() => { actionsApi.requestProof(click.user_id || '', click.offer_id).then(() => toast.success('Proof requested')).catch(() => toast.error('Failed')); }}>📸 Request Proof</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { if (click.ip_address) { import('@/services/trafficIntelligenceApi').then(m => m.fraudApi.blockIp(click.ip_address || '')).then(() => toast.success('IP blocked')).catch(() => toast.error('Failed')); } }}>🔒 Block IP</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
      default: return (click as any)[col.id] ?? '-';
    }
  };
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div><label className="text-xs font-medium">Start Date</label><Input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="w-40" /></div>
          <div><label className="text-xs font-medium">End Date</label><Input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="w-40" /></div>
          <DatePresets onPresetSelect={p => setDateRange({ start: p.start, end: p.end })} />
          {filterOptions && filterOptions.publishers.length > 0 && <SearchablePublisherSelect publishers={filterOptions.publishers} value={filters.publisher_id} onChange={v => setFilters(prev => ({ ...prev, publisher_id: v }))} />}
          {filterOptions && filterOptions.offers.length > 0 && (<div><label className="text-xs font-medium">Offer</label><Select value={filters.offer_id || 'all'} onValueChange={v => setFilters(prev => ({ ...prev, offer_id: v === 'all' ? undefined : v }))}><SelectTrigger className="w-48"><SelectValue placeholder="All Offers" /></SelectTrigger><SelectContent>{[<SelectItem key="all" value="all">All Offers</SelectItem>, ...filterOptions.offers.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)]}</SelectContent></Select></div>)}
          {filterOptions && filterOptions.countries.length > 0 && (<div><label className="text-xs font-medium">Country</label><Select value={filters.country || 'all'} onValueChange={v => setFilters(prev => ({ ...prev, country: v === 'all' ? undefined : v }))}><SelectTrigger className="w-36"><SelectValue placeholder="All" /></SelectTrigger><SelectContent>{[<SelectItem key="all" value="all">All Countries</SelectItem>, ...filterOptions.countries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)]}</SelectContent></Select></div>)}
          {filterOptions && filterOptions.regions && filterOptions.regions.length > 0 && (<div><label className="text-xs font-medium">Region</label><Select value={filters.region || 'all'} onValueChange={v => setFilters(prev => ({ ...prev, region: v === 'all' ? undefined : v }))}><SelectTrigger className="w-36"><SelectValue placeholder="All" /></SelectTrigger><SelectContent>{[<SelectItem key="all" value="all">All Regions</SelectItem>, ...filterOptions.regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)]}</SelectContent></Select></div>)}
          {filterOptions && filterOptions.cities && filterOptions.cities.length > 0 && (<div><label className="text-xs font-medium">City</label><Select value={filters.city || 'all'} onValueChange={v => setFilters(prev => ({ ...prev, city: v === 'all' ? undefined : v }))}><SelectTrigger className="w-36"><SelectValue placeholder="All" /></SelectTrigger><SelectContent>{[<SelectItem key="all" value="all">All Cities</SelectItem>, ...filterOptions.cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)]}</SelectContent></Select></div>)}
          {filterOptions && filterOptions.categories && filterOptions.categories.length > 0 && (<div><label className="text-xs font-medium">Category</label><Select value={filters.category || 'all'} onValueChange={v => setFilters(prev => ({ ...prev, category: v === 'all' ? undefined : v }))}><SelectTrigger className="w-36"><SelectValue placeholder="All" /></SelectTrigger><SelectContent>{[<SelectItem key="all" value="all">All Categories</SelectItem>, ...filterOptions.categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)]}</SelectContent></Select></div>)}
          {filterOptions && filterOptions.networks && filterOptions.networks.length > 0 && (<div><label className="text-xs font-medium">Network</label><Select value={filters.network || 'all'} onValueChange={v => setFilters(prev => ({ ...prev, network: v === 'all' ? undefined : v }))}><SelectTrigger className="w-36"><SelectValue placeholder="All" /></SelectTrigger><SelectContent>{[<SelectItem key="all" value="all">All Networks</SelectItem>, ...filterOptions.networks.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)]}</SelectContent></Select></div>)}
          <div><label className="text-xs font-medium">Device</label><Select value={filters.device_type || 'all'} onValueChange={v => setFilters(prev => ({ ...prev, device_type: v === 'all' ? undefined : v }))}><SelectTrigger className="w-32"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="desktop">Desktop</SelectItem><SelectItem value="mobile">Mobile</SelectItem><SelectItem value="tablet">Tablet</SelectItem></SelectContent></Select></div>
          <div><label className="text-xs font-medium">Postback</label><Select value={filters.postback_status || 'all'} onValueChange={v => setFilters(prev => ({ ...prev, postback_status: v === 'all' ? undefined : v }))}><SelectTrigger className="w-36"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">All Clicks</SelectItem><SelectItem value="received">✅ Postback Yes</SelectItem><SelectItem value="no_postback">❌ No Postback</SelectItem></SelectContent></Select></div>
          <div><label className="text-xs font-medium">Event</label><Select value={filters.event_status || 'all'} onValueChange={v => setFilters(prev => ({ ...prev, event_status: v === 'all' ? undefined : v }))}><SelectTrigger className="w-36"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">All Events</SelectItem><SelectItem value="no_event">No Event</SelectItem><SelectItem value="partial_event">Partial (Install/Signup)</SelectItem><SelectItem value="full_conversion">Full (FTD/Purchase)</SelectItem></SelectContent></Select></div>
          <div><label className="text-xs font-medium">Fraud</label><Select value={filters.fraud_classification || 'all'} onValueChange={v => setFilters(prev => ({ ...prev, fraud_classification: v === 'all' ? undefined : v }))}><SelectTrigger className="w-32"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="genuine">🟢 Genuine</SelectItem><SelectItem value="suspicious">🟡 Suspicious</SelectItem><SelectItem value="fraud">🔴 Fraud</SelectItem></SelectContent></Select></div>
          <div><label className="text-xs font-medium">Per Page</label><Select value={String(perPage)} onValueChange={v => setPerPage(Number(v))}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem><SelectItem value="200">200</SelectItem></SelectContent></Select></div>
          <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8 w-56" /></div>
          <ColumnSelector columns={CLICK_COLUMNS} visibleColumns={visibleColumns} onColumnChange={(id, v) => setVisibleColumns(prev => ({ ...prev, [id]: v }))} onSelectAll={() => setVisibleColumns(CLICK_COLUMNS.reduce((a, c) => ({ ...a, [c.id]: true }), {}))} onClearAll={() => setVisibleColumns(CLICK_COLUMNS.reduce((a, c) => ({ ...a, [c.id]: c.alwaysVisible || false }), {}))} />
          <Button size="sm" onClick={() => fetchData()}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
        </div>
      </Card>
      {/* Color Legend */}
      <div className="flex items-center gap-4 px-1 text-xs">
        <span className="text-muted-foreground font-medium">Row Colors:</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-white dark:bg-zinc-900 border" />Genuine (0-29)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-yellow-100 dark:bg-yellow-950/40 border border-yellow-200" />Suspicious (30-69)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-100 dark:bg-red-950/40 border border-red-200" />Fraud (70+)</span>
        <span className="text-muted-foreground ml-2">| Use the Fraud filter above to isolate each type</span>
      </div>
      <Card>
        <div className="overflow-x-auto">
          {loading ? <div className="text-center py-12 text-muted-foreground">Loading...</div> : filteredClicks.length === 0 ? <div className="text-center py-12 text-muted-foreground">No clicks found.</div> : (
            <Table>
              <TableHeader><TableRow>{CLICK_COLUMNS.filter(c => visibleColumns[c.id]).map(col => <SortableHeader key={col.id} label={col.label} field={col.id} sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />)}</TableRow></TableHeader>
              <TableBody>{filteredClicks.map((click, i) => { const fc = (click as any).fraud_classification || 'genuine'; const rowColor = fc === 'fraud' ? 'bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/30' : fc === 'suspicious' ? 'bg-yellow-50 dark:bg-yellow-950/20 hover:bg-yellow-100 dark:hover:bg-yellow-950/30' : 'hover:bg-muted/50'; return (<TableRow key={click._id || i} className={`cursor-pointer ${rowColor}`} onClick={() => { setSelectedClick(click); setShowDetail(true); }}>{CLICK_COLUMNS.filter(c => visibleColumns[c.id]).map(col => <TableCell key={col.id}>{renderCell(col, click)}</TableCell>)}</TableRow>); })}</TableBody>
            </Table>
          )}
        </div>
        {pagination.pages > 1 && (<div className="flex items-center justify-between p-4 border-t"><span className="text-sm text-muted-foreground">Page {pagination.page} of {pagination.pages} ({pagination.total} total)</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => fetchData(pagination.page - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={pagination.page >= pagination.pages} onClick={() => fetchData(pagination.page + 1)}>Next</Button></div></div>)}
      </Card>
      <DetailModal data={selectedClick} open={showDetail} onClose={() => setShowDetail(false)} type="click" />
    </div>
  );
}

function AdminReportsTrackingContent() {
  const [activeTab, setActiveTab] = useState<'performance' | 'conversion' | 'clicks' | 'funnel' | 'affiliates' | 'geo' | 'actions' | 'intelligence'>('performance');
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold tracking-tight">Reports</h1><p className="text-muted-foreground">Traffic intelligence — performance, clicks, funnel, affiliates, and geo analytics</p></div>
      </div>
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit flex-wrap">
        <button onClick={() => setActiveTab('performance')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'performance' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}><TrendingUp className="h-4 w-4" />Performance</button>
        <button onClick={() => setActiveTab('conversion')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'conversion' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}><FileText className="h-4 w-4" />Conversions</button>
        <button onClick={() => setActiveTab('clicks')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'clicks' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}><MousePointerClick className="h-4 w-4" />Click Tracking</button>
        <button onClick={() => setActiveTab('funnel')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'funnel' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}><BarChart3 className="h-4 w-4" />Event Funnel</button>
        <button onClick={() => setActiveTab('affiliates')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'affiliates' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}><Shield className="h-4 w-4" />Affiliates</button>
        <button onClick={() => setActiveTab('geo')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'geo' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}><Globe className="h-4 w-4" />Geo</button>
        <button onClick={() => setActiveTab('actions')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'actions' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}><Eye className="h-4 w-4" />Admin Actions</button>
        <button onClick={() => setActiveTab('intelligence')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'intelligence' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}><Shield className="h-4 w-4" />Intelligence</button>
      </div>
      {activeTab === 'performance' ? <PerformanceTab /> : activeTab === 'conversion' ? <ConversionTab /> : activeTab === 'funnel' ? <EventFunnel /> : activeTab === 'affiliates' ? <AffiliateComparison /> : activeTab === 'geo' ? <GeoAnalytics /> : activeTab === 'actions' ? <AdminActionsLog /> : activeTab === 'intelligence' ? <AffiliateIntelligence /> : <ClickTrackingTab />}
    </div>
  );
}

const AdminReportsTracking = () => (<AdminPageGuard requiredTab="tracking"><AdminReportsTrackingContent /></AdminPageGuard>);
export default AdminReportsTracking;
