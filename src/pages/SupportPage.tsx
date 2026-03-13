import React, { useEffect, useState } from 'react';
import { MessageCircle, Send, ChevronDown, ChevronUp, Plus, RefreshCw } from 'lucide-react';
import { supportApi, SupportMessage } from '@/services/supportApi';
import { toast } from 'sonner';

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

const SupportPage: React.FC = () => {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [activeMsg, setActiveMsg] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await supportApi.getMyMessages();
      if (res.success) {
        setMessages(res.messages);
        // Mark all replies as read when user opens the support page
        await supportApi.markRepliesRead();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSend = async () => {
    if (!body.trim()) return toast.error('Please enter a message');
    setSending(true);
    try {
      const res = await supportApi.sendMessage(subject, body);
      if (res.success) {
        toast.success('Message sent to support');
        setSubject('');
        setBody('');
        setShowCompose(false);
        load();
      } else {
        toast.error(res.error || 'Failed to send');
      }
    } finally {
      setSending(false);
    }
  };

  const repliedCount = messages.filter(m => m.status === 'replied').length;
  const openCount = messages.filter(m => m.status === 'open').length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-primary" />
            Support
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Send queries to the MoustacheLeads team and track replies
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-2 hover:bg-muted transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowCompose(c => !c)}
            className="flex items-center gap-2 text-sm bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Message
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Messages', value: messages.length, color: 'text-blue-600 bg-blue-50' },
          { label: 'Open', value: openCount, color: 'text-yellow-600 bg-yellow-50' },
          { label: 'Replied', value: repliedCount, color: 'text-green-600 bg-green-50' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-4 border border-border ${s.color}`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-sm font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Compose form */}
      {showCompose && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold text-foreground">New Support Message</h2>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Subject (optional)"
            className="w-full text-sm border border-border rounded-xl px-4 py-3 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Describe your query in detail..."
            rows={5}
            className="w-full text-sm border border-border rounded-xl px-4 py-3 bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowCompose(false)}
              className="px-4 py-2 text-sm border border-border rounded-xl hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </div>
      )}

      {/* Messages list */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-2xl">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-foreground font-medium">No messages yet</p>
            <p className="text-sm text-muted-foreground mt-1">Click "New Message" to contact support</p>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg._id} className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              {/* Message header row */}
              <button
                onClick={() => setActiveMsg(activeMsg === msg._id ? null : msg._id)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{msg.subject}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{fmt(msg.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                  {msg.status === 'replied' && (
                    <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
                      Replied
                    </span>
                  )}
                  {msg.status === 'open' && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full font-medium">
                      Open
                    </span>
                  )}
                  {activeMsg === msg._id
                    ? <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    : <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  }
                </div>
              </button>

              {/* Expanded chat thread */}
              {activeMsg === msg._id && (
                <div className="border-t border-border px-4 sm:px-6 py-5 bg-muted/5">
                  <div className="space-y-3 max-w-2xl mx-auto">
                    {/* User's original message — skip for broadcasts */}
                    {!msg.is_broadcast && (
                      <div className="flex justify-end">
                        <div className="max-w-[80%]">
                          <p className="text-[11px] text-muted-foreground text-right mb-1">You</p>
                          <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5">
                            <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                          </div>
                          <p className="text-[10px] text-muted-foreground text-right mt-1">{fmt(msg.created_at)}</p>
                        </div>
                      </div>
                    )}

                    {/* Support replies */}
                    {msg.replies.length > 0 ? (
                      msg.replies.map(reply => (
                        <div key={reply._id} className="flex justify-start">
                          <div className="max-w-[80%]">
                            <div className="flex items-center gap-1.5 mb-1">
                              <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                                <span className="text-[9px] font-bold text-white">ML</span>
                              </div>
                              <p className="text-[11px] text-muted-foreground">Support</p>
                            </div>
                            <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-2.5">
                              <p className="text-sm text-foreground whitespace-pre-wrap">{reply.text}</p>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">{fmt(reply.created_at)}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6">
                        <p className="text-sm text-muted-foreground">Waiting for reply...</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SupportPage;
