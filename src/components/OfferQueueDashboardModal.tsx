import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { offerQueueService, OfferQueueItem, QueueStatus } from '@/services/offerQueueService';
import { Pencil, Trash2, SkipForward, Play, Pause, Settings2, RotateCcw, AlertTriangle, XCircle, Info, RefreshCw, Clock, ShieldAlert, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface UserDataForWarning {
  user_id: string;
  username: string;
  logs: any[];
  country?: string;
  isSuspicious: boolean;
  sharedAccount?: boolean;
  hasDifferentLocations?: boolean;
  hasNewDevice?: boolean;
  failedLogin?: boolean;
}

export const OfferQueueDashboardModal: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allUsers?: UserDataForWarning[];
}> = ({ open, onOpenChange, allUsers }) => {
  const [queue, setQueue] = useState<OfferQueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editIntervalOpen, setEditIntervalOpen] = useState(false);
  const [newInterval, setNewInterval] = useState('2');
  const [editingItem, setEditingItem] = useState<OfferQueueItem | null>(null);
  const [resendingItem, setResendingItem] = useState<OfferQueueItem | null>(null);
  const [editTime, setEditTime] = useState('');
  const [resendTime, setResendTime] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | QueueStatus | 'paused'>('all');
  const [viewMode, setViewMode] = useState<'detailed' | 'user'>('user');
  const [userSearch, setUserSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'custom'>('all');
  const [customDate, setCustomDate] = useState('');
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  useEffect(() => {
    if (open) {
      const unsub = offerQueueService.subscribe((q) => {
        setQueue([...q].sort((a, b) => a.scheduledTime - b.scheduledTime));
      });
      setIsProcessing(offerQueueService.getIsProcessing());
      return unsub;
    }
  }, [open]);

  const toggleQueue = () => {
    if (isProcessing) {
      offerQueueService.pauseQueue();
      setIsProcessing(false);
    } else {
      offerQueueService.resumeQueue();
      setIsProcessing(true);
    }
  };

  const pendingItems = queue.filter(q => q.status === 'queued');
  const sentItems = queue.filter(q => q.status === 'sent');
  const skippedItems = queue.filter(q => q.status === 'skipped');
  const removedItems = queue.filter(q => q.status === 'removed');
  const pausedItems = queue.filter(q => q.status === 'queued' && q.isPaused);
  
  const userSentCounts = queue.reduce((acc, item) => {
    if (item.status === 'sent') {
      acc[item.userId] = (acc[item.userId] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const uniqueUsersSent = Object.keys(userSentCounts).length;
  const lastPending = pendingItems.length > 0 ? pendingItems[pendingItems.length - 1] : null;

  const userSummary = React.useMemo(() => {
    const summary: Record<string, {
      userId: string;
      username: string;
      ip: string;
      city: string;
      country: string;
      sent: number;
      pending: number;
      skipped: number;
      nextScheduled: number | null;
      lastSentName: string;
      lastSentTime: number | null;
      isPaused: boolean;
    }> = {};
    
    let filteredQueueSource = queue;
    if (currentUser) {
      const currentUserId = String(currentUser.id);
      const currentUserEmail = currentUser.email?.toLowerCase();
      const currentUserUsername = currentUser.username?.toLowerCase();
      
      filteredQueueSource = queue.filter((item: OfferQueueItem) => {
        const itemId = String(item.userId || '');
        const itemUsername = (item.username || '').toLowerCase();
        return itemId === currentUserId || 
               (currentUserUsername && itemUsername === currentUserUsername);
      });
    }

    // Seed with all available users if provided
    if (allUsers) {
      let filteredAllUsers = allUsers;
      if (currentUser) {
        const currentUserId = String(currentUser.id);
        const currentUserEmail = currentUser.email?.toLowerCase();
        const currentUserUsername = currentUser.username?.toLowerCase();
        filteredAllUsers = allUsers.filter(u => {
           const uId = String(u.user_id || '');
           const uEmail = (u as any).email?.toLowerCase() || '';
           const uUsername = u.username?.toLowerCase() || '';
           return uId === currentUserId || 
                  (currentUserEmail && uEmail === currentUserEmail) || 
                  (currentUserUsername && uUsername === currentUserUsername);
        });
      }
      filteredAllUsers.forEach(u => {
        summary[u.user_id] = {
          userId: u.user_id,
          username: u.username,
          ip: '—',
          city: '',
          country: '',
          sent: 0,
          pending: 0,
          skipped: 0,
          nextScheduled: null,
          lastSentName: '—',
          lastSentTime: null,
          isPaused: offerQueueService.isUserPaused(u.user_id)
        };
      });
    }

    const dashboardUserIds = allUsers ? new Set(allUsers.map(u => String(u.user_id))) : null;

    filteredQueueSource.forEach(item => {
      if (item.status === 'removed') return;
      
      // If we have a dashboard filter, ignore items not in that list
      if (dashboardUserIds && !dashboardUserIds.has(String(item.userId))) return;

      if (!summary[item.userId]) {
        summary[item.userId] = {
          userId: item.userId,
          username: item.username,
          ip: item.ip || '—',
          city: item.city || '',
          country: item.country || '',
          sent: 0,
          pending: 0,
          skipped: 0,
          nextScheduled: null,
          lastSentName: '—',
          lastSentTime: null,
          isPaused: offerQueueService.isUserPaused(item.userId)
        };
      }
      const s = summary[item.userId];
      if (item.status === 'sent') {
        s.sent++;
        if (!s.lastSentTime || item.scheduledTime > s.lastSentTime) {
          s.lastSentTime = item.scheduledTime;
          s.lastSentName = item.offerName;
        }
      }
      if (item.status === 'queued') {
        s.pending++;
        if (item.isPaused) s.isPaused = true;
        if (s.nextScheduled === null || item.scheduledTime < s.nextScheduled) {
          s.nextScheduled = item.scheduledTime;
        }
      }
      if (item.status === 'skipped') s.skipped++;
    });

    let result = Object.values(summary).sort((a, b) => {
        if (b.sent !== a.sent) return b.sent - a.sent;
        if (b.pending !== a.pending) return b.pending - a.pending;
        return a.username.localeCompare(b.username);
    });

    if (userSearch) {
      result = result.filter(u => 
        u.username.toLowerCase().includes(userSearch.toLowerCase()) || 
        u.userId === userSearch
      );
    }

    if (statusFilter === 'paused') {
      return result.filter(u => u.isPaused);
    }
    return result;
  }, [queue, allUsers, statusFilter, userSearch, currentUser]);

  const getOfferWarnings = (userId: string, offerId: string | undefined, scheduledTime: number) => {
    const warnings: { type: 'A' | 'B' | 'C' | 'D' | 'E', message: string, icon: any, color: string }[] = [];
    const user = allUsers?.find(u => u.user_id === userId);
    const sentHistory = queue.filter(q => q.userId === userId && q.status === 'sent');
    
    // Type E: Already received
    if (offerId) {
      const alreadySent = sentHistory.find(h => h.offerId === offerId || (h.offerIds && h.offerIds.includes(offerId)));
      if (alreadySent) {
        warnings.push({
          type: 'E',
          message: `This user was already sent this offer on ${new Date(alreadySent.scheduledTime).toLocaleDateString()}. Resending may increase unsubscribe risk.`,
          icon: RefreshCw,
          color: 'text-orange-600'
        });
      }
    }

    if (!user || !user.logs || user.logs.length === 0) {
      // Type D: No data
      warnings.push({
        type: 'D',
        message: "No activity data available for this user. Recommend sending during general off-peak hours (before 10 AM or after 6 PM).",
        icon: Info,
        color: 'text-blue-500'
      });
      return warnings;
    }

    // Type B: Account flag warnings
    if (user.isSuspicious) {
      if (user.logs.some(l => l.risk_level === 'high' || l.risk_level === 'critical')) {
        warnings.push({ type: 'B', message: "Suspicious IP detected on this account. Verify user legitimacy before sending.", icon: XCircle, color: 'text-red-600' });
      }
      if (user.logs.length >= 3) {
        warnings.push({ type: 'B', message: "This account has multiple active login sessions. Confirm it's a real user before sending.", icon: XCircle, color: 'text-red-600' });
      }
      if (user.hasNewDevice) {
        warnings.push({ type: 'B', message: "User recently logged in from a new device. They may not check email immediately.", icon: XCircle, color: 'text-red-600' });
      }
      if (user.sharedAccount) {
        warnings.push({ type: 'B', message: "This appears to be a shared account. Email may reach an unintended recipient.", icon: XCircle, color: 'text-red-600' });
      }
      if (user.failedLogin) {
        warnings.push({ type: 'B', message: "Recent failed login attempts detected. User may be locked out of their account.", icon: XCircle, color: 'text-red-600' });
      }
    }

    // Type A: Activity-based timing (Peak hours)
    const hours = user.logs.map(l => new Date(l.login_time).getHours());
    const hourCounts: Record<number, number> = {};
    hours.forEach(h => hourCounts[h] = (hourCounts[h] || 0) + 1);
    
    const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
    if (peakHour && Number(peakHour[1]) > 1) {
      const peak = Number(peakHour[0]);
      const scheduledHour = new Date(scheduledTime).getHours();
      
      if (scheduledHour >= peak && scheduledHour <= peak + 2) {
        const ampm = (h: number) => h >= 12 ? `${h === 12 ? 12 : h - 12} PM` : `${h === 0 ? 12 : h} AM`;
        warnings.push({
          type: 'A',
          message: `This user is typically active between [${ampm(peak)} – ${ampm(peak + 2)}]. Emails sent during this window may get lost in activity. Recommend sending after ${ampm(peak + 3)}.`,
          icon: AlertTriangle,
          color: 'text-amber-600'
        });
      }
    }

    // Type C: Location / timezone warnings
    if (user.country) {
       // Mock timezone offset detection based on common countries for demo
       const offsets: Record<string, number> = { 'US': -5, 'IN': 5.5, 'GB': 0, 'AU': 10, 'BD': 6 };
       const offset = offsets[user.country] || 0;
       const localTime = new Date(scheduledTime + (offset * 3600000));
       const localHour = localTime.getUTCHours();
       
       if (localHour < 8 || localHour > 20) {
         warnings.push({
           type: 'C',
           message: `Scheduled send time is ${localHour}:00 in user's local timezone (${user.country}). Consider adjusting for better open rates.`,
           icon: AlertTriangle,
           color: 'text-amber-600'
         });
       }
    }

    return warnings;
  };

  const totalPausedUsers = userSummary.filter(u => u.isPaused).length;

  const filteredQueue = queue.filter(item => {
    let matches = true;
    
    if (currentUser) {
      const currentUserId = String(currentUser.id);
      const currentUserUsername = currentUser.username?.toLowerCase();
      
      const itemId = String(item.userId || '');
      const itemUsername = (item.username || '').toLowerCase();
      
      const isCurrentUser = itemId === currentUserId || 
                           (currentUserUsername && itemUsername === currentUserUsername);
      
      if (!isCurrentUser) return false;
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'paused') {
        matches = matches && item.status === 'queued' && item.isPaused;
      } else {
        matches = matches && item.status === statusFilter;
      }
    } else {
      matches = item.status !== 'removed';
    }
    
    // Date Filtering
    if (dateFilter !== 'all') {
      const itemDate = new Date(item.scheduledTime);
      const targetDate = new Date();
      targetDate.setHours(0, 0, 0, 0);
      
      if (dateFilter === 'yesterday') {
        targetDate.setDate(targetDate.getDate() - 1);
      } else if (dateFilter === 'custom' && customDate) {
        const [y, m, d] = customDate.split('-').map(Number);
        targetDate.setFullYear(y, m - 1, d);
      }
      
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      matches = matches && itemDate >= targetDate && itemDate < nextDay;
    }
    
    if (matches && userSearch) {
      matches = item.username.toLowerCase().includes(userSearch.toLowerCase()) || 
                item.userId === userSearch;
    }
    
    return matches;
  });

  const WarningList = ({ warnings }: { warnings: any[] }) => {
    if (warnings.length === 0) return null;
    return (
      <div className="space-y-1.5 mt-2 max-w-sm">
        {warnings.map((w, idx) => (
          <div key={idx} className={`flex items-start gap-2 p-2 rounded border border-slate-200/50 text-[10px] leading-tight bg-white shadow-sm`}>
             <w.icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${w.color}`} />
             <span className="text-slate-700 font-medium">{w.message}</span>
          </div>
        ))}
      </div>
    );
  };

  const WarningBadge = ({ warnings }: { warnings: any[] }) => {
    if (warnings.length === 0) return null;
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full text-[10px] font-bold cursor-help hover:bg-amber-100 transition-colors ml-2">
              <AlertTriangle className="w-2.5 h-2.5" />
              {warnings.length}
            </div>
          </TooltipTrigger>
          <TooltipContent className="p-0 border-none bg-transparent shadow-none" side="right">
            <WarningList warnings={warnings} />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const handleRecalculate = () => {
    const mins = parseFloat(newInterval) || 2;
    const startTime = pendingItems.length > 0 ? pendingItems[0].scheduledTime : Date.now();
    offerQueueService.recalculateAllPending(startTime, mins);
    setEditIntervalOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b bg-slate-50">
          <DialogTitle className="flex items-center justify-between">
            <span>Live Offer Queue Dashboard</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant={isProcessing ? "destructive" : "default"} onClick={toggleQueue}>
                {isProcessing ? <><Pause className="w-4 h-4 mr-2" /> Pause Queue</> : <><Play className="w-4 h-4 mr-2" /> Start Queue</>}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditIntervalOpen(!editIntervalOpen)}>
                <Settings2 className="w-4 h-4 mr-2" /> Edit Queue Settings
              </Button>

              <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => {
                if (confirm('Are you sure you want to clear all pending items from the queue?')) {
                  offerQueueService.clearQueue();
                }
              }}>
                <Trash2 className="w-4 h-4 mr-2" /> Clear Queue
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar">
          <div className="grid grid-cols-6 gap-3 mb-6">
            <div 
              className={`border p-3 rounded-lg cursor-pointer transition-all ${statusFilter === 'all' && viewMode === 'detailed' ? 'bg-slate-100 border-slate-300 ring-2 ring-slate-200' : 'bg-white border-slate-200 hover:border-slate-300'}`}
              onClick={() => {
                setStatusFilter('all');
                setViewMode('detailed');
                setUserSearch('');
              }}
            >
              <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Total Items</div>
              <div className="text-2xl font-bold text-slate-700">{queue.filter(i => i.status !== 'removed').length}</div>
            </div>
            
            <div 
              className={`border p-3 rounded-lg cursor-pointer transition-all ${viewMode === 'user' ? 'bg-green-50 border-green-200 ring-2 ring-green-100' : 'bg-white border-slate-200 hover:border-green-300'}`}
              onClick={() => {
                setStatusFilter('all');
                setViewMode('user');
                setUserSearch('');
              }}
            >
              <div className="text-[10px] text-green-700 font-bold uppercase mb-1">Users Reached</div>
              <div className="text-2xl font-bold text-green-600">{uniqueUsersSent} <span className="text-sm font-normal text-green-500">Users</span></div>
            </div>
            
            <div 
              className={`border p-3 rounded-lg cursor-pointer transition-all ${statusFilter === 'queued' ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-100' : 'bg-white border-slate-200 hover:border-indigo-300'}`}
              onClick={() => {
                setStatusFilter('queued');
                setViewMode('detailed');
              }}
            >
              <div className="text-[10px] text-indigo-700 font-bold uppercase mb-1">Pending</div>
              <div className="text-2xl font-bold text-indigo-600">{pendingItems.length}</div>
            </div>

            <div 
              className={`border p-3 rounded-lg cursor-pointer transition-all ${statusFilter === 'skipped' ? 'bg-orange-50 border-orange-200 ring-2 ring-orange-100' : 'bg-white border-slate-200 hover:border-orange-300'}`}
              onClick={() => {
                setStatusFilter('skipped');
                setViewMode('detailed');
              }}
            >
              <div className="text-[10px] text-orange-700 font-bold uppercase mb-1">Skipped</div>
              <div className="text-2xl font-bold text-orange-600">{skippedItems.length}</div>
            </div>

            <div 
              className={`border p-3 rounded-lg cursor-pointer transition-all ${statusFilter === 'removed' ? 'bg-red-50 border-red-200 ring-2 ring-red-100' : 'bg-white border-slate-200 hover:border-red-300'}`}
              onClick={() => {
                setStatusFilter('removed');
                setViewMode('detailed');
              }}
            >
              <div className="text-[10px] text-red-700 font-bold uppercase mb-1">Deleted</div>
              <div className="text-2xl font-bold text-red-600">{removedItems.length}</div>
            </div>

            <div 
              className={`border p-3 rounded-lg cursor-pointer transition-all ${statusFilter === 'paused' ? 'bg-amber-50 border-amber-200 ring-2 ring-amber-100' : 'bg-white border-slate-200 hover:border-amber-300'}`}
              onClick={() => {
                setStatusFilter('paused');
                setViewMode('user');
                setUserSearch('');
              }}
            >
              <div className="text-[10px] text-amber-700 font-bold uppercase mb-1">Paused</div>
              <div className="text-2xl font-bold text-amber-600">{totalPausedUsers} <span className="text-sm font-normal text-amber-500">Users</span></div>
            </div>
          </div>

          {editIntervalOpen && (
            <div className="mb-6 p-4 bg-indigo-50/50 border border-indigo-100 rounded-lg flex items-end gap-4 animate-in fade-in slide-in-from-top-4">
              <div>
                <label className="text-sm font-semibold text-indigo-900 block mb-1">Change Interval (Minutes)</label>
                <Input type="number" value={newInterval} onChange={e => setNewInterval(e.target.value)} className="w-32 bg-white" />
              </div>
              <Button onClick={handleRecalculate}>Apply & Recalculate</Button>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button 
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'user' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-indigo-500'}`}
                  onClick={() => setViewMode('user')}
                >
                  Publishers Summary
                </button>
                <button 
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'detailed' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-indigo-500'}`}
                  onClick={() => setViewMode('detailed')}
                >
                  Detailed Queue Log
                </button>
              </div>
              
              <div className="h-6 w-[1px] bg-slate-200 mx-1" />

              <div className="flex items-center gap-2">
                <Select value={dateFilter} onValueChange={(v: any) => setDateFilter(v)}>
                  <SelectTrigger className="w-[130px] h-9 text-xs bg-white border-slate-200 focus:ring-indigo-500">
                    <SelectValue placeholder="All Time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="yesterday">Yesterday</SelectItem>
                    <SelectItem value="custom">Custom Date</SelectItem>
                  </SelectContent>
                </Select>
                
                {dateFilter === 'custom' && (
                  <Input 
                    type="date" 
                    value={customDate} 
                    onChange={(e) => setCustomDate(e.target.value)} 
                    className="h-9 w-[140px] text-xs py-0 focus:ring-indigo-500"
                  />
                )}

                {statusFilter === 'paused' && userSummary.length > 0 && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-9 text-xs text-green-600 border-green-200 hover:bg-green-50"
                    onClick={() => {
                      userSummary.forEach(u => {
                        if (u.isPaused) offerQueueService.toggleUserPause(u.userId);
                      });
                      toast({ title: "Users Resumed", description: `Successfully resumed outreach for ${userSummary.length} publishers.` });
                    }}
                  >
                    <Play className="w-3.5 h-3.5 mr-1.5" /> Resume All
                  </Button>
                )}
              </div>
            </div>

            <div className="relative flex-1 max-w-xs">
              <Input 
                placeholder={viewMode === 'user' ? "Search publisher..." : "Search user or offer..."} 
                value={userSearch} 
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-8 h-9 text-xs focus:ring-indigo-500"
              />
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              {userSearch && (
                <button 
                  onClick={() => {
                    setUserSearch('');
                    setStatusFilter('all');
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead>User</TableHead>
                  {viewMode === 'detailed' ? (
                    <>
                      <TableHead>Offer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Scheduled At</TableHead>
                      <TableHead>Delivered At</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead className="text-center">Sent</TableHead>
                      <TableHead className="text-center">Pending</TableHead>
                      <TableHead className="text-center">Skipped</TableHead>
                      <TableHead>Last Sent Offer</TableHead>
                      <TableHead>Next Send</TableHead>
                    </>
                  )}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {viewMode === 'detailed' ? (
                  filteredQueue.map((item, idx) => (
                    <TableRow key={item.id} className={item.status === 'sent' ? 'bg-green-50/30' : ''}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-medium whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {item.username}
                          <WarningBadge warnings={getOfferWarnings(item.userId, item.offerId, item.scheduledTime)} />
                        </div>
                        {item.status === 'queued' && (
                          <WarningList warnings={getOfferWarnings(item.userId, item.offerId, item.scheduledTime)} />
                        )}
                      </TableCell>
                      <TableCell className="max-w-[250px] truncate" title={item.offerName}>{item.offerName}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {item.status === 'sent' && <span className="flex items-center text-green-600 text-sm"><span className="w-2 h-2 rounded-full bg-green-500 mr-2" /> Sent</span>}
                          {item.status === 'sending' && <span className="flex items-center text-blue-600 text-sm"><span className="w-2 h-2 rounded-full bg-blue-500 mr-2 animate-pulse" /> Sending</span>}
                          {item.status === 'queued' && <span className="flex items-center text-slate-600 text-sm"><span className="w-2 h-2 rounded-full bg-slate-300 mr-2" /> Pending</span>}
                          {item.status === 'skipped' && <span className="flex items-center text-orange-600 text-sm"><span className="w-2 h-2 rounded-full bg-orange-400 mr-2" /> Skipped</span>}
                          {item.status === 'removed' && <span className="flex items-center text-red-600 text-sm"><span className="w-2 h-2 rounded-full bg-red-400 mr-2" /> Deleted</span>}
                          
                          {item.status === 'queued' && item.isUrgent && <span className="text-xs text-red-500 font-semibold bg-red-50 px-1 rounded inline-block w-max mt-1">Urgent</span>}
                          {item.status === 'queued' && item.isPaused && <span className="text-xs text-amber-600 font-semibold bg-amber-50 px-1 rounded inline-block w-max mt-1">User Paused</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{new Date(item.scheduledTime).toLocaleTimeString()}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.status === 'sent' ? new Date(item.scheduledTime).toLocaleTimeString() : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.status === 'queued' ? (
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-500 hover:text-indigo-600" title="Edit Scheduled Time" onClick={() => {
                              setEditingItem(item);
                              const dt = new Date(item.scheduledTime);
                              dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
                              setEditTime(dt.toISOString().slice(0, 16));
                            }}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>

                            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-500 hover:text-amber-600" title={item.isPaused ? "Resume User" : "Pause User"} onClick={() => {
                              offerQueueService.toggleUserPause(item.userId);
                            }}>
                              {item.isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-500 hover:text-orange-600" title="Skip Offer" onClick={() => {
                              offerQueueService.updateItemStatus(item.id, 'skipped');
                            }}>
                              <SkipForward className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-500 hover:text-indigo-600" title="Resend Now" onClick={() => {
                              setResendingItem(item);
                              const dt = new Date();
                              dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
                              setResendTime(dt.toISOString().slice(0, 16));
                            }}>
                              <RotateCcw className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-500 hover:text-red-600" title="Delete from Log" onClick={() => {
                              offerQueueService.removeItem(item.id);
                            }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            {item.status === 'sent' ? (
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 hover:bg-green-50" title="Resend" onClick={() => {
                                setResendingItem(item);
                                const dt = new Date();
                                dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
                                setResendTime(dt.toISOString().slice(0, 16));
                              }}>
                                <RotateCcw className="w-3.5 h-3.5" />
                              </Button>
                            ) : (
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-indigo-600 hover:bg-indigo-50" title="Restore to Queue" onClick={() => {
                                offerQueueService.updateItemStatus(item.id, 'queued');
                                toast({ title: "Restored", description: "Item moved back to Pending queue." });
                              }}>
                                <RotateCcw className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  userSummary.map((user, idx) => (
                    <TableRow key={user.userId}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-medium cursor-pointer text-indigo-600 hover:underline" onClick={() => {
                        setUserSearch(user.userId);
                        setViewMode('detailed');
                      }}>{user.username}</TableCell>
                      <TableCell className="text-center font-bold text-green-600 cursor-pointer hover:scale-110 transition-transform" onClick={() => {
                        setUserSearch(user.userId);
                        setStatusFilter('sent');
                        setViewMode('detailed');
                      }}>{user.sent}</TableCell>
                      <TableCell className="text-center font-bold text-indigo-600 cursor-pointer hover:scale-110 transition-transform" onClick={() => {
                        setUserSearch(user.userId);
                        setStatusFilter('queued');
                        setViewMode('detailed');
                      }}>
                        {user.pending} {user.isPaused && <span className="text-[10px] text-amber-600">(Paused)</span>}
                      </TableCell>
                      <TableCell className="text-center text-orange-600 cursor-pointer hover:scale-110 transition-transform" onClick={() => {
                        setUserSearch(user.userId);
                        setStatusFilter('skipped');
                        setViewMode('detailed');
                      }}>{user.skipped}</TableCell>
                      <TableCell className="text-xs max-w-[150px] truncate" title={user.lastSentName}>
                        <div className="flex flex-col">
                          <span>{user.lastSentName}</span>
                          {user.lastSentTime && <span className="text-[10px] text-muted-foreground">{new Date(user.lastSentTime).toLocaleTimeString()}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {user.nextScheduled ? new Date(user.nextScheduled).toLocaleTimeString() : 'Done'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-indigo-600 hover:bg-indigo-50" title="Edit Next Send" onClick={(e) => {
                            e.stopPropagation();
                            const next = offerQueueService.getNextItemForUser(user.userId);
                            if (next) {
                               setEditingItem(next);
                               const dt = new Date(next.scheduledTime);
                               dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
                               setEditTime(dt.toISOString().slice(0, 16));
                            } else {
                               toast({ title: "No Pending Offers", description: "This user has no scheduled offers to edit." });
                            }
                          }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-amber-600 hover:bg-amber-50" title={user.isPaused ? 'Resume User' : 'Pause User'} onClick={(e) => {
                            e.stopPropagation();
                            offerQueueService.toggleUserPause(user.userId);
                          }}>
                            {user.isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-orange-600 hover:bg-orange-50" title="Skip Next" onClick={(e) => {
                             e.stopPropagation();
                             if (user.pending > 0) {
                                offerQueueService.skipNextForUser(user.userId);
                             } else {
                                toast({ title: "Nothing to Skip", description: "This user has no pending offers in the queue." });
                             }
                          }}>
                             <SkipForward className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 hover:bg-green-50" title="Resend Last Sent" onClick={(e) => {
                             e.stopPropagation();
                             // Find last sent item for this user
                             const sentItemsForUser = queue.filter(q => q.userId === user.userId && q.status === 'sent');
                             if (sentItemsForUser.length > 0) {
                                const last = sentItemsForUser.sort((a, b) => b.scheduledTime - a.scheduledTime)[0];
                                setResendingItem(last);
                                const dt = new Date();
                                dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
                                setResendTime(dt.toISOString().slice(0, 16));
                             }
                          }}>
                             <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600 hover:bg-red-50" title="Clear All" onClick={(e) => {
                            e.stopPropagation();
                            offerQueueService.removeItemsForUser(user.userId);
                          }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
                {queue.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No items in the queue.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>

      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Queue Item</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-4 py-4">
              <div className="text-sm">
                <span className="font-semibold">User:</span> {editingItem.username}
              </div>
              <div className="text-sm">
                <span className="font-semibold">Offer:</span> {editingItem.offerName}
              </div>
              <div className="py-2 border-t border-b border-slate-100">
                <div className="text-[10px] font-bold uppercase text-slate-400 mb-2">Safety Check / Timing Advice</div>
                <WarningList warnings={getOfferWarnings(editingItem.userId, editingItem.offerId, new Date(editTime).getTime() || editingItem.scheduledTime)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Scheduled Time</label>
                <Input 
                  type="datetime-local" 
                  value={editTime} 
                  onChange={e => setEditTime(e.target.value)} 
                />
              </div>
              <Button className="w-full mt-4" onClick={() => {
                if (editTime) {
                  const newTimestamp = new Date(editTime).getTime();
                  offerQueueService.updateItemTime(editingItem.id, newTimestamp);
                  // Auto recalculate the rest based on current global interval
                  offerQueueService.recalculateAllPending(newTimestamp, parseFloat(newInterval) || 2);
                  setEditingItem(null);
                }
              }}>Save Changes</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!resendingItem} onOpenChange={(open) => !open && setResendingItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-green-600" />
              Resend Offer
            </DialogTitle>
          </DialogHeader>
          {resendingItem && (
            <div className="space-y-4 py-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="text-sm mb-1">
                  <span className="font-semibold text-slate-500">Target User:</span> <span className="font-medium">{resendingItem.username}</span>
                </div>
                <div className="text-sm">
                  <span className="font-semibold text-slate-500">Offer Name:</span> <span className="font-medium">{resendingItem.offerName}</span>
                </div>
              </div>

              <div className="py-2 border-t border-b border-slate-100">
                <div className="text-[10px] font-bold uppercase text-slate-400 mb-2">Safety Check / Timing Advice</div>
                <WarningList warnings={getOfferWarnings(resendingItem.userId, resendingItem.offerId, new Date(resendTime).getTime() || Date.now())} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-slate-500">Start Time</label>
                  <Input 
                    type="datetime-local" 
                    value={resendTime} 
                    onChange={e => setResendTime(e.target.value)} 
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-slate-500">Sequence Interval (Mins)</label>
                  <Input 
                    type="number" 
                    value={newInterval} 
                    onChange={e => setNewInterval(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  <strong>Note:</strong> Resending will clone this offer and add it back to the queue. 
                  The interval will be used to staggering any other pending offers after this one.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setResendingItem(null)}>Cancel</Button>
                <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => {
                  if (resendTime) {
                    const newTimestamp = new Date(resendTime).getTime();
                    offerQueueService.resendItem(resendingItem.id, newTimestamp);
                    // Also recalculate following items based on the new interval
                    offerQueueService.recalculateAllPending(newTimestamp, parseFloat(newInterval) || 2);
                    setResendingItem(null);
                  }
                }}>Confirm Resend</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};
