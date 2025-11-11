import { useState, useEffect } from 'react';
import { userReportsApi, Conversion } from '../services/userReportsApi';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Calendar, Download, RefreshCw, CheckCircle, XCircle, Clock, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DatePresets } from '../components/reports/DatePresets';
import { ReportFilters } from '../components/reports/ReportFilters';
import { ReportOptions, ReportColumnOptions } from '../components/reports/ReportOptions';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';

export default function ConversionReport() {
  const [loading, setLoading] = useState(false);
  const [conversions, setConversions] = useState<Conversion[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0, pages: 0 });
  const [chartData, setChartData] = useState<any[]>([]);
  const [reportOptions, setReportOptions] = useState<ReportColumnOptions | null>(null);
  const [activeFilters, setActiveFilters] = useState<any>({});
  const [selectedConversion, setSelectedConversion] = useState<Conversion | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  // Date range state (default: last 7 days)
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  });

  // Fetch report data
  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await userReportsApi.getConversionReport({
        start_date: dateRange.start,
        end_date: dateRange.end,
        page: pagination.page,
        per_page: pagination.per_page,
      });

      if (response.success) {
        setConversions(response.report.conversions);
        setSummary(response.report.summary);
        setPagination(response.report.pagination);
      }
    } catch (error) {
      toast.error('Failed to load conversion report');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch chart data
  const fetchChartData = async () => {
    try {
      const response = await userReportsApi.getChartData({
        start_date: dateRange.start,
        end_date: dateRange.end,
        metric: 'revenue',
        granularity: 'day'
      });

      if (response.success) {
        setChartData(response.chart_data);
      }
    } catch (error) {
      console.error('Failed to load chart data:', error);
    }
  };

  useEffect(() => {
    fetchReport();
    fetchChartData();
  }, [dateRange, pagination.page]);

  // Export handler
  const handleExport = async () => {
    try {
      await userReportsApi.exportReport('conversions', {
        start_date: dateRange.start,
        end_date: dateRange.end,
      });
      toast.success('Report exported successfully');
    } catch (error) {
      toast.error('Failed to export report');
    }
  };

  // Status badge
  const getStatusBadge = (status: string) => {
    const config = {
      approved: { icon: CheckCircle, color: 'text-green-600 bg-green-100', label: 'Approved' },
      pending: { icon: Clock, color: 'text-yellow-600 bg-yellow-100', label: 'Pending' },
      rejected: { icon: XCircle, color: 'text-red-600 bg-red-100', label: 'Rejected' },
    };
    const { icon: Icon, color, label } = config[status as keyof typeof config] || config.pending;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${color}`}>
        <Icon className="h-3 w-3" />
        {label}
      </span>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Conversion Report</h1>
          <p className="text-muted-foreground">View detailed conversion transactions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchReport} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Date Range Picker & Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Date Range */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="font-medium">Date Range:</span>
          </div>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
            className="px-3 py-2 border rounded text-sm"
          />
          <span>to</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
            className="px-3 py-2 border rounded text-sm"
          />

          <div className="h-6 w-px bg-border" />

          {/* Date Presets */}
          <DatePresets
            onPresetSelect={(preset) => {
              setDateRange({ start: preset.start, end: preset.end });
              toast.success(`Applied: ${preset.label}`);
            }}
          />

          {/* Report Options */}
          <ReportOptions
            reportType="conversion"
            onOptionsChange={(options) => {
              setReportOptions(options);
              toast.success('Report options updated');
            }}
          />

          {/* Report Filters */}
          <ReportFilters
            onFiltersChange={(newFilters) => {
              setActiveFilters(newFilters);
              toast.success('Filters applied');
            }}
            availableOffers={[]}
          />
        </div>
      </Card>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Approved Payout</div>
            <div className="text-2xl font-bold text-green-600">${summary.approved_payout.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {summary.approved_conversions || 0} conversions
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Pending Payout</div>
            <div className="text-2xl font-bold text-yellow-600">${summary.pending_payout.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {summary.pending_conversions || 0} conversions
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Total Conversions</div>
            <div className="text-2xl font-bold">{summary.total_conversions.toLocaleString()}</div>
          </Card>
        </div>
      )}

      {/* Revenue Chart */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Revenue Trends</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar 
                dataKey="value" 
                fill="#10b981" 
                name="Revenue ($)"
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No chart data available
          </div>
        )}
      </Card>

      {/* Data Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="p-3 text-left">Time</th>
                <th className="p-3 text-left">Transaction ID</th>
                <th className="p-3 text-left">Offer</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Payout</th>
                <th className="p-3 text-left">Country</th>
                <th className="p-3 text-left">Device</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              ) : conversions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    No conversions found for selected date range
                  </td>
                </tr>
              ) : (
                conversions.map((conv) => (
                  <tr key={conv._id} className="border-b hover:bg-muted/50">
                    <td className="p-3 text-sm">
                      {new Date(conv.time).toLocaleString()}
                    </td>
                    <td className="p-3 font-mono text-xs">
                      {conv.transaction_id}
                    </td>
                    <td className="p-3">{conv.offer_name}</td>
                    <td className="p-3">{getStatusBadge(conv.status)}</td>
                    <td className="p-3 text-right font-semibold">
                      ${conv.payout.toFixed(2)}
                    </td>
                    <td className="p-3">{conv.country}</td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {conv.device_type || '-'}
                    </td>
                    <td className="p-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedConversion(conv);
                          setShowDetailsModal(true);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="p-4 flex justify-between items-center border-t">
            <div className="text-sm text-muted-foreground">
              Showing {((pagination.page - 1) * pagination.per_page) + 1} to {Math.min(pagination.page * pagination.per_page, pagination.total)} of {pagination.total} results
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination({...pagination, page: pagination.page - 1})}
                disabled={pagination.page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination({...pagination, page: pagination.page + 1})}
                disabled={pagination.page === pagination.pages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Conversion Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Conversion Details</DialogTitle>
          </DialogHeader>
          
          {selectedConversion && (
            <div className="space-y-6">
              {/* Basic Info */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Conversion ID:</span>
                    <p className="font-mono">{selectedConversion.conversion_id || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Transaction ID:</span>
                    <p className="font-mono">{selectedConversion.transaction_id || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <p>{getStatusBadge(selectedConversion.status)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Payout:</span>
                    <p className="font-semibold">${selectedConversion.payout.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Offer:</span>
                    <p>{selectedConversion.offer_name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Time:</span>
                    <p>{new Date(selectedConversion.time).toLocaleString()}</p>
                  </div>
                </div>
              </Card>

              {/* Survey Information */}
              {(selectedConversion as any).survey_id && (
                <Card className="p-4">
                  <h3 className="font-semibold mb-3">📊 Survey Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <span className="text-muted-foreground">Survey ID:</span>
                      <p className="font-mono">{(selectedConversion as any).survey_id}</p>
                    </div>
                    {(selectedConversion as any).session_id && (
                      <div>
                        <span className="text-muted-foreground">Session ID:</span>
                        <p className="font-mono text-xs">{(selectedConversion as any).session_id}</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Survey Responses */}
                  {(selectedConversion as any).survey_responses && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-2">Survey Responses:</h4>
                      <div className="bg-muted p-3 rounded-lg space-y-2">
                        {Object.entries((selectedConversion as any).survey_responses).map(([key, value]) => (
                          <div key={key} className="flex justify-between items-center border-b pb-2 last:border-0">
                            <span className="font-medium">{key}:</span>
                            <span className="text-muted-foreground">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              )}

              {/* Custom Data / Raw Postback */}
              {(selectedConversion as any).raw_postback && (
                <Card className="p-4">
                  <h3 className="font-semibold mb-3">📦 Complete Postback Data</h3>
                  <div className="bg-muted p-3 rounded-lg">
                    <pre className="text-xs overflow-x-auto">
                      {JSON.stringify((selectedConversion as any).raw_postback, null, 2)}
                    </pre>
                  </div>
                </Card>
              )}

              {/* Partner Information */}
              {(selectedConversion as any).partner_name && (
                <Card className="p-4">
                  <h3 className="font-semibold mb-3">🤝 Partner Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Partner:</span>
                      <p>{(selectedConversion as any).partner_name}</p>
                    </div>
                    {(selectedConversion as any).partner_id && (
                      <div>
                        <span className="text-muted-foreground">Partner ID:</span>
                        <p className="font-mono">{(selectedConversion as any).partner_id}</p>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Device & Location */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3">📍 Device & Location</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Country:</span>
                    <p>{selectedConversion.country}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Device:</span>
                    <p>{selectedConversion.device_type || 'Unknown'}</p>
                  </div>
                  {(selectedConversion as any).ip_address && (
                    <div>
                      <span className="text-muted-foreground">IP Address:</span>
                      <p className="font-mono text-xs">{(selectedConversion as any).ip_address}</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
