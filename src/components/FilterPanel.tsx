import React, { useRef, useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, ChevronDown, Globe } from 'lucide-react';

const CATEGORIES = [
  { id: 'all', name: 'All Verticals', icon: '🎯' },
  { id: 'HEALTH', name: 'Health', icon: '💊' },
  { id: 'SURVEY', name: 'Survey', icon: '📋' },
  { id: 'SWEEPSTAKES', name: 'Sweepstakes', icon: '🎰' },
  { id: 'EDUCATION', name: 'Education', icon: '📚' },
  { id: 'INSURANCE', name: 'Insurance', icon: '🛡️' },
  { id: 'LOAN', name: 'Loan', icon: '💳' },
  { id: 'FINANCE', name: 'Finance', icon: '💰' },
  { id: 'DATING', name: 'Dating', icon: '❤️' },
  { id: 'FREE_TRIAL', name: 'Free Trial', icon: '🎁' },
  { id: 'INSTALLS', name: 'Installs', icon: '📲' },
  { id: 'GAMES_INSTALL', name: 'Games', icon: '🎮' },
  { id: 'OTHER', name: 'Other', icon: '📦' },
];

export const COUNTRIES = [
  { code: 'WW', label: '🌍 Worldwide (WW)' },
  { code: 'US', label: '🇺🇸 United States' },
  { code: 'GB', label: '🇬🇧 United Kingdom' },
  { code: 'CA', label: '🇨🇦 Canada' },
  { code: 'AU', label: '🇦🇺 Australia' },
  { code: 'DE', label: '🇩🇪 Germany' },
  { code: 'FR', label: '🇫🇷 France' },
  { code: 'IN', label: '🇮🇳 India' },
  { code: 'BR', label: '🇧🇷 Brazil' },
  { code: 'JP', label: '🇯🇵 Japan' },
  { code: 'IT', label: '🇮🇹 Italy' },
  { code: 'ES', label: '🇪🇸 Spain' },
  { code: 'MX', label: '🇲🇽 Mexico' },
  { code: 'NL', label: '🇳🇱 Netherlands' },
  { code: 'SE', label: '🇸🇪 Sweden' },
  { code: 'NO', label: '🇳🇴 Norway' },
  { code: 'DK', label: '🇩🇰 Denmark' },
  { code: 'FI', label: '🇫🇮 Finland' },
  { code: 'PL', label: '🇵🇱 Poland' },
  { code: 'ZA', label: '🇿🇦 South Africa' },
  { code: 'SG', label: '🇸🇬 Singapore' },
  { code: 'NZ', label: '🇳🇿 New Zealand' },
];

// ─── Multi-select Country Dropdown ────────────────────────────────────────────

interface MultiCountrySelectProps {
  selected: string[];
  onChange: (value: string[]) => void;
}

const MultiCountrySelect: React.FC<MultiCountrySelectProps> = ({ selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (code: string) => {
    if (selected.includes(code)) {
      onChange(selected.filter(c => c !== code));
    } else {
      onChange([...selected, code]);
    }
  };

  const remove = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter(c => c !== code));
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const displayLabel = () => {
    if (selected.length === 0) return <span className="text-muted-foreground text-sm">All Countries</span>;
    if (selected.length <= 2) {
      return (
        <div className="flex items-center gap-1 flex-wrap">
          {selected.map(code => {
            const c = COUNTRIES.find(x => x.code === code);
            return (
              <Badge key={code} variant="secondary" className="text-xs px-1.5 py-0 h-5 flex items-center gap-0.5">
                {c?.label.split(' ')[0]} {code}
                <X className="h-3 w-3 cursor-pointer ml-0.5" onClick={e => remove(code, e)} />
              </Badge>
            );
          })}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1">
        <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">{selected.length} countries</Badge>
        <X className="h-3 w-3 cursor-pointer text-muted-foreground" onClick={clearAll} />
      </div>
    );
  };

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <div className="flex-1 min-w-0 overflow-hidden">{displayLabel()}</div>
        <ChevronDown className={`h-4 w-4 shrink-0 opacity-50 ml-1 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[180px] rounded-md border bg-popover shadow-md">
          {/* Clear all */}
          {selected.length > 0 && (
            <div
              className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground cursor-pointer hover:bg-accent border-b"
              onClick={clearAll}
            >
              <X className="h-3 w-3" /> Clear all
            </div>
          )}
          <div className="max-h-60 overflow-y-auto">
            {COUNTRIES.map(c => {
              const isSelected = selected.includes(c.code);
              return (
                <div
                  key={c.code}
                  onClick={() => toggle(c.code)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent ${isSelected ? 'bg-accent/60 font-medium' : ''}`}
                >
                  <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary border-primary' : 'border-input'}`}>
                    {isSelected && <span className="text-primary-foreground text-xs leading-none">✓</span>}
                  </div>
                  {c.label}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── FilterPanel ──────────────────────────────────────────────────────────────

interface FilterPanelProps {
  statusFilter: string;
  onStatusChange: (value: string) => void;
  categoryFilter: string;
  onCategoryChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
  countryFilter: string[];
  onCountryChange: (value: string[]) => void;
  networkFilter: string;
  onNetworkChange: (value: string) => void;
  healthFilter: string;
  onHealthChange: (value: string) => void;
  networks: string[];
  open: boolean;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  statusFilter,
  onStatusChange,
  categoryFilter,
  onCategoryChange,
  sortBy,
  onSortChange,
  countryFilter,
  onCountryChange,
  networkFilter,
  onNetworkChange,
  healthFilter,
  onHealthChange,
  networks,
  open,
}) => {
  if (!open) return null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {/* Status */}
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={statusFilter} onValueChange={onStatusChange}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="hidden">Hidden</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sort */}
        <div className="space-y-1.5">
          <Label>Sort</Label>
          <Select value={sortBy} onValueChange={onSortChange}>
            <SelectTrigger>
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="payout_high">Payout (Highest)</SelectItem>
              <SelectItem value="payout_low">Payout (Lowest)</SelectItem>
              <SelectItem value="title_az">Title (A → Z)</SelectItem>
              <SelectItem value="title_za">Title (Z → A)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Country — multi-select */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1">
            <Globe className="h-3 w-3" /> Country
          </Label>
          <MultiCountrySelect selected={countryFilter} onChange={onCountryChange} />
        </div>

        {/* Network */}
        <div className="space-y-1.5">
          <Label>Network</Label>
          <Select value={networkFilter} onValueChange={onNetworkChange}>
            <SelectTrigger>
              <SelectValue placeholder="Network" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Networks</SelectItem>
              {networks.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Vertical */}
        <div className="space-y-1.5">
          <Label>Vertical</Label>
          <Select value={categoryFilter} onValueChange={onCategoryChange}>
            <SelectTrigger>
              <SelectValue placeholder="Vertical" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Health */}
        <div className="space-y-1.5">
          <Label>Health</Label>
          <Select value={healthFilter} onValueChange={onHealthChange}>
            <SelectTrigger>
              <SelectValue placeholder="Health" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Offers</SelectItem>
              <SelectItem value="healthy">✅ Healthy Only</SelectItem>
              <SelectItem value="unhealthy">❌ Unhealthy Only</SelectItem>
              <SelectItem value="has_levels">🎯 Has Levels/Events</SelectItem>
              <SelectItem value="in_offerwall">🖼️ In Offerwall</SelectItem>
              <SelectItem value="offerwall_exclusive">🔒 Offerwall Exclusive Only</SelectItem>
              <SelectItem value="no_tracking_url">⛓️ Missing Tracking URL</SelectItem>
              <SelectItem value="no_upward_partner">🔗 No Upward Partner</SelectItem>
              <SelectItem value="no_image">🖼️ Missing Image</SelectItem>
              <SelectItem value="no_country">🌍 No Country Set</SelectItem>
              <SelectItem value="no_payout">💸 Missing Payout</SelectItem>
              <SelectItem value="no_payout_model">📋 No Payout Model</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;
