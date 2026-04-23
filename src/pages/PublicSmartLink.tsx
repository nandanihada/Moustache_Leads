import React, { useState, useEffect, useMemo } from 'react';
import { Globe, Search, ArrowRight, ExternalLink, Activity, Filter, MonitorSmartphone, Monitor, Smartphone, LayoutGrid } from 'lucide-react';
import { getApiBaseUrl } from '@/services/apiConfig';
import { ALL_TRAFFIC_SOURCES } from '@/services/trafficSourceApi';

interface Offer {
  offer_id: string;
  name: string;
  description: string;
  payout: number;
  currency: string;
  category: string;
  vertical: string;
  countries: string[];
  target_url: string;
  preview_url: string;
  image_url: string;
  thumbnail_url: string;
  device_targeting: string;
  created_at?: string;
  updated_at?: string;
}

const PublicSmartLink: React.FC = () => {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDevice, setSelectedDevice] = useState<string>('all');
  const [selectedTrafficSource, setSelectedTrafficSource] = useState<string>('all');
  const [countryFilter, setCountryFilter] = useState<string>('');
  const [countryInput, setCountryInput] = useState<string>('');
  const [detectedData, setDetectedData] = useState<any>(null);
  const [redirectingOffer, setRedirectingOffer] = useState<{ offer: Offer, trackingData: any } | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [isDirectMode, setIsDirectMode] = useState(false);
  const [hasRedirected, setHasRedirected] = useState(false);
  const [currentOfferIndex, setCurrentOfferIndex] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const countryParam = params.get('country')?.trim().toUpperCase();
    const directParam = params.get('direct') === 'true' || params.get('mode') === 'smart';

    if (countryParam && countryParam.length === 2) {
      setCountryFilter(countryParam);
      setCountryInput(countryParam);
      setIsDirectMode(true);
    }

    if (directParam) {
      setIsDirectMode(true);
    }
  }, []);

  const getClientInfo = () => {
    const ua = navigator.userAgent || "";
    let browser = "Unknown";
    let os = "Unknown";
    let device = "Desktop";

    if (ua.indexOf("Firefox") > -1) browser = "Firefox";
    else if (ua.indexOf("SamsungBrowser") > -1) browser = "Samsung Browser";
    else if (ua.indexOf("Opera") > -1 || ua.indexOf("OPR") > -1) browser = "Opera";
    else if (ua.indexOf("Trident") > -1) browser = "IE";
    else if (ua.indexOf("Edge") > -1 || ua.indexOf("Edg") > -1) browser = "Edge";
    else if (ua.indexOf("Chrome") > -1) browser = "Chrome";
    else if (ua.indexOf("Safari") > -1) browser = "Safari";

    if (ua.indexOf("Win") > -1) os = "Windows";
    else if (ua.indexOf("Mac") > -1) os = "MacOS";
    else if (ua.indexOf("Linux") > -1) os = "Linux";
    else if (ua.indexOf("Android") > -1) os = "Android";
    else if (ua.indexOf("like Mac") > -1) os = "iOS";

    if (/tablet|ipad|playbook/i.test(ua.toLowerCase())) device = "Tablet";
    else if (/mobile|android|iphone|ipod/i.test(ua.toLowerCase())) device = "Mobile";

    return { browser, os, device, ua };
  };

  const getBestOffer = (offersList: Offer[]) => {
    if (!Array.isArray(offersList) || offersList.length === 0) return null;
    const filtered = offersList.filter((o) => o && (o.target_url || o.preview_url));
    if (filtered.length === 0) return null;
    return [...filtered].sort((a, b) => (Number(b.payout) || 0) - (Number(a.payout) || 0))[0];
  };

  const logSmartLinkClick = async (offer: Offer, trackingData: any) => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/public/smart-link/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offer_id: offer.offer_id,
          offer_name: offer.name,
          payout: offer.payout,
          country: trackingData.country,
          device: trackingData.device,
          os: trackingData.os,
          browser: trackingData.browser,
          ip: trackingData.ip,
          user_agent: trackingData.user_agent,
          timestamp: new Date().toISOString()
        })
      });
      return await response.json();
    } catch (err) {
      console.warn('Silent tracking failed, proceeding with redirect');
      return { success: false };
    }
  };

  const handleShowDetails = (offer: Offer) => {
    if (!offer) return;
    const userAgent = navigator.userAgent;
    const trackingData = {
      offer_id: offer.offer_id || 'N/A',
      offer_name: offer.name || 'N/A',
      vertical: offer.category || offer.vertical || 'General',
      status: offer.status || 'Active',
      payout: (offer.payout || 0).toFixed(2),
      timestamp: new Date().toLocaleString(),
      country: countryFilter || detectedData?.country_code || 'Unknown',
      device: userAgent.includes('Mobile') ? 'Mobile' : 'Desktop',
      os: /Windows/.test(userAgent) ? 'Windows' : /Mac/.test(userAgent) ? 'Mac OS' : 'Other',
      browser: /Chrome/.test(userAgent) ? 'Chrome' : /Firefox/.test(userAgent) ? 'Firefox' : /Safari/.test(userAgent) ? 'Safari' : 'Other',
      ip: detectedData?.ip || 'Detecting...',
      user_agent: userAgent.substring(0, 40) + '...',
    };

    setRedirectingOffer({ offer, trackingData });
  };

  const handleOfferAction = (offer: Offer) => {
    if (!offer) return;
    const userAgent = navigator.userAgent;
    const trackingData = {
      country: detectedData?.country_code || 'Unknown',
      ip: detectedData?.ip || 'Unknown',
      device: userAgent.includes('Mobile') ? 'Mobile' : 'Desktop',
      os: /Windows/.test(userAgent) ? 'Windows' : /Mac/.test(userAgent) ? 'Mac OS' : 'Other',
      browser: /Chrome/.test(userAgent) ? 'Chrome' : /Firefox/.test(userAgent) ? 'Firefox' : 'Other',
      referrer: document.referrer || 'Direct',
    };

    if (isDirectMode) {
      logSmartLinkClick(offer, trackingData);
      setHasRedirected(true);
      const finalUrl = offer.target_url || offer.preview_url;
      if (finalUrl) {
        window.location.replace(finalUrl);
      }
      return;
    }

    const finalUrl = offer.target_url || offer.preview_url;
    if (finalUrl) {
      window.location.href = finalUrl;
    }
  };

  const buildOfferApiUrl = () => {
    try {
      const url = new URL(`${getApiBaseUrl()}/api/public/smart-link/offers`);
      if (countryFilter && countryFilter.trim().length === 2) {
        url.searchParams.append('country', countryFilter.trim().toUpperCase());
      }
      if (selectedDevice && selectedDevice !== 'all') {
        url.searchParams.append('device_type', selectedDevice);
      }
      if (selectedTrafficSource && selectedTrafficSource !== 'all') {
        url.searchParams.append('traffic_source', selectedTrafficSource);
      }
      return url.toString();
    } catch (e) {
      return `${getApiBaseUrl()}/api/public/smart-link/offers`;
    }
  };

  useEffect(() => {
    const fetchDetectedInfo = async () => {
      try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        if (data && data.ip) {
          setDetectedData(data);
          if (!countryInput && data.country_code) {
            const detected = data.country_code.toUpperCase();
            setCountryFilter(detected);
            setCountryInput(detected);
          }
        }
      } catch (err) {
        console.error('IP geolocation failed:', err);
      }
    };
    fetchDetectedInfo();
  }, []);

  useEffect(() => {
    const fetchOffers = async () => {
      try {
        setLoading(true);
        const response = await fetch(buildOfferApiUrl());
        if (!response.ok) throw new Error('Failed to load data from server');
        const data = await response.json();
        if (data.success) {
          setOffers(data.offers || []);
        } else {
          throw new Error(data.error || 'Failed to load offers');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
    fetchOffers();
  }, [countryFilter, selectedDevice, selectedTrafficSource]);

  const filteredOffers = useMemo(() => {
    if (!Array.isArray(offers)) return [];
    return offers.filter(offer => {
      if (!offer) return false;
      
      if (countryFilter && offer.countries && offer.countries.length > 0) {
        if (!offer.countries.includes(countryFilter)) return false;
      }

      const matchesSearch = (offer.name || "").toLowerCase().includes((searchTerm || "").toLowerCase()) ||
        (offer.description || "").toLowerCase().includes((searchTerm || "").toLowerCase());
      const offerCat = offer.category || offer.vertical || 'Other';
      const matchesCategory = selectedCategory === 'all' || offerCat === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [offers, searchTerm, selectedCategory, countryFilter]);

  useEffect(() => {
    if (!isDirectMode || hasRedirected || loading) return;

    const fetchAndRedirect = async () => {
        setHasRedirected(true);
        try {
            const url = new URL(`${getApiBaseUrl()}/api/public/smart-link/next-offer`);
            if (countryFilter) url.searchParams.append('country', countryFilter);
            
            const response = await fetch(url.toString());
            const data = await response.json();
            
            if (data.success && data.offer) {
                handleOfferAction(data.offer);
            } else if (data.fallback_url) {
                window.location.replace(data.fallback_url);
            } else {
                const availableOffers = filteredOffers.length > 0 ? filteredOffers : offers;
                const bestOffer = getBestOffer(availableOffers);
                if (bestOffer) handleOfferAction(bestOffer);
            }
        } catch (err) {
            console.error('Smart selection failed, using local backup:', err);
            const availableOffers = filteredOffers.length > 0 ? filteredOffers : offers;
            const bestOffer = getBestOffer(availableOffers);
            if (bestOffer) handleOfferAction(bestOffer);
        }
    };

    fetchAndRedirect();
  }, [isDirectMode, hasRedirected, loading, filteredOffers, offers, countryFilter]);

  // Removed countdown effect since we just want to look at the details

  const currentDisplayOffer = filteredOffers[currentOfferIndex];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500"></div>
        <p className="text-purple-400 font-medium mt-6 uppercase text-sm tracking-widest">Loading Offers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="bg-red-500/10 border border-red-500/50 rounded-2xl p-8 text-center max-w-md">
          <h2 className="text-2xl font-bold text-red-400 mb-3">Error</h2>
          <p className="text-gray-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-200">
      <style>{`
        @keyframes progress { 0% { transform: scaleX(0); } 100% { transform: scaleX(1); } }
        .animate-progress { animation: progress 10s linear forwards; }
      `}</style>
      
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 py-16">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-3">Public Smart Link</h1>
            <p className="text-gray-400 text-lg">Top-converting campaigns for your region.</p>
          </div>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/smart-link`);
                alert("Smart Link copied!");
              }}
              className="px-6 py-4 bg-white/5 border border-white/10 rounded-2xl font-bold flex items-center gap-2 hover:bg-white/10 transition-all"
            >
              <ExternalLink className="w-5 h-5 text-purple-400" />
              Copy Smart Link
            </button>
            <button
              onClick={async () => {
                setLoading(true);
                try {
                  const url = new URL(`${getApiBaseUrl()}/api/public/smart-link/next-offer`);
                  if (countryFilter) url.searchParams.append('country', countryFilter);
                  const response = await fetch(url.toString());
                  const data = await response.json();
                  
                  if (data.success && data.offer) {
                    handleOfferAction(data.offer);
                  } else if (data.fallback_url) {
                    window.location.replace(data.fallback_url);
                  } else if (filteredOffers.length > 0) {
                    const best = [...filteredOffers].sort((a,b) => (b.payout||0)-(a.payout||0))[0];
                    handleOfferAction(best);
                  }
                } catch (err) {
                  if (filteredOffers.length > 0) {
                    const best = [...filteredOffers].sort((a,b) => (b.payout||0)-(a.payout||0))[0];
                    handleOfferAction(best);
                  }
                } finally {
                  setLoading(false);
                }
              }}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl font-bold flex items-center gap-2 hover:scale-105 transition-all text-white"
            >
              <Activity className="w-5 h-5" />
              Smart Direct
            </button>
          </div>
        </div>

        {!isDirectMode && (
          <div className="flex flex-col items-center justify-center min-h-[65vh] relative px-4">
            
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen opacity-50"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-600/20 rounded-full blur-[100px] pointer-events-none mix-blend-screen opacity-50 translate-x-20"></div>

            {filteredOffers.length > 0 && currentDisplayOffer ? (
              <div 
                key={currentOfferIndex}
                className="w-full max-w-xl animate-in slide-in-from-bottom-8 fade-in duration-700"
              >
                <div className="bg-[#0f172a]/80 backdrop-blur-3xl border border-white/10 rounded-[2rem] shadow-[0_0_80px_rgba(0,0,0,0.5)] p-8 md:p-10 relative overflow-hidden group">
                  
                  <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] to-transparent pointer-events-none"></div>

                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-8">
                      <div className="bg-gradient-to-b from-emerald-400 to-emerald-600 bg-clip-text text-transparent text-5xl md:text-6xl font-black tracking-tighter drop-shadow-sm">
                        ${(currentDisplayOffer.payout || 0).toFixed(2)}
                      </div>
                      <div className="w-14 h-14 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center shadow-inner">
                        <Activity className="w-7 h-7 text-purple-400" />
                      </div>
                    </div>

                    <h2 className="text-2xl md:text-3xl font-black text-white leading-tight mb-4 group-hover:text-purple-300 transition-colors duration-300">
                      {currentDisplayOffer.name}
                    </h2>
                    
                    <p className="text-slate-400 text-base leading-relaxed mb-8 min-h-[48px]">
                      {currentDisplayOffer.description || "Take action on this premium campaign to get rewarded immediately. Only available for a limited time."}
                    </p>

                    <div className="flex gap-2 flex-wrap mb-10">
                      {(currentDisplayOffer.category || currentDisplayOffer.vertical) && (
                        <span className="px-4 py-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-full text-xs font-bold tracking-wide">
                          {currentDisplayOffer.category || currentDisplayOffer.vertical}
                        </span>
                      )}
                      <span className="px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-full text-xs font-bold tracking-wide">
                        Targeting: {countryFilter || 'Global'}
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => {
                          setCurrentOfferIndex(prev => {
                            const next = prev + 1;
                            return next >= filteredOffers.length ? 0 : next;
                          });
                        }}
                        className="p-4 px-6 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-bold transition-all text-sm group/skip relative overflow-hidden"
                      >
                        <span className="relative z-10 flex items-center gap-2">
                          Skip
                          <ArrowRight className="w-4 h-4 opacity-0 -ml-4 group-hover/skip:opacity-100 group-hover/skip:ml-0 transition-all" />
                        </span>
                      </button>
                      
                      <button
                        onClick={() => handleShowDetails(currentDisplayOffer)}
                        className="flex-1 p-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-2xl font-black text-white shadow-[0_10px_30px_rgba(79,70,229,0.3)] hover:shadow-[0_10px_40px_rgba(79,70,229,0.5)] hover:-translate-y-1 transition-all flex items-center justify-center gap-3 relative overflow-hidden group/btn"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[150%] skew-x-[-20deg] group-hover/btn:translate-x-[150%] transition-transform duration-1000"></div>
                        <span className="relative z-10 text-lg uppercase tracking-wide">Claim Offer</span>
                        <ExternalLink className="w-5 h-5 relative z-10" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              !loading && (
                <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 p-12 rounded-[2rem] text-center shadow-2xl relative">
                  <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-700 shadow-inner">
                    <Activity className="w-10 h-10 text-slate-500" />
                  </div>
                  <h3 className="text-2xl font-black text-white mb-3">No Offers Found</h3>
                  <p className="text-slate-400">There are currently no active campaigns available for your specific region.</p>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Direct Mode Overlay - Premium Loading */}
      {isDirectMode && !redirectingOffer && !hasRedirected && (
        <div className="fixed inset-0 z-[200] bg-[#0B0F19] flex flex-col items-center justify-center p-6 text-center">
          {!loading && filteredOffers.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-3xl p-10 max-w-md animate-in fade-in zoom-in duration-500">
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Globe className="w-10 h-10 text-red-400" />
              </div>
              <h2 className="text-2xl font-black text-white mb-3">No Offers Available</h2>
              <p className="text-gray-400 mb-8">We couldn't find any active campaigns for your current location ({countryFilter || 'Unknown'}).</p>
              <button 
                onClick={() => window.location.reload()}
                className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-bold text-white transition-all"
              >
                Try Again
              </button>
            </div>
          ) : (
            <>
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-purple-500/20 blur-3xl rounded-full"></div>
                <div className="relative animate-spin rounded-full h-24 w-24 border-t-2 border-r-2 border-purple-500"></div>
              </div>
              <h2 className="text-white text-2xl font-black tracking-tight mb-2 animate-pulse">Smart Redirection</h2>
              <p className="text-gray-400 max-w-xs">Optimizing your path to the best available offer for your region...</p>
              
              <div className="mt-12 flex items-center gap-3 text-xs text-gray-500 uppercase tracking-widest">
                <Globe className="w-4 h-4 text-purple-400" />
                <span>Detecting Location: {countryFilter || '...'}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Redirect/Details Modal with 12 Tracking Fields */}
      {redirectingOffer && (
        <div className="fixed inset-0 z-[300] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-white/10 w-full max-w-3xl rounded-[2rem] overflow-hidden relative shadow-2xl">
            <div className="absolute top-0 left-0 h-1 bg-gradient-to-r from-purple-600 to-blue-500 animate-progress origin-left w-full"></div>
            <div className="p-8 md:p-10">
              <div className="flex flex-col items-center mb-10 text-center">
                <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-4">
                  <Activity className="w-8 h-8 text-purple-400 animate-pulse" />
                </div>
                <h2 className="text-3xl font-black text-white">Analyzing Click Profile</h2>
                <p className="text-slate-400 mt-2">Verifying your attributes for a secure white-label redirection</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
                
                {/* Campaign Data */}
                <div>
                  <h3 className="text-xs font-black text-purple-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                    Campaign Data
                  </h3>
                  <div className="bg-white/5 border border-white/10 p-5 rounded-2xl space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-white/5">
                      <span className="text-slate-500">Offer ID</span>
                      <span className="text-white font-mono text-xs">{redirectingOffer.trackingData?.offer_id}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-white/5">
                      <span className="text-slate-500">Offer Name</span>
                      <span className="text-white font-medium truncate max-w-[150px]">{redirectingOffer.trackingData?.offer_name}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-white/5">
                      <span className="text-slate-500">Vertical</span>
                      <span className="text-purple-400 font-bold text-xs bg-purple-500/10 px-2 py-0.5 rounded">{redirectingOffer.trackingData?.vertical}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-white/5">
                      <span className="text-slate-500">Status</span>
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        RUNNING
                      </span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-white/5">
                      <span className="text-slate-500">Payout</span>
                      <span className="text-emerald-400 font-black">${redirectingOffer.trackingData?.payout}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Timestamp</span>
                      <span className="text-slate-300 text-xs">{redirectingOffer.trackingData?.timestamp}</span>
                    </div>
                  </div>
                </div>

                {/* Visitor Profile */}
                <div>
                  <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                    Visitor Profile
                  </h3>
                  <div className="bg-white/5 border border-white/10 p-5 rounded-2xl space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-white/5">
                      <span className="text-slate-500">Country</span>
                      <span className="text-white font-bold flex items-center gap-1">
                        <Globe className="w-3 h-3 text-blue-400" />
                        {redirectingOffer.trackingData?.country}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-white/5">
                      <span className="text-slate-500">Device</span>
                      <span className="text-white font-medium">{redirectingOffer.trackingData?.device}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-white/5">
                      <span className="text-slate-500">Operating System</span>
                      <span className="text-white font-medium">{redirectingOffer.trackingData?.os}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-white/5">
                      <span className="text-slate-500">Browser</span>
                      <span className="text-white font-medium">{redirectingOffer.trackingData?.browser}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-white/5">
                      <span className="text-slate-500">IP Address</span>
                      <span className="text-orange-400 font-mono text-xs">{redirectingOffer.trackingData?.ip}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">User Agent</span>
                      <span className="text-slate-400 text-[10px] truncate max-w-[150px]">{redirectingOffer.trackingData?.user_agent}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-10 flex justify-between items-center">
                <span className="text-xs text-slate-500 font-mono"></span>
                <button 
                  onClick={() => setRedirectingOffer(null)} 
                  className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold text-slate-300 transition-all ml-auto"
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicSmartLink;
