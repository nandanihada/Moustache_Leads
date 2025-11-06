import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { postbackLogsApi, PostbackLog, PostbackStats } from '@/services/postbackLogsApi';
import { partnerApi } from '@/services/partnerApi';
import { RefreshCw, Filter, CheckCircle, XCircle, Loader2, Eye, RotateCcw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const PostbackLogs: React.FC = () => {
  const { toast } = useToast();
  const [logs, setLogs] = useState<PostbackLog[]>([]);
  const [forwardedLogs, setForwardedLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<PostbackStats | null>(null);
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [forwardedLoading, setForwardedLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [forwardedPage, setForwardedPage] = useState(1);
  const [forwardedTotalPages, setForwardedTotalPages] = useState(1);
  const [selectedLog, setSelectedLog] = useState<PostbackLog | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [activeTab, setActiveTab] = useState('received');
  
  // Filters
  const [filters, setFilters] = useState({
    status: 'all',
    partner_id: 'all',
    date_from: '',
    date_to: ''
  });

  const fetchLogs = async () => {
    try {
      setLoading(true);
      // Convert 'all' to empty string for API
      const apiFilters = {
        status: filters.status === 'all' ? '' : filters.status,
        partner_id: filters.partner_id === 'all' ? '' : filters.partner_id,
        date_from: filters.date_from,
        date_to: filters.date_to
      };
      const data = await postbackLogsApi.getPostbackLogs({
        page,
        limit: 20,
        ...apiFilters
      });
      setLogs(data.logs);
      setTotalPages(data.pages);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.error || 'Failed to fetch postback logs',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const data = await postbackLogsApi.getPostbackStats({
        date_from: filters.date_from,
        date_to: filters.date_to
      });
      setStats(data);
    } catch (error: any) {
      console.error('Error fetching stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchPartners = async () => {
    try {
      const data = await partnerApi.getPartners();
      setPartners(data.partners);
    } catch (error) {
      console.error('Error fetching partners:', error);
    }
  };

  const fetchForwardedLogs = async () => {
    try {
      setForwardedLoading(true);
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const token = localStorage.getItem('token');
      
      const params = new URLSearchParams({
        page: forwardedPage.toString(),
        limit: '20',
        hours: '168' // Last 7 days
      });
      
      const response = await fetch(`${API_URL}/api/admin/partner-distribution-logs?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch forwarded logs');
      }
      
      const data = await response.json();
      setForwardedLogs(data.logs || []);
      setForwardedTotalPages(data.pages || 1);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch forwarded postback logs',
        variant: 'destructive'
      });
    } finally {
      setForwardedLoading(false);
    }
  };

  const handleRetry = async (log: PostbackLog) => {
    try {
      await postbackLogsApi.retryPostback(log.log_id);
      toast({
        title: 'Success',
        description: 'Postback queued for retry'
      });
      fetchLogs();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.error || 'Failed to retry postback',
        variant: 'destructive'
      });
    }
  };

  const viewDetails = (log: PostbackLog) => {
    setSelectedLog(log);
    setIsDetailsModalOpen(true);
  };

  const resetFilters = () => {
    setFilters({
      status: 'all',
      partner_id: 'all',
      date_from: '',
      date_to: ''
    });
    setPage(1);
    setForwardedPage(1);
  };

  // useEffects - run after functions are defined
  useEffect(() => {
    if (activeTab === 'received') {
      fetchLogs();
      fetchStats();
    } else {
      fetchForwardedLogs();
    }
    fetchPartners();
  }, [page, forwardedPage, filters, activeTab]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        if (activeTab === 'received') {
          fetchLogs();
          fetchStats();
        } else {
          fetchForwardedLogs();
        }
      }, 30000); // Refresh every 30 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, page, forwardedPage, filters, activeTab]);

  const getStatusBadge = (status: string) => {
    if (status === 'success') {
      return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Success</Badge>;
    }
    return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
  };

  const getMethodBadge = (method: string) => {
    return <Badge variant={method === 'GET' ? 'default' : 'secondary'}>{method}</Badge>;
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Postback Logs</h1>
          <p className="text-gray-600 mt-1">Monitor postback delivery status and performance</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto-Refresh On' : 'Auto-Refresh Off'}
          </Button>
          <Button onClick={() => { 
            if (activeTab === 'received') {
              fetchLogs(); 
              fetchStats(); 
            } else {
              fetchForwardedLogs();
            }
          }}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {statsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="text-sm text-gray-600 mb-1">Total Sent</div>
              <div className="text-3xl font-bold text-green-600">{stats.total_sent}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-sm text-gray-600 mb-1">Total Failed</div>
              <div className="text-3xl font-bold text-red-600">{stats.total_failed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-sm text-gray-600 mb-1">Success Rate</div>
              <div className="text-3xl font-bold text-blue-600">{stats.success_rate}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-sm text-gray-600 mb-1">Total Attempts</div>
              <div className="text-3xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Tabs for Received vs Forwarded */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="received">Received Postbacks</TabsTrigger>
          <TabsTrigger value="forwarded">Forwarded to Partners</TabsTrigger>
        </TabsList>

        <TabsContent value="received">
      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="mr-2 h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Status</Label>
              <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Partner</Label>
              <Select value={filters.partner_id} onValueChange={(value) => setFilters({ ...filters, partner_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="All partners" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {partners.map((partner) => (
                    <SelectItem key={partner.partner_id} value={partner.partner_id}>
                      {partner.partner_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Date From</Label>
              <Input
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
              />
            </div>

            <div>
              <Label>Date To</Label>
              <Input
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-4">
            <Button variant="outline" onClick={resetFilters}>
              Reset Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Postback Logs</CardTitle>
          <CardDescription>Detailed postback delivery logs</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Partner</TableHead>
                    <TableHead>Offer ID</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Response</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-gray-500">
                        No postback logs found
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.log_id}>
                        <TableCell>
                          {new Date(log.sent_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-medium">{log.partner_name || 'N/A'}</TableCell>
                        <TableCell className="font-mono text-sm">{log.offer_id}</TableCell>
                        <TableCell>{getMethodBadge(log.method)}</TableCell>
                        <TableCell>{getStatusBadge(log.status)}</TableCell>
                        <TableCell>
                          <Badge variant={log.response_code === 200 ? 'default' : 'secondary'}>
                            {log.response_code}
                          </Badge>
                        </TableCell>
                        <TableCell>{log.attempts}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => viewDetails(log)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {log.status === 'failed' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRetry(log)}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="forwarded">
          <Card>
            <CardHeader>
              <CardTitle>Forwarded Postbacks</CardTitle>
              <CardDescription>Postbacks sent to your partners</CardDescription>
            </CardHeader>
            <CardContent>
              {forwardedLoading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : forwardedLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No forwarded postbacks found
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Partner</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Status Code</TableHead>
                        <TableHead>Response Time</TableHead>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {forwardedLogs.map((log: any) => (
                        <TableRow key={log._id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{log.partner_name}</div>
                              <div className="text-xs text-gray-500">{log.partner_email}</div>
                            </div>
                          </TableCell>
                          <TableCell>{getMethodBadge(log.method)}</TableCell>
                          <TableCell>
                            {log.success ? (
                              <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Success</Badge>
                            ) : (
                              <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>
                            )}
                          </TableCell>
                          <TableCell>{log.status_code || 'N/A'}</TableCell>
                          <TableCell>{log.response_time ? `${log.response_time.toFixed(2)}s` : 'N/A'}</TableCell>
                          <TableCell>
                            {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedLog(log as any);
                                setIsDetailsModalOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {forwardedTotalPages > 1 && (
                    <div className="flex justify-center items-center gap-2 mt-4">
                      <Button
                        variant="outline"
                        onClick={() => setForwardedPage(Math.max(1, forwardedPage - 1))}
                        disabled={forwardedPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm">
                        Page {forwardedPage} of {forwardedTotalPages}
                      </span>
                      <Button
                        variant="outline"
                        onClick={() => setForwardedPage(Math.min(forwardedTotalPages, forwardedPage + 1))}
                        disabled={forwardedPage === forwardedTotalPages}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Details Modal */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Postback Log Details</DialogTitle>
            <DialogDescription>
              Detailed information about this postback attempt
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Log ID</Label>
                  <Input value={selectedLog.log_id} readOnly className="font-mono text-sm" />
                </div>
                <div>
                  <Label>Postback ID</Label>
                  <Input value={selectedLog.postback_id} readOnly className="font-mono text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Partner</Label>
                  <Input value={selectedLog.partner_name || 'N/A'} readOnly />
                </div>
                <div>
                  <Label>Offer ID</Label>
                  <Input value={selectedLog.offer_id} readOnly className="font-mono text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Conversion ID</Label>
                  <Input value={selectedLog.conversion_id} readOnly className="font-mono text-sm" />
                </div>
                <div>
                  <Label>Method</Label>
                  <div className="mt-2">{getMethodBadge(selectedLog.method)}</div>
                </div>
              </div>

              <div>
                <Label>URL</Label>
                <Textarea value={selectedLog.url} readOnly rows={3} className="font-mono text-sm" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Status</Label>
                  <div className="mt-2">{getStatusBadge(selectedLog.status)}</div>
                </div>
                <div>
                  <Label>Response Code</Label>
                  <div className="mt-2">
                    <Badge variant={selectedLog.response_code === 200 ? 'default' : 'secondary'}>
                      {selectedLog.response_code}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label>Attempts</Label>
                  <Input value={selectedLog.attempts} readOnly />
                </div>
              </div>

              {selectedLog.error_message && (
                <div>
                  <Label>Error Message</Label>
                  <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm mt-2">
                    {selectedLog.error_message}
                  </div>
                </div>
              )}

              <div>
                <Label>Response Body</Label>
                <Textarea 
                  value={selectedLog.response_body || 'No response body'} 
                  readOnly 
                  rows={6} 
                  className="font-mono text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Sent At</Label>
                  <Input value={new Date(selectedLog.sent_at).toLocaleString()} readOnly />
                </div>
                <div>
                  <Label>Created At</Label>
                  <Input value={new Date(selectedLog.created_at).toLocaleString()} readOnly />
                </div>
              </div>

              {selectedLog.status === 'failed' && (
                <div className="flex justify-end">
                  <Button onClick={() => {
                    handleRetry(selectedLog);
                    setIsDetailsModalOpen(false);
                  }}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Retry Postback
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PostbackLogs;
