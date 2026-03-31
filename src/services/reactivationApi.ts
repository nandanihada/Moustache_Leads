/**
 * Reactivation API Service
 * Handles all API calls for the inactive user reactivation engine.
 */

import { getApiBaseUrl } from './apiConfig';
import { getAuthToken } from '@/utils/cookies';

const BASE = () => `${getApiBaseUrl()}/api/admin/reactivation`;

const headers = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getAuthToken()}`,
});

// ── Types ──────────────────────────────────────────────────────────────

export interface InactiveUser {
  _id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  email_verified: boolean;
  account_status: string;
  created_at: string;
  days_inactive: number;
  last_login: string | null;
  login_count: number;
  country: string;
  country_code: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  last_device: any;
  total_clicks: number;
  last_click: string | null;
  total_conversions: number;
  total_earnings: number;
  total_searches: number;
  last_search: string | null;
  search_keywords: string[];
  has_approved_placement: boolean;
  approved_placements: number;
  outreach_count: number;
  last_outreach: string | null;
  reactivation_score: number;
  risk_level: 'safe' | 'medium' | 'suspicious';
  activity_level: 'viewed_offers' | 'clicked_no_conv' | 'converted_before' | 'never_clicked';
  intent_tags: string[];
}

export interface ReactivationStats {
  total_inactive: number;
  total_users: number;
  buckets: Record<string, number>;
  country_stats: { country: string; code: string; count: number; avg_days: number }[];
  map_points: { user_id: string; username: string; lat: number; lng: number; country: string; country_code: string; days_inactive: number }[];
  outreach_this_week: number;
}

export interface UserProfile {
  last_searched: { keyword: string; date: string } | null;
  last_picked: { offer_name: string; date: string } | null;
  highest_converting: { offer_name: string; conversions: number; earnings: number } | null;
  most_clicked: { offer_name: string; clicks: number } | null;
  intent_tags: string[];
  search_keywords: string[];
  device_history: any[];
  ip_stats: { unique_ips: number };
  offer_memory: { offer_id: string; offer_name: string; send_count: number; last_sent: string }[];
  outreach_history: { offer_name: string; channel: string; subject: string; message: string; status: string; send_time: string; created_at: string; sent_at: string | null }[];
  support_history: { _id: string; subject: string; body: string; status: string; issue_type: string; priority: string; assigned_to: string; created_at: string }[];
  click_stats: any[];
  conv_stats: any[];
}

export interface OfferOption {
  _id: string;
  name: string;
  category: string;
  payout: number;
  countries: string[];
}

export interface Filters {
  search?: string;
  inactivity_period?: string;
  activity_level?: string;
  risk_level?: string;
  country?: string;
  email_verified?: string;
  has_earnings?: string;
  has_placement?: string;
  account_status?: string;
  sort_by?: string;
  page?: number;
  per_page?: number;
}


// ── API Calls ──────────────────────────────────────────────────────────

export async function fetchInactiveUsers(filters: Filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) params.set(k, String(v));
  });
  const res = await fetch(`${BASE()}/users?${params}`, { headers: headers() });
  return res.json();
}

export async function fetchReactivationStats() {
  const res = await fetch(`${BASE()}/stats`, { headers: headers() });
  return res.json();
}

export async function fetchUserProfile(userId: string) {
  const res = await fetch(`${BASE()}/users/${userId}/profile`, { headers: headers() });
  return res.json();
}

export async function sendOutreach(data: {
  user_ids: string[];
  offer_id?: string;
  offer_name?: string;
  channel: string;
  message: string;
  subject?: string;
  send_time: string;
  scheduled_at?: string;
}) {
  const res = await fetch(`${BASE()}/outreach`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function createSupportTicket(data: {
  user_ids: string[];
  issue_type: string;
  priority: string;
  note: string;
  assign_to: string;
}) {
  const res = await fetch(`${BASE()}/support`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function executeSandS(data: {
  user_ids: string[];
  outreach?: {
    offer_id?: string;
    offer_name?: string;
    channel: string;
    message: string;
    subject?: string;
    send_time: string;
    scheduled_at?: string;
  };
  support?: {
    issue_type: string;
    priority: string;
    note: string;
    assign_to: string;
  };
}) {
  const res = await fetch(`${BASE()}/sands`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function fetchOffersForPicker(search = '') {
  const params = search ? `?search=${encodeURIComponent(search)}` : '';
  const res = await fetch(`${BASE()}/offers${params}`, { headers: headers() });
  return res.json();
}

export async function fetchRecommendedOffers(userId: string, limit = 20) {
  const res = await fetch(`${BASE()}/users/${userId}/recommend?limit=${limit}`, { headers: headers() });
  return res.json();
}
