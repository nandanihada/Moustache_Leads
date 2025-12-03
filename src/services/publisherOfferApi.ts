/**
 * Publisher Offers API
 * For publishers to view and access available offers (no admin required)
 */

import axios from 'axios';
import { API_BASE_URL } from './apiConfig';

// Get auth token from localStorage
const getAuthToken = () => {
  return localStorage.getItem('token');
};

// Configure axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface PublisherOffer {
  _id: string;
  offer_id: string;
  name: string;
  description?: string;
  payout: number;
  currency: string;
  network: string;
  countries: string[];
  category?: string;
  thumbnail_url?: string;
  image_url?: string;
  target_url?: string; // Only available if user has access
  masked_url?: string; // Only available if user has access
  preview_url?: string;
  created_at?: string;
  // New approval workflow fields
  approval_status: string;
  approval_type: string;
  has_access: boolean;
  access_reason: string;
  requires_approval: boolean;
  is_preview?: boolean;
  estimated_approval_time?: string;
  request_status?: 'pending' | 'approved' | 'rejected';
  requested_at?: string;
  approved_at?: string;
}

export interface GetOffersParams {
  page?: number;
  per_page?: number;
  status?: string;
  search?: string;
}

export interface GetOffersResponse {
  success: boolean;
  offers: PublisherOffer[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    pages: number;
  };
}

export interface GetOfferResponse {
  success: boolean;
  offer: PublisherOffer;
}

/**
 * Get available offers for publishers
 */
export const getAvailableOffers = async (params: GetOffersParams = {}): Promise<GetOffersResponse> => {
  const { page = 1, per_page = 100, status = 'active', search = '' } = params;
  
  const response = await api.get('/api/publisher/offers/available', {
    params: {
      page,
      per_page,
      status,
      search,
    },
  });
  
  return response.data;
};

/**
 * Get details of a specific offer
 */
export const getOfferDetails = async (offerId: string): Promise<GetOfferResponse> => {
  const response = await api.get(`/api/publisher/offers/${offerId}`);
  return response.data;
};

/**
 * Request access to an offer
 */
export const requestOfferAccess = async (offerId: string, message: string = '') => {
  const response = await api.post(`/api/publisher/offers/${offerId}/request-access`, {
    message
  });
  return response.data;
};

/**
 * Get access status for an offer
 */
export const getOfferAccessStatus = async (offerId: string) => {
  const response = await api.get(`/api/publisher/offers/${offerId}/access-status`);
  return response.data;
};

/**
 * Get user's own access requests
 */
export const getMyAccessRequests = async (params: { status?: string; page?: number; per_page?: number } = {}) => {
  const response = await api.get('/api/publisher/my-requests', { params });
  return response.data;
};

/**
 * Export all functions
 */
export const publisherOfferApi = {
  getAvailableOffers,
  getOfferDetails,
  requestOfferAccess,
  getOfferAccessStatus,
  getMyAccessRequests,
};

export default publisherOfferApi;
