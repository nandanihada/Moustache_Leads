import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, CheckCircle, XCircle, Loader2, AlertTriangle, AlertCircle,
  TrendingUp, MousePointerClick, Target, DollarSign, ExternalLink, Calendar,
  Shield, Zap, Send, Package
} from 'lucide-react';
import { API_BASE_URL } from '@/services/apiConfig';
import { ResponsiveContainer, Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip as RTooltip } from 'recharts';
import type { PProf, PSt, Inv } from '@/pages/AdminOfferAccessRequests';
import { fd, rsk } from '@/pages/AdminOfferAccessRequests';

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
  const token = localStorage.getItem('token');
  const risk = rsk(pub.risk_level);

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
      fetch(`${API_BASE_URL}/api/admin/offer-access-requests/inventory-matches?offer_name=${encodeURIComponent(pub.latest_offer_name)}&user_id=${pub.user_id}&limit=15`, {
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
    const ids = pub.requests.filter(r => r.status === 'pending').map(r => r.request_id);
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

  const initials = ((pub.first_name?.[0] || '') + (pub.last_name?.[0] || pub.username?.[1] || '')).toUpperCase() || '??';

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
                </div>
                <Badge variant={pub.fraud_score < 30 ? 'default' : pub.fraud_score < 60 ? 'secondary' : 'destructive'} className="text-xs">
                  <Shield className="w-3 h-3 mr-1" />Fraud: {pub.fraud_score}
                </Badge>
              </div>

              {/* Pending Requests — AT TOP */}
              {pub.requests.filter(r => r.status === 'pending').length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />Pending Requests ({pub.requests.filter(r => r.status === 'pending').length})
                  </h4>
                  {pub.requests.filter(r => r.status === 'pending').map(req => (
                    <div key={req.request_id} className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-3 py-2.5 text-xs">
                      <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{req.offer_name}</p>
                        <p className="text-muted-foreground">{req.offer_network} · ${req.offer_payout.toFixed(2)} · {fd(req.requested_at)}</p>
                      </div>
                      {req.message && <span className="text-muted-foreground italic truncate max-w-[150px]">"{req.message}"</span>}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1 text-amber-600 border-amber-300 hover:bg-amber-100"
                          onClick={() => { /* mark for review */ toast.success('Marked for review'); }}>
                          <AlertTriangle className="w-3 h-3" />Review
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1 text-destructive border-red-200 hover:bg-red-50"
                          onClick={() => rejectReq(req.request_id)} disabled={rejecting === req.request_id}>
                          {rejecting === req.request_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}Reject
                        </Button>
                        <Button size="sm" className="h-7 px-2 text-[10px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => approveReq(req.request_id)} disabled={approving === req.request_id}>
                          {approving === req.request_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Good standing banner */}
              {pub.fraud_score < 40 && pub.postback_status !== 'none' && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-3 py-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Good standing</span>
                  <span className="text-xs text-emerald-600 dark:text-emerald-500">· Fraud score {pub.fraud_score} · Postback {pub.postback_status}</span>
                </div>
              )}

              {/* Inventory matches */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" />Inventory Matches
                  </h4>
                  {selectedInv.size > 0 && (
                    <Button size="sm" className="h-7 text-[10px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => onSendOffers(pub, inventory.filter(i => selectedInv.has(i.offer_id)))}>
                      <Send className="w-3 h-3" />Send {selectedInv.size} Selected
                    </Button>
                  )}
                </div>
                {loadingInv ? (
                  <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                ) : inventory.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No matching offers found</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 w-8">
                            <Checkbox
                              checked={inventory.length > 0 && selectedInv.size === inventory.length}
                              onCheckedChange={() => {
                                if (selectedInv.size === inventory.length) setSelectedInv(new Set());
                                else setSelectedInv(new Set(inventory.map(i => i.offer_id)));
                              }}
                            />
                          </th>
                          <th className="px-3 py-2 text-left font-medium">#</th>
                          <th className="px-3 py-2 text-left font-medium">Offer</th>
                          <th className="px-3 py-2 text-left font-medium">Status</th>
                          <th className="px-3 py-2 text-left font-medium">Match</th>
                          <th className="px-3 py-2 text-left font-medium">Network</th>
                          <th className="px-3 py-2 text-right font-medium">Payout</th>
                          <th className="px-3 py-2 text-left font-medium">Keywords</th>
                          <th className="px-3 py-2 text-center font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {inventory.map((inv, i) => (
                          <tr key={inv._id} className={`hover:bg-muted/30 transition-colors ${selectedInv.has(inv.offer_id) ? 'bg-emerald-50 dark:bg-emerald-950/20' : ''}`}>
                            <td className="px-3 py-2">
                              <Checkbox
                                checked={selectedInv.has(inv.offer_id)}
                                onCheckedChange={() => setSelectedInv(prev => { const n = new Set(prev); n.has(inv.offer_id) ? n.delete(inv.offer_id) : n.add(inv.offer_id); return n; })}
                              />
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                            <td className="px-3 py-2 font-medium max-w-[180px] truncate">{inv.name}</td>
                            <td className="px-3 py-2">
                              {inv.request_status ? (
                                <Badge variant={inv.request_status === 'approved' ? 'default' : inv.request_status === 'pending' ? 'secondary' : 'outline'} className="text-[10px]">
                                  {inv.request_status}
                                </Badge>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-3 py-2">
                              <Badge variant={inv.match_strength === 'Strong' ? 'default' : 'secondary'}
                                className={`text-[10px] ${inv.match_strength === 'Strong' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : ''}`}>
                                {inv.match_strength}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{inv.network}</td>
                            <td className="px-3 py-2 text-right font-mono">${inv.payout.toFixed(2)}</td>
                            <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">{inv.keywords || '—'}</td>
                            <td className="px-3 py-2 text-center">
                              <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] gap-1"
                                onClick={() => onSendOffers(pub, [inv])}>
                                Send <ExternalLink className="w-3 h-3" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

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
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={bulkApprove} disabled={bulkApproving || pub.requests.filter(r => r.status === 'pending').length === 0}>
                  {bulkApproving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  Approve All ({pub.requests.filter(r => r.status === 'pending').length})
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50"
                  onClick={() => toast.success('Marked for review')}>
                  <AlertTriangle className="w-3.5 h-3.5" />Mark for Review
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
    </div>
  );
}
