/**
 * API Import Service
 * Handles API calls for importing offers from affiliate networks
 */

// Use relative URL for production, falls back to localhost for development
const API_BASE_URL = import.meta.env.VITE_API_URL || (
  typeof window !== 'undefined' && window.location.origin.includes('localhost')
    ? 'http://localhost:5000'
    : '' // Use relative URL in production
);

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
        credentials: 'include', // Include credentials for CORS
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Test connection error:', error);
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error('Cannot connect to server. Please check if the backend is running and CORS is configured.');
      }
      throw error;
    }
  }

  async fetchPreview(request: PreviewRequest): Promise<PreviewResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/offers/api-import/preview`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(request),
        credentials: 'include', // Include credentials for CORS
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Fetch preview error:', error);
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error('Cannot connect to server. Please check if the backend is running and CORS is configured.');
      }
      throw error;
    }
  }

  async importOffers(request: ImportRequest): Promise<ImportResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/offers/api-import`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(request),
        credentials: 'include',
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        // Even on error, the backend might return partial success info
        if (data && data.summary) {
          return data as ImportResponse;
        }
        throw new Error(data?.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return data as ImportResponse;
    } catch (error) {
      console.error('Import offers error:', error);
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error('Cannot connect to server. Please check if the backend is running and CORS is configured.');
      }
      throw error;
    }
  }
}

export const apiImportService = new ApiImportService();
