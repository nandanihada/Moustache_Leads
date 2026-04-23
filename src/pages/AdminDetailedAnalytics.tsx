import React, { useState, useMemo, useEffect } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid 
} from "recharts";
import { TrendingUp, Globe, Layers, MapPin, Activity, Calendar as CalendarIcon, Filter } from "lucide-react";
import { adminOfferApi, Offer, RunningOffer } from "@/services/adminOfferApi";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";

interface Props {
  type: 'network' | 'vertical' | 'geo' | 'status';
}

const METRICS = [
  { key: 'active', color: '#10b981', name: 'Active' },
  { key: 'inactive', color: '#ef4444', name: 'Inactive' },
  { key: 'running', color: '#3b82f6', name: 'Running' },
  { key: 'rotating', color: '#8b5cf6', name: 'Rotating' },
  { key: 'approved', color: '#059669', name: 'Approved' },
  { key: 'rejected', color: '#dc2626', name: 'Rejected' },
  { key: 'requested', color: '#f59e0b', name: 'Requested' },
  { key: 'picked', color: '#6366f1', name: 'Picked' },
  { key: 'viewed', color: '#84cc16', name: 'Viewed' },
  { key: 'clicked', color: '#06b6d4', name: 'Clicked' },
];

export default function AdminDetailedAnalytics({ type }: Props) {
  const [timeFilter, setTimeFilter] = useState<'today' | '7days' | '30days' | 'all' | 'custom'>('all');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  
  const [offers, setOffers] = useState<Offer[]>([]);
  const [runningOffers, setRunningOffers] = useState<RunningOffer[]>([]);
  const [rotatingIds, setRotatingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const rotStatus = await adminOfferApi.getRotationStatus().catch(() => null);
        const rIds = rotStatus?.running_offer_ids || rotStatus?.current_batch_ids;
        if (rIds) setRotatingIds(new Set(rIds));

        let allRunning: RunningOffer[] = [];
        let rPage = 1;
        let rTotal = 1;
        while (allRunning.length < rTotal) {
          const runRes = await adminOfferApi.getRunningOffers({ page: rPage, per_page: 2000, days: 365 }).catch(() => ({ offers: [], running_offers: [], pagination: { total: 0, pages: 0 } }));
          const pageOffers = runRes.offers || (runRes as any).running_offers || [];
          if (!pageOffers || pageOffers.length === 0) break;
          allRunning = [...allRunning, ...pageOffers];
          rTotal = runRes.pagination?.total || 0;
          if (allRunning.length >= rTotal || rPage >= (runRes.pagination?.pages || 0)) break;
          rPage++;
        }
        setRunningOffers(allRunning);

        let all: Offer[] = [];
        let page = 1;
        let total = 1;
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
        toast.error("Failed to load analytics data: " + (error as any)?.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const runningStatsMap = useMemo(() => {
    const map = new Map<string, RunningOffer>();
    runningOffers.forEach(ro => {
      if (ro.offer_id) map.set(ro.offer_id, ro);
      if (ro._id) map.set(ro._id, ro);
    });
    return map;
  }, [runningOffers]);

  const analyticsData = useMemo(() => {
    let filteredOffers = offers;
    const now = Date.now();

    // Time filter filtering across offers
    if (timeFilter !== 'all') {
      let fromTime = 0;
      let toTime = now;
      if (timeFilter === 'today') fromTime = now - 86400000;
      else if (timeFilter === '7days') fromTime = now - 7 * 86400000;
      else if (timeFilter === '30days') fromTime = now - 30 * 86400000;
      else if (timeFilter === 'custom' && customDateFrom && customDateTo) {
        fromTime = new Date(customDateFrom).getTime();
        toTime = new Date(customDateTo).getTime() + 86399999; // add full day
      }

      if (fromTime > 0) {
        filteredOffers = offers.filter(o => {
          const d = o.updated_at ? new Date(o.updated_at).getTime() : 
                    o.created_at ? new Date(o.created_at).getTime() : now;
          return d >= fromTime && d <= toTime;
        });
      }
    }

    const groups = new Map<string, any>();
    
    // Status initialization for status page
    if (type === 'status') {
       const aggregated = {
         id: 'Global Status', name: 'Global Status', active: 0, inactive: 0, running: 0, rotating: 0,
         approved: 0, rejected: 0, requested: 0, picked: 0, viewed: 0, clicked: 0, total: 0
       };
       groups.set('Global Status', aggregated);
    }

    filteredOffers.forEach(o => {
      const rs = runningStatsMap.get(o.offer_id) || runningStatsMap.get((o as any)._id);
      
      const metrics = {
        active: o.status === 'active' ? 1 : 0,
        inactive: o.status === 'inactive' ? 1 : 0,
        running: (rs?.total_clicks || 0) > 0 ? 1 : 0,
        rotating: (o.smart_rules?.rotation_enabled || (o as any).rotation_enabled || rotatingIds.has(o.offer_id)) ? 1 : 0,
        approved: rs?.action_counts?.['approved'] || 0,
        rejected: rs?.action_counts?.['rejected'] || 0,
        requested: rs?.action_counts?.['requested'] || 0,
        picked: rs?.action_counts?.['picked'] || 0,
        viewed: (o as any).hits || 0,
        clicked: rs?.total_clicks || 0,
        total: 1
      };

      // Ensure undefined strings don't crash
      const nKey = o.network || 'Unknown';
      const vKey = o.vertical || o.category || 'Other';

      const addToGroup = (key: string) => {
        if (!key) key = 'Unknown';
        if (!groups.has(key)) {
          groups.set(key, { id: key, name: key, ...{ active: 0, inactive: 0, running: 0, rotating: 0, approved: 0, rejected: 0, requested: 0, picked: 0, viewed: 0, clicked: 0, total: 0 } });
        }
        const g = groups.get(key);
        for (const k in metrics) {
          (g as any)[k] += (metrics as any)[k as keyof typeof metrics];
        }
      };

      if (type === 'network') addToGroup(nKey);
      else if (type === 'vertical') addToGroup(vKey);
      else if (type === 'geo') {
        if (o.countries && o.countries.length > 0) {
          o.countries.forEach(c => addToGroup(c));
        } else {
          addToGroup('Unknown');
        }
      } else if (type === 'status') {
        const g = groups.get('Global Status');
        for (const k in metrics) {
          (g as any)[k] += (metrics as any)[k as keyof typeof metrics];
        }
      }
    });

    let chartData = Array.from(groups.values());
    
    if (type !== 'status') {
       chartData.sort((a, b) => b.total - a.total);
       chartData = chartData.slice(0, 25); 
    }

    const totalActivity = { active: 0, inactive: 0, running: 0, rotating: 0, approved: 0, rejected: 0, requested: 0, picked: 0, viewed: 0, clicked: 0, total: 0 };
    chartData.forEach(cd => {
      for (const k in totalActivity) {
        (totalActivity as any)[k] += cd[k];
      }
    });

    let mostActive = { name: 'None', score: 0 };
    if (type !== 'status') {
      chartData.forEach(cd => {
        const eff = cd.viewed > 0 ? (cd.clicked / cd.viewed) : 0;
        const score = cd.active + cd.running + (eff * 100);
        if (score > mostActive.score) {
          mostActive = { name: cd.name, score };
        }
      });
    }

    return { chartData, totalActivity, mostActive };
  }, [offers, runningStatsMap, timeFilter, customDateFrom, customDateTo, type, rotatingIds]);

  const TypeIcon = type === 'network' ? Globe : type === 'vertical' ? Layers : type === 'geo' ? MapPin : Activity;
  const typeTitle = type.charAt(0).toUpperCase() + type.slice(1);

  if (loading) {
    return <div className="p-8 text-center text-zinc-500 font-bold uppercase tracking-widest text-sm flex items-center justify-center h-64"><TrendingUp className=" animate-bounce mr-2"/> Loading {typeTitle} Analytics...</div>;
  }

  return (
    <ErrorBoundary>
      <div className="p-6 bg-[#030303] min-h-screen text-white space-y-8 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Header & Filter Controls */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
              <div className={`p-3 rounded-2xl bg-gradient-to-br ${type==='network' ? 'from-blue-600 to-indigo-800' : type==='geo' ? 'from-emerald-600 to-green-800' : type==='vertical' ? 'from-fuchsia-600 to-purple-800' : 'from-orange-600 to-red-800'}`}>
                <TypeIcon className="text-white w-6 h-6" /> 
              </div>
              {typeTitle} Analytics
            </h1>
            <p className="text-zinc-500 font-medium tracking-wide mt-2">
              Detailed tracking & efficiency breakdown for {type} based metrics over time
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 bg-[#0a0a0b] p-1.5 rounded-2xl border border-white/5 shadow-2xl">
            <div className="flex items-center">
              {['today', '7days', '30days', 'all'].map(t => (
                <button 
                  key={t} 
                  onClick={() => setTimeFilter(t as any)}
                  className={`px-4 py-2 text-[10px] font-black rounded-lg uppercase tracking-widest transition-all ${timeFilter === t ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'}`}
                >
                  {t === 'today' ? 'Today' : t === '7days' ? 'Last 7 Days' : t === '30days' ? 'Last 30 Days' : 'All Time'}
                </button>
              ))}
              <button 
                  onClick={() => setTimeFilter('custom')}
                  className={`px-4 py-2 flex items-center gap-1.5 text-[10px] font-black rounded-lg uppercase tracking-widest transition-all ${timeFilter === 'custom' ? 'bg-purple-600 text-white shadow-xl shadow-purple-500/20' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'}`}
                >
                  <CalendarIcon className="w-3 h-3" /> Custom
              </button>
            </div>

            {timeFilter === 'custom' && (
              <div className="flex items-center gap-2 pl-2 border-l border-white/10">
                <input 
                  type="date" 
                  value={customDateFrom} 
                  onChange={e => setCustomDateFrom(e.target.value)} 
                  className="bg-[#111] text-xs text-zinc-300 px-3 py-2 rounded-xl border border-white/10 focus:border-purple-500 outline-none uppercase font-bold" 
                />
                <span className="text-zinc-600 font-black">to</span>
                <input 
                  type="date" 
                  value={customDateTo} 
                  onChange={e => setCustomDateTo(e.target.value)} 
                  className="bg-[#111] text-xs text-zinc-300 px-3 py-2 rounded-xl border border-white/10 focus:border-purple-500 outline-none uppercase font-bold" 
                />
              </div>
            )}
          </div>
        </div>

        {/* Global Efficiency Insight for this segment */}
        {type !== 'status' && analyticsData.mostActive && analyticsData.mostActive.score > 0 && (
          <div className="bg-blue-900/10 border border-blue-500/20 p-5 rounded-2xl flex items-center gap-4 animate-in slide-in-from-bottom-4">
            <div className="bg-blue-500 text-white p-3 rounded-xl shadow-lg shadow-blue-500/20">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Most Efficient & Active {typeTitle}</p>
              <h3 className="text-2xl font-black text-white">{analyticsData.mostActive.name === 'Unknown' ? 'N/A' : analyticsData.mostActive.name}</h3>
            </div>
          </div>
        )}

        {/* Main Chart */}
        <div className="bg-[#0a0a0b] border border-white/5 p-8 rounded-[32px] shadow-2xl relative overflow-hidden">
           <div className={`absolute top-0 right-0 p-8 blur-[80px] w-[500px] h-[500px] rounded-full pointer-events-none opacity-20 ${type==='network' ? 'bg-blue-500' : type==='geo' ? 'bg-emerald-500' : type==='vertical' ? 'bg-fuchsia-500' : 'bg-orange-500'}`} />
          
          <div className="flex justify-between items-center mb-10 relative z-10">
            <h2 className="text-2xl font-black uppercase text-white flex items-center gap-3 tracking-tight">
              <Filter className="w-6 h-6 text-zinc-500" /> {typeTitle} Metrics Breakdown
            </h2>
          </div>

          <div className="h-[600px] w-full relative z-10">
             {analyticsData.chartData.length === 0 ? (
                <div className="h-full flex items-center justify-center font-black uppercase text-2xl text-zinc-700 tracking-widest">No Activity Recorded</div>
             ) : (
                <ResponsiveContainer width="100%" height="100%">
                {type === 'status' ? (
                    <BarChart data={METRICS.map(m => ({ name: m.name, value: analyticsData.chartData[0]?.[m.key as keyof typeof analyticsData.chartData[0]] || 0, fill: m.color }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" vertical={false} />
                    <XAxis dataKey="name" stroke="#ffffff80" fontSize={12} tickLine={false} axisLine={false} fontWeight="bold" />
                    <YAxis stroke="#ffffff80" fontSize={12} tickLine={false} axisLine={false} fontWeight="bold" />
                    <Tooltip cursor={{ fill: '#ffffff05' }} contentStyle={{ backgroundColor: '#0a0a0b', border: '1px solid #333', borderRadius: '16px', fontWeight: 'bold' }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={80} />
                    </BarChart>
                ) : (
                    <BarChart data={analyticsData.chartData} barCategoryGap="15%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" vertical={false} />
                    <XAxis dataKey="name" stroke="#ffffff80" fontSize={11} tickLine={false} axisLine={false} fontWeight="black" />
                    <YAxis stroke="#ffffff80" fontSize={11} tickLine={false} axisLine={false} fontWeight="bold" />
                    <Tooltip cursor={{ fill: '#ffffff05' }} contentStyle={{ backgroundColor: '#000', border: '1px solid #ffffff10', borderRadius: '16px', fontWeight: 'bold', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.5)' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '30px' }} />
                    
                    {METRICS.map(m => (
                        <Bar key={m.key} dataKey={m.key} name={m.name} stackId={type === 'geo' ? "a" : undefined} fill={m.color} radius={type === 'geo' ? [0,0,0,0] : [4, 4, 0, 0]} barSize={type === 'geo' ? 60 : undefined} />
                    ))}
                    </BarChart>
                )}
                </ResponsiveContainer>
             )}
          </div>
        </div>

      </div>
    </ErrorBoundary>
  );
}
