import axios from 'axios';

const API_BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin`;

export interface Partner {
  _id?: string;
  partner_id: string;
  partner_name: string;
  postback_url: string;
  method: 'GET' | 'POST';
  status: 'active' | 'inactive';
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreatePartnerData {
  partner_name: string;
  postback_url: string;
  method: 'GET' | 'POST';
  status?: 'active' | 'inactive';
  description?: string;
}

export interface TestPostbackResponse {
  success: boolean;
  test_url: string;
  method: string;
  status_code?: number;
  response_body?: string;
  error?: string;
  test_data: any;
}

class PartnerApi {
  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  async getPartners(status?: string): Promise<{ partners: Partner[]; total: number }> {
    try {
      const params = status ? { status } : {};
      const response = await axios.get(`${API_BASE_URL}/partners`, {
        headers: this.getAuthHeaders(),
        params
      });
      return response.data;
    } catch (error: any) {
      console.error('Error fetching partners:', error);
      throw error.response?.data || error;
    }
  }

  async getPartner(partnerId: string): Promise<{ partner: Partner }> {
    try {
      const response = await axios.get(`${API_BASE_URL}/partners/${partnerId}`, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error: any) {
      console.error('Error fetching partner:', error);
      throw error.response?.data || error;
    }
  }

  async createPartner(data: CreatePartnerData): Promise<{ message: string; partner: Partner }> {
    try {
      const response = await axios.post(`${API_BASE_URL}/partners`, data, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error: any) {
      console.error('Error creating partner:', error);
      throw error.response?.data || error;
    }
  }

  async updatePartner(partnerId: string, data: Partial<CreatePartnerData>): Promise<{ message: string; partner: Partner }> {
    try {
      const response = await axios.put(`${API_BASE_URL}/partners/${partnerId}`, data, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error: any) {
      console.error('Error updating partner:', error);
      throw error.response?.data || error;
    }
  }

  async deletePartner(partnerId: string): Promise<{ message: string }> {
    try {
      const response = await axios.delete(`${API_BASE_URL}/partners/${partnerId}`, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error: any) {
      console.error('Error deleting partner:', error);
      throw error.response?.data || error;
    }
  }

  async testPartner(partnerId: string): Promise<TestPostbackResponse> {
    try {
      const response = await axios.post(`${API_BASE_URL}/partners/${partnerId}/test`, {}, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error: any) {
      console.error('Error testing partner:', error);
      throw error.response?.data || error;
    }
  }
}

export const partnerApi = new PartnerApi();
