import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { postbackReceiverApi, ReceivedPostback } from '@/services/postbackReceiverApi';
import { partnerApi, Partner } from '@/services/partnerApi';
import { forwardedPostbackApi, ForwardedPostback } from '@/services/forwardedPostbackApi';
import {
  Copy,
  RefreshCw,
  Eye,
  Link as LinkIcon,
  Loader2,
  CheckCircle,
  XCircle,
  Send,
  Key,
  Plus,
  TestTube
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const PostbackReceiver: React.FC = () => {
  const { toast } = useToast();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [receivedPostbacks, setReceivedPostbacks] = useState<ReceivedPostback[]>([]);
  const [forwardedPostbacks, setForwardedPostbacks] = useState<ForwardedPostback[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [selectedPostback, setSelectedPostback] = useState<ReceivedPostback | null>(null);
  const [selectedForwardedPostback, setSelectedForwardedPostback] = useState<ForwardedPostback | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isForwardedDetailModalOpen, setIsForwardedDetailModalOpen] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState('');

  // Quick postback generator state
  const [isQuickGenerateModalOpen, setIsQuickGenerateModalOpen] = useState(false);
  const [selectedParameters, setSelectedParameters] = useState<string[]>([]);
  const [customParams, setCustomParams] = useState<string[]>(['']);
  const [partnerName, setPartnerName] = useState('');
  const [quickGeneratedUrl, setQuickGeneratedUrl] = useState<{
    unique_key: string;
    base_url: string;
    full_url: string;
    parameters: string[];
    partner_name: string;
  } | null>(null);
  const [isGeneratingQuick, setIsGeneratingQuick] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isQuickUrlResultModalOpen, setIsQuickUrlResultModalOpen] = useState(false);
  const [testParams, setTestParams] = useState<Record<string, string>>({});
  const [generatedUrls, setGeneratedUrls] = useState<Array<{ id: string; url: string; partnerName: string; timestamp: string; type: 'quick' | 'partner' }>>([]);

  // Predefined parameters
  const predefinedParameters = [
    { key: 'username', label: 'Username', placeholder: '{username}' },
    { key: 'email', label: 'Email', placeholder: '{email}' },
    { key: 'status', label: 'Status', placeholder: '{status}' },
    { key: 'payout', label: 'Payout', placeholder: '{payout}' },
    { key: 'transaction_id', label: 'Transaction ID', placeholder: '{transaction_id}' },
    { key: 'click_id', label: 'Click ID', placeholder: '{click_id}' },
    { key: 'user_id', label: 'User ID', placeholder: '{user_id}' },
    { key: 'offer_id', label: 'Offer ID', placeholder: '{offer_id}' }
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [partnersData, postbacksData, forwardedData] = await Promise.all([
        partnerApi.getPartners(),
        postbackReceiverApi.getReceivedPostbacks({ limit: 50 }),
        forwardedPostbackApi.getForwardedPostbacks({ limit: 50 })
      ]);
      setPartners(partnersData.partners);
      setReceivedPostbacks(postbacksData.logs);
      setForwardedPostbacks(forwardedData.logs);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateUrl = async (partner: Partner) => {
    try {
      setGenerating(true);
      setSelectedPartner(partner);

      const result = await postbackReceiverApi.generateUniqueKey(partner.partner_id);

      setGeneratedUrl(result.postback_url);
      setIsGenerateModalOpen(true);

      toast({
        title: 'Success',
        description: 'Postback URL generated successfully'
      });

      setGeneratedUrls(prev => [...prev, {
        id: result.unique_key, // Assuming result.unique_key is available or generate one
        url: result.postback_url,
        partnerName: partner.partner_name,
        timestamp: new Date().toISOString(),
        type: 'partner'
      }]);
      // Reload partners to show updated URL
      await loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Copied to clipboard'
    });
  };

  const viewPostbackDetail = async (postback: ReceivedPostback) => {
    setSelectedPostback(postback);
    setIsDetailModalOpen(true);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  // Quick postback generator handlers
  const handleParameterToggle = (parameter: string) => {
    setSelectedParameters(prev =>
      prev.includes(parameter)
        ? prev.filter(p => p !== parameter)
        : [...prev, parameter]
    );
  };

  const handleCustomParamChange = (index: number, value: string) => {
    const newCustomParams = [...customParams];
    newCustomParams[index] = value;
    setCustomParams(newCustomParams);
  };

  const addCustomParam = () => {
    setCustomParams([...customParams, '']);
  };

  const removeCustomParam = (index: number) => {
    setCustomParams(customParams.filter((_, i) => i !== index));
  };

  const generateQuickUrl = async () => {
    if (!partnerName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a partner name',
        variant: 'destructive'
      });
      return;
    }

    if (selectedParameters.length === 0 && customParams.every(p => !p.trim())) {
      toast({
        title: 'Error',
        description: 'Please select at least one parameter',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsGeneratingQuick(true);
      const validCustomParams = customParams.filter(p => p.trim());
      const result = await postbackReceiverApi.generateQuickPostback(selectedParameters, validCustomParams, partnerName.trim());

      setQuickGeneratedUrl(result);
      setIsQuickGenerateModalOpen(false);
      setIsQuickUrlResultModalOpen(true);

      setGeneratedUrls(prev => [...prev, {
        id: result.unique_key,
        url: result.full_url,
        partnerName: result.partner_name,
        timestamp: new Date().toISOString(),
        type: 'quick'
      }]);

      toast({
        title: 'Success',
        description: `Quick postback URL generated successfully for ${partnerName.trim()}`
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingQuick(false);
    }
  };

  const testQuickUrl = async () => {
    if (!quickGeneratedUrl) return;

    try {
      const result = await postbackReceiverApi.testQuickPostback(quickGeneratedUrl.unique_key, testParams);

      // Open the test URL in a new tab
      window.open(result.test_url, '_blank');

      toast({
        title: 'Success',
        description: 'Test URL opened in new tab'
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const resetQuickGenerator = () => {
    setSelectedParameters([]);
    setCustomParams(['']);
    setPartnerName('');
    setQuickGeneratedUrl(null);
    setTestParams({});
    setIsQuickUrlResultModalOpen(false);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Postback Receiver</h1>
        <p className="text-gray-600 mt-1">
          Generate unique postback URLs and monitor incoming postbacks
        </p>
      </div>

      <Tabs defaultValue="received" className="space-y-4">
        <TabsList>
          <TabsTrigger value="received">Received Postbacks</TabsTrigger>
          <TabsTrigger value="forwarded">Forwarded Postbacks</TabsTrigger>
          <TabsTrigger value="generate">Generate URLs</TabsTrigger>
        </TabsList>

        {/* Generate URLs Tab */}
        <TabsContent value="generate" className="space-y-4">
          {/* Quick Generate Button */}
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Quick Postback Generator</h3>
              <p className="text-sm text-gray-600">Generate postback URLs instantly without partner setup</p>
            </div>
            <Button
              onClick={() => setIsQuickGenerateModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Generate New Postback URL
            </Button>
          </div>

          {/* Quick Generated URLs Display */}
          {quickGeneratedUrl && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-green-800">Quick Generated URL</CardTitle>
                <CardDescription className="text-green-700">
                  This URL was generated for <strong>{quickGeneratedUrl.partner_name}</strong> and is ready to share
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-green-800">Base URL</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={quickGeneratedUrl.base_url}
                      readOnly
                      className="font-mono text-sm bg-white"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(quickGeneratedUrl.base_url)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-green-800">Full URL with Parameters</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={quickGeneratedUrl.full_url}
                      readOnly
                      className="font-mono text-sm bg-white"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(quickGeneratedUrl.full_url)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsTestModalOpen(true)}
                  >
                    <TestTube className="h-4 w-4 mr-2" />
                    Test URL
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuickGeneratedUrl(null)}
                    className="text-red-600 hover:text-red-700"
                  >
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* All Generated URLs Display */}
          {generatedUrls.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>All Generated Postback URLs</CardTitle>
                <CardDescription>
                  A history of all postback URLs generated in this session.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Partner Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {generatedUrls.map((genUrl) => (
                      <TableRow key={genUrl.id}>
                        <TableCell className="text-sm">
                          {formatTimestamp(genUrl.timestamp)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {genUrl.partnerName}
                        </TableCell>
                        <TableCell>
                          <Badge variant={genUrl.type === 'quick' ? 'default' : 'secondary'}>
                            {genUrl.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded truncate">
                            {genUrl.url}
                          </code>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(genUrl.url)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Partner Postback URLs</CardTitle>
              <CardDescription>
                Create unique postback receiver URLs for each partner
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center h-32">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Partner Name</TableHead>
                      <TableHead>Partner ID</TableHead>
                      <TableHead>Current Receiver URL</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partners.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-gray-500">
                          No partners found. Add partners first.
                        </TableCell>
                      </TableRow>
                    ) : (
                      partners.map((partner) => (
                        <TableRow key={partner.partner_id}>
                          <TableCell className="font-medium">
                            {partner.partner_name}
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {partner.partner_id}
                            </code>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            {partner.postback_receiver_url ? (
                              <div className="flex items-center gap-2">
                                <code className="text-xs bg-green-50 px-2 py-1 rounded truncate">
                                  {partner.postback_receiver_url}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(partner.postback_receiver_url!)}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">Not generated</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={partner.status === 'active' ? 'default' : 'secondary'}>
                              {partner.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => handleGenerateUrl(partner)}
                              disabled={generating}
                            >
                              {generating ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <Key className="h-4 w-4 mr-2" />
                              )}
                              {partner.postback_receiver_url ? 'Regenerate' : 'Generate'} URL
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* How to Use Section */}
          <Card>
            <CardHeader>
              <CardTitle>How to Use</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-semibold">Step 1: Generate URL</h4>
                <p className="text-sm text-gray-600">
                  Click "Generate URL" for a partner to create their unique postback receiver URL.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">Step 2: Share with Partner</h4>
                <p className="text-sm text-gray-600">
                  Give the generated URL to your partner. They can add parameters like:
                </p>
                <code className="block text-xs bg-gray-100 p-2 rounded mt-2">
                  https://your-backend.com/postback/UNIQUE_KEY?username=...&status=...
                </code>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">Step 3: Receive Postbacks</h4>
                <p className="text-sm text-gray-600">
                  When the partner sends a postback, it will appear in the "Received Postbacks" tab with all parameters logged.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Received Postbacks Tab */}
        <TabsContent value="received" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Received Postbacks</CardTitle>
                  <CardDescription>
                    View all incoming postback requests
                  </CardDescription>
                </div>
                <Button onClick={loadData} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center h-32">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Partner</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Parameters</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receivedPostbacks.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-gray-500">
                          No postbacks received yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      receivedPostbacks.map((postback) => (
                        <TableRow key={postback._id}>
                          <TableCell className="text-sm">
                            {formatTimestamp(postback.timestamp)}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{postback.partner_name}</div>
                              <div className="text-xs text-gray-500">{postback.partner_id}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={postback.method === 'GET' ? 'default' : 'secondary'}>
                              {postback.method}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs">
                              {Object.keys(postback.query_params).length} params
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {postback.ip_address}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => viewPostbackDetail(postback)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Forwarded Postbacks Tab */}
        <TabsContent value="forwarded" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Forwarded Postbacks</CardTitle>
                  <CardDescription>
                    Postbacks forwarded to downward partners with enriched data (username + points)
                  </CardDescription>
                </div>
                <Button onClick={loadData} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center h-32">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Publisher</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Points</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {forwardedPostbacks.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-gray-500">
                          No forwarded postbacks yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      forwardedPostbacks.map((postback) => (
                        <TableRow key={postback._id}>
                          <TableCell className="text-sm">
                            {formatTimestamp(postback.timestamp)}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{postback.publisher_name}</div>
                              <div className="text-xs text-gray-500">{postback.publisher_id}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {postback.username}
                            </code>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {postback.points} pts
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {postback.forward_status === 'success' ? (
                              <Badge variant="default" className="bg-green-500">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Success
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <XCircle className="h-3 w-3 mr-1" />
                                Failed
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedForwardedPostback(postback);
                                setIsForwardedDetailModalOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Generate URL Modal */}
      <Dialog open={isGenerateModalOpen} onOpenChange={setIsGenerateModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Postback URL Generated</DialogTitle>
            <DialogDescription>
              Share this URL with {selectedPartner?.partner_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Base URL</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={generatedUrl}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button onClick={() => copyToClipboard(generatedUrl)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <Label>URL with Parameters (Example)</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={generatedUrl + "?username={username}&status={status}&payout={payout}&transaction_id={transaction_id}"}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button onClick={() => copyToClipboard(generatedUrl + "?username={username}&status={status}&payout={payout}&transaction_id={transaction_id}")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Partners can add any parameters they need. All will be logged.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">Instructions for Partner:</h4>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Use the URL above as your postback endpoint</li>
                <li>Add your parameters in the query string</li>
                <li>Send GET or POST requests when conversions occur</li>
                <li>All requests will be logged and visible in your dashboard</li>
              </ol>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Postback Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Postback Details</DialogTitle>
            <DialogDescription>
              Complete information about this postback request
            </DialogDescription>
          </DialogHeader>

          {selectedPostback && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-600">Partner</Label>
                  <div className="font-medium">{selectedPostback.partner_name}</div>
                  <div className="text-xs text-gray-500">{selectedPostback.partner_id}</div>
                </div>
                <div>
                  <Label className="text-gray-600">Timestamp</Label>
                  <div className="font-medium">{formatTimestamp(selectedPostback.timestamp)}</div>
                </div>
                <div>
                  <Label className="text-gray-600">Method</Label>
                  <Badge variant={selectedPostback.method === 'GET' ? 'default' : 'secondary'}>
                    {selectedPostback.method}
                  </Badge>
                </div>
                <div>
                  <Label className="text-gray-600">IP Address</Label>
                  <div className="font-medium">{selectedPostback.ip_address}</div>
                </div>
              </div>

              <div>
                <Label className="text-gray-600">Query Parameters</Label>
                <div className="mt-2 bg-gray-50 rounded-lg p-3">
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(selectedPostback.query_params, null, 2)}
                  </pre>
                </div>
              </div>

              {Object.keys(selectedPostback.post_data).length > 0 && (
                <div>
                  <Label className="text-gray-600">POST Data</Label>
                  <div className="mt-2 bg-gray-50 rounded-lg p-3">
                    <pre className="text-xs overflow-auto">
                      {JSON.stringify(selectedPostback.post_data, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              <div>
                <Label className="text-gray-600">User Agent</Label>
                <div className="text-sm text-gray-700 mt-1">{selectedPostback.user_agent}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Forwarded Postback Detail Modal */}
      <Dialog open={isForwardedDetailModalOpen} onOpenChange={setIsForwardedDetailModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Forwarded Postback Details</DialogTitle>
            <DialogDescription>
              Complete information about this forwarded postback
            </DialogDescription>
          </DialogHeader>

          {selectedForwardedPostback && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-600">Publisher</Label>
                  <div className="font-medium">{selectedForwardedPostback.publisher_name}</div>
                  <div className="text-xs text-gray-500">{selectedForwardedPostback.publisher_id}</div>
                </div>
                <div>
                  <Label className="text-gray-600">Timestamp</Label>
                  <div className="font-medium">{formatTimestamp(selectedForwardedPostback.timestamp)}</div>
                </div>
                <div>
                  <Label className="text-gray-600">Username</Label>
                  <code className="text-sm bg-gray-100 px-2 py-1 rounded">{selectedForwardedPostback.username}</code>
                </div>
                <div>
                  <Label className="text-gray-600">Points</Label>
                  <Badge variant="secondary">{selectedForwardedPostback.points} points</Badge>
                </div>
                <div>
                  <Label className="text-gray-600">Forward Status</Label>
                  {selectedForwardedPostback.forward_status === 'success' ? (
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Success
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <XCircle className="h-3 w-3 mr-1" />
                      Failed
                    </Badge>
                  )}
                </div>
                {selectedForwardedPostback.response_code && (
                  <div>
                    <Label className="text-gray-600">Response Code</Label>
                    <Badge variant={selectedForwardedPostback.response_code === 200 ? 'default' : 'destructive'}>
                      {selectedForwardedPostback.response_code}
                    </Badge>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-gray-600">Forward URL</Label>
                <div className="mt-2 bg-gray-50 rounded-lg p-3">
                  <code className="text-xs break-all">{selectedForwardedPostback.forward_url}</code>
                </div>
              </div>

              <div>
                <Label className="text-gray-600">Original Parameters</Label>
                <div className="mt-2 bg-gray-50 rounded-lg p-3">
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(selectedForwardedPostback.original_params, null, 2)}
                  </pre>
                </div>
              </div>

              <div>
                <Label className="text-gray-600">Enriched Parameters (with username & points)</Label>
                <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-3">
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(selectedForwardedPostback.enriched_params, null, 2)}
                  </pre>
                </div>
              </div>

              {selectedForwardedPostback.error_message && (
                <div>
                  <Label className="text-gray-600">Error Message</Label>
                  <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                    {selectedForwardedPostback.error_message}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick Generate Modal */}
      <Dialog open={isQuickGenerateModalOpen} onOpenChange={setIsQuickGenerateModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Generate Custom Postback URL</DialogTitle>
            <DialogDescription>
              Select parameters and generate a postback URL instantly
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Partner Name Input */}
            <div>
              <Label className="text-base font-semibold mb-4 block">Partner Information</Label>
              <div className="space-y-2">
                <Label htmlFor="partner-name">Partner Name *</Label>
                <Input
                  id="partner-name"
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  placeholder="Enter partner name (e.g., Advertiser ABC, Network XYZ)"
                  className="w-full"
                />
                <p className="text-xs text-gray-500">
                  This helps identify which partner the postback URL is for
                </p>
              </div>
            </div>

            {/* Parameter Selection */}
            <div>
              <Label className="text-base font-semibold mb-4 block">Select Parameters</Label>
              <div className="grid grid-cols-2 gap-3">
                {predefinedParameters.map((param) => (
                  <div key={param.key} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={param.key}
                      checked={selectedParameters.includes(param.key)}
                      onChange={() => handleParameterToggle(param.key)}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor={param.key} className="text-sm font-medium">
                      {param.label}
                    </Label>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {param.placeholder}
                    </code>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Parameters */}
            <div>
              <Label className="text-base font-semibold mb-4 block">Custom Parameters</Label>
              <div className="space-y-2">
                {customParams.map((param, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Input
                      value={param}
                      onChange={(e) => handleCustomParamChange(index, e.target.value)}
                      placeholder="Enter custom parameter name"
                      className="flex-1"
                    />
                    {customParams.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeCustomParam(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addCustomParam}
                  className="w-full"
                >
                  Add Custom Parameter
                </Button>
              </div>
            </div>

            {/* URL Preview */}
            <div>
              <Label className="text-base font-semibold mb-4 block">URL Preview</Label>
              <div className="space-y-3">
                <div>
                  <Label className="text-sm text-gray-600">Base URL</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value="https://moustacheleads-backend.onrender.com/postback/{unique_key}"
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard("https://moustacheleads-backend.onrender.com/postback/{unique_key}")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-sm text-gray-600">Full URL with Parameters</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={(() => {
                        const allParams = [...selectedParameters, ...customParams.filter(p => p.trim())];
                        if (allParams.length === 0) {
                          return "https://moustacheleads-backend.onrender.com/postback/{unique_key}";
                        }
                        const paramString = allParams.map(p => `${p}={${p}}`).join('&');
                        return `https://moustacheleads-backend.onrender.com/postback/{unique_key}?${paramString}`;
                      })()}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const allParams = [...selectedParameters, ...customParams.filter(p => p.trim())];
                        if (allParams.length === 0) {
                          copyToClipboard("https://moustacheleads-backend.onrender.com/postback/{unique_key}");
                        } else {
                          const paramString = allParams.map(p => `${p}={${p}}`).join('&');
                          copyToClipboard(`https://moustacheleads-backend.onrender.com/postback/{unique_key}?${paramString}`);
                        }
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsQuickGenerateModalOpen(false);
                  resetQuickGenerator();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={generateQuickUrl}
                disabled={isGeneratingQuick || !partnerName.trim() || (selectedParameters.length === 0 && customParams.every(p => !p.trim()))}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isGeneratingQuick ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Key className="h-4 w-4 mr-2" />
                )}
                Generate URL
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generated URL Modal */}
      <Dialog open={isQuickUrlResultModalOpen} onOpenChange={setIsQuickUrlResultModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Postback URL Generated</DialogTitle>
            <DialogDescription>
              Your custom postback URL for <strong>{quickGeneratedUrl?.partner_name}</strong> is ready to share
            </DialogDescription>
          </DialogHeader>

          {quickGeneratedUrl && (
            <div className="space-y-4">
              <div>
                <Label>Base URL</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={quickGeneratedUrl.base_url}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button onClick={() => copyToClipboard(quickGeneratedUrl.base_url)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label>Full URL with Parameters</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={quickGeneratedUrl.full_url}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button onClick={() => copyToClipboard(quickGeneratedUrl.full_url)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Instructions:</h4>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Share this URL with your partner</li>
                  <li>They can add their data in place of the parameter placeholders</li>
                  <li>All postbacks will be logged and visible in the "Received Postbacks" tab</li>
                </ol>
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setIsTestModalOpen(true)}
                >
                  <TestTube className="h-4 w-4 mr-2" />
                  Test URL
                </Button>
                <Button
                  onClick={() => {
                    setQuickGeneratedUrl(null);
                    setIsQuickUrlResultModalOpen(false);
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Test Modal */}
      <Dialog open={isTestModalOpen} onOpenChange={setIsTestModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Test Postback URL</DialogTitle>
            <DialogDescription>
              Enter test values to test your postback URL
            </DialogDescription>
          </DialogHeader>

          {quickGeneratedUrl && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {quickGeneratedUrl.parameters.map((param) => (
                  <div key={param}>
                    <Label htmlFor={`test-${param}`}>{param}</Label>
                    <Input
                      id={`test-${param}`}
                      value={testParams[param] || ''}
                      onChange={(e) => setTestParams(prev => ({ ...prev, [param]: e.target.value }))}
                      placeholder={`Enter test ${param}`}
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setIsTestModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={testQuickUrl}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <TestTube className="h-4 w-4 mr-2" />
                  Test URL
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PostbackReceiver;