import { API_BASE_URL as BASE_URL } from './apiConfig';
const API_BASE_URL = `${BASE_URL}/api/admin`;

export interface Offer {
  _id?: string;
  offer_id: string;
  campaign_id: string;
  name: string;
  description?: string;
  status: 'active' | 'pending' | 'inactive' | 'paused' | 'hidden';
  
  // Extended fields
  category?: string;
  offer_type?: string;
  tags?: string[];
  keywords?: string[];
  
  // Targeting
  countries: string[];
  languages?: string[];
  device_targeting: 'all' | 'mobile' | 'desktop';
  os_targeting?: string[];
  browser_targeting?: string[];
  connection_type?: string;
  carrier_targeting?: string[];
  timezone?: string;
  schedule?: {
    enabled: boolean;
    start_time: string;
    end_time: string;
    days: string[];
  };
  
  // Payout & Finance
  payout: number;
  currency?: string;
  revenue?: number;
  payout_type?: string;
  payout_model?: string;  // Optional field from bulk upload (e.g., 'CPA', 'CPI', 'CPL')
  tier_rules?: Array<{min_conversions: number; payout: number}>;
  caps?: {
    daily?: number;
    weekly?: number;
    monthly?: number;
    total?: number;
    auto_pause?: boolean;
    alert_emails?: string[];
  };
  
  // Tracking
  network: string;
  short_description?: string;
  hash_code?: string;
  target_url: string;
  preview_url?: string;
  masked_url?: string;  // Auto-generated masked link
  masked_link_id?: string;  // Reference to masked link document
  tracking?: {
    protocol?: string;
    postback_url?: string;
    click_expiration?: number;
    conversion_window?: number;
    duplicate_rule?: string;
    allowed_sources?: string[];
    blocked_sources?: string[];
  };
  
  // Access & Affiliates
  affiliates: 'all' | 'premium' | 'selected';
  selected_users?: string[];
  access_type?: string;
  approval_notes?: string;
  manager?: string;
  
  // Creatives
  image_url?: string;
  thumbnail_url?: string;
  banner_codes?: string[];
  email_creative?: {
    subject?: string;
    body?: string;
  };
  landing_variants?: string[];
  creative_category?: string;
  
  // Schedule & Expiry
  start_date?: string;
  expiration_date?: string;
  auto_expire_action?: string;
  fallback_url?: string;
  
  // Smart Rules
  smart_rules?: {
    random_redirect?: boolean;
    redirect_urls?: string[];
    geo_redirect?: Record<string, string>;
    rotation_enabled?: boolean;
    rotation_weight?: number;
    leads_filter?: boolean;
    validation_enabled?: boolean;
  };
  
  // Compliance
  compliance?: {
    allowed_traffic?: string[];
    disallowed_traffic?: string[];
    creative_approval?: boolean;
    terms_notes?: string;
    brand_guidelines?: string;
  };
  
  // Integrations
  integrations?: {
    external_offer_id?: string;
    sync_frequency?: string;
    webhook_template?: string;
  };
  
  // Monitoring
  monitoring?: {
    hit_limit?: number;
    conversion_goal?: string;
    quality_threshold?: number;
    validation_type?: string;
  };
  
  // System fields
  hits: number;
  limit?: number;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  is_active?: boolean;
}

export interface CreateOfferData {
  // SECTION 1: OFFER IDENTIFICATION
  campaign_id: string;  // Publisher's campaign ID
  name: string;
  description?: string;
  category?: string;  // Finance/Gaming/Dating/etc
  offer_type?: string;  // CPA/CPL/CPS/CPI/CPC
  status?: string;  // Active/Inactive/Pending/Paused/Hidden
  tags?: string[];  // Internal filtering tags
  keywords?: string[];  // SEO/filtering keywords
  
  // SECTION 2: TARGETING RULES
  countries: string[];
  languages?: string[];  // en, es, fr, etc
  device_targeting: string;  // all/mobile/desktop
  os_targeting?: string[];  // iOS/Android/Windows/Mac
  browser_targeting?: string[];  // Chrome/Safari/Edge
  carrier_targeting?: string[];  // Verizon/AT&T/T-Mobile
  connection_type?: string;  // wifi/mobile/all
  timezone?: string;  // UTC/EST/PST/etc
  
  // SECTION 3: PAYOUT & FINANCE
  payout: number;
  currency?: string;  // USD/EUR/GBP/etc
  revenue?: number;  // Optional network earn
  payout_type?: string;  // fixed/tiered/percentage
  daily_cap?: number;  // Daily conversion limit
  weekly_cap?: number;  // Weekly conversion limit
  monthly_cap?: number;  // Monthly conversion limit
  auto_pause_on_cap?: boolean;  // Auto pause when cap reached
  cap_alert_emails?: string[];  // Email alerts for caps
  
  // SECTION 4: TRACKING SETUP
  network: string;
  partner_id?: string;  // Partner ID for postback
  target_url: string;
  preview_url?: string;
  tracking_domain?: string;  // main/subdomain
  tracking_protocol?: string;  // pixel/s2s/api
  postback_url?: string;  // Conversion postback URL
  hash_code?: string;
  click_expiration?: number;  // Days
  conversion_window?: number;  // Days
  allowed_traffic_sources?: string[];  // Allowed sources
  blocked_traffic_sources?: string[];  // Blocked sources
  duplicate_conversion_rule?: string;  // allow/deny/unique
  
  // SECTION 5: ACCESS & AFFILIATES
  affiliates: string;  // all/specific
  access_type?: string;  // public/private/request-only
  selected_users?: string[];  // Specific affiliate list
  manager?: string;  // Campaign manager
  approval_notes?: string;  // Access instructions
  
  // SECTION 6: CREATIVES & VISUALS
  creative_type?: string;  // image/html/email
  image_url?: string;
  thumbnail_url?: string;
  html_code?: string;  // HTML banner code
  email_template?: string;  // Email HTML template
  email_subject?: string;  // Email subject line
  // Legacy fields (keeping for backward compatibility)
  banner_codes?: string[];  // HTML banner codes
  email_creative?: string;  // Email template
  landing_page_variants?: string[];  // LP variations
  creative_category?: string;  // banner/email/video
  
  // SECTION 7: SCHEDULE & EXPIRY
  start_date?: string;
  expiration_date?: string;
  auto_expire_action?: string;  // pause/replace/redirect
  fallback_url?: string;
  
  // SECTION 8: SMART RULES
  random_redirect?: boolean;
  redirect_urls?: string[];  // Alternate URLs
  geo_redirect_rules?: Record<string, string>;  // Country-specific URLs
  rotation_enabled?: boolean;
  leads_filter_enabled?: boolean;  // Mustache leads filter
  rotation_rules?: Record<string, any>;  // Advanced rotation settings
  
  // SECTION 9: COMPLIANCE
  allowed_traffic_types?: string[];
  disallowed_traffic_types?: string[];
  creative_approval_required?: boolean;
  affiliate_terms?: string;  // Terms and conditions
  brand_guidelines?: string;  // Brand guidelines
  terms_notes?: string;
  
  // SECTION 10: INTEGRATIONS
  network_partner?: string;  // PepperAds/PepeLeads
  network_short_description?: string;  // Brief description
  external_offer_id?: string;
  sync_frequency?: string;  // daily/weekly/manual
  webhook_template?: string;  // Postback template
  webhook_url?: string;
  
  // SECTION 11: REPORTING & MONITORING
  hit_limit?: number;  // Click limit
  conversion_goal?: string;  // lead/sale/install
  quality_threshold?: number;  // CR threshold
  validation_type?: string;  // internal/external
  
  // SYSTEM FIELDS
  limit?: number;
}

export interface OffersResponse {
  offers: Offer[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    pages: number;
  };
}

export interface OfferStats {
  total_offers: number;
  active_offers: number;
  pending_offers: number;
  inactive_offers: number;
  total_hits: number;
  top_networks: Array<{
    _id: string;
    count: number;
  }>;
}

class AdminOfferApi {
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

  async createOffer(offerData: CreateOfferData): Promise<{ message: string; offer: Offer }> {
    const response = await fetch(`${API_BASE_URL}/offers`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(offerData),
    });

    return this.handleResponse(response);
  }

  async getOffers(params?: {
    page?: number;
    per_page?: number;
    status?: string;
    network?: string;
    search?: string;
  }): Promise<OffersResponse> {
    const searchParams = new URLSearchParams();
    
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.per_page) searchParams.append('per_page', params.per_page.toString());
    if (params?.status) searchParams.append('status', params.status);
    if (params?.network) searchParams.append('network', params.network);
    if (params?.search) searchParams.append('search', params.search);

    const response = await fetch(`${API_BASE_URL}/offers?${searchParams}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async getOffer(offerId: string): Promise<{ offer: Offer }> {
    const response = await fetch(`${API_BASE_URL}/offers/${offerId}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async updateOffer(offerId: string, updateData: Partial<CreateOfferData>): Promise<{ message: string; offer: Offer }> {
    const response = await fetch(`${API_BASE_URL}/offers/${offerId}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(updateData),
    });

    return this.handleResponse(response);
  }

  async deleteOffer(offerId: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/offers/${offerId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to delete offer');
    }

    return this.handleResponse(response);
  }

  async bulkDeleteOffers(offerIds: string[]): Promise<{ message: string; deleted: number; failed: number; errors?: any[] }> {
    const response = await fetch(`${API_BASE_URL}/offers/bulk-delete`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ offer_ids: offerIds }),
    });

    if (!response.ok) {
      throw new Error('Failed to bulk delete offers');
    }

    return this.handleResponse(response);
  }

  async cloneOffer(offerId: string): Promise<{ message: string; offer: Offer }> {
    const response = await fetch(`${API_BASE_URL}/offers/${offerId}/clone`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async getOfferStats(): Promise<{ stats: OfferStats }> {
    const response = await fetch(`${API_BASE_URL}/offers/stats`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  // Utility method for testing
  async quickLogin(username: string = 'admin', password: string = 'admin123'): Promise<void> {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      console.log('✅ Admin login successful');
    } else {
      console.error('❌ Admin login failed');
    }
  }
}

export const adminOfferApi = new AdminOfferApi();
