const API_BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/masking`;

export interface MaskingDomain {
  _id: string;
  domain: string;
  name: string;
  description?: string;
  ssl_enabled: boolean;
  default_redirect_type: string;
  status: 'active' | 'inactive';
  priority: number;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  is_active?: boolean;
}

export interface MaskedLink {
  _id: string;
  sequence_id: number;
  offer_id: string;
  short_code: string;
  target_url: string;
  domain_id: string;
  domain_name: string;
  masked_url: string;
  redirect_type: string;
  subid_append: boolean;
  preview_mode: boolean;
  auto_rotation: boolean;
  rotation_urls: string[];
  click_count: number;
  unique_clicks: number;
  last_clicked?: string;
  status: 'active' | 'inactive' | 'paused';
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  is_active?: boolean;
}

export interface MaskingSettings {
  domain_id: string;
  use_custom_code?: boolean;
  custom_code?: string;
  code_length?: number;
  redirect_type?: '301' | '302' | '307';
  subid_append?: boolean;
  preview_mode?: boolean;
  auto_rotation?: boolean;
  rotation_urls?: string[];
}

export interface CreateMaskedLinkData {
  offer_id: string;
  target_url: string;
  masking_settings: MaskingSettings;
}

export interface CreateDomainData {
  domain: string;
  name?: string;
  description?: string;
  ssl_enabled?: boolean;
  default_redirect_type?: '301' | '302' | '307';
  status?: 'active' | 'inactive';
  priority?: number;
}

export interface MaskedLinksResponse {
  masked_links: MaskedLink[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    pages: number;
  };
}

class LinkMaskingApi {
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

  // Masked Links API

  async createMaskedLink(linkData: CreateMaskedLinkData): Promise<{ message: string; masked_link: MaskedLink }> {
    const response = await fetch(`${API_BASE_URL}/masked-links`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(linkData),
    });

    return this.handleResponse(response);
  }

  async getMaskedLinks(params?: {
    page?: number;
    per_page?: number;
    offer_id?: string;
    domain_id?: string;
    status?: string;
    search?: string;
  }): Promise<MaskedLinksResponse> {
    const searchParams = new URLSearchParams();
    
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.per_page) searchParams.append('per_page', params.per_page.toString());
    if (params?.offer_id) searchParams.append('offer_id', params.offer_id);
    if (params?.domain_id) searchParams.append('domain_id', params.domain_id);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.search) searchParams.append('search', params.search);

    const response = await fetch(`${API_BASE_URL}/masked-links?${searchParams}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async updateMaskedLink(linkId: string, updateData: Partial<MaskedLink>): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/masked-links/${linkId}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(updateData),
    });

    return this.handleResponse(response);
  }

  async deleteMaskedLink(linkId: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/masked-links/${linkId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  // Domains API

  async createDomain(domainData: CreateDomainData): Promise<{ message: string; domain: MaskingDomain }> {
    const response = await fetch(`${API_BASE_URL}/domains`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(domainData),
    });

    return this.handleResponse(response);
  }

  async getDomains(activeOnly: boolean = true): Promise<{ domains: MaskingDomain[] }> {
    const searchParams = new URLSearchParams();
    searchParams.append('active_only', activeOnly.toString());

    const response = await fetch(`${API_BASE_URL}/domains?${searchParams}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async updateDomain(domainId: string, updateData: Partial<CreateDomainData>): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/domains/${domainId}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(updateData),
    });

    return this.handleResponse(response);
  }

  async deleteDomain(domainId: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/domains/${domainId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  // Utility Methods

  async generatePreviewLink(offerId: string): Promise<{ preview_url: string; short_code: string; domain: string }> {
    const response = await fetch(`${API_BASE_URL}/generate-preview/${offerId}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  // Test redirect (public endpoint)
  async testRedirect(domain: string, shortCode: string): Promise<any> {
    const response = await fetch(`http://localhost:5000/${domain}/${shortCode}`, {
      method: 'GET',
      redirect: 'manual', // Don't follow redirects automatically
    });

    if (response.status === 302 || response.status === 301) {
      return {
        redirect: true,
        location: response.headers.get('Location'),
        status: response.status
      };
    }

    return response.json();
  }

  // Utility method for testing
  async quickLogin(username: string = 'admin', password: string = 'admin123'): Promise<void> {
    const response = await fetch('http://localhost:5000/api/auth/login', {
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

export const linkMaskingApi = new LinkMaskingApi();
