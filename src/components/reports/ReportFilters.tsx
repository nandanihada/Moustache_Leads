import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Filter, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ReportFiltersProps {
  onFiltersChange: (filters: any) => void;
  availableOffers?: any[];
}

const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "UK", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "IN", name: "India" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "SE", name: "Sweden" },
  { code: "PL", name: "Poland" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "CN", name: "China" },
  { code: "SG", name: "Singapore" },
  { code: "AE", name: "UAE" },
  { code: "ZA", name: "South Africa" }
];

export function ReportFilters({ onFiltersChange, availableOffers = [] }: ReportFiltersProps) {
  const [open, setOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [offerSearch, setOfferSearch] = useState("");
  
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedOffers, setSelectedOffers] = useState<string[]>([]);
  const [subId1, setSubId1] = useState("");
  const [subId2, setSubId2] = useState("");
  const [subId3, setSubId3] = useState("");
  const [subId4, setSubId4] = useState("");
  const [subId5, setSubId5] = useState("");
  const [transactionId, setTransactionId] = useState("");

  const filteredCountries = COUNTRIES.filter(country =>
    country.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
    country.code.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const filteredOffers = availableOffers.filter(offer =>
    offer.name?.toLowerCase().includes(offerSearch.toLowerCase()) ||
    offer.offer_id?.toLowerCase().includes(offerSearch.toLowerCase())
  );

  const toggleCountry = (code: string) => {
    setSelectedCountries(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const toggleOffer = (offerId: string) => {
    setSelectedOffers(prev =>
      prev.includes(offerId) ? prev.filter(o => o !== offerId) : [...prev, offerId]
    );
  };

  const applyFilters = () => {
    const filters: any = {};
    
    if (selectedCountries.length > 0) {
      filters.countries = selectedCountries;
    }
    if (selectedOffers.length > 0) {
      filters.offer_ids = selectedOffers;
    }
    if (subId1) filters.sub_id1 = subId1;
    if (subId2) filters.sub_id2 = subId2;
    if (subId3) filters.sub_id3 = subId3;
    if (subId4) filters.sub_id4 = subId4;
    if (subId5) filters.sub_id5 = subId5;
    if (transactionId) filters.transaction_id = transactionId;

    onFiltersChange(filters);
    setOpen(false);
  };

  const clearFilters = () => {
    setSelectedCountries([]);
    setSelectedOffers([]);
    setSubId1("");
    setSubId2("");
    setSubId3("");
    setSubId4("");
    setSubId5("");
    setTransactionId("");
    onFiltersChange({});
  };

  const activeFiltersCount = 
    selectedCountries.length + 
    selectedOffers.length + 
    (subId1 ? 1 : 0) + 
    (subId2 ? 1 : 0) + 
    (subId3 ? 1 : 0) + 
    (subId4 ? 1 : 0) + 
    (subId5 ? 1 : 0) + 
    (transactionId ? 1 : 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" />
          Report Filters
          {activeFiltersCount > 0 && (
            <span className="ml-2 bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
              {activeFiltersCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px]" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Data Filters</h4>
            {activeFiltersCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearFilters}
                className="h-8 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Clear All
              </Button>
            )}
          </div>

          {/* Countries Filter */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Filter: Countries</Label>
            <Input
              placeholder="Search countries..."
              value={countrySearch}
              onChange={(e) => setCountrySearch(e.target.value)}
              className="h-8 text-sm"
            />
            <ScrollArea className="h-[120px] border rounded-md p-2">
              {filteredCountries.map((country) => (
                <div key={country.code} className="flex items-center space-x-2 py-1">
                  <Checkbox
                    id={`country-${country.code}`}
                    checked={selectedCountries.includes(country.code)}
                    onCheckedChange={() => toggleCountry(country.code)}
                  />
                  <label
                    htmlFor={`country-${country.code}`}
                    className="text-sm cursor-pointer flex-1"
                  >
                    {country.name} ({country.code})
                  </label>
                </div>
              ))}
            </ScrollArea>
            {selectedCountries.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {selectedCountries.length} selected
              </p>
            )}
          </div>

          {/* Offers Filter */}
          {availableOffers.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-medium">Filter: Offers</Label>
              <Input
                placeholder="Search offers..."
                value={offerSearch}
                onChange={(e) => setOfferSearch(e.target.value)}
                className="h-8 text-sm"
              />
              <ScrollArea className="h-[120px] border rounded-md p-2">
                {filteredOffers.map((offer) => (
                  <div key={offer.offer_id} className="flex items-center space-x-2 py-1">
                    <Checkbox
                      id={`offer-${offer.offer_id}`}
                      checked={selectedOffers.includes(offer.offer_id)}
                      onCheckedChange={() => toggleOffer(offer.offer_id)}
                    />
                    <label
                      htmlFor={`offer-${offer.offer_id}`}
                      className="text-sm cursor-pointer flex-1"
                    >
                      {offer.name || offer.offer_id}
                    </label>
                  </div>
                ))}
              </ScrollArea>
              {selectedOffers.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedOffers.length} selected
                </p>
              )}
            </div>
          )}

          {/* Sub IDs */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Sub IDs</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Sub ID 1"
                value={subId1}
                onChange={(e) => setSubId1(e.target.value)}
                className="h-8 text-sm"
              />
              <Input
                placeholder="Sub ID 2"
                value={subId2}
                onChange={(e) => setSubId2(e.target.value)}
                className="h-8 text-sm"
              />
              <Input
                placeholder="Sub ID 3"
                value={subId3}
                onChange={(e) => setSubId3(e.target.value)}
                className="h-8 text-sm"
              />
              <Input
                placeholder="Sub ID 4"
                value={subId4}
                onChange={(e) => setSubId4(e.target.value)}
                className="h-8 text-sm"
              />
              <Input
                placeholder="Sub ID 5"
                value={subId5}
                onChange={(e) => setSubId5(e.target.value)}
                className="h-8 text-sm col-span-2"
              />
            </div>
          </div>

          {/* Transaction ID */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Transaction ID</Label>
            <Input
              placeholder="Enter transaction ID..."
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={applyFilters}>
              Apply Filters
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
