/**
 * Traffic Source API Service
 * 
 * Provides API calls for traffic source rule management.
 */

import { getApiBaseUrl } from './apiConfig';

const API_BASE_URL = `${getApiBaseUrl()}/api`;

// Types
export interface TrafficSourceRules {
  allowed: string[];
  risky: string[];
  disallowed: string[];
}

export interface CategoryDetail {
  name: string;
  allowed_count: number;
  risky_count: number;
  disallowed_count: number;
}

export interface CategoriesResponse {
  categories: string[];
  category_details: CategoryDetail[];
}

export interface AllTrafficSourcesResponse {
  traffic_sources: string[];
  total: number;
}

export interface CategoryRulesResponse {
  category: string;
  country: string | null;
  rules: TrafficSourceRules;
  has_country_adjustments: boolean;
}

export interface GenerateTrafficSourcesRequest {
  category: string;
  country?: string;
  overrides?: Partial<TrafficSourceRules>;
}

export interface GenerateTrafficSourcesResponse {
  category: string;
  country: string | null;
  has_overrides: boolean;
  rules: TrafficSourceRules;
}

export interface ValidateTrafficSourcesRequest {
  allowed: string[];
  risky: string[];
  disallowed: string[];
}

export interface ValidateTrafficSourcesResponse {
  valid: boolean;
  error: string | null;
}

export interface AllCategoryRulesResponse {
  rules: Record<string, TrafficSourceRules>;
  categories: string[];
}

// Helper to get auth headers
const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
};

/**
 * Get all valid offer categories with their traffic source defaults
 */
export const getCategories = async (): Promise<CategoriesResponse> => {
  const response = await fetch(`${API_BASE_URL}/traffic-sources/categories`, {
    method: 'GET',
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get categories');
  }

  return response.json();
};

/**
 * Get all available traffic sources
 */
export const getAllTrafficSources = async (): Promise<AllTrafficSourcesResponse> => {
  const response = await fetch(`${API_BASE_URL}/traffic-sources/all`, {
    method: 'GET',
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get traffic sources');
  }

  return response.json();
};

/**
 * Get traffic source rules for a specific category
 */
export const getCategoryRules = async (
  category: string,
  country?: string
): Promise<CategoryRulesResponse> => {
  const params = new URLSearchParams();
  if (country) {
    params.append('country', country);
  }

  const url = `${API_BASE_URL}/traffic-sources/rules/${encodeURIComponent(category)}${
    params.toString() ? `?${params.toString()}` : ''
  }`;

  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get category rules');
  }

  return response.json();
};

/**
 * Generate traffic sources for an offer
 */
export const generateTrafficSources = async (
  request: GenerateTrafficSourcesRequest
): Promise<GenerateTrafficSourcesResponse> => {
  const response = await fetch(`${API_BASE_URL}/traffic-sources/generate`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate traffic sources');
  }

  return response.json();
};

/**
 * Validate traffic source configuration
 */
export const validateTrafficSources = async (
  request: ValidateTrafficSourcesRequest
): Promise<ValidateTrafficSourcesResponse> => {
  const response = await fetch(`${API_BASE_URL}/traffic-sources/validate`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to validate traffic sources');
  }

  return response.json();
};

/**
 * Get traffic source rules for all categories
 */
export const getAllCategoryRules = async (): Promise<AllCategoryRulesResponse> => {
  const response = await fetch(`${API_BASE_URL}/traffic-sources/all-rules`, {
    method: 'GET',
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get all category rules');
  }

  return response.json();
};

// Default traffic source rules (client-side fallback)
export const DEFAULT_TRAFFIC_RULES: Record<string, TrafficSourceRules> = {
  HEALTH: {
    allowed: ['Search', 'Display', 'Native', 'Contextual', 'Email'],
    risky: ['Social', 'Video', 'Affiliate', 'Mobile'],
    disallowed: ['Adult', 'Incentivized', 'Pop', 'Redirect', 'Push', 'SMS', 'Brand Bidding', 'Fraud', 'Spam'],
  },
  SURVEY: {
    allowed: ['Email', 'Display', 'Social', 'Native', 'Mobile', 'Desktop', 'Push'],
    risky: ['Affiliate', 'Video', 'Contextual', 'Influencer'],
    disallowed: ['Adult', 'Pop', 'Redirect', 'Toolbar', 'Brand Bidding', 'Fraud', 'Spam'],
  },
  EDUCATION: {
    allowed: ['Search', 'Display', 'Email', 'Native', 'Contextual', 'Social', 'Desktop'],
    risky: ['Video', 'Affiliate', 'Mobile', 'Influencer'],
    disallowed: ['Adult', 'Incentivized', 'Pop', 'Redirect', 'Push', 'SMS', 'Brand Bidding', 'Fraud', 'Spam'],
  },
  INSURANCE: {
    allowed: ['Search', 'Display', 'Native', 'Contextual', 'Email', 'Desktop'],
    risky: ['Social', 'Affiliate', 'Mobile', 'Push'],
    disallowed: ['Adult', 'Incentivized', 'Pop', 'Redirect', 'Toolbar', 'SMS', 'Brand Bidding', 'Video', 'Fraud', 'Spam'],
  },
  LOAN: {
    allowed: ['Search', 'Display', 'Native', 'Contextual', 'Desktop'],
    risky: ['Email', 'Social', 'Affiliate', 'Mobile'],
    disallowed: ['Adult', 'Incentivized', 'Pop', 'Redirect', 'Toolbar', 'SMS', 'Brand Bidding', 'Push', 'Video', 'Fraud', 'Spam'],
  },
  FINANCE: {
    allowed: ['Search', 'Display', 'Native', 'Contextual', 'Email', 'Desktop'],
    risky: ['Social', 'Affiliate', 'Mobile', 'Push'],
    disallowed: ['Adult', 'Incentivized', 'Pop', 'Redirect', 'Toolbar', 'SMS', 'Brand Bidding', 'Fraud', 'Spam'],
  },
  DATING: {
    allowed: ['Display', 'Social', 'Native', 'Mobile', 'Push', 'Video'],
    risky: ['Email', 'Affiliate', 'Influencer', 'Contextual'],
    disallowed: ['Incentivized', 'Pop', 'Redirect', 'Toolbar', 'Brand Bidding', 'SMS', 'Fraud', 'Spam'],
  },
  FREE_TRIAL: {
    allowed: ['Email', 'Search', 'Display', 'Social', 'Native', 'Mobile', 'Desktop'],
    risky: ['Push', 'Video', 'Affiliate', 'Influencer'],
    disallowed: ['Adult', 'Pop', 'Redirect', 'Toolbar', 'Brand Bidding', 'SMS', 'Fraud', 'Spam'],
  },
  INSTALLS: {
    allowed: ['Display', 'Social', 'Mobile', 'Push', 'Native', 'Video', 'Influencer'],
    risky: ['Email', 'Affiliate', 'Contextual', 'Search'],
    disallowed: ['Adult', 'Pop', 'Redirect', 'Toolbar', 'Brand Bidding', 'Fraud', 'Spam'],
  },
  GAMES_INSTALL: {
    allowed: ['Display', 'Social', 'Video', 'Mobile', 'Influencer', 'Push', 'Native', 'Incentivized'],
    risky: ['Email', 'Affiliate', 'Pop', 'Contextual'],
    disallowed: ['Adult', 'Brand Bidding', 'Toolbar', 'Redirect', 'Fraud', 'Spam'],
  },
  OTHER: {
    allowed: ['Email', 'Search', 'Display', 'Native', 'Contextual', 'Social'],
    risky: ['Video', 'Affiliate', 'Mobile', 'Push', 'Influencer'],
    disallowed: ['Adult', 'Incentivized', 'Pop', 'Redirect', 'Toolbar', 'Brand Bidding', 'Fraud', 'Spam'],
  },
};

/**
 * Get default traffic rules for a category (client-side fallback)
 */
export const getDefaultRulesForCategory = (category: string): TrafficSourceRules => {
  const normalized = category?.toUpperCase() || 'OTHER';
  return DEFAULT_TRAFFIC_RULES[normalized] || DEFAULT_TRAFFIC_RULES['OTHER'];
};

/**
 * All available traffic sources
 */
export const ALL_TRAFFIC_SOURCES = [
  'Email',
  'Search',
  'Display',
  'Push',
  'Native',
  'Social',
  'Video',
  'Mobile',
  'Desktop',
  'Contextual',
  'Affiliate',
  'Influencer',
  'SMS',
  'Pop',
  'Redirect',
  'Toolbar',
  'Adult',
  'Incentivized',
  'Brand Bidding',
  'Spam',
  'Fraud',
];

/**
 * All valid offer categories
 */
export const VALID_CATEGORIES = [
  'HEALTH',
  'SURVEY',
  'EDUCATION',
  'INSURANCE',
  'LOAN',
  'FINANCE',
  'DATING',
  'FREE_TRIAL',
  'INSTALLS',
  'GAMES_INSTALL',
  'OTHER',
];
