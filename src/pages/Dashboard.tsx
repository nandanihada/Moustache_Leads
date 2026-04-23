import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, Users, MousePointer, DollarSign, Target, Gift, ArrowUpRight, ArrowDownRight, Minus, X, Link } from "lucide-react";
import PlacementRequired from "@/components/PlacementRequired";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { dashboardApi, DashboardStats, ChartDataPoint, TopOffer } from "@/services/dashboardApi";
import { toast } from "sonner";
import { API_BASE_URL } from "@/services/apiConfig";
import { getAuthToken } from "@/utils/cookies";

const POPUP_DISMISSED_KEY = 'gift_promo_popup_dismissed';
const GC_POPUP_DISMISSED_KEY = 'gift_card_popup_dismissed';
const PROMO_POPUP_DISMISSED_KEY = 'promo_code_popup_dismissed';
const POPUP_DISMISS_HOURS = 24;

/* -------------------------
   Glassmorphism Popup
------------------------- */
const GlassPopup = ({ type, onClose, onRedirect, code, name, amount }: { 
  type: 'gift_card' | 'promo_code'; 
  onClose: () => void; 
  onRedirect: () => void;
  code?: string;
  name?: string;
  amount?: number;
}) => {
  const isGift = type === 'gift_card';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-3xl border border-white/20 p-8 text-center shadow-2xl"
        style={{
          background: 'rgba(255, 255, 255, 0.15)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors">
          <X className="h-5 w-5" />
        </button>
        <div className="text-6xl mb-4">{isGift ? '🎁' : '🎉'}</div>
        <h2 className="text-2xl font-bold text-white mb-2">
          {isGift ? 'Hey! Grab Your Gift Card' : 'You Have a Promo Code!'}
        </h2>
        {name && (
          <p className="text-white/90 font-semibold text-lg mb-1">{name}</p>
        )}
        {amount && isGift && (
          <p className="text-white font-bold text-2xl mb-2">${amount.toFixed(2)}</p>
        )}
        {code && (
          <div className="mx-auto mb-4 px-5 py-2.5 rounded-xl inline-block" style={{ background: 'rgba(255,255,255,0.2)', border: '1px dashed rgba(255,255,255,0.5)' }}>
            <span className="text-white/70 text-xs uppercase tracking-wider block mb-0.5">Code</span>
            <span className="text-white font-mono font-bold text-xl tracking-widest">{code}</span>
          </div>
        )}
        <p className="text-white/80 mb-6 text-sm">
          {isGift
            ? 'A gift card is waiting for you. Redeem it now and add credits to your account!'
            : 'A promo code is available for you. Apply it to boost your earnings on offers!'}
        </p>
        <button
          onClick={onRedirect}
          className="px-8 py-3 rounded-2xl font-semibold text-white transition-all duration-300 hover:scale-105"
          style={{
            background: isGift
              ? 'linear-gradient(135deg, #ec4899, #8b5cf6)'
              : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            boxShadow: '0 8px 32px rgba(139, 92, 246, 0.3)',
          }}
        >
          {isGift ? 'Redeem Gift Card →' : 'View Promo Codes →'}
        </button>
      </div>
    </div>
  );
};

/* -------------------------
   Dashboard Component
------------------------- */
const DashboardContent = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [topOffers, setTopOffers] = useState<TopOffer[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [offersLoading, setOffersLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
    fetchChartData();
    fetchTopOffers();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await dashboardApi.getStats();
      if (response.success) {
        setStats(response.stats);
      } else {
        toast.error('Failed to load dashboard statistics');
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      toast.error('Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  const fetchChartData = async () => {
    try {
      setChartLoading(true);
      const response = await dashboardApi.getChartData();
      if (response.success) {
        setChartData(response.chart_data);
      }
    } catch (error) {
      console.error('Error fetching chart data:', error);
    } finally {
      setChartLoading(false);
    }
  };

  const fetchTopOffers = async () => {
    try {
      setOffersLoading(true);
      const response = await dashboardApi.getTopOffers();
      if (response.success) {
        setTopOffers(response.top_offers);
      }
    } catch (error) {
      console.error('Error fetching top offers:', error);
    } finally {
      setOffersLoading(false);
    }
  };

  // Custom KPI Card Component
  const StatCard = ({ title, value, change, changeType, icon: Icon, loading, onClick }: any) => {
    const getChangeIcon = () => {
      if (changeType === 'positive') return <ArrowUpRight className="h-4 w-4" />;
      if (changeType === 'negative') return <ArrowDownRight className="h-4 w-4" />;
      return <Minus className="h-4 w-4" />;
    };

    const getChangeColor = () => {
      if (changeType === 'positive') return 'text-emerald-600 bg-emerald-50';
      if (changeType === 'negative') return 'text-red-600 bg-red-50';
      return 'text-gray-600 bg-gray-50';
    };

    const cardClass = `group relative bg-white rounded-2xl p-6 border border-gray-100 hover:border-gray-200 transition-all duration-300 hover:shadow-lg hover:shadow-gray-100/50 ${onClick ? 'cursor-pointer hover:bg-gray-50' : ''}`;

    const CardContent = (
      <div className={cardClass}>
        <div className="flex items-start justify-between mb-4">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 group-hover:from-gray-100 group-hover:to-gray-50 transition-all duration-300">
            <Icon className="h-5 w-5 text-gray-700" />
          </div>
          {change && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${getChangeColor()}`}>
              {getChangeIcon()}
              <span>{change}</span>
            </div>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 tracking-tight">
            {loading ? (
              <span className="inline-block w-24 h-8 bg-gray-100 rounded animate-pulse"></span>
            ) : (
              value
            )}
          </p>
        </div>
      </div>
    );

    if (onClick) {
      return (
        <button onClick={onClick} className="w-full text-left transition-transform hover:scale-[1.02] active:scale-[0.98]">
          {CardContent}
        </button>
      );
    }

    return CardContent;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Welcome back! Here's what's happening with your campaigns.</p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard
            title="Total Revenue"
            value={`$${stats?.total_revenue?.toFixed(2) || '0.00'}`}
            change={stats?.revenue_change?.text || "+0%"}
            changeType={stats?.revenue_change?.type || "neutral"}
            icon={DollarSign}
            loading={loading}
          />
          <StatCard
            title="Total Clicks"
            value={stats?.total_clicks?.toLocaleString() || '0'}
            change={stats?.revenue_change?.text || "+0%"}
            changeType={stats?.revenue_change?.type || "neutral"}
            icon={MousePointer}
            loading={loading}
          />
          <StatCard
            title="Conversions"
            value={stats?.total_conversions?.toLocaleString() || '0'}
            change={stats?.conversions_change?.text || "+0%"}
            changeType={stats?.conversions_change?.type || "neutral"}
            icon={Target}
            loading={loading}
          />
          <StatCard
            title="API Access & Smart Link"
            value="Ready"
            change="Active"
            changeType="positive"
            icon={Link}
            loading={loading}
            onClick={() => navigate('/settings?tab=credentials')}
          />
      </div>

        {/* Charts Section */}
        <div className="grid gap-5 lg:grid-cols-7 mb-8">
          {/* Performance Chart - Takes 4 columns */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-gray-100 p-6 hover:border-gray-200 transition-all duration-300 hover:shadow-lg hover:shadow-gray-100/50">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Performance Overview</h3>
                <p className="text-sm text-gray-500 mt-0.5">Last 7 days activity</p>
              </div>
            </div>
            {chartLoading ? (
              <div className="flex items-center justify-center h-[300px]">
                <div className="text-center">
                  <div className="w-10 h-10 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-sm text-gray-500">Loading chart...</p>
                </div>
              </div>
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorConversions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    axisLine={{ stroke: '#e5e7eb' }}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                      padding: '12px'
                    }}
                    labelStyle={{ color: '#111827', fontWeight: 600, marginBottom: '4px' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="clicks" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    fill="url(#colorClicks)" 
                    name="Clicks"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="conversions" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    fill="url(#colorConversions)" 
                    name="Conversions"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px]">
                <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                  <TrendingUp className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-sm text-gray-600 text-center max-w-xs">No performance data yet. Start promoting offers to see your stats!</p>
              </div>
            )}
          </div>

          {/* Recent Activity - Takes 3 columns */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 p-6 hover:border-gray-200 transition-all duration-300 hover:shadow-lg hover:shadow-gray-100/50">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
              <p className="text-sm text-gray-500 mt-0.5">Latest conversions</p>
            </div>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {loading ? (
                <div className="text-center py-12">
                  <div className="w-10 h-10 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-sm text-gray-500">Loading...</p>
                </div>
              ) : stats?.recent_activity && stats.recent_activity.length > 0 ? (
                stats.recent_activity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors duration-200 group">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center flex-shrink-0 group-hover:from-emerald-100 group-hover:to-emerald-50 transition-all">
                      <DollarSign className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{activity.action}</p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{activity.offer}</p>
                      <p className="text-xs text-gray-400 mt-1">{activity.time}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-semibold text-sm text-emerald-600">{activity.amount}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                    <Users className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-600">No recent activity</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Top Performing Offers */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 hover:border-gray-200 transition-all duration-300 hover:shadow-lg hover:shadow-gray-100/50">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Top Performing Offers</h3>
            <p className="text-sm text-gray-500 mt-0.5">Your best converting campaigns</p>
          </div>
          {offersLoading ? (
            <div className="text-center py-12">
              <div className="w-10 h-10 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-sm text-gray-500">Loading top offers...</p>
            </div>
          ) : topOffers.length > 0 ? (
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Rank</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Offer Name</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Clicks</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Conversions</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Revenue</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Conv. Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {topOffers.map((offer, index) => (
                    <tr key={offer.id} className="group hover:bg-gray-50 transition-colors duration-150">
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 group-hover:from-gray-100 group-hover:to-gray-50 transition-all">
                          <span className="text-sm font-bold text-gray-700">{index + 1}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <p className="font-medium text-sm text-gray-900">{offer.name}</p>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="text-sm text-gray-700">{offer.clicks.toLocaleString()}</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="text-sm text-gray-700">{offer.conversions}</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="text-sm font-semibold text-emerald-600">{offer.revenue}</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold">
                          {offer.conversionRate}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                <Gift className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-sm text-gray-600 max-w-md mx-auto">No conversion data yet. Start promoting offers to see your top performers!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* -------------------------
   Popup Wrapper (outside PlacementRequired)
------------------------- */
const DashboardPopupWrapper = () => {
  const navigate = useNavigate();
  const [popupType, setPopupType] = useState<'gift_card' | 'promo_code' | null>(null);
  const [popupCode, setPopupCode] = useState<string>('');
  const [popupName, setPopupName] = useState<string>('');
  const [popupAmount, setPopupAmount] = useState<number>(0);

  useEffect(() => {
    // Retry logic: after a full-page redirect the cookie/localStorage may take a moment
    let cancelled = false;
    const tryCheck = async (attempt: number) => {
      if (cancelled) return;
      const tkn = getAuthToken();
      if (!tkn && attempt < 3) {
        setTimeout(() => tryCheck(attempt + 1), 800);
        return;
      }
      checkForPopups();
    };
    setTimeout(() => tryCheck(0), 600);
    return () => { cancelled = true; };
  }, []);

  const isRecentlyDismissed = (key: string) => {
    const dismissed = localStorage.getItem(key);
    if (!dismissed) return false;
    return Date.now() - parseInt(dismissed) < POPUP_DISMISS_HOURS * 60 * 60 * 1000;
  };

  const checkForPopups = async () => {
    try {
      // Use the proper cross-subdomain cookie reader
      const token = getAuthToken();
      if (!token) {
        console.log('🎁 No token found after retries, skipping popup check');
        return;
      }

      console.log('🎁 Checking for gift card popup...');

      // Check for available gift cards (only if not dismissed)
      if (!isRecentlyDismissed(GC_POPUP_DISMISSED_KEY)) {
        const gcRes = await fetch(`${API_BASE_URL}/api/publisher/gift-cards`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (gcRes.ok) {
          const gcData = await gcRes.json();
          const unredeemed = (gcData.gift_cards || []).filter((gc: any) => !gc.is_redeemed && gc.status === 'active');
          if (unredeemed.length > 0) {
            const firstCard = unredeemed[0];
            setPopupCode(firstCard.code || '');
            setPopupName(firstCard.name || '');
            setPopupAmount(firstCard.amount || 0);
            setPopupType('gift_card');
            return;
          }
        }
      }

      // Check for available promo codes (only if not dismissed)
      if (!isRecentlyDismissed(PROMO_POPUP_DISMISSED_KEY)) {
        const notifRes = await fetch(`${API_BASE_URL}/api/dashboard/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (notifRes.ok) {
          const notifData = await notifRes.json();
          const promoNotifs = (notifData.notifications || []).filter((n: any) => n.type === 'promo_code_received');
          if (promoNotifs.length > 0) {
            const msg = promoNotifs[0].message || '';
            const codeMatch = msg.match(/'([^']+)'/);
            setPopupCode(codeMatch ? codeMatch[1] : '');
            setPopupName(promoNotifs[0].title || '');
            setPopupType('promo_code');
          }
        }
      }
    } catch (err) {
      console.error('🎁 Popup check error:', err);
    }
  };

  const dismissPopup = () => {
    // Dismiss per-type so gift card and promo code popups are tracked independently
    if (popupType === 'gift_card') {
      localStorage.setItem(GC_POPUP_DISMISSED_KEY, String(Date.now()));
    } else if (popupType === 'promo_code') {
      localStorage.setItem(PROMO_POPUP_DISMISSED_KEY, String(Date.now()));
    }
    // Also set the legacy key for backward compat
    localStorage.setItem(POPUP_DISMISSED_KEY, String(Date.now()));
    setPopupType(null);
  };

  const handlePopupRedirect = () => {
    dismissPopup();
    if (popupType === 'gift_card') navigate('/dashboard/gift-cards');
    else navigate('/dashboard/promo-codes');
  };

  return (
    <>
      {popupType && (
        <GlassPopup 
          type={popupType} 
          onClose={dismissPopup} 
          onRedirect={handlePopupRedirect}
          code={popupCode}
          name={popupName}
          amount={popupAmount}
        />
      )}
    </>
  );
};

/* -------------------------
   Main Dashboard Component
------------------------- */
const Dashboard = () => {
  return (
    <>
      <DashboardPopupWrapper />
      <PlacementRequired>
        <DashboardContent />
      </PlacementRequired>
    </>
  );
};

export default Dashboard;
