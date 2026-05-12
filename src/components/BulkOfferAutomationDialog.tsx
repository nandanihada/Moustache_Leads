import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { X, RotateCcw, AlertTriangle, RefreshCw, Info, XCircle, Clock, Calendar, Mail, ChevronRight, CheckCircle2, AlertCircle, RotateCw, Eye } from 'lucide-react';
import { loginLogsService } from '@/services/loginLogsService';
import { offerQueueService } from '@/services/offerQueueService';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface BulkOfferAutomationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUsers: any[];
  onScheduled?: () => void;
}

interface UserSelection {
  id: string;
  username: string;
  selected: boolean;
  offersCount: number;
  fetchedOffers: any[];
  skippedOfferIds: Set<string>;
  loadingOffers: boolean;
  expanded: boolean;
}

export const BulkOfferAutomationDialog: React.FC<BulkOfferAutomationDialogProps> = ({ open, onOpenChange, selectedUsers, onScheduled }) => {
  const [intervalValue, setIntervalValue] = useState('2');
  const [intervalUnit, setIntervalUnit] = useState('minutes');
  const [sendMode, setSendMode] = useState<'single'|'combined'>('single');
  const [startMode, setStartMode] = useState<'immediate'|'scheduled'>('immediate');
  const [scheduledStartTime, setScheduledStartTime] = useState('');
  const [userSelections, setUserSelections] = useState<UserSelection[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewItems, setPreviewItems] = useState<any[]>([]);
  const [showMailPreview, setShowMailPreview] = useState(false);
  const [selectedPreviewItem, setSelectedPreviewItem] = useState<any>(null);
  const { toast } = useToast();

  const getOfferWarnings = (userId: string, offerId: string | undefined, scheduledTime: number) => {
    const warnings: { type: 'A' | 'B' | 'C' | 'D' | 'E', message: string, icon: any, color: string }[] = [];
    const user = selectedUsers.find(u => u.user_id === userId);
    
    // For Type E (Already received), we check the live queue history from the service
    const liveQueue = offerQueueService.getQueue();
    const sentHistory = liveQueue.filter(q => q.userId === userId && q.status === 'sent');
    
    if (offerId) {
      const alreadySent = sentHistory.find(h => h.offerId === offerId || (h.offerIds && h.offerIds.includes(offerId)));
      if (alreadySent) {
        warnings.push({
          type: 'E',
          message: `This user was already sent this offer on ${new Date(alreadySent.scheduledTime).toLocaleDateString()}.`,
          icon: RefreshCw,
          color: 'text-orange-600'
        });
      }
    }

    if (!user || !user.logs || user.logs.length === 0) {
      warnings.push({ type: 'D', message: "No activity data available for this user.", icon: Info, color: 'text-blue-500' });
      return warnings;
    }

    if (user.isSuspicious) {
      warnings.push({ type: 'B', message: "Account has security flags (Suspicious IP/Shared).", icon: XCircle, color: 'text-red-600' });
    }

    // Type A: Peak hours
    const hours = user.logs.map((l: any) => new Date(l.login_time).getHours());
    const hourCounts: Record<number, number> = {};
    hours.forEach(h => hourCounts[h] = (hourCounts[h] || 0) + 1);
    const peakHour = Object.entries(hourCounts).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
    if (peakHour && Number(peakHour[1]) > 1) {
      const peak = Number(peakHour[0]);
      const scheduledHour = new Date(scheduledTime).getHours();
      if (scheduledHour >= peak && scheduledHour <= peak + 2) {
        warnings.push({ type: 'A', message: "Scheduled during user's peak activity window.", icon: AlertTriangle, color: 'text-amber-600' });
      }
    }

    // Type C: Timezone
    if (user.country) {
       const offsets: Record<string, number> = { 'US': -5, 'IN': 5.5, 'GB': 0, 'AU': 10, 'BD': 6 };
       const offset = offsets[user.country] || 0;
       const localHour = new Date(scheduledTime + (offset * 3600000)).getUTCHours();
       if (localHour < 8 || localHour > 20) {
         warnings.push({ type: 'C', message: `Local time (${localHour}:00) is outside 8AM-8PM.`, icon: AlertTriangle, color: 'text-amber-600' });
       }
    }

    return warnings;
  };

  const WarningBadge = ({ warnings }: { warnings: any[] }) => {
    if (warnings.length === 0) return null;
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full text-[9px] font-bold cursor-help hover:bg-amber-100 transition-colors ml-1">
              <AlertTriangle className="w-2.5 h-2.5" />
              {warnings.length}
            </div>
          </TooltipTrigger>
          <TooltipContent className="p-2 bg-white border shadow-lg max-w-xs rounded-lg" side="right">
            <div className="space-y-1.5">
              {warnings.map((w, idx) => (
                <div key={idx} className="flex items-start gap-2 text-[10px] leading-tight">
                  <w.icon className={`w-3 h-3 mt-0.5 shrink-0 ${w.color}`} />
                  <span className="text-slate-700 font-medium">{w.message}</span>
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  useEffect(() => {
    if (open) {
      const initSels = selectedUsers.map(u => ({
        id: u.user_id,
        username: u.username || u.email?.split('@')[0] || 'User',
        selected: true,
        offersCount: 5,
        fetchedOffers: [],
        skippedOfferIds: new Set<string>(),
        loadingOffers: true,
        expanded: false
      }));
      setUserSelections(initSels);

      initSels.forEach(async (sel) => {
        try {
          const targeting = await loginLogsService.getInventoryMatchedOffers(sel.id);
          const allOffers: any[] = [];
          const seenIds = new Set();
          
          const addSection = (sectionName: string) => {
              if (targeting[sectionName] && Array.isArray(targeting[sectionName])) {
                  targeting[sectionName].forEach((o: any) => {
                      const id = o.offer_id || o._id;
                      if (!seenIds.has(id)) {
                          seenIds.add(id);
                          allOffers.push(o);
                      }
                  });
              }
          };
          addSection('most_approved');
          addSection('newly_added');
          addSection('highly_clicked');
          addSection('recently_edited');
          addSection('recently_deleted');
          
          setUserSelections(prev => prev.map(p => p.id === sel.id ? { ...p, fetchedOffers: allOffers, loadingOffers: false } : p));
        } catch (e) {
          setUserSelections(prev => prev.map(p => p.id === sel.id ? { ...p, loadingOffers: false } : p));
        }
      });
    }
  }, [open, selectedUsers]);

  const handleConfirm = async () => {
    if (!showPreview) {
      // Generate items for preview
      let minutes = parseFloat(intervalValue) || 2;
      if (intervalUnit === 'hours') minutes *= 60;
      if (intervalUnit === 'days') minutes *= 1440;
      
      let globalIndex = offerQueueService.getQueue().filter(q => q.status === 'queued').length;
      let startTime = Date.now();
      if (startMode === 'scheduled' && scheduledStartTime) {
        startTime = new Date(scheduledStartTime).getTime();
      }

      const activeUsers = userSelections.filter(u => u.selected);
      const generatedItems: any[] = [];

      for (const userSel of activeUsers) {
        const user = selectedUsers.find(u => u.user_id === userSel.id);
        if (!user) continue;
        
        const topOffers = userSel.fetchedOffers.slice(0, userSel.offersCount).filter(o => !userSel.skippedOfferIds.has(o.offer_id || o._id));
        if (topOffers.length === 0) continue;

        if (sendMode === 'combined') {
           const offerIds = topOffers.map(o => o.offer_id || o._id).filter(Boolean);
           generatedItems.push({
              userId: user.user_id,
              username: user.username || user.email?.split('@')[0] || 'User',
              offerIds: offerIds,
              offerName: `${offerIds.length} offers combined`,
              scheduledTime: startTime + (globalIndex * minutes * 60000),
              sendMode: 'combined',
              ip: user.logs[0]?.ip_address || user.ip,
              city: user.city,
              country: user.country
           });
           globalIndex++;
        } else {
           topOffers.forEach((o) => {
              generatedItems.push({
                userId: user.user_id,
                username: user.username || user.email?.split('@')[0] || 'User',
                offerId: o.offer_id || o._id,
                offerName: o.name || o.offer_name || 'Offer',
                scheduledTime: startTime + (globalIndex * minutes * 60000),
                sendMode: 'single',
                ip: user.logs[0]?.ip_address || user.ip,
                city: user.city,
                country: user.country
              });
              globalIndex++;
           });
        }
      }
      setPreviewItems(generatedItems);
      setShowPreview(true);
      return;
    }

    // Actually add items from preview
    setIsProcessing(true);
    try {
      offerQueueService.addItems(previewItems);
      toast({ title: 'Global Queue Scheduled', description: `Successfully scheduled ${previewItems.length} emails to the live queue.` });
      setIsProcessing(false);
      setShowPreview(false);
      if (onScheduled) {
        onScheduled();
      } else {
        onOpenChange(false);
      }
    } catch (e) {
      console.error(`Failed to schedule offers`, e);
      toast({ title: 'Error', description: 'Failed to schedule offers to queue.', variant: 'destructive' });
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{showPreview ? 'Review Queue Preview' : 'Automate Offers Queue'}</DialogTitle>
          <DialogDescription>
            {showPreview 
              ? 'Please review the generated schedule before committing to the live queue.' 
              : 'Configure the bulk mailing queue for your selected users.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
           {!showPreview ? (
             <>
               <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-800">1. Select Send Mode</label>
                <Select value={sendMode} onValueChange={(v: any) => setSendMode(v)}>
                  <SelectTrigger className="border-indigo-200 focus:ring-indigo-500"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Send 1 Email per Offer (e.g. 5 offers = 5 separate emails per user)</SelectItem>
                    <SelectItem value="combined">Combine Offers into 1 Email (e.g. 5 offers = 1 single email per user)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-800">2. Configure Users & Offers</label>
                <div className="border rounded-md max-h-[300px] overflow-y-auto p-2 bg-slate-50 space-y-2 custom-scrollbar">
                  {userSelections.map((u, i) => (
                    <div key={u.id} className="flex flex-col p-2 bg-white rounded shadow-sm border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Checkbox 
                            checked={u.selected} 
                            onCheckedChange={(checked) => {
                              const newSels = [...userSelections];
                              newSels[i].selected = !!checked;
                              setUserSelections(newSels);
                            }} 
                          />
                          <span className="text-sm font-medium">{u.username}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Offers to send:</span>
                          <Select 
                            disabled={!u.selected}
                            value={u.offersCount.toString()} 
                            onValueChange={(val) => {
                              const newSels = [...userSelections];
                              newSels[i].offersCount = parseInt(val);
                              setUserSelections(newSels);
                            }}
                          >
                            <SelectTrigger className="w-20 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1</SelectItem>
                              <SelectItem value="2">2</SelectItem>
                              <SelectItem value="3">3</SelectItem>
                              <SelectItem value="5">5</SelectItem>
                              <SelectItem value="10">10</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      {u.selected && (
                        <div className="mt-2 pl-7">
                          <button 
                            className="text-xs text-indigo-600 hover:underline"
                            onClick={() => {
                              const newSels = [...userSelections];
                              newSels[i].expanded = !newSels[i].expanded;
                              setUserSelections(newSels);
                            }}
                          >
                            {u.expanded ? 'Hide Offers' : 'View / Skip Offers'} {u.loadingOffers && '(Loading...)'}
                          </button>
                          
                          {u.expanded && !u.loadingOffers && (
                            <div className="mt-2 space-y-1 pl-2 border-l-2 border-indigo-100">
                              {u.fetchedOffers.slice(0, u.offersCount).map(o => {
                                const oId = o.offer_id || o._id;
                                const isSkipped = u.skippedOfferIds.has(oId);
                                return (
                                  <div key={oId} className="flex items-center gap-2 py-1">
                                    <Checkbox 
                                      checked={!isSkipped} 
                                      onCheckedChange={(checked) => {
                                        const newSels = [...userSelections];
                                        if (checked) {
                                          newSels[i].skippedOfferIds.delete(oId);
                                        } else {
                                          newSels[i].skippedOfferIds.add(oId);
                                        }
                                        setUserSelections(newSels);
                                      }} 
                                    />
                                    <span className={`text-xs ${isSkipped ? 'text-muted-foreground line-through' : ''}`}>
                                      {o.name || o.offer_name || 'Offer'}
                                    </span>
                                  </div>
                                );
                              })}
                              {u.fetchedOffers.length === 0 && <span className="text-xs text-muted-foreground">No matching offers found.</span>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {userSelections.length === 0 && (
                    <p className="text-sm text-center py-4 text-muted-foreground">No users selected. Please select users from the list first.</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-800">3. Schedule Start Time</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" checked={startMode === 'immediate'} onChange={() => setStartMode('immediate')} />
                    Start Immediately
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" checked={startMode === 'scheduled'} onChange={() => setStartMode('scheduled')} />
                    Pick Date & Time
                  </label>
                </div>
                {startMode === 'scheduled' && (
                  <Input type="datetime-local" value={scheduledStartTime} onChange={e => setScheduledStartTime(e.target.value)} className="w-64 mt-2" />
                )}
              </div>

              <div className="space-y-2 p-4 bg-indigo-50/50 rounded-lg border border-indigo-100">
                <label className="text-sm font-semibold text-indigo-900">4. Interval Between Mails (Global)</label>
                <div className="flex gap-2">
                   <Input type="number" value={intervalValue} onChange={(e) => setIntervalValue(e.target.value)} className="w-24 bg-white" />
                   <Select value={intervalUnit} onValueChange={setIntervalUnit}>
                     <SelectTrigger className="flex-1 bg-white"><SelectValue /></SelectTrigger>
                     <SelectContent>
                       <SelectItem value="minutes">Minutes</SelectItem>
                       <SelectItem value="hours">Hours</SelectItem>
                       <SelectItem value="days">Days</SelectItem>
                     </SelectContent>
                   </Select>
                </div>
              </div>
             </>
           ) : (
             <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 p-3 rounded text-xs text-amber-800 flex justify-between items-center">
                  <span>Total of <strong>{previewItems.length} items</strong> will be added to the live queue.</span>
                  {previewItems.length === 0 && <span className="text-red-600 font-bold">No items remaining!</span>}
                </div>
                <div className="border rounded-md max-h-[400px] overflow-y-auto bg-slate-50 custom-scrollbar">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-200 sticky top-0">
                      <tr>
                        <th className="p-2 text-left">User</th>
                        <th className="p-2 text-left">Offer</th>
                        <th className="p-2 text-left">Scheduled Time</th>
                        <th className="p-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {previewItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-white transition-colors group">
                          <td className="p-2 font-medium">
                            <div className="flex items-center">
                              {item.username}
                              <WarningBadge warnings={getOfferWarnings(item.userId, item.offerId, item.scheduledTime)} />
                            </div>
                          </td>
                          <td className="p-2">{item.offerName}</td>
                          <td className="p-2">
                             <div className="flex flex-col">
                               <span>{new Date(item.scheduledTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                               {getOfferWarnings(item.userId, item.offerId, item.scheduledTime).length > 0 && (
                                 <span className="text-[9px] text-amber-600 font-semibold mt-0.5">⚠ Safety Advice Available</span>
                               )}
                             </div>
                          </td>
                          <td className="p-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                                <Button 
                                    variant="outline" 
                                    size="icon" 
                                    className="h-6 w-6 text-blue-600 border-blue-200 hover:bg-blue-50 rounded-full"
                                    onClick={() => {
                                        setSelectedPreviewItem(item);
                                        setShowMailPreview(true);
                                    }}
                                    title="Preview Email"
                                >
                                    <Eye className="w-3 h-3" />
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                                    onClick={() => {
                                        setPreviewItems(prev => prev.filter((_, i) => i !== idx));
                                    }}
                                    title="Exclude from schedule"
                                >
                                    <X className="w-3 h-3" />
                                </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
             </div>
           )}

          <div className="p-4 bg-slate-100 rounded-lg border text-sm space-y-1">
            <h4 className="font-semibold mb-2">Queue Summary</h4>
            <div className="flex justify-between"><span>Total Users Selected:</span> <strong>{userSelections.filter(u => u.selected).length}</strong></div>
            <div className="flex justify-between">
              <span>Total Emails to Send:</span> 
              <strong>
                {(() => {
                  if (sendMode === 'combined') {
                     return userSelections.filter(u => u.selected).length;
                  } else {
                     return userSelections.filter(u => u.selected).reduce((acc, u) => {
                        const topOffers = u.fetchedOffers.slice(0, u.offersCount).filter(o => !u.skippedOfferIds.has(o.offer_id || o._id));
                        return acc + topOffers.length;
                     }, 0);
                  }
                })()}
              </strong>
            </div>
            <div className="flex justify-between"><span>Interval:</span> <strong>{intervalValue} {intervalUnit}</strong></div>
            <div className="flex justify-between"><span>Estimated Completion Time:</span> 
              <strong>
                {(() => {
                  let total = 0;
                  if (sendMode === 'combined') {
                     total = userSelections.filter(u => u.selected).length;
                  } else {
                     total = userSelections.filter(u => u.selected).reduce((acc, u) => {
                        const topOffers = u.fetchedOffers.slice(0, u.offersCount).filter(o => !u.skippedOfferIds.has(o.offer_id || o._id));
                        return acc + topOffers.length;
                     }, 0);
                  }
                  const min = (parseFloat(intervalValue) || 0) * (intervalUnit === 'hours' ? 60 : intervalUnit === 'days' ? 1440 : 1);
                  return `${(total * min).toFixed(1)} mins`;
                })()}
              </strong>
            </div>
            <div className="flex justify-between"><span>Estimated Finish At:</span> 
              <strong>
                {(() => {
                  let total = 0;
                  if (sendMode === 'combined') {
                     total = userSelections.filter(u => u.selected).length;
                  } else {
                     total = userSelections.filter(u => u.selected).reduce((acc, u) => {
                        const topOffers = u.fetchedOffers.slice(0, u.offersCount).filter(o => !u.skippedOfferIds.has(o.offer_id || o._id));
                        return acc + topOffers.length;
                     }, 0);
                  }
                  const min = (parseFloat(intervalValue) || 0) * (intervalUnit === 'hours' ? 60 : intervalUnit === 'days' ? 1440 : 1);
                  const st = startMode === 'scheduled' && scheduledStartTime ? new Date(scheduledStartTime).getTime() : Date.now();
                  return new Date(st + (total * min * 60000)).toLocaleTimeString();
                })()}
              </strong>
            </div>
          </div>
        </div>
        <DialogFooter>
          {showPreview ? (
            <>
              <Button variant="outline" onClick={() => setShowPreview(false)}>Back to Edit</Button>
              <Button onClick={handleConfirm} disabled={isProcessing} className="bg-green-600 hover:bg-green-700">
                {isProcessing ? 'Scheduling...' : 'Confirm & Move to Live Queue'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleConfirm} disabled={isProcessing || userSelections.filter(u => u.selected).length === 0}>
                {isProcessing ? 'Generating...' : 'Preview Schedule'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
      
      {/* Email Preview Modal */}
      <Dialog open={showMailPreview} onOpenChange={setShowMailPreview}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl">
              <div style={{ fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif', width: '100%', margin: '0 auto', color: '#334155', lineHeight: '1.6', background: '#f8fafc' }}>
                  <div style={{ background: 'linear-gradient(135deg, #185FA5 0%, #2563EB 100%)', padding: '25px', textAlign: 'center' }}>
                      <h1 style={{ color: '#ffffff', margin: 0, fontSize: '22px' }}>Email Preview: Top Performing Offers</h1>
                      <p style={{ color: '#bfdbfe', margin: '8px 0 0 0', fontSize: '13px' }}>Recipient: <strong>{selectedPreviewItem?.username}</strong></p>
                  </div>
                  
                  <div style={{ padding: '25px', background: '#ffffff', border: '1px solid #e2e8f0', margin: '20px', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
                      <p style={{ fontSize: '15px', marginBottom: '15px' }}>Hello {selectedPreviewItem?.username},</p>
                      <p style={{ marginBottom: '20px', fontSize: '14px' }}>Our intelligence engine has identified several high-converting opportunities tailored to your traffic profile. Here are your top matches for today:</p>
                      
                      <div style={{ overflowX: 'auto', marginBottom: '25px' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '500px' }}>
                              <thead>
                                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                      <th style={{ padding: '10px 6px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>ID</th>
                                      <th style={{ padding: '10px 6px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Offer Name</th>
                                      <th style={{ padding: '10px 6px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Payout</th>
                                      <th style={{ padding: '10px 6px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Network</th>
                                      <th style={{ padding: '10px 6px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Countries</th>
                                      <th style={{ padding: '10px 6px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Category</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                      <td style={{ padding: '10px 6px', fontSize: '10px', fontFamily: 'monospace', color: '#94a3b8' }}>{selectedPreviewItem?.offerId?.slice(-6).toUpperCase() || 'ABCDEF'}</td>
                                      <td style={{ padding: '10px 6px', fontSize: '12px', fontWeight: '600', color: '#1e293b' }}>{selectedPreviewItem?.offerName}</td>
                                      <td style={{ padding: '10px 6px', fontSize: '12px', fontWeight: '700', color: '#059669' }}>$2.50+</td>
                                      <td style={{ padding: '10px 6px', fontSize: '11px', color: '#64748b' }}>Direct</td>
                                      <td style={{ padding: '10px 6px', fontSize: '10px', color: '#64748b' }}>{selectedPreviewItem?.country || 'WW'}</td>
                                      <td style={{ padding: '10px 6px' }}>
                                          <span style={{ display: 'inline-block', padding: '2px 6px', background: '#eff6ff', color: '#3b82f6', borderRadius: '4px', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase' }}>Installs</span>
                                      </td>
                                  </tr>
                                  <tr style={{ borderBottom: '1px solid #f1f5f9', opacity: 0.5 }}>
                                      <td style={{ padding: '10px 6px', fontSize: '10px', fontFamily: 'monospace', color: '#94a3b8' }}>GHIKLM</td>
                                      <td style={{ padding: '10px 6px', fontSize: '12px', fontWeight: '600', color: '#1e293b' }}>Sample Offer B</td>
                                      <td style={{ padding: '10px 6px', fontSize: '12px', fontWeight: '700', color: '#059669' }}>$4.00</td>
                                      <td style={{ padding: '10px 6px', fontSize: '11px', color: '#64748b' }}>Network X</td>
                                      <td style={{ padding: '10px 6px', fontSize: '10px', color: '#64748b' }}>US, CA</td>
                                      <td style={{ padding: '10px 6px' }}>
                                          <span style={{ display: 'inline-block', padding: '2px 6px', background: '#eff6ff', color: '#3b82f6', borderRadius: '4px', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase' }}>CPA</span>
                                      </td>
                                  </tr>
                              </tbody>
                          </table>
                      </div>
                      
                      <div style={{ textAlign: 'center', margin: '20px 0' }}>
                          <div style={{ background: '#2563EB', color: '#ffffff', padding: '10px 25px', borderRadius: '8px', display: 'inline-block', fontWeight: '700', fontSize: '14px' }}>Grab Your Deals Now</div>
                      </div>
                  </div>
                  <div className="p-4 flex justify-center">
                      <Button variant="secondary" size="sm" onClick={() => setShowMailPreview(false)}>Close Preview</Button>
                  </div>
              </div>
          </DialogContent>
      </Dialog>
    </Dialog>
  );
};
