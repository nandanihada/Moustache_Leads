import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button'; // hmr-trigger-3
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Send, AlertTriangle, Zap, Search, Globe, Filter, Eye, Edit3, Plus, CalendarClock, ShieldCheck, Save, ChevronLeft, ChevronRight } from 'lucide-react';
import EmailSettingsPanel, { DEFAULT_EMAIL_SETTINGS, type EmailSettings } from '@/components/EmailSettingsPanel';
import OfferActionIcons from '@/components/OfferActionIcons';
import { adminOfferApi } from '@/services/adminOfferApi';
import loginLogsService from '@/services/loginLogsService';
import { Separator } from '@/components/ui/separator';

interface AutomationSendNowModalProps {
  open: boolean;
  onClose: () => void;
  queueItem: any; // AutomationQueueItem
  queueItems?: any[]; // For bulk selection
  onSent?: () => void;
  apiUrl: string;
  startInPreview?: boolean;
}

export default function AutomationSendNowModal({ open, onClose, queueItem, queueItems = [], onSent, apiUrl, startInPreview = false }: AutomationSendNowModalProps) {
  const isBulk = queueItems.length > 1;
  const activeItems = isBulk ? queueItems : (queueItem ? [queueItem] : []);
  const mainItem = activeItems[0];

  const [offers, setOffers] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sendVia, setSendVia] = useState<'email'>('email');
  const [customMsg, setCustomMsg] = useState('');
  const [emailSubject, setEmailSubject] = useState('Recommended Offers');
  const [messageBody, setMessageBody] = useState('');
  const [sending, setSending] = useState(false);
  const [savingToQueue, setSavingToQueue] = useState(false);
  const [emailSettings, setEmailSettings] = useState<EmailSettings>(DEFAULT_EMAIL_SETTINGS);
  const [expandedOffers, setExpandedOffers] = useState<Set<string>>(new Set());
  const [offerSearch, setOfferSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchCountry, setSearchCountry] = useState(mainItem?.country || '');
  const [previewMode, setPreviewMode] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string>(''); // ISO String
  const [payoutOverrides, setPayoutOverrides] = useState<Record<string, string>>({});
  const [personalOverrides, setPersonalOverrides] = useState<Record<string, {subject: string, body: string}>>({});
  const [previewIdx, setPreviewIdx] = useState(0);
  const [automationInterval, setAutomationInterval] = useState('3h 20m');
  const { toast } = useToast();
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (open) {
      setPreviewMode(startInPreview);
    }
  }, [open, startInPreview]);

  const getOfferId = (o: any) => o?.offer_id || o?._id || o?.id;

  // Load Unified Offers (AI + Backend + Selection)
  useEffect(() => {
    if (!open || activeItems.length === 0) return;
    
    const loadData = async () => {
      setSearching(true);
      try {
        const token = localStorage.getItem('token');
        
        // 1. If single user, fetch full AI + Automation state
        if (!isBulk && mainItem?.user_id) {
          // Fetch everything needed for scoring parity, including offer views for session verticals
          const [intelRes, autoRes, signalsRes, viewsRes] = await Promise.all([
            loginLogsService.getInventoryMatchedOffers(mainItem.user_id),
            fetch(`${apiUrl}/api/admin/automation/queue/${mainItem.user_id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            }).then(r => r.ok ? r.json() : { item: null }).catch(() => ({ item: null })),
            loginLogsService.getUserSignals(mainItem.user_id, mainItem.username, mainItem.email).catch(() => null),
            loginLogsService.getOfferViews(mainItem.user_id, 20, mainItem.username, mainItem.email).catch(() => ({ views: [] }))
          ]);

          // Calculate vertical preferences identically to UserIntelligenceProfile
          const safeOfferViews = Array.isArray(viewsRes?.views) ? viewsRes.views : [];
          let currentSessionVerticals = null;
          if (safeOfferViews.length > 0) {
            const counts: Record<string, number> = {};
            let total = 0;
            safeOfferViews.forEach((v: any) => {
              const cat = v.offer_details?.category || v.category || 'Unknown';
              if (cat && cat !== 'Unknown') {
                counts[cat] = (counts[cat] || 0) + 1;
                total++;
              }
            });
            if (total > 0) {
              currentSessionVerticals = Object.entries(counts)
                .map(([name, count]) => ({ name, value: Math.round((count / total) * 100) }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5);
            }
          }

          const verticalData = currentSessionVerticals || (signalsRes?.top_verticals?.length > 0 ? signalsRes.top_verticals : [{name: mainItem.verticals?.[0] || 'Unknown', value: 100}]);
          const topCats = verticalData.slice(0, 2).map((v: any) => (v.name || '').toLowerCase());

          const matched: any[] = [];
          const seenIds = new Set();
          
          // PRIORITY: Use backend queue (Fresh API preferred, then existing Prop data)
          const queueItems = (autoRes.item?.next_offers || mainItem?.next_offers || []);
          const queueOfferIds = new Set<string>();
          
          if (Array.isArray(queueItems)) {
            queueItems.forEach((o: any) => {
              const id = o.offer_id || o._id || o.id;
              if (id && !seenIds.has(id)) {
                seenIds.add(id);
                queueOfferIds.add(id);
                matched.push({ 
                  ...o, id, 
                  source: 'Automation Queue', 
                  matchScore: 100, // Top priority
                  isBackend: true 
                });
              }
            });
          }

          const addSection = (sectionName: string, sourceLabel: string, baseScore: number, typeLabel: string) => {
            if (intelRes[sectionName] && Array.isArray(intelRes[sectionName])) {
              intelRes[sectionName].forEach((o: any, idx: number) => {
                const id = o.offer_id || o._id || o.id;
                if (id && !seenIds.has(id)) {
                  seenIds.add(id);

                  // Apply identical vertical-boosting logic as UserIntelligenceProfile
                  let matchScore = Math.max(50, baseScore - (idx * 4));
                  if (topCats.length > 0) {
                    const offerCat = (o.category || o.vertical || '').toLowerCase();
                    if (offerCat && topCats.includes(offerCat)) {
                      matchScore = Math.min(99, matchScore + 15);
                    } else if (offerCat && verticalData.some((v: any) => v.name.toLowerCase() === offerCat)) {
                      matchScore = Math.min(99, matchScore + 5);
                    }
                  }

                  matched.push({
                    ...o, id,
                    matchScore,
                    source: sourceLabel,
                    type: typeLabel,
                    isIntelligenceMatch: true
                  });
                }
              });
            }
          };

          // Standard sections from loginLogsService.getInventoryMatchedOffers
          addSection('most_approved', 'Most Approved', 98, 'Cashback');
          addSection('newly_added', 'Newly Added', 91, 'Cashback');
          addSection('highly_clicked', 'Highly Clicked', 87, 'Cashback');
          addSection('recently_edited', 'Recently Edited', 79, 'Discount');
          addSection('recently_deleted', 'Clearance', 74, 'Discount');

          const finalOffers = matched.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0)).slice(0, 6);
          if (finalOffers.length > 0) {
            setOffers(finalOffers);
            
            // If we have actual backend queue items, ONLY select those by default
            if (queueOfferIds.size > 0) {
               setSelected(new Set(Array.from(queueOfferIds)));
            } else {
               // Otherwise, default to selecting the top 3 AI matches
               setSelected(new Set(finalOffers.slice(0, 3).map(o => o.id)));
            }
          } else {
            // Fallback for no intelligence - try country first, then broad active
            let fallback = await adminOfferApi.getOffers({ country: mainItem.country || '', status: 'active', per_page: 15 });
            if (!fallback.offers || fallback.offers.length === 0) {
              fallback = await adminOfferApi.getOffers({ status: 'active', per_page: 15 });
            }
            
            const results = fallback.offers || [];
            setOffers(results);
            if (results.length > 0) {
              setSelected(new Set([getOfferId(results[0])]));
            }
          }
        } 
        // 2. If bulk, aggregate offers from selected items
        else if (isBulk) {
          const allOffers: any[] = [];
          const seenIds = new Set();
          activeItems.forEach(item => {
            (item.next_offers || []).forEach((o: any) => {
              const id = getOfferId(o);
              if (id && !seenIds.has(id)) {
                seenIds.add(id);
                allOffers.push({ ...o, id, source: 'Bulk Match' });
              }
            });
          });
          setOffers(allOffers);
          if (allOffers.length > 0) setSelected(new Set(allOffers.slice(0, 3).map(o => o.id)));
        }
      } catch (e) {
        console.error('Failed to load offers', e);
      } finally {
        setSearching(false);
      }
    };

    loadData();
    setPreviewIdx(0);
  }, [open, isBulk, mainItem?.user_id]);

  // Initialize personal overrides for all selected users
  useEffect(() => {
    if (!open || activeItems.length === 0) return;
    
    setPersonalOverrides(prev => {
      const next = { ...prev };
      let changed = false;
      activeItems.forEach(item => {
        // If we don't have an override yet, or it's empty, initialize it
        if (!next[item.user_id] || !next[item.user_id].body) {
          const name = item.username || 'Publisher';
          let note = customMsg || item.custom_message || 'We have found some great offers that match what you are looking for. Check out the offers below and log in to your publisher dashboard to get started.';
          
          // Prevent double greeting if the note already starts with "Hi" or "Hello"
          const hasGreeting = note.trim().toLowerCase().startsWith('hi') || note.trim().toLowerCase().startsWith('hello');
          const finalBody = hasGreeting ? note : `Hi ${name},\n\n${note}\n\nBest regards,\nPublisher Support Team\nMoustache Leads`;

          next[item.user_id] = {
            subject: item.custom_subject || next[item.user_id]?.subject || 'Recommended Offers',
            body: finalBody
          };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [open, activeItems.length, customMsg]);

  // Empty section - logic moved to unified effect above

  const toggle = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  // Update current inputs when recipient index changes OR overrides change
  useEffect(() => {
    const current = activeItems[previewIdx];
    if (current && personalOverrides[current.user_id]) {
      setEmailSubject(personalOverrides[current.user_id].subject);
      setMessageBody(personalOverrides[current.user_id].body);
    }
  }, [previewIdx, personalOverrides]);

  // Sync inputs back to overrides
  const handleInputChange = (field: 'subject' | 'body', value: string) => {
    if (field === 'subject') setEmailSubject(value);
    else setMessageBody(value);

    const current = activeItems[previewIdx];
    if (current) {
      setPersonalOverrides(prev => ({
        ...prev,
        [current.user_id]: {
          ...prev[current.user_id],
          [field]: value
        }
      }));
    }
  };

  const copyToAll = () => {
    setPersonalOverrides(prev => {
      const next = { ...prev };
      activeItems.forEach(item => {
        next[item.user_id] = { subject: emailSubject, body: messageBody };
      });
      return next;
    });
    toast({ title: 'Copied to All', description: 'Current subject and message applied to all selected recipients.' });
  };

  const handleManualSearch = async () => {
    if (!offerSearch.trim() && !searchCountry) return;
    setSearching(true);
    try {
      const res = await adminOfferApi.getOffers({
        search: offerSearch,
        country: searchCountry,
        status: 'active',
        per_page: 20
      });
      if (res.offers && res.offers.length > 0) {
        // Merge with existing offers, avoiding duplicates
        const existingIds = new Set(offers.map(o => getOfferId(o)));
        const newUniqueOffers = res.offers.filter(o => !existingIds.has(getOfferId(o)));
        setOffers(prev => [...prev, ...newUniqueOffers]);
        toast({ title: 'Search Complete', description: `Found ${res.offers.length} offers matching your criteria.` });
      } else {
        toast({ title: 'No Results', description: 'No active offers found for your search.' });
      }
    } catch (e) {
      toast({ title: 'Search Error', description: 'Failed to search offers', variant: 'destructive' });
    } finally {
      setSearching(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!messageBody.trim()) return;
    const templateName = window.prompt("Enter a name for this new template:", "Custom Outreach Template");
    if (!templateName) return;

    setSending(true);
    try {
      const res = await fetch(`${apiUrl}/api/admin/support/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: templateName,
          subject: emailSubject,
          body: messageBody,
          category: 'Support'
        }),
      });
      if (!res.ok) throw new Error();
      toast({ title: 'Template Saved', description: `"${templateName}" is now available in your support hub.` });
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to save template', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleSaveToQueue = async () => {
    if (activeItems.length === 0) return;
    setSavingToQueue(true);
    try {
      const token = localStorage.getItem('token');
      // If bulk, we save for all selected users
      const promises = activeItems.map(item => 
        fetch(`${apiUrl}/api/admin/automation/override`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            user_id: item.user_id,
            action: 'save-content',
            subject: emailSubject,
            message: messageBody
          }),
        })
      );
      await Promise.all(promises);
      toast({ title: 'Content Saved', description: `Subject and message have been persisted for ${activeItems.length} user(s).` });
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to save content', variant: 'destructive' });
    } finally {
      setSavingToQueue(false);
    }
  };

  const handleSend = async () => {
    if (activeItems.length === 0 || selected.size === 0) return;
    
    // If not in preview mode, switch to preview mode first as a "soft" confirmation
    if (!previewMode) {
      setPreviewMode(true);
      toast({ title: 'Preview Mode', description: 'Please review the email layout before final dispatch.' });
      return;
    }

    setSending(true);
    try {
      const promises = activeItems.map(item => {
        const personal = personalOverrides[item.user_id] || { subject: emailSubject, body: messageBody };
        // We still allow dynamic placeholders if they want to use them in individual edits
        const finalBody = personal.body.replace(/{{username}}/g, item.username || 'Publisher')
                                      .replace(/{{name}}/g, item.username || 'Publisher');
        const finalSubject = personal.subject.replace(/{{username}}/g, item.username || 'Publisher')
                                            .replace(/{{name}}/g, item.username || 'Publisher');

        return fetch(`${apiUrl}/api/admin/automation/send-now`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            user_id: item.user_id,
            offer_ids: Array.from(selected),
            send_via: sendVia,
            custom_message: customMsg,
            email_subject: finalSubject,
            message_body: finalBody,
            template_style: emailSettings.templateStyle,
            visible_fields: emailSettings.visibleFields,
            see_more_fields: emailSettings.seeMoreFields,
            default_image: emailSettings.defaultImage,
            payout_type: emailSettings.payoutType,
            mask_preview_links: emailSettings.maskPreviewLinks,
            payment_terms: emailSettings.paymentTerms,
            preview_in_email: emailSettings.previewInEmail,
            custom_preview_in_email: emailSettings.customPreviewInEmail,
            scheduled_at: scheduledAt || null,
            automation_interval: automationInterval,
            is_initiation: true,
            payout_overrides: payoutOverrides
          }),
        });
      });
      
      const results = await Promise.all(promises);
      const allOk = results.every(r => r.ok);
      
      if (!allOk) throw new Error('Some messages failed to send');
      
      toast({ title: 'Success', description: `Successfully dispatched outreach to ${activeItems.length} user(s).` });
      if (onSent) onSent();
      onClose();
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to send outreach', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const viaOpts: { key: 'email'; icon: React.ReactNode; label: string }[] = [
    { key: 'email', icon: <Mail className="w-3.5 h-3.5" />, label: 'to Email' },
  ];

  const offersWithoutImage = offers.filter(o => selected.has(o.id || o._id) && !o.image_url && !o.thumbnail_url);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white shadow-2xl border-none">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="flex items-center gap-3 text-xl font-bold">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Zap className={`w-5 h-5 fill-indigo-600 ${queueItem?.queue_status === 'completed' ? 'text-emerald-600 fill-emerald-600' : 'text-indigo-600'}`} />
            </div>
            <span>{isBulk ? `Bulk Send Now (${activeItems.length} Users)` : (mainItem?.queue_status === 'completed' ? 'Automation Outreach History' : 'Send Offers (Manual Override)')}</span>
            {activeItems.length > 0 && (
              <div className="flex items-center gap-2 ml-2">
                <Badge variant="secondary" className="bg-slate-100 text-slate-700">{isBulk ? `${activeItems.length} Recipients` : mainItem.username}</Badge>
                {!isBulk && mainItem.queue_status === 'completed' && (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Cycle Completed</Badge>
                )}
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 space-y-6">
          {queueItem?.queue_status === 'completed' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Historical Sent Offers (Sent to User)</Label>
                <Badge variant="outline" className="text-emerald-600 bg-emerald-50 border-emerald-100">All Steps Delivered</Badge>
              </div>

              <div className="space-y-1.5 max-h-96 overflow-y-auto border rounded-xl p-2 bg-slate-50/50 custom-scrollbar">
                {!queueItem?.sent_history || queueItem?.sent_history.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-sm text-slate-400 italic">No historical offers found in the tracking logs.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Show only the most recent 5 offers to align with the current 5-step cycle */}
                    {queueItem?.sent_history.slice(-5).map((o: any, idx: number) => (
                      <div
                        key={`history-row-${idx}`}
                        className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white shadow-sm hover:border-indigo-100 transition-colors"
                      >
                        <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center p-1 border border-slate-200">
                          <img
                            src={o.image_url || o.thumbnail_url || 'https://pub-2035987158934571.r2.dev/placeholder.png'}
                            className="max-w-full max-h-full object-contain"
                            alt=""
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-[11px] font-bold text-slate-700 truncate">{o.name || o.offer_name}</h4>
                            <Badge variant="outline" className="text-[9px] h-3.5 px-1 bg-indigo-50/50 text-indigo-600 border-indigo-100">Step {idx + 1}</Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-sm font-black text-emerald-600">${o.payout || '0'}</span>
                            <span className="text-[9px] text-slate-400 font-medium uppercase tracking-tighter">{o.category || 'General'}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] font-bold text-emerald-500 uppercase flex items-center gap-1">
                            <ShieldCheck size={10} /> Delivered
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                <p className="text-xs text-blue-700 font-medium leading-relaxed">
                  This user has completed the automation cycle. The list above shows the specific offers that were selected and sent to their email during the outreach process.
                </p>
              </div>
            </div>
          ) : (
            /* ACTIVE CYCLE - EDIT/PREVIEW MODE */
            <>
              <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200 mb-4">
                <div className="flex gap-1 p-1 bg-slate-200/50 rounded-lg">
                  <Button
                    size="sm"
                    variant={!previewMode ? 'default' : 'ghost'}
                    className={`h-8 px-4 text-xs font-bold gap-2 transition-all ${!previewMode ? 'bg-white text-indigo-600 shadow-sm hover:bg-white' : 'text-slate-500'}`}
                    onClick={() => setPreviewMode(false)}
                  >
                    <Edit3 size={14} /> Edit Content
                  </Button>
                  <Button
                    size="sm"
                    variant={previewMode ? 'default' : 'ghost'}
                    className={`h-8 px-4 text-xs font-bold gap-2 transition-all ${previewMode ? 'bg-white text-indigo-600 shadow-sm hover:bg-white' : 'text-slate-500'}`}
                    onClick={() => setPreviewMode(true)}
                  >
                    <Eye size={14} /> Live Preview
                  </Button>
                </div>
                {previewMode && (
                  <span className="text-[10px] font-black uppercase text-amber-600 flex items-center gap-1 px-3">
                    <AlertTriangle size={10} /> Previewing final layout
                  </span>
                )}
                {isBulk && (
                  <div className="flex items-center gap-2 bg-indigo-50 rounded-lg p-1 border border-indigo-100 shadow-sm ml-auto">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-7 w-7 p-0 text-indigo-600 hover:bg-indigo-100"
                      onClick={() => setPreviewIdx(prev => (prev > 0 ? prev - 1 : activeItems.length - 1))}
                    >
                      <ChevronLeft size={16} />
                    </Button>
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-black text-indigo-700 uppercase leading-none">Editing Recipient</span>
                      <span className="text-[11px] font-bold text-indigo-600">
                        {activeItems[previewIdx]?.username || 'User'} ({previewIdx + 1}/{activeItems.length})
                      </span>
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-7 w-7 p-0 text-indigo-600 hover:bg-indigo-100"
                      onClick={() => setPreviewIdx(prev => (prev < activeItems.length - 1 ? prev + 1 : 0))}
                    >
                      <ChevronRight size={16} />
                    </Button>
                    <Separator orientation="vertical" className="h-6 bg-indigo-200 mx-1" />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[10px] font-black text-indigo-400 hover:text-indigo-600"
                      onClick={copyToAll}
                      title="Apply current subject/message to all recipients"
                    >
                      COPY TO ALL
                    </Button>
                  </div>
                )}
              </div>
              
              {/* CYCLE ROADMAP - TRACKING ALL 5 STEPS */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 mb-4">
                 <div className="flex items-center justify-between mb-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Automation Progress</span>
                      <span className="text-xs font-bold text-slate-700">{isBulk ? "Multiple Users" : `${(mainItem?.current_step || 0)} of 5 Outreaches Completed`}</span>
                    </div>
                    <Badge variant="outline" className="bg-white text-indigo-600 border-indigo-100 font-bold px-2 py-0.5">
                      {isBulk ? "Bulk Dispatch" : `Step ${(mainItem?.current_step || 0) + 1} Ongoing`}
                    </Badge>
                 </div>
                
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((stepNum) => {
                    const currentRecip = activeItems[previewIdx] || queueItem;
                    const isSent = stepNum <= (currentRecip?.current_step || 0);
                    const isOngoing = stepNum === (currentRecip?.current_step || 0) + 1;
                    const sentOffer = currentRecip?.sent_history?.[stepNum - 1];
                    const nextOffer = isOngoing ? (currentRecip?.next_offers?.[0] || offers[0]) : null;

                    return (
                      <div key={`roadmap-step-${stepNum}`} className="flex-1 flex flex-col gap-2">
                        <div className={`h-1.5 rounded-full transition-all ${isSent ? 'bg-emerald-500' : isOngoing ? 'bg-indigo-500 animate-pulse' : 'bg-slate-200'}`} />
                        <div className="px-1">
                          <div className={`text-[9px] font-black uppercase ${isSent ? 'text-emerald-600' : isOngoing ? 'text-indigo-600' : 'text-slate-400'}`}>
                            {isSent ? 'Sent' : isOngoing ? 'Ongoing' : 'Waiting'}
                          </div>
                          <div className="text-[10px] font-bold text-slate-600 truncate max-w-[80px]">
                            {isSent ? (sentOffer?.name || 'Offer Sent') : isOngoing ? (nextOffer?.name || 'Matching...') : `Step ${stepNum}`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="mt-4 space-y-6">
                {!previewMode ? (
                  <div className="space-y-4">
                    {/* Missing image warning */}
                    {offersWithoutImage.length > 0 && (
                      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <p className="font-bold text-amber-800">{offersWithoutImage.length} offer(s) have no image</p>
                          <p className="text-xs text-amber-600 mt-0.5">
                            {offersWithoutImage.map(o => o.name).join(', ')}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Offer selection */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Candidate Offers (Ranked by AI)</Label>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-lg border border-slate-200">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[9px] font-black text-indigo-600 hover:bg-white transition-all"
                              onClick={() => {
                                const allIds = offers.map(o => getOfferId(o)).filter(Boolean);
                                setSelected(new Set(allIds as string[]));
                              }}
                            >
                              SELECT ALL
                            </Button>
                            <Separator orientation="vertical" className="h-3 bg-slate-200" />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[9px] font-black text-slate-400 hover:bg-white transition-all"
                              onClick={() => setSelected(new Set())}
                            >
                              CLEAR
                            </Button>
                          </div>
                          <Separator orientation="vertical" className="h-5 mx-1" />
                          <div className="relative group">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Search all offers..."
                              value={offerSearch}
                              onChange={e => setOfferSearch(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleManualSearch()}
                              className="h-7 pl-8 pr-3 text-[10px] border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none w-32 focus:w-48 transition-all bg-slate-50/50"
                            />
                          </div>
                          <div className="relative">
                            <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Geo"
                              value={searchCountry}
                              onChange={e => setSearchCountry(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleManualSearch()}
                              className="h-7 pl-8 pr-3 text-[10px] border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none w-16 bg-slate-50/50"
                            />
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                            onClick={handleManualSearch}
                            disabled={searching}
                          >
                            {searching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Filter className="h-3 w-3" />}
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-1.5 max-h-64 overflow-y-auto border rounded-xl p-2 bg-slate-50/50 custom-scrollbar">
                        {searching ? (
                          <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 text-indigo-500 animate-spin mb-3" />
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest animate-pulse">Analyzing AI Intelligence...</p>
                          </div>
                        ) : offers.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                            <p className="text-sm text-muted-foreground italic mb-2">No matching offers found for this user's profile.</p>
                            <p className="text-[10px] text-slate-400">Use the search bar above to manually find and add offers to this outreach.</p>
                          </div>
                        ) : null}
                        {offers.map((o, idx) => {
                          const oId = getOfferId(o) || `idx-${idx}`;
                          const isSelected = selected.has(oId);
                          return (
                            <div
                              key={`offer-row-${oId}`}
                              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${isSelected ? 'bg-white border-indigo-200 shadow-sm' : 'border-transparent hover:bg-white/50'}`}
                              onClick={() => toggle(oId)}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggle(oId)}
                                className="rounded-md border-slate-300"
                              />
                              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center p-1 border border-slate-200">
                                <img
                                  src={o.image_url || o.thumbnail_url || emailSettings.defaultImage || 'https://pub-2035987158934571.r2.dev/placeholder.png'}
                                  className="max-w-full max-h-full object-contain"
                                  alt=""
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHJ4PSI4IiBmaWxsPSIjRjFGNUY5Ii8+PHBhdGggZD0iTTMyIDQwQzM2LjQxODMgNDAgNDAgMzYuNDE4MyA0MCAzMkM0MCAyNy41ODE3IDM2LjQxODMgMjQgMzIgMjRDMjcuNTgxNyAyNCAyNCAyNy41ODE3IDI0IDMyQzI0IDM2LjQxODMgMjcuNTgxNyA0MCAzMiA0MFoiIHN0cm9rZT0iIzk0QThCMCIgc3Ryb2tlLXdpZHRoPSIyIi8+PHBhdGggZD0iTTMyIDMyTDM2IDM2TDI4IDI4IiBzdHJva2U9IiM5NEE4QjAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PC9zdmc+';
                                  }}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-[11px] font-bold text-slate-700 truncate">{o.name || o.offer_name}</h4>
                                  <Badge variant="outline" className="text-[8px] h-3.5 px-1 bg-slate-50 border-slate-200 text-slate-500 uppercase">{o.countries?.[0] || o.country || 'WW'}</Badge>
                                  {o.source && <Badge className="text-[7px] h-3 px-1 bg-indigo-50 text-indigo-600 border-none font-black uppercase">{o.source}</Badge>}
                                </div>
                                <div className="flex items-center gap-3 mt-0.5">
                                  <div className="flex items-center gap-1 payout-input" onClick={e => e.stopPropagation()}>
                                    <span className="text-[9px] font-black text-emerald-600">$</span>
                                    <input
                                      type="text"
                                      value={payoutOverrides[oId] !== undefined ? payoutOverrides[oId] : (o.payout || '0')}
                                      onChange={e => setPayoutOverrides(prev => ({ ...prev, [oId]: e.target.value }))}
                                      className="w-12 h-4 text-[9px] font-bold border-b border-dashed border-emerald-300 focus:border-emerald-500 bg-transparent outline-none text-emerald-600 px-0.5"
                                      placeholder="Payout"
                                    />
                                  </div>
                                  <span className="text-[9px] text-slate-400 font-medium uppercase tracking-tighter">{o.category || 'General'}</span>
                                </div>
                              </div>
                              <OfferActionIcons
                                offerId={oId}
                                offerName={o.name}
                                currentImageUrl={o.image_url || o.thumbnail_url || ''}
                                currentDescription={o.description || ''}
                                currentCategory={o.category || ''}
                                currentPreviewUrl2={(o as any).preview_url_2 || ''}
                                showApplyToAll={selected.size > 1}
                                onOfferUpdated={(id, field, value) => {
                                  setOffers(prev => prev.map(x => getOfferId(x) === id ? { ...x, [field === 'image' ? 'image_url' : field]: value } : x));
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Delivery method */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Send Via</Label>
                      <div className="flex gap-2">
                        {viaOpts.map(v => (
                          <Button key={`via-${v.key}`} size="sm" variant={sendVia === v.key ? 'default' : 'outline'}
                            className={`text-xs font-bold gap-1.5 px-4 h-9 rounded-lg transition-all ${sendVia === v.key ? 'bg-indigo-600 hover:bg-indigo-700 shadow-md' : 'border-slate-200 text-slate-600'}`} onClick={() => setSendVia(v.key)}>
                            {v.icon}{v.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Email Subject */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Subject</Label>
                      <div className="relative">
                        <Input 
                          value={emailSubject} 
                          onChange={e => handleInputChange('subject', e.target.value)}
                          placeholder="Enter email subject..."
                          className="pl-9 h-11 text-sm font-bold border-slate-200 focus:ring-indigo-500 rounded-xl bg-slate-50/30" 
                        />
                        <Edit3 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      </div>
                    </div>

                    {/* Message Body */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Message Content (Editable)</Label>
                      <Textarea value={messageBody} onChange={e => handleInputChange('body', e.target.value)}
                        rows={6} className="text-sm font-medium border-slate-200 focus:ring-indigo-500 focus:border-indigo-500 rounded-xl bg-slate-50/30" />
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-slate-400 italic font-medium">Offers will be automatically appended below your message.</p>
                        <Badge variant="outline" className="text-[9px] bg-indigo-50 text-indigo-600 border-indigo-100 font-bold">
                          Tip: Use {"{{username}}"} for personalization
                        </Badge>
                      </div>
                    </div>

                    {/* Email Template Settings Panel */}
                    <EmailSettingsPanel settings={emailSettings} onChange={setEmailSettings} compact offerIds={Array.from(selected)} />

                    {/* Personal Note */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Personal Note (Appended at end)</Label>
                      <Textarea value={customMsg} onChange={e => setCustomMsg(e.target.value)}
                        placeholder="Add a personal note to make it more professional..." rows={2} className="text-sm border-slate-200 focus:ring-indigo-500 rounded-xl resize-none bg-slate-50/30" />
                    </div>
                  </div>
                ) : (
                  /* PREVIEW MODE UI */
                  <div className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-8 min-h-[500px]">
                    <div className="max-w-3xl mx-auto bg-white shadow-2xl rounded-xl overflow-hidden border border-slate-100">
                      {/* Email Header Simulation */}
                      <div className="bg-indigo-600 p-6 text-white flex justify-between items-center relative">
                        <div>
                          <h2 className="text-xl font-bold">{emailSubject.replace(/{{username}}/g, activeItems[previewIdx]?.username || 'Publisher').replace(/{{name}}/g, activeItems[previewIdx]?.username || 'Publisher') || "Recommended Offers"}</h2>
                          <p className="text-indigo-100 text-xs mt-1">Curated specifically for {activeItems[previewIdx]?.username || 'Publisher'}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20">
                            {emailSettings.templateStyle} View
                          </div>
                          {isBulk && (
                            <div className="flex items-center gap-2 bg-black/20 rounded-lg p-1 border border-white/10">
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-6 w-6 p-0 text-white hover:bg-white/20"
                                onClick={() => setPreviewIdx(prev => (prev > 0 ? prev - 1 : activeItems.length - 1))}
                              >
                                <ChevronLeft size={14} />
                              </Button>
                              <span className="text-[10px] font-bold min-w-[60px] text-center">
                                User {previewIdx + 1} of {activeItems.length}
                              </span>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-6 w-6 p-0 text-white hover:bg-white/20"
                                onClick={() => setPreviewIdx(prev => (prev < activeItems.length - 1 ? prev + 1 : 0))}
                              >
                                <ChevronRight size={14} />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="p-8 space-y-6">
                        {/* Message Body */}
                        <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                          {messageBody.replace(/{{username}}/g, activeItems[previewIdx]?.username || 'Publisher').replace(/{{name}}/g, activeItems[previewIdx]?.username || 'Publisher')}
                        </div>

                        <Separator className="bg-slate-100" />

                        {/* Dynamic Offers Simulation */}
                        <div className="space-y-4">
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Featured Opportunities</p>

                          {emailSettings.templateStyle === 'table' ? (
                            /* TABLE VIEW PREVIEW */
                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                  <tr>
                                    {emailSettings.visibleFields.includes('image') && <th className="p-3 font-bold text-slate-500 uppercase tracking-tighter">Icon</th>}
                                    {emailSettings.visibleFields.includes('offer_id') && <th className="p-3 font-bold text-slate-500 uppercase tracking-tighter">Offer ID</th>}
                                    {emailSettings.visibleFields.includes('name') && <th className="p-3 font-bold text-slate-500 uppercase tracking-tighter">Offer</th>}
                                    {emailSettings.visibleFields.includes('payout') && <th className="p-3 font-bold text-slate-500 uppercase tracking-tighter">Payout</th>}
                                    {emailSettings.visibleFields.includes('countries') && <th className="p-3 font-bold text-slate-500 uppercase tracking-tighter">GEO</th>}
                                    {emailSettings.visibleFields.includes('network') && <th className="p-3 font-bold text-slate-500 uppercase tracking-tighter">Network</th>}
                                    {emailSettings.visibleFields.includes('preview_url') && <th className="p-3 font-bold text-slate-500 uppercase tracking-tighter">Link 1</th>}
                                    {emailSettings.visibleFields.includes('preview_url_2') && <th className="p-3 font-bold text-slate-500 uppercase tracking-tighter">Link 2</th>}
                                    {emailSettings.visibleFields.includes('clicks') && <th className="p-3 font-bold text-slate-500 uppercase tracking-tighter">Clicks</th>}
                                    {emailSettings.visibleFields.includes('payment_terms') && <th className="p-3 font-bold text-slate-500 uppercase tracking-tighter">Terms</th>}
                                    {emailSettings.visibleFields.includes('description') && <th className="p-3 font-bold text-slate-500 uppercase tracking-tighter">Desc</th>}
                                    <th className="p-3 font-bold text-slate-500 uppercase tracking-tighter text-right">Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {offers.filter(o => selected.has(getOfferId(o))).map((o, i) => {
                                    const oId = getOfferId(o);
                                    const isExpanded = expandedOffers.has(oId);
                                    return (
                                      <React.Fragment key={`preview-table-${oId}`}>
                                        <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                                          {emailSettings.visibleFields.includes('image') && (
                                            <td className="p-3">
                                              <div className="w-10 h-10 bg-white rounded border border-slate-200 p-1 flex items-center justify-center">
                                                <img
                                                  src={o.image_url || o.thumbnail_url || emailSettings.defaultImage || 'https://pub-2035987158934571.r2.dev/placeholder.png'}
                                                  className="w-full h-full object-contain"
                                                  alt=""
                                                  onError={(e) => {
                                                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHJ4PSI4IiBmaWxsPSIjRjFGNUY5Ii8+PHBhdGggZD0iTTMyIDQwQzM2LjQxODMgNDAgNDAgMzYuNDE4MyA0MCAzMkM0MCAyNy41ODE3IDM2LjQxODMgMjQgMzIgMjRDMjcuNTgxNyAyNCAyNCAyNy41ODE3IDI0IDMyQzI0IDM2LjQxODMgMjcuNTgxNyA0MCAzMiA0MFoiIHN0cm9rZT0iIzk0QThCMCIgc3Ryb2tlLXdpZHRoPSIyIi8+PHBhdGggZD0iTTMyIDMyTDM2IDM2TDI4IDI4IiBzdHJva2U9IiM5NEE4QjAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PC9zdmc+';
                                                  }}
                                                />
                                              </div>
                                            </td>
                                          )}
                                          {emailSettings.visibleFields.includes('offer_id') && (
                                            <td className="p-3">
                                              <span className="font-mono text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{getOfferId(o)}</span>
                                            </td>
                                          )}
                                          {emailSettings.visibleFields.includes('name') && (
                                            <td className="p-3 font-bold text-slate-900">
                                              {o.name}
                                              {emailSettings.visibleFields.includes('category') && <span className="block text-[9px] text-slate-400 font-medium uppercase mt-0.5">{o.category || 'General'}</span>}
                                            </td>
                                          )}
                                          {emailSettings.visibleFields.includes('payout') && (
                                            <td className="p-3">
                                              <div className="text-sm font-black text-emerald-600">
                                                {payoutOverrides[oId] ? `$${payoutOverrides[oId]}` : (emailSettings.payoutType === 'publisher' ? (o.payout_display || `$${o.payout}`) : `$${o.payout}`)}
                                              </div>
                                            </td>
                                          )}
                                          {emailSettings.visibleFields.includes('countries') && (
                                            <td className="p-3 text-slate-500 font-medium">
                                              {o.countries?.slice(0, 3).join(', ') || 'Global'}
                                            </td>
                                          )}
                                          {emailSettings.visibleFields.includes('network') && (
                                            <td className="p-3 text-slate-500 font-medium text-[10px]">
                                              {(o as any).network || 'N/A'}
                                            </td>
                                          )}
                                          {emailSettings.visibleFields.includes('preview_url') && (
                                            <td className="p-3">
                                              <a href={(o as any).preview_url || '#'} className="text-[10px] text-indigo-500 truncate max-w-[80px] block underline">Link</a>
                                            </td>
                                          )}
                                          {emailSettings.visibleFields.includes('preview_url_2') && (
                                            <td className="p-3">
                                              <a href={(o as any).preview_url_2 || '#'} className="text-[10px] text-violet-500 truncate max-w-[80px] block underline">Link</a>
                                            </td>
                                          )}
                                          {emailSettings.visibleFields.includes('clicks') && (
                                            <td className="p-3 text-slate-600 font-medium text-[10px]">
                                              {(o as any).clicks || o.hits || 0}
                                            </td>
                                          )}
                                          {emailSettings.visibleFields.includes('payment_terms') && (
                                            <td className="p-3 font-black text-blue-600 uppercase text-[9px]">
                                              {emailSettings.paymentTerms || 'Standard'}
                                            </td>
                                          )}
                                          {emailSettings.visibleFields.includes('description') && (
                                            <td className="p-3 text-slate-500 text-[9px] italic max-w-[120px] truncate" title={o.description}>
                                              {o.description || 'Exclusive offer details available.'}
                                            </td>
                                          )}
                                          <td className="p-3 text-right">
                                            <Button
                                              size="sm"
                                              className={`h-7 px-4 font-bold text-[10px] transition-all shadow-sm ${isExpanded ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                                              onClick={() => {
                                                setExpandedOffers(prev => {
                                                  const n = new Set(prev);
                                                  n.has(oId) ? n.delete(oId) : n.add(oId);
                                                  return n;
                                                });
                                              }}
                                            >
                                              {isExpanded ? 'Hide' : 'Open'}
                                            </Button>
                                          </td>
                                        </tr>
                                        {(isExpanded && emailSettings.seeMoreFields.length > 0) && (
                                          <tr className="bg-slate-50/50 animate-in fade-in slide-in-from-top-1 duration-200">
                                            <td colSpan={12} className="p-4 pt-2">
                                              <div className="flex flex-col gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-inner">
                                                <div className="flex items-center gap-2 text-[10px] font-black text-amber-500 uppercase tracking-widest border-b border-slate-50 pb-2">
                                                  <Plus size={10} /> Secondary Offer Details
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                  {emailSettings.seeMoreFields.includes('name') && (
                                                    <div className="space-y-0.5 col-span-2">
                                                      <span className="text-[8px] font-bold text-slate-400 uppercase">Offer Name</span>
                                                      <p className="text-[10px] font-black text-slate-700">{o.name || o.campaign_name}</p>
                                                    </div>
                                                  )}
                                                  {emailSettings.seeMoreFields.includes('payout') && (
                                                    <div className="space-y-0.5">
                                                      <span className="text-[8px] font-bold text-slate-400 uppercase">Payout Amount</span>
                                                      <p className="text-[10px] font-black text-emerald-600">
                                                        {payoutOverrides[oId] ? `$${payoutOverrides[oId]}` : (emailSettings.payoutType === 'publisher' ? (o.payout_display || `$${o.payout}`) : `$${o.payout}`)}
                                                      </p>
                                                    </div>
                                                  )}
                                                  {emailSettings.seeMoreFields.includes('countries') && (
                                                    <div className="space-y-0.5">
                                                      <span className="text-[8px] font-bold text-slate-400 uppercase">Geographic Targeting</span>
                                                      <p className="text-[10px] font-medium text-slate-600">{o.countries?.join(', ') || 'Global'}</p>
                                                    </div>
                                                  )}
                                                  {emailSettings.seeMoreFields.includes('category') && (
                                                    <div className="space-y-0.5">
                                                      <span className="text-[8px] font-bold text-slate-400 uppercase">Vertical / Category</span>
                                                      <p className="text-[10px] font-medium text-slate-600">{o.category || 'General'}</p>
                                                    </div>
                                                  )}
                                                  {emailSettings.seeMoreFields.includes('image') && (
                                                    <div className="space-y-0.5">
                                                      <span className="text-[8px] font-bold text-slate-400 uppercase">Offer Creative</span>
                                                      <div className="h-10 w-10 rounded border border-slate-100 overflow-hidden bg-slate-50">
                                                        <img src={o.image_url || emailSettings.defaultImage || 'https://via.placeholder.com/150'} alt="creative" className="w-full h-full object-contain" />
                                                      </div>
                                                    </div>
                                                  )}
                                                  {emailSettings.seeMoreFields.includes('offer_id') && (
                                                    <div className="space-y-0.5">
                                                      <span className="text-[8px] font-bold text-slate-400 uppercase">Offer ID</span>
                                                      <p className="text-[10px] font-mono text-slate-600">{getOfferId(o)}</p>
                                                    </div>
                                                  )}
                                                  {emailSettings.seeMoreFields.includes('network') && (
                                                    <div className="space-y-0.5">
                                                      <span className="text-[8px] font-bold text-slate-400 uppercase">Network</span>
                                                      <p className="text-[10px] font-medium text-slate-600">{(o as any).network || 'N/A'}</p>
                                                    </div>
                                                  )}
                                                  {emailSettings.seeMoreFields.includes('preview_url') && (
                                                    <div className="space-y-0.5 col-span-2">
                                                      <span className="text-[8px] font-bold text-slate-400 uppercase">Tracking Link</span>
                                                      <p className="text-[10px] font-medium text-indigo-500 truncate underline cursor-pointer">{(o as any).preview_url || 'https://ml.link/v1'}</p>
                                                    </div>
                                                  )}
                                                  {emailSettings.seeMoreFields.includes('preview_url_2') && (
                                                    <div className="space-y-0.5 col-span-2">
                                                      <span className="text-[8px] font-bold text-slate-400 uppercase">Secondary Preview</span>
                                                      <p className="text-[10px] font-medium text-violet-500 truncate underline cursor-pointer">{(o as any).preview_url_2 || 'https://ml.link/v2'}</p>
                                                    </div>
                                                  )}
                                                  {emailSettings.seeMoreFields.includes('clicks') && (
                                                    <div className="space-y-0.5">
                                                      <span className="text-[8px] font-bold text-slate-400 uppercase">Clicks</span>
                                                      <p className="text-[10px] font-medium text-slate-600">{(o as any).clicks || o.hits || 0}</p>
                                                    </div>
                                                  )}
                                                  {emailSettings.seeMoreFields.includes('payment_terms') && (
                                                    <div className="space-y-0.5">
                                                      <span className="text-[8px] font-bold text-slate-400 uppercase">Payment Terms</span>
                                                      <p className="text-[10px] font-black text-blue-600 uppercase">{emailSettings.paymentTerms || 'Standard'}</p>
                                                    </div>
                                                  )}
                                                  {emailSettings.seeMoreFields.includes('description') && (
                                                    <div className="space-y-0.5 col-span-2">
                                                      <span className="text-[8px] font-bold text-slate-400 uppercase">Description</span>
                                                      <p className="text-[10px] text-slate-500 leading-relaxed italic">{o.description || 'Exclusive offer details available on the publisher dashboard.'}</p>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            </td>
                                          </tr>
                                        )}
                                      </React.Fragment>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            /* CARD VIEW PREVIEW */
                            <div className="grid grid-cols-2 gap-4">
                              {offers.filter(o => selected.has(getOfferId(o))).map((o, i) => {
                                const oId = getOfferId(o);
                                const isExpanded = expandedOffers.has(oId);
                                return (
                                  <div key={`preview-card-${oId}`} className="flex flex-col bg-slate-50 rounded-xl border border-slate-200 overflow-hidden group hover:border-indigo-200 transition-all">
                                    {emailSettings.visibleFields.includes('image') && (
                                      <div className="h-32 bg-white flex items-center justify-center p-4 border-b border-slate-100 relative">
                                        <img
                                          src={o.image_url || o.thumbnail_url || emailSettings.defaultImage || 'https://pub-2035987158934571.r2.dev/placeholder.png'}
                                          className="max-w-full max-h-full object-contain"
                                          alt=""
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHJ4PSI4IiBmaWxsPSIjRjFGNUY5Ii8+PHBhdGggZD0iTTMyIDQwQzM2LjQxODMgNDAgNDAgMzYuNDE4MyA0MCAzMkM0MCAyNy41ODE3IDM2LjQxODMgMjQgMzIgMjRDMjcuNTgxNyAyNCAyNCAyNy41ODE3IDI0IDMyQzI0IDM2LjQxODMgMjcuNTgxNyA0MCAzMiA0MFoiIHN0cm9rZT0iIzk0QThCMCIgc3Ryb2tlLXdpZHRoPSIyIi8+PHBhdGggZD0iTTMyIDMyTDM2IDM2TDI4IDI4IiBzdHJva2U9IiM5NEE4QjAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PC9zdmc+';
                                          }}
                                        />
                                        <Button
                                          size="sm"
                                          className="absolute bottom-2 right-2 h-6 px-2 text-[8px] font-black uppercase bg-white/80 backdrop-blur-sm text-indigo-600 border border-indigo-100 hover:bg-white"
                                          onClick={() => {
                                            setExpandedOffers(prev => {
                                              const n = new Set(prev);
                                              n.has(oId) ? n.delete(oId) : n.add(oId);
                                              return n;
                                            });
                                          }}
                                        >
                                          {isExpanded ? 'Less' : '+ More'}
                                        </Button>
                                      </div>
                                    )}
                                    <div className="p-4 space-y-2">
                                      {emailSettings.visibleFields.includes('name') && <h4 className="text-sm font-bold text-slate-900 truncate">{o.name}</h4>}
                                      <div className="flex items-center justify-between">
                                        {emailSettings.visibleFields.includes('payout') && (
                                          <span className="text-xs font-black text-emerald-600">
                                            {payoutOverrides[oId] ? `$${payoutOverrides[oId]}` : (emailSettings.payoutType === 'publisher' ? (o.payout_display || `$${o.payout}`) : `$${o.payout}`)}
                                          </span>
                                        )}
                                        <Button
                                          variant="ghost"
                                          className="h-6 p-0 text-[10px] font-bold text-indigo-600 uppercase hover:bg-transparent"
                                          onClick={() => {
                                            setExpandedOffers(prev => {
                                              const n = new Set(prev);
                                              n.has(oId) ? n.delete(oId) : n.add(oId);
                                              return n;
                                            });
                                          }}
                                        >
                                          {isExpanded ? 'Close' : 'Details →'}
                                        </Button>
                                      </div>
                                      {(isExpanded && emailSettings.seeMoreFields.length > 0) && (
                                        <div className="pt-3 mt-2 border-t border-slate-200 space-y-2 animate-in fade-in zoom-in-95 duration-200">
                                          <p className="text-[8px] font-black text-amber-500 uppercase tracking-tighter">Extended Information</p>
                                          {emailSettings.seeMoreFields.includes('countries') && (
                                            <div className="flex justify-between items-center">
                                              <span className="text-[8px] text-slate-400 font-bold uppercase">GEO</span>
                                              <span className="text-[9px] text-slate-600 font-medium">{o.countries?.slice(0, 2).join(', ') || 'Global'}</span>
                                            </div>
                                          )}
                                          {emailSettings.seeMoreFields.includes('offer_id') && (
                                            <div className="flex justify-between items-center">
                                              <span className="text-[8px] text-slate-400 font-bold uppercase">ID</span>
                                              <span className="text-[9px] font-mono text-slate-600">{getOfferId(o)}</span>
                                            </div>
                                          )}
                                          {emailSettings.seeMoreFields.includes('preview_url_2') && (
                                            <p className="text-[9px] text-violet-500 font-bold truncate underline">{(o as any).preview_url_2 || 'https://ml.link/v2'}</p>
                                          )}
                                          {emailSettings.seeMoreFields.includes('clicks') && (
                                            <div className="flex justify-between items-center">
                                              <span className="text-[8px] text-slate-400 font-bold uppercase">Clicks</span>
                                              <span className="text-[9px] text-slate-600 font-medium">{(o as any).clicks || o.hits || 0}</span>
                                            </div>
                                          )}
                                          {emailSettings.seeMoreFields.includes('payment_terms') && (
                                            <div className="flex justify-between items-center">
                                              <span className="text-[8px] text-slate-400 font-bold uppercase">Terms</span>
                                              <span className="text-[9px] font-black text-blue-600 uppercase">{emailSettings.paymentTerms || 'Standard'}</span>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <Separator className="bg-slate-100" />

                        {/* Footer */}
                        <div className="text-center space-y-2">
                          <p className="text-[10px] text-slate-400 font-medium italic">Sent via Moustache Leads Automation</p>
                          <div className="flex justify-center gap-4 text-[10px] font-bold text-indigo-600">
                            <span>Privacy Policy</span>
                            <span>Unsubscribe</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-6 flex justify-center">
                      <Button variant="outline" size="sm" onClick={() => setPreviewMode(false)} className="gap-2 font-bold text-slate-600">
                        <Edit3 size={14} /> Back to Editor
                      </Button>
                    </div>
                  </div>
                )}

                {activeItems.length > 0 && mainItem?.queue_status !== 'completed' && (
                  <DialogFooter className="mt-8 border-t pt-6 flex items-center justify-between sm:justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Selection Summary</span>
                      <span className="text-xs font-bold text-indigo-600">{selected.size} targeted offer{selected.size !== 1 ? 's' : ''} selected for {activeItems.length} user(s)</span>
                    </div>
                    <div className="flex flex-col gap-1 flex-1 max-w-[150px]">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1">
                        <CalendarClock size={10} /> Schedule
                      </span>
                      <input
                        type="datetime-local"
                        value={scheduledAt ? new Date(new Date(scheduledAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                        onChange={e => {
                          const val = e.target.value;
                          if (!val) {
                            setScheduledAt('');
                          } else {
                            setScheduledAt(new Date(val).toISOString());
                          }
                        }}
                        className="h-9 px-2 text-[11px] font-bold border border-slate-200 rounded-lg bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none w-full"
                      />
                    </div>
                    <div className="flex flex-col gap-1 flex-1 max-w-[120px]">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1">
                        <Zap size={10} /> Interval
                      </span>
                      <Input 
                        value={automationInterval}
                        onChange={e => setAutomationInterval(e.target.value)}
                        placeholder="3h 20m"
                        className="h-9 px-2 text-[11px] font-bold border-slate-200 rounded-lg bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none w-full"
                      />
                    </div>
                    <div className="flex gap-3 items-end">
                      <Button variant="outline" onClick={onClose} className="h-10 px-6 rounded-xl font-bold border-slate-200 text-slate-600">Cancel</Button>
                      <Button 
                        variant="outline" 
                        onClick={handleSaveToQueue} 
                        disabled={savingToQueue || sending || !messageBody.trim()} 
                        className="h-10 px-6 rounded-xl font-bold border-emerald-200 text-emerald-600 hover:bg-emerald-50 gap-2"
                        title="Save this subject/message to the queue for these users"
                      >
                        {savingToQueue ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {isBulk ? 'Save for All' : 'Save for this User'}
                      </Button>
                      {!isBulk && (
                        <Button 
                          variant="outline" 
                          onClick={handleSaveAsTemplate} 
                          disabled={sending || !messageBody.trim()} 
                          className="h-10 px-6 rounded-xl font-bold border-indigo-200 text-indigo-600 hover:bg-indigo-50 gap-2"
                        >
                          <Plus className="w-4 h-4" /> Save as Template
                        </Button>
                      )}
                      <Button 
                        onClick={handleSend} 
                        disabled={sending || selected.size === 0} 
                        className={`h-10 px-8 rounded-xl font-bold transition-all gap-2 ${!previewMode ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200'}`}
                      >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : (previewMode ? (!scheduledAt ? <Zap className="w-4 h-4" /> : <CalendarClock className="w-4 h-4" />) : <Eye className="w-4 h-4" />)}
                        {previewMode ? (!scheduledAt ? 'Initiate Outreach' : 'Confirm Schedule') : 'Review & Send Now'}
                      </Button>
                    </div>
                  </DialogFooter>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
