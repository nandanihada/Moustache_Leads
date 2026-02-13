/**
 * Admin Overview API Service
 * Fetches real-time statistics for admin dashboard overview boxes
 */

import api from './api';

// Types for overview stats
export interface ErrorSummary {
  api_failures_24h: number;
  api_failures_7d: number;
  offer_import_failures_24h: number;
  offer_import_failures_7d: number;
  category_mismatches_24h: number;
  category_mismatches_7d: number;
  server_errors_24h: number;
  server_errors_7d: number;
  cors_issues_24h: number;
  cors_issues_7d: number;
  incoming_postback_failures_24h: number;
  incoming_postback_failures_7d: number;
  outgoing_postback_failures_24h: number;
  outgoing_postback_failures_7d: number;
  total_24h: number;
  total_7d: number;
}

export interface StatBox {
  total: number;
  last_24h: number;
}

export interface RevenueBox {
  total: number;
  last_24h: number;
}

export interface UniqueClicksBox {
  last_24h: number;
}

export interface OverviewStats {
  error_summary?: ErrorSummary;
  total_users: StatBox;
  active_users: StatBox;
  fraud_users?: StatBox;
  failed_signups: StatBox;
  total_offers: StatBox;
  requested_offers: StatBox;
  active_placements: StatBox;
  iframes_installed: StatBox;
  clicks: StatBox;
  unique_clicks: UniqueClicksBox;
  suspicious_clicks: UniqueClicksBox;
  conversions: StatBox;
  revenue?: RevenueBox;
  reversals?: StatBox;
  postback_failures?: StatBox;
}

export interface OverviewResponse {
  success: boolean;
  last_updated: string;
  user_role: string;
  stats: OverviewStats;
}

export interface SingleBoxResponse {
  success: boolean;
  box_name: string;
  last_updated: string;
  data: StatBox | ErrorSummary | RevenueBox | UniqueClicksBox;
}

/**
 * Admin Overview API
 */
export const adminOverviewApi = {
  /**
   * Get all overview statistics
   */
  async getOverviewStats(): Promise<OverviewResponse> {
    const response = await api.get('/admin/overview-stats');
    return response.data;
  },

  /**
   * Get stats for a single box (for testing)
   */
  async getSingleBoxStats(boxName: string): Promise<SingleBoxResponse> {
    const response = await api.get(`/admin/overview-stats/${boxName}`);
    return response.data;
  }
};

export default adminOverviewApi;
