import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  TrendingUp,
  Users,
  MousePointer,
  DollarSign,
  AlertTriangle,
  Activity,
  BarChart3,
  PieChart,
  Download,
  RefreshCw
} from 'lucide-react';
import { API_BASE_URL } from '../services/apiConfig';

interface DashboardStats {
  total_sessions: number;
  total_clicks: number;
  total_conversions: number;
  total_points_awarded: number;
  ctr: number;
  cvr: number;
}

interface FraudSignal {
  _id: string;
  user_id: string;
  signal_type: string;
  timestamp: string;
  severity: string;
  data: any;
}

const AdminOfferwallAnalytics: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [fraudSignals, setFraudSignals] = useState<FraudSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch dashboard stats
  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/admin/offerwall/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error(`Failed to fetch stats: ${response.status}`);

      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    }
  };

  // Fetch fraud signals
  const fetchFraudSignals = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/admin/offerwall/fraud-signals`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch fraud signals');

      const data = await response.json();
      if (data.success) {
        setFraudSignals(data.data.slice(0, 10)); // Show latest 10
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Error fetching fraud signals:', err);
      // Don't set error for fraud signals, just log it
    }
  };

  // Refresh all data
  const refreshData = async () => {
    setRefreshing(true);
    await Promise.all([fetchStats(), fetchFraudSignals()]);
    setRefreshing(false);
  };

  // Initial data load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await refreshData();
      setLoading(false);
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading analytics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Offerwall Analytics</h1>
          <p className="text-muted-foreground">Monitor offerwall performance and fraud detection</p>
        </div>
        <Button onClick={refreshData} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Key Metrics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_sessions.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">User sessions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
              <MousePointer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_clicks.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">CTR: {stats.ctr}%</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Conversions</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_conversions.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">CVR: {stats.cvr}%</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Points Awarded</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_points_awarded.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Total points</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="fraud">Fraud Detection</TabsTrigger>
          <TabsTrigger value="placements">Placements</TabsTrigger>
          <TabsTrigger value="offers">Offers</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance Overview</CardTitle>
                <CardDescription>Key performance metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats && (
                    <>
                      <div className="flex justify-between">
                        <span>Click-Through Rate</span>
                        <span className="font-bold">{stats.ctr}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Conversion Rate</span>
                        <span className="font-bold">{stats.cvr}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Avg Points per Conversion</span>
                        <span className="font-bold">
                          {stats.total_conversions > 0
                            ? Math.round(stats.total_points_awarded / stats.total_conversions)
                            : 0}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest offerwall activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Activity className="h-4 w-4 text-green-500" />
                    <span className="text-sm">System operational</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">Analytics updated</span>
                  </div>
                  {fraudSignals.length > 0 && (
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm">{fraudSignals.length} fraud signals detected</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="fraud" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5" />
                <span>Fraud Detection</span>
              </CardTitle>
              <CardDescription>Recent fraud signals and alerts</CardDescription>
            </CardHeader>
            <CardContent>
              {fraudSignals.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User ID</TableHead>
                      <TableHead>Signal Type</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fraudSignals.map((signal) => (
                      <TableRow key={signal._id}>
                        <TableCell className="font-mono">{signal.user_id}</TableCell>
                        <TableCell>{signal.signal_type}</TableCell>
                        <TableCell>
                          <Badge variant={
                            signal.severity === 'high' ? 'destructive' :
                              signal.severity === 'medium' ? 'default' : 'secondary'
                          }>
                            {signal.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(signal.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No fraud signals detected</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="placements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Placement Analytics</CardTitle>
              <CardDescription>Performance by placement</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <PieChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Placement analytics coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="offers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Offer Performance</CardTitle>
              <CardDescription>Top performing offers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Offer analytics coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminOfferwallAnalytics;
