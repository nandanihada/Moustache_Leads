// Offer Insights Email Campaign API Service
import { API_BASE_URL } from './apiConfig';

// Helper to get auth headers
const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

export type InsightType = 'highest_clicks' | 'highest_conversions' | 'high_clicks_low_conversion' | 'most_requested' | 'price_mismatch';

export interface InsightOffer {
  offer_id: string;
  name: string;
  payout: number;
  image_url: string;
  category: string;
  metric_value: number;
  metric_label: string;
  conversion_rate?: number;
  no_tracking_data?: boolean;
  // Price mismatch specific fields
  new_payout?: number;
  price_change_type?: 'increase' | 'decrease';
  percent_change?: number;
  mismatch_id?: string;
}

export interface InsightTemplate {
  subject: string;
  title: string;
  subtitle: string;
  cta_text: string;
  highlight_label: string;
  color: string;
}

export interface Partner {
  _id: string;
  username: string;
  email: string;
  is_active: boolean;
  created_at?: string;
  role?: string;
}

export interface EmailHistoryItem {
  _id: string;
  insight_type: InsightType;
  offer_id: string;
  offer_name: string;
  partner_count: number;
  sent_count: number;
  failed_count: number;
  sent_by: string;
  created_at: string;
  scheduled_at?: string;
  status?: 'sent' | 'scheduled' | 'cancelled';
  offers?: InsightOffer[];
}

export const offerInsightsApi = {
  // Get offers by insight type
  async getOfferInsights(type: InsightType, limit: number = 10, days: number = 30) {
    const response = await fetch(
      `${API_BASE_URL}/api/admin/insights/offers?type=${type}&limit=${limit}&days=${days}`,
      { headers: getAuthHeaders() }
    );
    if (!response.ok) throw new Error('Failed to fetch offer insights');
    return response.json();
  },

  // Get partners for email selection
  async getPartners(search: string = '', status: string = 'active') {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    
    const response = await fetch(
      `${API_BASE_URL}/api/admin/insights/partners?${params.toString()}`,
      { headers: getAuthHeaders() }
    );
    if (!response.ok) throw new Error('Failed to fetch partners');
    return response.json();
  },

  // Preview email template (supports multiple offers)
  async previewEmail(insightType: InsightType, offers: InsightOffer | InsightOffer[], customMessage: string = '') {
    const offersArray = Array.isArray(offers) ? offers : [offers];
    const response = await fetch(`${API_BASE_URL}/api/admin/insights/preview-email`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        insight_type: insightType,
        offers: offersArray,
        custom_message: customMessage
      })
    });
    if (!response.ok) throw new Error('Failed to preview email');
    return response.json();
  },

  // Send emails to selected partners (supports multiple offers and scheduling)
  async sendEmails(
    insightType: InsightType,
    offers: InsightOffer | InsightOffer[],
    partnerIds: string[],
    customMessage: string = '',
    scheduledAt?: string
  ) {
    const offersArray = Array.isArray(offers) ? offers : [offers];
    const response = await fetch(`${API_BASE_URL}/api/admin/insights/send-email`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        insight_type: insightType,
        offers: offersArray,
        partner_ids: partnerIds,
        custom_message: customMessage,
        scheduled_at: scheduledAt
      })
    });
    if (!response.ok) throw new Error('Failed to send emails');
    return response.json();
  },

  // Get email history
  async getEmailHistory() {
    const response = await fetch(`${API_BASE_URL}/api/admin/insights/email-history`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch email history');
    return response.json();
  },

  // Cancel scheduled email
  async cancelScheduledEmail(emailId: string) {
    const response = await fetch(`${API_BASE_URL}/api/admin/insights/cancel-scheduled/${emailId}`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to cancel scheduled email');
    return response.json();
  },

  // Resume/reschedule a cancelled email
  async resumeScheduledEmail(emailId: string, newScheduledAt: string) {
    const response = await fetch(`${API_BASE_URL}/api/admin/insights/resume-scheduled/${emailId}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ scheduled_at: newScheduledAt })
    });
    if (!response.ok) throw new Error('Failed to resume scheduled email');
    return response.json();
  }
};
