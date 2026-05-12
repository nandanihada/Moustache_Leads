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
    layout: 'grid' | 'list';
    cards_per_row: number;
    show_categories: boolean;
    show_search: boolean;
  };
  announcements: Array<{text: string; active: boolean; id: string}>;
  updated_at?: string;
  updated_by?: string;
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

  async getOfferwallOffers(params?: {search?: string; page?: number; per_page?: number}): Promise<any> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', String(params.page));
    if (params?.per_page) query.set('per_page', String(params.per_page));
    const res = await fetch(`${API_BASE_URL}/offerwall-offers?${query.toString()}`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch offerwall offers');
    return res.json();
  }
}

export const offerwallManagerApi = new OfferwallManagerApi();
