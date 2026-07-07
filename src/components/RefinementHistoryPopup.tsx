import React, { useState, useEffect } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { History, Loader2 } from 'lucide-react';
import { offerwallManagerApi } from '@/services/offerwallManagerApi';

// Color mapping for fields
const FIELD_COLORS: Record<string, { color: string; label: string }> = {
  device: { color: '#3B82F6', label: 'Device' },
  description: { color: '#8B5CF6', label: 'Description' },
  summary: { color: '#8B5CF6', label: 'Description' },
  title: { color: '#F59E0B', label: 'Title' },
  refined_name: { color: '#F59E0B', label: 'Title' },
  category: { color: '#10B981', label: 'Category' },
  event: { color: '#EC4899', label: 'Event' },
  steps: { color: '#EC4899', label: 'Event' },
  country: { color: '#06B6D4', label: 'Country' },
  countries: { color: '#06B6D4', label: 'Country' },
  cap: { color: '#EF4444', label: 'Cap' },
  full_description: { color: '#6366F1', label: 'Full Refine' },
};

interface RefinementHistoryPopupProps {
  offerId: string;
  refinementCount?: number;
  lastRefinedAt?: string;
  compact?: boolean;
}

const RefinementHistoryPopup: React.FC<RefinementHistoryPopupProps> = ({
  offerId,
  refinementCount = 0,
  lastRefinedAt,
  compact = false,
}) => {
  const [log, setLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchHistory = async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const data = await offerwallManagerApi.getRefinementHistory(offerId);
      setLog(data.log || []);
      setLoaded(true);
    } catch {
      setLog([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return ts;
    }
  };

  if (refinementCount === 0 && !lastRefinedAt) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`gap-1 ${compact ? 'h-6 px-1.5 text-[10px]' : 'h-7 px-2 text-xs'}`}
          onClick={fetchHistory}
        >
          <History className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
          <span className="font-medium">{refinementCount || '1'}x</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="px-3 py-2 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">Refinement History</span>
            <Badge variant="secondary" className="text-[10px] h-5">
              {refinementCount || log.length} time{(refinementCount || log.length) !== 1 ? 's' : ''}
            </Badge>
          </div>
          {lastRefinedAt && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Last: {formatDate(lastRefinedAt)}
            </p>
          )}
        </div>

        <div className="max-h-60 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : log.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              No refinement history available
            </div>
          ) : (
            <div className="divide-y">
              {log.slice().reverse().map((entry, idx) => {
                const fieldInfo = FIELD_COLORS[entry.field] || { color: '#888', label: entry.field };
                return (
                  <div key={idx} className="px-3 py-2 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: fieldInfo.color }}
                      />
                      <span className="text-xs font-medium">{fieldInfo.label}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {entry.source === 'bulk' ? '🔄 Bulk' : entry.source === 'selective' ? '🎯 Selective' : '✏️ Manual'}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 pl-4">
                      {formatDate(entry.timestamp)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default RefinementHistoryPopup;
