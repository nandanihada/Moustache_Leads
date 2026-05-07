import { useState, useEffect, useMemo, useRef } from "react";
import { Search, Loader2, Clock, CheckCircle, XCircle, ChevronLeft, ChevronRight, Filter, Send, Sparkles, ExternalLink, LayoutGrid, List, X, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { publisherOfferApi, type PublisherOffer, type AutocompleteSuggestion } from "@/services/publisherOfferApi";
import { useToast } from "@/hooks/use-toast";
import { searchLogsApi } from "@/services/searchLogsApi";
import OfferDetailsModalNew from "@/components/OfferDetailsModalNew";
import { API_BASE_URL } from "@/services/apiConfig";
import { useAuth } from "@/contexts/AuthContext";
import PlacementRequired from "@/components/PlacementRequired";
import { getOfferImage } from "@/utils/categoryImages";
import { PlacementProofPopup } from "@/components/PlacementProofPopup";

// Image-based flags via flagcdn (works on all systems unlike emoji)
const getFlag = (code: string) => {
  const c = code.toUpperCase();
  const mapped = c === "UK" ? "GB" : c;
  return `https://flagcdn.com/20x15/${mapped.toLowerCase()}.png`;
};

const PublisherOffersContent = () => {
  const { toast } = useToast();
  const { user } = useAuth();

  // View mode
  const [viewMode, setViewMode] = useState<"available" | "requests" | "my_offers">("available");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [countryFilter, setCountryFilter] = useState("all");
  const [verticalFilter, setVerticalFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  // Data
  const [offers, setOffers] = useState<PublisherOffer[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [myOffers, setMyOffers] = useState<PublisherOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [myOffersLoading, setMyOffersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [selectedOffer, setSelectedOffer] = useState<PublisherOffer | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [applyPopupOpen, setApplyPopupOpen] = useState(false);
  const [applyOffer, setApplyOffer] = useState<PublisherOffer | null>(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [proofPopupOpen, setProofPopupOpen] = useState(false);
  const [proofOffer, setProofOffer] = useState<{ offer_id: string; name: string } | null>(null);
  const [successPopupOpen, setSuccessPopupOpen] = useState(false);
  const [lastApplyWasInstant, setLastApplyWasInstant] = useState(false);

  // Display mode
  const [displayMode, setDisplayMode] = useState<"table" | "grid">("table");

  // Autocomplete state (keyword-only, max 4)
  const [acSuggestions, setAcSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [acOpen, setAcOpen] = useState(false);
  const [acLoading, setAcLoading] = useState(false);
  const [acCorrected, setAcCorrected] = useState<string | null>(null);
  const acTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const acDropdownRef = useRef<HTMLDivElement>(null);
  const [acHighlight, setAcHighlight] = useState(-1);

  // Search session state
  const searchSessionId = useRef<string | null>(null);

  // Guided search wizard state
  const [wizardActive, setWizardActive] = useState(false);
  const [wizardKeyword, setWizardKeyword] = useState('');
  const [wizardStep, setWizardStep] = useState<'vertical' | 'geo' | 'payout' | 'placement' | 'results'>('vertical');
  const [wizVertical, setWizVertical] = useState('');
  const [wizGeo, setWizGeo] = useState('');
  const [wizPayout, setWizPayout] = useState('');
  const [wizHasPlacement, setWizHasPlacement] = useState<boolean | null>(null);
  const [wizPlacementLink, setWizPlacementLink] = useState('');
  const [wizPlacementFile, setWizPlacementFile] = useState<File | null>(null);
  const [wizSearching, setWizSearching] = useState(false);
  const [wizResults, setWizResults] = useState<PublisherOffer[]>([]);
  const [wizNoResults, setWizNoResults] = useState(false);

  // Wizard config from admin settings
  const [wizConfig, setWizConfig] = useState({ vertical_enabled: true, geo_enabled: true, payout_enabled: true, placement_enabled: true });
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/platform-settings/search-wizard`)
      .then(r => r.json())
      .then(data => setWizConfig(data))
      .catch(() => {});
  }, []);

  // Helper: get ordered wizard steps based on admin config
  const WIZARD_STEPS_ORDER: Array<'vertical' | 'geo' | 'payout' | 'placement'> = ['vertical', 'geo', 'payout', 'placement'];
  const STEP_CONFIG_MAP: Record<string, keyof typeof wizConfig> = {
    vertical: 'vertical_enabled', geo: 'geo_enabled', payout: 'payout_enabled', placement: 'placement_enabled',
  };
  const enabledSteps = WIZARD_STEPS_ORDER.filter(s => wizConfig[STEP_CONFIG_MAP[s]]);
  const getFirstWizardStep = (): 'vertical' | 'geo' | 'payout' | 'placement' | 'results' => enabledSteps[0] || 'results';
  const getNextStep = (current: string): 'vertical' | 'geo' | 'payout' | 'placement' | 'results' => {
    const idx = enabledSteps.indexOf(current as any);
    return idx >= 0 && idx < enabledSteps.length - 1 ? enabledSteps[idx + 1] : 'results';
  };
  const getPrevStep = (current: string): 'vertical' | 'geo' | 'payout' | 'placement' | 'results' => {
    const idx = enabledSteps.indexOf(current as any);
    return idx > 0 ? enabledSteps[idx - 1] : enabledSteps[0] || 'results';
  };
  const isLastEnabledStep = (current: string): boolean => enabledSteps.indexOf(current as any) === enabledSteps.length - 1;

  // Smart vertical mapping
  const VERTICAL_MAP: Record<string, string> = {
    'game': 'GAMES_INSTALL', 'games': 'GAMES_INSTALL', 'gaming': 'GAMES_INSTALL',
    'finance': 'FINANCE', 'financial': 'FINANCE', 'banking': 'FINANCE', 'crypto': 'FINANCE',
    'health': 'HEALTH', 'medical': 'HEALTH', 'fitness': 'HEALTH',
    'survey': 'SURVEY', 'surveys': 'SURVEY', 'poll': 'SURVEY',
    'sweepstakes': 'SWEEPSTAKES', 'sweeps': 'SWEEPSTAKES', 'giveaway': 'SWEEPSTAKES', 'contest': 'SWEEPSTAKES',
    'education': 'EDUCATION', 'learning': 'EDUCATION', 'course': 'EDUCATION',
    'insurance': 'INSURANCE', 'insure': 'INSURANCE',
    'loan': 'LOAN', 'loans': 'LOAN', 'lending': 'LOAN', 'mortgage': 'LOAN',
    'dating': 'DATING', 'romance': 'DATING',
    'trial': 'FREE_TRIAL', 'free trial': 'FREE_TRIAL', 'freetrial': 'FREE_TRIAL',
    'install': 'INSTALLS', 'installs': 'INSTALLS', 'app': 'INSTALLS', 'download': 'INSTALLS',
  };
  const ALL_VERTICALS = ['HEALTH', 'SURVEY', 'SWEEPSTAKES', 'EDUCATION', 'INSURANCE', 'LOAN', 'FINANCE', 'DATING', 'FREE_TRIAL', 'INSTALLS', 'GAMES_INSTALL'];

  const resolveVertical = (input: string): string => {
    const lower = input.trim().toLowerCase();
    if (VERTICAL_MAP[lower]) return VERTICAL_MAP[lower];
    // Fuzzy: check if input is contained in any vertical name
    const match = ALL_VERTICALS.find(v => v.toLowerCase().includes(lower) || lower.includes(v.toLowerCase()));
    return match || input.toUpperCase();
  };

  const getVerticalSuggestions = (input: string): string[] => {
    if (!input.trim()) return ALL_VERTICALS;
    const lower = input.trim().toLowerCase();
    // Direct map match
    if (VERTICAL_MAP[lower]) return [VERTICAL_MAP[lower]];
    // Filter verticals that match
    return ALL_VERTICALS.filter(v =>
      v.toLowerCase().includes(lower) || lower.includes(v.toLowerCase().replace('_', ' '))
    );
  };

  // Pagination
  const [page, setPage] = useState(1);
  const [perPageState, setPerPageState] = useState(50);
  const perPage = perPageState;

  // Fetch available offers
  const fetchOffers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await publisherOfferApi.getAvailableOffers({ page: 1, per_page: 10000, search: "" });
      setOffers(res.offers || []);
    } catch (err: any) {
      setError(err.message || "Failed to load offers");
    } finally {
      setLoading(false);
    }
  };

  // Fetch my requests
  const fetchMyRequests = async () => {
    setRequestsLoading(true);
    try {
      const res = await publisherOfferApi.getMyAccessRequests({ page: 1, per_page: 10000 });
      setMyRequests(res.requests || []);
    } catch (err: any) {
      console.error("Failed to load requests:", err);
    } finally {
      setRequestsLoading(false);
    }
  };

  // Fetch my approved offers (offers user has access to)
  const fetchMyOffers = async () => {
    setMyOffersLoading(true);
    try {
      const res = await publisherOfferApi.getAvailableOffers({ page: 1, per_page: 10000 });
      const approved = (res.offers || []).filter((o) => o.has_access);
      setMyOffers(approved);
    } catch (err: any) {
      console.error("Failed to load my offers:", err);
    } finally {
      setMyOffersLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
    fetchMyRequests();
    fetchMyOffers();
  }, []);

  // Refresh when view changes
  useEffect(() => {
    if (viewMode === "requests") fetchMyRequests();
    if (viewMode === "my_offers") fetchMyOffers();
  }, [viewMode]);

  // Get unique countries and verticals for filter dropdowns
  const uniqueCountries = useMemo(() => {
    const set = new Set<string>();
    offers.forEach((o) => o.countries?.forEach((c) => set.add(c.toUpperCase())));
    return Array.from(set).sort();
  }, [offers]);

  const uniqueVerticals = useMemo(() => {
    const set = new Set<string>();
    offers.forEach((o) => {
      // Support both old single category and new categories array
      const cats = (o as any).categories;
      if (Array.isArray(cats)) {
        cats.forEach((c: string) => { if (c) set.add(c); });
      } else {
        const v = (o as any).category || (o as any).vertical;
        if (v) set.add(v);
      }
    });
    return Array.from(set).sort();
  }, [offers]);

  // Filtered + sorted offers
  const filteredOffers = useMemo(() => {
    let list = viewMode === "my_offers" ? [...myOffers] : viewMode === "requests" ? [] : [...offers];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter((o) => {
        // Search by name, offer_id, network
        if (o.name.toLowerCase().includes(q) || o.offer_id.toLowerCase().includes(q) || o.network?.toLowerCase().includes(q)) return true;
        // Also search by categories
        const cats = (o as any).categories;
        if (Array.isArray(cats) && cats.some((c: string) => c.toLowerCase().includes(q))) return true;
        const v = (o as any).category || (o as any).vertical || "";
        if (v.toLowerCase().includes(q)) return true;
        return false;
      });
    }
    if (countryFilter !== "all") {
      list = list.filter((o) => o.countries?.some((c) => c.toUpperCase() === countryFilter));
    }
    if (verticalFilter !== "all") {
      list = list.filter((o) => {
        // Check categories array first (new system)
        const cats = (o as any).categories;
        if (Array.isArray(cats) && cats.length > 0) {
          return cats.some((c: string) => c.toLowerCase() === verticalFilter.toLowerCase());
        }
        // Fallback to old single category
        const v = (o as any).category || (o as any).vertical || "";
        return v.toLowerCase() === verticalFilter.toLowerCase();
      });
    }
    // Sort - always keep pinned offers at top regardless of sort choice
    if (sortBy === "newest") list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    else if (sortBy === "payout_high") list.sort((a, b) => b.payout - a.payout);
    else if (sortBy === "payout_low") list.sort((a, b) => a.payout - b.payout);
    else if (sortBy === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    // Move pinned offers to top (stable sort preserves relative order within pinned/unpinned)
    list.sort((a, b) => {
      const aPinned = (a as any).is_pinned ? 1 : 0;
      const bPinned = (b as any).is_pinned ? 1 : 0;
      return bPinned - aPinned;
    });
    return list;
  }, [offers, myOffers, viewMode, searchTerm, countryFilter, verticalFilter, sortBy]);

  // (wizard replaces progressive mode — no progressive memos needed)

  // Auto-log search to backend 2s after user stops typing (fires automatically, no button needed)
  const searchLogTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLoggedSearch = useRef<string>('');
  const lastSearchLogId = useRef<string | null>(null);
  useEffect(() => {
    if (searchLogTimer.current) clearTimeout(searchLogTimer.current);
    const term = searchTerm.trim();
    if (term.length >= 2 && term !== lastLoggedSearch.current) {
      searchLogTimer.current = setTimeout(async () => {
        lastLoggedSearch.current = term;
        const logId = await searchLogsApi.logSearch(term, filteredOffers.length);
        lastSearchLogId.current = logId;
      }, 2000);
    }
    return () => { if (searchLogTimer.current) clearTimeout(searchLogTimer.current); };
  }, [searchTerm, filteredOffers.length]);

  // Autocomplete: fetch suggestions as user types (300ms debounce)
  // Suppress when wizard is active (user already picked a keyword)
  useEffect(() => {
    if (acTimer.current) clearTimeout(acTimer.current);
    if (wizardActive) { setAcOpen(false); return; }
    const q = searchTerm.trim();
    if (q.length < 2) {
      setAcSuggestions([]);
      setAcOpen(false);
      setAcCorrected(null);
      return;
    }
    setAcLoading(true);
    acTimer.current = setTimeout(async () => {
      try {
        const res = await publisherOfferApi.autocomplete(q);
        setAcSuggestions(res.suggestions || []);
        setAcCorrected(res.autocorrected_to || null);
        setAcOpen((res.suggestions || []).length > 0);
        setAcHighlight(-1);
      } catch {
        setAcSuggestions([]);
        setAcOpen(false);
      } finally {
        setAcLoading(false);
      }
    }, 300);
    return () => { if (acTimer.current) clearTimeout(acTimer.current); };
  }, [searchTerm, wizardActive]);

  // Close autocomplete on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        acDropdownRef.current && !acDropdownRef.current.contains(e.target as Node) &&
        searchInputRef.current && !searchInputRef.current.contains(e.target as Node)
      ) {
        setAcOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Handle autocomplete suggestion pick → enter wizard
  const handleAcPick = (suggestion: AutocompleteSuggestion, position: number) => {
    setSearchTerm(suggestion.name);
    setAcOpen(false);
    setWizardKeyword(suggestion.name);
    setWizardActive(true);
    setWizardStep(getFirstWizardStep());
    setWizVertical(''); setWizGeo(''); setWizPayout(''); setWizHasPlacement(null); setWizPlacementLink(''); setWizPlacementFile(null);
    setWizResults([]); setWizNoResults(false);
    // If no wizard steps enabled, run search immediately
    if (enabledSteps.length === 0) {
      setTimeout(() => runWizardSearch(), 0);
    }
    // Log
    if (searchSessionId.current) {
      publisherOfferApi.logSearchEvent(searchSessionId.current, 'suggestion_picked', {
        offer_id: suggestion.offer_id, position, name: suggestion.name,
      });
    }
    createSession(suggestion.name, acCorrected);
  };

  // Handle keyboard navigation in autocomplete
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!acOpen || acSuggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAcHighlight(prev => Math.min(prev + 1, acSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAcHighlight(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && acHighlight >= 0) {
      e.preventDefault();
      handleAcPick(acSuggestions[acHighlight], acHighlight);
    } else if (e.key === 'Escape') {
      setAcOpen(false);
    }
  };

  // Create search session when user submits search (Enter or picks suggestion)
  const createSession = async (query: string, corrected?: string | null) => {
    try {
      // Abandon previous session if active
      if (searchSessionId.current) {
        publisherOfferApi.abandonSearchSession(searchSessionId.current);
      }
      const res = await publisherOfferApi.createSearchSession(query, corrected, filteredOffers.length);
      searchSessionId.current = res.session_id;
    } catch {
      // Silent fail
    }
  };

  // Trigger wizard on Enter key in search
  const handleSearchSubmit = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchTerm.trim().length >= 2) {
      setAcOpen(false);
      setWizardKeyword(searchTerm.trim());
      setWizardActive(true);
      setWizardStep(getFirstWizardStep());
      setWizVertical(''); setWizGeo(''); setWizPayout(''); setWizHasPlacement(null); setWizPlacementLink(''); setWizPlacementFile(null);
      setWizResults([]); setWizNoResults(false);
      createSession(searchTerm.trim(), acCorrected);
      if (enabledSteps.length === 0) {
        setTimeout(() => runWizardSearch(), 0);
      }
    }
    if (e.key === 'Escape') {
      setAcOpen(false);
    }
  };

  // Wizard: run the search with all criteria
  const runWizardSearch = async () => {
    setWizSearching(true);
    setWizNoResults(false);
    const keyword = wizardKeyword.toLowerCase();
    const vertical = wizVertical ? resolveVertical(wizVertical) : '';
    const geo = wizGeo.trim().toUpperCase();
    const targetPayout = parseFloat(wizPayout) || 0;

    // Upload placement proof file if provided
    let proofFileRef = '';
    if (wizPlacementFile) {
      try {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(wizPlacementFile);
        });
        const { placementProofApi } = await import('@/services/placementProofApi');
        const proofRes = await placementProofApi.submitProof({
          offer_id: 'search_wizard',
          offer_name: wizardKeyword,
          description: `Search wizard proof: ${wizardKeyword} | ${vertical} | ${geo} | $${targetPayout}`,
          placement_url: wizPlacementLink,
          traffic_source: 'search_wizard',
          base64_images: [base64],
        });
        proofFileRef = proofRes?._id || proofRes?.proof_id || 'uploaded';
        // Store image URLs for admin viewing
        if (proofRes?.image_urls?.length) {
          proofFileRef = proofRes._id + '|' + proofRes.image_urls.join(',');
        }
      } catch {
        // Silent fail — don't block the search
        proofFileRef = 'upload_failed';
      }
    }

    // Filter from loaded offers
    let results = [...offers];
    // Keyword filter
    if (keyword) {
      results = results.filter(o =>
        o.name.toLowerCase().includes(keyword) ||
        o.offer_id.toLowerCase().includes(keyword) ||
        o.network?.toLowerCase().includes(keyword) ||
        ((o as any).categories || []).some((c: string) => c.toLowerCase().includes(keyword)) ||
        ((o as any).category || '').toLowerCase().includes(keyword)
      );
    }
    // Vertical filter
    if (vertical) {
      results = results.filter(o => {
        const cats = (o as any).categories;
        if (Array.isArray(cats) && cats.length > 0) return cats.some((c: string) => c.toUpperCase() === vertical);
        const v = ((o as any).category || (o as any).vertical || '').toUpperCase();
        return v === vertical;
      });
    }
    // Geo filter
    if (geo) {
      results = results.filter(o => o.countries?.some(c => c.toUpperCase() === geo));
    }
    // Payout filter (show offers >= target payout)
    if (targetPayout > 0) {
      results = results.filter(o => o.payout >= targetPayout);
    }
    // Sort by payout desc
    results.sort((a, b) => b.payout - a.payout);

    setWizResults(results);
    setWizNoResults(results.length === 0);
    setWizardStep('results');
    setWizSearching(false);

    // Log the full search intent
    try {
      await publisherOfferApi.logSearchEvent(searchSessionId.current || '', 'filter_applied', {
        keyword: wizardKeyword, vertical, geo, target_payout: targetPayout,
        has_placement: wizHasPlacement, placement_link: wizPlacementLink,
        proof_file_ref: proofFileRef || undefined,
        result_count: results.length,
      });
      // If no results, log as placement intent / missing inventory
      if (results.length === 0) {
        await publisherOfferApi.logSearchEvent(searchSessionId.current || '', 'placement_intent', {
          searched_term: wizardKeyword, vertical, geo, target_payout: targetPayout,
          proof_uploaded: !!wizPlacementFile, proof_file_reference: proofFileRef || wizPlacementLink || undefined,
          query: wizardKeyword,
        });
        await publisherOfferApi.logSearchEvent(searchSessionId.current || '', 'not_in_inventory', {
          query: `${wizardKeyword} | ${vertical} | ${geo} | $${targetPayout}`,
        });
      }
    } catch { /* silent */ }
  };

  // Reset wizard
  const resetWizard = () => {
    setWizardActive(false);
    setWizardKeyword('');
    setWizardStep(getFirstWizardStep());
    setWizVertical(''); setWizGeo(''); setWizPayout(''); setWizHasPlacement(null);
    setWizPlacementLink(''); setWizPlacementFile(null);
    setWizResults([]); setWizNoResults(false);
    setSearchTerm('');
  };

  // Split filtered offers into pinned and regular
  const pinnedOffers = useMemo(() => {
    return filteredOffers.filter(o => (o as any).is_pinned);
  }, [filteredOffers]);

  // All offers in one list - pinned offers already sorted first by backend
  const regularFilteredOffers = useMemo(() => {
    return filteredOffers;
  }, [filteredOffers]);

  // Paginated (only applied to regular offers)
  const paginatedOffers = useMemo(() => {
    const start = (page - 1) * perPage;
    return regularFilteredOffers.slice(start, start + perPage);
  }, [regularFilteredOffers, page]);

  const totalPages = Math.ceil(regularFilteredOffers.length / perPage);

  // Track dashboard click
  const trackDashboardClick = async (offer: PublisherOffer) => {
    try {
      await fetch(`${API_BASE_URL}/api/dashboard/track-click`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offer_id: offer.offer_id,
          offer_name: offer.name,
          user_id: user?.id || '',
          user_email: user?.email || '',
          user_role: user?.role || '',
        }),
      });
    } catch {}
  };

  // Click offer name → open details modal
  const handleViewDetails = (offer: PublisherOffer) => {
    setSelectedOffer(offer);
    setDetailsModalOpen(true);
    // Log the offer view
    publisherOfferApi.logOfferView(offer.offer_id, offer.name, 'publisher_offers', offer.network || '');
    // Track picked offer in search logs
    searchLogsApi.trackSearchAction('picked_offer', lastSearchLogId.current, offer.name, offer.offer_id);
  };

  // Click Apply → open apply popup (NOT direct link)
  const handleApplyClick = (offer: PublisherOffer) => {
    setApplyOffer(offer);
    setApplyPopupOpen(true);
  };

  // Send request (from apply popup)
  const handleSendRequest = async (withProof: boolean) => {
    if (!applyOffer) return;
    if (withProof) {
      // Close apply popup, open proof popup
      setApplyPopupOpen(false);
      setProofOffer({ offer_id: applyOffer.offer_id, name: applyOffer.name });
      setProofPopupOpen(true);
      // Track clicked_request in search logs
      searchLogsApi.trackSearchAction('clicked_request', lastSearchLogId.current);
      return;
    }
    // Send request without proof
    setApplyLoading(true);
    try {
      console.log('🔍 Requesting access for offer:', applyOffer.offer_id);
      // Track clicked_request in search logs
      searchLogsApi.trackSearchAction('clicked_request', lastSearchLogId.current);
      const result = await publisherOfferApi.requestOfferAccess(applyOffer.offer_id, "");
      console.log('🔍 Access request result:', JSON.stringify(result));
      const wasInstant = result.status === 'approved';
      setApplyPopupOpen(false);
      setLastApplyWasInstant(wasInstant);
      setSuccessPopupOpen(true);
      
      // For instant approval, immediately update local state so button changes to "Open"
      if (wasInstant) {
        setOffers(prev => prev.map(o => 
          o.offer_id === applyOffer.offer_id 
            ? { ...o, has_access: true, request_status: 'approved' } 
            : o
        ));
        setMyOffers(prev => {
          const exists = prev.some(o => o.offer_id === applyOffer.offer_id);
          if (!exists) return [...prev, { ...applyOffer, has_access: true, request_status: 'approved' }];
          return prev;
        });
      }
      
      fetchMyRequests();
      fetchOffers();
    } catch (err: any) {
      console.log('🔍 Access request error:', err.response?.status, JSON.stringify(err.response?.data));
      const errData = err.response?.data;
      // If already pending/approved, treat as success and refresh
      if (errData?.status === 'pending' || errData?.status === 'approved') {
        setApplyPopupOpen(false);
        setLastApplyWasInstant(errData.status === 'approved');
        setSuccessPopupOpen(true);
        fetchMyRequests();
        fetchOffers();
      } else {
        toast({ title: "Failed", description: errData?.error || err.message, variant: "destructive" });
      }
    } finally {
      setApplyLoading(false);
    }
  };

  // After proof submitted
  const handleProofSubmitted = async () => {
    // Also send the access request
    if (proofOffer) {
      try {
        await publisherOfferApi.requestOfferAccess(proofOffer.offer_id, "Placement proof submitted");
      } catch {}
    }
    setProofPopupOpen(false);
    setSuccessPopupOpen(true);
    fetchMyRequests();
    fetchOffers();
  };

  // After proof skipped
  const handleProofSkip = async () => {
    if (proofOffer) {
      try {
        await publisherOfferApi.requestOfferAccess(proofOffer.offer_id, "");
      } catch {}
    }
    setProofPopupOpen(false);
    setSuccessPopupOpen(true);
    fetchMyRequests();
    fetchOffers();
  };

  // Access granted callback (from details modal)
  const handleAccessGranted = () => {
    fetchOffers();
    fetchMyRequests();
    fetchMyOffers();
  };

  // Render country flags
  const renderFlags = (countries: string[]) => {
    if (!countries || countries.length === 0) return <span className="text-xs text-muted-foreground">Global</span>;
    const show = countries.slice(0, 5);
    const rest = countries.length - 5;
    return (
      <div className="flex items-center gap-0.5 flex-wrap">
        {show.map((c) => (
          <Tooltip key={c}>
            <TooltipTrigger asChild>
              <img src={getFlag(c)} alt={c} className="w-5 h-[15px] rounded-sm border border-gray-200" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </TooltipTrigger>
            <TooltipContent side="top"><span className="text-xs">{c}</span></TooltipContent>
          </Tooltip>
        ))}
        {rest > 0 && <span className="text-[10px] text-muted-foreground ml-0.5">+{rest}</span>}
      </div>
    );
  };

  // Request status badge
  const statusBadge = (status: string) => {
    if (status === "pending") return <Badge variant="outline" className="text-yellow-600 border-yellow-400 text-[10px] px-1.5 py-0"><Clock className="w-3 h-3 mr-0.5" />Pending</Badge>;
    if (status === "approved") return <Badge variant="outline" className="text-green-600 border-green-400 text-[10px] px-1.5 py-0"><CheckCircle className="w-3 h-3 mr-0.5" />Approved</Badge>;
    if (status === "rejected") return <Badge variant="outline" className="text-red-600 border-red-400 text-[10px] px-1.5 py-0"><XCircle className="w-3 h-3 mr-0.5" />Rejected</Badge>;
    return null;
  };

  return (
    <TooltipProvider>
      <div className="p-4 space-y-3">

        {/* ── TOP CONTROL BAR ── */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View mode */}
          <Select value={viewMode} onValueChange={(v: any) => { setViewMode(v); setPage(1); }}>
            <SelectTrigger className="w-[170px] h-9 text-sm border-purple-200 focus:ring-purple-400">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="available">Available Offers</SelectItem>
              <SelectItem value="requests">My Requests</SelectItem>
              <SelectItem value="my_offers">My Offers</SelectItem>
            </SelectContent>
          </Select>

          {/* Inline search with keyword-only autocomplete (max 4) */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-purple-400 z-10" />
            <input
              ref={searchInputRef}
              placeholder="Search offers..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); if (wizardActive) resetWizard(); }}
              onKeyDown={(e) => { handleSearchKeyDown(e); handleSearchSubmit(e); }}
              onFocus={() => { if (acSuggestions.length > 0) setAcOpen(true); }}
              className="w-full pl-8 h-9 text-sm border border-purple-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400"
              autoComplete="off"
            />
            {acLoading && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-purple-300" />}
            {searchTerm && !acLoading && (
              <button onClick={() => { setSearchTerm(''); resetWizard(); }} className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            )}

            {/* Keyword-only dropdown (max 4, just offer names) */}
            {acOpen && acSuggestions.length > 0 && (
              <div
                ref={acDropdownRef}
                className="absolute left-0 right-0 top-full mt-1 bg-white border border-purple-200 rounded-lg shadow-lg z-50 overflow-hidden"
              >
                {acCorrected && (
                  <div className="px-3 py-1.5 text-[11px] text-purple-500 bg-purple-50 border-b border-purple-100">
                    Showing results for <span className="font-semibold">{acCorrected}</span>
                  </div>
                )}
                {acSuggestions.slice(0, 4).map((s, i) => (
                  <button
                    key={s.offer_id}
                    className={`w-full text-left px-3 py-2.5 text-sm transition-colors border-b border-gray-50 last:border-b-0 ${
                      i === acHighlight ? 'bg-purple-50 text-purple-700' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    onMouseDown={(e) => { e.preventDefault(); handleAcPick(s, i); }}
                    onMouseEnter={() => setAcHighlight(i)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filter toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showFilters ? "default" : "outline"}
                size="sm"
                className={`h-9 w-9 p-0 ${showFilters ? "bg-purple-600 hover:bg-purple-700 border-purple-600" : "border-purple-200 text-purple-600 hover:bg-purple-50"}`}
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Filters</TooltipContent>
          </Tooltip>

          {/* View mode toggle */}
          <div className="flex items-center border border-purple-200 rounded-lg overflow-hidden">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={`h-9 w-9 flex items-center justify-center transition-colors ${displayMode === "table" ? "bg-purple-600 text-white" : "text-purple-600 hover:bg-purple-50"}`}
                  onClick={() => setDisplayMode("table")}
                >
                  <List className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Table View</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={`h-9 w-9 flex items-center justify-center transition-colors ${displayMode === "grid" ? "bg-purple-600 text-white" : "text-purple-600 hover:bg-purple-50"}`}
                  onClick={() => setDisplayMode("grid")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Card View</TooltipContent>
            </Tooltip>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Per-page selector + pagination at top */}
          {viewMode !== "requests" && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {filteredOffers.length} offers
              </span>
              <Select value={String(perPage)} onValueChange={(v) => { setPerPageState(Number(v)); setPage(1); }}>
                <SelectTrigger className="w-[80px] h-8 text-xs border-purple-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                </SelectContent>
              </Select>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-purple-200 text-purple-600 hover:bg-purple-50" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground px-1 whitespace-nowrap">{page} / {totalPages}</span>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-purple-200 text-purple-600 hover:bg-purple-50" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Collapsible filters */}
        {showFilters && (
          <div className="flex items-center gap-2 flex-wrap p-3 bg-purple-50/60 rounded-lg border border-purple-100 animate-in slide-in-from-top-2 duration-200">
            <Select value={countryFilter} onValueChange={(v) => { setCountryFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[140px] h-8 text-xs border-purple-200">
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                {uniqueCountries.map((c) => (
                  <SelectItem key={c} value={c}>
                    <span className="flex items-center gap-1.5">
                      <img src={getFlag(c)} alt={c} className="w-4 h-3 rounded-sm" /> {c}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={verticalFilter} onValueChange={(v) => { setVerticalFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[140px] h-8 text-xs border-purple-200">
                <SelectValue placeholder="Vertical" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Verticals</SelectItem>
                {uniqueVerticals.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[150px] h-8 text-xs border-purple-200">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="payout_high">Payout: High → Low</SelectItem>
                <SelectItem value="payout_low">Payout: Low → High</SelectItem>
                <SelectItem value="name">Name A–Z</SelectItem>
              </SelectContent>
            </Select>

            {(countryFilter !== "all" || verticalFilter !== "all") && (
              <Button variant="ghost" size="sm" className="h-8 text-xs text-purple-600 hover:bg-purple-100" onClick={() => { setCountryFilter("all"); setVerticalFilter("all"); }}>
                Clear
              </Button>
            )}
          </div>
        )}

        {/* REQUESTS VIEW */}
        {viewMode === "requests" && (
          <div className="rounded-xl border border-purple-100 overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-purple-50 to-violet-50 border-b border-purple-100">
                  <TableHead className="py-3 text-xs font-semibold text-purple-700 uppercase tracking-wider">Offer</TableHead>
                  <TableHead className="py-3 text-xs font-semibold text-purple-700 uppercase tracking-wider">Payout</TableHead>
                  <TableHead className="py-3 text-xs font-semibold text-purple-700 uppercase tracking-wider">Status</TableHead>
                  <TableHead className="py-3 text-xs font-semibold text-purple-700 uppercase tracking-wider">Requested</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requestsLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto text-purple-400" /></TableCell></TableRow>
                ) : myRequests.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-10 text-sm text-muted-foreground">No requests yet</TableCell></TableRow>
                ) : (
                  myRequests.map((req) => (
                    <TableRow key={req._id || req.offer_id} className="text-sm hover:bg-purple-50/40 transition-colors">
                      <TableCell className="py-2.5 font-medium">{req.offer_details?.name || req.offer_name || req.offer_id}</TableCell>
                      <TableCell className="py-2.5 font-semibold text-green-600">
                        {(() => {
                          const revShare = req.offer_details?.revenue_share_percent || 0;
                          if (revShare > 0) return `${Math.round(revShare * 0.9 * 100) / 100}%`;
                          return `$${(req.offer_details?.payout ? (req.offer_details.payout * 0.8) : (req.payout || 0)).toFixed(2)}`;
                        })()}
                      </TableCell>
                      <TableCell className="py-2.5">{statusBadge(req.status)}</TableCell>
                      <TableCell className="py-2.5 text-xs text-muted-foreground">{req.requested_at ? new Date(req.requested_at).toLocaleDateString() : "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* OFFERS TABLE (available + my_offers) */}
        {viewMode !== "requests" && (
          <>
            {pinnedOffers.length >= 0 && /* pinned offers merged into main list */ null}

            <div className="flex items-center gap-2 mb-3">
              <List className="h-5 w-5 text-purple-500" />
              <h2 className="text-lg font-bold text-gray-900">
                {wizardActive ? `Search: "${wizardKeyword}"` : 'All Offers'}
              </h2>
              {wizardActive && (
                <button onClick={resetWizard} className="ml-2 text-xs text-purple-500 hover:text-purple-700 underline underline-offset-2">
                  Back to all offers
                </button>
              )}
            </div>

            {/* ── GUIDED SEARCH WIZARD ── */}
            {wizardActive ? (
              <div className="space-y-4">
                {wizardStep !== 'results' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-white rounded-xl border border-purple-100 shadow-sm space-y-4">

                    {/* Answered tags row — shows what user already picked */}
                    <div className="flex items-center gap-2 flex-wrap min-h-[28px]">
                      {wizardKeyword && (
                        <motion.span initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                          className="text-[11px] bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full font-medium">{wizardKeyword}</motion.span>
                      )}
                      {wizVertical && wizardStep !== 'vertical' && (
                        <motion.span initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                          className="text-[11px] bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                          {resolveVertical(wizVertical)}
                          <button onClick={() => { setWizVertical(''); setWizardStep('vertical'); }} className="hover:text-blue-900"><X className="h-2.5 w-2.5" /></button>
                        </motion.span>
                      )}
                      {wizGeo && wizardStep !== 'geo' && (
                        <motion.span initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                          className="text-[11px] bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                          <img src={getFlag(wizGeo)} alt={wizGeo} className="w-3.5 h-[10px] rounded-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          {wizGeo}
                          <button onClick={() => { setWizGeo(''); setWizardStep('geo'); }} className="hover:text-green-900"><X className="h-2.5 w-2.5" /></button>
                        </motion.span>
                      )}
                      {wizPayout && wizardStep !== 'payout' && (
                        <motion.span initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                          className="text-[11px] bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                          ${wizPayout}+
                          <button onClick={() => { setWizPayout(''); setWizardStep('payout'); }} className="hover:text-amber-900"><X className="h-2.5 w-2.5" /></button>
                        </motion.span>
                      )}
                      {wizHasPlacement !== null && wizardStep !== 'placement' && (
                        <motion.span initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                          className="text-[11px] bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                          Placement: {wizHasPlacement ? 'Yes' : 'No'}
                          <button onClick={() => { setWizHasPlacement(null); setWizardStep('placement'); }} className="hover:text-gray-900"><X className="h-2.5 w-2.5" /></button>
                        </motion.span>
                      )}
                    </div>

                    {/* Current step input */}
                    <AnimatePresence mode="wait">
                      {wizardStep === 'vertical' && (
                        <motion.div key="vertical" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}
                          className="space-y-2">
                          <input autoFocus placeholder="Vertical" value={wizVertical} onChange={(e) => setWizVertical(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { isLastEnabledStep('vertical') ? runWizardSearch() : setWizardStep(getNextStep('vertical')); } }}
                            className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400" />
                          <div className="flex flex-wrap gap-1.5">
                            {(wizVertical ? getVerticalSuggestions(wizVertical) : ALL_VERTICALS).slice(0, 8).map(v => (
                              <button key={v} onClick={() => { setWizVertical(v); isLastEnabledStep('vertical') ? runWizardSearch() : setWizardStep(getNextStep('vertical')); }}
                                className="text-[11px] px-2.5 py-1 rounded-full border border-gray-200 text-gray-500 hover:border-purple-300 hover:text-purple-600 transition-colors">{v}</button>
                            ))}
                          </div>
                          {isLastEnabledStep('vertical')
                            ? <Button size="sm" onClick={runWizardSearch} className="h-8 text-xs rounded-full px-4 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white"><Search className="h-3 w-3 mr-1" />Find Offers</Button>
                            : <Button size="sm" onClick={() => setWizardStep(getNextStep('vertical'))} className="h-8 text-xs rounded-full px-4 bg-purple-600 hover:bg-purple-700 text-white">{wizVertical ? 'Next' : 'Skip'}</Button>
                          }
                        </motion.div>
                      )}

                      {wizardStep === 'geo' && (
                        <motion.div key="geo" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}
                          className="space-y-2">
                          <input autoFocus placeholder="Geo (e.g. US, UK, IN)" value={wizGeo} onChange={(e) => setWizGeo(e.target.value.toUpperCase())}
                            onKeyDown={(e) => { if (e.key === 'Enter') { isLastEnabledStep('geo') ? runWizardSearch() : setWizardStep(getNextStep('geo')); } }}
                            className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400" />
                          {uniqueCountries.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {uniqueCountries.slice(0, 12).map(g => (
                                <button key={g} onClick={() => { setWizGeo(g); isLastEnabledStep('geo') ? runWizardSearch() : setWizardStep(getNextStep('geo')); }}
                                  className={`text-[11px] px-2.5 py-1 rounded-full border flex items-center gap-1 transition-colors ${wizGeo === g ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-200 text-gray-500 hover:border-purple-300 hover:text-purple-600'}`}>
                                  <img src={getFlag(g)} alt={g} className="w-3.5 h-[10px] rounded-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />{g}
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => setWizardStep(getPrevStep('geo'))} className="h-8 text-xs">Back</Button>
                            {isLastEnabledStep('geo')
                              ? <Button size="sm" onClick={runWizardSearch} className="h-8 text-xs rounded-full px-4 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white"><Search className="h-3 w-3 mr-1" />Find Offers</Button>
                              : <Button size="sm" onClick={() => setWizardStep(getNextStep('geo'))} className="h-8 text-xs rounded-full px-4 bg-purple-600 hover:bg-purple-700 text-white">{wizGeo ? 'Next' : 'Skip'}</Button>
                            }
                          </div>
                        </motion.div>
                      )}

                      {wizardStep === 'payout' && (
                        <motion.div key="payout" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}
                          className="space-y-3">
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-500 shrink-0">Target payout</span>
                            <span className="text-lg font-bold text-purple-600 min-w-[60px]">${wizPayout || '0'}</span>
                          </div>
                          <input
                            type="range" min="0" max="200" step="1"
                            value={wizPayout || '0'}
                            onChange={(e) => setWizPayout(e.target.value === '0' ? '' : e.target.value)}
                            className="w-full h-2 accent-purple-600 cursor-pointer"
                          />
                          <div className="flex justify-between text-[10px] text-gray-400">
                            <span>$0</span><span>$50</span><span>$100</span><span>$150</span><span>$200+</span>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => setWizardStep(getPrevStep('payout'))} className="h-8 text-xs">Back</Button>
                            {isLastEnabledStep('payout')
                              ? <Button size="sm" onClick={runWizardSearch} className="h-8 text-xs rounded-full px-4 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white"><Search className="h-3 w-3 mr-1" />Find Offers</Button>
                              : <Button size="sm" onClick={() => setWizardStep(getNextStep('payout'))} className="h-8 text-xs rounded-full px-4 bg-purple-600 hover:bg-purple-700 text-white">{wizPayout ? 'Next' : 'Skip'}</Button>
                            }
                          </div>
                        </motion.div>
                      )}

                      {wizardStep === 'placement' && (
                        <motion.div key="placement" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}
                          className="space-y-3">
                          <p className="text-sm text-gray-600">Do you have a placement for this?</p>
                          <div className="flex gap-2">
                            <Button size="sm" variant={wizHasPlacement === true ? 'default' : 'outline'} onClick={() => setWizHasPlacement(true)}
                              className={`h-8 text-xs rounded-full px-4 ${wizHasPlacement === true ? 'bg-purple-600 text-white' : ''}`}>Yes</Button>
                            <Button size="sm" variant={wizHasPlacement === false ? 'default' : 'outline'} onClick={() => setWizHasPlacement(false)}
                              className={`h-8 text-xs rounded-full px-4 ${wizHasPlacement === false ? 'bg-purple-600 text-white' : ''}`}>No</Button>
                          </div>
                          {wizHasPlacement === true && (
                            <div className="space-y-2">
                              <input placeholder="Placement link (optional)" value={wizPlacementLink} onChange={(e) => setWizPlacementLink(e.target.value)}
                                className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400" />
                              <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer hover:text-purple-600">
                                <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setWizPlacementFile(e.target.files?.[0] || null)} />
                                <span className="px-3 py-1.5 border border-dashed border-gray-300 rounded-lg hover:border-purple-400 transition-colors">
                                  {wizPlacementFile ? wizPlacementFile.name : 'Upload proof (image/pdf)'}
                                </span>
                              </label>
                            </div>
                          )}
                          <div className="flex gap-2 pt-1">
                            <Button size="sm" variant="ghost" onClick={() => setWizardStep(getPrevStep('placement'))} className="h-8 text-xs">Back</Button>
                            <Button size="sm" onClick={runWizardSearch} disabled={wizSearching}
                              className="h-8 text-xs rounded-full px-6 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white">
                              {wizSearching ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Search className="h-3 w-3 mr-1" />}
                              Find Offers
                            </Button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {/* Wizard results */}
                {wizardStep === 'results' && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className="text-[10px] text-gray-400">Searched:</span>
                      <span className="text-[11px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{wizardKeyword}</span>
                      {wizVertical && <span className="text-[11px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{resolveVertical(wizVertical)}</span>}
                      {wizGeo && <span className="text-[11px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{wizGeo}</span>}
                      {wizPayout && <span className="text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">${wizPayout}+</span>}
                      {wizHasPlacement !== null && <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Placement: {wizHasPlacement ? 'Yes' : 'No'}</span>}
                      <button onClick={() => setWizardStep(getFirstWizardStep())} className="text-[10px] text-purple-500 underline ml-1">Edit</button>
                    </div>

                    {wizNoResults ? (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12 space-y-4">
                        <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                          className="w-16 h-16 mx-auto rounded-full bg-purple-50 flex items-center justify-center">
                          <Search className="h-8 w-8 text-purple-300" />
                        </motion.div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">No offer found</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={resetWizard} className="h-8 text-xs rounded-full px-4">Search again</Button>
                      </motion.div>
                    ) : (
                      <>
                        <p className="text-xs text-gray-400">{wizResults.length} offer{wizResults.length !== 1 ? 's' : ''} found</p>
                        {wizResults.map((offer, idx) => {
                          const hasAccess = offer.has_access;
                          const isPending = offer.request_status === "pending";
                          return (
                            <motion.div key={offer.offer_id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                              className="rounded-xl border border-purple-100 bg-white shadow-sm p-4 flex items-center gap-4">
                              <img src={getOfferImage(offer as any)} alt="" className="w-10 h-10 rounded-lg object-cover border border-purple-100 shrink-0"
                                onError={(e) => { (e.target as HTMLImageElement).src = "/category-images/other.png"; }} />
                              <div className="flex-1 min-w-0">
                                <button onClick={() => handleViewDetails(offer)} className="font-semibold text-sm text-gray-900 truncate block hover:text-purple-600 text-left">{offer.name}</button>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] text-purple-500 bg-purple-50 px-1.5 py-0.5 rounded">{(offer as any).category || 'OTHER'}</span>
                                  {renderFlags(offer.countries)}
                                </div>
                              </div>
                              <span className="font-bold text-emerald-600 shrink-0">
                                {(offer as any).revenue_share_percent > 0 ? `${(offer as any).revenue_share_percent}%` : `$${offer.payout.toFixed(2)}`}
                              </span>
                              {hasAccess ? (
                                <Button size="sm" variant="outline" className="h-8 text-xs rounded-full px-3 border-purple-200 text-purple-600"
                                  onClick={() => { trackDashboardClick(offer); handleViewDetails(offer); }}><ExternalLink className="h-3 w-3 mr-1" />Open</Button>
                              ) : isPending ? (
                                <Button size="sm" variant="outline" className="h-8 text-xs rounded-full px-3 opacity-40" disabled>Pending</Button>
                              ) : (
                                <Button size="sm" className="h-8 text-xs rounded-full px-3 bg-purple-600 hover:bg-purple-700 text-white"
                                  onClick={() => handleApplyClick(offer)}><Send className="h-3 w-3 mr-1" />Apply</Button>
                              )}
                            </motion.div>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
              </div>
            ) : error ? (
              <div className="text-center py-16 text-sm text-red-500">{error}</div>
            ) : paginatedOffers.length === 0 ? (
              <div className="text-center py-16 text-sm text-muted-foreground">No offers found</div>
            ) : displayMode === "table" ? (
              <div className="rounded-xl border border-purple-100 overflow-hidden shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-purple-50 to-violet-50 border-b border-purple-100">
                      <TableHead className="py-3 pl-3 text-xs font-semibold text-purple-700 uppercase tracking-wider w-[100px]">ID</TableHead>
                      <TableHead className="py-3 pl-2 w-[36px]"></TableHead>
                      <TableHead className="py-3 text-xs font-semibold text-purple-700 uppercase tracking-wider">Offer</TableHead>
                      <TableHead className="py-3 text-xs font-semibold text-purple-700 uppercase tracking-wider w-[80px]">Payout</TableHead>
                      <TableHead className="py-3 text-xs font-semibold text-purple-700 uppercase tracking-wider">Countries</TableHead>
                      <TableHead className="py-3 text-xs font-semibold text-purple-700 uppercase tracking-wider w-[90px]">Category</TableHead>
                      <TableHead className="py-3 text-xs font-semibold text-purple-700 uppercase tracking-wider w-[80px]">Device</TableHead>
                      <TableHead className="py-3 text-xs font-semibold text-purple-700 uppercase tracking-wider w-[80px]">Status</TableHead>
                      <TableHead className="py-3 pr-4 text-xs font-semibold text-purple-700 uppercase tracking-wider text-right w-[90px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedOffers.map((offer, idx) => {
                      const hasAccess = offer.has_access;
                      const isPending = offer.request_status === "pending";
                      return (
                        <TableRow key={offer.offer_id} className={`transition-colors hover:bg-purple-50/50 ${idx % 2 === 0 ? "bg-white" : "bg-violet-50/20"}`}>
                          {/* ID — first column */}
                          <TableCell className="py-2.5 pl-3">
                            <span className="text-[10px] text-purple-500 font-mono bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded whitespace-nowrap">{offer.offer_id}</span>
                          </TableCell>

                          {/* Thumbnail */}
                          <TableCell className="py-2.5 pl-2 pr-0">
                            <img
                              src={getOfferImage(offer as any)}
                              alt=""
                              className="w-8 h-8 rounded-lg object-cover border border-purple-100 shadow-sm"
                              onError={(e) => { (e.target as HTMLImageElement).src = "/category-images/other.png"; }}
                            />
                          </TableCell>

                          {/* Name */}
                          <TableCell className="py-2.5">
                            <button
                              className="text-left hover:text-purple-600 transition-colors font-medium text-sm leading-tight line-clamp-1"
                              onClick={() => handleViewDetails(offer)}
                            >
                              {offer.name}
                            </button>
                          </TableCell>

                          {/* Payout */}
                          <TableCell className="py-2.5">
                            <span className="font-bold text-emerald-600">
                              {(offer as any).revenue_share_percent > 0 ? `${(offer as any).revenue_share_percent}%` : `$${offer.payout.toFixed(2)}`}
                            </span>
                          </TableCell>

                          {/* Countries */}
                          <TableCell className="py-2.5">{renderFlags(offer.countries)}</TableCell>

                          {/* Category */}
                          <TableCell className="py-2.5">
                            <span className="text-xs capitalize text-muted-foreground">
                              {(offer as any).category || (offer as any).vertical || '—'}
                            </span>
                          </TableCell>

                          {/* Device */}
                          <TableCell className="py-2.5">
                            <span className="text-xs capitalize text-muted-foreground">
                              {(offer as any).device_targeting || 'all'}
                            </span>
                          </TableCell>

                          {/* Status */}
                          <TableCell className="py-2.5">
                            {hasAccess ? (
                              <span className="inline-flex items-center text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Active</span>
                            ) : isPending ? (
                              <span className="inline-flex items-center text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Pending</span>
                            ) : offer.request_status === "rejected" ? (
                              <span className="inline-flex items-center text-[10px] font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">Rejected</span>
                            ) : (
                              <span className="inline-flex items-center text-[10px] font-semibold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">Available</span>
                            )}
                          </TableCell>

                          {/* Action */}
                          <TableCell className="py-2.5 pr-4 text-right">
                            {hasAccess ? (
                              <Button size="sm" variant="outline" className="h-7 text-xs rounded-full px-3 border-purple-200 text-purple-600 hover:bg-purple-50"
                                onClick={() => { trackDashboardClick(offer); handleViewDetails(offer); }}>
                                <ExternalLink className="h-3 w-3 mr-1" />Open
                              </Button>
                            ) : isPending ? (
                              <Button size="sm" variant="outline" className="h-7 text-xs rounded-full px-3 opacity-40" disabled>
                                <Clock className="h-3 w-3 mr-1" />Pending
                              </Button>
                            ) : (
                              <Button size="sm" className="h-7 text-xs rounded-full px-3 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white shadow-sm border-0"
                                onClick={() => handleApplyClick(offer)}>
                                <Send className="h-3 w-3 mr-1" />Apply
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {paginatedOffers.map((offer) => {
                  const hasAccess = offer.has_access;
                  const isPending = offer.request_status === "pending";
                  return (
                    <div
                      key={offer.offer_id}
                      className="group relative bg-white rounded-xl border border-purple-100 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 hover:border-purple-300"
                    >
                      {/* Image */}
                      <div className="relative h-40 bg-gradient-to-br from-purple-50 to-violet-50 overflow-hidden">
                        <img
                          src={getOfferImage(offer as any)}
                          alt={offer.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          onError={(e) => { (e.target as HTMLImageElement).src = "/category-images/other.png"; }}
                        />
                        {/* Status badge overlay */}
                        <div className="absolute top-2 right-2">
                          {hasAccess ? (
                            <span className="inline-flex items-center text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full shadow-sm">Active</span>
                          ) : isPending ? (
                            <span className="inline-flex items-center text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded-full shadow-sm">Pending</span>
                          ) : offer.request_status === "rejected" ? (
                            <span className="inline-flex items-center text-[10px] font-semibold text-red-600 bg-red-100 px-2 py-1 rounded-full shadow-sm">Rejected</span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] font-semibold text-purple-600 bg-purple-100 px-2 py-1 rounded-full shadow-sm">Available</span>
                          )}
                        </div>
                        {/* Offer ID badge */}
                        <div className="absolute top-2 left-2">
                          <span className="text-[9px] text-purple-600 font-mono bg-white/90 backdrop-blur-sm border border-purple-200 px-1.5 py-0.5 rounded shadow-sm">{offer.offer_id}</span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-4 space-y-3">
                        {/* Title */}
                        <button
                          className="text-left w-full hover:text-purple-600 transition-colors"
                          onClick={() => handleViewDetails(offer)}
                        >
                          <h3 className="font-semibold text-sm leading-tight line-clamp-2 min-h-[2.5rem]">{offer.name}</h3>
                        </button>

                        {/* Payout */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Payout</span>
                          <span className="font-bold text-lg text-emerald-600">
                            {(offer as any).revenue_share_percent > 0 ? `${(offer as any).revenue_share_percent}%` : `$${offer.payout.toFixed(2)}`}
                          </span>
                        </div>

                        {/* Countries */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Countries:</span>
                          {renderFlags(offer.countries)}
                        </div>

                        {/* Date */}
                        {offer.created_at && (
                          <div className="text-xs text-muted-foreground">
                            Added {new Date(offer.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </div>
                        )}

                        {/* Action button */}
                        <div className="pt-2">
                          {hasAccess ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full h-8 text-xs rounded-full border-purple-200 text-purple-600 hover:bg-purple-50"
                              onClick={() => { trackDashboardClick(offer); handleViewDetails(offer); }}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />Open Offer
                            </Button>
                          ) : isPending ? (
                            <Button size="sm" variant="outline" className="w-full h-8 text-xs rounded-full opacity-40" disabled>
                              <Clock className="h-3 w-3 mr-1" />Pending
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="w-full h-8 text-xs rounded-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white shadow-sm border-0"
                              onClick={() => handleApplyClick(offer)}
                            >
                              <Send className="h-3 w-3 mr-1" />Apply Now
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bottom pagination removed — pagination is at the top */}
          </>
        )}

        {/* OFFER DETAILS MODAL */}
        <OfferDetailsModalNew
          open={detailsModalOpen}
          onOpenChange={setDetailsModalOpen}
          offer={selectedOffer}
          onAccessGranted={handleAccessGranted}
          searchLogId={lastSearchLogId.current}
        />

        {/* APPLY POPUP */}
        <Dialog open={applyPopupOpen} onOpenChange={setApplyPopupOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Send className="h-5 w-5 text-blue-500" />
                Apply for Offer
              </DialogTitle>
              <DialogDescription>
                {applyOffer?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                Would you like to submit a placement proof? Publishers with proofs get faster approvals and higher scores.
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => handleSendRequest(true)}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Submit Placement Proof
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleSendRequest(false)}
                  disabled={applyLoading}
                >
                  {applyLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Skip & Send Request
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* PLACEMENT PROOF POPUP */}
        <PlacementProofPopup
          open={proofPopupOpen}
          onOpenChange={(open) => {
            if (!open) handleProofSkip();
            else setProofPopupOpen(true);
          }}
          offer={proofOffer}
          onSubmitted={handleProofSubmitted}
        />

        {/* SUCCESS ANIMATION POPUP */}
        <Dialog open={successPopupOpen} onOpenChange={setSuccessPopupOpen}>
          <DialogContent className="max-w-xs text-center">
            <div className="flex flex-col items-center py-6 gap-3">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center animate-in zoom-in-50 duration-300">
                <CheckCircle className="h-10 w-10 text-green-500" />
              </div>
              <p className="text-lg font-semibold animate-in fade-in duration-500">
                {lastApplyWasInstant ? 'Access Granted' : 'Request Sent'}
              </p>
              <p className="text-sm text-muted-foreground">
                {lastApplyWasInstant
                  ? 'You now have access to this offer. You can open it from your offers.'
                  : "Your request has been submitted. You'll be notified once it's reviewed."}
              </p>
              <Button className="mt-2" onClick={() => setSuccessPopupOpen(false)}>Done</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

// Wrap with PlacementRequired
const PublisherOffers = () => (
  <PlacementRequired>
    <PublisherOffersContent />
  </PlacementRequired>
);

export default PublisherOffers;
