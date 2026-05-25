import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/services/apiConfig';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
} from 'recharts';
import {
  Search, Mail, Send, CheckCircle, XCircle, AlertTriangle, Eye, FileText, Link, ChevronRight, RefreshCw, AlertCircle, Info, MessageSquare, History, Settings2
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import EmailSettingsPanel, { EmailSettings, DEFAULT_EMAIL_SETTINGS } from '@/components/EmailSettingsPanel';

// Define types
interface PublisherList {
  user_id: string;
  username: string;
  total_searches: number;
  unique_queries: number;
  conversions: number;
  watchlist_count: number;
  behavior: string;
  last_search_at: string;
}

interface TimelineItem {
  id: string;
  date: string;
  keyword: string;
  outcome: string;
  outcome_color: string;
  results_count: number;
  inventory_status: string;
  total_inventory_count: number;
  active_inventory_count: number;
}

interface KeywordStat {
  keyword: string;
  count: number;
  results_count: number;
  outcome: string;
  outcome_color: string;
}

interface PublisherIntelligence {
  summary: {
    username: string;
    behavior: string;
    total_searches: number;
    unique_keywords: number;
    watchlist_count: number;
    zero_result_percentage: number;
    conversions: number;
    mails_sent: number;
  };
  charts: {
    today: { total: number; outcomes: Record<string, number> };
    last_7d: { total: number; outcomes: Record<string, number> };
    last_30d: { total: number; outcomes: Record<string, number> };
  };
  top_keywords: KeywordStat[];
  timeline: TimelineItem[];
  funnel: {
    total_clicks: number;
    real_clicks: number;
    conversions: number;
    conversion_rate: number;
  };
  mail_history: {
    id: string;
    subject: string;
    type: string;
    offers_count: number;
    sent_at: string;
  }[];
  behavior_signals: {
    merged_bursts: number;
    no_offers: number;
    inactive: number;
    not_picked: number;
    id_lookups: number;
    converted: number;
  };
}

const OUTCOME_COLORS: Record<string, string> = {
  'Converted': '#22c55e',     // green-500
  'No offers': '#ef4444',     // red-500
  'Not active': '#f97316',    // orange-500
  'Not picked': '#991b1b',    // red-800
  'ID lookup': '#3b82f6',     // blue-500
};

export const AdminSearchIntelligence: React.FC = () => {
  const { toast } = useToast();
  const [publishers, setPublishers] = useState<PublisherList[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [intelData, setIntelData] = useState<PublisherIntelligence | null>(null);
  const [loadingIntel, setLoadingIntel] = useState(false);
  
  const [activeTab, setActiveTab] = useState('activity');
  const [listFilter, setListFilter] = useState('all'); // all, watchlist, why_not, converted
  const [searchQuery, setSearchQuery] = useState('');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'watchlist' | 'whynot' | 'id_lookup'>('all');
  
  // Compose & Send state
  const [reSearchKeyword, setReSearchKeyword] = useState('');
  const [relatedOffers, setRelatedOffers] = useState<any[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailSettings, setEmailSettings] = useState<EmailSettings>(DEFAULT_EMAIL_SETTINGS);
  const [sendingEmail, setSendingEmail] = useState(false);
  
  // Outreach Composer & Scheduler State
  const [isOutreachOpen, setIsOutreachOpen] = useState(false);
  const [outreachUsers, setOutreachUsers] = useState<{ userId: string; username: string; keyword: string }[]>([]);
  const [outreachSubject, setOutreachSubject] = useState('');
  const [outreachMessage, setOutreachMessage] = useState('');
  const [outreachOffers, setOutreachOffers] = useState<any[]>([]);
  const [loadingOutreachOffers, setLoadingOutreachOffers] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('');
  const [sendingOutreach, setSendingOutreach] = useState(false);

  // Main Compose & Send Scheduler State
  const [isMainScheduled, setIsMainScheduled] = useState(false);
  const [mainScheduleTime, setMainScheduleTime] = useState(() => {
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
    return new Date(oneHourFromNow.getTime() - (oneHourFromNow.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
  });
  
  const [globalStats, setGlobalStats] = useState({
    today: 0,
    watchlist: 0,
    no_offers: 0,
    active_pubs: 0,
    revenue: '0.00'
  });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'today' | 'watchlist' | 'no_offers' | 'active_pubs'>('today');
  const [modalData, setModalData] = useState<any[]>([]);
  const [loadingModal, setLoadingModal] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [modalDateFrom, setModalDateFrom] = useState('');
  const [modalDateTo, setModalDateTo] = useState('');
  const [activePubsSearchQuery, setActivePubsSearchQuery] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());

  // Filtered dataset for Active Publishers tab
  const filteredActivePubs = useMemo(() => {
    return publishers.filter(pub => 
      pub.username.toLowerCase().includes(activePubsSearchQuery.toLowerCase())
    );
  }, [publishers, activePubsSearchQuery]);

  // Filtered dataset for log tables inside Today, Watchlist, No Offers
  const filteredModalData = useMemo(() => {
    return modalData.filter(item => {
      const matchesSearch = modalSearchQuery === '' ||
        item.publisher.toLowerCase().includes(modalSearchQuery.toLowerCase()) ||
        item.keyword.toLowerCase().includes(modalSearchQuery.toLowerCase());

      let matchesDate = true;
      if (modalDateFrom) {
        const fromDate = new Date(modalDateFrom);
        fromDate.setHours(0,0,0,0);
        matchesDate = matchesDate && new Date(item.date) >= fromDate;
      }
      if (modalDateTo) {
        const toDate = new Date(modalDateTo);
        toDate.setHours(23,59,59,999);
        matchesDate = matchesDate && new Date(item.date) <= toDate;
      }

      return matchesSearch && matchesDate;
    });
  }, [modalData, modalSearchQuery, modalDateFrom, modalDateTo]);

  // Dynamic calculations for circular stats breakdown
  const modalStats = useMemo(() => {
    const total = modalData.length;
    const noOffers = modalData.filter(d => d.outcome === 'No offers').length;
    const notActive = modalData.filter(d => d.outcome === 'Not active').length;
    const converted = modalData.filter(d => d.outcome === 'Converted').length;
    const notPicked = modalData.filter(d => d.outcome === 'Not picked').length;
    const idLookup = modalData.filter(d => d.outcome === 'ID lookup').length;

    return {
      total,
      noOffers,
      notActive,
      converted,
      notPicked,
      idLookup,
      noOffersPct: total > 0 ? ((noOffers / total) * 100).toFixed(0) : '0',
      notActivePct: total > 0 ? ((notActive / total) * 100).toFixed(0) : '0',
      convertedPct: total > 0 ? ((converted / total) * 100).toFixed(0) : '0',
      notPickedPct: total > 0 ? ((notPicked / total) * 100).toFixed(0) : '0',
      idLookupPct: total > 0 ? ((idLookup / total) * 100).toFixed(0) : '0',
    };
  }, [modalData]);

  // CSV download function
  const downloadCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      toast({
        title: "No data",
        description: "There is no data to download.",
        variant: "destructive"
      });
      return;
    }
    const headers = ['Publisher', 'Keyword', 'Date', 'Outcome', 'Results'];
    const rows = data.map(r => [
      `@${r.publisher}`,
      r.keyword,
      r.date,
      r.outcome,
      r.results
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({
      title: "Success",
      description: `CSV file downloaded successfully.`,
    });
  };

  // Clipboard copy function
  const copyToClipboard = (data: any[]) => {
    if (data.length === 0) {
      toast({
        title: "No data",
        description: "There is no data to copy.",
        variant: "destructive"
      });
      return;
    }
    const text = data.map(r => `@${r.publisher}\t${r.keyword}\t${r.date}\t${r.outcome}\t${r.results}`).join('\n');
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `Copied ${data.length} rows to clipboard.`,
    });
  };

  useEffect(() => {
    fetchPublishers();
    fetchGlobalStats();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      fetchPublisherIntelligence(selectedUser);
    }
  }, [selectedUser]);

  const fetchGlobalStats = async () => {
    try {
      const token = localStorage.getItem('token');
      // Fetch all-time stats for Watchlist and No Offers
      const statsRes = await fetch(`${API_BASE_URL}/api/admin/search-logs?per_page=1`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const statsData = await statsRes.json();
      
      // Fetch today's stats for Live Today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayRes = await fetch(`${API_BASE_URL}/api/admin/search-logs?date_from=${todayStart.toISOString()}&per_page=1`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const todayData = await todayRes.json();

      // Fetch 30D Revenue from admin overview stats
      const overviewRes = await fetch(`${API_BASE_URL}/api/admin/overview-stats?time_range=30d`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const overviewData = await overviewRes.json();

      if (statsData.success && todayData.success) {
        setGlobalStats(prev => ({
          ...prev,
          today: todayData.stats.total_searches || 0,
          watchlist: (statsData.stats.not_in_inventory || 0) + (statsData.stats.in_inventory_not_active || 0),
          no_offers: statsData.stats.not_in_inventory || 0,
          revenue: overviewData.success && overviewData.stats?.revenue ? overviewData.stats.revenue.total.toFixed(2) : prev.revenue
        }));
      }
    } catch (err) {
      console.error("Error fetching global stats:", err);
    }
  };

  const openGlobalModal = (type: 'today' | 'watchlist' | 'no_offers' | 'active_pubs') => {
    setModalType(type);
    setIsModalOpen(true);
    if (type !== 'active_pubs') {
      fetchModalData(type);
    }
  };

  const fetchModalData = async (type: 'today' | 'watchlist' | 'no_offers') => {
    setLoadingModal(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${API_BASE_URL}/api/admin/search-logs?per_page=10000`;
      
      if (type === 'today') {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        url += `&date_from=${todayStart.toISOString()}`;
      } else if (type === 'watchlist') {
        url += `&inventory_status=in_inventory_not_active,not_in_inventory`;
      } else if (type === 'no_offers') {
        url += `&inventory_status=not_in_inventory`;
      }
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        // Group by publisher, keyword, and outcome to count searches
        const grouped = new Map<string, any>();
        
        data.logs.forEach((log: any) => {
          let outcome = 'Not picked';
          if (log.inventory_status === 'not_in_inventory' || log.no_result) {
            outcome = 'No offers';
          } else if (log.inventory_status === 'in_inventory_not_active') {
            outcome = 'Not active';
          } else if (log.picked_offer_id || log.picked_offer || log.clicked_request || log.clicked_preview || log.clicked_tracking) {
            outcome = 'Converted';
          } else if (log.search_type === 'id_lookup' || log.is_id_lookup) {
            outcome = 'ID lookup';
          }
          
          const publisher = log.username || 'Unknown';
          const keyword = log.keyword || '';
          const key = `${publisher}-${keyword}-${outcome}`;
          
          if (!grouped.has(key)) {
            grouped.set(key, {
              id: log._id,
              userId: log.user_id,
              publisher: publisher,
              keyword: keyword,
              date: log.searched_at || log.timestamp || new Date().toISOString(),
              outcome: outcome,
              results: 1
            });
          } else {
            const existing = grouped.get(key);
            existing.results += 1;
            // Update to most recent date
            const existingDate = new Date(existing.date);
            const newDate = new Date(log.searched_at || log.timestamp);
            if (newDate > existingDate) {
              existing.date = log.searched_at || log.timestamp;
            }
          }
        });
        
        // Convert map to array and sort by date descending
        let distinctData = Array.from(grouped.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        // Filter based on the selected modal category type to keep views extremely precise
        if (type === 'no_offers') {
          distinctData = distinctData.filter(d => d.outcome === 'No offers');
        } else if (type === 'watchlist') {
          distinctData = distinctData.filter(d => d.outcome === 'No offers' || d.outcome === 'Not active');
        }
        
        setModalData(distinctData);
      }
    } catch (err) {
      console.error("Error fetching modal data:", err);
    } finally {
      setLoadingModal(false);
    }
  };

  const fetchPublishers = async () => {
    setLoadingList(true);
    try {
      const token = localStorage.getItem('token');
      const realRes = await fetch(`${API_BASE_URL}/api/admin/search-intelligence/publishers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!realRes.ok) throw new Error('Failed to fetch publishers');
      const data = await realRes.json();
      const pubs = data.publishers || [];
      setPublishers(pubs);
      setGlobalStats(prev => ({ ...prev, active_pubs: pubs.length }));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingList(false);
    }
  };

  const fetchPublisherIntelligence = async (userId: string) => {
    setLoadingIntel(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/admin/search-intelligence/publishers/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch intelligence');
      const data = await res.json();
      if (data.success) {
        setIntelData(data);
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingIntel(false);
    }
  };

  const handleReSearch = async (keywordToSearch?: string) => {
    const searchKw = typeof keywordToSearch === 'string' ? keywordToSearch : reSearchKeyword;
    if (!searchKw.trim()) return;
    setLoadingOffers(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/admin/search-logs/related-offers?keyword=${encodeURIComponent(searchKw)}&user_id=${selectedUser}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setRelatedOffers(data.offers.map((o: any) => ({ ...o, selected: true })));
        setEmailSubject(`🔥 Offers matching "${searchKw}" are available for you!`);
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingOffers(false);
    }
  };

  const handleSendMail = async () => {
    const selected = relatedOffers.filter(o => o.selected);
    if (selected.length === 0) {
      toast({ title: 'Error', description: 'Select at least one offer', variant: 'destructive' });
      return;
    }
    setSendingEmail(true);
    try {
      const token = localStorage.getItem('token');
      
      let apiScheduleTime = null;
      if (isMainScheduled && mainScheduleTime) {
        apiScheduleTime = new Date(mainScheduleTime).toISOString();
      }

      const res = await fetch(`${API_BASE_URL}/api/admin/search-logs/send-inventory-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          user_id: selectedUser,
          keyword: reSearchKeyword,
          offers: selected,
          subject: emailSubject,
          message: emailMessage,
          template_style: emailSettings.templateStyle,
          visible_fields: emailSettings.visibleFields,
          see_more_fields: emailSettings.seeMoreFields,
          payout_type: emailSettings.payoutType,
          default_image: emailSettings.defaultImage,
          mask_preview_links: emailSettings.maskPreviewLinks,
          payment_terms: emailSettings.paymentTerms,
          schedule_time: apiScheduleTime,
        })
      });
      const data = await res.json();
      if (data.success) {
        toast({ 
          title: 'Success', 
          description: isMainScheduled ? `Email successfully scheduled for ${new Date(mainScheduleTime).toLocaleString()}` : 'Email sent successfully' 
        });
        setActiveTab('activity');
        fetchPublisherIntelligence(selectedUser!);
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSendingEmail(false);
    }
  };

  const toggleOfferSelect = (id: string) => {
    setRelatedOffers(prev => prev.map(o => o.offer_id === id ? { ...o, selected: !o.selected } : o));
  };

  const openOutreachModal = async (usersList: { userId: string; username: string; keyword: string }[]) => {
    if (usersList.length === 0) return;
    
    setOutreachUsers(usersList);
    setOutreachSubject(`🔥 Offers matching "${usersList[0].keyword}" are available for you!`);
    setOutreachMessage(`Hi @${usersList[0].username},\n\nWe noticed you were searching for "${usersList[0].keyword}". We have some highly relevant offers ready for you!`);
    setOutreachOffers([]);
    setIsScheduled(false);
    
    // Set default schedule time to 1 hour from now formatted for datetime-local
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
    const localISO = new Date(oneHourFromNow.getTime() - (oneHourFromNow.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    setScheduleTime(localISO);
    
    setIsOutreachOpen(true);
    setLoadingOutreachOffers(true);
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/admin/search-logs/related-offers?keyword=${encodeURIComponent(usersList[0].keyword)}&user_id=${usersList[0].userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setOutreachOffers(data.offers.map((o: any) => ({ ...o, selected: true })));
      } else {
        toast({ title: 'Error loading offers', description: data.error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingOutreachOffers(false);
    }
  };

  const handleSendOrScheduleOutreach = async () => {
    const selectedOffers = outreachOffers.filter(o => o.selected);
    if (selectedOffers.length === 0) {
      toast({ title: 'Error', description: 'Select at least one offer to send', variant: 'destructive' });
      return;
    }
    
    setSendingOutreach(true);
    const token = localStorage.getItem('token');
    
    try {
      let successCount = 0;
      let failCount = 0;
      
      for (const u of outreachUsers) {
        let userOffers = selectedOffers;
        if (outreachUsers.length > 1) {
          try {
            const res = await fetch(`${API_BASE_URL}/api/admin/search-logs/related-offers?keyword=${encodeURIComponent(u.keyword)}&user_id=${u.userId}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success && data.offers && data.offers.length > 0) {
              const selectedIds = new Set(selectedOffers.map(o => o.offer_id));
              userOffers = data.offers
                .map((o: any) => ({ ...o, selected: selectedIds.has(o.offer_id) }))
                .filter((o: any) => o.selected);
            }
          } catch (e) {
            console.error(`Failed to fetch custom offers for ${u.username}`, e);
          }
        }
        
        if (userOffers.length === 0) {
          userOffers = selectedOffers;
        }
        
        let apiScheduleTime = null;
        if (isScheduled && scheduleTime) {
          apiScheduleTime = new Date(scheduleTime).toISOString();
        }
        
        const payload: any = {
          user_id: u.userId,
          keyword: u.keyword,
          offers: userOffers,
          subject: outreachSubject.replace(new RegExp(`"${outreachUsers[0].keyword}"`, 'g'), `"${u.keyword}"`),
          message: outreachMessage.replace(new RegExp(`@${outreachUsers[0].username}`, 'g'), `@${u.username}`),
          template_style: emailSettings.templateStyle,
          visible_fields: emailSettings.visibleFields,
          see_more_fields: emailSettings.seeMoreFields,
          payout_type: emailSettings.payoutType,
          default_image: emailSettings.defaultImage,
          mask_preview_links: emailSettings.maskPreviewLinks,
          payment_terms: emailSettings.paymentTerms,
        };
        
        if (apiScheduleTime) {
          payload.schedule_time = apiScheduleTime;
        }
        
        const res = await fetch(`${API_BASE_URL}/api/admin/search-logs/send-inventory-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        if (data.success) {
          successCount++;
        } else {
          failCount++;
        }
      }
      
      if (failCount === 0) {
        toast({
          title: isScheduled ? 'Outreach Scheduled' : 'Outreach Sent',
          description: `Successfully processed outreach for ${successCount} publisher(s).`,
        });
        setIsOutreachOpen(false);
        if (selectedUser) {
          fetchPublisherIntelligence(selectedUser);
        }
      } else {
        toast({
          title: 'Partial Failure',
          description: `Successfully sent/scheduled for ${successCount} publishers. Failed for ${failCount} publishers.`,
          variant: 'destructive'
        });
      }
    } catch (err: any) {
      toast({ title: 'Outreach Error', description: err.message, variant: 'destructive' });
    } finally {
      setSendingOutreach(false);
    }
  };

  const filteredPublishers = useMemo(() => {
    return publishers.filter(p => {
      const matchesSearch = p.username.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      
      if (listFilter === 'all') return true;
      if (listFilter === 'watchlist' && p.behavior === 'On Watchlist') return true;
      if (listFilter === 'why_not' && p.total_searches > 0 && p.conversions === 0) return true;
      if (listFilter === 'converted' && p.conversions > 0) return true;
      return false;
    });
  }, [publishers, listFilter, searchQuery]);

  const filteredTimeline = useMemo(() => {
    if (!intelData?.timeline) return [];
    if (historyFilter === 'all') return intelData.timeline;
    if (historyFilter === 'watchlist') return intelData.timeline.filter(t => t.outcome === 'Not active' || t.outcome === 'No offers');
    if (historyFilter === 'whynot') return intelData.timeline.filter(t => t.outcome === 'Not picked');
    if (historyFilter === 'id_lookup') return intelData.timeline.filter(t => t.outcome === 'ID lookup');
    return intelData.timeline;
  }, [intelData?.timeline, historyFilter]);

  const renderPieChart = (chartData: any) => {
    if (!chartData || chartData.total === 0) {
      return <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">No data</div>;
    }
    
    const data = Object.entries(chartData.outcomes)
      .filter(([_, value]) => (value as number) > 0)
      .map(([name, value]) => ({ name, value }));

    return (
      <div className="h-40 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={60}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={OUTCOME_COLORS[entry.name] || '#ccc'} />
              ))}
            </Pie>
            <RechartsTooltip formatter={(value: number) => [`${value} searches`, '']} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold">{chartData.total}</span>
          <span className="text-[10px] text-muted-foreground font-medium uppercase">Srchs</span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-40px)] bg-slate-50/50 -m-4">
      {/* Custom Top Bar */}
      <div className="flex items-center justify-between bg-white px-6 py-3 border-b shadow-sm h-16 shrink-0 z-10">
        <div className="flex items-center gap-4">
          <div className="bg-[#6366f1] text-white w-8 h-8 rounded flex items-center justify-center font-bold text-lg">M</div>
          <div>
            <h1 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-none mb-0.5">Moustache - Affiliate Admin</h1>
            <h2 className="text-base font-bold text-slate-800 leading-none">Search Intelligence</h2>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-8">
            <div className="cursor-pointer group flex flex-col items-center" onClick={() => openGlobalModal('today')}>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 group-hover:text-slate-800 transition-colors flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                Live · Today
              </div>
              <div className="text-xl font-bold text-green-500">{globalStats.today}</div>
            </div>
            
            <div className="cursor-pointer group flex flex-col items-center" onClick={() => openGlobalModal('watchlist')}>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 group-hover:text-slate-800 transition-colors">Watchlist</div>
              <div className="text-xl font-bold text-orange-500">{globalStats.watchlist}</div>
            </div>
            
            <div className="cursor-pointer group flex flex-col items-center" onClick={() => openGlobalModal('no_offers')}>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 group-hover:text-slate-800 transition-colors">No Offers</div>
              <div className="text-xl font-bold text-red-500">{globalStats.no_offers}</div>
            </div>
            
            <div className="cursor-pointer group flex flex-col items-center" onClick={() => openGlobalModal('active_pubs')}>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 group-hover:text-slate-800 transition-colors">Active Pubs</div>
              <div className="text-xl font-bold text-slate-800">{globalStats.active_pubs}</div>
            </div>
            
            <div className="text-right">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Revenue (30D)</div>
              <div className="text-xl font-bold text-slate-800">${globalStats.revenue}</div>
            </div>

            {/* Auto-Activation Service Control */}
            <AutoActivationQuickControl />
            <AutoActivationHistoryButton />
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-80 border-r flex flex-col bg-slate-50/50 shrink-0">
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <span className="text-slate-400">//</span> Publishers
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search publishers..." 
              className="pl-9 bg-white"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge 
              variant={listFilter === 'all' ? 'default' : 'outline'} 
              className={`cursor-pointer rounded-full ${listFilter === 'all' ? 'bg-white text-slate-900 border shadow-sm' : 'bg-transparent'}`}
              onClick={() => setListFilter('all')}
            >
              All
            </Badge>
            <Badge 
              variant={listFilter === 'watchlist' ? 'default' : 'outline'} 
              className={`cursor-pointer rounded-full ${listFilter === 'watchlist' ? 'bg-white text-slate-900 border shadow-sm' : 'bg-transparent'}`}
              onClick={() => setListFilter('watchlist')}
            >
              Watchlist
            </Badge>
            <Badge 
              variant={listFilter === 'why_not' ? 'default' : 'outline'} 
              className={`cursor-pointer rounded-full ${listFilter === 'why_not' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-transparent text-blue-600 border-blue-100'}`}
              onClick={() => setListFilter('why_not')}
            >
              Why not
            </Badge>
            <Badge 
              variant={listFilter === 'converted' ? 'default' : 'outline'} 
              className={`cursor-pointer rounded-full ${listFilter === 'converted' ? 'bg-white text-slate-900 border shadow-sm' : 'bg-transparent'}`}
              onClick={() => setListFilter('converted')}
            >
              Converted
            </Badge>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loadingList ? (
            <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" /> Loading...
            </div>
          ) : filteredPublishers.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No publishers found</div>
          ) : (
            filteredPublishers.map(p => {
              const isWhyNot = p.total_searches > 0 && p.conversions === 0;
              return (
                <div 
                  key={p.user_id}
                  onClick={() => setSelectedUser(p.user_id)}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selectedUser === p.user_id ? 'bg-blue-50/80 border border-blue-100 shadow-sm' : 'hover:bg-white border border-transparent'}`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${selectedUser === p.user_id ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {p.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{p.username}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{p.total_searches} searches</div>
                  </div>
                  {isWhyNot && (
                    <div className="text-[11px] font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full shrink-0">
                      {p.total_searches} why?
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {!selectedUser ? (
          <div className="flex-1 flex items-center justify-center flex-col text-slate-400">
            <Search className="h-12 w-12 mb-4 opacity-20" />
            <p>Select a publisher from the list to view intelligence</p>
          </div>
        ) : loadingIntel ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 gap-2">
            <RefreshCw className="h-6 w-6 animate-spin" /> Loading intelligence...
          </div>
        ) : intelData ? (
          <div className="flex-1 flex flex-col h-full">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col h-full">
              {/* Header */}
              <div className="px-6 py-4 border-b shrink-0 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl font-bold">
                    {intelData.summary.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-slate-800">{intelData.summary.username}</h2>
                      <span className="text-xs text-slate-400 font-mono">// pub_{intelData.summary.username.substring(0, 5).toUpperCase()}</span>
                    </div>
                    <div className="text-sm text-blue-600 font-medium mt-0.5">
                      {intelData.summary.conversions} conversions · {intelData.summary.unique_keywords} unique queries · strong signal
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400 font-bold tracking-wider mb-1 uppercase">// BEHAVIOR</div>
                  <div className="text-lg font-bold text-slate-800">{intelData.summary.behavior}</div>
                </div>
              </div>

              {/* Tabs List */}
              <div className="px-6 border-b shrink-0">
                <TabsList className="bg-transparent h-12 p-0 space-x-6">
                  <TabsTrigger 
                    value="activity" 
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-0 h-12 font-medium"
                  >
                    Search Activity
                  </TabsTrigger>
                  <TabsTrigger 
                    value="intelligence" 
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-0 h-12 font-medium"
                  >
                    Publisher Intelligence
                  </TabsTrigger>
                  <TabsTrigger 
                    value="compose" 
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-0 h-12 font-medium flex items-center gap-2"
                  >
                    Compose & Send
                    {intelData.summary.total_searches > 0 && intelData.summary.conversions === 0 && (
                      <span className="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold">3</span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="auto_activation" 
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-0 h-12 font-medium flex items-center gap-2"
                  >
                    Auto-Activation
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Tab Contents */}
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                <TabsContent value="activity" className="m-0 space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                    <Card className="shadow-sm">
                      <CardContent className="p-4">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total Searches</div>
                        <div className="text-2xl font-bold text-slate-800">{intelData.summary.total_searches}</div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {intelData.timeline.length > 0 
                            ? `${new Date(intelData.timeline[intelData.timeline.length - 1].date).toLocaleDateString('en-US', {day:'2-digit', month:'2-digit'})} · ${new Date(intelData.timeline[0].date).toLocaleDateString('en-US', {day:'2-digit', month:'2-digit'})}` 
                            : 'Till date'}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="shadow-sm">
                      <CardContent className="p-4">
                        <div className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1">Unique Kws</div>
                        <div className="text-2xl font-bold text-blue-600">{intelData.summary.unique_keywords}</div>
                        <div className="text-[10px] text-slate-400 mt-1">distinct queries</div>
                      </CardContent>
                    </Card>
                    <Card className="shadow-sm">
                      <CardContent className="p-4">
                        <div className="text-[10px] font-bold text-orange-500 uppercase tracking-wider mb-1">Watchlist</div>
                        <div className="text-2xl font-bold text-orange-600">{intelData.summary.watchlist_count}</div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {intelData.behavior_signals.no_offers} no-offer · {intelData.behavior_signals.inactive} inactive
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="shadow-sm">
                      <CardContent className="p-4">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Zero-Result %</div>
                        <div className="text-2xl font-bold text-slate-800">{intelData.summary.zero_result_percentage}%</div>
                        <div className="text-[10px] text-slate-400 mt-1">{intelData.behavior_signals.no_offers} of {intelData.summary.total_searches}</div>
                      </CardContent>
                    </Card>
                    <Card className="shadow-sm border-green-100 bg-green-50/30">
                      <CardContent className="p-4">
                        <div className="text-[10px] font-bold text-green-600 uppercase tracking-wider mb-1">Conversions</div>
                        <div className="text-2xl font-bold text-green-600">{intelData.summary.conversions}</div>
                        <div className="text-[10px] text-slate-400 mt-1">picked</div>
                      </CardContent>
                    </Card>
                    <Card className="shadow-sm">
                      <CardContent className="p-4">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Mails Sent</div>
                        <div className="text-2xl font-bold text-slate-800">{intelData.summary.mails_sent}</div>
                        <div className="text-[10px] text-slate-400 mt-1">re-engagement</div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Charts */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-slate-800">Search Outcomes Over Time</h3>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">5 Outcomes · No Noise</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {['today', 'last_7d', 'last_30d'].map((period) => {
                        const data = intelData.charts[period as keyof typeof intelData.charts];
                        const titles: Record<string, string> = { today: 'Today', last_7d: 'Last 7d', last_30d: 'Last 30d' };
                        return (
                          <Card key={period} className="shadow-sm border-slate-100">
                            <CardContent className="p-4">
                              <div className="flex justify-between items-center mb-2">
                                <div className="font-semibold text-slate-800">{titles[period]}</div>
                                <div className="text-xs text-slate-500">{data.total} searches</div>
                              </div>
                              <div className="flex">
                                <div className="w-1/2">
                                  {renderPieChart(data)}
                                </div>
                                <div className="w-1/2 flex flex-col justify-center space-y-1.5 pl-4 border-l border-slate-50">
                                  {Object.entries(data.outcomes).map(([name, val]) => {
                                    if (val === 0) return null;
                                    const pct = Math.round((val / data.total) * 100);
                                    return (
                                      <div key={name} className="flex items-center text-[10px] font-medium text-slate-600">
                                        <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: OUTCOME_COLORS[name] }}></div>
                                        <span className="flex-1 truncate">{name}</span>
                                        <span className="font-bold text-slate-800">{val}</span>
                                        <span className="text-slate-400 ml-1 w-6 text-right">{pct}%</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>

                  {/* Middle row: Top Keywords & Behavior Signals */}
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
                    <Card className="shadow-sm border-slate-100 lg:col-span-3 flex flex-col">
                      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between border-b-0">
                        <CardTitle className="text-sm font-bold text-slate-800">Top Keywords</CardTitle>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">By Frequency</span>
                      </CardHeader>
                      <CardContent className="p-4 space-y-4 flex-1">
                        {intelData.top_keywords.map((kw, i) => (
                          <div key={i} className="group">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2 overflow-hidden">
                                <span className="font-bold text-slate-700 uppercase truncate text-xs">{kw.keyword}</span>
                                <Badge variant="outline" style={{ borderColor: OUTCOME_COLORS[kw.outcome], color: OUTCOME_COLORS[kw.outcome], backgroundColor: `${OUTCOME_COLORS[kw.outcome]}10` }} className="text-[8px] px-1 h-3.5 uppercase font-bold tracking-wider shrink-0 border-transparent">
                                  {kw.outcome}
                                </Badge>
                              </div>
                              <div className="text-[9px] font-mono text-slate-500 shrink-0">
                                {kw.count}x · {kw.results_count}r {kw.outcome === 'Converted' ? '· ✓' : ''}
                              </div>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.max(5, (kw.count / intelData.summary.total_searches) * 100)}%`, backgroundColor: OUTCOME_COLORS[kw.outcome] }}></div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    {/* Behavior Signals Card */}
                    <Card className="shadow-sm border-slate-100 lg:col-span-2 flex flex-col bg-white">
                      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between border-b-0">
                        <CardTitle className="text-sm font-bold text-slate-800">Behavior Signals</CardTitle>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Flags &amp; Wins</span>
                      </CardHeader>
                      <CardContent className="p-4 flex-1 grid grid-cols-2 gap-3">
                        {/* Merged Bursts */}
                        <div className="bg-[#FEF6EE] border border-amber-100 rounded-xl p-3.5 flex flex-col justify-between">
                          <div className="text-[10px] font-bold text-amber-700/80 uppercase tracking-wider">Merged Bursts</div>
                          <div className="text-3xl font-extrabold text-amber-800 mt-2">{intelData.behavior_signals.merged_bursts}</div>
                        </div>

                        {/* No Offers */}
                        <div className="bg-[#FFF1F2] border border-rose-100 rounded-xl p-3.5 flex flex-col justify-between">
                          <div className="text-[10px] font-bold text-rose-700/80 uppercase tracking-wider">No Offers (🚫)</div>
                          <div className="text-3xl font-extrabold text-rose-800 mt-2">{intelData.behavior_signals.no_offers}</div>
                        </div>

                        {/* Inactive */}
                        <div className="bg-[#FFF6ED] border border-orange-100 rounded-xl p-3.5 flex flex-col justify-between">
                          <div className="text-[10px] font-bold text-orange-700/80 uppercase tracking-wider">Inactive (⚡)</div>
                          <div className="text-3xl font-extrabold text-orange-800 mt-2">{intelData.behavior_signals.inactive}</div>
                        </div>

                        {/* Not Picked */}
                        <div className="bg-[#FDF2F8] border border-pink-100 rounded-xl p-3.5 flex flex-col justify-between">
                          <div className="text-[10px] font-bold text-pink-700/80 uppercase tracking-wider">Not Picked (👁️)</div>
                          <div className="text-3xl font-extrabold text-pink-800 mt-2">{intelData.behavior_signals.not_picked}</div>
                        </div>

                        {/* ID Lookups */}
                        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3.5 flex flex-col justify-between">
                          <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">ID Lookups (🔑)</div>
                          <div className="text-3xl font-extrabold text-slate-800 mt-2">{intelData.behavior_signals.id_lookups || 0}</div>
                        </div>

                        {/* Converted */}
                        <div className="bg-[#ECFDF5] border border-emerald-100 rounded-xl p-3.5 flex flex-col justify-between">
                          <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Converted (💸)</div>
                          <div className="text-3xl font-extrabold text-emerald-800 mt-2">{intelData.behavior_signals.converted || 0}</div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Search History Row */}
                  <Card className="shadow-sm border-slate-100 flex flex-col">
                    <CardHeader className="p-4 border-b flex flex-row items-center justify-between bg-slate-50/50">
                      <div className="flex items-center gap-6">
                        <CardTitle className="text-sm font-bold text-slate-800">Search History</CardTitle>
                        <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider">
                          <button onClick={() => setHistoryFilter('all')} className={`${historyFilter === 'all' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'} pb-1 transition-colors`}>All</button>
                          <button onClick={() => setHistoryFilter('watchlist')} className={`${historyFilter === 'watchlist' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'} pb-1 transition-colors`}>Watchlist</button>
                          <button onClick={() => setHistoryFilter('whynot')} className={`${historyFilter === 'whynot' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'} pb-1 transition-colors`}>Why not</button>
                          <button onClick={() => setHistoryFilter('id_lookup')} className={`${historyFilter === 'id_lookup' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'} pb-1 transition-colors`}>ID lookup</button>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{filteredTimeline.length} Entries</span>
                    </CardHeader>
                    <CardContent className="p-0 overflow-y-auto max-h-[400px]">
                      {filteredTimeline.map((item, i) => {
                        const dateObj = new Date(item.date);
                        const formattedDate = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}, ${dateObj.toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})}`;
                        
                        return (
                          <div key={item.id} className="flex items-center gap-4 p-4 border-b last:border-0 hover:bg-slate-50 group transition-colors">
                            <div className="w-24 shrink-0 text-xs text-slate-400 font-medium">
                              {formattedDate}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-slate-800 uppercase text-sm truncate">{item.keyword}</div>
                              <div className="flex gap-2 mt-1">
                                <Badge variant="outline" style={{ borderColor: OUTCOME_COLORS[item.outcome], color: OUTCOME_COLORS[item.outcome], backgroundColor: `${OUTCOME_COLORS[item.outcome]}15` }} className="text-[9px] px-1.5 py-0 h-4 uppercase font-bold tracking-wider shrink-0 border-transparent">
                                  {item.outcome}
                                </Badge>
                                {item.outcome === 'Converted' && (
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 uppercase font-bold tracking-wider shrink-0 bg-slate-100 text-slate-500 border-transparent">
                                    Offer Picked
                                  </Badge>
                                )}
                                {item.outcome === 'ID lookup' && (
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 uppercase font-bold tracking-wider shrink-0 bg-slate-100 text-slate-500 border-transparent">
                                    Direct ID Lookup
                                  </Badge>
                                )}
                                {item.outcome === 'Not active' && (
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 uppercase font-bold tracking-wider shrink-0 bg-slate-100 text-slate-500 border-transparent">
                                    Inventory Not Live
                                  </Badge>
                                )}
                                {item.outcome === 'Not picked' && (
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 uppercase font-bold tracking-wider shrink-0 bg-slate-100 text-slate-500 border-transparent">
                                    Shown, No Pick
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                              {item.inventory_status === 'available' && (
                                <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 text-[10px]">Available</Badge>
                              )}
                              {item.inventory_status === 'in_inventory_not_active' && (
                                <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 text-[10px]">Not Active</Badge>
                              )}
                              {item.inventory_status === 'not_in_inventory' && (
                                <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-[10px]">No Result</Badge>
                              )}
                              <div className={`font-mono text-xs font-bold w-6 text-right ${item.results_count > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {item.results_count}r
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 px-2 text-[10px] uppercase font-bold tracking-wider opacity-0 group-hover:opacity-100 transition-opacity bg-white border shadow-sm"
                                onClick={() => {
                                  setReSearchKeyword(item.keyword);
                                  setActiveTab('compose');
                                  handleReSearch(item.keyword);
                                }}
                              >
                                {(item.outcome === 'No offers' || item.outcome === 'Not active' || item.outcome === 'Not picked') ? 'Why not →' : 'Compose →'}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="intelligence" className="m-0 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Engagement Funnel */}
                    <Card className="shadow-sm border-slate-100">
                      <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between border-b-0">
                        <CardTitle className="text-base font-bold text-slate-800">Engagement Funnel</CardTitle>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Click → Convert</span>
                      </CardHeader>
                      <CardContent className="p-5">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total Clicks</div>
                            <div className="text-3xl font-bold text-slate-800">{intelData.funnel.total_clicks}</div>
                            <div className="text-[10px] text-slate-400 mt-1">all mails</div>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Real Clicks</div>
                            <div className="text-3xl font-bold text-blue-600">{intelData.funnel.real_clicks}</div>
                            <div className="text-[10px] text-slate-400 mt-1">unique</div>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Conversions</div>
                            <div className="text-3xl font-bold text-green-600">{intelData.funnel.conversions}</div>
                            <div className="text-[10px] text-slate-400 mt-1">picked</div>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Conv. Rate</div>
                            <div className="text-3xl font-bold text-slate-800">{intelData.funnel.conversion_rate}%</div>
                            <div className="text-[10px] text-slate-400 mt-1">vs clicks</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Mail History */}
                    <Card className="shadow-sm border-slate-100">
                      <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between border-b-0">
                        <CardTitle className="text-base font-bold text-slate-800">Mail History</CardTitle>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{intelData.summary.mails_sent} Sent</span>
                      </CardHeader>
                      <CardContent className="p-0">
                        {intelData.mail_history.length === 0 ? (
                          <div className="p-8 text-center text-sm text-slate-400">No mails sent yet</div>
                        ) : (
                          <div className="divide-y border-t">
                            {intelData.mail_history.map(mail => (
                              <div key={mail.id} className="p-4 flex items-start gap-4 hover:bg-slate-50 transition-colors">
                                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shrink-0 mt-0.5">
                                  <Mail className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-slate-800 text-sm truncate">{mail.subject}</div>
                                  <div className="text-xs text-slate-500 mt-1">Email · {mail.offers_count} offers</div>
                                </div>
                                <div className="text-xs font-medium text-slate-400 shrink-0">
                                  {new Date(mail.sent_at).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="compose" className="m-0 h-full flex flex-col space-y-4">
                  {/* Notice */}
                  {!reSearchKeyword && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-amber-800">
                      <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-amber-500" />
                      <div>
                        <h4 className="font-bold text-sm">Pick a watchlist or "why not" search to start</h4>
                        <p className="text-xs mt-1 opacity-80">Go to <strong>Search Activity</strong>, find a search on the watchlist (no offers / not active) or in the why-not bucket, and click its action button.</p>
                      </div>
                    </div>
                  )}

                  {/* Step 1: Re-search */}
                  <Card className="shadow-sm border-slate-100 shrink-0">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">01</div>
                        <h3 className="font-bold text-sm text-slate-800">Re-search Inventory</h3>
                      </div>
                      <p className="text-xs text-slate-500 mb-4">Pull fresh matching offers. Edit the keyword to broaden if the original was too specific (e.g. "FunGames Raid Shadow Legends" → "raid").</p>
                      
                      <div className="flex gap-3">
                        <Input 
                          value={reSearchKeyword}
                          onChange={e => setReSearchKeyword(e.target.value)}
                          placeholder="e.g. &quot;raid shadow&quot; or &quot;vpn&quot;"
                          className="flex-1"
                          onKeyDown={e => e.key === 'Enter' && handleReSearch()}
                        />
                        <Button onClick={() => handleReSearch()} disabled={loadingOffers || !reSearchKeyword.trim()} className="bg-blue-600 hover:bg-blue-700">
                          {loadingOffers ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : 'Search →'}
                        </Button>
                      </div>
                      
                      {relatedOffers.length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">// Select Offers to Include</span>
                            <span className="text-xs font-semibold text-blue-600">{relatedOffers.filter(o => o.selected).length} Selected</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[200px] overflow-y-auto pr-2">
                            {relatedOffers.map(offer => (
                              <div 
                                key={offer.offer_id} 
                                onClick={() => toggleOfferSelect(offer.offer_id)}
                                className={`border rounded-lg p-3 cursor-pointer transition-colors flex gap-3 ${offer.selected ? 'border-blue-500 bg-blue-50/30 shadow-sm' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                              >
                                <Checkbox checked={offer.selected} className="mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <div className="font-bold text-sm text-slate-800 truncate">{offer.name}</div>
                                  <div className="flex items-center gap-2 mt-1.5">
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-emerald-50 text-emerald-700 border-emerald-200">${offer.payout.toFixed(2)}</Badge>
                                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${offer.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                      {offer.status}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Step 2: Email */}
                  <Card className="shadow-sm border-slate-100 flex-1 flex flex-col min-h-0">
                    <CardContent className="p-5 flex flex-col h-full">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">02</div>
                        <h3 className="font-bold text-sm text-slate-800">Email Composition</h3>
                      </div>
                      <p className="text-xs text-slate-500 mb-4">Subject auto-fills from the keyword. Add a personal note if you want it above the offer cards.</p>
                      
                      <div className="space-y-4 flex-1">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Subject Line</label>
                          <Input 
                            value={emailSubject}
                            onChange={e => setEmailSubject(e.target.value)}
                            className="bg-slate-50 border-slate-200 font-medium"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Custom Message (Optional)</label>
                          <Textarea 
                            value={emailMessage}
                            onChange={e => setEmailMessage(e.target.value)}
                            placeholder="Add a personal note above the offer cards..."
                            className="bg-slate-50 border-slate-200 resize-none h-24 mb-4"
                          />
                        </div>

                        {/* Email Template Settings */}
                        <div>
                          <EmailSettingsPanel settings={emailSettings} onChange={setEmailSettings} compact />
                        </div>

                        {/* Schedule Outreach */}
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3 mt-2">
                          <div 
                            className="flex items-center justify-between cursor-pointer select-none"
                            onClick={() => setIsMainScheduled(!isMainScheduled)}
                          >
                            <div className="flex items-center gap-2">
                              <RefreshCw className={`w-4 h-4 text-blue-500 ${isMainScheduled ? 'animate-spin' : ''}`} />
                              <div>
                                <h4 className="font-bold text-xs text-slate-700">Schedule this Outreach</h4>
                                <p className="text-[10px] text-slate-400">Queue email delivery for a future time</p>
                              </div>
                            </div>
                            <Checkbox 
                              checked={isMainScheduled}
                              onCheckedChange={() => {}} // Controlled via parent onClick
                              className="h-5 w-5 border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 pointer-events-none"
                            />
                          </div>

                          {isMainScheduled && (
                            <div className="pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">
                                Choose Send Date &amp; Time
                              </label>
                              <input 
                                type="datetime-local" 
                                value={mainScheduleTime}
                                onChange={(e) => setMainScheduleTime(e.target.value)}
                                className="w-full bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-blue-500"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-4 mt-4 border-t flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-slate-400 font-mono">→</span>
                          <span className="font-bold text-slate-800">{intelData.summary.username}</span>
                          <span className="text-slate-300">·</span>
                          <span className="font-semibold">{relatedOffers.filter(o => o.selected).length} offers</span>
                          <span className="text-slate-300">·</span>
                          <span className="text-slate-500">Potential <span className="font-bold text-emerald-600">${relatedOffers.filter(o => o.selected).reduce((acc, o) => acc + o.payout, 0).toFixed(2)}</span></span>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => setActiveTab('activity')}>Cancel</Button>
                          <Button 
                            onClick={handleSendMail} 
                            disabled={sendingEmail || relatedOffers.filter(o => o.selected).length === 0}
                            className="bg-blue-600 hover:bg-blue-700 shadow-md"
                          >
                            {sendingEmail ? (
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            ) : isMainScheduled ? (
                              <RefreshCw className="h-4 w-4 mr-2" />
                            ) : (
                              <Send className="h-4 w-4 mr-2" />
                            )}
                            {isMainScheduled ? 'Schedule Mail →' : 'Send Mail →'}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Auto-Activation Tab */}
                <TabsContent value="auto_activation" className="m-0 space-y-4">
                  <AutoActivationPanel userId={selectedUser!} username={intelData.summary.username} />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        ) : null}
      </div>
      </div>

      {/* Global Slide-Over Sheet */}
      <Sheet open={isModalOpen} onOpenChange={setIsModalOpen}>
        <SheetContent side="right" className="w-[50vw] sm:max-w-[50vw] p-0 flex flex-col border-l shadow-2xl bg-slate-50/30 overflow-hidden">
          <SheetHeader className="p-6 bg-white border-b sticky top-0 z-10 shrink-0">
            <SheetTitle className="flex items-center gap-2">
              {modalType === 'today' && <span className="text-slate-800">Today's Searches</span>}
              {modalType === 'watchlist' && <span className="text-slate-800">Watchlist — All Publishers</span>}
              {modalType === 'no_offers' && <span className="text-slate-800">No Offers — All Publishers</span>}
              {modalType === 'active_pubs' && <span className="text-slate-800">Active Publishers</span>}
            </SheetTitle>
            <SheetDescription>
              {modalType === 'today' && 'Every search recorded today, across all publishers.'}
              {modalType === 'watchlist' && "Real demand we couldn't serve live - outcomes not active or no offers."}
              {modalType === 'no_offers' && "Outcome = searches that returned zero offers"}
              {modalType === 'active_pubs' && "Everyone with search activity"}
            </SheetDescription>
          </SheetHeader>
          
          <div className="flex-1 overflow-y-auto p-6">
            {modalType === 'active_pubs' ? (
              <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b bg-slate-50/50 flex justify-between items-center">
                  <div className="relative w-72">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search publisher name..." 
                      className="pl-9 bg-white" 
                      value={activePubsSearchQuery}
                      onChange={(e) => setActivePubsSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2"
                    onClick={() => {
                      const csvRows = filteredActivePubs.map(p => ({
                        publisher: p.username,
                        searches: p.total_searches,
                        watchlist: p.watchlist_count,
                        conversions: p.conversions,
                        last_active: p.last_search_at
                      }));
                      const headers = ['Publisher', 'Searches', 'Watchlist', 'Conversions', 'Last Active'];
                      const rows = csvRows.map(r => [`@${r.publisher}`, r.searches, r.watchlist, r.conversions, r.last_active]);
                      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
                      const encodedUri = encodeURI(csvContent);
                      const link = document.createElement("a");
                      link.setAttribute("href", encodedUri);
                      link.setAttribute("download", `active_publishers.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                  >
                    <RefreshCw className="h-4 w-4" /> CSV
                  </Button>
                </div>
                <table className="w-full text-sm text-left">
                  <thead className="bg-white border-b text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Publisher</th>
                      <th className="px-4 py-3 text-right">Searches</th>
                      <th className="px-4 py-3 text-right">Watchlist</th>
                      <th className="px-4 py-3 text-right">Converted</th>
                      <th className="px-4 py-3 text-right">Last Active</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-white">
                    {filteredActivePubs.map((pub) => (
                      <tr key={pub.user_id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-semibold text-blue-600">@{pub.username}</span>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800 text-right">{pub.total_searches}</td>
                        <td className="px-4 py-3 font-bold text-slate-800 text-right">{pub.watchlist_count || 0}</td>
                        <td className="px-4 py-3 font-bold text-slate-800 text-right">{pub.conversions}</td>
                        <td className="px-4 py-3 text-right text-slate-500 font-medium">
                          {new Date(pub.last_search_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                            onClick={() => {
                              setSelectedUser(pub.user_id);
                              setIsModalOpen(false);
                            }}
                          >
                            Open
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-3 text-xs text-slate-500 font-medium bg-slate-50">
                  {filteredActivePubs.length} publishers
                </div>
              </div>
            ) : (
            <div className="space-y-6">
              {/* Dynamic stats breakdown card matching screenshot */}
              <div className="bg-white border rounded-xl shadow-sm p-6 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="relative w-20 h-20 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'No offers', value: modalStats.noOffers, color: OUTCOME_COLORS['No offers'] },
                            { name: 'Not active', value: modalStats.notActive, color: OUTCOME_COLORS['Not active'] },
                            { name: 'Converted', value: modalStats.converted, color: OUTCOME_COLORS['Converted'] },
                            { name: 'Not picked', value: modalStats.notPicked, color: OUTCOME_COLORS['Not picked'] },
                            { name: 'ID lookup', value: modalStats.idLookup, color: OUTCOME_COLORS['ID lookup'] },
                          ].filter(i => i.value > 0)}
                          innerRadius={28}
                          outerRadius={36}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {[
                            { name: 'No offers', value: modalStats.noOffers, color: OUTCOME_COLORS['No offers'] },
                            { name: 'Not active', value: modalStats.notActive, color: OUTCOME_COLORS['Not active'] },
                            { name: 'Converted', value: modalStats.converted, color: OUTCOME_COLORS['Converted'] },
                            { name: 'Not picked', value: modalStats.notPicked, color: OUTCOME_COLORS['Not picked'] },
                            { name: 'ID lookup', value: modalStats.idLookup, color: OUTCOME_COLORS['ID lookup'] },
                          ].filter(i => i.value > 0).map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="font-bold text-lg leading-none">{modalStats.total}</div>
                      <div className="text-[7px] uppercase font-bold text-slate-400">Items</div>
                    </div>
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 text-sm">
                      {modalStats.total} items · {new Set(modalData.map(d => d.publisher)).size} publishers
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: OUTCOME_COLORS['No offers'] }}></div> 
                        No offers: {modalStats.noOffersPct}%
                      </div>
                      {modalType !== 'no_offers' && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: OUTCOME_COLORS['Not active'] }}></div> 
                          Not active: {modalStats.notActivePct}%
                        </div>
                      )}
                      {modalType !== 'watchlist' && modalType !== 'no_offers' && (
                        <>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: OUTCOME_COLORS['Converted'] }}></div> 
                            Converted: {modalStats.convertedPct}%
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: OUTCOME_COLORS['Not picked'] }}></div> 
                            Not picked: {modalStats.notPickedPct}%
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: OUTCOME_COLORS['ID lookup'] }}></div> 
                            ID lookup: {modalStats.idLookupPct}%
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b bg-slate-50/50 flex flex-wrap gap-4 items-center justify-between">
                  <Input 
                    placeholder="Search publisher or keyword..." 
                    className="max-w-[250px] bg-white h-9" 
                    value={modalSearchQuery}
                    onChange={(e) => setModalSearchQuery(e.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <input 
                      type="date" 
                      value={modalDateFrom}
                      onChange={(e) => setModalDateFrom(e.target.value)}
                      className="border rounded px-2 py-1 text-sm bg-white text-slate-600 h-9 focus:outline-none"
                    />
                    <span className="text-slate-400 text-xs">to</span>
                    <input 
                      type="date" 
                      value={modalDateTo}
                      onChange={(e) => setModalDateTo(e.target.value)}
                      className="border rounded px-2 py-1 text-sm bg-white text-slate-600 h-9 focus:outline-none"
                    />
                    <Button 
                      className="h-9 bg-blue-100 text-blue-700 hover:bg-blue-200 border-none shadow-none gap-2 px-6 font-semibold"
                      onClick={() => {
                        if (selectedRowKeys.size === 0) {
                          toast({
                            title: "No selection",
                            description: "Please select at least one row to compose bulk outreach.",
                            variant: "destructive"
                          });
                          return;
                        }
                        const selectedList = filteredModalData.filter(r => selectedRowKeys.has(`${r.publisher}-${r.keyword}-${r.outcome}`));
                        const formattedList = selectedList.map(r => {
                          const log = modalData.find(d => d.publisher === r.publisher);
                          return {
                            userId: log?.userId || '',
                            username: r.publisher,
                            keyword: r.keyword
                          };
                        }).filter(u => u.userId);
                        
                        if (formattedList.length > 0) {
                          openOutreachModal(formattedList);
                        } else {
                          toast({ title: 'Error', description: 'Could not find user IDs for the selection', variant: 'destructive' });
                        }
                      }}
                    >
                      <Mail className="w-4 h-4" /> Mail
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-9 font-normal text-slate-600 gap-2"
                      onClick={() => downloadCSV(filteredModalData, `${modalType}_searches`)}
                    >
                      <RefreshCw className="w-4 h-4" /> CSV
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-9 font-normal text-slate-600 gap-2"
                      onClick={() => copyToClipboard(filteredModalData)}
                    >
                      <FileText className="w-4 h-4" /> Copy
                    </Button>
                  </div>
                </div>
                
                {loadingModal ? (
                  <div className="p-8 text-center text-slate-500 font-medium">Loading dataset...</div>
                ) : (
                  <>
                  <table className="w-full text-sm text-left">
                    <thead className="bg-white border-b text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 w-10">
                          <Checkbox 
                            checked={filteredModalData.length > 0 && selectedRowKeys.size === filteredModalData.length}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedRowKeys(new Set(filteredModalData.map(r => `${r.publisher}-${r.keyword}-${r.outcome}`)));
                              } else {
                                setSelectedRowKeys(new Set());
                              }
                            }}
                          />
                        </th>
                        <th className="px-4 py-3">Publisher</th>
                        <th className="px-4 py-3">Keyword</th>
                        <th className="px-4 py-3 text-right">Date / Time</th>
                        <th className="px-4 py-3 text-center">Outcome</th>
                        <th className="px-4 py-3 text-right">Results</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y bg-white">
                      {filteredModalData.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-4 py-3">
                            <Checkbox 
                              checked={selectedRowKeys.has(`${row.publisher}-${row.keyword}-${row.outcome}`)}
                              onCheckedChange={(checked) => {
                                const newKeys = new Set(selectedRowKeys);
                                const key = `${row.publisher}-${row.keyword}-${row.outcome}`;
                                if (checked) {
                                  newKeys.add(key);
                                } else {
                                  newKeys.delete(key);
                                }
                                setSelectedRowKeys(newKeys);
                              }}
                            />
                          </td>
                          <td className="px-4 py-3 font-medium text-blue-600">@{row.publisher}</td>
                          <td className="px-4 py-3 font-semibold text-slate-800">{row.keyword}</td>
                          <td className="px-4 py-3 text-right text-slate-500">
                            {new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}, {new Date(row.date).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-wider ${row.outcome === 'Not active' ? 'bg-orange-50 text-orange-600 border-orange-200' : row.outcome === 'No offers' ? 'bg-red-50 text-red-600 border-red-200' : row.outcome === 'Not picked' ? 'bg-red-950/10 text-red-900 border-red-950/20' : row.outcome === 'ID lookup' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-green-50 text-green-600 border-green-200'}`}>
                              {row.outcome}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-800">{row.results}</td>
                          <td className="px-4 py-3 text-right">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                const log = modalData.find(d => d.publisher === row.publisher);
                                if (log && log.userId) {
                                  openOutreachModal([{
                                    userId: log.userId,
                                    username: row.publisher,
                                    keyword: row.keyword
                                  }]);
                                } else {
                                  toast({ title: 'Error', description: 'Could not find user ID for this publisher', variant: 'destructive' });
                                }
                              }}
                            >
                              Mail
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-3 text-xs text-slate-500 font-medium bg-slate-50">
                    Showing {filteredModalData.length} of {modalData.length} · {selectedRowKeys.size} selected
                  </div>
                  </>
                )}
              </div>
            </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Email Outreach Composer & Scheduler Dialog */}
      <Dialog open={isOutreachOpen} onOpenChange={setIsOutreachOpen}>
        <DialogContent className="max-w-5xl w-[90vw] p-0 overflow-hidden bg-slate-900 text-white border-slate-800 rounded-2xl shadow-2xl">
          <DialogHeader className="p-6 bg-slate-950 border-b border-slate-800 sticky top-0 z-10">
            <DialogTitle className="flex items-center gap-2 text-xl font-extrabold text-blue-400">
              <Mail className="w-5 h-5" />
              <span>Email Outreach Composer &amp; Scheduler</span>
              <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 font-semibold ml-2">
                {outreachUsers.length > 1 ? `Bulk (${outreachUsers.length} publishers)` : 'Single Publisher'}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-sm mt-1">
              Preview, edit, and schedule personalized offer emails.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden h-[75vh]">
            {/* Left Panel: Inputs & Configuration */}
            <div className="lg:col-span-7 p-6 overflow-y-auto space-y-6 border-r border-slate-800">
              {/* Recipients list */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                  Recipient(s)
                </label>
                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto p-2 bg-slate-950/60 border border-slate-800 rounded-lg">
                  {outreachUsers.map((u, index) => (
                    <Badge key={index} className="bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 font-mono text-xs">
                      @{u.username} <span className="text-slate-500 mx-1">({u.keyword})</span>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Subject & Custom Message */}
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                    Subject Line
                  </label>
                  <Input 
                    value={outreachSubject}
                    onChange={(e) => setOutreachSubject(e.target.value)}
                    className="bg-slate-950/80 border-slate-800 focus:border-blue-500 font-medium text-white h-10 rounded-lg"
                    placeholder="Enter email subject..."
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                    Custom Message Note (Optional)
                  </label>
                  <Textarea 
                    value={outreachMessage}
                    onChange={(e) => setOutreachMessage(e.target.value)}
                    className="bg-slate-950/80 border-slate-800 focus:border-blue-500 text-white rounded-lg resize-none h-32 text-sm leading-relaxed"
                    placeholder="Add a personal touch before the offer list..."
                  />
                </div>
              </div>

              {/* Match Offers Checklist */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                  Select Recommended Offers
                </label>
                {loadingOutreachOffers ? (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                    <span className="text-sm font-medium">Fetching matching offers...</span>
                  </div>
                ) : outreachOffers.length === 0 ? (
                  <div className="p-4 rounded-lg bg-slate-950/40 border border-slate-800 text-center text-slate-400 text-sm">
                    No related offers found for keyword "{outreachUsers[0]?.keyword}".
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1">
                    {outreachOffers.map((o) => (
                      <div 
                        key={o.offer_id}
                        onClick={() => {
                          setOutreachOffers(prev => prev.map(item => item.offer_id === o.offer_id ? { ...item, selected: !item.selected } : item));
                        }}
                        className={`flex gap-3 items-center p-3 border rounded-xl cursor-pointer transition-all ${o.selected ? 'bg-blue-500/10 border-blue-500/50 shadow-sm shadow-blue-500/5' : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'}`}
                      >
                        <Checkbox checked={o.selected} onCheckedChange={() => {}} className="border-slate-600 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm text-slate-100 truncate">{o.name}</h4>
                          <div className="flex gap-2 items-center mt-1">
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] py-0.5 px-1.5">${o.payout.toFixed(2)}</Badge>
                            <Badge className="bg-slate-800 text-slate-400 border-slate-700 text-[10px] py-0.5 px-1.5">{o.status}</Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Schedule Outreach */}
              <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-4">
                <div 
                  className="flex items-center justify-between cursor-pointer select-none"
                  onClick={() => setIsScheduled(!isScheduled)}
                >
                  <div className="flex items-center gap-2">
                    <RefreshCw className={`w-4 h-4 text-blue-400 ${isScheduled ? 'animate-spin' : ''}`} />
                    <div>
                      <h4 className="font-bold text-sm text-slate-200">Schedule this Outreach</h4>
                      <p className="text-xs text-slate-400">Queue email delivery for a future time</p>
                    </div>
                  </div>
                  <Checkbox 
                    checked={isScheduled}
                    onCheckedChange={() => {}} // Controlled via parent onClick
                    className="h-5 w-5 border-slate-600 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500 pointer-events-none"
                  />
                </div>

                {isScheduled && (
                  <div className="pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                      Choose Send Date &amp; Time
                    </label>
                    <input 
                      type="datetime-local" 
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel: Live Preview */}
            <div className="lg:col-span-5 p-6 bg-slate-950 overflow-y-auto flex flex-col h-full">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 block shrink-0">
                Live Email Preview
              </label>

              {/* Styled Email Frame */}
              <div className="border border-slate-800 rounded-xl bg-white text-slate-900 shadow-xl flex-1 overflow-hidden flex flex-col font-sans">
                {/* Header */}
                <div className="bg-slate-50 border-b p-3 text-xs text-slate-500 font-mono space-y-1">
                  <div><span className="font-semibold text-slate-400">To:</span> {outreachUsers[0] ? `${outreachUsers[0].username}@moustacheleads.com` : 'publisher@domain.com'}</div>
                  <div><span className="font-semibold text-slate-400">Subject:</span> {outreachSubject || 'No Subject'}</div>
                </div>

                {/* Email Body Preview */}
                <div className="p-5 flex-1 overflow-y-auto text-sm space-y-4">
                  {/* Greeting */}
                  <div>
                    <span className="font-bold">Hi @{outreachUsers[0]?.username || 'Publisher'},</span>
                  </div>

                  {/* Body Text */}
                  <div className="text-slate-600 whitespace-pre-wrap leading-relaxed text-xs">
                    {outreachMessage || 'No body message text added.'}
                  </div>

                  {/* Offers List */}
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Recommended Offers</div>
                    {outreachOffers.filter(o => o.selected).length === 0 ? (
                      <div className="text-xs text-slate-400 italic text-center py-4 bg-slate-50 rounded-lg">No offers checked for recommendations</div>
                    ) : (
                      outreachOffers.filter(o => o.selected).map((o) => (
                        <div key={o.offer_id} className="flex items-center gap-3 p-3 border rounded-lg bg-slate-50 hover:bg-slate-100/50 transition-colors">
                          <div className="w-10 h-10 rounded bg-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                            {o.image_url ? (
                              <img src={o.image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Mail className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h5 className="font-bold text-xs text-slate-800 truncate">{o.name}</h5>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">{o.category || o.vertical || 'Direct'}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-bold text-xs text-emerald-600">${o.payout.toFixed(2)}</span>
                            <div className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Payout</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Footer Signature */}
                <div className="bg-slate-50 border-t p-4 text-[10px] text-slate-400 text-center shrink-0">
                  You are receiving this email matching your search history.
                  <br />Moustache Leads Admin panel © 2026.
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-between items-center shrink-0">
            <div className="text-xs text-slate-400">
              {isScheduled ? (
                <span>Queueing for delivery on <span className="font-bold text-blue-400">{new Date(scheduleTime).toLocaleString()}</span></span>
              ) : (
                <span>Outreach will be sent <span className="font-bold text-emerald-400">immediately</span></span>
              )}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline"
                className="bg-transparent text-slate-300 border-slate-700 hover:bg-slate-800"
                onClick={() => setIsOutreachOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                disabled={sendingOutreach || outreachOffers.filter(o => o.selected).length === 0}
                onClick={handleSendOrScheduleOutreach}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg gap-2 font-bold px-6"
              >
                {sendingOutreach ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : isScheduled ? (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Schedule Outreach</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Outreach Now</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/** Auto-Activation History Button — opens a sheet showing all users who received auto-activated offers */
function AutoActivationHistoryButton() {
  const [open, setOpen] = useState(false);
  const [activations, setActivations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const token = localStorage.getItem('token');

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/per-user-offers/activations?per_page=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setActivations(data.activations || []);
      }
    } catch (err) {
      console.error('Failed to fetch activation history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    fetchHistory();
  };

  // Group activations by user
  const groupedByUser = activations.reduce((acc: Record<string, any[]>, act: any) => {
    const key = act.user_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(act);
    return acc;
  }, {});

  const userList = Object.entries(groupedByUser).map(([userId, acts]) => ({
    user_id: userId,
    username: (acts as any[])[0]?.username || 'Unknown',
    total_offers: (acts as any[]).reduce((sum: number, a: any) => sum + (a.offer_ids?.length || 0), 0),
    activations: acts as any[],
    latest: (acts as any[])[0]?.activated_at,
  }));

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex flex-col items-center cursor-pointer group"
      >
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 group-hover:text-slate-800 transition-colors flex items-center gap-1">
          <History className="w-3 h-3" />
          History
        </div>
        <div className="text-sm font-bold text-blue-600">View</div>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[45vw] sm:max-w-[45vw] p-0 flex flex-col border-l shadow-2xl overflow-hidden">
          <SheetHeader className="p-5 bg-white border-b shrink-0">
            <SheetTitle className="flex items-center gap-2 text-base">
              <History className="w-4 h-4 text-blue-500" />
              Auto-Activation History
            </SheetTitle>
            <SheetDescription className="text-xs">
              All users who received auto-activated offers. Click a user to see which offers were sent.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="text-center py-8 text-slate-500">Loading history...</div>
            ) : userList.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <p className="text-sm">No auto-activations yet.</p>
                <p className="text-xs mt-1">The system will auto-send offers after publishers search for inactive inventory.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {userList.map((user) => (
                  <div key={user.user_id} className="border rounded-lg overflow-hidden bg-white">
                    {/* User row */}
                    <button
                      onClick={() => setExpandedUser(expandedUser === user.user_id ? null : user.user_id)}
                      className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-slate-800">@{user.username}</div>
                          <div className="text-[10px] text-slate-500">
                            {user.total_offers} offers sent · Last: {formatDate(user.latest)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                          {user.activations.length} batch{user.activations.length !== 1 ? 'es' : ''}
                        </span>
                        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expandedUser === user.user_id ? 'rotate-90' : ''}`} />
                      </div>
                    </button>

                    {/* Expanded: show offers */}
                    {expandedUser === user.user_id && (
                      <div className="border-t bg-slate-50/50 p-3 space-y-3">
                        {user.activations.map((act: any, idx: number) => (
                          <div key={idx} className="bg-white border rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={`text-[9px] ${act.trigger === 'search_auto_activation' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                                  {act.trigger === 'search_auto_activation' ? '🔍 Auto (Search)' : '👤 Manual'}
                                </Badge>
                                <Badge variant="outline" className={`text-[9px] ${act.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                  {act.status}
                                </Badge>
                              </div>
                              <span className="text-[10px] text-slate-400">{formatDate(act.activated_at)}</span>
                            </div>
                            {act.trigger_reason && (
                              <div className="text-[11px] text-slate-600">
                                <strong>Why:</strong> {act.trigger_reason}
                              </div>
                            )}
                            {act.keywords?.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {act.keywords.map((kw: string, i: number) => (
                                  <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{kw}</span>
                                ))}
                              </div>
                            )}
                            {/* Offers list */}
                            <div className="grid grid-cols-1 gap-1.5 mt-1">
                              {(act.offers || []).map((offer: any, oi: number) => (
                                <div key={oi} className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                                  <div className="min-w-0 flex-1">
                                    <div className="text-[11px] font-medium text-slate-700 truncate">{offer.name}</div>
                                    <div className="text-[9px] text-slate-400">{offer.offer_id} · {offer.category || offer.vertical || '—'}</div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0 ml-2">
                                    <span className="text-[10px] font-semibold text-green-600">${offer.payout}</span>
                                    <Badge variant="outline" className="text-[8px] bg-green-50 text-green-700 border-green-200">Active for user</Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {act.clicks > 0 && (
                              <div className="text-[10px] text-green-600 font-medium">✓ {act.clicks} click(s) received</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Auto-Activation Quick Control — shown in the top bar of Search Intelligence */
function AutoActivationQuickControl() {
  const [settings, setSettings] = useState<{ enabled: boolean; delay_hours: number; max_offers: number; grant_duration_days: number; email_subject?: string; email_message?: string; template_style?: string; payout_type?: string } | null>(null);
  const [showPopover, setShowPopover] = useState(false);
  const [showTemplateSettings, setShowTemplateSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emailSettings, setEmailSettings] = useState<EmailSettings>(DEFAULT_EMAIL_SETTINGS);
  const { toast } = useToast();
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/admin/per-user-offers/settings`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => { if (d.success) setSettings(d.settings); })
      .catch(() => {});
  }, []);

  const toggleService = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/per-user-offers/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled: !settings.enabled })
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        toast({ title: data.settings.enabled ? 'Auto-Activation Resumed' : 'Auto-Activation Paused' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/per-user-offers/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        toast({ title: 'Settings saved' });
        setShowPopover(false);
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setShowPopover(!showPopover)}
        className="flex flex-col items-center cursor-pointer group"
      >
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 group-hover:text-slate-800 transition-colors flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${settings.enabled ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`}></span>
          Auto-Send
        </div>
        <div className={`text-sm font-bold ${settings.enabled ? 'text-green-600' : 'text-red-500'}`}>
          {settings.enabled ? `${settings.delay_hours}h` : 'OFF'}
        </div>
      </button>

      {showPopover && (
        <div className="absolute top-full right-0 mt-2 w-80 max-h-[80vh] overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Auto-Activation Service</span>
            <button
              onClick={toggleService}
              disabled={saving}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${settings.enabled ? 'bg-green-500' : 'bg-slate-300'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${settings.enabled ? 'translate-x-4.5' : 'translate-x-0.5'}`} style={{ transform: settings.enabled ? 'translateX(16px)' : 'translateX(2px)' }} />
            </button>
          </div>
          <p className="text-[10px] text-slate-500">
            {settings.enabled
              ? 'Running — auto-sends offers to publishers who search for inactive inventory'
              : 'Paused — no auto-activation happening'}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase">Delay (h)</label>
              <input
                type="number"
                min={1}
                max={72}
                value={settings.delay_hours}
                onChange={(e) => setSettings({ ...settings, delay_hours: Number(e.target.value) })}
                className="w-full mt-0.5 h-7 text-xs border rounded px-2 text-center"
              />
            </div>
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase">Offers</label>
              <input
                type="number"
                min={1}
                max={20}
                value={settings.max_offers}
                onChange={(e) => setSettings({ ...settings, max_offers: Number(e.target.value) })}
                className="w-full mt-0.5 h-7 text-xs border rounded px-2 text-center"
              />
            </div>
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase">Expiry (d)</label>
              <input
                type="number"
                min={7}
                max={90}
                value={settings.grant_duration_days}
                onChange={(e) => setSettings({ ...settings, grant_duration_days: Number(e.target.value) })}
                className="w-full mt-0.5 h-7 text-xs border rounded px-2 text-center"
              />
            </div>
          </div>
          {/* Email Content Settings */}
          <div className="border-t pt-2 space-y-2">
            <label className="text-[9px] font-bold text-slate-400 uppercase">Email Subject</label>
            <input
              type="text"
              value={settings.email_subject || 'Recommended Offers for You'}
              onChange={(e) => setSettings({ ...settings, email_subject: e.target.value })}
              className="w-full h-7 text-xs border rounded px-2"
              placeholder="Recommended Offers for You"
            />
            <label className="text-[9px] font-bold text-slate-400 uppercase">Email Message</label>
            <textarea
              value={settings.email_message || 'Hi {name},\n\nWe have handpicked {count} offers that we think are a great fit for you. Check them out and start earning!'}
              onChange={(e) => setSettings({ ...settings, email_message: e.target.value })}
              className="w-full h-16 text-xs border rounded px-2 py-1 resize-none"
              placeholder="Use {name} and {count} as placeholders"
            />
            <p className="text-[9px] text-slate-400">Use {'{name}'} for publisher name, {'{count}'} for offer count</p>
          </div>
          {/* Template Settings Toggle */}
          <div className="border-t pt-2">
            <button
              onClick={() => setShowTemplateSettings(!showTemplateSettings)}
              className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <Settings2 className="w-3 h-3" />
              {showTemplateSettings ? 'Hide' : 'Show'} Email Template Settings
            </button>
            {showTemplateSettings && (
              <div className="mt-2 max-h-48 overflow-y-auto border rounded p-2 bg-slate-50">
                <EmailSettingsPanel settings={emailSettings} onChange={setEmailSettings} />
              </div>
            )}
          </div>
          <Button size="sm" onClick={saveSettings} disabled={saving} className="w-full h-7 text-xs bg-blue-600 hover:bg-blue-700">
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Auto-Activation Panel — shows service controls + history for a specific user */
function AutoActivationPanel({ userId, username }: { userId: string; username: string }) {
  const [settings, setSettings] = useState<{ enabled: boolean; delay_hours: number; max_offers: number; grant_duration_days: number } | null>(null);
  const [activations, setActivations] = useState<any[]>([]);
  const [grants, setGrants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const { toast } = useToast();
  const token = localStorage.getItem('token');

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch settings
      const settingsRes = await fetch(`${API_BASE_URL}/api/admin/per-user-offers/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const settingsData = await settingsRes.json();
      if (settingsData.success) setSettings(settingsData.settings);

      // Fetch user-specific activations
      const userRes = await fetch(`${API_BASE_URL}/api/admin/per-user-offers/user/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const userData = await userRes.json();
      if (userData.success) {
        setActivations(userData.activations || []);
        setGrants(userData.grants || []);
      }
    } catch (err) {
      console.error('Failed to load auto-activation data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [userId]);

  const handleToggleService = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/per-user-offers/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled: !settings.enabled })
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        toast({ title: data.settings.enabled ? 'Service Resumed' : 'Service Paused' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/per-user-offers/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        toast({ title: 'Settings saved' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleRunNow = async () => {
    setRunning(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/per-user-offers/run-now`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Done', description: `${data.offers_activated} offers activated` });
        fetchData();
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  const handleDeactivate = async (activationId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/per-user-offers/deactivate/${activationId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Deactivated' });
        fetchData();
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getDaysLeft = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  if (loading) return <div className="p-6 text-center text-slate-500">Loading auto-activation data...</div>;

  return (
    <div className="space-y-5">
      {/* Service Controls */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-blue-500" />
            Auto-Activation Service Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleToggleService}
                    disabled={saving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.enabled ? 'bg-green-500' : 'bg-slate-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <span className={`text-sm font-semibold ${settings.enabled ? 'text-green-600' : 'text-slate-500'}`}>
                    {settings.enabled ? '● Service Running' : '○ Service Paused'}
                  </span>
                </div>
                <Button size="sm" variant="outline" onClick={handleRunNow} disabled={running} className="text-xs gap-1">
                  <RefreshCw className={`h-3 w-3 ${running ? 'animate-spin' : ''}`} />
                  {running ? 'Running...' : 'Run Now'}
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Delay (hours)</label>
                  <Input
                    type="number"
                    min={1}
                    max={72}
                    value={settings.delay_hours}
                    onChange={(e) => setSettings({ ...settings, delay_hours: Number(e.target.value) })}
                    className="mt-1 h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Max Offers</label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={settings.max_offers}
                    onChange={(e) => setSettings({ ...settings, max_offers: Number(e.target.value) })}
                    className="mt-1 h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Expiry (days)</label>
                  <Input
                    type="number"
                    min={7}
                    max={90}
                    value={settings.grant_duration_days}
                    onChange={(e) => setSettings({ ...settings, grant_duration_days: Number(e.target.value) })}
                    className="mt-1 h-8 text-sm"
                  />
                </div>
              </div>
              <Button size="sm" onClick={handleSaveSettings} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-xs">
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* User's Auto-Activation History */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Mail className="h-4 w-4 text-orange-500" />
            Offers Sent to @{username} (Auto-Activated)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activations.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">No auto-activations for this user yet. The system will send offers after they search for inactive inventory.</p>
          ) : (
            <div className="space-y-3">
              {activations.map((act) => {
                const daysLeft = getDaysLeft(act.expires_at);
                return (
                  <div key={act._id} className="border border-slate-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={`text-[10px] ${act.trigger === 'search_auto_activation' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-purple-100 text-purple-700 border-purple-200'}`}>
                          {act.trigger === 'search_auto_activation' ? '🔍 Auto (Search)' : '👤 Manual'}
                        </Badge>
                        <Badge className={`text-[10px] ${act.status === 'active' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                          {act.status}
                        </Badge>
                        {act.status === 'active' && daysLeft !== null && (
                          <span className={`text-[10px] font-semibold ${daysLeft <= 7 ? 'text-orange-600' : 'text-slate-500'}`}>
                            {daysLeft}d until expiry
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {act.clicks > 0 && (
                          <span className="text-[10px] font-bold text-green-600">{act.clicks} clicks</span>
                        )}
                        {act.status === 'active' && (
                          <Button variant="ghost" size="sm" className="h-6 text-[10px] text-red-500 hover:text-red-700" onClick={() => handleDeactivate(act._id)}>
                            Deactivate
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      <strong>Reason:</strong> {act.trigger_reason}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Activated: {formatDate(act.activated_at)} · Expires: {formatDate(act.expires_at)}
                      {act.last_click_at && ` · Last click: ${formatDate(act.last_click_at)}`}
                    </div>
                    {act.keywords?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {act.keywords.map((kw: string, i: number) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{kw}</span>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-1.5 mt-1">
                      {(act.offers || []).map((offer: any, idx: number) => (
                        <div key={idx} className="text-[10px] p-1.5 rounded bg-slate-50 border border-slate-100">
                          <div className="font-medium text-slate-700 truncate">{offer.name}</div>
                          <div className="flex items-center gap-1 text-slate-400 mt-0.5">
                            <span>{offer.category || offer.vertical || '—'}</span>
                            <span className="text-green-600 font-semibold">${offer.payout}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Grants for this user */}
      {grants.length > 0 && (
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              All Exclusive Grants for @{username}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-2 py-1.5 font-bold text-slate-500 uppercase text-[10px]">Offer ID</th>
                  <th className="text-left px-2 py-1.5 font-bold text-slate-500 uppercase text-[10px]">Source</th>
                  <th className="text-left px-2 py-1.5 font-bold text-slate-500 uppercase text-[10px]">Granted</th>
                  <th className="text-left px-2 py-1.5 font-bold text-slate-500 uppercase text-[10px]">Expires</th>
                  <th className="text-center px-2 py-1.5 font-bold text-slate-500 uppercase text-[10px]">Status</th>
                  <th className="text-center px-2 py-1.5 font-bold text-slate-500 uppercase text-[10px]">Clicked</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {grants.map((g) => (
                  <tr key={g._id} className="hover:bg-slate-50">
                    <td className="px-2 py-1.5 font-mono text-slate-700">{g.offer_id}</td>
                    <td className="px-2 py-1.5">
                      <Badge variant="outline" className="text-[9px]">
                        {g.source === 'search_auto_activation' ? '🔍 Auto' : g.source === 'admin_manual' ? '👤 Admin' : g.source}
                      </Badge>
                    </td>
                    <td className="px-2 py-1.5 text-slate-500">{formatDate(g.granted_at)}</td>
                    <td className="px-2 py-1.5 text-slate-500">{formatDate(g.expires_at)}</td>
                    <td className="px-2 py-1.5 text-center">
                      {g.is_active ? (
                        <span className="text-green-600 font-bold">Active</span>
                      ) : (
                        <span className="text-red-500">Expired</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {g.clicked ? (
                        <span className="text-green-600">✓ {g.click_date ? formatDate(g.click_date) : 'Yes'}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default AdminSearchIntelligence;
