"""
Shared Email Template Builder
Generates offer email HTML with configurable:
- Template style: 'table' or 'card'
- Visible fields: name, payout, countries, category, image, preview_url, clicks, etc.
- Payout type: 'publisher' (80%) or 'admin' (100%)
- Default image for offers without images
- Custom message, subject, greeting
"""
from datetime import datetime
import os

LOGO_URL = 'https://moustacheleads.com/logo.png'
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'https://moustacheleads.com')

# All possible fields admin can toggle
ALL_FIELDS = ['name', 'payout', 'countries', 'category', 'network', 'image', 'offer_id', 'preview_url', 'clicks']

DEFAULT_FIELDS = ['name', 'payout', 'countries', 'category', 'network', 'image', 'offer_id']


def build_offer_email_html(
    offers: list,
    recipient_name: str = '',
    subject: str = '',
    custom_message: str = '',
    template_style: str = 'table',  # 'table' or 'card'
    visible_fields: list = None,
    payout_type: str = 'publisher',  # 'publisher' or 'admin'
    default_image: str = '',
    color: str = '#f97316',
):
    """Build a complete HTML email with offers in table or card format."""
    if visible_fields is None:
        visible_fields = DEFAULT_FIELDS

    year = datetime.utcnow().year
    show = {f: (f in visible_fields) for f in ALL_FIELDS}

    # Convert default_image to absolute URL if relative
    if default_image and default_image.startswith('/'):
        default_image = FRONTEND_URL.rstrip('/') + default_image

    # Process offers — apply publisher payout and default image
    processed = []
    for o in offers:
        raw_payout = float(o.get('payout', 0) or 0)
        payout = round(raw_payout * 0.8, 2) if payout_type == 'publisher' else raw_payout
        img = o.get('image_url', '') or o.get('thumbnail_url', '') or default_image
        # Convert relative image URLs to absolute for email rendering
        if img and img.startswith('/'):
            img = FRONTEND_URL.rstrip('/') + img
        countries = o.get('countries', o.get('allowed_countries', []))
        if isinstance(countries, str):
            countries = [c.strip() for c in countries.split(',') if c.strip()]
        country_str = ', '.join(countries[:3]) if countries else 'Global'
        if len(countries) > 3:
            country_str += f' +{len(countries) - 3}'
        cat = o.get('category', '') or o.get('vertical', '') or o.get('categories', [''])[0] if o.get('categories') else o.get('category', '') or o.get('vertical', '')
        processed.append({
            'offer_id': o.get('offer_id', ''),
            'name': o.get('name', 'Offer'),
            'payout': payout,
            'category': cat or '',
            'network': o.get('network', ''),
            'countries': country_str,
            'image_url': img,
            'preview_url': o.get('preview_url', ''),
            'clicks': o.get('clicks', o.get('hits', 0)) or 0,
        })

    # Build offers section based on template style
    if template_style == 'card':
        offers_html = _build_card_layout(processed, show, color)
    else:
        offers_html = _build_table_layout(processed, show)

    # Custom message section
    msg_section = ''
    if custom_message:
        msg_section = f'''<tr><td style="padding:0 30px 15px;">
<div style="font-size:15px;color:#374151;line-height:1.7;background:#fff7ed;border-left:4px solid {color};padding:15px 18px;border-radius:0 8px 8px 0;white-space:pre-wrap;">{custom_message}</div>
</td></tr>'''

    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,Helvetica,sans-serif;background-color:#f8fafc;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;padding:30px 0;">
<tr><td align="center">
<table width="700" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <tr>
        <td style="background:linear-gradient(135deg,{color} 0%,#1a1a1a 100%);padding:35px 30px;text-align:center;">
            <img src="{LOGO_URL}" alt="MoustacheLeads" style="height:50px;margin-bottom:12px;display:inline-block;" />
            <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">MoustacheLeads</h1>
            <p style="margin:10px 0 0;color:rgba(255,255,255,0.9);font-size:15px;">Hey{(' ' + recipient_name) if recipient_name and recipient_name != 'there' else ''}!</p>
        </td>
    </tr>
    {msg_section}
    <tr>
        <td style="padding:20px 30px 5px;">
            {offers_html}
        </td>
    </tr>
    <tr>
        <td style="padding:20px 30px 30px;text-align:center;">
            <a href="{FRONTEND_URL}/publisher/signin" style="display:inline-block;background:linear-gradient(135deg,{color},#1a1a1a);color:#ffffff;padding:16px 50px;text-decoration:none;border-radius:50px;font-weight:800;font-size:15px;letter-spacing:0.5px;box-shadow:0 4px 15px rgba(0,0,0,0.2);">BROWSE ALL OFFERS →</a>
        </td>
    </tr>
    <tr><td style="padding:0 30px;"><div style="border-top:1px solid #e5e7eb;"></div></td></tr>
    <tr>
        <td style="padding:25px 30px;text-align:center;">
            <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">Thanks for being part of the MoustacheLeads network!</p>
            <p style="margin:0;color:#9ca3af;font-size:11px;">© {year} MoustacheLeads. All rights reserved.</p>
        </td>
    </tr>
</table>
</td></tr></table>
</body></html>"""


def _build_table_layout(offers, show):
    """Build offers in a professional table format."""
    # Build header
    headers = ''
    if show.get('offer_id'): headers += '<th style="padding:8px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;">ID</th>'
    if show.get('image'): headers += '<th style="padding:8px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600;"></th>'
    if show.get('name'): headers += '<th style="padding:8px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;">Offer</th>'
    if show.get('payout'): headers += '<th style="padding:8px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;">Payout</th>'
    if show.get('network'): headers += '<th style="padding:8px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;">Network</th>'
    if show.get('countries'): headers += '<th style="padding:8px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;">Countries</th>'
    if show.get('category'): headers += '<th style="padding:8px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;">Category</th>'
    if show.get('preview_url'): headers += '<th style="padding:8px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600;"></th>'
    if show.get('clicks'): headers += '<th style="padding:8px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;">Clicks</th>'

    # Build rows
    rows = ''
    for o in offers:
        row = ''
        if show.get('offer_id'):
            row += f'<td style="padding:10px 8px;font-size:11px;color:#9ca3af;vertical-align:middle;white-space:nowrap;">{o["offer_id"]}</td>'
        if show.get('image'):
            if o['image_url']:
                row += f'<td style="padding:10px 4px;vertical-align:middle;"><img src="{o["image_url"]}" alt="" style="width:36px;height:36px;border-radius:6px;object-fit:cover;" onerror="this.style.display=\'none\'" /></td>'
            else:
                row += '<td style="padding:10px 4px;vertical-align:middle;"><div style="width:36px;height:36px;border-radius:6px;background:#e5e7eb;"></div></td>'
        if show.get('name'):
            row += f'<td style="padding:10px 8px;vertical-align:middle;"><div style="font-size:13px;color:#111;font-weight:500;">{o["name"]}</div></td>'
        if show.get('payout'):
            row += f'<td style="padding:10px 8px;font-size:14px;color:#059669;font-weight:600;vertical-align:middle;white-space:nowrap;">${o["payout"]:.2f}</td>'
        if show.get('network'):
            row += f'<td style="padding:10px 8px;font-size:12px;color:#6b7280;vertical-align:middle;">{o["network"]}</td>'
        if show.get('countries'):
            row += f'<td style="padding:10px 8px;font-size:12px;color:#6b7280;vertical-align:middle;">{o["countries"]}</td>'
        if show.get('category'):
            row += f'<td style="padding:10px 8px;vertical-align:middle;"><span style="display:inline-block;padding:2px 8px;background:#f3f4f6;border-radius:4px;font-size:11px;color:#374151;">{o["category"]}</span></td>'
        if show.get('preview_url') and o.get('preview_url'):
            row += f'<td style="padding:10px 8px;vertical-align:middle;"><a href="{o["preview_url"]}" style="color:#6366f1;text-decoration:none;font-size:12px;" target="_blank">Preview</a></td>'
        elif show.get('preview_url'):
            row += '<td style="padding:10px 8px;vertical-align:middle;"></td>'
        if show.get('clicks'):
            row += f'<td style="padding:10px 8px;font-size:13px;color:#6b7280;font-weight:500;vertical-align:middle;">{int(o.get("clicks", 0)):,}</td>'
        rows += f'<tr style="border-bottom:1px solid #f0f0f0;">{row}</tr>'

    return f'''<table style="width:100%;border-collapse:collapse;margin:0;">
<thead><tr style="border-bottom:2px solid #e5e7eb;">{headers}</tr></thead>
<tbody>{rows}</tbody>
</table>'''


def _build_card_layout(offers, show, color):
    """Build offers in a card/list format."""
    cards = ''
    for i, o in enumerate(offers):
        border_top = 'border-top:1px solid #f3f4f6;' if i > 0 else ''
        img_html = ''
        if show.get('image'):
            if o['image_url']:
                img_html = f'<td style="width:70px;vertical-align:middle;padding-right:15px;"><img src="{o["image_url"]}" alt="" style="width:60px;height:60px;object-fit:cover;border-radius:10px;display:block;" onerror="this.style.display=\'none\'" /></td>'
            else:
                img_html = f'<td style="width:70px;vertical-align:middle;padding-right:15px;"><div style="width:60px;height:60px;background:linear-gradient(135deg,{color},#1a1a1a);border-radius:10px;display:flex;align-items:center;justify-content:center;"><span style="font-size:24px;">📋</span></div></td>'

        details = ''
        if show.get('name'):
            details += f'<div style="font-weight:600;font-size:15px;color:#1f2937;margin-bottom:4px;">{o["name"]}</div>'
        meta_parts = []
        if show.get('payout'):
            meta_parts.append(f'<span style="background:#fef3c7;color:#92400e;font-size:12px;font-weight:700;padding:2px 8px;border-radius:12px;">${o["payout"]:.2f}</span>')
        if show.get('category') and o['category']:
            meta_parts.append(f'<span style="font-size:11px;color:#6b7280;">{o["category"]}</span>')
        if show.get('network') and o.get('network'):
            meta_parts.append(f'<span style="font-size:11px;color:#6b7280;">{o["network"]}</span>')
        if show.get('countries'):
            meta_parts.append(f'<span style="font-size:11px;color:#6b7280;">{o["countries"]}</span>')
        if show.get('offer_id'):
            meta_parts.append(f'<span style="font-size:10px;color:#9ca3af;font-family:monospace;">{o["offer_id"]}</span>')
        if show.get('clicks') and o.get('clicks'):
            meta_parts.append(f'<span style="font-size:11px;color:#6b7280;">{int(o["clicks"]):,} clicks</span>')
        if meta_parts:
            details += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px;">' + ''.join(meta_parts) + '</div>'

        cards += f'''<tr><td style="padding:14px 0;{border_top}">
<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
{img_html}
<td style="vertical-align:middle;">{details}</td>
</tr></table>
</td></tr>'''

    return f'<table width="100%" cellpadding="0" cellspacing="0" border="0">{cards}</table>'
