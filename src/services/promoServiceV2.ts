import { getApiBaseUrl } from './apiConfig';

export interface PromoRedeemResponse {
  success: boolean;
  message?: string;
  redirect_url?: string;
  error?: string;
}

export const redeemPromoCode = async (code: string): Promise<PromoRedeemResponse> => {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/promo/redeem`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ code })
    });
    
    const data = await response.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
};

export const trackPromoEvent = async (
  eventType: 'PROMO_TAB_OPENED' | 'PROMO_REDEEM_SUCCESS' | 'PROMO_REDEEM_FAILED',
  payload: {
    promoCode?: string;
    status: 'opened' | 'success' | 'failed';
    offerId?: string;
    failureReason?: string;
  }
) => {
  const token = localStorage.getItem('token');
  try {
    await fetch(`${getApiBaseUrl()}/api/analytics/promo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        event_type: eventType,
        ...payload,
        timestamp: new Date().toISOString()
      })
    });
  } catch (err) {
    console.error('Failed to log promo analytics:', err);
  }
};
