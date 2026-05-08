import React, { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { formatDistanceToNow } from "date-fns";
import {
  Clock, Globe, Monitor, Search, CheckCircle, Eye, MousePointerClick,
  Calendar, Package, Activity, Fingerprint, ShieldAlert
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { loginLogsService } from "@/services/loginLogsService";
import { offerQueueService, OfferQueueItem, QueueStatus } from '@/services/offerQueueService';
import { SmartMessagePanel } from '@/components/SmartMessagePanel';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface UserIntelligenceProfileProps {
  log: any;
  userLogs?: any[];
  pageVisits: any[];
  offerViews: any[];
  searchLogs: any[];
  userSignals: any;
  scheduledActivity: any[];
  offerTargeting: any;
  allowedTabs?: string[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

const COLORS = {
  purple: '#7F2FBE',
  blue: '#378ADD',
  green: '#27C46E',
  orange: '#FA7C1E',
  amber: '#C89B1E',
  red: '#E8622A'
};

const CHART_COLORS = [COLORS.purple, COLORS.blue, COLORS.green, COLORS.orange, COLORS.amber, COLORS.red];


const UserAutomationTab = ({ verticalData, log, offerTargeting, offerViews, scheduledActivity, onSendOffers, sendingOffers }: any) => {
  const [queueOffers, setQueueOffers] = React.useState<any[]>([]);
  const [sendMode, setSendMode] = React.useState<'single'|'combined'>('single');
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = React.useState(false);
  
  const [liveQueue, setLiveQueue] = React.useState<OfferQueueItem[]>([]);
  const [intervalValue, setIntervalValue] = React.useState('15');
  const [intervalUnit, setIntervalUnit] = React.useState<'minutes'|'hours'|'days'>('minutes');
  const [isQueueProcessing, setIsQueueProcessing] = React.useState(true);
  
  const handleIntervalChange = (val: string, unit: 'minutes'|'hours'|'days') => {
    setIntervalValue(val);
    setIntervalUnit(unit);
    let minutes = parseInt(val) || 15;
    if (unit === 'hours') minutes *= 60;
    if (unit === 'days') minutes *= 1440;
    
    const queuedItems = liveQueue.filter(q => q.status === 'queued');
    if (queuedItems.length > 0) {
      offerQueueService.recalculateTimes(null, queuedItems[0].scheduledTime, minutes);
    }
  };

  React.useEffect(() => {
    const unsubscribe = offerQueueService.subscribe((queue) => {
      setLiveQueue(queue);
      setIsQueueProcessing(offerQueueService.getIsProcessing());
    });
    
    const handleQueueSent = (e: any) => {
      const item = e.detail;
      if (item.userId === (log.user_id || log._id)) {
        const sentEvent = {
            _id: Math.random().toString(),
            type: 'email',
            subject: `Sent: ${item.offerName}`,
            status: item.status === 'skipped' ? 'Skipped' : 'Sent',
            sent_at: new Date().toISOString(),
            offer_names: [item.offerName]
        };
        setLocalHistory(prev => [sentEvent, ...prev]);
      }
    };
    
    window.addEventListener('offer_queue_sent', handleQueueSent);
    
    return () => {
      unsubscribe();
      window.removeEventListener('offer_queue_sent', handleQueueSent);
    };
  }, [log]);
  
  const defaultDate = React.useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1);
    d.setMinutes(0);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, []);
  
  const [scheduleDate, setScheduleDate] = React.useState<string>(defaultDate);
  const [localHistory, setLocalHistory] = React.useState<any[]>([]);
  const { toast } = useToast();
  
  const [triggers, setTriggers] = React.useState<any[]>([]);
  const [channel, setChannel] = React.useState('Email');
  const [timing, setTiming] = React.useState('Daily · 10:00 AM');
  const [maxOffers, setMaxOffers] = React.useState('3 offers');
  const [preferenceFilter, setPreferenceFilter] = React.useState('Top Matches');
  const [isSavingConfig, setIsSavingConfig] = React.useState(false);

  React.useEffect(() => {
    if (scheduledActivity) {
      setLocalHistory(scheduledActivity);
    }
  }, [scheduledActivity]);

  React.useEffect(() => {
      const fetchAutomations = async () => {
          try {
              const data = await loginLogsService.getUserAutomations(log.user_id || log._id);
              if (data && Object.keys(data).length > 0) {
                  if (data.send_mode) setSendMode(data.send_mode);
                  if (data.channel) setChannel(data.channel);
                  if (data.timing) setTiming(data.timing);
                  if (data.max_offers) setMaxOffers(data.max_offers);
                  if (data.preference_filter) setPreferenceFilter(data.preference_filter);
                  if (data.triggers && data.triggers.length > 0) {
                      setTriggers(data.triggers);
                  }
              } else {
                  // Fallback defaults
                  setTriggers([
                      { id: 't1', title: 'On Login', desc: `Send top offer when ${log?.username?.split(' ')[0] || 'user'} logs in`, active: true, icon: '🔓' },
                      { id: 't2', title: `${verticalData?.[0]?.name || 'Fintech'} Page Visit`, desc: `Show offer banner after 30s on ${verticalData?.[0]?.name || 'Fintech'}`, active: true, icon: '👀' },
                      { id: 't3', title: 'Cart Abandon', desc: 'Send cashback offer if checkout dropped', active: true, icon: '🛒' },
                      { id: 't4', title: 'Inactivity — 5 days', desc: `Re-engage with top ${verticalData?.[1]?.name || 'E-commerce'} offer`, active: false, icon: '⏳' },
                      { id: 't5', title: `Location — ${log?.location?.country || 'Global'} active`, desc: `Prioritize geo offers when in ${log?.location?.country_code || 'Unknown'}`, active: false, icon: '📍' },
                  ]);
              }
          } catch (e) {
              console.error("Failed to load automations", e);
          }
      };
      if (log) {
          fetchAutomations();
      }
  }, [verticalData, log]);

  const toggleTrigger = (id: string) => {
      setTriggers(prev => prev.map(t => t.id === id ? { ...t, active: !t.active } : t));
  };

  React.useEffect(() => {
    if (!offerTargeting) return;
    
    const allOffers: any[] = [];
    const seenIds = new Set();
    
    const addSection = (sectionName: string, sourceLabel: string, baseScore: number, typeLabel: string) => {
        if (offerTargeting[sectionName] && Array.isArray(offerTargeting[sectionName])) {
            offerTargeting[sectionName].forEach((o: any, idx: number) => {
                const id = o.offer_id || o._id;
                if (!seenIds.has(id)) {
                    seenIds.add(id);
                    let matchScore = Math.max(50, baseScore - (idx * 4));
                    if (verticalData && verticalData.length > 0 && verticalData[0].name !== 'Unknown') {
                        const topCats = verticalData.slice(0, 2).map((v:any) => v.name.toLowerCase());
                        const offerCat = (o.category || '').toLowerCase();
                        if (offerCat && topCats.includes(offerCat)) {
                            matchScore = Math.min(99, matchScore + 15);
                        } else if (offerCat && verticalData.some((v:any) => v.name.toLowerCase() === offerCat)) {
                            matchScore = Math.min(99, matchScore + 5);
                        }
                    }
                    allOffers.push({
                        ...o,
                        source: sourceLabel,
                        type: typeLabel,
                        matchScore: matchScore
                    });
                }
            });
        }
    };
    
    addSection('most_approved', 'Most Approved', 98, 'Cashback');
    addSection('newly_added', 'Newly Added', 91, 'Cashback');
    addSection('highly_clicked', 'Highly Clicked', 87, 'Cashback');
    addSection('recently_edited', 'Recently Edited', 79, 'Discount');
    addSection('recently_deleted', 'Clearance', 74, 'Discount');
    
    allOffers.sort((a, b) => b.matchScore - a.matchScore);
    
    // Add some fallbacks if empty
    // Removed fake data to rely strictly on backend `offerTargeting`
    // if (allOffers.length === 0) { ... }
    
    setQueueOffers(allOffers.slice(0, 6));
  }, [offerTargeting]);

  const historyData = React.useMemo(() => {
    // Show actual scheduled activity / mail history instead of offer views
    if (!localHistory || localHistory.length === 0) return [];
    return localHistory.slice(0, 5).map((v: any) => {
        const dateStr = v.created_at || v.sent_at || v.timestamp || v.scheduled_at ? new Date(v.created_at || v.sent_at || v.timestamp || v.scheduled_at).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'Unknown Date';
        let status = (v.status === 'scheduled' || v.status === 'pending') ? 'Scheduled' : 
                     (v.status?.toLowerCase() === 'skipped' || v.subject?.toLowerCase().includes('skipped')) ? 'Skipped' : 'Sent';        
        let title = (v.offer_names && v.offer_names.length > 0) 
            ? `${status}: ${v.offer_names.join(', ')}` 
            : v.offer_count ? `${status} ${v.offer_count} offer(s)` : (v.subject || v.type || 'Email Sent');
        
        return {
            id: v._id || Math.random().toString(),
            offer: title,
            date: dateStr,
            status,
            isPending: status === 'Scheduled'
        };
    });
  }, [localHistory]);

  return (
    <div className="tab-panel active" style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: '#F4F3EF' }}>
      {/* Top Header */}
      <div style={{ marginBottom: '0px' }}>
        <div style={{ fontSize: '15px', fontWeight: '600', color: '#1a1a18' }}>Automation - {log.username || 'User'}</div>
        <div style={{ fontSize: '11px', color: '#9c9a92', marginTop: '2px' }}>Manage offer queue, send modes, triggers, and delivery history</div>
      </div>

      <div style={{ display: 'flex', gap: '16px' }}>
        {/* Left Column (Offer Queue & Send History) */}
        <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          
          {historyData.some(h => h.isPending) && (
            <div style={{ background: '#FFF4E5', border: '1px solid #FFD8A8', color: '#B05C0F', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                This person has offers in queue to send
            </div>
          )}

          {/* Live Queue View */}
          {liveQueue.length > 0 && (
            <div className="card" style={{ padding: '16px', borderRadius: '12px' }}>
               <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 12px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#1a1a18', textTransform: 'none', letterSpacing: '0' }}>
                    <Clock size={14} className="text-purple-600" /> Live Queue Status
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {isQueueProcessing ? (
                       <button onClick={() => offerQueueService.pauseQueue()} className="actn-btn" style={{ padding: '2px 8px', fontSize: '10px' }}>Pause</button>
                    ) : (
                       <button onClick={() => offerQueueService.resumeQueue()} className="actn-btn primary" style={{ padding: '2px 8px', fontSize: '10px', background: '#185FA5', color: '#fff', border: 'none' }}>Resume</button>
                    )}
                    <button onClick={() => offerQueueService.clearQueue()} className="actn-btn" style={{ padding: '2px 8px', fontSize: '10px' }}>Reset</button>
                  </div>
               </div>
               
               {/* Progress Bar & Stats */}
               <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#9c9a92', marginBottom: '6px' }}>
                     <span>{liveQueue.filter(q => q.status === 'sent').length} of {liveQueue.length} sent • {liveQueue.filter(q => q.status === 'queued').length} queued</span>
                     <span>Finishes: {liveQueue.length > 0 ? new Date(Math.max(...liveQueue.map(q => q.scheduledTime))).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'N/A'}</span>
                  </div>
                  <div style={{ height: '4px', background: '#EBF2FB', borderRadius: '2px', overflow: 'hidden' }}>
                     <div style={{ height: '100%', background: '#185FA5', width: `${(liveQueue.filter(q => q.status === 'sent').length / Math.max(liveQueue.length, 1)) * 100}%`, transition: 'width 0.3s' }}></div>
                  </div>
               </div>

               {/* Queue Items */}
               <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                 {liveQueue.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#fff', border: '1px solid #F4F3EF', borderRadius: '6px' }}>
                       <div style={{ minWidth: 0, paddingRight: '8px' }}>
                          <div style={{ fontSize: '11px', fontWeight: '500', color: '#1a1a18', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.username} • {item.offerName}</div>
                          <div style={{ fontSize: '10px', color: '#9c9a92', marginTop: '3px' }}>
                             {item.status === 'queued' ? 'Scheduled: ' : item.status === 'sending' ? 'Sending now... ' : 'Processed: '} 
                             {new Date(item.scheduledTime).toLocaleString([], {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'})}
                          </div>
                       </div>
                       <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                         <span className="badge" style={{ 
                            background: item.status === 'queued' ? '#F4F0FA' : item.status === 'sending' ? '#EBF2FB' : item.status === 'sent' ? '#E1F5EE' : '#F4F3EF',
                            color: item.status === 'queued' ? '#7F2FBE' : item.status === 'sending' ? '#185FA5' : item.status === 'sent' ? '#1D9E75' : '#9c9a92',
                            fontSize: '9px', padding: '2px 6px', borderRadius: '4px'
                         }}>
                           {item.status}
                         </span>
                         {item.status === 'queued' && (
                            <button onClick={() => offerQueueService.updateItemStatus(item.id, 'skipped')} style={{ background: 'none', border: 'none', color: '#A32D2D', fontSize: '12px', cursor: 'pointer', padding: '2px' }}>×</button>
                         )}
                       </div>
                    </div>
                 ))}
               </div>
            </div>
          )}

          {/* Offer Queue */}
          <div className="card" style={{ padding: '16px', borderRadius: '12px' }}>
             <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 4px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#1a1a18', textTransform: 'none', letterSpacing: '0' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A32D2D" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
                  Offer Queue
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span className="badge" style={{ background: '#EBF2FB', color: '#185FA5', padding: '2px 8px', fontSize: '10px', borderRadius: '4px' }}>{queueOffers.length} offers</span>
                    <button className="send-btn" style={{ padding: '2px 8px', background: '#fff', fontSize: '10px' }}>Refresh ↻</button>
                </div>
             </div>
             
             <div style={{ fontSize: '10px', color: '#9c9a92', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #F4F3EF' }}>
                Pulled from Offer Reco - Sorted by match score + preference weight - {verticalData && verticalData.length > 0 ? verticalData.slice(0,2).map((v: any) => `${v.name} ${v.value}%`).join(', ') : 'No preferences found'}
             </div>

             {/* List of Offers */}
             <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {queueOffers.length > 0 ? queueOffers.map((offer, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: '1px solid #F4F3EF', borderRadius: '8px', background: '#fff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '4px', background: '#F4F3EF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', flexShrink: 0 }}>
                                {offer.category === 'E-commerce' ? '🛍️' : offer.category === 'Travel' ? '✈️' : offer.category === 'Games' ? '🎮' : offer.category === 'Finance' ? '🏦' : '🎯'}
                            </div>
                            <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                <div style={{ fontSize: '12px', fontWeight: '500', color: '#1a1a18', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{offer.name || offer.offer_name || 'Offer'}</div>
                                <div style={{ fontSize: '10px', color: '#9c9a92', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {offer.category || 'General'} <span className="w-1 h-1 rounded-full bg-gray-300 flex-shrink-0"></span> 
                                    {offer.country || 'Global'} <span className="w-1 h-1 rounded-full bg-gray-300 flex-shrink-0"></span> 
                                    {offer.type || 'Offer'} <span className="w-1 h-1 rounded-full bg-gray-300 flex-shrink-0"></span> 
                                    {offer.source || 'Targeting'}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0, paddingLeft: '10px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '600', color: '#1D9E75', background: '#E1F5EE', padding: '2px 6px', borderRadius: '4px' }}>{offer.matchScore}% match</span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <button onClick={async () => {
                                    if (onSendOffers) {
                                        const success = await onSendOffers([offer.offer_id || offer._id]);
                                        if (success) {
                                            const sentEvent = {
                                                _id: Math.random().toString(),
                                                type: 'email',
                                                subject: `Sent: ${offer.name || offer.offer_name || 'Offer'}`,
                                                status: 'Sent',
                                                sent_at: new Date().toISOString(),
                                                offer_names: [offer.name || offer.offer_name || 'Offer']
                                            };
                                            setLocalHistory(prev => [sentEvent, ...prev]);
                                            setQueueOffers(prev => prev.filter((_, i) => i !== idx));
                                            try {
                                                const freshData = await loginLogsService.getScheduledActivity(log.user_id || log._id);
                                                // We rely on local state first to avoid DB delay, but we merge if freshData comes back
                                            } catch (e) {}
                                        }
                                    }
                                }} disabled={sendingOffers} className="actn-btn primary" style={{ padding: '4px 10px', fontSize: '10px', background: '#185FA5', borderRadius: '4px', opacity: sendingOffers ? 0.5 : 1, color: '#fff', border: 'none' }}>Send now</button>
                                <button onClick={async () => {
                                    if (onSendOffers) {
                                        const success = await onSendOffers([offer.offer_id || offer._id], 'skip');
                                        if (success) {
                                            const skipEvent = {
                                                _id: Math.random().toString(),
                                                type: 'email',
                                                subject: `Skipped: ${offer.name || offer.offer_name || 'Offer'}`,
                                                status: 'Skipped',
                                                sent_at: new Date().toISOString(),
                                                offer_names: [offer.name || offer.offer_name || 'Offer']
                                            };
                                            setLocalHistory(prev => [skipEvent, ...prev]);
                                            setQueueOffers(prev => prev.filter((_, i) => i !== idx));
                                        }
                                    }
                                }} disabled={sendingOffers} className="actn-btn" style={{ padding: '4px 10px', fontSize: '10px', background: '#fff', borderRadius: '4px', border: '1px solid #dddbd2' }}>Skip</button>
                            </div>
                        </div>
                    </div>
                )) : (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#9c9a92', fontSize: '11px', background: '#fff', borderRadius: '8px', border: '1px solid #F4F3EF' }}>No offers currently queued.</div>
                )}
             </div>

             {/* Footer Action Buttons */}
             <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #F4F3EF' }}>
                <button onClick={async () => {
                    const topOffers = queueOffers.slice(0, 3);
                    const offerIds = topOffers.map((o: any) => o.offer_id || o._id).filter(Boolean);
                    if (offerIds.length > 0) {
                        offerQueueService.addItems([{
                            userId: log.user_id || log._id,
                            username: log.username || 'User',
                            offerIds: offerIds,
                            offerName: `${offerIds.length} offers combined`,
                            scheduledTime: Date.now(),
                            sendMode: 'combined'
                        }]);
                        setQueueOffers(prev => prev.slice(3));
                        toast({ title: 'Added to Queue', description: `Added 3 offers to the live send queue.` });
                    }
                }} disabled={sendingOffers || queueOffers.length === 0} className="actn-btn" style={{ background: '#E1F5EE', color: '#085041', borderColor: '#1D9E75', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', borderRadius: '4px', padding: '4px 8px', opacity: (sendingOffers || queueOffers.length === 0) ? 0.5 : 1 }}>
                   <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13"></path><path d="M22 2L15 22L11 13L2 9L22 2Z"></path></svg>
                   Send Top 3 Combined
                </button>
                <button onClick={() => setIsScheduleDialogOpen(true)} disabled={sendingOffers || queueOffers.length === 0} className="actn-btn primary" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#378ADD', borderColor: '#378ADD', fontSize: '10px', borderRadius: '4px', padding: '4px 8px', opacity: (sendingOffers || queueOffers.length === 0) ? 0.5 : 1, color: '#fff' }}>
                   <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                   Schedule All
                </button>
                <button onClick={() => {
                    const skipEvent = {
                        _id: Math.random().toString(),
                        type: 'email',
                        subject: `Cleared Queue: ${queueOffers.length} offers skipped`,
                        status: 'Skipped',
                        sent_at: new Date().toISOString(),
                        offer_names: queueOffers.map((o: any) => o.name || o.offer_name || 'Offer')
                    };
                    setLocalHistory(prev => [skipEvent, ...prev]);
                    setQueueOffers([]);
                }} className="actn-btn" style={{ marginLeft: 'auto', background: '#fff', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', borderRadius: '4px', padding: '4px 8px' }}>
                   <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                   Clear Queue
                </button>
             </div>
          </div>

          {/* Send History */}
          <div className="card" style={{ padding: '16px', borderRadius: '12px' }}>
            <div className="card-title" style={{ fontSize: '10px', color: '#9c9a92', margin: '0 0 12px 0' }}>SEND HISTORY - LAST 30 DAYS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {historyData.length > 0 ? historyData.map((hist, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px', borderBottom: idx < historyData.length - 1 ? '1px solid #F4F3EF' : 'none' }}>
                        <span style={{ fontSize: '11px', color: '#5a5855' }}>{hist.offer}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '10px', color: '#9c9a92' }}>{hist.isPending ? `Scheduled for ${hist.date}` : hist.date}</span>
                            <span className="badge" style={{ 
                                background: hist.status === 'Clicked' ? '#EBF2FB' : hist.status === 'Opened' ? '#E1F5EE' : hist.status === 'Scheduled' ? '#FFF4E5' : '#F4F3EF', 
                                color: hist.status === 'Clicked' ? '#185FA5' : hist.status === 'Opened' ? '#1D9E75' : hist.status === 'Scheduled' ? '#FA7C1E' : '#9c9a92', 
                                width: '55px', textAlign: 'center', padding: '2px 0', fontSize: '9px', borderRadius: '4px'
                            }}>
                                {hist.status}
                            </span>
                            {hist.isPending && (
                                <button onClick={async () => {
                                  try {
                                    await loginLogsService.deleteScheduledActivity(hist.id);
                                    setLocalHistory(prev => prev.filter(x => x._id !== hist.id));
                                    toast({ title: 'Unscheduled', description: 'Activity has been removed.' });
                                  } catch(e) {
                                    toast({ title: 'Error', description: 'Failed to unschedule', variant: 'destructive' });
                                  }
                                }} style={{ fontSize: '9px', color: '#A32D2D', background: '#FCEBEB', border: 'none', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', outline: 'none' }}>Cancel</button>
                            )}
                        </div>
                    </div>
                )) : (
                    <div style={{ padding: '10px', textAlign: 'center', color: '#9c9a92', fontSize: '11px' }}>No history found.</div>
                )}
            </div>
          </div>

        </div>

        {/* Right Column (Sidebar Config) */}
        <div style={{ width: '250px', flexShrink: '0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Send Configuration */}
            <div className="card" style={{ padding: '16px', borderRadius: '12px' }}>
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#1a1a18', textTransform: 'none', letterSpacing: '0', margin: '0 0 4px 0' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    Send Configuration
                </div>
                <div style={{ fontSize: '10px', color: '#9c9a92', marginBottom: '16px' }}>Choose how offers are sent to {log.username?.split(' ')[0] || 'User'}</div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                        <div style={{ fontSize: '9px', fontWeight: '600', color: '#9c9a92', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Send Mode</div>
                        <div style={{ display: 'flex', background: '#F4F3EF', borderRadius: '6px', padding: '2px' }}>
                            <button onClick={() => setSendMode('single')} style={{ flex: 1, padding: '4px', fontSize: '11px', background: sendMode === 'single' ? '#fff' : 'transparent', border: sendMode === 'single' ? '0.5px solid #dddbd2' : 'none', borderRadius: '4px', color: sendMode === 'single' ? '#185FA5' : '#9c9a92', fontWeight: sendMode === 'single' ? '500' : '400', boxShadow: sendMode === 'single' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer', transition: 'all 0.2s' }}>1 by 1</button>
                            <button onClick={() => setSendMode('combined')} style={{ flex: 1, padding: '4px', fontSize: '11px', background: sendMode === 'combined' ? '#fff' : 'transparent', border: sendMode === 'combined' ? '0.5px solid #dddbd2' : 'none', borderRadius: '4px', color: sendMode === 'combined' ? '#185FA5' : '#9c9a92', fontWeight: sendMode === 'combined' ? '500' : '400', boxShadow: sendMode === 'combined' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer', transition: 'all 0.2s' }}>Combined</button>
                        </div>
                    </div>

                    <div>
                        <div style={{ fontSize: '9px', fontWeight: '600', color: '#9c9a92', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Channel</div>
                        <select value={channel} onChange={(e) => setChannel(e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #dddbd2', outline: 'none', fontSize: '11px' }}>
                            <option value="Email">Email</option>
                            <option value="Push">Push Notification</option>
                            <option value="SMS">SMS</option>
                        </select>
                    </div>

                    <div>
                        <div style={{ fontSize: '9px', fontWeight: '600', color: '#9c9a92', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Timing</div>
                        <select value={timing} onChange={(e) => setTiming(e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #dddbd2', outline: 'none', fontSize: '11px' }}>
                            <option value="Daily · 10:00 AM">Daily · 10:00 AM</option>
                            <option value="Weekly · Monday 9AM">Weekly · Monday 9AM</option>
                            <option value="Immediately">Immediately</option>
                        </select>
                    </div>

                    <div>
                        <div style={{ fontSize: '9px', fontWeight: '600', color: '#9c9a92', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Max Offers Per Send</div>
                        <select value={maxOffers} onChange={(e) => setMaxOffers(e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #dddbd2', outline: 'none', fontSize: '11px' }}>
                            <option value="1 offer">1 offer</option>
                            <option value="3 offers">3 offers</option>
                            <option value="5 offers">5 offers</option>
                        </select>
                    </div>

                    <div>
                        <div style={{ fontSize: '9px', fontWeight: '600', color: '#9c9a92', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Global Send Interval (Queue)</div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                           <input type="number" value={intervalValue} onChange={(e) => handleIntervalChange(e.target.value, intervalUnit)} style={{ width: '60px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #dddbd2', outline: 'none', fontSize: '11px' }} />
                           <select value={intervalUnit} onChange={(e) => handleIntervalChange(intervalValue, e.target.value as 'minutes'|'hours'|'days')} style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', border: '1px solid #dddbd2', outline: 'none', fontSize: '11px' }}>
                               <option value="minutes">Minutes</option>
                               <option value="hours">Hours</option>
                               <option value="days">Days</option>
                           </select>
                        </div>
                    </div>

                    <div>
                        <div style={{ fontSize: '9px', fontWeight: '600', color: '#9c9a92', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preference Filter</div>
                        <select value={preferenceFilter} onChange={(e) => setPreferenceFilter(e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #dddbd2', outline: 'none', fontSize: '11px', textOverflow: 'ellipsis' }}>
                            <option value="Top Matches">{verticalData && verticalData.length > 0 ? `${verticalData[0]?.name} + ${verticalData[1]?.name || 'All'}` : 'Top Matches'} (top match)</option>
                            <option value="All Verticals">All Verticals</option>
                            <option value="Strict Match Only">Strict Match Only</option>
                        </select>
                    </div>

                    <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button 
                            disabled={isSavingConfig}
                            onClick={async () => {
                                setIsSavingConfig(true);
                                try {
                                    await loginLogsService.saveUserAutomations(log.user_id || log._id, {
                                        send_mode: sendMode,
                                        channel,
                                        timing,
                                        max_offers: maxOffers,
                                        preference_filter: preferenceFilter,
                                        triggers
                                    });
                                    toast({ title: 'Success', description: `Automation configuration saved for ${log.username?.split(' ')[0] || 'User'}!` });
                                } catch (e) {
                                    toast({ title: 'Error', description: 'Failed to save configuration', variant: 'destructive' });
                                } finally {
                                    setIsSavingConfig(false);
                                }
                            }} 
                            className="actn-btn primary" 
                            style={{ width: '100%', padding: '8px', fontSize: '11px', fontWeight: '500', borderRadius: '6px', background: '#185FA5', borderColor: '#185FA5', opacity: isSavingConfig ? 0.5 : 1 }}
                        >
                            {isSavingConfig ? 'Saving...' : 'Save & Activate'}
                        </button>
                        <button onClick={async () => {
                            if(queueOffers.length > 0 && onSendOffers) {
                                const success = await onSendOffers([queueOffers[0].offer_id || queueOffers[0]._id]);
                                if (success) {
                                    try {
                                        const freshData = await loginLogsService.getScheduledActivity(log.user_id || log._id);
                                        setLocalHistory(freshData?.scheduled_activity || freshData?.activities || (Array.isArray(freshData) ? freshData : []));
                                    } catch (e) {}
                                }
                            }
                        }} disabled={sendingOffers || queueOffers.length === 0} className="actn-btn" style={{ width: '100%', padding: '8px', fontSize: '11px', background: '#fff', borderRadius: '6px', border: '1px solid #dddbd2', color: '#1a1a18', opacity: (sendingOffers || queueOffers.length === 0) ? 0.5 : 1 }}>✨ Test Send</button>
                    </div>
                </div>
            </div>

            {/* Smart Triggers */}
            <div className="card" style={{ padding: '16px', borderRadius: '12px' }}>
                <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', fontSize: '12px', color: '#1a1a18', textTransform: 'none', letterSpacing: '0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FA7C1E" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                        Smart Triggers
                    </div>
                    <span className="badge" style={{ background: '#E1F5EE', color: '#1D9E75', fontSize: '9px', padding: '2px 6px', borderRadius: '4px' }}>{triggers.filter(t => t.active).length} active</span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {triggers.map((trig, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: idx < triggers.length - 1 ? '10px' : '0', borderBottom: idx < triggers.length - 1 ? '1px solid #F4F3EF' : 'none' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <span style={{ fontSize: '14px', background: '#F4F3EF', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', flexShrink: 0 }}>{trig.icon}</span>
                                <div>
                                    <div style={{ fontSize: '11px', fontWeight: '500', color: '#1a1a18' }}>{trig.title}</div>
                                    <div style={{ fontSize: '9px', color: '#9c9a92', marginTop: '2px', lineHeight: '1.3' }}>{trig.desc}</div>
                                </div>
                            </div>
                            <label className="tog-wrap" style={{ transform: 'scale(0.75)', transformOrigin: 'right top', marginTop: '2px', flexShrink: 0 }}>
                                <input type="checkbox" checked={trig.active} onChange={() => toggleTrigger(trig.id)} />
                                <div className="tog-track" style={{ background: trig.active ? '#27C46E' : '#dddbd2' }}></div><div className="tog-thumb"></div>
                            </label>
                        </div>
                    ))}
                </div>
            </div>

        </div>
      </div>
      
      <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Offers for {log.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {historyData.some(h => h.isPending) && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                This person has offers in queue to send
              </div>
            )}
            <div className="text-sm text-gray-500 mb-4">
              You are about to schedule <strong>{queueOffers.length} offers</strong> for this user.
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Schedule Time</label>
              <input type="datetime-local" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
            </div>
            {scheduleDate && (
              <div className="text-sm font-medium text-emerald-700 bg-emerald-50 px-3 py-2 rounded border border-emerald-100">
                Offers will be sent exactly on: <br/>
                <strong>{new Date(scheduleDate).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</strong>
              </div>
            )}
          </div>
           <DialogFooter>
            <Button variant="outline" onClick={() => setIsScheduleDialogOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
                   if (!scheduleDate) {
                     toast({ title: 'Schedule Error', description: 'Please select a Schedule Time.', variant: 'destructive' });
                     return;
                   }
                   
                   let minutes = parseInt(intervalValue) || 15;
                   if (intervalUnit === 'hours') minutes *= 60;
                   if (intervalUnit === 'days') minutes *= 1440;
                   
                   const startTime = new Date(scheduleDate).getTime();
                   
                   if (sendMode === 'combined') {
                      const offerIds = queueOffers.map(o => o.offer_id || o._id).filter(Boolean);
                      if (offerIds.length > 0) {
                         offerQueueService.addItems([{
                            userId: log.user_id || log._id,
                            username: log.username || 'User',
                            offerIds: offerIds,
                            offerName: `${offerIds.length} offers combined`,
                            scheduledTime: startTime,
                            sendMode: 'combined'
                         }]);
                      }
                   } else {
                      // 1 by 1
                      const items = queueOffers.map((o, idx) => ({
                            userId: log.user_id || log._id,
                            username: log.username || 'User',
                            offerId: o.offer_id || o._id,
                            offerName: o.name || o.offer_name || 'Offer',
                            scheduledTime: startTime + (idx * minutes * 60000),
                            sendMode: 'single' as const
                      }));
                      offerQueueService.addItems(items);
                   }
                   
                   toast({ title: 'Scheduled', description: `Added ${queueOffers.length} offers to the live queue.` });
                   
                   setQueueOffers([]);
                   setIsScheduleDialogOpen(false);
            }}>Confirm Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
export const UserIntelligenceProfile: React.FC<UserIntelligenceProfileProps> = ({
  log,
  userLogs = [],
  pageVisits,
  offerViews,
  searchLogs,
  userSignals,
  scheduledActivity,
  offerTargeting,
  allowedTabs,
  activeTab: externalActiveTab,
  onTabChange
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState(allowedTabs && allowedTabs.length > 0 ? allowedTabs[0] : 'login');
  const [recoMode, setRecoMode] = useState<'combined' | '1-by-1'>('combined');
  const [browsingSendIdx, setBrowsingSendIdx] = useState<Record<string, number>>({});
  const [recoSendIdx, setRecoSendIdx] = useState<Record<string, number>>({});
  const { toast } = useToast();
  const activeTab = externalActiveTab !== undefined ? externalActiveTab : internalActiveTab;
  const setActiveTab = (tab: string) => {
    setInternalActiveTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  const [sendingOffers, setSendingOffers] = useState(false);

  const handleSendOffers = async (offerIds: string[], sendVia: string = 'email', offerName?: string, scheduleTime?: string): Promise<boolean> => {
    if (!offerIds || offerIds.length === 0) {
      toast({ title: 'Error', description: 'No offers to process', variant: 'destructive' });
      return false;
    }
    
    setSendingOffers(true);
    try {
      const token = localStorage.getItem('token');
      // Look up offer actual IDs
      const payload: any = {
        user_ids: [log.user_id || log._id],
        offer_ids: offerIds,
        send_via: sendVia,
        template_type: 'recommend'
      };
      
      if (offerName) {
        payload.subject = `Recommended Offer: ${offerName} - Moustache Leads`;
      }
      
      if (scheduleTime) {
        payload.schedule_time = scheduleTime;
      }
      
      const res = await fetch(`${API_BASE_URL}/api/admin/offer-access-requests/send-offers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (data.success) {
        if (sendVia !== 'skip') {
          toast({ title: 'Success', description: `Successfully sent ${offerIds.length} offer(s) to ${log.username}` });
        }
        return true;
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to send offers', variant: 'destructive' });
        return false;
      }
    } catch (err) {
      toast({ title: 'Error', description: 'An error occurred while sending offers', variant: 'destructive' });
      return false;
    } finally {
      setSendingOffers(false);
    }
  };

  if (!log) return null;

  const formatLocation = (loc: any) => {
    if (!loc) return 'Unknown';
    if (typeof loc === 'string') return loc.toLowerCase() === 'unknown' ? 'Unknown' : loc;
    const parts = [loc.city, loc.region, loc.country_name || loc.country];
    const validParts = parts.filter(p => typeof p === 'string' && p.toLowerCase() !== 'unknown' && p !== 'XX');
    return validParts.length > 0 ? validParts.join(', ') : 'Unknown';
  };

  const formatDevice = (dev: any) => {
    if (!dev) return 'Unknown';
    if (typeof dev === 'string') return dev.toLowerCase() === 'unknown' ? 'Unknown' : dev;
    const parts = [dev.browser, dev.os].filter(p => p && p.toLowerCase() !== 'unknown');
    return parts.length > 0 ? parts.join(' on ') : 'Unknown';
  };

  const formatTimeAgo = (date: string) => {
    if (!date) return '—';
    try { return formatDistanceToNow(new Date(date), { addSuffix: true }); }
    catch (e) { return date; }
  };

  const formatDate = (date: string) => {
    if (!date) return '—';
    try { return new Date(date).toLocaleString(); }
    catch (e) { return date; }
  };

  // Derived Statistics
  const safeSearchLogs = Array.isArray(searchLogs) ? searchLogs : [];
  const safeOfferViews = Array.isArray(offerViews) ? offerViews : [];
  const safeScheduled = Array.isArray(scheduledActivity) ? scheduledActivity : [];
  const safePageVisits = Array.isArray(pageVisits) ? pageVisits : [];
  const safeTargeting = offerTargeting || {};

  const requested = userSignals?.signal_breakdown?.requests || 0;
  const approved = userSignals?.signal_breakdown?.approvals || 0;
  const views = userSignals?.signal_breakdown?.views || offerViews?.filter(v => v.view_type !== 'clicked').length || 0;
  const clicks = userSignals?.signal_breakdown?.clicks || offerViews?.filter(v => v.view_type === 'clicked').length || 0;

  const currentSessionVerticals = React.useMemo(() => {
    if (!safeOfferViews || safeOfferViews.length === 0) return null;
    const counts: Record<string, number> = {};
    let total = 0;
    safeOfferViews.forEach((v: any) => {
      const cat = v.offer_details?.category || v.category || 'Unknown';
      if (cat && cat !== 'Unknown') {
        counts[cat] = (counts[cat] || 0) + 1;
        total++;
      }
    });
    if (total === 0) return null;
    return Object.entries(counts)
      .map(([name, count]) => ({ name, value: Math.round((count / total) * 100) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [safeOfferViews]);

  // Chart Data
  let verticalData: { name: string, value: number }[] = [];
  if (currentSessionVerticals && currentSessionVerticals.length > 0) {
    verticalData = currentSessionVerticals;
  } else if (userSignals?.top_categories && userSignals.top_categories.length > 0) {
    const weight = Math.floor(100 / userSignals.top_categories.length);
    verticalData = userSignals.top_categories.map((cat: string) => ({ name: cat, value: weight }));
    const totalWeight = verticalData.reduce((acc, curr) => acc + curr.value, 0);
    if (totalWeight < 100 && verticalData.length > 0) {
      verticalData[0].value += (100 - totalWeight);
    }
  }

  const currentSessionGeo = React.useMemo(() => {
    if (!safeOfferViews || safeOfferViews.length === 0) return null;
    const counts: Record<string, number> = {};
    let total = 0;
    safeOfferViews.forEach((v: any) => {
      let country = 'Unknown';
      if (v.offer_details?.countries && Array.isArray(v.offer_details.countries) && v.offer_details.countries.length > 0) {
        country = v.offer_details.countries[0];
      } else if (v.country) {
        country = v.country;
      }
      if (country && country !== 'Unknown' && country !== 'XX') {
        counts[country] = (counts[country] || 0) + 1;
        total++;
      }
    });
    if (total === 0) return null;
    return Object.entries(counts)
      .map(([name, count]) => ({ name, value: Math.round((count / total) * 100) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [safeOfferViews]);

  let geoData: { name: string, value: number }[] = [];
  if (currentSessionGeo && currentSessionGeo.length > 0) {
    geoData = currentSessionGeo;
  } else if (userSignals?.top_geos && userSignals.top_geos.length > 0) {
    const weight = Math.floor(100 / userSignals.top_geos.length);
    geoData = userSignals.top_geos.map((geo: string) => ({ name: geo, value: weight }));
    const totalWeight = geoData.reduce((acc, curr) => acc + curr.value, 0);
    if (totalWeight < 100 && geoData.length > 0) {
      geoData[0].value += (100 - totalWeight);
    }
  } else if (log?.location && formatLocation(log.location) !== 'Unknown') {
    geoData = [{ name: formatLocation(log.location), value: 100 }];
  }

  const userCountry = (currentSessionGeo && currentSessionGeo.length > 0) 
    ? currentSessionGeo[0].name 
    : ((userSignals?.top_geos && userSignals.top_geos.length > 0) 
      ? userSignals.top_geos[0] 
      : (log?.location && formatLocation(log.location) !== 'Unknown') 
        ? formatLocation(log.location) 
        : 'Unknown');

  // Compile Recent Activity (mixed timeline)
  const recentActivity = [
    ...safeSearchLogs.map(s => ({
      id: s._id, type: 'search', title: `Searched "${s.keyword}"`,
      detail: `Offer search · ${s.results_count} results`, time: s.searched_at, icon: <Search className="w-4 h-4 text-blue-600" />, bg: 'bg-blue-100'
    })),
    ...safeOfferViews.map(o => ({
      id: o._id, type: o.view_type === 'clicked' ? 'click' : 'view',
      title: `${o.view_type === 'clicked' ? 'Clicked' : 'Viewed'} offer: ${o.offer_details?.name || o.offer_name}`,
      detail: `${o.offer_details?.category || 'Unknown'} · ${o.offer_details?.payout ? '$' + o.offer_details.payout : ''}`,
      time: o.timestamp,
      icon: o.view_type === 'clicked' ? <MousePointerClick className="w-4 h-4 text-purple-600" /> : <Eye className="w-4 h-4 text-indigo-600" />,
      bg: o.view_type === 'clicked' ? 'bg-purple-100' : 'bg-indigo-100'
    })),
    ...safePageVisits.map(p => ({
      id: p._id, type: 'visit', title: `Visited page`,
      detail: `${p.url || p.page_url || 'Unknown page'}`, time: p.visited_at || p.timestamp, icon: <Activity className="w-4 h-4 text-emerald-600" />, bg: 'bg-emerald-100'
    })),
    {
      id: log._id, type: 'login', title: 'Logged in',
      detail: `${formatDevice(log.device)} · ${formatLocation(log.location) !== 'Unknown' ? formatLocation(log.location) : userCountry} · ${log.ip_address}`,
      time: log.login_time, icon: <Fingerprint className="w-4 h-4 text-amber-600" />, bg: 'bg-amber-100'
    }
  ].sort((a, b) => {
    const timeA = a.time ? new Date(a.time).getTime() : 0;
    const timeB = b.time ? new Date(b.time).getTime() : 0;
    return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col font-sans mt-2 ml-4">
      {/* Header */}
      <div className="bg-white border-b px-6 pt-5 pb-0">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xl uppercase">
              {log.username?.substring(0, 2) || 'US'}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 tracking-tight flex items-center gap-2">
                {log.username} — Offer Intelligence
                {log.status === 'suspicious' && <Badge variant="destructive" className="h-5 text-[10px]">Suspicious</Badge>}
              </h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {log.location && <span className="text-xs text-gray-500">{formatLocation(log.location) !== 'Unknown' ? formatLocation(log.location) : userCountry}</span>}
                {log.location && <span className="w-1 h-1 rounded-full bg-gray-300"></span>}
                {(Array.isArray(userSignals?.top_categories) ? userSignals.top_categories : []).slice(0, 2).map((cat: string, i: number) => (
                  <React.Fragment key={i}>
                    <span className="text-xs text-gray-500">{cat}</span>
                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                  </React.Fragment>
                ))}
                <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                  Last active {formatTimeAgo(log.login_time)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        {(!allowedTabs || allowedTabs.length > 1) && (
          <div className="flex gap-6 border-b border-transparent">
            {[
              { id: 'login', label: 'Login Logs' },
              { id: 'activity', label: 'Recent Activity' },
              { id: 'browsing', label: 'Currently Browsing' },
              { id: 'reco', label: 'Offer Reco' },
              { id: 'automation', label: 'Automation' },
              { id: 'messaging', label: 'Messaging' }
            ].filter(tab => !allowedTabs || allowedTabs.includes(tab.id)).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="p-6 bg-slate-50/50 min-h-[400px]">
        {activeTab === 'messaging' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-3xl mx-auto">
             <SmartMessagePanel 
                user={{
                  user_id: log.user_id || log._id,
                  username: log.username,
                  email: log.email,
                  country: userCountry,
                  verticals: (Array.isArray(userSignals?.top_categories) ? userSignals.top_categories : []),
                  geoPreferences: log.geoPreferences,
                  recentOffers: safeOfferViews.slice(0, 5).map(o => o.offer_details?.name || o.offer_name)
                }}
             />
          </div>
        )}

        {/* TAB: LOGIN LOGS */}
        {activeTab === 'login' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4">
              {/* Signup Prefs (Approximated from Signals) */}
              <div className="bg-white border rounded-xl p-5 shadow-sm">
                <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4">Signup Preferences</h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-gray-500 mb-1.5">Vertical</div>
                    <div className="flex flex-wrap gap-1.5">
                      {log.verticals && log.verticals.length > 0 ? (
                        log.verticals.map((v: string, i: number) => <Badge key={i} variant="secondary" className="font-normal bg-slate-100">{v}</Badge>)
                      ) : verticalData.length > 0 ? (
                        verticalData.map((c: any, i: number) => <Badge key={i} variant="secondary" className="font-normal bg-slate-100">{c.name}</Badge>)
                      ) : <span className="text-xs text-gray-400">No data</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1.5">Target Locations</div>
                    <div className="flex flex-wrap gap-1.5">
                      {log.geoPreferences && log.geoPreferences.length > 0 ? (
                         log.geoPreferences.map((g: string, i: number) => <Badge key={i} variant="secondary" className="font-normal bg-slate-100">{g}</Badge>)
                      ) : log.location && formatLocation(log.location) !== 'Unknown' ? (
                        <Badge variant="secondary" className="font-normal bg-slate-100">{formatLocation(log.location)}</Badge>
                      ) : (userCountry !== 'Unknown' ? <Badge variant="secondary" className="font-normal bg-slate-100">{userCountry}</Badge> : <span className="text-xs text-gray-400">Unknown</span>)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Account Summary & Donuts */}
              <div className="bg-white border rounded-xl p-5 shadow-sm">
                <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Account Summary</h3>

                {/* 4 Stat Boxes */}
                <div className="grid grid-cols-4 gap-3 mb-5">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div className="text-2xl font-bold text-gray-800">{requested}</div>
                    <div className="text-[11px] text-gray-500 mt-1">Requested</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div className="text-2xl font-bold text-green-700">{approved}</div>
                    <div className="text-[11px] text-gray-500 mt-1">Approved</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div className="text-2xl font-bold text-blue-600">{views}</div>
                    <div className="text-[11px] text-gray-500 mt-1">Views</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div className="text-2xl font-bold text-purple-700">{clicks}</div>
                    <div className="text-[11px] text-gray-500 mt-1">Clicks</div>
                  </div>
                </div>

                {/* Donuts */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center gap-4">
                    <div className="w-16 h-16 relative flex-shrink-0">
                      {verticalData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={verticalData} cx="50%" cy="50%" innerRadius={20} outerRadius={30} dataKey="value" stroke="none">
                              {verticalData.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <RechartsTooltip contentStyle={{ fontSize: '10px', padding: '4px 8px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="w-full h-full rounded-full border-4 border-slate-200 flex items-center justify-center">
                          <span className="text-[8px] text-slate-400">N/A</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Vertical Preference</div>
                      <div className="space-y-1.5 text-[10px]">
                        {verticalData.length > 0 ? verticalData.slice(0, 3).map((d: any, i: number) => (
                          <div key={i} className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5 text-gray-600 truncate">
                              <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}></div>
                              <span className="truncate max-w-[70px]">{d.name}</span>
                            </div>
                            <span className="font-semibold">{d.value}%</span>
                          </div>
                        )) : (
                          <div className="text-gray-400 italic">No activity yet</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center gap-4">
                    <div className="w-16 h-16 relative flex-shrink-0">
                      {geoData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={geoData} cx="50%" cy="50%" innerRadius={20} outerRadius={30} dataKey="value" stroke="none">
                              {geoData.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[(index + 3) % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <RechartsTooltip contentStyle={{ fontSize: '10px', padding: '4px 8px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="w-full h-full rounded-full border-4 border-slate-200 flex items-center justify-center">
                          <span className="text-[8px] text-slate-400">N/A</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Geo Preference</div>
                      <div className="space-y-1.5 text-[10px]">
                        {geoData.length > 0 ? geoData.slice(0, 3).map((d: any, i: number) => (
                          <div key={i} className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5 text-gray-600 truncate">
                              <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: CHART_COLORS[(i + 3) % CHART_COLORS.length] }}></div>
                              <span className="truncate max-w-[70px]">{d.name}</span>
                            </div>
                            <span className="font-semibold">{d.value}%</span>
                          </div>
                        )) : (
                          <div className="text-gray-400 italic">No activity yet</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Current Session Login Details */}
            <div className="bg-white border rounded-xl p-5 shadow-sm">
              <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4">Login History</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="text-[10px] text-gray-400 uppercase border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 font-medium">Date & Time</th>
                      <th className="px-3 py-2 font-medium">Device</th>
                      <th className="px-3 py-2 font-medium">Location</th>
                      <th className="px-3 py-2 font-medium">IP Address</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userLogs && userLogs.length > 0 ? userLogs.map((l: any, i: number) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
                        <td className="px-3 py-3 text-gray-900 text-xs">{formatDate(l.login_time)}</td>
                        <td className="px-3 py-3 text-gray-600 text-xs">{formatDevice(l.device)}</td>
                        <td className="px-3 py-3 text-gray-600 text-xs">{formatLocation(l.location) !== 'Unknown' ? formatLocation(l.location) : userCountry}</td>
                        <td className="px-3 py-3 text-gray-600 text-xs">{l.ip_address}</td>
                        <td className="px-3 py-3">
                          <Badge variant={l.status === 'success' ? 'default' : 'destructive'} className={`text-[10px] font-medium ${l.status === 'success' ? 'bg-green-100 text-green-800 hover:bg-green-100' : ''}`}>
                            {l.status === 'success' ? 'Active' : l.status}
                          </Badge>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-500 text-xs">No login history available.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: RECENT ACTIVITY */}
        {activeTab === 'activity' && (
          <div className="space-y-4">
            <div className="bg-white border rounded-xl p-5 shadow-sm">
              {/* Summary Strip (as requested) */}
              <div className="flex gap-4 mb-6">
                <div className="grid grid-cols-4 gap-3 flex-1">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div className="text-xl font-bold text-gray-800">{requested}</div>
                    <div className="text-[10px] text-gray-500 mt-1">Requested</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div className="text-xl font-bold text-green-700">{approved}</div>
                    <div className="text-[10px] text-gray-500 mt-1">Approved</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div className="text-xl font-bold text-blue-600">{views}</div>
                    <div className="text-[10px] text-gray-500 mt-1">Views</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div className="text-xl font-bold text-purple-700">{clicks}</div>
                    <div className="text-[10px] text-gray-500 mt-1">Clicks</div>
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex items-center justify-center">
                    <div className="w-12 h-12 relative flex-shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={verticalData} cx="50%" cy="50%" innerRadius={14} outerRadius={22} dataKey="value" stroke="none">
                            {verticalData.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip contentStyle={{ fontSize: '10px', padding: '2px 4px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex items-center justify-center">
                    <div className="w-12 h-12 relative flex-shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={geoData} cx="50%" cy="50%" innerRadius={14} outerRadius={22} dataKey="value" stroke="none">
                            {geoData.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[(index + 3) % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip contentStyle={{ fontSize: '10px', padding: '2px 4px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>

              <h3 className="text-sm font-semibold mb-4 text-gray-800">Recent Activity Timeline</h3>
              {recentActivity.length > 0 ? (
                <div className="space-y-2">
                  {recentActivity.map((act, i) => (
                    <div key={i} className="flex gap-4 p-3 rounded-lg border border-slate-100 bg-white hover:bg-slate-50 transition-colors">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${act.bg}`}>
                        {act.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 text-xs truncate">{act.title}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">{act.detail}</div>
                      </div>
                      <div className="text-[10px] text-gray-400 whitespace-nowrap pt-0.5">
                        {formatTimeAgo(act.time)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 text-sm">No recent activity found.</div>
              )}
            </div>
          </div>
        )}

        {/* TAB: CURRENTLY BROWSING */}
        {activeTab === 'browsing' && (<div className="tab-panel active">

          {/* Live header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#1D9E75', boxShadow: '0 0 0 3px #d4f0e4', animation: 'pulse 1.5s infinite' }}></div>
            <span style={{ fontSize: '12px', color: '#5a5855' }}>Live browsing session · Updated 18s ago</span>
            <button className="send-btn" style={{ marginLeft: 'auto' }}>Refresh ↻</button>
          </div>
          <style dangerouslySetInnerHTML={{ __html: "@keyframes pulse{0%, 100% {box-shadow:0 0 0 3px #d4f0e4}50%{box-shadow:0 0 0 5px #9FE1CB}}" }} />

          {/* Top 5 verticals */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div className="card-title" style={{ margin: '0' }}>Top 5 verticals detected (current session)</div>
              <span style={{ fontSize: '11px', color: '#9c9a92' }}>Based on {safeOfferViews.length} browsing signals</span>
            </div>

            {(currentSessionVerticals || []).slice(0, 5).map((v: any, i: number) => {
              const bgColors = ['#185FA5', '#534AB7', '#1D9E75', '#B86821', '#A63333'];
              const lightColors = ['#E6F1FB', '#EDEBF9', '#E1F5EE', '#FDF3EA', '#FCE9E9'];
              const textColors = ['#0C447C', '#2C2665', '#085041', '#66360C', '#5C1A1A'];
              const color = bgColors[i % bgColors.length];
              const lightColor = lightColors[i % lightColors.length];
              const textColor = textColors[i % textColors.length];

              const categoryOffers = safeOfferViews.filter((o: any) => {
                const cat = (o.offer_details?.category || '').toLowerCase();
                const name = (o.offer_name || '').toLowerCase();
                const vName = (v.name || '').toLowerCase();
                if (!vName || vName === 'unknown') return false;
                return cat.includes(vName) || vName.includes(cat) || name.includes(vName);
              });
              
              const uniqueCategoryOffers: any[] = [];
              const seenIds = new Set();
              for (const o of categoryOffers) {
                  const id = o.offer_id || o.offer_details?.offer_id || o._id;
                  if (id && !seenIds.has(id)) {
                      seenIds.add(id);
                      uniqueCategoryOffers.push(o);
                  }
              }
              
              return (
              <div key={i} style={{ marginBottom: '10px' }}>
                <div className="vbar-wrap">
                  <span className="vbar-label">{v.name}</span>
                  <div className="vbar-track"><div className="vbar-fill" style={{ width: `${v.value}%`, background: color }}></div></div>
                  <span className="vbar-pct">{v.value}%</span>
                </div>
                <div className="vert-section">
                  <div className="vert-header">
                    <span className="vert-name">{v.name} offers for you</span>
                    <span className="vert-pct-badge" style={{ background: lightColor, color: textColor }}>{v.value}%</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {uniqueCategoryOffers.length > 0 ? uniqueCategoryOffers.slice(0,3).map((o: any, idx: number) => (
                      <div key={idx} className="offer-chip">
                        <span className="dot" style={{ background: color }}></span>
                        <span>{o.offer_details?.name || o.offer_name} {o.offer_details?.payout ? `· $${o.offer_details.payout}` : ''}</span>
                        {idx === 0 && <span className="badge" style={{ background: lightColor, color: textColor, marginLeft: 'auto', fontSize: '10px' }}>Top pick</span>}
                      </div>
                    )) : (
                      <div className="text-xs text-gray-500 italic py-1 pl-2">No specific offers viewed recently.</div>
                    )}
                  </div>
                  <button 
                    className="send-btn" 
                    style={{ marginTop: '8px', opacity: uniqueCategoryOffers.length === 0 || sendingOffers ? 0.5 : 1 }}
                    disabled={uniqueCategoryOffers.length === 0 || sendingOffers}
                    onClick={() => {
                      if (uniqueCategoryOffers.length > 0) {
                        const currentIndex = browsingSendIdx[v.name] || 0;
                        const topOffer = uniqueCategoryOffers[currentIndex % uniqueCategoryOffers.length];
                        const offerId = topOffer.offer_id || topOffer.offer_details?.offer_id || topOffer._id;
                        const offerName = topOffer.offer_details?.name || topOffer.offer_name || 'Top Pick';
                        if (offerId) {
                          handleSendOffers([offerId], offerName);
                          setBrowsingSendIdx(prev => ({ ...prev, [v.name]: currentIndex + 1 }));
                        } else {
                          toast({ title: 'Error', description: 'Could not resolve offer ID', variant: 'destructive' });
                        }
                      }
                    }}
                  >
                    {sendingOffers ? 'Sending...' : `Send best ${v.name} offer ↗`}
                  </button>
                </div>
              </div>
            )})}
          </div>
        </div>)}

        {/* TAB: OFFER RECO */}
        {activeTab === 'reco' && (<div className="tab-panel active">

          {/* Rule strip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', background: '#fff', border: '0.5px solid #dddbd2' }}>
            <span style={{ fontSize: '11px', color: '#9c9a92', fontWeight: '500' }}>Rule:</span>
            <span style={{ fontSize: '12px', color: '#5a5855' }}>No offer sent in last 30 days</span>
            <span style={{ fontSize: '11px', color: '#9c9a92', marginLeft: '12px', fontWeight: '500' }}>Mode:</span>
            <span style={{ fontSize: '12px', color: '#5a5855' }}>1 offer per section · or combine into 1 send</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
              <span 
                className="badge cursor-pointer" 
                style={{ cursor: 'pointer', background: recoMode === 'combined' ? '#E1F5EE' : '#F4F3EF', color: recoMode === 'combined' ? '#085041' : '#9c9a92' }}
                onClick={() => setRecoMode('combined')}
              >Combined send</span>
              <span 
                className="badge cursor-pointer" 
                style={{ cursor: 'pointer', background: recoMode === '1-by-1' ? '#E1F5EE' : '#F4F3EF', color: recoMode === '1-by-1' ? '#085041' : '#9c9a92' }}
                onClick={() => setRecoMode('1-by-1')}
              >1-by-1</span>
            </div>
          </div>

          {/* 5 buckets */}
          <div className="grid-5">

            <div className="bucket-card" style={{ borderTop: '2px solid #185FA5' }}>
              <div style={{ fontSize: '11px', fontWeight: '500', color: '#185FA5', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#185FA5" /><path d="M5 2v3M5 5h3" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" fill="none" /></svg>
                Newly added
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {safeTargeting.newly_added && safeTargeting.newly_added.length > 0 ? safeTargeting.newly_added.slice(0,3).map((o: any, i: number) => (
                  <div key={i} className="offer-chip"><span className="dot" style={{ background: '#185FA5' }}></span><span className="truncate">{o.name || o.offer_name}</span></div>
                )) : <div className="text-xs text-gray-500 italic py-1">No recent additions.</div>}
              </div>
              {recoMode === '1-by-1' && (
                <button 
                  className="send-btn" 
                  style={{ marginTop: '8px', width: '100%', opacity: (!safeTargeting.newly_added?.length || sendingOffers) ? 0.5 : 1 }}
                  disabled={!safeTargeting.newly_added?.length || sendingOffers}
                  onClick={() => {
                    const idx = recoSendIdx['newly_added'] || 0;
                    const o = safeTargeting.newly_added[idx % safeTargeting.newly_added.length];
                    handleSendOffers([o.offer_id || o._id]);
                    setRecoSendIdx(prev => ({ ...prev, newly_added: idx + 1 }));
                  }}
                >
                  Send next offer ↗
                </button>
              )}
            </div>

            <div className="bucket-card" style={{ borderTop: '2px solid #1D9E75' }}>
              <div style={{ fontSize: '11px', fontWeight: '500', color: '#1D9E75', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#1D9E75" /><path d="M3 5l1.5 1.5L7 3.5" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" fill="none" /></svg>
                Most approved
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {safeTargeting.most_approved && safeTargeting.most_approved.length > 0 ? safeTargeting.most_approved.slice(0,3).map((o: any, i: number) => (
                  <div key={i} className="offer-chip"><span className="dot" style={{ background: '#1D9E75' }}></span><span className="truncate">{o.name || o.offer_name}</span></div>
                )) : <div className="text-xs text-gray-500 italic py-1">No data available.</div>}
              </div>
              {recoMode === '1-by-1' && (
                <button 
                  className="send-btn" 
                  style={{ marginTop: '8px', width: '100%', opacity: (!safeTargeting.most_approved?.length || sendingOffers) ? 0.5 : 1 }}
                  disabled={!safeTargeting.most_approved?.length || sendingOffers}
                  onClick={() => {
                    const idx = recoSendIdx['most_approved'] || 0;
                    const o = safeTargeting.most_approved[idx % safeTargeting.most_approved.length];
                    handleSendOffers([o.offer_id || o._id]);
                    setRecoSendIdx(prev => ({ ...prev, most_approved: idx + 1 }));
                  }}
                >
                  Send next offer ↗
                </button>
              )}
            </div>

            <div className="bucket-card" style={{ borderTop: '2px solid #BA7517' }}>
              <div style={{ fontSize: '11px', fontWeight: '500', color: '#BA7517', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#BA7517" /><path d="M5 2v3l2 1" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" fill="none" /></svg>
                Highly clicked
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {safeTargeting.highly_clicked && safeTargeting.highly_clicked.length > 0 ? safeTargeting.highly_clicked.slice(0,3).map((o: any, i: number) => (
                  <div key={i} className="offer-chip"><span className="dot" style={{ background: '#BA7517' }}></span><span className="truncate">{o.name || o.offer_name}</span></div>
                )) : <div className="text-xs text-gray-500 italic py-1">No data available.</div>}
              </div>
              {recoMode === '1-by-1' && (
                <button 
                  className="send-btn" 
                  style={{ marginTop: '8px', width: '100%', opacity: (!safeTargeting.highly_clicked?.length || sendingOffers) ? 0.5 : 1 }}
                  disabled={!safeTargeting.highly_clicked?.length || sendingOffers}
                  onClick={() => {
                    const idx = recoSendIdx['highly_clicked'] || 0;
                    const o = safeTargeting.highly_clicked[idx % safeTargeting.highly_clicked.length];
                    handleSendOffers([o.offer_id || o._id]);
                    setRecoSendIdx(prev => ({ ...prev, highly_clicked: idx + 1 }));
                  }}
                >
                  Send next offer ↗
                </button>
              )}
            </div>

            <div className="bucket-card" style={{ borderTop: '2px solid #A32D2D' }}>
              <div style={{ fontSize: '11px', fontWeight: '500', color: '#A32D2D', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#A32D2D" /><path d="M3 3l4 4M7 3l-4 4" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" fill="none" /></svg>
                Recently deleted
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', opacity: '.7' }}>
                {safeTargeting.recently_deleted && safeTargeting.recently_deleted.length > 0 ? safeTargeting.recently_deleted.slice(0,3).map((o: any, i: number) => (
                  <div key={i} className="offer-chip"><span className="dot" style={{ background: '#A32D2D' }}></span><span className="truncate">{o.name || o.offer_name}</span></div>
                )) : <div className="text-xs text-gray-500 italic py-1">No recent deletions.</div>}
              </div>
              {recoMode === '1-by-1' && (
                <button 
                  className="send-btn" 
                  style={{ marginTop: '8px', width: '100%', opacity: (!safeTargeting.recently_deleted?.length || sendingOffers) ? 0.5 : 1 }}
                  disabled={!safeTargeting.recently_deleted?.length || sendingOffers}
                  onClick={() => {
                    const idx = recoSendIdx['recently_deleted'] || 0;
                    const o = safeTargeting.recently_deleted[idx % safeTargeting.recently_deleted.length];
                    handleSendOffers([o.offer_id || o._id]);
                    setRecoSendIdx(prev => ({ ...prev, recently_deleted: idx + 1 }));
                  }}
                >
                  Send next replacement ↗
                </button>
              )}
            </div>

            <div className="bucket-card" style={{ borderTop: '2px solid #534AB7' }}>
              <div style={{ fontSize: '11px', fontWeight: '500', color: '#534AB7', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#534AB7" /><path d="M3 6.5l1-1 2.5-2.5-1-1L3 4.5V6.5h2" stroke="#fff" strokeWidth="1" strokeLinecap="round" fill="none" /></svg>
                Recently edited
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {safeTargeting.recently_edited && safeTargeting.recently_edited.length > 0 ? safeTargeting.recently_edited.slice(0,3).map((o: any, i: number) => (
                  <div key={i} className="offer-chip"><span className="dot" style={{ background: '#534AB7' }}></span><span className="truncate">{o.name || o.offer_name}</span></div>
                )) : <div className="text-xs text-gray-500 italic py-1">No recent edits.</div>}
              </div>
              {recoMode === '1-by-1' && (
                <button 
                  className="send-btn" 
                  style={{ marginTop: '8px', width: '100%', opacity: (!safeTargeting.recently_edited?.length || sendingOffers) ? 0.5 : 1 }}
                  disabled={!safeTargeting.recently_edited?.length || sendingOffers}
                  onClick={() => {
                    const idx = recoSendIdx['recently_edited'] || 0;
                    const o = safeTargeting.recently_edited[idx % safeTargeting.recently_edited.length];
                    handleSendOffers([o.offer_id || o._id]);
                    setRecoSendIdx(prev => ({ ...prev, recently_edited: idx + 1 }));
                  }}
                >
                  Send next offer ↗
                </button>
              )}
            </div>

          </div>

          {/* Combined footer */}
          {recoMode === 'combined' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '10px', border: '0.5px solid #dddbd2', background: '#fff' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '500', color: '#1a1a18' }}>Combined send</div>
                <div style={{ fontSize: '11px', color: '#9c9a92', marginTop: '2px' }}>Pick best 1 offer across all 5 sections · 30-day dedup enforced</div>
              </div>
              <button 
                className="actn-btn primary"
                disabled={sendingOffers}
                style={{ opacity: sendingOffers ? 0.5 : 1 }}
                onClick={() => {
                  const combinedIds: string[] = [];
                  if (safeTargeting.newly_added?.[0]) combinedIds.push(safeTargeting.newly_added[0].offer_id || safeTargeting.newly_added[0]._id);
                  if (safeTargeting.most_approved?.[0]) combinedIds.push(safeTargeting.most_approved[0].offer_id || safeTargeting.most_approved[0]._id);
                  if (safeTargeting.highly_clicked?.[0]) combinedIds.push(safeTargeting.highly_clicked[0].offer_id || safeTargeting.highly_clicked[0]._id);
                  if (safeTargeting.recently_deleted?.[0]) combinedIds.push(safeTargeting.recently_deleted[0].offer_id || safeTargeting.recently_deleted[0]._id);
                  if (safeTargeting.recently_edited?.[0]) combinedIds.push(safeTargeting.recently_edited[0].offer_id || safeTargeting.recently_edited[0]._id);
                  
                  const uniqueIds = Array.from(new Set(combinedIds.filter(Boolean)));
                  handleSendOffers(uniqueIds);
                }}
              >
                Run combined send ↗
              </button>
            </div>
          )}

        </div>)}

        {/* TAB: AUTOMATION */}
        {activeTab === 'automation' && <UserAutomationTab verticalData={verticalData} log={log} offerTargeting={offerTargeting} userLogs={userLogs} offerViews={safeOfferViews} scheduledActivity={safeScheduled} onSendOffers={handleSendOffers} sendingOffers={sendingOffers} />}

        {/* TAB: MESSAGING */}
        {activeTab === 'messaging' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <SmartMessagePanel 
                  user={{
                    user_id: log.user_id,
                    username: log.username,
                    email: log.email,
                    country: log.location?.country || userCountry,
                    city: log.location?.city || 'Unknown',
                    verticals: log.verticals || [],
                    geoPreferences: log.geoPreferences || [],
                    recentOffers: safeOfferViews.slice(0, 5).map(o => o.offer_name || o.name)
                  }}
                  onMessageSent={() => {
                    toast({
                      title: "Message History Updated",
                      description: "Communication logged in intelligence profile."
                    });
                  }}
                />
              </div>
              <div className="space-y-6">
                <div className="bg-white border rounded-xl p-5 shadow-sm">
                  <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Activity size={14} className="text-blue-500" /> Interaction Intelligence
                  </h3>
                  <div className="space-y-4">
                    <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                      <div className="text-[10px] text-blue-600 font-bold uppercase mb-1">Recommended Outreach</div>
                      <div className="text-xs text-blue-800 leading-relaxed">
                        User shows high affinity for <strong>{log.verticals?.[0] || 'various'}</strong> offers. 
                        Geo-preferences align with <strong>{log.geoPreferences?.[0] || 'global'}</strong> markets.
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-[10px] text-gray-500 font-bold uppercase">Communication Channels</div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="bg-slate-100 text-slate-600">Email Dispatch</Badge>
                        <Badge variant="secondary" className="bg-sky-100 text-sky-600">Telegram Link</Badge>
                        <Badge variant="secondary" className="bg-indigo-100 text-indigo-600">Teams Direct</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        <style>{`*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F4F3EF;color:#1a1a18;font-size:13px}

/* Layout */
.shell{display:flex;height:100vh;overflow:hidden}
.sidebar{width:200px;flex-shrink:0;background:#fff;border-right:0.5px solid #dddbd2;display:flex;flex-direction:column;padding:16px 0}
.main{flex:1;overflow-y:auto;padding:20px 24px;display:flex;flex-direction:column;gap:16px}

/* Sidebar */
.logo{font-size:13px;font-weight:600;color:#1a1a18;padding:0 16px 14px;border-bottom:0.5px solid #dddbd2;letter-spacing:-0.2px}
.logo span{color:#185FA5}
.nav-section{padding:12px 16px 4px;font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:0.06em;color:#9c9a92}
.nav-item{display:flex;align-items:center;gap:8px;padding:7px 16px;font-size:12px;color:#5a5855;cursor:pointer;border-right:2px solid transparent;transition:all .12s}
.nav-item:hover{background:#F4F3EF;color:#1a1a18}
.nav-item.active{background:#EBF2FB;color:#185FA5;border-right-color:#185FA5;font-weight:500}
.nav-item svg{opacity:.65;flex-shrink:0}
.nav-item.active svg{opacity:1}

/* Tabs */
.tab-bar{display:flex;gap:2px;background:#fff;border:0.5px solid #dddbd2;border-radius:10px;padding:3px;width:fit-content}
.tab{padding:5px 14px;border-radius:7px;font-size:12px;font-weight:500;cursor:pointer;color:#5a5855;transition:all .12s;white-space:nowrap}
.tab.active{background:#185FA5;color:#fff}
.tab:not(.active):hover{background:#F4F3EF;color:#1a1a18}

/* Cards */
.card{background:#fff;border:0.5px solid #dddbd2;border-radius:12px;padding:14px 16px}
.card-title{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#9c9a92;margin-bottom:10px}

/* Tags */
.tag{display:inline-block;font-size:11px;padding:2px 8px;border-radius:20px;border:0.5px solid #dddbd2;color:#5a5855;margin:2px 2px 2px 0}
.badge{display:inline-block;font-size:11px;font-weight:500;padding:2px 8px;border-radius:20px}

/* Grid helpers */
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.grid-5{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}

/* Stat boxes */
.stat-row{display:flex;gap:10px}
.stat-box{background:#F4F3EF;border-radius:8px;padding:10px 12px;flex:1}
.stat-num{font-size:22px;font-weight:500;color:#1a1a18;line-height:1}
.stat-lbl{font-size:11px;color:#9c9a92;margin-top:3px}

/* Activity row */
.act-row{display:flex;justify-content:space-between;align-items:center;padding:5px 8px;border-radius:6px;background:#F4F3EF}

/* Offer chip */
.offer-chip{font-size:12px;padding:5px 10px;border-radius:7px;border:0.5px solid #dddbd2;background:#F4F3EF;color:#1a1a18;cursor:pointer;display:flex;align-items:center;gap:6px;transition:border-color .12s}
.offer-chip:hover{border-color:#9c9a92}
.dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}

/* Send btn */
.send-btn{font-size:11px;padding:4px 10px;border-radius:20px;border:0.5px solid #dddbd2;background:#fff;color:#5a5855;cursor:pointer;white-space:nowrap;transition:background .1s}
.send-btn:hover{background:#F4F3EF}

/* Bucket card */
.bucket-card{background:#fff;border:0.5px solid #dddbd2;border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:5px}

/* Browsing vertical bar */
.vbar-wrap{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.vbar-track{flex:1;height:6px;background:#F4F3EF;border-radius:3px;overflow:hidden}
.vbar-fill{height:100%;border-radius:3px;transition:width .6s ease}
.vbar-pct{font-size:11px;font-weight:500;color:#1a1a18;min-width:28px;text-align:right}
.vbar-label{font-size:12px;color:#1a1a18;min-width:80px}

/* Toggle */
.tog-wrap{position:relative;width:32px;height:18px;flex-shrink:0}
.tog-wrap input{position:absolute;opacity:0;width:100%;height:100%;cursor:pointer;margin:0;z-index:1}
.tog-track{width:32px;height:18px;background:#dddbd2;border-radius:9px;transition:background .2s;pointer-events:none}
.tog-wrap input:checked~.tog-track{background:#185FA5}
.tog-thumb{position:absolute;top:2px;left:2px;width:14px;height:14px;background:#fff;border-radius:50%;transition:transform .2s;pointer-events:none;box-shadow:0 1px 2px rgba(0,0,0,.15)}
.tog-wrap input:checked~.tog-thumb{transform:translateX(14px)}

/* Queue rows */
.queue-row{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;border:0.5px solid #dddbd2;background:#fff;font-size:12px;cursor:default;transition:background .1s}
.queue-row:hover{background:#F4F3EF}
.status-pill{font-size:10px;padding:2px 7px;border-radius:20px;font-weight:500}
.status-pill.active{background:#E1F5EE;color:#085041}
.status-pill.waiting{background:#FAEEDA;color:#633806}
.status-pill.paused{background:#F4F3EF;color:#5a5855}

/* Log row */
.log-row{display:flex;align-items:center;gap:8px;padding:5px 10px;font-size:11px;color:#5a5855;border-bottom:0.5px solid #F4F3EF}

/* Vertical offer section */
.vert-section{background:#F4F3EF;border-radius:9px;padding:10px 12px;margin-bottom:8px}
.vert-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.vert-name{font-size:12px;font-weight:500;color:#1a1a18}
.vert-pct-badge{font-size:11px;font-weight:500;padding:1px 7px;border-radius:20px}

/* Day btn */
.day-btn{width:30px;height:30px;border-radius:50%;border:0.5px solid #dddbd2;background:#F4F3EF;font-size:11px;color:#5a5855;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .12s}
.day-btn.on{background:#185FA5;border-color:#185FA5;color:#fff;font-weight:500}

/* Action btn */
.actn-btn{font-size:12px;padding:5px 14px;border-radius:20px;border:0.5px solid #dddbd2;background:#F4F3EF;color:#5a5855;cursor:pointer;transition:background .1s}
.actn-btn:hover{background:#dddbd2}
.actn-btn.primary{background:#185FA5;border-color:#185FA5;color:#fff}
.actn-btn.primary:hover{background:#0C447C}
.actn-btn.danger{background:#FCEBEB;border-color:#F09595;color:#A32D2D}
.section-toggle{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:7px;background:#F4F3EF;font-size:12px}

select,input[type=text],input[type=number]{font-size:12px;padding:5px 9px;border-radius:7px;border:0.5px solid #dddbd2;background:#fff;color:#1a1a18}

/* Tab panel */
.tab-panel{display:none}
.tab-panel.active{display:flex;flex-direction:column;gap:16px}

/* Login log table */
.log-table{width:100%;border-collapse:collapse;font-size:12px}
.log-table th{text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#9c9a92;padding:5px 10px;border-bottom:0.5px solid #dddbd2}
.log-table td{padding:7px 10px;border-bottom:0.5px solid #F4F3EF;color:#3d3d3a}
.log-table tr:last-child td{border-bottom:none}
.log-table tr:hover td{background:#fafaf7}

/* Scrollbar */
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#dddbd2;border-radius:2px}`}</style>
      </div>
    </div>
  );
};


      export default UserIntelligenceProfile;
