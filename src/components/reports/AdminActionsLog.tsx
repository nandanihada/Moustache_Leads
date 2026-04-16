/**
 * Admin Actions Log + Blocked Users/IPs Tab
 * Shows audit trail of all actions taken from click tracking,
 * plus blocked users and blocked IPs with unblock buttons.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Unlock, Shield, Globe, History } from 'lucide-react';
import { toast } from 'sonner';
import { getApiBaseUrl } from '@/services/apiConfig';

const BASE = getApiBaseUrl();
function authHeaders() {
  return { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' };
}

const ACTION_LABELS: Record<string, string> = {
  block_user: '🚫 Block User',
  unblock_user: '✅ Unblock User',
  pause_offer: '⏸️ Pause Offer',
  change_payout_global: '💰 Change Payout (All)',
  change_payout_user: '👤 Change Payout (User)',
  send_warning: '⚠️ Send Warning',
  request_proof: '📸 Request Proof',
};

const ACTION_COLORS: Record<string, string> = {
  block_user: 'bg-red-100 text-red-800',
  unblock_user: 'bg-green-100 text-green-800',
  pause_offer: 'bg-yellow-100 text-yellow-800',
  change_payout_global: 'bg-blue-100 text-blue-800',
  change_payout_user: 'bg-purple-100 text-purple-800',
  send_warning: 'bg-orange-100 text-orange-800',
  request_proof: 'bg-cyan-100 text-cyan-800',
};

export function AdminActionsLog() {
  const [subTab, setSubTab] = useState('log');

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList>
          <TabsTrigger value="log" className="gap-1.5"><History className="h-3.5 w-3.5" />Action Log</TabsTrigger>
          <TabsTrigger value="blocked_users" className="gap-1.5"><Shield className="h-3.5 w-3.5" />Blocked Users</TabsTrigger>
          <TabsTrigger value="blocked_ips" className="gap-1.5"><Globe className="h-3.5 w-3.5" />Blocked IPs</TabsTrigger>
        </TabsList>
        <TabsContent value="log"><ActionLogSection /></TabsContent>
        <TabsContent value="blocked_users"><BlockedUsersSection /></TabsContent>
        <TabsContent value="blocked_ips"><BlockedIPsSection /></TabsContent>
      </Tabs>
    </div>
  );
}

function ActionLogSection() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState('all');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: '30' });
      if (filterType !== 'all') params.append('action_type', filterType);
      const res = await fetch(`${BASE}/api/admin/actions/log?${params}`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success) { setLogs(data.data || []); setTotal(data.total || 0); }
    } catch { toast.error('Failed to load action log'); }
    finally { setLoading(false); }
  }, [page, filterType]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="space-y-3">
      <Card className="p-3">
        <div className="flex items-center gap-3">
          <div><label className="text-xs font-medium">Filter</label><Select value={filterType} onValueChange={v => { setFilterType(v); setPage(1); }}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Actions</SelectItem><SelectItem value="block_user">Block User</SelectItem><SelectItem value="unblock_user">Unblock User</SelectItem><SelectItem value="pause_offer">Pause Offer</SelectItem><SelectItem value="change_payout_global">Change Payout (All)</SelectItem><SelectItem value="change_payout_user">Change Payout (User)</SelectItem><SelectItem value="send_warning">Send Warning</SelectItem><SelectItem value="request_proof">Request Proof</SelectItem></SelectContent></Select></div>
          <Button size="sm" onClick={fetchLogs} className="mt-4"><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
          <span className="text-xs text-muted-foreground mt-4">{total} total actions</span>
        </div>
      </Card>
      <Card>
        <div className="overflow-x-auto">
          {loading ? <div className="text-center py-8 text-muted-foreground">Loading...</div> : logs.length === 0 ? <div className="text-center py-8 text-muted-foreground">No actions recorded yet.</div> : (
            <Table>
              <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Action</TableHead><TableHead>Admin</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
              <TableBody>
                {logs.map((log, i) => (
                  <TableRow key={log._id || i}>
                    <TableCell className="text-xs whitespace-nowrap">{log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}</TableCell>
                    <TableCell><Badge className={`text-xs ${ACTION_COLORS[log.action_type] || 'bg-gray-100 text-gray-800'}`}>{ACTION_LABELS[log.action_type] || log.action_type}</Badge></TableCell>
                    <TableCell className="text-sm">{log.admin_username || '-'}</TableCell>
                    <TableCell className="text-xs max-w-[300px]">{log.details ? Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(' | ') : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        {total > 30 && (
          <div className="flex items-center justify-between p-3 border-t">
            <span className="text-xs text-muted-foreground">Page {page}</span>
            <div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={logs.length < 30} onClick={() => setPage(p => p + 1)}>Next</Button></div>
          </div>
        )}
      </Card>
    </div>
  );
}

function BlockedUsersSection() {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/admin/actions/blocked-users`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success) setUsers(data.data || []);
    } catch { toast.error('Failed to load blocked users'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleUnblock = async (userId: string) => {
    try {
      const res = await fetch(`${BASE}/api/admin/actions/unblock-user`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ user_id: userId }) });
      const data = await res.json();
      if (data.success) { toast.success(`User ${userId} unblocked`); fetchUsers(); }
      else toast.error(data.error || 'Failed');
    } catch { toast.error('Failed to unblock'); }
  };

  return (
    <div className="space-y-3">
      <Card className="p-3"><div className="flex items-center gap-3"><Button size="sm" onClick={fetchUsers}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button><span className="text-xs text-muted-foreground">{users.length} blocked users</span></div></Card>
      <Card>
        {loading ? <div className="text-center py-8 text-muted-foreground">Loading...</div> : users.length === 0 ? <div className="text-center py-8 text-muted-foreground">No blocked users.</div> : (
          <Table>
            <TableHeader><TableRow><TableHead>User ID</TableHead><TableHead>Reason</TableHead><TableHead>Blocked By</TableHead><TableHead>Blocked At</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {users.map((u, i) => (
                <TableRow key={u._id || i}>
                  <TableCell className="font-mono text-xs">{u.user_id}</TableCell>
                  <TableCell className="text-xs">{u.reason || '-'}</TableCell>
                  <TableCell className="text-sm">{u.blocked_by || '-'}</TableCell>
                  <TableCell className="text-xs">{u.blocked_at ? new Date(u.blocked_at).toLocaleString() : '-'}</TableCell>
                  <TableCell><Button variant="outline" size="sm" onClick={() => handleUnblock(u.user_id)} className="gap-1 text-green-600 border-green-300 hover:bg-green-50"><Unlock className="h-3 w-3" />Unblock</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function BlockedIPsSection() {
  const [loading, setLoading] = useState(false);
  const [ips, setIps] = useState<any[]>([]);

  const fetchIPs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/admin/fraud/blocked-ips`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success) setIps(data.data || []);
    } catch { toast.error('Failed to load blocked IPs'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchIPs(); }, [fetchIPs]);

  const handleUnblock = async (ip: string) => {
    try {
      const res = await fetch(`${BASE}/api/admin/fraud/unblock-ip`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ ip_address: ip }) });
      const data = await res.json();
      if (data.success) { toast.success(`IP ${ip} unblocked`); fetchIPs(); }
      else toast.error(data.error || 'Failed');
    } catch { toast.error('Failed to unblock IP'); }
  };

  return (
    <div className="space-y-3">
      <Card className="p-3"><div className="flex items-center gap-3"><Button size="sm" onClick={fetchIPs}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button><span className="text-xs text-muted-foreground">{ips.length} blocked IPs</span></div></Card>
      <Card>
        {loading ? <div className="text-center py-8 text-muted-foreground">Loading...</div> : ips.length === 0 ? <div className="text-center py-8 text-muted-foreground">No blocked IPs.</div> : (
          <Table>
            <TableHeader><TableRow><TableHead>IP Address</TableHead><TableHead>Reason</TableHead><TableHead>Blocked By</TableHead><TableHead>Blocked At</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {ips.map((ip, i) => (
                <TableRow key={ip._id || i}>
                  <TableCell className="font-mono text-sm">{ip.ip_address}</TableCell>
                  <TableCell className="text-xs">{ip.reason || '-'}</TableCell>
                  <TableCell className="text-sm">{ip.blocked_by || '-'}</TableCell>
                  <TableCell className="text-xs">{ip.blocked_at ? new Date(ip.blocked_at).toLocaleString() : '-'}</TableCell>
                  <TableCell><Button variant="outline" size="sm" onClick={() => handleUnblock(ip.ip_address)} className="gap-1 text-green-600 border-green-300 hover:bg-green-50"><Unlock className="h-3 w-3" />Unblock</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
