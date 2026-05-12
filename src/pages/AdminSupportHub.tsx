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
  AlertCircle, Hash, Globe,
  LayoutDashboard, UserCheck, MessageCircle, MapPin, Tag, XCircle, Edit3, Eye, Save, Loader2, Reply,
  Sparkles, Layout, Inbox, Settings, Zap, ChevronLeft, ChevronRight, X, Activity, Cpu, ExternalLink
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AdminPageGuard } from '@/components/AdminPageGuard';
import { supportHubService, SupportTemplate, SupportConversation, SupportMessage } from '../services/supportHubService';
import loginLogsService from '@/services/loginLogsService';
import EmailSettingsPanel, { DEFAULT_EMAIL_SETTINGS, type EmailSettings } from '@/components/EmailSettingsPanel';

const normalizeVertical = (v: any): string => {
  if (!v) return '';
  const lower = String(v).toLowerCase().trim();
  if (lower === 'sweeps' || lower.includes('sweep')) return 'Sweepstakes';
  if (lower.includes('trial')) return 'Free Trial';
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

const getDisplayLocation = (user: any) => {
  if (!user) return "Unknown";

  // 1. Explicit profile fields
  const city = user.city || user.location?.city;
  const country = user.country || user.location?.country || user.country_code || user.location?.country_code;

  if (city && country && city !== 'Unknown' && country !== 'Unknown') return `${city}, ${country}`;
  if (country && country !== 'Unknown') {
    if (country.length === 2) {
      try {
        const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
        return regionNames.of(country.toUpperCase()) || country;
      } catch (e) { return country; }
    }
    return country;
  }
  if (city && city !== 'Unknown') return city;

  // 2. Intelligence Geos (Top detected geos)
  if (user.intelligence_geos && user.intelligence_geos.length > 0) {
    const topGeo = user.intelligence_geos[0];
    if (topGeo && topGeo !== 'Unknown' && topGeo !== 'XX') {
      if (topGeo.length === 2) {
        try {
          const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
          return regionNames.of(topGeo.toUpperCase()) || topGeo;
        } catch (e) { return topGeo; }
      }
      return topGeo;
    }
  }

  // 3. Last IP Fallback (Simple logic)
  const ip = user.last_ip || user.ip_address || user.location?.ip;
  if (ip) {
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.')) return 'Local/India';
    if (ip.startsWith('103.232') || ip.startsWith('119.') || ip.startsWith('27.147')) return 'Bangladesh';
    if (ip.startsWith('106.') || ip.startsWith('115.') || ip.startsWith('122.')) return 'India';
  }

  return "Unknown";
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
  initialSelectedIds?: Set<string>;
  apiUrl?: string;
  className?: string;
}> = ({ onClose, initialUsers, initialSelectedIds, apiUrl, className }) => {
  const BASE_API_URL = apiUrl || import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const [activeTab, setActiveTab] = useState('explorer');
  const [inboxFilter, setInboxFilter] = useState<'all' | 'replies'>('replies');
  const [loading, setLoading] = useState(true);
  const [allSupportUsers, setAllSupportUsers] = useState<any[]>(initialUsers || []);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [templates, setTemplates] = useState<SupportTemplate[]>([]);
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [initialFilterActive, setInitialFilterActive] = useState(false);
  const [channelConnections, setChannelConnections] = useState<Record<string, boolean>>({
    'Telegram': false,
    'Teams': false,
    'Chat': true,
    'Email': true
  });

  const toggleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length && filteredUsers.length > 0) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map(u => String(u.user_id || u._id))));
    }
  };

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
  const [editingTemplateBody, setEditingTemplateBody] = useState('');
  const [editingTemplateName, setEditingTemplateName] = useState('');
  const [activeStrategyHook, setActiveStrategyHook] = useState('');
  const [activeStrategyLabel, setActiveStrategyLabel] = useState('');
  const [isUpdatingTemplate, setIsUpdatingTemplate] = useState(false);
  const [bulkPreviewOpen, setBulkPreviewOpen] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewSamples, setPreviewSamples] = useState<any[]>([]);
  const [personalOverrides, setPersonalOverrides] = useState<Record<string, { subject: string; body: string }>>({});
  const [previewIdx, setPreviewIdx] = useState(0);
  const [emailSubject, setEmailSubject] = useState('Recommended Offers');

  // Inbox State
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  // Template Management State
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SupportTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: '', subject: 'Recommended Offers', category: 'Geo-based', body: '' });
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // Global Support Settings State
  const [supportSettings, setSupportSettings] = useState<any>({
    support_name: 'Publisher Support Team',
    support_email: 'support@moustacheleads.com',
    default_signature: 'Best regards,\nPublisher Support Team\nMoustache Leads',
    strategy_hooks: {
      'Geo-based': 'Hey {user}, users from {location} love our latest {vertical}!',
      'Vertical-based': 'Hey {user}, need help with {vertical} deals?',
      'Combined': 'Hey {user}, check out the top {vertical} offers near {location}:',
      'Custom': ''
    },
    strategy_labels: {
      'Geo-based': 'Geo-Targeted Hook',
      'Vertical-based': 'Vertical Interest',
      'Combined': 'Combined Personalization',
      'Custom': 'Custom Hook Strategy'
    },
    email_settings: DEFAULT_EMAIL_SETTINGS
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

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
    if (activeStrategyHook) {
      body = activeStrategyHook.replace(/{user}/g, u.username || 'User').replace(/{location}/g, u.city || u.country || 'your area').replace(/{vertical}/g, v || 'offers') + " " + body;
    }

    body = body.replace(/{offer}/g, "High-Payout Bundle");
    return body;
  };

  const activeTemplate = useMemo(() => {
    return templates.find(t => t._id === selectedTemplateId);
  }, [templates, selectedTemplateId]);

  useEffect(() => {
    if (activeTemplate) {
      setEditingTemplateBody(activeTemplate.body);
      setEditingTemplateName(activeTemplate.name);
    } else {
      setEditingTemplateBody('');
      setEditingTemplateName('');
    }
  }, [activeTemplate]);

  useEffect(() => {
    const defaultHook = supportSettings.strategy_hooks?.[selectedMessageType] || '';
    const defaultLabel = supportSettings.strategy_labels?.[selectedMessageType] || selectedMessageType;
    setActiveStrategyHook(defaultHook);
    setActiveStrategyLabel(defaultLabel);
  }, [selectedMessageType, supportSettings.strategy_hooks, supportSettings.strategy_labels]);

  async function handleUpdateStrategyHook() {
    const updatedSettings = {
      ...supportSettings,
      strategy_hooks: {
        ...supportSettings.strategy_hooks,
        [selectedMessageType]: activeStrategyHook
      },
      strategy_labels: {
        ...supportSettings.strategy_labels,
        [selectedMessageType]: activeStrategyLabel
      }
    };
    setSupportSettings(updatedSettings);
    try {
      await supportHubService.updateSettings(updatedSettings);
      toast({ title: "Success", description: `Updated ${activeStrategyLabel} strategy` });
    } catch (e) {
      toast({ title: "Error", description: "Failed to save strategy", variant: "destructive" });
    }
  }

  async function handleSaveAsNewTemplate() {
    if (!editingTemplateName || !editingTemplateBody) {
      toast({ title: "Error", description: "Name and body are required", variant: "destructive" });
      return;
    }
    setIsUpdatingTemplate(true);
    try {
      const newTemplate = await supportHubService.createTemplate({
        name: editingTemplateName,
        body: editingTemplateBody,
        category: 'General'
      });
      toast({ title: "Success", description: "New template created and selected" });

      // Refresh templates and select the new one
      const templatesData = await supportHubService.getTemplates();
      setTemplates(Array.isArray(templatesData) ? templatesData : []);
      if (newTemplate._id) {
        setSelectedTemplateId(newTemplate._id);
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to create template", variant: "destructive" });
    } finally {
      setIsUpdatingTemplate(false);
    }
  }

  useEffect(() => {
    if (!bulkModalOpen || selectedUsers.size === 0) return;

    setPersonalOverrides(prev => {
      const next = { ...prev };
      const userIds = Array.from(selectedUsers);
      let changed = false;

      userIds.forEach(uId => {
        if (!next[uId] || !next[uId].body) {
          const user = allSupportUsers.find(u => String(u.user_id || u._id) === uId);
          const bodyText = activeTemplate?.body || editingTemplateBody || '';
          const hookText = activeStrategyHook || supportSettings.strategy_hooks?.[selectedMessageType] || '';
          const personalizedBody = getPreview(`${hookText} ${bodyText}`, user);

          next[uId] = {
            subject: activeTemplate?.subject || editingTemplateName || 'Recommended Offers',
            body: personalizedBody
          };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [bulkModalOpen, selectedUsers, activeTemplate, activeStrategyHook, selectedMessageType]);

  // Sync current editor inputs when switching recipients
  useEffect(() => {
    const userIds = Array.from(selectedUsers);
    const currentId = userIds[previewIdx];
    if (currentId && personalOverrides[currentId]) {
      setEmailSubject(personalOverrides[currentId].subject);
      setEditingTemplateBody(personalOverrides[currentId].body);
    }
  }, [previewIdx, personalOverrides, selectedUsers]);

  const handlePersonalInputChange = (field: 'subject' | 'body', value: string) => {
    if (field === 'subject') setEmailSubject(value);
    else setEditingTemplateBody(value);

    const userIds = Array.from(selectedUsers);
    const currentId = userIds[previewIdx];
    if (currentId) {
      setPersonalOverrides(prev => ({
        ...prev,
        [currentId]: {
          ...prev[currentId],
          [field]: value
        }
      }));
    }
  };

  const copyToAll = () => {
    const userIds = Array.from(selectedUsers);
    setPersonalOverrides(prev => {
      const next = { ...prev };
      userIds.forEach(uId => {
        next[uId] = { subject: emailSubject, body: editingTemplateBody };
      });
      return next;
    });
    toast({ title: "Copied to All", description: "Applied current subject and message to all selected recipients." });
  };

  async function handleUpdateActiveTemplate() {
    if (!selectedTemplateId || !editingTemplateBody || !editingTemplateName) return;
    setIsUpdatingTemplate(true);
    try {
      await supportHubService.updateTemplate(selectedTemplateId, {
        ...activeTemplate,
        name: editingTemplateName,
        body: editingTemplateBody
      } as any);
      toast({ title: "Success", description: "Template updated successfully" });
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to update template", variant: "destructive" });
    } finally {
      setIsUpdatingTemplate(false);
    }
  }

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
    setLoading(true);
    try {
      supportHubService.setBaseUrl(BASE_API_URL);
      const token = localStorage.getItem('token');

      // Fetch settings and templates independently of user source
      const settingsRes = await supportHubService.getSettings().catch(() => null);
      if (settingsRes) {
        setSupportSettings(settingsRes);
        
        // Sync connection status for all channels
        const connections: Record<string, boolean> = {};
        const channels = ['Telegram', 'Teams', 'Chat', 'Email'];
        for (const ch of channels) {
          try {
            const res = await supportHubService.verifyConnection(ch);
            connections[ch] = res.connected;
          } catch (e) { connections[ch] = false; }
        }
        setChannelConnections(connections);
      } else {
        setSupportSettings({
          support_name: 'Publisher Support Team',
          support_email: 'support@moustacheleads.com',
          default_subject: 'Recommended Offers',
          default_signature: 'Best regards,\nPublisher Support Team\nMoustache Leads',
          strategy_hooks: {
            'Geo-based': 'Hey {user}, check out these offers in {location}!',
            'Vertical-based': 'Hi {user}, we found some new {vertical} offers for you.',
            'Combined': 'Great news {user}! New {vertical} offers are available in {location}.'
          },
          strategy_labels: {
            'Geo-based': 'Geo-Targeted',
            'Vertical-based': 'Interest-Based',
            'Combined': 'Hyper-Personalized'
          },
          email_settings: DEFAULT_EMAIL_SETTINGS
        });
      }

      const templatesRes = await supportHubService.getTemplates().catch(() => []);
      setTemplates(Array.isArray(templatesRes) ? templatesRes : []);

      const conversationsRes = await supportHubService.getConversations().catch(() => []);
      setConversations(Array.isArray(conversationsRes) ? conversationsRes : []);

      // ALWAYS fetch the full user list to ensure "entire page" visibility
      const [usersRes, intelRes] = await Promise.all([
        fetch(`${BASE_API_URL}/api/auth/admin/users`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()).catch(() => ({ users: [] })),
        fetch(`${BASE_API_URL}/api/admin/all-user-intelligence`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()).catch(() => ({ intelligence: [] }))
      ]);

      let finalUsers = usersRes.users || [];
      if (intelRes.intelligence && intelRes.intelligence.length > 0) {
        const intelMap = new Map(intelRes.intelligence.map((i: any) => [String(i.user_id), i]));
        finalUsers = finalUsers.map((u: any) => {
          const uId = String(u._id || u.user_id);
          const intel = intelMap.get(uId);
          if (intel) {
            const profileVerts = getVerticalsArray(u);
            const intelVerts = (intel as any).top_categories || [];
            const combinedVerts = Array.from(new Set([...profileVerts, ...intelVerts])).filter(Boolean);
            return { ...u, ...(intel as any), user_id: uId, verticals: combinedVerts, intelligence_geos: (intel as any).top_geos || [] };
          }
          return { ...u, user_id: uId };
        });
      }

      // If initialUsers were provided (e.g. from dashboard), show ONLY those users
      if (initialUsers) {
        console.log(`Support Hub: Syncing with dashboard state (${initialUsers.length} users)`);
        const initialIds = new Set(initialUsers.map(u => String(u.user_id || u._id)));
        finalUsers = finalUsers.filter((u: any) => initialIds.has(String(u._id || u.user_id)));
        
        // If specific selected IDs were passed, use those. 
        // Otherwise, only auto-select if it's a single targeted user
        if (initialSelectedIds && initialSelectedIds.size > 0) {
          setSelectedUsers(new Set(initialSelectedIds));
        } else if (initialUsers.length === 1) {
          setSelectedUsers(initialIds);
        } else {
          setSelectedUsers(new Set()); // Don't auto-select large groups by default
        }
        setInitialFilterActive(true);
      }

      setAllSupportUsers(finalUsers);

    } catch (error) {
      console.error('Error loading Support Hub data:', error);
      toast({
        title: 'Loading Failed',
        description: 'Could not fetch all data. Please refresh.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  async function handleOpenPreview() {
    console.log("Support Hub: Opening preview for", selectedUsers.size, "users");
    if (selectedUsers.size === 0) return;
    
    if (!channelConnections[selectedChannel]) {
      toast({
        title: "Channel Not Connected",
        description: `Please connect your ${selectedChannel} integration before sending messages.`,
        variant: "destructive"
      });
      return;
    }

    setIsPreviewing(true);
    setBulkPreviewOpen(true);

    // Generate 2-3 preview samples
    const userIds = Array.from(selectedUsers).slice(0, 3);
    const samples = [];

    for (const uId of userIds) {
      const user = allSupportUsers.find(u => String(u.user_id || u._id) === uId);
      if (!user) continue;

      const override = personalOverrides[uId];
      const personalized = override ? override.body : getPreview(`${activeStrategyHook || ''} ${activeTemplate?.body || ''}`, user);
      const subject = override ? override.subject : (activeTemplate?.subject || 'Recommended Offers');

      samples.push({
        username: user.username,
        email: user.email,
        channel: Array.from(selectedUsers).length > 1 ? 'Bulk' : 'Single',
        personalized,
        subject
      });
    }

    setPreviewSamples(samples);
    setIsPreviewing(false);
  }

  const filteredUsers = useMemo(() => {
    return allSupportUsers.filter(u => {
      // Local Search Filter
      return !searchTerm ||
        String(u.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(u.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [allSupportUsers, searchTerm]);
  const toggleUserSelection = (id: string) => {
    const next = new Set(selectedUsers);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedUsers(next);
  };

  const handleBulkSend = async () => {
    if (selectedUsers.size === 0) return;
    setIsSending(true);
    try {
      const userIds = Array.from(selectedUsers);

      // Send individual personalized messages
      for (const uId of userIds) {
        const override = personalOverrides[uId];
        if (override) {
          await supportHubService.sendOutreach(
            uId,
            override.subject,
            override.body,
            selectedChannel,
            scheduledTime || undefined,
            supportSettings.email_settings
          );
        } else {
          // Fallback to bulk if no override (shouldn't happen with our effect)
          await supportHubService.bulkSend(
            [uId],
            selectedTemplateId,
            selectedChannel,
            scheduledTime,
            supportSettings.email_settings,
            activeStrategyHook
          );
        }
      }

      toast({
        title: scheduledTime ? "Scheduled" : "Success",
        description: scheduledTime
          ? `Outreach scheduled for ${selectedUsers.size} users`
          : `Personalized outreach sent to ${selectedUsers.size} users via ${selectedChannel}`
      });
      setBulkModalOpen(false);
      setSelectedUsers(new Set());
      setScheduledTime('');
      setPersonalOverrides({});
      loadData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to send messages", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  // --- Template Handlers (Moved Up & Hoisted) ---
  function openCreateTemplate() {
    setEditingTemplate(null);
    setTemplateForm({
      name: '',
      subject: 'Recommended Offers',
      category: 'General',
      body: ''
    });
    setTemplateModalOpen(true);
  }

  function openEditTemplate(template: SupportTemplate) {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      subject: template.subject || 'Recommended Offers',
      category: template.category,
      body: template.body
    });
    setTemplateModalOpen(true);
  }

  async function handleSaveTemplate() {
    if (!templateForm.name || !templateForm.body) {
      toast({ title: "Error", description: "Name and body are required", variant: "destructive" });
      return;
    }
    setIsSavingTemplate(true);
    try {
      if (editingTemplate?._id) {
        await supportHubService.updateTemplate(editingTemplate._id, templateForm);
        toast({ title: "Success", description: "Template updated successfully" });
      } else {
        const newT = await supportHubService.createTemplate(templateForm);
        toast({ title: "Success", description: "New template created" });
        if (newT._id && bulkModalOpen) {
          setSelectedTemplateId(newT._id);
        }
      }
      setTemplateModalOpen(false);
      setEditingTemplate(null);
      loadData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to save template", variant: "destructive" });
    } finally {
      setIsSavingTemplate(false);
    }
  }

  async function handleDeleteTemplate(id: string) {
    if (!window.confirm("Are you sure you want to delete this template?")) return;
    try {
      await supportHubService.deleteTemplate(id);
      toast({ title: "Deleted", description: "Template removed" });
      loadData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete template", variant: "destructive" });
    }
  }

  async function handleSaveSettings() {
    setIsSavingSettings(true);
    try {
      await supportHubService.updateSettings(supportSettings);
      
      // After saving, verify connections for channels that have configs
      const channelsToVerify = ['Telegram', 'Teams'];
      const results: Record<string, boolean> = { ...channelConnections };
      
      for (const ch of channelsToVerify) {
        try {
          const status = await supportHubService.verifyConnection(ch);
          results[ch] = status.connected;
        } catch (e) {
          console.error(`Failed to verify ${ch}:`, e);
          results[ch] = false;
        }
      }
      
      setChannelConnections(results);
      toast({ 
        title: "Settings Saved", 
        description: "Configuration updated and connections verified." 
      });
    } catch (error) {
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
    } finally {
      setIsSavingSettings(false);
    }
  }


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

  async function handleVerifyIndividualChannel(channel: string) {
    try {
      // First save to ensure backend has the current input
      await supportHubService.updateSettings(supportSettings);
      
      const status = await supportHubService.verifyConnection(channel);
      setChannelConnections(prev => ({ ...prev, [channel]: status.connected }));
      
      if (status.connected) {
        toast({ title: "Connected!", description: `${channel} integration is working perfectly.` });
      } else {
        toast({ 
          title: "Connection Failed", 
          description: status.status || `Could not verify ${channel}. Check your credentials.`,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({ title: "Error", description: "Verification request failed.", variant: "destructive" });
    }
  }

  const handleStartLinking = async (channel: string) => {
    console.log(`Support Hub: Initiating ${channel} link sequence`);
    setLinkingChannel(channel);
    setIsRedirecting(true);
    
    // Simulate redirect to OAuth/Login URL
    setTimeout(() => {
      setIsRedirecting(false);
      setContactLinkerOpen(true);
      // We pass the channel explicitly to avoid state lag
      handleSearchContacts('', channel); 
    }, 1500);
  };

  const handleSearchContacts = async (query: string, channelOverride?: string) => {
    const ch = channelOverride || linkingChannel;
    if (!ch) return;
    
    setIsSearchingContacts(true);
    try {
      const data = await supportHubService.searchContacts(ch, query);
      setContactSearchResults(data.results || []);
    } catch (e) {
      toast({ title: "Error", description: "Failed to search contacts", variant: "destructive" });
    } finally {
      setIsSearchingContacts(false);
    }
  };

  const handleMapContact = async (contact: any) => {
    const userId = Array.from(selectedUsers)[0]; // Link the currently selected user
    if (!userId || !linkingChannel) return;
    
    setIsLinking(true);
    try {
      await supportHubService.mapContact(userId, linkingChannel, contact);
      toast({ 
        title: "Contact Linked!", 
        description: `Mapped ${contact.name} to this publisher.`,
      });
      setContactLinkerOpen(false);
      // Refresh settings to get the new mapping
      await loadData();
      
      // If we are in the middle of an outreach composition, jump straight to the preview
      if (bulkModalOpen) {
        handleOpenPreview();
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to link contact", variant: "destructive" });
    } finally {
      setIsLinking(false);
    }
  };

  const [returnToOutreach, setReturnToOutreach] = useState(false);
  const [contactLinkerOpen, setContactLinkerOpen] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [contactSearchResults, setContactSearchResults] = useState<any[]>([]);
  const [isSearchingContacts, setIsSearchingContacts] = useState(false);
  const [linkingChannel, setLinkingChannel] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleConnectChannel = (channel: string) => {
    setActiveTab('settings');
    setBulkModalOpen(false);
    setReturnToOutreach(true);
    toast({
      title: `Connect ${channel}`,
      description: `Please configure your ${channel} settings below. Once saved, you can return to outreach.`,
    });
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
    <div className={`flex-1 flex flex-col min-h-0 w-full bg-[#F1F5F9] ${className || ''} overflow-hidden`}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col items-stretch min-h-0 overflow-hidden">
        {/* Unified Premium Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-5 border-b bg-white shrink-0 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-30" />
          <div className="flex items-center gap-5">
            <div className="p-3 bg-indigo-600 rounded-[1.25rem] text-white shadow-2xl shadow-indigo-200 flex-shrink-0 relative">
              <MessageSquare size={28} />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black text-slate-900 tracking-tighter leading-none">Support Hub</h1>
                <Badge variant="secondary" className="bg-indigo-50 text-indigo-600 border-none text-[10px] font-black tracking-widest px-2 h-5">V2.4</Badge>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Command Center Active</p>
                </div>
                <span className="text-slate-200">|</span>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Management & Outreach</p>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <TabsList className="bg-slate-100/80 p-1 rounded-xl border border-slate-200/50">
              <TabsTrigger value="explorer" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm px-4 py-1.5 text-xs font-bold transition-all">Explorer</TabsTrigger>
              <TabsTrigger value="inbox" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm px-4 py-1.5 text-xs font-bold transition-all">Inbox</TabsTrigger>
              <TabsTrigger value="templates" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm px-4 py-1.5 text-xs font-bold transition-all">Templates</TabsTrigger>
              <TabsTrigger value="settings" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm px-4 py-1.5 text-xs font-bold transition-all">Settings</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === 'settings' && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-100"
                onClick={handleSaveSettings}
                disabled={isSavingSettings}
              >
                <Save size={14} className="mr-2" /> {isSavingSettings ? "Saving..." : "Save Hub Config"}
              </Button>
            )}
            <Button variant="outline" size="sm" className="bg-white border-slate-200 shadow-sm" onClick={loadData}>
              <Clock size={14} className="mr-2" /> Refresh
            </Button>
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-100"
              disabled={selectedUsers.size === 0}
              onClick={() => setBulkModalOpen(true)}>
              <Send size={14} className="mr-2" /> Bulk Outreach ({selectedUsers.size})
            </Button>

            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                onClick={onClose}
              >
                <X size={20} />
              </Button>
            )}
          </div>
        </div>
        {/* Main Dashboard Content */}
        {/* Tab Panels ordered to match Navigation */}
        <TabsContent value="explorer" className="mt-0 flex-1 flex flex-col items-stretch outline-none overflow-hidden min-h-0 bg-transparent">
          <div className="flex flex-col p-3 shrink-0">
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
            </div>
          </div>
        <div className="flex-1 flex flex-col min-h-0 px-3 pb-3">
            <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* User Directory List */}
              <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 shadow-sm">
                  <tr>
                    <th className="p-4 w-12 text-center">
                      <Checkbox
                        checked={filteredUsers.length > 0 && selectedUsers.size === filteredUsers.length}
                        onCheckedChange={toggleSelectAll}
                        className="border-slate-300"
                      />
                    </th>
                    <th className="p-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Publisher Identity</th>
                    <th className="p-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-40 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400 space-y-3">
                          <div className="p-4 bg-slate-50 rounded-full"><Search size={32} className="opacity-20 text-indigo-600" /></div>
                          <p className="text-sm italic font-black uppercase tracking-widest">No users match your filters</p>
                          <Button variant="outline" size="sm" onClick={() => {
                            setSearchTerm('');
                            setInitialFilterActive(false);
                          }} className="text-indigo-600 border-indigo-100 hover:bg-indigo-50 rounded-xl">Clear all filters</Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user, idx) => {
                      const userId = String(user.user_id || user._id || `user-${idx}`);
                      const userVerts = getVerticalsArray(user);
                      const isSelected = selectedUsers.has(userId);

                      // Risk/Status logic
                      const hasFailed = (user.logs || []).some((l: any) => l.status === 'failed');
                      const isSuspicious = user.isSuspicious;
                      const hasSharedAccount = user.sharedAccount;

                      const getUserTheme = () => {
                        if (isSuspicious) return { row: 'bg-red-50/30 hover:bg-red-50/50', badge: 'bg-red-100 text-red-700', icon: 'text-red-500' };
                        if (hasFailed) return { row: 'bg-amber-50/30 hover:bg-amber-50/50', badge: 'bg-amber-100 text-amber-700', icon: 'text-amber-500' };
                        if (hasSharedAccount) return { row: 'bg-purple-50/30 hover:bg-purple-50/50', badge: 'bg-purple-100 text-purple-700', icon: 'text-purple-500' };
                        return { row: 'hover:bg-slate-50/80', badge: 'bg-slate-100 text-slate-600', icon: 'text-slate-400' };
                      };

                      const theme = getUserTheme();

                      return (
                        <tr
                          key={`${userId}-${idx}`}
                          className={`transition-colors cursor-pointer ${isSelected ? 'bg-indigo-50/40' : theme.row}`}
                          onClick={() => toggleUserSelection(userId)}
                        >
                          <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <Checkbox checked={isSelected} onCheckedChange={() => toggleUserSelection(userId)} className="h-4 w-4 rounded-md" />
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white text-sm font-black shadow-lg shadow-indigo-100 shrink-0 border-2 border-white">
                                {user.username?.[0]?.toUpperCase() || 'U'}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-[15px] text-slate-900 truncate tracking-tight uppercase leading-none">{user.username}</span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Live</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <p className="text-[10px] font-bold text-slate-400 truncate">{user.email}</p>
                                  {isSuspicious && <Badge className="bg-red-500 text-white border-none text-[7px] h-3.5 px-1 font-black">RISK</Badge>}
                                  {hasSharedAccount && <Badge className="bg-purple-500 text-white border-none text-[7px] h-3.5 px-1 font-black">SHARED</Badge>}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                              <div
                                onClick={() => { setSelectedUsers(new Set([userId])); setSelectedChannel('Email'); setBulkModalOpen(true); }}
                                className="p-1.5 rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all"
                                title="Email"
                              >
                                <Mail size={12} />
                              </div>
                              <div
                                onClick={() => { setSelectedUsers(new Set([userId])); setSelectedChannel('Telegram'); setBulkModalOpen(true); }}
                                className="p-1.5 rounded-lg border border-sky-100 bg-sky-50 text-sky-600 hover:bg-sky-600 hover:text-white transition-all"
                                title="Telegram"
                              >
                                <Send size={12} />
                              </div>
                              <div
                                onClick={() => { setSelectedUsers(new Set([userId])); setSelectedChannel('Teams'); setBulkModalOpen(true); }}
                                className="p-1.5 rounded-lg border border-indigo-100 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all"
                                title="Teams"
                              >
                                <MessageCircle size={12} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </TabsContent>

        <TabsContent value="inbox" className="mt-0 flex-1 flex flex-col items-stretch outline-none bg-[#F8FAFC] min-h-0 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 flex-1 min-h-0 overflow-hidden p-3">
            <Card className="rounded-2xl border-slate-200 overflow-hidden flex flex-col bg-white">
              <div className="p-4 border-b bg-slate-50/50">
                <h3 className="text-sm font-bold flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Inbox size={16} className="text-indigo-500" />
                    Conversations
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">{inboxFilter === 'replies' ? 'User Replies' : 'All Messages'}</span>
                    <Badge
                      onClick={() => setInboxFilter(inboxFilter === 'all' ? 'replies' : 'all')}
                      className={`text-[10px] h-5 cursor-pointer px-2 border-none ${inboxFilter === 'replies' ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                    >
                      {inboxFilter === 'replies' ? conversations.filter(c => c.last_sender === 'user' || c.unread_count > 0).length : conversations.length}
                    </Badge>
                  </div>
                </h3>
              </div>
              <ScrollArea className="flex-1">
                <div className="divide-y divide-slate-100">
                  {!conversations || (inboxFilter === 'replies' ? conversations.filter(c => c.last_sender === 'user' || c.unread_count > 0) : conversations).length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs italic">
                      {inboxFilter === 'replies' ? "No pending user replies found" : "No active conversations found"}
                    </div>
                  ) : (inboxFilter === 'replies' ? conversations.filter(c => c.last_sender === 'user' || c.unread_count > 0) : conversations).map(conv => {
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
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            {conv.channel === 'Email' && <Mail size={10} className="text-emerald-500 flex-shrink-0" />}
                            {conv.channel === 'Telegram' && <Send size={10} className="text-blue-500 flex-shrink-0" />}
                            {conv.channel === 'Teams' && <Users size={10} className="text-indigo-500 flex-shrink-0" />}
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Support via {conv.channel}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 truncate italic leading-tight">
                            {conv.last_message_body || (conv.last_sender === 'user' ? "User sent a reply..." : "Outreach message sent...")}
                          </p>
                        </div>
                        {conv.last_sender === 'user' && (
                          <div className="mt-2 flex items-center gap-1">
                            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none text-[8px] h-4 px-1.5 font-black flex items-center gap-0.5">
                              <Reply size={8} /> USER REPLIED
                            </Badge>
                            <span className="text-[8px] text-emerald-600 font-bold flex items-center gap-0.5">
                              <Sparkles size={8} /> Needs Attention
                            </span>
                          </div>
                        )}
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
                        <div key={msg._id} className={`flex flex-col ${msg.sender_type === 'admin' ? 'items-end' : 'items-start'}`}>
                          <span className="text-[9px] font-bold text-slate-400 mb-1 px-1 uppercase tracking-tighter">
                            {msg.sender_type === 'admin' ? 'Admin Outreach' : 'User Reply'}
                          </span>
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

        <TabsContent value="templates" className="mt-0 flex-1 flex flex-col items-stretch outline-none bg-[#F8FAFC] min-h-0 overflow-hidden">
          <div className="p-4 md:p-6 border-b bg-white flex items-center justify-between shrink-0 w-full">
            <div>
              <h3 className="text-sm font-black flex items-center gap-2 uppercase tracking-widest text-slate-800">
                <Layout className="text-indigo-500" size={18} />
                Outreach Templates
              </h3>
              <p className="text-[10px] text-slate-500 font-bold italic">Design and automate your publisher messaging strategies</p>
            </div>
            <Button size="sm" onClick={openCreateTemplate} className="bg-indigo-600 hover:bg-indigo-700 h-8 rounded-xl shadow-sm">
              <Plus size={14} className="mr-1.5" /> Create Template
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 custom-scrollbar bg-slate-50/50">
            {!templates || templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-slate-400 space-y-4 py-32 bg-white rounded-3xl border border-dashed border-slate-200">
                <div className="p-4 bg-slate-50 rounded-full">
                  <Layout size={40} className="opacity-20 text-indigo-600" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-600">No messaging templates yet</p>
                  <p className="text-[11px] text-slate-400 mt-1">Create your first template to start bulk outreach.</p>
                </div>
                <Button variant="outline" size="sm" onClick={openCreateTemplate} className="rounded-xl border-indigo-100 text-indigo-600">
                  <Plus size={14} className="mr-1.5" /> Create First Template
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {templates.map(template => (
                  <Card key={template._id} className="group relative overflow-hidden p-0 hover:border-indigo-300 transition-all bg-white shadow-sm border-slate-200 rounded-2xl">
                    <div className="p-5 flex flex-col h-full">
                      <div className="flex items-start justify-between mb-4">
                        <div className="space-y-1">
                          <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{template.name}</h4>
                          <Badge variant="secondary" className="text-[9px] uppercase font-bold tracking-tight bg-slate-100 text-slate-600">{template.category}</Badge>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-indigo-50 hover:text-indigo-600" onClick={() => openEditTemplate(template)}>
                            <Settings size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-red-50 hover:text-red-600" onClick={() => handleDeleteTemplate(template._id!)}>
                            <XCircle size={14} />
                          </Button>
                        </div>
                      </div>
                      <div className="flex-1 bg-slate-50/50 p-3 rounded-xl border border-slate-100/50 mb-4">
                        <p className="text-xs text-slate-600 line-clamp-4 leading-relaxed font-serif italic">"{template.body}"</p>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-auto pt-2">
                        <span className="flex items-center gap-1"><Sparkles size={10} className="text-amber-400" /> Dynamic Personalization</span>
                        <span className="font-medium text-indigo-500 cursor-pointer hover:underline" onClick={() => openEditTemplate(template)}>Preview & Edit</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <Dialog open={templateModalOpen} onOpenChange={setTemplateModalOpen}>
            <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden rounded-2xl border-none z-[200]">
              <div className="bg-slate-900 p-6 text-white">
                <DialogHeader>
                  <DialogTitle className="text-xl flex items-center gap-2 text-white">
                    <Layout className="text-indigo-400" size={20} />
                    {editingTemplate ? "Edit Template" : "Create New Template"}
                  </DialogTitle>
                  <DialogDescription className="text-slate-400 mt-1">
                    Design highly personalized messages using dynamic placeholders.
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="p-6 space-y-6 bg-white max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Template Name</label>
                    <Input
                      placeholder="e.g. Geo-Targeted Offer"
                      value={templateForm.name}
                      onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })}
                      className="rounded-xl border-slate-200 bg-slate-50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Category</label>
                    <Select value={templateForm.category} onValueChange={val => setTemplateForm({ ...templateForm, category: val })}>
                      <SelectTrigger className="rounded-xl border-slate-200 bg-slate-50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Geo-based">Geo-based</SelectItem>
                        <SelectItem value="Vertical-based">Vertical-based</SelectItem>
                        <SelectItem value="Combined">Combined</SelectItem>
                        <SelectItem value="Support">Support</SelectItem>
                        <SelectItem value="General">General</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email Subject</label>
                  <Input value={templateForm.subject} onChange={e => setTemplateForm({ ...templateForm, subject: e.target.value })} placeholder="e.g. Recommended Offers for {user}" className="rounded-xl border-slate-200 bg-slate-50 text-sm h-11" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Message Body</label>
                    <div className="flex gap-2">
                      {['{user}', '{location}', '{vertical}', '{offer}'].map(tag => (
                        <button
                          key={tag}
                          onClick={() => setTemplateForm({ ...templateForm, body: templateForm.body + tag })}
                          className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 text-[10px] font-bold hover:bg-indigo-100"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    rows={6}
                    value={templateForm.body}
                    onChange={e => setTemplateForm({ ...templateForm, body: e.target.value })}
                    placeholder="Hi {user}, check out these {vertical} offers in {location}..."
                    className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                  />
                </div>

                <div className="space-y-3">
                  <h5 className="text-[10px] font-bold uppercase text-indigo-600 flex items-center gap-1.5 pt-2">
                    <Sparkles size={12} className="text-amber-400" />
                    Live Intelligent Preview
                  </h5>
                  <div className="p-4 bg-indigo-50/30 rounded-2xl border border-indigo-100/50 space-y-4">
                    <div className="flex items-start gap-2">
                      <div className="w-8 h-8 rounded-full bg-white border border-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600 flex-shrink-0">JD</div>
                      <div className="px-4 py-2 rounded-2xl bg-white border border-indigo-100 shadow-sm">
                        <h6 className="text-[10px] font-black text-indigo-600 mb-1">{getPreview(templateForm.subject, { username: "JohnDoe", country: "United States", city: "New York", verticals: ["Finance"] })}</h6>
                        <p className="text-xs text-slate-700 leading-relaxed italic">
                          "{getPreview(templateForm.body, { username: "JohnDoe", country: "United States", city: "New York", verticals: ["Finance"] })}"
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 justify-end">
                      <div className="px-4 py-2 rounded-2xl bg-indigo-600 text-white shadow-md">
                        <h6 className="text-[10px] font-black text-white mb-1">{getPreview(templateForm.subject, { username: "Sarah", country: "India", city: "Mumbai", verticals: ["Survey"] })}</h6>
                        <p className="text-xs leading-relaxed italic">
                          "{getPreview(templateForm.body, { username: "Sarah", country: "India", city: "Mumbai", verticals: ["Survey"] })}"
                        </p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600 flex-shrink-0">SK</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t flex items-center justify-end gap-3">
                <Button variant="ghost" size="sm" onClick={() => setTemplateModalOpen(false)}>Cancel</Button>
                <Button size="sm" onClick={handleSaveTemplate} disabled={isSavingTemplate} className="bg-indigo-600 px-6">
                  {isSavingTemplate ? "Saving..." : (editingTemplate ? "Update Template" : "Save Template")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="settings" className="mt-0 flex-1 flex flex-col items-stretch outline-none overflow-hidden min-h-0 bg-[#F8FAFC]">
          <div className="p-3 bg-slate-50/50 flex-1 overflow-y-auto custom-scrollbar flex flex-col justify-start">
            <div className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-xl"><Settings className="text-indigo-600" size={20} /></div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Hub Configuration & Branding</h2>
                  <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Global Messaging Control Center</p>
                </div>
              </div>
              {returnToOutreach && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => { setReturnToOutreach(false); setActiveTab('explorer'); setBulkModalOpen(true); }}
                  className="rounded-xl border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold gap-2"
                >
                  <ChevronLeft size={14} /> Return to Outreach
                </Button>
              )}
            </div>
            {supportSettings ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <div className="space-y-8">
                  <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                    <CardHeader className="bg-white border-b border-slate-50">
                      <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800"><Mail className="text-indigo-500" size={16} /> Support Identity</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-5 bg-white">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase text-slate-400">Sender Display Name</label>
                        <Input value={supportSettings.support_name || 'Publisher Support Team'} onChange={e => setSupportSettings({ ...supportSettings, support_name: e.target.value })} className="rounded-xl border-slate-200 bg-slate-50 text-sm h-11" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase text-slate-400">Official Support Email</label>
                        <Input value={supportSettings.support_email || 'support@moustacheleads.com'} onChange={e => setSupportSettings({ ...supportSettings, support_email: e.target.value })} className="rounded-xl border-slate-200 bg-slate-50 text-sm h-11" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase text-slate-400">Default Email Subject</label>
                        <Input value={supportSettings.default_subject || 'Recommended Offers'} onChange={e => setSupportSettings({ ...supportSettings, default_subject: e.target.value })} className="rounded-xl border-slate-200 bg-slate-50 text-sm h-11" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase text-slate-400">Default Message Signature</label>
                        <textarea rows={4} value={supportSettings.default_signature || 'Best regards,\nPublisher Support Team\nMoustache Leads'} onChange={e => setSupportSettings({ ...supportSettings, default_signature: e.target.value })} className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-indigo-500 min-h-[120px]" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                    <CardHeader className="bg-white border-b border-slate-50">
                      <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800"><Sparkles className="text-indigo-500" size={16} /> Personalization Hooks</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4 bg-white">
                      {(typeof supportSettings.strategy_hooks !== 'object' || !supportSettings.strategy_hooks) ? (<div className="p-8 text-center text-slate-400 text-xs italic bg-slate-50 rounded-xl border border-dashed">No hooks found.</div>) : (
                        Object.entries(supportSettings.strategy_hooks).map(([key, value]: [string, any]) => (
                          <div key={key} className="space-y-3 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                            <div className="space-y-1"><label className="text-[9px] font-bold uppercase text-slate-400">Strategy Label</label><Input value={supportSettings.strategy_labels?.[key] || key} onChange={e => setSupportSettings({ ...supportSettings, strategy_labels: { ...supportSettings.strategy_labels, [key]: e.target.value } })} className="h-9 rounded-xl border-slate-200 bg-white text-xs font-bold" /></div>
                            <div className="space-y-1"><label className="text-[9px] font-bold uppercase text-slate-400">Custom Opening Hook</label><Input value={value || ''} onChange={e => setSupportSettings({ ...supportSettings, strategy_hooks: { ...supportSettings.strategy_hooks, [key]: e.target.value } })} className="h-9 rounded-xl border-slate-200 bg-white text-xs" /></div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
                <div className="space-y-8">
                  <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                    <CardHeader className="bg-white border-b border-slate-50">
                      <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800"><Cpu className="text-indigo-500" size={16} /> Channel API Integrations</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6 bg-white">
                      <div className="space-y-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Send className="text-sky-500" size={16} />
                            <span className="text-[11px] font-black uppercase text-slate-700 tracking-wider">Telegram Bot API</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleStartLinking('Telegram')}
                              className="h-6 px-4 text-[9px] font-black uppercase tracking-tighter bg-sky-100 text-sky-700 hover:bg-sky-200 rounded-full"
                            >
                              Connect Telegram Account
                            </Button>
                            <div className={`w-2.5 h-2.5 rounded-full ${channelConnections['Telegram'] ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]'}`} />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold uppercase text-slate-400">Bot Token</label>
                          <Input 
                            type="password"
                            value={supportSettings.channel_configs?.Telegram?.token || ''} 
                            onChange={e => setSupportSettings({ 
                              ...supportSettings, 
                              channel_configs: { 
                                ...supportSettings.channel_configs, 
                                Telegram: { ...supportSettings.channel_configs?.Telegram, token: e.target.value } 
                              } 
                            })} 
                            className="h-9 rounded-xl border-slate-200 bg-white text-xs" 
                            placeholder="e.g. 123456789:ABCdef..." 
                          />
                        </div>
                      </div>

                      <div className="space-y-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Users className="text-indigo-500" size={16} />
                            <span className="text-[11px] font-black uppercase text-slate-700 tracking-wider">Microsoft Teams Webhook</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleStartLinking('Teams')}
                              className="h-6 px-4 text-[9px] font-black uppercase tracking-tighter bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-full"
                            >
                              Connect Teams Account
                            </Button>
                            <div className={`w-2.5 h-2.5 rounded-full ${channelConnections['Teams'] ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]'}`} />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold uppercase text-slate-400">Webhook URL</label>
                          <Input 
                            value={supportSettings.channel_configs?.Teams?.webhook_url || ''} 
                            onChange={e => setSupportSettings({ 
                              ...supportSettings, 
                              channel_configs: { 
                                ...supportSettings.channel_configs, 
                                Teams: { ...supportSettings.channel_configs?.Teams, webhook_url: e.target.value } 
                              } 
                            })} 
                            className="h-9 rounded-xl border-slate-200 bg-white text-xs" 
                            placeholder="https://outlook.office.com/webhook/..." 
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 p-3 bg-indigo-50 rounded-xl text-[10px] text-indigo-600 font-bold italic">
                        <Sparkles size={12} />
                        Verified connections enable the 'Outreach Command Center' for bulk campaigns.
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                    <CardHeader className="bg-white border-b border-slate-50">
                      <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800"><Layout className="text-indigo-500" size={16} /> Visual Engine</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 bg-white"><EmailSettingsPanel settings={(supportSettings.email_settings && typeof supportSettings.email_settings === 'object') ? supportSettings.email_settings : DEFAULT_EMAIL_SETTINGS} onChange={newSettings => setSupportSettings({ ...supportSettings, email_settings: newSettings })} /></CardContent>
                  </Card>
                  <div className="p-6 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-100 flex items-center justify-between group cursor-pointer active:scale-95 transition-all" onClick={handleSaveSettings}>
                    <div><h4 className="text-white font-bold text-sm">Apply Configurations</h4><p className="text-indigo-100 text-[10px]">Update all templates immediately</p></div>
                    <Button disabled={isSavingSettings} className="bg-white text-indigo-600 hover:bg-white/90 rounded-xl px-6 font-black h-11">{isSavingSettings ? "Syncing..." : "Save Settings"}</Button>
                  </div>
                </div>
              </div>
            ) : (<div className="p-20 text-center bg-white rounded-3xl border border-dashed border-slate-200"><p className="text-slate-400 italic text-sm">Loading hub configuration...</p></div>)}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={bulkModalOpen} onOpenChange={setBulkModalOpen}>
        <DialogContent className="sm:max-w-[1100px] w-[95vw] p-0 overflow-hidden rounded-[2.5rem] border-none z-[200] shadow-[0_32px_80px_-20px_rgba(0,0,0,0.5)] max-h-[85vh] flex flex-col bg-[#F8FAFC]">
          <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-8 text-white shrink-0 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-400/20 rounded-full -ml-24 -mb-24 blur-2xl pointer-events-none" />
            
            <div className="flex justify-between items-start relative z-10">
              <div>
                <DialogTitle className="text-3xl font-black flex items-center gap-4 tracking-tighter">
                  <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                    <Sparkles size={28} className="text-amber-300 animate-pulse" />
                  </div>
                  Outreach Command Center
                </DialogTitle>
                <div className="text-indigo-100 mt-3 flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-white/15 px-4 py-1.5 rounded-2xl border border-white/10 backdrop-blur-sm shadow-sm">
                    <Users size={16} />
                    <span className="font-black text-sm">{selectedUsers.size} Targets Selected</span>
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-indigo-500/20 border border-indigo-400/20">
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-200">Personalization Engine Active</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => loadData()}
                  className="text-white/80 hover:text-white hover:bg-white/10 rounded-2xl gap-2 h-10 px-4 transition-all"
                  disabled={loading}
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Clock size={16} />}
                  <span className="text-xs font-black uppercase tracking-widest">Refresh Sync</span>
                </Button>
                <div className="w-px h-8 bg-white/20 mx-1" />
                <Button variant="ghost" size="icon" className="h-10 w-10 text-white/70 hover:text-white hover:bg-red-500/20 hover:scale-110 transition-all rounded-xl" onClick={() => setBulkModalOpen(false)}>
                  <X size={24} />
                </Button>
              </div>
            </div>
          </div>
          <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden bg-white">
            {/* Left Side: Recipient Intelligence List */}
            <div className="w-full lg:w-[320px] border-r border-slate-100 bg-[#F1F5F9]/50 flex flex-col min-h-0">
              <div className="p-5 border-b bg-white/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-10">
                <div className="flex flex-col">
                  <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-[0.2em]">Queue Context</h4>
                  <p className="text-[10px] font-bold text-slate-500 mt-0.5">Prioritizing {selectedUsers.size} publishers</p>
                </div>
                <Badge className="bg-indigo-600 text-white border-none text-[10px] px-2 h-5">LIVE</Badge>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-3 space-y-2">
                  {Array.from(selectedUsers).map((uId, idx) => {
                    const user = allSupportUsers.find(u => String(u.user_id || u._id) === uId);
                    const isCurrent = previewIdx === idx;
                    return (
                      <div
                        key={uId}
                        onClick={() => setPreviewIdx(idx)}
                        className={`group p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 ${isCurrent ? 'bg-white border-indigo-200 shadow-lg shadow-indigo-100/50 scale-[1.02]' : 'bg-transparent border-transparent hover:bg-white hover:border-slate-200'}`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shadow-sm transition-all ${isCurrent ? 'bg-gradient-to-br from-indigo-500 to-indigo-700 text-white' : 'bg-slate-200 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600'}`}>
                          {user?.username?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[12px] font-black truncate tracking-tight transition-colors ${isCurrent ? 'text-slate-900' : 'text-slate-600'}`}>{user?.username || 'Unknown'}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div className={`w-1 h-1 rounded-full ${isCurrent ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                            <p className="text-[10px] font-bold text-slate-400 truncate tracking-tight">{user?.email}</p>
                          </div>
                        </div>
                        {isCurrent && (
                          <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <CheckCircle size={14} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              <div className="p-4 bg-white border-t border-slate-100">
                <div className="flex items-center gap-2 text-indigo-600">
                  <Activity size={14} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Real-time Syncing...</span>
                </div>
              </div>
            </div>

            {/* Right Side: Composition Engine */}
            <ScrollArea className="flex-1 bg-slate-50/30">
              <div className="p-8 space-y-8 max-w-[800px] mx-auto">
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
                  <div className="p-6 border-b bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><Zap size={18} /></div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900">Message Strategy</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select outreach framework</p>
                      </div>
                    </div>
                    <Select value={selectedMessageType} onValueChange={setSelectedMessageType}>
                      <SelectTrigger className="w-[200px] rounded-xl border-slate-200 bg-white shadow-sm font-bold text-xs h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['Geo-based', 'Vertical-based', 'Combined', 'Custom'].map(type => (
                          <SelectItem key={type} value={type}>
                            {supportSettings.strategy_labels?.[type] || type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Template</label>
                    <div className="flex gap-2">
                      <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                        <SelectTrigger className="rounded-xl border-slate-200 bg-slate-50 flex-1">
                          <SelectValue placeholder="Choose template..." />
                        </SelectTrigger>
                        <SelectContent className="z-[300]">
                          {templates.length === 0 ? (
                            <SelectItem value="none" disabled>No templates found - Create one first</SelectItem>
                          ) : (
                            templates.map(t => (
                              <SelectItem key={t._id || Math.random().toString()} value={t._id || ''}>
                                {t.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setTimeout(() => openCreateTemplate(), 100);
                        }}
                        className="rounded-xl h-10 w-10 shrink-0"
                      >
                        <Plus size={16} />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 flex items-center gap-1">
                        <Sparkles size={12} /> Strategy Name & Hook
                      </label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleUpdateStrategyHook}
                        disabled={
                          activeStrategyHook === (supportSettings.strategy_hooks?.[selectedMessageType] || '') &&
                          activeStrategyLabel === (supportSettings.strategy_labels?.[selectedMessageType] || '')
                        }
                        className="h-5 text-[9px] font-bold text-indigo-400 hover:text-indigo-600 p-0"
                      >
                        Save Strategy Changes
                      </Button>
                    </div>

                    <div className="grid grid-cols-[140px_1fr] gap-2">
                      <Input
                        placeholder="Strategy Name"
                        value={activeStrategyLabel}
                        onChange={e => setActiveStrategyLabel(e.target.value)}
                        className="rounded-xl border-indigo-100 bg-indigo-50/50 text-xs font-bold"
                      />
                      <Input
                        placeholder="e.g. Hey {user}, exclusive deals for you..."
                        value={activeStrategyHook}
                        onChange={e => setActiveStrategyHook(e.target.value)}
                        className="rounded-xl border-indigo-100 bg-indigo-50/30 text-xs"
                      />
                    </div>
                    <div className="flex gap-2">
                      {['{user}', '{location}', '{vertical}'].map(tag => (
                        <button key={tag} onClick={() => setActiveStrategyHook(prev => prev + tag)} className="text-[9px] font-bold text-indigo-400 hover:text-indigo-600">+{tag}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {activeTemplate && (
                  <div className="space-y-4">
                    <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 space-y-1">
                          <label className="text-[10px] font-black uppercase text-indigo-600 flex items-center gap-1.5">
                            <Layout size={12} /> Template Name
                          </label>
                          <Input
                            value={editingTemplateName}
                            onChange={e => setEditingTemplateName(e.target.value)}
                            className="h-8 rounded-xl border-indigo-100 bg-white text-xs font-bold"
                            placeholder="Template name..."
                          />
                        </div>
                        <div className="flex-shrink-0 pt-5">
                          <Badge variant="outline" className="bg-white border-indigo-200 text-indigo-700 text-[10px] uppercase font-bold">{activeTemplate.category}</Badge>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-indigo-600 flex items-center gap-1.5">
                          <Tag size={12} /> Email Subject
                        </label>
                        <Input
                          value={emailSubject}
                          onChange={e => handlePersonalInputChange('subject', e.target.value)}
                          className="h-9 rounded-xl border-indigo-100 bg-white text-xs font-bold"
                          placeholder="Subject line..."
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-indigo-600 flex items-center gap-1.5">
                          <Edit3 size={12} /> Message Body
                        </label>
                        <textarea
                          rows={4}
                          value={editingTemplateBody}
                          onChange={e => handlePersonalInputChange('body', e.target.value)}
                          className="w-full p-3 rounded-xl border border-indigo-100 bg-white text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all italic font-serif"
                          placeholder="Message content..."
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex gap-1.5">
                          {['{user}', '{location}', '{vertical}', '{offer}'].map(tag => (
                            <button key={tag} onClick={() => handlePersonalInputChange('body', editingTemplateBody + tag)} className="text-[9px] font-bold text-indigo-400 hover:text-indigo-600 bg-white px-1.5 py-0.5 rounded border border-indigo-50">+{tag}</button>
                          ))}
                        </div>
                        <div className="flex gap-1.5 items-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={copyToAll}
                            className="h-7 text-[10px] font-black uppercase bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100"
                          >
                            <Zap size={10} className="mr-1" /> Copy to All
                          </Button>
                          <div className="w-[1px] h-3 bg-indigo-200 mx-1" />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleUpdateActiveTemplate}
                            disabled={
                              isUpdatingTemplate ||
                              (editingTemplateBody === activeTemplate?.body && editingTemplateName === activeTemplate?.name)
                            }
                            className="h-7 text-[10px] font-bold text-indigo-600 hover:bg-white"
                          >
                            {isUpdatingTemplate ? "Saving..." : "Save Template Changes"}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">Live Personalization Preview for {previewUser?.username}</span>
                      <p className="text-xs text-slate-600 leading-relaxed font-medium">
                        "{getPreview(editingTemplateBody, previewUser)}"
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Template Style & Fields</label>
                  <EmailSettingsPanel
                    compact
                    settings={supportSettings.email_settings || DEFAULT_EMAIL_SETTINGS}
                    onChange={newSettings => setSupportSettings({ ...supportSettings, email_settings: newSettings })}
                  />
                </div>

                <div className="space-y-3 bg-slate-50/50 p-5 rounded-3xl border border-slate-100">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Outreach Command Center</label>
                    <div className="flex items-center gap-1.5 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                      <div className={`w-1.5 h-1.5 rounded-full ${channelConnections[selectedChannel] ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 animate-pulse'}`} />
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{channelConnections[selectedChannel] ? 'Connected' : 'Not Connected'}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {['Email', 'Telegram', 'Teams', 'Chat'].map(ch => {
                      const isConnected = channelConnections[ch];
                      const isActive = selectedChannel === ch;
                      const currentUserId = Array.from(selectedUsers)[0];
                      const mapping = currentUserId && supportSettings?.channel_configs?.[ch]?.user_mappings?.[currentUserId];
                      const isLinked = !!mapping;

                      return (
                        <div key={ch} className="relative group">
                          <button
                            onClick={() => setSelectedChannel(ch)}
                            className={`w-full flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all relative overflow-hidden ${isActive ? 'border-indigo-600 bg-white shadow-xl shadow-indigo-100/50 -translate-y-1' : 'border-slate-100 bg-white/50 text-slate-400 hover:border-slate-200 hover:bg-white'}`}
                          >
                            <div className={`p-2 rounded-xl transition-all ${isActive ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-400'}`}>
                              {ch === 'Email' && <Mail size={18} />}
                              {ch === 'Telegram' && <Send size={18} />}
                              {ch === 'Teams' && <Users size={18} />}
                              {ch === 'Chat' && <MessageSquare size={18} />}
                            </div>
                            <div className="text-center">
                              <span className={`text-[10px] font-black uppercase tracking-tight block ${isActive ? 'text-slate-900' : 'text-slate-500 opacity-60'}`}>{ch}</span>
                              {isLinked && (
                                <span className="text-[8px] font-bold text-emerald-600 truncate max-w-[80px] block mt-0.5">{mapping.name}</span>
                              )}
                            </div>
                            
                            {/* Status Indicator */}
                            <div className={`absolute top-2 right-2 w-2 h-2 rounded-full border-2 border-white ${isConnected && (ch === 'Email' || isLinked) ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`} />
                          </button>
                          
                          {isActive && isConnected && !isLinked && ch !== 'Email' && (
                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-max animate-in fade-in zoom-in duration-200 z-10">
                              <Button 
                                size="sm" 
                                onClick={() => handleStartLinking(ch)}
                                className="h-6 px-3 rounded-full bg-indigo-600 hover:bg-indigo-700 text-[9px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100"
                              >
                                <Plus size={10} className="mr-1" /> Link {ch} Identity
                              </Button>
                            </div>
                          )}

                          {isActive && !isConnected && (
                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-max animate-in fade-in zoom-in duration-200 z-10">
                              <Button 
                                size="sm" 
                                onClick={() => handleConnectChannel(ch)}
                                className="h-6 px-3 rounded-full bg-red-600 hover:bg-red-700 text-[9px] font-black uppercase tracking-widest shadow-lg shadow-red-100"
                              >
                                Connect {ch}
                              </Button>
                            </div>
                          )}
                        </div>
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
            </ScrollArea>
          </div>
          <div className="p-4 bg-slate-50 border-t flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <Clock size={12} className={scheduledTime ? "text-indigo-500" : ""} />
              <span className={scheduledTime ? "text-indigo-600 font-medium" : ""}>
                {scheduledTime ? `Scheduled for ${new Date(scheduledTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}` : "Scheduled for immediate dispatch"}
              </span>
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" size="sm" onClick={() => setBulkModalOpen(false)}>Cancel</Button>
              <Button 
                size="sm" 
                onClick={handleOpenPreview} 
                disabled={
                  isSending || 
                  !selectedTemplateId || 
                  !channelConnections[selectedChannel] || 
                  (selectedChannel !== 'Email' && !supportSettings?.channel_configs?.[selectedChannel]?.user_mappings?.[Array.from(selectedUsers)[0]])
                } 
                className={`${
                  !channelConnections[selectedChannel] || 
                  (selectedChannel !== 'Email' && !supportSettings?.channel_configs?.[selectedChannel]?.user_mappings?.[Array.from(selectedUsers)[0]])
                    ? 'bg-slate-300 text-slate-500' 
                    : 'bg-indigo-600'
                } px-6`}
              >
                {(!channelConnections[selectedChannel]) 
                  ? `Connect ${selectedChannel}` 
                  : (selectedChannel !== 'Email' && !supportSettings?.channel_configs?.[selectedChannel]?.user_mappings?.[Array.from(selectedUsers)[0]])
                    ? `Link ${selectedChannel} Identity`
                    : (scheduledTime ? "Schedule Outreach" : "View Final Preview")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* High-Fidelity Preview Confirmation Modal */}
      <Dialog open={bulkPreviewOpen} onOpenChange={setBulkPreviewOpen}>
        <DialogContent className="sm:max-w-[750px] w-[95vw] p-0 overflow-hidden rounded-[2.5rem] border-none shadow-[0_40px_100px_-20px_rgba(0,0,0,0.6)] z-[250] bg-white">
          <div className="bg-[#0F172A] p-10 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/20 rounded-full -mr-40 -mt-40 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-60 h-60 bg-violet-500/10 rounded-full -ml-30 -mb-30 blur-2xl" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10">
                  <Send className="text-indigo-400" size={28} />
                </div>
                <div>
                  <DialogTitle className="text-3xl font-black tracking-tight">Confirm Outreach</DialogTitle>
                  <p className="text-indigo-300/80 text-xs font-black uppercase tracking-[0.2em] mt-1">Final Dispatch Authorization</p>
                </div>
              </div>
              <DialogDescription className="text-slate-400 text-base leading-relaxed">
                Reviewing personalized intelligence for <span className="text-white font-bold px-2 py-0.5 bg-indigo-500/30 rounded-lg">{selectedUsers.size}</span> verified publishers.
              </DialogDescription>
            </div>
          </div>

          <div className="p-8 space-y-6 bg-slate-50 max-h-[60vh] overflow-y-auto custom-scrollbar">
            {isPreviewing ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-6">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-indigo-100 rounded-full" />
                  <div className="absolute inset-0 w-20 h-20 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-slate-900 font-black uppercase tracking-widest text-sm">Personalizing Dispatch</p>
                  <p className="text-slate-400 text-xs font-bold mt-1">Applying geo-intelligence and vertical hooks...</p>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="flex items-center gap-4 p-4 bg-indigo-50/50 border border-indigo-100 rounded-[2rem]">
                  <div className="p-3 bg-white rounded-2xl text-indigo-600 shadow-sm"><Eye size={20} /></div>
                  <div className="flex-1">
                    <h4 className="text-sm font-black text-slate-900 leading-none">Intelligence Validation</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">Reviewing {previewSamples.length} of {selectedUsers.size} personalized variants</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Verified</span>
                  </div>
                </div>

                <div className="grid gap-6">
                  {previewSamples.map((sample, idx) => (
                    <div key={idx} className="group relative">
                      <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-1 h-12 bg-indigo-200 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-xl hover:shadow-indigo-100/50 hover:border-indigo-200">
                        <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-[10px] font-black">
                              {sample.username[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-black text-slate-900">{sample.username}</p>
                              <p className="text-[9px] font-bold text-slate-400">{sample.email}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-slate-200 text-slate-500">
                            {selectedChannel} Variant
                          </Badge>
                        </div>
                        <div className="p-6 bg-white">
                          <div className="mb-4 flex items-start gap-2">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-0.5">Subject:</span>
                            <h5 className="text-sm font-black text-slate-800 tracking-tight">{sample.subject}</h5>
                          </div>
                          <div className="p-5 bg-slate-50/50 rounded-2xl border border-slate-100 relative group/msg">
                            <div className="absolute top-4 right-4 opacity-10 group-hover/msg:opacity-30 transition-opacity"><MessageSquare size={40} /></div>
                            <p className="text-xs text-slate-700 leading-relaxed font-medium whitespace-pre-wrap italic relative z-10">
                              "{sample.personalized}"
                            </p>
                            
                            {selectedChannel !== 'Email' && (
                              <div className="mt-4 pt-4 border-t border-slate-200 flex justify-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border-indigo-200 text-indigo-600 hover:bg-indigo-50 gap-2"
                                  onClick={() => {
                                    navigator.clipboard.writeText(sample.personalized);
                                    toast({ title: "Copied!", description: "Message copied to clipboard." });
                                    
                                    // Deep link logic
                                    const userId = Array.from(selectedUsers)[idx];
                                    const config = supportSettings?.channel_configs?.[selectedChannel]?.user_mappings?.[userId];
                                    if (config?.id) {
                                      let url = '';
                                      if (selectedChannel === 'Telegram') url = `https://t.me/${config.id}`;
                                      if (selectedChannel === 'Teams') url = `https://teams.microsoft.com/l/chat/0/0?users=${config.id}`;
                                      if (selectedChannel === 'Chat') url = config.id.startsWith('http') ? config.id : `https://${config.id}`;
                                      
                                      if (url) window.open(url, '_blank');
                                    } else {
                                      toast({ title: "Identity Missing", description: `Please link ${selectedChannel} identity for this user first.`, variant: "destructive" });
                                    }
                                  }}
                                >
                                  <ExternalLink size={12} /> Copy & Open {selectedChannel}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-6 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[2.5rem] text-white shadow-2xl shadow-indigo-200 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                  <div className="relative z-10 flex items-center justify-between">
                    <div>
                      <h4 className="text-base font-black tracking-tight">Final Authorization</h4>
                      <p className="text-indigo-100/70 text-[10px] font-bold uppercase tracking-widest mt-1">Ready to dispatch via {selectedChannel}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Batch Size</p>
                        <p className="text-xl font-black">{selectedUsers.size} Users</p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                        <CheckCircle size={24} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-8 bg-white border-t flex items-center justify-between gap-6 shrink-0">
            <Button variant="ghost" onClick={() => setBulkPreviewOpen(false)} className="h-12 px-6 rounded-2xl font-black text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all">
              <ChevronLeft size={16} className="mr-2" /> Back to Compose
            </Button>
            <div className="flex gap-4">
              <Button
                onClick={handleBulkSend}
                disabled={isSending || isPreviewing || !channelConnections[selectedChannel]}
                className={`h-14 px-12 rounded-[1.5rem] font-black shadow-[0_20px_40px_-10px_rgba(79,70,229,0.4)] transition-all active:scale-95 flex items-center gap-3 ${
                  !channelConnections[selectedChannel] ? 'bg-slate-400' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {isSending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Zap size={18} className="fill-white" />
                    <span>Confirm & Send to {selectedUsers.size} Users</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Channel Redirection Overlay */}
      {isRedirecting && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/90 backdrop-blur-xl flex flex-col items-center justify-center text-white animate-in fade-in duration-500">
          <div className="relative">
            <div className="w-24 h-24 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              {linkingChannel === 'Telegram' && <Send size={32} className="text-sky-400" />}
              {linkingChannel === 'Teams' && <Users size={32} className="text-indigo-400" />}
              {linkingChannel === 'Chat' && <MessageSquare size={32} className="text-emerald-400" />}
            </div>
          </div>
          <h2 className="mt-8 text-2xl font-black tracking-tight uppercase">Authorizing {linkingChannel}</h2>
          <p className="mt-2 text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">Securely redirecting to platform OAuth portal...</p>
          <div className="mt-12 flex gap-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      )}

      {/* Contact Linker Modal */}
      <Dialog open={contactLinkerOpen} onOpenChange={setContactLinkerOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-[2.5rem] border-none shadow-[0_40px_100px_-20px_rgba(0,0,0,0.6)] z-[500] bg-white">
          <div className="bg-slate-900 p-8 text-white relative">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10">
                {linkingChannel === 'Telegram' && <Send className="text-sky-400" size={24} />}
                {linkingChannel === 'Teams' && <Users className="text-indigo-400" size={24} />}
                {linkingChannel === 'Chat' && <MessageSquare className="text-emerald-400" size={24} />}
              </div>
              <div>
                <DialogTitle className="text-xl font-black tracking-tight">Select {linkingChannel} Contact</DialogTitle>
                <DialogDescription className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Select account to link with publisher</DialogDescription>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <Input
                placeholder={`Search ${linkingChannel} contacts...`}
                value={contactSearchQuery}
                onChange={e => {
                  setContactSearchQuery(e.target.value);
                  handleSearchContacts(e.target.value);
                }}
                className="pl-10 h-12 rounded-xl border-slate-200 bg-slate-50 text-sm focus:ring-indigo-500"
              />
            </div>

            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {isSearchingContacts ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="text-indigo-500 animate-spin" size={24} />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Searching platform...</p>
                  </div>
                ) : contactSearchResults.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs italic">No contacts found. Try a different query.</div>
                ) : (
                  contactSearchResults.map((contact, idx) => (
                    <div
                      key={contact.id}
                      onClick={() => handleMapContact(contact)}
                      className="group flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/50 cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                          <LayoutDashboard size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900">{contact.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">ID: {contact.id}</p>
                        </div>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                        <Plus className="text-indigo-600" size={16} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
          <div className="p-6 bg-slate-50 border-t flex items-center justify-between">
            <Button variant="ghost" onClick={() => setContactLinkerOpen(false)} className="rounded-xl font-bold text-slate-500">Cancel</Button>
            <p className="text-[9px] text-slate-400 font-bold uppercase italic max-w-[200px] text-right">Linking will authorize direct outreach to this specific account.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}; // End of SupportHubContent

const AdminSupportHub: React.FC = () => {
  return (
    <AdminPageGuard requiredTab="support">
      <div className="flex-1 flex flex-col min-h-0">
        <SupportHubContent />
      </div>
    </AdminPageGuard>
  );
};

export default AdminSupportHub;
