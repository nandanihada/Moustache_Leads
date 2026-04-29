"""
Shared Email Template Builder
- "See More" links to a web page (no <details> — Gmail doesn't support it)
- Two preview links per offer: default (from DB) + custom (admin-added at send time)
- Both preview links get masked for tracking
- Admin controls which links show in email vs on the See More web page
"""
from datetime import datetime
import os

LOGO_URL = 'https://moustacheleads.com/logo.png'
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'https://moustacheleads.com')

ALL_FIELDS = [
    'name', 'payout', 'countries', 'category', 'network', 'image',
    'offer_id', 'preview_url', 'clicks', 'payment_terms', 'description',
]
DEFAULT_FIELDS = ['name', 'payout', 'countries', 'category', 'network', 'image', 'offer_id']


def build_offer_email_html(
    offers: list,
    recipient_name: str = '',
    subject: str = '',
    custom_message: str = '',
    template_style: str = 'table',
    visible_fields: list = None,
    see_more_fields: list = None,
    payout_type: str = 'publisher',
    default_image: str = '',
    color: str = '#f97316',
    mask_preview_links: bool = False,
    recipient_email: str = '',
    batch_id: str = '',
    payment_terms: str = '',
    per_offer_payment_terms: dict = None,
    custom_preview_urls: dict = None,
    preview_in_email: str = 'both',
    custom_preview_in_email: str = 'both',
):
    """Build a complete HTML email with offers.

    Args:
        custom_preview_urls: dict of offer_id -> custom preview URL (admin-added at send time, not saved)
        preview_in_email: where to show default preview link — 'email', 'page', or 'both'
        custom_preview_in_email: where to show custom preview link — 'email', 'page', or 'both'
    """
    if visible_fields is None:
        visible_fields = DEFAULT_FIELDS
    if see_more_fields is None:
        see_more_fields = []
    if per_offer_payment_terms is None:
        per_offer_payment_terms = {}
    if custom_preview_urls is None:
        custom_preview_urls = {}

    year = datetime.utcnow().year
    all_active = set(visible_fields) | set(see_more_fields)
    show_main = {f: (f in visible_fields) for f in ALL_FIELDS}
    show_more = {f: (f in see_more_fields) for f in ALL_FIELDS}
    has_see_more = any(show_more.get(f) for f in ALL_FIELDS)

    if default_image and default_image.startswith('/'):
        default_image = FRONTEND_URL.rstrip('/') + default_image

    processed = []
    for o in offers:
        raw_payout = float(o.get('payout', 0) or 0)
        payout = round(raw_payout * 0.8, 2) if payout_type == 'publisher' else raw_payout
        img = o.get('image_url', '') or o.get('thumbnail_url', '') or default_image
        if img and img.startswith('/'):
            img = FRONTEND_URL.rstrip('/') + img
        countries = o.get('countries', o.get('allowed_countries', []))
        if isinstance(countries, str):
            countries = [c.strip() for c in countries.split(',') if c.strip()]
        country_str = ', '.join(countries[:3]) if countries else 'Global'
        if len(countries) > 3:
            country_str += f' +{len(countries) - 3}'
        cat = o.get('category', '') or o.get('vertical', '') or ''
        if not cat and o.get('categories'):
            cat = o['categories'][0] if isinstance(o['categories'], list) and o['categories'] else ''

        offer_id = o.get('offer_id', '')
        default_preview = o.get('preview_url', '')
        custom_preview = custom_preview_urls.get(offer_id, '')

        # Mask both preview links
        masked_default = ''
        masked_custom = ''
        if mask_preview_links:
            try:
                from routes.preview_tracking import create_masked_preview_url
                if default_preview:
                    masked_default = create_masked_preview_url(
                        offer_id=offer_id, preview_url=default_preview,
                        recipient_email=recipient_email, source='email',
                        batch_id=batch_id, link_type='default',
                    )
                if custom_preview:
                    masked_custom = create_masked_preview_url(
                        offer_id=offer_id, preview_url=custom_preview,
                        recipient_email=recipient_email, source='email',
                        batch_id=batch_id, link_type='custom',
                    )
            except Exception:
                masked_default = default_preview
                masked_custom = custom_preview
        else:
            masked_default = default_preview
            masked_custom = custom_preview

        # Decide which preview links show in email vs on the page
        email_default = masked_default if preview_in_email in ('email', 'both') else ''
        email_custom = masked_custom if custom_preview_in_email in ('email', 'both') else ''
        page_default = masked_default if preview_in_email in ('page', 'both') else ''
        page_custom = masked_custom if custom_preview_in_email in ('page', 'both') else ''

        offer_payment = per_offer_payment_terms.get(offer_id, payment_terms)

        # Create "See More" page if there are see-more fields or page-only preview links
        see_more_url = ''
        if has_see_more or page_default or page_custom:
            try:
                from routes.preview_tracking import create_offer_details_page
                offer_data_for_page = {
                    'offer_id': offer_id, 'name': o.get('name', 'Offer'), 'payout': payout,
                    'category': cat, 'network': o.get('network', ''), 'countries': country_str,
                    'image_url': img, 'clicks': o.get('clicks', o.get('hits', 0)) or 0,
                    'payment_terms': offer_payment,
                    'description': o.get('description', '') or o.get('short_description', '') or '',
                }
                see_more_url = create_offer_details_page(
                    offer_data=offer_data_for_page,
                    see_more_fields=see_more_fields,
                    batch_id=batch_id,
                    recipient_email=recipient_email,
                    preview_url_for_page=page_default,
                    custom_preview_url_for_page=page_custom,
                )
            except Exception:
                pass

        processed.append({
            'offer_id': offer_id, 'name': o.get('name', 'Offer'), 'payout': payout,
            'category': cat, 'network': o.get('network', ''), 'countries': country_str,
            'image_url': img,
            'preview_url': email_default,
            'custom_preview_url': email_custom,
            'see_more_url': see_more_url,
            'clicks': o.get('clicks', o.get('hits', 0)) or 0,
            'payment_terms': offer_payment,
            'description': o.get('description', '') or o.get('short_description', '') or '',
        })

    if template_style == 'card':
        offers_html = _build_card_layout(processed, show_main, has_see_more, color)
    else:
        offers_html = _build_table_layout(processed, show_main, has_see_more)

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
    <tr><td style="padding:20px 30px 5px;">{offers_html}</td></tr>
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


def _build_preview_links_html(offer):
    """Build inline preview link buttons for an offer."""
    links = []
    if offer.get('preview_url'):
        links.append(f'<a href="{offer["preview_url"]}" style="color:#6366f1;text-decoration:none;font-size:12px;font-weight:500;" target="_blank">🔗 Preview</a>')
    if offer.get('custom_preview_url'):
        links.append(f'<a href="{offer["custom_preview_url"]}" style="color:#8b5cf6;text-decoration:none;font-size:12px;font-weight:500;" target="_blank">🔗 Preview 2</a>')
    return ' &nbsp; '.join(links)


def _build_table_layout(offers, show_main, has_see_more):
    """Build offers in table format with See More link to web page."""
    col_count = sum(1 for f in ['offer_id', 'image', 'name', 'payout', 'payment_terms',
                                 'network', 'countries', 'category', 'preview_url', 'clicks']
                    if show_main.get(f))
    if has_see_more:
        col_count += 1  # for See More column

    headers = ''
    if show_main.get('offer_id'): headers += '<th style="padding:8px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;">ID</th>'
    if show_main.get('image'): headers += '<th style="padding:8px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600;"></th>'
    if show_main.get('name'): headers += '<th style="padding:8px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;">Offer</th>'
    if show_main.get('payout'): headers += '<th style="padding:8px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;">Payout</th>'
    if show_main.get('payment_terms'): headers += '<th style="padding:8px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;">Terms</th>'
    if show_main.get('network'): headers += '<th style="padding:8px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;">Network</th>'
    if show_main.get('countries'): headers += '<th style="padding:8px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;">Countries</th>'
    if show_main.get('category'): headers += '<th style="padding:8px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;">Category</th>'
    if show_main.get('preview_url'): headers += '<th style="padding:8px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600;"></th>'
    if show_main.get('clicks'): headers += '<th style="padding:8px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;">Clicks</th>'
    if has_see_more: headers += '<th style="padding:8px;text-align:right;font-size:11px;color:#9ca3af;font-weight:600;"></th>'

    rows = ''
    for o in offers:
        row = ''
        if show_main.get('offer_id'):
            row += f'<td style="padding:10px 8px;font-size:11px;color:#9ca3af;vertical-align:middle;white-space:nowrap;">{o["offer_id"]}</td>'
        if show_main.get('image'):
            if o['image_url']:
                row += f'<td style="padding:10px 4px;vertical-align:middle;"><img src="{o["image_url"]}" alt="" style="width:36px;height:36px;border-radius:6px;object-fit:cover;" onerror="this.style.display=\'none\'" /></td>'
            else:
                row += '<td style="padding:10px 4px;vertical-align:middle;"><div style="width:36px;height:36px;border-radius:6px;background:#e5e7eb;"></div></td>'
        if show_main.get('name'):
            row += f'<td style="padding:10px 8px;vertical-align:middle;"><div style="font-size:13px;color:#111;font-weight:500;">{o["name"]}</div></td>'
        if show_main.get('payout'):
            row += f'<td style="padding:10px 8px;font-size:14px;color:#059669;font-weight:600;vertical-align:middle;white-space:nowrap;">${o["payout"]:.2f}</td>'
        if show_main.get('payment_terms'):
            terms = o.get('payment_terms', '')
            if terms:
                row += f'<td style="padding:10px 8px;vertical-align:middle;"><span style="display:inline-block;padding:2px 8px;background:#dbeafe;border-radius:4px;font-size:11px;color:#1e40af;font-weight:600;">{terms}</span></td>'
            else:
                row += '<td style="padding:10px 8px;vertical-align:middle;"></td>'
        if show_main.get('network'):
            row += f'<td style="padding:10px 8px;font-size:12px;color:#6b7280;vertical-align:middle;">{o["network"]}</td>'
        if show_main.get('countries'):
            row += f'<td style="padding:10px 8px;font-size:12px;color:#6b7280;vertical-align:middle;">{o["countries"]}</td>'
        if show_main.get('category'):
            row += f'<td style="padding:10px 8px;vertical-align:middle;"><span style="display:inline-block;padding:2px 8px;background:#f3f4f6;border-radius:4px;font-size:11px;color:#374151;">{o["category"]}</span></td>'
        if show_main.get('preview_url'):
            preview_html = _build_preview_links_html(o)
            row += f'<td style="padding:10px 8px;vertical-align:middle;">{preview_html}</td>'
        if show_main.get('clicks'):
            row += f'<td style="padding:10px 8px;font-size:13px;color:#6b7280;font-weight:500;vertical-align:middle;">{int(o.get("clicks", 0)):,}</td>'

        # See More link → opens web page
        if has_see_more and o.get('see_more_url'):
            row += f'<td style="padding:10px 8px;vertical-align:middle;text-align:right;"><a href="{o["see_more_url"]}" style="display:inline-block;padding:4px 12px;background:#f3f4f6;border-radius:6px;color:#6366f1;text-decoration:none;font-size:11px;font-weight:600;" target="_blank">See More →</a></td>'
        elif has_see_more:
            row += '<td style="padding:10px 8px;vertical-align:middle;"></td>'

        rows += f'<tr style="border-bottom:1px solid #f0f0f0;">{row}</tr>'

    return f'''<table style="width:100%;border-collapse:collapse;margin:0;">
<thead><tr style="border-bottom:2px solid #e5e7eb;">{headers}</tr></thead>
<tbody>{rows}</tbody>
</table>'''


def _build_card_layout(offers, show_main, has_see_more, color):
    """Build offers in card format with See More link."""
    cards = ''
    for i, o in enumerate(offers):
        border_top = 'border-top:1px solid #f3f4f6;' if i > 0 else ''
        img_html = ''
        if show_main.get('image'):
            if o['image_url']:
                img_html = f'<td style="width:70px;vertical-align:top;padding-right:15px;"><img src="{o["image_url"]}" alt="" style="width:60px;height:60px;object-fit:cover;border-radius:10px;display:block;" onerror="this.style.display=\'none\'" /></td>'
            else:
                img_html = f'<td style="width:70px;vertical-align:top;padding-right:15px;"><div style="width:60px;height:60px;background:linear-gradient(135deg,{color},#1a1a1a);border-radius:10px;"></div></td>'

        details = ''
        if show_main.get('name'):
            details += f'<div style="font-weight:600;font-size:15px;color:#1f2937;margin-bottom:4px;">{o["name"]}</div>'
        meta = []
        if show_main.get('payout'):
            meta.append(f'<span style="background:#fef3c7;color:#92400e;font-size:12px;font-weight:700;padding:2px 8px;border-radius:12px;">${o["payout"]:.2f}</span>')
        if show_main.get('payment_terms') and o.get('payment_terms'):
            meta.append(f'<span style="background:#dbeafe;color:#1e40af;font-size:11px;font-weight:600;padding:2px 8px;border-radius:12px;">{o["payment_terms"]}</span>')
        if show_main.get('category') and o['category']:
            meta.append(f'<span style="font-size:11px;color:#6b7280;">{o["category"]}</span>')
        if show_main.get('network') and o.get('network'):
            meta.append(f'<span style="font-size:11px;color:#6b7280;">{o["network"]}</span>')
        if show_main.get('countries'):
            meta.append(f'<span style="font-size:11px;color:#6b7280;">{o["countries"]}</span>')
        if show_main.get('offer_id'):
            meta.append(f'<span style="font-size:10px;color:#9ca3af;font-family:monospace;">{o["offer_id"]}</span>')
        if show_main.get('clicks') and o.get('clicks'):
            meta.append(f'<span style="font-size:11px;color:#6b7280;">{int(o["clicks"]):,} clicks</span>')
        if show_main.get('preview_url'):
            preview_html = _build_preview_links_html(o)
            if preview_html:
                meta.append(preview_html)
        if meta:
            details += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px;">' + ''.join(meta) + '</div>'

        if has_see_more and o.get('see_more_url'):
            details += f'<div style="margin-top:8px;"><a href="{o["see_more_url"]}" style="display:inline-block;padding:4px 14px;background:#f3f4f6;border-radius:6px;color:#6366f1;text-decoration:none;font-size:11px;font-weight:600;" target="_blank">See More →</a></div>'

        cards += f'''<tr><td style="padding:14px 0;{border_top}">
<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
{img_html}
<td style="vertical-align:top;">{details}</td>
</tr></table>
</td></tr>'''

    return f'<table width="100%" cellpadding="0" cellspacing="0" border="0">{cards}</table>'
