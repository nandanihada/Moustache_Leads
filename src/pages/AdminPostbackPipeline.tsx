import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, ArrowRight, AlertTriangle, CheckCircle, XCircle, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { postbackPipelineApi } from '@/services/postbackPipelineApi';
import { AdminPageGuard } from '@/components/AdminPageGuard';

interface PipelineStats {
  pipeline: {
    received: { total: number; matched: number; unmatched: number; pending: number };
    conversions: { total: number; verified: number; fake_flagged: number };
    forwarded: { total: number; verified: number; fake_flagged: number; legacy_unflagged: number };
    points: { total_transactions: number; fake_flagged: number };
  };
  recent_received: any[];
  recent_forwarded: any[];
  days: number;
}

function PipelineBox({ label, value, color, sub }: { label: string; value: number; color: string; sub?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800',
    green: 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800',
    red: 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800',
    yellow: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800',
    gray: 'bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700',
  };
  return (
    <div className={`rounded-lg border p-4 ${colors[color] || colors.gray}`}>
      <div className="text-xs text-muted-foreground font-medium">{label}</div>
      <div className="text-2xl font-bold mt-1">{value.toLocaleString()}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function PipelineArrow() {
  return <div className="flex items-center justify-center"><ArrowRight className="h-5 w-5 text-muted-foreground" /></div>;
}

function AdminPostbackPipelineContent() {
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState('30');
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<any>(null);
  const [tab, setTab] = useState('overview');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await postbackPipelineApi.getStats(Number(days));
      if (res.success) setStats(res);
    } catch { toast.error('Failed to load pipeline stats'); }
    finally { setLoading(false); }
  }, [days]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleCleanup = async (dryRun: boolean) => {
    if (!dryRun && !confirm('This will FLAG fake records and DEDUCT fake points from users. Are you sure?')) return;
    setCleanupRunning(true);
    try {
      const res = await postbackPipelineApi.runCleanup(dryRun);
      if (res.success) {
        setCleanupResult(res);
        toast.success(dryRun ? 'Dry run complete — no changes made' : 'Cleanup applied successfully');
        if (!dryRun) fetchStats();
      }
    } catch { toast.error('Cleanup failed'); }
    finally { setCleanupRunning(false); }
  };

  const p = stats?.pipeline;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Postback Pipeline</h1>
          <p className="text-sm text-muted-foreground">Track the full flow: Received → Matched → Converted → Forwarded</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={fetchStats} disabled={loading} size="sm">
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />Refresh
          </Button>
        </div>
      </div>

      {p && (
        <>
          {/* Pipeline Flow Visualization */}
          <Card className="p-6">
            <h2 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wide">Pipeline Flow</h2>
            <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-center gap-2">
              <PipelineBox label="Received from Partners" value={p.received.total} color="blue" sub={`${p.received.matched} matched, ${p.received.unmatched} unmatched`} />
              <PipelineArrow />
              <PipelineBox label="Conversions Created" value={p.conversions.verified} color="green" sub={`${p.conversions.fake_flagged} fake flagged`} />
              <PipelineArrow />
              <PipelineBox label="Forwarded to Publishers" value={p.forwarded.verified} color="green" sub={`${p.forwarded.fake_flagged} fake flagged`} />
              <PipelineArrow />
              <PipelineBox label="Points Awarded" value={p.points.verified_transactions || p.points.total_transactions} color="blue" sub={`${p.points.fake_flagged} fake flagged`} />
            </div>
          </Card>

          {/* Health Indicators */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4 flex items-center gap-3">
              {p.received.unmatched === 0 ? <CheckCircle className="h-5 w-5 text-green-500" /> : <AlertTriangle className="h-5 w-5 text-yellow-500" />}
              <div>
                <div className="text-xs text-muted-foreground">Unmatched Postbacks</div>
                <div className="text-lg font-bold">{p.received.unmatched}</div>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-3">
              {p.conversions.fake_flagged === 0 ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
              <div>
                <div className="text-xs text-muted-foreground">Fake Conversions</div>
                <div className="text-lg font-bold">{p.conversions.fake_flagged}</div>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-3">
              {p.forwarded.fake_flagged === 0 ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
              <div>
                <div className="text-xs text-muted-foreground">Fake Forwards</div>
                <div className="text-lg font-bold">{p.forwarded.fake_flagged}</div>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-3">
              {p.forwarded.legacy_unflagged === 0 ? <CheckCircle className="h-5 w-5 text-green-500" /> : <AlertTriangle className="h-5 w-5 text-yellow-500" />}
              <div>
                <div className="text-xs text-muted-foreground">Legacy Unflagged</div>
                <div className="text-lg font-bold">{p.forwarded.legacy_unflagged}</div>
              </div>
            </Card>
          </div>
        </>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Recent Activity</TabsTrigger>
          <TabsTrigger value="cleanup">Data Cleanup</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Recent Received */}
          <Card>
            <div className="p-4 border-b"><h3 className="font-semibold">Recent Received Postbacks</h3></div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Partner</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(stats?.recent_received || []).map((pb, i) => (
                    <TableRow key={pb._id || i}>
                      <TableCell className="text-xs">{pb.timestamp ? new Date(pb.timestamp).toLocaleString() : '-'}</TableCell>
                      <TableCell>{pb.partner_name || '-'}</TableCell>
                      <TableCell>
                        {pb.status === 'processed' && <Badge className="bg-green-100 text-green-800">Matched</Badge>}
                        {pb.status === 'unmatched' && <Badge className="bg-red-100 text-red-800">Unmatched</Badge>}
                        {pb.status === 'received' && <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>}
                        {!['processed', 'unmatched', 'received'].includes(pb.status) && <Badge variant="secondary">{pb.status}</Badge>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{pb.unique_key?.slice(0, 12)}...</TableCell>
                      <TableCell>{pb.country || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">{pb.ip_address || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {(!stats?.recent_received || stats.recent_received.length === 0) && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No received postbacks in this period</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Recent Forwarded */}
          <Card>
            <div className="p-4 border-b"><h3 className="font-semibold">Recent Forwarded Postbacks (Verified Only)</h3></div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Publisher</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Offer</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(stats?.recent_forwarded || []).map((fwd, i) => (
                    <TableRow key={fwd._id || i}>
                      <TableCell className="text-xs">{fwd.timestamp ? new Date(fwd.timestamp).toLocaleString() : '-'}</TableCell>
                      <TableCell>{fwd.publisher_name || '-'}</TableCell>
                      <TableCell>{fwd.username || '-'}</TableCell>
                      <TableCell>{fwd.offer_id || '-'}</TableCell>
                      <TableCell className="font-semibold">{fwd.points || 0}</TableCell>
                      <TableCell>
                        {fwd.forward_status === 'success' ? <Badge className="bg-green-100 text-green-800">Success</Badge> : <Badge className="bg-red-100 text-red-800">{fwd.forward_status}</Badge>}
                      </TableCell>
                      <TableCell>
                        {fwd.source === 'verified_postback' ? <Badge className="bg-blue-100 text-blue-800">Verified</Badge> : <Badge variant="secondary">{fwd.source || 'Legacy'}</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!stats?.recent_forwarded || stats.recent_forwarded.length === 0) && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No verified forwarded postbacks in this period</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="cleanup" className="space-y-4">
          <Card className="p-6">
            <h3 className="font-semibold text-lg mb-2">Fake Data Cleanup</h3>
            <p className="text-sm text-muted-foreground mb-4">
              The old system had a bug where unmatched postbacks grabbed random clicks and created fake conversions.
              This tool identifies and flags those fake records across conversions, forwarded_postbacks, and points_transactions.
              It also deducts fake points from affected users.
            </p>
            <div className="flex gap-3">
              <Button onClick={() => handleCleanup(true)} disabled={cleanupRunning} variant="outline">
                <Eye className="h-4 w-4 mr-1" />{cleanupRunning ? 'Running...' : 'Dry Run (Preview)'}
              </Button>
              <Button onClick={() => handleCleanup(false)} disabled={cleanupRunning} variant="destructive">
                <Trash2 className="h-4 w-4 mr-1" />{cleanupRunning ? 'Running...' : 'Apply Cleanup'}
              </Button>
            </div>
          </Card>

          {cleanupResult && (
            <Card className="p-6">
              <h3 className="font-semibold mb-3">
                Cleanup Results {cleanupResult.dry_run ? <Badge variant="secondary">Dry Run</Badge> : <Badge className="bg-green-100 text-green-800">Applied</Badge>}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {cleanupResult.result?.conversions && (
                  <div className="border rounded-lg p-4">
                    <div className="text-sm font-medium mb-2">Conversions</div>
                    <div className="text-xs space-y-1">
                      <div>Checked: {cleanupResult.result.conversions.total}</div>
                      <div className="text-red-600">Fake: {cleanupResult.result.conversions.flagged}</div>
                      <div className="text-green-600">Verified: {cleanupResult.result.conversions.verified}</div>
                    </div>
                  </div>
                )}
                {cleanupResult.result?.forwarded_postbacks && (
                  <div className="border rounded-lg p-4">
                    <div className="text-sm font-medium mb-2">Forwarded Postbacks</div>
                    <div className="text-xs space-y-1">
                      <div>Checked: {cleanupResult.result.forwarded_postbacks.total}</div>
                      <div className="text-red-600">Fake: {cleanupResult.result.forwarded_postbacks.flagged}</div>
                      <div className="text-green-600">Verified: {cleanupResult.result.forwarded_postbacks.verified}</div>
                    </div>
                  </div>
                )}
                {cleanupResult.result?.points_transactions && (
                  <div className="border rounded-lg p-4">
                    <div className="text-sm font-medium mb-2">Points Transactions</div>
                    <div className="text-xs space-y-1">
                      <div>Checked: {cleanupResult.result.points_transactions.total}</div>
                      <div className="text-red-600">Fake: {cleanupResult.result.points_transactions.flagged}</div>
                      <div className="text-green-600">Verified: {cleanupResult.result.points_transactions.verified}</div>
                    </div>
                  </div>
                )}
              </div>
              {cleanupResult.result?.fake_points_by_user && Object.keys(cleanupResult.result.fake_points_by_user).length > 0 && (
                <div className="mt-4 border rounded-lg p-4">
                  <div className="text-sm font-medium mb-2">Affected Users (Fake Points)</div>
                  <div className="text-xs space-y-1">
                    {Object.entries(cleanupResult.result.fake_points_by_user).map(([user, pts]) => (
                      <div key={user} className="flex justify-between">
                        <span className="font-mono">{user}</span>
                        <span className="text-red-600 font-semibold">{String(pts)} fake points</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs font-semibold">Total fake points: {cleanupResult.result.fake_points_total}</div>
                </div>
              )}
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

const AdminPostbackPipeline = () => (
  <AdminPageGuard requiredTab="postback">
    <AdminPostbackPipelineContent />
  </AdminPageGuard>
);

export default AdminPostbackPipeline;
