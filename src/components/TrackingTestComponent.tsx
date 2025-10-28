import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { trackingApi } from '@/services/trackingApi';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, MousePointer, AlertCircle } from 'lucide-react';

interface TrackingTestComponentProps {
  offerId?: string;
  userId?: string;
}

const TrackingTestComponent: React.FC<TrackingTestComponentProps> = ({ 
  offerId: initialOfferId = '', 
  userId: initialUserId = '' 
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  
  // Form state for click tracking
  const [clickForm, setClickForm] = useState({
    offerId: initialOfferId,
    subIds: ['', '', '', '', '']
  });
  
  // Form state for completion tracking
  const [completionForm, setCompletionForm] = useState({
    offerId: initialOfferId,
    userId: initialUserId,
    transactionId: '',
    payout: '',
    revenue: '',
    status: 'approved',
    externalId: '',
    country: 'US'
  });

  const handleTrackClick = async () => {
    if (!clickForm.offerId) {
      toast({
        title: "Error",
        description: "Offer ID is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const response = await trackingApi.trackOfferClick(
        clickForm.offerId,
        clickForm.subIds.filter(id => id.trim() !== '')
      );

      const result = {
        type: 'click',
        timestamp: new Date().toISOString(),
        success: response.success,
        data: response
      };

      setResults(prev => [result, ...prev]);
      
      toast({
        title: "Success",
        description: "Click tracked successfully",
      });

    } catch (error) {
      const result = {
        type: 'click',
        timestamp: new Date().toISOString(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      setResults(prev => [result, ...prev]);
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to track click",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTrackCompletion = async () => {
    if (!completionForm.offerId || !completionForm.userId) {
      toast({
        title: "Error",
        description: "Offer ID and User ID are required",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const completion = {
        offer_id: completionForm.offerId,
        user_id: completionForm.userId,
        transaction_id: completionForm.transactionId || undefined,
        payout: completionForm.payout ? parseFloat(completionForm.payout) : undefined,
        revenue: completionForm.revenue ? parseFloat(completionForm.revenue) : undefined,
        status: completionForm.status,
        external_id: completionForm.externalId || undefined,
        country: completionForm.country || undefined
      };

      const response = await trackingApi.trackOfferCompletion(completion);

      const result = {
        type: 'completion',
        timestamp: new Date().toISOString(),
        success: response.success,
        data: response
      };

      setResults(prev => [result, ...prev]);
      
      toast({
        title: "Success",
        description: response.message,
      });

    } catch (error) {
      const result = {
        type: 'completion',
        timestamp: new Date().toISOString(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      setResults(prev => [result, ...prev]);
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to track completion",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const clearResults = () => {
    setResults([]);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Click Tracking */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MousePointer className="h-5 w-5" />
              Track Click
            </CardTitle>
            <CardDescription>
              Generate a tracking link for an offer
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="click-offer-id">Offer ID</Label>
              <Input
                id="click-offer-id"
                value={clickForm.offerId}
                onChange={(e) => setClickForm(prev => ({ ...prev, offerId: e.target.value }))}
                placeholder="ML-00001"
              />
            </div>
            
            <div>
              <Label>Sub IDs (optional)</Label>
              {clickForm.subIds.map((subId, index) => (
                <Input
                  key={index}
                  value={subId}
                  onChange={(e) => {
                    const newSubIds = [...clickForm.subIds];
                    newSubIds[index] = e.target.value;
                    setClickForm(prev => ({ ...prev, subIds: newSubIds }));
                  }}
                  placeholder={`Sub ID ${index + 1}`}
                  className="mt-2"
                />
              ))}
            </div>

            <Button 
              onClick={handleTrackClick} 
              disabled={loading}
              className="w-full"
            >
              Generate Tracking Link
            </Button>
          </CardContent>
        </Card>

        {/* Completion Tracking */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Track Completion
            </CardTitle>
            <CardDescription>
              Track an offer completion
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="completion-offer-id">Offer ID</Label>
                <Input
                  id="completion-offer-id"
                  value={completionForm.offerId}
                  onChange={(e) => setCompletionForm(prev => ({ ...prev, offerId: e.target.value }))}
                  placeholder="ML-00001"
                />
              </div>
              <div>
                <Label htmlFor="completion-user-id">User ID</Label>
                <Input
                  id="completion-user-id"
                  value={completionForm.userId}
                  onChange={(e) => setCompletionForm(prev => ({ ...prev, userId: e.target.value }))}
                  placeholder="user123"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="payout">Payout ($)</Label>
                <Input
                  id="payout"
                  type="number"
                  step="0.01"
                  value={completionForm.payout}
                  onChange={(e) => setCompletionForm(prev => ({ ...prev, payout: e.target.value }))}
                  placeholder="5.00"
                />
              </div>
              <div>
                <Label htmlFor="revenue">Revenue ($)</Label>
                <Input
                  id="revenue"
                  type="number"
                  step="0.01"
                  value={completionForm.revenue}
                  onChange={(e) => setCompletionForm(prev => ({ ...prev, revenue: e.target.value }))}
                  placeholder="10.00"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="transaction-id">Transaction ID</Label>
              <Input
                id="transaction-id"
                value={completionForm.transactionId}
                onChange={(e) => setCompletionForm(prev => ({ ...prev, transactionId: e.target.value }))}
                placeholder="txn_123456"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="external-id">External ID</Label>
                <Input
                  id="external-id"
                  value={completionForm.externalId}
                  onChange={(e) => setCompletionForm(prev => ({ ...prev, externalId: e.target.value }))}
                  placeholder="ext_123"
                />
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={completionForm.country}
                  onChange={(e) => setCompletionForm(prev => ({ ...prev, country: e.target.value }))}
                  placeholder="US"
                />
              </div>
            </div>

            <Button 
              onClick={handleTrackCompletion} 
              disabled={loading}
              className="w-full"
            >
              Track Completion
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Tracking Results</CardTitle>
              <Button variant="outline" size="sm" onClick={clearResults}>
                Clear Results
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.map((result, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {result.type === 'click' ? (
                        <MousePointer className="h-4 w-4" />
                      ) : (
                        <CheckCircle className="h-4 w-4" />
                      )}
                      <span className="font-medium capitalize">{result.type} Tracking</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={result.success ? "default" : "destructive"}>
                        {result.success ? "Success" : "Failed"}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(result.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  
                  {result.success ? (
                    <div className="text-sm">
                      {result.type === 'click' && result.data.tracking_url && (
                        <div>
                          <strong>Tracking URL:</strong>
                          <div className="mt-1 p-2 bg-muted rounded text-xs font-mono break-all">
                            {result.data.tracking_url}
                          </div>
                          <div className="mt-1">
                            <strong>Click ID:</strong> {result.data.click_id}
                          </div>
                        </div>
                      )}
                      {result.type === 'completion' && (
                        <div>
                          <strong>Message:</strong> {result.data.message}
                          <br />
                          <strong>Conversion ID:</strong> {result.data.conversion_id}
                          <br />
                          <strong>Click ID:</strong> {result.data.click_id}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-red-600">
                      <AlertCircle className="h-4 w-4 inline mr-1" />
                      <strong>Error:</strong> {result.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TrackingTestComponent;
