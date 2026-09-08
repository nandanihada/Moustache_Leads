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

// ── Pepperwahl Email Settings ──────────────────────────────────────────────

export interface PepperwahlEmailSettings {
  enabled: boolean;
  template_style: 'table' | 'card';
  payout_type: 'publisher' | 'admin';
  visible_fields: string[];
  see_more_fields: string[];
  default_image: string;
  payment_terms: string;
  recipient_mode: 'all' | 'include' | 'exclude';
  recipient_ids: string[];
  custom_message: string;
}

export async function fetchPepperwahlEmailSettings(): Promise<{ success: boolean; settings: PepperwahlEmailSettings }> {
  const res = await fetch(`${PW_BASE()}/email-settings`, { headers: headers() });
  return res.json();
}

export async function savePepperwahlEmailSettings(settings: Partial<PepperwahlEmailSettings>) {
  const res = await fetch(`${PW_BASE()}/email-settings`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(settings),
  });
  return res.json();
}

// ── Description Refinement ─────────────────────────────────────────────────

const REFINE_BASE = () => `${getApiBaseUrl()}/api/admin/surveys/refine`;

export interface RefinementSourceStat {
  source: string;
  total: number;
  refined: number;
  unrefined: number;
}

export interface RefinementStats {
  total: number;
  refined: number;
  unrefined: number;
  pct_refined: number;
  sources: RefinementSourceStat[];
}

export interface RefinementOffer {
  _id: string;
  offer_id: string;
  name: string;
  description: string;
  description_raw?: string;
  description_override?: string;
  description_preview?: string;   // present on unrefined list — what the new desc will look like
  description_refined_at?: string;
  description_refined_by?: string;
  vertical?: string;
  category?: string;
  countries?: string[];
  import_source?: string;
  offer_source?: string;
  source?: string;
  payout?: number;
  updated_at?: string;
}

/** GET /api/admin/surveys/refine/stats */
export async function fetchRefineStats(): Promise<{ success: boolean; stats: RefinementStats }> {
  const res = await fetch(`${REFINE_BASE()}/stats`, { headers: headers() });
  return res.json();
}

/** GET /api/admin/surveys/refine/unrefined?page=&per_page= */
export async function fetchUnrefinedOffers(params: { page?: number; per_page?: number } = {}): Promise<{
  success: boolean;
  offers: RefinementOffer[];
  total: number;
  page: number;
}> {
  const qs = new URLSearchParams();
  if (params.page)     qs.set('page',     String(params.page));
  if (params.per_page) qs.set('per_page', String(params.per_page));
  const res = await fetch(`${REFINE_BASE()}/unrefined?${qs}`, { headers: headers() });
  return res.json();
}

/** GET /api/admin/surveys/refine/refined?page=&per_page= */
export async function fetchRefinedOffers(params: { page?: number; per_page?: number } = {}): Promise<{
  success: boolean;
  offers: RefinementOffer[];
  total: number;
  page: number;
}> {
  const qs = new URLSearchParams();
  if (params.page)     qs.set('page',     String(params.page));
  if (params.per_page) qs.set('per_page', String(params.per_page));
  const res = await fetch(`${REFINE_BASE()}/refined?${qs}`, { headers: headers() });
  return res.json();
}

/** POST /api/admin/surveys/refine/all — refine all unrefined offers */
export async function refineAllDescriptions(): Promise<{
  success: boolean;
  total_pending: number;
  refined: number;
  errors: string[];
}> {
  const res = await fetch(`${REFINE_BASE()}/all`, {
    method: 'POST',
    headers: headers(),
  });
  return res.json();
}

/** POST /api/admin/surveys/refine/:offer_id — refine a single offer */
export async function refineOneDescription(offerId: string): Promise<{
  success: boolean;
  offer_id: string;
  description: string;
  error?: string;
}> {
  const res = await fetch(`${REFINE_BASE()}/${encodeURIComponent(offerId)}`, {
    method: 'POST',
    headers: headers(),
  });
  return res.json();
}

/** DELETE /api/admin/surveys/refine/:offer_id — reset a refined offer back to unrefined */
export async function resetRefinement(offerId: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  const res = await fetch(`${REFINE_BASE()}/${encodeURIComponent(offerId)}`, {
    method: 'DELETE',
    headers: headers(),
  });
  return res.json();
}
