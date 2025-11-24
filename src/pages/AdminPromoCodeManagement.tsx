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
import { toast } from "sonner";
import { Plus, Edit2, Pause, Play, BarChart3, Users, Trash2, Copy, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

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
}

export default function AdminPromoCodeManagement() {
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
  });

  // Fetch promo codes
  useEffect(() => {
    fetchPromoCodes();
  }, []);

  const fetchPromoCodes = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:5000/api/admin/promo-codes", {
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
      };

      const response = await fetch("http://localhost:5000/api/admin/promo-codes", {
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
      const response = await fetch(
        `http://localhost:5000/api/admin/promo-codes/${codeId}/pause`,
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
      const response = await fetch(
        `http://localhost:5000/api/admin/promo-codes/${codeId}/resume`,
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
      const response = await fetch(
        `http://localhost:5000/api/admin/promo-codes/${codeId}/analytics`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
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
      const response = await fetch(
        `http://localhost:5000/api/admin/promo-codes/${codeId}/users`,
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
                        {code.bonus_type === "percentage"
                          ? `${code.bonus_amount}%`
                          : `$${code.bonus_amount}`}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Promo Code Analytics</DialogTitle>
          </DialogHeader>
          {analytics && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-gray-600 text-sm">Total Uses</p>
                      <p className="text-2xl font-bold">{analytics.total_uses}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-gray-600 text-sm">Users Applied</p>
                      <p className="text-2xl font-bold">{analytics.users_applied}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-gray-600 text-sm">Total Bonus</p>
                      <p className="text-2xl font-bold">
                        ${analytics.total_bonus_distributed.toFixed(2)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
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
    </div>
  );
}
