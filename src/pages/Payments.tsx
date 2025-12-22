import { useState, useEffect } from "react";
import { Search, Download, CreditCard, Calendar, DollarSign, AlertCircle } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { payoutSettingsApi } from "@/services/payoutSettingsApi";
import { useNavigate } from "react-router-dom";

const Payments = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [earningsData, setEarningsData] = useState<any>(null);

  useEffect(() => {
    const fetchEarnings = async () => {
      setLoading(true);
      try {
        const data = await payoutSettingsApi.getEarnings();
        setEarningsData(data);
      } catch (error) {
        console.error('Error fetching earnings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEarnings();
  }, []);

  const filteredPayments = earningsData?.earnings_history?.filter((earning: any) => {
    const matchesSearch =
      earning.month.toLowerCase().includes(searchTerm.toLowerCase()) ||
      earning.transaction_id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || earning.status === statusFilter;

    return matchesSearch && matchesStatus;
  }) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "default";
      case "pending":
        return "secondary";
      case "processing":
        return "outline";
      case "carried_forward":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Payments</h1>
          <p className="text-muted-foreground">Track your payment history and upcoming payouts</p>
        </div>
        <div className="p-8 text-center">Loading earnings data...</div>
      </div>
    );
  }

  // Check if payout method is configured
  const hasPayoutMethod = earningsData?.payout_method?.has_method;
  const currentMonth = earningsData?.current_month;
  const pendingEarnings = earningsData?.pending_earnings || 0;
  const nextPaymentDate = earningsData?.next_payment_date;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Payments</h1>
        <p className="text-muted-foreground">Track your payment history and upcoming payouts</p>
      </div>

      {!hasPayoutMethod && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">No Payout Method Configured</p>
              <p>Please configure your payout method in <button
                onClick={() => navigate('/dashboard/settings')}
                className="underline font-medium hover:text-yellow-900"
              >Settings → Billing Info</button> to receive payments.</p>
            </div>
          </div>
        </div>
      )}

      {/* Payment Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Month</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {currentMonth ? formatCurrency(currentMonth.amount) : '$0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              {currentMonth?.month || 'No earnings'} - {currentMonth?.status || 'Accumulating'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Earnings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary">
              {formatCurrency(pendingEarnings)}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting payment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Payout</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {nextPaymentDate ? formatDate(nextPaymentDate) : 'TBD'}
            </div>
            <p className="text-xs text-muted-foreground">
              {pendingEarnings > 0 ? 'Net-30 schedule' : 'No pending payments'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payout Method</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {earningsData?.payout_method?.active_method || 'Not Set'}
            </div>
            <p className="text-xs text-muted-foreground">
              {hasPayoutMethod ? 'Configured' : (
                <button
                  onClick={() => navigate('/dashboard/settings')}
                  className="underline hover:text-foreground"
                >
                  Configure now
                </button>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Earnings History */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Earnings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4 items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by month or transaction ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="carried_forward">Carried Forward</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>

            {filteredPayments.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <p className="mb-2">No earnings history yet</p>
                <p className="text-sm">Earnings will appear here once you start earning from conversions.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment Date</TableHead>
                    <TableHead>Transaction ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((earning: any) => (
                    <TableRow key={earning.id}>
                      <TableCell className="font-medium">{earning.month}</TableCell>
                      <TableCell className="font-semibold text-primary">
                        {formatCurrency(earning.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(earning.status)}>
                          {earning.status.charAt(0).toUpperCase() + earning.status.slice(1).replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(earning.payment_date)}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {earning.transaction_id || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Payments;