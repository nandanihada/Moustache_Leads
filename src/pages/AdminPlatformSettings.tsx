import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getApiBaseUrl } from "@/services/apiConfig";
import { useToast } from "@/components/ui/use-toast";
import { Globe, Link as LinkIcon, Save, Settings } from 'lucide-react';
import { getAuthToken } from '@/utils/cookies';

export default function AdminPlatformSettings() {
  const [reviewUrl, setReviewUrl] = useState('');
  const [rewardFixed, setRewardFixed] = useState('5.0');
  const [rewardPercentage, setRewardPercentage] = useState('10.0');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const API_BASE_URL = getApiBaseUrl();

  useEffect(() => {
    fetchReviewSettings();
  }, []);

  const fetchReviewSettings = async () => {
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/platform-settings/review-us`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.url) {
        setReviewUrl(data.url);
      }
      if (data.reward_fixed !== undefined) {
        setRewardFixed(String(data.reward_fixed));
      }
      if (data.reward_percentage !== undefined) {
        setRewardPercentage(String(data.reward_percentage));
      }
    } catch (err) {
      console.error("Failed to fetch review settings:", err);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/platform-settings/review-us`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          url: reviewUrl,
          reward_fixed: parseFloat(rewardFixed),
          reward_percentage: parseFloat(rewardPercentage)
        })
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: "Settings Saved",
          description: "Review Us URL has been updated successfully.",
          variant: "default",
        });
      } else {
        throw new Error(data.error || 'Failed to update settings');
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Platform Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage platform-wide settings and configurations.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-orange-100 shadow-sm">
          <CardHeader className="bg-orange-50/50 border-b border-orange-100/50">
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="h-5 w-5 text-orange-600" />
              User Dashboard Integrations
            </CardTitle>
            <CardDescription>
              External links and integrations displayed to users.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-muted-foreground" />
                "Review Us" URL
              </label>
              <div className="flex gap-2">
                <Input 
                  value={reviewUrl}
                  onChange={(e) => setReviewUrl(e.target.value)}
                  placeholder="https://trustpilot.com/review/..."
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                This link will be opened when users click the "Review Us" button in their dashboard.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                Fixed Reward ($)
              </label>
              <Input 
                type="number"
                step="0.01"
                value={rewardFixed}
                onChange={(e) => setRewardFixed(e.target.value)}
                placeholder="5.00"
              />
              <p className="text-xs text-muted-foreground">
                Fixed dollar amount added to their balance upon review approval.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                Percentage Bonus Reward (%)
              </label>
              <Input 
                type="number"
                step="0.1"
                value={rewardPercentage}
                onChange={(e) => setRewardPercentage(e.target.value)}
                placeholder="10.0"
              />
              <p className="text-xs text-muted-foreground">
                Percentage of their current balance added as an extra bonus upon review approval.
              </p>
            </div>

            <Button 
              onClick={handleSave} 
              disabled={loading}
              className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700"
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : 'Save Settings'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
