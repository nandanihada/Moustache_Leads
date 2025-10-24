import React, { useState, useEffect } from 'react';
import { Clock, Star, ExternalLink, Gift, Zap, AlertCircle } from 'lucide-react';

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
  baseUrl = 'http://localhost:5000' 
}) => {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [placementData, setPlacementData] = useState<any>(null);

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

      // Load offers
      const offersResponse = await fetch(
        `${baseUrl}/api/offerwall/offers?placement_id=${placementId}&user_id=${userId}&limit=12`
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
    try {
      // Track click
      await fetch(`${baseUrl}/api/offerwall/track/click`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          placement_id: placementId,
          user_id: userId,
          offer_id: offer.id,
          offer_name: offer.title,
          user_agent: navigator.userAgent
        })
      });

      // Open offer in new tab/window
      window.open(offer.click_url, '_blank');

    } catch (err) {
      console.error('Error tracking click:', err);
      // Still open the offer even if tracking fails
      window.open(offer.click_url, '_blank');
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'survey': return <Star className="h-4 w-4" />;
      case 'app_install': return <ExternalLink className="h-4 w-4" />;
      case 'shopping': return <Gift className="h-4 w-4" />;
      case 'video': return <Zap className="h-4 w-4" />;
      default: return <Gift className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'survey': return 'bg-blue-500';
      case 'app_install': return 'bg-green-500';
      case 'shopping': return 'bg-purple-500';
      case 'video': return 'bg-orange-500';
      case 'quiz': return 'bg-pink-500';
      case 'trial': return 'bg-indigo-500';
      case 'newsletter': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy': return 'text-green-600 bg-green-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'hard': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Loading Offers...</h2>
          <p className="opacity-90">Finding the best opportunities for you</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Offers</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadOffers}
            className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (offers.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-8 max-w-md w-full text-center">
          <Gift className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Offers Available</h2>
          <p className="text-gray-600 mb-4">Please check back later for new opportunities!</p>
          <button
            onClick={loadOffers}
            className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-500 to-purple-600 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center text-white mb-8">
          <h1 className="text-4xl font-bold mb-2">
            {placementData?.offerwallTitle || 'Offerwall'}
          </h1>
          <p className="text-xl opacity-90">
            Complete offers and earn {placementData?.currencyName || 'rewards'}!
          </p>
          <div className="mt-4 inline-flex items-center bg-white/20 rounded-full px-4 py-2">
            <Gift className="h-5 w-5 mr-2" />
            <span className="font-medium">{offers.length} offers available</span>
          </div>
        </div>

        {/* Offers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {offers.map((offer) => (
            <div
              key={offer.id}
              className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer relative"
              onClick={() => handleOfferClick(offer)}
            >
              {/* Urgency Badge */}
              {offer.urgency && (
                <div className="absolute top-3 right-3 z-10 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {offer.urgency.message.split(':')[0]}
                </div>
              )}

              {/* Offer Creative */}
              <div className="h-32 relative overflow-hidden">
                {(() => {
                  const creativeType = (offer as any).creative_type || 'image';
                  
                  if (creativeType === 'image' || creativeType === 'upload') {
                    return (
                      <div 
                        className="h-full bg-cover bg-center"
                        style={{ backgroundImage: `url(${offer.image_url})` }}
                      >
                        <div className="absolute inset-0 bg-black/20"></div>
                      </div>
                    );
                  } else if (creativeType === 'html' && (offer as any).html_code) {
                    return (
                      <div 
                        className="h-full w-full"
                        dangerouslySetInnerHTML={{ __html: (offer as any).html_code }}
                      />
                    );
                  } else if (creativeType === 'email' && (offer as any).email_template) {
                    return (
                      <div 
                        className="h-full w-full"
                        dangerouslySetInnerHTML={{ __html: (offer as any).email_template }}
                      />
                    );
                  } else {
                    return (
                      <div className="h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <span className="text-white text-lg font-bold">
                          {creativeType === 'html' ? 'HTML Creative' : creativeType === 'email' ? 'Email Creative' : 'No Image'}
                        </span>
                      </div>
                    );
                  }
                })()}
                <div className={`absolute top-3 left-3 ${getCategoryColor(offer.category)} text-white text-xs font-bold px-2 py-1 rounded-full flex items-center z-10`}>
                  {getCategoryIcon(offer.category)}
                  <span className="ml-1 capitalize">{offer.category.replace('_', ' ')}</span>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="font-bold text-gray-900 text-sm mb-2 line-clamp-2">
                  {offer.title}
                </h3>
                
                <p className="text-gray-600 text-xs mb-3 line-clamp-2">
                  {offer.description}
                </p>

                {/* Reward */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <span className="text-2xl font-bold text-green-600">
                      {offer.reward_amount}
                    </span>
                    <span className="text-xs text-gray-500 ml-1 uppercase">
                      {offer.reward_currency}
                    </span>
                  </div>
                  <div className={`text-xs px-2 py-1 rounded-full font-medium ${getDifficultyColor(offer.difficulty)}`}>
                    {offer.difficulty}
                  </div>
                </div>

                {/* Meta Info */}
                <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                  <div className="flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    {offer.estimated_time}
                  </div>
                  <div className="flex items-center">
                    <Star className="h-3 w-3 mr-1" />
                    {Math.round(offer.conversion_rate * 100)}% success
                  </div>
                </div>

                {/* Requirements */}
                {offer.requirements && offer.requirements.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 mb-1">Requirements:</p>
                    <p className="text-xs text-gray-600 line-clamp-1">
                      {offer.requirements[0]}
                      {offer.requirements.length > 1 && ` +${offer.requirements.length - 1} more`}
                    </p>
                  </div>
                )}

                {/* Action Button */}
                <button className="w-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 text-sm">
                  Start Offer
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center text-white/80 mt-12 text-sm">
          <p>Complete offers to earn rewards • All offers are provided by trusted partners</p>
        </div>
      </div>
    </div>
  );
};

export default Offerwall;
