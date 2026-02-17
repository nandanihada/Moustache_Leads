import { useState, useEffect } from "react";
import { Search, UserCheck, UserX, Mail, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/services/apiConfig";

interface User {
  _id: string;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  website?: string;
  role: string;
  account_status: string;
  email_verified: boolean;
  created_at: string;
  account_status_updated_at?: string;
}

interface UserCounts {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

const Users = () => {
  const [activeTab, setActiveTab] = useState("pending_approval");
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [counts, setCounts] = useState<UserCounts>({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const { toast } = useToast();

  const fetchUsers = async (status?: string) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const url = status && status !== 'all' 
        ? `${API_BASE_URL}/api/auth/admin/users?status=${status}`
        : `${API_BASE_URL}/api/auth/admin/users`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data.users || []);
      setCounts(data.counts || { pending: 0, approved: 0, rejected: 0, total: 0 });
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const status = activeTab === 'all' ? undefined : activeTab;
    fetchUsers(status);
  }, [activeTab]);

  const handleApprove = async (userId: string) => {
    try {
      setActionLoading(userId);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE_URL}/api/auth/admin/users/${userId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to approve user');
      }

      // Show appropriate message based on email status
      if (data.email_sent) {
        toast({
          title: "User Approved",
          description: "User has been approved and activation email sent.",
        });
      } else {
        toast({
          title: "User Approved",
          description: `User approved but email failed: ${data.email_error || 'Unknown error'}`,
          variant: "destructive"
        });
      }

      // Refresh users list
      fetchUsers(activeTab === 'all' ? undefined : activeTab);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve user",
        variant: "destructive"
      });
    } finally {
      setActionLoading(null);
    }
  };

  const openRejectDialog = (user: User) => {
    setSelectedUser(user);
    setRejectReason("");
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!selectedUser) return;

    try {
      setActionLoading(selectedUser._id);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE_URL}/api/auth/admin/users/${selectedUser._id}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: rejectReason })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reject user');
      }

      toast({
        title: "User Rejected",
        description: "User application has been rejected.",
      });

      setRejectDialogOpen(false);
      setSelectedUser(null);
      
      // Refresh users list
      fetchUsers(activeTab === 'all' ? undefined : activeTab);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reject user",
        variant: "destructive"
      });
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = users.filter(user => {
    const name = `${user.first_name || ''} ${user.last_name || ''} ${user.username}`.toLowerCase();
    return name.includes(searchTerm.toLowerCase()) ||
           user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
           user._id.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      case "pending_approval":
      default:
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Users</h1>
        <p className="text-muted-foreground">Manage affiliate users and approve new applications</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Approval</p>
                <p className="text-2xl font-bold text-amber-600">{counts.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-green-600">{counts.approved}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <p className="text-2xl font-bold text-red-600">{counts.rejected}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{counts.total}</p>
              </div>
              <UserCheck className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="pending_approval">
                Pending ({counts.pending})
              </TabsTrigger>
              <TabsTrigger value="approved">Approved ({counts.approved})</TabsTrigger>
              <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
              <TabsTrigger value="all">All Users</TabsTrigger>
            </TabsList>

            <div className="flex gap-4 items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users by name, email, or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <TabsContent value={activeTab} className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No users found
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">User</TableHead>
                      <TableHead className="whitespace-nowrap">Contact</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="whitespace-nowrap">Email Verified</TableHead>
                      <TableHead className="whitespace-nowrap">Join Date</TableHead>
                      <TableHead className="whitespace-nowrap">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user._id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback>
                                {(user.first_name?.[0] || user.username[0]).toUpperCase()}
                                {(user.last_name?.[0] || user.username[1] || '').toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">
                                {user.first_name && user.last_name 
                                  ? `${user.first_name} ${user.last_name}`
                                  : user.username}
                              </p>
                              <p className="text-sm text-muted-foreground">@{user.username}</p>
                              {user.company_name && (
                                <p className="text-xs text-muted-foreground">{user.company_name}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <span>{user.email}</span>
                            </div>
                            {user.website && (
                              <div className="text-xs text-muted-foreground">
                                {user.website}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(user.account_status)}
                        </TableCell>
                        <TableCell>
                          {user.email_verified ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                              <CheckCircle className="w-3 h-3 mr-1" />Verified
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <Clock className="w-3 h-3 mr-1" />Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(user.created_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {user.account_status === "pending_approval" && (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => handleApprove(user._id)}
                                  disabled={actionLoading === user._id}
                                >
                                  {actionLoading === user._id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <UserCheck className="h-4 w-4" />
                                  )}
                                  <span className="ml-1">Approve</span>
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => openRejectDialog(user)}
                                  disabled={actionLoading === user._id}
                                >
                                  <UserX className="h-4 w-4" />
                                  <span className="ml-1">Reject</span>
                                </Button>
                              </>
                            )}
                            {user.account_status === "approved" && (
                              <Badge variant="outline" className="text-green-600">Active</Badge>
                            )}
                            {user.account_status === "rejected" && (
                              <Badge variant="outline" className="text-red-600">Rejected</Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject User Application</DialogTitle>
            <DialogDescription>
              Are you sure you want to reject {selectedUser?.username}'s application?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Reason for rejection (optional)</label>
              <Textarea
                placeholder="Enter reason for rejection..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={actionLoading === selectedUser?._id}
            >
              {actionLoading === selectedUser?._id ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Reject User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Users;
