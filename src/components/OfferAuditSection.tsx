import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Check, ArrowRight, MoreHorizontal, ChevronDown } from 'lucide-react';
import { Offer, adminOfferApi } from '@/services/adminOfferApi';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────
interface AuditOfferResult {
  offer_id: string;
  vertical_status: 'correct' | 'wrong' | 'missing';
  suggested_vertical: string;
  description_status: 'full' | 'one_word' | 'empty' | 'missing_vertical_too';
  image_status: 'has_image' | 'no_image';
  image_type: 'ai_generated' | 'stock_moustache' | 'offer_image' | 'no_image';
  name_status: 'clean' | 'messy' | 'needs_confirmation' | 'same_after_clean';
  name_issues: string;
  clean_name: string;
}

interface AuditSummary {
  vertical_correct: number;
  vertical_wrong: number;
  vertical_missing: number;
  desc_full: number;
  desc_one_word: number;
  desc_empty: number;
  desc_missing_vertical_too: number;
  image_has: number;
  image_missing: number;
  image_ai_generated: number;
  image_stock_moustache: number;
  image_offer_image: number;
  name_clean: number;
  name_messy: number;
  name_needs_confirmation: number;
  name_same_after_clean: number;
}

interface PriorityFix {
  action: string;
  reason: string;
  offer_ids: string[];
  impact: 'high' | 'medium' | 'low';
}

type AuditTab = 'verticals' | 'descriptions' | 'images' | 'names';

interface OfferAuditSectionProps {
  offers: Offer[];
  onSwitchToRename: (offerIds: string[]) => void;
  perOfferVerticals: Record<string, string>;
  setPerOfferVerticals: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  perOfferDescs: Record<string, string>;
  setPerOfferDescs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  perOfferImages: Record<string, string>;
  setPerOfferImages: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}


// ─── Summary Card ────────────────────────────────────────────────────
function SummaryCard({ count, label, color, active, onClick }: {
  count: number; label: string; color: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-[100px] p-3 rounded-lg border-2 transition-all text-left ${
        active ? `${color} ring-2 ring-offset-1` : 'border-gray-200 hover:border-gray-300 bg-white dark:bg-gray-900'
      }`}
    >
      <div className="text-2xl font-bold">{count}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </button>
  );
}

// ─── Progress Bar ────────────────────────────────────────────────────
function AuditProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div className={`h-2 rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}


// ─── Main Component ──────────────────────────────────────────────────
export function OfferAuditSection({
  offers,
  onSwitchToRename,
  perOfferVerticals,
  setPerOfferVerticals,
  perOfferDescs,
  setPerOfferDescs,
  perOfferImages,
  setPerOfferImages,
}: OfferAuditSectionProps) {
  const [auditResults, setAuditResults] = useState<AuditOfferResult[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [priorityFixes, setPriorityFixes] = useState<PriorityFix[]>([]);
  const [running, setRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [activeTab, setActiveTab] = useState<AuditTab>('verticals');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [cardFilter, setCardFilter] = useState<string | null>(null);
  const [bulkActing, setBulkActing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  // Track AI suggestions received during audit tab actions
  const [verticalSuggestions, setVerticalSuggestions] = useState<Record<string, string>>({});
  const [descSuggestions, setDescSuggestions] = useState<Record<string, string>>({});

  // ─── Image type classifier (by URL pattern) ──────────────────────
  const classifyImageType = useCallback((url: string): 'ai_generated' | 'stock_moustache' | 'offer_image' | 'no_image' => {
    if (!url || !url.trim()) return 'no_image';
    const lower = url.toLowerCase();
    if (lower.includes('fal.run') || lower.includes('fal-cdn') || lower.includes('fal.ai')) return 'ai_generated';
    if (lower.includes('unsplash.com')) return 'stock_moustache';
    return 'offer_image';
  }, []);

  // ─── Run Full Audit ──────────────────────────────────────────────
  const runAudit = useCallback(async () => {
    setRunning(true);
    try {
      const payload = offers.map(o => ({
        offer_id: o.offer_id,
        name: o.name || '',
        description: o.description || '',
        vertical: o.vertical || o.category || '',
        category: o.category || '',
        image_url: o.image_url || '',
        thumbnail_url: o.thumbnail_url || '',
        countries: o.countries || [],
      }));
      const res = await adminOfferApi.runFullAudit(payload);
      if (res.success && res.audit) {
        // Enrich results with image_type classification (frontend-side, by URL pattern)
        const enrichedOffers = (res.audit.offers || []).map((r: any) => {
          const offer = offers.find(o => o.offer_id === r.offer_id);
          const imgUrl = offer?.image_url || offer?.thumbnail_url || '';
          return { ...r, image_type: classifyImageType(imgUrl), clean_name: r.clean_name || '' };
        });
        setAuditResults(enrichedOffers);
        // Compute extended summary with image sub-types and name sub-types
        const extSummary = {
          ...(res.audit.summary || {}),
          image_ai_generated: enrichedOffers.filter((o: any) => o.image_type === 'ai_generated').length,
          image_stock_moustache: enrichedOffers.filter((o: any) => o.image_type === 'stock_moustache').length,
          image_offer_image: enrichedOffers.filter((o: any) => o.image_type === 'offer_image').length,
          image_has: enrichedOffers.filter((o: any) => o.image_status === 'has_image').length,
          image_missing: enrichedOffers.filter((o: any) => o.image_status === 'no_image').length,
          name_same_after_clean: enrichedOffers.filter((o: any) => o.name_status === 'same_after_clean').length,
        };
        setSummary(extSummary as AuditSummary);
        setPriorityFixes(res.audit.priority_fixes || []);
        // Pre-populate vertical suggestions from audit
        const vSugg: Record<string, string> = {};
        for (const r of (res.audit.offers || [])) {
          if (r.suggested_vertical && (r.vertical_status === 'wrong' || r.vertical_status === 'missing')) {
            vSugg[r.offer_id] = r.suggested_vertical;
          }
        }
        setVerticalSuggestions(vSugg);
        setHasRun(true);
        toast.success(`Audit complete — ${(res.audit.offers || []).length} offers analyzed`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Audit failed');
    } finally {
      setRunning(false);
    }
  }, [offers]);

  // ─── Offer lookup map ────────────────────────────────────────────
  const offerMap = useMemo(() => {
    const m: Record<string, Offer> = {};
    for (const o of offers) m[o.offer_id] = o;
    return m;
  }, [offers]);

  // ─── Filtered lists per tab ──────────────────────────────────────
  const filteredOffers = useMemo(() => {
    if (!hasRun) return [];
    return auditResults.filter(r => {
      if (activeTab === 'verticals') {
        if (cardFilter === 'correct') return r.vertical_status === 'correct';
        if (cardFilter === 'wrong') return r.vertical_status === 'wrong';
        if (cardFilter === 'missing') return r.vertical_status === 'missing';
        return r.vertical_status === 'wrong' || r.vertical_status === 'missing'; // default: show issues
      }
      if (activeTab === 'descriptions') {
        if (cardFilter === 'full') return r.description_status === 'full';
        if (cardFilter === 'one_word') return r.description_status === 'one_word';
        if (cardFilter === 'empty') return r.description_status === 'empty';
        if (cardFilter === 'missing_vertical_too') return r.description_status === 'missing_vertical_too';
        return r.description_status !== 'full'; // default: show issues
      }
      if (activeTab === 'images') {
        if (cardFilter === 'has_image') return r.image_status === 'has_image';
        if (cardFilter === 'ai_generated') return r.image_type === 'ai_generated';
        if (cardFilter === 'stock_moustache') return r.image_type === 'stock_moustache';
        if (cardFilter === 'no_image') return r.image_status === 'no_image';
        return true; // default: show all
      }
      if (activeTab === 'names') {
        if (cardFilter === 'clean') return r.name_status === 'clean';
        if (cardFilter === 'messy') return r.name_status === 'messy';
        if (cardFilter === 'needs_confirmation') return r.name_status === 'needs_confirmation';
        if (cardFilter === 'same_after_clean') return r.name_status === 'same_after_clean';
        return r.name_status !== 'clean'; // default: show issues
      }
      return true;
    });
  }, [auditResults, activeTab, cardFilter, hasRun]);

  // ─── Selection helpers ───────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAll = () => {
    const ids = filteredOffers.map(r => r.offer_id);
    setSelectedIds(new Set(ids));
  };
  const deselectAll = () => setSelectedIds(new Set());

  // ─── Tab issue counts ────────────────────────────────────────────
  const tabCounts = useMemo(() => {
    if (!summary) return { verticals: 0, descriptions: 0, images: 0, names: 0 };
    return {
      verticals: summary.vertical_wrong + summary.vertical_missing,
      descriptions: summary.desc_one_word + summary.desc_empty + summary.desc_missing_vertical_too,
      images: summary.image_missing,
      names: summary.name_messy + summary.name_needs_confirmation + summary.name_same_after_clean,
    };
  }, [summary]);

  // Reset card filter and selection when switching tabs
  const switchTab = (tab: AuditTab) => {
    setActiveTab(tab);
    setCardFilter(null);
    setSelectedIds(new Set());
  };


  // ─── Bulk Actions ────────────────────────────────────────────────
  const handleBulkSuggestVerticals = async () => {
    if (selectedIds.size === 0) return;
    setBulkActing(true);
    try {
      const payload = Array.from(selectedIds).map(id => {
        const o = offerMap[id];
        return { offer_id: id, name: o?.name || '', description: o?.description || '' };
      });
      const res = await adminOfferApi.bulkSuggestVerticals(payload);
      if (res.success && res.suggestions) {
        setVerticalSuggestions(prev => ({ ...prev, ...res.suggestions }));
        toast.success(`AI suggested verticals for ${Object.keys(res.suggestions).length} offers`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to suggest verticals');
    } finally {
      setBulkActing(false);
    }
  };

  const handleBulkApplyVerticals = async () => {
    if (selectedIds.size === 0) return;
    setBulkActing(true);
    try {
      const changes = Array.from(selectedIds)
        .filter(id => verticalSuggestions[id])
        .map(id => ({ offer_id: id, vertical: verticalSuggestions[id] }));
      if (changes.length === 0) {
        toast.error('No suggestions to apply. Run AI Suggest first.');
        setBulkActing(false);
        return;
      }
      const res = await adminOfferApi.bulkApplyVerticals(changes);
      if (res.success) {
        // Update local state
        const updated: Record<string, string> = {};
        for (const c of changes) updated[c.offer_id] = c.vertical;
        setPerOfferVerticals(prev => ({ ...prev, ...updated }));
        // Update audit results to reflect the change
        setAuditResults(prev => prev.map(r => {
          if (updated[r.offer_id]) {
            return { ...r, vertical_status: 'correct' as const, suggested_vertical: updated[r.offer_id] };
          }
          return r;
        }));
        // Update summary counts
        const appliedCount = Object.keys(updated).length;
        setSummary(prev => prev ? {
          ...prev,
          vertical_correct: prev.vertical_correct + appliedCount,
          vertical_wrong: Math.max(0, prev.vertical_wrong - appliedCount),
        } : prev);
        if (res.updated_count > 0) {
          toast.success(`Applied verticals to ${res.updated_count} offers. Refresh the page to see changes in the table.`);
        } else {
          toast.error(`No offers were updated. The offers may already have the correct vertical or the IDs didn't match.`);
        }
        setSelectedIds(new Set());
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to apply verticals');
    } finally {
      setBulkActing(false);
    }
  };

  const handleBulkGenerateDescriptions = async () => {
    if (selectedIds.size === 0) return;
    setBulkActing(true);
    try {
      const payload = Array.from(selectedIds).map(id => {
        const o = offerMap[id];
        return {
          offer_id: id,
          name: o?.name || '',
          vertical: o?.vertical || o?.category || '',
          category: o?.category || '',
          countries: o?.countries || [],
        };
      });
      const res = await adminOfferApi.bulkGenerateDescriptions(payload);
      if (res.success && res.descriptions) {
        setDescSuggestions(prev => ({ ...prev, ...res.descriptions }));
        toast.success(`Generated descriptions for ${Object.keys(res.descriptions).length} offers`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate descriptions');
    } finally {
      setBulkActing(false);
    }
  };

  const handleBulkApplyDescriptions = async () => {
    if (selectedIds.size === 0) return;
    setBulkActing(true);
    try {
      const changes = Array.from(selectedIds)
        .filter(id => descSuggestions[id])
        .map(id => ({ offer_id: id, description: descSuggestions[id] }));
      if (changes.length === 0) {
        toast.error('No descriptions to apply. Generate first.');
        setBulkActing(false);
        return;
      }
      const res = await adminOfferApi.bulkApplyDescriptions(changes);
      if (res.success) {
        const updated: Record<string, string> = {};
        for (const c of changes) updated[c.offer_id] = c.description;
        setPerOfferDescs(prev => ({ ...prev, ...updated }));
        toast.success(res.message || `Applied descriptions to ${res.updated_count} offers`);
        setSelectedIds(new Set());
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to apply descriptions');
    } finally {
      setBulkActing(false);
    }
  };

  const handleBulkAssignDefaultImages = async () => {
    if (selectedIds.size === 0) return;
    setBulkActing(true);
    try {
      const res = await adminOfferApi.assignRandomImages();
      if (res.success) {
        toast.success(res.message || `Assigned images to ${res.updated_count} offers`);
        setSelectedIds(new Set());
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign images');
    } finally {
      setBulkActing(false);
    }
  };

  const handleFixNames = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    onSwitchToRename(ids);
  };


  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className="border rounded-lg bg-gradient-to-r from-amber-50/40 to-orange-50/40 dark:from-amber-950/10 dark:to-orange-950/10">
      {/* Header */}
      <div className="flex items-center justify-between p-3 cursor-pointer" onClick={() => setCollapsed(!collapsed)}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold">Offer Audit Dashboard</span>
          <span className="text-[10px] text-muted-foreground">{offers.length} offers · 4 checks</span>
          {hasRun && summary && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-green-50 text-green-700 border-green-200">
              ✓ Audited
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={(e) => { e.stopPropagation(); runAudit(); }}
            disabled={running || offers.length === 0}
            className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white h-7 text-xs"
          >
            {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {running ? 'Auditing...' : 'Run Full Audit'}
          </Button>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </div>
      </div>

      {!collapsed && hasRun && summary && (
        <div className="px-3 pb-3 space-y-3">
          {/* Score bars */}
          <div className="grid grid-cols-4 gap-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span>Verticals</span>
                <span className="font-medium">{summary.vertical_correct}/{offers.length}</span>
              </div>
              <AuditProgressBar value={summary.vertical_correct} max={offers.length} color="bg-green-500" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span>Descriptions</span>
                <span className="font-medium">{summary.desc_full}/{offers.length}</span>
              </div>
              <AuditProgressBar value={summary.desc_full} max={offers.length} color="bg-blue-500" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span>Images</span>
                <span className="font-medium">{summary.image_has}/{offers.length}</span>
              </div>
              <AuditProgressBar value={summary.image_has} max={offers.length} color="bg-violet-500" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span>Names</span>
                <span className="font-medium">{summary.name_clean}/{offers.length}</span>
              </div>
              <AuditProgressBar value={summary.name_clean} max={offers.length} color="bg-orange-500" />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b">
            {([
              { key: 'verticals' as AuditTab, label: 'Verticals', count: tabCounts.verticals },
              { key: 'descriptions' as AuditTab, label: 'Descriptions', count: tabCounts.descriptions },
              { key: 'images' as AuditTab, label: 'Images', count: tabCounts.images },
              { key: 'names' as AuditTab, label: 'Names', count: tabCounts.names },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => switchTab(tab.key)}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-amber-500 text-amber-700'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 bg-red-50 text-red-600 border-red-200">
                    {tab.count} issues
                  </Badge>
                )}
              </button>
            ))}
          </div>


          {/* Tab Content: Summary Cards */}
          <div className="flex gap-2 flex-wrap">
            {activeTab === 'verticals' && (
              <>
                <SummaryCard count={summary.vertical_correct} label="✅ Right vertical" color="border-green-400 bg-green-50" active={cardFilter === 'correct'} onClick={() => setCardFilter(cardFilter === 'correct' ? null : 'correct')} />
                <SummaryCard count={summary.vertical_wrong} label="❌ Wrong vertical" color="border-red-400 bg-red-50" active={cardFilter === 'wrong'} onClick={() => setCardFilter(cardFilter === 'wrong' ? null : 'wrong')} />
                <SummaryCard count={summary.vertical_missing} label="⚠️ No vertical" color="border-amber-400 bg-amber-50" active={cardFilter === 'missing'} onClick={() => setCardFilter(cardFilter === 'missing' ? null : 'missing')} />
              </>
            )}
            {activeTab === 'descriptions' && (
              <>
                <SummaryCard count={summary.desc_full} label="✅ Full desc" color="border-green-400 bg-green-50" active={cardFilter === 'full'} onClick={() => setCardFilter(cardFilter === 'full' ? null : 'full')} />
                <SummaryCard count={summary.desc_one_word} label="📝 1-word" color="border-amber-400 bg-amber-50" active={cardFilter === 'one_word'} onClick={() => setCardFilter(cardFilter === 'one_word' ? null : 'one_word')} />
                <SummaryCard count={summary.desc_empty} label="❌ No desc" color="border-red-400 bg-red-50" active={cardFilter === 'empty'} onClick={() => setCardFilter(cardFilter === 'empty' ? null : 'empty')} />
                <SummaryCard count={summary.desc_missing_vertical_too} label="🔥 Missing both" color="border-purple-400 bg-purple-50" active={cardFilter === 'missing_vertical_too'} onClick={() => setCardFilter(cardFilter === 'missing_vertical_too' ? null : 'missing_vertical_too')} />
              </>
            )}
            {activeTab === 'images' && (
              <>
                <SummaryCard count={summary.image_has} label="✅ Has image" color="border-green-400 bg-green-50" active={cardFilter === 'has_image'} onClick={() => setCardFilter(cardFilter === 'has_image' ? null : 'has_image')} />
                <SummaryCard count={summary.image_ai_generated} label="🤖 AI generated" color="border-violet-400 bg-violet-50" active={cardFilter === 'ai_generated'} onClick={() => setCardFilter(cardFilter === 'ai_generated' ? null : 'ai_generated')} />
                <SummaryCard count={summary.image_stock_moustache} label="📷 Moustache stock" color="border-blue-400 bg-blue-50" active={cardFilter === 'stock_moustache'} onClick={() => setCardFilter(cardFilter === 'stock_moustache' ? null : 'stock_moustache')} />
                <SummaryCard count={summary.image_missing} label="❌ No image" color="border-red-400 bg-red-50" active={cardFilter === 'no_image'} onClick={() => setCardFilter(cardFilter === 'no_image' ? null : 'no_image')} />
              </>
            )}
            {activeTab === 'names' && (
              <>
                <SummaryCard count={summary.name_clean} label="✅ Clean names" color="border-green-400 bg-green-50" active={cardFilter === 'clean'} onClick={() => setCardFilter(cardFilter === 'clean' ? null : 'clean')} />
                <SummaryCard count={summary.name_messy} label="❌ Messy names" color="border-red-400 bg-red-50" active={cardFilter === 'messy'} onClick={() => setCardFilter(cardFilter === 'messy' ? null : 'messy')} />
                <SummaryCard count={summary.name_needs_confirmation} label="⚠️ Need confirmation" color="border-amber-400 bg-amber-50" active={cardFilter === 'needs_confirmation'} onClick={() => setCardFilter(cardFilter === 'needs_confirmation' ? null : 'needs_confirmation')} />
                <SummaryCard count={summary.name_same_after_clean} label="🔄 Same after clean" color="border-purple-400 bg-purple-50" active={cardFilter === 'same_after_clean'} onClick={() => setCardFilter(cardFilter === 'same_after_clean' ? null : 'same_after_clean')} />
              </>
            )}
          </div>

          {/* Select all + count */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={selectedIds.size > 0 && selectedIds.size === filteredOffers.length}
                onChange={() => selectedIds.size === filteredOffers.length ? deselectAll() : selectAll()}
                className="rounded border-gray-300"
              />
              Select all in view
            </label>
            <span className="text-[10px] text-muted-foreground">{selectedIds.size} selected</span>
          </div>


          {/* Offer List */}
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {filteredOffers.map(result => {
              const offer = offerMap[result.offer_id];
              if (!offer) return null;
              const isSelected = selectedIds.has(result.offer_id);
              const currentVertical = perOfferVerticals[result.offer_id] || offer.vertical || offer.category || '';
              const suggestedVertical = verticalSuggestions[result.offer_id] || result.suggested_vertical || '';
              const generatedDesc = descSuggestions[result.offer_id] || '';

              return (
                <div
                  key={result.offer_id}
                  className={`flex items-start gap-2 p-2 rounded border text-xs transition-colors ${
                    isSelected ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20' : 'border-gray-200 bg-white dark:bg-gray-900'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(result.offer_id)}
                    className="mt-1 rounded border-gray-300 shrink-0"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="font-medium truncate">{offer.name}</div>

                    {/* Verticals tab: show current vs suggested */}
                    {activeTab === 'verticals' && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {currentVertical ? (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            result.vertical_status === 'correct'
                              ? 'bg-green-100 text-green-700 border border-green-200'
                              : 'bg-red-100 text-red-700 border border-red-200 line-through'
                          }`}>
                            {currentVertical}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-400 border border-gray-200">No vertical</span>
                        )}
                        {result.vertical_status !== 'correct' && suggestedVertical && (
                          <>
                            <ArrowRight className="h-3 w-3 text-green-500" />
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700 border border-green-200">
                              {suggestedVertical}
                            </span>
                          </>
                        )}
                        {perOfferVerticals[result.offer_id] && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 bg-blue-50 text-blue-600 border-blue-200">✓ Applied</Badge>
                        )}
                      </div>
                    )}

                    {/* Descriptions tab */}
                    {activeTab === 'descriptions' && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            result.description_status === 'full' ? 'bg-green-100 text-green-700' :
                            result.description_status === 'one_word' ? 'bg-amber-100 text-amber-700' :
                            result.description_status === 'missing_vertical_too' ? 'bg-purple-100 text-purple-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {result.description_status === 'full' ? 'Full' :
                             result.description_status === 'one_word' ? '1-word' :
                             result.description_status === 'missing_vertical_too' ? 'Missing both' : 'No desc'}
                          </span>
                          {perOfferDescs[result.offer_id] && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-blue-50 text-blue-600 border-blue-200">✓ Applied</Badge>
                          )}
                        </div>
                        {offer.description && (
                          <p className="text-[10px] text-muted-foreground truncate">{offer.description}</p>
                        )}
                        {generatedDesc && !perOfferDescs[result.offer_id] && (
                          <div className="flex items-start gap-1.5 p-1.5 rounded bg-blue-50/50 border border-blue-100">
                            <Sparkles className="h-3 w-3 text-blue-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-blue-700">{generatedDesc}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Images tab */}
                    {activeTab === 'images' && (
                      <div className="flex items-center gap-2">
                        {(offer.image_url || offer.thumbnail_url || perOfferImages[result.offer_id]) ? (
                          <img
                            src={perOfferImages[result.offer_id] || offer.image_url || offer.thumbnail_url}
                            alt=""
                            className="w-10 h-10 rounded border object-cover"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded border border-dashed border-red-300 bg-red-50 flex items-center justify-center text-red-400 text-[10px]">
                            None
                          </div>
                        )}
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          result.image_type === 'ai_generated' ? 'bg-violet-100 text-violet-700 border border-violet-200' :
                          result.image_type === 'stock_moustache' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                          result.image_type === 'offer_image' ? 'bg-green-100 text-green-700 border border-green-200' :
                          'bg-red-100 text-red-700 border border-red-200'
                        }`}>
                          {result.image_type === 'ai_generated' ? '🤖 AI Generated' :
                           result.image_type === 'stock_moustache' ? '📷 Moustache Stock' :
                           result.image_type === 'offer_image' ? '✅ Offer Image' : '❌ No Image'}
                        </span>
                        {perOfferImages[result.offer_id] && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 bg-blue-50 text-blue-600 border-blue-200">✓ New image</Badge>
                        )}
                      </div>
                    )}

                    {/* Names tab */}
                    {activeTab === 'names' && (
                      <div className="space-y-1">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          result.name_status === 'clean' ? 'bg-green-100 text-green-700' :
                          result.name_status === 'messy' ? 'bg-red-100 text-red-700' :
                          result.name_status === 'same_after_clean' ? 'bg-purple-100 text-purple-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {result.name_status === 'clean' ? 'Clean' :
                           result.name_status === 'messy' ? 'Messy' :
                           result.name_status === 'same_after_clean' ? 'Duplicate after clean' : 'Needs confirmation'}
                        </span>
                        {result.name_issues && (
                          <p className="text-[10px] text-muted-foreground">{result.name_issues}</p>
                        )}
                        {result.clean_name && result.name_status !== 'clean' && (
                          <p className="text-[10px] text-blue-600">→ Clean: <span className="font-medium">{result.clean_name}</span></p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredOffers.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                {hasRun ? 'No offers match this filter' : 'Run audit to see results'}
              </p>
            )}
          </div>


          {/* Sticky Bulk Action Bar */}
          {selectedIds.size > 0 && (
            <div className="sticky bottom-0 flex items-center gap-2 p-2 rounded-lg border bg-white dark:bg-gray-900 shadow-md flex-wrap">
              <span className="text-xs font-medium text-muted-foreground">{selectedIds.size} selected</span>
              <div className="h-4 w-px bg-gray-200" />

              {activeTab === 'verticals' && (
                <>
                  <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={handleBulkSuggestVerticals} disabled={bulkActing}>
                    {bulkActing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    AI Suggest Vertical
                  </Button>
                  <Button size="sm" className="h-7 text-[10px] gap-1 bg-green-600 hover:bg-green-700 text-white" onClick={handleBulkApplyVerticals} disabled={bulkActing}>
                    <Check className="h-3 w-3" /> Apply Verticals
                  </Button>
                </>
              )}

              {activeTab === 'descriptions' && (
                <>
                  <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={handleBulkGenerateDescriptions} disabled={bulkActing}>
                    {bulkActing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Generate Descriptions
                  </Button>
                  <Button size="sm" className="h-7 text-[10px] gap-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleBulkApplyDescriptions} disabled={bulkActing}>
                    <Check className="h-3 w-3" /> Apply Descriptions
                  </Button>
                </>
              )}

              {activeTab === 'images' && (
                <>
                  <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={handleBulkAssignDefaultImages} disabled={bulkActing}>
                    {bulkActing ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    Set Default Images
                  </Button>
                </>
              )}

              {activeTab === 'names' && (
                <Button size="sm" className="h-7 text-[10px] gap-1 bg-amber-600 hover:bg-amber-700 text-white" onClick={handleFixNames}>
                  <ArrowRight className="h-3 w-3" /> Fix Names in Rename Mode
                </Button>
              )}
            </div>
          )}

          {/* Priority Fixes */}
          {priorityFixes.length > 0 && (
            <div className="space-y-1.5 border-t pt-2">
              <div className="text-[11px] font-medium text-muted-foreground">🎯 Priority Actions (AI recommended)</div>
              {priorityFixes.map((fix, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded border bg-white dark:bg-gray-900 text-xs">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                    fix.impact === 'high' ? 'bg-red-100 text-red-700' :
                    fix.impact === 'medium' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {fix.impact.toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{fix.action}</div>
                    <div className="text-[10px] text-muted-foreground">{fix.reason}</div>
                  </div>
                  {fix.offer_ids && fix.offer_ids.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[9px] shrink-0"
                      onClick={() => {
                        setSelectedIds(new Set(fix.offer_ids));
                        // Auto-switch to relevant tab based on action text
                        const actionLower = fix.action.toLowerCase();
                        if (actionLower.includes('vertical') || actionLower.includes('categor')) switchTab('verticals');
                        else if (actionLower.includes('desc')) switchTab('descriptions');
                        else if (actionLower.includes('image')) switchTab('images');
                        else if (actionLower.includes('name') || actionLower.includes('rename')) switchTab('names');
                      }}
                    >
                      Select {fix.offer_ids.length}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Not yet run state */}
      {!collapsed && !hasRun && !running && (
        <div className="px-3 pb-3 text-center">
          <p className="text-xs text-muted-foreground">Hit "Run Full Audit" to analyze all {offers.length} offers with AI</p>
        </div>
      )}

      {/* Running state */}
      {!collapsed && running && (
        <div className="px-3 pb-3 flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          <p className="text-xs text-muted-foreground">AI is analyzing {offers.length} offers...</p>
        </div>
      )}
    </div>
  );
}