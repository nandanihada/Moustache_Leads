/**
 * Admin Top Offers API Service
 */

import { API_BASE_URL as BASE_URL } from './apiConfig';
const API_BASE_URL = `${BASE_URL}/api/admin`;

export interface TopOfferConfig {
  offer_id: string;
  name: string;
  payout: number;
  category: string;
  vertical: string;
  status: string;
  position: number;
  is_pinned: boolean;
}

export interface ActiveOfferOption {
  offer_id: string;
  name: string;
  payout: number;
  category: string;
  vertical: string;
  status: string;
}

export interface TopOffersSettings {
  mode: 'manual' | 'auto' | 'hybrid';
  auto_criteria: 'conversions' | 'clicks' | 'requests';
}

export interface TopOffersResponse {
  success: boolean;
  settings: TopOffersSettings;
  top_offers: TopOfferConfig[];
  active_offers: ActiveOfferOption[];
}

export const topOffersApi = {
  /**
   * Get all Top Offers data including settings, current top offers, and list of all active offers
   */
  async getTopOffers(): Promise<TopOffersResponse> {
    const response = await fetch(`${API_BASE_URL}/top-offers`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch Top Offers');
    }

    return response.json();
  },

  /**
   * Update top offers priority mode and curation criteria settings
   */
  async updateSettings(settings: TopOffersSettings): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/top-offers/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      throw new Error('Failed to update Top Offers settings');
    }

    return response.json();
  },

  /**
   * Manually add/pin an offer to the Top Offers curation list
   */
  async addTopOffer(offerId: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/top-offers/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ offer_id: offerId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to add Top Offer');
    }

    return response.json();
  },

  /**
   * Remove/unpin an offer from the curated Top Offers list
   */
  async removeTopOffer(offerId: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/top-offers/remove/${offerId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to remove Top Offer');
    }

    return response.json();
  },

  /**
   * Save the manual reordered sequence of curated Top Offers
   */
  async reorderTopOffers(orderedIds: string[]): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/top-offers/reorder`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ ordered_ids: orderedIds }),
    });

    if (!response.ok) {
      throw new Error('Failed to reorder Top Offers');
    }

    return response.json();
  },
};
