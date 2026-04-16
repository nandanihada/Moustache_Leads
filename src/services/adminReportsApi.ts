/**
 * Admin Reports API Service
 * Admin-facing performance and conversion reports across all publishers
 */

import { getApiBaseUrl } from './apiConfig';

const API_BASE_URL = `${getApiBaseUrl()}/api/admin/reports`;

export interface AdminPerformanceFilters {
  start_date: string;
  end_date: string;
  offer_id?: string;
  country?: string;
  region?: string;
  city?: string;
  category?: string;
  network?: string;
  status?: string;
  publisher_id?: string;
  device_type?: string;
  sub_id1?: string;
  sub_id2?: string;
  sub_id3?: string;
  sub_id4?: string;
  sub_id5?: string;
  group_by?: string;
  page?: number;
  per_page?: number;
  sort_field?: string;
  sort_order?: 'asc' | 'desc';
}

export interface AdminClick {
  _id: string;
  click_id: string;
  offer_id: string;
  offer_name?: string;
  user_id?: string;
  publisher_name?: string;
  publisher_email?: string;
  publisher_role?: string;
  timestamp?: string;
  time?: string;
  country?: string;
  country_code?: string;
  city?: string;
  region?: string;
  device_type?: string;
  browser?: string;
  os?: string;
  ip_address?: string;
  referer?: string;
  network?: string;
  category?: string;
  payout?: number;
  currency?: string;
  postback_url?: string;
  target_url?: string;
  converted?: boolean;
  sub_id1?: string;
  sub_id2?: string;
  sub_id3?: string;
  sub_id4?: string;
  sub_id5?: string;
  user_agent?: string;
  when_clicked?: string;
  time_spent?: string;
  when_closed?: string;
  time_spent_seconds?: number;
  // Phase 1.1/1.3: Enhanced tracking fields
  campaign_id?: string;
  fraud_score?: number;
  fraud_classification?: string;
  event_status?: string;
  postback_received?: boolean;
  postback_event_type?: string;
  postback_revenue?: number;
}

export interface AdminPerformanceRow {
  date?: string;
  offer_id?: string;
  offer_name?: string;
  offer_url?: string;
  category?: string;
  currency?: string;
  country?: string;
  country_code?: string;
  city?: string;
  region?: string;
  browser?: string;
  device_type?: string;
  os?: string;
  ip_address?: string;
  source?: string;
  click_id?: string;
  user_id?: string;
  publisher_id?: string;
  publisher_name?: string;
  publisher_email?: string;
  publisher_role?: string;
  network?: string;
  promo_code?: string;
  ad_group?: string;
  goal?: string;
  referer?: string;
  postback_url?: string;
  clicks: number;
  gross_clicks: number;
  unique_clicks: number;
  suspicious_clicks: number;
  rejected_clicks: number;
  conversions: number;
  approved_conversions: number;
  total_payout: number;
  total_revenue: number;
  profit: number;
  cr: number;
  epc: number;
  ctr: number;
}

export interface AdminConversion {
  _id: string;
  time: string;
  transaction_id: string;
  offer_name: string;
  offer_id?: string;
  status: string;
  payout: number;
  points: number;
  revenue: number;
  profit: number;
  currency: string;
  conversion_type: string;
  publisher_name: string;
  username: string;
  placement_title: string;
  click_id: string;
  conversion_id: string;
  country?: string;
  country_code?: string;
  region?: string;
  city?: string;
  postal_code?: string;
  latitude?: string;
  longitude?: string;
  timezone?: string;
  device_type?: string;
  browser?: string;
  os?: string;
  ip_address?: string;
  asn?: string;
  isp?: string;
  organization?: string;
  vpn_detected?: boolean;
  proxy_detected?: boolean;
  tor_detected?: boolean;
  fraud_status?: string;
  fraud_score?: number;
  postback_url?: string;
  referer?: string;
  click_time?: string;
  postback_received_time?: string;
  forward_status?: string;
  click_source?: string;
  user_email?: string;
  user_role?: string;
  network?: string;
  category?: string;
  sub_id1?: string;
  sub_id2?: string;
  sub_id3?: string;
  sub_id4?: string;
  sub_id5?: string;
}

export interface ChartDataPoint {
  date: string;
  value: number;
}

export interface FilterOptions {
  publishers: { id: string; name: string; username: string; email?: string; role?: string }[];
  offers: { id: string; name: string }[];
  countries: string[];
  regions: string[];
  cities: string[];
  categories: string[];
  networks: string[];
  device_types: string[];
  statuses: string[];
}

function authHeaders() {
  return { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
}

export const adminReportsApi = {
  async getPerformanceReport(filters: AdminPerformanceFilters) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
    const response = await fetch(`${API_BASE_URL}/performance?${params}`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Failed to fetch admin performance report');
    return response.json();
  },

  async getConversionReport(filters: AdminPerformanceFilters) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
    const response = await fetch(`${API_BASE_URL}/conversions?${params}`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Failed to fetch admin conversion report');
    return response.json();
  },

  async getChartData(params: {
    start_date: string; end_date: string;
    metric: string; granularity?: string;
    offer_id?: string;
  }) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    });
    const response = await fetch(`${API_BASE_URL}/chart?${searchParams}`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Failed to fetch chart data');
    return response.json();
  },

  async getFilterOptions(): Promise<{ success: boolean } & FilterOptions> {
    const response = await fetch(`${API_BASE_URL}/filters`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Failed to fetch filter options');
    return response.json();
  },

  async getClicksReport(filters: AdminPerformanceFilters) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
    const response = await fetch(`${API_BASE_URL}/clicks?${params}`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Failed to fetch clicks report');
    return response.json();
  },

  async exportReport(type: 'performance' | 'conversions', filters: AdminPerformanceFilters) {
    const params = new URLSearchParams();
    params.append('type', type);
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
    const response = await fetch(`${API_BASE_URL}/export?${params}`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Failed to export report');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin_${type}_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};
