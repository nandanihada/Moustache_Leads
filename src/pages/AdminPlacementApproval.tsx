import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { AdminPageGuard } from '@/components/AdminPageGuard';
import { supportApi, SupportMessage } from '@/services/supportApi';
import { API_BASE_URL as BASE_URL } from '@/services/apiConfig';
import {
  CheckCircle, XCircle, Clock, Eye, Search, Filter, RefreshCw, User, Globe,
  DollarSign, Calendar, Users, Edit, Ban, Trash2, ShieldCheck, Mail, Building,
  AlertTriangle, Shield, Activity, Zap, ChevronDown, ChevronUp, X, MessageSquare,
  Send, MapPin, Monitor, Fingerprint, Link, BarChart3, UserCheck, AlertCircle, Info
} from 'lucide-react';

const API_BASE_URL = `${BASE_URL}/api`;

// ─── Types ───
interface Publisher { id: string; username: string; email: string; firstName: string; lastName: string; companyName: string; website: string; postbackUrl: string; role: string; status: string; password: string; createdAt: string; updatedAt?: string; lastLogin?: string; placementStats: { total: number; approved: number; pending: number; rejected: number }; }
interface PlacementRequest { id: string; publisherId: string; publisherName: string; publisherEmail: string; placementIdentifier: string; platformType: string; offerwallTitle: string; currencyName: string; exchangeRate: number; postbackUrl: string; status: string; approvalStatus: string; approvedBy?: string; approvedAt?: string; rejectionReason?: string; reviewMessage?: string; createdAt: string; }
interface PublisherData { publisher: any; risk: { score: number; trustScore: number; confidence: number; level: string; flags: string[]; breakdown: { label: string; points: number }[] }; identity: any; vpn: any; loginHistory: any[]; geoLocations: any[]; clickStats: any; activeSessions: any[]; fraudSignals: any[]; }
type ActionType = 'approve' | 'reject' | 'view' | 'edit' | 'block' | 'unblock' | 'delete' | 'suspicious' | 'review' | 'edit-placement' | 'bulk-approve' | 'bulk-reject' | 'bulk-suspicious' | 'bulk-block' | 'bulk-delete' | null;

// ─── Helpers ───
const getAuthHeaders = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` });
const getInitials = (name: string) => { const p = name.trim().split(/\s+/); return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase(); };
const daysSince = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return d; } };
const fmtDateTime = (d: string) => { try { return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return d; } };

// ─── Small UI Components ───
const StatCard = ({ icon: Icon, label, count, accent }: { icon: any; label: string; count: number; accent?: 'red' | 'yellow' | 'green' | 'blue' }) => {
  const ac = { red: 'border-red-500/30 bg-red-500/5', yellow: 'border-yellow-500/30 bg-yellow-500/5', green: 'border-green-500/30 bg-green-500/5', blue: 'border-blue-500/30 bg-blue-500/5' };
  const ic = { red: 'text-red-500', yellow: 'text-yellow-500', green: 'text-green-500', blue: 'text-blue-500' };
  return (<div className={`flex-shrink-0 w-[160px] rounded-xl border p-3 shadow-sm hover:shadow-md transition-all ${accent ? ac[accent] : 'border-border bg-card'} ${accent === 'red' || accent === 'yellow' ? 'animate-pulse' : ''}`}>
    <div className="flex items-center gap-2 mb-1"><Icon className={`h-4 w-4 ${accent ? ic[accent] : 'text-muted-foreground'}`} /><span className="text-xs text-muted-foreground truncate">{label}</span></div>
    <div className="text-2xl font-bold">{count}</div>
  </div>);
};
const StatusBadge = ({ status }: { status: string }) => {
  const m: Record<string, string> = { 'PENDING_APPROVAL': 'bg-yellow-100 text-yellow-800', 'IN_REVIEW': 'bg-orange-100 text-orange-800', 'APPROVED': 'bg-green-100 text-green-800', 'REJECTED': 'bg-red-100 text-red-800', 'active': 'bg-green-100 text-green-800', 'blocked': 'bg-red-100 text-red-800' };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${m[status] || 'bg-gray-100 text-gray-800'}`}>{status.replace(/_/g, ' ')}</span>;
};
const TagChip = ({ label, variant = 'default' }: { label: string; variant?: 'default' | 'warning' | 'danger' | 'info' }) => {
  const c = { default: 'bg-gray-100 text-gray-700', warning: 'bg-yellow-100 text-yellow-800', danger: 'bg-red-100 text-red-800', info: 'bg-blue-100 text-blue-800' };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${c[variant]}`}>{label}</span>;
};
const RiskChip = ({ score }: { score: number }) => {
  const bg = score >= 70 ? 'bg-red-100 text-red-700 border-red-300' : score >= 40 ? 'bg-yellow-100 text-yellow-700 border-yellow-300' : 'bg-green-100 text-green-700 border-green-300';
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-mono font-bold ${bg}`}>{score}</span>;
};
const PulsingFlag = ({ label }: { label: string }) => (
  <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-3 py-1 text-xs font-bold text-red-600 animate-pulse"><Zap className="h-3 w-3" /> {label}</span>
);
const SectionHeader = ({ icon: Icon, title }: { icon: any; title: string }) => (
  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border"><Icon className="h-4 w-4 text-blue-500" /><h4 className="text-sm font-bold uppercase tracking-wider">{title}</h4></div>
);
const KVItem = ({ label, value, danger }: { label: string; value: string; danger?: boolean }) => (
  <div className="min-w-0"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div><div className={`text-sm font-medium break-words ${danger ? 'text-red-600' : ''}`}>{value || 'N/A'}</div></div>
);
const AnimatedBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="space-y-1"><div className="flex justify-between text-xs text-muted-foreground"><span>{label}</span><span className="font-bold">{value}%</span></div>
    <div className="h-2 rounded-full bg-muted"><div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${value}%`, background: color }} /></div></div>
);
const BehaviorCell = ({ label, value, status }: { label: string; value: string; status: 'ok' | 'warn' | 'danger' }) => {
  const colors = { ok: 'text-green-600', warn: 'text-yellow-600', danger: 'text-red-600' };
  return (<div className="rounded-lg p-3 text-center border bg-card"><div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div><div className={`text-lg font-bold font-mono ${colors[status]}`}>{value}</div></div>);
};
const ScoreDial = ({ score }: { score: number }) => {
  const r = 52, c = 2 * Math.PI * r, p = (score / 100) * c;
  const color = score >= 70 ? '#ef4444' : score >= 40 ? '#f97316' : '#22c55e';
  return (<svg width={120} height={120} className="transform -rotate-90"><circle cx={60} cy={60} r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
    <circle cx={60} cy={60} r={r} fill="none" stroke={color} strokeWidth="8" strokeDasharray={c} strokeDashoffset={c - p} strokeLinecap="round" className="transition-all duration-1000" />
    <text x={60} y={60} textAnchor="middle" dominantBaseline="central" className="fill-foreground text-2xl font-bold" transform="rotate(90, 60, 60)">{score}</text></svg>);
};

// ─── Geo Map (Leaflet lazy-loaded) ───
const GeoMap = ({ locations, expanded }: { locations: any[]; expanded: boolean }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!expanded || !mapRef.current || mapInstanceRef.current) return;
    const load = async () => {
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link'); link.id = 'leaflet-css'; link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'; document.head.appendChild(link);
      }
      if (!(window as any).L) {
        await new Promise<void>(r => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'; s.onload = () => r(); document.head.appendChild(s); });
      }
      const L = (window as any).L;
      if (!L || !mapRef.current) return;
      const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false }).setView([30, 0], 2);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);
      const coords: [number, number][] = [];
      locations.forEach(loc => {
        const lat = loc.lat || 0; const lng = loc.lng || 0;
        if (lat === 0 && lng === 0) return;
        coords.push([lat, lng]);
        L.circleMarker([lat, lng], { radius: 8, fillColor: '#3b82f6', color: '#3b82f6', weight: 2, opacity: 0.8, fillOpacity: 0.4 })
          .addTo(map).bindPopup(`<b>${loc.city || 'Unknown'}, ${loc.country || ''}</b><br/>IP: ${loc.ip || ''}`);
      });
      if (coords.length > 1) L.polyline(coords, { color: '#3b82f6', weight: 1, dashArray: '5, 10', opacity: 0.5 }).addTo(map);
      if (coords.length > 0) map.fitBounds(coords, { padding: [30, 30] });
      mapInstanceRef.current = map;
    };
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [expanded, locations]);

  useEffect(() => { return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } }; }, []);

  return <div ref={mapRef} className="w-full h-[300px] rounded-lg border bg-muted" />;
};

// ─── Expanded Panel (LIGHT THEME + REAL DATA) ───
const ExpandedPanel = ({ placement, onAction, readOnly = false }: { placement: PlacementRequest; onAction: (a: ActionType) => void; readOnly?: boolean }) => {
  const [data, setData] = useState<PublisherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapExpanded, setMapExpanded] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/admin/placement-approval/publisher-data/${placement.publisherId}`, { headers: getAuthHeaders() });
        if (res.ok) { const d = await res.json(); setData(d); setMapExpanded(true); }
      } catch (e) { console.error('Failed to fetch publisher data:', e); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [placement.publisherId]);

  if (loading) return <div className="p-8 text-center text-muted-foreground"><RefreshCw className="h-5 w-5 animate-spin inline mr-2" />Loading publisher data...</div>;

  const risk = data?.risk || { score: 0, trustScore: 100, confidence: 0, level: 'LOW', flags: [], breakdown: [] };
  const identity = data?.identity || {};
  const pub = data?.publisher || {};
  const loginHistory = data?.loginHistory || [];
  const geoLocations = data?.geoLocations || [];
  const clickStats = data?.clickStats || { total: 0, last30d: 0, conversions: 0 };
  const fraudSignals = data?.fraudSignals || [];

  return (
    <div className="rounded-b-xl overflow-hidden border-t bg-muted/20">
      {/* Sticky Action Bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-card border-b shadow-sm">
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg">{placement.publisherName}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">PUB-{placement.publisherId.slice(-6)}</span>
          <RiskChip score={risk.score} />
          <StatusBadge status={placement.approvalStatus} />
        </div>
        {!readOnly && (placement.approvalStatus === 'PENDING_APPROVAL' || placement.approvalStatus === 'IN_REVIEW') && (
          <div className="flex items-center gap-2">
            <button onClick={() => onAction('approve')} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-green-600 hover:bg-green-700 text-white">✅ Approve</button>
            <button onClick={() => onAction('reject')} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white">❌ Reject</button>
            {placement.approvalStatus === 'PENDING_APPROVAL' && <button onClick={() => onAction('review')} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-yellow-600 hover:bg-yellow-700 text-white">👁 Review</button>}
            <button onClick={() => onAction('edit-placement')} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-border hover:bg-muted">✏️ Edit</button>
            <button onClick={() => onAction('suspicious')} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white">⚠️ Suspicious</button>
          </div>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* Auto Rule Banner */}
        {risk.score >= 70 && (
          <div className="rounded-lg p-4 bg-red-50 border border-red-200">
            <div className="text-xs font-bold text-red-600 mb-1">⚡ HIGH RISK ALERT</div>
            <div className="text-xs text-red-700">Score {risk.score}/100 — {risk.flags.join(', ')}. System recommends: REJECT. Manual override available.</div>
          </div>
        )}

        {/* Card Header + Score Hero */}
        <div className="rounded-xl border bg-card p-4 flex items-center gap-6">
          <div className="flex items-center gap-4 flex-1">
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold bg-gradient-to-br from-blue-500 to-purple-500 text-white flex-shrink-0">{getInitials(placement.publisherName)}</div>
            <div>
              <div className="flex items-center gap-2"><span className="text-lg font-bold">{placement.publisherName}</span><StatusBadge status={placement.approvalStatus} />{daysSince(placement.createdAt) < 7 && <TagChip label="New User" variant="info" />}</div>
              <div className="text-sm text-muted-foreground mt-1">{placement.publisherEmail} · PUB-{placement.publisherId.slice(-6)} · {placement.platformType} · {placement.offerwallTitle}</div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {pub.emailVerified ? <TagChip label="✅ Email Verified" /> : <TagChip label="❌ Email Not Verified" variant="warning" />}
                <TagChip label={`Submitted ${fmtDate(placement.createdAt)}`} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 flex-shrink-0">
            <ScoreDial score={risk.score} />
            <div className="space-y-2 w-48">
              <div className="flex items-center gap-2"><span className={`text-sm font-bold ${risk.score >= 70 ? 'text-red-600' : risk.score >= 40 ? 'text-yellow-600' : 'text-green-600'}`}>{risk.level} RISK</span><span className="text-xs text-muted-foreground">Confidence: {risk.confidence}%</span></div>
              <AnimatedBar label="RISK" value={risk.score} color={risk.score >= 70 ? '#ef4444' : risk.score >= 40 ? '#f97316' : '#22c55e'} />
              <AnimatedBar label="TRUST" value={risk.trustScore} color="#22c55e" />
              <AnimatedBar label="CONFIDENCE" value={risk.confidence} color="#3b82f6" />
            </div>
          </div>
        </div>

        {/* Pulsing Flags */}
        {risk.flags.length > 0 && (<div className="flex flex-wrap gap-2">{risk.flags.map((f, i) => <PulsingFlag key={i} label={f} />)}</div>)}

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Risk Breakdown */}
          <div className="rounded-xl border bg-card p-4">
            <SectionHeader icon={AlertTriangle} title="Risk Score Breakdown" />
            {risk.breakdown.length > 0 ? (<div className="space-y-2">
              {risk.breakdown.map((item, i) => (<div key={i} className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="text-xs font-bold text-red-500 font-mono">+{item.points}</span><span className="text-xs">{item.label}</span></div>
                <div className="w-24 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-red-400" style={{ width: `${(item.points / 40) * 100}%` }} /></div></div>))}
              <div className="flex items-center justify-between pt-2 mt-2 border-t"><span className="text-xs font-bold">TOTAL SCORE</span><span className="text-sm font-bold font-mono text-red-600">{risk.score}/100</span></div>
            </div>) : <div className="text-xs text-muted-foreground py-2">No risk factors detected</div>}
          </div>

          {/* Identity & Contact */}
          <div className="rounded-xl border bg-card p-4">
            <SectionHeader icon={User} title="Identity & Contact" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <KVItem label="Full Name" value={`${pub.firstName || ''} ${pub.lastName || ''}`.trim() || placement.publisherName} />
              <KVItem label="Email" value={placement.publisherEmail} />
              <KVItem label="Email Verified" value={pub.emailVerified ? 'YES ✅' : 'NO ❌'} danger={!pub.emailVerified} />
              <KVItem label="Company" value={pub.companyName} />
              <KVItem label="Declared Country" value={identity.declaredCountry} />
              <KVItem label="IP Country" value={identity.ipCountry} danger={identity.declaredCountry !== identity.ipCountry && identity.ipCountry !== 'N/A'} />
            </div>
          </div>

          {/* IP & Device */}
          <div className="rounded-xl border bg-card p-4">
            <SectionHeader icon={Monitor} title="IP & Device Identity" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <KVItem label="IP Address" value={identity.ip} />
              <KVItem label="IP Type" value={identity.ipType} danger={identity.ipType?.includes('VPN') || identity.ipType?.includes('Datacenter')} />
              <KVItem label="ISP" value={identity.isp} />
              <KVItem label="Device/OS" value={identity.device} />
              <KVItem label="Browser" value={identity.browser} />
              <KVItem label="Screen Resolution" value={identity.screenRes} />
            </div>
          </div>

          {/* Placement Details */}
          <div className="rounded-xl border bg-card p-4">
            <SectionHeader icon={Globe} title="Placement Details" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <KVItem label="Offerwall Title" value={placement.offerwallTitle} />
              <KVItem label="Platform" value={placement.platformType} />
              <KVItem label="Currency" value={placement.currencyName} />
              <KVItem label="Exchange Rate" value={`1 USD = ${placement.exchangeRate}`} />
              <KVItem label="Placement ID" value={placement.placementIdentifier || 'N/A'} />
              <KVItem label="Status" value={placement.status} />
            </div>
            {placement.postbackUrl && <div className="mt-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Postback URL</div><div className="text-xs font-mono bg-muted p-2 rounded mt-1 break-all">{placement.postbackUrl}</div></div>}
          </div>
        </div>

        {/* Behavior & Click Stats */}
        <div className="rounded-xl border bg-card p-4">
          <SectionHeader icon={Activity} title="Behavior & Click Stats" />
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
            <BehaviorCell label="Total Clicks" value={String(clickStats.total)} status={clickStats.total > 3000 ? 'danger' : clickStats.total > 500 ? 'warn' : 'ok'} />
            <BehaviorCell label="Clicks (30d)" value={String(clickStats.last30d)} status={clickStats.last30d > 300 ? 'danger' : clickStats.last30d > 100 ? 'warn' : 'ok'} />
            <BehaviorCell label="Conversions" value={String(clickStats.conversions)} status="ok" />
            <BehaviorCell label="Conv Rate" value={clickStats.total > 0 ? `${((clickStats.conversions / clickStats.total) * 100).toFixed(1)}%` : '0%'} status="ok" />
          </div>
        </div>

        {/* Login History */}
        <div className="rounded-xl border bg-card p-4">
          <SectionHeader icon={Clock} title="Login History" />
          {loginHistory.length > 0 ? (
            <div className="space-y-2">
              {loginHistory.slice(0, 8).map((log, i) => {
                const loc = log.location || {};
                const dev = log.device || {};
                const isVpn = log.vpn?.is_vpn || log.vpn?.isVpn;
                const isFailed = log.status === 'failed';
                const dotColor = isFailed ? 'bg-red-500' : isVpn ? 'bg-orange-500' : log.deviceChanged ? 'bg-yellow-500' : i === 0 ? 'bg-blue-500' : 'bg-green-500';
                const labelColor = isFailed ? 'text-red-600' : isVpn ? 'text-orange-600' : log.deviceChanged ? 'text-yellow-600' : i === 0 ? 'text-blue-600' : 'text-green-600';
                const typeLabel = isFailed ? 'Failed Login' : isVpn ? 'VPN Login' : log.deviceChanged ? 'Device Change' : i === loginHistory.length - 1 ? 'Account Created' : 'Normal Login';
                return (
                  <div key={i} className="flex items-start gap-3 text-xs p-2 rounded-lg bg-muted/50">
                    <span className={`w-3 h-3 rounded-full flex-shrink-0 mt-0.5 ${dotColor}`} />
                    <div className="flex-1 min-w-0">
                      <div className={`font-bold mb-0.5 ${labelColor}`}>{typeLabel}</div>
                      <div className="text-muted-foreground">{log.email} · {log.ip} · {loc.city || ''}{loc.city && loc.country ? ', ' : ''}{loc.country_code || loc.country || ''} · {dev.browser || ''} / {dev.os || ''}</div>
                    </div>
                    <span className="text-muted-foreground whitespace-nowrap">{log.date ? fmtDateTime(log.date) : ''}</span>
                  </div>
                );
              })}
            </div>
          ) : <div className="text-xs text-muted-foreground py-2 flex items-center gap-2"><Info className="h-4 w-4" /> No login history available for this publisher</div>}
        </div>

        {/* Geo Locations */}
        {/* Geo Map — always show if login history exists */}
        {loginHistory.length > 0 && (
          <div className="rounded-xl border bg-card p-4">
            <SectionHeader icon={MapPin} title="Geographic Locations" />
            {geoLocations.some(l => l.lat && l.lng) ? (
              <GeoMap locations={geoLocations} expanded={mapExpanded} />
            ) : (
              <div className="w-full h-[200px] rounded-lg border bg-muted flex items-center justify-center text-sm text-muted-foreground">
                <MapPin className="h-5 w-5 mr-2" /> Map unavailable — no geolocation coordinates in login data
              </div>
            )}
            {geoLocations.length > 0 && (<>
            <div className="mt-3 space-y-2">
              {geoLocations.map((loc, i) => (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  <span className="font-medium">{loc.city}{loc.city && loc.country ? ', ' : ''}{loc.country}</span>
                  <span className="text-muted-foreground">· IP: {loc.ip}</span>
                  {loc.date && <span className="ml-auto text-muted-foreground">{fmtDateTime(loc.date)}</span>}
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">GEO CONSISTENCY</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${geoLocations.length > 3 ? 'bg-red-100 text-red-600' : geoLocations.length > 1 ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600'}`}>
                {geoLocations.length > 3 ? 'LOW' : geoLocations.length > 1 ? 'MEDIUM' : 'HIGH'}
              </span>
            </div>
            </>)}
          </div>
        )}

        {/* Fraud Signals */}
        {fraudSignals.length > 0 && (
          <div className="rounded-xl border bg-card p-4">
            <SectionHeader icon={Shield} title="Fraud Signals" />
            <div className="space-y-2">
              {fraudSignals.map((sig, i) => (
                <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${sig.severity === 'critical' || sig.severity === 'high' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                    <span className="font-medium">{sig.type}</span>
                    <span className="text-muted-foreground">{sig.details}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sig.severity === 'critical' ? 'bg-red-100 text-red-600' : sig.severity === 'high' ? 'bg-orange-100 text-orange-600' : 'bg-yellow-100 text-yellow-600'}`}>{sig.severity?.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Smart Signal Checks */}
        <div className="rounded-xl border bg-card p-4">
          <SectionHeader icon={Fingerprint} title="Smart Signal Checks" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
            <KVItem label="Browser TZ" value={identity.browserTz} />
            <KVItem label="IP Country" value={identity.ipCountry} />
            <KVItem label="Declared Country" value={identity.declaredCountry} />
            <KVItem label="Device Fingerprint" value={identity.fingerprint} />
            <KVItem label="Postback Tested" value={pub.postbackTested ? 'YES ✅' : 'NO ❌'} danger={!pub.postbackTested} />
            <KVItem label="Account Age" value={`${daysSince(placement.createdAt)} days`} />
          </div>
        </div>

        {/* Verdict Box */}
        <div className={`rounded-lg p-6 ${risk.score >= 70 ? 'bg-red-50 border border-red-200' : risk.score >= 40 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
          <div className={`text-lg font-bold mb-2 ${risk.score >= 70 ? 'text-red-700' : risk.score >= 40 ? 'text-yellow-700' : 'text-green-700'}`}>
            🚨 SYSTEM VERDICT: {risk.score >= 70 ? 'HIGH RISK — REJECT & BLOCK' : risk.score >= 40 ? 'WARNING — REVIEW REQUIRED' : 'LOW RISK — APPROVE'}
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            {risk.score >= 70 ? `This publisher has ${risk.flags.length} risk flags with a score of ${risk.score}/100. Recommend rejection.`
              : risk.score >= 40 ? `This publisher shows ${risk.flags.length} warning signals. Manual review recommended.`
              : 'This publisher shows minimal risk. Standard approval recommended.'}
          </p>
          {!readOnly && (placement.approvalStatus === 'PENDING_APPROVAL' || placement.approvalStatus === 'IN_REVIEW') && (
            <div className="flex items-center gap-2">
              <button onClick={() => onAction('approve')} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-green-600 hover:bg-green-700 text-white">✅ Approve</button>
              <button onClick={() => onAction('reject')} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white">❌ Reject</button>
              <button onClick={() => onAction('suspicious')} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-yellow-600 hover:bg-yellow-700 text-white">⚠️ Suspicious</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Confirmation Modal ───
const ConfirmModal = ({ open, title, message, names, confirmLabel, confirmColor, onConfirm, onCancel, loading, children }: {
  open: boolean; title: string; message: string; names?: string[]; confirmLabel: string; confirmColor: string;
  onConfirm: () => void; onCancel: () => void; loading: boolean; children?: React.ReactNode;
}) => {
  if (!open) return null;
  return (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onCancel}>
    <div className="bg-card border rounded-xl shadow-xl max-w-md w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
      <h3 className="text-lg font-bold mb-2">{title}</h3><p className="text-sm text-muted-foreground mb-3">{message}</p>
      {names && names.length > 0 && <div className="max-h-32 overflow-y-auto mb-3 p-2 rounded-lg bg-muted/50 text-xs space-y-1">{names.map((n, i) => <div key={i} className="font-medium">{n}</div>)}</div>}
      {children}
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-muted">Cancel</button>
        <button onClick={onConfirm} disabled={loading} className={`px-4 py-2 rounded-lg text-sm font-bold text-white ${confirmColor} disabled:opacity-50`}>{loading ? <RefreshCw className="h-4 w-4 animate-spin inline mr-1" /> : null}{confirmLabel}</button>
      </div>
    </div>
  </div>);
};

// ─── Support Drawer ───
const SupportDrawer = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [allUsers, setAllUsers] = useState<{ _id: string; username: string; email: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedThread, setSelectedThread] = useState<SupportMessage | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [newMsgMode, setNewMsgMode] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [newSubject, setNewSubject] = useState('');
  const [newBody, setNewBody] = useState('');
  const { toast } = useToast();
  useEffect(() => { if (open) { supportApi.adminGetAll('all').then(d => setMessages(d.messages || [])).catch(() => {}); supportApi.adminGetUsers().then(d => setAllUsers(d.users || [])).catch(() => {}); } }, [open]);
  const handleReply = async () => { if (!selectedThread || !replyText.trim()) return; setSending(true); try { await supportApi.adminReply(selectedThread._id, replyText); setReplyText(''); supportApi.adminGetAll('all').then(d => setMessages(d.messages || [])); toast({ title: 'Reply sent' }); } catch { toast({ title: 'Error', variant: 'destructive' }); } finally { setSending(false); } };
  const handleBroadcast = async () => { if (!newBody.trim() || selectedUserIds.size === 0) return; setSending(true); try { await supportApi.adminBroadcast(newSubject || 'Message from Admin', newBody, Array.from(selectedUserIds)); toast({ title: 'Sent', description: `Sent to ${selectedUserIds.size} user(s)` }); setNewMsgMode(false); setNewBody(''); setNewSubject(''); setSelectedUserIds(new Set()); } catch { toast({ title: 'Error', variant: 'destructive' }); } finally { setSending(false); } };
  const filteredUsers = allUsers.filter(u => u.username.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));
  const filteredMsgs = messages.filter(m => m.username.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase()));
  if (!open) return null;
  return (<div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
    <div className="w-full max-w-md bg-card border-l shadow-2xl h-full overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between p-4 border-b"><h3 className="font-bold flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Support</h3>
        <div className="flex items-center gap-2"><button onClick={() => setNewMsgMode(!newMsgMode)} className="px-2 py-1 rounded-lg text-xs bg-blue-600 text-white hover:bg-blue-700">{newMsgMode ? 'View Threads' : '+ New Message'}</button><button onClick={onClose} className="p-1 rounded-lg hover:bg-muted"><X className="h-5 w-5" /></button></div></div>
      <div className="p-3 border-b"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><input className="w-full pl-9 pr-3 py-2 rounded-lg border bg-background text-sm" placeholder={newMsgMode ? 'Search users...' : 'Search threads...'} value={search} onChange={e => setSearch(e.target.value)} /></div></div>
      <div className="flex-1 overflow-y-auto">
        {newMsgMode ? (<div className="p-4 space-y-3"><div className="text-xs font-medium text-muted-foreground">Select recipients:</div>
          <div className="max-h-40 overflow-y-auto space-y-1 border rounded-lg p-2">{filteredUsers.length === 0 ? <div className="text-xs text-muted-foreground text-center py-2">No users found</div> : filteredUsers.map(u => (<label key={u._id} className="flex items-center gap-2 text-xs cursor-pointer p-1 rounded hover:bg-muted"><input type="checkbox" checked={selectedUserIds.has(u._id)} onChange={() => setSelectedUserIds(prev => { const n = new Set(prev); n.has(u._id) ? n.delete(u._id) : n.add(u._id); return n; })} className="rounded" /><span className="font-medium">{u.username}</span><span className="text-muted-foreground">{u.email}</span></label>))}</div>
          {selectedUserIds.size > 0 && <div className="text-xs text-blue-500">{selectedUserIds.size} selected</div>}
          <input className="w-full px-3 py-2 rounded-lg border bg-background text-sm" placeholder="Subject..." value={newSubject} onChange={e => setNewSubject(e.target.value)} />
          <textarea className="w-full px-3 py-2 rounded-lg border bg-background text-sm resize-none" rows={4} placeholder="Message..." value={newBody} onChange={e => setNewBody(e.target.value)} />
          <button onClick={handleBroadcast} disabled={sending || !newBody.trim() || selectedUserIds.size === 0} className="w-full px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"><Send className="h-4 w-4" /> Send to {selectedUserIds.size} user(s)</button>
        </div>) : selectedThread ? (<div className="p-4 space-y-3"><button onClick={() => setSelectedThread(null)} className="text-xs text-blue-500 hover:underline">← Back</button>
          <div className="font-bold">{selectedThread.username}</div><div className="text-xs text-muted-foreground">{selectedThread.subject}</div>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto"><div className="p-2 rounded-lg bg-muted text-xs">{selectedThread.body}</div>
            {selectedThread.replies?.map((r, i) => (<div key={i} className={`p-2 rounded-lg text-xs ${r.from === 'admin' ? 'bg-blue-50 ml-4' : 'bg-muted mr-4'}`}><div className="font-bold text-[10px] mb-1">{r.from === 'admin' ? 'Admin' : selectedThread.username}</div>{r.text}<div className="text-[10px] text-muted-foreground mt-1">{fmtDateTime(r.created_at)}</div></div>))}</div>
          <div className="flex gap-2"><input className="flex-1 px-3 py-2 rounded-lg border bg-background text-sm" placeholder="Reply..." value={replyText} onChange={e => setReplyText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleReply()} /><button onClick={handleReply} disabled={sending || !replyText.trim()} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-50"><Send className="h-4 w-4" /></button></div>
        </div>) : filteredMsgs.length === 0 ? <div className="text-center py-8 text-sm text-muted-foreground">No messages</div> : filteredMsgs.map(msg => (
          <div key={msg._id} onClick={() => setSelectedThread(msg)} className="p-3 border-b hover:bg-muted/50 cursor-pointer"><div className="flex items-center justify-between mb-1"><span className="font-medium text-sm">{msg.username}</span><StatusBadge status={msg.status} /></div><div className="text-xs text-muted-foreground truncate">{msg.subject}</div><div className="text-[10px] text-muted-foreground mt-1">{fmtDateTime(msg.updated_at || msg.created_at)}</div></div>
        ))}
      </div>
    </div>
  </div>);
};

// ─── Main Component ───
const AdminPlacementApproval = () => {
  const { toast } = useToast();
  const [placements, setPlacements] = useState<PlacementRequest[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'review' | 'approved'>('pending');
  const [pagination, setPagination] = useState({ page: 1, size: 25, total: 0 });
  const [perPage, setPerPage] = useState(25);
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('PENDING_APPROVAL');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [actionModal, setActionModal] = useState<{ type: ActionType; placement?: PlacementRequest; publisher?: Publisher; names?: string[] } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', companyName: '', website: '', postbackUrl: '', email: '' });
  const [supportOpen, setSupportOpen] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => { if (searchTimeout.current) clearTimeout(searchTimeout.current); searchTimeout.current = setTimeout(() => setDebouncedSearch(searchTerm), 300); return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); }; }, [searchTerm]);

  const fetchPlacements = useCallback(async () => {
    try { setLoading(true);
      const params = new URLSearchParams({ page: pagination.page.toString(), size: perPage.toString(), status_filter: statusFilter, ...(debouncedSearch && { search: debouncedSearch }), ...(platformFilter !== 'all' && { platform_filter: platformFilter }), ...(dateFrom && { date_from: dateFrom }), ...(dateTo && { date_to: dateTo }) });
      const r = await fetch(`${API_BASE_URL}/placements/admin/all?${params}`, { headers: getAuthHeaders() });
      if (!r.ok) throw new Error(`${r.status}`); const d = await r.json();
      setPlacements(d.placements || []); setPagination(prev => ({ ...prev, total: d.total || 0 }));
    } catch (e) { toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed', variant: 'destructive' }); } finally { setLoading(false); }
  }, [pagination.page, perPage, statusFilter, debouncedSearch, platformFilter, dateFrom, dateTo]);

  const fetchPublishers = useCallback(async () => {
    try { setLoading(true);
      const params = new URLSearchParams({ page: pagination.page.toString(), size: perPage.toString(), ...(debouncedSearch && { search: debouncedSearch }) });
      const r = await fetch(`${API_BASE_URL}/admin/publishers?${params}`, { headers: getAuthHeaders() });
      if (!r.ok) throw new Error(`${r.status}`); const d = await r.json();
      setPublishers(d.publishers || []); setPagination(prev => ({ ...prev, total: d.pagination?.total || 0 }));
    } catch (e) { toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed', variant: 'destructive' }); } finally { setLoading(false); }
  }, [pagination.page, perPage, debouncedSearch]);

  useEffect(() => { if (activeTab === 'pending' || activeTab === 'review') fetchPlacements(); else fetchPublishers(); }, [activeTab, fetchPlacements, fetchPublishers]);
  useEffect(() => { setPagination(prev => ({ ...prev, page: 1 })); setSelectedIds(new Set()); }, [activeTab, perPage, debouncedSearch, statusFilter, platformFilter, dateFrom, dateTo]);
  useEffect(() => { if (activeTab === 'review') setStatusFilter('IN_REVIEW'); else if (activeTab === 'pending') setStatusFilter('PENDING_APPROVAL'); }, [activeTab]);

  const stats = useMemo(() => { const now = Date.now(), day = 86400000; return { total: pagination.total, pending: placements.filter(p => p.approvalStatus === 'PENDING_APPROVAL').length, newUsers: placements.filter(p => daysSince(p.createdAt) < 7).length, newReqs: placements.filter(p => now - new Date(p.createdAt).getTime() < day).length, approved24h: placements.filter(p => p.approvalStatus === 'APPROVED' && p.approvedAt && now - new Date(p.approvedAt).getTime() < day).length, approvedTotal: placements.filter(p => p.approvalStatus === 'APPROVED').length, rejectedTotal: placements.filter(p => p.approvalStatus === 'REJECTED').length, rejected24h: placements.filter(p => p.approvalStatus === 'REJECTED' && now - new Date(p.createdAt).getTime() < day).length }; }, [placements, pagination.total]);

  const handleApprove = async (id: string) => { try { setActionLoading(true); const r = await fetch(`${API_BASE_URL}/placements/admin/${id}/approve`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ message: actionMessage || undefined }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Failed'); toast({ title: 'Approved' }); closeModal(); fetchPlacements(); } catch (e) { toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed', variant: 'destructive' }); } finally { setActionLoading(false); } };
  const handleMarkReview = async (id: string) => { try { setActionLoading(true); const r = await fetch(`${API_BASE_URL}/placements/admin/${id}/mark-review`, { method: 'POST', headers: getAuthHeaders() }); const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Failed'); toast({ title: 'Marked for review' }); closeModal(); fetchPlacements(); } catch (e) { toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed', variant: 'destructive' }); } finally { setActionLoading(false); } };
  const handleEditPlacement = async (id: string) => { try { setActionLoading(true); const r = await fetch(`${API_BASE_URL}/placements/admin/${id}/edit`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(editForm) }); const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Failed'); toast({ title: 'Placement updated' }); closeModal(); fetchPlacements(); } catch (e) { toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed', variant: 'destructive' }); } finally { setActionLoading(false); } };
  const handleReject = async (id: string) => { if (!rejectionReason.trim()) { toast({ title: 'Rejection reason required', variant: 'destructive' }); return; } try { setActionLoading(true); const r = await fetch(`${API_BASE_URL}/placements/admin/${id}/reject`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ reason: rejectionReason, message: actionMessage || undefined }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Failed'); toast({ title: 'Rejected' }); closeModal(); fetchPlacements(); } catch (e) { toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed', variant: 'destructive' }); } finally { setActionLoading(false); } };
  const handlePublisherAction = async (pubId: string, action: string) => { try { setActionLoading(true); let r; switch (action) { case 'edit': r = await fetch(`${API_BASE_URL}/admin/publishers/${pubId}`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(editForm) }); break; case 'block': r = await fetch(`${API_BASE_URL}/admin/publishers/${pubId}/block`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ reason: blockReason }) }); break; case 'unblock': r = await fetch(`${API_BASE_URL}/admin/publishers/${pubId}/unblock`, { method: 'POST', headers: getAuthHeaders() }); break; case 'delete': r = await fetch(`${API_BASE_URL}/admin/publishers/${pubId}`, { method: 'DELETE', headers: getAuthHeaders() }); break; default: return; } if (!r!.ok) throw new Error(`Failed`); toast({ title: `Publisher ${action}ed` }); closeModal(); fetchPublishers(); } catch (e) { toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed', variant: 'destructive' }); } finally { setActionLoading(false); } };
  const handleBulkAction = async (action: string) => { const ids = Array.from(selectedIds); setActionLoading(true); let ok = 0; for (const id of ids) { try { const r = action === 'approve' ? await fetch(`${API_BASE_URL}/placements/admin/${id}/approve`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({}) }) : await fetch(`${API_BASE_URL}/placements/admin/${id}/reject`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ reason: rejectionReason || 'Bulk rejected' }) }); if (r.ok) ok++; } catch {} } toast({ title: `${ok}/${ids.length} processed` }); setSelectedIds(new Set()); closeModal(); setActionLoading(false); fetchPlacements(); };
  const closeModal = () => { setActionModal(null); setRejectionReason(''); setActionMessage(''); setBlockReason(''); };
  const toggleSelect = (id: string) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleExpand = (id: string) => setExpandedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAllOnPage = () => { const ids = placements.map(p => p.id); setSelectedIds(prev => ids.every(id => prev.has(id)) ? new Set() : new Set(ids)); };
  const totalPages = Math.ceil(pagination.total / perPage);

  return (
    <div className="space-y-4 relative">
      <button onClick={() => setSupportOpen(true)} className="fixed top-4 right-4 z-40 px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-lg flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Support</button>
      <div className="flex items-center justify-between"><div><h2 className="text-2xl font-bold tracking-tight">Placement Approval</h2><p className="text-muted-foreground text-sm">Review and manage publisher placement requests</p></div>
        <button onClick={() => activeTab === 'approved' ? fetchPublishers() : fetchPlacements()} disabled={loading} className="px-4 py-2 rounded-lg border hover:bg-muted text-sm flex items-center gap-2 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button></div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        <StatCard icon={BarChart3} label="Total Requests" count={stats.total} />
        <StatCard icon={Clock} label="Pending" count={stats.pending} accent="yellow" />
        <StatCard icon={UserCheck} label="New Users" count={stats.newUsers} accent="blue" />
        <StatCard icon={Zap} label="New (24h)" count={stats.newReqs} />
        <StatCard icon={CheckCircle} label="Approved (24h)" count={stats.approved24h} accent="green" />
        <StatCard icon={CheckCircle} label="Approved Total" count={stats.approvedTotal} accent="green" />
        <StatCard icon={XCircle} label="Rejected Total" count={stats.rejectedTotal} accent="red" />
        <StatCard icon={XCircle} label="Rejected (24h)" count={stats.rejected24h} />
      </div>

      <div className="flex border-b">
        <button onClick={() => setActiveTab('pending')} className={`px-6 py-3 text-sm font-medium border-b-2 flex items-center gap-2 ${activeTab === 'pending' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}><Clock className="h-4 w-4" /> Pending Approvals</button>
        <button onClick={() => setActiveTab('review')} className={`px-6 py-3 text-sm font-medium border-b-2 flex items-center gap-2 ${activeTab === 'review' ? 'border-yellow-500 text-yellow-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}><Eye className="h-4 w-4" /> In Review</button>
        <button onClick={() => setActiveTab('approved')} className={`px-6 py-3 text-sm font-medium border-b-2 flex items-center gap-2 ${activeTab === 'approved' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}><Users className="h-4 w-4" /> Approved Publishers</button>
      </div>

      <div><button onClick={() => setShowFilters(v => !v)} className="px-3 py-1.5 rounded-lg border hover:bg-muted text-sm flex items-center gap-2"><Filter className="h-4 w-4" /> {showFilters ? 'Collapse' : 'Expand'} Filters {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}</button>
        {showFilters && (<div className="mt-3 p-4 rounded-xl border bg-card space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div><label className="text-xs font-medium mb-1 block text-muted-foreground">Search</label><div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><input className="w-full pl-9 pr-3 py-2 rounded-lg border bg-background text-sm" placeholder="Name, email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div></div>
            <div><label className="text-xs font-medium mb-1 block text-muted-foreground">Status</label><select className="w-full px-3 py-2 rounded-lg border bg-background text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="PENDING_APPROVAL">Pending</option><option value="IN_REVIEW">In Review</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="ALL">All</option></select></div>
            <div><label className="text-xs font-medium mb-1 block text-muted-foreground">Platform</label><select className="w-full px-3 py-2 rounded-lg border bg-background text-sm" value={platformFilter} onChange={e => setPlatformFilter(e.target.value)}><option value="all">All</option><option value="iOS">iOS</option><option value="android">Android</option><option value="website">Web</option></select></div>
            <div><label className="text-xs font-medium mb-1 block text-muted-foreground">Date From</label><input type="date" className="w-full px-3 py-2 rounded-lg border bg-background text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
          </div>
          <div className="flex justify-end"><button onClick={() => { setSearchTerm(''); setStatusFilter('PENDING_APPROVAL'); setPlatformFilter('all'); setDateFrom(''); setDateTo(''); }} className="px-3 py-1.5 rounded-lg border hover:bg-muted text-xs">Clear All</button></div>
        </div>)}
      </div>

      {selectedIds.size > 0 && (<div className="flex items-center gap-3 p-3 rounded-xl border bg-muted/50">
        <span className="text-sm font-bold">{selectedIds.size} selected</span>
        <button onClick={() => setActionModal({ type: 'bulk-approve', names: placements.filter(p => selectedIds.has(p.id)).map(p => p.publisherName) })} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-green-600 hover:bg-green-700 text-white">Bulk Approve</button>
        <button onClick={() => setActionModal({ type: 'bulk-reject', names: placements.filter(p => selectedIds.has(p.id)).map(p => p.publisherName) })} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white">Bulk Reject</button>
        <button onClick={() => setSelectedIds(new Set())} className="px-3 py-1.5 rounded-lg text-xs border hover:bg-muted">Deselect All</button>
      </div>)}

      <div className="flex items-center justify-between">
        {activeTab === 'pending' && <label className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={placements.length > 0 && placements.every(p => selectedIds.has(p.id))} onChange={selectAllOnPage} className="rounded" /> Select all on page</label>}
        {activeTab !== 'pending' && <div />}
        <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">Per page:</span>{[10, 25, 50, 100].map(n => <button key={n} onClick={() => setPerPage(n)} className={`px-2 py-1 rounded text-xs ${perPage === n ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'}`}>{n}</button>)}</div>
      </div>

      {/* Pending Tab */}
      {(activeTab === 'pending' || activeTab === 'review') && (<div className="space-y-3">
        {loading ? <div className="flex items-center justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin mr-2" /> Loading...</div>
        : placements.length === 0 ? <div className="text-center py-12 text-muted-foreground">No placement requests found</div>
        : placements.map(p => { const isExp = expandedIds.has(p.id); const isSel = selectedIds.has(p.id); return (
          <div key={p.id} className={`rounded-xl border transition-all ${isSel ? 'border-primary ring-1 ring-primary/30' : ''} ${isExp ? 'shadow-lg' : 'hover:shadow-md'}`}>
            <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={e => { if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input[type=checkbox]')) return; toggleExpand(p.id); }}>
              <input type="checkbox" checked={isSel} onChange={() => toggleSelect(p.id)} className="rounded flex-shrink-0" onClick={e => e.stopPropagation()} />
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 bg-gradient-to-br from-blue-500 to-purple-500 text-white">{getInitials(p.publisherName)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap"><span className="font-medium text-sm">{p.publisherName}</span><span className="text-xs text-muted-foreground">PUB-{p.publisherId.slice(-6)}</span><span className="text-xs text-muted-foreground truncate max-w-[200px]">{p.publisherEmail}</span></div>
                <div className="flex items-center gap-2 mt-1 flex-wrap"><StatusBadge status={p.approvalStatus} />{daysSince(p.createdAt) < 7 && <TagChip label="New User" variant="info" />}<TagChip label={p.platformType} /><TagChip label={p.offerwallTitle} /><span className="text-[10px] text-muted-foreground">{fmtDate(p.createdAt)}</span></div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {(p.approvalStatus === 'PENDING_APPROVAL' || p.approvalStatus === 'IN_REVIEW') && (<><button onClick={e => { e.stopPropagation(); setActionModal({ type: 'approve', placement: p }); }} className="p-1.5 rounded-lg text-green-600 hover:bg-green-50" title="Approve"><CheckCircle className="h-4 w-4" /></button><button onClick={e => { e.stopPropagation(); setActionModal({ type: 'reject', placement: p }); }} className="p-1.5 rounded-lg text-red-600 hover:bg-red-50" title="Reject"><XCircle className="h-4 w-4" /></button></>)}
                {p.approvalStatus === 'PENDING_APPROVAL' && <button onClick={e => { e.stopPropagation(); handleMarkReview(p.id); }} className="p-1.5 rounded-lg text-yellow-600 hover:bg-yellow-50" title="Mark for Review"><Eye className="h-4 w-4" /></button>}
                <button onClick={e => { e.stopPropagation(); setEditForm({ firstName: '', lastName: '', companyName: '', website: '', postbackUrl: p.postbackUrl || '', email: '' }); setActionModal({ type: 'edit-placement', placement: p }); }} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50" title="Edit Placement"><Edit className="h-4 w-4" /></button>
                <button onClick={e => { e.stopPropagation(); setActionModal({ type: 'delete', placement: p }); }} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100" title="Delete"><Trash2 className="h-4 w-4" /></button>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExp ? 'rotate-180' : ''}`} />
              </div>
            </div>
            {isExp && <ExpandedPanel placement={p} onAction={a => setActionModal({ type: a, placement: p })} />}
          </div>); })}
      </div>)}

      {/* Approved Tab */}
      {activeTab === 'approved' && (<div className="space-y-3">
        {loading ? <div className="flex items-center justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin mr-2" /> Loading...</div>
        : publishers.length === 0 ? <div className="text-center py-12 text-muted-foreground">No publishers found</div>
        : publishers.map(pub => { const isExp = expandedIds.has(pub.id); const mock: PlacementRequest = { id: pub.id, publisherId: pub.id, publisherName: `${pub.firstName || ''} ${pub.lastName || ''}`.trim() || pub.username, publisherEmail: pub.email, placementIdentifier: '', platformType: 'website', offerwallTitle: pub.companyName || 'N/A', currencyName: 'USD', exchangeRate: 1, postbackUrl: pub.postbackUrl || '', status: 'LIVE', approvalStatus: 'APPROVED', createdAt: pub.createdAt || new Date().toISOString() }; return (
          <div key={pub.id} className={`rounded-xl border transition-all ${isExp ? 'shadow-lg' : 'hover:shadow-md'}`}>
            <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={e => { if ((e.target as HTMLElement).closest('button')) return; toggleExpand(pub.id); }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 bg-gradient-to-br from-green-500 to-blue-500 text-white">{getInitials(pub.username)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap"><span className="font-medium text-sm">{pub.username}</span><span className="text-xs text-muted-foreground">{pub.email}</span>{pub.companyName && <span className="text-xs text-muted-foreground flex items-center gap-1"><Building className="h-3 w-3" />{pub.companyName}</span>}</div>
                <div className="flex items-center gap-2 mt-1 flex-wrap"><StatusBadge status={pub.status} /><span className="text-[10px] text-muted-foreground">Placements: {pub.placementStats.total}</span>{pub.placementStats.approved > 0 && <TagChip label={`✓ ${pub.placementStats.approved} approved`} />}{pub.createdAt && <span className="text-[10px] text-muted-foreground">Joined {fmtDate(pub.createdAt)}</span>}</div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={e => { e.stopPropagation(); setActionModal({ type: 'view', publisher: pub }); }} className="p-1.5 rounded-lg hover:bg-muted"><Eye className="h-4 w-4" /></button>
                <button onClick={e => { e.stopPropagation(); setEditForm({ firstName: pub.firstName || '', lastName: pub.lastName || '', companyName: pub.companyName || '', website: pub.website || '', postbackUrl: pub.postbackUrl || '', email: pub.email || '' }); setActionModal({ type: 'edit', publisher: pub }); }} className="p-1.5 rounded-lg hover:bg-muted"><Edit className="h-4 w-4" /></button>
                {pub.status === 'active' ? <button onClick={e => { e.stopPropagation(); setActionModal({ type: 'block', publisher: pub }); }} className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"><Ban className="h-4 w-4" /></button> : <button onClick={e => { e.stopPropagation(); setActionModal({ type: 'unblock', publisher: pub }); }} className="p-1.5 rounded-lg text-green-600 hover:bg-green-50"><ShieldCheck className="h-4 w-4" /></button>}
                <button onClick={e => { e.stopPropagation(); setActionModal({ type: 'delete', publisher: pub }); }} className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExp ? 'rotate-180' : ''}`} />
              </div>
            </div>
            {isExp && <ExpandedPanel placement={mock} onAction={a => setActionModal({ type: a, publisher: pub })} readOnly />}
          </div>); })}
      </div>)}

      {/* Pagination */}
      {pagination.total > 0 && (<div className="flex items-center justify-between pt-2">
        <span className="text-xs text-muted-foreground">Showing {((pagination.page - 1) * perPage) + 1}–{Math.min(pagination.page * perPage, pagination.total)} of {pagination.total}</span>
        <div className="flex items-center gap-1"><button onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))} disabled={pagination.page <= 1} className="px-3 py-1.5 rounded-lg border text-xs disabled:opacity-50 hover:bg-muted">Prev</button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => { const s = Math.max(1, Math.min(pagination.page - 2, totalPages - 4)); const pn = s + i; if (pn > totalPages) return null; return <button key={pn} onClick={() => setPagination(p => ({ ...p, page: pn }))} className={`px-3 py-1.5 rounded-lg text-xs ${pn === pagination.page ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'}`}>{pn}</button>; })}
          <button onClick={() => setPagination(p => ({ ...p, page: Math.min(totalPages, p.page + 1) }))} disabled={pagination.page >= totalPages} className="px-3 py-1.5 rounded-lg border text-xs disabled:opacity-50 hover:bg-muted">Next</button></div>
      </div>)}

      <SupportDrawer open={supportOpen} onClose={() => setSupportOpen(false)} />

      {/* Modals */}
      <ConfirmModal open={actionModal?.type === 'approve' && !!actionModal.placement} title="Approve Placement" message={`Approve placement from ${actionModal?.placement?.publisherName}?`} confirmLabel="Approve" confirmColor="bg-green-600 hover:bg-green-700" onConfirm={() => actionModal?.placement && handleApprove(actionModal.placement.id)} onCancel={closeModal} loading={actionLoading}>
        <div className="mt-2"><label className="text-xs text-muted-foreground">Message (optional)</label><textarea className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm resize-none" rows={2} value={actionMessage} onChange={e => setActionMessage(e.target.value)} /></div>
      </ConfirmModal>
      <ConfirmModal open={actionModal?.type === 'reject' && !!actionModal.placement} title="Reject Placement" message={`Reject placement from ${actionModal?.placement?.publisherName}?`} confirmLabel="Reject" confirmColor="bg-red-600 hover:bg-red-700" onConfirm={() => actionModal?.placement && handleReject(actionModal.placement.id)} onCancel={closeModal} loading={actionLoading}>
        <div className="mt-2 space-y-2"><div><label className="text-xs text-muted-foreground">Rejection Reason *</label><textarea className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm resize-none" rows={2} value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} /></div></div>
      </ConfirmModal>
      <ConfirmModal open={actionModal?.type === 'delete' && !!actionModal.placement && !actionModal.publisher} title="Delete Placement" message={`Delete ${actionModal?.placement?.publisherName}'s placement? Cannot be undone.`} confirmLabel="Delete" confirmColor="bg-red-600 hover:bg-red-700" onConfirm={() => actionModal?.placement && handleReject(actionModal.placement.id)} onCancel={closeModal} loading={actionLoading} />
      <ConfirmModal open={actionModal?.type === 'suspicious' && !!actionModal.placement} title="Mark Suspicious" message={`Mark ${actionModal?.placement?.publisherName} as suspicious?`} confirmLabel="Mark Suspicious" confirmColor="bg-yellow-600 hover:bg-yellow-700" onConfirm={() => { toast({ title: 'Marked suspicious' }); closeModal(); }} onCancel={closeModal} loading={actionLoading} />

      {/* Edit Placement Modal */}
      <ConfirmModal open={actionModal?.type === 'edit-placement' && !!actionModal.placement} title="Edit Placement" message={`Edit placement for ${actionModal?.placement?.publisherName}`} confirmLabel="Save Changes" confirmColor="bg-blue-600 hover:bg-blue-700" onConfirm={() => actionModal?.placement && handleEditPlacement(actionModal.placement.id)} onCancel={closeModal} loading={actionLoading}>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div className="col-span-2"><label className="text-xs text-muted-foreground">Postback URL</label><input className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" value={editForm.postbackUrl} onChange={e => setEditForm(p => ({ ...p, postbackUrl: e.target.value }))} /></div>
          <div><label className="text-xs text-muted-foreground">Offerwall Title</label><input className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" defaultValue={actionModal?.placement?.offerwallTitle} onChange={e => setEditForm(p => ({ ...p, firstName: e.target.value }))} /></div>
          <div><label className="text-xs text-muted-foreground">Currency Name</label><input className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" defaultValue={actionModal?.placement?.currencyName} onChange={e => setEditForm(p => ({ ...p, lastName: e.target.value }))} /></div>
          <div><label className="text-xs text-muted-foreground">Exchange Rate</label><input className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" type="number" defaultValue={actionModal?.placement?.exchangeRate} onChange={e => setEditForm(p => ({ ...p, website: e.target.value }))} /></div>
          <div><label className="text-xs text-muted-foreground">Platform</label><select className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" defaultValue={actionModal?.placement?.platformType} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}><option value="website">Website</option><option value="iOS">iOS</option><option value="android">Android</option></select></div>
        </div>
      </ConfirmModal>

      {/* Publisher modals */}
      {actionModal?.type === 'view' && actionModal.publisher && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={closeModal}><div className="bg-card border rounded-xl shadow-xl max-w-2xl w-full mx-4 p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold">Publisher Details</h3><button onClick={closeModal} className="p-1 rounded-lg hover:bg-muted"><X className="h-5 w-5" /></button></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs text-muted-foreground">Username</label><p className="text-sm font-mono bg-muted p-2 rounded mt-1">{actionModal.publisher.username}</p></div>
          <div><label className="text-xs text-muted-foreground">Email</label><p className="text-sm font-mono bg-muted p-2 rounded mt-1">{actionModal.publisher.email}</p></div>
          <div><label className="text-xs text-muted-foreground">Name</label><p className="text-sm bg-muted p-2 rounded mt-1">{actionModal.publisher.firstName} {actionModal.publisher.lastName}</p></div>
          <div><label className="text-xs text-muted-foreground">Company</label><p className="text-sm bg-muted p-2 rounded mt-1">{actionModal.publisher.companyName || 'N/A'}</p></div>
          <div><label className="text-xs text-muted-foreground">Website</label><p className="text-sm bg-muted p-2 rounded mt-1 break-all">{actionModal.publisher.website || 'N/A'}</p></div>
          <div><label className="text-xs text-muted-foreground">Status</label><div className="mt-1"><StatusBadge status={actionModal.publisher.status} /></div></div>
          <div className="col-span-2"><label className="text-xs text-muted-foreground">Postback URL</label><p className="text-sm font-mono bg-muted p-2 rounded mt-1 break-all">{actionModal.publisher.postbackUrl || 'N/A'}</p></div>
          <div><label className="text-xs text-muted-foreground">Placements</label><p className="text-sm bg-muted p-2 rounded mt-1">Total: {actionModal.publisher.placementStats.total} · Approved: {actionModal.publisher.placementStats.approved}</p></div>
          <div><label className="text-xs text-muted-foreground">Joined</label><p className="text-sm bg-muted p-2 rounded mt-1">{actionModal.publisher.createdAt ? fmtDate(actionModal.publisher.createdAt) : 'N/A'}</p></div>
        </div>
      </div></div>)}
      <ConfirmModal open={actionModal?.type === 'edit' && !!actionModal.publisher} title="Edit Publisher" message={`Edit ${actionModal?.publisher?.username}`} confirmLabel="Save" confirmColor="bg-primary hover:bg-primary/90" onConfirm={() => actionModal?.publisher && handlePublisherAction(actionModal.publisher.id, 'edit')} onCancel={closeModal} loading={actionLoading}>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div><label className="text-xs text-muted-foreground">First Name</label><input className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" value={editForm.firstName} onChange={e => setEditForm(p => ({ ...p, firstName: e.target.value }))} /></div>
          <div><label className="text-xs text-muted-foreground">Last Name</label><input className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" value={editForm.lastName} onChange={e => setEditForm(p => ({ ...p, lastName: e.target.value }))} /></div>
          <div><label className="text-xs text-muted-foreground">Email</label><input className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} /></div>
          <div><label className="text-xs text-muted-foreground">Company</label><input className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" value={editForm.companyName} onChange={e => setEditForm(p => ({ ...p, companyName: e.target.value }))} /></div>
          <div className="col-span-2"><label className="text-xs text-muted-foreground">Website</label><input className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" value={editForm.website} onChange={e => setEditForm(p => ({ ...p, website: e.target.value }))} /></div>
        </div>
      </ConfirmModal>
      <ConfirmModal open={actionModal?.type === 'block' && !!actionModal.publisher} title="Block Publisher" message={`Block ${actionModal?.publisher?.username}?`} confirmLabel="Block" confirmColor="bg-red-600 hover:bg-red-700" onConfirm={() => actionModal?.publisher && handlePublisherAction(actionModal.publisher.id, 'block')} onCancel={closeModal} loading={actionLoading}>
        <div className="mt-2"><label className="text-xs text-muted-foreground">Reason</label><textarea className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm resize-none" rows={2} value={blockReason} onChange={e => setBlockReason(e.target.value)} /></div>
      </ConfirmModal>
      <ConfirmModal open={actionModal?.type === 'unblock' && !!actionModal.publisher} title="Unblock Publisher" message={`Restore access for ${actionModal?.publisher?.username}?`} confirmLabel="Unblock" confirmColor="bg-green-600 hover:bg-green-700" onConfirm={() => actionModal?.publisher && handlePublisherAction(actionModal.publisher.id, 'unblock')} onCancel={closeModal} loading={actionLoading} />
      <ConfirmModal open={actionModal?.type === 'delete' && !!actionModal.publisher} title="Delete Publisher" message={`Permanently delete ${actionModal?.publisher?.username}?`} confirmLabel="Delete" confirmColor="bg-red-600 hover:bg-red-700" onConfirm={() => actionModal?.publisher && handlePublisherAction(actionModal.publisher.id, 'delete')} onCancel={closeModal} loading={actionLoading}>
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 mt-2"><p className="text-xs text-red-800 font-medium">⚠️ This will permanently delete the publisher and all their placements.</p></div>
      </ConfirmModal>
      <ConfirmModal open={actionModal?.type === 'bulk-approve'} title="Bulk Approve" message={`Approve ${selectedIds.size} placement(s)?`} names={actionModal?.names} confirmLabel="Approve All" confirmColor="bg-green-600 hover:bg-green-700" onConfirm={() => handleBulkAction('approve')} onCancel={closeModal} loading={actionLoading} />
      <ConfirmModal open={actionModal?.type === 'bulk-reject'} title="Bulk Reject" message={`Reject ${selectedIds.size} placement(s)?`} names={actionModal?.names} confirmLabel="Reject All" confirmColor="bg-red-600 hover:bg-red-700" onConfirm={() => handleBulkAction('reject')} onCancel={closeModal} loading={actionLoading}>
        <div className="mt-2"><label className="text-xs text-muted-foreground">Reason</label><textarea className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm resize-none" rows={2} value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} /></div>
      </ConfirmModal>
    </div>
  );
};

const AdminPlacementApprovalWithGuard = () => (<AdminPageGuard requiredTab="placement-approval"><AdminPlacementApproval /></AdminPageGuard>);
export default AdminPlacementApprovalWithGuard;
