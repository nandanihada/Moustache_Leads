import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { RefreshCw, DollarSign, Users, TrendingUp, AlertCircle, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AdminPageGuard } from '@/components/AdminPageGuard';

interface BonusEarning {
  _id: string;
  user_id: string;
  code: string;
  bonus_amount: number;
  status: "pending" | "credited" | "reversed";
  created_at: string;
  credited_at?: string;
}

interface BonusStats {
  total_bonus: number;
  pending_bonus: number;
  credited_bonus: number;
  reversed_bonus: number;
  total_earnings: number;
  unique_users_count: number;
  unique_codes_count: number;
}

function AdminBonusManagement() {
  const { token } = useAuth();
  const [stats, setStats] = useState<BonusStats | null>(null);
  const [earnings, setEarnings] = useState<BonusEarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterUser, setFilterUser] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [showProcessDialog, setShowProcessDialog] = useState(false);
  const [processLimit, setProcessLimit] = useState("100");

  // Fetch data on mount
  useEffect(() => {
    fetchAllData();
  }, []);

  // Fetch data when filters change
  useEffect(() => {
    fetchEarnings();
  }, [filterStatus, page]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchStats(), fetchEarnings()]);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { API_BASE_URL } = await import('../services/apiConfig');
      const response = await fetch(
        `${API_BASE_URL}/api/admin/bonus/statistics`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchEarnings = async () => {
    try {
      const { API_BASE_URL } = await import('../services/apiConfig');
      let url = `${API_BASE_URL}/api/admin/bonus/earnings?page=${page}&limit=50`;
      if (filterStatus !== "all") {
        url += `&status=${filterStatus}`;
      }
      if (filterUser) {
        url += `&user_id=${filterUser}`;
      }

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setEarnings(data.bonus_earnings || []);
        setTotalPages(data.pages || 1);
      }
    } catch (error) {
      console.error("Error fetching earnings:", error);
    }
  };

  const handleProcessPendingBonuses = async () => {
    try {
      setProcessing(true);
      const { API_BASE_URL } = await import('../services/apiConfig');
      const response = await fetch(
        `${API_BASE_URL}/api/admin/bonus/process-pending?limit=${processLimit}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        toast.success(
          `Processed ${data.processed} bonuses, Total: $${data.total_bonus.toFixed(2)}`
        );
        setShowProcessDialog(false);
        fetchAllData();
      } else {
        toast.error("Failed to process bonuses");
      }
    } catch (error) {
      toast.error("Error processing bonuses");
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const handleCreditBonus = async (conversionId: string) => {
    try {
      const { API_BASE_URL } = await import('../services/apiConfig');
      const response = await fetch(
        `${API_BASE_URL}/api/admin/bonus/credit/${conversionId}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        toast.success("Bonus credited successfully");
        fetchAllData();
      } else {
        toast.error("Failed to credit bonus");
      }
    } catch (error) {
      toast.error("Error crediting bonus");
      console.error(error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-500">Pending</Badge>;
      case "credited":
        return <Badge className="bg-green-500">Credited</Badge>;
      case "reversed":
        return <Badge className="bg-red-500">Reversed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Bonus Management</h1>
          <p className="text-gray-600 mt-1">Track and manage bonus earnings</p>
        </div>
        <Dialog open={showProcessDialog} onOpenChange={setShowProcessDialog}>
          <Button
            onClick={() => setShowProcessDialog(true)}
            className="gap-2"
            variant="default"
          >
            <RefreshCw className="w-4 h-4" />
            Process Pending Bonuses
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Process Pending Bonuses</DialogTitle>
              <DialogDescription>
                Process pending bonus calculations for conversions
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Limit (max conversions to process)</Label>
                <Input
                  type="number"
                  value={processLimit}
                  onChange={(e) => setProcessLimit(e.target.value)}
                  min="1"
                  max="1000"
                />
              </div>

              <Button
                onClick={handleProcessPendingBonuses}
                disabled={processing}
                className="w-full"
              >
                {processing ? "Processing..." : "Process Bonuses"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Bonus</p>
                  <p className="text-2xl font-bold">
                    ${stats.total_bonus.toFixed(2)}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pending</p>
                  <p className="text-2xl font-bold">
                    ${stats.pending_bonus.toFixed(2)}
                  </p>
                </div>
                <AlertCircle className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Credited</p>
                  <p className="text-2xl font-bold">
                    ${stats.credited_bonus.toFixed(2)}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Unique Users</p>
                  <p className="text-2xl font-bold">{stats.unique_users_count}</p>
                </div>
                <Users className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Additional Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600">Total Earnings</p>
                <p className="text-3xl font-bold">{stats.total_earnings}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600">Unique Codes</p>
                <p className="text-3xl font-bold">{stats.unique_codes_count}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600">Reversal Rate</p>
                <p className="text-3xl font-bold">
                  {stats.total_bonus > 0
                    ? ((stats.reversed_bonus / stats.total_bonus) * 100).toFixed(1)
                    : "0"}
                  %
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bonus Earnings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Bonus Earnings</CardTitle>
          <CardDescription>
            View and manage all bonus earnings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex gap-4">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="credited">Credited</SelectItem>
                  <SelectItem value="reversed">Reversed</SelectItem>
                </SelectContent>
              </Select>

              <Input
                placeholder="Filter by user ID..."
                value={filterUser}
                onChange={(e) => {
                  setFilterUser(e.target.value);
                  setPage(1);
                }}
                className="max-w-sm"
              />
            </div>

            {/* Table */}
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : earnings.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No bonus earnings found
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>User ID</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Earned</TableHead>
                        <TableHead>Credited</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {earnings.map((earning) => (
                        <TableRow key={earning._id}>
                          <TableCell className="font-mono font-bold">
                            {earning.code}
                          </TableCell>
                          <TableCell className="text-xs">
                            {earning.user_id.substring(0, 8)}...
                          </TableCell>
                          <TableCell>${earning.bonus_amount.toFixed(2)}</TableCell>
                          <TableCell>{getStatusBadge(earning.status)}</TableCell>
                          <TableCell>
                            {new Date(earning.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {earning.credited_at
                              ? new Date(earning.credited_at).toLocaleDateString()
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {earning.status === "pending" && (
                              <Button
                                size="sm"
                                onClick={() => handleCreditBonus(earning._id)}
                              >
                                Credit
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="flex justify-between items-center mt-4">
                  <p className="text-sm text-gray-600">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      disabled={page === totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const AdminBonusManagementWithGuard = () => (
  <AdminPageGuard requiredTab="bonus-management">
    <AdminBonusManagement />
  </AdminPageGuard>
);

export default AdminBonusManagementWithGuard;

