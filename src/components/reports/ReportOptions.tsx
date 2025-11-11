import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Settings2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface ReportOptionsProps {
  onOptionsChange: (options: ReportColumnOptions) => void;
  reportType: 'performance' | 'conversion';
}

export interface ReportColumnOptions {
  // Data Columns
  offer: boolean;
  category: boolean;
  promoCode: boolean;
  source: boolean;
  country: boolean;
  subId1: boolean;
  subId2: boolean;
  subId3: boolean;
  subId4: boolean;
  subId5: boolean;
  advertiserSubId1: boolean;
  advertiserSubId2: boolean;
  advertiserSubId3: boolean;
  advertiserSubId4: boolean;
  advertiserSubId5: boolean;
  
  // Statistics
  impressions: boolean;
  grossClicks: boolean;
  rejectedClicks: boolean;
  suspiciousClicks: boolean;
  clicks: boolean;
  uniqueClicks: boolean;
  conversions: boolean;
  
  // Calculations
  ctr: boolean;
  cr: boolean;
  uniqueClickRate: boolean;
  suspiciousClickRate: boolean;
  cpm: boolean;
  epc: boolean;
  cpl: boolean;
  
  // Financial
  payout: boolean;
  currency: boolean;
  payoutType: boolean;
  
  // Conversion Specific
  status?: boolean;
  transactionId?: boolean;
  time?: boolean;
  sessionIp?: boolean;
  eventId?: boolean;
  conversionId?: boolean;
  affiliateClickId?: boolean;
  affiliateUnique1?: boolean;
  affiliateUnique2?: boolean;
  affiliateUnique3?: boolean;
  affiliateUnique4?: boolean;
  affiliateUnique5?: boolean;
  advertiserUnique1?: boolean;
  advertiserUnique2?: boolean;
  advertiserUnique3?: boolean;
  advertiserUnique4?: boolean;
  advertiserUnique5?: boolean;
}

const DEFAULT_PERFORMANCE_OPTIONS: ReportColumnOptions = {
  offer: true,
  category: false,
  promoCode: false,
  source: false,
  country: false,
  subId1: false,
  subId2: false,
  subId3: false,
  subId4: false,
  subId5: false,
  advertiserSubId1: false,
  advertiserSubId2: false,
  advertiserSubId3: false,
  advertiserSubId4: false,
  advertiserSubId5: false,
  impressions: true,
  grossClicks: false,
  rejectedClicks: false,
  suspiciousClicks: false,
  clicks: true,
  uniqueClicks: false,
  conversions: true,
  ctr: true,
  cr: true,
  uniqueClickRate: false,
  suspiciousClickRate: false,
  cpm: false,
  epc: true,
  cpl: false,
  payout: true,
  currency: false,
  payoutType: false,
};

const DEFAULT_CONVERSION_OPTIONS: ReportColumnOptions = {
  ...DEFAULT_PERFORMANCE_OPTIONS,
  status: true,
  transactionId: true,
  time: true,
  sessionIp: false,
  eventId: false,
  conversionId: false,
  offer: true,
  country: true,
  payout: true,
};

export function ReportOptions({ onOptionsChange, reportType }: ReportOptionsProps) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ReportColumnOptions>(
    reportType === 'performance' ? DEFAULT_PERFORMANCE_OPTIONS : DEFAULT_CONVERSION_OPTIONS
  );

  const handleCheckboxChange = (key: keyof ReportColumnOptions, checked: boolean) => {
    setOptions(prev => ({ ...prev, [key]: checked }));
  };

  const handleApply = () => {
    onOptionsChange(options);
    setOpen(false);
  };

  const handleSelectAll = (section: 'data' | 'statistics' | 'calculations') => {
    const updates: Partial<ReportColumnOptions> = {};
    
    if (section === 'data') {
      Object.keys(options).forEach(key => {
        if (['offer', 'category', 'promoCode', 'source', 'country', 'subId1', 'subId2', 'subId3', 'subId4', 'subId5'].includes(key)) {
          updates[key as keyof ReportColumnOptions] = true;
        }
      });
    } else if (section === 'statistics') {
      Object.keys(options).forEach(key => {
        if (['impressions', 'grossClicks', 'rejectedClicks', 'suspiciousClicks', 'clicks', 'uniqueClicks', 'conversions'].includes(key)) {
          updates[key as keyof ReportColumnOptions] = true;
        }
      });
    } else if (section === 'calculations') {
      Object.keys(options).forEach(key => {
        if (['ctr', 'cr', 'uniqueClickRate', 'suspiciousClickRate', 'cpm', 'epc', 'cpl'].includes(key)) {
          updates[key as keyof ReportColumnOptions] = true;
        }
      });
    }
    
    setOptions(prev => ({ ...prev, ...updates }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4 mr-2" />
          Report Options
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Report Options</DialogTitle>
          <DialogDescription>
            Select data to include in your report
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-6">
            {/* Data Columns */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">Select data to include:</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleSelectAll('data')}
                  className="h-7 text-xs"
                >
                  Select All
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="offer"
                    checked={options.offer}
                    onCheckedChange={(checked) => handleCheckboxChange('offer', checked as boolean)}
                  />
                  <Label htmlFor="offer" className="text-sm cursor-pointer">Offer</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="category"
                    checked={options.category}
                    onCheckedChange={(checked) => handleCheckboxChange('category', checked as boolean)}
                  />
                  <Label htmlFor="category" className="text-sm cursor-pointer">Category</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="promoCode"
                    checked={options.promoCode}
                    onCheckedChange={(checked) => handleCheckboxChange('promoCode', checked as boolean)}
                  />
                  <Label htmlFor="promoCode" className="text-sm cursor-pointer">Promo Code</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="source"
                    checked={options.source}
                    onCheckedChange={(checked) => handleCheckboxChange('source', checked as boolean)}
                  />
                  <Label htmlFor="source" className="text-sm cursor-pointer">Source</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="country"
                    checked={options.country}
                    onCheckedChange={(checked) => handleCheckboxChange('country', checked as boolean)}
                  />
                  <Label htmlFor="country" className="text-sm cursor-pointer">Country</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="subId1"
                    checked={options.subId1}
                    onCheckedChange={(checked) => handleCheckboxChange('subId1', checked as boolean)}
                  />
                  <Label htmlFor="subId1" className="text-sm cursor-pointer">Sub ID 1</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="subId2"
                    checked={options.subId2}
                    onCheckedChange={(checked) => handleCheckboxChange('subId2', checked as boolean)}
                  />
                  <Label htmlFor="subId2" className="text-sm cursor-pointer">Sub ID 2</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="subId3"
                    checked={options.subId3}
                    onCheckedChange={(checked) => handleCheckboxChange('subId3', checked as boolean)}
                  />
                  <Label htmlFor="subId3" className="text-sm cursor-pointer">Sub ID 3</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="subId4"
                    checked={options.subId4}
                    onCheckedChange={(checked) => handleCheckboxChange('subId4', checked as boolean)}
                  />
                  <Label htmlFor="subId4" className="text-sm cursor-pointer">Sub ID 4</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="subId5"
                    checked={options.subId5}
                    onCheckedChange={(checked) => handleCheckboxChange('subId5', checked as boolean)}
                  />
                  <Label htmlFor="subId5" className="text-sm cursor-pointer">Sub ID 5</Label>
                </div>
              </div>
            </div>

            <Separator />

            {/* Statistics */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">Select statistics to include:</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleSelectAll('statistics')}
                  className="h-7 text-xs"
                >
                  Select All
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="impressions"
                    checked={options.impressions}
                    onCheckedChange={(checked) => handleCheckboxChange('impressions', checked as boolean)}
                  />
                  <Label htmlFor="impressions" className="text-sm cursor-pointer">Impressions</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="clicks"
                    checked={options.clicks}
                    onCheckedChange={(checked) => handleCheckboxChange('clicks', checked as boolean)}
                  />
                  <Label htmlFor="clicks" className="text-sm cursor-pointer">Clicks</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="grossClicks"
                    checked={options.grossClicks}
                    onCheckedChange={(checked) => handleCheckboxChange('grossClicks', checked as boolean)}
                  />
                  <Label htmlFor="grossClicks" className="text-sm cursor-pointer">Gross Clicks</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="uniqueClicks"
                    checked={options.uniqueClicks}
                    onCheckedChange={(checked) => handleCheckboxChange('uniqueClicks', checked as boolean)}
                  />
                  <Label htmlFor="uniqueClicks" className="text-sm cursor-pointer">Unique Clicks</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="rejectedClicks"
                    checked={options.rejectedClicks}
                    onCheckedChange={(checked) => handleCheckboxChange('rejectedClicks', checked as boolean)}
                  />
                  <Label htmlFor="rejectedClicks" className="text-sm cursor-pointer">Rejected Clicks</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="suspiciousClicks"
                    checked={options.suspiciousClicks}
                    onCheckedChange={(checked) => handleCheckboxChange('suspiciousClicks', checked as boolean)}
                  />
                  <Label htmlFor="suspiciousClicks" className="text-sm cursor-pointer">Suspicious Clicks</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="conversions"
                    checked={options.conversions}
                    onCheckedChange={(checked) => handleCheckboxChange('conversions', checked as boolean)}
                  />
                  <Label htmlFor="conversions" className="text-sm cursor-pointer">Conversions</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="payout"
                    checked={options.payout}
                    onCheckedChange={(checked) => handleCheckboxChange('payout', checked as boolean)}
                  />
                  <Label htmlFor="payout" className="text-sm cursor-pointer">Payout</Label>
                </div>
              </div>
            </div>

            <Separator />

            {/* Calculations */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">Select calculations to include:</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleSelectAll('calculations')}
                  className="h-7 text-xs"
                >
                  Select All
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="ctr"
                    checked={options.ctr}
                    onCheckedChange={(checked) => handleCheckboxChange('ctr', checked as boolean)}
                  />
                  <Label htmlFor="ctr" className="text-sm cursor-pointer">CTR</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="cr"
                    checked={options.cr}
                    onCheckedChange={(checked) => handleCheckboxChange('cr', checked as boolean)}
                  />
                  <Label htmlFor="cr" className="text-sm cursor-pointer">CR (Conversion Rate)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="uniqueClickRate"
                    checked={options.uniqueClickRate}
                    onCheckedChange={(checked) => handleCheckboxChange('uniqueClickRate', checked as boolean)}
                  />
                  <Label htmlFor="uniqueClickRate" className="text-sm cursor-pointer">Unique Click Rate</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="suspiciousClickRate"
                    checked={options.suspiciousClickRate}
                    onCheckedChange={(checked) => handleCheckboxChange('suspiciousClickRate', checked as boolean)}
                  />
                  <Label htmlFor="suspiciousClickRate" className="text-sm cursor-pointer">Suspicious Click Rate</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="cpm"
                    checked={options.cpm}
                    onCheckedChange={(checked) => handleCheckboxChange('cpm', checked as boolean)}
                  />
                  <Label htmlFor="cpm" className="text-sm cursor-pointer">CPM</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="epc"
                    checked={options.epc}
                    onCheckedChange={(checked) => handleCheckboxChange('epc', checked as boolean)}
                  />
                  <Label htmlFor="epc" className="text-sm cursor-pointer">EPC</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="cpl"
                    checked={options.cpl}
                    onCheckedChange={(checked) => handleCheckboxChange('cpl', checked as boolean)}
                  />
                  <Label htmlFor="cpl" className="text-sm cursor-pointer">CPL</Label>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply}>
            Apply Options
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
