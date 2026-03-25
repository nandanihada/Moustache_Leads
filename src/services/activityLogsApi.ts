import { getApiBaseUrl } from "./apiConfig";
import { getAuthToken } from "@/utils/cookies";

const API_BASE = () => `${getApiBaseUrl()}/api/admin`;

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getAuthToken()}`,
});

export interface ActivityLog {
  _id: string;
  action: string;
  category: string;
  admin_id: string;
  admin_username: string;
  details: Record<string, any>;
  affected_items: Array<Record<string, any>>;
  affected_count: number;
  ip_address: string;
  timestamp: string;
}

export interface ActivityLogsResponse {
  success: boolean;
  logs: ActivityLog[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface ActivityLogsFilters {
  page?: number;
  per_page?: number;
  category?: string;
  action?: string;
  admin?: string;
  network?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  sort_field?: string;
  sort_order?: number;
}

export async function fetchActivityLogs(filters: ActivityLogsFilters = {}): Promise<ActivityLogsResponse> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.append(key, String(value));
  });

  const res = await fetch(`${API_BASE()}/activity-logs?${params}`, { headers: headers() });
  if (!res.ok) throw new Error("Failed to fetch activity logs");
  return res.json();
}

export async function deleteActivityLogs(logIds: string[]): Promise<{ success: boolean; deleted_count: number }> {
  const res = await fetch(`${API_BASE()}/activity-logs`, {
    method: "DELETE",
    headers: headers(),
    body: JSON.stringify({ log_ids: logIds }),
  });
  if (!res.ok) throw new Error("Failed to delete activity logs");
  return res.json();
}

export async function fetchFilterOptions(): Promise<{
  success: boolean;
  categories: string[];
  actions: string[];
  admins: string[];
}> {
  const res = await fetch(`${API_BASE()}/activity-logs/filters`, { headers: headers() });
  if (!res.ok) throw new Error("Failed to fetch filter options");
  return res.json();
}


export interface RotationOffer {
  offer_id: string;
  name: string;
  network: string;
  payout: number;
  payout_type: string;
  status: string;
  category: string;
  countries: string[];
  clicks: number;
  conversions: number;
  last_click: string | null;
  is_running: boolean;
  rotation_activated_at: string | null;
  rotation_batch_index: number;
  created_at: string;
  updated_at: string;
  image_url: string;
}

export interface RotationBatchResponse {
  offers: RotationOffer[];
  total: number;
  rotation_info: {
    enabled: boolean;
    batch_index: number;
    batch_activated_at: string | null;
    window_minutes: number;
    time_remaining_seconds: number | null;
    next_rotation_at: string | null;
    inactive_pool_count: number;
    running_count: number;
  };
}

export async function fetchRotationBatchDetails(): Promise<RotationBatchResponse> {
  const res = await fetch(`${getApiBaseUrl()}/api/admin/offers/rotation/current-batch-details`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error("Failed to fetch rotation batch details");
  return res.json();
}


export interface EmailLog {
  _id: string;
  action: string;
  source: string;
  offer_ids: string[];
  offer_names: string[];
  offer_count: number;
  recipient_type: string;
  recipient_count: number;
  batch_count: number;
  offers_per_email: number;
  scheduled_time?: string | null;
  admin_id: string;
  admin_username: string;
  created_at: string;
}

export interface EmailLogsResponse {
  logs: EmailLog[];
  total: number;
  pages: number;
  page: number;
}

export async function fetchEmailActivityLogs(params: {
  page?: number;
  per_page?: number;
  source?: string;
}): Promise<EmailLogsResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set("page", String(params.page));
  if (params.per_page) searchParams.set("per_page", String(params.per_page));
  if (params.source) searchParams.set("source", params.source);

  const res = await fetch(
    `${getApiBaseUrl()}/api/admin/offers/email-activity-logs?${searchParams}`,
    { headers: headers() }
  );
  if (!res.ok) throw new Error("Failed to fetch email activity logs");
  return res.json();
}
