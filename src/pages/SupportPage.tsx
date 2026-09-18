import React, { useEffect, useState, useRef } from 'react';
import {
  MessageCircle, Send, Plus, RefreshCw, Clock, CheckCircle2, ArrowLeft,
  Image, X, Star, Award, UploadCloud, Gift, ArrowUpRight, ThumbsUp, ThumbsDown, Sparkles,
} from 'lucide-react';
import { supportApi, SupportMessage, SupportTopic, TOPIC_LABELS, TOPIC_COLORS } from '@/services/supportApi';
import { getApiBaseUrl } from '@/services/apiConfig';
import { getAuthToken } from '@/utils/cookies';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useImagePaste } from '@/hooks/useImagePaste';

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

// ── Intake wizard definition ──────────────────────────────────────────────────
interface WizardQuestion {
  key: string;
  label: string;
  kind: 'text' | 'textarea' | 'choice' | 'multi';
  prompt: string;
  ph?: string;
  options?: string[];
  // If set, call intakeCheck with this check_type after the user answers this step
  smartCheck?: 'offer_id' | 'postback_url' | 'email' | 'payment';
  // If set, auto-run this check when this step becomes active (no user input needed)
  autoCheck?: 'payment';
}

const TOPIC_QUESTIONS: Record<SupportTopic, WizardQuestion[]> = {
  postback: [
    {
      key: 'postback_url', label: 'Postback URL', kind: 'text',
      prompt: 'Could you share your postback URL?',
      ph: 'https://yourtracker.com/pb?cid={click_id}',
      smartCheck: 'postback_url',
    },
    {
      key: 'macros', label: 'Problem macros', kind: 'multi',
      prompt: 'Which macro(s) are giving you trouble? Tap any that apply.',
      options: ['{click_id}', '{payout}', '{offer_id}', '{affiliate_id}', '{transaction_id}', '{sub1}', '{sub2}', '{sub3}', '{currency}', '{status}'],
    },
    {
      key: 'issue', label: 'Issue', kind: 'textarea',
      prompt: 'Anything else we should know? (error message, expected vs actual behaviour)',
    },
  ],
  iframe: [
    {
      key: 'iframe_page', label: 'Page URL', kind: 'text',
      prompt: 'What page is the iFrame embedded on?',
      ph: 'https://yoursite.com/offers',
    },
    {
      key: 'iframe_issue', label: 'Issue type', kind: 'choice',
      prompt: 'What issue are you seeing?',
      options: ['Not loading', 'Blank white', 'Shows error', 'Styling broken', 'Wrong offers showing', 'Other'],
    },
    {
      key: 'issue', label: 'Additional details', kind: 'textarea',
      prompt: 'Any additional details? (browser, device, console errors)',
    },
  ],
  offers: [
    {
      key: 'offer_id', label: 'Offer', kind: 'text',
      prompt: 'Which offer is affected? (name or ID)',
      smartCheck: 'offer_id',
    },
    {
      key: 'offer_sub', label: 'Problem', kind: 'choice',
      prompt: "What's the problem?",
      options: ["Can't find it", 'Paused unexpectedly', 'Cap reached too fast', 'No access', 'Wrong payout', 'Other'],
    },
    {
      key: 'issue', label: 'Extra context', kind: 'textarea',
      prompt: 'Any extra context?',
    },
  ],
  payment: [
    {
      key: 'payment_method', label: 'Payment method', kind: 'choice',
      prompt: 'Which payment method are you using?',
      options: ['Bank Transfer', 'PayPal', 'Payoneer', 'Crypto', 'Gift Card', 'Other'],
      autoCheck: 'payment',
    },
    {
      key: 'expected_amount', label: 'Expected amount', kind: 'text',
      prompt: 'What amount were you expecting?',
      ph: '$0.00',
    },
    {
      key: 'issue', label: 'Issue', kind: 'textarea',
      prompt: 'Describe the issue — when was it expected, what happened instead?',
    },
  ],
  signup: [
    {
      key: 'email', label: 'Email', kind: 'text',
      prompt: 'Which email address is affected?',
      smartCheck: 'email',
    },
    {
      key: 'signup_sub', label: 'Issue type', kind: 'choice',
      prompt: "What's the issue?",
      options: ['Verification email not received', 'Account not approved', 'Want to change email', "Can't log in", 'Other'],
    },
    {
      key: 'issue', label: 'Additional details', kind: 'textarea',
      prompt: 'Any other details?',
    },
  ],
  credit: [
    {
      key: 'offer_advertiser', label: 'Offer / Advertiser', kind: 'text',
      prompt: 'Which offer / advertiser is the credit for?',
      smartCheck: 'offer_id',
    },
    {
      key: 'expected_credit', label: 'Expected credit', kind: 'text',
      prompt: 'How much credit are you expecting?',
      ph: '$0.00',
    },
    {
      key: 'issue', label: 'Issue', kind: 'textarea',
      prompt: 'What happened? (not credited, late, reversed)',
    },
  ],
  other: [
    {
      key: 'issue', label: 'Issue', kind: 'textarea',
      prompt: "Tell us what's going on. We'll help.",
      ph: 'Login issue, API question, bugs, anything else...',
    },
  ],
};

const TOPIC_SUBTITLES: Record<SupportTopic, string> = {
  postback: 'Not firing, setup, testing',
  iframe: 'Not loading, embedding, styling',
  offers: "Can't find, access, paused, caps",
  payment: 'Next payment, not received, method',
  signup: 'Verification, approval, change email',
  credit: 'Not credited, late, reversed',
  other: 'Login, API, bugs, anything else',
};

type HistoryEntry =
  | { kind: 'qa'; question: string; answer: string }
  | { kind: 'check'; message: string; ok: boolean };

type WizardStep = {
  questionIdx: number;
  answers: Record<string, string | string[]>;
  history: HistoryEntry[];
};

// ── Small helper sub-components ──────────────────────────────────────────────
const renderMarkdown = (text: string) => {
  // Simple bold (**text**) and newline rendering
  const parts = text.split(/(\*\*[^*]+\*\*|\n)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part === '\n') return <br key={i} />;
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
};

const MLBubble: React.FC<{ message: string; ok?: boolean; isCheck?: boolean }> = ({ message, ok, isCheck }) => (
  <div className="flex items-start gap-3">
    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isCheck ? (ok ? 'bg-green-600' : 'bg-amber-500') : 'bg-primary'}`}>
      <span className="text-[10px] font-bold text-white">ML</span>
    </div>
    <div className={`rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[82%] text-sm ${
      isCheck
        ? ok
          ? 'bg-green-50 border border-green-200 text-green-900'
          : 'bg-amber-50 border border-amber-200 text-amber-900'
        : 'bg-muted/60 text-foreground'
    }`}>
      {renderMarkdown(message)}
    </div>
  </div>
);

const UserBubble: React.FC<{ text: string; username?: string }> = ({ text, username }) => (
  <div className="flex justify-end">
    <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%]">
      <p className="text-sm">{text}</p>
    </div>
  </div>
);

// ── Component ─────────────────────────────────────────────────────────────────
const SupportPage: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SupportMessage | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const saveDraftTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Wizard state — when active, right panel shows the wizard
  const [wizard, setWizard] = useState<{ topic: SupportTopic; step: WizardStep } | null>(null);
  const [wizardInput, setWizardInput] = useState('');
  const [wizardChips, setWizardChips] = useState<string[]>([]);
  const [submittingWizard, setSubmittingWizard] = useState(false);
  const [smartChecking, setSmartChecking] = useState(false);
  const wizardEndRef = useRef<HTMLDivElement>(null);

  // Rating modal state
  const [showRating, setShowRating] = useState(false);
  const [ratingTicketId, setRatingTicketId] = useState<string>('');
  const [ratingThumb, setRatingThumb] = useState<'up' | 'down' | null>(null);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  // Review & Rewards States
  const [activeTab, setActiveTab] = useState<'inbox' | 'review'>('inbox');
  const [reviewUrl, setReviewUrl] = useState('');
  const [reviewSubmission, setReviewSubmission] = useState<any>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [selectedProofFile, setSelectedProofFile] = useState<File | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string>('');

  // Reply image
  const [replyImageUrl, setReplyImageUrl] = useState('');
  const [replyUploading, setReplyUploading] = useState(false);
  const replyFileRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Smart Questions polling
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPollAtRef = useRef<string>('');
  // SQ answer state: keyed by reply._id
  const [sqAnswers, setSqAnswers] = useState<Record<string, string>>({});
  const [sqSubmitting, setSqSubmitting] = useState<Record<string, boolean>>({});

  const handleImageUpload = async (file: File) => {
    setReplyUploading(true);
    try {
      const res = await supportApi.uploadImage(file);
      if (res.success && res.image_url) { setReplyImageUrl(res.image_url); toast.success('Image uploaded'); }
      else toast.error(res.error || 'Upload failed');
    } catch { toast.error('Upload failed'); }
    finally { setReplyUploading(false); }
  };

  useImagePaste(
    (file) => { handleImageUpload(file); toast.success('Image pasted from clipboard'); },
    { onError: (msg) => toast.error(msg) }
  );

  const fetchReviewUrl = async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/platform-settings/review-us`);
      const data = await res.json();
      if (data.url) setReviewUrl(data.url);
    } catch { /* silent */ }
  };

  const fetchReviewSubmission = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;
      const res = await fetch(`${getApiBaseUrl()}/api/user/review-submissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setReviewSubmission(data.submission || null);
    } catch { /* silent */ }
  };

  const handleReviewFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setSelectedProofFile(file); setProofPreviewUrl(URL.createObjectURL(file)); }
  };

  const handleUploadReviewProof = async () => {
    if (!selectedProofFile) return;
    setUploadingProof(true);
    try {
      const token = getAuthToken();
      const formData = new FormData();
      formData.append('file', selectedProofFile);
      const uploadRes = await fetch(`${getApiBaseUrl()}/api/files/upload`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || uploadData.error) throw new Error(uploadData.error || 'Upload failed');
      const submitRes = await fetch(`${getApiBaseUrl()}/api/user/review-submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ proof_image_url: uploadData.access_url }),
      });
      const submitData = await submitRes.json();
      if (!submitRes.ok || submitData.error) throw new Error(submitData.error || 'Submission failed');
      toast.success('Review proof submitted! Waiting for admin approval.');
      setSelectedProofFile(null); setProofPreviewUrl('');
      fetchReviewSubmission();
    } catch (err: any) { toast.error(err.message || 'Failed to submit'); }
    finally { setUploadingProof(false); }
  };

  const handleReviewButtonClick = () => {
    window.open(reviewUrl || 'https://trustpilot.com', '_blank');
    const token = getAuthToken();
    if (token) {
      fetch(`${getApiBaseUrl()}/api/user/review-button-click`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  };

  useEffect(() => { fetchReviewUrl(); fetchReviewSubmission(); }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    const newDrafts: Record<string, string> = { ...drafts };
    let updated = false;
    messages.forEach(msg => {
      const storageKey = `pub_draft_${msg._id}`;
      const localVal = localStorage.getItem(storageKey);
      if (localVal) {
        if (newDrafts[msg._id] !== localVal) { newDrafts[msg._id] = localVal; updated = true; }
      } else if (msg.user_draft) {
        localStorage.setItem(storageKey, msg.user_draft);
        newDrafts[msg._id] = msg.user_draft; updated = true;
      }
    });
    if (updated) setDrafts(newDrafts);
  }, [messages]);

  const handleReplyTextChange = (val: string) => {
    setReplyText(val);
    if (!selected) return;
    const storageKey = `pub_draft_${selected._id}`;
    const newDrafts = { ...drafts };
    if (val.trim()) {
      newDrafts[selected._id] = val;
      localStorage.setItem(storageKey, val);
      if (saveDraftTimeoutRef.current) clearTimeout(saveDraftTimeoutRef.current);
      saveDraftTimeoutRef.current = setTimeout(() => {
        supportApi.saveDraft(selected._id, val).catch(() => {});
      }, 1500);
    } else {
      delete newDrafts[selected._id];
      localStorage.removeItem(storageKey);
      if (saveDraftTimeoutRef.current) clearTimeout(saveDraftTimeoutRef.current);
      supportApi.deleteDraft(selected._id).catch(() => {});
    }
    setDrafts(newDrafts);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await supportApi.getMyMessages();
      if (res.success) {
        setMessages(res.messages);
        if (selected) {
          const updated = res.messages.find(m => m._id === selected._id);
          if (updated) setSelected(updated);
        }
      }
    } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    supportApi.markRepliesRead().catch(() => {});
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [selected?.replies?.length]);
  useEffect(() => { wizardEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [wizard?.step.questionIdx]);

  // ── Smart Questions polling ──────────────────────────────────────────────
  // Poll every 15s when publisher has an open ticket open.
  // Merges new replies (system SQ bubbles + admin replies) into selected state.
  useEffect(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (!selected || selected.status === 'closed') return;

    // Reset poll timestamp when switching tickets
    lastPollAtRef.current = selected.updated_at || selected.created_at || '';

    const doPoll = async () => {
      try {
        const res = await supportApi.pollMessage(selected._id, lastPollAtRef.current);
        if (!res.success || !res.new_replies?.length) return;

        // Merge new replies into selected without full reload
        setSelected(prev => {
          if (!prev || prev._id !== selected._id) return prev;
          const existingIds = new Set(prev.replies.map(r => r._id));
          const toAdd = res.new_replies.filter(r => !existingIds.has(r._id));
          if (!toAdd.length) return prev;
          return { ...prev, replies: [...prev.replies, ...toAdd] };
        });
        setMessages(prev => prev.map(m => {
          if (m._id !== selected._id) return m;
          const existingIds = new Set(m.replies.map(r => r._id));
          const toAdd = res.new_replies.filter(r => !existingIds.has(r._id));
          if (!toAdd.length) return m;
          return { ...m, replies: [...m.replies, ...toAdd] };
        }));

        // Update since timestamp to avoid re-fetching same replies
        if (res.updated_at) lastPollAtRef.current = res.updated_at;
      } catch { /* silent — non-critical */ }
    };

    pollIntervalRef.current = setInterval(doPoll, 15_000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [selected?._id, selected?.status]);

  const openConversation = (msg: SupportMessage) => {
    setWizard(null);
    setSelected(msg);
    if (saveDraftTimeoutRef.current) clearTimeout(saveDraftTimeoutRef.current);
    setReplyText(drafts[msg._id] || '');
    if (msg.status === 'replied' && !msg.read_by_user) {
      supportApi.markRepliesRead().catch(() => {});
      setMessages(prev => prev.map(m => m._id === msg._id ? { ...m, read_by_user: true } : m));
    }
  };

  // ── Wizard logic ─────────────────────────────────────────────────────────────
  const startWizard = () => {
    setSelected(null);
    setWizard(null); // show topic picker first
    setWizard({ topic: 'postback', step: { questionIdx: -1, answers: {}, history: [] } }); // -1 = topic picker screen
  };

  const selectTopic = async (topic: SupportTopic) => {
    const firstQ = TOPIC_QUESTIONS[topic][0];
    const newStep: WizardStep = { questionIdx: 0, answers: {}, history: [] };
    setWizard({ topic, step: newStep });
    setWizardInput('');
    setWizardChips([]);

    // Auto-check for payment topic: fetch payment summary and put it into history
    if (firstQ.autoCheck === 'payment') {
      setSmartChecking(true);
      try {
        const result = await supportApi.intakeCheck('payment', '');
        setWizard(prev => prev ? {
          ...prev,
          step: {
            ...prev.step,
            history: [{ kind: 'check', message: result.message, ok: result.ok }],
          }
        } : prev);
      } catch { /* silent */ }
      finally { setSmartChecking(false); }
    }
  };

  const currentQuestion = wizard && wizard.step.questionIdx >= 0
    ? TOPIC_QUESTIONS[wizard.topic][wizard.step.questionIdx]
    : null;

  const advanceWizard = async () => {
    if (!wizard || !currentQuestion) return;
    const q = currentQuestion;
    let answer: string;

    if (q.kind === 'multi' || q.kind === 'choice') {
      answer = wizardChips.length > 0 ? wizardChips.join(', ') : 'Not specified';
    } else {
      answer = wizardInput.trim();
      if (!answer && q.key !== 'issue') return;
      if (!answer) answer = 'Not provided';
    }

    // Add the Q&A pair to history immediately
    const qaEntry: HistoryEntry = { kind: 'qa', question: q.prompt, answer };
    const historyWithQA: HistoryEntry[] = [...wizard.step.history, qaEntry];
    const newAnswers = { ...wizard.step.answers, [q.key]: (q.kind === 'multi' || q.kind === 'choice') ? wizardChips : answer };
    const nextIdx = wizard.step.questionIdx + 1;
    const questions = TOPIC_QUESTIONS[wizard.topic];

    setWizardInput('');
    setWizardChips([]);

    if (q.smartCheck) {
      const checkValue = (q.kind === 'multi' || q.kind === 'choice') ? wizardChips.join(', ') : answer;

      // Commit Q&A to history first so user sees their answer immediately
      setWizard(prev => prev ? {
        ...prev,
        step: { ...prev.step, history: historyWithQA, answers: newAnswers }
      } : prev);

      setSmartChecking(true);
      try {
        const result = await supportApi.intakeCheck(q.smartCheck, checkValue);
        // Append check result into history — it stays there permanently
        const checkEntry: HistoryEntry = { kind: 'check', message: result.message, ok: result.ok };
        const historyWithCheck: HistoryEntry[] = [...historyWithQA, checkEntry];

        if (nextIdx >= questions.length) {
          // Last question — show check result then submit
          setWizard(prev => prev ? {
            ...prev,
            step: { ...prev.step, history: historyWithCheck, answers: newAnswers }
          } : prev);
          setTimeout(() => submitWizard(wizard.topic, newAnswers, historyWithCheck), 1500);
        } else {
          // Advance to next question — check result stays in history
          setWizard(prev => prev ? {
            ...prev,
            step: {
              questionIdx: nextIdx,
              answers: newAnswers,
              history: historyWithCheck,
            }
          } : prev);
        }
      } catch {
        // On error, just advance without a check bubble
        if (nextIdx >= questions.length) {
          submitWizard(wizard.topic, newAnswers, historyWithQA);
        } else {
          setWizard(prev => prev ? {
            ...prev,
            step: { questionIdx: nextIdx, answers: newAnswers, history: historyWithQA }
          } : prev);
        }
      } finally {
        setSmartChecking(false);
      }
      return;
    }

    // No smart check — advance normally
    if (nextIdx >= questions.length) {
      setWizard(prev => prev ? {
        ...prev,
        step: { ...prev.step, history: historyWithQA, answers: newAnswers }
      } : prev);
      submitWizard(wizard.topic, newAnswers, historyWithQA);
    } else {
      setWizard(prev => prev ? {
        ...prev,
        step: { questionIdx: nextIdx, answers: newAnswers, history: historyWithQA }
      } : prev);
    }
  };

  const submitWizard = async (topic: SupportTopic, answers: Record<string, string | string[]>, history: HistoryEntry[]) => {
    setSubmittingWizard(true);
    try {
      // Build readable body from QA entries only (skip check bubbles)
      const body = history
        .filter((h): h is Extract<HistoryEntry, { kind: 'qa' }> => h.kind === 'qa')
        .map(h => `Q: ${h.question}\nA: ${h.answer}`)
        .join('\n\n');
      const subject = TOPIC_LABELS[topic];
      const res = await supportApi.sendMessage(subject, body, undefined, topic);
      if (res.success) {
        toast.success('Support request submitted!');
        setWizard(null);
        await load();
        if (res.message) { setSelected(res.message); }
      } else {
        toast.error(res.error || 'Failed to submit');
      }
    } finally {
      setSubmittingWizard(false);
    }
  };

  const toggleChip = (chip: string) => {
    if (!currentQuestion) return;
    if (currentQuestion.kind === 'multi') {
      setWizardChips(prev => prev.includes(chip) ? prev.filter(c => c !== chip) : [...prev, chip]);
    } else {
      // single choice — toggle off if already selected, otherwise replace
      setWizardChips(prev => prev.includes(chip) ? [] : [chip]);
    }
  };

  // ── Reply & close ─────────────────────────────────────────────────────────────
  const handleReply = async () => {
    if (!selected || (!replyText.trim() && !replyImageUrl)) return;
    setReplying(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${getApiBaseUrl()}/api/support/messages/${selected._id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reply: replyText, image_url: replyImageUrl || undefined }),
      }).then(r => r.json());
      if (res.success) {
        toast.success('Reply sent');
        setReplyText(''); setReplyImageUrl('');
        const newDrafts = { ...drafts };
        delete newDrafts[selected._id];
        setDrafts(newDrafts);
        localStorage.removeItem(`pub_draft_${selected._id}`);
        if (saveDraftTimeoutRef.current) clearTimeout(saveDraftTimeoutRef.current);
        setSelected(res.message);
        setMessages(prev => prev.map(m => m._id === res.message._id ? res.message : m));
      } else { toast.error(res.error || 'Failed to send'); }
    } finally { setReplying(false); }
  };

  const handleClose = async () => {
    if (!selected) return;
    try {
      const token = getAuthToken();
      const res = await fetch(`${getApiBaseUrl()}/api/support/messages/${selected._id}/close`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      }).then(r => r.json());
      if (res.success) {
        toast.success('Conversation closed');
        setSelected(res.message);
        setMessages(prev => prev.map(m => m._id === res.message._id ? res.message : m));
        if (!res.message.user_rating) {
          setRatingTicketId(res.message._id); setRatingThumb(null); setRatingComment(''); setShowRating(true);
        }
      } else { toast.error(res.error || 'Failed to close'); }
    } catch { toast.error('Failed to close'); }
  };

  // ── Smart Question answer handler ────────────────────────────────────────
  const handleSqAnswer = async (sqReplyId: string) => {
    if (!selected) return;
    const answer = (sqAnswers[sqReplyId] || '').trim();
    if (!answer) return;
    setSqSubmitting(prev => ({ ...prev, [sqReplyId]: true }));
    try {
      const res = await supportApi.answerSmartQuestion(selected._id, answer, sqReplyId);
      if (res.success) {
        // Mark the SQ as answered locally
        setSelected(prev => prev ? {
          ...prev,
          replies: prev.replies.map(r =>
            r._id === sqReplyId ? { ...r, answered: true } : r
          ).concat(res.reply),
        } : prev);
        setSqAnswers(prev => { const n = { ...prev }; delete n[sqReplyId]; return n; });
      } else {
        toast.error('Failed to submit answer');
      }
    } catch { toast.error('Failed to submit answer'); }
    finally { setSqSubmitting(prev => ({ ...prev, [sqReplyId]: false })); }
  };

  const handleSubmitRating = async () => {
    if (!ratingThumb) return toast.error('Please select thumbs up or down');
    setSubmittingRating(true);
    try {
      const res = await supportApi.rateTicket(ratingTicketId, ratingThumb, ratingComment);
      if (res.success) { toast.success('Thanks for your feedback!'); setShowRating(false); }
      else toast.error(res.error || 'Failed to submit rating');
    } catch { toast.error('Failed to submit rating'); }
    finally { setSubmittingRating(false); }
  };

  const newMsgCount = messages.filter(m => m.status === 'replied' && !m.read_by_user).length;
  const openCount = messages.filter(m => m.status === 'open').length;
  const closedCount = messages.filter(m => m.status === 'closed').length;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-primary" />
            Support & Rewards Hub
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Interact with support staff, manage tickets, and submit ratings for balance rewards</p>
        </div>
        {activeTab === 'inbox' && (
          <div className="flex gap-2">
            <button onClick={load} className="flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-2 hover:bg-muted transition-colors">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button
              onClick={startWizard}
              className="flex items-center gap-2 text-sm bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" /> New Message
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border border-border bg-card/60 backdrop-blur-md rounded-xl p-1 gap-1">
        <button
          onClick={() => setActiveTab('inbox')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === 'inbox' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
        >
          <MessageCircle className="w-4 h-4" /> Support Inbox
        </button>
        <button
          onClick={() => setActiveTab('review')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === 'review' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
        >
          <Star className="w-4 h-4 fill-amber-400 text-amber-400" /> Review Us & Earn Cash
        </button>
      </div>

      {activeTab === 'inbox' ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total', value: messages.length, color: 'text-blue-600 bg-blue-50' },
              { label: 'New from Support', value: newMsgCount, color: 'text-green-600 bg-green-50' },
              { label: 'Waiting for Reply', value: openCount, color: 'text-yellow-600 bg-yellow-50' },
              { label: 'Closed', value: closedCount, color: 'text-gray-600 bg-gray-50' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl p-4 border border-border ${s.color}`}>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-sm font-medium mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Main inbox layout */}
          <div className="flex gap-4 h-[600px]">
            {/* Left: Message list */}
            <div className={`${(selected || wizard) ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-shrink-0 flex-col border border-border rounded-xl overflow-hidden bg-card`}>
              <div className="px-4 py-3 border-b border-border bg-muted/30">
                <p className="text-sm font-semibold text-foreground">Conversations ({messages.length})</p>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-border">
                {loading ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">Loading...</div>
                ) : messages.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    No messages yet
                  </div>
                ) : (
                  messages.map(msg => {
                    const isUnread = msg.status === 'replied' && !msg.read_by_user;
                    const replyCount = msg.replies?.length || 0;
                    return (
                      <button
                        key={msg._id}
                        onClick={() => openConversation(msg)}
                        className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${selected?._id === msg._id ? 'bg-primary/5 border-l-2 border-primary' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              {isUnread && <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 animate-pulse" />}
                              <p className={`text-sm truncate ${isUnread ? 'font-bold' : 'font-medium'}`}>{msg.subject}</p>
                            </div>
                            {msg.topic && (
                              <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded-full font-semibold mt-0.5 ${TOPIC_COLORS[msg.topic]}`}>
                                {TOPIC_LABELS[msg.topic]}
                              </span>
                            )}
                            {drafts[msg._id] ? (
                              <p className="text-xs text-red-500 font-medium truncate mt-0.5"><span className="font-semibold">[Draft]</span> {drafts[msg._id]}</p>
                            ) : (
                              <>
                                {isUnread && <p className="text-xs text-green-600 font-semibold mt-0.5">🟢 New Message from Support</p>}
                                {msg.status === 'open' && <p className="text-xs text-yellow-600 mt-0.5">⏳ Waiting for reply...</p>}
                                {msg.status === 'closed' && <p className="text-xs text-gray-500 mt-0.5">Closed</p>}
                                {msg.status === 'replied' && msg.read_by_user && <p className="text-xs text-blue-600 mt-0.5">✓ Read</p>}
                              </>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-xs text-muted-foreground">{fmt(msg.updated_at || msg.created_at)}</p>
                              {replyCount > 0 && (
                                <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{replyCount + 1} messages</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Thread or Wizard */}
            <div className={`${(selected || wizard) ? 'flex' : 'hidden md:flex'} flex-1 flex-col border border-border rounded-xl overflow-hidden bg-card`}>

              {/* ── WIZARD: topic picker ── */}
              {wizard && wizard.step.questionIdx === -1 && (
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
                    <button onClick={() => { setWizard(null); setSelected(null); }} className="md:hidden text-muted-foreground hover:text-foreground">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                      <h2 className="font-semibold text-foreground text-lg">New request</h2>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto px-6 py-8">
                    <div className="max-w-xl mx-auto">
                      <h3 className="text-xl font-bold text-foreground mb-1">What's it about?</h3>
                      <p className="text-sm text-muted-foreground mb-6">Pick the closest topic. We'll ask one question at a time.</p>
                      <div className="grid grid-cols-2 gap-3">
                        {(Object.keys(TOPIC_LABELS) as SupportTopic[]).map(t => (
                          <button
                            key={t}
                            onClick={() => selectTopic(t)}
                            className="text-left px-5 py-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all group"
                          >
                            <p className="font-semibold text-foreground group-hover:text-primary transition-colors">{TOPIC_LABELS[t]}</p>
                            <p className="text-xs text-muted-foreground mt-1">{TOPIC_SUBTITLES[t]}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── WIZARD: chat-style Q&A ── */}
              {wizard && wizard.step.questionIdx >= 0 && (
                <div className="flex flex-col h-full">
                  {/* Header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <div className="flex items-center gap-3">
                      <button onClick={() => {
                        if (wizard.step.questionIdx === 0) {
                          setWizard({ ...wizard, step: { ...wizard.step, questionIdx: -1 } });
                        } else {
                          // strip last QA entry from history and go back one step
                          const prevHistory = wizard.step.history.filter(h => h.kind !== 'check').slice(0, -1) as HistoryEntry[];
                          setWizard({ ...wizard, step: { ...wizard.step, questionIdx: wizard.step.questionIdx - 1, history: prevHistory } });
                        }
                        setWizardInput(''); setWizardChips([]);
                      }} className="text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <div>
                        <h2 className="font-semibold text-foreground">New request: {TOPIC_LABELS[wizard.topic]}</h2>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        Question {wizard.step.questionIdx + 1} of {TOPIC_QUESTIONS[wizard.topic].length}
                      </span>
                      <button onClick={() => { setWizard(null); setWizardInput(''); setWizardChips([]); }} className="text-muted-foreground hover:text-foreground">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Chat history + current question */}
                  <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                    {/* History: QA pairs and check results — all live here permanently */}
                    {wizard.step.history.map((h, i) => {
                      if (h.kind === 'check') {
                        return <MLBubble key={i} message={h.message} ok={h.ok} isCheck />;
                      }
                      return (
                        <div key={i} className="space-y-2">
                          <MLBubble message={h.question} />
                          <UserBubble text={h.answer} username={user?.username} />
                        </div>
                      );
                    })}

                    {/* Current question + input (hidden while smartChecking waiting for next step) */}
                    {currentQuestion && !smartChecking && (
                      <div className="space-y-3">
                        <MLBubble message={currentQuestion.prompt} />

                        {/* Chips input (multi or single choice) */}
                        {(currentQuestion.kind === 'multi' || currentQuestion.kind === 'choice') && (
                          <div className="ml-11">
                            <div className="flex flex-wrap gap-2 mb-3">
                              {currentQuestion.options?.map(chip => (
                                <button
                                  key={chip}
                                  onClick={() => toggleChip(chip)}
                                  className={`px-3 py-1.5 rounded-full border text-sm transition-all ${
                                    wizardChips.includes(chip)
                                      ? 'bg-primary text-primary-foreground border-primary'
                                      : 'border-border text-foreground hover:border-primary hover:bg-primary/5'
                                  }`}
                                >
                                  {chip}
                                </button>
                              ))}
                            </div>
                            <div className="flex justify-end">
                              <button
                                onClick={advanceWizard}
                                disabled={wizardChips.length === 0 || smartChecking}
                                className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Text input */}
                        {currentQuestion.kind === 'text' && (
                          <div className="ml-11 flex gap-2">
                            <input
                              value={wizardInput}
                              onChange={e => setWizardInput(e.target.value)}
                              placeholder={currentQuestion.ph}
                              className="flex-1 text-sm border border-border rounded-xl px-4 py-2.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                              onKeyDown={e => { if (e.key === 'Enter') advanceWizard(); }}
                              autoFocus
                              disabled={smartChecking}
                            />
                            <button
                              onClick={advanceWizard}
                              disabled={!wizardInput.trim() || smartChecking}
                              className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                            >
                              Next
                            </button>
                          </div>
                        )}

                        {/* Textarea input */}
                        {currentQuestion.kind === 'textarea' && (
                          <div className="ml-11 space-y-2">
                            <textarea
                              value={wizardInput}
                              onChange={e => setWizardInput(e.target.value)}
                              placeholder={currentQuestion.ph || 'Type here...'}
                              rows={4}
                              className="w-full text-sm border border-border rounded-xl px-4 py-3 bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) advanceWizard(); }}
                              autoFocus
                              disabled={smartChecking}
                            />
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-muted-foreground">Ctrl+Enter to submit</p>
                              <button
                                onClick={advanceWizard}
                                disabled={submittingWizard || smartChecking}
                                className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                              >
                                {submittingWizard ? (
                                  <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending...</>
                                ) : (
                                  <><Send className="w-4 h-4" /> Submit</>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Smart checking spinner */}
                    {smartChecking && (
                      <div className="flex items-center gap-3 ml-1">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-primary-foreground">ML</span>
                        </div>
                        <div className="bg-muted/60 rounded-2xl rounded-tl-sm px-4 py-2.5 flex items-center gap-2">
                          <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          <span className="text-sm text-muted-foreground">Checking...</span>
                        </div>
                      </div>
                    )}

                    <div ref={wizardEndRef} />
                  </div>
                </div>
              )}

              {/* ── THREAD VIEW ── */}
              {selected && !wizard && (
                <>
                  {/* Conversation header */}
                  <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <button onClick={() => setSelected(null)} className="md:hidden text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <div className="min-w-0">
                        <h2 className="font-semibold text-foreground truncate">{selected.subject}</h2>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <p className="text-xs text-muted-foreground">{fmt(selected.created_at)} · {(selected.replies?.length || 0) + 1} messages</p>
                          {selected.topic && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${TOPIC_COLORS[selected.topic]}`}>
                              {TOPIC_LABELS[selected.topic]}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {selected.status !== 'closed' && (
                        <>
                          {selected.status === 'open' && <span className="text-xs text-yellow-600 hidden sm:inline">Waiting for Admin</span>}
                          {selected.status === 'replied' && !selected.read_by_user && <span className="text-xs text-green-600 font-semibold hidden sm:inline">New Message from Support</span>}
                          {selected.status === 'replied' && selected.read_by_user && <span className="text-xs text-muted-foreground hidden sm:inline">Read</span>}
                          <button onClick={handleClose} className="flex items-center gap-1.5 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Close
                          </button>
                        </>
                      )}
                      {selected.status === 'closed' && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full font-medium">Closed</span>
                          {selected.user_rating ? (
                            <span className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full font-medium ${selected.user_rating.thumbs === 'up' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {selected.user_rating.thumbs === 'up' ? <ThumbsUp className="w-3 h-3" /> : <ThumbsDown className="w-3 h-3" />}
                              {selected.user_rating.thumbs === 'up' ? 'Rated Good' : 'Rated Poor'}
                            </span>
                          ) : (
                            <button onClick={() => { setRatingTicketId(selected._id); setRatingThumb(null); setRatingComment(''); setShowRating(true); }} className="text-xs text-primary underline hover:no-underline">
                              Rate support
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Chat thread */}
                  <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
                    <div className="space-y-4 max-w-2xl mx-auto">
                      {!selected.is_broadcast && (selected.body || selected.image_url) && (
                        <div className="flex gap-3 justify-end">
                          <div className="max-w-[80%]">
                            <div className="flex items-center gap-1.5 justify-end mb-1">
                              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                                <span className="text-[9px] font-bold text-white">{(user?.username || 'U')[0].toUpperCase()}</span>
                              </div>
                              <p className="text-[11px] text-muted-foreground">{user?.username || 'You'} · {fmt(selected.created_at)}</p>
                            </div>
                            <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5">
                              {selected.body && <p className="text-sm whitespace-pre-wrap">{selected.body}</p>}
                              {selected.image_url && (
                                <a href={`${getApiBaseUrl()}${selected.image_url}`} target="_blank" rel="noopener noreferrer">
                                  <img src={`${getApiBaseUrl()}${selected.image_url}`} alt="Attachment" className="mt-2 max-w-[240px] rounded-lg border border-white/20" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {selected.replies.map((reply) => {
                        // ── Smart Question bubble (system) ──────────────
                        if (reply.from === 'system' && reply.is_smart_question) {
                          const alreadyAnswered = reply.answered
                            || selected.replies.some(r => r.is_sq_answer && r.sq_reply_id === reply._id);
                          return (
                            <div key={reply._id} className="flex gap-3 justify-start">
                              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-1 flex-shrink-0">
                                <span className="text-[10px] font-bold text-white">ML</span>
                              </div>
                              <div className="max-w-[80%] space-y-2">
                                <div className="bg-violet-50 border border-violet-200 rounded-2xl rounded-tl-sm px-4 py-2.5">
                                  <p className="text-[10px] font-semibold text-violet-600 mb-1">Smart Question · {fmt(reply.created_at)}</p>
                                  <p className="text-sm text-foreground">{reply.text}</p>
                                </div>
                                {!alreadyAnswered && (
                                  <div className="ml-1">
                                    {/* choice type */}
                                    {reply.answer_type === 'choice' && reply.options?.length ? (
                                      <div className="flex flex-wrap gap-2">
                                        {reply.options.map(opt => (
                                          <button key={opt}
                                            onClick={() => setSqAnswers(p => ({ ...p, [reply._id]: opt }))}
                                            className={`px-3 py-1.5 rounded-full text-sm border transition-all ${sqAnswers[reply._id] === opt ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary hover:bg-primary/5'}`}>
                                            {opt}
                                          </button>
                                        ))}
                                        {sqAnswers[reply._id] && (
                                          <button onClick={() => handleSqAnswer(reply._id)}
                                            disabled={sqSubmitting[reply._id]}
                                            className="px-4 py-1.5 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                                            {sqSubmitting[reply._id] ? '...' : 'Send'}
                                          </button>
                                        )}
                                      </div>
                                    ) : reply.answer_type === 'yesno' ? (
                                      <div className="flex gap-2">
                                        {['Yes', 'No'].map(opt => (
                                          <button key={opt}
                                            onClick={() => { setSqAnswers(p => ({ ...p, [reply._id]: opt })); }}
                                            className={`px-4 py-1.5 rounded-full text-sm border transition-all ${sqAnswers[reply._id] === opt ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary'}`}>
                                            {opt}
                                          </button>
                                        ))}
                                        {sqAnswers[reply._id] && (
                                          <button onClick={() => handleSqAnswer(reply._id)}
                                            disabled={sqSubmitting[reply._id]}
                                            className="px-4 py-1.5 bg-primary text-primary-foreground rounded-full text-sm font-medium disabled:opacity-50">
                                            {sqSubmitting[reply._id] ? '...' : 'Send'}
                                          </button>
                                        )}
                                      </div>
                                    ) : (
                                      // free text
                                      <div className="flex gap-2">
                                        <input
                                          value={sqAnswers[reply._id] || ''}
                                          onChange={e => setSqAnswers(p => ({ ...p, [reply._id]: e.target.value }))}
                                          placeholder="Type your answer..."
                                          className="flex-1 text-sm border border-violet-200 rounded-xl px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-violet-400"
                                          onKeyDown={e => { if (e.key === 'Enter') handleSqAnswer(reply._id); }}
                                        />
                                        <button onClick={() => handleSqAnswer(reply._id)}
                                          disabled={sqSubmitting[reply._id] || !sqAnswers[reply._id]?.trim()}
                                          className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-2 rounded-xl text-sm font-medium disabled:opacity-50">
                                          <Send className="w-3.5 h-3.5" />
                                          {sqSubmitting[reply._id] ? '...' : 'Send'}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {alreadyAnswered && (
                                  <p className="text-[10px] text-muted-foreground ml-1">✓ Answered</p>
                                )}
                              </div>
                            </div>
                          );
                        }

                        // ── SQ answer bubble (user) — render as regular right bubble ──
                        if (reply.is_sq_answer) {
                          return (
                            <div key={reply._id} className="flex justify-end gap-3">
                              <div className="max-w-[80%]">
                                <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5">
                                  <p className="text-sm">{reply.text}</p>
                                  <p className="text-[10px] opacity-60 mt-0.5">{fmt(reply.created_at)}</p>
                                </div>
                              </div>
                              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-5">
                                <span className="text-[9px] font-bold text-white">{(user?.username || 'U')[0].toUpperCase()}</span>
                              </div>
                            </div>
                          );
                        }

                        // ── Regular admin / user reply ──────────────────
                        const isAdmin = reply.from === 'admin';
                        const isLastAdminReply = isAdmin && reply._id === selected.replies.filter(r => r.from === 'admin').slice(-1)[0]?._id;
                        return (
                          <div key={reply._id} className={`flex gap-3 ${isAdmin ? 'justify-start' : 'justify-end'}`}>
                            {isAdmin && (
                              <img src="/logo.png" alt="ML" className="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-5"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            )}
                            <div className="max-w-[80%]">
                              <div className={`flex items-center gap-1.5 mb-1 ${isAdmin ? '' : 'justify-end'}`}>
                                <p className="text-[11px] text-muted-foreground">
                                  {isAdmin ? 'MoustacheLeads Support' : (user?.username || 'You')} · {fmt(reply.created_at)}
                                </p>
                                {isAdmin && !selected.read_by_user && isLastAdminReply && (
                                  <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Unread</span>
                                )}
                              </div>
                              <div className={`rounded-2xl px-4 py-2.5 ${isAdmin ? 'bg-card border border-border rounded-tl-sm' : 'bg-blue-600 text-white rounded-tr-sm'}`}>
                                <p className={`text-sm whitespace-pre-wrap ${isAdmin ? 'text-foreground' : ''}`}>{reply.text}</p>
                                {reply.image_url && (
                                  <a href={`${getApiBaseUrl()}${reply.image_url}`} target="_blank" rel="noopener noreferrer">
                                    <img src={`${getApiBaseUrl()}${reply.image_url}`} alt="Attachment" className={`mt-2 max-w-[240px] rounded-lg border ${isAdmin ? 'border-border' : 'border-white/20'}`} />
                                  </a>
                                )}
                              </div>
                            </div>
                            {!isAdmin && (
                              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-5">
                                <span className="text-[9px] font-bold text-white">{(user?.username || 'U')[0].toUpperCase()}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {selected.replies.length === 0 && !selected.is_broadcast && (
                        <div className="text-center py-6">
                          <Clock className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                          <p className="text-sm text-muted-foreground">Waiting for admin reply...</p>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                  </div>

                  {/* Reply input */}
                  {selected.status !== 'closed' && (
                    <div className="px-4 sm:px-6 py-4 border-t border-border bg-muted/20">
                      {replyImageUrl && (
                        <div className="mb-2 relative inline-block">
                          <img src={`${getApiBaseUrl()}${replyImageUrl}`} alt="Preview" className="h-16 rounded-lg border border-border" />
                          <button onClick={() => setReplyImageUrl('')} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <div className="flex gap-3">
                        <input ref={replyFileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ''; }} />
                        <button onClick={() => replyFileRef.current?.click()} disabled={replyUploading}
                          className="self-end flex items-center justify-center w-10 h-10 rounded-xl border border-border hover:bg-muted transition-colors disabled:opacity-50" title="Attach image">
                          {replyUploading ? <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Image className="w-4 h-4 text-muted-foreground" />}
                        </button>
                        <textarea
                          value={replyText}
                          onChange={e => handleReplyTextChange(e.target.value)}
                          placeholder="Type your message..."
                          rows={2}
                          className="flex-1 text-sm border border-border rounded-xl px-4 py-3 bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleReply(); }}
                        />
                        <button onClick={handleReply} disabled={replying || (!replyText.trim() && !replyImageUrl)}
                          className="self-end flex items-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                          <Send className="w-4 h-4" />
                          {replying ? 'Sending...' : 'Send'}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Ctrl+Enter to send</p>
                    </div>
                  )}
                </>
              )}

              {/* ── EMPTY STATE ── */}
              {!selected && !wizard && (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">Need help?</p>
                    <p className="text-xs mt-1 text-muted-foreground">Pick a request on the left, or start a new one.<br />We'll ask a few quick questions so the team can help faster.</p>
                    <button onClick={startWizard} className="mt-4 flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors mx-auto">
                      <Plus className="w-4 h-4" /> New request
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* ── Review & Earn tab ────────────────────────────────────────────────── */
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 border border-slate-800 p-6 md:p-8 text-white shadow-xl">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Sparkles className="w-40 h-40 text-amber-400" />
            </div>
            <div className="max-w-2xl space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider rounded-full">
                <Gift className="w-3.5 h-3.5" /> High-Paying Publisher Reward
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight">Rate MoustacheLeads & Get Extra Balance Bonus!</h2>
              <p className="text-slate-300 text-sm md:text-base leading-relaxed">
                We value our partnership. Share your experience on public platforms and we'll credit your balance with a guaranteed bonus reward:
              </p>
              <div className="flex flex-wrap items-center gap-6 pt-2">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400 font-bold border border-emerald-500/20">$5</div>
                  <div><p className="text-xs text-slate-400">Guaranteed Cash</p><p className="text-sm font-bold text-white">+$5.00 Flat Reward</p></div>
                </div>
                <div className="text-2xl text-slate-500 font-light hidden sm:inline">+</div>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-400 font-bold border border-amber-500/20">10%</div>
                  <div><p className="text-xs text-slate-400">Account Bonus</p><p className="text-sm font-bold text-white">+10% Extra of Balance</p></div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 font-bold text-lg flex items-center justify-center border border-indigo-100 flex-shrink-0">1</div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">Step 1: Write an Honest Review</h3>
                    <p className="text-sm text-muted-foreground">Click below to open our official review page and write your feedback about MoustacheLeads.</p>
                  </div>
                </div>
                <button onClick={handleReviewButtonClick}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold py-3.5 px-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 group text-sm">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  Go to Official Review Page
                  <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </button>
              </div>

              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 font-bold text-lg flex items-center justify-center border border-indigo-100 flex-shrink-0">2</div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">Step 2: Upload Screenshot Proof</h3>
                    <p className="text-sm text-muted-foreground">Take a clear screenshot of your submitted review (must show your name and rating) and upload it here for verification.</p>
                  </div>
                </div>
                {reviewSubmission && (reviewSubmission.status === 'pending' || reviewSubmission.status === 'approved') ? (
                  <div className="bg-muted/40 border border-dashed border-border rounded-xl p-6 text-center space-y-2">
                    <Award className="w-8 h-8 mx-auto text-indigo-600 opacity-60 animate-bounce" />
                    <p className="text-xs text-muted-foreground font-semibold">You already have an active "{reviewSubmission.status}" review proof.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-border hover:border-indigo-500/40 bg-card rounded-xl p-8 text-center transition-colors relative group">
                      <input type="file" accept="image/*" onChange={handleReviewFileSelect} disabled={uploadingProof}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" />
                      {proofPreviewUrl ? (
                        <div className="space-y-3">
                          <img src={proofPreviewUrl} alt="Selected Screenshot Preview" className="max-h-48 mx-auto rounded-lg border border-border shadow-sm" />
                          <p className="text-xs text-muted-foreground truncate max-w-xs mx-auto">{selectedProofFile?.name}</p>
                          <button onClick={(e) => { e.stopPropagation(); setSelectedProofFile(null); setProofPreviewUrl(''); }}
                            className="text-xs text-red-500 hover:text-red-600 font-semibold">Remove and Choose Another</button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto border border-border group-hover:bg-indigo-50 transition-colors">
                            <UploadCloud className="w-6 h-6 text-muted-foreground group-hover:text-indigo-600 transition-colors" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">Click to upload screenshot</p>
                            <p className="text-xs text-muted-foreground mt-1">PNG, JPG or JPEG up to 10MB</p>
                          </div>
                        </div>
                      )}
                    </div>
                    {selectedProofFile && (
                      <button onClick={handleUploadReviewProof} disabled={uploadingProof}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-md disabled:opacity-50 transition-all duration-200 text-sm flex items-center justify-center gap-2">
                        {uploadingProof ? (<><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Uploading Proof...</>) : (<><CheckCircle2 className="w-4 h-4" />Submit Screenshot Proof</>)}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Your Submission Status</h3>
                {!reviewSubmission ? (
                  <div className="bg-slate-50 rounded-xl p-4 text-center space-y-2 border border-border">
                    <Star className="w-8 h-8 text-amber-400 fill-amber-400/20 mx-auto" />
                    <p className="text-sm font-semibold text-slate-800">No Review Submitted</p>
                    <p className="text-xs text-slate-500 leading-relaxed">Complete Step 1 and Step 2 to claim your cash reward!</p>
                  </div>
                ) : reviewSubmission.status === 'pending' ? (
                  <div className="bg-amber-50/50 rounded-xl p-4 text-center space-y-2 border border-amber-100/50">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center mx-auto text-amber-600"><Clock className="w-4 h-4 animate-pulse" /></div>
                    <p className="text-sm font-semibold text-amber-800">Verification Pending</p>
                    <p className="text-xs text-amber-700 leading-relaxed">Our team is reviewing your screenshot. Usually 12-24 hours.</p>
                  </div>
                ) : reviewSubmission.status === 'approved' ? (
                  <div className="bg-emerald-50/50 rounded-xl p-4 text-center space-y-2 border border-emerald-100/50">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center mx-auto text-emerald-600"><CheckCircle2 className="w-4 h-4" /></div>
                    <p className="text-sm font-semibold text-emerald-800">Reward Credited! 🎉</p>
                    <div className="p-2.5 bg-emerald-600/10 rounded-lg text-emerald-700 text-xs font-bold">Payout: +${reviewSubmission.reward_amount?.toFixed(2) || '5.00'}</div>
                  </div>
                ) : (
                  <div className="bg-red-50/50 rounded-xl p-4 text-center space-y-2 border border-red-100/50">
                    <p className="text-sm font-semibold text-red-800">Submission Rejected</p>
                    <p className="text-xs text-red-700 leading-relaxed">Verification failed. Please re-submit with a clearer screenshot.</p>
                  </div>
                )}
              </div>
              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-3">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-indigo-600" /> Review Guidelines
                </h4>
                <ul className="text-xs text-muted-foreground space-y-2 list-disc pl-4 leading-relaxed">
                  <li>Your review must be public and remain active on the platform.</li>
                  <li>Screenshots must be uncropped, clear, and display your public reviewer name.</li>
                  <li>Rewards: $5.00 fixed + 10% of account balance at moment of approval.</li>
                  <li>Only one review bonus per publisher account per active cycle.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rating modal */}
      {showRating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowRating(false)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground text-lg flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-400" /> Rate Support
              </h2>
              <button onClick={() => setShowRating(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-muted-foreground">How satisfied were you with the support you received?</p>
            <div className="flex gap-4 justify-center py-2">
              <button onClick={() => setRatingThumb('up')}
                className={`flex flex-col items-center gap-2 px-6 py-4 rounded-xl border-2 transition-all ${ratingThumb === 'up' ? 'border-green-500 bg-green-50 text-green-700' : 'border-border text-muted-foreground hover:border-green-300 hover:bg-green-50/50'}`}>
                <ThumbsUp className={`w-8 h-8 ${ratingThumb === 'up' ? 'fill-green-200' : ''}`} />
                <span className="text-sm font-semibold">Good</span>
              </button>
              <button onClick={() => setRatingThumb('down')}
                className={`flex flex-col items-center gap-2 px-6 py-4 rounded-xl border-2 transition-all ${ratingThumb === 'down' ? 'border-red-500 bg-red-50 text-red-700' : 'border-border text-muted-foreground hover:border-red-300 hover:bg-red-50/50'}`}>
                <ThumbsDown className={`w-8 h-8 ${ratingThumb === 'down' ? 'fill-red-200' : ''}`} />
                <span className="text-sm font-semibold">Not Good</span>
              </button>
            </div>
            <textarea value={ratingComment} onChange={e => setRatingComment(e.target.value)}
              placeholder="Add a comment (optional)..." rows={3}
              className="w-full text-sm border border-border rounded-xl px-4 py-3 bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowRating(false)} className="px-4 py-2 text-sm border border-border rounded-xl hover:bg-muted transition-colors">Skip</button>
              <button onClick={handleSubmitRating} disabled={submittingRating || !ratingThumb}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {submittingRating ? 'Submitting...' : 'Submit Rating'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportPage;
