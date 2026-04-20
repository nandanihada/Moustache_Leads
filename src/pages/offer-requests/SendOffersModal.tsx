import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Mail, MessageSquare, Bell, Send, AlertTriangle, User } from 'lucide-react';
import { API_BASE_URL } from '@/services/apiConfig';
import EmailSettingsPanel, { DEFAULT_EMAIL_SETTINGS, type EmailSettings } from '@/components/EmailSettingsPanel';
import PublisherIntelligencePanel from '@/components/PublisherIntelligencePanel';
import type { PProf, Inv } from '@/pages/AdminOfferAccessRequests';

interface SendOffersModalProps {
  open: boolean;
  onClose: () => void;
  publisher: PProf | null;
  preselectedOffers?: Inv[];
}

export default function SendOffersModal({ open, onClose, publisher, preselectedOffers }: SendOffersModalProps) {
  const [offers, setOffers] = useState<Inv[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sendVia, setSendVia] = useState<'email' | 'support' | 'notification'>('email');
  const [customMsg, setCustomMsg] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [emailSettings, setEmailSettings] = useState<EmailSettings>(DEFAULT_EMAIL_SETTINGS);
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!open || !publisher) return;
    if (preselectedOffers && preselectedOffers.length > 0) {
      setOffers(preselectedOffers);
      setSelected(new Set(preselectedOffers.map(o => o.offer_id)));
      return;
    }
    setLoading(true);
    fetch(`${API_BASE_URL}/api/admin/offer-access-requests/inventory-matches?offer_name=${encodeURIComponent(publisher.latest_offer_name)}&user_id=${publisher.user_id}&limit=15`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setOffers(d.matches || []); setSelected(new Set()); })
      .catch(() => toast.error('Failed to load offers'))
      .finally(() => setLoading(false));
  }, [open, publisher]);

  const toggle = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  // Auto-generate message body — NO offer lines here (offers rendered in table by backend)
  useEffect(() => {
    if (!publisher) return;
    const name = publisher.first_name || publisher.username;
    const note = customMsg || 'We have found some great offers that match what you are looking for. Check out the offers below and log in to your publisher dashboard to get started.';
    setMessageBody('Hi ' + name + ',\n\n' + note + '\n\nBest regards,\nPublisher Support Team\nMoustache Leads');
  }, [selected, offers, publisher, customMsg]);

  const handleSend = async () => {
    if (!publisher || selected.size === 0) return;
    setSending(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/offer-access-requests/send-offers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_id: publisher.user_id, offer_ids: Array.from(selected), send_via: sendVia, custom_message: customMsg, message_body: messageBody, template_style: emailSettings.templateStyle, visible_fields: emailSettings.visibleFields, default_image: emailSettings.defaultImage, payout_type: emailSettings.payoutType }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Sent ${selected.size} offer(s) via ${sendVia}`);
      onClose();
    } catch { toast.error('Failed to send offers'); }
    finally { setSending(false); }
  };

  const viaOpts: { key: 'email' | 'support' | 'notification'; icon: React.ReactNode; label: string }[] = [
    { key: 'email', icon: <Mail className="w-3.5 h-3.5" />, label: 'to Email' },
    { key: 'support', icon: <MessageSquare className="w-3.5 h-3.5" />, label: '+ Support message' },
    { key: 'notification', icon: <Bell className="w-3.5 h-3.5" />, label: '+ In-app notification' },
  ];

  // Check for offers without images
  const offersWithoutImage = offers.filter(o => selected.has(o.offer_id) && !(o as any).image_url && !(o as any).thumbnail_url);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Send Offers
            {publisher && <Badge variant="secondary" className="text-xs">{publisher.username}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="compose" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="compose" className="text-xs gap-1.5"><Send className="h-3 w-3" />Compose Email</TabsTrigger>
            <TabsTrigger value="intelligence" className="text-xs gap-1.5"><User className="h-3 w-3" />Publisher Intelligence</TabsTrigger>
          </TabsList>

          <TabsContent value="compose" className="mt-3">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="space-y-4">
                {/* Missing image warning */}
                {offersWithoutImage.length > 0 && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-800 dark:text-amber-200">{offersWithoutImage.length} offer(s) have no image</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                        {offersWithoutImage.map(o => o.name).join(', ')}
                      </p>
                    </div>
                  </div>
                )}

                {/* Offer list */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto border rounded-lg p-2">
                  {offers.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No matching offers found</p>}
                  {offers.map(o => (
                    <label key={o.offer_id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors">
                      <Checkbox checked={selected.has(o.offer_id)} onCheckedChange={() => toggle(o.offer_id)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{o.name}</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs text-muted-foreground">${o.payout.toFixed(2)}</span>
                          {(o as any).already_sent && <span className="text-[10px] px-1.5 py-0 rounded-full bg-amber-100 text-amber-700 font-medium">✉ Already sent</span>}
                          {(o as any).visibility === 'active' && <span className="text-[10px] px-1.5 py-0 rounded-full bg-green-100 text-green-700 font-medium">🟢 Active for all</span>}
                          {(o as any).visibility === 'running' && <span className="text-[10px] px-1.5 py-0 rounded-full bg-emerald-100 text-emerald-700 font-medium">🏃 Running</span>}
                          {(o as any).visibility === 'rotating' && <span className="text-[10px] px-1.5 py-0 rounded-full bg-blue-100 text-blue-700 font-medium">🔄 In Rotation</span>}
                          {(o as any).visibility === 'inactive' && <span className="text-[10px] px-1.5 py-0 rounded-full bg-gray-100 text-gray-600 font-medium">⚫ Inactive</span>}
                          {(o as any).grant_count > 0 && <span className="text-[10px] px-1.5 py-0 rounded-full bg-orange-100 text-orange-700 font-medium">🎯 Granted to {(o as any).grant_count}</span>}
                          {!(o as any).image_url && !(o as any).thumbnail_url ? <span className="text-[10px] text-amber-500">⚠️ No image</span> : null}
                        </div>
                      </div>
                      <Badge variant={o.match_strength === 'Strong' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                        {o.match_strength}
                      </Badge>
                    </label>
                  ))}
                </div>

                {/* Send via */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Send via</Label>
                  <div className="flex gap-2">
                    {viaOpts.map(v => (
                      <Button key={v.key} size="sm" variant={sendVia === v.key ? 'default' : 'outline'}
                        className="text-xs gap-1.5" onClick={() => setSendVia(v.key)}>
                        {v.icon}{v.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Editable message body */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Message (editable — offers will be shown in a table below this)</Label>
                  <Textarea value={messageBody} onChange={e => setMessageBody(e.target.value)}
                    rows={6} className="text-sm resize-y" />
                </div>

                {/* Email template settings */}
                <EmailSettingsPanel settings={emailSettings} onChange={setEmailSettings} compact />

                {/* Custom note */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Personal note (appended to message)</Label>
                  <Textarea value={customMsg} onChange={e => setCustomMsg(e.target.value)}
                    placeholder="Add a personal note..." rows={2} className="text-sm resize-none" />
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="intelligence" className="mt-3">
            {publisher && <PublisherIntelligencePanel userId={publisher.user_id} username={publisher.username} />}
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <span className="text-xs text-muted-foreground">{selected.size} offer{selected.size !== 1 ? 's' : ''} selected</span>
          <Button onClick={handleSend} disabled={sending || selected.size === 0} className="gap-1.5">
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
