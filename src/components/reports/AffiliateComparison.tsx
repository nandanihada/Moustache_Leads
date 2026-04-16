/**
 * Affiliate Comparison View (Phase 4.11)
 * Table of all affiliates ranked by clicks, conversions, CR%, revenue, fraud score.
 * Color-coded rows by segment. Bar chart of top affiliates.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DatePresets } from '@/components/reports/DatePresets';
import { affiliateApi, type AffiliateRow } from '@/services/trafficIntelligenceApi';
import { toast } from 'sonner';

const SEGMENT_COLORS: Record<string, string> = {
  GOOD: 'bg-green-100 text-green-800',
  AVERAGE: 'bg-gray-100 text-gray-800',
  SUSPICIOUS: 'bg-yellow-100 text-yellow-800',
  FRAUD: 'bg-red-100 text-red-800',
};

const ROW_COLORS: Record<string, string> = {
  GOOD: '',
  AVERAGE: '',
  SUSPICIOUS: 'bg-yellow-50 dark:bg-yellow-950/20',
  FRAUD: 'bg-red-50 dark:bg-red-950/20',
};

export function AffiliateComparison() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AffiliateRow[]>([]);
  const [sortBy, setSortBy] = useState('clicks');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date(); const ago = new Date(); ago.setDate(today.getDate() - 30);
    return { start: ago.toISOString().split('T')[0], end: today.toISOString().split('T')[0] };
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await affiliateApi.getComparison({ start_date: dateRange.start, end_date: dateRange.end, sort_by: sortBy, limit: 100 });
      if (res.success) setData(res.data);
    } catch { toast.error('Failed to load affiliate data'); }
    finally { setLoading(false); }
  }, [dateRange, sortBy]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sorted = [...data].sort((a, b) => {
    const aVal = (a as any)[sortBy] ?? 0;
    const bVal = (b as any)[sortBy] ?? 0;
    return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
  });

  const handleSort = (field: string) => {
    if (sortBy === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortOrder('desc'); }
  };

  const SortIcon = ({ field }: { field: string }) => sortBy === field ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />;

  const top10 = sorted.slice(0, 10).map(a => ({ name: a.name !== a.user_id ? a.name : (a.email ? a.email.split('@')[0] : a.user_id.slice(0, 10)), clicks: a.clicks, conversions: a.conversions }));

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div><label className="text-xs font-medium">Start Date</label><Input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="w-40" /></div>
          <div><label className="text-xs font-medium">End Date</label><Input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="w-40" /></div>
          <DatePresets onPresetSelect={p => setDateRange({ start: p.start, end: p.end })} />
          <div><label className="text-xs font-medium">Sort By</label><Select value={sortBy} onValueChange={v => setSortBy(v)}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="clicks">Clicks</SelectItem><SelectItem value="conversions">Conversions</SelectItem><SelectItem value="cr">CR%</SelectItem><SelectItem value="total_revenue">Revenue</SelectItem><SelectItem value="fraud_pct">Fraud %</SelectItem><SelectItem value="avg_fraud_score">Fraud Score</SelectItem></SelectContent></Select></div>
          <Button size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
        </div>
      </Card>

      {/* Top 10 Bar Chart */}
      {top10.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3">Top 10 Affiliates</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={top10}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={50} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="clicks" fill="#6366f1" name="Clicks" /><Bar dataKey="conversions" fill="#10b981" name="Conversions" /></BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Segment Legend */}
      <div className="flex items-center gap-4 px-1 text-xs">
        <span className="text-muted-foreground font-medium">Segments:</span>
        <Badge className={SEGMENT_COLORS.GOOD}>GOOD</Badge>
        <Badge className={SEGMENT_COLORS.AVERAGE}>AVERAGE</Badge>
        <Badge className={SEGMENT_COLORS.SUSPICIOUS}>SUSPICIOUS</Badge>
        <Badge className={SEGMENT_COLORS.FRAUD}>FRAUD</Badge>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          {loading ? <div className="text-center py-12 text-muted-foreground">Loading...</div> : sorted.length === 0 ? <div className="text-center py-12 text-muted-foreground">No affiliate data found.</div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Affiliate</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('clicks')}><div className="flex items-center gap-1">Clicks <SortIcon field="clicks" /></div></TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('conversions')}><div className="flex items-center gap-1">Conv <SortIcon field="conversions" /></div></TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('cr')}><div className="flex items-center gap-1">CR% <SortIcon field="cr" /></div></TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('total_revenue')}><div className="flex items-center gap-1">Revenue <SortIcon field="total_revenue" /></div></TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('avg_fraud_score')}><div className="flex items-center gap-1">Fraud Score <SortIcon field="avg_fraud_score" /></div></TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('fraud_pct')}><div className="flex items-center gap-1">Fraud % <SortIcon field="fraud_pct" /></div></TableHead>
                  <TableHead>Genuine</TableHead>
                  <TableHead>Suspicious</TableHead>
                  <TableHead>Fraud</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((a, i) => (
                  <TableRow key={a.user_id} className={ROW_COLORS[a.segment] || ''}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell><div className="font-medium text-sm">{a.name || a.user_id}</div>{a.email && <div className="text-xs text-muted-foreground">{a.email}</div>}</TableCell>
                    <TableCell><Badge className={`text-xs ${SEGMENT_COLORS[a.segment] || SEGMENT_COLORS.AVERAGE}`}>{a.segment}</Badge></TableCell>
                    <TableCell className="font-medium">{a.clicks.toLocaleString()}</TableCell>
                    <TableCell>{a.conversions.toLocaleString()}</TableCell>
                    <TableCell>{a.cr}%</TableCell>
                    <TableCell className="text-green-600 font-medium">${a.total_revenue.toFixed(2)}</TableCell>
                    <TableCell><span className={`font-bold ${a.avg_fraud_score >= 70 ? 'text-red-600' : a.avg_fraud_score >= 30 ? 'text-yellow-600' : 'text-green-600'}`}>{a.avg_fraud_score}</span></TableCell>
                    <TableCell><span className={a.fraud_pct > 30 ? 'text-red-600 font-bold' : ''}>{a.fraud_pct}%</span></TableCell>
                    <TableCell className="text-green-600">{a.genuine_clicks}</TableCell>
                    <TableCell className="text-yellow-600">{a.suspicious_clicks}</TableCell>
                    <TableCell className="text-red-600">{a.fraud_clicks}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>
    </div>
  );
}
