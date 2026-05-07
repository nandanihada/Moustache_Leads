import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Download, FileSpreadsheet, Loader2, Layers, LayoutGrid,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { API_BASE_URL } from '@/services/apiConfig';

// ── Types ──
interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  tabCounts: Record<string, number>;
}

type GroupBy = 'none' | 'user' | 'network' | 'vertical' | 'country';

interface DateRange {
  from: string;
  to: string;
}

// ── Column definitions ──
const ALL_COLUMNS = [
  { key: 'offer_name', label: 'Offer Name', group: 'basic' },
  { key: 'status', label: 'Status', group: 'basic' },
  { key: 'publisher_username', label: 'Publisher / User', group: 'basic' },
  { key: 'offer_network', label: 'Network', group: 'basic' },
  { key: 'offer_category', label: 'Vertical', group: 'basic' },
  { key: 'offer_countries', label: 'Country', group: 'basic' },
  { key: 'offer_payout', label: 'Payout ($)', group: 'basic' },
  { key: 'requested_at', label: 'Requested Date', group: 'basic' },
  { key: 'approval_rate', label: 'Approval Rate %', group: 'stats' },
  { key: 'unique_requesters', label: 'Unique Requesters', group: 'stats' },
  { key: 'offer_total_requests', label: 'Offer Total Requests', group: 'stats' },
  { key: 'days_since_request', label: 'Days Since Request', group: 'stats' },
  { key: 'last_mail_sent', label: 'Last Mail Sent', group: 'extended' },
  { key: 'publisher_account_age', label: 'Publisher Account Age', group: 'extended' },
  { key: 'publisher_clicks', label: 'Publisher Clicks', group: 'stats' },
  { key: 'publisher_conversions', label: 'Publisher Conversions', group: 'stats' },
  { key: 'approved_at', label: 'Approved Date', group: 'extended' },
  { key: 'rejected_at', label: 'Rejected Date', group: 'extended' },
  { key: 'approved_by_username', label: 'Approved By', group: 'extended' },
  { key: 'rejected_by_username', label: 'Rejected By', group: 'extended' },
  { key: 'rejection_reason', label: 'Rejection Reason', group: 'extended' },
  { key: 'rejection_category', label: 'Rejection Category', group: 'extended' },
  { key: 'publisher_email', label: 'Publisher Email', group: 'extended' },
  { key: 'offer_status', label: 'Offer Active?', group: 'stats' },
  { key: 'has_placement_proof', label: 'Has Placement Proof', group: 'stats' },
  { key: 'message', label: 'Request Message', group: 'extended' },
  { key: 'request_count', label: 'Times Requested', group: 'stats' },
  { key: 'approved_count', label: 'Times Approved', group: 'stats' },
  { key: 'rejected_count', label: 'Times Rejected', group: 'stats' },
  { key: 'unique_users', label: 'Unique Users', group: 'stats' },
];

const BASIC_COLUMNS = ['offer_name', 'status', 'publisher_username', 'offer_network', 'offer_category', 'offer_countries', 'offer_payout', 'requested_at'];
const STATS_COLUMNS = ['approval_rate', 'unique_requesters', 'offer_total_requests', 'days_since_request', 'publisher_clicks', 'publisher_conversions', 'offer_status'];

// ── Tab definitions ──
const TABS = [
  { key: 'approved', label: 'Approved', color: '#22c55e' },
  { key: 'rejected', label: 'Rejected', color: '#ef4444' },
  { key: 'in_review', label: 'In Review', color: '#f59e0b' },
  { key: 'all_requests', label: 'All Requests', color: '#6366f1' },
  { key: 'most_requested', label: 'Most Requested', color: '#8b5cf6' },
];

const DATE_PRESETS = [
  { key: 'all', label: 'All Time' },
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
  { key: 'month', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
];

export default function ExportModal({ open, onClose, tabCounts }: ExportModalProps) {
  // ── State ──
  const [selectedTabs, setSelectedTabs] = useState<string[]>(['approved']);
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [separateSheets, setSeparateSheets] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(BASIC_COLUMNS);
  const [datePreset, setDatePreset] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange>({ from: '', to: '' });
  const [includeSummary, setIncludeSummary] = useState(true);
  const [freezeHeaders, setFreezeHeaders] = useState(true);
  const [colorCodeRows, setColorCodeRows] = useState(true);
  const [autoFitColumns, setAutoFitColumns] = useState(true);
  const [smartOptionsOpen, setSmartOptionsOpen] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filteredCounts, setFilteredCounts] = useState<Record<string, number> | null>(null);
  const [loadingCounts, setLoadingCounts] = useState(false);

  // ── Fetch filtered counts when date changes ──
  const fetchFilteredCounts = async (dr: DateRange | null) => {
    setLoadingCounts(true);
    try {
      const token = localStorage.getItem('token');
      const body: any = { tabs: TABS.map(t => t.key) };
      if (dr) body.date_range = dr;
      const res = await fetch(`${API_BASE_URL}/api/admin/offer-access-requests/export-preview-counts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setFilteredCounts(data.counts || null);
      }
    } catch { /* ignore */ }
    finally { setLoadingCounts(false); }
  };

  // Fetch real counts when modal opens
  useEffect(() => {
    if (open) {
      fetchFilteredCounts(null);
    }
  }, [open]);

  // Compute date range for preview
  const computeDateRange = (preset: string, custom?: DateRange): DateRange | null => {
    if (preset === 'all') return null;
    if (preset === 'custom') {
      if (custom && (custom.from || custom.to)) return custom;
      return null;
    }
    const now = new Date();
    let from = '';
    if (preset === '7d') {
      const d = new Date(now); d.setDate(d.getDate() - 7);
      from = d.toISOString().split('T')[0];
    } else if (preset === '30d') {
      const d = new Date(now); d.setDate(d.getDate() - 30);
      from = d.toISOString().split('T')[0];
    } else if (preset === 'month') {
      from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    }
    return { from, to: now.toISOString().split('T')[0] };
  };

  // Trigger count fetch when date preset changes
  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    const dr = computeDateRange(preset, dateRange);
    fetchFilteredCounts(dr);
  };

  // Trigger count fetch when custom date range changes
  const handleCustomDateChange = (field: 'from' | 'to', value: string) => {
    const newRange = { ...dateRange, [field]: value };
    setDateRange(newRange);
    if (newRange.from && newRange.to) {
      fetchFilteredCounts(newRange);
    }
  };

  // ── Computed values ──
  const activeCounts = filteredCounts || tabCounts;

  const totalResults = useMemo(() => {
    return selectedTabs.reduce((sum, tab) => sum + (activeCounts[tab] || 0), 0);
  }, [selectedTabs, activeCounts]);

  const sheetsPlanned = useMemo(() => {
    const baseTabs = selectedTabs.length;
    if (groupBy === 'none' || !separateSheets) return baseTabs + (includeSummary ? 1 : 0);
    return baseTabs * 5 + (includeSummary ? 1 : 0);
  }, [selectedTabs, groupBy, separateSheets, includeSummary]);

  const groupByLabel = useMemo(() => {
    if (groupBy === 'none') return 'None';
    return groupBy.charAt(0).toUpperCase() + groupBy.slice(1);
  }, [groupBy]);

  // ── Handlers ──
  const toggleTab = (tab: string) => {
    setSelectedTabs(prev =>
      prev.includes(tab) ? prev.filter(t => t !== tab) : [...prev, tab]
    );
  };

  const toggleColumn = (col: string) => {
    setSelectedColumns(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const applyPreset = (preset: string) => {
    switch (preset) {
      case 'basic': setSelectedColumns(BASIC_COLUMNS); break;
      case 'stats': setSelectedColumns(STATS_COLUMNS); break;
      case 'all': setSelectedColumns(ALL_COLUMNS.map(c => c.key)); break;
      case 'clear': setSelectedColumns([]); break;
    }
  };

  const getDateRangePayload = (): DateRange | null => {
    return computeDateRange(datePreset, dateRange);
  };

  const handleExport = async () => {
    if (selectedTabs.length === 0) {
      toast.error('Please select at least one tab to export');
      return;
    }
    if (selectedColumns.length === 0) {
      toast.error('Please select at least one column');
      return;
    }

    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        tabs: selectedTabs,
        columns: selectedColumns,
        group_by: groupBy,
        separate_sheets_per_group: separateSheets,
        date_range: getDateRangePayload(),
        include_summary: includeSummary,
        freeze_headers: freezeHeaders,
        color_code_rows: colorCodeRows,
        auto_fit_columns: autoFitColumns,
      };

      const res = await fetch(`${API_BASE_URL}/api/admin/offer-access-requests/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Export failed');
      }

      // Download the file
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `offer_requests_export_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Export downloaded successfully!');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[95vw] w-full max-h-[95vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileSpreadsheet className="w-5 h-5 text-green-500" />
            Export Offer Access Requests
          </DialogTitle>
        </DialogHeader>

        {/* ── Stats Bar ── */}
        <div className="grid grid-cols-4 gap-3 px-6 py-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground">Total results</div>
            <div className="text-xl font-bold">
              {loadingCounts ? '...' : totalResults.toLocaleString()}
            </div>
            {datePreset !== 'all' && <div className="text-[10px] text-green-500">filtered by date</div>}
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground">Sheets planned</div>
            <div className="text-xl font-bold">{sheetsPlanned}</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground">Columns selected</div>
            <div className="text-xl font-bold">{selectedColumns.length}</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground">Grouped by</div>
            <div className="text-xl font-bold">{groupByLabel}</div>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-6">
          {/* ── Step 1: Data Source & Filter ── */}
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              1 — Data Source & Filter
            </h3>
            <div className="flex flex-wrap gap-2">
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => toggleTab(tab.key)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                    selectedTabs.includes(tab.key)
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tab.color }} />
                  {tab.label} ({activeCounts[tab.key] || 0})
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Each selected tab becomes a separate sheet in the exported file</p>

            {/* Date range */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-xs text-muted-foreground mr-1">Date range:</span>
              {DATE_PRESETS.map(p => (
                <button
                  key={p.key}
                  onClick={() => handleDatePresetChange(p.key)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                    datePreset === p.key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/70 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {datePreset === 'custom' && (
              <div className="flex gap-3 pt-1">
                <Input
                  type="date"
                  value={dateRange.from}
                  onChange={e => handleCustomDateChange('from', e.target.value)}
                  className="w-40 h-8 text-xs"
                  placeholder="From"
                />
                <Input
                  type="date"
                  value={dateRange.to}
                  onChange={e => handleCustomDateChange('to', e.target.value)}
                  className="w-40 h-8 text-xs"
                  placeholder="To"
                />
              </div>
            )}
          </div>

          {/* ── Step 2: Group Rows By ── */}
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              2 — Group Rows By
            </h3>
            <div className="flex flex-wrap gap-2">
              {(['none', 'user', 'network', 'vertical', 'country'] as GroupBy[]).map(g => (
                <button
                  key={g}
                  onClick={() => setGroupBy(g)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                    groupBy === g
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {g === 'none' ? 'No grouping' : `By ${g}`}
                </button>
              ))}
            </div>

            {/* Layout options when grouping is active */}
            {groupBy !== 'none' && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => setSeparateSheets(false)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    !separateSheets
                      ? 'border-green-500 bg-green-500/5 shadow-[0_0_10px_rgba(34,197,94,0.1)]'
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Layers className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-semibold">Single Sheet with Sections</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Groups separated by bold heading rows within one sheet per tab. Easy to scan.
                  </p>
                </button>
                <button
                  onClick={() => setSeparateSheets(true)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    separateSheets
                      ? 'border-green-500 bg-green-500/5 shadow-[0_0_10px_rgba(34,197,94,0.1)]'
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <LayoutGrid className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-semibold">Separate Sheet per Group</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Each group gets its own sheet. Great for sharing network-specific data with partners.
                  </p>
                </button>
              </div>
            )}
            {groupBy === 'none' && (
              <p className="text-xs text-muted-foreground">Data will be exported as a flat list — one sheet per selected tab</p>
            )}
          </div>

          {/* ── Step 3: Columns to Include ── */}
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              3 — Columns to Include
            </h3>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => applyPreset('all')}>Select all</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => applyPreset('clear')}>Clear all</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs bg-green-500/10 border-green-500/30 text-green-600 hover:bg-green-500/20" onClick={() => applyPreset('basic')}>Basic</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs bg-blue-500/10 border-blue-500/30 text-blue-600 hover:bg-blue-500/20" onClick={() => applyPreset('stats')}>Stats only</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs bg-purple-500/10 border-purple-500/30 text-purple-600 hover:bg-purple-500/20" onClick={() => applyPreset('all')}>Full audit</Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {ALL_COLUMNS.map(col => (
                <label
                  key={col.key}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded border-l-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                    col.group === 'basic' ? 'border-l-green-500' :
                    col.group === 'stats' ? 'border-l-blue-500' : 'border-l-gray-400'
                  }`}
                >
                  <Checkbox
                    checked={selectedColumns.includes(col.key)}
                    onCheckedChange={() => toggleColumn(col.key)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-xs">{col.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* ── Step 4: Smart Options ── */}
          <div className="border rounded-lg overflow-hidden">
            <button
              onClick={() => setSmartOptionsOpen(!smartOptionsOpen)}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
            >
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                4 — Smart Options
              </h3>
              {smartOptionsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {smartOptionsOpen && (
              <div className="px-4 pb-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Include summary sheet</div>
                    <div className="text-xs text-muted-foreground">Auto-generated first sheet with totals, top networks, approval rates</div>
                  </div>
                  <Switch checked={includeSummary} onCheckedChange={setIncludeSummary} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Freeze header row</div>
                    <div className="text-xs text-muted-foreground">Keeps column headers visible when scrolling in Excel</div>
                  </div>
                  <Switch checked={freezeHeaders} onCheckedChange={setFreezeHeaders} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Color-code rows by status</div>
                    <div className="text-xs text-muted-foreground">Green = approved, Red = rejected, Yellow = in review</div>
                  </div>
                  <Switch checked={colorCodeRows} onCheckedChange={setColorCodeRows} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Auto-fit column widths</div>
                    <div className="text-xs text-muted-foreground">Adjusts column widths to fit content in Excel</div>
                  </div>
                  <Switch checked={autoFitColumns} onCheckedChange={setAutoFitColumns} />
                </div>
              </div>
            )}
          </div>

          {/* ── Footer Actions ── */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={onClose} disabled={exporting}>
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={exporting || selectedTabs.length === 0 || selectedColumns.length === 0}
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
            >
              {exporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Export Now
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
