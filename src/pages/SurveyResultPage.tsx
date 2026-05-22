import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, ArrowLeft, Sparkles } from 'lucide-react';

/**
 * Survey Result Page
 * 
 * This page is the redirect target after a user completes an external survey (e.g., Pepperwahl).
 * The external survey provider redirects the user here with URL params indicating pass/fail.
 * 
 * URL: /survey-result?status=pass|fail&session_id=XXX&offer_id=XXX
 * 
 * Flow:
 * 1. ML sends user to external survey with success_url and fail_url pointing here
 * 2. External survey checks eligibility and redirects user back here
 * 3. This page reads ?status= and shows congrats or sorry message
 */
export default function SurveyResultPage() {
  const [searchParams] = useSearchParams();
  const status = searchParams.get('status') || '';
  const sessionId = searchParams.get('session_id') || '';
  const offerId = searchParams.get('offer_id') || '';
  const [countdown, setCountdown] = useState(10);

  const isPassed = status === 'pass' || status === 'success' || status === 'complete';
  const isFailed = status === 'fail' || status === 'failed' || status === 'disqualified';
  const isQuota = status === 'quota' || status === 'quota_full';

  // Auto-redirect countdown (back to offerwall after 10s)
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // Success state
  if (isPassed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-green-900 to-teal-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          {/* Animated success icon */}
          <div className="relative mb-8">
            <div className="w-28 h-28 mx-auto bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-2xl shadow-green-500/30 animate-bounce">
              <CheckCircle className="w-14 h-14 text-white" />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center animate-pulse">
              <Sparkles className="w-4 h-4 text-yellow-800" />
            </div>
          </div>

          <h1 className="text-4xl font-black text-white mb-3">
            Congratulations! 🎉
          </h1>
          <p className="text-emerald-200 text-lg mb-2">
            You've successfully completed the survey!
          </p>
          <p className="text-emerald-300/70 text-sm mb-8">
            Your reward will be credited to your account shortly.
          </p>

          {/* Info card */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-emerald-400/20 mb-6">
            <div className="flex items-center justify-center gap-3 mb-3">
              <span className="text-3xl">🪙</span>
              <span className="text-2xl font-bold text-emerald-300">Reward Pending</span>
            </div>
            <p className="text-emerald-200/80 text-sm">
              Your completion has been recorded. Rewards are typically credited within 24 hours.
            </p>
          </div>

          {/* Back button */}
          <a
            href="/offerwall"
            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-semibold transition-all border border-white/20"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Offers
          </a>

          {sessionId && (
            <p className="text-emerald-400/40 text-xs mt-6">Session: {sessionId}</p>
          )}
        </div>
      </div>
    );
  }

  // Failed state
  if (isFailed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          {/* Failed icon */}
          <div className="w-28 h-28 mx-auto bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center shadow-2xl mb-8">
            <XCircle className="w-14 h-14 text-gray-300" />
          </div>

          <h1 className="text-3xl font-bold text-white mb-3">
            Not Eligible This Time
          </h1>
          <p className="text-gray-400 text-lg mb-2">
            Unfortunately, you didn't qualify for this survey.
          </p>
          <p className="text-gray-500 text-sm mb-8">
            Don't worry — there are plenty of other offers available for you!
          </p>

          {/* Encouragement card */}
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-gray-700 mb-6">
            <p className="text-gray-300 text-sm">
              💡 Tip: Try other surveys and offers on the offerwall. Different surveys have different eligibility criteria.
            </p>
          </div>

          {/* Back button */}
          <a
            href="/offerwall"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Browse More Offers
          </a>

          {sessionId && (
            <p className="text-gray-600 text-xs mt-6">Session: {sessionId}</p>
          )}
        </div>
      </div>
    );
  }

  // Quota full state
  if (isQuota) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-900 via-orange-900 to-yellow-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-28 h-28 mx-auto bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center shadow-2xl mb-8">
            <span className="text-5xl">⏳</span>
          </div>

          <h1 className="text-3xl font-bold text-white mb-3">
            Survey Full
          </h1>
          <p className="text-amber-200 text-lg mb-2">
            This survey has reached its maximum responses.
          </p>
          <p className="text-amber-300/70 text-sm mb-8">
            Check back later or try other available offers.
          </p>

          <a
            href="/offerwall"
            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-semibold transition-all border border-white/20"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Offers
          </a>
        </div>
      </div>
    );
  }

  // Unknown/missing status — show generic page
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-28 h-28 mx-auto bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-2xl mb-8">
          <span className="text-5xl">📋</span>
        </div>

        <h1 className="text-3xl font-bold text-white mb-3">
          Survey Complete
        </h1>
        <p className="text-gray-400 text-lg mb-8">
          Thank you for completing the survey. Your response has been recorded.
        </p>

        <a
          href="/offerwall"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Offers
        </a>

        {/* Debug info for testing */}
        <div className="mt-8 bg-white/5 rounded-xl p-4 text-left text-xs text-gray-500 border border-gray-800">
          <p className="font-semibold text-gray-400 mb-2">URL Parameters Received:</p>
          <p>status: {status || '(empty)'}</p>
          <p>session_id: {sessionId || '(empty)'}</p>
          <p>offer_id: {offerId || '(empty)'}</p>
        </div>
      </div>
    </div>
  );
}
