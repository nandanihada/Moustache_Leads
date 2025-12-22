/**
 * Payout Settings API Service
 * Handles payout methods and earnings data
 */

import { API_BASE_URL as BASE_URL } from './apiConfig';

const API_BASE_URL = `${BASE_URL}/api/payout`;

// Types
export interface BankDetails {
  account_name: string;
  bank_name: string;
  account_number: string;
  ifsc_swift: string;
  country: string;
  currency: string;
  phone?: string;
  address?: string;
  upi?: string;
}

export interface PayPalDetails {
  email: string;
  country: string;
  minimum_threshold: number;
}

export interface CryptoDetails {
  currency: string;
  network: string;
  wallet_address: string;
  label?: string;
}

export interface PayoutMethod {
  active_method: 'bank' | 'paypal' | 'crypto';
  bank_details?: BankDetails;
  paypal_details?: PayPalDetails;
  crypto_details?: CryptoDetails;
}

export interface MonthlyEarning {
  id: string;
  month: string;
  year: number;
  amount: number;
  status: 'pending' | 'processing' | 'paid' | 'carried_forward';
  payment_date?: string;
  transaction_id?: string;
  created_at: string;
}

export interface CurrentMonthEarnings {
  month: string;
  amount: number;
  status: string;
  is_locked: boolean;
}

export interface EarningsData {
  current_month: CurrentMonthEarnings;
  pending_earnings: number;
  earnings_history: MonthlyEarning[];
  payout_method: {
    has_method: boolean;
    active_method?: 'bank' | 'paypal' | 'crypto';
  };
  next_payment_date?: string;
}

class PayoutSettingsApi {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No authentication token found. Please login first.');
    }
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  /**
   * Get current payout method
   */
  async getPayoutMethod(): Promise<{ has_method: boolean; method?: PayoutMethod }> {
    const response = await fetch(`${API_BASE_URL}/method`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to fetch payout method');
    }

    return response.json();
  }

  /**
   * Save or update payout method
   */
  async savePayoutMethod(methodData: PayoutMethod): Promise<{ message: string; method: PayoutMethod }> {
    const response = await fetch(`${API_BASE_URL}/method`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(methodData)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to save payout method');
    }

    return response.json();
  }

  /**
   * Get earnings data
   */
  async getEarnings(): Promise<EarningsData> {
    const response = await fetch(`${API_BASE_URL}/earnings`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to fetch earnings');
    }

    return response.json();
  }

  /**
   * Get next payment date
   */
  async getNextPaymentDate(): Promise<{
    has_payment: boolean;
    next_payment_date?: string;
    earning_month?: string;
    amount?: number;
  }> {
    const response = await fetch(`${API_BASE_URL}/next-payment-date`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to fetch next payment date');
    }

    return response.json();
  }
}

export const payoutSettingsApi = new PayoutSettingsApi();

// Make it globally accessible for testing
if (typeof window !== 'undefined') {
  (window as any).payoutSettingsApi = payoutSettingsApi;
}
