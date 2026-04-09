import { useState, useEffect } from "react";
import { Info, Eye, ChevronLeft, ChevronRight, Search, Download, History } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { payoutSettingsApi } from "@/services/payoutSettingsApi";
import { useNavigate } from "react-router-dom";
import PlacementRequired from "@/components/PlacementRequired";

const PaymentsContent = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination states
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchPaymentsData = async () => {
      setLoading(true);
      try {
        const [summary, hist, txs] = await Promise.all([
          payoutSettingsApi.getPaymentsSummary(),
          payoutSettingsApi.getPaymentsHistory(),
          payoutSettingsApi.getPaymentsTransactions()
        ]);
        if (summary?.success) setSummaryData(summary.data);
        if (hist?.success) setHistory(hist.data);
        if (txs?.success) setTransactions(txs.data);
      } catch (error) {
        console.error('Error fetching payments details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentsData();
  }, []);

  const formatCurrency = (amount: number) => {
    return `$${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const filteredTransactions = transactions.filter((tx: any) => {
    const matchesSearch =
      tx.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.offer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.status?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getTxStatusColor = (status: string) => {
    if (status === 'Valid') return 'secondary';
    if (status === 'Reversed') return 'destructive';
    return 'outline';
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'paid') {
      return <Badge variant="secondary" className="font-normal bg-green-50 text-green-700 hover:bg-green-50 border-0">Paid</Badge>;
    }
    if (s === 'deferred') {
      return (
        <div className="flex items-center gap-1 text-muted-foreground text-sm">
          Deferred
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Payment deferred for next cycle</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
    }
    return <Badge variant="outline" className="font-normal">{status}</Badge>;
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading billing data...</div>;
  }

  const {
    pending_earnings = 0,
    total_paid_earnings = 0,
    lifetime_confirmed_earnings = 0,
    minimum_payment_threshold = 25,
    payment_terms = 'Net 30'
  } = summaryData || {};

  // For visual testing & demonstration if user has zero payouts
  const dummyData = [
    { id: '9ydw4fqcmd4295r', creation_date: 'January 1, 2026', billing_period: 'December 1, 2025 - December 31, 2025', amount: 0.02, status: 'Deferred', due_on: 'N/A' },
    { id: 'oct-2025', creation_date: 'October 1, 2025', billing_period: 'September 1, 2025 - September 30, 2025', amount: 26.26, status: 'Paid', due_on: 'October 31, 2025' },
    { id: 'sep-2025', creation_date: 'September 1, 2025', billing_period: 'August 1, 2025 - August 31, 2025', amount: 148.48, status: 'Paid', due_on: 'September 30, 2025' },
    { id: 'jun-2025', creation_date: 'June 1, 2025', billing_period: 'May 1, 2025 - May 31, 2025', amount: 0.90, status: 'Paid', due_on: 'N/A' },
    { id: 'apr-2025', creation_date: 'April 1, 2025', billing_period: 'March 1, 2025 - March 31, 2025', amount: 0.26, status: 'Paid', due_on: 'N/A' },
  ];

  const displayHistory = history && history.length > 0 ? history : dummyData;
  const totalEntries = displayHistory.length;

  // Pagination logic
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const paginatedHistory = displayHistory.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <h1 className="text-xl font-semibold text-foreground">Billing</h1>
        <Button 
          variant="default" 
          className="bg-[#4D94FF] hover:bg-[#3d7ae6] text-white"
          onClick={() => navigate('/dashboard/settings')}
        >
          Update Payment Settings
        </Button>
      </div>

      {/* Summary Cards Line */}
      <div className="bg-white border rounded-lg shadow-sm w-full divide-x divide-gray-100 flex flex-wrap lg:flex-nowrap">
        {/* Pending Earnings */}
        <div className="p-6 flex-1 min-w-[200px]">
          <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-2 font-medium">
            Pending Earnings
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3.5 w-3.5 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Earnings currently pending review</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="text-2xl font-bold text-gray-900">{formatCurrency(pending_earnings)}</div>
        </div>

        {/* Total Paid Earnings */}
        <div className="p-6 flex-1 min-w-[200px]">
          <div className="flex items-center text-sm text-gray-500 mb-2 font-medium">
            Total Paid Earnings
          </div>
          <div className="text-2xl font-bold text-gray-900">{formatCurrency(total_paid_earnings)}</div>
        </div>

        {/* Lifetime Confirmed */}
        <div className="p-6 flex-1 min-w-[200px]">
          <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-2 font-medium">
            Lifetime Confirmed Earnings
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3.5 w-3.5 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Total confirmed earnings to date</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="text-2xl font-bold text-gray-900">{formatCurrency(lifetime_confirmed_earnings)}</div>
        </div>

        {/* Threshold */}
        <div className="p-6 flex-1 min-w-[200px]">
          <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-2 font-medium">
            Minimum Payment Threshold
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3.5 w-3.5 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Minimum balance required for payout</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="text-2xl font-bold text-gray-900">{formatCurrency(minimum_payment_threshold)}</div>
        </div>

        {/* Terms */}
        <div className="p-6 flex-1 min-w-[200px]">
          <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-2 font-medium">
            Payment Terms
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3.5 w-3.5 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Current payout terms</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="text-2xl font-bold text-gray-900">{payment_terms}</div>
        </div>
      </div>

      {/* History Table Container */}
      <div className="bg-white border rounded-lg shadow-sm mt-8">
        <div className="p-4 border-b">
          <h2 className="text-sm font-semibold text-gray-700">Payment History</h2>
        </div>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50/50">
              <TableRow className="border-b border-gray-100">
                <TableHead className="font-medium text-xs uppercase text-gray-500 h-11 px-4 tracking-wider">Creation Date</TableHead>
                <TableHead className="font-medium text-xs uppercase text-gray-500 h-11 px-4 tracking-wider">Billing Period</TableHead>
                <TableHead className="font-medium text-xs uppercase text-gray-500 h-11 px-4 tracking-wider">Amount</TableHead>
                <TableHead className="font-medium text-xs uppercase text-gray-500 h-11 px-4 tracking-wider">Status</TableHead>
                <TableHead className="font-medium text-xs uppercase text-gray-500 h-11 px-4 tracking-wider">Due On</TableHead>
                <TableHead className="font-medium text-xs uppercase text-gray-500 h-11 px-4 tracking-wider">View</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedHistory.map((row: any) => (
                <TableRow key={row.id} className="border-b border-gray-100 hover:bg-gray-50/50 group">
                  <TableCell className="px-4 py-4 text-sm text-gray-700">{row.creation_date}</TableCell>
                  <TableCell className="px-4 py-4 text-sm text-gray-700">{row.billing_period}</TableCell>
                  <TableCell className="px-4 py-4 text-sm text-gray-700">{formatCurrency(row.amount)}</TableCell>
                  <TableCell className="px-4 py-4">
                    {getStatusBadge(row.status)}
                  </TableCell>
                  <TableCell className="px-4 py-4 text-sm text-gray-700">{row.due_on}</TableCell>
                  <TableCell className="px-4 py-4">
                    <button 
                      onClick={() => navigate(`/dashboard/payments/invoice/${row.id}`)}
                      className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-700 font-medium transition-colors"
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </button>
                  </TableCell>
                </TableRow>
              ))}
              {displayHistory.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                    No payment history available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Pagination Footer */}
        <div className="p-4 flex items-center justify-between text-sm text-gray-500 border-t border-gray-100 bg-white rounded-b-lg">
          <div className="flex items-center gap-2">
            <span>Show</span>
            <select 
              className="border border-gray-300 rounded px-2 py-1 text-gray-700 outline-none focus:border-blue-500"
              value={entriesPerPage}
              onChange={(e) => {
                setEntriesPerPage(Number(e.target.value));
                setCurrentPage(1); // Reset page on limit change
              }}
            >
              <option value={2}>2</option>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span>entries</span>
          </div>
          
          <div className="flex items-center gap-6">
            <div>
              Displaying {totalEntries === 0 ? 0 : startIndex + 1} to {Math.min(endIndex, totalEntries)} of {totalEntries} entries
            </div>
            <div className="flex items-center gap-1 border rounded divide-x shadow-sm bg-white">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-3 py-1.5 hover:bg-gray-50 text-gray-400 disabled:opacity-50"
              >
                «
              </button>
              <button className="px-3 py-1.5 bg-[#4D94FF] text-white">
                1
              </button>
              <button className="px-3 py-1.5 hover:bg-gray-50">
                2
              </button>
              <button className="px-3 py-1.5 hover:bg-gray-50">
                3
              </button>
              <button className="px-3 py-1.5 hover:bg-gray-50">
                4
              </button>
              <button className="px-3 py-1.5 hover:bg-gray-50">
                5
              </button>
              <button className="px-3 py-1.5 hover:bg-gray-50 rounded-r border-l border-transparent">
                ›
              </button>
              <button className="px-3 py-1.5 hover:bg-gray-50 text-gray-400">
                »
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Legacy Transaction Details */}
      <h3 className="text-xl font-semibold tracking-tight mt-8 mb-4">Transaction Details</h3>
      <Card className="shadow-sm border-border/60">
        <CardContent className="p-0">
          <div className="p-4 border-b border-border/50 flex gap-4 items-center bg-gray-50/50">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1.5 mt-1 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>
            
            <Button variant="outline" className="ml-auto" onClick={() => window.print()}>
              <Download className="h-4 w-4 mr-2" />
              Download Report
            </Button>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="p-12 text-center text-gray-500 bg-gray-50/30">
              <History className="h-10 w-10 mx-auto text-gray-300 mb-3" />
              <p className="font-medium text-gray-900">No transactions found</p>
              <p className="text-sm mt-1">Earnings and adjustments will appear here over time.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-50/50">
                  <TableRow>
                    <TableHead className="w-[120px]">Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((tx: any) => (
                    <TableRow key={tx.id} className="hover:bg-gray-50/50">
                      <TableCell className="text-gray-500 text-sm font-medium">{tx.date || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal bg-white">{tx.type}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={tx.offer_name}>
                        {tx.offer_name}
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${tx.amount > 0 ? 'text-green-600' : tx.amount < 0 ? 'text-red-600' : ''}`}>
                        {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={getTxStatusColor(tx.status)}>
                          {tx.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
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