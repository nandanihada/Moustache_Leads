import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, DollarSign, Settings, RefreshCw, ChevronDown, ChevronRight, CreditCard, Clock, CheckCircle, History, Eye, Banknote, FileText, Undo2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAuthToken } from "@/utils/cookies";
import { getApiBaseUrl } from "@/services/apiConfig";
import { adminReportsApi } from "@/services/adminReportsApi";
import { toast } from "sonner";
import { AdminPageGuard } from "@/components/AdminPageGuard";

const API_BASE = getApiBaseUrl();
function authHeaders() { return { Authorization: `Bearer ${getAuthToken()}`, "Content-Type": "application/json" }; }

interface UserPayment {
  user_id: string; username: string; email: string; country: string;
  total_balance: number;
  breakdown: { referral: number; conversion: number; promo: number; gift: number; manual_adjustments: number };
  payout_method: any;
  net_terms_settings: { net_terms: number; temporary_duration_months?: number; temporary_start_date?: string; default_net_terms: number };
}

function AdminPaymentsContent() {
  const [users, setUsers] = useState<UserPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"balance" | "name">("balance");
  const [threshold, setThreshold] = useState(50);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"users" | "history">("users");
  const [actionLogs, setActionLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Expanded user state
  const [userConversions, setUserConversions] = useState<any[]>([]);
  const [convSummary, setConvSummary] = useState<any>(null);
  const [convLoading, setConvLoading] = useState(false);
  const [convFilter, setConvFilter] = useState("all");
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedTab, setExpandedTab] = useState("conversions");

  // Dialogs
  const [showThresholdDialog, setShowThresholdDialog] = useState(false);
  const [newThreshold, setNewThreshold] = useState("50");
  const [showNetTermsDialog, setShowNetTermsDialog] = useState(false);
  const [netTermsUserId, setNetTermsUserId] = useState("");
  const [netTermsValue, setNetTermsValue] = useState("30");
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [payUser, setPayUser] = useState<UserPayment | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payRef, setPayRef] = useState("");
  const [paying, setPaying] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/payments/users`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success) setUsers(data.data || []);
    } catch { toast.error("Failed to load users"); }
    finally { setLoading(false); }
  }, []);

  const fetchThreshold = useCallback(async () => {
    try {
      const res = await adminReportsApi.getInvoiceThreshold();
      if (res.success) { setThreshold(res.threshold || 50); setNewThreshold(String(res.threshold || 50)); }
    } catch {}
  }, []);

  const fetchActionLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/payments/action-logs`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success) setActionLogs(data.logs || []);
    } catch {}
    finally { setLogsLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); fetchThreshold(); }, [fetchUsers, fetchThreshold]);

  // Fetch user data when expanded
  const handleExpand = async (userId: string) => {
    if (expandedUser === userId) { setExpandedUser(null); return; }
    setExpandedUser(userId);
    setExpandedTab("conversions");
    fetchUserConversions(userId, "all");
    fetchPaymentHistory(userId);
  };

  const fetchUserConversions = async (userId: string, status: string) => {
    setConvLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/payments/users/${userId}/conversions?status=${status}&per_page=30`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success) { setUserConversions(data.conversions || []); setConvSummary(data.summary || null); }
    } catch {}
    finally { setConvLoading(false); }
  };

  const fetchPaymentHistory = async (userId: string) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/payments/users/${userId}/payment-history`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success) setPaymentHistory(data.payments || []);
    } catch {}
    finally { setHistoryLoading(false); }
  };

  const handleUpdateThreshold = async () => {
    const val = parseFloat(newThreshold);
    if (isNaN(val) || val < 0) { toast.error("Invalid threshold"); return; }
    try {
      await adminReportsApi.setInvoiceThreshold(val);
      setThreshold(val); setShowThresholdDialog(false);
      toast.success(`Threshold updated to $${val}`);
    } catch { toast.error("Failed to update threshold"); }
  };

  const handleUpdateNetTerms = async () => {
    try {
      await fetch(`${API_BASE}/api/admin/payments/users/${netTermsUserId}/net-terms`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ net_terms: parseInt(netTermsValue), default_net_terms: parseInt(netTermsValue) })
      });
      setShowNetTermsDialog(false); toast.success("Net terms updated"); fetchUsers();
    } catch { toast.error("Failed to update net terms"); }
  };

  const handlePayUser = async () => {
    if (!payUser || !payAmount || parseFloat(payAmount) <= 0) { toast.error("Enter valid amount"); return; }
    setPaying(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/payments/users/${payUser.user_id}/pay`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ amount: parseFloat(payAmount), reference_note: payRef, payment_method: payUser.payout_method?.active_method || "manual", username: payUser.username })
      });
      const data = await res.json();
      if (data.success) { toast.success(data.message); setShowPayDialog(false); fetchUsers(); if (expandedUser === payUser.user_id) fetchPaymentHistory(payUser.user_id); }
      else toast.error(data.error || "Failed");
    } catch { toast.error("Payment failed"); }
    finally { setPaying(false); }
  };

  const getUserStatus = (user: UserPayment): "held" | "eligible" | "none" => {
    if (user.total_balance <= 0) return "none";
    if (user.total_balance < threshold) return "held";
    return "eligible";
  };

  const filteredUsers = useMemo(() => {
    let result = users.filter(u => {
      if (searchTerm) { const s = searchTerm.toLowerCase(); if (!u.username?.toLowerCase().includes(s) && !u.email?.toLowerCase().includes(s)) return false; }
      if (statusFilter !== "all") { const status = getUserStatus(u); if (statusFilter === "held" && status !== "held") return false; if (statusFilter === "eligible" && status !== "eligible") return false; }
      return true;
    });
    if (sortBy === "balance") result.sort((a, b) => b.total_balance - a.total_balance);
    else result.sort((a, b) => (a.username || "").localeCompare(b.username || ""));
    return result;
  }, [users, searchTerm, statusFilter, sortBy, threshold]);

  const getPayoutMethodLabel = (pm: any) => {
    if (!pm || !pm.active_method) return "Not Set";
    if (pm.active_method === "bank") return "Bank Transfer";
    if (pm.active_method === "paypal") return "PayPal";
    if (pm.active_method === "crypto") return "Crypto";
    return pm.active_method;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold tracking-tight">Payments</h1><p className="text-muted-foreground">Manage publisher payments, invoices, and net terms</p></div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setActiveTab(activeTab === "users" ? "history" : "users"); if (activeTab === "users") fetchActionLogs(); }}>
            <History className="h-4 w-4 mr-1" />{activeTab === "users" ? "Action History" : "Back to Users"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => fetchUsers()}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
        </div>
      </div>

      {/* Settings Bar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-muted-foreground" /><span className="text-sm font-medium">Global Threshold:</span><Button variant="outline" size="sm" onClick={() => setShowThresholdDialog(true)}>${threshold}</Button></div>
          <div className="ml-auto text-sm text-muted-foreground">{users.filter(u => getUserStatus(u) === "eligible").length} eligible &bull; {users.filter(u => getUserStatus(u) === "held").length} held</div>
        </div>
      </Card>

      {activeTab === "users" ? (
        <>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search username or email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" /></div>
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Users</SelectItem><SelectItem value="eligible">Eligible</SelectItem><SelectItem value="held">Held</SelectItem></SelectContent></Select>
            <Select value={sortBy} onValueChange={v => setSortBy(v as any)}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="balance">Sort by Balance</SelectItem><SelectItem value="name">Sort by Name</SelectItem></SelectContent></Select>
          </div>

          {loading ? <div className="text-center py-12 text-muted-foreground">Loading...</div> : filteredUsers.length === 0 ? <div className="text-center py-12 text-muted-foreground">No users found</div> : (
            <div className="space-y-2">
              {filteredUsers.map(user => {
                const status = getUserStatus(user);
                const progressPct = Math.min(100, (user.total_balance / threshold) * 100);
                const isExpanded = expandedUser === user.user_id;

                return (
                  <Card key={user.user_id} className={`overflow-hidden ${isExpanded ? "ring-2 ring-primary/20" : ""}`}>
                    <div className="p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/30" onClick={() => handleExpand(user.user_id)}>
                      <div className="text-muted-foreground">{isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2"><span className="font-medium truncate">{user.username || "N/A"}</span><span className="text-xs text-muted-foreground truncate">{user.email}</span></div>
                        <div className="flex items-center gap-3 mt-1"><div className="w-32"><Progress value={progressPct} className="h-2" /></div><span className="text-xs text-muted-foreground">${user.total_balance.toFixed(2)} / ${threshold}</span></div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right"><div className="text-lg font-bold">${user.total_balance.toFixed(2)}</div><div className="text-xs text-muted-foreground">Net {user.net_terms_settings?.net_terms || 30}</div></div>
                        {status === "eligible" ? <Badge className="bg-green-100 text-green-800">Eligible</Badge> : status === "held" ? <Badge className="bg-yellow-100 text-yellow-800">Held</Badge> : <Badge variant="secondary">$0</Badge>}
                        {status === "eligible" && <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={e => { e.stopPropagation(); setPayUser(user); setPayAmount(user.total_balance.toFixed(2)); setPayRef(""); setShowPayDialog(true); }}><Banknote className="h-4 w-4 mr-1" />Pay</Button>}
                        <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setNetTermsUserId(user.user_id); setNetTermsValue(String(user.net_terms_settings?.net_terms || 30)); setShowNetTermsDialog(true); }}><Settings className="h-4 w-4" /></Button>
                      </div>
                    </div>

                    {/* Expanded View */}
                    {isExpanded && (
                      <div className="border-t bg-muted/10 p-4">
                        <Tabs value={expandedTab} onValueChange={setExpandedTab}>
                          <TabsList className="mb-3">
                            <TabsTrigger value="conversions"><FileText className="h-3.5 w-3.5 mr-1" />Conversions</TabsTrigger>
                            <TabsTrigger value="bank"><CreditCard className="h-3.5 w-3.5 mr-1" />Bank Details</TabsTrigger>
                            <TabsTrigger value="payments"><History className="h-3.5 w-3.5 mr-1" />Payment History</TabsTrigger>
                          </TabsList>

                          {/* Conversions Tab */}
                          <TabsContent value="conversions">
                            {/* Balance source breakdown */}
                            <div className="mb-3 p-3 bg-blue-50/50 border border-blue-100 rounded-md">
                              <h5 className="text-xs font-semibold mb-2 text-blue-800">Balance Breakdown (Where ${ user.total_balance.toFixed(2)} comes from)</h5>
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                                <div className="bg-white p-2 rounded border">
                                  <div className="text-muted-foreground">Conversions</div>
                                  <div className={`font-bold ${user.breakdown.conversion > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>${user.breakdown.conversion.toFixed(2)}</div>
                                </div>
                                <div className="bg-white p-2 rounded border">
                                  <div className="text-muted-foreground">Referrals</div>
                                  <div className={`font-bold ${user.breakdown.referral > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>${user.breakdown.referral.toFixed(2)}</div>
                                </div>
                                <div className="bg-white p-2 rounded border">
                                  <div className="text-muted-foreground">Promo Bonuses</div>
                                  <div className={`font-bold ${user.breakdown.promo > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>${user.breakdown.promo.toFixed(2)}</div>
                                </div>
                                <div className="bg-white p-2 rounded border">
                                  <div className="text-muted-foreground">Gift Cards</div>
                                  <div className={`font-bold ${user.breakdown.gift > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>${user.breakdown.gift.toFixed(2)}</div>
                                </div>
                                <div className="bg-white p-2 rounded border">
                                  <div className="text-muted-foreground">Adjustments</div>
                                  <div className={`font-bold ${user.breakdown.manual_adjustments !== 0 ? (user.breakdown.manual_adjustments > 0 ? 'text-green-600' : 'text-red-600') : 'text-muted-foreground'}`}>${user.breakdown.manual_adjustments.toFixed(2)}</div>
                                </div>
                              </div>
                            </div>

                            {convSummary && (
                              <div className="flex gap-4 mb-3 text-sm">
                                <span className="text-green-600 font-medium">Active: ${convSummary.active_amount?.toFixed(2)} ({convSummary.active_count})</span>
                                <span className="text-red-600 font-medium">Reversed: ${convSummary.reversed_amount?.toFixed(2)} ({convSummary.reversed_count})</span>
                              </div>
                            )}
                            <div className="flex gap-2 mb-3">
                              {["all", "active", "reversed"].map(f => (
                                <Button key={f} variant={convFilter === f ? "default" : "outline"} size="sm" onClick={() => { setConvFilter(f); fetchUserConversions(user.user_id, f); }}>{f === "all" ? "All" : f === "active" ? "Active" : "Reversed"}</Button>
                              ))}
                            </div>
                            {convLoading ? <div className="text-center py-4 text-sm text-muted-foreground">Loading...</div> : userConversions.length === 0 ? <div className="text-center py-4 text-sm text-muted-foreground">No conversions</div> : (
                              <div className="max-h-64 overflow-y-auto">
                                <Table>
                                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Offer</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader>
                                  <TableBody>
                                    {userConversions.map(c => (
                                      <TableRow key={c._id} className={c.status === "reversed" ? "bg-red-50/50" : ""}>
                                        <TableCell className="text-xs">{c.timestamp ? new Date(c.timestamp).toLocaleDateString() : "-"}</TableCell>
                                        <TableCell className="text-sm truncate max-w-[150px]">{c.offer_name || c.offer_id}</TableCell>
                                        <TableCell className="font-medium">${c.points?.toFixed(2)}</TableCell>
                                        <TableCell>{c.status === "reversed" ? <Badge className="bg-red-100 text-red-800">Reversed</Badge> : <Badge className="bg-green-100 text-green-800">Active</Badge>}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]">{c.reversal_reason || "-"}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </TabsContent>

                          {/* Bank Details Tab */}
                          <TabsContent value="bank">
                            {!user.payout_method || !user.payout_method.active_method ? (
                              <div className="text-center py-6 text-muted-foreground"><CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" /><p>No payout method set by this user</p></div>
                            ) : (
                              <div className="space-y-3">
                                <div className="flex items-center gap-2"><Badge>{getPayoutMethodLabel(user.payout_method)}</Badge></div>
                                {user.payout_method.active_method === "bank" && user.payout_method.bank_details && (
                                  <div className="grid grid-cols-2 gap-2 text-sm bg-muted/30 p-3 rounded">
                                    <div><span className="text-muted-foreground">Account Name:</span><p className="font-medium">{user.payout_method.bank_details.account_name || "-"}</p></div>
                                    <div><span className="text-muted-foreground">Account Number:</span><p className="font-medium">{user.payout_method.bank_details.account_number || "-"}</p></div>
                                    <div><span className="text-muted-foreground">Bank Name:</span><p className="font-medium">{user.payout_method.bank_details.bank_name || "-"}</p></div>
                                    <div><span className="text-muted-foreground">SWIFT/IFSC:</span><p className="font-medium">{user.payout_method.bank_details.swift_code || user.payout_method.bank_details.ifsc || "-"}</p></div>
                                    <div><span className="text-muted-foreground">Country:</span><p className="font-medium">{user.payout_method.bank_details.country || "-"}</p></div>
                                  </div>
                                )}
                                {user.payout_method.active_method === "paypal" && user.payout_method.paypal_details && (
                                  <div className="text-sm bg-muted/30 p-3 rounded"><span className="text-muted-foreground">PayPal Email:</span><p className="font-medium">{user.payout_method.paypal_details.email || "-"}</p></div>
                                )}
                                {user.payout_method.active_method === "crypto" && user.payout_method.crypto_details && (
                                  <div className="grid grid-cols-2 gap-2 text-sm bg-muted/30 p-3 rounded">
                                    <div><span className="text-muted-foreground">Network:</span><p className="font-medium">{user.payout_method.crypto_details.network || "-"}</p></div>
                                    <div><span className="text-muted-foreground">Wallet Address:</span><p className="font-medium break-all">{user.payout_method.crypto_details.wallet_address || "-"}</p></div>
                                  </div>
                                )}
                              </div>
                            )}
                          </TabsContent>

                          {/* Payment History Tab */}
                          <TabsContent value="payments">
                            {historyLoading ? <div className="text-center py-4 text-sm text-muted-foreground">Loading...</div> : paymentHistory.length === 0 ? (
                              <div className="text-center py-6 text-muted-foreground"><Banknote className="h-8 w-8 mx-auto mb-2 opacity-50" /><p>No payments made to this user yet</p></div>
                            ) : (
                              <div>
                                <div className="mb-3 text-sm font-medium">Total Paid: <span className="text-green-600">${paymentHistory.reduce((s, p) => s + p.amount, 0).toFixed(2)}</span> ({paymentHistory.length} payments)</div>
                                <Table>
                                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Method</TableHead><TableHead>Reference</TableHead><TableHead>Admin</TableHead></TableRow></TableHeader>
                                  <TableBody>
                                    {paymentHistory.map(p => (
                                      <TableRow key={p._id}>
                                        <TableCell className="text-xs">{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "-"}</TableCell>
                                        <TableCell className="font-medium text-green-600">${p.amount?.toFixed(2)}</TableCell>
                                        <TableCell><Badge variant="outline">{p.payment_method}</Badge></TableCell>
                                        <TableCell className="text-xs">{p.reference_note || "-"}</TableCell>
                                        <TableCell className="text-xs">{p.admin_username}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </TabsContent>
                        </Tabs>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <Card>
          <div className="p-4 border-b"><h3 className="font-semibold flex items-center gap-2"><History className="h-4 w-4" />Admin Action History</h3></div>
          <div className="overflow-x-auto">
            {logsLoading ? <div className="text-center py-8 text-muted-foreground">Loading...</div> : actionLogs.length === 0 ? <div className="text-center py-8 text-muted-foreground">No history</div> : (
              <Table><TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Admin</TableHead><TableHead>Action</TableHead><TableHead>User</TableHead><TableHead>Details</TableHead><TableHead>Amount</TableHead></TableRow></TableHeader>
                <TableBody>{actionLogs.map(log => (<TableRow key={log._id}><TableCell className="text-xs">{new Date(log.created_at).toLocaleString()}</TableCell><TableCell>{log.admin_username}</TableCell><TableCell><Badge variant="outline">{log.action?.replace(/_/g, " ")}</Badge></TableCell><TableCell>{log.target_username || "-"}</TableCell><TableCell className="text-xs max-w-[200px] truncate">{log.details}</TableCell><TableCell>{log.amount ? `$${log.amount.toFixed(2)}` : "-"}</TableCell></TableRow>))}</TableBody>
              </Table>
            )}
          </div>
        </Card>
      )}

      {/* Pay Dialog */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pay {payUser?.username}</DialogTitle><DialogDescription>Record a payment to this publisher. This will mark their eligible invoices as paid and deduct from their balance.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div><label className="text-sm font-medium">Amount ($)</label><Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} min="0" step="0.01" className="mt-1" /></div>
            <div><label className="text-sm font-medium">Payout Method</label><p className="text-sm mt-1 font-medium">{payUser ? getPayoutMethodLabel(payUser.payout_method) : "N/A"}</p>
              {payUser?.payout_method?.active_method === "paypal" && <p className="text-xs text-muted-foreground">{payUser.payout_method.paypal_details?.email}</p>}
              {payUser?.payout_method?.active_method === "bank" && <p className="text-xs text-muted-foreground">{payUser.payout_method.bank_details?.account_name} - {payUser.payout_method.bank_details?.bank_name}</p>}
              {payUser?.payout_method?.active_method === "crypto" && <p className="text-xs text-muted-foreground">{payUser.payout_method.crypto_details?.network}: {payUser.payout_method.crypto_details?.wallet_address?.slice(0, 20)}...</p>}
            </div>
            <div><label className="text-sm font-medium">Reference Note (optional)</label><Input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="Transaction ID, notes..." className="mt-1" /></div>
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowPayDialog(false)}>Cancel</Button><Button className="bg-green-600 hover:bg-green-700" onClick={handlePayUser} disabled={paying}>{paying ? "Processing..." : `Pay $${payAmount}`}</Button></div>
        </DialogContent>
      </Dialog>

      {/* Threshold Dialog */}
      <Dialog open={showThresholdDialog} onOpenChange={setShowThresholdDialog}>
        <DialogContent><DialogHeader><DialogTitle>Payment Threshold</DialogTitle></DialogHeader><div className="py-4"><Input type="number" value={newThreshold} onChange={e => setNewThreshold(e.target.value)} min="0" /></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowThresholdDialog(false)}>Cancel</Button><Button onClick={handleUpdateThreshold}>Save</Button></div></DialogContent>
      </Dialog>

      {/* Net Terms Dialog */}
      <Dialog open={showNetTermsDialog} onOpenChange={setShowNetTermsDialog}>
        <DialogContent><DialogHeader><DialogTitle>Update Net Terms</DialogTitle></DialogHeader><div className="py-4"><Select value={netTermsValue} onValueChange={setNetTermsValue}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">Net 7</SelectItem><SelectItem value="15">Net 15</SelectItem><SelectItem value="30">Net 30</SelectItem></SelectContent></Select></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowNetTermsDialog(false)}>Cancel</Button><Button onClick={handleUpdateNetTerms}>Save</Button></div></DialogContent>
      </Dialog>
    </div>
  );
}

const AdminPayments = () => (<AdminPageGuard requiredTab="payments"><AdminPaymentsContent /></AdminPageGuard>);
export default AdminPayments;
