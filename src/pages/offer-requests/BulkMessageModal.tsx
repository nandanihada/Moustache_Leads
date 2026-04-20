import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Mail, MessageSquare, X, Plus } from 'lucide-react';
import { API_BASE_URL } from '@/services/apiConfig';
import EmailSettingsPanel, { DEFAULT_EMAIL_SETTINGS, type EmailSettings } from '@/components/EmailSettingsPanel';
import type { PProf } from '@/pages/AdminOfferAccessRequests';

interface Props {
  open: boolean;
  onClose: () => void;
  publishers: PProf[];
  defaultMode: 'email' | 'support';
}

export default function BulkMessageModal({ open, onClose, publishers, defaultMode }: Props) {
  const [mode, setMode] = useState<'email' | 'support'>(defaultMode);
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('Message from Moustache Leads');
  const [customEmails, setCustomEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [sending, setSending] = useState(false);
  const [emailSettings, setEmailSettings] = useState<EmailSettings>(DEFAULT_EMAIL_SETTINGS);
  const token = localStorage.getItem('token');

  const addEmail = () => {
    const e = emailInput.trim();
    if (e && e.includes('@') && !customEmails.includes(e)) {
      setCustomEmails(prev => [...prev, e]);
      setEmailInput('');
    }
  };

  const removeEmail = (email: string) => {
    setCustomEmails(prev => prev.filter(e => e !== email));
  };

  const handleSend = async () => {
    if (!message.trim()) { toast.error('Please write a message'); return; }
    if (publishers.length === 0 && customEmails.length === 0) { toast.error('No recipients'); return; }
    setSending(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/offer-access-requests/send-offers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          user_ids: publishers.map(p => p.user_id),
          custom_emails: customEmails,
          offer_ids: [],
          send_via: mode,
          message_body: message,
          subject: subject,
          custom_message: '',
          template_style: emailSettings.templateStyle,
          visible_fields: emailSettings.visibleFields,
          default_image: emailSettings.defaultImage,
          payout_type: emailSettings.payoutType,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      toast.success(d.message || `Sent to ${publishers.length + customEmails.length} recipient(s)`);
      onClose();
      setMessage(''); setCustomEmails([]); setEmailInput('');
    } catch (e: any) { toast.error(e.message || 'Failed to send'); }
    finally { setSending(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send to {publishers.length} Publisher{publishers.length !== 1 ? 's' : ''}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-2">
            <Button size="sm" variant={mode === 'email' ? 'default' : 'outline'} onClick={() => setMode('email')} className={mode === 'email' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}>
              <Mail className="w-3.5 h-3.5 mr-1" />Email
            </Button>
            <Button size="sm" variant={mode === 'support' ? 'default' : 'outline'} onClick={() => setMode('support')} className={mode === 'support' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}>
              <MessageSquare className="w-3.5 h-3.5 mr-1" />Support Message
            </Button>
          </div>

          {/* Recipients */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase">Recipients</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {publishers.map(p => (
                <Badge key={p.user_id} variant="secondary" className="text-xs gap-1">
                  {p.username} <span className="text-muted-foreground">({p.email})</span>
                </Badge>
              ))}
              {customEmails.map(e => (
                <Badge key={e} variant="outline" className="text-xs gap-1">
                  {e}
                  <button onClick={() => removeEmail(e)} className="ml-0.5 hover:text-destructive"><X className="w-3 h-3" /></button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Add custom email */}
          {mode === 'email' && (
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase">Add Custom Email</Label>
              <div className="flex gap-2 mt-1">
                <Input value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder="email@example.com"
                  className="text-sm h-9" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEmail(); } }} />
                <Button size="sm" variant="outline" onClick={addEmail} className="h-9 shrink-0">
                  <Plus className="w-3.5 h-3.5 mr-1" />Add
                </Button>
              </div>
            </div>
          )}

          <EmailSettingsPanel settings={emailSettings} onChange={setEmailSettings} compact />

          {/* Subject (email only) */}
          {mode === 'email' && (
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase">Subject</Label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} className="text-sm h-9 mt-1" />
            </div>
          )}

          {/* Message */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase">Message</Label>
            <Textarea value={message} onChange={e => setMessage(e.target.value)}
              placeholder="Write your message here..." rows={8} className="text-sm mt-1 resize-y" />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <span className="text-xs text-muted-foreground">{publishers.length + customEmails.length} recipient{publishers.length + customEmails.length !== 1 ? 's' : ''}</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSend} disabled={sending || !message.trim()} className="bg-emerald-500 hover:bg-emerald-600 gap-1.5">
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : mode === 'email' ? <Mail className="w-3.5 h-3.5" /> : <MessageSquare className="w-3.5 h-3.5" />}
              Send {mode === 'email' ? 'Email' : 'Support Message'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
