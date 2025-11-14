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
  Calendar,
  Users,
  Edit,
  Ban,
  Trash2,
  ShieldCheck,
  Mail,
  Building
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';

const API_BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`;

interface Publisher {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  companyName: string;
  website: string;
  postbackUrl: string;
  role: string;
  status: string;
  password: string;
  createdAt: string;
  updatedAt?: string;
  lastLogin?: string;
  placementStats: {
    total: number;
    approved: number;
    pending: number;
    rejected: number;
  };
}

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
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('PENDING_APPROVAL');
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedPlacement, setSelectedPlacement] = useState<PlacementRequest | null>(null);
  const [selectedPublisher, setSelectedPublisher] = useState<Publisher | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'view' | 'edit' | 'block' | 'unblock' | 'delete' | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    companyName: '',
    website: '',
    postbackUrl: '',
    email: ''
  });
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
      
      // Determine status filter based on active tab
      const currentStatusFilter = activeTab === 'pending' ? 'PENDING_APPROVAL' : 'APPROVED';
      console.log('🔍 Fetching placements...', { activeTab, currentStatusFilter, searchTerm, pagination });
      
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        size: pagination.size.toString(),
        status_filter: currentStatusFilter,
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

  const fetchPublishers = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        size: pagination.size.toString(),
        ...(searchTerm && { search: searchTerm })
      });

      const response = await fetch(`${API_BASE_URL}/admin/publishers?${params}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch publishers: ${response.status}`);
      }

      const data = await response.json();
      setPublishers(data.publishers || []);
      setPagination(prev => ({
        ...prev,
        total: data.pagination?.total || 0
      }));

    } catch (error) {
      console.error('Error fetching publishers:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch publishers",
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

  const openPublisherActionDialog = (publisher: Publisher, action: 'view' | 'edit' | 'block' | 'unblock' | 'delete') => {
    setSelectedPublisher(publisher);
    setActionType(action);
    setBlockReason('');
    
    // Pre-fill edit form
    if (action === 'edit') {
      setEditForm({
        firstName: publisher.firstName || '',
        lastName: publisher.lastName || '',
        companyName: publisher.companyName || '',
        website: publisher.website || '',
        postbackUrl: publisher.postbackUrl || '',
        email: publisher.email || ''
      });
    }
  };

  const handlePublisherAction = async () => {
    if (!selectedPublisher || !actionType) return;

    try {
      setActionLoading(true);
      let response;

      switch (actionType) {
        case 'edit':
          response = await fetch(`${API_BASE_URL}/admin/publishers/${selectedPublisher.id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(editForm),
          });
          break;

        case 'block':
          response = await fetch(`${API_BASE_URL}/admin/publishers/${selectedPublisher.id}/block`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ reason: blockReason }),
          });
          break;

        case 'unblock':
          response = await fetch(`${API_BASE_URL}/admin/publishers/${selectedPublisher.id}/unblock`, {
            method: 'POST',
            headers: getAuthHeaders(),
          });
          break;

        case 'delete':
          response = await fetch(`${API_BASE_URL}/admin/publishers/${selectedPublisher.id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
          });
          break;

        default:
          return;
      }

      if (!response.ok) {
        throw new Error(`Failed to ${actionType} publisher`);
      }

      const result = await response.json();
      
      toast({
        title: "Success",
        description: result.message || `Publisher ${actionType}ed successfully`,
      });

      // Refresh the list
      fetchPublishers();
      closeActionDialog();

    } catch (error) {
      console.error(`Error ${actionType}ing publisher:`, error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : `Failed to ${actionType} publisher`,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'blocked':
        return <Badge className="bg-red-100 text-red-800">Blocked</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const closeActionDialog = () => {
    setActionType(null);
    setSelectedPlacement(null);
    setSelectedPublisher(null);
    setActionMessage('');
    setRejectionReason('');
    setBlockReason('');
    setEditForm({
      firstName: '',
      lastName: '',
      companyName: '',
      website: '',
      postbackUrl: '',
      email: ''
    });
  };

  useEffect(() => {
    if (activeTab === 'pending') {
      fetchPlacements();
    } else if (activeTab === 'approved') {
      fetchPublishers();
    }
  }, [pagination.page, statusFilter, activeTab]);

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (pagination.page === 1) {
        if (activeTab === 'pending') {
          fetchPlacements();
        } else if (activeTab === 'approved') {
          fetchPublishers();
        }
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pending Approvals
          </TabsTrigger>
          <TabsTrigger value="approved" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Approved Publishers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-6">
          {/* Search and Filters for Pending */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search pending placements by publisher name, email, or placement title..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pending Placements Table */}
          <Card>
            <CardHeader>
              <CardTitle>Pending Placement Requests ({pagination.total})</CardTitle>
              <CardDescription>
                Review and approve publisher placement requests
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
        </TabsContent>

        <TabsContent value="approved" className="space-y-6">
          {/* Search and Filters for Approved */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search approved publishers by name, email, or placement title..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Approved Publishers Table */}
          <Card>
            <CardHeader>
              <CardTitle>Approved Publishers ({pagination.total})</CardTitle>
              <CardDescription>
                View approved publishers and their placement details
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  Loading approved publishers...
                </div>
              ) : publishers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No approved publishers found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Publisher</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Password</TableHead>
                      <TableHead>Placements</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {publishers.map((publisher) => (
                      <TableRow key={publisher.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium flex items-center">
                              <User className="h-4 w-4 mr-2 text-gray-400" />
                              {publisher.username}
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center">
                              <Mail className="h-3 w-3 mr-1" />
                              {publisher.email}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {publisher.firstName} {publisher.lastName}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            {publisher.companyName && (
                              <div className="font-medium flex items-center">
                                <Building className="h-4 w-4 mr-2 text-gray-400" />
                                {publisher.companyName}
                              </div>
                            )}
                            {publisher.website && (
                              <div className="text-sm text-muted-foreground flex items-center">
                                <Globe className="h-3 w-3 mr-1" />
                                {publisher.website}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-mono bg-yellow-50 p-2 rounded border border-yellow-200 max-w-32 truncate" title={publisher.password}>
                            {publisher.password ? (publisher.password.startsWith('b\'') ? 'Hashed Password' : publisher.password) : 'No password'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-sm font-medium">
                              Total: {publisher.placementStats.total}
                            </div>
                            <div className="flex gap-1">
                              {publisher.placementStats.approved > 0 && (
                                <Badge className="bg-green-100 text-green-800 text-xs">
                                  ✓ {publisher.placementStats.approved}
                                </Badge>
                              )}
                              {publisher.placementStats.pending > 0 && (
                                <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                                  ⏳ {publisher.placementStats.pending}
                                </Badge>
                              )}
                              {publisher.placementStats.rejected > 0 && (
                                <Badge className="bg-red-100 text-red-800 text-xs">
                                  ✗ {publisher.placementStats.rejected}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(publisher.status)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openPublisherActionDialog(publisher, 'view')}
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openPublisherActionDialog(publisher, 'edit')}
                              title="Edit Publisher"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {publisher.status === 'active' ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openPublisherActionDialog(publisher, 'block')}
                                className="text-red-600 hover:text-red-700"
                                title="Block Publisher"
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openPublisherActionDialog(publisher, 'unblock')}
                                className="text-green-600 hover:text-green-700"
                                title="Unblock Publisher"
                              >
                                <ShieldCheck className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openPublisherActionDialog(publisher, 'delete')}
                              className="text-red-600 hover:text-red-700"
                              title="Delete Publisher"
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
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}
      <Dialog open={!!actionType} onOpenChange={closeActionDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' && 'Approve Placement'}
              {actionType === 'reject' && 'Reject Placement'}
              {actionType === 'view' && selectedPlacement && 'Placement Details'}
              {actionType === 'view' && selectedPublisher && 'Publisher Details'}
              {actionType === 'edit' && 'Edit Publisher'}
              {actionType === 'block' && 'Block Publisher'}
              {actionType === 'unblock' && 'Unblock Publisher'}
              {actionType === 'delete' && 'Delete Publisher'}
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
              {selectedPublisher && (
                <span>
                  {actionType === 'view' && `Viewing details for ${selectedPublisher.username}`}
                  {actionType === 'edit' && `Edit information for ${selectedPublisher.username}`}
                  {actionType === 'block' && `Block ${selectedPublisher.username} from accessing offers`}
                  {actionType === 'unblock' && `Restore access for ${selectedPublisher.username}`}
                  {actionType === 'delete' && `Permanently delete ${selectedPublisher.username} and all their data`}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Placement Dialog Content */}
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

          {/* Publisher Dialog Content */}
          {selectedPublisher && (
            <div className="space-y-6">
              {/* View Publisher Details */}
              {actionType === 'view' && (
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Username</Label>
                      <p className="text-sm font-mono bg-gray-50 p-2 rounded">{selectedPublisher.username}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Email</Label>
                      <p className="text-sm font-mono bg-gray-50 p-2 rounded">{selectedPublisher.email}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Real Password</Label>
                      <p className="text-sm font-mono bg-yellow-50 p-2 rounded border border-yellow-200 break-all">
                        {selectedPublisher.password || 'No password found'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Full Name</Label>
                      <p className="text-sm bg-gray-50 p-2 rounded">
                        {selectedPublisher.firstName} {selectedPublisher.lastName}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Company</Label>
                      <p className="text-sm bg-gray-50 p-2 rounded">{selectedPublisher.companyName || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Website</Label>
                      <p className="text-sm bg-gray-50 p-2 rounded break-all">{selectedPublisher.website || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Postback URL</Label>
                      <p className="text-sm bg-gray-50 p-2 rounded break-all">{selectedPublisher.postbackUrl || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Status</Label>
                      <div className="mt-1">{getStatusBadge(selectedPublisher.status)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Edit Publisher Form */}
              {actionType === 'edit' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={editForm.firstName}
                      onChange={(e) => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={editForm.lastName}
                      onChange={(e) => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      value={editForm.companyName}
                      onChange={(e) => setEditForm(prev => ({ ...prev, companyName: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={editForm.website}
                      onChange={(e) => setEditForm(prev => ({ ...prev, website: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="postbackUrl">Postback URL</Label>
                    <Input
                      id="postbackUrl"
                      value={editForm.postbackUrl}
                      onChange={(e) => setEditForm(prev => ({ ...prev, postbackUrl: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              {/* Block Reason */}
              {actionType === 'block' && (
                <div>
                  <Label htmlFor="blockReason">Block Reason</Label>
                  <Textarea
                    id="blockReason"
                    placeholder="Enter reason for blocking this publisher..."
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                  />
                </div>
              )}

              {/* Confirmation Messages */}
              {actionType === 'unblock' && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800">
                    This will restore full access to offers for this publisher.
                  </p>
                </div>
              )}

              {actionType === 'delete' && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 font-medium">
                    ⚠️ This action cannot be undone!
                  </p>
                  <p className="text-red-700 text-sm mt-1">
                    This will permanently delete the publisher account and all their placements.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeActionDialog}>
              Cancel
            </Button>
            
            {/* Placement Actions */}
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

            {/* Publisher Actions */}
            {(actionType === 'edit' || actionType === 'block' || actionType === 'unblock' || actionType === 'delete') && (
              <Button
                onClick={handlePublisherAction}
                disabled={actionLoading}
                variant={actionType === 'delete' || actionType === 'block' ? 'destructive' : 'default'}
              >
                {actionLoading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <>
                    {actionType === 'edit' && <Edit className="h-4 w-4 mr-2" />}
                    {actionType === 'block' && <Ban className="h-4 w-4 mr-2" />}
                    {actionType === 'unblock' && <ShieldCheck className="h-4 w-4 mr-2" />}
                    {actionType === 'delete' && <Trash2 className="h-4 w-4 mr-2" />}
                  </>
                )}
                {actionType === 'edit' && 'Save Changes'}
                {actionType === 'block' && 'Block Publisher'}
                {actionType === 'unblock' && 'Unblock Publisher'}
                {actionType === 'delete' && 'Delete Publisher'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPlacementApproval;
