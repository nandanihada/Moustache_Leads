import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE_URL } from '@/services/apiConfig';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { KeyRound, Activity, Users, Zap } from 'lucide-react';

interface ApiKeyAdmin {
  key_id: string;
  key_name: string;
  status: string;
  created_at: string;
  username: string;
  company_name: string;
}

interface ApiStatAdmin {
  stat_id: string;
  api_key_id: string;
  key_name: string;
  username: string;
  company_name: string;
  date: string;
  clicks: number;
  impressions: number;
  revenue: number;
  leads: number;
}

const AdminApiStats = () => {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKeyAdmin[]>([]);
  const [stats, setStats] = useState<ApiStatAdmin[]>([]);
  const [loading, setLoading] = useState(true);

  if (!user || (user.role !== 'admin' && user.role !== 'subadmin')) {
    return <div className="p-8 text-slate-500">Access Denied. Admins only.</div>;
  }

  useEffect(() => {
    if (!token) return;
    
    fetch(`${API_BASE_URL}/v1/admin/report/stats`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setKeys(data.api_keys || []);
        setStats(data.stats || []);
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    })
    .catch(err => console.error(err))
    .finally(() => setLoading(false));
  }, [token, toast]);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading Admin API Statistics...</div>;

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">API Access & Statistics Hub</h1>
          <p className="text-slate-500">Monitor publisher API usage, key generation, and active traffic globally.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total API Keys</CardTitle>
              <KeyRound className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{keys.length}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Publishers</CardTitle>
              <Users className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{new Set(keys.map(k => k.username)).size}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Global API Clicks</CardTitle>
              <Zap className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.reduce((acc, curr) => acc + curr.clicks, 0).toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Global API Leads</CardTitle>
              <Activity className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.reduce((acc, curr) => acc + curr.leads, 0).toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Generated Keys Section */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Generated API Keys</CardTitle>
            <CardDescription>Who generated keys and when.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 bg-slate-50 uppercase border-b">
                <tr>
                  <th className="px-6 py-4">Publisher</th>
                  <th className="px-6 py-4">Company</th>
                  <th className="px-6 py-4">Key Name</th>
                  <th className="px-6 py-4">Created Date</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-medium text-slate-800">{k.username}</td>
                    <td className="px-6 py-4">{k.company_name}</td>
                    <td className="px-6 py-4 text-indigo-600 font-mono text-xs">{k.key_name}</td>
                    <td className="px-6 py-4">{k.created_at}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${k.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{k.status}</span>
                    </td>
                  </tr>
                ))}
                {keys.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-slate-400">No keys generated yet.</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Global Usage Section */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>API Traffic Monitor</CardTitle>
            <CardDescription>Who used links via API and their performance.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 bg-slate-50 uppercase border-b">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Publisher</th>
                  <th className="px-6 py-4">Key Name</th>
                  <th className="px-6 py-4 text-right">Clicks</th>
                  <th className="px-6 py-4 text-right">Leads</th>
                  <th className="px-6 py-4 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {stats.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((s, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-slate-50/50">
                    <td className="px-6 py-4">{s.date}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{s.username}</td>
                    <td className="px-6 py-4 text-indigo-600 font-mono text-xs">{s.key_name}</td>
                    <td className="px-6 py-4 text-right font-medium text-slate-600">{s.clicks.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-medium text-emerald-600">{s.leads.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-bold text-slate-800">${s.revenue.toFixed(2)}</td>
                  </tr>
                ))}
                {stats.length === 0 && <tr><td colSpan={6} className="text-center py-6 text-slate-400">No traffic logged via API yet.</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
  );
};

export default AdminApiStats;
