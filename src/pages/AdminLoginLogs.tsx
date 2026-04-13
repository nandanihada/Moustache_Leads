import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, XCircle, ChevronDown, ChevronUp, ExternalLink, Shield, AlertTriangle, Mail, X, TrendingUp, Globe, Monitor, Eye, Search, Send, Clock, History, Package } from 'lucide-react';
import loginLogsService, { LoginLog, PageVisit } from '@/services/loginLogsService';
import { useToast } from '@/hooks/use-toast';
import { FraudIndicators } from '@/components/FraudIndicators';
import { AdminPageGuard } from '@/components/AdminPageGuard';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Legend } from 'recharts';

const LOGIN_GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
const SUSPICIOUS_COLORS = ['#ef4444', '#f97316', '#eab308', '#ec4899', '#a855f7', '#6366f1', '#14b8a6', '#f43f5e'];

interface SuspiciousIP {
  ip: string; user_count: number; login_count: number;
  users: Array<{ user_id: string; email: string; username: string }>;
  location: { lat?: number; lng?: number; country?: string; city?: string };
}

function LoginMap({ logs, onUserMail, suspiciousIps, suspiciousUserIds }: {
  logs: LoginLog[]; onUserMail: (user: LoginLog) => void;
  suspiciousIps: SuspiciousIP[]; suspiciousUserIds: string[];
}) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([10, 20]);
  const [selectedLog, setSelectedLog] = useState<LoginLog | null>(null);
  const [mapFilter, setMapFilter] = useState<'all' | 'suspicious'>('all');

  const userColorMap = useMemo(() => {
    const map = new Map<string, string>();
    let ci = 0;
    for (const sip of suspiciousIps) {
      for (const u of sip.users) {
        if (!map.has(u.user_id)) { map.set(u.user_id, SUSPICIOUS_COLORS[ci % SUSPICIOUS_COLORS.length]); ci++; }
      }
    }
    return map;
  }, [suspiciousIps]);

  const suspiciousSet = useMemo(() => new Set(suspiciousUserIds), [suspiciousUserIds]);

  const points = useMemo(() => {
    const userMap = new Map<string, LoginLog>();
    for (const l of logs) {
      if (!l.location?.latitude || !l.location?.longitude) continue;
      const existing = userMap.get(l.user_id);
      if (!existing || new Date(l.login_time) > new Date(existing.login_time)) userMap.set(l.user_id, l);
    }
    let pts = Array.from(userMap.values()).map(l => ({ log: l, lat: l.location.latitude!, lng: l.location.longitude!, isSuspicious: suspiciousSet.has(l.user_id) }));
    if (mapFilter === 'suspicious') pts = pts.filter(p => p.isSuspicious);
    
    // Jitter overlapping markers — offset users at same lat/lng so they spread when zoomed
    const locMap = new Map<string, number>();
    for (const p of pts) {
      const key = `${p.lat.toFixed(2)}_${p.lng.toFixed(2)}`;
      const idx = locMap.get(key) || 0;
      locMap.set(key, idx + 1);
      if (idx > 0) {
        const angle = (idx * 137.5) * (Math.PI / 180); // golden angle spiral
        const radius = 0.3 + idx * 0.15;
        p.lat += Math.cos(angle) * radius;
        p.lng += Math.sin(angle) * radius;
      }
    }
    return pts;
  }, [logs, suspiciousSet, mapFilter]);

  const loginCounts = useMemo(() => {
    const c = new Map<string, number>();
    for (const l of logs) c.set(l.user_id, (c.get(l.user_id) || 0) + 1);
    return c;
  }, [logs]);

  const counts = useMemo(() => {
    let active = 0, success = 0, failed = 0, suspicious = 0;
    for (const p of points) {
      if (p.isSuspicious) suspicious++;
      if (p.log.status === 'failed') failed++;
      else if ((p.log as any).is_active) active++;
      else success++;
    }
    return { active, success, failed, suspicious };
  }, [points]);

  const getColor = (log: LoginLog, isSusp: boolean) => {
    if (isSusp) return userColorMap.get(log.user_id) || '#ef4444';
    if (log.status === 'failed') return '#ef4444';
    if ((log as any).is_active) return '#22c55e';
    return '#3b82f6';
  };

  const getLabel = (log: LoginLog, isSusp: boolean) => {
    if (isSusp) return '⚠ Suspicious';
    if (log.status === 'failed') return 'Failed';
    if ((log as any).is_active) return 'Online Now';
    return 'Logged In';
  };

  // Smooth scroll zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.85 : 1.18;
    setZoom(z => Math.max(1, Math.min(z * delta, 50)));
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2 flex-wrap">
          🗺️ Login Locations Map
          <span className="text-muted-foreground font-normal">({points.length} users)</span>
          {counts.active > 0 && <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] h-5">{counts.active} online</Badge>}
          {counts.suspicious > 0 && <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] h-5">{counts.suspicious} suspicious</Badge>}
          <div className="ml-auto flex gap-1">
            <Button size="sm" variant={mapFilter === 'all' ? 'default' : 'outline'} className="h-6 text-[10px]" onClick={() => setMapFilter('all')}>All</Button>
            <Button size="sm" variant={mapFilter === 'suspicious' ? 'destructive' : 'outline'} className="h-6 text-[10px]" onClick={() => setMapFilter('suspicious')}>Suspicious Only</Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative w-full h-[420px] overflow-hidden rounded-b-lg" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }} onWheel={handleWheel}>
          <ComposableMap projectionConfig={{ scale: 140, center: center }} style={{ width: '100%', height: '100%' }}>
            <ZoomableGroup
              zoom={zoom}
              center={center}
              onMoveEnd={({ coordinates, zoom: z }) => { setCenter(coordinates as [number, number]); setZoom(z); }}
              minZoom={1}
              maxZoom={50}
              translateExtent={[[-200, -200], [1200, 800]]}
            >
              <Geographies geography={LOGIN_GEO_URL}>
                {({ geographies }) => geographies.map((geo) => (
                  <Geography key={geo.rsmKey} geography={geo} fill="#1e3a5f" stroke="#3b82f6" strokeWidth={0.4}
                    style={{ default: { outline: 'none' }, hover: { fill: '#2d4a6f', outline: 'none' }, pressed: { outline: 'none' } }} />
                ))}
              </Geographies>
              {points.map((p, i) => {
                const color = getColor(p.log, p.isSuspicious);
                const isActive = (p.log as any).is_active && p.log.status !== 'failed';
                const lc = loginCounts.get(p.log.user_id) || 0;
                return (
                  <Marker key={i} coordinates={[p.lng, p.lat]}>
                    <g
                      onMouseEnter={(e) => {
                        const rect = (e.target as SVGElement).closest('svg')?.getBoundingClientRect();
                        if (rect) setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top - 10, text: `${p.log.username} · ${p.log.location?.country || '?'} · ${getLabel(p.log, p.isSuspicious)} · Logins: ${lc}` });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                      onClick={() => setSelectedLog(selectedLog?._id === p.log._id ? null : p.log)}
                      style={{ cursor: 'pointer' }}
                    >
                      {p.isSuspicious && (<><circle cx="0" cy="0" r="10" fill="none" stroke={color} strokeWidth="1.5" opacity="0.5"><animate attributeName="r" from="6" to="14" dur="1.2s" repeatCount="indefinite" /><animate attributeName="opacity" from="0.6" to="0" dur="1.2s" repeatCount="indefinite" /></circle><circle cx="0" cy="0" r="7" fill={color} opacity="0.15" /></>)}
                      {isActive && !p.isSuspicious && (<circle cx="0" cy="0" r="8" fill="none" stroke={color} strokeWidth="1" opacity="0.4"><animate attributeName="r" from="5" to="12" dur="1.5s" repeatCount="indefinite" /><animate attributeName="opacity" from="0.5" to="0" dur="1.5s" repeatCount="indefinite" /></circle>)}
                      <circle cx="0" cy="0" r={p.isSuspicious ? 6 : isActive ? 6 : 4} fill={color} opacity="0.3" />
                      <circle cx="0" cy="-4" r="2" fill={color} />
                      <line x1="0" y1="-2" x2="0" y2="2.5" stroke={color} strokeWidth="1.2" />
                      <line x1="-2.5" y1="0" x2="2.5" y2="0" stroke={color} strokeWidth="0.8" />
                      <line x1="0" y1="2.5" x2="-1.5" y2="5.5" stroke={color} strokeWidth="0.8" />
                      <line x1="0" y1="2.5" x2="1.5" y2="5.5" stroke={color} strokeWidth="0.8" />
                    </g>
                  </Marker>
                );
              })}
            </ZoomableGroup>
          </ComposableMap>
          {tooltip && (<div className="absolute pointer-events-none z-10 px-3 py-1.5 rounded-lg text-xs font-medium text-white shadow-lg" style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)', background: 'rgba(0,0,0,0.85)', maxWidth: 340 }}>{tooltip.text}</div>)}
          <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
            <button onClick={() => setZoom(z => Math.min(z * 1.8, 50))} className="w-8 h-8 rounded bg-white/10 hover:bg-white/20 text-white text-base font-bold flex items-center justify-center backdrop-blur-sm border border-white/10">+</button>
            <button onClick={() => setZoom(z => Math.max(z / 1.8, 1))} className="w-8 h-8 rounded bg-white/10 hover:bg-white/20 text-white text-base font-bold flex items-center justify-center backdrop-blur-sm border border-white/10">−</button>
            <button onClick={() => { setZoom(1); setCenter([10, 20]); }} className="w-8 h-8 rounded bg-white/10 hover:bg-white/20 text-white text-[9px] font-bold flex items-center justify-center backdrop-blur-sm border border-white/10" title="Reset zoom">⟲</button>
          </div>
          <div className="absolute bottom-2 left-2 flex items-center gap-3 text-[10px] text-white/80 bg-black/30 backdrop-blur-sm rounded-lg px-3 py-1.5 flex-wrap">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" /> Online ({counts.active})</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Logged In ({counts.success})</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Failed ({counts.failed})</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#ef4444', boxShadow: '0 0 8px rgba(239,68,68,0.8)' }} /> Suspicious ({counts.suspicious})</span>
            <span className="text-white/50 ml-1">Zoom: {zoom.toFixed(1)}x · Scroll to zoom</span>
          </div>
        </div>
        {selectedLog && (
          <div className="border-t border-border p-4 bg-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm ${suspiciousSet.has(selectedLog.user_id) ? 'bg-red-500' : selectedLog.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>{(selectedLog.username || '?')[0]?.toUpperCase()}</div>
                <div><p className="font-medium text-foreground text-sm">{selectedLog.username} {suspiciousSet.has(selectedLog.user_id) && <Badge variant="destructive" className="text-[10px] ml-1">Suspicious</Badge>}</p><p className="text-xs text-muted-foreground">{selectedLog.email}</p></div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onUserMail(selectedLog)}><Mail className="h-3 w-3 mr-1" /> Mail</Button>
                <button onClick={() => setSelectedLog(null)} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4 text-muted-foreground" /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {[{ l: 'Status', v: selectedLog.status, c: selectedLog.status === 'success' ? 'text-green-500' : 'text-red-500' }, { l: 'Country', v: `${selectedLog.location?.country || '?'}` }, { l: 'City', v: selectedLog.location?.city || '?' }, { l: 'Device', v: `${selectedLog.device?.type || '?'} · ${selectedLog.device?.browser || '?'}` }, { l: 'IP', v: selectedLog.ip_address }, { l: 'Login', v: new Date(selectedLog.login_time).toLocaleString() }].map((it, i) => (
                <div key={i} className="bg-background border border-border rounded-lg p-2.5"><p className="text-[10px] text-muted-foreground uppercase">{it.l}</p><p className={`text-sm font-medium ${it.c || 'text-foreground'}`}>{it.v}</p></div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


const AdminLoginLogs: React.FC = () => {
    const [logs, setLogs] = useState<LoginLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [pageVisits, setPageVisits] = useState<Record<string, PageVisit[]>>({});
    const [loadingVisits, setLoadingVisits] = useState<Set<string>>(new Set());
    const [searchLogs, setSearchLogs] = useState<Record<string, any[]>>({});
    const [loadingSearch, setLoadingSearch] = useState<Set<string>>(new Set());
    const [offerViews, setOfferViews] = useState<Record<string, any[]>>({});
    const [loadingOffers, setLoadingOffers] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState<Record<string, string>>({});
    const [selectedSearchLogs, setSelectedSearchLogs] = useState<Record<string, Set<string>>>({});
    const [selectedOfferViews, setSelectedOfferViews] = useState<Record<string, Set<string>>>({});
    const [matchedOffers, setMatchedOffers] = useState<Record<string, any[]>>({});
    const [loadingMatched, setLoadingMatched] = useState<Set<string>>(new Set());
    const [addedMatchedOffers, setAddedMatchedOffers] = useState<Set<string>>(new Set());
    const [mailHistory, setMailHistory] = useState<any[]>([]);
    const [mailHistoryLoading, setMailHistoryLoading] = useState(false);
    const [showMailHistory, setShowMailHistory] = useState(false);

    const [mailConfig, setMailConfig] = useState({ to: '', subject: '', body: '', isScheduled: false, scheduledTime: '', promoCode: '', promoType: '15% Bonus', usePromo: false });
    const [sendingMail, setSendingMail] = useState(false);
    const [chartData, setChartData] = useState<any>(null);
    const [chartPeriod, setChartPeriod] = useState<string>('7d');
    const [chartLoading, setChartLoading] = useState(false);
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const { toast } = useToast();

    const loadChartData = async (period: string = chartPeriod) => {
        setChartLoading(true);
        try {
            let options: any = {};
            if (period === '30m') options = { durationMinutes: 30 };
            else if (period === '1h') options = { durationMinutes: 60 };
            else if (period === '2h') options = { durationMinutes: 120 };
            else if (period === 'custom' && customStart && customEnd) options = { customStart: new Date(customStart).toISOString(), customEnd: new Date(customEnd).toISOString() };
            const days = period === '14d' ? 14 : period === '30d' ? 30 : 7;
            const data = await loginLogsService.getChartData(days, options);
            setChartData(data);
        } catch {} finally { setChartLoading(false); }
    };

    const loadLogs = async () => {
        try {
            setLoading(true);
            const [logsRes, sessionsRes] = await Promise.all([
                loginLogsService.getLoginLogs({ page: 1, limit: 500 }),
                loginLogsService.getActiveSessions(true).catch(() => ({ sessions: [], count: 0 })),
            ]);
            const activeUserIds = new Set(sessionsRes.sessions.map((s: any) => s.user_id));
            setLogs(logsRes.logs.map(l => ({ ...l, is_active: activeUserIds.has(l.user_id) })));
            setTotal(logsRes.total);
        } catch (error: any) { toast({ title: 'Error', description: error.response?.data?.error || 'Failed to load', variant: 'destructive' }); }
        finally { setLoading(false); }
    };

    const loadMailHistory = async () => {
        setMailHistoryLoading(true);
        try { const data = await loginLogsService.getMailHistory(); setMailHistory(data.history || []); }
        catch {} finally { setMailHistoryLoading(false); }
    };

    const handleSendMail = async () => {
        if (!mailConfig.to || !mailConfig.subject || !mailConfig.body) { toast({ title: 'Error', description: 'Fill all fields', variant: 'destructive' }); return; }
        try {
            setSendingMail(true);
            const toList = mailConfig.to.split(',').map(e => e.trim()).filter(e => e);
            let bodyText = mailConfig.body;
            // Clean up placeholder if still present
            bodyText = bodyText.replace(/\n?\[OFFERS_PLACEHOLDER\]\n?/g, '');
            if (mailConfig.usePromo && mailConfig.promoCode) {
                // Insert promo before sign-off
                const promoBlock = `\nPromo Code: ${mailConfig.promoCode} (${mailConfig.promoType})`;
                if (bodyText.includes('Best Regards')) {
                    bodyText = bodyText.replace('Best Regards', promoBlock + '\n\nBest Regards');
                } else {
                    bodyText += promoBlock;
                }
            }
            
            // Build proper branded HTML email
            const lines = bodyText.split('\n');
            let htmlLines = '';
            let inOfferList = false;
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('•') || trimmed.match(/^\d+\.\s/)) {
                    if (!inOfferList) { htmlLines += '<table cellpadding="0" cellspacing="0" style="width:100%;margin:12px 0">'; inOfferList = true; }
                    const offerText = trimmed.replace(/^[•\d.]\s*/, '');
                    htmlLines += `<tr><td style="padding:8px 12px;border-left:3px solid #7c3aed;background:#f8f7ff;border-radius:4px;margin-bottom:4px;font-size:14px">${offerText}</td></tr><tr><td style="height:4px"></td></tr>`;
                } else {
                    if (inOfferList) { htmlLines += '</table>'; inOfferList = false; }
                    if (trimmed === '') { htmlLines += '<br/>'; }
                    else if (trimmed.startsWith('Promo Code:')) {
                        htmlLines += `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin:16px 0;text-align:center"><span style="font-size:12px;color:#666;text-transform:uppercase;letter-spacing:1px">Your Exclusive Code</span><br/><span style="font-size:20px;font-weight:bold;color:#16a34a;letter-spacing:2px">${trimmed.replace('Promo Code: ', '')}</span></div>`;
                    } else {
                        htmlLines += `<p style="margin:0 0 4px 0;font-size:14px;line-height:1.6;color:#333">${trimmed}</p>`;
                    }
                }
            }
            if (inOfferList) htmlLines += '</table>';
            
            const htmlBody = `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:20px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
  <tr><td style="background:linear-gradient(135deg,#1e1b4b,#312e81);padding:24px 32px;text-align:center">
    <img src="https://moustacheleads.com/logo.png" alt="Moustache Leads" height="36" style="height:36px;margin-bottom:8px" onerror="this.style.display='none'"/>
    <div style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:0.5px">Moustache Leads</div>
  </td></tr>
  <tr><td style="padding:32px">${htmlLines}</td></tr>
  <tr><td style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0">
    <p style="margin:0;font-size:12px;color:#94a3b8">This email was sent by Moustache Leads</p>
    <p style="margin:4px 0 0;font-size:12px;color:#94a3b8"><a href="https://moustacheleads.com" style="color:#7c3aed;text-decoration:none">moustacheleads.com</a></p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
            
            await loginLogsService.sendCustomMail(toList, mailConfig.subject, htmlBody, mailConfig.isScheduled && mailConfig.scheduledTime ? new Date(mailConfig.scheduledTime).toISOString() : undefined);
            toast({ title: 'Success', description: 'Mail sent!' });
            setMailConfig({ to: '', subject: '', body: '', isScheduled: false, scheduledTime: '', promoCode: '', promoType: '15% Bonus', usePromo: false });
            loadMailHistory();
        } catch (error: any) { toast({ title: 'Error', description: error.response?.data?.error || 'Failed', variant: 'destructive' }); }
        finally { setSendingMail(false); }
    };

    const prefillMailForRegion = (region: string, emails: string[]) => {
        setMailConfig(prev => ({ ...prev, to: emails.join(', '), subject: `Top offers for you — ${region} special`, body: `Hey there,\n\nWe've selected top-performing offers available in ${region} right now.\n\n[OFFERS_PLACEHOLDER]\n\nBest Regards,\nTeam Moustache Leads`, promoCode: 'REGION15' }));
        document.getElementById('mail-compose-box')?.scrollIntoView({ behavior: 'smooth' });
    };

    const prefillMailForUser = (user: LoginLog) => {
        setActiveTab(prev => ({ ...prev, [user._id]: 'mail' }));
        setAddedMatchedOffers(new Set());
        setMailConfig(prev => ({ ...prev, to: user.email, subject: `Special offers based on your recent activity`, body: `Hey ${user.username},\n\nBased on your recent browsing, we handpicked these offers just for you.\n\n[OFFERS_PLACEHOLDER]\n\nBest Regards,\nTeam Moustache Leads`, promoCode: `${user.username.toUpperCase()}20` }));
    };

    useEffect(() => { loadLogs(); loadChartData(); loadMailHistory(); }, []);

    const toggleRow = async (logId: string, sessionId: string | undefined) => {
        const newExpanded = new Set(expandedRows);
        if (expandedRows.has(logId)) { newExpanded.delete(logId); setExpandedRows(newExpanded); return; }
        newExpanded.add(logId); setExpandedRows(newExpanded);
        if (sessionId && !pageVisits[sessionId]) loadPageVisits(sessionId);
        const log = logs.find(l => l._id === logId);
        if (log?.user_id) {
            if (!searchLogs[logId]) loadSearchLogs(logId, log.user_id);
            if (!offerViews[logId]) loadOfferViews(logId, log.user_id);
        }
        if (!activeTab[logId]) setActiveTab(prev => ({ ...prev, [logId]: 'pages' }));
    };

    const loadPageVisits = async (sid: string) => {
        try { setLoadingVisits(s => new Set(s).add(sid)); const r = await loginLogsService.getPageVisits(sid, 50); setPageVisits(p => ({ ...p, [sid]: r.visits })); }
        catch {} finally { setLoadingVisits(s => { const n = new Set(s); n.delete(sid); return n; }); }
    };

    const loadSearchLogs = async (logId: string, userId: string) => {
        try {
            setLoadingSearch(s => new Set(s).add(logId));
            const token = localStorage.getItem('token');
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/search-logs?user=${userId}&per_page=20`, { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            if (data.success) setSearchLogs(p => ({ ...p, [logId]: data.logs }));
        } catch {} finally { setLoadingSearch(s => { const n = new Set(s); n.delete(logId); return n; }); }
    };

    const loadOfferViews = async (logId: string, userId: string) => {
        const log = logs.find(l => l._id === logId);
        try { setLoadingOffers(s => new Set(s).add(logId)); const data = await loginLogsService.getOfferViews(userId, 50, log?.username, log?.email); setOfferViews(p => ({ ...p, [logId]: data.views || [] })); }
        catch {} finally { setLoadingOffers(s => { const n = new Set(s); n.delete(logId); return n; }); }
    };

    const loadMatchedOffers = async (logId: string, userId: string) => {
        try { setLoadingMatched(s => new Set(s).add(logId)); const data = await loginLogsService.getInventoryMatchedOffers(userId); setMatchedOffers(p => ({ ...p, [logId]: data.offers || [] })); }
        catch {} finally { setLoadingMatched(s => { const n = new Set(s); n.delete(logId); return n; }); }
    };

    const toggleSearchLogSelection = (logId: string, searchId: string) => {
        setSelectedSearchLogs(prev => { const c = new Set(prev[logId] || []); if (c.has(searchId)) c.delete(searchId); else c.add(searchId); return { ...prev, [logId]: c }; });
    };

    const toggleOfferViewSelection = (logId: string, offerName: string) => {
        setSelectedOfferViews(prev => { const c = new Set(prev[logId] || []); if (c.has(offerName)) c.delete(offerName); else c.add(offerName); return { ...prev, [logId]: c }; });
    };

    // Paste selected offer names into mail body
    const pasteOfferViewsToMail = (logId: string, log: LoginLog) => {
        const selected = selectedOfferViews[logId];
        if (!selected || selected.size === 0) { toast({ title: 'Select offers first', variant: 'destructive' }); return; }
        const offerNames = Array.from(selected);
        const offersList = offerNames.map((n, i) => `${i + 1}. ${n}`).join('\n');
        setActiveTab(prev => ({ ...prev, [logId]: 'mail' }));
        setAddedMatchedOffers(new Set());
        setMailConfig(prev => ({
            ...prev, to: log.email,
            subject: `Offers you recently viewed — ${offerNames.length} picks`,
            body: `Hey ${log.username},\n\nWe noticed you viewed these offers recently:\n\n${offersList}\n\nDon't miss out — apply now and start earning!\n\nBest Regards,\nTeam Moustache Leads`
        }));
    };

    const collectSearchLogsToMail = async (logId: string, log: LoginLog) => {
        const selected = selectedSearchLogs[logId];
        if (!selected || selected.size === 0) { toast({ title: 'Select search logs first', variant: 'destructive' }); return; }
        try {
            const result = await loginLogsService.collectSearchLogsForMail({ user_email: log.email, user_name: log.username, search_log_ids: Array.from(selected), send_now: false });
            setActiveTab(prev => ({ ...prev, [logId]: 'mail' }));
            setMailConfig(prev => ({ ...prev, to: result.to || log.email, subject: result.subject || '', body: result.body || '' }));
            toast({ title: 'Success', description: `${selected.size} search logs collected into mail` });
        } catch (error: any) { toast({ title: 'Error', description: error.response?.data?.error || 'Failed', variant: 'destructive' }); }
    };

    const formatDate = (ds: string) => {
        try { return new Date(ds).toLocaleString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) + ' IST'; }
        catch { return new Date(ds).toLocaleString(); }
    };
    const formatTimeAgo = (ds: string) => { const d = Date.now() - new Date(ds).getTime(); const m = Math.floor(d / 60000); const h = Math.floor(m / 60); const dy = Math.floor(h / 24); if (dy > 0) return `${dy}d ago`; if (h > 0) return `${h}h ago`; if (m > 0) return `${m}m ago`; return 'Just now'; };

    const suspiciousIps: SuspiciousIP[] = chartData?.suspicious_ips || [];
    const suspiciousUserIds: string[] = chartData?.suspicious_user_ids || [];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div><h1 className="text-3xl font-bold">Login Logs</h1><p className="text-muted-foreground">Track and monitor all login attempts</p></div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setShowMailHistory(!showMailHistory); if (!showMailHistory) loadMailHistory(); }}>
                        <History className="h-4 w-4 mr-1" />{showMailHistory ? 'Hide' : 'Mail'} History
                    </Button>
                    <Button onClick={loadLogs} variant="outline" disabled={loading}><RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
                </div>
            </div>

            {/* Mail History Panel */}
            {showMailHistory && (
                <Card className="border-amber-200 dark:border-amber-800">
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><History className="h-4 w-4 text-amber-500" />Mail History ({mailHistory.length})</CardTitle></CardHeader>
                    <CardContent>
                        {mailHistoryLoading ? <div className="flex justify-center py-4"><RefreshCw className="h-5 w-5 animate-spin" /></div> :
                        mailHistory.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No emails sent yet</p> : (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {mailHistory.map((h, i) => (
                                    <div key={i} className="p-3 bg-background rounded border text-sm flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="font-medium">{h.subject}</div>
                                            <div className="text-xs text-muted-foreground">To: {Array.isArray(h.to) ? h.to.join(', ') : h.to}</div>
                                            <div className="text-xs text-muted-foreground mt-1">{h.body?.substring(0, 100)}...</div>
                                        </div>
                                        <div className="text-right ml-3">
                                            <Badge className={h.status === 'sent' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>{h.status}</Badge>
                                            <div className="text-[10px] text-muted-foreground mt-1">{h.sent_at ? formatDate(h.sent_at) : '—'}</div>
                                            <div className="text-[10px] text-muted-foreground">by {h.sent_by || 'admin'}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[{ l: 'Total Logs', v: total }, { l: 'Successful', v: logs.filter(l => l.status === 'success').length, c: 'text-green-600' }, { l: 'Failed', v: logs.filter(l => l.status === 'failed').length, c: 'text-red-600' }, { l: 'Success Rate', v: logs.length > 0 ? `${Math.round((logs.filter(l => l.status === 'success').length / logs.length) * 100)}%` : '0%' }].map((s, i) => (
                    <Card key={i}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{s.l}</CardTitle></CardHeader><CardContent><div className={`text-2xl font-bold ${s.c || ''}`}>{s.v}</div></CardContent></Card>
                ))}
            </div>

            <LoginMap logs={logs} onUserMail={prefillMailForUser} suspiciousIps={suspiciousIps} suspiciousUserIds={suspiciousUserIds} />

            {/* Charts Section */}
            {chartData && (<div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[{ l: 'Total Logins', v: chartData.summary?.total || 0, icon: '📊', c: 'text-blue-600' }, { l: 'Successful', v: chartData.summary?.success || 0, icon: '✅', c: 'text-green-600' }, { l: 'Failed', v: chartData.summary?.failed || 0, icon: '❌', c: 'text-red-500' }, { l: 'Unique Users', v: chartData.summary?.unique_users || 0, icon: '👥', c: 'text-purple-600' }, { l: 'Unique IPs', v: chartData.summary?.unique_ips || 0, icon: '🌐', c: 'text-indigo-600' }, { l: 'Suspicious IPs', v: chartData.summary?.suspicious_count || 0, icon: '⚠️', c: 'text-amber-600' }].map((s, i) => (
                    <Card key={i}><CardContent className="p-3"><div className="flex items-center gap-2 mb-1"><span className="text-lg">{s.icon}</span><span className="text-[10px] text-muted-foreground uppercase font-medium">{s.l}</span></div><p className={`text-2xl font-bold ${s.c}`}>{s.v.toLocaleString()}</p></CardContent></Card>
                  ))}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">Period:</span>
                  {[{ k: '30m', l: '30 min' }, { k: '1h', l: '1 hour' }, { k: '2h', l: '2 hours' }, { k: '7d', l: '7d' }, { k: '14d', l: '14d' }, { k: '30d', l: '30d' }, { k: 'custom', l: 'Custom' }].map(p => (
                    <Button key={p.k} size="sm" variant={chartPeriod === p.k ? 'default' : 'outline'} onClick={() => { setChartPeriod(p.k); if (p.k !== 'custom') loadChartData(p.k); }} className="h-7 text-xs">
                      {(p.k === '30m' || p.k === '1h' || p.k === '2h') && <Clock className="h-3 w-3 mr-1" />}{p.l}
                    </Button>
                  ))}
                  {chartPeriod === 'custom' && (<div className="flex items-center gap-2"><Input type="datetime-local" className="h-7 w-44 text-xs" value={customStart} onChange={e => setCustomStart(e.target.value)} /><span className="text-xs text-muted-foreground">to</span><Input type="datetime-local" className="h-7 w-44 text-xs" value={customEnd} onChange={e => setCustomEnd(e.target.value)} /><Button size="sm" className="h-7 text-xs" onClick={() => loadChartData('custom')} disabled={!customStart || !customEnd}>Apply</Button></div>)}
                  {chartLoading && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <Card className="lg:col-span-2"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><TrendingUp className="h-4 w-4 text-blue-500" />Login Activity — {chartPeriod}</CardTitle></CardHeader><CardContent>
                    <ResponsiveContainer width="100%" height={260}><AreaChart data={chartData.daily || []} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                      <defs><linearGradient id="gradSuccess" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0} /></linearGradient><linearGradient id="gradFailed" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.includes(':') ? v : new Date(v).toLocaleDateString('en', { weekday: 'short', day: 'numeric' })} /><YAxis tick={{ fontSize: 10 }} /><RechartsTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} /><Legend wrapperStyle={{ fontSize: 11 }} />
                      <Area type="monotone" dataKey="success" name="Successful" stroke="#22c55e" fill="url(#gradSuccess)" strokeWidth={2} /><Area type="monotone" dataKey="failed" name="Failed" stroke="#ef4444" fill="url(#gradFailed)" strokeWidth={2} />
                    </AreaChart></ResponsiveContainer></CardContent></Card>
                  <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Monitor className="h-4 w-4 text-purple-500" />Devices & Browsers</CardTitle></CardHeader><CardContent>
                    <ResponsiveContainer width="100%" height={120}><PieChart><Pie data={chartData.devices || []} dataKey="count" nameKey="device" cx="50%" cy="50%" outerRadius={45} innerRadius={25} paddingAngle={3}>{(chartData.devices || []).map((_: any, i: number) => <Cell key={i} fill={['#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444'][i % 5]} />)}</Pie><RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} /></PieChart></ResponsiveContainer>
                    <div className="flex flex-wrap gap-2 justify-center mt-1">{(chartData.devices || []).map((d: any, i: number) => <span key={i} className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-2 h-2 rounded-full" style={{ background: ['#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444'][i % 5] }} />{d.device} ({d.count})</span>)}</div>
                    <div className="mt-3 pt-3 border-t"><p className="text-[10px] text-muted-foreground uppercase font-medium mb-1.5">Top Browsers</p><div className="space-y-1">{(chartData.browsers || []).slice(0, 4).map((b: any, i: number) => <div key={i} className="flex items-center gap-2"><div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, (b.count / (chartData.summary?.total || 1)) * 100)}%`, background: ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd'][i % 4] }} /></div><span className="text-[10px] text-muted-foreground w-20 truncate">{b.browser}</span><span className="text-[10px] font-medium w-8 text-right">{b.count}</span></div>)}</div></div>
                  </CardContent></Card>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Globe className="h-4 w-4 text-emerald-500" />Top Countries</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={200}><BarChart data={chartData.top_countries || []} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} /><XAxis type="number" tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="country" tick={{ fontSize: 10 }} width={60} /><RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} /><Bar dataKey="count" name="Logins" fill="#10b981" radius={[0, 4, 4, 0]} barSize={16} /></BarChart></ResponsiveContainer></CardContent></Card>
                  <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" />Suspicious IPs{suspiciousIps.length > 0 && <Badge variant="destructive" className="text-[10px] h-4">{suspiciousIps.length}</Badge>}</CardTitle></CardHeader><CardContent>
                    {suspiciousIps.length === 0 ? <div className="text-center py-8 text-muted-foreground text-sm"><Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />No suspicious activity</div> : (
                      <div className="space-y-2 max-h-[240px] overflow-y-auto">{suspiciousIps.map((s, i) => (
                        <div key={i} className="p-2.5 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                          <div className="flex items-center justify-between mb-1.5"><code className="text-xs font-mono text-red-800 dark:text-red-200">{s.ip}</code><Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-[10px]">{s.login_count} logins</Badge></div>
                          <div className="flex flex-wrap gap-1">{s.users.map((u, ui) => { const color = SUSPICIOUS_COLORS[ui % SUSPICIOUS_COLORS.length]; return <span key={ui} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />{u.username || u.email}</span>; })}</div>
                          {s.location?.country && <p className="text-[10px] text-muted-foreground mt-1">📍 {s.location.city || ''} {s.location.country}</p>}
                        </div>
                      ))}</div>
                    )}
                  </CardContent></Card>
                  <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2">🔥 Activity Heatmap</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><div className="min-w-[280px]"><div className="grid grid-cols-[40px_repeat(24,1fr)] gap-[2px] text-[8px]"><div />{Array.from({ length: 24 }, (_, h) => <div key={h} className="text-center text-muted-foreground">{h % 6 === 0 ? `${h}h` : ''}</div>)}{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, di) => <React.Fragment key={day}><div className="text-muted-foreground text-right pr-1 leading-[14px]">{day}</div>{Array.from({ length: 24 }, (_, h) => { const entry = (chartData.heatmap || []).find((e: any) => e.day === di + 1 && e.hour === h); const count = entry?.count || 0; const maxC = Math.max(...(chartData.heatmap || []).map((e: any) => e.count), 1); return <div key={h} className="aspect-square rounded-[2px]" style={{ background: count === 0 ? '#f3f4f6' : `rgba(99, 102, 241, ${0.15 + (count / maxC) * 0.85})` }} title={`${day} ${h}:00 — ${count} logins`} />; })}</React.Fragment>)}</div><div className="flex items-center gap-1 mt-2 justify-end"><span className="text-[8px] text-muted-foreground">Less</span>{[0.1, 0.3, 0.5, 0.7, 1].map((o, i) => <div key={i} className="w-2.5 h-2.5 rounded-[2px]" style={{ background: `rgba(99, 102, 241, ${o})` }} />)}<span className="text-[8px] text-muted-foreground">More</span></div></div></div></CardContent></Card>
                </div>
            </div>)}

            {/* Geo Intelligence & Bulk Mail */}
            <Card id="mail-compose-box" className="border-border">
                <CardHeader className="bg-card pb-4 border-b"><div className="flex justify-between items-center flex-wrap gap-4"><CardTitle className="text-md flex items-center gap-2">🌍 Geo Intelligence — Active Regions & Mailing</CardTitle><Button size="sm" variant="outline" onClick={() => prefillMailForRegion('All Regions', logs.map(l => l.email))}>Mail All Regions</Button></div></CardHeader>
                <CardContent className="p-0">
                    <div className="grid grid-cols-1 md:grid-cols-2">
                        <div className="p-4 border-r">
                            <div className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider">Active By Region</div>
                            <div className="space-y-3">{Object.entries(logs.reduce((acc, log) => { const c = log.location?.country || 'Unknown'; if (!acc[c]) acc[c] = { count: 0, emails: new Set<string>() }; acc[c].count++; acc[c].emails.add(log.email); return acc; }, {} as Record<string, { count: number; emails: Set<string> }>)).sort((a, b) => b[1].count - a[1].count).slice(0, 5).map(([country, data]) => (
                                <div key={country} className="flex items-center justify-between p-2 rounded hover:bg-muted/50 border border-transparent hover:border-border transition-colors"><span className="font-semibold text-sm">{country}</span><div className="flex items-center gap-3"><div className="bg-primary/10 text-primary font-mono text-xs px-2 py-0.5 rounded">{data.count}</div><Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => prefillMailForRegion(country, Array.from(data.emails))}>Mail All ↗</Button></div></div>
                            ))}</div>
                        </div>
                        <div className="p-4 bg-muted/20">
                            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Mail className="h-4 w-4" /> Mail Compose</h4>
                            <div className="space-y-3">
                                <div><label className="text-xs text-muted-foreground font-mono">To</label><Input value={mailConfig.to} onChange={e => setMailConfig({ ...mailConfig, to: e.target.value })} placeholder="emails..." className="h-8 text-sm" /></div>
                                <div><label className="text-xs text-muted-foreground font-mono">Subject</label><Input value={mailConfig.subject} onChange={e => setMailConfig({ ...mailConfig, subject: e.target.value })} className="h-8 text-sm" /></div>
                                <div><label className="text-xs text-muted-foreground font-mono">Body</label><Textarea value={mailConfig.body} onChange={e => setMailConfig({ ...mailConfig, body: e.target.value })} className="min-h-[100px] text-sm" /></div>
                                <div className="flex items-center gap-2"><Checkbox id="promo-geo" checked={mailConfig.usePromo} onCheckedChange={(c) => setMailConfig({ ...mailConfig, usePromo: !!c })} /><label htmlFor="promo-geo" className="text-xs cursor-pointer">Include promo code</label></div>
                                {mailConfig.usePromo && <div className="flex items-center gap-2 p-2 bg-background border rounded-md"><Input className="h-8 w-32 text-sm" value={mailConfig.promoCode} onChange={e => setMailConfig({ ...mailConfig, promoCode: e.target.value })} /><Select value={mailConfig.promoType} onValueChange={v => setMailConfig({ ...mailConfig, promoType: v })}><SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="15% Bonus">15% Bonus</SelectItem><SelectItem value="10% Bonus">10% Bonus</SelectItem><SelectItem value="Fixed $5">Fixed $5</SelectItem></SelectContent></Select></div>}
                                <div className="flex items-center justify-between pt-3 border-t mt-2">
                                    <div className="flex items-center gap-2"><Select value={mailConfig.isScheduled ? 'Schedule' : 'Send Now'} onValueChange={v => setMailConfig({ ...mailConfig, isScheduled: v === 'Schedule' })}><SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Send Now">Send Now</SelectItem><SelectItem value="Schedule">Schedule</SelectItem></SelectContent></Select>{mailConfig.isScheduled && <Input type="datetime-local" className="h-8 w-44 text-xs" value={mailConfig.scheduledTime} onChange={e => setMailConfig({ ...mailConfig, scheduledTime: e.target.value })} />}</div>
                                    <Button size="sm" onClick={handleSendMail} disabled={sendingMail || !mailConfig.to}>{sendingMail ? 'Sending...' : 'Send Mail ↗'}</Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Login Log Cards */}
            <Card><CardHeader><CardTitle>Recent Login Attempts ({total} total)</CardTitle></CardHeader><CardContent>
                {loading ? <div className="flex justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" /></div> :
                logs.length === 0 ? <div className="text-center py-12 text-muted-foreground">No login logs found</div> : (
                <div className="space-y-4">{logs.map((log) => (
                    <div key={log._id}>
                        <div className="border rounded-lg p-4 hover:bg-muted/50">
                            <div className="flex items-start justify-between">
                                <div className="space-y-2 flex-1">
                                    <div className="flex items-center gap-3">
                                        {log.status === 'success' ? <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Success</Badge> : <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>}
                                        <span className="font-semibold">{log.username}</span><span className="text-sm text-muted-foreground">{log.email}</span>
                                        {suspiciousUserIds.includes(log.user_id) && <Badge variant="destructive" className="text-[10px]">⚠ Suspicious IP</Badge>}
                                    </div>
                                    <FraudIndicators vpnDetection={log.vpn_detection} deviceChange={log.device_change_detected} sessionFrequency={log.session_frequency} fraudScore={log.fraud_score} riskLevel={log.risk_level} />
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div><div className="text-muted-foreground">Login Time</div><div className="font-medium">{formatDate(log.login_time)}</div></div>
                                        <div><div className="text-muted-foreground">IP Address</div><div className="font-mono text-xs">{log.ip_address}</div></div>
                                        <div><div className="text-muted-foreground">Location</div><div>{log.location.city}{log.location.region && log.location.region !== 'Unknown' ? `, ${log.location.region}` : ''}, {log.location.country}</div></div>
                                        {log.location.isp && <div><div className="text-muted-foreground">ISP</div><div className="text-sm">{log.location.isp}</div></div>}
                                        <div><div className="text-muted-foreground">Device</div><div>{log.device.type} - {log.device.os}</div></div>
                                        <div><div className="text-muted-foreground">Browser</div><div>{log.device.browser}</div></div>
                                        <div><div className="text-muted-foreground">Method</div><div className="uppercase">{log.login_method}</div></div>
                                        {log.failure_reason && <div><div className="text-muted-foreground">Failure</div><div className="text-red-600">{log.failure_reason.replace(/_/g, ' ')}</div></div>}
                                    </div>
                                </div>
                                {log.session_id && <Button variant="ghost" size="sm" onClick={() => toggleRow(log._id, log.session_id)}>{expandedRows.has(log._id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button>}
                            </div>
                        </div>

                        {/* Expanded Tabs */}
                        {expandedRows.has(log._id) && log.session_id && (
                        <div className="mt-2 ml-4 p-4 bg-muted/30 rounded-lg border">
                            <div className="flex border-b mb-4 flex-wrap">
                                {[{ k: 'pages', icon: <ExternalLink className="h-4 w-4" />, label: 'Page Visits', loading: loadingVisits.has(log.session_id!) },
                                  { k: 'offers', icon: <Eye className="h-4 w-4" />, label: 'Offer Views', loading: loadingOffers.has(log._id) },
                                  { k: 'searches', icon: <Search className="h-4 w-4" />, label: 'Search Logs', loading: loadingSearch.has(log._id) },
                                  { k: 'mail', icon: <Mail className="h-4 w-4" />, label: 'Mail / Promo' }
                                ].map(tab => (
                                    <button key={tab.k} className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab[log._id] === tab.k ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
                                        onClick={() => tab.k === 'mail' ? prefillMailForUser(log) : setActiveTab(prev => ({ ...prev, [log._id]: tab.k }))}>
                                        <div className="flex items-center gap-2">{tab.icon}{tab.label}{tab.loading && <RefreshCw className="h-3 w-3 animate-spin" />}</div>
                                    </button>
                                ))}
                            </div>

                            {/* Page Visits */}
                            {activeTab[log._id] === 'pages' && (<>{pageVisits[log.session_id] && pageVisits[log.session_id].length > 0 ? (
                                <div className="space-y-2">{pageVisits[log.session_id].slice(0, 10).map((visit, idx) => (
                                    <div key={visit._id} className="p-3 bg-background rounded border text-sm"><div className="flex justify-between items-start"><div className="flex-1"><div className="font-medium">#{idx + 1} {visit.page_title || visit.page_url}</div><div className="text-xs text-muted-foreground">{visit.page_url}</div>{visit.referrer && <div className="text-xs text-muted-foreground">From: {visit.referrer}</div>}</div><div className="text-right"><div className="text-sm font-medium">{formatTimeAgo(visit.timestamp)}</div><div className="text-xs text-muted-foreground">{formatDate(visit.timestamp)}</div></div></div></div>
                                ))}</div>
                            ) : <div className="text-center py-4 text-muted-foreground">No page visits recorded</div>}</>)}

                            {/* Offer Views — real data from offer_views collection */}
                            {activeTab[log._id] === 'offers' && (<>
                                {loadingOffers.has(log._id) ? <div className="flex justify-center py-6"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div> :
                                offerViews[log._id] && offerViews[log._id].length > 0 ? (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-xs text-muted-foreground">{offerViews[log._id].length} offer interactions {(selectedOfferViews[log._id]?.size || 0) > 0 && <span className="text-primary font-medium ml-2">{selectedOfferViews[log._id].size} selected</span>}</div>
                                        <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!selectedOfferViews[log._id]?.size} onClick={() => pasteOfferViewsToMail(log._id, log)}>
                                            <Mail className="h-3 w-3 mr-1" />Paste to Mail
                                        </Button>
                                    </div>
                                    {offerViews[log._id].map((view, idx) => (
                                        <div key={view._id || idx} className="p-3 bg-background rounded border text-sm border-l-4 border-l-purple-500 flex items-start gap-3">
                                            <Checkbox checked={selectedOfferViews[log._id]?.has(view.offer_details?.name || view.offer_name || view.offer_id) || false} onCheckedChange={() => toggleOfferViewSelection(log._id, view.offer_details?.name || view.offer_name || view.offer_id)} className="mt-0.5" />
                                            <div className="flex-1"><div className="flex justify-between items-start"><div className="flex-1">
                                                <div className="font-semibold text-purple-700 dark:text-purple-400 flex items-center gap-2"><Eye className="h-3.5 w-3.5" />{view.offer_details?.name || view.offer_name || view.offer_id || 'Unknown'}</div>
                                                <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                                                    {view.offer_details?.payout > 0 && <span className="text-green-600 font-medium">${view.offer_details.payout}</span>}
                                                    {view.offer_details?.category && <span>📂 {view.offer_details.category}</span>}
                                                    {view.offer_details?.network && <span>🌐 {view.offer_details.network}</span>}
                                                    {view.offer_details?.status && <Badge variant={view.offer_details.status === 'active' ? 'default' : 'secondary'} className="text-[9px] h-4">{view.offer_details.status}</Badge>}
                                                    <Badge variant={view.view_type === 'clicked' ? 'default' : 'outline'} className="text-[9px] h-4">{view.view_type === 'clicked' ? '✓ Clicked' : '👁 Viewed'}</Badge>
                                                </div>
                                            </div><div className="text-right"><div className="text-sm font-medium">{view.timestamp ? formatTimeAgo(view.timestamp) : '—'}</div>{view.timestamp && <div className="text-[10px] text-muted-foreground">{formatDate(view.timestamp)}</div>}</div></div></div>
                                        </div>
                                    ))}
                                </div>
                                ) : <div className="text-center py-4 text-muted-foreground">No offer views recorded for this user</div>}
                            </>)}

                            {/* Search Logs with select + collect to mail */}
                            {activeTab[log._id] === 'searches' && (<>{searchLogs[log._id] && searchLogs[log._id].length > 0 ? (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-xs text-muted-foreground">{(selectedSearchLogs[log._id]?.size || 0) > 0 && <span className="text-primary font-medium">{selectedSearchLogs[log._id].size} selected</span>}</div>
                                        <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!selectedSearchLogs[log._id]?.size} onClick={() => collectSearchLogsToMail(log._id, log)}><Send className="h-3 w-3 mr-1" />Collect to Mail</Button>
                                    </div>
                                    {searchLogs[log._id].map((si) => (
                                        <div key={si._id} className="p-3 bg-background rounded border text-sm border-l-4 border-l-blue-500 flex items-start gap-3">
                                            <Checkbox checked={selectedSearchLogs[log._id]?.has(si._id) || false} onCheckedChange={() => toggleSearchLogSelection(log._id, si._id)} className="mt-0.5" />
                                            <div className="flex-1"><div className="flex justify-between items-start"><div className="flex-1"><div className="font-semibold text-blue-700 dark:text-blue-400">Keyword: "{si.keyword}"</div><div className="text-xs text-muted-foreground mt-1">Results: {si.results_count} | Status: {si.inventory_status}</div>{si.picked_offer && <div className="text-xs text-green-600 mt-1 font-medium">✓ Clicked: {si.picked_offer}</div>}{si.clicked_tracking && <div className="text-xs text-blue-600 font-medium">✓ Tracking Link</div>}</div><div className="text-right"><div className="text-sm font-medium">{formatTimeAgo(si.searched_at)}</div></div></div></div>
                                        </div>
                                    ))}
                                </div>
                            ) : <div className="text-center py-4 text-muted-foreground">No search logs recorded</div>}</>)}

                            {/* Mail / Promo Tab */}
                            {activeTab[log._id] === 'mail' && (
                                <div className="p-4 bg-background border rounded-lg shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="font-semibold flex items-center gap-2">✉ Compose Mail to {log.username}</h4>
                                        {/* Show Inventory Matched Offers button */}
                                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { if (!matchedOffers[log._id]) loadMatchedOffers(log._id, log.user_id); else setMatchedOffers(p => { const n = { ...p }; delete n[log._id]; return n; }); }} disabled={loadingMatched.has(log._id)}>
                                            <Package className="h-3 w-3 mr-1" />{loadingMatched.has(log._id) ? 'Loading...' : matchedOffers[log._id] ? 'Hide Matched' : 'Show Matched Offers'}
                                        </Button>
                                    </div>
                                    {/* Matched offers panel */}
                                    {matchedOffers[log._id] && matchedOffers[log._id].length > 0 && (
                                        <div className="mb-4 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                                            <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-2">📦 Inventory Matched Offers ({matchedOffers[log._id].length}) — based on user's searches</p>
                                            <div className="space-y-1 max-h-[150px] overflow-y-auto">
                                                {matchedOffers[log._id].map((o, i) => {
                                                    const isAdded = addedMatchedOffers.has(o.offer_id || o.name);
                                                    return (
                                                    <div key={i} className={`flex items-center justify-between p-1.5 rounded border text-xs cursor-pointer transition-colors ${isAdded ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700' : 'bg-background hover:bg-muted/50'}`}
                                                        onClick={() => {
                                                            if (!isAdded) {
                                                                const offerLine = `• ${o.name} — $${o.payout || 0} (${o.category || 'General'})`;
                                                                setMailConfig(prev => {
                                                                    // Insert before sign-off if placeholder exists, otherwise append before "Best Regards"
                                                                    let body = prev.body;
                                                                    if (body.includes('[OFFERS_PLACEHOLDER]')) {
                                                                        body = body.replace('[OFFERS_PLACEHOLDER]', offerLine + '\n[OFFERS_PLACEHOLDER]');
                                                                    } else if (body.includes('Best Regards')) {
                                                                        body = body.replace('Best Regards', offerLine + '\n\nBest Regards');
                                                                    } else {
                                                                        body = body + '\n' + offerLine;
                                                                    }
                                                                    return { ...prev, body };
                                                                });
                                                                setAddedMatchedOffers(prev => new Set(prev).add(o.offer_id || o.name));
                                                            }
                                                        }}>
                                                        <div className="flex items-center gap-2">
                                                            {isAdded && <CheckCircle className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />}
                                                            <span className={`font-medium ${isAdded ? 'text-green-700 dark:text-green-300' : ''}`}>{o.name}</span>
                                                            {o.category && <span className="text-muted-foreground">({o.category})</span>}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-green-600 font-medium">${o.payout || 0}</span>
                                                            <span className="text-[10px] text-muted-foreground">{isAdded ? '✓ added' : 'click to add'}</span>
                                                        </div>
                                                    </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    {matchedOffers[log._id] && matchedOffers[log._id].length === 0 && <p className="text-xs text-muted-foreground mb-3">No matching offers found for this user's searches</p>}
                                    <div className="space-y-3">
                                        <div><label className="text-xs text-muted-foreground block mb-1">To</label><Input value={mailConfig.to} onChange={e => setMailConfig({ ...mailConfig, to: e.target.value })} className="h-8" /></div>
                                        <div><label className="text-xs text-muted-foreground block mb-1">Subject</label><Input value={mailConfig.subject} onChange={e => setMailConfig({ ...mailConfig, subject: e.target.value })} className="h-8" /></div>
                                        <div><label className="text-xs text-muted-foreground block mb-1">Body</label><Textarea value={mailConfig.body} onChange={e => setMailConfig({ ...mailConfig, body: e.target.value })} className="min-h-[100px]" /></div>
                                        <div className="flex items-center gap-2 pt-2"><Checkbox id={`promo-${log._id}`} checked={mailConfig.usePromo} onCheckedChange={c => setMailConfig({ ...mailConfig, usePromo: !!c })} /><label htmlFor={`promo-${log._id}`} className="text-sm cursor-pointer">Include promo code</label></div>
                                        {mailConfig.usePromo && <div className="flex gap-2"><Input className="w-32 h-8" value={mailConfig.promoCode} onChange={e => setMailConfig({ ...mailConfig, promoCode: e.target.value })} placeholder="Code" /><Select value={mailConfig.promoType} onValueChange={v => setMailConfig({ ...mailConfig, promoType: v })}><SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="25% Bonus">25% Bonus</SelectItem><SelectItem value="20% Bonus">20% Bonus</SelectItem><SelectItem value="Fixed $10">Fixed $10</SelectItem></SelectContent></Select></div>}
                                        <div className="flex justify-end gap-2 pt-4 border-t border-muted">
                                            <Select value={mailConfig.isScheduled ? 'Schedule' : 'Send Now'} onValueChange={v => setMailConfig({ ...mailConfig, isScheduled: v === 'Schedule' })}><SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Send Now">Send Now</SelectItem><SelectItem value="Schedule">Schedule</SelectItem></SelectContent></Select>
                                            {mailConfig.isScheduled && <Input type="datetime-local" className="h-8 w-44 text-xs" value={mailConfig.scheduledTime} onChange={e => setMailConfig({ ...mailConfig, scheduledTime: e.target.value })} />}
                                            <Button size="sm" onClick={handleSendMail} disabled={sendingMail || !mailConfig.to}>{sendingMail ? 'Sending...' : 'Send Mail'}</Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Fraud Analysis */}
                            {((log.fraud_score && log.fraud_score > 0) || (log.fraud_flags?.length ?? 0) > 0) && (
                                <div className="mt-4">
                                    <h4 className="font-semibold mb-3 flex items-center gap-2"><Shield className="h-4 w-4" />Fraud Analysis</h4>
                                    <div className="space-y-3">
                                        {log.fraud_score > 0 && <div className="p-3 bg-background rounded border"><div className="flex items-center justify-between"><span className="text-sm font-medium">Risk Score</span><div className="flex items-center gap-2"><div className={`w-3 h-3 rounded-full ${log.fraud_score >= 76 ? 'bg-red-500' : log.fraud_score >= 51 ? 'bg-orange-500' : log.fraud_score >= 26 ? 'bg-yellow-500' : 'bg-green-500'}`} /><span className="font-bold">{log.fraud_score}/100</span><Badge variant={log.risk_level === 'critical' || log.risk_level === 'high' ? 'destructive' : 'secondary'}>{log.risk_level?.toUpperCase()}</Badge></div></div></div>}
                                        {log.fraud_flags && log.fraud_flags.length > 0 && <div className="p-3 bg-background rounded border"><div className="text-sm font-medium mb-2">Issues</div>{log.fraud_flags.map((f, i) => <div key={i} className="flex items-center gap-2 text-sm"><AlertTriangle className="h-3 w-3 text-orange-500" />{f}</div>)}</div>}
                                        {log.vpn_detection && (log.vpn_detection.is_vpn || log.vpn_detection.is_proxy) && <div className="p-3 bg-background rounded border"><div className="text-sm font-medium mb-2">Network</div><div className="grid grid-cols-2 gap-2 text-sm">{log.vpn_detection.is_vpn && <div><span className="text-muted-foreground">VPN:</span><span className="ml-2 text-red-600 font-medium">Detected</span></div>}{log.vpn_detection.is_proxy && <div><span className="text-muted-foreground">Proxy:</span><span className="ml-2 text-red-600 font-medium">Detected</span></div>}</div></div>}
                                    </div>
                                </div>
                            )}
                        </div>)}
                    </div>
                ))}</div>)}
            </CardContent></Card>
        </div>
    );
};

const AdminLoginLogsWithGuard = () => (<AdminPageGuard requiredTab="login-logs"><AdminLoginLogs /></AdminPageGuard>);
export default AdminLoginLogsWithGuard;
