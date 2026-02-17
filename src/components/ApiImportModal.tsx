import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { apiImportService, PreviewOffer, ImportSummary } from '@/services/apiImportService';
import { Loader2, Eye, EyeOff, CheckCircle2, XCircle, AlertCircle, Download } from 'lucide-react';

interface ApiImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

type Step = 'credentials' | 'preview' | 'importing' | 'complete';

export const ApiImportModal: React.FC<ApiImportModalProps> = ({ open, onOpenChange, onImportComplete }) => {
  const { toast } = useToast();
  
  // Step management
  const [currentStep, setCurrentStep] = useState<Step>('credentials');
  
  // Form state
  const [networkType, setNetworkType] = useState('hasoffers');
  const [networkId, setNetworkId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  
  // Preview state
  const [previewOffers, setPreviewOffers] = useState<PreviewOffer[]>([]);
  const [totalAvailable, setTotalAvailable] = useState(0);
  
  // Import options
  const [skipDuplicates, setSkipDuplicates] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [autoActivate, setAutoActivate] = useState(true);
  const [defaultStarRating, setDefaultStarRating] = useState<number>(4);
  const [defaultTimer, setDefaultTimer] = useState<number>(0); // 0 = no timer
  
  // Approval workflow options
  const [approvalType, setApprovalType] = useState<string>('auto_approve');
  const [autoApproveDelay, setAutoApproveDelay] = useState<number>(0);
  const [autoApproveDelayUnit, setAutoApproveDelayUnit] = useState<string>('minutes');
  const [showInOfferwall, setShowInOfferwall] = useState<boolean>(true);
  
  // Import progress
  const [importProgress, setImportProgress] = useState(0);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importErrors, setImportErrors] = useState<Array<{ offer_name: string; error: string }>>([]);
  
  // Loading states
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  
  const handleTestConnection = async () => {
    if (!networkId || !apiKey) {
      toast({
        title: 'Error',
        description: 'Please enter Network ID and API Key',
        variant: 'destructive',
      });
      return;
    }
    
    setTesting(true);
    try {
      const response = await apiImportService.testConnection({
        network_id: networkId,
        api_key: apiKey,
        network_type: networkType,
      });
      
      if (response.success) {
        toast({
          title: 'Connection Successful',
          description: `Found ${response.offer_count} offers available`,
        });
        setTotalAvailable(response.offer_count || 0);
      }
    } catch (error) {
      toast({
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Failed to connect to API',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };
  
  const handleFetchPreview = async () => {
    if (!networkId || !apiKey) {
      toast({
        title: 'Error',
        description: 'Please test connection first',
        variant: 'destructive',
      });
      return;
    }
    
    setLoading(true);
    try {
      const response = await apiImportService.fetchPreview({
        network_id: networkId,
        api_key: apiKey,
        network_type: networkType,
        limit: 5,
      });
      
      if (response.success && response.offers) {
        setPreviewOffers(response.offers);
        setTotalAvailable(response.total_available || 0);
        setCurrentStep('preview');
      }
    } catch (error) {
      toast({
        title: 'Preview Failed',
        description: error instanceof Error ? error.message : 'Failed to fetch preview',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleImport = async () => {
    setCurrentStep('importing');
    setImporting(true);
    setImportProgress(0);
    
    // Simulate progress (since we don't have real-time updates yet)
    const progressInterval = setInterval(() => {
      setImportProgress((prev) => Math.min(prev + 10, 90));
    }, 500);
    
    try {
      // Convert delay to minutes based on selected unit
      let delayInMinutes = autoApproveDelay;
      if (autoApproveDelayUnit === 'hours') {
        delayInMinutes = autoApproveDelay * 60;
      } else if (autoApproveDelayUnit === 'days') {
        delayInMinutes = autoApproveDelay * 60 * 24;
      }
      
      const response = await apiImportService.importOffers({
        network_id: networkId,
        api_key: apiKey,
        network_type: networkType,
        options: {
          skip_duplicates: skipDuplicates,
          update_existing: updateExisting,
          auto_activate: autoActivate,
          show_in_offerwall: showInOfferwall,
          approval_type: approvalType,
          auto_approve_delay: delayInMinutes,
          require_approval: approvalType !== 'auto_approve',
        },
      });
      
      clearInterval(progressInterval);
      setImportProgress(100);
      
      if (response.success && response.summary) {
        setImportSummary(response.summary);
        setImportErrors(response.errors || []);
        setCurrentStep('complete');
        
        toast({
          title: 'Import Complete',
          description: `Successfully imported ${response.summary.imported} offers`,
        });
        
        onImportComplete();
      }
    } catch (error) {
      clearInterval(progressInterval);
      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Failed to import offers',
        variant: 'destructive',
      });
      setCurrentStep('preview');
    } finally {
      setImporting(false);
    }
  };
  
  const handleClose = () => {
    setCurrentStep('credentials');
    setNetworkId('');
    setApiKey('');
    setPreviewOffers([]);
    setImportSummary(null);
    setImportErrors([]);
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Offers from API</DialogTitle>
          <DialogDescription>
            Import offers directly from affiliate network APIs
          </DialogDescription>
        </DialogHeader>
        
        {/* Step 1: Credentials */}
        {currentStep === 'credentials' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="network-type">Network Type *</Label>
              <Select value={networkType} onValueChange={setNetworkType}>
                <SelectTrigger id="network-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hasoffers">HasOffers / Tune</SelectItem>
                  <SelectItem value="cj" disabled>Commission Junction (Coming Soon)</SelectItem>
                  <SelectItem value="shareasale" disabled>ShareASale (Coming Soon)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="network-id">Network ID *</Label>
              <Input
                id="network-id"
                placeholder="e.g., cpamerchant"
                value={networkId}
                onChange={(e) => setNetworkId(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="api-key">API Key *</Label>
              <div className="relative">
                <Input
                  id="api-key"
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="Enter your API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <Button onClick={handleTestConnection} disabled={testing || !networkId || !apiKey}>
              {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Test Connection
            </Button>
            
            {totalAvailable > 0 && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm text-green-800">
                  Connection successful! Found {totalAvailable} offers
                </span>
              </div>
            )}
            
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleFetchPreview} disabled={loading || !networkId || !apiKey}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Next: Preview Offers
              </Button>
            </div>
          </div>
        )}
        
        {/* Step 2: Preview & Options */}
        {currentStep === 'preview' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Preview Offers</h3>
              <p className="text-sm text-muted-foreground mb-4">
                <span className="font-semibold text-green-600">{totalAvailable}</span> offers available for import. Showing preview of {previewOffers.length}:
              </p>
              
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Payout</TableHead>
                      <TableHead>Countries</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewOffers.map((offer, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{offer.name}</TableCell>
                        <TableCell>
                          {offer.currency === 'USD' ? '$' : offer.currency}
                          {offer.payout.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {offer.countries.slice(0, 3).map((country) => (
                              <Badge key={country} variant="outline" className="text-xs">
                                {country}
                              </Badge>
                            ))}
                            {offer.countries.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{offer.countries.length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={offer.status === 'active' ? 'bg-green-100 text-green-800' : ''}>
                            {offer.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            
            <div className="space-y-3 p-4 bg-gray-50 rounded-md">
              <h4 className="font-semibold">Import Options</h4>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="skip-duplicates"
                  checked={skipDuplicates}
                  onCheckedChange={(checked) => setSkipDuplicates(checked as boolean)}
                />
                <label htmlFor="skip-duplicates" className="text-sm cursor-pointer">
                  Skip duplicate offers (check by Campaign ID)
                </label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="update-existing"
                  checked={updateExisting}
                  onCheckedChange={(checked) => setUpdateExisting(checked as boolean)}
                  disabled={skipDuplicates}
                />
                <label htmlFor="update-existing" className="text-sm cursor-pointer">
                  Update existing offers with new data
                </label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="auto-activate"
                  checked={autoActivate}
                  onCheckedChange={(checked) => setAutoActivate(checked as boolean)}
                />
                <label htmlFor="auto-activate" className="text-sm cursor-pointer">
                  Auto-activate imported offers
                </label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="show-in-offerwall"
                  checked={showInOfferwall}
                  onCheckedChange={(checked) => setShowInOfferwall(checked as boolean)}
                />
                <label htmlFor="show-in-offerwall" className="text-sm cursor-pointer">
                  🖼️ Show offers in Offerwall (visible to users)
                </label>
              </div>
              <p className="text-xs text-muted-foreground ml-6">
                If unchecked, offers will be imported but hidden from the offerwall until manually enabled
              </p>
              
              <div className="border-t pt-3 mt-3">
                <h5 className="font-medium text-sm mb-3">Approval Workflow</h5>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="approval-type" className="text-sm">Approval Type</Label>
                    <Select 
                      value={approvalType} 
                      onValueChange={setApprovalType}
                    >
                      <SelectTrigger id="approval-type">
                        <SelectValue placeholder="Select approval type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto_approve">🟢 Direct Access (Instant)</SelectItem>
                        <SelectItem value="time_based">⏰ Time-Based Auto-Approval</SelectItem>
                        <SelectItem value="manual">🔐 Manual Admin Approval</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {approvalType === 'auto_approve' && 'Offers will be immediately accessible to all users'}
                      {approvalType === 'time_based' && 'Offers will be locked until the delay period passes'}
                      {approvalType === 'manual' && 'Offers will require manual admin approval for each user'}
                    </p>
                  </div>
                  
                  {approvalType === 'time_based' && (
                    <div className="space-y-2">
                      <Label htmlFor="approval-delay" className="text-sm">Auto-Approve Delay</Label>
                      <div className="flex gap-2">
                        <Input
                          id="approval-delay"
                          type="number"
                          min="1"
                          placeholder="e.g., 60"
                          value={autoApproveDelay || ''}
                          onChange={(e) => setAutoApproveDelay(parseInt(e.target.value) || 0)}
                          className="flex-1"
                        />
                        <Select value={autoApproveDelayUnit} onValueChange={setAutoApproveDelayUnit}>
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="minutes">Minutes</SelectItem>
                            <SelectItem value="hours">Hours</SelectItem>
                            <SelectItem value="days">Days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Users will get auto-approved after this delay
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="border-t pt-3 mt-3">
                <h5 className="font-medium text-sm mb-3">Default Values for Imported Offers</h5>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="api-rating" className="text-sm">Star Rating</Label>
                    <Select 
                      value={defaultStarRating.toString()} 
                      onValueChange={(v) => setDefaultStarRating(parseInt(v))}
                    >
                      <SelectTrigger id="api-rating">
                        <SelectValue placeholder="Select rating" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">⭐ 1 Star</SelectItem>
                        <SelectItem value="2">⭐⭐ 2 Stars</SelectItem>
                        <SelectItem value="3">⭐⭐⭐ 3 Stars</SelectItem>
                        <SelectItem value="4">⭐⭐⭐⭐ 4 Stars</SelectItem>
                        <SelectItem value="5">⭐⭐⭐⭐⭐ 5 Stars</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="api-timer" className="text-sm">Timer (minutes)</Label>
                    <Input
                      id="api-timer"
                      type="number"
                      min="0"
                      max="999"
                      placeholder="e.g., 15"
                      value={defaultTimer || ''}
                      onChange={(e) => setDefaultTimer(parseInt(e.target.value) || 0)}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">0 = no timer</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setCurrentStep('credentials')}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={importing}>
                Import {totalAvailable} Offers
              </Button>
            </div>
          </div>
        )}
        
        {/* Step 3: Importing Progress */}
        {currentStep === 'importing' && (
          <div className="space-y-4 py-8">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
              <h3 className="text-lg font-semibold mb-2">Importing Offers...</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Please wait while we import your offers
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{importProgress}%</span>
              </div>
              <Progress value={importProgress} className="h-2" />
            </div>
          </div>
        )}
        
        {/* Step 4: Complete */}
        {currentStep === 'complete' && importSummary && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Import Complete!</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                <div className="text-2xl font-bold text-blue-600">{importSummary.total_fetched}</div>
                <div className="text-sm text-blue-800">Total Fetched</div>
              </div>
              <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                <div className="text-2xl font-bold text-green-600">{importSummary.imported}</div>
                <div className="text-sm text-green-800">Successfully Imported</div>
              </div>
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="text-2xl font-bold text-yellow-600">{importSummary.skipped}</div>
                <div className="text-sm text-yellow-800">Skipped (Duplicates)</div>
              </div>
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <div className="text-2xl font-bold text-red-600">{importSummary.errors}</div>
                <div className="text-sm text-red-800">Errors</div>
              </div>
            </div>
            
            {importErrors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  Errors ({importErrors.length})
                </h4>
                <div className="max-h-40 overflow-y-auto border rounded-md p-3 bg-red-50">
                  {importErrors.map((error, index) => (
                    <div key={index} className="text-sm mb-2">
                      <span className="font-medium">{error.offer_name}:</span>{' '}
                      <span className="text-red-600">{error.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button onClick={handleClose}>
                View Imported Offers
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
