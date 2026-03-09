import React, { useEffect, useState } from 'react';
import { MessageCircle, Send, ChevronDown, ChevronUp, X } from 'lucide-react';
import { supportApi, SupportMessage } from '@/services/supportApi';
import { toast } from 'sonner';

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

export const SupportWidget: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [activeMsg, setActiveMsg] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await supportApi.getMyMessages();
      if (res.success) setMessages(res.messages);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const handleSend = async () => {
    if (!body.trim()) return toast.error('Please enter a message');
    setSending(true);
    try {
      const res = await supportApi.sendMessage(subject, body);
      if (res.success) {
        toast.success('Message sent to support');
        setSubject('');
        setBody('');
        load();
      } else {
        toast.error(res.error || 'Failed to send');
      }
    } finally {
      setSending(false);
    }
  };

  const unreadReplies = messages.filter(
    m => m.status === 'replied' && m.replies.length > 0
  ).length;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="relative w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
      >
        <MessageCircle className="w-6 h-6" />
        {unreadReplies > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unreadReplies}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute bottom-16 right-0 w-96 max-h-[600px] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              <span className="font-semibold">Support</span>
            </div>
            <button onClick={() => setOpen(false)}><X className="w-4 h-4" /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Compose */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Send a message to admin</p>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Subject (optional)"
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Describe your query..."
                rows={3}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
              <button
                onClick={handleSend}
                disabled={sending}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <Send className="w-4 h-4" />
                {sending ? 'Sending...' : 'Send Message'}
              </button>
            </div>

            {/* Previous messages */}
            {messages.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your Messages</p>
                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : (
                  messages.map(msg => (
                    <div key={msg._id} className="border border-border rounded-xl overflow-hidden">
                      <button
                        onClick={() => setActiveMsg(activeMsg === msg._id ? null : msg._id)}
                        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{msg.subject}</p>
                          <p className="text-xs text-muted-foreground">{fmt(msg.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                          {msg.status === 'replied' && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                              Replied
                            </span>
                          )}
                          {msg.status === 'open' && (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                              Open
                            </span>
                          )}
                          {activeMsg === msg._id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </button>

                      {activeMsg === msg._id && (
                        <div className="px-3 pb-3 space-y-2 border-t border-border bg-muted/20">
                          {/* Original message */}
                          <div className="mt-2 bg-background rounded-lg p-2 text-sm text-foreground">
                            <p className="text-xs text-muted-foreground mb-1">You wrote:</p>
                            {msg.body}
                          </div>

                          {/* Replies */}
                          {msg.replies.map(reply => (
                            <div key={reply._id} className="bg-primary/10 border border-primary/20 rounded-lg p-2">
                              <p className="text-xs font-semibold text-primary mb-1">
                                You have a reply from MoustacheLeads
                              </p>
                              <p className="text-sm text-foreground">{reply.text}</p>
                              <p className="text-xs text-muted-foreground mt-1">{fmt(reply.created_at)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
