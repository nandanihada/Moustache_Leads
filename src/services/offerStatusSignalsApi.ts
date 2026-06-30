/**
 * Offer Status Signals API Service
 * Handles API calls for the offer status signals admin panel
 */
import { getApiBaseUrl } from './apiConfig';
import { getAuthToken } from '@/utils/cookies';

const API_BASE_URL = getApiBaseUrl();

export interface OfferStatusSignal {
  _id: string;
  network: string;
  offer_id_received: string;
  status_received: string;
  raw_params: Record<string, string>;
  matched_offer_id: string | null;
  matched_offer_name: string | null;
  current_status: string | null;
  suggested_status: string | null;
  applied: boolean;
  applied_at: string | null;
  applied_status?: string;
  ignored: boolean;
  received_at: string;
  ip: string;
}

export interface SignalsResponse {
  signals: OfferStatusSignal[];
  total: number;
  pending_count: number;
  networks: string[];
  page: number;
  limit: number;
}

export interface SignalStats {
  pending: number;
  applied: number;
  ignored: number;
  total: number;
}

function getHeaders(): HeadersInit {
  const token = getAuthToken() || localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

export const offerStatusSignalsApi = {
  async getSignals(params: {
    page?: number;
    limit?: number;
    network?: string;
    status?: string;
    search?: string;
  } = {}): Promise<SignalsResponse> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.network) query.set('network', params.network);
    if (params.status) query.set('status', params.status);
    if (params.search) query.set('search', params.search);

    const res = await fetch(`${API_BASE_URL}/api/admin/offer-status-signals?${query}`, {
      headers: getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async getStats(): Promise<SignalStats> {
    const res = await fetch(`${API_BASE_URL}/api/admin/offer-status-signals/stats`, {
      headers: getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async applySignals(signalIds: string[], targetStatus: string): Promise<{ success: boolean; applied: number }> {
    const res = await fetch(`${API_BASE_URL}/api/admin/offer-status-signals/apply`, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify({ signal_ids: signalIds, target_status: targetStatus }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async ignoreSignals(signalIds: string[]): Promise<{ success: boolean; ignored: number }> {
    const res = await fetch(`${API_BASE_URL}/api/admin/offer-status-signals/ignore`, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify({ signal_ids: signalIds }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
};
