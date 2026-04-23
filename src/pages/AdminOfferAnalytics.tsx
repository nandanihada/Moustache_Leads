import React, { useState, useMemo, useEffect } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid 
} from "recharts";
import { 
  TrendingUp, MousePointerClick, Eye, Shield, Globe, Layers, 
  RefreshCw, CheckCircle, XCircle, MapPin
} from "lucide-react";
import { adminOfferApi, Offer, RunningOffer } from "../services/adminOfferApi";
import { toast } from "sonner";
import { ErrorBoundary } from "../components/ErrorBoundary";

// Tailwind colors mapping
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f43f5e', '#84cc16'];

export default function AdminOfferAnalytics() {
  const [timeFilter, setTimeFilter] = useState<'today' | '7days' | '30days' | 'custom' | 'all'>('all');
  const [customDays, setCustomDays] = useState<number>(14);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [runningOffers, setRunningOffers] = useState<RunningOffer[]>([]);
  const [rotatingIds, setRotatingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const days = timeFilter === 'today' ? 1 : 
                     timeFilter === '7days' ? 7 : 
                     timeFilter === '30days' ? 30 : 
                     timeFilter === 'custom' ? customDays : 
                     3650;
        const rotStatus = await adminOfferApi.getRotationStatus().catch(() => null);
        const rIds = rotStatus?.running_offer_ids || rotStatus?.current_batch_ids;
        if (rIds) setRotatingIds(new Set(rIds));

        // Aggregate All Running Offers (Pagination)
        let allRunning: RunningOffer[] = [];
        let rPage = 1;
        let rTotal = 1;

        while (allRunning.length < rTotal) {
          const runRes = await adminOfferApi.getRunningOffers({ page: rPage, per_page: 2000, days }).catch(() => ({ offers: [], running_offers: [], pagination: { total: 0, pages: 0 } }));
          const pageOffers = runRes.offers || (runRes as any).running_offers || [];
          if (!pageOffers || pageOffers.length === 0) break;
          allRunning = [...allRunning, ...pageOffers];
          rTotal = runRes.pagination?.total || 0;
          if (allRunning.length >= rTotal || rPage >= (runRes.pagination?.pages || 0)) break;
          rPage++;
        }
        setRunningOffers(allRunning);

        // Aggregate All Parent Offers (Pagination)
        let page = 1;
        let total = 1;
        let all: Offer[] = [];

        while (all.length < total) {
          const res = await adminOfferApi.getOffers({ page, per_page: 2000 }).catch(() => ({ offers: [], pagination: { total: 0, pages: 0 } }));
          if (!res.offers) break;
          all = [...all, ...res.offers];
          total = res.pagination?.total || 0;
          if (all.length >= total || page >= (res.pagination?.pages || 0)) break;
          page++;
        }
        setOffers(all);
      } catch (error) {
        toast.error("Failed to load analytics data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [timeFilter, customDays]);

  const runningStatsMap = useMemo(() => {
    const map = new Map<string, RunningOffer>();
    runningOffers.forEach(ro => {
      if (ro.offer_id) map.set(ro.offer_id, ro);
      if (ro._id) map.set(ro._id, ro);
    });
    return map;
  }, [runningOffers]);

  const filteredOffers = useMemo(() => {
    if (timeFilter === 'all') return offers;

    const now = Date.now();
    const cutoff = timeFilter === 'today' ? now - 86400000 : 
                   timeFilter === '7days' ? now - 7 * 86400000 : 
                   timeFilter === '30days' ? now - 30 * 86400000 : 
                   timeFilter === 'custom' ? now - customDays * 86400000 :
                   0;
                   
    return offers.filter(o => {
      const d = o.updated_at ? new Date(o.updated_at).getTime() : 
                o.created_at ? new Date(o.created_at).getTime() : now;
      const hasActivity = runningStatsMap.has(o.offer_id) || runningStatsMap.has((o as any)._id);
      return d >= cutoff || hasActivity;
    });
  }, [offers, timeFilter, customDays, runningStatsMap]);

  // Aggregation Logic
  const analytics = useMemo(() => {

    const networkMap = new Map<string, any>();
    const verticalMap = new Map<string, number>();
    const geoMap = new Map<string, number>();
    const statusCounts = { active: 0, inactive: 0, running: 0, rotating: 0, approved: 0, rejected: 0, requested: 0, picked: 0 };
    
    let totalViews = 0;
    let totalClicks = 0;
    
    filteredOffers.forEach(o => {
      // Basic counts
      if (o.status === 'active') statusCounts.active++;
      if (o.status === 'inactive') statusCounts.inactive++;
      
      const rs = runningStatsMap.get(o.offer_id) || runningStatsMap.get((o as any)._id);
      const views = (o as any).hits || 0;
      const clicks = rs?.total_clicks || 0;
      
      totalViews += views;
      totalClicks += clicks;

      if (rs) statusCounts.running++;
      if (o.smart_rules?.rotation_enabled || (o as any).rotation_enabled || rotatingIds.has(o.offer_id) || rotatingIds.has((o as any)._id)) statusCounts.rotating++;
      
      // Approval stats + Sub-statuses
      const hasSub = (state: string) => rs?.sub_statuses?.some(s => s.toLowerCase() === state.toLowerCase());
      statusCounts.approved += rs?.action_counts?.['approved'] || (hasSub('approved') ? 1 : 0);
      statusCounts.rejected += rs?.action_counts?.['rejected'] || (hasSub('rejected') ? 1 : 0);
      statusCounts.requested += rs?.action_counts?.['requested'] || (hasSub('requested') ? 1 : 0);
      statusCounts.picked += rs?.action_counts?.['picked'] || (hasSub('picked') ? 1 : 0);

      // Vertical breakdown
      const v = o.vertical || o.category || 'Other';
      verticalMap.set(v, (verticalMap.get(v) || 0) + 1);

      // Geo breakdown
      o.countries?.forEach(c => {
        geoMap.set(c, (geoMap.get(c) || 0) + 1);
      });

      // Network aggregation
      const net = o.network || 'Unknown';
      if (!networkMap.has(net)) {
        networkMap.set(net, { network: net, offers: 0, active: 0, views: 0, clicks: 0, efficiency: 0 });
      }
      const nData = networkMap.get(net);
      nData.offers++;
      if (o.status === 'active') nData.active++;
      nData.views += views;
      nData.clicks += clicks;
      nData.efficiency = nData.views > 0 ? ((nData.clicks / nData.views) * 100).toFixed(2) : 0;
    });

    // Formatting for charts
    const networksChart = Array.from(networkMap.values())
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10);

    const verticalsChart = Array.from(verticalMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const geoChart = Array.from(geoMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
      
    const statusChart = [
      { name: 'Active', value: statusCounts.active, color: '#10b981' },
      { name: 'Inactive', value: statusCounts.inactive, color: '#52525b' },
      { name: 'Running', value: statusCounts.running, color: '#3b82f6' },
      { name: 'Rotating', value: statusCounts.rotating, color: '#8b5cf6' },
      { name: 'Approved', value: statusCounts.approved, color: '#059669' },
      { name: 'Rejected', value: statusCounts.rejected, color: '#dc2626' },
      { name: 'Requested', value: statusCounts.requested, color: '#d97706' },
      { name: 'Picked', value: statusCounts.picked, color: '#c026d3' }
    ].filter(item => item.value > 0);

    return { 
      totalOffers: filteredOffers.length, 
      totalActive: statusCounts.active,
      totalViews, totalClicks, 
      overallEfficiency: totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(2) : 0,
      networksChart, verticalsChart, geoChart, statusChart, statusCounts,
      allNetworks: Array.from(networkMap.values()).sort((a, b) => b.efficiency - a.efficiency)
    };
  }, [filteredOffers, runningStatsMap, rotatingIds]);

  const deepDiveAnalytics = useMemo(() => {
    if (!selectedMetric) return null;

    const ddNetworkMap = new Map<string, any>();
    const ddVerticalMap = new Map<string, number>();
    const ddGeoMap = new Map<string, number>();
    let ddTotalClicks = 0;
    let ddTotalOffers = 0;
    const ddOffersList: any[] = [];

    filteredOffers.forEach(o => {
      const rs = runningStatsMap.get(o.offer_id) || runningStatsMap.get((o as any)._id);
      const isRotating = o.smart_rules?.rotation_enabled || (o as any).rotation_enabled || rotatingIds.has(o.offer_id) || rotatingIds.has((o as any)._id);
      const hasSub = (state: string) => rs?.sub_statuses?.some(s => s.toLowerCase() === state.toLowerCase());

      let matches = false;
      if (selectedMetric === 'Active' && o.status === 'active') matches = true;
      else if (selectedMetric === 'Inactive' && o.status === 'inactive') matches = true;
      else if (selectedMetric === 'Running' && rs) matches = true;
      else if (selectedMetric === 'Rotating' && isRotating) matches = true;
      else if (selectedMetric === 'Approved' && (rs?.action_counts?.['approved'] || hasSub('approved'))) matches = true;
      else if (selectedMetric === 'Rejected' && (rs?.action_counts?.['rejected'] || hasSub('rejected'))) matches = true;
      else if (selectedMetric === 'Requested' && (rs?.action_counts?.['requested'] || hasSub('requested'))) matches = true;
      else if (selectedMetric === 'Picked' && (rs?.action_counts?.['picked'] || hasSub('picked'))) matches = true;

      if (!matches) return;

      ddTotalOffers++;
      const clicks = rs?.total_clicks || 0;
      ddTotalClicks += clicks;

      ddOffersList.push({
        offer_id: o.offer_id,
        name: o.name,
        network: o.network || 'Unknown',
        vertical: o.vertical || o.category || 'Unknown',
        status: o.status,
        clicks
      });

      const v = o.vertical || o.category || 'Other';
      ddVerticalMap.set(v, (ddVerticalMap.get(v) || 0) + 1);

      o.countries?.forEach(c => ddGeoMap.set(c, (ddGeoMap.get(c) || 0) + 1));

      const net = o.network || 'Unknown';
      if (!ddNetworkMap.has(net)) ddNetworkMap.set(net, { network: net, offers: 0, clicks: 0 });
      const nData = ddNetworkMap.get(net);
      nData.offers++;
      nData.clicks += clicks;
    });

    return {
      totalOffers: ddTotalOffers,
      totalClicks: ddTotalClicks,
      offersList: ddOffersList.sort((a, b) => b.clicks - a.clicks),
      networksChart: Array.from(ddNetworkMap.values()).sort((a, b) => b.clicks - a.clicks).slice(0, 10),
      verticalsChart: Array.from(ddVerticalMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8),
      geoChart: Array.from(ddGeoMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8)
    };
  }, [filteredOffers, runningStatsMap, rotatingIds, selectedMetric]);

  if (loading) {
    return (
      <div className="p-6 bg-[#030303] min-h-screen flex items-center justify-center text-white flex-col space-y-4">
         <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
         <p className="font-bold tracking-widest text-zinc-500 uppercase">Loading advanced analytics...</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="p-6 bg-[#030303] min-h-screen text-white space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
            <TrendingUp className="text-blue-500" /> Offer Analytics Engine
          </h1>
          <p className="text-sm text-zinc-500">Comprehensive efficiency & network performance insights</p>
        </div>
        
        <div className="flex gap-2 bg-white/5 p-1 rounded-xl items-center">
          {['today', '7days', '30days', 'custom', 'all'].map(t => (
            <button key={t} onClick={() => setTimeFilter(t as any)}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg uppercase transition-colors ${timeFilter === t ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-zinc-400 hover:text-white'}`}>
              {t === 'today' ? 'Today' : t === '7days' ? 'Last 7 Days' : t === '30days' ? 'Last 30 Days' : t === 'custom' ? 'Custom' : 'All Time'}
            </button>
          ))}
          {timeFilter === 'custom' && (
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-white/10 animate-in fade-in slide-in-from-left-4">
              <input 
                type="number" 
                min="1" 
                max="365"
                value={customDays || ''}
                onChange={(e) => setCustomDays(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 bg-[#000] border border-white/10 text-white text-xs font-bold px-2 py-1.5 rounded-lg focus:outline-none focus:border-blue-500 text-center"
              />
              <span className="text-xs font-bold text-zinc-500 uppercase">Days</span>
            </div>
          )}
        </div>
      </div>

      {/* Top Summary Cards */}
      <h2 className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mt-6 mb-2">Click any card metrics to generate a Deep Dive view</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Offers", metricName: null, val: analytics.totalOffers, icon: Layers, color: "text-zinc-500" },
          { label: "Active Offers", metricName: "Active", val: analytics.totalActive, icon: CheckCircle, color: "text-emerald-500" },
          { label: "Inactive Offers", metricName: "Inactive", val: analytics.statusCounts.inactive, icon: XCircle, color: "text-red-500" },
          { label: "Total Clicks", metricName: null, val: analytics.totalClicks.toLocaleString(), icon: MousePointerClick, color: "text-cyan-500" }
        ].map((c, i) => (
          <div 
            key={i} 
            onClick={() => c.metricName && setSelectedMetric(c.metricName)}
            className={`bg-[#0a0a0b] border border-white/5 p-5 rounded-2xl relative overflow-hidden transition-all ${c.metricName ? 'cursor-pointer hover:border-blue-500/30 group' : ''}`}
          >
            <div className={`absolute top-0 right-0 p-4 opacity-10 transition-opacity ${c.color} ${c.metricName ? 'group-hover:opacity-20 group-hover:scale-110' : ''}`}>
              <c.icon className="w-12 h-12" />
            </div>
            <p className="text-[10px] font-black tracking-widest text-zinc-500 uppercase">{c.label}</p>
            <p className="text-2xl font-black mt-2">{c.val}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Network Performance Bar Chart */}
        <div className="lg:col-span-2 bg-[#0a0a0b] border border-white/5 p-5 rounded-2xl">
          <h2 className="text-xs font-black uppercase text-zinc-400 mb-6 flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-500" /> Top Networks by Clicks
          </h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.networksChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="network" stroke="#ffffff50" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#ffffff50" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: '#ffffff05' }} contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                <Bar dataKey="clicks" name="Total Clicks" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="active" name="Active Offers" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Breakdown Pie */}
        <div className="bg-[#0a0a0b] border border-white/5 p-5 rounded-2xl">
          <h2 className="text-xs font-black uppercase text-zinc-400 mb-6 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-emerald-500" /> Operational Status
          </h2>
          <div className="h-[300px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              {analytics.totalOffers === 0 ? (
                <div className="h-full flex items-center justify-center font-black uppercase text-xl text-zinc-700 tracking-widest">No Activity</div>
              ) : (
                <PieChart>
                  <Pie data={analytics.statusChart} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={0} minAngle={5} dataKey="value">
                    {analytics.statusChart.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color} 
                        onClick={() => setSelectedMetric(entry.name)} 
                        className="cursor-pointer hover:opacity-80 transition-opacity outline-none" 
                        style={{ outline: "none" }}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #ffffff20', borderRadius: '8px' }} itemStyle={{ color: '#fff' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* GEOs Chart */}
        <div className="bg-[#0a0a0b] border border-white/5 p-5 rounded-2xl">
           <h2 className="text-xs font-black uppercase text-zinc-400 mb-6 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-500" /> Top GEOs Coverage
          </h2>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.geoChart} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={false} />
                <XAxis type="number" stroke="#ffffff50" fontSize={10} hide />
                <YAxis dataKey="name" type="category" stroke="#ffffff50" fontSize={10} width={40} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: '#ffffff05' }} contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }} />
                <Bar dataKey="count" name="Total Offers" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Verticals Chart */}
        <div className="bg-[#0a0a0b] border border-white/5 p-5 rounded-2xl">
           <h2 className="text-xs font-black uppercase text-zinc-400 mb-6 flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-500" /> Top Verticals Coverage
          </h2>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.verticalsChart} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={false} />
                <XAxis type="number" stroke="#ffffff50" fontSize={10} hide />
                <YAxis dataKey="name" type="category" stroke="#ffffff50" fontSize={10} width={100} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: '#ffffff05' }} contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }} />
                <Bar dataKey="count" name="Total Offers" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Network Ranking Table */}
        <div className="bg-[#0a0a0b] border border-white/5 p-5 rounded-2xl flex flex-col">
          <h2 className="text-xs font-black uppercase text-zinc-400 mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-red-500" /> Network Activity Ranking
          </h2>
          <div className="flex-1 overflow-auto pr-2">
            <div className="grid grid-cols-4 text-[9px] font-black uppercase text-zinc-600 tracking-widest pb-2 border-b border-white/5 mb-2">
              <span className="col-span-2">Network</span>
              <span className="text-right">Offers</span>
              <span className="text-right">Clicks</span>
            </div>
            {analytics.allNetworks.map((net, i) => (
              <div key={i} className="grid grid-cols-4 items-center py-2 border-b border-white/5 hover:bg-white/5 transition-colors text-xs font-bold px-1 rounded">
                <span className="col-span-2 truncate pr-2" title={net.network}>{net.network}</span>
                <span className="text-right text-zinc-400">{net.offers}</span>
                <span className="text-right text-cyan-400">{net.clicks.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* DEEP DIVE SECTION */}
      {selectedMetric && deepDiveAnalytics && (
        <div className="mt-12 mb-12 bg-blue-900/10 border border-blue-500/20 rounded-[32px] p-8 space-y-8 animate-in fade-in slide-in-from-bottom-8">
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-blue-500/10 pb-6">
            <div>
              <h2 className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                <Shield className="text-blue-500 w-8 h-8" /> {selectedMetric} Offers Deep Dive
              </h2>
              <p className="text-xs font-bold text-blue-400/80 uppercase mt-2 tracking-widest">Displaying analytics specifically tied to {selectedMetric} status</p>
            </div>
            <button onClick={() => setSelectedMetric(null)} className="px-6 py-3 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 text-white rounded-xl uppercase font-black text-xs tracking-widest transition-colors self-start md:self-auto shadow-lg shadow-blue-500/10">
              Close Deep Dive View
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="bg-[#0a0a0b] p-6 rounded-2xl border border-white/5 flex items-center gap-6">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                  <Layers className="w-8 h-8 text-blue-500" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-1">Total {selectedMetric} Offers</p>
                  <p className="text-5xl font-black text-white leading-none">{deepDiveAnalytics.totalOffers}</p>
                </div>
             </div>
             <div className="bg-[#0a0a0b] p-6 rounded-2xl border border-white/5 flex items-center gap-6">
                <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                  <MousePointerClick className="w-8 h-8 text-cyan-500" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-1">{selectedMetric} Clicks Matrix</p>
                  <p className="text-5xl font-black text-white leading-none">{deepDiveAnalytics.totalClicks.toLocaleString()}</p>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-[#0a0a0b] p-6 rounded-2xl border border-white/5 lg:col-span-2">
              <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-6 flex items-center gap-2"><Globe className="w-4 h-4" /> Top Networks driving {selectedMetric}</h3>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deepDiveAnalytics.networksChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis dataKey="network" stroke="#ffffff50" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#ffffff50" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: '#ffffff05' }} contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }} />
                    <Bar dataKey="clicks" name="Total Clicks" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-[#0a0a0b] p-6 rounded-2xl border border-white/5 flex flex-col gap-6 overflow-hidden">
               <div className="flex-1">
                 <h3 className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Layers className="w-4 h-4" /> {selectedMetric} Verticals Context</h3>
                  <div className="h-[120px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={deepDiveAnalytics.verticalsChart} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={false} />
                        <XAxis type="number" stroke="#ffffff50" fontSize={10} hide />
                        <YAxis dataKey="name" type="category" stroke="#ffffff50" fontSize={8} width={80} tickLine={false} axisLine={false} />
                        <Tooltip cursor={{ fill: '#ffffff05' }} contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }} />
                        <Bar dataKey="count" name="Total Offers" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
               </div>
               
               <div className="flex-1">
                 <h3 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2"><MapPin className="w-4 h-4" /> {selectedMetric} Top GEOs</h3>
                  <div className="h-[120px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={deepDiveAnalytics.geoChart} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={false} />
                        <XAxis type="number" stroke="#ffffff50" fontSize={10} hide />
                        <YAxis dataKey="name" type="category" stroke="#ffffff50" fontSize={8} width={40} tickLine={false} axisLine={false} />
                        <Tooltip cursor={{ fill: '#ffffff05' }} contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }} />
                        <Bar dataKey="count" name="Total Offers" fill="#10b981" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
               </div>
            </div>
          </div>

          {/* DETAILED LOG TABLE */}
          <div className="bg-[#0a0a0b] p-6 rounded-2xl border border-white/5 flex flex-col mt-6 shadow-xl relative overflow-hidden">
             {/* Decorative Background Accent */}
             <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[80px] pointer-events-none -mr-10 -mt-10"></div>
             
             <h3 className="text-[10px] font-black text-white uppercase tracking-[0.25em] mb-6 flex items-center gap-3">
               <div className="w-6 h-6 rounded bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                  <Layers className="w-3 h-3 text-blue-400" />
               </div>
               Individual Offer Performance Log
             </h3>
             
             <div className="overflow-x-auto w-full custom-scrollbar pr-2 max-h-[450px]">
                <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
                  <thead className="bg-[#050505]/95 sticky top-0 z-10 before:absolute before:inset-0 before:border-b before:border-white/10 before:-z-10 backdrop-blur-sm">
                    <tr>
                      <th className="p-4 text-zinc-500 font-bold uppercase tracking-wider">Offer ID</th>
                      <th className="p-4 text-zinc-500 font-bold uppercase tracking-wider">Name / Campaign</th>
                      <th className="p-4 text-zinc-500 font-bold uppercase tracking-wider">Network</th>
                      <th className="p-4 text-zinc-500 font-bold uppercase tracking-wider">Vertical / Meta</th>
                      <th className="p-4 text-zinc-500 font-bold uppercase tracking-wider">Status</th>
                      <th className="p-4 text-zinc-500 font-bold uppercase tracking-wider text-right">Recorded Clicks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 relative z-0">
                    {deepDiveAnalytics.offersList.map((offer, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="p-4 font-mono text-[10px] text-zinc-500 group-hover:text-blue-400 transition-colors">#{offer.offer_id}</td>
                        <td className="p-4 text-white font-bold max-w-[200px] truncate">{offer.name}</td>
                        <td className="p-4 text-zinc-400">
                           <span className="px-2 py-1 rounded bg-white/5 text-[10px] uppercase font-bold tracking-wider">{offer.network}</span>
                        </td>
                        <td className="p-4 text-zinc-400 text-[10px] uppercase tracking-wider font-bold">{offer.vertical}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-[0.1em] shadow-sm ${
                            offer.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                            'bg-zinc-800 text-zinc-400 border border-zinc-700'
                          }`}>
                            {offer.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                             {offer.clicks > 0 && <MousePointerClick className="w-3 h-3 text-cyan-500/50" />}
                             <span className={`font-mono font-black text-[13px] ${offer.clicks > 0 ? 'text-cyan-400' : 'text-zinc-600'}`}>
                               {offer.clicks.toLocaleString()}
                             </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {deepDiveAnalytics.offersList.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-16 text-center">
                           <div className="flex flex-col items-center justify-center space-y-4 opacity-50">
                              <Shield className="w-12 h-12 text-zinc-600" />
                              <p className="text-zinc-400 uppercase font-black tracking-widest text-[10px]">No recorded sessions found for this category segment.</p>
                           </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
             </div>
          </div>
        </div>
      )}

      </div>
    </ErrorBoundary>
  );
}
