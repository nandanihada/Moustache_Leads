import React from 'react';
import { X, Sparkles, Award, Globe, Smartphone, Shield, ChevronRight, Star, Clock, AlertTriangle } from 'lucide-react';
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
}

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

const getOfferCountries = (offer: Offer): string[] => {
  if (offer.countries && offer.countries.length > 0) return offer.countries;
  const codes = Object.keys(FLAG_MAP);
  const found: string[] = [];
  const parts = (offer.title || '').toUpperCase().split(/[\s,\-]+/);
  for (const p of parts) { if (p.length === 2 && codes.includes(p) && !found.includes(p)) found.push(p); }
  return found;
};

interface OfferModalProps {
  offer: Offer;
  open: boolean;
  onClose: () => void;
  onStartOffer: (offer: Offer) => void;
  currencyName?: string;
}

export const OfferModal: React.FC<OfferModalProps> = ({ offer, open, onClose, onStartOffer, currencyName = 'Points' }) => {
  if (!open) return null;

  const points = Math.round(offer.reward_amount || 0);
  const countries = getOfferCountries(offer);
  const stars = Math.min(5, Math.max(1, Math.round((offer as any).star_rating || 5)));

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      <div 
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] w-full sm:max-w-lg overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="flex sm:hidden justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
        </div>

        {/* Image Header */}
        <div className="relative h-52 sm:h-56 overflow-hidden flex-shrink-0">
          <img
            src={getOfferImage({ image_url: offer.image_url, vertical: offer.category })}
            alt={offer.title}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = '/category-images/other.png'; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
          
          {/* Close */}
          <button onClick={onClose} className="absolute top-3 right-3 bg-white/90 hover:bg-white text-gray-700 p-2 rounded-full transition-all shadow-md">
            <X className="w-4 h-4" />
          </button>

          {/* Points badge on image */}
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
            <div>
              <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-0.5">Earn</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-white text-3xl font-black">{points.toLocaleString()}</span>
                <span className="text-white/80 text-sm font-bold uppercase">{currencyName}</span>
              </div>
            </div>
            {/* Stars */}
            <div className="flex items-center gap-0.5 bg-white/20 backdrop-blur-sm px-2 py-1 rounded-lg">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`h-3.5 w-3.5 ${i < stars ? 'text-yellow-400 fill-yellow-400' : 'text-white/40'}`} />
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {/* Title */}
          <h2 className="text-xl font-bold text-gray-900 mb-3 leading-tight">{offer.title}</h2>

          {/* Tags row */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-xs font-bold text-[#340075] bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-lg uppercase tracking-wide">{offer.category}</span>
            {offer.device_targeting && (
              <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg flex items-center gap-1">
                <Smartphone className="h-3 w-3" />{offer.device_targeting}
              </span>
            )}
            {offer.estimated_time && (
              <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg flex items-center gap-1">
                <Clock className="h-3 w-3" />{offer.estimated_time}
              </span>
            )}
          </div>

          {/* Countries */}
          {countries.length > 0 && (
            <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-2 mb-1.5">
                <Globe className="h-3.5 w-3.5 text-gray-500" />
                <span className="text-xs font-semibold text-gray-600">{countries.length} {countries.length === 1 ? 'Country' : 'Countries'}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {countries.slice(0, 12).map((c, i) => (
                  <span key={i} className="text-base" title={c}>{FLAG_MAP[c.toUpperCase()] || c}</span>
                ))}
                {countries.length > 12 && <span className="text-xs text-gray-400 self-center ml-1">+{countries.length - 12}</span>}
              </div>
            </div>
          )}

          {/* Description */}
          {offer.description && (
            <div className="mb-4">
              <h3 className="text-sm font-bold text-gray-800 mb-2">About This Offer</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{offer.description}</p>
            </div>
          )}

          {/* Quick Info */}
          <div className="mb-4 grid grid-cols-2 gap-2">
            <div className="bg-purple-50 rounded-xl p-3 text-center border border-purple-100">
              <Sparkles className="h-4 w-4 text-[#340075] mx-auto mb-1" />
              <p className="text-xs text-gray-500">Reward</p>
              <p className="text-sm font-bold text-[#340075]">{points.toLocaleString()} {currencyName}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
              <Shield className="h-4 w-4 text-gray-500 mx-auto mb-1" />
              <p className="text-xs text-gray-500">Status</p>
              <p className="text-sm font-bold text-green-600">Verified</p>
            </div>
          </div>

          {/* Conditions */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-2">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-800 mb-1.5">Requirements</p>
                <ul className="text-xs text-amber-700 space-y-1">
                  <li>• Complete all steps on the same device</li>
                  <li>• No VPN or proxies allowed</li>
                  <li>• New users only — no duplicate accounts</li>
                  <li>• Rewards credited within 24-48 hours</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <div className="p-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={() => { onStartOffer(offer); onClose(); }}
            className="w-full bg-[#340075] hover:bg-[#4c1d95] text-white font-bold text-base py-3.5 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
          >
            <span>Start Offer</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
