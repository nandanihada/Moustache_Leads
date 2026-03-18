import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Globe, DollarSign, Link, Eye, Copy, QrCode, TrendingUp,
  MousePointer, CheckCircle, Monitor, Smartphone, Lock, Clock, X,
} from 'lucide-react';
import { Offer } from '@/services/adminOfferApi';
import { PublisherOffer, markOfferClicked } from '@/services/publisherOfferApi';
import { useToast } from '@/hooks/use-toast';
import { userReportsApi } from '@/services/userReportsApi';

interface OfferDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: Offer | PublisherOffer | null;
  onAccessGranted?: () => void;
}

const getFlag = (code: string) =>
  `https://flagcdn.com/24x18/${code.toLowerCase()}.png`;

const GlassCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div
    className={`rounded-2xl p-4 ${className}`}
    style={{
      background: 'rgba(255,255,255,0.07)',
      border: '1px solid rgba(255,255,255,0.12)',
      backdropFilter: 'blur(8px)',
    }}
  >
    {children}
  </div>
);

const StatCard: React.FC<{ icon: React.ReactNode; value: string; label: string; color: string }> = ({ icon, value, label, color }) => (
  <div
    className="rounded-2xl p-4 flex flex-col gap-2"
    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
  >
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
    <div className="text-2xl font-bold text-white">{value}</div>
    <div className="text-xs text-white/50">{label}</div>
  </div>
);

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥',
  CNY: '¥', RUB: '₽', BRL: 'R$', CAD: 'C$', AUD: 'A$',
  CHF: 'CHF ', SEK: 'kr', PLN: 'zł', ILS: '₪', KRW: '₩', THB: '฿',
};
const getCurrencySymbol = (currency?: string) =>
  CURRENCY_SYMBOLS[(currency || 'USD').toUpperCase()] ?? '$';

const OfferDetailsModalNew: React.FC<OfferDetailsModalProps> = ({
  open, onOpenChange, offer, onAccessGranted: _onAccessGranted,
}) => {
  const { toast } = useToast();
  const [trackingLink, setTrackingLink] = useState('');
  const [customSubId, setCustomSubId] = useState('');
  const [showQRCode, setShowQRCode] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const isLocked = offer && (
    (offer as PublisherOffer).is_locked ||
    ((offer as PublisherOffer).requires_approval && !(offer as PublisherOffer).has_access)
  );
  const hasAccess = offer && (offer as PublisherOffer).has_access !== false;

  const getTrackingBaseUrl = () => {
    if (typeof window !== 'undefined') {
      const h = window.location.hostname;
      if (h.includes('moustacheleads.com') || h.includes('vercel.app') || h.includes('onrender.com'))
        return 'https://offers.moustacheleads.com';
    }
    return 'http://localhost:5000';
  };

  const buildLink = (sub?: string) => {
    if (!offer) return '';
    const base = getTrackingBaseUrl();
    let userId = '';
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      userId = u._id || u.id || '';
    } catch {}
    const p = new URLSearchParams();
    if (userId) p.append('user_id', userId);
    p.append('sub1', sub || customSubId || 'default');
    return `${base}/track/${offer.offer_id}?${p.toString()}`;
  };

  useEffect(() => {
    if (offer && hasAccess && !isLocked) {
      setTrackingLink(buildLink());
      fetchStats(offer.offer_id);
    } else {
      setTrackingLink('');
      fetchStats(offer?.offer_id || '');
    }
  }, [offer]);

  const fetchStats = async (offerId: string) => {
    if (!offerId) return;
    try {
      setLoadingStats(true);
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      const res = await userReportsApi.getPerformanceReport({
        start_date: start.toISOString().split('T')[0],
        end_date: end.toISOString().split('T')[0],
        offer_id: offerId,
        page: 1,
        per_page: 1,
      });
      if (res.report?.summary) {
        setStats({
          total_clicks: res.report.summary.total_clicks || 0,
          total_conversions: res.report.summary.total_conversions || 0,
          total_payout: res.report.summary.total_payout || 0,
          conversion_rate: res.report.summary.avg_cr || 0,
        });
      }
    } catch {}
    finally { setLoadingStats(false); }
  };

  if (!offer) return null;

  const copy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() =>
      toast({ title: '✅ Copied!', description: `${label} copied to clipboard` })
    );
  };

  const updateLink = () => {
    const link = buildLink(customSubId);
    setTrackingLink(link);
    toast({ title: '✅ Link Updated', description: 'Tracking link updated with your Sub ID' });
  };

  const getDaysRemaining = (d: string) => {
    if (!d) return null;
    return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  };

  const daysRemaining = getDaysRemaining((offer as any).expiration_date || '');
  const isExpired = daysRemaining !== null && daysRemaining <= 0;
  const isExpiringSoon = daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 7;

  const offerImage = offer.thumbnail_url || offer.image_url;
  const status = ('status' in offer ? offer.status : (offer as PublisherOffer).approval_status) || 'unknown';
  const statusColor = status === 'active' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    : status === 'pending' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
    : 'bg-gray-500/20 text-gray-300 border-gray-500/30';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 border-0 gap-0 [&>button]:hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(15,10,40,0.97) 0%, rgba(30,15,60,0.97) 100%)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          border: '1px solid rgba(139,92,246,0.25)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
        }}
      >
        {/* Hero Header */}
        <div className="relative overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background: offerImage
                ? `linear-gradient(to bottom, rgba(15,10,40,0.3), rgba(15,10,40,0.95))`
                : 'linear-gradient(135deg, rgba(109,40,217,0.4) 0%, rgba(139,92,246,0.2) 50%, rgba(15,10,40,0.9) 100%)',
            }}
          />
          {offerImage && (
            <img src={offerImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
          )}
          <div className="relative p-6 pb-5">
            <div className="flex items-start gap-4">
              {/* Offer image / icon */}
              <div className="flex-shrink-0">
                {offerImage ? (
                  <img src={offerImage} alt={offer.name} className="w-16 h-16 rounded-2xl object-cover border border-white/20 shadow-xl" />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-xl border border-violet-400/30">
                    <DollarSign className="h-8 w-8 text-white" />
                  </div>
                )}
              </div>
              {/* Title + meta */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs font-mono text-white/40 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                    #{offer.offer_id}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${statusColor}`}>
                    {status.toUpperCase()}
                  </span>
                  {isLocked && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Approval Required
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-white leading-tight">{offer.name}</h2>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <span className="text-2xl font-bold text-emerald-400">
                    {getCurrencySymbol(offer.currency)}{offer.payout.toFixed(2)} <span className="text-sm font-normal text-white/50">{offer.currency || 'USD'}</span>
                  </span>
                  {(offer as any).conversion_type && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                      {(offer as any).conversion_type}
                    </span>
                  )}
                  {(offer as any).category && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      {(offer as any).category}
                    </span>
                  )}
                </div>
              </div>
              {/* Close */}
              <button
                onClick={() => onOpenChange(false)}
                className="flex-shrink-0 p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          {/* Gradient separator */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">

          {/* Stats Row - shown for ALL offers */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              icon={<MousePointer className="h-4 w-4 text-blue-300" />}
              value={loadingStats ? '...' : (stats?.total_clicks || 0).toLocaleString()}
              label="Total Clicks (30d)"
              color="bg-blue-500/20"
            />
            <StatCard
              icon={<CheckCircle className="h-4 w-4 text-emerald-300" />}
              value={loadingStats ? '...' : (stats?.total_conversions || 0).toLocaleString()}
              label="Conversions (30d)"
              color="bg-emerald-500/20"
            />
            <StatCard
              icon={<DollarSign className="h-4 w-4 text-violet-300" />}
              value={loadingStats ? '...' : `$${(stats?.total_payout || 0).toFixed(2)}`}
              label="Earnings (30d)"
              color="bg-violet-500/20"
            />
            <StatCard
              icon={<TrendingUp className="h-4 w-4 text-orange-300" />}
              value={loadingStats ? '...' : `${(stats?.conversion_rate || 0).toFixed(1)}%`}
              label="Conv. Rate"
              color="bg-orange-500/20"
            />
          </div>

          {/* Tracking Link - only for unlocked */}
          {!isLocked && hasAccess && (
            <GlassCard>
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-lg bg-violet-500/20 border border-violet-400/20">
                  <Link className="h-4 w-4 text-violet-300" />
                </div>
                <span className="text-sm font-semibold text-white">Your Tracking Link</span>
              </div>
              <div className="flex gap-2 mb-3">
                <div
                  className="flex-1 px-3 py-2.5 rounded-xl font-mono text-xs text-white/70 break-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  {trackingLink || 'Generating...'}
                </div>
                <Button
                  onClick={() => { copy(trackingLink, 'Tracking Link'); markOfferClicked(offer.offer_id); }}
                  size="sm"
                  className="bg-violet-600 hover:bg-violet-700 text-white border-0 px-4 flex-shrink-0"
                >
                  <Copy className="h-4 w-4 mr-1" /> Copy
                </Button>
                <Button
                  onClick={() => { if (trackingLink) { window.open(trackingLink, '_blank'); markOfferClicked(offer.offer_id); } }}
                  size="sm"
                  disabled={!trackingLink}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 px-4 flex-shrink-0"
                >
                  <Eye className="h-4 w-4 mr-1" /> Open
                </Button>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Custom Sub ID (e.g. twitter, campaign1)"
                  value={customSubId}
                  onChange={(e) => setCustomSubId(e.target.value)}
                  className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-white/30 text-xs h-8"
                />
                <Button
                  onClick={updateLink}
                  variant="outline"
                  size="sm"
                  disabled={!customSubId}
                  className="border-white/20 text-white/70 bg-white/5 hover:bg-white/10 h-8 text-xs"
                >
                  Update
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQRCode(!showQRCode)}
                  className="border-white/20 text-white/70 bg-white/5 hover:bg-white/10 h-8 text-xs"
                >
                  <QrCode className="h-3.5 w-3.5 mr-1" /> QR
                </Button>
              </div>
              {showQRCode && trackingLink && (
                <div className="flex justify-center mt-3 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-center">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(trackingLink)}`}
                      alt="QR Code"
                      className="w-40 h-40 rounded-lg"
                    />
                    <div className="text-xs text-white/40 mt-2">Scan to open tracking link</div>
                  </div>
                </div>
              )}
            </GlassCard>
          )}

          {/* Description */}
          {offer.description && (
            <GlassCard>
              <div className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Description</div>
              <p className="text-sm text-white/80 leading-relaxed">{offer.description}</p>
            </GlassCard>
          )}

          {/* Main info grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Overview */}
            <GlassCard>
              <div className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Overview</div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-white/50">Payout</span>
                  <span className="text-sm font-bold text-emerald-400">{getCurrencySymbol(offer.currency)}{offer.payout.toFixed(2)} {offer.currency || 'USD'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-white/50">Conversion Type</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                    {(offer as any).conversion_type || 'CPA'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-white/50">Incentive</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    (offer as any).incentive_allowed !== false
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-red-500/20 text-red-300 border-red-500/30'
                  }`}>
                    {(offer as any).incentive_allowed !== false ? 'Incent OK' : 'Non-Incent'}
                  </span>
                </div>
                {(offer as any).network_name && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/50">Network</span>
                    <span className="text-sm text-white/80">{(offer as any).network_name}</span>
                  </div>
                )}
              </div>
            </GlassCard>

            {/* Cap & Expiry */}
            <GlassCard>
              <div className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Cap & Expiry</div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-white/50">Daily Cap</span>
                  <span className="text-sm font-medium text-white/80">
                    {((offer as any).caps?.daily || (offer as any).daily_cap)?.toLocaleString() || 'Unlimited'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-white/50">Monthly Cap</span>
                  <span className="text-sm font-medium text-white/80">
                    {((offer as any).caps?.monthly || (offer as any).monthly_cap)?.toLocaleString() || 'Unlimited'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-white/50">Expires</span>
                  <div className="flex items-center gap-2">
                    {(offer as any).expiration_date ? (
                      <>
                        <span className="text-sm text-white/80">
                          {new Date((offer as any).expiration_date).toLocaleDateString()}
                        </span>
                        {daysRemaining !== null && (
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${
                            isExpired ? 'bg-red-500/20 text-red-300 border-red-500/30'
                              : isExpiringSoon ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          }`}>
                            {isExpired ? 'EXPIRED' : `${daysRemaining}d left`}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-sm text-white/80">No expiry</span>
                    )}
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Device & Channel */}
            <GlassCard>
              <div className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Device & Channel</div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-white/50">Device</span>
                  <span className="flex items-center gap-1.5 text-sm text-white/80">
                    {(offer as any).device_targeting === 'mobile' && <Smartphone className="h-3.5 w-3.5 text-violet-300" />}
                    {(offer as any).device_targeting === 'desktop' && <Monitor className="h-3.5 w-3.5 text-violet-300" />}
                    {(offer as any).device_targeting === 'all' && <Globe className="h-3.5 w-3.5 text-violet-300" />}
                    <span className="capitalize">{(offer as any).device_targeting || 'All Devices'}</span>
                  </span>
                </div>
                {(offer as any).os_targeting && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/50">OS</span>
                    <span className="text-sm text-white/80 capitalize">{(offer as any).os_targeting}</span>
                  </div>
                )}
                {(offer as any).vertical && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/50">Vertical</span>
                    <span className="text-sm text-white/80">{(offer as any).vertical}</span>
                  </div>
                )}
              </div>
            </GlassCard>

            {/* Traffic Sources */}
            <GlassCard>
              <div className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Traffic Sources</div>
              <div className="space-y-3">
                {((offer as any).allowed_traffic_sources || []).length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 text-xs text-emerald-400 mb-1.5">
                      <CheckCircle className="h-3 w-3" /> Allowed
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {((offer as any).allowed_traffic_sources || []).map((s: string) => (
                        <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {((offer as any).risky_traffic_sources || []).length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 text-xs text-yellow-400 mb-1.5">
                      <Clock className="h-3 w-3" /> Risky
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {((offer as any).risky_traffic_sources || []).map((s: string) => (
                        <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-300 border border-yellow-500/25">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {((offer as any).disallowed_traffic_sources || []).length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 text-xs text-red-400 mb-1.5">
                      <Lock className="h-3 w-3" /> Disallowed
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {((offer as any).disallowed_traffic_sources || []).map((s: string) => (
                        <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/25">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {!((offer as any).allowed_traffic_sources?.length) && !((offer as any).disallowed_traffic_sources?.length) && (
                  <span className="text-sm text-white/40">Not specified</span>
                )}
              </div>
            </GlassCard>
          </div>

          {/* Countries */}
          <GlassCard>
            <div className="flex items-center gap-2 mb-3">
              <Globe className="h-4 w-4 text-violet-300" />
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Allowed Countries</span>
              {offer.countries.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 ml-auto">
                  {offer.countries.length} countries
                </span>
              )}
            </div>
            {offer.countries.length === 0 ? (
              <span className="text-sm text-white/40">All countries allowed</span>
            ) : (
              <div className="flex flex-wrap gap-2">
                {offer.countries.map((country) => (
                  <div
                    key={country}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs text-white/80 font-mono"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <img
                      src={getFlag(country)}
                      alt={country}
                      className="w-4 h-3 object-cover rounded-sm"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    {country}
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Preview Landing Page */}
          {(() => {
            const previewUrl = (offer as any).preview_url || (offer as any).offer_url || 'https://google.com';
            return (
              <div className="flex justify-center">
                <Button
                  onClick={() => window.open(previewUrl, '_blank')}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 gap-1.5"
                >
                  <Eye className="h-4 w-4" />
                  Preview Landing Page
                </Button>
              </div>
            );
          })()}

        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OfferDetailsModalNew;
