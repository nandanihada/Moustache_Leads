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

export interface RedirectDestination {
  url: string;
  name: string;
  weight: number;
  geo?: string[];
  devices?: string[];
}

export interface RedirectConditions {
  geo: string[];
  devices: string[];
  time_range: { start_hour?: number; end_hour?: number };
  day_of_week: string[];
  user_agent_contains: string;
}

export interface RedirectRoute {
  route_id: string;
  name: string;
  description: string;
  offer_id: string;
  status: string;
  conditions: RedirectConditions;
  destinations: RedirectDestination[];
  fallback_url: string;
  stats: {
    clicks: number;
    conversions: number;
    last_click_at?: string;
    destination_stats: Record<string, { clicks: number; conversions: number }>;
  };
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface RouteStats {
  route_id: string;
  total_clicks: number;
  total_conversions: number;
  destination_stats: Record<string, { clicks: number; conversions: number }>;
  daily_clicks: Array<{ date: string; clicks: number }>;
  geo_breakdown: Record<string, number>;
  device_breakdown: Record<string, number>;
}

// Get all routes
export async function getRedirectRoutes(params?: {
  status?: string;
  search?: string;
  page?: number;
  per_page?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.per_page) searchParams.set('per_page', String(params.per_page));

  const res = await fetch(`${API_BASE}/api/admin/redirect-router/routes?${searchParams}`, {
    headers: getHeaders(),
  });
  return res.json();
}

// Get single route
export async function getRedirectRoute(routeId: string) {
  const res = await fetch(`${API_BASE}/api/admin/redirect-router/routes/${routeId}`, {
    headers: getHeaders(),
  });
  return res.json();
}

// Create route
export async function createRedirectRoute(data: {
  name: string;
  description?: string;
  offer_id?: string;
  status?: string;
  conditions?: Partial<RedirectConditions>;
  destinations: RedirectDestination[];
  fallback_url?: string;
}) {
  const res = await fetch(`${API_BASE}/api/admin/redirect-router/routes`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
}

// Update route
export async function updateRedirectRoute(routeId: string, data: Partial<RedirectRoute>) {
  const res = await fetch(`${API_BASE}/api/admin/redirect-router/routes/${routeId}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
}

// Delete route
export async function deleteRedirectRoute(routeId: string) {
  const res = await fetch(`${API_BASE}/api/admin/redirect-router/routes/${routeId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  return res.json();
}

// Duplicate route
export async function duplicateRedirectRoute(routeId: string) {
  const res = await fetch(`${API_BASE}/api/admin/redirect-router/routes/${routeId}/duplicate`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return res.json();
}

// Get overall stats
export async function getRedirectRouterStats() {
  const res = await fetch(`${API_BASE}/api/admin/redirect-router/stats`, {
    headers: getHeaders(),
  });
  return res.json();
}

// Get route-specific stats
export async function getRedirectRouteStats(routeId: string, days?: number) {
  const params = days ? `?days=${days}` : '';
  const res = await fetch(`${API_BASE}/api/admin/redirect-router/routes/${routeId}/stats${params}`, {
    headers: getHeaders(),
  });
  return res.json();
}
