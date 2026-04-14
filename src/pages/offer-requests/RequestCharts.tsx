import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';
import { API_BASE_URL } from '@/services/apiConfig';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';

interface FunnelData { sent: number; clicked: number; applied: number; approved: number }
interface TrendPoint { date: string; requests: number }
interface NetworkStat { network: string; approved: number; rejected: number; pending: number; total: number }
interface ChartsData { funnel: FunnelData; trend: TrendPoint[]; network_stats: NetworkStat[] }

export default function RequestCharts() {
  const [data, setData] = useState<ChartsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!expanded || data) return;
    setLoading(true);
    fetch(`${API_BASE_URL}/api/admin/offer-access-requests/charts-data`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [expanded]);

  const funnelBars = data ? [
    { name: 'Emails Sent', value: data.funnel.sent, color: '#6366f1' },
    { name: 'Clicked (verified)', value: data.funnel.clicked, color: '#3b82f6' },
    { name: 'Applied', value: data.funnel.applied, color: '#f59e0b' },
    { name: 'Approved', value: data.funnel.approved, color: '#10b981' },
  ] : [];

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        <BarChart3 className="h-4 w-4" /> Analytics Charts
      </button>

      {expanded && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Chart 1: Email Campaign Funnel */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Email Campaign Funnel (30d)</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">Loading...</div>
              ) : data ? (
                <div className="space-y-2">
                  {funnelBars.map((bar, i) => {
                    const maxVal = Math.max(...funnelBars.map(b => b.value), 1);
                    const pct = (bar.value / maxVal) * 100;
                    return (
                      <div key={bar.name} className="space-y-0.5">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-muted-foreground">{bar.name}</span>
                          <span className="font-medium">{bar.value.toLocaleString()}</span>
                        </div>
                        <div className="h-5 bg-muted/50 rounded-sm overflow-hidden">
                          <div
                            className="h-full rounded-sm transition-all duration-500"
                            style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: bar.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {data.funnel.sent > 0 && (
                    <div className="flex gap-2 mt-2 text-[10px] text-muted-foreground">
                      <Badge variant="outline" className="text-[9px]">
                        Click Rate {((data.funnel.clicked / Math.max(data.funnel.sent, 1)) * 100).toFixed(1)}%
                      </Badge>
                      <Badge variant="outline" className="text-[9px]">
                        Apply Rate {((data.funnel.applied / Math.max(data.funnel.sent, 1)) * 100).toFixed(1)}%
                      </Badge>
                      <Badge variant="outline" className="text-[9px]">
                        Approval {((data.funnel.approved / Math.max(data.funnel.applied, 1)) * 100).toFixed(1)}%
                      </Badge>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">No data</div>
              )}
            </CardContent>
          </Card>

          {/* Chart 2: Request Trend (30 days) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Request Trend (30d)</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">Loading...</div>
              ) : data && data.trend.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={data.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={v => v.slice(5)} />
                    <YAxis tick={{ fontSize: 9 }} width={30} />
                    <Tooltip contentStyle={{ fontSize: 11 }} labelFormatter={v => `Date: ${v}`} />
                    <Area type="monotone" dataKey="requests" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">No data</div>
              )}
            </CardContent>
          </Card>

          {/* Chart 5: Approval Rate by Network */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Approval by Network</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">Loading...</div>
              ) : data && data.network_stats.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data.network_stats} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 9 }} />
                    <YAxis dataKey="network" type="category" tick={{ fontSize: 9 }} width={80} />
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="approved" stackId="a" fill="#10b981" name="Approved" />
                    <Bar dataKey="rejected" stackId="a" fill="#ef4444" name="Rejected" />
                    <Bar dataKey="pending" stackId="a" fill="#f59e0b" name="Pending" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">No data</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
