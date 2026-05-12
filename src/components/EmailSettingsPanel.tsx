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
  CreditCard, ChevronDown, ChevronUp,
} from 'lucide-react';

const ALL_FIELDS = [
  { key: 'name', label: 'Offer Name', default: true },
  { key: 'payout', label: 'Payout', default: true },
  { key: 'countries', label: 'Countries', default: true },
  { key: 'category', label: 'Category', default: true },
  { key: 'network', label: 'Network', default: false },
  { key: 'image', label: 'Image', default: true },
  { key: 'offer_id', label: 'Offer ID', default: true },
  { key: 'preview_url', label: 'Preview URL', default: false },
  { key: 'preview_url_2', label: 'Preview 2', default: false },
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

export default function EmailSettingsPanel({ settings, onChange, compact, offerIds, offerNames }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [customTermInput, setCustomTermInput] = useState('');
  const [paymentExpanded, setPaymentExpanded] = useState(false);

  const handleChange = (newSettings: EmailSettings) => {
    onChange(newSettings);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings)); } catch {}
  };

  const cycleField = (key: string) => {
    const visibleArr = Array.isArray(settings.visibleFields) ? settings.visibleFields : [];
    const seeMoreArr = Array.isArray(settings.seeMoreFields) ? settings.seeMoreFields : [];
    
    const inVisible = visibleArr.includes(key);
    const inSeeMore = seeMoreArr.includes(key);
    
    if (inVisible) {
      handleChange({ 
        ...settings, 
        visibleFields: visibleArr.filter(f => f !== key), 
        seeMoreFields: [...seeMoreArr, key] 
      });
    } else if (inSeeMore) {
      handleChange({ 
        ...settings, 
        seeMoreFields: seeMoreArr.filter(f => f !== key) 
      });
    } else {
      handleChange({ 
        ...settings, 
        visibleFields: [...visibleArr, key] 
      });
    }
  };

  const addCustomTerm = () => {
    const term = customTermInput.trim();
    if (term && !(settings.customPaymentTerms || []).includes(term) && !PAYMENT_TERM_PRESETS.includes(term)) {
      handleChange({ ...settings, customPaymentTerms: [...(settings.customPaymentTerms || []), term] });
      setCustomTermInput('');
    }
  };

  const removeCustomTerm = (term: string) => {
    handleChange({
      ...settings,
      customPaymentTerms: (settings.customPaymentTerms || []).filter(t => t !== term),
      paymentTerms: settings.paymentTerms === term ? '' : settings.paymentTerms,
    });
  };

  const safeVisibleFields = Array.isArray(settings.visibleFields) ? settings.visibleFields : [];
  const safeSeeMoreFields = Array.isArray(settings.seeMoreFields) ? settings.seeMoreFields : [];
  const safeCustomTerms = Array.isArray(settings.customPaymentTerms) ? settings.customPaymentTerms : [];
  const allTerms = [...PAYMENT_TERM_PRESETS, ...safeCustomTerms];

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
        <Label className="text-xs">Field Visibility in Mail</Label>
        <div className="grid grid-cols-3 gap-2 mt-1 mb-3">
          <div className="flex items-center gap-1.5 p-2 rounded-xl bg-violet-50 border border-violet-100">
            <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />
            <span className="text-[9px] font-bold text-violet-700 uppercase">Directly Visible</span>
          </div>
          <div className="flex items-center gap-1.5 p-2 rounded-xl bg-amber-50 border border-amber-100">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-[9px] font-bold text-amber-700 uppercase">See More</span>
          </div>
          <div className="flex items-center gap-1.5 p-2 rounded-xl bg-white border border-slate-200">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
            <span className="text-[9px] font-bold text-slate-500 uppercase">Hidden</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {ALL_FIELDS.map(f => {
            const inVisible = safeVisibleFields.includes(f.key);
            const inSeeMore = safeSeeMoreFields.includes(f.key);
            
            let cls = 'bg-white border-slate-200 text-slate-400 hover:border-slate-300';
            let dotCls = 'bg-slate-300';
            
            if (inVisible) { 
              cls = 'bg-violet-600 border-violet-700 text-white shadow-md shadow-violet-100 scale-105'; 
              dotCls = 'bg-white';
            } else if (inSeeMore) { 
              cls = 'bg-amber-400 border-amber-500 text-white shadow-md shadow-amber-100 scale-105'; 
              dotCls = 'bg-white';
            }

            return (
              <button 
                key={f.key} 
                type="button" 
                onClick={() => cycleField(f.key)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-black border transition-all flex items-center gap-2 ${cls}`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
                {f.label}
              </button>
            );
          })}
        </div>

        {safeSeeMoreFields.length > 0 && (
          <div className="mt-3 p-2 bg-amber-50/50 rounded-lg border border-dashed border-amber-200 flex items-center gap-2 text-[10px] text-amber-700 italic">
            <EyeOff className="h-3.5 w-3.5" />
            Hidden under "See More": {safeSeeMoreFields.map(k => ALL_FIELDS.find(f => f.key === k)?.label || k).join(', ')}
          </div>
        )}
      </div>

      {/* Preview link controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => handleChange({ ...settings, maskPreviewLinks: !settings.maskPreviewLinks })}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
            settings.maskPreviewLinks ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}>
          <Link2 className="h-3.5 w-3.5" />
          {settings.maskPreviewLinks ? '✓ Track preview clicks' : 'Track preview clicks'}
        </button>
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
                  {safeCustomTerms.includes(term) && (
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
