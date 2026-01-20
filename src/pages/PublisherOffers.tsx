import { useState, useEffect } from "react";
import { Search, Loader2, AlertCircle, Info, UserCheck, Clock, CheckCircle, XCircle } from "lucide-react";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { publisherOfferApi, type PublisherOffer } from "@/services/publisherOfferApi";
import { useToast } from "@/hooks/use-toast";
import OfferDetailsModalNew from "@/components/OfferDetailsModalNew";
import OfferCardWithApproval from "@/components/OfferCardWithApproval";

const PublisherOffers = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchBy, setSearchBy] = useState("name");
  const [sortBy, setSortBy] = useState("newest");
  const [countryFilter, setCountryFilter] = useState("all");
  const [offers, setOffers] = useState<PublisherOffer[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<PublisherOffer | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("offers");
  const { toast } = useToast();

  useEffect(() => {
    fetchOffers();
  }, []);

  const fetchOffers = async () => {
    console.log('🔍 fetchOffers: Starting...');
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 fetchOffers: Calling API...');
      // Fetch all active offers
      const response = await publisherOfferApi.getAvailableOffers({
        status: 'active',
        page: 1,
        per_page: 100
      });
      
      console.log('✅ fetchOffers: Success!', response);
      setOffers(response.offers || []);
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

  const handleViewDetails = (offer: PublisherOffer) => {
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
  }, [activeTab]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Available Offers</h1>
        <p className="text-muted-foreground">Browse and promote offers to earn commissions</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="offers">Available Offers</TabsTrigger>
          <TabsTrigger value="requests">My Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="offers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>🎯 Active Offers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search Controls */}
              <div className="flex gap-4 items-center">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search offers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={searchBy} onValueChange={setSearchBy}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Search by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="id">Offer ID</SelectItem>
                    <SelectItem value="vertical">Vertical</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-44">
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
                  <SelectTrigger className="w-44">
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
                <Button onClick={fetchOffers} variant="outline">
                  Refresh
                </Button>
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

              {/* Offers Grid */}
              {!loading && !error && filteredOffers.length > 0 && (
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
              )}

              {/* Results Count */}
              {!loading && filteredOffers.length > 0 && (
                <div className="text-sm text-muted-foreground text-center pt-4 border-t">
                  Showing {filteredOffers.length} of {offers.length} offers
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

export default PublisherOffers;
