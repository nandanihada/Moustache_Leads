// API service for placement management with Flask backend
const API_BASE_URL = 'http://localhost:5000/api';

interface PlacementData {
  platformType: 'website' | 'iOS' | 'android';
  offerwallTitle: string;
  currencyName: string;
  exchangeRate: number;
  postbackUrl: string;
  status: 'LIVE' | 'PAUSED' | 'INACTIVE';
}

interface PlacementResponse {
  id: string;
  publisherId: string;
  placementIdentifier: string;
  platformType: 'website' | 'iOS' | 'android';
  offerwallTitle: string;
  currencyName: string;
  exchangeRate: number;
  postbackUrl: string;
  status: 'LIVE' | 'PAUSED' | 'INACTIVE';
  createdAt: string;
}

interface PlacementListResponse {
  placements: PlacementResponse[];
  total: number;
  page: number;
  size: number;
}

class PlacementApiService {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  async createPlacement(data: PlacementData): Promise<PlacementResponse> {
    const response = await fetch(`${API_BASE_URL}/placements/`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data)
    });

    return this.handleResponse<PlacementResponse>(response);
  }

  async getPlacements(params?: {
    page?: number;
    size?: number;
    status_filter?: string;
    platform_filter?: string;
  }): Promise<PlacementListResponse> {
    const searchParams = new URLSearchParams();
    
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.size) searchParams.append('size', params.size.toString());
    if (params?.status_filter) searchParams.append('status_filter', params.status_filter);
    if (params?.platform_filter) searchParams.append('platform_filter', params.platform_filter);

    const response = await fetch(`${API_BASE_URL}/placements/?${searchParams}`, {
      headers: this.getAuthHeaders()
    });

    return this.handleResponse<PlacementListResponse>(response);
  }

  async getPlacement(placementId: string): Promise<PlacementResponse> {
    const response = await fetch(`${API_BASE_URL}/placements/${placementId}`, {
      headers: this.getAuthHeaders()
    });

    return this.handleResponse<PlacementResponse>(response);
  }

  async updatePlacement(placementId: string, data: Partial<PlacementData>): Promise<PlacementResponse> {
    const response = await fetch(`${API_BASE_URL}/placements/${placementId}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data)
    });

    return this.handleResponse<PlacementResponse>(response);
  }

  async deletePlacement(placementId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/placements/${placementId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
  }

  // Publisher endpoints
  async getCurrentPublisher(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/placements/publisher/me`, {
      headers: this.getAuthHeaders()
    });

    return this.handleResponse(response);
  }

  // Authentication methods (using existing Flask auth)
  async login(username: string, password: string): Promise<{ token: string; user: any }> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    return this.handleResponse(response);
  }

  async register(username: string, email: string, password: string): Promise<{ token: string; user: any }> {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });

    return this.handleResponse(response);
  }
}

export const placementApi = new PlacementApiService();
export type { PlacementData, PlacementResponse, PlacementListResponse };
