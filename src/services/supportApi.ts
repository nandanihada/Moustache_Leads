import { getApiBaseUrl } from './apiConfig';
import { getAuthToken } from '@/utils/cookies';

const base = () => getApiBaseUrl();
const headers = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getAuthToken()}`,
});

export type SupportTopic = 'postback' | 'iframe' | 'offers' | 'payment' | 'signup' | 'credit' | 'other';

export const TOPIC_LABELS: Record<SupportTopic, string> = {
  postback: 'Postback',
  iframe: 'iFrame',
  offers: 'Offers',
  payment: 'Payment',
  signup: 'Email / Sign-up',
  credit: 'Advertiser Credit',
  other: 'Other',
};

export const TOPIC_COLORS: Record<SupportTopic, string> = {
  postback: 'bg-blue-100 text-blue-700',
  iframe: 'bg-purple-100 text-purple-700',
  offers: 'bg-orange-100 text-orange-700',
  payment: 'bg-green-100 text-green-700',
  signup: 'bg-pink-100 text-pink-700',
  credit: 'bg-yellow-100 text-yellow-700',
  other: 'bg-gray-100 text-gray-600',
};

export interface SupportReply {
  _id: string;
  text: string;
  from: 'admin' | 'user' | 'system';
  image_url?: string | null;
  created_at: string;
  // Smart Question fields
  is_smart_question?: boolean;
  sq_question_id?: string;
  sq_config_id?: string;
  answer_type?: 'text' | 'choice' | 'yesno';
  options?: string[];
  answered?: boolean;
  // SQ answer fields
  is_sq_answer?: boolean;
  sq_reply_id?: string;
}

export interface SupportNote {
  _id: string;
  text: string;
  author_id: string;
  author_name: string;
  created_at: string;
}

export interface CannedReply {
  _id: string;
  title: string;
  text: string;
  created_by: string;
  created_at: string;
}

export interface SupportMessage {
  _id: string;
  user_id: string;
  username: string;
  email: string;
  subject: string;
  body: string;
  topic?: SupportTopic;
  status: 'open' | 'replied' | 'closed';
  replies: SupportReply[];
  notes?: SupportNote[];
  user_rating?: { thumbs: 'up' | 'down'; comment?: string; at: string } | null;
  created_at: string;
  updated_at: string;
  read_by_admin: boolean;
  read_by_user?: boolean;
  last_read_by_user_at?: string | null;
  last_read_by_admin_at?: string | null;
  admin_draft?: string;
  user_draft?: string;
  image_url?: string | null;
  is_broadcast?: boolean;
  is_admin_initiated?: boolean;
  source?: string;
  // Extended fields
  assignee_id?: string | null;
  assignee_name?: string | null;
  flagged?: boolean;
  sq_state?: Record<string, any>;
  intake_answers?: Record<string, string>;  // wizard answers stored on ticket
  scheduled_replies?: any[];
}

export interface SupportCounts {
  total: number;
  new: number;
  open: number;
  replied: number;
  closed: number;
  draft?: number;
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

  sendMessage: async (subject: string, body: string, imageUrl?: string, topic?: SupportTopic) => {
    const res = await fetch(`${base()}/api/support/messages`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ subject, body, image_url: imageUrl, topic: topic || 'other' }),
    });
    return res.json();
  },

  getMyMessages: async (): Promise<{ success: boolean; messages: SupportMessage[] }> => {
    const res = await fetch(`${base()}/api/support/messages`, { headers: headers() });
    return res.json();
  },

  userReply: async (messageId: string, reply: string, imageUrl?: string) => {
    const res = await fetch(`${base()}/api/support/messages/${messageId}/reply`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ reply, image_url: imageUrl }),
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

  // Alias used by SuperAdminSupport — fetches ALL messages regardless of status
  adminGetAllMessages: async (): Promise<{ success: boolean; messages: SupportMessage[] }> => {
    const res = await fetch(`${base()}/api/admin/support/messages?status=all&limit=200`, { headers: headers() });
    return res.json();
  },

  adminGetUnreadCount: async (): Promise<{ success: boolean; unread_count: number }> => {
    const res = await fetch(`${base()}/api/admin/support/unread-count`, { headers: headers() });
    return res.json();
  },

  adminReply: async (messageId: string, reply: string, imageUrl?: string) => {
    const res = await fetch(`${base()}/api/admin/support/messages/${messageId}/reply`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ reply, image_url: imageUrl }),
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

  adminDeleteMessage: async (messageId: string) => {
    const res = await fetch(`${base()}/api/admin/support/messages/${messageId}`, {
      method: 'DELETE',
      headers: headers(),
    });
    return res.json();
  },

  adminDeleteReply: async (messageId: string, replyId: string) => {
    const res = await fetch(`${base()}/api/admin/support/messages/${messageId}/replies/${replyId}`, {
      method: 'DELETE',
      headers: headers(),
    });
    return res.json();
  },

  adminBulkDeleteMessages: async (messageIds: string[]) => {
    const res = await fetch(`${base()}/api/admin/support/messages/bulk-delete`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ message_ids: messageIds }),
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

  uploadImage: async (file: File): Promise<{ success: boolean; image_url?: string; error?: string }> => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`${base()}/api/support/upload-image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getAuthToken()}` },
      body: formData,
    });
    return res.json();
  },

  saveDraft: async (messageId: string, draft: string) => {
    const res = await fetch(`${base()}/api/support/messages/${messageId}/draft`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ draft }),
    });
    return res.json();
  },

  deleteDraft: async (messageId: string) => {
    const res = await fetch(`${base()}/api/support/messages/${messageId}/draft`, {
      method: 'DELETE',
      headers: headers(),
    });
    return res.json();
  },

  // ── Publisher: rate a closed ticket ──

  rateTicket: async (messageId: string, thumbs: 'up' | 'down', comment?: string) => {
    const res = await fetch(`${base()}/api/support/messages/${messageId}/rate`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ thumbs, comment: comment || '' }),
    });
    return res.json();
  },

  // ── Admin: internal notes ──

  getNotes: async (messageId: string): Promise<{ success: boolean; notes: SupportNote[] }> => {
    const res = await fetch(`${base()}/api/admin/support/messages/${messageId}/notes`, { headers: headers() });
    return res.json();
  },

  addNote: async (messageId: string, text: string): Promise<{ success: boolean; note: SupportNote }> => {
    const res = await fetch(`${base()}/api/admin/support/messages/${messageId}/notes`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ text }),
    });
    return res.json();
  },

  deleteNote: async (messageId: string, noteId: string) => {
    const res = await fetch(`${base()}/api/admin/support/messages/${messageId}/notes/${noteId}`, {
      method: 'DELETE',
      headers: headers(),
    });
    return res.json();
  },

  // ── Admin: canned replies ──

  getCannedReplies: async (): Promise<{ success: boolean; canned_replies: CannedReply[] }> => {
    const res = await fetch(`${base()}/api/admin/support/canned-replies`, { headers: headers() });
    return res.json();
  },

  createCannedReply: async (title: string, text: string): Promise<{ success: boolean; canned_reply: CannedReply }> => {
    const res = await fetch(`${base()}/api/admin/support/canned-replies`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ title, text }),
    });
    return res.json();
  },

  updateCannedReply: async (id: string, title: string, text: string) => {
    const res = await fetch(`${base()}/api/admin/support/canned-replies/${id}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ title, text }),
    });
    return res.json();
  },

  deleteCannedReply: async (id: string) => {
    const res = await fetch(`${base()}/api/admin/support/canned-replies/${id}`, {
      method: 'DELETE',
      headers: headers(),
    });
    return res.json();
  },

  // ── Extended admin inbox features ──

  adminReopenTicket: async (messageId: string) => {
    const res = await fetch(`${base()}/api/admin/support/messages/${messageId}/reopen`, { method: 'PUT', headers: headers() });
    return res.json();
  },

  adminCloseV2: async (messageId: string) => {
    const res = await fetch(`${base()}/api/admin/support/messages/${messageId}/close-v2`, { method: 'PUT', headers: headers() });
    return res.json();
  },

  flagUser: async (userId: string, flagged: boolean, reason?: string) => {
    const res = await fetch(`${base()}/api/admin/support/users/${userId}/flag`, {
      method: 'PUT', headers: headers(), body: JSON.stringify({ flagged, reason: reason || '' }),
    });
    return res.json();
  },

  getFlagStatus: async (userId: string): Promise<{ success: boolean; flagged: boolean; flag_reason: string; flagged_at: string }> => {
    const res = await fetch(`${base()}/api/admin/support/users/${userId}/flag-status`, { headers: headers() });
    return res.json();
  },

  assignTicket: async (messageId: string, assigneeId: string | null, assigneeName: string) => {
    const res = await fetch(`${base()}/api/admin/support/messages/${messageId}/assign`, {
      method: 'PUT', headers: headers(), body: JSON.stringify({ assignee_id: assigneeId, assignee_name: assigneeName }),
    });
    return res.json();
  },

  getTeamMembers: async (): Promise<{ success: boolean; team: { _id: string; username: string; email: string; role: string }[] }> => {
    const res = await fetch(`${base()}/api/admin/support/team-members`, { headers: headers() });
    return res.json();
  },

  scheduleReply: async (messageId: string, text: string, sendAt: string, imageUrl?: string) => {
    const res = await fetch(`${base()}/api/admin/support/messages/${messageId}/schedule`, {
      method: 'POST', headers: headers(), body: JSON.stringify({ text, send_at: sendAt, image_url: imageUrl }),
    });
    return res.json();
  },

  getScheduledReplies: async (messageId: string) => {
    const res = await fetch(`${base()}/api/admin/support/messages/${messageId}/scheduled`, { headers: headers() });
    return res.json();
  },

  cancelScheduledReply: async (messageId: string, schedId: string) => {
    const res = await fetch(`${base()}/api/admin/support/messages/${messageId}/scheduled/${schedId}/cancel`, { method: 'PUT', headers: headers() });
    return res.json();
  },

  getTicketAudit: async (messageId: string): Promise<{ success: boolean; audit: { _id: string; actor_name: string; actor_role: string; action: string; detail: string; created_at: string }[] }> => {
    const res = await fetch(`${base()}/api/admin/support/messages/${messageId}/audit`, { headers: headers() });
    return res.json();
  },

  getPublisherProfile: async (userId: string) => {
    const res = await fetch(`${base()}/api/admin/support/publisher-profile/${userId}`, { headers: headers() });
    return res.json();
  },

  getDeletedReplies: async (messageId: string) => {
    const res = await fetch(`${base()}/api/admin/support/messages/${messageId}/deleted-replies`, { headers: headers() });
    return res.json();
  },

  softDeleteReply: async (messageId: string, replyId: string) => {
    const res = await fetch(`${base()}/api/admin/support/messages/${messageId}/replies/${replyId}/soft-delete`, { method: 'DELETE', headers: headers() });
    return res.json();
  },

  // ── Smart Questions: poll for new replies ──
  pollMessage: async (messageId: string, since?: string): Promise<{
    success: boolean;
    status: string;
    new_replies: SupportReply[];
    updated_at: string;
  }> => {
    const qs = since ? `?since=${encodeURIComponent(since)}` : '';
    const res = await fetch(`${base()}/api/support/messages/${messageId}/poll${qs}`, {
      headers: headers(),
    });
    return res.json();
  },

  // ── Smart Questions: publisher answers a SQ ──
  answerSmartQuestion: async (messageId: string, answer: string, sqReplyId: string): Promise<{
    success: boolean;
    reply: SupportReply;
  }> => {
    const res = await fetch(`${base()}/api/support/messages/${messageId}/sq-answer`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ answer, sq_reply_id: sqReplyId }),
    });
    return res.json();
  },

  // ── Wizard smart intake check ──
  intakeCheck: async (
    checkType: 'offer_id' | 'postback_url' | 'email' | 'payment',
    value: string
  ): Promise<{ ok: boolean; message: string; data?: Record<string, any> }> => {
    const res = await fetch(`${base()}/api/support/intake-check`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ check_type: checkType, value }),
    });
    return res.json();
  },
};
