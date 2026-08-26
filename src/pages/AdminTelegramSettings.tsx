import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Send, Eye, Clock, RefreshCw, CheckCircle, XCircle,
  Loader2, MessageSquare, Filter, History, ChevronDown, ChevronUp,
  Info, AlertTriangle, Save, Play,
} from 'lucide-react';
import { getApiBaseUrl } from '@/services/apiConfig';
import { getAuthToken } from '@/utils/cookies';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { AdminPageGuard } from '@/components/AdminPageGuard';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TelegramSettings {
  bot_token_set: boolean;
  channel_id_set: boolean;
  enabled: boolean;
  interval_hours: number;
  offers_per_message: number;
  lookback_hours: number;
  content: {
    show_payout: boolean;
    show_pick_count: boolean;
    show_country: boolean;
    show_category: boolean;
    show_tracking_link: boolean;
    custom_header: string;
    custom_footer: string;
  };
  filters: {
    min_payout: number;
    categories: string[];
    countries: string[];
    only_active: boolean;
  };
  updated_at: string | null;
}

interface SendHistoryEntry {
  trigger: string;
  offer_count: number;
  status: string;
  error: string | null;
  triggered_by: string;
  sent_at: string;
}

const CATEGORIES = ['HEALTH','SURVEY','SWEEPSTAKES','EDUCATION','INSURANCE','LOAN','FINANCE','DATING','FREE_TRIAL','INSTALLS','GAMES_INSTALL'];

// ─── Main Component ───────────────────────────────────────────────────────────
function AdminTelegramSettings() {
  const baseUrl = getApiBaseUrl();
  const token = getAuthToken();

  const [settings, setSettings] = useState<TelegramSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [history, setHistory] = useState<SendHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/api/admin/telegram/settings`, { headers });
      const data = await res.json();
      if (data.success) setSettings(data.settings);
      else toast.error(data.error || 'Failed to load settings');
    } catch {
      toast.error('Network error loading Telegram settings');
    } finally {
      setLoading(false);
    }
  }, [baseUrl, token]);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${baseUrl}/api/admin/telegram/history?limit=20`, { headers });
      const data = await res.json();
      if (data.success) setHistory(data.history);
    } catch { /* silent */ }
    finally { setHistoryLoading(false); }
  };

  useEffect(() => { fetchSettings(); }, [fetchSettings]);
  useEffect(() => { if (historyOpen) fetchHistory(); }, [historyOpen]);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const update = (path: string[], value: any) => {
    setSettings(prev => {
      if (!prev) return prev;
      const next = { ...prev } as any;
      let node = next;
      for (let i = 0; i < path.length - 1; i++) node = (node[path[i]] = { ...node[path[i]] });
      node[path[path.length - 1]] = value;
      return next;
    });
  };

  const toggleCategory = (cat: string) => {
    const current = settings?.filters.categories ?? [];
    const next = current.includes(cat) ? current.filter(c => c !== cat) : [...current, cat];
    update(['filters', 'categories'], next);
  };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const payload = { ...settings };
      const res = await fetch(`${baseUrl}/api/admin/telegram/settings`, {
        method: 'PUT', headers, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Settings saved');
        fetchSettings();
      } else {
        toast.error(data.error || 'Save failed');
      }
    } catch {
      toast.error('Network error saving settings');
    } finally {
      setSaving(false);
    }
  };

  // ── Send now ─────────────────────────────────────────────────────────────────
  const handleSendNow = async () => {
    setSending(true);
    try {
      const res = await fetch(`${baseUrl}/api/admin/telegram/send-now`, {
        method: 'POST', headers,
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Message sent to Telegram channel!');
        if (historyOpen) fetchHistory();
      } else {
        toast.error(data.error || 'Send failed');
      }
    } catch {
      toast.error('Network error sending message');
    } finally {
      setSending(false);
    }
  };

  // ── Preview ──────────────────────────────────────────────────────────────────
  const handlePreview = async () => {
    setPreviewLoading(true);
    setPreviewText(null);
    try {
      const res = await fetch(`${baseUrl}/api/admin/telegram/preview`, { headers });
      const data = await res.json();
      if (data.success) setPreviewText(data.preview);
      else toast.error(data.error || 'Preview failed');
    } catch {
      toast.error('Network error loading preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      <span className="ml-2 text-muted-foreground">Loading Telegram settings…</span>
    </div>
  );

  if (!settings) return (
    <div className="text-center py-16 text-muted-foreground">
      <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-red-400" />
      <p>Could not load settings. Check backend connectivity.</p>
    </div>
  );

  const s = settings;

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-1">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-950">
            <Send className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Telegram Settings</h1>
            <p className="text-sm text-muted-foreground">
              Configure what gets sent to your Telegram channel and when
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePreview} disabled={previewLoading} className="gap-2">
            {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            Preview
          </Button>
          <Button size="sm" onClick={handleSendNow} disabled={sending} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Send Now
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Settings
          </Button>
        </div>
      </div>

      {/* ── Status badges ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge className={s.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
          {s.enabled ? '● Active' : '○ Disabled'}
        </Badge>
        {s.bot_token_set
          ? <Badge variant="outline" className="gap-1"><CheckCircle className="h-3 w-3 text-green-500" /> Bot token set via ENV</Badge>
          : <Badge variant="outline" className="gap-1 text-red-600"><XCircle className="h-3 w-3" /> TELEGRAM_BOT_TOKEN not set in .env</Badge>
        }
        {s.channel_id_set
          ? <Badge variant="outline" className="gap-1"><CheckCircle className="h-3 w-3 text-green-500" /> Channel ID set via ENV</Badge>
          : <Badge variant="outline" className="gap-1 text-amber-600"><AlertTriangle className="h-3 w-3" /> TELEGRAM_CHANNEL_ID not set in .env</Badge>
        }
        {s.updated_at && (
          <span className="text-xs text-muted-foreground ml-auto">
            Last saved: {new Date(s.updated_at).toLocaleString()}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* ── Card 1: Schedule ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-500" /> Schedule
            </CardTitle>
            <CardDescription>How often and how many offers per message</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="font-medium">Bot enabled</Label>
              <Switch checked={s.enabled} onCheckedChange={v => update(['enabled'], v)} />
            </div>
            <div className="space-y-1">
              <Label>Send interval (hours)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={1} max={168}
                  value={s.interval_hours}
                  onChange={e => update(['interval_hours'], parseInt(e.target.value) || 12)}
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground">
                  = every {s.interval_hours < 24 ? `${s.interval_hours}h` : `${(s.interval_hours / 24).toFixed(1)}d`}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Offers per message</Label>
              <Input
                type="number" min={1} max={20}
                value={s.offers_per_message}
                onChange={e => update(['offers_per_message'], parseInt(e.target.value) || 7)}
                className="w-28"
              />
            </div>

            <div className="space-y-1">
              <Label>Lookback window (hours)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={1} max={720}
                  value={s.lookback_hours}
                  onChange={e => update(['lookback_hours'], parseInt(e.target.value) || 48)}
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground">
                  picks in last {s.lookback_hours}h
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Only includes offers that were picked/clicked in this window</p>
            </div>
          </CardContent>
        </Card>

        {/* ── Card 2: Content ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-indigo-500" /> Message Content
            </CardTitle>
            <CardDescription>What fields appear for each offer</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {([
              ['show_payout',       'Show payout ($)'],
              ['show_pick_count',   'Show pick count (🔥)'],
              ['show_country',      'Show country flag'],
              ['show_category',     'Show category'],
              ['show_tracking_link','Show tracking link'],
            ] as [string, string][]).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <Label className="font-normal">{label}</Label>
                <Switch
                  checked={(s.content as any)[key]}
                  onCheckedChange={v => update(['content', key], v)}
                />
              </div>
            ))}

            <div className="space-y-1 pt-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Custom Header</Label>
              <Textarea
                rows={2}
                placeholder="📊 *Top Offers Today*  (leave blank for default)"
                value={s.content.custom_header}
                onChange={e => update(['content', 'custom_header'], e.target.value)}
                className="text-sm resize-none"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Custom Footer</Label>
              <Textarea
                rows={2}
                placeholder="e.g. Visit moustacheleads.com to join"
                value={s.content.custom_footer}
                onChange={e => update(['content', 'custom_footer'], e.target.value)}
                className="text-sm resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Card 3: Filters ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4 text-indigo-500" /> Offer Filters
            </CardTitle>
            <CardDescription>Only send offers matching these criteria</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="font-normal">Only active offers</Label>
              <Switch
                checked={s.filters.only_active}
                onCheckedChange={v => update(['filters', 'only_active'], v)}
              />
            </div>

            <div className="space-y-1">
              <Label>Minimum payout ($)</Label>
              <Input
                type="number" min={0} step={0.5}
                value={s.filters.min_payout}
                onChange={e => update(['filters', 'min_payout'], parseFloat(e.target.value) || 0)}
                className="w-28"
              />
              <p className="text-xs text-muted-foreground">0 = no minimum</p>
            </div>

            <div className="space-y-2">
              <Label>Categories <span className="font-normal text-muted-foreground">(empty = all)</span></Label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map(cat => {
                  const active = s.filters.categories.includes(cat);
                  return (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                        active
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'border-border text-muted-foreground hover:border-indigo-400'
                      }`}
                    >
                      {cat.replace('_', ' ')}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Countries <span className="font-normal text-muted-foreground">(empty = all)</span></Label>
              <Input
                placeholder="US, DE, GB, AU  (comma-separated)"
                value={s.filters.countries.join(', ')}
                onChange={e => update(['filters', 'countries'],
                  e.target.value.split(',').map(x => x.trim().toUpperCase()).filter(Boolean)
                )}
                className="text-sm"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Preview panel ── */}
      {(previewText !== null || previewLoading) && (
        <Card className="border-indigo-200 dark:border-indigo-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4 text-indigo-500" /> Message Preview
            </CardTitle>
            <CardDescription>This is what will be sent to your channel</CardDescription>
          </CardHeader>
          <CardContent>
            {previewLoading
              ? <div className="flex items-center gap-2 py-4 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading preview…</div>
              : <pre className="text-sm bg-muted rounded-lg p-4 whitespace-pre-wrap font-mono leading-relaxed overflow-auto max-h-72">{previewText}</pre>
            }
          </CardContent>
        </Card>
      )}

      {/* ── Send history ── */}
      <Card>
        <CardHeader
          className="pb-2 cursor-pointer select-none"
          onClick={() => setHistoryOpen(o => !o)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4 text-indigo-500" /> Send History
              {history.length > 0 && <Badge variant="secondary" className="ml-1">{history.length}</Badge>}
            </CardTitle>
            {historyOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </CardHeader>

        {historyOpen && (
          <CardContent className="pt-0">
            {historyLoading
              ? <div className="flex items-center gap-2 py-4 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
              : history.length === 0
              ? <p className="text-sm text-muted-foreground py-4 text-center">No send history yet</p>
              : (
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  <div className="grid grid-cols-5 gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide pb-1 border-b px-1">
                    <span>Time</span>
                    <span>Trigger</span>
                    <span>Offers</span>
                    <span>Status</span>
                    <span>By</span>
                  </div>
                  {history.map((h, i) => (
                    <div key={i} className={`grid grid-cols-5 gap-2 text-xs px-1 py-1.5 rounded hover:bg-muted/40 ${h.status === 'error' ? 'text-red-600' : ''}`}>
                      <span className="text-muted-foreground">{new Date(h.sent_at).toLocaleString()}</span>
                      <span className="capitalize">{h.trigger}</span>
                      <span>{h.offer_count}</span>
                      <span className="flex items-center gap-1">
                        {h.status === 'ok'
                          ? <CheckCircle className="h-3 w-3 text-green-500" />
                          : <XCircle className="h-3 w-3 text-red-500" />
                        }
                        {h.status}
                      </span>
                      <span className="truncate text-muted-foreground">{h.triggered_by}</span>
                    </div>
                  ))}
                  {history.some(h => h.error) && (
                    <div className="pt-2 space-y-1">
                      {history.filter(h => h.error).slice(0, 3).map((h, i) => (
                        <div key={i} className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 rounded px-2 py-1">
                          <strong>{new Date(h.sent_at).toLocaleString()}:</strong> {h.error}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            }
            <Button variant="ghost" size="sm" onClick={fetchHistory} className="mt-2 gap-1 text-xs">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </CardContent>
        )}
      </Card>

      {/* ── Info box ── */}
      <div className="flex gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 border">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-indigo-400" />
        <p>
          The bot sends automatically on the configured interval. Changes to interval take effect on the next cycle without restarting the server.
          The <strong>Send Now</strong> button sends immediately regardless of schedule.
          Bot token is stored encrypted in MongoDB and never exposed in plain text after saving.
        </p>
      </div>

    </div>
  );
}

// Wrap with admin guard
export default function AdminTelegramSettingsPage() {
  return (
    <AdminPageGuard requiredTab="automation">
      <AdminTelegramSettings />
    </AdminPageGuard>
  );
}
