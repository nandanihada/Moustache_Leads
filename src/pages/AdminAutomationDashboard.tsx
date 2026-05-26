import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Zap, Clock, Settings, Users,
  BarChart3, RefreshCw, AlertCircle,
  CheckCircle, Play, Pause, Trash2,
  Eye, Loader2, ChevronDown, ChevronUp
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
  const [delayValue, setDelayValue] = useState<number>(5);
  const [delayUnit, setDelayUnit] = useState<'hours' | 'minutes' | 'days'>('hours');
  const [isSaving, setIsSaving] = useState(false);

  const { toast } = useToast();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [sendingOffersMap, setSendingOffersMap] = useState<Record<string, boolean>>({});
  const [expandedUserData, setExpandedUserData] = useState<{
    offerTargeting: any;
    automationQueueItem: any;
    verticalData: any[];
    loading: boolean;
  }>({
    offerTargeting: null,
    automationQueueItem: null,
    verticalData: [],
    loading: false
  });

  const handleToggleExpand = async (userId: string, username: string = '', email: string = '', forceReload = false) => {
    if (expandedUser === userId && !forceReload) {
      setExpandedUser(null);
      return;
    }
    
    setExpandedUser(userId);
    setExpandedUserData(prev => ({ ...prev, loading: true }));
    
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const u = queue.find(item => item._id === userId);
      const uName = username || u?.username || '';
      const uEmail = email || u?.email || '';

      const [intelRes, autoRes, signalsRes, viewsRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/inventory-matched-offers/${userId}`, { headers }).then(r => r.data).catch(() => ({})),
        axios.get(`${API_URL}/api/admin/automation/queue/${userId}`, { headers }).then(r => r.data).catch(() => ({ item: null })),
        axios.get(`${API_URL}/api/admin/user-signals/${userId}?username=${uName}&email=${uEmail}`, { headers }).then(r => r.data).catch(() => null),
        axios.get(`${API_URL}/api/admin/offer-views/${userId}`, { headers }).then(r => r.data).catch(() => ({ logs: [] }))
      ]);
      
      let currentSessionVerticals = [];
      if (viewsRes?.logs && viewsRes.logs.length > 0) {
        const verticalCounts: Record<string, number> = {};
        viewsRes.logs.forEach((log: any) => {
          const vertical = (log.vertical || 'Unknown').toLowerCase();
          verticalCounts[vertical] = (verticalCounts[vertical] || 0) + 1;
        });
        currentSessionVerticals = Object.keys(verticalCounts).map(name => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          value: verticalCounts[name]
        })).sort((a, b) => b.value - a.value).slice(0, 5);
      }
      
      const verticalData = currentSessionVerticals.length > 0 ? currentSessionVerticals : (signalsRes?.top_verticals?.length > 0 ? signalsRes.top_verticals : []);
      
      setExpandedUserData({
        offerTargeting: intelRes,
        automationQueueItem: autoRes.item,
        verticalData,
        loading: false
      });
    } catch (e) {
      console.error(e);
      setExpandedUserData(prev => ({ ...prev, loading: false }));
    }
  };

  const handleSendOffers = async (userId: string, offerIds: string[], sendVia: string = 'email', offerName?: string): Promise<boolean> => {
    if (!offerIds || offerIds.length === 0) {
      toast({ title: 'Error', description: 'No offers to process', variant: 'destructive' });
      return false;
    }
    
    setSendingOffersMap(prev => ({ ...prev, [userId]: true }));
    try {
      const token = localStorage.getItem('token');
      const payload = {
        user_ids: [userId],
        offer_ids: offerIds,
        send_via: sendVia,
        offer_name: offerName
      };
      
      await axios.post(`${API_URL}/api/admin/send-offers-flow`, payload, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      toast({ 
        title: sendVia === 'skip' ? 'Offer Skipped' : 'Offer Sent', 
        description: `Successfully processed offer for user.`
      });
      
      handleToggleExpand(userId, '', '', true);
      return true;
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to process offer action', variant: 'destructive' });
      return false;
    } finally {
      setSendingOffersMap(prev => ({ ...prev, [userId]: false }));
    }
  };

  const getQueueOffers = (offerTargeting: any, automationQueueItem: any, verticalData: any[]) => {
    if (!offerTargeting) return [];
    
    const categoryOffers: Record<string, any[]> = {
      queue: [],
      recommended_offers: [],
      most_approved: [],
      highly_clicked: [],
      requested_offers: [],
      newly_added: []
    };
    
    if (automationQueueItem && automationQueueItem.next_offers && automationQueueItem.next_offers.length > 0) {
      automationQueueItem.next_offers.forEach((o: any) => {
        const id = o.offer_id || o._id || o.id;
        if (id) {
          categoryOffers.queue.push({
            ...o,
            id: id,
            offer_id: id,
            source: 'Automation Queue',
            type: 'Primary',
            matchScore: 100,
            categoryKey: 'queue'
          });
        }
      });
    }
    
    const addSection = (sectionName: string, sourceLabel: string, baseScore: number, typeLabel: string) => {
      if (offerTargeting[sectionName] && Array.isArray(offerTargeting[sectionName])) {
        for (let idx = 0; idx < offerTargeting[sectionName].length; idx++) {
          const o = offerTargeting[sectionName][idx];
          const id = o.offer_id || o._id || o.id;
          if (id) {
            let matchScore = Math.max(50, baseScore - (idx * 4));
            if (verticalData && verticalData.length > 0) {
              const topCats = verticalData.slice(0, 2).map((v: any) => (v.name || '').toLowerCase());
              const offerCat = (o.category || '').toLowerCase();
              if (offerCat && topCats.includes(offerCat)) {
                matchScore = Math.min(99, matchScore + 15);
              }
            }
            categoryOffers[sectionName].push({
              ...o,
              id: id,
              offer_id: id,
              source: sourceLabel,
              type: typeLabel,
              matchScore: matchScore,
              categoryKey: sectionName
            });
          }
        }
      }
    };
    
    addSection('recommended_offers', 'Recommended', 99, 'Discount');
    addSection('most_approved', 'Most Approved', 98, 'Cashback');
    addSection('highly_clicked', 'Most Clicked', 87, 'Cashback');
    addSection('requested_offers', 'Requested', 85, 'Discount');
    addSection('newly_added', 'Newly Added', 91, 'Cashback');
    
    // Select unique offers round-robin
    const finalOffers: any[] = [];
    const seenIds = new Set();
    const orderOfCategories = ['queue', 'recommended_offers', 'most_approved', 'highly_clicked', 'requested_offers', 'newly_added'];

    // Round 1: Try to pick the first unused offer from each category
    orderOfCategories.forEach((catKey) => {
      const list = categoryOffers[catKey];
      const unusedOffer = list.find(o => !seenIds.has(o.id));
      if (unusedOffer) {
        seenIds.add(unusedOffer.id);
        finalOffers.push(unusedOffer);
      }
    });

    // Round 2: Fill up to 6 unique offers from any category
    if (finalOffers.length < 6) {
      for (const catKey of orderOfCategories) {
        const list = categoryOffers[catKey];
        for (const o of list) {
          if (!seenIds.has(o.id)) {
            seenIds.add(o.id);
            finalOffers.push(o);
            if (finalOffers.length >= 6) break;
          }
        }
        if (finalOffers.length >= 6) break;
      }
    }
    
    return finalOffers.slice(0, 6);
  };

  useEffect(() => {
    if (settings) {
      const hours = settings.initial_delay_hours ?? 5;
      if (hours >= 24 && hours % 24 === 0) {
        setDelayValue(hours / 24);
        setDelayUnit('days');
      } else if (hours % 1 !== 0) {
        setDelayValue(Math.round(hours * 60));
        setDelayUnit('minutes');
      } else {
        setDelayValue(hours);
        setDelayUnit('hours');
      }
    }
  }, [settings]);

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
    setIsSaving(true);
    try {
      const token = localStorage.getItem('token');
      
      let computedHours = delayValue;
      if (delayUnit === 'minutes') {
        computedHours = parseFloat((delayValue / 60).toFixed(4));
      } else if (delayUnit === 'days') {
        computedHours = delayValue * 24;
      }
      
      const updatedSettings = {
        ...settings,
        initial_delay_hours: computedHours
      };

      await axios.post(`${API_URL}/api/admin/automation/settings`, updatedSettings, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast({ title: "Success", description: "Automation settings updated" });
      await loadData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to update settings", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const renderOfferQueue = (userId: string) => {
    if (expandedUserData.loading) {
      return (
        <div className="flex items-center justify-center py-6 gap-2 text-slate-500 text-xs">
          <Loader2 className="animate-spin text-indigo-600" size={16} />
          Loading matched offers...
        </div>
      );
    }
    
    if (!expandedUserData.offerTargeting) {
      return <div className="text-center py-6 text-slate-400 text-xs">No matched offers found for this user.</div>;
    }
    
    const queueOffers = getQueueOffers(expandedUserData.offerTargeting, expandedUserData.automationQueueItem, expandedUserData.verticalData);
    
    const grouped: Record<string, any[]> = {
      queue: [],
      recommended_offers: [],
      most_approved: [],
      highly_clicked: [],
      requested_offers: [],
      newly_added: []
    };
    
    queueOffers.forEach(o => {
      const key = o.categoryKey || 'recommended_offers';
      if (key === 'queue') grouped.queue.push(o);
      else if (key === 'recommended_offers' || key === 'recently_edited') grouped.recommended_offers.push(o);
      else if (key === 'most_approved') grouped.most_approved.push(o);
      else if (key === 'highly_clicked') grouped.highly_clicked.push(o);
      else if (key === 'requested_offers' || key === 'recently_deleted') grouped.requested_offers.push(o);
      else if (key === 'newly_added') grouped.newly_added.push(o);
      else grouped.recommended_offers.push(o);
    });

    const getStyles = (k: string) => {
      switch(k) {
        case 'queue': return { label: 'Active Queue Offers', color: '#7F2FBE', bg: '#F4F0FA', border: '#DEDAF4', icon: '⚡' };
        case 'recommended_offers': return { label: 'Recommended Offers', color: '#534AB7', bg: '#F4F0FA', border: '#DEDAF4', icon: '🛍️' };
        case 'most_approved': return { label: 'Most Approved Offers', color: '#1D9E75', bg: '#E1F5EE', border: '#CBEFE3', icon: '✅' };
        case 'highly_clicked': return { label: 'Most Clicked Offers', color: '#BA7517', bg: '#F9F1E6', border: '#F2E2CD', icon: '🔥' };
        case 'requested_offers': return { label: 'Requested Offers', color: '#A32D2D', bg: '#FDF0F0', border: '#F9DCDD', icon: '🙋' };
        case 'newly_added': return { label: 'Newly Added Offers', color: '#185FA5', bg: '#EBF2FB', border: '#D0E1F4', icon: '🆕' };
        default: return { label: 'Other Offers', color: '#64748B', bg: '#F1F5F9', border: '#E2E8F0', icon: '🎯' };
      }
    };

    const isProcessing = sendingOffersMap[userId];

    return (
      <div className="space-y-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100/80">
        <div className="flex justify-between items-center px-1">
          <div className="text-[11px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-1.5">
            <Zap size={12} className="text-amber-500 fill-amber-500" /> Offer Queue
          </div>
          <span className="text-[10px] text-slate-500 font-bold bg-white px-2 py-0.5 rounded-full border shadow-sm">{queueOffers.length} offers</span>
        </div>
        <div className="flex flex-col gap-2">
          {queueOffers.length === 0 ? (
            <div className="p-4 border border-dashed border-slate-200 rounded-xl bg-white/50 text-xs text-slate-400 italic text-center">
              No offers in queue.
            </div>
          ) : (
            queueOffers.map(offer => {
              const getStyles = (k: string) => {
                switch(k) {
                  case 'queue': return { label: 'Active Queue', color: '#7F2FBE', bg: '#F4F0FA', border: '#DEDAF4', icon: '⚡' };
                  case 'recommended_offers': return { label: 'Recommended', color: '#534AB7', bg: '#F4F0FA', border: '#DEDAF4', icon: '🛍️' };
                  case 'most_approved': return { label: 'Most Approved', color: '#1D9E75', bg: '#E1F5EE', border: '#CBEFE3', icon: '✅' };
                  case 'highly_clicked': return { label: 'Most Clicked', color: '#BA7517', bg: '#F9F1E6', border: '#F2E2CD', icon: '🔥' };
                  case 'requested_offers': return { label: 'Requested', color: '#A32D2D', bg: '#FDF0F0', border: '#F9DCDD', icon: '🙋' };
                  case 'newly_added': return { label: 'Newly Added', color: '#185FA5', bg: '#EBF2FB', border: '#D0E1F4', icon: '🆕' };
                  default: return { label: 'Recommended', color: '#534AB7', bg: '#F4F0FA', border: '#DEDAF4', icon: '🎯' };
                }
              };

              const catKey = offer.categoryKey || 'recommended_offers';
              const styles = getStyles(catKey);

              const category = (offer.category || 'General').toUpperCase();
              const country = offer.country || (offer.countries && offer.countries.length > 0 ? offer.countries[0] : 'Global');
              const type = offer.type || 'Cashback';
              const source = styles.label;

              return (
                <div key={offer.offer_id || offer._id} className="flex items-center justify-between p-2.5 border border-slate-100 rounded-xl bg-white shadow-sm hover:border-slate-200 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs flex-shrink-0 font-bold" style={{ background: styles.bg, color: styles.color }}>
                      {offer.category === 'E-commerce' ? '🛍️' : offer.category === 'Travel' ? '✈️' : offer.category === 'Games' ? '🎮' : offer.category === 'Finance' ? '🏦' : '🎯'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-slate-800 truncate max-w-[280px]">{offer.name || offer.offer_name || 'Offer'}</div>
                      <div className="text-[9px] text-slate-400 font-bold mt-0.5 flex items-center gap-1.5">
                        <span>{category}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                        <span>{country}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                        <span>{type}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                        <span>{source}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: '#E1F5EE', color: '#1D9E75' }}>
                      {offer.matchScore || 90}% match
                    </span>
                    <div className="flex gap-1">
                      <Button 
                        size="sm" 
                        className="h-6 px-2 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg"
                        disabled={isProcessing}
                        onClick={() => handleSendOffers(userId, [offer.offer_id || offer._id], 'email', offer.name || offer.offer_name)}
                      >
                        Send now
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="h-6 px-2 text-[10px] font-bold border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg"
                        disabled={isProcessing}
                        onClick={() => handleSendOffers(userId, [offer.offer_id || offer._id], 'skip', offer.name || offer.offer_name)}
                      >
                        Skip
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
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
                  <label className="text-sm font-medium">Initial Delay</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={delayValue}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDelayValue(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="flex-1"
                    />
                    <Select value={delayUnit} onValueChange={(val: 'hours' | 'minutes' | 'days') => setDelayUnit(val)}>
                      <SelectTrigger className="w-[110px] bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minutes">Minutes</SelectItem>
                        <SelectItem value="hours">Hours</SelectItem>
                        <SelectItem value="days">Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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

              <Button 
                className="w-full bg-slate-900 hover:bg-slate-800" 
                disabled={isSaving} 
                onClick={handleUpdateSettings}
              >
                {isSaving ? 'Applying...' : 'Apply Configuration'}
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
                  ) : queue.map(item => {
                    const isExpanded = expandedUser === item._id;
                    return (
                      <React.Fragment key={item._id}>
                        <tr className={`hover:bg-slate-50/50 transition-colors ${isExpanded ? 'bg-indigo-50/20' : ''}`}>
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
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className={`h-8 w-8 p-0 transition-colors ${isExpanded ? 'text-indigo-600 hover:text-indigo-700 bg-indigo-50' : 'text-slate-400 hover:text-indigo-600'}`}
                                onClick={() => handleToggleExpand(item._id, item.username, item.email)}
                                title="View Offer Queue"
                              >
                                <Eye size={16} />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600"><Trash2 size={16} /></Button>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-600"><Pause size={16} /></Button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={5} className="p-4 bg-slate-50/50 border-t border-b border-indigo-100/50">
                              {renderOfferQueue(item._id)}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
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
