import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Loader, Search, Settings, BarChart3, RefreshCw, ChevronDown, Clock, Gift } from 'lucide-react';

interface Offer {
  id: string;
  title: string;
  description: string;
  reward_amount: number;
  reward_currency: string;
  category: string;
  image_url: string;
  click_url: string;
  estimated_time: string;
  expiry_date?: string;
}

interface UserStats {
  total_earned: number;
  today_earned: number;
  offers_clicked: number;
  offers_completed: number;
  offers_pending: number;
  week_clicks: number;
  week_conversions: number;
}

interface OfferwallIframeProps {
  placementId: string;
  userId: string;
  subId?: string;
  country?: string;
}

export const OfferwallIframeEnhanced: React.FC<OfferwallIframeProps> = ({
  placementId,
  userId,
  subId,
  country,
}) => {
  // State Management
  const [allOffers, setAllOffers] = useState<Offer[]>([]);
  const [displayedOffers, setDisplayedOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const sessionRef = useRef<string>('');

  // Filter & Sort State
  const [sortBy, setSortBy] = useState<'latest' | 'oldest' | 'trending' | 'payout_high' | 'payout_low'>('latest');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState('all');

  // UI State
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [userStats, setUserStats] = useState<UserStats>({
    total_earned: 0,
    today_earned: 0,
    offers_clicked: 0,
    offers_completed: 0,
    offers_pending: 0,
    week_clicks: 0,
    week_conversions: 0,
  });

  // Pagination
  const [displayCount, setDisplayCount] = useState(12);
  const BATCH_SIZE = 12;

  // Get Device Info
  const getDeviceInfo = () => {
    const ua = navigator.userAgent;
    let device_type = 'web';
    let browser = 'unknown';
    let os = 'unknown';

    if (/mobile/i.test(ua)) device_type = 'mobile';
    if (/tablet/i.test(ua)) device_type = 'tablet';

    if (/chrome/i.test(ua)) browser = 'chrome';
    else if (/firefox/i.test(ua)) browser = 'firefox';
    else if (/safari/i.test(ua)) browser = 'safari';
    else if (/edge/i.test(ua)) browser = 'edge';

    if (/windows/i.test(ua)) os = 'windows';
    else if (/mac/i.test(ua)) os = 'macos';
    else if (/linux/i.test(ua)) os = 'linux';
    else if (/android/i.test(ua)) os = 'android';
    else if (/iphone|ipad/i.test(ua)) os = 'ios';

    return { device_type, browser, os };
  };

  // Load User Stats
  const loadUserStats = async () => {
    try {
      const params = new URLSearchParams({
        user_id: userId,
        placement_id: placementId,
      });

      let response = await fetch(`/api/offerwall/user/stats?${params}`);
      
      if (!response.ok) {
        console.warn('Relative path failed, trying localhost...');
        response = await fetch(`http://localhost:5000/api/offerwall/user/stats?${params}`);
      }
      
      if (response.ok) {
        const data = await response.json();
        setUserStats(data.stats);
        console.log('📊 User stats loaded:', data.stats);
      }
    } catch (err) {
      console.warn('Failed to load user stats:', err);
    }
  };

  // Initialize Session
  useEffect(() => {
    const initializeSession = async () => {
      try {
        const deviceInfo = getDeviceInfo();
        const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionRef.current = newSessionId;
        setSessionId(newSessionId);

        // Create session on backend
        await fetch('/api/offerwall/session/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: newSessionId,
            placement_id: placementId,
            user_id: userId,
            sub_id: subId,
            device_info: deviceInfo,
            geo_info: { country: country, ip: 'client-ip' },
          }),
        }).catch(err => console.warn('Session creation failed:', err));

        // Track impression
        await fetch('/api/offerwall/track/impression', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: newSessionId,
            placement_id: placementId,
            user_id: userId,
            referrer: document.referrer,
            user_agent: navigator.userAgent,
          }),
        }).catch(err => console.warn('Impression tracking failed:', err));

        // Load offers
        loadOffers();
        
        // Load user stats
        loadUserStats();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize');
        setLoading(false);
      }
    };

    initializeSession();
  }, [placementId, userId, subId, country]);

  // Load Offers
  const loadOffers = async () => {
    try {
      const params = new URLSearchParams({
        placement_id: placementId,
        user_id: userId,
        ...(country && { country }),
      });

      let response = await fetch(`/api/offerwall/offers?${params}`);
      
      if (!response.ok) {
        console.warn('Relative path failed, trying localhost...');
        response = await fetch(`http://localhost:5000/api/offerwall/offers?${params}`);
      }
      
      if (!response.ok) {
        throw new Error(`Failed to load offers: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.offers || data.offers.length === 0) {
        setError('No offers available');
        setLoading(false);
        return;
      }
      
      setAllOffers(data.offers);
      applyFiltersAndSort(data.offers);
      setError(null);
    } catch (err) {
      console.error('Error loading offers:', err);
      setError(err instanceof Error ? err.message : 'Failed to load offers');
    } finally {
      setLoading(false);
    }
  };

  // Apply Filters and Sorting
  const applyFiltersAndSort = (offersToFilter: Offer[]) => {
    let filtered = offersToFilter;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(offer =>
        offer.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        offer.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Category filter
    if (selectedCategory) {
      filtered = filtered.filter(offer => offer.category === selectedCategory);
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'latest':
          return 0; // Keep original order
        case 'oldest':
          return 0; // Reverse original order
        case 'trending':
          return 0; // Could be based on clicks
        case 'payout_high':
          return b.reward_amount - a.reward_amount;
        case 'payout_low':
          return a.reward_amount - b.reward_amount;
        default:
          return 0;
      }
    });

    setDisplayedOffers(sorted);
    setDisplayCount(BATCH_SIZE);
  };

  // Handle Filters Change
  useEffect(() => {
    applyFiltersAndSort(allOffers);
  }, [sortBy, searchQuery, selectedCategory]);

  // Handle Offer Click
  const handleOfferClick = async (offer: Offer) => {
    try {
      await fetch('/api/offerwall/track/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionRef.current,
          offer_id: offer.id,
          placement_id: placementId,
          user_id: userId,
          offer_name: offer.title,
          user_agent: navigator.userAgent,
        }),
      }).catch(err => console.warn('Click tracking failed:', err));

      window.open(offer.click_url, '_blank');
    } catch (err) {
      console.error('Error tracking click:', err);
      window.open(offer.click_url, '_blank');
    }
  };

  // Refresh Offers
  const handleRefresh = () => {
    setLoading(true);
    loadOffers();
  };

  // Load More Offers
  const handleLoadMore = () => {
    setDisplayCount(prev => prev + BATCH_SIZE);
  };

  // Get unique categories
  const categories = Array.from(new Set(allOffers.map(o => o.category)));

  // Get emoji for category
  const getCategoryEmoji = (category: string) => {
    const emojiMap: Record<string, string> = {
      'survey': '📋',
      'app': '📱',
      'game': '🎮',
      'video': '🎬',
      'general': '🎁',
      'install': '⬇️',
      'signup': '📝',
    };
    return emojiMap[category?.toLowerCase()] || '⭐';
  };

  // Loading State
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-gray-600">Loading offers...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error && allOffers.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-red-50 border border-red-200 rounded-lg m-4">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-600" />
          <p className="text-red-800 font-semibold">Error Loading Offerwall</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const visibleOffers = displayedOffers.slice(0, displayCount);
  const hasMoreOffers = displayCount < displayedOffers.length;

  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-blue-50 via-white to-blue-50">
      {/* HEADER */}
      <div className="sticky top-0 z-40 bg-white shadow-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            {/* Logo & Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Gift className="text-white w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-gray-900">Earn Rewards</h1>
                <p className="text-xs text-gray-500">Complete offers and earn coins</p>
              </div>
            </div>

            {/* Earned Today Counter */}
            <div className="text-center bg-gradient-to-r from-emerald-50 to-green-50 px-6 py-3 rounded-xl border border-emerald-200">
              <p className="text-xs text-gray-600 font-semibold">TODAY'S EARNINGS</p>
              <p className="text-2xl font-black text-emerald-600">{userStats.total_earned} 🪙</p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleRefresh}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh offers"
              >
                <RefreshCw className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={() => setShowDeviceSettings(!showDeviceSettings)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Device settings"
              >
                <Settings className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={() => setShowActivityModal(!showActivityModal)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Activity & tracking"
              >
                <BarChart3 className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search offers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* FILTERS & SORTING */}
      <div className="bg-white border-b border-gray-200 sticky top-20 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex gap-3 overflow-x-auto pb-2">
            {/* Sort Options */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <option value="latest">Latest</option>
              <option value="oldest">Oldest</option>
              <option value="trending">Trending</option>
              <option value="payout_high">High Payout</option>
              <option value="payout_low">Low Payout</option>
            </select>

            {/* Category Tabs */}
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {getCategoryEmoji(cat)} {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* DEVICE SETTINGS MODAL */}
      {showDeviceSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Device Settings</h3>
            <div className="space-y-3">
              {['all', 'android', 'ios', 'desktop'].map(device => (
                <label key={device} className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="device"
                    value={device}
                    checked={selectedDevice === device}
                    onChange={(e) => setSelectedDevice(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="ml-3 capitalize font-medium text-gray-700">{device}</span>
                </label>
              ))}
            </div>
            <button
              onClick={() => setShowDeviceSettings(false)}
              className="w-full mt-4 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ACTIVITY MODAL */}
      {showActivityModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-6">📊 Your Activity</h3>
            
            {/* Main Stats */}
            <div className="space-y-4 mb-6">
              {/* Total Earned */}
              <div className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg border-2 border-emerald-200">
                <p className="text-xs text-gray-600 font-semibold mb-1">TOTAL EARNED</p>
                <p className="text-3xl font-black text-emerald-600">{userStats.total_earned || 0} 🪙</p>
              </div>

              {/* Today's Earnings */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border-2 border-blue-200">
                <p className="text-xs text-gray-600 font-semibold mb-1">TODAY'S EARNINGS</p>
                <p className="text-2xl font-bold text-blue-600">{userStats.today_earned || 0} 🪙</p>
              </div>
            </div>

            {/* Activity Grid */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-xs text-gray-600 font-semibold mb-2">CLICKED</p>
                <p className="text-2xl font-bold text-green-600">{userStats.offers_clicked || 0}</p>
                <p className="text-xs text-gray-500 mt-1">offers</p>
              </div>
              
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-xs text-gray-600 font-semibold mb-2">COMPLETED</p>
                <p className="text-2xl font-bold text-purple-600">{userStats.offers_completed || 0}</p>
                <p className="text-xs text-gray-500 mt-1">offers</p>
              </div>
              
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                <p className="text-xs text-gray-600 font-semibold mb-2">PENDING</p>
                <p className="text-2xl font-bold text-orange-600">{userStats.offers_pending || 0}</p>
                <p className="text-xs text-gray-500 mt-1">offers</p>
              </div>
              
              <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                <p className="text-xs text-gray-600 font-semibold mb-2">THIS WEEK</p>
                <p className="text-2xl font-bold text-indigo-600">{(userStats.week_clicks || 0) + (userStats.week_conversions || 0)}</p>
                <p className="text-xs text-gray-500 mt-1">activities</p>
              </div>
            </div>

            {/* Info Message */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
              <p className="text-xs text-blue-800">
                <strong>💡 Tip:</strong> Keep completing offers to earn more rewards! Your stats update in real-time.
              </p>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setShowActivityModal(false)}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 rounded-lg font-bold hover:from-blue-700 hover:to-cyan-700 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* OFFERS GRID */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {visibleOffers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 font-semibold">No offers found</p>
            <p className="text-gray-500 text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {visibleOffers.map((offer) => (
                <div
                  key={offer.id}
                  className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden cursor-pointer transform hover:scale-105 border border-gray-100"
                  onClick={() => handleOfferClick(offer)}
                >
                  {/* Image Container */}
                  <div className="relative w-full h-48 bg-gradient-to-br from-blue-300 via-purple-300 to-pink-300 overflow-hidden flex items-center justify-center">
                    {offer.image_url && !offer.image_url.includes('placeholder') ? (
                      <img
                        src={offer.image_url}
                        alt={offer.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : null}
                    
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 opacity-90">
                      <div className="text-5xl mb-2">{getCategoryEmoji(offer.category)}</div>
                      <p className="text-white font-bold text-center px-4 text-sm">{offer.title}</p>
                    </div>

                    {/* Category Badge */}
                    <div className="absolute top-4 right-4 bg-gradient-to-r from-orange-500 to-red-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg z-10">
                      {offer.category.toUpperCase()}
                    </div>

                    {/* Timer Badge */}
                    {offer.expiry_date && (
                      <div className="absolute bottom-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg">
                        <Clock className="w-3 h-3" />
                        Limited
                      </div>
                    )}
                  </div>

                  {/* Content Section */}
                  <div className="p-5">
                    {/* Title */}
                    <h3 className="font-bold text-gray-900 text-lg mb-2 line-clamp-2">
                      {offer.title}
                    </h3>

                    {/* Description */}
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                      {offer.description}
                    </p>

                    {/* Reward Section */}
                    <div className="bg-gradient-to-r from-emerald-400 to-green-500 rounded-xl p-4 mb-4 text-white shadow-md">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold opacity-90 mb-1">REWARD</p>
                          <p className="text-3xl font-black">{offer.reward_amount}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold opacity-90">{offer.reward_currency}</p>
                          <p className="text-2xl mt-1">💰</p>
                        </div>
                      </div>
                    </div>

                    {/* Meta Info */}
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-4 pb-4 border-b border-gray-200">
                      <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold">
                        {offer.category}
                      </span>
                      <span className="font-semibold">⏱️ {offer.estimated_time}</span>
                    </div>

                    {/* CTA Button */}
                    <button className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold py-3 px-4 rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all duration-200 shadow-lg hover:shadow-xl active:scale-95 text-lg">
                      Start Offer
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Load More Button */}
            {hasMoreOffers && (
              <div className="text-center">
                <button
                  onClick={handleLoadMore}
                  className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
                >
                  Load More Offers
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default OfferwallIframeEnhanced;
