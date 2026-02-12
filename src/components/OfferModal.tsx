import React from 'react';
import { X, CheckCircle, AlertCircle, Sparkles, Award, Globe, Smartphone, Shield } from 'lucide-react';

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
}

// Country flag mapping
const FLAG_MAP: Record<string, string> = {
  'US': '🇺🇸', 'UK': '🇬🇧', 'GB': '🇬🇧', 'CA': '🇨🇦', 'AU': '🇦🇺', 'DE': '🇩🇪', 
  'FR': '🇫🇷', 'IT': '🇮🇹', 'ES': '🇪🇸', 'BR': '🇧🇷', 'IN': '🇮🇳', 'JP': '🇯🇵',
  'KR': '🇰🇷', 'CN': '🇨🇳', 'NL': '🇳🇱', 'BE': '🇧🇪', 'AT': '🇦🇹', 'CH': '🇨🇭',
  'SE': '🇸🇪', 'NO': '🇳🇴', 'DK': '🇩🇰', 'FI': '🇫🇮', 'PL': '🇵🇱', 'PT': '🇵🇹',
  'IE': '🇮🇪', 'NZ': '🇳🇿', 'MX': '🇲🇽', 'AR': '🇦🇷', 'CL': '🇨🇱', 'CO': '🇨🇴',
  'TW': '🇹🇼', 'SG': '🇸🇬', 'MY': '🇲🇾', 'TH': '🇹🇭', 'PH': '🇵🇭', 'ID': '🇮🇩',
  'ZA': '🇿🇦', 'AE': '🇦🇪', 'SA': '🇸🇦', 'IL': '🇮🇱', 'TR': '🇹🇷', 'RU': '🇷🇺',
  'RO': '🇷🇴', 'GR': '🇬🇷', 'CZ': '🇨🇿', 'HU': '🇭🇺', 'UA': '🇺🇦', 'VN': '🇻🇳'
};

// Helper: Convert payout to points ($1 = 100 points)
const payoutToPoints = (payout: number): number => Math.round(payout * 100);

// Helper: Render star rating
const renderStarRating = (rating: number = 5): JSX.Element => {
  const stars = Math.min(5, Math.max(1, Math.round(rating)));
  return (
    <div className="flex items-center gap-0.5">
      {[...Array(5)].map((_, i) => (
        <span key={i} className={`text-lg ${i < stars ? 'text-yellow-400' : 'text-gray-300'}`}>
          ★
        </span>
      ))}
    </div>
  );
};

// Helper: Get country flags display
const getCountryFlags = (countries?: string[]): JSX.Element | null => {
  if (!countries || countries.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-1 items-center">
      {countries.slice(0, 10).map((c, i) => (
        <span key={i} className="text-lg" title={c}>
          {FLAG_MAP[c.toUpperCase()] || c}
        </span>
      ))}
      {countries.length > 10 && (
        <span className="text-xs text-gray-500 ml-1">+{countries.length - 10} more</span>
      )}
    </div>
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

interface OfferModalProps {
  offer: Offer;
  open: boolean;
  onClose: () => void;
  onStartOffer: (offer: Offer) => void;
}

export const OfferModal: React.FC<OfferModalProps> = ({ offer, open, onClose, onStartOffer }) => {
  if (!open) return null;

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'survey': return 'from-blue-500 to-blue-600';
      case 'app': return 'from-green-500 to-green-600';
      case 'shopping': return 'from-purple-500 to-purple-600';
      case 'video': return 'from-orange-500 to-orange-600';
      case 'quiz': return 'from-pink-500 to-pink-600';
      case 'trial': return 'from-indigo-500 to-indigo-600';
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

  const getCategoryEmoji = (category: string) => {
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

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      {/* Modal */}
      <div 
        className="bg-gradient-to-br from-white to-gray-50 rounded-t-3xl sm:rounded-3xl shadow-2xl animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 duration-300 max-h-[90vh] w-full sm:max-w-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle (mobile only) */}
        <div className="flex sm:hidden justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
        </div>

        {/* Header with Image */}
        <div className="relative">
          {/* Background Image */}
          <div className="h-48 sm:h-56 relative overflow-hidden">
            {offer.image_url && offer.image_url.trim() !== '' ? (
              <>
                <img
                  src={offer.image_url}
                  alt={offer.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className={`hidden absolute inset-0 bg-gradient-to-br ${getCategoryColor(offer.category)} flex items-center justify-center`}>
                  <span className="text-8xl">{getCategoryEmoji(offer.category)}</span>
                </div>
              </>
            ) : (
              <div className={`absolute inset-0 bg-gradient-to-br ${getCategoryColor(offer.category)} flex items-center justify-center`}>
                <span className="text-8xl">{getCategoryEmoji(offer.category)}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
          </div>

          {/* Floating Reward Badge */}
          <div className="absolute bottom-4 left-6 right-6">
            <div className="bg-white/95 backdrop-blur-lg rounded-2xl p-4 shadow-2xl border border-white/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Earn Points</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                      {payoutToPoints(offer.payout || offer.reward_amount || 0).toLocaleString()}
                    </span>
                    <span className="text-sm font-bold text-gray-600 uppercase">
                      points
                    </span>
                  </div>
                  {/* Star Rating */}
                  <div className="mt-2">
                    {renderStarRating((offer as any).star_rating || 5)}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-yellow-400 to-orange-400 p-3 rounded-xl shadow-lg">
                  <Award className="h-8 w-8 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white p-2 rounded-full transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Title */}
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-3 leading-tight">
            {offer.title}
          </h2>

          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-2 bg-purple-100 px-3 py-1.5 rounded-full">
              <span className="text-lg">{getCategoryEmoji(offer.category)}</span>
              <span className="text-xs font-bold text-purple-900 uppercase">{offer.category}</span>
            </div>
            {offer.device_targeting && (
              <div className="flex items-center gap-2 bg-blue-100 px-3 py-1.5 rounded-full">
                <Smartphone className="h-3.5 w-3.5 text-blue-600" />
                <span className="text-xs font-bold text-blue-900">{offer.device_targeting}</span>
              </div>
            )}
          </div>

          {/* Country Flags */}
          {(() => {
            const countries = getOfferCountries(offer);
            if (countries.length === 0) return null;
            return (
              <div className="mb-6 p-3 bg-gradient-to-r from-blue-50 to-green-50 rounded-xl border border-blue-100">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-semibold text-gray-700">Available in {countries.length} {countries.length === 1 ? 'Country' : 'Countries'}</span>
                </div>
                {getCountryFlags(countries)}
              </div>
            );
          })()}

          {/* Description */}
          {offer.description && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                About This Offer
              </h3>
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-5 border border-purple-100">
                <p className="text-gray-700 leading-relaxed font-medium">
                  {offer.description}
                </p>
              </div>
            </div>
          )}

          {/* Important Notes */}
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-2xl p-5 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-blue-900 font-bold text-base mb-3">Important Notes</h4>
                <ul className="text-blue-800 text-sm space-y-2 font-medium">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-1">•</span>
                    <span>Complete all steps to receive your reward</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-1">•</span>
                    <span>Rewards are typically credited within 24-48 hours</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-1">•</span>
                    <span>Use the same device throughout the process</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-1">•</span>
                    <span>Disable ad blockers for best results</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Success Tips */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-5 mb-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-green-900 font-bold text-base mb-3">Tips for Success</h4>
                <ul className="text-green-800 text-sm space-y-2 font-medium">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">•</span>
                    <span>Read all instructions carefully before starting</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">•</span>
                    <span>Provide accurate information when required</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">•</span>
                    <span>Complete the offer in one session without interruption</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">•</span>
                    <span>Check your activity page for status updates</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Compliance Conditions (#56) */}
          <div className="bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-200 rounded-2xl p-5 mb-6">
            <div className="flex items-start gap-3">
              <Shield className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-red-900 font-bold text-base mb-3">Important Conditions</h4>
                <ul className="text-red-800 text-sm space-y-2 font-medium">
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">🚫</span>
                    <span>No VPN / No Proxies</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">🚫</span>
                    <span>No Emulators / No Bots / No Farms</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">👤</span>
                    <span>New Users Only</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">⚠️</span>
                    <span>Same device, IP, or user completions will be rejected and blocked</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Start Button */}
        <div className="p-6 bg-gradient-to-t from-gray-100 to-transparent border-t border-gray-200">
          <button
            onClick={() => {
              onStartOffer(offer);
              onClose();
            }}
            className="w-full bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 hover:from-green-600 hover:via-emerald-600 hover:to-green-700 text-white font-black text-lg py-4 px-8 rounded-2xl transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:scale-[1.02] flex items-center justify-center gap-3"
          >
            <Sparkles className="w-6 h-6 animate-pulse" />
            <span>Click to Earn</span>
            <Award className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
