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
  picked_offer: string | null;
  picked_offer_id: string | null;
  clicked_preview: boolean;
  clicked_request: boolean;
  clicked_tracking: boolean;
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
  sent_today?: string;
}

export interface RelatedOffer {
  _id: string;
  offer_id: string;
  name: string;
  image_url?: string;
  thumbnail_url?: string;
  target_url?: string;
  preview_url?: string;
  payout: number;
  status: string;
  category?: string;
  vertical?: string;
  countries?: string[];
  network?: string;
  description?: string;
  currency?: string;
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
    custom_emails?: string[];
  }) {
    const res = await fetch(`${API}/api/admin/search-logs/send-email`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to send email');
    return res.json();
  },

  async logSearch(keyword: string, resultsCount: number): Promise<string | null> {
    try {
      const res = await fetch(`${API}/api/admin/search-logs/log`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ keyword, results_count: resultsCount }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error('[SearchLog] Failed:', res.status, data);
        return null;
      }
      const data = await res.json();
      return data.search_log_id || null;
    } catch (err) {
      // Silently fail - search logging should never block the user
      return null;
    }
  },

  async trackSearchAction(action: string, searchLogId?: string | null, offerName?: string, offerId?: string) {
    try {
      await fetch(`${API}/api/admin/search-logs/track-action`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          action,
          search_log_id: searchLogId || undefined,
          offer_name: offerName || undefined,
          offer_id: offerId || undefined,
        }),
      });
    } catch {
      // Silently fail
    }
  },

  async getRelatedOffers(keyword: string): Promise<{ success: boolean; offers: RelatedOffer[]; total: number }> {
    const res = await fetch(`${API}/api/admin/search-logs/related-offers?keyword=${encodeURIComponent(keyword)}`, {
      headers: headers(),
    });
    if (!res.ok) throw new Error('Failed to fetch related offers');
    return res.json();
  },

  async sendInventoryEmail(data: {
    search_log_id?: string;
    user_id: string;
    keyword: string;
    offers: Array<{ offer_id: string; name: string; image_url?: string; target_url?: string; payout: number }>;
    subject?: string;
    message?: string;
  }): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API}/api/admin/search-logs/send-inventory-email`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to send inventory email');
    return res.json();
  },
};
