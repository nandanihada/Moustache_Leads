/**
 * InsightEmailCampaign — Reusable email campaign component for Offer Insights cards.
 * Features: custom subject, content, batch splitting by count, batch interval,
 * scheduling, partner selection with search, and all activity logged to Email Activity tab.
 *
 * Batch logic: Admin selects N logs, chooses number of batches → logs are split evenly.
 * Each batch becomes one email. Batches are sent with a configurable interval between them.
 */
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  Mail, Send, Eye, Users, Search, RefreshCw, Clock, Settings2, Layers, Timer, User
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { offerInsightsApi, Partner } from '@/services/offerInsightsApi';
import EmailSettingsPanel, { DEFAULT_EMAIL_SETTINGS, type EmailSettings } from '@/components/EmailSettingsPanel';
import PublisherIntelligencePanel from '@/components/PublisherIntelligencePanel';

interface InsightEmailCampaignProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceCard: string;
  offerIds?: string[];
  offerNames?: string[];
  defaultSubject?: string;
  defaultContent?: string;
  onSent?: () => void;
}

const InsightEmailCampaign = ({
  open,
  onOpenChange,
  sourceCard,
  offerIds = [],
  offerNames = [],
  defaultSubject = '',
  defaultContent = '',
  onSent,
}: InsightEmailCampaignProps) => {
  const { toast } = useToast();

  // Email fields
  const [subject, setSubject] = useState(defaultSubject);
  const [content, setContent] = useState(defaultContent);
  const [emailSettings, setEmailSettings] = useState<EmailSettings>(DEFAULT_EMAIL_SETTINGS);

  // Batch config
  const [numBatches, setNumBatches] = useState(1);
  const [batchInterval, setBatchInterval] = useState(2); // minutes between batches

  // Schedule
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  // Partners
  const [partners, setPartners] = useState<Partner[]>([]);
  const [selectedPartners, setSelectedPartners] = useState<Set<string>>(new Set());
  const [partnerSearch, setPartnerSearch] = useState('');
  const [partnersLoading, setPartnersLoading] = useState(false);

  // Preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  // Custom emails
  const [customEmails, setCustomEmails] = useState('');

  // Sending
  const [sending, setSending] = useState(false);

  // Calculate batch info
  const totalOffers = offerNames.length;
  const effectiveBatches = Math.min(numBatches, Math.max(totalOffers, 1));
  const offersPerBatch = totalOffers > 0 ? Math.ceil(totalOffers / effectiveBatches) : 0;

  // Preview batch (first batch)
  const previewBatchOffers = useMemo(() => {
    if (totalOffers === 0) return [];
    return offerNames.slice(0, offersPerBatch);
  }, [offerNames, offersPerBatch, totalOffers]);

  const previewBatchIds = useMemo(() => {
    if (offerIds.length === 0) return [];
    return offerIds.slice(0, offersPerBatch);
  }, [offerIds, offersPerBatch]);

  // Reset fields when modal opens
  useEffect(() => {
    if (open) {
      setSubject(defaultSubject);
      setContent(defaultContent);
      setNumBatches(1);
      setBatchInterval(2);
      setScheduleEnabled(false);
      setScheduleDate('');
      setScheduleTime('');
      setSelectedPartners(new Set());
      setCustomEmails('');
      fetchPartners();
    }
  }, [open]);

  const fetchPartners = async () => {
    setPartnersLoading(true);
    try {
      const res = await offerInsightsApi.getPartners(partnerSearch);
      setPartners(res.partners || []);
    } catch {
      // silent
    } finally {
      setPartnersLoading(false);
    }
  };

  const togglePartner = (id: string) => {
    const s = new Set(selectedPartners);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelectedPartners(s);
  };

  const selectAll = () => {
    if (selectedPartners.size === partners.length) {
      setSelectedPartners(new Set());
    } else {
      setSelectedPartners(new Set(partners.map(p => p._id)));
    }
  };

  const handlePreview = async () => {
    if (!subject.trim() || !content.trim()) {
      toast({ title: 'Error', description: 'Subject and content are required', variant: 'destructive' });
      return;
    }
    try {
      const res = await offerInsightsApi.previewCustomEmail(subject, content);
      setPreviewHtml(res.html);
      setPreviewOpen(true);
    } catch {
      toast({ title: 'Error', description: 'Failed to preview email', variant: 'destructive' });
    }
  };

  const getCustomEmailList = (): string[] => {
    return customEmails
      .split(/[,;\n]+/)
      .map(e => e.trim().toLowerCase())
      .filter(e => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  };

  const totalRecipients = selectedPartners.size + getCustomEmailList().length;

  const handleSend = async () => {
    if (!subject.trim() || !content.trim()) {
      toast({ title: 'Error', description: 'Subject and content are required', variant: 'destructive' });
      return;
    }
    if (totalRecipients === 0) {
      toast({ title: 'Error', description: 'Select at least one partner or enter a custom email', variant: 'destructive' });
      return;
    }
    if (scheduleEnabled && (!scheduleDate || !scheduleTime)) {
      toast({ title: 'Error', description: 'Select date and time for scheduling', variant: 'destructive' });
      return;
    }
    if (scheduleEnabled && new Date(`${scheduleDate}T${scheduleTime}`) <= new Date()) {
      toast({ title: 'Error', description: 'Scheduled time must be in the future', variant: 'destructive' });
      return;
    }

    setSending(true);
    try {
      const res = await offerInsightsApi.sendCustomEmailCampaign({
        subject,
        content,
        partner_ids: Array.from(selectedPartners),
        custom_emails: getCustomEmailList(),
        num_batches: effectiveBatches,
        batch_interval_minutes: batchInterval,
        scheduled_at: scheduleEnabled ? new Date(`${scheduleDate}T${scheduleTime}`).toISOString() : undefined,
        source_card: sourceCard,
        offer_ids: offerIds,
        offer_names: offerNames,
        template_style: emailSettings.templateStyle,
        visible_fields: emailSettings.visibleFields,
        default_image: emailSettings.defaultImage,
        payout_type: emailSettings.payoutType,
      });

      if (res.scheduled) {
        toast({ title: 'Scheduled', description: `${effectiveBatches} batch(es) scheduled starting ${new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString()}, ${batchInterval} min interval` });
      } else {
        toast({ title: 'Sent', description: `${res.sent_count} sent, ${res.failed_count} failed across ${res.batch_count} batch(es)` });
      }
      onOpenChange(false);
      onSent?.();
    } catch {
      toast({ title: 'Error', description: 'Failed to send campaign', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" /> Send Email Campaign
            </DialogTitle>
            <DialogDescription>
              Compose and send a custom email to selected partners. All activity is logged.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="compose" className="w-full">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="compose" className="text-xs gap-1.5"><Send className="h-3 w-3" />Compose & Send</TabsTrigger>
              <TabsTrigger value="intelligence" className="text-xs gap-1.5" disabled={selectedPartners.size !== 1}><User className="h-3 w-3" />Publisher Intelligence {selectedPartners.size === 1 ? '' : '(select 1)'}</TabsTrigger>
            </TabsList>

            <TabsContent value="compose" className="mt-3">
          <div className="space-y-5">
            {/* Subject */}
            <div className="space-y-2">
              <Label>Subject *</Label>
              <Input
                placeholder="Enter email subject..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">This subject will be used for all batches</p>
            </div>

            {/* Content */}
            <div className="space-y-2">
              <Label>Content *</Label>
              <Textarea
                placeholder="Write your email content here... (supports plain text, newlines will be preserved)"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
              />
            </div>

            {/* Email Template Settings */}
            <EmailSettingsPanel settings={emailSettings} onChange={setEmailSettings} compact />

            {/* Batch & Schedule Row */}
            <div className="grid grid-cols-3 gap-4">
              {/* Number of Batches */}
              <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                <Label className="flex items-center gap-2">
                  <Layers className="h-4 w-4" /> Batches
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={Math.max(totalOffers, 1)}
                  value={numBatches}
                  onChange={(e) => setNumBatches(Math.max(1, Number(e.target.value) || 1))}
                />
                {totalOffers > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {effectiveBatches} batch(es) × {offersPerBatch} offer(s) each
                  </p>
                )}
              </div>

              {/* Batch Interval */}
              <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                <Label className="flex items-center gap-2">
                  <Timer className="h-4 w-4" /> Interval (min)
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={batchInterval}
                  onChange={(e) => setBatchInterval(Math.max(1, Number(e.target.value) || 2))}
                />
                <p className="text-xs text-muted-foreground">
                  Minutes between each batch
                </p>
              </div>

              {/* Schedule */}
              <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Schedule
                  </Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="campaign-schedule"
                      checked={scheduleEnabled}
                      onCheckedChange={(c) => setScheduleEnabled(c as boolean)}
                    />
                    <label htmlFor="campaign-schedule" className="text-sm cursor-pointer">Later</label>
                  </div>
                </div>
                {scheduleEnabled && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
                    <Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
                  </div>
                )}
              </div>
            </div>

            {/* Batch Preview Info */}
            {totalOffers > 1 && effectiveBatches > 1 && (
              <div className="p-3 border rounded-lg bg-blue-50 dark:bg-blue-950/30 text-sm space-y-1">
                <p className="font-medium text-blue-700 dark:text-blue-300 flex items-center gap-2">
                  <Layers className="h-4 w-4" /> Batch Preview
                </p>
                <p className="text-blue-600 dark:text-blue-400">
                  {totalOffers} offers will be split into {effectiveBatches} batches ({offersPerBatch} offers per email).
                  {scheduleEnabled
                    ? ` First batch at scheduled time, then every ${batchInterval} min.`
                    : ` Sent with ${batchInterval} min interval between batches.`
                  }
                </p>
                <p className="text-blue-500 dark:text-blue-500 text-xs">
                  Preview shows Batch 1: {previewBatchOffers.join(', ')}
                </p>
              </div>
            )}

            {/* Custom Emails */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mail className="h-4 w-4" /> Custom Emails
                {getCustomEmailList().length > 0 && (
                  <Badge variant="secondary" className="text-xs">{getCustomEmailList().length} email(s)</Badge>
                )}
              </Label>
              <Textarea
                placeholder="Enter email addresses separated by commas, semicolons, or new lines&#10;e.g. john@example.com, jane@example.com"
                value={customEmails}
                onChange={(e) => setCustomEmails(e.target.value)}
                rows={2}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Add any email addresses here — they don't need to be registered partners
              </p>
            </div>

            {/* Partner Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" /> Select Partners ({selectedPartners.size} selected)
                </Label>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search partners..."
                      value={partnerSearch}
                      onChange={(e) => setPartnerSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchPartners()}
                      className="pl-9 w-56"
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    {selectedPartners.size === partners.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg max-h-56 overflow-y-auto">
                {partnersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin" />
                  </div>
                ) : partners.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No partners found</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {partners.map((p) => (
                        <TableRow
                          key={p._id}
                          className={`cursor-pointer ${selectedPartners.has(p._id) ? 'bg-primary/5' : ''}`}
                          onClick={() => togglePartner(p._id)}
                        >
                          <TableCell>
                            <Checkbox checked={selectedPartners.has(p._id)} onCheckedChange={() => togglePartner(p._id)} />
                          </TableCell>
                          <TableCell className="font-medium">{p.username}</TableCell>
                          <TableCell>{p.email}</TableCell>
                          <TableCell>
                            <Badge variant={p.is_active ? 'default' : 'secondary'}>
                              {p.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
            </div>
            </TabsContent>

            <TabsContent value="intelligence" className="mt-3">
              {selectedPartners.size === 1 && (
                <PublisherIntelligencePanel userId={Array.from(selectedPartners)[0]} />
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button variant="outline" onClick={handlePreview}>
              <Eye className="h-4 w-4 mr-2" /> Preview
            </Button>
            <Button onClick={handleSend} disabled={sending || totalRecipients === 0}>
              {sending ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />{scheduleEnabled ? 'Scheduling...' : 'Sending...'}</>
              ) : scheduleEnabled ? (
                <><Clock className="h-4 w-4 mr-2" />Schedule ({totalRecipients})</>
              ) : (
                <><Send className="h-4 w-4 mr-2" />Send to {totalRecipients}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Email Preview {effectiveBatches > 1 ? '(Batch 1)' : ''}</DialogTitle>
            <DialogDescription>
              This is how the email will look to recipients
              {effectiveBatches > 1 && ` — showing first batch (${offersPerBatch} offers). All ${effectiveBatches} batches use the same subject.`}
            </DialogDescription>
          </DialogHeader>
          <div className="border rounded-lg overflow-hidden bg-gray-100 p-4">
            <div className="bg-white rounded shadow-lg" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
          <DialogFooter>
            <Button onClick={() => setPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InsightEmailCampaign;
