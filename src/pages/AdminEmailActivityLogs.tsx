import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Mail, Clock, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import { API_BASE_URL } from '../services/apiConfig';
import { AdminPageGuard } from '@/components/AdminPageGuard';

interface EmailLog {
  _id: string;
  action: string;
  source: string;
  offer_ids: string[];
  offer_names: string[];
  offer_count: number;
  recipient_type: string;
  recipient_count: number;
  batch_count: number;
  offers_per_email: number;
  scheduled_time?: string | null;
  admin_id: string;
  admin_username: string;
  created_at: string;
}

const AdminEmailActivityLogs: React.FC = () => {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ page: page.toString(), per_page: '20' });
      if (sourceFilter) params.set('source', sourceFilter);

      const res = await fetch(`${API_BASE_URL}/api/admin/offers/email-activity-logs?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setTotalPages(data.pages || 1);
    } catch {
      toast.error('Failed to load email activity logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, [page, sourceFilter]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'bulk_upload': return <Badge variant="outline" className="text-blue-600 border-blue-600">Bulk Upload</Badge>;
      case 'api_import': return <Badge variant="outline" className="text-purple-600 border-purple-600">API Import</Badge>;
      case 'single_offer': return <Badge variant="outline" className="text-green-600 border-green-600">Single Offer</Badge>;
      case 'support_reply': return <Badge variant="outline" className="text-orange-600 border-orange-600">Support Reply</Badge>;
      case 'support_broadcast': return <Badge variant="outline" className="text-pink-600 border-pink-600">Support Broadcast</Badge>;
      default: return <Badge variant="outline">{source}</Badge>;
    }
  };

  const getActionIcon = (action: string) => {
    if (action === 'scheduled') return <Clock className="w-4 h-4 text-yellow-600" />;
    return <Send className="w-4 h-4 text-green-600" />;
  };

  const getRecipientLabel = (type: string) => {
    switch (type) {
      case 'all_publishers': return '👥 All Publishers';
      case 'active_publishers': return '✅ Active Only';
      case 'specific_users': return '🎯 Specific Users';
      case 'all_users': return '👥 All Users';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Mail className="h-7 w-7" /> Email Activity Logs
        </h1>
        <p className="text-muted-foreground">Track all email activity across the platform</p>
      </div>

      <div className="flex items-center gap-3">
        <Select value={sourceFilter || 'all-sources'} onValueChange={(v) => { setSourceFilter(v === 'all-sources' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-sources">All Sources</SelectItem>
            <SelectItem value="single_offer">Single Offer</SelectItem>
            <SelectItem value="bulk_upload">Bulk Upload</SelectItem>
            <SelectItem value="api_import">API Import</SelectItem>
            <SelectItem value="support_reply">Support Reply</SelectItem>
            <SelectItem value="support_broadcast">Support Broadcast</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{total} log(s)</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Activity History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No email activity logs found</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Offers</TableHead>
                    <TableHead>Recipients</TableHead>
                    <TableHead>Batches</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Scheduled For</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log._id}>
                      <TableCell className="text-sm whitespace-nowrap">{formatDate(log.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {getActionIcon(log.action)}
                          <span className="capitalize text-sm">{log.action}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getSourceLabel(log.source)}</TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{log.offer_count}</span>
                          <div className="text-xs text-muted-foreground max-w-[200px] truncate" title={log.offer_names?.join(', ')}>
                            {log.offer_names?.slice(0, 3).join(', ')}
                            {(log.offer_names?.length || 0) > 3 && ` +${log.offer_names.length - 3} more`}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{log.recipient_count}</span>
                          <div className="text-xs text-muted-foreground">{getRecipientLabel(log.recipient_type)}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{log.batch_count}</TableCell>
                      <TableCell className="text-sm">{log.admin_username}</TableCell>
                      <TableCell className="text-sm">
                        {log.scheduled_time ? formatDate(log.scheduled_time) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">Page {page} of {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const AdminEmailActivityLogsWithGuard = () => (
  <AdminPageGuard requiredTab="offers">
    <AdminEmailActivityLogs />
  </AdminPageGuard>
);

export default AdminEmailActivityLogsWithGuard;
