import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  fetchSurveys, createSurvey, updateSurvey, deleteSurvey,
  fetchAssignments, assignSurvey, unassignSurvey,
  fetchSurveyAnalytics, fetchOfferCoverage, previewSurvey, seedSurveys,
  fetchResponseDetail,
  type SurveyData, type SurveyQuestion,
} from "@/services/surveyApi";
import {
  Shield, Plus, Pencil, Trash2, Eye, BarChart3, Link2, Unlink,
  ChevronDown, ChevronRight, Search, RefreshCw, Database, CheckCircle2,
  XCircle, Clock, AlertTriangle, X,
} from "lucide-react";

const CATEGORIES = [
  "Gaming", "Finance", "Shopping", "Health", "Education",
  "Entertainment", "Technology", "Travel", "Dating", "Lifestyle", "General",
];

const Q_TYPES = [
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "yes_no", label: "Yes / No" },
  { value: "short_text", label: "Short Text" },
  { value: "rating", label: "Rating (1-5)" },
];

export default function AdminSurveyGateway() {
  const [tab, setTab] = useState<"surveys" | "assignments" | "analytics">("surveys");
  const [surveys, setSurveys] = useState<SurveyData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [page, setPage] = useState(1);

  // Editor state
  const [editing, setEditing] = useState<SurveyData | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  // Preview state
  const [previewData, setPreviewData] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Analytics state
  const [analytics, setAnalytics] = useState<any>(null);
  const [coverage, setCoverage] = useState<any>(null);

  // Assignments state
  const [assignments, setAssignments] = useState<any[]>([]);
  const [assignModal, setAssignModal] = useState(false);
  const [assignSurveyId, setAssignSurveyId] = useState("");
  const [assignOfferIds, setAssignOfferIds] = useState("");

  // Response detail state
  const [responseDetail, setResponseDetail] = useState<any>(null);
  const [showResponseDetail, setShowResponseDetail] = useState(false);

  const loadSurveys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchSurveys({ page, per_page: 20, search, category: catFilter });
      if (res.success) { setSurveys(res.surveys); setTotal(res.total); }
    } catch { toast.error("Failed to load surveys"); }
    setLoading(false);
  }, [page, search, catFilter]);

  useEffect(() => { loadSurveys(); }, [loadSurveys]);

  const loadAnalytics = async () => {
    try {
      const [aRes, cRes] = await Promise.all([fetchSurveyAnalytics({ days: 30 }), fetchOfferCoverage()]);
      if (aRes.success) setAnalytics(aRes.analytics);
      if (cRes.success) setCoverage(cRes.coverage);
    } catch { toast.error("Failed to load analytics"); }
  };

  const loadAssignments = async () => {
    try {
      const res = await fetchAssignments();
      if (res.success) setAssignments(res.assignments);
    } catch { toast.error("Failed to load assignments"); }
  };

  useEffect(() => {
    if (tab === "analytics") loadAnalytics();
    if (tab === "assignments") { loadAssignments(); loadSurveys(); }
  }, [tab]);

  const handleSeed = async () => {
    const res = await seedSurveys();
    if (res.success) { toast.success(res.message); loadSurveys(); }
    else toast.error(res.error || "Seed failed");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deactivate this survey?")) return;
    const res = await deleteSurvey(id);
    if (res.success) { toast.success("Survey deactivated"); loadSurveys(); }
  };

  const handlePreview = async (id: string) => {
    const res = await previewSurvey(id);
    if (res.success) { setPreviewData(res); setShowPreview(true); }
  };

  const handleSave = async (data: Partial<SurveyData>) => {
    if (editing?._id) {
      const res = await updateSurvey(editing._id, data);
      if (res.success) { toast.success("Survey updated"); setShowEditor(false); loadSurveys(); }
      else toast.error(res.error || "Update failed");
    } else {
      const res = await createSurvey(data);
      if (res.success) { toast.success("Survey created"); setShowEditor(false); loadSurveys(); }
      else toast.error(res.error || "Create failed");
    }
  };

  const handleAssign = async () => {
    const ids = assignOfferIds.split(",").map(s => s.trim()).filter(Boolean);
    if (!assignSurveyId || ids.length === 0) { toast.error("Fill both fields"); return; }
    const res = await assignSurvey(assignSurveyId, ids);
    if (res.success) { toast.success(res.message); setAssignModal(false); loadAssignments(); }
    else toast.error(res.error);
  };

  const handleUnassign = async (offerId: string) => {
    const res = await unassignSurvey(offerId);
    if (res.success) { toast.success("Unassigned"); loadAssignments(); }
  };

  const handleViewResponse = async (responseId: string) => {
    try {
      const res = await fetchResponseDetail(responseId);
      if (res.success) { setResponseDetail(res); setShowResponseDetail(true); }
      else toast.error("Failed to load response");
    } catch { toast.error("Failed to load response"); }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Survey Gateway</h1>
            <p className="text-sm text-muted-foreground">Bot detection surveys for offer verification</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setEditing(null); setShowEditor(true); }}
            className="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> New Survey
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-lg w-fit">
        {(["surveys", "assignments", "analytics"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors capitalize ${
              tab === t ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}>{t}</button>
        ))}
      </div>

      {/* ═══ SURVEYS TAB ═══ */}
      {tab === "surveys" && (
        <div className="space-y-4">
          <div className="flex gap-3 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search surveys..." className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" />
            </div>
            <select value={catFilter} onChange={e => { setCatFilter(e.target.value); setPage(1); }}
              className="border rounded-lg px-3 py-2 text-sm">
              <option value="">All categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={loadSurveys} className="p-2 border rounded-lg hover:bg-muted">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading surveys...</div>
          ) : surveys.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No surveys yet. Click "Seed Defaults" to create pre-built surveys or "New Survey" to create your own.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {surveys.map(s => (
                <div key={s._id} className="bg-white dark:bg-card border rounded-xl p-5 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground truncate">{s.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${s.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {s.is_active ? "Active" : "Inactive"}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">{s.category}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-1">{s.description || "No description"}</p>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>{s.questions?.length || 0} questions + captcha</span>
                      <span>Responses: {s.total_responses || 0}</span>
                      <span className="text-green-600">Passed: {s.total_passed || 0}</span>
                      <span className="text-red-600">Failed: {s.total_failed || 0}</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => handlePreview(s._id!)} title="Preview"
                      className="p-2 border rounded-lg hover:bg-muted"><Eye className="h-4 w-4" /></button>
                    <button onClick={() => { setEditing(s); setShowEditor(true); }} title="Edit"
                      className="p-2 border rounded-lg hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => handleDelete(s._id!)} title="Deactivate"
                      className="p-2 border rounded-lg hover:bg-red-50 text-red-500"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {total > 20 && (
            <div className="flex justify-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40">Prev</button>
              <span className="px-3 py-1.5 text-sm text-muted-foreground">Page {page} of {Math.ceil(total / 20)}</span>
              <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40">Next</button>
            </div>
          )}
        </div>
      )}

      {/* ═══ ASSIGNMENTS TAB ═══ */}
      {tab === "assignments" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{assignments.length} offer(s) with manual survey assignments</p>
            <button onClick={() => { setAssignModal(true); setAssignSurveyId(""); setAssignOfferIds(""); }}
              className="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 flex items-center gap-1.5">
              <Link2 className="h-4 w-4" /> Assign Survey
            </button>
          </div>
          {assignments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Link2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No manual assignments. Offers will auto-match surveys by category.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-card border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Offer ID</th>
                    <th className="text-left px-4 py-3 font-medium">Survey ID</th>
                    <th className="text-left px-4 py-3 font-medium">Assigned By</th>
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                    <th className="text-right px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {assignments.map(a => (
                    <tr key={a._id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs">{a.offer_id}</td>
                      <td className="px-4 py-3 font-mono text-xs">{a.survey_id}</td>
                      <td className="px-4 py-3">{a.assigned_by}</td>
                      <td className="px-4 py-3 text-muted-foreground">{a.assigned_at ? new Date(a.assigned_at).toLocaleDateString() : "-"}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleUnassign(a.offer_id)}
                          className="text-red-500 hover:text-red-700 p-1"><Unlink className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══ ANALYTICS TAB ═══ */}
      {tab === "analytics" && (
        <div className="space-y-6">
          {/* Offer Coverage */}
          {coverage && (
            <div className="bg-white dark:bg-card border rounded-xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Database className="h-4 w-4" /> Offer Coverage</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
                <StatBox label="Total Offers" value={coverage.total_offers} />
                <StatBox label="Total w/ Description" value={coverage.total_with_description} color="green" />
                <StatBox label="Total w/o Description" value={coverage.total_without_description} color="amber" />
                <StatBox label="Active Offers" value={coverage.active_offers} color="violet" />
                <StatBox label="Active w/ Description" value={coverage.active_with_description} color="green" />
                <StatBox label="Active w/o Description" value={coverage.active_without_description} color="amber" />
                <StatBox label="Manually Assigned" value={coverage.manually_assigned} color="violet" />
              </div>
              {coverage.category_distribution?.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Category Distribution (Active status: {coverage.active_offers} offers)</p>
                  <div className="flex flex-wrap gap-2">
                    {coverage.category_distribution.map((c: any) => (
                      <span key={c.category} className="text-xs px-2.5 py-1 bg-muted rounded-full">
                        {c.category}: {c.count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Survey Performance */}
          {analytics && (
            <div className="bg-white dark:bg-card border rounded-xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Last 30 Days</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <StatBox label="Total Responses" value={analytics.total} />
                <StatBox label="Passed" value={analytics.passed} color="green" />
                <StatBox label="Failed" value={analytics.failed} color="red" />
                <StatBox label="Abandoned" value={analytics.abandoned} color="amber" />
                <StatBox label="Bot Detection Rate" value={`${analytics.bot_detection_rate || 0}%`} color="violet" />
              </div>
              {analytics.recent_responses?.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Recent Responses (click row for details)</p>
                  <div className="max-h-[500px] overflow-y-auto border rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2">Time</th>
                          <th className="text-left px-3 py-2">User</th>
                          <th className="text-left px-3 py-2">Offer</th>
                          <th className="text-left px-3 py-2">Country</th>
                          <th className="text-left px-3 py-2">Result</th>
                          <th className="text-left px-3 py-2">Duration</th>
                          <th className="text-left px-3 py-2">Device</th>
                          <th className="text-left px-3 py-2">Browser</th>
                          <th className="text-left px-3 py-2">IP</th>
                          <th className="text-left px-3 py-2">Bot?</th>
                          <th className="text-left px-3 py-2">VPN?</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {analytics.recent_responses.map((r: any) => (
                          <tr key={r._id} className="hover:bg-violet-50/50 cursor-pointer transition-colors"
                            onClick={() => handleViewResponse(r._id)}>
                            <td className="px-3 py-2.5 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                            <td className="px-3 py-2.5 font-medium">{r.user_name || r.user_id || '-'}</td>
                            <td className="px-3 py-2.5 max-w-[140px] truncate" title={r.offer_name || r.offer_id}>{r.offer_name || r.offer_id || '-'}</td>
                            <td className="px-3 py-2.5">{r.country_code ? `${r.country_code}` : r.country || '-'}</td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-flex items-center gap-1 font-medium ${
                                r.result === 'passed' ? 'text-green-600' : r.result === 'failed' ? 'text-red-600' : 'text-amber-600'
                              }`}>
                                {r.result === 'passed' ? <CheckCircle2 className="h-3 w-3" /> :
                                 r.result === 'failed' ? <XCircle className="h-3 w-3" /> :
                                 <AlertTriangle className="h-3 w-3" />}
                                {r.result}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">{((r.total_time_ms || 0) / 1000).toFixed(1)}s</td>
                            <td className="px-3 py-2.5">{r.device || '-'}</td>
                            <td className="px-3 py-2.5">{r.browser || '-'}</td>
                            <td className="px-3 py-2.5 font-mono text-[10px]">{r.ip_address || '-'}</td>
                            <td className="px-3 py-2.5">
                              {r.is_bot ? <span className="text-red-600 font-bold">Yes</span> : <span className="text-green-600">No</span>}
                            </td>
                            <td className="px-3 py-2.5">
                              {r.is_vpn ? <span className="text-amber-600 font-bold">Yes</span> : <span className="text-muted-foreground">No</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
          {!analytics && !coverage && (
            <div className="text-center py-12 text-muted-foreground">Loading analytics...</div>
          )}
        </div>
      )}

      {/* ═══ SURVEY EDITOR MODAL ═══ */}
      {showEditor && (
        <SurveyEditorModal
          initial={editing}
          onSave={handleSave}
          onClose={() => setShowEditor(false)}
        />
      )}

      {/* ═══ PREVIEW MODAL ═══ */}
      {showPreview && previewData && (
        <SurveyPreviewModal data={previewData} onClose={() => setShowPreview(false)} />
      )}

      {/* ═══ ASSIGN MODAL ═══ */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setAssignModal(false)}>
          <div className="bg-white dark:bg-card rounded-xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-4">Assign Survey to Offers</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Survey</label>
                <select value={assignSurveyId} onChange={e => setAssignSurveyId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                  <option value="">Select survey...</option>
                  {surveys.filter(s => s.is_active).map(s => (
                    <option key={s._id} value={s._id}>{s.name} ({s.category})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Offer IDs (comma-separated)</label>
                <input value={assignOfferIds} onChange={e => setAssignOfferIds(e.target.value)}
                  placeholder="ML-00001, ML-00002" className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setAssignModal(false)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
              <button onClick={handleAssign} className="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700">Assign</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ RESPONSE DETAIL MODAL ═══ */}
      {showResponseDetail && responseDetail && (
        <ResponseDetailModal data={responseDetail} onClose={() => setShowResponseDetail(false)} />
      )}
    </div>
  );
}

// ── Stat Box Component ──────────────────────────────────────────────────

function StatBox({ label, value, color }: { label: string; value: string | number; color?: string }) {
  const colors: Record<string, string> = {
    green: "text-green-600", red: "text-red-600", amber: "text-amber-600", violet: "text-violet-600",
  };
  return (
    <div className="bg-muted/30 rounded-lg p-3">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-xl font-bold ${color ? colors[color] || "" : ""}`}>{value}</p>
    </div>
  );
}


// ── Survey Editor Modal ─────────────────────────────────────────────────

function SurveyEditorModal({ initial, onSave, onClose }: {
  initial: SurveyData | null;
  onSave: (data: Partial<SurveyData>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [category, setCategory] = useState(initial?.category || "General");
  const [captchaEnabled, setCaptchaEnabled] = useState(initial?.captcha_enabled ?? true);
  const [questions, setQuestions] = useState<SurveyQuestion[]>(initial?.questions || []);

  const addQuestion = () => {
    setQuestions([...questions, { type: "multiple_choice", question: "", options: ["", "", "", ""], required: true }]);
  };

  const updateQuestion = (idx: number, field: string, value: any) => {
    const updated = [...questions];
    (updated[idx] as any)[field] = value;
    setQuestions(updated);
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    const updated = [...questions];
    if (updated[qIdx].options) updated[qIdx].options![oIdx] = value;
    setQuestions(updated);
  };

  const addOption = (qIdx: number) => {
    const updated = [...questions];
    if (!updated[qIdx].options) updated[qIdx].options = [];
    updated[qIdx].options!.push("");
    setQuestions(updated);
  };

  const removeOption = (qIdx: number, oIdx: number) => {
    const updated = [...questions];
    updated[qIdx].options!.splice(oIdx, 1);
    setQuestions(updated);
  };

  const removeQuestion = (idx: number) => {
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    if (!name.trim()) { toast.error("Survey name is required"); return; }
    if (questions.length === 0) { toast.error("Add at least one question"); return; }
    onSave({ name, description, category, captcha_enabled: captchaEnabled, questions });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-card rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-lg">{initial?._id ? "Edit Survey" : "Create Survey"}</h3>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="h-5 w-5" /></button>
        </div>

        {/* Survey Info */}
        <div className="border rounded-xl p-5 mb-5 bg-muted/20">
          <h4 className="font-medium mb-3">Survey info</h4>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-sm font-medium">Survey name *</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Customer satisfaction Q2" className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Category *</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Describe what this survey is about..."
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1 min-h-[60px] resize-y" />
          </div>
        </div>

        {/* Questions */}
        <div className="border rounded-xl p-5 mb-5 bg-muted/20">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium">Questions</h4>
            <button onClick={addQuestion}
              className="px-3 py-1.5 text-sm border rounded-lg hover:bg-muted flex items-center gap-1">
              <Plus className="h-3.5 w-3.5" /> Add question
            </button>
          </div>
          {questions.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">No questions yet — click "Add question" to start</p>
          ) : (
            <div className="space-y-4">
              {questions.map((q, qi) => (
                <div key={qi} className="bg-white dark:bg-background border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">Q{qi + 1}</span>
                    <select value={q.type} onChange={e => updateQuestion(qi, "type", e.target.value)}
                      className="border rounded px-2 py-1 text-xs">
                      {Q_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <button onClick={() => removeQuestion(qi)} className="text-red-400 hover:text-red-600 ml-auto">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <input value={q.question} onChange={e => updateQuestion(qi, "question", e.target.value)}
                    placeholder="Enter your question..." className="w-full border rounded-lg px-3 py-2 text-sm mb-2" />
                  {(q.type === "multiple_choice") && (
                    <div className="space-y-2">
                      {(q.options || []).map((opt, oi) => (
                        <div key={oi} className="flex gap-2 items-center">
                          <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
                          <input value={opt} onChange={e => updateOption(qi, oi, e.target.value)}
                            placeholder={`Option ${oi + 1}`} className="flex-1 border rounded px-2 py-1.5 text-sm" />
                          {(q.options?.length || 0) > 2 && (
                            <button onClick={() => removeOption(qi, oi)} className="text-red-400 hover:text-red-600">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button onClick={() => addOption(qi)} className="text-xs text-violet-600 hover:underline">+ Add option</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CAPTCHA toggle */}
        <div className="border rounded-xl p-5 mb-5 bg-muted/20 flex items-center justify-between">
          <div>
            <h4 className="font-medium">CAPTCHA protection</h4>
            <p className="text-sm text-muted-foreground">Prevent bot submissions</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={captchaEnabled} onChange={e => setCaptchaEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
            <span className="text-sm font-medium">Enabled</span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-muted">Clear</button>
          <button onClick={handleSubmit}
            className="px-5 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 flex items-center gap-1.5">
            Save survey <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}


// ── Survey Preview Modal ────────────────────────────────────────────────

function SurveyPreviewModal({ data, onClose }: { data: any; onClose: () => void }) {
  const survey = data.survey;
  const captcha = data.captcha;
  const [step, setStep] = useState(0);
  const totalSteps = (survey.questions?.length || 0) + (captcha ? 1 : 0);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="max-w-4xl w-full" onClick={e => e.stopPropagation()}>
        <div className="mb-3 text-center">
          <span className="text-xs text-white/80 bg-black/30 px-3 py-1 rounded-full">Live Preview — This is what end users see</span>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex" style={{ minHeight: 480 }}>
          {/* Left branded panel */}
          <div className="w-[42%] bg-gradient-to-br from-indigo-950 via-purple-900 to-violet-700 p-10 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute top-8 right-8 grid grid-cols-5 gap-2.5 opacity-15">
              {Array.from({ length: 25 }).map((_, i) => (
                <div key={i} className="w-2 h-2 rounded-full bg-white" />
              ))}
            </div>
            <div className="absolute bottom-12 left-8 w-14 h-[3px] rounded-full bg-gradient-to-r from-white/40 to-transparent" />
            <img src="/logo.png" alt="ML" className="h-16 brightness-0 invert opacity-90 mb-8 relative z-10" />
            <h2 className="text-white text-2xl font-bold tracking-tight mb-2 relative z-10">MoustacheLeads</h2>
            <p className="text-white/50 text-sm text-center max-w-[220px] relative z-10">Your trusted partner in performance marketing</p>
          </div>
          {/* Right content */}
          <div className="flex-1 p-10 flex flex-col justify-center relative">
            <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-gradient-radial from-violet-100/50 to-transparent rounded-full pointer-events-none" />
            <div className="max-w-[400px] mx-auto w-full relative z-10">
              <p className="text-xs font-semibold text-violet-500 uppercase tracking-widest mb-5">Step {step + 1} of {totalSteps}</p>

              {step < (survey.questions?.length || 0) && (
                <div>
                  <p className="text-xl font-bold text-gray-900 mb-6 leading-snug">{survey.questions[step].question}</p>
                  {survey.questions[step].type === "multiple_choice" && (
                    <div className="space-y-3">
                      {(survey.questions[step].options || []).map((opt: string, i: number) => (
                        <div key={i} className="flex items-center gap-3.5 p-4 border-2 rounded-[14px] cursor-pointer hover:border-violet-400 hover:bg-violet-50 hover:translate-x-1 transition-all">
                          <div className="w-[22px] h-[22px] rounded-full border-2 border-gray-300 flex-shrink-0" />
                          <span className="text-[15px] text-gray-700">{opt}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {survey.questions[step].type === "yes_no" && (
                    <div className="flex gap-3.5">
                      <div className="flex-1 p-4.5 border-2 rounded-[14px] text-center cursor-pointer hover:border-violet-400 hover:bg-violet-50 font-semibold text-base">Yes</div>
                      <div className="flex-1 p-4.5 border-2 rounded-[14px] text-center cursor-pointer hover:border-violet-400 hover:bg-violet-50 font-semibold text-base">No</div>
                    </div>
                  )}
                  {survey.questions[step].type === "short_text" && (
                    <input placeholder="Type your answer..." className="w-full border-2 rounded-[14px] px-5 py-4 text-[15px] bg-gray-50" readOnly />
                  )}
                </div>
              )}

              {step === (survey.questions?.length || 0) && captcha && (
                <div className="bg-gradient-to-br from-violet-50 to-purple-50 border-2 border-violet-200 rounded-2xl p-7 text-center">
                  <p className="text-xl font-bold text-indigo-950 mb-5">{captcha.question}</p>
                  {captcha.type === "color_pick" ? (
                    <div className="flex gap-3.5 justify-center">
                      {(captcha.options || []).map((hex: string) => (
                        <div key={hex} className="w-[60px] h-[60px] rounded-[14px] cursor-pointer border-3 border-transparent hover:scale-110 transition-transform shadow-lg"
                          style={{ background: hex }} />
                      ))}
                    </div>
                  ) : captcha.type === "word_scramble" ? (
                    <input placeholder="Type the word..." className="w-full border-2 rounded-[14px] px-5 py-4 text-center text-lg tracking-[3px]" readOnly />
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {(captcha.options || []).map((opt: string) => (
                        <div key={opt} className="p-3.5 border-2 rounded-xl text-center cursor-pointer hover:border-violet-400 hover:bg-violet-50 font-semibold text-[15px]">{opt}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3.5 mt-8">
                {step > 0 && (
                  <button onClick={() => setStep(s => s - 1)} className="flex-1 py-4 bg-gray-100 rounded-[14px] font-semibold text-gray-600 hover:bg-gray-200">Back</button>
                )}
                <button onClick={() => setStep(s => Math.min(s + 1, totalSteps - 1))}
                  className="flex-1 py-4 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-[14px] font-bold hover:opacity-90 shadow-[0_6px_20px_rgba(109,40,217,0.35)]">
                  Continue
                </button>
              </div>

              <div className="mt-10 text-center">
                <span className="text-[11px] text-violet-300">Powered by <span className="font-bold text-violet-400">MoustacheLeads</span></span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 text-center">
          <button onClick={onClose} className="text-sm text-white/80 hover:text-white">Close preview</button>
        </div>
      </div>
    </div>
  );
}

// ── Response Detail Modal ───────────────────────────────────────────────

function ResponseDetailModal({ data, onClose }: { data: any; onClose: () => void }) {
  const r = data.response;
  const survey = data.survey;

  const InfoRow = ({ label, value, color }: { label: string; value: any; color?: string }) => (
    <div className="flex justify-between items-center py-2 border-b border-muted/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium ${color || ""}`}>{value || "-"}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-card rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-lg">Response Details</h3>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="h-5 w-5" /></button>
        </div>

        {/* Result badge */}
        <div className="flex items-center gap-3 mb-5">
          <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
            r.result === 'passed' ? 'bg-green-100 text-green-700' :
            r.result === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {r.result === 'passed' ? '✓ Passed' : r.result === 'failed' ? '✗ Failed' : '⚠ Abandoned'}
          </span>
          {r.is_bot && <span className="px-3 py-1.5 rounded-full text-sm font-semibold bg-red-100 text-red-700">🤖 Bot Detected</span>}
          {r.is_vpn && <span className="px-3 py-1.5 rounded-full text-sm font-semibold bg-amber-100 text-amber-700">🔒 VPN</span>}
        </div>

        {/* User & Offer Info */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="border rounded-lg p-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">User Info</h4>
            <InfoRow label="Username" value={r.user_name || r.user_id} />
            <InfoRow label="Country" value={r.country ? `${r.country} ${r.country_code ? `(${r.country_code})` : ''}` : '-'} />
            <InfoRow label="IP Address" value={r.ip_address} />
            <InfoRow label="Device" value={r.device} />
            <InfoRow label="Browser" value={r.browser} />
            <InfoRow label="OS" value={r.os} />
          </div>
          <div className="border rounded-lg p-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Survey Info</h4>
            <InfoRow label="Offer" value={r.offer_name || r.offer_id} />
            <InfoRow label="Offer ID" value={r.offer_id} />
            <InfoRow label="Click ID" value={r.click_id} />
            <InfoRow label="Survey" value={survey?.name || r.survey_id} />
            <InfoRow label="Duration" value={`${((r.total_time_ms || 0) / 1000).toFixed(1)}s`} />
            <InfoRow label="Captcha" value={r.captcha_passed ? '✓ Passed' : '✗ Failed'} color={r.captcha_passed ? 'text-green-600' : 'text-red-600'} />
          </div>
        </div>

        {/* Bot Detection Signals */}
        {r.bot_signals && r.bot_signals.length > 0 && (
          <div className="border rounded-lg p-4 mb-5 bg-red-50/50">
            <h4 className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2">Bot Detection Signals</h4>
            <div className="flex flex-wrap gap-2">
              {r.bot_signals.map((s: string) => (
                <span key={s} className="text-xs px-2.5 py-1 bg-red-100 text-red-700 rounded-full font-medium">
                  {s.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Technical Details */}
        <div className="border rounded-lg p-4 mb-5">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Technical Details</h4>
          <InfoRow label="Mouse Moved" value={r.mouse_moved ? 'Yes' : 'No'} color={r.mouse_moved ? 'text-green-600' : 'text-red-600'} />
          <InfoRow label="Honeypot Filled" value={r.honeypot_filled ? 'Yes (bot)' : 'No'} color={r.honeypot_filled ? 'text-red-600' : 'text-green-600'} />
          <InfoRow label="Captcha Type" value={r.captcha_type || '-'} />
          <InfoRow label="Submitted At" value={r.created_at ? new Date(r.created_at).toLocaleString() : '-'} />
          <div className="mt-2 pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-1">User Agent</p>
            <p className="text-xs font-mono bg-muted/50 p-2 rounded break-all">{r.user_agent || '-'}</p>
          </div>
        </div>

        {/* Answers */}
        {r.answers && r.answers.length > 0 && (
          <div className="border rounded-lg p-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Survey Answers</h4>
            <div className="space-y-3">
              {r.answers.map((a: any, i: number) => {
                const question = survey?.questions?.[a.question_index];
                return (
                  <div key={i} className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">
                      Q{(a.question_index ?? i) + 1}: {question?.question || `Question ${(a.question_index ?? i) + 1}`}
                    </p>
                    <p className="text-sm font-medium">{a.answer}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Time spent: {((a.time_spent_ms || 0) / 1000).toFixed(1)}s
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
