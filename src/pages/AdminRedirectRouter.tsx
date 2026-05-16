import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { TemplatePicker, TemplateName } from '@/components/survey-templates/SurveyTemplateRenderer';
import {
  getSurveyFunnels,
  createSurveyFunnel,
  updateSurveyFunnel,
  deleteSurveyFunnel,
  getSurveyFunnelHistory,
  SurveyFunnel,
  FunnelStep,
  FunnelQuestion,
  PassCriteria,
  PassRule,
} from '@/services/surveyFunnelApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Trash2,
  Play,
  Pause,
  ArrowRight,
  CheckCircle2,
  XCircle,
  ListOrdered,
  History,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Route,
} from 'lucide-react';

export default function AdminRedirectRouter() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<'list' | 'builder' | 'history'>('list');
  const [editingFunnel, setEditingFunnel] = useState<SurveyFunnel | null>(null);
  const [historyFunnelId, setHistoryFunnelId] = useState('');

  // Fetch funnels
  const { data: funnelsData, isLoading } = useQuery({
    queryKey: ['survey-funnels'],
    queryFn: () => getSurveyFunnels(),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSurveyFunnel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['survey-funnels'] });
      toast.success('Funnel deleted');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateSurveyFunnel(id, { status } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['survey-funnels'] });
      toast.success('Status updated');
    },
  });

  const funnels: SurveyFunnel[] = funnelsData?.funnels || [];

  if (view === 'builder') {
    return (
      <FunnelBuilder
        funnel={editingFunnel}
        onBack={() => { setView('list'); setEditingFunnel(null); }}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['survey-funnels'] });
          setView('list');
          setEditingFunnel(null);
        }}
      />
    );
  }

  if (view === 'history') {
    return <FunnelHistory funnelId={historyFunnelId} onBack={() => setView('list')} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Route className="h-6 w-6 text-blue-500" />
            Survey Funnel Router
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create survey chains that qualify users → redirect to offers or show next survey on fail
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setHistoryFunnelId(''); setView('history'); }}>
            <History className="h-4 w-4 mr-2" /> History
          </Button>
          <Button onClick={() => { setEditingFunnel(null); setView('builder'); }}>
            <Plus className="h-4 w-4 mr-2" /> Create Funnel
          </Button>
        </div>
      </div>

      {/* Funnels List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading funnels...</div>
      ) : funnels.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-muted/20">
          <ListOrdered className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-lg font-medium">No survey funnels yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Create your first funnel to start qualifying users with surveys</p>
          <Button onClick={() => setView('builder')}>
            <Plus className="h-4 w-4 mr-2" /> Create First Funnel
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {funnels.map((funnel) => (
            <div key={funnel.funnel_id} className="border rounded-lg p-4 hover:bg-muted/30 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{funnel.name}</h3>
                    <Badge variant={funnel.status === 'active' ? 'default' : 'secondary'}>{funnel.status}</Badge>
                    <Badge variant="outline">{funnel.placement}</Badge>
                  </div>
                  {funnel.description && <p className="text-sm text-muted-foreground mt-1">{funnel.description}</p>}
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>{funnel.steps?.length || 0} survey step(s)</span>
                    <span>Starts: {funnel.stats?.total_starts || 0}</span>
                    <span className="text-green-600">Passes: {funnel.stats?.total_passes || 0}</span>
                    <span className="text-red-500">Fails: {funnel.stats?.total_fails || 0}</span>
                    <span className="font-mono text-[10px]">{funnel.funnel_id}</span>
                  </div>
                  {/* Funnel Link */}
                  <div className="mt-1">
                    <span className="text-xs text-muted-foreground mr-1">Link:</span>
                    <a
                      href={`${window.location.origin}/funnel/${funnel.funnel_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:text-blue-700 underline font-mono"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {window.location.hostname === 'localhost'
                        ? `${window.location.origin}/funnel/${funnel.funnel_id}`
                        : `https://survey.moustacheleads.com/funnel/${funnel.funnel_id}`}
                    </a>
                    <button
                      className="ml-2 text-xs text-gray-400 hover:text-gray-600"
                      title="Copy link"
                      onClick={(e) => {
                        e.stopPropagation();
                        const link = window.location.hostname === 'localhost'
                          ? `${window.location.origin}/funnel/${funnel.funnel_id}`
                          : `https://survey.moustacheleads.com/funnel/${funnel.funnel_id}`;
                        navigator.clipboard.writeText(link);
                        toast.success('Link copied!');
                      }}
                    >
                      📋
                    </button>
                  </div>
                  {/* Visual flow */}
                  <div className="flex items-center gap-1 mt-3 flex-wrap">
                    {funnel.steps?.map((step, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <div className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded font-medium">
                          {step.survey_title || `Survey ${i + 1}`}
                        </div>
                        {i < (funnel.steps?.length || 0) - 1 && (
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    ))}
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <div className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded font-medium">Fail</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-4">
                  <Button variant="ghost" size="icon" className="h-8 w-8" title={funnel.status === 'active' ? 'Pause' : 'Activate'}
                    onClick={() => toggleMutation.mutate({ id: funnel.funnel_id, status: funnel.status === 'active' ? 'paused' : 'active' })}>
                    {funnel.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="History"
                    onClick={() => { setHistoryFunnelId(funnel.funnel_id); setView('history'); }}>
                    <History className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit"
                    onClick={() => { setEditingFunnel(funnel); setView('builder'); }}>
                    <ListOrdered className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" title="Delete"
                    onClick={() => { if (confirm(`Delete "${funnel.name}"?`)) deleteMutation.mutate(funnel.funnel_id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ==================== FUNNEL BUILDER (Full Screen) ====================

function FunnelBuilder({ funnel, onBack, onSaved }: { funnel: SurveyFunnel | null; onBack: () => void; onSaved: () => void }) {
  const isEdit = !!funnel;
  const [name, setName] = useState(funnel?.name || '');
  const [description, setDescription] = useState(funnel?.description || '');
  const [placement, setPlacement] = useState(funnel?.placement || 'everywhere');
  const [placementOfferId, setPlacementOfferId] = useState(funnel?.placement_offer_id || '');
  const [surveyTemplate, setSurveyTemplate] = useState<string>((funnel as any)?.survey_template || 'modern-card');
  const [questionsPerPage, setQuestionsPerPage] = useState<number>((funnel as any)?.questions_per_page || 0);
  const [spinnerDuration, setSpinnerDuration] = useState<number>((funnel as any)?.spinner_duration || 8);
  const [surveyTimeout, setSurveyTimeoutVal] = useState<number>((funnel as any)?.survey_timeout || 5);
  const [failMessage, setFailMessage] = useState(funnel?.fail_message || 'Sorry, you do not qualify for any offers at this time.');
  const [displayTitle, setDisplayTitle] = useState((funnel as any)?.display_title || funnel?.name || '');
  const [displayDescription, setDisplayDescription] = useState((funnel as any)?.display_description || 'Complete this survey to unlock a special offer!');
  const [displayImageUrl, setDisplayImageUrl] = useState((funnel as any)?.display_image_url || '');
  const [displayPayout, setDisplayPayout] = useState((funnel as any)?.display_payout || 0);
  const [displayCategory, setDisplayCategory] = useState((funnel as any)?.display_category || 'SURVEY');
  const [steps, setSteps] = useState<FunnelStep[]>(funnel?.steps || [createEmptyStep(1)]);
  const [expandedStep, setExpandedStep] = useState(0);
  const [saving, setSaving] = useState(false);

  function createEmptyStep(num: number): FunnelStep {
    return {
      survey_title: `Survey ${num}`,
      questions: [{ text: '', options: ['', ''] }],
      pass_criteria: { mode: 'all', rules: [] },
      pass_url: '',
      pass_message: 'Congratulations! You qualify.',
      fail_message: "You didn't qualify. Try the next one!",
    };
  }

  const addStep = () => {
    setSteps([...steps, createEmptyStep(steps.length + 1)]);
    setExpandedStep(steps.length);
  };

  const removeStep = (idx: number) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter((_, i) => i !== idx));
    if (expandedStep >= steps.length - 1) setExpandedStep(Math.max(0, steps.length - 2));
  };

  const updateStep = (idx: number, updates: Partial<FunnelStep>) => {
    const updated = [...steps];
    updated[idx] = { ...updated[idx], ...updates };
    setSteps(updated);
  };

  const addQuestion = (stepIdx: number) => {
    const updated = [...steps];
    updated[stepIdx].questions.push({ text: '', options: ['', ''] });
    setSteps(updated);
  };

  const removeQuestion = (stepIdx: number, qIdx: number) => {
    const updated = [...steps];
    if (updated[stepIdx].questions.length <= 1) return;
    updated[stepIdx].questions = updated[stepIdx].questions.filter((_, i) => i !== qIdx);
    setSteps(updated);
  };

  const updateQuestion = (stepIdx: number, qIdx: number, field: 'text' | 'options', value: any) => {
    const updated = [...steps];
    if (field === 'text') {
      updated[stepIdx].questions[qIdx].text = value;
    } else {
      updated[stepIdx].questions[qIdx].options = value;
    }
    setSteps(updated);
  };

  const addOption = (stepIdx: number, qIdx: number) => {
    const updated = [...steps];
    updated[stepIdx].questions[qIdx].options.push('');
    setSteps(updated);
  };

  const removeOption = (stepIdx: number, qIdx: number, optIdx: number) => {
    const updated = [...steps];
    if (updated[stepIdx].questions[qIdx].options.length <= 2) return;
    updated[stepIdx].questions[qIdx].options = updated[stepIdx].questions[qIdx].options.filter((_, i) => i !== optIdx);
    setSteps(updated);
  };

  const updateOption = (stepIdx: number, qIdx: number, optIdx: number, value: string) => {
    const updated = [...steps];
    updated[stepIdx].questions[qIdx].options[optIdx] = value;
    setSteps(updated);
  };

  const toggleAcceptedAnswer = (stepIdx: number, qIdx: number, answer: string) => {
    const updated = [...steps];
    const criteria = updated[stepIdx].pass_criteria;
    const existingRule = criteria.rules.find(r => r.question_index === qIdx);
    if (existingRule) {
      if (existingRule.accepted_answers.includes(answer)) {
        existingRule.accepted_answers = existingRule.accepted_answers.filter(a => a !== answer);
        if (existingRule.accepted_answers.length === 0) {
          criteria.rules = criteria.rules.filter(r => r.question_index !== qIdx);
        }
      } else {
        existingRule.accepted_answers.push(answer);
      }
    } else {
      criteria.rules.push({ question_index: qIdx, accepted_answers: [answer] });
    }
    setSteps(updated);
  };

  const isAccepted = (stepIdx: number, qIdx: number, answer: string) => {
    const rule = steps[stepIdx].pass_criteria.rules.find(r => r.question_index === qIdx);
    return rule?.accepted_answers.includes(answer) || false;
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Funnel name is required'); return; }
    if (steps.some(s => !s.pass_url.trim())) { toast.error('Each step needs a redirect URL on pass'); return; }

    setSaving(true);
    try {
      const payload = { name, description, placement, placement_offer_id: placementOfferId, steps, fail_message: failMessage,
        display_title: displayTitle || name, display_description: displayDescription, display_image_url: displayImageUrl,
        display_payout: displayPayout, display_category: displayCategory, survey_template: surveyTemplate,
        questions_per_page: questionsPerPage, spinner_duration: spinnerDuration, survey_timeout: surveyTimeout };
      if (isEdit) {
        await updateSurveyFunnel(funnel!.funnel_id, payload as any);
        toast.success('Funnel updated');
      } else {
        await createSurveyFunnel(payload as any);
        toast.success('Funnel created');
      }
      onSaved();
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onBack}>← Back</Button>
          <h1 className="text-xl font-bold">{isEdit ? 'Edit Funnel' : 'Create Survey Funnel'}</h1>
        </div>
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Funnel'}</Button>
      </div>

      {/* Basic Info */}
      <div className="border rounded-lg p-4 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Funnel Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Funnel Name *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. US Health Insurance Qualifier" />
          </div>
          <div>
            <label className="text-sm font-medium">Show Where</label>
            <Select value={placement} onValueChange={setPlacement}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="everywhere">Everywhere (all placements)</SelectItem>
                <SelectItem value="iframe">Iframe Only</SelectItem>
                <SelectItem value="offerwall">Main Offerwall Only</SelectItem>
                <SelectItem value="specific_offer">Before Specific Offer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {placement === 'specific_offer' && (
          <div>
            <label className="text-sm font-medium">Offer ID (show before this offer)</label>
            <Input value={placementOfferId} onChange={(e) => setPlacementOfferId(e.target.value)} placeholder="e.g. ML-02242" />
          </div>
        )}
        <div>
          <label className="text-sm font-medium">Description</label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional internal note" />
        </div>
        <div>
          <label className="text-sm font-medium">Final Fail Message (shown when user fails ALL surveys)</label>
          <Textarea value={failMessage} onChange={(e) => setFailMessage(e.target.value)} rows={2} />
        </div>
      </div>

      {/* Survey Template */}
      <div className="border rounded-lg p-4 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Survey Template (how questions are displayed to users)</h2>
        <TemplatePicker
          value={surveyTemplate as TemplateName}
          onChange={(t) => setSurveyTemplate(t)}
          questions={steps[0]?.questions?.map(q => ({ text: q.text, options: q.options })) || []}
        />
        {/* Questions per page setting */}
        <div className="border-t pt-4 mt-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium">Questions Per Page</label>
              <p className="text-xs text-muted-foreground mt-0.5">How many questions to show on each page. Set to 0 to show all at once.</p>
            </div>
            <Select value={String(questionsPerPage)} onValueChange={(v) => setQuestionsPerPage(Number(v))}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">All at once</SelectItem>
                <SelectItem value="1">1 per page</SelectItem>
                <SelectItem value="2">2 per page</SelectItem>
                <SelectItem value="3">3 per page</SelectItem>
                <SelectItem value="4">4 per page</SelectItem>
                <SelectItem value="5">5 per page</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Spinner & Timeout settings */}
        <div className="border-t pt-4 mt-4 space-y-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Transition & Timing</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Spinner Duration (seconds)</label>
              <p className="text-xs text-muted-foreground mt-0.5">How long to show the loading spinner between steps.</p>
              <Input type="number" min={1} max={30} value={spinnerDuration} onChange={(e) => setSpinnerDuration(Number(e.target.value))} className="mt-1.5" />
            </div>
            <div>
              <label className="text-sm font-medium">Survey Timeout (minutes)</label>
              <p className="text-xs text-muted-foreground mt-0.5">Auto-reload if user spends more than this time. Set 0 to disable.</p>
              <Input type="number" min={0} max={60} value={surveyTimeout} onChange={(e) => setSurveyTimeoutVal(Number(e.target.value))} className="mt-1.5" />
            </div>
          </div>
        </div>
      </div>

      {/* Offer Card Appearance */}
      <div className="border rounded-lg p-4 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Offer Card Appearance (how it looks on the offerwall)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Display Title (shown to users)</label>
            <Input value={displayTitle} onChange={(e) => setDisplayTitle(e.target.value)} placeholder="e.g. Quick Health Survey" />
          </div>
          <div>
            <label className="text-sm font-medium">Category</label>
            <Select value={displayCategory} onValueChange={setDisplayCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SURVEY">Survey</SelectItem>
                <SelectItem value="HEALTH">Health</SelectItem>
                <SelectItem value="INSURANCE">Insurance</SelectItem>
                <SelectItem value="FINANCE">Finance</SelectItem>
                <SelectItem value="EDUCATION">Education</SelectItem>
                <SelectItem value="INSTALLS">Installs</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Display Description</label>
          <Input value={displayDescription} onChange={(e) => setDisplayDescription(e.target.value)} placeholder="Complete this survey to unlock a special offer!" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Image URL (offer card image)</label>
            <Input value={displayImageUrl} onChange={(e) => setDisplayImageUrl(e.target.value)} placeholder="https://example.com/image.jpg" />
            {displayImageUrl && (
              <img src={displayImageUrl} alt="Preview" className="mt-2 h-20 w-auto rounded border object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
            )}
          </div>
          <div>
            <label className="text-sm font-medium">Display Payout (points shown to user)</label>
            <Input type="number" min={0} value={displayPayout} onChange={(e) => setDisplayPayout(Number(e.target.value))} placeholder="e.g. 50" />
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Survey Steps ({steps.length})</h2>
          <Button variant="outline" size="sm" onClick={addStep}><Plus className="h-3 w-3 mr-1" /> Add Step</Button>
        </div>

        {/* Visual Flow */}
        <div className="flex items-center gap-2 flex-wrap p-3 bg-muted/30 rounded-lg border">
          <span className="text-xs font-medium text-muted-foreground">Flow:</span>
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                <span className="font-bold">{i + 1}.</span> {step.survey_title}
                <span className="text-[10px] text-blue-500 ml-1">→ {step.pass_url ? '✓ Offer' : '⚠ No URL'}</span>
              </div>
              {i < steps.length - 1 && <span className="text-red-400 text-xs font-medium">fail →</span>}
            </div>
          ))}
          <span className="text-red-400 text-xs font-medium">fail →</span>
          <div className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded font-medium">End (fail message)</div>
        </div>

        {/* Step Cards */}
        {steps.map((step, stepIdx) => (
          <div key={stepIdx} className="border rounded-lg overflow-hidden">
            {/* Step Header */}
            <div
              className="flex items-center justify-between p-3 bg-muted/40 cursor-pointer"
              onClick={() => setExpandedStep(expandedStep === stepIdx ? -1 : stepIdx)}
            >
              <div className="flex items-center gap-2">
                <span className="bg-blue-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">{stepIdx + 1}</span>
                <span className="font-medium">{step.survey_title}</span>
                <Badge variant="outline" className="text-xs">{step.questions.length} Q</Badge>
                {step.pass_url && <Badge className="text-xs bg-green-100 text-green-700">Has redirect</Badge>}
              </div>
              <div className="flex items-center gap-1">
                {steps.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={(e) => { e.stopPropagation(); removeStep(stepIdx); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
                {expandedStep === stepIdx ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>

            {/* Step Body */}
            {expandedStep === stepIdx && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Survey Title</label>
                    <Input value={step.survey_title} onChange={(e) => updateStep(stepIdx, { survey_title: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Redirect URL on Pass *</label>
                    <Input value={step.pass_url} onChange={(e) => updateStep(stepIdx, { pass_url: e.target.value })} placeholder="https://offer-link.com/..." />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Pass Message</label>
                    <Input value={step.pass_message || ''} onChange={(e) => updateStep(stepIdx, { pass_message: e.target.value })} placeholder="Congratulations!" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Fail Message (before next survey)</label>
                    <Input value={step.fail_message || ''} onChange={(e) => updateStep(stepIdx, { fail_message: e.target.value })} placeholder="You didn't qualify. Try next!" />
                  </div>
                </div>

                {/* Pass Criteria Mode */}
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium">Pass if user matches:</label>
                  <Select value={step.pass_criteria.mode} onValueChange={(v: any) => {
                    const updated = [...steps];
                    updated[stepIdx].pass_criteria.mode = v;
                    setSteps(updated);
                  }}>
                    <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ALL marked answers</SelectItem>
                      <SelectItem value="any">ANY marked answer</SelectItem>
                      <SelectItem value="min_count">At least N answers</SelectItem>
                    </SelectContent>
                  </Select>
                  {step.pass_criteria.mode === 'min_count' && (
                    <Input
                      type="number" min={1} className="w-20"
                      value={step.pass_criteria.min_count || 1}
                      onChange={(e) => {
                        const updated = [...steps];
                        updated[stepIdx].pass_criteria.min_count = Number(e.target.value);
                        setSteps(updated);
                      }}
                    />
                  )}
                </div>

                {/* Questions */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Questions</label>
                    <Button variant="outline" size="sm" onClick={() => addQuestion(stepIdx)}><Plus className="h-3 w-3 mr-1" /> Add Question</Button>
                  </div>

                  {step.questions.map((q, qIdx) => (
                    <div key={qIdx} className="border rounded-lg p-3 space-y-3 bg-background">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground">Q{qIdx + 1}</span>
                        <Input
                          value={q.text}
                          onChange={(e) => updateQuestion(stepIdx, qIdx, 'text', e.target.value)}
                          placeholder="Enter your question..."
                          className="flex-1"
                        />
                        {step.questions.length > 1 && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeQuestion(stepIdx, qIdx)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>

                      <div className="pl-6 space-y-2">
                        <p className="text-xs text-muted-foreground">Options (click green ✓ to mark as "pass" answer):</p>
                        {q.options.map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => { if (opt.trim()) toggleAcceptedAnswer(stepIdx, qIdx, opt); }}
                              className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors ${
                                isAccepted(stepIdx, qIdx, opt)
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : 'border-gray-300 text-gray-300 hover:border-green-400'
                              }`}
                              title={isAccepted(stepIdx, qIdx, opt) ? 'This is a PASS answer' : 'Click to mark as PASS answer'}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                            </button>
                            <Input
                              value={opt}
                              onChange={(e) => updateOption(stepIdx, qIdx, optIdx, e.target.value)}
                              placeholder={`Option ${optIdx + 1}`}
                              className="flex-1 h-8 text-sm"
                            />
                            {q.options.length > 2 && (
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeOption(stepIdx, qIdx, optIdx)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button variant="ghost" size="sm" className="text-xs" onClick={() => addOption(stepIdx, qIdx)}>
                          + Add Option
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== FUNNEL HISTORY ====================

function FunnelHistory({ funnelId, onBack }: { funnelId: string; onBack: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['survey-funnel-history', funnelId],
    queryFn: () => getSurveyFunnelHistory(funnelId || undefined),
  });

  const history = data?.history || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onBack}>← Back</Button>
        <h1 className="text-xl font-bold">Funnel History</h1>
        {funnelId && <Badge variant="outline">{funnelId}</Badge>}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading history...</div>
      ) : history.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No history records yet</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Session</th>
                <th className="text-left p-3 font-medium">User</th>
                <th className="text-left p-3 font-medium">Funnel</th>
                <th className="text-center p-3 font-medium">Steps</th>
                <th className="text-center p-3 font-medium">Result</th>
                <th className="text-left p-3 font-medium">Redirect</th>
                <th className="text-left p-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {history.map((h: any) => (
                <tr key={h.session_id} className="hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{h.session_id}</td>
                  <td className="p-3 text-xs">{h.user_id}</td>
                  <td className="p-3 text-xs font-mono">{h.funnel_id}</td>
                  <td className="p-3 text-center">{h.responses?.length || 0}</td>
                  <td className="p-3 text-center">
                    {h.result === 'passed' ? (
                      <Badge className="bg-green-100 text-green-700">Passed (Step {(h.passed_at_step || 0) + 1})</Badge>
                    ) : h.result === 'failed' ? (
                      <Badge className="bg-red-100 text-red-700">Failed All</Badge>
                    ) : (
                      <Badge variant="secondary">In Progress</Badge>
                    )}
                  </td>
                  <td className="p-3 text-xs truncate max-w-[200px]">{h.redirect_url || '—'}</td>
                  <td className="p-3 text-xs">{h.started_at ? new Date(h.started_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
