/**
 * API Import Service
 * Handles API calls for importing offers from affiliate networks
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export interface TestConnectionRequest {
  network_id: string;
  api_key: string;
  network_type: string;
}

export interface TestConnectionResponse {
  success: boolean;
  message?: string;
  offer_count?: number;
  network_name?: string;
  error?: string;
}

export interface PreviewRequest {
  network_id: string;
  api_key: string;
  network_type: string;
  filters?: {
    status?: string;
    countries?: string;
  };
  limit?: number;
}

export interface PreviewOffer {
  name: string;
  payout: number;
  currency: string;
  countries: string[];
  status: string;
}

export interface PreviewResponse {
  success: boolean;
  offers?: PreviewOffer[];
  total_available?: number;
  error?: string;
}

export interface ImportRequest {
  network_id: string;
  api_key: string;
  network_type: string;
  filters?: {
    status?: string;
    countries?: string;
  };
  options?: {
    skip_duplicates?: boolean;
    update_existing?: boolean;
    auto_activate?: boolean;
  };
}

export interface ImportSummary {
  total_fetched: number;
  imported: number;
  skipped: number;
  errors: number;
}

export interface ImportResponse {
  success: boolean;
  summary?: ImportSummary;
  imported_offers?: string[];
  skipped_offers?: Array<{ name: string; reason: string }>;
  errors?: Array<{ offer_name: string; error: string }>;
  error?: string;
}

class ApiImportService {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  async testConnection(request: TestConnectionRequest): Promise<TestConnectionResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/offers/api-import/test`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(request),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to test connection');
      }

      return data;
    } catch (error) {
      console.error('Test connection error:', error);
      throw error;
    }
  }

  async fetchPreview(request: PreviewRequest): Promise<PreviewResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/offers/api-import/preview`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(request),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch preview');
      }

      return data;
    } catch (error) {
      console.error('Fetch preview error:', error);
      throw error;
    }
  }

  async importOffers(request: ImportRequest): Promise<ImportResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/offers/api-import`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(request),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import offers');
      }

      return data;
    } catch (error) {
      console.error('Import offers error:', error);
      throw error;
    }
  }
}

export const apiImportService = new ApiImportService();
