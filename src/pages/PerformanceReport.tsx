import { useState, useEffect } from 'react';
import { userReportsApi, PerformanceReportFilters, PerformanceRow } from '../services/userReportsApi';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Calendar, Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DatePresets } from '../components/reports/DatePresets';
import { ReportFilters } from '../components/reports/ReportFilters';
import { ReportOptions, ReportColumnOptions } from '../components/reports/ReportOptions';

export default function PerformanceReport() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PerformanceRow[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0, pages: 0 });
  const [chartData, setChartData] = useState<any[]>([]);
  
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

  const [filters, setFilters] = useState<Partial<PerformanceReportFilters>>({group_by: 'date,offer_id'});
  const [reportOptions, setReportOptions] = useState<ReportColumnOptions | null>(null);
  const [activeFilters, setActiveFilters] = useState<any>({});

  // Fetch report data
  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await userReportsApi.getPerformanceReport({
        start_date: dateRange.start,
        end_date: dateRange.end,
        group_by: filters.group_by || 'date,offer_id',
        page: pagination.page,
        per_page: pagination.per_page,
        ...filters
      });

      if (response.success) {
        setData(response.report.data);
        setSummary(response.report.summary);
        setPagination(response.report.pagination);
      }
    } catch (error) {
      toast.error('Failed to load performance report');
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
        metric: 'conversions',
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
      await userReportsApi.exportReport('performance', {
        start_date: dateRange.start,
        end_date: dateRange.end,
        group_by: filters.group_by || 'date,offer_id',
        ...filters
      });
      toast.success('Report exported successfully');
    } catch (error) {
      toast.error('Failed to export report');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Performance Report</h1>
          <p className="text-muted-foreground">View your campaign performance metrics</p>
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
            reportType="performance"
            onOptionsChange={(options) => {
              setReportOptions(options);
              toast.success('Report options updated');
            }}
          />

          {/* Report Filters */}
          <ReportFilters
            onFiltersChange={(newFilters) => {
              setActiveFilters(newFilters);
              setFilters({ ...filters, ...newFilters });
              toast.success('Filters applied');
            }}
            availableOffers={[]}
          />
        </div>
      </Card>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Total Clicks</div>
            <div className="text-2xl font-bold">{summary.total_clicks.toLocaleString()}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Total Conversions</div>
            <div className="text-2xl font-bold">{summary.total_conversions.toLocaleString()}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Total Payout</div>
            <div className="text-2xl font-bold">${summary.total_payout.toFixed(2)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Avg CR</div>
            <div className="text-2xl font-bold">{summary.avg_cr.toFixed(2)}%</div>
          </Card>
        </div>
      )}

      {/* Performance Chart */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Performance Trends</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#8884d8" 
                strokeWidth={2}
                name="Conversions"
              />
            </LineChart>
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
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Offer</th>
                <th className="p-3 text-right">Clicks</th>
                <th className="p-3 text-right">Conversions</th>
                <th className="p-3 text-right">CR%</th>
                <th className="p-3 text-right">Payout</th>
                <th className="p-3 text-right">EPC</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No data available for selected date range
                  </td>
                </tr>
              ) : (
                data.map((row, idx) => (
                  <tr key={idx} className="border-b hover:bg-muted/50">
                    <td className="p-3">{row.date}</td>
                    <td className="p-3">{row.offer_name || row.offer_id || '-'}</td>
                    <td className="p-3 text-right">{row.clicks.toLocaleString()}</td>
                    <td className="p-3 text-right">{row.conversions.toLocaleString()}</td>
                    <td className="p-3 text-right">{row.cr.toFixed(2)}%</td>
                    <td className="p-3 text-right">${row.total_payout.toFixed(2)}</td>
                    <td className="p-3 text-right">${row.epc.toFixed(2)}</td>
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
    </div>
  );
}
