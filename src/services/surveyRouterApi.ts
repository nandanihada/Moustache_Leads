import { getApiBaseUrl } from './apiConfig';
import { getAuthToken } from '@/utils/cookies';

const baseUrl = getApiBaseUrl();

function authHeaders() {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ─── Types ───────────────────────────────────────────────────────────

export interface SurveyProvider {
  provider_id: string;
  name: string;
  base_url: string;
  scenario: 'same_tab' | 'new_tab';
  is_own_website: boolean;
  postback_param_mapping: Record<string, string>;
  redirect_url_template: string;
  surveys: ProviderSurvey[];
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProviderSurvey {
  survey_id: string;
  name: string;
  url: string;
  payout?: number;
  countries?: string[];
}

export interface RouterSession {
  session_id: string;
  user_id: string;
  funnel_id: string;
  status: string;
  total_payout: number;
  attempts: RouterAttempt[];
  current_attempt: RouterAttempt;
  created_at: string;
  updated_at: string;
}

export interface RouterAttempt {
  attempt_id: string;
  provider_id: string;
  provider_name: string;
  survey_id: string;
  survey_name: string;
  redirect_url: string;
  status: 'pending' | 'completed' | 'failed' | 'quota_full';
  payout: number;
  transaction_id: string;
  redirected_at: string;
  postback_received_at: string | null;
  completed_at: string | null;
}

export interface RouterStats {
  total_sessions: number;
  completed: number;
  failed: number;
  in_progress: number;
  total_payout: number;
  completion_rate: number;
}

// ─── Admin: Providers ────────────────────────────────────────────────

export async function getProviders(): Promise<{ providers: SurveyProvider[] }> {
  const res = await fetch(`${baseUrl}/api/admin/survey-router/providers`, {
    headers: authHeaders(),
  });
  return res.json();
}

export async function createProvider(data: Partial<SurveyProvider>): Promise<{ success: boolean; provider_id: string }> {
  const res = await fetch(`${baseUrl}/api/admin/survey-router/providers`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateProvider(providerId: string, data: Partial<SurveyProvider>): Promise<{ success: boolean }> {
  const res = await fetch(`${baseUrl}/api/admin/survey-router/providers/${providerId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteProvider(providerId: string): Promise<{ success: boolean }> {
  const res = await fetch(`${baseUrl}/api/admin/survey-router/providers/${providerId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return res.json();
}

// ─── Admin: Sessions & Stats ─────────────────────────────────────────

export async function getRouterSessions(page = 1, status = ''): Promise<{ sessions: RouterSession[]; total: number }> {
  const params = new URLSearchParams({ page: String(page) });
  if (status) params.set('status', status);
  const res = await fetch(`${baseUrl}/api/admin/survey-router/sessions?${params}`, {
    headers: authHeaders(),
  });
  return res.json();
}

export async function getRouterStats(): Promise<{ stats: RouterStats }> {
  const res = await fetch(`${baseUrl}/api/admin/survey-router/stats`, {
    headers: authHeaders(),
  });
  return res.json();
}

// ─── Public: Start session ───────────────────────────────────────────

export async function startRouterSession(data: {
  user_id: string;
  funnel_id?: string;
  qualification_answers?: any[];
  partner_id?: string;
  redirect_url?: string;
  scenario?: string;
}): Promise<{
  success: boolean;
  session_id: string;
  attempt_id: string;
  redirect_url: string;
  scenario: 'same_tab' | 'new_tab';
  partner_name: string;
}> {
  const res = await fetch(`${baseUrl}/api/survey-router/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

// ─── Public: Poll status ─────────────────────────────────────────────

export async function pollRouterStatus(sessionId: string, attemptId?: string): Promise<{
  status: 'pending' | 'completed' | 'failed' | 'quota_full' | 'not_found';
  payout: number;
  provider_name: string;
  survey_name: string;
  session_status: string;
  total_payout: number;
}> {
  const params = new URLSearchParams({ session_id: sessionId });
  if (attemptId) params.set('attempt_id', attemptId);
  const res = await fetch(`${baseUrl}/api/survey-router/status?${params}`);
  return res.json();
}

// ─── Public: Route to next survey ────────────────────────────────────

export async function routeToNext(sessionId: string): Promise<{
  success: boolean;
  exhausted?: boolean;
  attempt_id?: string;
  redirect_url?: string;
  scenario?: 'same_tab' | 'new_tab';
  provider_name?: string;
  survey_name?: string;
  message?: string;
}> {
  const res = await fetch(`${baseUrl}/api/survey-router/next`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
  });
  return res.json();
}
