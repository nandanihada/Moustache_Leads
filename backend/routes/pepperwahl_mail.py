"""
Pepperwahl Mail — Admin route for sending branded Pepperwahl emails.

Features:
- Send from support@pepperwahl.com (or business@moustacheleads.com)
- 4 pre-built HTML templates
- Multi-recipient via comma-separated emails or registered partners
- Live HTML preview endpoint
- Immediate send or scheduled send
- Logs every send to pepperwahl_email_logs collection
"""

import os
import ssl
import smtplib
import logging
import threading
from datetime import datetime, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import Blueprint, request, jsonify
from bson import ObjectId
from database import db_instance
from utils.auth import token_required

logger = logging.getLogger(__name__)

pepperwahl_mail_bp = Blueprint('pepperwahl_mail', __name__)

# ---------------------------------------------------------------------------
# SMTP helpers — dedicated Pepperwahl connection
# ---------------------------------------------------------------------------

def _get_pepperwahl_smtp_cfg():
    return {
        'host': os.getenv('PEPPERWAHL_SMTP_HOST', 'smtp.hostinger.com'),
        'port': int(os.getenv('PEPPERWAHL_SMTP_PORT', '465')),
        'user': os.getenv('PEPPERWAHL_SMTP_USER', ''),
        'password': os.getenv('PEPPERWAHL_SMTP_PASS', ''),
        'from_email': os.getenv('PEPPERWAHL_FROM_EMAIL', 'support@pepperwahl.com'),
        'from_name': os.getenv('PEPPERWAHL_FROM_NAME', 'Pepperwahl Support'),
    }

def _get_moustache_smtp_cfg():
    return {
        'host': os.getenv('SMTP_HOST', 'smtp.gmail.com'),
        'port': int(os.getenv('SMTP_PORT', '587')),
        'user': os.getenv('SMTP_USER', ''),
        'password': os.getenv('SMTP_PASS', ''),
        'from_email': os.getenv('FROM_EMAIL', 'business@moustacheleads.com'),
        'from_name': 'Moustache Leads',
    }

def _send_via_smtp(cfg: dict, msg) -> bool:
    """Send a pre-built MIMEMultipart message through the given SMTP config."""
    host = cfg['host']
    port = cfg['port']
    user = cfg['user']
    password = cfg['password']

    if not user or not password:
        logger.error(f"❌ SMTP not configured for {cfg['from_email']}")
        return False

    ctx = ssl.create_default_context()
    try:
        if port == 465:
            with smtplib.SMTP_SSL(host, port, context=ctx, timeout=30) as server:
                server.login(user, password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=30) as server:
                server.starttls(context=ctx)
                server.login(user, password)
                server.send_message(msg)
        return True
    except Exception as e:
        logger.error(f"❌ SMTP send failed ({host}:{port}): {e}")
        return False


def _build_mime(cfg: dict, to_list: list, subject: str, html_body: str) -> MIMEMultipart:
    """Build a MIME message with BCC for up to 50 recipients at a time."""
    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = f"{cfg['from_name']} <{cfg['from_email']}>"
    msg['To'] = cfg['from_email']  # send to self; recipients go in Bcc
    msg['Bcc'] = ', '.join(to_list)
    msg.attach(MIMEText(html_body, 'html'))
    return msg


def _do_send(cfg: dict, recipients: list, subject: str, html_body: str) -> dict:
    """Send in batches of 50 via BCC."""
    sent, failed = 0, 0
    batch_size = 50
    for i in range(0, len(recipients), batch_size):
        batch = recipients[i:i + batch_size]
        msg = _build_mime(cfg, batch, subject, html_body)
        if _send_via_smtp(cfg, msg):
            sent += len(batch)
        else:
            failed += len(batch)
    return {'sent': sent, 'failed': failed}


# ---------------------------------------------------------------------------
# Template store — all 4 HTML templates
# ---------------------------------------------------------------------------

TEMPLATES = {
    "template_1": {
        "name": "7 Days Premium Survey",
        "description": "Survey offer — take a 2-min survey and unlock 7 days of Pepperwahl Premium.",
        "default_subject": "Take this survey & get 7 Days of Pepperwahl Premium for Free",
    },
    "template_2": {
        "name": "Monthly Product Drop",
        "description": "Monthly product update — three new features, video walkthrough, CTA.",
        "default_subject": "Pepperwahl • Monthly Product Drop",
    },
    "template_3": {
        "name": "Welcome Onboarding",
        "description": "Warm welcome email with 3-step quick start guide.",
        "default_subject": "Welcome to Pepperwahl — Smarter surveys, real-time responses",
    },
    "template_4": {
        "name": "Refer & Earn",
        "description": "Referral program — Give $20, Get $20 in Pepperwahl Survey Credits.",
        "default_subject": "Refer & Earn — Give $20, Get $20 in Pepperwahl Survey Credits",
    },
}

# Full HTML bodies — stored as module-level constants
TEMPLATE_HTML = {}

TEMPLATE_HTML["template_1"] = """<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Take this survey &amp; get 7 Days of Pepperwahl Premium for Free</title>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&amp;family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<script id="tailwind-config">tailwind.config={darkMode:"class",theme:{extend:{"colors":{"primary-container":"#9e1b1b","primary":"#7a0009","surface":"#fcf9f3","surface-container-lowest":"#ffffff","surface-container":"#f0eee8","surface-container-low":"#f6f3ed","surface-variant":"#e5e2dc","on-surface":"#1c1c18","secondary":"#605e5c","on-primary":"#ffffff","outline":"#8d706d"}}}}</script>
<style>.material-symbols-outlined{font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-block;vertical-align:middle;line-height:1;}</style>
</head>
<body style="margin:0;padding:0;font-family:'Hanken Grotesk',Arial,sans-serif;background:#fcf9f3;">
<div style="width:100%;background:#fcf9f3;padding:24px 12px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e2dc;border-radius:4px;overflow:hidden;">
<!-- Header -->
<div style="padding:16px 24px;border-bottom:1px solid #e5e2dc;display:flex;align-items:center;justify-content:space-between;">
  <div style="display:flex;align-items:center;gap:10px;">
    <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuAb2IC0QzpqNcRwVrCH2QBZqXYI1E2GjY5CSy275qxBpfZ31jT16830LOzhE24fo-YptOev2x1rrWykZKpNS7siMdZSH1GLpJ4QeLJEUDIn3QeHigv48d2v91cdDy46YZwlhgW_TWiJm4KtCY9_TOyC3oiK3dMzE8GihxpcQ4EwLncL5dX2c0aaHSEQdfS3oCPTm3O52eB2ZknZmfiz-6O3h-PyiUy2FTgBj0hG6gr0kwtFWLPFN6FEKKatz9EcXiMpd5w" alt="Pepperwahl" style="width:28px;height:28px;border-radius:4px;"/>
    <span style="font-size:20px;font-weight:700;color:#7a0009;letter-spacing:-0.01em;">Pepperwahl</span>
  </div>
  <a href="#" style="color:#605e5c;font-size:12px;text-decoration:underline;">View in browser</a>
</div>
<!-- Hero -->
<div style="padding:32px 32px 24px;">
  <div style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:#f0eee8;border:1px solid #e5e2dc;border-radius:2px;margin-bottom:16px;">
    <span style="width:6px;height:6px;border-radius:50%;background:#9e1b1b;display:inline-block;"></span>
    <span style="font-size:11px;font-weight:600;letter-spacing:0.04em;color:#1c1c18;">SPECIAL MEMBER OFFER &bull; 2 MIN SURVEY</span>
  </div>
  <h1 style="margin:0 0 12px;font-size:28px;font-weight:500;line-height:36px;letter-spacing:-0.01em;color:#1c1c18;font-family:'Newsreader',Georgia,serif;">Help us craft better survey tools &amp; unlock <em style="font-style:italic;color:#7a0009;">7 Days of Premium Free</em></h1>
  <p style="margin:0;font-size:14px;color:#605e5c;line-height:22px;">Tell us about your survey creation workflow, distribution channels, and analytics needs. Your answers guide our next intelligence release.</p>
</div>
<div style="height:1px;background:#e5e2dc;margin:0 32px;"></div>
<!-- Survey questions -->
<div style="padding:24px 32px;gap:24px;display:flex;flex-direction:column;">
  <!-- Q1 -->
  <div style="border-left:3px solid #9e1b1b;padding-left:12px;">
    <p style="margin:0 0 12px;font-size:18px;font-weight:600;color:#1c1c18;">1. How often do you create surveys or forms?</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <label style="display:flex;align-items:center;gap:10px;padding:14px;border:1px solid #e5e2dc;border-radius:2px;background:#fff;cursor:pointer;"><input type="radio" name="sq1" value="Daily" style="accent-color:#9e1b1b;"/> <span style="font-size:14px;color:#1c1c18;">Daily</span></label>
      <label style="display:flex;align-items:center;gap:10px;padding:14px;border:1px solid #9e1b1b;border-radius:2px;background:#f6f3ed;cursor:pointer;"><input type="radio" name="sq1" value="Weekly" checked style="accent-color:#9e1b1b;"/> <span style="font-size:14px;color:#1c1c18;">Weekly</span></label>
      <label style="display:flex;align-items:center;gap:10px;padding:14px;border:1px solid #e5e2dc;border-radius:2px;background:#fff;cursor:pointer;"><input type="radio" name="sq1" value="Monthly" style="accent-color:#9e1b1b;"/> <span style="font-size:14px;color:#1c1c18;">Monthly</span></label>
      <label style="display:flex;align-items:center;gap:10px;padding:14px;border:1px solid #e5e2dc;border-radius:2px;background:#fff;cursor:pointer;"><input type="radio" name="sq1" value="Just starting" style="accent-color:#9e1b1b;"/> <span style="font-size:14px;color:#1c1c18;">Just starting</span></label>
    </div>
  </div>
  <!-- Premium features -->
  <div style="background:#f6f3ed;border:1px solid #e5e2dc;border-radius:2px;padding:16px 20px;">
    <p style="margin:0 0 10px;font-size:18px;font-weight:600;color:#1c1c18;">What you get with 7 Days Premium:</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
      <span style="font-size:12px;color:#1c1c18;">&#10003; Unlimited responses</span>
      <span style="font-size:12px;color:#1c1c18;">&#10003; Advanced sentiment analytics</span>
      <span style="font-size:12px;color:#1c1c18;">&#10003; Custom domain links</span>
      <span style="font-size:12px;color:#1c1c18;">&#10003; Export to CSV/Sheets</span>
    </div>
  </div>
</div>
<!-- CTA -->
<div style="padding:8px 32px 32px;text-align:center;">
  <a href="#" style="display:inline-block;background:#9e1b1b;color:#fff;font-size:14px;font-weight:600;letter-spacing:0.01em;padding:14px 32px;border-radius:2px;text-decoration:none;">Complete Survey &amp; Unlock 7 Days Premium &rarr;</a>
  <p style="margin:10px 0 0;font-size:12px;color:#605e5c;">No credit card required. Your trial activates immediately upon submission.</p>
</div>
<!-- Footer -->
<div style="background:#f6f3ed;border-top:1px solid #e5e2dc;padding:32px 16px;text-align:center;">
  <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#59413e;">Pepperwahl Inc.</p>
  <div style="margin-bottom:8px;">
    <a href="#" style="font-size:11px;color:#605e5c;text-decoration:underline;margin:0 8px;">Unsubscribe</a>
    <span style="color:#e5e2dc;">&bull;</span>
    <a href="#" style="font-size:11px;color:#605e5c;text-decoration:underline;margin:0 8px;">Privacy Policy</a>
    <span style="color:#e5e2dc;">&bull;</span>
    <a href="#" style="font-size:11px;color:#605e5c;text-decoration:underline;margin:0 8px;">Contact Support</a>
  </div>
  <p style="margin:0;font-size:12px;color:#605e5c;">&copy; 2025 Pepperwahl Inc. 450 Mission St, Suite 400, San Francisco, CA 94105.</p>
</div>
</div>
</div>
</body></html>"""

TEMPLATE_HTML["template_2"] = """<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Pepperwahl &bull; Monthly Product Drop</title>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&amp;family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600&amp;display=swap" rel="stylesheet"/>
</head>
<body style="margin:0;padding:0;font-family:'Hanken Grotesk',Arial,sans-serif;background:#fcf9f3;">
<div style="width:100%;background:#fcf9f3;padding:40px 12px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e2dc;overflow:hidden;">
<!-- Header -->
<div style="padding:16px 24px;border-bottom:1px solid #e5e2dc;display:flex;align-items:center;justify-content:space-between;">
  <div style="display:flex;align-items:center;gap:10px;">
    <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuC9qvGcX_qyDJkCH4vxpD1KvnRwY1i6ZVKfRthLqpdCHbKj4k0s0AEwlHZ9aCVJPUlvqSAsRdVjjhx53JYbXjk6W-aFWqS-L7xVM9C50Eemzmz4PV54PpFrYAbRTNWRAnlwQsCDavq__WoXLS1kt9jngc6M67GWNnfqdZUOikD5w79bANyYrGNtjRujGEGkJ3JKI6g7Genx-Pz9q61C6PlDcAdmTWgFgZy8hh_VWrPVQFQ91vOMtItME9NIFFeP-JpGF6I" alt="Pepperwahl" style="width:28px;height:28px;"/>
    <span style="font-size:20px;font-weight:700;color:#7a0009;">Pepperwahl</span>
  </div>
  <div style="display:flex;align-items:center;gap:10px;">
    <span style="font-size:11px;font-weight:600;letter-spacing:0.04em;padding:2px 8px;background:#ebe8e2;color:#59413e;border-radius:2px;">PRODUCT DROP &bull; OCTOBER EDITION</span>
    <a href="#" style="font-size:12px;color:#605e5c;text-decoration:underline;">View in browser</a>
  </div>
</div>
<!-- Hero -->
<div style="padding:40px 32px 32px;border-bottom:1px solid #e5e2dc;">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
    <span style="width:8px;height:8px;border-radius:50%;background:#9e1b1b;display:inline-block;"></span>
    <span style="font-size:11px;font-weight:700;letter-spacing:0.08em;color:#7a0009;">SCHEDULED RELEASE</span>
  </div>
  <h1 style="margin:0 0 12px;font-size:36px;font-weight:500;line-height:44px;color:#1c1c18;font-family:'Newsreader',Georgia,serif;">What&rsquo;s Fresh in Pepperwahl this Month</h1>
  <p style="margin:0;font-size:16px;color:#666461;line-height:26px;">Scheduled updates rolling out on the 1st of every month to make survey creation and data collection faster than ever.</p>
</div>
<!-- Feature cards -->
<div style="padding:32px;border-bottom:1px solid #e5e2dc;">
  <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.08em;color:#605e5c;text-transform:uppercase;">Architecture &amp; Features</p>
  <h2 style="margin:0 0 24px;font-size:26px;font-weight:600;color:#1c1c18;font-family:'Newsreader',Georgia,serif;">Three Major Enhancements</h2>
  <!-- Card 1 -->
  <div style="padding:20px;border:1px solid #e5e2dc;border-radius:2px;margin-bottom:12px;position:relative;border-left:3px solid #9e1b1b;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <span style="font-size:18px;font-weight:600;color:#1c1c18;">Smart Logic Jump</span>
      <span style="font-size:11px;font-weight:600;padding:2px 8px;background:#ffdad6;color:#410002;border-radius:2px;">New AI Tool</span>
    </div>
    <p style="margin:0;font-size:14px;color:#605e5c;line-height:22px;">Automatically route respondents based on previous answers without complex if-then rules. Our natural-language engine sets conditions dynamically.</p>
  </div>
  <!-- Card 2 -->
  <div style="padding:20px;border:1px solid #e5e2dc;border-radius:2px;margin-bottom:12px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <span style="font-size:18px;font-weight:600;color:#1c1c18;">Real-time Webhook &amp; Slack Sync</span>
      <span style="font-size:11px;font-weight:600;padding:2px 8px;background:#f0eee8;color:#59413e;border-radius:2px;">Integration</span>
    </div>
    <p style="margin:0;font-size:14px;color:#605e5c;line-height:22px;">Get instant pings the moment a VIP customer submits a survey or gives low NPS. Trigger custom channel webhooks or direct escalation threads.</p>
  </div>
  <!-- Card 3 -->
  <div style="padding:20px;border:1px solid #e5e2dc;border-radius:2px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <span style="font-size:18px;font-weight:600;color:#1c1c18;">Export to Notion &amp; Google Sheets</span>
      <span style="font-size:11px;font-weight:600;padding:2px 8px;background:#f0eee8;color:#59413e;border-radius:2px;">Workflow</span>
    </div>
    <p style="margin:0;font-size:14px;color:#605e5c;line-height:22px;">Sync survey responses live into your company spreadsheets and workspace databases. Continuous zero-latency background synchronization.</p>
  </div>
</div>
<!-- CTA -->
<div style="padding:40px 32px;text-align:center;">
  <h3 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#1c1c18;">Ready to accelerate your research?</h3>
  <p style="margin:0 0 24px;font-size:14px;color:#605e5c;">All feature updates are automatically enabled in your Pepperwahl enterprise workspace today.</p>
  <a href="#" style="display:inline-block;background:#9e1b1b;color:#fff;font-size:14px;font-weight:600;padding:14px 24px;border-radius:2px;text-decoration:none;">Try the New Features in Pepperwahl &rarr;</a>
</div>
<!-- Footer -->
<div style="background:#f6f3ed;border-top:1px solid #e5e2dc;padding:32px 16px;text-align:center;">
  <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#59413e;">Pepperwahl Research Operations</p>
  <p style="margin:0 0 10px;font-size:12px;color:#605e5c;">&copy; 2025 Pepperwahl Inc. 450 Mission St, Suite 400, San Francisco, CA 94105.</p>
  <div>
    <a href="#" style="font-size:11px;color:#605e5c;text-decoration:underline;margin:0 6px;">Unsubscribe</a>
    <span style="color:#e5e2dc;">&bull;</span>
    <a href="#" style="font-size:11px;color:#605e5c;text-decoration:underline;margin:0 6px;">Privacy Policy</a>
    <span style="color:#e5e2dc;">&bull;</span>
    <a href="#" style="font-size:11px;color:#605e5c;text-decoration:underline;margin:0 6px;">Contact Support</a>
  </div>
</div>
</div>
</div>
</body></html>"""

TEMPLATE_HTML["template_3"] = """<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Welcome to Pepperwahl</title>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&amp;family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600&amp;display=swap" rel="stylesheet"/>
</head>
<body style="margin:0;padding:0;font-family:'Hanken Grotesk',Arial,sans-serif;background:#FAF7F2;">
<div style="width:100%;background:#FAF7F2;padding:40px 12px;">
<div style="max-width:600px;margin:0 auto;">
<!-- Header -->
<div style="background:#fff;border:1px solid #e5e2dc;border-radius:4px 4px 0 0;overflow:hidden;">
  <div style="padding:16px 24px;border-bottom:1px solid #e5e2dc;display:flex;align-items:center;justify-content:space-between;">
    <div style="display:flex;align-items:center;gap:10px;">
      <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuCSaDwE_cDQ1KNn17rFS_7PeEExjcqaJWtoI_uQzCHFiPK0uSUURxE_81zv8JnvpLfvKOY3DUGcKW1wm608SE33PuC-XcBRJ7Nq92Ds9YcZPQMVpZlE-vjS4iF2DqS29ThmPjEc7tUwxNzTOKE_gkg7q9pd5oieGAfvkVTsM86MNtr8Q8UNCu_07rQWh_aJ70ShJ-2yWlBHiOjIfBUuRXsW5hijZ2IZmAxEQcu6hNKR0bhfs89F5Njqod0U3CgPZmYK51s" alt="Pepperwahl" style="width:28px;height:28px;border-radius:4px;"/>
      <span style="font-size:20px;font-weight:700;color:#7a0009;">Pepperwahl</span>
    </div>
    <a href="#" style="font-size:14px;font-weight:600;color:#7a0009;text-decoration:none;">Open Platform &rarr;</a>
  </div>
</div>
<!-- Body -->
<div style="background:#fff;border:1px solid #e5e2dc;border-top:none;padding:40px;border-radius:0 0 4px 4px;">
  <div style="border-bottom:1px solid #f0eee8;padding-bottom:12px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;">
    <span style="display:inline-flex;align-items:center;gap:6px;padding:2px 10px;border-radius:2px;background:#f0eee8;color:#605e5c;font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;"><span style="width:6px;height:6px;background:#9e1b1b;border-radius:50%;display:inline-block;"></span>Researcher Onboarding</span>
    <span style="font-size:11px;color:#605e5c;">Edition #01 &bull; 3 min setup</span>
  </div>
  <h1 style="margin:0 0 16px;font-size:36px;font-weight:500;line-height:44px;color:#7a0009;font-family:'Newsreader',Georgia,serif;">Welcome to Pepperwahl. Smarter surveys, real-time responses, effortless insights.</h1>
  <p style="margin:0 0 32px;font-size:16px;color:#605e5c;line-height:26px;">You've joined thousands of product managers, researchers, and creators gathering actionable customer intelligence with AI-generated forms.</p>
  <!-- CTA Banner -->
  <div style="background:#f6f3ed;border:1px solid #e5e2dc;border-radius:4px;padding:20px 24px;margin-bottom:40px;display:flex;align-items:center;justify-content:space-between;gap:16px;">
    <div>
      <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#1c1c18;">Ready to explore?</p>
      <p style="margin:0;font-size:12px;color:#605e5c;">Launch your introductory survey project in less than 90 seconds.</p>
    </div>
    <a href="#" style="display:inline-block;background:#9e1b1b;color:#fff;font-size:14px;font-weight:600;padding:10px 20px;border-radius:2px;text-decoration:none;white-space:nowrap;">Create Your First Survey Now &rarr;</a>
  </div>
  <div style="display:flex;align-items:center;margin-bottom:24px;">
    <div style="flex:1;height:1px;background:#e5e2dc;"></div>
    <span style="margin:0 16px;font-size:11px;color:#605e5c;letter-spacing:0.08em;text-transform:uppercase;">Three-Step Quick Start</span>
    <div style="flex:1;height:1px;background:#e5e2dc;"></div>
  </div>
  <!-- Steps -->
  <div style="margin-bottom:40px;">
    <div style="display:flex;align-items:flex-start;gap:16px;padding:16px 20px;border:1px solid #e5e2dc;border-radius:2px;margin-bottom:8px;">
      <div style="width:32px;height:32px;border-radius:2px;background:#FAF7F2;border:1px solid #e5e2dc;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:600;color:#7a0009;flex-shrink:0;">1</div>
      <div>
        <p style="margin:0 0 4px;font-size:18px;font-weight:600;color:#1c1c18;">Generate with AI in seconds</p>
        <p style="margin:0;font-size:14px;color:#605e5c;line-height:22px;">Describe your goal, let Pepperwahl draft multi-step questions and logic branching tailored to your exact audience profile.</p>
      </div>
    </div>
    <div style="display:flex;align-items:flex-start;gap:16px;padding:16px 20px;border:1px solid #e5e2dc;border-radius:2px;margin-bottom:8px;">
      <div style="width:32px;height:32px;border-radius:2px;background:#FAF7F2;border:1px solid #e5e2dc;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:600;color:#7a0009;flex-shrink:0;">2</div>
      <div>
        <p style="margin:0 0 4px;font-size:18px;font-weight:600;color:#1c1c18;">Distribute anywhere</p>
        <p style="margin:0;font-size:14px;color:#605e5c;line-height:22px;">Share via direct link, embed in web apps, or trigger frictionless single-click question modules directly in email notifications.</p>
      </div>
    </div>
    <div style="display:flex;align-items:flex-start;gap:16px;padding:16px 20px;border:1px solid #e5e2dc;border-radius:2px;">
      <div style="width:32px;height:32px;border-radius:2px;background:#FAF7F2;border:1px solid #e5e2dc;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:600;color:#7a0009;flex-shrink:0;">3</div>
      <div>
        <p style="margin:0 0 4px;font-size:18px;font-weight:600;color:#1c1c18;">Inspect live analytics</p>
        <p style="margin:0;font-size:14px;color:#605e5c;line-height:22px;">Monitor completion rates, sentiment analysis, and instant drop-off reports with archival ledger-grade clarity.</p>
      </div>
    </div>
  </div>
  <div style="text-align:center;margin-bottom:24px;">
    <a href="#" style="display:inline-block;background:#9e1b1b;color:#fff;font-size:14px;font-weight:600;padding:12px 32px;border-radius:2px;text-decoration:none;margin-bottom:16px;">Create Your First Survey Now &rarr;</a><br/>
    <a href="#" style="font-size:12px;color:#605e5c;text-decoration:underline;margin:0 12px;">Explore Survey Templates</a>
    <span style="color:#e5e2dc;">&bull;</span>
    <a href="#" style="font-size:12px;color:#605e5c;text-decoration:underline;margin:0 12px;">Read Quickstart Docs</a>
  </div>
  <div style="padding:16px;background:#f0eee8;border-left:2px solid #7a0009;border-radius:0 2px 2px 0;font-size:12px;color:#59413e;line-height:18px;">
    <strong style="color:#1c1c18;">Pro-Tip from our Lead Researcher:</strong> Import your existing product spec or discovery PRD into the AI Builder prompt, and watch Pepperwahl automatically architect optimal branching logic with zero manual scripting.
  </div>
</div>
<!-- Footer -->
<div style="background:#f6f3ed;border:1px solid #e5e2dc;border-top:none;border-radius:0 0 4px 4px;padding:32px 16px;text-align:center;margin-top:16px;">
  <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#59413e;">Pepperwahl Survey Intelligence</p>
  <p style="margin:0 0 10px;font-size:12px;color:#605e5c;">&copy; 2025 Pepperwahl Inc. 450 Mission St, Suite 400, San Francisco, CA 94105.</p>
  <div>
    <a href="#" style="font-size:11px;color:#605e5c;text-decoration:underline;margin:0 6px;">Unsubscribe</a>
    <span style="color:#e5e2dc;">&bull;</span>
    <a href="#" style="font-size:11px;color:#605e5c;text-decoration:underline;margin:0 6px;">Privacy Policy</a>
    <span style="color:#e5e2dc;">&bull;</span>
    <a href="#" style="font-size:11px;color:#605e5c;text-decoration:underline;margin:0 6px;">Contact Support</a>
  </div>
</div>
</div>
</div>
</body></html>"""

TEMPLATE_HTML["template_4"] = """<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Refer &amp; Earn &mdash; Give $20, Get $20 in Pepperwahl Survey Credits</title>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&amp;family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600&amp;display=swap" rel="stylesheet"/>
</head>
<body style="margin:0;padding:0;font-family:'Hanken Grotesk',Arial,sans-serif;background:#fcf9f3;">
<div style="width:100%;background:#fcf9f3;padding:40px 12px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e2dc;overflow:hidden;">
<!-- Header -->
<div style="padding:16px 24px;border-bottom:1px solid #e5e2dc;display:flex;align-items:center;justify-content:space-between;">
  <div style="display:flex;align-items:center;gap:10px;">
    <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuAQOdLDXaT5QKB2VkyxSchxdSqrqUgE2W44e6ad2k9LMEdNDcNJMWRcuLwDkwrBVxqi9W3SimUgXSVu5qzN7LGIm8xXIFu8C6loj4NX_ECdzfuE-29DQDPVGN4fO6UwTLJM1wVP9X21-0J7DQFfQtop4JYFE1W7xBajsOPbW-7xGNKdEsZbuAe2ByyuzmXSZVnxia5HG5ZTL-eIdo2jETKZpsFXk67mjw6kw5l_KuOgLR-DCe-2kpEgHjJGvYn3DzDU2Ac" alt="Pepperwahl" style="width:28px;height:28px;border-radius:4px;"/>
    <span style="font-size:20px;font-weight:700;color:#7a0009;">Pepperwahl</span>
  </div>
  <a href="#" style="font-size:12px;color:#605e5c;text-decoration:underline;">View in browser</a>
</div>
<!-- Hero -->
<div style="padding:32px 40px;border-bottom:1px solid #e5e2dc;">
  <div style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:rgba(122,0,9,0.1);border:1px solid rgba(122,0,9,0.2);border-radius:12px;margin-bottom:16px;">
    <span style="font-size:11px;font-weight:600;letter-spacing:0.04em;color:#7a0009;">REFERRAL PROGRAM</span>
  </div>
  <h1 style="margin:0 0 12px;font-size:36px;font-weight:500;line-height:44px;color:#1c1c18;font-family:'Newsreader',Georgia,serif;">Give $20, Get $20. Grow your survey intelligence together.</h1>
  <p style="margin:0 0 24px;font-size:14px;color:#605e5c;line-height:22px;">Introduce product teams, researchers, and marketers to Pepperwahl's AI survey builder. When they launch their first survey, you both get $20 in credits towards Pepperwahl Pro &amp; custom domains.</p>
  <!-- Stats card -->
  <div style="background:#f6f3ed;border:1px solid #e5e2dc;border-radius:4px;padding:20px;">
    <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e5e2dc;padding-bottom:12px;margin-bottom:16px;">
      <span style="font-size:11px;font-weight:700;letter-spacing:0.04em;color:#605e5c;text-transform:uppercase;">Your Referral Ledger</span>
      <span style="font-size:11px;font-weight:600;color:#7a0009;">&#9679; Live Account Credits</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
      <div style="background:#fff;border:1px solid #e5e2dc;padding:14px;border-radius:2px;">
        <p style="margin:0 0 4px;font-size:11px;color:#605e5c;text-transform:uppercase;font-weight:600;">Total Credits Earned</p>
        <p style="margin:0 0 2px;font-size:34px;font-weight:600;color:#7a0009;">$60.00</p>
        <p style="margin:0;font-size:12px;color:#605e5c;">Applied to balance</p>
      </div>
      <div style="background:#fff;border:1px solid #e5e2dc;padding:14px;border-radius:2px;">
        <p style="margin:0 0 4px;font-size:11px;color:#605e5c;text-transform:uppercase;font-weight:600;">Teammates Invited</p>
        <p style="margin:0 0 2px;font-size:34px;font-weight:600;color:#1c1c18;">3 Teams</p>
        <p style="margin:0;font-size:12px;color:#605e5c;">Active researchers</p>
      </div>
    </div>
    <div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="font-size:12px;font-weight:600;color:#1c1c18;">Next Bonus Milestone: 4 Teams</span>
        <span style="font-size:12px;font-weight:600;color:#7a0009;">75% Complete</span>
      </div>
      <div style="background:#e6e2de;border-radius:2px;height:8px;overflow:hidden;">
        <div style="width:75%;background:#9e1b1b;height:100%;border-radius:2px;"></div>
      </div>
      <p style="margin:8px 0 0;font-size:12px;color:#605e5c;">1 more invite unlocks 10,000 extra monthly response tier!</p>
    </div>
  </div>
</div>
<!-- Invite link -->
<div style="padding:32px 40px;border-bottom:1px solid #e5e2dc;background:rgba(246,243,237,0.5);">
  <div style="text-align:center;margin-bottom:20px;">
    <h2 style="margin:0 0 4px;font-size:20px;font-weight:600;color:#1c1c18;">Your Personal Invite Link</h2>
    <p style="margin:0;font-size:12px;color:#605e5c;">Share this link directly or copy your unique voucher code for checkout.</p>
  </div>
  <div style="background:#fff;border:1px solid #e5e2dc;border-radius:4px;padding:16px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
    <div>
      <p style="margin:0 0 2px;font-size:11px;color:#605e5c;font-weight:600;text-transform:uppercase;">Unique Referral Code</p>
      <p style="margin:0;font-size:14px;font-weight:600;color:#1c1c18;font-family:monospace;letter-spacing:0.1em;">PEPPER-GROW-2025</p>
    </div>
    <a href="#" style="padding:8px 16px;background:#1c1c18;color:#fff;font-size:12px;font-weight:600;text-decoration:none;border-radius:2px;white-space:nowrap;">Copy Link</a>
  </div>
</div>
<!-- How it works -->
<div style="padding:32px 40px;border-bottom:1px solid #e5e2dc;">
  <div style="text-align:center;margin-bottom:24px;">
    <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#7a0009;letter-spacing:0.08em;text-transform:uppercase;">Effortless Collaboration</p>
    <h2 style="margin:0;font-size:20px;font-weight:600;color:#1c1c18;">How It Works</h2>
  </div>
  <div>
    <div style="display:flex;align-items:flex-start;gap:16px;padding:16px;background:#f6f3ed;border:1px solid #e5e2dc;border-radius:4px;margin-bottom:8px;">
      <div style="width:28px;height:28px;border-radius:50%;background:#9e1b1b;color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;flex-shrink:0;">1</div>
      <div>
        <p style="margin:0 0 2px;font-size:18px;font-weight:600;color:#1c1c18;">Share your link or invite code</p>
        <p style="margin:0;font-size:14px;color:#605e5c;line-height:22px;">Send your bespoke invite code to colleagues, product leaders, or client research departments.</p>
      </div>
    </div>
    <div style="display:flex;align-items:flex-start;gap:16px;padding:16px;background:#f6f3ed;border:1px solid #e5e2dc;border-radius:4px;margin-bottom:8px;">
      <div style="width:28px;height:28px;border-radius:50%;background:#9e1b1b;color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;flex-shrink:0;">2</div>
      <div>
        <p style="margin:0 0 2px;font-size:18px;font-weight:600;color:#1c1c18;">They sign up &amp; launch their first survey</p>
        <p style="margin:0;font-size:14px;color:#605e5c;line-height:22px;">Your peers receive an instant $20 signup coupon to publish tailored feedback campaigns without friction.</p>
      </div>
    </div>
    <div style="display:flex;align-items:flex-start;gap:16px;padding:16px;background:#f6f3ed;border:1px solid #e5e2dc;border-radius:4px;">
      <div style="width:28px;height:28px;border-radius:50%;background:#9e1b1b;color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;flex-shrink:0;">3</div>
      <div>
        <p style="margin:0 0 2px;font-size:18px;font-weight:600;color:#1c1c18;">You both receive $20 credit instantly applied</p>
        <p style="margin:0;font-size:14px;color:#605e5c;line-height:22px;">Credits reflect automatically against upcoming Pepperwahl Pro invoices or custom domain add-ons.</p>
      </div>
    </div>
  </div>
  <div style="text-align:center;margin-top:32px;">
    <a href="#" style="display:inline-block;background:#9e1b1b;color:#fff;font-size:14px;font-weight:600;padding:14px 32px;border-radius:4px;text-decoration:none;">Send Invitations Now &rarr;</a>
    <p style="margin:10px 0 0;font-size:12px;color:#605e5c;">No credit card required for peers to trial Pepperwahl. Credits have no expiration date.</p>
  </div>
</div>
<!-- Footer -->
<div style="background:#f6f3ed;border-top:1px solid #e5e2dc;padding:32px 16px;text-align:center;">
  <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#59413e;">Pepperwahl Inc.</p>
  <div style="margin-bottom:8px;">
    <a href="#" style="font-size:11px;color:#605e5c;text-decoration:underline;margin:0 6px;">Unsubscribe</a>
    <span style="color:#e5e2dc;">&bull;</span>
    <a href="#" style="font-size:11px;color:#605e5c;text-decoration:underline;margin:0 6px;">Privacy Policy</a>
    <span style="color:#e5e2dc;">&bull;</span>
    <a href="#" style="font-size:11px;color:#605e5c;text-decoration:underline;margin:0 6px;">Contact Support</a>
  </div>
  <p style="margin:0;font-size:12px;color:#605e5c;">&copy; 2025 Pepperwahl Inc. 450 Mission St, Suite 400, San Francisco, CA 94105. All rights reserved.</p>
</div>
</div>
</div>
</body></html>"""


# ---------------------------------------------------------------------------
# Helper — log to MongoDB
# ---------------------------------------------------------------------------

def _log_send(template_id: str, sender: str, recipients: list, subject: str,
              result: dict, scheduled_at=None, sent_by: str = ''):
    try:
        col = db_instance.get_collection('pepperwahl_email_logs')
        if col is None:
            return
        col.insert_one({
            'template_id': template_id,
            'sender': sender,
            'recipient_count': len(recipients),
            'subject': subject,
            'sent': result.get('sent', 0),
            'failed': result.get('failed', 0),
            'scheduled_at': scheduled_at,
            'sent_by': sent_by,
            'created_at': datetime.now(timezone.utc),
        })
    except Exception as e:
        logger.warning(f"Log write failed: {e}")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@pepperwahl_mail_bp.route('/api/admin/pepperwahl-mail/templates', methods=['GET'])
@token_required
def get_templates():
    """Return available template metadata (no HTML)."""
    return jsonify({
        'templates': [
            {
                'id': tid,
                'name': meta['name'],
                'description': meta['description'],
                'default_subject': meta['default_subject'],
            }
            for tid, meta in TEMPLATES.items()
        ]
    })


@pepperwahl_mail_bp.route('/api/admin/pepperwahl-mail/preview', methods=['POST'])
@token_required
def preview_template():
    """Return the raw HTML for a given template (for iframe preview)."""
    data = request.get_json() or {}
    template_id = data.get('template_id', 'template_1')
    html = TEMPLATE_HTML.get(template_id)
    if not html:
        return jsonify({'error': 'Template not found'}), 404
    return jsonify({'html': html})


@pepperwahl_mail_bp.route('/api/admin/pepperwahl-mail/send', methods=['POST'])
@token_required
def send_mail():
    """
    Send or schedule a Pepperwahl email.

    Body JSON:
      template_id   : str   — one of template_1..4
      sender        : str   — 'pepperwahl' | 'moustache'
      subject       : str   — email subject (overrides default)
      recipients    : list  — list of email strings
      partner_ids   : list  — optional registered partner IDs (emails resolved server-side)
      scheduled_at  : str   — ISO datetime string; if provided, schedule instead of send now
    """
    data = request.get_json() or {}

    template_id = data.get('template_id', 'template_1')
    sender_key  = data.get('sender', 'pepperwahl')  # 'pepperwahl' or 'moustache'
    subject     = (data.get('subject') or '').strip()
    recipients  = [e.strip().lower() for e in (data.get('recipients') or []) if e.strip()]
    partner_ids = data.get('partner_ids') or []
    scheduled_at_str = data.get('scheduled_at', '')
    rendered_html = data.get('rendered_html', '')  # pre-built HTML from frontend

    # Resolve partner emails
    if partner_ids:
        try:
            users_col = db_instance.get_collection('users')
            if users_col is not None:
                oid_list = []
                for pid in partner_ids:
                    try:
                        oid_list.append(ObjectId(pid))
                    except Exception:
                        pass
                if oid_list:
                    partner_docs = users_col.find({'_id': {'$in': oid_list}}, {'email': 1})
                    for doc in partner_docs:
                        email = doc.get('email', '').strip().lower()
                        if email and email not in recipients:
                            recipients.append(email)
        except Exception as e:
            logger.warning(f"Partner email resolution failed: {e}")

    if not recipients:
        return jsonify({'error': 'No recipients provided'}), 400

    # Use the pre-built HTML from the frontend (has config values injected) if provided,
    # otherwise fall back to the static template HTML
    html_body = rendered_html if rendered_html else TEMPLATE_HTML.get(template_id)
    if not html_body:
        return jsonify({'error': 'Invalid template_id'}), 400

    if not subject:
        subject = TEMPLATES.get(template_id, {}).get('default_subject', 'Message from Pepperwahl')

    cfg = _get_pepperwahl_smtp_cfg() if sender_key == 'pepperwahl' else _get_moustache_smtp_cfg()

    # Get current admin username for logging
    try:
        current_user = getattr(request, 'current_user', None)
        sent_by = current_user.get('username', '') if current_user else ''
    except Exception:
        sent_by = ''

    # --- Scheduled send ---
    if scheduled_at_str:
        try:
            scheduled_at = datetime.fromisoformat(scheduled_at_str.replace('Z', '+00:00'))
        except Exception:
            return jsonify({'error': 'Invalid scheduled_at format. Use ISO 8601.'}), 400

        now = datetime.now(timezone.utc)
        if scheduled_at <= now:
            return jsonify({'error': 'scheduled_at must be in the future'}), 400

        delay_seconds = (scheduled_at - now).total_seconds()

        def _scheduled_job():
            import time
            time.sleep(delay_seconds)
            result = _do_send(cfg, recipients, subject, html_body)
            _log_send(template_id, cfg['from_email'], recipients, subject, result, scheduled_at, sent_by)
            logger.info(f"📧 Pepperwahl scheduled send complete: {result}")

        thread = threading.Thread(target=_scheduled_job, daemon=True,
                                  name=f'pepperwahl-scheduled-{template_id}')
        thread.start()

        _log_send(template_id, cfg['from_email'], recipients, subject,
                  {'sent': 0, 'failed': 0, 'scheduled': True}, scheduled_at, sent_by)

        return jsonify({
            'status': 'scheduled',
            'scheduled_at': scheduled_at_str,
            'recipient_count': len(recipients),
            'template_id': template_id,
            'sender': cfg['from_email'],
        })

    # --- Immediate send ---
    def _async_send():
        result = _do_send(cfg, recipients, subject, html_body)
        _log_send(template_id, cfg['from_email'], recipients, subject, result, None, sent_by)
        logger.info(f"📧 Pepperwahl send complete: {result}")

    thread = threading.Thread(target=_async_send, daemon=True,
                              name=f'pepperwahl-send-{template_id}')
    thread.start()

    return jsonify({
        'status': 'sending',
        'recipient_count': len(recipients),
        'template_id': template_id,
        'sender': cfg['from_email'],
        'message': f'Sending to {len(recipients)} recipient(s) in background.',
    })


@pepperwahl_mail_bp.route('/api/admin/pepperwahl-mail/logs', methods=['GET'])
@token_required
def get_logs():
    """Return recent send logs for the Pepperwahl mail tab."""
    try:
        col = db_instance.get_collection('pepperwahl_email_logs')
        if col is None:
            return jsonify({'logs': []})
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 20))
        skip = (page - 1) * limit
        docs = list(col.find({}, {'_id': 0}).sort('created_at', -1).skip(skip).limit(limit))
        for d in docs:
            if isinstance(d.get('created_at'), datetime):
                d['created_at'] = d['created_at'].isoformat() + 'Z'
            if isinstance(d.get('scheduled_at'), datetime):
                d['scheduled_at'] = d['scheduled_at'].isoformat() + 'Z'
        return jsonify({'logs': docs})
    except Exception as e:
        logger.error(f"Logs fetch error: {e}")
        return jsonify({'logs': []})


@pepperwahl_mail_bp.route('/api/admin/pepperwahl-mail/partners', methods=['GET'])
@token_required
def get_partners():
    """Return registered partners for recipient selection."""
    try:
        search = request.args.get('search', '').strip()
        users_col = db_instance.get_collection('users')
        if users_col is None:
            return jsonify({'partners': []})
        # Match any user that has an email — publishers, partners, or users
        # Many publishers may have role='user' or no role field
        query: dict = {'email': {'$exists': True, '$ne': ''}}
        if search:
            import re
            pattern = re.compile(re.escape(search), re.IGNORECASE)
            query['$or'] = [{'username': pattern}, {'email': pattern}]
        docs = list(users_col.find(query, {'_id': 1, 'username': 1, 'email': 1, 'is_active': 1, 'role': 1})
                    .sort('username', 1).limit(200))
        for d in docs:
            d['_id'] = str(d['_id'])
        return jsonify({'partners': docs})
    except Exception as e:
        logger.error(f"Partners fetch error: {e}")
        return jsonify({'partners': []})


# ---------------------------------------------------------------------------
# DEFAULT CONFIGS — what each template field looks like out of the box
# ---------------------------------------------------------------------------

DEFAULT_CONFIGS = {
    'template_1': {
        'headline': 'Help us craft better survey tools & unlock 7 Days of Premium Free',
        'subtext': 'Tell us about your survey creation workflow, distribution channels, and analytics needs. Your answers guide our next intelligence release.',
        'eyebrow': 'SPECIAL MEMBER OFFER • 2 MIN SURVEY',
        'cta_text': 'Complete Survey & Unlock 7 Days Premium →',
        'cta_url': 'https://pepperwahl.com',
        'disclaimer': 'No credit card required. Your trial activates immediately upon submission.',
        'feature_1': 'Unlimited responses',
        'feature_2': 'Advanced sentiment analytics',
        'feature_3': 'Custom domain links',
        'feature_4': 'Export to CSV / Sheets',
        'footer_company': 'Pepperwahl Inc.',
        'footer_address': '© 2025 Pepperwahl Inc. 450 Mission St, Suite 400, San Francisco, CA 94105.',
    },
    'template_2': {
        'edition_label': 'Product Drop • October Edition',
        'release_label': 'SCHEDULED RELEASE',
        'headline': "What's Fresh in Pepperwahl this Month",
        'subtext': 'Scheduled updates rolling out on the 1st of every month to make survey creation and data collection faster than ever.',
        'section_label': 'Architecture & Features',
        'section_headline': 'Three Major Enhancements',
        'card1_title': 'Smart Logic Jump',
        'card1_badge': 'New AI Tool',
        'card1_body': 'Automatically route respondents based on previous answers without complex if-then rules.',
        'card2_title': 'Real-time Webhook & Slack Sync',
        'card2_badge': 'Integration',
        'card2_body': 'Get instant pings the moment a VIP customer submits a survey or gives low NPS.',
        'card3_title': 'Export to Notion & Google Sheets',
        'card3_badge': 'Workflow',
        'card3_body': 'Sync survey responses live into your company spreadsheets with zero-latency synchronization.',
        'video_url': '',
        'video_label': 'Watch: How to use Automated Logic Branching in 3 minutes',
        'cta_headline': 'Ready to accelerate your research?',
        'cta_subtext': 'All feature updates are automatically enabled in your Pepperwahl enterprise workspace today.',
        'cta_text': 'Try the New Features in Pepperwahl →',
        'cta_url': 'https://pepperwahl.com',
        'footer_company': 'Pepperwahl Research Operations',
        'footer_address': '© 2025 Pepperwahl Inc. 450 Mission St, Suite 400, San Francisco, CA 94105.',
    },
    'template_3': {
        'badge_label': 'Researcher Onboarding',
        'edition_label': 'Edition #01 • 3 min setup',
        'headline': 'Welcome to Pepperwahl. Smarter surveys, real-time responses, effortless insights.',
        'subtext': "You've joined thousands of product managers, researchers, and creators gathering actionable customer intelligence with AI-generated forms.",
        'cta_ready_title': 'Ready to explore?',
        'cta_ready_body': 'Launch your introductory survey in less than 90 seconds.',
        'cta_primary_text': 'Create Your First Survey Now →',
        'cta_primary_url': 'https://pepperwahl.com/new',
        'open_platform_text': 'Open Platform →',
        'open_platform_url': 'https://pepperwahl.com',
        'step1_title': 'Generate with AI in seconds',
        'step1_body': 'Describe your goal, let Pepperwahl draft multi-step questions and logic branching tailored to your exact audience profile.',
        'step2_title': 'Distribute anywhere',
        'step2_body': 'Share via direct link, embed in web apps, or trigger single-click question modules directly in email notifications.',
        'step3_title': 'Inspect live analytics',
        'step3_body': 'Monitor completion rates, sentiment analysis, and drop-off reports with archival ledger-grade clarity.',
        'cta_secondary_text': 'Create Your First Survey Now →',
        'cta_secondary_url': 'https://pepperwahl.com/new',
        'explore_text': 'Explore Survey Templates',
        'explore_url': 'https://pepperwahl.com/templates',
        'docs_text': 'Read Quickstart Docs',
        'docs_url': 'https://pepperwahl.com/docs',
        'pro_tip': 'Import your existing product spec or PRD into the AI Builder prompt, and watch Pepperwahl automatically architect optimal branching logic with zero manual scripting.',
        'footer_company': 'Pepperwahl Survey Intelligence',
        'footer_address': '© 2025 Pepperwahl Inc. 450 Mission St, Suite 400, San Francisco, CA 94105.',
    },
    'template_4': {
        'badge_label': 'REFERRAL PROGRAM',
        'headline': 'Give $20, Get $20. Grow your survey intelligence together.',
        'subtext': "Introduce product teams, researchers, and marketers to Pepperwahl's AI survey builder. When they launch their first survey, you both get $20 in credits towards Pepperwahl Pro & custom domains.",
        'stat1_label': 'Total Credits Earned',
        'stat1_value': '$60.00',
        'stat1_sub': 'Applied to balance',
        'stat2_label': 'Teammates Invited',
        'stat2_value': '3 Teams',
        'stat2_sub': 'Active researchers',
        'milestone_label': 'Next Bonus Milestone: 4 Teams',
        'milestone_note': '1 more invite unlocks 10,000 extra monthly response tier!',
        'invite_headline': 'Your Personal Invite Link',
        'invite_subtext': 'Share this link or copy your unique voucher code.',
        'referral_code': 'PEPPER-GROW-2025',
        'copy_btn_text': 'Copy Link',
        'how_headline': 'How It Works',
        'step1_title': 'Share your link or invite code',
        'step1_body': 'Send your bespoke invite code to colleagues, product leaders, or client research departments.',
        'step2_title': 'They sign up & launch their first survey',
        'step2_body': 'Your peers receive an instant $20 signup coupon to publish tailored feedback campaigns without friction.',
        'step3_title': 'You both receive $20 credit instantly',
        'step3_body': 'Credits reflect automatically against upcoming Pepperwahl Pro invoices or custom domain add-ons.',
        'cta_text': 'Send Invitations Now →',
        'cta_url': 'https://pepperwahl.com',
        'disclaimer': 'No credit card required. Credits have no expiration date.',
        'footer_company': 'Pepperwahl Inc.',
        'footer_address': '© 2025 Pepperwahl Inc. 450 Mission St, Suite 400, San Francisco, CA 94105.',
    },
}


# ---------------------------------------------------------------------------
# Config endpoints
# ---------------------------------------------------------------------------

@pepperwahl_mail_bp.route('/api/admin/pepperwahl-mail/config/<template_id>', methods=['GET'])
@token_required
def get_template_config(template_id):
    """Return saved config for a template (falls back to defaults)."""
    if template_id not in DEFAULT_CONFIGS:
        return jsonify({'error': 'Unknown template_id'}), 404
    try:
        col = db_instance.get_collection('pepperwahl_template_configs')
        doc = col.find_one({'template_id': template_id}) if col is not None else None
        config = DEFAULT_CONFIGS[template_id].copy()
        if doc:
            saved = {k: v for k, v in doc.items() if k not in ('_id', 'template_id', 'updated_at')}
            config.update(saved)
        return jsonify({'template_id': template_id, 'config': config})
    except Exception as e:
        logger.error(f'Config GET error: {e}')
        return jsonify({'template_id': template_id, 'config': DEFAULT_CONFIGS[template_id].copy()})


@pepperwahl_mail_bp.route('/api/admin/pepperwahl-mail/config/<template_id>', methods=['POST'])
@token_required
def save_template_config(template_id):
    """Save (upsert) editable config for a template."""
    if template_id not in DEFAULT_CONFIGS:
        return jsonify({'error': 'Unknown template_id'}), 404
    data = request.get_json() or {}
    # Only allow keys that exist in the default config
    allowed_keys = set(DEFAULT_CONFIGS[template_id].keys())
    clean = {k: str(v) for k, v in data.items() if k in allowed_keys}
    if not clean:
        return jsonify({'error': 'No valid fields provided'}), 400
    try:
        col = db_instance.get_collection('pepperwahl_template_configs')
        if col is not None:
            col.update_one(
                {'template_id': template_id},
                {'$set': {**clean, 'template_id': template_id, 'updated_at': datetime.now(timezone.utc)}},
                upsert=True,
            )
        return jsonify({'status': 'saved', 'template_id': template_id, 'fields_saved': len(clean)})
    except Exception as e:
        logger.error(f'Config POST error: {e}')
        return jsonify({'error': str(e)}), 500


@pepperwahl_mail_bp.route('/api/admin/pepperwahl-mail/config/<template_id>/reset', methods=['POST'])
@token_required
def reset_template_config(template_id):
    """Delete saved config so defaults are used again."""
    if template_id not in DEFAULT_CONFIGS:
        return jsonify({'error': 'Unknown template_id'}), 404
    try:
        col = db_instance.get_collection('pepperwahl_template_configs')
        if col is not None:
            col.delete_one({'template_id': template_id})
        return jsonify({'status': 'reset', 'template_id': template_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
