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

      // Build parameter mapping object from enabled mappings
      const paramMapping: Record<string, string> = {};
      parameterMappings
        .filter(m => m.enabled && m.ourParam && m.theirParam)
        .forEach(m => {
          paramMapping[m.theirParam] = m.ourParam;
        });

      // We're generating a postback URL FOR the partner, not receiving one FROM them
      const partnerData = {
        ...formData,
        postback_url: 'https://placeholder.com', // Placeholder - backend generates real URL
        method: 'GET' as 'GET' | 'POST', // Default method
        parameter_mapping: paramMapping // Send parameter mappings to backend
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
      // Build parameter mapping object from enabled mappings
      const paramMapping: Record<string, string> = {};
      parameterMappings
        .filter(m => m.enabled && m.ourParam && m.theirParam)
        .forEach(m => {
          paramMapping[m.theirParam] = m.ourParam;
        });

      const updateData = {
        ...formData,
        parameter_mapping: paramMapping
      };

      await partnerApi.updatePartner(selectedPartner.partner_id, updateData);
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
    
    // Load parameter mappings if they exist
    if (partner.parameter_mapping) {
      const mappings: ParameterMapping[] = Object.entries(partner.parameter_mapping).map(([theirParam, ourParam]) => ({
        ourParam: ourParam as string,
        theirParam: theirParam,
        enabled: true
      }));
      setParameterMappings(mappings);
    } else {
      setParameterMappings(PARTNER_TEMPLATES['Custom']);
    }
    
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
          <TabsTrigger value="docs">Docs</TabsTrigger>
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

        {/* Documentation Tab */}
        <TabsContent value="docs" className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold mb-2">Postback Parameter Documentation</h2>
            <p className="text-gray-600">Complete reference for all parameters accepted in postback URLs</p>
          </div>

          {/* URL Format Section */}
          <Card>
            <CardHeader>
              <CardTitle>Postback URL Format</CardTitle>
              <CardDescription>How to structure your postback URLs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Base URL Format:</p>
                <code className="text-sm bg-white px-3 py-2 rounded border border-gray-200 block break-all">
                  https://moustacheleads-backend.onrender.com/postback/{'<UNIQUE_KEY>'}
                </code>
              </div>

              <div className="bg-blue-50 border border-blue-300 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-900 mb-2">Complete URL with Parameters:</p>
                <code className="text-xs bg-white px-3 py-2 rounded border border-blue-200 block break-all">
                  https://moustacheleads-backend.onrender.com/postback/{'<UNIQUE_KEY>'}?user_id={'{aff_sub}'}&payout={'{payout}'}&status={'{status}'}
                </code>
              </div>

              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
                <p className="text-sm font-semibold text-yellow-900 mb-2">⚠️ Important:</p>
                <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                  <li>Replace {'<UNIQUE_KEY>'} with your partner's unique postback key</li>
                  <li>Use THEIR parameter names in the URL (e.g., aff_sub, subid)</li>
                  <li>Wrap parameter values in curly braces as macros: {'{parameter_name}'}</li>
                  <li>Partner will replace macros with actual values when sending postbacks</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Parameter Mapping Explanation */}
          <Card>
            <CardHeader>
              <CardTitle>Understanding Parameter Mapping</CardTitle>
              <CardDescription>How OUR parameters map to THEIR parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-green-50 border border-green-300 rounded-lg p-4">
                  <h4 className="font-semibold text-green-900 mb-2">OUR Parameters (Left Side)</h4>
                  <p className="text-sm text-green-800">
                    These are the field names we use internally in our database. Examples: user_id, click_id, payout, status
                  </p>
                </div>
                <div className="bg-purple-50 border border-purple-300 rounded-lg p-4">
                  <h4 className="font-semibold text-purple-900 mb-2">THEIR Parameters (Right Side)</h4>
                  <p className="text-sm text-purple-800">
                    These are the parameter names the partner uses in their system. Examples: aff_sub, subid, s2, amount
                  </p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-green-50 to-purple-50 border border-gray-300 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Example Mapping Flow:</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="bg-green-100 px-3 py-1 rounded font-mono text-green-900">user_id</span>
                    <ArrowRight className="text-gray-500" size={20} />
                    <span className="bg-purple-100 px-3 py-1 rounded font-mono text-purple-900">aff_sub</span>
                    <span className="text-gray-600 ml-2">LeadAds uses "aff_sub" for user tracking</span>
                  </div>
                  <div className="bg-white border border-gray-200 rounded p-3 space-y-2">
                    <p className="text-xs text-gray-600">Generated URL includes:</p>
                    <code className="text-xs block">?aff_sub={'{aff_sub}'}</code>
                    <p className="text-xs text-gray-600 mt-2">When LeadAds sends postback:</p>
                    <code className="text-xs block">?aff_sub=507f1f77bcf86cd799439011</code>
                    <p className="text-xs text-green-700 mt-2 font-medium">✅ Our system maps aff_sub → user_id and credits that user!</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* All Available Parameters */}
          <Card>
            <CardHeader>
              <CardTitle>All Available Parameters</CardTitle>
              <CardDescription>Complete list of parameters we accept and their usage</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Core Parameters */}
                <div>
                  <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <Badge variant="default">Core Parameters</Badge>
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Parameter</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Example Value</TableHead>
                        <TableHead>Required</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell><code className="text-sm bg-gray-100 px-2 py-1 rounded">user_id</code></TableCell>
                        <TableCell>User MongoDB ID - identifies which user to credit</TableCell>
                        <TableCell><code className="text-xs">507f1f77bcf86cd799439011</code></TableCell>
                        <TableCell><Badge variant="destructive">Required</Badge></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><code className="text-sm bg-gray-100 px-2 py-1 rounded">click_id</code></TableCell>
                        <TableCell>Unique click identifier for tracking</TableCell>
                        <TableCell><code className="text-xs">CLK-ABC123</code></TableCell>
                        <TableCell><Badge variant="outline">Optional</Badge></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><code className="text-sm bg-gray-100 px-2 py-1 rounded">payout</code></TableCell>
                        <TableCell>Conversion payout amount (decimal)</TableCell>
                        <TableCell><code className="text-xs">10.50</code></TableCell>
                        <TableCell><Badge variant="outline">Optional</Badge></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><code className="text-sm bg-gray-100 px-2 py-1 rounded">status</code></TableCell>
                        <TableCell>Conversion status</TableCell>
                        <TableCell><code className="text-xs">approved, pending, rejected</code></TableCell>
                        <TableCell><Badge variant="outline">Optional</Badge></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Transaction Parameters */}
                <div>
                  <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <Badge variant="secondary">Transaction Parameters</Badge>
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Parameter</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Example Value</TableHead>
                        <TableHead>Usage</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell><code className="text-sm bg-gray-100 px-2 py-1 rounded">transaction_id</code></TableCell>
                        <TableCell>Transaction identifier from partner</TableCell>
                        <TableCell><code className="text-xs">TXN-XYZ789</code></TableCell>
                        <TableCell>Tracking & reconciliation</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><code className="text-sm bg-gray-100 px-2 py-1 rounded">conversion_id</code></TableCell>
                        <TableCell>Conversion identifier</TableCell>
                        <TableCell><code className="text-xs">CONV-456</code></TableCell>
                        <TableCell>Unique conversion tracking</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><code className="text-sm bg-gray-100 px-2 py-1 rounded">offer_id</code></TableCell>
                        <TableCell>Offer identifier</TableCell>
                        <TableCell><code className="text-xs">OFFER-123</code></TableCell>
                        <TableCell>Match to specific offer</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><code className="text-sm bg-gray-100 px-2 py-1 rounded">currency</code></TableCell>
                        <TableCell>Currency code (ISO 4217)</TableCell>
                        <TableCell><code className="text-xs">USD, EUR, GBP</code></TableCell>
                        <TableCell>Multi-currency support</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Tracking Parameters */}
                <div>
                  <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <Badge variant="outline">Tracking Parameters</Badge>
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Parameter</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Example Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell><code className="text-sm bg-gray-100 px-2 py-1 rounded">sub_id</code></TableCell>
                        <TableCell>Sub-affiliate ID for tracking</TableCell>
                        <TableCell><code className="text-xs">SUB-001</code></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><code className="text-sm bg-gray-100 px-2 py-1 rounded">campaign_id</code></TableCell>
                        <TableCell>Campaign identifier</TableCell>
                        <TableCell><code className="text-xs">CAMP-789</code></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><code className="text-sm bg-gray-100 px-2 py-1 rounded">affiliate_id</code></TableCell>
                        <TableCell>Affiliate identifier</TableCell>
                        <TableCell><code className="text-xs">AFF-456</code></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Additional Info Parameters */}
                <div>
                  <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <Badge variant="outline">Additional Info</Badge>
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Parameter</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Example Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell><code className="text-sm bg-gray-100 px-2 py-1 rounded">country</code></TableCell>
                        <TableCell>User's country code</TableCell>
                        <TableCell><code className="text-xs">US, UK, CA</code></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><code className="text-sm bg-gray-100 px-2 py-1 rounded">device_id</code></TableCell>
                        <TableCell>Device identifier</TableCell>
                        <TableCell><code className="text-xs">DEV-ABC123</code></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><code className="text-sm bg-gray-100 px-2 py-1 rounded">ip</code></TableCell>
                        <TableCell>User's IP address</TableCell>
                        <TableCell><code className="text-xs">192.168.1.1</code></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><code className="text-sm bg-gray-100 px-2 py-1 rounded">user_agent</code></TableCell>
                        <TableCell>Browser user agent</TableCell>
                        <TableCell><code className="text-xs">Mozilla/5.0...</code></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="mt-6 bg-blue-50 border border-blue-300 rounded-lg p-4">
                <p className="text-sm font-semibold text-blue-900 mb-2">💡 Custom Parameters:</p>
                <p className="text-sm text-blue-800">
                  Any additional parameters you send will be captured in the <code className="bg-white px-2 py-0.5 rounded">custom_data</code> field 
                  and stored for reporting purposes. This allows you to send partner-specific data without modifying our system.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Common Partner Templates */}
          <Card>
            <CardHeader>
              <CardTitle>Common Partner Parameter Names</CardTitle>
              <CardDescription>How different partners name their parameters</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  {/* LeadAds */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold mb-3">LeadAds</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <code className="bg-green-100 px-2 py-1 rounded text-xs">user_id</code>
                        <ArrowRight size={14} />
                        <code className="bg-purple-100 px-2 py-1 rounded text-xs">aff_sub</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="bg-green-100 px-2 py-1 rounded text-xs">status</code>
                        <ArrowRight size={14} />
                        <code className="bg-purple-100 px-2 py-1 rounded text-xs">status</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="bg-green-100 px-2 py-1 rounded text-xs">payout</code>
                        <ArrowRight size={14} />
                        <code className="bg-purple-100 px-2 py-1 rounded text-xs">payout</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="bg-green-100 px-2 py-1 rounded text-xs">transaction_id</code>
                        <ArrowRight size={14} />
                        <code className="bg-purple-100 px-2 py-1 rounded text-xs">transaction_id</code>
                      </div>
                    </div>
                  </div>

                  {/* CPALead */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold mb-3">CPALead</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <code className="bg-green-100 px-2 py-1 rounded text-xs">user_id</code>
                        <ArrowRight size={14} />
                        <code className="bg-purple-100 px-2 py-1 rounded text-xs">subid</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="bg-green-100 px-2 py-1 rounded text-xs">click_id</code>
                        <ArrowRight size={14} />
                        <code className="bg-purple-100 px-2 py-1 rounded text-xs">s2</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="bg-green-100 px-2 py-1 rounded text-xs">status</code>
                        <ArrowRight size={14} />
                        <code className="bg-purple-100 px-2 py-1 rounded text-xs">status</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="bg-green-100 px-2 py-1 rounded text-xs">payout</code>
                        <ArrowRight size={14} />
                        <code className="bg-purple-100 px-2 py-1 rounded text-xs">payout</code>
                      </div>
                    </div>
                  </div>

                  {/* OfferToro */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold mb-3">OfferToro</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <code className="bg-green-100 px-2 py-1 rounded text-xs">user_id</code>
                        <ArrowRight size={14} />
                        <code className="bg-purple-100 px-2 py-1 rounded text-xs">user_id</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="bg-green-100 px-2 py-1 rounded text-xs">status</code>
                        <ArrowRight size={14} />
                        <code className="bg-purple-100 px-2 py-1 rounded text-xs">status</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="bg-green-100 px-2 py-1 rounded text-xs">payout</code>
                        <ArrowRight size={14} />
                        <code className="bg-purple-100 px-2 py-1 rounded text-xs">amount</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="bg-green-100 px-2 py-1 rounded text-xs">transaction_id</code>
                        <ArrowRight size={14} />
                        <code className="bg-purple-100 px-2 py-1 rounded text-xs">oid</code>
                      </div>
                    </div>
                  </div>

                  {/* AdGate Media */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold mb-3">AdGate Media</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <code className="bg-green-100 px-2 py-1 rounded text-xs">user_id</code>
                        <ArrowRight size={14} />
                        <code className="bg-purple-100 px-2 py-1 rounded text-xs">subid</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="bg-green-100 px-2 py-1 rounded text-xs">status</code>
                        <ArrowRight size={14} />
                        <code className="bg-purple-100 px-2 py-1 rounded text-xs">status</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="bg-green-100 px-2 py-1 rounded text-xs">payout</code>
                        <ArrowRight size={14} />
                        <code className="bg-purple-100 px-2 py-1 rounded text-xs">payout</code>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Real Example */}
          <Card>
            <CardHeader>
              <CardTitle>Complete Example: LeadAds Integration</CardTitle>
              <CardDescription>Step-by-step example of how postback URLs work</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                  <p className="font-semibold mb-2">Step 1: Generate Postback URL</p>
                  <p className="text-sm text-gray-700 mb-2">You create a partner "LeadAds" with these mappings:</p>
                  <div className="bg-white border rounded p-3 space-y-1 text-sm">
                    <div><code>user_id → aff_sub</code></div>
                    <div><code>payout → payout</code></div>
                    <div><code>status → status</code></div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-300 rounded-lg p-4">
                  <p className="font-semibold mb-2">Step 2: System Generates URL</p>
                  <code className="text-xs bg-white px-3 py-2 rounded border block break-all">
                    https://moustacheleads-backend.onrender.com/postback/7oT5qV7uYB3iCyx33iOGluhlalhSEGDq?aff_sub={'{aff_sub}'}&payout={'{payout}'}&status={'{status}'}
                  </code>
                  <p className="text-sm text-blue-800 mt-2">You share this URL with LeadAds</p>
                </div>

                <div className="bg-green-50 border border-green-300 rounded-lg p-4">
                  <p className="font-semibold mb-2">Step 3: LeadAds Sends Postback</p>
                  <p className="text-sm text-gray-700 mb-2">When user completes offer, LeadAds sends:</p>
                  <code className="text-xs bg-white px-3 py-2 rounded border block break-all">
                    https://moustacheleads-backend.onrender.com/postback/7oT5qV7uYB3iCyx33iOGluhlalhSEGDq?aff_sub=507f1f77bcf86cd799439011&payout=10.00&status=approved
                  </code>
                </div>

                <div className="bg-purple-50 border border-purple-300 rounded-lg p-4">
                  <p className="font-semibold mb-2">Step 4: Our System Processes</p>
                  <div className="text-sm space-y-2">
                    <p>✅ Receives: <code className="bg-white px-2 py-1 rounded">aff_sub=507f1f77bcf86cd799439011</code></p>
                    <p>✅ Maps: <code className="bg-white px-2 py-1 rounded">aff_sub → user_id</code></p>
                    <p>✅ Credits: User <code className="bg-white px-2 py-1 rounded">507f1f77bcf86cd799439011</code> with $10.00</p>
                    <p className="text-green-700 font-medium mt-2">🎉 User receives points!</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Tips */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Tips & Best Practices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Always use THEIR parameter names in the URL</p>
                    <p className="text-sm text-gray-600">The URL is for the partner to use, so it must use their naming convention</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Use parameter mapping to avoid confusion</p>
                    <p className="text-sm text-gray-600">Map OUR internal names to THEIR external names for clarity</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Test with sample data first</p>
                    <p className="text-sm text-gray-600">Always test postback URLs before going live with a partner</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Keep unique keys confidential</p>
                    <p className="text-sm text-gray-600">Each partner gets a unique key - don't share it publicly</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
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
                
                {/* Mapping Explanation */}
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs font-semibold text-blue-900 mb-2">📌 How the mapping works:</p>
                  <div className="space-y-1 text-xs text-blue-800">
                    {parameterMappings
                      .filter(m => m.enabled && m.ourParam && m.theirParam)
                      .map((m, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="font-mono bg-white px-2 py-0.5 rounded border border-blue-300">
                            {m.theirParam}
                          </span>
                          <span>in URL maps to</span>
                          <span className="font-mono bg-white px-2 py-0.5 rounded border border-blue-300">
                            {m.ourParam}
                          </span>
                          <span>in your database</span>
                        </div>
                      ))}
                  </div>
                  <p className="text-xs text-blue-700 mt-2">
                    When LeadAds sends <code className="bg-white px-1 rounded">aff_sub=507f1f77...</code>, 
                    your system will credit the user with that ID.
                  </p>
                </div>
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
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Partner</DialogTitle>
            <DialogDescription>
              Update partner configuration and parameter mappings
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">Basic Information</h3>
              
              <div>
                <Label htmlFor="edit_partner_name">Partner Name *</Label>
                <Input
                  id="edit_partner_name"
                  value={formData.partner_name}
                  onChange={(e) => setFormData({ ...formData, partner_name: e.target.value })}
                />
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

            {/* Generated URL Preview */}
            <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Updated Postback URL Preview
              </h4>
              <div className="space-y-2">
                <p className="text-xs text-gray-600">This URL will be updated:</p>
                <div className="relative">
                  <div className="bg-white border border-gray-300 rounded-lg p-3 pr-12 font-mono text-xs break-all">
                    {(() => {
                      const baseURL = selectedPartner?.postback_receiver_url?.split('?')[0] || 'https://postback.moustacheleads.com/postback/[KEY]';
                      const params = parameterMappings
                        .filter(m => m.enabled && m.ourParam && m.theirParam)
                        .map(m => `${m.theirParam}={${m.theirParam}}`)
                        .join('&');
                      return `${baseURL}${params ? '?' + params : ''}`;
                    })()}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const baseURL = selectedPartner?.postback_receiver_url?.split('?')[0] || '';
                      const params = parameterMappings
                        .filter(m => m.enabled && m.ourParam && m.theirParam)
                        .map(m => `${m.theirParam}={${m.theirParam}}`)
                        .join('&');
                      copyToClipboard(`${baseURL}${params ? '?' + params : ''}`);
                    }}
                    className="absolute top-2 right-2"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* Mapping Explanation */}
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs font-semibold text-blue-900 mb-2">📌 How the mapping works:</p>
                  <div className="space-y-1 text-xs text-blue-800">
                    {parameterMappings
                      .filter(m => m.enabled && m.ourParam && m.theirParam)
                      .map((m, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="font-mono bg-white px-2 py-0.5 rounded border border-blue-300">
                            {m.theirParam}
                          </span>
                          <span>in URL maps to</span>
                          <span className="font-mono bg-white px-2 py-0.5 rounded border border-blue-300">
                            {m.ourParam}
                          </span>
                          <span>in your database</span>
                        </div>
                      ))}
                  </div>
                  <p className="text-xs text-blue-700 mt-2">
                    The URL uses <strong>their parameter names</strong> (like aff_sub) because that's what they expect. 
                    Your backend will map it back to <strong>your field names</strong> (like user_id).
                  </p>
                </div>
              </div>
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