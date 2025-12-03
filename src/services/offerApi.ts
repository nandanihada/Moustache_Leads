// API service for fetching offers from backend
import { API_BASE_URL as BASE_URL } from './apiConfig';
const API_BASE_URL = `${BASE_URL}/api`;

export interface Offer {
  id: string;
  title: string;
  description: string;
  reward_amount: number;
  reward_currency: string;
  category: string;
  status: string;
  image_url: string;
  click_url: string;
  network: string;
  countries: string[];
  devices: string[];
  estimated_time: string;
  created_at: string;
}

export interface OffersResponse {
  offers: Offer[];
  total_count: number;
  placement_id?: string;
  user_id?: string;
  generated_at: string;
}

export interface OfferFilters {
  category?: string;
  status?: string;
  limit?: number;
  placement_id?: string;
  user_id?: string;
}

class OfferApiService {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  /**
   * Fetch offers from the backend
   * @param filters - Optional filters for category, status, limit
   * @returns Promise with offers data
   */
  async fetchOffers(filters?: OfferFilters): Promise<OffersResponse> {
    try {
      console.log('🔄 Fetching offers from backend...', filters);
      
      // Build query parameters
      const params = new URLSearchParams();
      if (filters?.category) params.append('category', filters.category);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.placement_id) params.append('placement_id', filters.placement_id);
      if (filters?.user_id) params.append('user_id', filters.user_id);
      
      const queryString = params.toString();
      const url = `${API_BASE_URL}/offerwall/offers${queryString ? `?${queryString}` : ''}`;
      
      console.log('📡 API URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await this.handleResponse<OffersResponse>(response);
      console.log('✅ Offers fetched successfully:', data.total_count, 'offers');
      
      return data;
    } catch (error) {
      console.error('❌ Error fetching offers:', error);
      throw error;
    }
  }

  /**
   * Fetch a single offer by ID
   * @param offerId - The offer ID
   * @returns Promise with offer data
   */
  async fetchOfferById(offerId: string): Promise<Offer> {
    try {
      console.log('🔄 Fetching offer by ID:', offerId);
      
      const response = await fetch(`${API_BASE_URL}/offerwall/offers/${offerId}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await this.handleResponse<Offer>(response);
      console.log('✅ Offer fetched successfully:', data);
      
      return data;
    } catch (error) {
      console.error('❌ Error fetching offer:', error);
      throw error;
    }
  }

  /**
   * Track offer click
   * @param offerId - The offer ID
   * @param placementId - Optional placement ID
   * @param userId - Optional user ID
   */
  async trackOfferClick(offerId: string, placementId?: string, userId?: string): Promise<void> {
    try {
      console.log('🔄 Tracking offer click:', offerId);
      
      await fetch(`${API_BASE_URL}/offerwall/track/click`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          offer_id: offerId,
          placement_id: placementId || 'web-publisher',
          user_id: userId || 'anonymous',
          user_agent: navigator.userAgent,
        }),
      });

      console.log('✅ Click tracked successfully');
    } catch (error) {
      console.error('❌ Error tracking click:', error);
      // Don't throw - tracking failure shouldn't block user action
    }
  }
}

// Export singleton instance
export const offerApi = new OfferApiService();
export default offerApi;
