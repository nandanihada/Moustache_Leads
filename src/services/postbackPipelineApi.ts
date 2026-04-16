import { getApiBaseUrl } from './apiConfig';

const API = `${getApiBaseUrl()}/api/admin`;

function authHeaders() {
  return { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
}

export const postbackPipelineApi = {
  async getStats(days = 30) {
    const res = await fetch(`${API}/postback-pipeline/stats?days=${days}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch pipeline stats');
    return res.json();
  },

  async runCleanup(dryRun = true) {
    const res = await fetch(`${API}/postback-pipeline/cleanup`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ dry_run: dryRun })
    });
    if (!res.ok) throw new Error('Failed to run cleanup');
    return res.json();
  },

  async getReceivedPostbacks(params: { limit?: number; skip?: number; partner_id?: string } = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined) searchParams.append(k, String(v)); });
    const res = await fetch(`${API}/received-postbacks?${searchParams}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch received postbacks');
    return res.json();
  }
};
