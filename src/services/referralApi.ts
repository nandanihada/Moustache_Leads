/**
 * Referral API Service
 * Handles all referral-related API calls for both user and admin panels.
 */

import { getApiBaseUrl } from './apiConfig';
import { getAuthToken } from '@/utils/cookies';

const API_BASE_URL = getApiBaseUrl();

function authHeaders() {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

// ─── User Endpoints ───

export async function getMyReferralLink() {
  const res = await fetch(`${API_BASE_URL}/api/referral/my-link`, { headers: authHeaders() });
  return res.json();
}

export async function getP1Stats() {
  const res = await fetch(`${API_BASE_URL}/api/referral/p1/stats`, { headers: authHeaders() });
  return res.json();
}

export async function getP1Referrals() {
  const res = await fetch(`${API_BASE_URL}/api/referral/p1/list`, { headers: authHeaders() });
  return res.json();
}

export async function getP2Stats() {
  const res = await fetch(`${API_BASE_URL}/api/referral/p2/stats`, { headers: authHeaders() });
  return res.json();
}

export async function getP2Referrals() {
  const res = await fetch(`${API_BASE_URL}/api/referral/p2/list`, { headers: authHeaders() });
  return res.json();
}

// ─── Registration (called during signup) ───

export async function registerReferral(data: {
  referral_code: string;
  referred_user_id: string;
  referred_email: string;
  referred_username: string;
  device_fingerprint?: string;
}) {
  const res = await fetch(`${API_BASE_URL}/api/referral/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

// ─── Admin Endpoints ───

export async function getAdminP1Stats() {
  const res = await fetch(`${API_BASE_URL}/api/admin/referrals/p1/stats`, { headers: authHeaders() });
  return res.json();
}

export async function getAdminP1Countries() {
  const res = await fetch(`${API_BASE_URL}/api/admin/referrals/p1/countries`, { headers: authHeaders() });
  return res.json();
}

export interface AdminP1ListParams {
  page?: number;
  per_page?: number;
  status?: string;
  fraud_score_min?: number;
  fraud_score_max?: number;
  search?: string;
  country?: string;
}

export async function getAdminP1List(params: AdminP1ListParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.per_page) query.set('per_page', String(params.per_page));
  if (params.status) query.set('status', params.status);
  if (params.fraud_score_min !== undefined) query.set('fraud_score_min', String(params.fraud_score_min));
  if (params.fraud_score_max !== undefined) query.set('fraud_score_max', String(params.fraud_score_max));
  if (params.search) query.set('search', params.search);
  if (params.country) query.set('country', params.country);

  const res = await fetch(`${API_BASE_URL}/api/admin/referrals/p1/list?${query}`, { headers: authHeaders() });
  return res.json();
}

export async function approveP1Referral(referralId: string) {
  const res = await fetch(`${API_BASE_URL}/api/admin/referrals/p1/${referralId}/approve`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return res.json();
}

export async function rejectP1Referral(referralId: string) {
  const res = await fetch(`${API_BASE_URL}/api/admin/referrals/p1/${referralId}/reject`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return res.json();
}

export async function holdP1Referral(referralId: string) {
  const res = await fetch(`${API_BASE_URL}/api/admin/referrals/p1/${referralId}/hold`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return res.json();
}

export async function bulkActionP1(action: 'approve' | 'reject' | 'hold', referralIds: string[]) {
  const res = await fetch(`${API_BASE_URL}/api/admin/referrals/p1/bulk-action`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ action, referral_ids: referralIds }),
  });
  return res.json();
}
