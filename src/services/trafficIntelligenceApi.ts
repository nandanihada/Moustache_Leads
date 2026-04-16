/**
 * Traffic Intelligence API Service (Phase 4)
 * Funnel events, campaigns, fraud, and affiliate comparison
 */

import { getApiBaseUrl } from './apiConfig';

const BASE = getApiBaseUrl();

function authHeaders() {
  return { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' };
}

// ============================================================================
// FUNNEL
// ============================================================================

export interface FunnelSummary {
  clicks: number;
  install: number;
  signup: number;
  ftd: number;
  purchase: number;
  install_rate: number;
  signup_rate: number;
  ftd_rate: number;
  purchase_rate: number;
  install_revenue: number;
  signup_revenue: number;
  ftd_revenue: number;
  purchase_revenue: number;
}

export interface FunnelEvent {
  event_id: string;
  click_id: string;
  offer_id: string;
  user_id: string;
  campaign_id: string;
  event_type: string;
  event_type_raw: string;
  revenue: number;
  source: string;
  timestamp: string;
}

export const funnelApi = {
  async getSummary(filters?: { offer_id?: string; user_id?: string; campaign_id?: string; start_date?: string; end_date?: string }) {
    const params = new URLSearchParams();
    if (filters) Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });
    const res = await fetch(`${BASE}/api/admin/funnel/summary?${params}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch funnel summary');
    return res.json() as Promise<{ success: boolean; data: FunnelSummary }>;
  },

  async getEvents(filters?: { click_id?: string; offer_id?: string; user_id?: string; event_type?: string; campaign_id?: string; limit?: number }) {
    const params = new URLSearchParams();
    if (filters) Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, String(v)); });
    const res = await fetch(`${BASE}/api/admin/funnel/events?${params}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch funnel events');
    return res.json() as Promise<{ success: boolean; data: FunnelEvent[]; total: number }>;
  },
};

// ============================================================================
// CAMPAIGNS
// ============================================================================

export interface Campaign {
  _id: string;
  campaign_id: string;
  name: string;
  description: string;
  offer_ids: string[];
  status: string;
  budget: number;
  total_clicks: number;
  total_conversions: number;
  created_at: string;
}

export const campaignsApi = {
  async list(params?: { page?: number; per_page?: number; search?: string; status?: string }) {
    const sp = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v) sp.append(k, String(v)); });
    const res = await fetch(`${BASE}/api/admin/campaigns?${sp}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch campaigns');
    return res.json();
  },

  async create(data: { name: string; description?: string; offer_ids?: string[]; budget?: number; status?: string }) {
    const res = await fetch(`${BASE}/api/admin/campaigns`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) });
    if (!res.ok) throw new Error('Failed to create campaign');
    return res.json();
  },

  async get(campaignId: string) {
    const res = await fetch(`${BASE}/api/admin/campaigns/${campaignId}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch campaign');
    return res.json();
  },

  async update(campaignId: string, data: Partial<Campaign>) {
    const res = await fetch(`${BASE}/api/admin/campaigns/${campaignId}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(data) });
    if (!res.ok) throw new Error('Failed to update campaign');
    return res.json();
  },

  async remove(campaignId: string) {
    const res = await fetch(`${BASE}/api/admin/campaigns/${campaignId}`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to delete campaign');
    return res.json();
  },

  async analytics(campaignId: string, params?: { start_date?: string; end_date?: string }) {
    const sp = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v) sp.append(k, v); });
    const res = await fetch(`${BASE}/api/admin/campaigns/${campaignId}/analytics?${sp}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch campaign analytics');
    return res.json();
  },
};

// ============================================================================
// FRAUD / IP BLOCKING
// ============================================================================

export const fraudApi = {
  async getBlockedIps(page = 1, perPage = 50) {
    const res = await fetch(`${BASE}/api/admin/fraud/blocked-ips?page=${page}&per_page=${perPage}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch blocked IPs');
    return res.json();
  },

  async blockIp(ip: string, reason = 'manual_admin') {
    const res = await fetch(`${BASE}/api/admin/fraud/block-ip`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ ip_address: ip, reason }) });
    if (!res.ok) throw new Error('Failed to block IP');
    return res.json();
  },

  async unblockIp(ip: string) {
    const res = await fetch(`${BASE}/api/admin/fraud/unblock-ip`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ ip_address: ip }) });
    if (!res.ok) throw new Error('Failed to unblock IP');
    return res.json();
  },

  async getUserSegment(userId: string) {
    const res = await fetch(`${BASE}/api/admin/fraud/user-segment/${userId}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch user segment');
    return res.json();
  },

  async refreshUserSegment(userId: string) {
    const res = await fetch(`${BASE}/api/admin/fraud/user-segment/${userId}/refresh`, { method: 'POST', headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to refresh user segment');
    return res.json();
  },
};


// ============================================================================
// AFFILIATE COMPARISON
// ============================================================================

export interface AffiliateRow {
  user_id: string;
  name: string;
  email: string;
  segment: string;
  clicks: number;
  conversions: number;
  genuine_clicks: number;
  suspicious_clicks: number;
  fraud_clicks: number;
  cr: number;
  fraud_pct: number;
  avg_fraud_score: number;
  total_revenue: number;
}

export const affiliateApi = {
  async getComparison(params?: { start_date?: string; end_date?: string; sort_by?: string; limit?: number }) {
    const sp = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v) sp.append(k, String(v)); });
    const res = await fetch(`${BASE}/api/admin/intelligence/affiliate-comparison?${sp}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch affiliate comparison');
    return res.json() as Promise<{ success: boolean; data: AffiliateRow[] }>;
  },
};

// ============================================================================
// GEO ANALYTICS
// ============================================================================

export interface GeoRow {
  country: string;
  clicks: number;
  conversions: number;
  cr: number;
  revenue: number;
  fraud_clicks: number;
}

export const geoApi = {
  async getAnalytics(params?: { start_date?: string; end_date?: string; limit?: number }) {
    const sp = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v) sp.append(k, String(v)); });
    const res = await fetch(`${BASE}/api/admin/intelligence/geo-analytics?${sp}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch geo analytics');
    return res.json() as Promise<{ success: boolean; data: GeoRow[] }>;
  },
};


// ============================================================================
// PHASE 5: ADMIN ACTIONS
// ============================================================================

export const actionsApi = {
  async blockUser(userId: string, reason = 'Blocked from click tracking') {
    const res = await fetch(`${BASE}/api/admin/actions/block-user`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ user_id: userId, reason }) });
    if (!res.ok) throw new Error('Failed to block user');
    return res.json();
  },

  async pauseOffer(offerId: string) {
    const res = await fetch(`${BASE}/api/admin/actions/pause-offer`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ offer_id: offerId }) });
    if (!res.ok) throw new Error('Failed to pause offer');
    return res.json();
  },

  async changePayout(offerId: string, payout: number, userId?: string) {
    const body: any = { offer_id: offerId, payout };
    if (userId) body.user_id = userId;
    const res = await fetch(`${BASE}/api/admin/actions/change-payout`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
    if (!res.ok) throw new Error('Failed to change payout');
    return res.json();
  },

  async sendWarning(userId: string, message?: string, subject?: string) {
    const body: any = { user_id: userId };
    if (message) body.message = message;
    if (subject) body.subject = subject;
    const res = await fetch(`${BASE}/api/admin/actions/send-warning`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
    if (!res.ok) throw new Error('Failed to send warning');
    return res.json();
  },

  async requestProof(userId: string, offerId?: string) {
    const body: any = { user_id: userId };
    if (offerId) body.offer_id = offerId;
    const res = await fetch(`${BASE}/api/admin/actions/request-proof`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
    if (!res.ok) throw new Error('Failed to request proof');
    return res.json();
  },
};
