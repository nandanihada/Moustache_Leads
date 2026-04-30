import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Loader2, Calendar, Send, MessageSquare, Plus, X, Search,
  Users, ChevronDown, ChevronUp, AlertTriangle, User,
} from 'lucide-react';
import { API_BASE_URL } from '@/services/apiConfig';
import EmailSettingsPanel, { DEFAULT_EMAIL_SETTINGS, type EmailSettings } from '@/components/EmailSettingsPanel';
import OfferActionIcons from '@/components/OfferActionIcons';
import PublisherIntelligencePanel from '@/components/PublisherIntelligencePanel';

interface PushMailModalProps {
  open: boolean;
  onClose: () => void;
  offerIds: string[];
  sourceTab: string;
  onSuccess?: () => void;
}

interface PubEntry {
  user_id: string;
  username: string;
  email: string;
}

interface DuplicateEntry {
  offer_id: string;
  offer_name: string;
  user_id: string;
  username: string;
  pushed_at: string;
}

const INTERVAL_OPTIONS = [1, 5, 10, 15, 30, 60];

function getDayName(): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
}

export default function PushMailModal({ open, onClose, offerIds, sourceTab, onSuccess }: PushMailModalProps) {
  const [sendMode, setSendMode] = useState<'one_by_one' | 'all_in_one'>('all_in_one');
  const [intervalMinutes, setIntervalMinutes] = useState(5);
  const [sendType, setSendType] = useState<'send_now' | 'schedule' | 'support'>('send_now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [supportScheduledAt, setSupportScheduledAt] = useState('');
  const [subject, setSubject] = useState('\u{1F680} Push Mail \u2014 Check These Offers!');
  const [messageBody, setMessageBody] = useState('');
  const [customEmails, setCustomEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [emailSettings, setEmailSettings] = useState<EmailSettings>(DEFAULT_EMAIL_SETTINGS);
  const [sending, setSending] = useState(false);

  // Publisher selector
  const [publishers, setPublishers] = useState<PubEntry[]>([]);
  const [selectedPublishers, setSelectedPublishers] = useState<Set<string>>(new Set());
  const [pubSearch, setPubSearch] = useState('');
  const [loadingPubs, setLoadingPubs] = useState(false);
  const [pubSectionOpen, setPubSectionOpen] = useState(false);

  // Offer details for display
  const [offerDetails, setOfferDetails] = useState<Record<string, any>>({});
  const [offerNames, setOfferNames] = useState<Record<string, string>>({});

  // Duplicate detection
  const [duplicates, setDuplicates] = useState<DuplicateEntry[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  const token = localStorage.getItem('token');

  // Fetch publishers
  useEffect(() => {
    if (!open) return;
    setLoadingPubs(true);
    fetch(API_BASE_URL + '/api/admin/offer-access-requests/publisher-profiles?status=all&per_page=200', {
      headers: { Authorization: 'Bearer ' + token },
    })
      .then(r => r.json())
      .then(d => {
        setPublishers(
          (d.profiles || []).map((p: any) => ({
            user_id: p.user_id,
            username: p.username,
            email: p.email,
          }))
        );
      })
      .catch(() => {})
      .finally(() => setLoadingPubs(false));
  }, [open, token]);

  // Fetch offer details from tab-data endpoint
  useEffect(() => {
    if (!open || offerIds.length === 0) return;
    const fetchDetails = async () => {
      const details: Record<string, any> = {};
      const names: Record<string, string> = {};
      try {
        const res = await fetch(
          API_BASE_URL + '/api/admin/offer-access-requests/tab-data?tab=approved&per_page=200',
          { headers: { Authorization: 'Bearer ' + token } }
        );
        if (res.ok) {
          const d = await res.json();
          for (const r of d.requests || []) {
            if (offerIds.includes(r.offer_id)) {
              details[r.offer_id] = {
                name: r.offer_name,
                payout: r.offer_payout,
                category: r.offer_category,
                offer_id: r.offer_id,
              };
              names[r.offer_id] = r.offer_name || r.offer_id;
            }
          }
        }
      } catch {}
      // Also try most_requested for any missing offers
      const missing = offerIds.filter(id => !names[id]);
      if (missing.length > 0) {
        try {
          const res2 = await fetch(
            API_BASE_URL + '/api/admin/offer-access-requests/tab-data?tab=most_requested&per_page=200',
            { headers: { Authorization: 'Bearer ' + token } }
          );
          if (res2.ok) {
            const d2 = await res2.json();
            for (const r of d2.requests || []) {
              if (missing.includes(r.offer_id)) {
                details[r.offer_id] = {
                  name: r.offer_name,
                  payout: r.offer_payout,
                  category: r.offer_category,
                  offer_id: r.offer_id,
                };
                names[r.offer_id] = r.offer_name || r.offer_id;
              }
            }
          }
        } catch {}
      }
      // Fallback: use offer_id as name for anything still missing
      for (const id of offerIds) {
        if (!names[id]) names[id] = id;
      }
      setOfferDetails(details);
      setOfferNames(names);
    };
    fetchDetails();
  }, [open, offerIds, token]);

  // Auto-generate default push mail message based on send mode
  useEffect(() => {
    if (Object.keys(offerNames).length === 0) return;
    const day = getDayName();

    if (sendMode === 'one_by_one') {
      // One-by-one: just greeting + call to action — offers shown in table by backend
      var parts: string[] = [];
      parts.push('Happy ' + day + '!');
      parts.push('');
      parts.push('Please push more traffic on this offer.');
      parts.push('');
      parts.push('Thanks and have a great weekend.');
      setMessageBody(parts.join('\n'));
    } else {
      // All-in-one: greeting only — offers shown in table by backend
      var body = 'Happy ' + day + '!\n\nPlease push more traffic on these offers.\n\nThanks and have a great weekend.';
      setMessageBody(body);
    }
  }, [offerNames, offerDetails, offerIds, sendMode]);

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

  const checkDuplicates = async (): Promise<boolean> => {
    const recipientIds = Array.from(selectedPublishers);
    if (recipientIds.length === 0) return false;
    setCheckingDuplicates(true);
    try {
      const res = await fetch(
        API_BASE_URL + '/api/admin/offer-access-requests/push-mail-check-duplicates',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token,
          },
          body: JSON.stringify({ offer_ids: offerIds, recipient_ids: recipientIds }),
        }
      );
      const data = await res.json();
      if (data.has_duplicates && data.duplicates && data.duplicates.length > 0) {
        setDuplicates(data.duplicates);
        setShowDuplicateWarning(true);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setCheckingDuplicates(false);
    }
  };

  const executeSend = async () => {
    setSending(true);
    try {
      // Auto-add pending email input
      var finalCustomEmails = customEmails.slice();
      var pending = emailInput.trim();
      if (pending && pending.includes('@') && finalCustomEmails.indexOf(pending) === -1) {
        finalCustomEmails.push(pending);
        setCustomEmails(finalCustomEmails);
        setEmailInput('');
      }

      var recipientIds = Array.from(selectedPublishers);
      if (recipientIds.length === 0 && finalCustomEmails.length === 0) {
        toast.error('Please select publishers or add email addresses');
        setSending(false);
        return;
      }

      if (sendType === 'schedule' && !scheduledAt) {
        toast.error('Please select a schedule date/time');
        setSending(false);
        return;
      }

      var payload: any = {
        offer_ids: offerIds,
        recipient_ids: recipientIds,
        custom_emails: finalCustomEmails,
        send_mode: sendMode,
        interval_minutes: sendMode === 'one_by_one' ? intervalMinutes : 0,
        send_type: sendType,
        subject: subject,
        message_body: messageBody,
        source_tab: sourceTab,
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
      if (sendType === 'support' && supportScheduledAt) {
        payload.scheduled_at = supportScheduledAt;
      }

      var res = await fetch(
        API_BASE_URL + '/api/admin/offer-access-requests/push-mail-v2',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token,
          },
          body: JSON.stringify(payload),
        }
      );
      var d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');

      if (d.scheduled) {
        toast.success('Scheduled ' + offerIds.length + ' offer(s) for push mail');
      } else {
        var modeLabel = sendMode === 'one_by_one' ? 'one by one' : 'all in one';
        toast.success('Push mail sent to ' + (d.sent_count || 0) + ' recipients (' + modeLabel + ')');
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send push mail');
    } finally {
      setSending(false);
    }
  };

  const handleSend = async () => {
    var hasDupes = await checkDuplicates();
    if (!hasDupes) {
      await executeSend();
    }
    // If duplicates found, showDuplicateWarning is set — user must confirm via dialog
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Push Mail
            </DialogTitle>
          </DialogHeader>

          {/* Send Mode Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Send Mode</Label>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={sendMode === 'all_in_one' ? 'default' : 'outline'}
                onClick={() => setSendMode('all_in_one')}
                className="flex-1 text-xs"
              >
                All in One Mail
              </Button>
              <Button
                size="sm"
                variant={sendMode === 'one_by_one' ? 'default' : 'outline'}
                onClick={() => setSendMode('one_by_one')}
                className="flex-1 text-xs"
              >
                Send One by One
              </Button>
            </div>
            {sendMode === 'one_by_one' && (
              <div className="flex items-center gap-2 mt-2">
                <Label className="text-xs whitespace-nowrap">Interval (min):</Label>
                <Select
                  value={String(intervalMinutes)}
                  onValueChange={(v) => setIntervalMinutes(Number(v))}
                >
                  <SelectTrigger className="w-[80px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVAL_OPTIONS.map((v) => (
                      <SelectItem key={v} value={String(v)}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-[10px] text-muted-foreground">
                  Each offer sent separately with delay
                </span>
              </div>
            )}
          </div>

          {/* Send Type Tabs */}
          <Tabs value={sendType} onValueChange={(v) => setSendType(v as any)}>
            <TabsList className="w-full">
              <TabsTrigger value="send_now" className="flex-1 gap-1">
                <Send className="w-3.5 h-3.5" />Send Now
              </TabsTrigger>
              <TabsTrigger value="schedule" className="flex-1 gap-1">
                <Calendar className="w-3.5 h-3.5" />Schedule
              </TabsTrigger>
              <TabsTrigger value="support" className="flex-1 gap-1">
                <MessageSquare className="w-3.5 h-3.5" />Support
              </TabsTrigger>
            </TabsList>
            <TabsContent value="send_now" className="mt-3">
              <p className="text-sm text-muted-foreground">
                Email will be sent immediately via BCC.
              </p>
            </TabsContent>
            <TabsContent value="schedule" className="space-y-3 mt-3">
              <div>
                <Label className="text-xs">Schedule Date &amp; Time (IST)</Label>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="mt-1"
                />
              </div>
            </TabsContent>
            <TabsContent value="support" className="space-y-3 mt-3">
              <p className="text-sm text-muted-foreground">
                Creates support messages + triggers email notification.
              </p>
              <div>
                <Label className="text-xs">Schedule (optional)</Label>
                <Input
                  type="datetime-local"
                  value={supportScheduledAt}
                  onChange={(e) => setSupportScheduledAt(e.target.value)}
                  className="mt-1"
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="space-y-4 mt-2">
            {/* Publisher Selector */}
            <div className="border rounded-lg">
              <button
                type="button"
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-muted/50 transition-colors"
                onClick={() => setPubSectionOpen((v) => !v)}
              >
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  Select Publishers
                  {selectedPublishers.size > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {selectedPublishers.size}
                    </Badge>
                  )}
                </span>
                {pubSectionOpen ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
              {pubSectionOpen && (
                <div className="border-t px-3 py-2 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={pubSearch}
                      onChange={(e) => setPubSearch(e.target.value)}
                      placeholder="Search by username or email..."
                      className="pl-7 h-8 text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[10px]"
                      onClick={() =>
                        setSelectedPublishers(new Set(publishers.map((p) => p.user_id)))
                      }
                    >
                      Select All
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => setSelectedPublishers(new Set())}
                    >
                      Deselect All
                    </Button>
                  </div>
                  {loadingPubs ? (
                    <div className="flex justify-center py-3">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  ) : (
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {filteredPubs.map((p) => (
                        <label
                          key={p.user_id}
                          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 cursor-pointer text-xs"
                        >
                          <Checkbox
                            checked={selectedPublishers.has(p.user_id)}
                            onCheckedChange={() =>
                              setSelectedPublishers((prev) => {
                                const n = new Set(prev);
                                if (n.has(p.user_id)) {
                                  n.delete(p.user_id);
                                } else {
                                  n.add(p.user_id);
                                }
                                return n;
                              })
                            }
                          />
                          <span className="font-medium">{p.username}</span>
                          <span className="text-muted-foreground truncate">{p.email}</span>
                        </label>
                      ))}
                      {filteredPubs.length === 0 && (
                        <p className="text-xs text-muted-foreground py-2 text-center">
                          No publishers found
                        </p>
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
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="email@example.com"
                  className="text-sm h-9"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addEmail();
                    }
                  }}
                />
                <Button size="sm" variant="outline" onClick={addEmail} className="h-9 shrink-0">
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
              {customEmails.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {customEmails.map((em) => (
                    <Badge key={em} variant="outline" className="text-xs gap-1">
                      {em}
                      <button
                        onClick={() => setCustomEmails((prev) => prev.filter((x) => x !== em))}
                        className="hover:text-destructive"
                      >
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
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1"
              />
            </div>

            {/* Offer list with action icons */}
            {Object.keys(offerNames).length > 0 && (
              <div className="border rounded-lg p-2 max-h-36 overflow-y-auto space-y-1">
                <Label className="text-xs text-muted-foreground">Offers ({offerIds.length})</Label>
                {offerIds.map(id => (
                  <div key={id} className="flex items-center justify-between gap-2 py-1 px-1 rounded hover:bg-muted/30">
                    <p className="text-xs font-medium truncate flex-1">{offerNames[id] || id}</p>
                    <OfferActionIcons offerId={id} offerName={offerNames[id] || id} />
                  </div>
                ))}
              </div>
            )}

            {/* Email Template Settings */}
            <EmailSettingsPanel settings={emailSettings} onChange={setEmailSettings} compact offerIds={offerIds} />

            {/* Message Body */}
            <div>
              <Label className="text-xs">Message</Label>
              <Textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                rows={8}
                className="mt-1 text-sm font-mono resize-y"
              />
            </div>

            {/* Publisher Intelligence — shown when single publisher selected */}
            {selectedPublishers.size === 1 && (
              <details className="border border-border/50 rounded-lg overflow-hidden">
                <summary className="px-3 py-2 bg-muted/30 hover:bg-muted/50 cursor-pointer text-xs font-medium flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-orange-500" />
                  Publisher Intelligence
                </summary>
                <div className="p-3 border-t border-border/30">
                  <PublisherIntelligencePanel userId={Array.from(selectedPublishers)[0]} compact />
                </div>
              </details>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <span className="text-xs text-muted-foreground">
              {selectedPublishers.size > 0 &&
                selectedPublishers.size + ' publisher' + (selectedPublishers.size !== 1 ? 's' : '')}
              {sendMode === 'one_by_one' && ' · ' + intervalMinutes + 'min interval'}
            </span>
            <Button
              onClick={handleSend}
              disabled={sending || checkingDuplicates}
              className="gap-1.5"
            >
              {(sending || checkingDuplicates) ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : sendType === 'schedule' ? (
                <Calendar className="w-3.5 h-3.5" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              {checkingDuplicates
                ? 'Checking...'
                : sendType === 'schedule'
                  ? 'Schedule'
                  : sendType === 'support'
                    ? 'Send Support'
                    : 'Send Now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Warning Dialog */}
      <Dialog
        open={showDuplicateWarning}
        onOpenChange={(v) => { if (!v) setShowDuplicateWarning(false); }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" /> Duplicate Push Mail Detected
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You have already pushed these offers to these users:
            </p>
            <div className="max-h-40 overflow-y-auto space-y-1.5">
              {duplicates.map((dup, idx) => (
                <div key={idx} className="text-xs border rounded p-2 bg-muted/30">
                  <span className="font-medium">{dup.offer_name || dup.offer_id}</span>
                  {' \u2192 '}
                  <span>{dup.username || dup.user_id}</span>
                  {dup.pushed_at && (
                    <span className="text-muted-foreground ml-1">
                      ({new Date(dup.pushed_at).toLocaleDateString()})
                    </span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-sm">Would you like to proceed anyway?</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDuplicateWarning(false)}>
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={() => {
                setShowDuplicateWarning(false);
                executeSend();
              }}
            >
              Proceed Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
