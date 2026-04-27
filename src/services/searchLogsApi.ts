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

export interface SearchSession {
  _id: string;
  user_id: string;
  username: string;
  query: string;
  autocorrected_to?: string | null;
  result_count: number;
  inventory_status: string;
  session_outcome: 'active' | 'picked' | 'skipped_all' | 'abandoned' | 'placement_intent' | 'not_found';
  final_pick_offer_id?: string | null;
  final_pick_position?: number | null;
  wizard: {
    vertical: string;
    geo: string;
    payout: string;
    has_placement: boolean | null;
    placement_link: string;
    proof_file_ref: string;
    result_count: number;
    final_pick: string | null;
  };
  created_at: string;
  updated_at: string;
}

export interface SearchWizardSettings {
  vertical_enabled: boolean;
  geo_enabled: boolean;
  payout_enabled: boolean;
  placement_enabled: boolean;
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

  async getRelatedOffers(keyword: string, userId?: string): Promise<{ success: boolean; offers: RelatedOffer[]; total: number }> {
    const params = new URLSearchParams({ keyword });
    if (userId) params.set('user_id', userId);
    const res = await fetch(`${API}/api/admin/search-logs/related-offers?${params}`, {
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
    template_style?: string;
    visible_fields?: string[];
    default_image?: string;
    payout_type?: string;
  }): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API}/api/admin/search-logs/send-inventory-email`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to send inventory email');
    return res.json();
  },

  // ── Search Sessions (Wizard Activity) ──

  async getSearchSessions(filters: {
    page?: number; per_page?: number; keyword?: string; username?: string;
    outcome?: string; vertical?: string; geo?: string;
  } = {}): Promise<{
    success: boolean;
    sessions: SearchSession[];
    stats: { total: number; picked: number; not_found: number; placement_intent: number; abandoned: number };
    pagination: { page: number; per_page: number; total: number; pages: number };
  }> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== '') params.append(k, String(v));
    });
    const res = await fetch(`${API}/api/admin/search-sessions?${params}`, { headers: headers() });
    if (!res.ok) throw new Error('Failed to fetch search sessions');
    return res.json();
  },

  async getPlacementIntents(page = 1, perPage = 25): Promise<{ success: boolean; intents: any[]; total: number }> {
    const res = await fetch(`${API}/api/admin/search-sessions/placement-intents?page=${page}&per_page=${perPage}`, { headers: headers() });
    if (!res.ok) throw new Error('Failed to fetch placement intents');
    return res.json();
  },

  async getMissingSignals(): Promise<{ success: boolean; signals: any[]; total: number }> {
    const res = await fetch(`${API}/api/admin/search-sessions/missing-signals`, { headers: headers() });
    if (!res.ok) throw new Error('Failed to fetch missing signals');
    return res.json();
  },

  // ── Search Wizard Settings ──

  async getWizardSettings(): Promise<SearchWizardSettings> {
    const res = await fetch(`${API}/api/admin/platform-settings/search-wizard`, { headers: headers() });
    if (!res.ok) throw new Error('Failed to fetch wizard settings');
    return res.json();
  },

  async updateWizardSettings(settings: Partial<SearchWizardSettings>): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API}/api/admin/platform-settings/search-wizard`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Failed to update wizard settings');
    return res.json();
  },
};
