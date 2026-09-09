import { getApiBaseUrl } from './apiConfig';
import { getAuthToken } from '@/utils/cookies';

const base = () => getApiBaseUrl();
const headers = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getAuthToken()}`,
});

export interface PepperwahlTemplate {
  id: string;
  name: string;
  description: string;
  default_subject: string;
}

export interface PepperwahlPartner {
  _id: string;
  username: string;
  email: string;
  is_active: boolean;
}

export interface PepperwahlSendPayload {
  template_id: string;
  sender: 'pepperwahl' | 'moustache';
  subject: string;
  recipients: string[];
  partner_ids: string[];
  scheduled_at?: string;
  rendered_html?: string;  // pre-built HTML with config injected
}

export interface PepperwahlLog {
  template_id: string;
  sender: string;
  recipient_count: number;
  subject: string;
  sent: number;
  failed: number;
  scheduled_at?: string;
  sent_by: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Template config types — one interface per template
// ---------------------------------------------------------------------------
export interface Template1Config {
  headline: string; subtext: string; eyebrow: string;
  cta_text: string; cta_url: string; disclaimer: string;
  feature_1: string; feature_2: string; feature_3: string; feature_4: string;
  footer_company: string; footer_address: string;
}
export interface Template2Config {
  edition_label: string; release_label: string; headline: string; subtext: string;
  section_label: string; section_headline: string;
  card1_title: string; card1_badge: string; card1_body: string;
  card2_title: string; card2_badge: string; card2_body: string;
  card3_title: string; card3_badge: string; card3_body: string;
  video_url: string; video_label: string;
  cta_headline: string; cta_subtext: string; cta_text: string; cta_url: string;
  footer_company: string; footer_address: string;
}
export interface Template3Config {
  badge_label: string; edition_label: string; headline: string; subtext: string;
  cta_ready_title: string; cta_ready_body: string;
  cta_primary_text: string; cta_primary_url: string;
  open_platform_text: string; open_platform_url: string;
  step1_title: string; step1_body: string;
  step2_title: string; step2_body: string;
  step3_title: string; step3_body: string;
  cta_secondary_text: string; cta_secondary_url: string;
  explore_text: string; explore_url: string;
  docs_text: string; docs_url: string;
  pro_tip: string; footer_company: string; footer_address: string;
}
export interface Template4Config {
  badge_label: string; headline: string; subtext: string;
  stat1_label: string; stat1_value: string; stat1_sub: string;
  stat2_label: string; stat2_value: string; stat2_sub: string;
  milestone_label: string; milestone_note: string;
  invite_headline: string; invite_subtext: string;
  referral_code: string; copy_btn_text: string;
  how_headline: string;
  step1_title: string; step1_body: string;
  step2_title: string; step2_body: string;
  step3_title: string; step3_body: string;
  cta_text: string; cta_url: string; disclaimer: string;
  footer_company: string; footer_address: string;
}

export type TemplateConfig = Template1Config | Template2Config | Template3Config | Template4Config;

const pepperwahlMailApi = {
  async getTemplates(): Promise<PepperwahlTemplate[]> {
    const res = await fetch(`${base()}/api/admin/pepperwahl-mail/templates`, { headers: headers() });
    const data = await res.json();
    return data.templates || [];
  },

  async previewTemplate(templateId: string): Promise<string> {
    const res = await fetch(`${base()}/api/admin/pepperwahl-mail/preview`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ template_id: templateId }),
    });
    const data = await res.json();
    return data.html || '';
  },

  async sendMail(payload: PepperwahlSendPayload): Promise<{
    status: string;
    recipient_count: number;
    template_id: string;
    sender: string;
    message?: string;
    scheduled_at?: string;
  }> {
    const res = await fetch(`${base()}/api/admin/pepperwahl-mail/send`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to send');
    }
    return res.json();
  },

  async getLogs(page = 1, limit = 20): Promise<PepperwahlLog[]> {
    const res = await fetch(`${base()}/api/admin/pepperwahl-mail/logs?page=${page}&limit=${limit}`, {
      headers: headers(),
    });
    const data = await res.json();
    return data.logs || [];
  },

  async getPartners(search = ''): Promise<PepperwahlPartner[]> {
    const url = `${base()}/api/admin/pepperwahl-mail/partners${search ? `?search=${encodeURIComponent(search)}` : ''}`;
    const res = await fetch(url, { headers: headers() });
    const data = await res.json();
    return data.partners || [];
  },

  async getTemplateConfig(templateId: string): Promise<TemplateConfig> {
    const res = await fetch(`${base()}/api/admin/pepperwahl-mail/config/${templateId}`, { headers: headers() });
    const data = await res.json();
    return data.config || {};
  },

  async saveTemplateConfig(templateId: string, config: Partial<TemplateConfig>): Promise<void> {
    const res = await fetch(`${base()}/api/admin/pepperwahl-mail/config/${templateId}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(config),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Save failed'); }
  },

  async resetTemplateConfig(templateId: string): Promise<void> {
    await fetch(`${base()}/api/admin/pepperwahl-mail/config/${templateId}/reset`, {
      method: 'POST', headers: headers(),
    });
  },
};

export default pepperwahlMailApi;
