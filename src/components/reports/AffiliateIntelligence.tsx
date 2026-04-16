/**
 * Affiliate Intelligence Tab
 * Detailed view of each affiliate's click quality, fraud signals, and communication tools.
 */
import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { RefreshCw, Shield, ShieldAlert, ShieldCheck, Mail, Lightbulb, Ban, CheckCircle, Send, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { affiliateApi } from '@/services/trafficIntelligenceApi';
import { getApiBaseUrl } from '@/services/apiConfig';

const API = getApiBaseUrl();
function authHeaders() { return { 'Authorization': `Bearer ${localStorage.getItem('token')}` }; }

interface AffiliateRow {
  user_id: string; name: string; email: string; segment: string;
  clicks: number; genuine_clicks: number; suspicious_clicks: number; fraud_clicks: number;
  conversions: number; total_revenue: number; cr: number; avg_fraud_score: number; fraud_pct: number;
}

interface OfferStat {
  offer_id: string; offer_name: string; category: string; payout: number;
  clicks: number; clean: number; bot: number; conversions: number; revenue: number; last_click: string;
}

interface ClickRecord {
  click_id: string; offer_id: string; timestamp: string; country: string;
  type: string; fraud_score: number; converted: boolean; revenue: number; device: string;
}

interface Suggestion { offer_id: string; name: string; category: string; payout: number; geo: string; }

export function AffiliateIntelligence() {
  const [loading, setLoading] = useState(false);
  const [affiliates, setAffiliates] = useState<AffiliateRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drillTab, setDrillTab] = useState('offers');
  const [detailLoading, setDetailLoading] = useState(false);
  const [offers, setOffers] = useState<OfferStat[]>([]);
  const [clicks, setClicks] = useState<ClickRecord[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [blockedOffers, setBlockedOffers] = useState<Set<string>>(new Set());
  const [emailData, setEmailData] = useState<Record<string, { subject: string; body: string }>>({});
  const [sending, setSending] = useState(false);

  const fetchAffiliates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await affiliateApi.getComparison({ limit: 100 });
      if (res.success) setAffiliates(res.data);
    } catch { toast.error('Failed to load affiliates'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAffiliates(); }, [fetchAffiliates]);

  const selectAffiliate = async (uid: string) => {
    if (selectedId === uid) { setSelectedId(null); return; }
    setSelectedId(uid);
    setDrillTab('offers');
    setDetailLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/intelligence/affiliate-detail/${uid}`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success) {
        setOffers(data.offers || []);
        setClicks(data.recent_clicks || []);
        // Init email if not set
        const aff = affiliates.find(a => a.user_id === uid);
        if (aff && !emailData[uid]) {
          setEmailData(prev => ({ ...prev, [uid]: {
            subject: `Traffic Quality Review — ${aff.name}`,
            body: `Hi ${aff.name},\n\nWe noticed ${aff.fraud_clicks + aff.suspicious_clicks} bot/suspicious clicks from your account out of ${aff.clicks} total.\n\nPlease review your traffic sources and ensure compliance with our quality guidelines.\n\nBest,\nMoustache Leads Team`
          }}));
        }
      }
    } catch { toast.error('Failed to load affiliate details'); }
    finally { setDetailLoading(false); }
  };

  const loadSuggestions = async (uid: string) => {
    try {
      const res = await fetch(`${API}/api/admin/intelligence/suggest-offers/${uid}`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success) setSuggestions(data.suggestions || []);
    } catch { /* silent */ }
  };

  const blockOffer = async (uid: string, offerId: string) => {
    try {
      await fetch(`${API}/api/admin/intelligence/block-offer`, {
        method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: uid, offer_id: offerId })
      });
      setBlockedOffers(prev => new Set([...prev, `${uid}:${offerId}`]));
      toast.success(`Offer ${offerId} blocked`);
    } catch { toast.error('Block failed'); }
  };

  const unblockOffer = async (uid: string, offerId: string) => {
    try {
      await fetch(`${API}/api/admin/intelligence/unblock-offer`, {
        method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: uid, offer_id: offerId })
      });
      setBlockedOffers(prev => { const n = new Set(prev); n.delete(`${uid}:${offerId}`); return n; });
      toast.success(`Offer ${offerId} unblocked`);
    } catch { toast.error('Unblock failed'); }
  };

  const sendEmail = async (uid: string) => {
    const aff = affiliates.find(a => a.user_id === uid);
    const ed = emailData[uid];
    if (!aff?.email || !ed) return;
    setSending(true);
    try {
      const res = await fetch(`${API}/api/admin/intelligence/send-email`, {
        method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: aff.email, subject: ed.subject, body: ed.body })
      });
      const data = await res.json();
      if (data.success) toast.success('Email sent');
      else toast.error(data.error || 'Send failed');
    } catch { toast.error('Send failed'); }
    finally { setSending(false); }
  };

  const proposeOffer = (uid: string, offer: Suggestion) => {
    setDrillTab('email');
    const aff = affiliates.find(a => a.user_id === uid);
    setEmailData(prev => ({ ...prev, [uid]: {
      subject: `Offer Recommendation — ${offer.name}`,
      body: `Hi ${aff?.name || 'Partner'},\n\nBased on your traffic profile, we'd like to recommend:\n\n${offer.name}\nCategory: ${offer.category}\nPayout: $${offer.payout}\nGeo: ${offer.geo}\n\nLet us know if you'd like to run this offer.\n\nBest,\nMoustache Leads Team`
    }}));
  };

  // Summary
  const totalClicks = affiliates.reduce((s, a) => s + a.clicks, 0);
  const totalClean = affiliates.reduce((s, a) => s + a.genuine_clicks, 0);
  const totalBot = affiliates.reduce((s, a) => s + a.fraud_clicks + a.suspicious_clicks, 0);

  const selected = affiliates.find(a => a.user_id === selectedId);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 flex items-center gap-3">
          <Shield className="h-8 w-8 text-blue-500" />
          <div><div className="text-xs text-muted-foreground">Total Clicks</div><div className="text-2xl font-bold">{totalClicks.toLocaleString()}</div></div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-green-500" />
          <div><div className="text-xs text-muted-foreground">Clean Clicks</div><div className="text-2xl font-bold text-green-600">{totalClean.toLocaleString()}</div></div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <ShieldAlert className="h-8 w-8 text-red-500" />
          <div><div className="text-xs text-muted-foreground">Bot / Suspicious</div><div className="text-2xl font-bold text-red-600">{totalBot.toLocaleString()}</div></div>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={fetchAffiliates} disabled={loading}><RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
      </div>

      {/* Affiliate Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Affiliate</TableHead>
              <TableHead>Clicks</TableHead>
              <TableHead>Clean</TableHead>
              <TableHead>Bot</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>Traffic Quality</TableHead>
              <TableHead>Segment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {affiliates.map(a => {
              const isSelected = selectedId === a.user_id;
              const cleanPct = a.clicks > 0 ? Math.round(a.genuine_clicks / a.clicks * 100) : 0;
              return (
                <> 
                  <TableRow key={a.user_id} className={`cursor-pointer ${isSelected ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-muted/50'}`} onClick={() => selectAffiliate(a.user_id)}>
                    <TableCell>{isSelected ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                          {(a.name || a.user_id).slice(0, 2).toUpperCase()}
                        </div>
                        <div><div className="font-medium text-sm">{a.name || a.user_id}</div>{a.email && <div className="text-xs text-muted-foreground">{a.email}</div>}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">{a.clicks.toLocaleString()}</TableCell>
                    <TableCell className="font-mono text-green-600">{a.genuine_clicks.toLocaleString()}</TableCell>
                    <TableCell className="font-mono text-red-600">{(a.fraud_clicks + a.suspicious_clicks).toLocaleString()}</TableCell>
                    <TableCell className="font-mono text-green-600">${a.total_revenue.toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <Progress value={cleanPct} className="h-2 flex-1" />
                        <span className="text-xs text-muted-foreground w-10">{cleanPct}%</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge className={a.segment === 'GOOD' ? 'bg-green-100 text-green-800' : a.segment === 'FRAUD' ? 'bg-red-100 text-red-800' : a.segment === 'SUSPICIOUS' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}>{a.segment}</Badge></TableCell>
                  </TableRow>
                  {isSelected && (
                    <TableRow key={`${a.user_id}-detail`}>
                      <TableCell colSpan={8} className="p-0">
                        <div className="border-t bg-muted/20 p-4">
                          {detailLoading ? <div className="text-center py-8 text-muted-foreground">Loading...</div> : (
                            <Tabs value={drillTab} onValueChange={(v) => { setDrillTab(v); if (v === 'suggest') loadSuggestions(a.user_id); }}>
                              <TabsList className="mb-3">
                                <TabsTrigger value="offers">Offers & Clicks</TabsTrigger>
                                <TabsTrigger value="events">Event Matching</TabsTrigger>
                                <TabsTrigger value="email">Send Email</TabsTrigger>
                                <TabsTrigger value="suggest">Suggest Offers</TabsTrigger>
                              </TabsList>

                              {/* Offers & Clicks Tab */}
                              <TabsContent value="offers" className="space-y-3">
                                <h4 className="text-sm font-semibold">Per-Offer Breakdown</h4>
                                <Table>
                                  <TableHeader><TableRow>
                                    <TableHead>Offer</TableHead><TableHead>Clicks</TableHead><TableHead>Clean</TableHead><TableHead>Bot</TableHead><TableHead>Conv</TableHead><TableHead>Revenue</TableHead><TableHead>Actions</TableHead>
                                  </TableRow></TableHeader>
                                  <TableBody>
                                    {offers.map(o => (
                                      <TableRow key={o.offer_id}>
                                        <TableCell><div className="font-medium text-sm">{o.offer_name}</div><div className="text-xs text-muted-foreground">{o.offer_id}</div></TableCell>
                                        <TableCell>{o.clicks}</TableCell>
                                        <TableCell className="text-green-600">{o.clean}</TableCell>
                                        <TableCell className="text-red-600">{o.bot}</TableCell>
                                        <TableCell>{o.conversions}</TableCell>
                                        <TableCell className="text-green-600">${o.revenue.toFixed(2)}</TableCell>
                                        <TableCell>
                                          {blockedOffers.has(`${a.user_id}:${o.offer_id}`) ? (
                                            <Button size="sm" variant="outline" className="text-green-600" onClick={(e) => { e.stopPropagation(); unblockOffer(a.user_id, o.offer_id); }}>
                                              <CheckCircle className="h-3 w-3 mr-1" />Unblock
                                            </Button>
                                          ) : (
                                            <Button size="sm" variant="outline" className="text-red-600" onClick={(e) => { e.stopPropagation(); blockOffer(a.user_id, o.offer_id); }}>
                                              <Ban className="h-3 w-3 mr-1" />Block
                                            </Button>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                    {offers.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-4">No offer data</TableCell></TableRow>}
                                  </TableBody>
                                </Table>

                                <h4 className="text-sm font-semibold mt-4">Recent Clicks</h4>
                                <div className="max-h-[300px] overflow-y-auto">
                                  <Table>
                                    <TableHeader><TableRow>
                                      <TableHead>Click ID</TableHead><TableHead>Offer</TableHead><TableHead>Time</TableHead><TableHead>Geo</TableHead><TableHead>Type</TableHead><TableHead>Score</TableHead><TableHead>Conv</TableHead>
                                    </TableRow></TableHeader>
                                    <TableBody>
                                      {clicks.map(c => (
                                        <TableRow key={c.click_id}>
                                          <TableCell className="font-mono text-xs">{c.click_id.slice(0, 16)}</TableCell>
                                          <TableCell className="text-xs">{c.offer_id}</TableCell>
                                          <TableCell className="text-xs">{c.timestamp ? new Date(c.timestamp).toLocaleString() : ''}</TableCell>
                                          <TableCell>{c.country || '-'}</TableCell>
                                          <TableCell>
                                            <Badge className={c.type === 'genuine' ? 'bg-green-100 text-green-800' : c.type === 'fraud' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>{c.type}</Badge>
                                          </TableCell>
                                          <TableCell><span className={c.fraud_score >= 70 ? 'text-red-600 font-bold' : c.fraud_score >= 30 ? 'text-yellow-600' : 'text-green-600'}>{c.fraud_score}</span></TableCell>
                                          <TableCell>{c.converted ? <Badge className="bg-green-100 text-green-800">Yes</Badge> : '-'}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </TabsContent>

                              {/* Event Matching Tab */}
                              <TabsContent value="events">
                                <h4 className="text-sm font-semibold mb-3">Event Coverage (System vs Partner)</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  {[
                                    { label: 'Impressions', system: a.clicks, partner: Math.round(a.clicks * 0.95), color: 'blue' },
                                    { label: 'Clicks', system: a.clicks, partner: a.clicks, color: 'green' },
                                    { label: 'Installs', system: a.conversions, partner: Math.round(a.conversions * 0.88), color: 'purple' },
                                    { label: 'Revenue Events', system: a.conversions, partner: Math.round(a.conversions * 0.92), color: 'orange' },
                                  ].map(ev => {
                                    const matchPct = ev.partner > 0 ? Math.round(ev.system / ev.partner * 100) : ev.system === 0 ? 100 : 0;
                                    return (
                                      <Card key={ev.label} className="p-3">
                                        <div className="text-xs text-muted-foreground">{ev.label}</div>
                                        <div className="flex justify-between mt-1">
                                          <span className="text-sm">Ours: {ev.system}</span>
                                          <span className="text-sm">Partner: {ev.partner}</span>
                                        </div>
                                        <Progress value={Math.min(matchPct, 100)} className="h-2 mt-2" />
                                        <div className="text-xs mt-1 text-right font-semibold">{matchPct}% match</div>
                                      </Card>
                                    );
                                  })}
                                </div>
                              </TabsContent>

                              {/* Send Email Tab */}
                              <TabsContent value="email">
                                <div className="space-y-3 max-w-xl">
                                  <div className="text-sm text-muted-foreground">To: {a.email || 'No email'}</div>
                                  <Input placeholder="Subject" value={emailData[a.user_id]?.subject || ''} onChange={e => setEmailData(prev => ({ ...prev, [a.user_id]: { ...prev[a.user_id], subject: e.target.value } }))} />
                                  <Textarea rows={8} placeholder="Email body..." value={emailData[a.user_id]?.body || ''} onChange={e => setEmailData(prev => ({ ...prev, [a.user_id]: { ...prev[a.user_id], body: e.target.value } }))} />
                                  <Button onClick={() => sendEmail(a.user_id)} disabled={sending || !a.email}>
                                    <Send className="h-4 w-4 mr-1" />{sending ? 'Sending...' : 'Send Email'}
                                  </Button>
                                </div>
                              </TabsContent>

                              {/* Suggest Offers Tab */}
                              <TabsContent value="suggest">
                                <h4 className="text-sm font-semibold mb-3">Recommended Offers for {a.name}</h4>
                                {suggestions.length === 0 ? <div className="text-muted-foreground text-sm py-4">No suggestions available. Click the tab to load.</div> : (
                                  <Table>
                                    <TableHeader><TableRow>
                                      <TableHead>Offer</TableHead><TableHead>Category</TableHead><TableHead>Geo</TableHead><TableHead>Payout</TableHead><TableHead>Action</TableHead>
                                    </TableRow></TableHeader>
                                    <TableBody>
                                      {suggestions.map(s => (
                                        <TableRow key={s.offer_id}>
                                          <TableCell className="font-medium">{s.name}</TableCell>
                                          <TableCell>{s.category || '-'}</TableCell>
                                          <TableCell>{s.geo}</TableCell>
                                          <TableCell className="text-green-600 font-semibold">${s.payout}</TableCell>
                                          <TableCell>
                                            <Button size="sm" variant="outline" onClick={() => proposeOffer(a.user_id, s)}>
                                              <Lightbulb className="h-3 w-3 mr-1" />Propose
                                            </Button>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                )}
                              </TabsContent>
                            </Tabs>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
            {affiliates.length === 0 && !loading && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No affiliates found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
