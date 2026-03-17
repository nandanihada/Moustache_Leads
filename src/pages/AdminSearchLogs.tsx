import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  RefreshCw, Search, Mail, Send, ChevronLeft, ChevronRight,
  AlertTriangle, CheckCircle, XCircle, Package, Filter,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { searchLogsApi, type SearchLog, type SearchLogsFilters } from '@/services/searchLogsApi';
import { AdminPageGuard } from '@/components/AdminPageGuard';

const AdminSearchLogsContent: React.FC = () => {
  const { toast } = useToast();
  const [logs, setLogs] = useState<SearchLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total_searches: 0, no_result_count: 0, not_in_inventory: 0, in_inventory_not_active: 0 });
  const [pagination, setPagination] = useState({ page: 1, per_page: 25, total: 0, pages: 0 });

  // Filters
  const [keywordFilter, setKeywordFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [noResultFilter, setNoResultFilter] = useState('');
  const [inventoryFilter, setInventoryFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Selection & Email
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [sendToAll, setSendToAll] = useState(false);
  const [sending, setSending] = useState(false);

  const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const filters: SearchLogsFilters = {
        page,
        per_page: 25,
        keyword: keywordFilter,
        user: userFilter,
        no_result: noResultFilter === 'all' ? '' : noResultFilter,
        inventory_status: inventoryFilter === 'all' ? '' : inventoryFilter,
        date_from: dateFrom,
        date_to: dateTo,
      };
      const res = await searchLogsApi.getLogs(filters);
      setLogs(res.logs);
      setStats(res.stats);
      setPagination(res.pagination);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [keywordFilter, userFilter, noResultFilter, inventoryFilter, dateFrom, dateTo]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === logs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(logs.map(l => l.user_id)));
    }
  };

  const handleSendEmail = async () => {
    if (!emailSubject.trim() || !emailMessage.trim()) {
      toast({ title: 'Error', description: 'Subject and message are required', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const data = sendToAll
        ? { subject: emailSubject, message: emailMessage, send_to_all: true }
        : { user_ids: Array.from(selectedIds), subject: emailSubject, message: emailMessage };
      const res = await searchLogsApi.sendEmail(data);
      toast({ title: 'Emails Sent', description: `${res.sent} sent, ${res.failed} failed` });
      setEmailOpen(false);
      setEmailSubject('');
      setEmailMessage('');
      setSendToAll(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const getInventoryBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><CheckCircle className="h-3 w-3 mr-1" />Available</Badge>;
      case 'in_inventory_not_active':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"><AlertTriangle className="h-3 w-3 mr-1" />In Inventory (Not Active)</Badge>;
      case 'not_in_inventory':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"><XCircle className="h-3 w-3 mr-1" />Not in Inventory</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('en-IN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: true,
        timeZone: 'Asia/Kolkata',
      }) + ' IST';
    } catch { return dateStr; }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Search Logs</h1>
          <p className="text-muted-foreground">Track what publishers are searching for in offers</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (selectedIds.size === 0 && !sendToAll) {
                toast({ title: 'Select users first', description: 'Select users from the table or use "Send to All"', variant: 'destructive' });
                return;
              }
              setEmailOpen(true);
            }}
            disabled={selectedIds.size === 0}
          >
            <Mail className="h-4 w-4 mr-2" />
            Email Selected ({selectedIds.size})
          </Button>
          <Button
            variant="outline"
            onClick={() => { setSendToAll(true); setEmailOpen(true); }}
          >
            <Send className="h-4 w-4 mr-2" />
            Email All
          </Button>
          <Button onClick={() => fetchLogs()} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Searches</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.total_searches}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">No Results</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-500">{stats.no_result_count}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Not in Inventory</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-orange-500">{stats.not_in_inventory}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">In Inventory (Not Active)</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-yellow-500">{stats.in_inventory_not_active}</div></CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Filters</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-4 w-4 mr-1" />{showFilters ? 'Hide' : 'Show'} Filters
            </Button>
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <Input placeholder="Search keyword..." value={keywordFilter} onChange={e => setKeywordFilter(e.target.value)} />
              <Input placeholder="User / Username..." value={userFilter} onChange={e => setUserFilter(e.target.value)} />
              <Select value={noResultFilter} onValueChange={setNoResultFilter}>
                <SelectTrigger><SelectValue placeholder="Results filter" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Results</SelectItem>
                  <SelectItem value="true">No Results Only</SelectItem>
                  <SelectItem value="false">Has Results</SelectItem>
                </SelectContent>
              </Select>
              <Select value={inventoryFilter} onValueChange={setInventoryFilter}>
                <SelectTrigger><SelectValue placeholder="Inventory status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="in_inventory_not_active">In Inventory (Not Active)</SelectItem>
                  <SelectItem value="not_in_inventory">Not in Inventory</SelectItem>
                </SelectContent>
              </Select>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="From date" />
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="To date" />
            </div>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={() => fetchLogs(1)}>Apply Filters</Button>
              <Button size="sm" variant="outline" onClick={() => {
                setKeywordFilter(''); setUserFilter(''); setNoResultFilter(''); setInventoryFilter(''); setDateFrom(''); setDateTo('');
              }}>Clear</Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={logs.length > 0 && selectedIds.size === logs.length}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Keyword</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-center">Results Count</TableHead>
                  <TableHead className="text-center">No Result</TableHead>
                  <TableHead>Inventory Flag</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      No search logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log._id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(log.user_id)}
                          onCheckedChange={() => toggleSelect(log.user_id)}
                          aria-label={`Select ${log.username}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{log.username || log.user_id}</TableCell>
                      <TableCell>
                        <span className="font-mono text-sm bg-muted px-2 py-1 rounded">{log.keyword}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(log.searched_at)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={log.results_count > 0 ? 'default' : 'destructive'}>
                          {log.results_count}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {log.no_result ? (
                          <XCircle className="h-5 w-5 text-red-500 mx-auto" />
                        ) : (
                          <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell>
                        {getInventoryBadge(log.inventory_status)}
                        <div className="text-xs text-muted-foreground mt-1">
                          <Package className="h-3 w-3 inline mr-1" />
                          Total: {log.total_inventory_count} | Active: {log.active_inventory_count}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.pages} ({pagination.total} total)
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={pagination.page <= 1} onClick={() => fetchLogs(pagination.page - 1)}>
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Button>
                <Button size="sm" variant="outline" disabled={pagination.page >= pagination.pages} onClick={() => fetchLogs(pagination.page + 1)}>
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Dialog */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {sendToAll ? 'Send Email to All Searched Users' : `Send Email to ${selectedIds.size} Selected User(s)`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Subject</label>
              <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Email subject..." />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Message</label>
              <Textarea
                value={emailMessage}
                onChange={e => setEmailMessage(e.target.value)}
                placeholder="Write your message here... Admin can edit this before sending."
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEmailOpen(false); setSendToAll(false); }}>Cancel</Button>
            <Button onClick={handleSendEmail} disabled={sending}>
              {sending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              {sending ? 'Sending...' : 'Send Email'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const AdminSearchLogs: React.FC = () => (
  <AdminPageGuard requiredTab="search-logs">
    <AdminSearchLogsContent />
  </AdminPageGuard>
);

export default AdminSearchLogs;
