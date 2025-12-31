import axios from 'axios';

import { API_BASE_URL as BASE_URL } from './apiConfig';
const API_BASE_URL = `${BASE_URL}/api/admin`;

export interface ReceivedPostback {
  _id: string;
  unique_key: string;
  partner_id: string;
  partner_name: string;
  method: 'GET' | 'POST';
  query_params: Record<string, any>;
  post_data: Record<string, any>;
  ip_address: string;
  user_agent: string;
  timestamp: string;
  status: string;
}

class PostbackReceiverApi {
  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  async generateUniqueKey(partnerId: string): Promise<{ unique_key: string; postback_url: string }> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/postback-receiver/generate-key`,
        { partner_id: partnerId },
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to generate unique key');
    }
  }

  async getReceivedPostbacks(params?: {
    partner_id?: string;
    unique_key?: string;
    limit?: number;
    skip?: number;
    offset?: number;
  }): Promise<{ logs: ReceivedPostback[]; total: number }> {
    try {
      const response = await axios.get(`${API_BASE_URL}/received-postbacks`, {
        headers: this.getAuthHeaders(),
        params
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch received postbacks');
    }
  }

  async getReceivedPostbackDetail(logId: string): Promise<ReceivedPostback> {
    try {
      const response = await axios.get(`${API_BASE_URL}/received-postbacks/${logId}`, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch postback detail');
    }
  }

  async bulkDeleteReceivedPostbacks(logIds: string[]): Promise<{ message: string; deleted_count: number }> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/received-postbacks/bulk-delete`,
        { log_ids: logIds },
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to delete postbacks');
    }
  }

  async generateQuickPostback(parameters: string[], customParams: string[], partnerName: string): Promise<{
    unique_key: string;
    base_url: string;
    full_url: string;
    parameters: string[];
    partner_name: string;
  }> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/postback-receiver/generate-quick`,
        { parameters, custom_params: customParams, partner_name: partnerName },
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to generate quick postback URL');
    }
  }

  async testQuickPostback(uniqueKey: string, params: Record<string, any>): Promise<{ test_url: string }> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/postback-receiver/test-quick`,
        { unique_key: uniqueKey, params },
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to test quick postback');
    }
  }

  async testPostbackReceiver(uniqueKey: string, params: Record<string, any>): Promise<{ test_url: string }> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/postback-receiver/test`,
        { unique_key: uniqueKey, params },
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to test postback receiver');
    }
  }
}

export const postbackReceiverApi = new PostbackReceiverApi();
