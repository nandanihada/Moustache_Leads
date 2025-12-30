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
import { Plus, Edit, Trash2, TestTube, Copy, CheckCircle, XCircle, Loader2, Ban, CheckCheck, Settings, ArrowRight } from 'lucide-react';
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
        toast({
          title: 'Validation Error',
          description: 'Partner name is required',
          variant: 'destructive'
        });
        return;
      }

      // We're generating a postback URL FOR the partner, not receiving one FROM them
      // So we set a placeholder - the backend will generate the actual unique URL
      const partnerData = {
        ...formData,
        postback_url: 'https://placeholder.com', // Placeholder - backend generates real URL
        method: 'GET' as 'GET' | 'POST' // Default method
      };

      await partnerApi.createPartner(partnerData);
      toast({
        title: 'Success',
        description: 'Postback URL generated successfully! Share it with your partner.'
      });
      setIsAddModalOpen(false);
      resetForm();
      fetchPartners();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.error || 'Failed to generate postback URL',
        variant: 'destructive'
      });
    }
  };

  const handleEditPartner = async () => {
    if (!selectedPartner) return;

    try {
      await partnerApi.updatePartner(selectedPartner.partner_id, formData);
      toast({
        title: 'Success',
        description: 'Partner updated successfully'
      });
      setIsEditModalOpen(false);
      setSelectedPartner(null);
      resetForm();
      fetchPartners();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.error || 'Failed to update partner',
        variant: 'destructive'
      });
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
    setParameterMappings(PARTNER_TEMPLATES['LeadAds']);
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
    <div className="container mx-auto p-6">
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
        </TabsList>

        {/* Upward Partners Tab */}
        <TabsContent value="upward" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Upward Partners</h2>
              <p className="text-sm text-gray-600">Generate postback URLs to share with partners who will send us conversion notifications</p>
            </div>
            <Button onClick={() => setIsAddModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Generate Postback URL
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Upward Partners ({partners.length})</CardTitle>
                <CardDescription>Partners who send us postbacks using our generated URLs</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Partner Name</TableHead>
                      <TableHead>Our Postback URL (Share with Partner)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partners.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-gray-500">
                          No upward partners configured. Click "Generate Postback URL" to create one.
                        </TableCell>
                      </TableRow>
                    ) : (
                      partners.map((partner) => (
                        <TableRow key={partner.partner_id}>
                          <TableCell className="font-medium">{partner.partner_name}</TableCell>
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
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditModal(partner)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDeleteDialog(partner)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Downward Partners Tab */}
        <TabsContent value="downward" className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Downward Partners (Registered Users)</h2>
            <p className="text-sm text-gray-600">All registered users/publishers who receive postbacks from us</p>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Registered Users ({users.length})</CardTitle>
                <CardDescription>Manage postback configurations for all registered users</CardDescription>
              </CardHeader>
              <CardContent>
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
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-gray-500">
                          No registered users found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((user) => (
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
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Generate Postback URL Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate Postback URL for Upward Partner</DialogTitle>
            <DialogDescription>
              Create a unique postback URL with visual parameter mapping to share with your upward partner.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Information Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">Basic Information</h3>
              
              <div>
                <Label htmlFor="partner_name">Partner Name *</Label>
                <Input
                  id="partner_name"
                  value={formData.partner_name}
                  onChange={(e) => setFormData({ ...formData, partner_name: e.target.value })}
                  placeholder="e.g., LeadAds, CPALead, OfferToro"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Enter the name of the partner who will send you postbacks
                </p>
              </div>

              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., Survey offers partner, CPA network for gaming offers"
                  rows={2}
                />
              </div>

              <div>
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: 'active' | 'inactive') => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Parameter Mapping Section */}
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Parameter Mapping</h3>
                  <p className="text-sm text-gray-600">Map your parameters to their parameter names</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addMapping}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Parameter
                </Button>
              </div>

              {/* Partner Template Selection */}
              <div>
                <Label>Partner Template (Quick Start)</Label>
                <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LeadAds">LeadAds</SelectItem>
                    <SelectItem value="CPALead">CPALead</SelectItem>
                    <SelectItem value="OfferToro">OfferToro</SelectItem>
                    <SelectItem value="AdGate Media">AdGate Media</SelectItem>
                    <SelectItem value="Custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-gray-500 mt-1">
                  Select a template to auto-fill common parameter mappings
                </p>
              </div>

              {/* Parameter Mapping Table */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-3 bg-gray-50 px-4 py-3 border-b border-gray-200 text-sm">
                  <div className="col-span-1 text-center font-medium text-gray-700">Enable</div>
                  <div className="col-span-4 font-medium text-gray-700">OUR Parameter</div>
                  <div className="col-span-1 text-center text-gray-400"></div>
                  <div className="col-span-4 font-medium text-gray-700">THEIR Parameter</div>
                  <div className="col-span-2 text-center font-medium text-gray-700">Actions</div>
                </div>

                {/* Table Body */}
                <div className="divide-y divide-gray-200 max-h-64 overflow-y-auto">
                  {parameterMappings.map((mapping, index) => (
                    <div key={index} className="grid grid-cols-12 gap-3 px-4 py-3 items-center hover:bg-gray-50">
                      {/* Enable Checkbox */}
                      <div className="col-span-1 text-center">
                        <input
                          type="checkbox"
                          checked={mapping.enabled}
                          onChange={(e) => handleMappingChange(index, 'enabled', e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </div>

                      {/* Our Parameter */}
                      <div className="col-span-4">
                        <select
                          value={mapping.ourParam}
                          onChange={(e) => handleMappingChange(index, 'ourParam', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          <option value="">Select...</option>
                          {AVAILABLE_OUR_PARAMS.map(param => (
                            <option key={param.value} value={param.value}>
                              {param.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Arrow */}
                      <div className="col-span-1 text-center">
                        <ArrowRight className="mx-auto text-blue-500" size={18} />
                      </div>

                      {/* Their Parameter */}
                      <div className="col-span-4">
                        <Input
                          value={mapping.theirParam}
                          onChange={(e) => handleMappingChange(index, 'theirParam', e.target.value)}
                          placeholder="e.g., aff_sub, subid"
                          className="font-mono text-sm"
                        />
                      </div>

                      {/* Actions */}
                      <div className="col-span-2 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMapping(index)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {parameterMappings.length === 0 && (
                <div className="text-center py-6 text-gray-500 text-sm">
                  No parameter mappings. Click "Add Parameter" to start.
                </div>
              )}
            </div>

            {/* Info Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">📋 How It Works:</h4>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>We'll generate a unique postback URL with your parameter mappings</li>
                <li>Share this URL with your partner</li>
                <li>Partner will send postbacks using THEIR parameter names</li>
                <li>Our system automatically maps their parameters to ours</li>
                <li>Users get credited based on the mapped user_id</li>
              </ol>
            </div>

            {/* Generated URL Preview */}
            <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Generated Postback URL Preview
              </h4>
              <div className="space-y-2">
                <p className="text-xs text-gray-600">This URL will be generated and shared with your partner:</p>
                <div className="relative">
                  <div className="bg-white border border-gray-300 rounded-lg p-3 pr-12 font-mono text-xs break-all">
                    {(() => {
                      const baseURL = 'https://moustacheleads-backend.onrender.com/postback';
                      const params = parameterMappings
                        .filter(m => m.enabled && m.ourParam && m.theirParam)
                        .map(m => `${m.theirParam}={${m.theirParam}}`)
                        .join('&');
                      return `${baseURL}/[UNIQUE_KEY]${params ? '?' + params : ''}`;
                    })()}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const baseURL = 'https://moustacheleads-backend.onrender.com/postback';
                      const params = parameterMappings
                        .filter(m => m.enabled && m.ourParam && m.theirParam)
                        .map(m => `${m.theirParam}={${m.theirParam}}`)
                        .join('&');
                      copyToClipboard(`${baseURL}/[UNIQUE_KEY]${params ? '?' + params : ''}`);
                    }}
                    className="absolute top-2 right-2"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Note: [UNIQUE_KEY] will be automatically generated when you create the partner
                </p>
              </div>
            </div>

            {/* Example */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2">💡 Example:</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <code className="bg-white px-2 py-1 rounded border text-xs">user_id</code>
                  <ArrowRight size={14} className="text-gray-400" />
                  <code className="bg-white px-2 py-1 rounded border text-xs">aff_sub</code>
                  <span className="text-gray-600">Partner uses "aff_sub" for user tracking</span>
                </div>
                <div className="mt-2 p-2 bg-white rounded border">
                  <p className="text-xs text-gray-600 mb-1">Generated URL will include:</p>
                  <code className="text-xs text-gray-800">?aff_sub={'{aff_sub}'}&status={'{status}'}&payout={'{payout}'}</code>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddModalOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleAddPartner}>
              Generate Postback URL
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Partner Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Partner</DialogTitle>
            <DialogDescription>
              Update partner configuration
            </DialogDescription>
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
              <Label htmlFor="edit_postback_url">Postback URL *</Label>
              <Textarea
                id="edit_postback_url"
                value={formData.postback_url}
                onChange={(e) => setFormData({ ...formData, postback_url: e.target.value })}
                rows={3}
              />
              <div className="flex flex-wrap gap-2 mt-2">
                <p className="text-sm text-gray-600 w-full">Insert macros:</p>
                {['{click_id}', '{payout}', '{status}', '{offer_id}', '{conversion_id}', '{transaction_id}'].map((macro) => (
                  <Button
                    key={macro}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertMacro(macro)}
                  >
                    {macro}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="edit_method">Method *</Label>
              <Select
                value={formData.method}
                onValueChange={(value: 'GET' | 'POST') => setFormData({ ...formData, method: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="edit_status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: 'active' | 'inactive') => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="edit_description">Description</Label>
              <Textarea
                id="edit_description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditModalOpen(false); setSelectedPartner(null); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleEditPartner}>Update Partner</Button>
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