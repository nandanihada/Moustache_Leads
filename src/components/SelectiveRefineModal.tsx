import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, CheckCircle } from 'lucide-react';
import { offerwallManagerApi } from '@/services/offerwallManagerApi';
import { toast } from 'sonner';

// Color-coded refinement fields
const REFINE_FIELDS = [
  { key: 'device', label: 'Device', color: '#3B82F6', bgColor: 'bg-blue-50 dark:bg-blue-950', borderColor: 'border-blue-300 dark:border-blue-700', textColor: 'text-blue-700 dark:text-blue-300' },
  { key: 'description', label: 'Description', color: '#8B5CF6', bgColor: 'bg-purple-50 dark:bg-purple-950', borderColor: 'border-purple-300 dark:border-purple-700', textColor: 'text-purple-700 dark:text-purple-300' },
  { key: 'title', label: 'Title', color: '#F59E0B', bgColor: 'bg-amber-50 dark:bg-amber-950', borderColor: 'border-amber-300 dark:border-amber-700', textColor: 'text-amber-700 dark:text-amber-300' },
  { key: 'category', label: 'Category Name', color: '#10B981', bgColor: 'bg-emerald-50 dark:bg-emerald-950', borderColor: 'border-emerald-300 dark:border-emerald-700', textColor: 'text-emerald-700 dark:text-emerald-300' },
  { key: 'event', label: 'Event', color: '#EC4899', bgColor: 'bg-pink-50 dark:bg-pink-950', borderColor: 'border-pink-300 dark:border-pink-700', textColor: 'text-pink-700 dark:text-pink-300' },
  { key: 'country', label: 'City/Country', color: '#06B6D4', bgColor: 'bg-cyan-50 dark:bg-cyan-950', borderColor: 'border-cyan-300 dark:border-cyan-700', textColor: 'text-cyan-700 dark:text-cyan-300' },
  { key: 'cap', label: 'Cap', color: '#EF4444', bgColor: 'bg-red-50 dark:bg-red-950', borderColor: 'border-red-300 dark:border-red-700', textColor: 'text-red-700 dark:text-red-300' },
];

interface SelectiveRefineModalProps {
  open: boolean;
  onClose: () => void;
  offerIds: string[];
  offerNames?: Record<string, string>;
  mode: 'single' | 'bulk';
  onComplete?: () => void;
}

const SelectiveRefineModal: React.FC<SelectiveRefineModalProps> = ({
  open,
  onClose,
  offerIds,
  offerNames = {},
  mode,
  onComplete,
}) => {
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [isRefining, setIsRefining] = useState(false);
  const [results, setResults] = useState<Record<string, any> | null>(null);
  const [bulkJobId, setBulkJobId] = useState<string | null>(null);

  const toggleField = (key: string) => {
    setSelectedFields((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]
    );
  };

  const handleRefine = async () => {
    if (selectedFields.length === 0) {
      toast.error('Select at least one field to refine');
      return;
    }

    setIsRefining(true);
    setResults(null);

    try {
      if (mode === 'single' && offerIds.length === 1) {
        // Single offer - selective refine (immediate)
        const data = await offerwallManagerApi.selectiveRefine(offerIds[0], selectedFields);
        setResults(data.results);
        toast.success('Refinement complete!');
      } else {
        // Bulk mode - supports multiple fields, processes in background
        const data = await offerwallManagerApi.startBulkRefine(offerIds, selectedFields.length === 7 ? 'full' : selectedFields.join(','));
        setBulkJobId(data.job_id);
        toast.success(`Bulk refinement started! Processing ${offerIds.length} offers in background (${selectedFields.length === 7 ? 'full refine' : selectedFields.join(', ')}). You'll be notified when complete.`);
        onClose();
        onComplete?.();
      }
    } catch (err: any) {
      toast.error(err.message || 'Refinement failed');
    } finally {
      setIsRefining(false);
    }
  };

  const handleClose = () => {
    setSelectedFields([]);
    setResults(null);
    setBulkJobId(null);
    onClose();
    if (results) {
      onComplete?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            {mode === 'single' ? 'Selective Refinement' : `Bulk Refine ${offerIds.length} Offers`}
          </DialogTitle>
        </DialogHeader>

        {/* Offer info */}
        {mode === 'single' && offerIds.length === 1 && offerNames[offerIds[0]] && (
          <p className="text-sm text-muted-foreground truncate px-1">
            {offerNames[offerIds[0]]}
          </p>
        )}
        {mode === 'bulk' && (
          <p className="text-sm text-muted-foreground px-1">
            {offerIds.length} offers selected • Processing happens in background with 2-3 min gap between each offer
          </p>
        )}

        {/* Field selection */}
        {!results && (
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Select fields to refine:</p>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                onClick={() => {
                  if (selectedFields.length === REFINE_FIELDS.length) {
                    setSelectedFields([]);
                  } else {
                    setSelectedFields(REFINE_FIELDS.map(f => f.key));
                  }
                }}
                disabled={isRefining}
              >
                <Sparkles className="h-3 w-3" />
                {selectedFields.length === REFINE_FIELDS.length ? 'Deselect All' : 'Full Refine (All)'}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {REFINE_FIELDS.map((field) => {
                const isSelected = selectedFields.includes(field.key);
                return (
                  <button
                    key={field.key}
                    onClick={() => toggleField(field.key)}
                    disabled={isRefining}
                    className={`
                      flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 transition-all text-sm font-medium
                      ${isSelected
                        ? `${field.bgColor} ${field.borderColor} ${field.textColor} shadow-sm`
                        : 'bg-background border-border hover:border-muted-foreground/30 text-muted-foreground'
                      }
                      ${isRefining ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: field.color }}
                    />
                    {field.label}
                    {isSelected && <CheckCircle className="h-3.5 w-3.5 ml-auto" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Results display (single mode only) */}
        {results && (
          <div className="space-y-3 py-2 max-h-[300px] overflow-y-auto">
            <p className="text-sm font-medium text-green-600">✅ Refinement Results:</p>
            {Object.entries(results).map(([field, data]: [string, any]) => {
              const fieldInfo = REFINE_FIELDS.find((f) => f.key === field);
              return (
                <div
                  key={field}
                  className={`p-3 rounded-lg border ${fieldInfo?.bgColor || 'bg-muted'} ${fieldInfo?.borderColor || 'border-border'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: fieldInfo?.color || '#888' }}
                    />
                    <span className={`text-xs font-semibold uppercase ${fieldInfo?.textColor || ''}`}>
                      {fieldInfo?.label || field}
                    </span>
                  </div>
                  {data.success ? (
                    <pre className="text-xs whitespace-pre-wrap break-words text-foreground mt-1">
                      {typeof data.value === 'object' ? JSON.stringify(data.value, null, 2) : String(data.value)}
                    </pre>
                  ) : (
                    <p className="text-xs text-red-500">{data.error || 'Failed'}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isRefining}>
            {results ? 'Done' : 'Cancel'}
          </Button>
          {!results && (
            <Button onClick={handleRefine} disabled={isRefining || selectedFields.length === 0}>
              {isRefining && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {mode === 'bulk' ? 'Start Background Refine' : 'Refine Now'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SelectiveRefineModal;
