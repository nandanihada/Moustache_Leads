import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Edit2, Pause, Play, BarChart3, Users, Trash2, Copy, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AdminPageGuard } from '@/components/AdminPageGuard';

interface PromoCode {
  _id: string;
  code: string;
  name: string;
  description: string;
  bonus_type: "percentage" | "fixed";
  bonus_amount: number;
  status: "active" | "paused" | "expired";
  start_date: string;
  end_date: string;
  max_uses: number;
  usage_count: number;
  total_bonus_distributed: number;
  created_at: string;
  applicable_offers: string[];
  applicable_categories: string[];
  // Gift card fields
  is_gift_card?: boolean;
  credit_amount?: number;
}

interface CreatePromoCodeForm {
  code: string;
  name: string;
  description: string;
  bonus_type: "percentage" | "fixed";
  bonus_amount: string;
  start_date: string;
  end_date: string;
  max_uses: string;
  max_uses_per_user: string;
  // NEW: Active hours
  active_hours_enabled: boolean;
  active_hours_start: string;
  active_hours_end: string;
  active_hours_timezone: string;
  // NEW: Auto-deactivation
  auto_deactivate_on_max_uses: boolean;
  // NEW: Gift card fields
  is_gift_card: boolean;
  credit_amount: string;
}

function AdminPromoCodeManagement() {
  const { token } = useAuth();
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCode, setSelectedCode] = useState<PromoCode | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAnalyticsDialog, setShowAnalyticsDialog] = useState(false);
  const [showUsersDialog, setShowUsersDialog] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  // NEW: Analytics state
  const [offerAnalytics, setOfferAnalytics] = useState<any>(null);
  const [userApplications, setUserApplications] = useState<any[]>([]);
  const [analyticsTab, setAnalyticsTab] = useState("overview");

  const [formData, setFormData] = useState<CreatePromoCodeForm>({
    code: "",
    name: "",
    description: "",
    bonus_type: "percentage",
    bonus_amount: "",
    start_date: new Date().toISOString().split("T")[0],
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    max_uses: "1000",
    max_uses_per_user: "1",
    // NEW: Active hours defaults
    active_hours_enabled: false,
    active_hours_start: "00:00",
    active_hours_end: "23:59",
    active_hours_timezone: "Asia/Kolkata",
    // NEW: Auto-deactivation default
    auto_deactivate_on_max_uses: true,
    // NEW: Gift card defaults
    is_gift_card: false,
    credit_amount: "",
  });

  // Fetch promo codes
  useEffect(() => {
    fetchPromoCodes();
  }, []);

  const fetchPromoCodes = async () => {
    try {
      setLoading(true);
      const { API_BASE_URL } = await import('../services/apiConfig');
      const response = await fetch(`${API_BASE_URL}/api/admin/promo-codes`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setPromoCodes(data.promo_codes || []);
      } else {
        toast.error("Failed to fetch promo codes");
      }
    } catch (error) {
      toast.error("Error fetching promo codes");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePromoCode = async () => {
    try {
      if (!formData.code || !formData.name || !formData.bonus_amount) {
        toast.error("Please fill in all required fields");
        return;
      }

      const payload = {
        code: formData.code,
        name: formData.name,
        description: formData.description,
        bonus_type: formData.bonus_type,
        bonus_amount: parseFloat(formData.bonus_amount),
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
        max_uses: parseInt(formData.max_uses),
        max_uses_per_user: parseInt(formData.max_uses_per_user),
        // NEW: Active hours
        active_hours: {
          enabled: formData.active_hours_enabled,
          start_time: formData.active_hours_start,
          end_time: formData.active_hours_end,
          timezone: formData.active_hours_timezone,
        },
        // NEW: Auto-deactivation
        auto_deactivate_on_max_uses: formData.auto_deactivate_on_max_uses,
        // NEW: Gift card fields
        is_gift_card: formData.is_gift_card,
        credit_amount: formData.is_gift_card ? parseFloat(formData.credit_amount) : undefined,
      };

      const { API_BASE_URL } = await import('../services/apiConfig');
      const response = await fetch(`${API_BASE_URL}/api/admin/promo-codes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success("Promo code created successfully");
        setShowCreateDialog(false);
        setFormData({
          code: "",
          name: "",
          description: "",
          bonus_type: "percentage",
          bonus_amount: "",
          start_date: new Date().toISOString().split("T")[0],
          end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          max_uses: "1000",
          max_uses_per_user: "1",
          active_hours_enabled: false,
          active_hours_start: "00:00",
          active_hours_end: "23:59",
          active_hours_timezone: "Asia/Kolkata",
          auto_deactivate_on_max_uses: true,
          is_gift_card: false,
          credit_amount: "",
        });
        fetchPromoCodes();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to create promo code");
      }
    } catch (error) {
      toast.error("Error creating promo code");
      console.error(error);
    }
  };

  const handlePauseCode = async (codeId: string) => {
    try {
      const { API_BASE_URL } = await import('../services/apiConfig');
      const response = await fetch(
        `${API_BASE_URL}/api/admin/promo-codes/${codeId}/pause`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        toast.success("Promo code paused");
        fetchPromoCodes();
      } else {
        toast.error("Failed to pause promo code");
      }
    } catch (error) {
      toast.error("Error pausing promo code");
      console.error(error);
    }
  };

  const handleResumeCode = async (codeId: string) => {
    try {
      const { API_BASE_URL } = await import('../services/apiConfig');
      const response = await fetch(
        `${API_BASE_URL}/api/admin/promo-codes/${codeId}/resume`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        toast.success("Promo code resumed");
        fetchPromoCodes();
      } else {
        toast.error("Failed to resume promo code");
      }
    } catch (error) {
      toast.error("Error resuming promo code");
      console.error(error);
    }
  };

  const handleViewAnalytics = async (codeId: string) => {
    try {
      const { API_BASE_URL } = await import('../services/apiConfig');
      const response = await fetch(
        `${API_BASE_URL}/api/admin/promo-codes/${codeId}/analytics`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data.analytics || data);

        // NEW: Fetch offer analytics
        try {
          const offerResponse = await fetch(
            `${API_BASE_URL}/api/admin/promo-codes/${codeId}/offer-analytics`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (offerResponse.ok) {
            const offerData = await offerResponse.json();
            setOfferAnalytics(offerData.analytics);
          }
        } catch (err) {
          console.error("Error fetching offer analytics:", err);
        }

        // NEW: Fetch user applications
        try {
          const appsResponse = await fetch(
            `${API_BASE_URL}/api/admin/promo-codes/${codeId}/user-applications`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (appsResponse.ok) {
            const appsData = await appsResponse.json();
            setUserApplications(appsData.applications);
          }
        } catch (err) {
          console.error("Error fetching user applications:", err);
        }

        setShowAnalyticsDialog(true);
      } else {
        toast.error("Failed to fetch analytics");
      }
    } catch (error) {
      toast.error("Error fetching analytics");
      console.error(error);
    }
  };

  const handleViewUsers = async (codeId: string) => {
    try {
      const { API_BASE_URL } = await import('../services/apiConfig');
      const response = await fetch(
        `${API_BASE_URL}/api/admin/promo-codes/${codeId}/users`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        setShowUsersDialog(true);
      } else {
        toast.error("Failed to fetch users");
      }
    } catch (error) {
      toast.error("Error fetching users");
      console.error(error);
    }
  };

  const filteredCodes = promoCodes.filter((code) => {
    const matchesStatus = filterStatus === "all" || code.status === filterStatus;
    const matchesSearch =
      code.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      code.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Active</Badge>;
      case "paused":
        return <Badge className="bg-yellow-500">Paused</Badge>;
      case "expired":
        return <Badge className="bg-red-500">Expired</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Promo Code Management</h1>
          <p className="text-gray-600 mt-1">Create and manage promotional codes</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Create Promo Code
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Promo Code</DialogTitle>
              <DialogDescription>
                Create a new promotional code with bonus settings
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Code *</Label>
                  <Input
                    placeholder="e.g., SUMMER20"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value.toUpperCase() })
                    }
                  />
                </div>
                <div>
                  <Label>Name *</Label>
                  <Input
                    placeholder="e.g., Summer 20% Bonus"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Description</Label>
                <Input
                  placeholder="Optional description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>

              {/* NEW: Gift Card Toggle */}
              <div className="border rounded-lg p-4 space-y-3 bg-gradient-to-r from-purple-50 to-pink-50">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-semibold">🎁 Gift Card Mode</Label>
                    <p className="text-sm text-gray-600 mt-1">
                      Direct account credit instead of offer-based bonus
                    </p>
                  </div>
                  <Switch
                    checked={formData.is_gift_card}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_gift_card: checked })
                    }
                  />
                </div>

                {formData.is_gift_card && (
                  <div className="pt-2">
                    <Label>Credit Amount ($) *</Label>
                    <Input
                      type="number"
                      placeholder="10.00"
                      value={formData.credit_amount}
                      onChange={(e) =>
                        setFormData({ ...formData, credit_amount: e.target.value })
                      }
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This amount will be directly credited to the user's account balance
                    </p>
                  </div>
                )}
              </div>

              {!formData.is_gift_card && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Bonus Type *</Label>
                    <Select
                      value={formData.bonus_type}
                      onValueChange={(value: any) =>
                        setFormData({ ...formData, bonus_type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                        <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Bonus Amount *</Label>
                    <Input
                      type="number"
                      placeholder={formData.bonus_type === "percentage" ? "20" : "10"}
                      value={formData.bonus_amount}
                      onChange={(e) =>
                        setFormData({ ...formData, bonus_amount: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Date *</Label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) =>
                      setFormData({ ...formData, start_date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>End Date *</Label>
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Max Uses</Label>
                  <Input
                    type="number"
                    value={formData.max_uses}
                    onChange={(e) =>
                      setFormData({ ...formData, max_uses: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Max Uses Per User</Label>
                  <Input
                    type="number"
                    value={formData.max_uses_per_user}
                    onChange={(e) =>
                      setFormData({ ...formData, max_uses_per_user: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* NEW: Active Hours Section */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Time-Based Validity</Label>
                  <Switch
                    checked={formData.active_hours_enabled}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, active_hours_enabled: checked })
                    }
                  />
                </div>

                {formData.active_hours_enabled && (
                  <div className="space-y-3 pt-2">
                    <p className="text-sm text-gray-600">
                      Restrict this promo code to specific hours of the day
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Start Time</Label>
                        <Input
                          type="time"
                          value={formData.active_hours_start}
                          onChange={(e) =>
                            setFormData({ ...formData, active_hours_start: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label>End Time</Label>
                        <Input
                          type="time"
                          value={formData.active_hours_end}
                          onChange={(e) =>
                            setFormData({ ...formData, active_hours_end: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Timezone</Label>
                      <Select
                        value={formData.active_hours_timezone}
                        onValueChange={(value) =>
                          setFormData({ ...formData, active_hours_timezone: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UTC">UTC</SelectItem>
                          <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                          <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                          <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                          <SelectItem value="Asia/Tokyo">Asia/Tokyo (JST)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {/* NEW: Auto-Deactivation Section */}
              <div className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="auto-deactivate"
                    checked={formData.auto_deactivate_on_max_uses}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, auto_deactivate_on_max_uses: checked as boolean })
                    }
                  />
                  <Label htmlFor="auto-deactivate" className="font-semibold cursor-pointer">
                    Auto-deactivate when max uses reached
                  </Label>
                </div>
                <p className="text-sm text-gray-600 ml-6">
                  Automatically expire this code when it reaches the maximum number of uses
                </p>
              </div>

              <Button onClick={handleCreatePromoCode} className="w-full">
                Create Promo Code
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Input
          placeholder="Search by code or name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Promo Codes Table */}
      <Card>
        <CardHeader>
          <CardTitle>Promo Codes ({filteredCodes.length})</CardTitle>
          <CardDescription>
            Manage all promotional codes and track their performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : filteredCodes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No promo codes found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Bonus</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Distributed</TableHead>
                    <TableHead>Valid Until</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCodes.map((code) => (
                    <TableRow key={code._id}>
                      <TableCell className="font-mono font-bold">{code.code}</TableCell>
                      <TableCell>{code.name}</TableCell>
                      <TableCell>
                        {code.is_gift_card ? (
                          <Badge className="bg-gradient-to-r from-purple-500 to-pink-500">
                            🎁 Gift Card ${code.credit_amount?.toFixed(2)}
                          </Badge>
                        ) : (
                          <span>
                            {code.bonus_type === "percentage"
                              ? `${code.bonus_amount}%`
                              : `$${code.bonus_amount}`}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(code.status)}</TableCell>
                      <TableCell>
                        {code.usage_count} / {code.max_uses}
                      </TableCell>
                      <TableCell>${code.total_bonus_distributed.toFixed(2)}</TableCell>
                      <TableCell>
                        {new Date(code.end_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewAnalytics(code._id)}
                            title="View Analytics"
                          >
                            <BarChart3 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewUsers(code._id)}
                            title="View Users"
                          >
                            <Users className="w-4 h-4" />
                          </Button>
                          {code.status === "active" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePauseCode(code._id)}
                              title="Pause"
                            >
                              <Pause className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResumeCode(code._id)}
                              title="Resume"
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analytics Dialog */}
      <Dialog open={showAnalyticsDialog} onOpenChange={setShowAnalyticsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Promo Code Analytics</DialogTitle>
          </DialogHeader>
          {analytics && (
            <Tabs value={analyticsTab} onValueChange={setAnalyticsTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="offers">Offer Breakdown</TabsTrigger>
                <TabsTrigger value="applications">User Applications</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-gray-600 text-sm">Total Uses</p>
                        <p className="text-2xl font-bold">{analytics.total_uses || 0}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-gray-600 text-sm">Users Applied</p>
                        <p className="text-2xl font-bold">{analytics.users_applied || 0}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-gray-600 text-sm">Total Bonus</p>
                        <p className="text-2xl font-bold">
                          ${(analytics.total_bonus_distributed || 0).toFixed(2)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Offer Breakdown Tab */}
              <TabsContent value="offers" className="space-y-4">
                {offerAnalytics && offerAnalytics.offer_breakdown && offerAnalytics.offer_breakdown.length > 0 ? (
                  <div className="space-y-2">
                    <h3 className="font-semibold">Offers where "{offerAnalytics.code}" was used:</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Offer Name</TableHead>
                          <TableHead>Uses</TableHead>
                          <TableHead>Total Bonus</TableHead>
                          <TableHead>Unique Users</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {offerAnalytics.offer_breakdown.map((offer: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{offer.offer_name}</TableCell>
                            <TableCell>{offer.uses}</TableCell>
                            <TableCell>${(offer.total_bonus || 0).toFixed(2)}</TableCell>
                            <TableCell>{offer.unique_users}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No offer usage data available yet
                  </div>
                )}
              </TabsContent>

              {/* User Applications Tab */}
              <TabsContent value="applications" className="space-y-4">
                {userApplications && userApplications.length > 0 ? (
                  <div className="space-y-2">
                    <h3 className="font-semibold">User Applications:</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Username</TableHead>
                          <TableHead>Offer</TableHead>
                          <TableHead>Bonus Earned</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userApplications.map((app: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{app.username}</TableCell>
                            <TableCell>{app.offer_name || 'Not used yet'}</TableCell>
                            <TableCell>${(app.bonus_earned || 0).toFixed(2)}</TableCell>
                            <TableCell>
                              {app.applied_at ? new Date(app.applied_at).toLocaleDateString() : 'N/A'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No user applications yet
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Users Dialog */}
      <Dialog open={showUsersDialog} onOpenChange={setShowUsersDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Users Applied Code</DialogTitle>
          </DialogHeader>
          {users.length === 0 ? (
            <p className="text-gray-500">No users have applied this code yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Applied At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user._id}>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {new Date(user.applied_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div >
  );
}

const AdminPromoCodeManagementWithGuard = () => (
  <AdminPageGuard requiredTab="promo-codes">
    <AdminPromoCodeManagement />
  </AdminPageGuard>
);

export default AdminPromoCodeManagementWithGuard;

