import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Edit, Trash2, BarChart3, ExternalLink, Copy, Check, 
  Settings, Globe, Activity, Zap, Layers, RefreshCw, 
  Search, Filter, ArrowRight, TrendingUp, PieChart as PieChartIcon, Users,
  AlertCircle
} from 'lucide-react';
import { getApiBaseUrl } from '@/services/apiConfig';
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger
} from '@/components/ui/tooltip';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, Cell, PieChart as RePieChart, Pie, AreaChart, Area
} from 'recharts';
import { useToast } from '@/hooks/use-toast';

interface SmartLink {
  _id: string;
  name: string;
  slug: string;
  status: string;
  publisher_id?: string;
  traffic_type?: string;
  allow_adult?: boolean;
  offer_ids?: string[];
  rotation_strategy?: string;
  fallback_url?: string;
  created_at: string;
  updated_at: string;
  total_clicks?: number;
}

interface Offer {
  offer_id: string;
  name: string;
  network?: string;
  status?: string;
  priority?: number;
  rotation_weight?: number;
}

interface Analytics {
  total_clicks: number;
  unique_visitors: number;
  total_revenue: number;
  epc: number;
  clicks_analytics: any[];
  offer_distribution: any[];
  country_distribution: any[];
}

interface ClickLog {
  _id: string;
  smart_link_id: string;
  offer_id?: string;
  offer_name?: string;
  offer_status?: string;
  country: string;
  ip: string;
  user_agent: string;
  timestamp: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'active':
    case 'approved':
    case 'running':
    case 'has_clicks':
      return 'bg-green-100 text-green-800 hover:bg-green-200';
    case 'pending':
    case 'requested':
    case 'picked':
    case 'searched':
      return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
    case 'inactive':
    case 'paused':
    case 'rejected':
      return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
  }
};

const AdminSmartLinks: React.FC = () => {
  const { toast } = useToast();
  const [smartLinks, setSmartLinks] = useState<SmartLink[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [offersLoading, setOffersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedLink, setSelectedLink] = useState<SmartLink | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [publishers, setPublishers] = useState<any[]>([]);
  const [clickLogs, setClickLogs] = useState<ClickLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchSmartLinks();
    fetchOffers();
    fetchClickLogs();
    fetchPublishers();
    fetchActivityLogs();
  }, []);

  const fetchSmartLinks = async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/admin/smart-links`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();

      if (data.success) {
        setSmartLinks(data.smart_links);
      } else {
        toast({
          title: "Error",
          description: data.error || 'Failed to fetch smart links',
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Connection Error",
        description: 'Failed to connect to the server',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchOffers = async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/admin/offers?page=1&per_page=5000&status=active`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();

      if (data.offers) {
        setOffers(data.offers.map((offer: any) => ({
          offer_id: offer.offer_id,
          name: offer.name,
          network: offer.network,
          status: offer.status,
          priority: offer.priority || 0,
          rotation_weight: offer.rotation_weight || 1.0
        })));
      }
    } catch (err) {
      console.error('Failed to fetch offers for smart links', err);
    } finally {
      setOffersLoading(false);
    }
  };

  const fetchPublishers = async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/admin/partners`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setPublishers(data.partners);
      }
    } catch (err) {
      console.error('Failed to fetch publishers', err);
    }
  };

  const fetchClickLogs = async () => {
    setLogsLoading(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/admin/smart-links/logs?limit=100`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setClickLogs(data.logs);
      }
    } catch (err) {
      console.error('Failed to fetch raw click logs', err);
    } finally {
      setLogsLoading(false);
    }
  };

  const fetchActivityLogs = async () => {
    setActivityLoading(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/admin/smart-links/activity-logs?limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setActivityLogs(data.logs);
      }
    } catch (err) {
      console.error('Failed to fetch activity logs', err);
    } finally {
      setActivityLoading(false);
    }
  };

  const handleCreateSmartLink = async (payload: any) => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/admin/smart-links`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        setSmartLinks([...smartLinks, data.smart_link]);
        setShowCreateModal(false);
        toast({ title: "Success", description: "Smart Link created successfully" });
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to create smart link", variant: "destructive" });
    }
  };

  const handleUpdateSmartLink = async (id: string, payload: any) => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/admin/smart-links/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        setSmartLinks(smartLinks.map(link =>
          link._id === id ? { ...link, ...payload, updated_at: new Date().toISOString() } : link
        ));
        setSelectedLink(null);
        toast({ title: "Success", description: "Smart Link updated successfully" });
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to update smart link", variant: "destructive" });
    }
  };

  const handleDeleteSmartLink = async (id: string) => {
    if (!confirm('Are you sure you want to delete this smart link?')) return;

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/admin/smart-links/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setSmartLinks(smartLinks.filter(link => link._id !== id));
        toast({ title: "Deleted", description: "Smart Link removed" });
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete smart link", variant: "destructive" });
    }
  };

  const fetchAnalytics = async (smartLinkId: string) => {
    setAnalyticsLoading(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/admin/smart-links/${smartLinkId}/analytics`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();

      if (data.success) {
        setAnalytics(data.analytics);
        setShowAnalytics(true);
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to fetch analytics", variant: "destructive" });
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSlug(text);
      toast({ title: "Copied!", description: "Link copied to clipboard" });
      setTimeout(() => setCopiedSlug(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getSmartLinkUrl = (slug: string) => {
    return `${window.location.origin}/smart-link/${slug}`;
  };

  const filteredLinks = useMemo(() => {
    return smartLinks.filter(link => 
      (link.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
      (link.slug?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );
  }, [smartLinks, searchTerm]);

  const stats = useMemo(() => {
    return {
      total: smartLinks.length,
      active: smartLinks.filter(l => l.status === 'active').length,
      publishers: new Set(smartLinks.filter(l => l.publisher_id).map(l => l.publisher_id)).size,
    };
  }, [smartLinks]);

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Zap className="h-8 w-8 text-blue-600 fill-blue-600/10" />
            Smart Selection Engine
          </h1>
          <p className="text-slate-500 mt-1">Manage high-performance redirection links and offer selection strategies.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search smart links..." 
              className="pl-9 w-64 bg-white border-slate-200"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button 
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 gap-2"
          >
            <Plus className="h-4 w-4" />
            New Smart Link
          </Button>
        </div>
      </div>

      <Tabs defaultValue="engine" className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-[800px] bg-slate-200/50 p-1 rounded-xl mb-8">
          <TabsTrigger value="engine" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Engine</TabsTrigger>
          <TabsTrigger value="clicks" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Direct Clicks</TabsTrigger>
          <TabsTrigger value="activity" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Activity & Audit</TabsTrigger>
          <TabsTrigger value="exclusions" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Offer Exclusions</TabsTrigger>
        </TabsList>

        <TabsContent value="engine" className="space-y-8 animate-in fade-in-50 duration-500">
          {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-none shadow-md overflow-hidden bg-white group hover:shadow-lg transition-shadow">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-slate-500">Total Smart Links</CardTitle>
              <Layers className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
              <p className="text-xs text-slate-400 mt-1">Global redirection nodes</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-none shadow-md overflow-hidden bg-white group hover:shadow-lg transition-shadow">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-slate-500">Active Links</CardTitle>
              <Activity className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{stats.active}</div>
              <p className="text-xs text-emerald-500 font-medium mt-1">{(stats.active/stats.total*100 || 0).toFixed(1)}% availability</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border-none shadow-md overflow-hidden bg-white group hover:shadow-lg transition-shadow">
            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-slate-500">Publisher Links</CardTitle>
              <Users className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{stats.publishers}</div>
              <p className="text-xs text-slate-400 mt-1">Unique publishers with custom nodes</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Main Table */}
      <Card className="border-none shadow-md bg-white">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Link Name</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Slug & URL</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Categorization</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Publisher / Owner</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Algorithm</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Offers Pool</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <AnimatePresence mode="popLayout">
                  {filteredLinks.length > 0 ? (
                    filteredLinks.map((link) => (
                      <motion.tr 
                        key={link._id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="group hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900">{link.name}</div>
                          <div className="text-xs text-slate-400 flex items-center gap-1">
                            <Zap className="h-3 w-3" /> Redirection ID: {link._id.slice(-6)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <code className="text-xs px-2 py-1 bg-slate-100 rounded text-slate-600 w-fit font-mono">
                              /{link.slug}
                            </code>
                            <div className="flex items-center gap-2">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button 
                                      onClick={() => copyToClipboard(getSmartLinkUrl(link.slug))}
                                      className="p-1.5 rounded-md hover:bg-white hover:shadow-sm text-slate-500 hover:text-blue-600 transition-all border border-transparent hover:border-slate-200"
                                    >
                                      {copiedSlug === getSmartLinkUrl(link.slug) ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>Copy Redirection URL</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <a 
                                href={getSmartLinkUrl(link.slug)} 
                                target="_blank" 
                                rel="noreferrer"
                                className="p-1.5 rounded-md hover:bg-white hover:shadow-sm text-slate-500 hover:text-blue-600 transition-all border border-transparent hover:border-slate-200"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <Badge className="bg-slate-100 text-slate-700 border-none shadow-none text-[10px] w-fit">
                              {link.traffic_type?.toUpperCase() || 'MAINSTREAM'}
                            </Badge>
                            {link.allow_adult && (
                              <Badge className="bg-rose-100 text-rose-700 border-none shadow-none text-[10px] w-fit">
                                ADULT: ON
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            {link.publisher_name ? (
                              <>
                                <div className="text-sm font-bold text-blue-600 flex items-center gap-1.5">
                                  <Users className="h-3.5 w-3.5" />
                                  {link.publisher_name}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">PID: {link.publisher_id?.slice(-8) || 'SYSTEM'}</div>
                              </>
                            ) : (
                              <div className="flex items-center gap-1.5 text-slate-400 italic text-sm">
                                <Globe className="h-3.5 w-3.5" />
                                System Global
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <StrategyBadge strategy={link.rotation_strategy || 'performance'} />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{link.offer_ids?.length || 0}</span>
                            <span className="text-slate-400 text-sm">Qualified Offers</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge className={link.status === 'active' ? 'bg-emerald-100 text-emerald-700 shadow-none border-none' : 'bg-slate-100 text-slate-600 shadow-none border-none'}>
                            {link.status?.toUpperCase() || 'UNKNOWN'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-slate-900">{link.total_clicks || 0}</div>
                          <div className="text-[10px] text-slate-400">Total Clicks</div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                              onClick={() => fetchAnalytics(link._id)}
                              disabled={analyticsLoading}
                            >
                              <BarChart3 className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-slate-600 hover:bg-slate-100"
                              onClick={() => setSelectedLink(link)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-rose-600 hover:bg-rose-50"
                              onClick={() => handleDeleteSmartLink(link._id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                        {loading ? 'Initializing engine...' : 'No smart links found matching criteria.'}
                      </td>
                    </tr>
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      </TabsContent>

      <TabsContent value="clicks" className="space-y-8 animate-in fade-in-50 duration-500">
        <Card className="border-none shadow-md bg-white">
          <CardContent className="p-0">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Recent User Tracking Logs</h2>
              <Button variant="outline" size="sm" onClick={fetchClickLogs} disabled={logsLoading} className="gap-2">
                <RefreshCw className={`h-4 w-4 ${logsLoading ? 'animate-spin' : ''}`} />
                Refresh Logs
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500">Timestamp</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500">IP & GEO</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500">Session ID</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500">Publisher</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500">Smart Link</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500">Offer Served</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {clickLogs.length > 0 ? (
                    clickLogs.map(log => {
                      const link = smartLinks.find(l => l._id === log.smart_link_id) || 
                                  (['global_publisher_tracking', 'global_master_node'].includes(log.smart_link_id) ? { name: 'Global Master Smart Link', slug: 'global', _id: log.smart_link_id } : null);
                      return (
                        <tr key={log._id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">{log.ip}</span>
                              <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-none px-1.5 shadow-none">
                                {log.country || 'N/A'}
                              </Badge>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                             <span className="font-mono text-[10px] text-slate-400">
                               {log.session_id || 'N/A'}
                             </span>
                          </td>
                          <td className="px-6 py-4">
                            {link && link.publisher_id ? (
                               <Badge className="bg-indigo-50 text-indigo-700 border-none shadow-none text-[10px]">
                                 ID: {link.publisher_id.slice(-8)}
                               </Badge>
                            ) : (
                               <Badge className="bg-slate-100 text-slate-500 border-none shadow-none text-[10px]">
                                 SYSTEM
                               </Badge>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-900">{link?.name || 'Deleted Link'}</span>
                              <span className="text-[10px] text-slate-400">Slug: {link?.slug || 'n/a'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-slate-700">
                              {log.offer_name || (log.offer_id ? `Offer #${log.offer_id}` : <span className="text-slate-400 italic">No Match Fallback</span>)}
                            </div>
                            {log.offer_name && <div className="text-[10px] text-slate-400">ID: {log.offer_id}</div>}
                          </td>
                          <td className="px-6 py-4">
                            {log.offer_id ? (
                              <div className="flex flex-col gap-1">
                                <Badge className="bg-emerald-100 text-emerald-700 shadow-none border-none w-fit">Redirected</Badge>
                                {log.offer_status && (
                                  <Badge className={`${getStatusColor(log.offer_status)} border-none shadow-none w-fit text-[10px] py-0 px-1.5`}>
                                    {log.offer_status?.toUpperCase() || 'UNKNOWN'}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-700 shadow-none border-none">No Geo-Match</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        {logsLoading ? 'Loading logs...' : 'No clicks recorded yet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="activity" className="space-y-8 animate-in fade-in-50 duration-500">
        <Card className="border-none shadow-md bg-white">
          <CardContent className="p-0">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Publisher Activity & Selection Audit</h2>
              <Button variant="outline" size="sm" onClick={fetchActivityLogs} disabled={activityLoading} className="gap-2">
                <RefreshCw className={`h-4 w-4 ${activityLoading ? 'animate-spin' : ''}`} />
                Sync Audit Trail
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500">Event Time</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500">Action Type</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500">Publisher ID</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500">Affected Link Node</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500">Operation Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {activityLogs.length > 0 ? (
                    activityLogs.map(log => (
                      <tr key={log._id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <Badge className={`
                            ${log.action === 'smart_link_created' ? 'bg-emerald-100 text-emerald-700' : ''}
                            ${log.action === 'smart_link_deleted' ? 'bg-rose-100 text-rose-700' : ''}
                            ${log.action === 'smart_link_updated' ? 'bg-amber-100 text-amber-700' : ''}
                            border-none shadow-none text-[10px]
                          `}>
                            {log.action?.replace('smart_link_', '').toUpperCase()}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <code className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-600 font-mono">
                            {log.user_id}
                          </code>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-900">{log.details?.name || 'N/A'}</span>
                            <span className="text-[10px] text-slate-400">Slug: {log.details?.slug || 'n/a'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-[11px] text-slate-500 max-w-xs truncate">
                            {JSON.stringify(log.details)}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        {activityLoading ? 'Retrieving audit logs...' : 'No system activity recorded.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
        <TabsContent value="exclusions" className="animate-in fade-in-50 duration-500">
          <ExclusionsTab offers={offers} publishers={publishers} token={token} />
        </TabsContent>
      </Tabs>


      {/* Creation Modal */}
      {showCreateModal && (
        <SmartLinkModal
          mode="create"
          offers={offers}
          publishers={publishers}
          loadingOffers={offersLoading}
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreateSmartLink}
        />
      )}

      {/* Edit Modal */}
      {selectedLink && (
        <SmartLinkModal
          mode="edit"
          offers={offers}
          publishers={publishers}
          loadingOffers={offersLoading}
          smartLink={selectedLink}
          onClose={() => setSelectedLink(null)}
          onSave={(payload) => handleUpdateSmartLink(selectedLink._id, payload)}
        />
      )}

      {/* Analytics Dialog */}
      <Dialog open={showAnalytics} onOpenChange={setShowAnalytics}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-slate-50">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-blue-600" />
              Traffic Analytics
            </DialogTitle>
            <DialogDescription>
              Performance breakdown for redirection link.
            </DialogDescription>
          </DialogHeader>
          
          {analytics && (
            <div className="space-y-6 mt-4">
              {/* Top Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="border-none shadow-sm">
                  <CardContent className="pt-6 flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-xl text-blue-600">
                      <Zap className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-2xl font-extrabold text-slate-900">{analytics.total_clicks}</div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">Total Clicks</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-none shadow-sm">
                  <CardContent className="pt-6 flex items-center gap-4">
                    <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600">
                      <Users className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-2xl font-extrabold text-slate-900">{analytics.unique_visitors}</div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">Unique Visitors</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-none shadow-sm">
                  <CardContent className="pt-6 flex items-center gap-4">
                    <div className="p-3 bg-amber-100 rounded-xl text-amber-600">
                      <DollarSign className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-2xl font-extrabold text-slate-900">${(analytics.total_revenue || 0).toFixed(2)}</div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">Total Revenue</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-none shadow-sm">
                  <CardContent className="pt-6 flex items-center gap-4">
                    <div className="p-3 bg-indigo-100 rounded-xl text-indigo-600">
                      <TrendingUp className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-2xl font-extrabold text-slate-900">${(analytics.epc || 0).toFixed(3)}</div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">Avg. EPC</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Traffic Trend */}
                <Card className="border-none shadow-sm h-[400px]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                      Daily Traffic Volume
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics.clicks_analytics}>
                        <defs>
                          <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fontSize: 10, fill: '#94a3b8'}} 
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fontSize: 10, fill: '#94a3b8'}} 
                        />
                        <RechartsTooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="clicks" 
                          stroke="#3b82f6" 
                          strokeWidth={2}
                          fillOpacity={1} 
                          fill="url(#colorClicks)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Country Distribution */}
                <Card className="border-none shadow-sm h-[400px]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Globe className="h-4 w-4 text-emerald-500" />
                      Global Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RePieChart>
                        <Pie
                          data={analytics.country_distribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="clicks"
                          nameKey="country"
                        >
                          {analytics.country_distribution?.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                        {/* <Legend layout="vertical" align="right" verticalAlign="middle" /> */}
                      </RePieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Offer Selection Distribution */}
                <Card className="border-none shadow-sm lg:col-span-2 h-[400px]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <PieChartIcon className="h-4 w-4 text-slate-500" />
                      Algorithm Selection Outcomes (Offer Distribution)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.offer_distribution} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide />
                        <YAxis 
                          dataKey="offer_id" 
                          type="category" 
                          width={100}
                          axisLine={false}
                          tickLine={false}
                          tick={{fontSize: 10, fill: '#64748b'}}
                        />
                        <RechartsTooltip />
                        <Bar dataKey="clicks" radius={[0, 4, 4, 0]}>
                          {analytics.offer_distribution?.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
          <DialogFooter className="mt-6">
            <Button onClick={() => setShowAnalytics(false)}>Close Interface</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const StrategyBadge: React.FC<{ strategy: string }> = ({ strategy }) => {
  const configs: Record<string, { label: string, color: string, icon: any }> = {
    performance: { label: 'Smart EPC', color: 'bg-indigo-100 text-indigo-700', icon: TrendingUp },
    weighted: { label: 'Weighted Random', color: 'bg-amber-100 text-amber-700', icon: RefreshCw },
    priority: { label: 'Priority Logic', color: 'bg-rose-100 text-rose-700', icon: Zap },
    round_robin: { label: 'Round Robin', color: 'bg-blue-100 text-blue-700', icon: RefreshCw },
    random: { label: 'Random Shuffle', color: 'bg-slate-100 text-slate-700', icon: RefreshCw },
  };

  const config = configs[strategy] || configs.performance;
  const Icon = config.icon;

  return (
    <Badge className={`${config.color} shadow-none border-none gap-1.5 px-2.5 py-1`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
};

const SmartLinkModal: React.FC<{
  mode: 'create' | 'edit';
  offers: Offer[];
  publishers: any[];
  loadingOffers: boolean;
  onClose: () => void;
  onSave: (payload: any) => void;
  smartLink?: SmartLink;
}> = ({ mode, offers, publishers, loadingOffers, onClose, onSave, smartLink }) => {
  const [name, setName] = useState(smartLink?.name || '');
  const [slug, setSlug] = useState(smartLink?.slug || '');
  const [status, setStatus] = useState(smartLink?.status || 'active');
  const [publisherId, setPublisherId] = useState(smartLink?.publisher_id || '');
  const [trafficType, setTrafficType] = useState(smartLink?.traffic_type || 'mainstream');
  const [allowAdult, setAllowAdult] = useState(smartLink?.allow_adult || false);
  const [rotationStrategy, setRotationStrategy] = useState(smartLink?.rotation_strategy || 'performance');
  const [fallbackUrl, setFallbackUrl] = useState(smartLink?.fallback_url || '');
  const [selectedOfferIds, setSelectedOfferIds] = useState<string[]>(smartLink?.offer_ids || []);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('config');

  const toggleOffer = (offerId: string) => {
    setSelectedOfferIds((current) =>
      current.includes(offerId)
        ? current.filter((id) => id !== offerId)
        : [...current, offerId]
    );
  };

  const filteredOffers = useMemo(() => {
    return offers.filter((offer) =>
      `${offer.offer_id} ${offer.name}`.toLowerCase().includes(search.toLowerCase())
    );
  }, [offers, search]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || (!slug && mode === 'create')) return;

    onSave({
      name,
      slug,
      status,
      publisher_id: publisherId || undefined,
      traffic_type: trafficType,
      allow_adult: allowAdult,
      offer_ids: selectedOfferIds,
      rotation_strategy: rotationStrategy,
      fallback_url: fallbackUrl || undefined,
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl">
        <DialogHeader className="p-6 bg-slate-900 text-white">
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            {mode === 'create' ? <Plus className="h-6 w-6" /> : <Edit className="h-6 w-6" />}
            {mode === 'create' ? 'Assemble Redirection Node' : 'Optimize Smart Link'}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Configure how the selection engine routes incoming traffic.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col h-full overflow-hidden">
          <div className="px-6 py-2 bg-slate-100 border-b border-slate-200">
            <TabsList className="bg-transparent gap-4">
              <TabsTrigger value="config" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">System Config</TabsTrigger>
              <TabsTrigger value="offers" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Selection Pool ({selectedOfferIds.length})</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-white">
            <TabsContent value="config" className="mt-0 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-slate-700 font-semibold">Node Human Alias</Label>
                  <Input 
                    placeholder="e.g. USA Survey Bundle" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)}
                    className="border-slate-200 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-400">Internal management name for this link.</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 font-semibold">Url Slug Segment</Label>
                  <div className="flex">
                    <div className="h-10 px-3 flex items-center bg-slate-50 border border-r-0 border-slate-200 text-slate-400 text-xs rounded-l-md font-mono">
                      /smart/
                    </div>
                    <Input 
                      placeholder="global-offers" 
                      value={slug} 
                      onChange={(e) => setSlug(e.target.value)}
                      disabled={mode === 'edit'}
                      className="rounded-l-none border-slate-200 focus:ring-blue-500 font-mono"
                    />
                  </div>
                  <p className="text-xs text-slate-400">The unique identifier used in the redirection URL.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-slate-700 font-semibold">Attributed Publisher (Optional)</Label>
                  <Select value={publisherId} onValueChange={setPublisherId}>
                    <SelectTrigger className="border-slate-200">
                      <SelectValue placeholder="Internal / Network Link" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">System (Global / Public)</SelectItem>
                      {publishers.map(pub => (
                        <SelectItem key={pub._id} value={pub._id}>{pub.partner_name || pub.owner_username}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-slate-400 font-mono italic">If empty, this link acts as a public system-wide redirection node.</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 font-semibold text-blue-600 flex items-center gap-1.5">
                    <Activity className="h-4 w-4" />
                    Selection Logic Algorithm
                  </Label>
                  <Select value={rotationStrategy} onValueChange={setRotationStrategy}>
                    <SelectTrigger className="border-slate-200 ring-1 ring-blue-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="performance">
                        <div className="flex flex-col">
                          <span className="font-semibold text-indigo-600">Smart Optimization (EPC Based)</span>
                          <span className="text-[10px] text-slate-400">Routes to highest Earnings Per Click (EPC) automatically</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="priority">
                        <div className="flex flex-col">
                          <span className="font-semibold">Priority Sequential</span>
                          <span className="text-[10px] text-slate-400">Strictly follows individual offer priority scores</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="weighted">
                        <div className="flex flex-col">
                          <span className="font-semibold">Weighted Random</span>
                          <span className="text-[10px] text-slate-400">Distributes traffic based on offer rotation weights</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="round_robin">
                        <div className="flex flex-col">
                          <span className="font-semibold">Circular (Round Robin)</span>
                          <span className="text-[10px] text-slate-400">Time-synced rotation ensuring equal distribution</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="random">
                        <div className="flex flex-col">
                          <span className="font-semibold">Pure Random</span>
                          <span className="text-[10px] text-slate-400">Chaotic distribution (testing/baseline)</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-slate-700 font-semibold">Traffic Categorization</Label>
                  <Select value={trafficType} onValueChange={setTrafficType}>
                    <SelectTrigger className="border-slate-200">
                      <SelectValue placeholder="Mainstream" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mainstream">Mainstream Traffic</SelectItem>
                      <SelectItem value="adult">Adult Traffic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 font-semibold">Redirection State</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active (Processing Traffic)</SelectItem>
                      <SelectItem value="inactive">Inactive (Disabled)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-slate-700 font-semibold">Content Restrictions</Label>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 h-10">
                     <input 
                       type="checkbox" 
                       id="allowAdult" 
                       checked={allowAdult} 
                       onChange={(e) => setAllowAdult(e.target.checked)}
                       className="h-4 w-4 bg-blue-600 border-none rounded focus:ring-blue-500"
                     />
                     <Label htmlFor="allowAdult" className="text-sm font-medium cursor-pointer">
                       Allow Adult Advertisements
                     </Label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 font-semibold">Fallback Endpoint (Optional)</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input 
                      className="pl-9 border-slate-200 h-10" 
                      placeholder="https://your-main-back-offer.com"
                      value={fallbackUrl}
                      onChange={(e) => setFallbackUrl(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 flex gap-4">
                <div className="h-10 w-10 shrink-0 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                  <Zap className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-bold text-blue-900 text-sm">Selection Intelligence</h4>
                  <p className="text-xs text-blue-700 mt-0.5">
                    The system will automatically filter the selection pool based on incoming user metadata (Country, Device, Time) 
                    before applying the {rotationStrategy.toUpperCase()} algorithm.
                  </p>
                </div>
              </div>
            </TabsContent>



            <TabsContent value="offers" className="mt-0 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Search by ID or Name..." 
                    className="pl-9 border-slate-200"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50 flex-1 min-h-[400px]">
                {loadingOffers ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 py-20">
                    <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
                    <span className="text-sm font-medium text-slate-500">Retrieving system offers...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-2 max-h-[450px] overflow-y-auto">
                    {filteredOffers.length > 0 ? (
                      filteredOffers.map((offer) => (
                        <div 
                          key={offer.offer_id}
                          onClick={() => toggleOffer(offer.offer_id)}
                          className={`
                            p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-all
                            ${selectedOfferIds.includes(offer.offer_id) 
                              ? 'bg-white border-blue-400 shadow-sm ring-1 ring-blue-600/10' 
                              : 'bg-transparent border-slate-200 text-slate-600 hover:border-slate-300'}
                          `}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`
                              h-5 w-5 rounded flex items-center justify-center border transition-colors
                              ${selectedOfferIds.includes(offer.offer_id) ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}
                            `}>
                              {selectedOfferIds.includes(offer.offer_id) && <Check className="h-3 w-3" />}
                            </div>
                            <div>
                              <div className="text-sm font-bold truncate max-w-[180px]">{offer.name}</div>
                              <div className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1">
                                {offer.offer_id} <span className="text-slate-300">|</span> {offer.network}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1.5">
                            {offer.priority !== 0 && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <div className="h-6 px-1.5 rounded bg-rose-50 text-rose-600 text-[10px] font-bold border border-rose-100 flex items-center justify-center">
                                      P:{offer.priority}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>Selection Priority Score</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                             {offer.rotation_weight !== 1.0 && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <div className="h-6 px-1.5 rounded bg-blue-50 text-blue-600 text-[10px] font-bold border border-blue-100 flex items-center justify-center">
                                      W:{offer.rotation_weight}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>Selection Probability Weight</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-2 py-20 text-center text-slate-400">
                        <AlertCircle className="h-10 w-10 mx-auto opacity-20 mb-2" />
                        <p className="text-sm">No active offers available for selection pool.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="p-6 bg-slate-50 border-t border-slate-200">
          <Button variant="ghost" onClick={onClose} className="text-slate-500">Discard Changes</Button>
          <Button 
            onClick={handleSubmit}
            className="bg-slate-900 hover:bg-black text-white px-8 gap-2"
            disabled={activeTab === 'offers' && selectedOfferIds.length === 0}
          >
            {activeTab === 'config' ? (
              <>Selection Pool <ArrowRight className="h-4 w-4" /></>
            ) : (
              mode === 'create' ? 'Deploy Smart Link' : 'Save Optimizations'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ExclusionsTab: React.FC<{ offers: Offer[], publishers: any[], token: string | null }> = ({ offers, publishers, token }) => {
  const { toast } = useToast();
  const [globalExcluded, setGlobalExcluded] = useState<string[]>([]);
  const [pubExclusions, setPubExclusions] = useState<Record<string, {name: string, excluded_offers: string[]}>>({});
  const [loading, setLoading] = useState(true);
  const [targetType, setTargetType] = useState('global');
  const [selectedPublisher, setSelectedPublisher] = useState('');

  useEffect(() => {
    fetchExclusions();
  }, []);

  const fetchExclusions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/admin/smart-links/exclusions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setGlobalExcluded(data.global_excluded);
        setPubExclusions(data.publisher_exclusions);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleExclusion = async (offerId: string) => {
    if (targetType === 'publisher' && !selectedPublisher) {
      toast({ title: "Error", description: "Select a publisher first", variant: "destructive" });
      return;
    }
    
    let isExcluded = false;
    if (targetType === 'global') {
      isExcluded = globalExcluded.includes(offerId);
    } else {
      isExcluded = pubExclusions[selectedPublisher]?.excluded_offers.includes(offerId) || false;
    }
    
    const action = isExcluded ? 'remove' : 'add';
    
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/admin/smart-links/exclusions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          target: targetType,
          publisher_id: targetType === 'publisher' ? selectedPublisher : null,
          offer_id: offerId,
          action
        })
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Success", description: `Offer ${action === 'add' ? 'excluded' : 'included'} for ${targetType}` });
        fetchExclusions();
      }
    } catch (e) {
      toast({ title: "Error", description: "Operation failed", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
       <Card className="border-none shadow-sm shadow-rose-100">
         <CardHeader className="bg-rose-50/50 border-b border-rose-100 pb-6 rounded-t-xl">
            <CardTitle className="text-rose-900 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-rose-500" /> Offer Exclusion Hub
            </CardTitle>
            <CardDescription className="text-rose-700/70">
              Select offers to completely block them from appearing in Smart Link rotations. Global exclusions affect all users. Publisher exclusions affect only the selected user's Private Master Node.
            </CardDescription>
            <div className="flex flex-col md:flex-row items-center gap-4 mt-4">
              <Select value={targetType} onValueChange={(v) => { setTargetType(v); setSelectedPublisher(''); }}>
                 <SelectTrigger className="w-full md:w-[200px] bg-white border-rose-200">
                   <SelectValue placeholder="Target Level" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="global">🌍 Global (All Users)</SelectItem>
                   <SelectItem value="publisher">👤 Specific Publisher</SelectItem>
                 </SelectContent>
              </Select>
              
              {targetType === 'publisher' && (
                <Select value={selectedPublisher} onValueChange={setSelectedPublisher}>
                   <SelectTrigger className="w-full md:w-[300px] bg-white border-rose-200">
                     <SelectValue placeholder="Select Publisher..." />
                   </SelectTrigger>
                   <SelectContent>
                     {publishers.map(p => (
                        <SelectItem key={p._id} value={p._id}>{p.username || p.partner_name}</SelectItem>
                     ))}
                   </SelectContent>
                </Select>
              )}
            </div>
         </CardHeader>
         <CardContent className="p-0">
           {loading ? (
             <div className="p-12 text-center text-slate-400">Loading exclusions...</div>
           ) : (targetType === 'publisher' && !selectedPublisher) ? (
             <div className="p-12 text-center text-slate-400">Please select a publisher to manage their blocked offers.</div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                {offers.map(offer => {
                  const isExcluded = targetType === 'global' ? 
                     globalExcluded.includes(offer.offer_id) : 
                     (pubExclusions[selectedPublisher]?.excluded_offers || []).includes(offer.offer_id);
                  
                   return (
                     <div key={offer.offer_id} className={`p-4 rounded-xl border flex items-start gap-4 transition-all ${isExcluded ? 'border-rose-300 bg-rose-50/50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                        <button 
                           onClick={() => handleToggleExclusion(offer.offer_id)}
                           className={`h-6 w-6 mt-0.5 shrink-0 rounded flex items-center justify-center border transition-all ${isExcluded ? 'bg-rose-500 border-rose-600 text-white shadow-inner shadow-black/20' : 'bg-slate-50 border-slate-300 text-slate-200 hover:border-rose-400'}`}
                        >
                          {isExcluded && <Check className="h-4 w-4" />}
                        </button>
                        <div>
                          <p className={`font-bold ${isExcluded ? 'text-rose-900 line-through decoration-rose-300' : 'text-slate-800'}`}>{offer.name}</p>
                          <p className="text-xs text-slate-400 font-mono mt-1">ID: {offer.offer_id}</p>
                        </div>
                     </div>
                   );
                })}
             </div>
           )}
         </CardContent>
       </Card>
    </div>
  );
};

export default AdminSmartLinks;