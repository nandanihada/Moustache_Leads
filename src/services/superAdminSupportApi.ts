import { getApiBaseUrl } from './apiConfig';
import { getAuthToken } from '@/utils/cookies';

const base = () => getApiBaseUrl();
const h = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getAuthToken()}`,
});

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StaffThread {
  subadmin_id: string;
  username: string;
  email: string;
  thread_id: string;
  last_message: string;
  last_at: string | null;
  unread: number;
}

export interface StaffMessage {
  _id: string;
  thread_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  text: string;
  seen: boolean;
  seen_at: string | null;
  created_at: string;
}

export interface SmartQuestionConfig {
  _id: string;
  name: string;
  email: string;
  website: string;
  enabled: boolean;
  delay_seconds: number;
  questions: SmartQuestion[];
  ready_count?: number;
  refine_count?: number;
  total?: number;
  user_exists?: boolean;
  created_at?: string;
}

export interface SmartQuestion {
  _id: string;
  raw_note: string;
  question_text: string;
  answer_type: 'text' | 'choice' | 'yesno';
  options: string[];
  status: 'ready' | 'refine';
  order: number;
}

export interface OfferCheckResult {
  searched_term: string;
  offer_id?: string;
  name?: string;
  status?: string;
  payout?: number;
  countries?: string[];
  vertical?: string;
  via?: string;
  // Intelligence fields
  total_clicks?: number;
  total_conversions?: number;
  total_revenue?: number;
  cvr?: number;
  publishers?: { publisher: string; conversions: number; revenue: number; placements: string[] }[];
  geo_breakdown?: { country: string; count: number }[];
  recent_conversions?: {
    conversion_id: string; click_id: string; publisher: string;
    payout: number; country: string; device: string;
    status: string; verified: boolean; source: string; time: string;
  }[];
  recent_clicks?: {
    click_id: string; publisher_id: string; geo: string;
    device: string; fraud_score: number; placement_id: string; time: string;
  }[];
}

export interface QuickLink {
  _id: string;
  title: string;
  url: string;
  description: string;
  created_by: string;
  created_at: string;
}

export interface IntakeSession {
  _id: string;
  user_id: string;
  username: string;
  email: string;
  topic: string;
  status: 'submitted' | 'abandoned';
  answers: Record<string, string>;
  abandoned_at_question: string;
  created_at: string;
}

export interface ActivityLogEntry {
  _id: string;
  actor_id: string;
  actor_name: string;
  actor_role: string;
  action: string;
  details: string;
  ticket_id: string | null;
  created_at: string;
}

export interface TeamMember {
  user_id: string;
  username: string;
  email: string;
  permissions: Record<string, boolean>;
  granted: number;
  total: number;
}

export interface SupportSettings {
  auto_close_enabled: boolean;
  auto_close_min: number;
  user_warn_min: number;
  admin_warn_min: number;
  smart_questions_enabled: boolean;
  sq_delay_sec: number;
}

// ── Staff Chat ────────────────────────────────────────────────────────────────

export const staffChatApi = {
  getThreads: async (): Promise<{ success: boolean; threads: StaffThread[] }> => {
    const r = await fetch(`${base()}/api/superadmin/staff-chat/threads`, { headers: h() });
    return r.json();
  },
  getMessages: async (threadId: string): Promise<{ success: boolean; messages: StaffMessage[] }> => {
    const r = await fetch(`${base()}/api/superadmin/staff-chat/${threadId}/messages`, { headers: h() });
    return r.json();
  },
  sendMessage: async (threadId: string, text: string): Promise<{ success: boolean; message: StaffMessage }> => {
    const r = await fetch(`${base()}/api/superadmin/staff-chat/${threadId}/messages`, {
      method: 'POST', headers: h(), body: JSON.stringify({ text }),
    });
    return r.json();
  },
  // Subadmin side
  myGetMessages: async (): Promise<{ success: boolean; messages: StaffMessage[]; thread_id: string }> => {
    const r = await fetch(`${base()}/api/staff-chat/my-thread/messages`, { headers: h() });
    return r.json();
  },
  mySendMessage: async (text: string): Promise<{ success: boolean; message: StaffMessage }> => {
    const r = await fetch(`${base()}/api/staff-chat/my-thread/messages`, {
      method: 'POST', headers: h(), body: JSON.stringify({ text }),
    });
    return r.json();
  },
};

// ── Smart Questions ───────────────────────────────────────────────────────────

export const smartQuestionsApi = {
  list: async (search = ''): Promise<{ success: boolean; configs: SmartQuestionConfig[] }> => {
    const q = search ? `?q=${encodeURIComponent(search)}` : '';
    const r = await fetch(`${base()}/api/superadmin/smart-questions${q}`, { headers: h() });
    return r.json();
  },
  get: async (id: string): Promise<{ success: boolean; config: SmartQuestionConfig }> => {
    const r = await fetch(`${base()}/api/superadmin/smart-questions/${id}`, { headers: h() });
    return r.json();
  },
  create: async (data: { name: string; email: string; website: string; raw_notes: string }): Promise<{ success: boolean; config: SmartQuestionConfig }> => {
    const r = await fetch(`${base()}/api/superadmin/smart-questions`, {
      method: 'POST', headers: h(), body: JSON.stringify(data),
    });
    return r.json();
  },
  update: async (id: string, data: Partial<SmartQuestionConfig>): Promise<{ success: boolean }> => {
    const r = await fetch(`${base()}/api/superadmin/smart-questions/${id}`, {
      method: 'PUT', headers: h(), body: JSON.stringify(data),
    });
    return r.json();
  },
  delete: async (id: string): Promise<{ success: boolean }> => {
    const r = await fetch(`${base()}/api/superadmin/smart-questions/${id}`, { method: 'DELETE', headers: h() });
    return r.json();
  },
  addQuestion: async (configId: string, q: Partial<SmartQuestion>): Promise<{ success: boolean; question: SmartQuestion }> => {
    const r = await fetch(`${base()}/api/superadmin/smart-questions/${configId}/questions`, {
      method: 'POST', headers: h(), body: JSON.stringify(q),
    });
    return r.json();
  },
  updateQuestion: async (configId: string, qId: string, data: Partial<SmartQuestion>): Promise<{ success: boolean }> => {
    const r = await fetch(`${base()}/api/superadmin/smart-questions/${configId}/questions/${qId}`, {
      method: 'PUT', headers: h(), body: JSON.stringify(data),
    });
    return r.json();
  },
  deleteQuestion: async (configId: string, qId: string): Promise<{ success: boolean }> => {
    const r = await fetch(`${base()}/api/superadmin/smart-questions/${configId}/questions/${qId}`, {
      method: 'DELETE', headers: h(),
    });
    return r.json();
  },
};

// ── Offer Check ───────────────────────────────────────────────────────────────

export const offerCheckApi = {
  check: async (text: string, matchGeo = false): Promise<{
    success: boolean;
    detected_format: string;
    rows_read: number;
    results: OfferCheckResult[];
    missing: { searched_term: string }[];
  }> => {
    const r = await fetch(`${base()}/api/superadmin/offer-check`, {
      method: 'POST', headers: h(), body: JSON.stringify({ text, match_geo: matchGeo }),
    });
    return r.json();
  },
};

// ── Quick Links ───────────────────────────────────────────────────────────────

export const quickLinksApi = {
  list: async (): Promise<{ success: boolean; links: QuickLink[] }> => {
    const r = await fetch(`${base()}/api/superadmin/quick-links`, { headers: h() });
    return r.json();
  },
  create: async (data: { title: string; url: string; description: string }): Promise<{ success: boolean; link: QuickLink }> => {
    const r = await fetch(`${base()}/api/superadmin/quick-links`, {
      method: 'POST', headers: h(), body: JSON.stringify(data),
    });
    return r.json();
  },
  update: async (id: string, data: { title: string; url: string; description: string }): Promise<{ success: boolean }> => {
    const r = await fetch(`${base()}/api/superadmin/quick-links/${id}`, {
      method: 'PUT', headers: h(), body: JSON.stringify(data),
    });
    return r.json();
  },
  delete: async (id: string): Promise<{ success: boolean }> => {
    const r = await fetch(`${base()}/api/superadmin/quick-links/${id}`, { method: 'DELETE', headers: h() });
    return r.json();
  },
};

// ── Submitted Data ────────────────────────────────────────────────────────────

export const submittedDataApi = {
  list: async (params: { page?: number; topic?: string; status?: string; q?: string } = {}): Promise<{
    success: boolean; sessions: IntakeSession[]; total: number; page: number;
  }> => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.topic) qs.set('topic', params.topic);
    if (params.status) qs.set('status', params.status);
    if (params.q) qs.set('q', params.q);
    const r = await fetch(`${base()}/api/superadmin/submitted-data?${qs}`, { headers: h() });
    return r.json();
  },
  save: async (data: { topic: string; status: string; answers: Record<string, string>; abandoned_at_question?: string }): Promise<{ success: boolean }> => {
    const r = await fetch(`${base()}/api/support/intake-session`, {
      method: 'POST', headers: h(), body: JSON.stringify(data),
    });
    return r.json();
  },
};

// ── Activity Log ──────────────────────────────────────────────────────────────

export const activityLogApi = {
  list: async (params: { page?: number; person?: string; action?: string; days?: number; q?: string } = {}): Promise<{
    success: boolean; logs: ActivityLogEntry[]; total: number;
  }> => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.person) qs.set('person', params.person);
    if (params.action) qs.set('action', params.action);
    if (params.days) qs.set('days', String(params.days));
    if (params.q) qs.set('q', params.q);
    const r = await fetch(`${base()}/api/superadmin/activity-log?${qs}`, { headers: h() });
    return r.json();
  },
};

// ── Team Permissions ──────────────────────────────────────────────────────────

export const teamPermissionsApi = {
  list: async (): Promise<{ success: boolean; team: TeamMember[]; permission_keys: string[] }> => {
    const r = await fetch(`${base()}/api/superadmin/team-permissions`, { headers: h() });
    return r.json();
  },
  updateOne: async (userId: string, key: string, value: boolean): Promise<{ success: boolean }> => {
    const r = await fetch(`${base()}/api/superadmin/team-permissions/${userId}`, {
      method: 'PUT', headers: h(), body: JSON.stringify({ key, value }),
    });
    return r.json();
  },
  addAdmin: async (userId: string): Promise<{ success: boolean; username: string }> => {
    const r = await fetch(`${base()}/api/superadmin/team-permissions/add-admin`, {
      method: 'POST', headers: h(), body: JSON.stringify({ user_id: userId }),
    });
    return r.json();
  },
  searchUsers: async (q: string): Promise<{ users: { _id: string; username: string; email: string; role: string }[] }> => {
    const r = await fetch(`${base()}/api/admin/users?search=${encodeURIComponent(q)}&limit=10`, { headers: h() });
    return r.json();
  },
};

export interface SharedNote {
  _id: string;
  text: string;
  author_id: string;
  author_name: string;
  author_role: string;
  created_at: string;
}

// ── Shared notes (readable/writable by all admins+subadmins) ──────────────────

export const sharedNotesApi = {
  list: async (): Promise<{ success: boolean; notes: SharedNote[] }> => {
    const r = await fetch(`${base()}/api/support/shared-notes`, { headers: h() });
    return r.json();
  },
  add: async (text: string): Promise<{ success: boolean; note: SharedNote }> => {
    const r = await fetch(`${base()}/api/support/shared-notes`, {
      method: 'POST', headers: h(), body: JSON.stringify({ text }),
    });
    return r.json();
  },
  delete: async (id: string): Promise<{ success: boolean }> => {
    const r = await fetch(`${base()}/api/support/shared-notes/${id}`, { method: 'DELETE', headers: h() });
    return r.json();
  },
};

// ── Subadmin: view Smart Questions (read-only) ────────────────────────────────

export const subadminSupportApi = {
  listSmartQuestions: async (): Promise<{ success: boolean; configs: SmartQuestionConfig[] }> => {
    const r = await fetch(`${base()}/api/support/smart-questions-view`, { headers: h() });
    return r.json();
  },
  getMyAssignments: async (): Promise<{ success: boolean; tickets: any[] }> => {
    const r = await fetch(`${base()}/api/support/my-assignments`, { headers: h() });
    return r.json();
  },
};

// ── Settings ──────────────────────────────────────────────────────────────────

export const supportSettingsApi = {
  get: async (): Promise<{ success: boolean; settings: SupportSettings }> => {
    const r = await fetch(`${base()}/api/superadmin/support-settings`, { headers: h() });
    return r.json();
  },
  update: async (settings: Partial<SupportSettings>): Promise<{ success: boolean }> => {
    const r = await fetch(`${base()}/api/superadmin/support-settings`, {
      method: 'PUT', headers: h(), body: JSON.stringify(settings),
    });
    return r.json();
  },
};
