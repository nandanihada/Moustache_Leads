/**
 * Reusable Email Settings Panel
 * - Template style (table/card), field toggles (visible / see-more / hidden)
 * - Default image, payout type, payment terms
 * - Masked preview links with dual preview support
 * - Custom preview URL (admin-added at send time, not saved to DB)
 * - Control where each preview link shows: email, see-more page, or both
 * Settings persist in localStorage across all email sending dialogs.
 */
import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  LayoutGrid, Table2, Image, Settings2, Eye, EyeOff, Link2, Plus, X,
  CreditCard, ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react';

const ALL_FIELDS = [
  { key: 'name', label: 'Offer Name', default: true },
  { key: 'payout', label: 'Payout', default: true },
  { key: 'countries', label: 'Countries', default: true },
  { key: 'category', label: 'Category', default: true },
  { key: 'network', label: 'Network', default: true },
  { key: 'image', label: 'Image', default: true },
  { key: 'offer_id', label: 'Offer ID', default: true },
  { key: 'preview_url', label: 'Preview URL', default: false },
  { key: 'clicks', label: 'Clicks', default: false },
  { key: 'payment_terms', label: 'Payment Terms', default: false },
  { key: 'description', label: 'Description', default: false },
];

const PAYMENT_TERM_PRESETS = ['Net 7', 'Net 15', 'Net 20', 'Net 30', 'Net 60', 'Net 90', 'Weekly', 'Bi-Weekly'];

export type PreviewVisibility = 'email' | 'page' | 'both';

export interface EmailSettings {
  templateStyle: 'table' | 'card';
  visibleFields: string[];
  seeMoreFields: string[];
  defaultImage: string;
  payoutType: 'publisher' | 'admin';
  maskPreviewLinks: boolean;
  paymentTerms: string;
  customPaymentTerms: string[];
  customPreviewUrl: string;
  customPreviewUrls: Record<string, string>;
  customPreviewMode: 'all' | 'individual';
  previewInEmail: PreviewVisibility;
  customPreviewInEmail: PreviewVisibility;
}

const STORAGE_KEY = 'ml_email_settings';

function loadSavedSettings(): EmailSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        templateStyle: parsed.templateStyle || 'table',
        visibleFields: Array.isArray(parsed.visibleFields) ? parsed.visibleFields : ALL_FIELDS.filter(f => f.default).map(f => f.key),
        seeMoreFields: Array.isArray(parsed.seeMoreFields) ? parsed.seeMoreFields : [],
        defaultImage: parsed.defaultImage || '',
        payoutType: parsed.payoutType || 'publisher',
        maskPreviewLinks: parsed.maskPreviewLinks ?? false,
        paymentTerms: parsed.paymentTerms || '',
        customPaymentTerms: Array.isArray(parsed.customPaymentTerms) ? parsed.customPaymentTerms : [],
        customPreviewUrl: parsed.customPreviewUrl || '',
        customPreviewUrls: parsed.customPreviewUrls || {},
        customPreviewMode: parsed.customPreviewMode || 'all',
        previewInEmail: parsed.previewInEmail || 'both',
        customPreviewInEmail: parsed.customPreviewInEmail || 'both',
      };
    }
  } catch {}
  return {
    templateStyle: 'table',
    visibleFields: ALL_FIELDS.filter(f => f.default).map(f => f.key),
    seeMoreFields: [],
    defaultImage: '',
    payoutType: 'publisher',
    maskPreviewLinks: false,
    paymentTerms: '',
    customPaymentTerms: [],
    customPreviewUrl: '',
    customPreviewUrls: {},
    customPreviewMode: 'all',
    previewInEmail: 'both',
    customPreviewInEmail: 'both',
  };
}

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = loadSavedSettings();

interface Props {
  settings: EmailSettings;
  onChange: (settings: EmailSettings) => void;
  compact?: boolean;
  offerIds?: string[];
  offerNames?: Record<string, string>;
}

function VisibilityToggle({ value, onChange, label }: { value: PreviewVisibility; onChange: (v: PreviewVisibility) => void; label: string }) {
  const opts: { v: PreviewVisibility; l: string }[] = [
    { v: 'email', l: 'Email only' },
    { v: 'page', l: 'Page only' },
    { v: 'both', l: 'Both' },
  ];
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <span className="text-[10px] text-muted-foreground w-16 shrink-0">{label}:</span>
      {opts.map(o => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
            value === o.v ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-gray-200 text-gray-400'
          }`}>{o.l}</button>
      ))}
    </div>
  );
}

export default function EmailSettingsPanel({ settings, onChange, compact, offerIds, offerNames }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [customTermInput, setCustomTermInput] = useState('');
  const [paymentExpanded, setPaymentExpanded] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);

  const handleChange = (newSettings: EmailSettings) => {
    onChange(newSettings);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings)); } catch {}
  };

  const cycleField = (key: string) => {
    const inVisible = settings.visibleFields.includes(key);
    const inSeeMore = settings.seeMoreFields.includes(key);
    if (inVisible) {
      handleChange({ ...settings, visibleFields: settings.visibleFields.filter(f => f !== key), seeMoreFields: [...settings.seeMoreFields, key] });
    } else if (inSeeMore) {
      handleChange({ ...settings, seeMoreFields: settings.seeMoreFields.filter(f => f !== key) });
    } else {
      handleChange({ ...settings, visibleFields: [...settings.visibleFields, key] });
    }
  };

  const addCustomTerm = () => {
    const term = customTermInput.trim();
    if (term && !settings.customPaymentTerms.includes(term) && !PAYMENT_TERM_PRESETS.includes(term)) {
      handleChange({ ...settings, customPaymentTerms: [...settings.customPaymentTerms, term] });
      setCustomTermInput('');
    }
  };

  const removeCustomTerm = (term: string) => {
    handleChange({
      ...settings,
      customPaymentTerms: settings.customPaymentTerms.filter(t => t !== term),
      paymentTerms: settings.paymentTerms === term ? '' : settings.paymentTerms,
    });
  };

  const allTerms = [...PAYMENT_TERM_PRESETS, ...settings.customPaymentTerms];

  if (compact && !expanded) {
    return (
      <button type="button" onClick={() => setExpanded(true)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <Settings2 className="h-3.5 w-3.5" /> Email template settings
      </button>
    );
  }

  return (
    <div className="border rounded-lg p-3 bg-muted/20 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Template Settings</span>
        {compact && <button type="button" onClick={() => setExpanded(false)} className="text-xs text-muted-foreground hover:text-foreground">Hide</button>}
      </div>

      {/* Template Style */}
      <div className="flex gap-2">
        <button type="button" onClick={() => handleChange({ ...settings, templateStyle: 'table' })}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium border transition-colors ${settings.templateStyle === 'table' ? 'bg-violet-100 border-violet-300 text-violet-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
          <Table2 className="h-3.5 w-3.5" /> Table View
        </button>
        <button type="button" onClick={() => handleChange({ ...settings, templateStyle: 'card' })}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium border transition-colors ${settings.templateStyle === 'card' ? 'bg-violet-100 border-violet-300 text-violet-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
          <LayoutGrid className="h-3.5 w-3.5" /> Card View
        </button>
      </div>

      {/* Payout Type */}
      <div>
        <Label className="text-xs">Show payout as</Label>
        <div className="flex gap-2 mt-1">
          <button type="button" onClick={() => handleChange({ ...settings, payoutType: 'publisher' })}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium border transition-colors ${settings.payoutType === 'publisher' ? 'bg-green-100 border-green-300 text-green-700' : 'bg-white border-gray-200 text-gray-500'}`}>
            Publisher (80%)
          </button>
          <button type="button" onClick={() => handleChange({ ...settings, payoutType: 'admin' })}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium border transition-colors ${settings.payoutType === 'admin' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-500'}`}>
            Admin (100%)
          </button>
        </div>
      </div>

      {/* Fields — cycle: Visible → See More → Hidden */}
      <div>
        <Label className="text-xs">Fields in email</Label>
        <p className="text-[10px] text-muted-foreground mt-0.5 mb-1.5">
          Click to cycle: <span className="text-violet-600 font-medium">Table</span> → <span className="text-amber-600 font-medium">See More page</span> → <span className="text-gray-400 font-medium">Hidden</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_FIELDS.map(f => {
            const inVisible = settings.visibleFields.includes(f.key);
            const inSeeMore = settings.seeMoreFields.includes(f.key);
            let cls = 'bg-white border-gray-200 text-gray-400';
            let icon = null;
            if (inVisible) { cls = 'bg-violet-100 border-violet-300 text-violet-700'; icon = <Eye className="h-2.5 w-2.5" />; }
            else if (inSeeMore) { cls = 'bg-amber-100 border-amber-300 text-amber-700'; icon = <EyeOff className="h-2.5 w-2.5" />; }
            return (
              <button key={f.key} type="button" onClick={() => cycleField(f.key)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors flex items-center gap-1 ${cls}`}>
                {icon}{f.label}
              </button>
            );
          })}
        </div>
        {settings.seeMoreFields.length > 0 && (
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-600">
            <EyeOff className="h-3 w-3" />
            On See More page: {settings.seeMoreFields.map(k => ALL_FIELDS.find(f => f.key === k)?.label || k).join(', ')}
          </div>
        )}
      </div>

      {/* Preview Links Section */}
      <div className="border rounded-md overflow-hidden">
        <button type="button" onClick={() => setPreviewExpanded(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-muted/50 transition-colors">
          <span className="flex items-center gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
            Preview Links
            {settings.maskPreviewLinks && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Tracked</Badge>}
          </span>
          {previewExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {previewExpanded && (
          <div className="border-t px-3 py-2 space-y-2.5">
            {/* Track toggle */}
            <button type="button" onClick={() => handleChange({ ...settings, maskPreviewLinks: !settings.maskPreviewLinks })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors w-full justify-center ${
                settings.maskPreviewLinks ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}>
              <Link2 className="h-3.5 w-3.5" />
              {settings.maskPreviewLinks ? '✓ Preview links masked & tracked' : 'Enable preview link tracking'}
            </button>

            {/* Default preview visibility */}
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Default Preview (from offer DB)</span>
              <VisibilityToggle value={settings.previewInEmail} onChange={v => handleChange({ ...settings, previewInEmail: v })} label="Show in" />
            </div>

            {/* Custom preview URL */}
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Custom Preview Link (send-time only, not saved)</span>
              <div className="flex gap-2 mt-1">
                <button type="button" onClick={() => handleChange({ ...settings, customPreviewMode: 'all' })}
                  className={`px-2.5 py-1 rounded text-[10px] font-medium border transition-colors ${settings.customPreviewMode === 'all' ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-gray-200 text-gray-400'}`}>
                  Same for all
                </button>
                {offerIds && offerIds.length > 1 && (
                  <button type="button" onClick={() => handleChange({ ...settings, customPreviewMode: 'individual' })}
                    className={`px-2.5 py-1 rounded text-[10px] font-medium border transition-colors ${settings.customPreviewMode === 'individual' ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-gray-200 text-gray-400'}`}>
                    Per offer
                  </button>
                )}
              </div>

              {settings.customPreviewMode === 'all' ? (
                <Input
                  value={settings.customPreviewUrl}
                  onChange={e => handleChange({ ...settings, customPreviewUrl: e.target.value })}
                  placeholder="https://example.com/offer-preview"
                  className="h-7 text-xs mt-1.5"
                />
              ) : (
                <div className="space-y-1.5 mt-1.5">
                  {(offerIds || []).map(id => (
                    <div key={id} className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-24 truncate shrink-0" title={offerNames?.[id] || id}>
                        {offerNames?.[id] || id}
                      </span>
                      <Input
                        value={settings.customPreviewUrls[id] || ''}
                        onChange={e => handleChange({
                          ...settings,
                          customPreviewUrls: { ...settings.customPreviewUrls, [id]: e.target.value },
                        })}
                        placeholder="Preview URL for this offer"
                        className="h-6 text-[10px] flex-1"
                      />
                    </div>
                  ))}
                </div>
              )}

              {(settings.customPreviewUrl || Object.values(settings.customPreviewUrls).some(v => v)) && (
                <VisibilityToggle value={settings.customPreviewInEmail} onChange={v => handleChange({ ...settings, customPreviewInEmail: v })} label="Show in" />
              )}
              <p className="text-[10px] text-muted-foreground mt-1">This link is added at send time only — not saved to the offer permanently.</p>
            </div>
          </div>
        )}
      </div>

      {/* Payment Terms */}
      <div className="border rounded-md overflow-hidden">
        <button type="button" onClick={() => setPaymentExpanded(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-muted/50 transition-colors">
          <span className="flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5" />
            Payment Terms
            {settings.paymentTerms && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{settings.paymentTerms}</Badge>}
          </span>
          {paymentExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {paymentExpanded && (
          <div className="border-t px-3 py-2 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => handleChange({ ...settings, paymentTerms: '' })}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${!settings.paymentTerms ? 'bg-gray-100 border-gray-300 text-gray-700' : 'bg-white border-gray-200 text-gray-400'}`}>
                None
              </button>
              {allTerms.map(term => (
                <div key={term} className="flex items-center gap-0.5">
                  <button type="button" onClick={() => handleChange({ ...settings, paymentTerms: settings.paymentTerms === term ? '' : term })}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                      settings.paymentTerms === term ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
                    }`}>{term}</button>
                  {settings.customPaymentTerms.includes(term) && (
                    <button type="button" onClick={() => removeCustomTerm(term)} className="text-gray-400 hover:text-red-500"><X className="h-3 w-3" /></button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-1.5">
              <Input value={customTermInput} onChange={e => setCustomTermInput(e.target.value)}
                placeholder="Custom term (e.g. Net 45)" className="h-7 text-xs flex-1"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTerm(); } }} />
              <button type="button" onClick={addCustomTerm}
                className="h-7 px-2 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Default Image */}
      <div>
        <Label className="text-xs flex items-center gap-1"><Image className="h-3 w-3" /> Default image for offers without images</Label>
        <Input value={settings.defaultImage} onChange={e => handleChange({ ...settings, defaultImage: e.target.value })}
          placeholder="https://example.com/default-offer.png" className="h-7 text-xs mt-1" />
      </div>
    </div>
  );
}
