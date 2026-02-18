import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { AdminPageGuard } from '@/components/AdminPageGuard';
import {
  MousePointerClick,
  TrendingUp,
  AlertTriangle,
  Star,
  Mail,
  Send,
  Eye,
  Users,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  History,
  Sparkles
} from 'lucide-react';
import {
  offerInsightsApi,
  InsightType,
  InsightOffer,
  Partner,
  EmailHistoryItem
} from '@/services/offerInsightsApi';

// Default placeholder image as data URI to avoid external image loading issues
const PLACEHOLDER_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIGZpbGw9IiNFNUU3RUIiLz48cGF0aCBkPSJNMjUgMjVIMzVWMzVIMjVWMjVaIiBmaWxsPSIjOUI5QkEzIi8+PHBhdGggZD0iTTIwIDQwTDI3LjUgMzJMMzIuNSAzN0wzNy41IDMwTDQ1IDQwSDIwWiIgZmlsbD0iIzlCOUJBMyIvPjwvc3ZnPg==';

const INSIGHT_CATEGORIES = [
  {
    id: 'highest_clicks' as InsightType,
    title: 'Highest Clicks',
    description: 'Offers getting the most traffic',
    icon: MousePointerClick,
    color: 'bg-orange-500',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-600'
  },
  {
    id: 'highest_conversions' as InsightType,
    title: 'Top Conversions',
    description: 'Best converting offers',
    icon: TrendingUp,
    color: 'bg-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-600'
  },
  {
    id: 'high_clicks_low_conversion' as InsightType,
    title: 'Optimization Needed',
    description: 'High clicks, low conversions',
    icon: AlertTriangle,
    color: 'bg-yellow-500',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-600'
  },
  {
    id: 'most_requested' as InsightType,
    title: 'Most Requested',
    description: 'Popular demand offers',
    icon: Star,
    color: 'bg-purple-500',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-600'
  }
];

const AdminOfferInsights = () => {
  const { toast } = useToast();
  
  // State
  const [selectedCategory, setSelectedCategory] = useState<InsightType>('highest_clicks');
  const [offers, setOffers] = useState<InsightOffer[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [emailHistory, setEmailHistory] = useState<EmailHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [partnersLoading, setPartnersLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  
  // Selection state
  const [selectedOffer, setSelectedOffer] = useState<InsightOffer | null>(null);
  const [selectedPartners, setSelectedPartners] = useState<Set<string>>(new Set());
  const [partnerSearch, setPartnerSearch] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  
  // Modal state
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [sending, setSending] = useState(false);

  // Fetch offers when category changes
  useEffect(() => {
    fetchOffers();
  }, [selectedCategory]);

  // Fetch partners, email history on mount only
  useEffect(() => {
    const loadInitialData = async () => {
      setInitialLoading(true);
      // Load these in parallel but don't cause re-renders
      await Promise.all([
        fetchPartners(),
        fetchEmailHistory()
      ]);
      setInitialLoading(false);
    };
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const response = await offerInsightsApi.getOfferInsights(selectedCategory, 10, 30);
      setOffers(response.offers || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch offer insights',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPartners = async () => {
    setPartnersLoading(true);
    try {
      const response = await offerInsightsApi.getPartners(partnerSearch);
      setPartners(response.partners || []);
    } catch (error) {
      console.error('Failed to fetch partners:', error);
    } finally {
      setPartnersLoading(false);
    }
  };

  const fetchEmailHistory = async () => {
    try {
      const response = await offerInsightsApi.getEmailHistory();
      setEmailHistory(response.history || []);
    } catch (error) {
      console.error('Failed to fetch email history:', error);
    }
  };

  const handleSelectOffer = (offer: InsightOffer) => {
    setSelectedOffer(offer);
    setEmailModalOpen(true);
    setSelectedPartners(new Set());
    setCustomMessage('');
  };

  const handlePreviewEmail = async () => {
    if (!selectedOffer) return;
    
    try {
      const response = await offerInsightsApi.previewEmail(
        selectedCategory,
        selectedOffer,
        customMessage
      );
      setPreviewHtml(response.html);
      setPreviewModalOpen(true);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to preview email',
        variant: 'destructive'
      });
    }
  };

  const handleSendEmails = async () => {
    if (!selectedOffer || selectedPartners.size === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one partner',
        variant: 'destructive'
      });
      return;
    }

    setSending(true);
    try {
      const response = await offerInsightsApi.sendEmails(
        selectedCategory,
        selectedOffer,
        Array.from(selectedPartners),
        customMessage
      );
      
      toast({
        title: 'Emails Sent!',
        description: `Successfully sent ${response.sent_count} emails. ${response.failed_count} failed.`,
      });
      
      setEmailModalOpen(false);
      fetchEmailHistory();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send emails',
        variant: 'destructive'
      });
    } finally {
      setSending(false);
    }
  };

  const togglePartnerSelection = (partnerId: string) => {
    const newSelection = new Set(selectedPartners);
    if (newSelection.has(partnerId)) {
      newSelection.delete(partnerId);
    } else {
      newSelection.add(partnerId);
    }
    setSelectedPartners(newSelection);
  };

  const selectAllPartners = () => {
    if (selectedPartners.size === partners.length) {
      setSelectedPartners(new Set());
    } else {
      setSelectedPartners(new Set(partners.map(p => p._id)));
    }
  };

  const currentCategory = INSIGHT_CATEGORIES.find(c => c.id === selectedCategory);

  return (
    <div className="space-y-6 p-6">
      {/* Initial Loading Overlay */}
      {initialLoading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading insights...</p>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-purple-500" />
            Offer Insights & Email Campaigns
          </h1>
          <p className="text-muted-foreground mt-1">
            Send targeted emails to partners about top-performing offers
          </p>
        </div>
        <Button variant="outline" onClick={fetchOffers} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {INSIGHT_CATEGORIES.map((category) => {
          const Icon = category.icon;
          const isSelected = selectedCategory === category.id;
          
          return (
            <Card
              key={category.id}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                isSelected 
                  ? `ring-2 ring-offset-2 ${category.borderColor} ${category.bgColor}` 
                  : 'hover:border-gray-300'
              }`}
              onClick={() => setSelectedCategory(category.id)}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${category.color}`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{category.title}</h3>
                    <p className="text-sm text-muted-foreground">{category.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="offers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="offers" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Top Offers
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Email History
          </TabsTrigger>
        </TabsList>

        {/* Offers Tab */}
        <TabsContent value="offers">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {currentCategory && (
                  <>
                    <currentCategory.icon className={`h-5 w-5 ${currentCategory.textColor}`} />
                    {currentCategory.title}
                  </>
                )}
              </CardTitle>
              <CardDescription>
                Click on an offer to send email campaign to partners
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : offers.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No offers found for this category</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {offers.map((offer, index) => (
                    <Card
                      key={offer.offer_id}
                      className={`cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] ${currentCategory?.bgColor} ${currentCategory?.borderColor} border`}
                      onClick={() => handleSelectOffer(offer)}
                    >
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <div className="relative">
                            <Badge 
                              className={`absolute -top-2 -left-2 ${currentCategory?.color} text-white`}
                            >
                              #{index + 1}
                            </Badge>
                            <img
                              src={offer.image_url || PLACEHOLDER_IMAGE}
                              alt={offer.name}
                              className="w-16 h-16 rounded-lg object-cover border-2 border-white shadow"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE;
                              }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold truncate">{offer.name}</h4>
                            <Badge variant="outline" className="mt-1 text-xs">
                              {offer.category || 'General'}
                            </Badge>
                            <div className="flex items-center gap-4 mt-2">
                              <div>
                                <span className="text-xs text-muted-foreground">Payout</span>
                                <p className="font-bold text-green-600">${offer.payout.toFixed(2)}</p>
                              </div>
                              <div>
                                <span className="text-xs text-muted-foreground capitalize">
                                  {offer.metric_label}
                                </span>
                                <p className={`font-bold ${currentCategory?.textColor}`}>
                                  {offer.metric_value.toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <Button 
                          className="w-full mt-4" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectOffer(offer);
                          }}
                        >
                          <Mail className="h-4 w-4 mr-2" />
                          Send Email Campaign
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Email Campaign History
              </CardTitle>
              <CardDescription>
                Recent email campaigns sent to partners
              </CardDescription>
            </CardHeader>
            <CardContent>
              {emailHistory.length === 0 ? (
                <div className="text-center py-12">
                  <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No email campaigns sent yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Offer</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Failed</TableHead>
                      <TableHead>Sent By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emailHistory.map((item) => {
                      const category = INSIGHT_CATEGORIES.find(c => c.id === item.insight_type);
                      return (
                        <TableRow key={item._id}>
                          <TableCell>
                            {new Date(item.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge className={category?.color}>
                              {category?.title || item.insight_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{item.offer_name}</TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="h-4 w-4" />
                              {item.sent_count}
                            </span>
                          </TableCell>
                          <TableCell>
                            {item.failed_count > 0 ? (
                              <span className="flex items-center gap-1 text-red-600">
                                <XCircle className="h-4 w-4" />
                                {item.failed_count}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell>{item.sent_by}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Email Campaign Modal */}
      <Dialog open={emailModalOpen} onOpenChange={setEmailModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Send Email Campaign
            </DialogTitle>
            <DialogDescription>
              Send targeted email about this offer to selected partners
            </DialogDescription>
          </DialogHeader>

          {selectedOffer && (
            <div className="space-y-6">
              {/* Selected Offer Preview */}
              <div className={`p-4 rounded-lg ${currentCategory?.bgColor} ${currentCategory?.borderColor} border`}>
                <div className="flex items-center gap-4">
                  <img
                    src={selectedOffer.image_url || PLACEHOLDER_IMAGE}
                    alt={selectedOffer.name}
                    className="w-20 h-20 rounded-lg object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE;
                    }}
                  />
                  <div>
                    <h3 className="font-bold text-lg">{selectedOffer.name}</h3>
                    <div className="flex items-center gap-4 mt-2">
                      <Badge variant="outline">{selectedOffer.category}</Badge>
                      <span className="font-bold text-green-600">${selectedOffer.payout.toFixed(2)}</span>
                      <span className={`font-bold ${currentCategory?.textColor}`}>
                        {selectedOffer.metric_value.toLocaleString()} {selectedOffer.metric_label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Custom Message */}
              <div className="space-y-2">
                <Label>Custom Message (Optional)</Label>
                <Textarea
                  placeholder="Add a personal message to include in the email..."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Partner Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Select Partners ({selectedPartners.size} selected)
                  </Label>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search partners..."
                        value={partnerSearch}
                        onChange={(e) => setPartnerSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchPartners()}
                        className="pl-9 w-64"
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={selectAllPartners}>
                      {selectedPartners.size === partners.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>
                </div>

                <div className="border rounded-lg max-h-64 overflow-y-auto">
                  {partnersLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin" />
                    </div>
                  ) : partners.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No partners found
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>Username</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {partners.map((partner) => (
                          <TableRow
                            key={partner._id}
                            className={`cursor-pointer ${
                              selectedPartners.has(partner._id) ? 'bg-primary/5' : ''
                            }`}
                            onClick={() => togglePartnerSelection(partner._id)}
                          >
                            <TableCell>
                              <Checkbox
                                checked={selectedPartners.has(partner._id)}
                                onCheckedChange={() => togglePartnerSelection(partner._id)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{partner.username}</TableCell>
                            <TableCell>{partner.email}</TableCell>
                            <TableCell>
                              <Badge variant={partner.is_active ? 'default' : 'secondary'}>
                                {partner.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEmailModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="outline" onClick={handlePreviewEmail}>
              <Eye className="h-4 w-4 mr-2" />
              Preview Email
            </Button>
            <Button 
              onClick={handleSendEmails} 
              disabled={sending || selectedPartners.size === 0}
            >
              {sending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send to {selectedPartners.size} Partners
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Preview Modal */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              This is how the email will look to recipients
            </DialogDescription>
          </DialogHeader>
          <div className="border rounded-lg overflow-hidden bg-gray-100 p-4">
            <div 
              className="bg-white rounded shadow-lg"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => setPreviewModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const AdminOfferInsightsWithGuard = () => (
  <AdminPageGuard requiredTab="offers">
    <AdminOfferInsights />
  </AdminPageGuard>
);

export default AdminOfferInsightsWithGuard;
