/**
 * Offerwall Analytics Dashboard
 * Compact tile grid with color-coded importance, live activity rings,
 * per-group time windows, and click-to-open detail popups.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getApiBaseUrl } from '@/services/apiConfig';
import { getAuthToken } from '@/utils/cookies';
import {
  X, Search, ChevronLeft, ChevronRight, Loader2,
  Download, ArrowUpDown, Filter, Clock
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

// ─── TYPES ───
interface TileValue {
  value: number | string;
  latest: string | null;
}

interface DashboardData {
  install_login: { iframes_installed: TileValue; first_conversion: TileValue };
  logins_traffic: { logins: TileValue; new_users: TileValue; top_country: TileValue; top_device: TileValue };
  offers_empty_walls: { custom_picked: TileValue; no_offer_links: TileValue };
  money_payouts: { revenue: TileValue; payout_liability: TileValue; epc: TileValue; reversed_chargedback: TileValue };
  conversion_funnel: { credited_approved: TileValue; in_progress: TileValue; click_complete_pct: TileValue; avg_time_to_credit: TileValue; pending_rejected: TileValue; dead_offers: TileValue };
  fraud_quality: { vpn_redirects: TileValue; multi_account_ips: TileValue; postback_without_click: TileValue };
  offer_health: { live_offers: TileValue; paused_capped: TileValue; avg_postback_ok: TileValue };
  publishers_ops: { publisher_scorecard: TileValue; pending_requests: TileValue };
  qualification_survey: { completions: TileValue; answer_breakdown: TileValue };
}

type TimeWindow = '2h' | '10h' | '24h' | 'week' | 'month' | '3months' | '6months';

const TIME_OPTIONS: { value: TimeWindow; label: string }[] = [
  { value: '2h', label: 'Last 2 hours' },
  { value: '10h', label: 'Last 10 hours' },
  { value: '24h', label: 'Last 24 hours' },
  { value: 'week', label: 'Last week' },
  { value: 'month', label: 'Last month' },
  { value: '3months', label: 'Last 3 months' },
  { value: '6months', label: 'Last 6 months' },
];

// Importance colors
type Importance = 'key' | 'secondary' | 'standard';

interface TileConfig {
  key: string;
  label: string;
  icon: string;
  importance: Importance;
  format?: 'currency' | 'percent' | 'number' | 'text' | 'minutes';
  needsAttention?: (v: TileValue) => boolean;
  noPopup?: boolean;
}

// ─── TILE DEFINITIONS ───
const SECTION_TILES: Record<string, { title: string; tiles: TileConfig[] }> = {
  install_login: {
    title: 'INSTALL & LOGIN',
    tiles: [
      { key: 'iframes_installed', label: 'Iframes installed', icon: '⬇', importance: 'standard' },
      { key: 'first_conversion', label: 'Installs converted', icon: '◎', importance: 'key', needsAttention: (v) => Number(v.value) > 0 },
    ],
  },
  logins_traffic: {
    title: 'LOGINS & TRAFFIC',
    tiles: [
      { key: 'logins', label: 'Logins', icon: '👥', importance: 'key' },
      { key: 'new_users', label: 'New users', icon: '★', importance: 'secondary' },
      { key: 'top_country', label: 'Top country', icon: '◉', importance: 'secondary', format: 'text', noPopup: true },
      { key: 'top_device', label: 'Top device', icon: '▢', importance: 'secondary', format: 'text', noPopup: true },
    ],
  },
  money_payouts: {
    title: 'MONEY & PAYOUTS',
    tiles: [
      { key: 'revenue', label: 'Revenue', icon: '$', importance: 'key', format: 'currency' },
      { key: 'payout_liability', label: 'Payout liability', icon: '▤', importance: 'key', format: 'currency' },
      { key: 'epc', label: 'EPC', icon: '↗', importance: 'key', format: 'currency', noPopup: true },
      { key: 'reversed_chargedback', label: 'Reversed/charged..', icon: '⟲', importance: 'secondary', needsAttention: (v) => Number(v.value) > 0 },
    ],
  },
  fraud_quality: {
    title: 'FRAUD & QUALITY',
    tiles: [
      { key: 'vpn_redirects', label: 'VPN redirects', icon: '⊘', importance: 'key', needsAttention: (v) => Number(v.value) > 0 },
      { key: 'multi_account_ips', label: 'Multi-account IPs', icon: '⚠', importance: 'secondary', needsAttention: (v) => Number(v.value) > 0 },
      { key: 'postback_without_click', label: 'Postback w/o click', icon: '⟹', importance: 'secondary', needsAttention: (v) => Number(v.value) > 0 },
    ],
  },
  qualification_survey: {
    title: 'QUALIFICATION SURVEY',
    tiles: [
      { key: 'completions', label: 'Completions', icon: '☐', importance: 'standard' },
      { key: 'answer_breakdown', label: 'Answer Qs', icon: '⊞', importance: 'standard' },
    ],
  },
};

// ─── HELPERS ───
function timeAgo(isoStr: string | null): string {
  if (!isoStr) return '—';
  const diff = Date.now() - new Date(isoStr).getTime();
  if (diff < 0) return 'just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function liveRingClass(isoStr: string | null): string {
  if (!isoStr) return '';
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = diff / 60000;
  if (mins <= 10) return 'ring-2 ring-rose-400 animate-pulse';
  if (mins <= 60) return 'ring-2 ring-amber-300';
  if (mins <= 360) return 'ring-1 ring-gray-200';
  return '';
}

function importanceBorder(imp: Importance): string {
  if (imp === 'key') return 'border-l-4 border-l-purple-500';
  if (imp === 'secondary') return 'border-l-4 border-l-amber-300';
  return 'border-l-4 border-l-gray-200';
}

function formatValue(value: number | string, format?: string): string {
  if (format === 'currency') return `$${Number(value).toFixed(2)}`;
  if (format === 'percent') return `${value}%`;
  if (format === 'minutes') return `${value}m`;
  if (format === 'text') return String(value);
  return String(value);
}

// ─── MAIN COMPONENT ───
export const OfferwallAnalyticsDashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-section time windows
  const [sectionWindows, setSectionWindows] = useState<Record<string, TimeWindow>>({
    install_login: 'month',
    logins_traffic: '24h',
    money_payouts: 'month',
    fraud_quality: 'month',
    qualification_survey: 'month',
  });

  // Detail popup state
  const [popup, setPopup] = useState<{ open: boolean; tile: string; label: string }>({ open: false, tile: '', label: '' });
  const [popupWindow, setPopupWindow] = useState<TimeWindow>('month');
  const [popupRows, setPopupRows] = useState<any[]>([]);
  const [popupChartData, setPopupChartData] = useState<any[]>([]);
  const [popupTotal, setPopupTotal] = useState(0);
  const [popupPage, setPopupPage] = useState(1);
  const [popupPerPage, setPopupPerPage] = useState(20);
  const [popupSearch, setPopupSearch] = useState('');
  const [popupLoading, setPopupLoading] = useState(false);

  // Live timestamp ticker
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(iv);
  }, []);

  const fetchDashboard = useCallback(async (window: TimeWindow = 'month') => {
    setLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      const res = await fetch(`${getApiBaseUrl()}/api/admin/offerwall-analytics/dashboard?window=${window}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const json = await res.json();
      if (json.success) setData(json.data);
      else throw new Error(json.error || 'Unknown error');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch dashboard when any section window changes (use the broadest window)
  useEffect(() => {
    const allWindows = Object.values(sectionWindows);
    const windowOrder: TimeWindow[] = ['2h', '10h', '24h', 'week', 'month', '3months', '6months'];
    const broadest = allWindows.reduce((a, b) => windowOrder.indexOf(a) > windowOrder.indexOf(b) ? a : b, '2h' as TimeWindow);
    fetchDashboard(broadest);
  }, [sectionWindows, fetchDashboard]);

  // Fetch tile detail
  const fetchTileDetail = useCallback(async (tile: string, window: TimeWindow, page: number, search: string, perPage: number = 20) => {
    setPopupLoading(true);
    try {
      const token = getAuthToken();
      const params = new URLSearchParams({ tile, window, page: String(page), per_page: String(perPage), search });
      const res = await fetch(`${getApiBaseUrl()}/api/admin/offerwall-analytics/tile-detail?${params}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const json = await res.json();
      if (json.success) {
        setPopupRows(json.data.rows || []);
        setPopupTotal(json.data.total || 0);
        setPopupChartData(json.data.chart_data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPopupLoading(false);
    }
  }, []);

  const openPopup = (tile: string, label: string) => {
    setPopup({ open: true, tile, label });
    setPopupPage(1);
    setPopupSearch('');
    setPopupPerPage(20);
    const sectionKey = Object.keys(SECTION_TILES).find(s => SECTION_TILES[s].tiles.some(t => t.key === tile)) || '';
    const win = sectionWindows[sectionKey] || 'month';
    setPopupWindow(win);
    fetchTileDetail(tile, win, 1, '', 20);
  };

  // Re-fetch popup when window/page/perPage changes
  useEffect(() => {
    if (popup.open) {
      fetchTileDetail(popup.tile, popupWindow, popupPage, popupSearch, popupPerPage);
    }
  }, [popupWindow, popupPage, popupPerPage]);

  const handlePopupSearch = () => {
    setPopupPage(1);
    fetchTileDetail(popup.tile, popupWindow, 1, popupSearch, popupPerPage);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span className="text-muted-foreground">Loading analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        <p className="font-medium">Failed to load analytics</p>
        <p className="text-sm">{error}</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={fetchDashboard}>Retry</Button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Offerwall Analytics</h2>
        <p className="text-sm text-muted-foreground">
          Tap any tile for a chart over time plus the full who-and-when detail. Each group has its own time window.
        </p>
        {/* Legend */}
        <div className="flex items-center gap-4 mt-2 text-xs">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-purple-500 inline-block" /> Key metric</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-300 inline-block" /> Secondary</span>
          <span className="flex items-center gap-1 text-rose-500">○ Live (last 10 min)</span>
          <span className="flex items-center gap-1 text-amber-500">○ Recent (≤1h)</span>
          <span className="flex items-center gap-1">● Needs attention</span>
        </div>
      </div>

      {/* Sections */}
      {Object.entries(SECTION_TILES).map(([sectionKey, section]) => {
        const sectionData = (data as any)[sectionKey] || {};
        return (
          <div key={sectionKey}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-muted-foreground tracking-wide">{section.title}</h3>
              <Select
                value={sectionWindows[sectionKey]}
                onValueChange={(v) => setSectionWindows(prev => ({ ...prev, [sectionKey]: v as TimeWindow }))}
              >
                <SelectTrigger className="w-[140px] h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
              {section.tiles.map(tile => {
                const tileData: TileValue = sectionData[tile.key] || { value: 0, latest: null };
                const hasAttention = tile.needsAttention?.(tileData) || false;
                const ringCls = liveRingClass(tileData.latest);
                const borderCls = importanceBorder(tile.importance);

                return (
                  <div
                    key={tile.key}
                    className={`relative p-3 bg-white dark:bg-gray-900 rounded-lg border ${tile.noPopup ? '' : 'cursor-pointer hover:shadow-md'} 
                      transition-shadow ${borderCls} ${ringCls}`}
                    onClick={() => !tile.noPopup && openPopup(tile.key, tile.label)}
                  >
                    {hasAttention && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                    )}
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-xs opacity-60">{tile.icon}</span>
                      <span className="text-[11px] font-medium text-muted-foreground truncate">{tile.label}</span>
                    </div>
                    <div className="text-lg font-bold">
                      {formatValue(tileData.value, tile.format)}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {tileData.latest ? (
                        <span className={
                          liveRingClass(tileData.latest).includes('rose') ? 'text-rose-500 font-medium' :
                          liveRingClass(tileData.latest).includes('amber') ? 'text-amber-500' : ''
                        }>
                          ● {timeAgo(tileData.latest)}
                        </span>
                      ) : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Detail Popup — Full Page */}
      <Dialog open={popup.open} onOpenChange={(o) => setPopup(prev => ({ ...prev, open: o }))}>
        <DialogContent className="max-w-[95vw] w-full max-h-[92vh] h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="text-lg font-bold">{popup.label}</span>
              <div className="flex items-center gap-2">
                <Select value={popupWindow} onValueChange={(v) => { setPopupWindow(v as TimeWindow); setPopupPage(1); }}>
                  <SelectTrigger className="w-[150px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Search + Per Page */}
          <div className="flex items-center gap-2 mt-2">
            <Input
              placeholder="Quick search..."
              value={popupSearch}
              onChange={(e) => setPopupSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePopupSearch()}
              className="h-8 text-sm flex-1"
            />
            <Button size="sm" variant="outline" onClick={handlePopupSearch}>
              <Search className="h-3.5 w-3.5" />
            </Button>
            <Select value={String(popupPerPage)} onValueChange={(v) => { setPopupPerPage(Number(v)); setPopupPage(1); }}>
              <SelectTrigger className="w-[80px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Pie Charts (for answer_breakdown tile) */}
          {popupChartData.length > 0 && (
            <div className="flex-1 overflow-auto mt-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {popupChartData.map((chart: any, idx: number) => {
                  const COLORS = ['#8b5cf6', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#6366f1', '#ec4899', '#14b8a6', '#f97316', '#84cc16'];
                  return (
                    <div key={idx} className="border rounded-lg p-3 bg-white dark:bg-gray-900">
                      <h4 className="text-xs font-semibold mb-2 text-center truncate" title={chart.question}>
                        {chart.question}
                      </h4>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie
                            data={chart.data}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={60}
                            label={({ name, percentage }) => `${name} (${percentage}%)`}
                            labelLine={false}
                          >
                            {chart.data.map((_: any, i: number) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: any, name: any) => [`${value} responses`, name]} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="text-[10px] text-center text-muted-foreground mt-1">
                        {chart.total_responses} total responses
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Table */}
          <div className={`flex-1 overflow-auto mt-3 border rounded-md ${popupChartData.length > 0 ? 'hidden' : ''}`}>
            {popupLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : popupRows.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                No data found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {Object.keys(popupRows[0] || {}).filter(k => k !== 'id' && k !== 'answers' && k !== '_ts').map(col => (
                      <TableHead key={col} className="text-xs whitespace-nowrap sticky top-0 bg-background">
                        {col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {popupRows.map((row, idx) => {
                    const hasAnswers = Array.isArray(row.answers) && row.answers.length > 0;
                    return (
                      <React.Fragment key={row.id || idx}>
                        <TableRow 
                          className={hasAnswers ? 'cursor-pointer hover:bg-muted/50' : ''}
                          onClick={() => {
                            if (hasAnswers) {
                              const el = document.getElementById(`answers-${row.id || idx}`);
                              if (el) el.classList.toggle('hidden');
                            }
                          }}
                        >
                          {Object.entries(row).filter(([k]) => k !== 'id' && k !== 'answers' && k !== '_ts').map(([k, v]) => (
                            <TableCell key={k} className="text-xs py-2">
                              {k === 'date' && v ? new Date(v as string).toLocaleString() : 
                               typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—')}
                            </TableCell>
                          ))}
                        </TableRow>
                        {hasAnswers && (
                          <TableRow id={`answers-${row.id || idx}`} className="hidden">
                            <TableCell colSpan={Object.keys(row).filter(k => k !== 'id' && k !== 'answers' && k !== '_ts').length} className="bg-muted/30 p-3">
                              <div className="text-xs font-medium mb-2">Survey Responses:</div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                                {(row.answers as any[]).map((a: any, i: number) => (
                                  <div key={i} className="flex gap-2 text-xs py-1 border-b border-dashed last:border-0">
                                    <span className="font-medium text-muted-foreground min-w-[80px]">{a.question || `Q${i+1}`}:</span>
                                    <span>{a.answer || '—'}</span>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t">
            <span className="text-xs text-muted-foreground">
              Showing {((popupPage - 1) * popupPerPage) + 1}–{Math.min(popupPage * popupPerPage, popupTotal)} of {popupTotal} results
            </span>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" disabled={popupPage <= 1} onClick={() => setPopupPage(p => p - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs px-2">
                Page {popupPage} of {Math.ceil(popupTotal / popupPerPage) || 1}
              </span>
              <Button size="sm" variant="outline" disabled={popupPage >= Math.ceil(popupTotal / popupPerPage)} onClick={() => setPopupPage(p => p + 1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OfferwallAnalyticsDashboard;
