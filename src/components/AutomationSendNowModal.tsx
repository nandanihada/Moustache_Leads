import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button'; // hmr-trigger-3
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Send, AlertTriangle, Zap, Search, Globe, Filter, Eye, Edit3, Plus, CalendarClock } from 'lucide-react';
import EmailSettingsPanel, { DEFAULT_EMAIL_SETTINGS, type EmailSettings } from '@/components/EmailSettingsPanel';
import OfferActionIcons from '@/components/OfferActionIcons';
import { adminOfferApi } from '@/services/adminOfferApi';
import { Separator } from '@/components/ui/separator';

interface AutomationSendNowModalProps {
  open: boolean;
  onClose: () => void;
  queueItem: any; // AutomationQueueItem
  onSent?: () => void;
  apiUrl: string;
  startInPreview?: boolean;
}

export default function AutomationSendNowModal({ open, onClose, queueItem, onSent, apiUrl, startInPreview = false }: AutomationSendNowModalProps) {
  const [offers, setOffers] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sendVia, setSendVia] = useState<'email'>('email');
  const [customMsg, setCustomMsg] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [sending, setSending] = useState(false);
  const [emailSettings, setEmailSettings] = useState<EmailSettings>(DEFAULT_EMAIL_SETTINGS);
  const [expandedOffers, setExpandedOffers] = useState<Set<string>>(new Set());
  const [offerSearch, setOfferSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchCountry, setSearchCountry] = useState(queueItem?.country || '');
  const [previewMode, setPreviewMode] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string>(''); // ISO String
  const [payoutOverrides, setPayoutOverrides] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (open) {
      setPreviewMode(startInPreview);
    }
  }, [open, startInPreview]);

  const getOfferId = (o: any) => o?.offer_id || o?._id || o?.id;

  useEffect(() => {
    if (!open || !queueItem) return;
    if (queueItem.next_offers && queueItem.next_offers.length > 0) {
      setOffers(queueItem.next_offers);
      // Automatically select the first (Primary) offer
      const firstId = getOfferId(queueItem.next_offers[0]);
      if (firstId) setSelected(new Set([firstId]));
    }
  }, [open, queueItem]);

  const toggle = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  useEffect(() => {
    if (!queueItem) return;
    const name = queueItem.username || 'Publisher';
    const note = customMsg || 'We have found some great offers that match what you are looking for. Check out the offers below and log in to your publisher dashboard to get started.';
    setMessageBody('Hi ' + name + ',\n\n' + note + '\n\nBest regards,\nPublisher Support Team\nMoustache Leads');
  }, [queueItem, customMsg]);

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

  const handleSend = async () => {
    if (!queueItem || selected.size === 0) return;
    setSending(true);
    try {
      const res = await fetch(`${apiUrl}/api/admin/automation/send-now`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          user_id: queueItem.user_id, 
          offer_ids: Array.from(selected), 
          send_via: sendVia, 
          custom_message: customMsg, 
          message_body: messageBody, 
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
          payout_overrides: payoutOverrides
        }),
      });
      if (!res.ok) throw new Error();
      toast({ title: 'Success', description: `Sent ${selected.size} offer(s) via ${sendVia} and advanced the automation cycle.` });
      if (onSent) onSent();
      onClose();
    } catch (e) { 
      toast({ title: 'Error', description: 'Failed to send offers', variant: 'destructive' }); 
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
                <Zap className="text-indigo-600 w-5 h-5 fill-indigo-600" />
            </div>
            <span>Send Offers (Manual Override)</span>
            {queueItem && <Badge variant="secondary" className="bg-slate-100 text-slate-700 ml-2">{queueItem.username}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 space-y-6">
          <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200">
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
                  {offers.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                      <p className="text-sm text-muted-foreground italic mb-2">No matching offers found for this user's profile.</p>
                      <p className="text-[10px] text-slate-400">Use the search bar above to manually find and add offers to this outreach.</p>
                    </div>
                  )}
                  {offers.map((o, idx) => {
                    const oId = getOfferId(o) || `idx-${idx}`;
                    const isSelected = selected.has(oId);
                    return (
                      <div 
                        key={`offer-row-${oId}`} 
                        className={`flex items-center gap-3 p-3 rounded-xl transition-all border cursor-pointer ${isSelected ? 'bg-white border-indigo-200 shadow-sm' : 'border-transparent hover:bg-white/50'}`}
                        onClick={() => toggle(oId)}
                      >
                        <Checkbox 
                          checked={isSelected} 
                          onCheckedChange={() => toggle(oId)} 
                          className="rounded-md border-slate-300" 
                        />
                        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center p-1 border border-slate-200">
                          <img src={o.image_url || o.thumbnail_url || emailSettings.defaultImage || 'https://via.placeholder.com/32'} className="max-w-full max-h-full object-contain" alt="" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-[11px] font-bold text-slate-700 truncate">{o.name || o.offer_name}</h4>
                            <Badge variant="outline" className="text-[8px] h-3.5 px-1 bg-slate-50 border-slate-200 text-slate-500 uppercase">{o.countries?.[0] || 'WW'}</Badge>
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

              {/* Message Body */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Message Content (Editable)</Label>
                <Textarea value={messageBody} onChange={e => setMessageBody(e.target.value)}
                  rows={6} className="text-sm font-medium border-slate-200 focus:ring-indigo-500 focus:border-indigo-500 rounded-xl bg-slate-50/30" />
                <p className="text-[10px] text-slate-400 italic font-medium">Offers will be automatically appended in a structured table/card based on the settings below.</p>
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
                <div className="bg-indigo-600 p-6 text-white flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-bold">Recommended Offers</h2>
                    <p className="text-indigo-100 text-xs mt-1">Curated specifically for your profile</p>
                  </div>
                  <div className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20">
                    {emailSettings.templateStyle} View
                  </div>
                </div>
                
                <div className="p-8 space-y-6">
                  {/* Message Body */}
                  <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                    {messageBody}
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
                                          <img src={o.image_url || o.thumbnail_url || emailSettings.defaultImage || 'https://via.placeholder.com/40'} className="w-full h-full object-contain" alt="" />
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
                                  <img src={o.image_url || o.thumbnail_url || emailSettings.defaultImage || 'https://via.placeholder.com/80'} className="max-w-full max-h-full object-contain" alt="" />
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
                                        <span className="text-[9px] text-slate-600 font-medium">{o.countries?.slice(0,2).join(', ') || 'Global'}</span>
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
          </div>
        </div>

        <DialogFooter className="mt-8 border-t pt-6 flex items-center justify-between sm:justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Selection Summary</span>
            <span className="text-xs font-bold text-indigo-600">{selected.size} targeted offer{selected.size !== 1 ? 's' : ''} selected</span>
          </div>
          <div className="flex flex-col gap-1 flex-1 max-w-[200px]">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1">
               <CalendarClock size={10} /> Schedule Outreach
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
              className="h-9 px-3 text-[11px] font-bold border border-slate-200 rounded-lg bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none w-full"
            />
          </div>
          <div className="flex gap-3 items-end">
              <Button variant="outline" onClick={onClose} className="h-10 px-6 rounded-lg font-bold border-slate-200 text-slate-600">Cancel</Button>
              <Button onClick={handleSend} disabled={sending || selected.size === 0} className="h-10 px-8 rounded-lg font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 gap-2">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : (!scheduledAt ? <Send className="w-4 h-4" /> : <CalendarClock className="w-4 h-4" />)}
                {!scheduledAt ? 'Send Now' : 'Schedule for Selected Time'}
              </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
