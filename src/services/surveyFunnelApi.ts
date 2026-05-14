import { getApiBaseUrl } from './apiConfig';
import { getAuthToken } from '@/utils/cookies';

const API_BASE = getApiBaseUrl();

function getHeaders() {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

export interface FunnelQuestion {
  text: string;
  options: string[];
}

export interface PassRule {
  question_index: number;
  accepted_answers: string[];
}

export interface PassCriteria {
  mode: 'any' | 'all' | 'min_count';
  min_count?: number;
  rules: PassRule[];
}

export interface FunnelStep {
  survey_title: string;
  questions: FunnelQuestion[];
  pass_criteria: PassCriteria;
  pass_url: string;
  pass_message?: string;
  fail_message?: string;
}

export interface SurveyFunnel {
  funnel_id: string;
  name: string;
  description: string;
  status: string;
  placement: string;
  placement_offer_id?: string;
  steps: FunnelStep[];
  fail_message: string;
  display_title?: string;
  display_description?: string;
  display_image_url?: string;
  display_payout?: number;
  display_category?: string;
  stats: { total_starts: number; total_passes: number; total_fails: number };
  created_at: string;
  updated_at: string;
}

export async function getSurveyFunnels(search?: string) {
  const params = search ? `?search=${encodeURIComponent(search)}` : '';
  const res = await fetch(`${API_BASE}/api/admin/survey-funnels${params}`, { headers: getHeaders() });
  return res.json();
}

export async function getSurveyFunnel(funnelId: string) {
  const res = await fetch(`${API_BASE}/api/admin/survey-funnels/${funnelId}`, { headers: getHeaders() });
  return res.json();
}

export async function createSurveyFunnel(data: Partial<SurveyFunnel>) {
  const res = await fetch(`${API_BASE}/api/admin/survey-funnels`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateSurveyFunnel(funnelId: string, data: Partial<SurveyFunnel>) {
  const res = await fetch(`${API_BASE}/api/admin/survey-funnels/${funnelId}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteSurveyFunnel(funnelId: string) {
  const res = await fetch(`${API_BASE}/api/admin/survey-funnels/${funnelId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  return res.json();
}

export async function getSurveyFunnelHistory(funnelId?: string, page?: number) {
  const params = new URLSearchParams();
  if (funnelId) params.set('funnel_id', funnelId);
  if (page) params.set('page', String(page));
  const res = await fetch(`${API_BASE}/api/admin/survey-funnels/history?${params}`, { headers: getHeaders() });
  return res.json();
}
