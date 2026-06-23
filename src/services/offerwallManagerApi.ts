import { getApiBaseUrl } from './apiConfig';
import { getAuthToken } from '@/utils/cookies';

const API_BASE_URL = `${getApiBaseUrl()}/api/admin/offerwall-management`;

// Interface for settings
export interface OfferwallSettings {
  pinned_offers: string[];
  hidden_offers: string[];
  featured_offers: string[];
  display_order: Array<{offer_id: string; position: number}>;
  theme: {
    primary_color: string;
    background_color: string;
    layout: 'grid' | 'list' | 'table';
    cards_per_row: number;
    show_categories: boolean;
    show_search: boolean;
  };
  announcements: Array<{text: string; active: boolean; id: string}>;
  updated_at?: string;
  updated_by?: string;
}

export interface OfferwallOfferFilter {
  search?: string;
  page?: number;
  per_page?: number;
  refined?: string;
  vertical?: string;
  network?: string;
  country?: string;
  min_payout?: string;
  max_payout?: string;
  status?: string;
}

export interface OfferwallStats {
  total_active: number;
  total_visible: number;
  pinned_count: number;
  featured_count: number;
  hidden_count: number;
}

class OfferwallManagerApi {
  private getHeaders() {
    const token = getAuthToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  async getSettings(): Promise<OfferwallSettings> {
    const res = await fetch(`${API_BASE_URL}/settings`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch settings');
    const data = await res.json();
    return data.settings;
  }

  async updateSettings(settings: Partial<OfferwallSettings>): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/settings`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(settings)
    });
    if (!res.ok) throw new Error('Failed to update settings');
  }

  async pinOffers(offer_ids: string[], action: 'pin' | 'unpin'): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/pin`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ offer_ids, action })
    });
    if (!res.ok) throw new Error('Failed to pin/unpin offers');
  }

  async setVisibility(offer_ids: string[], action: 'show' | 'hide'): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/visibility`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ offer_ids, action })
    });
    if (!res.ok) throw new Error('Failed to update visibility');
  }

  async reorderOffers(order: Array<{offer_id: string; position: number}>): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/reorder`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ order })
    });
    if (!res.ok) throw new Error('Failed to reorder');
  }

  async getStats(): Promise<OfferwallStats> {
    const res = await fetch(`${API_BASE_URL}/stats`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch stats');
    const data = await res.json();
    return data.stats;
  }

  async getOffers(params?: {search?: string; status?: string; page?: number; per_page?: number}): Promise<any> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', String(params.page));
    if (params?.per_page) query.set('per_page', String(params.per_page));
    const res = await fetch(`${getApiBaseUrl()}/api/admin/offers?${query.toString()}`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch offers');
    return res.json();
  }

  async getOfferwallOfferIds(params?: {search?: string; refined?: string; vertical?: string; network?: string; country?: string; min_payout?: string; max_payout?: string; status?: string; has_event?: string}): Promise<{offer_ids: string[]; offers: any[]; total: number}> {
    const query = new URLSearchParams();
    // Fetch all pages — use a high per_page to get all IDs in one shot
    query.set('per_page', '1000');
    query.set('page', '1');
    if (params?.search) query.set('search', params.search);
    if (params?.refined) query.set('refined', params.refined);
    if (params?.vertical && params.vertical !== 'all') query.set('vertical', params.vertical);
    if (params?.network && params.network !== 'all') query.set('network', params.network);
    if (params?.country) query.set('country', params.country);
    if (params?.min_payout) query.set('min_payout', params.min_payout);
    if (params?.max_payout) query.set('max_payout', params.max_payout);
    if (params?.status && params.status !== 'all') query.set('status', params.status);
    if (params?.has_event) query.set('has_event', params.has_event);
    const res = await fetch(`${API_BASE_URL}/offerwall-offers?${query.toString()}`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch offer IDs');
    const data = await res.json();
    const offers = data.offers || [];
    return {
      offer_ids: offers.map((o: any) => o.offer_id),
      offers,
      total: data.pagination?.total || offers.length
    };
  }

  async getOfferwallOffers(params?: {search?: string; page?: number; per_page?: number; refined?: string; vertical?: string; network?: string; country?: string; min_payout?: string; max_payout?: string; status?: string}): Promise<any> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', String(params.page));
    if (params?.per_page) query.set('per_page', String(params.per_page));
    if (params?.refined) query.set('refined', params.refined);
    if (params?.vertical && params.vertical !== 'all') query.set('vertical', params.vertical);
    if (params?.network && params.network !== 'all') query.set('network', params.network);
    if (params?.country) query.set('country', params.country);
    if (params?.min_payout) query.set('min_payout', params.min_payout);
    if (params?.max_payout) query.set('max_payout', params.max_payout);
    if (params?.status && params.status !== 'all') query.set('status', params.status);
    if ((params as any)?.has_event) query.set('has_event', (params as any).has_event);
    const res = await fetch(`${API_BASE_URL}/offerwall-offers?${query.toString()}`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch offerwall offers');
    return res.json();
  }

  async getTrackingLogs(params?: {status?: string; page?: number; per_page?: number; search?: string}): Promise<any> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', String(params.page));
    if (params?.per_page) query.set('per_page', String(params.per_page));
    if (params?.search) query.set('search', params.search);
    const res = await fetch(`${API_BASE_URL}/tracking-logs?${query.toString()}`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch tracking logs');
    return res.json();
  }

  // ===== Price Boost =====
  async applyPriceBoost(offer_ids: string[], percentage: number, direction: 'increase' | 'decrease', duration_hours: number, duration_minutes: number = 0): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/price-boost`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ offer_ids, percentage, direction, duration_hours, duration_minutes })
    });
    if (!res.ok) throw new Error('Failed to apply price boost');
    return res.json();
  }

  async getActiveBoostedOffers(): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/price-boost/active`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch boosted offers');
    return res.json();
  }

  async removePriceBoost(offer_ids: string[]): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/price-boost/remove`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ offer_ids })
    });
    if (!res.ok) throw new Error('Failed to remove price boost');
    return res.json();
  }

  // ===== Fallback URL =====
  async setFallback(offer_ids: string[], fallback_enabled: boolean, fallback_url: string, fallback_message: string): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/fallback/set`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ offer_ids, fallback_enabled, fallback_url, fallback_message })
    });
    if (!res.ok) throw new Error('Failed to set fallback');
    return res.json();
  }

  async removeFallback(offer_ids: string[]): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/fallback/remove`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ offer_ids })
    });
    if (!res.ok) throw new Error('Failed to remove fallback');
    return res.json();
  }

  // ===== Position Ordering =====
  async setPositions(positions: Array<{offer_id: string; position: number}>): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/set-positions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ positions })
    });
    if (!res.ok) throw new Error('Failed to set positions');
    return res.json();
  }

  async removePosition(offer_ids: string[]): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/remove-position`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ offer_ids })
    });
    if (!res.ok) throw new Error('Failed to remove position');
    return res.json();
  }

  // ===== Bulk Remove from Offerwall =====
  async bulkRemoveFromOfferwall(offer_ids: string[]): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/bulk-remove`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ offer_ids })
    });
    if (!res.ok) throw new Error('Failed to bulk remove');
    return res.json();
  }

  // ===== AI Description Refiner =====
  async refineDescription(offer_id: string): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/refine-description`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ offer_id })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to refine' }));
      throw new Error(err.error || 'Failed to refine description');
    }
    return res.json();
  }

  async saveRefinedDescription(offer_id: string, refined: any, update_countries: boolean): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/save-refined-description`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ offer_id, refined, update_countries })
    });
    if (!res.ok) throw new Error('Failed to save refined description');
    return res.json();
  }

  async removeRefinedDescription(offer_id: string): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/remove-refined-description`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ offer_id })
    });
    if (!res.ok) throw new Error('Failed to remove refined description');
    return res.json();
  }

  async getOfferDescription(offer_id: string): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/get-offer-description?offer_id=${encodeURIComponent(offer_id)}`, {
      headers: this.getHeaders()
    });
    if (!res.ok) throw new Error('Failed to get offer description');
    return res.json();
  }

  async hideOfferById(offer_id: string): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/hide-by-id`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ offer_id })
    });
    if (!res.ok) throw new Error('Failed to hide offer');
    return res.json();
  }

  async refineField(offer_id: string, field: string): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/refine-field`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ offer_id, field })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed' }));
      throw new Error(err.error || `Failed to refine ${field}`);
    }
    return res.json();
  }

  async updateOfferImage(offer_id: string, image_url: string): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/update-offer-image`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ offer_id, image_url })
    });
    if (!res.ok) throw new Error('Failed to update image');
    return res.json();
  }

  async renameOffer(offer_id: string, new_name: string, original_name: string): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/rename-offer`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ offer_id, new_name, original_name })
    });
    if (!res.ok) throw new Error('Failed to rename offer');
    return res.json();
  }
}

export const offerwallManagerApi = new OfferwallManagerApi();
