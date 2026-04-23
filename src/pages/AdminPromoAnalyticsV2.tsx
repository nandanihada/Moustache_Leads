import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { getApiBaseUrl } from '@/services/apiConfig';

export default function AdminPromoAnalyticsV2() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      // Use existing endpoint or simply query the database directly in a new quick endpoint
      const response = await fetch(`${getApiBaseUrl()}/api/admin/promo-analytics-v2/logs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'success') return <Badge className="bg-emerald-500">Success</Badge>;
    if (status === 'failed') return <Badge className="bg-rose-500">Failed</Badge>;
    return <Badge className="bg-blue-500">Opened UI</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Promo Analytics V2</h1>
          <p className="text-gray-600 mt-1">Real-time engagement tracker for direct promo code redemptions.</p>
        </div>
        <button onClick={fetchLogs} className="bg-white border rounded shadow-sm px-4 py-2 font-bold hover:bg-slate-50">
          Refresh Logs
        </button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Direct Redemption Event Stream</CardTitle>
          <CardDescription>Live feed of PROMO_TAB_OPENED, PROMO_REDEEM_SUCCESS, and PROMO_REDEEM_FAILED</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-10 text-center text-slate-500 font-bold">Loading stream...</div>
          ) : logs.length === 0 ? (
            <div className="p-10 text-center text-slate-500 font-bold">No analytics recorded yet. Tell a publisher to try a code!</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Event Type</TableHead>
                  <TableHead>User / Publisher</TableHead>
                  <TableHead>Promo Code Attempted</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Failure Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-xs">{new Date(log.timestamp).toLocaleString()}</TableCell>
                    <TableCell className="font-bold">{log.event_type}</TableCell>
                    <TableCell>{log.username || 'Unknown'}</TableCell>
                    <TableCell className="font-mono font-bold">{log.promo_code || '-'}</TableCell>
                    <TableCell>{getStatusBadge(log.status)}</TableCell>
                    <TableCell className="text-rose-600 font-medium text-xs">{log.failure_reason || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
