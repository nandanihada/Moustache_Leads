import React, { useState } from 'react';
import { X, Globe, Smartphone, Monitor, Star, ChevronRight, Clock, AlertTriangle, Sparkles, Shield, QrCode, Users } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getOfferImage } from '@/utils/categoryImages';

interface Offer {
  id: string; title: string; description: string; reward_amount: number; reward_currency: string;
  category: string; status: string; estimated_time: string; image_url: string; click_url: string;
  network?: string; countries?: string[]; devices?: string[]; device_targeting?: string;
  created_at?: string; payout_type?: string; payout?: number; star_rating?: number; click_count?: number;
  refined_description?: {
    event_flow?: string;
    summary?: string;
    steps?: string[];
    payout_levels?: Array<{ event: string; payout: string }>;
    traffic_sources?: { allowed?: string[]; restricted?: string[] };
    restrictions?: string[];
    difficulty?: string;
    estimated_time?: string;
  };
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
  const [showQR, setShowQR] = useState(false);
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
          <div className="absolute inset-0 bg-gray-50 flex items-center justify-center overflow-hidden rounded-t-3xl sm:rounded-t-2xl pointer-events-none">
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
          <button onClick={onClose} className="absolute top-3 right-3 z-10 w-8 h-8 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-sm text-gray-600 transition-all">
            <X className="w-4 h-4" />
          </button>

          {/* QR button — top left, bigger and properly clickable */}
          <button
            onClick={e => { e.stopPropagation(); setShowQR(v => !v); }}
            className={`absolute top-3 left-3 z-10 flex items-center gap-1.5 px-3 py-2 rounded-xl shadow-md text-sm font-bold transition-all ${showQR ? 'bg-[#340075] text-white' : 'bg-white/95 text-[#340075] hover:bg-[#340075] hover:text-white'}`}
            title="Scan QR to open on mobile"
          >
            <QrCode className="w-4 h-4" />
            <span>QR</span>
          </button>

          {/* Stars — bottom right of image */}
          <div className="absolute bottom-3 right-4 z-10 flex items-center gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className={`h-4 w-4 ${i < stars ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`} />
            ))}
          </div>
        </div>

        {/* QR Panel — directly below image, non-scrollable, immediately visible */}
        {showQR && (
          <div className="flex-shrink-0 bg-purple-50 border-b border-purple-100 px-5 py-4 flex flex-col items-center">
            <QRCodeSVG value={offer.click_url} size={160} fgColor="#340075" bgColor="transparent" />
            <p className="text-xs text-gray-500 mt-2">Scan with your phone camera to open on mobile</p>
          </div>
        )}

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
          <h2 className="font-bold text-gray-900 text-lg leading-snug mb-1">{offer.title}</h2>
          {/* Event flow subtitle */}
          {offer.refined_description?.event_flow && (
            <p className="text-sm text-purple-600 font-medium mb-2">{offer.refined_description.event_flow}</p>
          )}

          {/* Chips row */}
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="text-xs font-bold text-[#340075] bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-lg uppercase tracking-wide">{offer.category}</span>
            {/* Device chip — always show */}
            <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg flex items-center gap-1">
              {getDeviceIcon(offer.device_targeting || '')}
            </span>
            {/* Click count chip */}
            {((offer as any).pick_count || offer.click_count || 0) > 0 && (
              <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2.5 py-1 rounded-lg flex items-center gap-1">
                <Users className="h-3 w-3" /> {((offer as any).pick_count || offer.click_count || 0).toLocaleString()}
              </span>
            )}
          </div>
          {/* Description — structured if refined, raw if not */}
          {offer.refined_description && (offer.refined_description.summary || offer.refined_description.steps?.length || offer.refined_description.event_flow) ? (
            <div className="mb-3 space-y-3">
              {/* AI Summary */}
              {offer.refined_description.summary && (
                <div>
                  <p className="text-sm text-gray-700 leading-relaxed">{offer.refined_description.summary}</p>
                </div>
              )}

              {/* Steps */}
              {offer.refined_description.steps && offer.refined_description.steps.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">How to Complete</p>
                  <div className="space-y-2">
                    {offer.refined_description.steps.map((step, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <div className="flex-shrink-0 w-5 h-5 bg-[#340075] rounded-full flex items-center justify-center mt-0.5">
                          <span className="text-white text-[10px] font-bold">{i + 1}</span>
                        </div>
                        <p className="text-sm text-gray-700 leading-snug flex-1">{step.replace(/^Step\s*\d+:\s*/i, '')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payout Levels */}
              {offer.refined_description.payout_levels && offer.refined_description.payout_levels.length > 0 && (
                <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
                  <p className="text-[10px] font-bold text-[#340075] uppercase tracking-wider mb-2">Reward Levels</p>
                  <div className="space-y-1.5">
                    {offer.refined_description.payout_levels.map((level, i) => (
                      <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-purple-100">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-[#340075] rounded-full opacity-60"></div>
                          <span className="text-sm text-gray-700 font-medium">{level.event}</span>
                        </div>
                        <span className="text-sm font-bold text-[#340075]">{level.payout}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Traffic Sources */}
              {offer.refined_description.traffic_sources && (offer.refined_description.traffic_sources.allowed?.length || offer.refined_description.traffic_sources.restricted?.length) ? (
                <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                  <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-2">Traffic Sources</p>
                  {offer.refined_description.traffic_sources.allowed && offer.refined_description.traffic_sources.allowed.length > 0 && (
                    <div className="mb-1.5">
                      <div className="flex flex-wrap gap-1.5">
                        {offer.refined_description.traffic_sources.allowed.map((src, i) => (
                          <span key={i} className="text-[11px] font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">✓ {src}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {offer.refined_description.traffic_sources.restricted && offer.refined_description.traffic_sources.restricted.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {offer.refined_description.traffic_sources.restricted.map((src, i) => (
                        <span key={i} className="text-[11px] font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">✗ {src}</span>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {/* Restrictions */}
              {offer.refined_description.restrictions && offer.refined_description.restrictions.length > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-amber-800 mb-1">Requirements</p>
                      <ul className="text-xs text-amber-700 space-y-0.5">
                        {offer.refined_description.restrictions.map((r, i) => (
                          <li key={i}>• {r}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : offer.description ? (
            <div className="mb-3">
              <p className="text-xs font-bold text-gray-700 mb-1">About This Offer</p>
              <p className="text-sm text-gray-600 leading-relaxed">{offer.description}</p>
            </div>
          ) : null}

          {/* Info grid — reward, difficulty, time, status */}
          <div className={`grid ${offer.refined_description?.difficulty || offer.refined_description?.estimated_time ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'} gap-2 mb-3`}>
            <div className="bg-purple-50 rounded-xl p-3 text-center">
              <Sparkles className="h-4 w-4 text-[#340075] mx-auto mb-1" />
              <p className="text-[10px] text-gray-500 uppercase font-semibold">Reward</p>
              <p className="text-sm font-bold text-[#340075]">{points.toLocaleString()} {currencyName}</p>
            </div>
            {offer.refined_description?.difficulty && (
              <div className={`rounded-xl p-3 text-center ${
                offer.refined_description.difficulty === 'Easy' ? 'bg-green-50' :
                offer.refined_description.difficulty === 'Hard' ? 'bg-red-50' : 'bg-yellow-50'
              }`}>
                <Star className={`h-4 w-4 mx-auto mb-1 ${
                  offer.refined_description.difficulty === 'Easy' ? 'text-green-600' :
                  offer.refined_description.difficulty === 'Hard' ? 'text-red-600' : 'text-yellow-600'
                }`} />
                <p className="text-[10px] text-gray-500 uppercase font-semibold">Difficulty</p>
                <p className={`text-sm font-bold ${
                  offer.refined_description.difficulty === 'Easy' ? 'text-green-600' :
                  offer.refined_description.difficulty === 'Hard' ? 'text-red-600' : 'text-yellow-600'
                }`}>{offer.refined_description.difficulty}</p>
              </div>
            )}
            {(offer.refined_description?.estimated_time || offer.estimated_time) && (
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <Clock className="h-4 w-4 text-blue-600 mx-auto mb-1" />
                <p className="text-[10px] text-gray-500 uppercase font-semibold">Est. Time</p>
                <p className="text-sm font-bold text-blue-600">{offer.refined_description?.estimated_time || offer.estimated_time}</p>
              </div>
            )}
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <Shield className="h-4 w-4 text-green-600 mx-auto mb-1" />
              <p className="text-[10px] text-gray-500 uppercase font-semibold">Status</p>
              <p className="text-sm font-bold text-green-600">Verified</p>
            </div>
          </div>

          {/* Requirements — only show generic if no AI restrictions */}
          {(!offer.refined_description?.restrictions || offer.refined_description.restrictions.length === 0) && (
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
          )}
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
