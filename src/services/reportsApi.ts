/**
 * Reports API Service
 * Handles all reports-related API calls for admin dashboard
 */

import { getApiBaseUrl } from './apiConfig';

const API_BASE_URL = `${getApiBaseUrl()}/api/admin`;

export interface ReportSummaryMetrics {
  total_clicks: number;
  total_completions: number;
  conversion_rate: number;
  total_payout: number;
  avg_payout: number;
  total_revenue: number;
}

export interface TopOffer {
  _id: string;
  offer_name: string;
  clicks: number;
  conversions: number;
  conversion_rate: number;
  total_payout: number;
}

export interface TopAffiliate {
  _id: string;
  username: string;
  clicks: number;
  conversions: number;
  conversion_rate: number;
  total_earnings: number;
}

export interface DailyBreakdown {
  date: string;
  clicks: number;
  conversions: number;
  conversion_rate: number;
  revenue: number;
}

export interface CountryBreakdown {
  _id: string;
  clicks: number;
  conversions: number;
}

export interface TrackingReport {
  _id: string;
  report_id: string;
  type: string;
  date_range: {
    start: string;
    end: string;
  };
  summary_metrics: ReportSummaryMetrics;
  top_offers: TopOffer[];
  top_affiliates: TopAffiliate[];
  daily_breakdown: DailyBreakdown[];
  country_breakdown: CountryBreakdown[];
  generated_at: string;
}

export interface RealtimeStats {
  last_24h: {
    clicks: number;
    conversions: number;
    conversion_rate: number;
  };
  total: {
    clicks: number;
    conversions: number;
    conversion_rate: number;
    active_offers: number;
  };
}

export interface DashboardSummary {
  realtime_stats: RealtimeStats;
  event_stats: any;
  generated_at: string;
}

class ReportsApi {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    return response.json();
  }

  // Generate a new report
  async generateReport(params: {
    start_date: string;
    end_date: string;
    type?: string;
  }): Promise<{ success: boolean; message: string; report: TrackingReport }> {
    const response = await fetch(`${API_BASE_URL}/reports/generate`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(params),
    });

    return this.handleResponse(response);
  }

  // Get list of saved reports
  async getReports(limit: number = 50): Promise<{ success: boolean; reports: TrackingReport[]; count: number }> {
    const response = await fetch(`${API_BASE_URL}/reports?limit=${limit}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  // Get specific report by ID
  async getReport(reportId: string): Promise<{ success: boolean; report: TrackingReport }> {
    const response = await fetch(`${API_BASE_URL}/reports/${reportId}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  // Delete a report
  async deleteReport(reportId: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/reports/${reportId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  // Get real-time statistics
  async getRealtimeStats(): Promise<{ success: boolean; stats: RealtimeStats }> {
    const response = await fetch(`${API_BASE_URL}/reports/stats/realtime`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  // Generate quick reports
  async generateQuickReport(reportType: 'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'this_month' | 'last_month'): Promise<{ success: boolean; message: string; report: TrackingReport }> {
    const response = await fetch(`${API_BASE_URL}/reports/quick/${reportType}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  // Get dashboard summary
  async getDashboardSummary(): Promise<{ success: boolean; summary: DashboardSummary }> {
    const response = await fetch(`${API_BASE_URL}/reports/dashboard/summary`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  // Export report
  async exportReport(reportId: string): Promise<{ success: boolean; export_data: any; format: string }> {
    const response = await fetch(`${API_BASE_URL}/reports/export/${reportId}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }
}

export const reportsApi = new ReportsApi();
