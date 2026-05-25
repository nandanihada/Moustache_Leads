import { getApiBaseUrl } from "./apiConfig";
import { getAuthToken } from "@/utils/cookies";

const API_BASE = getApiBaseUrl();

function getHeaders() {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export interface AutoActivationStats {
  total_activations: number;
  active: number;
  expired: number;
  total_offers_sent: number;
  unique_users: number;
  total_clicks: number;
  settings: AutoActivationSettings;
}

export interface AutoActivationSettings {
  enabled: boolean;
  delay_hours: number;
  max_offers: number;
  grant_duration_days: number;
}

export interface ActivationOffer {
  offer_id: string;
  name: string;
  category: string;
  vertical: string;
  payout: number;
  network: string;
}

export interface Activation {
  _id: string;
  user_id: string;
  username: string;
  keywords: string[];
  offer_ids: string[];
  offers: ActivationOffer[];
  trigger: string;
  trigger_reason: string;
  status: string;
  activated_at: string;
  expires_at: string;
  clicks: number;
  last_click_at: string | null;
  deactivated_at: string | null;
  deactivation_reason: string | null;
  search_count: number;
  delay_hours: number;
  grant_duration_days: number;
}

export interface UserGrant {
  _id: string;
  offer_id: string;
  source: string;
  granted_by: string;
  granted_at: string;
  expires_at: string;
  is_active: boolean;
  clicked: boolean;
  click_date: string | null;
}

// Get dashboard stats
export async function getAutoActivationStats(): Promise<AutoActivationStats> {
  const res = await fetch(`${API_BASE}/api/admin/per-user-offers/stats`, {
    headers: getHeaders(),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Failed to fetch stats");
  return data;
}

// Get paginated activations list
export async function getActivations(params: {
  page?: number;
  per_page?: number;
  status?: string;
  user?: string;
  trigger?: string;
  date_from?: string;
  date_to?: string;
}): Promise<{ activations: Activation[]; total: number; pagination: any }> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set("page", String(params.page));
  if (params.per_page) searchParams.set("per_page", String(params.per_page));
  if (params.status) searchParams.set("status", params.status);
  if (params.user) searchParams.set("user", params.user);
  if (params.trigger) searchParams.set("trigger", params.trigger);
  if (params.date_from) searchParams.set("date_from", params.date_from);
  if (params.date_to) searchParams.set("date_to", params.date_to);

  const res = await fetch(
    `${API_BASE}/api/admin/per-user-offers/activations?${searchParams}`,
    { headers: getHeaders() }
  );
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Failed to fetch activations");
  return data;
}

// Get activations for a specific user
export async function getUserActivations(userId: string): Promise<{
  activations: Activation[];
  grants: UserGrant[];
}> {
  const res = await fetch(
    `${API_BASE}/api/admin/per-user-offers/user/${userId}`,
    { headers: getHeaders() }
  );
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Failed to fetch user activations");
  return data;
}

// Get settings
export async function getAutoActivationSettings(): Promise<AutoActivationSettings> {
  const res = await fetch(`${API_BASE}/api/admin/per-user-offers/settings`, {
    headers: getHeaders(),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Failed to fetch settings");
  return data.settings;
}

// Update settings
export async function updateAutoActivationSettings(
  settings: Partial<AutoActivationSettings>
): Promise<AutoActivationSettings> {
  const res = await fetch(`${API_BASE}/api/admin/per-user-offers/settings`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(settings),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Failed to update settings");
  return data.settings;
}

// Deactivate an activation
export async function deactivateActivation(activationId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/admin/per-user-offers/deactivate/${activationId}`,
    { method: "POST", headers: getHeaders() }
  );
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Failed to deactivate");
}

// Manual activate offers for a user
export async function manualActivateOffers(params: {
  user_id: string;
  offer_ids: string[];
  reason?: string;
}): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/admin/per-user-offers/manual-activate`,
    {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(params),
    }
  );
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Failed to activate");
}

// Run the service immediately (manual trigger)
export async function runAutoActivationNow(): Promise<{ offers_activated: number }> {
  const res = await fetch(`${API_BASE}/api/admin/per-user-offers/run-now`, {
    method: "POST",
    headers: getHeaders(),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Failed to run");
  return data;
}
