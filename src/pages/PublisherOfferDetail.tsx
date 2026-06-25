import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, Copy, ExternalLink, Globe, DollarSign, Monitor, Smartphone, Tablet,
  TrendingUp, MousePointer, CheckCircle, Clock, Lock, Zap, Eye, ChevronDown,
  Layers, Target, Shield, AlertTriangle, FileText, Info
} from 'lucide-react';
import { publisherOfferApi, type PublisherOffer, markOfferClicked } from '@/services/publisherOfferApi';
import { userReportsApi } from '@/services/userReportsApi';
import { searchLogsApi } from '@/services/searchLogsApi';
import { useToast } from '@/hooks/use-toast';
import { getOfferImage } from '@/utils/categoryImages';

const getFlag = (code: string) => {
  const c = code.toUpperCase();
  const mapped = c === 'UK' ? 'GB' : c;
  return `https://flagcdn.com/24x18/${mapped.toLowerCase()}.png`;
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: 'C$', AUD: 'A$',
};
const getCurrencySymbol = (currency?: string) => CURRENCY_SYMBOLS[(currency || 'USD').toUpperCase()] ?? '$';

export default function PublisherOfferDetail() {
  const { offerId } = useParams<{ offerId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [offer, setOffer] = useState<PublisherOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [customSubId, setCustomSubId] = useState('');
  const [trackingLink, setTrackingLink] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    description: true, geo: true, device: true, traffic: true, levels: true, geosplit: true
  });
  const [geoSearch, setGeoSearch] = useState('');

  const [applyLoading, setApplyLoading] = useState(false);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    if (offerId) { fetchOffer(); fetchStats(); }
  }, [offerId]);

  const fetchOffer = async () => {
    try {
      setLoading(true);

      // Strategy 1: Search in available offers (main list — most reliable for all offers)
      try {
        const response = await publisherOfferApi.getAvailableOffers({ search: offerId, per_page: 100 });
        if (response.offers?.length > 0) {
          const found = response.offers.find(o => o.offer_id === offerId);
          if (found) {
            setOffer(found);
            if (found.has_access && !found.is_locked) buildTrackingLink(found);
            return;
          }
        }
      } catch { /* fallback */ }

      // Strategy 2: Try my offers (already approved — handles inactive offers user still has access to)
      try {
        const myRes = await publisherOfferApi.getMyOffers();
        if (myRes.offers?.length > 0) {
          const found = myRes.offers.find((o: any) => o.offer_id === offerId);
          if (found) {
            setOffer(found as PublisherOffer);
            buildTrackingLink(found as PublisherOffer);
            return;
          }
        }
      } catch { /* fallback */ }

      // Strategy 3: Try dedicated detail endpoint
      try {
        const detailRes = await publisherOfferApi.getOfferDetails(offerId!);
        if (detailRes.success && detailRes.offer) {
          setOffer(detailRes.offer);
          if (detailRes.offer.has_access && !detailRes.offer.is_locked) buildTrackingLink(detailRes.offer);
          return;
        }
      } catch { /* not found */ }
    } catch (err) { console.error('Failed to load offer:', err); }
    finally { setLoading(false); }
  };

  const handleApply = async () => {
    if (!offer || applyLoading) return;
    setApplyLoading(true);
    try {
      const result = await publisherOfferApi.requestOfferAccess(offer.offer_id, '');
      if (result.status === 'approved' || result.auto_approved) {
        toast({ title: '✅ Access Granted!', description: 'You now have access to this offer.' });
        // Refresh offer data to get updated access status
        await fetchOffer();
      } else {
        toast({ title: '📨 Request Sent', description: 'Your access request has been submitted. You\'ll be notified when approved.' });
        // Update local state to reflect pending
        setOffer(prev => prev ? { ...prev, has_access: false, request_status: 'pending', access_reason: 'Access request pending' } : null);
      }
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || err?.message || 'Failed to send request';
      toast({ title: 'Error', description: errorMsg, variant: 'destructive' });
    } finally {
      setApplyLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!offerId) return;
    try {
      const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 30);
      const res = await userReportsApi.getPerformanceReport({
        start_date: start.toISOString().split('T')[0], end_date: end.toISOString().split('T')[0],
        offer_id: offerId, page: 1, per_page: 1,
      });
      if (res.report?.summary) {
        setStats({
          clicks: res.report.summary.total_clicks || 0,
          conversions: res.report.summary.total_conversions || 0,
          earnings: res.report.summary.total_payout || 0,
          cr: res.report.summary.avg_cr || 0,
          epc: res.report.summary.total_clicks > 0 ? (res.report.summary.total_payout / res.report.summary.total_clicks) : 0,
        });
      }
    } catch { }
  };

  const buildTrackingLink = (o: PublisherOffer) => {
    const base = window.location.hostname.includes('moustacheleads.com')
      ? 'https://offers.moustacheleads.com' : 'http://localhost:5000';
    let userId = '';
    try { const u = JSON.parse(localStorage.getItem('user') || '{}'); userId = u._id || u.id || ''; } catch { }
    setTrackingLink(`${base}/track/${o.offer_id}?user_id=${userId}&sub1=${customSubId || '{your_user_id}'}`);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: '✅ Copied!', description: `${label} copied to clipboard` });
    // Track the click event
    if (offer) {
      markOfferClicked(offer.offer_id);
      searchLogsApi.trackSearchAction('clicked_tracking', null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f9fb]">
        {/* Skeleton hero */}
        <div className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #630ed4 0%, #25005a 50%, #4b41e1 100%)' }}>
          <div className="max-w-[1440px] mx-auto px-6 md:px-8 py-10 md:py-14">
            <div className="animate-pulse space-y-4">
              <div className="h-4 w-32 bg-white/20 rounded" />
              <div className="flex items-center gap-3">
                <div className="h-6 w-16 bg-white/15 rounded-full" />
                <div className="h-6 w-28 bg-white/10 rounded-lg" />
              </div>
              <div className="h-10 w-80 bg-white/20 rounded-lg" />
              <div className="h-4 w-96 bg-white/10 rounded" />
            </div>
          </div>
        </div>
        {/* Skeleton stats strip */}
        <div className="max-w-[1440px] mx-auto px-6 md:px-8 -mt-6 relative z-20">
          <div className="bg-white rounded-xl shadow-xl border border-[#630ed4]/10 grid grid-cols-2 md:grid-cols-5 divide-x divide-gray-100">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-5 py-5 flex flex-col items-center md:items-start animate-pulse">
                <div className="h-3 w-16 bg-gray-200 rounded mb-2" />
                <div className="h-7 w-20 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        </div>
        {/* Skeleton content */}
        <div className="max-w-[1440px] mx-auto px-6 md:px-8 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-gray-100" />
                  <div className="h-5 w-40 bg-gray-100 rounded" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-full bg-gray-50 rounded" />
                  <div className="h-3 w-3/4 bg-gray-50 rounded" />
                  <div className="h-3 w-1/2 bg-gray-50 rounded" />
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="h-5 w-24 bg-gray-100 rounded mb-4" />
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <div className="h-3 w-20 bg-gray-50 rounded" />
                    <div className="h-3 w-16 bg-gray-100 rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* Loading message */}
        <div className="flex flex-col items-center justify-center mt-8 gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-[3px] border-[#eaddff] border-t-[#630ed4] animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-[#630ed4] animate-pulse" />
            </div>
          </div>
          <p className="text-sm text-gray-500 font-medium">Loading offer details...</p>
        </div>
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-gray-500 text-lg">Offer not found</p>
        <Button onClick={() => navigate(-1)} variant="outline" className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Offers
        </Button>
      </div>
    );
  }

  const hasAccess = offer.has_access && !offer.is_locked;
  const cs = getCurrencySymbol(offer.currency);

  return (
    <div className="min-h-screen bg-[#f7f9fb]">
      {/* ===== HERO SECTION ===== */}
      <section className="relative overflow-hidden text-white" style={{ background: 'linear-gradient(135deg, #630ed4 0%, #25005a 50%, #4b41e1 100%)' }}>
        {/* Offer image as background with glass overlay */}
        <div className="absolute inset-0 z-0">
          <img src={getOfferImage(offer as any)} alt="" className="w-full h-full object-cover opacity-10 blur-sm scale-110" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(99,14,212,0.93) 0%, rgba(37,0,90,0.96) 50%, rgba(75,65,225,0.93) 100%)' }} />
        </div>

        {/* Animated mesh grid with glowing nodes */}
        <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden">
          {/* SVG mesh grid pattern */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.12]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* Glowing nodes at intersections */}
          <div className="absolute top-[18%] left-[12%] w-3 h-3 bg-white/40 rounded-full" style={{ animation: 'nodePulse 3s ease-in-out infinite', boxShadow: '0 0 12px 4px rgba(255,255,255,0.3)' }} />
          <div className="absolute top-[42%] left-[35%] w-2.5 h-2.5 bg-violet-300/50 rounded-full" style={{ animation: 'nodePulse 4s ease-in-out infinite 1s', boxShadow: '0 0 10px 3px rgba(196,148,255,0.3)' }} />
          <div className="absolute top-[28%] right-[22%] w-2 h-2 bg-white/30 rounded-full" style={{ animation: 'nodePulse 3.5s ease-in-out infinite 0.5s', boxShadow: '0 0 8px 3px rgba(255,255,255,0.2)' }} />
          <div className="absolute top-[65%] left-[55%] w-3.5 h-3.5 bg-indigo-300/40 rounded-full" style={{ animation: 'nodePulse 5s ease-in-out infinite 2s', boxShadow: '0 0 14px 5px rgba(165,148,255,0.25)' }} />
          <div className="absolute top-[75%] left-[18%] w-2 h-2 bg-white/25 rounded-full" style={{ animation: 'nodePulse 3s ease-in-out infinite 1.5s', boxShadow: '0 0 8px 3px rgba(255,255,255,0.15)' }} />
          <div className="absolute top-[50%] right-[10%] w-2.5 h-2.5 bg-purple-200/35 rounded-full" style={{ animation: 'nodePulse 4.5s ease-in-out infinite 3s', boxShadow: '0 0 10px 4px rgba(200,160,255,0.2)' }} />
          <div className="absolute top-[10%] left-[60%] w-2 h-2 bg-white/20 rounded-full" style={{ animation: 'nodePulse 3.5s ease-in-out infinite 2.5s', boxShadow: '0 0 8px 3px rgba(255,255,255,0.15)' }} />
          <div className="absolute top-[85%] right-[35%] w-2 h-2 bg-violet-200/30 rounded-full" style={{ animation: 'nodePulse 4s ease-in-out infinite 0.8s', boxShadow: '0 0 8px 3px rgba(200,170,255,0.2)' }} />

          {/* Connecting lines between nodes (SVG) */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.08]" xmlns="http://www.w3.org/2000/svg">
            <line x1="12%" y1="18%" x2="35%" y2="42%" stroke="white" strokeWidth="0.8" />
            <line x1="35%" y1="42%" x2="78%" y2="28%" stroke="white" strokeWidth="0.5" />
            <line x1="35%" y1="42%" x2="55%" y2="65%" stroke="white" strokeWidth="0.6" />
            <line x1="55%" y1="65%" x2="90%" y2="50%" stroke="white" strokeWidth="0.4" />
            <line x1="12%" y1="18%" x2="60%" y2="10%" stroke="white" strokeWidth="0.4" />
            <line x1="18%" y1="75%" x2="55%" y2="65%" stroke="white" strokeWidth="0.5" />
            <line x1="65%" y1="85%" x2="55%" y2="65%" stroke="white" strokeWidth="0.4" />
          </svg>

          {/* Radial gradient accent glow */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-30" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-20" style={{ background: 'radial-gradient(circle, rgba(99,14,212,0.4) 0%, transparent 70%)', transform: 'translate(-20%, 30%)' }} />
        </div>

        {/* CSS animations */}
        <style>{`
          @keyframes nodePulse {
            0%, 100% { opacity: 0.4; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.6); }
          }
        `}</style>

        <div className="max-w-[1440px] mx-auto relative z-10 px-6 md:px-8 py-10 md:py-14">
          {/* Back button */}
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Offers
          </button>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
            <div className="flex items-start gap-4">
              {/* Offer image thumbnail */}
              <img src={getOfferImage(offer as any)} alt={offer.name} className="w-20 h-20 rounded-xl object-cover border-2 border-white/20 shadow-xl hidden md:block" style={{ backdropFilter: 'blur(8px)' }} />
              <div className="space-y-3">
              {/* Status + ID */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-emerald-500/20 text-emerald-200 px-3 py-1 rounded-full text-[11px] font-mono font-semibold tracking-wider uppercase flex items-center gap-1.5 border border-emerald-400/30">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  Active
                </span>
                <span className="text-white/50 font-mono text-[11px] tracking-wider uppercase bg-white/10 px-3 py-1 rounded-lg backdrop-blur-md border border-white/10">
                  ID: {offer.offer_id}
                </span>
                {offer.level_payouts?.enabled && (
                  <span className="bg-amber-400/20 text-amber-200 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider uppercase border border-amber-400/30">Multi-Level</span>
                )}
                {(offer.geo_payouts || []).length > 0 && (
                  <span className="bg-cyan-400/20 text-cyan-200 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider uppercase border border-cyan-400/30">Geo-Split</span>
                )}
              </div>

              {/* Offer Name */}
              <h1 className="text-3xl md:text-[44px] font-bold leading-tight tracking-tight drop-shadow-sm" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
                {offer.name}
              </h1>

              {/* Short description — show refined summary if available, hide raw description */}
              {(offer as any).refined_description?.summary ? (
                <p className="text-white/70 max-w-2xl text-[15px] leading-relaxed">
                  {(offer as any).refined_description.summary}
                </p>
              ) : (offer as any).refined_description?.event_flow ? (
                <p className="text-white/70 max-w-2xl text-[15px] leading-relaxed">
                  {(offer as any).refined_description.event_flow}
                </p>
              ) : null}
            </div>
            </div>

            {/* Glass Payout Card */}
            <div className="min-w-[280px] rounded-xl p-6 flex flex-col items-center" style={{
              background: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            }}>
              <span className="text-white/50 text-[11px] font-mono tracking-[0.15em] uppercase mb-1">Standard Payout</span>
              <div className="text-[42px] font-bold text-white mb-4 drop-shadow-md" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
                {cs}{offer.payout.toFixed(2)}
              </div>
              {hasAccess ? (
                <Button onClick={() => window.open(offer.preview_url || '#', '_blank')} className="w-full bg-white text-[#630ed4] hover:bg-purple-50 font-bold rounded-lg shadow-lg hover:shadow-xl transition-all active:scale-95">
                  <Eye className="h-4 w-4 mr-2" /> Preview Landing Page
                </Button>
              ) : (
                <Button
                  onClick={handleApply}
                  disabled={applyLoading || offer.request_status === 'pending'}
                  className="w-full bg-white text-[#630ed4] hover:bg-purple-50 font-bold rounded-lg shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-60"
                >
                  {applyLoading ? (
                    <><span className="w-4 h-4 border-2 border-[#630ed4] border-t-transparent rounded-full animate-spin mr-2" /> Applying...</>
                  ) : offer.request_status === 'pending' ? (
                    <><Clock className="h-4 w-4 mr-2" /> Request Pending</>
                  ) : (
                    <><Zap className="h-4 w-4 mr-2" /> Apply to Offer</>
                  )}
                </Button>
              )}
              <p className="text-[10px] text-white/40 mt-2 font-mono tracking-wider uppercase">
                {hasAccess ? 'Access granted — start promoting' : 'Approval usually within 24h'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== ANALYTICS STRIP (overlaps hero) ===== */}
      <div className="max-w-[1440px] mx-auto px-6 md:px-8 -mt-6 relative z-20">
        <div className="bg-white rounded-xl shadow-xl border border-[#630ed4]/10 grid grid-cols-2 md:grid-cols-5 divide-x divide-gray-100">
          {[
            { label: 'Clicks', value: (stats?.clicks || 0).toLocaleString(), color: '' },
            { label: 'Conversions', value: (stats?.conversions || 0).toLocaleString(), color: '' },
            { label: 'Earnings', value: `${cs}${(stats?.earnings || 0).toFixed(2)}`, color: 'text-[#630ed4]' },
            { label: 'Conv. Rate', value: `${(stats?.cr || 0).toFixed(2)}%`, color: '' },
            { label: 'EPC', value: `${cs}${(stats?.epc || 0).toFixed(3)}`, color: '' },
          ].map((stat, i) => (
            <div key={i} className="px-5 py-5 flex flex-col items-center md:items-start group cursor-default">
              <span className="text-gray-400 text-[11px] font-mono tracking-[0.05em] uppercase mb-1 group-hover:text-[#630ed4] transition-colors">{stat.label}</span>
              <span className={`text-2xl font-bold ${stat.color || 'text-gray-900'} group-hover:scale-105 transition-transform duration-300`} style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ===== MAIN CONTENT GRID ===== */}
      <div className="max-w-[1440px] mx-auto px-6 md:px-8 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6 pb-12">

        {/* ===== LEFT COLUMN ===== */}
        <div className="lg:col-span-2 space-y-5">

          {/* Tracking Link (only if access granted) */}
          {hasAccess && (
            <div className="bg-white rounded-xl border border-[#630ed4]/10 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-[#eaddff] flex items-center justify-center"><Copy className="h-5 w-5 text-[#630ed4]" /></div>
                <h2 className="text-lg font-semibold text-gray-900" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>Your Tracking Link</h2>
              </div>
              <div className="flex gap-2">
                <Input value={trackingLink} readOnly className="font-mono text-xs bg-[#f7f9fb] border-gray-200 flex-1" />
                <Button size="sm" onClick={() => copyToClipboard(trackingLink, 'Tracking link')} className="bg-[#630ed4] hover:bg-[#5a00c6] text-white shrink-0 shadow-md shadow-[#630ed4]/20" title="Copy link">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button size="sm" onClick={() => { if (trackingLink) { window.open(trackingLink, '_blank'); markOfferClicked(offer!.offer_id); searchLogsApi.trackSearchAction('clicked_tracking', null); } }} className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-md shadow-emerald-200" title="Open link in new tab">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Input placeholder="Custom Sub ID (your user's identifier)" value={customSubId} onChange={(e) => setCustomSubId(e.target.value)} className="text-xs h-9 bg-[#f7f9fb]" />
                <Button size="sm" variant="outline" onClick={() => offer && buildTrackingLink(offer)} className="text-xs h-9 border-[#630ed4]/20 text-[#630ed4] hover:bg-[#eaddff]">Update</Button>
              </div>
            </div>
          )}

          {/* Description Card (Expandable) */}
          <ExpandableCard
            icon={<FileText className="h-5 w-5 text-[#630ed4]" />}
            iconBg="bg-[#eaddff]"
            title="Offer Description"
            expanded={expandedSections.description}
            onToggle={() => toggleSection('description')}
          >
            {(offer as any).refined_description && ((offer as any).refined_description.summary || (offer as any).refined_description.steps?.length) ? (
              <div className="space-y-4">
                {/* Summary */}
                {(offer as any).refined_description.summary && (
                  <p className="text-gray-600 text-[15px] leading-relaxed">{(offer as any).refined_description.summary}</p>
                )}

                {/* Event Flow */}
                {(offer as any).refined_description.event_flow && (
                  <div className="px-4 py-2.5 rounded-lg bg-[#eaddff]/50 border border-[#630ed4]/10">
                    <p className="text-sm font-medium text-[#630ed4]">{(offer as any).refined_description.event_flow}</p>
                  </div>
                )}

                {/* Steps */}
                {(offer as any).refined_description.steps?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">How to Complete</h4>
                    <div className="space-y-2">
                      {(offer as any).refined_description.steps.map((step: string, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-[#f7f9fb]">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-bold" style={{ background: 'linear-gradient(135deg, #630ed4, #4b41e1)' }}>{i + 1}</div>
                          <span className="text-sm text-gray-700 leading-snug pt-0.5">{step.replace(/^Step\s*\d+:\s*/i, '')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Deposit Requirement */}
                {(offer as any).refined_description.deposit_requirement && (
                  <div className="px-4 py-3 rounded-lg bg-blue-50 border border-blue-100 flex items-start gap-3">
                    <DollarSign className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-0.5">Deposit Required</h4>
                      <p className="text-sm text-blue-700 font-medium">{(offer as any).refined_description.deposit_requirement}</p>
                    </div>
                  </div>
                )}

                {/* Approval Period */}
                {(offer as any).refined_description.approval_period && (
                  <div className="px-4 py-3 rounded-lg bg-indigo-50 border border-indigo-100 flex items-start gap-3">
                    <Clock className="h-5 w-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-0.5">Approval Period</h4>
                      <p className="text-sm text-indigo-700">{(offer as any).refined_description.approval_period}</p>
                    </div>
                  </div>
                )}

                {/* Restrictions */}
                {(offer as any).refined_description.restrictions?.length > 0 && (
                  <div className="px-4 py-3 rounded-lg bg-amber-50 border border-amber-100">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1.5">Restrictions</h4>
                        <ul className="space-y-1">
                          {(offer as any).refined_description.restrictions.map((r: string, i: number) => (
                            <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-1.5 flex-shrink-0" />{r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Difficulty & Time */}
                {((offer as any).refined_description.difficulty || (offer as any).refined_description.estimated_time) && (
                  <div className="flex items-center gap-3">
                    {(offer as any).refined_description.difficulty && (
                      <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                        (offer as any).refined_description.difficulty === 'Easy' ? 'bg-emerald-100 text-emerald-700' :
                        (offer as any).refined_description.difficulty === 'Hard' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>{(offer as any).refined_description.difficulty}</span>
                    )}
                    {(offer as any).refined_description.estimated_time && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> {(offer as any).refined_description.estimated_time}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-600 text-[15px] leading-relaxed">{offer.description || 'No description available for this offer.'}</p>
            )}
          </ExpandableCard>

          {/* Level-Based Payouts */}
          {offer.level_payouts?.enabled && (offer.level_payouts.levels?.length || 0) > 0 && (
            <ExpandableCard
              icon={<Layers className="h-5 w-5 text-amber-600" />}
              iconBg="bg-amber-100"
              title="Payout Levels"
              badge={`${offer.level_payouts.levels.length} tiers`}
              expanded={expandedSections.levels}
              onToggle={() => toggleSection('levels')}
            >
              <p className="text-gray-500 text-sm mb-4">Earn different payouts based on the conversion stage your traffic reaches.</p>
              <div className="space-y-2.5">
                {offer.level_payouts.levels.map((lvl, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3.5 rounded-xl bg-[#f7f9fb] border border-gray-100 hover:border-[#630ed4]/20 hover:shadow-sm transition-all group cursor-default">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm" style={{ background: 'linear-gradient(135deg, #630ed4, #4b41e1)' }}>
                        {lvl.level}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{lvl.name}</div>
                        <div className="text-[11px] font-mono text-gray-400 tracking-wider">{lvl.type}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-[#630ed4]" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>{cs}{lvl.payout.toFixed(2)}</div>
                      <div className="text-[10px] text-gray-400 font-mono tracking-wider">YOUR PAYOUT</div>
                    </div>
                  </div>
                ))}
              </div>
            </ExpandableCard>
          )}

          {/* Geo & Device Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
            {/* Geo Targeting */}
            <ExpandableCard
              icon={<Globe className="h-5 w-5 text-[#4b41e1]" />}
              iconBg="bg-indigo-100"
              title="Geo Targeting"
              expanded={expandedSections.geo}
              onToggle={() => toggleSection('geo')}
            >
              {offer.countries?.length === 0 ? (
                <p className="text-gray-400 text-sm">All countries — worldwide</p>
              ) : (
                <div className="space-y-3">
                  {/* Allowed Countries */}
                  <div>
                    <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> Allowed Countries</h4>
                    <div className="space-y-1.5">
                      {(offer.countries || []).slice(0, 10).map(c => (
                        <div key={c} className="flex items-center justify-between p-2.5 rounded-lg bg-[#f7f9fb] hover:bg-[#eaddff]/20 transition-colors">
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-gray-200 shadow-sm tracking-wider">{c}</span>
                            <img src={getFlag(c)} alt={c} className="w-5 h-3.5 rounded-sm object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          </div>
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                        </div>
                      ))}
                      {(offer.countries || []).length > 10 && (
                        <p className="text-xs text-gray-400 mt-2">+ {offer.countries.length - 10} more countries</p>
                      )}
                    </div>
                  </div>

                  {/* Restricted Areas */}
                  {(offer as any).refined_description?.restricted_areas?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Excluded Regions</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {(offer as any).refined_description.restricted_areas.map((area: string, i: number) => (
                          <span key={i} className="px-2.5 py-1 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 font-medium">✗ {area}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Target Cities */}
                  {(offer as any).refined_description?.cities?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-2 flex items-center gap-1"><Globe className="h-3.5 w-3.5" /> Target Cities</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {(offer as any).refined_description.cities.map((city: string, i: number) => (
                          <span key={i} className="px-2.5 py-1 bg-purple-50 text-purple-700 text-xs rounded-lg border border-purple-200 font-medium">📍 {city}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ExpandableCard>

            {/* Device Rules */}
            <ExpandableCard
              icon={<Monitor className="h-5 w-5 text-[#630ed4]" />}
              iconBg="bg-[#eaddff]"
              title="Device Rules"
              expanded={expandedSections.device}
              onToggle={() => toggleSection('device')}
            >
              {(() => {
                const dt = (Array.isArray(offer.device_targeting) ? offer.device_targeting.join(',') : (offer.device_targeting || 'all')).toLowerCase();
                const isAll = dt === 'all' || dt.includes('desktop') && dt.includes('mobile');
                const isMobile = isAll || dt === 'mobile' || dt.includes('mobile') || dt.includes('ios') || dt.includes('android') || dt.includes('phone');
                const isDesktop = isAll || dt === 'desktop' || dt.includes('desktop') || dt.includes('windows') || dt.includes('mac');
                const isTablet = isAll || isMobile || dt.includes('tablet') || dt.includes('ipad');
                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { icon: Smartphone, label: 'Mobile', sub: 'iOS · Android', allowed: isMobile },
                        { icon: Monitor, label: 'Desktop', sub: 'Win · Mac', allowed: isDesktop },
                        { icon: Tablet, label: 'Tablet', sub: 'iPad · Android', allowed: isTablet },
                      ].map((d, i) => (
                        <div key={i} className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-colors ${d.allowed ? 'border-[#630ed4]/10 bg-white hover:border-[#630ed4]/30' : 'border-gray-200 bg-[#f7f9fb] opacity-40'}`}>
                          <d.icon className={`h-6 w-6 mb-1.5 ${d.allowed ? 'text-[#630ed4]' : 'text-gray-300'}`} />
                          <span className="text-[11px] font-mono tracking-wider uppercase text-gray-700 font-semibold">{d.label}</span>
                          <span className="text-[9px] text-gray-400 mt-0.5">{d.sub}</span>
                          <span className={`text-[10px] font-bold mt-1.5 ${d.allowed ? 'text-emerald-600' : 'text-red-500 uppercase'}`}>{d.allowed ? 'Allowed' : 'Restricted'}</span>
                        </div>
                      ))}
                    </div>
                    {dt !== 'all' && (
                      <p className="text-xs text-gray-400 mt-2">Targeting: <span className="font-medium text-gray-600">{Array.isArray(offer.device_targeting) ? offer.device_targeting.join(', ') : offer.device_targeting}</span></p>
                    )}
                  </div>
                );
              })()}
            </ExpandableCard>
          </div>

          {/* Traffic Rules */}
          <ExpandableCard
            icon={<Shield className="h-5 w-5 text-red-600" />}
            iconBg="bg-red-100"
            title="Traffic Rules & Restrictions"
            expanded={expandedSections.traffic}
            onToggle={() => toggleSection('traffic')}
          >
            <div className="grid md:grid-cols-2 gap-5">
              {/* Allowed */}
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                <h3 className="text-emerald-700 font-bold text-sm mb-3 flex items-center gap-1.5"><CheckCircle className="h-4 w-4" /> Allowed Traffic</h3>
                <ul className="space-y-2">
                  {((offer as any).allowed_traffic_sources || []).length > 0 ? (
                    ((offer as any).allowed_traffic_sources || []).map((s: string, i: number) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-700"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />{s}</li>
                    ))
                  ) : (
                    <li className="text-sm text-gray-400">Not specified</li>
                  )}
                </ul>
              </div>
              {/* Restricted */}
              <div className="bg-red-50/50 p-4 rounded-xl border border-red-100">
                <h3 className="text-red-700 font-bold text-sm mb-3 flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Restricted Traffic</h3>
                <ul className="space-y-2">
                  {((offer as any).disallowed_traffic_sources || []).length > 0 ? (
                    ((offer as any).disallowed_traffic_sources || []).map((s: string, i: number) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-700"><span className="w-1.5 h-1.5 bg-red-500 rounded-full" />{s}</li>
                    ))
                  ) : (
                    <li className="text-sm text-gray-400">None specified</li>
                  )}
                </ul>
              </div>
            </div>
          </ExpandableCard>

          {/* Geo-Split Payouts */}
          {(offer.geo_payouts || []).length > 0 && (
            <ExpandableCard
              icon={<Globe className="h-5 w-5 text-cyan-600" />}
              iconBg="bg-cyan-100"
              title="Geo-Split Payouts"
              badge={`${offer.geo_payouts!.length} countries`}
              expanded={expandedSections.geosplit}
              onToggle={() => toggleSection('geosplit')}
            >
              <p className="text-gray-500 text-sm mb-3">Different payout per country. Base rate ({cs}{offer.payout.toFixed(2)}) applies to all other GEOs.</p>
              
              {/* Search */}
              <div className="relative mb-3">
                <input
                  type="text"
                  placeholder="Search country..."
                  value={geoSearch}
                  onChange={(e) => setGeoSearch(e.target.value.toUpperCase())}
                  className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-[#f7f9fb] placeholder:text-gray-400 focus:outline-none focus:border-[#630ed4]/30 focus:ring-1 focus:ring-[#630ed4]/20"
                />
              </div>

              {/* Table header */}
              <div className="grid grid-cols-12 gap-2 text-[11px] text-gray-400 font-mono tracking-wider uppercase px-3 pb-2 border-b border-gray-100">
                <div className="col-span-4">GEO</div>
                <div className="col-span-3">TYPE</div>
                <div className="col-span-5 text-right">PAYOUT</div>
              </div>

              {/* Base rate row */}
              <div className="grid grid-cols-12 gap-2 items-center px-3 py-2.5 bg-[#f7f9fb] border-b border-gray-50">
                <div className="col-span-4 flex items-center gap-2">
                  <span className="w-5 h-3.5 rounded-sm bg-gray-200 flex items-center justify-center text-[8px] text-gray-500">🌍</span>
                  <span className="text-sm font-medium text-gray-700">All other GEOs</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-semibold">BASE</span>
                </div>
                <div className="col-span-3"><span className="text-xs text-gray-500">CPA</span></div>
                <div className="col-span-5 text-right"><span className="text-sm font-bold text-gray-900">{cs}{offer.payout.toFixed(2)}</span></div>
              </div>

              {/* Country rows */}
              <div className="max-h-[280px] overflow-y-auto">
                {offer.geo_payouts!
                  .filter(gp => !geoSearch || gp.country.includes(geoSearch))
                  .sort((a, b) => b.payout - a.payout)
                  .map((gp, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center px-3 py-2.5 border-b border-gray-50 hover:bg-[#f7f9fb] transition-colors">
                      <div className="col-span-4 flex items-center gap-2">
                        <img src={`https://flagcdn.com/20x15/${gp.country.toLowerCase()}.png`} alt={gp.country} className="w-5 h-3.5 rounded-sm object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        <span className="text-sm font-medium text-gray-900">{gp.country}</span>
                      </div>
                      <div className="col-span-3"><span className="text-xs text-gray-500">{gp.type}</span></div>
                      <div className="col-span-5 text-right"><span className="text-sm font-bold text-[#630ed4]">{cs}{gp.payout.toFixed(2)}</span></div>
                    </div>
                  ))}
              </div>
            </ExpandableCard>
          )}
        </div>

        {/* ===== RIGHT COLUMN ===== */}
        <div className="space-y-5">

          {/* Quick Facts */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:border-[#630ed4]/20 transition-colors">
            <div className="px-5 py-4 border-b border-gray-100 bg-[#f7f9fb] flex justify-between items-center">
              <h2 className="text-base font-semibold text-gray-900" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>Quick Facts</h2>
              <Info className="h-4 w-4 text-[#630ed4]/40" />
            </div>
            <div className="px-5 divide-y divide-gray-50">
              {[
                { label: 'Offer ID', value: offer.offer_id },
                { label: 'Offer Type', value: (offer as any).offer_type || 'CPA' },
                { label: 'Vertical', value: offer.vertical || 'N/A' },
                { label: 'Currency', value: offer.currency || 'USD' },
                { label: 'Payout Type', value: ((offer as any).payout_type || 'fixed').charAt(0).toUpperCase() + ((offer as any).payout_type || 'fixed').slice(1) },
                { label: 'Incentive', value: (offer as any).incentive_type || 'Incent' },
                { label: 'Daily Cap', value: (offer as any).daily_cap ? (offer as any).daily_cap.toLocaleString() : 'Unlimited' },
                { label: 'Weekly Cap', value: (offer as any).weekly_cap ? (offer as any).weekly_cap.toLocaleString() : 'Unlimited' },
                { label: 'Monthly Cap', value: (offer as any).monthly_cap ? (offer as any).monthly_cap.toLocaleString() : 'Unlimited' },
                { label: 'Cookie Window', value: (offer as any).conversion_window ? `${(offer as any).conversion_window} Days` : 'N/A' },
                { label: 'Approval', value: offer.approval_type === 'auto_approve' ? 'Instant' : offer.approval_type === 'time_based' ? 'Time-Based' : 'Manual' },
                { label: 'Devices', value: (() => {
                  const target = offer.device_targeting || 'All';
                  if (Array.isArray(target)) {
                    return target.map((d: string) => d.charAt(0).toUpperCase() + d.slice(1)).join(', ');
                  }
                  const targetStr = String(target);
                  return targetStr.charAt(0).toUpperCase() + targetStr.slice(1);
                })() },
                { label: 'Expires', value: (offer as any).expiration_date ? new Date((offer as any).expiration_date).toLocaleDateString() : 'No expiry' },
              ].map((fact, i) => (
                <div key={i} className="py-3 flex justify-between items-center group">
                  <span className="text-gray-400 text-sm group-hover:text-[#630ed4] transition-colors">{fact.label}</span>
                  <span className="text-sm font-semibold text-gray-900">{fact.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Landing Page Preview */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:border-[#630ed4]/20 transition-all group">
            <div className="aspect-video bg-[#f7f9fb] relative overflow-hidden">
              <img src={getOfferImage(offer as any)} alt={offer.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-[#630ed4]/20 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <button onClick={() => window.open(offer.preview_url || '#', '_blank')} className="bg-white text-[#630ed4] p-3 rounded-full shadow-2xl scale-90 group-hover:scale-100 transition-transform">
                    <Eye className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-semibold text-gray-900 mb-1" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>Landing Page Preview</h3>
                <p className="text-gray-500 text-sm mb-4">Click to preview the offer's landing page experience.</p>
                <a onClick={() => window.open(offer.preview_url || '#', '_blank')} className="block text-center border-2 border-[#630ed4] text-[#630ed4] py-2.5 rounded-lg font-bold hover:bg-[#630ed4] hover:text-white transition-all duration-300 cursor-pointer">
                  Preview Landing Page
                </a>
              </div>
            </div>

          {/* Access Status Card */}
          <div className={`rounded-xl p-5 shadow-sm relative overflow-hidden ${hasAccess ? 'bg-gradient-to-br from-[#7c3aed] to-[#4b41e1]' : 'bg-white border border-amber-200'}`}>
            {hasAccess && <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />}
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                {hasAccess ? <CheckCircle className="h-5 w-5 text-emerald-300" /> : <Lock className="h-5 w-5 text-amber-600" />}
                <h3 className={`font-semibold ${hasAccess ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
                  {hasAccess ? 'Access Granted' : 'Access Required'}
                </h3>
              </div>
              <p className={`text-sm ${hasAccess ? 'text-white/70' : 'text-gray-500'}`}>
                {hasAccess ? 'You have full access. Use the tracking link above to start driving traffic.' : offer.access_reason || 'Apply to get access to this offer.'}
              </p>
              {!hasAccess && (
                <Button
                  size="sm"
                  onClick={handleApply}
                  disabled={applyLoading || offer.request_status === 'pending'}
                  className="mt-3 bg-[#630ed4] hover:bg-[#5a00c6] text-white w-full font-bold shadow-md shadow-[#630ed4]/20 disabled:opacity-60"
                >
                  {applyLoading ? (
                    <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" /> Applying...</>
                  ) : offer.request_status === 'pending' ? (
                    <><Clock className="h-3.5 w-3.5 mr-1" /> Request Pending</>
                  ) : (
                    <><Zap className="h-3.5 w-3.5 mr-1" /> Apply Now</>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== Expandable Card Component ===== */
function ExpandableCard({ icon, iconBg, title, badge, expanded, onToggle, children }: {
  icon: React.ReactNode; iconBg: string; title: string; badge?: string;
  expanded: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:border-[#630ed4]/20 transition-colors">
      <button onClick={onToggle} className="w-full px-5 py-4 flex items-center justify-between text-left focus:outline-none group">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center transition-colors group-hover:scale-105 transition-transform`}>{icon}</div>
          <h2 className="text-base font-semibold text-gray-900" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>{title}</h2>
          {badge && <span className="text-[11px] font-mono bg-[#eaddff] text-[#630ed4] px-2 py-0.5 rounded-full tracking-wider">{badge}</span>}
        </div>
        <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
      </button>
      <div className={`transition-all duration-400 ease-in-out overflow-hidden ${expanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-5 pb-5 pt-0 border-t border-gray-100">
          <div className="pt-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
