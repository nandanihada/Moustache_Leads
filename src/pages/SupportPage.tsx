import React, { useEffect, useState, useRef } from 'react';
import { MessageCircle, Send, Plus, RefreshCw, Clock, CheckCircle2, ArrowLeft } from 'lucide-react';
import { supportApi, SupportMessage } from '@/services/supportApi';
import { getApiBaseUrl } from '@/services/apiConfig';
import { getAuthToken } from '@/utils/cookies';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

const SupportPage: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SupportMessage | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await supportApi.getMyMessages();
      if (res.success) {
        setMessages(res.messages);
        if (selected) {
          const updated = res.messages.find(m => m._id === selected._id);
          if (updated) setSelected(updated);
        }
      }
    } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    supportApi.markRepliesRead().catch(() => {});
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selected]);

  const openConversation = (msg: SupportMessage) => {
    setSelected(msg);
    setReplyText('');
    if (msg.status === 'replied' && !msg.read_by_user) {
      supportApi.markRepliesRead().catch(() => {});
      setMessages(prev => prev.map(m => m._id === msg._id ? { ...m, read_by_user: true } : m));
    }
  };

  const handleSend = async () => {
    if (!body.trim()) return toast.error('Please enter a message');
    setSending(true);
    try {
      const res = await supportApi.sendMessage(subject, body);
      if (res.success) {
        toast.success('Message sent to support');
        setSubject(''); setBody(''); setShowCompose(false);
        await load();
        if (res.message) setSelected(res.message);
      } else { toast.error(res.error || 'Failed to send'); }
    } finally { setSending(false); }
  };

  const handleReply = async () => {
    if (!selected || !replyText.trim()) return;
    setReplying(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${getApiBaseUrl()}/api/support/messages/${selected._id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reply: replyText }),
      }).then(r => r.json());
      if (res.success) {
        toast.success('Reply sent');
        setReplyText('');
        setSelected(res.message);
        setMessages(prev => prev.map(m => m._id === res.message._id ? res.message : m));
      } else { toast.error(res.error || 'Failed to send'); }
    } finally { setReplying(false); }
  };

  const handleClose = async () => {
    if (!selected) return;
    try {
      const token = getAuthToken();
      const res = await fetch(`${getApiBaseUrl()}/api/support/messages/${selected._id}/close`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      }).then(r => r.json());
      if (res.success) {
        toast.success('Conversation closed');
        setSelected(res.message);
        setMessages(prev => prev.map(m => m._id === res.message._id ? res.message : m));
      } else { toast.error(res.error || 'Failed to close'); }
    } catch { toast.error('Failed to close'); }
  };

  const newMsgCount = messages.filter(m => m.status === 'replied' && !m.read_by_user).length;
  const openCount = messages.filter(m => m.status === 'open').length;
  const closedCount = messages.filter(m => m.status === 'closed').length;

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-primary" />
            Support
            {messages.length > 0 && (
              <span className="text-base font-normal text-muted-foreground ml-1">({messages.length})</span>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Send queries to the MoustacheLeads team and track replies</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-2 hover:bg-muted transition-colors">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={() => setShowCompose(true)} className="flex items-center gap-2 text-sm bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> New Message
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total', value: messages.length, color: 'text-blue-600 bg-blue-50' },
          { label: 'New from Support', value: newMsgCount, color: 'text-green-600 bg-green-50' },
          { label: 'Waiting for Reply', value: openCount, color: 'text-yellow-600 bg-yellow-50' },
          { label: 'Closed', value: closedCount, color: 'text-gray-600 bg-gray-50' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-4 border border-border ${s.color}`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-sm font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Main inbox layout */}
      <div className="flex gap-4 h-[600px]">
        {/* Left: Message list */}
        <div className={`${selected ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-shrink-0 flex-col border border-border rounded-xl overflow-hidden bg-card`}>
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <p className="text-sm font-semibold text-foreground">Conversations ({messages.length})</p>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {loading ? (
              <div className="p-4 text-sm text-muted-foreground text-center">Loading...</div>
            ) : messages.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                No messages yet
              </div>
            ) : (
              messages.map(msg => {
                const isUnread = msg.status === 'replied' && !msg.read_by_user;
                const replyCount = msg.replies?.length || 0;
                return (
                  <button
                    key={msg._id}
                    onClick={() => openConversation(msg)}
                    className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${
                      selected?._id === msg._id ? 'bg-primary/5 border-l-2 border-primary' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {isUnread && <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 animate-pulse" />}
                          <p className={`text-sm truncate ${isUnread ? 'font-bold' : 'font-medium'}`}>
                            {msg.subject}
                          </p>
                        </div>
                        {isUnread && (
                          <p className="text-xs text-green-600 font-semibold mt-0.5">
                            🟢 New Message from Support
                          </p>
                        )}
                        {msg.status === 'open' && (
                          <p className="text-xs text-yellow-600 mt-0.5">⏳ Waiting for reply...</p>
                        )}
                        {msg.status === 'closed' && (
                          <p className="text-xs text-gray-500 mt-0.5">Closed</p>
                        )}
                        {msg.status === 'replied' && msg.read_by_user && (
                          <p className="text-xs text-blue-600 mt-0.5">✓ Read</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-muted-foreground">{fmt(msg.updated_at || msg.created_at)}</p>
                          {replyCount > 0 && (
                            <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                              {replyCount + 1} messages
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Conversation thread */}
        <div className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 flex-col border border-border rounded-xl overflow-hidden bg-card`}>
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a conversation to view</p>
              </div>
            </div>
          ) : (
            <>
              {/* Conversation header */}
              <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button onClick={() => setSelected(null)} className="md:hidden text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="min-w-0">
                    <h2 className="font-semibold text-foreground truncate">{selected.subject}</h2>
                    <p className="text-xs text-muted-foreground">
                      {fmt(selected.created_at)} · {(selected.replies?.length || 0) + 1} messages
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {selected.status !== 'closed' && (
                    <>
                      {selected.status === 'open' && (
                        <span className="text-xs text-yellow-600 hidden sm:inline">Waiting for Admin</span>
                      )}
                      {selected.status === 'replied' && !selected.read_by_user && (
                        <span className="text-xs text-green-600 font-semibold hidden sm:inline">New Message from Support</span>
                      )}
                      {selected.status === 'replied' && selected.read_by_user && (
                        <span className="text-xs text-muted-foreground hidden sm:inline">Read</span>
                      )}
                      <button
                        onClick={handleClose}
                        className="flex items-center gap-1.5 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Close
                      </button>
                    </>
                  )}
                  {selected.status === 'closed' && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full font-medium">Closed</span>
                  )}
                </div>
              </div>

              {/* Chat thread */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
                <div className="space-y-4 max-w-2xl mx-auto">
                  {/* User's original message (skip for broadcasts) */}
                  {!selected.is_broadcast && (
                    <div className="flex gap-3 justify-end">
                      <div className="max-w-[80%]">
                        <div className="flex items-center gap-1.5 justify-end mb-1">
                          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                            <span className="text-[9px] font-bold text-white">
                              {(user?.username || 'U')[0].toUpperCase()}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {user?.username || 'You'} · {fmt(selected.created_at)}
                          </p>
                        </div>
                        <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5">
                          <p className="text-sm whitespace-pre-wrap">{selected.body}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Replies thread */}
                  {selected.replies.map((reply, idx) => {
                    const isAdmin = reply.from === 'admin';
                    const isLastAdminReply = isAdmin && reply._id === selected.replies.filter(r => r.from === 'admin').slice(-1)[0]?._id;
                    return (
                      <div key={reply._id} className={`flex gap-3 ${isAdmin ? 'justify-start' : 'justify-end'}`}>
                        {isAdmin && (
                          <img
                            src="/logo.png"
                            alt="ML"
                            className="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-5"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const fallback = target.nextElementSibling as HTMLElement;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                        )}
                        {isAdmin && (
                          <div className="w-7 h-7 rounded-full bg-amber-500 items-center justify-center flex-shrink-0 mt-5 hidden">
                            <span className="text-[9px] font-bold text-white">ML</span>
                          </div>
                        )}
                        <div className="max-w-[80%]">
                          <div className={`flex items-center gap-1.5 mb-1 ${isAdmin ? '' : 'justify-end'}`}>
                            <p className="text-[11px] text-muted-foreground">
                              {isAdmin ? 'MoustacheLeads Support' : (user?.username || 'You')} · {fmt(reply.created_at)}
                            </p>
                            {isAdmin && !selected.read_by_user && isLastAdminReply && (
                              <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Unread</span>
                            )}
                          </div>
                          <div className={`rounded-2xl px-4 py-2.5 ${
                            isAdmin
                              ? 'bg-card border border-border rounded-tl-sm'
                              : 'bg-blue-600 text-white rounded-tr-sm'
                          }`}>
                            <p className={`text-sm whitespace-pre-wrap ${isAdmin ? 'text-foreground' : ''}`}>{reply.text}</p>
                          </div>
                        </div>
                        {!isAdmin && (
                          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-5">
                            <span className="text-[9px] font-bold text-white">
                              {(user?.username || 'U')[0].toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {selected.replies.length === 0 && !selected.is_broadcast && (
                    <div className="text-center py-6">
                      <Clock className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                      <p className="text-sm text-muted-foreground">Waiting for admin reply...</p>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </div>

              {/* Reply input */}
              {selected.status !== 'closed' && (
                <div className="px-4 sm:px-6 py-4 border-t border-border bg-muted/20">
                  <div className="flex gap-3">
                    <textarea
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder="Type your message..."
                      rows={2}
                      className="flex-1 text-sm border border-border rounded-xl px-4 py-3 bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleReply(); }}
                    />
                    <button
                      onClick={handleReply}
                      disabled={replying || !replyText.trim()}
                      className="self-end flex items-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      <Send className="w-4 h-4" />
                      {replying ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Ctrl+Enter to send</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Compose modal */}
      {showCompose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCompose(false)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4">
            <h2 className="font-semibold text-foreground text-lg">New Support Message</h2>
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
              <button onClick={() => setShowCompose(false)} className="px-4 py-2 text-sm border border-border rounded-xl hover:bg-muted transition-colors">
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
        </div>
      )}
    </div>
  );
};

export default SupportPage;
