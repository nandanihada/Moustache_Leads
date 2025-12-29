import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    RefreshCw,
    Users,
    Activity,
    AlertTriangle,
    Clock,
    MapPin,
    Monitor,
    Smartphone,
    Tablet,
    Eye,
} from 'lucide-react';
import loginLogsService, { ActiveSession } from '@/services/loginLogsService';
import { useToast } from '@/hooks/use-toast';
import { AdminPageGuard } from '@/components/AdminPageGuard';

const AdminActiveUsers: React.FC = () => {
    const [sessions, setSessions] = useState<ActiveSession[]>([]);
    const [loading, setLoading] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const { toast } = useToast();

    // Load active sessions
    const loadSessions = async () => {
        try {
            setLoading(true);
            const response = await loginLogsService.getActiveSessions(true);
            setSessions(response.sessions);
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.response?.data?.error || 'Failed to load active sessions',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSessions();
    }, []);

    // Auto-refresh every 10 seconds
    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(() => {
            loadSessions();
        }, 10000);

        return () => clearInterval(interval);
    }, [autoRefresh]);

    const getActivityColor = (level: string) => {
        switch (level) {
            case 'suspicious':
                return 'bg-red-500';
            case 'active':
                return 'bg-green-500';
            case 'normal':
                return 'bg-yellow-500';
            case 'idle':
                return 'bg-gray-400';
            default:
                return 'bg-gray-400';
        }
    };

    const getActivityBadge = (level: string) => {
        const colors = {
            suspicious: 'bg-red-500 hover:bg-red-600',
            active: 'bg-green-500 hover:bg-green-600',
            normal: 'bg-yellow-500 hover:bg-yellow-600',
            idle: 'bg-gray-400 hover:bg-gray-500',
        };

        const labels = {
            suspicious: 'Suspicious',
            active: 'Active',
            normal: 'Normal',
            idle: 'Idle',
        };

        return (
            <Badge className={colors[level as keyof typeof colors] || colors.idle}>
                {labels[level as keyof typeof labels] || 'Unknown'}
            </Badge>
        );
    };

    const getDeviceIcon = (deviceType: string) => {
        switch (deviceType?.toLowerCase()) {
            case 'mobile':
                return <Smartphone className="h-4 w-4" />;
            case 'tablet':
                return <Tablet className="h-4 w-4" />;
            default:
                return <Monitor className="h-4 w-4" />;
        }
    };

    const formatSessionDuration = (loginTime: string) => {
        const duration = Date.now() - new Date(loginTime).getTime();
        const hours = Math.floor(duration / (1000 * 60 * 60));
        const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    };

    // Calculate stats
    const stats = {
        total: sessions.length,
        active: sessions.filter((s) => s.activity_level === 'active').length,
        normal: sessions.filter((s) => s.activity_level === 'normal').length,
        idle: sessions.filter((s) => s.activity_level === 'idle').length,
        suspicious: sessions.filter((s) => s.activity_level === 'suspicious').length,
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Active Users</h1>
                    <p className="text-muted-foreground">Real-time user activity monitoring</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant={autoRefresh ? 'default' : 'outline'}
                        onClick={() => setAutoRefresh(!autoRefresh)}
                    >
                        <Activity className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-pulse' : ''}`} />
                        {autoRefresh ? 'Auto-Refresh On' : 'Auto-Refresh Off'}
                    </Button>
                    <Button onClick={loadSessions} variant="outline" disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Total Active
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Active
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{stats.active}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Normal
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-600">{stats.normal}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Idle</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-600">{stats.idle}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            Suspicious
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{stats.suspicious}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Active Sessions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading && sessions.length === 0 ? (
                    <div className="col-span-full flex justify-center items-center py-12">
                        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                        No active users
                    </div>
                ) : (
                    sessions.map((session) => (
                        <Card
                            key={session._id}
                            className={`relative overflow-hidden ${session.activity_level === 'suspicious' ? 'border-red-500' : ''
                                }`}
                        >
                            {/* Activity Indicator Dot */}
                            <div className="absolute top-4 right-4">
                                <div
                                    className={`h-3 w-3 rounded-full ${getActivityColor(
                                        session.activity_level
                                    )} animate-pulse`}
                                />
                            </div>

                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <CardTitle className="text-lg">{session.username}</CardTitle>
                                        <p className="text-sm text-muted-foreground">{session.email}</p>
                                    </div>
                                </div>
                                <div className="mt-2">{getActivityBadge(session.activity_level)}</div>
                            </CardHeader>

                            <CardContent className="space-y-3">
                                {/* Current Page */}
                                <div className="flex items-start gap-2">
                                    <Eye className="h-4 w-4 text-muted-foreground mt-0.5" />
                                    <div className="flex-1">
                                        <div className="text-xs text-muted-foreground">Current Page</div>
                                        <div className="text-sm font-medium truncate">{session.current_page}</div>
                                    </div>
                                </div>

                                {/* Last Activity */}
                                <div className="flex items-start gap-2">
                                    <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                                    <div className="flex-1">
                                        <div className="text-xs text-muted-foreground">Last Activity</div>
                                        <div className="text-sm font-medium">{session.idle_time_formatted} ago</div>
                                    </div>
                                </div>

                                {/* Session Duration */}
                                <div className="flex items-start gap-2">
                                    <Activity className="h-4 w-4 text-muted-foreground mt-0.5" />
                                    <div className="flex-1">
                                        <div className="text-xs text-muted-foreground">Session Duration</div>
                                        <div className="text-sm font-medium">
                                            {formatSessionDuration(session.login_time)}
                                        </div>
                                    </div>
                                </div>

                                {/* Location */}
                                <div className="flex items-start gap-2">
                                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                                    <div className="flex-1">
                                        <div className="text-xs text-muted-foreground">Location</div>
                                        <div className="text-sm font-medium">
                                            {session.location.city}, {session.location.country}
                                        </div>
                                        <code className="text-xs bg-muted px-2 py-0.5 rounded">
                                            {session.ip_address}
                                        </code>
                                    </div>
                                </div>

                                {/* Device */}
                                <div className="flex items-start gap-2">
                                    {getDeviceIcon(session.device.type)}
                                    <div className="flex-1">
                                        <div className="text-xs text-muted-foreground">Device</div>
                                        <div className="text-sm font-medium">{session.device.type}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {session.device.os} • {session.device.browser}
                                        </div>
                                    </div>
                                </div>

                                {/* Suspicious Reason */}
                                {session.is_suspicious && session.suspicious_reason && (
                                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                                        <div className="flex items-start gap-2">
                                            <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                                            <div>
                                                <div className="text-xs font-medium text-red-600">Suspicious Activity</div>
                                                <div className="text-xs text-red-700">{session.suspicious_reason}</div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Legend */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Activity Level Legend</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full bg-green-500" />
                            <div>
                                <div className="text-sm font-medium">Active</div>
                                <div className="text-xs text-muted-foreground">Activity within 1 minute</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full bg-yellow-500" />
                            <div>
                                <div className="text-sm font-medium">Normal</div>
                                <div className="text-xs text-muted-foreground">Activity within 5 minutes</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full bg-gray-400" />
                            <div>
                                <div className="text-sm font-medium">Idle</div>
                                <div className="text-xs text-muted-foreground">No activity for 5+ minutes</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full bg-red-500" />
                            <div>
                                <div className="text-sm font-medium">Suspicious</div>
                                <div className="text-xs text-muted-foreground">Unusual activity detected</div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

const AdminActiveUsersWithGuard = () => (
  <AdminPageGuard requiredTab="active-users">
    <AdminActiveUsers />
  </AdminPageGuard>
);

export default AdminActiveUsersWithGuard;