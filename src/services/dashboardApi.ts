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
};
