import { useEffect, useState, useRef, useCallback, type FC } from 'react';
import {
  MessageCircle, Send, RefreshCw, Mail, MailOpen, Clock, CheckCircle, PenSquare,
  X, Users, User, Search, XCircle, ArrowLeft, Image, Eye, Trash2, CheckSquare,
  Square, StickyNote, ChevronDown, BookOpen, Plus, Pencil, ThumbsUp, ThumbsDown,
  Tag, Filter, Flag, UserCircle, History, EyeOff, Link2, Calendar, ChevronRight,
  AlertTriangle, RotateCcw, UserCheck, Shield, Inbox, Zap
} from 'lucide-react';
import {
  supportApi, SupportMessage, SupportCounts, SupportNote, CannedReply,
  SupportTopic, TOPIC_LABELS, TOPIC_COLORS
} from '@/services/supportApi';
import { getApiBaseUrl } from '@/services/apiConfig';
import { getAuthToken } from '@/utils/cookies';
import { toast } from 'sonner';
import { useImagePaste } from '@/hooks/useImagePaste';
import { useAuth } from '@/contexts/AuthContext';

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
const agoShort = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

// â”€â”€ WhatsApp paste cleaner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function cleanWhatsApp(raw: string): string {
  const lines = raw.split('\n');
  const cleaned: string[] = [];
  for (const line of lines) {
    // Remove "DD/MM/YYYY, HH:MM - Name: message" or "[DD/MM/YY, HH:MM:SS] Name: message"
    const stripped = line
      .replace(/^\[?\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?\]?\s*-?\s*/i, '')
      .replace(/^[A-Za-z0-9\s]+:\s/, '')
      .trim();
    if (stripped) cleaned.push(stripped);
  }
  return cleaned.join('\n');
}

const isWhatsApp = (text: string) =>
  /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4},?\s+\d{1,2}:\d{2}/.test(text);

// â”€â”€ SLA countdown â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function useSlaCountdown(createdAt: string, slaMinutes: number) {
  const deadline = new Date(createdAt).getTime() + slaMinutes * 60000;
  const [remaining, setRemaining] = useState(deadline - Date.now());
  useEffect(() => {
    const iv = setInterval(() => setRemaining(deadline - Date.now()), 30000);
    return () => clearInterval(iv);
  }, [deadline]);
  return remaining;
}

type FilterType = 'all' | 'new' | 'open' | 'replied' | 'closed' | 'draft';

const StatusBadge: FC<{ status: SupportMessage['status']; readByAdmin?: boolean }> = ({ status, readByAdmin }) => {
  if (status === 'open' && !readByAdmin)
    return <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-red-100 text-red-700">New</span>;
  const map = { open: 'bg-yellow-100 text-yellow-700', replied: 'bg-green-100 text-green-700', closed: 'bg-gray-100 text-gray-600' };
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold capitalize ${map[status]}`}>{status}</span>;
};

// â”€â”€ MODALS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Flag user modal
const FlagModal: FC<{
  userId: string; username: string; currentlyFlagged: boolean;
  onClose: () => void; onDone: (flagged: boolean) => void;
}> = ({ userId, username, currentlyFlagged, onClose, onDone }) => {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const action = currentlyFlagged ? 'Unflag' : 'Flag';

  const submit = async () => {
    setSaving(true);
    const res = await supportApi.flagUser(userId, !currentlyFlagged, reason);
    if (res.success) { toast.success(`${action}ged ${username}`); onDone(!currentlyFlagged); onClose(); }
    else toast.error(res.error || 'Failed');
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <Flag className={`w-4 h-4 ${currentlyFlagged ? 'text-muted-foreground' : 'text-red-500'}`} />
            {action} {username}
          </h2>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        {!currentlyFlagged && (
          <>
            <p className="text-sm text-muted-foreground">Flagging marks this publisher for attention. Optional reason:</p>
            <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (optional)..." rows={3}
              className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-background focus:outline-none resize-none" />
          </>
        )}
        {currentlyFlagged && <p className="text-sm text-muted-foreground">Remove the flag from this publisher?</p>}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-xl hover:bg-muted">Cancel</button>
          <button onClick={submit} disabled={saving}
            className={`px-4 py-2 text-sm rounded-xl font-medium text-white disabled:opacity-50 ${currentlyFlagged ? 'bg-gray-600 hover:bg-gray-700' : 'bg-red-600 hover:bg-red-700'}`}>
            {saving ? '...' : `${action} user`}
          </button>
        </div>
      </div>
    </div>
  );
};

// Notes modal with WhatsApp cleaner
const NotesModal: FC<{
  messageId: string; onClose: () => void;
}> = ({ messageId, onClose }) => {
  const [notes, setNotes] = useState<SupportNote[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    supportApi.getNotes(messageId).then(r => { if (r.success) setNotes(r.notes); setLoading(false); });
  }, [messageId]);

  const handlePaste = (raw: string) => {
    if (isWhatsApp(raw)) { setText(cleanWhatsApp(raw)); toast.success('WhatsApp format cleaned up'); }
  };

  const addNote = async () => {
    if (!text.trim()) return;
    setAdding(true);
    const res = await supportApi.addNote(messageId, text.trim());
    if (res.success) { setNotes(p => [...p, res.note]); setText(''); toast.success('Note saved'); }
    else toast.error('Failed');
    setAdding(false);
  };

  const deleteNote = async (noteId: string) => {
    const res = await supportApi.deleteNote(messageId, noteId);
    if (res.success) { setNotes(p => p.filter(n => n._id !== noteId)); toast.success('Deleted'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold flex items-center gap-2"><StickyNote className="w-4 h-4 text-amber-500" /> Internal notes</h2>
            <p className="text-xs text-amber-600 mt-0.5">Only the team sees notes. Paste a WhatsApp chat and it gets cleaned up.</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-2">
          <textarea value={text} onChange={e => setText(e.target.value)}
            onPaste={e => { const raw = e.clipboardData.getData('text'); if (isWhatsApp(raw)) { e.preventDefault(); handlePaste(raw); } }}
            placeholder="Add a note or paste a WhatsApp chat" rows={3}
            className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-background focus:outline-none resize-none" />
          <button onClick={addNote} disabled={adding || !text.trim()}
            className="w-full bg-primary text-primary-foreground py-2 rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
            {adding ? 'Saving...' : 'Save note'}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          {loading ? <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
            : notes.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">No notes yet</p>
            : notes.map(n => (
              <div key={n._id} className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 group">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-amber-800">{n.author_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-amber-600">{fmt(n.created_at)}</span>
                    <button onClick={() => deleteNote(n._id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
                <p className="text-sm text-amber-900 whitespace-pre-wrap">{n.text}</p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

// Audit modal
const AuditModal: FC<{ messageId: string; onClose: () => void }> = ({ messageId, onClose }) => {
  const [audit, setAudit] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supportApi.getTicketAudit(messageId).then(r => { if (r.success) setAudit(r.audit); setLoading(false); });
  }, [messageId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold flex items-center gap-2"><History className="w-4 h-4" /> Ticket audit</h2>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading ? <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
            : audit.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">No audit entries yet</p>
            : audit.map((entry, i) => (
              <div key={entry._id || i} className="flex items-start gap-3 border-b border-border pb-3 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{entry.action}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.actor_name}
                    <span className="ml-1 text-[10px] bg-muted px-1 py-0.5 rounded capitalize">{entry.actor_role}</span>
                  </p>
                  {entry.detail && <p className="text-xs text-muted-foreground mt-0.5">{entry.detail}</p>}
                </div>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">{agoShort(entry.created_at)}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

// Profile modal
const ProfileModal: FC<{ userId: string; username: string; onClose: () => void }> = ({ userId, username, onClose }) => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supportApi.getPublisherProfile(userId).then(r => { if (r.success) setProfile(r); setLoading(false); });
  }, [userId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-xl mx-4 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold flex items-center gap-2"><UserCircle className="w-4 h-4" /> {username}</h2>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading ? <p className="text-xs text-muted-foreground text-center py-8">Loading profile...</p>
            : !profile ? <p className="text-xs text-muted-foreground text-center py-8">Profile not found</p>
            : (
              <>
                {/* Basic info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: 'Email', value: profile.user.email },
                    { label: 'Role', value: profile.user.role },
                    { label: 'Status', value: profile.user.account_status || 'N/A' },
                    { label: 'Joined', value: profile.user.created_at ? fmt(profile.user.created_at) : 'N/A' },
                    { label: 'Postback URL', value: profile.user.postback_url || 'Not set' },
                    { label: 'Flagged', value: profile.user.flagged ? `Yes â€” ${profile.user.flag_reason || 'No reason'}` : 'No' },
                  ].map(r => (
                    <div key={r.label} className="bg-muted/30 rounded-xl p-3">
                      <p className="text-[10px] text-muted-foreground mb-0.5">{r.label}</p>
                      <p className="text-sm font-medium truncate">{r.value}</p>
                    </div>
                  ))}
                </div>

                {/* Stats */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Stats</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { l: 'Total Conversions', v: profile.stats.total_conversions },
                      { l: 'Pending Payout', v: `$${(profile.stats.pending_earnings || 0).toFixed(2)}` },
                      { l: 'This Month', v: `$${(profile.stats.current_month_earnings || 0).toFixed(2)}` },
                    ].map(s => (
                      <div key={s.l} className="bg-muted/30 rounded-xl p-3 text-center">
                        <p className="text-lg font-bold">{s.v}</p>
                        <p className="text-[10px] text-muted-foreground">{s.l}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Placements */}
                {profile.placements?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Placements</p>
                    <div className="space-y-2">
                      {profile.placements.map((p: any) => (
                        <div key={p._id} className="bg-muted/20 rounded-xl px-3 py-2.5 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{p.offerwallTitle || p.platformName}</p>
                            <p className="text-[10px] text-muted-foreground">{p.platformType} Â· {p.placementIdentifier}</p>
                          </div>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${p.status === 'LIVE' || p.status === 'APPROVED' ? 'bg-green-100 text-green-700' : p.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{p.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent tickets */}
                {profile.recent_tickets?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recent Tickets</p>
                    <div className="space-y-1.5">
                      {profile.recent_tickets.map((t: any) => (
                        <div key={t._id} className="flex items-center justify-between text-sm px-3 py-2 bg-muted/20 rounded-lg">
                          <span className="truncate">{t.subject}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ml-2 flex-shrink-0 ${t.status === 'open' ? 'bg-yellow-100 text-yellow-700' : t.status === 'closed' ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'}`}>{t.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
        </div>
      </div>
    </div>
  );
};

// Schedule reply modal
const ScheduleModal: FC<{
  messageId: string; replyText: string; onClose: () => void;
  onScheduled: () => void;
}> = ({ messageId, replyText, onClose, onScheduled }) => {
  const [text, setText] = useState(replyText);
  const [sendAt, setSendAt] = useState('');
  const [saving, setSaving] = useState(false);

  // Default to 2 hours from now
  useEffect(() => {
    const dt = new Date(Date.now() + 2 * 3600000);
    const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setSendAt(local);
  }, []);

  const submit = async () => {
    if (!text.trim()) return toast.error('Reply text is required');
    if (!sendAt) return toast.error('Please select a send time');
    setSaving(true);
    const iso = new Date(sendAt).toISOString();
    const res = await supportApi.scheduleReply(messageId, text, iso);
    if (res.success) { toast.success('Reply scheduled'); onScheduled(); onClose(); }
    else toast.error(res.error || 'Failed to schedule');
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" /> Schedule reply</h2>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={4}
          className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-background focus:outline-none resize-none" />
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Send at</label>
          <input type="datetime-local" value={sendAt} onChange={e => setSendAt(e.target.value)}
            className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-background focus:outline-none" />
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-xl hover:bg-muted">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
            <Calendar className="w-3.5 h-3.5" />{saving ? 'Scheduling...' : 'Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
};

// â”€â”€ MAIN COMPONENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const AdminSupportInbox: FC = () => {
  const { user: authUser } = useAuth();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [counts, setCounts] = useState<SupportCounts>({ total: 0, new: 0, open: 0, replied: 0, closed: 0, draft: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [selected, setSelected] = useState<SupportMessage | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const saveDraftTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [msgSearch, setMsgSearch] = useState('');
  const [topicFilter, setTopicFilter] = useState<SupportTopic | 'all'>('all');

  // Compose / broadcast
  const [showCompose, setShowCompose] = useState(false);
  const [allUsers, setAllUsers] = useState<{ _id: string; username: string; email: string }[]>([]);
  const [recipientMode, setRecipientMode] = useState<'all' | 'specific'>('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);

  // Image attach
  const [replyImageUrl, setReplyImageUrl] = useState('');
  const [replyUploading, setReplyUploading] = useState(false);
  const replyFileRef = useRef<HTMLInputElement>(null);

  // Multi-select bulk delete
  const [selectMode, setSelectMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  // Canned replies
  const [cannedReplies, setCannedReplies] = useState<CannedReply[]>([]);
  const [showCanned, setShowCanned] = useState(false);
  const [showManageCanned, setShowManageCanned] = useState(false);
  const [cannedForm, setCannedForm] = useState<{ id: string | null; title: string; text: string }>({ id: null, title: '', text: '' });
  const [savingCanned, setSavingCanned] = useState(false);

  // Quick links
  const [quickLinks, setQuickLinks] = useState<any[]>([]);
  const [showLinks, setShowLinks] = useState(false);

  // Team members for assign dropdown
  const [teamMembers, setTeamMembers] = useState<{ _id: string; username: string; email: string; role: string }[]>([]);
  const [showAssign, setShowAssign] = useState(false);
  const [assigning, setAssigning] = useState(false);

  // Show deleted replies
  const [showDeletedReplies, setShowDeletedReplies] = useState(false);
  const [deletedReplies, setDeletedReplies] = useState<any[]>([]);
  const [loadingDeleted, setLoadingDeleted] = useState(false);

  // Modals
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [flaggedStatus, setFlaggedStatus] = useState<Record<string, boolean>>({});

  // "What they told us" collapse
  const [showIntakeAnswers, setShowIntakeAnswers] = useState(true);

  // SLA settings (from support settings)
  const [slaMinutes] = useState(1440); // 24h default
  const [warnMinutes] = useState(120); // 2h warning

  // Draft sync
  useEffect(() => {
    if (messages.length === 0) return;
    const newDrafts: Record<string, string> = { ...drafts };
    let updated = false;
    messages.forEach(msg => {
      const storageKey = `admin_draft_${msg._id}`;
      const localVal = localStorage.getItem(storageKey);
      if (localVal) {
        if (newDrafts[msg._id] !== localVal) { newDrafts[msg._id] = localVal; updated = true; }
      } else if (msg.admin_draft) {
        localStorage.setItem(storageKey, msg.admin_draft);
        newDrafts[msg._id] = msg.admin_draft; updated = true;
      }
    });
    if (updated) setDrafts(newDrafts);
  }, [messages]);

  const handleReplyTextChange = (val: string) => {
    setReplyText(val);
    if (!selected) return;
    const storageKey = `admin_draft_${selected._id}`;
    const newDrafts = { ...drafts };
    if (val.trim()) {
      newDrafts[selected._id] = val;
      localStorage.setItem(storageKey, val);
      if (saveDraftTimeoutRef.current) clearTimeout(saveDraftTimeoutRef.current);
      saveDraftTimeoutRef.current = setTimeout(() => {
        supportApi.saveDraft(selected._id, val).catch(() => {});
      }, 1500);
    } else {
      delete newDrafts[selected._id];
      localStorage.removeItem(storageKey);
      if (saveDraftTimeoutRef.current) clearTimeout(saveDraftTimeoutRef.current);
      supportApi.deleteDraft(selected._id).catch(() => {});
    }
    setDrafts(newDrafts);
  };

  const handleManualSaveDraft = () => {
    if (!selected || !replyText.trim()) return;
    supportApi.saveDraft(selected._id, replyText).then(() => toast.success('Draft saved'));
  };

  const handleImageUpload = async (file: File) => {
    setReplyUploading(true);
    try {
      const res = await supportApi.uploadImage(file);
      if (res.success && res.image_url) { setReplyImageUrl(res.image_url); toast.success('Image uploaded'); }
      else toast.error(res.error || 'Upload failed');
    } catch { toast.error('Upload failed'); }
    finally { setReplyUploading(false); }
  };

  useImagePaste(
    (file) => { handleImageUpload(file); toast.success('Image pasted from clipboard'); },
    { enabled: !!selected, onError: (msg) => toast.error(msg) }
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const apiFilter = filter === 'new' ? 'open' : filter;
      const res = await supportApi.adminGetAll(apiFilter);
      if (res.success) {
        let msgs = res.messages;
        if (filter === 'new') msgs = msgs.filter(m => !m.read_by_admin);
        setMessages(msgs);
        if (res.counts) setCounts(res.counts);
        if (selected) {
          const updated = msgs.find(m => m._id === selected._id);
          if (updated) setSelected(updated);
        }
      }
    } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [filter]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [selected]);

  const openMessage = async (msg: SupportMessage) => {
    setSelected(msg);
    setShowDeletedReplies(false);
    setDeletedReplies([]);
    if (saveDraftTimeoutRef.current) clearTimeout(saveDraftTimeoutRef.current);
    setReplyText(drafts[msg._id] || '');
    // Load canned + quick links
    if (cannedReplies.length === 0) loadCannedReplies();
    if (quickLinks.length === 0) loadQuickLinks();
    if (teamMembers.length === 0) loadTeamMembers();
    // Load flag status
    try {
      const fl = await supportApi.getFlagStatus(msg.user_id);
      if (fl.success) setFlaggedStatus(p => ({ ...p, [msg.user_id]: fl.flagged }));
    } catch { /* silent */ }
    if (!msg.read_by_admin) {
      await supportApi.adminMarkRead(msg._id);
      setMessages(prev => prev.map(m => m._id === msg._id ? { ...m, read_by_admin: true } : m));
      setCounts(prev => ({ ...prev, new: Math.max(0, prev.new - 1) }));
    }
  };

  const loadCannedReplies = async () => {
    try { const res = await supportApi.getCannedReplies(); if (res.success) setCannedReplies(res.canned_replies); } catch { }
  };

  const loadQuickLinks = async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/superadmin/quick-links`, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
      });
      const data = await res.json();
      if (data.success) setQuickLinks(data.links);
    } catch { }
  };

  const loadTeamMembers = async () => {
    try { const res = await supportApi.getTeamMembers(); if (res.success) setTeamMembers(res.team); } catch { }
  };

  // â”€â”€ Action handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleReply = async () => {
    if (!selected || (!replyText.trim() && !replyImageUrl)) return;
    setReplying(true);
    try {
      const res = await supportApi.adminReply(selected._id, replyText, replyImageUrl || undefined);
      if (res.success) {
        toast.success('Reply sent');
        setReplyText(''); setReplyImageUrl('');
        const newDrafts = { ...drafts }; delete newDrafts[selected._id]; setDrafts(newDrafts);
        localStorage.removeItem(`admin_draft_${selected._id}`);
        if (saveDraftTimeoutRef.current) clearTimeout(saveDraftTimeoutRef.current);
        setSelected(res.message);
        setMessages(prev => prev.map(m => m._id === res.message._id ? res.message : m));
      } else toast.error(res.error || 'Failed to send reply');
    } finally { setReplying(false); }
  };

  const handleClose = async () => {
    if (!selected) return;
    try {
      const res = await supportApi.adminCloseV2(selected._id);
      if (res.success) {
        toast.success('Ticket closed');
        setSelected(res.message);
        setMessages(prev => prev.map(m => m._id === res.message._id ? res.message : m));
        setCounts(prev => ({ ...prev, closed: prev.closed + 1 }));
      } else toast.error(res.error || 'Failed');
    } catch { toast.error('Failed'); }
  };

  const handleReopen = async () => {
    if (!selected) return;
    try {
      const res = await supportApi.adminReopenTicket(selected._id);
      if (res.success) {
        toast.success('Ticket reopened');
        setSelected(res.message);
        setMessages(prev => prev.map(m => m._id === res.message._id ? res.message : m));
      } else toast.error(res.error || 'Failed');
    } catch { toast.error('Failed'); }
  };

  const handleAssign = async (memberId: string | null, memberName: string) => {
    if (!selected) return;
    setAssigning(true);
    try {
      const res = await supportApi.assignTicket(selected._id, memberId, memberName);
      if (res.success) {
        toast.success(`Assigned to ${memberName}`);
        setSelected(res.message);
        setMessages(prev => prev.map(m => m._id === res.message._id ? res.message : m));
        setShowAssign(false);
      } else toast.error(res.error || 'Failed');
    } catch { toast.error('Failed'); }
    finally { setAssigning(false); }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!confirm('Delete this entire conversation for everyone?')) return;
    try {
      const res = await supportApi.adminDeleteMessage(msgId);
      if (res.success) {
        toast.success('Deleted');
        if (selected?._id === msgId) setSelected(null);
        setMessages(prev => prev.filter(m => m._id !== msgId));
        setCounts(prev => ({ ...prev, total: Math.max(0, prev.total - 1) }));
        localStorage.removeItem(`admin_draft_${msgId}`);
        setDrafts(prev => { const n = { ...prev }; delete n[msgId]; return n; });
      } else toast.error(res.error || 'Failed');
    } catch { toast.error('Failed'); }
  };

  const handleDeleteReply = async (msgId: string, replyId: string) => {
    if (!confirm('Delete this message for everyone?')) return;
    try {
      const res = await supportApi.softDeleteReply(msgId, replyId);
      if (res.success) { toast.success('Reply deleted'); setSelected(res.message); setMessages(prev => prev.map(m => m._id === res.message._id ? res.message : m)); }
      else toast.error(res.error || 'Failed');
    } catch { toast.error('Failed'); }
  };

  const handleShowDeleted = async () => {
    if (!selected) return;
    setLoadingDeleted(true);
    setShowDeletedReplies(true);
    try {
      const res = await supportApi.getDeletedReplies(selected._id);
      if (res.success) setDeletedReplies(res.deleted_replies);
    } finally { setLoadingDeleted(false); }
  };

  const handleBulkDelete = async () => {
    if (selectedMsgIds.size === 0) return;
    if (!confirm(`Delete ${selectedMsgIds.size} conversation(s) for everyone?`)) return;
    setDeleting(true);
    try {
      const res = await supportApi.adminBulkDeleteMessages(Array.from(selectedMsgIds));
      if (res.success) {
        toast.success(`Deleted ${res.deleted_count}`);
        setMessages(prev => prev.filter(m => !selectedMsgIds.has(m._id)));
        if (selected && selectedMsgIds.has(selected._id)) setSelected(null);
        const newDrafts = { ...drafts }; selectedMsgIds.forEach(id => { localStorage.removeItem(`admin_draft_${id}`); delete newDrafts[id]; }); setDrafts(newDrafts);
        setSelectedMsgIds(new Set()); setSelectMode(false);
        setCounts(prev => ({ ...prev, total: Math.max(0, prev.total - res.deleted_count) }));
      } else toast.error(res.error || 'Failed');
    } catch { toast.error('Failed'); }
    finally { setDeleting(false); }
  };

  const toggleMsgSelect = (id: string) => {
    setSelectedMsgIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  // â”€â”€ Canned replies â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleSaveCanned = async () => {
    if (!cannedForm.title.trim() || !cannedForm.text.trim()) return toast.error('Title and text required');
    setSavingCanned(true);
    try {
      if (cannedForm.id) {
        const res = await supportApi.updateCannedReply(cannedForm.id, cannedForm.title, cannedForm.text);
        if (res.success) { setCannedReplies(prev => prev.map(c => c._id === cannedForm.id ? { ...c, title: cannedForm.title, text: cannedForm.text } : c)); toast.success('Saved'); }
      } else {
        const res = await supportApi.createCannedReply(cannedForm.title, cannedForm.text);
        if (res.success) { setCannedReplies(prev => [...prev, res.canned_reply]); toast.success('Created'); }
      }
      setCannedForm({ id: null, title: '', text: '' });
    } finally { setSavingCanned(false); }
  };
  const handleDeleteCanned = async (id: string) => {
    if (!confirm('Delete?')) return;
    const res = await supportApi.deleteCannedReply(id);
    if (res.success) { setCannedReplies(prev => prev.filter(c => c._id !== id)); toast.success('Deleted'); }
  };

  // â”€â”€ Broadcast â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const openCompose = async () => {
    setShowCompose(true); setBroadcastSubject(''); setBroadcastBody(''); setRecipientMode('all'); setSelectedUsers([]); setUserSearch(''); setUsersLoading(true);
    try { const res = await supportApi.adminGetUsers(); if (res.success) setAllUsers(res.users); } finally { setUsersLoading(false); }
  };
  const handleBroadcast = async () => {
    if (!broadcastBody.trim()) return toast.error('Message required');
    if (recipientMode === 'specific' && selectedUsers.length === 0) return toast.error('Select recipients');
    setBroadcasting(true);
    try {
      const res = await supportApi.adminBroadcast(broadcastSubject, broadcastBody, recipientMode === 'specific' ? selectedUsers : null);
      if (res.success) { toast.success(`Sent to ${res.sent_to} users`); setShowCompose(false); load(); }
      else toast.error(res.error || 'Failed');
    } finally { setBroadcasting(false); }
  };
  const toggleUser = (id: string) => setSelectedUsers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const filteredUsers = allUsers.filter(u => u.username.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase()));

  // â”€â”€ Filter tabs config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const filterTabs: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.total },
    { key: 'new', label: 'New', count: counts.new },
    { key: 'open', label: 'Open', count: counts.open },
    { key: 'replied', label: 'Replied', count: counts.replied },
    { key: 'closed', label: 'Closed', count: counts.closed },
    { key: 'draft', label: 'Draft', count: counts.draft || 0 },
  ];

  // â”€â”€ SLA helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const getSlaInfo = (msg: SupportMessage) => {
    if (msg.status === 'closed') return null;
    const deadline = new Date(msg.created_at).getTime() + slaMinutes * 60000;
    const remaining = deadline - Date.now();
    const warnThreshold = warnMinutes * 60000;
    if (remaining < 0) return { label: 'SLA breach', color: 'bg-red-600 text-white', remaining, breached: true };
    if (remaining < warnThreshold) return { label: formatRemaining(remaining), color: 'bg-amber-100 text-amber-700', remaining, breached: false };
    return null;
  };

  const formatRemaining = (ms: number) => {
    const m = Math.floor(Math.abs(ms) / 60000);
    const h = Math.floor(m / 60); const rm = m % 60;
    return h > 0 ? `${h}h ${rm}m` : `${rm}m`;
  };

  // â”€â”€ Filtered message list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const filteredMessages = (() => {
    const q = msgSearch.toLowerCase().trim();
    let list = q ? messages.filter(m =>
      (m.username || '').toLowerCase().includes(q) ||
      (m.email || '').toLowerCase().includes(q) ||
      (m.subject || '').toLowerCase().includes(q) ||
      (m.body || '').toLowerCase().includes(q)
    ) : messages;
    if (topicFilter !== 'all') list = list.filter(m => (m.topic || 'other') === topicFilter);
    return list;
  })();

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-primary" />
            Support Inbox
            {counts.new > 0 && <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{counts.new} new</span>}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">View and reply to publisher support messages</p>
        </div>
        <div className="flex items-center gap-2">
          {selectMode ? (
            <>
              <span className="text-sm text-muted-foreground">{selectedMsgIds.size} selected</span>
              <button onClick={handleBulkDelete} disabled={selectedMsgIds.size === 0 || deleting} className="flex items-center gap-2 text-sm bg-red-600 text-white rounded-lg px-4 py-2 hover:bg-red-700 disabled:opacity-50">
                <Trash2 className="w-4 h-4" />{deleting ? 'Deleting...' : 'Delete Selected'}
              </button>
              <button onClick={() => { setSelectMode(false); setSelectedMsgIds(new Set()); }} className="text-sm border border-border rounded-lg px-3 py-2 hover:bg-muted">Cancel</button>
            </>
          ) : (
            <>
              <button onClick={() => setSelectMode(true)} className="flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-2 hover:bg-muted"><CheckSquare className="w-4 h-4" /> Select</button>
              <button onClick={openCompose} className="flex items-center gap-2 text-sm bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:bg-primary/90 font-medium"><PenSquare className="w-4 h-4" /> Compose</button>
              <button onClick={load} className="flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-2 hover:bg-muted"><RefreshCw className="w-4 h-4" /> Refresh</button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total', value: counts.total, icon: MessageCircle, color: 'text-blue-600' },
          { label: 'New', value: counts.new, icon: Mail, color: 'text-red-600' },
          { label: 'Open', value: counts.open, icon: Clock, color: 'text-yellow-600' },
          { label: 'Replied', value: counts.replied, icon: CheckCircle, color: 'text-green-600' },
          { label: 'Closed', value: counts.closed, icon: XCircle, color: 'text-gray-500' },
          { label: 'Draft', value: counts.draft || 0, icon: PenSquare, color: 'text-purple-600' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
            <s.icon className={`w-7 h-7 ${s.color}`} />
            <div><p className="text-xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
          </div>
        ))}
      </div>

      {/* Main layout */}
      <div className="flex gap-4" style={{ height: '70vh', minHeight: 500 }}>

        {/* Left: message list */}
        <div className={`${selected ? 'hidden md:flex' : 'flex'} w-full md:w-96 flex-shrink-0 flex-col border border-border rounded-xl overflow-hidden bg-card`}>
          {/* Filter tabs */}
          <div className="flex gap-1.5 p-2 overflow-x-auto border-b border-border bg-muted/20 [&::-webkit-scrollbar]:hidden">
            {filterTabs.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 flex items-center gap-1 ${filter === f.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                {f.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filter === f.key ? 'bg-white/20' : 'bg-muted text-muted-foreground'}`}>{f.count}</span>
              </button>
            ))}
          </div>
          {/* Topic filter */}
          <div className="flex gap-1 px-2 py-1.5 overflow-x-auto border-b border-border bg-muted/10 [&::-webkit-scrollbar]:hidden">
            <button onClick={() => setTopicFilter('all')}
              className={`px-2 py-0.5 text-[10px] font-semibold rounded flex-shrink-0 ${topicFilter === 'all' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
              <Filter className="w-2.5 h-2.5 inline mr-0.5" />All
            </button>
            {(Object.keys(TOPIC_LABELS) as SupportTopic[]).map(t => (
              <button key={t} onClick={() => setTopicFilter(topicFilter === t ? 'all' : t)}
                className={`px-2 py-0.5 text-[10px] font-semibold rounded flex-shrink-0 ${topicFilter === t ? `${TOPIC_COLORS[t]}` : 'bg-muted text-muted-foreground'}`}>
                {TOPIC_LABELS[t]}
              </button>
            ))}
          </div>
          {/* Search */}
          <div className="px-3 py-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input type="text" placeholder="Search name, email, subject or message" value={msgSearch} onChange={e => setMsgSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
              {msgSearch && <button onClick={() => setMsgSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5 text-muted-foreground" /></button>}
            </div>
          </div>
          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {loading ? <div className="p-4 text-sm text-center text-muted-foreground">Loading...</div>
              : filteredMessages.length === 0 ? <div className="p-8 text-center text-muted-foreground text-sm">No messages</div>
              : filteredMessages.map(msg => {
                const sla = getSlaInfo(msg);
                return (
                  <div key={msg._id} className="flex items-start">
                    {selectMode && (
                      <button onClick={e => { e.stopPropagation(); toggleMsgSelect(msg._id); }} className="flex-shrink-0 p-3 self-center">
                        {selectedMsgIds.has(msg._id) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-muted-foreground" />}
                      </button>
                    )}
                    <button onClick={() => !selectMode ? openMessage(msg) : toggleMsgSelect(msg._id)}
                      className={`flex-1 text-left px-3 py-3 hover:bg-muted/50 transition-colors ${selected?._id === msg._id ? 'bg-primary/5 border-l-2 border-primary' : ''} ${selectedMsgIds.has(msg._id) ? 'bg-red-50' : ''}`}>
                      <div className="flex items-start justify-between gap-2 mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {!msg.read_by_admin ? <Mail className="w-3 h-3 text-red-500 flex-shrink-0" /> : <MailOpen className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                          <p className={`text-sm truncate ${!msg.read_by_admin ? 'font-bold' : 'font-medium'}`}>{msg.username || msg.email}</p>
                          {flaggedStatus[msg.user_id] && <Flag className="w-3 h-3 text-red-500 flex-shrink-0" />}
                        </div>
                        <StatusBadge status={msg.status} readByAdmin={msg.read_by_admin} />
                      </div>
                      {drafts[msg._id]
                        ? <p className="text-[11px] text-red-500 truncate">[Draft] {drafts[msg._id]}</p>
                        : <p className="text-[11px] text-muted-foreground truncate">{msg.subject}</p>}
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {msg.topic && <span className={`text-[9px] px-1 py-0.5 rounded font-semibold ${TOPIC_COLORS[msg.topic]}`}>{TOPIC_LABELS[msg.topic]}</span>}
                        {msg.assignee_name && <span className="text-[9px] text-muted-foreground">â†’ {msg.assignee_name}</span>}
                        {sla && <span className={`text-[9px] px-1 py-0.5 rounded font-semibold flex items-center gap-0.5 ${sla.color}`}><Clock className="w-2.5 h-2.5" />{sla.label}</span>}
                        <span className="text-[10px] text-muted-foreground ml-auto">{agoShort(msg.updated_at || msg.created_at)}</span>
                      </div>
                    </button>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Right: detail panel */}
        <div className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 flex-col border border-border rounded-xl overflow-hidden bg-card`}>
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Inbox className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Pick a ticket</p>
                <p className="text-xs mt-1 text-muted-foreground">Needs reply shows tickets where the publisher wrote last.<br />New and unread tickets float to the top.</p>
              </div>
            </div>
          ) : (
            <>
              {/* â”€â”€ Ticket header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
              <div className="px-4 py-3 border-b border-border">
                <div className="flex items-start gap-3">
                  <button onClick={() => setSelected(null)} className="md:hidden text-muted-foreground mt-1"><ArrowLeft className="w-4 h-4" /></button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-sm truncate">{selected.username}</h2>
                      {selected.topic && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${TOPIC_COLORS[selected.topic]}`}>{TOPIC_LABELS[selected.topic]}</span>}
                      {flaggedStatus[selected.user_id] && <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5"><Flag className="w-2.5 h-2.5" />Flagged</span>}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{selected.email} Â· {selected.subject}</p>
                  </div>
                </div>

                {/* Action buttons row */}
                <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                  <button onClick={() => setShowFlagModal(true)}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${flaggedStatus[selected.user_id] ? 'bg-red-50 border-red-200 text-red-600' : 'border-border hover:bg-muted text-muted-foreground hover:text-foreground'}`}>
                    <Flag className="w-3 h-3" /> {flaggedStatus[selected.user_id] ? 'Unflag user' : 'Flag user'}
                  </button>
                  <button onClick={() => setShowProfileModal(true)} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground">
                    <UserCircle className="w-3 h-3" /> Profile
                  </button>
                  <button onClick={() => setShowNotesModal(true)} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground">
                    <StickyNote className="w-3 h-3" /> Notes
                  </button>
                  <button onClick={() => setShowAuditModal(true)} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground">
                    <History className="w-3 h-3" /> Audit
                  </button>
                  <button onClick={handleShowDeleted} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground">
                    <EyeOff className="w-3 h-3" /> Show deleted
                  </button>
                  {/* Assign dropdown */}
                  <div className="relative">
                    <button onClick={() => { setShowAssign(v => !v); if (teamMembers.length === 0) loadTeamMembers(); }}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground">
                      {selected.assignee_name || 'Unassigned'} <ChevronDown className="w-3 h-3" />
                    </button>
                    {showAssign && (
                      <div className="absolute top-full right-0 mt-1 z-20 w-44 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                        <button onClick={() => handleAssign(null, 'Unassigned')}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-muted border-b border-border text-muted-foreground">
                          Unassigned
                        </button>
                        {teamMembers.map(m => (
                          <button key={m._id} onClick={() => handleAssign(m._id, m.username)}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-muted border-b border-border last:border-0 ${selected.assignee_id === m._id ? 'bg-primary/5 text-primary font-semibold' : ''}`}>
                            {m.username}
                            <span className="ml-1 text-[9px] text-muted-foreground capitalize">{m.role === 'admin' ? 'Â· Super Admin' : ''}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Smart Questions status badge */}
                  {selected.sq_state?.fired_count > 0 && (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-1 bg-violet-100 text-violet-700 rounded-full font-semibold">
                      <Zap className="w-3 h-3" /> Questions sent
                    </span>
                  )}
                  {/* Close / Reopen */}
                  {selected.status !== 'closed'
                    ? <button onClick={handleClose} className="flex items-center gap-1 text-xs bg-gray-800 text-white px-3 py-1.5 rounded-lg hover:bg-gray-900 ml-auto"><XCircle className="w-3 h-3" /> Close</button>
                    : <button onClick={handleReopen} className="flex items-center gap-1 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 ml-auto"><RotateCcw className="w-3 h-3" /> Reopen</button>}
                </div>
              </div>

              {/* â”€â”€ SLA warning banners â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
              {(() => {
                if (selected.status === 'closed') return null;
                const deadline = new Date(selected.created_at).getTime() + slaMinutes * 60000;
                const remaining = deadline - Date.now();
                const warnMs = warnMinutes * 60000;
                const sqFiredAll = selected.sq_state?.fired_count > 0;
                return (
                  <>
                    {sqFiredAll && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        All questions already asked. Add more in Smart Questions.
                        <span className="underline cursor-pointer ml-1" onClick={() => window.open('/admin/superadmin-support', '_blank')}>Open Smart Questions</span>
                      </div>
                    )}
                    {remaining < warnMs && remaining > 0 && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-xs font-medium">
                        <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                        Reply now. The publisher has waited over {warnMinutes / 60} hours. Auto-closes as an SLA breach in <strong className="ml-1">{formatRemaining(remaining)}</strong>.
                      </div>
                    )}
                    {remaining <= 0 && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white text-xs font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        SLA breached â€” this ticket has been open for over {slaMinutes / 60} hours.
                      </div>
                    )}
                  </>
                );
              })()}

              {/* â”€â”€ "What they told us" section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
              {selected.intake_answers && Object.keys(selected.intake_answers).length > 0 && (
                <div className="border-b border-border">
                  <button onClick={() => setShowIntakeAnswers(v => !v)}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/30 transition-colors">
                    <History className="w-3.5 h-3.5" />
                    What they told us
                    <ChevronRight className={`w-3.5 h-3.5 ml-auto transition-transform ${showIntakeAnswers ? 'rotate-90' : ''}`} />
                  </button>
                  {showIntakeAnswers && (
                    <div className="px-4 pb-3 grid grid-cols-2 gap-x-6 gap-y-1.5">
                      {Object.entries(selected.intake_answers).map(([k, v]) => (
                        <div key={k}>
                          <p className="text-[10px] text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</p>
                          <p className="text-sm font-medium">{v}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* â”€â”€ Chat thread â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {/* Original message */}
                {!selected.is_broadcast && (
                  selected.is_admin_initiated || selected.source === 'reactivation' ? (
                    <div className="flex gap-3 justify-end group">
                      <div className="flex-1 max-w-[85%]">
                        <div className="flex items-center gap-2 justify-end mb-1">
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Admin Initiated</span>
                          <p className="text-xs text-muted-foreground">{fmt(selected.created_at)}</p>
                        </div>
                        <div className="bg-primary/10 border border-primary/20 rounded-xl rounded-tr-none px-4 py-3">
                          <p className="text-sm whitespace-pre-wrap">{selected.body}</p>
                        </div>
                      </div>
                      <img src="/logo.png" alt="Admin" className="w-8 h-8 rounded-full object-cover flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {(selected.username || 'U')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 max-w-[85%]">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs font-semibold">{selected.username}</p>
                          <p className="text-xs text-muted-foreground">{fmt(selected.created_at)}</p>
                        </div>
                        <div className="bg-muted/40 rounded-xl rounded-tl-none px-4 py-3">
                          <p className="text-sm whitespace-pre-wrap">{selected.body}</p>
                          {selected.image_url && (
                            <a href={`${getApiBaseUrl()}${selected.image_url}`} target="_blank" rel="noopener noreferrer">
                              <img src={`${getApiBaseUrl()}${selected.image_url}`} alt="" className="mt-2 max-w-[240px] rounded-lg border border-border" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                )}

                {/* Replies */}
                {selected.replies.map(reply => {
                  const isAdmin = reply.from === 'admin';
                  const isSystem = reply.from === 'system';
                  const userSeenThis = isAdmin && selected.last_read_by_user_at && new Date(reply.created_at) <= new Date(selected.last_read_by_user_at);

                  if (isSystem && reply.is_smart_question) {
                    return (
                      <div key={reply._id} className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-white">ML</span>
                        </div>
                        <div className="max-w-[75%] bg-violet-50 border border-violet-200 rounded-2xl rounded-tl-sm px-4 py-2.5">
                          <p className="text-[10px] font-semibold text-violet-600 mb-0.5">Smart Question Â· {fmt(reply.created_at)}</p>
                          <p className="text-sm">{reply.text}</p>
                        </div>
                      </div>
                    );
                  }

                  return isAdmin ? (
                    <div key={reply._id} className="flex gap-3 justify-end group">
                      <div className="flex-1 max-w-[85%]">
                        <div className="flex items-center gap-2 justify-end mb-1">
                          <button onClick={() => handleDeleteReply(selected._id, reply._id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600" title="Delete"><Trash2 className="w-3 h-3" /></button>
                          <p className="text-xs text-muted-foreground">{fmt(reply.created_at)}</p>
                          <p className="text-xs font-semibold text-primary">Admin</p>
                        </div>
                        <div className="bg-primary/10 border border-primary/20 rounded-xl rounded-tr-none px-4 py-3">
                          <p className="text-sm whitespace-pre-wrap">{reply.text}</p>
                          {reply.image_url && (
                            <a href={`${getApiBaseUrl()}${reply.image_url}`} target="_blank" rel="noopener noreferrer">
                              <img src={`${getApiBaseUrl()}${reply.image_url}`} alt="" className="mt-2 max-w-[240px] rounded-lg border border-primary/20" />
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-1 justify-end mt-0.5">
                          {userSeenThis ? <><Eye className="w-3 h-3 text-green-500" /><span className="text-[10px] text-green-500">Seen</span></> : <span className="text-[10px] text-muted-foreground">Not seen yet</span>}
                        </div>
                      </div>
                      <img src="/logo.png" alt="Admin" className="w-8 h-8 rounded-full object-cover flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                  ) : (
                    <div key={reply._id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {(selected.username || 'U')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 max-w-[85%]">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs font-semibold">{selected.username}</p>
                          <p className="text-xs text-muted-foreground">{fmt(reply.created_at)}</p>
                        </div>
                        <div className="bg-muted/40 rounded-xl rounded-tl-none px-4 py-3">
                          <p className="text-sm whitespace-pre-wrap">{reply.text}</p>
                          {reply.image_url && (
                            <a href={`${getApiBaseUrl()}${reply.image_url}`} target="_blank" rel="noopener noreferrer">
                              <img src={`${getApiBaseUrl()}${reply.image_url}`} alt="" className="mt-2 max-w-[240px] rounded-lg border border-border" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Deleted replies (show deleted mode) */}
                {showDeletedReplies && (
                  <div className="border-t border-dashed border-border pt-3">
                    <p className="text-[10px] text-muted-foreground mb-2 text-center">â€” Deleted replies â€”</p>
                    {loadingDeleted ? <p className="text-xs text-center text-muted-foreground">Loading...</p>
                      : deletedReplies.length === 0 ? <p className="text-xs text-center text-muted-foreground">No deleted replies</p>
                      : deletedReplies.map((r, i) => (
                        <div key={r._id || i} className="flex gap-3 opacity-50 mb-2">
                          <div className="w-6 h-6 rounded-full bg-red-200 flex items-center justify-center text-[9px] font-bold text-red-700 flex-shrink-0 mt-1">D</div>
                          <div className="bg-red-50 border border-red-200 rounded-xl rounded-tl-none px-3 py-2">
                            <p className="text-[10px] text-red-500 mb-0.5">Deleted by {r.deleted_by} Â· {r.deleted_at ? fmt(r.deleted_at) : ''}</p>
                            <p className="text-sm whitespace-pre-wrap">{r.text}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* â”€â”€ Reply input â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
              <div className="border-t border-border bg-muted/10">
                <textarea
                  value={replyText}
                  onChange={e => handleReplyTextChange(e.target.value)}
                  placeholder="Reply to the publisher (Enter to send, Shift+Enter for a new line)"
                  rows={3}
                  className="w-full text-sm px-4 pt-3 bg-transparent border-0 focus:outline-none resize-none"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); }
                  }}
                />
                {/* Image preview */}
                {replyImageUrl && (
                  <div className="px-4 pb-1">
                    <div className="relative inline-block">
                      <img src={`${getApiBaseUrl()}${replyImageUrl}`} alt="Preview" className="h-14 rounded-lg border border-border" />
                      <button onClick={() => setReplyImageUrl('')} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center"><X className="w-2.5 h-2.5" /></button>
                    </div>
                  </div>
                )}
                {/* Bottom toolbar */}
                <div className="flex items-center gap-1.5 px-3 pb-2.5 pt-1">
                  <input ref={replyFileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ''; }} />
                  {/* Attach */}
                  <button onClick={() => replyFileRef.current?.click()} disabled={replyUploading}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg hover:bg-muted border border-border disabled:opacity-50">
                    {replyUploading ? <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Image className="w-3.5 h-3.5" />}
                    Attach
                  </button>

                  {/* Links dropdown */}
                  <div className="relative">
                    <button onClick={() => { setShowLinks(v => !v); if (quickLinks.length === 0) loadQuickLinks(); }}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg hover:bg-muted border border-border">
                      <Link2 className="w-3.5 h-3.5" /> Links
                    </button>
                    {showLinks && (
                      <div className="absolute bottom-10 left-0 z-30 w-72 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
                          <span className="text-xs font-semibold">Quick links</span>
                          <button onClick={() => setShowLinks(false)}><X className="w-3.5 h-3.5" /></button>
                        </div>
                        <div className="max-h-52 overflow-y-auto">
                          {quickLinks.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">No quick links yet.<br />Add them in Super Admin â†’ Quick links.</p>
                            : quickLinks.map(l => (
                              <button key={l._id}
                                onClick={() => { setReplyText(p => p ? p + '\n\n' + l.url : l.url); setShowLinks(false); }}
                                className="w-full text-left px-3 py-2.5 hover:bg-muted/50 border-b border-border last:border-0">
                                <p className="text-xs font-semibold">{l.title}</p>
                                <p className="text-[10px] text-primary truncate">{l.url}</p>
                                {l.description && <p className="text-[10px] text-muted-foreground">{l.description}</p>}
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Canned replies dropdown */}
                  <div className="relative">
                    <button onClick={() => { setShowCanned(v => !v); if (cannedReplies.length === 0) loadCannedReplies(); }}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg hover:bg-muted border border-border">
                      <BookOpen className="w-3.5 h-3.5" /> Canned
                    </button>
                    {showCanned && (
                      <div className="absolute bottom-10 left-0 z-30 w-72 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
                          <span className="text-xs font-semibold">Canned replies</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setShowManageCanned(true); setShowCanned(false); setCannedForm({ id: null, title: '', text: '' }); }} className="text-[10px] text-primary hover:underline">Manage</button>
                            <button onClick={() => setShowCanned(false)}><X className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                        <div className="max-h-56 overflow-y-auto">
                          {cannedReplies.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">No canned replies.<br />Click Manage to create one.</p>
                            : cannedReplies.map(c => (
                              <button key={c._id} onClick={() => { setReplyText(p => p ? p + '\n\n' + c.text : c.text); setShowCanned(false); }}
                                className="w-full text-left px-3 py-2.5 hover:bg-muted/50 border-b border-border last:border-0">
                                <p className="text-xs font-semibold">{c.title}</p>
                                <p className="text-[10px] text-muted-foreground line-clamp-2">{c.text}</p>
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Schedule */}
                  <button onClick={() => setShowScheduleModal(true)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg hover:bg-muted border border-border">
                    <Calendar className="w-3.5 h-3.5" /> Schedule
                  </button>

                  {/* Save draft */}
                  <button onClick={handleManualSaveDraft} disabled={!replyText.trim()}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg hover:bg-muted border border-border disabled:opacity-40">
                    <PenSquare className="w-3.5 h-3.5" /> Save draft
                  </button>

                  {/* Send */}
                  <button onClick={handleReply} disabled={replying || (!replyText.trim() && !replyImageUrl)}
                    className="ml-auto flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-1.5 rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                    <Send className="w-3.5 h-3.5" />{replying ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* â”€â”€ Modals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {showFlagModal && selected && (
        <FlagModal userId={selected.user_id} username={selected.username}
          currentlyFlagged={flaggedStatus[selected.user_id] || false}
          onClose={() => setShowFlagModal(false)}
          onDone={(fl) => { setFlaggedStatus(p => ({ ...p, [selected.user_id]: fl })); }}
        />
      )}
      {showNotesModal && selected && <NotesModal messageId={selected._id} onClose={() => setShowNotesModal(false)} />}
      {showAuditModal && selected && <AuditModal messageId={selected._id} onClose={() => setShowAuditModal(false)} />}
      {showProfileModal && selected && <ProfileModal userId={selected.user_id} username={selected.username} onClose={() => setShowProfileModal(false)} />}
      {showScheduleModal && selected && (
        <ScheduleModal messageId={selected._id} replyText={replyText}
          onClose={() => setShowScheduleModal(false)} onScheduled={() => setReplyText('')} />
      )}

      {/* â”€â”€ Compose / Broadcast Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {showCompose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCompose(false)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2"><PenSquare className="w-5 h-5 text-primary" /><h2 className="text-lg font-semibold">Compose Message</h2></div>
              <button onClick={() => setShowCompose(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div>
                <label className="text-sm font-medium mb-2 block">Send To</label>
                <div className="flex gap-3">
                  {(['all', 'specific'] as const).map(m => (
                    <button key={m} onClick={() => setRecipientMode(m)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium ${recipientMode === m ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                      {m === 'all' ? <><Users className="w-4 h-4" /> All Publishers</> : <><User className="w-4 h-4" /> Specific Users</>}
                    </button>
                  ))}
                </div>
              </div>
              {recipientMode === 'specific' && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Select Recipients {selectedUsers.length > 0 && <span className="ml-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">{selectedUsers.length}</span>}</label>
                  <div className="relative mb-2"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input type="text" placeholder="Search users..." value={userSearch} onChange={e => setUserSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div className="border border-border rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    {usersLoading ? <p className="text-sm text-center py-4 text-muted-foreground">Loading...</p>
                      : filteredUsers.map(u => (
                        <label key={u._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 cursor-pointer border-b border-border last:border-0">
                          <input type="checkbox" checked={selectedUsers.includes(u._id)} onChange={() => toggleUser(u._id)} className="rounded" />
                          <div className="min-w-0"><p className="text-sm font-medium truncate">{u.username}</p><p className="text-xs text-muted-foreground truncate">{u.email}</p></div>
                        </label>
                      ))}
                  </div>
                </div>
              )}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Subject</label>
                <input type="text" placeholder="Message from MoustacheLeads" value={broadcastSubject} onChange={e => setBroadcastSubject(e.target.value)} className="w-full px-4 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Message</label>
                <textarea placeholder="Write your message..." value={broadcastBody} onChange={e => setBroadcastBody(e.target.value)} rows={5} className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{recipientMode === 'all' ? 'Sends to all publishers' : `Will send to ${selectedUsers.length} user${selectedUsers.length !== 1 ? 's' : ''}`}</p>
              <div className="flex gap-2">
                <button onClick={() => setShowCompose(false)} className="px-4 py-2 text-sm border border-border rounded-xl hover:bg-muted">Cancel</button>
                <button onClick={handleBroadcast} disabled={broadcasting || !broadcastBody.trim()} className="flex items-center gap-2 px-5 py-2 text-sm bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 disabled:opacity-50">
                  <Send className="w-4 h-4" />{broadcasting ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* â”€â”€ Manage Canned Replies Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {showManageCanned && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowManageCanned(false)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2"><BookOpen className="w-5 h-5 text-primary" /><h2 className="text-lg font-semibold">Manage Canned Replies</h2></div>
              <button onClick={() => setShowManageCanned(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="bg-muted/30 rounded-xl p-4 space-y-3 border border-border">
                <h3 className="text-sm font-semibold">{cannedForm.id ? 'Edit Reply' : 'New Canned Reply'}</h3>
                <input value={cannedForm.title} onChange={e => setCannedForm(f => ({ ...f, title: e.target.value }))} placeholder="Title" className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none" />
                <textarea value={cannedForm.text} onChange={e => setCannedForm(f => ({ ...f, text: e.target.value }))} placeholder="Reply text..." rows={4} className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none resize-none" />
                <div className="flex gap-2 justify-end">
                  {cannedForm.id && <button onClick={() => setCannedForm({ id: null, title: '', text: '' })} className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>}
                  <button onClick={handleSaveCanned} disabled={savingCanned} className="bg-primary text-primary-foreground px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">{savingCanned ? 'Saving...' : cannedForm.id ? 'Update' : 'Create'}</button>
                </div>
              </div>
              {cannedReplies.map(c => (
                <div key={c._id} className="flex items-start gap-3 p-3 bg-card border border-border rounded-xl group">
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold">{c.title}</p><p className="text-xs text-muted-foreground line-clamp-2">{c.text}</p></div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0">
                    <button onClick={() => setCannedForm({ id: c._id, title: c.title, text: c.text })} className="p-1.5 text-muted-foreground hover:text-primary"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDeleteCanned(c._id)} className="p-1.5 text-muted-foreground hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSupportInbox;
