import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getApiBaseUrl } from '@/services/apiConfig';

interface SurveyQuestion {
  id: string;
  text: string;
  type: 'mcq' | 'text' | 'yes_no' | 'number';
  options?: string[];
  required?: boolean;
}

interface SurveyData {
  _id: string;
  name: string;
  description: string;
  questions: SurveyQuestion[];
  placement: string;
  image_url: string;
}

const SurveyPage: React.FC = () => {
  const { surveyId } = useParams<{ surveyId: string }>();
  const [survey, setSurvey] = useState<SurveyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [startTime] = useState(Date.now());

  const API_BASE = getApiBaseUrl();

  useEffect(() => {
    if (surveyId) {
      fetchSurvey();
    }
  }, [surveyId]);

  const fetchSurvey = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/admin/surveys/public/${surveyId}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Survey not found');
      }
      const data = await res.json();
      setSurvey(data.survey);
    } catch (err: any) {
      setError(err.message || 'Failed to load survey');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!surveyId || !survey) return;

    // Check required questions
    const unanswered = survey.questions.filter(
      (q) => q.required && !answers[q.id || `q_${survey.questions.indexOf(q)}`]
    );
    if (unanswered.length > 0) {
      setError('Please answer all required questions.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const timeSpent = Math.round((Date.now() - startTime) / 1000);
      const formattedAnswers = survey.questions.map((q, idx) => ({
        question_id: q.id || `q_${idx}`,
        question_text: q.text,
        answer: answers[q.id || `q_${idx}`] || ''
      }));

      const res = await fetch(`${API_BASE}/api/admin/surveys/public/${surveyId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: formattedAnswers,
          user_id: 'anonymous_' + Date.now(),
          time_spent_seconds: timeSpent
        })
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to submit survey');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit survey');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading survey...</p>
        </div>
      </div>
    );
  }

  // Error state (no survey)
  if (!survey && error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-4">Survey Not Found</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  // Submitted state
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Thank You!</h1>
          <p className="text-gray-400">Your response has been submitted successfully.</p>
        </div>
      </div>
    );
  }

  if (!survey) return null;

  // Survey form
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-slate-800 rounded-xl p-8 border border-slate-700">
          {/* Header */}
          {survey.image_url && (
            <img
              src={survey.image_url}
              alt={survey.name}
              className="w-full max-h-48 object-cover rounded-lg mb-6"
            />
          )}
          <h1 className="text-2xl font-bold text-white mb-2">{survey.name}</h1>
          {survey.description && (
            <p className="text-gray-400 mb-6">{survey.description}</p>
          )}

          {/* Error message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-6">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Questions */}
          <div className="space-y-6">
            {survey.questions.map((q, idx) => {
              const qKey = q.id || `q_${idx}`;
              return (
                <div key={qKey} className="space-y-2">
                  <label className="text-gray-300 font-medium block">
                    {idx + 1}. {q.text}
                    {q.required && <span className="text-red-400 ml-1">*</span>}
                  </label>

                  {q.type === 'mcq' && q.options && (
                    <div className="space-y-2">
                      {q.options.map((opt) => (
                        <label
                          key={opt}
                          className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                            answers[qKey] === opt
                              ? 'bg-blue-600/20 border border-blue-500/50'
                              : 'bg-slate-700 hover:bg-slate-600'
                          }`}
                        >
                          <input
                            type="radio"
                            name={qKey}
                            value={opt}
                            checked={answers[qKey] === opt}
                            onChange={(e) => setAnswers(prev => ({ ...prev, [qKey]: e.target.value }))}
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
                        <label
                          key={opt}
                          className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors px-6 ${
                            answers[qKey] === opt
                              ? 'bg-blue-600/20 border border-blue-500/50'
                              : 'bg-slate-700 hover:bg-slate-600'
                          }`}
                        >
                          <input
                            type="radio"
                            name={qKey}
                            value={opt}
                            checked={answers[qKey] === opt}
                            onChange={(e) => setAnswers(prev => ({ ...prev, [qKey]: e.target.value }))}
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
                      value={answers[qKey] || ''}
                      onChange={(e) => setAnswers(prev => ({ ...prev, [qKey]: e.target.value }))}
                      className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Type your answer..."
                    />
                  )}

                  {q.type === 'number' && (
                    <input
                      type="number"
                      value={answers[qKey] || ''}
                      onChange={(e) => setAnswers(prev => ({ ...prev, [qKey]: e.target.value }))}
                      className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter a number..."
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="mt-8 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Survey'}
          </button>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-600 text-sm">
          Powered by Moustache Leads
        </div>
      </div>
    </div>
  );
};

export default SurveyPage;
