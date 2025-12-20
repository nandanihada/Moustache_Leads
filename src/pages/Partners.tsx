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
import { Plus, Edit, Trash2, TestTube, Copy, CheckCircle, XCircle, Loader2, Ban, CheckCheck, Settings } from 'lucide-react';
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Generate Postback URL for Upward Partner</DialogTitle>
            <DialogDescription>
              Create a unique postback URL to share with your upward partner. They will use this URL to send conversion notifications to you.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="partner_name">Partner Name *</Label>
              <Input
                id="partner_name"
                value={formData.partner_name}
                onChange={(e) => setFormData({ ...formData, partner_name: e.target.value })}
                placeholder="e.g., SurveyTitans, CPAlead, MaxBounty"
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

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">What happens next?</h4>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>We'll generate a unique postback URL for this partner</li>
                <li>Share this URL with your partner</li>
                <li>They'll use it to send conversion notifications to you</li>
                <li>You'll see all received postbacks in the "Postback" tab</li>
              </ol>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddModalOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleAddPartner}>
              Generate URL
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