import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Users, DollarSign, TrendingUp, Clock, CheckCircle, XCircle, Infinity } from "lucide-react";
import { toast } from "sonner";
import {
  getMyReferralLink,
  getP1Stats,
  getP1Referrals,
  getP2Stats,
  getP2Referrals,
} from "@/services/referralApi";

interface P1Referral {
  _id: string;
  referred_username: string;
  referred_email: string;
  bonus_amount: number;
  bonus_percent: number;
  status: string;
  fraud_score: number | null;
  created_at: string;
  bonus_released: boolean;
}

interface P2Referral {
  _id: string;
  referred_username: string;
  referred_email: string;
  revenue_generated: number;
  commission_earned: number;
  status: string;
  months_remaining: number;
  qualified: boolean;
  created_at: string;
}

const statusBadge = (status: string) => {
  const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    approved: { variant: "default", label: "Approved" },
    pending_review: { variant: "secondary", label: "Pending" },
    pending_fraud_check: { variant: "secondary", label: "Processing" },
    rejected: { variant: "destructive", label: "Rejected" },
    tracking: { variant: "outline", label: "Tracking" },
    qualified: { variant: "default", label: "Qualified" },
    active: { variant: "default", label: "Active" },
    expired: { variant: "secondary", label: "Expired" },
  };
  const cfg = map[status] || { variant: "outline" as const, label: status };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
};

export default function Referrals() {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState("");
  const [p1Stats, setP1Stats] = useState({ total_joins: 0, approved: 0, total_bonus_earned: 0 });
  const [p1List, setP1List] = useState<P1Referral[]>([]);
  const [p2Stats, setP2Stats] = useState({ total_referred: 0, active: 0, total_commission_earned: 0 });
  const [p2List, setP2List] = useState<P2Referral[]>([]);
  const [loading, setLoading] = useState(true);

  const FRONTEND_URL = window.location.origin;
  const p1Link = `${FRONTEND_URL}/publisher/register?ref=${referralCode}&p=1`;
  const p2Link = `${FRONTEND_URL}/advertiser/register?ref=${referralCode}&p=2`;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [linkRes, p1StatsRes, p1ListRes, p2StatsRes, p2ListRes] = await Promise.all([
        getMyReferralLink(), getP1Stats(), getP1Referrals(), getP2Stats(), getP2Referrals(),
      ]);
      if (linkRes.success) setReferralCode(linkRes.referral_link?.referral_code || "");
      if (p1StatsRes.success) setP1Stats(p1StatsRes.stats);
      if (p1ListRes.success) setP1List(p1ListRes.referrals);
      if (p2StatsRes.success) setP2Stats(p2StatsRes.stats);
      if (p2ListRes.success) setP2List(p2ListRes.referrals);
    } catch (e) {
      console.error("Error loading referral data:", e);
    } finally {
      setLoading(false);
    }
  };

  const copyP1Link = () => {
    navigator.clipboard.writeText(p1Link);
    toast.success("P1 referral link copied");
  };

  const copyP2Link = () => {
    navigator.clipboard.writeText(p2Link);
    toast.success("P2 referral link copied");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Referral Program</h1>
        <p className="text-muted-foreground mt-1">Two ways to earn — invite anyone or refer affiliates</p>
      </div>

      {/* ─── Two-Column Program Cards ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Program 1 Card */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-orange-500 font-semibold uppercase tracking-wider">Way 1 — Balance Booster</p>
                <CardTitle className="text-xl mt-1">Grow Your Own Balance</CardTitle>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Every person who joins through your link adds to your account balance — compounding every time.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Rules */}
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">1st person joins</span>
                <span className="font-semibold text-orange-600">+10% of your balance</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Every next person</span>
                <span className="font-semibold text-orange-600">+2% of your balance</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Compounds with each join</span>
                <span className="font-semibold text-foreground flex items-center gap-1">Forever <Infinity className="h-3.5 w-3.5" /></span>
              </div>
            </div>

            {/* Referral Link */}
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Your Referral Link (Publisher Signup)</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-lg px-3 py-2 text-xs font-mono truncate">{p1Link}</div>
                <Button onClick={copyP1Link} size="sm" className="bg-orange-500 hover:bg-orange-600 text-white shrink-0">
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                </Button>
              </div>
            </div>

            {/* Bullet points */}
            <div className="text-xs text-muted-foreground space-y-1">
              <p>✓ Open to everyone</p>
              <p>✓ No minimum earnings needed</p>
              <p>✓ Bonus added after activity verified</p>
            </div>
          </CardContent>
        </Card>

        {/* Program 2 Card */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-600 font-semibold uppercase tracking-wider">Way 2 — Commission Share</p>
                <CardTitle className="text-xl mt-1">Earn from Their Revenue</CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px] border-green-300 text-green-700">Affiliates Only</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Refer an affiliate who earns — you take 4% of everything they generate for up to 6 months.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* CPA Rules */}
            <div className="border rounded-lg p-3 space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CPA (MVAS)</p>
              <div className="text-sm space-y-0.5">
                <p className="text-muted-foreground">· Referred affiliate earns <span className="text-foreground font-medium">&gt;$500</span></p>
                <p className="text-muted-foreground">· You earn <span className="text-green-600 font-semibold">4% commission</span></p>
                <p className="text-muted-foreground">· Valid for <span className="text-foreground font-medium">6 months</span> · Monthly settlement</p>
              </div>
            </div>

            {/* CPL Rules */}
            <div className="border rounded-lg p-3 space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CPL — Media Buyer / Team</p>
              <div className="text-sm space-y-0.5">
                <p className="text-muted-foreground">· Referred affiliate earns <span className="text-foreground font-medium">&gt;$1,000</span></p>
                <p className="text-muted-foreground">· 2 months positive traffic quality</p>
                <p className="text-muted-foreground">· You earn <span className="text-green-600 font-semibold">4% commission</span> for <span className="text-foreground font-medium">6 months</span></p>
              </div>
            </div>

            {/* Referral Link */}
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Your Referral Link (Advertiser Signup)</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-lg px-3 py-2 text-xs font-mono truncate">{p2Link}</div>
                <Button onClick={copyP2Link} size="sm" className="bg-green-600 hover:bg-green-700 text-white shrink-0">
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                </Button>
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>✓ For affiliates & media buyers</p>
              <p>✓ Passive income on their revenue</p>
              <p>✓ Monthly automatic settlement</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── P1 Referral Table ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-orange-500" />
            Balance Booster — Your Referrals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold">{p1Stats.total_joins}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Total Joins</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold">{p1Stats.approved}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Approved</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-green-600">${p1Stats.total_bonus_earned.toFixed(2)}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Bonus Earned</div>
            </div>
          </div>

          {p1List.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground text-xs">
                    <th className="pb-2 font-medium">User</th>
                    <th className="pb-2 font-medium">Joined</th>
                    <th className="pb-2 font-medium">Position</th>
                    <th className="pb-2 font-medium">Bonus %</th>
                    <th className="pb-2 font-medium">Bonus $</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {p1List.map((r, i) => (
                    <tr key={r._id} className="border-b last:border-0">
                      <td className="py-2.5">
                        <div className="font-medium">{r.referred_username}</div>
                        <div className="text-[11px] text-muted-foreground">{r.referred_email}</div>
                      </td>
                      <td className="py-2.5 text-muted-foreground text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
                      <td className="py-2.5 text-xs">
                        <span className="font-medium">{r.bonus_percent === 10 ? '1st' : `#${i + 1}`}</span>
                      </td>
                      <td className="py-2.5 text-orange-600 font-medium">{r.bonus_percent}%</td>
                      <td className="py-2.5 font-medium">${r.bonus_amount.toFixed(2)}</td>
                      <td className="py-2.5">{statusBadge(r.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              No referrals yet. Share your link to get started.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ─── P2 Referral Table ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-500" />
            Commission Share — Your Affiliates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold">{p2Stats.total_referred}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Total Referred</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold">{p2Stats.active}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Active</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-green-600">${p2Stats.total_commission_earned.toFixed(2)}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Commission Earned</div>
            </div>
          </div>

          {p2List.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground text-xs">
                    <th className="pb-2 font-medium">Affiliate</th>
                    <th className="pb-2 font-medium">Revenue</th>
                    <th className="pb-2 font-medium">Commission (4%)</th>
                    <th className="pb-2 font-medium">Months Left</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {p2List.map((r) => (
                    <tr key={r._id} className="border-b last:border-0">
                      <td className="py-2.5">
                        <div className="font-medium">{r.referred_username}</div>
                        <div className="text-[11px] text-muted-foreground">{r.referred_email}</div>
                      </td>
                      <td className="py-2.5 font-medium">${r.revenue_generated.toFixed(2)}</td>
                      <td className="py-2.5 text-green-600 font-medium">${r.commission_earned.toFixed(2)}</td>
                      <td className="py-2.5">
                        {r.status === 'active' ? (
                          <span className="flex items-center gap-1 text-sm">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" /> {r.months_remaining}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-2.5">{statusBadge(r.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              No affiliate referrals yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ─── Summary Strip ─── */}
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">Your Referral Summary</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4 text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Program 1 Joins</div>
            <div className="text-2xl font-bold mt-1">{p1Stats.total_joins}</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Balance Earned (P1)</div>
            <div className="text-2xl font-bold text-orange-600 mt-1">${p1Stats.total_bonus_earned.toFixed(2)}</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Program 2 Referrals</div>
            <div className="text-2xl font-bold mt-1">{p2Stats.total_referred}</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Commission Earned (P2)</div>
            <div className="text-2xl font-bold text-green-600 mt-1">${p2Stats.total_commission_earned.toFixed(2)}</div>
          </Card>
        </div>
      </div>
    </div>
  );
}
