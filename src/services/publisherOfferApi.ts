/**
 * Publisher Offers API
 * For publishers to view and access available offers (no admin required)
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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
  status: string;
  countries: string[];
  device_targeting: string;
  category?: string;
  thumbnail_url?: string;
  image_url?: string;
  target_url: string;
  preview_url?: string;
  caps?: {
    daily?: number;
    total?: number;
  };
  expiration_date?: string;
  created_at?: string;
  updated_at?: string;
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
 * Export all functions
 */
export const publisherOfferApi = {
  getAvailableOffers,
  getOfferDetails,
};

export default publisherOfferApi;
