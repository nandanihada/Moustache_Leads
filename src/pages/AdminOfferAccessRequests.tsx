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
import { Checkbox } from '@/components/ui/checkbox';
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
  FileText,
  Camera,
  Star,
  ThumbsUp,
  ThumbsDown,
  Loader2,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { API_BASE_URL } from '../services/apiConfig';
import { AdminPageGuard } from '@/components/AdminPageGuard';

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
  has_placement_proof?: boolean;
  proof_status?: string;
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

interface PlacementProof {
  _id: string;
  user_id: string;
  offer_id: string;
  offer_name: string;
  placement_url: string;
  traffic_source: string;
  description: string;
  image_urls: string[];
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  reviewed_at?: string;
  user_info?: { username: string; email: string; name: string };
  admin_notes?: string;
  score?: number;
}

const AdminOfferAccessRequests: React.FC = () => {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [stats, setStats] = useState<RequestStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0, pages: 1 });
  const [activeTab, setActiveTab] = useState('requests');
  const [showFilters, setShowFilters] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    type: 'approve' | 'reject' | 'view';
    request?: AccessRequest;
  }>({ open: false, type: 'approve' });
  const [actionNotes, setActionNotes] = useState('');

  // Placement proofs state
  const [proofs, setProofs] = useState<PlacementProof[]>([]);
  const [proofsLoading, setProofsLoading] = useState(false);
  const [proofStatusFilter, setProofStatusFilter] = useState('all');
  const [selectedProof, setSelectedProof] = useState<PlacementProof | null>(null);
  const [proofDialog, setProofDialog] = useState(false);
  const [proofReviewNotes, setProofReviewNotes] = useState('');
  const [proofScore, setProofScore] = useState(3);

  // Bulk selection state
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(new Set());
  const [selectedProofIds, setSelectedProofIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkRejectDialog, setBulkRejectDialog] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState('');
  const [bulkRejectType, setBulkRejectType] = useState<'requests' | 'proofs'>('requests');

  const fetchProofs = async () => {
    setProofsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/placement-proofs/admin/all?page=1&per_page=100&status=${proofStatusFilter}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setProofs(data.proofs || []);
    } catch {
      toast.error('Failed to load placement proofs');
    } finally {
      setProofsLoading(false);
    }
  };

  const handleReviewProof = async (proofId: string, status: 'approved' | 'rejected') => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/api/placement-proofs/admin/${proofId}/review`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_notes: proofReviewNotes, score: proofScore }),
      });
      toast.success(`Proof ${status}`);
      setProofDialog(false);
      setSelectedProof(null);
      setProofReviewNotes('');
      fetchProofs();
    } catch {
      toast.error('Failed to review proof');
    }
  };

  // Bulk operations for access requests
  const handleBulkApproveRequests = async (ids?: string[]) => {
    const requestIds = ids || Array.from(selectedRequestIds);
    if (requestIds.length === 0) return;
    try {
      setBulkLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/admin/offer-access-requests/bulk-approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_ids: requestIds })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success(data.message);
      setSelectedRequestIds(new Set());
      fetchRequests();
      fetchStats();
    } catch (error: any) {
      toast.error(error.message || 'Bulk approve failed');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkRejectRequests = async () => {
    if (selectedRequestIds.size === 0) return;
    try {
      setBulkLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/admin/offer-access-requests/bulk-reject`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_ids: Array.from(selectedRequestIds), reason: bulkRejectReason })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success(data.message);
      setSelectedRequestIds(new Set());
      setBulkRejectDialog(false);
      setBulkRejectReason('');
      fetchRequests();
      fetchStats();
    } catch (error: any) {
      toast.error(error.message || 'Bulk reject failed');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkReviewProofs = async (status: 'approved' | 'rejected') => {
    if (selectedProofIds.size === 0) return;
    try {
      setBulkLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/placement-proofs/admin/bulk-review`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ proof_ids: Array.from(selectedProofIds), status, admin_notes: '', score: 3 })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success(data.message);
      setSelectedProofIds(new Set());
      fetchProofs();
    } catch (error: any) {
      toast.error(error.message || 'Bulk review failed');
    } finally {
      setBulkLoading(false);
    }
  };

  const toggleRequestSelect = (id: string) => {
    setSelectedRequestIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleProofSelect = (id: string) => {
    setSelectedProofIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const pendingProofs = proofs.filter(p => p.status === 'pending');
  const allPendingRequestsSelected = pendingRequests.length > 0 && pendingRequests.every(r => selectedRequestIds.has(r.request_id));
  const allPendingProofsSelected = pendingProofs.length > 0 && pendingProofs.every(p => selectedProofIds.has(p._id));

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
    has_proof: '',
    page: 1,
    per_page: 20
  });

  const setPage = (p: number) => setFilters(f => ({ ...f, page: p }));

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
        ...(filters.device && { device: filters.device }),
        ...(filters.has_proof && { has_proof: filters.has_proof }),
      });

      const response = await fetch(`${API_BASE_URL}/api/admin/offer-access-requests?${queryParams}`, {
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
      if (data.pagination) setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast.error('Failed to load access requests');
    }
  };

  // Fetch statistics
  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/admin/offer-access-requests/stats`, {
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
      const response = await fetch(`${API_BASE_URL}/api/admin/offer-access-requests/${requestId}/approve`, {
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
      const response = await fetch(`${API_BASE_URL}/api/admin/offer-access-requests/${requestId}/reject`, {
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

  useEffect(() => {
    if (activeTab === 'proofs') fetchProofs();
  }, [activeTab, proofStatusFilter]);

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
          <p className="text-muted-foreground">Manage publisher access requests for offers</p>
        </div>
        {stats && (
          <Button variant="outline" size="sm" onClick={() => setShowStats(v => !v)} className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Stats {showStats ? '▲' : '▼'}
          </Button>
        )}
      </div>

      {/* Statistics Cards - collapsible */}
      {stats && showStats && (
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="requests" className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> Access Requests
          </TabsTrigger>
          <TabsTrigger value="proofs" className="flex items-center gap-2">
            <Camera className="h-4 w-4" /> Placement Proofs
          </TabsTrigger>
        </TabsList>

        {/* ── ACCESS REQUESTS TAB ── */}
        <TabsContent value="requests" className="space-y-4 mt-4">
      {/* Advanced Filters - collapsible */}
      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(v => !v)}
          className="flex items-center gap-2"
        >
          <Filter className="h-4 w-4" />
          Filters
          {showFilters ? <span className="text-xs text-muted-foreground">▲</span> : <span className="text-xs text-muted-foreground">▼</span>}
        </Button>

        {showFilters && (
        <Card className="mt-2">
        <CardContent className="pt-4 space-y-4">
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
            <div>
              <label className="text-sm font-medium mb-1 block">Placement Proof</label>
              <Select
                value={filters.has_proof || 'all-proof'}
                onValueChange={(value) => setFilters({ ...filters, has_proof: value === 'all-proof' ? '' : value, page: 1 })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Requests" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-proof">All Requests</SelectItem>
                  <SelectItem value="yes">✅ With Proof</SelectItem>
                  <SelectItem value="no">❌ Without Proof</SelectItem>
                </SelectContent>
              </Select>
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
                  has_proof: '',
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
        )}
      </div>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-4">
              <div>
                <CardTitle>Access Requests</CardTitle>
                <CardDescription>{pagination.total} request(s) found</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page:</span>
                <Select
                  value={filters.per_page.toString()}
                  onValueChange={(val) => setFilters(f => ({ ...f, per_page: parseInt(val), page: 1 }))}
                >
                  <SelectTrigger className="w-20 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {pendingRequests.length > 0 && (
              <div className="flex gap-2 items-center">
                {selectedRequestIds.size > 0 && (
                  <>
                    <span className="text-sm text-muted-foreground">{selectedRequestIds.size} selected</span>
                    <Button size="sm" variant="outline" className="text-green-600 hover:bg-green-50" onClick={() => handleBulkApproveRequests()} disabled={bulkLoading}>
                      {bulkLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                      Approve Selected
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => { setBulkRejectType('requests'); setBulkRejectReason(''); setBulkRejectDialog(true); }} disabled={bulkLoading}>
                      <XCircle className="h-4 w-4 mr-1" />Reject Selected
                    </Button>
                  </>
                )}
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleBulkApproveRequests(pendingRequests.map(r => r.request_id))} disabled={bulkLoading}>
                  {bulkLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                  Approve All ({pendingRequests.length})
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
          <Table>
            <TableHeader>
              <TableRow>
                {pendingRequests.length > 0 && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allPendingRequestsSelected}
                      onCheckedChange={() => {
                        if (allPendingRequestsSelected) setSelectedRequestIds(new Set());
                        else setSelectedRequestIds(new Set(pendingRequests.map(r => r.request_id)));
                      }}
                      aria-label="Select all"
                    />
                  </TableHead>
                )}
                <TableHead className="whitespace-nowrap">Publisher</TableHead>
                <TableHead className="whitespace-nowrap">Offer</TableHead>
                <TableHead className="whitespace-nowrap">Proof</TableHead>
                <TableHead className="whitespace-nowrap">Status</TableHead>
                <TableHead className="whitespace-nowrap">Requested</TableHead>
                <TableHead className="whitespace-nowrap">Approved At</TableHead>
                <TableHead className="whitespace-nowrap">Message</TableHead>
                <TableHead className="whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request._id} className={selectedRequestIds.has(request.request_id) ? "bg-blue-50" : ""}>
                  {pendingRequests.length > 0 && (
                    <TableCell>
                      {request.status === 'pending' && (
                        <Checkbox checked={selectedRequestIds.has(request.request_id)} onCheckedChange={() => toggleRequestSelect(request.request_id)} aria-label={`Select ${request.username}`} />
                      )}
                    </TableCell>
                  )}
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
                  <TableCell>
                    {request.has_placement_proof ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                        ✅ Submitted
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        — None
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(request.status)}</TableCell>
                  <TableCell>{formatDate(request.requested_at)}</TableCell>
                  <TableCell>{request.approved_at ? formatDate(request.approved_at) : '—'}</TableCell>
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
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-2">
          <p className="text-sm text-muted-foreground">
            Showing {((pagination.page - 1) * pagination.per_page) + 1}–{Math.min(pagination.page * pagination.per_page, pagination.total)} of {pagination.total} requests
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(1)}
              disabled={pagination.page === 1}
            >«</Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(pagination.page - 1)}
              disabled={pagination.page === 1}
            >‹ Prev</Button>
            {Array.from({ length: pagination.pages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === pagination.pages || Math.abs(p - pagination.page) <= 2)
              .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === '...' ? (
                  <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground">…</span>
                ) : (
                  <Button
                    key={p}
                    variant={pagination.page === p ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPage(p as number)}
                    className="w-8"
                  >{p}</Button>
                )
              )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(pagination.page + 1)}
              disabled={pagination.page === pagination.pages}
            >Next ›</Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(pagination.pages)}
              disabled={pagination.page === pagination.pages}
            >»</Button>
          </div>
        </div>
      )}
        </TabsContent>

        {/* ── PLACEMENT PROOFS TAB ── */}
        <TabsContent value="proofs" className="space-y-4 mt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={proofStatusFilter} onValueChange={setProofStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Proofs</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">{proofs.length} proof(s)</span>
            {pendingProofs.length > 0 && (
              <div className="flex gap-2 items-center ml-auto">
                {selectedProofIds.size > 0 && (
                  <>
                    <span className="text-sm text-muted-foreground">{selectedProofIds.size} selected</span>
                    <Button size="sm" variant="outline" className="text-green-600 hover:bg-green-50" onClick={() => handleBulkReviewProofs('approved')} disabled={bulkLoading}>
                      {bulkLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ThumbsUp className="h-4 w-4 mr-1" />}
                      Approve Selected
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => handleBulkReviewProofs('rejected')} disabled={bulkLoading}>
                      <ThumbsDown className="h-4 w-4 mr-1" />Reject Selected
                    </Button>
                  </>
                )}
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={async () => {
                  const allIds = pendingProofs.map(p => p._id);
                  try {
                    setBulkLoading(true);
                    const token = localStorage.getItem('token');
                    const response = await fetch(`${API_BASE_URL}/api/placement-proofs/admin/bulk-review`, {
                      method: 'PUT',
                      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ proof_ids: allIds, status: 'approved', admin_notes: '', score: 3 })
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error);
                    toast.success(data.message);
                    setSelectedProofIds(new Set());
                    fetchProofs();
                  } catch (error: any) {
                    toast.error(error.message || 'Approve all failed');
                  } finally {
                    setBulkLoading(false);
                  }
                }} disabled={bulkLoading}>
                  {bulkLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                  Approve All ({pendingProofs.length})
                </Button>
              </div>
            )}
          </div>
          <Card>
            <CardContent className="p-0">
              {proofsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {pendingProofs.length > 0 && (
                        <TableHead className="w-10">
                          <Checkbox
                            checked={allPendingProofsSelected}
                            onCheckedChange={() => {
                              if (allPendingProofsSelected) setSelectedProofIds(new Set());
                              else setSelectedProofIds(new Set(pendingProofs.map(p => p._id)));
                            }}
                            aria-label="Select all proofs"
                          />
                        </TableHead>
                      )}
                      <TableHead>Publisher</TableHead>
                      <TableHead>Offer</TableHead>
                      <TableHead>Traffic Source</TableHead>
                      <TableHead>Images</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Reviewed At</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {proofs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">No proofs found</TableCell>
                      </TableRow>
                    ) : proofs.map((proof) => (
                      <TableRow key={proof._id} className={selectedProofIds.has(proof._id) ? "bg-blue-50" : ""}>
                        {pendingProofs.length > 0 && (
                          <TableCell>
                            {proof.status === 'pending' && (
                              <Checkbox checked={selectedProofIds.has(proof._id)} onCheckedChange={() => toggleProofSelect(proof._id)} aria-label={`Select proof`} />
                            )}
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="font-medium">{proof.user_info?.username || proof.user_id}</div>
                          <div className="text-xs text-muted-foreground">{proof.user_info?.email}</div>
                        </TableCell>
                        <TableCell><div className="font-medium">{proof.offer_name || proof.offer_id}</div></TableCell>
                        <TableCell><span className="capitalize text-sm">{proof.traffic_source || '—'}</span></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {(proof.image_urls || []).slice(0, 3).map((url, i) => (
                              <img key={i} src={`${API_BASE_URL}/api/placement-proofs/image/${url.split('/').pop()}`} alt="" className="w-8 h-8 rounded object-cover border" />
                            ))}
                            {(proof.image_urls || []).length === 0 && <span className="text-xs text-muted-foreground">None</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {proof.status === 'pending' && <Badge variant="outline" className="text-yellow-600 border-yellow-600"><Clock className="w-3 h-3 mr-1" />Pending</Badge>}
                          {proof.status === 'approved' && <Badge variant="outline" className="text-green-600 border-green-600"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>}
                          {proof.status === 'rejected' && <Badge variant="outline" className="text-red-600 border-red-600"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>}
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(proof.submitted_at)}</TableCell>
                        <TableCell className="text-sm">{proof.reviewed_at ? formatDate(proof.reviewed_at) : '—'}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedProof(proof); setProofDialog(true); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Proof Review Dialog */}
      <Dialog open={proofDialog} onOpenChange={setProofDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Camera className="h-4 w-4" /> Placement Proof</DialogTitle>
          </DialogHeader>
          {selectedProof && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><Label>Publisher</Label><p>{selectedProof.user_info?.username || selectedProof.user_id}</p></div>
                <div><Label>Offer</Label><p>{selectedProof.offer_name}</p></div>
                <div><Label>Traffic Source</Label><p className="capitalize">{selectedProof.traffic_source || '—'}</p></div>
                <div><Label>Status</Label><p className="capitalize">{selectedProof.status}</p></div>
              </div>
              {selectedProof.placement_url && (
                <div><Label>Placement URL</Label>
                  <a href={selectedProof.placement_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline break-all">{selectedProof.placement_url}</a>
                </div>
              )}
              {selectedProof.description && (
                <div><Label>Notes</Label><p className="text-sm p-2 bg-gray-50 rounded">{selectedProof.description}</p></div>
              )}
              {(selectedProof.image_urls || []).length > 0 && (
                <div>
                  <Label>Screenshots</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedProof.image_urls.map((url, i) => (
                      <a key={i} href={`${API_BASE_URL}/api/placement-proofs/image/${url.split('/').pop()}`} target="_blank" rel="noreferrer">
                        <img src={`${API_BASE_URL}/api/placement-proofs/image/${url.split('/').pop()}`} alt="" className="w-24 h-24 rounded object-cover border hover:opacity-80" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {selectedProof.status === 'pending' && (
                <>
                  <div>
                    <Label>Score (1-5)</Label>
                    <div className="flex gap-1 mt-1">
                      {[1,2,3,4,5].map(s => (
                        <button key={s} onClick={() => setProofScore(s)}>
                          <Star className={`h-6 w-6 ${s <= proofScore ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Admin Notes</Label>
                    <Textarea value={proofReviewNotes} onChange={e => setProofReviewNotes(e.target.value)} placeholder="Optional notes..." className="mt-1" rows={2} />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setProofDialog(false)}>Cancel</Button>
                    <Button variant="destructive" onClick={() => handleReviewProof(selectedProof._id, 'rejected')}>
                      <ThumbsDown className="h-4 w-4 mr-1" /> Reject
                    </Button>
                    <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleReviewProof(selectedProof._id, 'approved')}>
                      <ThumbsUp className="h-4 w-4 mr-1" /> Approve
                    </Button>
                  </DialogFooter>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
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

      {/* Bulk Reject Dialog */}
      <Dialog open={bulkRejectDialog} onOpenChange={setBulkRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Reject</DialogTitle>
            <DialogDescription>Reject {bulkRejectType === 'requests' ? selectedRequestIds.size : selectedProofIds.size} selected item(s)?</DialogDescription>
          </DialogHeader>
          <div>
            <Label>Reason for rejection</Label>
            <Textarea value={bulkRejectReason} onChange={e => setBulkRejectReason(e.target.value)} placeholder="Enter reason..." className="mt-1" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkRejectDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkRejectRequests} disabled={bulkLoading}>
              {bulkLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Reject All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const AdminOfferAccessRequestsWithGuard = () => (
  <AdminPageGuard requiredTab="offer-access-requests">
    <AdminOfferAccessRequests />
  </AdminPageGuard>
);

export default AdminOfferAccessRequestsWithGuard;