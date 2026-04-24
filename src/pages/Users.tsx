import React, { useState, useEffect } from "react";
import { Search, UserCheck, UserX, Mail, Clock, CheckCircle, XCircle, Loader2, CheckSquare, Square, MailCheck, MailX, UserPlus, RefreshCw, Eye, EyeOff, ChevronDown, ChevronRight, Globe, Activity, BarChart2, PieChart, MessageSquare, Send, TrendingUp, ShieldAlert, Award, Filter, Users as UsersIcon } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/services/apiConfig";
import UserPreferenceBadges from "@/components/UserPreferenceBadges";

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
  terms_accepted?: boolean;
  terms_accepted_at?: string;
  newsletter_consent?: boolean;
  newsletter_consent_at?: string;
  level?: string;
  // Registration profile fields
  verticals?: string[];
  geos?: string[];
  traffic_sources?: string[];
  website_urls?: string[];
  promotion_description?: string;
  monthly_visits?: string;
  conversion_rate?: string;
  social_contacts?: { linkedin?: string; telegram?: string; agency?: string };
  smart_link_interest?: string;
  smart_link_traffic_source?: string;
  address?: { street?: string; unit?: string; city?: string; country?: string; state?: string; postal?: string };
  payout_details?: { tax_id?: string; vat_id?: string; bank_name?: string; account_name?: string; account_number?: string; routing_number?: string };
  partners?: { network?: string; email?: string }[];
  registration_profile_completed?: boolean;
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
  const [bulkLoading, setBulkLoading] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [bulkRejectDialogOpen, setBulkRejectDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [inlineMailTo, setInlineMailTo] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string>("");
  const [showLevelFilter, setShowLevelFilter] = useState(false);
  const [selectedActivityFilter, setSelectedActivityFilter] = useState<string>("");
  const [showActivityFilter, setShowActivityFilter] = useState(false);
  const [sortOrder, setSortOrder] = useState<string>("desc");
  const [createForm, setCreateForm] = useState({
    username: "",
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    companyName: "",
    level: "L1"
  });
  const [showApiKeyId, setShowApiKeyId] = useState<string | null>(null);
  const [profileStats, setProfileStats] = useState<Record<string, any>>({});
  const [statsLoading, setStatsLoading] = useState<Record<string, boolean>>({});
  const [statsError, setStatsError] = useState<Record<string, string>>({});
  const [selectedActivityLevel, setSelectedActivityLevel] = useState<string | null>(null);
  const [topOffersByLevel, setTopOffersByLevel] = useState<Record<string, any>>({});
  const [topOffersLoading, setTopOffersLoading] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const levelDefinitions = [
    { value: "L1", label: "L1 — Signed up, no engagement", description: "No clicks, no views, no requests" },
    { value: "L2", label: "L2 — Browsed, no action", description: "Viewed offers but no requests or clicks" },
    { value: "L3", label: "L3 — Placed, never activated", description: "Started interaction but no meaningful activity" },
    { value: "L4", label: "L4 — Requested, no approval", description: "Requested offers but none approved" },
    { value: "L5", label: "L5 — Approved, no clicks", description: "Offers approved but user did not generate clicks" },
    { value: "L6", label: "L6 — Suspicious activity", description: "High clicks but no conversions OR flagged fraud patterns" },
    { value: "L7", label: "L7 — Genuine, no conversion", description: "Valid clicks and engagement but no conversions yet" },
  ];

  const getLevelLabel = (level: string) => {
    const def = levelDefinitions.find(l => l.value === level);
    return def ? def.label : level;
  };

  const fetchProfileStats = async (userId: string) => {
    setStatsLoading(prev => ({ ...prev, [userId]: true }));
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/profile-stats?nocache=${new Date().getTime()}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      console.log(`[PROFILE_STATS_DEBUG] Fetched for ${userId}:`, data);
      
      if (res.ok && data.success) {
        setProfileStats(prev => ({ ...prev, [userId]: data.stats || {} }));
        setStatsError(prev => { const n = {...prev}; delete n[userId]; return n; });
        
        // After profile stats, fetch user offers
        await fetchUserOffers(userId);
      } else {
        setStatsError(prev => ({ ...prev, [userId]: data.error || 'Server returned failure' }));
      }
    } catch (err: any) {
      console.error("[PROFILE_STATS_DEBUG] Fetch Error:", err);
      setStatsError(prev => ({ ...prev, [userId]: 'Network Error: ' + err.message }));
    } finally {
      setStatsLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  const fetchUserOffers = async (userId: string) => {
    const token = localStorage.getItem('token');
    try {
      console.log(`[USER_OFFERS_DEBUG] Fetching offers for user ${userId}`);
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/offers`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      console.log(`[USER_OFFERS_DEBUG] Response status: ${res.status}`);
      console.log(`[USER_OFFERS_DEBUG] Full response data:`, JSON.stringify(data, null, 2));
      
      if (res.ok && data.success) {
        console.log(`[USER_OFFERS_DEBUG] Approved count: ${data.approved_offers?.length || 0}`);
        console.log(`[USER_OFFERS_DEBUG] Rejected count: ${data.rejected_offers?.length || 0}`);
        console.log(`[USER_OFFERS_DEBUG] Approved offers:`, data.approved_offers);
        console.log(`[USER_OFFERS_DEBUG] Rejected offers:`, data.rejected_offers);
        
        setProfileStats(prev => {
          const updated = { 
            ...prev, 
            [userId]: { 
              ...(prev[userId] || {}), 
              approved_offers: data.approved_offers || [],
              rejected_offers: data.rejected_offers || [],
              top_viewed_offers: data.top_viewed_offers || [],
              search_keywords: data.search_keywords || [],
              matched_offers: data.matched_offers || []
            } 
          };
          console.log(`[USER_OFFERS_DEBUG] Updated profileStats for ${userId}:`, updated[userId]);
          return updated;
        });
      } else {
        console.error(`[USER_OFFERS_DEBUG] API returned error:`, data.error || data);
      }
    } catch (err: any) {
      console.error("[USER_OFFERS_DEBUG] Fetch Error:", err);
    }
  };

  const fetchTopOffersByLevel = async (userId: string, level: string) => {
    const cacheKey = `${userId}-${level}`;
    setTopOffersLoading(prev => ({ ...prev, [cacheKey]: true }));
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/top-offers?level=${level}&limit=10`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        setTopOffersByLevel(prev => ({ ...prev, [cacheKey]: data.offers || {} }));
      } else {
        setTopOffersByLevel(prev => ({ ...prev, [cacheKey]: {} }));
      }
    } catch (err: any) {
      console.error("[TOP_OFFERS_DEBUG] Fetch Error:", err);
      setTopOffersByLevel(prev => ({ ...prev, [cacheKey]: {} }));
    } finally {
      setTopOffersLoading(prev => ({ ...prev, [cacheKey]: false }));
    }
  };

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

      if (!response.ok) throw new Error('Failed to fetch users');

      const data = await response.json();
      setUsers(data.users || []);
      setCounts(data.counts || { pending: 0, approved: 0, rejected: 0, total: 0 });
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({ title: "Error", description: "Failed to fetch users", variant: "destructive" });
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
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to approve user');

      toast({
        title: "User Approved",
        description: data.email_sent ? "User approved and activation email sent." : `User approved but email failed: ${data.email_error || 'Unknown error'}`,
        variant: data.email_sent ? "default" : "destructive"
      });
      fetchUsers(activeTab === 'all' ? undefined : activeTab);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to approve user", variant: "destructive" });
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
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reject user');
      }
      toast({ title: "User Rejected", description: "User application has been rejected." });
      setRejectDialogOpen(false);
      setSelectedUser(null);
      fetchUsers(activeTab === 'all' ? undefined : activeTab);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to reject user", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  // Bulk operations
  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    try {
      setBulkLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/auth/admin/users/bulk-approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: Array.from(selectedIds) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Bulk approve failed');
      toast({ title: "Bulk Approve", description: data.message });
      setSelectedIds(new Set());
      fetchUsers(activeTab === 'all' ? undefined : activeTab);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedIds.size === 0) return;
    try {
      setBulkLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/auth/admin/users/bulk-reject`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: Array.from(selectedIds), reason: rejectReason })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Bulk reject failed');
      toast({ title: "Bulk Reject", description: data.message });
      setBulkRejectDialogOpen(false);
      setRejectReason("");
      setSelectedIds(new Set());
      fetchUsers(activeTab === 'all' ? undefined : activeTab);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleApproveAll = async () => {
    const pendingUsers = sortedUsers.filter(u => u.account_status === 'pending_approval');
    if (pendingUsers.length === 0) return;
    const ids = pendingUsers.map(u => u._id);
    try {
      setBulkLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/auth/admin/users/bulk-approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: ids })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Approve all failed');
      toast({ title: "Approve All", description: data.message });
      setSelectedIds(new Set());
      fetchUsers(activeTab === 'all' ? undefined : activeTab);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleCreateUser = async () => {
    try {
      setActionLoading("creating");
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/auth/admin/create-user`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create user');

      toast({ title: "Publisher Created", description: `User ${createForm.username} has been created successfully.` });
      setShowCreateDialog(false);
      setCreateForm({ username: "", email: "", password: "", firstName: "", lastName: "", companyName: "", level: "L1" });
      fetchUsers(activeTab === 'all' ? undefined : activeTab);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetApiKey = async (userId: string) => {
    try {
      setActionLoading(`reset-${userId}`);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/admin/publishers/${userId}/reset-api-key`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to reset API key');

      toast({ title: "API Key Reset", description: "A new API key has been generated for this publisher." });
      fetchUsers(activeTab === 'all' ? undefined : activeTab);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const pendingIds = sortedUsers.filter(u => u.account_status === 'pending_approval').map(u => u._id);
    if (pendingIds.every(id => selectedIds.has(id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingIds));
    }
  };

  const filteredUsers = users.filter(user => {
    const name = `${user.first_name || ''} ${user.last_name || ''} ${user.username}`.toLowerCase();
    const matchesSearch = name.includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user._id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLevel = !selectedLevel || (user.level && user.level === selectedLevel);
    return matchesSearch && matchesLevel;
  });

  // Apply activity filter and sorting
  const getActivityValue = (user: User) => {
    const stats = profileStats[user._id];
    if (!stats) return 0;
    
    switch (selectedActivityFilter) {
      case 'clicks':
        return stats.total_clicks || 0;
      case 'requested':
        return stats.offers_requested || 0;
      case 'approved':
        return stats.approved_offers?.length || 0;
      case 'rejected':
        return stats.rejected_offers?.length || 0;
      case 'suspicious':
        return stats.suspicious ? 1 : 0;
      default:
        return 0;
    }
  };

  const sortedUsers = selectedActivityFilter
    ? [...filteredUsers].sort((a, b) => {
        const aValue = getActivityValue(a);
        const bValue = getActivityValue(b);
        return sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
      })
    : filteredUsers;

  // Debug log to check filtering
  console.log('Filter Debug:', { 
    selectedLevel, 
    totalUsers: users.length, 
    filteredCount: users.filter(u => !selectedLevel || u.level === selectedLevel).length,
    usersWithLevel: users.filter(u => u.level).length,
    levelDistribution: users.reduce((acc, u) => {
      const lvl = u.level || 'No Level';
      acc[lvl] = (acc[lvl] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  });

  const pendingInView = sortedUsers.filter(u => u.account_status === 'pending_approval');
  const allPendingSelected = pendingInView.length > 0 && pendingInView.every(u => selectedIds.has(u._id));

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
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Users</h1>
          <p className="text-muted-foreground">Manage affiliate users and approve new applications</p>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-200"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Add New Publisher
        </Button>
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
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedIds(new Set()); }} className="space-y-4">
            <TabsList>
              <TabsTrigger value="pending_approval">Pending ({counts.pending})</TabsTrigger>
              <TabsTrigger value="approved">Approved ({counts.approved})</TabsTrigger>
              <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
              <TabsTrigger value="all">All Users</TabsTrigger>
            </TabsList>

            <div className="flex gap-4 items-center flex-wrap">
              <div className="flex-1 relative min-w-[200px]">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users by name, email, or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLevelFilter(!showLevelFilter)}
                  className={`gap-2 ${selectedLevel ? 'border-blue-500 bg-blue-50 text-blue-700' : ''}`}
                >
                  <Filter className="h-4 w-4" />
                  {selectedLevel ? getLevelLabel(selectedLevel) : 'All Levels'}
                  <ChevronDown className="h-3 w-3" />
                </Button>
                {showLevelFilter && (
                  <div className="absolute top-full mt-2 right-0 bg-white border border-border rounded-lg shadow-lg p-2 z-50 min-w-[400px] max-h-[500px] overflow-y-auto">
                    <button
                      onClick={() => { setSelectedLevel(""); setShowLevelFilter(false); }}
                      className={`w-full text-left px-3 py-2 rounded hover:bg-muted text-sm ${
                        !selectedLevel ? 'bg-blue-50 text-blue-700 font-semibold' : ''
                      }`}
                    >
                      All Levels
                    </button>
                    {levelDefinitions.map((level) => (
                      <button
                        key={level.value}
                        onClick={() => { setSelectedLevel(level.value); setShowLevelFilter(false); }}
                        className={`w-full text-left px-3 py-2.5 rounded hover:bg-muted transition-colors ${
                          selectedLevel === level.value ? 'bg-blue-50 text-blue-700 font-semibold' : ''
                        }`}
                      >
                        <div className="font-semibold text-sm">{level.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{level.description}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowActivityFilter(!showActivityFilter)}
                  className={`gap-2 ${selectedActivityFilter ? 'border-purple-500 bg-purple-50 text-purple-700' : ''}`}
                >
                  <BarChart2 className="h-4 w-4" />
                  {selectedActivityFilter ? selectedActivityFilter.charAt(0).toUpperCase() + selectedActivityFilter.slice(1) : 'Activity Filter'}
                  <ChevronDown className="h-3 w-3" />
                </Button>
                {showActivityFilter && (
                  <div className="absolute top-full mt-2 right-0 bg-white border border-border rounded-lg shadow-lg p-2 z-50 min-w-[280px]">
                    <button
                      onClick={() => { setSelectedActivityFilter(""); setShowActivityFilter(false); }}
                      className={`w-full text-left px-3 py-2 rounded hover:bg-muted text-sm ${
                        !selectedActivityFilter ? 'bg-purple-50 text-purple-700 font-semibold' : ''
                      }`}
                    >
                      No Filter
                    </button>
                    <div className="border-t border-border my-2"></div>
                    <button
                      onClick={() => { setSelectedActivityFilter('clicks'); setShowActivityFilter(false); }}
                      className={`w-full text-left px-3 py-2 rounded hover:bg-muted text-sm ${
                        selectedActivityFilter === 'clicks' ? 'bg-purple-50 text-purple-700 font-semibold' : ''
                      }`}
                    >
                      <div className="font-semibold">Clicks</div>
                      <div className="text-xs text-muted-foreground">Sort by total clicks</div>
                    </button>
                    <button
                      onClick={() => { setSelectedActivityFilter('requested'); setShowActivityFilter(false); }}
                      className={`w-full text-left px-3 py-2 rounded hover:bg-muted text-sm ${
                        selectedActivityFilter === 'requested' ? 'bg-purple-50 text-purple-700 font-semibold' : ''
                      }`}
                    >
                      <div className="font-semibold">Requested</div>
                      <div className="text-xs text-muted-foreground">Sort by offers requested</div>
                    </button>
                    <button
                      onClick={() => { setSelectedActivityFilter('approved'); setShowActivityFilter(false); }}
                      className={`w-full text-left px-3 py-2 rounded hover:bg-muted text-sm ${
                        selectedActivityFilter === 'approved' ? 'bg-purple-50 text-purple-700 font-semibold' : ''
                      }`}
                    >
                      <div className="font-semibold">Approved</div>
                      <div className="text-xs text-muted-foreground">Sort by approved offers</div>
                    </button>
                    <button
                      onClick={() => { setSelectedActivityFilter('rejected'); setShowActivityFilter(false); }}
                      className={`w-full text-left px-3 py-2 rounded hover:bg-muted text-sm ${
                        selectedActivityFilter === 'rejected' ? 'bg-purple-50 text-purple-700 font-semibold' : ''
                      }`}
                    >
                      <div className="font-semibold">Rejected</div>
                      <div className="text-xs text-muted-foreground">Sort by rejected offers</div>
                    </button>
                    <button
                      onClick={() => { setSelectedActivityFilter('suspicious'); setShowActivityFilter(false); }}
                      className={`w-full text-left px-3 py-2 rounded hover:bg-muted text-sm ${
                        selectedActivityFilter === 'suspicious' ? 'bg-purple-50 text-purple-700 font-semibold' : ''
                      }`}
                    >
                      <div className="font-semibold">Suspicious</div>
                      <div className="text-xs text-muted-foreground">Show flagged users first</div>
                    </button>
                    {selectedActivityFilter && (
                      <>
                        <div className="border-t border-border my-2"></div>
                        <div className="px-3 py-2">
                          <div className="text-xs font-semibold text-muted-foreground mb-2">Sort Order</div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setSortOrder('desc')}
                              className={`flex-1 px-2 py-1.5 rounded text-xs font-medium ${
                                sortOrder === 'desc' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              High → Low
                            </button>
                            <button
                              onClick={() => setSortOrder('asc')}
                              className={`flex-1 px-2 py-1.5 rounded text-xs font-medium ${
                                sortOrder === 'asc' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              Low → High
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
              {/* Bulk action buttons */}
              {pendingInView.length > 0 && (
                <div className="flex gap-2 items-center">
                  {selectedIds.size > 0 && (
                    <>
                      <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
                      <Button size="sm" variant="outline" className="text-green-600 hover:bg-green-50" onClick={handleBulkApprove} disabled={bulkLoading}>
                        {bulkLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserCheck className="h-4 w-4 mr-1" />}
                        Approve Selected
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => { setRejectReason(""); setBulkRejectDialogOpen(true); }} disabled={bulkLoading}>
                        <UserX className="h-4 w-4 mr-1" />Reject Selected
                      </Button>
                    </>
                  )}
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={handleApproveAll} disabled={bulkLoading}>
                    {bulkLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                    Approve All ({pendingInView.length})
                  </Button>
                </div>
              )}
            </div>

            <TabsContent value={activeTab} className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : sortedUsers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No users found</div>
              ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {pendingInView.length > 0 && (
                          <TableHead className="w-10">
                            <Checkbox checked={allPendingSelected} onCheckedChange={toggleSelectAll} aria-label="Select all" />
                          </TableHead>
                        )}
                        <TableHead className="whitespace-nowrap">User</TableHead>
                        <TableHead className="whitespace-nowrap">Level</TableHead>
                        <TableHead className="whitespace-nowrap">Contact</TableHead>
                        <TableHead className="whitespace-nowrap">Status</TableHead>
                        <TableHead className="whitespace-nowrap">Email Verified</TableHead>
                        <TableHead className="whitespace-nowrap">Consent</TableHead>
                        <TableHead className="whitespace-nowrap">Join Date</TableHead>
                        <TableHead className="whitespace-nowrap">API Key</TableHead>
                        <TableHead className="whitespace-nowrap">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedUsers.map((user) => (
                        <React.Fragment key={user._id}>
                          <TableRow
                            className={`cursor-pointer transition-colors ${selectedIds.has(user._id) ? "bg-blue-50" : ""} ${expandedRowId === user._id ? "bg-slate-50/80 shadow-sm" : "hover:bg-slate-50"}`}
                            onClick={(e) => {
                              if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('[role="checkbox"]')) return;
                              if (expandedRowId !== user._id) {
                                setInlineMailTo(null);
                                fetchProfileStats(user._id);
                              }
                              setExpandedRowId(expandedRowId === user._id ? null : user._id);
                            }}
                          >
                            {pendingInView.length > 0 && (
                              <TableCell>
                                {user.account_status === 'pending_approval' && (
                                  <Checkbox checked={selectedIds.has(user._id)} onCheckedChange={() => toggleSelect(user._id)} aria-label={`Select ${user.username}`} />
                                )}
                              </TableCell>
                            )}
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={`w-8 h-8 rounded-full p-0 flex items-center justify-center border-2 flex-shrink-0 shadow-sm transition-all ${expandedRowId === user._id ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-200 bg-white text-slate-400 hover:border-slate-400 hover:text-slate-700'}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (expandedRowId !== user._id) {
                                      setInlineMailTo(null);
                                      fetchProfileStats(user._id);
                                    }
                                    setExpandedRowId(expandedRowId === user._id ? null : user._id);
                                  }}
                                >
                                  {expandedRowId === user._id ? <ChevronDown className="w-4 h-4 stroke-[3]" /> : <ChevronRight className="w-4 h-4 stroke-[3]" />}
                                </Button>
                                <Avatar>
                                  <AvatarFallback>
                                    {(user.first_name?.[0] || user.username[0]).toUpperCase()}
                                    {(user.last_name?.[0] || user.username[1] || '').toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">
                                    {user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.username}
                                  </p>
                                  <p className="text-sm text-muted-foreground">@{user.username}</p>
                                  {user.company_name && <p className="text-xs text-muted-foreground">{user.company_name}</p>}
                                  <UserPreferenceBadges user={user} compact />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-semibold">
                                <UsersIcon className="w-3 h-3 mr-1" />
                                {user.level || 'L1'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-sm">
                                  <Mail className="h-4 w-4 text-muted-foreground" />
                                  <span>{user.email}</span>
                                </div>
                                {user.website && <div className="text-xs text-muted-foreground">{user.website}</div>}
                              </div>
                            </TableCell>
                            <TableCell>{getStatusBadge(user.account_status)}</TableCell>
                            <TableCell>
                              {user.email_verified ? (
                                <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle className="w-3 h-3 mr-1" />Verified</Badge>
                              ) : (
                                <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1 text-xs" title={user.terms_accepted_at ? `Accepted: ${formatDate(user.terms_accepted_at)}` : 'Not accepted'}>
                                  {user.terms_accepted ? (
                                    <Badge variant="outline" className="text-green-600 border-green-300 text-xs py-0"><CheckCircle className="w-3 h-3 mr-1" />T&C</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-gray-400 border-gray-300 text-xs py-0"><XCircle className="w-3 h-3 mr-1" />T&C</Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 text-xs" title={user.newsletter_consent_at ? `Consented: ${formatDate(user.newsletter_consent_at)}` : 'No consent'}>
                                  {user.newsletter_consent ? (
                                    <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs py-0"><MailCheck className="w-3 h-3 mr-1" />Newsletter</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-gray-400 border-gray-300 text-xs py-0"><MailX className="w-3 h-3 mr-1" />Newsletter</Badge>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{formatDate(user.created_at)}</TableCell>
                            <TableCell>
                              {(user as any).api_key ? (
                                <div className="flex items-center gap-2">
                                  <code className="text-[10px] bg-slate-100 px-2 py-1 rounded select-all font-mono">
                                    {showApiKeyId === user._id ? (user as any).api_key : "••••••••••••••••"}
                                  </code>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 hover:bg-slate-200 transition-colors"
                                    onClick={() => setShowApiKeyId(showApiKeyId === user._id ? null : user._id)}
                                  >
                                    {showApiKeyId === user._id ? <EyeOff className="h-4 w-4 text-slate-500" /> : <Eye className="h-4 w-4 text-slate-500" />}
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                    onClick={() => handleResetApiKey(user._id)}
                                    disabled={actionLoading === `reset-${user._id}`}
                                    title="Reset/Generate API Key"
                                  >
                                    <RefreshCw className={`h-4 w-4 ${actionLoading === `reset-${user._id}` ? 'animate-spin' : ''}`} />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-[10px] font-bold uppercase border-amber-200 text-amber-700 hover:bg-amber-50"
                                  onClick={() => handleResetApiKey(user._id)}
                                  disabled={actionLoading === `reset-${user._id}`}
                                >
                                  {actionLoading === `reset-${user._id}` ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                                  Generate Key
                                </Button>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                {user.account_status === "pending_approval" && (
                                  <>
                                    <Button size="sm" variant="outline" className="text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleApprove(user._id)} disabled={actionLoading === user._id}>
                                      {actionLoading === user._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                                      <span className="ml-1">Approve</span>
                                    </Button>
                                    <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => openRejectDialog(user)} disabled={actionLoading === user._id}>
                                      <UserX className="h-4 w-4" /><span className="ml-1">Reject</span>
                                    </Button>
                                  </>
                                )}
                                {user.account_status === "approved" && <Badge variant="outline" className="text-green-600 bg-green-50">Active</Badge>}
                                {user.account_status === "rejected" && <Badge variant="outline" className="text-red-600 bg-red-50">Rejected</Badge>}
                              </div>
                            </TableCell>
                          </TableRow>

                          {/* EXPANDED ROW ACCORDION */}
                          {expandedRowId === user._id && (
                            <TableRow className="bg-slate-50 border-b">
                              <TableCell colSpan={pendingInView.length > 0 ? 10 : 9} className="p-0 border-0">
                                <div className="animate-in slide-in-from-top-2 fade-in duration-200 border-x-4 border-indigo-500 rounded-bl-lg rounded-br-lg">
                                  <div className="p-6 md:p-8 space-y-6">

                                    {/* APPROVED & REJECTED OFFERS */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                      {/* Approved Offers */}
                                      <div className="bg-white p-5 rounded-2xl border-2 border-green-200 shadow-md">
                                        <h4 className="text-base font-bold text-green-800 mb-4 flex items-center gap-2">
                                          <CheckCircle className="w-5 h-5" /> Approved Offers ({profileStats[user._id]?.approved_offers?.length || 0})
                                        </h4>
                                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                          {statsLoading[user._id] ? (
                                            <div className="text-center py-4"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>
                                          ) : profileStats[user._id]?.approved_offers?.length > 0 ? (
                                            profileStats[user._id].approved_offers.map((offer: any) => (
                                              <div key={offer.id} className="p-3 bg-green-50 rounded-lg border border-green-100">
                                                <div className="font-semibold text-sm text-green-900">{offer.name}</div>
                                                <div className="text-xs text-green-700 mt-1">{offer.network} • ${offer.payout}</div>
                                              </div>
                                            ))
                                          ) : (
                                            <div className="text-xs text-muted-foreground italic text-center py-4">No approved offers</div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Rejected Offers */}
                                      <div className="bg-white p-5 rounded-2xl border-2 border-red-200 shadow-md">
                                        <h4 className="text-base font-bold text-red-800 mb-4 flex items-center gap-2">
                                          <XCircle className="w-5 h-5" /> Rejected Offers ({profileStats[user._id]?.rejected_offers?.length || 0})
                                        </h4>
                                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                          {statsLoading[user._id] ? (
                                            <div className="text-center py-4"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>
                                          ) : profileStats[user._id]?.rejected_offers?.length > 0 ? (
                                            profileStats[user._id].rejected_offers.map((offer: any) => (
                                              <div key={offer.id} className="p-3 bg-red-50 rounded-lg border border-red-100">
                                                <div className="font-semibold text-sm text-red-900">{offer.name}</div>
                                                <div className="text-xs text-red-700 mt-1">{offer.network} • ${offer.payout}</div>
                                                {offer.reason && <div className="text-xs text-red-600 mt-1">Reason: {offer.reason}</div>}
                                              </div>
                                            ))
                                          ) : (
                                            <div className="text-xs text-muted-foreground italic text-center py-4">No rejected offers</div>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* REGISTRATION PROFILE DATA */}
                                    {(user.verticals?.length > 0 || user.geos?.length > 0 || user.traffic_sources?.length > 0 || user.website_urls?.length > 0 || user.social_contacts || user.address || user.payout_details || user.promotion_description) && (
                                      <div className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-2xl border border-blue-200 shadow-sm">
                                        <h4 className="text-base font-bold text-blue-900 mb-4 flex items-center gap-2">
                                          📋 Registration Profile
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                                          {user.verticals?.length > 0 && (
                                            <div><span className="font-semibold text-blue-800">Verticals:</span> <span className="text-gray-700">{user.verticals.join(', ')}</span></div>
                                          )}
                                          {user.geos?.length > 0 && (
                                            <div><span className="font-semibold text-blue-800">GEOs:</span> <span className="text-gray-700">{user.geos.join(', ')}</span></div>
                                          )}
                                          {user.traffic_sources?.length > 0 && (
                                            <div><span className="font-semibold text-blue-800">Traffic Sources:</span> <span className="text-gray-700">{user.traffic_sources.join(', ')}</span></div>
                                          )}
                                          {user.website_urls?.length > 0 && user.website_urls.some((u: string) => u) && (
                                            <div><span className="font-semibold text-blue-800">Websites:</span> <span className="text-gray-700">{user.website_urls.filter((u: string) => u).join(', ')}</span></div>
                                          )}
                                          {user.monthly_visits && (
                                            <div><span className="font-semibold text-blue-800">Monthly Visits:</span> <span className="text-gray-700">{user.monthly_visits}</span></div>
                                          )}
                                          {user.conversion_rate && (
                                            <div><span className="font-semibold text-blue-800">Conversion Rate:</span> <span className="text-gray-700">{user.conversion_rate}</span></div>
                                          )}
                                          {user.promotion_description && (
                                            <div className="col-span-full"><span className="font-semibold text-blue-800">Promotion:</span> <span className="text-gray-700">{user.promotion_description}</span></div>
                                          )}
                                          {user.social_contacts && (
                                            <div>
                                              <span className="font-semibold text-blue-800">Social:</span>{' '}
                                              <span className="text-gray-700">
                                                {[user.social_contacts.linkedin && `LinkedIn: ${user.social_contacts.linkedin}`, user.social_contacts.telegram && `TG: ${user.social_contacts.telegram}`, user.social_contacts.agency && `Agency: ${user.social_contacts.agency}`].filter(Boolean).join(' • ') || 'N/A'}
                                              </span>
                                            </div>
                                          )}
                                          {user.address && (user.address.city || user.address.country) && (
                                            <div><span className="font-semibold text-blue-800">Location:</span> <span className="text-gray-700">{[user.address.street, user.address.city, user.address.state, user.address.country, user.address.postal].filter(Boolean).join(', ')}</span></div>
                                          )}
                                          {user.payout_details && (user.payout_details.bank_name || user.payout_details.account_name) && (
                                            <div><span className="font-semibold text-blue-800">Payout:</span> <span className="text-gray-700">{[user.payout_details.bank_name, user.payout_details.account_name && `Acc: ${user.payout_details.account_name}`].filter(Boolean).join(' • ') || 'N/A'}</span></div>
                                          )}
                                          {user.smart_link_interest && user.smart_link_interest !== 'none' && (
                                            <div><span className="font-semibold text-blue-800">Smart Link:</span> <span className="text-gray-700">{user.smart_link_interest}{user.smart_link_traffic_source ? ` (${user.smart_link_traffic_source})` : ''}</span></div>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* PUBLISHER SIGNALS */}
                                    <div className="bg-gradient-to-br from-purple-50 to-white p-6 rounded-2xl border border-purple-200 shadow-sm">
                                      <h4 className="text-base font-bold text-purple-900 mb-5 flex items-center gap-2">
                                        <Activity className="w-5 h-5 text-purple-600" /> Publisher Signals
                                      </h4>
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="bg-white p-4 rounded-xl border-2 border-purple-100 hover:border-purple-300 transition-all shadow-sm hover:shadow-md">
                                          <div className="text-xs text-purple-600 font-bold uppercase tracking-wide mb-2">Logins (7d)</div>
                                          <div className="text-2xl font-black text-purple-900">
                                            {statsLoading[user._id] ? <Loader2 className="w-5 h-5 animate-spin" /> : (profileStats[user._id]?.logins_7d || 0)}
                                          </div>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border-2 border-purple-100 hover:border-purple-300 transition-all shadow-sm hover:shadow-md">
                                          <div className="text-xs text-purple-600 font-bold uppercase tracking-wide mb-2">Offers Viewed</div>
                                          <div className="text-2xl font-black text-purple-900">
                                            {statsLoading[user._id] ? <Loader2 className="w-5 h-5 animate-spin" /> : (profileStats[user._id]?.offers_viewed || 0)}
                                          </div>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border-2 border-purple-100 hover:border-purple-300 transition-all shadow-sm hover:shadow-md">
                                          <div className="text-xs text-purple-600 font-bold uppercase tracking-wide mb-2">Offers Requested</div>
                                          <div className="text-2xl font-black text-purple-900">
                                            {statsLoading[user._id] ? <Loader2 className="w-5 h-5 animate-spin" /> : (profileStats[user._id]?.offers_requested || 0)}
                                          </div>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border-2 border-purple-100 hover:border-purple-300 transition-all shadow-sm hover:shadow-md">
                                          <div className="text-xs text-purple-600 font-bold uppercase tracking-wide mb-2">Total Clicks</div>
                                          <div className="text-2xl font-black text-purple-900">
                                            {statsLoading[user._id] ? <Loader2 className="w-5 h-5 animate-spin" /> : (profileStats[user._id]?.total_clicks?.toLocaleString() || 0)}
                                          </div>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border-2 border-purple-100 hover:border-purple-300 transition-all shadow-sm hover:shadow-md">
                                          <div className="text-xs text-purple-600 font-bold uppercase tracking-wide mb-2">Avg Time Spent</div>
                                          <div className="text-2xl font-black text-purple-900">
                                            {statsLoading[user._id] ? <Loader2 className="w-5 h-5 animate-spin" /> : (profileStats[user._id]?.avg_time_spent || '0s')}
                                          </div>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border-2 border-purple-100 hover:border-purple-300 transition-all shadow-sm hover:shadow-md">
                                          <div className="text-xs text-purple-600 font-bold uppercase tracking-wide mb-2">Preferred GEO</div>
                                          <div className="text-2xl font-black text-purple-900">
                                            {statsLoading[user._id] ? (
                                              <Loader2 className="w-5 h-5 animate-spin" />
                                            ) : profileStats[user._id]?.top_geos && profileStats[user._id].top_geos.length > 0 ? (
                                              <span className="flex items-center gap-2">
                                                <Globe className="w-5 h-5 text-purple-600" />
                                                {profileStats[user._id].top_geos[0].country}
                                              </span>
                                            ) : 'N/A'}
                                          </div>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border-2 border-purple-100 hover:border-purple-300 transition-all shadow-sm hover:shadow-md">
                                          <div className="text-xs text-purple-600 font-bold uppercase tracking-wide mb-2">Top Vertical</div>
                                          <div className="text-2xl font-black text-purple-900">
                                            {statsLoading[user._id] ? <Loader2 className="w-5 h-5 animate-spin" /> : (profileStats[user._id]?.top_vertical || 'N/A')}
                                          </div>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border-2 border-purple-100 hover:border-purple-300 transition-all shadow-sm hover:shadow-md">
                                          <div className="text-xs text-purple-600 font-bold uppercase tracking-wide mb-2">Level</div>
                                          <div className="text-2xl font-black text-indigo-900">
                                            <Badge variant="outline" className="text-lg px-3 py-1 bg-indigo-50 text-indigo-700 border-indigo-300 font-black">
                                              {user.level || 'L1'}
                                            </Badge>
                                          </div>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border-2 border-purple-100 hover:border-purple-300 transition-all shadow-sm hover:shadow-md">
                                          <div className="text-xs text-purple-600 font-bold uppercase tracking-wide mb-2">Suspicious</div>
                                          <div className="text-2xl font-black">
                                            {statsLoading[user._id] ? (
                                              <Loader2 className="w-5 h-5 animate-spin" />
                                            ) : profileStats[user._id]?.suspicious ? (
                                              <span className="flex items-center gap-2 text-red-600">
                                                <ShieldAlert className="w-5 h-5" /> Yes
                                              </span>
                                            ) : (
                                              <span className="flex items-center gap-2 text-green-600">
                                                <Award className="w-5 h-5" /> No
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* TOP 10 VIEWED OFFERS + SEARCH KEYWORDS */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                      {/* Top 10 Viewed Offers */}
                                      <div className="bg-white p-5 rounded-2xl border-2 border-blue-200 shadow-md">
                                        <h4 className="text-base font-bold text-blue-800 mb-4 flex items-center gap-2">
                                          <Eye className="w-5 h-5" /> Top 10 Viewed Offers (Intent Signal)
                                        </h4>
                                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                          {statsLoading[user._id] ? (
                                            <div className="text-center py-4"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>
                                          ) : profileStats[user._id]?.top_viewed_offers?.length > 0 ? (
                                            profileStats[user._id].top_viewed_offers.slice(0, 10).map((offer: any, idx: number) => (
                                              <div key={offer.id} className="p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-center gap-3 hover:bg-blue-100 transition-colors">
                                                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 text-white flex items-center justify-center text-xs font-bold shadow-md">
                                                  {idx + 1}
                                                </div>
                                                <div className="flex-1">
                                                  <div className="font-semibold text-sm text-blue-900">{offer.name}</div>
                                                  <div className="text-xs text-blue-700 mt-1 flex items-center gap-3">
                                                    <span className="flex items-center gap-1">
                                                      <Eye className="w-3 h-3" /> {offer.views} views
                                                    </span>
                                                    <span>•</span>
                                                    <span>{offer.category}</span>
                                                  </div>
                                                </div>
                                              </div>
                                            ))
                                          ) : (
                                            <div className="text-xs text-muted-foreground italic text-center py-4">No viewed offers</div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Search Keywords */}
                                      <div className="bg-white p-5 rounded-2xl border-2 border-amber-200 shadow-md">
                                        <h4 className="text-base font-bold text-amber-800 mb-4 flex items-center gap-2">
                                          <Search className="w-5 h-5" /> Latest Search Keywords
                                        </h4>
                                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                          {statsLoading[user._id] ? (
                                            <div className="text-center py-4"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>
                                          ) : profileStats[user._id]?.search_keywords?.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                              {profileStats[user._id].search_keywords.map((keyword: any, idx: number) => (
                                                <div key={idx} className="px-3 py-2 bg-gradient-to-r from-amber-50 to-amber-100 rounded-full border border-amber-200 hover:border-amber-300 transition-all shadow-sm hover:shadow-md">
                                                  <span className="text-xs font-bold text-amber-900">{keyword.term}</span>
                                                  <span className="text-xs text-amber-700 ml-2 bg-amber-200 px-2 py-0.5 rounded-full font-bold">({keyword.count})</span>
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <div className="text-xs text-muted-foreground italic text-center py-4">No search history</div>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* RECOMMENDED OFFERS */}
                                    <div className="bg-gradient-to-br from-indigo-50 to-white p-5 rounded-2xl border border-indigo-200 shadow-sm">
                                      <h4 className="text-base font-bold text-indigo-800 mb-4 flex items-center gap-2">
                                        <TrendingUp className="w-5 h-5" /> Recommended Offers (Based on GEO + Activity)
                                      </h4>
                                      <div className="space-y-3 max-h-[400px] overflow-y-auto">
                                        {statsLoading[user._id] ? (
                                          <div className="text-center py-4"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>
                                        ) : profileStats[user._id]?.recommended_offers?.length > 0 ? (
                                          profileStats[user._id].recommended_offers.map((offer: any, idx: number) => (
                                            <div key={idx} className="p-4 bg-white rounded-xl border border-indigo-100 shadow-sm hover:shadow-md transition-shadow">
                                              <div className="flex justify-between items-start mb-2">
                                                <div className="flex-1">
                                                  <div className="font-bold text-sm text-indigo-900 flex items-center gap-2">
                                                    {offer.n}
                                                    {offer.t && <span className="text-[10px] px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-bold">🔥 TRENDING</span>}
                                                  </div>
                                                  <div className="text-xs text-indigo-600 mt-1">
                                                    {offer.category} • {offer.geo}
                                                  </div>
                                                </div>
                                                <div className="text-right">
                                                  <div className="text-lg font-black text-green-600">{offer.pay}</div>
                                                  <div className="text-xs text-muted-foreground">CPA</div>
                                                </div>
                                              </div>
                                              <div className="flex items-center gap-2 mt-3">
                                                <div className="flex-1 h-2 rounded-full bg-indigo-100 overflow-hidden">
                                                  <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${offer.m}%` }}></div>
                                                </div>
                                                <span className="text-xs font-bold text-indigo-600">{offer.m}% match</span>
                                              </div>
                                            </div>
                                          ))
                                        ) : profileStats[user._id]?.matched_offers?.length > 0 ? (
                                          profileStats[user._id].matched_offers.map((offer: any) => (
                                            <div key={offer.id} className="p-4 bg-white rounded-xl border border-indigo-100 shadow-sm hover:shadow-md transition-shadow">
                                              <div className="flex justify-between items-start mb-2">
                                                <div className="flex-1">
                                                  <div className="font-bold text-sm text-indigo-900">{offer.name}</div>
                                                  <div className="text-xs text-indigo-600 mt-1">
                                                    {offer.network} • {offer.category} • {offer.geo}
                                                  </div>
                                                </div>
                                                <div className="text-right">
                                                  <div className="text-lg font-black text-green-600">${offer.payout}</div>
                                                  <div className="text-xs text-muted-foreground">{offer.payout_type}</div>
                                                </div>
                                              </div>
                                              <div className="flex items-center gap-2 mt-3">
                                                <div className="flex-1 h-2 rounded-full bg-indigo-100 overflow-hidden">
                                                  <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${offer.match_score}%` }}></div>
                                                </div>
                                                <span className="text-xs font-bold text-indigo-600">{offer.match_score}% match</span>
                                              </div>
                                              <div className="flex flex-wrap gap-1 mt-2">
                                                {offer.match_reasons?.map((reason: string, idx: number) => (
                                                  <span key={idx} className="text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-medium">
                                                    {reason}
                                                  </span>
                                                ))}
                                              </div>
                                            </div>
                                          ))
                                        ) : (
                                          <div className="text-xs text-muted-foreground italic text-center py-4">No recommended offers available</div>
                                        )}
                                      </div>
                                    </div>

                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Single Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject User Application</DialogTitle>
            <DialogDescription>Are you sure you want to reject {selectedUser?.username}'s application?</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Reason for rejection (optional)</label>
              <Textarea placeholder="Enter reason for rejection..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="mt-2" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={actionLoading === selectedUser?._id}>
              {actionLoading === selectedUser?._id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Reject User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Reject Dialog */}
      <Dialog open={bulkRejectDialogOpen} onOpenChange={setBulkRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Reject Users</DialogTitle>
            <DialogDescription>Reject {selectedIds.size} selected user(s)?</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Reason for rejection (optional)</label>
              <Textarea placeholder="Enter reason for rejection..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="mt-2" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkRejectDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkReject} disabled={bulkLoading}>
              {bulkLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Reject {selectedIds.size} Users
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Publisher</DialogTitle>
            <DialogDescription>Manually create a new publisher account.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Username</label>
                <Input placeholder="johndoe" value={createForm.username} onChange={e => setCreateForm({ ...createForm, username: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Email</label>
                <Input placeholder="john@example.com" type="email" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500">Initial Password</label>
              <Input placeholder="••••••••" type="password" value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">First Name</label>
                <Input placeholder="John" value={createForm.firstName} onChange={e => setCreateForm({ ...createForm, firstName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Last Name</label>
                <Input placeholder="Doe" value={createForm.lastName} onChange={e => setCreateForm({ ...createForm, lastName: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500">Company Name</label>
              <Input placeholder="Acme Inc" value={createForm.companyName} onChange={e => setCreateForm({ ...createForm, companyName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500">User Level</label>
              <select
                value={createForm.level}
                onChange={e => setCreateForm({ ...createForm, level: e.target.value })}
                className="w-full border border-border rounded-md px-3 py-2 text-sm"
              >
                {levelDefinitions.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateUser} disabled={actionLoading === "creating"} className="bg-blue-600 hover:bg-blue-700">
              {actionLoading === "creating" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Create Publisher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Users;
