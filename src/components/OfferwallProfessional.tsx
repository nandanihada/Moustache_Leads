import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, X, ChevronRight, Timer, Sparkles, Award, LayoutGrid, List } from 'lucide-react';
import { OfferModal } from './OfferModal';
import SurveyTemplateRenderer, { TemplateName } from './survey-templates/SurveyTemplateRenderer';
import { getOfferImage } from '@/utils/categoryImages';
import OfferwallPreloader from '@/components/ui/offerwall-preloader';

interface Offer {
  id: string; title: string; description: string; reward_amount: number; reward_currency: string;
  category: string; categories?: string[]; difficulty: string; estimated_time: string;
  image_url: string; click_url: string; requirements: string[]; conversion_rate: number;
  countries?: string[]; devices?: string[]; device_targeting?: string; payout?: number;
  payout_type?: string; star_rating?: number; status?: string; timer_enabled?: boolean;
  timer_end_date?: string; urgency?: { type: string; message: string; }; urgency_type?: string;
  is_locked?: boolean; has_access?: boolean; requires_approval?: boolean;
  tracking_params: { placement_id: string; user_id: string; timestamp: string; };
}

const CATEGORIES = [
  { id: 'all', name: 'All' }, { id: 'HEALTH', name: 'Health' }, { id: 'SURVEY', name: 'Surveys' },
  { id: 'SWEEPSTAKES', name: 'Sweepstakes' }, { id: 'EDUCATION', name: 'Education' },
  { id: 'INSURANCE', name: 'Insurance' }, { id: 'LOAN', name: 'Loans' }, { id: 'FINANCE', name: 'Finance' },
  { id: 'DATING', name: 'Dating' }, { id: 'FREE_TRIAL', name: 'Free Trials' },
  { id: 'INSTALLS', name: 'Installs' }, { id: 'GAMES_INSTALL', name: 'Games' },
];

const SORT_OPTIONS = [
  { id: 'trending', name: 'Trending' }, { id: 'points_high', name: 'Highest' },
  { id: 'points_low', name: 'Lowest' }, { id: 'newest', name: 'Newest' }, { id: 'rating', name: 'Top Rated' },
];

const DEVICE_OPTIONS = [
  { id: 'all', name: 'All Devices' }, { id: 'android', name: 'Android' },
  { id: 'ios', name: 'iOS' }, { id: 'desktop', name: 'Desktop' },
];

const PAYOUT_TYPE_OPTIONS = [
  { id: 'all', name: 'All Types' }, { id: 'cpa', name: 'CPA' }, { id: 'cpi', name: 'CPI' },
  { id: 'cpl', name: 'CPL' }, { id: 'cps', name: 'CPS' }, { id: 'revshare', name: 'RevShare' },
];

// Helpers
const cleanTitle = (title: string): string => {
  const codes = ['US','GB','CA','AU','DE','FR','IT','ES','BR','IN','JP','NL','SG','AE','ZA','KR'];
  let c = title;
  c = c.replace(/[\s,\-]+([A-Z]{2}[\s,]*)+$/i, '');
  codes.forEach(code => { c = c.replace(new RegExp(`\\b${code}\\b[,\\s]*`, 'gi'), ''); });
  return c.replace(/[\s,\-]+$/, '').replace(/\s+/g, ' ').trim();
};

const truncTitle = (title: string, max = 6): string => {
  const w = cleanTitle(title).split(' ');
  return w.length <= max ? cleanTitle(title) : w.slice(0, max).join(' ') + '…';
};

const getCatName = (cat: string) => CATEGORIES.find(c => c.id === cat?.toUpperCase())?.name || cat || 'Other';

// Timer
const CountdownTimer: React.FC<{ endDate: string }> = ({ endDate }) => {
  const [t, setT] = useState({ h: 0, m: 0, s: 0 });
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const calc = () => { const d = new Date(endDate).getTime() - Date.now(); if (d <= 0) { setExpired(true); return; } setT({ h: Math.floor(d/3600000), m: Math.floor((d%3600000)/60000), s: Math.floor((d%60000)/1000) }); };
    calc(); const iv = setInterval(calc, 1000); return () => clearInterval(iv);
  }, [endDate]);
  if (expired) return null;
  return <span className="ow-badge-timer">{String(t.h).padStart(2,'0')}:{String(t.m).padStart(2,'0')}:{String(t.s).padStart(2,'0')}</span>;
};

interface Props { placementId: string; userId: string; subId?: string; country?: string; baseUrl?: string; }

export const OfferwallProfessional: React.FC<Props> = ({ placementId, userId, subId, country, baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000' }) => {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [filtered, setFiltered] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [device, setDevice] = useState('all');
  const [payoutType, setPayoutType] = useState('all');
  const [sort, setSort] = useState('trending');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selOffer, setSelOffer] = useState<Offer | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [currency, setCurrency] = useState('LEaDS');

  // Survey funnel
  const [funnel, setFunnel] = useState<any>(null);
  const [funnelSess, setFunnelSess] = useState('');
  const [funnelStep, setFunnelStep] = useState(0);
  const [funnelSurvey, setFunnelSurvey] = useState<any>(null);
  const [funnelAns, setFunnelAns] = useState<Record<number, string>>({});
  const [funnelResult, setFunnelResult] = useState<any>(null);
  const [funnelSubmitting, setFunnelSubmitting] = useState(false);
  const [funnelTpl, setFunnelTpl] = useState<TemplateName>('modern-card');
  const [earnings, setEarnings] = useState(0);
  const [showPreloader, setShowPreloader] = useState(true);
  const [displaySettings, setDisplaySettings] = useState({ primary_color: '#340075', background_color: '#fcf8ff', layout: 'grid' as string, cards_per_row: 3, show_categories: true, show_search: true });
  const [announcements, setAnnouncements] = useState<Array<{text: string; id: string}>>([]);
  const [subWalls, setSubWalls] = useState<Array<any>>([]);
  const [isQualified, setIsQualified] = useState<boolean | null>(null);
  const [qualSurvey, setQualSurvey] = useState<any>(null);
  const [showQual, setShowQual] = useState(false);
  const [qualSection, setQualSection] = useState(0);
  const [qualAnswers, setQualAnswers] = useState<Record<string, any>>({});
  const [newUserIds, setNewUserIds] = useState<string[]>([]);

  useEffect(() => { trackImpression(); loadOffers(); loadSettings(); loadSubWalls(); checkQual(); }, [placementId, userId]);
  useEffect(() => { applyFilters(); }, [offers, search, category, device, payoutType, sort, isQualified, newUserIds]);
  useEffect(() => { if (displaySettings.layout === 'table') setViewMode('table'); else setViewMode('grid'); }, [displaySettings.layout]);

  // === Backend Logic ===
  const checkQual = async () => {
    try {
      const r = await fetch(`${baseUrl}/api/admin/surveys/qualification/check?user_id=${encodeURIComponent(userId)}`);
      if (r.ok) { const d = await r.json(); if (d.qualified) { setIsQualified(true); localStorage.setItem(`offerwall_qualified_${userId}`, 'true'); } else { setIsQualified(false); localStorage.removeItem(`offerwall_qualified_${userId}`); try { const sr = await fetch(`${baseUrl}/api/admin/surveys/qualification`); if (sr.ok) { const sd = await sr.json(); if (sd.survey) setQualSurvey(sd.survey); } } catch {} try { const or = await fetch(`${baseUrl}/api/admin/offerwall-management/new-user-offers`); if (or.ok) { const od = await or.json(); setNewUserIds(od.offer_ids || od.new_user_offer_ids || []); } } catch {} } }
      else setIsQualified(localStorage.getItem(`offerwall_qualified_${userId}`) === 'true');
    } catch { setIsQualified(localStorage.getItem(`offerwall_qualified_${userId}`) === 'true'); }
  };

  const handleQualSubmit = async () => {
    if (!qualSurvey) return;
    try { const ans = Object.entries(qualAnswers).map(([qid, a]) => ({ question_id: qid, answer: a })); const r = await fetch(`${baseUrl}/api/admin/surveys/public/${qualSurvey._id}/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId, answers: ans, time_spent_seconds: 0 }) }); if (r.ok) { localStorage.setItem(`offerwall_qualified_${userId}`, 'true'); setIsQualified(true); setShowQual(false); setQualAnswers({}); setQualSection(0); loadOffers(); } } catch {}
  };

  const trackImpression = async () => {
    try { const sk = `offerwall_session_${placementId}_${userId}`; let sid = sessionStorage.getItem(sk); if (!sid) { sid = `s_${Date.now()}_${Math.random().toString(36).slice(2,10)}`; sessionStorage.setItem(sk, sid); } await fetch(`${baseUrl}/api/offerwall/track/impression`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sid, placement_id: placementId, user_id: userId, user_agent: navigator.userAgent, referrer: document.referrer }) }); } catch {}
  };

  const loadOffers = async () => {
    try { setLoading(true); setError(null); const r = await fetch(`${baseUrl}/api/offerwall/offers?placement_id=${placementId}&user_id=${userId}&limit=10000`); if (!r.ok) throw new Error('Failed'); const d = await r.json(); if (d.error) throw new Error(d.error); setCurrency(d.currency_name || 'LEaDS'); let funnels: any[] = []; try { const fr = await fetch(`${baseUrl}/api/survey-funnel/active?placement=offerwall`); if (fr.ok) funnels = (await fr.json()).funnels || []; } catch {} setOffers([...funnels, ...(d.offers || [])]); } catch (e) { setError(e instanceof Error ? e.message : 'Error'); } finally { setLoading(false); }
  };

  const loadSettings = async () => { try { const r = await fetch(`${baseUrl}/api/admin/offerwall-management/display-settings`); if (r.ok) { const d = await r.json(); if (d.theme) setDisplaySettings(p => ({ ...p, ...d.theme })); if (d.announcements) setAnnouncements(d.announcements); } } catch {} };
  const loadSubWalls = async () => { try { const r = await fetch(`${baseUrl}/api/admin/sub-walls/public/list?user_id=${encodeURIComponent(userId)}&placement_id=${encodeURIComponent(placementId)}`); if (r.ok) { const d = await r.json(); if (d.sub_walls) setSubWalls(d.sub_walls); } } catch {} };

  const applyFilters = () => {
    let f = [...offers];
    if (isQualified === null) { setFiltered([]); return; }
    if (!isQualified) { if (newUserIds.length > 0) f = f.filter(o => newUserIds.includes(o.id) || newUserIds.includes((o as any).offer_id) || newUserIds.includes((o as any)._id)); else f = []; }

    const catMap: Record<string, string[]> = { 'HEALTH':['HEALTH','HEALTHCARE','MEDICAL'],'SURVEY':['SURVEY','SURVEYS'],'SWEEPSTAKES':['SWEEPSTAKES','SWEEPS','GIVEAWAY','PRIZE','LOTTERY','RAFFLE','CONTEST'],'EDUCATION':['EDUCATION','LEARNING'],'INSURANCE':['INSURANCE'],'LOAN':['LOAN','LOANS','LENDING'],'FINANCE':['FINANCE','FINANCIAL'],'DATING':['DATING','RELATIONSHIPS'],'FREE_TRIAL':['FREE_TRIAL','FREETRIAL','TRIAL'],'INSTALLS':['INSTALLS','INSTALL','APP','APPS'],'GAMES_INSTALL':['GAMES_INSTALL','GAMESINSTALL','GAME','GAMES','GAMING'] };
    if (category !== 'all') { const m = catMap[category.toUpperCase()] || [category.toUpperCase()]; f = f.filter(o => { const cats = (o as any).categories; if (Array.isArray(cats) && cats.length) return cats.some((c:string) => m.includes(c.toUpperCase())); return m.includes((o.category||'').toUpperCase()); }); }
    if (search) { const t = search.toLowerCase(); f = f.filter(o => o.title.toLowerCase().includes(t) || o.description.toLowerCase().includes(t)); }
    if (device !== 'all') f = f.filter(o => { const ds = (o.device_targeting || o.devices?.join(' ') || '').toLowerCase(); if (device === 'android') return ds.includes('android'); if (device === 'ios') return ds.includes('ios') || ds.includes('iphone'); if (device === 'desktop') return ds.includes('web') || ds.includes('desktop'); return true; });
    if (payoutType !== 'all') f = f.filter(o => ((o as any).payout_type || '').toLowerCase().includes(payoutType));

    f.sort((a, b) => { switch (sort) { case 'points_high': return (b.reward_amount||0) - (a.reward_amount||0); case 'points_low': return (a.reward_amount||0) - (b.reward_amount||0); case 'newest': return new Date(b.estimated_time||0).getTime() - new Date(a.estimated_time||0).getTime(); case 'rating': return (b.star_rating||5) - (a.star_rating||5); default: return (b.star_rating||5)*(b.reward_amount||1) - (a.star_rating||5)*(a.reward_amount||1); } });
    setFiltered(f);
  };

  const handleClick = (o: Offer) => { if ((o as any).is_funnel && (o as any).funnel_id) { startFunnel((o as any).funnel_id); return; } setSelOffer(o); setModalOpen(true); };
  const startFunnel = async (id: string) => { try { const r = await fetch(`${baseUrl}/api/survey-funnel/${id}/start`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({user_id:userId}) }); if (r.ok) { const d = await r.json(); setFunnelSess(d.session_id); setFunnelStep(d.step_index); setFunnelSurvey(d.survey); setFunnel(id); setFunnelResult(null); setFunnelAns({}); setFunnelTpl((d.survey_template||'modern-card') as TemplateName); } } catch {} };
  const submitFunnel = async () => { if (!funnel || !funnelSurvey) return; setFunnelSubmitting(true); try { const ans = Object.entries(funnelAns).map(([i,a])=>({question_index:Number(i),answer:a})); const r = await fetch(`${baseUrl}/api/survey-funnel/${funnel}/submit`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:funnelSess,step_index:funnelStep,answers:ans})}); if (r.ok) { const d = await r.json(); if (d.result==='passed') { setFunnelResult({type:'pass',message:d.message,redirect_url:d.redirect_url}); if (d.redirect_url) setTimeout(()=>window.open(d.redirect_url,'_blank'),2000); } else { if (d.has_next&&d.next_survey) { setFunnelResult({type:'fail',message:d.message,has_next:true}); setTimeout(()=>{setFunnelStep(d.next_step_index);setFunnelSurvey(d.next_survey);setFunnelResult(null);setFunnelAns({});},2000); } else setFunnelResult({type:'fail',message:d.message,has_next:false}); } } } catch {} finally { setFunnelSubmitting(false); } };
  const closeFunnel = () => { setFunnel(null); setFunnelSess(''); setFunnelSurvey(null); setFunnelResult(null); setFunnelAns({}); setFunnelStep(0); };

  if (loading && !showPreloader) return (
    <div className="ow min-h-screen flex items-center justify-center"><div className="text-center"><div className="ow-spinner mx-auto mb-4"></div><p className="text-[#4a4452] text-sm">Loading…</p></div></div>
  );

  if (error) return (
    <div className="ow min-h-screen flex items-center justify-center p-4"><div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm text-center border border-gray-100"><div className="text-4xl mb-3">⚠️</div><h2 className="text-lg font-bold text-gray-900 mb-2">Something went wrong</h2><p className="text-gray-500 text-sm mb-4">{error}</p><button onClick={loadOffers} className="ow-btn">Try Again</button></div></div>
  );

  return (
    <div className="ow min-h-screen flex flex-col">
      {/* === PRELOADER OVERLAY === */}
      {showPreloader && (
        <OfferwallPreloader
          dataReady={!loading}
          onComplete={() => setShowPreloader(false)}
        />
      )}
      {/* === HERO BANNER (taller, with category buttons ON it) === */}
      <div className="ow-hero relative overflow-hidden group">
        {/* Background image - Alps snow mountains */}
        <img src="https://i.postimg.cc/kMwzxqqW/alps-snow-mountains-7680x4320-25451.jpg" alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        {/* Lighter overlay - so image is more visible */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/40 z-[1]"></div>
        {/* Floating blocks animation on hover */}
        <div className="absolute inset-0 z-[2] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500">
          <div className="ow-block ow-block-1"></div>
          <div className="ow-block ow-block-2"></div>
          <div className="ow-block ow-block-3"></div>
          <div className="ow-block ow-block-4"></div>
          <div className="ow-block ow-block-5"></div>
        </div>
        <div className="relative z-10 max-w-[1300px] mx-auto px-4 md:px-8 flex flex-col justify-between" style={{ minHeight: '280px', paddingTop: '24px', paddingBottom: '0' }}>
          {/* Top row: Logo + Currency */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Moustache Leads" className="h-14 md:h-16 w-auto drop-shadow-xl" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <div>
                <h1 className="text-white font-black text-2xl md:text-3xl tracking-tight" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.7), 0 0 20px rgba(0,0,0,0.3)' }}>Moustache Leads</h1>
                <p className="text-white font-semibold text-sm md:text-base mt-0.5" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}>Complete offers. Earn rewards instantly.</p>
              </div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm border border-white/30 px-5 py-2.5 rounded-full shadow-lg">
              <span className="text-white font-bold text-sm md:text-base" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>{currency}: {earnings.toLocaleString()}</span>
            </div>
          </div>

          {/* Category buttons - at the BOTTOM edge of the banner */}
          <div className="flex items-center gap-2 overflow-x-auto pt-6 pb-3 scrollbar-hide -mb-[1px]">
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setCategory(cat.id)}
                className={`ow-cat-btn ${category === cat.id ? 'ow-cat-btn-active' : ''}`}>
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* === CONTROLS BAR === */}
      <div className="bg-gray-50/80 border-b border-gray-100">
        <div className="max-w-[1300px] mx-auto px-4 md:px-8 py-3 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#340075]/20 focus:border-[#340075]/40" />
            {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"><X className="w-3.5 h-3.5" /></button>}
          </div>

          {/* Device */}
          <select value={device} onChange={e => setDevice(e.target.value)} className="ow-select">{DEVICE_OPTIONS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          {/* Payout Type */}
          <select value={payoutType} onChange={e => setPayoutType(e.target.value)} className="ow-select">{PAYOUT_TYPE_OPTIONS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          {/* Sort */}
          <select value={sort} onChange={e => setSort(e.target.value)} className="ow-select">{SORT_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>

          {/* View Toggle */}
          <div className="ml-auto flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={() => setViewMode('grid')} className={`p-2 ${viewMode === 'grid' ? 'bg-[#340075] text-white' : 'text-gray-500 hover:text-gray-700'}`}><LayoutGrid className="w-4 h-4" /></button>
            <button onClick={() => setViewMode('table')} className={`p-2 ${viewMode === 'table' ? 'bg-[#340075] text-white' : 'text-gray-500 hover:text-gray-700'}`}><List className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* === MAIN === */}
      <main className="flex-1 max-w-[1300px] mx-auto w-full px-4 md:px-8 py-6">
        {/* Announcements */}
        {announcements.length > 0 && <div className="mb-5">{announcements.map(a => <div key={a.id} className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-2.5 mb-2 text-[#340075] text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 flex-shrink-0" />{a.text}</div>)}</div>}

        {/* Qualification */}
        {!isQualified && qualSurvey && !search && viewMode === 'grid' && (
          <div onClick={() => setShowQual(true)} className="mb-6 bg-white rounded-2xl border-2 border-purple-200 hover:border-[#340075]/40 overflow-hidden cursor-pointer hover:shadow-lg transition-all group">
            <div className="flex flex-col sm:flex-row">
              {/* Image */}
              <div className="relative w-full sm:w-48 h-36 sm:h-auto flex-shrink-0 overflow-hidden">
                <img
                  src={qualSurvey.display_image_url || 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=400&h=300&fit=crop&q=80'}
                  alt="Survey"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20 sm:bg-gradient-to-t sm:from-transparent sm:to-transparent"></div>
              </div>
              {/* Content */}
              <div className="flex items-center gap-4 p-5 flex-1">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    {/* Blinking LIVE tag */}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white bg-red-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                      LIVE
                    </span>
                    <span className="text-[10px] font-bold tracking-wider uppercase text-red-600">Required</span>
                  </div>
                  <h3 className="font-bold text-gray-900 text-base group-hover:text-[#340075] transition-colors">{qualSurvey.display_title || 'Qualification Survey'}</h3>
                  <p className="text-gray-500 text-sm mt-0.5 truncate">{qualSurvey.display_description || 'Complete to unlock all offers and start earning'}</p>
                </div>
                <div className="bg-purple-50 px-3 py-2 rounded-xl flex-shrink-0 text-center">
                  <span className="text-[#340075] font-bold text-lg block">+{qualSurvey.points || 6}</span>
                  <span className="text-[#340075]/60 text-[10px] font-semibold uppercase">{currency}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Qualification - Table/Row mode */}
        {!isQualified && qualSurvey && !search && viewMode === 'table' && (
          <div className="mb-4">
            <div onClick={() => setShowQual(true)}
              className="bg-white rounded-xl border-2 border-purple-200 hover:border-[#340075]/40 px-5 py-4 cursor-pointer transition-all group grid grid-cols-1 md:grid-cols-[1fr_140px_140px_120px] items-center gap-3 md:gap-0 hover:shadow-md">
              {/* Offer info */}
              <div className="flex items-center gap-4">
                <img
                  src={qualSurvey.display_image_url || 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=100&h=100&fit=crop&q=80'}
                  alt="Survey"
                  className="w-12 h-12 rounded-xl object-cover flex-shrink-0 shadow-sm"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase text-white bg-red-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                      LIVE
                    </span>
                  </div>
                  <p className="font-semibold text-gray-900 text-sm group-hover:text-[#340075] transition-colors">{qualSurvey.display_title || 'Qualification Survey'}</p>
                  <p className="text-gray-400 text-xs mt-0.5 truncate">{qualSurvey.display_description || 'Complete to unlock all offers'}</p>
                </div>
              </div>
              {/* Category */}
              <div className="md:text-center">
                <span className="text-[10px] font-bold tracking-wider uppercase text-white bg-red-500 px-2.5 py-1 rounded-full">Required</span>
              </div>
              {/* Reward */}
              <div className="md:text-center">
                <span className="font-bold text-[#340075] text-sm">+{qualSurvey.points || 6} {currency}</span>
              </div>
              {/* Action */}
              <div className="md:text-right">
                <button className="text-xs font-semibold text-white bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg transition-all hover:shadow-md">
                  Start Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-gray-500 text-sm"><span className="text-gray-900 font-semibold">{filtered.length}</span> offers {category !== 'all' && `in ${getCatName(category)}`}</p>
        </div>

        {/* Empty */}
        {filtered.length === 0 && isQualified && (
          <div className="text-center py-16"><p className="text-gray-400 text-lg mb-3">No offers match your filters</p><button onClick={() => { setSearch(''); setCategory('all'); setDevice('all'); setPayoutType('all'); }} className="ow-btn">Reset Filters</button></div>
        )}
        {filtered.length === 0 && !isQualified && <div className="text-center py-10 text-gray-500">Complete the qualification survey to unlock offers</div>}

        {/* === TABLE VIEW (card-row style with gaps) === */}
        {filtered.length > 0 && viewMode === 'table' && (
          <div>
            {/* Header row */}
            <div className="hidden md:grid grid-cols-[1fr_140px_140px_120px] items-center px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 mb-3">
              <span>Offer</span>
              <span className="text-center">Category</span>
              <span className="text-center">Reward</span>
              <span className="text-right">Action</span>
            </div>
            {/* Offer rows with gaps */}
            <div className="flex flex-col gap-3">
              {filtered.map(offer => {
                const pts = Math.round(offer.reward_amount || 0);
                return (
                  <div key={offer.id} onClick={() => handleClick(offer)}
                    className="bg-white rounded-xl border border-gray-100 hover:border-purple-200 hover:shadow-md px-5 py-4 cursor-pointer transition-all group grid grid-cols-1 md:grid-cols-[1fr_140px_140px_120px] items-center gap-3 md:gap-0">
                    {/* Offer info */}
                    <div className="flex items-center gap-4">
                      <img
                        src={getOfferImage({ image_url: offer.image_url, vertical: offer.category })}
                        alt={offer.title}
                        className="w-12 h-12 rounded-xl object-cover bg-gray-100 flex-shrink-0 shadow-sm"
                        onError={(e) => { (e.target as HTMLImageElement).src = `/category-images/${(offer.category||'other').toLowerCase().replace(' ','_')}.png`; (e.target as HTMLImageElement).onerror = () => { (e.target as HTMLImageElement).src = '/category-images/other.png'; (e.target as HTMLImageElement).onerror = null; }; }}
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate group-hover:text-[#340075] transition-colors">{truncTitle(offer.title, 8)}</p>
                        <p className="text-gray-400 text-xs truncate mt-0.5">{offer.description?.substring(0, 70)}</p>
                      </div>
                    </div>
                    {/* Category */}
                    <div className="md:text-center">
                      <span className="text-[10px] font-bold tracking-wider uppercase text-white bg-[#340075] px-2.5 py-1 rounded-full">{getCatName(offer.category)}</span>
                    </div>
                    {/* Reward */}
                    <div className="md:text-center">
                      <span className="font-bold text-[#340075] text-sm">+{pts.toLocaleString()} {currency}</span>
                    </div>
                    {/* Action */}
                    <div className="md:text-right">
                      <button className="text-xs font-semibold text-white bg-[#340075] hover:bg-[#4c1d95] px-4 py-2 rounded-lg transition-all hover:shadow-md">
                        Start Offer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* === GRID VIEW === */}
        {filtered.length > 0 && viewMode === 'grid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Sub-walls */}
            {!search && subWalls.map(w => (
              <div key={`sw-${w._id}`} onClick={() => window.open(`https://walls.moustacheleads.com/wall/${w.slug}`, '_blank')}
                className="ow-card group cursor-pointer">
                <div className="relative h-44 overflow-hidden rounded-t-2xl">
                  {w.image_url ? <img src={w.image_url} alt={w.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <div className="w-full h-full bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center"><Award className="h-10 w-10 text-purple-300" /></div>}
                  <div className="absolute top-3 right-3 bg-white/95 px-2.5 py-1 rounded-full shadow-sm text-xs font-bold text-[#340075]">{w.offer_count} offers</div>
                </div>
                <div className="p-4"><p className="text-[10px] font-bold tracking-wider uppercase text-teal-700 mb-1">Collection</p><h3 className="font-bold text-gray-900 text-sm mb-1">{w.heading_text || w.name}</h3><p className="text-gray-500 text-xs line-clamp-2 mb-3">{w.description}</p><button className="ow-btn w-full">View Collection</button></div>
              </div>
            ))}

            {/* Offers */}
            {filtered.map(offer => {
              const pts = Math.round(offer.reward_amount || 0);
              return (
                <div key={offer.id} onClick={() => handleClick(offer)} className="ow-card group cursor-pointer">
                  {/* Image - ALWAYS visible */}
                  <div className="relative h-44 overflow-hidden rounded-t-2xl bg-gradient-to-br from-gray-100 to-gray-50">
                    <img
                      src={getOfferImage({ image_url: offer.image_url, vertical: offer.category })}
                      alt={offer.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        // Fallback: show category gradient instead of hiding
                        const target = e.target as HTMLImageElement;
                        target.src = `/category-images/${(offer.category || 'other').toLowerCase().replace(' ', '_')}.png`;
                        target.onerror = () => { target.src = '/category-images/other.png'; target.onerror = null; };
                      }}
                    />
                    {/* Points badge */}
                    <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full shadow-sm">
                      <span className="text-[#340075] font-bold text-xs">+{pts.toLocaleString()} {currency}</span>
                    </div>
                    {/* Timer */}
                    {offer.timer_enabled && offer.timer_end_date && <div className="absolute top-3 left-3"><CountdownTimer endDate={offer.timer_end_date} /></div>}
                    {/* Gradient overlay at bottom */}
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/20 to-transparent"></div>
                  </div>

                  {/* Body */}
                  <div className="p-4 flex flex-col flex-grow">
                    <p className="text-[10px] font-bold tracking-wider uppercase text-teal-700 mb-1">{getCatName(offer.category)}</p>
                    <h3 className="font-bold text-gray-900 text-sm leading-snug mb-1.5 line-clamp-2 group-hover:text-[#340075] transition-colors">{truncTitle(offer.title)}</h3>
                    <p className="text-gray-500 text-xs line-clamp-2 mb-4">{offer.description?.substring(0, 85)}{(offer.description?.length||0) > 85 ? '…' : ''}</p>
                    <button className="ow-btn w-full mt-auto">
                      Start Offer <ChevronRight className="w-4 h-4 opacity-60" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* === FOOTER === */}
      <footer className="border-t border-gray-100 py-6 mt-auto bg-white">
        <div className="max-w-[1300px] mx-auto px-4 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2"><img src="/logo.png" alt="" className="h-6 w-auto" onError={e=>{(e.target as HTMLImageElement).style.display='none'}} /><span className="font-bold text-[#340075] text-sm">Moustache Leads</span></div>
          <p className="text-gray-400 text-xs">© 2024 Moustache Leads. All rights reserved.</p>
          <div className="flex gap-4 text-xs text-gray-400"><a href="#" className="hover:text-[#340075]">Privacy</a><a href="#" className="hover:text-[#340075]">Terms</a><a href="#" className="hover:text-[#340075]">Contact</a></div>
        </div>
      </footer>

      {/* === OVERLAYS === */}
      {funnel && <div className="fixed inset-0 z-[100] bg-white flex flex-col">{funnelResult ? <div className="flex-1 flex items-center justify-center"><div className="text-center max-w-sm p-6">{funnelResult.type==='pass'?<><div className="text-5xl mb-4">🎉</div><h2 className="text-xl font-bold mb-2">Congratulations!</h2><p className="text-gray-500 mb-4">{funnelResult.message}</p><button onClick={closeFunnel} className="ow-btn px-8 py-3">Done</button></>:<><div className="text-5xl mb-4">{funnelResult.has_next?'🔄':'😔'}</div><h2 className="text-xl font-bold mb-2">{funnelResult.has_next?'Not quite…':'Sorry!'}</h2><p className="text-gray-500 mb-4">{funnelResult.message}</p>{!funnelResult.has_next&&<button onClick={closeFunnel} className="ow-btn px-8 py-3">Back</button>}</>}</div></div> : funnelSurvey ? <div className="flex-1 relative"><button onClick={closeFunnel} className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500">✕</button><SurveyTemplateRenderer template={funnelTpl} title={funnelSurvey.title||'Survey'} description={`Step ${funnelStep+1}`} questions={(funnelSurvey.questions||[]).map((q:any)=>({text:q.text,options:q.options||[]}))} answers={funnelAns} onAnswer={(i,a)=>setFunnelAns(p=>({...p,[i]:a}))} onSubmit={submitFunnel} submitting={funnelSubmitting} brandColor="#340075" /></div> : <div className="flex-1 flex items-center justify-center"><p className="text-gray-400">Loading…</p></div>}</div>}

      {showQual && qualSurvey && <div className="fixed inset-0 z-[9999]"><button onClick={()=>setShowQual(false)} className="fixed top-4 right-4 z-[10000] w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center"><X className="w-5 h-5 text-gray-600" /></button><QualSurveyTpl survey={qualSurvey} onSubmit={handleQualSubmit} onAnswer={(qid,a)=>setQualAnswers(p=>({...p,[qid]:a}))} answers={qualAnswers} /></div>}

      {selOffer && <OfferModal offer={{...selOffer, status: selOffer.status||'active'}} open={modalOpen} onClose={()=>setModalOpen(false)} currencyName={currency} onStartOffer={async o => { try { await fetch(`${baseUrl}/api/offerwall/track/click`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({placement_id:placementId,user_id:userId,offer_id:o.id,offer_name:o.title,user_agent:navigator.userAgent})}); window.open(o.click_url,'_blank'); } catch { window.open(o.click_url,'_blank'); } }} />}

      {/* === STYLES === */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        .ow { background: #fafafa; font-family: 'DM Sans', system-ui, sans-serif; color: #1a1a2e; }
        .ow-hero { background: linear-gradient(135deg, #1a0040 0%, #340075 40%, #5b21b6 100%); position: relative; min-height: 300px; }
        .ow-hero-overlay { display: none; }
        .ow-block { position: absolute; border: 2px solid rgba(255,255,255,0.3); border-radius: 8px; animation: floatBlock 6s ease-in-out infinite; }
        .ow-block-1 { width: 40px; height: 40px; top: 20%; left: 10%; animation-delay: 0s; background: rgba(255,255,255,0.08); }
        .ow-block-2 { width: 25px; height: 25px; top: 40%; right: 15%; animation-delay: 1s; background: rgba(255,255,255,0.06); border-radius: 50%; }
        .ow-block-3 { width: 50px; height: 50px; bottom: 30%; left: 30%; animation-delay: 2s; background: rgba(255,255,255,0.05); }
        .ow-block-4 { width: 30px; height: 30px; top: 25%; right: 30%; animation-delay: 3s; background: rgba(255,255,255,0.07); border-radius: 4px; }
        .ow-block-5 { width: 20px; height: 20px; bottom: 40%; right: 10%; animation-delay: 4s; background: rgba(255,255,255,0.1); border-radius: 50%; }
        @keyframes floatBlock { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-15px) rotate(10deg); } }
        .ow-cat-btn { padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; white-space: nowrap; cursor: pointer; transition: all 0.15s ease; border: 1.5px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.12); backdrop-filter: blur(4px); color: white; flex-shrink: 0; }
        .ow-cat-btn:hover { background: rgba(255,255,255,0.22); border-color: rgba(255,255,255,0.5); transform: translateY(-1px); }
        .ow-cat-btn:active { transform: translateY(2px) scale(0.95); box-shadow: inset 0 2px 6px rgba(0,0,0,0.3); }
        .ow-cat-btn-active { background: white; color: #340075; border-color: white; box-shadow: 0 4px 12px rgba(0,0,0,0.2); font-weight: 700; }
        .ow-cat-btn-active:hover { background: white; color: #340075; }
        .ow-cat-btn-active:active { transform: translateY(1px) scale(0.97); box-shadow: inset 0 2px 4px rgba(52,0,117,0.2), 0 1px 3px rgba(0,0,0,0.1); }
        .ow-card { background: white; border-radius: 16px; border: 1px solid #f0f0f0; overflow: hidden; display: flex; flex-direction: column; transition: all 0.25s ease; }
        .ow-card:hover { box-shadow: 0 12px 40px -12px rgba(52,0,117,0.12); transform: translateY(-3px); border-color: #e0d4f5; }
        .ow-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; background: #340075; color: white; font-weight: 600; font-size: 13px; padding: 10px 16px; border-radius: 10px; border: none; cursor: pointer; transition: all 0.15s; }
        .ow-btn:hover { background: #4c1d95; box-shadow: 0 4px 12px rgba(52,0,117,0.2); }
        .ow-btn:active { transform: scale(0.97); }
        .ow-select { appearance: none; background: white url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236b7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat right 10px center; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 28px 8px 12px; font-size: 13px; font-weight: 500; color: #374151; cursor: pointer; transition: all 0.15s; }
        .ow-select:focus { outline: none; border-color: #340075; box-shadow: 0 0 0 3px rgba(52,0,117,0.08); }
        .ow-spinner { width: 36px; height: 36px; border: 3px solid #e5e7eb; border-top-color: #340075; border-radius: 50%; animation: spin 0.7s linear infinite; }
        .ow-badge-timer { display: inline-flex; align-items: center; gap: 3px; background: #dc2626; color: white; padding: 3px 7px; border-radius: 999px; font-size: 10px; font-weight: 700; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .animate-pulse { animation: blink 1.5s ease-in-out infinite; }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

function QualSurveyTpl({ survey, onSubmit, onAnswer, answers }: { survey: any; onSubmit: () => void; onAnswer: (qid: string, a: string) => void; answers: Record<string, any>; }) {
  const qs = (survey.questions||[]).filter((q:any) => q.type==='mcq'||q.type==='yes_no'||q.type==='mcq_multi');
  const tqs = qs.map((q:any) => ({ text: q.text, options: q.type==='yes_no'?['Yes','No']:(q.options||[]) }));
  const ta: Record<number,string> = {}; qs.forEach((q:any,i:number) => { if (answers[q.id]) ta[i] = answers[q.id]; });
  return <SurveyTemplateRenderer template={(survey.template||'moustache-default') as TemplateName} title={survey.name||'Qualification Survey'} description="Complete to unlock all offers" questions={tqs} answers={ta} onAnswer={(i,a)=>{const qid=qs[i]?.id;if(qid)onAnswer(qid,a);}} onSubmit={onSubmit} submitting={false} questionsPerPage={survey.questions_per_page||3} />;
}
