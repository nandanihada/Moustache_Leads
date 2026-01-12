import React, { useState, useEffect } from 'react';
import { Search, Filter, X, TrendingUp, Clock, Star, ChevronRight, Sparkles, AlertCircle, Gift, Zap } from 'lucide-react';
import { OfferModal } from './OfferModal';

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
  created_at?: string;
  payout_type?: string;
}

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [placementData, setPlacementData] = useState<any>(null);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    // Track impression when component mounts
    trackImpression();
    
    // Load offers
    loadOffers();
  }, [placementId, userId]);

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
        `${baseUrl}/api/offerwall/offers?placement_id=${placementId}&user_id=${userId}&limit=1000`
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
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl mb-6 shadow-2xl transform hover:scale-110 transition-transform">
            <Sparkles className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-5xl font-black mb-4 bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
            {placementData?.offerwallTitle || 'Earn Rewards'}
          </h1>
          <p className="text-xl text-purple-200 mb-6">
            Complete offers and earn {placementData?.currencyName || 'rewards'}!
          </p>
          <div className="inline-flex items-center bg-white/10 backdrop-blur-lg rounded-full px-6 py-3 border border-purple-500/30 shadow-xl">
            <Zap className="h-5 w-5 mr-2 text-yellow-400" />
            <span className="font-bold text-white text-lg">{offers.length}</span>
            <span className="text-purple-200 ml-2">offers available</span>
          </div>
        </div>

        {/* Offers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {offers.map((offer, index) => (
            <div
              key={offer.id}
              className="group bg-white/10 backdrop-blur-lg rounded-2xl overflow-hidden hover:bg-white/15 transition-all duration-300 hover:scale-105 hover:shadow-2xl cursor-pointer border border-white/10 animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={() => handleOfferClick(offer)}
            >
              {/* Offer Image */}
              <div className="relative h-48 overflow-hidden">
                {offer.image_url && offer.image_url.trim() !== '' ? (
                  <img 
                    src={offer.image_url} 
                    alt={offer.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`${offer.image_url && offer.image_url.trim() !== '' ? 'hidden' : ''} absolute inset-0 bg-gradient-to-br ${getCategoryColor(offer.category)} flex items-center justify-center`}>
                  <span className="text-6xl">{getCategoryIcon(offer.category)}</span>
                </div>
                <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-2">
                  <span className="text-2xl">{getCategoryIcon(offer.category)}</span>
                  <span className="text-white text-xs font-bold uppercase">{offer.category}</span>
                </div>
                {offer.network && (
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full">
                    <span className="text-xs font-bold text-gray-800">{offer.network}</span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-5">
                <h3 className="font-bold text-white text-lg mb-3 line-clamp-2 leading-tight">
                  {offer.title}
                </h3>
                
                {offer.description && (
                  <p className="text-purple-200 text-sm mb-4 line-clamp-2 leading-relaxed">
                    {offer.description}
                  </p>
                )}

                {/* Reward */}
                <div className="flex items-center justify-between mb-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl p-3 border border-green-500/30">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-green-400">
                      {offer.reward_amount}
                    </span>
                    <span className="text-xs text-green-300 font-semibold uppercase">
                      {offer.reward_currency}
                    </span>
                  </div>
                  <Sparkles className="h-5 w-5 text-yellow-400 animate-pulse" />
                </div>

                {/* Action Button */}
                <button className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 px-4 rounded-xl transition-all duration-200 transform group-hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center gap-2">
                  <span>View Offer</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

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
