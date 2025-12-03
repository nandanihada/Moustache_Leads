// API service for placement management with Flask backend
import { API_BASE_URL as BASE_URL } from './apiConfig';
const API_BASE_URL = `${BASE_URL}/api`;

interface PlacementData {
  platformType: 'website' | 'iOS' | 'android';
  offerwallTitle: string;
  currencyName: string;
  exchangeRate: number;
  postbackUrl: string;
  status?: 'LIVE' | 'PAUSED' | 'INACTIVE';
  // Additional fields for your frontend
  platformName?: string;
  platformLink?: string;
  description?: string;
  postbackFailureNotification?: boolean;
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
    if (!token) {
      throw new Error('No authentication token found. Please login first.');
    }
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

  // Convert frontend data format to backend format
  private convertToBackendFormat(frontendData: any): PlacementData {
    return {
      platformType: frontendData.platformType?.toLowerCase() === 'website' ? 'website' : 
                   frontendData.platformType === 'iOS' ? 'iOS' : 'android',
      offerwallTitle: frontendData.offerwallTitle || '',
      currencyName: frontendData.currencyName || '',
      exchangeRate: parseFloat(frontendData.exchangeRate) || 1,
      postbackUrl: frontendData.postbackUri || frontendData.postbackUrl || '',
      status: 'LIVE' // Default status
    };
  }

  // Convert backend response to frontend format
  private convertToFrontendFormat(backendData: any): any {
    return {
      id: backendData._id || backendData.id,
      placementIdentifier: backendData.placementIdentifier,
      apiKey: backendData.apiKey,
      platformType: backendData.platformType,
      offerwallTitle: backendData.offerwallTitle,
      currencyName: backendData.currencyName,
      exchangeRate: backendData.exchangeRate,
      postbackUrl: backendData.postbackUrl,
      status: backendData.status,
      approvalStatus: backendData.approvalStatus || 'PENDING_APPROVAL',
      approvedBy: backendData.approvedBy,
      approvedAt: backendData.approvedAt,
      rejectionReason: backendData.rejectionReason,
      reviewMessage: backendData.reviewMessage,
      createdAt: backendData.createdAt,
      updatedAt: backendData.updatedAt,
      
      // Map to frontend field names
      platformName: backendData.platformName || '',
      platformLink: backendData.platformLink || '',
      postbackUri: backendData.postbackUrl,
      description: backendData.description || '',
      postbackFailureNotification: backendData.postbackFailureNotification || false,
      
      // Testing fields
      userId: '',
      rewardValue: '',
      offerName: '',
      offerId: '',
      userIp: ''
    };
  }

  async createPlacement(frontendData: any): Promise<any> {
    // Check if user is authenticated first
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Please login first to create placements');
    }

    const backendData = this.convertToBackendFormat(frontendData);
    
    const response = await fetch(`${API_BASE_URL}/placements/`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(backendData)
    });

    const result = await this.handleResponse<PlacementResponse>(response);
    return this.convertToFrontendFormat(result);
  }

  async getPlacements(params?: {
    page?: number;
    size?: number;
    status_filter?: string;
    platform_filter?: string;
  }): Promise<{ placements: any[], total: number, page: number, size: number }> {
    // Check if user is authenticated first
    const token = localStorage.getItem('token');
    if (!token) {
      // Return empty result if not authenticated
      return {
        placements: [],
        total: 0,
        page: 1,
        size: 10
      };
    }

    const searchParams = new URLSearchParams();
    
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.size) searchParams.append('size', params.size.toString());
    if (params?.status_filter) searchParams.append('status_filter', params.status_filter);
    if (params?.platform_filter) searchParams.append('platform_filter', params.platform_filter);

    const response = await fetch(`${API_BASE_URL}/placements/?${searchParams}`, {
      headers: this.getAuthHeaders()
    });

    const result = await this.handleResponse<PlacementListResponse>(response);
    
    return {
      placements: result.placements.map(p => this.convertToFrontendFormat(p)),
      total: result.total,
      page: result.page,
      size: result.size
    };
  }

  async getPlacement(placementId: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/placements/${placementId}`, {
      headers: this.getAuthHeaders()
    });

    const result = await this.handleResponse<PlacementResponse>(response);
    return this.convertToFrontendFormat(result);
  }

  async updatePlacement(placementId: string, frontendData: any): Promise<any> {
    const backendData = this.convertToBackendFormat(frontendData);
    
    const response = await fetch(`${API_BASE_URL}/placements/${placementId}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(backendData)
    });

    const result = await this.handleResponse<PlacementResponse>(response);
    return this.convertToFrontendFormat(result);
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

    const result = await this.handleResponse<{ token: string; user: any }>(response);
    
    // Store token in localStorage for future requests
    if (result.token) {
      localStorage.setItem('token', result.token);
      console.log('✅ Login successful! Token stored.');
    }
    
    return result;
  }

  // Quick login method for testing
  async quickLogin(): Promise<boolean> {
    try {
      await this.login('demo', 'demo123');
      return true;
    } catch (error) {
      console.error('Quick login failed:', error);
      return false;
    }
  }

  async register(username: string, email: string, password: string): Promise<{ token: string; user: any }> {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });

    return this.handleResponse<{ token: string; user: any }>(response);
  }

  // Test postback (real implementation)
  async testPostback(testData: any): Promise<{ success: boolean; message: string; postback_data?: any; response_status?: number }> {
    // Check if user is authenticated first
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Please login first to test postbacks');
    }

    console.log('Testing postback with data:', testData);
    
    const response = await fetch(`${API_BASE_URL}/placements/test-postback`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(testData)
    });

    return this.handleResponse<{ success: boolean; message: string; postback_data?: any; response_status?: number }>(response);
  }
}

export const placementApi = new PlacementApiService();

// Make it globally accessible for testing in browser console
if (typeof window !== 'undefined') {
  (window as any).placementApi = placementApi;
}

export type { PlacementData, PlacementResponse, PlacementListResponse };
