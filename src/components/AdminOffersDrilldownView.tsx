import React, { useState, useMemo, useEffect } from 'react';
import { Offer, adminOfferApi } from '@/services/adminOfferApi';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import '@/styles/admin-offers-drilldown.css';

interface AdminOffersDrilldownViewProps {
  offers: Offer[]; // Paginated offers from parent (fallback use)
  onOfferSelect: (offer: Offer) => void;
  onOfferEdit: (offer: Offer) => void;
  selectedOfferIds: Set<string>;
  onToggleSelect: (id: string, e: React.MouseEvent) => void;
}

type ViewType = 'network' | 'vertical' | 'country' | 'status' | 'table';
type DisplayMode = 'cards' | 'list' | 'table';

const COUNTRY_MAP: Record<string, { name: string; flag: string }> = {
  'US': { name: 'United States', flag: '🇺🇸' },
  'GB': { name: 'United Kingdom', flag: '🇬🇧' },
  'UK': { name: 'United Kingdom', flag: '🇬🇧' },
  'CA': { name: 'Canada', flag: '🇨🇦' },
  'AU': { name: 'Australia', flag: '🇦🇺' },
  'DE': { name: 'Germany', flag: '🇩🇪' },
  'IN': { name: 'India', flag: '🇮🇳' },
  'FR': { name: 'France', flag: '🇫🇷' },
  'ES': { name: 'Spain', flag: '🇪🇸' },
  'IT': { name: 'Italy', flag: '🇮🇹' },
  'BR': { name: 'Brazil', flag: '🇧🇷' },
  'MX': { name: 'Mexico', flag: '🇲🇽' },
  'JP': { name: 'Japan', flag: '🇯🇵' },
  'WW': { name: 'Worldwide', flag: '🌐' }
};

const FlagIcon = ({ code }: { code: string }) => {
  let c = code.trim().toLowerCase();
  if (c === 'uk') c = 'gb'; // flagcdn and ISO 3166-1 uses 'gb' for United Kingdom
  
  if (!c || c === 'ww' || c.length !== 2) return <span style={{marginRight: '4px'}}>🌐</span>;
  
  return (
    <img 
      src={`https://flagcdn.com/16x12/${c}.png`} 
      srcSet={`https://flagcdn.com/32x24/${c}.png 2x, https://flagcdn.com/48x36/${c}.png 3x`}
      width="16" 
      height="12" 
      alt={code} 
      style={{ marginRight: '6px', verticalAlign: 'middle', borderRadius: '2px', display: 'inline-block' }} 
    />
  );
};

const getCountryData = (code: string) => {
  const c = code.trim().toUpperCase();
  const name = COUNTRY_MAP[c]?.name || c;
  return { name, code: c };
};

const NetworkCardCategories: React.FC<{
  networkId: string;
  categories: { name: string, count: number, active?: number }[];
  onDrill: (v: string, e: React.MouseEvent) => void;
}> = ({ networkId, categories, onDrill }) => {
  const displayLimit = 3;
  const showMore = categories.length > displayLimit;
  const displayed = categories.slice(0, displayLimit);

  return (
    <div className="group-tags" style={{ flexWrap: 'wrap', marginTop: '8px' }}>
      <div style={{ width: '100%', fontSize: '11px', color: 'var(--text3)', marginBottom: '4px' }}>
        {categories.length} Categories
      </div>
      {displayed.map((cat, idx) => (
        <span 
          key={cat.name} 
          className="tag vertical" 
          style={(cat.active ?? 0) >= 10 ? { backgroundColor: 'var(--purple)', color: 'white', borderColor: 'var(--purple)', fontWeight: 600, boxShadow: '0 0 10px rgba(176,127,255,0.4)' } : {}}
          onClick={(e) => onDrill(cat.name, e)}
          title={`${cat.count} offers`}
        >
          {cat.name}
        </span>
      ))}
      {showMore && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <span className="tag vertical" style={{cursor: 'pointer', backgroundColor: 'var(--surface2)', borderStyle: 'dashed'}} onClick={(e) => e.stopPropagation()}>
              ... +{categories.length - displayLimit} more <ChevronDown size={10} style={{display: 'inline', marginLeft: '2px', verticalAlign: 'middle'}}/>
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-[300px] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div style={{padding: '5px 10px', fontSize: '11px', fontWeight: 'bold', color: 'var(--text3)'}}>All Categories</div>
            {categories.slice(displayLimit).map(cat => (
              <DropdownMenuItem key={cat.name} onClick={(e) => onDrill(cat.name, e)}>
                {cat.name} ({cat.count} offers)
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};

export const AdminOffersDrilldownView: React.FC<AdminOffersDrilldownViewProps> = ({
  offers: paginatedOffers,
  onOfferSelect,
  onOfferEdit,
  selectedOfferIds,
  onToggleSelect
}) => {
  const [currentView, setCurrentView] = useState<ViewType>('network');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('cards');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showHidden, setShowHidden] = useState(false);
  const [navStack, setNavStack] = useState<{ label: string; filters: Record<string, string> }[]>([]);

  // Fetch all data for accurate grouping
  const [allOffers, setAllOffers] = useState<Offer[]>([]);
  const [isLoadingAll, setIsLoadingAll] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchAll = async () => {
      setIsLoadingAll(true);
      try {
        const [resOffers, resRunning] = await Promise.all([
          adminOfferApi.getOffers({ per_page: 10000 }),
          adminOfferApi.getRunningOffers({ per_page: 10000 })
        ]);
        if (mounted) {
          const rawOffers = resOffers.offers || [];
          const runningArray = resRunning.offers || [];
          const runningMap = new Map();
          runningArray.forEach(o => runningMap.set(o.offer_id, o));
          
          const combined = rawOffers.map(o => {
            const ro = runningMap.get(o.offer_id);
            if (ro) {
               return { ...o, _is_running_client: true, sub_statuses: ro.sub_statuses || [] };
            }
            return o;
          });
          setAllOffers(combined);
        }
      } catch (err) {
        console.error("Failed to load all offers for drilldown", err);
      } finally {
        if (mounted) setIsLoadingAll(false);
      }
    };
    fetchAll();
    return () => { mounted = false; };
  }, []);

  // Use allOffers for grouping, but fallback to parent's paginated offers if slow or in table view at home
  const baseOffers = allOffers.length > 0 ? allOffers : paginatedOffers;

  // Helpers
  const getColor = (str: string) => {
    const colors = ['#6c8fff', '#3ecfcf', '#f5a623', '#b07fff', '#3ecf8e'];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const getBgColor = (str: string) => {
    const hex = getColor(str);
    return `${hex}26`; // 15% opacity
  };

  const parseVertical = (o: Offer) => o.vertical || o.category || 'Uncategorized';
  const getVerticalIcon = (vert: string) => {
     const v = vert.toLowerCase();
     if (v.includes('health') || v.includes('nutra')) return '🩺';
     if (v.includes('finance') || v.includes('crypto')) return '💰';
     if (v.includes('game') || v.includes('gaming')) return '🎮';
     if (v.includes('ecommerce') || v.includes('shop')) return '🛒';
     if (v.includes('travel')) return '✈️';
     if (v.includes('saas') || v.includes('software')) return '☁️';
     if (v.includes('date') || v.includes('dating')) return '❤️';
     return '📂';
  };

  // List of uninhabited or highly obscure ISO codes that bloat affiliate GEO lists
  const EXCLUDED_MINOR_TERRITORIES = new Set([
    'AQ', // Antarctica
    'BV', // Bouvet Island
    'HM', // Heard Island and McDonald Islands
    'IO', // British Indian Ocean Territory
    'TF', // French Southern Territories
    'UM', // US Minor Outlying Islands
    'GS', // South Georgia/Sandwich Islands
    'PN', // Pitcairn
    'CC', // Cocos (Keeling) Islands
    'CX', // Christmas Island
    'TK', // Tokelau
    'NU', // Niue
    'SJ', // Svalbard and Jan Mayen
    'NF', // Norfolk Island
    'FK', // Falkland Islands
    'BL', // Saint Barthélemy
    'MF', // Saint Martin (French part)
    'PM', // Saint Pierre and Miquelon
    'SH', // Saint Helena, Ascension and Tristan da Cunha
    'WF'  // Wallis and Futuna
  ]);

  const parseCountries = (o: Offer) => {
    if (!o.countries?.length) return ['WW'];
    const all = o.countries
      .flatMap(c => c.split(/[,|]/))
      .map(c => c.trim().toUpperCase())
      .filter(c => c && !EXCLUDED_MINOR_TERRITORIES.has(c));
    
    const unique = all.length ? Array.from(new Set(all)) : ['WW'];
    
    if (unique.length > 150) {
      return ['WW'];
    }
    
    return unique;
  };
  const parseNetwork = (o: Offer) => o.network || 'Unknown';

  const calculateStats = (filteredOffers: Offer[]) => {
    let active = 0, inactive = 0, paused = 0, hidden = 0, pending = 0, running = 0;
    let topPayout = 0;
    Array.from(filteredOffers).forEach(o => {
      if (o.status === 'active') active++;
      else if (o.status === 'inactive') inactive++;
      
      // Separate counter independent of base status strings
      if ((o as any)._is_running_client || o.status === 'running') running++;
      
      const p = Number(o.payout) || 0;
      if (p > topPayout) topPayout = p;
    });
    return { active, inactive, paused, hidden, pending, running, topPayout, avgEpc: 1.05 }; // epc mocked safely
  };

  const drilldownOffers = useMemo(() => {
    let result = baseOffers;
    const topFilter = navStack[navStack.length - 1]?.filters;
    if (topFilter) {
      if (topFilter.network) result = result.filter(o => parseNetwork(o).toUpperCase() === topFilter.network.toUpperCase());
      if (topFilter.vertical) result = result.filter(o => parseVertical(o).toUpperCase() === topFilter.vertical.toUpperCase());
      if (topFilter.country) result = result.filter(o => parseCountries(o).map(c => c.toUpperCase().trim()).includes(topFilter.country.toUpperCase().trim()));
      if (topFilter.status) {
        if (topFilter.status.toLowerCase() === 'running') {
           result = result.filter(o => (o as any)._is_running_client || o.status.toLowerCase() === 'running');
           if (topFilter.sub_status) {
               result = result.filter(o => {
                   const ss = (o as any).sub_statuses || [];
                   return ss.includes(topFilter.sub_status);
               });
           }
        } else {
           result = result.filter(o => o.status.toLowerCase() === topFilter.status.toLowerCase());
        }
      }
    }
    return result;
  }, [baseOffers, navStack]);

  const visibleOffers = showHidden ? drilldownOffers : drilldownOffers.filter(o => o.status !== 'hidden');
  const filteredOffers = statusFilter === 'all' 
    ? visibleOffers 
    : statusFilter === 'running' ? visibleOffers.filter(o => (o as any)._is_running_client || o.status === 'running') : statusFilter === 'hidden' ? drilldownOffers.filter(o => o.status === 'hidden') : visibleOffers.filter(o => o.status === statusFilter);

  const stats = calculateStats(baseOffers);

  const availableGeosInCurrentContext = useMemo(() => {
    let contextOffers = baseOffers;
    const topFilter = navStack[navStack.length - 1]?.filters;
    if (topFilter) {
      if (topFilter.network) contextOffers = contextOffers.filter(o => parseNetwork(o).toUpperCase() === topFilter.network.toUpperCase());
      if (topFilter.vertical) contextOffers = contextOffers.filter(o => parseVertical(o).toUpperCase() === topFilter.vertical.toUpperCase());
      if (topFilter.country) contextOffers = contextOffers.filter(o => parseCountries(o).map(c => c.toUpperCase().trim()).includes(topFilter.country.toUpperCase().trim()));
    }
    
    // Check based on status Filter state as well
    if (statusFilter !== 'all') {
       if (statusFilter === 'hidden') {
          contextOffers = contextOffers.filter(o => o.status === 'hidden');
       } else {
          contextOffers = contextOffers.filter(o => o.status === statusFilter);
       }
    } else if (!showHidden) {
       contextOffers = contextOffers.filter(o => o.status !== 'hidden');
    }

    const set = new Set<string>();
    contextOffers.forEach(o => {
      parseCountries(o).forEach(c => set.add(c.trim()));
    });
    return Array.from(set).sort();
  }, [baseOffers, navStack, statusFilter, showHidden]);

  // Compute overall top active stats for highlighting tags within individual offers
  const topActiveStats = useMemo(() => {
    const geoMap: Record<string, number> = {};
    const vertMap: Record<string, number> = {};
    
    filteredOffers.forEach(o => {
      const isActive = ((o as any)._is_running_client || o.status === 'running' || o.status === 'active');
      if (isActive) {
         parseCountries(o).forEach(c => { geoMap[c] = (geoMap[c] || 0) + 1; });
         const vert = parseVertical(o);
         vertMap[vert] = (vertMap[vert] || 0) + 1;
      }
    });
    
    const topGeo = '';
    const topVert = '';
    return { topGeo, topVert, geoMap, vertMap };
  }, [filteredOffers]);

  // Groupings
  const networkGroups = useMemo(() => {
    const groups: Record<string, { id: string, name: string, offers: Offer[] }> = {};
    filteredOffers.forEach(o => {
      const net = parseNetwork(o);
      if (!groups[net]) groups[net] = { id: net, name: net, offers: [] };
      groups[net].offers.push(o);
    });
    return Object.values(groups).map(g => {
      const gStats = calculateStats(g.offers);
      
      const geoMap: Record<string, number> = {};
      const catTotalMap: Record<string, number> = {};
      const catActiveMap: Record<string, number> = {};

      g.offers.forEach(o => {
        const isActive = ((o as any)._is_running_client || o.status === 'running' || o.status === 'active');
        parseCountries(o).forEach(c => {
          geoMap[c] = (geoMap[c] || 0) + (isActive ? 1 : 0);
        });
        const cat = parseVertical(o);
        catTotalMap[cat] = (catTotalMap[cat] || 0) + 1;
        catActiveMap[cat] = (catActiveMap[cat] || 0) + (isActive ? 1 : 0);
      });

      const geos = Object.keys(geoMap).filter(name => geoMap[name] > 0).sort((a, b) => geoMap[b] - geoMap[a]).map(name => ({ name, active: geoMap[name] || 0 }));
      const categoryCounts = Object.keys(catTotalMap).map(name => ({ name, count: catTotalMap[name], active: catActiveMap[name] || 0 })).filter(c => c.active > 0).sort((a, b) => b.active - a.active);
      const verticals = categoryCounts.map(c => ({ name: c.name, active: c.active }));

      return { ...g, ...gStats, geos, verticals, categoryCounts, count: g.offers.length, activeTotal: gStats.active + gStats.running };
    }).sort((a,b) => b.activeTotal - a.activeTotal);
  }, [filteredOffers]);

  const verticalGroups = useMemo(() => {
    const groups: Record<string, { id: string, name: string, offers: Offer[], icon: string }> = {};
    filteredOffers.forEach(o => {
      const vert = parseVertical(o);
      if (!groups[vert]) groups[vert] = { id: vert, name: vert, offers: [], icon: getVerticalIcon(vert) };
      groups[vert].offers.push(o);
    });
    return Object.values(groups).map(g => {
      const gStats = calculateStats(g.offers);
      
      const geoMap: Record<string, number> = {};
      const netMap: Record<string, number> = {};

      g.offers.forEach(o => {
        const isActive = ((o as any)._is_running_client || o.status === 'running' || o.status === 'active');
        parseCountries(o).forEach(c => {
          geoMap[c] = (geoMap[c] || 0) + (isActive ? 1 : 0);
        });
        const net = parseNetwork(o);
        netMap[net] = (netMap[net] || 0) + (isActive ? 1 : 0);
      });

      const geos = Object.keys(geoMap).filter(name => geoMap[name] > 0).sort((a, b) => geoMap[b] - geoMap[a]).map(name => ({ name, active: geoMap[name] || 0 }));
      const networks = Object.keys(netMap).filter(name => netMap[name] > 0).sort((a, b) => netMap[b] - netMap[a]).map(name => ({ name, active: netMap[name] || 0 }));
      return { ...g, ...gStats, geos, networks, count: g.offers.length, activeTotal: gStats.active + gStats.running };
    }).sort((a,b) => b.activeTotal - a.activeTotal);
  }, [filteredOffers]);

  const countryGroups = useMemo(() => {
    const groups: Record<string, { id: string, name: string, offers: Offer[] }> = {};
    filteredOffers.forEach(o => {
      parseCountries(o).forEach(c => {
        if (!groups[c]) groups[c] = { id: c, name: getCountryData(c).name, offers: [] };
        groups[c].offers.push(o);
      });
    });
    return Object.values(groups).map(g => {
      const gStats = calculateStats(g.offers);
      const netMap: Record<string, number> = {};
      const vertMap: Record<string, number> = {};

      g.offers.forEach(o => {
        const isActive = ((o as any)._is_running_client || o.status === 'running' || o.status === 'active');
        const net = parseNetwork(o);
        netMap[net] = (netMap[net] || 0) + (isActive ? 1 : 0);
        const vert = parseVertical(o);
        vertMap[vert] = (vertMap[vert] || 0) + (isActive ? 1 : 0);
      });

      const networks = Object.keys(netMap).filter(name => netMap[name] > 0).sort((a, b) => netMap[b] - netMap[a]).map(name => ({ name, active: netMap[name] || 0 }));
      const verticals = Object.keys(vertMap).filter(name => vertMap[name] > 0).sort((a, b) => vertMap[b] - vertMap[a]).map(name => ({ name, active: vertMap[name] || 0 }));
      return { ...g, ...gStats, networks, verticals, count: g.offers.length, activeTotal: gStats.active + gStats.running };
    }).sort((a,b) => b.activeTotal - a.activeTotal);
  }, [filteredOffers]);

  const statusGroups = [
    { id: 'running', name: 'Running', color: '#6c8fff', bg: 'rgba(108,143,255,0.13)', icon: '▶', count: stats.running, offers: filteredOffers.filter(o => (o as any)._is_running_client || o.status === 'running') },
    { id: 'active', name: 'Active', color: '#3ecf8e', bg: 'rgba(62,207,142,0.13)', icon: '✓', count: stats.active, offers: filteredOffers.filter(o => o.status === 'active') },
    { id: 'inactive', name: 'Inactive', color: '#8b8fa8', bg: 'rgba(139,143,168,0.1)', icon: '○', count: stats.inactive, offers: filteredOffers.filter(o => o.status === 'inactive') }
  ].filter(s => s.count > 0);

  // Nav Handlers
  const goHome = () => setNavStack([]);
  const goToStackLevel = (index: number) => setNavStack(navStack.slice(0, index + 1));
  const goBack = () => setNavStack(navStack.slice(0, -1));

  const drill = (type: string, id: string, name: string, count: number) => {
    setNavStack([{ label: `${name} (${count})`, filters: { [type]: id } }]);
  };
  const drillInContext = (type: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const top = navStack[navStack.length - 1];
    const newFilters = { ...(top?.filters || {}), [type]: id };
    setNavStack([...navStack, { label: `${type.toUpperCase()}: ${id}`, filters: newFilters }]);
  };
  const drillFromCard = (parentType: string, parentId: string, type: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNavStack([
      { label: `${parentId.toUpperCase()}`, filters: { [parentType]: parentId } },
      { label: `${type.toUpperCase()}: ${id}`, filters: { [parentType]: parentId, [type]: id } }
    ]);
  };

  const drillFromCardWithSub = (parentType: string, parentId: string, type: string, id: string, subStatus: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNavStack([
      { label: `${parentId.toUpperCase()}`, filters: { [parentType]: parentId } },
      { label: `${type.toUpperCase()}: ${id} (${subStatus})`, filters: { [parentType]: parentId, [type]: id, sub_status: subStatus } }
    ]);
  };

  const renderOfferTable = (items: Offer[]) => {
    // If the list is huge, slice it to prevent browser crash
    const displayItems = items.slice(0, 150);
    return (
      <div style={{overflowX: 'auto'}}>
        {items.length > 150 && <div style={{fontSize: '11px', color: 'var(--text3)', margin: '10px 0'}}>Showing first 150 of {items.length} offers</div>}
        <table className="offers-table">
          <thead>
            <tr>
              <th>Sel</th>
              <th>Offer</th>
              <th>Network</th>
              <th>Vertical</th>
              <th>GEOs</th>
              <th>Payout</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {displayItems.map(o => (
              <tr key={o.offer_id} onClick={() => onOfferSelect(o)} style={{cursor: 'pointer'}}>
                <td onClick={(e) => e.stopPropagation()}>
                  <input 
                      type="checkbox" 
                      className="rounded bg-gray-800 border-gray-600 outline-none"
                      checked={selectedOfferIds.has(o.offer_id)} 
                      onChange={(e) => onToggleSelect(o.offer_id, e as any)} 
                  />
                </td>
                <td><span className="offer-name">{o.name}</span><br/><span style={{fontSize: '10px', color: 'var(--text3)'}}>{o.offer_id}</span></td>
                <td>{parseNetwork(o)}</td>
                <td>
                  <span 
                    className="tag vertical" 
                    style={(topActiveStats.vertMap[parseVertical(o)] || 0) >= 10 ? { backgroundColor: 'var(--purple)', color: 'white', borderColor: 'var(--purple)', fontWeight: 600, boxShadow: '0 0 10px rgba(176,127,255,0.4)', display: 'inline-block' } : { display: 'inline-block' }} 
                    onClick={(e) => { e.stopPropagation(); drillInContext('vertical', parseVertical(o), e); }}
                  >
                    {parseVertical(o)}
                  </span>
                </td>
                <td>
                  {parseCountries(o).map(g => (
                    <span 
                      key={g} 
                      className="tag geo" 
                      style={(topActiveStats.geoMap[g] || 0) >= 10 ? { marginRight: '3px', backgroundColor: 'var(--accent)', color: 'black', borderColor: 'var(--accent)', fontWeight: 600, boxShadow: '0 0 10px rgba(108,143,255,0.3)', display: 'inline-block' } : { marginRight: '3px', display: 'inline-block' }} 
                      onClick={(e) => { e.stopPropagation(); drillInContext('country', g, e); }}
                    >
                      {g}
                    </span>
                  ))}
                </td>
                <td className="payout">${(Number(o.payout) || 0).toFixed(2)}</td>
                <td><span className={`status-badge ${o.status}`}>{o.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="drilldown-container" style={{boxShadow: '0 10px 30px rgba(0,0,0,0.4)', border: '1px solid #2a2d35'}}>
      <div className="header">
        <div className="header-title">
          <h1>Affiliate Offers</h1>
          <p>Manage and track all your affiliate network offers {isLoadingAll && <span style={{color: 'var(--accent)'}}>(Aggregating all data...)</span>}</p>
        </div>
        <div className="view-tabs">
          <button className={`tab-btn ${currentView === 'network' ? 'active' : ''}`} onClick={() => { setCurrentView('network'); goHome(); setDisplayMode('cards'); }}>By Network</button>
          <button className={`tab-btn ${currentView === 'vertical' ? 'active' : ''}`} onClick={() => { setCurrentView('vertical'); goHome(); setDisplayMode('cards'); }}>By Vertical</button>
          <button className={`tab-btn ${currentView === 'country' ? 'active' : ''}`} onClick={() => { setCurrentView('country'); goHome(); setDisplayMode('cards'); }}>By Country</button>
          <button className={`tab-btn ${currentView === 'status' ? 'active' : ''}`} onClick={() => { setCurrentView('status'); goHome(); setDisplayMode('cards'); }}>By Status</button>
          <button className={`tab-btn ${currentView === 'table' ? 'active' : ''}`} onClick={() => { setCurrentView('table'); goHome(); setDisplayMode('table'); }}>Table</button>
        </div>
      </div>

      <div className="stats-bar">
        <div className="stat-card"><div className="label">Total Offers</div><div className="value">{baseOffers.length}</div></div>
        <div className="stat-card"><div className="label">Running</div><div className="value" style={{color: 'var(--accent)'}}>{stats.running}</div></div>
        <div className="stat-card"><div className="label">Active</div><div className="value green">{stats.active}</div></div>
        <div className="stat-card"><div className="label">Inactive</div><div className="value">{stats.inactive}</div></div>
        <div className="stat-card"><div className="label">Avg EPC</div><div className="value accent">${stats.avgEpc.toFixed(2)}</div></div>
      </div>

      <div className="breadcrumb-bar">
        <span className="crumb" onClick={goHome}>Home</span>
        {currentView !== 'table' && (
           <>
            <span className="sep">›</span>
            <span className={`crumb ${navStack.length === 0 ? 'current' : ''}`} onClick={goHome}>
              {currentView === 'network' ? 'Networks' : currentView === 'vertical' ? 'Verticals' : currentView === 'country' ? 'Countries' : 'Status'}
            </span>
           </>
        )}
        {navStack.map((entry, i) => (
          <React.Fragment key={i}>
            <span className="sep">›</span>
            <span className={`crumb ${i === navStack.length - 1 ? 'current' : ''}`} onClick={() => goToStackLevel(i)}>{entry.label}</span>
          </React.Fragment>
        ))}
      </div>

      {currentView !== 'table' && (
        <>
          <div className="filter-row" style={navStack.length > 0 ? { borderBottom: 'none', paddingBottom: '10px' } : {}}>
            <span className="filter-label">STATUS</span>
            <button className={`filter-pill ${statusFilter === 'all' ? 'active' : ''}`} onClick={() => setStatusFilter('all')}>All</button>
            <button className={`filter-pill ${statusFilter === 'running' ? 'active' : ''}`} onClick={() => setStatusFilter('running')}>Running</button>
            <button className={`filter-pill ${statusFilter === 'active' ? 'active' : ''}`} onClick={() => setStatusFilter('active')}>Active</button>
            <button className={`filter-pill ${statusFilter === 'inactive' ? 'active' : ''}`} onClick={() => setStatusFilter('inactive')}>Inactive</button>
            <div className="spacer"></div>
            <div className="view-toggle">
              <button className={`view-toggle-btn ${displayMode === 'cards' ? 'active' : ''}`} onClick={() => setDisplayMode('cards')}>Cards</button>
              <button className={`view-toggle-btn ${displayMode === 'list' ? 'active' : ''}`} onClick={() => setDisplayMode('list')}>List</button>
              <button className={`view-toggle-btn ${displayMode === 'table' ? 'active' : ''}`} onClick={() => setDisplayMode('table')}>Table</button>
            </div>
          </div>
          {navStack.length > 0 && availableGeosInCurrentContext.length > 0 && (
            <div className="filter-row" style={{ paddingTop: '0px' }}>
              <span className="filter-label">GEOS</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {availableGeosInCurrentContext.slice(0, 15).map(geo => {
                  const isActive = navStack[navStack.length - 1]?.filters?.country?.toUpperCase() === geo.toUpperCase();
                  return (
                    <button 
                      key={geo} 
                      className={`filter-pill ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        const top = navStack[navStack.length - 1];
                        if (isActive) {
                           const newFilters = { ...top.filters };
                           delete newFilters.country;
                           setNavStack([...navStack.slice(0, -1), { ...top, filters: newFilters }]);
                        } else {
                           setNavStack([...navStack.slice(0, -1), { ...top, filters: { ...top.filters, country: geo } }]);
                        }
                      }}
                    >
                      {geo}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <div className="content-area">
        <div className={`level-back-bar ${navStack.length > 0 ? 'visible' : ''}`}>
          <button className="back-btn" onClick={goBack}>← Back</button>
          <span className="level-title">{navStack[navStack.length - 1]?.label}</span>
          <span className="level-count">{drilldownOffers.length} offers</span>
        </div>

        {/* TOP LEVEL */}
        {navStack.length === 0 ? (
          currentView === 'network' ? (
            displayMode === 'cards' ? (
              <>
                <div className="section-label">{networkGroups.length} NETWORKS</div>
                <div className="cards-grid">
                  {networkGroups.map(n => (
                    <div className="group-card" key={n.id} onClick={() => drill('network', n.id, n.name, n.count)}>
                      <div className="group-card-header">
                        <div className="group-avatar" style={{ background: getBgColor(n.id), color: getColor(n.id) }}>{n.id.substring(0, 2).toUpperCase()}</div>
                        <div>
                          <div className="group-name">{n.name}</div>
                          <div className="group-meta" style={{color: 'var(--text3)'}}>
                            <span>{n.count} offers</span>
                            {' · '}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <span style={{cursor: 'pointer', textDecoration: 'underline'}} onClick={(e) => e.stopPropagation()}>
                                  {n.geos.length} GEOs <ChevronDown size={10} style={{display:'inline'}}/>
                                </span>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="max-h-[300px] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                                <div style={{padding: '5px 10px', fontSize: '11px', fontWeight: 'bold', color: 'var(--text3)'}}>All GEOs</div>
                                {n.geos.map(geo => (
                                  <DropdownMenuItem key={geo.name} onClick={(e) => drillFromCard('network', n.id, 'country', geo.name, e)}>
                                    <FlagIcon code={geo.name} /> {geo.name} ({geo.active} active)
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                      <NetworkCardCategories 
                         networkId={n.id} 
                         categories={n.categoryCounts} 
                         onDrill={(v, e) => drillFromCard('network', n.id, 'vertical', v, e)} 
                      />
                      
                      <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', margin: '15px 0', padding: '12px 0', flexDirection: 'column', gap: '10px' }}>
                         <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div style={{ width: '50px', fontSize: '11px', color: 'var(--text3)' }}>GEOs</div>
                            <div className="group-tags">
                              {n.geos.slice(0, 4).map((c, idx) => <span key={c.name} className="tag geo" style={c.active >= 10 ? { backgroundColor: 'var(--accent)', color: 'black', borderColor: 'var(--accent)', fontWeight: 600, boxShadow: '0 0 10px rgba(108,143,255,0.3)' } : {}} onClick={(e) => drillFromCard('network', n.id, 'country', c.name, e)}><FlagIcon code={c.name}/>{c.name}</span>)}
                              {n.geos.length > 4 && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <span className="tag geo" style={{cursor:'pointer', backgroundColor:'var(--surface2)', borderStyle:'dashed'}} onClick={(e) => e.stopPropagation()}>
                                      + {n.geos.length - 4} more <ChevronDown size={10} style={{display:'inline'}}/>
                                    </span>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent className="max-h-[300px] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                                    <div style={{padding: '5px 10px', fontSize: '11px', fontWeight: 'bold', color: 'var(--text3)'}}>More GEOs</div>
                                    {n.geos.slice(4).map(c => (
                                      <DropdownMenuItem key={c.name} onClick={(e) => drillFromCard('network', n.id, 'country', c.name, e)}>
                                        <FlagIcon code={c.name}/>{c.name} ({c.active} active)
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                         </div>
                         <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div style={{ width: '50px', fontSize: '11px', color: 'var(--text3)' }}>Status</div>
                            <div className="group-status-row" style={{ margin: 0, flex: 1, display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <span className="status-dot" style={{cursor:'pointer'}} onClick={(e) => e.stopPropagation()}>
                                    <span className="dot running"></span>{n.running} running <ChevronDown size={10} style={{display:'inline', marginLeft:'2px'}}/>
                                  </span>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                                  <DropdownMenuItem onClick={(e) => drillFromCard('network', n.id, 'status', 'running', e)}>View All Running</DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => drillFromCardWithSub('network', n.id, 'status', 'running', 'picked', e)}>View Picked</DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => drillFromCardWithSub('network', n.id, 'status', 'running', 'approved', e)}>View Approved</DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => drillFromCardWithSub('network', n.id, 'status', 'running', 'rejected', e)}>View Rejected</DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => drillFromCardWithSub('network', n.id, 'status', 'running', 'has_clicks', e)}>View Has Clicks</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <span className="status-dot" style={{cursor:'pointer'}} onClick={(e) => e.stopPropagation()}>
                                    <span className="dot active"></span>{n.active} active <ChevronDown size={10} style={{display:'inline', marginLeft:'2px'}}/>
                                  </span>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                                  <DropdownMenuItem onClick={(e) => drillFromCard('network', n.id, 'status', 'active', e)}>Filter Active</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <span className="status-dot" style={{cursor:'pointer'}} onClick={(e) => e.stopPropagation()}>
                                    <span className="dot inactive"></span>{n.inactive} inactive <ChevronDown size={10} style={{display:'inline', marginLeft:'2px'}}/>
                                  </span>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                                  <DropdownMenuItem onClick={(e) => drillFromCard('network', n.id, 'status', 'inactive', e)}>Filter Inactive</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                         </div>
                         <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div style={{ width: '50px', fontSize: '11px', color: 'var(--text3)' }}>Filters</div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                               <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                     <button className="filter-pill" style={{padding: '2px 8px', fontSize: '10px'}} onClick={(e) => e.stopPropagation()}>GEO Filters <ChevronDown size={10} style={{display:'inline'}}/></button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent className="max-h-[300px] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                                     {n.geos.map(geo => (
                                        <DropdownMenuItem key={geo.name} onClick={(e) => drillFromCard('network', n.id, 'country', geo.name, e)}>
                                           {geo.name}
                                        </DropdownMenuItem>
                                     ))}
                                  </DropdownMenuContent>
                               </DropdownMenu>
                               <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                     <button className="filter-pill" style={{padding: '2px 8px', fontSize: '10px'}} onClick={(e) => e.stopPropagation()}>Vertical Filters <ChevronDown size={10} style={{display:'inline'}}/></button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent className="max-h-[300px] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                                     {n.categoryCounts.map(cat => (
                                        <DropdownMenuItem key={cat.name} onClick={(e) => drillFromCard('network', n.id, 'vertical', cat.name, e)}>
                                           {cat.name}
                                        </DropdownMenuItem>
                                     ))}
                                  </DropdownMenuContent>
                               </DropdownMenu>
                            </div>
                         </div>
                      </div>

                      <div className="group-card-footer">
                        <div className="metric-mini"><div className="mlabel">Avg EPC</div><div className="mvalue" style={{color:'var(--accent)'}}>${n.avgEpc.toFixed(2)}</div></div>
                        <div className="metric-mini" style={{textAlign:'right'}}><div className="mlabel">Top Payout</div><div className="mvalue amber">${n.topPayout.toFixed(2)}</div></div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : displayMode === 'list' ? (
               <div className="offers-list">
                 {networkGroups.map(n => (
                    <div className="offer-row" key={n.id} onClick={() => drill('network', n.id, n.name, n.count)}>
                       <div className="group-avatar" style={{ background: getBgColor(n.id), color: getColor(n.id) }}>{n.id.substring(0,2).toUpperCase()}</div>
                       <div className="offer-main">
                          <div className="offer-name">{n.name}</div>
                          <div className="offer-sub"><span style={{color:'var(--text3)', fontSize:'11px'}}>{n.geos.slice(0,6).map(g => g.name).join(', ')}</span></div>
                       </div>
                       <div style={{textAlign:'right', flexShrink:0}}>
                          <div style={{fontSize:'10px', color:'var(--text3)'}}>{n.count} offers</div>
                       </div>
                    </div>
                 ))}
               </div>
            ) : ( renderOfferTable(filteredOffers) )
          ) : currentView === 'vertical' ? (
             displayMode === 'cards' ? (
                <>
                <div className="section-label">{verticalGroups.length} VERTICALS</div>
                <div className="cards-grid">
                   {verticalGroups.map(v => (
                       <div className="group-card" key={v.id} onClick={() => drill('vertical', v.id, v.name, v.count)}>
                          <div className="group-card-header">
                             <div className="group-avatar" style={{ background: 'rgba(176,127,255,0.1)', color: 'var(--purple)', fontSize:'18px', border: '1px solid rgba(176,127,255,0.2)' }}>{v.icon}</div>
                        <div>
                           <div className="group-name">{v.name}</div>
                           <div className="group-meta" style={{color: 'var(--text3)'}}>
                              <span>{v.count} offers</span>
                              {' · '}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <span style={{cursor: 'pointer', textDecoration: 'underline'}} onClick={(e) => e.stopPropagation()}>
                                    {v.geos.length} GEOs <ChevronDown size={10} style={{display:'inline'}}/>
                                  </span>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="max-h-[300px] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                                  <div style={{padding: '5px 10px', fontSize: '11px', fontWeight: 'bold', color: 'var(--text3)'}}>All GEOs</div>
                                  {v.geos.map(geo => (
                                    <DropdownMenuItem key={geo.name} onClick={(e) => drillFromCard('vertical', v.id, 'country', geo.name, e)}>
                                      <FlagIcon code={geo.name} /> {geo.name} ({geo.active} active)
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                           </div>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', margin: '15px 0', padding: '12px 0', flexDirection: 'column', gap: '10px' }}>
                         <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div style={{ width: '50px', fontSize: '11px', color: 'var(--text3)' }}>GEOs</div>
                            <div className="group-tags">
                               {v.geos.slice(0,6).map(g => (
                                   <span key={g.name} className="tag geo" style={(g.active ?? 0) >= 10 ? { backgroundColor: 'var(--accent)', color: 'black', borderColor: 'var(--accent)', fontWeight: 600, boxShadow: '0 0 10px rgba(108,143,255,0.3)' } : {}} onClick={(e) => drillFromCard('vertical', v.id, 'country', g.name, e)}>
                                      <FlagIcon code={g.name} />{g.name}
                                   </span>
                               ))}
                               {v.geos.length > 6 && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <span className="tag geo" style={{cursor:'pointer', backgroundColor:'var(--surface2)', borderStyle:'dashed'}} onClick={(e) => e.stopPropagation()}>
                                      + {v.geos.length - 6} more <ChevronDown size={10} style={{display:'inline'}}/>
                                    </span>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent className="max-h-[300px] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                                    {v.geos.slice(6).map(c => (
                                      <DropdownMenuItem key={c.name} onClick={(e) => drillFromCard('vertical', v.id, 'country', c.name, e)}>
                                        <FlagIcon code={c.name}/>{c.name} ({c.active} active)
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                               )}
                            </div>
                         </div>
                         <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div style={{ width: '50px', fontSize: '11px', color: 'var(--text3)' }}>Status</div>
                            <div className="group-status-row" style={{ margin: 0, flex: 1, display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <span className="status-dot" style={{cursor:'pointer'}} onClick={(e) => e.stopPropagation()}>
                                    <span className="dot running"></span>{v.running} running <ChevronDown size={10} style={{display:'inline', marginLeft:'2px'}}/>
                                  </span>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                                  <DropdownMenuItem onClick={(e) => drillFromCard('vertical', v.id, 'status', 'running', e)}>View All Running</DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => drillFromCardWithSub('vertical', v.id, 'status', 'running', 'picked', e)}>View Picked</DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => drillFromCardWithSub('vertical', v.id, 'status', 'running', 'approved', e)}>View Approved</DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => drillFromCardWithSub('vertical', v.id, 'status', 'running', 'rejected', e)}>View Rejected</DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => drillFromCardWithSub('vertical', v.id, 'status', 'running', 'has_clicks', e)}>View Has Clicks</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>

                              <span className="status-dot" onClick={(e) => drillFromCard('vertical', v.id, 'status', 'active', e)}><span className="dot active"></span>{v.active} active</span>
                              <span className="status-dot" onClick={(e) => drillFromCard('vertical', v.id, 'status', 'inactive', e)}><span className="dot inactive"></span>{v.inactive} inactive</span>
                            </div>
                         </div>
                         <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div style={{ width: '50px', fontSize: '11px', color: 'var(--text3)' }}>Filters</div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                               <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                     <button className="filter-pill" style={{padding: '2px 8px', fontSize: '10px'}} onClick={(e) => e.stopPropagation()}>GEO Filters <ChevronDown size={10} style={{display:'inline'}}/></button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent className="max-h-[300px] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                                     {v.geos.map(geo => (
                                        <DropdownMenuItem key={geo.name} onClick={(e) => drillFromCard('vertical', v.id, 'country', geo.name, e)}>
                                           {geo.name}
                                        </DropdownMenuItem>
                                     ))}
                                  </DropdownMenuContent>
                               </DropdownMenu>
                            </div>
                         </div>
                      </div>

                      <div className="group-card-footer">
                            <div className="metric-mini"><div className="mlabel">Avg EPC</div><div className="mvalue" style={{color:'var(--green)'}}>${v.avgEpc.toFixed(2)}</div></div>
                            <div className="metric-mini" style={{textAlign:'right'}}><div className="mlabel">Top Payout</div><div className="mvalue amber">${v.topPayout.toFixed(2)}</div></div>
                          </div>
                       </div>
                   ))}
                </div>
                </>
             ) : ( renderOfferTable(filteredOffers) )
          ) : currentView === 'country' ? (
             displayMode === 'cards' ? (
               <>
               <div className="section-label">{countryGroups.length} COUNTRIES</div>
               <div className="cards-grid">
                 {countryGroups.map(c => (
                   <div className="group-card" key={c.id} onClick={() => drill('country', c.id, c.name, c.count)}>
                     <div className="group-card-header">
                       <div className="group-avatar" style={{ background: 'var(--surface2)', fontSize:'14px', border: '1px solid var(--border)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FlagIcon code={c.id} />
                       </div>
                        <div>
                           <div className="group-name">{c.name}</div>
                           <div className="group-meta" style={{color: 'var(--text3)'}}>
                              <span>{c.count} offers</span>
                              {' · '}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <span style={{cursor: 'pointer', textDecoration: 'underline'}} onClick={(e) => e.stopPropagation()}>
                                    {c.networks.length} networks <ChevronDown size={10} style={{display:'inline'}}/>
                                  </span>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="max-h-[300px] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                                  <div style={{padding: '5px 10px', fontSize: '11px', fontWeight: 'bold', color: 'var(--text3)'}}>All Networks</div>
                                  {c.networks.map(net => (
                                    <DropdownMenuItem key={net.name} onClick={(e) => drillFromCard('country', c.id, 'network', net.name, e)}>
                                      {net.name} ({net.active} active)
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                           </div>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', margin: '15px 0', padding: '12px 0', flexDirection: 'column', gap: '10px' }}>
                         <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div style={{ width: '50px', fontSize: '11px', color: 'var(--text3)' }}>Tags</div>
                            <div className="group-tags" style={{ margin: 0, flex: 1 }}>
                               {c.verticals.slice(0, 3).map((vert, idx) => <span key={vert.name} className="tag vertical" style={(vert.active ?? 0) >= 10 ? { backgroundColor: 'var(--purple)', color: 'white', borderColor: 'var(--purple)', fontWeight: 600, boxShadow: '0 0 10px rgba(176,127,255,0.4)' } : {}} onClick={(e) => { e.stopPropagation(); drillFromCard('country', c.id, 'vertical', vert.name, e); }}>{vert.name}</span>)}
                               {c.verticals.length > 3 && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <span className="tag vertical" style={{cursor:'pointer', backgroundColor:'var(--surface2)', borderStyle:'dashed'}} onClick={(e) => e.stopPropagation()}>
                                      + {c.verticals.length - 3} more <ChevronDown size={10} style={{display:'inline'}}/>
                                    </span>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent className="max-h-[300px] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                                    {c.verticals.slice(3).map(vert => (
                                      <DropdownMenuItem key={vert.name} onClick={(e) => drillFromCard('country', c.id, 'vertical', vert.name, e)}>
                                        {vert.name} ({vert.active} active)
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                               )}
                            </div>
                         </div>
                         <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div style={{ width: '50px', fontSize: '11px', color: 'var(--text3)' }}>Status</div>
                            <div className="group-status-row" style={{ margin: 0, flex: 1, display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <span className="status-dot" style={{cursor:'pointer'}} onClick={(e) => e.stopPropagation()}>
                                    <span className="dot running"></span>{c.running} <ChevronDown size={10} style={{display:'inline', marginLeft:'2px'}}/>
                                  </span>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                                  <DropdownMenuItem onClick={(e) => drillFromCard('country', c.id, 'status', 'running', e)}>View All Running</DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => drillFromCardWithSub('country', c.id, 'status', 'running', 'picked', e)}>View Picked</DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => drillFromCardWithSub('country', c.id, 'status', 'running', 'approved', e)}>View Approved</DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => drillFromCardWithSub('country', c.id, 'status', 'running', 'rejected', e)}>View Rejected</DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => drillFromCardWithSub('country', c.id, 'status', 'running', 'has_clicks', e)}>View Has Clicks</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              
                              <span className="status-dot" onClick={(e) => drillFromCard('country', c.id, 'status', 'active', e)}><span className="dot active"></span>{c.active}</span>
                              <span className="status-dot" onClick={(e) => drillFromCard('country', c.id, 'status', 'inactive', e)}><span className="dot inactive"></span>{c.inactive}</span>
                            </div>
                         </div>
                         <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div style={{ width: '50px', fontSize: '11px', color: 'var(--text3)' }}>Filters</div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                               <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                     <button className="filter-pill" style={{padding: '2px 8px', fontSize: '10px'}} onClick={(e) => e.stopPropagation()}>Vertical Filters <ChevronDown size={10} style={{display:'inline'}}/></button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent className="max-h-[300px] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                                     {c.verticals.map(vert => (
                                        <DropdownMenuItem key={vert.name} onClick={(e) => drillFromCard('country', c.id, 'vertical', vert.name, e)}>
                                           {vert.name}
                                        </DropdownMenuItem>
                                     ))}
                                  </DropdownMenuContent>
                               </DropdownMenu>
                            </div>
                         </div>
                      </div>

                      <div className="group-card-footer">
                        <div className="metric-mini"><div className="mlabel">Avg EPC</div><div className="mvalue" style={{color:'var(--green)'}}>${c.avgEpc.toFixed(2)}</div></div>
                        <div className="metric-mini" style={{textAlign:'right'}}><div className="mlabel">Top Payout</div><div className="mvalue amber">${c.topPayout.toFixed(2)}</div></div>
                     </div>
                   </div>
                 ))}
               </div>
               </>
             ) : ( renderOfferTable(filteredOffers) )
          ) : currentView === 'status' ? (
             displayMode === 'cards' ? (
               <>
                 <div className="section-label">{statusGroups.length} STATUS GROUPS</div>
                 <div className="cards-grid">
                   {statusGroups.map(s => {
                      const networks = Array.from(new Set(s.offers.map(parseNetwork)));
                      return (
                        <div className="group-card" key={s.id} onClick={() => drill('status', s.id, s.name, s.count)}>
                           <div className="group-card-header">
                              <div className="group-avatar" style={{ background: s.bg, color: s.color, fontSize:'16px' }}>{s.icon}</div>
                              <div><div className="group-name" style={{color: s.color}}>{s.name}</div><div className="group-meta">{s.count} offers across {networks.length} networks</div></div>
                           </div>
                           <div className="group-tags">{networks.slice(0,5).map(n => <span key={n} className="tag geo" onClick={(e) => { e.stopPropagation(); drillInContext('network', n, e); }}>{n}</span>)}</div>
                           <div className="group-card-footer">
                              <div className="metric-mini"><div className="mlabel">Avg EPC</div><div className="mvalue" style={{color: s.color}}>${stats.avgEpc.toFixed(2)}</div></div>
                              <div className="metric-mini" style={{textAlign:'right'}}><div className="mlabel">Top Payout</div><div className="mvalue amber">$0.00</div></div>
                           </div>
                        </div>
                      )
                   })}
                 </div>
               </>
             ) : ( renderOfferTable(filteredOffers) )
          ) : (
            renderOfferTable(filteredOffers)
          )
        ) : (
          /* DRILL DOWN LEVEL */
          displayMode === 'cards' ? (
            <div className="cards-grid">
              {filteredOffers.map(o => {
                const geos = parseCountries(o);
                return (
                  <div className="group-card" key={o.offer_id} onClick={() => onOfferSelect(o)}>
                    <div className="group-card-header">
                      <input 
                        type="checkbox" 
                        className="mr-2 h-4 w-4 rounded bg-gray-800 border-gray-600 shrink-0"
                        onClick={(e) => onToggleSelect(o.offer_id, e)}
                        checked={selectedOfferIds.has(o.offer_id)}
                      />
                      <div style={{minWidth: 0, flex: 1}}>
                        <div className="group-name" style={{ fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.name}</div>
                        <div className="group-meta">{o.offer_id} · {parseNetwork(o)}</div>
                      </div>
                    </div>
                    <div className="group-tags">
                      <span 
                         className="tag vertical" 
                         style={(topActiveStats.vertMap[parseVertical(o)] || 0) >= 10 ? { backgroundColor: 'var(--purple)', color: 'white', borderColor: 'var(--purple)', fontWeight: 600, boxShadow: '0 0 10px rgba(176,127,255,0.4)' } : {}} 
                         onClick={(e) => drillInContext('vertical', parseVertical(o), e)}
                      >
                         {parseVertical(o)}
                      </span>
                      {geos.slice(0,4).map(g => (
                          <span 
                             key={g} 
                             className="tag geo" 
                             style={(topActiveStats.geoMap[g] || 0) >= 10 ? { backgroundColor: 'var(--accent)', color: 'black', borderColor: 'var(--accent)', fontWeight: 600, boxShadow: '0 0 10px rgba(108,143,255,0.3)' } : {}} 
                             onClick={(e) => drillInContext('country', g, e)}
                          >
                             <FlagIcon code={g} />{g}
                          </span>
                      ))}
                    </div>
                    <div className="group-card-footer">
                      <div className="metric-mini"><div className="mlabel">Payout</div><div className="mvalue">${(Number(o.payout) || 0).toFixed(2)}</div></div>
                      <span className={`status-badge ${o.status}`}>{o.status}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : displayMode === 'list' ? (
            <div className="offers-list">
              {filteredOffers.map(o => (
                 <div className="offer-row" key={o.offer_id} onClick={() => onOfferSelect(o)}>
                   <input 
                     type="checkbox" 
                     className="mr-3 h-4 w-4 shrink-0 rounded bg-gray-800" 
                     onClick={(e) => onToggleSelect(o.offer_id, e)}
                     checked={selectedOfferIds.has(o.offer_id)} 
                   />
                   <div className="offer-main">
                      <div className="offer-name">{o.name}</div>
                      <div className="offer-sub">
                        <span 
                           className="tag vertical" 
                           style={(topActiveStats.vertMap[parseVertical(o)] || 0) >= 10 ? { backgroundColor: 'var(--purple)', color: 'white', borderColor: 'var(--purple)', fontWeight: 600, boxShadow: '0 0 10px rgba(176,127,255,0.4)' } : {}}
                           onClick={(e) => { e.stopPropagation(); drillInContext('vertical', parseVertical(o), e); }}
                        >
                           {parseVertical(o)}
                        </span>
                        <span className="offer-epc">Payout ${(Number(o.payout) || 0).toFixed(2)}</span>
                      </div>
                   </div>
                   <span className={`status-badge ${o.status}`}>{o.status}</span>
                 </div>
              ))}
            </div>
          ) : (
            renderOfferTable(filteredOffers)
          )
        )}
      </div>
    </div>
  );
};
