import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export interface SupportTemplate {
  _id?: string;
  name: string;
  category: string;
  body: string;
  created_at?: string;
}

export interface SupportConversation {
  _id: string;
  user_id: string;
  channel: 'Email' | 'Telegram' | 'Teams' | 'Chat';
  status: 'open' | 'closed';
  last_message_at: string;
  unread_count: number;
}

const getHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('token')}`,
  'Content-Type': 'application/json'
});

export const supportHubService = {
  getTemplates: async () => {
    const response = await axios.get(`${API_URL}/api/admin/support/hub/templates`, { headers: getHeaders() });
    return response.data.templates;
  },

  createTemplate: async (template: SupportTemplate) => {
    const response = await axios.post(`${API_URL}/api/admin/support/hub/templates`, template, { headers: getHeaders() });
    return response.data.template;
  },

  bulkSend: async (userIds: string[], templateId: string, channel: string) => {
    const response = await axios.post(`${API_URL}/api/admin/support/hub/send`, {
      user_ids: userIds,
      template_id: templateId,
      channel: channel
    }, { headers: getHeaders() });
    return response.data;
  },

  getConversations: async () => {
    const response = await axios.get(`${API_URL}/api/admin/support/hub/conversations`, { headers: getHeaders() });
    return response.data.conversations;
  }
};
