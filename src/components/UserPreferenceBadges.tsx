/**
 * Reusable component to display user registration preferences as compact badges.
 * Shows verticals, GEOs, traffic sources. Shows "No preference" if user skipped.
 * Used in: Users tab, Publisher Analytics, Offer Access Requests, Reactivation.
 */
import { Badge } from '@/components/ui/badge';
import { Globe, Layers, Zap } from 'lucide-react';

interface UserPreferenceBadgesProps {
  user: {
    verticals?: string[];
    geos?: string[];
    traffic_sources?: string[];
    registration_profile_completed?: boolean;
  };
  compact?: boolean; // single-line mode for table cells
}

export default function UserPreferenceBadges({ user, compact }: UserPreferenceBadgesProps) {
  const hasVerticals = user.verticals && user.verticals.length > 0;
  const hasGeos = user.geos && user.geos.length > 0;
  const hasTraffic = user.traffic_sources && user.traffic_sources.length > 0;
  const hasAny = hasVerticals || hasGeos || hasTraffic;
  const profileDone = user.registration_profile_completed;

  // User never completed registration wizard
  if (!profileDone && !hasAny) return null;

  // User completed wizard but skipped everything
  if (profileDone && !hasAny) {
    return (
      <span className="text-[10px] text-muted-foreground italic">No preference set</span>
    );
  }

  if (compact) {
    // Single-line: show first vertical + first geo as tiny badges
    return (
      <div className="flex flex-wrap gap-1">
        {hasVerticals && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-purple-50 text-purple-700 border-purple-200">
            {user.verticals!.slice(0, 2).join(', ')}{user.verticals!.length > 2 ? ` +${user.verticals!.length - 2}` : ''}
          </Badge>
        )}
        {hasGeos && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-blue-50 text-blue-700 border-blue-200">
            {user.geos!.slice(0, 3).join(', ')}{user.geos!.length > 3 ? ` +${user.geos!.length - 3}` : ''}
          </Badge>
        )}
        {hasTraffic && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-green-50 text-green-700 border-green-200">
            {user.traffic_sources!.slice(0, 2).join(', ')}{user.traffic_sources!.length > 2 ? ` +${user.traffic_sources!.length - 2}` : ''}
          </Badge>
        )}
      </div>
    );
  }

  // Full mode: labeled sections
  return (
    <div className="space-y-1.5">
      {hasVerticals && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Layers className="w-3 h-3 text-purple-500 flex-shrink-0" />
          {user.verticals!.map(v => (
            <Badge key={v} variant="outline" className="text-[10px] px-1.5 py-0 h-[18px] bg-purple-50 text-purple-700 border-purple-200">{v}</Badge>
          ))}
        </div>
      )}
      {hasGeos && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Globe className="w-3 h-3 text-blue-500 flex-shrink-0" />
          {user.geos!.map(g => (
            <Badge key={g} variant="outline" className="text-[10px] px-1.5 py-0 h-[18px] bg-blue-50 text-blue-700 border-blue-200">{g}</Badge>
          ))}
        </div>
      )}
      {hasTraffic && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Zap className="w-3 h-3 text-green-500 flex-shrink-0" />
          {user.traffic_sources!.map(t => (
            <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0 h-[18px] bg-green-50 text-green-700 border-green-200">{t}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}
