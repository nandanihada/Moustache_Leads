import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getApiBaseUrl } from '@/services/apiConfig';

interface Offer {
  _id: string;
  offer_id: string;
  name: string;
  description?: string;
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

  const API_BASE = getApiBaseUrl();

  useEffect(() => {
    if (slug) {
      fetchSubWall();
    }
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

      // Check if survey was already completed (based on frequency)
      if (data.sub_wall.pre_screening_enabled && data.sub_wall.pre_screening_survey_id) {
        const frequency = data.sub_wall.survey_frequency || 'every_time';
        const storageKey = `subwall_survey_${slug}`;

        if (frequency === 'once') {
          const completed = localStorage.getItem(storageKey);
          if (completed) setSurveyCompleted(true);
        } else if (frequency === 'once_per_day') {
          const lastCompleted = localStorage.getItem(storageKey);
          if (lastCompleted) {
            const lastDate = new Date(lastCompleted).toDateString();
            const today = new Date().toDateString();
            if (lastDate === today) setSurveyCompleted(true);
          }
        }
        // Pre-fetch the survey so it's ready when user clicks an offer
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
    if (!survey) return false; // Survey couldn't be loaded (inactive/404) - skip it
    return true;
  };

  const handleOfferClick = (offer: Offer) => {
    // If survey is required and not yet completed, show survey first
    if (needsSurvey() && survey) {
      setPendingOffer(offer);
      setShowSurvey(true);
      return;
    }
    // Open the offer - prefer preview_url or tracking_link, avoid raw target_url with macros
    openOffer(offer);
  };

  const openOffer = (offer: Offer) => {
    // Priority: tracking_link > click_url > preview_url > target_url (only if no macros)
    let url = offer.tracking_link || offer.click_url || offer.preview_url;
    if (!url && offer.target_url && !offer.target_url.includes('{')) {
      url = offer.target_url;
    }
    if (!url && offer.target_url) {
      // Replace common macros with placeholder values for preview
      url = offer.target_url
        .replace(/\{offer_id\}/g, (offer as any).offer_id || '')
        .replace(/\{user_id\}/g, 'subwall_user')
        .replace(/\{transaction_id\}/g, `txn_${Date.now()}`)
        .replace(/\{payout\}/g, String(offer.payout || 0))
        .replace(/\{sub1\}/g, 'subwall')
        .replace(/\{sub2\}/g, '')
        .replace(/\{sub3\}/g, '');
    }
    if (url) {
      window.open(url, '_blank');
    }
  };

  const handleSurveySubmit = async () => {
    if (!slug || !subWall) return;
    setSubmittingSurvey(true);
    try {
      // First, store the survey response
      if (subWall.pre_screening_survey_id) {
        const formattedAnswers = survey?.questions.map((q, idx) => ({
          question_id: q.id || `q_${idx}`,
          question_text: q.text,
          answer: surveyAnswers[q.id || `q_${idx}`] || ''
        })) || [];

        await fetch(`${API_BASE}/api/admin/surveys/public/${subWall.pre_screening_survey_id}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            answers: formattedAnswers,
            user_id: 'subwall_' + slug + '_' + Date.now(),
            time_spent_seconds: 0
          })
        });
      }

      // Then submit to sub-wall screen endpoint
      const res = await fetch(`${API_BASE}/api/admin/sub-walls/public/${slug}/screen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: surveyAnswers,
          user_id: 'anonymous_' + Date.now()
        })
      });
      if (res.ok) {
        setShowSurvey(false);
        setSurveyCompleted(true);
        localStorage.setItem(`subwall_survey_${slug}`, new Date().toISOString());
        // Open the pending offer
        if (pendingOffer) {
          openOffer(pendingOffer);
          setPendingOffer(null);
        }
      }
    } catch (err) {
      console.error('Failed to submit survey:', err);
    } finally {
      setSubmittingSurvey(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !subWall) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-4">Sub-Wall Not Found</h1>
          <p className="text-gray-400">{error || 'This sub-wall does not exist or is inactive.'}</p>
        </div>
      </div>
    );
  }

  // Pre-screening survey view
  if (showSurvey && survey) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-slate-800 rounded-xl p-8 border border-slate-700">
            <h1 className="text-2xl font-bold text-white mb-2">{subWall.name}</h1>
            <p className="text-gray-400 mb-6">Please answer the following questions to see relevant offers.</p>
            
            <h2 className="text-lg font-semibold text-white mb-4">{survey.title}</h2>
            
            <div className="space-y-6">
              {survey.questions.map((q, idx) => (
                <div key={q.id || idx} className="space-y-2">
                  <label className="text-gray-300 font-medium">
                    {idx + 1}. {q.text}
                    {q.required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  
                  {q.type === 'mcq' && q.options && (
                    <div className="space-y-2">
                      {q.options.map((opt) => (
                        <label key={opt} className="flex items-center gap-3 p-3 bg-slate-700 rounded-lg cursor-pointer hover:bg-slate-600 transition-colors">
                          <input
                            type="radio"
                            name={q.id || `q_${idx}`}
                            value={opt}
                            checked={surveyAnswers[q.id || `q_${idx}`] === opt}
                            onChange={(e) => setSurveyAnswers(prev => ({ ...prev, [q.id || `q_${idx}`]: e.target.value }))}
                            className="text-blue-500"
                          />
                          <span className="text-gray-300">{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  
                  {q.type === 'yes_no' && (
                    <div className="flex gap-4">
                      {['Yes', 'No'].map((opt) => (
                        <label key={opt} className="flex items-center gap-2 p-3 bg-slate-700 rounded-lg cursor-pointer hover:bg-slate-600 transition-colors px-6">
                          <input
                            type="radio"
                            name={q.id || `q_${idx}`}
                            value={opt}
                            checked={surveyAnswers[q.id || `q_${idx}`] === opt}
                            onChange={(e) => setSurveyAnswers(prev => ({ ...prev, [q.id || `q_${idx}`]: e.target.value }))}
                            className="text-blue-500"
                          />
                          <span className="text-gray-300">{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  
                  {q.type === 'text' && (
                    <input
                      type="text"
                      value={surveyAnswers[q.id || `q_${idx}`] || ''}
                      onChange={(e) => setSurveyAnswers(prev => ({ ...prev, [q.id || `q_${idx}`]: e.target.value }))}
                      className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Type your answer..."
                    />
                  )}
                  
                  {q.type === 'number' && (
                    <input
                      type="number"
                      value={surveyAnswers[q.id || `q_${idx}`] || ''}
                      onChange={(e) => setSurveyAnswers(prev => ({ ...prev, [q.id || `q_${idx}`]: e.target.value }))}
                      className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter a number..."
                    />
                  )}
                </div>
              ))}
            </div>
            
            <button
              onClick={handleSurveySubmit}
              disabled={submittingSurvey}
              className="mt-8 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {submittingSurvey ? 'Submitting...' : 'Continue to Offers'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main offers view
  const offersToShow = subWall.offers;
  const themeColor = subWall.theme_color || '#6366f1';
  const buttonText = subWall.button_text || 'Click to Earn';
  const headingText = subWall.heading_text || subWall.name;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Banner */}
        {subWall.banner_image && (
          <div className="rounded-xl overflow-hidden mb-6 h-48">
            <img
              src={subWall.banner_image}
              alt={subWall.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-8">
          {subWall.image_url && !subWall.banner_image && (
            <img
              src={subWall.image_url}
              alt={subWall.name}
              className="w-24 h-24 rounded-xl mx-auto mb-4 object-cover"
            />
          )}
          <h1 className="text-3xl font-bold text-white mb-2">{headingText}</h1>
          {subWall.description && (
            <p className="text-gray-400 max-w-xl mx-auto">{subWall.description}</p>
          )}
          <p className="text-gray-500 text-sm mt-2">{offersToShow.length} offers available</p>
        </div>

        {/* Offers Grid */}
        {offersToShow.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">No offers available at this time.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {offersToShow.map((offer) => (
              <div
                key={offer._id || offer.offer_id}
                onClick={() => handleOfferClick(offer)}
                className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden hover:border-opacity-80 transition-all cursor-pointer hover:shadow-lg group"
                style={{ '--hover-color': themeColor } as React.CSSProperties}
              >
                {offer.image_url && (
                  <div className="h-40 overflow-hidden">
                    <img
                      src={offer.image_url}
                      alt={offer.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                )}
                <div className="p-4">
                  <h3 className="text-white font-semibold text-lg mb-1 line-clamp-2">{offer.name}</h3>
                  {offer.description && (
                    <p className="text-gray-400 text-sm line-clamp-2 mb-3">{offer.description}</p>
                  )}
                  <div className="flex items-center justify-between mb-3">
                    {offer.payout && (
                      <span className="text-green-400 font-bold">
                        ${offer.payout.toFixed(2)} {offer.payout_type || 'CPA'}
                      </span>
                    )}
                    {offer.category && (
                      <span className="text-xs bg-slate-700 text-gray-300 px-2 py-1 rounded">
                        {offer.category}
                      </span>
                    )}
                  </div>
                  {offer.countries && offer.countries.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1 mb-3">
                      {offer.countries.slice(0, 5).map((c) => (
                        <span key={c} className="text-xs bg-slate-700 text-gray-400 px-1.5 py-0.5 rounded">
                          {c}
                        </span>
                      ))}
                      {offer.countries.length > 5 && (
                        <span className="text-xs text-gray-500">+{offer.countries.length - 5}</span>
                      )}
                    </div>
                  )}
                  <button
                    className="w-full py-2.5 rounded-lg text-white font-semibold text-sm transition-opacity hover:opacity-90"
                    style={{ background: themeColor }}
                  >
                    {buttonText}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12 text-gray-600 text-sm">
          Powered by Moustache Leads
        </div>
      </div>
    </div>
  );
};

export default SubWallPage;
