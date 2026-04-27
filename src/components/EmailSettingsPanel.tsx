/**
 * Reusable Email Settings Panel
 * Provides template style selection (table/card), field toggles, default image URL,
 * and payout type selection for any email sending dialog.
 */
import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { LayoutGrid, Table2, Image, Settings2 } from 'lucide-react';

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
];

export interface EmailSettings {
  templateStyle: 'table' | 'card';
  visibleFields: string[];
  defaultImage: string;
  payoutType: 'publisher' | 'admin';
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
        defaultImage: parsed.defaultImage || '',
        payoutType: parsed.payoutType || 'publisher',
      };
    }
  } catch {}
  return {
    templateStyle: 'table',
    visibleFields: ALL_FIELDS.filter(f => f.default).map(f => f.key),
    defaultImage: '',
    payoutType: 'publisher',
  };
}

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = loadSavedSettings();

interface Props {
  settings: EmailSettings;
  onChange: (settings: EmailSettings) => void;
  compact?: boolean;
}

export default function EmailSettingsPanel({ settings, onChange, compact }: Props) {
  const [expanded, setExpanded] = useState(false);

  const handleChange = (newSettings: EmailSettings) => {
    onChange(newSettings);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings)); } catch {}
  };

  const toggle = (key: string) => {
    const fields = settings.visibleFields.includes(key)
      ? settings.visibleFields.filter(f => f !== key)
      : [...settings.visibleFields, key];
    handleChange({ ...settings, visibleFields: fields });
  };

  if (compact && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Settings2 className="h-3.5 w-3.5" /> Email template settings
      </button>
    );
  }

  return (
    <div className="border rounded-lg p-3 bg-muted/20 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Template Settings</span>
        {compact && (
          <button type="button" onClick={() => setExpanded(false)} className="text-xs text-muted-foreground hover:text-foreground">Hide</button>
        )}
      </div>

      {/* Template Style */}
      <div className="flex gap-2">
        <button type="button" onClick={() => handleChange({ ...settings, templateStyle: 'table' })}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium border transition-colors ${
            settings.templateStyle === 'table' ? 'bg-violet-100 border-violet-300 text-violet-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}>
          <Table2 className="h-3.5 w-3.5" /> Table View
        </button>
        <button type="button" onClick={() => handleChange({ ...settings, templateStyle: 'card' })}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium border transition-colors ${
            settings.templateStyle === 'card' ? 'bg-violet-100 border-violet-300 text-violet-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}>
          <LayoutGrid className="h-3.5 w-3.5" /> Card View
        </button>
      </div>

      {/* Payout Type */}
      <div>
        <Label className="text-xs">Show payout as</Label>
        <div className="flex gap-2 mt-1">
          <button type="button" onClick={() => handleChange({ ...settings, payoutType: 'publisher' })}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              settings.payoutType === 'publisher' ? 'bg-green-100 border-green-300 text-green-700' : 'bg-white border-gray-200 text-gray-500'
            }`}>
            Publisher (80%)
          </button>
          <button type="button" onClick={() => handleChange({ ...settings, payoutType: 'admin' })}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              settings.payoutType === 'admin' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-500'
            }`}>
            Admin (100%)
          </button>
        </div>
      </div>

      {/* Visible Fields */}
      <div>
        <Label className="text-xs">Fields to show in email</Label>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {ALL_FIELDS.map(f => (
            <button key={f.key} type="button" onClick={() => toggle(f.key)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                settings.visibleFields.includes(f.key)
                  ? 'bg-violet-100 border-violet-300 text-violet-700'
                  : 'bg-white border-gray-200 text-gray-400'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Default Image */}
      <div>
        <Label className="text-xs flex items-center gap-1"><Image className="h-3 w-3" /> Default image for offers without images</Label>
        <Input
          value={settings.defaultImage}
          onChange={e => handleChange({ ...settings, defaultImage: e.target.value })}
          placeholder="https://example.com/default-offer.png"
          className="h-7 text-xs mt-1"
        />
      </div>
    </div>
  );
}
