import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE_URL } from '@/services/apiConfig';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart as BarChartIcon, DollarSign, CheckCircle2 } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer 
} from 'recharts';

interface ApiConversion {
  _id: string;
  api_key_id: string;
  order_id?: string;
  click_id?: string;
  payout: number;
  status: string;
  created_at?: string;
  timestamp?: string;
  key_name: string;
}

const APIConversions = () => {
  const { token } = useAuth();
  const { toast } = useToast();
  const [conversions, setConversions] = useState<ApiConversion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    
    fetch(`${API_BASE_URL}/v1/report/conversions`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setConversions(data.conversions || []);
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    })
    .catch(err => console.error(err))
    .finally(() => setLoading(false));
  }, [token, toast]);

  // KPIs
  const totalConversions = conversions.length;
  const totalRevenue = conversions.reduce((acc, curr) => acc + (curr.payout || 0), 0);
  const approvedConversions = conversions.filter(c => c.status === 'approved').length;

  // Chart data grouping by day
  const chartData = React.useMemo(() => {
    const grouped: Record<string, any> = {};
    conversions.forEach(c => {
      const dateStr = new Date(c.created_at || c.timestamp || Date.now()).toLocaleDateString();
      if (!grouped[dateStr]) grouped[dateStr] = { date: dateStr, payout: 0, count: 0 };
      grouped[dateStr].payout += (c.payout || 0);
      grouped[dateStr].count += 1;
    });
    return Object.values(grouped);
  }, [conversions]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading API conversions...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">API Conversions</h1>
        <p className="text-slate-500">Track orders and revenue generated via your API setup</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Conversions</CardTitle>
            <BarChartIcon className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalConversions.toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue Generated</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved Orders</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedConversions.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Revenue Timeline</CardTitle>
          <CardDescription>Daily payout value from API conversions</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }} barSize={32}>
                  <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <RechartsTooltip 
                    cursor={{fill: '#f1f5f9'}}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="payout" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[350px] w-full flex items-center justify-center flex-col text-slate-400">
              <DollarSign className="w-12 h-12 mb-4 opacity-20" />
              <p>No conversion data available yet. Start tracking orders via API.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm overflow-hidden">
         <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 bg-slate-50 uppercase border-b">
              <tr>
                <th className="px-6 py-4 font-semibold">Click / Order ID</th>
                <th className="px-6 py-4 font-semibold">Offer ID</th>
                <th className="px-6 py-4 font-semibold">Sub IDs</th>
                <th className="px-6 py-4 font-semibold">API Key</th>
                <th className="px-6 py-4 font-semibold">Timestamp</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Payout</th>
              </tr>
            </thead>
            <tbody>
              {conversions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    No conversion records found
                  </td>
                </tr>
              ) : (
                conversions.map((conv, i) => (
                  <tr key={conv._id} className="border-b last:border-0 hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-medium">{conv.order_id || conv.click_id || 'N/A'}</td>
                    <td className="px-6 py-4 text-pink-600 font-mono text-sm">{conv.offer_id || 'N/A'}</td>
                    <td className="px-6 py-4">
                      {conv.sub_ids ? [conv.sub_ids.s1, conv.sub_ids.s2, conv.sub_ids.s3, conv.sub_ids.s4, conv.sub_ids.s5].filter(Boolean).map((s, idx) => (
                        <span key={idx} className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded mr-1">s{idx+1}:{s}</span>
                      )) : <span className="text-slate-400 text-sm">--</span>}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{conv.key_name}</td>
                    <td className="px-6 py-4 text-slate-500">{new Date(conv.created_at || conv.timestamp || Date.now()).toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        conv.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                        conv.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {conv.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-600">
                      ${conv.payout?.toFixed(2)}
                    </td>
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

export default APIConversions;
