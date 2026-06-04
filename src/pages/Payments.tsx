import { useState, useEffect } from "react";
import { DollarSign, Clock, CheckCircle, CreditCard, Settings, Eye, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAuthToken } from "@/utils/cookies";
import { getApiBaseUrl } from "@/services/apiConfig";
import { useNavigate } from "react-router-dom";
import PlacementRequired from "@/components/PlacementRequired";

const API_BASE = getApiBaseUrl();

interface UserInvoice {
  _id: string;
  period_start: string;
  period_end: string;
  gross_amount: number;
  reversals_amount: number;
  carry_forward: number;
  net_amount: number;
  threshold: number;
  status: string;
  net_terms: number;
  generated_at: string;
  paid_at: string;
}

interface InvoiceSummary {
  current_balance: number;
  lifetime_earnings: number;
  threshold: number;
  progress_pct: number;
  net_terms: number;
  next_payment_date: string;
  total_paid: number;
  total_held: number;
}

const PaymentsContent = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<UserInvoice[]>([]);
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [viewInvoice, setViewInvoice] = useState<UserInvoice | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/payments/invoices`, {
          headers: { Authorization: `Bearer ${getAuthToken()}` }
        });
        const data = await res.json();
        if (data.success) {
          setInvoices(data.invoices || []);
          setSummary(data.summary || null);
        }
      } catch (error) {
        console.error("Error fetching invoices:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    const parts = dateStr.replace('Z', '').split('T')[0].split('-');
    if (parts.length < 3) return "N/A";
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  };

  const formatBillingPeriod = (start: string, end: string) => {
    if (!start || !end) return "-";
    const sParts = start.replace('Z', '').split('T')[0].split('-');
    const eParts = end.replace('Z', '').split('T')[0].split('-');
    if (sParts.length < 3 || eParts.length < 3) return "-";
    const s = new Date(parseInt(sParts[0]), parseInt(sParts[1]) - 1, parseInt(sParts[2]));
    const e = new Date(parseInt(eParts[0]), parseInt(eParts[1]) - 1, parseInt(eParts[2]));
    return `${s.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} - ${e.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <TooltipProvider><Tooltip><TooltipTrigger asChild>
            <Badge className="bg-green-100 text-green-800 border-green-300 cursor-help">Paid <Info className="h-3 w-3 ml-1 inline" /></Badge>
          </TooltipTrigger><TooltipContent><p>Payment has been processed by admin</p></TooltipContent></Tooltip></TooltipProvider>
        );
      case "eligible":
        return (
          <TooltipProvider><Tooltip><TooltipTrigger asChild>
            <Badge className="bg-blue-100 text-blue-800 border-blue-300 cursor-help">Eligible <Info className="h-3 w-3 ml-1 inline" /></Badge>
          </TooltipTrigger><TooltipContent><p>Threshold reached — payment will be processed soon</p></TooltipContent></Tooltip></TooltipProvider>
        );
      case "held":
        return (
          <TooltipProvider><Tooltip><TooltipTrigger asChild>
            <Badge className="bg-gray-100 text-gray-600 border-gray-300 cursor-help">Deferred <Info className="h-3 w-3 ml-1 inline" /></Badge>
          </TooltipTrigger><TooltipContent><p>Below minimum threshold — carries forward to next month</p></TooltipContent></Tooltip></TooltipProvider>
        );
      case "pending":
        return (
          <TooltipProvider><Tooltip><TooltipTrigger asChild>
            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 cursor-help">Pending <Info className="h-3 w-3 ml-1 inline" /></Badge>
          </TooltipTrigger><TooltipContent><p>Current month — still accumulating earnings</p></TooltipContent></Tooltip></TooltipProvider>
        );
      case "rolled_over":
        return <Badge variant="outline">Rolled Over</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getCreationDate = (inv: UserInvoice) => {
    if (inv.generated_at) return formatDate(inv.generated_at);
    if (inv.period_end) {
      const parts = inv.period_end.replace('Z', '').split('T')[0].split('-');
      if (parts.length >= 3) {
        const endYear = parseInt(parts[0]);
        const endMonth = parseInt(parts[1]) - 1;
        const nextMonth = new Date(endYear, endMonth + 1, 1);
        return nextMonth.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      }
    }
    return "N/A";
  };

  const getThresholdProgress = (inv: UserInvoice) => {
    const threshold = inv.threshold || summary?.threshold || 50;
    return Math.min(100, (inv.net_amount / threshold) * 100);
  };

  // Summary values
  const pendingEarnings = summary?.current_balance || 0;
  const totalPaidEarnings = summary?.total_paid || 0;
  const lifetimeEarnings = summary?.lifetime_earnings || 0;

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Loading payment information...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <Button onClick={() => navigate("/dashboard/settings?tab=billing")} className="bg-primary">
          <Settings className="h-4 w-4 mr-2" />Update Payment Settings
        </Button>
      </div>

      {/* Summary Boxes */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Pending Earnings</div>
            <div className="text-2xl font-bold">${Math.max(0, pendingEarnings).toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Total Paid Earnings</div>
            <div className="text-2xl font-bold">${totalPaidEarnings.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Lifetime Confirmed Earnings</div>
            <div className="text-2xl font-bold">${lifetimeEarnings.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Minimum Payment Threshold</div>
            <div className="text-2xl font-bold">${summary?.threshold?.toFixed(2) || "50.00"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Payment Terms</div>
            <div className="text-2xl font-bold">Net {summary?.net_terms || 30}</div>
          </CardContent>
        </Card>
      </div>

      {/* Threshold Progress Bar (for current pending amount) */}
      {summary && summary.current_balance > 0 && summary.current_balance < summary.threshold && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Threshold Progress</span>
              <span className="text-sm text-muted-foreground">${summary.current_balance.toFixed(2)} / ${summary.threshold.toFixed(2)}</span>
            </div>
            <Progress value={summary.progress_pct} className="h-3" />
            <p className="text-xs text-muted-foreground mt-2">
              You need ${(summary.threshold - summary.current_balance).toFixed(2)} more to reach the payment threshold. Earnings below the threshold are deferred to the next month.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Payment History Table */}
      <Card>
        <div className="p-4 border-b">
          <h3 className="font-semibold text-lg">Payment History</h3>
        </div>
        <div className="overflow-x-auto">
          {invoices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No invoices yet</p>
              <p className="text-xs mt-1">Invoices are generated monthly as you earn from conversions.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Creation Date</TableHead>
                  <TableHead>Billing Period</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due On</TableHead>
                  <TableHead>View</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map(inv => (
                  <TableRow key={inv._id} className={inv.status === "held" ? "bg-gray-50/50" : ""}>
                    <TableCell>{getCreationDate(inv)}</TableCell>
                    <TableCell>{formatBillingPeriod(inv.period_start, inv.period_end)}</TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">${inv.net_amount.toFixed(2)}</span>
                        {inv.status === "held" && (
                          <div className="mt-1 w-24">
                            <Progress value={getThresholdProgress(inv)} className="h-1.5" />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(inv.status)}</TableCell>
                    <TableCell>{inv.paid_at ? formatDate(inv.paid_at) : "N/A"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="text-primary" onClick={() => setViewInvoice(inv)}>
                        <Eye className="h-4 w-4 mr-1" />View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>

      {/* View Invoice Dialog */}
      <Dialog open={!!viewInvoice} onOpenChange={() => setViewInvoice(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
          </DialogHeader>
          {viewInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Billing Period</span>
                  <p className="font-medium">{formatBillingPeriod(viewInvoice.period_start, viewInvoice.period_end)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Created</span>
                  <p className="font-medium">{getCreationDate(viewInvoice)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <div className="mt-1">{getStatusBadge(viewInvoice.status)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Payment Terms</span>
                  <p className="font-medium">Net {viewInvoice.net_terms || 30}</p>
                </div>
              </div>

              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Gross Earnings</span>
                  <span className="font-medium text-green-600">${viewInvoice.gross_amount.toFixed(2)}</span>
                </div>
                {viewInvoice.reversals_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Reversals</span>
                    <span className="font-medium text-red-600">-${viewInvoice.reversals_amount.toFixed(2)}</span>
                  </div>
                )}
                {viewInvoice.carry_forward > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Carry Forward (from prior month)</span>
                    <span className="font-medium text-orange-600">-${viewInvoice.carry_forward.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm border-t pt-2 font-bold">
                  <span>Net Amount</span>
                  <span>${viewInvoice.net_amount.toFixed(2)}</span>
                </div>
              </div>

              {/* Threshold progress for held invoices */}
              {viewInvoice.status === "held" && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Threshold Progress</span>
                    <span>${viewInvoice.net_amount.toFixed(2)} / ${(viewInvoice.threshold || summary?.threshold || 50).toFixed(2)}</span>
                  </div>
                  <Progress value={getThresholdProgress(viewInvoice)} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-2">This amount will carry forward and combine with next month's earnings until the threshold is reached.</p>
                </div>
              )}

              {viewInvoice.status === "paid" && viewInvoice.paid_at && (
                <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600 inline mr-1" />
                  Paid on {formatDate(viewInvoice.paid_at)}
                </div>
              )}

              {viewInvoice.status === "eligible" && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm">
                  <CreditCard className="h-4 w-4 text-blue-600 inline mr-1" />
                  Payment is being processed. You'll be notified once it's completed.
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Payments = () => {
  return (
    <PlacementRequired>
      <PaymentsContent />
    </PlacementRequired>
  );
};

export default Payments;
