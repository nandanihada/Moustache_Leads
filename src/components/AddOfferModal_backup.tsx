import React, { useState } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, X, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CreateOfferData, adminOfferApi } from '@/services/adminOfferApi';
import { useToast } from '@/hooks/use-toast';

interface AddOfferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOfferCreated?: () => void;
}

const COUNTRIES = [
  'US', 'CA', 'UK', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL', 'SE', 'NO', 'DK', 'FI',
  'BR', 'MX', 'AR', 'CL', 'CO', 'PE', 'IN', 'JP', 'KR', 'CN', 'SG', 'MY', 'TH',
  'PH', 'ID', 'VN', 'ZA', 'NG', 'EG', 'MA', 'KE', 'GH', 'TN', 'DZ', 'AO'
];

const NETWORKS = [
  'AdGate Media', 'SuperRewards', 'CPAlead', 'OfferToro', 'RevenueUniverse',
  'Wannads', 'Adscend Media', 'Persona.ly', 'Kiwi Wall', 'Offerdaddy'
];

export const AddOfferModal: React.FC<AddOfferModalProps> = ({
  open,
  onOpenChange,
  onOfferCreated
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [expirationDate, setExpirationDate] = useState<Date>();
  const [newCountry, setNewCountry] = useState('');
  const [newUser, setNewUser] = useState('');

  const [formData, setFormData] = useState<CreateOfferData>({
    campaign_id: '',
    name: '',
    description: '',
    status: 'pending',
    countries: [],
    payout: 0,
    network: '',
    affiliates: 'all',
    selected_users: [],
    image_url: '',
    thumbnail_url: '',
    hash_code: '',
    limit: undefined,
    target_url: '',
    preview_url: '',
    expiration_date: '',
    device_targeting: 'all'
  });

  const handleInputChange = (field: keyof CreateOfferData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addCountry = () => {
    if (newCountry && !selectedCountries.includes(newCountry)) {
      const updated = [...selectedCountries, newCountry];
      setSelectedCountries(updated);
      handleInputChange('countries', updated);
      setNewCountry('');
    }
  };

  const removeCountry = (country: string) => {
    const updated = selectedCountries.filter(c => c !== country);
    setSelectedCountries(updated);
    handleInputChange('countries', updated);
  };

  const addUser = () => {
    if (newUser && !selectedUsers.includes(newUser)) {
      const updated = [...selectedUsers, newUser];
      setSelectedUsers(updated);
      handleInputChange('selected_users', updated);
      setNewUser('');
    }
  };

  const removeUser = (user: string) => {
    const updated = selectedUsers.filter(u => u !== user);
    setSelectedUsers(updated);
    handleInputChange('selected_users', updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Prepare data for submission
      const submitData = {
        ...formData,
        countries: selectedCountries,
        selected_users: formData.affiliates === 'selected' ? selectedUsers : [],
        expiration_date: expirationDate ? format(expirationDate, 'yyyy-MM-dd') : '',
        payout: Number(formData.payout),
        limit: formData.limit ? Number(formData.limit) : undefined
      };

      await adminOfferApi.createOffer(submitData);
      
      toast({
        title: "Success",
        description: "Offer created successfully!",
      });

      // Reset form
      setFormData({
        campaign_id: '',
        name: '',
        description: '',
        status: 'pending',
        countries: [],
        payout: 0,
        network: '',
        affiliates: 'all',
        selected_users: [],
        image_url: '',
        thumbnail_url: '',
        hash_code: '',
        limit: undefined,
        target_url: '',
        preview_url: '',
        expiration_date: '',
        device_targeting: 'all'
      });
      setSelectedCountries([]);
      setSelectedUsers([]);
      setExpirationDate(undefined);

      onOpenChange(false);
      onOfferCreated?.();

    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create offer",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Offer</DialogTitle>
          <DialogDescription>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs defaultValue="identification" className="w-full">
          <TabsList className="grid w-full grid-cols-11 text-xs">
            <TabsTrigger value="identification">ID</TabsTrigger>
            <TabsTrigger value="targeting">Target</TabsTrigger>
            <TabsTrigger value="payout">Payout</TabsTrigger>
            <TabsTrigger value="tracking">Track</TabsTrigger>
            <TabsTrigger value="access">Access</TabsTrigger>
            <TabsTrigger value="creatives">Creative</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="rules">Rules</TabsTrigger>
            <TabsTrigger value="compliance">Comply</TabsTrigger>
            <TabsTrigger value="integrations">Integrate</TabsTrigger>
            <TabsTrigger value="reporting">Report</TabsTrigger>
          </TabsList>

            {/* SECTION 1: OFFER IDENTIFICATION */}
            <TabsContent value="identification" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Offer Identification</CardTitle>
                  <CardDescription>Basic offer details and identification</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="campaign_id">Campaign ID *</Label>
                      <Input
                        id="campaign_id"
                        value={formData.campaign_id}
                        onChange={(e) => handleInputChange('campaign_id', e.target.value)}
                        placeholder="CAMP-001"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="name">Offer Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="Premium Survey Offer"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description || ''}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Detailed offer description"
                      rows={3}
                    />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="category">Category</Label>
                      <Select value={formData.category || ''} onValueChange={(value) => handleInputChange('category', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="finance">Finance</SelectItem>
                          <SelectItem value="gaming">Gaming</SelectItem>
                          <SelectItem value="dating">Dating</SelectItem>
                          <SelectItem value="health">Health</SelectItem>
                          <SelectItem value="education">Education</SelectItem>
                          <SelectItem value="general">General</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="offer_type">Offer Type</Label>
                      <Select value={formData.offer_type || ''} onValueChange={(value) => handleInputChange('offer_type', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CPA">CPA</SelectItem>
                          <SelectItem value="CPL">CPL</SelectItem>
                          <SelectItem value="CPS">CPS</SelectItem>
                          <SelectItem value="CPI">CPI</SelectItem>
                          <SelectItem value="CPC">CPC</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select value={formData.status || ''} onValueChange={(value) => handleInputChange('status', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="paused">Paused</SelectItem>
                          <SelectItem value="hidden">Hidden</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SECTION 2: TARGETING RULES */}
            <TabsContent value="targeting" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Targeting Rules</CardTitle>
                  <CardDescription>Define who can see this offer</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Countries Selection */}
                  <div>
                    <Label>Countries *</Label>
                    <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-gray-50 max-h-32 overflow-y-auto">
                      {COUNTRIES.map(country => (
                        <Badge
                          key={country}
                          variant={selectedCountries.includes(country) ? "default" : "outline"}
                          className="cursor-pointer hover:bg-blue-100"
                          onClick={() => selectedCountries.includes(country) ? removeCountry(country) : addCountry(country)}
                        >
                          {country}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Selected: {selectedCountries.length} countries
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="device_targeting">Device Targeting *</Label>
                      <Select value={formData.device_targeting} onValueChange={(value) => handleInputChange('device_targeting', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Devices</SelectItem>
                          <SelectItem value="mobile">Mobile Only</SelectItem>
                          <SelectItem value="desktop">Desktop Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="connection_type">Connection Type</Label>
                      <Select value={formData.connection_type || ''} onValueChange={(value) => handleInputChange('connection_type', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Any connection" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Connections</SelectItem>
                          <SelectItem value="wifi">WiFi Only</SelectItem>
                          <SelectItem value="mobile">Mobile Data Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SECTION 3: PAYOUT & FINANCE */}
            <TabsContent value="payout" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Payout & Finance</CardTitle>
                  <CardDescription>Configure payout and financial settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="payout">Payout Amount *</Label>
                      <Input
                        id="payout"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.payout}
                        onChange={(e) => handleInputChange('payout', parseFloat(e.target.value) || 0)}
                        placeholder="5.00"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="currency">Currency</Label>
                      <Select value={formData.currency || 'USD'} onValueChange={(value) => handleInputChange('currency', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="GBP">GBP</SelectItem>
                          <SelectItem value="CAD">CAD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="payout_type">Payout Type</Label>
                      <Select value={formData.payout_type || 'fixed'} onValueChange={(value) => handleInputChange('payout_type', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">Fixed</SelectItem>
                          <SelectItem value="tiered">Tiered</SelectItem>
                          <SelectItem value="percentage">Percentage</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="daily_cap">Daily Cap</Label>
                      <Input
                        id="daily_cap"
                        type="number"
                        min="0"
                        value={formData.daily_cap || ''}
                        onChange={(e) => handleInputChange('daily_cap', e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="100"
                      />
                    </div>
                    <div>
                      <Label htmlFor="weekly_cap">Weekly Cap</Label>
                      <Input
                        id="weekly_cap"
                        type="number"
                        min="0"
                        value={formData.weekly_cap || ''}
                        onChange={(e) => handleInputChange('weekly_cap', e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="500"
                      />
                    </div>
                    <div>
                      <Label htmlFor="monthly_cap">Monthly Cap</Label>
                      <Input
                        id="monthly_cap"
                        type="number"
                        min="0"
                        value={formData.monthly_cap || ''}
                        onChange={(e) => handleInputChange('monthly_cap', e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="2000"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SECTION 4: TRACKING SETUP */}
            <TabsContent value="tracking" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Tracking Setup</CardTitle>
                  <CardDescription>Configure tracking and network settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="network">Network *</Label>
                      <Select value={formData.network} onValueChange={(value) => handleInputChange('network', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select network" />
                        </SelectTrigger>
                        <SelectContent>
                          {NETWORKS.map(network => (
                            <SelectItem key={network} value={network}>{network}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="tracking_protocol">Tracking Protocol</Label>
                      <Select value={formData.tracking_protocol || 'pixel'} onValueChange={(value) => handleInputChange('tracking_protocol', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pixel">Pixel</SelectItem>
                          <SelectItem value="s2s">Server-to-Server</SelectItem>
                          <SelectItem value="api">API</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="target_url">Target URL *</Label>
                    <Input
                      id="target_url"
                      type="url"
                      value={formData.target_url}
                      onChange={(e) => handleInputChange('target_url', e.target.value)}
                      placeholder="https://example.com/offer-landing"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="preview_url">Preview URL</Label>
                    <Input
                      id="preview_url"
                      type="url"
                      value={formData.preview_url || ''}
                      onChange={(e) => handleInputChange('preview_url', e.target.value)}
                      placeholder="https://example.com/offer-preview"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SECTION 5: ACCESS & AFFILIATES */}
            <TabsContent value="access" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Access & Affiliates</CardTitle>
                  <CardDescription>Control who can access this offer</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="affiliates">Affiliate Access *</Label>
                    <Select value={formData.affiliates} onValueChange={(value) => handleInputChange('affiliates', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Affiliates</SelectItem>
                        <SelectItem value="selected">Selected Affiliates</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.affiliates === 'selected' && (
                    <div>
                      <Label>Selected Users</Label>
                      <div className="flex gap-2 mb-2">
                        <Input
                          value={newUser}
                          onChange={(e) => setNewUser(e.target.value)}
                          placeholder="Enter username"
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addUser())}
                        />
                        <Button type="button" onClick={addUser} size="sm">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedUsers.map(user => (
                          <Badge key={user} variant="secondary" className="flex items-center gap-1">
                            {user}
                            <X 
                              className="h-3 w-3 cursor-pointer" 
                              onClick={() => removeUser(user)}
                            />
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* SECTION 6: CREATIVES & VISUALS */}
            <TabsContent value="creatives" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Creatives & Visuals</CardTitle>
                  <CardDescription>Add images and creative assets</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="image_url">Image URL</Label>
                    <Input
                      id="image_url"
                      type="url"
                      value={formData.image_url || ''}
                      onChange={(e) => handleInputChange('image_url', e.target.value)}
                      placeholder="https://example.com/offer-image.jpg"
                    />
                  </div>

                  <div>
                    <Label htmlFor="thumbnail_url">Thumbnail URL</Label>
                    <Input
                      id="thumbnail_url"
                      type="url"
                      value={formData.thumbnail_url || ''}
                      onChange={(e) => handleInputChange('thumbnail_url', e.target.value)}
                      placeholder="https://example.com/offer-thumb.jpg"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SECTION 7: SCHEDULE & EXPIRY */}
            <TabsContent value="schedule" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Schedule & Expiry</CardTitle>
                  <CardDescription>Set offer timing and expiration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Expiration Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !expirationDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {expirationDate ? format(expirationDate, "PPP") : <span>Pick expiration date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={expirationDate}
                          onSelect={setExpirationDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SECTION 8: SMART RULES */}
            <TabsContent value="rules" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Smart Rules</CardTitle>
                  <CardDescription>Advanced routing and automation rules</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="random_redirect"
                      checked={formData.random_redirect || false}
                      onCheckedChange={(checked) => handleInputChange('random_redirect', checked)}
                    />
                    <Label htmlFor="random_redirect">Enable Random Redirect</Label>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SECTION 9: COMPLIANCE */}
            <TabsContent value="compliance" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Compliance</CardTitle>
                  <CardDescription>Traffic restrictions and compliance settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="terms_notes">Terms & Notes</Label>
                    <Textarea
                      id="terms_notes"
                      value={formData.terms_notes || ''}
                      onChange={(e) => handleInputChange('terms_notes', e.target.value)}
                      placeholder="Special terms and conditions..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SECTION 10: INTEGRATIONS */}
            <TabsContent value="integrations" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Integrations</CardTitle>
                  <CardDescription>External system integrations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="external_offer_id">External Offer ID</Label>
                    <Input
                      id="external_offer_id"
                      value={formData.external_offer_id || ''}
                      onChange={(e) => handleInputChange('external_offer_id', e.target.value)}
                      placeholder="EXT-12345"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="webhook_url">Webhook URL</Label>
                    <Input
                      id="webhook_url"
                      type="url"
                      value={formData.webhook_url || ''}
                      onChange={(e) => handleInputChange('webhook_url', e.target.value)}
                      placeholder="https://example.com/webhook"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SECTION 11: REPORTING & MONITORING */}
            <TabsContent value="reporting" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Reporting & Monitoring</CardTitle>
                  <CardDescription>Analytics and monitoring settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="hit_limit">Hit Limit</Label>
                      <Input
                        id="hit_limit"
                        type="number"
                        min="0"
                        value={formData.hit_limit || ''}
                        onChange={(e) => handleInputChange('hit_limit', e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="1000"
                      />
                    </div>
                    <div>
                      <Label htmlFor="conversion_goal">Conversion Goal</Label>
                      <Select value={formData.conversion_goal || 'lead'} onValueChange={(value) => handleInputChange('conversion_goal', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lead">Lead</SelectItem>
                          <SelectItem value="sale">Sale</SelectItem>
                          <SelectItem value="install">Install</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Offer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="affiliates" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Affiliate Assignment</CardTitle>
                  <CardDescription>Control which users can access this offer</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Access Level</Label>
                    <Select value={formData.affiliates} onValueChange={(value) => handleInputChange('affiliates', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        <SelectItem value="premium">Premium Users Only</SelectItem>
                        <SelectItem value="selected">Selected Users Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.affiliates === 'selected' && (
                    <div>
                      <Label>Selected Users</Label>
                      <div className="flex gap-2 mb-2">
                        <Input
                          value={newUser}
                          onChange={(e) => setNewUser(e.target.value)}
                          placeholder="Enter username or user ID"
                          className="flex-1"
                        />
                        <Button type="button" onClick={addUser} size="sm">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedUsers.map(user => (
                          <Badge key={user} variant="secondary" className="flex items-center gap-1">
                            {user}
                            <X 
                              className="h-3 w-3 cursor-pointer" 
                              onClick={() => removeUser(user)}
                            />
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="images" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Images & Creatives</CardTitle>
                  <CardDescription>Upload or link to offer images and thumbnails</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="image_url">Image URL</Label>
                    <Input
                      id="image_url"
                      type="url"
                      value={formData.image_url}
                      onChange={(e) => handleInputChange('image_url', e.target.value)}
                      placeholder="https://example.com/offer-image.jpg"
                    />
                    <p className="text-sm text-gray-500 mt-1">Main offer image (recommended: 400x300px)</p>
                  </div>

                  <div>
                    <Label htmlFor="thumbnail_url">Thumbnail URL</Label>
                    <Input
                      id="thumbnail_url"
                      type="url"
                      value={formData.thumbnail_url}
                      onChange={(e) => handleInputChange('thumbnail_url', e.target.value)}
                      placeholder="https://example.com/offer-thumb.jpg"
                    />
                    <p className="text-sm text-gray-500 mt-1">Thumbnail image (recommended: 150x150px)</p>
                  </div>

                  {/* Image Previews */}
                  {formData.image_url && (
                    <div>
                      <Label>Image Preview</Label>
                      <div className="border rounded-lg p-4 bg-gray-50">
                        <img 
                          src={formData.image_url} 
                          alt="Offer preview" 
                          className="max-w-full h-auto max-h-48 rounded"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {formData.thumbnail_url && (
                    <div>
                      <Label>Thumbnail Preview</Label>
                      <div className="border rounded-lg p-4 bg-gray-50">
                        <img 
                          src={formData.thumbnail_url} 
                          alt="Thumbnail preview" 
                          className="max-w-32 h-auto rounded"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Offer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
