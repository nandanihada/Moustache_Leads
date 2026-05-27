import React, { useState, useEffect } from "react";
import { Search, UserCheck, UserX, Mail, Clock, CheckCircle, XCircle, Loader2, CheckSquare, Square, MailCheck, MailX, UserPlus, RefreshCw, Eye, EyeOff, ChevronDown, ChevronRight, Globe, Activity, BarChart2, PieChart, MessageSquare, Send, TrendingUp, ShieldAlert, Award, Filter, Users as UsersIcon, FileCheck, Download, X, Copy, Link } from "lucide-react";
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
  agreement_signed?: boolean;
  agreement_signed_at?: string;
  digital_signature?: string;
  signed_agreement_pdf?: string;
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
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewUser, setPreviewUser] = useState<User | null>(null);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailSubject, setEmailSubject] = useState("Your MoustacheLeads Signed Agreement");
  const [emailContent, setEmailContent] = useState("");
  const [emailUser, setEmailUser] = useState<User | null>(null);
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

  const openEmailDialog = (user: User) => {
    setEmailUser(user);
    setEmailSubject("Your MoustacheLeads Signed Agreement");
    setEmailContent(`<p>Dear ${user.first_name || user.username || 'Partner'},</p>
<p>Please find attached your signed Publisher Agreement with MoustacheLeads.</p>
<p>Thank you for partnering with us!</p>
<br/>
<p>Best regards,<br/>The MoustacheLeads Team</p>`);
    setShowEmailDialog(true);
  };

  const handleSendAgreement = async () => {
    if (!emailUser) return;
    try {
      const token = localStorage.getItem('token');
      toast({ title: "Sending...", description: "Preparing to email the agreement." });
      setShowEmailDialog(false);
      const response = await fetch(`${API_BASE_URL}/api/auth/admin/users/${emailUser._id}/send-agreement`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: emailSubject, content: emailContent })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send agreement');

      toast({ title: "Success", description: data.message });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to send agreement email", variant: "destructive" });
    }
  };


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

  const handleDownloadAgreement = async (filename: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/auth/download-agreement/${filename}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to download agreement');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({
        title: "Download Error",
        description: "Failed to download the signed agreement PDF.",
        variant: "destructive",
      });
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

                                    {/* OFFERWALL URL */}
                                    {profileStats[user._id]?.offerwall_url && (
                                      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-5 rounded-2xl border-2 border-indigo-200 shadow-md">
                                        <h4 className="text-base font-bold text-indigo-800 mb-3 flex items-center gap-2">
                                          <Link className="w-5 h-5 text-indigo-600" /> Offerwall URL
                                          {profileStats[user._id]?.placement_info?.offerwall_title && (
                                            <Badge variant="outline" className="ml-2 text-xs bg-indigo-100 text-indigo-700 border-indigo-300">
                                              {profileStats[user._id].placement_info.offerwall_title}
                                            </Badge>
                                          )}
                                          {profileStats[user._id]?.placement_info?.status && (
                                            <Badge className={`ml-1 text-xs ${profileStats[user._id].placement_info.status === 'LIVE' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-yellow-100 text-yellow-700 border-yellow-300'}`}>
                                              {profileStats[user._id].placement_info.status}
                                            </Badge>
                                          )}
                                        </h4>
                                        <div className="flex items-center gap-2">
                                          <code className="flex-1 text-xs bg-white px-4 py-2.5 rounded-lg border border-indigo-200 text-slate-700 font-mono overflow-x-auto whitespace-nowrap">
                                            {profileStats[user._id].offerwall_url}
                                          </code>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-shrink-0 border-indigo-300 text-indigo-700 hover:bg-indigo-100"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              navigator.clipboard.writeText(profileStats[user._id].offerwall_url);
                                              toast({ title: "Copied!", description: "Offerwall URL copied to clipboard" });
                                            }}
                                          >
                                            <Copy className="w-4 h-4 mr-1" /> Copy
                                          </Button>
                                        </div>
                                      </div>
                                    )}

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

                                    {/* LEGAL AGREEMENT SECTION */}
                                    <div className="bg-white p-6 rounded-2xl border-2 border-slate-200 shadow-md">
                                      <h4 className="text-base font-bold text-slate-800 mb-5 flex items-center gap-2">
                                        <FileCheck className="w-5 h-5 text-blue-600" /> Digital Agreement & Signature
                                      </h4>
                                      
                                      {user.agreement_signed ? (
                                        <div className="space-y-6">
                                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                            {/* Column 1: Status & Actions */}
                                            <div className="space-y-4">
                                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Signed On</p>
                                                <p className="text-sm font-bold text-slate-900">{formatDate(user.agreement_signed_at || '')}</p>
                                              </div>
                                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Agreement Version</p>
                                                <p className="text-sm font-bold text-slate-900">v1.0 (Publisher + NDA)</p>
                                              </div>
                                              <div className="grid grid-cols-2 gap-2">
                                                <Button 
                                                   variant="outline" 
                                                   className="w-full flex items-center justify-center gap-2 border-blue-600 text-blue-600 hover:bg-blue-50 font-bold text-xs px-2"
                                                   onClick={() => {
                                                     setPreviewUser(user);
                                                     setShowPreviewDialog(true);
                                                   }}
                                                 >
                                                   <Eye className="h-4 w-4" /> View PDF
                                                 </Button>
                                                 <Button 
                                                   variant="outline" 
                                                   className="w-full flex items-center justify-center gap-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-bold text-xs px-2"
                                                   onClick={() => openEmailDialog(user)}
                                                 >
                                                   <Send className="h-4 w-4" /> Email PDF
                                                 </Button>
                                              </div>
                                            </div>
                                            
                                            {/* Column 2: Contract Information */}
                                            <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                                              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-4 border-b pb-2">Contract Information</p>
                                              <div className="space-y-3">
                                                <div>
                                                  <p className="text-[10px] text-slate-400 font-medium">Legal Name</p>
                                                  <p className="text-sm font-bold text-slate-800">{user.first_name} {user.last_name}</p>
                                                </div>
                                                <div>
                                                  <p className="text-[10px] text-slate-400 font-medium">Company Name</p>
                                                  <p className="text-sm font-bold text-slate-800">{user.company_name || 'N/A'}</p>
                                                </div>
                                                <div>
                                                  <p className="text-[10px] text-slate-400 font-medium">Business Address</p>
                                                  <p className="text-xs font-medium text-slate-700">
                                                    {user.address ? (
                                                      <>
                                                        {user.address.street}{user.address.unit ? `, ${user.address.unit}` : ''}<br />
                                                        {user.address.city}, {user.address.state} {user.address.postal}<br />
                                                        {user.address.country}
                                                      </>
                                                    ) : 'Address not provided'}
                                                  </p>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Column 3: Payout & Tax Details */}
                                            <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                                              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-4 border-b pb-2">Payout & Tax Details</p>
                                              <div className="space-y-3">
                                                <div className="grid grid-cols-2 gap-2">
                                                  <div>
                                                    <p className="text-[10px] text-slate-400 font-medium">Tax ID / VAT</p>
                                                    <p className="text-sm font-bold text-slate-800">{user.payout_details?.tax_id || user.payout_details?.vat_id || 'N/A'}</p>
                                                  </div>
                                                  <div>
                                                    <p className="text-[10px] text-slate-400 font-medium">Bank Name</p>
                                                    <p className="text-sm font-bold text-slate-800">{user.payout_details?.bank_name || 'N/A'}</p>
                                                  </div>
                                                </div>
                                                <div>
                                                  <p className="text-[10px] text-slate-400 font-medium">Account Holder</p>
                                                  <p className="text-sm font-bold text-slate-800">{user.payout_details?.account_name || 'N/A'}</p>
                                                </div>
                                                <div>
                                                  <p className="text-[10px] text-slate-400 font-medium">Account Number</p>
                                                  <p className="text-sm font-bold text-slate-800 font-mono">{user.payout_details?.account_number || 'N/A'}</p>
                                                </div>
                                              </div>
                                            </div>
                                          </div>

                                          {/* Signature Preview */}
                                          <div className="border-t pt-6">
                                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2">Digital Signature</p>
                                            <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-4 flex items-center justify-center h-[180px] w-full">
                                              {user.digital_signature ? (
                                                <img src={user.digital_signature} alt="Signature" className="max-h-40 object-contain" />
                                              ) : (
                                                <span className="text-sm text-slate-400 italic">Signature image not found</span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                          <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                                          <p className="text-sm font-medium text-slate-600">This user has not signed the legal agreement yet.</p>
                                        </div>
                                      )}
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

      {/* Agreement Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl bg-slate-50">
          <DialogHeader className="p-6 bg-slate-900 text-white sticky top-0 z-50 flex flex-row items-center justify-between space-y-0">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <FileCheck className="w-6 h-6 text-blue-400" /> Publisher Agreement Preview
              </DialogTitle>
              <DialogDescription className="text-slate-400 mt-1">
                Official Document for {previewUser?.first_name} {previewUser?.last_name} ({previewUser?.company_name || 'Individual'})
              </DialogDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setShowPreviewDialog(false)} className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-full">
              <X className="h-6 w-6" />
            </Button>
          </DialogHeader>

          <div className="p-12 bg-white mx-auto my-8 shadow-sm border border-slate-200 max-w-4xl rounded-sm font-serif text-slate-800">
            {/* Header section similar to PDF/Preview */}
            <div className="text-center mb-12">
              <h1 className="text-3xl font-bold uppercase tracking-tight border-b-2 border-slate-900 pb-4">Publisher Agreement</h1>
              <p className="mt-4 text-sm text-slate-500 font-sans italic">Effective Date: {previewUser?.agreement_signed_at ? formatDate(previewUser.agreement_signed_at) : 'May 13, 2026'}</p>
            </div>

            <div className="space-y-8 text-[15px] leading-relaxed text-justify">
              <p>This Agreement (the <b>"Agreement"</b>), is entered into and made effective as of the Effective Date, by and between:</p>
              
              <div className="pl-6 space-y-4">
                <p><b>SURVTIT MARKET RESEARCH SURVEY LLP</b>, a Limited Liability Partnership duly incorporated under the laws of India (LLPIN: ACB-8160, PAN: AFAFS9301P, TAN: MRTS28234D), with its address at 11/1117/48, Mehndi Sarai, Jankipuram Police Station, Saharanpur-247001, Uttar Pradesh, India (<b>"Company"</b>), of the one part;</p>
                <p className="font-bold text-center">AND</p>
                <p><b>{previewUser?.first_name} {previewUser?.last_name}</b>, an individual residing at <b>{previewUser?.address?.street}{previewUser?.address?.unit ? `, ${previewUser.address.unit}` : ''}, {previewUser?.address?.city}, {previewUser?.address?.state} {previewUser?.address?.postal}, {previewUser?.address?.country}</b> (hereinafter referred to as the <b>"Publisher"</b>), of the other part;</p>
              </div>

              <p>(Hereinafter collectively referred to as "the Parties" and individually as a "Party").</p>

              <div className="space-y-4">
                <p><b>WHEREAS:</b> Company provides, among other services, a service that enables web users to obtain virtual currency, which may be used for various websites, online games, social applications, social networks, and other similar online applications by either earning (by completing offers) or purchasing such virtual currency; and</p>
                <p><b>WHEREAS,</b> the Publisher desires to collaborate with the Company, on a non-exclusive basis, for the purpose of promoting and providing the Service as defined hereunder, in accordance with the terms and conditions set forth below, and the Company desires to accept the Publisher's collaboration.</p>
                <p><b>NOW, THEREFORE,</b> in consideration of the mutual agreements contained herein, and upon the terms and subject to the conditions hereinafter set forth, the Parties do hereby agree as follows:</p>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-lg border-b border-slate-200 pb-1">1. DEFINITIONS</h3>
                <table className="w-full border-collapse border border-slate-200 text-sm font-sans">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="border border-slate-200 p-3 text-left font-bold w-1/3">Term</th>
                      <th className="border border-slate-200 p-3 text-left font-bold">Definition</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DEFINITIONS.map(([term, def]) => (
                      <tr key={term}>
                        <td className="border border-slate-200 p-3 font-bold bg-slate-50/50">{term}</td>
                        <td className="border border-slate-200 p-3">{def}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold underline uppercase">2. IMPLEMENTATION</h3>
                <p>2.1 Company shall provide Publisher with the Service, including Company Content, to enable Publisher to make Offers available to Users via the Publisher Application.</p>
                <p>2.2 During the term of this Agreement and for this Agreement only, Company will integrate and optimise the platform used to publish Offers on the Publisher Application.</p>
                <p>2.3 The Publisher may log in to the Dashboard to monitor information relating to Transactions.</p>
                <p>2.4 User and/or Publisher support – Company will respond to User's inquiries relating to Transactions made via the Service and provide technical support to Publisher, according to its policies and regulations.</p>
                <p>2.5 Territory – Service included in this Agreement is not geographically restricted.</p>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold underline uppercase">3. REPRESENTATION AND WARRANTIES</h3>
                <p>Each party represents, warrants, and covenants that:</p>
                <p>3.1 It has full power to execute and deliver this Agreement and to perform its obligations hereunder, and all necessary corporate and other actions have been taken to authorise the execution and delivery of this Agreement and the performance of such obligations.</p>
                <p>3.2 The execution of this Agreement shall not infringe on any third party's intellectual property rights.</p>
                <p>3.3 It will ensure that any confidential information, trade secrets or any intellectual property rights of any other person or entity are not used without their permission.</p>
                <p>3.4 It shall comply with all applicable international, state, and local laws and government rules and regulations and shall use only legitimate and ethical business practices in connection with this Agreement.</p>
                <p>3.5 It shall maintain, display to Users, and abide by a privacy policy that complies with all applicable laws and regulations with respect to the collection, use, and transfer of User Data, including but not limited to any restrictions and/or regulations regarding PII and/or Profile Data. The Party's failure to maintain and comply with said policy shall constitute a material breach of this Agreement.</p>
                <p>3.6 It will ensure that any of its systems and/or access it may have to systems of the other Party (including affiliates) will not impair the integrity and availability of such systems and will not deliver any (i) viruses, worms, time bombs, trojan horses or other harmful, malicious, or destructive code; and (ii) software disabling devices, time-out devices, counter devices, and devices intended to collect data regarding usage or related statistics without the prior written authorization of the other Party.</p>
                <p>3.7 It will not promote or contain content that is illegal, harmful, threatening, defamatory, obscene, sexually explicit, harassing, promotes violence and/or discrimination, and/or illegal activities of any kind.</p>
                <p>3.8 It shall be responsible for its own compliance with any applicable data protection laws and regulations.</p>
                <p>3.9 Offers and/or Publisher Application may include links to other websites or resources that either Party has no control over and is not responsible or liable for such third-party's content, products, advertising, or availability.</p>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold underline uppercase">4. PAYOUT TERMS</h3>
                <p>4.1 Payout currency: Payouts shall be processed in USD.</p>
                <p>4.2 Payout timeline: Payment will be made within thirty (30) days after the end of each calendar month, for Transactions occurring during such month. The Publisher will provide the Company with a valid invoice.</p>
                <p>4.3 Payout methods: PayPal or Bank Transfer.</p>
                <p>4.4 Taxation: The Publisher is solely responsible for assessing and remitting its own local taxes.</p>
                <p>4.5 Minimum Payout: It is agreed that any monthly Payout that does not meet the minimum threshold of $50 USD will be carried over to the Payout of the following month.</p>
                <p>4.6 Fraudulent Activity and Chargebacks - Company will have the right, in its full discretion, to deduct and/or chargeback Payouts resulting from Fraudulent Activity. Furthermore, the Company reserves the right to claw back or deduct funds from future Payouts for a period of ninety (90) days post-transaction if leads/actions are subsequently rejected by the Company Client.</p>
                <p>4.7 Tax Clause: No Indian GST applies as this is an export of services to a publisher outside India. Publisher is solely responsible for any taxes in its own jurisdiction.</p>
                <p>4.8 Except for the Payout, Publisher will not be entitled to other payments, reimbursements, royalties, or expenses unless otherwise agreed in writing by the Parties. The Payout constitutes the entire payment due to Publisher under this Agreement, and Publisher shall not be entitled to any payments (including any reimbursement) other than those contained herein or specifically agreed in writing by Company.</p>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold underline uppercase">5. INDEMNIFICATION</h3>
                <p>Each Party (in this article, "Indemnifying Party") shall defend, indemnify, protect and hold harmless the Other Party (in this article, "Injured Party"), and each of their officers, employees and agents from and against any claims, losses, demands, attorneys' fees, expenses, costs, damages, judgments, liabilities, causes of action, obligations or suits resulting from:</p>
                <p>5.1 Any actual or alleged breach of any representation, warranty or other provision of this agreement by the Indemnifying Party or its personnel.</p>
                <p>5.2 Any actual or alleged infringement of any third party's Intellectual Property rights.</p>
                <p>5.3 Any negligent act or omission or willful misconduct, dishonesty or fraud of the Indemnifying Party or its personnel.</p>
                <p>The Indemnifying Party's obligation to indemnify the Injured Party shall only apply in case the Injured Party:
                  <p className="pl-6">5.4 Has given the Indemnifying Party prompt written notice of any third-party claim.</p>
                  <p className="pl-6">5.5 Cooperates reasonably with the Indemnifying Party in connection with the defence and settlement of such claim.</p>
                  <p className="pl-6">5.6 Shall not settle any such third-party claim without the Indemnifying Party's prior written approval.</p></p>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold underline uppercase">6. CONFIDENTIALITY</h3>
                <p>6.1 Mutual NDA - The Parties will enter into a "Mutual Non-Disclosure Agreement" (the "NDA"), which is incorporated herein as Exhibit A. During the term of this Agreement, any confidential information disclosed shall be governed under the terms of the NDA. The NDA and the Parties' obligations, accordingly, shall remain in effect with respect to the confidential information exchanged under this Agreement throughout the term of this Agreement and for a period of three (3) years thereafter.</p>
                <p>6.2 Publicity - Neither Party will use the other Party's name, logo, or trademarks or issue public announcements or press releases, make any statements, or confirm or comment on any information, public or otherwise, concerning the other Party's business, or the existence or subject matter of this Agreement.</p>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold underline uppercase">7. OWNERSHIP AND LICENSING</h3>
                <p>7.1 Company's Ownership - As between Company and Publisher, Company shall retain sole and exclusive ownership of all rights, title, and interest, in and to the Service (except for any of Publisher's content or Offers included therein), including, but not limited to all software, information, data, documents, know-how, methods, processes, hardware and other intellectual property rights that are provided or used by Company in connection with the Service, including all intellectual property rights related thereto.</p>
                <p>7.2 Publisher's Ownership - As between Company and Publisher, Publisher shall retain sole and exclusive ownership of all rights, title, and interest, in and to the Publisher Application (except for any Offer and/or Company Content included therein), including, but not limited to all software, information, data, documents, know-how, methods, processes, hardware and other intellectual property rights related thereto.</p>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold underline uppercase">8. LIABILITY</h3>
                <p>EXCEPT FOR BREACH OF ARTICLES 6-7, BREACH OF ARTICLES 7.1-7.2, BREACH OF ARTICLE 3.1, BREACH OF ARTICLES 3.2-3.7, AND THE PARTIES OBLIGATIONS UNDER ARTICLE 5, IN NO EVENT WILL EITHER PARTY BE LIABLE FOR ANY SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL, EXEMPLARY OR PUNITIVE DAMAGES, WHETHER SUCH DAMAGES ARE BASED ON CONTRACT, TORT, STATUTE, IMPLIED DUTIES OR OBLIGATIONS, OR OTHER LEGAL THEORY, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. IF EITHER PARTY IS FOUND LIABLE FOR DAMAGES IN CONNECTION WITH THIS AGREEMENT, ITS TOTAL LIABILITY SHALL NOT EXCEED THE TOTAL PAYOUT ACTUALLY PAID UNDER THIS AGREEMENT.</p>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold underline uppercase">9. TERM AND TERMINATION</h3>
                <p>9.1 The term of this Agreement will begin on the Effective Date and will remain in effect until terminated in accordance with this Agreement.</p>
                <p>9.2 Termination for convenience - Either Party may terminate this Agreement for its convenience, without liability, at any time, upon thirty (30) days' written notice to the other Party.</p>
                <p>9.3 Termination for cause - Each Party may terminate this Agreement due to a breach of the other Party, which was not cured within 30 days from receipt of notice thereto (to the extent such breach can be cured), without derogating its right to seek and obtain all remedies available to it in law or in equity.</p>
                <p>9.4 Either Party may terminate this Agreement immediately and without notice, upon discovery of Fraudulent Activity.</p>
                <p>9.5 In addition, either party may terminate this Agreement if the other party seeks protection under any bankruptcy, receivership, trust deed, creditors' arrangement, personal insolvency, or comparable proceeding.</p>
                <p>9.6 Payment Upon Termination – In the event of termination for whatever reason, Company will pay Publisher the undisputed Payout due and payable to Publisher through the date of termination, regardless of whether such Payout reaches the Minimum Payout.</p>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold underline uppercase">10. UPON TERMINATION OR EXPIRATION</h3>
                <p>Upon termination or expiration of this Agreement, whichever occurs first, each Party shall promptly return or destroy and erase from all its systems all originals and copies of all documents, materials, and other expressions in any form or medium of Confidential Information and materials provided by the other Party.</p>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold underline uppercase">11. NON-EXCLUSIVE RELATIONSHIP</h3>
                <p>Each party expressly reserves the right to contract with other third parties to provide or acquire Services similar or identical to Services provided under this Agreement.</p>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold underline uppercase">12. MUTUAL NON-SOLICITATION</h3>
                <p>During the term of the Agreement and for a period of twelve (12) months thereafter, neither Party will, either directly or indirectly (whether through its respective employees, independent contractors, consultants, or otherwise), employ or engage, or solicit for employment or engagement, any employee, independent contractor, consultant, agent, or representative of the other Party.</p>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold underline uppercase">13. ASSIGNABILITY</h3>
                <p>Publisher may not assign or transfer this Agreement or any rights or obligations hereunder without the prior written consent of Company. Company shall not assign or transfer this Agreement or any rights or obligations hereunder without providing a prior written notice to the Publisher.</p>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold underline uppercase">14. APPLICABLE LAW AND JURISDICTION</h3>
                <p>It is hereby agreed between the parties that the laws of the State of India shall apply to this Agreement and that the sole and exclusive place of jurisdiction in any matter arising out of or in connection with this Agreement shall be the competent courts at Saharanpur, Uttar Pradesh, India.</p>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold underline uppercase">15. ENTIRETY OF THE AGREEMENT</h3>
                <p>This Agreement constitutes the full and complete statement of the agreement of the Parties with respect to the subject matter hereof and supersedes all prior agreements, representations, warranties, understandings, relationships, whether written or oral, between the Parties, with respect to the subject matter hereof.</p>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold underline uppercase">16. AMENDMENTS</h3>
                <p>Changes or modifications to this Agreement may not be made orally, but only by a written amendment signed by both Parties.</p>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold underline uppercase">17. GENERAL</h3>
                <p>17.1 This Agreement shall not be construed to create a partnership, joint venture, or the relationship of principal and agent, employer, or employee between the parties.</p>
                <p>17.2 The waiver of any right herein contained by either Party shall not be construed as a waiver of the same right at a future date or as a waiver of any other right herein contained.</p>
                <p>17.3 The article headings used in this Agreement are for convenience of reference only and will not affect the interpretation hereof. Unless the context otherwise requires, all terms used in the singular will be deemed to refer to the plural as well, and vice versa. As used in this Agreement, the word "including" is not a word of limitation.</p>
                <p>17.4 If any provision of this Agreement shall be determined to be illegal or unenforceable, that provision will be limited or eliminated to the minimum extent necessary so that this Agreement shall otherwise remain in full force and effect and enforceable.</p>
                <p>17.5 The parties may execute this Agreement in counterparts. Each counterpart shall constitute an original document, and all counterparts shall constitute the same agreement.</p>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold underline uppercase">18. NOTICES</h3>
                <p>All notices or other communications that either Party must make to the other shall be made in writing and shall be understood to have been done correctly if delivered by hand, mail, email, or facsimile and addressed to the Party at the address contained in this Agreement or such other address as shall have been notified to the other for this Agreement. Any notice given by mail shall be deemed given upon the expiration of five (5) days after mailing and in proving such mailing it shall be sufficient to show that the envelope containing the notice was properly addressed and posted as an airmail or first class pre-paid letter.
                  Any notice given by facsimile shall be deemed to have been given at midnight (in the country of dispatch) on the date on which it was dispatched.
                  E-mail correspondence shall constitute a notice under this Agreement, provided that the receipt of such e-mail by the recipient can be reasonably proved by the sender.
                </p>
                <p><strong>Company:</strong> SURVTIT MARKET RESEARCH SURVEY LLP, 11/1117/48, Mehndi Sarai, Jankipuram Police Station, Saharanpur-247001, UP, India. Email: shivam@survtit.com</p>
                <p><strong>Publisher:</strong> {previewUser?.first_name} {previewUser?.last_name}, {previewUser?.address?.street}. Email: {previewUser?.email}</p>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-lg border-b border-slate-200 pb-1">19. SIGNATURES</h3>
                <p className="text-sm italic">IN WITNESS WHEREOF, the Parties hereto, each by a duly authorised officer, have caused this Agreement to be executed on the last date written below.</p>
                
                <div className="grid grid-cols-2 gap-12 mt-8">
                  <div className="space-y-4">
                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">For Company</p>
                    <div className="h-32 border border-slate-100 rounded-lg bg-slate-50 flex items-center justify-center p-4">
                      <img src="/signature.jpeg" alt="Stamp" className="h-24 object-contain opacity-90" />
                    </div>
                    <div className="pt-2 border-t-2 border-slate-900">
                      <p className="font-bold text-slate-900 uppercase">Shivam Julka</p>
                      <p className="text-xs text-slate-500">CMO / Co-founder</p>
                      <p className="text-[10px] text-slate-400 mt-1">Date: {previewUser?.agreement_signed_at ? formatDate(previewUser.agreement_signed_at) : 'May 13, 2026'}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">For Publisher</p>
                    <div className="h-32 border border-slate-100 rounded-lg bg-slate-50 flex items-center justify-center p-4">
                      {previewUser?.digital_signature && (
                        <img src={previewUser.digital_signature} alt="Signature" className="h-24 object-contain" />
                      )}
                    </div>
                    <div className="pt-2 border-t-2 border-slate-900">
                      <p className="font-bold text-slate-900 uppercase">{previewUser?.first_name} {previewUser?.last_name}</p>
                      <p className="text-xs text-slate-500">Authorized Representative</p>
                      <p className="text-[10px] text-slate-400 mt-1">Date: {previewUser?.agreement_signed_at ? formatDate(previewUser.agreement_signed_at) : 'May 13, 2026'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="py-24 flex items-center justify-center gap-6">
                <div className="h-px bg-slate-200 flex-1"></div>
                <span className="text-slate-300 font-sans text-xs uppercase tracking-[0.5em] font-bold">Exhibit A Attached Below</span>
                <div className="h-px bg-slate-200 flex-1"></div>
              </div>

              <div className="text-center space-y-4 mb-16">
                <h1 className="text-3xl font-bold text-slate-900 uppercase underline">EXHIBIT A — MUTUAL NON-DISCLOSURE AGREEMENT</h1>
              </div>

              <div className="space-y-6">
                <p>This Mutual Non-Disclosure Agreement (this "Agreement") is entered into and made effective as of <strong>{previewUser?.agreement_signed_at ? formatDate(previewUser.agreement_signed_at) : 'May 13, 2026'}</strong> (the "Effective Date"), by and between:</p>
                <p className="pl-6"><strong>SURVTIT MARKET RESEARCH SURVEY LLP</strong>, a Limited Liability Partnership duly incorporated under the laws of India (LLPIN: ACB-8160, PAN: AFAFS9301P, TAN: MRTS28234D), with its address at 11/1117/48, Mehndi Sarai, Jankipuram Police Station, Saharanpur-247001, Uttar Pradesh, India(<strong>"Company"</strong>), of the one part;</p>
                <p className="font-bold text-center italic">— AND —</p>
                <p className="pl-6"><strong>{previewUser?.first_name} {previewUser?.last_name}</strong>, an individual residing at <strong>{previewUser?.address?.street}, {previewUser?.address?.city}, {previewUser?.address?.state}, {previewUser?.address?.country} {previewUser?.address?.zipCode}</strong> (<strong>"Publisher"</strong>), of the other party;</p>
                <p>(Hereinafter collectively referred to as "the Parties" and individually as a "Party").</p>
              </div>

              <div className="space-y-4">
                <p><strong>WHEREAS:</strong> Company provides, among other services, a service that enables web users to obtain virtual currency, which may be used for various websites, online games, social applications, social networks, and other similar online applications by either earning (by completing offers) or purchasing such virtual currency; and</p>
                <p><strong>WHEREAS,</strong> the Publisher desires to collaborate with the Company, on a non-exclusive basis, for the purpose of promoting and providing the Service as defined under the main Publisher Agreement, in accordance with the terms and conditions set forth below, and the Company desires to accept the Publisher's collaboration.</p>
                <p><strong>NOW, THEREFORE,</strong> in consideration of the mutual agreements contained herein, and upon the terms and subject to the conditions hereinafter set forth, the Parties do hereby agree as follows:</p>
              </div>

              <div className="space-y-6 text-sm">
                <div className="space-y-2">
                  <h3 className="font-bold underline uppercase">1. CONFIDENTIAL INFORMATION</h3>
                  <p>For this Agreement "Confidential Information" means all information, disclosed by one party (the "Disclosing Party") to the other party (the "Receiving Party"), whether in oral or in written form, including but not limited to documentation, scientific, designs, software, prototypes, product descriptions, technical or business information, ideas, discoveries, inventions, specifications, formulas, processes, programs, plans, drawings, models, network configuration and rights-of-way, requirements, standards, financial and non-financial data, marketing, trade secrets, know-how, customer lists, prices, as well as all intellectual and industrial property rights contained therein and/or in relation thereto; provided however, that Confidential Information shall not include information which:</p>
                  <p className="pl-6">1.1 is or becomes lawfully in the public domain other than through a breach of any non-disclosure agreement or any confidentiality obligation,</p>
                  <p className="pl-6">1.2 was known to the Receiving Party before the disclosure, as evidenced by its business records,</p>
                  <p className="pl-6">1.3 was independently developed by or for the Receiving Party without reference to or use of Confidential Information received from the Disclosing Party,</p>
                  <p className="pl-6">1.4 was lawfully obtained by the Receiving Party from a third party without violation of a confidentiality obligation,</p>
                  <p className="pl-6">1.5 The Disclosing Party agrees in writing that it may be disclosed by the Receiving Party.</p>
                  <p>The Receiving Party shall have the burden of proving that any of the above exceptions apply by means of documentary evidence available at the time the Receiving Party claims the exception first became applicable.</p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold underline uppercase">2. NONDISCLOSURE OBLIGATIONS</h3>
                  <p><b>2.1 CONFIDENTIAL INFORMATION USE</b></p>
                  <p>Confidential Information of a Disclosing Party shall be used by the Receiving Party solely for the purpose of the agreement to which this non-disclosure agreement is annexed and shall not be used for any other purpose. Each party shall hold the other party's Confidential Information in strictest confidence and shall not disclose the other party's Confidential Information without the prior written consent of such other party. Each party may disclose the other party's Confidential Information to such party's employees on a need-to-know basis. Each party agrees to take all reasonable precautions to protect the Confidential Information of the other party from falling into the public domain or the possession of persons other than those persons authorized to have any such Confidential Information according to this Agreement, which precautions shall include the highest degree of care that such party utilizes to protect its own information of a similar nature, but in no event less than a reasonable degree of care.</p>
                  <p><b>2.2 REQUIRED DISCLOSURE</b></p>
                  <p>Nothing in this Agreement shall prohibit either party from disclosing Confidential Information of the other party if legally required to do so by judicial or governmental order or in a judicial or governmental proceeding ("Required Disclosure"), provided that the discloser then shall: 2.2.1 give the other party prompt notice of such Required Disclosure before disclosure; 2.2.2 cooperate with the other party if the other party elects to contest such disclosure or seek a protective order with respect thereto, and/or 2.2.3 in any event only disclose the exact Confidential Information, or portion thereof, specifically requested by the Required Disclosure.</p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold underline uppercase">3. OWNERSHIP</h3>
                  <p>All Confidential Information of a Disclosing Party is and shall remain the property of the Disclosing Party. Nothing contained in this Agreement shall be construed as granting or conferring any rights by license or otherwise, either express, implied or by estoppel, to any Confidential Information of a Disclosing Party, or under any patent, copyright, trademark or trade secret of the Disclosing Party.</p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold underline uppercase">4. DISCLAIMER OF WARRANTIES</h3>
                  <p>ALL CONFIDENTIAL INFORMATION FURNISHED UNDER THIS AGREEMENT IS PROVIDED BY THE DISCLOSING PARTY "AS IS". NEITHER PARTY MAKES ANY WARRANTIES, EXPRESS OR IMPLIED, REGARDING THE ACCURACY, COMPLETENESS, PERFORMANCE, MERCHANTABILITY, FITNESS FOR USE, OR OTHER ATTRIBUTES OF ITS RESPECTIVE CONFIDENTIAL INFORMATION.</p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold underline uppercase">5. RETURN OF CONFIDENTIAL INFORMATION</h3>
                  <p>Immediately upon (i) request by the Disclosing Party at any time, or (ii) the termination of this Agreement, the Receiving Party shall return to the Disclosing Party all copies or extracts of the Disclosing Party's Confidential Information, in any medium and upon the Disclosing Party's request to certify in writing by an authorized officer of the Receiving Party, the destruction of the same to the Disclosing Party, except for one archival copy that may be retained by the Receiving Party's legal counsel to monitor compliance with the terms of this agreement only.</p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold underline uppercase">6. ASSIGNMENT AND TRANSFER</h3>
                  <p>Neither party may assign or transfer this Agreement or any of its rights hereunder or delegate any of its obligations hereunder (whether by merger, operation of law or in any other manner) without the prior written consent of the other party, which consent may be withheld at such party's sole discretion. Subject to the foregoing, this Agreement shall inure to the benefit of and be binding upon the parties, their permitted successors and permitted assigns.</p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold underline uppercase">7. NON-LIMITATION OF RIGHTS</h3>
                  <p>Nothing contained in this Agreement shall be construed: 7.1 to limit either party's right to independently develop or acquire products without the use or benefit of the other party's Confidential Information, 7.2 as obligating either party to purchase or provide products from or to the other party, 7.3 to require either party to disclose or receive Confidential Information of the other party. Nothing in this Agreement shall be construed to require either party to negotiate or enter into any business transaction with the other party and any such business transaction shall be governed solely by its applicable written agreement entered into by the parties if, when and as executed by the parties.</p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold underline uppercase">8. INDEPENDENT CONTRACTORS</h3>
                  <p>The parties are independent contractors. Nothing in this Agreement or in the activities contemplated by the parties hereunder shall be deemed to create an agency, partnership, employment or joint venture relationship between the parties.Each party shall be deemed to be acting solely on its own behalf and has no authority to incur obligations or perform any acts or make any statements on behalf of the other party.</p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold underline uppercase">9. NOTICES</h3>
                  <p>All notices or other communications that either Party must make to the other shall be made in writing and shall be understood to have been done correctly if delivered by hand, mail, email, or facsimile and addressed to the Party at the address contained in this Agreement or such other address as shall have been notified to the other for the purposes of this Agreement. Any notice given by mail shall be deemed given upon the expiration of five (5) days after mailing and in proving such mailing it shall be sufficient to show that the envelope containing the notice was properly addressed and posted as an airmail or first class pre-paid letter.
                    Any notice given by facsimile shall be deemed to have been given at midnight (in the country of dispatch) on the date on which it was dispatched.
                    E-mail correspondence shall constitute a notice under this Agreement, provided that the receipt of such e-mail by the recipient can be reasonably proved by the sender.
                  </p>
                  <p><strong>Company:</strong> SURVTIT MARKET RESEARCH SURVEY LLP, 11/1117/48, Mehndi Sarai, Jankipuram Police Station, Saharanpur-247001, UP, India. Email: shivam@survtit.com</p>
                  <p><strong>Publisher:</strong> {previewUser?.first_name} {previewUser?.last_name}, {previewUser?.address?.street}. Email: {previewUser?.email}</p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold underline uppercase">10. APPLICABLE LAW AND DISPUTE RESOLUTION</h3>
                  <p>This Agreement and any matters that are connected directly and/or indirectly to it, shall be governed, construed and interpreted according to the laws of India. Any dispute shall be settled exclusively in the venue of the competent court of Saharanpur, Uttar Pradesh, India.</p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold underline uppercase">11. EQUITABLE RELIEF</h3>
                  <p>Each party acknowledges and agrees that due to the unique nature of the Disclosing Party's Confidential Information, there can be no adequate remedy at law for any breach of its obligations hereunder, that any such breach may allow the Receiving Party or third parties to unfairly compete with the Disclosing Party resulting in irreparable harm to the Disclosing Party resulting in irreparable harm to the Disclosing Party and, therefore, that upon any such breach or any threat thereof, the Disclosing Party shall be entitled to appropriate equitable relief in addition to whatever remedies it might have at law.</p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold underline uppercase">12. TERMINATION AND SURVIVAL</h3>
                  <p>This Agreement shall terminate upon termination of the main Publisher Agreement to which this non-disclosure agreement is annexed. Nevertheless, the obligations of the Receiving Party with respect to Confidential Information received prior to termination, will survive for a period of three (3) years following termination or expiration of this Agreement.</p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold underline uppercase">13. SEVERABILITY</h3>
                  <p>If any provision of this Agreement shall be held by a court of competent jurisdiction to be illegal, invalid or unenforceable, the remaining provisions shall remain in full force and effect.</p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold underline uppercase">14. ENTIRE AGREEMENT</h3>
                  <p> This Agreement shall not be modified except by a written agreement signed by both partiesNo delay, failure or waiver of either party's exercise or partial exercise of any right or remedy under this Agreement shall operate to limit, impair, preclude, cancel, waive or otherwise affect such right or remedy. No waiver of any provision of this Agreement shall constitute a waiver of any other provision(s) or of the same provision on another occasion.</p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold underline uppercase">15. COUNTERPARTS</h3>
                  <p>This Agreement may be executed in counterparts, each of which shall be deemed an original but all of which together shall constitute one and the same instrument.</p>
                </div>
              </div>

              <div className="space-y-4 pt-12 border-t border-slate-100">
                <div className="space-y-4">
                  <h3 className="font-bold text-lg uppercase underline">16. SIGNATURES</h3>
                  <p className="text-slate-600 italic text-sm">IN WITNESS WHEREOF, the Parties hereto have caused this NDA Agreement to be executed on the last date written below.</p>
                </div>
                <div className="grid grid-cols-2 gap-12 mt-8">
                  <div className="space-y-4">
                    <div className="h-24 border border-slate-50 bg-slate-50/50 flex items-center justify-center p-4">
                      <img src="/signature.jpeg" alt="Stamp" className="h-16 object-contain opacity-70" />
                    </div>
                    <div className="pt-1 border-t border-slate-900">
                      <p className="font-bold text-sm">Shivam Julka</p>
                      <p className="text-[10px] text-slate-500">CMO / Co-founder</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="h-24 border border-slate-50 bg-slate-50/50 flex items-center justify-center p-4">
                      {previewUser?.digital_signature && (
                        <img src={previewUser.digital_signature} alt="Signature" className="h-16 object-contain" />
                      )}
                    </div>
                    <div className="pt-1 border-t border-slate-900">
                      <p className="font-bold text-sm">{previewUser?.first_name} {previewUser?.last_name}</p>
                      <p className="text-[10px] text-slate-500">Authorized Representative</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="text-center py-12">
                <p className="text-xs text-slate-400 font-sans uppercase tracking-widest">End of Document</p>
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 border-t bg-white sticky bottom-0 z-50 flex sm:justify-between items-center w-full">
            <Button onClick={() => setShowPreviewDialog(false)} variant="outline" className="px-8 font-bold h-12 rounded-xl">
              Close Preview
            </Button>
            <Button 
              onClick={() => {
                if (previewUser) {
                  setShowPreviewDialog(false);
                  openEmailDialog(previewUser);
                }
              }} 
              className="px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12 rounded-xl flex items-center gap-2"
            >
              <Send className="h-5 w-5" /> Email Agreement to Publisher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto bg-slate-50 border-0 p-0 shadow-2xl">
          <DialogHeader className="bg-gradient-to-r from-indigo-900 to-indigo-800 p-6 rounded-t-lg sticky top-0 z-10">
            <div className="flex justify-between items-start">
              <div>
                <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                  <Send className="w-5 h-5 text-indigo-300" /> Send Agreement PDF
                </DialogTitle>
                <DialogDescription className="text-indigo-200 mt-1">
                  Email the signed Publisher Agreement to {emailUser?.first_name} {emailUser?.last_name} ({emailUser?.email})
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Email Subject</label>
              <Input 
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="font-medium"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Email Body (HTML supported)</label>
              <Textarea 
                value={emailContent}
                onChange={(e) => setEmailContent(e.target.value)}
                rows={10}
                className="font-mono text-sm resize-none"
              />
              <p className="text-xs text-slate-500">The PDF will be automatically attached to this email.</p>
            </div>
          </div>

          <DialogFooter className="p-6 border-t bg-white sticky bottom-0 z-10 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowEmailDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendAgreement} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-2">
              <Send className="w-4 h-4" /> Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const DEFINITIONS = [
  ["Publisher Application", "Means a website and/or application and/or other virtual space provided, owned, or controlled by Publisher."],
  ["User", "Means any individual engaging with the Publisher Application."],
  ["User Data", "Means any data provided by Users to either Party (or its affiliates) in connection with an Offer."],
  ["PII", "Means any information relating to an identified or identifiable specific individual."],
  ["Profile Data", "Means demographic and other similar data provided by a User to either Party (excluding any data considered PII)."],
  ["Company Content", "Means text, information, branding, and/or other material provided by Company to Publisher for use in connection with the Service."],
  ["Company Client", "Means any individual or entity providing an Offer."],
  ["Service", "Means Company's service, which enables a User to complete an Offer."],
  ["Offer", "Means an offer from a Company Client that is made available to Users on or through the Service."],
  ["VC", "Means the virtual currency Publisher provides to Users, including, but not limited to, awards made in connection with a Transaction."],
  ["Action", "Means any User action linked to an Offer, including, but not limited to, any registration, form submission, response, or other action specified by the Company Client."],
  ["Transaction", "Means the occurrence of a User completing an Offer and taking all relevant actions and/or meeting all requirements established by the Company Client with respect to said Offer."],
  ["Exchange Rate", "Means a representation, set, if not agreed otherwise by both Parties, by the Company Client, of the amount of VC that can be obtained by a User for each U.S. Dollar payable to Publisher."],
  ["Gross Monthly Revenue", "Means the total revenue generated by Transactions during a calendar month, based solely on data recorded by the Company."],
  ["Payout", "Means the Gross Monthly Revenue paid by the Company to the Publisher, in accordance with the terms of this Agreement, derived from the accumulated number of Transactions and according to the Exchange Rate."],
  ["Fraudulent Activity", "Means any activity, including, but not limited to, the use of any spyware, proxy servers, program, robot, redirects, or any automated and/or artificial and/or fraudulent methods designed to appear like an individual, real-life person performing a payout-generating event."],
  ["Dashboard", "Means an online element of the Service that enables managing and monitoring aspects of the Service, including, but not limited to, real-time daily aggregating and reporting of transactions and support tools."]
];

export default Users;
