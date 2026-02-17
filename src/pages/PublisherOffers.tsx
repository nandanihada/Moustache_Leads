import { useState, useEffect } from "react";
import { Search, Loader2, AlertCircle, Info, UserCheck, Clock, CheckCircle, XCircle, ChevronLeft, ChevronRight, Globe, LayoutGrid, List, Eye, ExternalLink, Smartphone, Monitor, Laptop } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { publisherOfferApi, type PublisherOffer } from "@/services/publisherOfferApi";
import { useToast } from "@/hooks/use-toast";
import OfferDetailsModalNew from "@/components/OfferDetailsModalNew";
import OfferCardWithApproval from "@/components/OfferCardWithApproval";
import { API_BASE_URL } from "@/services/apiConfig";
import { useAuth } from "@/contexts/AuthContext";
import PlacementRequired from "@/components/PlacementRequired";
import { getOfferImage } from "@/utils/categoryImages";

const PublisherOffersContent = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchBy, setSearchBy] = useState("name");
  const [sortBy, setSortBy] = useState("newest");
  const [countryFilter, setCountryFilter] = useState("all");
  const [verticalFilter, setVerticalFilter] = useState("all");
  const [viewMode, setViewMode] = useState<'card' | 'table'>('table');
  const [offers, setOffers] = useState<PublisherOffer[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [myOffers, setMyOffers] = useState<PublisherOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [myOffersLoading, setMyOffersLoading] = useState(false);
  // My Offers tab filters
  const [myOffersSearchTerm, setMyOffersSearchTerm] = useState("");
  const [myOffersSearchBy, setMyOffersSearchBy] = useState("name");
  const [myOffersSortBy, setMyOffersSortBy] = useState("newest");
  const [myOffersCountryFilter, setMyOffersCountryFilter] = useState("all");
  const [myOffersVerticalFilter, setMyOffersVerticalFilter] = useState("all");
  const [myOffersViewMode, setMyOffersViewMode] = useState<'card' | 'table'>('table');
  const [myOffersPerPage, setMyOffersPerPage] = useState<number>(20);
  const [myOffersCurrentPage, setMyOffersCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<PublisherOffer | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("offers");
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 500,  // Load more offers so filtering works across all offers
    total: 0,
    pages: 0
  });
  const { toast } = useToast();
  const { user } = useAuth();

  // Track dashboard click when user views an offer
  const trackDashboardClick = async (offer: PublisherOffer) => {
    try {
      await fetch(`${API_BASE_URL}/api/dashboard/track-click`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          offer_id: offer.offer_id,
          offer_name: offer.name,
          user_id: user?.id || user?._id || 'anonymous',
          user_email: user?.email || '',
          user_role: user?.role || 'publisher',
        }),
      });
      console.log('📊 Dashboard click tracked for offer:', offer.offer_id);
    } catch (error) {
      console.error('Failed to track dashboard click:', error);
      // Don't show error to user - tracking failure shouldn't block UX
    }
  };

  useEffect(() => {
    fetchOffers();
  }, [pagination.page, pagination.per_page]);

  const fetchOffers = async () => {
    console.log('🔍 fetchOffers: Starting...');
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 fetchOffers: Calling API...');
      // Fetch offers with pagination
      const response = await publisherOfferApi.getAvailableOffers({
        status: 'active',
        page: pagination.page,
        per_page: pagination.per_page
      });
      
      console.log('✅ fetchOffers: Success!', response);
      setOffers(response.offers || []);
      if (response.pagination) {
        setPagination(prev => ({
          ...prev,
          total: response.pagination.total || 0,
          pages: response.pagination.pages || 0
        }));
      }
    } catch (err: any) {
      console.error('❌ fetchOffers: Error!', err);
      console.error('Error details:', {
        message: err.message,
        code: err.code,
        response: err.response,
        stack: err.stack
      });
      setError(err.message || 'Failed to fetch offers');
      toast({
        title: "Error",
        description: "Failed to load offers. Please try again.",
        variant: "destructive",
      });
    } finally {
      console.log('🔍 fetchOffers: Finished');
      setLoading(false);
    }
  };

  // Log unique categories when offers load (for debugging)
  useEffect(() => {
    if (offers.length > 0) {
      const uniqueCategories = [...new Set(offers.map(o => (o as any).vertical || o.category || 'UNKNOWN'))];
      console.log('📊 Available Offers - Unique categories:', uniqueCategories);
    }
  }, [offers]);

  useEffect(() => {
    if (myOffers.length > 0) {
      const uniqueCategories = [...new Set(myOffers.map(o => (o as any).vertical || o.category || 'UNKNOWN'))];
      console.log('📊 My Offers - Unique categories:', uniqueCategories);
    }
  }, [myOffers]);

  const filteredOffers = offers.filter((offer) => {
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      let matchesSearch = false;
      switch (searchBy) {
        case "name":
          matchesSearch = offer.name.toLowerCase().includes(term);
          break;
        case "id":
          matchesSearch = offer.offer_id.toLowerCase().includes(term);
          break;
        case "vertical":
          matchesSearch = ((offer as any).vertical || offer.category || "").toLowerCase().includes(term);
          break;
        default:
          matchesSearch = true;
      }
      if (!matchesSearch) return false;
    }
    
    // Country filter
    if (countryFilter !== 'all') {
      const offerCountries = (offer as any).countries || [];
      if (!offerCountries.some((c: string) => c.toUpperCase() === countryFilter.toUpperCase())) {
        return false;
      }
    }
    
    // Vertical/Category filter - simplified logic
    if (verticalFilter !== 'all') {
      const rawVertical = ((offer as any).vertical || offer.category || '').toString().toUpperCase().trim();
      const filterValue = verticalFilter.toUpperCase().trim();
      
      // Direct match first
      if (rawVertical === filterValue) {
        return true;
      }
      
      // Category mappings for flexible matching
      const categoryMappings: Record<string, string[]> = {
        'HEALTH': ['HEALTH', 'HEALTHCARE', 'MEDICAL', 'HEALTH_&_BEAUTY', 'HEALTH AND BEAUTY', 'BEAUTY', 'WELLNESS', 'FITNESS'],
        'SURVEY': ['SURVEY', 'SURVEYS'],
        'SWEEPSTAKES': ['SWEEPSTAKES', 'SWEEPS', 'SWEEPSTAKE', 'GIVEAWAY', 'PRIZE', 'LOTTERY', 'RAFFLE', 'CONTEST'],
        'EDUCATION': ['EDUCATION', 'LEARNING', 'EDU', 'COURSE', 'COURSES', 'TRAINING'],
        'INSURANCE': ['INSURANCE', 'INSUR', 'POLICY', 'COVERAGE'],
        'LOAN': ['LOAN', 'LOANS', 'LENDING', 'CREDIT', 'PERSONAL LOAN', 'HOME LOAN'],
        'FINANCE': ['FINANCE', 'FINANCIAL', 'BANKING', 'INVESTMENT', 'CRYPTO', 'CRYPTOCURRENCY', 'TRADING', 'STOCKS', 'FOREX', 'BANK', 'MONEY'],
        'DATING': ['DATING', 'RELATIONSHIPS', 'SOCIAL', 'ADULT', 'ROMANCE', 'SINGLES', 'MATCH', 'MATCHMAKING'],
        'FREE_TRIAL': ['FREE_TRIAL', 'FREE TRIAL', 'FREETRIAL', 'TRIAL', 'TRIALS', 'DEMO', 'SAMPLE'],
        'INSTALLS': ['INSTALLS', 'INSTALL', 'APP', 'APPS', 'MOBILE', 'APPLICATION', 'DOWNLOAD', 'SOFTWARE'],
        'GAMES_INSTALL': ['GAMES_INSTALL', 'GAMES INSTALL', 'GAMESINSTALL', 'GAME', 'GAMES', 'GAMING', 'CASINO', 'GAMBLING', 'IGAMING', 'GAME INSTALL', 'MOBILE GAME', 'PLAY'],
        'OTHER': ['OTHER', 'LIFESTYLE', 'ENTERTAINMENT', 'TRAVEL', 'UTILITIES', 'E-COMMERCE', 'ECOMMERCE', 'SHOPPING', 'VIDEO', 'SIGNUP', 'GENERAL', 'MISC', 'MISCELLANEOUS', 'UNKNOWN']
      };
      
      const matchingCategories = categoryMappings[filterValue] || [filterValue];
      const matchesCategory = matchingCategories.some(cat => 
        rawVertical === cat || rawVertical.includes(cat) || cat.includes(rawVertical)
      );
      
      if (!matchesCategory) {
        return false;
      }
    }
    
    return true;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'id_asc':
        return (a.offer_id || '').localeCompare(b.offer_id || '');
      case 'id_desc':
        return (b.offer_id || '').localeCompare(a.offer_id || '');
      case 'payout_high':
        return (b.payout || 0) - (a.payout || 0);
      case 'payout_low':
        return (a.payout || 0) - (b.payout || 0);
      case 'title_az':
        return (a.name || '').localeCompare(b.name || '');
      case 'title_za':
        return (b.name || '').localeCompare(a.name || '');
      case 'newest':
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      case 'oldest':
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      default:
        return 0;
    }
  });

  // Filter and sort My Offers
  const filteredMyOffersAll = myOffers.filter((offer) => {
    // Search filter
    if (myOffersSearchTerm) {
      const term = myOffersSearchTerm.toLowerCase();
      let matchesSearch = false;
      switch (myOffersSearchBy) {
        case "name":
          matchesSearch = offer.name.toLowerCase().includes(term);
          break;
        case "id":
          matchesSearch = offer.offer_id.toLowerCase().includes(term);
          break;
        case "vertical":
          matchesSearch = ((offer as any).vertical || offer.category || "").toLowerCase().includes(term);
          break;
        default:
          matchesSearch = true;
      }
      if (!matchesSearch) return false;
    }
    
    // Country filter
    if (myOffersCountryFilter !== 'all') {
      const offerCountries = (offer as any).countries || [];
      if (!offerCountries.some((c: string) => c.toUpperCase() === myOffersCountryFilter.toUpperCase())) {
        return false;
      }
    }
    
    // Vertical/Category filter - simplified logic
    if (myOffersVerticalFilter !== 'all') {
      const rawVertical = ((offer as any).vertical || offer.category || '').toString().toUpperCase().trim();
      const filterValue = myOffersVerticalFilter.toUpperCase().trim();
      
      // Direct match first
      if (rawVertical === filterValue) {
        return true;
      }
      
      // Category mappings for flexible matching
      const categoryMappings: Record<string, string[]> = {
        'HEALTH': ['HEALTH', 'HEALTHCARE', 'MEDICAL', 'HEALTH_&_BEAUTY', 'HEALTH AND BEAUTY', 'BEAUTY', 'WELLNESS', 'FITNESS'],
        'SURVEY': ['SURVEY', 'SURVEYS'],
        'SWEEPSTAKES': ['SWEEPSTAKES', 'SWEEPS', 'SWEEPSTAKE', 'GIVEAWAY', 'PRIZE', 'LOTTERY', 'RAFFLE', 'CONTEST'],
        'EDUCATION': ['EDUCATION', 'LEARNING', 'EDU', 'COURSE', 'COURSES', 'TRAINING'],
        'INSURANCE': ['INSURANCE', 'INSUR', 'POLICY', 'COVERAGE'],
        'LOAN': ['LOAN', 'LOANS', 'LENDING', 'CREDIT', 'PERSONAL LOAN', 'HOME LOAN'],
        'FINANCE': ['FINANCE', 'FINANCIAL', 'BANKING', 'INVESTMENT', 'CRYPTO', 'CRYPTOCURRENCY', 'TRADING', 'STOCKS', 'FOREX', 'BANK', 'MONEY'],
        'DATING': ['DATING', 'RELATIONSHIPS', 'SOCIAL', 'ADULT', 'ROMANCE', 'SINGLES', 'MATCH', 'MATCHMAKING'],
        'FREE_TRIAL': ['FREE_TRIAL', 'FREE TRIAL', 'FREETRIAL', 'TRIAL', 'TRIALS', 'DEMO', 'SAMPLE'],
        'INSTALLS': ['INSTALLS', 'INSTALL', 'APP', 'APPS', 'MOBILE', 'APPLICATION', 'DOWNLOAD', 'SOFTWARE'],
        'GAMES_INSTALL': ['GAMES_INSTALL', 'GAMES INSTALL', 'GAMESINSTALL', 'GAME', 'GAMES', 'GAMING', 'CASINO', 'GAMBLING', 'IGAMING', 'GAME INSTALL', 'MOBILE GAME', 'PLAY'],
        'OTHER': ['OTHER', 'LIFESTYLE', 'ENTERTAINMENT', 'TRAVEL', 'UTILITIES', 'E-COMMERCE', 'ECOMMERCE', 'SHOPPING', 'VIDEO', 'SIGNUP', 'GENERAL', 'MISC', 'MISCELLANEOUS', 'UNKNOWN']
      };
      
      const matchingCategories = categoryMappings[filterValue] || [filterValue];
      const matchesCategory = matchingCategories.some(cat => 
        rawVertical === cat || rawVertical.includes(cat) || cat.includes(rawVertical)
      );
      
      if (!matchesCategory) return false;
    }
    
    return true;
  }).sort((a, b) => {
    switch (myOffersSortBy) {
      case 'id_asc':
        return (a.offer_id || '').localeCompare(b.offer_id || '');
      case 'id_desc':
        return (b.offer_id || '').localeCompare(a.offer_id || '');
      case 'payout_high':
        return (b.payout || 0) - (a.payout || 0);
      case 'payout_low':
        return (a.payout || 0) - (b.payout || 0);
      case 'title_az':
        return (a.name || '').localeCompare(b.name || '');
      case 'title_za':
        return (b.name || '').localeCompare(a.name || '');
      case 'newest':
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      case 'oldest':
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      default:
        return 0;
    }
  });

  // Pagination for My Offers
  const myOffersTotalPages = myOffersPerPage === -1 ? 1 : Math.ceil(filteredMyOffersAll.length / myOffersPerPage);
  const filteredMyOffers = myOffersPerPage === -1 
    ? filteredMyOffersAll 
    : filteredMyOffersAll.slice((myOffersCurrentPage - 1) * myOffersPerPage, myOffersCurrentPage * myOffersPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setMyOffersCurrentPage(1);
  }, [myOffersSearchTerm, myOffersSearchBy, myOffersSortBy, myOffersCountryFilter, myOffersVerticalFilter, myOffersPerPage]);

  const fetchMyRequests = async () => {
    try {
      setRequestsLoading(true);
      const response = await publisherOfferApi.getMyAccessRequests({
        page: 1,
        per_page: 50
      });
      setMyRequests(response.requests || []);
    } catch (err: any) {
      console.error('Error fetching requests:', err);
      toast({
        title: "Error",
        description: "Failed to load your requests. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRequestsLoading(false);
    }
  };

  const fetchMyOffers = async () => {
    try {
      setMyOffersLoading(true);
      // Fetch offers that the user has access to (approved requests or auto-approved)
      const response = await publisherOfferApi.getAvailableOffers({
        status: 'active',
        page: 1,
        per_page: 200
      });
      
      // Filter to only show offers the user has access to
      const accessibleOffers = (response.offers || []).filter((offer: PublisherOffer) => 
        (offer as any).has_access === true && !(offer as any).is_locked
      );
      
      setMyOffers(accessibleOffers);
    } catch (err: any) {
      console.error('Error fetching my offers:', err);
      toast({
        title: "Error",
        description: "Failed to load your offers. Please try again.",
        variant: "destructive",
      });
    } finally {
      setMyOffersLoading(false);
    }
  };

  const handleViewDetails = (offer: PublisherOffer) => {
    // Track the click before showing details
    trackDashboardClick(offer);
    setSelectedOffer(offer);
    setModalOpen(true);
  };

  const handleAccessGranted = () => {
    // Refresh offers and requests when access is granted
    fetchOffers();
    if (activeTab === 'requests') {
      fetchMyRequests();
    }
  };

  // Load requests when switching to requests tab
  useEffect(() => {
    if (activeTab === 'requests' && myRequests.length === 0) {
      fetchMyRequests();
    }
    if (activeTab === 'myoffers' && myOffers.length === 0) {
      fetchMyOffers();
    }
  }, [activeTab]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Available Offers</h1>
        <p className="text-muted-foreground">Browse and promote offers to earn commissions</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="offers">Available Offers</TabsTrigger>
          <TabsTrigger value="requests">My Requests</TabsTrigger>
          <TabsTrigger value="myoffers">My Offers</TabsTrigger>
        </TabsList>

        <TabsContent value="offers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>🎯 Active Offers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search Controls */}
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[200px] relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search offers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={searchBy} onValueChange={setSearchBy}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Search by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="id">Offer ID</SelectItem>
                    <SelectItem value="vertical">Vertical</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={verticalFilter} onValueChange={setVerticalFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="HEALTH">💊 Health</SelectItem>
                    <SelectItem value="SURVEY">📋 Survey</SelectItem>
                    <SelectItem value="SWEEPSTAKES">🎰 Sweepstakes</SelectItem>
                    <SelectItem value="EDUCATION">📚 Education</SelectItem>
                    <SelectItem value="INSURANCE">🛡️ Insurance</SelectItem>
                    <SelectItem value="LOAN">💳 Loan</SelectItem>
                    <SelectItem value="FINANCE">💰 Finance</SelectItem>
                    <SelectItem value="DATING">❤️ Dating</SelectItem>
                    <SelectItem value="FREE_TRIAL">🎁 Free Trial</SelectItem>
                    <SelectItem value="INSTALLS">📲 Installs</SelectItem>
                    <SelectItem value="GAMES_INSTALL">🎮 Games Install</SelectItem>
                    <SelectItem value="OTHER">📦 Other</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="id_asc">ID (A → Z)</SelectItem>
                    <SelectItem value="id_desc">ID (Z → A)</SelectItem>
                    <SelectItem value="payout_high">Payout (Highest)</SelectItem>
                    <SelectItem value="payout_low">Payout (Lowest)</SelectItem>
                    <SelectItem value="title_az">Title (A → Z)</SelectItem>
                    <SelectItem value="title_za">Title (Z → A)</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={countryFilter} onValueChange={setCountryFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Country" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    <SelectItem value="all">All Countries</SelectItem>
                    <SelectItem value="US">🇺🇸 United States</SelectItem>
                    <SelectItem value="GB">🇬🇧 United Kingdom</SelectItem>
                    <SelectItem value="CA">🇨🇦 Canada</SelectItem>
                    <SelectItem value="AU">🇦🇺 Australia</SelectItem>
                    <SelectItem value="DE">🇩🇪 Germany</SelectItem>
                    <SelectItem value="FR">🇫🇷 France</SelectItem>
                    <SelectItem value="ES">🇪🇸 Spain</SelectItem>
                    <SelectItem value="IT">🇮🇹 Italy</SelectItem>
                    <SelectItem value="NL">🇳🇱 Netherlands</SelectItem>
                    <SelectItem value="BE">🇧🇪 Belgium</SelectItem>
                    <SelectItem value="AT">🇦🇹 Austria</SelectItem>
                    <SelectItem value="CH">🇨🇭 Switzerland</SelectItem>
                    <SelectItem value="SE">🇸🇪 Sweden</SelectItem>
                    <SelectItem value="NO">🇳🇴 Norway</SelectItem>
                    <SelectItem value="DK">🇩🇰 Denmark</SelectItem>
                    <SelectItem value="FI">🇫🇮 Finland</SelectItem>
                    <SelectItem value="PL">🇵🇱 Poland</SelectItem>
                    <SelectItem value="BR">🇧🇷 Brazil</SelectItem>
                    <SelectItem value="MX">🇲🇽 Mexico</SelectItem>
                    <SelectItem value="IN">🇮🇳 India</SelectItem>
                    <SelectItem value="JP">🇯🇵 Japan</SelectItem>
                    <SelectItem value="KR">🇰🇷 South Korea</SelectItem>
                    <SelectItem value="SG">🇸🇬 Singapore</SelectItem>
                    <SelectItem value="NZ">🇳🇿 New Zealand</SelectItem>
                    <SelectItem value="ZA">🇿🇦 South Africa</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={fetchOffers} variant="outline" size="sm">
                  Refresh
                </Button>
                <div className="flex items-center border rounded-md">
                  <Button
                    variant={viewMode === 'card' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('card')}
                    className="rounded-r-none"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'table' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('table')}
                    className="rounded-l-none"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Loading offers...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {error}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="ml-4"
                  onClick={fetchOffers}
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Empty State */}
          {!loading && !error && filteredOffers.length === 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>No offers found</AlertTitle>
              <AlertDescription>
                {searchTerm ? 'No offers match your search criteria.' : 'No active offers available at the moment.'}
              </AlertDescription>
            </Alert>
          )}

              {/* Offers Display - Card or Table View */}
              {!loading && !error && filteredOffers.length > 0 && (
                <>
                  {viewMode === 'card' ? (
                    /* Card Grid View */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredOffers.map((offer) => (
                        <OfferCardWithApproval
                          key={offer.offer_id}
                          offer={offer}
                          onViewDetails={handleViewDetails}
                          onAccessGranted={handleAccessGranted}
                        />
                      ))}
                    </div>
                  ) : (
                    /* Table View */
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Image</TableHead>
                            <TableHead>Offer ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Vertical</TableHead>
                            <TableHead>Countries</TableHead>
                            <TableHead>Payout</TableHead>
                            <TableHead>Traffic Sources</TableHead>
                            <TableHead>Device</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredOffers.map((offer) => (
                            <TableRow key={offer.offer_id}>
                              <TableCell>
                                <img
                                  src={getOfferImage(offer as any)}
                                  alt={offer.name}
                                  className="w-12 h-12 object-cover rounded border"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    // Try to use a placeholder instead of hiding
                                    target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect fill="%23e5e7eb" width="48" height="48"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="10">No Img</text></svg>';
                                  }}
                                />
                              </TableCell>
                              <TableCell className="font-mono text-sm">{offer.offer_id}</TableCell>
                              <TableCell>
                                <div className="max-w-[200px]">
                                  <div className="font-medium truncate">{offer.name}</div>
                                  {offer.description && (
                                    <div className="text-xs text-muted-foreground truncate">{offer.description}</div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {(offer as any).vertical || offer.category || 'Lifestyle'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1 flex-wrap max-w-[120px]">
                                  {((offer as any).countries || []).slice(0, 3).map((country: string) => (
                                    <Badge key={country} variant="secondary" className="text-xs">
                                      {country}
                                    </Badge>
                                  ))}
                                  {((offer as any).countries || []).length > 3 && (
                                    <Badge variant="secondary" className="text-xs">
                                      +{((offer as any).countries || []).length - 3}
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="font-medium text-green-600">
                                ${offer.payout?.toFixed(2) || '0.00'}
                              </TableCell>
                              <TableCell>
                                <TooltipProvider>
                                  <div className="flex flex-wrap gap-1 max-w-[150px]">
                                    {((offer as any).allowed_traffic_sources || []).slice(0, 2).map((source: string) => (
                                      <Tooltip key={source}>
                                        <TooltipTrigger>
                                          <Badge variant="outline" className="bg-green-50 text-green-700 text-xs">
                                            {source}
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>Allowed</TooltipContent>
                                      </Tooltip>
                                    ))}
                                    {((offer as any).allowed_traffic_sources || []).length > 2 && (
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <Badge variant="outline" className="text-xs">
                                            +{((offer as any).allowed_traffic_sources || []).length - 2}
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <div className="text-xs">
                                            <div className="font-semibold mb-1">Allowed:</div>
                                            {((offer as any).allowed_traffic_sources || []).join(', ')}
                                            {((offer as any).disallowed_traffic_sources || []).length > 0 && (
                                              <>
                                                <div className="font-semibold mt-2 mb-1 text-red-400">Disallowed:</div>
                                                {((offer as any).disallowed_traffic_sources || []).join(', ')}
                                              </>
                                            )}
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                  </div>
                                </TooltipProvider>
                              </TableCell>
                              <TableCell>
                                {(offer as any).device_targeting === 'mobile' ? (
                                  <Smartphone className="h-4 w-4 text-blue-500" />
                                ) : (offer as any).device_targeting === 'desktop' ? (
                                  <Monitor className="h-4 w-4 text-gray-500" />
                                ) : (
                                  <Laptop className="h-4 w-4 text-purple-500" />
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleViewDetails(offer)}
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    Details
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      // Open tracking link instead of preview URL
                                      const hostname = window.location.hostname;
                                      let baseUrl = 'http://localhost:5000';
                                      if (hostname.includes('moustacheleads.com') || hostname.includes('vercel.app') || hostname.includes('onrender.com')) {
                                        baseUrl = 'https://offers.moustacheleads.com';
                                      }
                                      let userId = '';
                                      try {
                                        const userStr = localStorage.getItem('user');
                                        if (userStr) {
                                          const user = JSON.parse(userStr);
                                          userId = user._id || user.id || '';
                                        }
                                      } catch (e) {}
                                      const trackingUrl = `${baseUrl}/track/${offer.offer_id}?user_id=${userId}&sub1=default`;
                                      window.open(trackingUrl, '_blank');
                                    }}
                                    title="Open tracking link"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </>
              )}

              {/* Results Count & Pagination */}
              {!loading && filteredOffers.length > 0 && (
                <div className="pt-4 border-t space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-muted-foreground">
                        Showing {((pagination.page - 1) * pagination.per_page) + 1} to {Math.min(pagination.page * pagination.per_page, pagination.total)} of {pagination.total} offers
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Show:</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              {pagination.per_page} per page
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => setPagination(prev => ({ ...prev, per_page: 50, page: 1 }))}>
                              50 per page
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setPagination(prev => ({ ...prev, per_page: 100, page: 1 }))}>
                              100 per page
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setPagination(prev => ({ ...prev, per_page: 200, page: 1 }))}>
                              200 per page
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setPagination(prev => ({ ...prev, per_page: 500, page: 1 }))}>
                              500 per page
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setPagination(prev => ({ ...prev, per_page: pagination.total || 1000, page: 1 }))}>
                              Show All ({pagination.total})
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    {pagination.pages > 1 && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                          disabled={pagination.page === 1 || loading}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                            let pageNum;
                            if (pagination.pages <= 5) {
                              pageNum = i + 1;
                            } else if (pagination.page <= 3) {
                              pageNum = i + 1;
                            } else if (pagination.page >= pagination.pages - 2) {
                              pageNum = pagination.pages - 4 + i;
                            } else {
                              pageNum = pagination.page - 2 + i;
                            }
                            return (
                              <Button
                                key={pageNum}
                                variant={pagination.page === pageNum ? "default" : "outline"}
                                size="sm"
                                onClick={() => setPagination(prev => ({ ...prev, page: pageNum }))}
                                disabled={loading}
                                className="w-10"
                              >
                                {pageNum}
                              </Button>
                            );
                          })}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                          disabled={pagination.page === pagination.pages || loading}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="w-5 h-5" />
                My Access Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Loading State */}
              {requestsLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-3 text-muted-foreground">Loading requests...</span>
                </div>
              )}

              {/* Empty State */}
              {!requestsLoading && myRequests.length === 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>No requests found</AlertTitle>
                  <AlertDescription>
                    You haven't submitted any access requests yet.
                  </AlertDescription>
                </Alert>
              )}

              {/* Requests List */}
              {!requestsLoading && myRequests.length > 0 && (
                <div className="space-y-4">
                  {myRequests.map((request) => (
                    <Card key={request._id} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-medium text-lg mb-1">
                              {request.offer_details?.name || request.offer_id}
                            </h3>
                            <div className="text-sm text-muted-foreground mb-2">
                              Offer ID: {request.offer_id} • Payout: ${request.offer_details?.payout}
                            </div>
                            {request.message && (
                              <div className="text-sm mb-2">
                                <span className="font-medium">Message:</span> {request.message}
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground">
                              Requested: {new Date(request.requested_at).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {request.status === 'pending' && (
                              <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                                <Clock className="w-3 h-3 mr-1" />
                                Pending
                              </Badge>
                            )}
                            {request.status === 'approved' && (
                              <Badge variant="outline" className="text-green-600 border-green-600">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Approved
                              </Badge>
                            )}
                            {request.status === 'rejected' && (
                              <Badge variant="outline" className="text-red-600 border-red-600">
                                <XCircle className="w-3 h-3 mr-1" />
                                Rejected
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="myoffers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                My Offers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filter Controls */}
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[200px] relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search your offers..."
                    value={myOffersSearchTerm}
                    onChange={(e) => setMyOffersSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={myOffersSearchBy} onValueChange={setMyOffersSearchBy}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Search by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="id">Offer ID</SelectItem>
                    <SelectItem value="vertical">Vertical</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={myOffersVerticalFilter} onValueChange={setMyOffersVerticalFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="HEALTH">💊 Health</SelectItem>
                    <SelectItem value="SURVEY">📋 Survey</SelectItem>
                    <SelectItem value="SWEEPSTAKES">🎰 Sweepstakes</SelectItem>
                    <SelectItem value="EDUCATION">📚 Education</SelectItem>
                    <SelectItem value="INSURANCE">🛡️ Insurance</SelectItem>
                    <SelectItem value="LOAN">💳 Loan</SelectItem>
                    <SelectItem value="FINANCE">💰 Finance</SelectItem>
                    <SelectItem value="DATING">❤️ Dating</SelectItem>
                    <SelectItem value="FREE_TRIAL">🎁 Free Trial</SelectItem>
                    <SelectItem value="INSTALLS">📲 Installs</SelectItem>
                    <SelectItem value="GAMES_INSTALL">🎮 Games Install</SelectItem>
                    <SelectItem value="OTHER">📦 Other</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={myOffersSortBy} onValueChange={setMyOffersSortBy}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="id_asc">ID (A → Z)</SelectItem>
                    <SelectItem value="id_desc">ID (Z → A)</SelectItem>
                    <SelectItem value="payout_high">Payout (Highest)</SelectItem>
                    <SelectItem value="payout_low">Payout (Lowest)</SelectItem>
                    <SelectItem value="title_az">Title (A → Z)</SelectItem>
                    <SelectItem value="title_za">Title (Z → A)</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={myOffersCountryFilter} onValueChange={setMyOffersCountryFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Country" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    <SelectItem value="all">All Countries</SelectItem>
                    <SelectItem value="US">🇺🇸 United States</SelectItem>
                    <SelectItem value="GB">🇬🇧 United Kingdom</SelectItem>
                    <SelectItem value="CA">🇨🇦 Canada</SelectItem>
                    <SelectItem value="AU">🇦🇺 Australia</SelectItem>
                    <SelectItem value="DE">🇩🇪 Germany</SelectItem>
                    <SelectItem value="FR">🇫🇷 France</SelectItem>
                    <SelectItem value="ES">🇪🇸 Spain</SelectItem>
                    <SelectItem value="IT">🇮🇹 Italy</SelectItem>
                    <SelectItem value="NL">🇳🇱 Netherlands</SelectItem>
                    <SelectItem value="BE">🇧🇪 Belgium</SelectItem>
                    <SelectItem value="AT">🇦🇹 Austria</SelectItem>
                    <SelectItem value="CH">🇨🇭 Switzerland</SelectItem>
                    <SelectItem value="SE">🇸🇪 Sweden</SelectItem>
                    <SelectItem value="NO">🇳🇴 Norway</SelectItem>
                    <SelectItem value="DK">🇩🇰 Denmark</SelectItem>
                    <SelectItem value="FI">🇫🇮 Finland</SelectItem>
                    <SelectItem value="PL">🇵🇱 Poland</SelectItem>
                    <SelectItem value="BR">🇧🇷 Brazil</SelectItem>
                    <SelectItem value="MX">🇲🇽 Mexico</SelectItem>
                    <SelectItem value="IN">🇮🇳 India</SelectItem>
                    <SelectItem value="JP">🇯🇵 Japan</SelectItem>
                    <SelectItem value="KR">🇰🇷 South Korea</SelectItem>
                    <SelectItem value="SG">🇸🇬 Singapore</SelectItem>
                    <SelectItem value="NZ">🇳🇿 New Zealand</SelectItem>
                    <SelectItem value="ZA">🇿🇦 South Africa</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={fetchMyOffers} variant="outline" size="sm">
                  Refresh
                </Button>
                <div className="flex items-center border rounded-md">
                  <Button
                    variant={myOffersViewMode === 'card' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setMyOffersViewMode('card')}
                    className="rounded-r-none"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={myOffersViewMode === 'table' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setMyOffersViewMode('table')}
                    className="rounded-l-none"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Loading State */}
              {myOffersLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-3 text-muted-foreground">Loading your offers...</span>
                </div>
              )}

              {/* Empty State */}
              {!myOffersLoading && filteredMyOffers.length === 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>No offers found</AlertTitle>
                  <AlertDescription>
                    {myOffersSearchTerm || myOffersVerticalFilter !== 'all' || myOffersCountryFilter !== 'all'
                      ? 'No offers match your filter criteria.'
                      : "You don't have access to any offers yet. Browse available offers and request access to get started."}
                  </AlertDescription>
                </Alert>
              )}

              {/* My Offers Display */}
              {!myOffersLoading && filteredMyOffers.length > 0 && (
                <>
                  {myOffersViewMode === 'card' ? (
                    /* Card Grid View */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredMyOffers.map((offer) => (
                        <OfferCardWithApproval
                          key={offer.offer_id}
                          offer={offer}
                          onViewDetails={handleViewDetails}
                          onAccessGranted={handleAccessGranted}
                        />
                      ))}
                    </div>
                  ) : (
                    /* Table View */
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Image</TableHead>
                            <TableHead>Offer ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Vertical</TableHead>
                            <TableHead>Countries</TableHead>
                            <TableHead>Payout</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredMyOffers.map((offer) => (
                            <TableRow key={offer.offer_id}>
                              <TableCell>
                                <img
                                  src={getOfferImage(offer as any)}
                                  alt={offer.name}
                                  className="w-12 h-12 object-cover rounded border"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    // Try to use a placeholder instead of hiding
                                    target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect fill="%23e5e7eb" width="48" height="48"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="10">No Img</text></svg>';
                                  }}
                                />
                              </TableCell>
                              <TableCell className="font-mono text-sm">{offer.offer_id}</TableCell>
                              <TableCell>
                                <div className="max-w-[200px]">
                                  <div className="font-medium truncate">{offer.name}</div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {(offer as any).vertical || offer.category || 'Other'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1 flex-wrap max-w-[120px]">
                                  {((offer as any).countries || []).slice(0, 3).map((country: string) => (
                                    <Badge key={country} variant="secondary" className="text-xs">
                                      {country}
                                    </Badge>
                                  ))}
                                  {((offer as any).countries || []).length > 3 && (
                                    <Badge variant="secondary" className="text-xs">
                                      +{((offer as any).countries || []).length - 3}
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="font-medium text-green-600">
                                ${offer.payout?.toFixed(2) || '0.00'}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleViewDetails(offer)}
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    Details
                                  </Button>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => {
                                      const hostname = window.location.hostname;
                                      let baseUrl = 'http://localhost:5000';
                                      if (hostname.includes('moustacheleads.com') || hostname.includes('vercel.app') || hostname.includes('onrender.com')) {
                                        baseUrl = 'https://offers.moustacheleads.com';
                                      }
                                      let userId = '';
                                      try {
                                        const userStr = localStorage.getItem('user');
                                        if (userStr) {
                                          const user = JSON.parse(userStr);
                                          userId = user._id || user.id || '';
                                        }
                                      } catch (e) {}
                                      const trackingUrl = `${baseUrl}/track/${offer.offer_id}?user_id=${userId}&sub1=default`;
                                      window.open(trackingUrl, '_blank');
                                    }}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    <ExternalLink className="h-4 w-4 mr-1" />
                                    Run
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Pagination Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Show:</span>
                      <Select 
                        value={myOffersPerPage.toString()} 
                        onValueChange={(val) => setMyOffersPerPage(val === 'all' ? -1 : parseInt(val))}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                          <SelectItem value="200">200</SelectItem>
                          <SelectItem value="-1">All</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-muted-foreground">per page</span>
                    </div>
                    
                    <div className="text-sm text-muted-foreground">
                      Showing {myOffersPerPage === -1 ? filteredMyOffersAll.length : Math.min((myOffersCurrentPage - 1) * myOffersPerPage + 1, filteredMyOffersAll.length)}-{myOffersPerPage === -1 ? filteredMyOffersAll.length : Math.min(myOffersCurrentPage * myOffersPerPage, filteredMyOffersAll.length)} of {filteredMyOffersAll.length} offers
                    </div>
                    
                    {myOffersPerPage !== -1 && myOffersTotalPages > 1 && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setMyOffersCurrentPage(1)}
                          disabled={myOffersCurrentPage === 1}
                        >
                          First
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setMyOffersCurrentPage(p => Math.max(1, p - 1))}
                          disabled={myOffersCurrentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm px-2">
                          Page {myOffersCurrentPage} of {myOffersTotalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setMyOffersCurrentPage(p => Math.min(myOffersTotalPages, p + 1))}
                          disabled={myOffersCurrentPage === myOffersTotalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setMyOffersCurrentPage(myOffersTotalPages)}
                          disabled={myOffersCurrentPage === myOffersTotalPages}
                        >
                          Last
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Offer Details Modal */}
      <OfferDetailsModalNew
        open={modalOpen}
        onOpenChange={setModalOpen}
        offer={selectedOffer}
      />
    </div>
  );
};

const PublisherOffers = () => {
  return (
    <PlacementRequired>
      <PublisherOffersContent />
    </PlacementRequired>
  );
};

export default PublisherOffers;
