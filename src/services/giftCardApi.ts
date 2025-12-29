import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Types
export interface GiftCard {
  _id: string;
  code: string;
  name: string;
  description?: string;
  amount: number;
  max_redemptions: number;
  redemption_count: number;
  remaining_redemptions?: number;
  image_url?: string;
  expiry_date: string;
  send_to_all: boolean;
  excluded_users: string[];
  redeemed_by: string[];
  status: 'active' | 'expired' | 'cancelled' | 'fully_redeemed';
  created_by: string;
  created_at: string;
  updated_at: string;
  total_credited: number;
  email_sent_to: string[];
  is_redeemed?: boolean;
}

export interface CreateGiftCardData {
  name: string;
  description?: string;
  amount: number;
  max_redemptions: number;
  image_url?: string;
  expiry_date: string;
  send_to_all: boolean;
  excluded_users?: string[];
  code?: string;
  send_email: boolean;
}

export interface RedeemResponse {
  success: boolean;
  message: string;
  amount: number;
  new_balance: number;
  gift_card_name: string;
  redemption_number: number;
  max_redemptions: number;
}

export interface RedemptionHistory {
  _id: string;
  code: string;
  amount: number;
  redeemed_at: string;
  redemption_number: number;
  status: string;
}

// Get auth token from localStorage
const getAuthToken = () => {
  return localStorage.getItem('token');
};

// API Client
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Admin APIs
export const giftCardAdminApi = {
  // Create gift card
  createGiftCard: async (data: CreateGiftCardData): Promise<{ success: boolean; gift_card: GiftCard; message: string }> => {
    const response = await apiClient.post('/admin/gift-cards', data);
    return response.data;
  },

  // Get all gift cards
  getAllGiftCards: async (skip = 0, limit = 20, status?: string): Promise<{ success: boolean; gift_cards: GiftCard[]; total: number }> => {
    const params: any = { skip, limit };
    if (status) params.status = status;
    const response = await apiClient.get('/admin/gift-cards', { params });
    return response.data;
  },

  // Send emails
  sendEmails: async (giftCardId: string, userIds: string[]): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post(`/admin/gift-cards/${giftCardId}/send-email`, { user_ids: userIds });
    return response.data;
  },

  // Cancel gift card
  cancelGiftCard: async (giftCardId: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post(`/admin/gift-cards/${giftCardId}/cancel`);
    return response.data;
  },
};

// User APIs
export const giftCardUserApi = {
  // Redeem gift card
  redeemGiftCard: async (code: string): Promise<RedeemResponse> => {
    const response = await apiClient.post('/publisher/gift-cards/redeem', { code });
    return response.data;
  },

  // Get available gift cards
  getAvailableGiftCards: async (): Promise<{ success: boolean; gift_cards: GiftCard[] }> => {
    const response = await apiClient.get('/publisher/gift-cards');
    return response.data;
  },

  // Get redemption history
  getRedemptionHistory: async (): Promise<{ success: boolean; history: RedemptionHistory[]; total_redeemed: number }> => {
    const response = await apiClient.get('/publisher/gift-cards/history');
    return response.data;
  },

  // Get user balance
  getUserBalance: async (): Promise<{ success: boolean; balance: number }> => {
    const response = await apiClient.get('/publisher/balance');
    return response.data;
  },
};

export default {
  admin: giftCardAdminApi,
  user: giftCardUserApi,
};
