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
  read_by_user?: boolean;
  is_broadcast?: boolean;
}

export interface SupportCounts {
  total: number;
  new: number;
  open: number;
  replied: number;
  closed: number;
}

export const supportApi = {
  // ── Publisher endpoints ──

  checkUnreadReplies: async (): Promise<{ success: boolean; unread_count: number; preview: string | null }> => {
    const res = await fetch(`${base()}/api/support/unread-replies`, { headers: headers() });
    return res.json();
  },

  getUnreadCount: async (): Promise<{ success: boolean; unread_count: number }> => {
    const res = await fetch(`${base()}/api/support/unread-count`, { headers: headers() });
    return res.json();
  },

  markRepliesRead: async () => {
    const res = await fetch(`${base()}/api/support/mark-read`, { method: 'PUT', headers: headers() });
    return res.json();
  },

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

  userReply: async (messageId: string, reply: string) => {
    const res = await fetch(`${base()}/api/support/messages/${messageId}/reply`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ reply }),
    });
    return res.json();
  },

  userCloseTicket: async (messageId: string) => {
    const res = await fetch(`${base()}/api/support/messages/${messageId}/close`, {
      method: 'PUT',
      headers: headers(),
    });
    return res.json();
  },

  // ── Admin endpoints ──

  adminGetAll: async (status = 'all'): Promise<{ success: boolean; messages: SupportMessage[]; counts?: SupportCounts }> => {
    const res = await fetch(`${base()}/api/admin/support/messages?status=${status}`, { headers: headers() });
    return res.json();
  },

  adminGetUnreadCount: async (): Promise<{ success: boolean; unread_count: number }> => {
    const res = await fetch(`${base()}/api/admin/support/unread-count`, { headers: headers() });
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

  adminCloseTicket: async (messageId: string) => {
    const res = await fetch(`${base()}/api/admin/support/messages/${messageId}/close`, {
      method: 'PUT',
      headers: headers(),
    });
    return res.json();
  },

  adminGetUsers: async (): Promise<{ success: boolean; users: { _id: string; username: string; email: string }[] }> => {
    const res = await fetch(`${base()}/api/admin/support/users`, { headers: headers() });
    return res.json();
  },

  adminBroadcast: async (subject: string, body: string, recipientIds: string[] | null) => {
    const res = await fetch(`${base()}/api/admin/support/broadcast`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ subject, body, recipient_ids: recipientIds }),
    });
    return res.json();
  },
};
