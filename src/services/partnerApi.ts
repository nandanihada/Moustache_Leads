import axios from 'axios';

import { API_BASE_URL as BASE_URL } from './apiConfig';
const API_BASE_URL = `${BASE_URL}/api/admin`;

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
  // Postback receiver fields
  unique_postback_key?: string;
  postback_receiver_url?: string;
  parameter_mapping?: Record<string, string>;
}

export interface CreatePartnerData {
  partner_name: string;
  postback_url: string;
  method: 'GET' | 'POST';
  status?: 'active' | 'inactive';
  description?: string;
  parameter_mapping?: Record<string, string>;
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
      const params: any = status ? { status } : {};
      params.v = new Date().getTime();
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

  // User management methods
  async getRegisteredUsers(status?: string, role?: string): Promise<{ users: any[]; total: number }> {
    try {
      const params: any = {};
      if (status) params.status = status;
      if (role) params.role = role;
      params.v = new Date().getTime();
      
      const response = await axios.get(`${API_BASE_URL}/partners/users`, {
        headers: this.getAuthHeaders(),
        params
      });
      return response.data;
    } catch (error: any) {
      console.error('Error fetching registered users:', error);
      throw error.response?.data || error;
    }
  }

  async updateUserPostback(userId: string, postbackUrl: string): Promise<{ message: string }> {
    try {
      const response = await axios.put(
        `${API_BASE_URL}/partners/users/${userId}/postback`,
        { postback_url: postbackUrl },
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error updating user postback:', error);
      throw error.response?.data || error;
    }
  }

  async updateUserParameterMapping(userId: string, parameterMapping: Record<string, string>): Promise<{ message: string }> {
    try {
      const response = await axios.put(
        `${API_BASE_URL}/partners/users/${userId}/parameter-mapping`,
        { parameter_mapping: parameterMapping },
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error updating parameter mapping:', error);
      throw error.response?.data || error;
    }
  }

  async blockUser(userId: string, reason?: string): Promise<{ message: string }> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/partners/users/${userId}/block`,
        { reason },
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error blocking user:', error);
      throw error.response?.data || error;
    }
  }

  async unblockUser(userId: string): Promise<{ message: string }> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/partners/users/${userId}/unblock`,
        {},
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error unblocking user:', error);
      throw error.response?.data || error;
    }
  }
}

export const partnerApi = new PartnerApi();
