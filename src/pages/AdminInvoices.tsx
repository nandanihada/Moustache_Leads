import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { FileText, DollarSign, Clock, CheckCircle, AlertTriangle, RefreshCw, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { AdminPageGuard } from '@/components/AdminPageGuard';
import { adminReportsApi } from '@/services/adminReportsApi';

interface Invoice {
  _id: string;
  user_id: string;
  username: string;
  email: string;
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
  paid_by: string;
}

interface InvoiceStats {
  pending: { count: number; amount: number };
  eligible: { count: number; amount: number };
  paid: { count: number; amount: number };
  held: { count: number; amount: number };
}

function AdminInvoicesContent() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0, pages: 0 });
  const [stats, setStats] = useState<InvoiceStats | null>(null);
  const [threshold, setThreshold] = useState(50);
  const [statusFilter, setStatusFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('');
  const [showThresholdDialog, setShowThresholdDialog] = useState(false);
  const [newThreshold, setNewThreshold] = useState('50');
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generateYear, setGenerateYear] = useState(new Date().getFullYear());
  const [generateMonth, setGenerateMonth] = useState(new Date().getMonth() || 12);
  const [generating, setGenerating] = useState(false);

  const fetchInvoices = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params: any = { page, per_page: 20 };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (monthFilter) params.month = monthFilter;
      const res = await adminReportsApi.getInvoices(params);
      if (res.success) {
        setInvoices(res.invoices || []);
        setPagination(res.pagination || { page: 1, per_page: 20, total: 0, pages: 0 });
      }
    } catch { toast.error('Failed to load invoices'); }
    finally { setLoading(false); }
  }, [statusFilter, monthFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await adminReportsApi.getInvoiceStats();
      if (res.success) {
        setStats(res.stats);
        setThreshold(res.threshold || 50);
        setNewThreshold(String(res.threshold || 50));
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleMarkPaid = async (invoiceId: string) => {
    try {
      await adminReportsApi.markInvoicePaid(invoiceId);
      toast.success('Invoice marked as paid');
      fetchInvoices(pagination.page);
      fetchStats();
    } catch { toast.error('Failed to mark invoice paid'); }
  };

  const handleUpdateThreshold = async () => {
    try {
      const val = parseFloat(newThreshold);
      if (isNaN(val) || val < 0) { toast.error('Invalid threshold'); return; }
      await adminReportsApi.setInvoiceThreshold(val);
      toast.success(`Threshold updated to $${val}`);
      setThreshold(val);
      setShowThresholdDialog(false);
    } catch { toast.error('Failed to update threshold'); }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await adminReportsApi.generateInvoices(generateYear, generateMonth);
      toast.success(res.message || 'Invoices generated');
      setShowGenerateDialog(false);
      fetchInvoices();
      fetchStats();
    } catch { toast.error('Failed to generate invoices'); }
    finally { setGenerating(false); }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'eligible': return <Badge className="bg-green-100 text-green-800 border-green-300">Eligible</Badge>;
      case 'paid': return <Badge className="bg-blue-100 text-blue-800 border-blue-300">Paid</Badge>;
      case 'held': return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Held</Badge>;
      case 'pending': return <Badge className="bg-gray-100 text-gray-800">Pending</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatPeriod = (start: string, end: string) => {
    if (!start) return '-';
    const d = new Date(start);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">Monthly publisher invoices and payment management</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowThresholdDialog(true)}>
            <Settings className="h-4 w-4 mr-1" />Threshold: ${threshold}
          </Button>
          <Button size="sm" onClick={() => setShowGenerateDialog(true)}>
            <FileText className="h-4 w-4 mr-1" />Generate Invoices
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <div>
                <div className="text-xs text-muted-foreground">Held</div>
                <div className="text-xl font-bold">{stats.held.count}</div>
                <div className="text-xs text-muted-foreground">${stats.held.amount.toFixed(2)}</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-green-500" />
              <div>
                <div className="text-xs text-muted-foreground">Eligible</div>
                <div className="text-xl font-bold">{stats.eligible.count}</div>
                <div className="text-xs text-muted-foreground">${stats.eligible.amount.toFixed(2)}</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-blue-500" />
              <div>
                <div className="text-xs text-muted-foreground">Paid</div>
                <div className="text-xl font-bold">{stats.paid.count}</div>
                <div className="text-xs text-muted-foreground">${stats.paid.amount.toFixed(2)}</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-gray-500" />
              <div>
                <div className="text-xs text-muted-foreground">Threshold</div>
                <div className="text-xl font-bold">${threshold}</div>
                <div className="text-xs text-muted-foreground">Global minimum</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-medium">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="eligible">Eligible</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="held">Held</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium">Month</label>
            <Input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="w-44" />
          </div>
          <Button size="sm" onClick={() => fetchInvoices()}>
            <RefreshCw className="h-4 w-4 mr-1" />Refresh
          </Button>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No invoices found. Generate invoices for a month to get started.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Publisher</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Gross</TableHead>
                  <TableHead>Reversals</TableHead>
                  <TableHead>Carry Forward</TableHead>
                  <TableHead>Net Amount</TableHead>
                  <TableHead>Net Terms</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map(inv => (
                  <TableRow key={inv._id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{inv.username}</div>
                        <div className="text-xs text-muted-foreground">{inv.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>{formatPeriod(inv.period_start, inv.period_end)}</TableCell>
                    <TableCell className="text-green-600 font-medium">${inv.gross_amount.toFixed(2)}</TableCell>
                    <TableCell className="text-red-600">{inv.reversals_amount > 0 ? `-$${inv.reversals_amount.toFixed(2)}` : '$0.00'}</TableCell>
                    <TableCell className="text-orange-600">{inv.carry_forward > 0 ? `-$${inv.carry_forward.toFixed(2)}` : '$0.00'}</TableCell>
                    <TableCell className="font-bold">${inv.net_amount.toFixed(2)}</TableCell>
                    <TableCell>Net {inv.net_terms}</TableCell>
                    <TableCell>{getStatusBadge(inv.status)}</TableCell>
                    <TableCell>
                      {inv.status === 'eligible' && (
                        <Button variant="outline" size="sm" className="text-green-600" onClick={() => handleMarkPaid(inv._id)}>
                          Mark Paid
                        </Button>
                      )}
                      {inv.status === 'paid' && inv.paid_at && (
                        <span className="text-xs text-muted-foreground">
                          Paid {new Date(inv.paid_at).toLocaleDateString()}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <span className="text-sm text-muted-foreground">Page {pagination.page} of {pagination.pages} ({pagination.total} total)</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => fetchInvoices(pagination.page - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={pagination.page >= pagination.pages} onClick={() => fetchInvoices(pagination.page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Threshold Dialog */}
      <Dialog open={showThresholdDialog} onOpenChange={setShowThresholdDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment Threshold</DialogTitle>
            <DialogDescription>Set the global minimum payout threshold. Publishers below this amount will have their earnings held until the next month.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">Threshold Amount ($)</label>
            <Input type="number" value={newThreshold} onChange={e => setNewThreshold(e.target.value)} min="0" step="1" className="mt-1" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowThresholdDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdateThreshold}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generate Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Invoices</DialogTitle>
            <DialogDescription>Generate monthly invoices for all publishers with conversions in the selected period.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Year</label>
              <Input type="number" value={generateYear} onChange={e => setGenerateYear(Number(e.target.value))} min="2024" max="2030" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Month</label>
              <Select value={String(generateMonth)} onValueChange={v => setGenerateMonth(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                    <SelectItem key={m} value={String(m)}>
                      {new Date(2024, m - 1).toLocaleDateString('en-US', { month: 'long' })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>Cancel</Button>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? 'Generating...' : 'Generate'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const AdminInvoices = () => (
  <AdminPageGuard requiredTab="payments">
    <AdminInvoicesContent />
  </AdminPageGuard>
);

export default AdminInvoices;
