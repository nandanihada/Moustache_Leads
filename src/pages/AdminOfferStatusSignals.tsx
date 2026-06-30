import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { offerStatusSignalsApi, OfferStatusSignal, SignalStats } from '@/services/offerStatusSignalsApi';
import { Loader2, RefreshCw, CheckCircle2, XCircle, AlertCircle, Search, Radio } from 'lucide-react';

const AdminOfferStatusSignals: React.FC = () => {
  const { toast } = useToast();

  const [signals, setSignals] = useState<OfferStatusSignal[]>([]);
  const [stats, setStats] = useState<SignalStats>({ pending: 0, applied: 0, ignored: 0, total: 0 });
  const [networks, setNetworks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // Filters
  const [networkFilter, setNetworkFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Bulk action
  const [applying, setApplying] = useState(false);

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    try {
      const [signalsRes, statsRes] = await Promise.all([
        offerStatusSignalsApi.getSignals({ page, limit: 50, network: networkFilter, status: statusFilter, search: searchQuery }),
        offerStatusSignalsApi.getStats(),
      ]);
      setSignals(signalsRes.signals);
      setTotal(signalsRes.total);
      setNetworks(signalsRes.networks);
      setStats(statsRes);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to load signals', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [page, networkFilter, statusFilter, searchQuery]);

  useEffect(() => { fetchSignals(); }, [fetchSignals]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === signals.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(signals.map(s => s._id)));
    }
  };

  const handleApply = async (targetStatus: string) => {
    if (selectedIds.size === 0) return;
    setApplying(true);
    try {
      const result = await offerStatusSignalsApi.applySignals(Array.from(selectedIds), targetStatus);
      toast({ title: 'Applied', description: `Updated ${result.applied} offers to "${targetStatus}"` });
      setSelectedIds(new Set());
      fetchSignals();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to apply signals', variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  };

  const handleIgnore = async () => {
    if (selectedIds.size === 0) return;
    setApplying(true);
    try {
      const result = await offerStatusSignalsApi.ignoreSignals(Array.from(selectedIds));
      toast({ title: 'Ignored', description: `Ignored ${result.ignored} signals` });
      setSelectedIds(new Set());
      fetchSignals();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to ignore signals', variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  };

  const webhookUrl = 'https://postback.moustacheleads.com/offer-status/{network_key}?offer_id={OID}&status={TYP}';

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Offer Status Signals</h1>
          <p className="text-muted-foreground text-sm">
            Incoming offer status notifications from affiliate networks
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchSignals} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.applied}</div>
            <div className="text-xs text-muted-foreground">Applied</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-500">{stats.ignored}</div>
            <div className="text-xs text-muted-foreground">Ignored</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total Received</div>
          </CardContent>
        </Card>
      </div>

      {/* Webhook URL Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Radio className="h-4 w-4" /> Webhook URL
          </CardTitle>
        </CardHeader>
        <CardContent>
          <code className="text-xs bg-muted p-2 rounded block break-all">{webhookUrl}</code>
          <p className="text-xs text-muted-foreground mt-2">
            Replace <code>{'{network_key}'}</code> with the network name (e.g., adscendmedia, cpamerchant).
            Networks will hit this URL with offer_id and status params.
          </p>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search offer name or ID..."
            className="pl-9 h-9"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">⏳ Pending</SelectItem>
            <SelectItem value="applied">✅ Applied</SelectItem>
            <SelectItem value="ignored">🚫 Ignored</SelectItem>
            <SelectItem value="">All</SelectItem>
          </SelectContent>
        </Select>
        {networks.length > 0 && (
          <Select value={networkFilter} onValueChange={v => { setNetworkFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="All Networks" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Networks</SelectItem>
              {networks.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => handleApply('inactive')} disabled={applying}>
            Mark Inactive
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleApply('paused')} disabled={applying}>
            Mark Paused
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleApply('active')} disabled={applying}>
            Mark Active
          </Button>
          <Button size="sm" variant="ghost" onClick={handleIgnore} disabled={applying}>
            Ignore
          </Button>
          {applying && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : signals.length === 0 ? (
            <div className="text-center p-12 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No signals found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={selectedIds.size === signals.length && signals.length > 0} onCheckedChange={selectAll} />
                  </TableHead>
                  <TableHead className="text-xs">Network</TableHead>
                  <TableHead className="text-xs">Offer ID</TableHead>
                  <TableHead className="text-xs">Matched Offer</TableHead>
                  <TableHead className="text-xs">Status Received</TableHead>
                  <TableHead className="text-xs">Current Status</TableHead>
                  <TableHead className="text-xs">State</TableHead>
                  <TableHead className="text-xs">Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signals.map(signal => (
                  <TableRow key={signal._id} className="text-xs">
                    <TableCell>
                      <Checkbox checked={selectedIds.has(signal._id)} onCheckedChange={() => toggleSelect(signal._id)} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{signal.network}</Badge>
                    </TableCell>
                    <TableCell className="font-mono">{signal.offer_id_received || '-'}</TableCell>
                    <TableCell className="max-w-[180px] truncate">
                      {signal.matched_offer_name || <span className="text-muted-foreground italic">Unmatched</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{signal.status_received || '-'}</Badge>
                    </TableCell>
                    <TableCell>
                      {signal.current_status ? (
                        <Badge variant={signal.current_status === 'active' ? 'default' : 'outline'}>
                          {signal.current_status}
                        </Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {signal.applied && (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-3 w-3" /> Applied
                        </span>
                      )}
                      {signal.ignored && (
                        <span className="flex items-center gap-1 text-gray-500">
                          <XCircle className="h-3 w-3" /> Ignored
                        </span>
                      )}
                      {!signal.applied && !signal.ignored && (
                        <span className="flex items-center gap-1 text-orange-600">
                          <AlertCircle className="h-3 w-3" /> Pending
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {signal.received_at ? new Date(signal.received_at).toLocaleString() : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > 50 && (
        <div className="flex justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground self-center">Page {page} of {Math.ceil(total / 50)}</span>
          <Button size="sm" variant="outline" disabled={page >= Math.ceil(total / 50)} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
};

export default AdminOfferStatusSignals;
