import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchInactiveUsers, fetchReactivationStats, fetchUserProfile,
  sendOutreach, createSupportTicket, executeSandS, fetchOffersForPicker,
  fetchRecommendedOffers, fetchUserEnrichedDetail, fetchQuickPickOffers,
  fetchOutreachHistory,
  type InactiveUser, type Filters, type UserProfile, type OfferOption,
} from '@/services/reactivationApi';
import { toast } from 'sonner';
import {
  Search, Filter, Users, MapPin, TrendingDown, Mail, Clock,
  ChevronDown, ChevronUp, CheckSquare, Square, RefreshCw,
  AlertTriangle, Shield, Eye, MousePointerClick, UserX, UserCheck,
  Send, Calendar, MessageSquare, X, Loader2, ChevronLeft, ChevronRight,
} from 'lucide-react';

import { AdminPageGuard } from '@/components/AdminPageGuard';
import EmailSettingsPanel, { DEFAULT_EMAIL_SETTINGS, type EmailSettings } from '@/components/EmailSettingsPanel';
import PublisherIntelligencePanel from '@/components/PublisherIntelligencePanel';
import UserPreferenceBadges from '@/components/UserPreferenceBadges';

// ── Helpers ────────────────────────────────────────────────────────────
function daysAgoText(days: number) {
  if (days >= 9999) return 'Never';
  if (days === 0) return 'Today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}

function scoreColor(score: number) {
  if (score >= 70) return 'text-green-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-red-400';
}

function riskBadge(level: string) {
  if (level === 'suspicious') return <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500/20 text-red-400">🚨 Suspicious</span>;
  if (level === 'medium') return <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-500/20 text-yellow-400">⚠️ Medium</span>;
  return <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-500/20 text-green-400">✅ Safe</span>;
}

function activityBadge(level: string) {
  const map: Record<string, { label: string; cls: string }> = {
    converted_before: { label: 'Converted before', cls: 'bg-green-500/20 text-green-400' },
    clicked_no_conv: { label: 'Clicked, no conv.', cls: 'bg-blue-500/20 text-blue-400' },
    viewed_offers: { label: 'Viewed offers', cls: 'bg-purple-500/20 text-purple-400' },
    never_clicked: { label: 'Never clicked', cls: 'bg-gray-500/20 text-gray-400' },
  };
  const m = map[level] || { label: level, cls: 'bg-gray-500/20 text-gray-400' };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${m.cls}`}>{m.label}</span>;
}

function initials(user: InactiveUser) {
  const f = (user.first_name || user.username || '?')[0]?.toUpperCase() || '?';
  const l = (user.last_name || '')[0]?.toUpperCase() || '';
  return f + l;
}

const INACTIVITY_OPTIONS = [
  { value: '', label: 'All' },
  { value: '7d', label: '1 week+' },
  { value: '30_90d', label: '1–3 months' },
  { value: '90_plus', label: '3 months+' },
];

const ACTIVITY_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'viewed_offers', label: 'Viewed offers' },
  { value: 'clicked_no_conv', label: 'Clicked, no conv.' },
  { value: 'converted_before', label: 'Converted before' },
  { value: 'never_clicked', label: 'Never clicked' },
];

const RISK_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'safe', label: '✅ Safe' },
  { value: 'medium', label: '⚠️ Medium' },
  { value: 'suspicious', label: '🚨 Suspicious' },
];

const SORT_OPTIONS = [
  { value: 'longest_inactive', label: 'Longest inactive first' },
  { value: 'reactivation_score', label: 'Reactivation score ↓' },
  { value: 'highest_earnings', label: 'Highest earnings first' },
  { value: 'most_conversions', label: 'Most conversions' },
];

const PER_PAGE_OPTIONS = [10, 25, 50, 100];


// ── Quick Pick Dropdown with checkboxes ─────────────────────────────────
function QuickPickDropdown({ items, category, onApply, onClose }: {
  items: any[]; category: string; onApply: (selected: any[]) => void; onClose: () => void;
}) {
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const toggle = (idx: number) => {
    setChecked(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n; });
  };

  const selectAll = () => setChecked(new Set(items.map((_, i) => i)));
  const clearAll = () => setChecked(new Set());

  const isPromo = category === 'promo_codes';
  const isGift = category === 'gift_cards';

  return (
    <div className="absolute z-20 left-0 top-full mt-1 w-72 bg-card border border-border rounded-lg shadow-xl max-h-60 flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex gap-2">
          <button onClick={selectAll} className="text-[10px] text-blue-400 hover:text-blue-300">Select All</button>
          <button onClick={clearAll} className="text-[10px] text-muted-foreground hover:text-foreground">Clear</button>
        </div>
        <button onClick={() => { onApply(items.filter((_, i) => checked.has(i))); }} disabled={checked.size === 0}
          className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500 text-white disabled:opacity-30">
          Add {checked.size} to Mail
        </button>
      </div>
      <div className="overflow-y-auto flex-1 p-1">
        {items.map((item, i) => (
          <label key={i} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-xs">
            <input type="checkbox" checked={checked.has(i)} onChange={() => toggle(i)} className="accent-orange-500 flex-shrink-0" />
            <span className="flex-1 truncate text-foreground">
              {isPromo ? `${item.code} — ${item.bonus_type === 'percentage' ? `${item.bonus_value}%` : `$${item.bonus_value}`}` :
               isGift ? `${item.name || item.code} — $${item.value}` :
               item.name}
            </span>
            {!isPromo && !isGift && <span className="text-muted-foreground flex-shrink-0">${(item.payout || 0).toFixed(0)}</span>}
          </label>
        ))}
        {items.length === 0 && <p className="text-xs text-muted-foreground p-2">No items available</p>}
      </div>
    </div>
  );
}

// ── S+S Modal (Schedule + Support) ─────────────────────────────────────
function SandSModal({ users, open, onClose, prefilledOffer }: { users: InactiveUser[]; open: boolean; onClose: () => void; prefilledOffer?: { id: string; name: string } }) {
  const queryClient = useQueryClient();
  const [sendTime, setSendTime] = useState('now');
  const [customDateTime, setCustomDateTime] = useState('');
  const [channel, setChannel] = useState('email');
  const [offerId, setOfferId] = useState('');
  const [offerName, setOfferName] = useState('');
  const [offerSearch, setOfferSearch] = useState('');
  const [subject, setSubject] = useState('We miss you! New offers waiting 🎯');
  const [message, setMessage] = useState('Hey {name}! We have new offers matched to your interests. Check them out! 🔥');
  const [issueType, setIssueType] = useState('Reactivation');
  const [priority, setPriority] = useState('medium');
  const [note, setNote] = useState('');
  const [assignTo, setAssignTo] = useState('auto');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [showOfferDropdown, setShowOfferDropdown] = useState(false);
  const [openPicker, setOpenPicker] = useState<string | null>(null);
  const [emailSettings, setEmailSettings] = useState<EmailSettings>(DEFAULT_EMAIL_SETTINGS);

  // Auto-select all users when modal opens or users change
  useEffect(() => {
    if (open && users.length > 0) {
      setSelectedUserIds(users.map(u => u._id));
    }
  }, [open, users]); // which quick-pick dropdown is open

  // Sync prefilled offer when modal opens with prefilledOffer
  if (open && prefilledOffer && offerName !== prefilledOffer.name) {
    setOfferId(prefilledOffer.id);
    setOfferName(prefilledOffer.name);
    const offerEntries = prefilledOffer.name.split(', ');
    if (offerEntries.length === 1) {
      setSubject(`Check out this offer for you 🎯`);
      setMessage(`Hey {name}! We found an offer that matches your interests:\n\n• ${offerEntries[0]}\n\nCheck it out and start earning! 🔥`);
    } else {
      setSubject(`${offerEntries.length} new offers matched to your interests 🎯`);
      setMessage(`Hey {name}! We found ${offerEntries.length} offers that match your interests:\n\n${offerEntries.map(n => `• ${n}`).join('\n')}\n\nCheck them out and start earning! 🔥`);
    }
  }

  const { data: offersData } = useQuery({
    queryKey: ['reactivation-offers', offerSearch],
    queryFn: () => fetchOffersForPicker(offerSearch),
    enabled: open,
  });
  const offers: OfferOption[] = offersData?.offers || [];

  const { data: quickPickData } = useQuery({
    queryKey: ['reactivation-quick-pick'],
    queryFn: fetchQuickPickOffers,
    enabled: open,
    staleTime: 60000,
  });

  // Apply selected items from a picker to the message
  const applyPickedItems = (items: { name: string; payout?: number; code?: string; value?: number; bonus_value?: number; bonus_type?: string }[], type: 'offers' | 'promo' | 'gift') => {
    if (items.length === 0) return;
    let lines: string[] = [];
    if (type === 'offers') {
      lines = items.map(o => `• ${o.name} — $${(o.payout || 0).toFixed(2)}`);
      setOfferId('');
      setOfferName(items.map(o => o.name).join(', '));
      setSubject(`${items.length} offers selected for you 🎯`);
    } else if (type === 'promo') {
      lines = items.map(o => `🎟️ Promo Code: ${o.code} — ${o.bonus_type === 'percentage' ? `${o.bonus_value}% Bonus` : `$${o.bonus_value} Bonus`}`);
      setSubject(`Exclusive promo code${items.length > 1 ? 's' : ''} for you 🎁`);
    } else {
      lines = items.map(o => `🎁 Gift Card: ${o.name || o.code} — $${o.value}`);
      setSubject(`Gift card${items.length > 1 ? 's' : ''} waiting for you 🎁`);
    }
    setMessage(`Hey {name}!\n\n${lines.join('\n')}\n\nCheck them out and start earning! 🔥`);
    setOpenPicker(null);
  };

  const getScheduledAtUTC = () => {
    if (sendTime !== 'custom' || !customDateTime) return undefined;
    return new Date(customDateTime).toISOString();
  };

  const outreachMutation = useMutation({
    mutationFn: () => executeSandS({
      user_ids: selectedUserIds,
      outreach: { offer_id: offerId, offer_name: offerName, channel, message, subject, send_time: sendTime, scheduled_at: getScheduledAtUTC(), template_style: emailSettings.templateStyle, visible_fields: emailSettings.visibleFields, default_image: emailSettings.defaultImage, payout_type: emailSettings.payoutType },
      support: { issue_type: issueType, priority, note, assign_to: assignTo },
    }),
    onSuccess: () => { toast.success('S+S action completed'); queryClient.invalidateQueries({ queryKey: ['reactivation'] }); queryClient.invalidateQueries({ queryKey: ['reactivation-profile'] }); queryClient.invalidateQueries({ queryKey: ['reactivation-outreach-history'] }); onClose(); },
    onError: () => toast.error('Failed to execute S+S'),
  });

  const outreachOnlyMutation = useMutation({
    mutationFn: () => sendOutreach({ user_ids: selectedUserIds, offer_id: offerId, offer_name: offerName, channel, message, subject, send_time: sendTime, scheduled_at: getScheduledAtUTC(), template_style: emailSettings.templateStyle, visible_fields: emailSettings.visibleFields, default_image: emailSettings.defaultImage, payout_type: emailSettings.payoutType }),
    onSuccess: () => { toast.success('Outreach sent'); queryClient.invalidateQueries({ queryKey: ['reactivation'] }); queryClient.invalidateQueries({ queryKey: ['reactivation-profile'] }); queryClient.invalidateQueries({ queryKey: ['reactivation-outreach-history'] }); onClose(); },
    onError: () => toast.error('Failed to send outreach'),
  });

  const sendEmailNowMutation = useMutation({
    mutationFn: () => sendOutreach({ user_ids: selectedUserIds, offer_id: offerId, offer_name: offerName, channel: 'email', message, subject, send_time: 'now', template_style: emailSettings.templateStyle, visible_fields: emailSettings.visibleFields, default_image: emailSettings.defaultImage, payout_type: emailSettings.payoutType }),
    onSuccess: () => { toast.success('Email sent now!'); queryClient.invalidateQueries({ queryKey: ['reactivation'] }); queryClient.invalidateQueries({ queryKey: ['reactivation-profile'] }); queryClient.invalidateQueries({ queryKey: ['reactivation-outreach-history'] }); onClose(); },
    onError: () => toast.error('Failed to send email'),
  });

  const supportOnlyMutation = useMutation({
    mutationFn: () => createSupportTicket({ user_ids: selectedUserIds, issue_type: issueType, priority, note, assign_to: assignTo }),
    onSuccess: () => { toast.success('Support tickets created'); queryClient.invalidateQueries({ queryKey: ['reactivation'] }); queryClient.invalidateQueries({ queryKey: ['reactivation-profile'] }); queryClient.invalidateQueries({ queryKey: ['reactivation-outreach-history'] }); onClose(); },
    onError: () => toast.error('Failed to create tickets'),
  });

  const toggleUser = (id: string) => setSelectedUserIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  if (!open) return null;

  // Quick-pick categories config
  const pickerCategories = [
    { key: 'top_requested', label: '🔥 Top Requested', color: 'purple', items: (quickPickData?.top_requested || []) as any[] },
    { key: 'top_running', label: '▶ Top Running', color: 'green', items: (quickPickData?.top_running || []) as any[] },
    { key: 'recently_edited', label: '✏️ Recently Edited', color: 'cyan', items: (quickPickData?.recently_edited || []) as any[] },
    { key: 'recently_deleted', label: '🗑 Recently Deleted', color: 'red', items: (quickPickData?.recently_deleted || []) as any[] },
    { key: 'promo_codes', label: '🎟️ Promo Codes', color: 'amber', items: (quickPickData?.promo_codes || []) as any[] },
    { key: 'gift_cards', label: '🎁 Gift Cards', color: 'pink', items: (quickPickData?.gift_cards || []) as any[] },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">🗓 +✦ S+S — Schedule + Support</h2>
              <p className="text-xs text-muted-foreground">Schedule outreach AND add support action for {users.length} user{users.length > 1 ? 's' : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Publisher Intelligence — shown when single user selected */}
          {users.length === 1 && (
            <details className="border border-border/50 rounded-lg overflow-hidden">
              <summary className="px-4 py-2.5 bg-muted/30 hover:bg-muted/50 cursor-pointer text-xs font-medium flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-orange-500" />
                Publisher Intelligence — {users[0].first_name || users[0].username}
              </summary>
              <div className="p-3 border-t border-border/30">
                <PublisherIntelligencePanel userId={users[0]._id} username={users[0].username} compact />
              </div>
            </details>
          )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Schedule Outreach */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-orange-500 uppercase tracking-wider">🗓 Schedule Outreach</h3>

            {/* Target Users */}
            {users.length > 1 && (
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Target Users</label>
                <div className="mt-1 border border-border rounded-lg p-2 max-h-32 overflow-y-auto space-y-1">
                  {users.map(u => (
                    <label key={u._id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-sm">
                      <input type="checkbox" checked={selectedUserIds.includes(u._id)} onChange={() => toggleUser(u._id)} className="accent-orange-500" />
                      <span className="w-7 h-7 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center text-white text-xs font-bold">{initials(u)}</span>
                      <span className="text-foreground">{u.first_name || u.username}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Send Time */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Send Time</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {[{ v: 'now', l: 'Send Now' }, { v: '1h', l: 'After 1 hour' }, { v: '24h', l: 'After 24 hours' }, { v: 'custom', l: 'Custom' }].map(o => (
                  <button key={o.v} onClick={() => setSendTime(o.v)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${sendTime === o.v ? 'bg-orange-500 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                    {o.l}
                  </button>
                ))}
              </div>
              {sendTime === 'custom' && (
                <input type="datetime-local" value={customDateTime} onChange={e => setCustomDateTime(e.target.value)}
                  className="mt-2 w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" />
              )}
            </div>

            {/* Channel */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Channel</label>
              <div className="flex gap-2 mt-1">
                {[{ v: 'email', l: '📧 Email' }, { v: 'offer_link', l: '🔗 Offer Link' }].map(o => (
                  <button key={o.v} onClick={() => setChannel(o.v)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${channel === o.v ? 'bg-orange-500 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Offer Picker */}
            <div className="relative">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Offer</label>
              <div className="mt-1">
                <input
                  type="text" placeholder="Search offers..." value={offerSearch}
                  onChange={e => { setOfferSearch(e.target.value); setShowOfferDropdown(true); }}
                  onFocus={() => setShowOfferDropdown(true)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
                />
                {offerName && <p className="text-xs text-green-400 mt-1">Selected: {offerName}</p>}
                {showOfferDropdown && offers.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {offers.map(o => (
                      <button key={o._id} onClick={() => { setOfferId(o._id); setOfferName(o.name); setShowOfferDropdown(false); setOfferSearch(''); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted text-foreground">
                        {o.name} <span className="text-muted-foreground">— ${o.payout}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Quick-pick buttons — each opens a picker to select individual items */}
              <div className="mt-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Quick Select (click to pick items)</p>
                <div className="flex flex-wrap gap-1.5">
                  {pickerCategories.map(cat => (
                    <div key={cat.key} className="relative">
                      <button type="button" onClick={() => setOpenPicker(openPicker === cat.key ? null : cat.key)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${openPicker === cat.key ? `bg-${cat.color}-500/25 text-${cat.color}-400 border-${cat.color}-500/40` : `bg-${cat.color}-500/15 text-${cat.color}-400 hover:bg-${cat.color}-500/25 border-${cat.color}-500/20`}`}>
                        {cat.label} {cat.items.length > 0 ? `(${cat.items.length})` : ''}
                      </button>
                      {openPicker === cat.key && cat.items.length > 0 && (
                        <QuickPickDropdown
                          items={cat.items}
                          category={cat.key}
                          onApply={(selected) => {
                            const type = cat.key === 'promo_codes' ? 'promo' : cat.key === 'gift_cards' ? 'gift' : 'offers';
                            applyPickedItems(selected, type as any);
                          }}
                          onClose={() => setOpenPicker(null)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Subject */}
            {channel === 'email' && (
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Subject</label>
                <input value={subject} onChange={e => setSubject(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" />
              </div>
            )}

            {/* Message */}
            <div>
              <EmailSettingsPanel settings={emailSettings} onChange={setEmailSettings} compact />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Message</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm resize-y" />
              <p className="text-xs text-muted-foreground mt-1">Use {'{name}'} for personalization</p>
            </div>
          </div>

          {/* Right: Add Support */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-yellow-500 uppercase tracking-wider">✦ Add Support</h3>

            {/* Issue Type */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Issue Type</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {['Reactivation', 'Offer Help', 'Payment', 'Account', 'Fraud Review'].map(t => (
                  <button key={t} onClick={() => setIssueType(t)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${issueType === t ? 'bg-yellow-500 text-black' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Priority</label>
              <div className="flex gap-2 mt-1">
                {[{ v: 'low', l: 'Low', c: 'bg-gray-500' }, { v: 'medium', l: 'Medium', c: 'bg-yellow-500' }, { v: 'high', l: '🔥 High', c: 'bg-red-500' }].map(p => (
                  <button key={p.v} onClick={() => setPriority(p.v)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${priority === p.v ? `${p.c} text-white` : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                    {p.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Support Note */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Support Note (Internal)</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
                placeholder="Internal note for support team...&#10;e.g. Users inactive 90d+. Sending reactivation offer. Flag for follow-up if no response in 3 days."
                className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm resize-y" />
            </div>

            {/* Assign To */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Assign Ticket To</label>
              <div className="flex gap-2 mt-1">
                {[{ v: 'me', l: 'Me' }, { v: 'team', l: 'Team' }, { v: 'auto', l: 'Auto-assign' }].map(a => (
                  <button key={a.v} onClick={() => setAssignTo(a.v)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${assignTo === a.v ? 'bg-blue-500 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                    {a.l}
                  </button>
                ))}
              </div>
            </div>

            {users.length > 1 && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm text-green-400">
                ✅ Support ticket will be created for each selected user and linked to this outreach campaign.
              </div>
            )}
          </div>
        </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted">Cancel</button>
          <button onClick={() => supportOnlyMutation.mutate()} disabled={supportOnlyMutation.isPending}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30">
            {supportOnlyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : '✦ Support Only'}
          </button>
          <button onClick={() => sendEmailNowMutation.mutate()} disabled={sendEmailNowMutation.isPending}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">
            {sendEmailNowMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : '📧 Send Email Now'}
          </button>
          <button onClick={() => outreachOnlyMutation.mutate()} disabled={outreachOnlyMutation.isPending}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-orange-500/20 text-orange-400 hover:bg-orange-500/30">
            {outreachOnlyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : '🗓 Schedule Only'}
          </button>
          <button onClick={() => outreachMutation.mutate()} disabled={outreachMutation.isPending}
            className="px-5 py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90">
            {outreachMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'S+S — Do Both Now'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Send Message Modal (simpler bulk) ──────────────────────────────────
function SendMessageModal({ users, open, onClose }: { users: InactiveUser[]; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [channel, setChannel] = useState('email');
  const [subject, setSubject] = useState('We miss you! New offers waiting 🎯');
  const [message, setMessage] = useState('Hey {name}! We have new offers matched to your interests. Check them out! 🔥');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(users.map(u => u._id));

  const mutation = useMutation({
    mutationFn: () => sendOutreach({ user_ids: selectedUserIds, channel, message, subject, send_time: 'now' }),
    onSuccess: () => { toast.success('Messages sent'); queryClient.invalidateQueries({ queryKey: ['reactivation'] }); queryClient.invalidateQueries({ queryKey: ['reactivation-outreach-history'] }); onClose(); },
    onError: () => toast.error('Failed to send messages'),
  });

  const toggleUser = (id: string) => setSelectedUserIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">📨 Send Message</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Recipients */}
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Recipients</label>
            <div className="mt-1 border border-border rounded-lg p-2 max-h-32 overflow-y-auto space-y-1">
              {users.map(u => (
                <label key={u._id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-sm">
                  <input type="checkbox" checked={selectedUserIds.includes(u._id)} onChange={() => toggleUser(u._id)} className="accent-orange-500" />
                  <span className="w-7 h-7 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center text-white text-xs font-bold">{initials(u)}</span>
                  <span className="text-foreground">{u.first_name || u.username}</span>
                </label>
              ))}
            </div>
          </div>
          {/* Channel */}
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Channel</label>
            <div className="flex gap-2 mt-1">
              {[{ v: 'email', l: '📧 Email' }, { v: 'offer_link', l: '🔗 Offer Link' }].map(o => (
                <button key={o.v} onClick={() => setChannel(o.v)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${channel === o.v ? 'bg-orange-500 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>
          {channel === 'email' && (
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Subject</label>
              <input value={subject} onChange={e => setSubject(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" />
            </div>
          )}
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Message</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm resize-y" />
            <p className="text-xs text-muted-foreground mt-1">Use {'{name}'} for personalization</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="px-5 py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90">
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : '📨 Send'}
          </button>
        </div>
      </div>
    </div>
  );
}


// ── Offers Tab Content (with recommendations) ─────────────────────────
function OffersTabContent({ user, profile, onOpenSandS }: { user: InactiveUser; profile: UserProfile; onOpenSandS: () => void }) {
  const [selectedOffers, setSelectedOffers] = useState<Set<string>>(new Set());
  const [sandsOpen, setSandsOpen] = useState(false);

  const { data: recsData } = useQuery({
    queryKey: ['reactivation-recommend', user._id],
    queryFn: () => fetchRecommendedOffers(user._id),
  });
  const recommended = recsData?.offers || [];

  const toggleOffer = (id: string) => setSelectedOffers(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Get selected offer names for the S+S modal
  const selectedOffersList = recommended.filter((o: any) => selectedOffers.has(o._id));
  const selectedOfferNames = selectedOffersList.map((o: any) => `${o.name} ($${o.payout || 0})`).join(', ');
  const firstSelectedOffer = selectedOffersList[0];

  return (
    <div className="space-y-4">
      {/* Recommended Offers */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold text-orange-500 uppercase tracking-wider">🎯 Recommended Offers for {user.first_name || user.username}</h4>
          {selectedOffers.size > 0 && (
            <button onClick={() => setSandsOpen(true)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-orange-500 to-red-500 text-white">
              Send {selectedOffers.size} Selected via S+S
            </button>
          )}
        </div>
        {recommended.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {recommended.map((o: any) => (
              <div key={o._id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${selectedOffers.has(o._id) ? 'border-orange-500 bg-orange-500/5' : 'border-border bg-background hover:border-orange-500/30'}`} onClick={() => toggleOffer(o._id)}>
                <input type="checkbox" checked={selectedOffers.has(o._id)} onChange={() => {}} className="accent-orange-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{o.name}</p>
                  <p className="text-xs text-muted-foreground">{o.category} · ${o.payout}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${o.match_type === 'interest' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                  {o.match_type === 'interest' ? '✓ Matched' : '🔥 Popular'}
                </span>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground">No active offers available to recommend.</p>}
      </div>

      {/* Outreach History */}
      <div>
        <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">📨 Offers Sent to User (Outreach History)</h4>
        {profile.outreach_history && profile.outreach_history.length > 0 ? (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-xs text-muted-foreground border-b border-border"><th className="text-left py-2 px-3">Offer</th><th className="text-left py-2 px-3">Channel</th><th className="text-left py-2 px-3">Status</th><th className="text-right py-2 px-3">Sent</th></tr></thead><tbody>
            {profile.outreach_history.map((o: any, i: number) => (<tr key={i} className="border-b border-border/50 hover:bg-muted/50"><td className="py-2 px-3 text-foreground">{o.offer_name || '—'}</td><td className="py-2 px-3"><span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400">{o.channel}</span></td><td className="py-2 px-3"><span className={`px-2 py-0.5 rounded text-xs ${o.status === 'sent' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{o.status}</span></td><td className="py-2 px-3 text-right text-muted-foreground">{o.created_at ? new Date(o.created_at).toLocaleString() : '—'}</td></tr>))}
          </tbody></table></div>
        ) : <p className="text-sm text-muted-foreground">No outreach sent yet.</p>}
      </div>

      {/* Click + Conversion History */}
      {profile.click_stats.length > 0 && <div>
        <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">🖱 Click History</h4>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-xs text-muted-foreground border-b border-border"><th className="text-left py-2 px-3">Offer</th><th className="text-right py-2 px-3">Clicks</th><th className="text-right py-2 px-3">Last Click</th></tr></thead><tbody>
          {profile.click_stats.map((c: any, i: number) => (<tr key={i} className="border-b border-border/50 hover:bg-muted/50"><td className="py-2 px-3 text-foreground">{c.offer_name || c._id}</td><td className="py-2 px-3 text-right text-blue-400">{c.click_count}</td><td className="py-2 px-3 text-right text-muted-foreground">{c.last_click ? new Date(c.last_click).toLocaleDateString() : '-'}</td></tr>))}
        </tbody></table></div>
      </div>}
      {profile.conv_stats.length > 0 && <div>
        <h4 className="text-xs font-bold text-green-400 uppercase tracking-wider mb-2">⭐ Conversion History</h4>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-xs text-muted-foreground border-b border-border"><th className="text-left py-2 px-3">Offer</th><th className="text-right py-2 px-3">Conversions</th><th className="text-right py-2 px-3">Earnings</th></tr></thead><tbody>
          {profile.conv_stats.map((c: any, i: number) => (<tr key={i} className="border-b border-border/50 hover:bg-muted/50"><td className="py-2 px-3 text-foreground">{c.offer_name || c._id}</td><td className="py-2 px-3 text-right text-green-400">{c.conv_count}</td><td className="py-2 px-3 text-right text-green-400">${(c.total_payout || 0).toFixed(2)}</td></tr>))}
        </tbody></table></div>
      </div>}
      {/* S+S Modal pre-filled with selected offers */}
      <SandSModal
        users={[user]}
        open={sandsOpen}
        onClose={() => setSandsOpen(false)}
        prefilledOffer={firstSelectedOffer ? { id: firstSelectedOffer._id, name: selectedOfferNames } : undefined}
      />
    </div>
  );
}
function UserDetailCard({ user }: { user: InactiveUser }) {
  const [activeTab, setActiveTab] = useState<'info' | 'offers' | 'timeline' | 'geo' | 'sands'>('info');
  const [sandsOpen, setSandsOpen] = useState(false);

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['reactivation-profile', user._id],
    queryFn: () => fetchUserProfile(user._id),
  });
  const profile: UserProfile | null = profileData?.profile || null;

  const tabs = [
    { id: 'info' as const, label: '📋 Info' },
    { id: 'offers' as const, label: '🎯 Offers' },
    { id: 'timeline' as const, label: '⏱ Timeline' },
    { id: 'geo' as const, label: '🌍 Geo & Offers' },
    { id: 'sands' as const, label: '🗓+✦ S+S' },
  ];

  return (
    <div className="border-t border-border bg-muted/30">
      {/* Tabs */}
      <div className="flex gap-1 px-4 pt-3 border-b border-border overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${activeTab === t.id ? 'bg-background text-foreground border-b-2 border-orange-500' : 'text-muted-foreground hover:text-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

        ) : activeTab === 'info' && profile ? (
          /* ═══ INFO TAB ═══ */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-3">
              {/* Inactivity + Account Status Banner */}
              <div className="flex flex-wrap gap-3 items-center">
                <span className="px-3 py-1 rounded-lg text-sm font-bold bg-orange-500/15 text-orange-500 border border-orange-500/30">
                  🕐 Inactive for {user.days_inactive >= 9999 ? 'Never logged in' : `${user.days_inactive} days`}
                </span>
                <span className={`px-2 py-1 rounded text-xs font-bold ${user.email_verified ? 'bg-green-500/15 text-green-500' : 'bg-red-500/15 text-red-400'}`}>
                  {user.email_verified ? '✅ Email Verified' : '❌ Email NOT Verified'}
                </span>
                <span className={`px-2 py-1 rounded text-xs font-bold ${user.has_approved_placement ? 'bg-blue-500/15 text-blue-400' : user.total_placements > 0 ? 'bg-yellow-500/15 text-yellow-400' : 'bg-gray-500/15 text-gray-400'}`}>
                  {user.has_approved_placement ? `✓ ${user.approved_placements} Approved Placement(s)` : user.total_placements > 0 ? `⏳ ${user.pending_placements} Pending` : '✗ No Placement'}
                </span>
                {user.has_offer_requests && (
                  <span className="px-2 py-1 rounded text-xs font-bold bg-purple-500/15 text-purple-400">
                    📋 {user.total_offer_requests} Requests ({user.pending_offer_requests} pending, {user.approved_offer_requests} approved)
                  </span>
                )}
                <span className={`px-2 py-1 rounded text-xs font-bold ${user.account_status === 'approved' ? 'bg-green-500/15 text-green-500' : 'bg-yellow-500/15 text-yellow-500'}`}>
                  Account: {user.account_status}
                </span>
                {riskBadge(user.risk_level)}
              </div>

              {/* Offer Request Details — which offers requested, which approved */}
              {user.offer_request_details && user.offer_request_details.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">📋 Offer Access Requests</h4>
                  {!user.has_approved_placement && user.offer_request_details.length > 0 && (
                    <div className="mb-2 px-3 py-1.5 rounded-lg text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      ⚠️ This user has no approved placement but has offer requests — verify data integrity
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {user.offer_request_details.map((r, i) => (
                      <div key={i} className="flex items-center justify-between bg-background border border-border rounded-lg px-3 py-2">
                        <span className="text-xs text-foreground truncate max-w-[200px]">{r.offer_name}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                          r.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          r.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>{r.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <h4 className="text-xs font-bold text-orange-500 uppercase tracking-wider">🧠 User Interest Profile — Auto-Built from Behavior</h4>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Last Searched */}
                <div className="bg-background border border-border rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">🔍 Last Searched</p>
                  <p className="text-sm font-medium text-blue-400 mt-1">{profile.last_searched ? `"${profile.last_searched.keyword}"` : 'No searches'}</p>
                  {profile.last_searched?.date && <p className="text-[10px] text-muted-foreground">{new Date(profile.last_searched.date).toLocaleDateString()}</p>}
                </div>
                {/* Last Picked */}
                <div className="bg-background border border-border rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">👆 Last Picked</p>
                  <p className="text-sm font-medium text-yellow-400 mt-1">{profile.last_picked?.offer_name || 'None'}</p>
                  {profile.last_picked?.date && <p className="text-[10px] text-muted-foreground">{new Date(profile.last_picked.date).toLocaleDateString()}</p>}
                </div>
                {/* Highest Converting */}
                <div className="bg-background border border-border rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">⭐ Highest Converting</p>
                  <p className="text-sm font-medium text-green-400 mt-1">{profile.highest_converting?.offer_name || 'None'}</p>
                  {profile.highest_converting && <p className="text-[10px] text-muted-foreground">{profile.highest_converting.conversions} conv · ${profile.highest_converting.earnings}</p>}
                </div>
                {/* Most Clicked */}
                <div className="bg-background border border-border rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">🖱 Most Clicked</p>
                  <p className="text-sm font-medium text-purple-400 mt-1">{profile.most_clicked?.offer_name || 'None'}</p>
                  {profile.most_clicked && <p className="text-[10px] text-muted-foreground">{profile.most_clicked.clicks} clicks total</p>}
                </div>
              </div>
              {/* Intent Tags */}
              {profile.intent_tags.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">Intent tags →</span>
                  {profile.intent_tags.map((tag, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">{tag}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Behavior Stats + Device + Offer Memory */}
            <div className="space-y-3">
              {/* Behavior Stats */}
              <div>
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">📊 Behavior Stats</h4>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Total Clicks</span><span className="text-foreground font-medium">{user.total_clicks}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Conversions</span><span className="text-foreground font-medium">{user.total_conversions}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Earned</span><span className="text-green-400 font-medium">${user.total_earnings.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Inactive Since</span><span className="text-orange-400 font-medium">{user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Days Inactive</span><span className="text-red-400 font-bold">{user.days_inactive >= 9999 ? '∞' : user.days_inactive}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Placements</span><span className="text-foreground font-medium">{user.approved_placements} approved</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total Logins</span><span className="text-foreground font-medium">{user.login_count}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Searches</span><span className="text-foreground font-medium">{user.total_searches}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Outreach Sent</span><span className="text-foreground font-medium">{user.outreach_count}</span></div>
                  {user.country && user.country !== 'Unknown' && <div className="flex justify-between"><span className="text-muted-foreground">Country</span><span className="text-foreground font-medium">{user.country} ({user.country_code})</span></div>}
                  {user.city && user.city !== 'Unknown' && <div className="flex justify-between"><span className="text-muted-foreground">City</span><span className="text-foreground font-medium">{user.city}</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">IPs Used</span><span className="text-foreground font-medium">{profile.ip_stats?.unique_ips || 0}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Joined</span><span className="text-foreground font-medium">{user.created_at ? new Date(user.created_at).toLocaleDateString() : '?'}</span></div>
                </div>
              </div>
              {/* Device History */}
              {profile.device_history.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">📱 Device History</h4>
                  <div className="space-y-1 text-xs">
                    {profile.device_history.slice(0, 3).map((d, i) => (
                      <div key={i} className="flex justify-between text-muted-foreground">
                        <span>{d.device_type || 'Unknown'} · {d.browser || ''}</span>
                        <span>{d.count}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Offer Memory */}
              {profile.offer_memory.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">🧠 Offer Memory</h4>
                  <div className="space-y-1.5">
                    {profile.offer_memory.slice(0, 5).map((om, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-foreground truncate max-w-[140px]">{om.offer_name}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-orange-500/20 text-orange-400">
                          Sent {om.send_count}x · {new Date(om.last_sent).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'offers' && profile ? (
          /* ═══ OFFERS TAB ═══ */
          <OffersTabContent user={user} profile={profile} onOpenSandS={() => setSandsOpen(true)} />
        ) : activeTab === 'timeline' ? (
          /* ═══ TIMELINE TAB — rich event timeline ═══ */
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-3">⏱ Activity Timeline</h4>
            <div className="relative pl-6 space-y-0">
              {/* Vertical line */}
              <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />

              {/* Conversion events */}
              {profile && profile.conv_stats.map((c: any, i: number) => (
                <div key={`conv-${i}`} className="relative flex items-start gap-3 py-3">
                  <div className="absolute left-[-13px] w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Conversion — {c.offer_name || 'Unknown Offer'}</p>
                    <p className="text-xs text-muted-foreground">{c.conv_count} conversions · ${(c.total_payout || 0).toFixed(2)} earned</p>
                    <div className="mt-1 px-3 py-1.5 bg-muted/50 rounded text-xs text-muted-foreground">Earned ${(c.total_payout || 0).toFixed(2)} · Offer: {c.offer_name}</div>
                  </div>
                </div>
              ))}

              {/* Search events */}
              {profile && profile.search_keywords.slice(0, 5).map((kw: string, i: number) => (
                <div key={`search-${i}`} className="relative flex items-start gap-3 py-3">
                  <div className="absolute left-[-13px] w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Search — "{kw}"</p>
                    <p className="text-xs text-muted-foreground">Intent captured → {kw}</p>
                  </div>
                </div>
              ))}

              {/* Login event */}
              {user.last_login && (
                <div className="relative flex items-start gap-3 py-3">
                  <div className="absolute left-[-13px] w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Last Login</p>
                    <p className="text-xs text-muted-foreground">{new Date(user.last_login).toLocaleString()} · {user.country}</p>
                    <div className="mt-1 px-3 py-1.5 bg-muted/50 rounded text-xs text-muted-foreground">Device: {user.last_device?.device_type || 'Unknown'} · {user.last_device?.browser || ''}</div>
                  </div>
                </div>
              )}

              {/* Outreach events */}
              {profile && profile.outreach_history?.slice(0, 3).map((o: any, i: number) => (
                <div key={`out-${i}`} className="relative flex items-start gap-3 py-3">
                  <div className="absolute left-[-13px] w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Outreach Sent — {o.offer_name || 'General'}</p>
                    <p className="text-xs text-muted-foreground">{o.created_at ? new Date(o.created_at).toLocaleString() : ''} · {o.channel} · {o.status}</p>
                    {o.message && <div className="mt-1 px-3 py-1.5 bg-muted/50 rounded text-xs text-muted-foreground truncate">{o.message}</div>}
                  </div>
                </div>
              ))}

              {/* Support ticket events */}
              {profile && profile.support_history?.slice(0, 3).map((t: any, i: number) => (
                <div key={`sup-${i}`} className="relative flex items-start gap-3 py-3">
                  <div className="absolute left-[-13px] w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Support Ticket — {t.issue_type || 'Reactivation'}</p>
                    <p className="text-xs text-muted-foreground">{t.created_at ? new Date(t.created_at).toLocaleString() : ''} · {t.priority} priority · {t.status}</p>
                    {t.body && <div className="mt-1 px-3 py-1.5 bg-muted/50 rounded text-xs text-muted-foreground">{t.body}</div>}
                  </div>
                </div>
              ))}

              {/* Account created */}
              <div className="relative flex items-start gap-3 py-3">
                <div className="absolute left-[-13px] w-6 h-6 rounded-full bg-gray-500/20 flex items-center justify-center"><span className="w-2.5 h-2.5 rounded-full bg-gray-500" /></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Account Created</p>
                  <p className="text-xs text-muted-foreground">{user.created_at ? new Date(user.created_at).toLocaleString() : 'Unknown'}</p>
                </div>
              </div>
            </div>
          </div>

        ) : activeTab === 'geo' && profile ? (
          /* ═══ GEO & OFFERS TAB ═══ */
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-orange-500 uppercase tracking-wider">🌍 Geo & Offer Intelligence — {user.first_name || user.username} ({user.country})</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="bg-background border border-border rounded-lg p-4">
                  <h5 className="text-xs font-bold text-muted-foreground uppercase mb-2">📍 Location Details</h5>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Country</span><span className="text-foreground font-medium">{user.country}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Code</span><span className="text-foreground font-medium">{user.country_code}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">City</span><span className="text-foreground font-medium">{user.city}</span></div>
                    {user.latitude && <div className="flex justify-between"><span className="text-muted-foreground">Coordinates</span><span className="text-foreground font-medium">{user.latitude?.toFixed(2)}, {user.longitude?.toFixed(2)}</span></div>}
                  </div>
                </div>
                <div className="bg-background border border-border rounded-lg p-4">
                  <h5 className="text-xs font-bold text-muted-foreground uppercase mb-2">📊 Offer Activity by Type</h5>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-green-400">✅ Converted</span><span className="text-foreground font-medium">{profile.conv_stats.length}</span></div>
                    <div className="flex justify-between"><span className="text-blue-400">🖱 Clicked</span><span className="text-foreground font-medium">{profile.click_stats.length}</span></div>
                    <div className="flex justify-between"><span className="text-orange-400">📨 Sent via Outreach</span><span className="text-foreground font-medium">{profile.outreach_history?.length || 0}</span></div>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="bg-background border border-border rounded-lg p-4">
                  <h5 className="text-xs font-bold text-muted-foreground uppercase mb-2">🎯 Region Interest Tags</h5>
                  <div className="flex flex-wrap gap-2">
                    {profile.intent_tags.length > 0 ? profile.intent_tags.map((tag, i) => (
                      <span key={i} className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">{user.country_code}: {tag}</span>
                    )) : <p className="text-sm text-muted-foreground">No interest data</p>}
                  </div>
                </div>
                {profile.click_stats.length > 0 && (
                  <div className="bg-background border border-border rounded-lg p-4">
                    <h5 className="text-xs font-bold text-muted-foreground uppercase mb-2">🔥 Top Offers in {user.country}</h5>
                    <div className="space-y-1.5">
                      {profile.click_stats.slice(0, 5).map((c: any, i: number) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-foreground truncate max-w-[180px]">{c.offer_name}</span>
                          <span className="text-blue-400">{c.click_count} clicks</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

        ) : activeTab === 'sands' ? (
          /* ═══ S+S TAB — Schedule + Support with history ═══ */
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-lg p-4">
              <h4 className="text-sm font-bold text-orange-500">🗓+✦ S+S — Schedule + Support</h4>
              <p className="text-xs text-muted-foreground mt-1">Send outreach emails with offer recommendations AND create support tickets for follow-up — all in one action. Use this to re-engage inactive users with personalized offers while tracking the outreach internally.</p>
              <button onClick={() => setSandsOpen(true)} className="mt-3 px-4 py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90">
                Open S+S Panel for {user.first_name || user.username}
              </button>
            </div>

            {/* Outreach History */}
            <div>
              <h4 className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-2">📨 Outreach History (Emails Sent)</h4>
              {profile && profile.outreach_history && profile.outreach_history.length > 0 ? (
                <div className="space-y-2">
                  {profile.outreach_history.map((o: any, i: number) => (
                    <div key={i} className="bg-background border border-border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${o.status === 'sent' ? 'bg-green-500/20 text-green-400' : o.status === 'scheduled' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400'}`}>{o.status}</span>
                          <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400">{o.channel}</span>
                          {o.offer_name && <span className="text-xs text-foreground font-medium">{o.offer_name}</span>}
                        </div>
                        <span className="text-xs text-muted-foreground">{o.created_at ? new Date(o.created_at).toLocaleString() : ''}</span>
                      </div>
                      {o.subject && <p className="text-xs text-muted-foreground">Subject: {o.subject}</p>}
                      {o.message && <p className="text-xs text-muted-foreground mt-1 truncate">Message: {o.message}</p>}
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">No outreach emails sent yet.</p>}
            </div>

            {/* Support Ticket History */}
            <div>
              <h4 className="text-xs font-bold text-yellow-400 uppercase tracking-wider mb-2">✦ Support Ticket History</h4>
              {profile && profile.support_history && profile.support_history.length > 0 ? (
                <div className="space-y-2">
                  {profile.support_history.map((t: any, i: number) => (
                    <div key={i} className="bg-background border border-border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.status === 'open' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>{t.status}</span>
                          <span className="px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400">{t.issue_type}</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${t.priority === 'high' ? 'bg-red-500/20 text-red-400' : t.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400'}`}>{t.priority}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{t.created_at ? new Date(t.created_at).toLocaleString() : ''}</span>
                      </div>
                      <p className="text-xs text-foreground font-medium">{t.subject}</p>
                      {t.body && <p className="text-xs text-muted-foreground mt-1">{t.body}</p>}
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">No support tickets created yet.</p>}
            </div>
          </div>
        ) : null}
      </div>

      <SandSModal users={[user]} open={sandsOpen} onClose={() => setSandsOpen(false)} />
    </div>
  );
}

// Need Gift icon for offers tab
import { Gift } from 'lucide-react';


// ── User Card ──────────────────────────────────────────────────────────
function UserCard({ user, selected, onSelect, expanded, onToggle }: {
  user: InactiveUser; selected: boolean; onSelect: () => void; expanded: boolean; onToggle: () => void;
}) {
  return (
    <div className={`border rounded-xl overflow-hidden bg-card transition-colors ${selected ? 'border-orange-500 bg-orange-500/5 ring-1 ring-orange-500/30' : 'border-border hover:border-orange-500/30'}`}>
      <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={onToggle}>
        {/* Checkbox */}
        <button onClick={e => { e.stopPropagation(); onSelect(); }} className="flex-shrink-0">
          {selected ? <CheckSquare className="h-5 w-5 text-orange-500" /> : <Square className="h-5 w-5 text-muted-foreground" />}
        </button>

        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {initials(user)}
        </div>

        {/* User Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground text-sm">{user.first_name || user.username}</span>
            {user.email_verified && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400">✓ Confirmed</span>}
            {user.has_approved_placement && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400">Placement ✓</span>}
            {!user.has_approved_placement && user.total_placements > 0 && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-400">Placement ⏳</span>}
            {user.has_offer_requests && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400">{user.total_offer_requests} req</span>}
            {riskBadge(user.risk_level)}
          </div>
          <p className="text-xs text-muted-foreground truncate">{user.email}{user.country && user.country !== 'Unknown' ? ` · ${user.country}` : ''}{user.city && user.city !== 'Unknown' ? ` · ${user.city}` : ''}</p>
          <UserPreferenceBadges user={user as any} compact />
        </div>

        {/* Quick Stats */}
        <div className="hidden md:flex items-center gap-4 text-xs flex-shrink-0">
          <span className="text-orange-400 font-medium">{daysAgoText(user.days_inactive)}</span>
          <span className="text-green-400">${user.total_earnings.toFixed(0)}</span>
          <span className="text-blue-400">{user.total_conversions} conv</span>
          {activityBadge(user.activity_level)}
        </div>

        {/* Score */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative w-10 h-10">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none" stroke="currentColor" strokeWidth="3" className="text-muted" />
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none" strokeWidth="3" strokeDasharray={`${user.reactivation_score}, 100`}
                className={scoreColor(user.reactivation_score)} stroke="currentColor" strokeLinecap="round" />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${scoreColor(user.reactivation_score)}`}>
              {user.reactivation_score}
            </span>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {expanded && <UserDetailCard user={user} />}
    </div>
  );
}


// ── World Map Component (react-simple-maps with human figures) ──────────
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

function WorldMap({ points, onUserClick, onCountryClick }: { points: { user_id: string; lat: number; lng: number; country: string; country_code: string; days_inactive: number; username: string; has_placement?: boolean; total_clicks?: number; total_conversions?: number; total_earnings?: number }[]; onUserClick?: (userId: string) => void; onCountryClick?: (countryCode: string, countryName: string) => void }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [zoom, setZoom] = useState(1);

  return (
    <div className="relative w-full h-72 rounded-xl border border-border overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
      <ComposableMap
        projectionConfig={{ scale: 140, center: [10, 20] }}
        style={{ width: '100%', height: '100%' }}
      >
        <ZoomableGroup zoom={zoom} onMoveEnd={({ zoom: z }) => setZoom(z)}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const geoName = geo.properties?.name || '';
                return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#1e3a5f"
                  stroke="#3b82f6"
                  strokeWidth={0.4}
                  onMouseEnter={(e) => {
                    const rect = (e.target as SVGElement).closest('svg')?.getBoundingClientRect();
                    if (rect && geoName) setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top - 10, text: `🌍 ${geoName} — click to filter` });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  onClick={() => {
                    const geoName = geo.properties?.name || '';
                    if (geoName && onCountryClick) onCountryClick('', geoName);
                  }}
                  style={{
                    default: { outline: 'none', cursor: 'pointer' },
                    hover: { fill: '#2d4a6f', outline: 'none', cursor: 'pointer' },
                    pressed: { outline: 'none' },
                  }}
                />
              );})
            }
          </Geographies>

          {/* User markers as human figures */}
          {points.map((p, i) => {
            const color = p.days_inactive > 180 ? '#ef4444' : p.days_inactive > 90 ? '#f59e0b' : '#22c55e';
            return (
              <Marker key={i} coordinates={[p.lng, p.lat]}>
                <g
                  onMouseEnter={(e) => {
                    const rect = (e.target as SVGElement).closest('svg')?.getBoundingClientRect();
                    if (rect) setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top - 10, text: `${p.username} · ${p.country} (${p.country_code}) · ${p.days_inactive >= 9999 ? 'Never' : p.days_inactive + 'd'} inactive · ${p.total_clicks || 0} clicks · ${p.total_conversions || 0} conv · $${(p.total_earnings || 0).toFixed(0)} · ${p.has_placement ? '✓ Placement' : '✗ No Placement'}` });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  onClick={() => onUserClick?.(p.user_id)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Glow */}
                  <circle cx="0" cy="0" r="6" fill={color} opacity="0.2" />
                  {/* Head */}
                  <circle cx="0" cy="-5" r="2.5" fill={color} />
                  {/* Body */}
                  <line x1="0" y1="-2.5" x2="0" y2="3" stroke={color} strokeWidth="1.5" />
                  {/* Arms */}
                  <line x1="-3" y1="0" x2="3" y2="0" stroke={color} strokeWidth="1" />
                  {/* Legs */}
                  <line x1="0" y1="3" x2="-2" y2="6.5" stroke={color} strokeWidth="1" />
                  <line x1="0" y1="3" x2="2" y2="6.5" stroke={color} strokeWidth="1" />
                </g>
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>

      {/* Tooltip */}
      {tooltip && (
        <div className="absolute pointer-events-none z-10 px-3 py-1.5 rounded-lg text-xs font-medium text-white shadow-lg"
          style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)', background: 'rgba(0,0,0,0.85)' }}>
          {tooltip.text}
        </div>
      )}

      {/* Zoom Controls */}
      <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
        <button onClick={() => setZoom(z => Math.min(z * 1.5, 8))}
          className="w-7 h-7 rounded bg-white/10 hover:bg-white/20 text-white text-sm font-bold flex items-center justify-center backdrop-blur-sm border border-white/10">+</button>
        <button onClick={() => setZoom(z => Math.max(z / 1.5, 1))}
          className="w-7 h-7 rounded bg-white/10 hover:bg-white/20 text-white text-sm font-bold flex items-center justify-center backdrop-blur-sm border border-white/10">−</button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-2 left-2 flex items-center gap-3 text-[10px] text-white/70">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> &lt;90d</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> 90–180d</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> 180d+</span>
      </div>
    </div>
  );
}


// ── Map User Info Card (full detail, fetches enriched data, expandable) ──
function MapUserInfoCard({ userId, point, onRemove }: {
  userId: string;
  point: { username: string; country: string; country_code: string; days_inactive: number; has_placement?: boolean; total_clicks?: number; total_conversions?: number; total_earnings?: number; lat?: number; lng?: number };
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['reactivation-enriched', userId],
    queryFn: () => fetchUserEnrichedDetail(userId),
  });

  // Build a minimal InactiveUser for UserDetailCard
  const fakeUser = useMemo((): InactiveUser => ({
    _id: userId,
    username: data?.user?.username || point.username,
    email: data?.user?.email || '',
    first_name: data?.user?.first_name || point.username,
    last_name: data?.user?.last_name || '',
    email_verified: data?.user?.email_verified || false,
    account_status: data?.user?.account_status || '',
    created_at: data?.user?.created_at || '',
    days_inactive: data?.days_inactive ?? point.days_inactive,
    last_login: data?.last_login || null,
    login_count: 0,
    country: data?.country || point.country,
    country_code: data?.country_code || point.country_code,
    city: data?.city || '',
    latitude: point.lat as any,
    longitude: point.lng as any,
    last_device: null,
    total_clicks: point.total_clicks || 0,
    last_click: null,
    total_conversions: point.total_conversions || 0,
    total_earnings: point.total_earnings || 0,
    total_searches: 0,
    last_search: null,
    search_keywords: [],
    has_approved_placement: data?.placement?.approved > 0 || point.has_placement || false,
    approved_placements: data?.placement?.approved || 0,
    total_placements: data?.placement?.total || 0,
    pending_placements: data?.placement?.pending || 0,
    placement_statuses: [],
    outreach_count: 0,
    last_outreach: null,
    total_offer_requests: data?.pending_request_count || 0,
    pending_offer_requests: data?.pending_request_count || 0,
    approved_offer_requests: data?.approved_not_clicked_count || 0,
    has_offer_requests: (data?.pending_request_count || 0) > 0,
    offer_request_details: [],
    reactivation_score: 0,
    risk_level: 'safe' as const,
    activity_level: 'never_clicked' as const,
    intent_tags: [],
  }), [userId, data, point]);

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      {/* Header row — same style as UserCard */}
      <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="w-9 h-9 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {(point.username || '?')[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground text-sm">{data?.user?.first_name || point.username}</span>
            {(data?.placement?.approved > 0 || point.has_placement) && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400">Placement ✓</span>}
            {data?.pending_request_count > 0 && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400">{data.pending_request_count} req</span>}
          </div>
          <p className="text-xs text-muted-foreground truncate">{data?.user?.email || ''} · {point.country} ({point.country_code})</p>
        </div>
        <div className="hidden md:flex items-center gap-3 text-xs flex-shrink-0">
          <span className="text-orange-400 font-medium">{point.days_inactive >= 9999 ? 'Never' : `${point.days_inactive}d ago`}</span>
          <span className="text-green-400">${(point.total_earnings || 0).toFixed(0)}</span>
          <span className="text-blue-400">{point.total_conversions || 0} conv</span>
          <span className="text-purple-400">{point.total_clicks || 0} clicks</span>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="p-1 rounded hover:bg-muted flex-shrink-0"><X className="h-4 w-4 text-muted-foreground" /></button>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
      </div>

      {/* Expanded: show full UserDetailCard */}
      {expanded && !isLoading && <UserDetailCard user={fakeUser} />}
      {expanded && isLoading && (
        <div className="flex items-center justify-center py-6 border-t border-border"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      )}
    </div>
  );
}

// ── Outreach History Section ────────────────────────────────────────────
function OutreachHistorySection() {
  const [showHistory, setShowHistory] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['reactivation-outreach-history'],
    queryFn: () => fetchOutreachHistory(1, 50),
    enabled: showHistory,
  });

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button onClick={() => setShowHistory(!showHistory)}
        className="w-full flex items-center justify-between p-4 bg-card hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-bold text-foreground">📨 Outreach History</span>
          {data?.stats && (
            <span className="text-xs text-muted-foreground">
              {data.stats.sent} sent · {data.stats.failed} failed · {data.stats.scheduled} scheduled
            </span>
          )}
        </div>
        {showHistory ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {showHistory && (
        <div className="border-t border-border p-4 bg-muted/20 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : data?.history?.length > 0 ? (
            <div className="space-y-2">
              {data.history.map((h: any) => (
                <div key={h._id} className="flex items-center gap-3 p-3 bg-background border border-border rounded-lg text-sm">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${h.status === 'sent' ? 'bg-green-500' : h.status === 'failed' ? 'bg-red-500' : h.status === 'scheduled' ? 'bg-yellow-500' : 'bg-gray-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{h.username || h.user_email}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${h.status === 'sent' ? 'bg-green-500/20 text-green-400' : h.status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{h.status}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-400">{h.channel}</span>
                      {h.bulk_send && <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-400">BCC bulk ({h.bulk_count})</span>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{h.subject}</p>
                    {h.offer_name && <p className="text-[10px] text-orange-400 truncate">Offers: {h.offer_name}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">{h.created_at ? new Date(h.created_at).toLocaleString() : ''}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No outreach history yet</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page Content ──────────────────────────────────────────────────
function AdminReactivationContent() {
  const [filters, setFilters] = useState<Filters>({ page: 1, per_page: 25, sort_by: 'longest_inactive' });
  const [searchInput, setSearchInput] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [bulkSandsOpen, setBulkSandsOpen] = useState(false);
  const [bulkMessageOpen, setBulkMessageOpen] = useState(false);
  const [mapSandsOpen, setMapSandsOpen] = useState(false);
  const [mapMessageOpen, setMapMessageOpen] = useState(false);
  const [mapPopupUserIds, setMapPopupUserIds] = useState<Set<string>>(new Set());

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['reactivation-stats'],
    queryFn: fetchReactivationStats,
    staleTime: 60000,
  });

  const { data: usersData, isLoading: usersLoading, refetch } = useQuery({
    queryKey: ['reactivation-users', filters],
    queryFn: () => fetchInactiveUsers(filters),
  });

  // Fetch enriched detail for ALL map-clicked users
  const mapPopupUserIdArray = useMemo(() => Array.from(mapPopupUserIds), [mapPopupUserIds]);

  const stats = statsData || {};
  const users: InactiveUser[] = usersData?.users || [];
  const totalUsers = usersData?.total || 0;
  const totalPages = usersData?.pages || 0;
  const currentPage = filters.page || 1;

  const selectedUsers = useMemo(() => users.filter(u => selectedIds.has(u._id)), [users, selectedIds]);

  // Find map-clicked user info from map_points
  const mapClickedPoints = useMemo(() => {
    if (mapPopupUserIds.size === 0 || !stats.map_points) return [];
    return stats.map_points.filter((p: any) => mapPopupUserIds.has(p.user_id));
  }, [mapPopupUserIds, stats.map_points]);

  const handleSearch = useCallback(() => {
    setFilters(f => ({ ...f, search: searchInput, page: 1 }));
  }, [searchInput]);

  const handleMapUserClick = useCallback((userId: string) => {
    setMapPopupUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  const toggleSelectAll = () => {
    if (selectedIds.size === users.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(users.map(u => u._id)));
    }
  };

  const updateFilter = (key: string, value: any) => {
    setFilters(f => ({ ...f, [key]: value || undefined, page: 1 }));
  };

  // Multi-country helpers
  const selectedCountries = useMemo(() => {
    const c = filters.country || '';
    return c ? c.split(',').map(s => s.trim()).filter(Boolean) : [];
  }, [filters.country]);

  const toggleCountry = (code: string) => {
    const current = new Set(selectedCountries);
    if (current.has(code)) current.delete(code);
    else current.add(code);
    const val = Array.from(current).join(',');
    setFilters(f => ({ ...f, country: val || undefined, page: 1 }));
  };

  // Build InactiveUser-like objects for map-selected users (for S+S modal)
  const mapSelectedUsersForModal = useMemo((): InactiveUser[] => {
    if (mapPopupUserIds.size === 0 || !stats.map_points) return [];
    return stats.map_points
      .filter((p: any) => mapPopupUserIds.has(p.user_id))
      .map((p: any) => ({
        _id: p.user_id,
        username: p.username,
        email: '',
        first_name: p.username,
        last_name: '',
        email_verified: false,
        account_status: '',
        created_at: '',
        days_inactive: p.days_inactive,
        last_login: null,
        login_count: 0,
        country: p.country,
        country_code: p.country_code,
        city: '',
        latitude: p.lat,
        longitude: p.lng,
        last_device: null,
        total_clicks: 0,
        last_click: null,
        total_conversions: 0,
        total_earnings: 0,
        total_searches: 0,
        last_search: null,
        search_keywords: [],
        has_approved_placement: p.has_placement || false,
        approved_placements: 0,
        total_placements: 0,
        pending_placements: 0,
        placement_statuses: [],
        outreach_count: 0,
        last_outreach: null,
        total_offer_requests: 0,
        pending_offer_requests: 0,
        approved_offer_requests: 0,
        has_offer_requests: false,
        offer_request_details: [],
        reactivation_score: 0,
        risk_level: 'safe' as const,
        activity_level: 'never_clicked' as const,
        intent_tags: [],
      }));
  }, [mapPopupUserIds, stats.map_points]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">🔄 Reactivation</h1>
          <p className="text-muted-foreground text-sm">Identify inactive users, analyze behavior, and send targeted outreach</p>
        </div>
        <button onClick={() => refetch()} className="p-2 rounded-lg hover:bg-muted text-muted-foreground"><RefreshCw className="h-5 w-5" /></button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Total Inactive</p>
          <p className="text-2xl font-bold text-foreground">{stats.total_inactive || 0}</p>
          <p className="text-[10px] text-muted-foreground">of {stats.total_users || 0} users</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">7–30 days</p>
          <p className="text-2xl font-bold text-yellow-400">{stats.buckets?.['7d'] || 0}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">30–90 days</p>
          <p className="text-2xl font-bold text-orange-400">{stats.buckets?.['30d'] || 0}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">90–180 days</p>
          <p className="text-2xl font-bold text-red-400">{stats.buckets?.['90d'] || 0}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">180+ days</p>
          <p className="text-2xl font-bold text-red-600">{stats.buckets?.['180_plus'] || 0}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Outreach This Week</p>
          <p className="text-2xl font-bold text-green-400">{stats.outreach_this_week || 0}</p>
        </div>
      </div>

      {/* Map + Country Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {statsLoading ? (
            <div className="h-64 bg-card border border-border rounded-xl flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <WorldMap points={stats.map_points || []} onUserClick={handleMapUserClick} onCountryClick={(_code, name) => {
              // Look up country code from stats by name
              const match = (stats.country_stats || []).find((c: any) => c.country?.toLowerCase() === name?.toLowerCase());
              if (match) toggleCountry(match.code);
            }} />
          )}
        </div>
        <div className="bg-card border border-border rounded-xl p-4 space-y-3 max-h-72 overflow-y-auto">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">📍 User Locations</h3>
          {selectedCountries.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {selectedCountries.map(cc => (
                <span key={cc} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  {cc}
                  <button onClick={() => toggleCountry(cc)} className="hover:text-white">✕</button>
                </span>
              ))}
              <button onClick={() => setFilters(f => ({ ...f, country: undefined, page: 1 }))} className="text-[10px] text-muted-foreground hover:text-foreground">Clear all</button>
            </div>
          )}
          {(stats.country_stats || []).slice(0, 15).map((c: any, i: number) => (
            <div key={i} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{c.country}</p>
                <p className="text-[10px] text-muted-foreground">{c.code} · {c.count} users · avg {c.avg_days}d inactive</p>
              </div>
              <button onClick={() => toggleCountry(c.code)}
                className={`text-xs ${selectedCountries.includes(c.code) ? 'text-orange-500 font-bold' : 'text-orange-400 hover:text-orange-300'}`}>
                {selectedCountries.includes(c.code) ? '✓ Selected' : '+ Add'}
              </button>
            </div>
          ))}
          {(!stats.country_stats || stats.country_stats.length === 0) && (
            <p className="text-sm text-muted-foreground">No location data available</p>
          )}
          <p className="text-[9px] text-muted-foreground mt-2">📍 Map shows users with geo coordinates. Filter may show more users without exact location.</p>
        </div>
      </div>

      {/* Map User Info Popup Panel — supports multiple users */}
      {mapPopupUserIds.size > 0 && mapClickedPoints.length > 0 && (
        <div className="bg-card border-2 border-orange-500/50 rounded-xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">{mapClickedPoints.length} User{mapClickedPoints.length > 1 ? 's' : ''} Selected from Map</h3>
            <button onClick={() => setMapPopupUserIds(new Set())} className="px-2 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted">Clear All ✕</button>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {mapClickedPoints.map((p: any) => (
              <MapUserInfoCard
                key={p.user_id}
                userId={p.user_id}
                point={p}
                onRemove={() => setMapPopupUserIds(prev => { const n = new Set(prev); n.delete(p.user_id); return n; })}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-border">
            {mapClickedPoints.length > 0 && (
              <>
                <button onClick={() => setMapSandsOpen(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90">
                  S+S ({mapClickedPoints.length})
                </button>
                <button onClick={() => setMapMessageOpen(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">
                  📨 Send Message
                </button>
              </>
            )}
            {mapClickedPoints.length === 1 && (
              <button onClick={() => { setFilters(f => ({ ...f, search: mapClickedPoints[0].username, page: 1 })); setSearchInput(mapClickedPoints[0].username); setMapPopupUserIds(new Set()); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500/20 text-orange-400 hover:bg-orange-500/30">
                🔍 Find in List
              </button>
            )}
            {mapClickedPoints.length > 0 && mapClickedPoints[0].country_code && (
              <button onClick={() => { toggleCountry(mapClickedPoints[0].country_code); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">
                🌍 + {mapClickedPoints[0].country_code}
              </button>
            )}
            <p className="text-[10px] text-muted-foreground ml-auto">💡 Click more users on the map to add them here</p>
          </div>
        </div>
      )}

      {/* Search + Filter Toggle + Bulk Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search users..." className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm" />
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${showFilters ? 'bg-orange-500 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
          <Filter className="h-4 w-4" /> Filters
        </button>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
            <button onClick={() => setBulkSandsOpen(true)}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-orange-500 to-red-500 text-white">
              S+S ({selectedIds.size})
            </button>
            <button onClick={() => setBulkMessageOpen(true)}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">
              📨 Send Message
            </button>
          </div>
        )}
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-card border border-border rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {/* Inactivity — 3 tick boxes */}
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Inactivity</label>
            <div className="mt-1.5 space-y-1.5">
              {INACTIVITY_OPTIONS.filter(o => o.value).map(o => (
                <label key={o.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="inactivity" checked={filters.inactivity_period === o.value}
                    onChange={() => updateFilter('inactivity_period', filters.inactivity_period === o.value ? '' : o.value)}
                    className="accent-orange-500" />
                  <span className="text-muted-foreground">{o.label}</span>
                </label>
              ))}
              {filters.inactivity_period && (
                <button onClick={() => updateFilter('inactivity_period', '')} className="text-[10px] text-orange-400 hover:text-orange-300">Clear</button>
              )}
            </div>
          </div>
          {/* Activity */}
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Activity</label>
            <select value={filters.activity_level || ''} onChange={e => updateFilter('activity_level', e.target.value)}
              className="w-full mt-1 px-2 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm">
              {ACTIVITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {/* Risk */}
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Risk</label>
            <select value={filters.risk_level || ''} onChange={e => updateFilter('risk_level', e.target.value)}
              className="w-full mt-1 px-2 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm">
              {RISK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {/* Placement filter — yes/no */}
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Placement</label>
            <select value={filters.has_placement || ''} onChange={e => updateFilter('has_placement', e.target.value)}
              className="w-full mt-1 px-2 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm">
              <option value="">All</option>
              <option value="true">✓ Has Placement</option>
              <option value="false">✗ No Placement</option>
            </select>
          </div>
          {/* Offer Requests filter */}
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Offer Requests</label>
            <select value={filters.has_offer_requests || ''} onChange={e => updateFilter('has_offer_requests', e.target.value)}
              className="w-full mt-1 px-2 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm">
              <option value="">All</option>
              <option value="true">✓ Has Requested</option>
              <option value="false">✗ Never Requested</option>
            </select>
          </div>
          {/* Sort */}
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Sort By</label>
            <select value={filters.sort_by || 'longest_inactive'} onChange={e => updateFilter('sort_by', e.target.value)}
              className="w-full mt-1 px-2 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm">
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {/* More filters */}
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={filters.has_earnings === 'true'} onChange={e => updateFilter('has_earnings', e.target.checked ? 'true' : '')} className="accent-orange-500" />
              <span className="text-muted-foreground">Has earnings</span>
            </label>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Email</label>
            <select value={filters.email_verified || ''} onChange={e => updateFilter('email_verified', e.target.value)}
              className="w-full px-2 py-1 rounded-lg border border-border bg-background text-foreground text-xs">
              <option value="">All</option>
              <option value="true">Confirmed</option>
              <option value="false">Not confirmed</option>
            </select>
            <button onClick={() => { setFilters({ page: 1, per_page: filters.per_page, sort_by: 'longest_inactive' }); setSearchInput(''); }}
              className="text-xs text-orange-400 hover:text-orange-300 text-left mt-1">↻ Reset Filters</button>
          </div>
        </div>
      )}

      {/* Select All + Per Page */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={toggleSelectAll} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            {selectedIds.size === users.length && users.length > 0 ? <CheckSquare className="h-4 w-4 text-orange-500" /> : <Square className="h-4 w-4" />}
            Select all
          </button>
          <span className="text-sm text-muted-foreground">{totalUsers} users found</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Per page:</span>
          <select value={filters.per_page || 25} onChange={e => setFilters(f => ({ ...f, per_page: Number(e.target.value), page: 1 }))}
            className="px-2 py-1 rounded border border-border bg-background text-foreground text-sm">
            {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {/* User Cards */}
      {usersLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : users.length === 0 ? (
        <div className="text-center py-16">
          <UserX className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-lg font-medium text-foreground">No inactive users found</p>
          <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map(user => (
            <UserCard
              key={user._id}
              user={user}
              selected={selectedIds.has(user._id)}
              onSelect={() => setSelectedIds(prev => { const next = new Set(prev); next.has(user._id) ? next.delete(user._id) : next.add(user._id); return next; })}
              expanded={expandedId === user._id}
              onToggle={() => setExpandedId(expandedId === user._id ? null : user._id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setFilters(f => ({ ...f, page: Math.max(1, currentPage - 1) }))} disabled={currentPage <= 1}
            className="p-2 rounded-lg hover:bg-muted disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
            const pageNum = start + i;
            if (pageNum > totalPages) return null;
            return (
              <button key={pageNum} onClick={() => setFilters(f => ({ ...f, page: pageNum }))}
                className={`w-8 h-8 rounded-lg text-sm font-medium ${pageNum === currentPage ? 'bg-orange-500 text-white' : 'hover:bg-muted text-muted-foreground'}`}>
                {pageNum}
              </button>
            );
          })}
          <button onClick={() => setFilters(f => ({ ...f, page: Math.min(totalPages, currentPage + 1) }))} disabled={currentPage >= totalPages}
            className="p-2 rounded-lg hover:bg-muted disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
        </div>
      )}

      {/* Outreach History */}
      <OutreachHistorySection />

      {/* Bulk Modals */}
      <SandSModal users={selectedUsers} open={bulkSandsOpen} onClose={() => setBulkSandsOpen(false)} />
      <SendMessageModal users={selectedUsers} open={bulkMessageOpen} onClose={() => setBulkMessageOpen(false)} />
      {/* Map-selected user modals */}
      <SandSModal users={mapSelectedUsersForModal} open={mapSandsOpen} onClose={() => setMapSandsOpen(false)} />
      <SendMessageModal users={mapSelectedUsersForModal} open={mapMessageOpen} onClose={() => setMapMessageOpen(false)} />
    </div>
  );
}

// ── Export with Guard ──────────────────────────────────────────────────
const AdminReactivation = () => (
  <AdminPageGuard requiredTab="reactivation">
    <AdminReactivationContent />
  </AdminPageGuard>
);

export default AdminReactivation;
