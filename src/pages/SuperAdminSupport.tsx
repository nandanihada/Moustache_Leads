import {
  Inbox, Users, Zap, Search, Link2, Database, Activity, Shield, Settings,
  Plus, Trash2, Pencil, X, Send, ChevronDown, ToggleLeft, ToggleRight,
  Download, RefreshCw, Bell, User, Check, AlertTriangle, ArrowLeft,
  StickyNote, BookOpen, Filter, Clock, CheckCircle2, ThumbsDown,
  MessageSquare, Globe, Tag, UserCheck
} from 'lucide-react';
import { useEffect, useState, useRef, useCallback, type FC } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  staffChatApi, smartQuestionsApi, offerCheckApi, quickLinksApi,
  submittedDataApi, activityLogApi, teamPermissionsApi, supportSettingsApi,
  sharedNotesApi, subadminSupportApi,
  StaffThread, StaffMessage, SmartQuestionConfig, SmartQuestion,
  OfferCheckResult, QuickLink, IntakeSession, ActivityLogEntry,
  TeamMember, SupportSettings, SharedNote,
} from '@/services/superAdminSupportApi';
import { supportApi, SupportMessage, TOPIC_LABELS, TOPIC_COLORS, SupportTopic, CannedReply } from '@/services/supportApi';
import { getApiBaseUrl } from '@/services/apiConfig';
import { getAuthToken } from '@/utils/cookies';
import AdminSupportInbox from '@/pages/AdminSupportInbox';
// â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
const ago = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};
const initials = (name: string) => name.slice(0, 2).toUpperCase();
const COLORS = ['bg-violet-500', 'bg-blue-500', 'bg-green-500', 'bg-rose-500', 'bg-amber-500', 'bg-teal-500', 'bg-indigo-500'];
const avatarColor = (name: string) => COLORS[name.charCodeAt(0) % COLORS.length];

type Tab = 'inbox' | 'staff' | 'smart' | 'offercheck' | 'quicklinks' | 'submitted' | 'activitylog' | 'teamperms' | 'settings' | 'sharednotes' | 'myassignments';

// All tabs with role visibility
const ALL_NAV: { id: Tab; label: string; icon: typeof Inbox; roles: ('admin' | 'subadmin')[]; href?: string }[] = [
  { id: 'inbox',       label: 'Inbox',              icon: Inbox,       roles: ['admin', 'subadmin'] },
  { id: 'staff',       label: 'Chat with Super Admin', icon: Users,    roles: ['subadmin'] },
  { id: 'staff',       label: 'Staff chat',          icon: Users,      roles: ['admin'] },
  { id: 'smart',       label: 'Smart Questions',     icon: Zap,        roles: ['admin', 'subadmin'] },
  { id: 'offercheck',  label: 'Offer Check',         icon: Search,     roles: ['admin'] },
  { id: 'quicklinks',  label: 'Quick links',         icon: Link2,      roles: ['admin', 'subadmin'] },
  { id: 'submitted',   label: 'Submitted data',      icon: Database,   roles: ['admin', 'subadmin'] },
  { id: 'sharednotes', label: 'Team notes',          icon: StickyNote, roles: ['admin', 'subadmin'] },
  { id: 'myassignments', label: 'My assignments',    icon: UserCheck,  roles: ['subadmin'] },
  { id: 'activitylog', label: 'Activity log',        icon: Activity,   roles: ['admin'] },
  { id: 'teamperms',   label: 'Team permissions',    icon: Shield,     roles: ['admin'] },
  { id: 'settings',    label: 'Settings',            icon: Settings,   roles: ['admin'] },
];

const PERM_LABELS: Record<string, string> = {
  reply: 'Reply to tickets',
  close: 'Close and reopen',
  flag: 'Flag users',
  profile: 'View and edit profile',
  notes: 'Internal notes',
  quick_links: 'Manage quick links',
  all_tickets: 'See all tickets',
};

// ── SUBADMIN: Chat with Super Admin (single thread) ───────────────────────────
const SubadminChatTab: FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<StaffMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const r = await staffChatApi.myGetMessages();
    if (r.success) {
      setMessages(r.messages);
      // Count unread (from admin, not seen yet — they get marked seen on load)
      setUnread(0);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    const r = await staffChatApi.mySendMessage(text.trim());
    if (r.success) { setMessages(p => [...p, r.message]); setText(''); }
    else toast.error('Failed to send');
    setSending(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-3.5 border-b border-border">
        <h3 className="font-semibold">Chat with Super Admin</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Private thread — only you and the Super Admin can see this.</p>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {loading ? <p className="text-xs text-center text-muted-foreground py-8">Loading...</p>
          : messages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No messages yet</p>
              <p className="text-xs mt-1">Send a message to start a private conversation with the Super Admin.</p>
            </div>
          ) : messages.map(m => {
            const isMe = m.sender_id !== undefined && (
              m.sender_role === 'subadmin' || m.sender_role === user?.role
            ) && m.sender_id !== messages.find(x => x.sender_role === 'admin')?.sender_id;
            // Simpler: messages I sent have my username
            const isMine = m.sender_name === user?.username;
            return (
              <div key={m._id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                {!isMine && (
                  <div className={`w-8 h-8 rounded-full ${avatarColor(m.sender_name)} flex items-center justify-center flex-shrink-0 mr-2 mt-1`}>
                    <span className="text-[10px] font-bold text-white">{initials(m.sender_name)}</span>
                  </div>
                )}
                <div className="max-w-[75%]">
                  {!isMine && <p className="text-[10px] font-semibold text-muted-foreground mb-0.5 ml-0.5">Super Admin</p>}
                  <div className={`rounded-2xl px-3 py-2.5 ${isMine ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-card border border-border rounded-tl-sm'}`}>
                    <p className="text-sm">{m.text}</p>
                    <p className={`text-[10px] mt-1 ${isMine ? 'opacity-60' : 'text-muted-foreground'}`}>{fmt(m.created_at)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        <div ref={endRef} />
      </div>
      <div className="px-5 py-3 border-t border-border flex gap-2">
        <textarea value={text} onChange={e => setText(e.target.value)} rows={2}
          placeholder="Type a message to Super Admin..."
          className="flex-1 text-sm border border-border rounded-xl px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); }} />
        <button onClick={send} disabled={sending || !text.trim()}
          className="self-end bg-primary text-primary-foreground px-3 py-2 rounded-xl text-xs font-medium disabled:opacity-50 flex items-center gap-1">
          <Send className="w-3.5 h-3.5" />{sending ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
};

// ── SHARED NOTES TAB ──────────────────────────────────────────────────────────
const SharedNotesTab: FC = () => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<SharedNote[]>([]);
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sharedNotesApi.list().then(r => { if (r.success) setNotes(r.notes); setLoading(false); });
  }, []);

  const add = async () => {
    if (!text.trim()) return;
    setAdding(true);
    const r = await sharedNotesApi.add(text.trim());
    if (r.success) { setNotes(p => [r.note, ...p]); setText(''); toast.success('Note added'); }
    else toast.error('Failed');
    setAdding(false);
  };

  const del = async (id: string) => {
    const r = await sharedNotesApi.delete(id);
    if (r.success) { setNotes(p => p.filter(n => n._id !== id)); toast.success('Deleted'); }
    else toast.error('Not allowed');
  };

  return (
    <div className="flex-1 overflow-y-auto px-5 py-5 max-w-3xl space-y-4">
      <div>
        <h2 className="text-xl font-bold">Team notes</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Visible to everyone on the support team. Not visible to publishers.</p>
      </div>
      {/* Add note */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
        <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
          placeholder="Add a team note... (tip: paste WhatsApp chats and they'll clean up automatically)"
          className="w-full text-sm border border-amber-200 rounded-lg px-3 py-2 bg-white focus:outline-none resize-none" />
        <div className="flex justify-end">
          <button onClick={add} disabled={adding || !text.trim()}
            className="bg-amber-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50">
            {adding ? 'Saving...' : 'Add note'}
          </button>
        </div>
      </div>
      {/* Notes list */}
      {loading ? <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
        : notes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <StickyNote className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No team notes yet</p>
          </div>
        ) : notes.map(n => (
          <div key={n._id} className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 group">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full ${avatarColor(n.author_name)} flex items-center justify-center`}>
                  <span className="text-[9px] font-bold text-white">{initials(n.author_name)}</span>
                </div>
                <span className="text-xs font-semibold text-amber-800">{n.author_name}</span>
                <span className="text-[9px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded capitalize">{n.author_role}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-amber-600">{fmt(n.created_at)}</span>
                {(user?.role === 'admin' || n.author_name === user?.username) && (
                  <button onClick={() => del(n._id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
            <p className="text-sm text-amber-900 whitespace-pre-wrap">{n.text}</p>
          </div>
        ))}
    </div>
  );
};

// ── SMART QUESTIONS READ-ONLY (for subadmins) ─────────────────────────────────
const SmartQuestionsReadOnlyTab: FC = () => {
  const [configs, setConfigs] = useState<SmartQuestionConfig[]>([]);
  const [selected, setSelected] = useState<SmartQuestionConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    subadminSupportApi.listSmartQuestions().then(r => { if (r.success) setConfigs(r.configs); setLoading(false); });
  }, []);

  return (
    <div className="flex h-full">
      <div className={`${selected ? 'hidden md:flex' : 'flex'} w-full md:w-72 flex-shrink-0 flex-col border-r border-border`}>
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-sm">Smart Questions</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Questions prepared for each publisher. View only.</p>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {loading ? <p className="p-4 text-xs text-center text-muted-foreground">Loading...</p>
            : configs.length === 0 ? <p className="p-6 text-xs text-center text-muted-foreground">No Smart Questions set up yet</p>
            : configs.map(c => (
              <button key={c._id} onClick={() => setSelected(c)}
                className={`w-full text-left px-4 py-3 hover:bg-muted/50 ${selected?._id === c._id ? 'bg-primary/5' : ''}`}>
                <p className="text-sm font-semibold">{c.name || c.email}</p>
                <p className="text-[10px] text-muted-foreground truncate">{c.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  {(c.ready_count ?? 0) > 0 && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">⚡ {c.ready_count} ready</span>}
                  <span className="text-[9px] text-muted-foreground">{c.total} total · {c.delay_seconds}s delay</span>
                </div>
              </button>
            ))}
        </div>
      </div>
      <div className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 flex-col overflow-y-auto`}>
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Zap className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Select a publisher to see their questions</p>
            </div>
          </div>
        ) : (
          <div className="px-5 py-5 space-y-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelected(null)} className="md:hidden"><ArrowLeft className="w-4 h-4" /></button>
              <div>
                <h3 className="font-semibold">{selected.name || selected.email}</h3>
                <p className="text-xs text-muted-foreground">{selected.email} · {selected.delay_seconds}s delay · {selected.enabled ? '✅ Enabled' : '⏸ Disabled'}</p>
              </div>
            </div>
            {selected.questions?.length === 0 ? <p className="text-sm text-muted-foreground">No questions yet</p>
              : selected.questions.map((q, i) => (
                <div key={q._id} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-muted-foreground">Q{i + 1}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${q.status === 'ready' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                      {q.status === 'ready' ? '⚡ Ready' : 'Draft'}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{q.question_text || <span className="italic text-muted-foreground">Not written yet</span>}</p>
                  {q.options?.length > 0 && <p className="text-xs text-muted-foreground mt-1">Options: {q.options.join(', ')}</p>}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── MY ASSIGNMENTS TAB (subadmin sees their assigned tickets) ─────────────────
const MyAssignmentsTab: FC = () => {
  const [tickets, setTickets] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    subadminSupportApi.getMyAssignments().then(r => { if (r.success) setTickets(r.tickets); setLoading(false); });
  }, []);

  return (
    <div className="flex-1 overflow-y-auto px-5 py-5 max-w-3xl space-y-3">
      <div>
        <h2 className="text-xl font-bold">My assignments</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Tickets assigned to you by the Super Admin.</p>
      </div>
      {loading ? <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
        : tickets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No tickets assigned to you yet</p>
          </div>
        ) : tickets.map(t => (
          <div key={t._id} className="bg-card border border-border rounded-xl px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <p className="font-semibold text-sm">{t.username}</p>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${t.status === 'open' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{t.status}</span>
            </div>
            <p className="text-xs text-muted-foreground truncate">{t.subject}</p>
            <div className="flex items-center gap-2 mt-1">
              {t.topic && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${TOPIC_COLORS[t.topic as SupportTopic] || ''}`}>{TOPIC_LABELS[t.topic as SupportTopic] || t.topic}</span>}
              <span className="text-[10px] text-muted-foreground">{ago(t.updated_at || t.created_at)}</span>
            </div>
          </div>
        ))}
    </div>
  );
};

// â”€â”€ INBOX TAB â€” uses the full AdminSupportInbox component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Import is handled inline via dynamic reference to avoid circular deps
// ── INBOX TAB — full AdminSupportInbox embedded inline ───────────────────────
const InboxTab: FC = () => <AdminSupportInbox />;

// â”€â”€ STAFF CHAT TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const StaffChatTab: FC = () => {
  const [threads, setThreads] = useState<StaffThread[]>([]);
  const [selected, setSelected] = useState<StaffThread | null>(null);
  const [messages, setMessages] = useState<StaffMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    staffChatApi.getThreads().then(r => { if (r.success) setThreads(r.threads); setLoading(false); });
  }, []);

  const openThread = async (t: StaffThread) => {
    setSelected(t);
    const r = await staffChatApi.getMessages(t.thread_id);
    if (r.success) { setMessages(r.messages); setThreads(p => p.map(x => x.thread_id === t.thread_id ? { ...x, unread: 0 } : x)); }
  };

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    if (!selected || !text.trim()) return;
    setSending(true);
    const r = await staffChatApi.sendMessage(selected.thread_id, text.trim());
    if (r.success) { setMessages(p => [...p, r.message]); setText(''); }
    else toast.error('Failed to send');
    setSending(false);
  };

  return (
    <div className="flex h-full">
      {/* Left: subadmin list */}
      <div className={`${selected ? 'hidden md:flex' : 'flex'} w-full md:w-64 flex-shrink-0 flex-col border-r border-border`}>
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-sm">Staff chat</h3>
          <p className="text-xs text-muted-foreground mt-0.5">One private thread per admin</p>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {loading ? <p className="p-4 text-xs text-center text-muted-foreground">Loading...</p>
            : threads.length === 0 ? <p className="p-6 text-xs text-center text-muted-foreground">No subadmins yet</p>
            : threads.map(t => (
              <button key={t.thread_id} onClick={() => openThread(t)}
                className={`w-full text-left px-4 py-3 hover:bg-muted/50 flex items-center gap-3 ${selected?.thread_id === t.thread_id ? 'bg-primary/5' : ''}`}>
                <div className={`w-9 h-9 rounded-full ${avatarColor(t.username)} flex items-center justify-center flex-shrink-0`}>
                  <span className="text-xs font-bold text-white">{initials(t.username)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate">{t.username}</p>
                    {t.last_at && <span className="text-[10px] text-muted-foreground flex-shrink-0">{ago(t.last_at)}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{t.last_message || 'No messages yet'}</p>
                </div>
                {t.unread > 0 && <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-bold flex-shrink-0">{t.unread}</span>}
              </button>
            ))}
        </div>
      </div>
      {/* Right: thread */}
      <div className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 flex-col overflow-hidden`}>
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">Pick an admin</p>
              <p className="text-xs text-muted-foreground mt-1">Messages here are private between you and that admin.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <button onClick={() => setSelected(null)} className="md:hidden"><ArrowLeft className="w-4 h-4" /></button>
              <div className={`w-8 h-8 rounded-full ${avatarColor(selected.username)} flex items-center justify-center`}>
                <span className="text-xs font-bold text-white">{initials(selected.username)}</span>
              </div>
              <div>
                <p className="font-semibold text-sm">{selected.username}</p>
                <p className="text-xs text-muted-foreground">{selected.email}</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.length === 0 && <p className="text-center text-xs text-muted-foreground py-8">No messages yet</p>}
              {messages.map(m => {
                const isMe = m.sender_role === 'admin';
                return (
                  <div key={m._id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`rounded-2xl px-3 py-2.5 max-w-[75%] ${isMe ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-card border border-border rounded-tl-sm'}`}>
                      <p className="text-sm">{m.text}</p>
                      <p className={`text-[10px] mt-1 ${isMe ? 'opacity-60' : 'text-muted-foreground'}`}>{fmt(m.created_at)}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
            <div className="px-4 py-3 border-t border-border flex gap-2">
              <textarea value={text} onChange={e => setText(e.target.value)} rows={2} placeholder="Type a message..."
                className="flex-1 text-sm border border-border rounded-xl px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); }} />
              <button onClick={send} disabled={sending || !text.trim()}
                className="self-end bg-primary text-primary-foreground px-3 py-2 rounded-xl text-xs font-medium disabled:opacity-50 flex items-center gap-1">
                <Send className="w-3.5 h-3.5" />{sending ? '...' : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// â”€â”€ SMART QUESTIONS TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SmartQuestionsTab: FC = () => {
  const [configs, setConfigs] = useState<SmartQuestionConfig[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SmartQuestionConfig | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', website: '', raw_notes: '' });
  const [saving, setSaving] = useState(false);
  const [editingQ, setEditingQ] = useState<SmartQuestion | null>(null);
  const [newQ, setNewQ] = useState({ raw_note: '', question_text: '', answer_type: 'text' as const, options: '' });
  const [addingQ, setAddingQ] = useState(false);

  const load = useCallback(async () => {
    const r = await smartQuestionsApi.list(search);
    if (r.success) setConfigs(r.configs);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const openConfig = async (c: SmartQuestionConfig) => {
    const r = await smartQuestionsApi.get(c._id);
    if (r.success) setSelected(r.config);
  };

  const createPublisher = async () => {
    if (!addForm.email) return toast.error('Email required');
    setSaving(true);
    const r = await smartQuestionsApi.create(addForm);
    if (r.success) { toast.success('Publisher added'); setShowAdd(false); setAddForm({ name: '', email: '', website: '', raw_notes: '' }); load(); }
    else toast.error((r as any).error || 'Failed');
    setSaving(false);
  };

  const toggleEnabled = async () => {
    if (!selected) return;
    const r = await smartQuestionsApi.update(selected._id, { enabled: !selected.enabled });
    if (r.success) { setSelected({ ...selected, enabled: !selected.enabled }); setConfigs(p => p.map(c => c._id === selected._id ? { ...c, enabled: !c.enabled } : c)); }
  };

  const addQuestion = async () => {
    if (!selected || !newQ.question_text.trim()) return toast.error('Question text required');
    setAddingQ(true);
    const r = await smartQuestionsApi.addQuestion(selected._id, {
      raw_note: newQ.raw_note,
      question_text: newQ.question_text,
      answer_type: newQ.answer_type,
      options: newQ.options ? newQ.options.split(',').map(o => o.trim()).filter(Boolean) : [],
    });
    if (r.success) {
      const updated = await smartQuestionsApi.get(selected._id);
      if (updated.success) setSelected(updated.config);
      setNewQ({ raw_note: '', question_text: '', answer_type: 'text', options: '' });
      toast.success('Question added');
    }
    setAddingQ(false);
  };

  const saveQuestion = async (q: SmartQuestion) => {
    if (!selected) return;
    await smartQuestionsApi.updateQuestion(selected._id, q._id, q);
    const updated = await smartQuestionsApi.get(selected._id);
    if (updated.success) setSelected(updated.config);
    setEditingQ(null);
    toast.success('Saved');
  };

  const deleteQuestion = async (qId: string) => {
    if (!selected || !confirm('Delete this question?')) return;
    await smartQuestionsApi.deleteQuestion(selected._id, qId);
    setSelected({ ...selected, questions: selected.questions.filter(q => q._id !== qId) });
  };

  const deleteConfig = async () => {
    if (!selected || !confirm('Delete this publisher config?')) return;
    await smartQuestionsApi.delete(selected._id);
    setSelected(null); load(); toast.success('Deleted');
  };

  return (
    <div className="flex h-full">
      {/* Left list */}
      <div className={`${selected ? 'hidden md:flex' : 'flex'} w-full md:w-72 flex-shrink-0 flex-col border-r border-border`}>
        <div className="px-3 py-3 border-b border-border flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2 w-3 h-3 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, website"
              className="w-full pl-7 pr-2 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none" />
          </div>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 bg-primary text-primary-foreground px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-primary/90">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {configs.length === 0 ? <p className="p-6 text-xs text-center text-muted-foreground">No publishers yet</p>
            : configs.map(c => (
              <button key={c._id} onClick={() => openConfig(c)}
                className={`w-full text-left px-4 py-3 hover:bg-muted/50 ${selected?._id === c._id ? 'bg-primary/5' : ''}`}>
                <p className="text-sm font-semibold">{c.name || c.email}</p>
                <p className="text-[10px] text-muted-foreground truncate">{c.email}{c.website ? `, ${c.website}` : ''}</p>
                <div className="flex items-center gap-2 mt-1">
                  {(c.ready_count ?? 0) > 0 && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">âš¡ {c.ready_count} ready</span>}
                  {(c.refine_count ?? 0) > 0 && <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{c.refine_count} to refine</span>}
                  <span className="text-[9px] text-muted-foreground">{c.total} total</span>
                  <span className="text-[9px] text-muted-foreground">{c.delay_seconds}s delay</span>
                </div>
              </button>
            ))}
        </div>
      </div>

      {/* Right: config detail */}
      <div className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 flex-col overflow-hidden`}>
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Zap className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">Pick a publisher</p>
              <p className="text-xs mt-1">Write rough notes, refine them into clear questions,<br />and mark them ready to send.</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            <button onClick={() => setSelected(null)} className="md:hidden flex items-center gap-1 text-xs text-muted-foreground mb-2"><ArrowLeft className="w-3.5 h-3.5" /> Back</button>

            {/* Publisher meta */}
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {(['name', 'email', 'website'] as const).map(field => (
                  <div key={field}>
                    <p className="text-xs text-muted-foreground mb-1 capitalize">{field}</p>
                    <input value={(selected as any)[field] || ''} onChange={e => setSelected({ ...selected, [field]: e.target.value })}
                      onBlur={() => smartQuestionsApi.update(selected._id, { [field]: (selected as any)[field] })}
                      className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4">
                <button onClick={toggleEnabled} className="flex items-center gap-2 text-sm">
                  {selected.enabled
                    ? <ToggleRight className="w-8 h-8 text-primary" />
                    : <ToggleLeft className="w-8 h-8 text-muted-foreground" />}
                  <span className={selected.enabled ? 'text-primary font-medium' : 'text-muted-foreground'}>Enabled</span>
                </button>
                <span className="text-xs text-muted-foreground">Auto-ask after</span>
                <input type="number" value={selected.delay_seconds}
                  onChange={e => setSelected({ ...selected, delay_seconds: Number(e.target.value) })}
                  onBlur={() => smartQuestionsApi.update(selected._id, { delay_seconds: selected.delay_seconds })}
                  className="w-16 text-xs border border-border rounded-lg px-2 py-1 bg-background text-center focus:outline-none" />
                <span className="text-xs text-muted-foreground">seconds</span>
                {!selected.user_exists && <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">No publisher with this email yet</span>}
              </div>
              <div className="flex justify-end">
                <button onClick={deleteConfig} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
              </div>
            </div>

            {/* Questions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">Questions</h4>
              </div>
              {selected.questions?.map((q, idx) => (
                <div key={q._id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Q{idx + 1}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${q.status === 'ready' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                        {q.status === 'ready' ? 'âš¡ Ready to send' : 'âœï¸ To refine'}
                      </span>
                      <button onClick={() => setEditingQ(editingQ?._id === q._id ? null : { ...q })} className="text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => deleteQuestion(q._id)} className="text-muted-foreground hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  {editingQ?._id === q._id ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1">Raw note</p>
                          <textarea value={editingQ.raw_note} onChange={e => setEditingQ({ ...editingQ, raw_note: e.target.value })} rows={2}
                            placeholder="Rough idea" className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-background resize-none focus:outline-none" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1">Question the publisher sees</p>
                          <textarea value={editingQ.question_text} onChange={e => setEditingQ({ ...editingQ, question_text: e.target.value })} rows={2}
                            className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-background resize-none focus:outline-none" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1">Answer type</p>
                          <select value={editingQ.answer_type} onChange={e => setEditingQ({ ...editingQ, answer_type: e.target.value as any })}
                            className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-background">
                            <option value="text">Free text</option>
                            <option value="choice">Pick from options</option>
                            <option value="yesno">Yes / No</option>
                          </select>
                        </div>
                        {editingQ.answer_type === 'choice' && (
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-1">Options (comma separated)</p>
                            <input value={editingQ.options.join(', ')} onChange={e => setEditingQ({ ...editingQ, options: e.target.value.split(',').map(o => o.trim()) })}
                              className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-background focus:outline-none" />
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditingQ(null)} className="text-xs border border-border rounded-lg px-3 py-1.5 hover:bg-muted">Cancel</button>
                        <button onClick={() => saveQuestion(editingQ)} className="text-xs bg-primary text-primary-foreground rounded-lg px-3 py-1.5 hover:bg-primary/90">Save</button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><p className="text-muted-foreground mb-0.5 text-[10px]">Raw note</p><p>{q.raw_note || <span className="italic text-muted-foreground">empty</span>}</p></div>
                      <div><p className="text-muted-foreground mb-0.5 text-[10px]">Question the publisher sees</p><p>{q.question_text || <span className="italic text-muted-foreground">empty</span>}</p></div>
                      <div><p className="text-muted-foreground mb-0.5 text-[10px]">Answer type</p><p className="capitalize">{q.answer_type}</p></div>
                      {q.options?.length > 0 && <div><p className="text-muted-foreground mb-0.5 text-[10px]">Options</p><p>{q.options.join(', ')}</p></div>}
                    </div>
                  )}
                </div>
              ))}
              {/* Add question */}
              <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold">+ Add question</p>
                <div className="grid grid-cols-2 gap-2">
                  <textarea value={newQ.raw_note} onChange={e => setNewQ({ ...newQ, raw_note: e.target.value })} rows={2}
                    placeholder="Rough idea" className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background resize-none focus:outline-none" />
                  <textarea value={newQ.question_text} onChange={e => setNewQ({ ...newQ, question_text: e.target.value })} rows={2}
                    placeholder="Question the publisher sees" className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background resize-none focus:outline-none" />
                </div>
                <div className="flex items-center gap-2">
                  <select value={newQ.answer_type} onChange={e => setNewQ({ ...newQ, answer_type: e.target.value as any })}
                    className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background">
                    <option value="text">Free text</option>
                    <option value="choice">Pick from options</option>
                    <option value="yesno">Yes / No</option>
                  </select>
                  {newQ.answer_type === 'choice' && (
                    <input value={newQ.options} onChange={e => setNewQ({ ...newQ, options: e.target.value })}
                      placeholder="Options (comma separated)" className="flex-1 text-xs border border-border rounded-lg px-2 py-1.5 bg-background focus:outline-none" />
                  )}
                  <button onClick={addQuestion} disabled={addingQ || !newQ.question_text.trim()}
                    className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-primary/90 disabled:opacity-50">
                    {addingQ ? '...' : 'Add'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add publisher modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowAdd(false)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Add publisher</h2>
              <button onClick={() => setShowAdd(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Email</label>
                <input value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })}
                  placeholder="publisher@example.com"
                  className="w-full mt-1 text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                <p className="text-[10px] text-muted-foreground mt-1">Questions fire in chats from the publisher with this email.</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Name</label>
                <input value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full mt-1 text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Website</label>
                <input value={addForm.website} onChange={e => setAddForm({ ...addForm, website: e.target.value })}
                  placeholder="example.com"
                  className="w-full mt-1 text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Raw notes</label>
                <textarea value={addForm.raw_notes} onChange={e => setAddForm({ ...addForm, raw_notes: e.target.value })}
                  placeholder={'checked your site .. is it paid or free\nwhat traffic you have'} rows={4}
                  className="w-full mt-1 text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
                <p className="text-[10px] text-muted-foreground mt-0.5">One question idea per line. Rough is fine.</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm border border-border rounded-xl hover:bg-muted">Cancel</button>
              <button onClick={createPublisher} disabled={saving} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50">
                {saving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// â”€â”€ OFFER CHECK TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const OfferCheckTab: FC = () => {
  const [text, setText] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{
    detected_format: string; rows_read: number;
    results: OfferCheckResult[]; missing: { searched_term: string }[];
  } | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<OfferCheckResult | null>(null);
  const [detailTab, setDetailTab] = useState<'conversions' | 'clicks' | 'publishers' | 'geo'>('conversions');

  const SAMPLE = `ML-00001\nCoin Master\nBlood and Soul`;

  const check = async () => {
    if (!text.trim()) return toast.error('Enter an offer name or ID');
    setChecking(true);
    setSelectedOffer(null);
    const r = await offerCheckApi.check(text);
    if (r.success) {
      setResult(r);
      if (r.results?.length === 1) setSelectedOffer(r.results[0]);
    } else toast.error((r as any).error || 'Check failed');
    setChecking(false);
  };

  const fmtTime = (iso: string) => {
    if (!iso) return '';
    try { return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }); }
    catch { return iso; }
  };

  const statusColor = (s: string) => {
    if (['active', 'running', 'rotating'].includes(s)) return 'bg-green-100 text-green-700';
    if (s === 'paused') return 'bg-amber-100 text-amber-700';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: search + result list */}
      <div className={`${selectedOffer ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-shrink-0 flex-col border-r border-border`}>
        <div className="p-4 border-b border-border space-y-3">
          <div>
            <h2 className="font-bold text-base">Offer Check</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Enter offer name or ML-ID. See full click & conversion history.</p>
          </div>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={4}
            placeholder={'ML-00001\nCoin Master\nBlood and Soul'}
            className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none font-mono" />
          <div className="flex gap-2">
            <button onClick={check} disabled={checking}
              className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              <Search className="w-3.5 h-3.5" />{checking ? 'Checking...' : 'Check offers'}
            </button>
            <button onClick={() => setText(SAMPLE)} className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-xl px-3 py-2">Sample</button>
          </div>
          {result && (
            <p className="text-[10px] text-muted-foreground">
              {result.detected_format?.replace(/-/g, ' ')} Â· {result.rows_read} rows Â· {result.results.length} found Â· {result.missing.length} not found
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {/* Found */}
          {result?.results.map((r, i) => (
            <button key={i} onClick={() => { setSelectedOffer(r); setDetailTab('conversions'); }}
              className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${selectedOffer?.offer_id === r.offer_id ? 'bg-primary/5 border-l-2 border-primary' : ''}`}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="font-semibold text-sm truncate">{r.name}</p>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ${statusColor(r.status || '')}`}>{r.status}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">{r.offer_id} Â· ${r.payout}</p>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-[10px] text-muted-foreground"><span className="font-semibold text-foreground">{r.total_clicks?.toLocaleString()}</span> clicks</span>
                <span className="text-[10px] text-muted-foreground"><span className="font-semibold text-green-600">{r.total_conversions?.toLocaleString()}</span> convs</span>
                <span className="text-[10px] text-muted-foreground"><span className="font-semibold text-blue-600">{r.cvr}%</span> CVR</span>
              </div>
            </button>
          ))}
          {/* Missing */}
          {result?.missing.map((m, i) => (
            <div key={i} className="px-4 py-2.5 opacity-50">
              <p className="text-sm text-muted-foreground line-through">{m.searched_term}</p>
              <p className="text-[10px] text-red-500">Not found in inventory</p>
            </div>
          ))}
          {!result && !checking && (
            <div className="p-6 text-center text-muted-foreground">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-xs">Enter an offer to see full performance data</p>
            </div>
          )}
        </div>
      </div>

      {/* Right: offer intelligence detail */}
      <div className={`${selectedOffer ? 'flex' : 'hidden md:flex'} flex-1 flex-col overflow-hidden`}>
        {!selectedOffer ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Database className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">Select an offer</p>
              <p className="text-xs mt-1">Click and conversion history will appear here</p>
            </div>
          </div>
        ) : (
          <>
            {/* Offer header */}
            <div className="px-5 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedOffer(null)} className="md:hidden"><ArrowLeft className="w-4 h-4" /></button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-lg">{selectedOffer.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusColor(selectedOffer.status || '')}`}>{selectedOffer.status}</span>
                    <span className="text-xs text-muted-foreground">{selectedOffer.offer_id}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 flex-wrap">
                    <span className="text-xs text-muted-foreground">Payout: <span className="font-semibold text-foreground">${selectedOffer.payout}</span></span>
                    <span className="text-xs text-muted-foreground">Via: <span className="font-semibold">{selectedOffer.via}</span></span>
                    <span className="text-xs text-muted-foreground">{selectedOffer.vertical}</span>
                    {selectedOffer.countries?.slice(0, 5).map(c => (
                      <span key={c} className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">{c}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* KPI row */}
              <div className="grid grid-cols-4 gap-3 mt-4">
                {[
                  { label: 'Total Clicks', value: (selectedOffer.total_clicks || 0).toLocaleString(), color: 'text-foreground' },
                  { label: 'Conversions', value: (selectedOffer.total_conversions || 0).toLocaleString(), color: 'text-green-600' },
                  { label: 'Revenue', value: `$${(selectedOffer.total_revenue || 0).toFixed(2)}`, color: 'text-blue-600' },
                  { label: 'CVR', value: `${selectedOffer.cvr || 0}%`, color: 'text-violet-600' },
                ].map(kpi => (
                  <div key={kpi.label} className="bg-muted/30 rounded-xl px-3 py-2.5 border border-border">
                    <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
                    <p className={`text-xl font-bold mt-0.5 ${kpi.color}`}>{kpi.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Detail tabs */}
            <div className="flex border-b border-border px-4 bg-muted/10">
              {(['conversions', 'clicks', 'publishers', 'geo'] as const).map(t => (
                <button key={t} onClick={() => setDetailTab(t)}
                  className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors capitalize ${detailTab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                  {t === 'conversions' ? `Conversions (${selectedOffer.recent_conversions?.length || 0})` :
                   t === 'clicks' ? `Clicks (${selectedOffer.recent_clicks?.length || 0})` :
                   t === 'publishers' ? `Publishers (${selectedOffer.publishers?.length || 0})` :
                   `GEOs (${selectedOffer.geo_breakdown?.length || 0})`}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
              {/* Conversions */}
              {detailTab === 'conversions' && (
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 sticky top-0">
                    <tr>{['Time', 'Publisher', 'Payout', 'Country', 'Device', 'Status', 'Verified', 'Source'].map(h => (
                      <th key={h} className="text-left text-[10px] font-semibold text-muted-foreground px-4 py-2 whitespace-nowrap">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {!selectedOffer.recent_conversions?.length ? (
                      <tr><td colSpan={8} className="text-center py-8 text-xs text-muted-foreground">No conversions recorded</td></tr>
                    ) : selectedOffer.recent_conversions.map((c, i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="px-4 py-2 text-[10px] text-muted-foreground whitespace-nowrap">{fmtTime(c.time)}</td>
                        <td className="px-4 py-2 text-xs font-medium">{c.publisher}</td>
                        <td className="px-4 py-2 text-xs text-green-600 font-semibold">${c.payout.toFixed(2)}</td>
                        <td className="px-4 py-2 text-xs">{c.country}</td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">{c.device}</td>
                        <td className="px-4 py-2">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${c.status === 'approved' ? 'bg-green-100 text-green-700' : c.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{c.status || 'pending'}</span>
                        </td>
                        <td className="px-4 py-2 text-xs">{c.verified ? 'âœ…' : 'â€”'}</td>
                        <td className="px-4 py-2 text-[10px] text-muted-foreground">{c.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Clicks */}
              {detailTab === 'clicks' && (
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 sticky top-0">
                    <tr>{['Time', 'Click ID', 'Publisher', 'GEO', 'Device', 'Fraud Score', 'Placement'].map(h => (
                      <th key={h} className="text-left text-[10px] font-semibold text-muted-foreground px-4 py-2 whitespace-nowrap">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {!selectedOffer.recent_clicks?.length ? (
                      <tr><td colSpan={7} className="text-center py-8 text-xs text-muted-foreground">No clicks recorded</td></tr>
                    ) : selectedOffer.recent_clicks.map((c, i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="px-4 py-2 text-[10px] text-muted-foreground whitespace-nowrap">{fmtTime(c.time)}</td>
                        <td className="px-4 py-2 text-[10px] font-mono text-muted-foreground">{c.click_id?.slice(0, 12)}...</td>
                        <td className="px-4 py-2 text-xs">{c.publisher_id}</td>
                        <td className="px-4 py-2 text-xs font-semibold">{c.geo}</td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">{c.device}</td>
                        <td className="px-4 py-2">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${(c.fraud_score || 0) > 70 ? 'bg-red-100 text-red-700' : (c.fraud_score || 0) > 40 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                            {c.fraud_score || 0}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-[10px] text-muted-foreground">{c.placement_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Publishers */}
              {detailTab === 'publishers' && (
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 sticky top-0">
                    <tr>{['Publisher', 'Conversions', 'Revenue', 'Placements'].map(h => (
                      <th key={h} className="text-left text-[10px] font-semibold text-muted-foreground px-4 py-2">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {!selectedOffer.publishers?.length ? (
                      <tr><td colSpan={4} className="text-center py-8 text-xs text-muted-foreground">No publisher data</td></tr>
                    ) : selectedOffer.publishers.map((p, i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-full ${avatarColor(p.publisher)} flex items-center justify-center flex-shrink-0`}>
                              <span className="text-[9px] font-bold text-white">{initials(p.publisher)}</span>
                            </div>
                            <span className="text-sm font-medium">{p.publisher}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-green-600">{p.conversions}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-blue-600">${p.revenue.toFixed(2)}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{p.placements.join(', ') || 'â€”'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* GEO */}
              {detailTab === 'geo' && (
                <div className="p-5 space-y-2">
                  {!selectedOffer.geo_breakdown?.length ? (
                    <p className="text-center py-8 text-xs text-muted-foreground">No GEO data</p>
                  ) : (() => {
                    const max = Math.max(...selectedOffer.geo_breakdown!.map(g => g.count));
                    return selectedOffer.geo_breakdown!.map((g, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-sm font-semibold w-12 flex-shrink-0">{g.country}</span>
                        <div className="flex-1 bg-muted rounded-full h-2">
                          <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${(g.count / max) * 100}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-10 text-right flex-shrink-0">{g.count}</span>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// â”€â”€ QUICK LINKS TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const QuickLinksTab: FC = () => {
  const [links, setLinks] = useState<QuickLink[]>([]);
  const [canned, setCanned] = useState<CannedReply[]>([]);
  const [editLink, setEditLink] = useState<QuickLink | null>(null);
  const [editCanned, setEditCanned] = useState<CannedReply | null>(null);
  const [newLink, setNewLink] = useState({ title: '', url: '', description: '' });
  const [newCanned, setNewCanned] = useState({ title: '', text: '' });
  const [addingLink, setAddingLink] = useState(false);
  const [addingCanned, setAddingCanned] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [showCannedForm, setShowCannedForm] = useState(false);

  useEffect(() => {
    quickLinksApi.list().then(r => { if (r.success) setLinks(r.links); });
    supportApi.getCannedReplies().then(r => { if (r.success) setCanned(r.canned_replies); });
  }, []);

  const saveLink = async () => {
    if (!newLink.title || !newLink.url) return toast.error('Title and URL required');
    setAddingLink(true);
    if (editLink) {
      await quickLinksApi.update(editLink._id, newLink);
      setLinks(p => p.map(l => l._id === editLink._id ? { ...l, ...newLink } : l));
      toast.success('Updated');
    } else {
      const r = await quickLinksApi.create(newLink);
      if (r.success) { setLinks(p => [...p, r.link]); toast.success('Link added'); }
    }
    setNewLink({ title: '', url: '', description: '' }); setEditLink(null); setShowLinkForm(false); setAddingLink(false);
  };

  const delLink = async (id: string) => {
    await quickLinksApi.delete(id); setLinks(p => p.filter(l => l._id !== id)); toast.success('Deleted');
  };

  const saveCanned = async () => {
    if (!newCanned.title || !newCanned.text) return toast.error('Title and text required');
    setAddingCanned(true);
    if (editCanned) {
      await supportApi.updateCannedReply(editCanned._id, newCanned.title, newCanned.text);
      setCanned(p => p.map(c => c._id === editCanned._id ? { ...c, ...newCanned } : c));
      toast.success('Updated');
    } else {
      const r = await supportApi.createCannedReply(newCanned.title, newCanned.text);
      if (r.success) { setCanned(p => [...p, r.canned_reply]); toast.success('Reply added'); }
    }
    setNewCanned({ title: '', text: '' }); setEditCanned(null); setShowCannedForm(false); setAddingCanned(false);
  };

  const delCanned = async (id: string) => {
    await supportApi.deleteCannedReply(id); setCanned(p => p.filter(c => c._id !== id)); toast.success('Deleted');
  };

  const startEditLink = (l: QuickLink) => { setEditLink(l); setNewLink({ title: l.title, url: l.url, description: l.description }); setShowLinkForm(true); };
  const startEditCanned = (c: CannedReply) => { setEditCanned(c); setNewCanned({ title: c.title, text: c.text }); setShowCannedForm(true); };

  // Note: forms are inlined in JSX (not sub-components) to avoid focus loss on re-render

  return (
    <div className="flex-1 overflow-y-auto px-5 py-5 max-w-5xl">
      <h2 className="text-xl font-bold mb-1">Quick links and canned replies</h2>
      <p className="text-sm text-muted-foreground mb-5">These show up in the chat composer's Links and Canned menus.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Quick Links */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Quick links</span>
            </div>
            <button onClick={() => { setShowLinkForm(v => !v); setEditLink(null); setNewLink({ title: '', url: '', description: '' }); }}
              className="text-xs text-primary flex items-center gap-1 hover:underline"><Plus className="w-3.5 h-3.5" /> Add link</button>
          </div>
          <div className="divide-y divide-border">
            {showLinkForm && (
              <div className="px-4 py-3">
                <div className="bg-muted/30 border border-border rounded-xl p-3 space-y-2 mt-2">
                  <input value={newLink.title} onChange={e => setNewLink(p => ({ ...p, title: e.target.value }))} placeholder="Title" className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none" />
                  <input value={newLink.url} onChange={e => setNewLink(p => ({ ...p, url: e.target.value }))} placeholder="https://..." className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none" />
                  <input value={newLink.description} onChange={e => setNewLink(p => ({ ...p, description: e.target.value }))} placeholder="Short description" className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none" />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setShowLinkForm(false); setEditLink(null); setNewLink({ title: '', url: '', description: '' }); }} className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted">Cancel</button>
                    <button onClick={saveLink} disabled={addingLink} className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">{addingLink ? '...' : editLink ? 'Update' : 'Add'}</button>
                  </div>
                </div>
              </div>
            )}
            {links.length === 0 && !showLinkForm && <p className="px-4 py-6 text-xs text-center text-muted-foreground">No quick links yet</p>}
            {links.map(l => (
              <div key={l._id} className="px-4 py-3 group">
                {editLink?._id === l._id && showLinkForm ? null : (
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{l.title}</p>
                      <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate block">{l.url}</a>
                      {l.description && <p className="text-xs text-muted-foreground mt-0.5">{l.description}</p>}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEditLink(l)} className="text-muted-foreground hover:text-foreground p-1"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => delLink(l._id)} className="text-muted-foreground hover:text-red-600 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Canned Replies */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Canned replies</span>
            </div>
            <button onClick={() => { setShowCannedForm(v => !v); setEditCanned(null); setNewCanned({ title: '', text: '' }); }}
              className="text-xs text-primary flex items-center gap-1 hover:underline"><Plus className="w-3.5 h-3.5" /> Add reply</button>
          </div>
          <div className="divide-y divide-border">
            {showCannedForm && (
              <div className="px-4 py-3">
                <div className="bg-muted/30 border border-border rounded-xl p-3 space-y-2 mt-2">
                  <input value={newCanned.title} onChange={e => setNewCanned(p => ({ ...p, title: e.target.value }))} placeholder="Title" className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none" />
                  <textarea value={newCanned.text} onChange={e => setNewCanned(p => ({ ...p, text: e.target.value }))} placeholder="Reply text..." rows={3} className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none resize-none" />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setShowCannedForm(false); setEditCanned(null); setNewCanned({ title: '', text: '' }); }} className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted">Cancel</button>
                    <button onClick={saveCanned} disabled={addingCanned} className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">{addingCanned ? '...' : editCanned ? 'Update' : 'Add'}</button>
                  </div>
                </div>
              </div>
            )}
            {canned.length === 0 && !showCannedForm && <p className="px-4 py-6 text-xs text-center text-muted-foreground">No canned replies yet</p>}
            {canned.map(c => (
              <div key={c._id} className="px-4 py-3 group">
                {editCanned?._id === c._id && showCannedForm ? null : (
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{c.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{c.text}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEditCanned(c)} className="text-muted-foreground hover:text-foreground p-1"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => delCanned(c._id)} className="text-muted-foreground hover:text-red-600 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// â”€â”€ SUBMITTED DATA TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SubmittedDataTab: FC = () => {
  const [sessions, setSessions] = useState<IntakeSession[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [topicFilter, setTopicFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewTab, setViewTab] = useState<'data' | 'session'>('data');

  const load = useCallback(async () => {
    setLoading(true);
    const r = await submittedDataApi.list({ q: search, topic: topicFilter, status: statusFilter });
    if (r.success) { setSessions(r.sessions); setTotal(r.total); }
    setLoading(false);
  }, [search, topicFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const TOPIC_OPTIONS = ['postback', 'iframe', 'offers', 'payment', 'signup', 'credit', 'other'];

  return (
    <div className="flex-1 overflow-y-auto px-5 py-5 max-w-5xl space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">What publishers told us</h2>
          <p className="text-sm text-muted-foreground">Every guided request, finished or not.</p>
        </div>
        <div className="flex gap-2">
          {(['data', 'session'] as const).map(t => (
            <button key={t} onClick={() => setViewTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${viewTab === t ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
              {t === 'data' ? 'Submitted Data' : 'Session Log'}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email or answers"
            className="pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none w-56" />
        </div>
        <select value={topicFilter} onChange={e => setTopicFilter(e.target.value)} className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background">
          <option value="">All topics</option>
          {TOPIC_OPTIONS.map(t => <option key={t} value={t}>{TOPIC_LABELS[t as SupportTopic] || t}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background">
          <option value="">All statuses</option>
          <option value="submitted">Submitted</option>
          <option value="abandoned">Abandoned</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              {['When', 'Publisher', 'Topic', 'Status', 'Answers'].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-xs text-muted-foreground">Loading...</td></tr>
            ) : sessions.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-xs text-muted-foreground">No sessions found</td></tr>
            ) : sessions.map(s => (
              <tr key={s._id} className="hover:bg-muted/20">
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{ago(s.created_at)}</td>
                <td className="px-4 py-3">
                  <p className="text-sm font-medium">{s.username}</p>
                  <p className="text-[10px] text-muted-foreground">{s.email}</p>
                </td>
                <td className="px-4 py-3">
                  {s.topic && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${TOPIC_COLORS[s.topic as SupportTopic] || 'bg-gray-100 text-gray-600'}`}>{TOPIC_LABELS[s.topic as SupportTopic] || s.topic}</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${s.status === 'submitted' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {s.status === 'submitted' ? 'Submitted' : 'Abandoned'}
                  </span>
                  {s.status === 'abandoned' && s.abandoned_at_question && (
                    <p className="text-[9px] text-muted-foreground mt-0.5">Left without answering: {s.abandoned_at_question}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs">
                  {Object.entries(s.answers || {}).slice(0, 3).map(([k, v]) => (
                    <span key={k} className="mr-2">{k}: <span className="text-foreground">{String(v).slice(0, 40)}</span></span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{total} total sessions</p>
    </div>
  );
};

// â”€â”€ ACTIVITY LOG TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ActivityLogTab: FC = () => {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [person, setPerson] = useState('');
  const [action, setAction] = useState('');
  const [days, setDays] = useState(7);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const r = await activityLogApi.list({ person, action, days, q: search });
    if (r.success) { setLogs(r.logs); setTotal(r.total); }
    setLoading(false);
  }, [person, action, days, search]);

  useEffect(() => { load(); }, [load]);

  const DAYS_OPTIONS = [{ v: 1, l: 'Last 24h' }, { v: 7, l: 'Last 7 days' }, { v: 30, l: 'Last 30 days' }, { v: 90, l: 'Last 90 days' }];

  return (
    <div className="flex-1 overflow-y-auto px-5 py-5 max-w-5xl space-y-4">
      <div>
        <h2 className="text-xl font-bold">Activity log</h2>
        <p className="text-sm text-muted-foreground">Every action by every person and by the system.</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search details"
            className="pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none w-48" />
        </div>
        <input value={person} onChange={e => setPerson(e.target.value)} placeholder="Everyone"
          className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background focus:outline-none w-32" />
        <input value={action} onChange={e => setAction(e.target.value)} placeholder="All actions"
          className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background focus:outline-none w-36" />
        <select value={days} onChange={e => setDays(Number(e.target.value))} className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background">
          {DAYS_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
        <button onClick={load} className="p-1.5 border border-border rounded-lg hover:bg-muted"><RefreshCw className="w-3.5 h-3.5" /></button>
      </div>
      <p className="text-xs text-muted-foreground">{total} actions</p>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              {['When', 'Who', 'Action', 'Details', 'Ticket'].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-xs text-muted-foreground">Loading...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-xs text-muted-foreground">No activity in this period</td></tr>
            ) : logs.map(l => (
              <tr key={l._id} className="hover:bg-muted/20">
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmt(l.created_at)}</td>
                <td className="px-4 py-3">
                  <p className="text-sm font-medium">{l.actor_name}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{l.actor_role}</p>
                </td>
                <td className="px-4 py-3 text-sm">{l.action}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">{l.details}</td>
                <td className="px-4 py-3 text-xs text-primary">{l.ticket_id || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// â”€â”€ TEAM PERMISSIONS TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TeamPermissionsTab: FC = () => {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [permKeys, setPermKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<{ _id: string; username: string; email: string; role: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [toggling, setToggling] = useState<string>('');

  useEffect(() => {
    teamPermissionsApi.list().then(r => { if (r.success) { setTeam(r.team); setPermKeys(r.permission_keys); } setLoading(false); });
  }, []);

  const toggle = async (userId: string, key: string, val: boolean) => {
    setToggling(`${userId}-${key}`);
    const r = await teamPermissionsApi.updateOne(userId, key, val);
    if (r.success) {
      setTeam(p => p.map(m => {
        if (m.user_id !== userId) return m;
        const perms = { ...m.permissions, [key]: val };
        return { ...m, permissions: perms, granted: Object.values(perms).filter(Boolean).length };
      }));
    } else toast.error('Failed to update permission');
    setToggling('');
  };

  const searchUsers = async (q: string) => {
    if (!q.trim()) return;
    setSearching(true);
    const r = await teamPermissionsApi.searchUsers(q);
    setUserResults(r.users || []);
    setSearching(false);
  };

  const addAdmin = async (userId: string) => {
    const r = await teamPermissionsApi.addAdmin(userId);
    if (r.success) {
      toast.success(`${r.username} is now an admin`);
      setShowAdd(false); setUserSearch(''); setUserResults([]);
      teamPermissionsApi.list().then(res => { if (res.success) { setTeam(res.team); setPermKeys(res.permission_keys); } });
    } else toast.error((r as any).error || 'Failed');
  };

  return (
    <div className="flex-1 overflow-y-auto px-5 py-5 max-w-5xl space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">Team permissions</h2>
          <p className="text-sm text-muted-foreground">Turn permissions on or off per admin. Super Admin always has everything.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Add admin
        </button>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : (
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 w-48">Admin</th>
                {permKeys.map(k => (
                  <th key={k} className="text-center text-[10px] font-semibold text-muted-foreground px-3 py-3 whitespace-nowrap">
                    {PERM_LABELS[k] || k}
                  </th>
                ))}
                <th className="text-center text-xs font-semibold text-muted-foreground px-3 py-3">Granted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {team.length === 0 ? (
                <tr><td colSpan={permKeys.length + 2} className="text-center py-8 text-xs text-muted-foreground">No admins yet. Add one above.</td></tr>
              ) : team.map(m => (
                <tr key={m.user_id} className="hover:bg-muted/10">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full ${avatarColor(m.username)} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-[10px] font-bold text-white">{initials(m.username)}</span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">{m.username}</p>
                        <p className="text-[10px] text-muted-foreground">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  {permKeys.map(k => {
                    const on = m.permissions[k] ?? true;
                    const isToggling = toggling === `${m.user_id}-${k}`;
                    return (
                      <td key={k} className="px-3 py-3 text-center">
                        <button onClick={() => toggle(m.user_id, k, !on)} disabled={isToggling}
                          className="mx-auto flex items-center justify-center disabled:opacity-50">
                          {on
                            ? <ToggleRight className="w-8 h-8 text-primary" />
                            : <ToggleLeft className="w-8 h-8 text-muted-foreground" />}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-3 py-3 text-center">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.granted === m.total ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {m.granted} of {m.total}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Changes apply immediately. Hidden buttons are also blocked in the logic layer; your API must enforce the same checks on the server.</p>

      {/* Add Admin Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setShowAdd(false); setUserSearch(''); setUserResults([]); }} />
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Add admin</h2>
              <button onClick={() => { setShowAdd(false); setUserSearch(''); setUserResults([]); }}><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-muted-foreground">Search for an existing publisher account to promote to admin.</p>
            <div className="flex gap-2">
              <input value={userSearch} onChange={e => setUserSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') searchUsers(userSearch); }}
                placeholder="Search by username or email"
                className="flex-1 text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none" />
              <button onClick={() => searchUsers(userSearch)} disabled={searching}
                className="px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted disabled:opacity-50">
                {searching ? '...' : <Search className="w-4 h-4" />}
              </button>
            </div>
            {userResults.length > 0 && (
              <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
                {userResults.map(u => (
                  <div key={u._id} className="flex items-center justify-between px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium">{u.username}</p>
                      <p className="text-xs text-muted-foreground">{u.email} Â· <span className="capitalize">{u.role}</span></p>
                    </div>
                    <button onClick={() => addAdmin(u._id)}
                      disabled={u.role === 'admin' || u.role === 'subadmin'}
                      className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-40">
                      {u.role === 'subadmin' ? 'Already admin' : u.role === 'admin' ? 'Super Admin' : 'Make admin'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// â”€â”€ SETTINGS TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SettingsTab: FC = () => {
  const [settings, setSettings] = useState<SupportSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supportSettingsApi.get().then(r => { if (r.success) setSettings(r.settings); });
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    const r = await supportSettingsApi.update(settings);
    if (r.success) toast.success('Settings saved');
    else toast.error('Failed to save');
    setSaving(false);
  };

  if (!settings) return <div className="p-8 text-sm text-muted-foreground">Loading...</div>;

  const Field = ({ label, desc, field, unit }: { label: string; desc: string; field: keyof SupportSettings; unit?: string }) => (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <div className="flex items-center gap-2">
        <input type="number" value={settings[field] as number}
          onChange={e => setSettings({ ...settings, [field]: Number(e.target.value) })}
          className="w-20 text-sm border border-border rounded-lg px-2 py-1.5 bg-background text-right focus:outline-none focus:ring-1 focus:ring-primary" />
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );

  const Toggle = ({ label, desc, field }: { label: string; desc: string; field: keyof SupportSettings }) => (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <button onClick={() => setSettings({ ...settings, [field]: !settings[field] })}>
        {settings[field]
          ? <ToggleRight className="w-10 h-10 text-primary" />
          : <ToggleLeft className="w-10 h-10 text-muted-foreground" />}
      </button>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto px-5 py-5 max-w-2xl space-y-5">
      <div>
        <h2 className="text-xl font-bold">Settings</h2>
        <p className="text-sm text-muted-foreground">Timers and automation for the whole support system.</p>
      </div>

      {/* Auto-close */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between border-b border-border pb-3 mb-1">
          <div>
            <p className="font-semibold">Auto-close</p>
          </div>
          <button onClick={() => setSettings({ ...settings, auto_close_enabled: !settings.auto_close_enabled })}>
            {settings.auto_close_enabled
              ? <ToggleRight className="w-10 h-10 text-primary" />
              : <ToggleLeft className="w-10 h-10 text-muted-foreground" />}
          </button>
        </div>
        <Field label="Close after no reply" desc={`Now: ${settings.auto_close_min >= 1440 ? `${Math.floor(settings.auto_close_min / 1440)} day` : `${settings.auto_close_min} minutes`}. Real value is ${settings.auto_close_min} (${Math.round(settings.auto_close_min / 60)} hours).`} field="auto_close_min" unit="minutes" />
        <div className="border-t border-border" />
        <Field label="Warn the publisher before closing" desc={`Now: ${settings.user_warn_min} minutes before. Real value is ${settings.user_warn_min}.`} field="user_warn_min" unit="minutes" />
        <div className="border-t border-border" />
        <Field label="Warn admins when a publisher waits" desc={`Now: after ${settings.admin_warn_min} hours. Real value is ${settings.admin_warn_min}.`} field="admin_warn_min" unit="minutes" />
      </div>

      {/* Smart Questions */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between border-b border-border pb-3 mb-1">
          <div>
            <p className="font-semibold">Smart Questions</p>
            <p className="text-xs text-muted-foreground mt-0.5">When off, nothing is auto-asked and the Start button is hidden.</p>
          </div>
          <button onClick={() => setSettings({ ...settings, smart_questions_enabled: !settings.smart_questions_enabled })}>
            {settings.smart_questions_enabled
              ? <ToggleRight className="w-10 h-10 text-primary" />
              : <ToggleLeft className="w-10 h-10 text-muted-foreground" />}
          </button>
        </div>
        <Field label="Auto-ask when nobody replies within" desc={`Real value is ${settings.sq_delay_sec}. Each publisher can override this.`} field="sq_delay_sec" unit="seconds" />
      </div>

      <button onClick={save} disabled={saving}
        className="w-full bg-primary text-primary-foreground py-2.5 rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
};


// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
const SuperAdminSupport: FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Build NAV based on role
  const NAV = ALL_NAV.filter(n =>
    isAdmin ? n.roles.includes('admin') : n.roles.includes('subadmin')
  );

  const [tab, setTab] = useState<Tab>('inbox');
  const [inboxUnread, setInboxUnread] = useState(0);
  const [staffUnread, setStaffUnread] = useState(0);
  const [assignmentCount, setAssignmentCount] = useState(0);

  // Poll unread counts
  useEffect(() => {
    const poll = async () => {
      try {
        if (isAdmin) {
          const r = await supportApi.adminGetAllMessages();
          if (r.success) setInboxUnread((r.messages || []).filter((m: SupportMessage) => !m.read_by_admin).length);
          const sr = await staffChatApi.getThreads();
          if (sr.success) setStaffUnread(sr.threads.reduce((s: number, t: StaffThread) => s + t.unread, 0));
        } else {
          // Subadmin: check unread staff messages from admin
          const sr = await staffChatApi.myGetMessages();
          if (sr.success) {
            const unreadCount = sr.messages.filter(
              (m: StaffMessage) => !m.seen && m.sender_role === 'admin'
            ).length;
            setStaffUnread(unreadCount);
          }
          // Check assignments count
          const ar = await subadminSupportApi.getMyAssignments();
          if (ar.success) setAssignmentCount(ar.tickets.length);
        }
      } catch { /* silent */ }
    };
    poll();
    const iv = setInterval(poll, 60_000);
    return () => clearInterval(iv);
  }, [isAdmin]);

  const badgeFor = (id: Tab) => {
    if (id === 'inbox' && inboxUnread > 0) return inboxUnread;
    if (id === 'staff' && staffUnread > 0) return staffUnread;
    if (id === 'myassignments' && assignmentCount > 0) return assignmentCount;
    return 0;
  };

  return (
    <div className="flex bg-background overflow-hidden -m-3 sm:-m-4 md:-m-6" style={{ height: 'calc(100vh - 56px)' }}>
      {/* Left sidebar */}
      <div className="w-52 flex-shrink-0 flex flex-col border-r border-border bg-card">
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">MoustacheLeads Support</span>
          </div>
        </div>
        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV.map(n => {
            const badge = badgeFor(n.id);
            return (
              <button key={`${n.id}-${n.label}`}
                onClick={() => n.href ? (window.location.href = n.href) : setTab(n.id)}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${tab === n.id && !n.href ? 'text-primary font-semibold bg-primary/5' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}>
                <n.icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left truncate">{n.label}</span>
                {badge > 0 && (
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-bold flex-shrink-0">{badge > 9 ? '9+' : badge}</span>
                )}
              </button>
            );
          })}
          {/* Assignment count badge shown on My assignments nav item (already in NAV) */}
        </nav>
        {/* User info */}
        <div className="px-4 py-3 border-t border-border">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full ${avatarColor(user?.username || 'SA')} flex items-center justify-center`}>
              <span className="text-[10px] font-bold text-white">{initials(user?.username || 'SA')}</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">{user?.username || 'Admin'}</p>
              <p className="text-[10px] text-muted-foreground">{isAdmin ? 'Super Admin' : 'Admin'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {tab === 'inbox' && <InboxTab />}
        {/* Staff chat: admin sees all subadmin threads; subadmin sees single thread with Super Admin */}
        {tab === 'staff' && (isAdmin ? <StaffChatTab /> : <SubadminChatTab />)}
        {/* Smart Questions: admin can edit; subadmin is view-only */}
        {tab === 'smart' && (isAdmin ? <SmartQuestionsTab /> : <SmartQuestionsReadOnlyTab />)}
        {tab === 'offercheck' && isAdmin && <OfferCheckTab />}
        {tab === 'quicklinks' && <QuickLinksTab />}
        {tab === 'submitted' && <SubmittedDataTab />}
        {tab === 'sharednotes' && <SharedNotesTab />}
        {tab === 'myassignments' && <MyAssignmentsTab />}
        {tab === 'activitylog' && isAdmin && <ActivityLogTab />}
        {tab === 'teamperms' && isAdmin && <TeamPermissionsTab />}
        {tab === 'settings' && isAdmin && <SettingsTab />}
      </div>
    </div>
  );
};

export default SuperAdminSupport;
