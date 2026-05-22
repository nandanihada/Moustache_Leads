import { getApiBaseUrl } from './apiConfig';
import { getAuthToken } from '@/utils/cookies';

const API_BASE_URL = `${getApiBaseUrl()}/api/admin/sub-walls`;

export interface SurveyCard {
  survey_id: string;
  title: string;
  description?: string;
  image_url?: string;
  points?: number;
  position?: number;  // Position in the grid (0 = first, -1 = last)
  badge_text?: string;
  badge_color?: string;
}

export interface SubWall {
  _id?: string;
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
  offer_ids: string[];
  survey_cards?: SurveyCard[];
  pre_screening_enabled: boolean;
  pre_screening_survey_id?: string | null;
  filter_by_answers: boolean;
  filter_rules?: Record<string, any>;
  visibility: 'everyone' | 'specific_publishers' | 'by_country' | 'link_only';
  visible_to_publishers?: string[];
  visible_countries?: string[];
  status: 'active' | 'inactive' | 'draft';
  display_order?: number;
  // Customization fields
  heading_text?: string;
  theme_color?: string;
  banner_image?: string;
  button_text?: string;
  survey_frequency?: string;
  created_at?: string;
  created_by?: string;
}

class SubWallApi {
  private getHeaders() {
    const token = getAuthToken();
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
  }

  async listSubWalls(params?: { search?: string; status?: string }): Promise<{ sub_walls: SubWall[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);
    const res = await fetch(`${API_BASE_URL}?${query}`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch sub-walls');
    return res.json();
  }

  async createSubWall(data: Partial<SubWall>): Promise<{ sub_wall: SubWall; success: boolean }> {
    const res = await fetch(API_BASE_URL, { method: 'POST', headers: this.getHeaders(), body: JSON.stringify(data) });
    if (!res.ok) throw new Error('Failed to create sub-wall');
    return res.json();
  }

  async getSubWall(id: string): Promise<{ sub_wall: SubWall }> {
    const res = await fetch(`${API_BASE_URL}/${id}`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch sub-wall');
    return res.json();
  }

  async updateSubWall(id: string, data: Partial<SubWall>): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/${id}`, { method: 'PUT', headers: this.getHeaders(), body: JSON.stringify(data) });
    if (!res.ok) throw new Error('Failed to update sub-wall');
  }

  async deleteSubWall(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/${id}`, { method: 'DELETE', headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to delete sub-wall');
  }

  async generateSlug(name: string): Promise<{ slug: string }> {
    const res = await fetch(`${API_BASE_URL}/generate-slug`, { method: 'POST', headers: this.getHeaders(), body: JSON.stringify({ name }) });
    if (!res.ok) throw new Error('Failed to generate slug');
    return res.json();
  }
}

export const subWallApi = new SubWallApi();
