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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { 
  Link, 
  Copy, 
  Eye, 
  Settings, 
  Shuffle, 
  ExternalLink,
  Plus,
  X,
  Info,
  Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  linkMaskingApi, 
  MaskingDomain, 
  CreateMaskedLinkData, 
  MaskingSettings 
} from '@/services/linkMaskingApi';
import { Offer } from '@/services/adminOfferApi';
import { useToast } from '@/hooks/use-toast';

interface LinkMaskingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: Offer | null;
  onLinkCreated?: () => void;
}

export const LinkMaskingModal: React.FC<LinkMaskingModalProps> = ({
  open,
  onOpenChange,
  offer,
  onLinkCreated
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [domains, setDomains] = useState<MaskingDomain[]>([]);
  const [rotationUrls, setRotationUrls] = useState<string[]>([]);
  const [newRotationUrl, setNewRotationUrl] = useState('');
  const [generatedLink, setGeneratedLink] = useState<string>('');
  const [activeTab, setActiveTab] = useState('basic');

  const [maskingSettings, setMaskingSettings] = useState<MaskingSettings>({
    domain_id: '',
    use_custom_code: false,
    custom_code: '',
    code_length: 8,
    redirect_type: '302',
    subid_append: true,
    preview_mode: false,
    auto_rotation: false,
    rotation_urls: []
  });

  // Load domains when modal opens
  useEffect(() => {
    if (open) {
      loadDomains();
      resetForm();
      setActiveTab('basic');
    }
  }, [open]);

  const loadDomains = async () => {
    try {
      const response = await linkMaskingApi.getDomains(true);
      setDomains(response.domains);
      
      // Set default domain if available
      if (response.domains.length > 0 && !maskingSettings.domain_id) {
        setMaskingSettings(prev => ({
          ...prev,
          domain_id: response.domains[0]._id
        }));
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load masking domains",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setMaskingSettings({
      domain_id: domains.length > 0 ? domains[0]._id : '',
      use_custom_code: false,
      custom_code: '',
      code_length: 8,
      redirect_type: '302',
      subid_append: true,
      preview_mode: false,
      auto_rotation: false,
      rotation_urls: []
    });
    setRotationUrls([]);
    setNewRotationUrl('');
    setGeneratedLink('');
  };

  const handleSettingChange = (key: keyof MaskingSettings, value: any) => {
    setMaskingSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const addRotationUrl = () => {
    if (newRotationUrl && !rotationUrls.includes(newRotationUrl)) {
      const updated = [...rotationUrls, newRotationUrl];
      setRotationUrls(updated);
      handleSettingChange('rotation_urls', updated);
      setNewRotationUrl('');
    }
  };

  const removeRotationUrl = (url: string) => {
    const updated = rotationUrls.filter(u => u !== url);
    setRotationUrls(updated);
    handleSettingChange('rotation_urls', updated);
  };

  const generateMaskedLink = async () => {
    if (!offer) return;

    setLoading(true);
    try {
      const linkData: CreateMaskedLinkData = {
        offer_id: offer.offer_id,
        target_url: offer.target_url,
        masking_settings: {
          ...maskingSettings,
          rotation_urls: rotationUrls
        }
      };

      const response = await linkMaskingApi.createMaskedLink(linkData);
      setGeneratedLink(response.masked_link.masked_url);
      
      toast({
        title: "Success",
        description: "Masked link created successfully!",
      });

      onLinkCreated?.();

    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create masked link",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Link copied to clipboard",
    });
  };

  const testLink = async () => {
    if (!generatedLink) return;

    try {
      const url = new URL(generatedLink);
      const domain = url.hostname;
      const shortCode = url.pathname.substring(1);
      
      const result = await linkMaskingApi.testRedirect(domain, shortCode);
      
      if (result.redirect) {
        toast({
          title: "Test Successful",
          description: `Redirects to: ${result.location}`,
        });
      } else {
        toast({
          title: "Test Result",
          description: JSON.stringify(result),
        });
      }
    } catch (error) {
      toast({
        title: "Test Failed",
        description: error instanceof Error ? error.message : "Failed to test link",
        variant: "destructive",
      });
    }
  };

  if (!offer) return null;

  const selectedDomain = domains.find(d => d._id === maskingSettings.domain_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Create Masked Link: {offer.offer_id}
          </DialogTitle>
          <DialogDescription>
            Generate a masked tracking link for "{offer.name}" with advanced settings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic Settings</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
              <TabsTrigger value="rotation">URL Rotation</TabsTrigger>
              <TabsTrigger value="preview">Preview & Test</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Link Configuration</CardTitle>
                  <CardDescription>Configure the core masking settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="domain">Masking Domain *</Label>
                    <Select 
                      value={maskingSettings.domain_id} 
                      onValueChange={(value) => handleSettingChange('domain_id', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select masking domain" />
                      </SelectTrigger>
                      <SelectContent>
                        {domains.map(domain => (
                          <SelectItem key={domain._id} value={domain._id}>
                            <div className="flex items-center gap-2">
                              <Globe className="h-4 w-4" />
                              <span>{domain.domain}</span>
                              <Badge variant="outline" className="text-xs">
                                {domain.ssl_enabled ? 'SSL' : 'No SSL'}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedDomain && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedDomain.description || selectedDomain.name}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="redirect_type">Redirect Type</Label>
                      <Select 
                        value={maskingSettings.redirect_type} 
                        onValueChange={(value) => handleSettingChange('redirect_type', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="301">301 - Permanent Redirect</SelectItem>
                          <SelectItem value="302">302 - Temporary Redirect</SelectItem>
                          <SelectItem value="307">307 - Temporary Redirect (Strict)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="code_length">Short Code Length</Label>
                      <Select 
                        value={maskingSettings.code_length?.toString()} 
                        onValueChange={(value) => handleSettingChange('code_length', parseInt(value))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="6">6 characters</SelectItem>
                          <SelectItem value="8">8 characters</SelectItem>
                          <SelectItem value="10">10 characters</SelectItem>
                          <SelectItem value="12">12 characters</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="use_custom_code">Use Custom Short Code</Label>
                      <Switch
                        id="use_custom_code"
                        checked={maskingSettings.use_custom_code}
                        onCheckedChange={(checked) => handleSettingChange('use_custom_code', checked)}
                      />
                    </div>
                    
                    {maskingSettings.use_custom_code && (
                      <div>
                        <Input
                          placeholder="Enter custom short code"
                          value={maskingSettings.custom_code}
                          onChange={(e) => handleSettingChange('custom_code', e.target.value)}
                        />
                        <p className="text-sm text-muted-foreground mt-1">
                          Custom code must be unique for the selected domain
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-blue-900">Target URL</span>
                    </div>
                    <p className="text-sm text-blue-700 break-all">
                      {offer.target_url}
                    </p>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button 
                      onClick={() => setActiveTab('preview')} 
                      disabled={!maskingSettings.domain_id}
                    >
                      Continue to Generate Link →
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Advanced Features</CardTitle>
                  <CardDescription>Configure advanced masking and tracking options</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="subid_append">SubID Parameter Passing</Label>
                        <p className="text-sm text-muted-foreground">
                          Automatically append SubID parameters to target URL
                        </p>
                      </div>
                      <Switch
                        id="subid_append"
                        checked={maskingSettings.subid_append}
                        onCheckedChange={(checked) => handleSettingChange('subid_append', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="preview_mode">Preview Mode</Label>
                        <p className="text-sm text-muted-foreground">
                          Show link details instead of redirecting (for testing)
                        </p>
                      </div>
                      <Switch
                        id="preview_mode"
                        checked={maskingSettings.preview_mode}
                        onCheckedChange={(checked) => handleSettingChange('preview_mode', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="auto_rotation">Auto URL Rotation</Label>
                        <p className="text-sm text-muted-foreground">
                          Randomly rotate between multiple target URLs
                        </p>
                      </div>
                      <Switch
                        id="auto_rotation"
                        checked={maskingSettings.auto_rotation}
                        onCheckedChange={(checked) => handleSettingChange('auto_rotation', checked)}
                      />
                    </div>
                  </div>

                  {maskingSettings.subid_append && (
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Info className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-green-900">SubID Parameters</span>
                      </div>
                      <p className="text-sm text-green-700">
                        The following parameters will be automatically passed: subid, s1, clickid
                      </p>
                      <p className="text-sm text-green-700 mt-1">
                        Example: ?subid=abc123 will be appended to the target URL
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="rotation" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shuffle className="h-5 w-5" />
                    URL Rotation Setup
                  </CardTitle>
                  <CardDescription>
                    Configure multiple URLs for automatic rotation (requires Auto Rotation to be enabled)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!maskingSettings.auto_rotation && (
                    <div className="bg-yellow-50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Info className="h-4 w-4 text-yellow-600" />
                        <span className="font-medium text-yellow-900">Auto Rotation Disabled</span>
                      </div>
                      <p className="text-sm text-yellow-700">
                        Enable "Auto URL Rotation" in the Advanced tab to use this feature.
                      </p>
                    </div>
                  )}

                  <div>
                    <Label>Primary URL (from offer)</Label>
                    <Input
                      value={offer.target_url}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>

                  <div>
                    <Label>Additional Rotation URLs</Label>
                    <div className="flex gap-2 mb-2">
                      <Input
                        placeholder="https://example.com/alternate-url"
                        value={newRotationUrl}
                        onChange={(e) => setNewRotationUrl(e.target.value)}
                        className="flex-1"
                        disabled={!maskingSettings.auto_rotation}
                      />
                      <Button 
                        type="button" 
                        onClick={addRotationUrl} 
                        size="sm"
                        disabled={!maskingSettings.auto_rotation}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {rotationUrls.map((url, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                          <span className="flex-1 text-sm break-all">{url}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeRotationUrl(url)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    {rotationUrls.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Total URLs in rotation: {rotationUrls.length + 1} (including primary)
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="preview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Preview & Testing</CardTitle>
                  <CardDescription>Generate and test your masked link</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!generatedLink ? (
                    <div className="text-center py-8">
                      <Link className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-muted-foreground mb-4">
                        Click "Generate Link" to create your masked URL
                      </p>
                      <Button onClick={generateMaskedLink} disabled={loading || !maskingSettings.domain_id}>
                        {loading ? 'Generating...' : 'Generate Masked Link'}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <Label>Generated Masked Link</Label>
                        <div className="flex gap-2">
                          <Input
                            value={generatedLink}
                            readOnly
                            className="flex-1 font-mono"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(generatedLink)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={testLink}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(generatedLink, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Info className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-green-900">Link Created Successfully</span>
                        </div>
                        <div className="text-sm text-green-700 space-y-1">
                          <p><strong>Offer:</strong> {offer.name} ({offer.offer_id})</p>
                          <p><strong>Domain:</strong> {selectedDomain?.domain}</p>
                          <p><strong>Redirect Type:</strong> {maskingSettings.redirect_type}</p>
                          <p><strong>SubID Passing:</strong> {maskingSettings.subid_append ? 'Enabled' : 'Disabled'}</p>
                          {maskingSettings.auto_rotation && (
                            <p><strong>URL Rotation:</strong> {rotationUrls.length + 1} URLs</p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button onClick={() => setGeneratedLink('')} variant="outline">
                          Create Another Link
                        </Button>
                        <Button onClick={() => onOpenChange(false)}>
                          Done
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};
