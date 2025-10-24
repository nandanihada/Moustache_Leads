import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Globe, 
  Plus, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Shield, 
  ShieldCheck,
  Info,
  RefreshCw
} from 'lucide-react';
import { 
  linkMaskingApi, 
  MaskingDomain, 
  CreateDomainData 
} from '@/services/linkMaskingApi';
import { useToast } from '@/hooks/use-toast';

interface DomainManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DomainManagementModal: React.FC<DomainManagementModalProps> = ({
  open,
  onOpenChange
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [domains, setDomains] = useState<MaskingDomain[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingDomain, setEditingDomain] = useState<MaskingDomain | null>(null);

  const [formData, setFormData] = useState<CreateDomainData>({
    domain: '',
    name: '',
    description: '',
    ssl_enabled: true,
    default_redirect_type: '302',
    status: 'active',
    priority: 1
  });

  useEffect(() => {
    if (open) {
      loadDomains();
    }
  }, [open]);

  const loadDomains = async () => {
    try {
      setLoading(true);
      const response = await linkMaskingApi.getDomains(false); // Get all domains including inactive
      setDomains(response.domains);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load domains",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      domain: '',
      name: '',
      description: '',
      ssl_enabled: true,
      default_redirect_type: '302',
      status: 'active',
      priority: 1
    });
    setEditingDomain(null);
    setShowAddForm(false);
  };

  const handleInputChange = (field: keyof CreateDomainData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      if (editingDomain) {
        // Update existing domain
        await linkMaskingApi.updateDomain(editingDomain._id, formData);
        toast({
          title: "Success",
          description: "Domain updated successfully",
        });
      } else {
        // Create new domain
        await linkMaskingApi.createDomain(formData);
        toast({
          title: "Success",
          description: "Domain created successfully",
        });
      }
      
      resetForm();
      loadDomains();
      
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save domain",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (domain: MaskingDomain) => {
    setFormData({
      domain: domain.domain,
      name: domain.name,
      description: domain.description || '',
      ssl_enabled: domain.ssl_enabled,
      default_redirect_type: domain.default_redirect_type,
      status: domain.status,
      priority: domain.priority
    });
    setEditingDomain(domain);
    setShowAddForm(true);
  };

  const handleDelete = async (domainId: string) => {
    if (!confirm('Are you sure you want to delete this domain? This action cannot be undone.')) {
      return;
    }

    try {
      await linkMaskingApi.deleteDomain(domainId);
      toast({
        title: "Success",
        description: "Domain deleted successfully",
      });
      loadDomains();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete domain",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Domain Management
          </DialogTitle>
          <DialogDescription>
            Manage masking domains for link shortening and tracking.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add/Edit Form */}
          {showAddForm && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingDomain ? 'Edit Domain' : 'Add New Domain'}
                </CardTitle>
                <CardDescription>
                  {editingDomain ? 'Update domain configuration' : 'Configure a new masking domain'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="domain">Domain *</Label>
                      <Input
                        id="domain"
                        value={formData.domain}
                        onChange={(e) => handleInputChange('domain', e.target.value)}
                        placeholder="example.com"
                        required
                        disabled={!!editingDomain} // Can't change domain after creation
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        Domain name without protocol (e.g., short.ly)
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="name">Display Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        placeholder="Short Links Domain"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Description of this domain's purpose..."
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select 
                        value={formData.status} 
                        onValueChange={(value: 'active' | 'inactive') => handleInputChange('status', value)}
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
                      <Label htmlFor="redirect_type">Default Redirect</Label>
                      <Select 
                        value={formData.default_redirect_type} 
                        onValueChange={(value: '301' | '302' | '307') => handleInputChange('default_redirect_type', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="301">301 - Permanent</SelectItem>
                          <SelectItem value="302">302 - Temporary</SelectItem>
                          <SelectItem value="307">307 - Temporary (Strict)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="priority">Priority</Label>
                      <Input
                        id="priority"
                        type="number"
                        min="1"
                        max="100"
                        value={formData.priority}
                        onChange={(e) => handleInputChange('priority', parseInt(e.target.value) || 1)}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="ssl_enabled">SSL Enabled</Label>
                      <p className="text-sm text-muted-foreground">
                        Use HTTPS for masked links
                      </p>
                    </div>
                    <Switch
                      id="ssl_enabled"
                      checked={formData.ssl_enabled}
                      onCheckedChange={(checked) => handleInputChange('ssl_enabled', checked)}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" disabled={loading}>
                      {loading ? 'Saving...' : editingDomain ? 'Update Domain' : 'Create Domain'}
                    </Button>
                    <Button type="button" variant="outline" onClick={resetForm}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Domains List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Masking Domains ({domains.length})</CardTitle>
                  <CardDescription>
                    Manage your link masking domains and their configurations
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadDomains}
                    disabled={loading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setShowAddForm(true)}
                    disabled={showAddForm}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Domain
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  Loading domains...
                </div>
              ) : domains.length === 0 ? (
                <div className="text-center py-8">
                  <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No domains configured</p>
                  <Button onClick={() => setShowAddForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Domain
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Domain</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>SSL</TableHead>
                      <TableHead>Redirect</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {domains.map((domain) => (
                      <TableRow key={domain._id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-blue-600" />
                            <span className="font-mono">{domain.domain}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{domain.name}</div>
                            {domain.description && (
                              <div className="text-sm text-muted-foreground">
                                {domain.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(domain.status)}>
                            {domain.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {domain.ssl_enabled ? (
                            <ShieldCheck className="h-4 w-4 text-green-600" />
                          ) : (
                            <Shield className="h-4 w-4 text-gray-400" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {domain.default_redirect_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {domain.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {domain.created_at ? new Date(domain.created_at).toLocaleDateString() : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(domain)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={() => handleDelete(domain._id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {domains.length > 0 && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-900">Domain Setup Instructions</span>
              </div>
              <div className="text-sm text-blue-700 space-y-1">
                <p>1. <strong>DNS Configuration:</strong> Point your domain to your server's IP address</p>
                <p>2. <strong>SSL Certificate:</strong> Ensure SSL is properly configured for HTTPS</p>
                <p>3. <strong>Web Server:</strong> Configure your web server to handle the domain</p>
                <p>4. <strong>Testing:</strong> Test domain accessibility before creating masked links</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
