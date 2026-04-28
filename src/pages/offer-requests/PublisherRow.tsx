import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, CheckCircle, XCircle, Loader2, AlertTriangle, AlertCircle,
  TrendingUp, MousePointerClick, Target, DollarSign, ExternalLink, Calendar,
  Shield, Zap, Send, Package, Eye, Link2, Edit, FileImage, Camera, Image, Settings2
} from 'lucide-react';
import { API_BASE_URL } from '@/services/apiConfig';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveContainer, Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip as RTooltip } from 'recharts';
import UserPreferenceBadges from '@/components/UserPreferenceBadges';
import type { PProf, PSt, Inv } from '@/pages/AdminOfferAccessRequests';
import { fd, rsk } from '@/pages/AdminOfferAccessRequests';
import { EditOfferModal } from '@/components/EditOfferModal';
import { adminOfferApi } from '@/services/adminOfferApi';

interface PublisherRowProps {
  pub: PProf;
  isExpanded: boolean;
  isSelected: boolean;
  onToggleExpand: () => void;
  onToggleSelect: () => void;
  onSendOffers: (pub: PProf, offers?: Inv[]) => void;
  onRefreshList: () => void;
}

export default function PublisherRow({ pub, isExpanded, isSelected, onToggleExpand, onToggleSelect, onSendOffers, onRefreshList }: PublisherRowProps) {
  const [stats, setStats] = useState<PSt | null>(null);
  const [inventory, setInventory] = useState<Inv[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingInv, setLoadingInv] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [selectedInv, setSelectedInv] = useState<Set<string>>(new Set());
  const [selectedReqs, setSelectedReqs] = useState<Set<string>>(new Set());
  const [bulkActing, setBulkActing] = useState(false);
  const [editOffer, setEditOffer] = useState<any>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState<string | null>(null);
  const [healthPopup, setHealthPopup] = useState<{ offerId: string; name: string; health: any } | null>(null);
  const [loadingHealth, setLoadingHealth] = useState<string | null>(null);
  const [selectedReqOffer, setSelectedReqOffer] = useState<string | null>(null);
  const [selectedRelated, setSelectedRelated] = useState<Set<string>>(new Set());
  const [expandedOfferId, setExpandedOfferId] = useState<string | null>(null);
  const [proofRequestModal, setProofRequestModal] = useState<{ offerId: string; offerName: string; network?: string; payout?: number; countries?: string[] } | null>(null);
  const [proofRequestMsg, setProofRequestMsg] = useState('');
  const [sendingProofReq, setSendingProofReq] = useState(false);
  const [proofTemplateOpen, setProofTemplateOpen] = useState(false);
  const [proofFields, setProofFields] = useState<Record<string, boolean>>(() => {
    try { const s = localStorage.getItem('ml_proof_request_fields'); return s ? JSON.parse(s) : { offer_name: true, network: false, payout: false, countries: false }; }
    catch { return { offer_name: true, network: false, payout: false, countries: false }; }
  });
  const [proofViewerOpen, setProofViewerOpen] = useState(false);
  const [proofImages, setProofImages] = useState<string[]>([]);
  const [loadingProofs, setLoadingProofs] = useState(false);
  const [fullscreenImg, setFullscreenImg] = useState<string | null>(null);
  const token = localStorage.getItem('token');
  const risk = rsk(pub.risk_level);
  const pendingReqs = pub.requests.filter(r => r.status === "pending" || r.status === "review");

  useEffect(() => {
    if (!isExpanded) return;
    if (!stats && !loadingStats) {
      setLoadingStats(true);
      fetch(`${API_BASE_URL}/api/admin/offer-access-requests/publisher/${pub.user_id}/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => { if (!r.ok) throw new Error(); return r.json(); })
        .then(d => { if (d && d.totals) setStats(d); })
        .catch(() => {})
        .finally(() => setLoadingStats(false));
    }
    if (inventory.length === 0 && !loadingInv) {
      setLoadingInv(true);
      fetch(`${API_BASE_URL}/api/admin/offer-access-requests/inventory-matches?offer_name=${encodeURIComponent(pub.latest_offer_name)}&user_id=${pub.user_id}&limit=12`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => { if (!r.ok) throw new Error(); return r.json(); })
        .then(d => setInventory(d.matches || []))
        .catch(() => {})
        .finally(() => setLoadingInv(false));
    }
  }, [isExpanded]);

  const approveReq = async (rid: string) => {
    setApproving(rid);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/offer-access-requests/${rid}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ notes: '' }),
      });
      if (!res.ok) throw new Error();
      toast.success('Request approved');
      onRefreshList();
    } catch { toast.error('Failed to approve'); }
    finally { setApproving(null); }
  };

  const rejectReq = async (rid: string) => {
    setRejecting(rid);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/offer-access-requests/${rid}/reject`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: '' }),
      });
      if (!res.ok) throw new Error();
      toast.success('Request rejected');
      onRefreshList();
    } catch { toast.error('Failed to reject'); }
    finally { setRejecting(null); }
  };

  const bulkApprove = async () => {
    const ids = pub.requests.filter(r => r.status === 'pending' || r.status === 'review').map(r => r.request_id);
    if (ids.length === 0) return;
    setBulkApproving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/offer-access-requests/bulk-approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ request_ids: ids }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Approved ${ids.length} request(s)`);
      onRefreshList();
    } catch { toast.error('Bulk approve failed'); }
    finally { setBulkApproving(false); }
  };

  const markForReview = async (rid: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/offer-access-requests/mark-review`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ request_ids: [rid] }),
      });
      if (!res.ok) throw new Error();
      toast.success('Marked for review');
      onRefreshList();
    } catch { toast.error('Failed to mark for review'); }
  };

  const bulkRequestAction = async (action: 'approve' | 'reject' | 'review') => {
    const ids = Array.from(selectedReqs);
    if (!ids.length) return;
    setBulkActing(true);
    try {
      const endpoint = action === 'approve' ? 'bulk-approve' : action === 'reject' ? 'bulk-reject' : 'mark-review';
      const body: Record<string, unknown> = { request_ids: ids };
      if (action === 'reject') body.reason = 'Bulk rejected by admin';
      const res = await fetch(`${API_BASE_URL}/api/admin/offer-access-requests/${endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const label = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'marked for review';
      toast.success(`${ids.length} request(s) ${label}`);
      setSelectedReqs(new Set());
      onRefreshList();
    } catch { toast.error(`Bulk ${action} failed`); }
    finally { setBulkActing(false); }
  };

  const toggleReqSelect = (rid: string) => {
    setSelectedReqs(prev => { const n = new Set(prev); n.has(rid) ? n.delete(rid) : n.add(rid); return n; });
  };

  const handleEditOffer = async (offerId: string) => {
    setLoadingEdit(offerId);
    try {
      const res = await adminOfferApi.getOffer(offerId);
      if (res.offer) {
        setEditOffer(res.offer);
        setEditModalOpen(true);
      }
    } catch { toast.error('Failed to load offer for editing'); }
    finally { setLoadingEdit(null); }
  };

  const initials = ((pub.first_name?.[0] || '') + (pub.last_name?.[0] || pub.username?.[1] || '')).toUpperCase() || '??';

  const toggleExpandOffer = (offerId: string, offerName: string) => {
    if (expandedOfferId === offerId) { setExpandedOfferId(null); setSelectedRelated(new Set()); }
    else {
      setExpandedOfferId(offerId); setSelectedRelated(new Set()); setLoadingInv(true);
      fetch(`${API_BASE_URL}/api/admin/offer-access-requests/inventory-matches?offer_name=${encodeURIComponent(offerName)}&user_id=${pub.user_id}&limit=12`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => { if (!r.ok) throw new Error(); return r.json(); })
        .then(d => setInventory(d.matches || [])).catch(() => {}).finally(() => setLoadingInv(false));
    }
  };
  // Strip network tags like [INHOUSE], [NETWORK_NAME] from offer names for clean display
  const cleanOfferName = (name: string) => name.replace(/\s*\[(?:INHOUSE|[A-Z][A-Za-z0-9_ ]*)\]\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();

  const buildProofMessage = (offerName: string, fields: Record<string, boolean>, req?: { offer_network?: string; offer_payout?: number; offer_countries?: string[] }) => {
    const name = pub.first_name || pub.username;
    const displayName = fields.offer_name !== false ? (fields.network ? offerName : cleanOfferName(offerName)) : '';
    let offerLine = displayName ? `"${displayName}"` : 'the requested offer';
    const details: string[] = [];
    if (fields.payout && req?.offer_payout) details.push(`Payout: $${req.offer_payout.toFixed(2)}`);
    if (fields.countries && req?.offer_countries?.length) details.push(`Countries: ${req.offer_countries.slice(0, 5).join(', ')}`);
    const detailBlock = details.length > 0 ? `\n${details.join(' | ')}` : '';
    return `Hi ${name},\n\nWe require placement proof for the offer ${offerLine} before we can proceed with approval.${detailBlock}\n\nPlease reply to this email with a screenshot or URL showing where you are promoting this offer.\n\nBest regards,\nMoustache Leads Team`;
  };

  const openProofRequest = (offerId: string, offerName: string, reqData?: { offer_network?: string; offer_payout?: number; offer_countries?: string[] }) => {
    setProofRequestModal({ offerId, offerName, network: reqData?.offer_network, payout: reqData?.offer_payout, countries: reqData?.offer_countries });
    setProofRequestMsg(buildProofMessage(offerName, proofFields, reqData));
  };

  const sendProofRequest = async () => {
    if (!proofRequestModal) return;
    setSendingProofReq(true);
    try {
      // Build visible_fields for the offer table based on template settings
      const vf: string[] = ['name']; // always show name
      if (proofFields.payout) vf.push('payout');
      if (proofFields.network) vf.push('network');
      if (proofFields.countries) vf.push('countries');

      const cleanSubject = proofFields.network
        ? proofRequestModal.offerName
        : cleanOfferName(proofRequestModal.offerName);

      const res = await fetch(`${API_BASE_URL}/api/admin/offer-access-requests/send-offers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          user_id: pub.user_id,
          offer_ids: [proofRequestModal.offerId],
          send_via: 'email',
          message_body: proofRequestMsg,
          subject: `Placement Proof Required — ${cleanSubject}`,
          visible_fields: vf,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success('Proof request email sent');
      setProofRequestModal(null);
    } catch { toast.error('Failed to send'); }
    finally { setSendingProofReq(false); }
  };

  const viewProofs = async () => {
    setLoadingProofs(true);
    setProofViewerOpen(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/placement-proofs/admin/all?user_id=${pub.user_id}&per_page=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const urls: string[] = [];
      for (const p of (data.proofs || [])) {
        for (const u of (p.image_urls || [])) {
          urls.push(u.startsWith('http') ? u : `${API_BASE_URL}${u}`);
        }
      }
      setProofImages(urls);
    } catch { toast.error('Failed to load proofs'); }
    finally { setLoadingProofs(false); }
  };

  return (
    <div className="border rounded-xl overflow-hidden bg-card shadow-sm hover:shadow-md transition-shadow">
      {/* Collapsed row */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={onToggleExpand}>
        <div onClick={e => e.stopPropagation()}>
          <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelect()} />
        </div>
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${risk.bg} ${risk.t}`}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate">{pub.username}</span>
            {risk.lb && <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${risk.bd}`}>{risk.lb}</Badge>}
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{pub.account_status}</Badge>
            {(pub.mail_sent_today || 0) > 0 && (
              <Badge className="text-[10px] px-1.5 py-0 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200">
                ✉ {pub.mail_sent_today} sent today
              </Badge>
            )}
            {(pub.mail_total_sent || 0) > 0 && !(pub.mail_sent_today || 0) && (
              <span className="text-[10px] text-muted-foreground">{pub.mail_total_sent} mail(s)</span>
            )}
            {pub.has_proofs && (
              <Badge className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 gap-1 cursor-pointer"
                onClick={(e) => { e.stopPropagation(); viewProofs(); }}>
                <FileImage className="w-3 h-3" /> 📎 Has Proof
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{pub.email}</p>
        </div>
        <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground shrink-0">
          <span className="flex items-center gap-1"><MousePointerClick className="w-3 h-3" />{pub.total_clicks.toLocaleString()}</span>
          <span className="flex items-center gap-1"><Target className="w-3 h-3" />{pub.total_conversions.toLocaleString()}</span>
          <Badge variant={pub.postback_status === 'tested' ? 'default' : pub.postback_status === 'configured' ? 'secondary' : 'outline'} className="text-[10px]">
            PB: {pub.postback_status}
          </Badge>
        </div>
        <div className="hidden lg:flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground truncate max-w-[140px]">{pub.latest_offer_name}</span>
          {pub.pending_count > 0 && <Badge className="bg-amber-500 text-white text-[10px]">{pub.pending_count}</Badge>}
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
      </div>

      {/* Expanded section */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="border-t px-4 py-4 space-y-5 bg-muted/20">
              {/* Publisher header */}
              <div className="flex flex-wrap items-start gap-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold ${risk.bg} ${risk.t}`}>
                  {initials}
                </div>
                <div className="flex-1 min-w-[200px]">
                  <h3 className="font-semibold text-base">{pub.first_name} {pub.last_name}</h3>
                  <p className="text-sm text-muted-foreground">{pub.email}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Joined {fd(pub.created_at)}</span>
                    <Badge variant="outline" className="text-[10px]">{pub.account_status}</Badge>
                    {pub.company_name && <span>· {pub.company_name}</span>}
                    {pub.website && <a href={pub.website} target="_blank" rel="noreferrer" className="flex items-center gap-0.5 text-blue-500 hover:underline"><ExternalLink className="w-3 h-3" />{pub.website}</a>}
                  </div>
                  <div className="mt-1.5">
                    <UserPreferenceBadges user={pub} compact />
                  </div>
                </div>
                <Badge variant={pub.fraud_score < 30 ? 'default' : pub.fraud_score < 60 ? 'secondary' : 'destructive'} className="text-xs">
                  <Shield className="w-3 h-3 mr-1" />Fraud: {pub.fraud_score}
                </Badge>
              </div>

              {/* Pending & Review Requests — AT TOP */}
              {pub.requests.filter(r => r.status === 'pending' || r.status === 'review').length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />Pending Requests ({pub.requests.filter(r => r.status === 'pending').length})
                    {pub.requests.filter(r => r.status === 'review').length > 0 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-600 border-blue-200 ml-1">
                        {pub.requests.filter(r => r.status === 'review').length} in review
                      </Badge>
                    )}
                  </h4>

                  {/* Requested Offer — Cards with inline checkboxes */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Requested Offer</label>
                      {pendingReqs.length > 1 && (
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] gap-1" onClick={() => {
                          const allIds = pendingReqs.map(r => r.request_id);
                          setSelectedReqs(prev => prev.size === allIds.length ? new Set() : new Set(allIds));
                        }}>
                          {selectedReqs.size === pendingReqs.length ? 'Deselect All' : 'Select All'}
                        </Button>
                      )}
                    </div>

                    {/* Bulk action bar — shown when any cards are selected */}
                    {selectedReqs.size > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap p-2 bg-muted/50 rounded-lg border">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{selectedReqs.size} selected</Badge>
                        <Button size="sm" className="h-6 px-2 text-[9px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => bulkRequestAction('approve')} disabled={bulkActing}>
                          <CheckCircle className="w-2.5 h-2.5" />Approve
                        </Button>
                        <Button size="sm" variant="outline" className="h-6 px-2 text-[9px] gap-1 text-red-600 border-red-200" onClick={() => bulkRequestAction('reject')} disabled={bulkActing}>
                          <XCircle className="w-2.5 h-2.5" />Reject
                        </Button>
                        <Button size="sm" variant="outline" className="h-6 px-2 text-[9px] gap-1 text-amber-600 border-amber-200" onClick={() => bulkRequestAction('review')} disabled={bulkActing}>
                          <AlertTriangle className="w-2.5 h-2.5" />Review
                        </Button>
                        <Button size="sm" variant="outline" className="h-6 px-2 text-[9px] gap-1 text-blue-600 border-blue-200" onClick={() => {
                          const offers = pub.requests.filter(r => selectedReqs.has(r.request_id)).map(r => ({
                            _id: '', offer_id: r.offer_id, name: r.offer_name, network: r.offer_network, payout: r.offer_payout, match_strength: ''
                          }));
                          onSendOffers(pub, offers);
                        }}>
                          <Send className="w-2.5 h-2.5" />Mail {selectedReqs.size}
                        </Button>
                      </div>
                    )}

                    {/* Offer cards — always with checkboxes */}
                    <div className="space-y-2">
                      {pendingReqs.map(req => {
                        const isCardExpanded = expandedOfferId === req.offer_id;
                        return (
                        <div key={req.request_id} className={`rounded-lg border transition-all ${selectedReqs.has(req.request_id) ? 'border-blue-300 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm' : isCardExpanded ? 'border-blue-300 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm' : 'border-gray-200 dark:border-gray-700 hover:border-blue-200'}`}>
                          <div className="p-3 cursor-pointer" onClick={() => toggleExpandOffer(req.offer_id, req.offer_name)}>
                            <div className="flex items-start gap-2">
                              <input type="checkbox" className="rounded border-gray-300 w-4 h-4 accent-blue-600 mt-1 shrink-0 cursor-pointer"
                                checked={selectedReqs.has(req.request_id)}
                                onClick={e => e.stopPropagation()}
                                onChange={() => toggleReqSelect(req.request_id)} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-semibold text-sm truncate">{req.offer_name}</p>
                                  {req.offer_status === 'active' && <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-50 text-green-700 border-green-200">Active</Badge>}
                                  {req.offer_status === 'inactive' && <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-gray-50 text-gray-600 border-gray-200">Inactive</Badge>}
                                  {req.offer_health?.status === 'unhealthy' && <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-50 text-red-600 border-red-200"><AlertCircle className="w-2.5 h-2.5 mr-0.5" />{req.offer_health.failures.length} issues</Badge>}
                                  {req.offer_health?.status === 'healthy' && <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-600 border-emerald-200"><CheckCircle className="w-2.5 h-2.5 mr-0.5" />Healthy</Badge>}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                                  <span>{req.offer_network}</span><span>·</span>
                                  <span className="font-semibold text-foreground">${req.offer_payout.toFixed(2)}</span>
                                  {req.offer_countries && req.offer_countries.length > 0 && (<><span>·</span><span>{req.offer_countries.slice(0, 5).join(', ')}</span></>)}
                                  {req.requested_at && (<><span>·</span><span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" />{new Date(req.requested_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })} IST</span></>)}
                                </div>
                                {req.offer_stats && (
                                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground flex-wrap">
                                    <span className="flex items-center gap-0.5"><MousePointerClick className="w-3 h-3 text-blue-500" />{(req.offer_stats.total_clicks || 0).toLocaleString()} clicks</span>
                                    <span className="flex items-center gap-0.5 text-emerald-600"><CheckCircle className="w-3 h-3" />{req.offer_stats.approved_count || 0} approved</span>
                                    <span className="flex items-center gap-0.5 text-red-500"><XCircle className="w-3 h-3" />{req.offer_stats.rejected_count || 0} rejected</span>
                                    <span className="flex items-center gap-0.5 text-amber-500"><AlertTriangle className="w-3 h-3" />{req.offer_stats.pending_count || 0} pending</span>
                                  </div>
                                )}
                                {req.offer_health?.failures && req.offer_health.failures.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">{req.offer_health.failures.map(f => (<span key={f.criterion} className="inline-flex items-center gap-0.5 text-[9px] text-red-600 bg-red-50 border border-red-100 rounded px-1.5 py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />{f.criterion.replace(/_/g, ' ')}</span>))}</div>
                                )}
                                {req.offer_target_url && (
                                  <a href={req.offer_target_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                                    className="block mt-1 text-[10px] text-blue-500 hover:text-blue-700 hover:underline truncate max-w-[400px]" title={req.offer_target_url}>
                                    {req.offer_target_url}
                                  </a>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <p className="text-lg font-bold">${req.offer_payout.toFixed(2)}</p>
                                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isCardExpanded ? 'rotate-180' : ''}`} />
                              </div>
                            </div>
                          </div>
                          <div className="px-3 pb-2 flex items-center gap-1.5 flex-wrap" onClick={e => e.stopPropagation()}>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1" onClick={() => navigator.clipboard.writeText(req.offer_name).then(() => toast.success('Copied'))}>Copy name</Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1 text-blue-600 border-blue-200" onClick={async () => { try { await fetch(`${API_BASE_URL}/api/admin/offer-collections/add`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ offer_id: req.offer_id, request_id: req.request_id, collection_type: 'direct_partner' }) }); toast.success('Added to DP'); } catch { toast.error('Failed'); } }}>DP</Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1 text-violet-600 border-violet-200" onClick={async () => { try { await fetch(`${API_BASE_URL}/api/admin/offer-collections/add`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ offer_id: req.offer_id, request_id: req.request_id, collection_type: 'affiliate' }) }); toast.success('Added to AF'); } catch { toast.error('Failed'); } }}>AF</Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1 text-blue-600" onClick={() => handleEditOffer(req.offer_id)} disabled={loadingEdit === req.offer_id}>{loadingEdit === req.offer_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Edit className="w-3 h-3" />}Edit</Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1 text-amber-600 border-amber-300" onClick={() => markForReview(req.request_id)}><AlertTriangle className="w-3 h-3" />Review</Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1 text-destructive border-red-200" onClick={() => rejectReq(req.request_id)} disabled={rejecting === req.request_id}>{rejecting === req.request_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}Reject</Button>
                            <Button size="sm" className="h-7 px-2 text-[10px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => approveReq(req.request_id)} disabled={approving === req.request_id}>{approving === req.request_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}Approve</Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1 text-blue-600" onClick={() => onSendOffers(pub, [{_id: '', offer_id: req.offer_id, name: req.offer_name, network: req.offer_network, payout: req.offer_payout, match_strength: ''}])}><Send className="w-3 h-3" />Suggest</Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1 text-purple-600 border-purple-200" onClick={() => openProofRequest(req.offer_id, req.offer_name, { offer_network: req.offer_network, offer_payout: req.offer_payout, offer_countries: req.offer_countries })}><Camera className="w-3 h-3" />Request Proof</Button>
                          </div>
                          <AnimatePresence>
                            {isCardExpanded && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                <div className="border-t mx-3 pt-2 pb-3 space-y-2">
                                  {loadingInv ? (
                                    <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" />Loading related offers...</div>
                                  ) : inventory.filter(inv => inv.offer_id !== req.offer_id).length > 0 ? (
                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between flex-wrap gap-1">
                                        <div className="flex items-center gap-2">
                                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Related Offers</p>
                                          <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[9px] gap-0.5 text-blue-600" onClick={() => { const ids = inventory.filter(inv => inv.offer_id !== req.offer_id).slice(0, 8).map(inv => inv.offer_id); setSelectedRelated(prev => prev.size === ids.length ? new Set() : new Set(ids)); }}>{selectedRelated.size === inventory.filter(inv => inv.offer_id !== req.offer_id).slice(0, 8).length ? 'Deselect All' : 'Select All'}</Button>
                                        </div>
                                        {selectedRelated.size > 0 && (
                                          <div className="flex items-center gap-1 flex-wrap">
                                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{selectedRelated.size} selected</Badge>
                                            <Button size="sm" className="h-6 px-2 text-[9px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={async () => { const ids = inventory.filter(inv => selectedRelated.has(inv.offer_id)).map(inv => { const r2 = pub.requests.find(r => r.offer_id === inv.offer_id); return r2?.request_id; }).filter(Boolean); if (!ids.length) { toast.info('No matching requests'); return; } try { await fetch(`${API_BASE_URL}/api/admin/offer-access-requests/bulk-approve`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ request_ids: ids }) }); toast.success('Approved ' + ids.length); onRefreshList(); } catch { toast.error('Failed'); } }}><CheckCircle className="w-2.5 h-2.5" />Approve</Button>
                                            <Button size="sm" variant="outline" className="h-6 px-2 text-[9px] gap-1 text-red-600 border-red-200" onClick={async () => { const ids = inventory.filter(inv => selectedRelated.has(inv.offer_id)).map(inv => { const r2 = pub.requests.find(r => r.offer_id === inv.offer_id); return r2?.request_id; }).filter(Boolean); if (!ids.length) { toast.info('No matching requests'); return; } try { await fetch(`${API_BASE_URL}/api/admin/offer-access-requests/bulk-reject`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ request_ids: ids, reason: 'Bulk rejected' }) }); toast.success('Rejected ' + ids.length); onRefreshList(); } catch { toast.error('Failed'); } }}><XCircle className="w-2.5 h-2.5" />Reject</Button>
                                            <Button size="sm" className="h-6 px-2 text-[9px] gap-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => onSendOffers(pub, inventory.filter(inv => selectedRelated.has(inv.offer_id)))}><Send className="w-2.5 h-2.5" />Mail {selectedRelated.size}</Button>
                                            <Button size="sm" variant="outline" className="h-6 px-2 text-[9px] gap-1 text-indigo-600 border-indigo-200" onClick={() => onSendOffers(pub, inventory.filter(inv => selectedRelated.has(inv.offer_id)))}><Package className="w-2.5 h-2.5" />Schedule</Button>
                                          </div>
                                        )}
                                      </div>
                                      {inventory.filter(inv => inv.offer_id !== req.offer_id).slice(0, 8).map(inv => (
                                        <div key={inv.offer_id} className={`rounded-lg border px-3 py-2 text-xs space-y-1.5 ${selectedRelated.has(inv.offer_id) ? 'border-blue-300 bg-blue-50/50' : 'border-gray-200 bg-gray-50 dark:bg-gray-900/30'}`}>
                                          <div className="flex items-center gap-2">
                                            <input type="checkbox" className="rounded border-gray-300 w-3.5 h-3.5 cursor-pointer shrink-0" checked={selectedRelated.has(inv.offer_id)} onChange={() => setSelectedRelated(prev => { const n = new Set(prev); n.has(inv.offer_id) ? n.delete(inv.offer_id) : n.add(inv.offer_id); return n; })} />
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-1.5 flex-wrap">
                                                <p className="font-medium text-foreground/80 truncate">{inv.name}</p>
                                                {inv.already_sent && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-amber-50 text-amber-700 border-amber-200 shrink-0">Sent</Badge>}
                                                {inv.visibility === 'active' && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-green-50 text-green-700 border-green-200 shrink-0">Active</Badge>}
                                                {inv.visibility === 'inactive' && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-gray-50 text-gray-600 border-gray-200 shrink-0">Inactive</Badge>}
                                                {inv.health?.status === 'unhealthy' && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-red-50 text-red-600 border-red-200 shrink-0"><AlertCircle className="w-2.5 h-2.5 mr-0.5" />{inv.health.failures.length} issues</Badge>}
                                                {inv.health?.status === 'healthy' && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-emerald-50 text-emerald-600 border-emerald-200 shrink-0"><CheckCircle className="w-2.5 h-2.5 mr-0.5" />Healthy</Badge>}
                                              </div>
                                              <p className="text-[10px] text-muted-foreground">${inv.payout.toFixed(2)} · {inv.network || inv.match_strength}</p>
                                            </div>
                                            {inv.request_status && <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">{inv.request_status}</Badge>}
                                            <span className="text-sm font-bold shrink-0">${inv.payout.toFixed(2)}</span>
                                          </div>
                                          <div className="flex items-center gap-1 flex-wrap">
                                            <Button size="sm" variant="outline" className="h-6 px-1.5 text-[9px] gap-0.5" onClick={() => navigator.clipboard.writeText(inv.name).then(() => toast.success('Copied'))}>Copy name</Button>
                                            <Button size="sm" variant="outline" className="h-6 px-1.5 text-[9px] gap-0.5" onClick={() => { if (inv.target_url) window.open(inv.target_url, '_blank'); else toast.info('No target URL'); }}>Open</Button>
                                            <Button size="sm" variant="outline" className="h-6 px-1.5 text-[9px] gap-0.5 text-blue-600 border-blue-200" onClick={async () => { try { await fetch(`${API_BASE_URL}/api/admin/offer-collections/add`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ offer_id: inv.offer_id, collection_type: 'direct_partner' }) }); toast.success('Added to DP'); } catch { toast.error('Failed'); } }}>DP</Button>
                                            <Button size="sm" variant="outline" className="h-6 px-1.5 text-[9px] gap-0.5 text-violet-600 border-violet-200" onClick={async () => { try { await fetch(`${API_BASE_URL}/api/admin/offer-collections/add`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ offer_id: inv.offer_id, collection_type: 'affiliate' }) }); toast.success('Added to AF'); } catch { toast.error('Failed'); } }}>AF</Button>
                                            <Button size="sm" variant="outline" className="h-6 px-1.5 text-[9px] gap-0.5 text-blue-600" onClick={() => handleEditOffer(inv.offer_id)} disabled={loadingEdit === inv.offer_id}>{loadingEdit === inv.offer_id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Edit className="w-2.5 h-2.5" />}Edit</Button>
                                            <Button size="sm" variant="outline" className="h-6 px-1.5 text-[9px] gap-0.5 text-blue-600" onClick={() => onSendOffers(pub, [inv])}><Send className="w-2.5 h-2.5" />Suggest</Button>
                                            <Button size="sm" variant="outline" className="h-6 px-1.5 text-[9px] gap-0.5 text-amber-600 border-amber-300" onClick={() => { const rq = pub.requests.find(r => r.offer_id === inv.offer_id); if (rq) markForReview(rq.request_id); else toast.info('No pending request'); }}><AlertTriangle className="w-2.5 h-2.5" />Review</Button>
                                            <Button size="sm" variant="outline" className="h-6 px-1.5 text-[9px] gap-0.5 text-destructive border-red-200" onClick={() => { const rq = pub.requests.find(r => r.offer_id === inv.offer_id); if (rq) rejectReq(rq.request_id); else toast.info('No pending request'); }}><XCircle className="w-2.5 h-2.5" />Reject</Button>
                                            <Button size="sm" className="h-6 px-1.5 text-[9px] gap-0.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { const rq = pub.requests.find(r => r.offer_id === inv.offer_id); if (rq) approveReq(rq.request_id); else toast.info('No pending request'); }}><CheckCircle className="w-2.5 h-2.5" />Approve</Button>
                                            <Button size="sm" variant="outline" className="h-6 px-1.5 text-[9px] gap-0.5 text-indigo-600 border-indigo-200" onClick={() => onSendOffers(pub, [inv])}><Calendar className="w-2.5 h-2.5" />Schedule</Button>
                                            <Button size="sm" variant="outline" className="h-6 px-1.5 text-[9px] gap-0.5 text-purple-600 border-purple-200" onClick={() => openProofRequest(inv.offer_id, inv.name, { offer_network: inv.network, offer_payout: inv.payout })}><Camera className="w-2.5 h-2.5" />Request Proof</Button>
                                          </div>
                                          {inv.health?.failures && inv.health.failures.length > 0 && (
                                            <div className="flex flex-wrap gap-1">{inv.health.failures.map(f => (<span key={f.criterion} className="inline-flex items-center gap-0.5 text-[9px] text-red-600 bg-red-50 border border-red-100 rounded px-1.5 py-0.5"><span className="w-1 h-1 rounded-full bg-red-400" />{f.criterion.replace(/_/g, ' ')}{f.detail ? `: ${f.detail}` : ''}</span>))}</div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground py-2">No related offers found</p>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Bulk actions for all pending requests */}
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button size="sm" className="h-7 px-3 text-[10px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={bulkApprove} disabled={bulkApproving}>
                      {bulkApproving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}Approve All ({pub.requests.filter(r => r.status === 'pending' || r.status === 'review').length})
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-3 text-[10px] gap-1 text-amber-600 border-amber-300" onClick={() => bulkRequestAction('review')} disabled={bulkActing}>
                      <AlertTriangle className="w-3 h-3" />Mark All for Review
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-3 text-[10px] gap-1 text-red-600 border-red-300" onClick={() => bulkRequestAction('reject')} disabled={bulkActing}>
                      <XCircle className="w-3 h-3" />Reject All
                    </Button>
                  </div>
                </div>
              )}

              {/* Postback Status Section */}
              <div className="rounded-xl border bg-card p-3 space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" />Postback Status
                </h4>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Postback added</span>
                    {pub.postback_url ? (
                      <span className="flex items-center gap-1 text-emerald-600 font-medium"><span className="w-2 h-2 rounded-full bg-emerald-500" />Yes</span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-500 font-medium"><span className="w-2 h-2 rounded-full bg-red-400" />No</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Postback tested</span>
                    {pub.postback_tested ? (
                      <span className="flex items-center gap-1 text-emerald-600 font-medium"><span className="w-2 h-2 rounded-full bg-emerald-500" />Tested</span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-500 font-medium"><span className="w-2 h-2 rounded-full bg-amber-400" />Not tested</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Date added</span>
                    <span className="font-medium">{fd(pub.created_at)}</span>
                  </div>
                </div>
                {pub.postback_url && (
                  <div className="text-[10px] font-mono text-muted-foreground bg-muted/50 rounded px-2 py-1 truncate" title={pub.postback_url}>
                    {pub.postback_url}
                  </div>
                )}
              </div>

              {/* Good standing banner */}
              {pub.fraud_score < 40 && pub.postback_status !== 'none' && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-3 py-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Good standing</span>
                  <span className="text-xs text-emerald-600 dark:text-emerald-500">· Fraud score {pub.fraud_score} · Postback {pub.postback_status}</span>
                </div>
              )}

              {/* Stats cards */}
              {loadingStats ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : stats && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Total Clicks', value: stats.totals.clicks.toLocaleString(), icon: MousePointerClick, gradient: 'from-blue-500 to-cyan-500' },
                      { label: 'Conversions', value: stats.totals.conversions.toLocaleString(), icon: Target, gradient: 'from-emerald-500 to-teal-500' },
                      { label: 'Conv Rate', value: stats.totals.conversion_rate.toFixed(1) + '%', icon: TrendingUp, gradient: 'from-violet-500 to-purple-500' },
                      { label: 'EPC', value: '$' + stats.totals.epc.toFixed(2), icon: DollarSign, gradient: 'from-amber-500 to-orange-500' },
                    ].map(s => (
                      <div key={s.label} className={`rounded-xl bg-gradient-to-br ${s.gradient} p-3 text-white`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <s.icon className="w-3.5 h-3.5 opacity-80" />
                          <span className="text-[10px] font-medium opacity-80">{s.label}</span>
                        </div>
                        <p className="text-lg font-bold">{s.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Area chart */}
                  {stats.daily_stats.length > 0 && (
                    <div className="rounded-xl border bg-card p-3">
                      <h4 className="text-xs font-semibold text-muted-foreground mb-2">30-Day Performance</h4>
                      <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={stats.daily_stats}>
                          <defs>
                            <linearGradient id={`clicks-${pub.user_id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id={`convs-${pub.user_id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <RTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                          <Area type="monotone" dataKey="clicks" stroke="#3b82f6" fill={`url(#clicks-${pub.user_id})`} strokeWidth={2} />
                          <Area type="monotone" dataKey="conversions" stroke="#10b981" fill={`url(#convs-${pub.user_id})`} strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Traffic sources */}
                  {stats.traffic_sources.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Traffic Sources</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {stats.traffic_sources.map(ts => (
                          <div key={ts.name} className="flex items-center justify-between rounded-lg border px-3 py-2">
                            <div>
                              <p className="text-xs font-medium">{ts.name}</p>
                              <p className="text-[10px] text-muted-foreground">{ts.type}</p>
                            </div>
                            <div className="text-right text-[10px]">
                              <p>{ts.clicks.toLocaleString()} clicks</p>
                              <p className="text-muted-foreground">{ts.conv_rate.toFixed(1)}% CR</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Offer Views (30d) — Dual bars: all users vs this user */}
                  {stats.offer_views && stats.offer_views.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" />Offers Viewed (30d)
                      </h4>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-1">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />All Users</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />This User</span>
                      </div>
                      <div className="space-y-1.5">
                        {(() => {
                          const sorted = [...stats.offer_views!].sort((a, b) => b.view_count - a.view_count).slice(0, 7);
                          const maxGlobal = Math.max(...sorted.map(v => v.global_view_count || v.view_count), 1);
                          const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];
                          return sorted.map((v, i) => (
                            <div key={v.offer_id} className="flex items-center gap-2 text-xs">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
                              <span className="flex-1 truncate min-w-0 font-medium">{v.offer_name}</span>
                              <span className="text-muted-foreground shrink-0 w-14 text-right tabular-nums">{v.view_count} / {v.global_view_count || v.view_count}</span>
                              <div className="w-24 h-3.5 bg-muted rounded-full overflow-hidden shrink-0 relative">
                                {/* Background bar: global views (all users) */}
                                <div className="absolute inset-y-0 left-0 rounded-full bg-gray-300 dark:bg-gray-600 opacity-60"
                                  style={{ width: `${((v.global_view_count || v.view_count) / maxGlobal) * 100}%` }} />
                                {/* Foreground bar: this user's views */}
                                <div className="absolute inset-y-0.5 left-0 rounded-full"
                                  style={{ width: `${(v.view_count / maxGlobal) * 100}%`, backgroundColor: colors[i % colors.length] }} />
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={bulkApprove} disabled={bulkApproving || pub.requests.filter(r => r.status === 'pending' || r.status === 'review').length === 0}>
                  {bulkApproving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  Approve All ({pub.requests.filter(r => r.status === 'pending' || r.status === 'review').length})
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50"
                  onClick={() => {
                    const ids = pub.requests.filter(r => r.status === 'pending').map(r => r.request_id);
                    if (ids.length === 0) { toast.info('No pending requests to mark'); return; }
                    fetch(`${API_BASE_URL}/api/admin/offer-access-requests/mark-review`, {
                      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ request_ids: ids }),
                    }).then(r => { if (r.ok) { toast.success(`${ids.length} request(s) marked for review`); onRefreshList(); } else toast.error('Failed'); })
                    .catch(() => toast.error('Failed'));
                  }}>
                  <AlertTriangle className="w-3.5 h-3.5" />Mark All for Review
                </Button>
                <div className="flex-1" />
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onSendOffers(pub)}>
                  <Send className="w-3.5 h-3.5" />Send an Email
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Offer Modal */}
      <EditOfferModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        offer={editOffer}
        onOfferUpdated={() => { setEditOffer(null); onRefreshList(); }}
      />

      {/* Request Proof Modal */}
      <Dialog open={!!proofRequestModal} onOpenChange={v => { if (!v) setProofRequestModal(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Camera className="h-4 w-4 text-purple-600" /> Request Placement Proof
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="p-2 bg-muted/50 rounded text-xs">
              <span className="text-muted-foreground">Offer:</span> <span className="font-medium">{proofRequestModal?.offerName}</span>
              <br /><span className="text-muted-foreground">Publisher:</span> <span className="font-medium">{pub.username} ({pub.email})</span>
            </div>

            {/* Template field toggles */}
            <div className="space-y-1.5">
              <button onClick={() => setProofTemplateOpen(!proofTemplateOpen)} className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                <Settings2 className="w-3 h-3" />
                Template Settings
                <ChevronDown className={`w-3 h-3 transition-transform ${proofTemplateOpen ? 'rotate-180' : ''}`} />
              </button>
              {proofTemplateOpen && (
                <div className="flex flex-wrap gap-2 p-2 bg-muted/30 rounded-lg border">
                  {[
                    { key: 'offer_name', label: 'Offer Name' },
                    { key: 'network', label: 'Network Name' },
                    { key: 'payout', label: 'Payout' },
                    { key: 'countries', label: 'Countries' },
                  ].map(f => (
                    <label key={f.key} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" className="rounded border-gray-300 w-3.5 h-3.5 accent-purple-600"
                        checked={proofFields[f.key] ?? false}
                        onChange={() => {
                          const updated = { ...proofFields, [f.key]: !proofFields[f.key] };
                          setProofFields(updated);
                          localStorage.setItem('ml_proof_request_fields', JSON.stringify(updated));
                          if (proofRequestModal) {
                            setProofRequestMsg(buildProofMessage(proofRequestModal.offerName, updated, { offer_network: proofRequestModal.network, offer_payout: proofRequestModal.payout, offer_countries: proofRequestModal.countries }));
                          }
                        }}
                      />
                      <span className="text-[11px]">{f.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <Textarea value={proofRequestMsg} onChange={e => setProofRequestMsg(e.target.value)} rows={6} className="text-sm" />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setProofRequestModal(null)}>Cancel</Button>
            <Button size="sm" className="gap-1.5 bg-purple-600 hover:bg-purple-700" onClick={sendProofRequest} disabled={sendingProofReq}>
              {sendingProofReq ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Proof Viewer Modal */}
      <Dialog open={proofViewerOpen} onOpenChange={setProofViewerOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Image className="h-4 w-4 text-emerald-600" /> Placement Proofs — {pub.username}
            </DialogTitle>
          </DialogHeader>
          {loadingProofs ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : proofImages.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">No proof images found</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {proofImages.map((url, i) => (
                <img key={i} src={url} alt={`Proof ${i + 1}`}
                  className="w-full rounded-lg border object-cover max-h-[250px] cursor-pointer hover:opacity-90 hover:ring-2 hover:ring-blue-400 transition-all"
                  onClick={() => setFullscreenImg(url)}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Fullscreen Image Overlay */}
      {fullscreenImg && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center cursor-pointer" onClick={() => setFullscreenImg(null)}>
          <button className="absolute top-4 right-4 text-white bg-white/20 hover:bg-white/40 rounded-full w-10 h-10 flex items-center justify-center text-xl font-bold z-10" onClick={() => setFullscreenImg(null)}>✕</button>
          <img src={fullscreenImg} alt="Proof fullscreen" className="max-w-[95vw] max-h-[95vh] object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
