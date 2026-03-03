import { useState, useEffect, useMemo } from "react";
import { Search, Loader2, Clock, CheckCircle, XCircle, ChevronLeft, ChevronRight, Filter, Send, Sparkles, ExternalLink, LayoutGrid, List } from "lucide-react";
import { Input } from "@/components/ui/input";
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
import { publisherOfferApi, type PublisherOffer } from "@/services/publisherOfferApi";
import { useToast } from "@/hooks/use-toast";
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

  // Display mode
  const [displayMode, setDisplayMode] = useState<"table" | "grid">("table");

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
      const v = (o as any).vertical || (o as any).category;
      if (v) set.add(v);
    });
    return Array.from(set).sort();
  }, [offers]);

  // Filtered + sorted offers
  const filteredOffers = useMemo(() => {
    let list = viewMode === "my_offers" ? [...myOffers] : viewMode === "requests" ? [] : [...offers];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter((o) => o.name.toLowerCase().includes(q) || o.offer_id.toLowerCase().includes(q) || o.network?.toLowerCase().includes(q));
    }
    if (countryFilter !== "all") {
      list = list.filter((o) => o.countries?.some((c) => c.toUpperCase() === countryFilter));
    }
    if (verticalFilter !== "all") {
      list = list.filter((o) => {
        const v = (o as any).vertical || (o as any).category || "";
        return v.toLowerCase() === verticalFilter.toLowerCase();
      });
    }
    // Sort
    if (sortBy === "newest") list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    else if (sortBy === "payout_high") list.sort((a, b) => b.payout - a.payout);
    else if (sortBy === "payout_low") list.sort((a, b) => a.payout - b.payout);
    else if (sortBy === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [offers, myOffers, viewMode, searchTerm, countryFilter, verticalFilter, sortBy]);

  // Paginated
  const paginatedOffers = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredOffers.slice(start, start + perPage);
  }, [filteredOffers, page]);

  const totalPages = Math.ceil(filteredOffers.length / perPage);

  // Track dashboard click
  const trackDashboardClick = async (offerId: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/publisher/offers/${offerId}/track-click`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, "Content-Type": "application/json" },
      });
    } catch {}
  };

  // Click offer name → open details modal
  const handleViewDetails = (offer: PublisherOffer) => {
    setSelectedOffer(offer);
    setDetailsModalOpen(true);
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
      return;
    }
    // Send request without proof
    setApplyLoading(true);
    try {
      await publisherOfferApi.requestOfferAccess(applyOffer.offer_id, "");
      setApplyPopupOpen(false);
      setSuccessPopupOpen(true);
      fetchMyRequests();
      fetchOffers();
    } catch (err: any) {
      toast({ title: "Failed", description: err.response?.data?.error || err.message, variant: "destructive" });
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

          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-purple-400" />
            <Input
              placeholder="Search offers..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              className="pl-8 h-9 text-sm border-purple-200 focus-visible:ring-purple-400"
            />
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
                      <TableCell className="py-2.5 font-medium">{req.offer_name || req.offer_id}</TableCell>
                      <TableCell className="py-2.5 font-semibold text-green-600">${(req.payout || 0).toFixed(2)}</TableCell>
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
                      <TableHead className="py-3 text-xs font-semibold text-purple-700 uppercase tracking-wider w-[80px]">Date</TableHead>
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
                            <span className="font-bold text-emerald-600">${offer.payout.toFixed(2)}</span>
                          </TableCell>

                          {/* Countries */}
                          <TableCell className="py-2.5">{renderFlags(offer.countries)}</TableCell>

                          {/* Date */}
                          <TableCell className="py-2.5">
                            <span className="text-xs text-muted-foreground">
                              {offer.created_at ? new Date(offer.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
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
                                onClick={() => { trackDashboardClick(offer.offer_id); handleViewDetails(offer); }}>
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
                          <span className="font-bold text-lg text-emerald-600">${offer.payout.toFixed(2)}</span>
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
                              onClick={() => { trackDashboardClick(offer.offer_id); handleViewDetails(offer); }}
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
              <p className="text-lg font-semibold animate-in fade-in duration-500">Request Sent</p>
              <p className="text-sm text-muted-foreground">Your request has been submitted. You'll be notified once it's reviewed.</p>
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
