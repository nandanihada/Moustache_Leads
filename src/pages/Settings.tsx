import { useState, useEffect } from "react";
import { Eye, EyeOff, Copy, RefreshCw, Save } from "lucide-react";
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
          <Tabs defaultValue="profile" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="profile">Profile Details</TabsTrigger>
              <TabsTrigger value="billing">Billing Info</TabsTrigger>
              <TabsTrigger value="email">Email Preferences</TabsTrigger>
              <TabsTrigger value="credentials">Secret Credentials</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-4">
              <div className="grid gap-6">
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

                <Button onClick={saveProfile} className="w-fit">
                  <Save className="h-4 w-4 mr-2" />
                  Save Profile
                </Button>
              </div>
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
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="apiKey">API Key</Label>
                    <div className="flex gap-2 mt-2">
                      <div className="flex-1 relative">
                        <Input
                          id="apiKey"
                          type={showApiKey ? "text" : "password"}
                          value={credentials.apiKey}
                          readOnly
                          className="font-mono"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2"
                          onClick={() => setShowApiKey(!showApiKey)}
                        >
                          {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => copyToClipboard(credentials.apiKey, "API Key")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => regenerateKey("API Key")}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

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
                </div>

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