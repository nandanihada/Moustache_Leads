import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Users, 
  Eye, 
  Edit, 
  Ban, 
  Trash2, 
  Search,
  Filter,
  RefreshCw,
  User,
  Mail,
  Globe,
  Calendar,
  Shield,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Building,
  Link as LinkIcon
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

interface PublisherDetails extends Publisher {
  placements: Array<{
    id: string;
    placementIdentifier: string;
    offerwallTitle: string;
    platformType: string;
    currencyName: string;
    exchangeRate: number;
    postbackUrl: string;
    status: string;
    approvalStatus: string;
    approvedAt?: string;
    createdAt: string;
  }>;
}

const AdminPublisherManagement = () => {
  const { toast } = useToast();
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedPublisher, setSelectedPublisher] = useState<PublisherDetails | null>(null);
  const [actionType, setActionType] = useState<'view' | 'edit' | 'block' | 'unblock' | 'delete' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    companyName: '',
    website: '',
    postbackUrl: '',
    email: ''
  });
  const [blockReason, setBlockReason] = useState('');
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

  const fetchPublishers = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        size: pagination.size.toString(),
        ...(statusFilter !== 'all' && { status_filter: statusFilter }),
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

  const fetchPublisherDetails = async (publisherId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/publishers/${publisherId}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch publisher details');
      }

      const publisherDetails = await response.json();
      setSelectedPublisher(publisherDetails);
      
      // Pre-fill edit form
      setEditForm({
        firstName: publisherDetails.firstName || '',
        lastName: publisherDetails.lastName || '',
        companyName: publisherDetails.companyName || '',
        website: publisherDetails.website || '',
        postbackUrl: publisherDetails.postbackUrl || '',
        email: publisherDetails.email || ''
      });

    } catch (error) {
      console.error('Error fetching publisher details:', error);
      toast({
        title: "Error",
        description: "Failed to fetch publisher details",
        variant: "destructive",
      });
    }
  };

  const handleAction = async () => {
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
      closeDialog();

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

  const openActionDialog = async (publisher: Publisher, action: typeof actionType) => {
    if (action === 'view' || action === 'edit') {
      await fetchPublisherDetails(publisher.id);
    } else {
      setSelectedPublisher(publisher as PublisherDetails);
    }
    setActionType(action);
  };

  const closeDialog = () => {
    setActionType(null);
    setSelectedPublisher(null);
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

  const getPlacementStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'PENDING_APPROVAL':
        return 'bg-yellow-100 text-yellow-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  useEffect(() => {
    fetchPublishers();
  }, [pagination.page, statusFilter]);

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (pagination.page === 1) {
        fetchPublishers();
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
          <h2 className="text-2xl font-bold tracking-tight">Publisher Management</h2>
          <p className="text-muted-foreground">
            Manage publishers, view their details, and control access to offers.
          </p>
        </div>
        <Button onClick={fetchPublishers} disabled={loading}>
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
                placeholder="Search by username, email, company name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Filter className="h-4 w-4 mr-2" />
                  Status: {statusFilter === 'all' ? 'All' : statusFilter}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setStatusFilter('all')}>
                  All Publishers
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('active')}>
                  Active
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('blocked')}>
                  Blocked
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* Publishers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Publishers ({pagination.total})</CardTitle>
          <CardDescription>
            Manage publisher accounts and their access to offers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Loading publishers...
            </div>
          ) : publishers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No publishers found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Publisher</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Placements</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
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
                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          Total: {publisher.placementStats.total}
                        </div>
                        <div className="flex gap-2">
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
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3 mr-1" />
                        {new Date(publisher.createdAt).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openActionDialog(publisher, 'view')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openActionDialog(publisher, 'edit')}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {publisher.status === 'active' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openActionDialog(publisher, 'block')}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openActionDialog(publisher, 'unblock')}
                            className="text-green-600 hover:text-green-700"
                          >
                            <ShieldCheck className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openActionDialog(publisher, 'delete')}
                          className="text-red-600 hover:text-red-700"
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

      {/* Action Dialog */}
      <Dialog open={!!actionType} onOpenChange={closeDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'view' && 'Publisher Details'}
              {actionType === 'edit' && 'Edit Publisher'}
              {actionType === 'block' && 'Block Publisher'}
              {actionType === 'unblock' && 'Unblock Publisher'}
              {actionType === 'delete' && 'Delete Publisher'}
            </DialogTitle>
            <DialogDescription>
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

          {selectedPublisher && (
            <div className="space-y-6">
              {/* View Details */}
              {actionType === 'view' && (
                <Tabs defaultValue="details" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="placements">Placements ({selectedPublisher.placements?.length || 0})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Username</Label>
                          <p className="text-sm">{selectedPublisher.username}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Email</Label>
                          <p className="text-sm">{selectedPublisher.email}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Password</Label>
                          <p className="text-sm font-mono bg-gray-100 p-2 rounded">{selectedPublisher.password}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Name</Label>
                          <p className="text-sm">{selectedPublisher.firstName} {selectedPublisher.lastName}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Company</Label>
                          <p className="text-sm">{selectedPublisher.companyName || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Website</Label>
                          <p className="text-sm">{selectedPublisher.website || 'N/A'}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Postback URL</Label>
                          <p className="text-sm break-all">{selectedPublisher.postbackUrl || 'N/A'}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Status</Label>
                          <div className="mt-1">{getStatusBadge(selectedPublisher.status)}</div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Joined</Label>
                          <p className="text-sm">{new Date(selectedPublisher.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Last Login</Label>
                          <p className="text-sm">{selectedPublisher.lastLogin ? new Date(selectedPublisher.lastLogin).toLocaleDateString() : 'Never'}</p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="placements" className="space-y-4">
                    {selectedPublisher.placements && selectedPublisher.placements.length > 0 ? (
                      <div className="space-y-3">
                        {selectedPublisher.placements.map((placement) => (
                          <Card key={placement.id}>
                            <CardContent className="pt-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="font-medium">{placement.offerwallTitle}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    {placement.platformType} • {placement.currencyName} (1 USD = {placement.exchangeRate})
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Created: {new Date(placement.createdAt).toLocaleDateString()}
                                  </p>
                                </div>
                                <Badge className={getPlacementStatusColor(placement.approvalStatus)}>
                                  {placement.approvalStatus.replace('_', ' ')}
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No placements found</p>
                    )}
                  </TabsContent>
                </Tabs>
              )}

              {/* Edit Form */}
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
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            {actionType !== 'view' && (
              <Button
                onClick={handleAction}
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

export default AdminPublisherManagement;
