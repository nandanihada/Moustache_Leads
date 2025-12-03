import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  Search,
  Filter,
  Download
} from 'lucide-react';
import { API_BASE_URL } from '../services/apiConfig';

interface FraudSignal {
  _id: string;
  user_id: string;
  signal_type: string;
  timestamp: string;
  severity: string;
  status: string;
  data: any;
}

const AdminFraudManagement: React.FC = () => {
  const [fraudSignals, setFraudSignals] = useState<FraudSignal[]>([]);
  const [filteredSignals, setFilteredSignals] = useState<FraudSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSignal, setSelectedSignal] = useState<FraudSignal | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

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
        setFraudSignals(data.data);
        setFilteredSignals(data.data);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Error fetching fraud signals:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch fraud signals');
    }
  };

  // Filter signals
  useEffect(() => {
    let filtered = fraudSignals;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(signal =>
        signal.user_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        signal.signal_type.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply severity filter
    if (severityFilter !== 'all') {
      filtered = filtered.filter(signal => signal.severity === severityFilter);
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(signal => signal.status === statusFilter);
    }

    setFilteredSignals(filtered);
  }, [fraudSignals, searchTerm, severityFilter, statusFilter]);

  // Refresh data
  const refreshData = async () => {
    setRefreshing(true);
    await fetchFraudSignals();
    setRefreshing(false);
  };

  // Handle signal action
  const handleSignalAction = async (signalId: string, action: 'approve' | 'reject') => {
    try {
      const token = localStorage.getItem('token');
      const status = action === 'approve' ? 'false_positive' : 'confirmed';

      const response = await fetch(`${API_BASE_URL}/api/admin/offerwall/fraud-signals/${signalId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        throw new Error('Failed to update signal status');
      }

      console.log(`✅ ${action} signal: ${signalId}`);
      setSelectedSignal(null);
      await refreshData();
    } catch (err) {
      console.error(`Error ${action}ing signal:`, err);
      alert(`Error updating signal: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Initial data load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchFraudSignals();
      setLoading(false);
    };

    loadData();
  }, []);

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'detected': return 'destructive';
      case 'reviewing': return 'default';
      case 'resolved': return 'secondary';
      case 'false_positive': return 'secondary';
      default: return 'secondary';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading fraud signals...</span>
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
          <h1 className="text-3xl font-bold">Fraud Management</h1>
          <p className="text-muted-foreground">Review and manage fraud detection signals</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={refreshData} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Signals</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fraudSignals.length}</div>
            <p className="text-xs text-muted-foreground">All fraud signals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Severity</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {fraudSignals.filter(s => s.severity === 'high').length}
            </div>
            <p className="text-xs text-muted-foreground">Requires immediate action</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Medium Severity</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {fraudSignals.filter(s => s.severity === 'medium').length}
            </div>
            <p className="text-xs text-muted-foreground">Needs review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {fraudSignals.filter(s => s.status === 'resolved').length}
            </div>
            <p className="text-xs text-muted-foreground">Successfully handled</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-64">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by user ID or signal type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="w-48">
              <Label htmlFor="severity">Severity</Label>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All severities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-48">
              <Label htmlFor="status">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="detected">Detected</SelectItem>
                  <SelectItem value="reviewing">Reviewing</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="false_positive">False Positive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fraud Signals Table */}
      <Card>
        <CardHeader>
          <CardTitle>Fraud Signals ({filteredSignals.length})</CardTitle>
          <CardDescription>Review and manage detected fraud signals</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredSignals.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Signal Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSignals.map((signal) => (
                  <TableRow key={signal._id}>
                    <TableCell className="font-mono">{signal.user_id}</TableCell>
                    <TableCell>{signal.signal_type}</TableCell>
                    <TableCell>
                      <Badge variant={getSeverityColor(signal.severity)}>
                        {signal.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(signal.status)}>
                        {signal.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(signal.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedSignal(signal)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No fraud signals found</p>
              <p className="text-sm">Try adjusting your filters</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fraud Signal Details Dialog */}
      <Dialog open={selectedSignal !== null} onOpenChange={(open) => !open && setSelectedSignal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Fraud Signal Details</DialogTitle>
            <DialogDescription>
              Review the details of this fraud signal
            </DialogDescription>
          </DialogHeader>
          {selectedSignal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>User ID</Label>
                  <p className="font-mono">{selectedSignal.user_id}</p>
                </div>
                <div>
                  <Label>Signal Type</Label>
                  <p>{selectedSignal.signal_type}</p>
                </div>
                <div>
                  <Label>Severity</Label>
                  <Badge variant={getSeverityColor(selectedSignal.severity)}>
                    {selectedSignal.severity}
                  </Badge>
                </div>
                <div>
                  <Label>Status</Label>
                  <Badge variant={getStatusColor(selectedSignal.status)}>
                    {selectedSignal.status}
                  </Badge>
                </div>
              </div>
              <div>
                <Label>Timestamp</Label>
                <p>{new Date(selectedSignal.timestamp).toLocaleString()}</p>
              </div>
              <div>
                <Label>Signal Data</Label>
                <pre className="bg-muted p-2 rounded text-sm overflow-auto">
                  {JSON.stringify(selectedSignal.data, null, 2)}
                </pre>
              </div>
              <div className="flex space-x-2">
                <Button
                  onClick={() => handleSignalAction(selectedSignal._id, 'approve')}
                  variant="outline"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark as False Positive
                </Button>
                <Button
                  onClick={() => handleSignalAction(selectedSignal._id, 'reject')}
                  variant="destructive"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Confirm Fraud
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminFraudManagement;
