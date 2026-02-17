import React, { useState, useEffect } from 'react';
import { ChevronRight, Sparkles, AlertCircle, Gift, Zap, Globe, Smartphone, Monitor, Timer, Flame, Clock as ClockIcon, Search, X, Lock } from 'lucide-react';
import { OfferModal } from './OfferModal';
import { getOfferImage } from '@/utils/categoryImages';

interface Offer {
  id: string;
  title: string;
  description: string;
  reward_amount: number;
  reward_currency: string;
  category: string;
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
  // Approval/Lock fields
  is_locked?: boolean;
  has_access?: boolean;
  lock_reason?: string;
  approval_type?: string;
  request_status?: string;
  estimated_approval_time?: string;
  requires_approval?: boolean;
}

// Category definitions (12 predefined categories)
const CATEGORIES = [
  { id: 'all', name: 'All Offers', icon: '🎯' },
  { id: 'HEALTH', name: 'Health', icon: '💊' },
  { id: 'SURVEY', name: 'Surveys', icon: '📋' },
  { id: 'SWEEPSTAKES', name: 'Sweepstakes', icon: '🎰' },
  { id: 'EDUCATION', name: 'Education', icon: '📚' },
  { id: 'INSURANCE', name: 'Insurance', icon: '🛡️' },
  { id: 'LOAN', name: 'Loans', icon: '💳' },
  { id: 'FINANCE', name: 'Finance', icon: '💰' },
  { id: 'DATING', name: 'Dating', icon: '❤️' },
  { id: 'FREE_TRIAL', name: 'Free Trials', icon: '🎁' },
  { id: 'INSTALLS', name: 'Installs', icon: '📲' },
  { id: 'GAMES_INSTALL', name: 'Games', icon: '🎮' },
  { id: 'OTHER', name: 'Other', icon: '📦' },
];

// Helper: Convert payout to points ($1 = 100 points)
const payoutToPoints = (payout: number): number => Math.round(payout * 100);

// Helper: Render star rating (1-5 stars)
const renderStarRating = (rating: number = 5): JSX.Element => {
  const stars = Math.min(5, Math.max(1, Math.round(rating)));
  return (
    <div className="flex items-center gap-0.5">
      {[...Array(5)].map((_, i) => (
        <span key={i} className={`text-sm ${i < stars ? 'text-yellow-400' : 'text-gray-400'}`}>
          ★
        </span>
      ))}
    </div>
  );
};

// Helper: Get device icon based on targeting
const getDeviceIcon = (device?: string): JSX.Element | null => {
  if (!device) return null;
  const d = device.toLowerCase();
  if (d.includes('android')) return <span title="Android"><Smartphone className="h-4 w-4 text-green-400" /></span>;
  if (d.includes('ios') || d.includes('iphone') || d.includes('ipad')) return <span title="iOS"><Monitor className="h-4 w-4 text-gray-300" /></span>;
  if (d.includes('web') || d.includes('desktop')) return <span title="Web"><Globe className="h-4 w-4 text-blue-400" /></span>;
  return <span title="All Devices"><Globe className="h-4 w-4 text-blue-400" /></span>;
};

// Country flag mapping (comprehensive)
const FLAG_MAP: Record<string, string> = {
  'US': '🇺🇸', 'UK': '🇬🇧', 'GB': '🇬🇧', 'CA': '🇨🇦', 'AU': '🇦🇺', 'DE': '🇩🇪', 
  'FR': '🇫🇷', 'IT': '🇮🇹', 'ES': '🇪🇸', 'BR': '🇧🇷', 'IN': '🇮🇳', 'JP': '🇯🇵',
  'KR': '🇰🇷', 'CN': '🇨🇳', 'NL': '🇳🇱', 'BE': '🇧🇪', 'AT': '🇦🇹', 'CH': '🇨🇭',
  'SE': '🇸🇪', 'NO': '🇳🇴', 'DK': '🇩🇰', 'FI': '🇫🇮', 'PL': '🇵🇱', 'PT': '🇵🇹',
  'IE': '🇮🇪', 'NZ': '🇳🇿', 'MX': '🇲🇽', 'AR': '🇦🇷', 'CL': '🇨�', 'CO': '🇨🇴',
  'TW': '🇹🇼', 'SG': '🇸🇬', 'MY': '🇲🇾', 'TH': '🇹🇭', 'PH': '🇵🇭', 'ID': '🇮🇩',
  'ZA': '🇿🇦', 'AE': '🇦🇪', 'SA': '🇸🇦', 'IL': '🇮🇱', 'TR': '��', 'RU': '��',
  'GR': '🇬�', 'CZ': '🇨🇿', 'HU': '🇭🇺', 'RO': '🇷�', 'UA': '🇺🇦', 'VN': '🇻🇳',
  'PK': '🇵�', 'BD': '🇧🇩', 'EG': '🇪🇬', 'NG': '🇳🇬', 'KE': '🇰🇪', 'PE': '��',
  'VE': '��', 'EC': '🇪�', 'CR': '�🇷', 'PA': '��', 'PR': '🇵🇷', 'DO': '��',
  'HK': '🇭🇰', 'MO': '��', 'LK': '🇱🇰', 'NP': '��', 'MM': '��', 'KH': '�🇭'
};

// Helper: Get country display with flags (show up to 6 flags, then +X more)
const getCountryDisplay = (countries?: string[]): JSX.Element => {
  if (!countries || countries.length === 0) {
    return <span className="text-xs text-gray-400">� Global</span>;
  }
  
  // Show up to 6 flags
  const maxFlags = 6;
  const displayCountries = countries.slice(0, maxFlags);
  const remaining = countries.length - maxFlags;
  
  const flags = displayCountries.map(c => FLAG_MAP[c.toUpperCase()] || c).join(' ');
  
  if (remaining > 0) {
    return (
      <span className="text-xs font-semibold text-purple-300">
        {flags} <span className="text-purple-400">+{remaining}</span>
      </span>
    );
  }
  
  return (
    <span className="text-xs font-semibold text-purple-300">
      {flags}
    </span>
  );
};

// Helper: Extract countries from title (e.g., "Opinion Router - Incent AU, BE, CA, DE")
const extractCountriesFromTitle = (title: string): string[] => {
  const countryCodes = Object.keys(FLAG_MAP);
  const found: string[] = [];
  
  // Split by common delimiters and check each part
  const parts = title.toUpperCase().split(/[\s,\-]+/);
  for (const part of parts) {
    const cleaned = part.trim();
    if (cleaned.length === 2 && countryCodes.includes(cleaned) && !found.includes(cleaned)) {
      found.push(cleaned);
    }
  }
  
  return found;
};

// Helper: Get countries - from offer.countries or extract from title
const getOfferCountries = (offer: Offer): string[] => {
  if (offer.countries && offer.countries.length > 0) {
    return offer.countries;
  }
  // Extract from title if countries array is empty
  return extractCountriesFromTitle(offer.title || '');
};

// Helper: Truncate title with word limit
const truncateTitle = (title: string, maxWords: number = 6): string => {
  const words = title.split(' ');
  if (words.length <= maxWords) return title;
  return words.slice(0, maxWords).join(' ') + '...';
};

// Helper: Get urgency badge
const getUrgencyBadge = (urgencyType?: string): JSX.Element | null => {
  if (!urgencyType) return null;
  const badges: Record<string, { text: string; icon: JSX.Element; color: string }> = {
    'limited_slots': { text: 'Limited slots today', icon: <Timer className="h-3 w-3" />, color: 'bg-red-500/80' },
    'high_demand': { text: 'High demand', icon: <Flame className="h-3 w-3" />, color: 'bg-orange-500/80' },
    'expires_soon': { text: 'Expires soon', icon: <ClockIcon className="h-3 w-3" />, color: 'bg-yellow-500/80' }
  };
  const badge = badges[urgencyType];
  if (!badge) return null;
  return (
    <div className={`absolute top-3 right-3 ${badge.color} backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1`}>
      {badge.icon}
      <span className="text-white text-xs font-bold">{badge.text}</span>
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

      if (diff <= 0) {
        setIsExpired(true);
        return;
      }

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
    <div className="flex items-center gap-1 bg-red-500/90 text-white px-2 py-1 rounded-lg text-xs font-bold">
      <Timer className="h-3 w-3" />
      <span>{String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}</span>
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
  const [error, setError] = useState<string | null>(null);
  const [placementData, setPlacementData] = useState<any>(null);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['all']);
  const [sortBy, setSortBy] = useState<'points_high' | 'points_low' | 'newest' | 'rating'>('points_high');

  // Toggle category selection (multi-select)
  const toggleCategory = (categoryId: string) => {
    if (categoryId === 'all') {
      // If "All" is clicked, reset to only "All"
      setSelectedCategories(['all']);
    } else {
      setSelectedCategories(prev => {
        // Remove 'all' if it was selected
        const withoutAll = prev.filter(c => c !== 'all');
        
        if (withoutAll.includes(categoryId)) {
          // Remove category if already selected
          const newSelection = withoutAll.filter(c => c !== categoryId);
          // If nothing selected, default back to 'all'
          return newSelection.length === 0 ? ['all'] : newSelection;
        } else {
          // Add category
          return [...withoutAll, categoryId];
        }
      });
    }
  };

  useEffect(() => {
    trackImpression();
    loadOffers();
  }, [placementId, userId]);

  // Apply filters whenever offers or filter states change
  useEffect(() => {
    let result = [...offers];

    // Map category names for backward compatibility (all uppercase)
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
      'OTHER': ['OTHER', 'LIFESTYLE', 'ENTERTAINMENT', 'TRAVEL', 'UTILITIES', 'E-COMMERCE', 'ECOMMERCE', 'SHOPPING', 'VIDEO', 'SIGNUP', 'GENERAL']
    };

    // Category filter (multi-select)
    if (!selectedCategories.includes('all')) {
      result = result.filter(offer => {
        const offerCategory = (offer.category || '').toUpperCase();
        return selectedCategories.some(cat => {
          const catUpper = cat.toUpperCase();
          const matchingCategories = categoryMappings[catUpper] || [catUpper];
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

    // Sorting
    result.sort((a, b) => {
      const pointsA = payoutToPoints(a.payout || a.reward_amount || 0);
      const pointsB = payoutToPoints(b.payout || b.reward_amount || 0);
      
      switch (sortBy) {
        case 'points_high':
          return pointsB - pointsA;
        case 'points_low':
          return pointsA - pointsB;
        case 'newest':
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        case 'rating':
          return (b.star_rating || 5) - (a.star_rating || 5);
        default:
          return 0;
      }
    });

    setFilteredOffers(result);
  }, [offers, selectedCategories, searchTerm, sortBy]);

  const trackImpression = async () => {
    try {
      await fetch(`${baseUrl}/api/offerwall/track/impression`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
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

  const loadOffers = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load offers - increased limit to show all offers
      const offersResponse = await fetch(
        `${baseUrl}/api/offerwall/offers?placement_id=${placementId}&user_id=${userId}&limit=10000`
      );
      
      if (!offersResponse.ok) {
        throw new Error('Failed to load offers');
      }

      const offersData = await offersResponse.json();
      
      if (offersData.error) {
        throw new Error(offersData.error);
      }

      setOffers(offersData.offers || []);
      
      // Try to get placement data for branding
      try {
        const placementResponse = await fetch(`${baseUrl}/offerwall?placement_id=${placementId}&user_id=${userId}&api_key=${apiKey}`);
        if (placementResponse.ok) {
          // Extract placement data from the HTML response if needed
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
    }
  };

  const handleOfferClick = async (offer: Offer) => {
    setSelectedOffer(offer);
    setModalOpen(true);
  };

  const getCategoryIcon = (category: string) => {
    const emojis: Record<string, string> = {
      survey: '📋',
      app: '📱',
      game: '🎮',
      video: '🎬',
      shopping: '🛍️',
      signup: '✍️',
      finance: '💰',
      lifestyle: '🌟',
      health: '💪',
      education: '📚',
      entertainment: '🎭',
      travel: '✈️',
      general: '⭐'
    };
    return emojis[category.toLowerCase()] || '⭐';
  };

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'survey': return 'from-blue-500 to-blue-600';
      case 'app': return 'from-green-500 to-green-600';
      case 'shopping': return 'from-purple-500 to-purple-600';
      case 'video': return 'from-orange-500 to-orange-600';
      case 'quiz': return 'from-pink-500 to-pink-600';
      case 'trial': return 'from-indigo-500 to-indigo-600';
      case 'newsletter': return 'from-yellow-500 to-yellow-600';
      case 'game': return 'from-cyan-500 to-cyan-600';
      case 'signup': return 'from-teal-500 to-teal-600';
      case 'finance': return 'from-emerald-500 to-emerald-600';
      case 'lifestyle': return 'from-rose-500 to-rose-600';
      case 'health': return 'from-red-500 to-red-600';
      case 'education': return 'from-violet-500 to-violet-600';
      case 'entertainment': return 'from-fuchsia-500 to-fuchsia-600';
      case 'travel': return 'from-sky-500 to-sky-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-purple-500/30 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-t-purple-500 rounded-full animate-spin"></div>
          </div>
          <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Loading Offers
          </h2>
          <p className="text-purple-300">Finding the best opportunities for you...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full text-center border border-red-500/20">
          <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Unable to Load Offers</h2>
          <p className="text-red-200 mb-6">{error}</p>
          <button
            onClick={loadOffers}
            className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white px-8 py-3 rounded-xl font-semibold transition-all transform hover:scale-105 shadow-lg"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (offers.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full text-center border border-gray-500/20">
          <Gift className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">No Offers Available</h2>
          <p className="text-gray-300 mb-6">Check back soon for new opportunities!</p>
          <button
            onClick={loadOffers}
            className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-8 py-3 rounded-xl font-semibold transition-all transform hover:scale-105 shadow-lg"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl mb-4 shadow-2xl">
            <span className="text-2xl font-black text-white">ML</span>
          </div>
          <h1 className="text-4xl font-black mb-2 bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
            {placementData?.offerwallTitle || 'Earn Rewards'}
          </h1>
          <p className="text-lg text-purple-200 mb-2">Complete tasks & earn instantly!</p>
          <p className="text-sm text-purple-400">Powered by Moustache Leads</p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search offers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/10 backdrop-blur-lg border border-purple-500/30 rounded-xl pl-12 pr-10 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Category Filters (Multi-Select) */}
        <div className="mb-6 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 pb-2 justify-center flex-wrap">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategories.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg scale-105'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20 border border-white/10'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span className="text-sm">{cat.name}</span>
                  {isSelected && cat.id !== 'all' && (
                    <span className="ml-1 text-xs bg-white/20 rounded-full px-1.5">✓</span>
                  )}
                </button>
              );
            })}
          </div>
          {selectedCategories.length > 1 && !selectedCategories.includes('all') && (
            <div className="text-center mt-2">
              <span className="text-purple-300 text-sm">
                {selectedCategories.length} categories selected
              </span>
              <button
                onClick={() => setSelectedCategories(['all'])}
                className="ml-2 text-purple-400 hover:text-purple-300 text-sm underline"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Sort & Results Count */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-lg rounded-full px-4 py-2 border border-purple-500/30">
            <Zap className="h-4 w-4 text-yellow-400" />
            <span className="font-bold text-white">{filteredOffers.length}</span>
            <span className="text-purple-200 text-sm">offers</span>
          </div>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-white/10 backdrop-blur-lg border border-purple-500/30 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="points_high" className="bg-slate-800">Highest Points</option>
            <option value="points_low" className="bg-slate-800">Lowest Points</option>
            <option value="rating" className="bg-slate-800">Best Rated</option>
            <option value="newest" className="bg-slate-800">Newest</option>
          </select>
        </div>

        {/* No Results */}
        {filteredOffers.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-white text-xl font-bold mb-2">No offers found</h3>
            <p className="text-gray-400 mb-4">Try adjusting your search or filters</p>
            <button
              onClick={() => { setSearchTerm(''); setSelectedCategories(['all']); }}
              className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Clear Filters
            </button>
          </div>
        )}

        {/* Offers Grid */}
        {filteredOffers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredOffers.map((offer, index) => {
            // Calculate points from payout ($1 = 100 points)
            const points = payoutToPoints(offer.payout || offer.reward_amount || 0);
            const isLocked = offer.is_locked || (offer.requires_approval && !offer.has_access);
            
            return (
              <div
                key={offer.id}
                className={`group bg-white/10 backdrop-blur-lg rounded-2xl overflow-hidden transition-all duration-300 border border-white/10 animate-slide-up relative ${
                  isLocked 
                    ? 'cursor-not-allowed opacity-90' 
                    : 'hover:bg-white/15 hover:scale-105 hover:shadow-2xl cursor-pointer'
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => !isLocked && handleOfferClick(offer)}
              >
                {/* 🔒 LOCK OVERLAY for locked offers */}
                {isLocked && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 text-center border border-white/20 mx-4">
                      <Lock className="h-12 w-12 text-yellow-400 mx-auto mb-3" />
                      <h4 className="text-white font-bold text-lg mb-2">Offer Locked</h4>
                      <p className="text-gray-300 text-sm mb-3">
                        {offer.lock_reason || 'This offer requires approval'}
                      </p>
                      {offer.estimated_approval_time && (
                        <div className="flex items-center justify-center gap-2 text-yellow-400 text-sm">
                          <ClockIcon className="h-4 w-4" />
                          <span>{offer.estimated_approval_time}</span>
                        </div>
                      )}
                      {offer.request_status === 'pending' && (
                        <div className="mt-3 bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-full text-xs font-semibold">
                          Request Pending
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Offer Image */}
                <div className="relative h-48 overflow-hidden">
                  <img 
                    src={getOfferImage({ image_url: offer.image_url, vertical: offer.category })} 
                    alt={offer.title}
                    className={`w-full h-full object-cover transition-transform duration-300 ${isLocked ? 'blur-sm' : 'group-hover:scale-110'}`}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                  <div className="hidden absolute inset-0 bg-gradient-to-br ${getCategoryColor(offer.category)} flex items-center justify-center ${isLocked ? 'blur-sm' : ''}">
                    <span className="text-6xl">{getCategoryIcon(offer.category)}</span>
                  </div>
                  
                  {/* Category Badge - Top Left */}
                  <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-2 z-10">
                    <span className="text-lg">{getCategoryIcon(offer.category)}</span>
                    <span className="text-white text-xs font-bold uppercase">{offer.category}</span>
                  </div>
                  
                  {/* Lock Badge - Top Right (for locked offers) */}
                  {isLocked ? (
                    <div className="absolute top-3 right-3 bg-yellow-500/90 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-1 z-10">
                      <Lock className="h-3 w-3 text-white" />
                      <span className="text-white text-xs font-bold">LOCKED</span>
                    </div>
                  ) : (
                    /* Urgency Badge OR Timer - Top Right */
                    offer.timer_enabled && offer.timer_end_date ? (
                      <div className="absolute top-3 right-3">
                        <CountdownTimer endDate={offer.timer_end_date} />
                      </div>
                    ) : (
                      getUrgencyBadge(offer.urgency_type)
                    )
                  )}
                </div>

                {/* Content */}
                <div className={`p-5 ${isLocked ? 'blur-[2px]' : ''}`}>
                  {/* Star Rating */}
                  <div className="mb-2">
                    {renderStarRating(offer.star_rating || 5)}
                  </div>
                  
                  {/* Title - Truncated */}
                  <h3 className="font-bold text-white text-lg mb-2 leading-tight">
                    {truncateTitle(offer.title, 6)}
                  </h3>
                  
                  {/* Country & Device Row */}
                  <div className="flex items-center justify-between mb-3">
                    {getCountryDisplay(getOfferCountries(offer))}
                    <div className="flex items-center gap-1">
                      {getDeviceIcon(offer.device_targeting || (offer.devices && offer.devices[0]))}
                    </div>
                  </div>
                  
                  {/* Description - Truncated with ... */}
                  {offer.description && (
                    <p className="text-purple-200 text-sm mb-4 line-clamp-2 leading-relaxed">
                      {offer.description.length > 80 ? offer.description.substring(0, 80) + '...' : offer.description}
                    </p>
                  )}

                  {/* Points Display (not dollars) */}
                  <div className="flex items-center justify-between mb-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl p-3 border border-green-500/30">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-green-400">
                        {points.toLocaleString()}
                      </span>
                      <span className="text-xs text-green-300 font-semibold uppercase">
                        points
                      </span>
                    </div>
                    <Sparkles className="h-5 w-5 text-yellow-400 animate-pulse" />
                  </div>

                  {/* Action Button - "Click to Earn" or "Locked" */}
                  <button 
                    className={`w-full font-bold py-3 px-4 rounded-xl transition-all duration-200 shadow-lg flex items-center justify-center gap-2 ${
                      isLocked 
                        ? 'bg-gray-500/50 text-gray-300 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white transform group-hover:scale-105 hover:shadow-xl'
                    }`}
                    disabled={isLocked}
                  >
                    {isLocked ? (
                      <>
                        <Lock className="h-4 w-4" />
                        <span>Locked</span>
                      </>
                    ) : (
                      <>
                        <span>Click to Earn</span>
                        <ChevronRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        )}

        {/* Footer */}
        <div className="text-center text-purple-300 mt-16 text-sm">
          <p>Complete offers to earn rewards • All offers are provided by trusted partners</p>
        </div>
      </div>

      {/* Offer Modal */}
      {selectedOffer && (
        <OfferModal
          offer={selectedOffer}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
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

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }

        .animate-slide-up {
          animation: slide-up 0.5s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  );
};

export default Offerwall;
