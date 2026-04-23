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
  apiKey?: string;
  firstName: string;
  lastName: string;
  companyName: string;
  website: string;
  postbackUrl: string;
  role: string;
  status: string;
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

const AdminPublisherManagement = () => {
  const { toast } = useToast();
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedPublisher, setSelectedPublisher] = useState<any>(null);
  const [actionType, setActionType] = useState<'view' | 'edit' | 'block' | 'unblock' | 'delete' | 'create' | 'reset_api_key' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    companyName: '',
    website: '',
    postbackUrl: '',
    email: '',
    username: '',
    password: '',
    role: 'user',
    approve: true
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
        case 'create':
          response = await fetch(`${API_BASE_URL}/auth/admin/create-user`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(editForm),
          });
          break;

        case 'reset_api_key':
          response = await fetch(`${API_BASE_URL}/generate-api-key`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ user_id: selectedPublisher.id }),
          });
          break;

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
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchPublishers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setActionType('create')}>
            <User className="h-4 w-4 mr-2" />
            Add New Publisher
          </Button>
        </div>
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
                    <TabsTrigger value="preferences">Preferences</TabsTrigger>
                    <TabsTrigger value="placements">Placements ({selectedPublisher.placements?.length || 0})</TabsTrigger>
                    <TabsTrigger value="api">API Access</TabsTrigger>
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
                          <Label className="text-sm font-medium text-gray-600">Name</Label>
                          <p className="text-sm">{selectedPublisher.firstName} {selectedPublisher.lastName}</p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Status</Label>
                          <div className="mt-1">{getStatusBadge(selectedPublisher.status)}</div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Role</Label>
                          <p className="text-sm capitalize">{selectedPublisher.role}</p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="preferences" className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Verticals of Interest</Label>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {selectedPublisher.verticals?.length > 0 ? selectedPublisher.verticals.map((v: string) => (
                              <Badge key={v} variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200">{v}</Badge>
                            )) : <span className="text-sm text-gray-400">None selected</span>}
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Target GEOs</Label>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {selectedPublisher.geos?.length > 0 ? selectedPublisher.geos.map((g: string) => (
                              <Badge key={g} variant="secondary" className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200">{g}</Badge>
                            )) : <span className="text-sm text-gray-400">None selected</span>}
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Traffic Sources</Label>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {selectedPublisher.trafficSources?.length > 0 ? selectedPublisher.trafficSources.map((ts: string) => (
                              <Badge key={ts} variant="secondary" className="bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200">{ts}</Badge>
                            )) : <span className="text-sm text-gray-400">None selected</span>}
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">URLs</Label>
                          <div className="mt-2 space-y-1">
                            {selectedPublisher.websiteUrls?.filter((u: string) => u).length > 0 ? selectedPublisher.websiteUrls.filter((u: string) => u).map((url: string, idx: number) => (
                              <a key={idx} href={url.startsWith('http') ? url : `https://${url}`} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline block truncate flex items-center gap-1">
                                <LinkIcon className="w-3 h-3"/> {url}
                              </a>
                            )) : <span className="text-sm text-gray-400">None provided</span>}
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Social Contacts</Label>
                          <div className="mt-2 text-sm space-y-1 border rounded-md p-3 bg-slate-50">
                            <p><strong>LinkedIn:</strong> {selectedPublisher.socialContacts?.linkedin || 'N/A'}</p>
                            <p><strong>Telegram:</strong> {selectedPublisher.socialContacts?.telegram || 'N/A'}</p>
                            <p><strong>Agency:</strong> {selectedPublisher.socialContacts?.agency || 'N/A'}</p>
                          </div>
                        </div>
                        
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Smart Link Interest</Label>
                          <div className="mt-2 text-sm border rounded-md p-3 bg-slate-50">
                            <p><strong>Interested:</strong> <span className={selectedPublisher.smartLinkInterest === 'yes' ? 'text-green-600 font-medium' : ''}>{selectedPublisher.smartLinkInterest === 'yes' ? 'Yes' : 'No'}</span></p>
                            {selectedPublisher.smartLinkInterest === 'yes' && (
                              <p className="mt-1"><strong>Source:</strong> {selectedPublisher.smartLinkTrafficSource || 'N/A'}</p>
                            )}
                          </div>
                        </div>

                        <div>
                           <Label className="text-sm font-medium text-gray-600">Location / Address</Label>
                           <div className="mt-2 text-sm border rounded-md p-3 bg-slate-50">
                             <p>{selectedPublisher.address?.unit ? `Unit ${selectedPublisher.address.unit}, ` : ''}{selectedPublisher.address?.street || 'N/A'}</p>
                             <p>{selectedPublisher.address?.city || ''} {selectedPublisher.address?.state || ''} {selectedPublisher.address?.country || ''} {selectedPublisher.address?.postal || ''}</p>
                           </div>
                        </div>
                        
                        <div>
                           <Label className="text-sm font-medium text-gray-600">Bank Details</Label>
                           <div className="mt-2 text-sm border rounded-md p-3 bg-slate-50">
                             <p><strong>Bank:</strong> {selectedPublisher.payoutDetails?.bank_name || 'N/A'}</p>
                             <p><strong>Beneficiary:</strong> {selectedPublisher.payoutDetails?.account_name || 'N/A'}</p>
                           </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="api" className="space-y-4">
                    <div className="p-4 border border-blue-100 bg-blue-50 rounded-lg">
                      <Label className="text-sm font-medium text-blue-800">API Key</Label>
                      <div className="flex gap-2 mt-2">
                        <Input 
                          value={selectedPublisher.apiKey || 'No API key generated'} 
                          readOnly 
                          className="font-mono bg-white"
                        />
                        <Button variant="outline" onClick={() => setActionType('reset_api_key')}>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Reset Key
                        </Button>
                      </div>
                      <p className="text-xs text-blue-600 mt-2 italic">
                        Publisher can use this key to fetch public offers via API.
                      </p>
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

              {/* Create / Edit Form */}
              {(actionType === 'create' || actionType === 'edit') && (
                <div className="grid grid-cols-2 gap-4">
                  {actionType === 'create' && (
                    <>
                      <div>
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          value={editForm.username}
                          onChange={(e) => setEditForm(prev => ({ ...prev, username: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          value={editForm.password}
                          onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                        />
                      </div>
                    </>
                  )}
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
                  <div className={actionType === 'edit' ? 'col-span-2' : ''}>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  {actionType === 'create' && (
                    <div>
                      <Label htmlFor="role">Role</Label>
                      <select 
                        id="role"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={editForm.role}
                        onChange={(e) => setEditForm(prev => ({ ...prev, role: e.target.value }))}
                      >
                        <option value="user">User</option>
                        <option value="partner">Partner</option>
                        <option value="subadmin">Sub-Admin</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Reset API Key Confirmation */}
              {actionType === 'reset_api_key' && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-amber-800 font-medium">
                    Are you sure you want to reset the API key for {selectedPublisher.username}?
                  </p>
                  <p className="text-amber-700 text-sm mt-1">
                    The old key will become immediately invalid.
                  </p>
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

                  <TabsContent value="placements" className="space-y-4">
                    {selectedPublisher.placements && selectedPublisher.placements.length > 0 ? (
                      <div className="space-y-3">
                        {selectedPublisher.placements.map((placement: any) => (
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
                {/* ... existing forms ... */}
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
                  variant={actionType === 'delete' || actionType === 'block' || actionType === 'reset_api_key' ? 'destructive' : 'default'}
                >
                  {actionLoading ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <>
                      {actionType === 'create' && <User className="h-4 w-4 mr-2" />}
                      {actionType === 'edit' && <Edit className="h-4 w-4 mr-2" />}
                      {actionType === 'block' && <Ban className="h-4 w-4 mr-2" />}
                      {actionType === 'unblock' && <ShieldCheck className="h-4 w-4 mr-2" />}
                      {actionType === 'delete' && <Trash2 className="h-4 w-4 mr-2" />}
                      {actionType === 'reset_api_key' && <RefreshCw className="h-4 w-4 mr-2" />}
                    </>
                  )}
                  {actionType === 'create' && 'Create Publisher'}
                  {actionType === 'edit' && 'Save Changes'}
                  {actionType === 'block' && 'Block Publisher'}
                  {actionType === 'unblock' && 'Unblock Publisher'}
                  {actionType === 'delete' && 'Delete Publisher'}
                  {actionType === 'reset_api_key' && 'Confirm Reset'}
                </Button>
              )}
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPublisherManagement;
