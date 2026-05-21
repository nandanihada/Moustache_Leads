import React, { useEffect, useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'; // hmr-trigger-1
import { Button } from '@/components/ui/button'; // hmr-trigger-2
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Zap, Clock, Send, Mail, ShieldCheck, RefreshCw, X, Search, Filter, MoreVertical, SkipForward, RotateCcw, Pause, Play, AlertCircle, CheckCircle2, Eye, Edit3, CalendarClock, Trash2, LayoutDashboard, ListTodo, Package } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { offerQueueService, OfferQueueItem } from '@/services/offerQueueService';
import { Checkbox } from '@/components/ui/checkbox';
import AutomationSendNowModal from './AutomationSendNowModal';

export interface AutomationQueueItem {
  user_id: string;
  username: string;
  queue_status: 'active' | 'completed' | 'paused' | 'removed';
  current_step: number;
  next_mail_time: string;
  cooldown_until: string;
  delivery_status: 'pending' | 'sent' | 'failed';
  last_login?: string;
  activity_type?: string;
  matched_verticals?: string[];
  next_offers?: {
    id: string;
    name: string;
    payout: number;
    payout_display?: string;
    category: string;
    countries: string[];
  }[];
  sent_history?: {
    id: string;
    name: string;
    payout: number;
    payout_display?: string;
    category: string;
    countries: string[];
    network: string;
  }[];
  custom_subject?: string;
  custom_message?: string;
  is_authorized?: boolean;
}

export const AutomationQueueDashboardModal: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiUrl: string;
  allUsers?: any[];
}> = ({ open, onOpenChange, apiUrl, allUsers = [] }) => {
  const [queue, setQueue] = useState<AutomationQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'paused' | 'pending' | 'sent' | 'completed' | 'failed' | 'removed'>('all');
  const [recentOnly, setRecentOnly] = useState(false); // Default to false to ensure visibility of all cycles
  const [selectedQueueItem, setSelectedQueueItem] = useState<AutomationQueueItem | null>(null);
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [sendNowOpen, setSendNowOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [initialPreviewMode, setInitialPreviewMode] = useState(false);
  const [tick, setTick] = useState(0);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const [fetchingItem, setFetchingItem] = useState<string | null>(null);
  const [dashboardTab, setDashboardTab] = useState<'automation' | 'offers'>('automation');
  const [liveOfferQueue, setLiveOfferQueue] = useState<OfferQueueItem[]>([]);
  const [isProcessingOffers, setIsProcessingOffers] = useState(false);

  // Subscribe to Live Offer Queue
  useEffect(() => {
    const unsubscribe = offerQueueService.subscribe((q) => {
      setLiveOfferQueue(q);
      setIsProcessingOffers(offerQueueService.getIsProcessing());
    });
    return () => unsubscribe();
  }, []);

  const handleOfferAction = (id: string, action: 'pause' | 'resume' | 'remove') => {
    if (action === 'pause') offerQueueService.pauseItem(id);
    else if (action === 'resume') offerQueueService.resumeItem(id);
    else if (action === 'remove') offerQueueService.removeItem(id);
  };

  const handleRecalculate = (minutes: number) => {
    const nextItem = liveOfferQueue.find(q => q.status === 'queued');
    const startTime = nextItem ? nextItem.scheduledTime : Date.now();
    offerQueueService.recalculateAllPending(startTime, minutes);
    toast({ title: 'Interval Updated', description: `All pending offers rescheduled with ${minutes}m intervals.` });
  };

  const toggleQueue = () => {
    if (isProcessingOffers) {
      offerQueueService.pauseQueue();
      toast({ title: 'Queue Paused', description: 'No more automated sends will occur until resumed.' });
    } else {
      offerQueueService.resumeQueue();
      toast({ title: 'Queue Resumed', description: 'Resuming scheduled outreach.' });
    }
  };

  const loadQueue = async () => {
    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiUrl}/api/admin/automation/queue`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal
      });
      const data = await res.json();
      if (data.queue) {
        let finalQueue = data.queue;
        // Removed self-filter that was hiding other users from the admin view
        setQueue(finalQueue);
      }
    } catch (e) {
      if ((e as any).name === 'AbortError') {
        console.warn('Automation queue fetch timed out');
      }
      toast({ title: 'Error', description: 'Failed to load automation queue', variant: 'destructive' });
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const handleSync = async (forceReset: boolean = false) => {
    setSyncing(true);
    try {
      const token = localStorage.getItem('token');

      if (forceReset) {
        // Hard wipe before discovery
        await fetch(`${apiUrl}/api/admin/automation/purge`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }

      const userIds = allUsers.map(u => String(u.user_id)).filter(id => id && id !== 'undefined' && id !== 'null');

      const res = await fetch(`${apiUrl}/api/admin/automation/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          force_reset: forceReset,
          user_ids: userIds.length > 0 ? userIds : null
        })
      });
      const data = await res.json();
      toast({
        title: forceReset ? 'Clean Start Initialized' : 'Sync Complete',
        description: forceReset
          ? `System purged and ${data.count || 0} active users from your view synchronized.`
          : `Successfully added ${data.count || 0} active users to the flow.`
      });
      loadQueue();
    } catch (e) {
      toast({ title: 'Sync Error', description: 'Failed to sync active users', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const handlePurge = async () => {
    if (!window.confirm("CRITICAL WARNING: This will PERMANENTLY DELETE all user automation states, history, and stats. This cannot be undone. Wipe everything?")) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiUrl}/api/admin/automation/purge`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast({ title: 'System Purged', description: 'All automation data has been cleared.' });
        loadQueue();
      } else {
        toast({ title: 'Error', description: 'Failed to purge data', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };
  const handleOverride = async (userId: string, action: 'start' | 'pause' | 'resume' | 'complete' | 'reset' | 'skip' | 'remove' | 'restore' | 'delete_permanent' | 'pin' | 'save-content' | 'retry', step?: number | string, data?: any) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiUrl}/api/admin/automation/override`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: userId, action, step })
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Success', description: data.message });
        loadQueue();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to apply override', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    }
  };

  const fetchItemDetails = async (item: AutomationQueueItem, startInPreview: boolean = false) => {
    setFetchingItem(item.user_id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiUrl}/api/admin/automation/queue/${item.user_id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.item) {
        setSelectedQueueItem(data.item);
        setInitialPreviewMode(startInPreview);
        setSendNowOpen(true);
      } else {
        throw new Error('Item not found');
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to fetch item details', variant: 'destructive' });
      // Fallback: open with existing data
      setSelectedQueueItem(item);
      setSendNowOpen(true);
    } finally {
      setFetchingItem(null);
    }
  };

  useEffect(() => {
    if (open) {
      loadQueue();
      const interval = setInterval(() => {
        setTick(t => t + 1);
      }, 1000); // Ticking every second for high-precision countdown
      return () => clearInterval(interval);
    }
  }, [open]);

  const getCountdown = (target: string) => {
    if (!target) return '---';
    const diff = new Date(target).getTime() - new Date().getTime();
    if (diff <= 0) return 'Due Now';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

  const formatExactDate = (dateStr: string) => {
    if (!dateStr) return '---';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const mergedQueue = useMemo(() => {
    // START WITH A FILTERED VIEW: Only show users who are in the current dashboard view (Recent Activity)
    // This ensures parity between the main dashboard and the engine.
    const dashboardUserIds = new Set(allUsers.map(u => String(u.user_id)));
    
    // 1. Get users who are in BOTH the backend queue AND the current dashboard view
    const activeInView = queue.filter(q => dashboardUserIds.has(String(q.user_id)));
    
    // 2. Find users who are in the dashboard view but NOT YET in the backend queue (New Discoveries)
    const existingQueueIds = new Set(activeInView.map(q => String(q.user_id)));
    const newDiscoveries: any[] = [];
    
    allUsers.forEach(u => {
      // Filter out users who haven't completed signup / don't have an actual user account
      if (u.status === 'signup_started' || u.activity_type === 'Signup Started' || u.login_method === 'signup') {
        return;
      }
      
      const uId = String(u.user_id);
      if (!existingQueueIds.has(uId)) {
        newDiscoveries.push({
          user_id: uId,
          username: u.username || 'Unknown',
          queue_status: 'active',
          current_step: 0,
          next_mail_time: new Date().toISOString(),
          cooldown_until: '',
          delivery_status: 'pending',
          is_new_discovery: true,
          last_login: u.logs?.[0]?.login_time || new Date().toISOString()
        });
      }
    });

    return [...activeInView, ...newDiscoveries];
  }, [queue, allUsers]);

  const filteredQueue = useMemo(() => {
    return mergedQueue.filter(item => {
      const searchLower = (search || '').toLowerCase();
      const username = (item.username || '').toLowerCase();
      const userId = (item.user_id || '').toLowerCase();

      const matchesSearch = username.includes(searchLower) || userId.includes(searchLower);
      const matchesFilter = filter === 'all' ? (item.queue_status !== 'removed' || (item as any).is_new_discovery) :
        (filter === 'active' && item.queue_status === 'active') ||
        (filter === 'paused' && item.queue_status === 'paused') ||
        (filter === 'completed' && item.queue_status === 'completed') ||
        (filter === 'removed' && item.queue_status === 'removed') ||
        (filter === 'pending' && item.queue_status === 'active' && item.delivery_status === 'pending') ||
        (filter === 'sent' && item.queue_status !== 'removed' && (item.current_step || 0) > 0) ||
        (filter === 'failed' && item.delivery_status === 'failed' && item.queue_status !== 'removed');

      // Recent Activity Filter - Use a stable time reference to avoid jitter during polling
      const isReady = new Date(item.next_mail_time).getTime() <= Date.now();
      const lastLoginTime = item.last_login ? new Date(item.last_login).getTime() : 0;
      const isRecent = !recentOnly || isReady || (lastLoginTime > Date.now() - 36 * 60 * 60 * 1000);

      return matchesSearch && matchesFilter && isRecent;
    }).sort((a, b) => {
      // Sort by last login descending (most recent first)
      const timeA = new Date(a.last_login || 0).getTime();
      const timeB = new Date(b.last_login || 0).getTime();
      return timeB - timeA;
    });
  }, [queue, search, filter, recentOnly]);

  const getStepBadge = (step: number) => {
    if (step === 0) return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Delay Phase</Badge>;
    return <Badge variant="secondary" className="bg-indigo-100 text-indigo-700">Step {step}/5</Badge>;
  };

  const stats = useMemo(() => {
    // If we have a filtered list (mergedQueue), stats should reflect THAT list
    const source = mergedQueue;
    return {
      active: source.filter(q => q.queue_status === 'active' && q.delivery_status !== 'failed').length,
      completed: source.filter(q => q.queue_status === 'completed').length,
      totalDelivered: source.filter(q => q.queue_status !== 'removed').reduce((acc, q) => acc + (q.current_step || 0), 0),
      pendingNext: source.filter(q => q.queue_status === 'active' && q.delivery_status === 'pending').length,
      readyToSend: source.filter(q => q.queue_status === 'active' && new Date(q.next_mail_time).getTime() <= Date.now()).length,
      failed: source.filter(q => q.delivery_status === 'failed' && q.queue_status !== 'removed').length,
      paused: source.filter(q => q.queue_status === 'paused').length,
      removed: source.filter(q => q.queue_status === 'removed').length
    };
  }, [mergedQueue]);

  const bulkItems = useMemo(() => {
    return queue.filter(item => selectedIds.has(item.user_id));
  }, [queue, selectedIds]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-auto max-h-[92vh] min-h-[500px] flex flex-col p-0 overflow-hidden border border-slate-200 shadow-2xl rounded-2xl">
        <DialogHeader className="px-0 py-0 border-b bg-slate-50 shrink-0">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg">
                  <Zap size={20} className="fill-white" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">
                    {dashboardTab === 'automation' ? 'Automation Engine' : 'Offer Queue Control'}
                  </DialogTitle>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest opacity-70">
                    {dashboardTab === 'automation' ? 'Live Outreach Cycles' : 'Scheduled Individual Offers'}
                  </p>
                </div>
              </div>

              <div className="flex bg-slate-200/50 p-1 rounded-xl border border-slate-200/50">
                <button
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-black transition-all ${dashboardTab === 'automation' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  onClick={() => setDashboardTab('automation')}
                >
                  <LayoutDashboard size={14} />
                  AUTOMATION FLOW
                </button>
                <button
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-black transition-all ${dashboardTab === 'offers' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  onClick={() => setDashboardTab('offers')}
                >
                  <ListTodo size={14} />
                  OFFER QUEUE
                  {liveOfferQueue.length > 0 && (
                    <span className="bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full text-[9px]">
                      {liveOfferQueue.filter(q => q.status === 'queued').length}
                    </span>
                  )}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" disabled={syncing || loading} className="border-amber-200 text-amber-700 hover:bg-amber-50">
                    <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                    Sync Active Users
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Sync Options</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => handleSync(false)}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    <span>Sync New Users Only</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => {
                    if (window.confirm("WARNING: This will RESET ALL SELECTED USERS (including completed/removed) back to Step 0. Continue?")) {
                      handleSync(true);
                    }
                  }} className="text-red-600 font-bold">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    <span>Full System Reset & Sync</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handlePurge} className="text-red-900 font-black bg-red-50">
                    <Trash2 className="mr-2 h-4 w-4 text-red-600" />
                    <span>WIPE ALL DATA (Hard Reset)</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button size="sm" variant="outline" onClick={loadQueue} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh Data
              </Button>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 animate-in zoom-in duration-200">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-200 text-amber-600 hover:bg-amber-50 font-black text-[10px] h-8 gap-2"
                    onClick={() => {
                      selectedIds.forEach(id => handleOverride(id, 'pause'));
                      setSelectedIds(new Set());
                    }}
                  >
                    <Pause size={14} />
                    BULK PAUSE ({selectedIds.size})
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="border-emerald-200 text-emerald-600 hover:bg-emerald-50 font-black text-[10px] h-8 gap-2"
                    onClick={() => {
                      selectedIds.forEach(id => handleOverride(id, 'resume'));
                      setSelectedIds(new Set());
                    }}
                  >
                    <Play size={14} />
                    BULK RESUME ({selectedIds.size})
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50 font-black text-[10px] h-8 gap-2"
                    onClick={() => {
                      if (window.confirm(`Permanently REMOVE ${selectedIds.size} users from the automation queue?`)) {
                        selectedIds.forEach(id => handleOverride(id, 'remove'));
                        setSelectedIds(new Set());
                      }
                    }}
                  >
                    <Trash2 size={14} />
                    BULK REMOVE ({selectedIds.size})
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="border-blue-200 text-blue-600 hover:bg-blue-50 font-black text-[10px] h-8 gap-2"
                    onClick={() => {
                      const completedCount = queue.filter(q => selectedIds.has(q.user_id) && q.queue_status === 'completed').length;
                      let confirmMsg = `Restore/Reset ${selectedIds.size} users to active outreach?`;
                      if (completedCount > 0) {
                        confirmMsg = `${completedCount} of these users have ALREADY COMPLETED their cycle. Do you want to RESTART them from Step 0 with a 5-hour delay?`;
                      }

                      if (window.confirm(confirmMsg)) {
                        selectedIds.forEach(id => {
                          const item = queue.find(q => q.user_id === id);
                          if (item?.queue_status === 'removed') {
                            handleOverride(id, 'restore');
                          } else if (item?.queue_status === 'completed') {
                            handleOverride(id, 'reset');
                          } else {
                            handleOverride(id, 'resume');
                          }
                        });
                        setSelectedIds(new Set());
                      }
                    }}
                  >
                    <RefreshCw size={14} />
                    BULK RESTORE/RESET ({selectedIds.size})
                  </Button>

                  <Button
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg font-black text-[10px] h-8 gap-2 animate-in zoom-in duration-300"
                    onClick={() => {
                      const selectedItems = queue.filter(item => selectedIds.has(item.user_id));
                      if (selectedItems.length > 0) {
                        setSelectedQueueItem(selectedItems[0]);
                        setSendNowOpen(true);
                        setInitialPreviewMode(true);
                      }
                    }}
                  >
                    <Zap size={14} className="fill-white" />
                    BULK START NOW ({selectedIds.size})
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DialogHeader>
        <Tabs value={dashboardTab} onValueChange={(v: any) => setDashboardTab(v)} className="flex-1 flex flex-col min-h-0">
          <TabsContent value="automation" className="flex-1 flex flex-col min-h-0 m-0 outline-none">
            <div className="px-6 py-3 border-b bg-slate-50/30 grid grid-cols-6 gap-3">
          <div
            className={`flex flex-col cursor-pointer p-2 rounded-lg transition-all ${filter === 'active' ? 'bg-blue-50 border border-blue-200 shadow-sm' : 'hover:bg-slate-100 border border-transparent'}`}
            onClick={() => setFilter('active')}
          >
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Cycles</span>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-black text-blue-600 leading-none">{stats.active}</span>
              <div className="flex flex-col border-l pl-3 border-blue-100">
                <span className="text-[10px] text-slate-400 font-bold uppercase leading-tight">In Flow</span>
                <span className="text-[11px] font-black text-indigo-500 leading-tight">
                  {mergedQueue.filter(q => {
                    if (!q.last_login) return false;
                    const loginDate = new Date(q.last_login);
                    const today = new Date();
                    return loginDate.getDate() === today.getDate() &&
                      loginDate.getMonth() === today.getMonth() &&
                      loginDate.getFullYear() === today.getFullYear();
                  }).length} Total Active Today
                </span>
              </div>
            </div>
          </div>
          <div
            className={`flex flex-col border-l pl-4 cursor-pointer p-2 rounded-lg transition-all ${filter === 'sent' ? 'bg-emerald-50 border border-emerald-200 shadow-sm' : 'hover:bg-slate-100 border border-transparent'}`}
            onClick={() => {
              setFilter('sent');
            }}
          >
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Offers Sent</span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-emerald-600">{stats.totalDelivered}</span>
              <span className="text-[10px] text-slate-400 font-medium">Delivered total</span>
            </div>
          </div>
          <div
            className={`flex flex-col border-l pl-4 cursor-pointer p-2 rounded-lg transition-all ${filter === 'pending' ? 'bg-amber-50 border border-amber-200 shadow-sm' : 'hover:bg-slate-100 border border-transparent'}`}
            onClick={() => setFilter('pending')}
          >
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">In Queue (Pending)</span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-amber-500">{stats.pendingNext}</span>
              <span className="text-[10px] text-slate-400 font-medium">Waiting to go</span>
            </div>
          </div>
          <div
            className="flex flex-col border-l pl-4 p-2 rounded-lg bg-emerald-50 border border-emerald-200"
          >
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ready to Send</span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-emerald-600">{stats.readyToSend}</span>
              <span className="text-[10px] text-emerald-600 font-bold animate-pulse">Now</span>
            </div>
          </div>
          <div
            className={`flex flex-col border-l pl-4 cursor-pointer p-2 rounded-lg transition-all ${filter === 'completed' ? 'bg-slate-100 border border-slate-300 shadow-sm' : 'hover:bg-slate-100 border border-transparent'}`}
            onClick={() => setFilter('completed')}
          >
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Completed</span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-slate-600">{stats.completed}</span>
              <span className="text-[10px] text-slate-400 font-medium">Finished</span>
            </div>
          </div>
          <div
            className={`flex flex-col border-l pl-4 cursor-pointer p-2 rounded-lg transition-all ${filter === 'removed' ? 'bg-red-50 border border-red-200 shadow-sm' : 'hover:bg-slate-100 border border-transparent'}`}
            onClick={() => setFilter('removed')}
          >
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Removed</span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-red-600">{stats.removed}</span>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-medium">On Hold</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-b bg-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by username or ID..."
                className="pl-9 h-9 text-sm"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 overflow-x-auto custom-scrollbar">
              {(['all', 'active', 'paused', 'pending', 'sent', 'completed', 'removed', 'failed'] as const).map(f => {
                const count = f === 'all' ? mergedQueue.filter(q => q.queue_status !== 'removed').length :
                  f === 'active' ? mergedQueue.filter(q => q.queue_status === 'active').length :
                    f === 'paused' ? mergedQueue.filter(q => q.queue_status === 'paused').length :
                      f === 'pending' ? mergedQueue.filter(q => q.queue_status === 'active' && q.delivery_status === 'pending').length :
                        f === 'sent' ? mergedQueue.filter(q => q.queue_status !== 'removed' && (q.current_step || 0) > 0).length :
                          f === 'completed' ? mergedQueue.filter(q => q.queue_status === 'completed').length :
                            f === 'removed' ? mergedQueue.filter(q => q.queue_status === 'removed').length :
                              mergedQueue.filter(q => q.delivery_status === 'failed').length;
                return (
                  <button
                    key={f}
                    className={`px-3 py-1.5 text-[10px] font-black rounded-md transition-all capitalize flex items-center gap-1.5 whitespace-nowrap ${filter === f ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-indigo-600'}`}
                    onClick={() => setFilter(f)}
                  >
                    <span>{f}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${filter === f ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50/50 border border-indigo-100 rounded-lg">
              <Checkbox
                id="recent-filter"
                checked={recentOnly}
                onCheckedChange={(checked) => setRecentOnly(!!checked)}
                className="data-[state=checked]:bg-indigo-600 border-indigo-300"
              />
              <label htmlFor="recent-filter" className="text-[11px] font-semibold text-indigo-700 cursor-pointer select-none">
                Recently Active (24h)
              </label>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-0 bg-white">
          <Table>
            <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={filteredQueue.length > 0 && selectedIds.size === filteredQueue.length}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedIds(new Set(filteredQueue.map(item => item.user_id)));
                      } else {
                        setSelectedIds(new Set());
                      }
                    }}
                    className="data-[state=checked]:bg-indigo-600 border-slate-300"
                  />
                </TableHead>
                <TableHead className="w-[200px]">User / Trigger</TableHead>
                <TableHead>Flow Status</TableHead>
                <TableHead className="w-[140px]">Send Progress</TableHead>
                <TableHead>Next Step</TableHead>
                <TableHead>Targeted Content</TableHead>
                <TableHead>Cooldown Lock</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQueue.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-96 text-center">
                    <div className="flex flex-col items-center justify-center gap-4 py-12">
                      <div className="p-4 bg-slate-50 rounded-full">
                        <Zap size={48} className="text-slate-200" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-slate-500 font-bold">No active cycles found in this view</p>
                        <p className="text-slate-400 text-sm">Would you like to discover users from recent activity?</p>
                      </div>
                      <div className="flex gap-4">
                        <Button
                          onClick={() => handleSync(true)}
                          disabled={syncing}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-8 h-10 shadow-lg gap-2"
                        >
                          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                          DISCOVER & START FRESH
                        </Button>

                        <Button
                          variant="outline"
                          onClick={handlePurge}
                          disabled={loading}
                          className="border-red-200 text-red-600 hover:bg-red-50 font-black px-8 h-10 gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          START FROM ZERO (WIPE DATA)
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : 
                filteredQueue.map(item => (
                  <TableRow
                    key={item.user_id}
                    className={`hover:bg-slate-50/50 cursor-pointer ${selectedIds.has(item.user_id) ? 'bg-indigo-50/30' : ''}`}
                    onClick={() => {
                      setSelectedIds(prev => {
                        const next = new Set(prev);
                        if (next.has(item.user_id)) next.delete(item.user_id);
                        else next.add(item.user_id);
                        return next;
                      });
                    }}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(item.user_id)}
                        onCheckedChange={() => {
                          setSelectedIds(prev => {
                            const next = new Set(prev);
                            if (next.has(item.user_id)) next.delete(item.user_id);
                            else next.add(item.user_id);
                            return next;
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{item.username}</span>
                          {item.last_login && new Date(item.last_login).getTime() > Date.now() - 15 * 60 * 1000 && (
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-tight">Online</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant="outline" className="text-[10px] h-4 px-1 bg-slate-50 text-indigo-600 border-indigo-100">
                            {item.activity_type || 'Login'}
                          </Badge>
                          <span className="text-[10px] text-slate-400">
                            Logged: {formatExactDate(item.last_login || '')}
                          </span>
                          {item.last_login && !isNaN(new Date(item.last_login).getTime()) && (
                            <span className="text-[9px] font-mono text-indigo-500 font-bold bg-indigo-50 px-1 rounded ml-1">
                              {(() => {
                                const diff = Date.now() - new Date(item.last_login).getTime();
                                if (diff < 0) return "Just now";
                                const hrs = Math.floor(diff / (1000 * 60 * 60));
                                const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                return hrs > 0 ? `${hrs}h ${mins}m ago` : `${mins}m ago`;
                              })()}
                            </span>
                          )}
                        </div>
                        {/* Matched Verticals */}
                        {item.matched_verticals && item.matched_verticals.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {item.matched_verticals.map((v: string) => (
                              <span key={v} className="px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[9px] font-bold uppercase tracking-tight border border-indigo-100/50">
                                {v}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {(item as any).is_new_discovery ? (
                          <div className="flex flex-col gap-0.5">
                             <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border-none text-[9px] font-black h-5 px-2 w-fit">ELIGIBLE</Badge>
                             <span className="text-[10px] text-slate-500 font-bold uppercase mt-1">Pending Sync</span>
                          </div>
                        ) : item.queue_status === 'active' ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="flex items-center text-blue-600 text-[10px] font-bold uppercase">
                              <Zap size={12} className="mr-1 animate-pulse" /> Cycle Active
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Delivery: <span className="capitalize text-slate-600 font-medium">{item.delivery_status}</span>
                            </span>
                          </div>
                        ) : item.queue_status === 'paused' ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="flex items-center text-amber-600 text-[10px] font-bold uppercase">
                              <Pause size={12} className="mr-1" /> Cycle Paused
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Waiting for <span className="text-amber-600 font-medium">Resume</span>
                            </span>
                          </div>
                        ) : (
                          <span className="flex items-center text-slate-400 text-[10px] font-bold uppercase">
                            <ShieldCheck size={12} className="mr-1" /> Cycle Finished
                          </span>
                        )}

                        {item.queue_status === 'removed' && (
                          <Button
                            size="sm"
                            className="h-8 mt-2 px-4 text-[10px] font-black bg-blue-600 text-white hover:bg-blue-700 shadow-lg flex items-center gap-2 animate-in slide-in-from-left duration-300"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOverride(item.user_id, 'restore');
                            }}
                          >
                            <RefreshCw size={14} className="fill-white" /> RESTORE TO ACTIVE
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        {item.queue_status === 'completed' ? (
                          <>
                            <div className="flex justify-between items-center pr-2">
                              <span className="text-[10px] font-bold text-emerald-600 uppercase">All 5 Sent</span>
                              <span className="text-[10px] text-slate-400">0 in queue</span>
                            </div>
                            <div className="w-full bg-emerald-100 h-1.5 rounded-full overflow-hidden flex border border-emerald-200/30">
                              {[...Array(5)].map((_, i) => (
                                <div key={i} className="flex-1 bg-emerald-500 border-r border-white/20 last:border-0" />
                              ))}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between items-center pr-2">
                              <span className="text-[10px] font-bold text-slate-500 uppercase">{item.current_step} of 5 Sent</span>
                              <span className="text-[10px] text-slate-400">{5 - (item.current_step || 0)} in queue</span>
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden flex border border-slate-200/50">
                              {[...Array(5)].map((_, i) => (
                                <div
                                  key={i}
                                  className={`flex-1 border-r border-white/20 last:border-0 ${i < (item.current_step || 0) ? 'bg-emerald-500' : 'bg-slate-200'}`}
                                />
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col min-w-[140px]">
                        {item.queue_status === 'active' ? (
                          <>
                            <div className="flex items-center text-slate-700 font-bold text-xs">
                              {new Date(item.next_mail_time).getTime() - new Date().getTime() <= 0 ? (
                                <div className="flex items-center gap-2">
                                  {item.current_step === 0 && !item.is_authorized ? (
                                    <Button
                                      size="sm"
                                      className="h-8 px-4 text-[10px] font-black bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg flex items-center gap-2 animate-in fade-in zoom-in duration-300"
                                      disabled={fetchingItem === item.user_id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOverride(item.user_id, 'start');
                                      }}
                                    >
                                      <Play size={12} className="fill-white" /> START OUTREACH CYCLE
                                    </Button>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <span className="flex items-center text-emerald-600 animate-pulse">
                                        <Zap size={12} className="mr-1 fill-emerald-600" />
                                        READY
                                      </span>
                                      <Button
                                        size="sm"
                                        className="h-7 px-3 text-[10px] font-black bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg flex items-center gap-1 animate-bounce"
                                        disabled={fetchingItem === item.user_id}
                                        onClick={() => fetchItemDetails(item, true)}
                                      >
                                        <Zap size={10} className="fill-white" /> INITIATE OUTREACH
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="flex flex-col gap-1 w-full">
                                  <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-1">
                                      <Clock size={12} className="text-blue-500" />
                                      {getCountdown(item.next_mail_time)}
                                    </span>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 px-2 text-[9px] font-black text-indigo-600 hover:bg-indigo-50 border border-indigo-100"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          fetchItemDetails(item, true);
                                        }}
                                      >
                                        FORCE NEXT NOW
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0 text-amber-600 hover:bg-amber-50 border border-amber-100"
                                        title="Pause Automation"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOverride(item.user_id, 'pause');
                                        }}
                                      >
                                        <Pause size={12} />
                                      </Button>
                                    </div>
                                  </div>
                                  {/* Interval Progress Bar (5h standard) */}
                                  {item.current_step === 0 && item.last_login && (
                                    <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden mt-1">
                                      <div
                                        className="bg-blue-400 h-full transition-all duration-1000"
                                        style={{
                                          width: `${Math.min(100, Math.max(0, (Date.now() - new Date(item.last_login).getTime()) / (5 * 60 * 60 * 1000) * 100))}%`
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                              <Badge variant="secondary" className="text-[9px] h-3.5 px-1 bg-blue-50 text-blue-700 border-blue-100">
                                {item.current_step === 0 ? 'Wait Phase' : `Step ${item.current_step + 1}/5`}
                              </Badge>
                              <span className="text-[9px] text-slate-400 font-bold uppercase">
                                {new Date(item.next_mail_time).getTime() - new Date().getTime() <= 0 ? 'Waiting for Admin' : `Ready at ${new Date(item.next_mail_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                              </span>
                            </div>
                          </>
                        ) : item.queue_status === 'paused' ? (
                          <div className="flex flex-col gap-2">
                            <Button
                              size="sm"
                              className="h-8 px-4 text-[10px] font-black bg-emerald-600 text-white hover:bg-emerald-700 shadow-md flex items-center gap-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOverride(item.user_id, 'resume');
                              }}
                            >
                              <Play size={14} className="fill-white" /> RESUME FLOW
                            </Button>
                            <div className="flex items-center gap-1.5 px-1">
                              <Pause size={10} className="text-amber-500" />
                              <span className="text-[9px] font-black text-amber-600 uppercase tracking-tight">Halted at Step {item.current_step}/5</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-slate-300">
                            <CheckCircle2 size={14} className="text-emerald-500" />
                            <span className="text-[10px] font-bold uppercase">Completed</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div
                        className="flex flex-col gap-2 cursor-pointer hover:bg-slate-50/50 p-2 rounded-xl border border-transparent hover:border-slate-100 transition-all"
                        onClick={() => {
                          fetchItemDetails(item, true);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-slate-400">Cycle Status</span>
                          <span className="text-[10px] font-bold text-indigo-600">{(item.current_step || 0)} / 5 Sent</span>
                        </div>

                        {/* 5-Step Progress Bar */}
                        <div className="flex gap-1 h-1.5 w-full">
                          {[1, 2, 3, 4, 5].map((s) => {
                            const isSent = s <= (item.current_step || 0);
                            const isOngoing = s === (item.current_step || 0) + 1;
                            return (
                              <div
                                key={`bar-${s}`}
                                className={`flex-1 rounded-full ${isSent ? 'bg-emerald-500' : isOngoing ? 'bg-indigo-500 animate-pulse' : 'bg-slate-200'}`}
                              />
                            );
                          })}
                        </div>

                        <div className="space-y-1 mt-1">
                          {item.queue_status === 'active' ? (
                            <div className="bg-indigo-50/50 border border-indigo-100 p-1.5 rounded-lg">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-[8px] font-black uppercase text-indigo-500">Next Outreach</span>
                                <Zap size={8} className="text-indigo-500 fill-indigo-500" />
                              </div>
                              <div className="text-[10px] font-bold text-indigo-700 truncate">
                                {item.next_offers?.[0]?.name || 'Matching Best Offer...'}
                              </div>
                            </div>
                          ) : item.queue_status === 'paused' ? (
                            <div className="bg-amber-50/50 border border-amber-100 p-1.5 rounded-lg">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-[8px] font-black uppercase text-amber-500">Paused</span>
                                <Pause size={8} className="text-amber-500 fill-amber-500" />
                              </div>
                              <div className="text-[10px] font-bold text-amber-700 truncate">
                                Waiting for Resume
                              </div>
                            </div>
                          ) : (
                            <div className="bg-emerald-50/50 border border-emerald-100 p-1.5 rounded-lg">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-[8px] font-black uppercase text-emerald-500">Completed</span>
                                <CheckCircle2 size={8} className="text-emerald-500" />
                              </div>
                              <div className="text-[10px] font-bold text-emerald-700 truncate">
                                {item.sent_history?.[(item.sent_history?.length || 1) - 1]?.name || 'All Steps Delivered'}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.cooldown_until && new Date(item.cooldown_until) > new Date() ? (
                        <div className="flex flex-col gap-1">
                          <Badge variant="destructive" className="w-fit text-[9px] h-3.5 px-1 uppercase">Locked</Badge>
                          <span className="text-[10px] text-red-500 font-medium">
                            Ends: {formatExactDate(item.cooldown_until)}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-[9px] h-3.5 px-1 uppercase">Eligible</Badge>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>Manage Flow</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {item.queue_status === 'active' && (
                            <DropdownMenuItem onClick={() => fetchItemDetails(item, false)}>
                              <CalendarClock className="mr-2 h-4 w-4" />
                              <span>Schedule Next Outreach</span>
                            </DropdownMenuItem>
                          )}
                          {item.queue_status === 'active' && (
                            <DropdownMenuItem onClick={() => handleOverride(item.user_id, 'skip')}>
                              <SkipForward className="mr-2 h-4 w-4" />
                              <span>Skip to Next Step</span>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => {
                            setSelectedQueueItem(item);
                            setSendNowOpen(true);
                          }}>
                            <Mail className="mr-2 h-4 w-4" />
                            <span>Send Custom Mail</span>
                          </DropdownMenuItem>

                          {item.queue_status === 'active' && (
                            <DropdownMenuItem onClick={() => handleOverride(item.user_id, 'complete')} className="text-emerald-600">
                              <ShieldCheck className="mr-2 h-4 w-4" />
                              <span>Mark as Completed</span>
                            </DropdownMenuItem>
                          )}
                          {item.queue_status === 'active' ? (
                            <DropdownMenuItem onClick={() => handleOverride(item.user_id, 'pause')} className="text-amber-600">
                              <Pause className="mr-2 h-4 w-4" />
                              <span>Pause Flow</span>
                            </DropdownMenuItem>
                          ) : item.queue_status === 'paused' ? (
                            <DropdownMenuItem onClick={() => handleOverride(item.user_id, 'resume')} className="text-emerald-600">
                              <Play className="mr-2 h-4 w-4" />
                              <span>Resume Flow</span>
                            </DropdownMenuItem>
                          ) : item.queue_status === 'removed' ? (
                            <>
                              <DropdownMenuItem onClick={() => {
                                if (window.confirm(`This user has COMPLETED their cycle. Restart from Step 0 with a 5-hour delay?`)) {
                                  handleOverride(item.user_id, 'reset');
                                }
                              }} className="text-blue-600 font-bold">
                                <RefreshCw className="mr-2 h-4 w-4" />
                                <span>Restart Cycle</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => {
                                if (window.confirm(`PERMANENTLY DELETE ${item.username}? This cannot be undone.`)) {
                                  handleOverride(item.user_id, 'delete_permanent');
                                }
                              }} className="text-red-900 font-bold bg-red-50">
                                <Trash2 className="mr-2 h-4 w-4 text-red-600" />
                                <span>Delete Permanently</span>
                              </DropdownMenuItem>
                            </>
                          ) : null}

                          <DropdownMenuItem onClick={() => {
                            if (window.confirm(`Stop and FINISH automation cycle for ${item.username}?`)) {
                              handleOverride(item.user_id, 'complete');
                            }
                          }} className="text-red-600">
                            <X className="mr-2 h-4 w-4" />
                            <span>Finish Cycle</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOverride(item.user_id, 'reset')} className="text-amber-600">
                            <RotateCcw className="mr-2 h-4 w-4" />
                            <span>Reset Full Cycle</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => {
                            if (window.confirm(`Permanently REMOVE ${item.username} from the automation queue?`)) {
                              handleOverride(item.user_id, 'remove');
                            }
                          }} className="text-red-600 font-bold">
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Remove from Queue</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              }
            </TableBody>
          </Table>
        </div>
      </TabsContent>
      <TabsContent value="offers" className="flex-1 flex flex-col min-h-0 m-0 outline-none bg-slate-50/30">
        <div className="flex items-center justify-between p-4 bg-white border-b shrink-0">
           <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-xl">
               <Clock className="text-indigo-600" size={16} />
               <span className="text-xs font-bold text-indigo-700">Next Send: {liveOfferQueue.filter(q => q.status === 'queued').length > 0 ? new Date(liveOfferQueue.filter(q => q.status === 'queued')[0].scheduledTime).toLocaleTimeString() : 'N/A'}</span>
             </div>
             <div className="h-4 w-px bg-slate-200" />
             <div className="flex items-center gap-3">
               <span className="text-[10px] font-bold text-slate-400 uppercase">Interval Control</span>
               <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                 {[2, 5, 10, 15, 30].map(m => (
                   <button
                     key={m}
                     onClick={() => handleRecalculate(m)}
                     className="px-3 py-1 text-[10px] font-black rounded-md hover:bg-white hover:text-indigo-600 transition-all text-slate-500"
                   >
                     {m}M
                   </button>
                 ))}
               </div>
             </div>
           </div>
           
           <div className="flex items-center gap-3">
             <Button 
               size="sm" 
               variant={isProcessingOffers ? "destructive" : "default"} 
               onClick={toggleQueue}
               className="h-9 rounded-xl font-black text-[10px] gap-2 px-6 shadow-lg transition-all active:scale-95"
             >
               {isProcessingOffers ? <><Pause size={14} className="fill-white" /> PAUSE QUEUE</> : <><Play size={14} className="fill-white" /> START PROCESSING</>}
             </Button>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-white">
          <Table>
            <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Scheduled Offer</TableHead>
                <TableHead>Scheduled Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {liveOfferQueue.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-64 text-center">
                     <div className="flex flex-col items-center justify-center gap-3">
                       <div className="p-4 bg-slate-50 rounded-full">
                         <ListTodo size={32} className="text-slate-200" />
                       </div>
                       <p className="text-slate-400 font-bold">No individual offers currently queued</p>
                       <p className="text-[10px] text-slate-400 uppercase font-black">Use "Send Offer" on any user to add to this queue</p>
                     </div>
                  </TableCell>
                </TableRow>
              ) : (
                liveOfferQueue.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50/50">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{item.username}</span>
                        <span className="text-[10px] text-slate-400 font-medium">ID: {item.userId}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-50 rounded-lg">
                          <Package size={14} className="text-indigo-600" />
                        </div>
                        <span className="font-bold text-slate-700">{item.offerName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-600">{new Date(item.scheduledTime).toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400">{item.status === 'queued' ? 'Upcoming' : 'Processed'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.status === 'queued' ? (item.isPaused ? 'outline' : 'default') : 'secondary'} className={item.status === 'queued' && !item.isPaused ? 'bg-emerald-500 hover:bg-emerald-600' : ''}>
                        {item.status === 'queued' ? (item.isPaused ? 'Paused' : 'Queued') : item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                       <div className="flex justify-end gap-2">
                          {item.status === 'queued' && (
                            <>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-8 w-8 p-0 text-amber-600 hover:bg-amber-50"
                                onClick={() => handleOfferAction(item.id, item.isPaused ? 'resume' : 'pause')}
                              >
                                {item.isPaused ? <Play size={14} /> : <Pause size={14} />}
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                                onClick={() => handleOfferAction(item.id, 'remove')}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </>
                          )}
                       </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </TabsContent>
    </Tabs>
        {/* Offer Selection Sub-Modal */}
        <Dialog open={offerModalOpen} onOpenChange={setOfferModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
            <DialogHeader className="p-6 pb-0">
              <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Filter className="text-indigo-600 w-5 h-5" />
                </div>
                <span>Outreach Journey: {selectedQueueItem?.username}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {/* Timeline Header */}
              <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Current Status</span>
                  <span className="text-lg font-bold text-slate-900 capitalize">{selectedQueueItem?.queue_status} Flow</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">Progress</span>
                    <span className="text-sm font-bold text-indigo-600">{selectedQueueItem?.current_step}/5 Steps</span>
                  </div>
                  <div className="w-12 h-12 rounded-full border-4 border-indigo-100 border-t-indigo-600 flex items-center justify-center font-bold text-xs text-indigo-700">
                    {Math.round(((selectedQueueItem?.current_step || 0) / 5) * 100)}%
                  </div>
                </div>
              </div>

              {/* SENT HISTORY SECTION */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="text-emerald-500 w-4 h-4" />
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Delivered History (Sent)</h3>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {(selectedQueueItem?.sent_history || []).length > 0 ? (
                    selectedQueueItem?.sent_history.map((off: any, idx: number) => (
                      <div key={off.id} className="flex items-center gap-4 p-3 bg-emerald-50/50 border border-emerald-100 rounded-lg group hover:bg-emerald-50 transition-all">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs">
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-800">{off.name}</span>
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[9px] h-4">Delivered</Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] text-slate-500 font-mono uppercase">{off.id.slice(-6)}</span>
                            <span className="text-[10px] text-emerald-600 font-bold">{off.payout_display}</span>
                            <span className="text-[10px] text-slate-400">{off.network}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 border-2 border-dashed border-slate-100 rounded-lg text-slate-400 text-xs italic">
                      No offers sent in this cycle yet.
                    </div>
                  )}
                </div>
              </div>

              {/* NEXT OUTREACH SECTION */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="text-blue-500 w-4 h-4 fill-blue-500 animate-pulse" />
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Next Outreach (Ready to Go)</h3>
                </div>
                <div className="p-1 bg-blue-50/30 border border-blue-100 rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader className="bg-white/50">
                      <TableRow>
                        <TableHead className="w-12 text-[10px] font-black uppercase">Rank</TableHead>
                        <TableHead className="text-[10px] font-black uppercase">Candidate Offer</TableHead>
                        <TableHead className="text-[10px] font-black uppercase">Payout</TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase">Selection</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedQueueItem?.next_offers?.map((off, idx) => (
                        <TableRow key={off.id} className={idx === 0 ? 'bg-blue-50/80 group' : 'bg-white group'}>
                          <TableCell className="font-black text-slate-400">
                            <div className={`w-6 h-6 rounded flex items-center justify-center ${idx === 0 ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400'}`}>
                              {idx + 1}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className={`text-sm ${idx === 0 ? 'font-bold text-blue-900' : 'font-medium text-slate-700'}`}>{off.name}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[9px] text-slate-400 uppercase tracking-tighter font-bold">{off.category}</span>
                                {idx === 0 && <span className="text-[8px] px-1 bg-blue-100 text-blue-600 rounded font-black uppercase animate-pulse">Primary Pick</span>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className={`font-bold ${idx === 0 ? 'text-blue-600' : 'text-emerald-600'}`}>{off.payout_display || `$${off.payout}`}</TableCell>
                          <TableCell className="text-right">
                            {idx === 0 ? (
                              <div className="flex justify-end pr-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px] font-bold border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                onClick={async () => {
                                  await handleOverride(selectedQueueItem!.user_id, 'pin', off.id as any);
                                  setOfferModalOpen(false);
                                }}
                              >
                                Make Primary
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* FUTURE SEQUENCE PREVIEW */}
              {selectedQueueItem?.current_step < 4 && (
                <div className="space-y-3 opacity-60 grayscale hover:grayscale-0 transition-all hover:opacity-100 pb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="text-slate-400 w-4 h-4" />
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-tight">Planned Sequence (On Queue)</h3>
                  </div>
                  <div className="flex flex-col gap-2 p-4 bg-slate-100/50 rounded-xl border border-dashed border-slate-300">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase">
                      <span>Future Outreach Stages</span>
                      <span>Awaiting Intelligence Refresh</span>
                    </div>
                    <div className="flex gap-2">
                      {[...Array(5 - (selectedQueueItem?.current_step || 0) - 1)].map((_, i) => (
                        <div key={i} className="flex-1 h-12 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-xs font-black text-slate-200">
                          STEP {(selectedQueueItem?.current_step || 0) + i + 2}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
        {/* Send Now Modal */}
        {sendNowOpen && (
          <AutomationSendNowModal
            open={sendNowOpen}
            onClose={() => {
              setSendNowOpen(false);
              setSelectedIds(new Set());
              setSelectedQueueItem(null);
            }}
            queueItem={selectedQueueItem}
            queueItems={bulkItems}
            apiUrl={apiUrl}
            onSent={() => loadQueue()}
            startInPreview={initialPreviewMode}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
