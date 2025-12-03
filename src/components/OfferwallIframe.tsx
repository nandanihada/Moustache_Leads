import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Loader } from 'lucide-react';

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
}

interface OfferwallIframeProps {
  placementId: string;
  userId: string;
  subId?: string;
  country?: string;
}

export const OfferwallIframe: React.FC<OfferwallIframeProps> = ({
  placementId,
  userId,
  subId,
  country,
}) => {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const sessionRef = useRef<string>('');

  // Detect device and geo info
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

  // Initialize session on mount
  useEffect(() => {
    const initializeSession = async () => {
      try {
        const deviceInfo = getDeviceInfo();
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionRef.current = sessionId;
        setSessionId(sessionId);

        // Create session on backend
        const response = await fetch('/api/offerwall/session/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            placement_id: placementId,
            user_id: userId,
            sub_id: subId,
            device_info: deviceInfo,
            geo_info: {
              country: country,
              ip: 'client-ip', // Will be captured server-side
            },
          }),
        });

        if (!response.ok) throw new Error('Failed to create session');

        // Track impression
        await fetch('/api/offerwall/track/impression', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            placement_id: placementId,
            user_id: userId,
            referrer: document.referrer,
            user_agent: navigator.userAgent,
          }),
        }).catch(err => console.warn('Failed to track impression:', err));

        // Load offers
        loadOffers(sessionId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize');
        setLoading(false);
      }
    };

    initializeSession();
  }, [placementId, userId, subId, country]);

  const loadOffers = async (sid: string) => {
    try {
      const params = new URLSearchParams({
        placement_id: placementId,
        user_id: userId,
        ...(country && { country }),
      });

      // Try multiple API endpoints
      let response = await fetch(`/api/offerwall/offers?${params}`);
      
      // If relative path fails, try with localhost
      if (!response.ok) {
        console.warn('Relative path failed, trying localhost...');
        response = await fetch(`http://localhost:5000/api/offerwall/offers?${params}`);
      }
      
      if (!response.ok) {
        throw new Error(`Failed to load offers: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Offers loaded:', data);
      
      if (!data.offers || data.offers.length === 0) {
        console.warn('No offers returned from API');
        setError('No offers available');
        setLoading(false);
        return;
      }
      
      setOffers(data.offers);
      setError(null);
    } catch (err) {
      console.error('Error loading offers:', err);
      setError(err instanceof Error ? err.message : 'Failed to load offers');
    } finally {
      setLoading(false);
    }
  };

  const handleOfferClick = async (offer: Offer) => {
    try {
      // Track click
      const clickResponse = await fetch('/api/offerwall/track/click', {
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
      });

      if (clickResponse.ok) {
        const clickData = await clickResponse.json();
        console.log('Click tracked:', clickData.click_id);
      }

      // Open offer
      window.open(offer.click_url, '_blank');
    } catch (err) {
      console.error('Error tracking click:', err);
      window.open(offer.click_url, '_blank');
    }
  };

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

  if (error) {
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

  if (offers.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 border border-gray-200 rounded-lg m-4">
        <div className="text-center">
          <p className="text-gray-600 font-semibold">No Offers Available</p>
          <p className="text-gray-500 text-sm mt-1">Please check back later</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-blue-50 via-white to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-black text-gray-900 mb-3">
            {placementId.split('_')[0] || 'daily'}
          </h1>
          <p className="text-gray-600 text-xl font-semibold">
            Complete offers and earn coins!
          </p>
          <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-cyan-500 mx-auto mt-4 rounded-full"></div>
        </div>

        {/* Offers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-8">
          {offers.map((offer) => (
            <div
              key={offer.id}
              className="bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden cursor-pointer transform hover:scale-105 border border-gray-100"
              onClick={() => handleOfferClick(offer)}
            >
              {/* Image Container - ENHANCED */}
              <div className="relative w-full h-56 bg-gradient-to-br from-blue-300 via-purple-300 to-pink-300 overflow-hidden flex items-center justify-center">
                {offer.image_url && offer.image_url.trim() && !offer.image_url.includes('placeholder') ? (
                  <img
                    src={offer.image_url}
                    alt={offer.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback to gradient with emoji if image fails
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : null}
                
                {/* Fallback Content - Always Show */}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 opacity-90">
                  <div className="text-6xl mb-3 drop-shadow-lg">
                    {offer.category === 'survey' && '📋'}
                    {offer.category === 'app' && '📱'}
                    {offer.category === 'game' && '🎮'}
                    {offer.category === 'video' && '🎬'}
                    {offer.category === 'general' && '🎁'}
                    {!['survey', 'app', 'game', 'video', 'general'].includes(offer.category?.toLowerCase()) && '⭐'}
                  </div>
                  <p className="text-white font-bold text-center px-4 text-sm drop-shadow-md">
                    {offer.title}
                  </p>
                </div>

                {/* Overlay Badge */}
                <div className="absolute top-4 right-4 bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg z-10">
                  {offer.category.toUpperCase()}
                </div>
              </div>

              {/* Content Section */}
              <div className="p-6">
                {/* Title */}
                <h3 className="font-bold text-gray-900 text-xl mb-2 line-clamp-2">
                  {offer.title}
                </h3>

                {/* Description */}
                <p className="text-gray-600 text-sm mb-5 line-clamp-2 h-10">
                  {offer.description}
                </p>

                {/* Reward Section */}
                <div className="bg-gradient-to-r from-emerald-400 to-green-500 rounded-2xl p-5 mb-5 text-white shadow-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold opacity-90 mb-1 tracking-wider">REWARD</p>
                      <p className="text-4xl font-black">{offer.reward_amount}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold opacity-90">{offer.reward_currency}</p>
                      <p className="text-lg mt-1">💰</p>
                    </div>
                  </div>
                </div>

                {/* Meta Info */}
                <div className="flex items-center justify-between text-xs text-gray-600 mb-5 pb-5 border-b border-gray-200">
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

        {/* Footer Info */}
        <div className="text-center text-gray-500 text-xs pb-4">
          <p>Session: {sessionId.substring(0, 8)}...</p>
          <p className="mt-1">Placement: {placementId}</p>
        </div>
      </div>
    </div>
  );
};

export default OfferwallIframe;
