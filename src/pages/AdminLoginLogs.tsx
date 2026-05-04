import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, XCircle, ChevronDown, ChevronUp, ExternalLink, Shield, AlertTriangle, Mail } from 'lucide-react';
import loginLogsService, { LoginLog, PageVisit } from '@/services/loginLogsService';
import { useToast } from '@/hooks/use-toast';
import { FraudIndicators } from '@/components/FraudIndicators';
import { AdminPageGuard } from '@/components/AdminPageGuard';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';


const AdminLoginLogs: React.FC = () => {
    const [logs, setLogs] = useState<LoginLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [pageVisits, setPageVisits] = useState<Record<string, PageVisit[]>>({});
    const [loadingVisits, setLoadingVisits] = useState<Set<string>>(new Set());
    const [searchLogs, setSearchLogs] = useState<Record<string, any[]>>({});
    const [loadingSearch, setLoadingSearch] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState<Record<string, string>>({});
    
    // Mail State
    const [mailConfig, setMailConfig] = useState({ to: '', subject: '', body: '', isScheduled: false, scheduledTime: '', promoCode: '', promoType: '15% Bonus', usePromo: false });
    const [sendingMail, setSendingMail] = useState(false);
    
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

    const handleSendMail = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!mailConfig.to || !mailConfig.subject || !mailConfig.body) {
            toast({ title: 'Error', description: 'Please fill all required fields', variant: 'destructive' });
            return;
        }
        
        try {
            setSendingMail(true);
            const toList = mailConfig.to.split(',').map(e => e.trim()).filter(e => e);
            let finalBody = mailConfig.body;
            if (mailConfig.usePromo && mailConfig.promoCode) {
                finalBody += `\n\nYour exclusive promo code: ${mailConfig.promoCode} (${mailConfig.promoType})`;
            }
            
            await loginLogsService.sendCustomMail(
                toList,
                mailConfig.subject,
                finalBody.replace(/\n/g, '<br/>'),
                mailConfig.isScheduled && mailConfig.scheduledTime ? new Date(mailConfig.scheduledTime).toISOString() : undefined
            );
            toast({ title: 'Success', description: 'Mail executed successfully!' });
            setMailConfig({ to: '', subject: '', body: '', isScheduled: false, scheduledTime: '', promoCode: '', promoType: '15% Bonus', usePromo: false });
        } catch (error: any) {
            toast({ title: 'Error', description: error.response?.data?.error || 'Failed to send mail', variant: 'destructive' });
        } finally {
            setSendingMail(false);
        }
    };

    const prefillMailForRegion = (region: string, emails: string[]) => {
        setMailConfig(prev => ({
            ...prev,
            to: emails.join(', '),
            subject: `Top offers for you - ${region} special`,
            body: `Hi,\n\nWe've selected top-performing offers available in ${region} right now. Use the promo code below for an exclusive regional bonus...\n\nBest,\nThe Team`,
            promoCode: 'REGION15'
        }));
        
        // Scroll to the "Recent Login Attempts" top which has the mail form
        document.getElementById('mail-compose-box')?.scrollIntoView({ behavior: 'smooth' });
    };

    const prefillMailForUser = (user: LoginLog) => {
        setActiveTab(prev => ({ ...prev, [user._id]: 'mail' }));
        setMailConfig(prev => ({
            ...prev,
            to: user.email,
            subject: `Special offers based on your recent activity`,
            body: `Hi ${user.username},\n\nBased on your recent browsing, we handpicked these offers just for you. Use the promo below for an exclusive bonus...\n\nBest,\nThe Team`,
            promoCode: `${user.username.toUpperCase()}20`
        }));
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
                loadPageVisits(sessionId);
            }
            if (!searchLogs[logId]) {
                const log = logs.find(l => l._id === logId);
                if (log?.user_id) {
                    loadSearchLogs(logId, log.user_id);
                }
            }
            if (!activeTab[logId]) {
                setActiveTab(prev => ({ ...prev, [logId]: 'pages' }));
            }
        }
    };

    const loadPageVisits = async (sessionId: string) => {
        try {
            setLoadingVisits(new Set(loadingVisits).add(sessionId));
            const response = await loginLogsService.getPageVisits(sessionId, 50);
            setPageVisits(prev => ({ ...prev, [sessionId]: response.visits }));
        } catch (error: any) {
            toast({
                title: 'Error',
                description: 'Failed to load page visits',
                variant: 'destructive',
            });
        } finally {
            setLoadingVisits(prev => {
                const newLoading = new Set(prev);
                newLoading.delete(sessionId);
                return newLoading;
            });
        }
    };

    const loadSearchLogs = async (logId: string, userId: string) => {
        try {
            setLoadingSearch(new Set(loadingSearch).add(logId));
            // Custom fetch using the generic api instance or fetch directly
            const token = localStorage.getItem('token');
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/search-logs?user=${userId}&per_page=10`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setSearchLogs(prev => ({ ...prev, [logId]: data.logs }));
            }
        } catch (error) {
            console.error('Failed to load search logs', error);
        } finally {
            setLoadingSearch(prev => {
                const newLoading = new Set(prev);
                newLoading.delete(logId);
                return newLoading;
            });
        }
    };

    const formatDate = (dateString: string, timezone?: string) => {
        const date = new Date(dateString);
        // Always display in IST for Indian users
        const displayTimezone = 'Asia/Kolkata';

        try {
            const formatted = date.toLocaleString('en-IN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
                timeZone: displayTimezone
            });

            return `${formatted} IST`;
        } catch (error) {
            // Fallback to UTC if there's an error
            return date.toLocaleString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
                timeZone: 'UTC'
            }) + ' (UTC)';
        }
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
        <div className="space-y-6">
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
            
            {/* Geo Intelligence & Bulk Mail */}
            <Card id="mail-compose-box" className="border-border">
                <CardHeader className="bg-card pb-4 border-b">
                     <div className="flex justify-between items-center flex-wrap gap-4">
                        <CardTitle className="text-md flex items-center gap-2">
                           🌍 Geo Intelligence — Active Regions & Mailing
                        </CardTitle>
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => prefillMailForRegion('All Regions', logs.map(l => l.email))}>
                                Mail All Regions
                            </Button>
                        </div>
                     </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="grid grid-cols-1 md:grid-cols-2">
                        <div className="p-4 border-r">
                            <div className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider">Active By Region</div>
                            <div className="space-y-3">
                                {Object.entries(logs.reduce((acc, log) => {
                                    const country = log.location?.country || 'Unknown';
                                    if (!acc[country]) acc[country] = { count: 0, emails: new Set<string>() };
                                    acc[country].count++;
                                    acc[country].emails.add(log.email);
                                    return acc;
                                }, {} as Record<string, {count: number, emails: Set<string>}>))
                                .sort((a, b) => b[1].count - a[1].count).slice(0, 5)
                                .map(([country, data]) => (
                                    <div key={country} className="flex items-center justify-between p-2 rounded hover:bg-muted/50 border border-transparent hover:border-border transition-colors">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-sm">{country}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="bg-primary/10 text-primary font-mono text-xs px-2 py-0.5 rounded">{data.count}</div>
                                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => prefillMailForRegion(country, Array.from(data.emails))}>
                                                Mail All ↗
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="p-4 bg-muted/20">
                            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <Mail className="h-4 w-4" /> Mail Compose
                            </h4>
                            <div className="space-y-3">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-muted-foreground font-mono">To (comma separated)</label>
                                    <Input value={mailConfig.to} onChange={e => setMailConfig({...mailConfig, to: e.target.value})} placeholder="emails..." className="h-8 text-sm" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-muted-foreground font-mono">Subject</label>
                                    <Input value={mailConfig.subject} onChange={e => setMailConfig({...mailConfig, subject: e.target.value})} placeholder="Subject..." className="h-8 text-sm" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-muted-foreground font-mono">Body</label>
                                    <Textarea value={mailConfig.body} onChange={e => setMailConfig({...mailConfig, body: e.target.value})} className="min-h-[100px] text-sm" />
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    <Checkbox id="promo-geo" checked={mailConfig.usePromo} onCheckedChange={(c) => setMailConfig({...mailConfig, usePromo: !!c})} />
                                    <label htmlFor="promo-geo" className="text-xs cursor-pointer">Include regional promo code</label>
                                </div>
                                {mailConfig.usePromo && (
                                    <div className="flex items-center gap-2 p-2 bg-background border rounded-md">
                                        <Input className="h-8 w-32 text-sm" value={mailConfig.promoCode} onChange={(e) => setMailConfig({...mailConfig, promoCode: e.target.value})} placeholder="PROMO15" />
                                        <Select value={mailConfig.promoType} onValueChange={(v) => setMailConfig({...mailConfig, promoType: v})}>
                                            <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="15% Bonus">15% Bonus</SelectItem>
                                                <SelectItem value="10% Bonus">10% Bonus</SelectItem>
                                                <SelectItem value="Fixed $5">Fixed $5</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                <div className="flex items-center justify-between pt-3 border-t mt-2">
                                    <div className="flex items-center gap-2">
                                        <Select value={mailConfig.isScheduled ? 'Schedule' : 'Send Now'} onValueChange={(v) => setMailConfig({...mailConfig, isScheduled: v === 'Schedule'})}>
                                            <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Send Now">Send Now</SelectItem>
                                                <SelectItem value="Schedule">Schedule</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {mailConfig.isScheduled && (
                                            <Input type="datetime-local" className="h-8 w-44 text-xs" value={mailConfig.scheduledTime} onChange={(e) => setMailConfig({...mailConfig, scheduledTime: e.target.value})} />
                                        )}
                                    </div>
                                    <Button size="sm" onClick={handleSendMail} disabled={sendingMail || !mailConfig.to}>
                                        {sendingMail ? 'Sending...' : 'Send Mail ↗'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

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

                                                {/* Fraud Indicators */}
                                                <FraudIndicators
                                                    vpnDetection={log.vpn_detection}
                                                    deviceChange={log.device_change_detected}
                                                    sessionFrequency={log.session_frequency}
                                                    fraudScore={log.fraud_score}
                                                    riskLevel={log.risk_level}
                                                />

                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                    <div>
                                                        <div className="text-muted-foreground">Login Time</div>
                                                        <div className="font-medium">{formatDate(log.login_time, log.location?.timezone)}</div>
                                                    </div>
                                                    {log.logout_time && (
                                                        <div>
                                                            <div className="text-muted-foreground">Logout Time</div>
                                                            <div className="font-medium">{formatDate(log.logout_time, log.location?.timezone)}</div>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="text-muted-foreground">IP Address</div>
                                                        <div className="font-mono text-xs">{log.ip_address}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-muted-foreground">Location</div>
                                                        <div>
                                                            {log.location.city}
                                                            {log.location.region && log.location.region !== 'Unknown' && `, ${log.location.region}`}
                                                            {`, ${log.location.country}`}
                                                        </div>
                                                    </div>
                                                    {log.location.isp && (
                                                        <div>
                                                            <div className="text-muted-foreground">ISP</div>
                                                            <div className="text-sm">{log.location.isp}</div>
                                                        </div>
                                                    )}
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

                                    {/* Expanded - Activity Logs */}
                                    {expandedRows.has(log._id) && log.session_id && (
                                        <div className="mt-2 ml-4 p-4 bg-muted/30 rounded-lg border">
                                                    <div className="flex border-b mb-4">
                                                <button 
                                                    className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab[log._id] === 'pages' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
                                                    onClick={() => setActiveTab(prev => ({ ...prev, [log._id]: 'pages' }))}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <ExternalLink className="h-4 w-4" />
                                                        Page Visits
                                                        {loadingVisits.has(log.session_id!) && <RefreshCw className="h-3 w-3 animate-spin" />}
                                                    </div>
                                                </button>
                                                <button 
                                                    className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab[log._id] === 'offers' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
                                                    onClick={() => setActiveTab(prev => ({ ...prev, [log._id]: 'offers' }))}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        Offer Views
                                                    </div>
                                                </button>
                                                <button 
                                                    className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab[log._id] === 'searches' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
                                                    onClick={() => setActiveTab(prev => ({ ...prev, [log._id]: 'searches' }))}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        Search Logs
                                                        {loadingSearch.has(log._id) && <RefreshCw className="h-3 w-3 animate-spin" />}
                                                    </div>
                                                </button>
                                                <button 
                                                    className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab[log._id] === 'mail' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
                                                    onClick={() => prefillMailForUser(log)}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Mail className="h-4 w-4" />
                                                        Mail / Promo
                                                    </div>
                                                </button>
                                            </div>

                                            {activeTab[log._id] === 'pages' && (
                                                <>
                                                {pageVisits[log.session_id] && pageVisits[log.session_id].length > 0 ? (
                                                    <div className="space-y-2">
                                                        {pageVisits[log.session_id].slice(0, 10).map((visit, idx) => (
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
                                                                        <div className="text-xs text-muted-foreground">{formatDate(visit.timestamp, log.location?.timezone)}</div>
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
                                                </>
                                            )}

                                            {activeTab[log._id] === 'offers' && (
                                                <>
                                                {pageVisits[log.session_id] && pageVisits[log.session_id].filter(v => v.page_url.includes('offer') || v.page_title.toLowerCase().includes('offer')).length > 0 ? (
                                                    <div className="space-y-2">
                                                        {pageVisits[log.session_id].filter(v => v.page_url.includes('offer') || v.page_title.toLowerCase().includes('offer')).map((visit, idx) => (
                                                            <div key={visit._id} className="p-3 bg-background rounded border text-sm border-l-4 border-l-purple-500">
                                                                <div className="flex justify-between items-start">
                                                                    <div className="flex-1">
                                                                        <div className="font-semibold text-purple-700">Offer View: {visit.page_title || visit.page_url}</div>
                                                                        <div className="text-xs text-muted-foreground">{visit.page_url}</div>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <div className="text-sm font-medium">{formatTimeAgo(visit.timestamp)}</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-4 text-muted-foreground">
                                                        No offer views recorded for this session
                                                    </div>
                                                )}
                                                </>
                                            )}

                                            {activeTab[log._id] === 'searches' && (
                                                <>
                                                {searchLogs[log._id] && searchLogs[log._id].length > 0 ? (
                                                    <div className="space-y-2">
                                                        {searchLogs[log._id].map((searchItem, idx) => (
                                                            <div key={searchItem._id} className="p-3 bg-background rounded border text-sm border-l-4 border-l-blue-500">
                                                                <div className="flex justify-between items-start">
                                                                    <div className="flex-1">
                                                                        <div className="font-semibold text-blue-700">Keyword: "{searchItem.keyword}"</div>
                                                                        <div className="text-xs text-muted-foreground mt-1">
                                                                            Results: {searchItem.results_count} | 
                                                                            Status: {searchItem.inventory_status}
                                                                        </div>
                                                                        {searchItem.picked_offer && (
                                                                            <div className="text-xs text-green-600 mt-1 font-medium">✓ Clicked Offer: {searchItem.picked_offer}</div>
                                                                        )}
                                                                        {searchItem.clicked_tracking && (
                                                                            <div className="text-xs text-blue-600 font-medium">✓ Clicked Tracking Link</div>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <div className="text-sm font-medium">{formatTimeAgo(searchItem.searched_at)}</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-4 text-muted-foreground">
                                                        No search logs recorded for this user
                                                    </div>
                                                )}
                                                </>
                                            )}

                                            {activeTab[log._id] === 'mail' && (
                                                <div className="p-4 bg-background border rounded-lg shadow-sm">
                                                    <h4 className="font-semibold mb-3">✉ Compose Mail to {log.username}</h4>
                                                    <div className="space-y-3">
                                                        <div>
                                                            <label className="text-xs text-muted-foreground block mb-1">To</label>
                                                            <Input value={mailConfig.to} onChange={e => setMailConfig({...mailConfig, to: e.target.value})} className="h-8" />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs text-muted-foreground block mb-1">Subject</label>
                                                            <Input value={mailConfig.subject} onChange={e => setMailConfig({...mailConfig, subject: e.target.value})} className="h-8" />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs text-muted-foreground block mb-1">Body</label>
                                                            <Textarea value={mailConfig.body} onChange={e => setMailConfig({...mailConfig, body: e.target.value})} className="min-h-[100px]" />
                                                        </div>
                                                        <div className="flex items-center gap-2 pt-2">
                                                            <Checkbox id={`promo-${log._id}`} checked={mailConfig.usePromo} onCheckedChange={(c) => setMailConfig({...mailConfig, usePromo: !!c})} />
                                                            <label htmlFor={`promo-${log._id}`} className="text-sm cursor-pointer">Include promo code formatting</label>
                                                        </div>
                                                        {mailConfig.usePromo && (
                                                            <div className="flex gap-2">
                                                                <Input className="w-32 h-8" value={mailConfig.promoCode} onChange={(e) => setMailConfig({...mailConfig, promoCode: e.target.value})} placeholder="Promo Code" />
                                                                <Select value={mailConfig.promoType} onValueChange={(v) => setMailConfig({...mailConfig, promoType: v})}>
                                                                    <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="25% Bonus">25% Bonus</SelectItem>
                                                                        <SelectItem value="20% Bonus">20% Bonus</SelectItem>
                                                                        <SelectItem value="Fixed $10">Fixed $10</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        )}
                                                        <div className="flex justify-end gap-2 pt-4 border-t border-muted">
                                                            <Select value={mailConfig.isScheduled ? 'Schedule' : 'Send Now'} onValueChange={(v) => setMailConfig({...mailConfig, isScheduled: v === 'Schedule'})}>
                                                                <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="Send Now">Send Now</SelectItem>
                                                                    <SelectItem value="Schedule">Schedule</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            {mailConfig.isScheduled && (
                                                                <Input type="datetime-local" className="h-8 w-44 text-xs" value={mailConfig.scheduledTime} onChange={(e) => setMailConfig({...mailConfig, scheduledTime: e.target.value})} />
                                                            )}
                                                            <Button size="sm" onClick={handleSendMail} disabled={sendingMail || !mailConfig.to}>
                                                                {sendingMail ? 'Sending...' : 'Send Mail'}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Fraud Analysis Section */}
                                            {(log.fraud_score && log.fraud_score > 0) || log.fraud_flags?.length > 0 ? (
                                                <div className="mt-4">
                                                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                                                        <Shield className="h-4 w-4" />
                                                        Fraud Analysis
                                                    </h4>

                                                    <div className="space-y-3">
                                                        {/* Fraud Score */}
                                                        {log.fraud_score > 0 && (
                                                            <div className="p-3 bg-background rounded border">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-sm font-medium">Fraud Risk Score</span>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className={`w-3 h-3 rounded-full ${log.fraud_score >= 76 ? 'bg-red-500' :
                                                                            log.fraud_score >= 51 ? 'bg-orange-500' :
                                                                                log.fraud_score >= 26 ? 'bg-yellow-500' :
                                                                                    'bg-green-500'
                                                                            }`} />
                                                                        <span className="font-bold">{log.fraud_score}/100</span>
                                                                        <Badge variant={
                                                                            log.risk_level === 'critical' || log.risk_level === 'high' ? 'destructive' :
                                                                                log.risk_level === 'medium' ? 'default' :
                                                                                    'secondary'
                                                                        }>
                                                                            {log.risk_level?.toUpperCase()}
                                                                        </Badge>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Fraud Flags */}
                                                        {log.fraud_flags && log.fraud_flags.length > 0 && (
                                                            <div className="p-3 bg-background rounded border">
                                                                <div className="text-sm font-medium mb-2">Detected Issues</div>
                                                                <div className="space-y-1">
                                                                    {log.fraud_flags.map((flag, idx) => (
                                                                        <div key={idx} className="flex items-center gap-2 text-sm">
                                                                            <AlertTriangle className="h-3 w-3 text-orange-500" />
                                                                            <span>{flag}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* VPN Details */}
                                                        {log.vpn_detection && (log.vpn_detection.is_vpn || log.vpn_detection.is_proxy || log.vpn_detection.is_datacenter) && (
                                                            <div className="p-3 bg-background rounded border">
                                                                <div className="text-sm font-medium mb-2">Network Analysis</div>
                                                                <div className="grid grid-cols-2 gap-2 text-sm">
                                                                    {log.vpn_detection.is_vpn && (
                                                                        <div>
                                                                            <span className="text-muted-foreground">VPN:</span>
                                                                            <span className="ml-2 text-red-600 font-medium">Detected</span>
                                                                        </div>
                                                                    )}
                                                                    {log.vpn_detection.is_proxy && (
                                                                        <div>
                                                                            <span className="text-muted-foreground">Proxy:</span>
                                                                            <span className="ml-2 text-red-600 font-medium">Detected</span>
                                                                        </div>
                                                                    )}
                                                                    {log.vpn_detection.is_datacenter && (
                                                                        <div>
                                                                            <span className="text-muted-foreground">Datacenter IP:</span>
                                                                            <span className="ml-2 text-orange-600 font-medium">Yes</span>
                                                                        </div>
                                                                    )}
                                                                    {log.vpn_detection.provider && (
                                                                        <div>
                                                                            <span className="text-muted-foreground">Provider:</span>
                                                                            <span className="ml-2 font-medium">{log.vpn_detection.provider}</span>
                                                                        </div>
                                                                    )}
                                                                    {log.vpn_detection.confidence && (
                                                                        <div>
                                                                            <span className="text-muted-foreground">Confidence:</span>
                                                                            <span className="ml-2 font-medium capitalize">{log.vpn_detection.confidence}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Device Fingerprint */}
                                                        {log.device_fingerprint && (
                                                            <div className="p-3 bg-background rounded border">
                                                                <div className="text-sm font-medium mb-2">Device Information</div>
                                                                <div className="space-y-1 text-sm">
                                                                    <div>
                                                                        <span className="text-muted-foreground">Fingerprint:</span>
                                                                        <span className="ml-2 font-mono text-xs">{log.device_fingerprint}</span>
                                                                    </div>
                                                                    {log.device_change_detected && (
                                                                        <div className="flex items-center gap-2 text-yellow-600">
                                                                            <AlertTriangle className="h-3 w-3" />
                                                                            <span>New device detected for this user</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Session Frequency */}
                                                        {log.session_frequency && log.session_frequency.logins_last_hour > 0 && (
                                                            <div className="p-3 bg-background rounded border">
                                                                <div className="text-sm font-medium mb-2">Login Frequency</div>
                                                                <div className="grid grid-cols-2 gap-2 text-sm">
                                                                    <div>
                                                                        <span className="text-muted-foreground">Last Hour:</span>
                                                                        <span className="ml-2 font-medium">{log.session_frequency.logins_last_hour} logins</span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-muted-foreground">Last 24h:</span>
                                                                        <span className="ml-2 font-medium">{log.session_frequency.logins_last_day} logins</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Recommendations */}
                                                        {log.fraud_recommendations && log.fraud_recommendations.length > 0 && (
                                                            <div className="p-3 bg-background rounded border">
                                                                <div className="text-sm font-medium mb-2">Recommended Actions</div>
                                                                <div className="space-y-1">
                                                                    {log.fraud_recommendations.map((rec, idx) => (
                                                                        <div key={idx} className="flex items-start gap-2 text-sm">
                                                                            <span className="text-blue-600">•</span>
                                                                            <span>{rec}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : null}
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

const AdminLoginLogsWithGuard = () => (
    <AdminPageGuard requiredTab="login-logs">
        <AdminLoginLogs />
    </AdminPageGuard>
);

export default AdminLoginLogsWithGuard;
