import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { TemplatePicker, TemplateName } from '@/components/survey-templates/SurveyTemplateRenderer';
import {
  getSurveyFunnels,
  createSurveyFunnel,
  updateSurveyFunnel,
  deleteSurveyFunnel,
  getSurveyFunnelHistory,
  SurveyFunnel,
  FunnelStep,
  FunnelQuestion,
  PassCriteria,
  PassRule,
} from '@/services/surveyFunnelApi';
import { getProviders, SurveyProvider } from '@/services/surveyRouterApi';
import { partnerApi, Partner } from '@/services/partnerApi';
import {
  fetchPepperwahlInbox, fetchPepperwahlEntry, processPepperwahlEntry,
  setPepperwahlPayout, setPepperwahlStatus, deletePepperwahlEntry,
  fetchPepperwahlStats, fetchPepperwahlEmailSettings, savePepperwahlEmailSettings,
  type PepperwahlInboxEntry, type PepperwahlStats, type PepperwahlEmailSettings,
} from '@/services/surveyApi';
import EmailSettingsPanel, { DEFAULT_EMAIL_SETTINGS, type EmailSettings } from '@/components/EmailSettingsPanel';
import { offerInsightsApi, type Partner as InsightPartner } from '@/services/offerInsightsApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Trash2,
  Play,
  Pause,
  ArrowRight,
  CheckCircle2,
  XCircle,
  ListOrdered,
  History,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Route,
  Inbox,
  Search,
  RefreshCw,
  DollarSign,
  RotateCcw,
  X,
  ChevronLeft,
  ChevronRight,
  Shield,
  Mail,
  Users,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

export default function AdminRedirectRouter() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<'list' | 'builder' | 'history' | 'pepperwahl'>('list');
  const [editingFunnel, setEditingFunnel] = useState<SurveyFunnel | null>(null);
  const [historyFunnelId, setHistoryFunnelId] = useState('');

  // Pepperwahl state
  const [pwInbox, setPwInbox] = useState<PepperwahlInboxEntry[]>([]);
  const [pwTotal, setPwTotal] = useState(0);
  const [pwPage, setPwPage] = useState(1);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSearch, setPwSearch] = useState('');
  const [pwStatusFilter, setPwStatusFilter] = useState('');
  const [pwStats, setPwStats] = useState<PepperwahlStats | null>(null);
  const [pwSelected, setPwSelected] = useState<PepperwahlInboxEntry | null>(null);
  const [pwDetailOpen, setPwDetailOpen] = useState(false);
  const [pwPayoutEdit, setPwPayoutEdit] = useState('');

  // Pepperwahl email settings state
  const [pwEmailSettings, setPwEmailSettings] = useState<PepperwahlEmailSettings>({
    enabled: false,
    template_style: 'table',
    payout_type: 'publisher',
    visible_fields: ['name', 'payout', 'countries', 'category', 'image', 'offer_id'],
    see_more_fields: [],
    default_image: '',
    payment_terms: '',
    recipient_mode: 'all',
    recipient_ids: [],
    custom_message: '',
  });
  const [pwEmailSettingsLoaded, setPwEmailSettingsLoaded] = useState(false);
  const [pwEmailSaving, setPwEmailSaving] = useState(false);
  const [pwEmailPanelOpen, setPwEmailPanelOpen] = useState(false);
  const [pwAllPartners, setPwAllPartners] = useState<InsightPartner[]>([]);
  const [pwPartnerSearch, setPwPartnerSearch] = useState('');

  // Map PepperwahlEmailSettings ↔ EmailSettings (the panel's format)
  const toEmailSettings = (s: PepperwahlEmailSettings): EmailSettings => ({
    templateStyle: s.template_style,
    payoutType: s.payout_type,
    visibleFields: s.visible_fields,
    seeMoreFields: s.see_more_fields,
    defaultImage: s.default_image,
    paymentTerms: s.payment_terms,
    maskPreviewLinks: false,
    customPaymentTerms: [],
    customPreviewUrl: '',
    customPreviewUrls: {},
    customPreviewMode: 'all',
    previewInEmail: 'both',
    customPreviewInEmail: 'both',
  });

  const fromEmailSettings = (e: EmailSettings): Partial<PepperwahlEmailSettings> => ({
    template_style: e.templateStyle,
    payout_type: e.payoutType,
    visible_fields: e.visibleFields,
    see_more_fields: e.seeMoreFields,
    default_image: e.defaultImage,
    payment_terms: e.paymentTerms,
  });

  const loadPwInbox = useCallback(async () => {
    setPwLoading(true);
    try {
      const [inboxRes, statsRes] = await Promise.all([
        fetchPepperwahlInbox({ page: pwPage, per_page: 15, search: pwSearch, status: pwStatusFilter }),
        fetchPepperwahlStats(),
      ]);
      if (inboxRes.success) { setPwInbox(inboxRes.inbox); setPwTotal(inboxRes.total); }
      if (statsRes.success) setPwStats(statsRes.stats);
    } catch { toast.error('Failed to load Pepperwahl inbox'); }
    setPwLoading(false);
  }, [pwPage, pwSearch, pwStatusFilter]);

  useEffect(() => { if (view === 'pepperwahl') loadPwInbox(); }, [view, loadPwInbox]);

  // Load email settings once when entering the pepperwahl view
  useEffect(() => {
    if (view === 'pepperwahl' && !pwEmailSettingsLoaded) {
      fetchPepperwahlEmailSettings().then(res => {
        if (res.success) { setPwEmailSettings(res.settings); }
        setPwEmailSettingsLoaded(true);
      }).catch(() => setPwEmailSettingsLoaded(true));
    }
  }, [view, pwEmailSettingsLoaded]);

  // Load all partners once for recipient picker
  useEffect(() => {
    if (view === 'pepperwahl' && pwAllPartners.length === 0) {
      offerInsightsApi.getPartners('', 'all').then(res => {
        if (res.success) setPwAllPartners(res.partners || []);
      }).catch(() => {});
    }
  }, [view, pwAllPartners.length]);

  const handlePwProcess = async (id: string) => {
    const res = await processPepperwahlEntry(id);
    if (res.success) { toast.success('Processed'); loadPwInbox(); }
    else toast.error(res.error || 'Failed');
  };

  const handlePwSetPayout = async (id: string) => {
    const val = parseFloat(pwPayoutEdit);
    if (isNaN(val) || val < 0) { toast.error('Enter valid amount'); return; }
    const res = await setPepperwahlPayout(id, val);
    if (res.success) { toast.success(res.message); setPwPayoutEdit(''); loadPwInbox(); }
    else toast.error(res.error || 'Failed');
  };

  const handlePwToggle = async (entry: PepperwahlInboxEntry) => {
    const newStatus = entry.status === 'active' ? 'paused' : 'active';
    const res = await setPepperwahlStatus(entry._id, newStatus);
    if (res.success) { toast.success(res.message); loadPwInbox(); }
    else toast.error(res.error || 'Failed');
  };

  const handlePwDelete = async (id: string) => {
    if (!confirm('Remove this entry?')) return;
    const res = await deletePepperwahlEntry(id);
    if (res.success) { toast.success('Removed'); setPwDetailOpen(false); loadPwInbox(); }
    else toast.error(res.error || 'Failed');
  };

  const openPwDetail = async (entry: PepperwahlInboxEntry) => {
    setPwSelected(entry);
    setPwPayoutEdit(String(entry.payout ?? 0));
    setPwDetailOpen(true);
    try {
      const res = await fetchPepperwahlEntry(entry._id);
      if (res.success) setPwSelected(res.entry);
    } catch { /* use cached */ }
  };

  const handleSaveEmailSettings = async (patch: Partial<PepperwahlEmailSettings>) => {
    setPwEmailSaving(true);
    const merged = { ...pwEmailSettings, ...patch };
    const res = await savePepperwahlEmailSettings(merged);
    setPwEmailSaving(false);
    if (res.success) {
      setPwEmailSettings(merged);
      toast.success('Email settings saved');
    } else {
      toast.error('Failed to save email settings');
    }
  };

  const handleToggleEmail = () => {
    handleSaveEmailSettings({ enabled: !pwEmailSettings.enabled });
  };

  // Fetch funnels
  const { data: funnelsData, isLoading } = useQuery({
    queryKey: ['survey-funnels'],
    queryFn: () => getSurveyFunnels(),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSurveyFunnel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['survey-funnels'] });
      toast.success('Funnel deleted');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateSurveyFunnel(id, { status } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['survey-funnels'] });
      toast.success('Status updated');
    },
  });

  const funnels: SurveyFunnel[] = funnelsData?.funnels || [];

  if (view === 'builder') {
    return (
      <FunnelBuilder
        funnel={editingFunnel}
        onBack={() => { setView('list'); setEditingFunnel(null); }}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['survey-funnels'] });
          setView('list');
          setEditingFunnel(null);
        }}
      />
    );
  }

  if (view === 'history') {
    return <FunnelHistory funnelId={historyFunnelId} onBack={() => setView('list')} />;
  }

  if (view === 'pepperwahl') {
    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setView('list')} className="p-1.5 hover:bg-muted rounded-lg">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Inbox className="h-6 w-6 text-violet-500" />
                Pepperwahl Inbox
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">Surveys published from Pepperwahl</p>
            </div>
          </div>
          <button onClick={loadPwInbox} className="p-2 border rounded-lg hover:bg-muted">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Stats */}
        {pwStats && (
          <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
            {[
              { label: 'Total', value: pwStats.total },
              { label: 'Pending', value: pwStats.pending, color: 'text-amber-600' },
              { label: 'Processed', value: pwStats.processed, color: 'text-violet-600' },
              { label: 'Active', value: pwStats.active, color: 'text-green-600' },
              { label: 'Paused', value: pwStats.paused },
              { label: 'Live Offers', value: pwStats.active_offers, color: 'text-green-600' },
              { label: 'Payout Exposure', value: `$${pwStats.total_payout_exposure}`, color: 'text-violet-600' },
            ].map(s => (
              <div key={s.label} className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                <p className={`text-xl font-bold ${s.color || ''}`}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* API info */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <Shield className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-800">Pepperwahl Publish Endpoint</p>
            <p className="text-xs font-mono text-amber-700 truncate">
              POST https://api.moustacheleads.com/api/external/pepperwahl/publish
            </p>
          </div>
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded font-mono flex-shrink-0">
            X-API-Key: pw_moustache_secret_key_2025
          </span>
        </div>

        {/* Email Notification Settings */}
        <div className={`border rounded-xl overflow-hidden transition-all ${pwEmailSettings.enabled ? 'border-violet-200 bg-violet-50/30' : 'border-border bg-muted/20'}`}>
          {/* Toggle row */}
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <Mail className={`h-5 w-5 ${pwEmailSettings.enabled ? 'text-violet-600' : 'text-muted-foreground'}`} />
              <div>
                <p className="text-sm font-semibold text-foreground">Auto Email Notification</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {pwEmailSettings.enabled
                    ? 'When Pepperwahl publishes a survey, publishers will be notified automatically'
                    : 'Toggle on to send publishers an email whenever a new Pepperwahl survey arrives'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {pwEmailSettings.enabled && (
                <button
                  onClick={() => setPwEmailPanelOpen(v => !v)}
                  className="text-xs text-violet-600 font-medium hover:underline flex items-center gap-1">
                  {pwEmailPanelOpen ? 'Hide' : 'Edit'} Template
                </button>
              )}
              <button
                onClick={handleToggleEmail}
                disabled={pwEmailSaving}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  pwEmailSettings.enabled ? 'bg-violet-600' : 'bg-gray-200'
                }`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  pwEmailSettings.enabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>

          {/* Expanded settings — only visible when toggle is ON */}
          {pwEmailSettings.enabled && pwEmailPanelOpen && (
            <div className="border-t px-5 py-4 space-y-4">

              {/* Recipients */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Recipients
                </p>
                <div className="flex gap-2 mb-3">
                  {(['all', 'include', 'exclude'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => handleSaveEmailSettings({ recipient_mode: mode, recipient_ids: [] })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors capitalize ${
                        pwEmailSettings.recipient_mode === mode
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-white text-muted-foreground border-border hover:bg-muted'
                      }`}>
                      {mode === 'all' ? '✦ All Publishers' : mode === 'include' ? '✓ Include Only' : '✕ Exclude'}
                    </button>
                  ))}
                </div>

                {/* Partner picker for include/exclude modes */}
                {(pwEmailSettings.recipient_mode === 'include' || pwEmailSettings.recipient_mode === 'exclude') && (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        value={pwPartnerSearch}
                        onChange={e => setPwPartnerSearch(e.target.value)}
                        placeholder="Search publishers..."
                        className="w-full pl-8 pr-3 py-1.5 border rounded-lg text-xs"
                      />
                    </div>
                    <div className="max-h-36 overflow-y-auto border rounded-lg divide-y bg-white">
                      {pwAllPartners
                        .filter(p => !pwPartnerSearch || p.username.toLowerCase().includes(pwPartnerSearch.toLowerCase()) || p.email.toLowerCase().includes(pwPartnerSearch.toLowerCase()))
                        .map(p => {
                          const selected = pwEmailSettings.recipient_ids.includes(p._id);
                          return (
                            <label key={p._id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/30 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => {
                                  const ids = selected
                                    ? pwEmailSettings.recipient_ids.filter(id => id !== p._id)
                                    : [...pwEmailSettings.recipient_ids, p._id];
                                  handleSaveEmailSettings({ recipient_ids: ids });
                                }}
                                className="accent-violet-600"
                              />
                              <span className="text-xs font-medium">{p.username}</span>
                              <span className="text-xs text-muted-foreground">{p.email}</span>
                            </label>
                          );
                        })}
                    </div>
                    {pwEmailSettings.recipient_ids.length > 0 && (
                      <p className="text-xs text-violet-600 font-medium">
                        {pwEmailSettings.recipient_ids.length} publisher{pwEmailSettings.recipient_ids.length !== 1 ? 's' : ''} selected
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Custom message */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Email Message <span className="normal-case font-normal">(optional — shown above offer card)</span>
                </p>
                <textarea
                  value={pwEmailSettings.custom_message}
                  onChange={e => setPwEmailSettings(s => ({ ...s, custom_message: e.target.value }))}
                  onBlur={() => handleSaveEmailSettings({ custom_message: pwEmailSettings.custom_message })}
                  placeholder="Please push more traffic on this survey!"
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                />
              </div>

              {/* EmailSettingsPanel — exact same component as offers section */}
              <EmailSettingsPanel
                settings={toEmailSettings(pwEmailSettings)}
                onChange={es => {
                  const patch = fromEmailSettings(es);
                  setPwEmailSettings(s => ({ ...s, ...patch }));
                  handleSaveEmailSettings(patch);
                }}
              />

            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={pwSearch} onChange={e => { setPwSearch(e.target.value); setPwPage(1); }}
              placeholder="Search surveys..." className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" />
          </div>
          <select value={pwStatusFilter} onChange={e => { setPwStatusFilter(e.target.value); setPwPage(1); }}
            className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="processed">Processed</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
        </div>

        {/* Table */}
        {pwLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : pwInbox.length === 0 ? (
          <div className="text-center py-16 border rounded-lg bg-muted/20">
            <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-40" />
            <p className="font-medium">No Pepperwahl surveys yet</p>
            <p className="text-sm text-muted-foreground mt-1">Surveys published by Pepperwahl will appear here automatically.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-card border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Survey</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Offer ID</th>
                  <th className="text-left px-4 py-3 font-medium">Payout</th>
                  <th className="text-left px-4 py-3 font-medium">Clicks</th>
                  <th className="text-left px-4 py-3 font-medium">Country / LOI</th>
                  <th className="text-left px-4 py-3 font-medium">Received</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pwInbox.map(entry => (
                  <tr key={entry._id} className="hover:bg-muted/30 cursor-pointer" onClick={() => openPwDetail(entry)}>
                    <td className="px-4 py-3">
                      <div className="font-medium truncate max-w-[180px]">{entry.payload.survey_name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{entry.payload.survey_id}</div>
                    </td>
                    <td className="px-4 py-3"><PwBadge status={entry.status} /></td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{entry.moustache_offer_id || '—'}</td>
                    <td className="px-4 py-3 font-semibold">
                      {entry.payout > 0 ? `$${entry.payout}` : <span className="text-amber-600 text-xs">Not set</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{entry.offer_details?.hits ?? 0}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {entry.payload.country && <span className="font-medium text-foreground">{entry.payload.country}</span>}
                      {entry.payload.loi_minutes && <span className="ml-1">· {entry.payload.loi_minutes}m</span>}
                      {!entry.payload.country && !entry.payload.loi_minutes && '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {entry.received_at ? new Date(entry.received_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1.5 justify-end">
                        {entry.status === 'pending' && (
                          <button onClick={() => handlePwProcess(entry._id)} title="Process"
                            className="p-1.5 text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50">
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {['processed','active','paused'].includes(entry.status) && (
                          <button onClick={() => handlePwToggle(entry)}
                            className={`p-1.5 border rounded-lg ${entry.status === 'active' ? 'text-amber-600 border-amber-200 hover:bg-amber-50' : 'text-green-600 border-green-200 hover:bg-green-50'}`}>
                            {entry.status === 'active' ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                          </button>
                        )}
                        <button onClick={() => handlePwDelete(entry._id)} title="Remove"
                          className="p-1.5 text-red-500 border border-red-100 rounded-lg hover:bg-red-50">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pwTotal > 15 && (
          <div className="flex justify-center gap-2">
            <button disabled={pwPage <= 1} onClick={() => setPwPage(p => p - 1)}
              className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 flex items-center gap-1">
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>
            <span className="px-3 py-1.5 text-sm text-muted-foreground">
              {pwPage} / {Math.ceil(pwTotal / 15)}
            </span>
            <button disabled={pwPage >= Math.ceil(pwTotal / 15)} onClick={() => setPwPage(p => p + 1)}
              className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 flex items-center gap-1">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Detail drawer */}
        {pwDetailOpen && pwSelected && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4"
            onClick={() => setPwDetailOpen(false)}>
            <div className="bg-white dark:bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 bg-white dark:bg-card border-b px-6 py-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg">{pwSelected.payload.survey_name}</h3>
                    <PwBadge status={pwSelected.status} />
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">{pwSelected.payload.survey_id}</p>
                </div>
                <button onClick={() => setPwDetailOpen(false)} className="p-1.5 hover:bg-muted rounded-lg">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                {/* IDs */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-violet-600 uppercase tracking-wider mb-1">Moustache Offer ID</p>
                    <p className="font-mono font-bold text-lg">{pwSelected.moustache_offer_id || <span className="text-muted-foreground text-sm">Not created</span>}</p>
                    {pwSelected.offer_details && (
                      <p className="text-xs text-violet-500 mt-1">{pwSelected.offer_details.status} · {pwSelected.offer_details.hits} clicks</p>
                    )}
                  </div>
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">Survey ID</p>
                    <p className="font-mono text-sm break-all">{pwSelected.moustache_survey_id || <span className="text-muted-foreground text-sm">Not created</span>}</p>
                  </div>
                </div>

                {/* Meta */}
                <div className="border rounded-xl p-4 space-y-2 text-sm">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-2">Survey Info</h4>
                  {[
                    ['Country', pwSelected.payload.country || '—'],
                    ['LOI', pwSelected.payload.loi_minutes ? `${pwSelected.payload.loi_minutes} minutes` : '—'],
                    ['Topic', pwSelected.payload.topic || pwSelected.payload.survey_name],
                    ['Questions', `${pwSelected.payload.questions?.length || 0} eligibility questions`],
                    ['Received', pwSelected.received_at ? new Date(pwSelected.received_at).toLocaleString() : '—'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-muted/40 pb-1.5 last:border-0 last:pb-0">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="font-medium">{v}</span>
                    </div>
                  ))}
                </div>

                {/* Survey link */}
                <div className="border rounded-xl p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Pepperwahl Link</p>
                  <div className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
                    <span className="text-xs font-mono truncate flex-1">{pwSelected.payload.survey_link}</span>
                    <a href={pwSelected.payload.survey_link} target="_blank" rel="noopener noreferrer" className="text-violet-600">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>

                {/* Questions */}
                <div className="border rounded-xl p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Eligibility Questions ({pwSelected.payload.questions?.length || 0})
                  </p>
                  <div className="space-y-3">
                    {(pwSelected.payload.questions || []).map((q, i) => (
                      <div key={i} className="bg-muted/30 rounded-lg p-3">
                        <p className="text-sm font-medium mb-2">
                          <span className="text-xs font-bold text-violet-600 mr-1">Q{i+1}</span>{q.question}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {(q.options || []).map(opt => {
                            const passes = (q.qualify_if || []).includes(opt);
                            return (
                              <span key={opt} className={`text-xs px-2.5 py-1 rounded-full font-medium border ${passes ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-50 text-red-400 border-red-200 line-through'}`}>
                                {passes && '✓ '}{opt}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Raw JSON */}
                <details className="border rounded-xl">
                  <summary className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:bg-muted/30">
                    Raw JSON from Pepperwahl
                  </summary>
                  <pre className="p-4 text-xs font-mono bg-muted/30 rounded-b-xl overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(pwSelected.payload, null, 2)}
                  </pre>
                </details>

                {/* Payout */}
                <div className="border rounded-xl p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Payout per Completion</p>
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1 max-w-xs">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input type="number" min="0" step="0.01" value={pwPayoutEdit}
                        onChange={e => setPwPayoutEdit(e.target.value)} placeholder="e.g. 2.50"
                        className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" />
                    </div>
                    <button onClick={() => handlePwSetPayout(pwSelected._id)}
                      className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700">
                      Set
                    </button>
                    {pwSelected.payout > 0 && <span className="text-sm text-muted-foreground">Current: <strong>${pwSelected.payout}</strong></span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 flex-wrap">
                  {pwSelected.status === 'pending' && (
                    <button onClick={() => { handlePwProcess(pwSelected._id); setPwDetailOpen(false); }}
                      className="flex-1 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 flex items-center justify-center gap-2">
                      <RotateCcw className="h-4 w-4" /> Process Now
                    </button>
                  )}
                  {['processed','active'].includes(pwSelected.status) && (
                    <button onClick={() => { handlePwToggle(pwSelected); setPwDetailOpen(false); }}
                      className="flex-1 py-2.5 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 flex items-center justify-center gap-2">
                      <Pause className="h-4 w-4" /> Pause Survey
                    </button>
                  )}
                  {pwSelected.status === 'paused' && (
                    <button onClick={() => { handlePwToggle(pwSelected); setPwDetailOpen(false); }}
                      className="flex-1 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 flex items-center justify-center gap-2">
                      <Play className="h-4 w-4" /> Activate
                    </button>
                  )}
                  <button onClick={() => handlePwDelete(pwSelected._id)}
                    className="px-5 py-2.5 border border-red-200 text-red-500 text-sm font-semibold rounded-xl hover:bg-red-50 flex items-center gap-2">
                    <Trash2 className="h-4 w-4" /> Remove
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Route className="h-6 w-6 text-blue-500" />
            Survey Funnel Router
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create survey chains that qualify users → redirect to offers or show next survey on fail
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setView('pepperwahl')} className="gap-1.5">
            <Inbox className="h-4 w-4 text-violet-500" />
            Pepperwahl Inbox
            {pwStats && pwStats.pending > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1">
                {pwStats.pending}
              </span>
            )}
          </Button>
          <Button variant="outline" onClick={() => { setHistoryFunnelId(''); setView('history'); }}>
            <History className="h-4 w-4 mr-2" /> History
          </Button>
          <Button onClick={() => { setEditingFunnel(null); setView('builder'); }}>
            <Plus className="h-4 w-4 mr-2" /> Create Funnel
          </Button>
        </div>
      </div>

      {/* Funnels List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading funnels...</div>
      ) : funnels.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-muted/20">
          <ListOrdered className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-lg font-medium">No survey funnels yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Create your first funnel to start qualifying users with surveys</p>
          <Button onClick={() => setView('builder')}>
            <Plus className="h-4 w-4 mr-2" /> Create First Funnel
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {funnels.map((funnel) => (
            <div key={funnel.funnel_id} className="border rounded-lg p-4 hover:bg-muted/30 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{funnel.name}</h3>
                    <Badge variant={funnel.status === 'active' ? 'default' : 'secondary'}>{funnel.status}</Badge>
                    <Badge variant="outline">{funnel.placement}</Badge>
                  </div>
                  {funnel.description && <p className="text-sm text-muted-foreground mt-1">{funnel.description}</p>}
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>{funnel.steps?.length || 0} survey step(s)</span>
                    <span>Starts: {funnel.stats?.total_starts || 0}</span>
                    <span className="text-green-600">Passes: {funnel.stats?.total_passes || 0}</span>
                    <span className="text-red-500">Fails: {funnel.stats?.total_fails || 0}</span>
                    <span className="font-mono text-[10px]">{funnel.funnel_id}</span>
                  </div>
                  {/* Funnel Link */}
                  <div className="mt-1">
                    <span className="text-xs text-muted-foreground mr-1">Link:</span>
                    <a
                      href={`${window.location.origin}/funnel/${funnel.funnel_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:text-blue-700 underline font-mono"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {window.location.hostname === 'localhost'
                        ? `${window.location.origin}/funnel/${funnel.funnel_id}`
                        : `https://survey.moustacheleads.com/funnel/${funnel.funnel_id}`}
                    </a>
                    <button
                      className="ml-2 text-xs text-gray-400 hover:text-gray-600"
                      title="Copy link"
                      onClick={(e) => {
                        e.stopPropagation();
                        const link = window.location.hostname === 'localhost'
                          ? `${window.location.origin}/funnel/${funnel.funnel_id}`
                          : `https://survey.moustacheleads.com/funnel/${funnel.funnel_id}`;
                        navigator.clipboard.writeText(link);
                        toast.success('Link copied!');
                      }}
                    >
                      📋
                    </button>
                  </div>
                  {/* Visual flow */}
                  <div className="flex items-center gap-1 mt-3 flex-wrap">
                    {funnel.steps?.map((step, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <div className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded font-medium">
                          {step.survey_title || `Survey ${i + 1}`}
                        </div>
                        {i < (funnel.steps?.length || 0) - 1 && (
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    ))}
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <div className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded font-medium">Fail</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-4">
                  <Button variant="ghost" size="icon" className="h-8 w-8" title={funnel.status === 'active' ? 'Pause' : 'Activate'}
                    onClick={() => toggleMutation.mutate({ id: funnel.funnel_id, status: funnel.status === 'active' ? 'paused' : 'active' })}>
                    {funnel.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="History"
                    onClick={() => { setHistoryFunnelId(funnel.funnel_id); setView('history'); }}>
                    <History className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit"
                    onClick={() => { setEditingFunnel(funnel); setView('builder'); }}>
                    <ListOrdered className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" title="Delete"
                    onClick={() => { if (confirm(`Delete "${funnel.name}"?`)) deleteMutation.mutate(funnel.funnel_id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ==================== FUNNEL BUILDER (Full Screen) ====================

function FunnelBuilder({ funnel, onBack, onSaved }: { funnel: SurveyFunnel | null; onBack: () => void; onSaved: () => void }) {
  const isEdit = !!funnel;
  const [name, setName] = useState(funnel?.name || '');
  const [description, setDescription] = useState(funnel?.description || '');
  const [placement, setPlacement] = useState(funnel?.placement || 'everywhere');
  const [placementOfferId, setPlacementOfferId] = useState(funnel?.placement_offer_id || '');
  const [surveyTemplate, setSurveyTemplate] = useState<string>((funnel as any)?.survey_template || 'modern-card');
  const [questionsPerPage, setQuestionsPerPage] = useState<number>((funnel as any)?.questions_per_page || 0);
  const [spinnerDuration, setSpinnerDuration] = useState<number>((funnel as any)?.spinner_duration || 8);
  const [surveyTimeout, setSurveyTimeoutVal] = useState<number>((funnel as any)?.survey_timeout || 5);
  const [failMessage, setFailMessage] = useState(funnel?.fail_message || 'Sorry, you do not qualify for any offers at this time.');
  const [displayTitle, setDisplayTitle] = useState((funnel as any)?.display_title || funnel?.name || '');
  const [displayDescription, setDisplayDescription] = useState((funnel as any)?.display_description || 'Complete this survey to unlock a special offer!');
  const [displayImageUrl, setDisplayImageUrl] = useState((funnel as any)?.display_image_url || '');
  const [displayPayout, setDisplayPayout] = useState((funnel as any)?.display_payout || 0);
  const [displayCategory, setDisplayCategory] = useState((funnel as any)?.display_category || 'SURVEY');
  const [steps, setSteps] = useState<FunnelStep[]>(funnel?.steps || [createEmptyStep(1)]);
  const [expandedStep, setExpandedStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Offer-level fields (used when publishing as offer)
  const [offerCountries, setOfferCountries] = useState((funnel as any)?.countries?.join(', ') || '');
  const [offerDeviceTargeting, setOfferDeviceTargeting] = useState((funnel as any)?.device_targeting || 'all');
  const [offerApprovalType, setOfferApprovalType] = useState((funnel as any)?.approval_type || 'manual');
  const [offerType, setOfferType] = useState((funnel as any)?.offer_type || 'CPA');
  const [offerConversionGoal, setOfferConversionGoal] = useState((funnel as any)?.conversion_goal || 'Survey completion');
  const [offerPublisherPayout, setOfferPublisherPayout] = useState((funnel as any)?.publisher_payout_override || '');
  const [offerExpirationDate, setOfferExpirationDate] = useState((funnel as any)?.expiration_date || '');
  const [offerDailyCap, setOfferDailyCap] = useState((funnel as any)?.daily_cap || '');
  const [offerWeeklyCap, setOfferWeeklyCap] = useState((funnel as any)?.weekly_cap || '');
  const [offerMonthlyCap, setOfferMonthlyCap] = useState((funnel as any)?.monthly_cap || '');
  const [offerLanguages, setOfferLanguages] = useState((funnel as any)?.languages?.join(', ') || '');

  // Fetch upward partners for the survey router dropdown
  const { data: partnersData } = useQuery({
    queryKey: ['partners-for-router'],
    queryFn: () => partnerApi.getPartners('active'),
  });
  const partners: Partner[] = partnersData?.partners || [];

  function createEmptyStep(num: number): FunnelStep {
    return {
      survey_title: `Survey ${num}`,
      questions: [{ text: '', options: ['', ''] }],
      pass_criteria: { mode: 'all', rules: [] },
      pass_url: '',
      pass_message: 'Congratulations! You qualify.',
      fail_message: "You didn't qualify. Try the next one!",
    };
  }

  const addStep = () => {
    setSteps([...steps, createEmptyStep(steps.length + 1)]);
    setExpandedStep(steps.length);
  };

  const removeStep = (idx: number) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter((_, i) => i !== idx));
    if (expandedStep >= steps.length - 1) setExpandedStep(Math.max(0, steps.length - 2));
  };

  const updateStep = (idx: number, updates: Partial<FunnelStep>) => {
    const updated = [...steps];
    updated[idx] = { ...updated[idx], ...updates };
    setSteps(updated);
  };

  const addQuestion = (stepIdx: number) => {
    const updated = [...steps];
    updated[stepIdx].questions.push({ text: '', options: ['', ''] });
    setSteps(updated);
  };

  const removeQuestion = (stepIdx: number, qIdx: number) => {
    const updated = [...steps];
    if (updated[stepIdx].questions.length <= 1) return;
    updated[stepIdx].questions = updated[stepIdx].questions.filter((_, i) => i !== qIdx);
    setSteps(updated);
  };

  const updateQuestion = (stepIdx: number, qIdx: number, field: 'text' | 'options', value: any) => {
    const updated = [...steps];
    if (field === 'text') {
      updated[stepIdx].questions[qIdx].text = value;
    } else {
      updated[stepIdx].questions[qIdx].options = value;
    }
    setSteps(updated);
  };

  const addOption = (stepIdx: number, qIdx: number) => {
    const updated = [...steps];
    updated[stepIdx].questions[qIdx].options.push('');
    setSteps(updated);
  };

  const removeOption = (stepIdx: number, qIdx: number, optIdx: number) => {
    const updated = [...steps];
    if (updated[stepIdx].questions[qIdx].options.length <= 2) return;
    updated[stepIdx].questions[qIdx].options = updated[stepIdx].questions[qIdx].options.filter((_, i) => i !== optIdx);
    setSteps(updated);
  };

  const updateOption = (stepIdx: number, qIdx: number, optIdx: number, value: string) => {
    const updated = [...steps];
    updated[stepIdx].questions[qIdx].options[optIdx] = value;
    setSteps(updated);
  };

  const toggleAcceptedAnswer = (stepIdx: number, qIdx: number, answer: string) => {
    const updated = [...steps];
    const criteria = updated[stepIdx].pass_criteria;
    const existingRule = criteria.rules.find(r => r.question_index === qIdx);
    if (existingRule) {
      if (existingRule.accepted_answers.includes(answer)) {
        existingRule.accepted_answers = existingRule.accepted_answers.filter(a => a !== answer);
        if (existingRule.accepted_answers.length === 0) {
          criteria.rules = criteria.rules.filter(r => r.question_index !== qIdx);
        }
      } else {
        existingRule.accepted_answers.push(answer);
      }
    } else {
      criteria.rules.push({ question_index: qIdx, accepted_answers: [answer] });
    }
    setSteps(updated);
  };

  const isAccepted = (stepIdx: number, qIdx: number, answer: string) => {
    const rule = steps[stepIdx].pass_criteria.rules.find(r => r.question_index === qIdx);
    return rule?.accepted_answers.includes(answer) || false;
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Funnel name is required'); return; }
    if (steps.some(s => !s.pass_url.trim())) { toast.error('Each step needs a redirect URL'); return; }

    setSaving(true);
    try {
      const payload: any = {
        name, description, placement, placement_offer_id: placementOfferId, steps, fail_message: failMessage,
        display_title: displayTitle || name, display_description: displayDescription, display_image_url: displayImageUrl,
        display_payout: displayPayout, display_category: displayCategory, survey_template: surveyTemplate,
        questions_per_page: questionsPerPage, spinner_duration: spinnerDuration, survey_timeout: surveyTimeout,
        // Offer-level fields
        countries: offerCountries ? offerCountries.split(',').map((c: string) => c.trim().toUpperCase()).filter(Boolean) : [],
        device_targeting: offerDeviceTargeting,
        approval_type: offerApprovalType,
        offer_type: offerType,
        conversion_goal: offerConversionGoal,
        languages: offerLanguages ? offerLanguages.split(',').map((l: string) => l.trim()).filter(Boolean) : [],
      };
      if (offerPublisherPayout !== '') payload.publisher_payout_override = parseFloat(String(offerPublisherPayout));
      if (offerExpirationDate) payload.expiration_date = offerExpirationDate;
      if (offerDailyCap !== '') payload.daily_cap = parseInt(String(offerDailyCap));
      if (offerWeeklyCap !== '') payload.weekly_cap = parseInt(String(offerWeeklyCap));
      if (offerMonthlyCap !== '') payload.monthly_cap = parseInt(String(offerMonthlyCap));

      if (isEdit) {
        await updateSurveyFunnel(funnel!.funnel_id, payload as any);
        toast.success('Funnel updated');
      } else {
        await createSurveyFunnel(payload as any);
        toast.success('Funnel created');
      }
      onSaved();
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onBack}>← Back</Button>
          <h1 className="text-xl font-bold">{isEdit ? 'Edit Funnel' : 'Create Survey Funnel'}</h1>
        </div>
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Funnel'}</Button>
      </div>

      {/* Basic Info */}
      <div className="border rounded-lg p-4 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Funnel Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Funnel Name *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. US Health Insurance Qualifier" />
          </div>
          <div>
            <label className="text-sm font-medium">Show Where</label>
            <Select value={placement} onValueChange={setPlacement}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="everywhere">Everywhere (all placements)</SelectItem>
                <SelectItem value="iframe">Iframe Only</SelectItem>
                <SelectItem value="offerwall">Main Offerwall Only</SelectItem>
                <SelectItem value="specific_offer">Before Specific Offer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {placement === 'specific_offer' && (
          <div>
            <label className="text-sm font-medium">Offer ID (show before this offer)</label>
            <Input value={placementOfferId} onChange={(e) => setPlacementOfferId(e.target.value)} placeholder="e.g. ML-02242" />
          </div>
        )}
        <div>
          <label className="text-sm font-medium">Description</label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional internal note" />
        </div>
        <div>
          <label className="text-sm font-medium">Final Fail Message (shown when user fails ALL surveys)</label>
          <Textarea value={failMessage} onChange={(e) => setFailMessage(e.target.value)} rows={2} />
        </div>
      </div>

      {/* Survey Template */}
      <div className="border rounded-lg p-4 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Survey Template (how questions are displayed to users)</h2>
        <TemplatePicker
          value={surveyTemplate as TemplateName}
          onChange={(t) => setSurveyTemplate(t)}
          questions={steps[0]?.questions?.map(q => ({ text: q.text, options: q.options })) || []}
        />
        {/* Questions per page setting */}
        <div className="border-t pt-4 mt-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium">Questions Per Page</label>
              <p className="text-xs text-muted-foreground mt-0.5">How many questions to show on each page. Set to 0 to show all at once.</p>
            </div>
            <Select value={String(questionsPerPage)} onValueChange={(v) => setQuestionsPerPage(Number(v))}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">All at once</SelectItem>
                <SelectItem value="1">1 per page</SelectItem>
                <SelectItem value="2">2 per page</SelectItem>
                <SelectItem value="3">3 per page</SelectItem>
                <SelectItem value="4">4 per page</SelectItem>
                <SelectItem value="5">5 per page</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Spinner & Timeout settings */}
        <div className="border-t pt-4 mt-4 space-y-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Transition & Timing</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Spinner Duration (seconds)</label>
              <p className="text-xs text-muted-foreground mt-0.5">How long to show the loading spinner between steps.</p>
              <Input type="number" min={1} max={30} value={spinnerDuration} onChange={(e) => setSpinnerDuration(Number(e.target.value))} className="mt-1.5" />
            </div>
            <div>
              <label className="text-sm font-medium">Survey Timeout (minutes)</label>
              <p className="text-xs text-muted-foreground mt-0.5">Auto-reload if user spends more than this time. Set 0 to disable.</p>
              <Input type="number" min={0} max={60} value={surveyTimeout} onChange={(e) => setSurveyTimeoutVal(Number(e.target.value))} className="mt-1.5" />
            </div>
          </div>
        </div>
      </div>

      {/* Offer Card Appearance */}
      <div className="border rounded-lg p-4 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Offer Card Appearance (how it looks on the offerwall)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Display Title (shown to users)</label>
            <Input value={displayTitle} onChange={(e) => setDisplayTitle(e.target.value)} placeholder="e.g. Quick Health Survey" />
          </div>
          <div>
            <label className="text-sm font-medium">Category</label>
            <Select value={displayCategory} onValueChange={setDisplayCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SURVEY">Survey</SelectItem>
                <SelectItem value="HEALTH">Health</SelectItem>
                <SelectItem value="INSURANCE">Insurance</SelectItem>
                <SelectItem value="FINANCE">Finance</SelectItem>
                <SelectItem value="EDUCATION">Education</SelectItem>
                <SelectItem value="INSTALLS">Installs</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Display Description</label>
          <Input value={displayDescription} onChange={(e) => setDisplayDescription(e.target.value)} placeholder="Complete this survey to unlock a special offer!" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Image URL (offer card image)</label>
            <Input value={displayImageUrl} onChange={(e) => setDisplayImageUrl(e.target.value)} placeholder="https://example.com/image.jpg" />
            {displayImageUrl && (
              <img src={displayImageUrl} alt="Preview" className="mt-2 h-20 w-auto rounded border object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
            )}
          </div>
          <div>
            <label className="text-sm font-medium">Display Payout (points shown to user)</label>
            <Input type="number" min={0} value={displayPayout} onChange={(e) => setDisplayPayout(Number(e.target.value))} placeholder="e.g. 50" />
          </div>
        </div>
      </div>

      {/* Offer Publishing Fields */}
      <div className="border rounded-lg p-4 space-y-4 border-purple-200 bg-purple-50/30">
        <div>
          <h2 className="font-semibold text-sm text-purple-700 uppercase tracking-wide">Offer Publishing Settings</h2>
          <p className="text-xs text-muted-foreground mt-0.5">These fields are used when you "Publish as Offer" from the Offers page. Fill them now so the modal is pre-populated.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Approval Type</label>
            <Select value={offerApprovalType} onValueChange={setOfferApprovalType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual (admin reviews)</SelectItem>
                <SelectItem value="auto_approve">Auto Approve</SelectItem>
                <SelectItem value="time_based">Time Based</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Offer Type</label>
            <Select value={offerType} onValueChange={setOfferType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CPA">CPA</SelectItem>
                <SelectItem value="CPL">CPL</SelectItem>
                <SelectItem value="CPS">CPS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Device Targeting</label>
            <Select value={offerDeviceTargeting} onValueChange={setOfferDeviceTargeting}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Devices</SelectItem>
                <SelectItem value="mobile">Mobile Only</SelectItem>
                <SelectItem value="desktop">Desktop Only</SelectItem>
                <SelectItem value="tablet">Tablet Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Conversion Goal</label>
            <Input value={offerConversionGoal} onChange={(e) => setOfferConversionGoal(e.target.value)} placeholder="Survey completion" />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium">Countries (comma-separated, blank = Global)</label>
            <Input value={offerCountries} onChange={(e) => setOfferCountries(e.target.value)} placeholder="US, UK, CA — leave blank for global" />
          </div>
          <div>
            <label className="text-sm font-medium">Languages (comma-separated)</label>
            <Input value={offerLanguages} onChange={(e) => setOfferLanguages(e.target.value)} placeholder="EN, ES" />
          </div>
          <div>
            <label className="text-sm font-medium">Publisher Payout Override ($)</label>
            <Input type="number" min={0} step={0.01} value={offerPublisherPayout} onChange={(e) => setOfferPublisherPayout(e.target.value)} placeholder="Leave blank = auto 80% of payout" />
          </div>
          <div>
            <label className="text-sm font-medium">Expiry Date</label>
            <Input type="date" value={offerExpirationDate} onChange={(e) => setOfferExpirationDate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Daily Cap</label>
            <Input type="number" min={0} value={offerDailyCap} onChange={(e) => setOfferDailyCap(e.target.value)} placeholder="Unlimited" />
          </div>
          <div>
            <label className="text-sm font-medium">Weekly Cap</label>
            <Input type="number" min={0} value={offerWeeklyCap} onChange={(e) => setOfferWeeklyCap(e.target.value)} placeholder="Unlimited" />
          </div>
          <div>
            <label className="text-sm font-medium">Monthly Cap</label>
            <Input type="number" min={0} value={offerMonthlyCap} onChange={(e) => setOfferMonthlyCap(e.target.value)} placeholder="Unlimited" />
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Survey Steps ({steps.length})</h2>
          <Button variant="outline" size="sm" onClick={addStep}><Plus className="h-3 w-3 mr-1" /> Add Step</Button>
        </div>

        {/* Visual Flow */}
        <div className="flex items-center gap-2 flex-wrap p-3 bg-muted/30 rounded-lg border">
          <span className="text-xs font-medium text-muted-foreground">Flow:</span>
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                <span className="font-bold">{i + 1}.</span> {step.survey_title}
                <span className="text-[10px] text-blue-500 ml-1">→ {step.use_survey_router ? '🔀 Router' : step.pass_url ? '✓ Offer' : '⚠ No URL'}</span>
              </div>
              {i < steps.length - 1 && <span className="text-red-400 text-xs font-medium">fail →</span>}
            </div>
          ))}
          <span className="text-red-400 text-xs font-medium">fail →</span>
          <div className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded font-medium">End (fail message)</div>
        </div>

        {/* Step Cards */}
        {steps.map((step, stepIdx) => (
          <div key={stepIdx} className="border rounded-lg overflow-hidden">
            {/* Step Header */}
            <div
              className="flex items-center justify-between p-3 bg-muted/40 cursor-pointer"
              onClick={() => setExpandedStep(expandedStep === stepIdx ? -1 : stepIdx)}
            >
              <div className="flex items-center gap-2">
                <span className="bg-blue-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">{stepIdx + 1}</span>
                <span className="font-medium">{step.survey_title}</span>
                <Badge variant="outline" className="text-xs">{step.questions.length} Q</Badge>
                {step.use_survey_router && <Badge className="text-xs bg-purple-100 text-purple-700">Survey Router</Badge>}
                {!step.use_survey_router && step.pass_url && <Badge className="text-xs bg-green-100 text-green-700">Has redirect</Badge>}
              </div>
              <div className="flex items-center gap-1">
                {steps.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={(e) => { e.stopPropagation(); removeStep(stepIdx); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
                {expandedStep === stepIdx ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>

            {/* Step Body */}
            {expandedStep === stepIdx && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Survey Title</label>
                    <Input value={step.survey_title} onChange={(e) => updateStep(stepIdx, { survey_title: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{step.use_survey_router ? 'External Survey URL *' : 'Redirect URL on Pass *'}</label>
                    <Input
                      value={step.pass_url}
                      onChange={(e) => updateStep(stepIdx, { pass_url: e.target.value })}
                      placeholder={step.use_survey_router ? 'https://partner-survey.com/survey/123' : 'https://offer-link.com/...'}
                    />
                  </div>
                </div>

                {/* Survey Router Toggle */}
                <div className="border rounded-lg p-3 bg-purple-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Route className="h-4 w-4 text-purple-600" />
                        Use Survey Router
                      </label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Route user to an external survey (partner) and wait for postback result
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateStep(stepIdx, { use_survey_router: !step.use_survey_router })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        step.use_survey_router ? 'bg-purple-600' : 'bg-gray-200'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        step.use_survey_router ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  {step.use_survey_router && (
                    <div className="space-y-3 pt-2 border-t">
                      {/* Partner Selection */}
                      <div>
                        <label className="text-sm font-medium">Upward Partner</label>
                        <p className="text-xs text-muted-foreground">The partner whose postback will confirm survey completion</p>
                        {partners.length === 0 ? (
                          <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded mt-1">
                            No active partners found. Create one in Partners section first.
                          </p>
                        ) : (
                          <Select
                            value={step.router_partner_id || ''}
                            onValueChange={(v) => updateStep(stepIdx, { router_partner_id: v })}
                          >
                            <SelectTrigger className="mt-1"><SelectValue placeholder="Select partner..." /></SelectTrigger>
                            <SelectContent>
                              {partners.map((p) => (
                                <SelectItem key={p.partner_id} value={p.partner_id}>
                                  {p.partner_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      {/* Scenario: Same Tab vs New Tab */}
                      <div>
                        <label className="text-sm font-medium">Redirect Behavior</label>
                        <div className="flex gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() => updateStep(stepIdx, { router_scenario: 'same_tab' })}
                            className={`flex-1 p-3 rounded-lg border-2 text-left transition-all ${
                              step.router_scenario === 'same_tab'
                                ? 'border-purple-500 bg-purple-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <p className="text-sm font-medium">Same Tab</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Redirect user in same tab. Partner redirects back when done.
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => updateStep(stepIdx, { router_scenario: 'new_tab' })}
                            className={`flex-1 p-3 rounded-lg border-2 text-left transition-all ${
                              step.router_scenario === 'new_tab'
                                ? 'border-purple-500 bg-purple-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <p className="text-sm font-medium">New Tab</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Open survey in new tab. Show spinner and poll for postback.
                            </p>
                          </button>
                        </div>
                      </div>

                      {step.router_partner_id && (
                        <p className="text-xs text-purple-600 bg-purple-50 p-2 rounded">
                          ✓ When user passes qualification → redirected to pass_url (survey link).
                          Partner &quot;{partners.find(p => p.partner_id === step.router_partner_id)?.partner_name}&quot; fires postback to confirm result.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Pass Message</label>
                    <Input value={step.pass_message || ''} onChange={(e) => updateStep(stepIdx, { pass_message: e.target.value })} placeholder="Congratulations!" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Fail Message (before next survey)</label>
                    <Input value={step.fail_message || ''} onChange={(e) => updateStep(stepIdx, { fail_message: e.target.value })} placeholder="You didn't qualify. Try next!" />
                  </div>
                </div>

                {/* Pass Criteria Mode */}
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium">Pass if user matches:</label>
                  <Select value={step.pass_criteria.mode} onValueChange={(v: any) => {
                    const updated = [...steps];
                    updated[stepIdx].pass_criteria.mode = v;
                    setSteps(updated);
                  }}>
                    <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ALL marked answers</SelectItem>
                      <SelectItem value="any">ANY marked answer</SelectItem>
                      <SelectItem value="min_count">At least N answers</SelectItem>
                    </SelectContent>
                  </Select>
                  {step.pass_criteria.mode === 'min_count' && (
                    <Input
                      type="number" min={1} className="w-20"
                      value={step.pass_criteria.min_count || 1}
                      onChange={(e) => {
                        const updated = [...steps];
                        updated[stepIdx].pass_criteria.min_count = Number(e.target.value);
                        setSteps(updated);
                      }}
                    />
                  )}
                </div>

                {/* Questions */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Questions</label>
                    <Button variant="outline" size="sm" onClick={() => addQuestion(stepIdx)}><Plus className="h-3 w-3 mr-1" /> Add Question</Button>
                  </div>

                  {step.questions.map((q, qIdx) => (
                    <div key={qIdx} className="border rounded-lg p-3 space-y-3 bg-background">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground">Q{qIdx + 1}</span>
                        <Input
                          value={q.text}
                          onChange={(e) => updateQuestion(stepIdx, qIdx, 'text', e.target.value)}
                          placeholder="Enter your question..."
                          className="flex-1"
                        />
                        {step.questions.length > 1 && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeQuestion(stepIdx, qIdx)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>

                      <div className="pl-6 space-y-2">
                        <p className="text-xs text-muted-foreground">Options (click green ✓ to mark as "pass" answer):</p>
                        {q.options.map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => { if (opt.trim()) toggleAcceptedAnswer(stepIdx, qIdx, opt); }}
                              className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors ${
                                isAccepted(stepIdx, qIdx, opt)
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : 'border-gray-300 text-gray-300 hover:border-green-400'
                              }`}
                              title={isAccepted(stepIdx, qIdx, opt) ? 'This is a PASS answer' : 'Click to mark as PASS answer'}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                            </button>
                            <Input
                              value={opt}
                              onChange={(e) => updateOption(stepIdx, qIdx, optIdx, e.target.value)}
                              placeholder={`Option ${optIdx + 1}`}
                              className="flex-1 h-8 text-sm"
                            />
                            {q.options.length > 2 && (
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeOption(stepIdx, qIdx, optIdx)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button variant="ghost" size="sm" className="text-xs" onClick={() => addOption(stepIdx, qIdx)}>
                          + Add Option
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== FUNNEL HISTORY ====================

function FunnelHistory({ funnelId, onBack }: { funnelId: string; onBack: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['survey-funnel-history', funnelId],
    queryFn: () => getSurveyFunnelHistory(funnelId || undefined),
  });

  const history = data?.history || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onBack}>← Back</Button>
        <h1 className="text-xl font-bold">Funnel History</h1>
        {funnelId && <Badge variant="outline">{funnelId}</Badge>}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading history...</div>
      ) : history.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No history records yet</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Session</th>
                <th className="text-left p-3 font-medium">User</th>
                <th className="text-left p-3 font-medium">Funnel</th>
                <th className="text-center p-3 font-medium">Steps</th>
                <th className="text-center p-3 font-medium">Result</th>
                <th className="text-left p-3 font-medium">Redirect</th>
                <th className="text-left p-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {history.map((h: any) => (
                <tr key={h.session_id} className="hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{h.session_id}</td>
                  <td className="p-3 text-xs">{h.user_id}</td>
                  <td className="p-3 text-xs font-mono">{h.funnel_id}</td>
                  <td className="p-3 text-center">{h.responses?.length || 0}</td>
                  <td className="p-3 text-center">
                    {h.result === 'passed' ? (
                      <Badge className="bg-green-100 text-green-700">Passed (Step {(h.passed_at_step || 0) + 1})</Badge>
                    ) : h.result === 'failed' ? (
                      <Badge className="bg-red-100 text-red-700">Failed All</Badge>
                    ) : (
                      <Badge variant="secondary">In Progress</Badge>
                    )}
                  </td>
                  <td className="p-3 text-xs truncate max-w-[200px]">{h.redirect_url || '—'}</td>
                  <td className="p-3 text-xs">{h.started_at ? new Date(h.started_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Pepperwahl status badge ───────────────────────────────────────────────────
function PwBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending:   { label: 'Pending',   cls: 'bg-amber-100 text-amber-700' },
    processed: { label: 'Processed', cls: 'bg-violet-100 text-violet-700' },
    active:    { label: 'Active',    cls: 'bg-green-100 text-green-700' },
    paused:    { label: 'Paused',    cls: 'bg-gray-100 text-gray-600' },
    deleted:   { label: 'Deleted',   cls: 'bg-red-100 text-red-600' },
  };
  const s = map[status] || { label: status, cls: 'bg-muted text-muted-foreground' };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${s.cls}`}>{s.label}</span>;
}
