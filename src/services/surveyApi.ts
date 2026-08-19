/**
 * Survey Gateway API Service
 * Admin CRUD, assignment, analytics for bot-detection surveys.
 */
import { getApiBaseUrl } from './apiConfig';
import { getAuthToken } from '@/utils/cookies';

const BASE = () => `${getApiBaseUrl()}/api/admin/surveys`;

const headers = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getAuthToken()}`,
});

// ── Types ──────────────────────────────────────────────────────────────

export interface SurveyQuestion {
  type: 'multiple_choice' | 'yes_no' | 'short_text' | 'rating';
  question: string;
  options?: string[];
  required: boolean;
}

export interface SurveyData {
  _id?: string;
  name: string;
  description: string;
  category: string;
  questions: SurveyQuestion[];
  captcha_enabled: boolean;
  template?: string;
  questions_per_page?: number;
  is_active?: boolean;
  created_at?: string;
  total_responses?: number;
  total_passed?: number;
  total_failed?: number;
  total_abandoned?: number;
  avg_completion_time?: number;
}

export interface SurveyAssignment {
  _id: string;
  offer_id: string;
  survey_id: string;
  assigned_by: string;
  assignment_type: string;
  assigned_at: string;
}

// ── Survey CRUD ────────────────────────────────────────────────────────

export async function fetchSurveys(params: Record<string, string | number> = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) qs.set(k, String(v));
  });
  const res = await fetch(`${BASE()}?${qs}`, { headers: headers() });
  return res.json();
}

export async function fetchSurvey(id: string) {
  const res = await fetch(`${BASE()}/${id}`, { headers: headers() });
  return res.json();
}

export async function createSurvey(data: Partial<SurveyData>) {
  const res = await fetch(BASE(), {
    method: 'POST', headers: headers(), body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateSurvey(id: string, data: Partial<SurveyData>) {
  const res = await fetch(`${BASE()}/${id}`, {
    method: 'PUT', headers: headers(), body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteSurvey(id: string) {
  const res = await fetch(`${BASE()}/${id}`, {
    method: 'DELETE', headers: headers(),
  });
  return res.json();
}

// ── Assignments ────────────────────────────────────────────────────────

export async function fetchAssignments(params: Record<string, string | number> = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) qs.set(k, String(v));
  });
  const res = await fetch(`${BASE()}/assignments?${qs}`, { headers: headers() });
  return res.json();
}

export async function assignSurvey(surveyId: string, offerIds: string[]) {
  const res = await fetch(`${BASE()}/assign`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ survey_id: surveyId, offer_ids: offerIds }),
  });
  return res.json();
}

export async function unassignSurvey(offerId: string) {
  const res = await fetch(`${BASE()}/unassign`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ offer_id: offerId }),
  });
  return res.json();
}

// ── Analytics ──────────────────────────────────────────────────────────

export async function fetchSurveyAnalytics(params: Record<string, string | number> = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) qs.set(k, String(v));
  });
  const res = await fetch(`${BASE()}/analytics?${qs}`, { headers: headers() });
  return res.json();
}

export async function fetchOfferCoverage() {
  const res = await fetch(`${BASE()}/offer-coverage`, { headers: headers() });
  return res.json();
}

export async function previewSurvey(id: string) {
  const res = await fetch(`${BASE()}/preview/${id}`, { headers: headers() });
  return res.json();
}

export async function fetchResponseDetail(responseId: string) {
  const res = await fetch(`${BASE()}/response/${responseId}`, { headers: headers() });
  return res.json();
}

export async function seedSurveys() {
  const res = await fetch(`${BASE()}/seed`, {
    method: 'POST', headers: headers(),
  });
  return res.json();
}


// ── Pepperwahl Integration ─────────────────────────────────────────────

const PW_BASE = () => `${getApiBaseUrl()}/api/admin/pepperwahl`;

export interface PepperwahlQuestion {
  question: string;
  options: string[];
  qualify_if: string[];
}

export interface PepperwahlInboxEntry {
  _id: string;
  status: 'pending' | 'processed' | 'active' | 'paused' | 'deleted';
  received_at: string;
  processed_at?: string;
  payout: number;
  moustache_survey_id?: string;
  moustache_offer_id?: string;
  survey_action?: string;
  offer_action?: string;
  source_ip?: string;
  payload: {
    survey_id: string;
    survey_name: string;
    survey_link: string;
    questions: PepperwahlQuestion[];
    country?: string;
    loi_minutes?: number;
    topic?: string;
  };
  offer_details?: {
    name: string;
    status: string;
    payout: number;
    hits: number;
  };
}

export interface PepperwahlStats {
  total: number;
  pending: number;
  processed: number;
  active: number;
  paused: number;
  active_offers: number;
  total_payout_exposure: number;
}

export async function fetchPepperwahlInbox(params: Record<string, string | number> = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) qs.set(k, String(v));
  });
  const res = await fetch(`${PW_BASE()}/inbox?${qs}`, { headers: headers() });
  return res.json();
}

export async function fetchPepperwahlEntry(id: string) {
  const res = await fetch(`${PW_BASE()}/inbox/${id}`, { headers: headers() });
  return res.json();
}

export async function processPepperwahlEntry(id: string) {
  const res = await fetch(`${PW_BASE()}/process/${id}`, {
    method: 'POST', headers: headers(),
  });
  return res.json();
}

export async function setPepperwahlPayout(id: string, payout: number) {
  const res = await fetch(`${PW_BASE()}/inbox/${id}/payout`, {
    method: 'PUT', headers: headers(), body: JSON.stringify({ payout }),
  });
  return res.json();
}

export async function setPepperwahlStatus(id: string, status: 'active' | 'paused') {
  const res = await fetch(`${PW_BASE()}/inbox/${id}/status`, {
    method: 'PUT', headers: headers(), body: JSON.stringify({ status }),
  });
  return res.json();
}

export async function deletePepperwahlEntry(id: string) {
  const res = await fetch(`${PW_BASE()}/inbox/${id}`, {
    method: 'DELETE', headers: headers(),
  });
  return res.json();
}

export async function fetchPepperwahlStats() {
  const res = await fetch(`${PW_BASE()}/stats`, { headers: headers() });
  return res.json();
}
