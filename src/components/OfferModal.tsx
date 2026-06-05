import React from 'react';
import { X, Globe, Smartphone, Monitor, Star, ChevronRight, Clock, AlertTriangle, Sparkles, Shield } from 'lucide-react';
import { getOfferImage } from '@/utils/categoryImages';

interface Offer {
  id: string; title: string; description: string; reward_amount: number; reward_currency: string;
  category: string; status: string; estimated_time: string; image_url: string; click_url: string;
  network?: string; countries?: string[]; devices?: string[]; device_targeting?: string;
  created_at?: string; payout_type?: string; payout?: number; star_rating?: number;
}

const FLAG_MAP: Record<string, string> = {
  'US':'🇺🇸','UK':'🇬🇧','GB':'🇬🇧','CA':'🇨🇦','AU':'🇦🇺','DE':'🇩🇪','FR':'🇫🇷','IT':'🇮🇹',
  'ES':'🇪🇸','BR':'🇧🇷','IN':'🇮🇳','JP':'🇯🇵','KR':'🇰🇷','CN':'🇨🇳','NL':'🇳🇱','BE':'🇧🇪',
  'AT':'🇦🇹','CH':'🇨🇭','SE':'🇸🇪','NO':'🇳🇴','DK':'🇩🇰','FI':'🇫🇮','PL':'🇵🇱','PT':'🇵🇹',
  'IE':'🇮🇪','NZ':'🇳🇿','MX':'🇲🇽','AR':'🇦🇷','CL':'🇨🇱','CO':'🇨🇴','TW':'🇹🇼','SG':'🇸🇬',
  'MY':'🇲🇾','TH':'🇹🇭','PH':'🇵🇭','ID':'🇮🇩','ZA':'🇿🇦','AE':'🇦🇪','SA':'🇸🇦','IL':'🇮🇱',
  'TR':'🇹🇷','RU':'🇷🇺','RO':'🇷🇴','GR':'🇬🇷','CZ':'🇨🇿','HU':'🇭🇺','UA':'🇺🇦','VN':'🇻🇳',
};

const getOfferCountries = (offer: Offer): string[] => {
  if (offer.countries && offer.countries.length > 0) {
    return offer.countries.filter(c => !['WW','GLOBAL','ALL','WORLDWIDE'].includes(c.toUpperCase()));
  }
  const codes = Object.keys(FLAG_MAP);
  const found: string[] = [];
  const parts = (offer.title || '').toUpperCase().split(/[\s,\-]+/);
  for (const p of parts) { if (p.length === 2 && codes.includes(p) && !found.includes(p)) found.push(p); }
  return found;
};

interface OfferModalProps {
  offer: Offer; open: boolean; onClose: () => void;
  onStartOffer: (offer: Offer) => void; currencyName?: string;
}

export const OfferModal: React.FC<OfferModalProps> = ({ offer, open, onClose, onStartOffer, currencyName = 'Points' }) => {
  if (!open) return null;

  const points = Math.round(offer.reward_amount || 0);
  const countries = getOfferCountries(offer);
  const stars = Math.min(5, Math.max(1, Math.round((offer as any).star_rating || 5)));
  const isWW = offer.countries?.some(c => ['WW','GLOBAL','ALL','WORLDWIDE'].includes(c.toUpperCase()));

  const getDeviceIcon = (d?: string) => {
    if (!d) return null;
    const dl = d.toLowerCase();
    if (dl.includes('android') || dl.includes('ios') || dl.includes('iphone')) return <Smartphone className="h-3.5 w-3.5" />;
    if (dl.includes('web') || dl.includes('desktop')) return <Monitor className="h-3.5 w-3.5" />;
    return <Globe className="h-3.5 w-3.5" />;
  };

  return (
    <div
      className="fixed inset-0 z-[99998] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '92vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="flex sm:hidden justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full"></div>
        </div>

        {/* Image area — fixed height, object-contain so logo/image shows fully */}
        <div className="relative flex-shrink-0" style={{ height: 200 }}>
          <div className="absolute inset-0 bg-gray-50 flex items-center justify-center overflow-hidden rounded-t-3xl sm:rounded-t-2xl">
            <img
              src={getOfferImage({ image_url: offer.image_url, vertical: offer.category })}
              alt={offer.title}
              className="w-full h-full object-contain p-4"
              onError={e => { (e.target as HTMLImageElement).src = '/category-images/other.png'; }}
            />
          </div>
          {/* Subtle gradient at bottom for text legibility */}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white/80 to-transparent pointer-events-none"></div>

          {/* Close button */}
          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-sm text-gray-600 transition-all">
            <X className="w-4 h-4" />
          </button>

          {/* Stars — bottom right of image */}
          <div className="absolute bottom-3 right-4 flex items-center gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className={`h-4 w-4 ${i < stars ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`} />
            ))}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 pt-1 pb-4">
          {/* Points strip */}
          <div className="flex items-center justify-between bg-[#340075] rounded-xl px-4 py-3 mb-4 mt-2">
            <div>
              <p className="text-white/60 text-[10px] font-semibold uppercase tracking-wider">Earn</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-white text-2xl font-black">{points.toLocaleString()}</span>
                <span className="text-white/70 text-xs font-bold uppercase">{currencyName}</span>
              </div>
            </div>
            <Sparkles className="h-6 w-6 text-yellow-300" />
          </div>

          {/* Title */}
          <h2 className="font-bold text-gray-900 text-lg leading-snug mb-2">{offer.title}</h2>

          {/* Chips row */}
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="text-xs font-bold text-[#340075] bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-lg uppercase tracking-wide">{offer.category}</span>
            {offer.device_targeting && (
              <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg flex items-center gap-1">
                {getDeviceIcon(offer.device_targeting)}{offer.device_targeting}
              </span>
            )}
            {offer.estimated_time && (
              <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg flex items-center gap-1">
                <Clock className="h-3 w-3" />{offer.estimated_time}
              </span>
            )}
          </div>

          {/* Countries */}
          <div className="mb-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Globe className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-xs font-semibold text-gray-500">
                {isWW || countries.length === 0 ? 'Worldwide' : `${countries.length} ${countries.length === 1 ? 'Country' : 'Countries'}`}
              </span>
            </div>
            {countries.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {countries.slice(0, 14).map((c, i) => (
                  <span key={i} className="text-base" title={c}>{FLAG_MAP[c.toUpperCase()] || c}</span>
                ))}
                {countries.length > 14 && <span className="text-xs text-gray-400 self-center">+{countries.length - 14} more</span>}
              </div>
            )}
          </div>

          {/* Description */}
          {offer.description && (
            <div className="mb-3">
              <p className="text-xs font-bold text-gray-700 mb-1">About This Offer</p>
              <p className="text-sm text-gray-600 leading-relaxed">{offer.description}</p>
            </div>
          )}

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-purple-50 rounded-xl p-3 text-center">
              <Sparkles className="h-4 w-4 text-[#340075] mx-auto mb-1" />
              <p className="text-[10px] text-gray-500 uppercase font-semibold">Reward</p>
              <p className="text-sm font-bold text-[#340075]">{points.toLocaleString()} {currencyName}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <Shield className="h-4 w-4 text-green-600 mx-auto mb-1" />
              <p className="text-[10px] text-gray-500 uppercase font-semibold">Status</p>
              <p className="text-sm font-bold text-green-600">Verified</p>
            </div>
          </div>

          {/* Requirements */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-800 mb-1">Requirements</p>
                <ul className="text-xs text-amber-700 space-y-0.5">
                  <li>• Complete all steps on the same device</li>
                  <li>• No VPN or proxies — new users only</li>
                  <li>• Rewards credited within 24–48 hours</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0 bg-white">
          <button
            onClick={() => { onStartOffer(offer); onClose(); }}
            className="w-full bg-[#340075] hover:bg-[#4c1d95] active:scale-[0.98] text-white font-bold text-base py-3.5 rounded-xl transition-all shadow-lg shadow-[#340075]/20 flex items-center justify-center gap-2"
          >
            <span>Start Offer</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
