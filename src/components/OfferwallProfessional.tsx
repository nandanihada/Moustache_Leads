import React, { useState, useEffect } from 'react';
import { Search, Filter, X, TrendingUp, Clock, Star, ChevronRight, Sparkles } from 'lucide-react';
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
  urgency?: {
    type: string;
    message: string;
    expires_at?: string;
    spots_left?: number;
  };
  tracking_params: {
    placement_id: string;
    user_id: string;
    timestamp: string;
  };
}

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
        `${baseUrl}/api/offerwall/offers?placement_id=${placementId}&user_id=${userId}&limit=100`
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
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Earn Rewards</h1>
                <p className="text-sm text-gray-400">Complete tasks and earn instantly</p>
              </div>
            </div>
            <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-lg px-4 py-2">
              <div className="text-xs text-gray-400 uppercase tracking-wide">Today's Earnings</div>
              <div className="text-2xl font-bold text-green-400">${todayEarnings.toFixed(2)}</div>
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
              {filteredOffers.map((offer) => (
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
                    {offer.urgency && (
                      <div className="absolute top-3 right-3 bg-red-500 px-3 py-1 rounded-full text-xs font-bold text-white animate-pulse">
                        🔥 {offer.urgency.message.split(':')[0]}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-5">
                    <h3 className="text-white font-bold text-lg mb-2 line-clamp-2 group-hover:text-blue-400 transition-colors">
                      {offer.title}
                    </h3>
                    
                    <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                      {offer.description}
                    </p>

                    {/* Reward */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-green-400">
                          {offer.reward_amount}
                        </span>
                        <span className="text-sm text-gray-400 uppercase">
                          {offer.reward_currency}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-yellow-400">
                        <Star className="w-4 h-4 fill-current" />
                        <span className="text-sm font-medium">
                          {Math.round(offer.conversion_rate * 100)}%
                        </span>
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="flex items-center justify-between text-sm text-gray-400 mb-4">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{offer.estimated_time}</span>
                      </div>
                      <div className="px-2 py-1 bg-slate-700/50 rounded text-xs font-medium">
                        {offer.difficulty}
                      </div>
                    </div>

                    {/* Action Button */}
                    <button className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 group-hover:shadow-lg group-hover:shadow-blue-500/50">
                      <span>Start Earning</span>
                      <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              ))}
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
