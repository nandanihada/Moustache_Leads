import axios from 'axios';

import { API_BASE_URL as BASE_URL } from './apiConfig';
const API_BASE_URL = `${BASE_URL}/api/admin`;

export interface PostbackLog {
  _id?: string;
  log_id: string;
  postback_id: string;
  conversion_id: string;
  partner_id: string;
  partner_name: string;
  offer_id: string;
  url: string;
  method: string;
  status: 'success' | 'failed';
  response_code: number;
  response_body: string;
  attempts: number;
  error_message: string;
  sent_at: string;
  created_at: string;
}

export interface PostbackStats {
  total_sent: number;
  total_failed: number;
  total: number;
  success_rate: number;
  partner_stats: Array<{
    _id: string;
    partner_name: string;
    total: number;
    success: number;
    failed: number;
  }>;
}

export interface PostbackLogsResponse {
  logs: PostbackLog[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

class PostbackLogsApi {
  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  async getPostbackLogs(params: {
    page?: number;
    limit?: number;
    status?: string;
    partner_id?: string;
    offer_id?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<PostbackLogsResponse> {
    try {
      const response = await axios.get(`${API_BASE_URL}/postback-logs`, {
        headers: this.getAuthHeaders(),
        params
      });
      return response.data;
    } catch (error: any) {
      console.error('Error fetching postback logs:', error);
      throw error.response?.data || error;
    }
  }

  async getPostbackStats(params?: {
    date_from?: string;
    date_to?: string;
  }): Promise<PostbackStats> {
    try {
      const response = await axios.get(`${API_BASE_URL}/postback-logs/stats`, {
        headers: this.getAuthHeaders(),
        params
      });
      return response.data;
    } catch (error: any) {
      console.error('Error fetching postback stats:', error);
      throw error.response?.data || error;
    }
  }

  async retryPostback(logId: string): Promise<{ message: string; postback_id: string }> {
    try {
      const response = await axios.post(`${API_BASE_URL}/postback-logs/${logId}/retry`, {}, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error: any) {
      console.error('Error retrying postback:', error);
      throw error.response?.data || error;
    }
  }

  async getPostbackLogDetails(logId: string): Promise<{ log: PostbackLog }> {
    try {
      const response = await axios.get(`${API_BASE_URL}/postback-logs/${logId}`, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error: any) {
      console.error('Error fetching postback log details:', error);
      throw error.response?.data || error;
    }
  }

  async bulkDeletePostbackLogs(logIds: string[]): Promise<{ message: string; deleted_count: number }> {
    try {
      const response = await axios.post(`${API_BASE_URL}/postback-logs/bulk-delete`, 
        { log_ids: logIds },
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error bulk deleting postback logs:', error);
      throw error.response?.data || error;
    }
  }

  async bulkDeleteForwardedLogs(logIds: string[]): Promise<{ message: string; deleted_count: number }> {
    try {
      const response = await axios.post(`${API_BASE_URL}/partner-distribution-logs/bulk-delete`, 
        { log_ids: logIds },
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error bulk deleting forwarded logs:', error);
      throw error.response?.data || error;
    }
  }
}

export const postbackLogsApi = new PostbackLogsApi();
