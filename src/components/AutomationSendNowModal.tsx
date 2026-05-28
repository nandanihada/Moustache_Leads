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
import { loginLogsService } from '@/services/loginLogsService';
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

// Session-level memory cache for sub-millisecond instant modal/recipient loading
const globalOffersCache: Record<string, { offers: any[], selected: Set<string> }> = {};

export default function AutomationSendNowModal({ open, onClose, queueItem, queueItems = [], onSent, apiUrl, startInPreview = false }: AutomationSendNowModalProps) {
  const isBulk = queueItems.length > 1;
  const activeItems = isBulk ? queueItems : (queueItem ? [queueItem] : []);
  const mainItem = activeItems[0];

  const [offers, setOffers] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sendVia, setSendVia] = useState<'email'>('email');
  const [sendMode, setSendMode] = useState<'all_in_one' | 'one_by_one'>('all_in_one');
  const [globalStepInterval, setGlobalStepInterval] = useState<number>(180); // From automation settings
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
  const [personalOverrides, setPersonalOverrides] = useState<Record<string, { subject: string, body: string }>>({});
  const [previewIdx, setPreviewIdx] = useState(0);
  const [automationInterval, setAutomationInterval] = useState('3h 20m');
  const { toast } = useToast();
  const token = localStorage.getItem('token');

  // Fetch global automation settings to get step_interval_minutes
  useEffect(() => {
    if (!open) return;
    fetch(`${apiUrl}/api/admin/automation/settings`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(r => r.json()).then(d => {
      if (d.settings?.step_interval_minutes) {
        setGlobalStepInterval(d.settings.step_interval_minutes);
      }
    }).catch(() => {});
  }, [open, apiUrl, token]);

  useEffect(() => {
    if (open) {
      setPreviewMode(startInPreview);
    }
  }, [open, startInPreview]);

  const getOfferId = (o: any) => o?.offer_id || o?._id || o?.id;

  const [isLoadingMatched, setIsLoadingMatched] = useState(false);

  useEffect(() => {
    let active = true;
    const loadUserOffers = async () => {
      const currentUser = activeItems[previewIdx];
      if (!currentUser || !open) return;

      const userId = currentUser.user_id || currentUser.userId || currentUser._id;
      if (!userId) return;

      // Check session cache for instant instant loading!
      if (globalOffersCache[userId]) {
        setOffers(globalOffersCache[userId].offers);
        setSelected(globalOffersCache[userId].selected);
        return;
      }

      setOffers([]);
      setSelected(new Set());
      setIsLoadingMatched(true);
      try {
        const token = localStorage.getItem('token');
        const [intelRes, autoRes, viewsRes] = await Promise.all([
          loginLogsService.getInventoryMatchedOffers(userId).catch(() => ({})),
          fetch(`${apiUrl}/api/admin/automation/queue/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }).then(r => r.json()).catch(() => ({ item: null })),
          loginLogsService.getOfferViews(userId).catch(() => ({ logs: [] }))
        ]);

        if (!active) return;

        // Process verticals for booster score
        let currentSessionVerticals = null;
        if (viewsRes?.logs && viewsRes.logs.length > 0) {
          const verticalCounts: Record<string, number> = {};
          viewsRes.logs.forEach((log: any) => {
            const vertical = (log.vertical || 'Unknown').toLowerCase();
            verticalCounts[vertical] = (verticalCounts[vertical] || 0) + 1;
          });
          const sessionVerts = Object.keys(verticalCounts).map(name => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            value: verticalCounts[name]
          })).sort((a, b) => b.value - a.value);
          if (sessionVerts.length > 0) {
            currentSessionVerticals = sessionVerts.slice(0, 5);
          }
        }

        const verticalData = currentSessionVerticals || (currentUser.verticals?.length > 0 ? currentUser.verticals.map((v: string) => ({ name: v, value: 100 })) : [{ name: 'Unknown', value: 100 }]);
        const topCats = new Set(verticalData.slice(0, 2).map((v: any) => (v.name || '').toLowerCase()));
        const allKnownCats = new Set(verticalData.map((v: any) => (v.name || '').toLowerCase()));

        const categoryOffers: Record<string, any[]> = {
          queue: [],
          recommended_offers: [],
          most_approved: [],
          highly_clicked: [],
          requested_offers: [],
          newly_added: []
        };

        const queueItems = autoRes.item?.next_offers || currentUser.next_offers || [];
        if (Array.isArray(queueItems)) {
          queueItems.forEach((o: any) => {
            const id = o.offer_id || o._id || o.id;
            if (id) {
              categoryOffers.queue.push({
                ...o,
                id: id,
                offer_id: id,
                source: 'Automation Queue',
                matchScore: 100,
                categoryKey: 'queue'
              });
            }
          });
        }

        const addSection = (sectionName: string, sourceLabel: string, baseScore: number) => {
          if (intelRes[sectionName] && Array.isArray(intelRes[sectionName])) {
            for (let idx = 0; idx < intelRes[sectionName].length; idx++) {
              const o = intelRes[sectionName][idx];
              const id = o.offer_id || o._id || o.id;
              if (id) {
                let matchScore = Math.max(50, baseScore - (idx * 4));
                if (allKnownCats.size > 0) {
                  const offerCat = (o.category || o.vertical || '').toLowerCase();
                  if (offerCat && topCats.has(offerCat)) {
                    matchScore = Math.min(99, matchScore + 15);
                  } else if (offerCat && allKnownCats.has(offerCat)) {
                    matchScore = Math.min(99, matchScore + 5);
                  }
                }
                categoryOffers[sectionName].push({
                  ...o,
                  id: id,
                  offer_id: id,
                  source: sourceLabel,
                  matchScore: matchScore,
                  categoryKey: sectionName
                });
              }
            }
          }
        };

        addSection('recommended_offers', 'Recommended', 99);
        addSection('most_approved', 'Most Approved', 98);
        addSection('highly_clicked', 'Most Clicked', 87);
        addSection('requested_offers', 'Requested', 85);
        addSection('newly_added', 'Newly Added', 91);

        // Prioritize showing strictly the user's active offer queue
        let finalOffers: any[] = [];
        if (categoryOffers.queue && categoryOffers.queue.length > 0) {
          finalOffers = [...categoryOffers.queue];
        } else {
          // Fallback if the user has no queue offers yet
          const seenIds = new Set();
          const orderOfCategories = ['recommended_offers', 'most_approved', 'highly_clicked', 'requested_offers', 'newly_added'];
          
          orderOfCategories.forEach((catKey) => {
            const list = categoryOffers[catKey];
            const unusedOffer = list.find(o => !seenIds.has(o.id));
            if (unusedOffer) {
              seenIds.add(unusedOffer.id);
              finalOffers.push(unusedOffer);
            }
          });

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
        }

        setOffers(finalOffers);

        // Auto-select all matched offers by default
        const allMatchedIds = finalOffers.map(o => getOfferId(o)).filter(Boolean);
        const selSet = new Set(allMatchedIds as string[]);
        setSelected(selSet);

        // Store in global session cache for instant instant loading next time!
        globalOffersCache[userId] = { offers: finalOffers, selected: selSet };

      } catch (err) {
        console.error("Failed to dynamically load offers in Automation modal", err);
      } finally {
        setIsLoadingMatched(false);
      }
    };

    loadUserOffers();
    return () => {
      active = false;
    };
  }, [open, previewIdx, mainItem?.user_id]);

  // Initialize personal overrides for all selected users
  useEffect(() => {
    if (!open || activeItems.length === 0) return;

    setPersonalOverrides(prev => {
      const next: Record<string, { subject: string, body: string }> = {};
      activeItems.forEach(item => {
        const name = item.username || 'Publisher';
        let note = customMsg || item.custom_message || 'We have found some great offers that match what you are looking for. Check out the offers below and log in to your publisher dashboard to get started.';

        // Prevent double greeting if the note already starts with "Hi" or "Hello"
        const hasGreeting = note.trim().toLowerCase().startsWith('hi') || note.trim().toLowerCase().startsWith('hello');
        const finalBody = hasGreeting ? note : `Hi ${name},\n\n${note}\n\nBest regards,\nPublisher Support Team\nMoustache Leads`;

        // If admin has already customized this user's message, keep it; otherwise initialize fresh
        if (prev[item.user_id] && prev[item.user_id].body && prev[item.user_id].body !== '') {
          next[item.user_id] = prev[item.user_id];
        } else {
          next[item.user_id] = {
            subject: item.custom_subject || 'Recommended Offers',
            body: finalBody
          };
        }
      });
      return next;
    });
  }, [open, activeItems.length, customMsg]);

  // Reset index ONLY when the modal opens
  useEffect(() => {
    if (open) {
      setPreviewIdx(0);
      setPersonalOverrides({}); // Reset overrides for fresh initialization

      // If we have no offers, try to fetch some relevant ones automatically
      if (offers.length === 0 && (mainItem?.country || mainItem?.user_id)) {
        const fetchRelevant = async () => {
          try {
            const res = await adminOfferApi.getOffers({
              country: mainItem.country || '',
              status: 'active',
              per_page: 10
            });
            if (res.offers && res.offers.length > 0) {
              setOffers(res.offers);
              setSelected(new Set([getOfferId(res.offers[0])]));
            }
          } catch (e) {
            console.error('Failed to auto-fetch offers', e);
          }
        };
        fetchRelevant();
      }
    }
  }, [open, mainItem?.user_id]);

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
      // Resolve offer_ids: prefer offer_id field, fallback to _id/id
      const resolvedOfferIds = Array.from(selected).map(id => {
        const offer = offers.find(o => getOfferId(o) === id);
        // Prefer the offer_id field (string ID used in the offers collection)
        return offer?.offer_id || id;
      });

      const promises = activeItems.map(item => {
        const personal = personalOverrides[item.user_id] || { subject: emailSubject, body: messageBody };
        const userName = item.username || 'Publisher';
        
        // CRITICAL FIX: If the body still contains another user's greeting (from shared state),
        // replace it with the correct user's name. Also handle {{username}} placeholders.
        let finalBody = personal.body;
        
        // If the body has no personalization at all or uses a generic greeting, inject the correct name
        if (!finalBody || !finalBody.trim()) {
          finalBody = `Hi ${userName},\n\nWe have found some great offers that match what you are looking for. Check out the offers below and log in to your publisher dashboard to get started.\n\nBest regards,\nPublisher Support Team\nMoustache Leads`;
        }
        
        // Replace placeholders
        finalBody = finalBody.replace(/{{username}}/g, userName).replace(/{{name}}/g, userName);
        
        // If the body starts with "Hi <someone_else>," and this is a bulk send where the admin
        // didn't individually customize each user, replace the greeting with the correct name
        const greetingMatch = finalBody.match(/^(Hi|Hello|Hey)\s+([^,\n]+),/i);
        if (greetingMatch && isBulk) {
          const greetedName = greetingMatch[2].trim().toLowerCase();
          const currentName = userName.toLowerCase();
          // Only replace if the greeting name doesn't match this user AND the admin hasn't explicitly customized this user's message
          if (greetedName !== currentName && !personalOverrides[item.user_id]?.body) {
            finalBody = finalBody.replace(/^(Hi|Hello|Hey)\s+[^,\n]+,/i, `${greetingMatch[1]} ${userName},`);
          }
        }
        
        let finalSubject = personal.subject.replace(/{{username}}/g, userName).replace(/{{name}}/g, userName);

        return fetch(`${apiUrl}/api/admin/automation/send-now`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            user_id: item.user_id,
            offer_ids: resolvedOfferIds,
            send_via: sendVia,
            send_mode: sendMode,
            custom_message: customMsg,
            subject: finalSubject,
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
      const successCount = results.filter(r => r.ok).length;
      const failCount = results.filter(r => !r.ok).length;

      if (successCount === 0) {
        // Try to get error message from first failed response
        const firstFailed = results.find(r => !r.ok);
        let errorMsg = 'Failed to send outreach';
        if (firstFailed) {
          try {
            const errData = await firstFailed.json();
            errorMsg = errData.error || errorMsg;
          } catch {}
        }
        throw new Error(errorMsg);
      }

      const desc = failCount > 0 
        ? `Sent to ${successCount} user(s). ${failCount} skipped (already had pending/active emails).`
        : `Successfully dispatched outreach to ${successCount} user(s).`;
      
      toast({ title: 'Success', description: desc });
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
      <DialogContent className="max-w-[95vw] w-full max-h-[95vh] h-[95vh] overflow-y-auto bg-white shadow-2xl border-none">
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
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Offer Queue</Label>
                      </div>

                      <div className="space-y-2 max-h-64 overflow-y-auto border rounded-xl p-3 bg-slate-50/50 custom-scrollbar">
                        {isLoadingMatched ? (
                          <div className="flex flex-col items-center justify-center py-10 text-center">
                            <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mb-2" />
                            <p className="text-xs text-muted-foreground">Analyzing user activity and matching offers...</p>
                          </div>
                        ) : offers.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                            <p className="text-sm text-muted-foreground italic">No matching offers found for this user's profile.</p>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {offers.map((o, idx) => {
                              const oId = getOfferId(o) || `idx-${idx}`;
                              const isSelected = selected.has(oId);
                              
                              const getStyles = (k: string) => {
                                switch (k) {
                                  case 'queue': return { label: 'Active Queue', color: '#7F2FBE', icon: '⚡' };
                                  case 'recommended_offers': return { label: 'Recommended', color: '#534AB7', icon: '🛍️' };
                                  case 'most_approved': return { label: 'Most Approved', color: '#1D9E75', icon: '✅' };
                                  case 'highly_clicked': return { label: 'Most Clicked', color: '#BA7517', icon: '🔥' };
                                  case 'requested_offers': return { label: 'Requested', color: '#A32D2D', icon: '🙋' };
                                  case 'newly_added': return { label: 'Newly Added', color: '#185FA5', icon: '🆕' };
                                  default: return { label: 'Recommended', color: '#64748B', icon: '🎯' };
                                }
                              };
                              const catKey = o.categoryKey || 'recommended_offers';
                              const styles = getStyles(catKey);

                              const category = (o.category || 'General').toUpperCase();
                              const country = o.countries?.[0] || 'WW';
                              const type = o.type || 'Cashback';
                              const source = styles.label;

                              return (
                                <div
                                  key={`offer-row-${oId}`}
                                  className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${isSelected ? 'bg-white border-indigo-200 shadow-sm' : 'border-transparent hover:bg-white/50 bg-white/20'}`}
                                  onClick={() => toggle(oId)}
                                >
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggle(oId)}
                                    className="rounded-md border-slate-300"
                                  />
                                  <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center p-1 border border-slate-200 flex-shrink-0">
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
                                      <Badge variant="outline" className="text-[8px] h-3.5 px-1 bg-slate-50 border-slate-200 text-slate-500 uppercase">{country}</Badge>
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
                                      <span className="text-[9px] text-slate-400 font-medium truncate flex-1 select-none">
                                        {category} · {type} · {source}
                                      </span>
                                      <span className="text-[9px] text-slate-400 font-bold ml-auto" style={{ color: styles.color }}>{o.matchScore}% match</span>
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
                        )}
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

                    {/* Send Mode */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Send Mode</Label>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={sendMode === 'all_in_one' ? 'default' : 'outline'}
                          onClick={() => setSendMode('all_in_one')}
                          className={`flex-1 text-xs font-bold h-9 rounded-lg transition-all ${sendMode === 'all_in_one' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-md text-white' : 'border-slate-200 text-slate-600'}`}
                        >
                          All Offers in One Email
                        </Button>
                        <Button
                          size="sm"
                          variant={sendMode === 'one_by_one' ? 'default' : 'outline'}
                          onClick={() => setSendMode('one_by_one')}
                          className={`flex-1 text-xs font-bold h-9 rounded-lg transition-all ${sendMode === 'one_by_one' ? 'bg-amber-600 hover:bg-amber-700 shadow-md text-white' : 'border-slate-200 text-slate-600'}`}
                        >
                          One by One (with Delay)
                        </Button>
                      </div>
                      {sendMode === 'one_by_one' && (
                        <div className="flex items-center gap-2 mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                          <span className="text-[10px] font-bold text-amber-700">
                            Interval: <span className="text-amber-900 font-black">{globalStepInterval} min</span> (from Automation Engine Settings)
                          </span>
                          <span className="text-[10px] text-amber-600">— Each offer sent as a separate email with this delay</span>
                        </div>
                      )}
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
                          {(() => {
                            const currentUser = activeItems[previewIdx];
                            const userName = currentUser?.username || 'Publisher';
                            const body = personalOverrides[currentUser?.user_id]?.body || messageBody || `Hi ${userName},\n\nWe have found some great offers that match what you are looking for. Check out the offers below and log in to your publisher dashboard to get started.\n\nBest regards,\nPublisher Support Team\nMoustache Leads`;
                            return body.replace(/{{username}}/g, userName).replace(/{{name}}/g, userName);
                          })()}
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
                                    {emailSettings.visibleFields.includes('name') && <th className="p-3 font-bold text-slate-500 uppercase tracking-tighter">Offer</th>}
                                    {emailSettings.visibleFields.includes('payout') && <th className="p-3 font-bold text-slate-500 uppercase tracking-tighter">Payout</th>}
                                    {emailSettings.visibleFields.includes('countries') && <th className="p-3 font-bold text-slate-500 uppercase tracking-tighter">GEO</th>}
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
                                            <td colSpan={5} className="p-4 pt-2">
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
