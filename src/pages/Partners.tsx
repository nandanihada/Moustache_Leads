import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { partnerApi, Partner, CreatePartnerData } from '@/services/partnerApi';
import { Plus, Edit, Trash2, TestTube, Copy, CheckCircle, XCircle, Loader2, Ban, CheckCheck, Settings, ArrowRight, Search } from 'lucide-react';
import { AdminPageGuard } from '@/components/AdminPageGuard';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface RegisteredUser {
  _id: string;
  username: string;
  email: string;
  role: string;
  created_at: string;
  postback_url?: string;
  parameter_mapping?: Record<string, string>;
  is_blocked?: boolean;
  blocked_reason?: string;
}

const Partners: React.FC = () => {
  const { toast } = useToast();

  // Pagination state
  const [upwardPage, setUpwardPage] = useState(1);
  const [upwardPageSize, setUpwardPageSize] = useState(10);
  const [downwardPage, setDownwardPage] = useState(1);
  const [downwardPageSize, setDownwardPageSize] = useState(10);
  const [upwardSearch, setUpwardSearch] = useState('');
  const [downwardSearch, setDownwardSearch] = useState('');

  // Upward Partners state
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);

  // Downward Partners (Users) state
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<RegisteredUser | null>(null);
  const [isUserEditModalOpen, setIsUserEditModalOpen] = useState(false);
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [blockReason, setBlockReason] = useState('');

  // Common state
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState<CreatePartnerData>({
    partner_name: '',
    postback_url: '',
    method: 'GET',
    status: 'active',
    description: ''
  });

  // Parameter mapping state for postback URL builder
  interface ParameterMapping {
    ourParam: string;
    theirParam: string;
    enabled: boolean;
  }

  const AVAILABLE_OUR_PARAMS = [
    { value: 'user_id', label: 'user_id', description: 'User MongoDB ID' },
    { value: 'click_id', label: 'click_id', description: 'Unique click identifier' },
    { value: 'payout', label: 'payout', description: 'Conversion payout amount' },
    { value: 'status', label: 'status', description: 'Conversion status' },
    { value: 'transaction_id', label: 'transaction_id', description: 'Transaction identifier' },
    { value: 'offer_id', label: 'offer_id', description: 'Offer identifier' },
    { value: 'conversion_id', label: 'conversion_id', description: 'Conversion identifier' },
    { value: 'currency', label: 'currency', description: 'Currency code' },
  ];

  const PARTNER_TEMPLATES: Record<string, ParameterMapping[]> = {
    'LeadAds': [
      { ourParam: 'user_id', theirParam: 'aff_sub', enabled: true },
      { ourParam: 'status', theirParam: 'status', enabled: true },
      { ourParam: 'payout', theirParam: 'payout', enabled: true },
      { ourParam: 'transaction_id', theirParam: 'transaction_id', enabled: true },
    ],
    'CPALead': [
      { ourParam: 'user_id', theirParam: 'subid', enabled: true },
      { ourParam: 'click_id', theirParam: 's2', enabled: true },
      { ourParam: 'status', theirParam: 'status', enabled: true },
      { ourParam: 'payout', theirParam: 'payout', enabled: true },
    ],
    'OfferToro': [
      { ourParam: 'user_id', theirParam: 'user_id', enabled: true },
      { ourParam: 'status', theirParam: 'status', enabled: true },
      { ourParam: 'payout', theirParam: 'amount', enabled: true },
      { ourParam: 'transaction_id', theirParam: 'oid', enabled: true },
    ],
    'AdGate Media': [
      { ourParam: 'user_id', theirParam: 'subid', enabled: true },
      { ourParam: 'status', theirParam: 'status', enabled: true },
      { ourParam: 'payout', theirParam: 'payout', enabled: true },
    ],
    'Custom': [
      { ourParam: 'user_id', theirParam: '', enabled: true },
      { ourParam: 'status', theirParam: '', enabled: true },
      { ourParam: 'payout', theirParam: '', enabled: true },
    ],
  };

  const [selectedTemplate, setSelectedTemplate] = useState<string>('LeadAds');
  const [parameterMappings, setParameterMappings] = useState<ParameterMapping[]>(PARTNER_TEMPLATES['LeadAds']);

  // Offer URL params state (for auto-injecting params into offer URLs on import)
  interface OfferUrlParamRow {
    our_field: string;
    their_param: string;
  }
  const OFFER_URL_FIELD_OPTIONS = [
    { value: 'user_id', label: 'user_id' },
    { value: 'payout', label: 'payout' },
    { value: 'transaction_id', label: 'transaction_id' },
    { value: 'click_id', label: 'click_id' },
    { value: 'offer_id', label: 'offer_id' },
    { value: 'status', label: 'status' },
  ];
  const [offerUrlParams, setOfferUrlParams] = useState<OfferUrlParamRow[]>([
    { our_field: 'user_id', their_param: '' }
  ]);
  const [networkDomain, setNetworkDomain] = useState<string>('');

  // User edit form data
  const [userFormData, setUserFormData] = useState({
    postback_url: '',
    parameter_mapping: {} as Record<string, string>
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchPartners(), fetchUsers()]);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.error || 'Failed to fetch data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPartners = async () => {
    try {
      const data = await partnerApi.getPartners();
      setPartners(data.partners);
    } catch (error: any) {
      console.error('Error fetching partners:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await partnerApi.getRegisteredUsers();
      setUsers(data.users);
    } catch (error: any) {
      console.error('Error fetching users:', error);
    }
  };

  const handleAddPartner = async () => {
    try {
      if (!formData.partner_name) {
        toast({ title: 'Validation Error', description: 'Partner name is required', variant: 'destructive' });
        return;
      }

      const paramMapping: Record<string, string> = {};
      parameterMappings
        .filter(m => m.enabled && m.ourParam && m.theirParam)
        .forEach(m => { paramMapping[m.theirParam] = m.ourParam; });

      const validOfferUrlParams = offerUrlParams.filter(p => p.our_field && p.their_param);

      const partnerData = {
        ...formData,
        postback_url: 'https://placeholder.com',
        method: 'GET' as 'GET' | 'POST',
        parameter_mapping: paramMapping,
        offer_url_params: validOfferUrlParams,
        network_domain: networkDomain.trim()
      };

      await partnerApi.createPartner(partnerData);
      toast({ title: 'Success', description: 'Partner created! Postback URL generated and ready to share.' });
      setIsAddModalOpen(false);
      resetForm();
      fetchPartners();
    } catch (error: any) {
      toast({ title: 'Error', description: error.error || 'Failed to generate postback URL', variant: 'destructive' });
    }
  };

  const handleEditPartner = async () => {
    if (!selectedPartner) return;

    try {
      const paramMapping: Record<string, string> = {};
      parameterMappings
        .filter(m => m.enabled && m.ourParam && m.theirParam)
        .forEach(m => { paramMapping[m.theirParam] = m.ourParam; });

      const validOfferUrlParams = offerUrlParams.filter(p => p.our_field && p.their_param);

      const updateData = {
        ...formData,
        parameter_mapping: paramMapping,
        offer_url_params: validOfferUrlParams,
        network_domain: networkDomain.trim()
      };

      await partnerApi.updatePartner(selectedPartner.partner_id, updateData);
      toast({ title: 'Success', description: 'Partner updated successfully' });
      setIsEditModalOpen(false);
      setSelectedPartner(null);
      resetForm();
      fetchPartners();
    } catch (error: any) {
      toast({ title: 'Error', description: error.error || 'Failed to update partner', variant: 'destructive' });
    }
  };

  const handleDeletePartner = async () => {
    if (!selectedPartner) return;

    try {
      await partnerApi.deletePartner(selectedPartner.partner_id);
      toast({
        title: 'Success',
        description: 'Partner deleted successfully'
      });
      setIsDeleteDialogOpen(false);
      setSelectedPartner(null);
      fetchPartners();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.error || 'Failed to delete partner',
        variant: 'destructive'
      });
    }
  };

  const handleTestPartner = async (partner: Partner) => {
    setSelectedPartner(partner);
    setIsTestModalOpen(true);
    setTestLoading(true);
    setTestResult(null);

    try {
      const result = await partnerApi.testPartner(partner.partner_id);
      setTestResult(result);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.error || 'Failed to test partner',
        variant: 'destructive'
      });
    } finally {
      setTestLoading(false);
    }
  };

  const openEditModal = (partner: Partner) => {
    setSelectedPartner(partner);
    setFormData({
      partner_name: partner.partner_name,
      postback_url: partner.postback_url,
      method: partner.method,
      status: partner.status,
      description: partner.description || ''
    });
    
    // Load postback parameter mappings
    if (partner.parameter_mapping) {
      const mappings: ParameterMapping[] = Object.entries(partner.parameter_mapping).map(([theirParam, ourParam]) => ({
        ourParam: ourParam as string,
        theirParam,
        enabled: true
      }));
      setParameterMappings(mappings);
    } else {
      setParameterMappings(PARTNER_TEMPLATES['Custom']);
    }

    // Load offer URL params
    if (partner.offer_url_params && partner.offer_url_params.length > 0) {
      setOfferUrlParams(partner.offer_url_params.map(p => ({ our_field: p.our_field, their_param: p.their_param })));
    } else {
      setOfferUrlParams([{ our_field: 'user_id', their_param: '' }]);
    }

    // Load network domain
    setNetworkDomain(partner.network_domain || '');
    
    setIsEditModalOpen(true);
  };

  const openDeleteDialog = (partner: Partner) => {
    setSelectedPartner(partner);
    setIsDeleteDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      partner_name: '',
      postback_url: '',
      method: 'GET',
      status: 'active',
      description: ''
    });
    setSelectedTemplate('LeadAds');
    setParameterMappings([]);
    setOfferUrlParams([]);
    setNetworkDomain('');
  };

  const handleTemplateChange = (template: string) => {
    setSelectedTemplate(template);
    setParameterMappings(PARTNER_TEMPLATES[template] || PARTNER_TEMPLATES['Custom']);
  };

  const handleMappingChange = (index: number, field: 'ourParam' | 'theirParam' | 'enabled', value: string | boolean) => {
    const newMappings = [...parameterMappings];
    newMappings[index] = { ...newMappings[index], [field]: value };
    setParameterMappings(newMappings);
  };

  const addMapping = () => {
    setParameterMappings([...parameterMappings, { ourParam: '', theirParam: '', enabled: true }]);
  };

  const removeMapping = (index: number) => {
    setParameterMappings(parameterMappings.filter((_, i) => i !== index));
  };

  // User management functions
  const openUserEditModal = (user: RegisteredUser) => {
    setSelectedUser(user);
    setUserFormData({
      postback_url: user.postback_url || '',
      parameter_mapping: user.parameter_mapping || {}
    });
    setIsUserEditModalOpen(true);
  };

  const handleUpdateUserPostback = async () => {
    if (!selectedUser) return;

    try {
      await partnerApi.updateUserPostback(selectedUser._id, userFormData.postback_url);
      toast({
        title: 'Success',
        description: 'Postback URL updated successfully'
      });
      setIsUserEditModalOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.error || 'Failed to update postback URL',
        variant: 'destructive'
      });
    }
  };

  const handleBlockUser = async () => {
    if (!selectedUser) return;

    try {
      await partnerApi.blockUser(selectedUser._id, blockReason);
      toast({
        title: 'Success',
        description: 'User blocked successfully'
      });
      setIsBlockDialogOpen(false);
      setSelectedUser(null);
      setBlockReason('');
      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.error || 'Failed to block user',
        variant: 'destructive'
      });
    }
  };

  const handleUnblockUser = async (user: RegisteredUser) => {
    try {
      await partnerApi.unblockUser(user._id);
      toast({
        title: 'Success',
        description: 'User unblocked successfully'
      });
      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.error || 'Failed to unblock user',
        variant: 'destructive'
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Copied to clipboard'
    });
  };

  const insertMacro = (macro: string) => {
    setFormData(prev => ({
      ...prev,
      postback_url: prev.postback_url + macro
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Partner Management</h1>
          <p className="text-gray-600 mt-1">Manage upward and downward partners</p>
        </div>
      </div>

      <Tabs defaultValue="upward" className="space-y-4">
        <TabsList>
          <TabsTrigger value="upward">Upward Partners</TabsTrigger>
          <TabsTrigger value="downward">Downward Partners (Users)</TabsTrigger>
          <TabsTrigger value="docs">Docs</TabsTrigger>
        </TabsList>

        {/* Upward Partners Tab */}
        <TabsContent value="upward" className="space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search partners..."
                  value={upwardSearch}
                  onChange={(e) => { setUpwardSearch(e.target.value); setUpwardPage(1); }}
                  className="pl-8"
                />
              </div>
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <span>Show</span>
                <select
                  value={upwardPageSize}
                  onChange={(e) => { setUpwardPageSize(Number(e.target.value)); setUpwardPage(1); }}
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  {[10, 30, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <span>per page</span>
              </div>
            </div>
            <Button onClick={() => setIsAddModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Upward Partner
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Card>
              <CardContent className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Partner Name</TableHead>
                      <TableHead>Network Domain</TableHead>
                      <TableHead>Our Postback URL (Share with Partner)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const filtered = partners.filter(p =>
                        p.partner_name.toLowerCase().includes(upwardSearch.toLowerCase()) ||
                        (p.network_domain || '').toLowerCase().includes(upwardSearch.toLowerCase())
                      );
                      const paged = filtered.slice((upwardPage - 1) * upwardPageSize, upwardPage * upwardPageSize);
                      if (filtered.length === 0) return (
                        <TableRow><TableCell colSpan={6} className="text-center text-gray-500">No partners found.</TableCell></TableRow>
                      );
                      return paged.map((partner) => (
                        <TableRow key={partner.partner_id}>
                          <TableCell className="font-medium">{partner.partner_name}</TableCell>
                          <TableCell>
                            {partner.network_domain ? (
                              <code className="text-xs bg-gray-100 px-2 py-1 rounded">{partner.network_domain}</code>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <code className="text-xs bg-gray-100 px-2 py-1 rounded max-w-md truncate" title={partner.postback_receiver_url || partner.postback_url}>
                                {partner.postback_receiver_url || partner.postback_url || 'Not generated'}
                              </code>
                              {(partner.postback_receiver_url || partner.postback_url) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(partner.postback_receiver_url || partner.postback_url)}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={partner.status === 'active' ? 'default' : 'secondary'}>
                              {partner.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {partner.created_at ? new Date(partner.created_at).toLocaleDateString() : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => openEditModal(partner)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(partner)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ));
                    })()}
                  </TableBody>
                </Table>

                {/* Upward Partners Pagination */}
                {(() => {
                  const filtered = partners.filter(p =>
                    p.partner_name.toLowerCase().includes(upwardSearch.toLowerCase()) ||
                    (p.network_domain || '').toLowerCase().includes(upwardSearch.toLowerCase())
                  );
                  if (filtered.length <= upwardPageSize) return null;
                  return (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <span className="text-sm text-gray-600">
                        {(upwardPage - 1) * upwardPageSize + 1}–{Math.min(upwardPage * upwardPageSize, filtered.length)} of {filtered.length}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setUpwardPage(p => Math.max(1, p - 1))} disabled={upwardPage === 1}>Previous</Button>
                        <Button variant="outline" size="sm" onClick={() => setUpwardPage(p => p + 1)} disabled={upwardPage * upwardPageSize >= filtered.length}>Next</Button>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Downward Partners Tab */}
        <TabsContent value="downward" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search users..."
                value={downwardSearch}
                onChange={(e) => { setDownwardSearch(e.target.value); setDownwardPage(1); }}
                className="pl-8"
              />
            </div>
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <span>Show</span>
              <select
                value={downwardPageSize}
                onChange={(e) => { setDownwardPageSize(Number(e.target.value)); setDownwardPage(1); }}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              >
                {[10, 30, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span>per page</span>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Card>
              <CardContent className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Postback URL</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const filtered = users.filter(u =>
                        u.username.toLowerCase().includes(downwardSearch.toLowerCase()) ||
                        u.email.toLowerCase().includes(downwardSearch.toLowerCase())
                      );
                      const paged = filtered.slice((downwardPage - 1) * downwardPageSize, downwardPage * downwardPageSize);
                      if (filtered.length === 0) return (
                        <TableRow><TableCell colSpan={6} className="text-center text-gray-500">No users found.</TableCell></TableRow>
                      );
                      return paged.map((user) => (
                        <TableRow key={user._id}>
                          <TableCell className="font-medium">{user.username}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{user.role}</Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {user.postback_url ? (
                              <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                                {user.postback_url}
                              </code>
                            ) : (
                              <span className="text-gray-400 text-sm">Not configured</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {user.is_blocked ? (
                              <Badge variant="destructive">
                                <Ban className="h-3 w-3 mr-1" />
                                Blocked
                              </Badge>
                            ) : (
                              <Badge variant="default" className="bg-green-500">
                                <CheckCheck className="h-3 w-3 mr-1" />
                                Active
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openUserEditModal(user)}
                                title="Edit postback settings"
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                              {user.is_blocked ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUnblockUser(user)}
                                  title="Unblock user"
                                  className="text-green-600"
                                >
                                  <CheckCheck className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setIsBlockDialogOpen(true);
                                  }}
                                  title="Block user"
                                  className="text-red-600"
                                >
                                  <Ban className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ));
                    })()}
                  </TableBody>
                </Table>

                {/* Downward Partners Pagination */}
                {(() => {
                  const filtered = users.filter(u =>
                    u.username.toLowerCase().includes(downwardSearch.toLowerCase()) ||
                    u.email.toLowerCase().includes(downwardSearch.toLowerCase())
                  );
                  if (filtered.length <= downwardPageSize) return null;
                  return (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <span className="text-sm text-gray-600">
                        {(downwardPage - 1) * downwardPageSize + 1}–{Math.min(downwardPage * downwardPageSize, filtered.length)} of {filtered.length}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setDownwardPage(p => Math.max(1, p - 1))} disabled={downwardPage === 1}>Previous</Button>
                        <Button variant="outline" size="sm" onClick={() => setDownwardPage(p => p + 1)} disabled={downwardPage * downwardPageSize >= filtered.length}>Next</Button>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Documentation Tab */}
        <TabsContent value="docs" className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold mb-1">Postback Reference</h2>
            <p className="text-gray-500 text-sm">Parameters we accept and how the flow works</p>
          </div>

          {/* Parameters Table */}
          <Card className="max-w-4xl">
            <CardHeader>
              <CardTitle>Postback Parameters</CardTitle>
              <CardDescription>These are the field names our system understands when a partner sends a postback. Partners can use any name on their side — you map it when adding the partner.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parameter</TableHead>
                    <TableHead>What it is</TableHead>
                    <TableHead>Required?</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell><code className="text-sm bg-gray-100 px-2 py-1 rounded">user_id</code></TableCell>
                    <TableCell>The user's ID — tells us who to credit</TableCell>
                    <TableCell><Badge variant="destructive">Required</Badge></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><code className="text-sm bg-gray-100 px-2 py-1 rounded">payout</code></TableCell>
                    <TableCell>How much the user earned (e.g. 10.50)</TableCell>
                    <TableCell><Badge variant="outline">Optional</Badge></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><code className="text-sm bg-gray-100 px-2 py-1 rounded">transaction_id</code></TableCell>
                    <TableCell>Partner's unique ID for this conversion — used to prevent duplicate payouts</TableCell>
                    <TableCell><Badge variant="outline">Optional</Badge></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><code className="text-sm bg-gray-100 px-2 py-1 rounded">status</code></TableCell>
                    <TableCell>Conversion status: approved, pending, or rejected</TableCell>
                    <TableCell><Badge variant="outline">Optional</Badge></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><code className="text-sm bg-gray-100 px-2 py-1 rounded">click_id</code></TableCell>
                    <TableCell>Click tracking ID — links the conversion back to the original click</TableCell>
                    <TableCell><Badge variant="outline">Optional</Badge></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><code className="text-sm bg-gray-100 px-2 py-1 rounded">offer_id</code></TableCell>
                    <TableCell>Which offer this conversion is for</TableCell>
                    <TableCell><Badge variant="outline">Optional</Badge></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><code className="text-sm bg-gray-100 px-2 py-1 rounded">conversion_id</code></TableCell>
                    <TableCell>Our internal conversion identifier</TableCell>
                    <TableCell><Badge variant="outline">Optional</Badge></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><code className="text-sm bg-gray-100 px-2 py-1 rounded">currency</code></TableCell>
                    <TableCell>Currency code for the payout (e.g. USD, EUR)</TableCell>
                    <TableCell><Badge variant="outline">Optional</Badge></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <p className="text-xs text-gray-400 mt-3">Any additional parameters sent by the partner are stored in raw form for reference.</p>
            </CardContent>
          </Card>

          {/* How It Works */}
          <Card className="max-w-4xl">
            <CardHeader>
              <CardTitle>How It Works</CardTitle>
              <CardDescription>End-to-end example of how postbacks flow through the system</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 text-sm">
                <div className="bg-gray-50 border rounded-lg p-4">
                  <p className="font-semibold mb-1">1. You add a network as an Upward Partner</p>
                  <p className="text-gray-600">Set their domain and add one parameter mapping: <code className="bg-white px-1.5 py-0.5 rounded border text-xs">user_id → sub1</code> (the network calls it "sub1" on their side)</p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="font-semibold mb-1">2. System auto-generates a postback URL for you to share with the network</p>
                  <code className="text-xs bg-white px-3 py-2 rounded border block break-all mt-2">
                    https://postback.moustacheleads.com/postback/7oT5qV7uYB3iCyx33iOGluhlalhSEGDq?sub1={'{sub1}'}&payout={'{payout_amount}'}&transaction_id={'{transaction_id}'}
                  </code>
                  <p className="text-xs text-gray-500 mt-2">The network fills in their macros when firing the postback</p>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="font-semibold mb-1">3. When a user completes an offer, the network fires the postback</p>
                  <code className="text-xs bg-white px-3 py-2 rounded border block break-all mt-2">
                    https://postback.moustacheleads.com/postback/7oT5qV7uYB3iCyx33iOGluhlalhSEGDq?sub1=507f1f77bcf86cd799439011&payout_amount=5.00&transaction_id=TXN-98765
                  </code>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <p className="font-semibold mb-2">4. Our system processes it</p>
                  <div className="space-y-1 text-xs">
                    <p>✅ Reads <code className="bg-white px-1 rounded">sub1</code> → maps to <code className="bg-white px-1 rounded">user_id</code> → finds the user</p>
                    <p>✅ Credits them $5.00</p>
                    <p>✅ Logs transaction ID <code className="bg-white px-1 rounded">TXN-98765</code> to prevent duplicate payouts</p>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="font-semibold mb-1">5. Offer URL auto-injection</p>
                  <p className="text-gray-600 text-xs">Because you set the network's domain, when you import their offers, the system automatically appends <code className="bg-white px-1 rounded">?sub1={'{user_id}'}</code> to every offer URL — so the user ID is always passed through without manual work.</p>
                </div>
              </div>
            </CardContent>
          </Card>

        </TabsContent>
      </Tabs>

      {/* Add Upward Partner Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Upward Partner</DialogTitle>
            <DialogDescription>
              Add the partner's basic info and their parameter names. Postback URL is generated automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="partner_name">Partner Name *</Label>
              <Input
                id="partner_name"
                value={formData.partner_name}
                onChange={(e) => setFormData({ ...formData, partner_name: e.target.value })}
                placeholder="e.g. AdtoGame, LeadAds, CPALead"
              />
            </div>

            <div>
              <Label htmlFor="network_domain">Partner's Domain</Label>
              <Input
                id="network_domain"
                value={networkDomain}
                onChange={(e) => setNetworkDomain(e.target.value)}
                placeholder="e.g. adtogametrkk.com"
              />
              <p className="text-xs text-gray-500 mt-1">Used to auto-match their offers on import</p>
            </div>

            <div>
              <Label htmlFor="description">Notes (Optional)</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g. Survey network, gaming CPA"
              />
            </div>

            {/* Parameters — add one by one */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold text-sm text-gray-800">Partner's Parameters</p>
                  <p className="text-xs text-gray-500">What names does this partner use for each field?</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setOfferUrlParams(prev => [...prev, { our_field: 'user_id', their_param: '' }]);
                    setParameterMappings(prev => [...prev, { ourParam: 'user_id', theirParam: '', enabled: true }]);
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Parameter
                </Button>
              </div>

              {offerUrlParams.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-3">No parameters yet. Click + Add Parameter.</p>
              )}

              <div className="space-y-2">
                {offerUrlParams.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={row.our_field}
                      onChange={(e) => {
                        const val = e.target.value;
                        setOfferUrlParams(prev => { const u = [...prev]; u[idx] = { ...u[idx], our_field: val }; return u; });
                        setParameterMappings(prev => { const u = [...prev]; if (u[idx]) u[idx] = { ...u[idx], ourParam: val }; return u; });
                      }}
                      className="border border-gray-300 rounded px-2 py-1.5 text-sm w-36"
                    >
                      {OFFER_URL_FIELD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <Input
                      value={row.their_param}
                      onChange={(e) => {
                        const val = e.target.value;
                        setOfferUrlParams(prev => { const u = [...prev]; u[idx] = { ...u[idx], their_param: val }; return u; });
                        setParameterMappings(prev => { const u = [...prev]; if (u[idx]) u[idx] = { ...u[idx], theirParam: val, enabled: !!val }; return u; });
                      }}
                      placeholder="Their param name, e.g. sub1"
                      className="font-mono text-sm flex-1"
                    />
                    <Button
                      type="button" variant="ghost" size="sm"
                      onClick={() => {
                        setOfferUrlParams(prev => prev.filter((_, i) => i !== idx));
                        setParameterMappings(prev => prev.filter((_, i) => i !== idx));
                      }}
                      className="text-red-500 hover:text-red-700 px-2"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddModalOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleAddPartner}>Save Partner</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Partner Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Partner</DialogTitle>
            <DialogDescription>Update partner details and their parameter names.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="edit_partner_name">Partner Name *</Label>
              <Input
                id="edit_partner_name"
                value={formData.partner_name}
                onChange={(e) => setFormData({ ...formData, partner_name: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="edit_network_domain">Partner's Domain</Label>
              <Input
                id="edit_network_domain"
                value={networkDomain}
                onChange={(e) => setNetworkDomain(e.target.value)}
                placeholder="e.g. adtogametrkk.com"
              />
              <p className="text-xs text-gray-500 mt-1">Used to auto-match their offers on import</p>
            </div>

            <div>
              <Label htmlFor="edit_description">Notes (Optional)</Label>
              <Input
                id="edit_description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {/* Parameters — add one by one */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold text-sm text-gray-800">Partner's Parameters</p>
                  <p className="text-xs text-gray-500">What names does this partner use for each field?</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setOfferUrlParams(prev => [...prev, { our_field: 'user_id', their_param: '' }]);
                    setParameterMappings(prev => [...prev, { ourParam: 'user_id', theirParam: '', enabled: true }]);
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Parameter
                </Button>
              </div>

              {offerUrlParams.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-3">No parameters yet. Click + Add Parameter.</p>
              )}

              <div className="space-y-2">
                {offerUrlParams.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={row.our_field}
                      onChange={(e) => {
                        const val = e.target.value;
                        setOfferUrlParams(prev => { const u = [...prev]; u[idx] = { ...u[idx], our_field: val }; return u; });
                        setParameterMappings(prev => { const u = [...prev]; if (u[idx]) u[idx] = { ...u[idx], ourParam: val }; return u; });
                      }}
                      className="border border-gray-300 rounded px-2 py-1.5 text-sm w-36"
                    >
                      {OFFER_URL_FIELD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <Input
                      value={row.their_param}
                      onChange={(e) => {
                        const val = e.target.value;
                        setOfferUrlParams(prev => { const u = [...prev]; u[idx] = { ...u[idx], their_param: val }; return u; });
                        setParameterMappings(prev => { const u = [...prev]; if (u[idx]) u[idx] = { ...u[idx], theirParam: val, enabled: !!val }; return u; });
                      }}
                      placeholder="Their param name, e.g. sub1"
                      className="font-mono text-sm flex-1"
                    />
                    <Button
                      type="button" variant="ghost" size="sm"
                      onClick={() => {
                        setOfferUrlParams(prev => prev.filter((_, i) => i !== idx));
                        setParameterMappings(prev => prev.filter((_, i) => i !== idx));
                      }}
                      className="text-red-500 hover:text-red-700 px-2"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-3">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: 'active' | 'inactive') => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditModalOpen(false); setSelectedPartner(null); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleEditPartner}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Partner</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedPartner?.partner_name}"? This action cannot be undone.
              Any offers linked to this partner will no longer send postbacks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedPartner(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePartner} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Test Postback Modal */}
      <Dialog open={isTestModalOpen} onOpenChange={setIsTestModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Test Postback - {selectedPartner?.partner_name}</DialogTitle>
            <DialogDescription>
              Sending test postback with sample data
            </DialogDescription>
          </DialogHeader>

          {testLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Testing postback...</span>
            </div>
          ) : testResult ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span className="font-semibold">
                  {testResult.success ? 'Test Successful' : 'Test Failed'}
                </span>
              </div>

              <div>
                <Label>Test URL</Label>
                <div className="flex gap-2">
                  <Input value={testResult.test_url} readOnly className="font-mono text-sm" />
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(testResult.test_url)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label>Method</Label>
                <Badge>{testResult.method}</Badge>
              </div>

              {testResult.status_code && (
                <div>
                  <Label>Response Code</Label>
                  <Badge variant={testResult.status_code === 200 ? 'default' : 'destructive'}>
                    {testResult.status_code}
                  </Badge>
                </div>
              )}

              {testResult.response_body && (
                <div>
                  <Label>Response Body</Label>
                  <Textarea value={testResult.response_body} readOnly rows={5} className="font-mono text-sm" />
                </div>
              )}

              {testResult.error && (
                <div>
                  <Label>Error</Label>
                  <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                    {testResult.error}
                  </div>
                </div>
              )}

              <div>
                <Label>Test Data Sent</Label>
                <Textarea
                  value={JSON.stringify(testResult.test_data, null, 2)}
                  readOnly
                  rows={6}
                  className="font-mono text-sm"
                />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button onClick={() => { setIsTestModalOpen(false); setTestResult(null); setSelectedPartner(null); }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Edit Modal */}
      <Dialog open={isUserEditModalOpen} onOpenChange={setIsUserEditModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit User Postback Settings</DialogTitle>
            <DialogDescription>
              Configure postback URL for {selectedUser?.username}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="user_postback_url">Postback URL</Label>
              <Input
                id="user_postback_url"
                value={userFormData.postback_url}
                onChange={(e) => setUserFormData(prev => ({ ...prev, postback_url: e.target.value }))}
                placeholder="https://example.com/postback?user={username}&points={points}"
              />
              <p className="text-sm text-gray-500 mt-1">
                Available macros: {'{username}'}, {'{points}'}, {'{offer_id}'}, {'{click_id}'}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUserEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUserPostback}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block User Dialog */}
      <AlertDialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to block {selectedUser?.username}? They will not be able to receive postbacks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4">
            <Label htmlFor="block_reason">Reason (optional)</Label>
            <Textarea
              id="block_reason"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Enter reason for blocking..."
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setBlockReason(''); setSelectedUser(null); }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleBlockUser} className="bg-red-600 hover:bg-red-700">
              Block User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const PartnersWithGuard = () => (
  <AdminPageGuard requiredTab="partners">
    <Partners />
  </AdminPageGuard>
);

export default PartnersWithGuard;