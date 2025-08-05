import { useState } from "react";
import { Search, Info, Ban, Smartphone, Monitor, Globe } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const offers = [
  {
    id: "OFF001",
    name: "Mobile Game Install - Fantasy RPG",
    image: "🎮",
    countries: ["US", "UK", "CA"],
    category: "App",
    devices: ["ios", "android"],
    payout: "$2.50",
    status: "active"
  },
  {
    id: "OFF002", 
    name: "Credit Card Signup - Premium Rewards",
    image: "💳",
    countries: ["US"],
    category: "Web",
    devices: ["desktop", "mobile"],
    payout: "$150.00",
    status: "active"
  },
  {
    id: "OFF003",
    name: "Insurance Quote - Auto Coverage",
    image: "🚗",
    countries: ["US", "CA"],
    category: "Web", 
    devices: ["desktop"],
    payout: "$8.50",
    status: "disabled"
  },
  {
    id: "OFF004",
    name: "Streaming Service Trial",
    image: "📺",
    countries: ["US", "UK", "AU"],
    category: "Web",
    devices: ["desktop", "mobile", "ios", "android"],
    payout: "$12.00",
    status: "active"
  }
];

const countryFlags = {
  US: "🇺🇸",
  UK: "🇬🇧", 
  CA: "🇨🇦",
  AU: "🇦🇺"
};

const deviceIcons = {
  desktop: Monitor,
  mobile: Smartphone,
  ios: Smartphone,
  android: Smartphone
};

const Offers = () => {
  const [activeTab, setActiveTab] = useState("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchBy, setSearchBy] = useState("name");

  const filteredOffers = offers.filter(offer => {
    const matchesTab = activeTab === "all" || offer.status === activeTab;
    const matchesSearch = offer[searchBy as keyof typeof offer]
      ?.toString()
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

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
                  <SelectItem value="category">Category</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <TabsContent value={activeTab} className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Offer ID</TableHead>
                    <TableHead>Offer Name</TableHead>
                    <TableHead>Countries</TableHead>
                    <TableHead>Category</TableHead>
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
                          <span className="text-2xl">{offer.image}</span>
                          <div>
                            <p className="font-medium">{offer.name}</p>
                            <Badge variant={offer.status === "active" ? "default" : "secondary"}>
                              {offer.status}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {offer.countries.map((country) => (
                            <span key={country} className="text-lg">
                              {countryFlags[country as keyof typeof countryFlags]}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{offer.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {offer.devices.map((device) => {
                            const IconComponent = deviceIcons[device as keyof typeof deviceIcons];
                            return (
                              <IconComponent key={device} className="h-4 w-4 text-muted-foreground" />
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold text-primary">{offer.payout}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost">
                            <Info className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost">
                            <Ban className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Offers;