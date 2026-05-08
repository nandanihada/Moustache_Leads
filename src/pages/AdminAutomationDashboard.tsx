import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Zap, Clock, Settings, Users,
  BarChart3, RefreshCw, AlertCircle,
  CheckCircle, Play, Pause, Trash2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AdminPageGuard } from '@/components/AdminPageGuard';
import axios from 'axios';

interface AutomationSettings {
  enabled: boolean;
  initial_delay_hours: number;
  step_interval_minutes: number;
  cooldown_days: number;
}

interface QueueItem {
  _id: string;
  username: string;
  email: string;
  current_step: number;
  next_mail_time: string;
  queue_status: 'active' | 'completed' | 'paused';
  delivery_status: 'pending' | 'sent' | 'failed';
}

const AdminAutomationDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AutomationSettings>({
    enabled: true,
    initial_delay_hours: 5,
    step_interval_minutes: 200,
    cooldown_days: 7
  });
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState({ active: 0, completed: 0, failed: 0 });

  const { toast } = useToast();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      const [settingsRes, queueRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/automation/settings`, { headers }),
        axios.get(`${API_URL}/api/admin/automation/queue`, { headers })
      ]);

      setSettings(settingsRes.data.settings);
      setQueue(queueRes.data.queue);

      // Calculate stats
      const q = queueRes.data.queue;
      setStats({
        active: q.filter((i: QueueItem) => i.queue_status === 'active').length,
        completed: q.filter((i: QueueItem) => i.queue_status === 'completed').length,
        failed: q.filter((i: QueueItem) => i.delivery_status === 'failed').length
      });

    } catch (error) {
      console.error("Failed to load automation data", error);
      toast({ title: "Error", description: "Failed to load dashboard data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/api/admin/automation/settings`, settings, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast({ title: "Success", description: "Automation settings updated" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update settings", variant: "destructive" });
    }
  };

  return (
    <AdminPageGuard requiredTab="automation">
      <div className="min-h-screen bg-slate-50 p-4 md:p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Zap className="text-amber-500 fill-amber-500" size={32} />
              Automation Mail Engine
            </h1>
            <p className="text-slate-500">Manage background campaign cycles and queue status</p>
          </div>
          <Button onClick={loadData} variant="outline" className="bg-white">
            <RefreshCw size={16} className="mr-2" /> Refresh Queue
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Active Cycles</p>
                  <h3 className="text-2xl font-bold">{stats.active}</h3>
                </div>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Users size={20} /></div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Sent Today</p>
                  <h3 className="text-2xl font-bold">128</h3>
                </div>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><CheckCircle size={20} /></div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Failed Delivery</p>
                  <h3 className="text-2xl font-bold text-rose-600">{stats.failed}</h3>
                </div>
                <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><AlertCircle size={20} /></div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Next Batch</p>
                  <h3 className="text-2xl font-bold">14m</h3>
                </div>
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Clock size={20} /></div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-1 border-slate-200 shadow-sm h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings size={20} className="text-slate-400" />
                Global Settings
              </CardTitle>
              <CardDescription>Configure automation rules and intervals</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Engine Status</p>
                  <p className="text-xs text-slate-500">Enable or disable all cycles</p>
                </div>
                <Switch checked={settings.enabled} onCheckedChange={(val: boolean) => setSettings({ ...settings, enabled: val })} />
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Initial Delay (Hours)</label>
                  <Input
                    type="number"
                    value={settings.initial_delay_hours}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, initial_delay_hours: parseInt(e.target.value) })}
                  />
                  <p className="text-[10px] text-slate-400 italic">Wait time after first login/activity before starting Step 1</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Step Interval (Minutes)</label>
                  <Input
                    type="number"
                    value={settings.step_interval_minutes}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, step_interval_minutes: parseInt(e.target.value) })}
                  />
                  <p className="text-[10px] text-slate-400 italic">Time between consecutive steps (Default: 3h 20m = 200m)</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cooldown Period (Days)</label>
                  <Input
                    type="number"
                    value={settings.cooldown_days}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, cooldown_days: parseInt(e.target.value) })}
                  />
                  <p className="text-[10px] text-slate-400 italic">Wait time before a user can enter a new automation cycle</p>
                </div>
              </div>

              <Button className="w-full bg-slate-900 hover:bg-slate-800" onClick={handleUpdateSettings}>
                Apply Configuration
              </Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="border-b bg-white">
              <CardTitle>Live Automation Queue</CardTitle>
              <CardDescription>Currently active user campaign cycles</CardDescription>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase">User</th>
                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase text-center">Step</th>
                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase">Next Mail</th>
                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase">Status</th>
                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {queue.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-400">Queue is empty</td></tr>
                  ) : queue.map(item => (
                    <tr key={item._id} className="hover:bg-slate-50/50">
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900">{item.username}</span>
                          <span className="text-[11px] text-slate-500">{item.email}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <Badge variant="outline" className="bg-white border-slate-200 text-slate-600">
                          Step {item.current_step}/5
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <Clock size={12} className="text-slate-400" />
                          {item.next_mail_time ? new Date(item.next_mail_time).toLocaleString() : 'N/A'}
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge className={item.delivery_status === 'failed' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'} variant="outline">
                          {item.delivery_status || 'pending'}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600"><Trash2 size={16} /></Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-600"><Pause size={16} /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </AdminPageGuard>
  );
};

export default AdminAutomationDashboard;
