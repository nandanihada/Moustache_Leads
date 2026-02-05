import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Globe,
  DollarSign,
  Link,
  Eye,
  Copy,
  QrCode,
  TrendingUp,
  MousePointer,
  CheckCircle,
  Calendar,
  Target,
  Monitor,
  Smartphone,
  Lock,
  Clock,
  Send
} from 'lucide-react';
import { Offer } from '@/services/adminOfferApi';
import { PublisherOffer } from '@/services/publisherOfferApi';
import { useToast } from '@/hooks/use-toast';
import { userReportsApi } from '@/services/userReportsApi';
import { publisherOfferApi } from '@/services/publisherOfferApi';

interface OfferDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: Offer | PublisherOffer | null;
  onAccessGranted?: () => void;
}

const OfferDetailsModalNew: React.FC<OfferDetailsModalProps> = ({
  open,
  onOpenChange,
  offer,
  onAccessGranted,
}) => {
  const { toast } = useToast();
  const [trackingLink, setTrackingLink] = useState<string>('');
  const [customSubId, setCustomSubId] = useState<string>('');
  const [showQRCode, setShowQRCode] = useState<boolean>(false);
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');

  // Check if offer is locked
  const isLocked = offer && (
    (offer as PublisherOffer).is_locked || 
    ((offer as PublisherOffer).requires_approval && !(offer as PublisherOffer).has_access)
  );
  const hasAccess = offer && (offer as PublisherOffer).has_access !== false;
  const requestStatus = offer && (offer as PublisherOffer).request_status;

  // Get tracking base URL - uses offers subdomain in production
  const getTrackingBaseUrl = () => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (hostname.includes('moustacheleads.com') || hostname.includes('vercel.app') || hostname.includes('onrender.com')) {
        return 'https://offers.moustacheleads.com';
      }
    }
    return 'http://localhost:5000';
  };

  // Generate tracking link when offer changes
  useEffect(() => {
    if (offer && hasAccess && !isLocked) {
      try {
        const baseUrl = getTrackingBaseUrl();

        // Get user from localStorage
        let userId = '';
        try {
          const userStr = localStorage.getItem('user');
          if (userStr) {
            const user = JSON.parse(userStr);
            userId = user._id || user.id;
          }
        } catch (e) {
          console.error('Error getting user ID:', e);
        }

        // Build tracking link
        const params = new URLSearchParams();
        if (userId) {
          params.append('user_id', userId);
        }
        params.append('sub1', customSubId || 'default');

        const link = `${baseUrl}/track/${offer.offer_id}?${params.toString()}`;
        setTrackingLink(link);

        // Fetch offer stats
        fetchOfferStats(offer.offer_id);
      } catch (error) {
        console.error('Error generating tracking link:', error);
        setTrackingLink('');
      }
    } else {
      setTrackingLink('');
    }
  }, [offer, customSubId, hasAccess, isLocked]);

  // Handle request access
  const handleRequestAccess = async () => {
    if (!offer) return;
    
    try {
      setRequestingAccess(true);
      await publisherOfferApi.requestOfferAccess(offer.offer_id, requestMessage);
      
      toast({
        title: "✅ Request Submitted",
        description: `Your access request for "${offer.name}" has been submitted.`,
      });
      
      setRequestMessage('');
      onAccessGranted?.();
    } catch (error: any) {
      toast({
        title: "Request Failed",
        description: error.response?.data?.error || error.message || "Failed to submit access request",
        variant: "destructive",
      });
    } finally {
      setRequestingAccess(false);
    }
  };

  const fetchOfferStats = async (offerId: string) => {
    try {
      setLoadingStats(true);
      // Get last 30 days stats for this offer
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);

      const response = await userReportsApi.getPerformanceReport({
        start_date: start.toISOString().split('T')[0],
        end_date: end.toISOString().split('T')[0],
        offer_id: offerId,
        page: 1,
        per_page: 1
      });

      if (response.report?.summary) {
        // Map the backend field names to what the UI expects
        setStats({
          total_clicks: response.report.summary.total_clicks || 0,
          total_conversions: response.report.summary.total_conversions || 0,
          total_payout: response.report.summary.total_payout || 0,
          conversion_rate: response.report.summary.avg_cr || 0  // Backend uses avg_cr
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  if (!offer) return null;

  const copyToClipboard = (text: string, label: string) => {
    if (!text) {
      toast({
        title: "Error",
        description: "Nothing to copy",
        variant: "destructive",
      });
      return;
    }

    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "✅ Copied!",
        description: `${label} copied to clipboard`,
      });
    });
  };

  const updateTrackingLink = () => {
    // Regenerate link with custom sub ID
    const baseUrl = getTrackingBaseUrl();
    let userId = '';
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        userId = user._id || user.id;
      }
    } catch (e) { }

    const params = new URLSearchParams();
    if (userId) {
      params.append('user_id', userId);
    }
    if (customSubId) {
      params.append('sub1', customSubId);
    }

    const link = `${baseUrl}/track/${offer.offer_id}?${params.toString()}`;
    setTrackingLink(link);

    toast({
      title: "✅ Link Updated",
      description: "Tracking link updated with your custom Sub ID"
    });
  };

  const generateQRCode = (url: string) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
  };

  const getDaysRemaining = (expiryDate: string) => {
    if (!expiryDate) return null;
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const daysRemaining = getDaysRemaining((offer as any).expiration_date || '');
  const isExpiringSoon = daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0;
  const isExpired = daysRemaining !== null && daysRemaining <= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {offer.thumbnail_url || offer.image_url ? (
              <img
                src={offer.thumbnail_url || offer.image_url}
                alt={offer.name}
                className="w-12 h-12 object-cover rounded border"
              />
            ) : (
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded border flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
            )}
            <div className="flex-1">
              <div className="text-xl font-bold">{offer.name}</div>
              <div className="text-sm text-muted-foreground font-mono">
                ID: {offer.offer_id}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-green-500 text-white">
                ${offer.payout.toFixed(2)} {offer.currency || 'USD'}
              </Badge>
              <Badge className={
                ('status' in offer ? offer.status : offer.approval_status) === 'active'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }>
                {('status' in offer ? offer.status : offer.approval_status)?.toUpperCase() || 'UNKNOWN'}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Tracking Link Section - Most Prominent */}
        {isLocked ? (
          /* 🔒 LOCKED OFFER - Show request access instead of tracking link */
          <Card className="border-2 border-yellow-500 bg-gradient-to-r from-yellow-50 to-orange-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Lock className="h-5 w-5 text-yellow-600" />
                🔒 Offer Locked
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center py-6">
                <Lock className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-800 mb-2">Access Required</h3>
                <p className="text-gray-600 mb-4">
                  {(offer as PublisherOffer).lock_reason || 'This offer requires approval before you can access it.'}
                </p>
                
                {(offer as PublisherOffer).estimated_approval_time && (
                  <div className="flex items-center justify-center gap-2 text-yellow-700 mb-4">
                    <Clock className="h-4 w-4" />
                    <span>Estimated approval: {(offer as PublisherOffer).estimated_approval_time}</span>
                  </div>
                )}

                {requestStatus === 'pending' ? (
                  <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-4">
                    <div className="flex items-center justify-center gap-2 text-yellow-800">
                      <Clock className="h-5 w-5 animate-pulse" />
                      <span className="font-semibold">Request Pending</span>
                    </div>
                    <p className="text-sm text-yellow-700 mt-2">
                      Your access request is being reviewed. You'll be notified once approved.
                    </p>
                  </div>
                ) : requestStatus === 'rejected' ? (
                  <div className="bg-red-100 border border-red-300 rounded-lg p-4">
                    <p className="text-red-800 font-semibold">Request Rejected</p>
                    <p className="text-sm text-red-700 mt-1">
                      Your previous request was rejected. Contact support for more information.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Input
                      placeholder="Add a message (optional)..."
                      value={requestMessage}
                      onChange={(e) => setRequestMessage(e.target.value)}
                      className="max-w-md mx-auto"
                    />
                    <Button
                      onClick={handleRequestAccess}
                      disabled={requestingAccess}
                      className="bg-yellow-600 hover:bg-yellow-700"
                      size="lg"
                    >
                      {requestingAccess ? (
                        <>
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Request Access
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          /* ✅ UNLOCKED OFFER - Show tracking link */
          <Card className="border-2 border-blue-500 bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Link className="h-5 w-5 text-blue-600" />
                📍 Your Tracking Link
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Main Tracking Link Display */}
              <div className="flex items-center gap-2">
                <div className="flex-1 p-4 bg-white rounded-lg border-2 border-blue-300 font-mono text-sm break-all shadow-sm">
                  {trackingLink || 'Generating link...'}
                </div>
                <Button
                  onClick={() => copyToClipboard(trackingLink, 'Tracking Link')}
                  className="bg-blue-600 hover:bg-blue-700"
                  size="lg"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </div>

              {/* Customize Tracking Link */}
              <div className="bg-white p-4 rounded-lg border">
                <div className="font-medium mb-2 text-sm">🎯 Customize Tracking Link</div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Add Custom Sub ID (e.g., twitter, campaign1)"
                      value={customSubId}
                      onChange={(e) => setCustomSubId(e.target.value)}
                      className="font-mono text-sm"
                    />
                    <div className="text-xs text-muted-foreground mt-1">
                      Use Sub IDs to track different traffic sources
                    </div>
                  </div>
                  <Button
                    onClick={updateTrackingLink}
                    variant="outline"
                    disabled={!customSubId}
                  >
                    Update Link
                  </Button>
                </div>
              </div>

              {/* Tracking Link Options */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground font-medium">Tracking Link Options:</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQRCode(!showQRCode)}
                >
                  <QrCode className="h-4 w-4 mr-1" />
                  {showQRCode ? 'Hide' : 'Show'} QR Code
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
                    window.open(`${baseUrl}/preview/${offer.offer_id}`, '_blank');
                  }}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Preview Landing Page
                </Button>
              </div>

              {/* QR Code */}
              {showQRCode && trackingLink && (
                <div className="flex justify-center p-4 bg-white rounded-lg border">
                  <div className="text-center">
                    <img
                      src={generateQRCode(trackingLink)}
                      alt="QR Code"
                      className="w-48 h-48 border-2 border-gray-300 rounded"
                    />
                    <div className="text-xs text-muted-foreground mt-2">
                      Scan to open tracking link
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Stats Section - Only show for unlocked offers */}
        {!isLocked && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-full">
                  <MousePointer className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {loadingStats ? '...' : (stats?.total_clicks || 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">Total Clicks</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-full">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {loadingStats ? '...' : (stats?.total_conversions || 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">Conversions</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 rounded-full">
                  <DollarSign className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    ${loadingStats ? '...' : (stats?.total_payout || 0).toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">Earnings (30d)</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-100 rounded-full">
                  <TrendingUp className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {loadingStats ? '...' : (stats?.conversion_rate || 0).toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">Conv. Rate</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        )}

        {/* Offer Details Grid - Only show for unlocked offers */}
        {!isLocked ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Column */}
          <div className="space-y-4">
            {/* Offer Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">📋 Offer Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground mb-1">Offer ID</div>
                    <div className="font-mono font-semibold">{offer.offer_id}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Payout</div>
                    <div className="font-bold text-green-600 text-lg">
                      ${offer.payout.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground mb-1">Daily Cap</div>
                    <div className="font-medium">
                      {((offer as any).caps?.daily || (offer as any).daily_cap)?.toLocaleString() || 'Unlimited'}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Expires</div>
                    <div className="flex items-center gap-2">
                      {(offer as any).expiration_date ? (
                        <>
                          <span className="font-medium">
                            {new Date((offer as any).expiration_date).toLocaleDateString()}
                          </span>
                          {daysRemaining !== null && (
                            <Badge
                              className={`text-xs ${isExpired ? 'bg-red-100 text-red-800' :
                                isExpiringSoon ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-green-100 text-green-800'
                                }`}
                            >
                              {isExpired ? 'EXPIRED' : `${daysRemaining}d left`}
                            </Badge>
                          )}
                        </>
                      ) : (
                        <span className="font-medium">No expiry</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-sm">
                  <div className="text-muted-foreground mb-1">Offer Protocol</div>
                  <Badge variant="outline" className="font-mono text-xs">
                    Server Postback w/ Transaction ID
                  </Badge>
                </div>

                {offer.description && (
                  <div className="text-sm">
                    <div className="text-muted-foreground mb-1">Description</div>
                    <div className="text-sm">{offer.description}</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Channel Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">📱 Channel & Device</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Device:</span>
                  <Badge variant="outline" className="capitalize">
                    {(offer as any).device_targeting === 'mobile' && <Smartphone className="h-3 w-3 mr-1" />}
                    {(offer as any).device_targeting === 'desktop' && <Monitor className="h-3 w-3 mr-1" />}
                    {(offer as any).device_targeting || 'All Devices'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Conversion Type:</span>
                  <Badge variant="outline">
                    {(offer as any).conversion_type || 'CPA'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Incentive:</span>
                  <Badge className={`text-xs ${(offer as any).incentive_allowed !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {(offer as any).incentive_allowed !== false ? 'Incent OK' : 'Non-Incent'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Traffic Sources */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">🚦 Traffic Sources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {/* Allowed */}
                <div>
                  <div className="text-muted-foreground mb-2 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    Allowed
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {((offer as any).allowed_traffic_sources || []).length > 0 ? (
                      ((offer as any).allowed_traffic_sources || []).map((source: string) => (
                        <Badge key={source} variant="outline" className="bg-green-50 text-green-700 text-xs">
                          {source}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-xs">Not specified</span>
                    )}
                  </div>
                </div>
                {/* Risky */}
                {((offer as any).risky_traffic_sources || []).length > 0 && (
                  <div>
                    <div className="text-muted-foreground mb-2 flex items-center gap-1">
                      <Clock className="h-3 w-3 text-yellow-600" />
                      Risky (Use with caution)
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {((offer as any).risky_traffic_sources || []).map((source: string) => (
                        <Badge key={source} variant="outline" className="bg-yellow-50 text-yellow-700 text-xs">
                          {source}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {/* Disallowed */}
                {((offer as any).disallowed_traffic_sources || []).length > 0 && (
                  <div>
                    <div className="text-muted-foreground mb-2 flex items-center gap-1">
                      <Lock className="h-3 w-3 text-red-600" />
                      Disallowed
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {((offer as any).disallowed_traffic_sources || []).map((source: string) => (
                        <Badge key={source} variant="outline" className="bg-red-50 text-red-700 text-xs">
                          {source}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            {/* Locations */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  🌍 Allowed Locations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {offer.countries.map((country) => (
                    <Badge key={country} variant="outline" className="font-mono">
                      {country}
                    </Badge>
                  ))}
                </div>
                {offer.countries.length === 0 && (
                  <div className="text-sm text-muted-foreground">All countries allowed</div>
                )}
              </CardContent>
            </Card>

            {/* Preview Button */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">🎯 Landing Page</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => {
                    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
                    window.open(`${baseUrl}/preview/${offer.offer_id}`, '_blank');
                  }}
                  className="w-full"
                  variant="outline"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview Landing Page
                </Button>
                <div className="text-xs text-muted-foreground mt-2">
                  See what your users will see after clicking your tracking link
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        ) : (
          /* 🔒 LOCKED OFFER - Show only basic info */
          <Card className="border border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">📋 About This Offer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {offer.description && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Description</div>
                  <p className="text-sm">{offer.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground mb-1">Payout</div>
                  <div className="font-bold text-green-600 text-lg">
                    ${offer.payout.toFixed(2)} {offer.currency || 'USD'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Countries</div>
                  <div className="flex flex-wrap gap-1">
                    {offer.countries.slice(0, 5).map((country) => (
                      <Badge key={country} variant="outline" className="text-xs">
                        {country}
                      </Badge>
                    ))}
                    {offer.countries.length > 5 && (
                      <Badge variant="outline" className="text-xs">
                        +{offer.countries.length - 5}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <Lock className="h-4 w-4 inline mr-1" />
                  Request access above to see full offer details, tracking link, and stats.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default OfferDetailsModalNew;
