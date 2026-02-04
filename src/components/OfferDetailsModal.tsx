import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
  Info,
  ChevronDown
} from 'lucide-react';
import { Offer } from '@/services/adminOfferApi';
import { useToast } from '@/hooks/use-toast';
import { TrafficSourceDisplay } from './TrafficSourceDisplay';
import { getDefaultRulesForCategory } from '@/services/trafficSourceApi';

interface OfferDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: Offer | null;
}

const getFlagUrl = (countryCode: string) => {
  return `https://flagcdn.com/24x18/${countryCode.toLowerCase()}.png`;
};

// Tracking URL base - uses offers subdomain for cleaner links
const getTrackingBaseUrl = () => {
  // In production, use offers.moustacheleads.com
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname.includes('moustacheleads.com') || hostname.includes('vercel.app') || hostname.includes('onrender.com')) {
      return 'https://offers.moustacheleads.com';
    }
  }
  // Development - use localhost
  return 'http://localhost:5000';
};

const generateTrackingLink = (offer: Offer, userId?: string) => {
  const baseUrl = getTrackingBaseUrl();
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
  const params = new URLSearchParams();
  if (userId) params.append('user_id', userId);
  params.append('sub1', 'default');
  return `${baseUrl}/track/${offer.offer_id}?${params.toString()}`;
};

const generateQRCode = (url: string) => {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
};

const shortenUrl = async (url: string) => {
  const hash = btoa(url).substring(0, 8);
  const baseUrl = import.meta.env.VITE_APP_URL || 'https://moustacheleads.com';
  return `${baseUrl}/s/${hash}`;
};

const getDaysRemaining = (expiryDate: string) => {
  if (!expiryDate) return null;
  const expiry = new Date(expiryDate);
  const now = new Date();
  const diffTime = expiry.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'active': return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'pending': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    case 'inactive': return <XCircle className="h-4 w-4 text-red-500" />;
    default: return <AlertCircle className="h-4 w-4 text-gray-500" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-800';
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'inactive': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
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
  const [copyFieldsOpen, setCopyFieldsOpen] = React.useState<boolean>(false);
  const [selectedFields, setSelectedFields] = React.useState<Set<string>>(
    new Set(['name', 'offer_id', 'countries', 'payout', 'tracking_link', 'target_url'])
  );

  const availableFields = [
    { id: 'name', label: 'Offer Name' },
    { id: 'offer_id', label: 'Offer ID' },
    { id: 'countries', label: 'Countries' },
    { id: 'payout', label: 'Payout' },
    { id: 'tracking_link', label: 'Tracking Link' },
    { id: 'target_url', label: 'Target URL' },
    { id: 'network', label: 'Network' },
    { id: 'vertical', label: 'Vertical' },
    { id: 'device', label: 'Device Targeting' },
    { id: 'description', label: 'Description' },
  ];

  const toggleField = (fieldId: string) => {
    const newSelected = new Set(selectedFields);
    if (newSelected.has(fieldId)) {
      newSelected.delete(fieldId);
    } else {
      newSelected.add(fieldId);
    }
    setSelectedFields(newSelected);
  };

  React.useEffect(() => {
    if (offer?.offer_id) {
      setTrackingLink(generateTrackingLink(offer));
    } else {
      setTrackingLink('');
    }
  }, [offer]);

  if (!offer) return null;

  const copyToClipboard = (text: string, label: string) => {
    if (!text) {
      toast({ title: "Error", description: "Nothing to copy", variant: "destructive" });
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied!", description: `${label} copied to clipboard` });
    }).catch(() => {
      toast({ title: "Error", description: "Failed to copy", variant: "destructive" });
    });
  };

  const copySelectedFields = () => {
    if (selectedFields.size === 0) {
      toast({ title: "No Fields", description: "Select at least one field", variant: "destructive" });
      return;
    }
    const fields: string[] = [];
    if (selectedFields.has('name') && offer.name) fields.push(`Name: ${offer.name}`);
    if (selectedFields.has('offer_id') && offer.offer_id) fields.push(`Offer ID: ${offer.offer_id}`);
    if (selectedFields.has('countries') && offer.countries?.length) fields.push(`Countries: ${offer.countries.join(', ')}`);
    if (selectedFields.has('payout')) fields.push(`Payout: $${offer.payout?.toFixed(2) || '0.00'}`);
    if (selectedFields.has('tracking_link') && trackingLink) fields.push(`Tracking Link: ${trackingLink}`);
    if (selectedFields.has('target_url') && offer.target_url) fields.push(`Target URL: ${offer.target_url}`);
    if (selectedFields.has('network') && offer.network) fields.push(`Network: ${offer.network}`);
    if (selectedFields.has('vertical')) fields.push(`Category: ${(offer as any).vertical || 'OTHER'}`);
    if (selectedFields.has('device') && offer.device_targeting) fields.push(`Device: ${offer.device_targeting}`);
    if (selectedFields.has('description') && offer.description) fields.push(`Description: ${offer.description}`);
    
    navigator.clipboard.writeText(fields.join('\n')).then(() => {
      toast({ title: "Copied!", description: `${fields.length} field(s) copied` });
      setCopyFieldsOpen(false);
    }).catch(() => {
      toast({ title: "Error", description: "Failed to copy", variant: "destructive" });
    });
  };

  const daysRemaining = getDaysRemaining(offer.expiration_date || '');
  const isExpiringSoon = daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0;
  const isExpired = daysRemaining !== null && daysRemaining <= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {offer.thumbnail_url || offer.image_url ? (
              <img src={offer.thumbnail_url || offer.image_url} alt={offer.name}
                className="w-12 h-12 object-cover rounded border"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-12 h-12 bg-gray-100 rounded border flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-gray-400" />
              </div>
            )}
            <div>
              <div className="text-xl font-bold">{offer.name}</div>
              <div className="text-sm text-muted-foreground font-mono">{offer.offer_id} • {offer.campaign_id}</div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {getStatusIcon(offer.status)}
              <Badge className={getStatusColor(offer.status)}>{offer.status?.toUpperCase()}</Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link className="h-5 w-5 text-blue-600" />
                Your Tracking Link
              </div>
              <Popover open={copyFieldsOpen} onOpenChange={setCopyFieldsOpen}>
                <PopoverTrigger asChild>
                  <Button variant="default" size="sm" className="bg-green-600 hover:bg-green-700">
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Fields
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3" align="end">
                  <div className="space-y-3">
                    <div className="font-medium text-sm">Select fields to copy:</div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {availableFields.map((field) => (
                        <div key={field.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={field.id}
                            checked={selectedFields.has(field.id)}
                            onCheckedChange={() => toggleField(field.id)}
                          />
                          <label htmlFor={field.id} className="text-sm cursor-pointer">{field.label}</label>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-2 border-t">
                      <Button size="sm" variant="outline" className="flex-1 text-xs"
                        onClick={() => setSelectedFields(new Set(availableFields.map(f => f.id)))}>
                        All
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 text-xs"
                        onClick={() => setSelectedFields(new Set())}>
                        None
                      </Button>
                    </div>
                    <Button size="sm" className="w-full" onClick={copySelectedFields}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy {selectedFields.size} Field(s)
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 p-3 bg-white rounded border font-mono text-sm break-all">{trackingLink}</div>
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(trackingLink, 'Tracking Link')}><Copy className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={async () => { const s = await shortenUrl(trackingLink); setShortenedLink(s); copyToClipboard(s, 'Shortened URL'); }}><Scissors className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => setShowQRCode(!showQRCode)}><QrCode className="h-4 w-4" /></Button>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <Button variant="ghost" size="sm" onClick={() => window.open(offer.preview_url || offer.target_url || 'https://google.com', '_blank')} className="text-blue-600">
                <Eye className="h-4 w-4 mr-1" />Preview
              </Button>
            </div>
            {shortenedLink && (
              <div className="p-2 bg-green-50 border border-green-200 rounded flex items-center gap-2">
                <span className="text-xs text-green-700">Shortened:</span>
                <span className="text-sm font-mono text-green-800">{shortenedLink}</span>
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(shortenedLink, 'Shortened URL')}><Copy className="h-3 w-3" /></Button>
              </div>
            )}
            {showQRCode && (
              <div className="flex justify-center">
                <img src={generateQRCode(trackingLink)} alt="QR Code" className="w-32 h-32 border rounded" />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Offer Details</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Offer ID:</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono font-medium">{offer.offer_id}</span>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(offer.offer_id, 'Offer ID')} className="h-6 w-6 p-0"><Copy className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Payout:</span>
                    <div className="font-semibold text-green-600">
                      {(offer as any).revenue_share_percent > 0 ? `${(offer as any).revenue_share_percent}%` : `$${offer.payout?.toFixed(2)}`}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Category:</span>
                    <Badge variant="outline">{(offer as any).vertical || 'OTHER'}</Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Incentive:</span>
                    <Badge className={`text-xs ${(offer as any).incentive_type === 'Non-Incent' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                      {(offer as any).incentive_type || 'Incent'}
                    </Badge>
                  </div>
                </div>
                {offer.description && (
                  <div className="text-sm pt-2 border-t">
                    <span className="text-muted-foreground">Description:</span>
                    <p className="mt-1 p-2 bg-gray-50 rounded text-gray-700 text-xs">{offer.description}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t">
                  <div><span className="text-muted-foreground">Network:</span><div className="font-medium">{offer.network}</div></div>
                  <div>
                    <span className="text-muted-foreground">Expires:</span>
                    <div className="flex items-center gap-1">
                      {offer.expiration_date ? (
                        <>
                          <span>{new Date(offer.expiration_date).toLocaleDateString()}</span>
                          {daysRemaining !== null && (
                            <Badge className={`text-xs ${isExpired ? 'bg-red-100 text-red-800' : isExpiringSoon ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                              {isExpired ? 'EXPIRED' : `${daysRemaining}d left`}
                            </Badge>
                          )}
                        </>
                      ) : 'No expiry'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" />Locations</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {offer.countries?.slice(0, 8).map((country) => (
                    <div key={country} className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs">
                      <img src={getFlagUrl(country)} alt={country} className="w-4 h-3 rounded-sm" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      {country}
                    </div>
                  ))}
                  {(offer.countries?.length || 0) > 8 && <div className="px-2 py-1 bg-gray-100 rounded text-xs">+{offer.countries.length - 8} more</div>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Channel Info</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Device:</span><span className="capitalize">{offer.device_targeting}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Conversion Window:</span><span>{offer.tracking?.conversion_window || 30} days</span></div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Traffic Sources</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {/* Use compact TrafficSourceDisplay for read-only view */}
                <TrafficSourceDisplay
                  category={(offer as any).vertical || (offer as any).category || 'OTHER'}
                  initialRules={{
                    allowed: (offer as any).allowed_traffic_sources || offer.tracking?.allowed_sources || [],
                    risky: (offer as any).risky_traffic_sources || [],
                    disallowed: (offer as any).disallowed_traffic_sources || offer.tracking?.blocked_sources || []
                  }}
                  editable={false}
                  compact={true}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Info className="h-4 w-4" />Notes</CardTitle></CardHeader>
              <CardContent>
                {(offer.compliance?.terms_notes || offer.approval_notes) ? (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                    <div>{offer.compliance?.terms_notes || offer.approval_notes}</div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /><span>Only new users eligible</span></div>
                    <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /><span>One conversion per IP</span></div>
                    <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /><span>Complete required actions</span></div>
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
