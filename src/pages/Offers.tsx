import { useState, useEffect } from "react";
import { Search, Info, Ban, Smartphone, Monitor, Globe, Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PlacementRequired from "@/components/PlacementRequired";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { offerApi, type Offer } from "@/services/offerApi";
import { useToast } from "@/hooks/use-toast";

const countryFlags = {
  US: "",
  UK: "",
  CA: "",
  AU: "",
};

const deviceIcons = {
  desktop: Monitor,
  mobile: Smartphone,
  ios: Smartphone,
  android: Smartphone,
};

const OffersContent = () => {
  const [activeTab, setActiveTab] = useState("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchBy, setSearchBy] = useState("name");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchOffers();
  }, []);

  const fetchOffers = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("");
      
      const response = await offerApi.fetchOffers({ status: 'all', limit: 100 });
      console.log("", response.offers.length);
      
      setOffers(response.offers);
      
      if (response.offers.length === 0) {
        toast({
          title: "No offers found",
          description: "Admin hasn't added any offers yet.",
          variant: "default",
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch offers';
      console.error("", errorMessage);
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredOffers = offers.filter(offer => {
    const matchesTab = activeTab === "all" || offer.status === activeTab;
    const searchValue = searchBy === "name" ? offer.title : 
                       searchBy === "id" ? offer.id : 
                       (offer as any).vertical || offer.category;  // Support both vertical and category
    const matchesSearch = searchValue
      ?.toString()
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const handleOfferClick = async (offer: Offer) => {
    try {
      await offerApi.trackOfferClick(offer.id);
      window.open(offer.click_url, '_blank');
    } catch (err) {
      console.error('Error tracking click:', err);
      // Still open the offer even if tracking fails
      window.open(offer.click_url, '_blank');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Offers</h1>
        <p className="text-muted-foreground">Manage your affiliate offers and campaigns</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Offer Management</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="active">Active Offers</TabsTrigger>
              <TabsTrigger value="disabled">Disabled Offers</TabsTrigger>
              <TabsTrigger value="all">All Offers</TabsTrigger>
            </TabsList>

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
            </div>

            <TabsContent value={activeTab} className="space-y-4">
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-3 text-muted-foreground">Loading offers...</span>
                </div>
              )}

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

              {!loading && !error && filteredOffers.length === 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>No offers found</AlertTitle>
                  <AlertDescription>
                    {searchTerm ? 'No offers match your search criteria.' : 'No offers available at the moment.'}
                  </AlertDescription>
                </Alert>
              )}

              {!loading && !error && filteredOffers.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Offer ID</TableHead>
                      <TableHead>Offer Name</TableHead>
                      <TableHead>Countries</TableHead>
                      <TableHead>Vertical</TableHead>
                      <TableHead>Devices</TableHead>
                      <TableHead>Payout</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOffers.map((offer) => (
                      <TableRow key={offer.id}>
                        <TableCell className="font-mono text-sm">{offer.id}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {offer.image_url && (
                              <img 
                                src={offer.image_url} 
                                alt={offer.title}
                                className="w-12 h-12 object-cover rounded"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            )}
                            <div>
                              <p className="font-medium">{offer.title}</p>
                              <Badge variant={offer.status === "active" ? "default" : "secondary"}>
                                {offer.status}
                              </Badge>
                              {offer.network && (
                                <Badge variant="outline" className="ml-2">
                                  {offer.network}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {offer.countries && offer.countries.length > 0 ? (
                              offer.countries.map((country) => (
                                <span key={country} className="text-lg">
                                  {countryFlags[country as keyof typeof countryFlags] || country}
                                </span>
                              ))
                            ) : (
                              <Globe className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{(offer as any).vertical || offer.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {offer.devices && offer.devices.length > 0 ? (
                              offer.devices.map((device) => {
                                const IconComponent = deviceIcons[device as keyof typeof deviceIcons];
                                return IconComponent ? (
                                  <IconComponent key={device} className="h-4 w-4 text-muted-foreground" />
                                ) : null;
                              })
                            ) : (
                              <span className="text-sm text-muted-foreground">All</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-primary">
                          {offer.reward_currency} {offer.reward_amount}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => handleOfferClick(offer)}
                              title="Open offer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" title="View details">
                              <Info className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

const Offers = () => {
  return (
    <PlacementRequired>
      <OffersContent />
    </PlacementRequired>
  );
};

export default Offers;