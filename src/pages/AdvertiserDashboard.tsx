import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { 
  Megaphone, 
  Play, 
  Pause, 
  DollarSign, 
  MousePointerClick,
  Eye,
  Target,
  AlertCircle,
  Clock
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface DashboardStats {
  total_campaigns: number;
  running_campaigns: number;
  paused_campaigns: number;
  draft_campaigns: number;
  pending_campaigns: number;
  total_spent: number;
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
}

interface AdvertiserInfo {
  company_name: string;
  email: string;
  first_name: string;
}

export default function AdvertiserDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountStatus, setAccountStatus] = useState<string>('pending_approval');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [advertiser, setAdvertiser] = useState<AdvertiserInfo | null>(null);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('advertiser_token');
      
      if (!token) {
        navigate('/advertiser/signin');
        return;
      }

      const response = await fetch(`${API_BASE}/api/advertiser/dashboard/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        localStorage.removeItem('advertiser_token');
        navigate('/advertiser/signin');
        return;
      }

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch dashboard stats');
      }

      setAccountStatus(data.account_status);
      setStats(data.stats);
      setAdvertiser(data.advertiser);
      
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  // Show pending approval message
  if (accountStatus !== 'approved') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome{advertiser?.first_name ? `, ${advertiser.first_name}` : ''}!
          </h1>
          <p className="text-muted-foreground">
            {advertiser?.company_name || 'Your advertiser dashboard'}
          </p>
        </div>

        <Alert className="border-yellow-200 bg-yellow-50">
          <Clock className="h-5 w-5 text-yellow-600" />
          <AlertTitle className="text-yellow-800">Account Under Review</AlertTitle>
          <AlertDescription className="text-yellow-700">
            Your account is currently being reviewed by our team. This process typically takes 1-3 business days.
            Once approved, you'll be able to create and manage advertising campaigns.
            <br /><br />
            We'll send you an email notification once your account is activated.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>What happens next?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">1</div>
              <div>
                <p className="font-medium">Account Review</p>
                <p className="text-sm text-muted-foreground">Our team reviews your application and company details</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">2</div>
              <div>
                <p className="font-medium">Approval Notification</p>
                <p className="text-sm text-muted-foreground">You'll receive an email once your account is approved</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">3</div>
              <div>
                <p className="font-medium">Start Advertising</p>
                <p className="text-sm text-muted-foreground">Create campaigns and reach your target audience</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Approved account - show full dashboard
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome back{advertiser?.first_name ? `, ${advertiser.first_name}` : ''}!
          </h1>
          <p className="text-muted-foreground">
            {advertiser?.company_name || 'Your advertiser dashboard'}
          </p>
        </div>
        <Button onClick={() => navigate('/advertiser/campaigns')} className="bg-blue-600 hover:bg-blue-700">
          <Megaphone className="h-4 w-4 mr-2" />
          Create Campaign
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Campaigns
            </CardTitle>
            <Megaphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_campaigns || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Running Campaigns
            </CardTitle>
            <Play className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.running_campaigns || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Paused Campaigns
            </CardTitle>
            <Pause className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats?.paused_campaigns || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Spent
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(stats?.total_spent || 0).toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Impressions
            </CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats?.total_impressions || 0).toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Clicks
            </CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats?.total_clicks || 0).toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Conversions
            </CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats?.total_conversions || 0).toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button variant="outline" onClick={() => navigate('/advertiser/campaigns')}>
            View All Campaigns
          </Button>
          <Button variant="outline" onClick={() => navigate('/advertiser/statistics')}>
            View Statistics
          </Button>
          <Button variant="outline" onClick={() => navigate('/advertiser/billing')}>
            Add Funds
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
