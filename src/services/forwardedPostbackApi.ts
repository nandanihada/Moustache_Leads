import api from './api';

export interface ForwardedPostback {
  _id: string;
  timestamp: string;
  publisher_id: string;
  publisher_name: string;
  username: string;
  points: number;
  original_postback_id: string;
  forward_url: string;
  forward_status: 'success' | 'failed';
  response_code?: number;
  error_message?: string;
  original_params: Record<string, any>;
  enriched_params: Record<string, any>;
}

export interface ForwardedPostbacksResponse {
  success: boolean;
  logs: ForwardedPostback[];
  total: number;
}

export const forwardedPostbackApi = {
  /**
   * Get forwarded postbacks
   */
  async getForwardedPostbacks(params?: {
    limit?: number;
    offset?: number;
    publisher_id?: string;
  }): Promise<ForwardedPostbacksResponse> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.publisher_id) queryParams.append('publisher_id', params.publisher_id);

    const response = await api.get<ForwardedPostbacksResponse>(
      `/admin/forwarded-postbacks?${queryParams.toString()}`
    );
    return response.data;
  },

  /**
   * Get forwarded postback details
   */
  async getForwardedPostbackDetails(postbackId: string): Promise<{ success: boolean; postback: ForwardedPostback }> {
    const response = await api.get<{ success: boolean; postback: ForwardedPostback }>(
      `/admin/forwarded-postbacks/${postbackId}`
    );
    return response.data;
  },
};
