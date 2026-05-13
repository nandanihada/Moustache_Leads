import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { surveyBuilderApi, Survey, SurveyQuestion, SurveyResponse } from "@/services/surveyBuilderApi";
import { useToast } from "@/hooks/use-toast";
import {
  Card, CardContent, CardHeader, CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Tabs, TabsContent, TabsList, TabsTrigger
} from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  ClipboardList, Plus, Trash2, Sparkles, Eye, Search, Wand2, Edit, X
} from "lucide-react";
import { offerwallManagerApi } from "@/services/offerwallManagerApi";

export default function AdminSurveyBuilder() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewSurvey, setPreviewSurvey] = useState<Survey | null>(null);
  const [previewTab, setPreviewTab] = useState<"questions" | "responses">("questions");
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null);
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null);
  const [createTab, setCreateTab] = useState("manual");

  // Offer association state
  const [offerSearch, setOfferSearch] = useState("");
  const [offerResults, setOfferResults] = useState<any[]>([]);
  const [selectedOfferIds, setSelectedOfferIds] = useState<string[]>([]);
  const [offerSearchLoading, setOfferSearchLoading] = useState(false);

  // Create form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPlacement, setFormPlacement] = useState<string>("offerwall_card");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formQuestions, setFormQuestions] = useState<SurveyQuestion[]>([]);

  // AI generate state
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiName, setAiName] = useState("");
  const [generatedQuestions, setGeneratedQuestions] = useState<SurveyQuestion[]>([]);

  // Fetch surveys
  const { data: surveysData, isLoading } = useQuery({
    queryKey: ['admin-surveys', search, statusFilter],
    queryFn: () => surveyBuilderApi.listSurveys({ search, status: statusFilter, per_page: 50 }),
  });

  // Fetch responses for selected survey
  const { data: responsesData } = useQuery({
    queryKey: ['survey-responses', selectedSurveyId],
    queryFn: () => selectedSurveyId ? surveyBuilderApi.getResponses(selectedSurveyId) : null,
    enabled: !!selectedSurveyId && showPreviewDialog && previewTab === "responses",
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (survey: Partial<Survey>) => surveyBuilderApi.createSurvey(survey),
    onSuccess: () => {
      toast({ title: "Survey created successfully" });
      queryClient.invalidateQueries({ queryKey: ['admin-surveys'] });
      resetForm();
      setShowCreateDialog(false);
    },
    onError: () => toast({ title: "Failed to create survey", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => surveyBuilderApi.deleteSurvey(id),
    onSuccess: () => {
      toast({ title: "Survey deleted" });
      queryClient.invalidateQueries({ queryKey: ['admin-surveys'] });
    },
    onError: () => toast({ title: "Failed to delete survey", variant: "destructive" }),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      surveyBuilderApi.updateSurvey(id, { status: status as Survey['status'] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-surveys'] });
      toast({ title: "Status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update status", variant: "destructive" });
    },
  });

  const generateMutation = useMutation({
    mutationFn: ({ prompt, name }: { prompt: string; name: string }) =>
      surveyBuilderApi.generateSurvey(prompt, name),
    onSuccess: (data) => {
      if (data.survey?.questions) {
        setGeneratedQuestions(data.survey.questions as SurveyQuestion[]);
        toast({ title: `Generated ${data.survey.questions.length} questions` });
      }
    },
    onError: () => toast({ title: "Failed to generate survey", variant: "destructive" }),
  });

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormPlacement("offerwall_card");
    setFormImageUrl("");
    setFormQuestions([]);
    setAiPrompt("");
    setAiName("");
    setGeneratedQuestions([]);
    setCreateTab("manual");
    setEditingSurvey(null);
    setOfferSearch("");
    setOfferResults([]);
    setSelectedOfferIds([]);
  };

  const handleEdit = (survey: Survey) => {
    setEditingSurvey(survey);
    setFormName(survey.name);
    setFormDescription(survey.description || '');
    setFormPlacement(survey.placement);
    setFormImageUrl(survey.image_url || '');
    setFormQuestions(survey.questions || []);
    setSelectedOfferIds(survey.target_offer_ids || []);
    setCreateTab("manual");
    setShowCreateDialog(true);
  };

  const handlePreview = (survey: Survey) => {
    setPreviewSurvey(survey);
    setSelectedSurveyId(survey._id || null);
    setPreviewTab("questions");
    setShowPreviewDialog(true);
  };

  // Debounced offer search
  const searchOffers = async (query: string) => {
    if (!query.trim()) {
      setOfferResults([]);
      return;
    }
    setOfferSearchLoading(true);
    try {
      const data = await offerwallManagerApi.getOffers({ search: query, status: 'active', per_page: 10 });
      setOfferResults(data.offers || []);
    } catch {
      setOfferResults([]);
    } finally {
      setOfferSearchLoading(false);
    }
  };

  // Debounce offer search
  const handleOfferSearchChange = (value: string) => {
    setOfferSearch(value);
    const timeout = setTimeout(() => searchOffers(value), 400);
    return () => clearTimeout(timeout);
  };

  const addQuestion = () => {
    const newQ: SurveyQuestion = {
      id: `q${formQuestions.length + 1}`,
      text: "",
      type: "mcq",
      options: [""],
      required: true,
    };
    setFormQuestions([...formQuestions, newQ]);
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    const updated = [...formQuestions];
    (updated[index] as any)[field] = value;
    // Re-assign IDs
    updated.forEach((q, i) => { q.id = `q${i + 1}`; });
    setFormQuestions(updated);
  };

  const removeQuestion = (index: number) => {
    const updated = formQuestions.filter((_, i) => i !== index);
    updated.forEach((q, i) => { q.id = `q${i + 1}`; });
    setFormQuestions(updated);
  };

  const addOption = (qIndex: number) => {
    const updated = [...formQuestions];
    if (!updated[qIndex].options) updated[qIndex].options = [];
    updated[qIndex].options!.push("");
    setFormQuestions(updated);
  };

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    const updated = [...formQuestions];
    updated[qIndex].options![oIndex] = value;
    setFormQuestions(updated);
  };

  const removeOption = (qIndex: number, oIndex: number) => {
    const updated = [...formQuestions];
    updated[qIndex].options = updated[qIndex].options!.filter((_, i) => i !== oIndex);
    setFormQuestions(updated);
  };

  const handleCreateSurvey = async () => {
    const questions = createTab === "ai" ? generatedQuestions : formQuestions;
    const name = createTab === "ai" ? aiName : formName;

    if (!name.trim()) {
      toast({ title: "Survey name is required", variant: "destructive" });
      return;
    }
    if (questions.length === 0) {
      toast({ title: "Add at least one question", variant: "destructive" });
      return;
    }

    // Validate questions have text
    const invalidQ = questions.find(q => !q.text.trim());
    if (invalidQ) {
      toast({ title: "All questions must have text", variant: "destructive" });
      return;
    }

    if (editingSurvey?._id) {
      // Update existing survey
      try {
        await surveyBuilderApi.updateSurvey(editingSurvey._id, {
          name,
          description: createTab === "ai" ? `AI-generated from prompt` : formDescription,
          questions,
          placement: formPlacement as Survey['placement'],
          target_offer_ids: selectedOfferIds,
          image_url: formImageUrl || undefined,
        });
        toast({ title: "Survey updated successfully" });
        queryClient.invalidateQueries({ queryKey: ['admin-surveys'] });
        resetForm();
        setShowCreateDialog(false);
      } catch {
        toast({ title: "Failed to update survey", variant: "destructive" });
      }
    } else {
      // Create new survey
      createMutation.mutate({
        name,
        description: createTab === "ai" ? `AI-generated from prompt` : formDescription,
        type: createTab === "ai" ? "ai_generated" : "manual",
        status: "draft",
        questions,
        placement: formPlacement as Survey['placement'],
        target_offer_ids: selectedOfferIds,
        image_url: formImageUrl || undefined,
        ai_prompt: createTab === "ai" ? aiPrompt : undefined,
      });
    }
  };

  const handleGenerate = () => {
    if (!aiPrompt.trim()) {
      toast({ title: "Enter a prompt", variant: "destructive" });
      return;
    }
    if (!aiName.trim()) {
      toast({ title: "Enter a survey name", variant: "destructive" });
      return;
    }
    generateMutation.mutate({ prompt: aiPrompt, name: aiName });
  };

  const surveys = surveysData?.surveys || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-6 w-6 text-orange-500" />
          <h1 className="text-2xl font-bold">Survey Builder</h1>
          <Badge variant="secondary">{surveysData?.total || 0} surveys</Badge>
        </div>
        <Button onClick={() => { resetForm(); setShowCreateDialog(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Create Survey
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search surveys..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Surveys Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Questions</TableHead>
                <TableHead>Responses</TableHead>
                <TableHead>Placement</TableHead>
                <TableHead>Link</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Loading surveys...
                  </TableCell>
                </TableRow>
              ) : surveys.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No surveys found. Create your first survey.
                  </TableCell>
                </TableRow>
              ) : (
                surveys.map((survey) => (
                  <TableRow key={survey._id}>
                    <TableCell className="font-medium">{survey.name}</TableCell>
                    <TableCell>
                      <Badge variant={survey.type === 'ai_generated' ? 'default' : 'secondary'}>
                        {survey.type === 'ai_generated' ? '✨ AI' : 'Manual'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        survey.status === 'active' ? 'default' :
                        survey.status === 'draft' ? 'secondary' : 'outline'
                      }>
                        {survey.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{survey.questions?.length || 0}</TableCell>
                    <TableCell>{survey.response_count || 0}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{survey.placement}</TableCell>
                    <TableCell>
                      {survey._id && (
                        <button
                          className="text-xs text-blue-500 hover:underline"
                          onClick={() => {
                            const link = `https://survey.moustacheleads.com/survey/${survey._id}`;
                            navigator.clipboard.writeText(link);
                            toast({ title: "Link copied!" });
                          }}
                        >
                          Copy Link
                        </button>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={survey.status === 'active'}
                        onCheckedChange={(checked) => {
                          if (survey._id) {
                            toggleStatusMutation.mutate({
                              id: survey._id,
                              status: checked ? 'active' : 'inactive'
                            });
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(survey)}
                          title="Edit survey"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePreview(survey)}
                          title="Preview survey"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            if (survey._id && confirm('Delete this survey?')) {
                              deleteMutation.mutate(survey._id);
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Survey Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSurvey ? "Edit Survey" : "Create Survey"}</DialogTitle>
          </DialogHeader>

          <Tabs value={createTab} onValueChange={setCreateTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual">Manual</TabsTrigger>
              <TabsTrigger value="ai">
                <Sparkles className="h-4 w-4 mr-1" /> AI Generate
              </TabsTrigger>
            </TabsList>

            {/* Manual Tab */}
            <TabsContent value="manual" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Survey Name</Label>
                  <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Age & Interest Survey" />
                </div>
                <div>
                  <Label>Placement</Label>
                  <Select value={formPlacement} onValueChange={setFormPlacement}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="offerwall_card">Card on Offerwall</SelectItem>
                      <SelectItem value="before_offer">Before Specific Offer</SelectItem>
                      <SelectItem value="before_subwall">Before Sub-Wall</SelectItem>
                      <SelectItem value="subwall_associated">Associated to Sub-Wall</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {formPlacement === 'offerwall_card' && (
                <div>
                  <Label>Card Image URL</Label>
                  <Input value={formImageUrl} onChange={(e) => setFormImageUrl(e.target.value)} placeholder="https://... (image shown on the offerwall card)" />
                </div>
              )}
              {formPlacement === 'before_offer' && (
                <div className="space-y-3 border rounded-lg p-4">
                  <Label className="text-base font-semibold">Associate Offers</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={offerSearch}
                      onChange={(e) => handleOfferSearchChange(e.target.value)}
                      placeholder="Search offers by name..."
                      className="pl-9"
                    />
                  </div>
                  {offerSearchLoading && <p className="text-xs text-muted-foreground">Searching...</p>}
                  {offerResults.length > 0 && (
                    <div className="border rounded max-h-40 overflow-y-auto">
                      {offerResults.map((offer: any) => (
                        <button
                          key={offer._id || offer.offer_id}
                          className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex justify-between items-center border-b last:border-b-0"
                          onClick={() => {
                            const id = offer._id || offer.offer_id;
                            if (!selectedOfferIds.includes(id)) {
                              setSelectedOfferIds([...selectedOfferIds, id]);
                            }
                            setOfferSearch("");
                            setOfferResults([]);
                          }}
                        >
                          <span>{offer.name || offer.offer_name}</span>
                          <span className="text-xs text-muted-foreground">{offer._id || offer.offer_id}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedOfferIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedOfferIds.map((id) => (
                        <Badge key={id} variant="secondary" className="flex items-center gap-1">
                          {id}
                          <button onClick={() => setSelectedOfferIds(selectedOfferIds.filter(oid => oid !== id))}>
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div>
                <Label>Description</Label>
                <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Optional description..." rows={2} />
              </div>

              {/* Questions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Questions ({formQuestions.length})</Label>
                  <Button size="sm" variant="outline" onClick={addQuestion}>
                    <Plus className="h-3 w-3 mr-1" /> Add Question
                  </Button>
                </div>

                {formQuestions.map((q, qIdx) => (
                  <Card key={qIdx} className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">Q{qIdx + 1}</Badge>
                      <Input
                        value={q.text}
                        onChange={(e) => updateQuestion(qIdx, 'text', e.target.value)}
                        placeholder="Question text..."
                        className="flex-1"
                      />
                      <Select
                        value={q.type}
                        onValueChange={(val) => updateQuestion(qIdx, 'type', val)}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mcq">MCQ</SelectItem>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="yes_no">Yes/No</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="ghost" onClick={() => removeQuestion(qIdx)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>

                    {/* Options for MCQ */}
                    {(q.type === 'mcq' || q.type === 'yes_no') && (
                      <div className="ml-8 space-y-2">
                        {(q.options || []).map((opt, oIdx) => (
                          <div key={oIdx} className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-4">{oIdx + 1}.</span>
                            <Input
                              value={opt}
                              onChange={(e) => updateOption(qIdx, oIdx, e.target.value)}
                              placeholder="Option text..."
                              className="flex-1 h-8 text-sm"
                            />
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => removeOption(qIdx, oIdx)}>
                              <Trash2 className="h-3 w-3 text-red-400" />
                            </Button>
                          </div>
                        ))}
                        <Button size="sm" variant="ghost" className="text-xs" onClick={() => addOption(qIdx)}>
                          + Add Option
                        </Button>
                      </div>
                    )}

                    <div className="flex items-center gap-2 ml-8">
                      <Switch
                        checked={q.required}
                        onCheckedChange={(val) => updateQuestion(qIdx, 'required', val)}
                      />
                      <span className="text-xs text-muted-foreground">Required</span>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* AI Generate Tab */}
            <TabsContent value="ai" className="space-y-4 mt-4">
              <div>
                <Label>Survey Name</Label>
                <Input value={aiName} onChange={(e) => setAiName(e.target.value)} placeholder="e.g. Health Insurance Qualifier" />
              </div>
              <div>
                <Label>Prompt</Label>
                <Textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Describe what you want to qualify users for. E.g.: Create a survey to qualify users for health insurance offers targeting 25-55 year olds with income above $50k..."
                  rows={4}
                />
              </div>
              <Button onClick={handleGenerate} disabled={generateMutation.isPending}>
                <Wand2 className="h-4 w-4 mr-2" />
                {generateMutation.isPending ? 'Generating...' : 'Generate Questions'}
              </Button>

              {/* Generated Preview */}
              {generatedQuestions.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Generated Questions ({generatedQuestions.length})</Label>
                  {generatedQuestions.map((q, idx) => (
                    <Card key={idx} className="p-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">Q{idx + 1}</Badge>
                        <span className="font-medium text-sm">{q.text}</span>
                        <Badge variant="outline" className="ml-auto text-xs">{q.type}</Badge>
                      </div>
                      {q.options && q.options.length > 0 && (
                        <div className="ml-8 mt-2 flex flex-wrap gap-1">
                          {q.options.map((opt, oIdx) => (
                            <Badge key={oIdx} variant="secondary" className="text-xs">{opt}</Badge>
                          ))}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}

              <div>
                <Label>Placement</Label>
                <Select value={formPlacement} onValueChange={setFormPlacement}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="offerwall_card">Card on Offerwall</SelectItem>
                    <SelectItem value="before_offer">Before Specific Offer</SelectItem>
                    <SelectItem value="before_subwall">Before Sub-Wall</SelectItem>
                    <SelectItem value="subwall_associated">Associated to Sub-Wall</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formPlacement === 'offerwall_card' && (
                <div>
                  <Label>Card Image URL</Label>
                  <Input value={formImageUrl} onChange={(e) => setFormImageUrl(e.target.value)} placeholder="https://... (image shown on the offerwall card)" />
                </div>
              )}
              {formPlacement === 'before_offer' && (
                <div className="space-y-3 border rounded-lg p-4">
                  <Label className="text-base font-semibold">Associate Offers</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={offerSearch}
                      onChange={(e) => handleOfferSearchChange(e.target.value)}
                      placeholder="Search offers by name..."
                      className="pl-9"
                    />
                  </div>
                  {offerSearchLoading && <p className="text-xs text-muted-foreground">Searching...</p>}
                  {offerResults.length > 0 && (
                    <div className="border rounded max-h-40 overflow-y-auto">
                      {offerResults.map((offer: any) => (
                        <button
                          key={offer._id || offer.offer_id}
                          className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex justify-between items-center border-b last:border-b-0"
                          onClick={() => {
                            const id = offer._id || offer.offer_id;
                            if (!selectedOfferIds.includes(id)) {
                              setSelectedOfferIds([...selectedOfferIds, id]);
                            }
                            setOfferSearch("");
                            setOfferResults([]);
                          }}
                        >
                          <span>{offer.name || offer.offer_name}</span>
                          <span className="text-xs text-muted-foreground">{offer._id || offer.offer_id}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedOfferIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedOfferIds.map((id) => (
                        <Badge key={id} variant="secondary" className="flex items-center gap-1">
                          {id}
                          <button onClick={() => setSelectedOfferIds(selectedOfferIds.filter(oid => oid !== id))}>
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button
              onClick={handleCreateSurvey}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Saving...' : (editingSurvey ? 'Update Survey' : 'Save Survey')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Survey Preview</DialogTitle>
          </DialogHeader>

          {previewSurvey && (
            <div className="space-y-4">
              {/* Survey Info */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">{previewSurvey.name}</h3>
                {previewSurvey.description && (
                  <p className="text-sm text-muted-foreground">{previewSurvey.description}</p>
                )}
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline">{previewSurvey.placement}</Badge>
                  <Badge variant={previewSurvey.status === 'active' ? 'default' : 'secondary'}>{previewSurvey.status}</Badge>
                  <Badge variant="secondary">{previewSurvey.questions?.length || 0} questions</Badge>
                  <Badge variant="secondary">{previewSurvey.response_count || 0} responses</Badge>
                </div>
                {previewSurvey.image_url && (
                  <img src={previewSurvey.image_url} alt="Survey" className="w-full max-h-40 object-cover rounded-lg mt-2" />
                )}
              </div>

              {/* Tabs: Questions / Responses */}
              <Tabs value={previewTab} onValueChange={(v) => setPreviewTab(v as "questions" | "responses")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="questions">Questions</TabsTrigger>
                  <TabsTrigger value="responses">Responses ({previewSurvey.response_count || 0})</TabsTrigger>
                </TabsList>

                <TabsContent value="questions" className="space-y-3 mt-4">
                  {previewSurvey.questions && previewSurvey.questions.length > 0 ? (
                    previewSurvey.questions.map((q, idx) => (
                      <Card key={idx} className="p-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">Q{idx + 1}</Badge>
                          <span className="font-medium text-sm flex-1">{q.text}</span>
                          <Badge variant="outline" className="text-xs">{q.type}</Badge>
                          {q.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                        </div>
                        {q.options && q.options.length > 0 && (
                          <div className="ml-8 mt-2 flex flex-wrap gap-1">
                            {q.options.map((opt, oIdx) => (
                              <Badge key={oIdx} variant="secondary" className="text-xs">{opt}</Badge>
                            ))}
                          </div>
                        )}
                      </Card>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-4">No questions defined.</p>
                  )}
                </TabsContent>

                <TabsContent value="responses" className="mt-4">
                  {responsesData?.responses && responsesData.responses.length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">{responsesData.total} total responses</p>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Answers</TableHead>
                            <TableHead>Time</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {responsesData.responses.map((resp: SurveyResponse) => (
                            <TableRow key={resp._id}>
                              <TableCell className="text-sm">{resp.user_id}</TableCell>
                              <TableCell className="text-sm">
                                {resp.answers?.length || 0} answers
                              </TableCell>
                              <TableCell className="text-sm">{resp.time_spent_seconds}s</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {resp.completed_at ? new Date(resp.completed_at).toLocaleDateString() : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No responses yet.</p>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
