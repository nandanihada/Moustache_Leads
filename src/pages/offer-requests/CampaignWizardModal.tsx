import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Loader2, Send, Calendar, ChevronRight, ChevronLeft, Eye,
  Zap, Users, Settings, Mail, Clock, Sparkles, X,
  Image, FileText, Tag, ExternalLink, AlertTriangle, Brain,
  MousePointerClick, TrendingUp,
} from 'lucide-react';
import { API_BASE_URL } from '@/services/apiConfig';
import EmailSettingsPanel, { DEFAULT_EMAIL_SETTINGS, type EmailSettings } from '@/components/EmailSettingsPanel';
import OfferActionIcons from '@/components/OfferActionIcons';
import PublisherIntelligencePanel from '@/components/PublisherIntelligencePanel';
import type { PProf } from '@/pages/AdminOfferAccessRequests';

interface CampaignWizardModalProps {
  open: boolean;
  onClose: () => void;
  selectedUsers: PProf[];
  sourceTab: string;
  onSuccess?: () => void;
}

interface PreviewEmail {
  email_number: number;
  offers: Array<{
    offer_id: string;
    name: string;
    payout: number;
    network: string;
    category?: string;
    countries?: string[];
    description?: string;
    image_url?: string;
    thumbnail_url?: string;
    preview_url?: string;
    target_url?: string;
    tracking_url?: string;
    vertical?: string;
  }>;
}

interface UserPreviewStats {
  total_mail_sent: number;
  mail_sent_today: number;
  last_mail_sent: string | null;
  total_offers_sent: number;
  offers_sent_today: number;
  total_clicks: number;
  total_conversions: number;
}

interface UserPreview {
  user_id: string;
  username: string;
  email: string;
  first_name?: string;
  total_offers: number;
  emails: PreviewEmail[];
  stats?: UserPreviewStats;
}

const STEPS = ['Settings', 'Template', 'Preview', 'Schedule'];

export default function CampaignWizardModal({ open, onClose, selectedUsers, sourceTab, onSuccess }: CampaignWizardModalProps) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Step 1: Campaign Settings
  const [batchName, setBatchName] = useState('');
  const [totalOffersPerUser, setTotalOffersPerUser] = useState(3);
  const [offersPerEmail, setOffersPerEmail] = useState(1);
  const [pricePercentage, setPricePercentage] = useState(80);
  const [cooldownDays, setCooldownDays] = useState(1);

  // Step 2: Email Template
  const [subject, setSubject] = useState('🚀 Hot Offers You Should Check Out!');
  const [messageBody, setMessageBody] = useState('Hi there! We have handpicked some exclusive offers based on your interests. These are high-converting campaigns that match your traffic profile. Check them out below and start earning today!');
  const [emailSettings, setEmailSettings] = useState<EmailSettings>(DEFAULT_EMAIL_SETTINGS);

  // Step 3: Preview
  const [preview, setPreview] = useState<UserPreview[]>([]);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // Step 4: Schedule
  const [sendType, setSendType] = useState<'send_now' | 'schedule'>('send_now');
  const [scheduledAt, setScheduledAt] = useState('');

  const token = localStorage.getItem('token');

  // ── RESET all state when modal opens ──
  useEffect(() => {
    if (open) {
      // Reset to step 1
      setStep(0);
      setLoading(false);
      setCreating(false);
      
      // Reset settings
      const now = new Date();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      setBatchName(`${monthNames[now.getMonth()]} ${now.getDate()} — ${sourceTab} (${selectedUsers.length} users)`);
      setTotalOffersPerUser(3);
      setOffersPerEmail(1);
      setPricePercentage(80);
      setCooldownDays(1);
      
      // Reset template
      setSubject('🚀 Hot Offers You Should Check Out!');
      setMessageBody('Hi there! We have handpicked some exclusive offers based on your interests. These are high-converting campaigns that match your traffic profile. Check them out below and start earning today!');
      setEmailSettings(DEFAULT_EMAIL_SETTINGS);
      
      // Reset preview
      setPreview([]);
      setExpandedUser(null);
      
      // Reset schedule
      setSendType('send_now');
      setScheduledAt('');
    }
  }, [open, selectedUsers, sourceTab]);

  // Calculate email count
  const emailsPerUser = Math.ceil(totalOffersPerUser / Math.max(1, offersPerEmail));
  const totalEmails = emailsPerUser * selectedUsers.length;

  // Load preview when reaching step 3
  useEffect(() => {
    if (step === 2 && preview.length === 0) {
      loadPreview();
    }
  }, [step]);

  const loadPreview = async () => {
    setLoading(true);
    try {
      // Build user_offer_names map: { user_id: latest_offer_name }
      // This tells the backend which offer each user requested, so it can find related offers
      const userOfferNames: Record<string, string> = {};
      selectedUsers.forEach(u => {
        if (u.latest_offer_name) {
          userOfferNames[u.user_id] = u.latest_offer_name;
        }
      });

      const res = await fetch(`${API_BASE_URL}/api/admin/email-campaigns/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          user_ids: selectedUsers.map(u => u.user_id),
          total_offers_per_user: totalOffersPerUser,
          offers_per_email: offersPerEmail,
          source_tab: sourceTab,
          price_percentage: pricePercentage,
          user_offer_names: userOfferNames,
        }),
      });
      const data = await res.json();
      if (data.preview) {
        setPreview(data.preview);
      }
    } catch {
      toast.error('Failed to load preview');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      // Build custom_offers from the preview data — send EXACTLY what was shown in preview
      // This ensures the email contains the same offers the admin saw and approved
      const customOffers: Record<string, string[]> = {};
      for (const user of preview) {
        const offerIds: string[] = [];
        for (const emailBatch of (user.emails || [])) {
          for (const offer of (emailBatch.offers || [])) {
            if (offer.offer_id) {
              offerIds.push(offer.offer_id);
            }
          }
        }
        if (offerIds.length > 0) {
          customOffers[user.user_id] = offerIds;
        }
      }

      const res = await fetch(`${API_BASE_URL}/api/admin/email-campaigns/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          user_ids: selectedUsers.map(u => u.user_id),
          batch_name: batchName,
          total_offers_per_user: totalOffersPerUser,
          offers_per_email: offersPerEmail,
          price_percentage: pricePercentage,
          cooldown_days: cooldownDays,
          source_tab: sourceTab,
          subject,
          message_body: messageBody,
          email_settings: emailSettings,
          send_type: sendType,
          scheduled_at: sendType === 'schedule' ? scheduledAt : null,
          interval_hours: cooldownDays * 24,
          custom_offers: customOffers,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Campaign created successfully!');
        onSuccess?.();
        onClose();
      } else {
        toast.error(data.error || 'Failed to create campaign');
      }
    } catch {
      toast.error('Failed to create campaign');
    } finally {
      setCreating(false);
    }
  };

  const canProceed = () => {
    if (step === 0) return batchName.trim().length > 0 && totalOffersPerUser > 0 && offersPerEmail > 0;
    if (step === 1) return subject.trim().length > 0;
    if (step === 2) return preview.length > 0;
    if (step === 3) return sendType === 'send_now' || (sendType === 'schedule' && scheduledAt);
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-500" />
              Smart Email Campaign
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {selectedUsers.length} users selected from "{sourceTab}" tab
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-1 px-6 py-3 border-b bg-muted/30">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <button
                onClick={() => i < step && setStep(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  i === step ? 'bg-orange-500 text-white' :
                  i < step ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 cursor-pointer hover:bg-orange-200' :
                  'bg-muted text-muted-foreground'
                }`}
              >
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold border border-current/30">
                  {i + 1}
                </span>
                {s}
              </button>
              {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === 0 && (
            <StepSettings
              batchName={batchName}
              setBatchName={setBatchName}
              totalOffersPerUser={totalOffersPerUser}
              setTotalOffersPerUser={setTotalOffersPerUser}
              offersPerEmail={offersPerEmail}
              setOffersPerEmail={setOffersPerEmail}
              pricePercentage={pricePercentage}
              setPricePercentage={setPricePercentage}
              cooldownDays={cooldownDays}
              setCooldownDays={setCooldownDays}
              emailsPerUser={emailsPerUser}
              totalEmails={totalEmails}
              selectedUsers={selectedUsers}
            />
          )}
          {step === 1 && (
            <StepTemplate
              subject={subject}
              setSubject={setSubject}
              messageBody={messageBody}
              setMessageBody={setMessageBody}
              emailSettings={emailSettings}
              setEmailSettings={setEmailSettings}
            />
          )}
          {step === 2 && (
            <StepPreview
              loading={loading}
              preview={preview}
              expandedUser={expandedUser}
              setExpandedUser={setExpandedUser}
              pricePercentage={pricePercentage}
              onRefresh={loadPreview}
            />
          )}
          {step === 3 && (
            <StepSchedule
              sendType={sendType}
              setSendType={setSendType}
              scheduledAt={scheduledAt}
              setScheduledAt={setScheduledAt}
              totalEmails={totalEmails}
              emailsPerUser={emailsPerUser}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/20">
          <div className="text-xs text-muted-foreground">
            {selectedUsers.length} users • {totalEmails} emails • {totalOffersPerUser} offers/user • {pricePercentage}% price
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleCreate}
                disabled={creating || !canProceed()}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {creating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                {sendType === 'schedule' ? 'Schedule Campaign' : 'Launch Campaign'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Step 1: Settings ─────────────────────────────────────────────────────────

function StepSettings({
  batchName, setBatchName, totalOffersPerUser, setTotalOffersPerUser,
  offersPerEmail, setOffersPerEmail, pricePercentage, setPricePercentage,
  cooldownDays, setCooldownDays, emailsPerUser, totalEmails, selectedUsers,
}: any) {
  return (
    <div className="space-y-6">
      {/* Batch Name */}
      <div className="space-y-2">
        <Label className="font-semibold">Campaign Name</Label>
        <Input
          value={batchName}
          onChange={e => setBatchName(e.target.value)}
          placeholder="e.g., May Week 1 — India Push"
          className="max-w-md"
        />
        <p className="text-xs text-muted-foreground">Name this batch for easy tracking in the queue</p>
      </div>

      {/* Offers Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label className="font-semibold">Total Offers per User</Label>
          <Input
            type="number"
            min={1}
            max={50}
            value={totalOffersPerUser}
            onChange={e => setTotalOffersPerUser(Math.max(1, parseInt(e.target.value) || 1))}
            className="max-w-32"
          />
          <p className="text-xs text-muted-foreground">How many total offers each user will receive across all emails</p>
        </div>

        <div className="space-y-2">
          <Label className="font-semibold">Offers per Email</Label>
          <Input
            type="number"
            min={1}
            max={20}
            value={offersPerEmail}
            onChange={e => setOffersPerEmail(Math.max(1, parseInt(e.target.value) || 1))}
            className="max-w-32"
          />
          <p className="text-xs text-muted-foreground">How many offers in each individual email</p>
        </div>
      </div>

      {/* Summary Box */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="font-medium">{selectedUsers.length}</span> users
          </div>
          <div className="flex items-center gap-1.5">
            <Mail className="w-4 h-4 text-blue-500" />
            <span className="font-medium">{emailsPerUser}</span> emails/user
          </div>
          <div className="flex items-center gap-1.5">
            <Send className="w-4 h-4 text-blue-500" />
            <span className="font-medium">{totalEmails}</span> total emails
          </div>
        </div>
      </div>

      {/* Price Slider */}
      <div className="space-y-3">
        <Label className="font-semibold">Price Adjustment (% of Admin Price)</Label>
        <div className="flex items-center gap-4">
          <div className="flex-1 max-w-md">
            <Slider
              value={[pricePercentage]}
              onValueChange={([v]) => setPricePercentage(v)}
              min={30}
              max={150}
              step={5}
              className="w-full"
            />
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={30}
              max={150}
              value={pricePercentage}
              onChange={e => setPricePercentage(Math.max(30, Math.min(150, parseInt(e.target.value) || 80)))}
              className="w-20 text-center"
            />
            <span className="text-sm font-medium">%</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Example: Admin price $10.00 → Shown as <strong className="text-foreground">${(10 * pricePercentage / 100).toFixed(2)}</strong></span>
          {pricePercentage < 100 && <Badge variant="secondary" className="text-[10px]">Decreased</Badge>}
          {pricePercentage > 100 && <Badge variant="default" className="text-[10px]">Increased</Badge>}
          {pricePercentage === 100 && <Badge variant="outline" className="text-[10px]">Admin Price</Badge>}
        </div>
      </div>

      {/* Cooldown */}
      <div className="space-y-2">
        <Label className="font-semibold">Minimum Gap Between Emails (to same user)</Label>
        <Select value={String(cooldownDays)} onValueChange={v => setCooldownDays(parseFloat(v))}>
          <SelectTrigger className="max-w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">No gap (send all at once)</SelectItem>
            <SelectItem value="0.000694">1 minute (testing)</SelectItem>
            <SelectItem value="0.00347">5 minutes (testing)</SelectItem>
            <SelectItem value="0.00694">10 minutes</SelectItem>
            <SelectItem value="0.0208">30 minutes</SelectItem>
            <SelectItem value="0.0417">1 hour</SelectItem>
            <SelectItem value="0.0833">2 hours</SelectItem>
            <SelectItem value="0.125">3 hours</SelectItem>
            <SelectItem value="0.25">6 hours</SelectItem>
            <SelectItem value="0.5">12 hours</SelectItem>
            <SelectItem value="1">1 day</SelectItem>
            <SelectItem value="2">2 days</SelectItem>
            <SelectItem value="3">3 days</SelectItem>
            <SelectItem value="7">7 days</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Time gap between each email to the same user. If user gets 3 emails and gap is 5 min: Email 1 → wait 5 min → Email 2 → wait 5 min → Email 3
        </p>
      </div>
    </div>
  );
}

// ─── Step 2: Template ─────────────────────────────────────────────────────────

function StepTemplate({ subject, setSubject, messageBody, setMessageBody, emailSettings, setEmailSettings }: any) {
  return (
    <div className="space-y-6">
      {/* Subject */}
      <div className="space-y-2">
        <Label className="font-semibold">Email Subject</Label>
        <Input
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="🚀 Hot Offers You Should Check Out!"
        />
        <p className="text-xs text-muted-foreground">
          Variables: {'{username}'}, {'{first_name}'}, {'{offer_count}'}
        </p>
      </div>

      {/* Message Body */}
      <div className="space-y-2">
        <Label className="font-semibold">Email Message (editable content above offers)</Label>
        <Textarea
          value={messageBody}
          onChange={e => setMessageBody(e.target.value)}
          placeholder="Hi there! We've found some great offers that match your interests..."
          rows={4}
        />
        <p className="text-xs text-muted-foreground">
          This message appears above the offer cards/table in the email. Leave empty for default greeting.
        </p>
      </div>

      {/* Email Template Settings */}
      <div className="border rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Settings className="w-4 h-4" /> Template Settings
        </h3>
        <EmailSettingsPanel settings={emailSettings} onChange={setEmailSettings} />
      </div>
    </div>
  );
}

// ─── Step 3: Preview ──────────────────────────────────────────────────────────

function StepPreview({ loading, preview, expandedUser, setExpandedUser, pricePercentage, onRefresh }: any) {
  const [intelligenceUserId, setIntelligenceUserId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
        <span className="ml-2 text-sm text-muted-foreground">Matching offers to users...</span>
      </div>
    );
  }

  const timeAgo = (dateStr: string | null): string => {
    if (!dateStr) return 'Never';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Campaign Preview</h3>
          <p className="text-xs text-muted-foreground">Review which offers will be sent to each user. Use action icons to edit image, description, vertical, or mask links.</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <Zap className="w-3 h-3 mr-1" /> Refresh Matches
        </Button>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {preview.map((user: UserPreview) => (
          <div key={user.user_id} className="border rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedUser(expandedUser === user.user_id ? null : user.user_id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-xs font-bold text-orange-600">
                  {user.username?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <span className="font-medium text-sm">{user.username}</span>
                  <span className="text-xs text-muted-foreground ml-2">{user.email}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">
                  {user.total_offers} offers • {user.emails?.length || 0} emails
                </Badge>
                <ChevronRight className={`w-4 h-4 transition-transform ${expandedUser === user.user_id ? 'rotate-90' : ''}`} />
              </div>
            </button>

            {expandedUser === user.user_id && (
              <div className="px-4 pb-3 space-y-3 border-t bg-muted/20">
                {/* User Stats Row */}
                {user.stats && (
                  <div className="flex flex-wrap items-center gap-3 pt-2 pb-1 border-b border-dashed">
                    <div className="flex items-center gap-1 text-[10px]">
                      <Mail className="w-3 h-3 text-violet-500" />
                      <span className="text-muted-foreground">Mails:</span>
                      <span className="font-semibold">{user.stats.total_mail_sent}</span>
                      {user.stats.mail_sent_today > 0 && <span className="text-green-600">(+{user.stats.mail_sent_today} today)</span>}
                    </div>
                    <div className="flex items-center gap-1 text-[10px]">
                      <Clock className="w-3 h-3 text-blue-500" />
                      <span className="text-muted-foreground">Last:</span>
                      <span className="font-semibold">{timeAgo(user.stats.last_mail_sent)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px]">
                      <Send className="w-3 h-3 text-orange-500" />
                      <span className="text-muted-foreground">Offers Sent:</span>
                      <span className="font-semibold">{user.stats.total_offers_sent}</span>
                      {user.stats.offers_sent_today > 0 && <span className="text-green-600">(+{user.stats.offers_sent_today} today)</span>}
                    </div>
                    <div className="flex items-center gap-1 text-[10px]">
                      <MousePointerClick className="w-3 h-3 text-cyan-500" />
                      <span className="text-muted-foreground">Clicks:</span>
                      <span className="font-semibold">{user.stats.total_clicks}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px]">
                      <TrendingUp className="w-3 h-3 text-green-500" />
                      <span className="text-muted-foreground">Conversions:</span>
                      <span className="font-semibold">{user.stats.total_conversions}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-5 px-2 text-[10px] gap-1 ml-auto"
                      onClick={(e) => { e.stopPropagation(); setIntelligenceUserId(user.user_id); }}
                    >
                      <Brain className="w-3 h-3" /> Publisher Intelligence
                    </Button>
                  </div>
                )}

                {user.emails?.map((emailBatch: PreviewEmail) => (
                  <div key={emailBatch.email_number} className="mt-2">
                    <div className="text-xs font-medium text-muted-foreground mb-1">
                      Email #{emailBatch.email_number}
                    </div>
                    <div className="space-y-1.5">
                      {emailBatch.offers?.map((offer: any) => {
                        const hasImage = !!(offer.image_url || offer.thumbnail_url);
                        const hasDescription = !!(offer.description && offer.description.trim());
                        const hasVertical = !!(offer.category || offer.vertical);
                        const hasTargetUrl = !!(offer.target_url || offer.tracking_url);
                        const hasPreviewUrl = !!offer.preview_url;

                        return (
                          <div key={offer.offer_id} className="bg-background rounded-lg px-3 py-2 text-xs border space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {hasImage && (
                                  <img src={offer.image_url || offer.thumbnail_url} alt="" className="w-8 h-8 rounded object-cover" />
                                )}
                                <div className="min-w-0">
                                  <span className="font-medium truncate block">{offer.name}</span>
                                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                    <span>{offer.network}</span>
                                    {offer.category && <><span>•</span><span>{offer.category}</span></>}
                                    {offer.countries && offer.countries.length > 0 && (
                                      <><span>•</span><span>{offer.countries.slice(0, 3).join(', ')}{offer.countries.length > 3 ? ` +${offer.countries.length - 3}` : ''}</span></>
                                    )}
                                  </div>
                                  {hasDescription && (
                                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{offer.description}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-2">
                                <OfferActionIcons
                                  offerId={offer.offer_id}
                                  offerName={offer.name}
                                  currentImageUrl={offer.image_url || offer.thumbnail_url}
                                  currentDescription={offer.description}
                                  currentCategory={offer.category}
                                />
                                <div className="text-right">
                                  <span className="font-semibold text-green-600">
                                    ${(parseFloat(offer.payout || 0) * pricePercentage / 100).toFixed(2)}
                                  </span>
                                  {pricePercentage !== 100 && (
                                    <span className="text-[10px] text-muted-foreground line-through ml-1">
                                      ${parseFloat(offer.payout || 0).toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {/* Offer Tags Row */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-dashed">
                              {!hasImage && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                  <Image className="w-2.5 h-2.5" /> No Image
                                </span>
                              )}
                              {hasImage && (
                                <a href={offer.image_url || offer.thumbnail_url} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 hover:underline cursor-pointer">
                                  <Image className="w-2.5 h-2.5" /> Image ✓
                                </a>
                              )}
                              {!hasDescription && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                  <FileText className="w-2.5 h-2.5" /> No Description
                                </span>
                              )}
                              {hasDescription && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" title={offer.description}>
                                  <FileText className="w-2.5 h-2.5" /> {offer.description.length > 40 ? offer.description.substring(0, 40) + '...' : offer.description}
                                </span>
                              )}
                              {!hasVertical && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                  <Tag className="w-2.5 h-2.5" /> No Vertical
                                </span>
                              )}
                              {hasVertical && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                  <Tag className="w-2.5 h-2.5" /> {offer.category || offer.vertical}
                                </span>
                              )}
                              {hasTargetUrl && (
                                <a href={offer.target_url || offer.tracking_url} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 hover:underline cursor-pointer max-w-[200px] truncate"
                                  title={offer.target_url || offer.tracking_url}>
                                  <ExternalLink className="w-2.5 h-2.5 shrink-0" /> {(offer.target_url || offer.tracking_url || '').replace(/^https?:\/\//, '').substring(0, 30)}...
                                </a>
                              )}
                              {!hasTargetUrl && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                  <ExternalLink className="w-2.5 h-2.5" /> No Target URL
                                </span>
                              )}
                              {hasPreviewUrl && (
                                <a href={offer.preview_url} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 hover:underline cursor-pointer max-w-[200px] truncate"
                                  title={offer.preview_url}>
                                  <Eye className="w-2.5 h-2.5 shrink-0" /> {offer.preview_url.replace(/^https?:\/\//, '').substring(0, 30)}...
                                </a>
                              )}
                              {!hasPreviewUrl && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                  <Eye className="w-2.5 h-2.5" /> No Preview URL
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {(!user.emails || user.emails.length === 0) && (
                  <p className="text-xs text-muted-foreground py-2">No matching offers found for this user</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {preview.length === 0 && !loading && (
        <div className="text-center py-8 text-muted-foreground">
          <Eye className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No preview available. Click "Refresh Matches" to generate.</p>
        </div>
      )}

      {/* Publisher Intelligence Dialog */}
      {intelligenceUserId && (
        <Dialog open={!!intelligenceUserId} onOpenChange={() => setIntelligenceUserId(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <PublisherIntelligencePanel userId={intelligenceUserId} compact={false} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Step 4: Schedule ─────────────────────────────────────────────────────────

function StepSchedule({ sendType, setSendType, scheduledAt, setScheduledAt, intervalHours, setIntervalHours, totalEmails, emailsPerUser }: any) {
  return (
    <div className="space-y-6">
      {/* Send Type */}
      <div className="space-y-3">
        <Label className="font-semibold">When to Send</Label>
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <button
            onClick={() => setSendType('send_now')}
            className={`flex items-center gap-2 p-4 rounded-lg border-2 transition-colors ${
              sendType === 'send_now' ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' : 'border-muted hover:border-muted-foreground/30'
            }`}
          >
            <Send className="w-5 h-5 text-orange-500" />
            <div className="text-left">
              <div className="text-sm font-medium">Send Now</div>
              <div className="text-[10px] text-muted-foreground">Start immediately</div>
            </div>
          </button>
          <button
            onClick={() => setSendType('schedule')}
            className={`flex items-center gap-2 p-4 rounded-lg border-2 transition-colors ${
              sendType === 'schedule' ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' : 'border-muted hover:border-muted-foreground/30'
            }`}
          >
            <Calendar className="w-5 h-5 text-orange-500" />
            <div className="text-left">
              <div className="text-sm font-medium">Schedule</div>
              <div className="text-[10px] text-muted-foreground">Pick date & time</div>
            </div>
          </button>
        </div>
      </div>

      {/* Schedule Date */}
      {sendType === 'schedule' && (
        <div className="space-y-2">
          <Label className="font-semibold">Schedule Date & Time (IST)</Label>
          <Input
            type="datetime-local"
            value={scheduledAt}
            onChange={e => setScheduledAt(e.target.value)}
            className="max-w-64"
          />
          <p className="text-xs text-muted-foreground">First email will be sent at this time. Subsequent emails follow the gap set in Settings step.</p>
        </div>
      )}

      {/* Summary */}
      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-2">
        <h4 className="text-sm font-semibold text-green-700 dark:text-green-300 flex items-center gap-2">
          <Clock className="w-4 h-4" /> Campaign Summary
        </h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div><span className="text-muted-foreground">Total emails:</span> <strong>{totalEmails}</strong></div>
          <div><span className="text-muted-foreground">Emails per user:</span> <strong>{emailsPerUser}</strong></div>
          <div><span className="text-muted-foreground">Start:</span> <strong>{sendType === 'send_now' ? 'Immediately' : scheduledAt || 'Not set'}</strong></div>
          <div><span className="text-muted-foreground">Gap between emails:</span> <strong>Set in Settings step</strong></div>
        </div>
      </div>
    </div>
  );
}
