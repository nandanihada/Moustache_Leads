import { useState, useEffect } from "react";
import { Eye, EyeOff, Copy, RefreshCw, Save, Pencil, User, Key, Globe, Mail, Building, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import PublisherEmailSettings from "@/components/PublisherEmailSettings";
import { BillingInfoTab } from "@/components/BillingInfoTab";
import { API_BASE_URL } from "@/services/apiConfig";

const Settings = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const { toast } = useToast();
  const { user, token } = useAuth();

  // Read tab from URL query param
  const searchParams = new URLSearchParams(window.location.search);
  const initialTab = searchParams.get('tab') || 'profile';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const [profile, setProfile] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    website: ""
  });

  const [billing, setBilling] = useState({
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
    taxId: "",
    paymentMethod: "",
    paymentEmail: ""
  });

  const [credentials, setCredentials] = useState({
    apiKey: "",
    secretKey: "your_secret_key_here"
  });

  useEffect(() => {
    if (!token) {
      return;
    }

    const loadProfile = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to load profile');
        }

        const data = await response.json();
        const userProfile = data.user || {};

        setProfile({
          firstName: userProfile.first_name || user?.username || '',
          lastName: userProfile.last_name || '',
          email: userProfile.email || '',
          phone: '',
          company: userProfile.company_name || '',
          website: userProfile.website || ''
        });
        setCredentials(prev => ({ ...prev, apiKey: userProfile.api_key || '' }));
        setProfileLoaded(true);
      } catch (error) {
        console.error('Error loading profile:', error);
      }
    };

    loadProfile();
  }, [token, user]);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${type} copied to clipboard`,
    });
  };

  const regenerateKey = async () => {
    if (!token) {
      toast({ title: "Authentication required", description: "Please sign in to regenerate your API key.", variant: "destructive" });
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/generate-api-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to regenerate API key');
      }

      setCredentials(prev => ({ ...prev, apiKey: data.api_key || prev.apiKey }));
      toast({
        title: "API Key Regenerated",
        description: "Your API key was regenerated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error regenerating API key",
        description: error?.message || 'An unexpected error occurred',
        variant: "destructive"
      });
    }
  };

  const saveProfile = () => {
    toast({
      title: "Profile Updated",
      description: "Your profile information has been saved",
    });
  };

  const saveBilling = () => {
    toast({
      title: "Billing Updated",
      description: "Your billing information has been saved",
    });
  };

  const updatePassword = () => {
    toast({
      title: "Password Updated",
      description: "Your password has been changed successfully",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your account preferences and security</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="profile">Profile Details</TabsTrigger>
              <TabsTrigger value="billing">Billing Info</TabsTrigger>
              <TabsTrigger value="email">Email Preferences</TabsTrigger>
              <TabsTrigger value="credentials">Secret Credentials</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-4">
              {profileLoaded && !isEditingProfile ? (
                /* READ-ONLY VIEW */
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Profile Details</h3>
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingProfile(true)} className="text-blue-600 hover:text-blue-800 hover:bg-blue-50">
                      <Pencil className="h-4 w-4 mr-1" /> Edit
                    </Button>
                  </div>
                  <div className="border rounded-lg p-5 bg-gray-50/50">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-sm">
                      <div>
                        <span className="text-gray-500 text-xs flex items-center gap-1"><User className="h-3 w-3" /> First Name</span>
                        <p className="font-medium text-gray-900 mt-1">{profile.firstName || '—'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs flex items-center gap-1"><User className="h-3 w-3" /> Last Name</span>
                        <p className="font-medium text-gray-900 mt-1">{profile.lastName || '—'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs flex items-center gap-1"><Mail className="h-3 w-3" /> Email</span>
                        <p className="font-medium text-gray-900 mt-1">{profile.email || '—'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</span>
                        <p className="font-medium text-gray-900 mt-1">{profile.phone || '—'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs flex items-center gap-1"><Building className="h-3 w-3" /> Company</span>
                        <p className="font-medium text-gray-900 mt-1">{profile.company || '—'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs flex items-center gap-1"><Globe className="h-3 w-3" /> Website</span>
                        <p className="font-medium text-gray-900 mt-1">{profile.website || '—'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* EDIT MODE */
                <div className="grid gap-6">
                  {profileLoaded && (
                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setIsEditingProfile(false)} className="text-gray-500 hover:text-gray-700">Cancel</Button>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={profile.firstName}
                        onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={profile.lastName}
                        onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      value={profile.company}
                      onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={profile.website}
                      onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                    />
                  </div>

                  <Button onClick={() => { saveProfile(); setIsEditingProfile(false); }} className="w-fit">
                    <Save className="h-4 w-4 mr-2" />
                    Save Profile
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="billing" className="space-y-4">
              <BillingInfoTab />
            </TabsContent>

            <TabsContent value="email" className="space-y-4">
              {token ? (
                <PublisherEmailSettings token={token} />
              ) : (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700">
                  Please log in to manage email preferences
                </div>
              )}
            </TabsContent>

            <TabsContent value="credentials" className="space-y-6">
              <div className="space-y-6">
                {/* API Key Section - always read-only display */}
                <div className="border rounded-lg p-5 bg-gray-50/50">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                      <Key className="h-4 w-4 text-blue-600" /> API Key
                    </h3>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(credentials.apiKey, "API Key")} className="text-gray-500 hover:text-gray-700">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => regenerateKey()} className="text-gray-500 hover:text-gray-700">
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs font-mono bg-white border rounded px-3 py-2 text-gray-700 truncate">
                      {showApiKey ? credentials.apiKey : '••••••••••••••••••••••••'}
                    </code>
                    <Button variant="ghost" size="sm" onClick={() => setShowApiKey(!showApiKey)} className="text-gray-500">
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* API Usage Example */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-muted-foreground">
                    Use your API key to fetch offers from the public API. Example request:
                  </p>
                  <pre className="mt-3 rounded bg-slate-950 p-3 text-xs text-white overflow-x-auto">
{`curl "${API_BASE_URL}/api/offers?api_key=${credentials.apiKey}&country=US&device_type=mobile"`}
                  </pre>
                  <p className="mt-3 text-sm text-muted-foreground">
                    You can also pass the API key in the <code>X-API-Key</code> header or by using <code>Authorization: ApiKey &lt;key&gt;</code>.
                  </p>
                </div>

                {/* Change Password Section */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium mb-4">Change Password</h3>
                  <div className="space-y-4 max-w-md">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <div className="relative">
                        <Input
                          id="currentPassword"
                          type={showPassword ? "text" : "password"}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input
                        id="newPassword"
                        type={showPassword ? "text" : "password"}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input
                        id="confirmPassword"
                        type={showPassword ? "text" : "password"}
                      />
                    </div>

                    <Button onClick={updatePassword} className="w-fit">
                      Update Password
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;