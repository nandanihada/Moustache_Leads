/**
 * OfferwallOfferEditor — Enhanced Offer Controls UI
 * 
 * Each offer row is an expandable card with:
 *  - Full info (image, name, network, payout, countries, vertical, last edited, AI refined badge)
 *  - Expand arrow → inline panel: Raw | Refined side-by-side
 *  - Per-field AI regenerate (🔄) + full re-refine button
 *  - Image editor (ImagePickerComponent)
 *  - Smart rename (token-based)
 *  - Bulk edit window for selected offers
 *  - Rich filter bar
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ChevronDown, ChevronRight, RefreshCw, Wand2, Image as ImageIcon,
  RotateCcw, Save, Eye, EyeOff, Star, Sparkles, Pin, Flame,
  Loader2, CheckCircle, X, Pencil, Edit3, Globe, Clock, Layers,
  SlidersHorizontal, AlertCircle
} from 'lucide-react';
import { offerwallManagerApi } from '@/services/offerwallManagerApi';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { getOfferImage } from '@/utils/categoryImages';
import { ImagePickerComponent } from '@/components/ImagePickerComponent';

// ===================== TYPES =====================
interface OfferItem {
  offer_id: string;
  name: string;
  original_name?: string;
  status: string;
  category: string;
  payout: number;
  payout_type?: string;
  network: string;
  image_url: string;
  description: string;
  countries: string[];
  offerwall_position?: number;
  created_at: string;
  updated_at?: string;
  refined_at?: string;
  renamed_at?: string;
  refined_description?: {
    event_flow?: string;
    summary?: string;
    steps?: string[];
    payout_levels?: Array<{ event: string; payout: string }>;
    restrictions?: string[];
    difficulty?: string;
    estimated_time?: string;
  };
  is_boosted?: boolean;
  has_refined?: boolean;
  price_boost?: any;
}

interface OfferwallOfferEditorProps {
  offers: OfferItem[];
  settings?: any;
  starterOfferIds: string[];
  boostedOffers: any[];
  positionInputs: Record<string, string>;
  selectedOffers: Set<string>;
  pagination: { page: number; per_page: number; total: number; pages: number };
  onSelectOffer: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onSelectAllResults?: () => Promise<void>;
  selectingAllResults?: boolean;
  preloadedOffers?: Map<string, OfferItem>;
  onTogglePin: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onToggleFeatured: (id: string) => void;
  onToggleStarter: (id: string) => void;
  onSetPosition: (id: string, pos: string) => void;
  setPositionInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onPageChange: (page: number) => void;
  onFiltersChange?: (filters: Record<string, string>) => void;
  onBoost?: () => void;
  onRemoveBoost?: (offerIds: string[]) => void;
}

// ===================== CONSTANTS =====================
const FLAG_MAP: Record<string, string> = {
  US: '🇺🇸', UK: '🇬🇧', GB: '🇬🇧', CA: '🇨🇦', AU: '🇦🇺', DE: '🇩🇪', FR: '🇫🇷',
  IT: '🇮🇹', ES: '🇪🇸', BR: '🇧🇷', IN: '🇮🇳', JP: '🇯🇵', NL: '🇳🇱', SE: '🇸🇪',
  NO: '🇳🇴', DK: '🇩🇰', FI: '🇫🇮', NZ: '🇳🇿', IE: '🇮🇪', ZA: '🇿🇦', SG: '🇸🇬',
};

const REFINE_FIELDS = [
  { key: 'event_flow', label: 'Event Flow', icon: '⚡' },
  { key: 'summary', label: 'Summary', icon: '📝' },
  { key: 'steps', label: 'Conversion Events', icon: '📋' },
  { key: 'restrictions', label: 'Restrictions', icon: '🚫' },
  { key: 'difficulty', label: 'Difficulty', icon: '🎯' },
  { key: 'estimated_time', label: 'Est. Time', icon: '⏱️' },
  { key: 'countries', label: 'Countries', icon: '🌍' },
] as const;

type RefineField = typeof REFINE_FIELDS[number]['key'];

// ===================== LAST EDITED DISPLAY =====================
function LastEdited({ offer }: { offer: OfferItem }) {
  const dates = [
    offer.refined_at ? { label: 'Refined', date: offer.refined_at } : null,
    offer.renamed_at ? { label: 'Renamed', date: offer.renamed_at } : null,
    offer.updated_at ? { label: 'Updated', date: offer.updated_at } : null,
  ].filter(Boolean) as Array<{ label: string; date: string }>;

  if (dates.length === 0) return <span className="text-[10px] text-muted-foreground">—</span>;

  const latest = dates.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  const d = new Date(latest.date);
  const timeAgo = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="text-[10px] text-muted-foreground">
      <span className="font-medium text-foreground/70">{latest.label}</span>
      <br />
      {timeAgo(Date.now() - d.getTime())}
    </div>
  );
}

// ===================== SINGLE OFFER EDITOR PANEL =====================
interface OfferEditorPanelProps {
  offer: OfferItem;
  onClose?: () => void;
  inline?: boolean;
  onSaved?: (offerId: string, updates: Partial<OfferItem>) => void;
}

export function OfferEditorPanel({ offer, onClose, inline = false, onSaved }: OfferEditorPanelProps) {
  const { toast } = useToast();
  const qc = useQueryClient();

  // Local state for editable refined description
  const [localRefined, setLocalRefined] = useState<OfferItem['refined_description']>(
    offer.refined_description || {}
  );
  const [refiningFull, setRefiningFull] = useState(false);
  const [refiningField, setRefiningField] = useState<RefineField | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Image editor
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [localImage, setLocalImage] = useState(offer.image_url);
  const [savingImage, setSavingImage] = useState(false);

  // Rename
  const [renameMode, setRenameMode] = useState(false);
  const [localName, setLocalName] = useState(offer.name);
  const [savingName, setSavingName] = useState(false);

  // Update countries
  const [updateCountries, setUpdateCountries] = useState(true);

  const handleFullRefine = async () => {
    setRefiningFull(true);
    try {
      const data = await offerwallManagerApi.refineDescription(offer.offer_id);
      if (data.refined) {
        setLocalRefined(data.refined);
        toast({ title: '✨ Re-refined!', description: 'All fields updated. Review and save.' });
      }
    } catch (e: any) {
      // fallback: load existing
      toast({ title: 'AI unavailable', description: e.message || 'Rate limit. Edit manually.' });
    } finally {
      setRefiningFull(false);
    }
  };

  const handleRefineField = async (field: RefineField) => {
    setRefiningField(field);
    try {
      const data = await offerwallManagerApi.refineField(offer.offer_id, field);
      if (data.value !== undefined) {
        setLocalRefined(prev => ({ ...prev, [field]: data.value }));
        toast({ title: `✨ ${field} regenerated`, description: 'Review and save when ready.' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || `Failed to regenerate ${field}`, variant: 'destructive' });
    } finally {
      setRefiningField(null);
    }
  };

  const handleSaveRefined = async () => {
    setSaving(true);
    try {
      await offerwallManagerApi.saveRefinedDescription(offer.offer_id, localRefined, updateCountries);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      qc.invalidateQueries({ queryKey: ['offerwall-management-offers'] });
      onSaved?.(offer.offer_id, { refined_description: localRefined, has_refined: true });
      toast({ title: 'Saved!', description: 'Refined description saved.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreOriginal = async () => {
    try {
      await offerwallManagerApi.removeRefinedDescription(offer.offer_id);
      setLocalRefined({});
      qc.invalidateQueries({ queryKey: ['offerwall-management-offers'] });
      onSaved?.(offer.offer_id, { refined_description: undefined, has_refined: false });
      toast({ title: 'Restored', description: 'Raw description restored.' });
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const handleSaveImage = async () => {
    if (!localImage || localImage === offer.image_url) return;
    setSavingImage(true);
    try {
      await offerwallManagerApi.updateOfferImage(offer.offer_id, localImage);
      qc.invalidateQueries({ queryKey: ['offerwall-management-offers'] });
      onSaved?.(offer.offer_id, { image_url: localImage });
      toast({ title: 'Image saved!' });
    } catch {
      toast({ title: 'Error', description: 'Failed to save image', variant: 'destructive' });
    } finally {
      setSavingImage(false);
    }
  };

  const handleSaveName = async () => {
    if (!localName.trim() || localName === offer.name) { setRenameMode(false); return; }
    setSavingName(true);
    try {
      await offerwallManagerApi.renameOffer(offer.offer_id, localName.trim(), offer.name);
      qc.invalidateQueries({ queryKey: ['offerwall-management-offers'] });
      onSaved?.(offer.offer_id, { name: localName.trim(), original_name: offer.name });
      toast({ title: 'Renamed!' });
      setRenameMode(false);
    } catch {
      toast({ title: 'Error', description: 'Failed to rename', variant: 'destructive' });
    } finally {
      setSavingName(false);
    }
  };

  const difficultyColor = (d?: string) => {
    if (d === 'Easy') return 'bg-green-100 text-green-700';
    if (d === 'Hard') return 'bg-red-100 text-red-700';
    return 'bg-yellow-100 text-yellow-700';
  };

  return (
    <div className={`${inline ? '' : 'p-6 max-w-4xl mx-auto'} space-y-5`}>
      {/* Header */}
      <div className="flex items-start gap-4">
        {/* Image */}
        <div className="relative flex-shrink-0">
          <img
            src={getOfferImage({ image_url: localImage, vertical: offer.category })}
            alt={offer.name}
            className="w-20 h-20 rounded-xl object-contain bg-gray-50 border p-1"
            onError={e => { (e.target as HTMLImageElement).src = '/category-images/other.png'; }}
          />
          <button
            onClick={() => setShowImagePicker(!showImagePicker)}
            className="absolute -bottom-1 -right-1 bg-white border rounded-full p-1 shadow-sm hover:bg-gray-50 transition-colors"
            title="Change image"
          >
            <ImageIcon className="h-3 w-3 text-gray-600" />
          </button>
        </div>

        <div className="flex-1 min-w-0">
          {/* Name + rename */}
          {renameMode ? (
            <div className="flex items-center gap-2 mb-1">
              <Input
                value={localName}
                onChange={e => setLocalName(e.target.value)}
                className="h-8 text-sm font-semibold"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { setLocalName(offer.name); setRenameMode(false); } }}
              />
              <Button size="sm" onClick={handleSaveName} disabled={savingName} className="h-8 bg-purple-600 hover:bg-purple-700">
                {savingName ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => { setLocalName(offer.name); setRenameMode(false); }}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-sm leading-snug truncate">{localName}</h3>
              <button onClick={() => setRenameMode(true)} className="text-gray-400 hover:text-purple-600 transition-colors flex-shrink-0">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {offer.original_name && (
            <p className="text-[10px] text-amber-600 mb-1">was: {offer.original_name}</p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-muted-foreground font-mono">{offer.offer_id}</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{offer.network}</Badge>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{offer.category}</Badge>
            <span className="text-[10px] font-semibold text-green-700">${offer.payout}</span>
            {offer.countries.slice(0, 4).map(c => (
              <span key={c} className="text-[11px]" title={c}>{FLAG_MAP[c] || c}</span>
            ))}
            {offer.countries.length > 4 && <span className="text-[10px] text-muted-foreground">+{offer.countries.length - 4}</span>}
            {offer.has_refined && <span className="text-[10px] text-purple-600 font-medium">✨ refined</span>}
          </div>
          {/* Last edited */}
          <div className="flex items-center gap-2 mt-1">
            <LastEdited offer={offer} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            size="sm"
            onClick={handleFullRefine}
            disabled={refiningFull}
            className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5 h-8"
          >
            {refiningFull ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            {refiningFull ? 'Refining…' : 'Re-Refine All'}
          </Button>
          {onClose && (
            <Button size="sm" variant="ghost" onClick={onClose} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Image Picker (inline expandable) */}
      {showImagePicker && (
        <div className="border rounded-xl p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Change Image</p>
          </div>
          {/* URL paste */}
          <div className="flex gap-2 mb-3">
            <Input
              placeholder="Paste image URL..."
              value={localImage}
              onChange={e => setLocalImage(e.target.value)}
              className="h-8 text-xs flex-1"
            />
            {localImage && (
              <img
                src={localImage}
                alt=""
                className="w-8 h-8 rounded border object-contain bg-white flex-shrink-0"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
          </div>
          <ImagePickerComponent
            offerName={offer.name}
            vertical={offer.category}
            onImageSelected={(url) => {
              setLocalImage(url);
              // Keep picker open so admin can see the Save Image button
              // Don't close: setShowImagePicker(false)
            }}
          />
          {/* Persistent save bar after image selection */}
          {localImage !== offer.image_url && (
            <div className="flex items-center gap-3 mt-3 pt-3 border-t">
              <img src={localImage} alt="" className="w-12 h-12 rounded-lg border object-contain bg-white flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <div className="flex-1">
                <p className="text-xs font-semibold text-green-700">✓ New image selected</p>
                <p className="text-[10px] text-muted-foreground truncate">{localImage.slice(0, 60)}...</p>
              </div>
              <Button size="sm" onClick={handleSaveImage} disabled={savingImage} className="h-8 bg-green-600 hover:bg-green-700 gap-1 flex-shrink-0">
                {savingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {savingImage ? 'Saving…' : 'Save Image'}
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-gray-400" onClick={() => setLocalImage(offer.image_url)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Raw Description */}
      <div className="border rounded-xl overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">📄 Raw Description (Original)</p>
        </div>
        <div className="p-4">
          <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
            {offer.description || <span className="italic text-muted-foreground">No description</span>}
          </p>
        </div>
      </div>

      {/* Refined Description Editor */}
      <div className="border rounded-xl overflow-hidden border-purple-200">
        <div className="bg-purple-50 px-4 py-2 border-b border-purple-200 flex items-center justify-between">
          <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">✨ Refined Description</p>
          <div className="flex items-center gap-2">
            {Object.keys(localRefined || {}).length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
                onClick={handleRestoreOriginal}
              >
                <RotateCcw className="h-3 w-3" /> Restore Raw
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSaveRefined}
              disabled={saving}
              className={`h-7 gap-1 text-xs ${saved ? 'bg-green-600' : 'bg-purple-600 hover:bg-purple-700'}`}
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : saved ? <CheckCircle className="h-3 w-3" /> : <Save className="h-3 w-3" />}
              {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Refined'}
            </Button>
          </div>
        </div>
        <div className="p-4 space-y-4">
          {REFINE_FIELDS.map(({ key, label, icon }) => {
            const isRegenerating = refiningField === key;
            const value = localRefined?.[key as keyof typeof localRefined];

            return (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {icon} {label}
                  </label>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-purple-500 hover:text-purple-700 hover:bg-purple-50"
                    onClick={() => handleRefineField(key as RefineField)}
                    disabled={isRegenerating || refiningFull}
                    title={`Regenerate ${label}`}
                  >
                    {isRegenerating
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <RefreshCw className="h-3 w-3" />
                    }
                  </Button>
                </div>

                {/* Editable field */}
                {key === 'event_flow' && (
                  <Input
                    value={(value as string) || ''}
                    onChange={e => setLocalRefined(prev => ({ ...prev, event_flow: e.target.value }))}
                    placeholder="e.g. Register → Deposit → Trade"
                    className="h-8 text-sm"
                    maxLength={60}
                  />
                )}
                {key === 'summary' && (
                  <textarea
                    value={(value as string) || ''}
                    onChange={e => setLocalRefined(prev => ({ ...prev, summary: e.target.value }))}
                    placeholder="User-friendly description..."
                    className="w-full text-sm border rounded-md p-2 resize-none min-h-[72px] focus:outline-none focus:ring-1 focus:ring-purple-500"
                    rows={3}
                  />
                )}
                {key === 'steps' && (
                  <div className="space-y-1.5">
                    {((value as string[]) || []).map((step, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-4">{i + 1}.</span>
                        <Input
                          value={step}
                          onChange={e => {
                            const arr = [...((localRefined?.steps) || [])];
                            arr[i] = e.target.value;
                            setLocalRefined(prev => ({ ...prev, steps: arr }));
                          }}
                          className="h-7 text-xs flex-1"
                        />
                        <button
                          className="text-red-400 hover:text-red-600"
                          onClick={() => {
                            const arr = ((localRefined?.steps) || []).filter((_, idx) => idx !== i);
                            setLocalRefined(prev => ({ ...prev, steps: arr }));
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => setLocalRefined(prev => ({ ...prev, steps: [...(prev?.steps || []), ''] }))}
                    >
                      + Add Event
                    </Button>
                  </div>
                )}
                {key === 'restrictions' && (
                  <div className="space-y-1.5">
                    {((value as string[]) || []).map((r, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          value={r}
                          onChange={e => {
                            const arr = [...((localRefined?.restrictions) || [])];
                            arr[i] = e.target.value;
                            setLocalRefined(prev => ({ ...prev, restrictions: arr }));
                          }}
                          className="h-7 text-xs flex-1"
                        />
                        <button
                          className="text-red-400 hover:text-red-600"
                          onClick={() => {
                            const arr = ((localRefined?.restrictions) || []).filter((_, idx) => idx !== i);
                            setLocalRefined(prev => ({ ...prev, restrictions: arr }));
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => setLocalRefined(prev => ({ ...prev, restrictions: [...(prev?.restrictions || []), ''] }))}
                    >
                      + Add Restriction
                    </Button>
                  </div>
                )}
                {key === 'difficulty' && (
                  <div className="flex gap-2">
                    {(['Easy', 'Medium', 'Hard'] as const).map(d => (
                      <button
                        key={d}
                        onClick={() => setLocalRefined(prev => ({ ...prev, difficulty: d }))}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                          localRefined?.difficulty === d
                            ? d === 'Easy' ? 'bg-green-100 text-green-700 border-green-300' :
                              d === 'Hard' ? 'bg-red-100 text-red-700 border-red-300' :
                              'bg-yellow-100 text-yellow-700 border-yellow-300'
                            : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                )}
                {key === 'estimated_time' && (
                  <Input
                    value={(value as string) || ''}
                    onChange={e => setLocalRefined(prev => ({ ...prev, estimated_time: e.target.value }))}
                    placeholder="e.g. 5 min"
                    className="h-8 text-sm w-32"
                  />
                )}
                {key === 'countries' && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {((value as string[]) || []).map(c => (
                        <span
                          key={c}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full font-medium cursor-pointer hover:bg-red-100 hover:text-red-700 transition-colors"
                          onClick={() => {
                            const arr = ((localRefined?.countries as string[]) || []).filter(x => x !== c);
                            setLocalRefined(prev => ({ ...prev, countries: arr } as any));
                          }}
                          title="Click to remove"
                        >
                          {FLAG_MAP[c] || ''} {c} ×
                        </span>
                      ))}
                      {(!value || (value as string[]).length === 0) && (
                        <span className="text-xs text-muted-foreground italic">No countries extracted</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Add country code (e.g. US)"
                        className="h-7 text-xs w-40"
                        maxLength={2}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            const val = (e.target as HTMLInputElement).value.toUpperCase().trim();
                            if (val.length === 2) {
                              const arr = [...new Set([...((localRefined?.countries as string[]) || []), val])];
                              setLocalRefined(prev => ({ ...prev, countries: arr } as any));
                              (e.target as HTMLInputElement).value = '';
                            }
                          }
                        }}
                      />
                      <div className="flex items-center gap-1.5">
                        <Checkbox
                          id="save-countries"
                          checked={updateCountries}
                          onCheckedChange={v => setUpdateCountries(!!v)}
                        />
                        <label htmlFor="save-countries" className="text-[10px] text-muted-foreground cursor-pointer">
                          Update offer countries on save
                        </label>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Current: {offer.countries.join(', ') || 'none'}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ===================== FILTER BAR =====================
interface FilterState {
  hasEvent: 'all' | 'yes' | 'no';
  minPayout: string;
  maxPayout: string;
  country: string;
  vertical: string;
  network: string;
  difficulty: 'all' | 'Easy' | 'Medium' | 'Hard';
  status: 'all' | 'active' | 'inactive';
  hasImage: 'all' | 'yes' | 'no';
}

const DEFAULT_FILTERS: FilterState = {
  hasEvent: 'all', minPayout: '', maxPayout: '', country: '', vertical: 'all',
  network: 'all', difficulty: 'all', status: 'all', hasImage: 'all',
};

function FilterBar({
  filters, onChange, networks, verticals
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  networks: string[];
  verticals: string[];
}) {
  const [open, setOpen] = useState(false);
  const activeCount = Object.entries(filters).filter(([k, v]) =>
    v !== DEFAULT_FILTERS[k as keyof FilterState] && v !== '' && v !== 'all'
  ).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          variant={activeCount > 0 ? 'default' : 'outline'}
          onClick={() => setOpen(!open)}
          className={`gap-1.5 h-8 ${activeCount > 0 ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters {activeCount > 0 && <span className="bg-white/20 text-white rounded-full px-1.5 py-0 text-[10px]">{activeCount}</span>}
        </Button>
        {/* Quick filters */}
        {(['all', 'yes', 'no'] as const).map(v => (
          <button
            key={v}
            onClick={() => onChange({ ...filters, hasEvent: v })}
            className={`h-8 px-3 rounded-md text-xs font-medium border transition-all ${
              filters.hasEvent === v ? 'bg-purple-600 text-white border-purple-600' : 'bg-white border-gray-200 text-gray-600 hover:border-purple-300'
            }`}
          >
            {v === 'all' ? '⚡ All' : v === 'yes' ? '⚡ Has Event Flow' : '📄 No Event Flow'}
          </button>
        ))}
        {activeCount > 0 && (
          <button
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="h-8 px-3 rounded-md text-xs text-red-600 border border-red-200 hover:bg-red-50"
          >
            Clear All
          </button>
        )}
      </div>

      {open && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 p-4 bg-gray-50 rounded-xl border">
          {/* Payout range */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Min Payout</label>
            <Input value={filters.minPayout} onChange={e => onChange({ ...filters, minPayout: e.target.value })}
              placeholder="$0" className="h-7 text-xs" type="number" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Max Payout</label>
            <Input value={filters.maxPayout} onChange={e => onChange({ ...filters, maxPayout: e.target.value })}
              placeholder="Any" className="h-7 text-xs" type="number" />
          </div>
          {/* Country */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Country</label>
            <Input value={filters.country} onChange={e => onChange({ ...filters, country: e.target.value.toUpperCase() })}
              placeholder="US, UK..." className="h-7 text-xs" maxLength={3} />
          </div>
          {/* Vertical */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Vertical</label>
            <Select value={filters.vertical} onValueChange={v => onChange({ ...filters, vertical: v })}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Verticals</SelectItem>
                {verticals.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* Network */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Network</label>
            <Select value={filters.network} onValueChange={v => onChange({ ...filters, network: v })}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Networks</SelectItem>
                {networks.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* Difficulty */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Difficulty</label>
            <Select value={filters.difficulty} onValueChange={v => onChange({ ...filters, difficulty: v as any })}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any</SelectItem>
                <SelectItem value="Easy">🟢 Easy</SelectItem>
                <SelectItem value="Medium">🟡 Medium</SelectItem>
                <SelectItem value="Hard">🔴 Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Status */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Status</label>
            <Select value={filters.status} onValueChange={v => onChange({ ...filters, status: v as any })}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Has image */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Image</label>
            <Select value={filters.hasImage} onValueChange={v => onChange({ ...filters, hasImage: v as any })}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="yes">Has Image</SelectItem>
                <SelectItem value="no">Missing Image</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}

// ===================== OFFER BASKET (Pick-list panel) =====================
/**
 * OfferBasket — a floating side panel with its own search.
 * Admin searches → picks offers one by one → basket accumulates them.
 * Then clicks "Bulk Edit N Offers" to open BulkEditDialog with only those picked offers.
 */
function OfferBasket() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OfferItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [basket, setBasket] = useState<Map<string, OfferItem>>(new Map());
  const [bulkOpen, setBulkOpen] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await offerwallManagerApi.getOfferwallOfferIds({ search: query.trim() });
        setResults(data.offers.slice(0, 20));
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const toggleBasket = (offer: OfferItem) => {
    setBasket(prev => {
      const next = new Map(prev);
      if (next.has(offer.offer_id)) next.delete(offer.offer_id);
      else next.set(offer.offer_id, offer);
      return next;
    });
  };

  const removeFromBasket = (id: string) => {
    setBasket(prev => { const next = new Map(prev); next.delete(id); return next; });
  };

  const basketOffers = Array.from(basket.values());

  return (
    <>
      {/* Trigger button */}
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 h-8 border-purple-300 text-purple-700 hover:bg-purple-50"
        onClick={() => setOpen(true)}
      >
        <Layers className="h-3.5 w-3.5" />
        Offer Basket{basket.size > 0 ? ` (${basket.size})` : ''}
      </Button>

      {/* Panel */}
      {open && (
        <div className="fixed top-0 right-0 h-full w-[360px] bg-white border-l shadow-2xl z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-purple-50">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-purple-600" />
              <span className="font-semibold text-sm text-purple-800">Offer Basket</span>
              {basket.size > 0 && (
                <span className="bg-purple-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {basket.size}
                </span>
              )}
            </div>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Search */}
          <div className="px-4 py-3 border-b">
            <div className="relative">
              <Input
                placeholder="Search offers to add..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="h-8 text-sm pr-8"
                autoFocus
              />
              {loading && <Loader2 className="absolute right-2 top-1.5 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </div>

          {/* Search results */}
          {results.length > 0 && (
            <div className="border-b max-h-[240px] overflow-y-auto">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-4 py-1.5 bg-gray-50">
                Search Results ({results.length})
              </p>
              {results.map(offer => {
                const inBasket = basket.has(offer.offer_id);
                return (
                  <div
                    key={offer.offer_id}
                    onClick={() => toggleBasket(offer)}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b last:border-0 transition-colors ${
                      inBasket ? 'bg-purple-50 hover:bg-purple-100' : 'hover:bg-gray-50'
                    }`}
                  >
                    <Checkbox checked={inBasket} onCheckedChange={() => toggleBasket(offer)} />
                    <img
                      src={getOfferImage({ image_url: offer.image_url, vertical: offer.category })}
                      alt=""
                      className="w-7 h-7 rounded border object-contain bg-gray-50 flex-shrink-0"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{offer.name}</p>
                      <p className="text-[10px] text-muted-foreground">{offer.network} · ${offer.payout}</p>
                    </div>
                    {inBasket && <CheckCircle className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />}
                  </div>
                );
              })}
            </div>
          )}
          {query.trim() && !loading && results.length === 0 && (
            <div className="px-4 py-3 text-xs text-muted-foreground text-center border-b">No offers found</div>
          )}

          {/* Basket contents */}
          <div className="flex-1 overflow-y-auto">
            {basketOffers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground px-6 text-center">
                <Layers className="h-8 w-8 text-gray-200" />
                <p className="text-xs">Search and select offers above to add them to the basket</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Selected ({basketOffers.length})
                  </p>
                  <button
                    onClick={() => setBasket(new Map())}
                    className="text-[10px] text-red-500 hover:text-red-700"
                  >
                    Clear all
                  </button>
                </div>
                {basketOffers.map(offer => (
                  <div key={offer.offer_id} className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0 hover:bg-gray-50">
                    <img
                      src={getOfferImage({ image_url: offer.image_url, vertical: offer.category })}
                      alt=""
                      className="w-7 h-7 rounded border object-contain bg-gray-50 flex-shrink-0"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{offer.name}</p>
                      <p className="text-[10px] text-muted-foreground">{offer.network} · ${offer.payout}</p>
                    </div>
                    <button
                      onClick={() => removeFromBasket(offer.offer_id)}
                      className="text-gray-400 hover:text-red-500 flex-shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Footer action */}
          {basketOffers.length > 0 && (
            <div className="px-4 py-3 border-t bg-white">
              <Button
                className="w-full bg-purple-600 hover:bg-purple-700 gap-2"
                onClick={() => { setBulkOpen(true); }}
              >
                <Edit3 className="h-4 w-4" />
                Bulk Edit {basketOffers.length} Offer{basketOffers.length !== 1 ? 's' : ''}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setOpen(false)} />
      )}

      {/* Bulk Edit Dialog using basket offers */}
      <BulkEditDialog
        offers={basketOffers}
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
      />
    </>
  );
}

// ===================== BULK EDIT DIALOG =====================
function BulkEditDialog({
  offers,
  open,
  onClose,
}: {
  offers: OfferItem[];
  open: boolean;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const current = offers[currentIndex];

  if (!current) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[96vw] w-[96vw] h-[95vh] max-h-[95vh] overflow-hidden flex flex-col p-0">
        {/* Fixed header */}
        <DialogHeader className="px-6 py-4 border-b bg-white flex-shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <Layers className="h-5 w-5 text-purple-500" />
            <span>Bulk Editor — {currentIndex + 1} / {offers.length}</span>
            {/* Current offer quick info */}
            <span className="text-sm font-normal text-muted-foreground truncate max-w-xs">{current.name}</span>
            <div className="flex items-center gap-1 ml-auto">
              <Button size="sm" variant="outline" className="h-7 gap-1" disabled={currentIndex === 0} onClick={() => setCurrentIndex(i => i - 1)}>
                ← Prev
              </Button>
              <Button size="sm" variant="outline" className="h-7 gap-1" disabled={currentIndex === offers.length - 1} onClick={() => setCurrentIndex(i => i + 1)}>
                Next →
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Progress dots */}
        <div className="flex items-center gap-1 px-6 py-2 border-b bg-gray-50 flex-shrink-0 flex-wrap">
          {offers.map((o, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              title={o.name}
              className={`rounded-full transition-all ${
                i === currentIndex ? 'w-5 h-2.5 bg-purple-600' : 'w-2.5 h-2.5 bg-gray-200 hover:bg-purple-300'
              }`}
            />
          ))}
          <span className="text-[10px] text-muted-foreground ml-2">{offers.length} offers selected</span>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <OfferEditorPanel key={current.offer_id} offer={current} inline />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===================== MAIN COMPONENT =====================
export function OfferwallOfferEditor({
  offers,
  settings,
  starterOfferIds,
  boostedOffers,
  positionInputs,
  selectedOffers,
  pagination,
  onSelectOffer,
  onSelectAll,
  onSelectAllResults,
  selectingAllResults,
  preloadedOffers,
  onTogglePin,
  onToggleVisibility,
  onToggleFeatured,
  onToggleStarter,
  onSetPosition,
  setPositionInputs,
  onPageChange,
  onFiltersChange,
  onBoost,
  onRemoveBoost,
}: OfferwallOfferEditorProps) {
  const { toast } = useToast();
  const [expandedOffers, setExpandedOffers] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  // Cache of selected offer data across searches/pages — synced whenever offers load
  const [selectedOffersCache, setSelectedOffersCache] = useState<Map<string, OfferItem>>(new Map());

  // Whenever the offer list updates, add any newly visible selected offers to the cache
  // Only ADD to cache — never remove based on visibility (only remove when deselected)
  useEffect(() => {
    if (offers.length === 0) return;
    setSelectedOffersCache(prev => {
      let changed = false;
      const next = new Map(prev);
      // Add visible selected offers to cache
      for (const offer of offers) {
        if (selectedOffers.has(offer.offer_id) && !next.has(offer.offer_id)) {
          next.set(offer.offer_id, offer);
          changed = true;
        }
        // Update cached offer data if it's selected (in case name/image changed)
        if (selectedOffers.has(offer.offer_id) && next.has(offer.offer_id)) {
          next.set(offer.offer_id, offer);
        }
      }
      // Remove from cache only if offer was deselected (not in selectedOffers anymore)
      for (const [id] of Array.from(next)) {
        if (!selectedOffers.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed || next.size !== prev.size ? next : prev;
    });
  }, [offers, selectedOffers]);

  // When preloadedOffers arrives (from Select All Results), seed the cache with all offer data
  useEffect(() => {
    if (!preloadedOffers || preloadedOffers.size === 0) return;
    setSelectedOffersCache(prev => {
      const next = new Map(prev);
      for (const [id, offer] of Array.from(preloadedOffers)) {
        if (selectedOffers.has(id)) {
          next.set(id, offer);
        }
      }
      return next;
    });
  }, [preloadedOffers, selectedOffers]);

  // Derive unique networks and verticals from the current offers list
  const networks = useMemo(() => [...new Set(offers.map(o => o.network).filter(Boolean))].sort(), [offers]);
  const verticals = useMemo(() => [...new Set(offers.map(o => o.category).filter(Boolean))].sort(), [offers]);

  // Client-side filtering (on top of server-side search)
  const filteredOffers = useMemo(() => {
    return offers.filter(o => {
      if (filters.hasEvent === 'yes' && !o.refined_description?.event_flow) return false;
      if (filters.hasEvent === 'no' && o.refined_description?.event_flow) return false;
      if (filters.minPayout && o.payout < parseFloat(filters.minPayout)) return false;
      if (filters.maxPayout && o.payout > parseFloat(filters.maxPayout)) return false;
      if (filters.country && !o.countries.some(c => c.toUpperCase().includes(filters.country.toUpperCase()))) return false;
      if (filters.vertical !== 'all' && o.category !== filters.vertical) return false;
      if (filters.network !== 'all' && o.network !== filters.network) return false;
      if (filters.difficulty !== 'all' && o.refined_description?.difficulty !== filters.difficulty) return false;
      if (filters.status !== 'all' && o.status !== filters.status) return false;
      if (filters.hasImage === 'yes' && !o.image_url) return false;
      if (filters.hasImage === 'no' && o.image_url) return false;
      return true;
    });
  }, [offers, filters]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedOffers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const allSelected = filteredOffers.length > 0 && filteredOffers.every(o => selectedOffers.has(o.offer_id));
  const selectedFromFiltered = filteredOffers.filter(o => selectedOffers.has(o.offer_id));

  return (
    <div className="space-y-4">
      {/* Filter Bar + Basket button in same row */}
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <FilterBar filters={filters} onChange={(f) => {
        setFilters(f);
        // Also trigger server-side refetch with backend-compatible filters
        if (onFiltersChange) {
          const backend: Record<string, string> = {};
          if (f.vertical !== 'all') backend.vertical = f.vertical;
          if (f.network !== 'all') backend.network = f.network;
          if (f.country) backend.country = f.country;
          if (f.minPayout) backend.min_payout = f.minPayout;
          if (f.maxPayout) backend.max_payout = f.maxPayout;
          if (f.status !== 'all') backend.status = f.status;
          // hasEvent maps to refined filter
          if (f.hasEvent === 'yes') backend.has_event = 'yes';
          else if (f.hasEvent === 'no') backend.has_event = 'no';
          onFiltersChange(backend);
        }
      }} networks={networks} verticals={verticals} />
        </div>
        {/* Offer Basket — floating side panel for picking offers independently */}
        <div className="flex-shrink-0 pt-0.5">
          <OfferBasket />
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedOffers.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200 flex-wrap">
          <span className="text-sm font-semibold text-purple-800">{selectedOffers.size} selected</span>
          {/* Select All Results button — appears when current page doesn't cover all results */}
          {onSelectAllResults && selectedOffers.size < pagination.total && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 border-purple-300 text-purple-700 hover:bg-purple-100"
              onClick={onSelectAllResults}
              disabled={selectingAllResults}
            >
              {selectingAllResults
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Selecting…</>
                : <>✦ Select All {pagination.total} Results</>
              }
            </Button>
          )}
          <Button
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 gap-1.5 h-8"
            onClick={() => setBulkEditOpen(true)}
            disabled={selectedOffersCache.size === 0 && selectedFromFiltered.length === 0}
          >
            <Edit3 className="h-3.5 w-3.5" />
            Bulk Edit ({selectedOffers.size} total{selectedFromFiltered.length !== selectedOffers.size ? `, ${selectedFromFiltered.length} visible` : ''})
          </Button>
          {onBoost && (
            <Button
              size="sm"
              className="bg-orange-600 hover:bg-orange-700 gap-1.5 h-8"
              onClick={onBoost}
            >
              <Flame className="h-3.5 w-3.5" />
              Boost
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-muted-foreground"
            onClick={() => onSelectAll(false)}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Table Header */}
      <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
        <Checkbox
          checked={allSelected}
          onCheckedChange={c => onSelectAll(!!c)}
          aria-label="Select all"
        />
        <span>Offer</span>
        <span>Controls</span>
      </div>

      {/* Offer Rows */}
      {filteredOffers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          No offers match the current filters
        </div>
      ) : (
        <div className="space-y-2">
          {filteredOffers.map(offer => {
            const id = offer.offer_id;
            const isExpanded = expandedOffers.has(id);
            const isSelected = selectedOffers.has(id);
            const isPinned = settings?.pinned_offers?.includes(id);
            const isHidden = settings?.hidden_offers?.includes(id);
            const isFeatured = settings?.featured_offers?.includes(id);
            const isStarter = starterOfferIds.includes(id);
            const isBoosted = boostedOffers.some(b => b.offer_id === id);
            const boostInfo = boostedOffers.find(b => b.offer_id === id);

            return (
              <div
                key={id}
                className={`border rounded-xl overflow-hidden transition-all ${
                  isSelected ? 'border-purple-300 bg-purple-50/30' : 'border-gray-200 bg-white hover:border-gray-300'
                } ${isBoosted ? 'border-l-4 border-l-orange-400' : ''}`}
              >
                {/* Row Header */}
                <div className="grid grid-cols-[2rem_3rem_1fr_auto] items-center gap-3 p-3">
                  {/* Checkbox */}
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={c => onSelectOffer(id, !!c)}
                    aria-label={`Select ${offer.name}`}
                  />

                  {/* Image */}
                  <img
                    src={getOfferImage({ image_url: offer.image_url, vertical: offer.category })}
                    alt={offer.name}
                    className="w-10 h-10 rounded-lg object-contain bg-gray-50 border p-0.5 flex-shrink-0"
                    onError={e => { (e.target as HTMLImageElement).src = '/category-images/other.png'; }}
                  />

                  {/* Info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm truncate max-w-[280px]">{offer.name}</p>
                      {offer.status !== 'active' && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-100 text-gray-600 border uppercase">{offer.status}</span>
                      )}
                      {isBoosted && (
                        <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full inline-flex items-center gap-1">
                          🔥 {boostInfo?.direction === 'increase' ? '+' : '-'}{boostInfo?.percentage}%
                          {onRemoveBoost && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onRemoveBoost([id]); }}
                              className="ml-0.5 text-orange-400 hover:text-red-600 font-bold"
                              title="Remove boost"
                            >
                              ×
                            </button>
                          )}
                        </span>
                      )}
                      {offer.has_refined && <span className="text-[10px] text-purple-600 font-medium">✨</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-muted-foreground font-mono">{id}</span>
                      <span className="text-[10px] text-gray-500">{offer.network}</span>
                      <span className="text-[10px] font-semibold text-green-700">${offer.payout}</span>
                      <span className="text-[10px] text-gray-500">{offer.category}</span>
                      {offer.countries.slice(0, 3).map(c => (
                        <span key={c} className="text-[11px]">{FLAG_MAP[c] || c}</span>
                      ))}
                      {offer.countries.length > 3 && <span className="text-[10px] text-muted-foreground">+{offer.countries.length - 3}</span>}
                    </div>
                    {offer.refined_description?.event_flow && (
                      <p className="text-[11px] text-purple-600 font-medium mt-0.5 truncate max-w-xs">{offer.refined_description.event_flow}</p>
                    )}
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
                    {/* Last edited */}
                    <div className="hidden md:block text-right mr-2">
                      <LastEdited offer={offer} />
                    </div>
                    {/* Offerwall source */}
                    {(offer as any).offerwall_source && (
                      <div className="hidden lg:block text-right mr-2">
                        <p className="text-[9px] font-medium text-muted-foreground">{(offer as any).offerwall_source.reason}</p>
                        {(offer as any).offerwall_source.date && (
                          <p className="text-[9px] text-muted-foreground/70">
                            {new Date((offer as any).offerwall_source.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Position */}
                    <Input
                      type="number"
                      min={0}
                      className="w-14 h-7 text-[11px] text-center"
                      placeholder="—"
                      value={positionInputs[id] ?? ''}
                      onChange={e => setPositionInputs(prev => ({ ...prev, [id]: e.target.value }))}
                      onBlur={() => {
                        const v = positionInputs[id];
                        if (v === '' || v === '0') onSetPosition(id, '');
                        else if (v?.trim()) onSetPosition(id, v);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const v = positionInputs[id];
                          if (v === '' || v === '0') onSetPosition(id, '');
                          else if (v?.trim()) onSetPosition(id, v);
                        }
                      }}
                      title="Position"
                    />

                    {/* Pin */}
                    <button onClick={() => onTogglePin(id)} className={`p-1.5 rounded-lg transition-colors hover:bg-gray-100 ${isPinned ? 'text-orange-500' : 'text-gray-400'}`} title="Pin">
                      <Star className="h-3.5 w-3.5" fill={isPinned ? 'currentColor' : 'none'} />
                    </button>
                    {/* Visibility */}
                    <button onClick={() => onToggleVisibility(id)} className={`p-1.5 rounded-lg transition-colors hover:bg-gray-100 ${isHidden ? 'text-red-500' : 'text-green-500'}`} title="Toggle visibility">
                      {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    {/* Featured */}
                    <button onClick={() => onToggleFeatured(id)} className={`p-1.5 rounded-lg transition-colors hover:bg-gray-100 ${isFeatured ? 'text-purple-500' : 'text-gray-400'}`} title="Featured">
                      <Sparkles className="h-3.5 w-3.5" fill={isFeatured ? 'currentColor' : 'none'} />
                    </button>
                    {/* Starter */}
                    <button onClick={() => onToggleStarter(id)} className={`p-1.5 rounded-lg transition-colors hover:bg-gray-100 ${isStarter ? 'text-yellow-500' : 'text-gray-400'}`} title="Starter offer">
                      <Pin className="h-3.5 w-3.5" fill={isStarter ? 'currentColor' : 'none'} />
                    </button>

                    {/* Expand arrow */}
                    <button
                      onClick={() => toggleExpand(id)}
                      className={`p-1.5 rounded-lg transition-all hover:bg-purple-50 ${isExpanded ? 'text-purple-600 bg-purple-50' : 'text-gray-400'}`}
                      title={isExpanded ? 'Collapse' : 'Expand editor'}
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Expanded Editor Panel */}
                {isExpanded && (
                  <div className="border-t bg-gray-50/50">
                    <OfferEditorPanel
                      key={id}
                      offer={offer}
                      inline
                      onClose={() => toggleExpand(id)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between pt-4 border-t">
        <p className="text-sm text-muted-foreground">
          {filteredOffers.length < offers.length
            ? <>Showing <strong>{filteredOffers.length}</strong> filtered (of {offers.length} on this page · {pagination.total} total)</>
            : <>Page <strong>{pagination.page}</strong> of <strong>{pagination.pages}</strong> · <strong>{pagination.total}</strong> offers</>
          }
        </p>
        {pagination.pages > 1 && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)}>
              ← Prev
            </Button>
            <span className="text-xs text-muted-foreground">{pagination.page} / {pagination.pages}</span>
            <Button size="sm" variant="outline" disabled={pagination.page >= pagination.pages} onClick={() => onPageChange(pagination.page + 1)}>
              Next →
            </Button>
          </div>
        )}
      </div>

      {/* Bulk Edit Dialog — uses full cache of selected offers across searches */}
      <BulkEditDialog
        offers={selectedOffersCache.size > 0 ? Array.from(selectedOffersCache.values()) : selectedFromFiltered}
        open={bulkEditOpen}
        onClose={() => setBulkEditOpen(false)}
      />
    </div>
  );
}
