/**
 * MailOfferScheduleModal — Send existing offer schedule via email
 * Features:
 * - Shows offer details (image, vertical, description, masked link) with red tags for missing data
 * - Editable content using OfferActionIcons (image, description, vertical, link masker)
 * - Email template settings via EmailSettingsPanel
 * - Publisher selection with include/exclude and search
 * - Custom email addresses
 * - Editable subject and message body
 * - Send now / Schedule modes
 */
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Loader2, Calendar, Send, Plus, X, Search,
  Users, ChevronDown, ChevronUp, AlertTriangle, Mail,
  Image, FileText, Tag, Link2, Eye,
} from 'lucide-react';
import { API_BASE_URL } from '@/services/apiConfig';
import { adminOfferApi, Offer } from '@/services/adminOfferApi';
import EmailSettingsPanel, { DEFAULT_EMAIL_SETTINGS, type EmailSettings } from '@/components/EmailSettingsPanel';
import OfferActionIcons from '@/components/OfferActionIcons';

interface PubEntry {
  user_id: string;
  username: string;
  email: string;
}

interface MailOfferScheduleModalProps {
  open: boolean;
  onClose: () => void;
  offers: Offer[];
  onSuccess?: () => void;
}

export default function MailOfferScheduleModal({ open, onClose, offers, onSuccess }: MailOfferScheduleModalProps) {
  const [sendType, setSendType] = useState<'send_now' | 'schedule'>('send_now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [subject, setSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [customEmails, setCustomEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [emailSettings, setEmailSettings] = useState<EmailSettings>(DEFAULT_EMAIL_SETTINGS);
  const [sending, setSending] = useState(false);

  // Publisher selector
  const [publishers, setPublishers] = useState<PubEntry[]>([]);
  const [selectedPublishers, setSelectedPublishers] = useState<Set<string>>(new Set());
  const [excludedPublishers, setExcludedPublishers] = useState<Set<string>>(new Set());
  const [pubSearch, setPubSearch] = useState('');
  const [loadingPubs, setLoadingPubs] = useState(false);
  const [pubSectionOpen, setPubSectionOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState<'include' | 'exclude'>('include');

  // Offer data refresh tracking
  const [offerData, setOfferData] = useState<Record<string, Offer>>({});

  const token = localStorage.getItem('token');

  // Initialize offer data
  useEffect(() => {
    if (!open || offers.length === 0) return;
    const map: Record<string, Offer> = {};
    offers.forEach(o => { map[o.offer_id] = o; });
    setOfferData(map);

    // Generate default subject
    if (offers.length === 1) {
      setSubject(`🚀 Check Out This Offer: ${offers[0].name}`);
    } else {
      setSubject(`🚀 ${offers.length} Hot Offers You Should Check Out!`);
    }

    // Generate default message
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = days[new Date().getDay()];
    setMessageBody(
      `Happy ${dayName}!\n\nPlease push more traffic on ${offers.length === 1 ? 'this offer' : 'these offers'}. Check out the details below.\n\nThanks and have a great day!\n\nBest regards,\nMoustache Leads Team`
    );
  }, [open, offers]);

  // Fetch publishers
  useEffect(() => {
    if (!open) return;
    setLoadingPubs(true);
    fetch(`${API_BASE_URL}/api/admin/insights/partners`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        setPublishers(
          (d.partners || []).map((p: any) => ({
            user_id: p._id || p.id,
            username: p.username,
            email: p.email,
          }))
        );
      })
      .catch(() => {})
      .finally(() => setLoadingPubs(false));
  }, [open, token]);

  const filteredPubs = useMemo(() => {
    if (!pubSearch) return publishers;
    const s = pubSearch.toLowerCase();
    return publishers.filter(
      p => p.username.toLowerCase().includes(s) || p.email.toLowerCase().includes(s)
    );
  }, [publishers, pubSearch]);

  const addEmail = () => {
    const e = emailInput.trim();
    if (e && e.includes('@') && !customEmails.includes(e)) {
      setCustomEmails(prev => [...prev, e]);
      setEmailInput('');
    }
  };

  const handleOfferUpdated = (offerId: string, field: string, value: string) => {
    setOfferData(prev => {
      const updated = { ...prev };
      if (updated[offerId]) {
        const offer = { ...updated[offerId] };
        if (field === 'image') (offer as any).image_url = value;
        else if (field === 'description') (offer as any).description = value;
        else if (field === 'category') { (offer as any).category = value; (offer as any).vertical = value; }
        else if (field === 'preview_url_2') (offer as any).preview_url_2 = value;
        updated[offerId] = offer;
      }
      return updated;
    });
  };

  // Compute effective recipients
  const effectiveRecipients = useMemo(() => {
    if (selectionMode === 'include') {
      return Array.from(selectedPublishers);
    } else {
      // Exclude mode: all publishers minus excluded
      return publishers
        .filter(p => !excludedPublishers.has(p.user_id))
        .map(p => p.user_id);
    }
  }, [selectionMode, selectedPublishers, excludedPublishers, publishers]);

  const handleSend = async () => {
    if (!subject.trim()) {
      toast.error('Please enter a subject');
      return;
    }

    // Auto-add pending email
    let finalCustomEmails = [...customEmails];
    const pending = emailInput.trim();
    if (pending && pending.includes('@') && !finalCustomEmails.includes(pending)) {
      finalCustomEmails.push(pending);
      setCustomEmails(finalCustomEmails);
      setEmailInput('');
    }

    const recipientIds = effectiveRecipients;
    if (recipientIds.length === 0 && finalCustomEmails.length === 0) {
      toast.error('Please select publishers or add email addresses');
      return;
    }

    if (sendType === 'schedule' && !scheduledAt) {
      toast.error('Please select a schedule date/time');
      return;
    }

    setSending(true);
    try {
      const offerIds = Object.keys(offerData);
      const payload: any = {
        offer_ids: offerIds,
        recipient_ids: recipientIds,
        custom_emails: finalCustomEmails,
        send_mode: 'all_in_one',
        interval_minutes: 0,
        send_type: sendType,
        subject,
        message_body: messageBody,
        source_tab: 'admin_offers',
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
      };

      if (sendType === 'schedule') {
        payload.scheduled_at = scheduledAt;
      }

      const res = await fetch(`${API_BASE_URL}/api/admin/offer-access-requests/push-mail-v2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to send');

      if (d.scheduled) {
        toast.success(`Scheduled ${offerIds.length} offer(s) for email delivery`);
      } else {
        toast.success(`Email sent to ${d.sent_count || 0} recipients`);
      }
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const offerList = Object.values(offerData);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-orange-500" />
            Mail Offer Schedule
            <Badge variant="secondary" className="text-xs">{offerList.length} offer{offerList.length !== 1 ? 's' : ''}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Offer Cards with data status */}
          <div className="border rounded-lg p-3 space-y-2 max-h-60 overflow-y-auto">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Offer Details
            </Label>
            {offerList.map(offer => {
              const hasImage = !!(offer.image_url || offer.thumbnail_url);
              const hasDescription = !!(offer.description || (offer as any).short_description);
              const hasVertical = !!(offer.category || offer.vertical);
              const hasMaskedLink = !!((offer as any).masked_url || (offer as any).preview_url_2);
              const hasPreviewUrl = !!offer.preview_url;

              return (
                <div key={offer.offer_id} className="flex items-start gap-3 p-2 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors">
                  {/* Thumbnail */}
                  <div className="w-12 h-12 rounded border overflow-hidden shrink-0 bg-gray-100">
                    {hasImage ? (
                      <img
                        src={offer.image_url || offer.thumbnail_url}
                        alt={offer.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="w-5 h-5 text-gray-300" />
                      </div>
                    )}
                  </div>

                  {/* Offer info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-medium truncate">{offer.name}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        ${offer.payout?.toFixed(2) || '0.00'}
                      </Badge>
                      {offer.countries?.length > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {offer.countries.slice(0, 3).join(', ')}
                          {offer.countries.length > 3 && ` +${offer.countries.length - 3}`}
                        </Badge>
                      )}
                      {/* Status tags — red for missing, green for present */}
                      {!hasImage && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
                          🖼 No Image
                        </Badge>
                      )}
                      {hasImage && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
                          🖼 Image ✓
                        </Badge>
                      )}
                      {!hasVertical && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
                          🏷 No Vertical
                        </Badge>
                      )}
                      {hasVertical && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
                          🏷 {offer.category || offer.vertical}
                        </Badge>
                      )}
                      {!hasDescription && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
                          📝 No Description
                        </Badge>
                      )}
                      {hasDescription && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
                          📝 Has Desc
                        </Badge>
                      )}
                      {!hasMaskedLink && !hasPreviewUrl && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
                          🔗 No Preview Link
                        </Badge>
                      )}
                      {(hasMaskedLink || hasPreviewUrl) && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
                          🔗 Link ✓
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Action icons for editing */}
                  <OfferActionIcons
                    offerId={offer.offer_id}
                    offerName={offer.name}
                    currentImageUrl={offer.image_url || offer.thumbnail_url || ''}
                    currentDescription={offer.description || (offer as any).short_description || ''}
                    currentCategory={offer.category || offer.vertical || ''}
                    currentPreviewUrl2={(offer as any).preview_url_2 || ''}
                    onOfferUpdated={handleOfferUpdated}
                  />
                </div>
              );
            })}
          </div>

          {/* Missing data warning */}
          {offerList.some(o => !(o.image_url || o.thumbnail_url) || !(o.category || o.vertical) || !(o.description || (o as any).short_description)) && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200">Some offers have missing data</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  Use the action icons (image, description, vertical, link) to fill in missing data before sending.
                </p>
              </div>
            </div>
          )}

          {/* Send Type Tabs */}
          <Tabs value={sendType} onValueChange={v => setSendType(v as any)}>
            <TabsList className="w-full">
              <TabsTrigger value="send_now" className="flex-1 gap-1">
                <Send className="w-3.5 h-3.5" /> Send Now
              </TabsTrigger>
              <TabsTrigger value="schedule" className="flex-1 gap-1">
                <Calendar className="w-3.5 h-3.5" /> Schedule
              </TabsTrigger>
            </TabsList>
            <TabsContent value="schedule" className="mt-3">
              <div>
                <Label className="text-xs">Schedule Date & Time (IST)</Label>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={e => setScheduledAt(e.target.value)}
                  className="mt-1"
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* Publisher Selection with Include/Exclude */}
          <div className="border rounded-lg">
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-muted/50 transition-colors"
              onClick={() => setPubSectionOpen(v => !v)}
            >
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Select Recipients
                {selectionMode === 'include' && selectedPublishers.size > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {selectedPublishers.size} included
                  </Badge>
                )}
                {selectionMode === 'exclude' && excludedPublishers.size > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700">
                    {excludedPublishers.size} excluded
                  </Badge>
                )}
                {selectionMode === 'exclude' && excludedPublishers.size === 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700">
                    All ({publishers.length})
                  </Badge>
                )}
              </span>
              {pubSectionOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {pubSectionOpen && (
              <div className="border-t px-3 py-2 space-y-2">
                {/* Include/Exclude toggle */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={selectionMode === 'include' ? 'default' : 'outline'}
                    onClick={() => setSelectionMode('include')}
                    className="flex-1 text-xs h-7"
                  >
                    Include Selected
                  </Button>
                  <Button
                    size="sm"
                    variant={selectionMode === 'exclude' ? 'default' : 'outline'}
                    onClick={() => setSelectionMode('exclude')}
                    className="flex-1 text-xs h-7"
                  >
                    All Except Excluded
                  </Button>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={pubSearch}
                    onChange={e => setPubSearch(e.target.value)}
                    placeholder="Search by username or email..."
                    className="pl-7 h-8 text-xs"
                  />
                </div>

                {/* Quick actions */}
                <div className="flex items-center gap-2">
                  {selectionMode === 'include' && (
                    <>
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]"
                        onClick={() => setSelectedPublishers(new Set(publishers.map(p => p.user_id)))}>
                        Select All
                      </Button>
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]"
                        onClick={() => setSelectedPublishers(new Set())}>
                        Deselect All
                      </Button>
                    </>
                  )}
                  {selectionMode === 'exclude' && (
                    <>
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]"
                        onClick={() => setExcludedPublishers(new Set())}>
                        Exclude None
                      </Button>
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]"
                        onClick={() => setExcludedPublishers(new Set(publishers.map(p => p.user_id)))}>
                        Exclude All
                      </Button>
                    </>
                  )}
                </div>

                {/* Publisher list */}
                {loadingPubs ? (
                  <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin" /></div>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {filteredPubs.map(p => (
                      <label
                        key={p.user_id}
                        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 cursor-pointer text-xs"
                      >
                        <Checkbox
                          checked={
                            selectionMode === 'include'
                              ? selectedPublishers.has(p.user_id)
                              : excludedPublishers.has(p.user_id)
                          }
                          onCheckedChange={() => {
                            if (selectionMode === 'include') {
                              setSelectedPublishers(prev => {
                                const n = new Set(prev);
                                n.has(p.user_id) ? n.delete(p.user_id) : n.add(p.user_id);
                                return n;
                              });
                            } else {
                              setExcludedPublishers(prev => {
                                const n = new Set(prev);
                                n.has(p.user_id) ? n.delete(p.user_id) : n.add(p.user_id);
                                return n;
                              });
                            }
                          }}
                        />
                        <span className="font-medium">{p.username}</span>
                        <span className="text-muted-foreground truncate">{p.email}</span>
                        {selectionMode === 'exclude' && excludedPublishers.has(p.user_id) && (
                          <Badge className="text-[9px] px-1 py-0 bg-red-100 text-red-600 ml-auto">excluded</Badge>
                        )}
                      </label>
                    ))}
                    {filteredPubs.length === 0 && (
                      <p className="text-xs text-muted-foreground py-2 text-center">No publishers found</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Custom Emails */}
          <div>
            <Label className="text-xs">Additional Emails (optional)</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                placeholder="email@example.com"
                className="text-sm h-9"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEmail(); } }}
              />
              <Button size="sm" variant="outline" onClick={addEmail} className="h-9 shrink-0">
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
            {customEmails.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {customEmails.map(em => (
                  <Badge key={em} variant="outline" className="text-xs gap-1">
                    {em}
                    <button onClick={() => setCustomEmails(prev => prev.filter(x => x !== em))} className="hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Subject */}
          <div>
            <Label className="text-xs">Subject</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} className="mt-1" />
          </div>

          {/* Email Template Settings */}
          <EmailSettingsPanel
            settings={emailSettings}
            onChange={setEmailSettings}
            compact
            offerIds={Object.keys(offerData)}
          />

          {/* Message Body */}
          <div>
            <Label className="text-xs">Message Body (editable)</Label>
            <Textarea
              value={messageBody}
              onChange={e => setMessageBody(e.target.value)}
              rows={6}
              className="mt-1 text-sm font-mono resize-y"
              placeholder="Write your email message here..."
            />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between mt-4">
          <span className="text-xs text-muted-foreground">
            {effectiveRecipients.length + customEmails.length} recipient{effectiveRecipients.length + customEmails.length !== 1 ? 's' : ''}
            {' · '}{offerList.length} offer{offerList.length !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSend} disabled={sending} className="gap-1.5">
              {sending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : sendType === 'schedule' ? (
                <Calendar className="w-3.5 h-3.5" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              {sending ? 'Sending...' : sendType === 'schedule' ? 'Schedule' : 'Send Now'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
