import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Play,
  Pause,
  Trash2,
  Edit,
  AlertCircle,
  Megaphone,
  Eye,
  MousePointerClick,
  Target
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface Campaign {
  _id: string;
  name: string;
  campaign_type: string;
  status: string;
  bid_type: string;
  bid_amount: number;
  daily_limit: number;
  impressions: number;
  clicks: number;
  conversions: number;
  spent: number;
  created_at: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  pending: "bg-yellow-100 text-yellow-800",
  running: "bg-green-100 text-green-800",
  paused: "bg-orange-100 text-orange-800",
  rejected: "bg-red-100 text-red-800",
  completed: "bg-blue-100 text-blue-800",
};

const campaignTypeLabels: Record<string, string> = {
  classic_push: "Classic Push",
  in_page_push: "In-Page Push",
  native: "Native",
  banner: "Banner",
};

export default function AdvertiserCampaigns() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // New campaign form state
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    campaign_type: "classic_push",
    bid_type: "cpc",
    bid_amount: 0.01,
    daily_limit: 10,
    title: "",
    description: "",
    landing_url: "",
  });

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const getAuthToken = () => {
    return localStorage.getItem('advertiser_token');
  };

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      
      if (!token) {
        navigate('/advertiser/signin');
        return;
      }

      const response = await fetch(`${API_BASE}/api/advertiser/campaigns`, {
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

      if (response.status === 403) {
        setError('Your account is not yet approved. Please wait for approval.');
        return;
      }

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch campaigns');
      }

      setCampaigns(data.campaigns || []);
      
    } catch (err) {
      console.error('Error fetching campaigns:', err);
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = async () => {
    try {
      setCreating(true);
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/advertiser/campaigns`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newCampaign)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create campaign');
      }

      toast({
        title: "Campaign Created",
        description: "Your campaign has been created successfully.",
      });

      setShowCreateModal(false);
      setNewCampaign({
        name: "",
        campaign_type: "classic_push",
        bid_type: "cpc",
        bid_amount: 0.01,
        daily_limit: 10,
        title: "",
        description: "",
        landing_url: "",
      });
      fetchCampaigns();

    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to create campaign',
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (campaignId: string, newStatus: string) => {
    try {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/advertiser/campaigns/${campaignId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update status');
      }

      toast({
        title: "Status Updated",
        description: `Campaign status changed to ${newStatus}`,
      });

      fetchCampaigns();

    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to update status',
        variant: "destructive",
      });
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;

    try {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/advertiser/campaigns/${campaignId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete campaign');
      }

      toast({
        title: "Campaign Deleted",
        description: "The campaign has been deleted.",
      });

      fetchCampaigns();

    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to delete campaign',
        variant: "destructive",
      });
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground">Manage your advertising campaigns</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Create Campaign
        </Button>
      </div>

      {/* Campaigns Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Campaigns ({campaigns.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <div className="text-center py-12">
              <Megaphone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No campaigns yet</h3>
              <p className="text-muted-foreground mb-4">Create your first campaign to start advertising</p>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Campaign
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Bid</TableHead>
                  <TableHead className="text-right">Impressions</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Conversions</TableHead>
                  <TableHead className="text-right">Spent</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign._id}>
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell>{campaignTypeLabels[campaign.campaign_type] || campaign.campaign_type}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[campaign.status] || "bg-gray-100"}>
                        {campaign.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      ${campaign.bid_amount} {campaign.bid_type.toUpperCase()}
                    </TableCell>
                    <TableCell className="text-right">{campaign.impressions.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{campaign.clicks.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{campaign.conversions.toLocaleString()}</TableCell>
                    <TableCell className="text-right">${campaign.spent.toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {campaign.status === 'running' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStatusChange(campaign._id, 'paused')}
                            title="Pause"
                          >
                            <Pause className="h-4 w-4 text-yellow-600" />
                          </Button>
                        ) : campaign.status === 'paused' || campaign.status === 'draft' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStatusChange(campaign._id, 'running')}
                            title="Start"
                          >
                            <Play className="h-4 w-4 text-green-600" />
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCampaign(campaign._id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Campaign Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Campaign</DialogTitle>
            <DialogDescription>
              Set up your advertising campaign. Currently only Classic Push is available.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Campaign Name *</Label>
              <Input
                id="name"
                value={newCampaign.name}
                onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                placeholder="My Campaign"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Campaign Type</Label>
                <Select
                  value={newCampaign.campaign_type}
                  onValueChange={(value) => setNewCampaign({ ...newCampaign, campaign_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="classic_push">Classic Push</SelectItem>
                    <SelectItem value="in_page_push" disabled>In-Page Push (Coming Soon)</SelectItem>
                    <SelectItem value="native" disabled>Native (Coming Soon)</SelectItem>
                    <SelectItem value="banner" disabled>Banner (Coming Soon)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Bid Type</Label>
                <Select
                  value={newCampaign.bid_type}
                  onValueChange={(value) => setNewCampaign({ ...newCampaign, bid_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpc">CPC (Cost per Click)</SelectItem>
                    <SelectItem value="cpm">CPM (Cost per 1000 Impressions)</SelectItem>
                    <SelectItem value="cpa">CPA (Cost per Action)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="bid_amount">Bid Amount ($)</Label>
                <Input
                  id="bid_amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={newCampaign.bid_amount}
                  onChange={(e) => setNewCampaign({ ...newCampaign, bid_amount: parseFloat(e.target.value) || 0.01 })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="daily_limit">Daily Limit ($)</Label>
                <Input
                  id="daily_limit"
                  type="number"
                  step="1"
                  min="1"
                  value={newCampaign.daily_limit}
                  onChange={(e) => setNewCampaign({ ...newCampaign, daily_limit: parseFloat(e.target.value) || 10 })}
                />
              </div>
            </div>

            <div className="border-t pt-4 mt-2">
              <h4 className="font-medium mb-3">Push Notification Creative</h4>
              
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Notification Title</Label>
                  <Input
                    id="title"
                    value={newCampaign.title}
                    onChange={(e) => setNewCampaign({ ...newCampaign, title: e.target.value })}
                    placeholder="Your notification title"
                    maxLength={50}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Notification Description</Label>
                  <Textarea
                    id="description"
                    value={newCampaign.description}
                    onChange={(e) => setNewCampaign({ ...newCampaign, description: e.target.value })}
                    placeholder="Your notification description"
                    maxLength={100}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="landing_url">Landing URL *</Label>
                  <Input
                    id="landing_url"
                    value={newCampaign.landing_url}
                    onChange={(e) => setNewCampaign({ ...newCampaign, landing_url: e.target.value })}
                    placeholder="https://example.com/landing"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateCampaign} 
              disabled={creating || !newCampaign.name}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {creating ? "Creating..." : "Create Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
