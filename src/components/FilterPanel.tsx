import React from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const CATEGORIES = [
  { id: 'all', name: 'All Categories', icon: '🎯' },
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

const COUNTRIES = [
  { code: 'all', label: 'All Countries' },
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
];

interface FilterPanelProps {
  statusFilter: string;
  onStatusChange: (value: string) => void;
  categoryFilter: string;
  onCategoryChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
  countryFilter: string;
  onCountryChange: (value: string) => void;
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

        {/* Country */}
        <div className="space-y-1.5">
          <Label>Country</Label>
          <Select value={countryFilter} onValueChange={onCountryChange}>
            <SelectTrigger>
              <SelectValue placeholder="Country" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

        {/* Category */}
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={categoryFilter} onValueChange={onCategoryChange}>
            <SelectTrigger>
              <SelectValue placeholder="Category" />
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
