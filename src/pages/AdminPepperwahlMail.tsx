/**
 * AdminPepperwahlMail — Send Pepperwahl-branded emails from the admin panel.
 *
 * All 4 template HTMLs are embedded locally (preview works instantly).
 * Template text/button content is editable via PepperwahlTemplateEditor drawer.
 * Saved config is injected into the HTML before both preview and send.
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Mail, Send, Eye, Users, Search, RefreshCw, Clock,
  CheckCheck, AlertCircle, Inbox, ChevronLeft, ChevronRight,
  Plus, X, AtSign, Pencil,
} from 'lucide-react';
import pepperwahlMailApi, { PepperwahlPartner, PepperwahlLog } from '@/services/pepperwahlMailApi';
import PepperwahlTemplateEditor from '@/components/PepperwahlTemplateEditor';

// ---------------------------------------------------------------------------
// Static template metadata
// ---------------------------------------------------------------------------
const STATIC_TEMPLATES = [
  { id: 'template_1', name: '7 Days Premium Survey',  description: 'Survey offer — take a 2-min survey, unlock 7 days of Premium.',       default_subject: 'Take this survey & get 7 Days of Pepperwahl Premium for Free', emoji: '🎁' },
  { id: 'template_2', name: 'Monthly Product Drop',   description: 'Monthly product update — new features, video walkthrough, CTA.',       default_subject: 'Pepperwahl • Monthly Product Drop', emoji: '🚀' },
  { id: 'template_3', name: 'Welcome Onboarding',     description: 'Warm welcome with 3-step quick start guide for new users.',            default_subject: 'Welcome to Pepperwahl — Smarter surveys, real-time responses', emoji: '👋' },
  { id: 'template_4', name: 'Refer & Earn',           description: 'Referral program — Give $20, Get $20 in Pepperwahl Survey Credits.',   default_subject: 'Refer & Earn — Give $20, Get $20 in Pepperwahl Survey Credits', emoji: '💰' },
];

// ---------------------------------------------------------------------------
// HTML builders — each returns full HTML with config values injected
// ---------------------------------------------------------------------------
type Cfg = Record<string, string>;

function buildTemplate1(c: Cfg): string {
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/><meta content="width=device-width,initial-scale=1.0" name="viewport"/>
<title>7 Days of Pepperwahl Premium</title>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap" rel="stylesheet"/>
<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Hanken Grotesk',Arial,sans-serif;background:#fcf9f3;color:#1c1c18;}</style>
</head>
<body style="background:#fcf9f3;padding:24px 12px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e2dc;border-radius:6px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06);">
  <div style="padding:16px 24px;border-bottom:1px solid #e5e2dc;display:flex;align-items:center;justify-content:space-between;">
    <div style="display:flex;align-items:center;gap:10px;">
      <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuAb2IC0QzpqNcRwVrCH2QBZqXYI1E2GjY5CSy275qxBpfZ31jT16830LOzhE24fo-YptOev2x1rrWykZKpNS7siMdZSH1GLpJ4QeLJEUDIn3QeHigv48d2v91cdDy46YZwlhgW_TWiJm4KtCY9_TOyC3oiK3dMzE8GihxpcQ4EwLncL5dX2c0aaHSEQdfS3oCPTm3O52eB2ZknZmfiz-6O3h-PyiUy2FTgBj0hG6gr0kwtFWLPFN6FEKKatz9EcXiMpd5w" alt="Pepperwahl" width="28" height="28" style="border-radius:4px;"/>
      <span style="font-size:20px;font-weight:700;color:#7a0009;font-family:'Newsreader',Georgia,serif;">Pepperwahl</span>
    </div>
    <a href="#" style="color:#605e5c;font-size:12px;text-decoration:underline;">View in browser</a>
  </div>
  <div style="padding:32px 32px 24px;">
    <div style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:#f0eee8;border:1px solid #e5e2dc;border-radius:2px;margin-bottom:16px;">
      <span style="width:6px;height:6px;border-radius:50%;background:#9e1b1b;display:inline-block;"></span>
      <span style="font-size:11px;font-weight:600;letter-spacing:.04em;color:#1c1c18;text-transform:uppercase;">${e(c.eyebrow)}</span>
    </div>
    <h1 style="margin:0 0 12px;font-size:28px;font-weight:500;line-height:1.3;color:#1c1c18;font-family:'Newsreader',Georgia,serif;">${e(c.headline)}</h1>
    <p style="font-size:14px;color:#605e5c;line-height:1.6;">${e(c.subtext)}</p>
  </div>
  <div style="height:1px;background:#e5e2dc;margin:0 32px;"></div>
  <div style="padding:24px 32px;">
    <div style="border-left:3px solid #9e1b1b;padding-left:12px;margin-bottom:20px;">
      <p style="font-size:16px;font-weight:600;color:#1c1c18;margin-bottom:12px;">1. How often do you create surveys or forms?</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <label style="display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid #e5e2dc;border-radius:2px;font-size:14px;color:#1c1c18;"><input type="radio" name="q1" style="accent-color:#9e1b1b;"/> Daily</label>
        <label style="display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid #9e1b1b;border-radius:2px;font-size:14px;color:#1c1c18;background:#fef2f2;"><input type="radio" name="q1" checked style="accent-color:#9e1b1b;"/> Weekly</label>
        <label style="display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid #e5e2dc;border-radius:2px;font-size:14px;color:#1c1c18;"><input type="radio" name="q1" style="accent-color:#9e1b1b;"/> Monthly</label>
        <label style="display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid #e5e2dc;border-radius:2px;font-size:14px;color:#1c1c18;"><input type="radio" name="q1" style="accent-color:#9e1b1b;"/> Just starting</label>
      </div>
    </div>
    <div style="background:#f6f3ed;border:1px solid #e5e2dc;border-radius:4px;padding:18px 20px;margin-bottom:20px;">
      <p style="font-size:16px;font-weight:600;color:#1c1c18;margin-bottom:10px;">What you get with 7 Days Premium:</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
        <span style="font-size:13px;color:#1c1c18;">&#10003;&nbsp; ${e(c.feature_1)}</span>
        <span style="font-size:13px;color:#1c1c18;">&#10003;&nbsp; ${e(c.feature_2)}</span>
        <span style="font-size:13px;color:#1c1c18;">&#10003;&nbsp; ${e(c.feature_3)}</span>
        <span style="font-size:13px;color:#1c1c18;">&#10003;&nbsp; ${e(c.feature_4)}</span>
      </div>
    </div>
  </div>
  <div style="padding:8px 32px 32px;text-align:center;">
    <a href="${e(c.cta_url)}" style="display:inline-block;background:#9e1b1b;color:#fff;font-size:14px;font-weight:600;padding:14px 32px;border-radius:2px;text-decoration:none;">${e(c.cta_text)}</a>
    <p style="margin:10px 0 0;font-size:12px;color:#605e5c;">${e(c.disclaimer)}</p>
  </div>
  <div style="background:#f6f3ed;border-top:1px solid #e5e2dc;padding:28px 16px;text-align:center;">
    <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#59413e;">${e(c.footer_company)}</p>
    <div style="margin-bottom:8px;">
      <a href="#" style="font-size:11px;color:#605e5c;text-decoration:underline;margin:0 8px;">Unsubscribe</a>&bull;
      <a href="#" style="font-size:11px;color:#605e5c;text-decoration:underline;margin:0 8px;">Privacy Policy</a>&bull;
      <a href="#" style="font-size:11px;color:#605e5c;text-decoration:underline;margin:0 8px;">Contact Support</a>
    </div>
    <p style="margin:0;font-size:12px;color:#605e5c;">${e(c.footer_address)}</p>
  </div>
</div>
</body></html>`;
}

function buildTemplate2(c: Cfg): string {
  const videoSection = c.video_url
    ? `<div style="padding:24px 32px;border-bottom:1px solid #e5e2dc;">
        <p style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#605e5c;margin-bottom:12px;">Video Walkthrough</p>
        <div style="border:1px solid #e5e2dc;border-radius:4px;overflow:hidden;">
          <iframe src="${e(c.video_url)}" style="width:100%;height:280px;border:none;display:block;" allowfullscreen></iframe>
          <div style="padding:12px 16px;background:#f6f3ed;border-top:1px solid #e5e2dc;">
            <p style="margin:0;font-size:13px;color:#1c1c18;">${e(c.video_label)}</p>
          </div>
        </div>
      </div>`
    : '';
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/><meta content="width=device-width,initial-scale=1.0" name="viewport"/>
<title>Pepperwahl Monthly Product Drop</title>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600&display=swap" rel="stylesheet"/>
<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Hanken Grotesk',Arial,sans-serif;background:#fcf9f3;color:#1c1c18;}</style>
</head>
<body style="background:#fcf9f3;padding:40px 12px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e2dc;border-radius:6px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06);">
  <div style="padding:16px 24px;border-bottom:1px solid #e5e2dc;display:flex;align-items:center;justify-content:space-between;">
    <div style="display:flex;align-items:center;gap:10px;">
      <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuC9qvGcX_qyDJkCH4vxpD1KvnRwY1i6ZVKfRthLqpdCHbKj4k0s0AEwlHZ9aCVJPUlvqSAsRdVjjhx53JYbXjk6W-aFWqS-L7xVM9C50Eemzmz4PV54PpFrYAbRTNWRAnlwQsCDavq__WoXLS1kt9jngc6M67GWNnfqdZUOikD5w79bANyYrGNtjRujGEGkJ3JKI6g7Genx-Pz9q61C6PlDcAdmTWgFgZy8hh_VWrPVQFQ91vOMtItME9NIFFeP-JpGF6I" alt="Pepperwahl" width="28" height="28"/>
      <span style="font-size:20px;font-weight:700;color:#7a0009;font-family:'Newsreader',Georgia,serif;">Pepperwahl</span>
    </div>
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="font-size:11px;font-weight:600;letter-spacing:.04em;padding:2px 8px;background:#ebe8e2;color:#59413e;border-radius:2px;text-transform:uppercase;">${e(c.edition_label)}</span>
      <a href="#" style="font-size:12px;color:#605e5c;text-decoration:underline;">View in browser</a>
    </div>
  </div>
  <div style="padding:40px 32px 32px;border-bottom:1px solid #e5e2dc;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
      <span style="width:8px;height:8px;border-radius:50%;background:#9e1b1b;display:inline-block;"></span>
      <span style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#7a0009;text-transform:uppercase;">${e(c.release_label)}</span>
    </div>
    <h1 style="font-size:32px;font-weight:500;line-height:1.3;color:#1c1c18;font-family:'Newsreader',Georgia,serif;margin-bottom:12px;">${e(c.headline)}</h1>
    <p style="font-size:15px;color:#666461;line-height:1.65;">${e(c.subtext)}</p>
  </div>
  ${videoSection}
  <div style="padding:32px;">
    <p style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#605e5c;text-transform:uppercase;margin-bottom:4px;">${e(c.section_label)}</p>
    <h2 style="font-size:24px;font-weight:600;color:#1c1c18;font-family:'Newsreader',Georgia,serif;margin-bottom:24px;">${e(c.section_headline)}</h2>
    <div style="padding:20px;border:1px solid #e5e2dc;border-left:3px solid #9e1b1b;border-radius:2px;margin-bottom:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:16px;font-weight:600;color:#1c1c18;">${e(c.card1_title)}</span>
        <span style="font-size:11px;font-weight:600;padding:2px 8px;background:#ffdad6;color:#410002;border-radius:2px;">${e(c.card1_badge)}</span>
      </div>
      <p style="font-size:13px;color:#605e5c;line-height:1.6;">${e(c.card1_body)}</p>
    </div>
    <div style="padding:20px;border:1px solid #e5e2dc;border-radius:2px;margin-bottom:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:16px;font-weight:600;color:#1c1c18;">${e(c.card2_title)}</span>
        <span style="font-size:11px;font-weight:600;padding:2px 8px;background:#f0eee8;color:#59413e;border-radius:2px;">${e(c.card2_badge)}</span>
      </div>
      <p style="font-size:13px;color:#605e5c;line-height:1.6;">${e(c.card2_body)}</p>
    </div>
    <div style="padding:20px;border:1px solid #e5e2dc;border-radius:2px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:16px;font-weight:600;color:#1c1c18;">${e(c.card3_title)}</span>
        <span style="font-size:11px;font-weight:600;padding:2px 8px;background:#f0eee8;color:#59413e;border-radius:2px;">${e(c.card3_badge)}</span>
      </div>
      <p style="font-size:13px;color:#605e5c;line-height:1.6;">${e(c.card3_body)}</p>
    </div>
  </div>
  <div style="padding:32px;text-align:center;border-top:1px solid #e5e2dc;">
    <h3 style="font-size:20px;font-weight:600;color:#1c1c18;margin-bottom:8px;">${e(c.cta_headline)}</h3>
    <p style="font-size:13px;color:#605e5c;margin-bottom:24px;">${e(c.cta_subtext)}</p>
    <a href="${e(c.cta_url)}" style="display:inline-block;background:#9e1b1b;color:#fff;font-size:14px;font-weight:600;padding:14px 28px;border-radius:2px;text-decoration:none;">${e(c.cta_text)}</a>
  </div>
  <div style="background:#f6f3ed;border-top:1px solid #e5e2dc;padding:28px 16px;text-align:center;">
    <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#59413e;">${e(c.footer_company)}</p>
    <p style="margin:0 0 8px;font-size:12px;color:#605e5c;">${e(c.footer_address)}</p>
    <div>
      <a href="#" style="font-size:11px;color:#605e5c;text-decoration:underline;margin:0 6px;">Unsubscribe</a>&bull;
      <a href="#" style="font-size:11px;color:#605e5c;text-decoration:underline;margin:0 6px;">Privacy Policy</a>&bull;
      <a href="#" style="font-size:11px;color:#605e5c;text-decoration:underline;margin:0 6px;">Contact Support</a>
    </div>
  </div>
</div>
</body></html>`;
}

function buildTemplate3(c: Cfg): string {
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/><meta content="width=device-width,initial-scale=1.0" name="viewport"/>
<title>Welcome to Pepperwahl</title>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600&display=swap" rel="stylesheet"/>
<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Hanken Grotesk',Arial,sans-serif;background:#FAF7F2;color:#1c1c18;}</style>
</head>
<body style="margin:0;padding:0;background:#FAF7F2;">
<div style="background:#FAF7F2;padding:40px 12px;">
<div style="max-width:600px;margin:0 auto;">
  <!-- HEADER — table layout for Gmail compatibility -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border:1px solid #e5e2dc;border-radius:6px 6px 0 0;border-collapse:collapse;">
    <tr>
      <td style="padding:16px 24px;" valign="middle">
        <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
          <tr>
            <td valign="middle" style="padding-right:10px;">
              <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuCSaDwE_cDQ1KNn17rFS_7PeEExjcqaJWtoI_uQzCHFiPK0uSUURxE_81zv8JnvpLfvKOY3DUGcKW1wm608SE33PuC-XcBRJ7Nq92Ds9YcZPQMVpZlE-vjS4iF2DqS29ThmPjEc7tUwxNzTOKE_gkg7q9pd5oieGAfvkVTsM86MNtr8Q8UNCu_07rQWh_aJ70ShJ-2yWlBHiOjIfBUuRXsW5hijZ2IZmAxEQcu6hNKR0bhfs89F5Njqod0U3CgPZmYK51s" alt="Pepperwahl" width="28" height="28" style="border-radius:4px;display:block;"/>
            </td>
            <td valign="middle">
              <span style="font-size:20px;font-weight:700;color:#7a0009;font-family:'Newsreader',Georgia,serif;">Pepperwahl</span>
            </td>
          </tr>
        </table>
      </td>
      <td style="padding:16px 24px;text-align:right;" valign="middle">
        <a href="${e(c.open_platform_url)}" style="font-size:14px;font-weight:600;color:#7a0009;text-decoration:none;">${e(c.open_platform_text)}</a>
      </td>
    </tr>
  </table>
  <!-- BODY -->
  <div style="background:#fff;border:1px solid #e5e2dc;border-top:none;border-radius:0 0 6px 6px;padding:40px 32px;">
    <!-- Badge row — table for alignment -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-bottom:1px solid #f0eee8;padding-bottom:12px;margin-bottom:24px;">
      <tr>
        <td valign="middle" style="padding-bottom:12px;">
          <span style="display:inline-block;padding:2px 10px;border-radius:2px;background:#f0eee8;color:#605e5c;font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;">
            &#9679;&nbsp;${e(c.badge_label)}
          </span>
        </td>
        <td valign="middle" align="right" style="padding-bottom:12px;">
          <span style="font-size:11px;color:#605e5c;">${e(c.edition_label)}</span>
        </td>
      </tr>
    </table>
    <h1 style="font-size:30px;font-weight:500;line-height:1.3;color:#7a0009;font-family:'Newsreader',Georgia,serif;margin:0 0 16px;">${e(c.headline)}</h1>
    <p style="font-size:15px;color:#605e5c;line-height:1.65;margin:0 0 32px;">${e(c.subtext)}</p>
    <!-- CTA Banner — table layout -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#f6f3ed;border:1px solid #e5e2dc;border-radius:4px;margin-bottom:32px;">
      <tr>
        <td style="padding:20px 24px;" valign="middle">
          <p style="font-size:14px;font-weight:600;color:#1c1c18;margin:0 0 4px;">${e(c.cta_ready_title)}</p>
          <p style="font-size:12px;color:#605e5c;margin:0;">${e(c.cta_ready_body)}</p>
        </td>
        <td style="padding:20px 24px;" valign="middle" align="right" width="220">
          <a href="${e(c.cta_primary_url)}" style="display:inline-block;background:#9e1b1b;color:#ffffff;font-size:13px;font-weight:600;padding:10px 20px;border-radius:2px;text-decoration:none;white-space:nowrap;">${e(c.cta_primary_text)}</a>
        </td>
      </tr>
    </table>
    <!-- Divider -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:24px;">
      <tr>
        <td style="border-top:1px solid #e5e2dc;" width="45%"></td>
        <td align="center" style="padding:0 16px;white-space:nowrap;font-size:11px;color:#605e5c;letter-spacing:.08em;text-transform:uppercase;">Three-Step Quick Start</td>
        <td style="border-top:1px solid #e5e2dc;" width="45%"></td>
      </tr>
    </table>
    <!-- Steps -->
    <div style="margin-bottom:32px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid #e5e2dc;border-radius:2px;margin-bottom:8px;">
        <tr>
          <td width="48" valign="top" style="padding:16px 0 16px 20px;">
            <div style="width:32px;height:32px;background:#FAF7F2;border:1px solid #e5e2dc;border-radius:2px;text-align:center;line-height:32px;font-size:16px;font-weight:600;color:#7a0009;">1</div>
          </td>
          <td valign="top" style="padding:16px 20px 16px 12px;">
            <p style="font-size:16px;font-weight:600;color:#1c1c18;margin:0 0 4px;">${e(c.step1_title)}</p>
            <p style="font-size:13px;color:#605e5c;line-height:1.6;margin:0;">${e(c.step1_body)}</p>
          </td>
        </tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid #e5e2dc;border-radius:2px;margin-bottom:8px;">
        <tr>
          <td width="48" valign="top" style="padding:16px 0 16px 20px;">
            <div style="width:32px;height:32px;background:#FAF7F2;border:1px solid #e5e2dc;border-radius:2px;text-align:center;line-height:32px;font-size:16px;font-weight:600;color:#7a0009;">2</div>
          </td>
          <td valign="top" style="padding:16px 20px 16px 12px;">
            <p style="font-size:16px;font-weight:600;color:#1c1c18;margin:0 0 4px;">${e(c.step2_title)}</p>
            <p style="font-size:13px;color:#605e5c;line-height:1.6;margin:0;">${e(c.step2_body)}</p>
          </td>
        </tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid #e5e2dc;border-radius:2px;">
        <tr>
          <td width="48" valign="top" style="padding:16px 0 16px 20px;">
            <div style="width:32px;height:32px;background:#FAF7F2;border:1px solid #e5e2dc;border-radius:2px;text-align:center;line-height:32px;font-size:16px;font-weight:600;color:#7a0009;">3</div>
          </td>
          <td valign="top" style="padding:16px 20px 16px 12px;">
            <p style="font-size:16px;font-weight:600;color:#1c1c18;margin:0 0 4px;">${e(c.step3_title)}</p>
            <p style="font-size:13px;color:#605e5c;line-height:1.6;margin:0;">${e(c.step3_body)}</p>
          </td>
        </tr>
      </table>
    </div>
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${e(c.cta_secondary_url)}" style="display:inline-block;background:#9e1b1b;color:#ffffff;font-size:14px;font-weight:600;padding:12px 32px;border-radius:2px;text-decoration:none;margin-bottom:16px;">${e(c.cta_secondary_text)}</a>
      <br/>
      <a href="${e(c.explore_url)}" style="font-size:12px;color:#605e5c;text-decoration:underline;margin:0 12px;">${e(c.explore_text)}</a>
      &nbsp;&bull;&nbsp;
      <a href="${e(c.docs_url)}" style="font-size:12px;color:#605e5c;text-decoration:underline;margin:0 12px;">${e(c.docs_text)}</a>
    </div>
    <div style="padding:14px 16px;background:#f0eee8;border-left:2px solid #7a0009;font-size:12px;color:#59413e;line-height:1.6;">
      <strong style="color:#1c1c18;">Pro-Tip:</strong> ${e(c.pro_tip)}
    </div>
  </div>
  <!-- FOOTER -->
  <div style="background:#f6f3ed;border:1px solid #e5e2dc;border-top:none;border-radius:0 0 6px 6px;padding:28px 16px;text-align:center;margin-top:16px;">
    <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#59413e;">${e(c.footer_company)}</p>
    <p style="margin:0 0 8px;font-size:12px;color:#605e5c;">${e(c.footer_address)}</p>
    <a href="#" style="font-size:11px;color:#605e5c;text-decoration:underline;margin:0 6px;">Unsubscribe</a>&bull;
    <a href="#" style="font-size:11px;color:#605e5c;text-decoration:underline;margin:0 6px;">Privacy Policy</a>&bull;
    <a href="#" style="font-size:11px;color:#605e5c;text-decoration:underline;margin:0 6px;">Contact Support</a>
  </div>
</div>
</div>
</body></html>`;
}
function buildTemplate4(c: Cfg): string {
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/><meta content="width=device-width,initial-scale=1.0" name="viewport"/>
<title>Refer &amp; Earn</title>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600&display=swap" rel="stylesheet"/>
<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Hanken Grotesk',Arial,sans-serif;background:#fcf9f3;color:#1c1c18;}</style>
</head>
<body style="background:#fcf9f3;padding:40px 12px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e2dc;border-radius:6px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06);">
  <div style="padding:16px 24px;border-bottom:1px solid #e5e2dc;display:flex;align-items:center;justify-content:space-between;">
    <div style="display:flex;align-items:center;gap:10px;">
      <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuAQOdLDXaT5QKB2VkyxSchxdSqrqUgE2W44e6ad2k9LMEdNDcNJMWRcuLwDkwrBVxqi9W3SimUgXSVu5qzN7LGIm8xXIFu8C6loj4NX_ECdzfuE-29DQDPVGN4fO6UwTLJM1wVP9X21-0J7DQFfQtop4JYFE1W7xBajsOPbW-7xGNKdEsZbuAe2ByyuzmXSZVnxia5HG5ZTL-eIdo2jETKZpsFXk67mjw6kw5l_KuOgLR-DCe-2kpEgHjJGvYn3DzDU2Ac" alt="Pepperwahl" width="28" height="28" style="border-radius:4px;"/>
      <span style="font-size:20px;font-weight:700;color:#7a0009;font-family:'Newsreader',Georgia,serif;">Pepperwahl</span>
    </div>
    <a href="#" style="font-size:12px;color:#605e5c;text-decoration:underline;">View in browser</a>
  </div>
  <div style="padding:32px 40px;border-bottom:1px solid #e5e2dc;">
    <div style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;background:rgba(122,0,9,.08);border:1px solid rgba(122,0,9,.15);border-radius:12px;margin-bottom:16px;">
      <span style="font-size:11px;font-weight:600;letter-spacing:.04em;color:#7a0009;text-transform:uppercase;">${e(c.badge_label)}</span>
    </div>
    <h1 style="font-size:32px;font-weight:500;line-height:1.3;color:#1c1c18;font-family:'Newsreader',Georgia,serif;margin-bottom:12px;">${e(c.headline)}</h1>
    <p style="font-size:13px;color:#605e5c;line-height:1.65;margin-bottom:24px;">${e(c.subtext)}</p>
    <div style="background:#f6f3ed;border:1px solid #e5e2dc;border-radius:4px;padding:20px;">
      <div style="display:flex;justify-content:space-between;border-bottom:1px solid #e5e2dc;padding-bottom:10px;margin-bottom:14px;">
        <span style="font-size:11px;font-weight:700;letter-spacing:.04em;color:#605e5c;text-transform:uppercase;">Your Referral Ledger</span>
        <span style="font-size:11px;font-weight:600;color:#7a0009;">&#9679; Live Account Credits</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
        <div style="background:#fff;border:1px solid #e5e2dc;padding:14px;border-radius:2px;">
          <p style="font-size:11px;color:#605e5c;font-weight:600;text-transform:uppercase;margin-bottom:4px;">${e(c.stat1_label)}</p>
          <p style="font-size:30px;font-weight:600;color:#7a0009;margin-bottom:2px;">${e(c.stat1_value)}</p>
          <p style="font-size:12px;color:#605e5c;">${e(c.stat1_sub)}</p>
        </div>
        <div style="background:#fff;border:1px solid #e5e2dc;padding:14px;border-radius:2px;">
          <p style="font-size:11px;color:#605e5c;font-weight:600;text-transform:uppercase;margin-bottom:4px;">${e(c.stat2_label)}</p>
          <p style="font-size:30px;font-weight:600;color:#1c1c18;margin-bottom:2px;">${e(c.stat2_value)}</p>
          <p style="font-size:12px;color:#605e5c;">${e(c.stat2_sub)}</p>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="font-size:12px;font-weight:600;color:#1c1c18;">${e(c.milestone_label)}</span>
        <span style="font-size:12px;font-weight:600;color:#7a0009;">75%</span>
      </div>
      <div style="background:#e6e2de;border-radius:2px;height:8px;overflow:hidden;"><div style="width:75%;background:#9e1b1b;height:100%;border-radius:2px;"></div></div>
      <p style="font-size:12px;color:#605e5c;margin-top:6px;">${e(c.milestone_note)}</p>
    </div>
  </div>
  <div style="padding:28px 40px;border-bottom:1px solid #e5e2dc;background:rgba(246,243,237,.5);">
    <div style="text-align:center;margin-bottom:16px;">
      <h2 style="font-size:20px;font-weight:600;color:#1c1c18;margin-bottom:4px;">${e(c.invite_headline)}</h2>
      <p style="font-size:12px;color:#605e5c;">${e(c.invite_subtext)}</p>
    </div>
    <div style="background:#fff;border:1px solid #e5e2dc;border-radius:4px;padding:14px 16px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
      <div>
        <p style="font-size:11px;color:#605e5c;font-weight:600;text-transform:uppercase;margin-bottom:2px;">Unique Referral Code</p>
        <p style="font-size:14px;font-weight:600;color:#1c1c18;font-family:monospace;letter-spacing:.1em;">${e(c.referral_code)}</p>
      </div>
      <a href="#" style="padding:8px 16px;background:#1c1c18;color:#fff;font-size:12px;font-weight:600;text-decoration:none;border-radius:2px;white-space:nowrap;">${e(c.copy_btn_text)}</a>
    </div>
  </div>
  <div style="padding:28px 40px;border-bottom:1px solid #e5e2dc;">
    <div style="text-align:center;margin-bottom:20px;">
      <p style="font-size:11px;font-weight:700;color:#7a0009;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px;">Effortless Collaboration</p>
      <h2 style="font-size:20px;font-weight:600;color:#1c1c18;">${e(c.how_headline)}</h2>
    </div>
    <div>
      <div style="display:flex;align-items:flex-start;gap:14px;padding:14px;background:#f6f3ed;border:1px solid #e5e2dc;border-radius:4px;margin-bottom:8px;">
        <div style="width:26px;height:26px;border-radius:50%;background:#9e1b1b;color:#fff;font-size:13px;font-weight:600;flex-shrink:0;text-align:center;line-height:26px;">1</div>
        <div>
          <p style="font-size:15px;font-weight:600;color:#1c1c18;margin-bottom:2px;">${e(c.step1_title)}</p>
          <p style="font-size:13px;color:#605e5c;line-height:1.6;">${e(c.step1_body)}</p>
        </div>
      </div>
      <div style="display:flex;align-items:flex-start;gap:14px;padding:14px;background:#f6f3ed;border:1px solid #e5e2dc;border-radius:4px;margin-bottom:8px;">
        <div style="width:26px;height:26px;border-radius:50%;background:#9e1b1b;color:#fff;font-size:13px;font-weight:600;flex-shrink:0;text-align:center;line-height:26px;">2</div>
        <div>
          <p style="font-size:15px;font-weight:600;color:#1c1c18;margin-bottom:2px;">${e(c.step2_title)}</p>
          <p style="font-size:13px;color:#605e5c;line-height:1.6;">${e(c.step2_body)}</p>
        </div>
      </div>
      <div style="display:flex;align-items:flex-start;gap:14px;padding:14px;background:#f6f3ed;border:1px solid #e5e2dc;border-radius:4px;">
        <div style="width:26px;height:26px;border-radius:50%;background:#9e1b1b;color:#fff;font-size:13px;font-weight:600;flex-shrink:0;text-align:center;line-height:26px;">3</div>
        <div>
          <p style="font-size:15px;font-weight:600;color:#1c1c18;margin-bottom:2px;">${e(c.step3_title)}</p>
          <p style="font-size:13px;color:#605e5c;line-height:1.6;">${e(c.step3_body)}</p>
        </div>
      </div>
    </div>
    <div style="text-align:center;margin-top:28px;">
      <a href="${e(c.cta_url)}" style="display:inline-block;background:#9e1b1b;color:#fff;font-size:14px;font-weight:600;padding:14px 32px;border-radius:4px;text-decoration:none;">${e(c.cta_text)}</a>
      <p style="margin:10px 0 0;font-size:12px;color:#605e5c;">${e(c.disclaimer)}</p>
    </div>
  </div>
  <div style="background:#f6f3ed;border-top:1px solid #e5e2dc;padding:28px 16px;text-align:center;">
    <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#59413e;">${e(c.footer_company)}</p>
    <div style="margin-bottom:8px;">
      <a href="#" style="font-size:11px;color:#605e5c;text-decoration:underline;margin:0 6px;">Unsubscribe</a>&bull;
      <a href="#" style="font-size:11px;color:#605e5c;text-decoration:underline;margin:0 6px;">Privacy Policy</a>&bull;
      <a href="#" style="font-size:11px;color:#605e5c;text-decoration:underline;margin:0 6px;">Contact Support</a>
    </div>
    <p style="margin:0;font-size:12px;color:#605e5c;">${e(c.footer_address)}</p>
  </div>
</div>
</body></html>`;
}

// Safe HTML escaper for injected values
function e(val: string | undefined): string {
  if (!val) return '';
  return val
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Master builder — picks the right template
function buildHtml(templateId: string, config: Cfg): string {
  switch (templateId) {
    case 'template_1': return buildTemplate1(config);
    case 'template_2': return buildTemplate2(config);
    case 'template_3': return buildTemplate3(config);
    case 'template_4': return buildTemplate4(config);
    default: return '<p>Unknown template</p>';
  }
}

// Default content so preview works even before backend loads
const DEFAULT_CONFIGS: Record<string, Cfg> = {
  template_1: { eyebrow: 'SPECIAL MEMBER OFFER • 2 MIN SURVEY', headline: 'Help us craft better survey tools & unlock 7 Days of Premium Free', subtext: 'Tell us about your survey creation workflow. Your answers guide our next release.', cta_text: 'Complete Survey & Unlock 7 Days Premium →', cta_url: 'https://pepperwahl.com/survey', disclaimer: 'No credit card required. Your trial activates immediately upon submission.', feature_1: 'Unlimited responses', feature_2: 'Advanced sentiment analytics', feature_3: 'Custom domain links', feature_4: 'Export to CSV / Sheets', footer_company: 'Pepperwahl Inc.', footer_address: '© 2025 Pepperwahl Inc. 450 Mission St, Suite 400, San Francisco, CA 94105.' },
  template_2: { edition_label: 'Product Drop • October Edition', release_label: 'SCHEDULED RELEASE', headline: "What's Fresh in Pepperwahl this Month", subtext: 'Scheduled updates rolling out on the 1st of every month.', section_label: 'Architecture & Features', section_headline: 'Three Major Enhancements', card1_title: 'Smart Logic Jump', card1_badge: 'New AI Tool', card1_body: 'Automatically route respondents based on previous answers.', card2_title: 'Real-time Webhook & Slack Sync', card2_badge: 'Integration', card2_body: 'Get instant pings the moment a VIP customer submits a survey.', card3_title: 'Export to Notion & Google Sheets', card3_badge: 'Workflow', card3_body: 'Sync survey responses live into your company spreadsheets.', video_url: '', video_label: 'Watch: How to use Logic Branching in 3 minutes', cta_headline: 'Ready to accelerate your research?', cta_subtext: 'All feature updates are automatically enabled in your workspace today.', cta_text: 'Try the New Features in Pepperwahl →', cta_url: 'https://pepperwahl.com', footer_company: 'Pepperwahl Research Operations', footer_address: '© 2025 Pepperwahl Inc. 450 Mission St, Suite 400, San Francisco, CA 94105.' },
  template_3: { badge_label: 'Researcher Onboarding', edition_label: 'Edition #01 • 3 min setup', headline: 'Welcome to Pepperwahl. Smarter surveys, real-time responses, effortless insights.', subtext: "You've joined thousands of product managers and researchers gathering actionable customer intelligence.", cta_ready_title: 'Ready to explore?', cta_ready_body: 'Launch your introductory survey in less than 90 seconds.', cta_primary_text: 'Create Your First Survey Now →', cta_primary_url: 'https://pepperwahl.com/new', open_platform_text: 'Open Platform →', open_platform_url: 'https://pepperwahl.com', step1_title: 'Generate with AI in seconds', step1_body: 'Describe your goal, let Pepperwahl draft questions tailored to your audience.', step2_title: 'Distribute anywhere', step2_body: 'Share via link, embed in apps, or trigger modules directly in emails.', step3_title: 'Inspect live analytics', step3_body: 'Monitor completion rates, sentiment, and drop-off reports.', cta_secondary_text: 'Create Your First Survey Now →', cta_secondary_url: 'https://pepperwahl.com/new', explore_text: 'Explore Survey Templates', explore_url: 'https://pepperwahl.com/templates', docs_text: 'Read Quickstart Docs', docs_url: 'https://pepperwahl.com/docs', pro_tip: 'Import your existing product spec into the AI Builder prompt and watch Pepperwahl architect optimal branching logic.', footer_company: 'Pepperwahl Survey Intelligence', footer_address: '© 2025 Pepperwahl Inc. 450 Mission St, Suite 400, San Francisco, CA 94105.' },
  template_4: { badge_label: 'REFERRAL PROGRAM', headline: 'Give $20, Get $20. Grow your survey intelligence together.', subtext: "Introduce teams to Pepperwahl's AI survey builder. When they launch their first survey, you both get $20 in credits.", stat1_label: 'Total Credits Earned', stat1_value: '$60.00', stat1_sub: 'Applied to balance', stat2_label: 'Teammates Invited', stat2_value: '3 Teams', stat2_sub: 'Active researchers', milestone_label: 'Next Bonus Milestone: 4 Teams', milestone_note: '1 more invite unlocks 10,000 extra monthly response tier!', invite_headline: 'Your Personal Invite Link', invite_subtext: 'Share this link or copy your unique voucher code.', referral_code: 'PEPPER-GROW-2025', copy_btn_text: 'Copy Link', how_headline: 'How It Works', step1_title: 'Share your link or invite code', step1_body: 'Send your invite code to colleagues and product leaders.', step2_title: 'They sign up & launch their first survey', step2_body: 'Your peers receive an instant $20 signup coupon.', step3_title: 'You both receive $20 credit instantly', step3_body: 'Credits reflect against upcoming Pepperwahl Pro invoices.', cta_text: 'Send Invitations Now →', cta_url: 'https://pepperwahl.com/referral', disclaimer: 'No credit card required. Credits have no expiration date.', footer_company: 'Pepperwahl Inc.', footer_address: '© 2025 Pepperwahl Inc. 450 Mission St, Suite 400, San Francisco, CA 94105.' },
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
const AdminPepperwahlMail = () => {
  const [selectedTemplate, setSelectedTemplate] = useState('template_1');
  const [sender, setSender]   = useState<'pepperwahl' | 'moustache'>('pepperwahl');
  const [subject, setSubject] = useState(STATIC_TEMPLATES[0].default_subject);

  // Per-template configs (loaded from backend, fall back to defaults)
  const [configs, setConfigs] = useState<Record<string, Cfg>>({ ...DEFAULT_CONFIGS });

  // Editor drawer
  const [editorOpen, setEditorOpen]     = useState(false);
  const [editorTemplateId, setEditorTemplateId] = useState('template_1');

  // Custom email tags
  const [emailInput, setEmailInput]   = useState('');
  const [customEmails, setCustomEmails] = useState<string[]>([]);

  // Partners
  const [partners, setPartners]               = useState<PepperwahlPartner[]>([]);
  const [selectedPartners, setSelectedPartners] = useState<Set<string>>(new Set());
  const [partnerSearch, setPartnerSearch]     = useState('');
  const [partnersLoading, setPartnersLoading] = useState(false);

  // Schedule
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate]       = useState('');
  const [scheduleTime, setScheduleTime]       = useState('');

  // Send / preview
  const [sending, setSending]       = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewName, setPreviewName] = useState('');

  // Logs
  const [logs, setLogs]           = useState<PepperwahlLog[]>([]);
  const [logsPage, setLogsPage]   = useState(1);
  const [logsLoading, setLogsLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('compose');

  // ---- Mount ----
  useEffect(() => {
    fetchPartners('');
    fetchLogs(1);
    // Load saved configs for all 4 templates in background
    STATIC_TEMPLATES.forEach(t => {
      pepperwahlMailApi.getTemplateConfig(t.id)
        .then(cfg => setConfigs(prev => ({ ...prev, [t.id]: cfg as unknown as Cfg })))
        .catch(() => { /* keep defaults */ });
    });
  }, []);

  // ---- Fetchers ----
  const fetchPartners = useCallback(async (search: string) => {
    setPartnersLoading(true);
    try { const list = await pepperwahlMailApi.getPartners(search); setPartners(list); }
    catch { /* silent */ }
    finally { setPartnersLoading(false); }
  }, []);

  const fetchLogs = async (page: number) => {
    setLogsLoading(true);
    try { const list = await pepperwahlMailApi.getLogs(page); setLogs(list); setLogsPage(page); }
    catch { /* silent */ }
    finally { setLogsLoading(false); }
  };

  // ---- Template select ----
  const handleTemplateSelect = (id: string) => {
    setSelectedTemplate(id);
    const t = STATIC_TEMPLATES.find(t => t.id === id);
    if (t) setSubject(t.default_subject);
  };

  // ---- Editor ----
  const openEditor = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setEditorTemplateId(id);
    setEditorOpen(true);
  };

  const handleEditorSaved = (templateId: string, savedConfig: Record<string, string>) => {
    // Deep merge: keep all existing keys, overlay saved ones
    setConfigs(prev => ({
      ...prev,
      [templateId]: { ...(DEFAULT_CONFIGS[templateId] ?? {}), ...(prev[templateId] ?? {}), ...savedConfig },
    }));
  };

  // ---- Preview — built from local config, zero API needed ----
  const openPreview = (id: string) => {
    const meta = STATIC_TEMPLATES.find(t => t.id === id);
    const html = buildHtml(id, configs[id] ?? DEFAULT_CONFIGS[id]);
    setPreviewHtml(html);
    setPreviewName(`${meta?.emoji} ${meta?.name}`);
    setPreviewOpen(true);
  };

  // ---- Email tags ----
  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  const addEmailsFromInput = () => {
    const raw = emailInput.split(/[,;\n\s]+/).map(e => e.trim().toLowerCase()).filter(Boolean);
    const valid   = raw.filter(isValidEmail);
    const invalid = raw.filter(e => e && !isValidEmail(e));
    const newOnes = valid.filter(e => !customEmails.includes(e));
    if (newOnes.length)  setCustomEmails(prev => [...prev, ...newOnes]);
    if (invalid.length)  toast.error(`Invalid: ${invalid.join(', ')}`);
    setEmailInput('');
  };

  const removeEmail = (email: string) => setCustomEmails(prev => prev.filter(e => e !== email));

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); if (emailInput.trim()) addEmailsFromInput(); }
  };

  // ---- Partners ----
  const togglePartner = (id: string) => {
    const s = new Set(selectedPartners);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedPartners(s);
  };

  const toggleAllPartners = () => {
    if (selectedPartners.size === partners.length && partners.length > 0) setSelectedPartners(new Set());
    else setSelectedPartners(new Set(partners.map(p => p._id)));
  };

  // ---- Send ----
  const totalRecipients = selectedPartners.size + customEmails.length;

  const handleSend = async () => {
    if (!subject.trim())       { toast.error('Subject is required'); return; }
    if (totalRecipients === 0) { toast.error('Add at least one recipient'); return; }
    if (scheduleEnabled) {
      if (!scheduleDate || !scheduleTime) { toast.error('Select date and time for scheduling'); return; }
      if (new Date(`${scheduleDate}T${scheduleTime}`) <= new Date()) { toast.error('Scheduled time must be in the future'); return; }
    }

    setSending(true);
    try {
      const result = await pepperwahlMailApi.sendMail({
        template_id:  selectedTemplate,
        sender,
        subject:      subject.trim(),
        recipients:   customEmails,
        partner_ids:  Array.from(selectedPartners),
        rendered_html: buildHtml(selectedTemplate, configs[selectedTemplate] ?? DEFAULT_CONFIGS[selectedTemplate]),
        scheduled_at: scheduleEnabled
          ? new Date(`${scheduleDate}T${scheduleTime}`).toISOString()
          : undefined,
      });
      if (result.status === 'scheduled')
        toast.success(`Scheduled for ${new Date(result.scheduled_at!).toLocaleString()} — ${result.recipient_count} recipient(s)`);
      else
        toast.success(`Sending to ${result.recipient_count} recipient(s). Check Send Logs shortly.`);

      setCustomEmails([]);
      setSelectedPartners(new Set());
      setScheduleEnabled(false);
      setScheduleDate('');
      setScheduleTime('');
      setTimeout(() => { fetchLogs(1); setActiveTab('logs'); }, 2500);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Send failed — check backend');
    } finally {
      setSending(false);
    }
  };

  // ---- Derived ----
  const selectedTemplateMeta = STATIC_TEMPLATES.find(t => t.id === selectedTemplate);

  // =========================================================================
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pepperwahl Mail</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Send branded emails on behalf of Pepperwahl. Choose a sender, pick a template, add recipients and send.
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5 border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400">
          <Mail className="h-3 w-3" /> Pepperwahl
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="compose" className="gap-1.5 flex-1 sm:flex-none"><Send className="h-3.5 w-3.5" /> Compose &amp; Send</TabsTrigger>
          <TabsTrigger value="logs"    className="gap-1.5 flex-1 sm:flex-none"><Inbox className="h-3.5 w-3.5" /> Send Logs</TabsTrigger>
        </TabsList>

        {/* ============================================================ COMPOSE */}
        <TabsContent value="compose" className="mt-5">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">

            {/* ---- LEFT ---- */}
            <div className="space-y-5">

              {/* 1 — Sender */}
              <div className="rounded-xl border bg-card p-5 shadow-sm">
                <Label className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <AtSign className="h-4 w-4 text-muted-foreground" /> Send From
                </Label>
                <Select value={sender} onValueChange={v => setSender(v as 'pepperwahl' | 'moustache')}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pepperwahl">
                      <div className="py-0.5">
                        <p className="font-medium">support@pepperwahl.com</p>
                        <p className="text-xs text-muted-foreground">Pepperwahl branded sender</p>
                      </div>
                    </SelectItem>
                    <SelectItem value="moustache">
                      <div className="py-0.5">
                        <p className="font-medium">business@moustacheleads.com</p>
                        <p className="text-xs text-muted-foreground">MoustacheLeads business sender</p>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 2 — Template */}
              <div className="rounded-xl border bg-card p-5 shadow-sm">
                <Label className="mb-3 block text-sm font-semibold">
                  Choose Template <span className="text-red-500">*</span>
                </Label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {STATIC_TEMPLATES.map(t => (
                    <div
                      key={t.id}
                      onClick={() => handleTemplateSelect(t.id)}
                      className={`relative cursor-pointer rounded-lg border-2 p-4 transition-all duration-150 hover:shadow-md select-none ${
                        selectedTemplate === t.id
                          ? 'border-red-600 bg-red-50/60 dark:bg-red-950/20'
                          : 'border-border bg-background hover:border-red-300'
                      }`}
                    >
                      {selectedTemplate === t.id && (
                        <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white">
                          <CheckCheck className="h-3 w-3" />
                        </span>
                      )}
                      <p className="mb-0.5 text-xl">{t.emoji}</p>
                      <p className="mb-1 text-sm font-semibold leading-tight">{t.name}</p>
                      <p className="mb-3 text-xs text-muted-foreground leading-relaxed">{t.description}</p>
                      <div className="flex gap-2">
                        <Button
                          size="sm" variant="outline" className="h-7 text-xs px-2.5 gap-1"
                          onClick={e => { e.stopPropagation(); openPreview(t.id); }}
                        >
                          <Eye className="h-3 w-3" /> Preview
                        </Button>
                        <Button
                          size="sm" variant="outline" className="h-7 text-xs px-2.5 gap-1 border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400"
                          onClick={ev => openEditor(ev, t.id)}
                        >
                          <Pencil className="h-3 w-3" /> Edit Content
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3 — Subject */}
              <div className="rounded-xl border bg-card p-5 shadow-sm">
                <Label className="mb-2 block text-sm font-semibold">
                  Email Subject <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Enter email subject..."
                />
                <p className="mt-1.5 text-xs text-muted-foreground">Auto-filled from template — edit freely</p>
              </div>

              {/* 4 — Schedule */}
              <div className="rounded-xl border bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <Label className="flex items-center gap-2 text-sm font-semibold">
                    <Clock className="h-4 w-4 text-muted-foreground" /> Schedule (optional)
                  </Label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox id="sched" checked={scheduleEnabled} onCheckedChange={c => setScheduleEnabled(c as boolean)} />
                    Send later
                  </label>
                </div>
                {scheduleEnabled ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="mb-1 block text-xs text-muted-foreground">Date</Label>
                      <Input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs text-muted-foreground">Time</Label>
                      <Input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Toggle "Send later" to pick a future date and time.</p>
                )}
              </div>
            </div>

            {/* ---- RIGHT ---- */}
            <div className="space-y-5">

              {/* 5 — Custom emails */}
              <div className="rounded-xl border bg-card p-5 shadow-sm">
                <Label className="mb-1 flex items-center gap-2 text-sm font-semibold">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  Add Email Addresses
                  {customEmails.length > 0 && (
                    <Badge className="ml-1 text-xs bg-red-100 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800">
                      {customEmails.length} added
                    </Badge>
                  )}
                </Label>
                <p className="mb-3 text-xs text-muted-foreground">
                  Type an email and press <kbd className="rounded border px-1 font-mono text-[10px]">Enter</kbd> or <kbd className="rounded border px-1 font-mono text-[10px]">,</kbd> to add it as a tag.
                </p>

                {customEmails.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1.5 rounded-lg border bg-muted/30 p-2.5 max-h-32 overflow-y-auto">
                    {customEmails.map(email => (
                      <span key={email} className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400">
                        {email}
                        <button onClick={() => removeEmail(email)} className="ml-0.5 hover:opacity-70"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Input
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    onKeyDown={handleEmailKeyDown}
                    onBlur={() => { if (emailInput.trim()) addEmailsFromInput(); }}
                    placeholder="e.g. john@example.com, jane@example.com"
                    className="flex-1 text-sm"
                  />
                  <Button variant="outline" size="sm" onClick={addEmailsFromInput} disabled={!emailInput.trim()} className="gap-1 px-3">
                    <Plus className="h-3.5 w-3.5" /> Add
                  </Button>
                </div>
                {customEmails.length > 0 && (
                  <button onClick={() => setCustomEmails([])} className="mt-2 text-xs text-muted-foreground hover:text-destructive underline">
                    Clear all
                  </button>
                )}
              </div>

              {/* 6 — Partners */}
              <div className="rounded-xl border bg-card p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <Label className="flex items-center gap-2 text-sm font-semibold">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Registered Partners
                    {selectedPartners.size > 0 && (
                      <Badge className="ml-1 text-xs bg-red-100 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800">
                        {selectedPartners.size} selected
                      </Badge>
                    )}
                  </Label>
                  <div className="flex gap-1.5">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={toggleAllPartners} disabled={partners.length === 0}>
                      {selectedPartners.size === partners.length && partners.length > 0 ? 'Deselect All' : `Select All (${partners.length})`}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => fetchPartners(partnerSearch)}>
                      <RefreshCw className={`h-3.5 w-3.5 ${partnersLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>

                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={partnerSearch}
                    onChange={e => setPartnerSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && fetchPartners(partnerSearch)}
                    className="pl-9 text-sm"
                  />
                </div>

                <div className="max-h-72 overflow-y-auto rounded-lg border">
                  {partnersLoading ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                      <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Loading partners...</p>
                    </div>
                  ) : partners.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-4">
                      <Users className="h-8 w-8 opacity-20" />
                      <p className="text-sm font-medium text-muted-foreground">No partners found</p>
                      <p className="text-xs text-muted-foreground">Make sure the backend is running and users exist in the database.</p>
                      <Button variant="outline" size="sm" className="mt-1 text-xs" onClick={() => fetchPartners('')}>
                        <RefreshCw className="mr-1.5 h-3 w-3" /> Reload
                      </Button>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-10 py-2.5 pl-3">
                            <Checkbox checked={selectedPartners.size === partners.length && partners.length > 0} onCheckedChange={toggleAllPartners} />
                          </TableHead>
                          <TableHead className="py-2.5 text-xs">Username</TableHead>
                          <TableHead className="py-2.5 text-xs">Email</TableHead>
                          <TableHead className="py-2.5 text-xs">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {partners.map(p => (
                          <TableRow key={p._id} className={`cursor-pointer text-xs transition-colors ${selectedPartners.has(p._id) ? 'bg-red-50 dark:bg-red-950/10' : 'hover:bg-muted/40'}`} onClick={() => togglePartner(p._id)}>
                            <TableCell className="py-2.5 pl-3">
                              <Checkbox checked={selectedPartners.has(p._id)} onCheckedChange={() => togglePartner(p._id)} onClick={e => e.stopPropagation()} />
                            </TableCell>
                            <TableCell className="py-2.5 font-medium">{p.username || '—'}</TableCell>
                            <TableCell className="py-2.5 text-muted-foreground">{p.email}</TableCell>
                            <TableCell className="py-2.5">
                              <Badge variant="outline" className={`text-[10px] ${p.is_active ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                                {p.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>

              {/* 7 — Summary + Send */}
              <div className="rounded-xl border bg-card p-5 shadow-sm">
                <p className="mb-3 text-sm font-semibold">Ready to Send</p>
                <div className="mb-4 space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Template</span>
                    <span className="font-medium">{selectedTemplateMeta?.emoji} {selectedTemplateMeta?.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Sender</span>
                    <span className="font-medium text-xs">{sender === 'pepperwahl' ? 'support@pepperwahl.com' : 'business@moustacheleads.com'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Custom emails</span>
                    <Badge variant="secondary">{customEmails.length}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Partners selected</span>
                    <Badge variant="secondary">{selectedPartners.size}</Badge>
                  </div>
                  <div className="flex justify-between items-center border-t pt-2 mt-2">
                    <span className="font-semibold">Total recipients</span>
                    <Badge className={totalRecipients > 0 ? 'bg-red-600 hover:bg-red-600' : ''}>{totalRecipients}</Badge>
                  </div>
                  {scheduleEnabled && scheduleDate && scheduleTime && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Scheduled for</span>
                      <span className="text-xs font-medium text-amber-600">{new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => openPreview(selectedTemplate)}>
                    <Eye className="mr-1.5 h-4 w-4" /> Preview
                  </Button>
                  <Button className="flex-1 bg-red-700 hover:bg-red-800 text-white" onClick={handleSend} disabled={sending || totalRecipients === 0}>
                    {sending ? <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" />
                      : scheduleEnabled ? <Clock className="mr-1.5 h-4 w-4" />
                      : <Send className="mr-1.5 h-4 w-4" />}
                    {sending ? 'Sending…' : scheduleEnabled ? `Schedule (${totalRecipients})` : `Send (${totalRecipients})`}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ============================================================ LOGS */}
        <TabsContent value="logs" className="mt-5">
          <div className="rounded-xl border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b px-5 py-3.5">
              <h2 className="text-sm font-semibold">Send History</h2>
              <Button variant="ghost" size="sm" onClick={() => fetchLogs(logsPage)}>
                <RefreshCw className={`h-4 w-4 ${logsLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Sender</TableHead>
                    <TableHead>Recipients</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Failed</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsLoading ? (
                    <TableRow><TableCell colSpan={8} className="py-12 text-center"><RefreshCw className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>
                  ) : logs.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="py-12 text-center text-muted-foreground">No emails sent yet — send your first one from the Compose tab.</TableCell></TableRow>
                  ) : (
                    logs.map((log, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs font-medium">{STATIC_TEMPLATES.find(t => t.id === log.template_id)?.emoji} {log.template_id.replace('template_', 'T')}</TableCell>
                        <TableCell className="max-w-[180px] truncate text-xs" title={log.subject}>{log.subject}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{log.sender}</TableCell>
                        <TableCell className="text-xs">{log.recipient_count}</TableCell>
                        <TableCell><Badge variant="outline" className="border-green-200 bg-green-50 text-green-700 text-xs">{log.sent}</Badge></TableCell>
                        <TableCell>
                          {log.failed > 0
                            ? <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 text-xs gap-1"><AlertCircle className="h-3 w-3" />{log.failed}</Badge>
                            : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{log.sent_by || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {log.scheduled_at ? `Sched: ${new Date(log.scheduled_at).toLocaleString()}` : new Date(log.created_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
              <Button variant="outline" size="sm" disabled={logsPage <= 1} onClick={() => fetchLogs(logsPage - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-xs text-muted-foreground">Page {logsPage}</span>
              <Button variant="outline" size="sm" disabled={logs.length < 20} onClick={() => fetchLogs(logsPage + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ============================================================ PREVIEW MODAL */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[93vh] max-w-3xl overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b">
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>{previewName}</DialogDescription>
          </DialogHeader>
          <div className="px-4 py-4 bg-neutral-100 min-h-[580px]">
            <iframe
              key={previewHtml.slice(0, 40)}
              srcDoc={previewHtml}
              title="Email Preview"
              className="w-full rounded bg-white shadow"
              style={{ height: '560px', border: 'none', display: 'block' }}
              sandbox="allow-same-origin"
            />
          </div>
          <DialogFooter className="px-6 py-4 border-t">
            <Button variant="outline" onClick={() => { setPreviewOpen(false); openEditor(new MouseEvent('click') as unknown as React.MouseEvent, editorTemplateId); }}>
              <Pencil className="mr-1.5 h-4 w-4" /> Edit Content
            </Button>
            <Button onClick={() => setPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ EDITOR DRAWER */}
      <PepperwahlTemplateEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        templateId={editorTemplateId}
        templateName={STATIC_TEMPLATES.find(t => t.id === editorTemplateId)?.name ?? ''}
        onSaved={handleEditorSaved}
      />
    </div>
  );
};

export default AdminPepperwahlMail;
