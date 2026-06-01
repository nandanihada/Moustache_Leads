import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft, Globe, DollarSign, Link as LinkIcon, Eye, Copy,
  Monitor, Smartphone, Clock, Activity, Shield, Users,
  TrendingUp, BarChart3, MapPin, Layers, Settings, ExternalLink,
  CheckCircle, XCircle, AlertTriangle, Zap, Target, Calendar,
} from 'lucide-react';
import { adminOfferApi, Offer } from '@/services/adminOfferApi';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const getFlag = (code: string) =>
  `https://flagcdn.com/24x18/${code.toLowerCase()}.png`;

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States', GB: 'United Kingdom', CA: 'Canada', AU: 'Australia',
  DE: 'Germany', FR: 'France', ES: 'Spain', IT: 'Italy', NL: 'Netherlands',
  BR: 'Brazil', MX: 'Mexico', IN: 'India', JP: 'Japan', KR: 'South Korea',
  TH: 'Thailand', PH: 'Philippines', ID: 'Indonesia', MY: 'Malaysia',
  SG: 'Singapore', VN: 'Vietnam', SA: 'Saudi Arabia', AE: 'UAE',
  ZA: 'South Africa', PL: 'Poland', SE: 'Sweden', NO: 'Norway',
  DK: 'Denmark', FI: 'Finland', CH: 'Switzerland', AT: 'Austria',
  AR: 'Argentina', CL: 'Chile', CO: 'Colombia', PE: 'Peru',
  IL: 'Israel', TR: 'Turkey', RU: 'Russia', UA: 'Ukraine',
  WW: 'Worldwide', KW: 'Kuwait', EG: 'Egypt', NG: 'Nigeria',
};

const AdminOfferDetail: React.FC = () => {
  const { offerId } = useParams<{ offerId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (offerId) fetchOffer();
  }, [offerId]);

  const fetchOffer = async () => {
    try {
      setLoading(true);
      const res = await adminOfferApi.getOffer(offerId!);
      setOffer(res.offer);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: `${label} copied to clipboard` });
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800 border-green-200',
      inactive: 'bg-gray-100 text-gray-800 border-gray-200',
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      paused: 'bg-orange-100 text-orange-800 border-orange-200',
      running: 'bg-blue-100 text-blue-800 border-blue-200',
    };
    return (
      <Badge className={`${colors[status] || colors.inactive} border`}>
        {status?.charAt(0).toUpperCase() + status?.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-semibold mb-2">Offer not found</h2>
        <Button onClick={() => navigate('/admin/offers')}>Back to Offers</Button>
      </div>
    );
  }

  const countries = offer.countries || [];
  const tierRules = offer.tier_rules || [];
  const caps = offer.caps || {};
  const schedule = offer.schedule || { enabled: false, start_time: '', end_time: '', days: [] };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/offers')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{offer.name}</h1>
            {getStatusBadge(offer.status)}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {offer.offer_id} • {offer.network} • Created {offer.created_at ? new Date(offer.created_at).toLocaleDateString() : 'N/A'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate(`/admin/offers`)}>
          <Settings className="h-4 w-4 mr-1" /> Edit
        </Button>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto text-green-600 mb-1" />
            <div className="text-xl font-bold">${offer.payout?.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Payout</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-blue-600 mb-1" />
            <div className="text-xl font-bold">{offer.hits || 0}</div>
            <div className="text-xs text-muted-foreground">Total Clicks</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Globe className="h-5 w-5 mx-auto text-purple-600 mb-1" />
            <div className="text-xl font-bold">{countries.length}</div>
            <div className="text-xs text-muted-foreground">Countries</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Monitor className="h-5 w-5 mx-auto text-orange-600 mb-1" />
            <div className="text-xl font-bold capitalize">{offer.device_targeting || 'All'}</div>
            <div className="text-xs text-muted-foreground">Devices</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Target className="h-5 w-5 mx-auto text-red-600 mb-1" />
            <div className="text-xl font-bold">{offer.offer_type || 'CPA'}</div>
            <div className="text-xs text-muted-foreground">Payout Model</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="geo">Geo & Targeting</TabsTrigger>
          <TabsTrigger value="payouts">Payouts & Caps</TabsTrigger>
          <TabsTrigger value="tracking">Tracking</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Basic Info */}
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Basic Information</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Offer ID</span>
                  <span className="font-mono">{offer.offer_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Campaign ID</span>
                  <span className="font-mono">{offer.campaign_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Network</span>
                  <span>{offer.network}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Category</span>
                  <Badge variant="outline">{offer.category || offer.vertical || 'OTHER'}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Affiliates</span>
                  <span className="capitalize">{offer.affiliates || 'all'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Incentive</span>
                  <span>{(offer as any).incentive_type || 'Incent'}</span>
                </div>
                {offer.expiration_date && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expires</span>
                    <span>{new Date(offer.expiration_date).toLocaleDateString()}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Description */}
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Description</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {offer.description || 'No description available.'}
                </p>
                {offer.short_description && (
                  <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
                    <strong>Short:</strong> {offer.short_description}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* URLs */}
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">URLs & Links</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground w-20">Target</span>
                <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">{offer.target_url}</code>
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(offer.target_url, 'Target URL')}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              {offer.preview_url && (
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground w-20">Preview</span>
                  <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">{offer.preview_url}</code>
                  <Button variant="ghost" size="sm" onClick={() => window.open(offer.preview_url, '_blank')}>
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              )}
              {offer.masked_url && (
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground w-20">Masked</span>
                  <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">{offer.masked_url}</code>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(offer.masked_url!, 'Masked URL')}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Schedule */}
          {schedule.enabled && (
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Schedule</CardTitle></CardHeader>
              <CardContent className="text-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{schedule.start_time} – {schedule.end_time}</span>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {schedule.days?.map(day => (
                    <Badge key={day} variant="outline" className="text-xs">{day}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* GEO & TARGETING TAB */}
        <TabsContent value="geo" className="space-y-4 mt-4">
          {/* Country Geo-Split */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Allowed Countries ({countries.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {countries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No country targeting set (defaults to US)</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {countries.map((code: string) => (
                    <div key={code} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border">
                      <img
                        src={getFlag(code === 'WW' ? 'un' : code)}
                        alt={code}
                        className="w-6 h-4 rounded-sm object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <span className="text-sm font-medium">{code}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {COUNTRY_NAMES[code] || code}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Blocked Countries */}
          {(offer as any).blocked_countries?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" /> Blocked Countries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(offer as any).blocked_countries.map((code: string) => (
                    <Badge key={code} variant="destructive" className="text-xs">
                      {code} - {COUNTRY_NAMES[code] || code}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Device & OS Targeting */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Device Targeting</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  {offer.device_targeting === 'mobile' || offer.device_targeting === 'ios' || offer.device_targeting === 'android' ? (
                    <Smartphone className="h-4 w-4 text-blue-500" />
                  ) : (
                    <Monitor className="h-4 w-4 text-gray-500" />
                  )}
                  <span className="capitalize font-medium">{offer.device_targeting || 'All Devices'}</span>
                </div>
                {offer.os_targeting?.length ? (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {offer.os_targeting.map(os => (
                      <Badge key={os} variant="outline" className="text-xs">{os}</Badge>
                    ))}
                  </div>
                ) : null}
                {offer.browser_targeting?.length ? (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {offer.browser_targeting.map(b => (
                      <Badge key={b} variant="secondary" className="text-xs">{b}</Badge>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Additional Targeting</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {offer.carrier_targeting?.length ? (
                  <div>
                    <span className="text-muted-foreground">Carriers:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {offer.carrier_targeting.map(c => (
                        <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
                {offer.connection_type && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Connection</span>
                    <span>{offer.connection_type}</span>
                  </div>
                )}
                {offer.languages?.length ? (
                  <div>
                    <span className="text-muted-foreground">Languages:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {offer.languages.map(l => (
                        <Badge key={l} variant="outline" className="text-xs">{l}</Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* PAYOUTS & CAPS TAB */}
        <TabsContent value="payouts" className="space-y-4 mt-4">
          {/* Main Payout */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Payout Structure
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-center">
                  <div className="text-2xl font-bold text-green-700">${offer.payout?.toFixed(2)}</div>
                  <div className="text-xs text-green-600">Base Payout</div>
                </div>
                {offer.revenue && (
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-center">
                    <div className="text-2xl font-bold text-blue-700">${offer.revenue?.toFixed(2)}</div>
                    <div className="text-xs text-blue-600">Revenue</div>
                  </div>
                )}
                <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 text-center">
                  <div className="text-lg font-bold text-purple-700">{offer.currency || 'USD'}</div>
                  <div className="text-xs text-purple-600">Currency</div>
                </div>
                <div className="p-3 rounded-lg bg-orange-50 border border-orange-200 text-center">
                  <div className="text-lg font-bold text-orange-700">{offer.payout_type || offer.offer_type || 'CPA'}</div>
                  <div className="text-xs text-orange-600">Model</div>
                </div>
              </div>

              {/* Revenue Share */}
              {(offer as any).revenue_share_percent > 0 && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-800">
                      Revenue Share: {(offer as any).revenue_share_percent}%
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Level-Based Payouts (Tier Rules) */}
          {tierRules.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Layers className="h-4 w-4" /> Level-Based Payouts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-xs font-medium text-muted-foreground border-b pb-2">
                    <span>Level</span>
                    <span>Min Conversions</span>
                    <span>Payout</span>
                  </div>
                  {tierRules.map((tier, idx) => (
                    <div key={idx} className="grid grid-cols-3 gap-2 text-sm p-2 rounded-lg hover:bg-muted/50">
                      <span className="font-medium">Level {idx + 1}</span>
                      <span>{tier.min_conversions}+ conversions</span>
                      <span className="font-bold text-green-700">${tier.payout.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Caps */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Conversion Caps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg border">
                  <div className="text-lg font-bold">{caps.daily || '∞'}</div>
                  <div className="text-xs text-muted-foreground">Daily</div>
                </div>
                <div className="text-center p-3 rounded-lg border">
                  <div className="text-lg font-bold">{caps.weekly || '∞'}</div>
                  <div className="text-xs text-muted-foreground">Weekly</div>
                </div>
                <div className="text-center p-3 rounded-lg border">
                  <div className="text-lg font-bold">{caps.monthly || '∞'}</div>
                  <div className="text-xs text-muted-foreground">Monthly</div>
                </div>
                <div className="text-center p-3 rounded-lg border">
                  <div className="text-lg font-bold">{caps.total || '∞'}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
              </div>
              {caps.auto_pause && (
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Auto-pause when cap reached
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TRACKING TAB */}
        <TabsContent value="tracking" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Tracking Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {offer.tracking?.protocol && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Protocol</span>
                  <span>{offer.tracking.protocol}</span>
                </div>
              )}
              {offer.tracking?.postback_url && (
                <div>
                  <span className="text-muted-foreground text-xs">Postback URL</span>
                  <code className="block text-xs bg-muted px-2 py-1 rounded mt-1 break-all">
                    {offer.tracking.postback_url}
                  </code>
                </div>
              )}
              {offer.tracking?.click_expiration && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Click Expiration</span>
                  <span>{offer.tracking.click_expiration} days</span>
                </div>
              )}
              {offer.tracking?.conversion_window && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Conversion Window</span>
                  <span>{offer.tracking.conversion_window} days</span>
                </div>
              )}
              {offer.tracking?.duplicate_rule && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duplicate Rule</span>
                  <span>{offer.tracking.duplicate_rule}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Smart Rules */}
          {offer.smart_rules && (
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Smart Rules</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {offer.smart_rules.random_redirect && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Random Redirect Enabled</span>
                  </div>
                )}
                {offer.smart_rules.rotation_enabled && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Rotation Enabled (weight: {offer.smart_rules.rotation_weight})</span>
                  </div>
                )}
                {offer.smart_rules.geo_redirect && Object.keys(offer.smart_rules.geo_redirect).length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Geo Redirects:</span>
                    <div className="mt-1 space-y-1">
                      {Object.entries(offer.smart_rules.geo_redirect).map(([geo, url]) => (
                        <div key={geo} className="flex items-center gap-2 text-xs">
                          <Badge variant="outline">{geo}</Badge>
                          <code className="truncate flex-1">{url}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Fallback Redirect */}
          {offer.fallback_redirect_enabled && (
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Fallback Redirect</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Timer</span>
                  <span>{offer.fallback_redirect_timer || 0}s</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">URL</span>
                  <code className="block text-xs bg-muted px-2 py-1 rounded mt-1 break-all">
                    {offer.fallback_redirect_url}
                  </code>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* COMPLIANCE TAB */}
        <TabsContent value="compliance" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Traffic Sources */}
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Traffic Sources</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {(offer as any).allowed_traffic_sources?.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground">Allowed</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(offer as any).allowed_traffic_sources.map((s: string) => (
                        <Badge key={s} className="bg-green-100 text-green-800 text-xs">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {(offer as any).risky_traffic_sources?.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground">Risky</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(offer as any).risky_traffic_sources.map((s: string) => (
                        <Badge key={s} className="bg-yellow-100 text-yellow-800 text-xs">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {(offer as any).disallowed_traffic_sources?.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground">Disallowed</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(offer as any).disallowed_traffic_sources.map((s: string) => (
                        <Badge key={s} variant="destructive" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Compliance Rules */}
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Compliance & Restrictions</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {offer.compliance?.allowed_traffic?.length ? (
                  <div>
                    <span className="text-xs text-muted-foreground">Allowed Traffic Types</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {offer.compliance.allowed_traffic.map(t => (
                        <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
                {offer.compliance?.disallowed_traffic?.length ? (
                  <div>
                    <span className="text-xs text-muted-foreground">Disallowed Traffic Types</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {offer.compliance.disallowed_traffic.map(t => (
                        <Badge key={t} variant="destructive" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
                {offer.compliance?.terms_notes && (
                  <div>
                    <span className="text-xs text-muted-foreground">Terms</span>
                    <p className="text-xs mt-1 whitespace-pre-wrap">{offer.compliance.terms_notes}</p>
                  </div>
                )}
                {(offer as any).restrictions && (
                  <div>
                    <span className="text-xs text-muted-foreground">Restrictions</span>
                    <p className="text-xs mt-1 whitespace-pre-wrap">{(offer as any).restrictions}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminOfferDetail;
