import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { API_BASE_URL } from '../services/apiConfig';

interface AnalyticsData {
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cvr: number;
  epc: number;
  fraud_signals: number;
  payouts: {
    network_payout: number;
    user_reward: number;
    publisher_commission: number;
    platform_revenue: number;
  };
}

interface UserTracking {
  user_id: string;
  summary: {
    total_sessions: number;
    total_impressions: number;
    total_clicks: number;
    total_conversions: number;
    total_fraud_signals: number;
    total_points: number;
  };
}

interface PublisherTracking {
  publisher_id: string;
  summary: {
    total_placements: number;
    total_clicks: number;
    total_conversions: number;
    total_earnings: number;
    ctr: number;
    cvr: number;
  };
}

interface OfferTracking {
  offer_id: string;
  summary: {
    total_impressions: number;
    total_clicks: number;
    total_conversions: number;
    ctr: number;
    cvr: number;
    total_payout: number;
    avg_payout: number;
  };
}

export default function ComprehensiveOfferwallAnalytics() {
  const [activeTab, setActiveTab] = useState('overview');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [userTracking, setUserTracking] = useState<UserTracking | null>(null);
  const [publisherTracking, setPublisherTracking] = useState<PublisherTracking | null>(null);
  const [offerTracking, setOfferTracking] = useState<OfferTracking | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    userId: '',
    publisherId: '',
    offerId: '',
  });

  const token = localStorage.getItem('token');

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Fetch comprehensive analytics
  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.userId) params.append('user_id', filters.userId);
      if (filters.publisherId) params.append('publisher_id', filters.publisherId);
      if (filters.offerId) params.append('offer_id', filters.offerId);

      const response = await fetch(
        `${API_BASE_URL}/api/admin/offerwall/comprehensive-analytics?${params}`,
        { headers }
      );

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data.data);
      } else {
        setError('Failed to fetch analytics');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching analytics');
    } finally {
      setLoading(false);
    }
  };

  // Fetch user tracking
  const fetchUserTracking = async (userId: string) => {
    if (!userId) return;
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/offerwall/user-tracking/${userId}`,
        { headers }
      );

      if (response.ok) {
        const data = await response.json();
        setUserTracking(data.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching user tracking');
    } finally {
      setLoading(false);
    }
  };

  // Fetch publisher tracking
  const fetchPublisherTracking = async (publisherId: string) => {
    if (!publisherId) return;
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/offerwall/publisher-tracking/${publisherId}`,
        { headers }
      );

      if (response.ok) {
        const data = await response.json();
        setPublisherTracking(data.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching publisher tracking');
    } finally {
      setLoading(false);
    }
  };

  // Fetch offer tracking
  const fetchOfferTracking = async (offerId: string) => {
    if (!offerId) return;
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/offerwall/offer-tracking/${offerId}`,
        { headers }
      );

      if (response.ok) {
        const data = await response.json();
        setOfferTracking(data.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching offer tracking');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const StatCard = ({ icon: Icon, label, value, color }: any) => (
    <div className="bg-white rounded-lg shadow p-6 border-l-4" style={{ borderColor: color }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium">{label}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
        </div>
        <Icon className="w-12 h-12" style={{ color }} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Comprehensive Offerwall Analytics</h1>
          <p className="text-gray-600 mt-2">Track every detail: identifiers, device info, fraud, payouts, and revenue</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Filter className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold">Filters</h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="User ID"
              value={filters.userId}
              onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Publisher ID"
              value={filters.publisherId}
              onChange={(e) => setFilters({ ...filters, publisherId: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Offer ID"
              value={filters.offerId}
              onChange={(e) => setFilters({ ...filters, offerId: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-4 mt-4">
            <button
              onClick={fetchAnalytics}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Apply Filters
            </button>
            <button
              onClick={() => setFilters({ userId: '', publisherId: '', offerId: '' })}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
            >
              Clear
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8 text-red-700">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-gray-200">
          {['overview', 'user', 'publisher', 'offer'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-medium transition ${
                activeTab === tab
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && analytics && (
          <div className="space-y-8">
            {/* Key Metrics */}
            <div className="grid grid-cols-4 gap-6">
              <StatCard
                icon={BarChart3}
                label="Total Impressions"
                value={analytics.impressions}
                color="#3B82F6"
              />
              <StatCard
                icon={TrendingUp}
                label="Total Clicks"
                value={analytics.clicks}
                color="#10B981"
              />
              <StatCard
                icon={Users}
                label="Total Conversions"
                value={analytics.conversions}
                color="#F59E0B"
              />
              <StatCard
                icon={AlertTriangle}
                label="Fraud Signals"
                value={analytics.fraud_signals}
                color="#EF4444"
              />
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-gray-600 text-sm font-medium mb-4">Click-Through Rate</h3>
                <p className="text-4xl font-bold text-blue-600">{analytics.ctr.toFixed(2)}%</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-gray-600 text-sm font-medium mb-4">Conversion Rate</h3>
                <p className="text-4xl font-bold text-green-600">{analytics.cvr.toFixed(2)}%</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-gray-600 text-sm font-medium mb-4">Earnings Per Click</h3>
                <p className="text-4xl font-bold text-purple-600">${analytics.epc.toFixed(2)}</p>
              </div>
            </div>

            {/* Revenue Breakdown */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-green-600" />
                Revenue Breakdown
              </h2>
              <div className="grid grid-cols-4 gap-6">
                <div className="border-l-4 border-blue-500 pl-4">
                  <p className="text-gray-600 text-sm">Network Payout</p>
                  <p className="text-2xl font-bold text-blue-600">
                    ${analytics.payouts.network_payout.toFixed(2)}
                  </p>
                </div>
                <div className="border-l-4 border-green-500 pl-4">
                  <p className="text-gray-600 text-sm">User Reward</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${analytics.payouts.user_reward.toFixed(2)}
                  </p>
                </div>
                <div className="border-l-4 border-yellow-500 pl-4">
                  <p className="text-gray-600 text-sm">Publisher Commission</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    ${analytics.payouts.publisher_commission.toFixed(2)}
                  </p>
                </div>
                <div className="border-l-4 border-purple-500 pl-4">
                  <p className="text-gray-600 text-sm">Platform Revenue</p>
                  <p className="text-2xl font-bold text-purple-600">
                    ${analytics.payouts.platform_revenue.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* User Tab */}
        {activeTab === 'user' && (
          <div className="space-y-6">
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Enter User ID"
                value={filters.userId}
                onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => fetchUserTracking(filters.userId)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Search
              </button>
            </div>
            {userTracking && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-bold mb-6">User: {userTracking.user_id}</h3>
                <div className="grid grid-cols-3 gap-6">
                  <StatCard
                    icon={BarChart3}
                    label="Sessions"
                    value={userTracking.summary.total_sessions}
                    color="#3B82F6"
                  />
                  <StatCard
                    icon={TrendingUp}
                    label="Impressions"
                    value={userTracking.summary.total_impressions}
                    color="#10B981"
                  />
                  <StatCard
                    icon={Users}
                    label="Clicks"
                    value={userTracking.summary.total_clicks}
                    color="#F59E0B"
                  />
                  <StatCard
                    icon={TrendingUp}
                    label="Conversions"
                    value={userTracking.summary.total_conversions}
                    color="#8B5CF6"
                  />
                  <StatCard
                    icon={AlertTriangle}
                    label="Fraud Signals"
                    value={userTracking.summary.total_fraud_signals}
                    color="#EF4444"
                  />
                  <StatCard
                    icon={DollarSign}
                    label="Total Points"
                    value={userTracking.summary.total_points}
                    color="#06B6D4"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Publisher Tab */}
        {activeTab === 'publisher' && (
          <div className="space-y-6">
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Enter Publisher ID"
                value={filters.publisherId}
                onChange={(e) => setFilters({ ...filters, publisherId: e.target.value })}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => fetchPublisherTracking(filters.publisherId)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Search
              </button>
            </div>
            {publisherTracking && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-bold mb-6">Publisher: {publisherTracking.publisher_id}</h3>
                <div className="grid grid-cols-3 gap-6">
                  <StatCard
                    icon={BarChart3}
                    label="Placements"
                    value={publisherTracking.summary.total_placements}
                    color="#3B82F6"
                  />
                  <StatCard
                    icon={TrendingUp}
                    label="Clicks"
                    value={publisherTracking.summary.total_clicks}
                    color="#10B981"
                  />
                  <StatCard
                    icon={Users}
                    label="Conversions"
                    value={publisherTracking.summary.total_conversions}
                    color="#F59E0B"
                  />
                  <StatCard
                    icon={DollarSign}
                    label="Total Earnings"
                    value={`$${publisherTracking.summary.total_earnings.toFixed(2)}`}
                    color="#06B6D4"
                  />
                  <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
                    <p className="text-gray-600 text-sm font-medium">CTR</p>
                    <p className="text-3xl font-bold mt-2 text-purple-600">
                      {publisherTracking.summary.ctr.toFixed(2)}%
                    </p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6 border-l-4 border-pink-500">
                    <p className="text-gray-600 text-sm font-medium">CVR</p>
                    <p className="text-3xl font-bold mt-2 text-pink-600">
                      {publisherTracking.summary.cvr.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Offer Tab */}
        {activeTab === 'offer' && (
          <div className="space-y-6">
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Enter Offer ID"
                value={filters.offerId}
                onChange={(e) => setFilters({ ...filters, offerId: e.target.value })}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => fetchOfferTracking(filters.offerId)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Search
              </button>
            </div>
            {offerTracking && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-bold mb-6">Offer: {offerTracking.offer_id}</h3>
                <div className="grid grid-cols-3 gap-6">
                  <StatCard
                    icon={BarChart3}
                    label="Impressions"
                    value={offerTracking.summary.total_impressions}
                    color="#3B82F6"
                  />
                  <StatCard
                    icon={TrendingUp}
                    label="Clicks"
                    value={offerTracking.summary.total_clicks}
                    color="#10B981"
                  />
                  <StatCard
                    icon={Users}
                    label="Conversions"
                    value={offerTracking.summary.total_conversions}
                    color="#F59E0B"
                  />
                  <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
                    <p className="text-gray-600 text-sm font-medium">CTR</p>
                    <p className="text-3xl font-bold mt-2 text-purple-600">
                      {offerTracking.summary.ctr.toFixed(2)}%
                    </p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6 border-l-4 border-pink-500">
                    <p className="text-gray-600 text-sm font-medium">CVR</p>
                    <p className="text-3xl font-bold mt-2 text-pink-600">
                      {offerTracking.summary.cvr.toFixed(2)}%
                    </p>
                  </div>
                  <StatCard
                    icon={DollarSign}
                    label="Total Payout"
                    value={`$${offerTracking.summary.total_payout.toFixed(2)}`}
                    color="#06B6D4"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
