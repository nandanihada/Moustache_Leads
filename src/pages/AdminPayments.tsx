import { useState, useEffect } from "react";
import { Search, Download, CreditCard, DollarSign, Filter, RefreshCcw, Activity, History, Undo, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAuthToken } from "@/utils/cookies";
import { getApiBaseUrl } from "@/services/apiConfig";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

const AdminPayments = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userTransactions, setUserTransactions] = useState<any[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [emailDialogUser, setEmailDialogUser] = useState<any>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [minBalanceFilter, setMinBalanceFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  
  const [netTermsDialogUser, setNetTermsDialogUser] = useState<any>(null);
  const [netTermsData, setNetTermsData] = useState({
    net_terms: 30,
    default_net_terms: 30,
    temporary_duration_months: "" as string | number
  });
  const [isUpdatingNetTerms, setIsUpdatingNetTerms] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/admin/payments/users`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.data || []);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load user payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const formatCurrency = (amount: number) => {
    return `$${(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleAdjustBalance = async (userId: string, amount: number, isAdd: boolean) => {
    const reason = prompt("Enter reason for adjustment:");
    if (!reason) return;

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/admin/payments/users/${userId}/adjust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          amount: isAdd ? Math.abs(amount) : -Math.abs(amount),
          reason
        })
      });

      if (response.ok) {
        toast.success("Balance adjusted successfully");
        fetchUsers();
      } else {
        toast.error("Failed to adjust balance");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error adjusting balance");
    }
  };

  const handleViewTransactions = async (userId: string) => {
    setSelectedUser(userId);
    setTxLoading(true);
    try {
      // We can use the same route or a dedicated admin one. Since we don't have a dedicated admin transaction route, 
      // let's fetch it if there's an API, or we rely on the summary. Wait, we don't have an admin route to get a specific user's transactions.
      // We will need to build the API call for that.
      const response = await fetch(`${getApiBaseUrl()}/api/admin/payments/users/${userId}/transactions`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUserTransactions(data.data || []);
      }
    } catch (err) {
      toast.error("Failed to load user transactions");
    } finally {
      setTxLoading(false);
    }
  };

  const handleReverseTransaction = async (txType: string, txId: string) => {
    if (!confirm(`Are you sure you want to reverse this ${txType} transaction?`)) return;
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/admin/payments/transactions/${txType}/${txId}/reverse`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
      if (response.ok) {
        toast.success("Transaction reversed successfully");
        if (selectedUser) handleViewTransactions(selectedUser);
        fetchUsers();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to reverse transaction");
      }
    } catch (err) {
      toast.error("Error reversing transaction");
    }
  };

  const handleSendEmail = async () => {
    if (!emailDialogUser || !emailSubject || !emailMessage) {
      toast.error("Subject and message are required");
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/admin/payments/email/${emailDialogUser.user_id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          subject: emailSubject,
          message: emailMessage
        })
      });

      if (response.ok) {
        toast.success("Email sent successfully");
        setEmailDialogUser(null);
        setEmailSubject("");
        setEmailMessage("");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to send email");
      }
    } catch (err) {
      toast.error("Error sending email");
    } finally {
      setIsSending(false);
    }
  };

  const handleUpdateNetTerms = async () => {
    if (!netTermsDialogUser) return;
    setIsUpdatingNetTerms(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/admin/payments/users/${netTermsDialogUser.user_id}/net-terms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          net_terms: Number(netTermsData.net_terms),
          default_net_terms: Number(netTermsData.default_net_terms),
          temporary_duration_months: netTermsData.temporary_duration_months ? Number(netTermsData.temporary_duration_months) : null
        })
      });

      if (response.ok) {
        toast.success("Net terms updated successfully");
        setNetTermsDialogUser(null);
        fetchUsers();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to update net terms");
      }
    } catch (err) {
      toast.error("Error updating net terms");
    } finally {
      setIsUpdatingNetTerms(false);
    }
  };

  const filteredUsers = users.filter((u: any) => {
    // Basic search text
    const matchesSearch =
      u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.country?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // Advanced filters
    const balance = u.total_balance || 0;

    if (statusFilter === 'ready' && balance < 100) return false;
    if (statusFilter === 'accumulating' && balance >= 100) return false;

    if (minBalanceFilter && balance < parseFloat(minBalanceFilter)) return false;

    if (countryFilter && u.country?.toLowerCase() !== countryFilter.toLowerCase()) return false;

    return true;
  });

  const totalPlatformEarnings = users.reduce((acc, curr) => acc + (curr.total_balance || 0), 0);
  const readyToPay = users.filter(u => (u.total_balance || 0) >= 100).reduce((acc, curr) => acc + curr.total_balance, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Admin – Affiliate Dashboard</h1>
          <p className="text-muted-foreground mt-1">Monitor, manage and control all affiliate activity</p>
        </div>
        <Button variant="outline" onClick={fetchUsers}>
          <RefreshCcw className="h-4 w-4 mr-2" />
          Refresh Data
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="border-border/60 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
            <CreditCard className="h-24 w-24" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Affiliates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Active platform users</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm relative overflow-hidden group col-span-2">
          <div className="absolute right-0 top-0 p-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
            <DollarSign className="h-24 w-24 text-green-500" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Earnings Pool</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-between items-end">
            <div>
              <div className="text-3xl font-bold text-foreground">{formatCurrency(totalPlatformEarnings)}</div>
              <p className="text-xs text-muted-foreground mt-1">Combined affiliate balances</p>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-amber-600 mb-1">Ready for Payout</div>
              <div className="text-lg font-bold text-amber-700">{formatCurrency(readyToPay)}</div>
              <p className="text-xs text-amber-600/70">{users.filter(u => u.total_balance >= 100).length} users eligible</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 shadow-sm overflow-hidden">
        <div className="p-4 bg-muted/20 border-b border-border flex items-center justify-between gap-4">
          <div className="flex gap-2 flex-wrap items-center flex-1">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search user, email or country..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant={showAdvancedFilters ? "default" : "secondary"} size="sm" onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}>
              <Filter className="h-4 w-4 mr-2" />
              Advanced Filters
            </Button>
          </div>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>

        {showAdvancedFilters && (
          <div className="p-4 bg-muted/10 border-b border-border grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="ready">Ready for Payout (≥$100)</option>
                <option value="accumulating">Accumulating</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Min Balance ($)</label>
              <Input
                type="number"
                placeholder="0.00"
                value={minBalanceFilter}
                onChange={(e) => setMinBalanceFilter(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Country (Exact)</label>
              <Input
                placeholder="e.g. US"
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button variant="ghost" onClick={() => { setStatusFilter("all"); setMinBalanceFilter(""); setCountryFilter(""); }} className="text-muted-foreground hover:text-foreground">
                Clear Filters
              </Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Affiliate</TableHead>
                <TableHead>Country</TableHead>
                <TableHead className="text-right">Referral</TableHead>
                <TableHead className="text-right">Conv%</TableHead>
                <TableHead className="text-right">Gift</TableHead>
                <TableHead className="text-right">Promo</TableHead>
                <TableHead className="text-right font-bold text-black border-l border-r border-border/50">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center p-12 text-muted-foreground">
                    No affiliates found matching your search.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user: any) => (
                  <TableRow key={user.user_id} className="hover:bg-muted/10 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-xs">
                          {user.username?.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-sm text-blue-600 hover:underline cursor-pointer">{user.username}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-background text-[10px]">
                        {user.country || "Unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">{formatCurrency(user.breakdown?.referral)}</TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">{formatCurrency(user.breakdown?.conversion)}</TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">{formatCurrency(user.breakdown?.gift)}</TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">{formatCurrency(user.breakdown?.promo)}</TableCell>
                    <TableCell className="text-right font-bold text-foreground border-l border-r border-border/50 bg-muted/5">
                      {formatCurrency(user.total_balance)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                      {user.total_balance >= 100 ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 shadow-sm flex items-center gap-1 w-fit text-[10px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                          Ready
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted text-muted-foreground shadow-sm text-[10px]">
                          Accumulating
                        </Badge>
                      )}
                        <Badge variant="secondary" className="text-[10px]">Net {user.net_terms_settings?.net_terms || 30}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleViewTransactions(user.user_id)} className="h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50" title="View Transactions">
                          <History className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => {
                          setNetTermsDialogUser(user);
                          setNetTermsData({
                            net_terms: user.net_terms_settings?.net_terms || 30,
                            default_net_terms: user.net_terms_settings?.default_net_terms || 30,
                            temporary_duration_months: user.net_terms_settings?.temporary_duration_months || ""
                          });
                        }} className="h-7 px-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50" title="Manage Net Cycle">
                          <RefreshCcw className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEmailDialogUser(user)} className="h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50" title="Email User">
                          <Mail className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleAdjustBalance(user.user_id, 10, true)} className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50">
                          + Add
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleAdjustBalance(user.user_id, 10, false)} className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50">
                          - Sub
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>User Transactions</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-4">
            {txLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading transactions...</div>
            ) : userTransactions.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No transactions found for this user.</div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userTransactions.map((tx: any) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-xs">{tx.date}</TableCell>
                      <TableCell><Badge variant="outline">{tx.type}</Badge></TableCell>
                      <TableCell className="text-xs">{tx.offer_name}</TableCell>
                      <TableCell className={`text-right font-medium ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(tx.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={tx.status === 'Valid' ? 'default' : 'destructive'}>{tx.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {tx.status === 'Valid' && (tx.type === 'Promo' || tx.type === 'Gift Card') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReverseTransaction(tx.type === 'Promo' ? 'promo' : 'gift', tx.id)}
                            className="h-7 text-xs text-red-600 hover:bg-red-50"
                          >
                            <Undo className="h-3 w-3 mr-1" /> Reverse
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!emailDialogUser} onOpenChange={(open) => !open && setEmailDialogUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Email {emailDialogUser?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Subject</label>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Message Subject..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Message</label>
              <textarea
                className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                placeholder="Type your message here..."
              />
            </div>
            <div className="flex justify-end pt-4 gap-2">
              <Button variant="outline" onClick={() => setEmailDialogUser(null)}>Cancel</Button>
              <Button onClick={handleSendEmail} disabled={isSending}>
                {isSending ? "Sending..." : "Send Email"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!netTermsDialogUser} onOpenChange={(open) => !open && setNetTermsDialogUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mange Net Cycle for {netTermsDialogUser?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Active Net Cycle</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={netTermsData.net_terms}
                onChange={(e) => setNetTermsData({ ...netTermsData, net_terms: Number(e.target.value) })}
              >
                <option value={15}>Net 15</option>
                <option value={30}>Net 30</option>
                <option value={60}>Net 60</option>
                <option value={90}>Net 90</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Default Net Cycle (Fallback)</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={netTermsData.default_net_terms}
                onChange={(e) => setNetTermsData({ ...netTermsData, default_net_terms: Number(e.target.value) })}
              >
                <option value={15}>Net 15</option>
                <option value={30}>Net 30</option>
                <option value={60}>Net 60</option>
                <option value={90}>Net 90</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Temporary Duration (Months)</label>
              <Input
                type="number"
                placeholder="Leave blank for permanent"
                value={netTermsData.temporary_duration_months}
                onChange={(e) => setNetTermsData({ ...netTermsData, temporary_duration_months: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                If provided, the user will be on the Active Net Cycle for this many months, then automatically switch to the Default Net Cycle.
              </p>
            </div>
            <div className="flex justify-end pt-4 gap-2">
              <Button variant="outline" onClick={() => setNetTermsDialogUser(null)}>Cancel</Button>
              <Button onClick={handleUpdateNetTerms} disabled={isUpdatingNetTerms}>
                {isUpdatingNetTerms ? "Saving..." : "Save Configuration"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPayments;
