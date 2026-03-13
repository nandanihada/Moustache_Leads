import React, { useEffect, useState, useRef } from 'react';
import { MessageCircle, Send, RefreshCw, Mail, MailOpen, Clock, CheckCircle, PenSquare, X, Users, User, Search, XCircle, ArrowLeft } from 'lucide-react';
import { supportApi, SupportMessage, SupportCounts } from '@/services/supportApi';
import { getApiBaseUrl } from '@/services/apiConfig';
import { getAuthToken } from '@/utils/cookies';
import { toast } from 'sonner';

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

const StatusBadge: React.FC<{ status: SupportMessage['status']; readByAdmin?: boolean }> = ({ status, readByAdmin }) => {
  if (status === 'open' && !readByAdmin)
    return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">New</span>;
  const map = {
    open: 'bg-yellow-100 text-yellow-700',
    replied: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-600',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${map[status]}`}>{status}</span>;
};

type FilterType = 'all' | 'new' | 'open' | 'replied' | 'closed';

const AdminSupportInbox: React.FC = () => {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [counts, setCounts] = useState<SupportCounts>({ total: 0, new: 0, open: 0, replied: 0, closed: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [selected, setSelected] = useState<SupportMessage | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Broadcast modal state
  const [showCompose, setShowCompose] = useState(false);
  const [allUsers, setAllUsers] = useState<{ _id: string; username: string; email: string }[]>([]);
  const [recipientMode, setRecipientMode] = useState<'all' | 'specific'>('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      // For "new" filter, fetch open and filter client-side
      const apiFilter = filter === 'new' ? 'open' : filter;
      const res = await supportApi.adminGetAll(apiFilter);
      if (res.success) {
        let msgs = res.messages;
        if (filter === 'new') {
          msgs = msgs.filter(m => !m.read_by_admin);
        }
        setMessages(msgs);
        if (res.counts) setCounts(res.counts);
        // Update selected if it exists
        if (selected) {
          const updated = msgs.find(m => m._id === selected._id);
          if (updated) setSelected(updated);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selected]);

  const openMessage = async (msg: SupportMessage) => {
    setSelected(msg);
    setReplyText('');
    if (!msg.read_by_admin) {
      await supportApi.adminMarkRead(msg._id);
      setMessages(prev => prev.map(m => m._id === msg._id ? { ...m, read_by_admin: true } : m));
      setCounts(prev => ({ ...prev, new: Math.max(0, prev.new - 1) }));
    }
  };

  const handleReply = async () => {
    if (!selected || !replyText.trim()) return;
    setReplying(true);
    try {
      const res = await supportApi.adminReply(selected._id, replyText);
      if (res.success) {
        toast.success('Reply sent');
        setReplyText('');
        setSelected(res.message);
        setMessages(prev => prev.map(m => m._id === res.message._id ? res.message : m));
      } else {
        toast.error(res.error || 'Failed to send reply');
      }
    } finally {
      setReplying(false);
    }
  };

  const handleClose = async () => {
    if (!selected) return;
    try {
      const token = getAuthToken();
      const res = await fetch(`${getApiBaseUrl()}/api/admin/support/messages/${selected._id}/close`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      }).then(r => r.json());
      if (res.success) {
        toast.success('Ticket closed');
        setSelected(res.message);
        setMessages(prev => prev.map(m => m._id === res.message._id ? res.message : m));
        setCounts(prev => ({ ...prev, closed: prev.closed + 1 }));
      } else {
        toast.error(res.error || 'Failed to close');
      }
    } catch { toast.error('Failed to close'); }
  };

  const openCompose = async () => {
    setShowCompose(true);
    setBroadcastSubject('');
    setBroadcastBody('');
    setRecipientMode('all');
    setSelectedUsers([]);
    setUserSearch('');
    setUsersLoading(true);
    try {
      const res = await supportApi.adminGetUsers();
      if (res.success) setAllUsers(res.users);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastBody.trim()) { toast.error('Message body is required'); return; }
    if (recipientMode === 'specific' && selectedUsers.length === 0) { toast.error('Select at least one recipient'); return; }
    setBroadcasting(true);
    try {
      const res = await supportApi.adminBroadcast(
        broadcastSubject,
        broadcastBody,
        recipientMode === 'specific' ? selectedUsers : null
      );
      if (res.success) {
        toast.success(`Message sent to ${res.sent_to} user${res.sent_to !== 1 ? 's' : ''}`);
        setShowCompose(false);
        load();
      } else {
        toast.error(res.error || 'Failed to send');
      }
    } finally {
      setBroadcasting(false);
    }
  };

  const toggleUser = (id: string) =>
    setSelectedUsers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const filteredUsers = allUsers.filter(u =>
    u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filterTabs: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.total },
    { key: 'new', label: 'New', count: counts.new },
    { key: 'open', label: 'Open', count: counts.open },
    { key: 'replied', label: 'Replied', count: counts.replied },
    { key: 'closed', label: 'Closed', count: counts.closed },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-primary" />
            Support Inbox
            {counts.new > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {counts.new} new
              </span>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">View and reply to publisher support messages</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openCompose} className="flex items-center gap-2 text-sm bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:bg-primary/90 transition-colors font-medium">
            <PenSquare className="w-4 h-4" /> Compose
          </button>
          <button onClick={load} className="flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-2 hover:bg-muted transition-colors">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Stats boxes */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Total', value: counts.total, icon: MessageCircle, color: 'text-blue-600' },
          { label: 'New', value: counts.new, icon: Mail, color: 'text-red-600' },
          { label: 'Open', value: counts.open, icon: Clock, color: 'text-yellow-600' },
          { label: 'Replied', value: counts.replied, icon: CheckCircle, color: 'text-green-600' },
          { label: 'Closed', value: counts.closed, icon: XCircle, color: 'text-gray-500' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
            <s.icon className={`w-7 h-7 ${s.color}`} />
            <div>
              <p className="text-xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main layout */}
      <div className="flex gap-4 h-[600px]">
        {/* Message list */}
        <div className={`${selected ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-shrink-0 flex-col border border-border rounded-xl overflow-hidden bg-card`}>
          {/* Filter tabs */}
          <div className="flex border-b border-border overflow-x-auto">
            {filterTabs.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex-1 py-2 text-xs font-medium capitalize transition-colors whitespace-nowrap px-2 ${
                  filter === f.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {f.label}
                {f.count > 0 && (
                  <span className={`ml-1 ${filter === f.key ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                    ({f.count})
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {loading ? (
              <div className="p-4 text-sm text-muted-foreground text-center">Loading...</div>
            ) : messages.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No messages</div>
            ) : (
              messages.map(msg => {
                const replyCount = msg.replies?.length || 0;
                return (
                <button
                  key={msg._id}
                  onClick={() => openMessage(msg)}
                  className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${
                    selected?._id === msg._id ? 'bg-primary/5 border-l-2 border-primary' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {!msg.read_by_admin
                          ? <Mail className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                          : <MailOpen className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        }
                        <p className={`text-sm truncate ${!msg.read_by_admin ? 'font-bold' : 'font-medium'}`}>
                          {msg.username || msg.email}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{msg.subject}</p>
                      {!msg.read_by_admin && (
                        <p className="text-xs text-red-600 font-semibold mt-0.5">🔴 Unread</p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground">{fmt(msg.updated_at || msg.created_at)}</p>
                        {replyCount > 0 && (
                          <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                            {replyCount + 1} msgs
                          </span>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={msg.status} readByAdmin={msg.read_by_admin} />
                  </div>
                </button>
                );
              })
            )}
          </div>
        </div>

        {/* Detail / reply panel */}
        <div className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 flex-col border border-border rounded-xl overflow-hidden bg-card`}>
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a message to view</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-4 sm:px-6 py-4 border-b border-border">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <button onClick={() => setSelected(null)} className="md:hidden text-muted-foreground hover:text-foreground">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="min-w-0">
                      <h2 className="font-semibold text-foreground truncate">{selected.subject}</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        From: <span className="font-medium text-foreground">{selected.username}</span>
                        {' · '}
                        <a href={`mailto:${selected.email}`} className="text-primary hover:underline">{selected.email}</a>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{fmt(selected.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={selected.status} readByAdmin={selected.read_by_admin} />
                    {selected.status !== 'closed' && (
                      <button
                        onClick={handleClose}
                        className="flex items-center gap-1.5 text-xs bg-gray-600 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Close Ticket
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Chat thread */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
                {/* User's original message — skip for broadcasts since body = first reply */}
                {!selected.is_broadcast && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {(selected.username || 'U')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 max-w-[85%]">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-semibold text-foreground">{selected.username}</p>
                      <p className="text-xs text-muted-foreground">{fmt(selected.created_at)}</p>
                    </div>
                    <div className="bg-muted/40 rounded-xl rounded-tl-none px-4 py-3">
                      <p className="text-sm text-foreground whitespace-pre-wrap">{selected.body}</p>
                    </div>
                  </div>
                </div>
                )}

                {/* Replies */}
                {selected.replies.map(reply => {
                  const isAdmin = reply.from === 'admin';
                  return isAdmin ? (
                    <div key={reply._id} className="flex gap-3 justify-end">
                      <div className="flex-1 max-w-[85%]">
                        <div className="flex items-center gap-2 justify-end mb-1">
                          <p className="text-xs text-muted-foreground">{fmt(reply.created_at)}</p>
                          <p className="text-xs font-semibold text-primary">Admin</p>
                        </div>
                        <div className="bg-primary/10 border border-primary/20 rounded-xl rounded-tr-none px-4 py-3">
                          <p className="text-sm text-foreground whitespace-pre-wrap">{reply.text}</p>
                        </div>
                      </div>
                      <img
                        src="/logo.png"
                        alt="Admin"
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                        onError={(e) => {
                          const t = e.target as HTMLImageElement;
                          t.style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <div key={reply._id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {(selected.username || 'U')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 max-w-[85%]">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs font-semibold text-foreground">{selected.username}</p>
                          <p className="text-xs text-muted-foreground">{fmt(reply.created_at)}</p>
                        </div>
                        <div className="bg-muted/40 rounded-xl rounded-tl-none px-4 py-3">
                          <p className="text-sm text-foreground whitespace-pre-wrap">{reply.text}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Reply input */}
              {selected.status !== 'closed' && (
                <div className="px-4 sm:px-6 py-4 border-t border-border bg-muted/20">
                  <div className="flex gap-3">
                    <textarea
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder="Type your reply..."
                      rows={3}
                      className="flex-1 text-sm border border-border rounded-xl px-4 py-3 bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleReply(); }}
                    />
                    <button
                      onClick={handleReply}
                      disabled={replying || !replyText.trim()}
                      className="self-end flex items-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      <Send className="w-4 h-4" />
                      {replying ? 'Sending...' : 'Reply'}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Ctrl+Enter to send</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Compose / Broadcast Modal ── */}
      {showCompose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCompose(false)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <PenSquare className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Compose Message</h2>
              </div>
              <button onClick={() => setShowCompose(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Send To</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setRecipientMode('all')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                      recipientMode === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Users className="w-4 h-4" /> All Publishers
                  </button>
                  <button
                    onClick={() => setRecipientMode('specific')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                      recipientMode === 'specific' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <User className="w-4 h-4" /> Specific Users
                  </button>
                </div>
              </div>

              {recipientMode === 'specific' && (
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Select Recipients
                    {selectedUsers.length > 0 && (
                      <span className="ml-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                        {selectedUsers.length} selected
                      </span>
                    )}
                  </label>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={userSearch}
                      onChange={e => setUserSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="border border-border rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    {usersLoading ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Loading users...</p>
                    ) : filteredUsers.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
                    ) : (
                      filteredUsers.map(u => (
                        <label key={u._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 cursor-pointer border-b border-border last:border-0">
                          <input type="checkbox" checked={selectedUsers.includes(u._id)} onChange={() => toggleUser(u._id)} className="rounded" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{u.username}</p>
                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Subject</label>
                <input
                  type="text"
                  placeholder="Message from MoustacheLeads"
                  value={broadcastSubject}
                  onChange={e => setBroadcastSubject(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Message</label>
                <textarea
                  placeholder="Write your message here..."
                  value={broadcastBody}
                  onChange={e => setBroadcastBody(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {recipientMode === 'all'
                  ? 'Sends to all registered publishers'
                  : selectedUsers.length === 0
                    ? 'No recipients selected'
                    : `Will send to ${selectedUsers.length} user${selectedUsers.length !== 1 ? 's' : ''}`}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setShowCompose(false)} className="px-4 py-2 text-sm border border-border rounded-xl hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleBroadcast}
                  disabled={broadcasting || !broadcastBody.trim()}
                  className="flex items-center gap-2 px-5 py-2 text-sm bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  <Send className="w-4 h-4" />
                  {broadcasting ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSupportInbox;
