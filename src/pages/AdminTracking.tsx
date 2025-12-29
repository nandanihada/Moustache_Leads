import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  MousePointer, 
  CheckCircle, 
  AlertCircle,
  RefreshCw,
  Filter,
  Search,
  Clock,
  User,
  Globe,
  ExternalLink
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { trackingApi, TrackingEvent } from '@/services/trackingApi';
import { useToast } from '@/hooks/use-toast';
import { AdminPageGuard } from '@/components/AdminPageGuard';

const AdminTracking = () => {
  const { toast } = useToast();
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [eventStats, setEventStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filters, setFilters] = useState({
    event_type: 'all',
    offer_id: '',
    user_id: '',
    limit: 100
  });
  const [searchTerm, setSearchTerm] = useState('');

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await trackingApi.getTrackingEvents({
        limit: filters.limit,
        event_type: filters.event_type === 'all' ? undefined : filters.event_type,
        offer_id: filters.offer_id || undefined,
        user_id: filters.user_id || undefined
      });
      setEvents(response.events);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch tracking events",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchEventStats = async () => {
    try {
      const response = await trackingApi.getEventStats(24);
      setEventStats(response.stats);
    } catch (error) {
      console.error('Failed to fetch event stats:', error);
    }
  };

  const getEventTypeColor = (eventType: string) => {
    switch (eventType) {
      case 'click':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
      case 'completion':
        return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'postback_sent':
        return 'bg-purple-100 text-purple-800 hover:bg-purple-200';
      case 'postback_failed':
        return 'bg-red-100 text-red-800 hover:bg-red-200';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };

  const getEventTypeIcon = (eventType: string) => {
    switch (eventType) {
      case 'click':
        return <MousePointer className="h-4 w-4" />;
      case 'completion':
        return <CheckCircle className="h-4 w-4" />;
      case 'postback_sent':
        return <ExternalLink className="h-4 w-4" />;
      case 'postback_failed':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const filteredEvents = events.filter(event => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      event.offer_id?.toLowerCase().includes(searchLower) ||
      event.offer_name?.toLowerCase().includes(searchLower) ||
      event.username?.toLowerCase().includes(searchLower) ||
      event.event_type.toLowerCase().includes(searchLower) ||
      event.network?.toLowerCase().includes(searchLower)
    );
  });

  useEffect(() => {
    fetchEvents();
    fetchEventStats();
  }, [filters]);

  // Auto-refresh events every 10 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchEvents();
      fetchEventStats();
    }, 10000);

    return () => clearInterval(interval);
  }, [autoRefresh, filters]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Real-time Tracking</h1>
          <p className="text-muted-foreground">
            Monitor live tracking events and system activity
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh
          </Button>
          <Button onClick={() => { fetchEvents(); fetchEventStats(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Now
          </Button>
        </div>
      </div>

      {/* Event Stats */}
      {eventStats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Events (24h)</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{eventStats.total_events || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clicks</CardTitle>
              <MousePointer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{eventStats.click || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completions</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{eventStats.completion || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Postbacks Sent</CardTitle>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{eventStats.postback_sent || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed Postbacks</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{eventStats.postback_failed || 0}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Filters & Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search events..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium">Event Type</label>
              <Select 
                value={filters.event_type} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, event_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="click">Clicks</SelectItem>
                  <SelectItem value="completion">Completions</SelectItem>
                  <SelectItem value="postback_sent">Postbacks Sent</SelectItem>
                  <SelectItem value="postback_failed">Postbacks Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Offer ID</label>
              <Input
                placeholder="Filter by offer ID"
                value={filters.offer_id}
                onChange={(e) => setFilters(prev => ({ ...prev, offer_id: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-sm font-medium">User ID</label>
              <Input
                placeholder="Filter by user ID"
                value={filters.user_id}
                onChange={(e) => setFilters(prev => ({ ...prev, user_id: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Limit</label>
              <Select 
                value={filters.limit.toString()} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, limit: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50 events</SelectItem>
                  <SelectItem value="100">100 events</SelectItem>
                  <SelectItem value="200">200 events</SelectItem>
                  <SelectItem value="500">500 events</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Events Table */}
      <Card>
        <CardHeader>
          <CardTitle>Live Events</CardTitle>
          <CardDescription>
            Real-time tracking events ({filteredEvents.length} of {events.length} events shown)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading events...</div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No events found matching your criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Offer</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Network</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map((event) => (
                    <TableRow key={event._id}>
                      <TableCell>
                        <Badge className={getEventTypeColor(event.event_type)}>
                          <span className="flex items-center gap-1">
                            {getEventTypeIcon(event.event_type)}
                            {event.event_type.replace('_', ' ')}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{event.offer_id}</div>
                          {event.offer_name && (
                            <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                              {event.offer_name}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            {event.username || event.user_id || 'Unknown'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          {event.network || 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {event.event_type === 'click' && event.metadata?.click_id && (
                            <div>Click ID: {event.metadata.click_id.slice(0, 8)}...</div>
                          )}
                          {event.event_type === 'completion' && event.metadata?.payout && (
                            <div>Payout: ${event.metadata.payout}</div>
                          )}
                          {(event.event_type === 'postback_sent' || event.event_type === 'postback_failed') && event.metadata?.response_code && (
                            <div>Status: {event.metadata.response_code}</div>
                          )}
                          {event.metadata?.country && (
                            <div className="text-muted-foreground">Country: {event.metadata.country}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-sm">{formatTimestamp(event.timestamp)}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(event.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Details Modal could be added here for more detailed view */}
    </div>
  );
};

const AdminTrackingWithGuard = () => (
  <AdminPageGuard requiredTab="tracking">
    <AdminTracking />
  </AdminPageGuard>
);

export default AdminTrackingWithGuard;