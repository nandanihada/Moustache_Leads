import { getApiBaseUrl } from './apiConfig';
import { getAuthToken } from '@/utils/cookies';

const API = getApiBaseUrl();

const headers = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getAuthToken()}`,
});

export interface SearchLog {
  _id: string;
  user_id: string;
  username: string;
  keyword: string;
  results_count: number;
  no_result: boolean;
  inventory_status: 'available' | 'in_inventory_not_active' | 'not_in_inventory';
  total_inventory_count: number;
  active_inventory_count: number;
  searched_at: string;
}

export interface SearchLogsResponse {
  success: boolean;
  logs: SearchLog[];
  stats: {
    total_searches: number;
    no_result_count: number;
    not_in_inventory: number;
    in_inventory_not_active: number;
  };
  pagination: {
    page: number;
    per_page: number;
    total: number;
    pages: number;
  };
}

export interface SearchLogsFilters {
  page?: number;
  per_page?: number;
  keyword?: string;
  user?: string;
  no_result?: string;
  inventory_status?: string;
  date_from?: string;
  date_to?: string;
}

export const searchLogsApi = {
  async getLogs(filters: SearchLogsFilters = {}): Promise<SearchLogsResponse> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== '') params.append(k, String(v));
    });
    const url = `${API}/api/admin/search-logs?${params}`;
    const res = await fetch(url, { headers: headers() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch search logs');
    return data;
  },

  async sendEmail(data: {
    user_ids?: string[];
    subject: string;
    message: string;
    send_to_all?: boolean;
  }) {
    const res = await fetch(`${API}/api/admin/search-logs/send-email`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to send email');
    return res.json();
  },

  async logSearch(keyword: string, resultsCount: number) {
    try {
      const res = await fetch(`${API}/api/admin/search-logs/log`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ keyword, results_count: resultsCount }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error('[SearchLog] Failed:', res.status, data);
      }
    } catch (err) {
      // Silently fail - search logging should never block the user
    }
  },
};
