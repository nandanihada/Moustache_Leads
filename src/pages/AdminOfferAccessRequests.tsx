import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Users, AlertTriangle, AlertCircle, Zap, Sparkles, RefreshCw, Mail, MessageSquare, ChevronDown, Clock, CheckCircle2, XCircle, Send, Inbox } from 'lucide-react';
import { API_BASE_URL } from '@/services/apiConfig';
import { AdminPageGuard } from '@/components/AdminPageGuard';
import PublisherRow from '@/pages/offer-requests/PublisherRow';
import SendOffersModal from '@/pages/offer-requests/SendOffersModal';
import BulkMessageModal from '@/pages/offer-requests/BulkMessageModal';

export interface OReq {
  _id: string; request_id: string; offer_id: string; offer_name: string; offer_payout: number;
  offer_network: string; offer_category?: string; offer_status?: string; offer_countries?: string[];
  status: 'pending' | 'approved' | 'rejected' | 'review'; requested_at: string; message: string;
  clicks: number; conversions: number; conv_rate: number; last_conversion: string | null;
  request_count?: number;
  offer_stats?: { total_requests?: number; approved_count?: number; rejected_count?: number; pending_count?: number; total_clicks?: number };
  offer_health?: { status: string; failures: { criterion: string; description: string }[] };
}
export interface PProf {
  user_id: string; username: string; email: string; first_name: string; last_name: string;
  company_name: string; website: string; created_at: string; account_status: string;
  risk_level: 'high_risk' | 'warn' | 'new' | 'none'; fraud_score: number;
  total_clicks: number; total_conversions: number; conversion_rate: number;
  postback_url: string; postback_tested: boolean; postback_status: 'tested' | 'configured' | 'none';
  has_proofs: boolean; requests: OReq[]; pending_count: number;
  latest_offer_name: string; latest_offer_id: string;
}
export interface PSt {
  daily_stats: { date: string; clicks: number; conversions: number }[];
  traffic_sources: { name: string; type: string; clicks: number; conversions: number; conv_rate: number }[];
  totals: { clicks: number; conversions: number; conversion_rate: number; earnings: number; epc: number };
  offer_views?: { offer_id: string; offer_name: string; view_count: number; last_viewed?: string }[];
}
export interface Inv {
  _id: string; offer_id: string; name: string; payout: number; network: string;
  category: string; keywords: string; match_strength: 'Strong' | 'Good'; request_status: string | null;
}
export const fd = (d: string) => {
  if (!d) return '\u2014';
  const x = Math.floor((Date.now() - new Date(d).getTime()) / 864e5);
  if (!x) return 'today'; if (x === 1) return 'yesterday';
  if (x < 30) return x + 'd ago'; if (x < 365) return Math.floor(x / 30) + 'mo ago';
  return Math.floor(x / 365) + 'y ago';
};
export const rsk = (r: string) => {
  if (r === 'high_risk') return { bg: 'bg-gradient-to-r from-red-500 to-rose-500', t: 'text-white', bd: 'bg-red-100 text-red-700 border-red-200', lb: 'HIGH RISK' };
  if (r === 'warn') return { bg: 'bg-gradient-to-r from-amber-400 to-orange-400', t: 'text-white', bd: 'bg-amber-100 text-amber-700 border-amber-200', lb: 'WARNING' };
  if (r === 'new') return { bg: 'bg-gradient-to-r from-blue-400 to-indigo-400', t: 'text-white', bd: 'bg-blue-100 text-blue-700 border-blue-200', lb: 'NEW' };
  return { bg: 'bg-gradient-to-r from-gray-100 to-gray-200', t: 'text-gray-700', bd: '', lb: '' };
};
const FILTERS = [
  { key: 'all', label: 'All', ac: 'bg-gray-800 text-white', inac: '' },
  { key: 'high_risk', label: 'High Risk', ac: 'bg-red-500 hover:bg-red-600 text-white', inac: 'text-red-600 border-red-200 hover:bg-red-50' },
  { key: 'warn', label: 'Warning', ac: 'bg-amber-500 hover:bg-amber-600 text-white', inac: 'text-amber-600 border-amber-200 hover:bg-amber-50' },
  { key: 'new', label: 'New', ac: 'bg-blue-500 hover:bg-blue-600 text-white', inac: 'text-blue-600 border-blue-200 hover:bg-blue-50' },
  { key: 'none', label: 'Safe', ac: 'bg-emerald-500 hover:bg-emerald-600 text-white', inac: 'text-emerald-600 border-emerald-200 hover:bg-emerald-50' },
];
interface DStats { pending_total: number; approved_total: number; approved_24h: number; rejected_total: number; rejected_24h: number; requested_total: number; requested_24h: number; mails_sent_total: number; mails_sent_24h: number; support_sent_total: number; support_sent_24h: number; }
function Main() {
  const [profiles, setProfiles] = useState<PProf[]>([]);
  const [loading, setLoading] = useState(true);
  const [pag, setPag] = useState({ page: 1, total: 0, pages: 1 });
  const [perPage, setPerPage] = useState(20);
  const [sum, setSum] = useState({ total_publishers: 0, high_risk: 0, warn: 0, new: 0, none: 0 });
  const [risk, setRisk] = useState('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sendPub, setSendPub] = useState<PProf | null>(null);
  const [sendOffers, setSendOffers] = useState<Inv[] | undefined>(undefined);
  const [bulkModal, setBulkModal] = useState<{ open: boolean; mode: 'email' | 'support' }>({ open: false, mode: 'email' });
  const [showMore, setShowMore] = useState(false);
  const [ds, setDs] = useState<DStats | null>(null);
  const tk = localStorage.getItem('token');
  const fetchP = async () => {
    try { setLoading(true);
      const p = new URLSearchParams({ status: 'pending', risk, search, page: String(pag.page), per_page: String(perPage) });
      const r = await fetch(API_BASE_URL + '/api/admin/offer-access-requests/publisher-profiles?' + p, { headers: { Authorization: 'Bearer ' + tk } });
      if (!r.ok) throw new Error(); const d = await r.json();
      setProfiles(d.profiles || []); setPag(d.pagination || { page: 1, total: 0, pages: 1 }); setSum(d.summary || sum);
    } catch { toast.error('Failed to load'); } finally { setLoading(false); }
  };
  useEffect(() => { fetchP(); }, [risk, search, pag.page, perPage]);
  useEffect(() => { fetch(API_BASE_URL + '/api/admin/offer-access-requests/stats', { headers: { Authorization: 'Bearer ' + tk } }).then(r => r.json()).then(d => setDs(d)).catch(() => {}); }, []);
  if (loading && !profiles.length) return (<div className="flex items-center justify-center h-64"><div className="flex flex-col items-center gap-3"><div className="relative"><div className="w-12 h-12 rounded-full border-4 border-gray-200 border-t-emerald-500 animate-spin" /><Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500" /></div><p className="text-sm text-gray-500">Loading...</p></div></div>);
  const topCards = [
    { label: 'Total', value: sum.total_publishers, icon: Users, cls: 'text-emerald-100' },
    { label: 'High Risk', value: sum.high_risk, icon: AlertTriangle, cls: 'text-red-200' },
    { label: 'Warning', value: sum.warn, icon: AlertCircle, cls: 'text-yellow-200' },
    { label: 'New', value: sum.new, icon: Zap, cls: 'text-blue-200' },
  ];
  const moreCards = ds ? [
    { label: 'Pending', value: ds.pending_total, icon: Clock, color: 'text-amber-200' },
    { label: 'Approved (24h)', value: ds.approved_24h, icon: CheckCircle2, color: 'text-emerald-200' },
    { label: 'Approved Total', value: ds.approved_total, icon: CheckCircle2, color: 'text-emerald-200' },
    { label: 'New Requests (24h)', value: ds.requested_24h, icon: Inbox, color: 'text-blue-200' },
    { label: 'Total Requested', value: ds.requested_total, icon: Inbox, color: 'text-blue-200' },
    { label: 'Rejected', value: ds.rejected_total, sub: ds.rejected_24h + ' in 24h', icon: XCircle, color: 'text-red-200' },
    { label: 'Mails Sent', value: ds.mails_sent_total, sub: ds.mails_sent_24h + ' in 24h', icon: Send, color: 'text-cyan-200' },
    { label: 'Support Msgs', value: ds.support_sent_total, sub: ds.support_sent_24h + ' in 24h', icon: MessageSquare, color: 'text-purple-200' },
  ] : [];
  return (
    <div className="space-y-6 p-1">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 p-6 text-white shadow-xl">
        <div className="relative flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-7 w-7" />Publisher Profiles</h1>
            <p className="text-emerald-100 mt-1">Review and manage publisher access requests</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" className="bg-white/20 hover:bg-white/30 text-white border-0" onClick={() => setShowMore(!showMore)}>
              <ChevronDown className={'h-4 w-4 mr-1 transition-transform ' + (showMore ? 'rotate-180' : '')} />{showMore ? 'Less' : 'More Stats'}
            </Button>
            <Button variant="secondary" size="sm" className="bg-white/20 hover:bg-white/30 text-white border-0" onClick={fetchP}>
              <RefreshCw className="h-4 w-4 mr-1" />Refresh
            </Button>
          </div>
        </div>
        <div className="relative mt-6 grid grid-cols-4 gap-4">
          {topCards.map(s => (
            <div key={s.label} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className={'flex items-center gap-2 ' + s.cls + ' text-sm'}><s.icon className="h-4 w-4" />{s.label}</div>
              <div className={'text-3xl font-bold mt-1 ' + s.cls}>{s.value}</div>
            </div>
          ))}
        </div>
        {showMore && moreCards.length > 0 && (
          <div className="relative mt-4 grid grid-cols-4 gap-3">
            {moreCards.map(c => (
              <div key={c.label} className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                <div className={'flex items-center gap-1.5 ' + c.color + ' text-xs'}><c.icon className="h-3.5 w-3.5" />{c.label}</div>
                <div className={'text-xl font-bold mt-0.5 ' + c.color}>{c.value ?? 0}</div>
                {'sub' in c && c.sub && <div className="text-[10px] text-white/60 mt-0.5">{c.sub}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
      <Card className="p-4 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Search publishers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10 bg-gray-50" />
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Risk</span>
          {FILTERS.map(f => (<Button key={f.key} variant={risk === f.key ? 'default' : 'outline'} size="sm" onClick={() => setRisk(f.key)} className={'h-8 text-xs font-medium ' + (risk === f.key ? f.ac : f.inac)}>{f.label}</Button>))}
          {selected.size > 0 && (<><div className="h-8 w-px bg-gray-200" /><Badge variant="secondary" className="bg-emerald-100 text-emerald-700">{selected.size} selected</Badge><Button size="sm" variant="outline" className="h-8 text-xs text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => setBulkModal({ open: true, mode: 'support' })}><MessageSquare className="h-3 w-3 mr-1" />Support</Button><Button size="sm" variant="outline" className="h-8 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={() => setBulkModal({ open: true, mode: 'email' })}><Mail className="h-3 w-3 mr-1" />Mail</Button><Button size="sm" variant="ghost" className="h-8 text-xs text-gray-500" onClick={() => setSelected(new Set())}>Clear</Button></>)}
        </div>
      </Card>
      <div className="space-y-3">
        <AnimatePresence>
          {profiles.map((p, i) => (<motion.div key={p.user_id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}><PublisherRow pub={p} isExpanded={expanded.has(p.user_id)} isSelected={selected.has(p.user_id)} onToggleExpand={() => setExpanded(prev => { const n = new Set(prev); n.has(p.user_id) ? n.delete(p.user_id) : n.add(p.user_id); return n; })} onToggleSelect={() => setSelected(prev => { const n = new Set(prev); n.has(p.user_id) ? n.delete(p.user_id) : n.add(p.user_id); return n; })} onSendOffers={(pub, offers) => { setSendPub(pub); setSendOffers(offers); }} onRefreshList={fetchP} /></motion.div>))}
        </AnimatePresence>
        {!profiles.length && !loading && (<Card className="p-12 text-center"><Users className="h-8 w-8 text-gray-400 mx-auto mb-2" /><p className="font-medium text-gray-900">No publishers found</p></Card>)}
      </div>
      <div className="flex items-center justify-between pt-2 pb-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">Page {pag.page} of {pag.pages} ({pag.total} publishers)</span>
          <Select value={String(perPage)} onValueChange={v => { setPerPage(Number(v)); setPag(prev => ({ ...prev, page: 1 })); }}>
            <SelectTrigger className="w-28 h-9 text-xs border-gray-300"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="20">20 / page</SelectItem><SelectItem value="50">50 / page</SelectItem><SelectItem value="100">100 / page</SelectItem><SelectItem value="200">200 / page</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPag(prev => ({ ...prev, page: prev.page - 1 }))} disabled={pag.page <= 1}>Previous</Button>
          <Button variant="outline" size="sm" onClick={() => setPag(prev => ({ ...prev, page: prev.page + 1 }))} disabled={pag.page >= pag.pages}>Next</Button>
        </div>
      </div>
      <SendOffersModal open={!!sendPub} onClose={() => { setSendPub(null); setSendOffers(undefined); }} publisher={sendPub} preselectedOffers={sendOffers} />
      <BulkMessageModal open={bulkModal.open} onClose={() => setBulkModal({ open: false, mode: 'email' })} publishers={profiles.filter(p => selected.has(p.user_id))} defaultMode={bulkModal.mode} />
    </div>
  );
}
export default function AdminOfferAccessRequestsPage() { return <AdminPageGuard requiredTab="offer-access-requests"><Main /></AdminPageGuard>; }
