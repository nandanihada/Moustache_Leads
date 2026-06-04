import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChevronRight, Sparkles, AlertCircle, Gift, Zap, Globe, Smartphone, Monitor, 
  Timer, Flame, Clock as ClockIcon, Search, X, Lock, Filter, Star, TrendingUp,
  ChevronDown, SlidersHorizontal, ArrowUpDown, Coins, Award
} from 'lucide-react';
import { OfferModal } from './OfferModal';
import { getOfferImage } from '@/utils/categoryImages';

interface Offer {
  id: string;
  title: string;
  description: string;
  reward_amount: number;
  reward_currency: string;
  category: string;
  categories?: string[];
  status: string;
  estimated_time: string;
  image_url: string;
  click_url: string;
  network?: string;
  countries?: string[];
  devices?: string[];
  device_targeting?: string;
  created_at?: string;
  payout_type?: string;
  payout?: number;
  star_rating?: number;
  show_in_iframe?: boolean;
  urgency_type?: string;
  urgency_message?: string;
  timer_enabled?: boolean;
  timer_end_date?: string;
  is_locked?: boolean;
  has_access?: boolean;
  lock_reason?: string;
  approval_type?: string;
  request_status?: string;
  estimated_approval_time?: string;
  requires_approval?: boolean;
}

// Category definitions
const CATEGORIES = [
  { id: 'all', name: 'All Offers', icon: '🎯', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { id: 'HEALTH', name: 'Health', icon: '💊', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { id: 'SURVEY', name: 'Surveys', icon: '📋', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'SWEEPSTAKES', name: 'Sweepstakes', icon: '🎰', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'EDUCATION', name: 'Education', icon: '📚', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { id: 'INSURANCE', name: 'Insurance', icon: '🛡️', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  { id: 'LOAN', name: 'Loans', icon: '💳', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { id: 'FINANCE', name: 'Finance', icon: '💰', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'DATING', name: 'Dating', icon: '❤️', color: 'bg-pink-50 text-pink-700 border-pink-200' },
  { id: 'FREE_TRIAL', name: 'Free Trials', icon: '🎁', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { id: 'INSTALLS', name: 'Installs', icon: '📲', color: 'bg-green-50 text-green-700 border-green-200' },
  { id: 'GAMES_INSTALL', name: 'Games', icon: '🎮', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  { id: 'OTHER', name: 'Other', icon: '📦', color: 'bg-gray-50 text-gray-700 border-gray-200' },
];

// Country flag mapping
const FLAG_MAP: Record<string, string> = {
  'US': '🇺🇸', 'UK': '🇬🇧', 'GB': '🇬🇧', 'CA': '🇨🇦', 'AU': '🇦🇺', 'DE': '🇩🇪', 
  'FR': '🇫🇷', 'IT': '🇮🇹', 'ES': '🇪🇸', 'BR': '🇧🇷', 'IN': '🇮🇳', 'JP': '🇯🇵',
  'KR': '🇰🇷', 'CN': '🇨🇳', 'NL': '🇳🇱', 'BE': '🇧🇪', 'AT': '🇦🇹', 'CH': '🇨🇭',
  'SE': '🇸🇪', 'NO': '🇳🇴', 'DK': '🇩🇰', 'FI': '🇫🇮', 'PL': '🇵🇱', 'PT': '🇵🇹',
  'IE': '🇮🇪', 'NZ': '🇳🇿', 'MX': '🇲🇽', 'AR': '🇦🇷', 'CL': '🇨🇱', 'CO': '🇨🇴',
  'TW': '🇹🇼', 'SG': '🇸🇬', 'MY': '🇲🇾', 'TH': '🇹🇭', 'PH': '🇵🇭', 'ID': '🇮🇩',
  'ZA': '🇿🇦', 'AE': '🇦🇪', 'SA': '🇸🇦', 'IL': '🇮🇱', 'TR': '🇹🇷', 'RU': '🇷🇺',
  'GR': '🇬🇷', 'CZ': '🇨🇿', 'HU': '🇭🇺', 'RO': '🇷🇴', 'UA': '🇺🇦', 'VN': '🇻🇳',
  'PK': '🇵🇰', 'BD': '🇧🇩', 'EG': '🇪🇬', 'NG': '🇳🇬', 'KE': '🇰🇪', 'PE': '🇵🇪',
  'VE': '🇻🇪', 'EC': '🇪🇨', 'CR': '🇨🇷', 'PA': '🇵🇦', 'PR': '🇵🇷', 'DO': '🇩🇴',
  'HK': '🇭🇰', 'MO': '🇲🇴', 'LK': '🇱🇰', 'NP': '🇳🇵', 'MM': '🇲🇲', 'KH': '🇰🇭'
};

// Device filter options
const DEVICE_FILTERS = [
  { id: 'all', name: 'All Devices', icon: Globe },
  { id: 'android', name: 'Android', icon: Smartphone },
  { id: 'ios', name: 'iOS', icon: Smartphone },
  { id: 'desktop', name: 'Desktop', icon: Monitor },
];

// Points range filter options
const POINTS_RANGES = [
  { id: 'all', name: 'Any Points', min: 0, max: Infinity },
  { id: 'low', name: '1 - 100', min: 1, max: 100 },
  { id: 'medium', name: '101 - 500', min: 101, max: 500 },
  { id: 'high', name: '501 - 2000', min: 501, max: 2000 },
  { id: 'premium', name: '2000+', min: 2000, max: Infinity },
];

// Helper functions
const getCountryDisplay = (countries?: string[]): JSX.Element => {
  if (!countries || countries.length === 0) {
    return <span className="text-xs text-gray-400 flex items-center gap-1"><Globe className="h-3 w-3" /> Global</span>;
  }
  const maxFlags = 4;
  const displayCountries = countries.slice(0, maxFlags);
  const remaining = countries.length - maxFlags;
  const flags = displayCountries.map(c => FLAG_MAP[c.toUpperCase()] || c).join(' ');
  
  if (remaining > 0) {
    return <span className="text-xs text-gray-600">{flags} <span className="text-purple-600 font-medium">+{remaining}</span></span>;
  }
  return <span className="text-xs text-gray-600">{flags}</span>;
};

const extractCountriesFromTitle = (title: string): string[] => {
  const countryCodes = Object.keys(FLAG_MAP);
  const found: string[] = [];
  const parts = title.toUpperCase().split(/[\s,\-]+/);
  for (const part of parts) {
    const cleaned = part.trim();
    if (cleaned.length === 2 && countryCodes.includes(cleaned) && !found.includes(cleaned)) {
      found.push(cleaned);
    }
  }
  return found;
};

const getOfferCountries = (offer: Offer): string[] => {
  if (offer.countries && offer.countries.length > 0) return offer.countries;
  return extractCountriesFromTitle(offer.title || '');
};

const truncateTitle = (title: string, maxWords: number = 7): string => {
  const words = title.split(' ');
  if (words.length <= maxWords) return title;
  return words.slice(0, maxWords).join(' ') + '...';
};

const getDeviceIcon = (device?: string): JSX.Element | null => {
  if (!device) return null;
  const d = device.toLowerCase();
  if (d.includes('android')) return <Smartphone className="h-3.5 w-3.5 text-green-600" />;
  if (d.includes('ios') || d.includes('iphone') || d.includes('ipad')) return <Smartphone className="h-3.5 w-3.5 text-gray-500" />;
  if (d.includes('web') || d.includes('desktop')) return <Monitor className="h-3.5 w-3.5 text-blue-600" />;
  return <Globe className="h-3.5 w-3.5 text-purple-500" />;
};

const renderStarRating = (rating: number = 5): JSX.Element => {
  const stars = Math.min(5, Math.max(1, Math.round(rating)));
  return (
    <div className="flex items-center gap-0.5">
      {[...Array(5)].map((_, i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i < stars ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
      ))}
    </div>
  );
};

// Countdown Timer Component
const CountdownTimer: React.FC<{ endDate: string }> = ({ endDate }) => {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const end = new Date(endDate).getTime();
      const now = new Date().getTime();
      const diff = end - now;
      if (diff <= 0) { setIsExpired(true); return; }
      setTimeLeft({
        hours: Math.floor(diff / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000)
      });
    };
    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [endDate]);

  if (isExpired) return null;

  return (
    <div className="flex items-center gap-1 bg-red-500 text-white px-2 py-0.5 rounded-full text-xs font-bold shadow-sm">
      <Timer className="h-3 w-3" />
      <span>{String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}</span>
    </div>
  );
};

// Urgency badge
const getUrgencyBadge = (urgencyType?: string): JSX.Element | null => {
  if (!urgencyType) return null;
  const badges: Record<string, { text: string; icon: JSX.Element; color: string }> = {
    'limited_slots': { text: 'Limited', icon: <Timer className="h-3 w-3" />, color: 'bg-red-500' },
    'high_demand': { text: 'Hot', icon: <Flame className="h-3 w-3" />, color: 'bg-orange-500' },
    'expires_soon': { text: 'Expiring', icon: <ClockIcon className="h-3 w-3" />, color: 'bg-yellow-500' }
  };
  const badge = badges[urgencyType];
  if (!badge) return null;
  return (
    <div className={`${badge.color} text-white px-2 py-0.5 rounded-full flex items-center gap-1 text-xs font-bold shadow-sm`}>
      {badge.icon}
      <span>{badge.text}</span>
    </div>
  );
};

interface OfferwallProps {
  placementId: string;
  userId: string;
  apiKey: string;
  baseUrl?: string;
}

const Offerwall: React.FC<OfferwallProps> = ({ 
  placementId, 
  userId, 
  apiKey, 
  baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000' 
}) => {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [filteredOffers, setFilteredOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placementData, setPlacementData] = useState<any>(null);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [currencyName, setCurrencyName] = useState('Points');
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['all']);
  const [sortBy, setSortBy] = useState<'points_high' | 'points_low' | 'newest' | 'rating'>('points_high');
  const [selectedDevice, setSelectedDevice] = useState('all');
  const [selectedPointsRange, setSelectedPointsRange] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Toggle category selection
  const toggleCategory = (categoryId: string) => {
    if (categoryId === 'all') {
      setSelectedCategories(['all']);
    } else {
      setSelectedCategories(prev => {
        const withoutAll = prev.filter(c => c !== 'all');
        if (withoutAll.includes(categoryId)) {
          const newSelection = withoutAll.filter(c => c !== categoryId);
          return newSelection.length === 0 ? ['all'] : newSelection;
        } else {
          return [...withoutAll, categoryId];
        }
      });
    }
  };

  useEffect(() => {
    trackImpression();
    loadOffers();
  }, [placementId, userId]);

  // Apply filters
  useEffect(() => {
    let result = [...offers];

    const categoryMappings: Record<string, string[]> = {
      'HEALTH': ['HEALTH', 'HEALTHCARE', 'MEDICAL'],
      'SURVEY': ['SURVEY', 'SURVEYS'],
      'SWEEPSTAKES': ['SWEEPSTAKES', 'SWEEPS', 'GIVEAWAY', 'PRIZE', 'LOTTERY', 'RAFFLE', 'CONTEST'],
      'EDUCATION': ['EDUCATION', 'LEARNING'],
      'INSURANCE': ['INSURANCE'],
      'LOAN': ['LOAN', 'LOANS', 'LENDING'],
      'FINANCE': ['FINANCE', 'FINANCIAL'],
      'DATING': ['DATING', 'RELATIONSHIPS'],
      'FREE_TRIAL': ['FREE_TRIAL', 'FREETRIAL', 'TRIAL'],
      'INSTALLS': ['INSTALLS', 'INSTALL', 'APP', 'APPS'],
      'GAMES_INSTALL': ['GAMES_INSTALL', 'GAMESINSTALL', 'GAME', 'GAMES', 'GAMING'],
    };

    // Category filter
    if (!selectedCategories.includes('all')) {
      result = result.filter(offer => {
        return selectedCategories.some(cat => {
          const catUpper = cat.toUpperCase();
          const matchingCategories = categoryMappings[catUpper] || [catUpper];
          const cats = offer.categories;
          if (Array.isArray(cats) && cats.length > 0) {
            return cats.some((c: string) => matchingCategories.includes(c.toUpperCase()));
          }
          const offerCategory = (offer.category || '').toUpperCase();
          return matchingCategories.includes(offerCategory);
        });
      });
    }

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(offer =>
        offer.title?.toLowerCase().includes(term) ||
        offer.description?.toLowerCase().includes(term)
      );
    }

    // Device filter
    if (selectedDevice !== 'all') {
      result = result.filter(offer => {
        const deviceStr = (offer.device_targeting || offer.devices?.join(' ') || '').toLowerCase();
        if (selectedDevice === 'android') return deviceStr.includes('android');
        if (selectedDevice === 'ios') return deviceStr.includes('ios') || deviceStr.includes('iphone') || deviceStr.includes('ipad');
        if (selectedDevice === 'desktop') return deviceStr.includes('web') || deviceStr.includes('desktop');
        return true;
      });
    }

    // Points range filter
    if (selectedPointsRange !== 'all') {
      const range = POINTS_RANGES.find(r => r.id === selectedPointsRange);
      if (range) {
        result = result.filter(offer => {
          const points = offer.reward_amount || 0;
          return points >= range.min && points <= range.max;
        });
      }
    }

    // Sorting
    result.sort((a, b) => {
      const pointsA = a.reward_amount || 0;
      const pointsB = b.reward_amount || 0;
      switch (sortBy) {
        case 'points_high': return pointsB - pointsA;
        case 'points_low': return pointsA - pointsB;
        case 'newest': return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        case 'rating': return (b.star_rating || 5) - (a.star_rating || 5);
        default: return 0;
      }
    });

    setFilteredOffers(result);
  }, [offers, selectedCategories, searchTerm, sortBy, selectedDevice, selectedPointsRange]);

  const trackImpression = async () => {
    try {
      await fetch(`${baseUrl}/api/offerwall/track/impression`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placement_id: placementId,
          user_id: userId,
          user_agent: navigator.userAgent,
          referrer: document.referrer
        })
      });
    } catch (err) {
      console.warn('Failed to track impression:', err);
    }
  };

  const loadOffers = async (page = 1, append = false) => {
    try {
      if (append) { setLoadingMore(true); } else { setLoading(true); }
      setError(null);

      const offersResponse = await fetch(
        `${baseUrl}/api/offerwall/offers?placement_id=${placementId}&user_id=${userId}&page=${page}&limit=200`
      );
      
      if (!offersResponse.ok) throw new Error('Failed to load offers');

      const offersData = await offersResponse.json();
      if (offersData.error) throw new Error(offersData.error);

      const newOffers = offersData.offers || [];
      
      if (append) {
        setOffers(prev => [...prev, ...newOffers]);
      } else {
        setOffers(newOffers);
      }
      
      setCurrentPage(offersData.page || 1);
      setTotalPages(offersData.total_pages || 1);
      setTotalCount(offersData.total_count || newOffers.length);
      setSkippedCount(offersData.skipped_count || 0);
      setCurrencyName(offersData.currency_name || 'Points');
      
      if (offersData.skipped_count > 0) {
        console.warn(`⚠️ ${offersData.skipped_count} offers skipped due to bad data:`, offersData.skipped_offers);
      }
      
      try {
        const placementResponse = await fetch(`${baseUrl}/offerwall?placement_id=${placementId}&user_id=${userId}&api_key=${apiKey}`);
        if (placementResponse.ok) {
          setPlacementData({ offerwallTitle: 'Offerwall', currencyName: 'Points' });
        }
      } catch (err) {
        console.warn('Failed to load placement data:', err);
        setPlacementData({ offerwallTitle: 'Offerwall', currencyName: 'Points' });
      }
    } catch (err) {
      console.error('Error loading offers:', err);
      setError(err instanceof Error ? err.message : 'Failed to load offers');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreOffers = () => {
    if (currentPage < totalPages && !loadingMore) {
      loadOffers(currentPage + 1, true);
    }
  };

  const handleOfferClick = async (offer: Offer) => {
    setSelectedOffer(offer);
    setModalOpen(true);
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (!selectedCategories.includes('all')) count++;
    if (selectedDevice !== 'all') count++;
    if (selectedPointsRange !== 'all') count++;
    return count;
  }, [selectedCategories, selectedDevice, selectedPointsRange]);

  const clearAllFilters = () => {
    setSelectedCategories(['all']);
    setSelectedDevice('all');
    setSelectedPointsRange('all');
    setSearchTerm('');
    setSortBy('points_high');
  };

  // ======================== LOADING STATE ========================
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-purple-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-t-purple-600 rounded-full animate-spin"></div>
            <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center">
              <span className="text-lg font-black text-purple-600">M</span>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Loading Offers</h2>
          <p className="text-purple-600">Finding the best opportunities for you...</p>
        </div>
      </div>
    );
  }

  // ======================== ERROR STATE ========================
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-xl border border-red-100">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Unable to Load Offers</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <button
            onClick={() => loadOffers()}
            className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-xl font-semibold transition-all shadow-lg shadow-purple-200 hover:shadow-purple-300"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ======================== EMPTY STATE ========================
  if (offers.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-xl border border-gray-100">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Gift className="h-8 w-8 text-purple-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">No Offers Available</h2>
          <p className="text-gray-500 mb-6">Check back soon for new opportunities!</p>
          <button
            onClick={() => loadOffers()}
            className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-xl font-semibold transition-all shadow-lg shadow-purple-200"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  // ======================== MAIN OFFERWALL ========================
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50">
      {/* ===== HEADER / NAVBAR ===== */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-purple-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Logo & Brand */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-200">
                <span className="text-white font-black text-sm">ML</span>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-gray-900 leading-tight">Moustache Leads</h1>
                <p className="text-xs text-purple-600 font-medium">Earn Rewards</p>
              </div>
            </div>

            {/* Search Bar - Center */}
            <div className="flex-1 max-w-lg mx-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search offers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-10 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Stats Badge */}
            <div className="hidden md:flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-xl px-4 py-2">
              <Coins className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-bold text-purple-700">{filteredOffers.length}</span>
              <span className="text-xs text-purple-500">offers</span>
            </div>
          </div>
        </div>
      </header>

      {/* ===== FILTERS BAR ===== */}
      <div className="sticky top-[65px] z-40 bg-white/70 backdrop-blur-lg border-b border-purple-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          {/* Category Pills - Scrollable */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategories.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                    isActive
                      ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-200'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:text-purple-600'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>

          {/* Filter Controls Row */}
          <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Device Filter */}
              <div className="relative">
                <select
                  value={selectedDevice}
                  onChange={(e) => setSelectedDevice(e.target.value)}
                  className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-1.5 pr-7 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-pointer"
                >
                  {DEVICE_FILTERS.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              </div>

              {/* Points Range */}
              <div className="relative">
                <select
                  value={selectedPointsRange}
                  onChange={(e) => setSelectedPointsRange(e.target.value)}
                  className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-1.5 pr-7 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-pointer"
                >
                  {POINTS_RANGES.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              </div>

              {/* Clear Filters */}
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <X className="w-3 h-3" />
                  Clear ({activeFilterCount})
                </button>
              )}
            </div>

            {/* Sort */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-1.5 pr-7 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-pointer"
              >
                <option value="points_high">Highest Points</option>
                <option value="points_low">Lowest Points</option>
                <option value="rating">Best Rated</option>
                <option value="newest">Newest</option>
              </select>
              <ArrowUpDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* No Results */}
        {filteredOffers.length === 0 && (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="h-8 w-8 text-purple-400" />
            </div>
            <h3 className="text-gray-800 text-xl font-bold mb-2">No offers found</h3>
            <p className="text-gray-500 mb-4">Try adjusting your search or filters</p>
            <button
              onClick={clearAllFilters}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-xl font-medium transition-colors shadow-lg shadow-purple-200"
            >
              Clear All Filters
            </button>
          </div>
        )}

        {/* Offers Grid */}
        {filteredOffers.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredOffers.map((offer, index) => {
              const points = Math.round(offer.reward_amount || 0);
              const isLocked = offer.is_locked || (offer.requires_approval && !offer.has_access);
              
              return (
                <div
                  key={offer.id}
                  className={`group bg-white rounded-2xl overflow-hidden transition-all duration-300 border border-gray-100 relative shadow-sm hover:shadow-xl ${
                    isLocked 
                      ? 'cursor-not-allowed opacity-90' 
                      : 'hover:border-purple-200 hover:-translate-y-1 cursor-pointer'
                  }`}
                  style={{ animationDelay: `${index * 30}ms` }}
                  onClick={() => !isLocked && handleOfferClick(offer)}
                >
                  {/* Lock Overlay */}
                  {isLocked && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
                      <div className="text-center px-6">
                        <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Lock className="h-7 w-7 text-amber-600" />
                        </div>
                        <h4 className="text-gray-800 font-bold text-base mb-1">Locked Offer</h4>
                        <p className="text-gray-500 text-xs mb-2">
                          {offer.lock_reason || 'Requires approval'}
                        </p>
                        {offer.estimated_approval_time && (
                          <div className="flex items-center justify-center gap-1 text-amber-600 text-xs">
                            <ClockIcon className="h-3 w-3" />
                            <span>{offer.estimated_approval_time}</span>
                          </div>
                        )}
                        {offer.request_status === 'pending' && (
                          <div className="mt-2 bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-semibold inline-block">
                            Request Pending
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Offer Image */}
                  <div className="relative h-40 overflow-hidden bg-gradient-to-br from-purple-100 to-indigo-100">
                    <img 
                      src={getOfferImage({ image_url: offer.image_url, vertical: offer.category })} 
                      alt={offer.title}
                      className={`w-full h-full object-cover transition-transform duration-500 ${isLocked ? 'blur-[2px]' : 'group-hover:scale-110'}`}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        if (target.nextElementSibling) target.nextElementSibling.classList.remove('hidden');
                      }}
                    />
                    <div className="hidden absolute inset-0 bg-gradient-to-br from-purple-200 to-indigo-200 flex items-center justify-center">
                      <Award className="h-12 w-12 text-purple-400" />
                    </div>
                    
                    {/* Top Badges */}
                    <div className="absolute top-2 left-2 right-2 flex items-start justify-between">
                      {/* Category */}
                      <span className="bg-white/90 backdrop-blur-sm text-gray-700 px-2 py-0.5 rounded-md text-xs font-semibold shadow-sm">
                        {CATEGORIES.find(c => c.id === offer.category?.toUpperCase())?.icon || '📦'} {offer.category}
                      </span>
                      
                      {/* Urgency / Timer / Lock */}
                      <div className="flex items-center gap-1">
                        {isLocked ? (
                          <span className="bg-amber-500 text-white px-2 py-0.5 rounded-md text-xs font-bold flex items-center gap-1">
                            <Lock className="h-3 w-3" /> Locked
                          </span>
                        ) : offer.timer_enabled && offer.timer_end_date ? (
                          <CountdownTimer endDate={offer.timer_end_date} />
                        ) : (
                          getUrgencyBadge(offer.urgency_type)
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className={`p-4 ${isLocked ? 'blur-[1px]' : ''}`}>
                    {/* Rating & Device Row */}
                    <div className="flex items-center justify-between mb-2">
                      {renderStarRating(offer.star_rating || 5)}
                      <div className="flex items-center gap-1">
                        {getDeviceIcon(offer.device_targeting || (offer.devices && offer.devices[0]))}
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="font-bold text-gray-800 text-sm mb-1.5 leading-snug line-clamp-2">
                      {truncateTitle(offer.title, 7)}
                    </h3>
                    
                    {/* Countries */}
                    <div className="mb-3">
                      {getCountryDisplay(getOfferCountries(offer))}
                    </div>

                    {/* Points Display */}
                    <div className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-3 border border-purple-100 mb-3">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-purple-700">
                          {points.toLocaleString()}
                        </span>
                        <span className="text-xs text-purple-500 font-semibold uppercase">
                          {currencyName}
                        </span>
                      </div>
                      <Sparkles className="h-5 w-5 text-amber-400" />
                    </div>

                    {/* CTA Button */}
                    <button 
                      className={`w-full font-semibold py-2.5 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-sm ${
                        isLocked 
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                          : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md shadow-purple-200 group-hover:shadow-lg group-hover:shadow-purple-300'
                      }`}
                      disabled={isLocked}
                    >
                      {isLocked ? (
                        <>
                          <Lock className="h-3.5 w-3.5" />
                          <span>Locked</span>
                        </>
                      ) : (
                        <>
                          <span>Earn Now</span>
                          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load More */}
        {currentPage < totalPages && (
          <div className="text-center mt-10">
            <button
              onClick={loadMoreOffers}
              disabled={loadingMore}
              className="bg-white border-2 border-purple-200 hover:border-purple-400 text-purple-700 hover:text-purple-800 px-8 py-3 rounded-xl font-bold transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingMore ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin"></div>
                  Loading...
                </span>
              ) : (
                `Load More (${totalCount - offers.length} remaining)`
              )}
            </button>
          </div>
        )}

        {/* Skipped offers warning */}
        {skippedCount > 0 && (
          <div className="text-center mt-4">
            <p className="text-amber-600 text-sm">
              ⚠️ {skippedCount} offer{skippedCount > 1 ? 's' : ''} couldn't be loaded due to data issues
            </p>
          </div>
        )}
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-purple-100 bg-white/50 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-md flex items-center justify-center">
                <span className="text-white font-black text-[8px]">ML</span>
              </div>
              <span className="text-sm text-gray-500">Powered by <span className="font-semibold text-purple-600">Moustache Leads</span></span>
            </div>
            <p className="text-xs text-gray-400">Complete offers to earn rewards • All offers provided by trusted partners</p>
          </div>
        </div>
      </footer>

      {/* ===== OFFER MODAL ===== */}
      {selectedOffer && (
        <OfferModal
          offer={selectedOffer}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          currencyName={currencyName}
          onStartOffer={async (offer) => {
            try {
              await fetch(`${baseUrl}/api/offerwall/track/click`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  placement_id: placementId,
                  user_id: userId,
                  offer_id: offer.id,
                  offer_name: offer.title,
                  user_agent: navigator.userAgent
                })
              });
              window.open(offer.click_url, '_blank');
            } catch (err) {
              console.error('Error tracking click:', err);
              window.open(offer.click_url, '_blank');
            }
          }}
        />
      )}

      {/* ===== ANIMATIONS & CUSTOM SCROLLBAR ===== */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};

export default Offerwall;
