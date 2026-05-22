import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { pollRouterStatus, routeToNext, startRouterSession } from '@/services/surveyRouterApi';
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Phase =
  | 'polling'       // Waiting for postback (Scenario 2)
  | 'completed'     // Survey completed successfully
  | 'failed'        // Survey failed/DQ
  | 'quota_full'    // Quota full — routing to next
  | 'routing_next'  // Finding next survey
  | 'exhausted'     // No more surveys
  | 'error'         // Something went wrong
  | 'return';       // Returned from same-tab (Scenario 1)

export default function SurveyRouterPage() {
  const [searchParams] = useSearchParams();
  const [phase, setPhase] = useState<Phase>('polling');
  const [payout, setPayout] = useState(0);
  const [providerName, setProviderName] = useState('');
  const [surveyName, setSurveyName] = useState('');
  const [pollCount, setPollCount] = useState(0);
  const [error, setError] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sessionId = searchParams.get('session_id') || '';
  const attemptId = searchParams.get('attempt_id') || '';
  const returnStatus = searchParams.get('status') || '';
  const surveyUrl = searchParams.get('survey_url') || '';
  const funnelId = searchParams.get('funnel_id') || '';
  const nextStep = searchParams.get('next_step') || '';

  // Handle Scenario 1: User returned via URL with status
  useEffect(() => {
    if (returnStatus && sessionId) {
      if (returnStatus === 'completed') {
        setPhase('completed');
      } else if (returnStatus === 'failed') {
        setPhase('failed');
      } else if (returnStatus === 'quota_full') {
        setPhase('quota_full');
        handleRouteToNext();
      } else {
        setPhase('return');
      }
    }
  }, [returnStatus, sessionId]);

  // Handle Scenario 2: Poll for postback
  useEffect(() => {
    if (returnStatus || !sessionId) return; // Don't poll if returned via URL

    const poll = async () => {
      try {
        const data = await pollRouterStatus(sessionId, attemptId);
        setPollCount(prev => prev + 1);

        if (data.status === 'completed') {
          setPayout(data.payout || 0);
          setProviderName(data.provider_name || '');
          setSurveyName(data.survey_name || '');
          setPhase('completed');
          if (intervalRef.current) clearInterval(intervalRef.current);
        } else if (data.status === 'failed') {
          setPhase('failed');
          if (intervalRef.current) clearInterval(intervalRef.current);
        } else if (data.status === 'quota_full') {
          setPhase('quota_full');
          if (intervalRef.current) clearInterval(intervalRef.current);
          handleRouteToNext();
        }
        // else still pending — keep polling
      } catch (err) {
        console.error('Poll error:', err);
      }
    };

    // Start polling every 3 seconds
    intervalRef.current = setInterval(poll, 3000);
    // Also poll immediately
    poll();

    // Timeout after 30 minutes
    const timeout = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setPhase('error');
      setError('Survey timed out. Please try again.');
    }, 30 * 60 * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearTimeout(timeout);
    };
  }, [sessionId, attemptId, returnStatus]);

  const handleRouteToNext = useCallback(async () => {
    setPhase('routing_next');
    try {
      const data = await routeToNext(sessionId);
      if (data.success && data.redirect_url) {
        if (data.scenario === 'same_tab') {
          window.location.href = data.redirect_url;
        } else {
          // Open in new tab and resume polling
          window.open(data.redirect_url, '_blank');
          setPhase('polling');
          setPollCount(0);
        }
      } else if (data.exhausted) {
        setPhase('exhausted');
      } else {
        setPhase('error');
        setError(data.message || 'Could not find next survey');
      }
    } catch (err) {
      setPhase('error');
      setError('Failed to route to next survey');
    }
  }, [sessionId]);

  const handleTryAnother = () => {
    if (funnelId && nextStep) {
      // Redirect back to the funnel at the next step (qualification questions)
      window.location.href = `/funnel/${funnelId}?start_step=${nextStep}`;
    } else if (funnelId) {
      window.location.href = `/funnel/${funnelId}`;
    } else {
      handleRouteToNext();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 flex flex-col">
      {/* Survey in iframe (full screen when polling) */}
      {phase === 'polling' && surveyUrl && (
        <div className="fixed inset-0 z-0">
          <iframe
            src={surveyUrl}
            className="w-full h-full border-0"
            allow="camera; microphone; geolocation"
            title="Survey"
          />
        </div>
      )}

      {/* Polling spinner overlay - only show if no survey URL */}
      {phase === 'polling' && !surveyUrl && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
              <div className="mb-6">
                <Loader2 className="w-16 h-16 text-purple-500 animate-spin mx-auto" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">
                Processing...
              </h1>
              <p className="text-gray-500 text-sm mb-4">
                Please wait while we verify your response.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Result overlays (shown on top of iframe when postback arrives) */}
      {phase !== 'polling' && (
        <div className="fixed inset-0 z-10 bg-gradient-to-br from-slate-50 to-purple-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            {/* Completed */}
            {phase === 'completed' && (
              <div className="fixed inset-0 z-20 flex flex-col items-center justify-center p-6" style={{ background: 'linear-gradient(135deg, #1a4a3a 0%, #0d2b20 100%)' }}>
                {/* Animated checkmark */}
                <div className="mb-6">
                  <svg className="w-24 h-24" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(74, 222, 128, 0.2)" strokeWidth="4" />
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#4ade80" strokeWidth="4"
                      strokeDasharray="283" strokeDashoffset="283" strokeLinecap="round"
                      style={{ animation: 'circleDraw 0.6s ease-out 0.2s forwards' }} />
                    <path d="M30 52 L44 66 L70 38" fill="none" stroke="#4ade80" strokeWidth="5"
                      strokeLinecap="round" strokeLinejoin="round"
                      strokeDasharray="60" strokeDashoffset="60"
                      style={{ animation: 'checkDraw 0.4s ease-out 0.7s forwards' }} />
                  </svg>
                  <style>{`
                    @keyframes circleDraw { to { stroke-dashoffset: 0; } }
                    @keyframes checkDraw { to { stroke-dashoffset: 0; } }
                  `}</style>
                </div>
                <h1 className="text-3xl font-bold text-white mb-2" style={{ animation: 'fadeInUp 0.5s ease-out 0.9s both' }}>
                  Congratulations! 🎉
                </h1>
                <p className="text-green-200 text-center mb-1" style={{ animation: 'fadeInUp 0.5s ease-out 1.1s both' }}>
                  You&apos;ve successfully completed the survey!
                </p>
                <p className="text-green-300/70 text-sm text-center mb-8" style={{ animation: 'fadeInUp 0.5s ease-out 1.2s both' }}>
                  Your reward will be credited to your account shortly.
                </p>
                <div className="bg-white/10 backdrop-blur border border-white/20 rounded-xl p-5 max-w-sm w-full mb-8" style={{ animation: 'fadeInUp 0.5s ease-out 1.4s both' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🪙</span>
                    <div>
                      <p className="text-white font-semibold">Reward Pending</p>
                      <p className="text-green-200/70 text-sm">Your completion has been recorded. Rewards are typically credited within 24 hours.</p>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => window.close()}
                  className="bg-white/20 hover:bg-white/30 text-white border border-white/30 px-8 py-3"
                  style={{ animation: 'fadeInUp 0.5s ease-out 1.6s both' }}
                >
                  ← Done
                </Button>
                <style>{`
                  @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(16px); }
                    to { opacity: 1; transform: translateY(0); }
                  }
                `}</style>
              </div>
            )}

            {/* Failed */}
            {phase === 'failed' && (
              <div className="fixed inset-0 z-20 flex flex-col items-center justify-center p-6" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #0f0f1a 100%)' }}>
                <div className="w-20 h-20 rounded-full bg-gray-700/50 border-4 border-gray-500 flex items-center justify-center mb-6">
                  <XCircle className="w-10 h-10 text-gray-400" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">
                  Not Eligible This Time
                </h1>
                <p className="text-gray-300 text-center mb-1">
                  Unfortunately, you didn&apos;t qualify for this survey.
                </p>
                <p className="text-gray-400 text-sm text-center mb-8">
                  Don&apos;t worry — there are plenty of other offers available for you!
                </p>
                <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-5 max-w-sm w-full mb-8">
                  <p className="text-gray-300 text-sm text-center">
                    💡 Tip: Try other surveys and offers on the offerwall. Different surveys have different eligibility criteria.
                  </p>
                </div>
                <div className="flex gap-3">
                  {(nextStep && funnelId) && (
                    <Button
                      onClick={handleTryAnother}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3"
                    >
                      Try Another Survey
                    </Button>
                  )}
                  <Button
                    onClick={() => window.close()}
                    variant="outline"
                    className="border-gray-500 text-gray-300 hover:bg-white/10 px-6 py-3"
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}

            {/* Quota Full */}
            {phase === 'quota_full' && (
              <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
                <h1 className="text-lg font-bold text-gray-900">
                  Finding another survey...
                </h1>
              </div>
            )}

            {/* Routing to next */}
            {phase === 'routing_next' && (
              <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
                <h1 className="text-lg font-bold text-gray-900">
                  Finding next survey...
                </h1>
              </div>
            )}

            {/* Exhausted */}
            {phase === 'exhausted' && (
              <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                <div className="mb-6">
                  <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-2">
                  No More Surveys Available
                </h1>
                <p className="text-gray-500 text-sm mb-6">
                  Please check back later.
                </p>
                <Button variant="outline" onClick={() => window.close()} className="w-full">
                  Close
                </Button>
              </div>
            )}

            {/* Error */}
            {phase === 'error' && (
              <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                <div className="mb-6">
                  <XCircle className="w-16 h-16 text-red-400 mx-auto" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-2">
                  Something Went Wrong
                </h1>
                <p className="text-gray-500 text-sm mb-6">
                  {error || 'An unexpected error occurred.'}
                </p>
                <Button variant="outline" onClick={() => window.location.reload()} className="w-full">
                  Retry
                </Button>
              </div>
            )}

            {/* Return */}
            {phase === 'return' && (
              <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
                <h1 className="text-lg font-bold text-gray-900">
                  Processing your result...
                </h1>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
