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
  const nextSurveyUrl = searchParams.get('next_survey_url') || '';

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
    if (nextSurveyUrl) {
      // Redirect directly to the next survey
      window.location.href = nextSurveyUrl;
    } else if (funnelId) {
      // Fallback: redirect back to the funnel
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
              <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                <div className="mb-6">
                  <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Congratulations!
                </h1>
                <p className="text-gray-600 mb-4">
                  You&apos;ve successfully completed the survey.
                </p>
                {payout > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                    <p className="text-green-800 font-semibold text-lg">
                      +${payout.toFixed(2)} earned
                    </p>
                  </div>
                )}
                <Button
                  onClick={() => window.close()}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  Done
                </Button>
              </div>
            )}

            {/* Failed */}
            {phase === 'failed' && (
              <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                <div className="mb-6">
                  <XCircle className="w-16 h-16 text-red-400 mx-auto" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-2">
                  Survey Not Completed
                </h1>
                <p className="text-gray-500 text-sm mb-6">
                  {nextSurveyUrl
                    ? "You didn\u0027t qualify for this survey. Would you like to try another one?"
                    : "You didn\u0027t qualify for this survey. Please try again later."}
                </p>
                <div className="flex gap-3">
                  {nextSurveyUrl && (
                    <Button
                      onClick={handleTryAnother}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      Try Another Survey
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => window.close()}
                    className={nextSurveyUrl ? 'flex-1' : 'w-full'}
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
