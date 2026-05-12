import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Loader2, RefreshCw, Pause, Play, XCircle, RotateCcw,
  ChevronDown, ChevronUp, Mail, Clock, CheckCircle2, AlertTriangle,
  Send, Calendar, Users, Eye, Inbox,
} from 'lucide-react';
import { API_BASE_URL } from '@/services/apiConfig';

interface Campaign {
  _id: string;
  batch_name: string;
  source_tab: string;
  status: string;
  user_count: number;
  total_emails: number;
  sent_count: number;
  failed_count: number;
  pending_count: number;
  total_offers_per_user: number;
  offers_per_email: number;
  price_percentage: number;
  cooldown_days: number;
  total_opens: number;
  total_clicks: number;
  created_by_username: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  paused_at: string | null;
}

interface CampaignEmail {
  _id: string;
  user_id: string;
  username: string;
  email: string;
  email_number: number;
  offer_ids: string[];
  offer_names: string[];
  offer_count: number;
  status: string;
  scheduled_at: string;
  sent_at: string | null;
  error_message: string | null;
  retry_count: number;
  opened: boolean;
  opened_at: string | null;
  clicked: boolean;
  clicked_at: string | null;
  click_count: number;
}

interface QueueStats {
  campaigns: Record<string, number>;
  emails: Record<string, number>;
  sent_today: number;
  total_pending: number;
  total_sent: number;
  total_failed: number;
}

function formatIST(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' IST';
  } catch {
    return dateStr;
  }
}

const STATUS_COLORS: Record<string, string> = {
  queued: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  sending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  paused: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
  pending: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  sent: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  ready: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
};

export default function CampaignQueueTab({ isActive }: { isActive: boolean }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [campaignEmails, setCampaignEmails] = useState<Record<string, CampaignEmail[]>>({});
  const [loadingEmails, setLoadingEmails] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const token = localStorage.getItem('token');

  const fetchCampaigns = useCallback(async () => {
    if (!isActive) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: '20', status: statusFilter });
      const res = await fetch(`${API_BASE_URL}/api/admin/email-campaigns?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCampaigns(data.campaigns || []);
      setTotalPages(data.pages || data.pagination?.pages || 1);
    } catch {
      toast.error('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, [isActive, page, statusFilter, token]);

  const fetchStats = useCallback(async () => {
    if (!isActive) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/email-campaigns/queue-stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setStats(data);
    } catch {}
  }, [isActive, token]);

  useEffect(() => {
    fetchCampaigns();
    fetchStats();
  }, [fetchCampaigns, fetchStats]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      fetchCampaigns();
      fetchStats();
    }, 30000);
    return () => clearInterval(interval);
  }, [isActive, fetchCampaigns, fetchStats]);

  const loadCampaignEmails = async (campaignId: string) => {
    if (campaignEmails[campaignId]) {
      setExpandedCampaign(expandedCampaign === campaignId ? null : campaignId);
      return;
    }
    setLoadingEmails(campaignId);
    setExpandedCampaign(campaignId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/email-campaigns/${campaignId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCampaignEmails(prev => ({ ...prev, [campaignId]: data.emails || [] }));
    } catch {
      toast.error('Failed to load campaign details');
    } finally {
      setLoadingEmails(null);
    }
  };

  const campaignAction = async (campaignId: string, action: 'pause' | 'resume' | 'cancel' | 'retry-failed') => {
    setActionLoading(`${campaignId}-${action}`);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/email-campaigns/${campaignId}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchCampaigns();
        fetchStats();
        // Refresh emails if expanded
        if (expandedCampaign === campaignId) {
          setCampaignEmails(prev => { const n = { ...prev }; delete n[campaignId]; return n; });
          loadCampaignEmails(campaignId);
        }
      } else {
        toast.error(data.error || 'Action failed');
      }
    } catch {
      toast.error('Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard icon={<Inbox className="w-4 h-4" />} label="Total Pending" value={stats.total_pending} color="blue" />
          <StatCard icon={<Send className="w-4 h-4" />} label="Total Sent" value={stats.total_sent} color="green" />
          <StatCard icon={<AlertTriangle className="w-4 h-4" />} label="Failed" value={stats.total_failed} color="red" />
          <StatCard icon={<CheckCircle2 className="w-4 h-4" />} label="Sent Today" value={stats.sent_today} color="emerald" />
          <StatCard icon={<Calendar className="w-4 h-4" />} label="Active Campaigns" value={stats.campaigns?.sending || 0} color="orange" />
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Campaigns</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="sending">Sending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchCampaigns(); fetchStats(); }}>
          <RefreshCw className="w-3 h-3 mr-1" /> Refresh
        </Button>
      </div>

      {/* Campaign List */}
      {loading && campaigns.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Mail className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No campaigns yet. Select users and launch a campaign to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {campaigns.map(campaign => (
            <div key={campaign._id} className="border rounded-lg overflow-hidden">
              {/* Campaign Header */}
              <div
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => loadCampaignEmails(campaign._id)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate">{campaign.batch_name || 'Unnamed Campaign'}</span>
                      <Badge className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[campaign.status] || ''}`}>
                        {campaign.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                      <span>{formatIST(campaign.created_at)}</span>
                      <span>by {campaign.created_by_username}</span>
                      <span>from "{campaign.source_tab}"</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Progress */}
                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span>{campaign.user_count}</span>
                    </div>
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${campaign.total_emails > 0 ? (campaign.sent_count / campaign.total_emails) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono">
                      {campaign.sent_count}/{campaign.total_emails}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    {campaign.status === 'sending' || campaign.status === 'queued' ? (
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => campaignAction(campaign._id, 'pause')}
                        disabled={actionLoading === `${campaign._id}-pause`}
                      >
                        <Pause className="w-3 h-3" />
                      </Button>
                    ) : campaign.status === 'paused' ? (
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => campaignAction(campaign._id, 'resume')}
                        disabled={actionLoading === `${campaign._id}-resume`}
                      >
                        <Play className="w-3 h-3" />
                      </Button>
                    ) : null}
                    {campaign.failed_count > 0 && (
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-orange-500"
                        onClick={() => campaignAction(campaign._id, 'retry-failed')}
                        disabled={actionLoading === `${campaign._id}-retry-failed`}
                        title="Retry failed emails"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </Button>
                    )}
                    {(campaign.status === 'queued' || campaign.status === 'sending' || campaign.status === 'paused') && (
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-red-500"
                        onClick={() => campaignAction(campaign._id, 'cancel')}
                        disabled={actionLoading === `${campaign._id}-cancel`}
                        title="Cancel campaign"
                      >
                        <XCircle className="w-3 h-3" />
                      </Button>
                    )}
                  </div>

                  <ChevronDown className={`w-4 h-4 transition-transform ${expandedCampaign === campaign._id ? 'rotate-180' : ''}`} />
                </div>
              </div>

              {/* Expanded: Email List */}
              {expandedCampaign === campaign._id && (
                <div className="border-t bg-muted/10 px-4 py-3">
                  {loadingEmails === campaign._id ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="grid grid-cols-[1fr_80px_100px_120px_80px] gap-2 text-[10px] font-medium text-muted-foreground uppercase px-2 pb-1 border-b">
                        <span>Recipient</span>
                        <span>Offers</span>
                        <span>Status</span>
                        <span>Sent/Scheduled</span>
                        <span>Tracking</span>
                      </div>
                      {(campaignEmails[campaign._id] || []).map(email => (
                        <div key={email._id} className="grid grid-cols-[1fr_80px_100px_120px_80px] gap-2 items-center px-2 py-1.5 rounded hover:bg-muted/50 text-xs">
                          <div className="min-w-0">
                            <span className="font-medium truncate block">{email.username}</span>
                            <span className="text-[10px] text-muted-foreground">{email.email} • Email #{email.email_number}</span>
                          </div>
                          <span className="text-[10px]">{email.offer_count} offers</span>
                          <Badge className={`text-[9px] px-1 py-0 w-fit ${STATUS_COLORS[email.status] || ''}`}>
                            {email.status}
                            {email.retry_count > 0 && ` (${email.retry_count}x)`}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {email.sent_at ? formatIST(email.sent_at) : formatIST(email.scheduled_at)}
                          </span>
                          <div className="flex items-center gap-1">
                            {email.opened && <Eye className="w-3 h-3 text-blue-500" title="Opened" />}
                            {email.clicked && <span className="text-[10px] text-green-600">{email.click_count} clicks</span>}
                            {!email.opened && !email.clicked && <span className="text-[10px] text-muted-foreground">—</span>}
                          </div>
                        </div>
                      ))}
                      {(campaignEmails[campaign._id] || []).length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-3">No emails in this campaign</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Prev
          </Button>
          <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800',
    green: 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800',
    red: 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800',
    emerald: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800',
    orange: 'bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800',
  };

  return (
    <div className={`rounded-lg border p-3 ${colorClasses[color] || ''}`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-lg font-bold">{value}</span>
      </div>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}
