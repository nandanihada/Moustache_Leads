import { getApiBaseUrl } from "@/services/apiConfig";
import { getAuthToken } from "@/utils/cookies";

const API_BASE = getApiBaseUrl();

function getHeaders() {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchLinkHealthStats() {
  const res = await fetch(`${API_BASE}/api/admin/link-health/stats`, {
    headers: getHeaders(),
  });
  return res.json();
}

export async function fetchLinkHealthOffers(params: {
  status?: string;
  page?: number;
  limit?: number;
  search?: string;
  network?: string;
}) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.search) query.set("search", params.search);
  if (params.network) query.set("network", params.network);

  const res = await fetch(
    `${API_BASE}/api/admin/link-health/offers?${query.toString()}`,
    { headers: getHeaders() }
  );
  return res.json();
}

export async function checkSingleOffer(offerId: string) {
  const res = await fetch(
    `${API_BASE}/api/admin/link-health/check/${offerId}`,
    { method: "POST", headers: getHeaders() }
  );
  return res.json();
}

export async function checkBulkOffers(offerIds: string[]) {
  const res = await fetch(`${API_BASE}/api/admin/link-health/check-bulk`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ offer_ids: offerIds }),
  });
  return res.json();
}

export async function fetchNetworksWithIssues(all: boolean = true) {
  const res = await fetch(`${API_BASE}/api/admin/link-health/networks?all=${all}`, {
    headers: getHeaders(),
  });
  return res.json();
}
