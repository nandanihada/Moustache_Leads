import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  RefreshCw, Search, Mail, Send, ChevronLeft, ChevronRight,
  AlertTriangle, CheckCircle, XCircle, Package, Filter, ChevronDown, ChevronUp, BarChart3,
  Eye, MousePointer, Link, FileText, User, Settings,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { searchLogsApi, type SearchLog, type SearchLogsFilters, type RelatedOffer, type SearchSession, type SearchWizardSettings } from '@/services/searchLogsApi';
import { AdminPageGuard } from '@/components/AdminPageGuard';
import EmailSettingsPanel, { DEFAULT_EMAIL_SETTINGS, type EmailSettings } from '@/components/EmailSettingsPanel';
import { API_BASE_URL } from '@/services/apiConfig';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import PublisherIntelligencePanel from '@/components/PublisherIntelligencePanel';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ImagePickerComponent } from '@/components/ImagePickerComponent';
import { ImageIcon } from 'lucide-react';
import { adminOfferApi } from '@/services/adminOfferApi';
import OfferActionIcons from '@/components/OfferActionIcons';
import { DescriptionGeneratorComponent } from '@/components/DescriptionGeneratorComponent';
import { VerticalSuggesterComponent } from '@/components/VerticalSuggesterComponent';

const AdminSearchLogsContent: React.FC = () => {
  const { toast } = useToast();
  const [logs, setLogs] = useState<SearchLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total_searches: 0, no_result_count: 0, not_in_inventory: 0, in_inventory_not_active: 0 });
  const [pagination, setPagination] = useState({ page: 1, per_page: 25, total: 0, pages: 0 });

  // Filters
  const [keywordFilter, setKeywordFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [noResultFilter, setNoResultFilter] = useState('');
  const [inventoryFilter, setInventoryFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [sentTodayFilter, setSentTodayFilter] = useState('');

  // Selection & Email
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [customEmails, setCustomEmails] = useState('');
  const [sendToAll, setSendToAll] = useState(false);
  const [sending, setSending] = useState(false);

  // Inventory email state
  const [inventoryEmailOpen, setInventoryEmailOpen] = useState(false);
  const [inventoryEmailLog, setInventoryEmailLog] = useState<SearchLog | null>(null);
  const [relatedOffers, setRelatedOffers] = useState<RelatedOffer[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [inventorySubject, setInventorySubject] = useState('');
  const [inventoryMessage, setInventoryMessage] = useState('');
  const [inventorySending, setInventorySending] = useState(false);
  const [editingOffers, setEditingOffers] = useState<Array<{ offer_id: string; name: string; image_url: string; target_url: string; payout: number; selected: boolean }>>([]);
  const [inventoryEmailSettings, setInventoryEmailSettings] = useState<EmailSettings>(DEFAULT_EMAIL_SETTINGS);
  const [generalEmailSettings, setGeneralEmailSettings] = useState<EmailSettings>(DEFAULT_EMAIL_SETTINGS);
  const [imagePickerOfferId, setImagePickerOfferId] = useState<string | null>(null);
  const [descPickerOfferId, setDescPickerOfferId] = useState<string | null>(null);
  const [verticalPickerOfferId, setVerticalPickerOfferId] = useState<string | null>(null);

  const openInventoryEmail = async (log: SearchLog) => {
    setInventoryEmailLog(log);
    setInventorySubject(`🔥 Offers matching "${log.keyword}" are available for you!`);
    setInventoryMessage('');
    setInventoryEmailOpen(true);
    setRelatedLoading(true);
    try {
      const res = await searchLogsApi.getRelatedOffers(log.keyword, log.user_id);
      const mapped = (res.offers || []).map(o => ({
        offer_id: o.offer_id,
        name: o.name,
        image_url: o.image_url || o.thumbnail_url || '',
        target_url: o.target_url || o.preview_url || '',
        payout: o.payout || 0,
        selected: true,
      }));
      setEditingOffers(mapped);
      setRelatedOffers(res.offers || []);
    } catch (err: any) {
      toast({ title: 'Error', description: 'Failed to load related offers', variant: 'destructive' });
    } finally {
      setRelatedLoading(false);
    }
  };

  const handleSendInventoryEmail = async () => {
    if (!inventoryEmailLog) return;
    const selected = editingOffers.filter(o => o.selected);
    if (selected.length === 0) {
      toast({ title: 'Error', description: 'Select at least one offer', variant: 'destructive' });
      return;
    }
    setInventorySending(true);
    try {
      const res = await searchLogsApi.sendInventoryEmail({
        search_log_id: inventoryEmailLog._id,
        user_id: inventoryEmailLog.user_id,
        keyword: inventoryEmailLog.keyword,
        offers: selected.map(o => ({ offer_id: o.offer_id, name: o.name, image_url: o.image_url, target_url: o.target_url, payout: o.payout })),
        subject: inventorySubject,
        message: inventoryMessage,
        template_style: inventoryEmailSettings.templateStyle,
        visible_fields: inventoryEmailSettings.visibleFields,
        see_more_fields: inventoryEmailSettings.seeMoreFields,
        default_image: inventoryEmailSettings.defaultImage,
        payout_type: inventoryEmailSettings.payoutType,
        mask_preview_links: inventoryEmailSettings.maskPreviewLinks,
        payment_terms: inventoryEmailSettings.paymentTerms,
      });
      toast({ title: 'Sent', description: res.message });
      setInventoryEmailOpen(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setInventorySending(false);
    }
  };

  const updateEditingOffer = (index: number, field: string, value: string | number | boolean) => {
    setEditingOffers(prev => prev.map((o, i) => i === index ? { ...o, [field]: value } : o));
  };

  const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const filters: SearchLogsFilters = {
        page,
        per_page: 25,
        keyword: keywordFilter,
        user: userFilter,
        no_result: noResultFilter === 'all' ? '' : noResultFilter,
        inventory_status: inventoryFilter === 'all' ? '' : inventoryFilter,
        date_from: dateFrom,
        date_to: dateTo,
        sent_today: sentTodayFilter === 'all' ? '' : sentTodayFilter,
      };
      const res = await searchLogsApi.getLogs(filters);
      setLogs(res.logs);
      setStats(res.stats);
      setPagination(res.pagination);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [keywordFilter, userFilter, noResultFilter, inventoryFilter, dateFrom, dateTo, sentTodayFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === logs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(logs.map(l => l.user_id)));
    }
  };

  const handleSendEmail = async () => {
    if (!emailSubject.trim() || !emailMessage.trim()) {
      toast({ title: 'Error', description: 'Subject and message are required', variant: 'destructive' });
      return;
    }

    // Parse custom emails
    const parsedCustom = customEmails
      .split(/[,;\n]+/)
      .map(e => e.trim().toLowerCase())
      .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

    if (!sendToAll && selectedIds.size === 0 && parsedCustom.length === 0) {
      toast({ title: 'Error', description: 'Select users or add custom emails', variant: 'destructive' });
      return;
    }

    setSending(true);
    try {
      const data: any = sendToAll
        ? { subject: emailSubject, message: emailMessage, send_to_all: true, template_style: generalEmailSettings.templateStyle, visible_fields: generalEmailSettings.visibleFields, see_more_fields: generalEmailSettings.seeMoreFields, default_image: generalEmailSettings.defaultImage, payout_type: generalEmailSettings.payoutType, mask_preview_links: generalEmailSettings.maskPreviewLinks, payment_terms: generalEmailSettings.paymentTerms }
        : { user_ids: Array.from(selectedIds), subject: emailSubject, message: emailMessage, template_style: generalEmailSettings.templateStyle, visible_fields: generalEmailSettings.visibleFields, see_more_fields: generalEmailSettings.seeMoreFields, default_image: generalEmailSettings.defaultImage, payout_type: generalEmailSettings.payoutType, mask_preview_links: generalEmailSettings.maskPreviewLinks, payment_terms: generalEmailSettings.paymentTerms };
      if (parsedCustom.length > 0) data.custom_emails = parsedCustom;
      const res = await searchLogsApi.sendEmail(data);
      toast({ title: 'Emails Sent', description: `${res.sent} sent, ${res.failed} failed` });
      setEmailOpen(false);
      setEmailSubject('');
      setEmailMessage('');
      setCustomEmails('');
      setSendToAll(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const getInventoryBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><CheckCircle className="h-3 w-3 mr-1" />Available</Badge>;
      case 'in_inventory_not_active':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"><AlertTriangle className="h-3 w-3 mr-1" />In Inventory (Not Active)</Badge>;
      case 'not_in_inventory':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"><XCircle className="h-3 w-3 mr-1" />Not in Inventory</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('en-IN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: true,
        timeZone: 'Asia/Kolkata',
      }) + ' IST';
    } catch { return dateStr; }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div></div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (selectedIds.size === 0 && !sendToAll) {
                toast({ title: 'Select users first', description: 'Select users from the table or use "Send to All"', variant: 'destructive' });
                return;
              }
              setEmailOpen(true);
            }}
            disabled={selectedIds.size === 0}
          >
            <Mail className="h-4 w-4 mr-2" />
            Email Selected ({selectedIds.size})
          </Button>
          <Button
            variant="outline"
            onClick={() => { setSendToAll(true); setEmailOpen(true); }}
          >
            <Send className="h-4 w-4 mr-2" />
            Email All
          </Button>
          <Button onClick={() => fetchLogs()} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => window.open('/admin/email-activity?source=search_logs_inventory', '_blank')}>
            <Eye className="h-4 w-4 mr-2" />
            Sent History
          </Button>
        </div>
      </div>

      {/* Stats Cards (collapsible) */}
      <div>
        <Button
          variant="outline"
          size="sm"
          className="w-full flex items-center justify-between"
          onClick={() => setShowStats(!showStats)}
        >
          <span className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Stats Overview
            <Badge variant="secondary" className="ml-1">{stats.total_searches} searches</Badge>
          </span>
          {showStats ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        {showStats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Searches</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{stats.total_searches}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">No Results</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold text-red-500">{stats.no_result_count}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Not in Inventory</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold text-orange-500">{stats.not_in_inventory}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">In Inventory (Not Active)</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold text-yellow-500">{stats.in_inventory_not_active}</div></CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Filters</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-4 w-4 mr-1" />{showFilters ? 'Hide' : 'Show'} Filters
            </Button>
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-3">
              <Input placeholder="Search keyword..." value={keywordFilter} onChange={e => setKeywordFilter(e.target.value)} />
              <Input placeholder="User / Username..." value={userFilter} onChange={e => setUserFilter(e.target.value)} />
              <Select value={noResultFilter} onValueChange={setNoResultFilter}>
                <SelectTrigger><SelectValue placeholder="Results filter" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Results</SelectItem>
                  <SelectItem value="true">No Results Only</SelectItem>
                  <SelectItem value="false">Has Results</SelectItem>
                </SelectContent>
              </Select>
              <Select value={inventoryFilter} onValueChange={setInventoryFilter}>
                <SelectTrigger><SelectValue placeholder="Inventory status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="in_inventory_not_active">In Inventory (Not Active)</SelectItem>
                  <SelectItem value="not_in_inventory">Not in Inventory</SelectItem>
                </SelectContent>
              </Select>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="From date" />
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="To date" />
              <Select value={sentTodayFilter} onValueChange={setSentTodayFilter}>
                <SelectTrigger><SelectValue placeholder="Mail sent today?" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All (Mail filter)</SelectItem>
                  <SelectItem value="yes">Sent Today</SelectItem>
                  <SelectItem value="no">Not Sent Today</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={() => fetchLogs(1)}>Apply Filters</Button>
              <Button size="sm" variant="outline" onClick={() => {
                setKeywordFilter(''); setUserFilter(''); setNoResultFilter(''); setInventoryFilter(''); setDateFrom(''); setDateTo(''); setSentTodayFilter('');
              }}>Clear</Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={logs.length > 0 && selectedIds.size === logs.length}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Keyword</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-center">Results Count</TableHead>
                  <TableHead className="text-center">No Result</TableHead>
                  <TableHead>Inventory Flag</TableHead>
                  <TableHead>Picked Offer</TableHead>
                  <TableHead className="text-center">Preview</TableHead>
                  <TableHead className="text-center">Requested</TableHead>
                  <TableHead className="text-center">Tracking</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-10">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-10 text-muted-foreground">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      No search logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log._id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(log.user_id)}
                          onCheckedChange={() => toggleSelect(log.user_id)}
                          aria-label={`Select ${log.username}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div>{log.username || log.user_id}</div>
                        {(log as any).mail_sent_today > 0 && (
                          <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-semibold text-orange-700 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300 px-1.5 py-0.5 rounded-full">
                            <Mail className="h-2.5 w-2.5" />{(log as any).mail_sent_today} sent today
                          </span>
                        )}
                        {(log as any).mail_total_sent > 0 && (log as any).mail_sent_today === 0 && (
                          <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
                            {(log as any).mail_total_sent} mail(s) total
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm bg-muted px-2 py-1 rounded">{log.keyword}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(log.searched_at)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={log.results_count > 0 ? 'default' : 'destructive'}>
                          {log.results_count}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {log.no_result ? (
                          <XCircle className="h-5 w-5 text-red-500 mx-auto" />
                        ) : (
                          <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell>
                        {getInventoryBadge(log.inventory_status)}
                        <div className="text-xs text-muted-foreground mt-1">
                          <Package className="h-3 w-3 inline mr-1" />
                          Total: {log.total_inventory_count} | Active: {log.active_inventory_count}
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.picked_offer ? (
                          <div>
                            <div className="text-sm font-medium text-blue-700 dark:text-blue-300">
                              {log.picked_offer}
                            </div>
                            {log.picked_offer_id && (
                              <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded mt-0.5 inline-block">
                                ID: {log.picked_offer_id}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Not Picked</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {log.clicked_preview ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200"><Eye className="h-3 w-3 mr-1" />Yes</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">No</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {log.clicked_request ? (
                          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"><FileText className="h-3 w-3 mr-1" />Yes</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">No</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {log.clicked_tracking ? (
                          <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200"><Link className="h-3 w-3 mr-1" />Yes</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">No</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {log.inventory_status === 'in_inventory_not_active' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 text-orange-600 hover:bg-orange-50 border-orange-200"
                            title={`Send inventory offers email to ${log.username}`}
                            onClick={() => openInventoryEmail(log)}
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground"
                            title={`Send email to ${log.username}`}
                            onClick={() => openInventoryEmail(log)}
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.pages} ({pagination.total} total)
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={pagination.page <= 1} onClick={() => fetchLogs(pagination.page - 1)}>
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Button>
                <Button size="sm" variant="outline" disabled={pagination.page >= pagination.pages} onClick={() => fetchLogs(pagination.page + 1)}>
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Dialog */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {sendToAll ? 'Send Email to All Searched Users' : `Send Email to ${selectedIds.size} Selected User(s)`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Subject</label>
              <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Email subject..." />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Message</label>
              <Textarea
                value={emailMessage}
                onChange={e => setEmailMessage(e.target.value)}
                placeholder="Write your message here... Admin can edit this before sending."
                rows={6}
              />
            </div>
            <EmailSettingsPanel settings={generalEmailSettings} onChange={setGeneralEmailSettings} compact />
            <div>
              <label className="text-sm font-medium mb-1 block">Custom Emails (optional)</label>
              <Textarea
                value={customEmails}
                onChange={e => setCustomEmails(e.target.value)}
                placeholder="Add extra emails separated by comma, semicolon, or new line..."
                rows={3}
                className="font-mono text-xs"
              />
              {customEmails.trim() && (
                <p className="text-xs text-muted-foreground mt-1">
                  {customEmails.split(/[,;\n]+/).map(e => e.trim().toLowerCase()).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)).length} valid email(s) detected
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEmailOpen(false); setSendToAll(false); setCustomEmails(''); }}>Cancel</Button>
            <Button onClick={handleSendEmail} disabled={sending}>
              {sending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              {sending ? 'Sending...' : 'Send Email'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inventory Email Dialog - Send related offers to user */}
      <Dialog open={inventoryEmailOpen} onOpenChange={setInventoryEmailOpen}>
        <DialogContent className="max-w-[95vw] w-full max-h-[95vh] h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-orange-500" />
              Send Inventory Offers to {inventoryEmailLog?.username}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="compose" className="w-full">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="compose" className="text-xs gap-1.5"><Send className="h-3 w-3" />Compose Email</TabsTrigger>
              <TabsTrigger value="intelligence" className="text-xs gap-1.5"><User className="h-3 w-3" />Publisher Intelligence</TabsTrigger>
            </TabsList>

            <TabsContent value="compose" className="mt-3">
          <div className="space-y-4">
            <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg text-sm">
              <p className="font-medium text-orange-800 dark:text-orange-200">
                Keyword: "{inventoryEmailLog?.keyword}" — In Inventory but Not Active
              </p>
              <p className="text-orange-600 dark:text-orange-300 text-xs mt-1">
                System found {inventoryEmailLog?.total_inventory_count || 0} total offers, {inventoryEmailLog?.active_inventory_count || 0} active.
                Sending related offers so the publisher can still find value.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Email Subject</label>
              <Input value={inventorySubject} onChange={e => setInventorySubject(e.target.value)} />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Custom Message (optional)</label>
              <Textarea
                value={inventoryMessage}
                onChange={e => setInventoryMessage(e.target.value)}
                placeholder="Add a personal message above the offer cards..."
                rows={3}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Related Offers ({editingOffers.filter(o => o.selected).length} selected)</label>
                <Button size="sm" variant="outline" onClick={() => setEditingOffers(prev => prev.map(o => ({ ...o, selected: !prev.every(p => p.selected) })))}>
                  {editingOffers.every(o => o.selected) ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              {/* Email template settings */}
              <div className="mb-3">
                <EmailSettingsPanel settings={inventoryEmailSettings} onChange={setInventoryEmailSettings} compact />
              </div>

              {relatedLoading ? (
                <div className="text-center py-6">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Loading related offers...
                </div>
              ) : editingOffers.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No related offers found for this keyword.
                </div>
              ) : (
                <>
                  {/* Missing image warning */}
                  {editingOffers.filter(o => o.selected && !o.image_url).length > 0 && (
                    <div className="flex items-start gap-2 p-3 mb-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <span className="text-amber-600 mt-0.5 flex-shrink-0">⚠️</span>
                      <div className="text-sm">
                        <p className="font-medium text-amber-800 dark:text-amber-200">
                          {editingOffers.filter(o => o.selected && !o.image_url).length} offer(s) have no image
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                          You can paste an image URL below for each offer, or they will show a placeholder in the email.
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                  {editingOffers.map((offer, idx) => (
                    <div key={offer.offer_id} className={`border rounded-lg p-3 ${offer.selected ? 'border-orange-300 bg-orange-50/50 dark:bg-orange-950/30' : 'border-gray-200 opacity-60'}`}>
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={offer.selected}
                          onCheckedChange={(checked) => updateEditingOffer(idx, 'selected', !!checked)}
                          className="mt-1"
                        />
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground">{offer.offer_id}</span>
                            <Badge variant="outline" className="text-xs">${offer.payout.toFixed(2)}</Badge>
                            {(relatedOffers.find(r => r.offer_id === offer.offer_id) as any)?.already_sent && <span className="text-[9px] px-1 py-0 rounded-full bg-amber-100 text-amber-700 font-medium">✉ Already sent</span>}
                            {(relatedOffers.find(r => r.offer_id === offer.offer_id) as any)?.visibility === 'active' && <span className="text-[9px] px-1 py-0 rounded-full bg-green-100 text-green-700">🟢 Active</span>}
                            {(relatedOffers.find(r => r.offer_id === offer.offer_id) as any)?.visibility === 'running' && <span className="text-[9px] px-1 py-0 rounded-full bg-emerald-100 text-emerald-700">🏃 Running</span>}
                            {(relatedOffers.find(r => r.offer_id === offer.offer_id) as any)?.visibility === 'rotating' && <span className="text-[9px] px-1 py-0 rounded-full bg-blue-100 text-blue-700">🔄 Rotating</span>}
                            {(relatedOffers.find(r => r.offer_id === offer.offer_id) as any)?.visibility === 'inactive' && <span className="text-[9px] px-1 py-0 rounded-full bg-gray-100 text-gray-600">⚫ Inactive</span>}
                            {((relatedOffers.find(r => r.offer_id === offer.offer_id) as any)?.grant_count || 0) > 0 && <span className="text-[9px] px-1 py-0 rounded-full bg-orange-100 text-orange-700">🎯 {(relatedOffers.find(r => r.offer_id === offer.offer_id) as any)?.grant_count}</span>}
                          </div>
                          <Input
                            value={offer.name}
                            onChange={e => updateEditingOffer(idx, 'name', e.target.value)}
                            className="h-8 text-sm font-medium"
                            placeholder="Offer name"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              value={offer.image_url}
                              onChange={e => updateEditingOffer(idx, 'image_url', e.target.value)}
                              className="h-7 text-xs"
                              placeholder="Image URL"
                            />
                            <Input
                              value={offer.target_url}
                              onChange={e => updateEditingOffer(idx, 'target_url', e.target.value)}
                              className="h-7 text-xs"
                              placeholder="Target URL"
                            />
                          </div>
                          <Button variant="outline" size="sm" className="h-6 px-2 text-[9px] gap-1 text-emerald-600 border-emerald-200 mt-1"
                            onClick={async () => {
                              try {
                                const token = localStorage.getItem('token');
                                const res = await fetch(`${API_BASE_URL}/api/admin/offers/${offer.offer_id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                  body: JSON.stringify({ name: offer.name, image_url: offer.image_url, target_url: offer.target_url, payout: offer.payout }),
                                });
                                if (!res.ok) throw new Error();
                                toast({ title: 'Saved', description: `Offer "${offer.name}" updated permanently` });
                              } catch { toast({ title: 'Error', description: 'Failed to save offer changes', variant: 'destructive' }); }
                            }}>
                            Save to Offer ✓
                          </Button>
                        </div>
                        {offer.image_url ? (
                          <img
                            src={offer.image_url}
                            alt=""
                            className="w-12 h-12 rounded object-cover border"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : null}
                      </div>
                      {/* Action icons — LinkMasker, Image, Description, Vertical */}
                      <OfferActionIcons
                        offerId={offer.offer_id}
                        offerName={offer.name}
                        currentImageUrl={offer.image_url || ''}
                        currentDescription=""
                        currentCategory=""
                        onOfferUpdated={(id, field, value) => {
                          if (field === 'image') updateEditingOffer(idx, 'image_url', value);
                        }}
                      />
                    </div>
                  ))}
                </div>
                </>
              )}
            </div>
          </div>
            </TabsContent>

            <TabsContent value="intelligence" className="mt-3">
              {inventoryEmailLog?.user_id && (
                <PublisherIntelligencePanel userId={inventoryEmailLog.user_id} username={inventoryEmailLog.username} />
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInventoryEmailOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSendInventoryEmail}
              disabled={inventorySending || editingOffers.filter(o => o.selected).length === 0}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {inventorySending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              {inventorySending ? 'Sending...' : `Send ${editingOffers.filter(o => o.selected).length} Offers`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ── SEARCH SESSIONS TAB (Wizard Activity) ──
const SearchSessionsTab: React.FC = () => {
  const [sessions, setSessions] = useState<SearchSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, picked: 0, not_found: 0, placement_intent: 0, abandoned: 0 });
  const [pagination, setPagination] = useState({ page: 1, per_page: 25, total: 0, pages: 0 });
  const [keywordFilter, setKeywordFilter] = useState('');
  const [usernameFilter, setUsernameFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchSessions = async (pg = 1) => {
    setLoading(true);
    try {
      const res = await searchLogsApi.getSearchSessions({
        page: pg, per_page: 25,
        keyword: keywordFilter, username: usernameFilter,
        outcome: outcomeFilter === 'all' ? '' : outcomeFilter,
      });
      setSessions(res.sessions || []);
      setStats(res.stats || { total: 0, picked: 0, not_found: 0, placement_intent: 0, abandoned: 0 });
      setPagination(res.pagination || { page: pg, per_page: 25, total: 0, pages: 0 });
    } catch { /* silent */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchSessions(); }, []);

  const outcomeBadge = (outcome: string) => {
    const map: Record<string, { color: string; label: string }> = {
      picked: { color: 'bg-green-100 text-green-700', label: 'Picked' },
      not_found: { color: 'bg-red-100 text-red-700', label: 'Not Found' },
      placement_intent: { color: 'bg-blue-100 text-blue-700', label: 'Placement Intent' },
      abandoned: { color: 'bg-gray-100 text-gray-600', label: 'Abandoned' },
      active: { color: 'bg-yellow-100 text-yellow-700', label: 'Active' },
    };
    const m = map[outcome] || { color: 'bg-gray-100 text-gray-500', label: outcome };
    return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${m.color}`}>{m.label}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="pt-4 pb-3 text-center"><div className="text-2xl font-bold">{stats.total}</div><p className="text-xs text-muted-foreground">Total Sessions</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 text-center"><div className="text-2xl font-bold text-green-600">{stats.picked}</div><p className="text-xs text-muted-foreground">Picked Offer</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 text-center"><div className="text-2xl font-bold text-red-500">{stats.not_found}</div><p className="text-xs text-muted-foreground">Not Found</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 text-center"><div className="text-2xl font-bold text-blue-600">{stats.placement_intent}</div><p className="text-xs text-muted-foreground">Placement Intent</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 text-center"><div className="text-2xl font-bold text-gray-500">{stats.abandoned}</div><p className="text-xs text-muted-foreground">Abandoned</p></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Input placeholder="Keyword..." value={keywordFilter} onChange={e => setKeywordFilter(e.target.value)} className="w-40 h-8 text-xs" />
        <Input placeholder="Username..." value={usernameFilter} onChange={e => setUsernameFilter(e.target.value)} className="w-40 h-8 text-xs" />
        <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Outcome" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Outcomes</SelectItem>
            <SelectItem value="picked">Picked</SelectItem>
            <SelectItem value="not_found">Not Found</SelectItem>
            <SelectItem value="placement_intent">Placement Intent</SelectItem>
            <SelectItem value="abandoned">Abandoned</SelectItem>
            <SelectItem value="active">Active</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => fetchSessions()} disabled={loading} className="h-8 text-xs">
          {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3 mr-1" />}Search
        </Button>
      </div>

      {/* Sessions Table */}
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs w-[120px]">User</TableHead>
              <TableHead className="text-xs">Keyword</TableHead>
              <TableHead className="text-xs w-[100px]">Vertical</TableHead>
              <TableHead className="text-xs w-[60px]">Geo</TableHead>
              <TableHead className="text-xs w-[70px]">Payout</TableHead>
              <TableHead className="text-xs w-[80px]">Placement</TableHead>
              <TableHead className="text-xs w-[60px]">Results</TableHead>
              <TableHead className="text-xs w-[100px]">Outcome</TableHead>
              <TableHead className="text-xs w-[130px]">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8"><RefreshCw className="h-4 w-4 animate-spin mx-auto" /></TableCell></TableRow>
            ) : sessions.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-sm text-muted-foreground">No search sessions yet</TableCell></TableRow>
            ) : sessions.map(s => (
              <React.Fragment key={s._id}>
                <TableRow
                  className="cursor-pointer hover:bg-muted/30 text-xs"
                  onClick={() => setExpandedId(expandedId === s._id ? null : s._id)}
                >
                  <TableCell className="font-medium">{s.username || s.user_id?.slice(0, 8)}</TableCell>
                  <TableCell className="font-semibold">{s.query}</TableCell>
                  <TableCell>
                    {s.wizard?.vertical ? (
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{s.wizard.vertical}</span>
                    ) : <span className="text-gray-300">—</span>}
                  </TableCell>
                  <TableCell>
                    {s.wizard?.geo ? (
                      <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">{s.wizard.geo}</span>
                    ) : <span className="text-gray-300">—</span>}
                  </TableCell>
                  <TableCell>
                    {s.wizard?.payout ? (
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">${s.wizard.payout}</span>
                    ) : <span className="text-gray-300">—</span>}
                  </TableCell>
                  <TableCell>
                    {s.wizard?.has_placement === true ? (
                      <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                    ) : s.wizard?.has_placement === false ? (
                      <XCircle className="h-3.5 w-3.5 text-gray-400" />
                    ) : <span className="text-gray-300">—</span>}
                  </TableCell>
                  <TableCell className="font-mono">{s.wizard?.result_count ?? s.result_count ?? '—'}</TableCell>
                  <TableCell>{outcomeBadge(s.session_outcome)}</TableCell>
                  <TableCell className="text-[10px] text-muted-foreground">{s.created_at ? new Date(s.created_at).toLocaleString() : '—'}</TableCell>
                </TableRow>
                {expandedId === s._id && (
                  <TableRow>
                    <TableCell colSpan={9} className="bg-muted/20 p-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div><span className="text-muted-foreground">Session ID:</span> <span className="font-mono text-[10px]">{s._id}</span></div>
                        <div><span className="text-muted-foreground">User ID:</span> <span className="font-mono text-[10px]">{s.user_id}</span></div>
                        <div><span className="text-muted-foreground">Inventory:</span> {s.inventory_status}</div>
                        <div><span className="text-muted-foreground">Autocorrected:</span> {s.autocorrected_to || 'No'}</div>
                        {s.wizard?.placement_link && (
                          <div className="col-span-2"><span className="text-muted-foreground">Placement Link:</span> <a href={s.wizard.placement_link} target="_blank" rel="noreferrer" className="text-blue-600 underline">{s.wizard.placement_link}</a></div>
                        )}
                        {s.wizard?.proof_file_ref && (
                          <div className="col-span-4 space-y-2">
                            <span className="text-muted-foreground">Placement Proof:</span>
                            {(() => {
                              const ref = s.wizard.proof_file_ref;
                              // Format: proofId|/uploads/proofs/file1.png,/uploads/proofs/file2.png
                              if (ref.includes('|')) {
                                const [proofId, urls] = ref.split('|');
                                const imageUrls = urls.split(',').filter(Boolean);
                                return (
                                  <div className="flex items-start gap-3 mt-1">
                                    {imageUrls.map((url: string, i: number) => (
                                      <a key={i} href={`${API_BASE_URL}${url}`} target="_blank" rel="noreferrer" className="block">
                                        <img src={`${API_BASE_URL}${url}`} alt={`Proof ${i + 1}`}
                                          className="w-32 h-24 object-cover rounded-lg border border-gray-200 hover:border-purple-400 hover:shadow-md transition-all cursor-pointer" />
                                      </a>
                                    ))}
                                    <span className="text-[10px] text-muted-foreground self-end">ID: {proofId}</span>
                                  </div>
                                );
                              }
                              return <span className="text-green-600 font-medium ml-1">{ref}</span>;
                            })()}
                          </div>
                        )}
                        {s.wizard?.final_pick && (
                          <div><span className="text-muted-foreground">Final Pick:</span> <span className="font-semibold">{s.wizard.final_pick}</span></div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={pagination.page <= 1} onClick={() => fetchSessions(pagination.page - 1)} className="h-7 text-xs">
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <span className="text-xs text-muted-foreground">{pagination.page} / {pagination.pages}</span>
          <Button size="sm" variant="outline" disabled={pagination.page >= pagination.pages} onClick={() => fetchSessions(pagination.page + 1)} className="h-7 text-xs">
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
};

// ── WIZARD SETTINGS TAB ──
const WizardSettingsTab: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SearchWizardSettings>({
    vertical_enabled: true,
    geo_enabled: true,
    payout_enabled: true,
    placement_enabled: true,
  });

  useEffect(() => {
    (async () => {
      try {
        const data = await searchLogsApi.getWizardSettings();
        setSettings(data);
      } catch {
        toast({ title: 'Error', description: 'Failed to load wizard settings', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleToggle = async (field: keyof SearchWizardSettings, value: boolean) => {
    const prev = { ...settings };
    setSettings(s => ({ ...s, [field]: value }));
    setSaving(true);
    try {
      await searchLogsApi.updateWizardSettings({ [field]: value });
      toast({ title: 'Saved', description: `${field.replace('_enabled', '').replace('_', ' ')} step ${value ? 'enabled' : 'disabled'}` });
    } catch {
      setSettings(prev);
      toast({ title: 'Error', description: 'Failed to save setting', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const STEPS = [
    { key: 'vertical_enabled' as const, label: 'Vertical', description: 'Ask publishers which vertical/niche they are looking for', icon: '📊' },
    { key: 'geo_enabled' as const, label: 'Geo', description: 'Ask publishers which country/geo they want to target', icon: '🌍' },
    { key: 'payout_enabled' as const, label: 'Target Payout', description: 'Ask publishers their minimum target payout amount', icon: '💰' },
    { key: 'placement_enabled' as const, label: 'Placement Proof', description: 'Ask publishers if they have a placement and allow proof upload', icon: '📎' },
  ];

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">Loading wizard settings...</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5 text-purple-600" />
            Search Wizard Steps
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Control which questions are shown to publishers when they search for offers. Disabled steps will be skipped automatically.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {STEPS.map(step => (
            <div key={step.key} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{step.icon}</span>
                <div>
                  <Label className="text-sm font-semibold">{step.label}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                </div>
              </div>
              <Switch
                checked={settings[step.key]}
                onCheckedChange={(val) => handleToggle(step.key, val)}
                disabled={saving}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> When all steps are disabled, publishers will see search results directly without any wizard questions.
            Changes take effect immediately for all publishers.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

const AdminSearchLogs: React.FC = () => (
  <AdminPageGuard requiredTab="search-logs">
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-3xl font-bold">Search Logs</h1>
        <p className="text-muted-foreground">Track what publishers are searching for in offers</p>
      </div>
      <Tabs defaultValue="logs" className="w-full">
        <TabsList>
          <TabsTrigger value="logs" className="text-xs gap-1.5"><Search className="h-3 w-3" />Search Logs</TabsTrigger>
          <TabsTrigger value="sessions" className="text-xs gap-1.5"><FileText className="h-3 w-3" />Wizard Sessions</TabsTrigger>
          <TabsTrigger value="wizard-settings" className="text-xs gap-1.5"><Settings className="h-3 w-3" />Wizard Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="logs" className="mt-4">
          <AdminSearchLogsContent />
        </TabsContent>
        <TabsContent value="sessions" className="mt-4">
          <SearchSessionsTab />
        </TabsContent>
        <TabsContent value="wizard-settings" className="mt-4">
          <WizardSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  </AdminPageGuard>
);

export default AdminSearchLogs;
