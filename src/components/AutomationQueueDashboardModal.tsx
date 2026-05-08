import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'; // hmr-trigger-1
import { Button } from '@/components/ui/button'; // hmr-trigger-2
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Zap, Clock, Send, Mail, ShieldCheck, RefreshCw, X, Search, Filter, MoreVertical, SkipForward, RotateCcw, Pause, Play, AlertCircle, CheckCircle2, Eye, Edit3, CalendarClock } from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import AutomationSendNowModal from './AutomationSendNowModal';

export interface AutomationQueueItem {
  user_id: string;
  username: string;
  queue_status: 'active' | 'completed' | 'paused';
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
}

export const AutomationQueueDashboardModal: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiUrl: string;
}> = ({ open, onOpenChange, apiUrl }) => {
  const [queue, setQueue] = useState<AutomationQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'failed' | 'pending' | 'sent'>('all');
  const [recentOnly, setRecentOnly] = useState(true); // Default to true as per user request
  const [selectedQueueItem, setSelectedQueueItem] = useState<AutomationQueueItem | null>(null);
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [sendNowOpen, setSendNowOpen] = useState(false);
  const [initialPreviewMode, setInitialPreviewMode] = useState(false);
  const [tick, setTick] = useState(0);
  const { toast } = useToast();

  const [fetchingItem, setFetchingItem] = useState<string | null>(null);

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
        setQueue(data.queue);
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

  const handleSync = async () => {
    setSyncing(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiUrl}/api/admin/automation/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      toast({ title: 'Sync Complete', description: `Successfully added ${data.count || 0} active users to the automation flow.` });
      loadQueue();
    } catch (e) {
      toast({ title: 'Sync Error', description: 'Failed to sync active users', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };
  const handleOverride = async (userId: string, action: string, step?: number) => {
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

  const filteredQueue = queue.filter(item => {
    const searchLower = (search || '').toLowerCase();
    const username = (item.username || '').toLowerCase();
    const userId = (item.user_id || '').toLowerCase();
    
    const matchesSearch = username.includes(searchLower) || userId.includes(searchLower);
    const matchesFilter = filter === 'all' || 
                         (filter === 'active' && item.queue_status === 'active') ||
                         (filter === 'completed' && item.queue_status === 'completed') ||
                         (filter === 'failed' && item.delivery_status === 'failed') ||
                         (filter === 'pending' && item.queue_status === 'active' && item.delivery_status === 'pending') ||
                         (filter === 'sent' && (item.current_step || 0) > 0);
    
    // Recent Activity Filter (Last 24h)
    const isRecent = !recentOnly || (item.last_login && new Date(item.last_login).getTime() > Date.now() - 24 * 60 * 60 * 1000);
    
    return matchesSearch && matchesFilter && isRecent;
  }).sort((a, b) => {
    // Sort by last login descending (most recent first)
    const timeA = new Date(a.last_login || 0).getTime();
    const timeB = new Date(b.last_login || 0).getTime();
    return timeB - timeA;
  });

  const getStepBadge = (step: number) => {
    if (step === 0) return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Delay Phase</Badge>;
    return <Badge variant="secondary" className="bg-indigo-100 text-indigo-700">Step {step}/5</Badge>;
  };

  const stats = {
    active: queue.filter(q => q.queue_status === 'active').length,
    completed: queue.filter(q => q.queue_status === 'completed').length,
    totalDelivered: queue.reduce((acc, q) => acc + (q.current_step || 0), 0),
    pendingNext: queue.filter(q => q.queue_status === 'active' && q.delivery_status === 'pending').length
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b bg-slate-50">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="text-amber-500 fill-amber-500" />
              <span>Automation Engine: Live User Queue</span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing || loading} className="border-amber-200 text-amber-700 hover:bg-amber-50">
                <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                Sync Active Users
              </Button>
              <Button size="sm" variant="outline" onClick={loadQueue} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh Data
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="px-6 py-3 border-b bg-slate-50/30 grid grid-cols-4 gap-4">
          <div 
            className={`flex flex-col cursor-pointer p-2 rounded-lg transition-all ${filter === 'active' ? 'bg-blue-50 border border-blue-200 shadow-sm' : 'hover:bg-slate-100 border border-transparent'}`}
            onClick={() => setFilter('active')}
          >
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Cycles</span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-blue-600">{stats.active}</span>
              <span className="text-[10px] text-slate-400 font-medium">Users tracking</span>
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
            onClick={() => {
                setFilter('pending');
            }}
          >
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">In Queue (Pending)</span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-amber-500">{stats.pendingNext}</span>
              <span className="text-[10px] text-slate-400 font-medium">Waiting to go</span>
            </div>
          </div>
          <div 
            className={`flex flex-col border-l pl-4 cursor-pointer p-2 rounded-lg transition-all ${filter === 'completed' ? 'bg-slate-100 border border-slate-300 shadow-sm' : 'hover:bg-slate-100 border border-transparent'}`}
            onClick={() => setFilter('completed')}
          >
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Completed</span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-slate-600">{stats.completed}</span>
              <span className="text-[10px] text-slate-400 font-medium">Finished cycles</span>
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
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
              {(['all', 'active', 'pending', 'sent', 'completed', 'failed'] as const).map(f => (
                <button
                  key={f}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all capitalize ${filter === f ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-indigo-50'}`}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
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
                  <TableCell colSpan={6} className="h-64 text-center text-slate-400 italic">
                    {loading ? 'Fetching active cycles...' : 'No users currently in the automation queue'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredQueue.map(item => (
                  <TableRow key={item.user_id} className="hover:bg-slate-50/50 transition-colors">
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
                            {formatExactDate(item.last_login || '')}
                          </span>
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
                        {item.queue_status === 'active' ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="flex items-center text-blue-600 text-[10px] font-bold uppercase">
                              <Zap size={12} className="mr-1 animate-pulse" /> Cycle Active
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Delivery: <span className="capitalize text-slate-600 font-medium">{item.delivery_status}</span>
                            </span>
                          </div>
                        ) : (
                          <span className="flex items-center text-slate-400 text-[10px] font-bold uppercase">
                            <ShieldCheck size={12} className="mr-1" /> Cycle Finished
                          </span>
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
                      <div className="flex flex-col">
                        {item.queue_status === 'active' ? (
                          <>
                            <div className="flex items-center text-slate-700 font-bold text-xs">
                              {new Date(item.next_mail_time).getTime() - new Date().getTime() <= 0 ? (
                                <div className="flex items-center gap-2">
                                  <span className="flex items-center text-emerald-600 animate-pulse">
                                    <Zap size={12} className="mr-1 fill-emerald-600" />
                                    Due Now
                                  </span>
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="h-6 px-2 text-[9px] font-black bg-emerald-600 text-white border-none hover:bg-emerald-700 transition-all shadow-sm flex items-center gap-1"
                                    disabled={fetchingItem === item.user_id}
                                    onClick={() => fetchItemDetails(item, false)}
                                  >
                                    {fetchingItem === item.user_id ? <RefreshCw size={10} className="animate-spin" /> : <Mail size={10} />}
                                    Edit & Send
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <Clock size={12} className="mr-1 text-blue-500" />
                                  {getCountdown(item.next_mail_time)}
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Badge variant="secondary" className="text-[9px] h-3.5 px-1 bg-blue-50 text-blue-700 border-blue-100">
                                Step {item.current_step + 1}/5
                              </Badge>
                              <span className="text-[9px] text-slate-400">
                                at {new Date(item.next_mail_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-4 px-1 text-[8px] font-black text-blue-600 hover:bg-blue-50 ml-auto gap-0.5"
                                onClick={() => fetchItemDetails(item, false)}
                              >
                                <Edit3 size={8} /> Edit
                              </Button>
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-300">---</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div 
                        className="flex flex-col gap-1 cursor-pointer hover:bg-white p-1 rounded border border-transparent hover:border-slate-200 transition-all"
                        onClick={() => {
                          fetchItemDetails(item, true);
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                           <span className="text-[10px] font-black uppercase text-slate-400">Targeted Content</span>
                           <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[9px] gap-1 text-indigo-600 hover:bg-indigo-50">
                             <Eye size={10} /> Preview
                           </Button>
                        </div>
                        {item.next_offers && item.next_offers.length > 0 ? (
                          item.next_offers.slice(0, 2).map((off, i) => (
                            <div key={off.id} className={`text-[10px] flex items-center gap-1.5 p-1 rounded-md transition-all ${i === 0 ? 'bg-blue-50/80 border border-blue-100 text-blue-700 shadow-sm' : 'text-slate-600'}`}>
                              <span className={`flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black ${i === 0 ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400'}`}>
                                {i+1}
                              </span>
                              <div className="flex flex-col">
                                <span className={`truncate max-w-[120px] ${i === 0 ? 'font-bold' : ''}`}>{off.name}</span>
                                {i === 0 && <span className="text-[8px] font-black uppercase text-blue-500 animate-pulse">Next Outreach</span>}
                              </div>
                              {i === 0 && <Zap size={8} className="ml-auto text-blue-500 fill-blue-500" />}
                            </div>
                          ))
                        ) : (
                          <span className="text-slate-300 text-[10px]">No previews</span>
                        )}
                        {item.next_offers && item.next_offers.length > 2 && (
                          <span className="text-[9px] text-indigo-500 font-medium">+{item.next_offers.length - 2} more...</span>
                        )}
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
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 mt-1 text-[9px] font-black text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 p-0 flex items-center gap-1"
                            onClick={() => {
                              fetchItemDetails(item, false);
                            }}
                          >
                            <Mail size={10} /> Prepare Outreach
                          </Button>
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
                          <DropdownMenuItem onClick={() => fetchItemDetails(item, false)}>
                            <Mail className="mr-2 h-4 w-4" />
                            <span>Prepare Outreach</span>
                          </DropdownMenuItem>
                          {item.queue_status === 'active' && (
                            <DropdownMenuItem onClick={() => handleOverride(item.user_id, 'complete')} className="text-emerald-600">
                              <ShieldCheck className="mr-2 h-4 w-4" />
                              <span>Mark as Completed</span>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleOverride(item.user_id, 'reset')} className="text-amber-600">
                            <RotateCcw className="mr-2 h-4 w-4" />
                            <span>Reset Full Cycle</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
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
                                    STEP { (selectedQueueItem?.current_step || 0) + i + 2 }
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Manual Send Modal */}
        <AutomationSendNowModal
          open={sendNowOpen}
          onClose={() => setSendNowOpen(false)}
          queueItem={selectedQueueItem}
          apiUrl={apiUrl}
          onSent={() => loadQueue()}
          startInPreview={initialPreviewMode}
        />
      </DialogContent>
    </Dialog>
  );
};
