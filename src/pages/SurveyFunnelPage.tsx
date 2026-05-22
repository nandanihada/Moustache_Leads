/**
 * Standalone Survey Funnel Page
 * Opens at /funnel/:funnelId — full screen, no navigation, just the survey
 * Production URL: survey.moustacheleads.com/funnel/{id}
 * Local URL: localhost:8080/funnel/{id}
 * 
 * Flow with spinners:
 * 1. User answers survey → Submit
 * 2. Show spinner for X seconds (admin-configurable, default 8s)
 * 3. Show pass/fail message
 * 4. Show spinner again for X seconds
 * 5. If pass → redirect to offer URL
 *    If fail + has next → load next survey
 *    If fail + no next → show final fail message
 * 
 * Timeout: If user spends more than Y minutes (admin-configurable, default 5 min)
 * on a survey, auto-submit/skip to next survey.
 * 
 * Add ?template=split-panel to URL to override template
 * Add ?admin=1 to show template switcher dropdown
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import SurveyTemplateRenderer, { TemplateName, TEMPLATE_OPTIONS } from '@/components/survey-templates/SurveyTemplateRenderer';
import { getApiBaseUrl } from '@/services/apiConfig';

type FunnelPhase = 
  | 'loading'           // Initial load
  | 'survey'            // User is answering questions
  | 'processing'        // Spinner after submit (before showing result)
  | 'result'            // Showing pass/fail message
  | 'transitioning'     // Spinner after result (before redirect or next survey)
  | 'error'             // Error state
  | 'final-fail';       // Final fail — no more surveys

export default function SurveyFunnelPage() {
  const { funnelId } = useParams<{ funnelId: string }>();
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('user_id') || 'anonymous';
  const templateOverride = searchParams.get('template') as TemplateName | null;
  const isAdmin = searchParams.get('admin') === '1';
  const startStep = parseInt(searchParams.get('start_step') || '0', 10);
  const baseUrl = getApiBaseUrl();

  // Core state
  const [phase, setPhase] = useState<FunnelPhase>('loading');
  const [error, setError] = useState('');
  const [session, setSession] = useState('');
  const [step, setStep] = useState(0);
  const [survey, setSurvey] = useState<any>(null);
  const [template, setTemplate] = useState<TemplateName>(templateOverride || 'modern-card');
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showTemplateSwitcher, setShowTemplateSwitcher] = useState(false);
  const [questionsPerPage, setQuestionsPerPage] = useState(0);

  // Spinner/timing settings (from backend, admin-configurable)
  const [spinnerDuration, setSpinnerDuration] = useState(8); // seconds
  const [surveyTimeout, setSurveyTimeout] = useState(5);     // minutes

  // Result data
  const [resultData, setResultData] = useState<{
    type: 'pass' | 'fail';
    message: string;
    redirect_url?: string;
    has_next?: boolean;
    next_step_index?: number;
    next_survey?: any;
  } | null>(null);

  // Timeout tracking
  const surveyStartTime = useRef<number>(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (funnelId) startFunnel();
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [funnelId]);

  // Survey timeout — auto-advance if user spends too long
  useEffect(() => {
    if (phase === 'survey' && surveyTimeout > 0) {
      surveyStartTime.current = Date.now();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        handleTimeout();
      }, surveyTimeout * 60 * 1000);
    }
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [phase, step, surveyTimeout]);

  const startFunnel = async () => {
    try {
      setPhase('loading');
      const res = await fetch(`${baseUrl}/api/survey-funnel/${funnelId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, start_step: startStep })
      });
      if (!res.ok) throw new Error('Funnel not found');
      const data = await res.json();
      setSession(data.session_id);
      setStep(data.step_index);
      setSurvey(data.survey);
      setTemplate(templateOverride || (data.survey_template as TemplateName) || 'modern-card');
      setQuestionsPerPage(data.questions_per_page || 0);
      setSpinnerDuration(data.spinner_duration || 8);
      setSurveyTimeout(data.survey_timeout || 5);
      setAnswers({});
      setResultData(null);
      setPhase('survey');
    } catch (e: any) {
      setError(e.message || 'Failed to load survey');
      setPhase('error');
    }
  };

  const handleTimeout = () => {
    // User spent too long — reload page to show next survey
    window.location.reload();
  };

  const handleSubmit = async () => {
    if (!funnelId || !survey) return;
    setSubmitting(true);

    // Open a blank tab IMMEDIATELY (while we still have user gesture context)
    // This prevents popup blockers. We'll use it later if needed, or close it.
    const preOpenedTab = window.open('about:blank', '_blank');
    // Show a loading state in the new tab so user doesn't see blank page
    if (preOpenedTab) {
      preOpenedTab.document.write('<html><head><title>Loading...</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8f5ff}div{text-align:center}.spinner{width:48px;height:48px;border:4px solid #e5e7eb;border-top-color:#8b5cf6;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 16px}@keyframes spin{to{transform:rotate(360deg)}}h2{color:#1f2937;font-size:18px;margin-bottom:8px}p{color:#6b7280;font-size:14px}</style></head><body><div><div class="spinner"></div><h2>Loading your survey...</h2><p>Please wait</p></div></body></html>');
      preOpenedTab.document.close();
    }

    // Phase 1: Show processing spinner
    setPhase('processing');

    try {
      const answersList = Object.entries(answers).map(([qIdx, answer]) => ({
        question_index: Number(qIdx),
        answer
      }));

      const res = await fetch(`${baseUrl}/api/survey-funnel/${funnelId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session, step_index: step, answers: answersList })
      });

      if (res.ok) {
        const data = await res.json();

        // Wait for spinner duration before showing result
        await delay(spinnerDuration * 1000);

        if (data.result === 'passed') {
          setResultData({
            type: 'pass',
            message: data.message,
            redirect_url: data.redirect_url,
          });
          setPhase('result');

          // Check if this step uses the survey router
          if (data.use_survey_router && data.router_partner_id) {
            // Route to external survey via survey router
            setTimeout(async () => {
              setPhase('transitioning');
              try {
                const { startRouterSession } = await import('@/services/surveyRouterApi');
                const routerRes = await startRouterSession({
                  user_id: 'anonymous',
                  funnel_id: funnelId || '',
                  qualification_answers: Object.entries(answers).map(([qIdx, answer]) => ({
                    question_index: Number(qIdx),
                    answer
                  })),
                  partner_id: data.router_partner_id,
                  redirect_url: data.redirect_url || '',
                  scenario: data.router_scenario || 'new_tab',
                  next_redirect_url: data.next_redirect_url || '',
                  next_step_index: data.next_step_index ?? -1,
                });
                if (routerRes.success) {
                  const targetUrl = routerRes.redirect_url || data.redirect_url;
                  const scenario = data.router_scenario || 'new_tab';
                  
                  if (scenario === 'same_tab' && targetUrl) {
                    // Same tab: close pre-opened tab, redirect current tab
                    if (preOpenedTab && !preOpenedTab.closed) preOpenedTab.close();
                    window.location.href = targetUrl;
                  } else if (targetUrl) {
                    // New tab: navigate pre-opened tab to survey, current tab to polling
                    if (preOpenedTab && !preOpenedTab.closed) {
                      preOpenedTab.location.href = targetUrl;
                    }
                    window.location.href = `/survey-router/poll?session_id=${routerRes.session_id}&attempt_id=${routerRes.attempt_id}`;
                  } else {
                    if (preOpenedTab && !preOpenedTab.closed) preOpenedTab.close();
                    window.location.href = `/survey-router/poll?session_id=${routerRes.session_id}&attempt_id=${routerRes.attempt_id}`;
                  }
                } else if (data.redirect_url) {
                  // Fallback: just redirect to pass_url directly
                  if (preOpenedTab && !preOpenedTab.closed) preOpenedTab.close();
                  window.location.href = data.redirect_url;
                }
              } catch (err) {
                console.error('Survey router start failed:', err);
                // Fallback: redirect directly
                if (preOpenedTab && !preOpenedTab.closed) preOpenedTab.close();
                if (data.redirect_url) {
                  window.location.href = data.redirect_url;
                }
                setPhase('result');
              }
            }, 3000);
          } else {
            // Normal redirect to offer URL — close pre-opened tab
            if (preOpenedTab && !preOpenedTab.closed) preOpenedTab.close();
            setTimeout(() => {
              setPhase('transitioning');
              setTimeout(() => {
                if (data.redirect_url) {
                  window.location.href = data.redirect_url;
                }
              }, spinnerDuration * 1000);
            }, 3000); // Show pass message for 3 seconds
          }

        } else {
          // Failed — close pre-opened tab
          if (preOpenedTab && !preOpenedTab.closed) preOpenedTab.close();
          setResultData({
            type: 'fail',
            message: data.message,
            has_next: data.has_next,
            next_step_index: data.next_step_index,
            next_survey: data.next_survey,
          });
          setPhase('result');

          if (data.has_next && data.next_survey) {
            // After showing fail message, spin again then load next survey
            setTimeout(() => {
              setPhase('transitioning');
              setTimeout(() => {
                setStep(data.next_step_index);
                setSurvey(data.next_survey);
                setAnswers({});
                setResultData(null);
                setPhase('survey');
              }, spinnerDuration * 1000);
            }, 3000); // Show fail message for 3 seconds
          } else {
            // Final fail — no more surveys
            setTimeout(() => {
              setPhase('final-fail');
            }, 3000);
          }
        }
      }
    } catch (e) {
      console.error('Submit failed:', e);
      setPhase('survey'); // Go back to survey on error
    } finally {
      setSubmitting(false);
    }
  };

  // Helper
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // ==================== RENDER PHASES ====================

  // Loading
  if (phase === 'loading') {
    return <SpinnerScreen message="Loading survey..." accent={getAccentColor(template)} />;
  }

  // Error
  if (phase === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-white">
        <div className="text-center max-w-md p-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-50 flex items-center justify-center">
            <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Survey Not Available</h2>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  // Processing spinner (after submit, before showing result)
  if (phase === 'processing') {
    return <SpinnerScreen message="Checking your answers..." accent={getAccentColor(template)} />;
  }

  // Result screen (pass or fail message)
  if (phase === 'result' && resultData) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${getAccentColor(template)}08 0%, white 50%, ${getAccentColor(template)}05 100%)` }}>
        <div className="text-center max-w-md p-8 animate-fadeIn">
          {resultData.type === 'pass' ? (
            <>
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-green-50 flex items-center justify-center animate-scaleIn">
                <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Congratulations! 🎉
              </h2>
              <p className="text-gray-600 text-[15px] leading-relaxed">{resultData.message}</p>
            </>
          ) : (
            <>
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-orange-50 flex items-center justify-center animate-scaleIn">
                <span className="text-4xl">{resultData.has_next ? '🔄' : '😔'}</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                {resultData.has_next ? "Not quite..." : "Sorry!"}
              </h2>
              <p className="text-gray-600 text-[15px] leading-relaxed">{resultData.message}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // Transitioning spinner (after result, before redirect or next survey)
  if (phase === 'transitioning') {
    const msg = resultData?.type === 'pass'
      ? 'Redirecting to your offer...'
      : 'Loading next qualification survey...';
    return <SpinnerScreen message={msg} accent={getAccentColor(template)} />;
  }

  // Final fail — no more surveys
  if (phase === 'final-fail') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-white">
        <div className="text-center max-w-md p-8">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center">
            <span className="text-4xl">😔</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            No Offers Available
          </h2>
          <p className="text-gray-500 text-[15px] leading-relaxed">
            {resultData?.message || 'Sorry, you do not qualify for any offers at this time.'}
          </p>
        </div>
      </div>
    );
  }

  // Survey phase — show the actual survey
  if (!survey) return null;

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Admin Template Switcher Dropdown */}
      {(isAdmin || templateOverride) && (
        <div className="fixed top-4 left-4 z-50">
          <div className="relative">
            <button
              onClick={() => setShowTemplateSwitcher(!showTemplateSwitcher)}
              className="flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur border border-gray-200 rounded-lg shadow-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <span>{TEMPLATE_OPTIONS.find(t => t.id === template)?.icon}</span>
              <span>{TEMPLATE_OPTIONS.find(t => t.id === template)?.name}</span>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {showTemplateSwitcher && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[200px] z-50">
                {TEMPLATE_OPTIONS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setTemplate(t.id); setShowTemplateSwitcher(false); setAnswers({}); }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 ${template === t.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
                  >
                    <span>{t.icon}</span>
                    <span className="font-medium">{t.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <SurveyTemplateRenderer
        template={template}
        title={survey.title || 'Survey'}
        description={`Step ${step + 1}`}
        questions={(survey.questions || []).map((q: any) => ({ text: q.text, options: q.options || [] }))}
        answers={answers}
        onAnswer={(qIdx, answer) => setAnswers(prev => ({ ...prev, [qIdx]: answer }))}
        onSubmit={handleSubmit}
        submitting={submitting}
        brandColor="#6366f1"
        questionsPerPage={questionsPerPage}
      />

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
        .animate-fadeIn { animation: fadeIn 0.5s ease-out; }
        .animate-scaleIn { animation: scaleIn 0.4s ease-out; }
      `}</style>
    </div>
  );
}

// ==================== SPINNER SCREEN COMPONENT ====================

function SpinnerScreen({ message, accent }: { message: string; accent: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${accent}08 0%, white 50%, ${accent}05 100%)` }}>
      <div className="text-center">
        {/* Animated spinner */}
        <div className="relative w-20 h-20 mx-auto mb-8">
          <div
            className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin"
            style={{ borderColor: `${accent}30`, borderTopColor: accent }}
          />
          <div
            className="absolute inset-2 rounded-full border-4 border-b-transparent animate-spin"
            style={{ borderColor: `${accent}15`, borderBottomColor: `${accent}80`, animationDirection: 'reverse', animationDuration: '1.5s' }}
          />
          <div
            className="absolute inset-4 rounded-full border-4 border-t-transparent animate-spin"
            style={{ borderColor: `${accent}10`, borderTopColor: `${accent}60`, animationDuration: '2s' }}
          />
        </div>
        <p className="text-gray-600 text-[15px] font-medium" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          {message}
        </p>
        {/* Animated dots */}
        <div className="flex items-center justify-center gap-1 mt-3">
          <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: accent, animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: accent, animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: accent, animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

// ==================== HELPER ====================

function getAccentColor(template: TemplateName): string {
  const colors: Record<TemplateName, string> = {
    'modern-card': '#6366f1',
    'split-panel': '#0d9488',
    'step-wizard': '#ea580c',
    'minimal-form': '#7c3aed',
    'conversational': '#0284c7',
    'moustache-default': '#3b82f6',
  };
  return colors[template] || '#6366f1';
}
