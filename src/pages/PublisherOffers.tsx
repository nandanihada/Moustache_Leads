import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, Loader2, Clock, CheckCircle, XCircle, ChevronLeft, ChevronRight, Filter, Send, Sparkles, ExternalLink, LayoutGrid, List, X, ChevronDown } from "lucide-react";
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
import { getAuthToken } from "@/utils/cookies";

// Image-based flags via flagcdn (works on all systems unlike emoji)
const getFlag = (code: string) => {
  const c = code.toUpperCase();
  const mapped = c === "UK" ? "GB" : c;
  return `https://flagcdn.com/20x15/${mapped.toLowerCase()}.png`;
};

const PublisherOffersContent = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // View mode — persisted in URL ?tab=my_offers so it survives navigation back
  const initialTab = (searchParams.get('tab') || 'available') as "available" | "requests" | "my_offers" | "top_20";
  const [viewMode, setViewMode] = useState<"available" | "requests" | "my_offers" | "top_20">(
    ['available', 'requests', 'my_offers', 'top_20'].includes(initialTab) ? initialTab : 'available'
  );

  // Sync viewMode changes to URL
  const handleSetViewMode = (mode: "available" | "requests" | "my_offers" | "top_20") => {
    setViewMode(mode);
    setSearchParams(mode === 'available' ? {} : { tab: mode }, { replace: true });
  };

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
  const [topOffersList, setTopOffersList] = useState<any[]>([]);
  const [topOffersLoading, setTopOffersLoading] = useState(false);

  const fetchTopOffers = async () => {
    setTopOffersLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/dashboard/top-offers`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setTopOffersList(data.top_offers || []);
      }
    } catch (err) {
      console.error("Failed to load top offers:", err);
    } finally {
      setTopOffersLoading(false);
    }
  };

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

  // Pagination
  const [page, setPage] = useState(1);
  const [perPageState, setPerPageState] = useState(50);
  const perPage = perPageState;
  const [totalOffers, setTotalOffers] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Fetch available offers - uses server-side pagination
  const fetchOffers = async (fetchPage = 1, fetchPerPage = 50, fetchSearch = "") => {
    setLoading(true);
    setError(null);
    try {
      const res = await publisherOfferApi.getAvailableOffers({ page: fetchPage, per_page: fetchPerPage, search: fetchSearch });
      setOffers(res.offers || []);
      setTotalOffers(res.pagination?.total || 0);
      setTotalPages(res.pagination?.pages || 0);
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
      const res = await publisherOfferApi.getMyAccessRequests({ page: 1, per_page: 500 });
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
      const res = await publisherOfferApi.getMyOffers();
      setMyOffers(res.offers || []);
    } catch (err: any) {
      console.error("Failed to load my offers:", err);
    } finally {
      setMyOffersLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers(1, perPage, "");
    fetchMyRequests();
    fetchMyOffers();
    fetchTopOffers();
  }, []);

  // Re-fetch when page or perPage changes
  useEffect(() => {
    if (viewMode === "available") {
      fetchOffers(page, perPage, searchTerm);
    }
  }, [page, perPage]);

  // Refresh when view changes
  useEffect(() => {
    if (viewMode === "requests") fetchMyRequests();
    if (viewMode === "my_offers") fetchMyOffers();
    if (viewMode === "top_20") fetchTopOffers();
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
      if (Array.isArray(cats) && cats.length > 0) {
        cats.forEach((c: string) => {
          if (c) {
            // Split slash-separated categories into individual items
            c.split(/\s*\/\s*/).forEach((part) => {
              const trimmed = part.trim();
              if (trimmed) set.add(trimmed);
            });
          }
        });
      } else {
        const v = (o as any).category || (o as any).vertical;
        if (v) {
          // Split slash-separated categories into individual items
          v.split(/\s*\/\s*/).forEach((part: string) => {
            const trimmed = part.trim();
            if (trimmed) set.add(trimmed);
          });
        }
      }
    });
    return Array.from(set).sort();
  }, [offers]);

  // Filtered + sorted offers
  const filteredOffers = useMemo(() => {
    let list;
    if (viewMode === "my_offers") {
      list = [...myOffers];
    } else if (viewMode === "requests") {
      list = [];
    } else if (viewMode === "top_20") {
      // Use topOffersList directly — these are the admin-pinned offers with full data
      // Don't filter against main offers list (which may exclude inactive/unhealthy offers)
      list = topOffersList.map((t: any) => {
        // Try to find matching offer in main list for enriched data
        const mainOffer = offers.find((o) => String(o.offer_id || "").trim().toLowerCase() === String(t.offer_id || "").trim().toLowerCase());
        if (mainOffer) return mainOffer;
        // Otherwise use the top offer data directly
        return {
          offer_id: t.offer_id,
          name: t.name || t.offer_name || 'Unknown Offer',
          offer_name: t.name || t.offer_name || 'Unknown Offer',
          payout: t.payout || 0,
          category: t.category || t.vertical || '',
          vertical: t.vertical || t.category || '',
          countries: t.countries || [],
          status: t.status || 'active',
          network: t.network || '',
          image_url: t.image_url || '',
          devices: t.devices || t.allowed_devices || 'All',
          is_pinned: true,
          ...t
        };
      });
    } else {
      list = [...offers];
    }

    // In "available" mode, search is handled server-side, skip client-side search filter
    if (searchTerm && viewMode !== "available") {
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
        const filterLower = verticalFilter.toLowerCase();
        // Check categories array first (new system)
        const cats = (o as any).categories;
        if (Array.isArray(cats) && cats.length > 0) {
          return cats.some((c: string) => 
            c.toLowerCase() === filterLower ||
            c.split(/\s*\/\s*/).some((part) => part.trim().toLowerCase() === filterLower)
          );
        }
        // Fallback to old single category — also split on slash
        const v = (o as any).category || (o as any).vertical || "";
        return v.toLowerCase() === filterLower ||
          v.split(/\s*\/\s*/).some((part: string) => part.trim().toLowerCase() === filterLower);
      });
    }
    // Sort and merge - honor granular pinnedPosition slots and legacy pins
    if (viewMode !== "top_20") {
      const slotPinned: any[] = [];
      const legacyPinned: any[] = [];
      const organic: any[] = [];

      list.forEach((o: any) => {
        if (o.is_pinned) {
          const pos = parseInt(o.pinnedPosition, 10);
          if (!isNaN(pos) && pos > 0) {
            slotPinned.push(o);
          } else {
            legacyPinned.push(o);
          }
        } else {
          organic.push(o);
        }
      });

      // Sort groups individually
      const sortFn = (a: any, b: any) => {
        if (sortBy === "newest") return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        if (sortBy === "payout_high") return b.payout - a.payout;
        if (sortBy === "payout_low") return a.payout - b.payout;
        if (sortBy === "name") return a.name.localeCompare(b.name);
        return 0;
      };

      organic.sort(sortFn);
      legacyPinned.sort(sortFn);
      slotPinned.sort((a, b) => parseInt(a.pinnedPosition, 10) - parseInt(b.pinnedPosition, 10));

      const isFiltered = !!(searchTerm || countryFilter !== "all" || verticalFilter !== "all");

      if (isFiltered) {
        // In search/filtered views, place all matching pinned offers at the top of results
        list = [...slotPinned, ...legacyPinned, ...organic];
      } else {
        // Legacy pinned always sit at the very top of the default flow
        const baseList = [...legacyPinned, ...organic];
        const mergedList: any[] = [];
        let baseIdx = 0;
        const maxLen = baseList.length + slotPinned.length;

        const slotPinnedByPos = new Map<number, any>();
        slotPinned.forEach(o => {
          slotPinnedByPos.set(parseInt(o.pinnedPosition, 10), o);
        });

        for (let pos = 1; pos <= maxLen; pos++) {
          if (slotPinnedByPos.has(pos)) {
            mergedList.push(slotPinnedByPos.get(pos));
          } else {
            if (baseIdx < baseList.length) {
              mergedList.push(baseList[baseIdx]);
              baseIdx++;
            }
          }
        }

        while (baseIdx < baseList.length) {
          mergedList.push(baseList[baseIdx]);
          baseIdx++;
        }

        list = mergedList;
      }
    }
    return list;
  }, [offers, myOffers, topOffersList, viewMode, searchTerm, countryFilter, verticalFilter, sortBy]);

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

  // Debounced server-side search: re-fetch from backend when search term changes
  const serverSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (serverSearchTimer.current) clearTimeout(serverSearchTimer.current);
    if (viewMode !== "available") return;
    const term = searchTerm.trim();
    // If search is cleared, fetch all offers immediately
    if (term.length === 0) {
      fetchOffers(1, perPage, "");
      return;
    }
    // Debounce 300ms for smooth typing experience — triggers on 1+ chars
    if (term.length >= 1) {
      serverSearchTimer.current = setTimeout(() => {
        setPage(1);
        fetchOffers(1, perPage, term);
      }, 300);
    }
    return () => { if (serverSearchTimer.current) clearTimeout(serverSearchTimer.current); };
  }, [searchTerm, viewMode]);

  // Autocomplete: fetch suggestions as user types (300ms debounce)
  useEffect(() => {
    if (acTimer.current) clearTimeout(acTimer.current);
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
  }, [searchTerm]);

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

  // Handle autocomplete suggestion pick → just set search term and trigger immediate search
  const handleAcPick = (suggestion: AutocompleteSuggestion, position: number) => {
    setSearchTerm(suggestion.name);
    setAcOpen(false);
    setPage(1);
    // Trigger immediate server search with the picked suggestion
    if (viewMode === "available") {
      fetchOffers(1, perPage, suggestion.name);
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
      e.stopPropagation();
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

  // Handle Enter key — trigger immediate server-side search
  const handleSearchSubmit = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setAcOpen(false);
      // Cancel any pending debounced search
      if (serverSearchTimer.current) clearTimeout(serverSearchTimer.current);
      const term = searchTerm.trim();
      if (term.length >= 1 && viewMode === "available") {
        setPage(1);
        fetchOffers(1, perPage, term);
        createSession(term, acCorrected);
      } else if (term.length === 0 && viewMode === "available") {
        setPage(1);
        fetchOffers(1, perPage, "");
      }
    }
    if (e.key === 'Escape') {
      setAcOpen(false);
    }
  };

  // Split filtered offers into pinned and regular
  const pinnedOffers = useMemo(() => {
    return filteredOffers.filter(o => (o as any).is_pinned);
  }, [filteredOffers]);

  // All offers in one list - pinned offers already sorted first by backend
  const regularFilteredOffers = useMemo(() => {
    return filteredOffers;
  }, [filteredOffers]);

  // When using server-side pagination (available view), show all offers from current page
  // When using client-side (my_offers view), paginate locally
  const paginatedOffers = useMemo(() => {
    if (viewMode === "available") {
      // Server already paginated, just return filtered results from current page
      return regularFilteredOffers;
    }
    const start = (page - 1) * perPage;
    return regularFilteredOffers.slice(start, start + perPage);
  }, [regularFilteredOffers, page, viewMode]);

  const displayTotalPages = viewMode === "available" ? totalPages : Math.ceil(regularFilteredOffers.length / perPage);
  const displayTotalOffers = viewMode === "available" ? totalOffers : regularFilteredOffers.length;

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

  // Click offer name → navigate to detail page
  const handleViewDetails = (offer: PublisherOffer) => {
    // Navigate to the full offer detail page
    navigate(`/dashboard/offers/${offer.offer_id}`);
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
      } else {
        // For manual approval, optimistically show "Pending" immediately
        setOffers(prev => prev.map(o => 
          o.offer_id === applyOffer.offer_id 
            ? { ...o, request_status: 'pending' } 
            : o
        ));
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
          <Select value={viewMode} onValueChange={(v: any) => { handleSetViewMode(v); setPage(1); }}>
            <SelectTrigger className="w-[170px] h-9 text-sm border-purple-200 focus:ring-purple-400">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="available">Available Offers</SelectItem>
              <SelectItem value="requests">My Requests</SelectItem>
              <SelectItem value="my_offers">My Offers</SelectItem>
              <SelectItem value="top_20">Top 20 Offers</SelectItem>
            </SelectContent>
          </Select>

          {/* Inline search with keyword-only autocomplete (max 4) */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-purple-400 z-10" />
            <input
              ref={searchInputRef}
              placeholder="Search offers..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              onKeyDown={(e) => { 
                // If autocomplete handles Enter (highlighted item), don't also trigger search submit
                if (e.key === 'Enter' && acOpen && acHighlight >= 0) {
                  handleSearchKeyDown(e);
                } else {
                  handleSearchKeyDown(e); 
                  handleSearchSubmit(e); 
                }
              }}
              onFocus={() => { if (acSuggestions.length > 0) setAcOpen(true); }}
              className="w-full pl-8 h-9 text-sm border border-purple-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400"
              autoComplete="off"
            />
            {acLoading && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-purple-300" />}
            {searchTerm && !acLoading && (
              <button onClick={() => { setSearchTerm(''); setPage(1); if (viewMode === 'available') fetchOffers(1, perPage, ''); }} className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600">
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
                {displayTotalOffers} offers
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
              {displayTotalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-purple-200 text-purple-600 hover:bg-purple-50" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground px-1 whitespace-nowrap">{page} / {displayTotalPages}</span>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-purple-200 text-purple-600 hover:bg-purple-50" disabled={page >= displayTotalPages} onClick={() => setPage(page + 1)}>
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
                    <TableRow key={req._id || req.offer_id} className="text-sm hover:bg-purple-50/40 transition-colors cursor-pointer" onClick={() => {
                      const offerFromRequest: PublisherOffer = {
                        _id: req._id || req.offer_id,
                        offer_id: req.offer_id,
                        name: req.offer_details?.name || req.offer_name || req.offer_id,
                        payout: req.offer_details?.payout || req.payout || 0,
                        currency: 'USD',
                        network: req.offer_details?.network || '',
                        countries: [],
                        image_url: req.offer_details?.image_url || '',
                        approval_status: req.status || 'pending',
                        approval_type: 'manual',
                        has_access: req.status === 'approved',
                        access_reason: req.status === 'approved' ? 'approved' : 'pending',
                        requires_approval: true,
                        request_status: req.status,
                        requested_at: req.requested_at,
                      };
                      handleViewDetails(offerFromRequest);
                    }}>
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
                {searchTerm.trim() ? `Results for "${searchTerm.trim()}"` : 'All Offers'}
              </h2>
              {searchTerm.trim() && (
                <button onClick={() => { setSearchTerm(''); setPage(1); fetchOffers(1, perPage, ''); }} className="ml-2 text-xs text-purple-500 hover:text-purple-700 underline underline-offset-2">
                  Clear search
                </button>
              )}
            </div>

            {loading ? (
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
                              {(offer as any).payout_type === 'percentage' || (offer as any).revenue_share_percent > 0 ? `${(offer as any).revenue_share_percent || offer.payout || 0}%` : `$${offer.payout.toFixed(2)}`}
                            </span>
                          </TableCell>

                          {/* Countries */}
                          <TableCell className="py-2.5">{renderFlags(offer.countries)}</TableCell>

                          {/* Category */}
                          <TableCell className="py-2.5">
                            <span className="text-xs capitalize text-muted-foreground">
                              {(() => {
                                const cats = (offer as any).categories;
                                if (Array.isArray(cats) && cats.length > 0 && cats[0].toLowerCase() !== 'general') return cats[0];
                                const v = (offer as any).vertical;
                                if (v && v.toLowerCase() !== 'general') return v;
                                return '—';
                              })()}
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
                            {(offer as any).payout_type === 'percentage' || (offer as any).revenue_share_percent > 0 ? `${(offer as any).revenue_share_percent || offer.payout || 0}%` : `$${offer.payout.toFixed(2)}`}
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

