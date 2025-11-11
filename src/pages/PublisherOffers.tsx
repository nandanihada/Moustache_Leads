import { useState, useEffect } from "react";
import { Search, Loader2, AlertCircle, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

const PublisherOffers = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchBy, setSearchBy] = useState("name");
  const [offers, setOffers] = useState<PublisherOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<PublisherOffer | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchOffers();
  }, []);

  const fetchOffers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch all active offers
      const response = await publisherOfferApi.getAvailableOffers({
        status: 'active',
        page: 1,
        per_page: 100
      });
      
      setOffers(response.offers || []);
    } catch (err: any) {
      console.error('Error fetching offers:', err);
      setError(err.message || 'Failed to fetch offers');
      toast({
        title: "Error",
        description: "Failed to load offers. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredOffers = offers.filter((offer) => {
    if (!searchTerm) return true;
    
    const term = searchTerm.toLowerCase();
    switch (searchBy) {
      case "name":
        return offer.name.toLowerCase().includes(term);
      case "id":
        return offer.offer_id.toLowerCase().includes(term);
      case "category":
        return (offer.category || "").toLowerCase().includes(term);
      default:
        return true;
    }
  });

  const handleViewDetails = (offer: PublisherOffer) => {
    setSelectedOffer(offer);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Available Offers</h1>
        <p className="text-muted-foreground">Browse and promote offers to earn commissions</p>
      </div>

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
                <SelectItem value="category">Category</SelectItem>
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
                <Card 
                  key={offer.offer_id} 
                  className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-blue-500"
                  onClick={() => handleViewDetails(offer)}
                >
                  <CardContent className="p-4">
                    {/* Offer Image */}
                    {(offer.thumbnail_url || offer.image_url) && (
                      <div className="mb-3">
                        <img 
                          src={offer.thumbnail_url || offer.image_url} 
                          alt={offer.name}
                          className="w-full h-32 object-cover rounded"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}

                    {/* Offer Name */}
                    <h3 className="font-bold text-lg mb-2 line-clamp-2">{offer.name}</h3>

                    {/* Offer ID */}
                    <div className="text-xs text-muted-foreground font-mono mb-2">
                      ID: {offer.offer_id}
                    </div>

                    {/* Payout */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-muted-foreground">Payout:</span>
                      <Badge className="bg-green-500 text-white text-lg font-bold">
                        ${offer.payout.toFixed(2)}
                      </Badge>
                    </div>

                    {/* Countries */}
                    {offer.countries && offer.countries.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs text-muted-foreground mb-1">Countries:</div>
                        <div className="flex flex-wrap gap-1">
                          {offer.countries.slice(0, 5).map((country) => (
                            <Badge key={country} variant="outline" className="text-xs">
                              {country}
                            </Badge>
                          ))}
                          {offer.countries.length > 5 && (
                            <Badge variant="outline" className="text-xs">
                              +{offer.countries.length - 5}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Device Targeting */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-muted-foreground">Device:</span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {offer.device_targeting}
                      </Badge>
                    </div>

                    {/* Status */}
                    <div className="flex items-center justify-between">
                      <Badge className={offer.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {offer.status.toUpperCase()}
                      </Badge>
                      <Button size="sm" onClick={() => handleViewDetails(offer)}>
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
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
