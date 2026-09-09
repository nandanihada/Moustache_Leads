/**
 * PepperwahlTemplateEditor
 * A slide-in Sheet (drawer) that lets the admin edit all text/button/URL
 * fields for a single Pepperwahl email template.
 * Saves to MongoDB via the backend config endpoint.
 * Changes are reflected immediately in preview and send.
 */

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { RefreshCw, RotateCcw, Save } from 'lucide-react';
import pepperwahlMailApi, { TemplateConfig } from '@/services/pepperwahlMailApi';

// ---------------------------------------------------------------------------
// Field schema — defines what appears in the editor per template
// ---------------------------------------------------------------------------
type FieldType = 'text' | 'textarea';

interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
}

interface SectionDef {
  section: string;
  fields: FieldDef[];
}

const FIELD_SCHEMAS: Record<string, SectionDef[]> = {
  template_1: [
    {
      section: 'Hero Content',
      fields: [
        { key: 'eyebrow',   label: 'Eyebrow Tag',  type: 'text',     placeholder: 'SPECIAL MEMBER OFFER • 2 MIN SURVEY' },
        { key: 'headline',  label: 'Headline',     type: 'textarea', placeholder: 'Help us craft better survey tools…' },
        { key: 'subtext',   label: 'Subtext',      type: 'textarea', placeholder: 'Tell us about your workflow…' },
      ],
    },
    {
      section: 'Premium Features List',
      fields: [
        { key: 'feature_1', label: 'Feature 1', type: 'text', placeholder: 'Unlimited responses' },
        { key: 'feature_2', label: 'Feature 2', type: 'text', placeholder: 'Advanced sentiment analytics' },
        { key: 'feature_3', label: 'Feature 3', type: 'text', placeholder: 'Custom domain links' },
        { key: 'feature_4', label: 'Feature 4', type: 'text', placeholder: 'Export to CSV / Sheets' },
      ],
    },
    {
      section: 'Call to Action Button',
      fields: [
        { key: 'cta_text',    label: 'Button Text', type: 'text', placeholder: 'Complete Survey & Unlock 7 Days Premium →' },
        { key: 'cta_url',     label: 'Button URL (full https:// link)',  type: 'text',  placeholder: 'https://pepperwahl.com/survey' },
        { key: 'disclaimer',  label: 'Disclaimer',  type: 'text', placeholder: 'No credit card required.' },
      ],
    },
    {
      section: 'Footer',
      fields: [
        { key: 'footer_company', label: 'Company Name', type: 'text', placeholder: 'Pepperwahl Inc.' },
        { key: 'footer_address', label: 'Address Line',  type: 'text', placeholder: '© 2025 Pepperwahl Inc…' },
      ],
    },
  ],

  template_2: [
    {
      section: 'Header & Hero',
      fields: [
        { key: 'edition_label',   label: 'Edition Badge',   type: 'text',     placeholder: 'Product Drop • October Edition' },
        { key: 'release_label',   label: 'Release Tag',     type: 'text',     placeholder: 'SCHEDULED RELEASE' },
        { key: 'headline',        label: 'Headline',        type: 'textarea', placeholder: "What's Fresh in Pepperwahl this Month" },
        { key: 'subtext',         label: 'Subtext',         type: 'textarea', placeholder: 'Scheduled updates rolling out…' },
      ],
    },
    {
      section: 'Video Section',
      fields: [
        { key: 'video_url',   label: 'Video URL (embed/link)', type: 'text',      placeholder: 'https://youtube.com/embed/…' },
        { key: 'video_label', label: 'Video Caption',          type: 'textarea', placeholder: 'Watch: How to use Logic Branching in 3 minutes' },
      ],
    },
    {
      section: 'Feature Cards',
      fields: [
        { key: 'section_label',    label: 'Section Label',   type: 'text', placeholder: 'Architecture & Features' },
        { key: 'section_headline', label: 'Section Heading', type: 'text', placeholder: 'Three Major Enhancements' },
        { key: 'card1_title', label: 'Card 1 — Title', type: 'text',     placeholder: 'Smart Logic Jump' },
        { key: 'card1_badge', label: 'Card 1 — Badge', type: 'text',     placeholder: 'New AI Tool' },
        { key: 'card1_body',  label: 'Card 1 — Body',  type: 'textarea', placeholder: 'Automatically route respondents…' },
        { key: 'card2_title', label: 'Card 2 — Title', type: 'text',     placeholder: 'Real-time Webhook & Slack Sync' },
        { key: 'card2_badge', label: 'Card 2 — Badge', type: 'text',     placeholder: 'Integration' },
        { key: 'card2_body',  label: 'Card 2 — Body',  type: 'textarea', placeholder: 'Get instant pings…' },
        { key: 'card3_title', label: 'Card 3 — Title', type: 'text',     placeholder: 'Export to Notion & Google Sheets' },
        { key: 'card3_badge', label: 'Card 3 — Badge', type: 'text',     placeholder: 'Workflow' },
        { key: 'card3_body',  label: 'Card 3 — Body',  type: 'textarea', placeholder: 'Sync survey responses live…' },
      ],
    },
    {
      section: 'Call to Action',
      fields: [
        { key: 'cta_headline', label: 'CTA Headline', type: 'text',     placeholder: 'Ready to accelerate your research?' },
        { key: 'cta_subtext',  label: 'CTA Subtext',  type: 'textarea', placeholder: 'All feature updates are automatically enabled…' },
        { key: 'cta_text',     label: 'Button Text',  type: 'text',     placeholder: 'Try the New Features →' },
        { key: 'cta_url',     label: 'Button URL (full https:// link)',   type: 'text',      placeholder: 'https://pepperwahl.com' },
      ],
    },
    {
      section: 'Footer',
      fields: [
        { key: 'footer_company', label: 'Company Name', type: 'text', placeholder: 'Pepperwahl Research Operations' },
        { key: 'footer_address', label: 'Address Line',  type: 'text', placeholder: '© 2025 Pepperwahl Inc…' },
      ],
    },
  ],

  template_3: [
    {
      section: 'Header',
      fields: [
        { key: 'open_platform_text', label: '"Open Platform" Button Text', type: 'text', placeholder: 'Open Platform →' },
        { key: 'open_platform_url',  label: '"Open Platform" Button URL',  type: 'text',  placeholder: 'https://pepperwahl.com' },
        { key: 'badge_label',        label: 'Badge Text',                  type: 'text', placeholder: 'Researcher Onboarding' },
        { key: 'edition_label',      label: 'Edition Label',               type: 'text', placeholder: 'Edition #01 • 3 min setup' },
      ],
    },
    {
      section: 'Hero',
      fields: [
        { key: 'headline', label: 'Headline', type: 'textarea', placeholder: 'Welcome to Pepperwahl…' },
        { key: 'subtext',  label: 'Subtext',  type: 'textarea', placeholder: "You've joined thousands…" },
      ],
    },
    {
      section: 'Primary CTA Banner',
      fields: [
        { key: 'cta_ready_title', label: 'Banner Title', type: 'text',     placeholder: 'Ready to explore?' },
        { key: 'cta_ready_body',  label: 'Banner Body',  type: 'textarea', placeholder: 'Launch your introductory survey in less than 90 seconds.' },
        { key: 'cta_primary_text',label: 'Button Text',  type: 'text',     placeholder: 'Create Your First Survey Now →' },
        { key: 'cta_primary_url', label: 'Button URL',   type: 'text',      placeholder: 'https://pepperwahl.com/new' },
      ],
    },
    {
      section: '3-Step Quick Start',
      fields: [
        { key: 'step1_title', label: 'Step 1 Title', type: 'text',     placeholder: 'Generate with AI in seconds' },
        { key: 'step1_body',  label: 'Step 1 Body',  type: 'textarea', placeholder: 'Describe your goal…' },
        { key: 'step2_title', label: 'Step 2 Title', type: 'text',     placeholder: 'Distribute anywhere' },
        { key: 'step2_body',  label: 'Step 2 Body',  type: 'textarea', placeholder: 'Share via direct link…' },
        { key: 'step3_title', label: 'Step 3 Title', type: 'text',     placeholder: 'Inspect live analytics' },
        { key: 'step3_body',  label: 'Step 3 Body',  type: 'textarea', placeholder: 'Monitor completion rates…' },
      ],
    },
    {
      section: 'Bottom CTA & Links',
      fields: [
        { key: 'cta_secondary_text', label: 'Bottom Button Text', type: 'text', placeholder: 'Create Your First Survey Now →' },
        { key: 'cta_secondary_url',  label: 'Bottom Button URL',  type: 'text',  placeholder: 'https://pepperwahl.com/new' },
        { key: 'explore_text',       label: 'Explore Link Text',  type: 'text', placeholder: 'Explore Survey Templates' },
        { key: 'explore_url',        label: 'Explore Link URL',   type: 'text',  placeholder: 'https://pepperwahl.com/templates' },
        { key: 'docs_text',          label: 'Docs Link Text',     type: 'text', placeholder: 'Read Quickstart Docs' },
        { key: 'docs_url',           label: 'Docs Link URL',      type: 'text',  placeholder: 'https://pepperwahl.com/docs' },
        { key: 'pro_tip',            label: 'Pro Tip Text',       type: 'textarea', placeholder: 'Import your existing product spec…' },
      ],
    },
    {
      section: 'Footer',
      fields: [
        { key: 'footer_company', label: 'Company Name', type: 'text', placeholder: 'Pepperwahl Survey Intelligence' },
        { key: 'footer_address', label: 'Address Line',  type: 'text', placeholder: '© 2025 Pepperwahl Inc…' },
      ],
    },
  ],

  template_4: [
    {
      section: 'Hero',
      fields: [
        { key: 'badge_label', label: 'Badge Text', type: 'text',     placeholder: 'REFERRAL PROGRAM' },
        { key: 'headline',    label: 'Headline',   type: 'textarea', placeholder: 'Give $20, Get $20…' },
        { key: 'subtext',     label: 'Subtext',    type: 'textarea', placeholder: 'Introduce product teams…' },
      ],
    },
    {
      section: 'Stats Card',
      fields: [
        { key: 'stat1_label', label: 'Stat 1 Label',    type: 'text', placeholder: 'Total Credits Earned' },
        { key: 'stat1_value', label: 'Stat 1 Value',    type: 'text', placeholder: '$60.00' },
        { key: 'stat1_sub',   label: 'Stat 1 Sublabel', type: 'text', placeholder: 'Applied to balance' },
        { key: 'stat2_label', label: 'Stat 2 Label',    type: 'text', placeholder: 'Teammates Invited' },
        { key: 'stat2_value', label: 'Stat 2 Value',    type: 'text', placeholder: '3 Teams' },
        { key: 'stat2_sub',   label: 'Stat 2 Sublabel', type: 'text', placeholder: 'Active researchers' },
        { key: 'milestone_label', label: 'Milestone Label', type: 'text',     placeholder: 'Next Bonus Milestone: 4 Teams' },
        { key: 'milestone_note',  label: 'Milestone Note',  type: 'textarea', placeholder: '1 more invite unlocks…' },
      ],
    },
    {
      section: 'Invite Link Box',
      fields: [
        { key: 'invite_headline',  label: 'Box Headline',    type: 'text',     placeholder: 'Your Personal Invite Link' },
        { key: 'invite_subtext',   label: 'Box Subtext',     type: 'textarea', placeholder: 'Share this link or copy your unique voucher code.' },
        { key: 'referral_code',    label: 'Referral Code',   type: 'text',     placeholder: 'PEPPER-GROW-2025' },
        { key: 'copy_btn_text',    label: 'Copy Button Text',type: 'text',     placeholder: 'Copy Link' },
      ],
    },
    {
      section: 'How It Works — 3 Steps',
      fields: [
        { key: 'how_headline', label: 'Section Heading', type: 'text',     placeholder: 'How It Works' },
        { key: 'step1_title',  label: 'Step 1 Title',    type: 'text',     placeholder: 'Share your link or invite code' },
        { key: 'step1_body',   label: 'Step 1 Body',     type: 'textarea', placeholder: 'Send your bespoke invite code…' },
        { key: 'step2_title',  label: 'Step 2 Title',    type: 'text',     placeholder: 'They sign up & launch…' },
        { key: 'step2_body',   label: 'Step 2 Body',     type: 'textarea', placeholder: 'Your peers receive an instant $20…' },
        { key: 'step3_title',  label: 'Step 3 Title',    type: 'text',     placeholder: 'You both receive $20 credit' },
        { key: 'step3_body',   label: 'Step 3 Body',     type: 'textarea', placeholder: 'Credits reflect automatically…' },
      ],
    },
    {
      section: 'Call to Action',
      fields: [
        { key: 'cta_text',    label: 'Button Text', type: 'text',     placeholder: 'Send Invitations Now →' },
        { key: 'cta_url',     label: 'Button URL',  type: 'text',      placeholder: 'https://pepperwahl.com/referral' },
        { key: 'disclaimer',  label: 'Disclaimer',  type: 'textarea', placeholder: 'No credit card required…' },
      ],
    },
    {
      section: 'Footer',
      fields: [
        { key: 'footer_company', label: 'Company Name', type: 'text', placeholder: 'Pepperwahl Inc.' },
        { key: 'footer_address', label: 'Address Line',  type: 'text', placeholder: '© 2025 Pepperwahl Inc…' },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  templateId: string;
  templateName: string;
  onSaved: (templateId: string, config: Record<string, string>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const PepperwahlTemplateEditor = ({ open, onOpenChange, templateId, templateName, onSaved }: Props) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Load saved config when drawer opens or template changes
  useEffect(() => {
    if (!open || !templateId) return;
    setLoading(true);
    pepperwahlMailApi.getTemplateConfig(templateId)
      .then((cfg) => setValues(cfg as unknown as Record<string, string>))
      .catch(() => toast.error('Could not load template config'))
      .finally(() => setLoading(false));
  }, [open, templateId]);

  const handleChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await pepperwahlMailApi.saveTemplateConfig(templateId, values as Partial<TemplateConfig>);
      toast.success('Template content saved — preview and send will use these values');
      onSaved(templateId, values);
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset to default content? All your edits will be lost.')) return;
    setResetting(true);
    try {
      await pepperwahlMailApi.resetTemplateConfig(templateId);
      const cfg = await pepperwahlMailApi.getTemplateConfig(templateId);
      setValues(cfg as unknown as Record<string, string>);
      toast.success('Reset to defaults');
      onSaved(templateId, cfg as unknown as Record<string, string>);
    } catch {
      toast.error('Reset failed');
    } finally {
      setResetting(false);
    }
  };

  const schema = FIELD_SCHEMAS[templateId] ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col sm:max-w-xl overflow-hidden p-0"
      >
        {/* Header */}
        <SheetHeader className="border-b px-6 py-4 shrink-0">
          <SheetTitle className="text-base">Edit Template Content</SheetTitle>
          <SheetDescription className="text-xs">
            {templateName} — change any text, button labels, or URLs. Structure stays the same.
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable fields */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            schema.map((section) => (
              <div key={section.section}>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.section}
                </p>
                <div className="space-y-3">
                  {section.fields.map((field) => (
                    <div key={field.key}>
                      <Label className="mb-1 block text-xs font-medium text-foreground">
                        {field.label}
                      </Label>
                      {field.type === 'textarea' ? (
                        <Textarea
                          value={values[field.key] ?? ''}
                          onChange={(e) => handleChange(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          rows={3}
                          className="text-sm resize-none"
                        />
                      ) : (
                        <Input
                          value={values[field.key] ?? ''}
                          onChange={(e) => handleChange(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          type="text"
                          className="text-sm"
                        />
                      )}
                    </div>
                  ))}
                </div>
                <Separator className="mt-5" />
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <SheetFooter className="border-t px-6 py-4 shrink-0 flex flex-row items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-destructive gap-1.5"
            onClick={handleReset}
            disabled={resetting || loading}
          >
            {resetting
              ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              : <RotateCcw className="h-3.5 w-3.5" />
            }
            Reset to defaults
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-red-700 hover:bg-red-800 text-white gap-1.5"
              onClick={handleSave}
              disabled={saving || loading}
            >
              {saving
                ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                : <Save className="h-3.5 w-3.5" />
              }
              Save Changes
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default PepperwahlTemplateEditor;
