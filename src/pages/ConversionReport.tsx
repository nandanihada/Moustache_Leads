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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { ColumnSelector, ColumnDefinition } from '../components/reports/ColumnSelector';

// Column definitions for Conversion Report - ALL FIELDS SAME AS PERFORMANCE REPORT
const CONVERSION_COLUMNS: ColumnDefinition[] = [
  { id: 'time', label: 'Time', defaultVisible: true, alwaysVisible: true },
  { id: 'transaction_id', label: 'Transaction ID', defaultVisible: true },
  { id: 'offer_name', label: 'Offer Name', defaultVisible: true },
  { id: 'offer_url', label: 'Offer URL', defaultVisible: false },
  { id: 'category', label: 'Category', defaultVisible: false },
  { id: 'currency', label: 'Currency', defaultVisible: false },
  { id: 'ad_group', label: 'Ad Group', defaultVisible: false },
  { id: 'goal', label: 'Goal', defaultVisible: false },
  { id: 'promo_code', label: 'Promo Code', defaultVisible: false },
  { id: 'creative', label: 'Creative', defaultVisible: false },
  { id: 'app_version', label: 'App Version', defaultVisible: false },
  { id: 'status', label: 'Status', defaultVisible: true },
  { id: 'payout', label: 'Payout', defaultVisible: true },
  { id: 'country', label: 'Country', defaultVisible: false },
  { id: 'browser', label: 'Browser', defaultVisible: false },
  { id: 'device_type', label: 'Device', defaultVisible: false },
  { id: 'source', label: 'Source', defaultVisible: false },
  { id: 'advertiser_sub_id1', label: 'Advertiser Sub ID 1', defaultVisible: false },
  { id: 'advertiser_sub_id2', label: 'Advertiser Sub ID 2', defaultVisible: false },
  { id: 'advertiser_sub_id3', label: 'Advertiser Sub ID 3', defaultVisible: false },
  { id: 'advertiser_sub_id4', label: 'Advertiser Sub ID 4', defaultVisible: false },
  { id: 'advertiser_sub_id5', label: 'Advertiser Sub ID 5', defaultVisible: false },
  { id: 'sub_id1', label: 'Sub ID 1', defaultVisible: false },
  { id: 'sub_id2', label: 'Sub ID 2', defaultVisible: false },
  { id: 'sub_id3', label: 'Sub ID 3', defaultVisible: false },
  { id: 'sub_id4', label: 'Sub ID 4', defaultVisible: false },
  { id: 'sub_id5', label: 'Sub ID 5', defaultVisible: false },
  { id: 'actions', label: 'Actions', defaultVisible: true, alwaysVisible: true },
];

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

  // Column visibility state - load from localStorage or use defaults
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('conversion_visible_columns');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fall through to defaults
      }
    }
    // Default visibility
    return CONVERSION_COLUMNS.reduce((acc, col) => {
      acc[col.id] = col.defaultVisible;
      return acc;
    }, {} as Record<string, boolean>);
  });

  // Save column visibility to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('conversion_visible_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  // Column handlers
  const handleColumnChange = (columnId: string, visible: boolean) => {
    setVisibleColumns(prev => ({ ...prev, [columnId]: visible }));
  };

  const handleSelectAllColumns = () => {
    const all = CONVERSION_COLUMNS.reduce((acc, col) => {
      acc[col.id] = true;
      return acc;
    }, {} as Record<string, boolean>);
    setVisibleColumns(all);
    toast.success('All columns selected');
  };

  const handleClearAllColumns = () => {
    const cleared = CONVERSION_COLUMNS.reduce((acc, col) => {
      acc[col.id] = col.alwaysVisible || false;
      return acc;
    }, {} as Record<string, boolean>);
    setVisibleColumns(cleared);
    toast.success('Columns cleared');
  };
  
  // Date range state (default: includes test data from 2025)
  const [dateRange, setDateRange] = useState(() => {
    // Use a date range that includes our test data (2025-11-04 to 2025-11-12)
    return {
      start: '2025-11-01',
      end: '2025-11-15'
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

          {/* Column Selector */}
          <ColumnSelector
            columns={CONVERSION_COLUMNS}
            visibleColumns={visibleColumns}
            onColumnChange={handleColumnChange}
            onSelectAll={handleSelectAllColumns}
            onClearAll={handleClearAllColumns}
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
                {visibleColumns.time && <th className="p-3 text-left">Time</th>}
                {visibleColumns.transaction_id && <th className="p-3 text-left">Transaction ID</th>}
                {visibleColumns.offer_name && <th className="p-3 text-left">Offer</th>}
                {visibleColumns.offer_url && <th className="p-3 text-left">Offer URL</th>}
                {visibleColumns.category && <th className="p-3 text-left">Category</th>}
                {visibleColumns.currency && <th className="p-3 text-left">Currency</th>}
                {visibleColumns.ad_group && <th className="p-3 text-left">Ad Group</th>}
                {visibleColumns.goal && <th className="p-3 text-left">Goal</th>}
                {visibleColumns.promo_code && <th className="p-3 text-left">Promo Code</th>}
                {visibleColumns.creative && <th className="p-3 text-left">Creative</th>}
                {visibleColumns.app_version && <th className="p-3 text-left">App Version</th>}
                {visibleColumns.status && <th className="p-3 text-left">Status</th>}
                {visibleColumns.payout && <th className="p-3 text-right">Payout</th>}
                {visibleColumns.country && <th className="p-3 text-left">Country</th>}
                {visibleColumns.browser && <th className="p-3 text-left">Browser</th>}
                {visibleColumns.device_type && <th className="p-3 text-left">Device</th>}
                {visibleColumns.source && <th className="p-3 text-left">Source</th>}
                {visibleColumns.advertiser_sub_id1 && <th className="p-3 text-left">Adv Sub 1</th>}
                {visibleColumns.advertiser_sub_id2 && <th className="p-3 text-left">Adv Sub 2</th>}
                {visibleColumns.advertiser_sub_id3 && <th className="p-3 text-left">Adv Sub 3</th>}
                {visibleColumns.advertiser_sub_id4 && <th className="p-3 text-left">Adv Sub 4</th>}
                {visibleColumns.advertiser_sub_id5 && <th className="p-3 text-left">Adv Sub 5</th>}
                {visibleColumns.sub_id1 && <th className="p-3 text-left">Sub ID 1</th>}
                {visibleColumns.sub_id2 && <th className="p-3 text-left">Sub ID 2</th>}
                {visibleColumns.sub_id3 && <th className="p-3 text-left">Sub ID 3</th>}
                {visibleColumns.sub_id4 && <th className="p-3 text-left">Sub ID 4</th>}
                {visibleColumns.sub_id5 && <th className="p-3 text-left">Sub ID 5</th>}
                {visibleColumns.actions && <th className="p-3 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={Object.values(visibleColumns).filter(Boolean).length} className="p-8 text-center text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              ) : conversions.length === 0 ? (
                <tr>
                  <td colSpan={Object.values(visibleColumns).filter(Boolean).length} className="p-8 text-center text-muted-foreground">
                    No conversions found for selected date range
                  </td>
                </tr>
              ) : (
                conversions.map((conv) => (
                  <tr key={conv._id} className="border-b hover:bg-muted/50">
                    {visibleColumns.time && (
                      <td className="p-3 text-sm">
                        {new Date(conv.time).toLocaleString()}
                      </td>
                    )}
                    {visibleColumns.transaction_id && (
                      <td className="p-3 font-mono text-xs">
                        {conv.transaction_id}
                      </td>
                    )}
                    {visibleColumns.offer_name && <td className="p-3">{conv.offer_name}</td>}
                    {visibleColumns.offer_url && <td className="p-3 text-xs"><a href={conv.offer_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{conv.offer_url ? (conv.offer_url.length > 40 ? conv.offer_url.substring(0, 40) + '...' : conv.offer_url) : '-'}</a></td>}
                    {visibleColumns.category && <td className="p-3">{conv.category || '-'}</td>}
                    {visibleColumns.currency && <td className="p-3">{conv.currency || 'USD'}</td>}
                    {visibleColumns.ad_group && <td className="p-3">{conv.ad_group || '-'}</td>}
                    {visibleColumns.goal && <td className="p-3">{conv.goal || '-'}</td>}
                    {visibleColumns.promo_code && <td className="p-3">{conv.promo_code || '-'}</td>}
                    {visibleColumns.creative && <td className="p-3">{conv.creative || '-'}</td>}
                    {visibleColumns.app_version && <td className="p-3">{conv.app_version || '-'}</td>}
                    {visibleColumns.status && <td className="p-3">{getStatusBadge(conv.status)}</td>}
                    {visibleColumns.payout && (
                      <td className="p-3 text-right font-semibold">
                        ${conv.payout.toFixed(2)}
                      </td>
                    )}
                    {visibleColumns.country && <td className="p-3">{conv.country}</td>}
                    {visibleColumns.browser && (
                      <td className="p-3 text-sm text-muted-foreground">
                        {conv.browser || '-'}
                      </td>
                    )}
                    {visibleColumns.device_type && (
                      <td className="p-3 text-sm text-muted-foreground">
                        {conv.device_type || '-'}
                      </td>
                    )}
                    {visibleColumns.source && <td className="p-3 text-xs" title={conv.source}>{conv.source ? (conv.source.length > 30 ? conv.source.substring(0, 30) + '...' : conv.source) : '-'}</td>}
                    {visibleColumns.advertiser_sub_id1 && <td className="p-3">{conv.advertiser_sub_id1 || '-'}</td>}
                    {visibleColumns.advertiser_sub_id2 && <td className="p-3">{conv.advertiser_sub_id2 || '-'}</td>}
                    {visibleColumns.advertiser_sub_id3 && <td className="p-3">{conv.advertiser_sub_id3 || '-'}</td>}
                    {visibleColumns.advertiser_sub_id4 && <td className="p-3">{conv.advertiser_sub_id4 || '-'}</td>}
                    {visibleColumns.advertiser_sub_id5 && <td className="p-3">{conv.advertiser_sub_id5 || '-'}</td>}
                    {visibleColumns.sub_id1 && <td className="p-3">{conv.sub_id1 || '-'}</td>}
                    {visibleColumns.sub_id2 && <td className="p-3">{conv.sub_id2 || '-'}</td>}
                    {visibleColumns.sub_id3 && <td className="p-3">{conv.sub_id3 || '-'}</td>}
                    {visibleColumns.sub_id4 && <td className="p-3">{conv.sub_id4 || '-'}</td>}
                    {visibleColumns.sub_id5 && <td className="p-3">{conv.sub_id5 || '-'}</td>}
                    {visibleColumns.actions && (
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

      {/* Conversion Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Conversion Details</DialogTitle>
            <DialogDescription>
              View detailed information about this conversion
            </DialogDescription>
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
