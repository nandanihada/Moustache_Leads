/**
 * User Reports API Service
 * Publisher-facing reports for performance and conversions
 */

import { API_BASE_URL as BASE_URL } from './apiConfig';
const API_BASE_URL = `${BASE_URL}/api`;

// ===== INTERFACES =====

export interface PerformanceReportFilters {
  start_date: string;
  end_date: string;
  offer_id?: string;
  country?: string;
  status?: string;
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

export interface PerformanceRow {
  date?: string;
  offer_id?: string;
  offer_name?: string;
  offer_url?: string;
  category?: string;
  currency?: string;
  ad_group?: string;
  goal?: string;
  promo_code?: string;
  creative?: string;
  app_version?: string;
  country?: string;
  browser?: string;
  device_type?: string;
  source?: string;
  advertiser_sub_id1?: string;
  advertiser_sub_id2?: string;
  advertiser_sub_id3?: string;
  advertiser_sub_id4?: string;
  advertiser_sub_id5?: string;
  clicks: number;
  gross_clicks: number;
  unique_clicks: number;
  suspicious_clicks: number;
  rejected_clicks: number;
  conversions: number;
  approved_conversions: number;
  total_payout: number;
  cr: number;
  epc: number;
  ctr: number;
  unique_click_rate: number;
  suspicious_click_rate: number;
  rejected_click_rate: number;
  cpa: number;
  cpc: number;
  cpm: number;
  avg_time_spent_seconds?: number;
}

export interface PerformanceSummary {
  total_clicks: number;
  total_conversions: number;
  total_payout: number;
  avg_cr: number;
  avg_epc: number;
}

export interface Conversion {
  _id: string;
  time: string;
  conversion_id?: string;
  transaction_id: string;
  offer_name: string;
  offer_url?: string;
  category?: string;
  currency: string;
  ad_group?: string;
  goal?: string;
  promo_code?: string;
  creative?: string;
  app_version?: string;
  status: 'approved' | 'pending' | 'rejected';
  payout: number;
  country: string;
  browser?: string;
  device_type?: string;
  source?: string;
  advertiser_sub_id1?: string;
  advertiser_sub_id2?: string;
  advertiser_sub_id3?: string;
  advertiser_sub_id4?: string;
  advertiser_sub_id5?: string;
  sub_id1?: string;
  sub_id2?: string;
  sub_id3?: string;
  sub_id4?: string;
  sub_id5?: string;
  click_id?: string;
  offer_id?: string;
  
  // Survey data
  survey_id?: string;
  session_id?: string;
  survey_responses?: Record<string, any>;
  responses_count?: string | number;
  completion_time?: string | number;
  
  // Partner data
  partner_id?: string;
  partner_name?: string;
  
  // Complete postback data
  raw_postback?: Record<string, any>;
  custom_data?: Record<string, any>;
  
  // Technical
  ip_address?: string;
  postback_ip?: string;
  user_agent?: string;
}

export interface ConversionSummary {
  approved_payout: number;
  pending_payout: number;
  total_conversions: number;
}

export interface ChartDataPoint {
  date: string;
  value: number;
}

// ===== API FUNCTIONS =====

export const userReportsApi = {
  /**
   * Get performance report
   */
  async getPerformanceReport(filters: PerformanceReportFilters) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });

    const response = await fetch(`${API_BASE_URL}/reports/performance?${params}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch performance report');
    }

    return response.json();
  },

  /**
   * Get conversion report
   */
  async getConversionReport(filters: PerformanceReportFilters) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });

    const response = await fetch(`${API_BASE_URL}/reports/conversions?${params}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch conversion report');
    }

    return response.json();
  },

  /**
   * Get chart data
   */
  async getChartData(filters: {
    start_date: string;
    end_date: string;
    metric?: string;
    granularity?: string;
    offer_id?: string;
  }) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });

    const response = await fetch(`${API_BASE_URL}/reports/chart-data?${params}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch chart data');
    }

    return response.json();
  },

  /**
   * Get summary stats
   */
  async getSummary() {
    const response = await fetch(`${API_BASE_URL}/reports/summary`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch summary');
    }

    return response.json();
  },

  /**
   * Export report as CSV
   */
  async exportReport(type: 'performance' | 'conversions', filters: PerformanceReportFilters) {
    const params = new URLSearchParams();
    params.append('type', type);
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });

    const response = await fetch(`${API_BASE_URL}/reports/export?${params}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to export report');
    }

    // Download the CSV file
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};
