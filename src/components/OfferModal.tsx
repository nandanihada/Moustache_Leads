import React from 'react';
import { X, Clock, Star, CheckCircle, AlertCircle, TrendingUp, Sparkles, Award, Zap } from 'lucide-react';

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

  // Extract steps from description
  const getSteps = () => {
    const description = offer.description || '';
    
    // Try to extract numbered steps from description
    const stepMatches = description.match(/\d+\.\s*[^\n.]+/g);
    if (stepMatches && stepMatches.length > 0) {
      return stepMatches.map(step => step.replace(/^\d+\.\s*/, '').trim());
    }
    
    // Try to split by common delimiters
    if (description.includes('•')) {
      return description.split('•').filter(s => s.trim()).map(s => s.trim());
    }
    
    if (description.includes('\n')) {
      const lines = description.split('\n').filter(s => s.trim());
      if (lines.length > 1) {
        return lines;
      }
    }
    
    // Default steps based on category
    const defaultSteps: Record<string, string[]> = {
      app: ['Download and install the app', 'Open the app and create an account', 'Complete the tutorial or first level'],
      game: ['Download and install the game', 'Complete the tutorial', 'Reach the required level or play for specified time'],
      survey: ['Click "Start Earning" to begin', 'Answer all survey questions honestly', 'Submit the survey to receive your reward'],
      video: ['Click "Start Earning" to watch', 'Watch the entire video without skipping', 'Complete any required actions'],
      shopping: ['Click "Start Earning" to visit the store', 'Browse and add items to cart', 'Complete your purchase'],
      signup: ['Click "Start Earning" to visit the site', 'Fill out the registration form', 'Verify your email address'],
      finance: ['Click "Start Earning" to begin', 'Complete the application form', 'Submit required documents'],
      lifestyle: ['Click "Start Earning" to start', 'Follow the instructions provided', 'Complete all required actions'],
      health: ['Click "Start Earning" to begin', 'Complete the health assessment', 'Follow through with recommendations'],
      education: ['Click "Start Earning" to start', 'Complete the course or lesson', 'Pass any required assessments'],
      entertainment: ['Click "Start Earning" to begin', 'Engage with the content', 'Complete the required activities'],
      travel: ['Click "Start Earning" to start', 'Complete the booking or registration', 'Confirm your reservation'],
    };
    
    return defaultSteps[offer.category.toLowerCase()] || [
      'Click "Start Earning" to begin',
      'Follow the instructions on the offer page',
      'Complete all required actions to earn your reward'
    ];
  };

  const steps = getSteps();

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
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Earn Reward</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                      {offer.reward_amount}
                    </span>
                    <span className="text-sm font-bold text-gray-600 uppercase">
                      {offer.reward_currency}
                    </span>
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
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="flex items-center gap-2 bg-purple-100 px-3 py-1.5 rounded-full">
              <span className="text-lg">{getCategoryEmoji(offer.category)}</span>
              <span className="text-xs font-bold text-purple-900 uppercase">{offer.category}</span>
            </div>
            {offer.network && (
              <div className="flex items-center gap-2 bg-blue-100 px-3 py-1.5 rounded-full">
                <Zap className="h-3.5 w-3.5 text-blue-600" />
                <span className="text-xs font-bold text-blue-900">{offer.network}</span>
              </div>
            )}
            <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full">
              <Clock className="h-3.5 w-3.5 text-gray-600" />
              <span className="text-xs font-semibold text-gray-700">{offer.estimated_time}</span>
            </div>
          </div>

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

          {/* Steps */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              How to Complete
            </h3>
            <div className="space-y-3">
              {steps.map((step, index) => (
                <div key={index} className="flex items-start gap-4 bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-md">
                    {index + 1}
                  </div>
                  <p className="flex-1 text-gray-700 font-medium leading-relaxed pt-0.5">
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </div>

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
            <span>Start Earning Now</span>
            <Award className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
