// Support Hub Service for cross-channel messaging
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export interface SupportTemplate {
  _id?: string;
  name: string;
  category: string;
  subject?: string;
  body: string;
}

export interface SupportConversation {
  _id: string;
  user_id: string;
  channel: string;
  last_message_at: string;
  unread_count: number;
  status: string;
  last_sender?: 'admin' | 'user';
  last_message_body?: string;
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

  async createTemplate(template: SupportTemplate): Promise<SupportTemplate> {
    const response = await axios.post(`${this.baseUrl}/api/admin/support/templates`, template, {
      headers: this.getHeaders()
    });
    return response.data;
  }

  async updateTemplate(id: string, template: Partial<SupportTemplate>): Promise<any> {
    const response = await axios.put(`${this.baseUrl}/api/admin/support/templates/${id}`, template, {
      headers: this.getHeaders()
    });
    return response.data;
  }

  async deleteTemplate(id: string): Promise<any> {
    const response = await axios.delete(`${this.baseUrl}/api/admin/support/templates/${id}`, {
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

  async bulkSend(userIds: string[], templateId: string, channel: string, scheduledTime?: string, emailSettings?: any, messagePrefix?: string): Promise<any> {
    const response = await axios.post(`${this.baseUrl}/api/admin/support/bulk-send`, {
      user_ids: userIds,
      template_id: templateId,
      channel: channel,
      scheduled_at: scheduledTime,
      email_settings: emailSettings,
      message_prefix: messagePrefix
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

  async getSettings(): Promise<any> {
    const response = await axios.get(`${this.baseUrl}/api/admin/support/settings`, {
      headers: this.getHeaders()
    });
    return response.data;
  }

  async updateSettings(settings: any): Promise<any> {
    const response = await axios.post(`${this.baseUrl}/api/admin/support/settings`, settings, {
      headers: this.getHeaders()
    });
    return response.data;
  }

  async sendOutreach(userId: string, subject: string, body: string, channel: string, scheduledAt?: string, emailSettings?: any): Promise<any> {
    const response = await axios.post(`${this.baseUrl}/api/admin/support/send`, {
      user_id: userId,
      subject,
      body,
      channel,
      scheduled_at: scheduledAt,
      email_settings: emailSettings
    }, {
      headers: this.getHeaders()
    });
    return response.data;
  }

  async verifyConnection(channel: string): Promise<any> {
    const response = await axios.post(`${this.baseUrl}/api/admin/support/verify-connection`, {
      channel
    }, {
      headers: this.getHeaders()
    });
    return response.data;
  }

  async searchContacts(channel: string, query: string): Promise<any> {
    const response = await axios.get(`${this.baseUrl}/api/admin/support/search-contacts`, {
      params: { channel, query },
      headers: this.getHeaders()
    });
    return response.data;
  }

  async mapContact(userId: string, channel: string, contactInfo: any): Promise<any> {
    const response = await axios.post(`${this.baseUrl}/api/admin/support/map-contact`, {
      user_id: userId,
      channel,
      contact_info: contactInfo
    }, {
      headers: this.getHeaders()
    });
    return response.data;
  }
}

export const supportHubService = new SupportHubService();
