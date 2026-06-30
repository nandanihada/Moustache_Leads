import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { offerwallManagerApi, OfferwallSettings, OfferwallStats } from "@/services/offerwallManagerApi";
import { useToast } from "@/hooks/use-toast";
import { TEMPLATE_OPTIONS, TemplateName } from "@/components/survey-templates/SurveyTemplateRenderer";
import { OfferwallOfferEditor } from "@/components/OfferwallOfferEditor";
import { OfferwallReports } from "@/components/OfferwallReports";
import {
  Card, CardContent, CardHeader, CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tabs, TabsContent, TabsList, TabsTrigger
} from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
  Star, Eye, EyeOff, Sparkles, Plus, Trash2, Save,
  BarChart3, Pin, Layout, Monitor, X, ChevronLeft, ChevronRight,
  Activity, CheckCircle, Clock, AlertCircle, Search, RefreshCw,
  Flame, TrendingUp, TrendingDown, Hash, Wand2, Globe, Loader2, Pencil, Mail
} from "lucide-react";

// ===================== BOOST COUNTDOWN COMPONENT =====================
const BoostTimer: React.FC<{ expiresAt: string }> = ({ expiresAt }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const calc = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setExpired(true); setTimeLeft('Expired'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    calc();
    const iv = setInterval(calc, 1000);
    return () => clearInterval(iv);
  }, [expiresAt]);

  if (expired) return <span className="text-[10px] text-red-500 font-medium">Expired</span>;
  return <span className="text-[10px] font-mono text-orange-600 font-bold">{timeLeft}</span>;
};

// ===================== TRACKING TAB COMPONENT =====================
const TrackingTab: React.FC = () => {
  return (
    <TabsContent value="tracking" className="mt-0">
      <OfferwallReports />
    </TabsContent>
  );
};

const AdminOfferwallManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [announcementText, setAnnouncementText] = useState("");
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
  const [selectedOffers, setSelectedOffers] = useState<Set<string>>(new Set());
  const [selectingAllResults, setSelectingAllResults] = useState(false);
  const [preloadedOffers, setPreloadedOffers] = useState<Map<string, any>>(new Map());
  const [offerwallPage, setOfferwallPage] = useState(1);
  const [starterOfferIds, setStarterOfferIds] = useState<string[]>([]);
  const [qualSurveySettings, setQualSurveySettings] = useState<{points: number; display_title: string; display_description: string; display_image_url: string; template: string} | null>(null);
  const [qualSaving, setQualSaving] = useState(false);
  // Price Boost state
  const [showBoostDialog, setShowBoostDialog] = useState(false);
  const [boostPercentage, setBoostPercentage] = useState(10);
  const [boostDirection, setBoostDirection] = useState<'increase' | 'decrease'>('increase');
  const [boostDuration, setBoostDuration] = useState(24);
  const [boostMinutes, setBoostMinutes] = useState(0);
  const [showBoostedOnly, setShowBoostedOnly] = useState(false);
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);
  const [boostedOffers, setBoostedOffers] = useState<any[]>([]);
  // Boost Email Notification state
  const [boostEmailEnabled, setBoostEmailEnabled] = useState(false);
  const [boostEmailRecipients, setBoostEmailRecipients] = useState<string[]>([]);
  const [boostEmailExcluded, setBoostEmailExcluded] = useState<string[]>([]);
  const [boostEmailMode, setBoostEmailMode] = useState<'include' | 'exclude' | 'permanent'>('include');
  const [boostEmailInput, setBoostEmailInput] = useState('');
  const [boostEmailSubject, setBoostEmailSubject] = useState('Price Boost Applied — Offerwall Update');
  const [boostEmailMessage, setBoostEmailMessage] = useState('');
  const [boostEmailBody, setBoostEmailBody] = useState('');
  const [boostEmailPreview, setBoostEmailPreview] = useState(false);
  const [boostEmailSending, setBoostEmailSending] = useState(false);
  const [permanentExclusions, setPermanentExclusions] = useState<string[]>([]);
  const [publisherList, setPublisherList] = useState<Array<{email: string; name: string; company?: string}>>([]);
  const [publisherSearch, setPublisherSearch] = useState('');
  const [publisherListLoading, setPublisherListLoading] = useState(false);
  // Position state
  const [positionInputs, setPositionInputs] = useState<Record<string, string>>({});
  // AI Description Refiner state
  const [refineDialogOpen, setRefineDialogOpen] = useState(false);
  const [refiningOfferId, setRefiningOfferId] = useState<string | null>(null);
  const [refineLoading, setRefineLoading] = useState(false);
  const [refinedResult, setRefinedResult] = useState<any>(null);
  const [refineUpdateCountries, setRefineUpdateCountries] = useState(true);
  const [refineSaving, setRefineSaving] = useState(false);
  const [refineEditMode, setRefineEditMode] = useState(false);
  // Refined filter for offerwall manager
  const [refinedFilter, setRefinedFilter] = useState<string>('');
  // Backend filters from the OfferwallOfferEditor (passed up for server-side filtering)
  const [backendFilters, setBackendFilters] = useState<Record<string, string>>({});
  // Force-hide by offer ID
  const [forceHideId, setForceHideId] = useState('');
  const [forceHiding, setForceHiding] = useState(false);

  // Fetch starter offers
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/offerwall-management/new-user-offers`)
      .then(r => r.ok ? r.json() : { offer_ids: [] })
      .then(d => setStarterOfferIds(d.offer_ids || []))
      .catch(() => {});
    // Fetch qualification survey settings
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/surveys/qualification`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.survey) {
          setQualSurveySettings({
            points: d.survey.points || 6,
            display_title: d.survey.display_title || 'Qualification Survey',
            display_description: d.survey.display_description || 'Complete this survey to unlock all offers and start earning',
            display_image_url: d.survey.display_image_url || '',
            template: d.survey.template || 'moustache-default',
          });
        }
      })
      .catch(() => {});
  }, []);

  // Fetch boosted offers
  const loadBoostedOffers = async () => {
    try {
      const data = await offerwallManagerApi.getActiveBoostedOffers();
      setBoostedOffers(data.boosted_offers || []);
    } catch { setBoostedOffers([]); }
  };
  useEffect(() => { loadBoostedOffers(); }, []);

  // Fetch publishers for email recipients
  const loadPublishers = async (search: string = '') => {
    setPublisherListLoading(true);
    try {
      const { getAuthToken } = await import('@/utils/cookies');
      const token = getAuthToken();
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      params.append('status', 'active');
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/insights/partners?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPublisherList((data.partners || []).map((p: any) => ({
          email: p.email,
          name: p.name || p.company_name || p.username || '',
          company: p.company_name || ''
        })));
      }
    } catch { setPublisherList([]); }
    finally { setPublisherListLoading(false); }
  };

  // Load permanent email exclusions
  const loadPermanentExclusions = async () => {
    try {
      const { getAuthToken } = await import('@/utils/cookies');
      const token = getAuthToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/insights/email-exclusions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPermanentExclusions((data.excluded_emails || []).map((e: any) => e.email));
      }
    } catch {}
  };

  const addToPermanentExclusion = async (emails: string[]) => {
    try {
      const { getAuthToken } = await import('@/utils/cookies');
      const token = getAuthToken();
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/insights/email-exclusions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ emails, reason: 'Excluded from boost email' })
      });
      setPermanentExclusions(prev => [...new Set([...prev, ...emails])]);
      toast({ title: "Permanently Excluded", description: `${emails.length} email(s) added to permanent exclusion list` });
    } catch {
      toast({ title: "Error", description: "Failed to save exclusion", variant: "destructive" });
    }
  };

  // Fetch settings
  const { data: settings, isLoading: settingsLoading } = useQuery<OfferwallSettings>({
    queryKey: ['offerwall-management-settings'],
    queryFn: () => offerwallManagerApi.getSettings(),
  });

  // Fetch stats
  const { data: stats } = useQuery<OfferwallStats>({
    queryKey: ['offerwall-management-stats'],
    queryFn: () => offerwallManagerApi.getStats(),
  });

  // Fetch offers (only those visible on the offerwall)
  const { data: offersData, isLoading: offersLoading } = useQuery({
    queryKey: ['offerwall-management-offers', search, offerwallPage, refinedFilter, backendFilters],
    queryFn: () => offerwallManagerApi.getOfferwallOffers({ 
      search, page: offerwallPage, per_page: 30, 
      refined: refinedFilter || undefined,
      ...backendFilters
    }),
  });

  // Pre-populate position inputs from offers data
  useEffect(() => {
    if (offersData) {
      const offersList = offersData?.offers || offersData?.data || [];
      const positions: Record<string, string> = {};
      for (const offer of offersList) {
        const id = offer.offer_id || offer._id;
        if (offer.offerwall_position != null && offer.offerwall_position !== undefined) {
          positions[id] = String(offer.offerwall_position);
        }
      }
      if (Object.keys(positions).length > 0) {
        setPositionInputs(prev => ({ ...positions, ...prev }));
      }
    }
  }, [offersData]);

  // Mutations
  const updateSettingsMutation = useMutation({
    mutationFn: (data: Partial<OfferwallSettings>) => offerwallManagerApi.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offerwall-management-settings'] });
      toast({ title: "Settings saved", description: "Offerwall settings updated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    }
  });

  const pinMutation = useMutation({
    mutationFn: ({ offer_ids, action }: { offer_ids: string[]; action: 'pin' | 'unpin' }) =>
      offerwallManagerApi.pinOffers(offer_ids, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offerwall-management-settings'] });
      queryClient.invalidateQueries({ queryKey: ['offerwall-management-stats'] });
      toast({ title: "Updated", description: "Pin status updated." });
    }
  });

  const visibilityMutation = useMutation({
    mutationFn: ({ offer_ids, action }: { offer_ids: string[]; action: 'show' | 'hide' }) =>
      offerwallManagerApi.setVisibility(offer_ids, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offerwall-management-settings'] });
      queryClient.invalidateQueries({ queryKey: ['offerwall-management-stats'] });
      queryClient.invalidateQueries({ queryKey: ['offerwall-management-offers'] });
      setSelectedOffers(new Set());
      toast({ title: "Updated", description: "Visibility updated." });
    }
  });

  // Local settings state for editing
  const [localTheme, setLocalTheme] = useState<OfferwallSettings['theme'] | null>(null);
  const theme = localTheme || settings?.theme || {
    primary_color: "#6366f1",
    layout: "grid" as const,
    cards_per_row: 3,
    show_categories: true,
    show_search: true
  };

  const handleSaveTheme = () => {
    updateSettingsMutation.mutate({ theme });
  };

  const handleTogglePin = (offerId: string) => {
    const isPinned = settings?.pinned_offers?.includes(offerId);
    pinMutation.mutate({
      offer_ids: [offerId],
      action: isPinned ? 'unpin' : 'pin'
    });
  };

  const handleToggleVisibility = (offerId: string) => {
    const isHidden = settings?.hidden_offers?.includes(offerId);
    visibilityMutation.mutate({
      offer_ids: [offerId],
      action: isHidden ? 'show' : 'hide'
    });
  };

  const handleToggleFeatured = (offerIdOrIds: string) => {
    const currentFeatured = settings?.featured_offers || [];
    let newFeatured: string[];

    if (offerIdOrIds.startsWith('add:')) {
      // Force add all
      const ids = offerIdOrIds.replace('add:', '').split(',');
      newFeatured = [...new Set([...currentFeatured, ...ids])];
    } else if (offerIdOrIds.startsWith('remove:')) {
      // Force remove all
      const ids = offerIdOrIds.replace('remove:', '').split(',');
      newFeatured = currentFeatured.filter(id => !ids.includes(id));
    } else {
      // Single toggle or bulk toggle
      const ids = offerIdOrIds.includes(',') ? offerIdOrIds.split(',') : [offerIdOrIds];
      const allAlreadyFeatured = ids.every(id => currentFeatured.includes(id));
      if (allAlreadyFeatured) {
        newFeatured = currentFeatured.filter(id => !ids.includes(id));
      } else {
        newFeatured = [...new Set([...currentFeatured, ...ids])];
      }
    }
    updateSettingsMutation.mutate({ featured_offers: newFeatured });
  };

  const handleAddAnnouncement = () => {
    if (!announcementText.trim()) return;
    const newAnnouncement = {
      text: announcementText.trim(),
      active: true,
      id: `ann_${Date.now()}`
    };
    const current = settings?.announcements || [];
    updateSettingsMutation.mutate({ announcements: [...current, newAnnouncement] });
    setAnnouncementText("");
    setShowAnnouncementDialog(false);
  };

  const handleRemoveAnnouncement = (id: string) => {
    const current = settings?.announcements || [];
    updateSettingsMutation.mutate({ announcements: current.filter(a => a.id !== id) });
  };

  const handleToggleAnnouncement = (id: string) => {
    const current = settings?.announcements || [];
    const updated = current.map(a => a.id === id ? { ...a, active: !a.active } : a);
    updateSettingsMutation.mutate({ announcements: updated });
  };

  const offers = offersData?.offers || offersData?.data || [];
  const pagination = offersData?.pagination || { page: 1, per_page: 30, total: 0, pages: 1 };

  const handleSelectOffer = (offerId: string, checked: boolean) => {
    setSelectedOffers(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(offerId);
      } else {
        next.delete(offerId);
      }
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = offers.map((o: any) => o.offer_id || o._id);
      setSelectedOffers(new Set(allIds));
    } else {
      setSelectedOffers(new Set());
    }
  };

  // Fetch ALL matching offer IDs across all pages and select them all
  const handleSelectAllResults = async () => {
    setSelectingAllResults(true);
    try {
      const result = await offerwallManagerApi.getOfferwallOfferIds({
        search,
        refined: refinedFilter || undefined,
        ...backendFilters,
      });
      const allIds = new Set<string>(result.offer_ids);
      // Pre-populate offer data map so BulkEdit has full objects for all selected offers
      const offerMap = new Map<string, any>();
      for (const offer of result.offers) {
        offerMap.set(offer.offer_id, offer);
      }
      setPreloadedOffers(offerMap);
      setSelectedOffers(allIds);
      toast({ title: `${allIds.size} offers selected`, description: 'All results across all pages selected. Open Bulk Edit to refine them.' });
    } catch {
      toast({ title: 'Error', description: 'Could not select all results', variant: 'destructive' });
    } finally {
      setSelectingAllResults(false);
    }
  };

  const handleBulkRemove = () => {
    if (selectedOffers.size === 0) return;
    visibilityMutation.mutate({
      offer_ids: Array.from(selectedOffers),
      action: 'hide'
    });
  };

  // Bulk remove from offerwall (sets show_in_offerwall: false)
  const handleBulkRemoveFromOfferwall = async () => {
    if (selectedOffers.size === 0) return;
    try {
      await offerwallManagerApi.bulkRemoveFromOfferwall(Array.from(selectedOffers));
      queryClient.invalidateQueries({ queryKey: ['offerwall-management-offers'] });
      queryClient.invalidateQueries({ queryKey: ['offerwall-management-stats'] });
      setSelectedOffers(new Set());
      toast({ title: "Removed", description: `${selectedOffers.size} offers removed from offerwall` });
    } catch {
      toast({ title: "Error", description: "Failed to remove offers", variant: "destructive" });
    }
  };

  // Price Boost handlers
  const handleApplyBoost = async () => {
    if (selectedOffers.size === 0) return;
    try {
      const result = await offerwallManagerApi.applyPriceBoost(
        Array.from(selectedOffers), boostPercentage, boostDirection, boostDuration, boostMinutes
      );
      toast({ title: "Boost Applied", description: `${result.success_count} offers boosted (${boostDirection === 'increase' ? '+' : '-'}${boostPercentage}% for ${boostDuration}h ${boostMinutes}m)` });
      
      // Send email notification if enabled
      if (boostEmailEnabled && (boostEmailRecipients.length > 0 || boostEmailMode === 'exclude')) {
        setBoostEmailSending(true);
        try {
          const { getAuthToken } = await import('@/utils/cookies');
          const token = getAuthToken();
          
          // Determine final recipients based on mode
          let finalRecipients = boostEmailRecipients;
          if (boostEmailMode === 'exclude') {
            // Send to ALL publishers minus excluded ones minus permanent exclusions
            finalRecipients = publisherList
              .map(p => p.email)
              .filter(e => !boostEmailExcluded.includes(e) && !permanentExclusions.includes(e));
          } else if (boostEmailMode === 'include') {
            // Filter out permanently excluded from include list
            finalRecipients = boostEmailRecipients.filter(e => !permanentExclusions.includes(e));
          }
          
          if (finalRecipients.length === 0) {
            toast({ title: "No recipients", description: "All selected publishers are excluded", variant: "destructive" });
            setBoostEmailSending(false);
            setShowBoostDialog(false);
            setSelectedOffers(new Set());
            queryClient.invalidateQueries({ queryKey: ['offerwall-management-offers'] });
            loadBoostedOffers();
            return;
          }
          await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/offerwall-management/boost-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
              recipients: finalRecipients,
              subject: boostEmailSubject,
              message: boostEmailBody || `Hi,\n\nA price boost has been applied to ${selectedOffers.size} offer(s) on the offerwall:\n\n• Direction: ${boostDirection === 'increase' ? 'Increase ↑' : 'Decrease ↓'}\n• Percentage: ${boostPercentage}%\n• Duration: ${boostDuration}h${boostMinutes > 0 ? ` ${boostMinutes}m` : ''}\n\n${boostEmailMessage ? boostEmailMessage + '\n\n' : ''}— MoustacheLeads Admin`,
              boost_details: {
                offer_ids: Array.from(selectedOffers),
                percentage: boostPercentage,
                direction: boostDirection,
                duration_hours: boostDuration,
                duration_minutes: boostMinutes,
                offer_count: result.success_count
              }
            })
          });
          toast({ title: "Email Sent", description: `Notification sent to ${finalRecipients.length} recipient(s)` });
        } catch {
          toast({ title: "Email Failed", description: "Boost applied but email notification failed", variant: "destructive" });
        } finally {
          setBoostEmailSending(false);
        }
      }
      
      setShowBoostDialog(false);
      setSelectedOffers(new Set());
      queryClient.invalidateQueries({ queryKey: ['offerwall-management-offers'] });
      loadBoostedOffers();
    } catch {
      toast({ title: "Error", description: "Failed to apply boost", variant: "destructive" });
    }
  };

  const handleRemoveBoost = async (offerIds: string[]) => {
    try {
      await offerwallManagerApi.removePriceBoost(offerIds);
      toast({ title: "Boost Removed" });
      loadBoostedOffers();
      queryClient.invalidateQueries({ queryKey: ['offerwall-management-offers'] });
    } catch {
      toast({ title: "Error", description: "Failed to remove boost", variant: "destructive" });
    }
  };

  // Position handler
  const handleSetPosition = async (offerId: string, position: string) => {
    const posNum = parseInt(position);
    if (position.trim() === '' || position === '0') {
      // Remove position
      try {
        await offerwallManagerApi.removePosition([offerId]);
        setPositionInputs(prev => { const next = { ...prev }; delete next[offerId]; return next; });
        toast({ title: "Position Removed" });
      } catch {
        toast({ title: "Error", description: "Failed to remove position", variant: "destructive" });
      }
      return;
    }
    if (isNaN(posNum) || posNum < 1) return;
    try {
      await offerwallManagerApi.setPositions([{ offer_id: offerId, position: posNum }]);
      toast({ title: "Position Set", description: `Position set to ${posNum}` });
    } catch {
      toast({ title: "Error", description: "Failed to set position", variant: "destructive" });
    }
  };

  const handleToggleStarter = async (offerId: string) => {
    const isStarter = starterOfferIds.includes(offerId);
    const newIds = isStarter 
      ? starterOfferIds.filter(id => id !== offerId)
      : [...starterOfferIds, offerId];
    
    try {
      const { getAuthToken } = await import('@/utils/cookies');
      const token = getAuthToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/offerwall-management/new-user-offers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ offer_ids: newIds })
      });
      if (res.ok) {
        setStarterOfferIds(newIds);
        toast({ title: isStarter ? "Removed from starter offers" : "Added as starter offer" });
      }
    } catch (e) {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  const handleBulkStarter = async () => {
    if (selectedOffers.size === 0) return;
    const newIds = [...new Set([...starterOfferIds, ...Array.from(selectedOffers)])];
    try {
      const { getAuthToken } = await import('@/utils/cookies');
      const token = getAuthToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/offerwall-management/new-user-offers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ offer_ids: newIds })
      });
      if (res.ok) {
        setStarterOfferIds(newIds);
        toast({ title: `${selectedOffers.size} offers marked as starter` });
        setSelectedOffers(new Set());
      }
    } catch (e) {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  const allSelected = offers.length > 0 && offers.every((o: any) => selectedOffers.has(o.offer_id || o._id));

  // AI Description Refiner handlers
  const handleRefineOffer = async (offerId: string) => {
    setRefiningOfferId(offerId);
    setRefinedResult(null);
    setRefineLoading(true);
    setRefineDialogOpen(true);
    setRefineUpdateCountries(true);
    setRefineEditMode(false);
    try {
      const data = await offerwallManagerApi.refineDescription(offerId);
      setRefinedResult(data);
    } catch (e: any) {
      // Groq failed (rate limit, etc.) — load existing/raw description so admin can manually edit
      try {
        const existing = await offerwallManagerApi.getOfferDescription(offerId);
        if (existing.refined) {
          // Already has a refined description — show it in edit mode
          setRefinedResult({ refined: existing.refined, offer_name: existing.offer_name, offer_id: existing.offer_id });
          setRefineEditMode(true);
          toast({ title: "AI unavailable", description: "Showing existing refined data. You can edit manually." });
        } else {
          // No refined yet — create a skeleton from raw description for manual editing
          setRefinedResult({
            refined: {
              event_flow: '',
              summary: existing.raw_description || '',
              steps: [],
              countries: existing.countries || [],
              existing_countries: existing.countries || [],
              payout_levels: [],
              restrictions: [],
              difficulty: 'Medium',
              estimated_time: '5 min',
            },
            offer_name: existing.offer_name,
            offer_id: existing.offer_id,
          });
          setRefineEditMode(true);
          toast({ title: "AI unavailable", description: `${e.message || 'Rate limit reached'}. Raw description loaded — edit manually.` });
        }
      } catch {
        toast({ title: "Error", description: e.message || "Failed to refine description", variant: "destructive" });
        setRefineDialogOpen(false);
      }
    } finally {
      setRefineLoading(false);
    }
  };

  const handleSaveRefined = async () => {
    if (!refinedResult?.refined || !refiningOfferId) return;
    setRefineSaving(true);
    try {
      await offerwallManagerApi.saveRefinedDescription(refiningOfferId, refinedResult.refined, refineUpdateCountries);
      
      // Also save refined_name as the offer's permanent name
      if (refinedResult.refined.refined_name && refinedResult.refined.refined_name.trim() && refinedResult.refined.refined_name !== refinedResult.offer_name) {
        try {
          await offerwallManagerApi.renameOffer(refiningOfferId, refinedResult.refined.refined_name.trim(), refinedResult.offer_name);
        } catch {
          // Name rename failed but description saved OK — don't block
        }
      }
      
      toast({ title: "Saved!", description: "Refined description saved successfully" });
      setRefineDialogOpen(false);
      setRefinedResult(null);
      setRefineEditMode(false);
      queryClient.invalidateQueries({ queryKey: ['offerwall-management-offers'] });
    } catch {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    } finally {
      setRefineSaving(false);
    }
  };

  const handleRemoveRefined = async () => {
    if (!refiningOfferId) return;
    setRefineSaving(true);
    try {
      await offerwallManagerApi.removeRefinedDescription(refiningOfferId);
      toast({ title: "Removed", description: "Refined description removed from this offer" });
      setRefineDialogOpen(false);
      setRefinedResult(null);
      setRefineEditMode(false);
      queryClient.invalidateQueries({ queryKey: ['offerwall-management-offers'] });
    } catch {
      toast({ title: "Error", description: "Failed to remove", variant: "destructive" });
    } finally {
      setRefineSaving(false);
    }
  };

  const handleRefineFieldChange = (field: string, value: any) => {
    if (!refinedResult) return;
    setRefinedResult((prev: any) => ({
      ...prev,
      refined: { ...prev.refined, [field]: value }
    }));
  };

  const handleForceHide = async () => {
    const id = forceHideId.trim();
    if (!id) return;
    setForceHiding(true);
    try {
      const result = await offerwallManagerApi.hideOfferById(id);
      toast({ title: "Hidden!", description: `"${result.offer_name || id}" removed from offerwall` });
      setForceHideId('');
      queryClient.invalidateQueries({ queryKey: ['offerwall-management-offers'] });
      queryClient.invalidateQueries({ queryKey: ['offerwall-management-stats'] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to hide offer", variant: "destructive" });
    } finally {
      setForceHiding(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Offerwall Manager</h1>
          <p className="text-muted-foreground">Control how offers appear on the offerwall</p>
        </div>
      </div>

      {/* Stats Boxes */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Active</p>
                <p className="text-2xl font-bold">{stats?.total_active ?? '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Eye className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Visible</p>
                <p className="text-2xl font-bold">{stats?.total_visible ?? '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Pin className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Pinned</p>
                <p className="text-2xl font-bold">{stats?.pinned_count ?? '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Featured</p>
                <p className="text-2xl font-bold">{stats?.featured_count ?? '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="preview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="offers">Offer Controls</TabsTrigger>
          <TabsTrigger value="starter">Starter Offers ({starterOfferIds.length})</TabsTrigger>
          <TabsTrigger value="qualification">Qualification Survey</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          <TabsTrigger value="tracking">Tracking</TabsTrigger>
        </TabsList>

        {/* Preview Tab */}
        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Live Offerwall Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden" style={{ height: '600px' }}>
                <iframe
                  src="https://offerwall.moustacheleads.com/offerwall?placement_id=LFKO1rpd2uoQ78r6&user_id=test_user&api_key=iK66hQRakcvRVj08CX7qfqNzE1Zqt0uF"
                  className="w-full h-full border-0"
                  title="Offerwall Preview"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Offer Controls Tab */}
        <TabsContent value="offers">
          <Card>
            <CardHeader>
              <CardTitle>Offer Controls</CardTitle>
              <p className="text-sm text-muted-foreground">
                Showing offers currently live in the offerwall — active, healthy, and visible to users ({pagination.total} total)
              </p>              <div className="mt-2 flex items-center gap-3 flex-wrap">
                <Input
                  placeholder="Search offers..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setOfferwallPage(1); }}
                  className="max-w-sm"
                />
                <Button
                  variant={showBoostedOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setShowBoostedOnly(!showBoostedOnly); setShowFeaturedOnly(false); }}
                  className={showBoostedOnly ? "bg-orange-600 hover:bg-orange-700" : ""}
                >
                  <Flame className="h-4 w-4 mr-1" />
                  Show Boosted ({boostedOffers.length})
                </Button>
                <Button
                  variant={showFeaturedOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setShowFeaturedOnly(!showFeaturedOnly); setShowBoostedOnly(false); }}
                  className={showFeaturedOnly ? "bg-yellow-500 hover:bg-yellow-600 text-white" : ""}
                >
                  <Star className="h-4 w-4 mr-1" />
                  Show Featured ({(settings?.featured_offers || []).length})
                </Button>
                <Button
                  variant={refinedFilter === 'yes' ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setRefinedFilter(refinedFilter === 'yes' ? '' : 'yes'); setOfferwallPage(1); }}
                  className={refinedFilter === 'yes' ? "bg-purple-600 hover:bg-purple-700" : ""}
                >
                  <Wand2 className="h-4 w-4 mr-1" />
                  AI Refined
                </Button>
                <Button
                  variant={refinedFilter === 'no' ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setRefinedFilter(refinedFilter === 'no' ? '' : 'no'); setOfferwallPage(1); }}
                  className={refinedFilter === 'no' ? "bg-gray-600 hover:bg-gray-700" : ""}
                >
                  Not Refined
                </Button>
              </div>
              {/* Force-hide by offer ID */}
              <div className="mt-2 flex items-center gap-2">
                <Input
                  placeholder="Force-hide by offer ID (e.g. ML-2645036)..."
                  value={forceHideId}
                  onChange={(e) => setForceHideId(e.target.value)}
                  className="max-w-xs text-xs"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleForceHide(); }}
                />
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleForceHide}
                  disabled={!forceHideId.trim() || forceHiding}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  {forceHiding ? 'Hiding...' : 'Force Hide'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {offersLoading ? (
                <p className="text-muted-foreground">Loading offers...</p>
              ) : (
                <OfferwallOfferEditor
                  offers={showBoostedOnly ? boostedOffers : showFeaturedOnly ? offers.filter((o: any) => (settings?.featured_offers || []).includes(o.offer_id)) : offers}
                  settings={settings}
                  starterOfferIds={starterOfferIds}
                  boostedOffers={boostedOffers}
                  positionInputs={positionInputs}
                  selectedOffers={selectedOffers}
                  pagination={pagination}
                  onSelectOffer={handleSelectOffer}
                  onSelectAll={handleSelectAll}
                  onSelectAllResults={handleSelectAllResults}
                  selectingAllResults={selectingAllResults}
                  preloadedOffers={preloadedOffers}
                  onTogglePin={handleTogglePin}
                  onToggleVisibility={handleToggleVisibility}
                  onToggleFeatured={handleToggleFeatured}
                  onToggleStarter={handleToggleStarter}
                  onSetPosition={handleSetPosition}
                  setPositionInputs={setPositionInputs}
                  onPageChange={(page) => { setOfferwallPage(page); }}
                  onFiltersChange={(filters) => { setBackendFilters(filters); setOfferwallPage(1); }}
                  onBoost={() => setShowBoostDialog(true)}
                  onRemoveBoost={handleRemoveBoost}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Starter Offers Tab */}
        <TabsContent value="starter">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                Starter Offers (New User Offers)
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                These offers are shown to new users who haven't completed the qualification survey yet.
                They bypass all filters (health check, status, visibility) and always appear in the offerwall.
              </p>
            </CardHeader>
            <CardContent>
              {starterOfferIds.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Star className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                  <p>No starter offers configured</p>
                  <p className="text-xs mt-1">Go to "Offer Controls" tab and mark offers as starter using the ⭐ button</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium">{starterOfferIds.length} starter offer(s) configured</span>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={async () => {
                        if (!confirm('Remove ALL starter offers? New users will see no offers until you add new ones.')) return;
                        try {
                          const { getAuthToken } = await import('@/utils/cookies');
                          const token = getAuthToken();
                          const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/offerwall-management/new-user-offers`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ offer_ids: [] })
                          });
                          if (res.ok) {
                            setStarterOfferIds([]);
                            toast({ title: "All starter offers removed" });
                          }
                        } catch (e) {
                          toast({ title: "Failed to clear", variant: "destructive" });
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear All
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Offer ID</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {starterOfferIds.map((offerId) => (
                        <TableRow key={offerId}>
                          <TableCell>
                            <span className="font-mono text-sm">{offerId}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700"
                              onClick={() => handleToggleStarter(offerId)}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Qualification Survey Tab */}
        <TabsContent value="qualification">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-purple-500" />
                Qualification Survey Settings
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure how the qualification survey appears on the offerwall (title, points, image).
                This is the survey new users must complete before seeing all offers.
              </p>
            </CardHeader>
            <CardContent>
              {!qualSurveySettings ? (
                <p className="text-muted-foreground text-center py-8">No qualification survey found. Create one in Survey Builder first.</p>
              ) : (
                <div className="space-y-4 max-w-lg">
                  <div>
                    <Label>Display Title (shown on offer card)</Label>
                    <Input
                      value={qualSurveySettings.display_title}
                      onChange={(e) => setQualSurveySettings({ ...qualSurveySettings, display_title: e.target.value })}
                      placeholder="Qualification Survey"
                    />
                  </div>
                  <div>
                    <Label>Display Description</Label>
                    <Input
                      value={qualSurveySettings.display_description}
                      onChange={(e) => setQualSurveySettings({ ...qualSurveySettings, display_description: e.target.value })}
                      placeholder="Complete this survey to unlock all offers"
                    />
                  </div>
                  <div>
                    <Label>Points (reward shown to user)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={qualSurveySettings.points}
                      onChange={(e) => setQualSurveySettings({ ...qualSurveySettings, points: Number(e.target.value) })}
                      placeholder="6"
                    />
                  </div>
                  <div>
                    <Label>Image URL (optional — shown on offer card)</Label>
                    <Input
                      value={qualSurveySettings.display_image_url}
                      onChange={(e) => setQualSurveySettings({ ...qualSurveySettings, display_image_url: e.target.value })}
                      placeholder="https://example.com/survey-image.jpg"
                    />
                    {qualSurveySettings.display_image_url && (
                      <img src={qualSurveySettings.display_image_url} alt="Preview" className="mt-2 h-16 w-auto rounded border object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
                    )}
                  </div>
                  <div>
                    <Label>Survey Template</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                      {TEMPLATE_OPTIONS.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setQualSurveySettings({ ...qualSurveySettings, template: t.id })}
                          className={`text-left p-3 rounded-lg border-2 transition-all hover:scale-[1.02] ${
                            qualSurveySettings.template === t.id
                              ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="text-xl mb-1">{t.icon}</div>
                          <p className="font-semibold text-xs text-gray-900">{t.name}</p>
                          {qualSurveySettings.template === t.id && <p className="text-[10px] text-blue-600 font-semibold mt-0.5">✓ Active</p>}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button
                    disabled={qualSaving}
                    onClick={async () => {
                      setQualSaving(true);
                      try {
                        const { getAuthToken } = await import('@/utils/cookies');
                        const token = getAuthToken();
                        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/surveys/qualification/settings`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                          body: JSON.stringify(qualSurveySettings)
                        });
                        if (res.ok) {
                          toast({ title: "Saved", description: "Qualification survey settings updated." });
                        } else {
                          toast({ title: "Error", description: "Failed to save.", variant: "destructive" });
                        }
                      } catch {
                        toast({ title: "Error", description: "Failed to save.", variant: "destructive" });
                      } finally {
                        setQualSaving(false);
                      }
                    }}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {qualSaving ? 'Saving...' : 'Save Settings'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layout className="h-5 w-5" />
                Theme & Display Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Primary Color */}
              <div className="space-y-2">
                <Label>Primary Color (Buttons & Accents)</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={theme.primary_color}
                    onChange={(e) => setLocalTheme({ ...theme, primary_color: e.target.value })}
                    className="w-10 h-10 rounded border cursor-pointer"
                  />
                  <Input
                    value={theme.primary_color}
                    onChange={(e) => setLocalTheme({ ...theme, primary_color: e.target.value })}
                    className="max-w-[150px]"
                  />
                </div>
              </div>

              {/* Background Color */}
              <div className="space-y-2">
                <Label>Background Color</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={(theme as any).background_color || '#0f172a'}
                    onChange={(e) => setLocalTheme({ ...theme, background_color: e.target.value } as any)}
                    className="w-10 h-10 rounded border cursor-pointer"
                  />
                  <Input
                    value={(theme as any).background_color || '#0f172a'}
                    onChange={(e) => setLocalTheme({ ...theme, background_color: e.target.value } as any)}
                    className="max-w-[150px]"
                  />
                  <span className="text-xs text-muted-foreground">Default: #0f172a (dark navy)</span>
                </div>
              </div>

              {/* Layout */}
              <div className="space-y-2">
                <Label>Layout</Label>
                <Select
                  value={theme.layout}
                  onValueChange={(val: 'grid' | 'list' | 'table') => setLocalTheme({ ...theme, layout: val })}
                >
                  <SelectTrigger className="max-w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grid">Grid (Cards)</SelectItem>
                    <SelectItem value="list">List (Vertical)</SelectItem>
                    <SelectItem value="table">Table (Rows)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Cards per row */}
              <div className="space-y-2">
                <Label>Cards Per Row (Grid)</Label>
                <Select
                  value={String(theme.cards_per_row)}
                  onValueChange={(val) => setLocalTheme({ ...theme, cards_per_row: Number(val) })}
                >
                  <SelectTrigger className="max-w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Show Categories */}
              <div className="flex items-center justify-between max-w-sm">
                <Label>Show Categories</Label>
                <Switch
                  checked={theme.show_categories}
                  onCheckedChange={(val) => setLocalTheme({ ...theme, show_categories: val })}
                />
              </div>

              {/* Show Search */}
              <div className="flex items-center justify-between max-w-sm">
                <Label>Show Search Bar</Label>
                <Switch
                  checked={theme.show_search}
                  onCheckedChange={(val) => setLocalTheme({ ...theme, show_search: val })}
                />
              </div>

              <Button onClick={handleSaveTheme} disabled={updateSettingsMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Announcements Tab */}
        <TabsContent value="announcements">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Announcements</CardTitle>
                <Button onClick={() => setShowAnnouncementDialog(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Announcement
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {(!settings?.announcements || settings.announcements.length === 0) ? (
                <p className="text-muted-foreground text-center py-8">No announcements yet</p>
              ) : (
                <div className="space-y-3">
                  {settings.announcements.map((ann) => (
                    <div key={ann.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={ann.active}
                          onCheckedChange={() => handleToggleAnnouncement(ann.id)}
                        />
                        <span className={ann.active ? '' : 'text-muted-foreground line-through'}>
                          {ann.text}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveAnnouncement(ann.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add Announcement Dialog */}
          <Dialog open={showAnnouncementDialog} onOpenChange={setShowAnnouncementDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Announcement</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Announcement Text</Label>
                  <Input
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    placeholder="e.g. New surveys available!"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowAnnouncementDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddAnnouncement} disabled={!announcementText.trim()}>
                    Add
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ===== TRACKING TAB ===== */}
        <TrackingTab />

      </Tabs>

      {/* ===== PRICE BOOST DIALOG ===== */}
      <Dialog open={showBoostDialog} onOpenChange={setShowBoostDialog}>
        <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              Apply Price Boost ({selectedOffers.size} offers)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Direction</Label>
              <div className="flex gap-2">
                <Button
                  variant={boostDirection === 'increase' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBoostDirection('increase')}
                  className={boostDirection === 'increase' ? 'bg-green-600 hover:bg-green-700' : ''}
                >
                  <TrendingUp className="h-4 w-4 mr-1" />
                  Increase
                </Button>
                <Button
                  variant={boostDirection === 'decrease' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBoostDirection('decrease')}
                  className={boostDirection === 'decrease' ? 'bg-red-600 hover:bg-red-700' : ''}
                >
                  <TrendingDown className="h-4 w-4 mr-1" />
                  Decrease
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Percentage ({boostDirection === 'increase' ? '+' : '-'}{boostPercentage}%)</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={boostPercentage}
                  onChange={(e) => setBoostPercentage(Number(e.target.value))}
                  className="w-24"
                />
                <div className="flex gap-1">
                  {[5, 10, 15, 20, 25].map(p => (
                    <Button key={p} size="sm" variant={boostPercentage === p ? 'default' : 'outline'}
                      onClick={() => setBoostPercentage(p)} className="text-xs px-2">
                      {p}%
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Duration</Label>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    max={8760}
                    value={boostDuration}
                    onChange={(e) => setBoostDuration(Number(e.target.value))}
                    className="w-20"
                  />
                  <span className="text-xs text-muted-foreground">hrs</span>
                </div>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    max={59}
                    value={boostMinutes}
                    onChange={(e) => setBoostMinutes(Number(e.target.value))}
                    className="w-20"
                  />
                  <span className="text-xs text-muted-foreground">min</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {[
                  { label: '30m', h: 0, m: 30 },
                  { label: '1h', h: 1, m: 0 },
                  { label: '6h', h: 6, m: 0 },
                  { label: '12h', h: 12, m: 0 },
                  { label: '24h', h: 24, m: 0 },
                  { label: '2d', h: 48, m: 0 },
                  { label: '3d', h: 72, m: 0 },
                  { label: '5d', h: 120, m: 0 },
                  { label: '1w', h: 168, m: 0 },
                  { label: '2w', h: 336, m: 0 },
                  { label: '30d', h: 720, m: 0 },
                ].map(p => (
                  <Button key={p.label} size="sm" variant={boostDuration === p.h && boostMinutes === p.m ? 'default' : 'outline'}
                    onClick={() => { setBoostDuration(p.h); setBoostMinutes(p.m); }} className="text-xs px-2">
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="bg-muted rounded-lg p-3 text-sm">
              <p className="font-medium">Summary:</p>
              <p className="text-muted-foreground">
                {boostDirection === 'increase' ? 'Boost' : 'Reduce'} publisher payout by {boostPercentage}% for {
                  boostDuration >= 168 ? `${Math.floor(boostDuration / 168)}w${boostDuration % 168 > 0 ? ` ${Math.floor((boostDuration % 168) / 24)}d` : ''}` :
                  boostDuration >= 24 ? `${Math.floor(boostDuration / 24)}d${boostDuration % 24 > 0 ? ` ${boostDuration % 24}h` : ''}` :
                  boostDuration > 0 ? `${boostDuration}h` : ''
                }{boostMinutes > 0 ? ` ${boostMinutes}m` : ''} on {selectedOffers.size} offer(s).
                The boost will expire automatically and price will revert to default 80%.
              </p>
            </div>

            {/* Email Notification Toggle */}
            <div className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-600" />
                  <Label className="text-sm font-medium">Send Email Notification</Label>
                </div>
                <Switch checked={boostEmailEnabled} onCheckedChange={(val) => {
                  setBoostEmailEnabled(val);
                  if (val && publisherList.length === 0) loadPublishers();
                }} />
              </div>

              {boostEmailEnabled && (
                <div className="space-y-3 pt-2 border-t">
                  {/* Mode tabs: Include / Exclude / Permanent Exclude */}
                  <div className="flex gap-1 p-0.5 bg-gray-100 rounded-lg">
                    <button type="button" onClick={() => setBoostEmailMode('include')}
                      className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-colors ${boostEmailMode === 'include' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
                      ✓ Include
                    </button>
                    <button type="button" onClick={() => setBoostEmailMode('exclude')}
                      className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-colors ${boostEmailMode === 'exclude' ? 'bg-red-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
                      ✗ Exclude
                    </button>
                    <button type="button" onClick={() => { setBoostEmailMode('permanent'); loadPermanentExclusions(); }}
                      className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-colors ${boostEmailMode === 'permanent' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
                      🚫 Permanent
                    </button>
                  </div>

                  {/* Mode description */}
                  <p className="text-[10px] text-gray-400 italic">
                    {boostEmailMode === 'include' && 'Select specific publishers to receive the email'}
                    {boostEmailMode === 'exclude' && 'Send to ALL publishers EXCEPT the ones you select below'}
                    {boostEmailMode === 'permanent' && 'These publishers will NEVER receive any boost/offer emails'}
                  </p>

                  {/* Publisher search + list */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      {boostEmailMode === 'include' ? 'Select Publishers to Include' : boostEmailMode === 'exclude' ? 'Select Publishers to Exclude' : 'Permanently Excluded Publishers'}
                    </Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <Input
                        value={publisherSearch}
                        onChange={e => {
                          setPublisherSearch(e.target.value);
                          loadPublishers(e.target.value);
                        }}
                        placeholder="Search publishers by name or email..."
                        className="h-8 text-xs pl-8"
                      />
                    </div>

                    {/* Select All / Deselect All */}
                    {boostEmailMode !== 'permanent' && (
                      <div className="flex gap-2">
                        <button type="button" onClick={() => {
                          const emails = publisherList.map(p => p.email);
                          if (boostEmailMode === 'include') setBoostEmailRecipients(prev => [...new Set([...prev, ...emails])]);
                          else setBoostEmailExcluded(prev => [...new Set([...prev, ...emails])]);
                        }} className="text-[10px] font-medium text-blue-600 hover:text-blue-800">Select All</button>
                        <button type="button" onClick={() => {
                          if (boostEmailMode === 'include') setBoostEmailRecipients([]);
                          else setBoostEmailExcluded([]);
                        }} className="text-[10px] font-medium text-gray-500 hover:text-gray-700">Deselect All</button>
                      </div>
                    )}

                    {/* Publisher list with checkboxes */}
                    <div className="border rounded-md max-h-36 overflow-y-auto bg-white">
                      {publisherListLoading ? (
                        <div className="flex items-center justify-center py-3">
                          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                          <span className="text-xs text-gray-400 ml-2">Loading...</span>
                        </div>
                      ) : publisherList.length === 0 ? (
                        <div className="text-center py-3 text-xs text-gray-400">No publishers found</div>
                      ) : (
                        publisherList.map(pub => {
                          const isIncluded = boostEmailRecipients.includes(pub.email);
                          const isExcluded = boostEmailExcluded.includes(pub.email);
                          const isPermanent = permanentExclusions.includes(pub.email);
                          const isChecked = boostEmailMode === 'include' ? isIncluded : boostEmailMode === 'exclude' ? isExcluded : isPermanent;

                          return (
                            <div
                              key={pub.email}
                              className={`flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 ${isPermanent && boostEmailMode !== 'permanent' ? 'opacity-40' : ''}`}
                              onClick={() => {
                                if (boostEmailMode === 'include') {
                                  if (isPermanent) return; // Can't include permanently excluded
                                  setBoostEmailRecipients(prev => isIncluded ? prev.filter(e => e !== pub.email) : [...prev, pub.email]);
                                } else if (boostEmailMode === 'exclude') {
                                  setBoostEmailExcluded(prev => isExcluded ? prev.filter(e => e !== pub.email) : [...prev, pub.email]);
                                } else {
                                  // Permanent mode — toggle
                                  if (isPermanent) {
                                    // Remove from permanent (handled via API on save)
                                    setPermanentExclusions(prev => prev.filter(e => e !== pub.email));
                                  } else {
                                    addToPermanentExclusion([pub.email]);
                                  }
                                }
                              }}
                            >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                isChecked ? (boostEmailMode === 'permanent' ? 'bg-gray-800 border-gray-800' : boostEmailMode === 'exclude' ? 'bg-red-600 border-red-600' : 'bg-green-600 border-green-600') : 'border-gray-300'
                              }`}>
                                {isChecked && <span className="text-white text-[9px] font-bold">✓</span>}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-gray-800 truncate">{pub.name || pub.email}</p>
                                <p className="text-[10px] text-gray-400 truncate">{pub.email}</p>
                              </div>
                              {isPermanent && boostEmailMode !== 'permanent' && (
                                <span className="text-[9px] text-red-500 font-medium flex-shrink-0">🚫 Excluded</span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Manual email input */}
                  {boostEmailMode === 'include' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Or add email manually</Label>
                      <div className="flex gap-1.5">
                        <Input
                          value={boostEmailInput}
                          onChange={e => setBoostEmailInput(e.target.value)}
                          placeholder="Enter email address..."
                          className="h-8 text-xs"
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const email = boostEmailInput.trim();
                              if (email && email.includes('@') && !boostEmailRecipients.includes(email)) {
                                setBoostEmailRecipients([...boostEmailRecipients, email]);
                                setBoostEmailInput('');
                              }
                            }
                          }}
                        />
                        <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => {
                          const email = boostEmailInput.trim();
                          if (email && email.includes('@') && !boostEmailRecipients.includes(email)) {
                            setBoostEmailRecipients([...boostEmailRecipients, email]);
                            setBoostEmailInput('');
                          }
                        }}>
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Selected recipients / excluded summary */}
                  {boostEmailMode === 'include' && boostEmailRecipients.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-green-700">✓ {boostEmailRecipients.length} recipient(s) selected</Label>
                      <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                        {boostEmailRecipients.map(email => (
                          <span key={email} className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 border border-green-200 rounded-full text-xs text-green-700">
                            {email}
                            <button onClick={() => setBoostEmailRecipients(boostEmailRecipients.filter(e => e !== email))} className="text-green-400 hover:text-red-500">
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {boostEmailMode === 'exclude' && boostEmailExcluded.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-red-600">✗ {boostEmailExcluded.length} publisher(s) excluded — mail goes to everyone else</Label>
                    </div>
                  )}
                  {boostEmailMode === 'permanent' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-500">🚫 {permanentExclusions.length} permanently excluded — these never receive boost/offer emails</Label>
                    </div>
                  )}

                  {/* Subject */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Subject</Label>
                    <Input
                      value={boostEmailSubject}
                      onChange={e => setBoostEmailSubject(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>

                  {/* Editable Email Body */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Email Body (fully editable)</Label>
                    <textarea
                      value={boostEmailBody || `Hi,\n\nA price boost has been applied to ${selectedOffers.size} offer(s) on the offerwall:\n\n• Direction: ${boostDirection === 'increase' ? 'Increase ↑' : 'Decrease ↓'}\n• Percentage: ${boostPercentage}%\n• Duration: ${boostDuration}h${boostMinutes > 0 ? ` ${boostMinutes}m` : ''}\n\n${boostEmailMessage ? boostEmailMessage + '\n\n' : ''}— MoustacheLeads Admin`}
                      onChange={e => setBoostEmailBody(e.target.value)}
                      className="w-full h-40 px-3 py-2 border border-gray-200 rounded-md text-xs resize-y focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
                    />
                    <p className="text-[10px] text-gray-400">Edit the email content above. This is exactly what recipients will see.</p>
                  </div>

                  {/* Preview Toggle */}
                  <button
                    type="button"
                    onClick={() => setBoostEmailPreview(!boostEmailPreview)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                  >
                    <Eye className="h-3 w-3" />
                    {boostEmailPreview ? 'Hide Preview' : 'Show Formatted Preview'}
                  </button>

                  {boostEmailPreview && (
                    <div className="border rounded-lg p-4 bg-white text-xs space-y-2 max-h-56 overflow-y-auto shadow-inner">
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="font-semibold text-gray-800">📧 Email Preview</span>
                        <span className="text-[10px] text-gray-400">{boostEmailRecipients.length} recipient(s)</span>
                      </div>
                      <div className="border-b pb-2">
                        <span className="text-gray-500">To:</span> {boostEmailRecipients.join(', ') || 'No recipients added'}
                      </div>
                      <div className="border-b pb-2">
                        <span className="text-gray-500">Subject:</span> {boostEmailSubject}
                      </div>
                      <div className="text-gray-700 whitespace-pre-wrap pt-2">
                        {boostEmailBody || `Hi,\n\nA price boost has been applied to ${selectedOffers.size} offer(s) on the offerwall:\n\n• Direction: ${boostDirection === 'increase' ? 'Increase ↑' : 'Decrease ↓'}\n• Percentage: ${boostPercentage}%\n• Duration: ${boostDuration}h${boostMinutes > 0 ? ` ${boostMinutes}m` : ''}\n\n${boostEmailMessage ? boostEmailMessage + '\n\n' : ''}— MoustacheLeads Admin`}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowBoostDialog(false)}>Cancel</Button>
              <Button onClick={handleApplyBoost} disabled={boostEmailSending} className="bg-orange-600 hover:bg-orange-700">
                <Flame className="h-4 w-4 mr-2" />
                {boostEmailSending ? 'Sending...' : 'Apply Boost'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== AI DESCRIPTION REFINE DIALOG ===== */}
      <Dialog open={refineDialogOpen} onOpenChange={(open) => { if (!open) { setRefineDialogOpen(false); setRefinedResult(null); setRefineEditMode(false); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-purple-500" />
              AI Description Refiner
            </DialogTitle>
          </DialogHeader>

          {refineLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              <p className="text-sm text-muted-foreground">Analyzing description with AI...</p>
            </div>
          )}

          {refinedResult?.refined && !refineLoading && (
            <div className="space-y-4">
              {/* Offer Name + Edit/Remove buttons */}
              <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Offer</p>
                  <p className="font-semibold">{refinedResult.offer_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={refineEditMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setRefineEditMode(!refineEditMode)}
                    className={refineEditMode ? "bg-purple-600 hover:bg-purple-700" : ""}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    {refineEditMode ? "Editing" : "Edit"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleRemoveRefined}
                    disabled={refineSaving}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>

              {/* Refined Name */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-xs text-green-600 font-medium mb-1">✏️ Refined Name (suggested)</p>
                {refineEditMode ? (
                  <Input
                    value={refinedResult.refined.refined_name || ''}
                    onChange={(e) => handleRefineFieldChange('refined_name', e.target.value)}
                    className="text-sm font-medium"
                    placeholder="Cleaner offer name"
                    maxLength={80}
                  />
                ) : (
                  <p className="text-sm font-medium text-green-900">{refinedResult.refined.refined_name || '—'}</p>
                )}
                <p className="text-[10px] text-green-500 mt-1">Original: {refinedResult.offer_name}</p>
              </div>

              {/* Event Flow - Subtitle Preview */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <p className="text-xs text-purple-600 font-medium mb-1">✨ Event Flow (shows as subtitle)</p>
                {refineEditMode ? (
                  <Input
                    value={refinedResult.refined.event_flow || ''}
                    onChange={(e) => handleRefineFieldChange('event_flow', e.target.value)}
                    className="text-sm font-medium"
                    placeholder="e.g. Register → Deposit → Trade"
                    maxLength={60}
                  />
                ) : (
                  <p className="text-sm font-medium text-purple-900">{refinedResult.refined.event_flow || '—'}</p>
                )}
              </div>

              {/* Summary */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Summary</p>
                {refineEditMode ? (
                  <textarea
                    value={refinedResult.refined.summary || ''}
                    onChange={(e) => handleRefineFieldChange('summary', e.target.value)}
                    className="w-full text-sm border rounded-md p-2 resize-none"
                    rows={3}
                  />
                ) : (
                  <p className="text-sm">{refinedResult.refined.summary}</p>
                )}
              </div>

              {/* Conversion Events */}
              {(refinedResult.refined.steps?.length > 0 || refineEditMode) && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Conversion Events</p>
                  {refineEditMode ? (
                    <div className="space-y-2">
                      {(refinedResult.refined.steps || []).map((step: string, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                          <Input
                            value={step}
                            onChange={(e) => {
                              const newSteps = [...(refinedResult.refined.steps || [])];
                              newSteps[i] = e.target.value;
                              handleRefineFieldChange('steps', newSteps);
                            }}
                            className="text-sm flex-1"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-700"
                            onClick={() => {
                              const newSteps = (refinedResult.refined.steps || []).filter((_: any, idx: number) => idx !== i);
                              handleRefineFieldChange('steps', newSteps);
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRefineFieldChange('steps', [...(refinedResult.refined.steps || []), ''])}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Event
                      </Button>
                    </div>
                  ) : (
                    <ol className="list-decimal list-inside space-y-1">
                      {refinedResult.refined.steps.map((step: string, i: number) => (
                        <li key={i} className="text-sm text-gray-700">{step}</li>
                      ))}
                    </ol>
                  )}
                </div>
              )}

              {/* Countries Extracted */}
              {(refinedResult.refined.allowed_countries?.length > 0 || refinedResult.refined.countries?.length > 0) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-blue-600 font-medium flex items-center gap-1">
                      <Globe className="h-3.5 w-3.5" />
                      Allowed Countries
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {(refinedResult.refined.allowed_countries || refinedResult.refined.countries || []).map((c: string) => (
                      <span key={c} className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">{c}</span>
                    ))}
                  </div>
                  {refinedResult.refined.existing_countries?.length > 0 && (
                    <p className="text-[10px] text-blue-500">
                      Current countries in system: {refinedResult.refined.existing_countries.join(', ')}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Checkbox
                      id="update-countries"
                      checked={refineUpdateCountries}
                      onCheckedChange={(checked) => setRefineUpdateCountries(!!checked)}
                    />
                    <Label htmlFor="update-countries" className="text-xs cursor-pointer">
                      Save extracted countries to this offer
                    </Label>
                  </div>
                </div>
              )}

              {/* Restricted Areas */}
              {(refinedResult.refined.restricted_areas?.length > 0 || refineEditMode) && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs text-red-600 font-medium mb-1 flex items-center gap-1">
                    🚫 Excluded Regions / States
                  </p>
                  {refineEditMode ? (
                    <div className="space-y-2">
                      {(refinedResult.refined.restricted_areas || []).map((r: string, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                          <Input
                            value={r}
                            onChange={(e) => {
                              const newR = [...(refinedResult.refined.restricted_areas || [])];
                              newR[i] = e.target.value;
                              handleRefineFieldChange('restricted_areas', newR);
                            }}
                            className="text-sm flex-1"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-700"
                            onClick={() => {
                              const newR = (refinedResult.refined.restricted_areas || []).filter((_: any, idx: number) => idx !== i);
                              handleRefineFieldChange('restricted_areas', newR);
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRefineFieldChange('restricted_areas', [...(refinedResult.refined.restricted_areas || []), ''])}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Region
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {(refinedResult.refined.restricted_areas || []).map((r: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full border border-red-200">✗ {r}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Cities */}
              {(refinedResult.refined.cities?.length > 0 || refineEditMode) && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <p className="text-xs text-purple-600 font-medium mb-1 flex items-center gap-1">
                    📍 Target Cities
                  </p>
                  {refineEditMode ? (
                    <div className="space-y-2">
                      {(refinedResult.refined.cities || []).map((c: string, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                          <Input
                            value={c}
                            onChange={(e) => {
                              const newC = [...(refinedResult.refined.cities || [])];
                              newC[i] = e.target.value;
                              handleRefineFieldChange('cities', newC);
                            }}
                            className="text-sm flex-1"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-700"
                            onClick={() => {
                              const newC = (refinedResult.refined.cities || []).filter((_: any, idx: number) => idx !== i);
                              handleRefineFieldChange('cities', newC);
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRefineFieldChange('cities', [...(refinedResult.refined.cities || []), ''])}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add City
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {(refinedResult.refined.cities || []).map((c: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full border border-purple-200">📍 {c}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Approval Period */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">⏱️ Approval Period</p>
                {refineEditMode ? (
                  <Input
                    value={refinedResult.refined.approval_period || ''}
                    onChange={(e) => handleRefineFieldChange('approval_period', e.target.value)}
                    className="text-sm"
                    placeholder="e.g. Monthly, by DAY 15 of next month"
                  />
                ) : (
                  <p className="text-sm">{refinedResult.refined.approval_period || '—'}</p>
                )}
              </div>

              {/* Deposit Requirement */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">💰 Deposit Requirement</p>
                {refineEditMode ? (
                  <Input
                    value={refinedResult.refined.deposit_requirement || ''}
                    onChange={(e) => handleRefineFieldChange('deposit_requirement', e.target.value)}
                    className="text-sm"
                    placeholder="e.g. $10 minimum deposit required"
                  />
                ) : (
                  <p className="text-sm">{refinedResult.refined.deposit_requirement || '—'}</p>
                )}
              </div>

              {/* Restrictions */}
              {(refinedResult.refined.restrictions?.length > 0 || refineEditMode) && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Restrictions</p>
                  {refineEditMode ? (
                    <div className="space-y-2">
                      {(refinedResult.refined.restrictions || []).map((r: string, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                          <Input
                            value={r}
                            onChange={(e) => {
                              const newR = [...(refinedResult.refined.restrictions || [])];
                              newR[i] = e.target.value;
                              handleRefineFieldChange('restrictions', newR);
                            }}
                            className="text-sm flex-1"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-700"
                            onClick={() => {
                              const newR = (refinedResult.refined.restrictions || []).filter((_: any, idx: number) => idx !== i);
                              handleRefineFieldChange('restrictions', newR);
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRefineFieldChange('restrictions', [...(refinedResult.refined.restrictions || []), ''])}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Restriction
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {refinedResult.refined.restrictions.map((r: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded-full border border-red-200">{r}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Difficulty + Time */}
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Difficulty</p>
                  {refineEditMode ? (
                    <select
                      value={refinedResult.refined.difficulty || 'Medium'}
                      onChange={(e) => handleRefineFieldChange('difficulty', e.target.value)}
                      className="text-sm border rounded-md px-2 py-1"
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  ) : (
                    <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                      refinedResult.refined.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
                      refinedResult.refined.difficulty === 'Hard' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>{refinedResult.refined.difficulty}</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Est. Time</p>
                  {refineEditMode ? (
                    <Input
                      value={refinedResult.refined.estimated_time || ''}
                      onChange={(e) => handleRefineFieldChange('estimated_time', e.target.value)}
                      className="text-sm w-24"
                      placeholder="5 min"
                    />
                  ) : (
                    <span className="text-sm font-medium">{refinedResult.refined.estimated_time}</span>
                  )}
                </div>
              </div>

              {/* Payout Levels */}
              {refinedResult.refined.payout_levels?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Payout Levels</p>
                  <div className="space-y-1">
                    {refinedResult.refined.payout_levels.map((lvl: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-sm bg-muted/50 px-3 py-1.5 rounded">
                        <span>{lvl.event}</span>
                        <span className="font-medium text-green-700">{lvl.payout}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview Card */}
              <div className="border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">📱 Offerwall Card Preview</p>
                <div className="border rounded-xl p-4 bg-white shadow-sm max-w-xs">
                  <h3 className="font-bold text-gray-900 text-sm leading-snug">{refinedResult.refined.refined_name || refinedResult.offer_name}</h3>
                  {refinedResult.refined.event_flow && (
                    <p className="text-xs text-purple-600 mt-0.5 font-medium">{refinedResult.refined.event_flow}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{refinedResult.refined.summary}</p>
                  {refinedResult.refined.deposit_requirement && (
                    <p className="text-[10px] text-blue-600 mt-1 font-medium">💰 {refinedResult.refined.deposit_requirement}</p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" onClick={() => { setRefineDialogOpen(false); setRefinedResult(null); setRefineEditMode(false); }}>
                  Cancel
                </Button>
                <Button onClick={handleSaveRefined} disabled={refineSaving} className="bg-purple-600 hover:bg-purple-700">
                  {refineSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Save Refined Description
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminOfferwallManager;
