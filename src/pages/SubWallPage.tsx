import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getApiBaseUrl } from '@/services/apiConfig';
import { Search, X, LayoutGrid, List, ChevronRight, Globe } from 'lucide-react';
import { OfferModal } from '@/components/OfferModal';

interface Offer {
  _id: string;
  offer_id: string;
  name: string;
  description?: string;
  refined_description?: { event_flow?: string };
  payout?: number;
  payout_type?: string;
  category?: string;
  countries?: string[];
  image_url?: string;
  tracking_link?: string;
  target_url?: string;
  click_url?: string;
  preview_url?: string;
  status?: string;
  device_targeting?: string[];
}

interface SubWallData {
  _id: string;
  name: string;
  slug: string;
  description: string;
  image_url: string;
  offer_count: number;
  offers: Offer[];
  pre_screening_enabled: boolean;
  pre_screening_survey_id: string | null;
  heading_text: string;
  theme_color: string;
  banner_image: string;
  button_text: string;
  survey_frequency: string;
}

interface SurveyQuestion {
  id: string;
  text: string;
  type: 'mcq' | 'text' | 'yes_no' | 'number';
  options?: string[];
  required?: boolean;
}

interface SurveyData {
  _id: string;
  title: string;
  questions: SurveyQuestion[];
}

const SubWallPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [subWall, setSubWall] = useState<SubWallData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSurvey, setShowSurvey] = useState(false);
  const [survey, setSurvey] = useState<SurveyData | null>(null);
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, string>>({});
  const [submittingSurvey, setSubmittingSurvey] = useState(false);
  const [pendingOffer, setPendingOffer] = useState<Offer | null>(null);
  const [surveyCompleted, setSurveyCompleted] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('default');
  const [device, setDevice] = useState('all');
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const API_BASE = getApiBaseUrl();

  useEffect(() => {
    if (slug) fetchSubWall();
  }, [slug]);

  const fetchSubWall = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/admin/sub-walls/public/${slug}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Sub-wall not found');
      }
      const data = await res.json();
      setSubWall(data.sub_wall);

      if (data.sub_wall.pre_screening_enabled && data.sub_wall.pre_screening_survey_id) {
        const frequency = data.sub_wall.survey_frequency || 'every_time';
        const storageKey = `subwall_survey_${slug}`;
        if (frequency === 'once') {
          if (localStorage.getItem(storageKey)) setSurveyCompleted(true);
        } else if (frequency === 'once_per_day') {
          const lastCompleted = localStorage.getItem(storageKey);
          if (lastCompleted && new Date(lastCompleted).toDateString() === new Date().toDateString()) setSurveyCompleted(true);
        }
        await fetchSurvey(data.sub_wall.pre_screening_survey_id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load sub-wall');
    } finally {
      setLoading(false);
    }
  };

  const fetchSurvey = async (surveyId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/surveys/public/${surveyId}`);
      if (res.ok) {
        const data = await res.json();
        setSurvey(data.survey);
      }
    } catch (err) {
      console.error('Failed to fetch survey:', err);
    }
  };

  const needsSurvey = (): boolean => {
    if (!subWall) return false;
    if (!subWall.pre_screening_enabled || !subWall.pre_screening_survey_id) return false;
    if (surveyCompleted) return false;
    if (!survey) return false;
    return true;
  };

  const handleOfferClick = (offer: Offer) => {
    if (needsSurvey() && survey) {
      setPendingOffer(offer);
      setShowSurvey(true);
      return;
    }
    // Open the detail modal instead of directly opening the offer
    setSelectedOffer(offer);
    setModalOpen(true);
  };

  const openOffer = (offer: Offer) => {
    let url = offer.tracking_link || offer.click_url || offer.preview_url;
    if (!url && offer.target_url && !offer.target_url.includes('{')) {
      url = offer.target_url;
    }
    if (!url && offer.target_url) {
      url = offer.target_url
        .replace(/\{offer_id\}/g, offer.offer_id || '')
        .replace(/\{user_id\}/g, 'subwall_user')
        .replace(/\{transaction_id\}/g, `txn_${Date.now()}`)
        .replace(/\{payout\}/g, String(offer.payout || 0))
        .replace(/\{sub1\}/g, 'subwall')
        .replace(/\{sub2\}/g, slug || '')
        .replace(/\{sub3\}/g, '')
        .replace(/\{aff_sub\}/g, 'subwall_user');
    }
    if (url) window.open(url, '_blank');
  };

  const handleSurveySubmit = async () => {
    if (!slug || !subWall) return;
    setSubmittingSurvey(true);
    try {
      if (subWall.pre_screening_survey_id) {
        const formattedAnswers = survey?.questions.map((q, idx) => ({
          question_id: q.id || `q_${idx}`,
          question_text: q.text,
          answer: surveyAnswers[q.id || `q_${idx}`] || ''
        })) || [];

        await fetch(`${API_BASE}/api/admin/surveys/public/${subWall.pre_screening_survey_id}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: formattedAnswers, user_id: 'subwall_' + slug + '_' + Date.now(), time_spent_seconds: 0 })
        });
      }

      const res = await fetch(`${API_BASE}/api/admin/sub-walls/public/${slug}/screen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: surveyAnswers, user_id: 'anonymous_' + Date.now() })
      });
      if (res.ok) {
        setShowSurvey(false);
        setSurveyCompleted(true);
        localStorage.setItem(`subwall_survey_${slug}`, new Date().toISOString());
        if (pendingOffer) { openOffer(pendingOffer); setPendingOffer(null); }
      }
    } catch (err) {
      console.error('Failed to submit survey:', err);
    } finally {
      setSubmittingSurvey(false);
    }
  };

  // Filter + sort offers
  const getFilteredOffers = (): Offer[] => {
    if (!subWall) return [];
    let offers = [...subWall.offers];

    // Search filter
    if (search) {
      const s = search.toLowerCase();
      offers = offers.filter(o =>
        o.name?.toLowerCase().includes(s) ||
        o.description?.toLowerCase().includes(s) ||
        o.category?.toLowerCase().includes(s) ||
        o.offer_id?.toLowerCase().includes(s)
      );
    }

    // Device filter
    if (device !== 'all') {
      offers = offers.filter(o => {
        const dt = Array.isArray(o.device_targeting) ? o.device_targeting : [];
        if (dt.length === 0) return true;
        return dt.some(d => d.toLowerCase().includes(device.toLowerCase()));
      });
    }

    // Sort
    if (sort === 'highest') offers.sort((a, b) => (b.payout || 0) - (a.payout || 0));
    else if (sort === 'lowest') offers.sort((a, b) => (a.payout || 0) - (b.payout || 0));

    return offers;
  };

  const filteredOffers = getFilteredOffers();
  const themeColor = subWall?.theme_color || '#6366f1';
  const buttonText = subWall?.button_text || 'Click to Earn';
  const headingText = subWall?.heading_text || subWall?.name || '';

  // Map sub-wall offer to OfferModal format
  const mapOfferForModal = (offer: Offer) => {
    let clickUrl = offer.tracking_link || offer.click_url || offer.preview_url || '';
    if (!clickUrl && offer.target_url && !offer.target_url.includes('{')) {
      clickUrl = offer.target_url;
    }
    if (!clickUrl && offer.target_url) {
      clickUrl = offer.target_url
        .replace(/\{offer_id\}/g, offer.offer_id || '')
        .replace(/\{user_id\}/g, 'subwall_user')
        .replace(/\{transaction_id\}/g, `txn_${Date.now()}`)
        .replace(/\{payout\}/g, String(offer.payout || 0))
        .replace(/\{sub1\}/g, 'subwall')
        .replace(/\{sub2\}/g, slug || '')
        .replace(/\{sub3\}/g, '')
        .replace(/\{aff_sub\}/g, 'subwall_user');
    }
    return {
      id: offer.offer_id || offer._id,
      title: offer.name,
      description: offer.description || '',
      reward_amount: (offer.payout || 0) * 100,
      reward_currency: 'Points',
      category: offer.category || '',
      status: offer.status || 'active',
      estimated_time: '',
      image_url: offer.image_url || '',
      click_url: clickUrl,
      countries: offer.countries || [],
      payout_type: offer.payout_type || 'CPA',
      payout: offer.payout || 0,
      device_targeting: Array.isArray(offer.device_targeting) ? offer.device_targeting.join(', ') : '',
      refined_description: offer.refined_description,
    };
  };

  const getDeviceLabel = (offer: Offer): string => {
    const dt = Array.isArray(offer.device_targeting) ? offer.device_targeting : [];
    if (dt.length === 0) return 'All';
    if (dt.some(d => d.toLowerCase().includes('android'))) return 'Android';
    if (dt.some(d => d.toLowerCase().includes('ios') || d.toLowerCase().includes('iphone'))) return 'iOS';
    if (dt.some(d => d.toLowerCase().includes('desktop') || d.toLowerCase().includes('windows'))) return 'Desktop';
    return 'All';
  };

  // Loading state
  if (loading) {
    return (
      <div className="sw min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="sw-spinner mx-auto mb-4"></div>
          <p className="text-gray-500 text-sm">Loading offers...</p>
        </div>
        <style>{getStyles(themeColor)}</style>
      </div>
    );
  }

  // Error state
  if (error || !subWall) {
    return (
      <div className="sw min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">😕</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Sub-Wall Not Found</h1>
          <p className="text-gray-500">{error || 'This sub-wall does not exist or is inactive.'}</p>
        </div>
        <style>{getStyles(themeColor)}</style>
      </div>
    );
  }

  // Pre-screening survey view
  if (showSurvey && survey) {
    return (
      <div className="sw min-h-screen p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-lg">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{headingText}</h1>
            <p className="text-gray-500 mb-6">Please answer the following questions to see relevant offers.</p>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">{survey.title}</h2>
            <div className="space-y-6">
              {survey.questions.map((q, idx) => (
                <div key={q.id || idx} className="space-y-2">
                  <label className="text-gray-700 font-medium block">
                    {idx + 1}. {q.text}
                    {q.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {q.type === 'mcq' && q.options && (
                    <div className="space-y-2">
                      {q.options.map((opt) => (
                        <label key={opt} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200">
                          <input type="radio" name={q.id || `q_${idx}`} value={opt}
                            checked={surveyAnswers[q.id || `q_${idx}`] === opt}
                            onChange={(e) => setSurveyAnswers(prev => ({ ...prev, [q.id || `q_${idx}`]: e.target.value }))} />
                          <span className="text-gray-700">{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {q.type === 'yes_no' && (
                    <div className="flex gap-4">
                      {['Yes', 'No'].map((opt) => (
                        <label key={opt} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors px-6 border border-transparent hover:border-gray-200">
                          <input type="radio" name={q.id || `q_${idx}`} value={opt}
                            checked={surveyAnswers[q.id || `q_${idx}`] === opt}
                            onChange={(e) => setSurveyAnswers(prev => ({ ...prev, [q.id || `q_${idx}`]: e.target.value }))} />
                          <span className="text-gray-700">{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {q.type === 'text' && (
                    <input type="text" value={surveyAnswers[q.id || `q_${idx}`] || ''}
                      onChange={(e) => setSurveyAnswers(prev => ({ ...prev, [q.id || `q_${idx}`]: e.target.value }))}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent"
                      style={{ '--tw-ring-color': themeColor } as React.CSSProperties}
                      placeholder="Type your answer..." />
                  )}
                  {q.type === 'number' && (
                    <input type="number" value={surveyAnswers[q.id || `q_${idx}`] || ''}
                      onChange={(e) => setSurveyAnswers(prev => ({ ...prev, [q.id || `q_${idx}`]: e.target.value }))}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent"
                      style={{ '--tw-ring-color': themeColor } as React.CSSProperties}
                      placeholder="Enter a number..." />
                  )}
                </div>
              ))}
            </div>
            <button onClick={handleSurveySubmit} disabled={submittingSurvey}
              className="mt-8 w-full py-3 text-white font-semibold rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: themeColor }}>
              {submittingSurvey ? 'Submitting...' : 'Continue to Offers'}
            </button>
          </div>
        </div>
        <style>{getStyles(themeColor)}</style>
      </div>
    );
  }

  // Main offers view
  const surveyCards = (subWall as any).survey_cards || [];

  return (
    <div className="sw min-h-screen flex flex-col">
      {/* ===== HEADER ===== */}
      <header className="sw-header sticky top-0 z-50">
        <div className="max-w-[1300px] mx-auto px-3 sm:px-4 md:px-6">
          {/* Top row */}
          <div className="flex items-center justify-between h-14 sm:h-16 min-w-0">
            {/* Logo + Title */}
            <div className="flex items-center gap-2.5">
              {subWall.image_url && (
                <img src={subWall.image_url} alt={headingText} className="h-9 w-9 rounded-lg object-cover" />
              )}
              <span className="font-bold text-lg tracking-tight" style={{ color: themeColor }}>{headingText}</span>
            </div>

            {/* Search */}
            <div className="flex-1 max-w-md mx-4 hidden sm:block">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input type="text" placeholder="Search offers…" value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full bg-gray-100 border border-transparent rounded-full pl-10 pr-9 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:bg-white transition-all"
                  style={{ '--tw-ring-color': `${themeColor}33` } as React.CSSProperties} />
                {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>}
              </div>
            </div>

            {/* Right spacer */}
            <div></div>
          </div>

          {/* Mobile search */}
          <div className="sm:hidden pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input type="text" placeholder="Search offers…" value={search} onChange={e => setSearch(e.target.value)}
                className="w-full bg-gray-100 rounded-full pl-10 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all"
                style={{ '--tw-ring-color': `${themeColor}33` } as React.CSSProperties} />
              {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X className="w-3.5 h-3.5" /></button>}
            </div>
          </div>
        </div>
      </header>

      {/* ===== CONTROLS BAR ===== */}
      <div className="bg-gray-50 border-b border-gray-100">
        <div className="max-w-[1300px] mx-auto px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 flex flex-wrap items-center gap-1.5 sm:gap-2">
          <div className="relative flex items-center">
            <Globe className="absolute left-2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <select value={device} onChange={e => setDevice(e.target.value)} className="sw-select sw-select-icon">
              <option value="all">All Devices</option>
              <option value="android">Android</option>
              <option value="ios">iOS</option>
              <option value="desktop">Desktop</option>
            </select>
          </div>
          <select value={sort} onChange={e => setSort(e.target.value)} className="sw-select">
            <option value="default">Default Order</option>
            <option value="highest">Highest Payout</option>
            <option value="lowest">Lowest Payout</option>
          </select>
          <div className="ml-auto flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={() => setViewMode('grid')} className={`p-2 transition-colors ${viewMode === 'grid' ? 'text-white' : 'text-gray-500 hover:text-gray-700'}`}
              style={viewMode === 'grid' ? { background: themeColor } : {}}>
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('table')} className={`p-2 transition-colors ${viewMode === 'table' ? 'text-white' : 'text-gray-500 hover:text-gray-700'}`}
              style={viewMode === 'table' ? { background: themeColor } : {}}>
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1 max-w-[1300px] mx-auto w-full px-3 sm:px-5 md:px-8 py-4 sm:py-5">
        {/* Banner */}
        {subWall.banner_image && (
          <div className="rounded-xl overflow-hidden mb-5 h-40">
            <img src={subWall.banner_image} alt={headingText} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Description */}
        {subWall.description && !search && (
          <div className="mb-4 p-3 rounded-xl border border-gray-100 bg-white">
            <p className="text-gray-600 text-sm">{subWall.description}</p>
          </div>
        )}

        {/* Empty state */}
        {filteredOffers.length === 0 && !loading && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-gray-700 text-lg font-bold mb-2">No offers found</h3>
            <p className="text-gray-500 text-sm mb-4">Try adjusting your search or filters</p>
            <button onClick={() => { setSearch(''); setDevice('all'); }}
              className="sw-btn px-6 py-2" style={{ background: themeColor }}>Clear Filters</button>
          </div>
        )}

        {/* ===== TABLE VIEW ===== */}
        {filteredOffers.length > 0 && viewMode === 'table' && (
          <div>
            <div className="hidden md:grid grid-cols-[1fr_120px_100px_130px] items-center px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 mb-2">
              <span>Offer</span><span className="text-center">Payout</span><span className="text-center">Geo</span><span className="text-right">Action</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {filteredOffers.map(offer => (
                <div key={offer._id || offer.offer_id}
                  className="bg-white rounded-xl border border-gray-100 hover:shadow-md px-4 py-3 cursor-pointer transition-all group grid grid-cols-[1fr_auto] md:grid-cols-[1fr_120px_100px_130px] items-center gap-2 md:gap-0"
                  style={{ '--hover-border': themeColor } as React.CSSProperties}
                  onClick={() => handleOfferClick(offer)}>
                  {/* Offer info */}
                  <div className="flex items-center gap-3 min-w-0 overflow-hidden">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-white border border-gray-100 flex-shrink-0 flex items-center justify-center overflow-hidden">
                      {offer.image_url ? (
                        <img src={offer.image_url} alt={offer.name} className="w-full h-full object-contain p-2"
                          onError={e => { (e.target as HTMLImageElement).src = '/category-images/other.png'; }} />
                      ) : (
                        <div className="w-full h-full bg-gray-50 flex items-center justify-center text-gray-300 text-2xl">📦</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate transition-colors" style={{ '--hover-color': themeColor } as React.CSSProperties}>{offer.name}</p>
                      {offer.refined_description?.event_flow && (
                        <p className="text-[11px] font-medium truncate mt-0.5" style={{ color: themeColor }}>{offer.refined_description.event_flow}</p>
                      )}
                      {offer.description && !offer.refined_description?.event_flow && (
                        <p className="text-[11px] text-gray-500 truncate mt-0.5">{offer.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {offer.category && (
                          <span className="inline-flex items-center text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">{offer.category}</span>
                        )}
                        <span className="inline-flex items-center text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">{getDeviceLabel(offer)}</span>
                        {/* Mobile payout */}
                        <span className="md:hidden inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ color: themeColor, background: `${themeColor}15` }}>
                          ${(offer.payout || 0).toFixed(2)} {offer.payout_type || 'CPA'}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Payout */}
                  <div className="hidden md:block md:text-center">
                    <span className="font-bold text-sm" style={{ color: themeColor }}>${(offer.payout || 0).toFixed(2)} {offer.payout_type || 'CPA'}</span>
                  </div>
                  {/* Countries */}
                  <div className="hidden md:block md:text-center">
                    {offer.countries && offer.countries.length > 0 ? (
                      <span className="text-xs text-gray-500">{offer.countries.slice(0, 3).join(', ')}{offer.countries.length > 3 ? ` +${offer.countries.length - 3}` : ''}</span>
                    ) : (
                      <span className="text-xs text-gray-400">Global</span>
                    )}
                  </div>
                  {/* Action */}
                  <div className="text-right flex-shrink-0">
                    <button className="text-xs font-semibold text-white px-3 py-1.5 md:px-4 md:py-2 rounded-lg transition-all hover:shadow-md hover:opacity-90 whitespace-nowrap"
                      style={{ background: themeColor }}>
                      {buttonText}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== GRID VIEW ===== */}
        {filteredOffers.length > 0 && viewMode === 'grid' && (
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
            {/* Survey cards */}
            {surveyCards.map((card: any, idx: number) => (
              <div key={`survey-${idx}`}
                onClick={() => window.open(`/survey/${card.survey_id}`, '_blank')}
                className="sw-card group cursor-pointer border-2"
                style={{ borderColor: card.badge_color || themeColor }}>
                {card.image_url ? (
                  <div className="h-40 overflow-hidden rounded-t-2xl">
                    <img src={card.image_url} alt={card.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                ) : (
                  <div className="h-40 flex items-center justify-center rounded-t-2xl" style={{ background: `${themeColor}15` }}>
                    <span className="text-5xl">📋</span>
                  </div>
                )}
                <div className="p-4 flex flex-col flex-grow">
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white w-fit mb-2" style={{ background: card.badge_color || themeColor }}>
                    {card.badge_text || '📋 Survey'}
                  </span>
                  <h3 className="font-bold text-gray-900 text-sm mb-1">{card.title}</h3>
                  {card.description && <p className="text-gray-500 text-xs line-clamp-2 mb-3">{card.description}</p>}
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold" style={{ color: themeColor }}>+{card.points || 0} pts</span>
                    <span className="text-xs text-gray-400">~2 min</span>
                  </div>
                  <button className="sw-btn w-full mt-auto" style={{ background: card.badge_color || themeColor }}>Start Survey →</button>
                </div>
              </div>
            ))}

            {/* Offer cards */}
            {filteredOffers.map(offer => (
              <div key={offer._id || offer.offer_id} className="sw-card group cursor-pointer" onClick={() => handleOfferClick(offer)}>
                {/* Image */}
                <div className="relative h-40 overflow-hidden rounded-t-2xl bg-white border-b border-gray-100 flex items-center justify-center">
                  {offer.image_url ? (
                    <img src={offer.image_url} alt={offer.name}
                      className="w-full h-full object-contain p-3 transition-transform duration-500 group-hover:scale-105"
                      onError={e => { (e.target as HTMLImageElement).src = '/category-images/other.png'; }} />
                  ) : (
                    <div className="w-full h-full bg-gray-50 flex items-center justify-center text-gray-300 text-4xl">📦</div>
                  )}
                  {/* Payout badge */}
                  <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full shadow-sm">
                    <span className="font-bold text-xs" style={{ color: themeColor }}>${(offer.payout || 0).toFixed(2)} {offer.payout_type || 'CPA'}</span>
                  </div>
                </div>
                {/* Content */}
                <div className="p-4 flex flex-col flex-grow">
                  <h3 className="font-bold text-gray-900 text-sm leading-snug mb-1 line-clamp-1 group-hover:opacity-80 transition-colors">{offer.name}</h3>
                  {offer.refined_description?.event_flow && (
                    <p className="text-[11px] font-medium truncate mb-2" style={{ color: themeColor }}>{offer.refined_description.event_flow}</p>
                  )}
                  {offer.description && !offer.refined_description?.event_flow && (
                    <p className="text-[11px] text-gray-500 line-clamp-2 mb-2">{offer.description}</p>
                  )}
                  <div className="flex items-center gap-1.5 flex-wrap mb-3">
                    {offer.category && (
                      <span className="inline-flex items-center text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{offer.category}</span>
                    )}
                    <span className="inline-flex items-center text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{getDeviceLabel(offer)}</span>
                    {offer.countries && offer.countries.length > 0 && (
                      <span className="inline-flex items-center text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{offer.countries.slice(0, 2).join(', ')}</span>
                    )}
                  </div>
                  <button className="sw-btn w-full mt-auto" style={{ background: themeColor }}>
                    <span>{buttonText}</span><ChevronRight className="w-4 h-4 opacity-60" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12 text-gray-400 text-xs">
          Powered by Moustache Leads
        </div>
      </main>

      {/* Offer Detail Modal */}
      {selectedOffer && (
        <OfferModal
          offer={mapOfferForModal(selectedOffer) as any}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          currencyName="Points"
          onStartOffer={(offer) => {
            if (offer.click_url) {
              window.open(offer.click_url, '_blank');
            } else {
              openOffer(selectedOffer);
            }
          }}
        />
      )}

      <style>{getStyles(themeColor)}</style>
    </div>
  );
};

function getStyles(themeColor: string): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
    .sw { background: #f9f9fb; font-family: 'DM Sans', system-ui, sans-serif; color: #1a1a2e; }
    .sw-header { background: white; border-bottom: 1px solid #f0f0f5; box-shadow: 0 1px 8px rgba(0,0,0,0.04); }
    .sw-card { background: white; border-radius: 16px; border: 1px solid #f0f0f5; overflow: hidden; display: flex; flex-direction: column; transition: all 0.25s ease; }
    .sw-card:hover { box-shadow: 0 8px 32px -8px ${themeColor}20; transform: translateY(-2px); border-color: ${themeColor}40; }
    .sw-btn { display: inline-flex; align-items: center; justify-content: center; gap: 5px; background: ${themeColor}; color: white; font-weight: 700; font-size: 12px; padding: 9px 14px; border-radius: 10px; border: none; cursor: pointer; transition: all 0.15s; }
    .sw-btn:hover { opacity: 0.9; }
    .sw-btn:active { transform: scale(0.97); }
    .sw-select { appearance: none; background: white url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236b7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat right 10px center; border: 1px solid #e5e7eb; border-radius: 8px; padding: 7px 28px 7px 10px; font-size: 12px; font-weight: 600; color: #374151; cursor: pointer; transition: border-color 0.15s; }
    .sw-select:focus { outline: none; border-color: ${themeColor}; }
    .sw-select-icon { padding-left: 26px; }
    .sw-spinner { width: 32px; height: 32px; border: 3px solid #e5e7eb; border-top-color: ${themeColor}; border-radius: 50%; animation: sw-spin 0.7s linear infinite; }
    @keyframes sw-spin { to { transform: rotate(360deg); } }
    .sw .grid > div:hover { cursor: pointer; }
    @media (max-width: 480px) {
      .sw-select { font-size: 11px; padding: 6px 22px 6px 8px; border-radius: 6px; }
      .sw-select-icon { padding-left: 22px; }
      .sw-btn { font-size: 11px; padding: 7px 10px; border-radius: 8px; }
      .sw-card { border-radius: 12px; }
    }
  `;
}

export default SubWallPage;
