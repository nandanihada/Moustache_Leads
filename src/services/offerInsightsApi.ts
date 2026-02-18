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

export type InsightType = 'highest_clicks' | 'highest_conversions' | 'high_clicks_low_conversion' | 'most_requested';

export interface InsightOffer {
  offer_id: string;
  name: string;
  payout: number;
  image_url: string;
  category: string;
  metric_value: number;
  metric_label: string;
  conversion_rate?: number;
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

  // Preview email template
  async previewEmail(insightType: InsightType, offer: InsightOffer, customMessage: string = '') {
    const response = await fetch(`${API_BASE_URL}/api/admin/insights/preview-email`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        insight_type: insightType,
        offer,
        custom_message: customMessage
      })
    });
    if (!response.ok) throw new Error('Failed to preview email');
    return response.json();
  },

  // Send emails to selected partners
  async sendEmails(
    insightType: InsightType,
    offer: InsightOffer,
    partnerIds: string[],
    customMessage: string = ''
  ) {
    const response = await fetch(`${API_BASE_URL}/api/admin/insights/send-email`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        insight_type: insightType,
        offer,
        partner_ids: partnerIds,
        custom_message: customMessage
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
  }
};
