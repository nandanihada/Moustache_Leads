/**
 * Login Logs Service
 * API service for login logs, active sessions, and activity tracking
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface LoginLog {
  _id: string;
  user_id: string;
  email: string;
  username: string;
  login_time: string;
  logout_time?: string;
  ip_address: string;
  device: {
    type: string;
    os: string;
    browser: string;
    version: string;
    is_mobile: boolean;
    is_tablet: boolean;
    is_pc: boolean;
    is_bot: boolean;
  };
  location: {
    ip: string;
    city: string;
    region: string;
    country: string;
    country_code: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
    isp?: string;
  };
  login_method: 'password' | 'otp' | 'sso';
  status: 'success' | 'failed';
  failure_reason?: string;
  session_id?: string;
  user_agent: string;
  created_at: string;
  // Fraud detection fields
  vpn_detection?: {
    is_vpn?: boolean;
    is_proxy?: boolean;
    is_tor?: boolean;
    is_datacenter?: boolean;
    is_relay?: boolean;  // IPinfo: Relay detection (e.g., Apple Private Relay)
    provider?: string;
    service?: string;  // IPinfo: VPN/Proxy service name
    confidence?: string;
    country_code?: string;
    checked_at?: string;
  };
  device_fingerprint?: string;
  device_change_detected?: boolean;
  session_frequency?: {
    logins_last_hour?: number;
    logins_last_day?: number;
    risk_level?: string;
  };
  fraud_score?: number;
  risk_level?: string;
  fraud_flags?: string[];
  fraud_recommendations?: string[];
}

export interface ActiveSession {
  _id: string;
  session_id: string;
  user_id: string;
  email: string;
  username: string;
  current_page: string;
  last_activity: string;
  idle_time: number;
  idle_time_formatted: string;
  ip_address: string;
  location: {
    ip: string;
    city: string;
    region: string;
    country: string;
    country_code: string;
  };
  device: {
    type: string;
    os: string;
    browser: string;
  };
  is_active: boolean;
  activity_level: 'active' | 'normal' | 'idle' | 'suspicious';
  login_time: string;
  updated_at: string;
  is_suspicious?: boolean;
  suspicious_reason?: string;
}

export interface PageVisit {
  _id: string;
  session_id: string;
  user_id: string;
  page_url: string;
  page_title: string;
  referrer: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  device: {
    type: string;
    os: string;
    browser: string;
  };
  ip_address: string;
  timestamp: string;
  time_spent: number;
  time_ago: string;
  created_at: string;
}

export interface LoginLogsFilters {
  page?: number;
  limit?: number;
  status?: 'success' | 'failed';
  user_id?: string;
  email?: string;
  login_method?: 'password' | 'otp' | 'sso';
  ip_address?: string;
  start_date?: string;
  end_date?: string;
  sort_by?: string;
  sort_order?: number;
}

export interface LoginLogsResponse {
  logs: LoginLog[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface LoginStats {
  total_logins: number;
  successful_logins: number;
  failed_logins: number;
  success_rate: number;
  unique_users: number;
  login_methods: Array<{ _id: string; count: number }>;
  top_locations: Array<{ _id: string; count: number }>;
  top_devices: Array<{ _id: string; count: number }>;
  date_range: {
    start: string;
    end: string;
  };
}

export interface SessionStats {
  total_active_sessions: number;
  unique_active_users: number;
  activity_levels: {
    active: number;
    normal: number;
    idle: number;
    suspicious: number;
  };
  average_session_duration: number;
  average_session_duration_formatted: string;
}

export interface ActivityOverview {
  login_stats: LoginStats;
  session_stats: SessionStats;
  popular_pages: Array<{
    page_url: string;
    count: number;
    unique_users: number;
  }>;
}

class LoginLogsService {
  /**
   * Get login logs with filters
   */
  async getLoginLogs(filters: LoginLogsFilters = {}): Promise<LoginLogsResponse> {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });

    const response = await api.get(`/api/admin/login-logs?${params.toString()}`);
    return response.data;
  }

  /**
   * Get specific login log by ID
   */
  async getLoginLog(logId: string): Promise<LoginLog> {
    const response = await api.get(`/api/admin/login-logs/${logId}`);
    return response.data;
  }

  /**
   * Get login history for a user
   */
  async getUserLoginHistory(userId: string, limit: number = 50): Promise<{ logs: LoginLog[] }> {
    const response = await api.get(`/api/admin/login-logs/user/${userId}?limit=${limit}`);
    return response.data;
  }

  /**
   * Get login statistics
   */
  async getLoginStats(startDate?: string, endDate?: string): Promise<LoginStats> {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    const response = await api.get(`/api/admin/login-logs/stats?${params.toString()}`);
    return response.data;
  }

  /**
   * Get failed login attempts
   */
  async getFailedAttempts(userId?: string, hours: number = 24): Promise<{ attempts: LoginLog[] }> {
    const params = new URLSearchParams();
    if (userId) params.append('user_id', userId);
    params.append('hours', hours.toString());

    const response = await api.get(`/api/admin/login-logs/failed-attempts?${params.toString()}`);
    return response.data;
  }

  /**
   * Get all active sessions
   */
  async getActiveSessions(includeIdle: boolean = true): Promise<{ sessions: ActiveSession[]; count: number }> {
    const response = await api.get(`/api/admin/active-sessions?include_idle=${includeIdle}`);
    return response.data;
  }

  /**
   * Get specific session
   */
  async getSession(sessionId: string): Promise<ActiveSession> {
    const response = await api.get(`/api/admin/active-sessions/${sessionId}`);
    return response.data;
  }

  /**
   * Update session heartbeat
   */
  async updateHeartbeat(sessionId: string, currentPage?: string): Promise<{ message: string }> {
    const response = await api.post('/api/admin/active-sessions/heartbeat', {
      session_id: sessionId,
      current_page: currentPage,
    });
    return response.data;
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<SessionStats> {
    const response = await api.get('/api/admin/active-sessions/stats');
    return response.data;
  }

  /**
   * Get page visits for a session
   */
  async getPageVisits(sessionId: string, limit: number = 10): Promise<{ visits: PageVisit[] }> {
    const response = await api.get(`/api/admin/page-visits/${sessionId}?limit=${limit}`);
    return response.data;
  }

  /**
   * Track a page visit
   */
  async trackPageVisit(
    sessionId: string,
    pageUrl: string,
    pageTitle: string,
    referrer: string = ''
  ): Promise<{ message: string; visit_id: string }> {
    const response = await api.post('/api/admin/page-visits/track', {
      session_id: sessionId,
      page_url: pageUrl,
      page_title: pageTitle,
      referrer: referrer,
    });
    return response.data;
  }

  /**
   * Get popular pages
   */
  async getPopularPages(startDate?: string, endDate?: string, limit: number = 10): Promise<{ pages: any[] }> {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    params.append('limit', limit.toString());

    const response = await api.get(`/api/admin/page-visits/popular?${params.toString()}`);
    return response.data;
  }

  /**
   * Get comprehensive activity overview
   */
  async getActivityOverview(): Promise<ActivityOverview> {
    const response = await api.get('/api/admin/activity-stats/overview');
    return response.data;
  }

  /**
   * Export login logs to CSV
   */
  exportToCSV(logs: LoginLog[]): void {
    const headers = [
      'Date/Time',
      'User',
      'Email',
      'Status',
      'Method',
      'IP Address',
      'Location',
      'Device',
      'Browser',
      'Failure Reason',
    ];

    const rows = logs.map((log) => [
      new Date(log.login_time).toLocaleString(),
      log.username,
      log.email,
      log.status,
      log.login_method,
      log.ip_address,
      `${log.location.city}, ${log.location.country}`,
      `${log.device.type} - ${log.device.os}`,
      log.device.browser,
      log.failure_reason || 'N/A',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `login_logs_${new Date().toISOString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export const loginLogsService = new LoginLogsService();
export default loginLogsService;
