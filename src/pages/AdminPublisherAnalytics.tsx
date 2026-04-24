import React, { useState, useEffect } from "react";
import { Search, Filter, ChevronDown, Globe, Activity, ShieldAlert, Award, TrendingUp, BarChart2, Users as UsersIcon, Loader2, ChevronRight, AlertTriangle, CheckCircle, XCircle, Clock, Eye, TrendingDown, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/services/apiConfig";
import { EmailDialog } from "@/components/EmailDialog";
import { BulkEmailDialog } from "@/components/BulkEmailDialog";

interface User {
  _id: string;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  level?: string;
  account_status: string;
}

interface UserStats {
  total_clicks: number;
  offers_requested: number;
  approved_offers: any[];
  rejected_offers: any[];
  approved_count: number;
  rejected_count: number;
  suspicious: boolean;
  conversions: number;
  top_vertical: string;
  top_geos: any[];
  logins_7d: number;
  offers_viewed: number;
  avg_time_spent: string;
  total_time_spent_seconds?: number;
  approval_rate: number;
}

interface ExpandedData {
  admin_notes?: any[];
  top_viewed_offers?: any[];
  search_keywords?: string[];
}

interface LevelEligibility {
  eligible: boolean;
  current_level: string;
  next_level: string;
  reason: string;
  criteria_met: Record<string, boolean>;
  is_correction?: boolean;
}

const AdminPublisherAnalytics = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [userStats, setUserStats] = useState<Record<string, UserStats>>({});
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<string>("");
  const [showLevelFilter, setShowLevelFilter] = useState(false);
  const [selectedActivityFilter, setSelectedActivityFilter] = useState<string>("");
  const [showActivityFilter, setShowActivityFilter] = useState(false);
  const [sortColumn, setSortColumn] = useState<string>("username");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [expandedData, setExpandedData] = useState<Record<string, ExpandedData>>({});
  const [expandLoading, setExpandLoading] = useState<Record<string, boolean>>({});
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedPublisher, setSelectedPublisher] = useState<{id: string, name: string, email: string} | null>(null);
  const [selectedPublisherIds, setSelectedPublisherIds] = useState<Set<string>>(new Set());
  const [bulkEmailDialogOpen, setBulkEmailDialogOpen] = useState(false);
  const [levelEligibility, setLevelEligibility] = useState<Record<string, LevelEligibility>>({});
  const [upgradeLoading, setUpgradeLoading] = useState<Record<string, boolean>>({});
  const [showEmailLogs, setShowEmailLogs] = useState(false);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [emailLogsLoading, setEmailLogsLoading] = useState(false);
  const [levelDistributionData, setLevelDistributionData] = useState<any[]>([]);
  const { toast } = useToast();

  const levelDefinitions = [
    { value: "L1", label: "L1 — Signed up, no engagement", description: "No offers viewed yet" },
    { value: "L2", label: "L2 — Browsed offers", description: "Viewed offers but no action" },
    { value: "L3", label: "L3 — Active account", description: "Has login activity" },
    { value: "L4", label: "L4 — Requested offers", description: "Requested at least one offer" },
    { value: "L5", label: "L5 — Approved with conversions", description: "Has approved offers and conversions" },
    { value: "L6", label: "L6 — Suspicious activity", description: "Flagged for review" },
    { value: "L7", label: "L7 — Genuine, no conversion", description: "Approved offers but no conversions yet" },
  ];

  const activityFilters = [
    { value: "clicks", label: "Clicks", description: "Sort by total clicks" },
    { value: "requested", label: "Requested", description: "Sort by offers requested" },
    { value: "approved", label: "Approved", description: "Sort by approved offers" },
    { value: "rejected", label: "Rejected", description: "Sort by rejected offers" },
    { value: "suspicious", label: "Suspicious", description: "Show flagged users" },
    { value: "conversions", label: "Conversions", description: "Sort by conversions" },
    { value: "time_spent", label: "Time Spent", description: "Sort by total time spent" },
  ];

  const [loadingAllStats, setLoadingAllStats] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchLevelDistribution();
  }, []);

  // Auto-load stats for first 20 users on page load
  useEffect(() => {
    if (users.length > 0 && Object.keys(userStats).length === 0) {
      loadBulkStats(users.map(u => u._id));
    }
  }, [users]);

  const loadBulkStats = async (userIds: string[]) => {
    const token = localStorage.getItem('token');
    try {
      console.log(`[BULK_STATS] Loading stats for ${userIds.length} users in ONE call`);
      const response = await fetch(`${API_BASE_URL}/api/admin/users/bulk-stats`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_ids: userIds })
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`[BULK_STATS] Received stats for ${Object.keys(data.stats).length} users`);
        
        // Merge with existing stats
        setUserStats(prev => ({
          ...prev,
          ...Object.entries(data.stats).reduce((acc, [userId, stats]: [string, any]) => {
            acc[userId] = {
              total_clicks: stats.total_clicks || 0,
              offers_requested: stats.offers_requested || 0,
              approved_offers: [],
              rejected_offers: [],
              approved_count: 0,
              rejected_count: 0,
              suspicious: stats.suspicious || false,
              conversions: stats.conversions || 0,
              top_vertical: stats.top_vertical || 'N/A',
              top_geos: stats.top_geos || [],
              logins_7d: stats.logins_7d || 0,
              offers_viewed: stats.offers_viewed || 0,
              avg_time_spent: stats.avg_time_spent || '0s',
              total_time_spent_seconds: stats.total_time_spent_seconds || 0,
              approval_rate: 0
            };
            return acc;
          }, {} as Record<string, UserStats>)
        }));

        // Now fetch offers data for each user (approved/rejected counts)
        for (const userId of userIds) {
          fetchUserOffers(userId);
        }
      }
    } catch (err) {
      console.error('[BULK_STATS] Error:', err);
    }
  };

  const fetchUserOffers = async (userId: string) => {
    const token = localStorage.getItem('token');
    try {
      const offersRes = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/offers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const offersData = await offersRes.json();

      if (offersRes.ok) {
        const approvedCount = offersData.approved_offers?.length || 0;
        const rejectedCount = offersData.rejected_offers?.length || 0;
        const requestedCount = userStats[userId]?.offers_requested || 0;
        const approvalRate = requestedCount > 0 ? Math.round((approvedCount / requestedCount) * 100) : 0;

        setUserStats(prev => ({
          ...prev,
          [userId]: {
            ...prev[userId],
            approved_offers: offersData.approved_offers || [],
            rejected_offers: offersData.rejected_offers || [],
            approved_count: approvedCount,
            rejected_count: rejectedCount,
            approval_rate: approvalRate
          }
        }));
      }
    } catch (err) {
      console.error(`Error fetching offers for ${userId}:`, err);
    }
  };

  const loadAllStatsInBatches = async () => {
    setLoadingAllStats(true);
    
    try {
      // Load all users' stats in ONE bulk call
      await loadBulkStats(users.map(u => u._id));
      
      toast({ title: "Stats Loaded", description: `Loaded stats for ${users.length} publishers`, variant: "default" });
    } finally {
      setLoadingAllStats(false);
    }
  };

  // Don't check level eligibility automatically - too slow!
  // Only check when user clicks "Check Levels" button

  const fetchLevelDistribution = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/publishers/level-distribution`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setLevelDistributionData(data.distribution || []);
      }
    } catch (err) {
      console.error('Error fetching level distribution:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/auth/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch users');

      const data = await response.json();
      const approvedUsers = (data.users || []).filter((u: User) => u.account_status === 'approved');
      setUsers(approvedUsers);
      
      // Don't auto-load stats - let user click button
      // This makes initial page load much faster
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({ title: "Error", description: "Failed to fetch users", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const checkLevelEligibility = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No auth token found');
      return;
    }
    
    if (users.length === 0) {
      console.log('No users to check');
      return;
    }
    
    try {
      console.log('🔍 Checking level eligibility for', users.length, 'users');
      console.log('User IDs:', users.map(u => u._id));
      console.log('API URL:', `${API_BASE_URL}/api/admin/publishers/level-check`);
      
      const response = await fetch(`${API_BASE_URL}/api/admin/publishers/level-check`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ publisher_ids: users.map(u => u._id) })
      });

      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Level eligibility response:', data);
        
        const eligibilityMap: Record<string, LevelEligibility> = {};
        data.results.forEach((result: any) => {
          console.log(`📊 Publisher ${result.username} (${result.current_level}):`, {
            eligible: result.eligible,
            next_level: result.next_level,
            reason: result.reason,
            debug: result.debug
          });
          eligibilityMap[result.publisher_id] = result;
        });
        
        console.log('📊 Eligibility map:', eligibilityMap);
        const eligibleCount = Object.values(eligibilityMap).filter(e => e.eligible).length;
        console.log(`🎯 ${eligibleCount} publishers eligible for upgrade`);
        
        setLevelEligibility(eligibilityMap);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Level check failed:', response.status, errorData);
        toast({
          title: "Level Check Failed",
          description: errorData.error || `HTTP ${response.status}`,
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error('❌ Error checking level eligibility:', err);
      toast({
        title: "Error",
        description: "Failed to check level eligibility",
        variant: "destructive"
      });
    }
  };

  const handleBulkLevelUpgrade = async () => {
    console.log('🚀 Bulk upgrade clicked');
    console.log('Level eligibility:', levelEligibility);
    
    const eligibleUsers = Object.entries(levelEligibility)
      .filter(([_, eligibility]) => eligibility.eligible)
      .map(([userId, _]) => userId);
    
    console.log('Eligible users:', eligibleUsers);
    
    if (eligibleUsers.length === 0) {
      toast({ 
        title: "No Upgrades", 
        description: "No publishers eligible for upgrade",
        variant: "default"
      });
      return;
    }

    const token = localStorage.getItem('token');
    let successCount = 0;
    let failCount = 0;

    toast({ 
      title: "Bulk Upgrade Started", 
      description: `Updating ${eligibleUsers.length} publishers...`,
      variant: "default"
    });

    for (const userId of eligibleUsers) {
      try {
        const eligibility = levelEligibility[userId];
        const targetLevel = eligibility?.next_level;
        
        console.log(`Upgrading ${userId} to ${targetLevel}`);
        
        if (!targetLevel) {
          console.log(`Skipping ${userId} - no target level`);
          continue;
        }
        
        const response = await fetch(`${API_BASE_URL}/api/admin/publishers/${userId}/upgrade-level`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ new_level: targetLevel })
        });

        if (response.ok) {
          successCount++;
          console.log(`✓ Upgraded ${userId}`);
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error(`✗ Failed to upgrade ${userId}:`, errorData);
          failCount++;
        }
      } catch (err) {
        console.error(`Error upgrading user ${userId}:`, err);
        failCount++;
      }
    }

    console.log(`Bulk upgrade complete: ${successCount} success, ${failCount} failed`);

    toast({ 
      title: "Bulk Upgrade Complete", 
      description: `✓ ${successCount} upgraded${failCount > 0 ? `, ✗ ${failCount} failed` : ''}`,
      variant: successCount > 0 ? "default" : "destructive"
    });

    // Refresh data
    await fetchUsers();
    await fetchLevelDistribution();
    await checkLevelEligibility();
  };

  const handleLevelUpgrade = async (userId: string) => {
    setUpgradeLoading(prev => ({ ...prev, [userId]: true }));
    const token = localStorage.getItem('token');
    
    try {
      const eligibility = levelEligibility[userId];
      const targetLevel = eligibility?.next_level;
      
      if (!targetLevel) {
        toast({ 
          title: "Error", 
          description: "No target level found",
          variant: "destructive"
        });
        return;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/admin/publishers/${userId}/upgrade-level`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ new_level: targetLevel })
      });

      const data = await response.json();
      
      if (response.ok) {
        toast({ 
          title: eligibility.is_correction ? "Level Corrected" : "Level Upgraded", 
          description: `Publisher ${eligibility.is_correction ? 'corrected' : 'upgraded'} to ${data.new_level}`,
          variant: "default"
        });
        
        // Refresh user data
        await fetchUsers();
        await fetchLevelDistribution();
        await checkLevelEligibility();
      } else {
        toast({ 
          title: "Upgrade Failed", 
          description: data.error || "Failed to upgrade level",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error('Error upgrading level:', err);
      toast({ 
        title: "Error", 
        description: "Failed to upgrade level",
        variant: "destructive"
      });
    } finally {
      setUpgradeLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  const fetchUserStats = async (userId: string) => {
    // This is now only used when expanding individual rows
    // Bulk loading uses loadBulkStats instead
    setStatsLoading(prev => ({ ...prev, [userId]: true }));
    const token = localStorage.getItem('token');
    try {
      // Fetch profile stats
      const statsRes = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/profile-stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const statsData = await statsRes.json();

      // Fetch user offers
      const offersRes = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/offers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const offersData = await offersRes.json();

      if (statsRes.ok && offersRes.ok) {
        const stats = statsData.stats || {};
        const approvedCount = offersData.approved_offers?.length || 0;
        const rejectedCount = offersData.rejected_offers?.length || 0;
        const requestedCount = stats.offers_requested || 0;
        const approvalRate = requestedCount > 0 ? Math.round((approvedCount / requestedCount) * 100) : 0;

        setUserStats(prev => ({
          ...prev,
          [userId]: {
            total_clicks: stats.total_clicks || 0,
            offers_requested: requestedCount,
            approved_offers: offersData.approved_offers || [],
            rejected_offers: offersData.rejected_offers || [],
            approved_count: approvedCount,
            rejected_count: rejectedCount,
            suspicious: stats.suspicious || false,
            conversions: stats.conversions || 0,
            top_vertical: stats.top_vertical || 'N/A',
            top_geos: stats.top_geos || [],
            logins_7d: stats.logins_7d || 0,
            offers_viewed: stats.offers_viewed || 0,
            avg_time_spent: stats.avg_time_spent || '0s',
            total_time_spent_seconds: stats.total_time_spent_seconds || 0,
            approval_rate: approvalRate
          }
        }));
      }
    } catch (err) {
      console.error(`[STATS] Error for user ${userId}:`, err);
    } finally {
      setStatsLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  const getStatValue = (user: User, column: string): number => {
    const stats = userStats[user._id];
    if (!stats) return Number.NEGATIVE_INFINITY;

    switch (column) {
      case 'clicks':
        return stats.total_clicks;
      case 'requested':
        return stats.offers_requested;
      case 'approved':
        return stats.approved_count || 0;
      case 'rejected':
        return stats.rejected_count || 0;
      case 'suspicious':
        return stats.suspicious ? 1 : 0;
      case 'conversions':
        return stats.conversions;
      case 'approval_rate':
        return stats.approval_rate;
      case 'time_spent':
        return stats.total_time_spent_seconds || 0;
      default:
        return Number.NEGATIVE_INFINITY;
    }
  };

  const handleSort = (column: string) => {
    setSortColumn(column);
    setSortOrder('desc'); // Always sort descending when clicking
  };

  // Helper function to calculate correct level based on actual stats
  const calculateCorrectLevel = (userId: string): string => {
    const stats = userStats[userId];
    if (!stats) return 'L1'; // Default if no stats loaded yet
    
    const offers_viewed = stats.total_clicks || 0;
    const offers_requested = stats.offers_requested || 0;
    const approved_count = stats.approved_count || 0;
    const suspicious = stats.suspicious || false;
    const conversions = stats.conversions || 0;
    const logins_7d = stats.logins_7d || 0;
    
    // L6: Suspicious activity (highest priority)
    if (suspicious) return 'L6';
    
    // L7: Approved offers + NO conversions + NOT suspicious
    if (approved_count > 0 && conversions === 0 && !suspicious) return 'L7';
    
    // L5: Approved offers + HAS conversions
    if (approved_count > 0 && conversions > 0) return 'L5';
    
    // L4: Requested offers (none approved yet)
    if (offers_requested > 0) return 'L4';
    
    // L3: Login activity in last 7 days
    if (logins_7d > 0) return 'L3';
    
    // L2: Viewed offers
    if (offers_viewed > 0) return 'L2';
    
    // L1: No engagement
    return 'L1';
  };

  const filteredUsers = users.filter(user => {
    const name = `${user.first_name || ''} ${user.last_name || ''} ${user.username}`.toLowerCase();
    const matchesSearch = name.includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Calculate correct level based on actual stats
    const correctLevel = calculateCorrectLevel(user._id);
    const matchesLevel = !selectedLevel || correctLevel === selectedLevel;
    
    if (selectedActivityFilter) {
      const stats = userStats[user._id];
      if (!stats) return false;
      
      switch (selectedActivityFilter) {
        case 'suspicious':
          return matchesSearch && matchesLevel && stats.suspicious;
        default:
          return matchesSearch && matchesLevel;
      }
    }
    
    return matchesSearch && matchesLevel;
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    // Sort by username alphabetically by default
    if (sortColumn === 'username') {
      const aName = `${a.first_name || ''} ${a.last_name || ''} ${a.username}`.toLowerCase();
      const bName = `${b.first_name || ''} ${b.last_name || ''} ${b.username}`.toLowerCase();
      return aName.localeCompare(bName);
    }
    
    // Sort by stats
    const aValue = getStatValue(a, sortColumn);
    const bValue = getStatValue(b, sortColumn);
    return bValue - aValue; // Always descending for stats
  });

  const getSortIcon = (column: string) => {
    if (sortColumn !== column) return null;
    return <Filter className="w-4 h-4 ml-1 text-blue-600" />;
  };

  const toggleExpandRow = async (userId: string) => {
    const newExpanded = new Set(expandedRows);
    
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
      setExpandedRows(newExpanded);
    } else {
      newExpanded.add(userId);
      setExpandedRows(newExpanded);
      
      // Fetch stats when expanding (if not already loaded)
      if (!userStats[userId]) {
        await fetchUserStats(userId);
      }
      
      // Fetch expanded data if not already loaded
      if (!expandedData[userId]) {
        await fetchExpandedData(userId);
      }
    }
  };

  const fetchExpandedData = async (userId: string) => {
    setExpandLoading(prev => ({ ...prev, [userId]: true }));
    const token = localStorage.getItem('token');
    
    try {
      // Fetch admin notes
      const notesRes = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/notes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const notesData = notesRes.ok ? await notesRes.json() : { notes: [] };

      // Fetch user offers (includes top_viewed_offers and search_keywords)
      const offersRes = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/offers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const offersData = offersRes.ok ? await offersRes.json() : {};

      console.log('Expanded data for user:', userId, offersData);

      setExpandedData(prev => ({
        ...prev,
        [userId]: {
          admin_notes: notesData.notes || [],
          top_viewed_offers: offersData.top_viewed_offers || [],
          search_keywords: offersData.search_keywords || []
        }
      }));
    } catch (err) {
      console.error(`Error fetching expanded data for user ${userId}:`, err);
    } finally {
      setExpandLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleSendEmail = (user: User) => {
    const name = user.first_name && user.last_name 
      ? `${user.first_name} ${user.last_name}` 
      : user.username;
    
    setSelectedPublisher({
      id: user._id,
      name: name,
      email: user.email
    });
    setEmailDialogOpen(true);
  };

  const toggleSelectPublisher = (userId: string) => {
    setSelectedPublisherIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedPublisherIds.size === sortedUsers.length) {
      setSelectedPublisherIds(new Set());
    } else {
      setSelectedPublisherIds(new Set(sortedUsers.map(u => u._id)));
    }
  };

  const handleBulkEmail = () => {
    const selectedPubs = sortedUsers
      .filter(u => selectedPublisherIds.has(u._id))
      .map(u => ({
        id: u._id,
        name: u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username,
        email: u.email,
        level: u.level,
        geo: userStats[u._id]?.top_geos?.[0]?.country,
        vertical: userStats[u._id]?.top_vertical
      }));
    
    setBulkEmailDialogOpen(true);
  };

  const getLevelNumber = (level: string): number => {
    return parseInt(level.replace('L', '')) || 1;
  };

  const eligibleCount = Object.values(levelEligibility).filter(e => e.eligible).length;
  
  // Calculate level distribution based on ACTUAL calculated levels (not database levels)
  const levelDistribution = users.reduce((acc, user) => {
    const correctLevel = calculateCorrectLevel(user._id);
    acc[correctLevel] = (acc[correctLevel] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const fetchEmailLogs = async () => {
    setEmailLogsLoading(true);
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/publishers/email-logs?limit=50`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setEmailLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Error fetching email logs:', err);
    } finally {
      setEmailLogsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner - Upgrade Eligible Publishers */}
      {eligibleCount > 0 && (
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-xl shadow-lg p-5 text-white animate-in slide-in-from-top-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                <TrendingUp className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{eligibleCount} Publisher{eligibleCount !== 1 ? 's' : ''} Need Level Updates</h2>
                <p className="text-white/90 text-sm">Includes level corrections and natural progressions</p>
              </div>
            </div>
            <Button
              onClick={() => {
                console.log('Button clicked!');
                handleBulkLevelUpgrade();
              }}
              className="bg-white text-purple-700 hover:bg-white/90 text-lg px-6 py-6 font-bold shadow-xl"
            >
              <Award className="w-5 h-5 mr-2" />
              {eligibleCount} Ready - Update All
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Publisher Analytics</h1>
          <p className="text-muted-foreground">Comprehensive publisher performance metrics and insights</p>
          <div className="flex gap-2 mt-2">
            {levelDistributionData.length > 0 ? (
              levelDistributionData.map(levelData => {
                const hasUpgrades = levelData.recent_upgrades > 0;
                const hasDowngrades = levelData.recent_downgrades > 0;
                const netChange = levelData.net_change;
                
                return (
                  <Badge 
                    key={levelData.level} 
                    variant="outline" 
                    className={`text-xs flex items-center gap-1 ${
                      hasUpgrades ? 'bg-green-50 border-green-300 text-green-700' : 
                      hasDowngrades ? 'bg-red-50 border-red-300 text-red-700' : ''
                    }`}
                  >
                    {levelData.level}: {levelData.count}
                    {hasUpgrades && netChange > 0 && (
                      <span className="text-green-600 font-bold">↑{netChange}</span>
                    )}
                    {hasDowngrades && netChange < 0 && (
                      <span className="text-red-600 font-bold">↓{Math.abs(netChange)}</span>
                    )}
                  </Badge>
                );
              })
            ) : (
              ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'].map(level => (
                <Badge key={level} variant="outline" className="text-xs">
                  {level}: {levelDistribution[level] || 0}
                </Badge>
              ))
            )}
            {loadingAllStats && (
              <Badge className="bg-blue-600 text-white animate-pulse">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Loading stats...
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              await loadAllStatsInBatches();
            }}
            className="gap-2"
            disabled={loadingAllStats}
          >
            {loadingAllStats ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <BarChart2 className="w-4 h-4" />
                Load All Stats
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              checkLevelEligibility();
              toast({ title: "Checking Levels", description: "Analyzing all publishers...", variant: "default" });
            }}
            className="gap-2"
          >
            <TrendingUp className="w-4 h-4" />
            Check Levels
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setShowEmailLogs(!showEmailLogs);
              if (!showEmailLogs && emailLogs.length === 0) {
                fetchEmailLogs();
              }
            }}
            className="gap-2"
          >
            <Mail className="w-4 h-4" />
            {showEmailLogs ? 'Hide' : 'View'} Email History
          </Button>
        </div>
      </div>

      {/* Email Logs Panel */}
      {showEmailLogs && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Email History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {emailLogsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : emailLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No emails sent yet</div>
            ) : (
              <div className="space-y-3">
                {emailLogs.map((log, idx) => (
                  <div key={idx} className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="bg-blue-600 text-white">
                            {log.offers_count} offers
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {new Date(log.sent_at).toLocaleString()}
                          </span>
                        </div>
                        <h4 className="font-semibold text-gray-900 mb-1">{log.subject}</h4>
                        <p className="text-sm text-gray-600 mb-2">To: {log.to_name} ({log.to_email})</p>
                        <p className="text-xs text-gray-500 line-clamp-2">{log.message}</p>
                        {log.offer_types && log.offer_types.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {log.offer_types.map((type: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {type.replace('_', ' ')}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <Badge className="bg-green-100 text-green-800 border-green-300">
                        ✓ Sent
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Publisher Performance Table</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center flex-wrap mb-6">
            <div className="flex-1 relative min-w-[200px]">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search publishers..."
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
                {selectedLevel ? `Level ${selectedLevel}` : 'All Levels'}
                <ChevronDown className="h-3 w-3" />
              </Button>
              {showLevelFilter && (
                <div className="absolute top-full mt-2 right-0 bg-white border border-border rounded-lg shadow-lg p-2 z-50 min-w-[300px]">
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
                      className={`w-full text-left px-3 py-2 rounded hover:bg-muted text-sm ${
                        selectedLevel === level.value ? 'bg-blue-50 text-blue-700 font-semibold' : ''
                      }`}
                    >
                      {level.label}
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
                {selectedActivityFilter ? activityFilters.find(f => f.value === selectedActivityFilter)?.label : 'Activity Filter'}
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
                  {activityFilters.map((filter) => (
                    <button
                      key={filter.value}
                      onClick={() => { 
                        setSelectedActivityFilter(filter.value); 
                        setSortColumn(filter.value);
                        setShowActivityFilter(false); 
                      }}
                      className={`w-full text-left px-3 py-2 rounded hover:bg-muted text-sm ${
                        selectedActivityFilter === filter.value ? 'bg-purple-50 text-purple-700 font-semibold' : ''
                      }`}
                    >
                      <div className="font-semibold">{filter.label}</div>
                      <div className="text-xs text-muted-foreground">{filter.description}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : sortedUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No publishers found</div>
          ) : (
            <>
              {/* Floating Bulk Email Button */}
              {selectedPublisherIds.size > 0 && (
                <div className="fixed bottom-8 right-8 z-50 animate-in slide-in-from-bottom-5">
                  <Button
                    onClick={handleBulkEmail}
                    size="lg"
                    className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white shadow-2xl px-6 py-6 text-lg font-semibold"
                  >
                    <Mail className="w-5 h-5 mr-2" />
                    📧 Send Offers to {selectedPublisherIds.size} Selected Publisher{selectedPublisherIds.size !== 1 ? 's' : ''}
                  </Button>
                </div>
              )}

              <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedPublisherIds.size === sortedUsers.length && sortedUsers.length > 0}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all publishers"
                      />
                    </TableHead>
                    <TableHead className="whitespace-nowrap">Publisher</TableHead>
                    <TableHead className="whitespace-nowrap">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleSort('clicks')}
                        className={`h-8 px-2 ${sortColumn === 'clicks' ? 'bg-blue-50 text-blue-700' : ''}`}
                      >
                        Clicks {getSortIcon('clicks')}
                      </Button>
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleSort('requested')}
                        className={`h-8 px-2 ${sortColumn === 'requested' ? 'bg-blue-50 text-blue-700' : ''}`}
                      >
                        Requested {getSortIcon('requested')}
                      </Button>
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleSort('approved')}
                        className={`h-8 px-2 ${sortColumn === 'approved' ? 'bg-blue-50 text-blue-700' : ''}`}
                      >
                        Approved {getSortIcon('approved')}
                      </Button>
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleSort('rejected')}
                        className={`h-8 px-2 ${sortColumn === 'rejected' ? 'bg-blue-50 text-blue-700' : ''}`}
                      >
                        Rejected {getSortIcon('rejected')}
                      </Button>
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleSort('suspicious')}
                        className={`h-8 px-2 ${sortColumn === 'suspicious' ? 'bg-blue-50 text-blue-700' : ''}`}
                      >
                        Suspicious {getSortIcon('suspicious')}
                      </Button>
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleSort('conversions')}
                        className={`h-8 px-2 ${sortColumn === 'conversions' ? 'bg-blue-50 text-blue-700' : ''}`}
                      >
                        Conversions {getSortIcon('conversions')}
                      </Button>
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleSort('time_spent')}
                        className={`h-8 px-2 ${sortColumn === 'time_spent' ? 'bg-blue-50 text-blue-700' : ''}`}
                      >
                        Time Spent {getSortIcon('time_spent')}
                      </Button>
                    </TableHead>
                    <TableHead className="whitespace-nowrap">Vertical</TableHead>
                    <TableHead className="whitespace-nowrap">Geo</TableHead>
                    <TableHead className="whitespace-nowrap">Level</TableHead>
                    <TableHead className="whitespace-nowrap">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleSort('approval_rate')}
                        className={`h-8 px-2 ${sortColumn === 'approval_rate' ? 'bg-blue-50 text-blue-700' : ''}`}
                      >
                        Approval Rate {getSortIcon('approval_rate')}
                      </Button>
                    </TableHead>
                    <TableHead className="whitespace-nowrap">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedUsers.map((user) => {
                    const stats = userStats[user._id];
                    const isLoading = statsLoading[user._id];
                    const isExpanded = expandedRows.has(user._id);
                    const expanded = expandedData[user._id];
                    const isExpandLoading = expandLoading[user._id];
                    const eligibility = levelEligibility[user._id];
                    const isEligible = eligibility?.eligible || false;
                    const currentLevelNum = getLevelNumber(user.level || 'L1');
                    const isUpgrading = upgradeLoading[user._id];

                    // Stats are fetched automatically after users load.
                    // Rows show a neutral placeholder until real data arrives.

                    return (
                      <React.Fragment key={user._id}>
                      <TableRow className={`cursor-pointer hover:bg-muted/50 transition-all ${
                        isEligible ? 'bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 border-l-4 border-l-purple-600' : ''
                      }`}>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedPublisherIds.has(user._id)}
                            onCheckedChange={() => toggleSelectPublisher(user._id)}
                            aria-label={`Select ${user.username}`}
                          />
                        </TableCell>
                        <TableCell onClick={() => toggleExpandRow(user._id)}>
                          <div className="flex items-center gap-2">
                            {isExpanded ? 
                              <ChevronDown className="w-4 h-4 text-blue-600" /> : 
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            }
                            <div>
                              <p className="font-medium">
                                {user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.username}
                              </p>
                              <p className="text-xs text-muted-foreground">@{user.username}</p>
                              {user.company_name && <p className="text-xs text-muted-foreground">{user.company_name}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell onClick={() => toggleExpandRow(user._id)}>
                          {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : stats ? (
                            <span className="font-semibold">{stats.total_clicks.toLocaleString()}</span>
                          ) : loadingAllStats ? (
                            <span className="text-muted-foreground">Loading...</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell onClick={() => toggleExpandRow(user._id)}>
                          {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : stats ? (
                            <span className="font-semibold">{stats.offers_requested}</span>
                          ) : loadingAllStats ? (
                            <span className="text-muted-foreground">Loading...</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell onClick={() => toggleExpandRow(user._id)}>
                          {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : stats ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                              {stats.approved_count}
                            </Badge>
                          ) : loadingAllStats ? (
                            <span className="text-muted-foreground">Loading...</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell onClick={() => toggleExpandRow(user._id)}>
                          {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : stats ? (
                            <Badge variant="destructive">
                              {stats.rejected_count}
                            </Badge>
                          ) : loadingAllStats ? (
                            <span className="text-muted-foreground">Loading...</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell onClick={() => toggleExpandRow(user._id)}>
                          {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : stats ? (
                            stats.suspicious ? (
                              <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                                <ShieldAlert className="w-3 h-3 mr-1" />
                                YES
                              </Badge>
                            ) : (
                              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                                <Award className="w-3 h-3 mr-1" />
                                NO
                              </Badge>
                            )
                          ) : loadingAllStats ? (
                            <span className="text-muted-foreground">Loading...</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell onClick={() => toggleExpandRow(user._id)}>
                          {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : stats ? (
                            <span className="font-semibold">{stats.conversions}</span>
                          ) : loadingAllStats ? (
                            <span className="text-muted-foreground">Loading...</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell onClick={() => toggleExpandRow(user._id)}>
                          {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : stats ? (
                            <span className="text-sm font-medium text-amber-700">{stats.avg_time_spent}</span>
                          ) : loadingAllStats ? (
                            <span className="text-muted-foreground">Loading...</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell onClick={() => toggleExpandRow(user._id)}>
                          {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : stats ? (
                            <span className="text-sm">{stats.top_vertical}</span>
                          ) : loadingAllStats ? (
                            <span className="text-muted-foreground">Loading...</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell onClick={() => toggleExpandRow(user._id)}>
                          {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : stats && stats.top_geos && stats.top_geos.length > 0 ? (
                            <div className="flex items-center gap-1">
                              <Globe className="w-3 h-3 text-blue-600" />
                              <span className="text-sm font-medium">{stats.top_geos[0].country}</span>
                            </div>
                          ) : loadingAllStats ? (
                            <span className="text-sm text-muted-foreground">Loading...</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell onClick={() => toggleExpandRow(user._id)}>
                          {isEligible ? (
                            <div className="flex items-center gap-2">
                              <Badge className="bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0 font-bold animate-pulse">
                                <UsersIcon className="w-3 h-3 mr-1" />
                                {eligibility.current_level}
                              </Badge>
                              <ChevronRight className="w-4 h-4 text-purple-600 animate-bounce" />
                              <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 font-bold">
                                {eligibility.next_level}
                              </Badge>
                            </div>
                          ) : (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-semibold">
                              <UsersIcon className="w-3 h-3 mr-1" />
                              {user.level || 'L1'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell onClick={() => toggleExpandRow(user._id)}>
                          {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : stats ? (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden w-16">
                                <div 
                                  className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full" 
                                  style={{ width: `${stats.approval_rate}%` }}
                                ></div>
                              </div>
                              <span className="text-sm font-semibold">{stats.approval_rate}%</span>
                            </div>
                          ) : loadingAllStats ? (
                            <span className="text-muted-foreground">Loading...</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSendEmail(user);
                            }}
                            className="gap-2 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
                          >
                            <Mail className="w-4 h-4" />
                            Email
                          </Button>
                        </TableCell>
                      </TableRow>
                      
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={13} className="bg-gradient-to-br from-gray-50 to-gray-100 p-0">
                            {isExpandLoading ? (
                              <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                              </div>
                            ) : (
                              <div className="p-6 space-y-6">
                                {/* Level Progression Section */}
                                {isEligible && (
                                  <div className={`rounded-xl shadow-lg p-6 text-white ${
                                    eligibility.is_correction 
                                      ? 'bg-gradient-to-r from-orange-600 via-red-600 to-pink-600'
                                      : 'bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600'
                                  }`}>
                                    <div className="flex items-start justify-between mb-4">
                                      <div>
                                        <h3 className="text-xl font-bold mb-1 flex items-center gap-2">
                                          {eligibility.is_correction ? (
                                            <>
                                              <AlertTriangle className="w-6 h-6" />
                                              Level Correction Required
                                            </>
                                          ) : (
                                            <>
                                              <TrendingUp className="w-6 h-6" />
                                              Level Upgrade Available
                                            </>
                                          )}
                                        </h3>
                                        <p className="text-white/90 text-sm">{eligibility.reason}</p>
                                        {eligibility.is_correction && (
                                          <p className="text-white/80 text-xs mt-1">⚠️ Current level doesn't match actual activity</p>
                                        )}
                                      </div>
                                      <Button
                                        onClick={() => handleLevelUpgrade(user._id)}
                                        disabled={isUpgrading}
                                        className="bg-white text-purple-700 hover:bg-white/90 font-bold shadow-lg"
                                      >
                                        {isUpgrading ? (
                                          <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            {eligibility.is_correction ? 'Correcting...' : 'Upgrading...'}
                                          </>
                                        ) : (
                                          <>
                                            <Award className="w-4 h-4 mr-2" />
                                            {eligibility.is_correction ? 'Fix Level' : 'Confirm Upgrade'}
                                          </>
                                        )}
                                      </Button>
                                    </div>

                                    {/* 7-Step Progress Bar */}
                                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                                      <div className="flex items-center justify-between mb-3">
                                        {[1, 2, 3, 4, 5, 6, 7].map((level) => {
                                          const isCompleted = level < currentLevelNum;
                                          const isCurrent = level === currentLevelNum;
                                          const isNext = level === getLevelNumber(eligibility.next_level);
                                          
                                          return (
                                            <div key={level} className="flex-1 flex items-center">
                                              <div className="flex flex-col items-center flex-1">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                                                  isCompleted ? 'bg-green-500 text-white' :
                                                  isCurrent ? 'bg-white text-purple-700 ring-4 ring-white/50 scale-110' :
                                                  isNext ? 'bg-yellow-400 text-purple-900 ring-4 ring-yellow-400/50 animate-pulse' :
                                                  'bg-white/20 text-white/60'
                                                }`}>
                                                  {isCompleted ? <CheckCircle className="w-5 h-5" /> : `L${level}`}
                                                </div>
                                                <span className={`text-xs mt-1 font-semibold ${
                                                  isCurrent || isNext ? 'text-white' : 'text-white/60'
                                                }`}>
                                                  {level === 1 ? 'Signed Up' :
                                                   level === 2 ? 'Browsed' :
                                                   level === 3 ? 'Active' :
                                                   level === 4 ? 'Requested' :
                                                   level === 5 ? 'Approved' :
                                                   level === 6 ? 'Suspicious' :
                                                   'Genuine'}
                                                </span>
                                              </div>
                                              {level < 7 && (
                                                <div className={`h-1 flex-1 mx-1 rounded transition-all ${
                                                  level < currentLevelNum ? 'bg-green-500' :
                                                  level === currentLevelNum ? 'bg-gradient-to-r from-white to-yellow-400 animate-pulse' :
                                                  'bg-white/20'
                                                }`} />
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>

                                      {/* Level Journey Details */}
                                      <div className="grid grid-cols-7 gap-2 mt-4">
                                        {[
                                          { level: 'L1', desc: 'Signed up, no engagement' },
                                          { level: 'L2', desc: 'Browsed offers' },
                                          { level: 'L3', desc: 'Active account' },
                                          { level: 'L4', desc: 'Requested offers' },
                                          { level: 'L5', desc: 'Approved + conversions' },
                                          { level: 'L6', desc: 'Suspicious activity' },
                                          { level: 'L7', desc: 'Genuine, no conversion' }
                                        ].map((item, idx) => {
                                          const levelNum = idx + 1;
                                          const isCompleted = levelNum < currentLevelNum;
                                          const isCurrent = levelNum === currentLevelNum;
                                          const isNext = item.level === eligibility.next_level;
                                          
                                          return (
                                            <div key={item.level} className={`rounded-lg p-2 text-xs transition-all ${
                                              isCompleted ? 'bg-green-500/20 border border-green-400' :
                                              isCurrent ? 'bg-white/30 border-2 border-white' :
                                              isNext ? 'bg-yellow-400/30 border-2 border-yellow-400 animate-pulse' :
                                              'bg-white/10 border border-white/20'
                                            }`}>
                                              <div className="font-bold mb-1">{item.level}</div>
                                              <div className={`text-[10px] leading-tight ${
                                                isCurrent || isNext ? 'text-white' : 'text-white/70'
                                              }`}>
                                                {item.desc}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>

                                      {/* Criteria Met */}
                                      {eligibility.criteria_met && Object.keys(eligibility.criteria_met).length > 0 && (
                                        <div className="mt-4 grid grid-cols-2 gap-2">
                                          {Object.entries(eligibility.criteria_met).map(([key, met]) => (
                                            <div key={key} className={`flex items-center gap-2 text-xs rounded-lg p-2 ${
                                              met ? 'bg-green-500/20 text-white' : 'bg-white/10 text-white/60'
                                            }`}>
                                              {met ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                              <span className="font-medium">{key.replace(/_/g, ' ')}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Alert Banner */}
                                {stats?.suspicious && (
                                  <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 flex items-start gap-3 shadow-sm">
                                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                                    <div>
                                      <p className="font-semibold text-red-900">Flagged suspicious — do not send new offers until audit complete.</p>
                                      {expanded?.admin_notes && expanded.admin_notes.length > 0 && (
                                        <p className="text-sm text-red-700 mt-1">{expanded.admin_notes[0].note}</p>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Main Grid - 4 Columns */}
                                <div className="grid grid-cols-1 xl:grid-cols-4 gap-3">
                                  {/* Column 1: Approved Offers */}
                                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex flex-col h-[280px]">
                                    <h3 className="font-semibold text-sm text-gray-800 mb-2 flex items-center gap-2 flex-shrink-0">
                                      <CheckCircle className="w-4 h-4 text-green-600" />
                                      Approved ({stats?.approved_offers?.length || 0})
                                    </h3>
                                    {stats?.approved_offers && stats.approved_offers.length > 0 ? (
                                      <div className="space-y-1.5 overflow-y-auto flex-1 scrollbar-hide">
                                        {stats.approved_offers.map((offer: any, idx: number) => (
                                          <div key={idx} className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-md p-2 border border-green-200 hover:shadow transition-shadow">
                                            <div className="flex items-start justify-between gap-1">
                                              <span className="text-xs font-medium text-gray-800 line-clamp-1">{offer.offer_name || offer.name || offer.title || 'Unnamed Offer'}</span>
                                              <Badge className="bg-green-600 text-white text-[10px] px-1 py-0 h-4 whitespace-nowrap flex-shrink-0">
                                                {offer.match_score ? `${offer.match_score}%` : 'Active'}
                                              </Badge>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="flex-1 flex items-center justify-center text-gray-400">
                                        <div className="text-center">
                                          <CheckCircle className="w-8 h-8 mx-auto mb-1 opacity-30" />
                                          <p className="text-xs italic">No approved offers</p>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Column 2: Rejected Offers */}
                                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex flex-col h-[280px]">
                                    <h3 className="font-semibold text-sm text-gray-800 mb-2 flex items-center gap-2 flex-shrink-0">
                                      <XCircle className="w-4 h-4 text-red-600" />
                                      Rejected ({stats?.rejected_offers?.length || 0})
                                    </h3>
                                    {stats?.rejected_offers && stats.rejected_offers.length > 0 ? (
                                      <div className="space-y-1.5 overflow-y-auto flex-1 scrollbar-hide">
                                        {stats.rejected_offers.map((offer: any, idx: number) => (
                                          <div key={idx} className="bg-gradient-to-r from-red-50 to-rose-50 rounded-md p-2 border border-red-200 hover:shadow transition-shadow">
                                            <span className="text-xs font-medium text-gray-800 line-clamp-1 block mb-1">{offer.offer_name || offer.name || offer.title || 'Unnamed Offer'}</span>
                                            <p className="text-[10px] text-red-700 font-medium flex items-center gap-1">
                                              <AlertTriangle className="w-3 h-3" />
                                              {offer.rejection_reason || offer.reason || 'Suspicious pattern'}
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="flex-1 flex items-center justify-center text-gray-400">
                                        <div className="text-center">
                                          <XCircle className="w-8 h-8 mx-auto mb-1 opacity-30" />
                                          <p className="text-xs italic">No rejected offers</p>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Column 3: Publisher Signals */}
                                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex flex-col h-[280px]">
                                    <h3 className="font-semibold text-sm text-gray-800 mb-2 flex items-center gap-2 flex-shrink-0">
                                      <Activity className="w-4 h-4 text-blue-600" />
                                      Publisher Signals
                                    </h3>
                                    <div className="space-y-1.5 overflow-y-auto flex-1 scrollbar-hide">
                                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-md p-2 border border-blue-100">
                                        <p className="text-[10px] text-gray-600 mb-0.5 font-medium">Preferred geo</p>
                                        <p className="text-xs font-bold text-gray-900 flex items-center gap-1">
                                          <Globe className="w-3 h-3 text-blue-600" />
                                          {stats?.top_geos?.[0]?.country || 'N/A'}
                                        </p>
                                      </div>
                                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-md p-2 border border-purple-100">
                                        <p className="text-[10px] text-gray-600 mb-0.5 font-medium">Top vertical</p>
                                        <p className="text-xs font-bold text-gray-900">{stats?.top_vertical || 'N/A'}</p>
                                      </div>
                                      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-md p-2 border border-amber-100">
                                        <p className="text-[10px] text-gray-600 mb-0.5 font-medium">Total time spent</p>
                                        <p className="text-xs font-bold text-gray-900 flex items-center gap-1">
                                          <Clock className="w-3 h-3 text-amber-600" />
                                          {stats?.avg_time_spent || '—'}
                                        </p>
                                      </div>
                                      <div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-md p-2 border border-teal-100">
                                        <p className="text-[10px] text-gray-600 mb-0.5 font-medium">Level</p>
                                        <p className="text-xs font-bold text-gray-900 flex items-center gap-1">
                                          <UsersIcon className="w-3 h-3 text-teal-600" />
                                          {user.level || 'L1'}
                                        </p>
                                      </div>
                                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-md p-2 border border-green-100">
                                        <p className="text-[10px] text-gray-600 mb-0.5 font-medium">Offers requested</p>
                                        <p className="text-xs font-bold text-gray-900">{stats?.offers_requested || 0}</p>
                                      </div>
                                      <div className="bg-gradient-to-r from-blue-50 to-sky-50 rounded-md p-2 border border-blue-100">
                                        <p className="text-[10px] text-gray-600 mb-0.5 font-medium">Approval rate</p>
                                        <div className="flex items-center gap-1.5">
                                          <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                                            <div 
                                              className="h-full bg-gradient-to-r from-green-500 to-emerald-600 rounded-full transition-all" 
                                              style={{ width: `${stats?.approval_rate || 0}%` }}
                                            ></div>
                                          </div>
                                          <span className="text-xs font-bold text-gray-900">{stats?.approval_rate || 0}%</span>
                                        </div>
                                      </div>
                                      <div className={`rounded-md p-2 border ${stats?.suspicious ? 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200' : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'}`}>
                                        <p className="text-[10px] text-gray-600 mb-0.5 font-medium">Suspicious</p>
                                        <p className="text-xs font-bold flex items-center gap-1">
                                          {stats?.suspicious ? (
                                            <>
                                              <ShieldAlert className="w-3 h-3 text-red-600" />
                                              <span className="text-red-900">Yes — flagged</span>
                                            </>
                                          ) : (
                                            <>
                                              <Award className="w-3 h-3 text-green-600" />
                                              <span className="text-green-900">No</span>
                                            </>
                                          )}
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Column 4: Top Viewed Offers */}
                                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex flex-col h-[280px]">
                                    <div className="flex-shrink-0">
                                      <h3 className="font-semibold text-sm text-gray-800 mb-1 flex items-center gap-2">
                                        <Eye className="w-4 h-4 text-purple-600" />
                                        Top Viewed
                                      </h3>
                                      
                                      {/* Search Keywords */}
                                      {expanded?.search_keywords && expanded.search_keywords.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mb-2">
                                          {expanded.search_keywords.slice(0, 3).map((item: any, idx: number) => (
                                            <Badge key={idx} variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] px-1 py-0 h-4">
                                              {typeof item === 'string' ? item : item.term || item}
                                            </Badge>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    {expanded?.top_viewed_offers && expanded.top_viewed_offers.length > 0 ? (
                                      <div className="space-y-1.5 overflow-y-auto flex-1 scrollbar-hide">
                                        {expanded.top_viewed_offers.map((offer: any, idx: number) => (
                                          <div key={idx} className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-md p-2 border border-purple-200 hover:shadow transition-shadow">
                                            <div className="flex items-start gap-2">
                                              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-600 text-white font-bold text-[10px] flex-shrink-0">
                                                {idx + 1}
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold text-gray-800 line-clamp-1 mb-0.5">{offer.name || 'Unnamed Offer'}</p>
                                                <div className="flex items-center gap-1 text-purple-700">
                                                  <Eye className="w-3 h-3" />
                                                  <span className="text-[10px] font-bold">{offer.views || 0} views</span>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="flex-1 flex items-center justify-center text-gray-400">
                                        <div className="text-center">
                                          <Eye className="w-8 h-8 mx-auto mb-1 opacity-30" />
                                          <p className="text-xs italic">No views tracked</p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Action Footer */}
                                <div className={`rounded-xl p-5 shadow-sm border ${stats?.suspicious ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200' : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'}`}>
                                  {stats?.suspicious ? (
                                    <>
                                      <div className="flex items-center gap-2 mb-3">
                                        <AlertTriangle className="w-5 h-5 text-yellow-700" />
                                        <p className="text-sm font-semibold text-yellow-900">No matched offers to send — audit required first.</p>
                                      </div>
                                      <div className="flex gap-3">
                                        <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700 text-white shadow-sm">
                                          Audit this publisher ↗
                                        </Button>
                                        <Button size="sm" variant="outline" className="border-yellow-600 text-yellow-700 hover:bg-yellow-100">
                                          Draft compliance notice ↗
                                        </Button>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <Award className="w-5 h-5 text-green-700" />
                                      <p className="text-sm font-semibold text-green-900">Publisher is in good standing. Continue monitoring activity.</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Email Dialog */}
      {selectedPublisher && (
        <EmailDialog
          isOpen={emailDialogOpen}
          onClose={() => {
            setEmailDialogOpen(false);
            setSelectedPublisher(null);
          }}
          publisherId={selectedPublisher.id}
          publisherName={selectedPublisher.name}
          publisherEmail={selectedPublisher.email}
        />
      )}

      {/* Bulk Email Dialog */}
      <BulkEmailDialog
        isOpen={bulkEmailDialogOpen}
        onClose={() => setBulkEmailDialogOpen(false)}
        selectedPublishers={sortedUsers
          .filter(u => selectedPublisherIds.has(u._id))
          .map(u => ({
            id: u._id,
            name: u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username,
            email: u.email,
            level: u.level,
            geo: userStats[u._id]?.top_geos?.[0]?.country,
            vertical: userStats[u._id]?.top_vertical
          }))}
      />
    </div>
  );
};

export default AdminPublisherAnalytics;
