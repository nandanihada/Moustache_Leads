import React, { useState, useMemo, useEffect } from 'react';
import {
  ChevronRight, Search, Globe, Tag, Layers, Activity, CheckCircle2, AlertCircle, RefreshCw, Eye, Edit, Trash2, LayoutGrid, List, MoreHorizontal, ArrowRight, Zap, MousePointer2, Clock, MapPin, Database, Server, Filter
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { adminOfferApi, Offer, RunningOffer } from '@/services/adminOfferApi';
import { Skeleton } from '@/components/ui/skeleton';

interface OfferDrilldownProps {
  onOfferSelect?: (offer: Offer) => void;
  onOfferEdit?: (offer: Offer) => void;
  onOfferDelete?: (id: string, name: string) => void;
}

type ViewType = 'networks' | 'geos' | 'verticals' | 'combo' | 'offers';

interface DrillFilter {
  network?: string;
  country?: string;
  vertical?: string;
  status?: string;
  subStatus?: string;
}

interface DrillPathItem {
  view: ViewType;
  title: string;
  filters: DrillFilter;
}

const EXCLUDED_MINOR_TERRITORIES = new Set([
  // Antarctica & Oceans
  'AQ', 'BV', 'HM', 'IO', 'TF', 'UM', 'GS', 'PN', 'CC', 'CX',
  // Tiny Pacific/Oceania Islands
  'TK', 'NU', 'NF', 'WF', 'NC', 'PF', 'MP', 'AS', 'FM', 'MH', 'PW', 'NR', 'TV', 'KI', 'CK',
  // Tiny Atlantic/Caribbean Islands
  'SJ', 'FK', 'BL', 'MF', 'PM', 'SH', 'TA', 'VG', 'AI', 'MS', 'TC', 'SX', 'CW', 'BQ', 'AW', 'BM', 'GL', 'FO', 'AX',
  // Microstates & Obscure Regions
  'SM', 'VA', 'MC', 'LI', 'AD', 'EH', 'XK', 'YT', 'KM', 'ST', 'GW', 'GQ', 'DJ', 'ER', 'SO', 'SS',
  // Non-country Technical Codes
  'A1', 'A2', 'O1', 'AP', 'EU', 'WW', 'GLOBAL', 'ALL' // We map these into 'WW' but maybe shouldn't count WW as a "Geo" in the raw array
]);

const normalizeGeo = (c: string) => {
  let normalized = c;
  if (normalized === 'UK') normalized = 'GB';
  if (normalized === 'WW' || normalized === 'ALL' || normalized === 'GLOBAL') return 'WW';
  return normalized;
};

const getValidCountries = (countries: string[] | undefined | null) => {
  if (!countries || !countries.length) return ['WW'];
  const all = countries
    .flatMap(c => c.split(/[,|]/))
    .map(c => c.trim().toUpperCase())
    .map(normalizeGeo)
    .filter(c => c && !EXCLUDED_MINOR_TERRITORIES.has(c));
    
  const unique = all.length ? Array.from(new Set(all)) : ['WW'];
  return unique.length > 150 ? ['WW'] : unique;
};

const parseNetwork = (offer: Offer) => {
  if (!offer.network) return 'UNKNOWN';
  let net = offer.network.replace(/[^a-zA-Z0-9 ]/g, '').trim().toUpperCase();
  if (net.includes('ADSCEND')) return 'ADSCENDMEDIA';
  if (net.includes('NOTIX')) return 'NOTIX';
  if (net.includes('TRIOD')) return 'TRIOD';
  return net;
};

const parseVertical = (offer: Offer) => {
  const vert = offer.vertical || offer.category || 'OTHER';
  return vert.trim().toUpperCase();
};

const getFlagEmoji = (countryCode: string) => {
  if (!countryCode || countryCode === 'WW' || countryCode === 'Unknown' || countryCode === 'all') return '🌍';
  const code = countryCode.toLowerCase();
  const finalCode = code === 'uk' ? 'gb' : code;
  if (finalCode.length === 2) {
    return (
      <img
        src={`https://flagcdn.com/20x15/${finalCode}.png`}
        srcSet={`https://flagcdn.com/40x30/${finalCode}.png 2x, https://flagcdn.com/60x45/${finalCode}.png 3x`}
        width="16"
        height="12"
        alt={code.toUpperCase()}
        className="inline-block object-cover flex-shrink-0 rounded-sm"
      />
    );
  }
  return '🌍';
};

const getVerticalIcon = (vertical: string) => {
  const v = vertical?.toLowerCase() || '';
  if (v.includes('health')) return '💊';
  if (v.includes('survey')) return '📋';
  if (v.includes('sweep')) return '🎰';
  if (v.includes('finance') || v.includes('loan') || v.includes('insur')) return '💰';
  if (v.includes('game')) return '🎮';
  if (v.includes('dating')) return '❤️';
  if (v.includes('install') || v.includes('app')) return '📲';
  if (v.includes('education') || v.includes('edu')) return '📚';
  return '📦';
};

export const getOfferTags = (offer: Offer, rotatingIds: Set<string> = new Set()) => {
  const tags: string[] = [];
  if (offer.smart_rules?.rotation_enabled || (offer as any).rotation_enabled || rotatingIds.has(offer.offer_id)) tags.push('Rotating');
  if (offer.is_pinned) tags.push('Pinned');

  const createdDate = offer.created_at ? new Date(offer.created_at) : null;
  const updatedDate = offer.updated_at ? new Date(offer.updated_at) : null;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  if (createdDate && createdDate > sevenDaysAgo) tags.push('Recently Added');
  if (updatedDate && updatedDate > sevenDaysAgo && (!createdDate || createdDate <= sevenDaysAgo)) tags.push('Recently Edited');
  if (offer.status === 'inactive' || offer.status === 'hidden') tags.push('Deactivated');

  return tags;
};

export const OfferDrilldown: React.FC<OfferDrilldownProps> = ({
  onOfferSelect, onOfferEdit, onOfferDelete
}) => {
  const [allOffers, setAllOffers] = useState<Offer[]>([]);
  const [runningOffers, setRunningOffers] = useState<RunningOffer[]>([]);
  const [rotatingIds, setRotatingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [internalSelectedOffer, setInternalSelectedOffer] = useState<Offer | null>(null);

  const [drillStack, setDrillStack] = useState<DrillPathItem[]>([
    { view: 'networks', title: 'Networks', filters: {} }
  ]);

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const [runningRes, rotStatus] = await Promise.all([
          adminOfferApi.getRunningOffers({ per_page: 10000 }),
          adminOfferApi.getRotationStatus().catch(() => null)
        ]);
        setRunningOffers(runningRes.offers || []);
        const rIds = rotStatus?.running_offer_ids || rotStatus?.current_batch_ids;
        if (rIds) {
          setRotatingIds(new Set(rIds));
        }
        let all: Offer[] = [];
        let page = 1;
        let total = 1;

        while (all.length < total) {
          const res = await adminOfferApi.getOffers({ page, per_page: 2000 });
          all = [...all, ...(res.offers || [])];
          total = res.pagination.total;
          if (res.offers.length === 0 || page >= res.pagination.pages) break;
          page++;
        }

        setAllOffers(all);
      } catch (err) {
        console.error('Drilldown fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, []);

  const runningStatsMap = useMemo(() => {
    const map = new Map<string, RunningOffer>();
    runningOffers.forEach(ro => map.set(ro.offer_id, ro));
    return map;
  }, [runningOffers]);

  const currentStep = drillStack[drillStack.length - 1];

  const pushStep = (view: ViewType, title: string, extraFilters: DrillFilter = {}) => {
    setDrillStack(prev => [...prev, {
      view,
      title,
      filters: { ...prev[prev.length - 1].filters, ...extraFilters }
    }]);
    setSearchTerm('');
  };

  const popTo = (index: number) => {
    setDrillStack(prev => prev.slice(0, index + 1));
    setSearchTerm('');
  };

  const filteredOffers = useMemo(() => {
    let result = [...allOffers];
    const f = currentStep.filters;

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(o =>
        o.name.toLowerCase().includes(s) ||
        o.offer_id.toLowerCase().includes(s) ||
        o.campaign_id.toLowerCase().includes(s)
      );
    }

    if (f.network && f.network !== 'all') result = result.filter(o => parseNetwork(o) === f.network);
    if (f.country && f.country !== 'all') result = result.filter(o => getValidCountries(o.countries).includes(f.country));
    if (f.vertical && f.vertical !== 'all') {
      const target = f.vertical.toUpperCase();
      result = result.filter(o => parseVertical(o) === target);
    }

    if (f.status && f.status !== 'all') {
      if (f.status === 'running') {
        result = result.filter(o => {
          const rs = runningStatsMap.get(o.offer_id) || runningStatsMap.get((o as any)._id);
          return !!rs;
        });
      } else {
        result = result.filter(o => o.status === f.status);
      }
    }

    if (f.subStatus && f.subStatus !== 'all') {
      const sFilter = f.subStatus.toLowerCase();
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      result = result.filter(o => {
        const rs = runningStatsMap.get(o.offer_id);
        if (sFilter === 'clicked') return (rs?.total_clicks || 0) > 0;
        
        if (sFilter === 'rotating') return o.smart_rules?.rotation_enabled || (o as any).rotation_enabled || rotatingIds.has(o.offer_id);
        if (sFilter === 'deactivated') {
          const updated = o.updated_at ? new Date(o.updated_at).getTime() : 0;
          const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
          return (o.status === 'inactive' || o.status === 'hidden') && updated > oneDayAgo;
        }
        
        if (sFilter === 'added' || sFilter === 'edited') {
          const createdStr = o.created_at || (o as any).date_added || o.start_date;
          const created = createdStr ? new Date(createdStr).getTime() : 0;
          if (sFilter === 'added') return created > sevenDaysAgo;
          
          const updated = o.updated_at ? new Date(o.updated_at).getTime() : 0;
          const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
          if (sFilter === 'edited') return updated > oneDayAgo && updated > (created + 60000);
        }

        return rs?.sub_statuses?.some(s => s.toLowerCase() === sFilter);
      });
    }

    return result;
  }, [allOffers, currentStep.filters, searchTerm, runningStatsMap, rotatingIds]);

  const globalStats = useMemo(() => {
    const total = allOffers.length;
    const active = allOffers.filter(o => o.status === 'active').length;
    const inactive = allOffers.filter(o => o.status === 'inactive').length;
    const running = runningOffers.length;
    const avgEpc = total > 0 ? (allOffers.reduce((sum, o) => sum + (o.payout || 0), 0) / (total * 10)) : 0;
    return { total, active, inactive, running, avgEpc };
  }, [allOffers, runningOffers]);

  // Aggregation helpers
  const aggregateActivities = (offers: Offer[]) => {
    const acts = {
      approved: 0, rejected: 0, requested: 0, picked: 0, sent: 0, clicked: 0, viewed: 0, active: 0, running: 0, rotating: 0,
      inactive: 0, added: 0, edited: 0, deactivated: 0
    };
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    offers.forEach(o => {
      if (o.smart_rules?.rotation_enabled || (o as any).rotation_enabled || rotatingIds.has(o.offer_id)) acts.rotating++;
      const createdStr = o.created_at || (o as any).date_added || o.start_date;
      const created = createdStr ? new Date(createdStr).getTime() : 0;
      if (created > sevenDaysAgo) acts.added++;
      const updated = o.updated_at ? new Date(o.updated_at).getTime() : 0;
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      if (updated > oneDayAgo && updated > (created + 60000)) acts.edited++;
      if ((o.status === 'inactive' || o.status === 'hidden') && updated > oneDayAgo) acts.deactivated++;
      if (o.status === 'active') acts.active++;
      if (o.status === 'inactive') acts.inactive++;

      const rs = runningStatsMap.get(o.offer_id) || runningStatsMap.get((o as any)._id);
      if (rs) {
        acts.running++;
        acts.clicked += rs.total_clicks || 0;
        rs.sub_statuses?.forEach(s => {
          const low = s.toLowerCase();
          if (low in acts) (acts as any)[low]++;
        });
      }
      acts.sent += (o as any).hits || 0;
      acts.viewed += (o as any).hits || 0;
    });
    return acts;
  };

  const renderCardActivitySection = (title: string, entityKey: string, entityVal: string, acts: any) => {
    const filters = { [entityKey]: entityVal };
    return (
      <div className="p-6 bg-white/[0.01]">
        <div className="flex flex-wrap gap-1.5 mb-5 pb-4 border-b border-white/5">
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-none text-[9px] px-1.5 cursor-pointer hover:bg-emerald-500/20 transition-colors" onClick={(e) => { e.stopPropagation(); pushStep('offers', `${title} Active`, { ...filters, status: 'active' }); }}>{acts.active} Active</Badge>
          <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-none text-[9px] px-1.5 cursor-pointer hover:bg-blue-500/20 transition-colors" onClick={(e) => { e.stopPropagation(); pushStep('offers', `${title} Running`, { ...filters, status: 'running' }); }}>{acts.running} Running</Badge>
          <Badge variant="outline" className="bg-zinc-500/10 text-zinc-400 border-none text-[9px] px-1.5 cursor-pointer hover:bg-zinc-500/20 transition-colors" onClick={(e) => { e.stopPropagation(); pushStep('offers', `${title} Inactive`, { ...filters, status: 'inactive' }); }}>{acts.inactive} Inactive</Badge>
          <Badge variant="outline" className="bg-violet-500/10 text-violet-400 border-none text-[9px] px-1.5 cursor-pointer hover:bg-violet-500/20 transition-colors" onClick={(e) => { e.stopPropagation(); pushStep('offers', `${title} Rotating`, { ...filters, subStatus: 'rotating' }); }}>{acts.rotating} Rotating</Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="flex justify-between items-center p-2 rounded-lg bg-white/5 cursor-pointer hover:bg-white/10 transition-colors" onClick={(e) => { e.stopPropagation(); pushStep('offers', `${title} Added`, { ...filters, subStatus: 'added' }); }}>
            <span className="text-[9px] font-bold text-blue-400/80 uppercase">Recently Added</span>
            <span className={`text-xs font-black ${acts.added > 0 ? 'text-blue-400' : 'text-zinc-600'}`}>{acts.added}</span>
          </div>
          <div className="flex justify-between items-center p-2 rounded-lg bg-white/5 cursor-pointer hover:bg-white/10 transition-colors" onClick={(e) => { e.stopPropagation(); pushStep('offers', `${title} Edited`, { ...filters, subStatus: 'edited' }); }}>
            <span className="text-[9px] font-bold text-fuchsia-400/80 uppercase">Recently Edited</span>
            <span className={`text-xs font-black ${acts.edited > 0 ? 'text-fuchsia-400' : 'text-zinc-600'}`}>{acts.edited}</span>
          </div>
          <div className="flex justify-between items-center p-2 rounded-lg bg-white/5 cursor-pointer hover:bg-white/10 transition-colors col-span-2" onClick={(e) => { e.stopPropagation(); pushStep('offers', `${title} Deactivated`, { ...filters, subStatus: 'deactivated' }); }}>
            <span className="text-[9px] font-bold text-red-400/80 uppercase">Deactivated</span>
            <span className={`text-xs font-black ${acts.deactivated > 0 ? 'text-red-400' : 'text-zinc-600'}`}>{acts.deactivated}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {[{ l: 'Approved', v: acts.approved, c: 'text-emerald-400', sub: 'approved' }, { l: 'Rejected', v: acts.rejected, c: 'text-red-400', sub: 'rejected' }, { l: 'Requested', v: acts.requested, c: 'text-amber-400', sub: 'requested' }, { l: 'Picked', v: acts.picked, c: 'text-violet-400', sub: 'picked' }].map(s => (
            <div key={s.l} className="flex justify-between items-center p-2 rounded-lg bg-black/20 cursor-pointer hover:bg-black/40 transition-colors" onClick={(e) => { e.stopPropagation(); pushStep('offers', `${title} ${s.l}`, { ...filters, subStatus: s.sub }); }}>
              <span className="text-[9px] font-bold text-zinc-400 uppercase">{s.l}</span>
              <span className={`text-xs font-black ${s.v > 0 ? s.c : 'text-zinc-600'}`}>{s.v}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 bg-zinc-900 rounded-xl cursor-pointer hover:bg-zinc-800 transition-colors" onClick={(e) => { e.stopPropagation(); pushStep('offers', `${title} Sent`, { ...filters }); }}>
            <p className="text-[9px] text-zinc-500 font-bold uppercase">Sent/Viewed</p>
            <p className="text-sm font-black text-white">{acts.sent.toLocaleString()}</p>
          </div>
          <div className="p-3 bg-zinc-900 rounded-xl cursor-pointer hover:bg-zinc-800 transition-colors" onClick={(e) => { e.stopPropagation(); pushStep('offers', `${title} Clicked`, { ...filters, subStatus: 'clicked' }); }}>
            <p className="text-[9px] text-zinc-500 font-bold uppercase">Clicked</p>
            <p className="text-sm font-black text-white">{acts.clicked.toLocaleString()}</p>
          </div>
        </div>
      </div>
    );
  };

  // VIEWS RENDERERS

  const renderNetworks = () => {
    const nets = new Map<string, Offer[]>();
    filteredOffers.forEach(o => {
      const net = parseNetwork(o);
      if (!nets.has(net)) nets.set(net, []);
      nets.get(net)!.push(o);
    });

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from(nets.entries()).sort((a, b) => b[1].length - a[1].length).map(([netName, offers]) => {
          const geos = new Set(offers.flatMap(o => getValidCountries(o.countries)));
          const verticals = new Set(offers.map(o => parseVertical(o)));
          const acts = aggregateActivities(offers);

          return (
            <Card key={netName} className="group relative bg-[#0a0a0b] border border-white/5 rounded-[32px] overflow-hidden hover:border-blue-500/30 transition-all hover:shadow-[0_0_40px_-15px_rgba(59,130,246,0.3)]">
              <div className="absolute top-0 right-0 p-8 bg-blue-500/10 blur-[50px] w-32 h-32 rounded-full -mr-16 -mt-16 group-hover:bg-blue-500/20 transition-all" />

              {/* Identity Section */}
              <div className="p-6 border-b border-white/5 relative z-10">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center text-white font-black text-2xl shadow-lg uppercase">
                    {netName.charAt(0)}
                  </div>
                  <div className="text-right cursor-pointer group/offers" onClick={() => pushStep('offers', `${netName} Offers`, { network: netName })}>
                    <p className="text-4xl font-black text-white leading-none tracking-tighter group-hover/offers:text-blue-400 transition-colors">{offers.length}</p>
                    <p className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.2em] group-hover/offers:text-blue-400">Total Offers</p>
                  </div>
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight truncate mb-4">{netName}</h3>

                <div className="flex gap-2">
                  <button onClick={() => pushStep('geos', `${netName} GEOs`, { network: netName })} className="flex-1 py-2 px-3 bg-white/5 hover:bg-blue-500/20 hover:text-blue-400 transition-colors rounded-xl border border-white/5 text-center group/btn cursor-pointer">
                    <p className="text-sm font-black text-white group-hover/btn:text-blue-400">{geos.size}</p>
                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Geos</p>
                  </button>
                  <button onClick={() => pushStep('verticals', `${netName} Verticals`, { network: netName })} className="flex-1 py-2 px-3 bg-white/5 hover:bg-emerald-500/20 hover:text-emerald-400 transition-colors rounded-xl border border-white/5 text-center group/btn cursor-pointer">
                    <p className="text-sm font-black text-white group-hover/btn:text-emerald-400">{verticals.size}</p>
                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Verticals</p>
                  </button>
                </div>
              </div>

              {renderCardActivitySection(netName, 'network', netName, acts)}
            </Card>
          );
        })}
      </div>
    );
  };

  const renderGeos = () => {
    const geosMap = new Map<string, Offer[]>();
    filteredOffers.forEach(o => {
      getValidCountries(o.countries).forEach(c => {
        if (!geosMap.has(c)) geosMap.set(c, []);
        geosMap.get(c)!.push(o);
      });
    });

    const isCombo = currentStep.filters.vertical ? true : false;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from(geosMap.entries()).sort((a, b) => b[1].length - a[1].length).map(([geo, offers]) => {
          const verticals = new Set(offers.map(o => parseVertical(o)));
          const acts = aggregateActivities(offers);

          return (
            <Card key={geo} className="group relative bg-[#0a0a0b] border border-white/5 rounded-[32px] overflow-hidden hover:border-indigo-500/30 transition-all hover:shadow-[0_0_40px_-15px_rgba(99,102,241,0.2)]">
              <div className="p-6 relative z-10 border-b border-white/5">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex gap-4 items-center cursor-pointer" onClick={() => pushStep(isCombo ? 'offers' : 'verticals', `${geo} Drilldown`, { country: geo })}>
                    <div className="text-4xl drop-shadow-2xl bg-white/5 p-3 rounded-2xl border border-white/10 group-hover:scale-105 transition-transform">{getFlagEmoji(geo)}</div>
                    <div>
                      <h3 className="text-2xl font-black text-white uppercase tracking-tight group-hover:text-indigo-400 transition-colors">{geo}</h3>
                      {isCombo && <p className="text-[10px] text-zinc-400 uppercase tracking-widest">{currentStep.filters.vertical} Combo</p>}
                    </div>
                  </div>
                  <div className="text-right cursor-pointer group/opts" onClick={() => pushStep('offers', `${geo} Offers`, { country: geo })}>
                    <p className="text-3xl font-black text-white leading-none group-hover/opts:text-indigo-400 transition-colors">{offers.length}</p>
                    <p className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.2em] group-hover/opts:text-indigo-400">Offers</p>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-indigo-500/5 border border-indigo-500/10 p-3 rounded-xl cursor-pointer hover:bg-indigo-500/10 transition-colors" onClick={() => pushStep('combo', `${geo} Verticals Combos`, { country: geo })}>
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{verticals.size} Verticals Inside</span>
                  <span className="text-[11px] font-bold text-white bg-indigo-500/20 px-2 py-0.5 rounded-lg">View Combos</span>
                </div>
              </div>

              {renderCardActivitySection(geo, 'country', geo, acts)}
            </Card>
          );
        })}
      </div>
    );
  };

  const renderVerticals = () => {
    const vertMap = new Map<string, Offer[]>();
    filteredOffers.forEach(o => {
      const v = parseVertical(o);
      if (!vertMap.has(v)) vertMap.set(v, []);
      vertMap.get(v)!.push(o);
    });

    const isCombo = currentStep.filters.country ? true : false;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from(vertMap.entries()).sort((a, b) => b[1].length - a[1].length).map(([vert, offers]) => {
          const geos = new Set(offers.flatMap(o => getValidCountries(o.countries)));
          const acts = aggregateActivities(offers);

          return (
            <Card key={vert} className="group relative bg-[#0a0a0b] border border-white/5 rounded-[32px] overflow-hidden hover:border-fuchsia-500/30 transition-all hover:shadow-[0_0_40px_-15px_rgba(217,70,239,0.2)]">
              <div className="p-6 relative z-10 border-b border-white/5">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex gap-4 items-center cursor-pointer" onClick={() => pushStep(isCombo ? 'offers' : 'geos', `${vert} Drilldown`, { vertical: vert })}>
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-600 to-purple-800 flex items-center justify-center text-white text-2xl shadow-xl group-hover:scale-105 transition-transform">{getVerticalIcon(vert)}</div>
                    <div>
                      <h3 className="text-xl font-black text-white uppercase tracking-tight group-hover:text-fuchsia-400 transition-colors">{vert}</h3>
                      {isCombo && <p className="text-[10px] text-zinc-400 uppercase tracking-widest">{currentStep.filters.country} Combo</p>}
                    </div>
                  </div>
                  <div className="text-right cursor-pointer group/opts" onClick={() => pushStep('offers', `${vert} Offers`, { vertical: vert })}>
                    <p className="text-3xl font-black text-white leading-none group-hover/opts:text-fuchsia-400 transition-colors">{offers.length}</p>
                    <p className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.2em] group-hover/opts:text-fuchsia-400">Offers</p>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-fuchsia-500/5 border border-fuchsia-500/10 p-3 rounded-xl cursor-pointer hover:bg-fuchsia-500/10 transition-colors" onClick={() => pushStep('combo', `${vert} GEO Combos`, { vertical: vert })}>
                  <span className="text-[10px] font-black text-fuchsia-400 uppercase tracking-widest">{geos.size} GEOs Inside</span>
                  <span className="text-[11px] font-bold text-white bg-fuchsia-500/20 px-2 py-0.5 rounded-lg">View Combos</span>
                </div>
              </div>

              {renderCardActivitySection(vert, 'vertical', vert, acts)}
            </Card>
          );
        })}
      </div>
    );
  };

  const renderCombo = () => {
    // If we transition to 'combo', we actually just render Geos or Verticals depending on what's next.
    // If we have Geo, and we want verticals, render Verticals.
    if (currentStep.filters.country && !currentStep.filters.vertical) return renderVerticals();
    if (currentStep.filters.vertical && !currentStep.filters.country) return renderGeos();

    // If we have both, it's the exact combo. We render Offers!
    return renderOffers();
  };

  const renderOffers = () => {
    const isCombo = currentStep.filters.country && currentStep.filters.vertical;
    const acts = isCombo ? aggregateActivities(filteredOffers) : null;

    return (
      <div className="space-y-6">
        {/* Layer 2 - Geo + Vertical Combo Summary header if applicable */}
        {isCombo && (
          <Card className="bg-gradient-to-r from-[#0a0a0b] to-zinc-900 border border-white/10 p-8 rounded-[32px] overflow-hidden relative shadow-2xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 blur-[80px] rounded-full pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
              <div className="flex items-center gap-6">
                <div className="flex items-center justify-center gap-4 bg-white/5 px-6 py-4 rounded-3xl border border-white/10">
                  <span className="text-5xl drop-shadow-2xl">{getFlagEmoji(currentStep.filters.country!)}</span>
                  <span className="text-zinc-600 text-3xl">+</span>
                  <span className="text-5xl drop-shadow-2xl">{getVerticalIcon(currentStep.filters.vertical!)}</span>
                </div>
                <div>
                  <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-2">
                    {currentStep.filters.country} &mdash; {currentStep.filters.vertical} Combo
                  </h2>
                  <Badge className="bg-amber-500/20 text-amber-500 hover:bg-amber-500/20 uppercase tracking-widest font-black pointer-events-none">Exact Match Filtered</Badge>
                </div>
              </div>

              <div className="flex gap-8 items-center bg-black/40 px-8 py-5 rounded-3xl border border-white/5">
                <div className="text-center group cursor-pointer" onClick={() => pushStep('offers', 'Combo Offers', {})}>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Total Offers</p>
                  <p className="text-4xl font-black text-white group-hover:text-amber-400 transition-colors">{filteredOffers.length}</p>
                </div>
                <div className="w-px h-12 bg-white/10" />
                <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                  <div className="flex items-center justify-between gap-4 cursor-pointer hover:opacity-70" onClick={() => pushStep('offers', 'Combo Apprv', { subStatus: 'approved' })}>
                    <span className="text-[10px] uppercase font-bold text-zinc-500">Approved</span>
                    <span className="text-sm font-black text-emerald-400">{acts?.approved}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 cursor-pointer hover:opacity-70" onClick={() => pushStep('offers', 'Combo Rej', { subStatus: 'rejected' })}>
                    <span className="text-[10px] uppercase font-bold text-zinc-500">Rejected</span>
                    <span className="text-sm font-black text-red-400">{acts?.rejected}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 cursor-pointer hover:opacity-70" onClick={() => pushStep('offers', 'Combo Req', { subStatus: 'requested' })}>
                    <span className="text-[10px] uppercase font-bold text-zinc-500">Requested</span>
                    <span className="text-sm font-black text-amber-400">{acts?.requested}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 cursor-pointer hover:opacity-70" onClick={() => pushStep('offers', 'Combo Sent', {})}>
                    <span className="text-[10px] uppercase font-bold text-zinc-500">Sent/Viewed</span>
                    <span className="text-sm font-black text-white">{acts?.sent.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Final Layer - Individual Offer Cards List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredOffers.map(offer => {
            const rs = runningStatsMap.get(offer.offer_id);
            const tags = getOfferTags(offer, rotatingIds);
            const isRotating = tags.includes('Rotating');
            const hasSub = (state: string) => rs?.sub_statuses?.some(s => s.toLowerCase() === state.toLowerCase());

            return (
              <Card key={offer.offer_id} className="bg-[#0a0a0b] border-white/5 rounded-[24px] overflow-hidden flex flex-col group hover:shadow-2xl hover:shadow-cyan-500/10 hover:border-cyan-500/20 transition-all cursor-pointer" onClick={() => setInternalSelectedOffer(offer)}>
                {/* Identity section */}
                <div className="p-5 border-b border-white/5 relative bg-gradient-to-br from-white/[0.02] to-transparent">
                  <div className="flex justify-between items-start gap-4 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-black border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                      {offer.image_url ? <img src={offer.image_url} className="w-full h-full object-cover" /> : <LayoutGrid className="w-5 h-5 text-zinc-700" />}
                    </div>
                    <div className="max-w-[70%]">
                      <h4 className="text-sm font-black text-white leading-tight uppercase tracking-tight group-hover:text-cyan-400 transition-colors truncate">{offer.name}</h4>
                      <p className="text-[9px] font-mono text-zinc-500 mt-1">{offer.offer_id}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {tags.map(t => {
                      let c = "bg-zinc-800 text-zinc-400";
                      if (t === 'Recently Added') c = "bg-blue-500/20 text-blue-400 border-blue-500/30";
                      else if (t === 'Recently Edited') c = "bg-purple-500/20 text-purple-400 border-purple-500/30";
                      else if (t === 'Deactivated') c = "bg-red-500/20 text-red-500 border-red-500/30";
                      else if (t === 'Rotating') c = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
                      return <Badge key={t} variant="outline" className={`text-[8px] uppercase tracking-widest px-1.5 py-0 border-none ${c}`}>{t}</Badge>;
                    })}
                    <Badge variant="outline" className={`text-[8px] uppercase tracking-widest px-1.5 py-0 border-none ${offer.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>{offer.status}</Badge>
                  </div>

                  <div className="flex justify-between items-end">
                    <div className="flex gap-1 overflow-hidden max-w-[60%]">
                      {getValidCountries(offer.countries).slice(0, 3).map(c => <span key={c} className="text-lg bg-black/50 rounded leading-none">{getFlagEmoji(c)}</span>)}
                      {getValidCountries(offer.countries).length > 3 && <span className="text-[10px] text-zinc-500 font-bold self-center">+{getValidCountries(offer.countries).length - 3}</span>}
                    </div>
                    <span className="text-[10px] font-black text-indigo-400 uppercase bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 truncate max-w-[40%]">{parseVertical(offer)}</span>
                  </div>
                </div>

                {/* Activity section */}
                <div className="p-5 flex-1 bg-black/20">
                  <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-3 border-b border-white/5 pb-1">Performance Stats</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    {[{ l: 'Approved', c: 'emerald', count: rs?.action_counts?.['approved'] || (hasSub('approved') ? 1 : 0) }, { l: 'Rejected', c: 'red', count: rs?.action_counts?.['rejected'] || (hasSub('rejected') ? 1 : 0) }, { l: 'Requested', c: 'amber', count: rs?.action_counts?.['requested'] || (hasSub('requested') ? 1 : 0) }, { l: 'Picked', c: 'violet', count: rs?.action_counts?.['picked'] || (hasSub('picked') ? 1 : 0) }].map(s => (
                      <div key={s.l} className="flex justify-between items-center bg-white/5 px-2 py-1.5 rounded-lg border border-transparent hover:border-white/10 transition-colors">
                        <span className="text-[9px] font-bold text-zinc-500 uppercase">{s.l}</span>
                        <span className={`text-[10px] font-black uppercase ${s.count > 0 ? `text-${s.c}-400` : 'text-zinc-700'}`}>{s.count > 0 ? s.count : '0'}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center bg-white/5 px-2 py-1.5 rounded-lg col-span-2">
                      <span className="text-[9px] font-bold text-zinc-500 uppercase"><MousePointer2 className="w-3 h-3 inline mr-1 text-cyan-500" /> Clicks</span>
                      <span className="text-xs font-black text-cyan-400">{(rs?.total_clicks || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center bg-white/5 px-2 py-1.5 rounded-lg col-span-2">
                      <span className="text-[9px] font-bold text-zinc-500 uppercase"><Eye className="w-3 h-3 inline mr-1 text-zinc-400" /> Sent/Viewed</span>
                      <span className="text-xs font-black text-white">{((offer as any).hits || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Rotation Redesign */}
                <div className="p-4 bg-gradient-to-t from-cyan-900/20 to-transparent border-t border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-black text-cyan-500 uppercase tracking-widest flex items-center gap-1.5"><RefreshCw className={`w-3 h-3 ${isRotating ? 'animate-spin text-emerald-400' : 'text-zinc-600'}`} /> Rotation Status</span>
                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${isRotating ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>{isRotating ? 'Rotating' : 'Not Rotating'}</span>
                  </div>

                  {isRotating ? (
                    <div className="space-y-3 mt-3">
                      <div className="flex justify-between items-end border-b border-white/5 pb-2">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase">Queue Pos</span>
                        <span className="text-sm font-black text-white">{rs ? 'In Pool' : 'Waiting'}</span>
                      </div>
                      <div className="flex justify-between items-end border-b border-white/5 pb-2">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase">Views Received</span>
                        <span className="text-sm font-black text-cyan-400">{((offer as any).hits || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-end">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase">Running State</span>
                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{rs ? 'Rotating Actively' : 'Idle'}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-4 text-center">
                      <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest block">This offer is strictly static</span>
                      <span className="text-[9px] text-zinc-600 font-medium">Bypasses rotation pools</span>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* Global Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-2 border-b border-white/5">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3 uppercase">
            Offer Drilldown
            {loading && <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-1.5 bg-[#0a0a0b] p-1.5 rounded-2xl border border-white/5 shadow-2xl">
            {[
              { id: 'all', type: 'status', label: 'All', icon: Globe },
              { id: 'active', type: 'status', label: 'Active', icon: Activity },
              { id: 'running', type: 'status', label: 'Running', icon: Clock },
              { id: 'inactive', type: 'status', label: 'Inactive', icon: Tag },
              { id: 'rotating', type: 'subStatus', label: 'Rotating', icon: RefreshCw },
              { id: 'added', type: 'subStatus', label: 'New', icon: Layers },
              { id: 'edited', type: 'subStatus', label: 'Edited', icon: Edit },
              { id: 'deactivated', type: 'subStatus', label: 'Dead', icon: Trash2 }
            ].map(f => {
              const isActive = f.id === 'all' 
                ? !currentStep.filters.status && !currentStep.filters.subStatus
                : currentStep.filters[f.type as keyof DrillFilter] === f.id;
                
              return (
                <Button
                  key={f.id}
                  variant={isActive ? 'default' : 'ghost'}
                  size="sm"
                  className={`h-9 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isActive ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'}`}
                  onClick={() => {
                    if (f.id === 'all') {
                      setDrillStack([{ view: 'networks', title: 'Networks', filters: {} }]);
                    } else {
                      pushStep('offers', `${f.label} Offers`, { [f.type]: f.id });
                    }
                  }}
                >
                  <f.icon className="h-3 w-3 mr-1.5" />
                  {f.label}
                </Button>
              );
            })}
          </div>

          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 group-focus-within:text-blue-500 transition-colors" />
            <Input
              placeholder="Search campaigns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-[300px] h-11 bg-[#0a0a0b] border-white/5 focus-visible:ring-blue-500 rounded-2xl text-white font-medium"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-11 w-11 border-white/5 bg-[#0a0a0b] hover:bg-white/5 shadow-xl rounded-2xl">
                <Filter className="h-4 w-4 text-zinc-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl bg-[#0a0a0b] border-white/10 text-white shadow-3xl">
              <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 pb-3 px-3">Filter Optimization</DropdownMenuLabel>
              <DropdownMenuItem
                className="rounded-xl hover:bg-white/5 focus:bg-white/5 py-2.5 cursor-pointer font-bold"
                onClick={() => setDrillStack([{ view: 'networks', title: 'Networks', filters: {} }])}
              >
                Filter by Network
              </DropdownMenuItem>
              <DropdownMenuItem
                className="rounded-xl hover:bg-white/5 focus:bg-white/5 py-2.5 cursor-pointer font-bold"
                onClick={() => setDrillStack([{ view: 'geos', title: 'All GEOs', filters: {} }])}
              >
                Filter by GEOs
              </DropdownMenuItem>
              <DropdownMenuItem
                className="rounded-xl hover:bg-white/5 focus:bg-white/5 py-2.5 cursor-pointer font-bold"
                onClick={() => setDrillStack([{ view: 'verticals', title: 'All Verticals', filters: {} }])}
              >
                Filter by Verticals
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/5 my-2" />
              <DropdownMenuItem
                className="rounded-xl text-red-500 hover:bg-red-500/10 focus:bg-red-500/10 py-2.5 cursor-pointer font-bold"
                onClick={() => setDrillStack([{ view: 'networks', title: 'Networks', filters: {} }])}
              >
                Clear All Filters
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center flex-wrap gap-2 px-6 py-4 bg-[#0a0a0b]/80 backdrop-blur-3xl rounded-[24px] shadow-2xl border border-white/5">
        {drillStack.map((step, i) => (
          <React.Fragment key={i}>
            <button onClick={() => popTo(i)} className={`flex items-center gap-2 h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${i === drillStack.length - 1 ? 'bg-white text-black shadow-lg scale-105' : 'text-zinc-500 hover:text-white hover:bg-white/10'}`}>
              {step.view === 'networks' && <Layers className="w-4 h-4" />}
              {step.view === 'geos' && <MapPin className="w-4 h-4" />}
              {step.view === 'verticals' && <Database className="w-4 h-4" />}
              {step.view === 'combo' && <Server className="w-4 h-4" />}
              {step.view === 'offers' && <List className="w-4 h-4" />}
              {step.title}
            </button>
            {i < drillStack.length - 1 && <ChevronRight className="w-4 h-4 text-zinc-700 mx-1" />}
          </React.Fragment>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-64 rounded-3xl bg-white/5" />)}
        </div>
      ) : filteredOffers.length === 0 ? (
        <div className="flex flex-col items-center py-24 bg-white/5 rounded-[32px] border border-white/10 border-dashed">
          <AlertCircle className="w-16 h-16 text-zinc-600 mb-6" />
          <p className="text-xl font-black text-white uppercase tracking-widest">No Offers Found</p>
          <Button variant="outline" className="mt-6 border-white/10 text-zinc-400 uppercase text-[10px] font-bold" onClick={() => popTo(0)}>Reset Drilldown Filters</Button>
        </div>
      ) : (
        <div className="animate-in fade-in zoom-in-95 duration-500">
          {currentStep.view === 'networks' && renderNetworks()}
          {currentStep.view === 'geos' && renderGeos()}
          {currentStep.view === 'verticals' && renderVerticals()}
          {currentStep.view === 'combo' && renderCombo()}
          {currentStep.view === 'offers' && renderOffers()}
        </div>
      )}

      {/* Inspect Detail Modal for Final Layer */}
      <Dialog open={!!internalSelectedOffer} onOpenChange={(val) => !val && setInternalSelectedOffer(null)}>
        <DialogContent className="max-w-2xl bg-[#0a0a0b] text-white p-0 border border-white/10 rounded-[32px] overflow-hidden">
          <DialogHeader className="p-6 border-b border-white/5">
            <DialogTitle className="text-xl font-black uppercase tracking-tight flex justify-between items-center">
              Final Layer: Offer Details
              <Badge className="bg-white/10 text-white hover:bg-white/10 text-[10px]">{internalSelectedOffer?.offer_id}</Badge>
            </DialogTitle>
          </DialogHeader>
          {internalSelectedOffer && (
            <div className="p-6 space-y-6">
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Raw Inspection Data Placeholder</p>
              <div className="bg-black/50 p-6 rounded-2xl border border-white/5">
                <h3 className="text-2xl font-black uppercase text-white mb-2">{internalSelectedOffer.name}</h3>
                <p className="text-sm text-zinc-400 font-mono">Current path filters fully applied. This is the deepest node in the drill-down representing absolute atomic data.</p>
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <Button variant="outline" className="border-white/10 text-white" onClick={() => { onOfferEdit?.(internalSelectedOffer); setInternalSelectedOffer(null) }}>Edit Settings</Button>
                <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => setInternalSelectedOffer(null)}>Close Inspection</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
