import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  BarChart3, 
  TrendingUp, 
  Shield, 
  DollarSign, 
  MousePointer, 
  Target,
  AlertTriangle,
  RefreshCw,
  Calendar,
  Users,
  Smartphone,
  Monitor,
  Tablet
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AnalyticsData {
  summary: {
    total_clicks: number;
    unique_clicks: number;
    fraud_clicks: number;
    total_conversions: number;
    conversion_rate: number;
    total_revenue: number;
    total_payout: number;
    profit: number;
    fraud_rate: number;
  };
  top_offers: Array<{
    _id: string;
    clicks: number;
    unique_clicks: number;
    fraud_clicks: number;
  }>;
  device_breakdown: Array<{
    _id: string;
    count: number;
  }>;
  hourly_trends: Array<{
    _id: { hour: number; date: string };
    clicks: number;
    conversions: number;
  }>;
}

interface FraudReport {
  fraud_by_reason: Array<{
    _id: string;
    count: number;
  }>;
  top_fraud_ips: Array<{
    _id: string;
    count: number;
    avg_fraud_score: number;
  }>;
}

export const AnalyticsDashboard: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('24h');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [fraudReport, setFraudReport] = useState<FraudReport | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // Load analytics dashboard
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const analyticsResponse = await fetch(`${API_URL}/api/analytics/dashboard?date_range=${dateRange}`, {
        headers
      });

      if (analyticsResponse.ok) {
        const data = await analyticsResponse.json();
        setAnalyticsData(data);
      }

      // Load fraud report
      const fraudResponse = await fetch(`${API_URL}/api/analytics/fraud-report?date_range=${dateRange}`, {
        headers
      });

      if (fraudResponse.ok) {
        const fraudData = await fraudResponse.json();
        setFraudReport(fraudData);
      }

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load analytics data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile':
        return <Smartphone className="h-4 w-4" />;
      case 'tablet':
        return <Tablet className="h-4 w-4" />;
      case 'desktop':
        return <Monitor className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin mr-3" />
        <span>Loading analytics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Track performance, detect fraud, and analyze conversion flows
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadAnalytics} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
        <Button
          variant={activeTab === 'overview' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('overview')}
        >
          <BarChart3 className="h-4 w-4 mr-2" />
          Overview
        </Button>
        <Button
          variant={activeTab === 'fraud' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('fraud')}
        >
          <Shield className="h-4 w-4 mr-2" />
          Fraud Detection
        </Button>
      </div>

      {activeTab === 'overview' && analyticsData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
                <MousePointer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(analyticsData.summary.total_clicks)}</div>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(analyticsData.summary.unique_clicks)} unique
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conversions</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(analyticsData.summary.total_conversions)}</div>
                <p className="text-xs text-muted-foreground">
                  {analyticsData.summary.conversion_rate}% conversion rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(analyticsData.summary.total_revenue)}</div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(analyticsData.summary.profit)} profit
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Fraud Rate</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyticsData.summary.fraud_rate}%</div>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(analyticsData.summary.fraud_clicks)} fraud clicks
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts and Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Offers */}
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Offers</CardTitle>
                <CardDescription>Offers with the most clicks in selected period</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Offer ID</TableHead>
                      <TableHead>Clicks</TableHead>
                      <TableHead>Unique</TableHead>
                      <TableHead>Fraud</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analyticsData.top_offers.slice(0, 5).map((offer) => (
                      <TableRow key={offer._id}>
                        <TableCell className="font-mono">{offer._id}</TableCell>
                        <TableCell>{formatNumber(offer.clicks)}</TableCell>
                        <TableCell>{formatNumber(offer.unique_clicks)}</TableCell>
                        <TableCell>
                          <Badge variant={offer.fraud_clicks > 0 ? "destructive" : "secondary"}>
                            {offer.fraud_clicks}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Device Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Device Breakdown</CardTitle>
                <CardDescription>Traffic distribution by device type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyticsData.device_breakdown.map((device) => {
                    const total = analyticsData.device_breakdown.reduce((sum, d) => sum + d.count, 0);
                    const percentage = ((device.count / total) * 100).toFixed(1);
                    
                    return (
                      <div key={device._id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getDeviceIcon(device._id)}
                          <span className="capitalize">{device._id || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">{percentage}%</span>
                          <Badge variant="outline">{formatNumber(device.count)}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Hourly Trends */}
          <Card>
            <CardHeader>
              <CardTitle>Hourly Activity Trends</CardTitle>
              <CardDescription>Click and conversion activity over the last 24 hours</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analyticsData.hourly_trends.slice(-12).map((trend) => (
                  <div key={`${trend._id.date}-${trend._id.hour}`} className="flex items-center justify-between p-2 rounded bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{trend._id.hour}:00</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Clicks:</span> {trend.clicks}
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Conversions:</span> {trend.conversions}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === 'fraud' && fraudReport && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Fraud by Reason */}
            <Card>
              <CardHeader>
                <CardTitle>Fraud Detection Reasons</CardTitle>
                <CardDescription>Most common fraud indicators detected</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {fraudReport.fraud_by_reason.map((reason) => (
                    <div key={reason._id} className="flex items-center justify-between p-3 rounded bg-red-50">
                      <span className="text-sm">{reason._id}</span>
                      <Badge variant="destructive">{reason.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Fraud IPs */}
            <Card>
              <CardHeader>
                <CardTitle>Top Fraud IP Addresses</CardTitle>
                <CardDescription>IP addresses with highest fraud activity</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Attempts</TableHead>
                      <TableHead>Avg Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fraudReport.top_fraud_ips.slice(0, 10).map((ip) => (
                      <TableRow key={ip._id}>
                        <TableCell className="font-mono">{ip._id}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">{ip.count}</Badge>
                        </TableCell>
                        <TableCell>{Math.round(ip.avg_fraud_score)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};
