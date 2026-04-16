/**
 * Geo Analytics (Phase 4.14)
 * Clicks and conversions by country with bar charts and table.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DatePresets } from '@/components/reports/DatePresets';
import { geoApi, type GeoRow } from '@/services/trafficIntelligenceApi';
import { toast } from 'sonner';

export function GeoAnalytics() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<GeoRow[]>([]);
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date(); const ago = new Date(); ago.setDate(today.getDate() - 30);
    return { start: ago.toISOString().split('T')[0], end: today.toISOString().split('T')[0] };
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await geoApi.getAnalytics({ start_date: dateRange.start, end_date: dateRange.end, limit: 30 });
      if (res.success) setData(res.data);
    } catch { toast.error('Failed to load geo data'); }
    finally { setLoading(false); }
  }, [dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const top15 = data.slice(0, 15);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div><label className="text-xs font-medium">Start Date</label><Input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="w-40" /></div>
          <div><label className="text-xs font-medium">End Date</label><Input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="w-40" /></div>
          <DatePresets onPresetSelect={p => setDateRange({ start: p.start, end: p.end })} />
          <Button size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
        </div>
      </Card>

      {loading ? (
        <Card className="p-12 text-center text-muted-foreground">Loading geo data...</Card>
      ) : data.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">No geo data available.</Card>
      ) : (
        <>
          {/* Charts side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="text-sm font-medium mb-3">Top Countries by Clicks</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={top15} layout="vertical" margin={{ left: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="country" tick={{ fontSize: 11 }} width={50} />
                  <Tooltip />
                  <Bar dataKey="clicks" fill="#6366f1" name="Clicks" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card className="p-4">
              <h3 className="text-sm font-medium mb-3">Top Countries by Conversions</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={top15} layout="vertical" margin={{ left: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="country" tick={{ fontSize: 11 }} width={50} />
                  <Tooltip />
                  <Bar dataKey="conversions" fill="#10b981" name="Conversions" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Full Table */}
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Clicks</TableHead>
                    <TableHead>Conversions</TableHead>
                    <TableHead>CR%</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Fraud Clicks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((row, i) => (
                    <TableRow key={row.country}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{row.country}</TableCell>
                      <TableCell>{row.clicks.toLocaleString()}</TableCell>
                      <TableCell>{row.conversions.toLocaleString()}</TableCell>
                      <TableCell>{row.cr}%</TableCell>
                      <TableCell className="text-green-600">${row.revenue.toFixed(2)}</TableCell>
                      <TableCell className={row.fraud_clicks > 0 ? 'text-red-600' : ''}>{row.fraud_clicks}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
