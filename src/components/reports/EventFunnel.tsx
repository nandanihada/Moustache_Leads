/**
 * Event Funnel Visualization (Phase 4.13)
 * Shows: Clicks → Installs → Signups → FTDs → Purchases
 * with counts, drop-off rates, and revenue at each stage.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, TrendingDown, DollarSign, MousePointerClick, Download, UserPlus, CreditCard, ShoppingCart } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DatePresets } from '@/components/reports/DatePresets';
import { funnelApi, type FunnelSummary } from '@/services/trafficIntelligenceApi';
import { toast } from 'sonner';

const FUNNEL_COLORS = ['#6366f1', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'];
const FUNNEL_ICONS = [MousePointerClick, Download, UserPlus, CreditCard, ShoppingCart];

export function EventFunnel() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<FunnelSummary | null>(null);
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date(); const ago = new Date(); ago.setDate(today.getDate() - 30);
    return { start: ago.toISOString().split('T')[0], end: today.toISOString().split('T')[0] };
  });
  const [filters, setFilters] = useState<Record<string, string | undefined>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await funnelApi.getSummary({ ...filters, start_date: dateRange.start, end_date: dateRange.end });
      if (res.success) setData(res.data);
    } catch { toast.error('Failed to load funnel data'); }
    finally { setLoading(false); }
  }, [dateRange, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stages = data ? [
    { name: 'Clicks', count: data.clicks, rate: 100, revenue: 0, color: FUNNEL_COLORS[0] },
    { name: 'Installs', count: data.install, rate: data.install_rate, revenue: data.install_revenue, color: FUNNEL_COLORS[1] },
    { name: 'Signups', count: data.signup, rate: data.signup_rate, revenue: data.signup_revenue, color: FUNNEL_COLORS[2] },
    { name: 'FTDs', count: data.ftd, rate: data.ftd_rate, revenue: data.ftd_revenue, color: FUNNEL_COLORS[3] },
    { name: 'Purchases', count: data.purchase, rate: data.purchase_rate, revenue: data.purchase_revenue, color: FUNNEL_COLORS[4] },
  ] : [];

  const chartData = stages.map(s => ({ name: s.name, count: s.count }));

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div><label className="text-xs font-medium">Start Date</label><Input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="w-40" /></div>
          <div><label className="text-xs font-medium">End Date</label><Input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="w-40" /></div>
          <DatePresets onPresetSelect={p => setDateRange({ start: p.start, end: p.end })} />
          <div><label className="text-xs font-medium">Offer ID</label><Input placeholder="e.g. ML-00065" value={filters.offer_id || ''} onChange={e => setFilters(prev => ({ ...prev, offer_id: e.target.value || undefined }))} className="w-36" /></div>
          <div><label className="text-xs font-medium">User ID</label><Input placeholder="Publisher ID" value={filters.user_id || ''} onChange={e => setFilters(prev => ({ ...prev, user_id: e.target.value || undefined }))} className="w-36" /></div>
          <div><label className="text-xs font-medium">Campaign</label><Input placeholder="CAMP-xxx" value={filters.campaign_id || ''} onChange={e => setFilters(prev => ({ ...prev, campaign_id: e.target.value || undefined }))} className="w-36" /></div>
          <Button size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
        </div>
      </Card>

      {loading ? (
        <Card className="p-12 text-center text-muted-foreground">Loading funnel data...</Card>
      ) : !data ? (
        <Card className="p-12 text-center text-muted-foreground">No funnel data available for this period.</Card>
      ) : (
        <>
          {/* Funnel Stages */}
          <div className="grid grid-cols-5 gap-3">
            {stages.map((stage, i) => {
              const Icon = FUNNEL_ICONS[i];
              const dropOff = i > 0 ? stages[i - 1].count - stage.count : 0;
              const dropPct = i > 0 && stages[i - 1].count > 0 ? ((dropOff / stages[i - 1].count) * 100).toFixed(1) : '0';
              return (
                <Card key={stage.name} className="p-4 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: stage.color }} />
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-4 w-4" style={{ color: stage.color }} />
                    <span className="text-sm font-medium">{stage.name}</span>
                  </div>
                  <div className="text-2xl font-bold">{stage.count.toLocaleString()}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-muted-foreground">{stage.rate}% of clicks</span>
                    {stage.revenue > 0 && <Badge variant="outline" className="text-xs text-green-600">${stage.revenue.toFixed(2)}</Badge>}
                  </div>
                  {i > 0 && dropOff > 0 && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-red-500">
                      <TrendingDown className="h-3 w-3" />
                      <span>-{dropOff.toLocaleString()} ({dropPct}% drop)</span>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Funnel Bar Chart */}
          <Card className="p-4">
            <h3 className="text-sm font-medium mb-3">Event Funnel</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => value.toLocaleString()} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill={FUNNEL_COLORS[i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}
    </div>
  );
}
