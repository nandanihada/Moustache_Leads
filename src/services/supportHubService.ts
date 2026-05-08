// Support Hub Service for cross-channel messaging
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export interface SupportTemplate {
  _id?: string;
  name: string;
  category: string;
  body: string;
}

export interface SupportConversation {
  _id: string;
  user_id: string;
  channel: string;
  last_message_at: string;
  unread_count: number;
  status: string;
}

export interface SupportMessage {
  _id: string;
  conversation_id: string;
  sender_type: 'admin' | 'user';
  body: string;
  channel: string;
  timestamp: string;
}

class SupportHubService {
  private baseUrl: string = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  private getHeaders() {
    const token = localStorage.getItem('token');
    return { 'Authorization': `Bearer ${token}` };
  }

  setBaseUrl(url: string) {
    this.baseUrl = url;
  }

  async getTemplates(): Promise<SupportTemplate[]> {
    const response = await axios.get(`${this.baseUrl}/api/admin/support/templates`, {
      headers: this.getHeaders()
    });
    return response.data;
  }

  async getConversations(): Promise<SupportConversation[]> {
    const response = await axios.get(`${this.baseUrl}/api/admin/support/conversations`, {
      headers: this.getHeaders()
    });
    return response.data;
  }

  async bulkSend(userIds: string[], templateId: string, channel: string, scheduledTime?: string): Promise<any> {
    const response = await axios.post(`${this.baseUrl}/api/admin/support/bulk-send`, {
      user_ids: userIds,
      template_id: templateId,
      channel: channel,
      scheduled_at: scheduledTime
    }, {
      headers: this.getHeaders()
    });
    return response.data;
  }

  async getMessages(convId: string): Promise<SupportMessage[]> {
    const response = await axios.get(`${this.baseUrl}/api/admin/support/conversations/${convId}/messages`, {
      headers: this.getHeaders()
    });
    return response.data;
  }

  async sendReply(convId: string, body: string): Promise<SupportMessage> {
    const response = await axios.post(`${this.baseUrl}/api/admin/support/conversations/${convId}/messages`, {
      body
    }, {
      headers: this.getHeaders()
    });
    return response.data;
  }
}

export const supportHubService = new SupportHubService();
