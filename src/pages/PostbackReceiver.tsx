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
import { 
  Copy, 
  RefreshCw, 
  Eye, 
  Link as LinkIcon, 
  Loader2,
  CheckCircle,
  XCircle,
  Send,
  Key
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const PostbackReceiver: React.FC = () => {
  const { toast } = useToast();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [receivedPostbacks, setReceivedPostbacks] = useState<ReceivedPostback[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [selectedPostback, setSelectedPostback] = useState<ReceivedPostback | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [partnersData, postbacksData] = await Promise.all([
        partnerApi.getPartners(),
        postbackReceiverApi.getReceivedPostbacks({ limit: 50 })
      ]);
      setPartners(partnersData.partners);
      setReceivedPostbacks(postbacksData.logs);
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

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Postback Receiver</h1>
        <p className="text-gray-600 mt-1">
          Generate unique postback URLs and monitor incoming postbacks
        </p>
      </div>

      <Tabs defaultValue="generate" className="space-y-4">
        <TabsList>
          <TabsTrigger value="generate">Generate URLs</TabsTrigger>
          <TabsTrigger value="received">Received Postbacks</TabsTrigger>
        </TabsList>

        {/* Generate URLs Tab */}
        <TabsContent value="generate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generate Postback URLs</CardTitle>
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
                            {(partner as any).postback_receiver_url ? (
                              <div className="flex items-center gap-2">
                                <code className="text-xs bg-green-50 px-2 py-1 rounded truncate">
                                  {(partner as any).postback_receiver_url}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard((partner as any).postback_receiver_url)}
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
                              {(partner as any).postback_receiver_url ? 'Regenerate' : 'Generate'} URL
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
                  https://moustacheleads-backend.onrender.com/postback/abc123?username=&#123;username&#125;&status=&#123;status&#125;&payout=&#123;payout&#125;&transaction_id=&#123;transaction_id&#125;
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
                  value={`${generatedUrl}?username={username}&status={status}&payout={payout}&transaction_id={transaction_id}`}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button onClick={() => copyToClipboard(`${generatedUrl}?username={username}&status={status}&payout={payout}&transaction_id={transaction_id}`)}>
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
    </div>
  );
};

export default PostbackReceiver;
