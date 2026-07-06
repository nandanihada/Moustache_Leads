import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, ChevronLeft, ChevronRight, Timer, Sparkles, Award, LayoutGrid, List, QrCode, Headphones, Activity, Clock, CheckCircle, AlertCircle, ChevronDown, Mail, ExternalLink, Users, Smartphone, Monitor, Globe } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { OfferModal } from './OfferModal';
import SurveyTemplateRenderer, { TemplateName } from './survey-templates/SurveyTemplateRenderer';
import { getOfferImage } from '@/utils/categoryImages';
import OfferwallPreloader from '@/components/ui/offerwall-preloader';

// ===================== TYPES =====================
interface Offer {
  id: string; title: string; description: string; reward_amount: number; reward_currency: string;
  category: string; categories?: string[]; difficulty: string; estimated_time: string;
  image_url: string; click_url: string; requirements: string[]; conversion_rate: number;
  countries?: string[]; devices?: string[]; device_targeting?: string; payout?: number;
  payout_type?: string; star_rating?: number; status?: string; timer_enabled?: boolean;
  target_url?: string;
  timer_end_date?: string; urgency?: { type: string; message: string; }; urgency_type?: string;
  is_locked?: boolean; has_access?: boolean; requires_approval?: boolean;
  click_count?: number;
  pick_count?: number;
  is_boosted?: boolean;
  boost_percentage?: number;
  boost_direction?: string;
  boost_expires_at?: string;
  refined_description?: {
    refined_name?: string;
    event_flow?: string;
    summary?: string;
    steps?: string[];
    payout_levels?: Array<{ event: string; payout: string }>;
    traffic_sources?: { allowed?: string[]; restricted?: string[] };
    restrictions?: string[];
    difficulty?: string;
    estimated_time?: string;
    allowed_countries?: string[];
    restricted_areas?: string[];
    cities?: string[];
    approval_period?: string;
    deposit_requirement?: string;
  };
  tracking_params: { placement_id: string; user_id: string; timestamp: string; };
}

interface ActivityItem {
  offer_name: string;
  status: 'clicked' | 'pending' | 'completed' | string;
  reward: number;
  timestamp: string;
}

// ===================== CONSTANTS =====================
const CATEGORIES = [
  { id: 'all', name: 'All' },
  { id: 'BOOSTED', name: '🔥 Boosted' },
  { id: 'SWEEPSTAKES', name: 'Sweepstakes' },
  { id: 'SURVEY', name: 'Surveys' },
  { id: 'FREE_TRIAL', name: 'Free Trials' },
  { id: 'INSTALLS', name: 'Installs' },
  { id: 'GAMES_INSTALL', name: 'Games' },
];
const SORT_OPTIONS = [
  { id: 'trending', name: 'Trending' }, { id: 'points_high', name: 'Highest' },
  { id: 'points_low', name: 'Lowest' }, { id: 'newest', name: 'Newest' }, { id: 'rating', name: 'Top Rated' },
];
const DEVICE_OPTIONS = [
  { id: 'all', name: 'All Devices' }, { id: 'android', name: 'Android' },
  { id: 'ios', name: 'iOS' }, { id: 'desktop', name: 'Desktop' },
];
const PAYOUT_TYPE_OPTIONS = [
  { id: 'all', name: 'All Types' }, { id: 'cpa', name: 'CPA' }, { id: 'cpi', name: 'CPI' },
  { id: 'cpl', name: 'CPL' }, { id: 'cps', name: 'CPS' }, { id: 'revshare', name: 'RevShare' },
];
const PAGE_SIZE = 20;

// Comprehensive country code list for extraction
const ALL_COUNTRY_CODES = new Set([
  'US','GB','UK','CA','AU','DE','FR','IT','ES','BR','IN','JP','KR','CN','NL','BE','AT','CH',
  'SE','NO','DK','FI','PL','PT','IE','NZ','MX','AR','CL','CO','TW','SG','MY','TH','PH','ID',
  'ZA','AE','SA','IL','TR','RU','GR','CZ','HU','RO','UA','VN','PK','BD','EG','NG','KE','PE',
  'VE','EC','CR','PA','PR','DO','HK','MO','LK','NP','MM','KH','RS','SK','BG','HR','SI','LT',
  'LV','EE','IS','LU','MT','CY','AL','MK','BA','ME','MD','AM','GE','AZ','KZ','UZ','BY','LI',
  'MC','AD','SM','VA','JP','KR','TW','VN','TH','MY','SG','PH','ID','MM','KH','LA','MN'
]);

const FLAG_MAP: Record<string, string> = {
  'US':'🇺🇸','UK':'🇬🇧','GB':'🇬🇧','CA':'🇨🇦','AU':'🇦🇺','DE':'🇩🇪','FR':'🇫🇷','IT':'🇮🇹',
  'ES':'🇪🇸','BR':'🇧🇷','IN':'🇮🇳','JP':'🇯🇵','KR':'🇰🇷','CN':'🇨🇳','NL':'🇳🇱','BE':'🇧🇪',
  'AT':'🇦🇹','CH':'🇨🇭','SE':'🇸🇪','NO':'🇳🇴','DK':'🇩🇰','FI':'🇫🇮','PL':'🇵🇱','PT':'🇵🇹',
  'IE':'🇮🇪','NZ':'🇳🇿','MX':'🇲🇽','AR':'🇦🇷','CL':'🇨🇱','CO':'🇨🇴','TW':'🇹🇼','SG':'🇸🇬',
  'MY':'🇲🇾','TH':'🇹🇭','PH':'🇵🇭','ID':'🇮🇩','ZA':'🇿🇦','AE':'🇦🇪','SA':'🇸🇦','IL':'🇮🇱',
  'TR':'🇹🇷','RU':'🇷🇺','GR':'🇬🇷','CZ':'🇨🇿','HU':'🇭🇺','RO':'🇷🇴','UA':'🇺🇦','VN':'🇻🇳',
};

// ===================== HELPERS =====================
const cleanTitle = (title: string): string => {
  let c = title;
  ALL_COUNTRY_CODES.forEach(code => { c = c.replace(new RegExp(`\\b${code}\\b[,\\s]*`, 'gi'), ''); });
  c = c.replace(/[\s,\-]+([A-Z]{2}[\s,]*)+$/i, '');
  return c.replace(/[\s,\-]+$/, '').replace(/\s+/g, ' ').trim();
};

const truncTitle = (title: string, max = 6): string => {
  const w = cleanTitle(title).split(' ');
  return w.length <= max ? cleanTitle(title) : w.slice(0, max).join(' ') + '…';
};

const getCatName = (cat: string) => CATEGORIES.find(c => c.id === cat?.toUpperCase())?.name || cat || 'Other';

// Device targeting display helpers
const getDeviceLabel = (offer: Offer): string => {
  const d = (offer.device_targeting || offer.devices?.join(',') || '').toLowerCase();
  if (d.includes('android') && d.includes('ios')) return 'Android & iOS';
  if (d.includes('android')) return 'Android';
  if (d.includes('ios') || d.includes('iphone')) return 'iOS';
  if (d.includes('web') || d.includes('desktop')) return 'Desktop';
  if (d.length > 0) return offer.device_targeting || '';
  return 'All Devices';
};
const getDeviceIcon = (offer: Offer) => {
  const d = (offer.device_targeting || offer.devices?.join(',') || '').toLowerCase();
  if (d.includes('android')) return <Smartphone className="h-3 w-3 text-green-600" />;
  if (d.includes('ios') || d.includes('iphone')) return <Smartphone className="h-3 w-3 text-gray-700" />;
  if (d.includes('web') || d.includes('desktop')) return <Monitor className="h-3 w-3" />;
  return <Globe className="h-3 w-3" />;
};

/**
 * Extract country codes from offer data — checks:
 * 1. offer.countries array (most reliable)
 * 2. offer.countries as WW/GLOBAL → global
 * 3. Description field
 * 4. Title field
 * Returns empty array = global (show to everyone)
 */
const extractOfferCountries = (offer: Offer): string[] => {
  // Direct countries array
  if (offer.countries && offer.countries.length > 0) {
    const normalized = offer.countries
      .map(c => c.toUpperCase().trim())
      .filter(c => c !== 'WW' && c !== 'GLOBAL' && c !== 'ALL' && ALL_COUNTRY_CODES.has(c));
    if (normalized.length > 0) return normalized;
    // WW/GLOBAL means show everywhere
    if (offer.countries.some(c => ['WW','GLOBAL','ALL','WORLDWIDE'].includes(c.toUpperCase()))) return [];
    return [];
  }
  
  // Extract from title + description
  const text = `${offer.title || ''} ${offer.description || ''}`.toUpperCase();
  const parts = text.split(/[\s,\-–—\/\(\)]+/);
  const found: string[] = [];
  for (const part of parts) {
    const p = part.trim();
    if (p.length === 2 && ALL_COUNTRY_CODES.has(p) && !found.includes(p)) found.push(p);
  }
  return found;
};

/**
 * Check if an offer is available for a given user country
 * Returns true if: no countries listed (global), or user country is in the list
 */
const isOfferAvailableForCountry = (offer: Offer, userCountry: string): boolean => {
  if (!userCountry || userCountry === 'UNKNOWN') return true; // can't detect → show all
  const offerCountries = extractOfferCountries(offer);
  if (offerCountries.length === 0) return true; // global offer
  return offerCountries.includes(userCountry.toUpperCase());
};

// Countdown Timer
const CountdownTimer: React.FC<{ endDate: string }> = ({ endDate }) => {
  const [t, setT] = useState({ h: 0, m: 0, s: 0 });
  const [exp, setExp] = useState(false);
  useEffect(() => {
    const calc = () => { const d = new Date(endDate).getTime() - Date.now(); if (d <= 0) { setExp(true); return; } setT({ h: Math.floor(d/3600000), m: Math.floor((d%3600000)/60000), s: Math.floor((d%60000)/1000) }); };
    calc(); const iv = setInterval(calc, 1000); return () => clearInterval(iv);
  }, [endDate]);
  if (exp) return null;
  return <span className="ow-badge-timer"><Timer className="h-3 w-3" />{String(t.h).padStart(2,'0')}:{String(t.m).padStart(2,'0')}:{String(t.s).padStart(2,'0')}</span>;
};

// Boost Countdown Timer (shows remaining time for price boost)
const BoostCountdown: React.FC<{ endDate: string }> = ({ endDate }) => {
  const [t, setT] = useState({ h: 0, m: 0, s: 0 });
  const [exp, setExp] = useState(false);
  useEffect(() => {
    const calc = () => { const d = new Date(endDate).getTime() - Date.now(); if (d <= 0) { setExp(true); return; } setT({ h: Math.floor(d/3600000), m: Math.floor((d%3600000)/60000), s: Math.floor((d%60000)/1000) }); };
    calc(); const iv = setInterval(calc, 1000); return () => clearInterval(iv);
  }, [endDate]);
  if (exp) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500 text-white shadow-sm">
      🔥 {String(t.h).padStart(2,'0')}:{String(t.m).padStart(2,'0')}:{String(t.s).padStart(2,'0')}
    </span>
  );
};

// Skeleton card for loading effect
const SkeletonCard: React.FC = () => (
  <div className="ow-card animate-pulse">
    <div className="h-44 bg-gray-200 rounded-t-2xl"></div>
    <div className="p-4">
      <div className="h-2.5 bg-gray-200 rounded w-1/4 mb-3"></div>
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
      <div className="h-3 bg-gray-200 rounded w-full mb-1"></div>
      <div className="h-3 bg-gray-200 rounded w-2/3 mb-4"></div>
      <div className="h-10 bg-gray-200 rounded-xl"></div>
    </div>
  </div>
);

// QR Modal
const QRModal: React.FC<{ url: string; title: string; onClose: () => void }> = ({ url, title, onClose }) => (
  <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
    <div className="bg-white rounded-2xl p-6 max-w-xs w-full text-center shadow-2xl" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900 text-base">Scan to Open</h3>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"><X className="w-4 h-4" /></button>
      </div>
      <div className="bg-gray-50 rounded-xl p-4 mb-4 flex items-center justify-center">
        <QRCodeSVG value={url} size={180} fgColor="#340075" bgColor="transparent" />
      </div>
      <p className="text-xs text-gray-500 mb-1">Scan with your phone camera</p>
      <p className="text-sm font-semibold text-[#340075] truncate">{title}</p>
    </div>
  </div>
);

// Support Modal
const SupportModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
    <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-bold text-gray-900 text-lg">Support</h3>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"><X className="w-4 h-4" /></button>
      </div>
      <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Headphones className="h-7 w-7 text-[#340075]" />
      </div>
      <p className="text-center text-gray-600 text-sm mb-5">Have an issue? Reach out to our support team and we'll get back to you as soon as possible.</p>
      <a
        href="mailto:business@moustacheleads.com"
        className="flex items-center justify-center gap-2 w-full bg-[#340075] hover:bg-[#4c1d95] text-white font-semibold py-3 px-6 rounded-xl transition-all"
      >
        <Mail className="w-4 h-4" />
        business@moustacheleads.com
        <ExternalLink className="w-3.5 h-3.5 opacity-60" />
      </a>
      <p className="text-center text-xs text-gray-400 mt-3">We typically respond within 24 hours</p>
    </div>
  </div>
);

// Tracking Panel — large right-side drawer
const TrackingPanel: React.FC<{ items: ActivityItem[]; loading: boolean; onClose: () => void; currency: string }> = ({ items, loading, onClose, currency }) => {
  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending': return <Clock className="h-4 w-4 text-amber-500" />;
      case 'clicked': return <Activity className="h-4 w-4 text-blue-500" />;
      case 'picked': return <Users className="h-4 w-4 text-purple-500" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': return 'text-green-700 bg-green-50 border border-green-200';
      case 'pending': return 'text-amber-700 bg-amber-50 border border-amber-200';
      case 'clicked': return 'text-blue-700 bg-blue-50 border border-blue-200';
      case 'picked': return 'text-purple-700 bg-purple-50 border border-purple-200';
      default: return 'text-gray-600 bg-gray-50 border border-gray-200';
    }
  };
  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' }) +
        ' · ' + d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) + ' IST';
    } catch { return ts; }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Backdrop — click to close */}
      <div className="flex-1 bg-black/40 cursor-pointer" onClick={onClose}></div>
      {/* Drawer panel */}
      <div className="bg-white w-full max-w-[600px] h-full flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-[#340075]/5 to-transparent flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#340075] rounded-xl flex items-center justify-center shadow-sm">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-lg leading-tight">Recent Activity</h3>
              <p className="text-xs text-gray-400 mt-0.5">{items.length > 0 ? `${items.length} record${items.length === 1 ? '' : 's'}` : 'Your offer history'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary stats */}
        {!loading && items.length > 0 && (
          <div className="px-6 py-3 bg-purple-50 border-b border-purple-100 flex items-center gap-4 flex-shrink-0 overflow-x-auto">
            {[
              { label: 'Picked', color: 'text-purple-700 bg-purple-100', count: items.filter(i => i.status?.toLowerCase() === 'picked').length },
              { label: 'Clicked', color: 'text-blue-700 bg-blue-100', count: items.filter(i => i.status?.toLowerCase() === 'clicked').length },
              { label: 'Pending', color: 'text-amber-700 bg-amber-100', count: items.filter(i => i.status?.toLowerCase() === 'pending').length },
              { label: 'Completed', color: 'text-green-700 bg-green-100', count: items.filter(i => i.status?.toLowerCase() === 'completed').length },
            ].map(s => s.count > 0 && (
              <div key={s.label} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${s.color}`}>
                <span>{s.count}</span><span>{s.label}</span>
              </div>
            ))}
            <p className="text-xs text-gray-400 ml-auto">Showing last {items.length} records</p>
          </div>
        )}

        {/* Column headers */}
        {!loading && items.length > 0 && (
          <div className="grid grid-cols-[1fr_80px_64px_100px] gap-2 px-6 py-2.5 bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest flex-shrink-0">
            <span>Offer</span>
            <span className="text-center">Status</span>
            <span className="text-right">Reward</span>
            <span className="text-right">Time</span>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="w-8 h-8 border-3 border-gray-200 border-t-[#340075] rounded-full animate-spin" style={{ borderWidth: 3 }}></div>
              <p className="text-gray-400 text-sm">Loading activity…</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 px-8 text-center">
              <div className="w-20 h-20 bg-purple-50 rounded-2xl flex items-center justify-center mb-5">
                <Activity className="h-10 w-10 text-[#340075]/30" />
              </div>
              <p className="text-gray-800 font-bold text-base mb-2">No activity yet</p>
              <p className="text-gray-400 text-sm leading-relaxed">Click "Start Offer" on any offer to begin earning. Your clicks and completions will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-[1fr_80px_64px_100px] gap-2 items-center px-6 py-4 hover:bg-purple-50/30 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {getStatusIcon(item.status)}
                    <p className="text-sm font-medium text-gray-900 truncate">{item.offer_name || 'Unknown Offer'}</p>
                  </div>
                  <div className="text-center">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${getStatusColor(item.status)}`}>{item.status || 'unknown'}</span>
                  </div>
                  <div className="text-right">
                    {item.reward > 0 ? (
                      <span className="text-sm font-bold text-[#340075]">+{item.reward}</span>
                    ) : <span className="text-xs text-gray-300">—</span>}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400 leading-tight">{formatTime(item.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-6 py-4 bg-gray-50 flex-shrink-0">
          <p className="text-xs text-gray-400 text-center">Rewards are credited within 24–48 hours of offer completion.</p>
        </div>
      </div>
    </div>
  );
};

// ===================== MAIN COMPONENT =====================
interface Props { placementId: string; userId: string; subId?: string; country?: string; baseUrl?: string; apiKey?: string; }

export const OfferwallProfessional: React.FC<Props> = ({
  placementId, userId, subId, country, apiKey,
  baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
}) => {
  const [allOffers, setAllOffers] = useState<Offer[]>([]);
  const [filteredOffers, setFilteredOffers] = useState<Offer[]>([]);
  const [visibleOffers, setVisibleOffers] = useState<Offer[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [device, setDevice] = useState('all');
  const [payoutType, setPayoutType] = useState('all');
  const [sort, setSort] = useState('trending');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [selOffer, setSelOffer] = useState<Offer | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [currency, setCurrency] = useState('LEaDS');
  // Track which offers have been clicked/started locally for immediate UI feedback
  const [offerStatuses, setOfferStatuses] = useState<Record<string, 'clicked' | 'pending'>>(() => {
    try { return JSON.parse(localStorage.getItem(`ow_statuses_${userId}_${placementId}`) || '{}'); } catch { return {}; }
  });
  // Store reward_amount per offer for activity display
  const [offerRewards, setOfferRewards] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem(`ow_rewards_${userId}_${placementId}`) || '{}'); } catch { return {}; }
  });
  const [qrOffer, setQrOffer] = useState<Offer | null>(null);
  const [showSupport, setShowSupport] = useState(false);
  const [showTracking, setShowTracking] = useState(false);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [userCountry, setUserCountry] = useState<string>(country || '');
  const [showPreloader, setShowPreloader] = useState(true);
  // Featured offers + Telegram button
  const [featuredOfferIds, setFeaturedOfferIds] = useState<string[]>([]);
  const [showTelegramBtn, setShowTelegramBtn] = useState(true);
  const featuredScrollRef = useRef<HTMLDivElement>(null);
  const [featuredCanScrollLeft, setFeaturedCanScrollLeft] = useState(false);
  const [featuredCanScrollRight, setFeaturedCanScrollRight] = useState(false);

  const updateFeaturedScrollButtons = useCallback(() => {
    const el = featuredScrollRef.current;
    if (!el) return;
    setFeaturedCanScrollLeft(el.scrollLeft > 0);
    setFeaturedCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  const scrollFeatured = (direction: 'left' | 'right') => {
    const el = featuredScrollRef.current;
    if (!el) return;
    const scrollAmount = 320;
    el.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    setTimeout(updateFeaturedScrollButtons, 350);
  };

  useEffect(() => {
    // Initialize scroll button states once featured offers render
    setTimeout(updateFeaturedScrollButtons, 500);
  }, [featuredOfferIds, updateFeaturedScrollButtons]);

  // Survey Funnel State
  const [funnel, setFunnel] = useState<any>(null);
  const [funnelSess, setFunnelSess] = useState('');
  const [funnelStep, setFunnelStep] = useState(0);
  const [funnelSurvey, setFunnelSurvey] = useState<any>(null);
  const [funnelAns, setFunnelAns] = useState<Record<number, string | string[]>>({});
  const [funnelResult, setFunnelResult] = useState<any>(null);
  const [funnelSubmitting, setFunnelSubmitting] = useState(false);
  const [funnelTpl, setFunnelTpl] = useState<TemplateName>('modern-card');
  const [displaySettings, setDisplaySettings] = useState({ primary_color:'#340075', layout:'grid', cards_per_row:3, show_categories:true, show_search:true });
  const [announcements, setAnnouncements] = useState<Array<{text:string;id:string}>>([]);
  const [subWalls, setSubWalls] = useState<any[]>([]);
  const [isQualified, setIsQualified] = useState<boolean | null>(null);
  const [qualSurvey, setQualSurvey] = useState<any>(null);
  const [showQual, setShowQual] = useState(false);
  const [qualAnswers, setQualAnswers] = useState<Record<string, any>>({});
  const [newUserIds, setNewUserIds] = useState<string[]>([]);

  // ==================== COUNTRY DETECTION ====================
  useEffect(() => {
    if (country) { setUserCountry(country.toUpperCase()); return; }
    // Try URL param first
    const urlCountry = new URLSearchParams(window.location.search).get('country');
    if (urlCountry) { setUserCountry(urlCountry.toUpperCase()); return; }
    // Detect via IP geolocation
    detectUserCountry();
  }, [country]);

  const detectUserCountry = async () => {
    try {
      // Try multiple geolocation services for reliability
      const sources = [
        `${baseUrl}/api/geo/detect`,
        'https://ipapi.co/json/',
        'https://ip-api.com/json/?fields=countryCode',
      ];
      for (const url of sources) {
        try {
          const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
          if (r.ok) {
            const d = await r.json();
            const code = d.country_code || d.countryCode || d.country || '';
            if (code && code.length === 2 && ALL_COUNTRY_CODES.has(code.toUpperCase())) {
              setUserCountry(code.toUpperCase());
              return;
            }
          }
        } catch { continue; }
      }
    } catch { /* keep empty = show all */ }
  };

  useEffect(() => { trackImpression(); loadOffers(); loadSettings(); loadSubWalls(); if (apiKey === 'iK66hQRakcvRVj08CX7qfqNzE1Zqt0uF') { setIsQualified(true); } else { checkQual(); } }, [placementId, userId]);
  
  // Reload offers when country is detected (after initial load)
  useEffect(() => {
    if (userCountry) {
      loadOffers();
    }
  }, [userCountry]);

  // Reapply filters when other filter params change
  useEffect(() => { applyFilters(); }, [allOffers, search, category, device, payoutType, sort, isQualified, newUserIds, userCountry]);
  
  // Update visible offers when page changes
  useEffect(() => { setVisibleOffers(filteredOffers.slice(0, page * PAGE_SIZE)); }, [filteredOffers, page]);

  // ==================== BACKEND LOGIC ====================
  const checkQual = async () => {
    try {
      const r = await fetch(`${baseUrl}/api/admin/surveys/qualification/check?user_id=${encodeURIComponent(userId)}`);
      if (r.ok) {
        const d = await r.json();
        if (d.qualified) { setIsQualified(true); localStorage.setItem(`offerwall_qualified_${userId}`, 'true'); }
        else {
          setIsQualified(false); localStorage.removeItem(`offerwall_qualified_${userId}`);
          try { const sr = await fetch(`${baseUrl}/api/admin/surveys/qualification`); if (sr.ok) { const sd = await sr.json(); if (sd.survey) setQualSurvey(sd.survey); } } catch {}
          try { const or = await fetch(`${baseUrl}/api/admin/offerwall-management/new-user-offers`); if (or.ok) { const od = await or.json(); setNewUserIds(od.offer_ids || od.new_user_offer_ids || []); } } catch {}
        }
      } else setIsQualified(localStorage.getItem(`offerwall_qualified_${userId}`) === 'true');
    } catch { setIsQualified(localStorage.getItem(`offerwall_qualified_${userId}`) === 'true'); }
  };

  const handleQualSubmit = async () => {
    if (!qualSurvey) return;
    try {
      const ans = Object.entries(qualAnswers).map(([qid, a]) => ({ question_id: qid, answer: a }));
      const r = await fetch(`${baseUrl}/api/admin/surveys/public/${qualSurvey._id}/submit`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ user_id:userId, answers:ans, time_spent_seconds:0 }) });
      if (r.ok) { localStorage.setItem(`offerwall_qualified_${userId}`, 'true'); setIsQualified(true); setShowQual(false); setQualAnswers({}); loadOffers(); }
    } catch {}
  };

  const trackImpression = async () => {
    try {
      const sk = `offerwall_session_${placementId}_${userId}`; let sid = sessionStorage.getItem(sk);
      if (!sid) {
        // Create a backend session first
        sid = `s_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;
        try {
          const sessionRes = await fetch(`${baseUrl}/api/offerwall/session/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              placement_id: placementId,
              user_id: userId,
              sub_id: subId || undefined,
              device_info: {
                device_type: /mobile|android|iphone|ipad/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
                browser: navigator.userAgent,
                os: navigator.platform
              },
              geo_info: {}
            })
          });
          if (sessionRes.ok) {
            const sessionData = await sessionRes.json();
            if (sessionData.session_id) sid = sessionData.session_id;
          }
        } catch {}
        sessionStorage.setItem(sk, sid);
      }
      await fetch(`${baseUrl}/api/offerwall/track/impression`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ session_id:sid, placement_id:placementId, user_id:userId, user_agent:navigator.userAgent, referrer:document.referrer }) });
    } catch {}
  };

  const loadOffers = async () => {
    try {
      setLoading(true); setError(null);
      const isAdmin = apiKey === 'iK66hQRakcvRVj08CX7qfqNzE1Zqt0uF';
      const fetchLimit = isAdmin ? 10000 : 500;
      const cacheBust = Date.now();
      const r = await fetch(`${baseUrl}/api/offerwall/offers?placement_id=${placementId}&user_id=${userId}&limit=${fetchLimit}${userCountry ? `&country=${encodeURIComponent(userCountry)}` : ''}${apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : ''}&_t=${cacheBust}`);
      if (!r.ok) throw new Error('Failed'); const d = await r.json(); if (d.error) throw new Error(d.error);
      setCurrency(d.currency_name || 'LEaDS');
      if (d.featured_offer_ids) setFeaturedOfferIds(d.featured_offer_ids);
      let funnels: any[] = [];
      try { const fr = await fetch(`${baseUrl}/api/survey-funnel/active?placement=offerwall`); if (fr.ok) funnels = (await fr.json()).funnels || []; } catch {}
      setAllOffers([...funnels, ...(d.offers || [])]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); } finally { setLoading(false); }
  };

  const loadSettings = async () => {
    try { const r = await fetch(`${baseUrl}/api/admin/offerwall-management/display-settings`); if (r.ok) { const d = await r.json(); if (d.theme) setDisplaySettings(p => ({ ...p, ...d.theme })); if (d.announcements) setAnnouncements(d.announcements); } } catch {}
  };
  const loadSubWalls = async () => {
    try { const r = await fetch(`${baseUrl}/api/admin/sub-walls/public/list?user_id=${encodeURIComponent(userId)}&placement_id=${encodeURIComponent(placementId)}`); if (r.ok) { const d = await r.json(); if (d.sub_walls) setSubWalls(d.sub_walls); } } catch {}
  };

  const loadActivity = async () => {
    setActivityLoading(true);
    try {
      const r = await fetch(`${baseUrl}/api/offerwall/user/recent-activity?user_id=${encodeURIComponent(userId)}&placement_id=${encodeURIComponent(placementId)}&limit=50`);
      if (r.ok) {
        const d = await r.json();
        const rawItems: ActivityItem[] = d.activities || [];
        // Enrich reward: use backend value if > 0, else use locally stored reward
        const enriched = rawItems.map(item => ({
          ...item,
          reward: item.reward > 0 ? item.reward : (offerRewards[(item as any).offer_id] || 0)
        }));
        setActivityItems(enriched);
      }
    } catch {} finally { setActivityLoading(false); }
  };

  const applyFilters = () => {
    let f = [...allOffers];
    
    // ADMIN MODE: only the specific admin API key bypasses filters (not publisher placement keys)
    const ADMIN_API_KEY = 'iK66hQRakcvRVj08CX7qfqNzE1Zqt0uF';
    const isAdminMode = apiKey === ADMIN_API_KEY;
    
    if (!isAdminMode) {
      if (isQualified === null) { setFilteredOffers([]); return; }
      if (!isQualified) {
        if (newUserIds.length > 0) f = f.filter(o => newUserIds.includes(o.id) || newUserIds.includes((o as any).offer_id) || newUserIds.includes((o as any)._id));
        else f = [];
      }

      // ===== COUNTRY FILTERING =====
      // Only show offers available in user's country
      if (userCountry && userCountry !== 'UNKNOWN') {
        f = f.filter(o => isOfferAvailableForCountry(o, userCountry));
      }
    }

    const catMap: Record<string, string[]> = {
      'HEALTH':['HEALTH','HEALTHCARE','MEDICAL'],'SURVEY':['SURVEY','SURVEYS','QUESTIONNAIRE'],
      'SWEEPSTAKES':['SWEEPSTAKES','SWEEPS','GIVEAWAY','PRIZE','LOTTERY','RAFFLE','CONTEST','SWEEPSTAKE','SWEEPSJUNGLE','CROWN','PULSZ','SPINFEVER','WAGER','CASINO','SLOTS','SWEEPTAKE'],
      'EDUCATION':['EDUCATION','LEARNING'],'INSURANCE':['INSURANCE'],'LOAN':['LOAN','LOANS','LENDING'],
      'FINANCE':['FINANCE','FINANCIAL'],'DATING':['DATING','RELATIONSHIPS'],
      'FREE_TRIAL':['FREE_TRIAL','FREETRIAL','TRIAL','FREE TRIAL'],
      'INSTALLS':['INSTALLS','INSTALL','APP','APPS'],
      'GAMES_INSTALL':['GAMES_INSTALL','GAMESINSTALL','GAME','GAMES','GAMING'],
    };

    // Title keyword fallback map — if category doesn't match, check offer title
    const titleKeywords: Record<string, string[]> = {
      'SWEEPSTAKES': ['sweepstake', 'sweepstakes', 'casino', 'slots', 'giveaway', 'prize', 'lottery', 'raffle', 'contest', 'ftd', 'wager', 'spin'],
      'SURVEY': ['survey', 'surveys', 'questionnaire'],
      'FREE_TRIAL': ['free trial', 'free-trial', 'freetrial'],
      'INSTALLS': ['install', 'app download', 'download app'],
      'GAMES_INSTALL': ['game', 'gaming', 'games install', 'play'],
    };

    if (category === 'BOOSTED') {
      f = f.filter(o => (o as any).is_boosted === true);
    } else if (category !== 'all') {
      const catKey = category.toUpperCase();
      const m = catMap[catKey] || [catKey];
      const titleKws = titleKeywords[catKey] || [];
      f = f.filter(o => {
        // Check categories array first
        const cats = (o as any).categories;
        if (Array.isArray(cats) && cats.length) {
          if (cats.some((c: string) => m.includes(c.toUpperCase()))) return true;
        }
        // Check category field
        if (m.includes((o.category || '').toUpperCase())) return true;
        // Fallback: check offer title for keywords
        if (titleKws.length > 0) {
          const titleLower = (o.title || '').toLowerCase();
          if (titleKws.some(kw => titleLower.includes(kw))) return true;
        }
        return false;
      });
    }
    if (search) { const t = search.toLowerCase(); f = f.filter(o => o.title.toLowerCase().includes(t) || o.description.toLowerCase().includes(t)); }
    if (device !== 'all') f = f.filter(o => { const ds = (o.device_targeting || o.devices?.join(' ') || '').toLowerCase(); if (device==='android') return ds.includes('android'); if (device==='ios') return ds.includes('ios') || ds.includes('iphone'); if (device==='desktop') return ds.includes('web') || ds.includes('desktop'); return true; });
    if (payoutType !== 'all') f = f.filter(o => ((o as any).payout_type || '').toLowerCase().includes(payoutType));
    f.sort((a,b) => {
      // Position-ordered offers always come first (lower position = higher priority)
      const aPos = (a as any).offerwall_position;
      const bPos = (b as any).offerwall_position;
      const aHasPos = aPos !== undefined && aPos !== null;
      const bHasPos = bPos !== undefined && bPos !== null;
      if (aHasPos && bHasPos) return aPos - bPos;
      if (aHasPos && !bHasPos) return -1;
      if (!aHasPos && bHasPos) return 1;
      // For non-positioned offers, use the selected sort
      switch(sort) { case 'points_high': return (b.reward_amount||0)-(a.reward_amount||0); case 'points_low': return (a.reward_amount||0)-(b.reward_amount||0); case 'newest': return new Date(b.estimated_time||0).getTime()-new Date(a.estimated_time||0).getTime(); case 'rating': return (b.star_rating||5)-(a.star_rating||5); default: return (b.star_rating||5)*(b.reward_amount||1)-(a.star_rating||5)*(a.reward_amount||1); }
    });

    // ===== DEDUPLICATION =====
    // Remove duplicate offers (same offer_id appearing multiple times from backend)
    const seenIds = new Set<string>();
    f = f.filter(o => {
      const id = o.id || (o as any).offer_id;
      if (seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });

    // ===== MULTI-CATEGORY EXPANSION =====
    // If offer.category contains "/" (e.g. "CREDIT / DEBT / LOANS"), expand into
    // separate virtual rows — one per category — each with a unique id suffix
    const expanded: Offer[] = [];
    for (const offer of f) {
      const cats = (offer.category || '').split('/').map((c: string) => c.trim()).filter(Boolean);
      if (cats.length > 1) {
        cats.forEach((cat: string, idx: number) => {
          expanded.push({ ...offer, id: idx === 0 ? offer.id : `${offer.id}__cat${idx}`, category: cat });
        });
      } else {
        expanded.push(offer);
      }
    }

    setFilteredOffers(expanded);
    setPage(1); // reset pagination on filter change
  };

  const handleLoadMore = () => {
    setLoadingMore(true);
    setTimeout(() => { setPage(p => p + 1); setLoadingMore(false); }, 600);
  };

  const handleClick = (o: Offer) => {
    if ((o as any).is_funnel && (o as any).funnel_id) { startFunnel((o as any).funnel_id); return; }
    // Strip virtual category-expansion suffix to get real offer id
    const realId = o.id.replace(/__cat\d+$/, '');
    const realOffer = { ...o, id: realId };
    // Mark as "picked" when card is opened (viewed)
    if (!offerStatuses[realId]) {
      const updated = { ...offerStatuses, [realId]: 'clicked' as const };
      setOfferStatuses(updated);
      localStorage.setItem(`ow_statuses_${userId}_${placementId}`, JSON.stringify(updated));
      // Store reward for activity display
      const rewardUpdated = { ...offerRewards, [realId]: Math.round(o.reward_amount || 0) };
      setOfferRewards(rewardUpdated);
      localStorage.setItem(`ow_rewards_${userId}_${placementId}`, JSON.stringify(rewardUpdated));
    }
    // Record pick in backend (every time card is opened)
    fetch(`${baseUrl}/api/offerwall/track/pick`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placement_id: placementId, user_id: userId, offer_id: realId, offer_name: o.title, image_url: o.image_url, country: userCountry })
    }).catch(() => {});
    setSelOffer(realOffer); setModalOpen(true);
  };

  const startFunnel = async (id: string) => {
    try { const r = await fetch(`${baseUrl}/api/survey-funnel/${id}/start`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({user_id:userId}) }); if (r.ok) { const d = await r.json(); setFunnelSess(d.session_id); setFunnelStep(d.step_index); setFunnelSurvey(d.survey); setFunnel(id); setFunnelResult(null); setFunnelAns({}); setFunnelTpl((d.survey_template||'modern-card') as TemplateName); } } catch {}
  };
  const submitFunnel = async () => {
    if (!funnel || !funnelSurvey) return; setFunnelSubmitting(true);
    try { const ans = Object.entries(funnelAns).map(([i,a])=>({question_index:Number(i),answer:a})); const r = await fetch(`${baseUrl}/api/survey-funnel/${funnel}/submit`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:funnelSess,step_index:funnelStep,answers:ans})}); if (r.ok) { const d = await r.json(); if (d.result==='passed') { setFunnelResult({type:'pass',message:d.message,redirect_url:d.redirect_url}); if (d.redirect_url) setTimeout(()=>window.open(d.redirect_url,'_blank'),2000); } else { if (d.has_next&&d.next_survey) { setFunnelResult({type:'fail',message:d.message,has_next:true}); setTimeout(()=>{setFunnelStep(d.next_step_index);setFunnelSurvey(d.next_survey);setFunnelResult(null);setFunnelAns({});},2000); } else setFunnelResult({type:'fail',message:d.message,has_next:false}); } } } catch {} finally { setFunnelSubmitting(false); }
  };
  const closeFunnel = () => { setFunnel(null); setFunnelSess(''); setFunnelSurvey(null); setFunnelResult(null); setFunnelAns({}); setFunnelStep(0); };

  const hasMore = visibleOffers.length < filteredOffers.length;

  // ==================== RENDER ====================
  return (
    <div className="ow min-h-[400px] flex flex-col">
      {/* Preloader overlay */}
      {showPreloader && (
        <OfferwallPreloader dataReady={!loading} onComplete={() => setShowPreloader(false)} />
      )}

      {/* ===== PROFESSIONAL HEADER (no banner image) ===== */}
      <header className="ow-header sticky top-0 z-50">
        <div className="max-w-[1300px] mx-auto px-3 sm:px-4 md:px-6">
          {/* Top row */}
          <div className="flex items-center justify-between h-14 sm:h-16 min-w-0">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="Moustache Leads" className="h-9 w-auto" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
              <span className="font-bold text-lg text-[#340075] tracking-tight hidden sm:inline">Moustache Leads</span>
            </div>

            {/* Search */}
            <div className="flex-1 max-w-md mx-4 hidden sm:block">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input type="text" placeholder="Search offers…" value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full bg-gray-100 border border-transparent rounded-full pl-10 pr-9 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#340075]/20 focus:bg-white transition-all" />
                {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X className="w-3.5 h-3.5" /></button>}
              </div>
            </div>

            {/* Right: Support + Tracking + Currency */}
            <div className="flex items-center gap-2">
              <button onClick={() => setShowSupport(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-[#340075] hover:bg-purple-50 transition-colors border border-purple-200">
                <Headphones className="h-4 w-4" />
                <span className="hidden sm:inline">Support</span>
              </button>
              <button onClick={() => { setShowTracking(true); loadActivity(); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-[#340075] hover:bg-purple-50 transition-colors border border-purple-200">
                <Activity className="h-4 w-4" />
                <span className="hidden sm:inline">Tracking</span>
              </button>
              <div className="bg-[#340075] text-white px-3.5 py-1.5 rounded-full text-sm font-bold">
                <span>{currency}</span>
              </div>
            </div>
          </div>

          {/* Mobile search */}
          <div className="sm:hidden pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input type="text" placeholder="Search offers…" value={search} onChange={e => setSearch(e.target.value)}
                className="w-full bg-gray-100 rounded-full pl-10 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#340075]/20 focus:bg-white transition-all" />
              {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X className="w-3.5 h-3.5" /></button>}
            </div>
          </div>

          {/* Category pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-3 scrollbar-hide">
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setCategory(cat.id)}
                className={`ow-cat-btn ${category === cat.id ? 'ow-cat-btn-active' : ''}`}>
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ===== CONTROLS ===== */}
      <div className="bg-gray-50 border-b border-gray-100">
        <div className="max-w-[1300px] mx-auto px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 flex flex-wrap items-center gap-1.5 sm:gap-2">
          <div className="relative flex items-center">
            <Globe className="absolute left-2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <select value={device} onChange={e => setDevice(e.target.value)} className="ow-select ow-select-icon">{DEVICE_OPTIONS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          </div>
          <select value={payoutType} onChange={e => setPayoutType(e.target.value)} className="ow-select">{PAYOUT_TYPE_OPTIONS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <select value={sort} onChange={e => setSort(e.target.value)} className="ow-select">{SORT_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <div className="ml-auto flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={() => setViewMode('grid')} className={`p-2 ${viewMode==='grid'?'bg-[#340075] text-white':'text-gray-500 hover:text-gray-700'}`}><LayoutGrid className="w-4 h-4" /></button>
            <button onClick={() => setViewMode('table')} className={`p-2 ${viewMode==='table'?'bg-[#340075] text-white':'text-gray-500 hover:text-gray-700'}`}><List className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* ===== MAIN ===== */}
      <main className="flex-1 max-w-[1300px] mx-auto w-full px-3 sm:px-5 md:px-8 py-4 sm:py-5">
        {/* Announcements */}
        {announcements.length > 0 && <div className="mb-4">{announcements.map(a => <div key={a.id} className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-2.5 mb-2 text-[#340075] text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 flex-shrink-0" />{a.text}</div>)}</div>}

        {/* ===== FEATURED OFFERS HORIZONTAL TRAY ===== */}
        {featuredOfferIds.length > 0 && isQualified && !search && (() => {
          const featuredOffers = allOffers.filter(o => featuredOfferIds.includes(o.id) || featuredOfferIds.includes((o as any).offer_id));
          if (featuredOffers.length === 0) return null;
          return (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-orange-500" />
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Featured Offers</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => scrollFeatured('left')} className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all ${featuredCanScrollLeft ? 'border-purple-200 bg-white hover:bg-purple-50 hover:border-purple-300 text-gray-700 cursor-pointer' : 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'}`} disabled={!featuredCanScrollLeft} aria-label="Scroll left">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button onClick={() => scrollFeatured('right')} className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all ${featuredCanScrollRight ? 'border-purple-200 bg-white hover:bg-purple-50 hover:border-purple-300 text-gray-700 cursor-pointer' : 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'}`} disabled={!featuredCanScrollRight} aria-label="Scroll right">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div ref={featuredScrollRef} onScroll={updateFeaturedScrollButtons} onLoad={updateFeaturedScrollButtons} className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide scroll-smooth">
                {featuredOffers.map(offer => {
                  const pts = Math.round(offer.reward_amount || 0);
                  return (
                    <div key={`feat-${offer.id}`} onClick={() => handleClick(offer)}
                      className="flex-shrink-0 w-[150px] sm:w-[160px] bg-white border border-purple-100 rounded-xl overflow-hidden cursor-pointer hover:shadow-lg hover:border-purple-300 transition-all group">
                      <div className="w-full h-[110px] bg-gray-50 flex items-center justify-center overflow-hidden border-b border-gray-100">
                        <img src={getOfferImage({ image_url: offer.image_url, vertical: offer.category })} alt="" className="w-full h-full object-contain p-2.5" onError={e => { (e.target as HTMLImageElement).src = '/category-images/other.png'; }} />
                      </div>
                      <div className="px-2.5 py-2.5 flex flex-col">
                        <p className="text-[11px] font-bold text-gray-900 line-clamp-2 leading-tight group-hover:text-[#340075] transition-colors">{truncTitle(offer.title, 3)}</p>
                        {offer.refined_description?.event_flow && (
                          <p className="text-[9px] text-purple-600 truncate mt-1">{offer.refined_description.event_flow}</p>
                        )}
                        <span className="text-[12px] font-bold text-[#340075] mt-2">+{pts.toLocaleString()} {currency}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Qualification - grid */}
        {!isQualified && qualSurvey && !search && viewMode === 'grid' && (
          <div onClick={() => setShowQual(true)} className="mb-5 bg-white rounded-2xl border-2 border-purple-200 hover:border-[#340075]/40 overflow-hidden cursor-pointer hover:shadow-lg transition-all group">
            <div className="flex flex-col sm:flex-row">
              <div className="relative w-full sm:w-44 h-32 sm:h-auto flex-shrink-0 overflow-hidden">
                <img src={qualSurvey.display_image_url || 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=400&h=300&fit=crop&q=80'} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="flex items-center gap-4 p-4 flex-1">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase text-white bg-red-500"><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>LIVE</span><span className="text-[9px] font-bold tracking-wider uppercase text-red-600">Required</span></div>
                  <h3 className="font-bold text-gray-900 text-sm group-hover:text-[#340075] transition-colors">{qualSurvey.display_title || 'Qualification Survey'}</h3>
                  <p className="text-gray-500 text-xs mt-0.5 truncate">{qualSurvey.display_description || 'Complete to unlock all offers'}</p>
                </div>
                <div className="bg-purple-50 px-3 py-2 rounded-xl flex-shrink-0 text-center"><span className="text-[#340075] font-bold text-base block">+{qualSurvey.points || 6}</span><span className="text-[#340075]/60 text-[9px] font-semibold uppercase">{currency}</span></div>
              </div>
            </div>
          </div>
        )}

        {/* Qualification - table row */}
        {!isQualified && qualSurvey && !search && viewMode === 'table' && (
          <div className="mb-3">
            <div onClick={() => setShowQual(true)} className="bg-white rounded-xl border-2 border-purple-200 hover:border-[#340075]/40 px-4 py-3 cursor-pointer transition-all group grid grid-cols-1 md:grid-cols-[1fr_140px_140px_120px] items-center gap-3 hover:shadow-md">
              <div className="flex items-center gap-3">
                <img src={qualSurvey.display_image_url || 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=100&h=100&fit=crop&q=80'} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                <div className="min-w-0"><div className="flex items-center gap-1.5 mb-0.5"><span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white bg-red-500"><span className="w-1 h-1 rounded-full bg-white animate-pulse"></span>LIVE</span></div><p className="font-semibold text-gray-900 text-sm group-hover:text-[#340075]">{qualSurvey.display_title || 'Qualification Survey'}</p></div>
              </div>
              <div className="md:text-center"><span className="text-[9px] font-bold tracking-wider uppercase text-white bg-red-500 px-2.5 py-1 rounded-full">Required</span></div>
              <div className="md:text-center"><span className="font-bold text-[#340075] text-sm">+{qualSurvey.points || 6} {currency}</span></div>
              <div className="md:text-right"><button className="text-xs font-semibold text-white bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg transition-all">Start Now</button></div>
            </div>
          </div>
        )}

        {/* Empty states */}
        {filteredOffers.length === 0 && isQualified && !loading && (
          <div className="text-center py-16"><div className="text-5xl mb-4">🔍</div><h3 className="text-gray-700 text-lg font-bold mb-2">No offers found</h3><p className="text-gray-500 text-sm mb-4">Try adjusting your filters</p><button onClick={() => { setSearch(''); setCategory('all'); setDevice('all'); setPayoutType('all'); }} className="ow-btn px-6 py-2">Clear Filters</button></div>
        )}
        {filteredOffers.length === 0 && !isQualified && !loading && (
          <div className="text-center py-10 text-gray-500 text-sm">Complete the qualification survey above to unlock offers</div>
        )}

        {/* ===== TABLE VIEW ===== */}
        {filteredOffers.length > 0 && viewMode === 'table' && (
          <div>
            <div className="hidden md:grid grid-cols-[1fr_140px_80px_120px] items-center px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 mb-2">
              <span>Offer</span><span className="text-center">Reward</span><span className="text-center">QR</span><span className="text-right">Action</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {visibleOffers.map(offer => {
                const pts = Math.round(offer.reward_amount || 0);
                const realId = offer.id.replace(/__cat\d+$/, '');
                const displayClicks = offer.click_count || 0;
                const displayPicks = offer.pick_count || 0;
                const deviceLabel = getDeviceLabel(offer);
                return (
                  <div key={offer.id} className="bg-white rounded-xl border border-gray-100 hover:border-purple-200 hover:shadow-md px-4 py-3 cursor-pointer transition-all group grid grid-cols-[1fr_auto] md:grid-cols-[1fr_140px_80px_120px] items-center gap-2 md:gap-0">
                    <div className="flex items-center gap-3 min-w-0 overflow-hidden" onClick={() => handleClick(offer)}>
                      <div className="w-20 h-20 rounded-xl bg-white border border-gray-100 flex-shrink-0 flex items-center justify-center overflow-hidden">
                        <img src={getOfferImage({ image_url: offer.image_url, vertical: offer.category })} alt={offer.title} className="w-full h-full object-contain p-2" onError={e => { (e.target as HTMLImageElement).src = '/category-images/other.png'; }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate group-hover:text-[#340075] transition-colors">{truncTitle(offer.title, 6)}</p>
                        {apiKey === 'iK66hQRakcvRVj08CX7qfqNzE1Zqt0uF' && (
                          <p className="text-[9px] font-mono text-gray-400">{offer.id}</p>
                        )}
                        {apiKey === 'iK66hQRakcvRVj08CX7qfqNzE1Zqt0uF' && offer.target_url && (
                          <p className="text-[8px] font-mono text-blue-400 truncate max-w-[250px]" title={offer.target_url}>{offer.target_url}</p>
                        )}
                        {offer.refined_description?.event_flow && (
                          <p className="text-[11px] text-purple-600 font-medium truncate mt-0.5">{offer.refined_description.event_flow}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                            {getDeviceIcon(offer)}
                          </span>
                          {offer.is_boosted && offer.boost_expires_at && (
                            <BoostCountdown endDate={offer.boost_expires_at} />
                          )}
                          {offer.is_boosted && !offer.boost_expires_at && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded-full border border-orange-200">
                              🔥 Boosted
                            </span>
                          )}
                          {displayPicks > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full">
                              <Users className="h-3 w-3" />{displayPicks.toLocaleString()}
                            </span>
                          )}
                          <span className="md:hidden inline-flex items-center text-[10px] font-bold text-[#340075] bg-purple-50 px-1.5 py-0.5 rounded-full">+{pts.toLocaleString()} {currency}</span>
                        </div>
                      </div>
                    </div>
                    <div className="hidden md:block md:text-center" onClick={() => handleClick(offer)}>
                      {offer.is_boosted && offer.boost_percentage ? (
                        <div className="flex flex-col items-center">
                          <span className="text-red-400 text-xs line-through decoration-red-500 decoration-2 font-medium">{Math.round(pts / (1 + (offer.boost_direction === 'increase' ? 1 : -1) * (offer.boost_percentage || 0) / 100)).toLocaleString()} {currency}</span>
                          <span className="font-bold text-orange-600 text-sm">+{pts.toLocaleString()} {currency}</span>
                        </div>
                      ) : (
                        <span className="font-bold text-[#340075] text-sm">+{pts.toLocaleString()} {currency}</span>
                      )}
                    </div>
                    <div className="hidden md:block md:text-center">
                      <button onClick={e => { e.stopPropagation(); setQrOffer(offer); }} className="p-2 rounded-lg hover:bg-purple-50 text-gray-400 hover:text-[#340075] transition-colors" title="QR Code"><QrCode className="h-4 w-4" /></button>
                    </div>
                    <div className="text-right flex-shrink-0"><button onClick={() => handleClick(offer)} className="text-xs font-semibold text-white bg-[#340075] hover:bg-[#4c1d95] px-3 py-1.5 md:px-4 md:py-2 rounded-lg transition-all hover:shadow-md whitespace-nowrap">Start Offer</button></div>
                  </div>
                );
              })}
              {loadingMore && viewMode === 'table' && Array.from({ length: 4 }).map((_, i) => (
                <div key={`sk-t-${i}`} className="bg-white rounded-xl border border-gray-100 px-4 py-3 grid grid-cols-1 md:grid-cols-[1fr_140px_80px_120px] items-center gap-3 md:gap-0 animate-pulse">
                  <div className="flex items-center gap-3"><div className="w-11 h-11 rounded-xl bg-gray-200 flex-shrink-0"></div><div className="flex-1"><div className="h-3.5 bg-gray-200 rounded w-3/4 mb-2"></div><div className="h-2.5 bg-gray-200 rounded w-1/2"></div></div></div>
                  <div className="md:text-center"><div className="h-4 bg-gray-200 rounded w-16 mx-auto"></div></div>
                  <div className="md:text-center"><div className="h-8 w-8 bg-gray-200 rounded-lg mx-auto"></div></div>
                  <div className="md:text-right"><div className="h-8 bg-gray-200 rounded-lg w-20 ml-auto"></div></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== GRID VIEW ===== */}
        {filteredOffers.length > 0 && viewMode === 'grid' && (
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5 px-1 sm:px-2">
            {/* Sub-walls */}
            {!search && subWalls.map(w => (
              <div key={`sw-${w._id}`} onClick={() => window.open(`https://walls.moustacheleads.com/wall/${w.slug}`, '_blank')} className="ow-card group cursor-pointer">
                <div className="relative h-44 overflow-hidden rounded-t-2xl">{w.image_url ? <img src={w.image_url} alt={w.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <div className="w-full h-full bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center"><Award className="h-10 w-10 text-purple-300" /></div>}<div className="absolute top-3 right-3 bg-white/95 px-2.5 py-1 rounded-full shadow-sm text-xs font-bold text-[#340075]">{w.offer_count} offers</div></div>
                <div className="p-4 flex flex-col flex-grow"><p className="text-[9px] font-bold tracking-wider uppercase text-teal-700 mb-1">Collection</p><h3 className="font-bold text-gray-900 text-sm mb-1">{w.heading_text || w.name}</h3><p className="text-gray-500 text-xs line-clamp-2 mb-3">{w.description}</p><button className="ow-btn w-full mt-auto">View Collection</button></div>
              </div>
            ))}

            {/* Offer cards */}
            {visibleOffers.map(offer => {
              const pts = Math.round(offer.reward_amount || 0);
              const realId = offer.id.replace(/__cat\d+$/, '');
              const displayClicks = offer.click_count || 0;
              const displayPicks = offer.pick_count || 0;
              const deviceLabel = getDeviceLabel(offer);
              // Calculate original (non-boosted) points for strikethrough display
              const originalPts = offer.is_boosted && offer.boost_percentage
                ? Math.round(offer.boost_direction === 'increase'
                  ? pts / (1 + offer.boost_percentage / 100)
                  : pts / (1 - offer.boost_percentage / 100))
                : pts;
              return (
                <div key={offer.id} className="ow-card group cursor-pointer">
                  {/* Image */}
                  <div className="relative h-40 overflow-hidden rounded-t-2xl bg-white border-b border-gray-100 flex items-center justify-center" onClick={() => handleClick(offer)}>
                    <img src={getOfferImage({ image_url: offer.image_url, vertical: offer.category })} alt={offer.title}
                      className="w-full h-full object-contain p-3 transition-transform duration-500 group-hover:scale-105"
                      onError={e => { (e.target as HTMLImageElement).src = '/category-images/other.png'; }} />
                    {offer.is_boosted ? (
                      <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-xl shadow-md border border-orange-200 flex flex-col items-end">
                        <span className="text-red-400 font-semibold text-xs line-through decoration-red-500 decoration-2">{originalPts.toLocaleString()} {currency}</span>
                        <span className="text-orange-600 font-bold text-sm">+{pts.toLocaleString()} {currency}</span>
                      </div>
                    ) : (
                      <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full shadow-sm"><span className="text-[#340075] font-bold text-xs">+{pts.toLocaleString()} {currency}</span></div>
                    )}
                    {offer.timer_enabled && offer.timer_end_date && <div className="absolute top-3 left-3"><CountdownTimer endDate={offer.timer_end_date} /></div>}
                    {/* Boosted badge with countdown */}
                    {offer.is_boosted && offer.boost_expires_at && <div className="absolute top-3 left-3"><BoostCountdown endDate={offer.boost_expires_at} /></div>}
                    {offer.is_boosted && !offer.boost_expires_at && <div className="absolute top-3 left-3 bg-orange-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-sm">🔥 Boosted</div>}
                    {/* QR button on image */}
                    <button onClick={e => { e.stopPropagation(); setQrOffer(offer); }} className="absolute bottom-3 right-3 bg-white/90 hover:bg-white p-1.5 rounded-lg shadow-md text-[#340075] transition-all hover:scale-110" title="QR Code"><QrCode className="h-4 w-4" /></button>
                  </div>

                  {/* Content */}
                  <div className="p-4 flex flex-col flex-grow" onClick={() => handleClick(offer)}>
                    <h3 className="font-bold text-gray-900 text-sm leading-snug mb-1 line-clamp-1 group-hover:text-[#340075] transition-colors">{truncTitle(offer.title, 5)}</h3>
                    {apiKey === 'iK66hQRakcvRVj08CX7qfqNzE1Zqt0uF' && (
                      <p className="text-[9px] font-mono text-gray-400 mb-1">{offer.id}</p>
                    )}
                    {offer.refined_description?.event_flow && (
                      <p className="text-[11px] text-purple-600 font-medium truncate mb-2">{offer.refined_description.event_flow}</p>
                    )}
                    {/* Meta row: device + picks */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-3">
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {getDeviceIcon(offer)}
                      </span>
                      {displayPicks > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                          <Users className="h-3 w-3" />{displayPicks.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <button className="ow-btn w-full mt-auto group-hover:shadow-lg group-hover:shadow-[#340075]/15 transition-shadow">
                      <span>Start Offer</span><ChevronRight className="w-4 h-4 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Skeleton cards while loading more */}
            {loadingMore && Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={`sk-${i}`} />)}
          </div>
        )}

        {/* ===== LOAD MORE ===== */}
        {hasMore && filteredOffers.length > 0 && (
          <div className="text-center mt-8">
            <button onClick={handleLoadMore} disabled={loadingMore}
              className="inline-flex items-center gap-2 bg-white border-2 border-[#340075]/20 hover:border-[#340075] text-[#340075] font-bold px-8 py-3 rounded-xl transition-all hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed">
              {loadingMore ? (
                <><div className="w-4 h-4 border-2 border-[#340075]/30 border-t-[#340075] rounded-full animate-spin"></div>Loading…</>
              ) : (
                <><ChevronDown className="w-4 h-4" />Load More Offers</>
              )}
            </button>
          </div>
        )}
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-gray-100 py-6 mt-auto bg-white">
        <div className="max-w-[1300px] mx-auto px-4 md:px-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2"><img src="/logo.png" alt="" className="h-6 w-auto" onError={e=>{(e.target as HTMLImageElement).style.display='none'}} /><span className="font-bold text-[#340075] text-sm">Moustache Leads</span></div>
          <p className="text-gray-400 text-xs">© 2026 Moustache Leads. All rights reserved.</p>
          <div className="flex gap-4 text-xs text-gray-400"><a href="#" className="hover:text-[#340075]">Privacy</a><a href="#" className="hover:text-[#340075]">Terms</a></div>
        </div>
      </footer>

      {/* ===== MODALS & OVERLAYS ===== */}
      {qrOffer && <QRModal url={qrOffer.click_url} title={qrOffer.title} onClose={() => setQrOffer(null)} />}
      {showSupport && <SupportModal onClose={() => setShowSupport(false)} />}
      {showTracking && <TrackingPanel items={activityItems} loading={activityLoading} onClose={() => setShowTracking(false)} currency={currency} />}

      {funnel && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col">
          {funnelResult ? (
            <div className="flex-1 flex items-center justify-center"><div className="text-center max-w-sm p-6">{funnelResult.type==='pass'?<><div className="text-5xl mb-4">🎉</div><h2 className="text-xl font-bold text-gray-900 mb-2">Congratulations!</h2><p className="text-gray-500 mb-4">{funnelResult.message}</p><button onClick={closeFunnel} className="ow-btn px-8 py-3">Done</button></>:<><div className="text-5xl mb-4">{funnelResult.has_next?'🔄':'😔'}</div><h2 className="text-xl font-bold text-gray-900 mb-2">{funnelResult.has_next?'Not quite…':'Sorry!'}</h2><p className="text-gray-500 mb-4">{funnelResult.message}</p>{!funnelResult.has_next&&<button onClick={closeFunnel} className="ow-btn px-8 py-3">Back</button>}</>}</div></div>
          ) : funnelSurvey ? (
            <div className="flex-1 relative"><button onClick={closeFunnel} className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500">✕</button><SurveyTemplateRenderer template={funnelTpl} title={funnelSurvey.title||'Survey'} description={`Step ${funnelStep+1}`} questions={(funnelSurvey.questions||[]).map((q:any)=>({text:q.text,options:q.options||[]}))} answers={funnelAns} onAnswer={(i,a)=>setFunnelAns(p=>({...p,[i]:a}))} onSubmit={submitFunnel} submitting={funnelSubmitting} brandColor="#340075" /></div>
          ) : <div className="flex-1 flex items-center justify-center"><p className="text-gray-400">Loading…</p></div>}
        </div>
      )}

      {showQual && qualSurvey && (
        <div className="fixed inset-0 z-[9999]">
          <button onClick={() => setShowQual(false)} className="fixed top-4 right-4 z-[10000] w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center"><X className="w-5 h-5 text-gray-600" /></button>
          <QualSurveyTpl survey={qualSurvey} onSubmit={handleQualSubmit} onAnswer={(qid,a) => setQualAnswers(p=>({...p,[qid]:a}))} answers={qualAnswers} />
        </div>
      )}

      {selOffer && (
        <OfferModal offer={{...selOffer, status: selOffer.status||'active'}} open={modalOpen} onClose={() => setModalOpen(false)} currencyName={currency} userCountry={userCountry}
          onStartOffer={async offer => {
            // Strip virtual category-expansion suffix
            const realId = offer.id.replace(/__cat\d+$/, '');
            // Upgrade status to "pending" when Start Offer is clicked
            const updated = { ...offerStatuses, [realId]: 'pending' as const };
            setOfferStatuses(updated);
            localStorage.setItem(`ow_statuses_${userId}_${placementId}`, JSON.stringify(updated));
            try {
              await fetch(`${baseUrl}/api/offerwall/track/offer-start`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ placement_id: placementId, user_id: userId, offer_id: realId, offer_name: offer.title, status: 'pending', user_agent: navigator.userAgent })
              });
            } catch {}
            window.open(offer.click_url, '_blank');
          }} />
      )}

      {/* ===== TELEGRAM FLOATING BUTTON ===== */}
      {showTelegramBtn && (
        <div className="fixed bottom-5 right-5 z-[9999] flex items-center gap-1.5">
          <a href="https://t.me/mlaffil" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 bg-[#0088cc] hover:bg-[#006da3] text-white px-4 py-2.5 rounded-full shadow-lg hover:shadow-xl transition-all text-sm font-semibold"
            style={{ textDecoration: 'none' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 flex-shrink-0">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
            <span className="hidden sm:inline">MoustacheLeads</span>
          </a>
          <button onClick={() => setShowTelegramBtn(false)}
            className="w-6 h-6 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors shadow-sm"
            title="Hide">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ===== STYLES ===== */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
        .ow { background: #f9f9fb; font-family: 'DM Sans', system-ui, sans-serif; color: #1a1a2e; }
        .ow-header { background: white; border-bottom: 1px solid #f0f0f5; box-shadow: 0 1px 8px rgba(52,0,117,0.04); }
        .ow-card { background: white; border-radius: 16px; border: 1px solid #f0f0f5; overflow: hidden; display: flex; flex-direction: column; transition: all 0.25s ease; }
        .ow-card:hover { box-shadow: 0 8px 32px -8px rgba(52,0,117,0.12); transform: translateY(-2px); border-color: #e0d4f5; }
        .ow-btn { display: inline-flex; align-items: center; justify-content: center; gap: 5px; background: #340075; color: white; font-weight: 700; font-size: 12px; padding: 9px 14px; border-radius: 10px; border: none; cursor: pointer; transition: all 0.15s; }
        .ow-btn:hover { background: #4c1d95; }
        .ow-btn:active { transform: scale(0.97); }
        .ow-select { appearance: none; background: white url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236b7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat right 10px center; border: 1px solid #e5e7eb; border-radius: 8px; padding: 7px 28px 7px 11px; font-size: 13px; font-weight: 500; color: #374151; cursor: pointer; }
        .ow-select:focus { outline: none; border-color: #340075; }
        .ow-select-icon { padding-left: 26px; }
        .ow-cat-btn { padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; white-space: nowrap; cursor: pointer; transition: all 0.15s; border: 1.5px solid transparent; background: transparent; color: #6b7280; flex-shrink: 0; }
        .ow-cat-btn:hover { background: #f3f0ff; color: #340075; }
        .ow-cat-btn:active { transform: translateY(1px) scale(0.97); }
        .ow-cat-btn-active { background: #340075; color: white; box-shadow: 0 3px 10px rgba(52,0,117,0.25); }
        .ow-cat-btn-active:hover { background: #4c1d95; color: white; }
        .ow-spinner { width: 32px; height: 32px; border: 3px solid #e5e7eb; border-top-color: #340075; border-radius: 50%; animation: spin 0.7s linear infinite; }
        .ow-badge-timer { display: inline-flex; align-items: center; gap: 3px; background: #dc2626; color: white; padding: 3px 7px; border-radius: 999px; font-size: 11px; font-weight: 700; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

        /* ===== RESPONSIVE IFRAME FIXES ===== */
        /* Ensure content is scrollable and properly sized inside iframes */
        .ow {
          width: 100%;
          box-sizing: border-box;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
        }
        @media (max-width: 480px) {
          .ow-select { font-size: 11px; padding: 6px 22px 6px 8px; border-radius: 6px; }
          .ow-select-icon { padding-left: 22px; }
          .ow-cat-btn { padding: 5px 10px; font-size: 11px; }
          .ow-btn { font-size: 11px; padding: 7px 10px; border-radius: 8px; }
          .ow-card { border-radius: 12px; }
        }
        @media (max-width: 360px) {
          .ow-select { font-size: 10px; padding: 5px 18px 5px 6px; }
          .ow-select-icon { padding-left: 18px; }
          .ow-cat-btn { padding: 4px 8px; font-size: 10px; }
        }
      `}</style>
    </div>
  );
};

// ===================== QUAL SURVEY =====================
function QualSurveyTpl({ survey, onSubmit, onAnswer, answers }: { survey:any; onSubmit:()=>void; onAnswer:(qid:string,a:string|string[])=>void; answers:Record<string,any>; }) {
  const qs = (survey.questions||[]).filter((q:any) => q.type==='mcq'||q.type==='yes_no'||q.type==='mcq_multi');
  const tqs = qs.map((q:any) => ({
    text: q.text,
    options: q.type==='yes_no' ? ['Yes','No'] : (q.options||[]),
    allowMultiple: q.type==='mcq_multi',
  }));
  // Build template answers: for mcq_multi keep as array, others as string
  const ta: Record<number, string|string[]> = {};
  qs.forEach((q:any, i:number) => {
    if (answers[q.id] !== undefined) ta[i] = answers[q.id];
  });
  return <SurveyTemplateRenderer
    template={(survey.template||'moustache-default') as TemplateName}
    title={survey.name||'Qualification Survey'}
    description="Complete to unlock all offers"
    questions={tqs}
    answers={ta}
    onAnswer={(i, a) => { const qid = qs[i]?.id; if (qid) onAnswer(qid, a); }}
    onSubmit={onSubmit}
    submitting={false}
    questionsPerPage={survey.questions_per_page||3}
  />;
}
