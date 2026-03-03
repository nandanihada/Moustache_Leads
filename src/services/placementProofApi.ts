import { API_BASE_URL } from './apiConfig';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('token')}`,
});

export const placementProofApi = {
  async submitProof(data: {
    offer_id: string;
    offer_name: string;
    description: string;
    placement_url: string;
    traffic_source: string;
    base64_images: string[];
  }) {
    const res = await fetch(`${API_BASE_URL}/api/placement-proofs/submit`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to submit proof');
    }
    return res.json();
  },

  async getMyProofs(page = 1, perPage = 20) {
    const res = await fetch(
      `${API_BASE_URL}/api/placement-proofs/my-proofs?page=${page}&per_page=${perPage}`,
      { headers: getHeaders() }
    );
    if (!res.ok) throw new Error('Failed to fetch proofs');
    return res.json();
  },

  async checkProof(offerId: string) {
    const res = await fetch(
      `${API_BASE_URL}/api/placement-proofs/check/${offerId}`,
      { headers: getHeaders() }
    );
    if (!res.ok) throw new Error('Failed to check proof');
    return res.json();
  },

  // Admin
  async getAllProofs(page = 1, perPage = 20, status = 'all') {
    const res = await fetch(
      `${API_BASE_URL}/api/placement-proofs/admin/all?page=${page}&per_page=${perPage}&status=${status}`,
      { headers: getHeaders() }
    );
    if (!res.ok) throw new Error('Failed to fetch proofs');
    return res.json();
  },

  async reviewProof(proofId: string, status: 'approved' | 'rejected', adminNotes = '', score = 0) {
    const res = await fetch(
      `${API_BASE_URL}/api/placement-proofs/admin/${proofId}/review`,
      {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status, admin_notes: adminNotes, score }),
      }
    );
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to review proof');
    }
    return res.json();
  },
};
