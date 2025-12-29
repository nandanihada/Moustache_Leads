import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Globe, 
  DollarSign, 
  Link, 
  Eye,
  Copy,
  QrCode,
  Scissors,
  CheckCircle,
  AlertCircle,
  XCircle,
  AlertTriangle,
  Info
} from 'lucide-react';
import { Offer } from '@/services/adminOfferApi';
import { useToast } from '@/hooks/use-toast';

interface OfferDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: Offer | null;
}

// Helper function to get flag image URL
const getFlagUrl = (countryCode: string) => {
  return `https://flagcdn.com/24x18/${countryCode.toLowerCase()}.png`;
};

// Helper function to generate tracking link
const generateTrackingLink = (offer: Offer, userId?: string) => {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  
  // Get user from localStorage if not provided
  if (!userId) {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        userId = user._id || user.id;
      }
    } catch (e) {
      console.error('Error getting user ID:', e);
    }
  }
  
  // Build tracking link: http://localhost:5000/track/{offer_id}?user_id={userId}&sub1=...
  const params = new URLSearchParams();
  if (userId) {
    params.append('user_id', userId);
  }
  params.append('sub1', 'default');  // Publishers can customize this
  
  return `${baseUrl}/track/${offer.offer_id}?${params.toString()}`;
};

// Helper function to generate QR code URL
const generateQRCode = (url: string) => {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
};

// Helper function to shorten URL (mock implementation)
const shortenUrl = async (url: string) => {
  const hash = btoa(url).substring(0, 8);
  return `http://localhost:3000/s/${hash}`;
};

// Helper function to calculate days remaining
const getDaysRemaining = (expiryDate: string) => {
  if (!expiryDate) return null;
  const expiry = new Date(expiryDate);
  const now = new Date();
  const diffTime = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'active':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'pending':
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    case 'inactive':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <AlertCircle className="h-4 w-4 text-gray-500" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'inactive':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const OfferDetailsModal: React.FC<OfferDetailsModalProps> = ({
  open,
  onOpenChange,
  offer,
}) => {
  const { toast } = useToast();
  const [trackingLink, setTrackingLink] = React.useState<string>('');
  const [shortenedLink, setShortenedLink] = React.useState<string>('');
  const [showQRCode, setShowQRCode] = React.useState<boolean>(false);

  // Generate tracking link when offer changes - MUST be before early return
  React.useEffect(() => {
    if (offer) {
      try {
        // Generate tracking link for this offer with user's ID
        if (offer.offer_id) {
          const link = generateTrackingLink(offer);
          setTrackingLink(link);
        } else {
          setTrackingLink('');
        }
      } catch (error) {
        console.error('Error generating tracking link:', error);
        setTrackingLink('');
      }
    } else {
      setTrackingLink('');
    }
  }, [offer]);

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
        title: "Copied!",
        description: `${label} copied to clipboard`,
      });
    }).catch(() => {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    });
  };

  const openUrl = (url: string) => {
    if (url) {
      window.open(url, '_blank');
    }
  };

  const handleShortenUrl = async (url: string) => {
    try {
      const shortened = await shortenUrl(url);
      setShortenedLink(shortened);
      copyToClipboard(shortened, 'Shortened URL');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to shorten URL",
        variant: "destructive",
      });
    }
  };

  const handleShowQRCode = (url: string) => {
    setShowQRCode(!showQRCode);
    if (!showQRCode) {
      toast({
        title: "QR Code",
        description: "QR Code displayed below",
      });
    }
  };

  // Calculate expiry information
  const daysRemaining = getDaysRemaining(offer.expiration_date || '');
  const isExpiringSoon = daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0;
  const isExpired = daysRemaining !== null && daysRemaining <= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {offer.thumbnail_url || offer.image_url ? (
              <img
                src={offer.thumbnail_url || offer.image_url}
                alt={offer.name}
                className="w-12 h-12 object-cover rounded border"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-12 h-12 bg-gray-100 rounded border flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-gray-400" />
              </div>
            )}
            <div>
              <div className="text-xl font-bold">{offer.name}</div>
              <div className="text-sm text-muted-foreground font-mono">
                {offer.offer_id} • {offer.campaign_id}
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {getStatusIcon(offer.status)}
              <Badge className={getStatusColor(offer.status)}>
                {offer.status?.toUpperCase() || 'UNKNOWN'}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Tracking Link Section - Prominent at top */}
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Link className="h-5 w-5 text-blue-600" />
              Your Tracking Link
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 p-3 bg-white rounded border font-mono text-sm break-all">
                {trackingLink}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(trackingLink, 'Tracking Link')}
                title="Copy"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleShortenUrl(trackingLink)}
                title="Shorten"
              >
                <Scissors className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleShowQRCode(trackingLink)}
                title="QR Code"
              >
                <QrCode className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">Tracking Link Options</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openUrl(offer.preview_url || offer.target_url)}
                className="text-blue-600 hover:text-blue-800"
              >
                <Eye className="h-4 w-4 mr-1" />
                Preview Landing Page
              </Button>
            </div>

            {shortenedLink && (
              <div className="p-2 bg-green-50 border border-green-200 rounded">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-green-700">Shortened:</span>
                  <span className="text-sm font-mono text-green-800">{shortenedLink}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(shortenedLink, 'Shortened URL')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}

            {showQRCode && (
              <div className="flex justify-center">
                <img
                  src={generateQRCode(trackingLink)}
                  alt="QR Code"
                  className="w-32 h-32 border rounded"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.parentElement!.innerHTML = '<div class="w-32 h-32 border rounded bg-gray-100 flex items-center justify-center text-xs text-gray-500">QR Code unavailable</div>';
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main Content in Compact Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Column */}
          <div className="space-y-4">
            {/* Offer Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Offer Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Offer ID:</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono font-medium">{offer.offer_id}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(offer.offer_id, 'Offer ID')}
                        className="h-6 w-6 p-0"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Payout:</span>
                    <div className="font-semibold text-green-600">
                      {(offer as any).revenue_share_percent > 0 
                        ? `${(offer as any).revenue_share_percent}% Revenue Share`
                        : `$${offer.payout.toFixed(2)} ${offer.currency || 'USD'}`
                      }
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Vertical:</span>
                    <div>
                      <Badge variant="outline">{(offer as any).vertical || (offer as any).category || 'Lifestyle'}</Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Incentive Type:</span>
                    <div>
                      <Badge className={`text-xs ${(offer as any).incentive_type === 'Non-Incent' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                        {(offer as any).incentive_type || 'Incent'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {offer.description && (
                  <div className="text-sm pt-2 border-t">
                    <span className="text-muted-foreground font-medium">Description:</span>
                    <div className="mt-1 text-gray-700">{offer.description}</div>
                  </div>
                )}

                {/* Payout Model & Network */}
                <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t">
                  {(offer as any).payout_model && (
                    <div>
                      <span className="text-muted-foreground">Payout Model:</span>
                      <div>
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                          {(offer as any).payout_model}
                        </Badge>
                      </div>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Network:</span>
                    <div className="font-medium">{offer.network}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Caps:</span>
                    <div>
                      {(offer.caps?.daily || (offer as any).daily_cap) ? 
                        `${(offer.caps?.daily || (offer as any).daily_cap).toLocaleString()} daily` : 
                        'No daily cap'
                      }
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Expires:</span>
                    <div className="flex items-center gap-1">
                      {offer.expiration_date ? (
                        <>
                          <span>{new Date(offer.expiration_date).toLocaleDateString()}</span>
                          {daysRemaining !== null && (
                            <Badge 
                              className={`text-xs ${
                                isExpired ? 'bg-red-100 text-red-800' :
                                isExpiringSoon ? 'bg-yellow-100 text-yellow-800' :
                                'bg-green-100 text-green-800'
                              }`}
                            >
                              {isExpired ? 'EXPIRED' : 
                               daysRemaining === 1 ? '1 day left' :
                               `${daysRemaining} days left`}
                            </Badge>
                          )}
                        </>
                      ) : (
                        <span>No expiry</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-sm">
                  <span className="text-muted-foreground">Offer Protocol:</span>
                  <div className="mt-1">
                    <Badge variant="outline">
                      {offer.tracking?.protocol || (offer as any).tracking_protocol || 'Server Postback w/ Transaction ID'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Locations */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Locations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {offer.countries.slice(0, 8).map((country) => (
                    <div key={country} className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs">
                      <img 
                        src={getFlagUrl(country)} 
                        alt={`${country} flag`}
                        className="w-4 h-3 object-cover rounded-sm"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      {country}
                    </div>
                  ))}
                  {offer.countries.length > 8 && (
                    <div className="px-2 py-1 bg-gray-100 rounded text-xs text-muted-foreground">
                      +{offer.countries.length - 8} more
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Channel Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Channel Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Device:</span>
                  <span className="capitalize">{offer.device_targeting}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Incentive Type:</span>
                  <Badge className={`text-xs ${(offer as any).incentive_type === 'Non-Incent' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                    {(offer as any).incentive_type || 'Incent'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Conversion Window:</span>
                  <span>{(offer.tracking?.conversion_window || (offer as any).conversion_window || 30)} days</span>
                </div>
                {(offer as any).allowed_countries && (offer as any).allowed_countries.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Geo-Restricted:</span>
                    <Badge className="text-xs bg-yellow-100 text-yellow-800">
                      {(offer as any).allowed_countries.length} countries only
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            {/* Traffic Sources */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Traffic Sources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {/* Allowed Sources */}
                {(offer.tracking?.allowed_sources || (offer as any).allowed_traffic_sources) ? (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">✅ Allowed:</div>
                    <div className="flex flex-wrap gap-1">
                      {(offer.tracking?.allowed_sources || (offer as any).allowed_traffic_sources || []).map((source: string, index: number) => (
                        <Badge key={index} className="bg-green-100 text-green-800 text-xs">
                          {source}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">✅ Allowed:</div>
                    <div className="flex flex-wrap gap-1">
                      <Badge className="bg-green-100 text-green-800 text-xs">Websites</Badge>
                      <Badge className="bg-green-100 text-green-800 text-xs">Social Media</Badge>
                      <Badge className="bg-green-100 text-green-800 text-xs">Email</Badge>
                    </div>
                  </div>
                )}
                
                {/* Blocked Sources */}
                {(offer.tracking?.blocked_sources || (offer as any).blocked_traffic_sources) && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">🚫 Prohibited:</div>
                    <div className="flex flex-wrap gap-1">
                      {(offer.tracking?.blocked_sources || (offer as any).blocked_traffic_sources || []).map((source: string, index: number) => (
                        <Badge key={index} className="bg-red-100 text-red-800 text-xs">
                          {source}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(offer.compliance?.terms_notes || (offer as any).terms_notes || offer.approval_notes) ? (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <div>
                        {offer.compliance?.terms_notes || (offer as any).terms_notes || offer.approval_notes}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Only new users eligible</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>One conversion per IP</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Complete required actions</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
