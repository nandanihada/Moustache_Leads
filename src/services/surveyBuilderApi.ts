import { getApiBaseUrl } from './apiConfig';
import { getAuthToken } from '@/utils/cookies';

const API_BASE_URL = `${getApiBaseUrl()}/api/admin/surveys`;

export interface SurveyQuestion {
  id: string;
  text: string;
  type: 'mcq' | 'text' | 'yes_no' | 'number';
  options?: string[];
  required: boolean;
}

export interface Survey {
  _id?: string;
  name: string;
  description?: string;
  type: 'manual' | 'ai_generated';
  status: 'active' | 'inactive' | 'draft';
  questions: SurveyQuestion[];
  placement: 'offerwall_card' | 'before_offer' | 'before_subwall' | 'subwall_associated';
  target_offer_ids: string[];
  target_subwall_id?: string;
  image_url?: string;
  created_at?: string;
  ai_prompt?: string;
  response_count?: number;
}

export interface SurveyResponse {
  _id: string;
  survey_id: string;
  user_id: string;
  answers: Array<{question_id: string; answer: string}>;
  completed_at: string;
  time_spent_seconds: number;
}

class SurveyBuilderApi {
  private getHeaders() {
    const token = getAuthToken();
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
  }

  async listSurveys(params?: {search?: string; status?: string; page?: number; per_page?: number}): Promise<{surveys: Survey[]; total: number}> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', String(params.page));
    if (params?.per_page) query.set('per_page', String(params.per_page));
    const res = await fetch(`${API_BASE_URL}?${query}`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch surveys');
    return res.json();
  }

  async createSurvey(survey: Partial<Survey>): Promise<{survey: Survey; success: boolean}> {
    const res = await fetch(API_BASE_URL, { method: 'POST', headers: this.getHeaders(), body: JSON.stringify(survey) });
    if (!res.ok) throw new Error('Failed to create survey');
    return res.json();
  }

  async getSurvey(id: string): Promise<{survey: Survey}> {
    const res = await fetch(`${API_BASE_URL}/${id}`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch survey');
    return res.json();
  }

  async updateSurvey(id: string, data: Partial<Survey>): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/${id}`, { method: 'PUT', headers: this.getHeaders(), body: JSON.stringify(data) });
    if (!res.ok) throw new Error('Failed to update survey');
  }

  async deleteSurvey(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/${id}`, { method: 'DELETE', headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to delete survey');
  }

  async generateSurvey(prompt: string, name: string): Promise<{survey: Partial<Survey>; success: boolean}> {
    const res = await fetch(`${API_BASE_URL}/generate`, { method: 'POST', headers: this.getHeaders(), body: JSON.stringify({ prompt, name }) });
    if (!res.ok) throw new Error('Failed to generate survey');
    return res.json();
  }

  async getResponses(surveyId: string): Promise<{responses: SurveyResponse[]; total: number}> {
    const res = await fetch(`${API_BASE_URL}/${surveyId}/responses`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch responses');
    return res.json();
  }
}

export const surveyBuilderApi = new SurveyBuilderApi();
