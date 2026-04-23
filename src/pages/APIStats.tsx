import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE_URL } from '@/services/apiConfig';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Activity, MousePointerClick, BarChart3, TrendingUp } from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer 
} from 'recharts';

interface ApiStat {
  _id: string;
  api_key_id: string;
  click: number; // typo fix handling
  clicks?: number;
  impressions: number;
  date: string;
  traffic_source: string;
  device_type: string;
  key_name: string;
}

const APIStats = () => {
  const { token } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<ApiStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    
    fetch(`${API_BASE_URL}/v1/report/stats`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setStats(data.stats || []);
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    })
    .catch(err => console.error(err))
    .finally(() => setLoading(false));
  }, [token, toast]);

  // Aggregate metrics
  const totalClicks = stats.reduce((acc, curr) => acc + (curr.clicks || curr.click || 0), 0);
  const totalImpressions = stats.reduce((acc, curr) => acc + (curr.impressions || 0), 0);
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0.00";

  // Group by date for chart
  const chartData = useMemo(() => {
    const grouped: Record<string, any> = {};
    stats.forEach(stat => {
      if (!grouped[stat.date]) {
        grouped[stat.date] = { date: stat.date, clicks: 0, impressions: 0 };
      }
      grouped[stat.date].clicks += (stat.clicks || stat.click || 0);
      grouped[stat.date].impressions += (stat.impressions || 0);
    });
    // Convert to sorted array
    return Object.values(grouped).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [stats]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading API statistics...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">API Statistics</h1>
        <p className="text-slate-500">Monitor clicks and impressions from your API keys</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
            <MousePointerClick className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClicks.toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Impressions</CardTitle>
            <Activity className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalImpressions.toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average CTR</CardTitle>
            <TrendingUp className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ctr}%</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Traffic Overview</CardTitle>
          <CardDescription>Daily performance of clicks and impressions via API</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#cbd5e1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#cbd5e1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="impressions" stroke="#94a3b8" fillOpacity={1} fill="url(#colorImpressions)" />
                  <Area type="monotone" dataKey="clicks" stroke="#6366f1" fillOpacity={1} fill="url(#colorClicks)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[350px] w-full flex items-center justify-center flex-col text-slate-400">
              <BarChart3 className="w-12 h-12 mb-4 opacity-20" />
              <p>No traffic data available yet. Start sending events to your API.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 bg-slate-50 uppercase border-b">
              <tr>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">API Key</th>
                <th className="px-6 py-4 font-semibold">Source</th>
                <th className="px-6 py-4 font-semibold">Device</th>
                <th className="px-6 py-4 font-semibold text-right">Impressions</th>
                <th className="px-6 py-4 font-semibold text-right">Clicks</th>
              </tr>
            </thead>
            <tbody>
              {stats.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    No records found
                  </td>
                </tr>
              ) : (
                stats.map((stat, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-slate-50/50">
                    <td className="px-6 py-4">{stat.date}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{stat.key_name}</td>
                    <td className="px-6 py-4">{stat.traffic_source}</td>
                    <td className="px-6 py-4 capitalize">{stat.device_type}</td>
                    <td className="px-6 py-4 text-right text-slate-600">{stat.impressions}</td>
                    <td className="px-6 py-4 text-right font-medium text-indigo-600">{stat.clicks || stat.click || 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default APIStats;
