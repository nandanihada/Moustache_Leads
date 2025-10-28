import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, MousePointer, AlertCircle, ExternalLink, Play, Settings } from 'lucide-react';

const TrackingTest = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  
  const [availableOffers, setAvailableOffers] = useState<any[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  
  const [testForm, setTestForm] = useState({
    offerId: '',
    affiliateId: '',
    payout: '5.00'
  });

  // Load available offers and users
  useEffect(() => {
    loadAvailableData();
  }, []);

  const loadAvailableData = async () => {
    try {
      setLoadingData(true);
      
      // Load offers and users in parallel
      const [offersResponse, usersResponse] = await Promise.all([
        fetch('https://moustacheleads-backend.onrender.com/api/test/available-offers'),
        fetch('https://moustacheleads-backend.onrender.com/api/test/sample-users')
      ]);

      if (offersResponse.ok) {
        const offersData = await offersResponse.json();
        setAvailableOffers(offersData.offers || []);
        
        // Auto-select first offer if available
        if (offersData.offers && offersData.offers.length > 0) {
          const firstOffer = offersData.offers[0];
          setTestForm(prev => ({
            ...prev,
            offerId: firstOffer.offer_id,
            payout: firstOffer.payout?.toString() || '5.00'
          }));
        }
      }

      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setAvailableUsers(usersData.users || []);
        
        // Auto-select first user if available
        if (usersData.users && usersData.users.length > 0) {
          const firstUser = usersData.users[0];
          const userId = firstUser.user_id || firstUser._id || firstUser.username;
          setTestForm(prev => ({
            ...prev,
            affiliateId: userId
          }));
        }
      }

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Warning",
        description: "Could not load available offers/users. You can still enter them manually.",
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
  };

  const setupTestEnvironment = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('https://moustacheleads-backend.onrender.com/api/test/setup-test-offer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      // Update form with setup data
      setTestForm(prev => ({
        ...prev,
        offerId: data.offer.offer_id,
        payout: data.offer.payout?.toString() || '5.00'
      }));

      // Reload available data
      await loadAvailableData();

      toast({
        title: "Success",
        description: "Test environment setup completed! Offer linked to test partner.",
      });

    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to setup test environment",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const runCompleteTest = async () => {
    if (!testForm.offerId || !testForm.affiliateId || testForm.affiliateId === 'nan') {
      toast({
        title: "Error",
        description: "Please select valid Offer ID and Affiliate ID",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      // Call the simple test endpoint (fallback)
      const response = await fetch('https://moustacheleads-backend.onrender.com/simple-tracking-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          offer_id: testForm.offerId,
          affiliate_id: testForm.affiliateId,
          payout: parseFloat(testForm.payout),
          test_completion: true
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const result = {
        type: 'complete_flow',
        timestamp: new Date().toISOString(),
        success: data.success,
        data: data.results
      };

      setResults(prev => [result, ...prev]);
      
      toast({
        title: "Success",
        description: "Complete tracking flow test completed successfully!",
      });

    } catch (error) {
      const result = {
        type: 'complete_flow',
        timestamp: new Date().toISOString(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      setResults(prev => [result, ...prev]);
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Test failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateTrackingLink = async () => {
    if (!testForm.offerId || !testForm.affiliateId) {
      toast({
        title: "Error",
        description: "Offer ID and Affiliate ID are required",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      const response = await fetch('https://moustacheleads-backend.onrender.com/generate-tracking-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          offer_id: testForm.offerId,
          affiliate_id: testForm.affiliateId,
          sub_ids: ['test_sub1', 'test_sub2']
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const result = {
        type: 'generate_link',
        timestamp: new Date().toISOString(),
        success: data.success,
        data: data
      };

      setResults(prev => [result, ...prev]);
      
      toast({
        title: "Success",
        description: "Tracking link generated successfully!",
      });

    } catch (error) {
      const result = {
        type: 'generate_link',
        timestamp: new Date().toISOString(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      setResults(prev => [result, ...prev]);
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate link",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const clearResults = () => {
    setResults([]);
  };

  const getStepIcon = (step: number) => {
    switch (step) {
      case 1: return <ExternalLink className="h-4 w-4" />;
      case 2: return <MousePointer className="h-4 w-4" />;
      case 3: return <CheckCircle className="h-4 w-4" />;
      default: return <Play className="h-4 w-4" />;
    }
  };

  const getStepName = (step: number) => {
    switch (step) {
      case 1: return 'Generate Link';
      case 2: return 'Record Click';
      case 3: return 'Record Completion';
      default: return 'Unknown';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">End-to-End Tracking Test</h1>
          <p className="text-muted-foreground">
            Test the complete tracking flow: Generate Link → Click → Complete → Postback
          </p>
        </div>
      </div>

      {/* Test Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Tracking Flow Test
          </CardTitle>
          <CardDescription>
            This will simulate the complete publisher flow and check postback logs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingData && (
            <div className="text-center py-4 text-muted-foreground">
              Loading available offers and users...
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="offer-id">Offer ID</Label>
              {availableOffers.length > 0 ? (
                <Select value={testForm.offerId} onValueChange={(value) => {
                  const selectedOffer = availableOffers.find(o => o.offer_id === value);
                  setTestForm(prev => ({ 
                    ...prev, 
                    offerId: value,
                    payout: selectedOffer?.payout?.toString() || prev.payout
                  }));
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an offer" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableOffers.map((offer) => (
                      <SelectItem key={offer.offer_id} value={offer.offer_id}>
                        <div className="flex flex-col">
                          <span>{offer.offer_id}</span>
                          <span className="text-xs text-muted-foreground">
                            {offer.name} - ${offer.payout} 
                            {offer.partner_info?.has_postback_url ? ' ✅' : ' ⚠️ No postback'}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="offer-id"
                  value={testForm.offerId}
                  onChange={(e) => setTestForm(prev => ({ ...prev, offerId: e.target.value }))}
                  placeholder="ML-00001"
                />
              )}
            </div>
            
            <div>
              <Label htmlFor="affiliate-id">Affiliate/Publisher ID</Label>
              {availableUsers.length > 0 ? (
                <Select value={testForm.affiliateId} onValueChange={(value) => setTestForm(prev => ({ ...prev, affiliateId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((user) => {
                      const userId = user.user_id || user._id || user.username;
                      return (
                        <SelectItem key={userId} value={userId}>
                          <div className="flex flex-col">
                            <span>{user.username || 'Unknown User'}</span>
                            <span className="text-xs text-muted-foreground">
                              {user.role || 'user'} - {userId?.slice(0, 8)}...
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="affiliate-id"
                  value={testForm.affiliateId}
                  onChange={(e) => setTestForm(prev => ({ ...prev, affiliateId: e.target.value }))}
                  placeholder="test_user_123"
                />
              )}
            </div>

            <div>
              <Label htmlFor="payout">Payout Amount ($)</Label>
              <Input
                id="payout"
                type="number"
                step="0.01"
                value={testForm.payout}
                onChange={(e) => setTestForm(prev => ({ ...prev, payout: e.target.value }))}
                placeholder="5.00"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <Button 
              onClick={runCompleteTest} 
              disabled={loading || loadingData}
              className="flex-1"
            >
              <Play className="h-4 w-4 mr-2" />
              {loading ? 'Running Test...' : 'Run Complete Flow Test'}
            </Button>
            
            <Button 
              onClick={generateTrackingLink} 
              disabled={loading || loadingData}
              variant="outline"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Generate Link Only
            </Button>
            
            <Button 
              onClick={setupTestEnvironment} 
              disabled={loading || loadingData}
              variant="secondary"
            >
              <Settings className="h-4 w-4 mr-2" />
              Auto Setup
            </Button>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">What this test does:</h4>
            <ol className="text-sm text-blue-800 space-y-1">
              <li><strong>1. Generate Link:</strong> Creates a tracking link for the offer</li>
              <li><strong>2. Simulate Click:</strong> Records the click in the database</li>
              <li><strong>3. Simulate Completion:</strong> Records offer completion</li>
              <li><strong>4. Queue Postback:</strong> Automatically queues postback to partner</li>
              <li><strong>5. Check Results:</strong> View in Admin → Tracking and Admin → Postback Logs</li>
            </ol>
          </div>

          {(testForm.affiliateId === 'nan' || testForm.affiliateId === '') && (
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h4 className="font-medium text-yellow-900 mb-2">⚠️ Manual Setup Required</h4>
              <p className="text-sm text-yellow-800 mb-3">
                Auto-loading failed. Please enter a valid user ID manually:
              </p>
              <div className="space-y-2">
                <p className="text-xs text-yellow-700">
                  <strong>Option 1:</strong> Use any MongoDB ObjectId (24 characters): <code>67123abc456def789012345</code>
                </p>
                <p className="text-xs text-yellow-700">
                  <strong>Option 2:</strong> Use a simple test ID: <code>test_user_123</code>
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Test Results</CardTitle>
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
                      <Play className="h-4 w-4" />
                      <span className="font-medium">
                        {result.type === 'complete_flow' ? 'Complete Flow Test' : 'Generate Link Test'}
                      </span>
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
                      {result.type === 'complete_flow' && result.data.steps && (
                        <div className="space-y-2">
                          <div><strong>Offer:</strong> {result.data.offer_id}</div>
                          <div><strong>Affiliate:</strong> {result.data.affiliate_id}</div>
                          <div><strong>Steps Completed:</strong></div>
                          {result.data.steps.map((step: any, stepIndex: number) => (
                            <div key={stepIndex} className="ml-4 flex items-center gap-2">
                              {getStepIcon(step.step)}
                              <span className={step.success ? 'text-green-600' : 'text-red-600'}>
                                {step.step}. {getStepName(step.step)}: {step.success ? '✅' : '❌'}
                              </span>
                              {step.data && step.step === 1 && (
                                <span className="text-xs text-muted-foreground">
                                  Click ID: {step.data.click_id?.slice(0, 8)}...
                                </span>
                              )}
                              {step.data && step.step === 3 && (
                                <span className="text-xs text-muted-foreground">
                                  Conversion ID: {step.data.conversion_id?.slice(0, 8)}...
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {result.type === 'generate_link' && (
                        <div>
                          <div><strong>Tracking URL:</strong></div>
                          <div className="mt-1 p-2 bg-muted rounded text-xs font-mono break-all">
                            {result.data.tracking_url}
                          </div>
                          <div className="mt-1">
                            <strong>Click ID:</strong> {result.data.click_id}
                          </div>
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

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Next Steps - Check Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">1. Check Real-time Tracking:</h4>
              <p className="text-sm text-muted-foreground">
                Go to <strong>Admin → Tracking</strong> to see live tracking events (clicks, completions)
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">2. Check Postback Logs:</h4>
              <p className="text-sm text-muted-foreground">
                Go to <strong>Admin → Postback Logs</strong> to see if postbacks were sent to partners
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">3. Generate Reports:</h4>
              <p className="text-sm text-muted-foreground">
                Go to <strong>Admin → Reports</strong> to generate analytics reports
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TrackingTest;
