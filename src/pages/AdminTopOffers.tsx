import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { 
  Sparkles, 
  Pin, 
  GripVertical, 
  Trash2, 
  Plus, 
  Search, 
  Settings, 
  HelpCircle, 
  TrendingUp, 
  MousePointerClick, 
  Award,
  Layers
} from 'lucide-react';
import { topOffersApi, TopOfferConfig, ActiveOfferOption, TopOffersSettings } from '@/services/topOffersApi';
import { getAuthToken } from '@/utils/cookies';

export default function AdminTopOffers() {
  const [topOffers, setTopOffers] = useState<TopOfferConfig[]>([]);
  const [activeOffers, setActiveOffers] = useState<ActiveOfferOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [mode, setMode] = useState<'manual' | 'auto' | 'hybrid'>('hybrid');
  const [autoCriteria, setAutoCriteria] = useState<'conversions' | 'clicks' | 'requests'>('conversions');
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchTopOffersData();
  }, []);

  const fetchTopOffersData = async () => {
    setLoading(true);
    try {
      const data = await topOffersApi.getTopOffers();
      if (data.success) {
        setTopOffers(data.top_offers || []);
        setActiveOffers(data.active_offers || []);
        if (data.settings) {
          setMode(data.settings.mode);
          setAutoCriteria(data.settings.auto_criteria);
        }
      }
    } catch (err: any) {
      toast({
        title: "Error Loading Data",
        description: err.message || "Failed to load Top Offers management data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaveLoading(true);
    try {
      await topOffersApi.updateSettings({
        mode,
        auto_criteria: autoCriteria
      });
      toast({
        title: "Settings Saved",
        description: "Priority mode and auto-curation criteria have been updated.",
      });
      fetchTopOffersData(); // Refresh data to update remaining slots visualization
    } catch (err: any) {
      toast({
        title: "Error Saving Settings",
        description: err.message || "Failed to save Top Offers settings.",
        variant: "destructive",
      });
    } finally {
      setSaveLoading(false);
    }
  };

  const handleAddOffer = async (offerId: string) => {
    try {
      const res = await topOffersApi.addTopOffer(offerId);
      toast({
        title: "Offer Pinned",
        description: res.message || "Offer has been added to Top Offers list.",
      });
      fetchTopOffersData();
    } catch (err: any) {
      toast({
        title: "Failed to Pin Offer",
        description: err.message || "Offer could not be added.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveOffer = async (offerId: string) => {
    try {
      const res = await topOffersApi.removeTopOffer(offerId);
      toast({
        title: "Offer Unpinned",
        description: res.message || "Offer removed from Top Offers list.",
      });
      fetchTopOffersData();
    } catch (err: any) {
      toast({
        title: "Failed to Unpin Offer",
        description: err.message || "Offer could not be removed.",
        variant: "destructive",
      });
    }
  };

  // HTML5 Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const reordered = [...topOffers];
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(index, 0, removed);
    
    setDraggedIndex(index);
    setTopOffers(reordered);
  };

  const handleDragEnd = async () => {
    setDraggedIndex(null);
    try {
      const ids = topOffers.map(o => o.offer_id);
      await topOffersApi.reorderTopOffers(ids);
      toast({
        title: "Sequence Updated",
        description: "Curated sequence reordered and saved successfully.",
      });
    } catch (err: any) {
      toast({
        title: "Error Reordering",
        description: err.message || "Failed to save new order.",
        variant: "destructive",
      });
    }
  };

  // Filter active offers by search query
  const filteredActiveOffers = activeOffers.filter(offer => 
    offer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    offer.offer_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    offer.vertical.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Render dummy filled slots for Hybrid/Auto Mode so Admin knows how many slots are filled by algorithm
  const maxOffers = 20;
  const pinnedCount = topOffers.length;
  const autoFillSlotsCount = mode === 'auto' ? maxOffers : Math.max(0, maxOffers - pinnedCount);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-orange-600 via-amber-500 to-yellow-500 bg-clip-text text-transparent flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-orange-600 animate-pulse" />
            Top Offers Management
          </h1>
          <p className="text-muted-foreground mt-2 text-base">
            Master control center to curate, pin, and optimize top performing offers displayed on the publisher dashboard.
          </p>
        </div>
      </div>

      {/* Grid Settings Row */}
      <Card className="border border-orange-100 shadow-lg bg-card/60 backdrop-blur-md overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-orange-50/50 to-amber-50/20 border-b border-orange-100/50">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-orange-600" />
            <CardTitle className="text-lg">Dynamic Priority & Curation Settings</CardTitle>
          </div>
          <CardDescription>
            Decide display rules and dynamic behavior for the Top 20 slots without editing code.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid gap-8 md:grid-cols-3">
            {/* Priority Mode Select */}
            <div className="space-y-3">
              <label className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <Layers className="h-4 w-4 text-orange-500" />
                Priority Mode
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['manual', 'auto', 'hybrid'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`px-3 py-2 text-xs font-bold rounded-lg border capitalize transition-all duration-300 ${
                      mode === m
                        ? 'bg-orange-600 text-white border-orange-600 shadow-md shadow-orange-600/20 scale-105'
                        : 'bg-background hover:bg-muted/50 border-border text-muted-foreground'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                {mode === 'manual' && "Strict Mode: Only shows manually pinned offers in exact drag-and-drop order."}
                {mode === 'auto' && "Algorithm Mode: Ignores pinned list and displays top performing offers dynamically."}
                {mode === 'hybrid' && "Smart Hybrid (Recommended): Shows pinned offers first, then auto-fills remaining slots up to Top 20."}
              </p>
            </div>

            {/* Auto Curation Criteria */}
            <div className="space-y-3">
              <label className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <TrendingUp className="h-4 w-4 text-amber-500" />
                Performance Metric
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['conversions', 'clicks', 'requests'] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setAutoCriteria(c)}
                    className={`px-3 py-2 text-xs font-bold rounded-lg border capitalize transition-all duration-300 ${
                      autoCriteria === c
                        ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20 scale-105'
                        : 'bg-background hover:bg-muted/50 border-border text-muted-foreground'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                Metric used by algorithm for auto-curated slots:
                {autoCriteria === 'conversions' && " Highest conversions globally (proven performance)."}
                {autoCriteria === 'clicks' && " Most clicked offers in system (highest CTR/engagement)."}
                {autoCriteria === 'requests' && " Most requested/applied offers by active publishers."}
              </p>
            </div>

            {/* Actions / Info */}
            <div className="flex flex-col justify-between border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-8">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <HelpCircle className="h-4 w-4 text-orange-500" />
                  Top 20 Limit Capped
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Both Admin panel and User dashboard restrict total displayed offers to a maximum of 20 to ensure maximum engagement and premium conversion density.
                </p>
              </div>
              <Button 
                onClick={handleSaveSettings} 
                disabled={saveLoading}
                className="mt-4 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white font-bold w-full transition-all duration-300 hover:shadow-lg hover:shadow-orange-600/25"
              >
                {saveLoading ? 'Updating settings...' : 'Save Settings'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Workspace Column Grid */}
      <div className="grid gap-8 lg:grid-cols-12 items-start">
        {/* Curated Pinned List (Left Column) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="h-6 w-6 text-orange-600" />
              <h2 className="text-xl font-extrabold text-foreground">Curated Sequence</h2>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-orange-100 text-orange-700">
              {pinnedCount} / 20 Pinned
            </span>
          </div>

          <div className="space-y-3 min-h-[400px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 border border-dashed border-border rounded-2xl bg-muted/20">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-600 mb-2"></div>
                <p className="text-xs text-muted-foreground font-semibold">Loading top offers sequence...</p>
              </div>
            ) : topOffers.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-muted rounded-2xl bg-muted/10 h-64">
                <Pin className="h-10 w-10 text-muted-foreground/60 mb-3 rotate-45" />
                <h3 className="font-extrabold text-muted-foreground text-sm">No Pinned Offers</h3>
                <p className="text-xs text-muted-foreground/80 mt-1 max-w-xs leading-relaxed">
                  Pin active offers from the search catalog to customize their slots and drag-and-drop order.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {topOffers.map((offer, index) => (
                  <div
                    key={offer.offer_id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center justify-between p-3.5 bg-card border hover:border-orange-200/80 rounded-xl shadow-sm transition-all duration-200 group ${
                      draggedIndex === index 
                        ? 'opacity-40 border-orange-400 scale-[0.98] bg-orange-50/20' 
                        : 'border-border'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Drag handle */}
                      <div className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground transition-colors">
                        <GripVertical className="h-5 w-5" />
                      </div>
                      
                      {/* Rank Index badge */}
                      <span className="flex items-center justify-center h-6 w-6 rounded-full bg-orange-50 text-orange-600 font-extrabold text-xs border border-orange-100 shadow-sm">
                        {index + 1}
                      </span>

                      {/* Offer Info */}
                      <div>
                        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                          {offer.name}
                          {offer.is_pinned && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-orange-500/10 text-orange-600 border border-orange-500/20 flex items-center gap-0.5">
                              <Pin className="h-2.5 w-2.5 fill-current" /> Pinned
                            </span>
                          )}
                        </h4>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-semibold uppercase">
                            {offer.vertical}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-medium">
                            ID: <code className="font-mono bg-muted/65 px-1 rounded">{offer.offer_id}</code>
                          </span>
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                            Payout: ${offer.payout.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveOffer(offer.offer_id)}
                      className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Auto-fill slots placeholder visualizer */}
            {!loading && (mode === 'hybrid' || mode === 'auto') && autoFillSlotsCount > 0 && (
              <div className="space-y-2 mt-4">
                <div className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase mb-1.5 flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Algorithmically Filled Slots ({autoFillSlotsCount} Remaining)
                </div>
                {Array.from({ length: Math.min(3, autoFillSlotsCount) }).map((_, i) => (
                  <div
                    key={`slot-${i}`}
                    className="flex items-center justify-between p-3.5 border border-dashed border-amber-200/50 bg-amber-50/5 rounded-xl opacity-65"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1 text-muted-foreground/30">
                        <GripVertical className="h-5 w-5" />
                      </div>
                      <span className="flex items-center justify-center h-6 w-6 rounded-full bg-amber-50/50 text-amber-500 font-extrabold text-xs border border-dashed border-amber-200 shadow-sm">
                        {mode === 'auto' ? i + 1 : pinnedCount + i + 1}
                      </span>
                      <div>
                        <h4 className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                          Algorithmically Curated Offer Slot
                        </h4>
                        <p className="text-[10px] text-muted-foreground/75 mt-0.5">
                          Filled dynamically using highest <span className="font-bold text-amber-600">{autoCriteria}</span> metrics.
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 flex items-center gap-0.5">
                      <Sparkles className="h-3 w-3" /> Auto
                    </span>
                  </div>
                ))}
                {autoFillSlotsCount > 3 && (
                  <div className="text-center py-2 text-[10px] font-bold text-muted-foreground border border-dashed border-border rounded-xl bg-muted/5">
                    + {autoFillSlotsCount - 3} more dynamic algorithm slots
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Catalog Search & Add Panel (Right Column) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MousePointerClick className="h-6 w-6 text-orange-600" />
              <h2 className="text-xl font-extrabold text-foreground">Pin Catalog</h2>
            </div>
          </div>

          <Card className="border border-border shadow-md">
            <CardHeader className="p-4 bg-muted/10 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search catalog by name, vertical, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-background focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-2 max-h-[500px] overflow-y-auto">
              {loading ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  Searching catalog...
                </div>
              ) : filteredActiveOffers.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No active unpinned offers match your query.
                </div>
              ) : (
                filteredActiveOffers.map((offer) => (
                  <div
                    key={offer.offer_id}
                    className="flex items-center justify-between p-3 border border-border hover:border-orange-200 hover:bg-orange-50/5 rounded-xl transition-all duration-200"
                  >
                    <div>
                      <h5 className="text-xs font-bold text-foreground">
                        {offer.name}
                      </h5>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] px-1.5 py-0.2 bg-muted text-muted-foreground font-semibold rounded uppercase">
                          {offer.vertical}
                        </span>
                        <span className="text-[9px] text-muted-foreground font-medium">
                          ID: <code className="font-mono bg-muted/65 px-1 rounded">{offer.offer_id}</code>
                        </span>
                        <span className="text-[9px] font-bold text-emerald-600">
                          Payout: ${offer.payout.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <Button
                      onClick={() => handleAddOffer(offer.offer_id)}
                      disabled={pinnedCount >= 20}
                      className="h-8 py-1.5 px-3 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center gap-1 rounded-lg transition-all"
                    >
                      <Plus className="h-3.5 w-3.5" /> Pin
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
