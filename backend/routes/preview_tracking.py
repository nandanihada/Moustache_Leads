"""
Preview Link Tracking & Offer Details Page
1. Masked preview links (moustacheleads.com/preview/{id}) — track clicks, redirect to real URL
2. Offer details page (moustacheleads.com/offer-details/{id}) — "See More" page from email
   Shows the see-more fields + any preview links that were set to show on the web page only
"""
from flask import Blueprint, redirect, request, jsonify, make_response
from database import db_instance
from utils.auth import token_required, admin_required, subadmin_or_admin_required
from utils.json_serializer import safe_json_response
from datetime import datetime, timedelta
import logging
import uuid
import os

preview_tracking_bp = Blueprint('preview_tracking', __name__)

TRACKING_BASE = os.environ.get('TRACKING_BASE_URL', 'https://offers.moustacheleads.com')
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'https://moustacheleads.com')
LOGO_URL = 'https://moustacheleads.com/logo.png'


def generate_preview_tracking_id():
    return uuid.uuid4().hex[:12]


def create_masked_preview_url(offer_id, preview_url, recipient_email='', source='email', batch_id='', link_type='default'):
    """Create a masked preview link and store the mapping in DB.
    link_type: 'default' (from offer DB) or 'custom' (admin-added at send time)
    """
    if not preview_url:
        return ''
    tracking_id = generate_preview_tracking_id()
    col = db_instance.get_collection('email_preview_links')
    if col is not None:
        col.insert_one({
            'tracking_id': tracking_id,
            'offer_id': offer_id,
            'preview_url': preview_url,
            'recipient_email': recipient_email,
            'source': source,
            'batch_id': batch_id,
            'link_type': link_type,
            'created_at': datetime.utcnow(),
            'clicked': False,
            'click_count': 0,
        })
    return f"{TRACKING_BASE}/preview/{tracking_id}"


def create_offer_details_page(offer_data, see_more_fields, batch_id='', recipient_email='',
                              preview_url_for_page='', custom_preview_url_for_page=''):
    """Create a "See More" details page for an offer. Returns the masked URL.
    offer_data: dict with offer fields (name, payout, category, etc.)
    see_more_fields: list of field keys to show on the page
    preview_url_for_page: default preview URL to show on the page (if not shown in email)
    custom_preview_url_for_page: admin-added preview URL to show on the page
    """
    page_id = generate_preview_tracking_id()
    col = db_instance.get_collection('email_offer_pages')
    if col is not None:
        col.insert_one({
            'page_id': page_id,
            'offer_id': offer_data.get('offer_id', ''),
            'offer_data': offer_data,
            'see_more_fields': see_more_fields,
            'preview_url_for_page': preview_url_for_page,
            'custom_preview_url_for_page': custom_preview_url_for_page,
            'batch_id': batch_id,
            'recipient_email': recipient_email,
            'created_at': datetime.utcnow(),
            'view_count': 0,
        })
    return f"{TRACKING_BASE}/offer-details/{page_id}"


# ── Preview link click handler ──
@preview_tracking_bp.route('/preview/<tracking_id>', methods=['GET'])
def handle_preview_click(tracking_id):
    try:
        col = db_instance.get_collection('email_preview_links')
        if col is None:
            return redirect('https://moustacheleads.com', code=302)
        link = col.find_one({'tracking_id': tracking_id})
        if not link:
            return redirect('https://moustacheleads.com', code=302)

        # If the stored preview_url is empty, redirect to homepage
        if not link.get('preview_url'):
            return redirect('https://moustacheleads.com', code=302)

        clicks_col = db_instance.get_collection('email_preview_clicks')
        if clicks_col is not None:
            clicks_col.insert_one({
                'tracking_id': tracking_id,
                'offer_id': link.get('offer_id', ''),
                'preview_url': link.get('preview_url', ''),
                'recipient_email': link.get('recipient_email', ''),
                'source': link.get('source', 'email'),
                'link_type': link.get('link_type', 'default'),
                'batch_id': link.get('batch_id', ''),
                'ip': request.remote_addr,
                'user_agent': request.headers.get('User-Agent', ''),
                'clicked_at': datetime.utcnow(),
            })
        col.update_one(
            {'tracking_id': tracking_id},
            {'$set': {'clicked': True, 'last_clicked_at': datetime.utcnow()},
             '$inc': {'click_count': 1}}
        )
        return redirect(link['preview_url'], code=302)
    except Exception as e:
        logging.error(f"Preview tracking error: {e}")
        return redirect('https://moustacheleads.com', code=302)


# ── Offer details "See More" page ──
@preview_tracking_bp.route('/offer-details/<page_id>', methods=['GET'])
def offer_details_page(page_id):
    """Render a branded offer details page with see-more fields and preview links."""
    try:
        col = db_instance.get_collection('email_offer_pages')
        if col is None:
            return redirect(FRONTEND_URL, code=302)
        page = col.find_one({'page_id': page_id})
        if not page:
            return redirect(FRONTEND_URL, code=302)

        # Track the view
        col.update_one({'page_id': page_id}, {'$inc': {'view_count': 1}})

        # Log to clicks collection
        clicks_col = db_instance.get_collection('email_preview_clicks')
        if clicks_col is not None:
            clicks_col.insert_one({
                'tracking_id': page_id,
                'offer_id': page.get('offer_id', ''),
                'recipient_email': page.get('recipient_email', ''),
                'source': 'see_more_page',
                'link_type': 'see_more',
                'batch_id': page.get('batch_id', ''),
                'ip': request.remote_addr,
                'user_agent': request.headers.get('User-Agent', ''),
                'clicked_at': datetime.utcnow(),
            })

        offer = page.get('offer_data', {})
        fields = page.get('see_more_fields', [])
        preview_url = page.get('preview_url_for_page', '')
        custom_preview_url = page.get('custom_preview_url_for_page', '')

        # Build the details HTML
        details_html = ''
        field_renderers = {
            'description': lambda: f'<div style="margin-bottom:16px;"><h3 style="font-size:12px;color:#9ca3af;text-transform:uppercase;margin:0 0 4px;">Description</h3><p style="font-size:14px;color:#374151;line-height:1.6;margin:0;">{offer.get("description", "")}</p></div>' if offer.get('description') else '',
            'payment_terms': lambda: f'<div style="margin-bottom:16px;"><h3 style="font-size:12px;color:#9ca3af;text-transform:uppercase;margin:0 0 4px;">Payment Terms</h3><span style="display:inline-block;padding:4px 14px;background:#dbeafe;border-radius:6px;font-size:13px;color:#1e40af;font-weight:600;">{offer.get("payment_terms", "")}</span></div>' if offer.get('payment_terms') else '',
            'network': lambda: f'<div style="margin-bottom:16px;"><h3 style="font-size:12px;color:#9ca3af;text-transform:uppercase;margin:0 0 4px;">Network</h3><p style="font-size:14px;color:#374151;margin:0;">{offer.get("network", "")}</p></div>' if offer.get('network') else '',
            'countries': lambda: f'<div style="margin-bottom:16px;"><h3 style="font-size:12px;color:#9ca3af;text-transform:uppercase;margin:0 0 4px;">Countries</h3><p style="font-size:14px;color:#374151;margin:0;">{offer.get("countries", "")}</p></div>' if offer.get('countries') else '',
            'category': lambda: f'<div style="margin-bottom:16px;"><h3 style="font-size:12px;color:#9ca3af;text-transform:uppercase;margin:0 0 4px;">Category</h3><span style="display:inline-block;padding:4px 12px;background:#f3f4f6;border-radius:6px;font-size:13px;color:#374151;">{offer.get("category", "")}</span></div>' if offer.get('category') else '',
            'payout': lambda: f'<div style="margin-bottom:16px;"><h3 style="font-size:12px;color:#9ca3af;text-transform:uppercase;margin:0 0 4px;">Payout</h3><span style="font-size:20px;color:#059669;font-weight:700;">${offer.get("payout", 0)}</span></div>',
            'offer_id': lambda: f'<div style="margin-bottom:16px;"><h3 style="font-size:12px;color:#9ca3af;text-transform:uppercase;margin:0 0 4px;">Offer ID</h3><code style="font-size:13px;color:#6b7280;background:#f3f4f6;padding:2px 8px;border-radius:4px;">{offer.get("offer_id", "")}</code></div>' if offer.get('offer_id') else '',
            'clicks': lambda: f'<div style="margin-bottom:16px;"><h3 style="font-size:12px;color:#9ca3af;text-transform:uppercase;margin:0 0 4px;">Clicks</h3><p style="font-size:14px;color:#374151;margin:0;">{offer.get("clicks", 0):,}</p></div>' if offer.get('clicks') else '',
            'image': lambda: f'<div style="margin-bottom:16px;"><img src="{offer.get("image_url", "")}" alt="" style="max-width:200px;border-radius:12px;" /></div>' if offer.get('image_url') else '',
        }

        for f in fields:
            renderer = field_renderers.get(f)
            if renderer:
                details_html += renderer()

        # Preview links section
        preview_section = ''
        preview_links = []
        if preview_url:
            preview_links.append(('🔗 Preview Offer', preview_url))
        if custom_preview_url:
            preview_links.append(('🔗 Additional Preview', custom_preview_url))

        if preview_links:
            links_html = ''
            for label, url in preview_links:
                links_html += f'<a href="{url}" target="_blank" style="display:inline-block;margin:0 8px 8px 0;padding:10px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600;">{label}</a>'
            preview_section = f'<div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb;">{links_html}</div>'

        # Offer header
        offer_name = offer.get('name', 'Offer Details')
        offer_img = offer.get('image_url', '')
        img_html = f'<img src="{offer_img}" alt="" style="width:80px;height:80px;border-radius:12px;object-fit:cover;margin-right:20px;" />' if offer_img else ''

        year = datetime.utcnow().year
        html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>{offer_name} - MoustacheLeads</title></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,Helvetica,sans-serif;background:#f8fafc;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;padding:30px 0;">
<tr><td align="center">
<table width="700" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<tr><td style="background:linear-gradient(135deg,#f97316 0%,#1a1a1a 100%);padding:30px;text-align:center;">
<img src="{LOGO_URL}" alt="MoustacheLeads" style="height:40px;margin-bottom:8px;" />
<h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">Offer Details</h1>
</td></tr>
<tr><td style="padding:30px;">
<div style="display:flex;align-items:center;margin-bottom:24px;">
{img_html}
<div>
<h2 style="margin:0 0 4px;font-size:20px;color:#1f2937;">{offer_name}</h2>
<span style="font-size:13px;color:#6b7280;">{offer.get('network', '')}</span>
</div>
</div>
{details_html}
{preview_section}
</td></tr>
<tr><td style="padding:0 30px 20px;text-align:center;">
<a href="{FRONTEND_URL}/publisher/signin" style="display:inline-block;background:linear-gradient(135deg,#f97316,#1a1a1a);color:#fff;padding:14px 40px;text-decoration:none;border-radius:50px;font-weight:700;font-size:14px;">Login to Dashboard →</a>
</td></tr>
<tr><td style="padding:20px 30px;text-align:center;border-top:1px solid #e5e7eb;">
<p style="margin:0;color:#9ca3af;font-size:11px;">© {year} MoustacheLeads. All rights reserved.</p>
</td></tr>
</table>
</td></tr></table>
</body></html>"""

        resp = make_response(html)
        resp.headers['Content-Type'] = 'text/html'
        return resp

    except Exception as e:
        logging.error(f"Offer details page error: {e}")
        return redirect(FRONTEND_URL, code=302)


# ── Admin analytics ──
@preview_tracking_bp.route('/api/admin/email-preview-clicks', methods=['GET'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def get_email_preview_clicks():
    try:
        page = max(1, int(request.args.get('page', 1)))
        per_page = min(int(request.args.get('per_page', 50)), 200)
        offer_id = request.args.get('offer_id', '')
        days = int(request.args.get('days', 30))

        clicks_col = db_instance.get_collection('email_preview_clicks')
        if clicks_col is None:
            return safe_json_response({'clicks': [], 'total': 0})

        query = {}
        if offer_id:
            query['offer_id'] = offer_id
        if days:
            query['clicked_at'] = {'$gte': datetime.utcnow() - timedelta(days=days)}

        total = clicks_col.count_documents(query)
        clicks = list(clicks_col.find(query).sort('clicked_at', -1).skip((page - 1) * per_page).limit(per_page))
        for c in clicks:
            c['_id'] = str(c['_id'])

        summary_pipeline = [
            {'$match': query},
            {'$group': {'_id': '$offer_id', 'total_clicks': {'$sum': 1}, 'unique_emails': {'$addToSet': '$recipient_email'}}},
            {'$project': {'offer_id': '$_id', 'total_clicks': 1, 'unique_clickers': {'$size': '$unique_emails'}}},
            {'$sort': {'total_clicks': -1}}, {'$limit': 20},
        ]
        summary = list(clicks_col.aggregate(summary_pipeline))

        return safe_json_response({
            'clicks': clicks, 'total': total, 'summary': summary,
            'pagination': {'page': page, 'per_page': per_page, 'pages': max(1, (total + per_page - 1) // per_page)},
        })
    except Exception as e:
        logging.error(f"Email preview clicks error: {e}")
        return jsonify({'error': str(e)}), 500
