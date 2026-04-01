import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  CheckCircle,
  Clock,
  XCircle,
  DollarSign,
  ShieldAlert,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  RotateCcw,
  Zap,
  Shield,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAdminP1Stats,
  getAdminP1List,
  getAdminP1Countries,
  approveP1Referral,
  rejectP1Referral,
  holdP1Referral,
  bulkActionP1,
} from "@/services/referralApi";

interface FraudCheck {
  check_name: string;
  result: string;
  details: Record<string, unknown>;
}

interface P1Referral {
  _id: string;
  referrer_id: string;
  referrer_name: string;
  referrer_email: string;
  referred_username: string;
  referred_email: string;
  referred_user_id: string;
  bonus_amount: number;
  bonus_percent: number;
  fraud_score: number | null;
  status: string;
  created_at: string;
  ip_address: string;
  country: string;
  country_code: string;
  city: string;
  device_fingerprint: string;
  user_agent: string;
  referred_logins?: number;
  referred_email_verified?: boolean;
  referred_account_status?: string;
  fraud_checks?: FraudCheck[];
  fraud_checks_passed?: number;
  fraud_checks_failed?: number;
  fraud_checks_total?: number;
}

interface Stats {
  total_referrals: number;
  auto_approved: number;
  pending_review: number;
  auto_rejected: number;
  total_bonus_released: number;
  total_fraud_blocked: number;
}

const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; color: string }> = {
  approved: { variant: "default", label: "Approved", color: "text-green-600" },
  pending_review: { variant: "secondary", label: "Pending", color: "text-yellow-600" },
  pending_fraud_check: { variant: "outline", label: "Processing", color: "text-blue-600" },
  rejected: { variant: "destructive", label: "Rejected", color: "text-red-600" },
};

const FraudScoreBar = ({ score }: { score: number | null }) => {
  if (score === null) return <span className="text-muted-foreground text-xs">—</span>;
  const color = score <= 20 ? "bg-green-500" : score <= 60 ? "bg-yellow-500" : "bg-red-500";
  const label = score <= 20 ? "Clean" : score <= 60 ? "Medium" : "High";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-semibold ${score <= 20 ? 'text-green-600' : score <= 60 ? 'text-yellow-600' : 'text-red-600'}`}>{score}</span>
    </div>
  );
};

const ChecksBadges = ({ passed, failed, total }: { passed: number; failed: number; total: number }) => {
  if (total === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`w-1.5 h-3 rounded-sm ${i < passed ? 'bg-green-500' : 'bg-red-500'}`} />
      ))}
    </div>
  );
};

// ─── Detail Modal ───
function ReferralDetailModal({ referral, open, onClose, onAction }: {
  referral: P1Referral | null;
  open: boolean;
  onClose: () => void;
  onAction: (id: string, action: "approve" | "reject" | "hold") => void;
}) {
  if (!referral) return null;
  const score = referral.fraud_score ?? 0;
  const scoreColor = score <= 20 ? 'text-green-600' : score <= 60 ? 'text-yellow-600' : 'text-red-600';
  const scoreLabel = score <= 20 ? 'Genuine — Safe to Release Bonus' : score <= 60 ? 'Suspicious — Manual Review Needed' : 'High Risk — Do Not Release';
  const checks = referral.fraud_checks || [];
  const passed = referral.fraud_checks_passed || 0;
  const failed = referral.fraud_checks_failed || 0;

  const checkLabels: Record<string, string> = {
    ipqs_ip_check: 'IP Quality / VPN Detection',
    duplicate_ip: 'Duplicate IP Address',
    duplicate_email: 'Duplicate Email',
    duplicate_fingerprint: 'Duplicate Device Fingerprint',
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {referral.referred_username} — REF-{referral._id.slice(-4).toUpperCase()}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {referral.referred_email} · {referral.ip_address || 'No IP'} · Joined {new Date(referral.created_at).toLocaleString()}
          </p>
        </DialogHeader>

        {/* Status banner */}
        <div className={`rounded-lg p-3 ${referral.status === 'approved' ? 'bg-green-50 border border-green-200' : referral.status === 'rejected' ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}`}>
          <div className="flex items-center gap-2">
            {referral.status === 'approved' ? <Zap className="h-4 w-4 text-green-600" /> : referral.status === 'rejected' ? <XCircle className="h-4 w-4 text-red-600" /> : <Clock className="h-4 w-4 text-yellow-600" />}
            <span className={`text-sm font-medium ${statusConfig[referral.status]?.color || ''}`}>
              {statusConfig[referral.status]?.label || referral.status}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Score {score}/100 · {passed + failed} checks run · Bonus: ${referral.bonus_amount.toFixed(2)} ({referral.bonus_percent}%)
          </p>
        </div>

        {/* Fraud Score */}
        <div className="border rounded-lg p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Fraud Score</div>
          <div className="flex items-center gap-3">
            <span className={`text-3xl font-bold ${scoreColor}`}>{score}</span>
            <span className="text-muted-foreground text-xs">/100</span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${score <= 20 ? 'bg-green-500' : score <= 60 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${score}%` }} />
            </div>
          </div>
          <p className={`text-xs mt-1 ${scoreColor}`}>{scoreLabel}</p>
          <div className="flex gap-4 mt-2 text-xs">
            <span className="text-green-600">✓ {passed} passed</span>
            <span className="text-red-600">✗ {failed} failed</span>
          </div>
        </div>

        {/* Fraud Checks */}
        {checks.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Verification Checks</div>
            <div className="grid grid-cols-1 gap-2">
              {checks.map((c, i) => (
                <div key={i} className={`flex items-center justify-between rounded-lg border p-3 ${c.result === 'pass' ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}>
                  <div className="flex items-center gap-2">
                    {c.result === 'pass' ? <CheckCircle className="h-3.5 w-3.5 text-green-600" /> : <XCircle className="h-3.5 w-3.5 text-red-600" />}
                    <span className="text-sm">{checkLabels[c.check_name] || c.check_name}</span>
                  </div>
                  <Badge variant={c.result === 'pass' ? 'default' : 'destructive'} className="text-[10px] h-5">
                    {c.result === 'pass' ? 'PASS' : 'FAIL'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* User Info */}
        <div className="border rounded-lg p-4 space-y-2">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Referred User Details</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted-foreground">Username:</span> {referral.referred_username}</div>
            <div><span className="text-muted-foreground">Email:</span> {referral.referred_email}</div>
            <div><span className="text-muted-foreground">IP:</span> {referral.ip_address || '—'}</div>
            <div><span className="text-muted-foreground">Country:</span> {referral.country ? `${referral.country_code || referral.country}${referral.city ? ' / ' + referral.city : ''}` : '—'}</div>
            <div><span className="text-muted-foreground">Email Verified:</span> {referral.referred_email_verified ? '✓ Yes' : '✗ No'}</div>
            <div><span className="text-muted-foreground">Logins:</span> {referral.referred_logins || 0}</div>
            <div><span className="text-muted-foreground">Referrer:</span> {referral.referrer_name}</div>
          </div>
        </div>

        {/* Referral position + bonus */}
        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-sm text-muted-foreground">
            Referral position: <span className="font-medium text-foreground">{referral.bonus_percent === 10 ? '1st' : 'Nth'}</span> · Bonus: <span className="font-medium text-foreground">${referral.bonus_amount.toFixed(2)}</span>
          </span>
          {referral.status === 'pending_review' && (
            <div className="flex gap-2">
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-8" onClick={() => onAction(referral._id, 'approve')}>Approve</Button>
              <Button size="sm" variant="destructive" className="h-8" onClick={() => onAction(referral._id, 'reject')}>Reject</Button>
            </div>
          )}
          {referral.status === 'rejected' && (
            <Button size="sm" variant="outline" className="h-8" onClick={() => onAction(referral._id, 'hold')}>Move to Review</Button>
          )}
          {referral.status === 'approved' && (
            <span className="text-sm text-green-600 flex items-center gap-1"><Zap className="h-3.5 w-3.5" /> Bonus Released</span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───
export default function AdminReferrals() {
  const [stats, setStats] = useState<Stats>({
    total_referrals: 0, auto_approved: 0, pending_review: 0,
    auto_rejected: 0, total_bonus_released: 0, total_fraud_blocked: 0,
  });
  const [referrals, setReferrals] = useState<P1Referral[]>([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [scoreFilter, setScoreFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [detailRef, setDetailRef] = useState<P1Referral | null>(null);

  const getScoreRange = (filter: string) => {
    if (filter === "low") return { min: 0, max: 29 };
    if (filter === "medium") return { min: 30, max: 60 };
    if (filter === "high") return { min: 61, max: 100 };
    return {};
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const scoreRange = getScoreRange(scoreFilter);
      const [statsRes, listRes, countriesRes] = await Promise.all([
        getAdminP1Stats(),
        getAdminP1List({
          page,
          per_page: perPage,
          status: statusFilter || undefined,
          search: search || undefined,
          fraud_score_min: scoreRange.min,
          fraud_score_max: scoreRange.max,
          country: countryFilter || undefined,
        }),
        getAdminP1Countries(),
      ]);
      if (statsRes.success) setStats(statsRes.stats);
      if (listRes.success) {
        setReferrals(listRes.referrals);
        setTotalPages(listRes.total_pages);
        setTotal(listRes.total);
      }
      if (countriesRes.success) setCountries(countriesRes.countries);
    } catch (e) {
      console.error("Error loading admin referral data:", e);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, statusFilter, scoreFilter, countryFilter, search]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAction = async (id: string, action: "approve" | "reject" | "hold") => {
    try {
      const fn = action === "approve" ? approveP1Referral : action === "reject" ? rejectP1Referral : holdP1Referral;
      const res = await fn(id);
      if (res.success) {
        toast.success(`Referral ${action === 'hold' ? 'moved to review' : action + 'd'}`);
        setDetailRef(null);
        loadData();
      } else {
        toast.error(res.error || "Action failed");
      }
    } catch {
      toast.error("Action failed");
    }
  };

  const handleBulk = async (action: "approve" | "reject" | "hold") => {
    if (selected.size === 0) return toast.error("No referrals selected");
    try {
      const res = await bulkActionP1(action, Array.from(selected));
      if (res.success) {
        toast.success(`${res.processed} referrals ${action === 'hold' ? 'moved to review' : action + 'd'}`);
        setSelected(new Set());
        loadData();
      }
    } catch {
      toast.error("Bulk action failed");
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    setSelected(selected.size === referrals.length ? new Set() : new Set(referrals.map(r => r._id)));
  };
  const resetFilters = () => {
    setStatusFilter(""); setScoreFilter(""); setCountryFilter(""); setSearch(""); setPage(1);
  };

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Referral Verification Queue</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">
            <Users className="h-3 w-3" /> Total Referrals
          </div>
          <div className="text-2xl font-bold">{stats.total_referrals}</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">
            <CheckCircle className="h-3 w-3 text-green-500" /> Auto-Approved
          </div>
          <div className="text-2xl font-bold text-green-600">{stats.auto_approved}</div>
          <div className="text-[10px] text-muted-foreground">score ≤20, all pass</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">
            <Clock className="h-3 w-3 text-yellow-500" /> Pending / Review
          </div>
          <div className="text-2xl font-bold text-yellow-600">{stats.pending_review}</div>
          <div className="text-[10px] text-muted-foreground">manual check</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">
            <XCircle className="h-3 w-3 text-red-500" /> Auto-Rejected
          </div>
          <div className="text-2xl font-bold text-red-600">{stats.auto_rejected}</div>
          <div className="text-[10px] text-muted-foreground">score ≥75 / hard fail</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">
            <DollarSign className="h-3 w-3 text-green-500" /> Bonus Released
          </div>
          <div className="text-2xl font-bold text-green-600">${stats.total_bonus_released.toFixed(2)}</div>
          <div className="text-[10px] text-muted-foreground">auto-approved only</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">
            <ShieldAlert className="h-3 w-3 text-red-500" /> Fraud Blocked
          </div>
          <div className="text-2xl font-bold text-red-600">${stats.total_fraud_blocked.toFixed(2)}</div>
          <div className="text-[10px] text-muted-foreground">saved by engine</div>
        </Card>
      </div>

      {/* Auto-Engine Info Bar */}
      <div className="bg-muted/50 border rounded-lg px-4 py-2 flex items-center gap-3 text-xs">
        <Zap className="h-3.5 w-3.5 text-orange-500" />
        <span className="font-medium text-orange-600">AUTO-ENGINE ACTIVE</span>
        <span className="text-muted-foreground">Score ≤20 + ALL checks pass →</span>
        <span className="text-green-600 font-medium">Auto-Approve + Bonus + Postback</span>
        <span className="text-muted-foreground ml-2">Score ≥75 or hard fail →</span>
        <span className="text-red-600 font-medium">Instant Auto-Reject</span>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 border-b">
        {[
          { key: "", label: "All", count: stats.total_referrals },
          { key: "approved", label: "Approved", count: stats.auto_approved },
          { key: "pending_review", label: "Pending Review", count: stats.pending_review },
          { key: "rejected", label: "Rejected", count: stats.auto_rejected },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setStatusFilter(tab.key); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              statusFilter === tab.key
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
              statusFilter === tab.key ? "bg-orange-100 text-orange-700" : "bg-muted text-muted-foreground"
            }`}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search name or email..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-8 h-9 text-sm" />
        </div>
        <Select value={scoreFilter || "any"} onValueChange={(v) => { setScoreFilter(v === "any" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue placeholder="Score" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any Score</SelectItem>
            <SelectItem value="low">Low (&lt;30)</SelectItem>
            <SelectItem value="medium">Medium (30–60)</SelectItem>
            <SelectItem value="high">High (&gt;60)</SelectItem>
          </SelectContent>
        </Select>
        {countries.length > 0 && (
          <Select value={countryFilter || "all_countries"} onValueChange={(v) => { setCountryFilter(v === "all_countries" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-[130px] h-9 text-sm"><SelectValue placeholder="Country" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all_countries">All Countries</SelectItem>
              {countries.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={resetFilters}>
          <RotateCcw className="h-3 w-3 mr-1" /> Reset
        </Button>

        {/* Bulk Actions */}
        {selected.size > 0 && (
          <div className="flex gap-1.5 ml-auto">
            <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => handleBulk("approve")}>
              ✓ Approve ({selected.size})
            </Button>
            <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={() => handleBulk("reject")}>
              ✗ Reject ({selected.size})
            </Button>
            <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => handleBulk("hold")}>
              ⏸ Hold ({selected.size})
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500" />
            </div>
          ) : referrals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No referrals found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-left text-muted-foreground text-xs">
                    <th className="p-2.5 w-8">
                      <input type="checkbox" checked={selected.size === referrals.length && referrals.length > 0}
                        onChange={toggleAll} className="rounded" />
                    </th>
                    <th className="p-2.5 font-medium">Ref ID</th>
                    <th className="p-2.5 font-medium">Name / Email</th>
                    <th className="p-2.5 font-medium">Referred By</th>
                    <th className="p-2.5 font-medium">IP Address</th>
                    <th className="p-2.5 font-medium">Country</th>
                    <th className="p-2.5 font-medium">Joined</th>
                    <th className="p-2.5 font-medium">Logins</th>
                    <th className="p-2.5 font-medium">Checks</th>
                    <th className="p-2.5 font-medium">Score</th>
                    <th className="p-2.5 font-medium">Flags</th>
                    <th className="p-2.5 font-medium">Status</th>
                    <th className="p-2.5 font-medium">Bonus</th>
                    <th className="p-2.5 font-medium w-16">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((r) => {
                    const cfg = statusConfig[r.status] || { variant: "outline" as const, label: r.status, color: "" };
                    const failedChecks = (r.fraud_checks || []).filter(c => c.result === 'block');
                    return (
                      <tr key={r._id} className={`border-b last:border-0 hover:bg-muted/20 ${selected.has(r._id) ? 'bg-orange-50/50' : ''}`}>
                        <td className="p-2.5">
                          <input type="checkbox" checked={selected.has(r._id)} onChange={() => toggleSelect(r._id)} className="rounded" />
                        </td>
                        <td className="p-2.5 font-mono text-xs text-muted-foreground">REF-{r._id.slice(-4).toUpperCase()}</td>
                        <td className="p-2.5">
                          <div className="font-medium text-sm">{r.referred_username}</div>
                          <div className="text-[11px] text-muted-foreground">{r.referred_email}</div>
                        </td>
                        <td className="p-2.5">
                          <div className="text-sm font-medium text-orange-600">{r.referrer_name}</div>
                          <div className="text-[11px] text-muted-foreground">{r.referrer_email}</div>
                        </td>
                        <td className="p-2.5 font-mono text-xs">{r.ip_address || '—'}</td>
                        <td className="p-2.5 text-xs">
                          {r.country ? (
                            <span>{r.country_code || r.country}{r.city ? `/${r.city}` : ''}</span>
                          ) : '—'}
                        </td>
                        <td className="p-2.5 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                        <td className="p-2.5 text-xs">{r.referred_logins || 0}</td>
                        <td className="p-2.5">
                          <ChecksBadges passed={r.fraud_checks_passed || 0} failed={r.fraud_checks_failed || 0} total={r.fraud_checks_total || 0} />
                        </td>
                        <td className="p-2.5"><FraudScoreBar score={r.fraud_score} /></td>
                        <td className="p-2.5">
                          {failedChecks.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {failedChecks.map((c, i) => (
                                <span key={i} className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium uppercase">
                                  {c.check_name.replace('duplicate_', 'DUP-').replace('ipqs_ip_check', 'VPN/PROXY')}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-green-600 font-medium">CLEAN</span>
                          )}
                        </td>
                        <td className="p-2.5"><Badge variant={cfg.variant} className="text-[10px] h-5 whitespace-nowrap">{cfg.label}</Badge></td>
                        <td className="p-2.5 font-medium text-sm">${r.bonus_amount.toFixed(2)}</td>
                        <td className="p-2.5">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setDetailRef(r)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Showing {referrals.length} of {total}</span>
          <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setPage(1); }}>
            <SelectTrigger className="w-[80px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <span>per page</span>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" className="h-8" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-sm text-muted-foreground px-2">Page {page} of {totalPages}</span>
            <Button size="sm" variant="outline" className="h-8" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <ReferralDetailModal referral={detailRef} open={!!detailRef} onClose={() => setDetailRef(null)} onAction={handleAction} />
    </div>
  );
}
