import { getApiBaseUrl } from './apiConfig';
import { getAuthToken } from '@/utils/cookies';

const base = () => getApiBaseUrl();
const headers = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getAuthToken()}`,
});

export interface SupportReply {
  _id: string;
  text: string;
  from: 'admin' | 'user';
  created_at: string;
}

export interface SupportMessage {
  _id: string;
  user_id: string;
  username: string;
  email: string;
  subject: string;
  body: string;
  status: 'open' | 'replied' | 'closed';
  replies: SupportReply[];
  created_at: string;
  updated_at: string;
  read_by_admin: boolean;
}

export const supportApi = {
  // Publisher
  sendMessage: async (subject: string, body: string) => {
    const res = await fetch(`${base()}/api/support/messages`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ subject, body }),
    });
    return res.json();
  },

  getMyMessages: async (): Promise<{ success: boolean; messages: SupportMessage[] }> => {
    const res = await fetch(`${base()}/api/support/messages`, { headers: headers() });
    return res.json();
  },

  // Admin
  adminGetAll: async (status = 'all'): Promise<{ success: boolean; messages: SupportMessage[] }> => {
    const res = await fetch(`${base()}/api/admin/support/messages?status=${status}`, { headers: headers() });
    return res.json();
  },

  adminReply: async (messageId: string, reply: string) => {
    const res = await fetch(`${base()}/api/admin/support/messages/${messageId}/reply`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ reply }),
    });
    return res.json();
  },

  adminMarkRead: async (messageId: string) => {
    const res = await fetch(`${base()}/api/admin/support/messages/${messageId}/read`, {
      method: 'PUT',
      headers: headers(),
    });
    return res.json();
  },
};
