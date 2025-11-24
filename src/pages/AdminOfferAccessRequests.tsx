import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Search, 
  Filter, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Eye, 
  MoreHorizontal,
  TrendingUp,
  Users,
  FileText,
  AlertCircle
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface AccessRequest {
  _id: string;
  request_id: string;
  offer_id: string;
  user_id: string;
  username: string;
  email: string;
  message: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  approved_at?: string;
  rejected_at?: string;
  approval_notes?: string;
  rejection_reason?: string;
  offer_details?: {
    name: string;
    payout: number;
    network: string;
    approval_settings: any;
  };
  user_details?: {
    username: string;
    email: string;
    account_type: string;
  };
}

interface RequestStats {
  total_requests: number;
  pending_requests: number;
  approved_requests: number;
  rejected_requests: number;
  approval_rate: number;
  requests_by_offer: Array<{
    _id: string;
    offer_name: string;
    offer_payout: number;
    total_requests: number;
    pending: number;
    approved: number;
    rejected: number;
  }>;
}

const AdminOfferAccessRequests: React.FC = () => {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [stats, setStats] = useState<RequestStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    type: 'approve' | 'reject' | 'view';
    request?: AccessRequest;
  }>({ open: false, type: 'approve' });
  const [actionNotes, setActionNotes] = useState('');
  const [filters, setFilters] = useState({
    status: 'all',
    search: '',
    offer_id: '',
    offer_name: '',
    user_id: '',
    user_name: '',
    date_from: '',
    date_to: '',
    category: '',
    device: '',
    page: 1,
    per_page: 20
  });

  // Fetch access requests
  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem('token');
      const queryParams = new URLSearchParams({
        status: filters.status,
        page: filters.page.toString(),
        per_page: filters.per_page.toString(),
        ...(filters.search && { search: filters.search }),
        ...(filters.offer_id && { offer_id: filters.offer_id }),
        ...(filters.offer_name && { offer_name: filters.offer_name }),
        ...(filters.user_id && { user_id: filters.user_id }),
        ...(filters.user_name && { user_name: filters.user_name }),
        ...(filters.date_from && { date_from: filters.date_from }),
        ...(filters.date_to && { date_to: filters.date_to }),
        ...(filters.category && { category: filters.category }),
        ...(filters.device && { device: filters.device })
      });

      const response = await fetch(`/api/admin/offer-access-requests?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch requests');
      }

      const data = await response.json();
      setRequests(data.requests || []);
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast.error('Failed to load access requests');
    }
  };

  // Fetch statistics
  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/offer-access-requests/stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }

      const data = await response.json();
      setStats(data.stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // Handle approve request
  const handleApproveRequest = async (requestId: string, notes: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/offer-access-requests/${requestId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ notes })
      });

      if (!response.ok) {
        throw new Error('Failed to approve request');
      }

      toast.success('Request approved successfully');
      fetchRequests();
      fetchStats();
      setActionDialog({ open: false, type: 'approve' });
      setActionNotes('');
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error('Failed to approve request');
    }
  };

  // Handle reject request
  const handleRejectRequest = async (requestId: string, reason: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/offer-access-requests/${requestId}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });

      if (!response.ok) {
        throw new Error('Failed to reject request');
      }

      toast.success('Request rejected successfully');
      fetchRequests();
      fetchStats();
      setActionDialog({ open: false, type: 'reject' });
      setActionNotes('');
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Failed to reject request');
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="text-green-600 border-green-600"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="text-red-600 border-red-600"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchRequests(), fetchStats()]).finally(() => setLoading(false));
  }, [filters]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Offer Access Requests</h1>
          <p className="text-muted-foreground">
            Manage publisher access requests for offers
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_requests}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending_requests}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.approved_requests}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.approval_rate}%</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Advanced Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Advanced Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Row 1: Search and Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Search</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Username, email, offer..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
                  className="pl-8"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Status</label>
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters({ ...filters, status: value, page: 1 })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Offer ID</label>
              <Input
                placeholder="ML-00001"
                value={filters.offer_id}
                onChange={(e) => setFilters({ ...filters, offer_id: e.target.value, page: 1 })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Offer Name</label>
              <Input
                placeholder="Offer name..."
                value={filters.offer_name}
                onChange={(e) => setFilters({ ...filters, offer_name: e.target.value, page: 1 })}
              />
            </div>
          </div>

          {/* Row 2: User Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">User ID</label>
              <Input
                placeholder="User ID..."
                value={filters.user_id}
                onChange={(e) => setFilters({ ...filters, user_id: e.target.value, page: 1 })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">User Name</label>
              <Input
                placeholder="Username..."
                value={filters.user_name}
                onChange={(e) => setFilters({ ...filters, user_name: e.target.value, page: 1 })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Category</label>
              <Select
                value={filters.category || "all-categories"}
                onValueChange={(value) => setFilters({ ...filters, category: value === "all-categories" ? "" : value, page: 1 })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-categories">All Categories</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="gaming">Gaming</SelectItem>
                  <SelectItem value="dating">Dating</SelectItem>
                  <SelectItem value="shopping">Shopping</SelectItem>
                  <SelectItem value="health">Health</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Device</label>
              <Select
                value={filters.device || "all-devices"}
                onValueChange={(value) => setFilters({ ...filters, device: value === "all-devices" ? "" : value, page: 1 })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Devices" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-devices">All Devices</SelectItem>
                  <SelectItem value="mobile">Mobile</SelectItem>
                  <SelectItem value="desktop">Desktop</SelectItem>
                  <SelectItem value="tablet">Tablet</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Date From</label>
              <Input
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters({ ...filters, date_from: e.target.value, page: 1 })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Date To</label>
              <Input
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters({ ...filters, date_to: e.target.value, page: 1 })}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                onClick={() => setFilters({
                  status: 'all',
                  search: '',
                  offer_id: '',
                  offer_name: '',
                  user_id: '',
                  user_name: '',
                  date_from: '',
                  date_to: '',
                  category: '',
                  device: '',
                  page: 1,
                  per_page: 20
                })}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>Access Requests</CardTitle>
          <CardDescription>
            {requests.length} request(s) found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Publisher</TableHead>
                <TableHead>Offer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request._id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{request.username}</div>
                      <div className="text-sm text-muted-foreground">{request.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{request.offer_details?.name || request.offer_id}</div>
                      <div className="text-sm text-muted-foreground">
                        ${request.offer_details?.payout} • {request.offer_details?.network}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(request.status)}</TableCell>
                  <TableCell>{formatDate(request.requested_at)}</TableCell>
                  <TableCell>
                    <div className="max-w-[200px] truncate" title={request.message}>
                      {request.message || 'No message'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => setActionDialog({ 
                            open: true, 
                            type: 'view', 
                            request 
                          })}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        {request.status === 'pending' && (
                          <>
                            <DropdownMenuItem
                              onClick={() => setActionDialog({ 
                                open: true, 
                                type: 'approve', 
                                request 
                              })}
                            >
                              <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                              Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setActionDialog({ 
                                open: true, 
                                type: 'reject', 
                                request 
                              })}
                            >
                              <XCircle className="mr-2 h-4 w-4 text-red-600" />
                              Reject
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={actionDialog.open} onOpenChange={(open) => setActionDialog({ ...actionDialog, open })}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {actionDialog.type === 'approve' && 'Approve Request'}
              {actionDialog.type === 'reject' && 'Reject Request'}
              {actionDialog.type === 'view' && 'Request Details'}
            </DialogTitle>
            <DialogDescription>
              {actionDialog.type === 'approve' && 'Approve this publisher\'s access request'}
              {actionDialog.type === 'reject' && 'Reject this publisher\'s access request'}
              {actionDialog.type === 'view' && 'View detailed information about this request'}
            </DialogDescription>
          </DialogHeader>
          
          {actionDialog.request && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Publisher</Label>
                  <p className="text-sm">{actionDialog.request.username}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Email</Label>
                  <p className="text-sm">{actionDialog.request.email}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Offer</Label>
                  <p className="text-sm">{actionDialog.request.offer_details?.name || actionDialog.request.offer_id}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Payout</Label>
                  <p className="text-sm">${actionDialog.request.offer_details?.payout}</p>
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium">Message</Label>
                <p className="text-sm mt-1 p-2 bg-gray-50 rounded">
                  {actionDialog.request.message || 'No message provided'}
                </p>
              </div>

              {actionDialog.type !== 'view' && (
                <div>
                  <Label htmlFor="notes">
                    {actionDialog.type === 'approve' ? 'Approval Notes (Optional)' : 'Rejection Reason'}
                  </Label>
                  <Textarea
                    id="notes"
                    placeholder={
                      actionDialog.type === 'approve' 
                        ? 'Add any notes for this approval...' 
                        : 'Please provide a reason for rejection...'
                    }
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setActionDialog({ open: false, type: 'approve' })}
            >
              Cancel
            </Button>
            {actionDialog.type === 'approve' && (
              <Button 
                onClick={() => handleApproveRequest(actionDialog.request!.request_id, actionNotes)}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Approve Request
              </Button>
            )}
            {actionDialog.type === 'reject' && (
              <Button 
                variant="destructive"
                onClick={() => handleRejectRequest(actionDialog.request!.request_id, actionNotes)}
                disabled={!actionNotes.trim()}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Reject Request
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminOfferAccessRequests;
