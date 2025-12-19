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
import { useToast } from '@/hooks/use-toast';
import { partnerApi, Partner, CreatePartnerData } from '@/services/partnerApi';
import { Plus, Edit, Trash2, TestTube, Copy, CheckCircle, XCircle, Loader2 } from 'lucide-react';
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

const Partners: React.FC = () => {
  const { toast } = useToast();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);

  const [formData, setFormData] = useState<CreatePartnerData>({
    partner_name: '',
    postback_url: '',
    method: 'GET',
    status: 'active',
    description: ''
  });

  useEffect(() => {
    fetchPartners();
  }, []);

  const fetchPartners = async () => {
    try {
      setLoading(true);
      const data = await partnerApi.getPartners();
      setPartners(data.partners);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.error || 'Failed to fetch partners',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddPartner = async () => {
    try {
      if (!formData.partner_name || !formData.postback_url) {
        toast({
          title: 'Validation Error',
          description: 'Partner name and postback URL are required',
          variant: 'destructive'
        });
        return;
      }

      await partnerApi.createPartner(formData);
      toast({
        title: 'Success',
        description: 'Partner created successfully'
      });
      setIsAddModalOpen(false);
      resetForm();
      fetchPartners();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.error || 'Failed to create partner',
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
          <p className="text-gray-600 mt-1">Manage partners and their postback configurations</p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Partner
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Partners ({partners.length})</CardTitle>
            <CardDescription>List of all configured partners</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner Name</TableHead>
                  <TableHead>Postback URL</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500">
                      No partners found. Add your first partner to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  partners.map((partner) => (
                    <TableRow key={partner.partner_id}>
                      <TableCell className="font-medium">{partner.partner_name}</TableCell>
                      <TableCell className="max-w-xs truncate" title={partner.postback_url}>
                        {partner.postback_url}
                      </TableCell>
                      <TableCell>
                        <Badge variant={partner.method === 'GET' ? 'default' : 'secondary'}>
                          {partner.method}
                        </Badge>
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
                            onClick={() => handleTestPartner(partner)}
                          >
                            <TestTube className="h-4 w-4" />
                          </Button>
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

      {/* Add Partner Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Partner</DialogTitle>
            <DialogDescription>
              Configure a new partner with postback URL and settings
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="partner_name">Partner Name *</Label>
              <Input
                id="partner_name"
                value={formData.partner_name}
                onChange={(e) => setFormData({ ...formData, partner_name: e.target.value })}
                placeholder="e.g., MaxBounty, CPAlead"
              />
            </div>

            <div>
              <Label htmlFor="postback_url">Postback URL *</Label>
              <Textarea
                id="postback_url"
                value={formData.postback_url}
                onChange={(e) => setFormData({ ...formData, postback_url: e.target.value })}
                placeholder="https://partner.com/postback?click_id={click_id}&payout={payout}"
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
              <Label htmlFor="method">Method *</Label>
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
              <Label htmlFor="status">Status</Label>
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
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional notes about this partner"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddModalOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleAddPartner}>Create Partner</Button>
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
    </div>
  );
};

const PartnersWithGuard = () => (
  <AdminPageGuard requiredTab="partners">
    <Partners />
  </AdminPageGuard>
);

export default PartnersWithGuard;