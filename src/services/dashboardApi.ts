/**
 * User Dashboard API Service
 * Fetches real statistics for user dashboard
 */

import { API_BASE_URL as BASE_URL } from './apiConfig';
const API_BASE_URL = `${BASE_URL}/api`;

export interface DashboardStats {
  total_revenue: number;
  total_clicks: number;
  total_conversions: number;
  active_offers: number;
  revenue_change: {
    percentage: number;
    type: 'positive' | 'negative' | 'neutral';
    text: string;
  };
  conversions_change: {
    percentage: number;
    type: 'positive' | 'negative' | 'neutral';
    text: string;
  };
  recent_activity: Array<{
    id: string;
    action: string;
    offer: string;
    amount: string;
    time: string;
  }>;
}

export interface ChartDataPoint {
  name: string;
  clicks: number;
  conversions: number;
  revenue: number;
}

export interface TopOffer {
  id: number;
  offer_id: string | null;
  name: string;
  clicks: number;
  conversions: number;
  revenue: string;
  conversionRate: string;
}

export const dashboardApi = {
  /**
   * Get dashboard statistics for current user
   */
  async getStats(): Promise<{ success: boolean; stats: DashboardStats }> {
    const response = await fetch(`${API_BASE_URL}/dashboard/stats`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch dashboard stats');
    }

    return response.json();
  },

  /**
   * Get chart data for performance overview (last 6 months)
   */
  async getChartData(): Promise<{ success: boolean; chart_data: ChartDataPoint[] }> {
    const response = await fetch(`${API_BASE_URL}/dashboard/chart-data`, {
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
   * Get top performing offers for current user
   */
  async getTopOffers(): Promise<{ success: boolean; top_offers: TopOffer[] }> {
    const response = await fetch(`${API_BASE_URL}/dashboard/top-offers`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch top offers');
    }

    return response.json();
  },
};
