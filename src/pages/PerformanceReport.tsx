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
import { ColumnSelector, ColumnDefinition } from '../components/reports/ColumnSelector';

// Column definitions for Performance Report - ALL PHASES COMPLETE
const PERFORMANCE_COLUMNS: ColumnDefinition[] = [
  { id: 'date', label: 'Date', defaultVisible: true, alwaysVisible: true },
  { id: 'offer_name', label: 'Offer Name', defaultVisible: true },
  { id: 'offer_url', label: 'Offer URL', defaultVisible: false },
  { id: 'category', label: 'Category', defaultVisible: false },
  { id: 'currency', label: 'Currency', defaultVisible: false },
  { id: 'ad_group', label: 'Ad Group', defaultVisible: false },
  { id: 'goal', label: 'Goal', defaultVisible: false },
  { id: 'promo_code', label: 'Promo Code', defaultVisible: false },
  { id: 'creative', label: 'Creative', defaultVisible: false },
  { id: 'app_version', label: 'App Version', defaultVisible: false },
  { id: 'country', label: 'Country', defaultVisible: false },
  { id: 'browser', label: 'Browser', defaultVisible: false },
  { id: 'device_type', label: 'Device', defaultVisible: false },
  { id: 'source', label: 'Source', defaultVisible: false },
  { id: 'advertiser_sub_id1', label: 'Advertiser Sub ID 1', defaultVisible: false },
  { id: 'advertiser_sub_id2', label: 'Advertiser Sub ID 2', defaultVisible: false },
  { id: 'advertiser_sub_id3', label: 'Advertiser Sub ID 3', defaultVisible: false },
  { id: 'advertiser_sub_id4', label: 'Advertiser Sub ID 4', defaultVisible: false },
  { id: 'advertiser_sub_id5', label: 'Advertiser Sub ID 5', defaultVisible: false },
  { id: 'clicks', label: 'Clicks', defaultVisible: true },
  { id: 'gross_clicks', label: 'Gross Clicks', defaultVisible: false },
  { id: 'unique_clicks', label: 'Unique Clicks', defaultVisible: false },
  { id: 'suspicious_clicks', label: 'Suspicious Clicks', defaultVisible: false },
  { id: 'rejected_clicks', label: 'Rejected Clicks', defaultVisible: false },
  { id: 'conversions', label: 'Conversions', defaultVisible: true },
  { id: 'approved_conversions', label: 'Approved Conversions', defaultVisible: false },
  { id: 'total_payout', label: 'Payout', defaultVisible: true },
  { id: 'cr', label: 'CR%', defaultVisible: true },
  { id: 'epc', label: 'EPC', defaultVisible: true },
  { id: 'ctr', label: 'CTR%', defaultVisible: false },
  { id: 'unique_click_rate', label: 'Unique Click Rate%', defaultVisible: false },
  { id: 'suspicious_click_rate', label: 'Suspicious Rate%', defaultVisible: false },
  { id: 'rejected_click_rate', label: 'Rejected Rate%', defaultVisible: false },
  { id: 'cpa', label: 'CPA', defaultVisible: false },
  { id: 'cpc', label: 'CPC', defaultVisible: false },
  { id: 'cpm', label: 'CPM', defaultVisible: false },
  { id: 'avg_time_spent_seconds', label: 'Time Spent', defaultVisible: false },
];

export default function PerformanceReport() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PerformanceRow[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0, pages: 0 });
  const [chartData, setChartData] = useState<any[]>([]);
  
  // Date range state (default: includes test data from 2025)
  const [dateRange, setDateRange] = useState(() => {
    // Use a date range that includes our test data (2025-11-04 to 2025-11-12)
    return {
      start: '2025-11-01',
      end: '2025-11-15'
    };
  });

  const [filters, setFilters] = useState<Partial<PerformanceReportFilters>>({group_by: 'date,offer_id'});
  const [reportOptions, setReportOptions] = useState<ReportColumnOptions | null>(null);
  const [activeFilters, setActiveFilters] = useState<any>({});

  // Column visibility state - load from localStorage or use defaults
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('performance_visible_columns');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fall through to defaults
      }
    }
    // Default visibility
    return PERFORMANCE_COLUMNS.reduce((acc, col) => {
      acc[col.id] = col.defaultVisible;
      return acc;
    }, {} as Record<string, boolean>);
  });

  // Save column visibility to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('performance_visible_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  // Column handlers
  const handleColumnChange = (columnId: string, visible: boolean) => {
    setVisibleColumns(prev => ({ ...prev, [columnId]: visible }));
  };

  const handleSelectAllColumns = () => {
    const all = PERFORMANCE_COLUMNS.reduce((acc, col) => {
      acc[col.id] = true;
      return acc;
    }, {} as Record<string, boolean>);
    setVisibleColumns(all);
    toast.success('All columns selected');
  };

  const handleClearAllColumns = () => {
    const cleared = PERFORMANCE_COLUMNS.reduce((acc, col) => {
      acc[col.id] = col.alwaysVisible || false;
      return acc;
    }, {} as Record<string, boolean>);
    setVisibleColumns(cleared);
    toast.success('Columns cleared');
  };

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

          {/* Column Selector */}
          <ColumnSelector
            columns={PERFORMANCE_COLUMNS}
            visibleColumns={visibleColumns}
            onColumnChange={handleColumnChange}
            onSelectAll={handleSelectAllColumns}
            onClearAll={handleClearAllColumns}
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
                {visibleColumns.date && <th className="p-3 text-left">Date</th>}
                {visibleColumns.offer_name && <th className="p-3 text-left">Offer</th>}
                {visibleColumns.offer_url && <th className="p-3 text-left">Offer URL</th>}
                {visibleColumns.category && <th className="p-3 text-left">Category</th>}
                {visibleColumns.currency && <th className="p-3 text-left">Currency</th>}
                {visibleColumns.ad_group && <th className="p-3 text-left">Ad Group</th>}
                {visibleColumns.goal && <th className="p-3 text-left">Goal</th>}
                {visibleColumns.promo_code && <th className="p-3 text-left">Promo Code</th>}
                {visibleColumns.creative && <th className="p-3 text-left">Creative</th>}
                {visibleColumns.app_version && <th className="p-3 text-left">App Version</th>}
                {visibleColumns.country && <th className="p-3 text-left">Country</th>}
                {visibleColumns.browser && <th className="p-3 text-left">Browser</th>}
                {visibleColumns.device_type && <th className="p-3 text-left">Device</th>}
                {visibleColumns.source && <th className="p-3 text-left">Source</th>}
                {visibleColumns.advertiser_sub_id1 && <th className="p-3 text-left">Adv Sub 1</th>}
                {visibleColumns.advertiser_sub_id2 && <th className="p-3 text-left">Adv Sub 2</th>}
                {visibleColumns.advertiser_sub_id3 && <th className="p-3 text-left">Adv Sub 3</th>}
                {visibleColumns.advertiser_sub_id4 && <th className="p-3 text-left">Adv Sub 4</th>}
                {visibleColumns.advertiser_sub_id5 && <th className="p-3 text-left">Adv Sub 5</th>}
                {visibleColumns.clicks && <th className="p-3 text-right">Clicks</th>}
                {visibleColumns.gross_clicks && <th className="p-3 text-right">Gross Clicks</th>}
                {visibleColumns.unique_clicks && <th className="p-3 text-right">Unique</th>}
                {visibleColumns.suspicious_clicks && <th className="p-3 text-right">Suspicious</th>}
                {visibleColumns.rejected_clicks && <th className="p-3 text-right">Rejected</th>}
                {visibleColumns.conversions && <th className="p-3 text-right">Conversions</th>}
                {visibleColumns.approved_conversions && <th className="p-3 text-right">Approved</th>}
                {visibleColumns.total_payout && <th className="p-3 text-right">Payout</th>}
                {visibleColumns.cr && <th className="p-3 text-right">CR%</th>}
                {visibleColumns.epc && <th className="p-3 text-right">EPC</th>}
                {visibleColumns.ctr && <th className="p-3 text-right">CTR%</th>}
                {visibleColumns.unique_click_rate && <th className="p-3 text-right">Unique%</th>}
                {visibleColumns.suspicious_click_rate && <th className="p-3 text-right">Suspicious%</th>}
                {visibleColumns.rejected_click_rate && <th className="p-3 text-right">Rejected%</th>}
                {visibleColumns.cpa && <th className="p-3 text-right">CPA</th>}
                {visibleColumns.cpc && <th className="p-3 text-right">CPC</th>}
                {visibleColumns.cpm && <th className="p-3 text-right">CPM</th>}
                {visibleColumns.avg_time_spent_seconds && <th className="p-3 text-right">Time Spent</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={Object.values(visibleColumns).filter(Boolean).length} className="p-8 text-center text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={Object.values(visibleColumns).filter(Boolean).length} className="p-8 text-center text-muted-foreground">
                    No data available for selected date range
                  </td>
                </tr>
              ) : (
                data.map((row, idx) => (
                  <tr key={idx} className="border-b hover:bg-muted/50">
                    {visibleColumns.date && <td className="p-3">{row.date}</td>}
                    {visibleColumns.offer_name && <td className="p-3">{row.offer_name || row.offer_id || '-'}</td>}
                    {visibleColumns.offer_url && <td className="p-3 text-xs"><a href={row.offer_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{row.offer_url ? (row.offer_url.length > 40 ? row.offer_url.substring(0, 40) + '...' : row.offer_url) : '-'}</a></td>}
                    {visibleColumns.category && <td className="p-3">{row.category || '-'}</td>}
                    {visibleColumns.currency && <td className="p-3">{row.currency || 'USD'}</td>}
                    {visibleColumns.ad_group && <td className="p-3">{row.ad_group || '-'}</td>}
                    {visibleColumns.goal && <td className="p-3">{row.goal || '-'}</td>}
                    {visibleColumns.promo_code && <td className="p-3">{row.promo_code || '-'}</td>}
                    {visibleColumns.creative && <td className="p-3">{row.creative || '-'}</td>}
                    {visibleColumns.app_version && <td className="p-3">{row.app_version || '-'}</td>}
                    {visibleColumns.country && <td className="p-3">{row.country || '-'}</td>}
                    {visibleColumns.browser && <td className="p-3">{row.browser || '-'}</td>}
                    {visibleColumns.device_type && <td className="p-3">{row.device_type || '-'}</td>}
                    {visibleColumns.source && <td className="p-3 text-xs" title={row.source}>{row.source ? (row.source.length > 30 ? row.source.substring(0, 30) + '...' : row.source) : '-'}</td>}
                    {visibleColumns.advertiser_sub_id1 && <td className="p-3">{row.advertiser_sub_id1 || '-'}</td>}
                    {visibleColumns.advertiser_sub_id2 && <td className="p-3">{row.advertiser_sub_id2 || '-'}</td>}
                    {visibleColumns.advertiser_sub_id3 && <td className="p-3">{row.advertiser_sub_id3 || '-'}</td>}
                    {visibleColumns.advertiser_sub_id4 && <td className="p-3">{row.advertiser_sub_id4 || '-'}</td>}
                    {visibleColumns.advertiser_sub_id5 && <td className="p-3">{row.advertiser_sub_id5 || '-'}</td>}
                    {visibleColumns.clicks && <td className="p-3 text-right">{row.clicks.toLocaleString()}</td>}
                    {visibleColumns.gross_clicks && <td className="p-3 text-right">{row.gross_clicks?.toLocaleString() || 0}</td>}
                    {visibleColumns.unique_clicks && <td className="p-3 text-right">{row.unique_clicks?.toLocaleString() || 0}</td>}
                    {visibleColumns.suspicious_clicks && <td className="p-3 text-right">{row.suspicious_clicks?.toLocaleString() || 0}</td>}
                    {visibleColumns.rejected_clicks && <td className="p-3 text-right">{row.rejected_clicks?.toLocaleString() || 0}</td>}
                    {visibleColumns.conversions && <td className="p-3 text-right">{row.conversions.toLocaleString()}</td>}
                    {visibleColumns.approved_conversions && <td className="p-3 text-right">{row.approved_conversions?.toLocaleString() || 0}</td>}
                    {visibleColumns.total_payout && <td className="p-3 text-right">${row.total_payout.toFixed(2)}</td>}
                    {visibleColumns.cr && <td className="p-3 text-right">{row.cr?.toFixed(2) || 0}%</td>}
                    {visibleColumns.epc && <td className="p-3 text-right">${row.epc?.toFixed(2) || 0}</td>}
                    {visibleColumns.ctr && <td className="p-3 text-right">{row.ctr?.toFixed(2) || 0}%</td>}
                    {visibleColumns.unique_click_rate && <td className="p-3 text-right">{row.unique_click_rate?.toFixed(2) || 0}%</td>}
                    {visibleColumns.suspicious_click_rate && <td className="p-3 text-right">{row.suspicious_click_rate?.toFixed(2) || 0}%</td>}
                    {visibleColumns.rejected_click_rate && <td className="p-3 text-right">{row.rejected_click_rate?.toFixed(2) || 0}%</td>}
                    {visibleColumns.cpa && <td className="p-3 text-right">${row.cpa?.toFixed(2) || 0}</td>}
                    {visibleColumns.cpc && <td className="p-3 text-right">${row.cpc?.toFixed(2) || 0}</td>}
                    {visibleColumns.cpm && <td className="p-3 text-right">${row.cpm?.toFixed(2) || 0}</td>}
                    {visibleColumns.avg_time_spent_seconds && (
                      <td className="p-3 text-right">
                        {row.avg_time_spent_seconds ? 
                          (row.avg_time_spent_seconds < 60 ? 
                            `${Math.round(row.avg_time_spent_seconds)}s` : 
                            `${Math.round(row.avg_time_spent_seconds / 60)}m`
                          ) : '-'
                        }
                      </td>
                    )}
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
