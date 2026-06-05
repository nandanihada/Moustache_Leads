/**
 * Survey Template Renderer
 * Renders survey questions using the selected template layout.
 * Used by: Qualification Survey, Survey Funnel Router, Survey Builder (gateway)
 * 
 * ALL templates follow the SAME layout format:
 * - Full page, immersive background
 * - Icon-based design with professional typography
 * - Questions displayed on the LEFT panel
 * - Progress + Submit button on the RIGHT panel
 * - Each template has unique gradient background + accent color
 * - Supports per-page question grouping via question.page property
 * 
 * Templates:
 * 1. "modern-card" — Indigo/violet gradient, bold and modern
 * 2. "split-panel" — Emerald/teal gradient, fresh and natural
 * 3. "step-wizard" — Sunset orange gradient, warm and energetic
 * 4. "minimal-form" — Deep violet/purple gradient, elegant premium
 * 5. "conversational" — Ocean blue gradient, calm and trustworthy
 */

import { useState } from 'react';
import { createPortal } from 'react-dom';

export type TemplateName = 'modern-card' | 'split-panel' | 'step-wizard' | 'minimal-form' | 'conversational' | 'moustache-default';

export interface SurveyQuestion {
  text: string;
  options: string[];
  icon?: string;
  page?: number;
  allowMultiple?: boolean; // true = user can select multiple options
}

export interface SurveyTemplateProps {
  template: TemplateName;
  title: string;
  description?: string;
  questions: SurveyQuestion[];
  answers: Record<number, string | string[]>;
  onAnswer: (questionIndex: number, answer: string | string[]) => void;
  onSubmit: () => void;
  submitting?: boolean;
  brandColor?: string;
  logoUrl?: string;
  questionsPerPage?: number;
}

export default function SurveyTemplateRenderer(props: SurveyTemplateProps) {
  switch (props.template) {
    case 'modern-card': return <UnifiedTemplate {...props} themeName="modern-card" />;
    case 'split-panel': return <UnifiedTemplate {...props} themeName="split-panel" />;
    case 'step-wizard': return <UnifiedTemplate {...props} themeName="step-wizard" />;
    case 'minimal-form': return <UnifiedTemplate {...props} themeName="minimal-form" />;
    case 'conversational': return <UnifiedTemplate {...props} themeName="conversational" />;
    case 'moustache-default': return <UnifiedTemplate {...props} themeName="moustache-default" />;
    default: return <UnifiedTemplate {...props} themeName="modern-card" />;
  }
}

// ==================== THEME CONFIGURATION ====================

interface ThemeConfig {
  // Background gradient for the left panel
  bgGradient: string;
  // Decorative pattern overlay
  patternOpacity: number;
  // Card styling
  cardBg: string;
  cardShadow: string;
  // Accent colors
  accent: string;
  accentDark: string;
  accentLight: string;
  accentGlow: string;
  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  // Right panel
  rightPanelBg: string;
  rightPanelAccent: string;
  // Progress ring
  progressTrack: string;
  progressFill: string;
  // Submit button
  submitGradient: string;
  submitShadow: string;
  // Radio/option styling
  optionBorder: string;
  optionSelectedBg: string;
  optionSelectedBorder: string;
  // Icon
  iconBg: string;
  iconColor: string;
  // Number badge
  numberBg: string;
  numberColor: string;
  // Font
  fontFamily: string;
  headingFont: string;
}

const THEMES: Record<TemplateName, ThemeConfig> = {
  'modern-card': {
    bgGradient: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #a855f7 100%)',
    patternOpacity: 0.05,
    cardBg: '#ffffff',
    cardShadow: '0 25px 60px -12px rgba(79, 70, 229, 0.25)',
    accent: '#6366f1',
    accentDark: '#4f46e5',
    accentLight: '#eef2ff',
    accentGlow: 'rgba(99, 102, 241, 0.15)',
    textPrimary: '#1e1b4b',
    textSecondary: '#4338ca',
    textMuted: '#6b7280',
    rightPanelBg: 'linear-gradient(180deg, #fafafe 0%, #f0f0ff 100%)',
    rightPanelAccent: '#6366f1',
    progressTrack: '#e0e7ff',
    progressFill: '#6366f1',
    submitGradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    submitShadow: '0 10px 30px -5px rgba(99, 102, 241, 0.4)',
    optionBorder: '#e0e7ff',
    optionSelectedBg: '#eef2ff',
    optionSelectedBorder: '#6366f1',
    iconBg: '#eef2ff',
    iconColor: '#6366f1',
    numberBg: '#6366f1',
    numberColor: '#ffffff',
    fontFamily: "'DM Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    headingFont: "'Space Grotesk', 'DM Sans', sans-serif",
  },
  'split-panel': {
    bgGradient: 'linear-gradient(135deg, #059669 0%, #0d9488 50%, #14b8a6 100%)',
    patternOpacity: 0.04,
    cardBg: '#ffffff',
    cardShadow: '0 25px 60px -12px rgba(5, 150, 105, 0.25)',
    accent: '#0d9488',
    accentDark: '#0f766e',
    accentLight: '#f0fdfa',
    accentGlow: 'rgba(13, 148, 136, 0.12)',
    textPrimary: '#134e4a',
    textSecondary: '#0f766e',
    textMuted: '#6b7280',
    rightPanelBg: 'linear-gradient(180deg, #fafffe 0%, #f0fdf9 100%)',
    rightPanelAccent: '#0d9488',
    progressTrack: '#ccfbf1',
    progressFill: '#0d9488',
    submitGradient: 'linear-gradient(135deg, #0d9488 0%, #059669 100%)',
    submitShadow: '0 10px 30px -5px rgba(13, 148, 136, 0.4)',
    optionBorder: '#ccfbf1',
    optionSelectedBg: '#f0fdfa',
    optionSelectedBorder: '#0d9488',
    iconBg: '#f0fdfa',
    iconColor: '#0d9488',
    numberBg: '#0d9488',
    numberColor: '#ffffff',
    fontFamily: "'DM Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    headingFont: "'Space Grotesk', 'DM Sans', sans-serif",
  },
  'step-wizard': {
    bgGradient: 'linear-gradient(135deg, #ea580c 0%, #dc2626 50%, #f97316 100%)',
    patternOpacity: 0.04,
    cardBg: '#ffffff',
    cardShadow: '0 25px 60px -12px rgba(234, 88, 12, 0.25)',
    accent: '#ea580c',
    accentDark: '#c2410c',
    accentLight: '#fff7ed',
    accentGlow: 'rgba(234, 88, 12, 0.12)',
    textPrimary: '#431407',
    textSecondary: '#c2410c',
    textMuted: '#6b7280',
    rightPanelBg: 'linear-gradient(180deg, #fffcfa 0%, #fff7ed 100%)',
    rightPanelAccent: '#ea580c',
    progressTrack: '#fed7aa',
    progressFill: '#ea580c',
    submitGradient: 'linear-gradient(135deg, #ea580c 0%, #dc2626 100%)',
    submitShadow: '0 10px 30px -5px rgba(234, 88, 12, 0.4)',
    optionBorder: '#fed7aa',
    optionSelectedBg: '#fff7ed',
    optionSelectedBorder: '#ea580c',
    iconBg: '#fff7ed',
    iconColor: '#ea580c',
    numberBg: '#ea580c',
    numberColor: '#ffffff',
    fontFamily: "'DM Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    headingFont: "'Space Grotesk', 'DM Sans', sans-serif",
  },
  'minimal-form': {
    bgGradient: 'linear-gradient(135deg, #7c3aed 0%, #9333ea 50%, #c026d3 100%)',
    patternOpacity: 0.05,
    cardBg: '#ffffff',
    cardShadow: '0 25px 60px -12px rgba(124, 58, 237, 0.25)',
    accent: '#7c3aed',
    accentDark: '#6d28d9',
    accentLight: '#f5f3ff',
    accentGlow: 'rgba(124, 58, 237, 0.12)',
    textPrimary: '#2e1065',
    textSecondary: '#6d28d9',
    textMuted: '#6b7280',
    rightPanelBg: 'linear-gradient(180deg, #fdfcff 0%, #f5f3ff 100%)',
    rightPanelAccent: '#7c3aed',
    progressTrack: '#ede9fe',
    progressFill: '#7c3aed',
    submitGradient: 'linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)',
    submitShadow: '0 10px 30px -5px rgba(124, 58, 237, 0.4)',
    optionBorder: '#ede9fe',
    optionSelectedBg: '#f5f3ff',
    optionSelectedBorder: '#7c3aed',
    iconBg: '#f5f3ff',
    iconColor: '#7c3aed',
    numberBg: '#7c3aed',
    numberColor: '#ffffff',
    fontFamily: "'DM Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    headingFont: "'Space Grotesk', 'DM Sans', sans-serif",
  },
  'conversational': {
    bgGradient: 'linear-gradient(135deg, #0369a1 0%, #0284c7 50%, #0ea5e9 100%)',
    patternOpacity: 0.04,
    cardBg: '#ffffff',
    cardShadow: '0 25px 60px -12px rgba(3, 105, 161, 0.25)',
    accent: '#0284c7',
    accentDark: '#0369a1',
    accentLight: '#f0f9ff',
    accentGlow: 'rgba(2, 132, 199, 0.12)',
    textPrimary: '#0c4a6e',
    textSecondary: '#0369a1',
    textMuted: '#6b7280',
    rightPanelBg: 'linear-gradient(180deg, #fafeff 0%, #f0f9ff 100%)',
    rightPanelAccent: '#0284c7',
    progressTrack: '#bae6fd',
    progressFill: '#0284c7',
    submitGradient: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
    submitShadow: '0 10px 30px -5px rgba(2, 132, 199, 0.4)',
    optionBorder: '#bae6fd',
    optionSelectedBg: '#f0f9ff',
    optionSelectedBorder: '#0284c7',
    iconBg: '#f0f9ff',
    iconColor: '#0284c7',
    numberBg: '#0284c7',
    numberColor: '#ffffff',
    fontFamily: "'DM Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    headingFont: "'Space Grotesk', 'DM Sans', sans-serif",
  },
  'moustache-default': {
    bgGradient: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e1b4b 100%)',
    patternOpacity: 0.03,
    cardBg: '#1e293b',
    cardShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.5)',
    accent: '#3b82f6',
    accentDark: '#2563eb',
    accentLight: '#1e3a5f',
    accentGlow: 'rgba(59, 130, 246, 0.15)',
    textPrimary: '#f1f5f9',
    textSecondary: '#93c5fd',
    textMuted: '#94a3b8',
    rightPanelBg: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
    rightPanelAccent: '#3b82f6',
    progressTrack: '#334155',
    progressFill: '#3b82f6',
    submitGradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    submitShadow: '0 10px 30px -5px rgba(59, 130, 246, 0.4)',
    optionBorder: '#334155',
    optionSelectedBg: '#1e3a5f',
    optionSelectedBorder: '#3b82f6',
    iconBg: '#1e3a5f',
    iconColor: '#3b82f6',
    numberBg: '#3b82f6',
    numberColor: '#ffffff',
    fontFamily: "'DM Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    headingFont: "'Space Grotesk', 'DM Sans', sans-serif",
  },
};

// Template-specific icons (SVG paths)
const TEMPLATE_ICONS: Record<TemplateName, JSX.Element> = {
  'modern-card': (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
    </svg>
  ),
  'split-panel': (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
    </svg>
  ),
  'step-wizard': (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
  'minimal-form': (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  ),
  'conversational': (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /><path d="M8 9h8" /><path d="M8 13h4" />
    </svg>
  ),
  'moustache-default': (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /><path d="M14 8h4" /><path d="M14 12h4" /><path d="M14 16h4" />
    </svg>
  ),
};


// ==================== UNIFIED TEMPLATE COMPONENT ====================
// Same layout for ALL templates — only colors/backgrounds/fonts differ

function UnifiedTemplate({ title, description, questions, answers, onAnswer, onSubmit, submitting, themeName, questionsPerPage }: SurveyTemplateProps & { themeName: TemplateName }) {
  const theme = THEMES[themeName];
  const totalQuestions = questions.length;
  // A question is answered if its answer is a non-empty string or a non-empty array
  const isQuestionAnswered = (idx: number) => {
    const ans = answers[idx];
    if (ans === undefined || ans === null) return false;
    if (Array.isArray(ans)) return ans.length > 0;
    return ans !== '';
  };
  const answeredCount = questions.filter((_, idx) => isQuestionAnswered(idx)).length;
  const allAnswered = answeredCount >= totalQuestions;

  // Per-page pagination support
  const perPage = questionsPerPage || 0; // 0 = show all
  const [currentPage, setCurrentPage] = useState(0);

  // Group questions by page property or by perPage setting
  const getVisibleQuestions = (): { questions: (SurveyQuestion & { _origIdx: number })[]; totalPages: number } => {
    if (perPage > 0) {
      const totalPages = Math.ceil(totalQuestions / perPage);
      const start = currentPage * perPage;
      const end = Math.min(start + perPage, totalQuestions);
      const visible = questions.slice(start, end).map((q, i) => ({ ...q, _origIdx: start + i }));
      return { questions: visible, totalPages };
    }
    // If questions have page property, group by that
    const hasPages = questions.some(q => q.page !== undefined);
    if (hasPages) {
      const pageGroups: Record<number, (SurveyQuestion & { _origIdx: number })[]> = {};
      questions.forEach((q, i) => {
        const p = q.page ?? 0;
        if (!pageGroups[p]) pageGroups[p] = [];
        pageGroups[p].push({ ...q, _origIdx: i });
      });
      const pageKeys = Object.keys(pageGroups).map(Number).sort((a, b) => a - b);
      const totalPages = pageKeys.length;
      const visible = pageGroups[pageKeys[currentPage]] || [];
      return { questions: visible, totalPages };
    }
    // Show all
    return { questions: questions.map((q, i) => ({ ...q, _origIdx: i })), totalPages: 1 };
  };

  const { questions: visibleQuestions, totalPages } = getVisibleQuestions();
  const isMultiPage = totalPages > 1;
  const isLastPage = currentPage >= totalPages - 1;
  const pageAllAnswered = visibleQuestions.every(q => isQuestionAnswered(q._origIdx));

  return (
    <div style={{ fontFamily: theme.fontFamily }} className="h-screen flex flex-col md:flex-row overflow-hidden">
      {/* ===== LEFT PANEL: Questions ===== */}
      <div className="flex-1 relative overflow-y-auto" style={{ background: theme.bgGradient }}>
        {/* Decorative background pattern */}
        <div className="absolute inset-0 pointer-events-none" style={{ opacity: theme.patternOpacity }}>
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id={`grid-${themeName}`} width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#grid-${themeName})`} />
          </svg>
        </div>

        {/* Floating decorative circles */}
        <div className="absolute top-20 left-10 w-64 h-64 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }} />
        <div className="absolute bottom-20 right-10 w-48 h-48 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }} />

        {/* Content */}
        <div className="relative z-10 flex items-start justify-center p-6 md:p-10 lg:p-14 min-h-full">
          <div
            className="w-full max-w-2xl rounded-3xl overflow-hidden"
            style={{
              backgroundColor: theme.cardBg,
              boxShadow: theme.cardShadow,
            }}
          >
            {/* Card Header */}
            <div className="px-8 pt-8 pb-5 border-b" style={{ borderColor: theme.optionBorder }}>
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: theme.iconBg, color: theme.iconColor }}
                >
                  {TEMPLATE_ICONS[themeName]}
                </div>
                <div className="flex-1 min-w-0">
                  <h1
                    className="text-[22px] font-bold tracking-tight leading-tight"
                    style={{ color: theme.textPrimary, fontFamily: theme.headingFont }}
                  >
                    {title}
                  </h1>
                  <p className="text-[13px] mt-1 leading-relaxed" style={{ color: theme.textMuted }}>
                    {description || 'Please answer the following questions to continue.'}
                  </p>
                </div>
              </div>

              {/* Page indicator for multi-page */}
              {isMultiPage && (
                <div className="flex items-center gap-2 mt-4">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <div
                      key={i}
                      className="h-1.5 rounded-full flex-1 transition-all duration-500"
                      style={{
                        backgroundColor: i <= currentPage ? theme.accent : theme.progressTrack,
                        opacity: i <= currentPage ? 1 : 0.5,
                      }}
                    />
                  ))}
                  <span className="text-[11px] font-medium ml-2" style={{ color: theme.textMuted }}>
                    {currentPage + 1}/{totalPages}
                  </span>
                </div>
              )}
            </div>

            {/* Questions List */}
            <div className="px-8 py-6 space-y-6">
              {visibleQuestions.map((q) => {
                const qIdx = q._origIdx;
                const isAnswered = isQuestionAnswered(qIdx);
                // Normalise current answer for this question
                const rawAnswer = answers[qIdx];
                const selectedOpts: string[] = q.allowMultiple
                  ? (Array.isArray(rawAnswer) ? rawAnswer : rawAnswer ? [rawAnswer as string] : [])
                  : [];

                const handleOptionClick = (opt: string) => {
                  if (q.allowMultiple) {
                    // Toggle the option in the selected array
                    const current: string[] = Array.isArray(rawAnswer) ? [...rawAnswer] : (rawAnswer ? [rawAnswer as string] : []);
                    const idx = current.indexOf(opt);
                    if (idx >= 0) {
                      current.splice(idx, 1);
                    } else {
                      current.push(opt);
                    }
                    onAnswer(qIdx, current);
                  } else {
                    onAnswer(qIdx, opt);
                  }
                };

                return (
                  <div
                    key={qIdx}
                    className="flex items-start gap-4 p-4 rounded-2xl transition-all duration-300"
                    style={{
                      backgroundColor: isAnswered ? theme.accentGlow : 'transparent',
                      border: `1px solid ${isAnswered ? theme.optionSelectedBorder + '30' : 'transparent'}`,
                    }}
                  >
                    {/* Question number badge */}
                    <span
                      className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-[13px] font-bold shadow-sm"
                      style={{
                        backgroundColor: isAnswered ? theme.numberBg : theme.iconBg,
                        color: isAnswered ? theme.numberColor : theme.accent,
                      }}
                    >
                      {isAnswered ? '✓' : qIdx + 1}
                    </span>

                    {/* Question content */}
                    <div className="flex-1 pt-0.5">
                      <p
                        className="font-semibold text-[15px] leading-snug mb-1"
                        style={{ color: theme.textPrimary, fontFamily: theme.fontFamily }}
                      >
                        {q.text}
                      </p>
                      {q.allowMultiple && (
                        <p className="text-[11px] mb-2" style={{ color: theme.textMuted }}>
                          Select all that apply
                        </p>
                      )}

                      {/* Options as pill buttons */}
                      <div className="flex flex-wrap gap-2">
                        {q.options.map((opt, optIdx) => {
                          const isSelected = q.allowMultiple
                            ? selectedOpts.includes(opt)
                            : rawAnswer === opt;
                          return (
                            <button
                              key={optIdx}
                              onClick={() => handleOptionClick(opt)}
                              className="px-4 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 border-2 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-1.5"
                              style={{
                                borderColor: isSelected ? theme.optionSelectedBorder : theme.optionBorder,
                                backgroundColor: isSelected ? theme.optionSelectedBg : theme.cardBg,
                                color: isSelected ? theme.accent : theme.textPrimary,
                                fontWeight: isSelected ? 600 : 500,
                                boxShadow: isSelected ? `0 2px 8px ${theme.accentGlow}` : 'none',
                              }}
                            >
                              {q.allowMultiple ? (
                                /* Checkbox indicator for multi-select */
                                <span
                                  className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 text-[10px]"
                                  style={{
                                    borderColor: isSelected ? theme.accent : theme.textMuted,
                                    backgroundColor: isSelected ? theme.accent : 'transparent',
                                    color: '#fff',
                                  }}
                                >
                                  {isSelected ? '✓' : ''}
                                </span>
                              ) : (
                                isSelected && <span>●</span>
                              )}
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Page navigation (only for multi-page) */}
            {isMultiPage && (
              <div className="px-8 pb-6 flex items-center justify-between">
                <button
                  onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                  className="px-5 py-2.5 rounded-xl text-[13px] font-semibold border-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-[1.02]"
                  style={{ borderColor: theme.optionBorder, color: theme.textPrimary }}
                >
                  ← Previous
                </button>
                {!isLastPage && (
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={!pageAllAnswered}
                    className="px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02]"
                    style={{ background: theme.submitGradient }}
                  >
                    Continue →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== RIGHT PANEL: Submit ===== */}
      <div
        className="w-full md:w-[320px] lg:w-[360px] flex flex-col border-l flex-shrink-0"
        style={{ background: theme.rightPanelBg, borderColor: theme.optionBorder }}
      >
        <div className="flex-1 flex flex-col justify-center items-center px-8 py-12">
          {/* Decorative icon */}
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center mb-8"
            style={{ backgroundColor: theme.iconBg, color: theme.iconColor }}
          >
            {allAnswered ? (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" />
              </svg>
            ) : (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" />
              </svg>
            )}
          </div>

          {/* Status text */}
          <h3
            className="text-xl font-bold mb-2 text-center"
            style={{ color: theme.textPrimary, fontFamily: theme.headingFont }}
          >
            {allAnswered ? 'Ready to Submit' : 'Complete the Survey'}
          </h3>
          <p className="text-[13px] text-center mb-10 leading-relaxed max-w-[220px]" style={{ color: theme.textMuted }}>
            {allAnswered
              ? 'All questions answered. Click below to continue.'
              : 'Answer all questions on the left to unlock submission.'
            }
          </p>

          {/* Submit Button */}
          <button
            onClick={onSubmit}
            disabled={!allAnswered || submitting}
            className="w-full py-4 rounded-2xl text-white font-bold text-[15px] tracking-wide transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none hover:shadow-xl hover:scale-[1.03] active:scale-[0.97]"
            style={{
              background: allAnswered ? theme.submitGradient : '#d1d5db',
              boxShadow: allAnswered ? theme.submitShadow : 'none',
              fontFamily: theme.fontFamily,
            }}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                </svg>
                Submitting...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Submit
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
                </svg>
              </span>
            )}
          </button>
        </div>

        {/* Footer branding */}
        <div className="px-6 py-4 border-t text-center" style={{ borderColor: theme.optionBorder }}>
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase" style={{ color: theme.textMuted }}>
            Powered by Moustache Leads
          </p>
        </div>
      </div>
    </div>
  );
}


// ==================== TEMPLATE PICKER (for admin) ====================

export const TEMPLATE_OPTIONS: { id: TemplateName; name: string; description: string; icon: string }[] = [
  { id: 'moustache-default', name: 'Moustache Default', description: 'Dark blue/slate, professional dark mode', icon: '🖤' },
  { id: 'modern-card', name: 'Indigo', description: 'Purple-blue gradient, bold and modern', icon: '🎯' },
  { id: 'split-panel', name: 'Emerald', description: 'Teal-green gradient, fresh and natural', icon: '🌿' },
  { id: 'step-wizard', name: 'Sunset', description: 'Orange-red gradient, warm and energetic', icon: '🔥' },
  { id: 'minimal-form', name: 'Violet', description: 'Deep purple gradient, elegant premium', icon: '💎' },
  { id: 'conversational', name: 'Ocean', description: 'Blue gradient, calm and trustworthy', icon: '🌊' },
];

export function TemplatePicker({ value, onChange, questions, onQuestionsPageChange }: {
  value: TemplateName;
  onChange: (t: TemplateName) => void;
  questions?: SurveyQuestion[];
  onQuestionsPageChange?: (questions: SurveyQuestion[]) => void;
}) {
  const [previewTemplate, setPreviewTemplate] = useState<TemplateName | null>(null);
  const [previewAnswers, setPreviewAnswers] = useState<Record<number, string | string[]>>({});
  const [showDropdown, setShowDropdown] = useState(false);

  // Use actual questions or sample questions for preview
  const sampleQuestions: SurveyQuestion[] = questions && questions.length > 0 && questions[0].text
    ? questions
    : [
        { text: 'What is your age range?', options: ['18-24', '25-34', '35-44', '45-54', '55+'] },
        { text: 'What is your employment status?', options: ['Employed Full-time', 'Part-time', 'Self-employed', 'Student', 'Retired'] },
        { text: 'Do you have health insurance?', options: ['Yes', 'No', 'Not sure'] },
        { text: 'What is your household income?', options: ['Under $30k', '$30k-$50k', '$50k-$75k', '$75k-$100k', 'Over $100k'] },
      ];

  const openPreview = (templateId: TemplateName) => {
    setPreviewTemplate(templateId);
    onChange(templateId); // Immediately select the template on click
    setPreviewAnswers({});
  };

  const switchTemplate = (templateId: TemplateName) => {
    setPreviewTemplate(templateId);
    onChange(templateId); // Also select when switching in dropdown
    setPreviewAnswers({});
    setShowDropdown(false);
  };

  const selectAndClose = () => {
    if (previewTemplate) {
      onChange(previewTemplate);
      if (onQuestionsPageChange && questions) {
        onQuestionsPageChange(questions);
      }
    }
    setPreviewTemplate(null);
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TEMPLATE_OPTIONS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => openPreview(t.id)}
            className={`text-left p-4 rounded-xl border-2 transition-all hover:scale-[1.02] ${
              value === t.id
                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="text-2xl mb-2">{t.icon}</div>
            <p className="font-semibold text-sm text-gray-900">{t.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
            {value === t.id && <p className="text-[10px] text-blue-600 font-semibold mt-1">✓ Active</p>}
          </button>
        ))}
      </div>

      {/* Full-screen Preview Overlay — rendered via portal to escape dialog overflow */}
      {previewTemplate && createPortal(
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          {/* Top Bar */}
          <div className="flex items-center justify-between px-6 py-3 bg-white border-b shadow-sm flex-shrink-0 z-[110] relative">
            <div className="flex items-center gap-3">
              {/* Template Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <span className="text-lg">{TEMPLATE_OPTIONS.find(t => t.id === previewTemplate)?.icon}</span>
                  <span className="text-sm font-semibold text-gray-800">{TEMPLATE_OPTIONS.find(t => t.id === previewTemplate)?.name}</span>
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {showDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl py-2 min-w-[240px] z-50">
                    {TEMPLATE_OPTIONS.map(t => (
                      <button
                        key={t.id}
                        onClick={() => switchTemplate(t.id)}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-3 ${previewTemplate === t.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
                      >
                        <span className="text-lg">{t.icon}</span>
                        <div>
                          <p className="font-medium">{t.name}</p>
                          <p className="text-[10px] text-gray-400">{t.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">Live Preview — Exactly what users see</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPreviewAnswers({})} className="px-3 py-2 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Reset
              </button>
              <button onClick={selectAndClose} className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">
                Use This Template
              </button>
              <button onClick={() => setPreviewTemplate(null)} className="px-3 py-2 text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
          </div>

          {/* Actual Template Render */}
          <div className="flex-1 overflow-auto">
            <SurveyTemplateRenderer
              template={previewTemplate}
              title="Survey Preview"
              description="This is how your survey will look to users"
              questions={sampleQuestions}
              answers={previewAnswers}
              onAnswer={(qIdx, answer) => setPreviewAnswers(prev => ({ ...prev, [qIdx]: answer }))}
              onSubmit={() => { setPreviewAnswers({}); }}
              submitting={false}
              brandColor="#6366f1"
            />
          </div>
        </div>
      , document.body)}
    </>
  );
}
