/**
 * Tracking API Service
 * Handles all tracking-related API calls
 */

const API_BASE_URL = 'http://localhost:5000/api';

export interface TrackingStats {
  clicks: {
    total: number;
    converted: number;
    conversion_rate: number;
  };
  conversions: {
    total: number;
    total_payout: number;
    avg_payout: number;
    total_revenue: number;
  };
}

export interface TrackingEvent {
  _id: string;
  event_id: string;
  event_type: 'click' | 'completion' | 'postback_sent' | 'postback_failed';
  offer_id: string;
  offer_name?: string;
  user_id?: string;
  username?: string;
  partner_id?: string;
  metadata: any;
  timestamp: string;
  network?: string;
}

export interface OfferCompletion {
  offer_id: string;
  user_id: string;
  transaction_id?: string;
  payout?: number;
  revenue?: number;
  status?: string;
  external_id?: string;
  country?: string;
  sub_ids?: Record<string, string>;
  completion_data?: any;
}

class TrackingApi {
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

  // Track offer completion
  async trackOfferCompletion(completion: OfferCompletion): Promise<{ success: boolean; message: string; click_id: string; conversion_id: string }> {
    const response = await fetch(`${API_BASE_URL}/track/completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(completion),
    });

    return this.handleResponse(response);
  }

  // Track offer click (generate tracking link)
  async trackOfferClick(offerId: string, subIds?: string[]): Promise<{ success: boolean; tracking_url: string; click_id: string; expires_at: string }> {
    const response = await fetch(`${API_BASE_URL}/track/click`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        offer_id: offerId,
        sub_ids: subIds || []
      }),
    });

    return this.handleResponse(response);
  }

  // Get tracking statistics
  async getTrackingStats(params?: {
    offer_id?: string;
    days?: number;
  }): Promise<{ success: boolean; stats: TrackingStats; date_range: any }> {
    const searchParams = new URLSearchParams();
    
    if (params?.offer_id) searchParams.append('offer_id', params.offer_id);
    if (params?.days) searchParams.append('days', params.days.toString());

    const response = await fetch(`${API_BASE_URL}/track/stats?${searchParams}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  // Get tracking events (Admin only)
  async getTrackingEvents(params?: {
    limit?: number;
    event_type?: string;
    offer_id?: string;
    user_id?: string;
  }): Promise<{ success: boolean; events: TrackingEvent[]; count: number }> {
    const searchParams = new URLSearchParams();
    
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.event_type) searchParams.append('event_type', params.event_type);
    if (params?.offer_id) searchParams.append('offer_id', params.offer_id);
    if (params?.user_id) searchParams.append('user_id', params.user_id);

    const response = await fetch(`${API_BASE_URL}/track/events?${searchParams}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  // Get event statistics (Admin only)
  async getEventStats(hours: number = 24): Promise<{ success: boolean; stats: any }> {
    const response = await fetch(`${API_BASE_URL}/track/events/stats?hours=${hours}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  // Get events for specific offer (Admin only)
  async getOfferEvents(offerId: string, limit: number = 50): Promise<{ success: boolean; offer_id: string; events: TrackingEvent[]; count: number }> {
    const response = await fetch(`${API_BASE_URL}/track/offer/${offerId}/events?limit=${limit}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  // Get events for specific user (Admin only)
  async getUserEvents(userId: string, limit: number = 50): Promise<{ success: boolean; user_id: string; events: TrackingEvent[]; count: number }> {
    const response = await fetch(`${API_BASE_URL}/track/user/${userId}/events?limit=${limit}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }
}

export const trackingApi = new TrackingApi();
