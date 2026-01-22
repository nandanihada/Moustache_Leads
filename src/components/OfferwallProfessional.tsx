import React, { useState, useEffect } from 'react';
import { Search, X, TrendingUp, ChevronRight, Sparkles, Globe, Smartphone, Timer, Flame, Clock } from 'lucide-react';
import { OfferModal } from './OfferModal';

interface Offer {
  id: string;
  title: string;
  description: string;
  reward_amount: number;
  reward_currency: string;
  category: string;
  difficulty: string;
  estimated_time: string;
  image_url: string;
  click_url: string;
  requirements: string[];
  conversion_rate: number;
  countries?: string[];
  devices?: string[];
  device_targeting?: string;
  payout?: number;
  star_rating?: number;
  timer_enabled?: boolean;
  timer_end_date?: string;
  urgency?: {
    type: string;
    message: string;
    expires_at?: string;
    spots_left?: number;
  };
  urgency_type?: string;
  tracking_params: {
    placement_id: string;
    user_id: string;
    timestamp: string;
  };
}

// Helper: Convert payout to points ($1 = 100 points)
const payoutToPoints = (payout: number): number => Math.round(payout * 100);

// Helper: Render star rating (1-5 stars)
const renderStarRating = (rating: number = 5): JSX.Element => {
  const stars = Math.min(5, Math.max(1, Math.round(rating)));
  return (
    <div className="flex items-center gap-0.5">
      {[...Array(5)].map((_, i) => (
        <span key={i} className={`text-sm ${i < stars ? 'text-yellow-400' : 'text-gray-500'}`}>
          ★
        </span>
      ))}
    </div>
  );
};

// Helper: Get device icon
const getDeviceIcon = (device?: string): JSX.Element | null => {
  if (!device) return null;
  const d = device.toLowerCase();
  if (d.includes('android')) return <span title="Android"><Smartphone className="h-4 w-4 text-green-400" /></span>;
  if (d.includes('ios') || d.includes('iphone')) return <span title="iOS"><Smartphone className="h-4 w-4 text-gray-300" /></span>;
  if (d.includes('web') || d.includes('desktop')) return <span title="Web"><Globe className="h-4 w-4 text-blue-400" /></span>;
  return <span title="All Devices"><Globe className="h-4 w-4 text-blue-400" /></span>;
};

// Country flag mapping (comprehensive)
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

// Helper: Extract countries from title (e.g., "Opinion Router - Incent AU, BE, CA, DE")
const extractCountriesFromTitle = (title: string): string[] => {
  const countryCodes = Object.keys(FLAG_MAP);
  const found: string[] = [];
  
  // Split by common delimiters and check each part
  const parts = title.toUpperCase().split(/[\s,\-–—]+/);
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

// Helper: Get country display with flags (show up to 6 flags, then +X more)
const getCountryDisplay = (countries?: string[]): JSX.Element => {
  if (!countries || countries.length === 0) {
    return <span className="text-xs text-gray-500">🌍 Global</span>;
  }
  
  const maxFlags = 6;
  const displayCountries = countries.slice(0, maxFlags);
  const remaining = countries.length - maxFlags;
  
  const flags = displayCountries.map(c => FLAG_MAP[c.toUpperCase()] || c).join(' ');
  
  if (remaining > 0) {
    return (
      <span className="text-xs font-semibold text-blue-400">
        {flags} <span className="text-blue-300">+{remaining}</span>
      </span>
    );
  }
  
  return (
    <span className="text-xs font-semibold text-blue-400">
      {flags}
    </span>
  );
};

// Helper: Remove country codes from title (e.g., "Opinion Router - Incent AU, BE, CA" -> "Opinion Router - Incent")
const cleanTitleFromCountries = (title: string): string => {
  const countryCodes = Object.keys(FLAG_MAP);
  let cleaned = title;
  
  // Remove patterns like "AU, BE, CA, DE" at the end
  cleaned = cleaned.replace(/[\s,\-]+([A-Z]{2}[\s,]*)+$/i, '');
  
  // Remove individual country codes
  countryCodes.forEach(code => {
    const regex = new RegExp(`\\b${code}\\b[,\\s]*`, 'gi');
    cleaned = cleaned.replace(regex, '');
  });
  
  // Clean up extra spaces, dashes, and commas
  cleaned = cleaned.replace(/[\s,\-]+$/, '').replace(/\s+/g, ' ').trim();
  
  return cleaned;
};

// Helper: Truncate title
const truncateTitle = (title: string, maxWords: number = 6): string => {
  const cleanedTitle = cleanTitleFromCountries(title);
  const words = cleanedTitle.split(' ');
  if (words.length <= maxWords) return cleanedTitle;
  return words.slice(0, maxWords).join(' ') + '...';
};

// Helper: Get urgency badge
const getUrgencyBadge = (urgencyType?: string, urgency?: { type: string; message: string }): JSX.Element | null => {
  const type = urgencyType || urgency?.type;
  if (!type) return null;
  const badges: Record<string, { text: string; icon: JSX.Element; color: string }> = {
    'limited_slots': { text: 'Limited slots', icon: <Timer className="h-3 w-3" />, color: 'bg-red-500' },
    'high_demand': { text: 'High demand', icon: <Flame className="h-3 w-3" />, color: 'bg-orange-500' },
    'expires_soon': { text: 'Expires soon', icon: <Clock className="h-3 w-3" />, color: 'bg-yellow-500' }
  };
  const badge = badges[type];
  if (!badge) return null;
  return (
    <div className={`absolute top-3 right-3 ${badge.color} px-2 py-1 rounded-full flex items-center gap-1 animate-pulse`}>
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

interface OfferwallProfessionalProps {
  placementId: string;
  userId: string;
  subId?: string;
  country?: string;
  baseUrl?: string;
}

export const OfferwallProfessional: React.FC<OfferwallProfessionalProps> = ({
  placementId,
  userId,
  subId,
  country,
  baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
}) => {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [filteredOffers, setFilteredOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [todayEarnings, setTodayEarnings] = useState(0);

  const categories = [
    { id: 'all', name: 'All Tasks', icon: '🎯' },
    { id: 'survey', name: 'Surveys', icon: '📋' },
    { id: 'app', name: 'Apps', icon: '📱' },
    { id: 'game', name: 'Games', icon: '🎮' },
    { id: 'video', name: 'Videos', icon: '🎬' },
    { id: 'shopping', name: 'Shopping', icon: '🛍️' },
    { id: 'signup', name: 'Sign Ups', icon: '✍️' },
    { id: 'finance', name: 'Finance', icon: '💰' },
    { id: 'lifestyle', name: 'Lifestyle', icon: '🌟' },
    { id: 'health', name: 'Health', icon: '💪' },
    { id: 'education', name: 'Education', icon: '📚' },
    { id: 'entertainment', name: 'Entertainment', icon: '🎭' },
    { id: 'travel', name: 'Travel', icon: '✈️' },
  ];

  useEffect(() => {
    trackImpression();
    loadOffers();
  }, [placementId, userId]);

  useEffect(() => {
    filterOffers();
  }, [offers, searchTerm, selectedCategory]);

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

  const loadOffers = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${baseUrl}/api/offerwall/offers?placement_id=${placementId}&user_id=${userId}&limit=10000`
      );

      if (!response.ok) throw new Error('Failed to load offers');

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setOffers(data.offers || []);
    } catch (err) {
      console.error('Error loading offers:', err);
      setError(err instanceof Error ? err.message : 'Failed to load offers');
    } finally {
      setLoading(false);
    }
  };

  const filterOffers = () => {
    let filtered = offers;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(offer => 
        offer.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(offer =>
        offer.title.toLowerCase().includes(term) ||
        offer.description.toLowerCase().includes(term)
      );
    }

    setFilteredOffers(filtered);
  };

  const handleOfferClick = (offer: Offer) => {
    setSelectedOffer(offer);
    setModalOpen(true);
  };

  const getDefaultImage = (category: string) => {
    const gradients = {
      survey: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      app: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      game: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      video: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      shopping: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      signup: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
    };
    return gradients[category.toLowerCase() as keyof typeof gradients] || gradients.survey;
  };

  const getCategoryEmoji = (category: string) => {
    const emojis: Record<string, string> = {
      survey: '📋',
      app: '📱',
      game: '🎮',
      video: '🎬',
      shopping: '🛍️',
      signup: '✍️',
      general: '⭐'
    };
    return emojis[category.toLowerCase()] || '⭐';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading amazing offers...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-8 max-w-md text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-white text-xl font-bold mb-2">Oops! Something went wrong</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={loadOffers}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-lg border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-xl font-black text-white">ML</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Earn Rewards</h1>
                <p className="text-sm text-gray-400">Complete tasks & earn instantly</p>
              </div>
            </div>
            <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-lg px-4 py-2">
              <div className="text-xs text-gray-400 uppercase tracking-wide">Today's Points</div>
              <div className="text-2xl font-bold text-green-400">{payoutToPoints(todayEarnings).toLocaleString()}</div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search offers by name or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-12 pr-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

        {/* Category Filters */}
        <div className="border-t border-slate-700/50 bg-slate-800/30">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                      : 'bg-slate-700/50 text-gray-300 hover:bg-slate-700'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span className="text-sm">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Offers Grid */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {filteredOffers.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-white text-xl font-bold mb-2">No offers found</h3>
            <p className="text-gray-400">Try adjusting your search or filters</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="text-gray-400">
                Showing <span className="text-white font-semibold">{filteredOffers.length}</span> offers
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <TrendingUp className="w-4 h-4" />
                <span>Sorted by highest payout</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOffers.map((offer) => {
                const points = payoutToPoints(offer.payout || offer.reward_amount || 0);
                
                return (
                  <div
                    key={offer.id}
                    onClick={() => handleOfferClick(offer)}
                    className="group bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 cursor-pointer"
                  >
                    {/* Image */}
                    <div className="relative h-48 overflow-hidden">
                      {offer.image_url && !offer.image_url.includes('placeholder') ? (
                        <img
                          src={offer.image_url}
                          alt={offer.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center text-6xl"
                          style={{ background: getDefaultImage(offer.category) }}
                        >
                          {getCategoryEmoji(offer.category)}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>
                      
                      {/* Category Badge */}
                      <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium text-white">
                        {getCategoryEmoji(offer.category)} {offer.category}
                      </div>

                      {/* Urgency Badge */}
                      {getUrgencyBadge(offer.urgency_type, offer.urgency)}
                    </div>

                    {/* Content */}
                    <div className="p-5">
                      {/* Star Rating */}
                      <div className="mb-2">
                        {renderStarRating(offer.star_rating || 5)}
                      </div>
                      
                      <h3 className="text-white font-bold text-lg mb-2 group-hover:text-blue-400 transition-colors">
                        {truncateTitle(offer.title, 6)}
                      </h3>
                      
                      {/* Country & Device Row */}
                      <div className="flex items-center justify-between mb-3">
                        {getCountryDisplay(getOfferCountries(offer))}
                        <div className="flex items-center gap-1">
                          {getDeviceIcon(offer.device_targeting || (offer.devices && offer.devices[0]))}
                        </div>
                      </div>
                      
                      <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                        {offer.description && offer.description.length > 80 
                          ? offer.description.substring(0, 80) + '...' 
                          : offer.description}
                      </p>

                      {/* Points Display */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold text-green-400">
                            {points.toLocaleString()}
                          </span>
                          <span className="text-sm text-gray-400 uppercase">
                            points
                          </span>
                        </div>
                      </div>

                      {/* Action Button */}
                      <button className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 group-hover:shadow-lg group-hover:shadow-blue-500/50">
                        <span>Click to Earn</span>
                        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
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
    </div>
  );
};
