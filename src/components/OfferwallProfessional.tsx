import React, { useState, useEffect } from 'react';
import { Search, X, TrendingUp, ChevronRight, Sparkles, Globe, Smartphone, Timer, Flame, Clock } from 'lucide-react';
import { OfferModal } from './OfferModal';

interface Offer {
  id: string;
  title: string;
  description: string;
  reward_amount: number;
  reward_currency: string;
  category: string;
  categories?: string[];  // Up to 3 categories per offer
  difficulty: string;
  estimated_time: string;
  image_url: string;
  click_url: string;
  requirements: string[];
  conversion_rate: number;
  countries?: string[];
  devices?: string[];
  device_targeting?: string;
  payout?: number;
  star_rating?: number;
  status?: string;
  timer_enabled?: boolean;
  timer_end_date?: string;
  urgency?: {
    type: string;
    message: string;
    expires_at?: string;
    spots_left?: number;
  };
  urgency_type?: string;
  tracking_params: {
    placement_id: string;
    user_id: string;
    timestamp: string;
  };
}

// Helper: Convert payout to points ($1 = 100 points)
const payoutToPoints = (payout: number): number => Math.round(payout * 100);

// Helper: Render star rating (1-5 stars)
const renderStarRating = (rating: number = 5): JSX.Element => {
  const stars = Math.min(5, Math.max(1, Math.round(rating)));
  return (
    <div className="flex items-center gap-0.5">
      {[...Array(5)].map((_, i) => (
        <span key={i} className={`text-sm ${i < stars ? 'text-yellow-400' : 'text-gray-500'}`}>
          ★
        </span>
      ))}
    </div>
  );
};

// Helper: Get device icon
const getDeviceIcon = (device?: string): JSX.Element | null => {
  if (!device) return null;
  const d = device.toLowerCase();
  if (d.includes('android')) return <span title="Android"><Smartphone className="h-4 w-4 text-green-400" /></span>;
  if (d.includes('ios') || d.includes('iphone')) return <span title="iOS"><Smartphone className="h-4 w-4 text-gray-300" /></span>;
  if (d.includes('web') || d.includes('desktop')) return <span title="Web"><Globe className="h-4 w-4 text-blue-400" /></span>;
  return <span title="All Devices"><Globe className="h-4 w-4 text-blue-400" /></span>;
};

// Country flag mapping (comprehensive)
const FLAG_MAP: Record<string, string> = {
  'US': '🇺🇸', 'UK': '🇬🇧', 'GB': '🇬🇧', 'CA': '🇨🇦', 'AU': '🇦🇺', 'DE': '🇩🇪', 
  'FR': '🇫🇷', 'IT': '🇮🇹', 'ES': '🇪🇸', 'BR': '🇧🇷', 'IN': '🇮🇳', 'JP': '🇯🇵',
  'KR': '🇰🇷', 'CN': '🇨🇳', 'NL': '🇳🇱', 'BE': '🇧🇪', 'AT': '🇦🇹', 'CH': '🇨🇭',
  'SE': '🇸🇪', 'NO': '🇳🇴', 'DK': '🇩🇰', 'FI': '🇫🇮', 'PL': '🇵🇱', 'PT': '🇵🇹',
  'IE': '🇮🇪', 'NZ': '🇳🇿', 'MX': '🇲🇽', 'AR': '🇦🇷', 'CL': '🇨🇱', 'CO': '🇨🇴',
  'TW': '🇹🇼', 'SG': '🇸🇬', 'MY': '🇲🇾', 'TH': '🇹🇭', 'PH': '🇵🇭', 'ID': '🇮🇩',
  'ZA': '🇿🇦', 'AE': '🇦🇪', 'SA': '🇸🇦', 'IL': '🇮🇱', 'TR': '🇹🇷', 'RU': '🇷🇺',
  'GR': '🇬🇷', 'CZ': '🇨🇿', 'HU': '🇭🇺', 'RO': '🇷🇴', 'UA': '🇺🇦', 'VN': '🇻🇳',
  'PK': '🇵🇰', 'BD': '🇧🇩', 'EG': '🇪🇬', 'NG': '🇳🇬', 'KE': '🇰🇪', 'PE': '🇵🇪',
  'VE': '🇻🇪', 'EC': '🇪🇨', 'CR': '🇨🇷', 'PA': '🇵🇦', 'PR': '🇵🇷', 'DO': '🇩🇴',
  'HK': '🇭🇰', 'MO': '🇲🇴', 'LK': '🇱🇰', 'NP': '🇳🇵', 'MM': '🇲🇲', 'KH': '🇰🇭'
};

// Helper: Extract countries from title (e.g., "Opinion Router - Incent AU, BE, CA, DE")
const extractCountriesFromTitle = (title: string): string[] => {
  const countryCodes = Object.keys(FLAG_MAP);
  const found: string[] = [];
  
  // Split by common delimiters and check each part
  const parts = title.toUpperCase().split(/[\s,\-–—]+/);
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

// Helper: Get country display with flags (show up to 6 flags, then +X more)
const getCountryDisplay = (countries?: string[]): JSX.Element => {
  if (!countries || countries.length === 0) {
    return <span className="text-xs text-gray-500">🌍 Global</span>;
  }
  
  const maxFlags = 6;
  const displayCountries = countries.slice(0, maxFlags);
  const remaining = countries.length - maxFlags;
  
  const flags = displayCountries.map(c => FLAG_MAP[c.toUpperCase()] || c).join(' ');
  
  if (remaining > 0) {
    return (
      <span className="text-xs font-semibold text-blue-400">
        {flags} <span className="text-blue-300">+{remaining}</span>
      </span>
    );
  }
  
  return (
    <span className="text-xs font-semibold text-blue-400">
      {flags}
    </span>
  );
};

// Helper: Remove country codes from title (e.g., "Opinion Router - Incent AU, BE, CA" -> "Opinion Router - Incent")
const cleanTitleFromCountries = (title: string): string => {
  const countryCodes = Object.keys(FLAG_MAP);
  let cleaned = title;
  
  // Remove patterns like "AU, BE, CA, DE" at the end
  cleaned = cleaned.replace(/[\s,\-]+([A-Z]{2}[\s,]*)+$/i, '');
  
  // Remove individual country codes
  countryCodes.forEach(code => {
    const regex = new RegExp(`\\b${code}\\b[,\\s]*`, 'gi');
    cleaned = cleaned.replace(regex, '');
  });
  
  // Clean up extra spaces, dashes, and commas
  cleaned = cleaned.replace(/[\s,\-]+$/, '').replace(/\s+/g, ' ').trim();
  
  return cleaned;
};

// Helper: Truncate title
const truncateTitle = (title: string, maxWords: number = 6): string => {
  const cleanedTitle = cleanTitleFromCountries(title);
  const words = cleanedTitle.split(' ');
  if (words.length <= maxWords) return cleanedTitle;
  return words.slice(0, maxWords).join(' ') + '...';
};

// Helper: Get urgency badge
const getUrgencyBadge = (urgencyType?: string, urgency?: { type: string; message: string }): JSX.Element | null => {
  const type = urgencyType || urgency?.type;
  if (!type) return null;
  const badges: Record<string, { text: string; icon: JSX.Element; color: string }> = {
    'limited_slots': { text: 'Limited slots', icon: <Timer className="h-3 w-3" />, color: 'bg-red-500' },
    'high_demand': { text: 'High demand', icon: <Flame className="h-3 w-3" />, color: 'bg-orange-500' },
    'expires_soon': { text: 'Expires soon', icon: <Clock className="h-3 w-3" />, color: 'bg-yellow-500' }
  };
  const badge = badges[type];
  if (!badge) return null;
  return (
    <div className={`absolute top-3 right-3 ${badge.color} px-2 py-1 rounded-full flex items-center gap-1 animate-pulse`}>
      {badge.icon}
      <span className="text-white text-xs font-bold">{badge.text}</span>
    </div>
  );
};

// Countdown Timer Component
const CountdownTimer: React.FC<{ endDate: string }> = ({ endDate }) => {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const end = new Date(endDate).getTime();
      const now = new Date().getTime();
      const diff = end - now;

      if (diff <= 0) {
        setIsExpired(true);
        return;
      }

      setTimeLeft({
        hours: Math.floor(diff / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000)
      });
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [endDate]);

  if (isExpired) return null;

  return (
    <div className="flex items-center gap-1 bg-red-500/90 text-white px-2 py-1 rounded-lg text-xs font-bold">
      <Timer className="h-3 w-3" />
      <span>{String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}</span>
    </div>
  );
};

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
  // Survey Funnel State
  const [activeFunnel, setActiveFunnel] = useState<any>(null);
  const [funnelSession, setFunnelSession] = useState('');
  const [funnelStep, setFunnelStep] = useState(0);
  const [funnelSurvey, setFunnelSurvey] = useState<any>(null);
  const [funnelAnswers, setFunnelAnswers] = useState<Record<number, string>>({});
  const [funnelResult, setFunnelResult] = useState<{type: 'pass' | 'fail'; message: string; redirect_url?: string; has_next?: boolean} | null>(null);
  const [funnelSubmitting, setFunnelSubmitting] = useState(false);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [displaySettings, setDisplaySettings] = useState<{
    primary_color: string;
    background_color: string;
    layout: 'grid' | 'list' | 'table';
    cards_per_row: number;
    show_categories: boolean;
    show_search: boolean;
  }>({
    primary_color: '#6366f1',
    background_color: '#0f172a',
    layout: 'grid',
    cards_per_row: 3,
    show_categories: true,
    show_search: true
  });
  const [announcements, setAnnouncements] = useState<Array<{text: string; id: string}>>([]);
  const [subWalls, setSubWalls] = useState<Array<{_id: string; name: string; slug: string; description: string; image_url: string; offer_count: number; theme_color?: string; heading_text?: string}>>([]);

  // Qualification Survey State
  const [isQualified, setIsQualified] = useState<boolean | null>(null); // null = loading, don't show anything yet
  const [qualificationSurvey, setQualificationSurvey] = useState<any>(null);
  const [showQualificationSurvey, setShowQualificationSurvey] = useState(false);
  const [qualificationSection, setQualificationSection] = useState(0);
  const [qualificationAnswers, setQualificationAnswers] = useState<Record<string, any>>({});
  const [newUserOfferIds, setNewUserOfferIds] = useState<string[]>([]);

  // 11 predefined categories
  const categories = [
    { id: 'all', name: 'All Tasks', icon: '🎯' },
    { id: 'HEALTH', name: 'Health', icon: '💊' },
    { id: 'SURVEY', name: 'Surveys', icon: '📋' },
    { id: 'EDUCATION', name: 'Education', icon: '📚' },
    { id: 'INSURANCE', name: 'Insurance', icon: '🛡️' },
    { id: 'LOAN', name: 'Loans', icon: '💳' },
    { id: 'FINANCE', name: 'Finance', icon: '💰' },
    { id: 'DATING', name: 'Dating', icon: '❤️' },
    { id: 'FREE_TRIAL', name: 'Free Trials', icon: '🎁' },
    { id: 'INSTALLS', name: 'Installs', icon: '📲' },
    { id: 'GAMES_INSTALL', name: 'Games', icon: '🎮' },
  ];

  useEffect(() => {
    trackImpression();
    loadOffers();
    loadDisplaySettings();
    loadSubWalls();
    checkQualification();
  }, [placementId, userId]);

  useEffect(() => {
    filterOffers();
  }, [offers, searchTerm, selectedCategory, isQualified, newUserOfferIds]);

  const checkQualification = async () => {
    try {
      // ALWAYS check the API for qualification status — localStorage is only a cache hint
      const res = await fetch(`${baseUrl}/api/admin/surveys/qualification/check?user_id=${encodeURIComponent(userId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.qualified) {
          setIsQualified(true);
          localStorage.setItem(`offerwall_qualified_${userId}`, 'true');
        } else {
          setIsQualified(false);
          localStorage.removeItem(`offerwall_qualified_${userId}`);
          // Fetch the qualification survey
          const surveyRes = await fetch(`${baseUrl}/api/admin/surveys/qualification`);
          if (surveyRes.ok) {
            const surveyData = await surveyRes.json();
            if (surveyData.survey) {
              setQualificationSurvey(surveyData.survey);
            }
          }
          // Fetch new user offer IDs (starter offers)
          const offersRes = await fetch(`${baseUrl}/api/admin/offerwall-management/new-user-offers`);
          if (offersRes.ok) {
            const offersData = await offersRes.json();
            setNewUserOfferIds(offersData.offer_ids || offersData.new_user_offer_ids || []);
          }
        }
      } else {
        // API error — check localStorage as fallback
        const localKey = `offerwall_qualified_${userId}`;
        const localValue = localStorage.getItem(localKey);
        setIsQualified(localValue === 'true');
      }
    } catch (e) {
      console.warn('Failed to check qualification:', e);
      // On network error, use localStorage as fallback
      const localKey = `offerwall_qualified_${userId}`;
      const localValue = localStorage.getItem(localKey);
      setIsQualified(localValue === 'true');
    }
  };

  const handleQualificationSubmit = async () => {
    if (!qualificationSurvey) return;
    try {
      const answers = Object.entries(qualificationAnswers).map(([questionId, answer]) => ({
        question_id: questionId,
        answer: answer
      }));

      const res = await fetch(`${baseUrl}/api/admin/surveys/public/${qualificationSurvey._id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          answers: answers,
          time_spent_seconds: 0
        })
      });

      if (res.ok) {
        localStorage.setItem(`offerwall_qualified_${userId}`, 'true');
        setIsQualified(true);
        setShowQualificationSurvey(false);
        setQualificationAnswers({});
        setQualificationSection(0);
        loadOffers();
      }
    } catch (e) {
      console.error('Failed to submit qualification survey:', e);
    }
  };

  const trackImpression = async () => {
    try {
      // Generate or retrieve session ID for this offerwall visit
      const sessionKey = `offerwall_session_${placementId}_${userId}`;
      let sessionId = sessionStorage.getItem(sessionKey);
      if (!sessionId) {
        sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        sessionStorage.setItem(sessionKey, sessionId);
      }

      await fetch(`${baseUrl}/api/offerwall/track/impression`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
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
        `${baseUrl}/api/offerwall/offers?placement_id=${placementId}&user_id=${userId}&limit=10000`
      );

      if (!response.ok) throw new Error('Failed to load offers');

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      // Also fetch active survey funnels and inject them as offer cards
      let funnelOffers: any[] = [];
      try {
        const funnelRes = await fetch(`${baseUrl}/api/survey-funnel/active?placement=offerwall`);
        if (funnelRes.ok) {
          const funnelData = await funnelRes.json();
          funnelOffers = funnelData.funnels || [];
        }
      } catch (e) {
        console.warn('Failed to load survey funnels:', e);
      }

      // Merge: funnels at the top, then regular offers
      setOffers([...funnelOffers, ...(data.offers || [])]);
    } catch (err) {
      console.error('Error loading offers:', err);
      setError(err instanceof Error ? err.message : 'Failed to load offers');
    } finally {
      setLoading(false);
    }
  };

  const loadDisplaySettings = async () => {
    try {
      const res = await fetch(`${baseUrl}/api/admin/offerwall-management/display-settings`);
      if (res.ok) {
        const data = await res.json();
        if (data.theme) setDisplaySettings(prev => ({ ...prev, ...data.theme }));
        if (data.announcements) setAnnouncements(data.announcements);
      }
    } catch (e) {
      // Silently fail - use defaults
    }
  };

  const loadSubWalls = async () => {
    try {
      const res = await fetch(`${baseUrl}/api/admin/sub-walls/public/list?user_id=${encodeURIComponent(userId)}&placement_id=${encodeURIComponent(placementId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.sub_walls) setSubWalls(data.sub_walls);
      }
    } catch (e) {
      // Silently fail - sub-walls are optional
    }
  };

  const filterOffers = () => {
    let filtered = offers;

    // If qualification status is still loading (null), show nothing yet
    if (isQualified === null) {
      setFilteredOffers([]);
      return;
    }

    // If user is NOT qualified, ONLY show starter offers — no exceptions
    if (!isQualified) {
      if (newUserOfferIds.length > 0) {
        filtered = filtered.filter(offer => 
          newUserOfferIds.includes(offer.id) || 
          newUserOfferIds.includes((offer as any).offer_id) ||
          newUserOfferIds.includes((offer as any)._id)
        );
      } else {
        filtered = []; // No offers for new users until admin sets starter offers
      }
    }

    // Map category names for backward compatibility (all uppercase)
    const categoryMappings: Record<string, string[]> = {
      'HEALTH': ['HEALTH', 'HEALTHCARE', 'MEDICAL'],
      'SURVEY': ['SURVEY', 'SURVEYS'],
      'EDUCATION': ['EDUCATION', 'LEARNING'],
      'INSURANCE': ['INSURANCE'],
      'LOAN': ['LOAN', 'LOANS', 'LENDING'],
      'FINANCE': ['FINANCE', 'FINANCIAL'],
      'DATING': ['DATING', 'RELATIONSHIPS'],
      'FREE_TRIAL': ['FREE_TRIAL', 'FREETRIAL', 'TRIAL'],
      'INSTALLS': ['INSTALLS', 'INSTALL', 'APP', 'APPS'],
      'GAMES_INSTALL': ['GAMES_INSTALL', 'GAMESINSTALL', 'GAME', 'GAMES', 'GAMING'],
    };

    if (selectedCategory !== 'all') {
      const catUpper = selectedCategory.toUpperCase();
      const matchingCategories = categoryMappings[catUpper] || [catUpper];
      filtered = filtered.filter(offer => {
        // Check categories array first (new multi-category system)
        const cats = (offer as any).categories;
        if (Array.isArray(cats) && cats.length > 0) {
          return cats.some((c: string) => matchingCategories.includes(c.toUpperCase()));
        }
        // Fallback to old single category
        return matchingCategories.includes((offer.category || '').toUpperCase());
      });
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
    // Check if this is a survey funnel offer
    if ((offer as any).is_funnel && (offer as any).funnel_id) {
      startFunnel((offer as any).funnel_id);
      return;
    }
    setSelectedOffer(offer);
    setModalOpen(true);
  };

  const startFunnel = async (funnelId: string) => {
    try {
      const res = await fetch(`${baseUrl}/api/survey-funnel/${funnelId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });
      if (res.ok) {
        const data = await res.json();
        setFunnelSession(data.session_id);
        setFunnelStep(data.step_index);
        setFunnelSurvey(data.survey);
        setActiveFunnel(funnelId);
        setFunnelResult(null);
        setFunnelAnswers({});
      }
    } catch (e) {
      console.error('Failed to start funnel:', e);
    }
  };

  const submitFunnelStep = async () => {
    if (!activeFunnel || !funnelSurvey) return;
    setFunnelSubmitting(true);
    try {
      const answers = Object.entries(funnelAnswers).map(([qIdx, answer]) => ({
        question_index: Number(qIdx),
        answer
      }));

      const res = await fetch(`${baseUrl}/api/survey-funnel/${activeFunnel}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: funnelSession,
          step_index: funnelStep,
          answers
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.result === 'passed') {
          setFunnelResult({ type: 'pass', message: data.message, redirect_url: data.redirect_url });
          // Auto-redirect after 2 seconds
          if (data.redirect_url) {
            setTimeout(() => { window.open(data.redirect_url, '_blank'); }, 2000);
          }
        } else {
          // Failed
          if (data.has_next && data.next_survey) {
            setFunnelResult({ type: 'fail', message: data.message, has_next: true });
            // After showing fail message briefly, load next survey
            setTimeout(() => {
              setFunnelStep(data.next_step_index);
              setFunnelSurvey(data.next_survey);
              setFunnelResult(null);
              setFunnelAnswers({});
            }, 2000);
          } else {
            // Final fail — no more surveys
            setFunnelResult({ type: 'fail', message: data.message, has_next: false });
          }
        }
      }
    } catch (e) {
      console.error('Failed to submit funnel step:', e);
    } finally {
      setFunnelSubmitting(false);
    }
  };

  const closeFunnel = () => {
    setActiveFunnel(null);
    setFunnelSession('');
    setFunnelSurvey(null);
    setFunnelResult(null);
    setFunnelAnswers({});
    setFunnelStep(0);
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
    <div className="min-h-screen" style={{ background: displaySettings.background_color || '#0f172a', '--primary-color': displaySettings.primary_color } as React.CSSProperties}>
      {/* Header */}
      <div className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-lg border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-xl font-black text-white">ML</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Earn Rewards</h1>
                <p className="text-sm text-gray-400">Complete tasks & earn instantly</p>
              </div>
            </div>
            <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-lg px-4 py-2">
              <div className="text-xs text-gray-400 uppercase tracking-wide">Today's Points</div>
              <div className="text-2xl font-bold text-green-400">{payoutToPoints(todayEarnings).toLocaleString()}</div>
            </div>
          </div>

          {/* Search Bar */}
          {displaySettings.show_search && (
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
          )}
        </div>

        {/* Category Filter Dropdown */}
        {displaySettings.show_categories && (
        <div className="border-t border-slate-700/50 bg-slate-800/30">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
            <span className="text-gray-400 text-sm whitespace-nowrap">Filter by:</span>
            <div className="relative w-full max-w-xs">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full appearance-none bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer pr-8"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id} className="bg-slate-800 text-white">
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Announcements Banner */}
      {announcements.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          {announcements.map(ann => (
            <div key={ann.id} className="bg-blue-500/20 border border-blue-500/30 rounded-lg px-4 py-2 mb-2 text-blue-200 text-sm">
              📢 {ann.text}
            </div>
          ))}
        </div>
      )}

      {/* Offers Grid */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Qualification Survey Card — always show for unqualified users */}
        {!isQualified && qualificationSurvey && !searchTerm && (
          <div
            onClick={() => setShowQualificationSurvey(true)}
            className="mb-6 group bg-white rounded-2xl overflow-hidden hover:shadow-2xl hover:shadow-purple-500/20 transition-all duration-300 cursor-pointer border-2 border-purple-200 hover:border-purple-400"
          >
            <div className="flex items-center gap-5 p-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg">
                📋
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-purple-100 text-purple-700 px-2.5 py-0.5 rounded-full font-semibold">⭐ Featured</span>
                </div>
                <h3 className="text-gray-900 font-bold text-lg group-hover:text-purple-700 transition-colors">Qualification Survey</h3>
                <p className="text-gray-500 text-sm">Complete this survey to unlock all offers and start earning</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl px-5 py-3 text-center shadow-lg">
                <span className="text-white font-bold text-xl">+6</span>
                <span className="text-purple-100 text-xs block">points</span>
              </div>
            </div>
          </div>
        )}

        {filteredOffers.length === 0 && isQualified ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-white text-xl font-bold mb-2">No offers found</h3>
            <p className="text-gray-400">Try adjusting your search or filters</p>
          </div>
        ) : filteredOffers.length === 0 && !isQualified ? (
          <div className="text-center py-8">
            <p className="text-gray-400">Complete the qualification survey above to unlock all offers</p>
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

            {/* Sub-Wall Cards - rendered inside the grid below */}

            {/* Table Layout */}
            {displaySettings.layout === 'table' ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left text-gray-400 text-sm font-medium py-3 px-4">Offer</th>
                      <th className="text-left text-gray-400 text-sm font-medium py-3 px-4">Category</th>
                      <th className="text-left text-gray-400 text-sm font-medium py-3 px-4">Countries</th>
                      <th className="text-right text-gray-400 text-sm font-medium py-3 px-4">Points</th>
                      <th className="text-right text-gray-400 text-sm font-medium py-3 px-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOffers.map((offer) => {
                      const points = payoutToPoints(offer.payout || offer.reward_amount || 0);
                      return (
                        <tr
                          key={offer.id}
                          onClick={() => handleOfferClick(offer)}
                          className="border-b border-slate-700/50 hover:bg-slate-800/50 cursor-pointer transition-colors"
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              {offer.image_url && offer.image_url.startsWith('http') ? (
                                <img 
                                  src={offer.image_url} 
                                  alt="" 
                                  className="w-10 h-10 rounded-lg object-cover bg-slate-700"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).style.background = getDefaultImage(offer.category); }}
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{ background: getDefaultImage(offer.category) }}>
                                  {getCategoryEmoji(offer.category)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-white font-medium truncate max-w-[250px]">{truncateTitle(offer.title, 8)}</p>
                                <p className="text-gray-500 text-xs truncate max-w-[250px]">{offer.description?.substring(0, 50)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-xs bg-slate-700 text-gray-300 px-2 py-1 rounded">{offer.category}</span>
                          </td>
                          <td className="py-3 px-4">
                            {getCountryDisplay(getOfferCountries(offer))}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-green-400 font-bold">{points.toLocaleString()}</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button className="text-xs px-3 py-1.5 rounded-lg text-white font-medium" style={{ background: displaySettings.primary_color }}>
                              Earn
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
            <div className="grid grid-cols-1 gap-6" style={{ gridTemplateColumns: displaySettings.layout === 'list' ? '1fr' : `repeat(auto-fill, minmax(${displaySettings.cards_per_row === 2 ? '400px' : displaySettings.cards_per_row === 4 ? '250px' : '300px'}, 1fr))` }}>
              {/* Sub-Wall Cards inside the grid */}
              {!searchTerm && subWalls.map((wall) => (
                <div
                  key={`wall-${wall._id}`}
                  onClick={() => window.open(`https://walls.moustacheleads.com/wall/${wall.slug}`, '_blank')}
                  className="group bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 cursor-pointer"
                >
                  <div className="relative h-48 overflow-hidden">
                    {wall.image_url ? (
                      <img src={wall.image_url} alt={wall.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${wall.theme_color || '#6366f1'}, #7c3aed)` }}>
                        <span className="text-6xl">📦</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>
                    <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium text-white">
                      📦 COLLECTION
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="mb-2">
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <span key={i} className="text-sm text-yellow-400">★</span>
                        ))}
                      </div>
                    </div>
                    <h3 className="text-white font-bold text-lg mb-2 group-hover:text-blue-400 transition-colors">
                      {wall.heading_text || wall.name}
                    </h3>
                    <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                      {wall.description || `${wall.offer_count} curated offers`}
                    </p>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-green-400">{wall.offer_count}</span>
                        <span className="text-sm text-gray-400 uppercase">offers</span>
                      </div>
                    </div>
                    <button className="w-full hover:opacity-90 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 group-hover:shadow-lg" style={{ background: `linear-gradient(to right, ${wall.theme_color || displaySettings.primary_color}, #7c3aed)` }}>
                      <span>View Collection</span>
                      <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              ))}

              {filteredOffers.map((offer) => {
                const points = payoutToPoints(offer.payout || offer.reward_amount || 0);
                
                return (
                  <div
                    key={offer.id}
                    onClick={() => handleOfferClick(offer)}
                    className="group bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 cursor-pointer"
                  >
                    {/* Image */}
                    <div className="relative h-48 overflow-hidden">
                      {offer.image_url && offer.image_url.startsWith('http') ? (
                        <img
                          src={offer.image_url}
                          alt={offer.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
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
                      {getUrgencyBadge(offer.urgency_type, offer.urgency)}
                    </div>

                    {/* Content */}
                    <div className="p-5">
                      {/* Star Rating */}
                      <div className="mb-2">
                        {renderStarRating(offer.star_rating || 5)}
                      </div>
                      
                      <h3 className="text-white font-bold text-lg mb-2 group-hover:text-blue-400 transition-colors">
                        {truncateTitle(offer.title, 6)}
                      </h3>
                      
                      {/* Country & Device Row */}
                      <div className="flex items-center justify-between mb-3">
                        {getCountryDisplay(getOfferCountries(offer))}
                        <div className="flex items-center gap-1">
                          {getDeviceIcon(offer.device_targeting || (offer.devices && offer.devices[0]))}
                        </div>
                      </div>
                      
                      <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                        {offer.description && offer.description.length > 80 
                          ? offer.description.substring(0, 80) + '...' 
                          : offer.description}
                      </p>

                      {/* Points Display */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold text-green-400">
                            {points.toLocaleString()}
                          </span>
                          <span className="text-sm text-gray-400 uppercase">
                            points
                          </span>
                        </div>
                      </div>

                      {/* Action Button */}
                      <button className="w-full hover:opacity-90 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 group-hover:shadow-lg" style={{ background: `linear-gradient(to right, ${displaySettings.primary_color}, #7c3aed)` }}>
                        <span>Click to Earn</span>
                        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </>
        )}
      </div>

      {/* Survey Funnel Overlay */}
      {activeFunnel && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Funnel Result */}
            {funnelResult ? (
              <div className="p-8 text-center">
                {funnelResult.type === 'pass' ? (
                  <>
                    <div className="text-6xl mb-4">🎉</div>
                    <h2 className="text-2xl font-bold text-green-600 mb-2">Congratulations!</h2>
                    <p className="text-gray-600 mb-4">{funnelResult.message}</p>
                    {funnelResult.redirect_url && (
                      <p className="text-sm text-gray-400">Redirecting to your offer...</p>
                    )}
                    <button onClick={closeFunnel} className="mt-4 px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
                      Close
                    </button>
                  </>
                ) : (
                  <>
                    <div className="text-6xl mb-4">{funnelResult.has_next ? '😕' : '😔'}</div>
                    <h2 className="text-xl font-bold text-gray-800 mb-2">
                      {funnelResult.has_next ? "Not quite..." : "Sorry!"}
                    </h2>
                    <p className="text-gray-600 mb-4">{funnelResult.message}</p>
                    {funnelResult.has_next ? (
                      <p className="text-sm text-blue-500 animate-pulse">Loading next survey...</p>
                    ) : (
                      <button onClick={closeFunnel} className="mt-4 px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors">
                        Back to Offers
                      </button>
                    )}
                  </>
                )}
              </div>
            ) : funnelSurvey ? (
              <>
                {/* Survey Header */}
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{funnelSurvey.title}</h2>
                      <p className="text-sm text-gray-500 mt-1">Step {funnelStep + 1} — Answer to qualify</p>
                    </div>
                    <button onClick={closeFunnel} className="text-gray-400 hover:text-gray-600 p-2">✕</button>
                  </div>
                </div>

                {/* Questions */}
                <div className="p-6 space-y-6">
                  {funnelSurvey.questions?.map((q: any, qIdx: number) => (
                    <div key={qIdx} className="space-y-3">
                      <p className="font-medium text-gray-800">{qIdx + 1}. {q.text}</p>
                      <div className="space-y-2">
                        {q.options?.map((opt: string, optIdx: number) => (
                          <label
                            key={optIdx}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                              funnelAnswers[qIdx] === opt
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-gray-200 hover:border-gray-300 text-gray-700'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`funnel-q-${qIdx}`}
                              checked={funnelAnswers[qIdx] === opt}
                              onChange={() => setFunnelAnswers(prev => ({ ...prev, [qIdx]: opt }))}
                              className="w-4 h-4 text-blue-500"
                            />
                            <span className="text-sm">{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Submit */}
                <div className="p-6 border-t border-gray-200">
                  <button
                    onClick={submitFunnelStep}
                    disabled={funnelSubmitting || Object.keys(funnelAnswers).length < (funnelSurvey.questions?.length || 0)}
                    className="w-full py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {funnelSubmitting ? 'Checking...' : 'Submit Answers'}
                  </button>
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-gray-500">Loading survey...</div>
            )}
          </div>
        </div>
      )}

      {/* Qualification Survey Overlay */}
      {showQualificationSurvey && qualificationSurvey && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <div>
                <h2 className="text-xl font-bold text-white">Qualification Survey</h2>
                <p className="text-sm text-gray-400 mt-1">Complete to unlock all offers</p>
              </div>
              <button
                onClick={() => setShowQualificationSurvey(false)}
                className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Section Tabs - Right Side */}
              <div className="w-48 border-r border-slate-700 p-4 overflow-y-auto hidden md:block">
                {(() => {
                  const sections = ["General", "Background", "Work", "Role", "Address"];
                  return sections.map((section, idx) => (
                    <button
                      key={section}
                      onClick={() => setQualificationSection(idx)}
                      className={`w-full text-left px-3 py-2 rounded-lg mb-2 text-sm font-medium transition-colors ${
                        qualificationSection === idx
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'text-gray-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {section}
                    </button>
                  ));
                })()}
              </div>

              {/* Questions Area */}
              <div className="flex-1 p-6 overflow-y-auto">
                {(() => {
                  const sections = ["General", "Background", "Work", "Role", "Address"];
                  const currentSection = sections[qualificationSection];
                  const sectionQuestions = (qualificationSurvey.questions || []).filter(
                    (q: any) => q.section === currentSection
                  );

                  return (
                    <div className="space-y-6">
                      <h3 className="text-lg font-semibold text-white mb-4">{currentSection}</h3>
                      {sectionQuestions.map((question: any) => (
                        <div key={question.id} className="space-y-2">
                          <label className="text-white font-medium text-sm">
                            {question.text}
                            {question.required && <span className="text-red-400 ml-1">*</span>}
                          </label>

                          {question.type === 'text' && (
                            <input
                              type={question.text.toLowerCase().includes('date') ? 'date' : question.text.toLowerCase().includes('email') ? 'email' : question.text.toLowerCase().includes('phone') ? 'tel' : 'text'}
                              value={qualificationAnswers[question.id] || ''}
                              onChange={(e) => setQualificationAnswers(prev => ({ ...prev, [question.id]: e.target.value }))}
                              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder={`Enter ${question.text.toLowerCase().replace('what is your ', '').replace('select your ', '')}`}
                            />
                          )}

                          {question.type === 'mcq' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {(question.options || []).map((option: string) => (
                                <button
                                  key={option}
                                  onClick={() => setQualificationAnswers(prev => ({ ...prev, [question.id]: option }))}
                                  className={`text-left px-4 py-2.5 rounded-lg border text-sm transition-colors ${
                                    qualificationAnswers[question.id] === option
                                      ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                                      : 'bg-slate-800 border-slate-600 text-gray-300 hover:border-slate-500'
                                  }`}
                                >
                                  {option}
                                </button>
                              ))}
                            </div>
                          )}

                          {question.type === 'mcq_multi' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {(question.options || []).map((option: string) => {
                                const selected = (qualificationAnswers[question.id] || []) as string[];
                                const isSelected = selected.includes(option);
                                return (
                                  <button
                                    key={option}
                                    onClick={() => {
                                      setQualificationAnswers(prev => {
                                        const current = (prev[question.id] || []) as string[];
                                        if (current.includes(option)) {
                                          return { ...prev, [question.id]: current.filter(o => o !== option) };
                                        } else {
                                          return { ...prev, [question.id]: [...current, option] };
                                        }
                                      });
                                    }}
                                    className={`text-left px-4 py-2.5 rounded-lg border text-sm transition-colors ${
                                      isSelected
                                        ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                                        : 'bg-slate-800 border-slate-600 text-gray-300 hover:border-slate-500'
                                    }`}
                                  >
                                    {isSelected ? '☑ ' : '☐ '}{option}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {question.type === 'yes_no' && (
                            <div className="flex gap-3">
                              {['Yes', 'No'].map((option) => (
                                <button
                                  key={option}
                                  onClick={() => setQualificationAnswers(prev => ({ ...prev, [question.id]: option }))}
                                  className={`flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                                    qualificationAnswers[question.id] === option
                                      ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                                      : 'bg-slate-800 border-slate-600 text-gray-300 hover:border-slate-500'
                                  }`}
                                >
                                  {option}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Navigation Buttons */}
                <div className="flex items-center justify-between mt-8 pt-4 border-t border-slate-700">
                  <button
                    onClick={() => setQualificationSection(prev => Math.max(0, prev - 1))}
                    disabled={qualificationSection === 0}
                    className="px-6 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-slate-800 border border-slate-600 text-gray-300 hover:bg-slate-700"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-400">
                    Section {qualificationSection + 1} of 5
                  </span>
                  {qualificationSection < 4 ? (
                    <button
                      onClick={() => setQualificationSection(prev => Math.min(4, prev + 1))}
                      className="px-6 py-2.5 rounded-lg text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      onClick={handleQualificationSubmit}
                      className="px-6 py-2.5 rounded-lg text-sm font-medium bg-green-500 hover:bg-green-600 text-white transition-colors"
                    >
                      Submit
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Offer Modal */}
      {selectedOffer && (
        <OfferModal
          offer={{...selectedOffer, status: selectedOffer.status || 'active'}}
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
