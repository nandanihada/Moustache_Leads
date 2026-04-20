/**
 * PublisherIntelligencePanel — Full publisher intelligence for email sending modals.
 * Shows: profile, stats, mail history, search keywords with "Use all combined",
 * offer categories chart, signup vertical vs actual clicking, selection accuracy bars,
 * and previously sent offers.
 */
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  User, Mail, MousePointerClick, TrendingUp, Search, Package,
  Clock, ChevronDown, ChevronUp, BarChart3, History, Tag,
  Loader2, AlertCircle, CheckCircle, XCircle, Combine,
} from 'lucide-react';
import { API_BASE_URL } from '@/services/apiConfig';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface PublisherIntelligenceProps {
  userId: string;
  username?: string;
  compact?: boolean;
  /** Callback when user clicks "Use all combined" on keywords */
  onUseKeywords?: (keywords: string[]) => void;
}

interface Profile {
  user_id: string; username: string; first_name: string; last_name: string;
  email: string; country: string; created_at: string; avatar_initials: string;
  account_status: string; vertical: string;
}
interface Stats { total_clicks: number; real_clicks: number; conversions: number; conv_rate: number; }
interface MailStats { total_sent: number; sent_today: number; last_sent: string | null; }
interface MailHistoryEntry { source: string; subject: string; offer_names: string[]; offer_count: number; sent_at: string; status: string; }
interface Keyword { keyword: string; count: number; last_searched: string; }
interface Category { category: string; count: number; }
interface Accuracy {
  total_requests: number; approved: number; rejected: number; pending: number;
  on_vertical_pct: number; off_vertical_pct: number;
}
interface VerticalComparison {
  signup_vertical: string;
  actual_clicking: { category: string; count: number }[];
  match: string;
}
interface SentOffer { offer_id: string; name: string; payout: number; category: string; }

interface IntelligenceData {
  profile: Profile; stats: Stats; mail_stats: MailStats; mail_history: MailHistoryEntry[];
  keywords: Keyword[]; categories: Category[]; accuracy: Accuracy;
  vertical_comparison: VerticalComparison; sent_offers: SentOffer[];
}

const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#eab308', '#06b6d4', '#ec4899'];

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function sourceLabel(source: string): string {
  const map: Record<string, string> = {
    offer_request: '📋 Offer Request', push_mail: '📨 Push Mail',
    search_logs_inventory: '🔍 Search Logs', insight_email: '💡 Insights',
    reactivation: '🔄 Reactivation', custom_campaign: '🎯 Campaign', email: '📧 Email',
  };
  return map[source] || `📧 ${source}`;
}

function matchBadge(match: string) {
  if (match === 'Strong') return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">Strong Match</span>;
  if (match === 'Partial') return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300">Partial</span>;
  if (match === 'Off-vertical') return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">Often off-vertical</span>;
  return <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">Unknown</span>;
}

export default function PublisherIntelligencePanel({ userId, username, compact, onUseKeywords }: PublisherIntelligenceProps) {
  const [data, setData] = useState<IntelligenceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>('history');
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!userId) return;
    setLoading(true); setError('');
    fetch(`${API_BASE_URL}/api/admin/offer-access-requests/publisher-intelligence/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { if (d.success) setData(d); else setError(d.error || 'Failed to load'); })
      .catch(() => setError('Failed to load publisher data'))
      .finally(() => setLoading(false));
  }, [userId]);

  const toggle = (key: string) => setExpandedSection(prev => prev === key ? null : key);

  if (loading) return <div className="flex items-center justify-center py-6 text-muted-foreground gap-2"><Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">Loading publisher intelligence...</span></div>;
  if (error) return <div className="flex items-center gap-2 py-4 px-3 text-sm text-red-500"><AlertCircle className="h-4 w-4" />{error}</div>;
  if (!data) return null;

  const { profile, stats, mail_stats, mail_history, keywords, categories, accuracy, vertical_comparison, sent_offers } = data;
  const approvalRate = accuracy.total_requests > 0 ? Math.round(accuracy.approved / accuracy.total_requests * 100) : 0;
  const requestedPct = accuracy.total_requests > 0 ? Math.round((accuracy.approved + accuracy.pending) / accuracy.total_requests * 100) : 0;

  // Selection accuracy bar data
  const accuracyBars = [
    { label: 'On-vertical', value: accuracy.on_vertical_pct, color: '#16a34a' },
    { label: 'Off-vertical', value: accuracy.off_vertical_pct, color: '#dc2626' },
    { label: 'Requested', value: requestedPct, color: '#3b82f6' },
    { label: 'Approved', value: approvalRate, color: '#d97706' },
  ];

  return (
    <div className={`space-y-3 ${compact ? 'text-xs' : 'text-sm'}`}>
      {/* ── Profile Header ── */}
      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20 rounded-lg border border-orange-200/50 dark:border-orange-800/30">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
          {profile.avatar_initials || '??'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground truncate">{profile.first_name || profile.username}</span>
            {profile.country && <span className="text-xs text-muted-foreground">🌍 {profile.country}</span>}
            <Badge variant={profile.account_status === 'active' ? 'default' : 'secondary'} className="text-[10px] h-4">{profile.account_status}</Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            <span>📧 {profile.email}</span>
            {profile.created_at && <span>Joined {timeAgo(profile.created_at)}</span>}
          </div>
          {profile.vertical && <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Vertical: {profile.vertical}</span>}
        </div>
      </div>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Total Clicks', value: stats.total_clicks.toLocaleString(), icon: <MousePointerClick className="h-3 w-3" />, color: 'text-blue-600' },
          { label: 'Real Clicks', value: stats.real_clicks.toLocaleString(), icon: <CheckCircle className="h-3 w-3" />, color: 'text-green-600' },
          { label: 'Conversions', value: stats.conversions.toLocaleString(), icon: <TrendingUp className="h-3 w-3" />, color: 'text-purple-600' },
          { label: 'Conv. Rate', value: `${stats.conv_rate}%`, icon: <BarChart3 className="h-3 w-3" />, color: 'text-orange-600' },
        ].map(s => (
          <div key={s.label} className="p-2 rounded-lg bg-muted/50 border border-border/50 text-center">
            <div className={`flex items-center justify-center gap-1 ${s.color} mb-0.5`}>{s.icon}<span className="font-bold text-sm">{s.value}</span></div>
            <span className="text-[10px] text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Mail Stats Row ── */}
      <div className="flex items-center gap-4 px-3 py-2 bg-muted/30 rounded-lg border border-border/30">
        <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-orange-500" /><span className="text-xs text-muted-foreground">Total sent:</span><span className="font-semibold">{mail_stats.total_sent}</span></div>
        <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-blue-500" /><span className="text-xs text-muted-foreground">Today:</span><span className="font-semibold">{mail_stats.sent_today}</span></div>
        <div className="flex items-center gap-1.5"><History className="h-3.5 w-3.5 text-green-500" /><span className="text-xs text-muted-foreground">Last:</span><span className="font-semibold">{timeAgo(mail_stats.last_sent)}</span></div>
      </div>

      {/* ── Send History ── */}
      <CollapsibleSection id="history" label="Send History" count={mail_history.length} icon={<History className="h-3.5 w-3.5 text-orange-500" />} expanded={expandedSection} onToggle={toggle}>
        {mail_history.length === 0 ? <p className="text-xs text-muted-foreground text-center py-3">No emails sent yet</p> : (
          <table className="w-full text-xs">
            <thead className="bg-muted/20 sticky top-0"><tr>
              <th className="text-left px-2 py-1 font-medium text-muted-foreground">Source</th>
              <th className="text-left px-2 py-1 font-medium text-muted-foreground">Subject / Offers</th>
              <th className="text-left px-2 py-1 font-medium text-muted-foreground">Sent</th>
            </tr></thead>
            <tbody>{mail_history.map((h, i) => (
              <tr key={i} className="border-t border-border/30 hover:bg-muted/20">
                <td className="px-2 py-1.5 whitespace-nowrap">{sourceLabel(h.source)}</td>
                <td className="px-2 py-1.5"><div className="truncate max-w-[200px]" title={h.subject || h.offer_names?.join(', ')}>{h.subject || h.offer_names?.slice(0, 2).join(', ') || '—'}</div>
                  {h.offer_count > 0 && <span className="text-[10px] text-muted-foreground">{h.offer_count} offer(s)</span>}</td>
                <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">{timeAgo(h.sent_at)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </CollapsibleSection>

      {/* ── Search Keywords with "Use all combined" ── */}
      {keywords.length > 0 && (
        <CollapsibleSection id="keywords" label="All Searches · Till Date" count={keywords.length} icon={<Search className="h-3.5 w-3.5 text-blue-500" />} expanded={expandedSection} onToggle={toggle}>
          <div className="p-2 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {keywords.map(k => (
                <span key={k.keyword} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-[11px] border border-blue-200/50 dark:border-blue-800/30 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                  {k.keyword}
                  <Badge variant="secondary" className="h-4 px-1 text-[9px] font-bold">{k.count}</Badge>
                </span>
              ))}
            </div>
            {onUseKeywords && (
              <Button variant="outline" size="sm" className="text-[11px] h-7 gap-1" onClick={() => onUseKeywords(keywords.map(k => k.keyword))}>
                <Combine className="h-3 w-3" /> + Use all combined
              </Button>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* ── Offer Categories Chart ── */}
      {categories.length > 0 && (
        <CollapsibleSection id="categories" label="Offer Categories Picked (All Time)" count={categories.length} icon={<Tag className="h-3.5 w-3.5 text-purple-500" />} expanded={expandedSection} onToggle={toggle}>
          <div className="p-2">
            <ResponsiveContainer width="100%" height={Math.max(80, categories.slice(0, 8).length * 22)}>
              <BarChart data={categories.slice(0, 8)} layout="vertical" margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="category" width={90} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => [v, 'Requests']} contentStyle={{ fontSize: 11 }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={16}>
                  {categories.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CollapsibleSection>
      )}

      {/* ── Signup Vertical vs Actual Clicking ── */}
      {vertical_comparison && vertical_comparison.actual_clicking?.length > 0 && (
        <CollapsibleSection id="vertical" label="Signup Vertical vs Actual" icon={<TrendingUp className="h-3.5 w-3.5 text-cyan-500" />} expanded={expandedSection} onToggle={toggle}>
          <div className="p-3 space-y-2">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-muted-foreground">Signup vertical</span><div className="font-semibold mt-0.5">{vertical_comparison.signup_vertical}</div></div>
              <div><span className="text-muted-foreground">Actually clicking</span><div className="font-semibold mt-0.5">{vertical_comparison.actual_clicking.map(c => c.category).join(', ')}</div></div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Match:</span>{matchBadge(vertical_comparison.match)}
              <span className="text-muted-foreground ml-2">Selecting correctly:</span>
              {vertical_comparison.match === 'Off-vertical'
                ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 font-medium">Often off-vertical</span>
                : vertical_comparison.match === 'Partial'
                  ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 font-medium">Partially on-vertical</span>
                  : <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 font-medium">On-vertical</span>
              }
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* ── Selection Accuracy Bars ── */}
      {accuracy.total_requests > 0 && (
        <CollapsibleSection id="accuracy" label="Selection Accuracy" icon={<BarChart3 className="h-3.5 w-3.5 text-green-500" />} expanded={expandedSection} onToggle={toggle}>
          <div className="p-3 space-y-2.5">
            {accuracyBars.map(bar => (
              <div key={bar.label} className="space-y-0.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">{bar.label}</span>
                  <span className="font-semibold">{bar.value}%</span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${bar.value}%`, backgroundColor: bar.color }} />
                </div>
              </div>
            ))}
            {/* Summary row */}
            <div className="grid grid-cols-4 gap-2 text-center pt-1 border-t border-border/30">
              <div><div className="text-sm font-bold">{accuracy.total_requests}</div><div className="text-[10px] text-muted-foreground">Total</div></div>
              <div><div className="text-sm font-bold text-green-600">{accuracy.approved}</div><div className="text-[10px] text-muted-foreground">Approved</div></div>
              <div><div className="text-sm font-bold text-red-600">{accuracy.rejected}</div><div className="text-[10px] text-muted-foreground">Rejected</div></div>
              <div><div className="text-sm font-bold text-yellow-600">{accuracy.pending}</div><div className="text-[10px] text-muted-foreground">Pending</div></div>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* ── Previously Sent Offers ── */}
      {sent_offers.length > 0 && (
        <CollapsibleSection id="sent_offers" label="Previously Sent Offers" count={sent_offers.length} icon={<Package className="h-3.5 w-3.5 text-amber-500" />} expanded={expandedSection} onToggle={toggle}>
          <div className="max-h-36 overflow-y-auto p-2 space-y-1">
            {sent_offers.map(o => (
              <div key={o.offer_id} className="flex items-center justify-between px-2 py-1 rounded bg-muted/20 hover:bg-muted/40">
                <div className="flex-1 min-w-0">
                  <span className="text-xs truncate block">{o.name}</span>
                  <span className="text-[10px] text-muted-foreground">{o.category || 'No category'}</span>
                </div>
                <span className="text-xs font-medium text-green-600 shrink-0 ml-2">${Number(o.payout || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

/** Reusable collapsible section wrapper */
function CollapsibleSection({ id, label, count, icon, expanded, onToggle, children }: {
  id: string; label: string; count?: number; icon: React.ReactNode;
  expanded: string | null; onToggle: (id: string) => void; children: React.ReactNode;
}) {
  const isOpen = expanded === id;
  return (
    <div className="border border-border/50 rounded-lg overflow-hidden">
      <button onClick={() => onToggle(id)} className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors">
        <span className="flex items-center gap-1.5 font-medium text-xs uppercase tracking-wider text-muted-foreground">
          {icon} {label} {count !== undefined && `(${count})`}
        </span>
        {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {isOpen && <div className="max-h-52 overflow-y-auto">{children}</div>}
    </div>
  );
}
