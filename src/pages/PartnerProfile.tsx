import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  User,
  Building2,
  Globe,
  Link as LinkIcon,
  Save,
  TestTube,
  Copy,
  CheckCircle,
  XCircle,
  BarChart3,
  Settings,
  Key,
  RefreshCw,
} from 'lucide-react';

interface ProfileData {
  first_name: string;
  last_name: string;
  company_name: string;
  website: string;
  email: string;
  postback_url: string;
  postback_method: 'GET' | 'POST';
  username: string;
  role: string;
}

const PartnerProfile: React.FC = () => {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>({
    first_name: '',
    last_name: '',
    company_name: '',
    website: '',
    email: '',
    postback_url: '',
    postback_method: 'GET',
    username: '',
    role: '',
  });

  const [stats, setStats] = useState({
    total_postbacks: 0,
    successful_postbacks: 0,
    failed_postbacks: 0,
    success_rate: 0,
  });

  useEffect(() => {
    loadProfile();
    loadStats();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const { API_BASE_URL } = await import('../services/apiConfig');
      const res = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();
      if (data.user) {
        setProfileData({
          first_name: data.user.first_name || '',
          last_name: data.user.last_name || '',
          company_name: data.user.company_name || '',
          website: data.user.website || '',
          email: data.user.email || '',
          postback_url: data.user.postback_url || '',
          postback_method: data.user.postback_method || 'GET',
          username: data.user.username || '',
          role: data.user.role || '',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load profile',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const { API_BASE_URL } = await import('../services/apiConfig');
      const res = await fetch(`${API_BASE_URL}/api/partner/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();
      if (res.ok) {
        setStats({
          total_postbacks: data.total_postbacks || 0,
          successful_postbacks: data.successful_postbacks || 0,
          failed_postbacks: data.failed_postbacks || 0,
          success_rate: data.success_rate || 0,
        });
      }
    } catch (error) {
      // Silently fail - stats are not critical
      console.error('Failed to load stats:', error);
    }
  };

  const handleChange = (field: keyof ProfileData, value: string) => {
    setProfileData({
      ...profileData,
      [field]: value,
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { API_BASE_URL } = await import('../services/apiConfig');
      const res = await fetch(`${API_BASE_URL}/api/auth/profile/update`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: profileData.first_name,
          last_name: profileData.last_name,
          company_name: profileData.company_name,
          website: profileData.website,
          postback_url: profileData.postback_url,
          postback_method: profileData.postback_method,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast({
          title: 'Success',
          description: 'Profile updated successfully',
        });
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to update profile',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Network error. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestPostback = async () => {
    if (!profileData.postback_url) {
      toast({
        title: 'Error',
        description: 'Please enter a postback URL first',
        variant: 'destructive',
      });
      return;
    }

    try {
      setTesting(true);
      const { API_BASE_URL } = await import('../services/apiConfig');
      const res = await fetch(`${API_BASE_URL}/api/partner/test-postback`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postback_url: profileData.postback_url,
          method: profileData.postback_method,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Test Successful',
          description: `Status: ${data.status_code} - ${data.response_body?.substring(0, 100)}`,
        });
      } else {
        toast({
          title: 'Test Failed',
          description: data.error || 'Postback test failed',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to test postback',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Copied to clipboard',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Partner Profile</h1>
        <p className="text-gray-600">Manage your account settings and postback configuration</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="postback" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Postback Settings
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Statistics
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Personal Information
              </CardTitle>
              <CardDescription>Update your personal and company details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={profileData.first_name}
                    onChange={(e) => handleChange('first_name', e.target.value)}
                    placeholder="John"
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={profileData.last_name}
                    onChange={(e) => handleChange('last_name', e.target.value)}
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={profileData.email}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
              </div>

              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={profileData.username}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-xs text-gray-500 mt-1">Username cannot be changed</p>
              </div>

              <div>
                <Label htmlFor="company_name" className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Company Name
                </Label>
                <Input
                  id="company_name"
                  value={profileData.company_name}
                  onChange={(e) => handleChange('company_name', e.target.value)}
                  placeholder="Your Company Ltd."
                />
              </div>

              <div>
                <Label htmlFor="website" className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Website
                </Label>
                <Input
                  id="website"
                  type="url"
                  value={profileData.website}
                  onChange={(e) => handleChange('website', e.target.value)}
                  placeholder="https://yourwebsite.com"
                />
              </div>

              <div className="flex items-center gap-2 pt-4">
                <Badge variant={profileData.role === 'partner' ? 'default' : 'secondary'}>
                  {profileData.role?.toUpperCase()}
                </Badge>
                <Badge variant="outline">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Postback Settings Tab */}
        <TabsContent value="postback" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="w-5 h-5" />
                Postback Configuration
              </CardTitle>
              <CardDescription>
                Configure your postback URL to receive conversion notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="postback_url">Postback URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="postback_url"
                    type="url"
                    value={profileData.postback_url}
                    onChange={(e) => handleChange('postback_url', e.target.value)}
                    placeholder="https://yoursite.com/postback?click_id={click_id}&status={status}"
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(profileData.postback_url)}
                    disabled={!profileData.postback_url}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Use macros: {'{click_id}'}, {'{status}'}, {'{payout}'}, {'{offer_id}'}
                </p>
              </div>

              <div>
                <Label htmlFor="postback_method">HTTP Method</Label>
                <Select
                  value={profileData.postback_method}
                  onValueChange={(value) => handleChange('postback_method', value as 'GET' | 'POST')}
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

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Available Macros
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm text-blue-800">
                  <div><code className="bg-blue-100 px-2 py-1 rounded">{'{click_id}'}</code> - Click ID</div>
                  <div><code className="bg-blue-100 px-2 py-1 rounded">{'{status}'}</code> - Status</div>
                  <div><code className="bg-blue-100 px-2 py-1 rounded">{'{payout}'}</code> - Payout Amount</div>
                  <div><code className="bg-blue-100 px-2 py-1 rounded">{'{offer_id}'}</code> - Offer ID</div>
                  <div><code className="bg-blue-100 px-2 py-1 rounded">{'{conversion_id}'}</code> - Conversion ID</div>
                  <div><code className="bg-blue-100 px-2 py-1 rounded">{'{transaction_id}'}</code> - Transaction ID</div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleTestPostback}
                  disabled={testing || !profileData.postback_url}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  {testing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <TestTube className="w-4 h-4" />
                  )}
                  Test Postback
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Statistics Tab */}
        <TabsContent value="stats" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Postbacks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.total_postbacks}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Successful</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600 flex items-center gap-2">
                  <CheckCircle className="w-6 h-6" />
                  {stats.successful_postbacks}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Failed</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600 flex items-center gap-2">
                  <XCircle className="w-6 h-6" />
                  {stats.failed_postbacks}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Success Rate</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {stats.success_rate}%
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Postback Activity</CardTitle>
              <CardDescription>Your latest postback notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No postback activity yet</p>
                <p className="text-sm">Activity will appear here once you start receiving postbacks</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button - Fixed at bottom */}
      <div className="fixed bottom-8 right-8 z-50">
        <Button
          onClick={handleSave}
          disabled={saving}
          size="lg"
          className="shadow-lg flex items-center gap-2"
        >
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default PartnerProfile;
