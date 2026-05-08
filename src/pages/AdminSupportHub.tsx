import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageSquare, Send, Users, Mail, Phone, 
  Search, Filter, Plus, Clock, CheckCircle, 
  AlertCircle, ChevronRight, Hash, Globe, 
  Settings, Layout, Inbox, Sparkles, Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AdminPageGuard } from '@/components/AdminPageGuard';
import { supportHubService, SupportTemplate, SupportConversation } from '@/services/supportHubService';
import loginLogsService from '@/services/loginLogsService';

const AdminSupportHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState('explorer');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [templates, setTemplates] = useState<SupportTemplate[]>([]);
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVertical, setFilterVertical] = useState('All');
  const [filterCountry, setFilterCountry] = useState('All');
  
  // Bulk Send State
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<string>('Email');
  const [isSending, setIsSending] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch users from admin API (reusing logic from activity page if needed)
      const token = localStorage.getItem('token');
      const usersRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json());
      
      setUsers(usersRes.users || []);
      
      const templatesData = await supportHubService.getTemplates();
      setTemplates(templatesData);
      
      const conversationsData = await supportHubService.getConversations();
      setConversations(conversationsData);
      
    } catch (error) {
      console.error("Failed to load support hub data", error);
      toast({ title: "Error", description: "Failed to load dashboard data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = u.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           u.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesVertical = filterVertical === 'All' || (u.verticals && u.verticals.includes(filterVertical));
      const matchesCountry = filterCountry === 'All' || u.country === filterCountry;
      return matchesSearch && matchesVertical && matchesCountry;
    });
  }, [users, searchTerm, filterVertical, filterCountry]);

  const toggleUserSelection = (id: string) => {
    const next = new Set(selectedUsers);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedUsers(next);
  };

  const handleBulkSend = async () => {
    if (!selectedTemplate || selectedUsers.size === 0) return;
    
    setIsSending(true);
    try {
      await supportHubService.bulkSend(Array.from(selectedUsers), selectedTemplate, selectedChannel);
      toast({ title: "Success", description: `Message sent to ${selectedUsers.size} users via ${selectedChannel}` });
      setBulkModalOpen(false);
      setSelectedUsers(new Set());
      loadData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to send messages", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const countries = Array.from(new Set(users.map(u => u.country).filter(Boolean)));
  const verticals = ['HEALTH', 'FINANCE', 'DATING', 'SWEEPSTAKES', 'GAMES_INSTALL'];

  return (
    <AdminPageGuard>
      <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
              <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200">
                <MessageSquare size={28} />
              </div>
              Support Messaging Hub
            </h1>
            <p className="text-slate-500 mt-1">Manage cross-channel communication and user outreach</p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" className="bg-white border-slate-200 shadow-sm hover:bg-slate-50" onClick={loadData}>
              <Clock size={16} className="mr-2" /> Refresh Hub
            </Button>
            <Dialog open={bulkModalOpen} onOpenChange={setBulkModalOpen}>
              <DialogTrigger asChild>
                <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-100" disabled={selectedUsers.size === 0}>
                  <Send size={16} className="mr-2" /> Bulk Outreach ({selectedUsers.size})
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Send Bulk Message</DialogTitle>
                  <DialogDescription>
                    Send a personalized message to {selectedUsers.size} selected users.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Template</label>
                    <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a template..." />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map(t => (
                          <SelectItem key={t._id} value={t._id!}>{t.name} ({t.category})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Channel</label>
                    <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose channel..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Email">Email Outreach</SelectItem>
                        <SelectItem value="Telegram">Telegram DM</SelectItem>
                        <SelectItem value="Teams">Microsoft Teams</SelectItem>
                        <SelectItem value="Chat">Internal Portal Chat</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100 flex items-start gap-3">
                    <Sparkles className="text-indigo-600 mt-1" size={18} />
                    <p className="text-xs text-indigo-700 leading-relaxed">
                      Messages will automatically use placeholders like <b>{'{user}'}</b> and <b>{'{location}'}</b> based on each user's Recent Activity data.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setBulkModalOpen(false)}>Cancel</Button>
                  <Button onClick={handleBulkSend} disabled={isSending || !selectedTemplate} className="bg-indigo-600 hover:bg-indigo-700">
                    {isSending ? "Sending..." : "Dispatch Messages"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Main Dashboard Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex items-center justify-between bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200">
            <TabsList className="bg-transparent border-none">
              <TabsTrigger value="explorer" className="rounded-xl data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 data-[state=active]:shadow-none px-6">
                <Users size={16} className="mr-2" /> User Explorer
              </TabsTrigger>
              <TabsTrigger value="inbox" className="rounded-xl data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 data-[state=active]:shadow-none px-6">
                <Inbox size={16} className="mr-2" /> Support Inbox
                {conversations.filter(c => c.unread_count > 0).length > 0 && (
                  <Badge className="ml-2 bg-rose-500 text-white border-none h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]">
                    {conversations.filter(c => c.unread_count > 0).length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="templates" className="rounded-xl data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 data-[state=active]:shadow-none px-6">
                <Layout size={16} className="mr-2" /> Template Manager
              </TabsTrigger>
            </TabsList>
            
            <div className="flex items-center gap-3 px-3">
               <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input 
                    placeholder="Search users..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="h-9 w-64 pl-9 bg-slate-50 border-none rounded-xl focus-visible:ring-1 focus-visible:ring-indigo-400"
                  />
               </div>
               <Select value={filterVertical} onValueChange={setFilterVertical}>
                  <SelectTrigger className="h-9 w-40 bg-slate-50 border-none rounded-xl">
                    <SelectValue placeholder="Vertical" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Verticals</SelectItem>
                    {verticals.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
               </Select>
            </div>
          </div>

          <TabsContent value="explorer" className="mt-0">
            <div className="grid grid-cols-1 gap-4">
              <Card className="border-slate-200 shadow-sm overflow-hidden rounded-2xl">
                <CardHeader className="bg-white border-b border-slate-100 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Filtered Users</CardTitle>
                      <CardDescription>Select users to begin bulk outreach</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                       <Button variant="ghost" size="sm" onClick={() => setSelectedUsers(new Set(filteredUsers.map(u => u._id)))} className="text-xs text-indigo-600 hover:text-indigo-700">Select All</Button>
                       <Button variant="ghost" size="sm" onClick={() => setSelectedUsers(new Set())} className="text-xs text-slate-500">Clear</Button>
                    </div>
                  </div>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="p-4 w-12"><Checkbox checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0} onCheckedChange={(val) => {
                          if (val) setSelectedUsers(new Set(filteredUsers.map(u => u._id)));
                          else setSelectedUsers(new Set());
                        }} /></th>
                        <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                        <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Activity Context</th>
                        <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Geo</th>
                        <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Verticals</th>
                        <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {loading ? (
                        <tr><td colSpan={7} className="p-12 text-center text-slate-400">Loading user intelligence...</td></tr>
                      ) : filteredUsers.length === 0 ? (
                        <tr><td colSpan={7} className="p-12 text-center text-slate-400">No users match your criteria</td></tr>
                      ) : filteredUsers.map(user => (
                        <tr key={user._id} className={`hover:bg-slate-50/80 transition-colors ${selectedUsers.has(user._id) ? 'bg-indigo-50/30' : ''}`}>
                          <td className="p-4">
                            <Checkbox checked={selectedUsers.has(user._id)} onCheckedChange={() => toggleUserSelection(user._id)} />
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-900">{user.username}</span>
                              <span className="text-xs text-slate-500">{user.email}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="flex flex-col">
                                <span className="text-xs font-medium text-slate-700">Last: {new Date(user.last_login || Date.now()).toLocaleDateString()}</span>
                                <span className="text-[10px] text-slate-400 flex items-center gap-1"><Zap size={10} className="text-amber-500" /> Active Session</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                             <div className="flex items-center gap-1.5">
                                <Globe size={14} className="text-slate-400" />
                                <span className="text-sm text-slate-600">{user.country || 'Global'}</span>
                             </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1">
                              {user.verticals?.slice(0, 2).map((v: string) => (
                                <Badge key={v} variant="outline" className="text-[10px] bg-white text-slate-600 border-slate-200 font-normal">{v}</Badge>
                              ))}
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge className={user.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-600 border-slate-100'} variant="outline">
                              {user.status || 'active'}
                            </Badge>
                          </td>
                          <td className="p-4 text-right">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-600">
                              <ChevronRight size={18} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="inbox" className="mt-0">
             <div className="grid grid-cols-1 md:grid-cols-[350px_1fr] gap-6 h-[700px]">
                <Card className="rounded-2xl border-slate-200 overflow-hidden flex flex-col">
                   <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                      <span className="font-semibold text-slate-900">Conversations</span>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Plus size={16} /></Button>
                   </div>
                   <ScrollArea className="flex-1">
                      <div className="divide-y divide-slate-50">
                        {conversations.length === 0 ? (
                          <div className="p-8 text-center text-slate-400 text-sm">No active threads</div>
                        ) : conversations.map(conv => (
                          <div key={conv._id} className="p-4 hover:bg-slate-50 cursor-pointer transition-colors border-l-4 border-l-transparent data-[active=true]:border-l-indigo-500 data-[active=true]:bg-indigo-50/30">
                             <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-slate-900 text-sm">User #{conv.user_id.slice(-4)}</span>
                                <span className="text-[10px] text-slate-400">{new Date(conv.last_message_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                             </div>
                             <div className="flex items-center justify-between">
                                <p className="text-xs text-slate-500 truncate pr-4">Sent via {conv.channel}</p>
                                {conv.unread_count > 0 && (
                                  <Badge className="bg-indigo-600 text-white border-none h-4 px-1.5 text-[9px]">{conv.unread_count}</Badge>
                                )}
                             </div>
                          </div>
                        ))}
                      </div>
                   </ScrollArea>
                </Card>

                <Card className="rounded-2xl border-slate-200 overflow-hidden flex flex-col bg-white">
                   <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                            <Users size={20} />
                         </div>
                         <div>
                            <div className="font-semibold text-slate-900">Conversation Details</div>
                            <div className="text-[10px] text-emerald-500 flex items-center gap-1 font-medium">
                               <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Channel Active
                            </div>
                         </div>
                      </div>
                      <div className="flex items-center gap-2">
                         <Button variant="outline" size="sm" className="rounded-lg h-9">View Profile</Button>
                         <Button variant="outline" size="sm" className="rounded-lg h-9 text-rose-500 hover:text-rose-600">Close Ticket</Button>
                      </div>
                   </div>
                   
                   <div className="flex-1 bg-slate-50/30 p-6 flex flex-col items-center justify-center text-slate-400 space-y-4">
                      <div className="p-4 bg-white rounded-full shadow-sm">
                         <Inbox size={48} className="text-slate-200" />
                      </div>
                      <p className="text-sm font-medium">Select a conversation to start messaging</p>
                   </div>

                   <div className="p-4 border-t border-slate-100 bg-white">
                      <div className="flex items-center gap-2">
                         <Input placeholder="Type a reply..." className="rounded-xl border-slate-200 focus-visible:ring-indigo-400" />
                         <Button className="bg-indigo-600 hover:bg-indigo-700 rounded-xl px-5">
                            <Send size={16} />
                         </Button>
                      </div>
                   </div>
                </Card>
             </div>
          </TabsContent>

          <TabsContent value="templates" className="mt-0">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="rounded-2xl border-slate-200 shadow-sm md:col-span-1 p-6 space-y-4 bg-white">
                   <div className="space-y-1">
                      <h3 className="font-bold text-slate-900">Add New Template</h3>
                      <p className="text-xs text-slate-500">Create reusable message blocks</p>
                   </div>
                   <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                         <label className="text-xs font-semibold text-slate-500 uppercase">Template Name</label>
                         <Input placeholder="e.g. Welcome Series #1" className="rounded-xl" />
                      </div>
                      <div className="space-y-2">
                         <label className="text-xs font-semibold text-slate-500 uppercase">Category</label>
                         <Select defaultValue="outreach">
                            <SelectTrigger className="rounded-xl">
                               <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                               <SelectItem value="outreach">Outreach</SelectItem>
                               <SelectItem value="support">Support</SelectItem>
                               <SelectItem value="offers">Offer Promotion</SelectItem>
                               <SelectItem value="security">Account Security</SelectItem>
                            </SelectContent>
                         </Select>
                      </div>
                      <div className="space-y-2">
                         <label className="text-xs font-semibold text-slate-500 uppercase">Content</label>
                         <textarea 
                           className="w-full min-h-[150px] rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                           placeholder="Hello {user}, we noticed you are from {location}..."
                         />
                      </div>
                      <Button className="w-full bg-indigo-600 hover:bg-indigo-700 rounded-xl h-11">Save Template</Button>
                   </div>
                </Card>

                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 auto-rows-max">
                   {templates.map(template => (
                      <Card key={template._id} className="rounded-2xl border-slate-200 shadow-sm p-5 hover:border-indigo-200 transition-colors group bg-white">
                         <div className="flex items-start justify-between mb-4">
                            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                               <Layout size={18} />
                            </div>
                            <Badge variant="outline" className="text-[10px] capitalize">{template.category}</Badge>
                         </div>
                         <h4 className="font-bold text-slate-900 mb-2">{template.name}</h4>
                         <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed mb-4">
                            {template.body}
                         </p>
                         <div className="flex items-center gap-2 pt-2 border-t border-slate-50">
                            <Button variant="ghost" size="sm" className="text-xs h-8 px-2 hover:text-indigo-600">Edit</Button>
                            <Button variant="ghost" size="sm" className="text-xs h-8 px-2 hover:text-rose-600">Delete</Button>
                         </div>
                      </Card>
                   ))}
                   {templates.length === 0 && (
                     <div className="col-span-2 p-12 text-center text-slate-400 border-2 border-dashed rounded-2xl border-slate-100">
                        No templates created yet
                     </div>
                   )}
                </div>
             </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminPageGuard>
  );
};

export default AdminSupportHub;
