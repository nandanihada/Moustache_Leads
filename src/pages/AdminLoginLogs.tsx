import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, XCircle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import loginLogsService, { LoginLog, PageVisit } from '@/services/loginLogsService';
import { useToast } from '@/hooks/use-toast';

const AdminLoginLogs: React.FC = () => {
    const [logs, setLogs] = useState<LoginLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [pageVisits, setPageVisits] = useState<Record<string, PageVisit[]>>({});
    const [loadingVisits, setLoadingVisits] = useState<Set<string>>(new Set());
    const { toast } = useToast();

    const loadLogs = async () => {
        try {
            setLoading(true);
            const response = await loginLogsService.getLoginLogs({ page: 1, limit: 100 });
            setLogs(response.logs);
            setTotal(response.total);
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.response?.data?.error || 'Failed to load login logs',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLogs();
    }, []);

    const toggleRow = async (logId: string, sessionId: string | undefined) => {
        const newExpanded = new Set(expandedRows);

        if (expandedRows.has(logId)) {
            newExpanded.delete(logId);
            setExpandedRows(newExpanded);
        } else {
            newExpanded.add(logId);
            setExpandedRows(newExpanded);

            if (sessionId && !pageVisits[sessionId]) {
                await loadPageVisits(sessionId);
            }
        }
    };

    const loadPageVisits = async (sessionId: string) => {
        try {
            setLoadingVisits(new Set(loadingVisits).add(sessionId));
            const response = await loginLogsService.getPageVisits(sessionId, 10);
            setPageVisits({ ...pageVisits, [sessionId]: response.visits });
        } catch (error: any) {
            toast({
                title: 'Error',
                description: 'Failed to load page visits',
                variant: 'destructive',
            });
        } finally {
            const newLoading = new Set(loadingVisits);
            newLoading.delete(sessionId);
            setLoadingVisits(newLoading);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-IN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata'
        }) + ' IST';
    };

    const formatTimeAgo = (dateString: string) => {
        const now = new Date().getTime();
        const then = new Date(dateString).getTime();
        const diff = now - then;

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Login Logs</h1>
                    <p className="text-muted-foreground">Track and monitor all login attempts with page visit history</p>
                </div>
                <Button onClick={loadLogs} variant="outline" disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Logs</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{total}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Successful</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {logs.filter(l => l.status === 'success').length}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                            {logs.filter(l => l.status === 'failed').length}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {logs.length > 0 ? Math.round((logs.filter(l => l.status === 'success').length / logs.length) * 100) : 0}%
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Login Attempts ({total} total)</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">No login logs found</div>
                    ) : (
                        <div className="space-y-4">
                            {logs.map((log) => (
                                <div key={log._id}>
                                    <div className="border rounded-lg p-4 hover:bg-muted/50">
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-2 flex-1">
                                                <div className="flex items-center gap-3">
                                                    {log.status === 'success' ? (
                                                        <Badge className="bg-green-500">
                                                            <CheckCircle className="h-3 w-3 mr-1" />
                                                            Success
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="destructive">
                                                            <XCircle className="h-3 w-3 mr-1" />
                                                            Failed
                                                        </Badge>
                                                    )}
                                                    <span className="font-semibold">{log.username}</span>
                                                    <span className="text-sm text-muted-foreground">{log.email}</span>
                                                </div>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                    <div>
                                                        <div className="text-muted-foreground">Login Time</div>
                                                        <div className="font-medium">{formatDate(log.login_time)}</div>
                                                    </div>
                                                    {log.logout_time && (
                                                        <div>
                                                            <div className="text-muted-foreground">Logout Time</div>
                                                            <div className="font-medium">{formatDate(log.logout_time)}</div>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="text-muted-foreground">IP Address</div>
                                                        <div className="font-mono text-xs">{log.ip_address}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-muted-foreground">Location</div>
                                                        <div>{log.location.city}, {log.location.country}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-muted-foreground">Device</div>
                                                        <div>{log.device.type} - {log.device.os}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-muted-foreground">Browser</div>
                                                        <div>{log.device.browser}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-muted-foreground">Method</div>
                                                        <div className="uppercase">{log.login_method}</div>
                                                    </div>
                                                    {log.failure_reason && (
                                                        <div>
                                                            <div className="text-muted-foreground">Failure Reason</div>
                                                            <div className="text-red-600">{log.failure_reason.replace(/_/g, ' ')}</div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {log.session_id && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => toggleRow(log._id, log.session_id)}
                                                >
                                                    {expandedRows.has(log._id) ? (
                                                        <ChevronUp className="h-4 w-4" />
                                                    ) : (
                                                        <ChevronDown className="h-4 w-4" />
                                                    )}
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Expanded - Last 10 Pages Visited */}
                                    {expandedRows.has(log._id) && log.session_id && (
                                        <div className="mt-2 ml-4 p-4 bg-muted/30 rounded-lg border">
                                            <h4 className="font-semibold mb-3 flex items-center gap-2">
                                                <ExternalLink className="h-4 w-4" />
                                                Last 10 Pages Visited
                                                {loadingVisits.has(log.session_id) && (
                                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                                )}
                                            </h4>

                                            {pageVisits[log.session_id] && pageVisits[log.session_id].length > 0 ? (
                                                <div className="space-y-2">
                                                    {pageVisits[log.session_id].map((visit, idx) => (
                                                        <div key={visit._id} className="p-3 bg-background rounded border text-sm">
                                                            <div className="flex justify-between items-start">
                                                                <div className="flex-1">
                                                                    <div className="font-medium">#{idx + 1} {visit.page_title || visit.page_url}</div>
                                                                    <div className="text-xs text-muted-foreground">{visit.page_url}</div>
                                                                    {visit.referrer && (
                                                                        <div className="text-xs text-muted-foreground">From: {visit.referrer}</div>
                                                                    )}
                                                                </div>
                                                                <div className="text-right">
                                                                    <div className="text-sm font-medium">{formatTimeAgo(visit.timestamp)}</div>
                                                                    <div className="text-xs text-muted-foreground">{formatDate(visit.timestamp)}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center py-4 text-muted-foreground">
                                                    No page visits recorded for this session
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default AdminLoginLogs;
