import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, Calendar, Send, MessageSquare, Plus, X, Search, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { API_BASE_URL } from '@/services/apiConfig';
import { adminOfferApi } from '@/services/adminOfferApi';
import EmailSettingsPanel, { DEFAULT_EMAIL_SETTINGS, type EmailSettings } from '@/components/EmailSettingsPanel';

interface OfferDetail {
  offer_id: string;
  name: string;
  payout: number;
  network: string;
  description?: string;
  traffic_source?: string;
  preview_link?: string;
  category?: string;
}

interface PubEntry { user_id: string; username: string; email: string; }

interface SendScheduleModalProps {
  open: boolean;
  onClose: () => void;
  offerIds: string[];
  defaultMode: 'schedule' | 'send_now';
  sourceTab: string;
  onSuccess?: () => void;
}

export default function SendScheduleModal({ open, onClose, offerIds, defaultMode, sourceTab, onSuccess }: SendScheduleModalProps) {
  const [mode, setMode] = useState<'schedule' | 'send_now' | 'support'>(defaultMode);
  const [subject, setSubject] = useState('ðŸš€ Hot Offers You Should Check Out!');
  const [messageBody, setMessageBody] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [sendFrequency, setSendFrequency] = useState<'single' | 'multiple'>(offerIds.length === 1 ? 'single' : 'multiple');
  const [customEmails, setCustomEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [sending, setSending] = useState(false);
  const [emailSettings, setEmailSettings] = useState<EmailSettings>(DEFAULT_EMAIL_SETTINGS);
  const [offers, setOffers] = useState<OfferDetail[]>([]);
  const token = localStorage.getItem('token');

  // Publisher selector
  const [publishers, setPublishers] = useState<PubEntry[]>([]);
  const [selectedPublishers, setSelectedPublishers] = useState<Set<string>>(new Set());
  const [pubSearch, setPubSearch] = useState('');
  const [loadingPubs, setLoadingPubs] = useState(false);
  const [pubSectionOpen, setPubSectionOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingPubs(true);
    fetch(`${API_BASE_URL}/api/admin/offer-access-requests/publisher-profiles?status=all&per_page=200`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()).then(d => {
      setPublishers((d.profiles || []).map((p: any) => ({ user_id: p.user_id, username: p.username, email: p.email })));
    }).catch(() => {}).finally(() => setLoadingPubs(false));
  }, [open, token]);

  useEffect(() => {
    if (!open || offerIds.length === 0) return;
    setOffers(offerIds.map(id => ({ offer_id: id, name: id, payout: 0, network: '' })));
    const fetchDetails = async () => {
      const details: OfferDetail[] = [];
      for (const id of offerIds) {
        try {
          const res = await adminOfferApi.getOffer(id);
          if (res.offer) {
            const o = res.offer;
            details.push({
              offer_id: o.offer_id, name: o.name, payout: o.payout || 0, network: o.network || '',
              description: o.description || o.short_description || '',
              traffic_source: (o.compliance?.allowed_traffic || []).join(', ') || '',
              preview_link: o.preview_url || '', category: o.category || o.vertical || '',
            });
          } else { details.push({ offer_id: id, name: id, payout: 0, network: '' }); }
        } catch { details.push({ offer_id: id, name: id, payout: 0, network: '' }); }
      }
      if (details.length > 0) setOffers(details);
    };
    fetchDetails();
  }, [open, offerIds, token]);

  // Auto-generate message based on sendFrequency
  useEffect(() => {
    if (offers.length === 0 || offers[0].name === offers[0].offer_id) return;
    setMessageBody([
      'Hi,', '', 'Check out these offers below.', '', 'Best regards,', 'Moustache Leads Team',
    ].join('\n'));
  }, [offers, sendFrequency]);

  const filteredPubs = useMemo(() => {
    if (!pubSearch) return publishers;
    const s = pubSearch.toLowerCase();
    return publishers.filter(p => p.username.toLowerCase().includes(s) || p.email.toLowerCase().includes(s));
  }, [publishers, pubSearch]);

  const addEmail = () => {
    const e = emailInput.trim();
    if (e && e.includes('@') && !customEmails.includes(e)) { setCustomEmails(prev => [...prev, e]); setEmailInput(''); }
  };

  const handleSend = async () => {
    setSending(true);
    try {
      if (mode === 'schedule' && !scheduledAt) { toast.error('Please select a schedule date/time'); setSending(false); return; }
      
      // Auto-add email from input field if user forgot to press Enter/+
      let finalCustomEmails = [...customEmails];
      const pendingEmail = emailInput.trim();
      if (pendingEmail && pendingEmail.includes('@') && !finalCustomEmails.includes(pendingEmail)) {
        finalCustomEmails.push(pendingEmail);
        setCustomEmails(finalCustomEmails);
        setEmailInput('');
      }
      
      const recipientIds = Array.from(selectedPublishers);
      const hasRecipients = recipientIds.length > 0 || finalCustomEmails.length > 0;
      
      // CRITICAL: Never auto-broadcast. Admin must explicitly select recipients.
      if (!hasRecipients) {
        toast.error('Please select publishers or add email addresses first');
        setSending(false);
        return;
      }

      if (mode === 'support') {
        // Support mode: create support messages via push-mail endpoint with recipient_ids
        const res = await fetch(`${API_BASE_URL}/api/admin/offer-access-requests/push-mail`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            offer_ids: offerIds, send_type: 'support',
            source_tab: sourceTab, message_template: { subject, body: messageBody },
            recipient_ids: recipientIds,
            template_style: emailSettings.templateStyle,
            visible_fields: emailSettings.visibleFields,
            see_more_fields: emailSettings.seeMoreFields,
            default_image: emailSettings.defaultImage,
            payout_type: emailSettings.payoutType,
            mask_preview_links: emailSettings.maskPreviewLinks,
            payment_terms: emailSettings.paymentTerms,
            custom_preview_url: emailSettings.customPreviewMode === 'all' ? emailSettings.customPreviewUrl : '',
            custom_preview_urls: emailSettings.customPreviewMode === 'individual' ? emailSettings.customPreviewUrls : {},
            preview_in_email: emailSettings.previewInEmail,
            custom_preview_in_email: emailSettings.customPreviewInEmail,
          }),
        });
        const d = await res.json(); if (!res.ok) throw new Error(d.error);
        toast.success(`Support message sent to ${d.sent_count} users`);
      } else {
        // Email / Schedule mode: use schedule-send endpoint with explicit recipients
        const res = await fetch(`${API_BASE_URL}/api/admin/offer-access-requests/schedule-send`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            offer_ids: offerIds, recipient_ids: recipientIds, custom_emails: finalCustomEmails,
            scheduled_at: scheduledAt || undefined, send_type: mode,
            send_frequency: sendFrequency, message_body: messageBody, subject, source_tab: sourceTab,
            template_style: emailSettings.templateStyle,
            visible_fields: emailSettings.visibleFields,
            see_more_fields: emailSettings.seeMoreFields,
            default_image: emailSettings.defaultImage,
            payout_type: emailSettings.payoutType,
            mask_preview_links: emailSettings.maskPreviewLinks,
            payment_terms: emailSettings.paymentTerms,
            custom_preview_url: emailSettings.customPreviewMode === 'all' ? emailSettings.customPreviewUrl : '',
            custom_preview_urls: emailSettings.customPreviewMode === 'individual' ? emailSettings.customPreviewUrls : {},
            preview_in_email: emailSettings.previewInEmail,
            custom_preview_in_email: emailSettings.customPreviewInEmail,
          }),
        });
        const d = await res.json(); if (!res.ok) throw new Error(d.error);
        toast.success(d.scheduled_id ? 'Scheduled successfully' : `Sent to ${d.sent_count} recipients`);
      }
      onSuccess?.(); onClose();
    } catch (e: any) { toast.error(e.message || 'Failed to send'); }
    finally { setSending(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Send / Schedule Offers
            <Badge variant="secondary" className="text-xs">{offerIds.length} offer{offerIds.length !== 1 ? 's' : ''}</Badge>
          </DialogTitle>
        </DialogHeader>
        <Tabs value={mode} onValueChange={v => setMode(v as any)}>
          <TabsList className="w-full">
            <TabsTrigger value="schedule" className="flex-1 gap-1"><Calendar className="w-3.5 h-3.5" />Schedule</TabsTrigger>
            <TabsTrigger value="send_now" className="flex-1 gap-1"><Send className="w-3.5 h-3.5" />Send Now</TabsTrigger>
            <TabsTrigger value="support" className="flex-1 gap-1"><MessageSquare className="w-3.5 h-3.5" />Support</TabsTrigger>
          </TabsList>
          <TabsContent value="schedule" className="space-y-4 mt-4">
            <div><Label className="text-xs">Schedule Date & Time</Label>
            <Input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className="mt-1" /></div>
          </TabsContent>
          <TabsContent value="send_now" className="mt-4"><p className="text-sm text-muted-foreground">Email will be sent immediately via BCC.</p></TabsContent>
          <TabsContent value="support" className="mt-4"><p className="text-sm text-muted-foreground">Creates a support message + triggers email notification.</p></TabsContent>
        </Tabs>
        <div className="space-y-4 mt-2">
          <div className="flex items-center gap-3">
            <Label className="text-xs">Send type:</Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Single</span>
              <Switch checked={sendFrequency === 'multiple'} onCheckedChange={v => setSendFrequency(v ? 'multiple' : 'single')} />
              <span className="text-xs text-muted-foreground">Multiple</span>
            </div>
          </div>

          {/* Select Publishers */}
          <div className="border rounded-lg">
            <button type="button" className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-muted/50 transition-colors" onClick={() => setPubSectionOpen(v => !v)}>
              <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />Select Publishers{selectedPublishers.size > 0 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{selectedPublishers.size} selected</Badge>}</span>
              {pubSectionOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {pubSectionOpen && (
              <div className="border-t px-3 py-2 space-y-2">
                <div className="relative"><Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input value={pubSearch} onChange={e => setPubSearch(e.target.value)} placeholder="Search by username or email..." className="pl-7 h-8 text-xs" /></div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => setSelectedPublishers(new Set(publishers.map(p => p.user_id)))}>Select All</Button>
                  <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => setSelectedPublishers(new Set())}>Deselect All</Button>
                </div>
                {loadingPubs ? <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin" /></div> : (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {filteredPubs.map(p => (
                      <label key={p.user_id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 cursor-pointer text-xs">
                        <Checkbox checked={selectedPublishers.has(p.user_id)} onCheckedChange={() => setSelectedPublishers(prev => { const n = new Set(prev); n.has(p.user_id) ? n.delete(p.user_id) : n.add(p.user_id); return n; })} />
                        <span className="font-medium">{p.username}</span><span className="text-muted-foreground truncate">{p.email}</span>
                      </label>
                    ))}
                    {filteredPubs.length === 0 && <p className="text-xs text-muted-foreground py-2 text-center">No publishers found</p>}
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Custom emails */}
          <div>
            <Label className="text-xs">Additional Emails (optional)</Label>
            <div className="flex gap-2 mt-1">
              <Input value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder="email@example.com" className="text-sm h-9" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEmail(); } }} />
              <Button size="sm" variant="outline" onClick={addEmail} className="h-9 shrink-0"><Plus className="w-3.5 h-3.5" /></Button>
            </div>
            {customEmails.length > 0 && <div className="flex flex-wrap gap-1.5 mt-2">{customEmails.map(e => (<Badge key={e} variant="outline" className="text-xs gap-1">{e}<button onClick={() => setCustomEmails(prev => prev.filter(x => x !== e))} className="hover:text-destructive"><X className="w-3 h-3" /></button></Badge>))}</div>}
          </div>
          <div><Label className="text-xs">Subject</Label><Input value={subject} onChange={e => setSubject(e.target.value)} className="mt-1" /></div>
          <EmailSettingsPanel settings={emailSettings} onChange={setEmailSettings} compact offerIds={offerIds} />
          <div><Label className="text-xs">Message Preview</Label><Textarea value={messageBody} onChange={e => setMessageBody(e.target.value)} rows={10} className="mt-1 text-sm font-mono resize-y" /></div>
        </div>
        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <span className="text-xs text-muted-foreground">{offerIds.length} offer{offerIds.length !== 1 ? 's' : ''}{selectedPublishers.size > 0 && ` Â· ${selectedPublishers.size} publisher${selectedPublishers.size !== 1 ? 's' : ''}`}</span>
          <Button onClick={handleSend} disabled={sending} className="gap-1.5">
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : mode === 'schedule' ? <Calendar className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
            {mode === 'schedule' ? 'Schedule' : mode === 'support' ? 'Send Support' : 'Send Now'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
