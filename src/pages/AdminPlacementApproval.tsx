import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Eye, 
  Search,
  Filter,
  RefreshCw,
  User,
  Globe,
  DollarSign,
  Link,
  Calendar
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

const API_BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`;

interface PlacementRequest {
  id: string;
  publisherId: string;
  publisherName: string;
  publisherEmail: string;
  placementIdentifier: string;
  platformType: string;
  offerwallTitle: string;
  currencyName: string;
  exchangeRate: number;
  postbackUrl: string;
  status: string;
  approvalStatus: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  reviewMessage?: string;
  createdAt: string;
}

const AdminPlacementApproval = () => {
  const { toast } = useToast();
  const [placements, setPlacements] = useState<PlacementRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('PENDING_APPROVAL');
  const [selectedPlacement, setSelectedPlacement] = useState<PlacementRequest | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'view' | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    size: 20,
    total: 0
  });

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  };

  const fetchPlacements = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching placements...', { statusFilter, searchTerm, pagination });
      
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        size: pagination.size.toString(),
        ...(statusFilter !== 'all' && { status_filter: statusFilter }),
        ...(searchTerm && { search: searchTerm })
      });

      const url = `${API_BASE_URL}/placements/admin/all?${params}`;
      console.log('📡 API URL:', url);
      console.log('🔑 Headers:', getAuthHeaders());

      const response = await fetch(url, {
        headers: getAuthHeaders(),
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', errorText);
        throw new Error(`Failed to fetch placements: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ API Response:', data);
      
      setPlacements(data.placements || []);
      setPagination(prev => ({
        ...prev,
        total: data.total || 0
      }));
    } catch (error) {
      console.error('❌ Fetch error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch placements",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedPlacement) return;

    try {
      setActionLoading(true);
      const response = await fetch(`${API_BASE_URL}/placements/admin/${selectedPlacement.id}/approve`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          message: actionMessage || undefined
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to approve placement');
      }

      toast({
        title: "Success",
        description: "Placement approved successfully",
      });

      setActionType(null);
      setSelectedPlacement(null);
      setActionMessage('');
      fetchPlacements();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to approve placement",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedPlacement || !rejectionReason.trim()) {
      toast({
        title: "Error",
        description: "Rejection reason is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setActionLoading(true);
      const response = await fetch(`${API_BASE_URL}/placements/admin/${selectedPlacement.id}/reject`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          reason: rejectionReason,
          message: actionMessage || undefined
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to reject placement');
      }

      toast({
        title: "Success",
        description: "Placement rejected successfully",
      });

      setActionType(null);
      setSelectedPlacement(null);
      setActionMessage('');
      setRejectionReason('');
      fetchPlacements();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reject placement",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      case 'PENDING_APPROVAL':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const openActionDialog = (placement: PlacementRequest, action: 'approve' | 'reject' | 'view') => {
    setSelectedPlacement(placement);
    setActionType(action);
    setActionMessage('');
    setRejectionReason('');
  };

  const closeActionDialog = () => {
    setActionType(null);
    setSelectedPlacement(null);
    setActionMessage('');
    setRejectionReason('');
  };

  useEffect(() => {
    fetchPlacements();
  }, [pagination.page, statusFilter]);

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (pagination.page === 1) {
        fetchPlacements();
      } else {
        setPagination(prev => ({ ...prev, page: 1 }));
      }
    }, 500);

    return () => clearTimeout(delayedSearch);
  }, [searchTerm]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Placement Approval</h2>
          <p className="text-muted-foreground">
            Review and approve publisher placement requests.
          </p>
        </div>
        <Button onClick={fetchPlacements} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by publisher name, email, or placement title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Filter className="h-4 w-4 mr-2" />
                  Status: {statusFilter === 'all' ? 'All' : statusFilter.replace('_', ' ')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setStatusFilter('all')}>
                  All Statuses
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('PENDING_APPROVAL')}>
                  Pending Approval
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('APPROVED')}>
                  Approved
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('REJECTED')}>
                  Rejected
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* Placements Table */}
      <Card>
        <CardHeader>
          <CardTitle>Placement Requests ({pagination.total})</CardTitle>
          <CardDescription>
            Review publisher placement requests and approve or reject them
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Loading placements...
            </div>
          ) : placements.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No placement requests found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Publisher</TableHead>
                  <TableHead>Placement Details</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {placements.map((placement) => (
                  <TableRow key={placement.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium flex items-center">
                          <User className="h-4 w-4 mr-2 text-gray-400" />
                          {placement.publisherName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {placement.publisherEmail}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{placement.offerwallTitle}</div>
                        <div className="text-sm text-muted-foreground flex items-center">
                          <DollarSign className="h-3 w-3 mr-1" />
                          {placement.currencyName} (1 USD = {placement.exchangeRate})
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="flex items-center w-fit">
                        <Globe className="h-3 w-3 mr-1" />
                        {placement.platformType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(placement.approvalStatus)}>
                        {placement.approvalStatus.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3 mr-1" />
                        {new Date(placement.createdAt).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openActionDialog(placement, 'view')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {placement.approvalStatus === 'PENDING_APPROVAL' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openActionDialog(placement, 'approve')}
                              className="text-green-600 hover:text-green-700"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openActionDialog(placement, 'reject')}
                              className="text-red-600 hover:text-red-700"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={!!actionType} onOpenChange={closeActionDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' && 'Approve Placement'}
              {actionType === 'reject' && 'Reject Placement'}
              {actionType === 'view' && 'Placement Details'}
            </DialogTitle>
            <DialogDescription>
              {selectedPlacement && (
                <span>
                  {actionType === 'approve' && 'Approve this placement request from '}
                  {actionType === 'reject' && 'Reject this placement request from '}
                  {actionType === 'view' && 'Viewing placement request from '}
                  <strong>{selectedPlacement.publisherName}</strong>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedPlacement && (
            <div className="space-y-4">
              {/* Placement Details */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="text-sm font-medium text-gray-600">Offerwall Title</label>
                  <p className="text-sm">{selectedPlacement.offerwallTitle}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Platform Type</label>
                  <p className="text-sm">{selectedPlacement.platformType}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Currency</label>
                  <p className="text-sm">{selectedPlacement.currencyName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Exchange Rate</label>
                  <p className="text-sm">1 USD = {selectedPlacement.exchangeRate}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-600">Postback URL</label>
                  <p className="text-sm break-all font-mono bg-white p-2 rounded border">
                    {selectedPlacement.postbackUrl}
                  </p>
                </div>
              </div>

              {/* Action-specific inputs */}
              {actionType === 'reject' && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Rejection Reason *</label>
                  <Textarea
                    placeholder="Please provide a reason for rejection..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}

              {(actionType === 'approve' || actionType === 'reject') && (
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Message to Publisher (Optional)
                  </label>
                  <Textarea
                    placeholder="Add a custom message for the publisher..."
                    value={actionMessage}
                    onChange={(e) => setActionMessage(e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeActionDialog}>
              Cancel
            </Button>
            {actionType === 'approve' && (
              <Button onClick={handleApprove} disabled={actionLoading}>
                {actionLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve Placement
                  </>
                )}
              </Button>
            )}
            {actionType === 'reject' && (
              <Button 
                variant="destructive" 
                onClick={handleReject} 
                disabled={actionLoading || !rejectionReason.trim()}
              >
                {actionLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject Placement
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPlacementApproval;
