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
  Sparkles,
  Calendar,
  Clock,
  DollarSign,
  Filter,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import {
  offerInsightsApi,
  InsightType,
  InsightOffer,
  OfferViewLog,
  Partner,
  EmailHistoryItem
} from '@/services/offerInsightsApi';
import InsightEmailCampaign from '@/components/InsightEmailCampaign';
import EmailSettingsPanel, { DEFAULT_EMAIL_SETTINGS, type EmailSettings } from '@/components/EmailSettingsPanel';

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
  },
  {
    id: 'price_mismatch' as InsightType,
    title: 'Price Mismatch',
    description: 'Offers with payout changes',
    icon: DollarSign,
    color: 'bg-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-600'
  }
];

const VIEW_LOGS_CARD = {
  id: 'offer_view_logs' as const,
  title: 'Offer View Logs',
  description: 'Track who viewed which offers',
  icon: Eye,
  color: 'bg-blue-500',
  bgColor: 'bg-blue-50',
  borderColor: 'border-blue-200',
  textColor: 'text-blue-600'
};

const AdminOfferInsights = () => {
  const { toast } = useToast();
  
  // State
  const [selectedCategory, setSelectedCategory] = useState<InsightType>('highest_clicks');
  const [timePeriod, setTimePeriod] = useState<'week' | 'month'>('week');
  const [offers, setOffers] = useState<InsightOffer[]>([]);
  const [hasTrackingData, setHasTrackingData] = useState(true);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [emailHistory, setEmailHistory] = useState<EmailHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [partnersLoading, setPartnersLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  
  // Selection state
  const [selectedOffer, setSelectedOffer] = useState<InsightOffer | null>(null);
  const [selectedOffers, setSelectedOffers] = useState<Set<string>>(new Set());
  const [selectedPartners, setSelectedPartners] = useState<Set<string>>(new Set());
  const [partnerSearch, setPartnerSearch] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  
  // Scheduling state
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  
  // Modal state
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [sending, setSending] = useState(false);
  const [emailSettings, setEmailSettings] = useState<EmailSettings>(DEFAULT_EMAIL_SETTINGS);

  // Offer View Logs state
  const [viewLogs, setViewLogs] = useState<OfferViewLog[]>([]);
  const [viewLogsLoading, setViewLogsLoading] = useState(false);
  const [viewLogsPage, setViewLogsPage] = useState(1);
  const [viewLogsTotalPages, setViewLogsTotalPages] = useState(1);
  const [viewLogsTotal, setViewLogsTotal] = useState(0);
  const [viewLogsFilters, setViewLogsFilters] = useState({
    ip: '', email: '', username: '', clicked: '', opened: '', offer_id: '',
    date_from: '', date_to: '', range: '30d'
  });
  const [showViewLogsFilters, setShowViewLogsFilters] = useState(false);

  // View logs selection state
  const [selectedViewLogs, setSelectedViewLogs] = useState<Set<string>>(new Set());
  const [selectedLogOfferNames, setSelectedLogOfferNames] = useState<string[]>([]);
  const [selectedLogOfferIds, setSelectedLogOfferIds] = useState<string[]>([]);

  // Custom email campaign modal (reusable)
  const [customEmailOpen, setCustomEmailOpen] = useState(false);

  // Active tab state
  const [activeTab, setActiveTab] = useState('offers');

  // Fetch offers when category or time period changes
  useEffect(() => {
    fetchOffers();
  }, [selectedCategory, timePeriod]);

  // Fetch partners, email history on mount only
  useEffect(() => {
    const loadInitialData = async () => {
      setInitialLoading(true);
      await Promise.all([
        fetchPartners(),
        fetchEmailHistory()
      ]);
      setInitialLoading(false);
    };
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch view logs when page or filters change
  const fetchViewLogs = async (pageNum?: number) => {
    setViewLogsLoading(true);
    try {
      const res = await offerInsightsApi.getOfferViewLogs({
        page: pageNum || viewLogsPage,
        per_page: 20,
        ...viewLogsFilters,
      });
      setViewLogs(res.logs || []);
      setViewLogsTotal(res.total || 0);
      setViewLogsTotalPages(res.pages || 1);
      setSelectedViewLogs(new Set()); // Clear selection on new data
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch view logs', variant: 'destructive' });
    } finally {
      setViewLogsLoading(false);
    }
  };

  const handleDeleteSelectedLogs = async () => {
    if (selectedViewLogs.size === 0) return;
    try {
      const res = await offerInsightsApi.deleteOfferViewLogs(Array.from(selectedViewLogs));
      toast({ title: 'Deleted', description: `${res.deleted_count} log(s) deleted` });
      setSelectedViewLogs(new Set());
      fetchViewLogs(viewLogsPage);
    } catch {
      toast({ title: 'Error', description: 'Failed to delete logs', variant: 'destructive' });
    }
  };

  const handleEmailFromSelectedLogs = () => {
    const selected = viewLogs.filter(l => selectedViewLogs.has(l._id));
    const uniqueNames = [...new Set(selected.map(l => l.offer_name).filter(Boolean))];
    const uniqueIds = [...new Set(selected.map(l => l.offer_id).filter(Boolean))];
    setSelectedLogOfferNames(uniqueNames);
    setSelectedLogOfferIds(uniqueIds);
    setCustomEmailOpen(true);
  };

  const toggleViewLogSelection = (id: string) => {
    const s = new Set(selectedViewLogs);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelectedViewLogs(s);
  };

  const toggleAllViewLogs = () => {
    if (selectedViewLogs.size === viewLogs.length) {
      setSelectedViewLogs(new Set());
    } else {
      setSelectedViewLogs(new Set(viewLogs.map(l => l._id)));
    }
  };

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const days = timePeriod === 'week' ? 7 : 30;
      // Use higher limit for price_mismatch to show all detected mismatches
      const limit = selectedCategory === 'price_mismatch' ? 100 : 10;
      const response = await offerInsightsApi.getOfferInsights(selectedCategory, limit, days);
      setOffers(response.offers || []);
      setHasTrackingData(response.has_tracking_data !== false);
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
    setScheduleEnabled(false);
    setScheduleDate('');
    setScheduleTime('');
  };

  const toggleOfferSelection = (offerId: string) => {
    const newSelection = new Set(selectedOffers);
    if (newSelection.has(offerId)) {
      newSelection.delete(offerId);
    } else {
      newSelection.add(offerId);
    }
    setSelectedOffers(newSelection);
  };

  const handleBulkEmailModal = () => {
    if (selectedOffers.size === 0) {
      toast({
        title: 'No Offers Selected',
        description: 'Please select at least one offer to send emails',
        variant: 'destructive'
      });
      return;
    }
    setSelectedOffer(null); // Clear single selection
    setEmailModalOpen(true);
    setSelectedPartners(new Set());
    setCustomMessage('');
    setScheduleEnabled(false);
    setScheduleDate('');
    setScheduleTime('');
  };

  const getSelectedOffersData = (): InsightOffer[] => {
    return offers.filter(o => selectedOffers.has(o.offer_id));
  };

  const handlePreviewEmail = async () => {
    const offersToPreview = selectedOffer ? [selectedOffer] : getSelectedOffersData();
    if (offersToPreview.length === 0) return;
    
    try {
      const response = await offerInsightsApi.previewEmail(
        selectedCategory,
        offersToPreview,
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
    const offersToSend = selectedOffer ? [selectedOffer] : getSelectedOffersData();
    
    if (offersToSend.length === 0 || selectedPartners.size === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one offer and one partner',
        variant: 'destructive'
      });
      return;
    }

    // Validate schedule if enabled
    if (scheduleEnabled) {
      if (!scheduleDate || !scheduleTime) {
        toast({
          title: 'Error',
          description: 'Please select both date and time for scheduling',
          variant: 'destructive'
        });
        return;
      }
      
      const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
      if (scheduledDateTime <= new Date()) {
        toast({
          title: 'Error',
          description: 'Scheduled time must be in the future',
          variant: 'destructive'
        });
        return;
      }
    }

    setSending(true);
    try {
      const response = await offerInsightsApi.sendEmails(
        selectedCategory,
        offersToSend,
        Array.from(selectedPartners),
        customMessage,
        scheduleEnabled ? new Date(`${scheduleDate}T${scheduleTime}`).toISOString() : undefined,
        {
          template_style: emailSettings.templateStyle,
          visible_fields: emailSettings.visibleFields,
          default_image: emailSettings.defaultImage,
          payout_type: emailSettings.payoutType,
        }
      );
      
      if (scheduleEnabled) {
        toast({
          title: 'Email Scheduled!',
          description: `Email campaign scheduled for ${new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString()}`,
        });
      } else {
        toast({
          title: 'Emails Sent!',
          description: `Successfully sent ${response.sent_count} emails. ${response.failed_count} failed.`,
        });
      }
      
      setEmailModalOpen(false);
      setSelectedOffers(new Set());
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
        <div className="flex items-center gap-3">
          {/* Time Period Toggle */}
          <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
            <Button
              variant={timePeriod === 'week' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTimePeriod('week')}
              className="flex items-center gap-1"
            >
              <Calendar className="h-4 w-4" />
              Last Week
            </Button>
            <Button
              variant={timePeriod === 'month' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTimePeriod('month')}
              className="flex items-center gap-1"
            >
              <Calendar className="h-4 w-4" />
              Last Month
            </Button>
          </div>
          <Button variant="outline" onClick={fetchOffers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {INSIGHT_CATEGORIES.map((category) => {
          const Icon = category.icon;
          const isSelected = selectedCategory === category.id && activeTab === 'offers';
          
          return (
            <Card
              key={category.id}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                isSelected 
                  ? `ring-2 ring-offset-2 ${category.borderColor} ${category.bgColor}` 
                  : 'hover:border-gray-300'
              }`}
              onClick={() => { setSelectedCategory(category.id); setActiveTab('offers'); }}
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
        {/* 6th Card: Offer View Logs */}
        <Card
          className={`cursor-pointer transition-all hover:shadow-lg ${
            activeTab === 'view-logs'
              ? `ring-2 ring-offset-2 ${VIEW_LOGS_CARD.borderColor} ${VIEW_LOGS_CARD.bgColor}`
              : 'hover:border-gray-300'
          }`}
          onClick={() => { setActiveTab('view-logs'); if (viewLogs.length === 0) fetchViewLogs(1); }}
        >
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl ${VIEW_LOGS_CARD.color}`}>
                <VIEW_LOGS_CARD.icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold">{VIEW_LOGS_CARD.title}</h3>
                <p className="text-sm text-muted-foreground">{VIEW_LOGS_CARD.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {currentCategory && (
                      <>
                        <currentCategory.icon className={`h-5 w-5 ${currentCategory.textColor}`} />
                        {currentCategory.title}
                        <Badge variant="outline" className="ml-2">
                          {timePeriod === 'week' ? 'Last 7 Days' : 'Last 30 Days'}
                        </Badge>
                      </>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Select multiple offers to send in a single email campaign
                  </CardDescription>
                </div>
                {selectedOffers.size > 0 && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-sm">
                      {selectedOffers.size} offer{selectedOffers.size > 1 ? 's' : ''} selected
                    </Badge>
                    <Button onClick={handleBulkEmailModal}>
                      <Mail className="h-4 w-4 mr-2" />
                      Send Campaign ({selectedOffers.size})
                    </Button>
                    <Button variant="outline" onClick={() => setSelectedOffers(new Set())}>
                      Clear
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : offers.length === 0 ? (
                <div className="text-center py-12">
                  {selectedCategory === 'price_mismatch' ? (
                    <>
                      <DollarSign className="h-12 w-12 mx-auto text-green-500 mb-4" />
                      <p className="text-muted-foreground font-medium">No price mismatches detected</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        All offer prices are in sync. Price mismatches will appear here when detected during sheet uploads.
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">No offers found for this category</p>
                  )}
                </div>
              ) : (
                <>
                  {/* Warning banner when no tracking data */}
                  {!hasTrackingData && (
                    <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-amber-800">No tracking data available</p>
                        <p className="text-sm text-amber-600">
                          Showing top offers by payout. Real click/conversion data will appear once tracking events are recorded.
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {offers.map((offer, index) => {
                    const isSelected = selectedOffers.has(offer.offer_id);
                    return (
                      <Card
                        key={offer.offer_id}
                        className={`cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] ${currentCategory?.bgColor} ${currentCategory?.borderColor} border ${isSelected ? 'ring-2 ring-primary' : ''}`}
                      >
                        <CardContent className="pt-4">
                          <div className="flex items-start gap-3">
                            {/* Checkbox for multi-select */}
                            <div 
                              className="mt-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleOfferSelection(offer.offer_id);
                              }}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleOfferSelection(offer.offer_id)}
                              />
                            </div>
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
                            </div>
                          </div>
                          
                          {/* Stats Row - Full Info Display */}
                          <div className="grid grid-cols-3 gap-2 mt-4 p-3 bg-white/50 rounded-lg">
                            {/* Price Mismatch: Show old price → new price */}
                            {selectedCategory === 'price_mismatch' && offer.new_payout !== undefined ? (
                              <>
                                <div className="text-center">
                                  <span className="text-xs text-muted-foreground block">Old Payout</span>
                                  <p className="font-bold text-gray-500 text-lg line-through">${offer.payout.toFixed(2)}</p>
                                </div>
                                <div className="text-center border-x border-gray-200">
                                  <span className="text-xs text-muted-foreground block">New Payout</span>
                                  <p className={`font-bold text-lg ${offer.price_change_type === 'increase' ? 'text-green-600' : 'text-red-600'}`}>
                                    ${offer.new_payout.toFixed(2)}
                                  </p>
                                </div>
                                <div className="text-center">
                                  <span className="text-xs text-muted-foreground block">Change</span>
                                  <p className={`font-bold text-lg ${offer.price_change_type === 'increase' ? 'text-green-600' : 'text-red-600'}`}>
                                    {offer.price_change_type === 'increase' ? '+' : ''}{offer.percent_change?.toFixed(1)}%
                                  </p>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="text-center">
                                  <span className="text-xs text-muted-foreground block">Payout</span>
                                  <p className="font-bold text-green-600 text-lg">${offer.payout.toFixed(2)}</p>
                                </div>
                                <div className="text-center border-x border-gray-200">
                                  <span className="text-xs text-muted-foreground block capitalize">
                                    {offer.metric_label}
                                  </span>
                                  <p className={`font-bold text-lg ${currentCategory?.textColor}`}>
                                    {typeof offer.metric_value === 'number' ? offer.metric_value.toLocaleString() : offer.metric_value}
                                  </p>
                                </div>
                                {offer.conversion_rate !== undefined && (
                                  <div className="text-center">
                                    <span className="text-xs text-muted-foreground block">Conv. Rate</span>
                                    <p className="font-bold text-blue-600 text-lg">{offer.conversion_rate}%</p>
                                  </div>
                                )}
                                {offer.conversion_rate === undefined && (
                                  <div className="text-center">
                                    <span className="text-xs text-muted-foreground block">Rank</span>
                                    <p className={`font-bold text-lg ${currentCategory?.textColor}`}>#{index + 1}</p>
                                  </div>
                                )}
                              </>
                            )}
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
                            Send Single Email
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* View Logs Tab */}
        <TabsContent value="view-logs">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-blue-500" />
                    Offer View Logs
                    <Badge variant="outline" className="ml-2">{viewLogsTotal} total</Badge>
                  </CardTitle>
                  <CardDescription>
                    Track who viewed, clicked, and interacted with offers
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {selectedViewLogs.size > 0 && (
                    <>
                      <Badge variant="secondary" className="text-sm">
                        {selectedViewLogs.size} selected
                      </Badge>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleDeleteSelectedLogs}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Delete ({selectedViewLogs.size})
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleEmailFromSelectedLogs}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Email ({selectedViewLogs.size})
                      </Button>
                    </>
                  )}
                  {selectedViewLogs.size === 0 && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedLogOfferNames([]);
                        setSelectedLogOfferIds([]);
                        setCustomEmailOpen(true);
                      }}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Send Email
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowViewLogsFilters(!showViewLogsFilters)}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    {showViewLogsFilters ? 'Hide Filters' : 'Filters'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchViewLogs(1)}
                    disabled={viewLogsLoading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${viewLogsLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Filters Panel */}
              {showViewLogsFilters && (
                <div className="mt-4 p-4 border rounded-lg bg-muted/30 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">IP Address</Label>
                    <Input
                      placeholder="Filter by IP..."
                      value={viewLogsFilters.ip}
                      onChange={(e) => setViewLogsFilters(f => ({ ...f, ip: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <Input
                      placeholder="Filter by email..."
                      value={viewLogsFilters.email}
                      onChange={(e) => setViewLogsFilters(f => ({ ...f, email: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Username</Label>
                    <Input
                      placeholder="Filter by username..."
                      value={viewLogsFilters.username}
                      onChange={(e) => setViewLogsFilters(f => ({ ...f, username: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Offer ID</Label>
                    <Input
                      placeholder="Filter by offer ID..."
                      value={viewLogsFilters.offer_id}
                      onChange={(e) => setViewLogsFilters(f => ({ ...f, offer_id: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Date Range</Label>
                    <select
                      className="w-full h-8 text-sm border rounded-md px-2 bg-background"
                      value={viewLogsFilters.range}
                      onChange={(e) => setViewLogsFilters(f => ({ ...f, range: e.target.value }))}
                    >
                      <option value="today">Today</option>
                      <option value="7d">Last 7 Days</option>
                      <option value="30d">Last 30 Days</option>
                      <option value="">All Time</option>
                    </select>
                  </div>
                  <div className="flex items-end gap-2">
                    <Button
                      size="sm"
                      className="h-8"
                      onClick={() => { setViewLogsPage(1); fetchViewLogs(1); }}
                    >
                      <Search className="h-3 w-3 mr-1" />
                      Apply
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8"
                      onClick={() => {
                        setViewLogsFilters({ ip: '', email: '', username: '', clicked: '', opened: '', offer_id: '', date_from: '', date_to: '', range: '30d' });
                        setViewLogsPage(1);
                        fetchViewLogs(1);
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {viewLogsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : viewLogs.length === 0 ? (
                <div className="text-center py-12">
                  <Eye className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No view logs found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Offer view logs will appear here as users interact with offers
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={viewLogs.length > 0 && selectedViewLogs.size === viewLogs.length}
                              onCheckedChange={toggleAllViewLogs}
                            />
                          </TableHead>
                          <TableHead>Timestamp</TableHead>
                          <TableHead>Username</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>IP Address</TableHead>
                          <TableHead>Offer</TableHead>
                          <TableHead>Network</TableHead>
                          <TableHead>Clicked</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewLogs.map((log) => (
                          <TableRow
                            key={log._id}
                            className={`cursor-pointer ${selectedViewLogs.has(log._id) ? 'bg-primary/5' : ''}`}
                            onClick={() => toggleViewLogSelection(log._id)}
                          >
                            <TableCell>
                              <Checkbox
                                checked={selectedViewLogs.has(log._id)}
                                onCheckedChange={() => toggleViewLogSelection(log._id)}
                              />
                            </TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                              {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}
                            </TableCell>
                            <TableCell className="text-sm font-medium">{log.username || '—'}</TableCell>
                            <TableCell className="text-sm">{log.email || '—'}</TableCell>
                            <TableCell className="text-xs font-mono">{log.ip || '—'}</TableCell>
                            <TableCell>
                              <div className="text-sm font-medium max-w-[200px] truncate" title={log.offer_name}>
                                {log.offer_name || '—'}
                              </div>
                              <div className="text-xs text-muted-foreground">{log.offer_id}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{log.network || '—'}</Badge>
                            </TableCell>
                            <TableCell>
                              {log.clicked ? (
                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Yes</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-muted-foreground">No</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Page {viewLogsPage} of {viewLogsTotalPages} ({viewLogsTotal} total logs)
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={viewLogsPage <= 1}
                        onClick={() => { const p = viewLogsPage - 1; setViewLogsPage(p); fetchViewLogs(p); }}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={viewLogsPage >= viewLogsTotalPages}
                        onClick={() => { const p = viewLogsPage + 1; setViewLogsPage(p); fetchViewLogs(p); }}
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </>
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
              {selectedOffer 
                ? 'Send targeted email about this offer to selected partners'
                : `Send email campaign with ${selectedOffers.size} selected offers`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Selected Offers Preview */}
            {selectedOffer ? (
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
            ) : (
              <div className={`p-4 rounded-lg ${currentCategory?.bgColor} ${currentCategory?.borderColor} border`}>
                <h4 className="font-semibold mb-3">Selected Offers ({selectedOffers.size})</h4>
                <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto">
                  {getSelectedOffersData().map((offer) => (
                    <div key={offer.offer_id} className="flex items-center gap-2 p-2 bg-white/50 rounded-lg">
                      <img
                        src={offer.image_url || PLACEHOLDER_IMAGE}
                        alt={offer.name}
                        className="w-10 h-10 rounded object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE;
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{offer.name}</p>
                        <p className="text-xs text-muted-foreground">
                          ${offer.payout.toFixed(2)} • {offer.metric_value.toLocaleString()} {offer.metric_label}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Email Template Settings */}
            <EmailSettingsPanel settings={emailSettings} onChange={setEmailSettings} compact />

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

            {/* Schedule Email Section */}
            <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Schedule Email
                </Label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="schedule-toggle"
                    checked={scheduleEnabled}
                    onCheckedChange={(checked) => setScheduleEnabled(checked as boolean)}
                  />
                  <label htmlFor="schedule-toggle" className="text-sm cursor-pointer">
                    Schedule for later
                  </label>
                </div>
              </div>
              
              {scheduleEnabled && (
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Time</Label>
                    <Input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                    />
                  </div>
                </div>
              )}
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
                  {scheduleEnabled ? 'Scheduling...' : 'Sending...'}
                </>
              ) : scheduleEnabled ? (
                <>
                  <Clock className="h-4 w-4 mr-2" />
                  Schedule for {selectedPartners.size} Partners
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

      {/* Custom Email Campaign Modal for View Logs */}
      <InsightEmailCampaign
        open={customEmailOpen}
        onOpenChange={setCustomEmailOpen}
        sourceCard="offer_view_logs"
        offerIds={selectedLogOfferIds}
        offerNames={selectedLogOfferNames}
        defaultSubject={selectedLogOfferNames.length > 0
          ? `Check out ${selectedLogOfferNames.length === 1 ? selectedLogOfferNames[0] : `these ${selectedLogOfferNames.length} offers`} on Moustache Leads`
          : 'Check out these offers on Moustache Leads'}
        defaultContent={selectedLogOfferNames.length > 0
          ? `We noticed interest in the following offer${selectedLogOfferNames.length > 1 ? 's' : ''}:\n\n${selectedLogOfferNames.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n\nTake a look and start promoting today!`
          : 'We noticed some great offers that might interest your audience. Take a look and start promoting today!'}
        onSent={() => {
          fetchEmailHistory();
          toast({ title: 'Email Sent', description: 'Campaign sent successfully from Offer View Logs' });
        }}
      />
    </div>
  );
};

const AdminOfferInsightsWithGuard = () => (
  <AdminPageGuard requiredTab="offers">
    <AdminOfferInsights />
  </AdminPageGuard>
);

export default AdminOfferInsightsWithGuard;
