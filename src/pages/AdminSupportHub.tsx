import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageSquare, Send, Users, Mail, Phone,
  Search, Filter, Plus, Clock, CheckCircle,
  AlertCircle, ChevronRight, Hash, Globe,
  Settings, Layout, Inbox, Sparkles, Zap, ChevronDown,
  LayoutDashboard, UserCheck, MessageCircle, MapPin, Tag
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AdminPageGuard } from '@/components/AdminPageGuard';
import { supportHubService, SupportTemplate, SupportConversation, SupportMessage } from '../services/supportHubService';
import loginLogsService from '@/services/loginLogsService';

const normalizeVertical = (v: any): string => {
  if (!v) return '';
  const lower = String(v).toLowerCase().trim();
  if (lower === 'sweeps' || lower.includes('sweep')) return 'Sweepstakes';
  if (lower.includes('finance') || lower.includes('money')) return 'Finance';
  if (lower.includes('loan')) return 'Loan';
  if (lower.includes('insur')) return 'Insurance';
  if (lower.includes('educat')) return 'Education';
  if (lower.includes('install')) return 'Installs';
  if (lower.includes('game')) return 'Games';
  if (lower.includes('survey')) return 'Survey';
  if (lower.includes('dating')) return 'Dating';
  if (lower.includes('trial')) return 'Free Trial';
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

const getVerticalsArray = (user: any): string[] => {
  if (!user) return [];
  const raw = user.verticals || 
              (user.signup_preferences && user.signup_preferences.verticals) || 
              user.vertical || 
              [];
  return Array.isArray(raw) ? raw : [raw];
};

export const SupportHubContent: React.FC<{ 
  onClose?: () => void;
  initialUsers?: any[];
  apiUrl?: string;
}> = ({ onClose, initialUsers, apiUrl }) => {
  const BASE_API_URL = apiUrl || import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const [activeTab, setActiveTab] = useState('explorer');
  const [loading, setLoading] = useState(true);
  const [allSupportUsers, setAllSupportUsers] = useState<any[]>(initialUsers || []);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [templates, setTemplates] = useState<SupportTemplate[]>([]);
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVertical, setFilterVertical] = useState('All');
  const [filterCountry, setFilterCountry] = useState('All');

  useEffect(() => {
    if (initialUsers) {
      setAllSupportUsers(initialUsers);
    }
  }, [initialUsers]);

  useEffect(() => {
    if (allSupportUsers.length > 0) {
      const allVerts = new Set();
      allSupportUsers.forEach(u => {
        const v = Array.isArray(u.verticals) ? u.verticals : [u.verticals];
        v.forEach(item => { if (item) allVerts.add(String(item)); });
      });
      console.log("Support Hub: Available verticals in data:", Array.from(allVerts));
    }
  }, [allSupportUsers]);

  // Bulk Send State
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedMessageType, setSelectedMessageType] = useState<string>('Geo-based');
  const [selectedChannel, setSelectedChannel] = useState<string>('Email');
  const [isSending, setIsSending] = useState(false);
  const [scheduledTime, setScheduledTime] = useState<string>('');

  // Inbox State
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  // Template Preview Helper
  const getPreview = (templateBody: string, user?: any) => {
    if (!templateBody) return "";
    const u = user || (filteredUsers[0] || { username: "{user}", country: "{location}", verticals: ["{vertical}"] });
    let body = templateBody;
    
    // Core Placeholders
    body = body.replace(/{user}/g, u.username || "User");
    body = body.replace(/{location}/g, u.city || u.country || "your location");
    
    const v = Array.isArray(u.verticals) ? u.verticals[0] : u.verticals;
    body = body.replace(/{vertical}/g, v || "exclusive");
    
    // Strategy based hooks
    if (selectedMessageType === 'Geo-based') {
      body = `Hey ${u.username || 'User'}, users from ${u.country || 'your area'} love our latest ${v || 'offers'}! ` + body;
    } else if (selectedMessageType === 'Vertical-based') {
      body = `Hey ${u.username || 'User'}, need help with ${v || 'your favorite'} deals? ` + body;
    } else if (selectedMessageType === 'Combined') {
      body = `Hey ${u.username || 'User'}, check out the top ${v || 'exclusive'} offers near ${u.city || u.country || 'you'}: ` + body;
    }
    
    body = body.replace(/{offer}/g, "High-Payout Bundle");
    return body;
  };

  const activeTemplate = useMemo(() => {
    return templates.find(t => t._id === selectedTemplateId);
  }, [templates, selectedTemplateId]);

  const previewUser = useMemo(() => {
    if (selectedUsers.size === 0) return null;
    const firstId = Array.from(selectedUsers)[0];
    return allSupportUsers.find(u => String(u.user_id || u._id) === firstId);
  }, [selectedUsers, allSupportUsers]);

  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);
  const loadData = async () => {
    // Even if initialUsers is provided, we fetch full list in background to ensure we have ALL data
    // but we can show initialUsers immediately for speed
    if (initialUsers && initialUsers.length > 0 && allSupportUsers.length === 0) {
      setAllSupportUsers(initialUsers);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      supportHubService.setBaseUrl(BASE_API_URL);
      const token = localStorage.getItem('token');
      
      // Fetch users and intelligence in parallel
      const [usersRes, intelRes] = await Promise.all([
        fetch(`${BASE_API_URL}/api/auth/admin/users`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()),
        fetch(`${BASE_API_URL}/api/admin/all-user-intelligence`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()).catch(() => ({ intelligence: [] }))
      ]);

      if (usersRes.users) {
        // Merge intelligence into users
        const intelMap = new Map();
        (intelRes.intelligence || []).forEach((item: any) => {
          intelMap.set(item.user_id, item);
        });

        const enrichedUsers = usersRes.users.map((u: any) => {
          const uId = String(u._id);
          const intel = intelMap.get(uId);
          if (intel) {
            // Combine profile verticals with intelligence verticals (clicked/searched)
            const profileVerts = getVerticalsArray(u);
            const intelVerts = intel.top_categories || [];
            const combinedVerts = Array.from(new Set([...profileVerts, ...intelVerts])).filter(Boolean);
            
            return {
              ...u,
              verticals: combinedVerts,
              intelligence_geos: intel.top_geos || []
            };
          }
          return u;
        });

        console.log(`Support Hub: Loaded ${enrichedUsers.length} users with intelligence`);
        setAllSupportUsers(enrichedUsers);
      }

      const templatesData = await supportHubService.getTemplates();
      setTemplates(Array.isArray(templatesData) ? templatesData : []);
      const conversationsData = await supportHubService.getConversations();
      setConversations(Array.isArray(conversationsData) ? conversationsData : []);
    } catch (error) {
      console.error("Failed to load support hub data", error);
      if (allSupportUsers.length === 0) {
        toast({ title: "Error", description: "Failed to load dashboard data", variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return allSupportUsers.filter(u => {
      const matchesSearch = !searchTerm || 
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase());
      
      const userVerts = getVerticalsArray(u);
      
      const matchesVertical = filterVertical === 'All' || 
        userVerts.some((v: any) => {
          const norm = normalizeVertical(v);
          return norm === filterVertical;
        });
      
      const matchesCountry = filterCountry === 'All' || u.country === filterCountry;
      
      return matchesSearch && matchesVertical && matchesCountry;
    });
  }, [allSupportUsers, searchTerm, filterVertical, filterCountry]);
  const toggleUserSelection = (id: string) => {
    const next = new Set(selectedUsers);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedUsers(next);
  };

  const handleBulkSend = async () => {
    if (!selectedTemplateId || selectedUsers.size === 0) return;
    setIsSending(true);
    try {
      await supportHubService.bulkSend(Array.from(selectedUsers), selectedTemplateId, selectedChannel, scheduledTime);
      toast({ 
        title: scheduledTime ? "Scheduled" : "Success", 
        description: scheduledTime 
          ? `Message scheduled for ${new Date(scheduledTime).toLocaleString()}`
          : `Message sent to ${selectedUsers.size} users via ${selectedChannel}` 
      });
      setBulkModalOpen(false);
      setSelectedUsers(new Set());
      setScheduledTime('');
      loadData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to send messages", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const loadMessages = async (convId: string) => {
    try {
      const data = await supportHubService.getMessages(convId);
      setMessages(data);
    } catch (e) { console.error(e); }
  };

  const handleReply = async () => {
    if (!selectedConvId || !replyText.trim()) return;
    setIsReplying(true);
    try {
      await supportHubService.sendReply(selectedConvId, replyText);
      setReplyText('');
      loadMessages(selectedConvId);
      toast({ title: "Sent", description: "Your reply has been dispatched." });
    } catch (e) {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
    } finally {
      setIsReplying(false);
    }
  };

  useEffect(() => {
    if (selectedConvId) {
      loadMessages(selectedConvId);
      const interval = setInterval(() => loadMessages(selectedConvId), 5000);
      return () => clearInterval(interval);
    }
  }, [selectedConvId]);

  const PREDEFINED_VERTICALS = [
    "Survey", "Sweepstakes", "Education", "Insurance", "Loan", 
    "Finance", "Dating", "Free Trial", "Installs", "Games", "Other"
  ];

  const dynamicVerticals = useMemo(() => {
    const set = new Set<string>(PREDEFINED_VERTICALS);
    allSupportUsers.forEach(u => {
      const v = getVerticalsArray(u);
      v.forEach(item => {
        if (item) {
          const normalized = normalizeVertical(item);
          if (normalized) set.add(normalized);
        }
      });
    });
    return Array.from(set).sort((a, b) => {
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
      return a.localeCompare(b);
    });
  }, [allSupportUsers]);

  const countries = useMemo(() => {
    const set = new Set<string>();
    allSupportUsers.forEach(u => {
      if (u.country) set.add(u.country);
    });
    return Array.from(set).sort();
  }, [allSupportUsers]);

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC]">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 md:p-6 border-b bg-white">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200">
              <MessageSquare size={20} />
            </div>
            Support Messaging Hub
          </h1>
          <p className="text-slate-500 text-xs mt-1">Manage cross-channel communication and user outreach</p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="bg-white border-slate-200 shadow-sm" onClick={loadData}>
            <Clock size={14} className="mr-2" /> Refresh
          </Button>
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-100" 
            disabled={selectedUsers.size === 0}
            onClick={() => setBulkModalOpen(true)}>
            <Send size={14} className="mr-2" /> Bulk Outreach ({selectedUsers.size})
          </Button>

          <Dialog open={bulkModalOpen} onOpenChange={setBulkModalOpen}>
            <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden rounded-2xl border-none">
              <div className="bg-indigo-600 p-6 text-white">
                <DialogTitle className="text-xl flex items-center gap-2">
                  <Sparkles size={20} className="text-amber-300" />
                  Compose Bulk Outreach
                </DialogTitle>
                <DialogDescription className="text-indigo-100 mt-1">
                  You have selected {selectedUsers.size} users. Messages will be auto-personalized.
                </DialogDescription>
              </div>

              <div className="p-6 space-y-6 bg-white">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Message Strategy</label>
                    <Select value={selectedMessageType} onValueChange={setSelectedMessageType}>
                      <SelectTrigger className="rounded-xl border-slate-200 bg-slate-50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Geo-based">Geo-Targeted Hook</SelectItem>
                        <SelectItem value="Vertical-based">Vertical Interest</SelectItem>
                        <SelectItem value="Combined">Combined Personalization</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Template</label>
                    <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                      <SelectTrigger className="rounded-xl border-slate-200 bg-slate-50">
                        <SelectValue placeholder="Choose template..." />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map(t => <SelectItem key={t._id} value={t._id!}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {activeTemplate && (
                  <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-indigo-600">
                        Dynamic Preview ({previewUser?.username || "Selected User"} @ {previewUser?.city || previewUser?.country || "Location"})
                      </span>
                      <Badge variant="outline" className="bg-white border-indigo-200 text-indigo-700 text-[10px] uppercase">{activeTemplate.category}</Badge>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed italic">
                      "{getPreview(activeTemplate.body, previewUser)}"
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Delivery Channel</label>
                  <div className="grid grid-cols-4 gap-2">
                    {['Email', 'Telegram', 'Teams', 'Chat'].map(ch => {
                      const isAvailable = selectedUsers.size === 1 ? (
                        ch === 'Email' ? !!previewUser?.email :
                        ch === 'Telegram' ? !!previewUser?.telegram :
                        ch === 'Teams' ? !!previewUser?.teams :
                        true // Chat is always available as fallback
                      ) : true;

                      return (
                        <button 
                          key={ch}
                          disabled={!isAvailable}
                          onClick={() => setSelectedChannel(ch)}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${!isAvailable ? 'opacity-40 cursor-not-allowed border-slate-50 bg-slate-50/50' : (selectedChannel === ch ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200')}`}
                        >
                          {ch === 'Email' && <Mail size={16} />}
                          {ch === 'Telegram' && <Send size={16} />}
                          {ch === 'Teams' && <Users size={16} />}
                          {ch === 'Chat' && <MessageSquare size={16} />}
                          <span className="text-[10px] font-bold">{ch}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Scheduling (Optional)</label>
                    {scheduledTime && (
                      <Button variant="ghost" size="sm" className="h-4 text-[9px] text-red-500 hover:text-red-600 p-0" onClick={() => setScheduledTime('')}>Clear</Button>
                    )}
                  </div>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <Input 
                      type="datetime-local" 
                      value={scheduledTime} 
                      onChange={e => setScheduledTime(e.target.value)}
                      className="pl-10 rounded-xl border-slate-200 bg-slate-50 text-xs h-10"
                    />
                  </div>
                </div>
              </div>
              <div className="p-4 bg-slate-50 border-t flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <Clock size={12} className={scheduledTime ? "text-indigo-500" : ""} />
                  <span className={scheduledTime ? "text-indigo-600 font-medium" : ""}>
                    {scheduledTime ? `Scheduled for ${new Date(scheduledTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}` : "Scheduled for immediate dispatch"}
                  </span>
                </div>
                <div className="flex gap-3">
                  <Button variant="ghost" size="sm" onClick={() => setBulkModalOpen(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleBulkSend} disabled={isSending || !selectedTemplateId} className="bg-indigo-600 px-6">
                    {isSending ? "Processing..." : (scheduledTime ? "Schedule Outreach" : "Send Now")}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Main Dashboard Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col p-4 md:p-6 space-y-6 overflow-hidden">
        <div className="flex items-center justify-between bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 shrink-0">
          <TabsList className="bg-transparent border-none">
            <TabsTrigger value="explorer" className="rounded-xl data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 px-6">User Explorer</TabsTrigger>
            <TabsTrigger value="inbox" className="rounded-xl data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 px-6">Inbox</TabsTrigger>
            <TabsTrigger value="templates" className="rounded-xl data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 px-6">Templates</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="explorer" className="mt-0 h-full flex flex-col space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <Input 
                    placeholder="Search users by name or email..." 
                    className="pl-10 bg-white border-slate-200 rounded-xl"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={filterCountry} onValueChange={setFilterCountry}>
                  <SelectTrigger className="w-[140px] bg-white border-slate-200 rounded-xl">
                    <SelectValue placeholder="Region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Regions</SelectItem>
                    {countries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterVertical} onValueChange={setFilterVertical}>
                  <SelectTrigger className="w-[180px] bg-white border-slate-200 rounded-xl"><SelectValue placeholder="Vertical" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Verticals</SelectItem>
                    {dynamicVerticals.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

            <Card className="border-slate-200 shadow-sm overflow-hidden rounded-2xl flex-1 flex flex-col">
              <div className="overflow-y-auto flex-1 custom-scrollbar min-h-[400px]">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50 z-10">
                    <tr className="border-b border-slate-100">
                      <th className="p-4 w-12"><Checkbox checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0} onCheckedChange={(val: boolean) => {
                        if (val) setSelectedUsers(new Set(filteredUsers.map(u => String(u.user_id || u._id))));
                        else setSelectedUsers(new Set());
                      }} /></th>
                       <th className="p-4 text-xs font-semibold text-slate-500 uppercase">User</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase">Verticals</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase">Geo</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase">Channels</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-12 text-center">
                          <div className="flex flex-col items-center justify-center text-slate-400 space-y-2">
                            <Search size={32} className="opacity-20" />
                            <p className="text-sm italic font-medium">No users match your current filters</p>
                            <Button variant="ghost" size="sm" onClick={() => {
                              setFilterVertical('All');
                              setFilterCountry('All');
                              setSearchTerm('');
                            }} className="text-indigo-600 hover:text-indigo-700">Clear all filters</Button>
                          </div>
                        </td>
                      </tr>
                    ) : filteredUsers.map(user => {
                      const userId = String(user.user_id || user._id);
                      const userVerts = getVerticalsArray(user);
                      return (
                        <tr 
                          key={userId} 
                          onClick={() => toggleUserSelection(userId)}
                          className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${selectedUsers.has(userId) ? 'bg-indigo-50/30 border-l-4 border-l-indigo-500' : 'border-l-4 border-l-transparent'}`}
                        >
                          <td className="p-4" onClick={(e) => e.stopPropagation()}>
                            <Checkbox checked={selectedUsers.has(userId)} onCheckedChange={() => toggleUserSelection(userId)} />
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-900">{user.username}</span>
                              <span className="text-xs text-slate-500">{user.email}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {userVerts.length > 0 ? (
                                userVerts.slice(0, 3).map((v: string) => (
                                  <Badge key={v} variant="outline" className="text-[10px] bg-white border-indigo-100 text-indigo-700 flex items-center gap-1">
                                    <Sparkles size={8} className="text-amber-400" />
                                    {normalizeVertical(v)}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">None</span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1.5">
                              <MapPin size={12} className="text-slate-400" />
                              <span className="text-xs text-slate-600">
                                {user.city || user.country || user.intelligence_geos?.[0] || 'Unknown'}
                              </span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1.5">
                              <div className={`p-1.5 rounded-lg border ${user.email ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-slate-100 bg-slate-50 text-slate-300'}`} title="Email verified">
                                <Mail size={12} />
                              </div>
                              <div className={`p-1.5 rounded-lg border ${user.telegram ? 'border-blue-200 bg-blue-50 text-blue-600' : 'border-slate-100 bg-slate-50 text-slate-300'}`} title="Telegram linked">
                                <Send size={12} />
                              </div>
                              <div className={`p-1.5 rounded-lg border ${user.teams ? 'border-indigo-200 bg-indigo-50 text-indigo-600' : 'border-slate-100 bg-slate-50 text-slate-300'}`} title="Teams verified">
                                <Users size={12} />
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-indigo-50 hover:text-indigo-600" onClick={(e) => {
                              e.stopPropagation();
                              setSelectedUsers(new Set([userId]));
                              setBulkModalOpen(true);
                            }}>
                              <Send size={14} />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="inbox" className="mt-0 h-full flex flex-col min-h-0">
            <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 h-full min-h-0 overflow-hidden">
              <Card className="rounded-2xl border-slate-200 overflow-hidden flex flex-col bg-white">
                <div className="p-4 border-b bg-slate-50/50">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Inbox size={16} className="text-indigo-500" />
                    Conversations
                  </h3>
                </div>
                <ScrollArea className="flex-1">
                  <div className="divide-y divide-slate-100">
                    {!conversations || conversations.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs italic">No active conversations found</div>
                    ) : conversations.map(conv => {
                      const user = allSupportUsers.find(u => u._id === conv.user_id);
                      return (
                        <div 
                          key={conv._id} 
                          onClick={() => setSelectedConvId(conv._id)}
                          className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors relative ${selectedConvId === conv._id ? 'bg-indigo-50/50 border-r-2 border-r-indigo-500' : ''}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-sm text-slate-900">{user?.username || `User #${conv.user_id.slice(-4)}`}</span>
                            <span className="text-[9px] text-slate-400">{new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {conv.channel === 'Email' && <Mail size={10} className="text-emerald-500" />}
                            {conv.channel === 'Telegram' && <Send size={10} className="text-blue-500" />}
                            {conv.channel === 'Teams' && <Users size={10} className="text-indigo-500" />}
                            <span className="text-xs text-slate-500 truncate">Support via {conv.channel}</span>
                          </div>
                          {conv.unread_count > 0 && (
                            <div className="absolute top-4 right-4 w-2 h-2 bg-indigo-500 rounded-full" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </Card>

              <Card className="rounded-2xl border-slate-200 flex flex-col bg-white overflow-hidden shadow-sm">
                {selectedConvId ? (
                  <>
                    <div className="p-4 border-b flex items-center justify-between bg-slate-50/30">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                          {allSupportUsers.find(u => u._id === conversations.find(c => c._id === selectedConvId)?.user_id)?.username?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">
                            {allSupportUsers.find(u => u._id === conversations.find(c => c._id === selectedConvId)?.user_id)?.username}
                          </h4>
                          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">
                            Active Session • {conversations.find(c => c._id === selectedConvId)?.channel}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-white text-slate-500">#{selectedConvId.slice(-6)}</Badge>
                    </div>

                    <ScrollArea className="flex-1 p-4 bg-slate-50/20">
                      <div className="space-y-4">
                        {messages.map(msg => (
                          <div key={msg._id} className={`flex ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.sender_type === 'admin' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none shadow-sm'}`}>
                              <p className="leading-relaxed">{msg.body}</p>
                              <div className={`text-[9px] mt-1.5 opacity-60 ${msg.sender_type === 'admin' ? 'text-white text-right' : 'text-slate-400'}`}>
                                {new Date(msg.timestamp).toLocaleTimeString()}
                              </div>
                            </div>
                          </div>
                        ))}
                        {messages.length === 0 && (
                          <div className="flex items-center justify-center h-full text-slate-400 text-xs italic">
                            Loading conversation history...
                          </div>
                        )}
                      </div>
                    </ScrollArea>

                    <div className="p-4 bg-white border-t">
                      <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                        <Input 
                          placeholder="Type your message here..." 
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleReply()}
                          className="border-none bg-transparent shadow-none focus-visible:ring-0 text-sm"
                        />
                        <Button 
                          size="sm" 
                          onClick={handleReply} 
                          disabled={isReplying || !replyText.trim()} 
                          className="rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-100"
                        >
                          <Send size={14} className={isReplying ? 'animate-pulse' : ''} />
                        </Button>
                      </div>
                      <p className="text-[9px] text-slate-400 mt-2 px-2">Message will be delivered via {conversations.find(c => c._id === selectedConvId)?.channel}</p>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                      <MessageSquare size={32} />
                    </div>
                    <div>
                      <h3 className="text-slate-900 font-bold">Select a conversation</h3>
                      <p className="text-slate-400 text-xs mt-1">Choose a user from the sidebar to view message history and reply.</p>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="templates" className="mt-0 h-full flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {!templates || templates.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
                  <Layout size={40} className="opacity-20" />
                  <p className="text-sm italic">No messaging templates available</p>
                  <Button variant="outline" size="sm" onClick={loadData}>Reload Data</Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates.map(template => (
                    <Card key={template._id} className="p-4 hover:border-indigo-200 transition-colors bg-white shadow-sm border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-slate-900">{template.name}</h4>
                        <Badge variant="outline" className="text-[9px] uppercase">{template.category}</Badge>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">{template.body}</p>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

const AdminSupportHub: React.FC = () => {
  return (
    <AdminPageGuard requiredTab="support">
      <div className="min-h-screen">
        <SupportHubContent />
      </div>
    </AdminPageGuard>
  );
};

export default AdminSupportHub;
