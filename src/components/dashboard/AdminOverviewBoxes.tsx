/**
 * Admin Dashboard Overview Boxes Component
 * Displays real-time statistics in both box and tabular views
 * All data is fetched from backend - NO FAKE DATA
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  AlertTriangle,
  Users,
  UserCheck,
  UserX,
  ShieldAlert,
  Gift,
  FileQuestion,
  Layout,
  Code,
  MousePointer,
  MousePointerClick,
  AlertCircle,
  TrendingUp,
  DollarSign,
  RotateCcw,
  XCircle,
  RefreshCw,
  LayoutGrid,
  List,
  Clock
} from 'lucide-react';
import { adminOverviewApi, OverviewStats, ErrorSummary } from '@/services/adminOverviewApi';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

type ViewMode = 'boxes' | 'table';

interface BoxConfig {
  key: string;
  title: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  adminOnly: boolean;
  showTotal: boolean;
  isCurrency?: boolean;
}

// Box configurations
const BOX_CONFIGS: BoxConfig[] = [
  { key: 'error_summary', title: 'Error Summary', icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-50', adminOnly: true, showTotal: true },
  { key: 'total_users', title: 'Total Users', icon: Users, color: 'text-blue-600', bgColor: 'bg-blue-50', adminOnly: false, showTotal: true },
  { key: 'active_users', title: 'Active Users', icon: UserCheck, color: 'text-green-600', bgColor: 'bg-green-50', adminOnly: false, showTotal: true },
  { key: 'fraud_users', title: 'Fraud Users', icon: ShieldAlert, color: 'text-orange-600', bgColor: 'bg-orange-50', adminOnly: true, showTotal: true },
  { key: 'failed_signups', title: 'Failed Signups', icon: UserX, color: 'text-red-500', bgColor: 'bg-red-50', adminOnly: false, showTotal: true },
  { key: 'total_offers', title: 'Total Offers', icon: Gift, color: 'text-purple-600', bgColor: 'bg-purple-50', adminOnly: false, showTotal: true },
  { key: 'requested_offers', title: 'Requested Offers', icon: FileQuestion, color: 'text-indigo-600', bgColor: 'bg-indigo-50', adminOnly: false, showTotal: true },
  { key: 'active_placements', title: 'Active Placements', icon: Layout, color: 'text-teal-600', bgColor: 'bg-teal-50', adminOnly: false, showTotal: true },
  { key: 'iframes_installed', title: 'Iframes Installed', icon: Code, color: 'text-cyan-600', bgColor: 'bg-cyan-50', adminOnly: false, showTotal: true },
  { key: 'clicks', title: 'Total Clicks', icon: MousePointer, color: 'text-blue-500', bgColor: 'bg-blue-50', adminOnly: false, showTotal: true },
  { key: 'unique_clicks', title: 'Unique Clicks', icon: MousePointerClick, color: 'text-emerald-600', bgColor: 'bg-emerald-50', adminOnly: false, showTotal: false },
  { key: 'suspicious_clicks', title: 'Suspicious Clicks', icon: AlertCircle, color: 'text-amber-600', bgColor: 'bg-amber-50', adminOnly: false, showTotal: false },
  { key: 'conversions', title: 'Conversions', icon: TrendingUp, color: 'text-green-600', bgColor: 'bg-green-50', adminOnly: false, showTotal: true },
  { key: 'revenue', title: 'Revenue', icon: DollarSign, color: 'text-emerald-600', bgColor: 'bg-emerald-50', adminOnly: true, showTotal: true, isCurrency: true },
  { key: 'reversals', title: 'Reversals', icon: RotateCcw, color: 'text-rose-600', bgColor: 'bg-rose-50', adminOnly: true, showTotal: true },
  { key: 'postback_failures', title: 'Postback Failures', icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-50', adminOnly: true, showTotal: true },
];

const AdminOverviewBoxes: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('boxes');
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const { user } = useAuth();

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Fetching overview stats...');
      const response = await adminOverviewApi.getOverviewStats();
      console.log('Overview stats response:', response);
      if (response.success) {
        setStats(response.stats);
        setLastUpdated(response.last_updated);
        setUserRole(response.user_role);
      } else {
        console.error('API returned success: false');
        toast.error('Failed to load overview statistics');
      }
    } catch (error: any) {
      console.error('Error fetching overview stats:', error);
      console.error('Error details:', error.response?.data || error.message);
      toast.error(error.response?.data?.error || 'Failed to load overview statistics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const isAdmin = userRole === 'admin' || user?.role === 'admin';

  const formatValue = (value: number | undefined, isCurrency?: boolean): string => {
    if (value === undefined || value === null) return '0';
    if (isCurrency) return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return value.toLocaleString();
  };

  const formatLastUpdated = (timestamp: string): string => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getStatValue = (key: string, field: 'total' | 'last_24h'): number => {
    if (!stats) return 0;
    const stat = stats[key as keyof OverviewStats];
    if (!stat) return 0;
    
    if (key === 'error_summary') {
      const errorStat = stat as ErrorSummary;
      return field === 'total' ? errorStat.total_7d : errorStat.total_24h;
    }
    
    if (typeof stat === 'object' && stat !== null) {
      return (stat as any)[field] ?? 0;
    }
    return 0;
  };

  // Filter boxes based on user role
  const visibleBoxes = BOX_CONFIGS.filter(box => !box.adminOnly || isAdmin);

  // Render Error Summary Box (special layout)
  const renderErrorSummaryBox = () => {
    if (!isAdmin || !stats?.error_summary) return null;
    const errors = stats.error_summary;
    
    return (
      <Card className="col-span-full border-red-200 bg-red-50/50">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <CardTitle className="text-lg font-semibold text-red-800">Error Summary</CardTitle>
            </div>
            <div className="flex gap-2">
              <Badge variant="destructive">{errors.total_24h} (24h)</Badge>
              <Badge variant="outline" className="border-red-300 text-red-700">{errors.total_7d} (7d)</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3 text-sm">
            <div className="p-2 bg-white rounded border">
              <div className="text-muted-foreground text-xs truncate">API Failures</div>
              <div className="font-semibold">{errors.api_failures_24h} / {errors.api_failures_7d}</div>
            </div>
            <div className="p-2 bg-white rounded border">
              <div className="text-muted-foreground text-xs truncate">Import Failures</div>
              <div className="font-semibold">{errors.offer_import_failures_24h} / {errors.offer_import_failures_7d}</div>
            </div>
            <div className="p-2 bg-white rounded border">
              <div className="text-muted-foreground text-xs truncate">Category Mismatch</div>
              <div className="font-semibold">{errors.category_mismatches_24h} / {errors.category_mismatches_7d}</div>
            </div>
            <div className="p-2 bg-white rounded border">
              <div className="text-muted-foreground text-xs truncate">Server Errors</div>
              <div className="font-semibold">{errors.server_errors_24h} / {errors.server_errors_7d}</div>
            </div>
            <div className="p-2 bg-white rounded border">
              <div className="text-muted-foreground text-xs truncate">CORS Issues</div>
              <div className="font-semibold">{errors.cors_issues_24h} / {errors.cors_issues_7d}</div>
            </div>
            <div className="p-2 bg-white rounded border">
              <div className="text-muted-foreground text-xs truncate">Inbound Postback</div>
              <div className="font-semibold">{errors.incoming_postback_failures_24h} / {errors.incoming_postback_failures_7d}</div>
            </div>
            <div className="p-2 bg-white rounded border">
              <div className="text-muted-foreground text-xs truncate">Outbound Postback</div>
              <div className="font-semibold">{errors.outgoing_postback_failures_24h} / {errors.outgoing_postback_failures_7d}</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Format: 24h / 7d</p>
        </CardContent>
      </Card>
    );
  };

  // Render single stat box
  const renderStatBox = (config: BoxConfig) => {
    if (config.key === 'error_summary') return null; // Handled separately
    
    const Icon = config.icon;
    const total = getStatValue(config.key, 'total');
    const last24h = getStatValue(config.key, 'last_24h');
    
    return (
      <Card key={config.key} className={`${config.bgColor}/30 border-${config.color.replace('text-', '')}/20`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{config.title}</CardTitle>
          <div className={`p-2 rounded-lg ${config.bgColor}`}>
            <Icon className={`h-4 w-4 ${config.color}`} />
          </div>
        </CardHeader>
        <CardContent>
          {config.showTotal ? (
            <>
              <div className="text-2xl font-bold">{formatValue(total, config.isCurrency)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className={last24h > 0 ? 'text-green-600' : 'text-muted-foreground'}>
                  +{formatValue(last24h, config.isCurrency)}
                </span>
                {' '}in last 24h
              </p>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold">{formatValue(last24h)}</div>
              <p className="text-xs text-muted-foreground mt-1">Last 24 hours</p>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  // Render box view
  const renderBoxView = () => (
    <div className="space-y-4">
      {/* Error Summary - Fixed at top for admin */}
      {renderErrorSummaryBox()}
      
      {/* Other boxes in responsive grid */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {visibleBoxes.filter(b => b.key !== 'error_summary').map(renderStatBox)}
      </div>
    </div>
  );

  // Render table view
  const renderTableView = () => (
    <Card>
      <CardHeader>
        <CardTitle>Overview Statistics</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px]">Metric</TableHead>
              <TableHead className="text-right min-w-[100px]">Total</TableHead>
              <TableHead className="text-right min-w-[100px]">Last 24h</TableHead>
              <TableHead className="text-center min-w-[80px]">Visibility</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleBoxes.map((config) => {
              const Icon = config.icon;
              const total = getStatValue(config.key, 'total');
              const last24h = getStatValue(config.key, 'last_24h');
              
              return (
                <TableRow key={config.key}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded ${config.bgColor} flex-shrink-0`}>
                        <Icon className={`h-4 w-4 ${config.color}`} />
                      </div>
                      <span className="font-medium whitespace-nowrap">{config.title}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {config.showTotal ? formatValue(total, config.isCurrency) : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={last24h > 0 ? 'default' : 'secondary'}>
                      {config.isCurrency ? '+' : ''}{formatValue(last24h, config.isCurrency)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={config.adminOnly ? 'destructive' : 'outline'}>
                      {config.adminOnly ? 'Admin' : 'All'}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-48">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading statistics...</span>
      </div>
    );
  }

  // Show empty state if no stats loaded
  if (!stats) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 flex-shrink-0" />
            <span>Unable to load statistics</span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Retry
          </Button>
        </div>
        <Card className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
          <p className="text-muted-foreground">Could not load overview statistics.</p>
          <p className="text-sm text-muted-foreground mt-2">Please check if the backend server is running and try again.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">Last Updated: {formatLastUpdated(lastUpdated)}</span>
          {loading && <RefreshCw className="h-3 w-3 animate-spin ml-2 flex-shrink-0" />}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={viewMode === 'boxes' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('boxes')}
          >
            <LayoutGrid className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Boxes</span>
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('table')}
          >
            <List className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Table</span>
          </Button>
          <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
            <RefreshCw className={`h-4 w-4 sm:mr-1 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Content based on view mode */}
      {viewMode === 'boxes' ? renderBoxView() : renderTableView()}
    </div>
  );
};

export default AdminOverviewBoxes;
