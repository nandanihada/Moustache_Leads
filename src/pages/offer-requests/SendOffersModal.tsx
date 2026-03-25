import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Mail, MessageSquare, Bell, Send } from 'lucide-react';
import { API_BASE_URL } from '@/services/apiConfig';
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

  // Auto-generate message body when selection changes
  useEffect(() => {
    if (!publisher) return;
    const sel = offers.filter(o => selected.has(o.offer_id));
    const offerLines = sel.map((o, i) => `${i + 1}. ${o.name} — $${o.payout.toFixed(2)}`).join('\n');
    const body = `Hi ${publisher.first_name || publisher.username},

We've found the following offers that match what you're looking for:

${offerLines}

${customMsg || 'To get started, log in to your publisher dashboard and apply for any of the above offers. Our team is happy to help you set up.'}

Best regards,
Publisher Support Team
Moustache Leads`;
    setMessageBody(body);
  }, [selected, offers, publisher, customMsg]);

  const handleSend = async () => {
    if (!publisher || selected.size === 0) return;
    setSending(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/offer-access-requests/send-offers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_id: publisher.user_id, offer_ids: Array.from(selected), send_via: sendVia, custom_message: customMsg, message_body: messageBody }),
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

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Send Offers
            {publisher && <Badge variant="secondary" className="text-xs">{publisher.username}</Badge>}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            {/* Offer list */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto border rounded-lg p-2">
              {offers.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No matching offers found</p>}
              {offers.map(o => (
                <label key={o.offer_id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors">
                  <Checkbox checked={selected.has(o.offer_id)} onCheckedChange={() => toggle(o.offer_id)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{o.name}</p>
                    <p className="text-xs text-muted-foreground">{o.network} · ${o.payout.toFixed(2)}</p>
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
              <Label className="text-xs font-medium text-muted-foreground">Message (editable)</Label>
              <Textarea value={messageBody} onChange={e => setMessageBody(e.target.value)}
                rows={10} className="text-sm font-mono resize-y" />
            </div>

            {/* Custom note */}
            <div className="space-y-1.5">
              <Label className="text-xs">Personal note (appended to message)</Label>
              <Textarea value={customMsg} onChange={e => setCustomMsg(e.target.value)}
                placeholder="Add a personal note..." rows={2} className="text-sm resize-none" />
            </div>
          </div>
        )}

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
