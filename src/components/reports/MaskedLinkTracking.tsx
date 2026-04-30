/**
 * MaskedLinkTracking — Full tracking with columns & filters
 */
import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Link2, Search, RefreshCw, ChevronLeft, ChevronRight, ExternalLink,
  MousePointerClick, Copy, Eye, Globe, Monitor, Clock, FileSearch,
  User, Mail, Calendar, Filter, BarChart3, Send,
} from 'lucide-react';
import { API_BASE_URL } from '@/services/apiConfig';

const fmtDate = (d: string) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return d; }
};
const parseUA = (ua: string) => {
  if (!ua) return 'Unknown';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS Safari';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Edg')) return 'Edge';
  return ua.substring(0, 20) + '…';
};
const parseLang = (lang: string) => {
  if (!lang) return '—';
  const f = lang.split(',')[0].split(';')[0].trim();
  const m: Record<string, string> = { 'en-US': '🇺🇸 US', 'en-GB': '🇬🇧 UK', 'en-IN': '🇮🇳 IN', 'en': '🌐 EN', 'hi': '🇮🇳 HI', 'de': '🇩🇪 DE', 'fr': '🇫🇷 FR', 'es': '🇪🇸 ES' };
  return m[f] || f;
};

export function MaskedLinkTracking() {
  const [tab, setTab] = useState<'links' | 'see_more'>('links');
  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        <button onClick={() => setTab('links')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'links' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}><Link2 className="h-4 w-4" />Masked Links</button>
        <button onClick={() => setTab('see_more')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'see_more' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}><FileSearch className="h-4 w-4" />See More Clicks</button>
      </div>
      {tab === 'links' ? <MaskedLinksTab /> : <SeeMoreClicksTab />}
    </div>
  );
}


// ══════════════════════════════════════════
// MASKED LINKS TAB — with email, location, when sent/clicked, filters
// ══════════════════════════════════════════
function MaskedLinksTab() {
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  // Click details
  const [selectedLink, setSelectedLink] = useState<any | null>(null);
  const [clicks, setClicks] = useState<any[]>([]);
  const [clicksLoading, setClicksLoading] = useState(false);
  const [clicksTotal, setClicksTotal] = useState(0);
  const [uniqueClicks, setUniqueClicks] = useState(0);
  const [sentToEmails, setSentToEmails] = useState<string[]>([]);
  const [sentToUsernames, setSentToUsernames] = useState<string[]>([]);
  const [clicksPage, setClicksPage] = useState(1);
  const [clicksTotalPages, setClicksTotalPages] = useState(1);
  const [clickSearch, setClickSearch] = useState('');
  const [clickUnique, setClickUnique] = useState(false);
  const token = localStorage.getItem('token');

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), per_page: '20' });
      if (search) p.set('search', search);
      const res = await fetch(`${API_BASE_URL}/api/admin/masked-links?${p}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setLinks(d.links || []); setTotal(d.total || 0); setTotalPages(d.pagination?.pages || 1);
    } catch { toast.error('Failed to load'); } finally { setLoading(false); }
  }, [page, search, token]);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);

  const fetchClicks = useCallback(async (linkId: string, pg = 1) => {
    setClicksLoading(true);
    try {
      const p = new URLSearchParams({ page: String(pg), per_page: '30' });
      if (clickSearch) p.set('search', clickSearch);
      if (clickUnique) p.set('unique', 'true');
      const res = await fetch(`${API_BASE_URL}/api/admin/masked-link-clicks/${linkId}?${p}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setClicks(d.clicks || []); setClicksTotal(d.total || 0); setUniqueClicks(d.unique_clicks || 0);
      setSentToEmails(d.sent_to_emails || []); setSentToUsernames(d.sent_to_usernames || []);
      setClicksTotalPages(d.pagination?.pages || 1); setClicksPage(pg);
    } catch { toast.error('Failed'); } finally { setClicksLoading(false); }
  }, [clickSearch, clickUnique, token]);

  const openDetails = (link: any) => { setSelectedLink(link); setClickSearch(''); setClickUnique(false); fetchClicks(link.link_id, 1); };
  const copyUrl = async (url: string) => { try { await navigator.clipboard.writeText(url); } catch {} toast.success('Copied!'); };

  return (
    <div className="space-y-4">
      {/* Header + Filters */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Link2 className="h-5 w-5 text-indigo-600" />Masked Links</h2>
          <p className="text-sm text-muted-foreground">{total} links</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search offer, URL, email, user..." className="pl-8 h-8 w-60 text-xs" />
          </div>
          <Button variant="outline" size="sm" onClick={fetchLinks} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /></Button>
        </div>
      </div>

      {/* Links Table */}
      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Offer</TableHead>
              <TableHead className="text-xs"><Mail className="h-3 w-3 inline mr-1" />Email</TableHead>
              <TableHead className="text-xs">Masked URL</TableHead>
              <TableHead className="text-xs text-center">Clicks</TableHead>
              <TableHead className="text-xs"><Send className="h-3 w-3 inline mr-1" />When Sent</TableHead>
              <TableHead className="text-xs"><Clock className="h-3 w-3 inline mr-1" />Last Click</TableHead>
              <TableHead className="text-xs"><Globe className="h-3 w-3 inline mr-1" />Location</TableHead>
              <TableHead className="text-xs">By</TableHead>
              <TableHead className="text-xs w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {links.length === 0 && !loading && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No masked links yet</TableCell></TableRow>}
            {links.map((l: any) => (
              <TableRow key={l.link_id} className="hover:bg-muted/50">
                <TableCell className="text-xs"><p className="font-medium truncate max-w-[120px]">{l.offer_name || '—'}</p><p className="text-[10px] text-muted-foreground font-mono">{l.offer_id}</p></TableCell>
                <TableCell className="text-xs">
                  {(l.sent_to_emails || []).length > 0 ? (
                    <div>
                      {(l.sent_to_usernames || []).length > 0 && <p className="font-medium text-blue-600 truncate max-w-[100px]">{(l.sent_to_usernames || []).slice(0, 2).join(', ')}</p>}
                      <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{(l.sent_to_emails || [])[0]}</p>
                      {(l.sent_to_emails || []).length > 1 && <p className="text-[9px] text-muted-foreground">+{(l.sent_to_emails || []).length - 1} more</p>}
                    </div>
                  ) : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-xs"><div className="flex items-center gap-1"><code className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded truncate max-w-[130px]">{l.masked_url}</code><button onClick={() => copyUrl(l.masked_url)} className="text-muted-foreground hover:text-foreground"><Copy className="h-3 w-3" /></button></div></TableCell>
                <TableCell className="text-center"><Badge variant={l.click_count > 0 ? 'default' : 'secondary'} className="text-[10px]">{l.click_count}</Badge></TableCell>
                <TableCell className="text-[10px] text-muted-foreground whitespace-nowrap">{fmtDate(l.created_at)}</TableCell>
                <TableCell className="text-[10px] text-muted-foreground whitespace-nowrap">{l.last_clicked_at ? fmtDate(l.last_clicked_at) : '—'}</TableCell>
                <TableCell className="text-[11px]">{parseLang(l.accept_language || '')}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{l.created_by}</TableCell>
                <TableCell><Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => openDetails(l)} disabled={l.click_count === 0}><Eye className="h-3 w-3" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {totalPages > 1 && <div className="flex items-center justify-center gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button><span className="text-sm text-muted-foreground">{page}/{totalPages}</span><Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button></div>}

      {/* Click Details Dialog */}
      <Dialog open={!!selectedLink} onOpenChange={v => { if (!v) setSelectedLink(null); }}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MousePointerClick className="h-4 w-4 text-indigo-600" />Click Details <Badge variant="secondary" className="text-xs">{clicksTotal} total</Badge><Badge variant="outline" className="text-xs">{uniqueClicks} unique</Badge></DialogTitle>
          </DialogHeader>
          {selectedLink && (
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-lg p-3">
                <span className="font-medium text-sm">{selectedLink.offer_name || selectedLink.offer_id}</span>
                <div className="flex items-center gap-2 mt-0.5"><code className="text-xs text-indigo-600">{selectedLink.masked_url}</code><span className="text-xs text-muted-foreground">→</span><a href={selectedLink.original_url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-foreground">{(selectedLink.original_url || '').substring(0, 40)}…</a></div>
              </div>

              {/* Sent To */}
              {(sentToEmails.length > 0 || sentToUsernames.length > 0) && (
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2"><Mail className="h-4 w-4 text-blue-600" /><span className="text-xs font-semibold text-blue-800 dark:text-blue-200">Sent To ({sentToEmails.length})</span></div>
                  <div className="flex flex-wrap gap-2">
                    {sentToUsernames.map((u, i) => (
                      <div key={i} className="flex items-center gap-1.5 bg-white dark:bg-gray-800 rounded-md px-2.5 py-1 border text-xs">
                        <User className="h-3 w-3 text-blue-500" /><span className="font-medium">{u}</span>
                        {sentToEmails[i] && <span className="text-muted-foreground text-[10px]">({sentToEmails[i]})</span>}
                      </div>
                    ))}
                    {sentToEmails.slice(sentToUsernames.length).map((e, i) => (
                      <div key={`e-${i}`} className="flex items-center gap-1.5 bg-white dark:bg-gray-800 rounded-md px-2.5 py-1 border text-xs"><Mail className="h-3 w-3 text-blue-500" /><span>{e}</span></div>
                    ))}
                  </div>
                </div>
              )}

              {/* Filters */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input value={clickSearch} onChange={e => setClickSearch(e.target.value)} placeholder="Search IP, user agent, email..." className="pl-8 h-8 text-xs" /></div>
                <div className="flex items-center gap-2"><Switch checked={clickUnique} onCheckedChange={setClickUnique} id="u-toggle" /><Label htmlFor="u-toggle" className="text-xs">Unique</Label></div>
                <Button size="sm" variant="outline" onClick={() => fetchClicks(selectedLink.link_id, 1)} className="h-8 text-xs gap-1"><Filter className="h-3 w-3" />Apply</Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs"><Clock className="h-3 w-3 inline mr-1" />Clicked At</TableHead>
                    <TableHead className="text-xs"><Globe className="h-3 w-3 inline mr-1" />IP</TableHead>
                    <TableHead className="text-xs"><Monitor className="h-3 w-3 inline mr-1" />Browser</TableHead>
                    <TableHead className="text-xs"><Globe className="h-3 w-3 inline mr-1" />Location</TableHead>
                    <TableHead className="text-xs">Referer</TableHead>
                    <TableHead className="text-xs">Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clicksLoading ? <TableRow><TableCell colSpan={6} className="text-center py-6"><RefreshCw className="h-4 w-4 animate-spin inline mr-2" />Loading...</TableCell></TableRow>
                  : clicks.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No clicks</TableCell></TableRow>
                  : clicks.map((c: any) => (
                    <TableRow key={c._id}>
                      <TableCell className="text-[11px] whitespace-nowrap">{fmtDate(c.clicked_at)}</TableCell>
                      <TableCell className="text-[11px] font-mono">{c.ip || '—'}</TableCell>
                      <TableCell className="text-[11px]">{parseUA(c.user_agent)}</TableCell>
                      <TableCell className="text-[11px]">{parseLang(c.accept_language)}</TableCell>
                      <TableCell className="text-[11px] max-w-[120px] truncate">{c.referer || 'Direct'}</TableCell>
                      <TableCell className="text-[10px]"><Badge variant="outline" className="text-[9px]">{c.link_source || 'masked'}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {clicksTotalPages > 1 && <div className="flex items-center justify-center gap-2"><Button size="sm" variant="outline" disabled={clicksPage <= 1} onClick={() => fetchClicks(selectedLink.link_id, clicksPage - 1)}><ChevronLeft className="h-3.5 w-3.5" /></Button><span className="text-xs text-muted-foreground">{clicksPage}/{clicksTotalPages}</span><Button size="sm" variant="outline" disabled={clicksPage >= clicksTotalPages} onClick={() => fetchClicks(selectedLink.link_id, clicksPage + 1)}><ChevronRight className="h-3.5 w-3.5" /></Button></div>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


// ══════════════════════════════════════════
// SEE MORE CLICKS TAB — with user, when sent, filters
// ══════════════════════════════════════════
function SeeMoreClicksTab() {
  const [clicks, setClicks] = useState<any[]>([]);
  const [summary, setSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [uniqueOnly, setUniqueOnly] = useState(false);
  const [days, setDays] = useState('30');
  const token = localStorage.getItem('token');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), per_page: '30', days });
      if (search) p.set('search', search);
      if (uniqueOnly) p.set('unique', 'true');
      const res = await fetch(`${API_BASE_URL}/api/admin/see-more-clicks?${p}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setClicks(d.clicks || []); setSummary(d.summary || []); setTotal(d.total || 0); setTotalPages(d.pagination?.pages || 1);
    } catch { toast.error('Failed to load'); } finally { setLoading(false); }
  }, [page, search, uniqueOnly, days, token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-4">
      {/* Header + Filters */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><FileSearch className="h-5 w-5 text-amber-600" />See More Page Clicks</h2>
          <p className="text-sm text-muted-foreground">{total} total views</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search user, email, IP, offer..." className="pl-8 h-8 w-56 text-xs" /></div>
          <Select value={days} onValueChange={v => { setDays(v); setPage(1); }}>
            <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7d</SelectItem>
              <SelectItem value="14">Last 14d</SelectItem>
              <SelectItem value="30">Last 30d</SelectItem>
              <SelectItem value="90">Last 90d</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5"><Switch checked={uniqueOnly} onCheckedChange={v => { setUniqueOnly(v); setPage(1); }} id="sm-u" /><Label htmlFor="sm-u" className="text-xs">Unique</Label></div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /></Button>
        </div>
      </div>

      {/* Summary cards */}
      {summary.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {summary.slice(0, 12).map((s: any) => (
            <Card key={s.offer_id} className="p-3">
              <p className="text-xs font-medium truncate">{s.offer_name || s.offer_id}</p>
              <div className="flex items-center gap-3 mt-1">
                <div><span className="text-lg font-bold">{s.total_views}</span><span className="text-[10px] text-muted-foreground ml-1">views</span></div>
                <div><span className="text-sm font-semibold text-blue-600">{s.unique_visitors}</span><span className="text-[10px] text-muted-foreground ml-1">unique</span></div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Clicks table */}
      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Offer</TableHead>
              <TableHead className="text-xs"><User className="h-3 w-3 inline mr-1" />User</TableHead>
              <TableHead className="text-xs"><Mail className="h-3 w-3 inline mr-1" />Email</TableHead>
              <TableHead className="text-xs"><Clock className="h-3 w-3 inline mr-1" />Clicked At</TableHead>
              <TableHead className="text-xs"><Globe className="h-3 w-3 inline mr-1" />IP</TableHead>
              <TableHead className="text-xs"><Monitor className="h-3 w-3 inline mr-1" />Browser</TableHead>
              <TableHead className="text-xs"><Globe className="h-3 w-3 inline mr-1" />Location</TableHead>
              <TableHead className="text-xs">Referer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={8} className="text-center py-8"><RefreshCw className="h-4 w-4 animate-spin inline mr-2" />Loading...</TableCell></TableRow>
            : clicks.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No clicks yet</TableCell></TableRow>
            : clicks.map((c: any) => (
              <TableRow key={c._id}>
                <TableCell className="text-xs"><p className="font-medium truncate max-w-[100px]">{c.offer_name || '—'}</p><p className="text-[10px] text-muted-foreground font-mono">{c.offer_id}</p></TableCell>
                <TableCell className="text-xs">
                  {(c.sent_to_usernames || []).length > 0 ? (
                    <span className="font-medium text-blue-600">{(c.sent_to_usernames || []).join(', ')}</span>
                  ) : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-xs">
                  {(c.sent_to_emails || []).length > 0 ? (
                    <p className="text-[10px] text-muted-foreground truncate max-w-[130px]">{(c.sent_to_emails || [])[0]}{(c.sent_to_emails || []).length > 1 ? ` +${(c.sent_to_emails || []).length - 1}` : ''}</p>
                  ) : c.recipient_email ? (
                    <p className="text-[10px] text-muted-foreground truncate max-w-[130px]">{c.recipient_email}</p>
                  ) : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-[11px] whitespace-nowrap">{fmtDate(c.clicked_at)}</TableCell>
                <TableCell className="text-[11px] font-mono">{c.ip || '—'}</TableCell>
                <TableCell className="text-[11px]">{parseUA(c.user_agent)}</TableCell>
                <TableCell className="text-[11px]">{parseLang(c.accept_language)}</TableCell>
                <TableCell className="text-[11px] max-w-[100px] truncate">{c.referer || 'Direct'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {totalPages > 1 && <div className="flex items-center justify-center gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button><span className="text-sm text-muted-foreground">{page}/{totalPages}</span><Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button></div>}
    </div>
  );
}
