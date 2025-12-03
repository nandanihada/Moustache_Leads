import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Loader, Search, Settings, BarChart3, RefreshCw, ChevronDown, Clock, TrendingUp, CheckCircle2, Zap, Award } from 'lucide-react';

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
  completed_offers?: string[];
}

interface OfferwallProfessionalProps {
  placementId: string;
  userId: string;
  subId?: string;
  country?: string;
}

// Determine the correct API base URL
const getApiBaseUrl = (): string => {
  // Check if we're in development (localhost)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  }
  
  // For production, use the same domain as the frontend
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  
  // If on theinterwebsite.space, use api.theinterwebsite.space
  if (hostname.includes('theinterwebsite.space')) {
    return `${protocol}//api.theinterwebsite.space`;
  }
  
  // Default fallback
  return `${protocol}//${hostname}`;
};

const API_BASE_URL = getApiBaseUrl();

// Log the API URL being used
console.log('🌐 OFFERWALL API Configuration:');
console.log('🌐 Hostname:', window.location.hostname);
console.log('🌐 Protocol:', window.location.protocol);
console.log('🌐 API Base URL:', API_BASE_URL);

export const OfferwallProfessional: React.FC<OfferwallProfessionalProps> = ({
  placementId,
  userId,
  subId = '',
  country = '',
}) => {
  const [allOffers, setAllOffers] = useState<Offer[]>([]);
  const [displayedOffers, setDisplayedOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const sessionRef = useRef<string>('');

  const [sortBy, setSortBy] = useState<'latest' | 'oldest' | 'trending' | 'payout_high' | 'payout_low'>('payout_high');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState('all');

  const [showActivityModal, setShowActivityModal] = useState(false);
  const [userActivities, setUserActivities] = useState<any[]>([]);
  const [userClicks, setUserClicks] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);
  const [userStats, setUserStats] = useState<UserStats>({
    total_earned: 0,
    today_earned: 0,
    offers_clicked: 0,
    offers_completed: 0,
    offers_pending: 0,
    week_clicks: 0,
    week_conversions: 0,
    completed_offers: [],
  });

  const [displayCount, setDisplayCount] = useState(12);
  const BATCH_SIZE = 12;
  
  const [selectedOfferForModal, setSelectedOfferForModal] = useState<Offer | null>(null);

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

  const loadUserStats = async () => {
    try {
      const params = new URLSearchParams({
        user_id: userId,
        placement_id: placementId,
      });

      const response = await fetch(`${API_BASE_URL}/api/offerwall/user/stats?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        setUserStats(data.stats);
        console.log('📊 User stats loaded:', data.stats);
      }
    } catch (err) {
      console.warn('Failed to load user stats:', err);
    }
  };

  const loadUserActivity = async () => {
    setActivityLoading(true);
    console.log('🔄 Loading user activity for:', { userId, placementId });
    console.log('🔄 Current userId value:', userId);
    console.log('🔄 Current placementId value:', placementId);
    try {
      const params = new URLSearchParams({
        user_id: userId,
        placement_id: placementId,
        limit: '50'
      });

      const apiUrl = `${API_BASE_URL}/api/offerwall/user/clicks?${params}`;
      console.log('📡 Fetching from:', apiUrl);
      console.log('📡 API Base URL:', API_BASE_URL);
      console.log('📡 Query params:', { user_id: userId, placement_id: placementId });
      
      // Load click history
      const clickResponse = await fetch(apiUrl);
      console.log('📡 Click response status:', clickResponse.status);
      
      if (clickResponse.ok) {
        const clickData = await clickResponse.json();
        console.log('📊 Full click response:', clickData);
        console.log('📊 Clicks array:', clickData?.clicks);
        
        // Log each click to see structure
        if (clickData?.clicks && clickData.clicks.length > 0) {
          console.log('📊 First click structure:', JSON.stringify(clickData.clicks[0], null, 2));
          clickData.clicks.forEach((click, idx) => {
            console.log(`📊 Click ${idx + 1}:`, {
              offer_id: click.offer_id,
              offer_name: click.offer_name,
              clicked_ago: click.clicked_ago,
              timestamp: click.timestamp,
              created_at: click.created_at
            });
          });
        }
        
        setUserClicks(clickData.clicks || []);
        console.log('✅ Clicks set in state:', clickData?.clicks?.length || 0);
      } else {
        console.error('❌ Click response not ok:', clickResponse.status, clickResponse.statusText);
        const errorText = await clickResponse.text();
        console.error('❌ Error:', errorText);
      }

      // Load completed offers
      const activityUrl = `${API_BASE_URL}/api/offerwall/user/activity?${params}`;
      const activityResponse = await fetch(activityUrl);
      
      if (activityResponse.ok) {
        const activityData = await activityResponse.json();
        setUserActivities(activityData.activities || []);
        console.log('📊 Activities loaded:', activityData?.activities?.length || 0);
      }
    } catch (err) {
      console.error('❌ Failed to load user activity:', err);
    } finally {
      setActivityLoading(false);
    }
  };

  useEffect(() => {
    // Add global click listener to catch all offer clicks
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const offerCard = target.closest('[data-offer-id]');
      if (offerCard) {
        const offerId = offerCard.getAttribute('data-offer-id');
        const offer = allOffers.find(o => o.id === offerId);
        if (offer && !isOfferCompleted(offerId)) {
          console.log('🔍 GLOBAL: Caught offer click via event delegation', offerId);
          e.preventDefault();
          e.stopPropagation();
          handleOfferClick(offer);
        }
      }
    };

    document.addEventListener('click', handleGlobalClick, true);
    
    const initializeSession = async () => {
      try {
        const deviceInfo = getDeviceInfo();
        const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionRef.current = newSessionId;
        setSessionId(newSessionId);

        console.log('🔍 Creating session for user:', userId, 'placement:', placementId);
        
        const sessionResponse = await fetch(`${API_BASE_URL}/api/offerwall/session/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            placement_id: placementId,
            user_id: userId,
            sub_id: subId,
            device_info: deviceInfo,
            geo_info: { country: country, ip: 'client-ip' },
          }),
        });
        
        const sessionData = await sessionResponse.json();
        console.log('🔍 Session response:', sessionData);
        
        if (sessionData.success && sessionData.session_id) {
          sessionRef.current = sessionData.session_id;
          setSessionId(sessionData.session_id);
          console.log('✅ Session created successfully:', sessionData.session_id);
        } else {
          console.error('❌ Session creation failed:', sessionData);
        }

        await fetch(`${API_BASE_URL}/api/offerwall/track/impression`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionRef.current,
            placement_id: placementId,
            user_id: userId,
            referrer: document.referrer,
            user_agent: navigator.userAgent,
          }),
        }).catch(err => console.warn('Impression tracking failed:', err));

        loadOffers();
        loadUserStats();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize');
        setLoading(false);
      }
    };

    initializeSession();
    
    // Refresh stats every 5 seconds
    const statsInterval = setInterval(loadUserStats, 5000);
    
    // Cleanup
    return () => {
      clearInterval(statsInterval);
      document.removeEventListener('click', handleGlobalClick, true);
    };
  }, [placementId, userId, subId, country]);

  const loadOffers = async () => {
    try {
      const params = new URLSearchParams({
        placement_id: placementId,
        user_id: userId,
        ...(country && { country }),
      });

      console.log('📥 Loading offers with params:', { placementId, userId, country });
      console.log('📥 API Base URL:', API_BASE_URL);
      
      const response = await fetch(`${API_BASE_URL}/api/offerwall/offers?${params}`);
      
      console.log('📥 Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`Failed to load offers: ${response.status}`);
      }

      const data = await response.json();
      console.log('📥 Offers received from API:', data.offers?.length || 0);
      console.log('📥 Full response:', data);
      
      if (!data.offers || data.offers.length === 0) {
        setError('No offers available');
        setLoading(false);
        return;
      }
      
      console.log('✅ Setting all offers:', data.offers.length);
      setAllOffers(data.offers);
      applyFiltersAndSort(data.offers);
      setError(null);
    } catch (err) {
      console.error('❌ Error loading offers:', err);
      setError(err instanceof Error ? err.message : 'Failed to load offers');
    } finally {
      setLoading(false);
    }
  };

  const applyFiltersAndSort = (offersToFilter: Offer[]) => {
    console.log('🔄 Applying filters and sort to:', offersToFilter.length, 'offers');
    console.log('🔍 Filters - searchQuery:', searchQuery, 'selectedCategory:', selectedCategory);
    
    let filtered = offersToFilter;

    if (searchQuery) {
      filtered = filtered.filter(offer =>
        offer.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        offer.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
      console.log('🔍 After search filter:', filtered.length, 'offers');
    }

    if (selectedCategory) {
      filtered = filtered.filter(offer => offer.category === selectedCategory);
      console.log('🔍 After category filter:', filtered.length, 'offers');
    }

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'payout_high':
          return b.reward_amount - a.reward_amount;
        case 'payout_low':
          return a.reward_amount - b.reward_amount;
        default:
          return 0;
      }
    });

    console.log('✅ Final sorted offers:', sorted.length);
    setDisplayedOffers(sorted);
    setDisplayCount(BATCH_SIZE);
  };

  useEffect(() => {
    applyFiltersAndSort(allOffers);
  }, [sortBy, searchQuery, selectedCategory]);

  const trackClickLocally = async (offer: Offer) => {
    console.log('🚀 LOCAL CLICK TRACKING STARTED');
    console.log('🚀 Session ID:', sessionRef.current);
    console.log('🚀 User ID:', userId);
    console.log('🚀 Placement ID:', placementId);
    
    try {
      // Detect device info
      const deviceType = /mobile|android|iphone|ipad|tablet/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
      const browser = navigator.userAgent.includes('Chrome') ? 'Chrome' : 
                      navigator.userAgent.includes('Firefox') ? 'Firefox' :
                      navigator.userAgent.includes('Safari') ? 'Safari' : 'Other';
      const os = navigator.userAgent.includes('Windows') ? 'Windows' :
                 navigator.userAgent.includes('Mac') ? 'MacOS' :
                 navigator.userAgent.includes('Linux') ? 'Linux' : 'Other';
      
      const clickData = {
        session_id: sessionRef.current,
        user_id: userId,
        placement_id: placementId,
        offer_id: offer.id,
        offer_name: offer.title,
        device_type: deviceType,
        browser: browser,
        os: os
      };
      
      console.log('📤 Sending click data:', clickData);
      console.log('📤 API URL:', `${API_BASE_URL}/api/offerwall/track/click`);
      
      try {
        const localResponse = await fetch(`${API_BASE_URL}/api/offerwall/track/click`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(clickData),
        });
        
        console.log('📤 Local API Response status:', localResponse.status, localResponse.statusText);
        
        if (localResponse.ok) {
          const result = await localResponse.json();
          console.log('✅ LOCAL Click tracked successfully:', result);
          console.log('✅ LOCAL Click ID:', result.click_id);
          
          // Store click ID for later conversion tracking
          localStorage.setItem(`click_${offer.id}`, result.click_id);
          localStorage.setItem(`session_${offer.id}`, sessionRef.current);
          console.log('💾 Stored click ID for conversion tracking');
          
          // Refresh activity data after a short delay
          console.log('⏳ Scheduling activity refresh in 1.5 seconds...');
          setTimeout(() => {
            console.log('🔄 Refreshing activity after click...');
            loadUserActivity();
          }, 1500);
          
          return result.click_id;
        } else {
          console.error('❌ LOCAL Click tracking failed:', localResponse.status, localResponse.statusText);
          const errorText = await localResponse.text();
          console.error('❌ LOCAL Error details:', errorText);
          return null;
        }
      } catch (fetchErr) {
        console.error('❌ Fetch error during click tracking:', fetchErr);
        throw fetchErr;
      }

    } catch (err) {
      console.error('❌ Error tracking LOCAL click:', err);
      console.error('❌ Error stack:', err instanceof Error ? err.stack : 'No stack trace');
      return null;
    }
    
    console.log('🚀 LOCAL CLICK TRACKING FINISHED');
  };

  // Track conversion when offer is completed
  const trackConversionLocally = async (offer: Offer, clickId: string) => {
    console.log('🎉 TRACKING CONVERSION...');
    
    try {
      const conversionData = {
        session_id: sessionRef.current,
        click_id: clickId,
        user_id: userId,
        offer_id: offer.id,
        offer_name: offer.title,
        placement_id: placementId,
        payout_amount: offer.reward_amount,
        transaction_id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        source_platform: 'internal'
      };
      
      console.log('📤 Sending conversion data:', conversionData);
      
      const response = await fetch(`${API_BASE_URL}/api/offerwall/track/conversion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conversionData),
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ CONVERSION TRACKED:', result.conversion_id);
        
        // Clear stored click ID
        localStorage.removeItem(`click_${offer.id}`);
        localStorage.removeItem(`session_${offer.id}`);
        
        // Refresh stats and activity
        setTimeout(() => {
          console.log('🔄 Refreshing stats after conversion...');
          loadUserStats();
          loadUserActivity();
        }, 1000);
        
        return result.conversion_id;
      } else {
        console.error('❌ Conversion tracking failed:', response.status);
        const errorText = await response.text();
        console.error('❌ Error details:', errorText);
        return null;
      }
    } catch (err) {
      console.error('❌ Error tracking conversion:', err);
      return null;
    }
  };

  const handleOfferClick = async (offer: Offer) => {
    console.log('🎯 Offer clicked, showing details modal:', offer.id);
    setSelectedOfferForModal(offer);
  };

  const handleRefresh = () => {
    setLoading(true);
    loadOffers();
    loadUserStats();
  };

  const handleLoadMore = () => {
    setDisplayCount(prev => prev + BATCH_SIZE);
  };

  const categories = Array.from(new Set(allOffers.map(o => o.category)));

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

  const isOfferCompleted = (offerId: string) => {
    return userStats?.completed_offers?.includes(offerId) || false;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <Loader className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-400" />
          <p className="text-gray-300 text-lg font-medium">Loading offers...</p>
        </div>
      </div>
    );
  }

  if (error && allOffers.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-400" />
          <p className="text-red-300 font-semibold text-lg">Error Loading Offerwall</p>
          <p className="text-red-400 text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  const visibleOffers = displayedOffers.slice(0, displayCount);
  const hasMoreOffers = displayCount < displayedOffers.length;
  
  console.log('📊 Render state:', {
    allOffers: allOffers.length,
    displayedOffers: displayedOffers.length,
    displayCount,
    visibleOffers: visibleOffers.length,
    hasMoreOffers
  });

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* HEADER */}
      <div className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-700/50 shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            {/* Logo & Title */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
                <Zap className="text-white w-7 h-7" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-white">Earn Rewards</h1>
                <p className="text-xs text-gray-400 font-medium">Complete tasks and earn instantly</p>
              </div>
            </div>

            {/* Earned Today Counter */}
            <div className="text-center bg-gradient-to-r from-emerald-900/40 to-green-900/40 px-8 py-4 rounded-xl border border-emerald-500/30 backdrop-blur">
              <p className="text-xs text-gray-400 font-bold tracking-wider">TODAY'S EARNINGS</p>
              <p className="text-3xl font-black text-emerald-400 mt-1">{userStats?.today_earned || 0}</p>
              <p className="text-xs text-gray-500 mt-1">coins earned</p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleRefresh}
                className="p-3 hover:bg-slate-700/50 rounded-lg transition-all duration-200 text-gray-400 hover:text-blue-400"
                title="Refresh offers"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowDeviceSettings(!showDeviceSettings)}
                className="p-3 hover:bg-slate-700/50 rounded-lg transition-all duration-200 text-gray-400 hover:text-blue-400"
                title="Device settings"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  setShowActivityModal(!showActivityModal);
                  if (!showActivityModal) {
                    loadUserActivity();
                  }
                }}
                className="p-3 hover:bg-slate-700/50 rounded-lg transition-all duration-200 text-gray-400 hover:text-blue-400"
                title="Activity & tracking"
              >
                <BarChart3 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search offers by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-500 transition-all"
            />
          </div>
        </div>
      </div>

      {/* FILTERS & SORTING */}
      <div className="bg-slate-800/50 border-b border-slate-700/50 sticky top-20 z-30 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex gap-3 overflow-x-auto pb-2">
            {/* Sort Options */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-sm font-semibold text-gray-200 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            >
              <option value="payout_high">💰 Highest Payout</option>
              <option value="payout_low">💵 Lowest Payout</option>
              <option value="latest">🆕 Latest</option>
              <option value="trending">🔥 Trending</option>
            </select>

            {/* Category Tabs */}
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                selectedCategory === null
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-slate-700/50 text-gray-300 hover:bg-slate-700'
              }`}
            >
              All Tasks
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-slate-700/50 text-gray-300 hover:bg-slate-700'
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
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl p-8 max-w-sm w-full border border-slate-700 shadow-2xl">
            <h3 className="text-2xl font-bold text-white mb-6">Device Settings</h3>
            <div className="space-y-3">
              {['all', 'android', 'ios', 'desktop'].map(device => (
                <label key={device} className="flex items-center p-4 border border-slate-700 rounded-lg cursor-pointer hover:bg-slate-700/50 transition-all">
                  <input
                    type="radio"
                    name="device"
                    value={device}
                    checked={selectedDevice === device}
                    onChange={(e) => setSelectedDevice(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="ml-3 capitalize font-semibold text-gray-200">{device === 'all' ? 'All Devices' : device}</span>
                </label>
              ))}
            </div>
            <button
              onClick={() => setShowDeviceSettings(false)}
              className="w-full mt-6 bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 rounded-lg font-bold hover:from-blue-700 hover:to-cyan-700 transition-all"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* OFFER DETAILS MODAL */}
      {selectedOfferForModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl max-w-2xl w-full border border-slate-700 shadow-2xl overflow-hidden">
            {/* Image Section */}
            <div className="relative w-full h-64 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 overflow-hidden flex items-center justify-center">
              {selectedOfferForModal.image_url && !selectedOfferForModal.image_url.includes('placeholder') ? (
                <img
                  src={selectedOfferForModal.image_url}
                  alt={selectedOfferForModal.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : null}
              
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-blue-600/90 via-purple-600/90 to-pink-600/90">
                <div className="text-7xl mb-3">{getCategoryEmoji(selectedOfferForModal.category)}</div>
                <p className="text-white font-bold text-center px-4">{selectedOfferForModal.title}</p>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setSelectedOfferForModal(null)}
                className="absolute top-4 right-4 bg-slate-900/80 text-white p-2 rounded-lg hover:bg-slate-900 transition-all z-10"
              >
                ✕
              </button>
            </div>

            {/* Content Section */}
            <div className="p-8 max-h-[60vh] overflow-y-auto">
              {/* Title */}
              <h2 className="text-3xl font-black text-white mb-3">
                {selectedOfferForModal.title}
              </h2>

              {/* Description */}
              <p className="text-gray-300 text-lg mb-6 leading-relaxed">
                {selectedOfferForModal.description}
              </p>

              {/* Reward Section */}
              <div className="bg-gradient-to-r from-emerald-600 to-green-600 rounded-xl p-6 mb-6 text-white shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold opacity-90 mb-2">YOU WILL EARN</p>
                    <p className="text-5xl font-black">{selectedOfferForModal.reward_amount}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold opacity-90">{selectedOfferForModal.reward_currency}</p>
                    <p className="text-4xl mt-2">💰</p>
                  </div>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                  <p className="text-xs text-gray-400 font-bold mb-1">CATEGORY</p>
                  <p className="text-lg font-bold text-gray-200">{selectedOfferForModal.category.toUpperCase()}</p>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                  <p className="text-xs text-gray-400 font-bold mb-1">TIME REQUIRED</p>
                  <p className="text-lg font-bold text-gray-200">{selectedOfferForModal.estimated_time}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    console.log('🎬 START OFFER NOW BUTTON CLICKED');
                    try {
                      console.log('🎬 Calling trackClickLocally...');
                      const clickId = await trackClickLocally(selectedOfferForModal);
                      console.log('🎬 trackClickLocally completed, clickId:', clickId);
                      
                      // Add a small delay to ensure tracking is complete
                      await new Promise(resolve => setTimeout(resolve, 500));
                      
                      console.log('🎬 Opening offer URL:', selectedOfferForModal.click_url);
                      window.open(selectedOfferForModal.click_url, '_blank');
                      
                      // Don't close modal yet - let user mark as completed
                    } catch (err) {
                      console.error('🎬 Error in button click handler:', err);
                    }
                  }}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-4 rounded-xl font-bold hover:from-blue-700 hover:to-cyan-700 transition-all text-lg shadow-lg"
                >
                  🚀 Start Offer Now
                </button>
                <button
                  onClick={async () => {
                    console.log('✅ MARK AS COMPLETED BUTTON CLICKED');
                    try {
                      const clickId = localStorage.getItem(`click_${selectedOfferForModal.id}`);
                      if (clickId) {
                        console.log('✅ Found stored click ID:', clickId);
                        await trackConversionLocally(selectedOfferForModal, clickId);
                        setSelectedOfferForModal(null);
                      } else {
                        console.warn('⚠️ No click ID found - please click "Start Offer Now" first');
                        alert('Please click "Start Offer Now" first to track the click');
                      }
                    } catch (err) {
                      console.error('❌ Error marking as completed:', err);
                    }
                  }}
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 rounded-xl font-bold hover:from-green-700 hover:to-emerald-700 transition-all text-lg shadow-lg"
                >
                  ✅ Mark as Completed
                </button>
                <button
                  onClick={() => setSelectedOfferForModal(null)}
                  className="flex-1 bg-slate-700 text-white py-4 rounded-xl font-bold hover:bg-slate-600 transition-all text-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVITY MODAL */}
      {showActivityModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl p-8 max-w-4xl w-full border border-slate-700 shadow-2xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-blue-400" />
              Your Activity Tracking
            </h3>
            
            {/* Main Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-gradient-to-br from-emerald-900/40 to-green-900/40 rounded-lg border border-emerald-500/30">
                <p className="text-xs text-gray-400 font-bold mb-1">TOTAL EARNED</p>
                <p className="text-2xl font-black text-emerald-400">{userStats?.total_earned || 0}</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-blue-900/40 to-cyan-900/40 rounded-lg border border-blue-500/30">
                <p className="text-xs text-gray-400 font-bold mb-1">CLICKS</p>
                <p className="text-2xl font-black text-blue-400">{userClicks.length}</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-purple-900/40 to-pink-900/40 rounded-lg border border-purple-500/30">
                <p className="text-xs text-gray-400 font-bold mb-1">COMPLETED</p>
                <p className="text-2xl font-black text-purple-400">{userActivities.length}</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-orange-900/40 to-red-900/40 rounded-lg border border-orange-500/30">
                <p className="text-xs text-gray-400 font-bold mb-1">TODAY</p>
                <p className="text-2xl font-black text-orange-400">{userStats?.today_earned || 0}</p>
              </div>
            </div>

            {activityLoading ? (
              <div className="text-center py-8">
                <Loader className="w-8 h-8 mx-auto mb-3 text-blue-400 animate-spin" />
                <p className="text-gray-400">Loading your activity...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Recent Clicks */}
                <div>
                  <h4 className="text-lg font-bold text-gray-300 mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-400" />
                    Recent Clicks ({userClicks.length})
                  </h4>
                  {userClicks.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {userClicks.map((click, idx) => {
                        const offer = allOffers.find(o => o.id === click.offer_id);
                        return (
                          <div key={idx} className="p-3 bg-slate-700/50 rounded-lg border border-slate-600 flex items-center gap-3">
                            <div className="w-2 h-2 bg-blue-400 rounded-full flex-shrink-0"></div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-200 truncate">
                                {offer?.title || `Offer ${click.offer_id}`}
                              </p>
                              <p className="text-xs text-gray-400">
                                {click.clicked_ago || 'Just now'} • {click.user_agent?.split(' ')[0] || 'Unknown device'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Clicked</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-500">
                      <p>No clicks yet. Start clicking offers to see your activity!</p>
                    </div>
                  )}
                </div>

                {/* Completed Offers */}
                <div>
                  <h4 className="text-lg font-bold text-gray-300 mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                    Completed Offers ({userActivities.length})
                  </h4>
                  {userActivities.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {userActivities.map((activity, idx) => {
                        const offer = allOffers.find(o => o.id === activity.offer_id);
                        return (
                          <div key={idx} className="p-3 bg-slate-700/50 rounded-lg border border-green-500/30 flex items-center gap-3">
                            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-200 truncate">
                                {offer?.title || `Offer ${activity.offer_id}`}
                              </p>
                              <p className="text-xs text-gray-400">
                                {activity.completed_ago || 'Just now'} • +{activity.reward_amount} coins earned
                              </p>
                              {activity.completion_details?.transaction_id && (
                                <p className="text-xs text-gray-500">
                                  Transaction: {activity.completion_details.transaction_id}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-green-400">+{activity.reward_amount}</p>
                              <p className="text-xs text-gray-500">Completed</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-500">
                      <p>No completed offers yet. Complete offers to see your earnings!</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => loadUserActivity()}
                className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 rounded-lg font-bold hover:from-blue-700 hover:to-cyan-700 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              <button
                onClick={() => setShowActivityModal(false)}
                className="flex-1 bg-slate-700 text-white py-3 rounded-lg font-bold hover:bg-slate-600 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OFFERS GRID */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {visibleOffers.length === 0 ? (
          <div className="text-center py-20">
            <TrendingUp className="w-16 h-16 mx-auto mb-4 text-gray-500" />
            <p className="text-gray-400 font-semibold text-lg">No offers found</p>
            <p className="text-gray-500 text-sm mt-2">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {visibleOffers.map((offer) => {
                const isCompleted = isOfferCompleted(offer.id);
                return (
                  <div
                    key={offer.id}
                    data-offer-id={offer.id}
                    className={`relative bg-slate-800/50 rounded-2xl border transition-all duration-300 overflow-hidden cursor-pointer group ${
                      isCompleted
                        ? 'border-green-500/50 opacity-75'
                        : 'border-slate-700 hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-500/20'
                    }`}
                    onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🔍 OFFER CARD CLICKED!', offer.id);
                    if (!isCompleted) {
                      handleOfferClick(offer);
                    }
                  }}
                  >
                    {/* Completed Badge */}
                    {isCompleted && (
                      <div className="absolute top-4 right-4 z-10 bg-green-500/90 text-white px-4 py-2 rounded-full flex items-center gap-2 font-bold text-sm">
                        <CheckCircle2 className="w-4 h-4" />
                        Completed
                      </div>
                    )}

                    {/* Image Container */}
                    <div className={`relative w-full h-48 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 overflow-hidden flex items-center justify-center ${isCompleted ? 'opacity-50' : 'group-hover:scale-105 transition-transform duration-300'}`}>
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
                      
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-blue-600/90 via-purple-600/90 to-pink-600/90">
                        <div className="text-6xl mb-2">{getCategoryEmoji(offer.category)}</div>
                        <p className="text-white font-bold text-center px-4 text-sm">{offer.title}</p>
                      </div>

                      {/* Category Badge */}
                      <div className="absolute top-4 left-4 bg-slate-900/80 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur">
                        {offer.category}
                      </div>

                      {/* Timer Badge */}
                      {offer.expiry_date && (
                        <div className="absolute bottom-4 right-4 bg-red-500/90 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 backdrop-blur">
                          <Clock className="w-3 h-3" />
                          Limited
                        </div>
                      )}
                    </div>

                    {/* Content Section */}
                    <div className="p-6">
                      {/* Title */}
                      <h3 className="font-bold text-gray-100 text-lg mb-2 line-clamp-2">
                        {offer.title}
                      </h3>

                      {/* Description */}
                      <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                        {offer.description}
                      </p>

                      {/* Reward Section */}
                      <div className="bg-gradient-to-r from-emerald-600 to-green-600 rounded-xl p-4 mb-4 text-white shadow-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold opacity-90 mb-1">EARN</p>
                            <p className="text-3xl font-black">{offer.reward_amount}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold opacity-90">{offer.reward_currency}</p>
                            <p className="text-2xl mt-1">💰</p>
                          </div>
                        </div>
                      </div>

                      {/* Meta Info */}
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-4 pb-4 border-b border-slate-700">
                        <span className="bg-slate-700/50 text-gray-300 px-3 py-1 rounded-full font-semibold">
                          {offer.category}
                        </span>
                        <span className="font-semibold flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {offer.estimated_time}
                        </span>
                      </div>

                      {/* CTA Button */}
                      <button 
                        disabled={isCompleted}
                        className={`w-full font-bold py-3 px-4 rounded-xl transition-all duration-200 text-lg ${
                          isCompleted
                            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700 shadow-lg hover:shadow-xl active:scale-95'
                        }`}
                      >
                        {isCompleted ? '✓ Completed' : 'Start Now'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Load More Button */}
            {hasMoreOffers && (
              <div className="text-center">
                <button
                  onClick={handleLoadMore}
                  className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-8 py-3 rounded-lg font-bold hover:from-blue-700 hover:to-cyan-700 transition-all flex items-center gap-2 mx-auto shadow-lg hover:shadow-xl"
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

export default OfferwallProfessional;
