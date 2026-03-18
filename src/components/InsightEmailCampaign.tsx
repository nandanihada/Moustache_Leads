/**
 * InsightEmailCampaign — Reusable email campaign component for Offer Insights cards.
 * Features: custom subject, content, template preview, batch config, scheduling,
 * partner selection with search, and all activity logged to Email Activity tab.
 * 
 * Import this into any insight card to add email functionality.
 */
import { useState, useEffect } from 'react';
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
  Mail, Send, Eye, Users, Search, RefreshCw, Clock, Settings2, Paperclip
} from 'lucide-react';
import { offerInsightsApi, Partner } from '@/services/offerInsightsApi';

interface InsightEmailCampaignProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceCard: string; // e.g. 'offer_view_logs', 'highest_clicks', etc.
  offerIds?: string[];
  offerNames?: string[];
  defaultSubject?: string;
  defaultContent?: string;
  onSent?: () => void; // callback after successful send
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
  const [batchSize, setBatchSize] = useState(50);

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

  // Reset fields when modal opens
  useEffect(() => {
    if (open) {
      setSubject(defaultSubject);
      setContent(defaultContent);
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
        batch_size: batchSize,
        scheduled_at: scheduleEnabled ? `${scheduleDate}T${scheduleTime}` : undefined,
        source_card: sourceCard,
        offer_ids: offerIds,
        offer_names: offerNames,
      });

      if (res.scheduled) {
        toast({ title: 'Scheduled', description: `Campaign scheduled for ${new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString()}` });
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

          <div className="space-y-5">
            {/* Subject */}
            <div className="space-y-2">
              <Label>Subject *</Label>
              <Input
                placeholder="Enter email subject..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
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

            {/* Batch & Schedule Row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Batch Size */}
              <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                <Label className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" /> Batch Size
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value) || 50)}
                />
                <p className="text-xs text-muted-foreground">Recipients per batch (max 200)</p>
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
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>This is how the email will look to recipients</DialogDescription>
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
