import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Globe,
  Calendar,
  Download,
  RefreshCw,
  Plus,
  Trash2,
  Eye,
  Filter
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
import { reportsApi, TrackingReport, RealtimeStats, DashboardSummary } from '@/services/reportsApi';
import { useToast } from '@/hooks/use-toast';
import { AdminPageGuard } from '@/components/AdminPageGuard';

const AdminReports = () => {
  const { toast } = useToast();
  const [reports, setReports] = useState<TrackingReport[]>([]);
  const [realtimeStats, setRealtimeStats] = useState<RealtimeStats | null>(null);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [selectedReport, setSelectedReport] = useState<TrackingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportType, setReportType] = useState('custom');

  // Initialize dates to last 7 days
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await reportsApi.getReports(50);
      setReports(response.reports);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch reports",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRealtimeStats = async () => {
    try {
      const response = await reportsApi.getRealtimeStats();
      setRealtimeStats(response.stats);
    } catch (error) {
      console.error('Failed to fetch realtime stats:', error);
    }
  };

  const fetchDashboardSummary = async () => {
    try {
      const response = await reportsApi.getDashboardSummary();
      setDashboardSummary(response.summary);
    } catch (error) {
      console.error('Failed to fetch dashboard summary:', error);
    }
  };

  const generateCustomReport = async () => {
    if (!startDate || !endDate) {
      toast({
        title: "Error",
        description: "Please select both start and end dates",
        variant: "destructive",
      });
      return;
    }

    try {
      setGeneratingReport(true);
      const response = await reportsApi.generateReport({
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString(),
        type: reportType
      });

      toast({
        title: "Success",
        description: response.message,
      });

      fetchReports();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate report",
        variant: "destructive",
      });
    } finally {
      setGeneratingReport(false);
    }
  };

  const generateQuickReport = async (type: 'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'this_month' | 'last_month') => {
    try {
      setGeneratingReport(true);
      const response = await reportsApi.generateQuickReport(type);
      
      toast({
        title: "Success",
        description: response.message,
      });

      fetchReports();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate quick report",
        variant: "destructive",
      });
    } finally {
      setGeneratingReport(false);
    }
  };

  const deleteReport = async (reportId: string) => {
    try {
      await reportsApi.deleteReport(reportId);
      toast({
        title: "Success",
        description: "Report deleted successfully",
      });
      fetchReports();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete report",
        variant: "destructive",
      });
    }
  };

  const viewReport = async (reportId: string) => {
    try {
      const response = await reportsApi.getReport(reportId);
      setSelectedReport(response.report);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load report",
        variant: "destructive",
      });
    }
  };

  const exportReport = async (reportId: string) => {
    try {
      const response = await reportsApi.exportReport(reportId);
      
      // Convert to CSV and download
      const csvData = convertToCSV(response.export_data);
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `report-${reportId}-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Report exported successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to export report",
        variant: "destructive",
      });
    }
  };

  const convertToCSV = (data: any) => {
    const headers = ['Metric', 'Value'];
    const rows = [
      ['Total Clicks', data.summary_metrics?.total_clicks || 0],
      ['Total Completions', data.summary_metrics?.total_completions || 0],
      ['Conversion Rate', `${data.summary_metrics?.conversion_rate || 0}%`],
      ['Total Payout', `$${data.summary_metrics?.total_payout || 0}`],
      ['Average Payout', `$${data.summary_metrics?.avg_payout || 0}`],
      ['Total Revenue', `$${data.summary_metrics?.total_revenue || 0}`],
    ];

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  };

  useEffect(() => {
    fetchReports();
    fetchRealtimeStats();
    fetchDashboardSummary();
  }, []);

  // Auto-refresh stats every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchRealtimeStats();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  if (selectedReport) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button 
              variant="outline" 
              onClick={() => setSelectedReport(null)}
              className="mb-4"
            >
              ← Back to Reports
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Report Details</h1>
            <p className="text-muted-foreground">
              {selectedReport.type} report from {new Date(selectedReport.date_range.start).toLocaleDateString()} to {new Date(selectedReport.date_range.end).toLocaleDateString()}
            </p>
          </div>
          <Button onClick={() => exportReport(selectedReport.report_id)}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Summary Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{selectedReport.summary_metrics.total_clicks.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completions</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{selectedReport.summary_metrics.total_completions.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {selectedReport.summary_metrics.conversion_rate.toFixed(2)}% conversion rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Payout</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${selectedReport.summary_metrics.total_payout.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                ${selectedReport.summary_metrics.avg_payout.toFixed(2)} avg payout
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${selectedReport.summary_metrics.total_revenue.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Top Offers */}
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Offers</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Offer</TableHead>
                  <TableHead>Clicks</TableHead>
                  <TableHead>Conversions</TableHead>
                  <TableHead>Conversion Rate</TableHead>
                  <TableHead>Payout</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedReport.top_offers.map((offer) => (
                  <TableRow key={offer._id}>
                    <TableCell className="font-medium">{offer.offer_name}</TableCell>
                    <TableCell>{offer.clicks.toLocaleString()}</TableCell>
                    <TableCell>{offer.conversions.toLocaleString()}</TableCell>
                    <TableCell>{offer.conversion_rate.toFixed(2)}%</TableCell>
                    <TableCell>${offer.total_payout.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Top Affiliates */}
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Affiliates</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Affiliate</TableHead>
                  <TableHead>Clicks</TableHead>
                  <TableHead>Conversions</TableHead>
                  <TableHead>Conversion Rate</TableHead>
                  <TableHead>Earnings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedReport.top_affiliates.map((affiliate) => (
                  <TableRow key={affiliate._id}>
                    <TableCell className="font-medium">{affiliate.username}</TableCell>
                    <TableCell>{affiliate.clicks.toLocaleString()}</TableCell>
                    <TableCell>{affiliate.conversions.toLocaleString()}</TableCell>
                    <TableCell>{affiliate.conversion_rate.toFixed(2)}%</TableCell>
                    <TableCell>${affiliate.total_earnings.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground">
            Track performance and generate detailed reports
          </p>
        </div>
        <Button onClick={fetchReports}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Real-time Stats */}
      {realtimeStats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clicks (24h)</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{realtimeStats.last_24h.clicks.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {realtimeStats.last_24h.conversion_rate.toFixed(2)}% conversion rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completions (24h)</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{realtimeStats.last_24h.conversions.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{realtimeStats.total.clicks.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Offers</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{realtimeStats.total.active_offers}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Report Generation */}
      <Card>
        <CardHeader>
          <CardTitle>Generate Report</CardTitle>
          <CardDescription>Create custom reports or use quick presets</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Reports */}
          <div>
            <h4 className="font-medium mb-2">Quick Reports</h4>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => generateQuickReport('today')}
                disabled={generatingReport}
              >
                Today
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => generateQuickReport('yesterday')}
                disabled={generatingReport}
              >
                Yesterday
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => generateQuickReport('last_7_days')}
                disabled={generatingReport}
              >
                Last 7 Days
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => generateQuickReport('last_30_days')}
                disabled={generatingReport}
              >
                Last 30 Days
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => generateQuickReport('this_month')}
                disabled={generatingReport}
              >
                This Month
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => generateQuickReport('last_month')}
                disabled={generatingReport}
              >
                Last Month
              </Button>
            </div>
          </div>

          {/* Custom Report */}
          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">Custom Report</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Report Type</label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Custom</SelectItem>
                    <SelectItem value="performance">Performance</SelectItem>
                    <SelectItem value="revenue">Revenue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button 
                  onClick={generateCustomReport}
                  disabled={generatingReport}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {generatingReport ? 'Generating...' : 'Generate'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reports List */}
      <Card>
        <CardHeader>
          <CardTitle>Generated Reports</CardTitle>
          <CardDescription>View and manage your reports</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading reports...</div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No reports generated yet. Create your first report above.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Date Range</TableHead>
                  <TableHead>Clicks</TableHead>
                  <TableHead>Conversions</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.report_id}>
                    <TableCell>
                      <Badge variant="outline">{report.type}</Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(report.date_range.start).toLocaleDateString()} - {new Date(report.date_range.end).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{report.summary_metrics.total_clicks.toLocaleString()}</TableCell>
                    <TableCell>{report.summary_metrics.total_completions.toLocaleString()}</TableCell>
                    <TableCell>${report.summary_metrics.total_revenue.toLocaleString()}</TableCell>
                    <TableCell>{new Date(report.generated_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => viewReport(report.report_id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => exportReport(report.report_id)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteReport(report.report_id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const AdminReportsWithGuard = () => (
  <AdminPageGuard requiredTab="reports">
    <AdminReports />
  </AdminPageGuard>
);

export default AdminReportsWithGuard;