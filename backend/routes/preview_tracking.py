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
    return f"{TRACKING_BASE}/m/{tracking_id}"


def create_offer_details_page(offer_data, see_more_fields, batch_id='', recipient_email='',
                              preview_url_for_page='', custom_preview_url_for_page='',
                              visible_fields=None):
    """Create a "See More" details page for an offer. Returns the masked URL.
    offer_data: dict with offer fields (name, payout, category, etc.)
    see_more_fields: list of field keys to show on the page
    visible_fields: list of field keys that were visible in the email (used for header display)
    preview_url_for_page: default preview URL to show on the page (if not shown in email)
    custom_preview_url_for_page: admin-added preview URL to show on the page
    """
    if visible_fields is None:
        visible_fields = []
    page_id = generate_preview_tracking_id()
    col = db_instance.get_collection('email_offer_pages')
    if col is not None:
        col.insert_one({
            'page_id': page_id,
            'offer_id': offer_data.get('offer_id', ''),
            'offer_data': offer_data,
            'see_more_fields': see_more_fields,
            'visible_fields': visible_fields,
            'preview_url_for_page': preview_url_for_page,
            'custom_preview_url_for_page': custom_preview_url_for_page,
            'batch_id': batch_id,
            'recipient_email': recipient_email,
            'created_at': datetime.utcnow(),
            'view_count': 0,
        })
    return f"{TRACKING_BASE}/offer-details/{page_id}"


# ── Old /preview/ route removed — all masked links use /m/{id} now ──
# The /preview/<offer_id> route is handled by offer_serving_bp for actual offer previews


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

        # Log to see_more_clicks collection with full details
        see_more_clicks_col = db_instance.get_collection('see_more_clicks')
        if see_more_clicks_col is not None:
            see_more_clicks_col.insert_one({
                'page_id': page_id,
                'offer_id': page.get('offer_id', ''),
                'offer_name': page.get('offer_data', {}).get('name', ''),
                'recipient_email': page.get('recipient_email', ''),
                'batch_id': page.get('batch_id', ''),
                'ip': request.remote_addr,
                'user_agent': request.headers.get('User-Agent', ''),
                'referer': request.headers.get('Referer', ''),
                'accept_language': request.headers.get('Accept-Language', ''),
                'clicked_at': datetime.utcnow(),
            })

        offer = page.get('offer_data', {})
        fields = page.get('see_more_fields', [])
        # Also check visible_fields to determine what was shown in the email
        visible_fields = page.get('visible_fields', [])
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
            preview_links.append(('🔗 Preview Link', preview_url))
        if custom_preview_url:
            preview_links.append(('🔗 Preview Link', custom_preview_url))

        if preview_links:
            links_html = ''
            for label, url in preview_links:
                links_html += f'<a href="{url}" target="_blank" style="display:inline-block;margin:0 8px 8px 0;padding:10px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600;">{label}</a>'
            preview_section = f'<div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb;">{links_html}</div>'

        # Offer header — only show network if it's in visible or see-more fields
        offer_name = offer.get('name', 'Offer Details')
        offer_img = offer.get('image_url', '')
        img_html = f'<img src="{offer_img}" alt="" style="width:80px;height:80px;border-radius:12px;object-fit:cover;margin-right:20px;" />' if offer_img else ''
        network_html = f'<span style="font-size:13px;color:#6b7280;">{offer.get("network", "")}</span>' if ('network' in fields or 'network' in visible_fields) and offer.get('network') else ''

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
{network_html}
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


# ══════════════════════════════════════════════════════════════
# Link Masking System — reusable masked links with full tracking
# ══════════════════════════════════════════════════════════════

@preview_tracking_bp.route('/api/admin/mask-link', methods=['POST'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def create_masked_link():
    """Create a masked link from any URL. Returns a moustacheleads.com/m/{id} link.
    The masked link tracks every click with full details.
    """
    try:
        data = request.get_json() or {}
        original_url = (data.get('url') or '').strip()
        offer_id = data.get('offer_id', '')
        offer_name = data.get('offer_name', '')
        label = data.get('label', '')  # optional label like "Preview", "Landing Page"
        admin_user = request.current_user

        if not original_url:
            return jsonify({'error': 'url is required'}), 400

        # Validate URL format
        if not original_url.startswith('http://') and not original_url.startswith('https://'):
            original_url = 'https://' + original_url

        link_id = uuid.uuid4().hex[:10]
        col = db_instance.get_collection('masked_links')
        if col is None:
            return jsonify({'error': 'Database not available'}), 500

        doc = {
            'link_id': link_id,
            'original_url': original_url,
            'offer_id': offer_id,
            'offer_name': offer_name,
            'label': label,
            'created_by': admin_user.get('username', 'admin'),
            'created_at': datetime.utcnow(),
            'click_count': 0,
            'is_active': True,
        }
        col.insert_one(doc)

        masked_url = f"{TRACKING_BASE}/m/{link_id}"

        return jsonify({
            'success': True,
            'masked_url': masked_url,
            'link_id': link_id,
            'original_url': original_url,
        })

    except Exception as e:
        logging.error(f"Create masked link error: {e}")
        return jsonify({'error': str(e)}), 500


@preview_tracking_bp.route('/m/<link_id>', methods=['GET'])
def handle_masked_link_click(link_id):
    """Handle a masked link click — checks both masked_links and email_preview_links collections."""
    try:
        logging.info(f"🔗 Masked link click: /m/{link_id}")

        # First check masked_links (created via LinkMasker)
        col = db_instance.get_collection('masked_links')
        link = None
        link_source = 'masked'
        if col is not None:
            link = col.find_one({'link_id': link_id, 'is_active': True})
            if link:
                logging.info(f"🔗 Found in masked_links: {link.get('original_url', '')[:50]}")

        # Fallback: check email_preview_links (created by email template builder)
        if not link:
            preview_col = db_instance.get_collection('email_preview_links')
            if preview_col is not None:
                link = preview_col.find_one({'tracking_id': link_id})
                if link:
                    link_source = 'email_preview'
                    link['original_url'] = link.get('preview_url', '')
                    link['offer_name'] = ''
                    logging.info(f"🔗 Found in email_preview_links: {link.get('original_url', '')[:50]}")

        if not link or not link.get('original_url'):
            logging.warning(f"🔗 Link not found for ID: {link_id}")
            return redirect('https://moustacheleads.com', code=302)

        # Log the click with full details
        clicks_col = db_instance.get_collection('masked_link_clicks')
        if clicks_col is not None:
            clicks_col.insert_one({
                'link_id': link_id,
                'original_url': link['original_url'],
                'offer_id': link.get('offer_id', ''),
                'offer_name': link.get('offer_name', ''),
                'label': link.get('label', ''),
                'link_source': link_source,
                'ip': request.remote_addr,
                'user_agent': request.headers.get('User-Agent', ''),
                'referer': request.headers.get('Referer', ''),
                'accept_language': request.headers.get('Accept-Language', ''),
                'clicked_at': datetime.utcnow(),
            })

        # Increment click count on the source collection
        if link_source == 'masked' and col is not None:
            col.update_one({'link_id': link_id}, {'$inc': {'click_count': 1}, '$set': {'last_clicked_at': datetime.utcnow()}})
        elif link_source == 'email_preview':
            preview_col = db_instance.get_collection('email_preview_links')
            if preview_col is not None:
                preview_col.update_one({'tracking_id': link_id}, {'$set': {'clicked': True, 'last_clicked_at': datetime.utcnow()}, '$inc': {'click_count': 1}})

        return redirect(link['original_url'], code=302)

    except Exception as e:
        logging.error(f"Masked link click error: {e}")
        return redirect('https://moustacheleads.com', code=302)


@preview_tracking_bp.route('/api/admin/masked-links', methods=['GET'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def get_masked_links():
    """Get all masked links with click counts and filters."""
    try:
        page = max(1, int(request.args.get('page', 1)))
        per_page = min(int(request.args.get('per_page', 50)), 200)
        offer_id = request.args.get('offer_id', '')
        search = request.args.get('search', '')
        created_by = request.args.get('created_by', '')

        col = db_instance.get_collection('masked_links')
        if col is None:
            return safe_json_response({'links': [], 'total': 0})

        query = {}
        if offer_id:
            query['offer_id'] = offer_id
        if created_by:
            query['created_by'] = created_by
        if search:
            query['$or'] = [
                {'offer_name': {'$regex': search, '$options': 'i'}},
                {'offer_id': {'$regex': search, '$options': 'i'}},
                {'original_url': {'$regex': search, '$options': 'i'}},
                {'label': {'$regex': search, '$options': 'i'}},
            ]

        total = col.count_documents(query)
        links = list(col.find(query).sort('created_at', -1).skip((page - 1) * per_page).limit(per_page))
        for l in links:
            l['_id'] = str(l['_id'])
            l['masked_url'] = f"{TRACKING_BASE}/m/{l.get('link_id', '')}"
            if l.get('created_at') and hasattr(l['created_at'], 'isoformat'):
                l['created_at'] = l['created_at'].isoformat() + 'Z'
            if l.get('last_clicked_at') and hasattr(l['last_clicked_at'], 'isoformat'):
                l['last_clicked_at'] = l['last_clicked_at'].isoformat() + 'Z'

        return safe_json_response({
            'links': links, 'total': total,
            'pagination': {'page': page, 'per_page': per_page, 'pages': max(1, (total + per_page - 1) // per_page)},
        })
    except Exception as e:
        logging.error(f"Get masked links error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@preview_tracking_bp.route('/api/admin/masked-link-clicks/<link_id>', methods=['GET'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def get_masked_link_clicks(link_id):
    """Get click details for a specific masked link with user enrichment and filters."""
    try:
        page = max(1, int(request.args.get('page', 1)))
        per_page = min(int(request.args.get('per_page', 50)), 200)
        search = request.args.get('search', '')
        unique_only = request.args.get('unique', '') == 'true'
        date_from = request.args.get('date_from', '')
        date_to = request.args.get('date_to', '')

        clicks_col = db_instance.get_collection('masked_link_clicks')
        if clicks_col is None:
            return safe_json_response({'clicks': [], 'total': 0})

        query = {'link_id': link_id}
        if search:
            query['$or'] = [
                {'ip': {'$regex': search, '$options': 'i'}},
                {'offer_name': {'$regex': search, '$options': 'i'}},
                {'user_agent': {'$regex': search, '$options': 'i'}},
            ]
        if date_from:
            try:
                query.setdefault('clicked_at', {})['$gte'] = datetime.fromisoformat(date_from.replace('Z', ''))
            except Exception:
                pass
        if date_to:
            try:
                query.setdefault('clicked_at', {})['$lte'] = datetime.fromisoformat(date_to.replace('Z', ''))
            except Exception:
                pass

        if unique_only:
            pipeline = [
                {'$match': query},
                {'$group': {'_id': '$ip', 'doc': {'$first': '$$ROOT'}}},
                {'$replaceRoot': {'newRoot': '$doc'}},
                {'$sort': {'clicked_at': -1}},
                {'$skip': (page - 1) * per_page},
                {'$limit': per_page},
            ]
            clicks = list(clicks_col.aggregate(pipeline))
            total = len(list(clicks_col.aggregate([{'$match': query}, {'$group': {'_id': '$ip'}}])))
        else:
            total = clicks_col.count_documents(query)
            clicks = list(clicks_col.find(query).sort('clicked_at', -1).skip((page - 1) * per_page).limit(per_page))

        for c in clicks:
            c['_id'] = str(c['_id'])
            if c.get('clicked_at') and hasattr(c['clicked_at'], 'isoformat'):
                c['clicked_at'] = c['clicked_at'].isoformat() + 'Z'

        # Get the link info
        links_col = db_instance.get_collection('masked_links')
        link_info = None
        if links_col is not None:
            link_info = links_col.find_one({'link_id': link_id})
            if link_info:
                link_info['_id'] = str(link_info['_id'])
                link_info['masked_url'] = f"{TRACKING_BASE}/m/{link_id}"
                if link_info.get('created_at') and hasattr(link_info['created_at'], 'isoformat'):
                    link_info['created_at'] = link_info['created_at'].isoformat() + 'Z'

        # Stats
        unique_ips = len(list(clicks_col.aggregate([{'$match': {'link_id': link_id}}, {'$group': {'_id': '$ip'}}])))

        # Get sent-to recipients from the link record
        sent_to_emails = []
        sent_to_usernames = []
        if link_info:
            sent_to_emails = link_info.get('sent_to_emails', [])
            sent_to_usernames = link_info.get('sent_to_usernames', [])

        return safe_json_response({
            'link': link_info,
            'clicks': clicks, 'total': total,
            'unique_clicks': unique_ips,
            'sent_to_emails': sent_to_emails,
            'sent_to_usernames': sent_to_usernames,
            'pagination': {'page': page, 'per_page': per_page, 'pages': max(1, (total + per_page - 1) // per_page)},
        })
    except Exception as e:
        logging.error(f"Get masked link clicks error: {e}")
        return jsonify({'error': str(e)}), 500


# ── See More Clicks Analytics ──
@preview_tracking_bp.route('/api/admin/see-more-clicks', methods=['GET'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def get_see_more_clicks():
    """Get See More page click analytics with filters."""
    try:
        page = max(1, int(request.args.get('page', 1)))
        per_page = min(int(request.args.get('per_page', 50)), 200)
        offer_id = request.args.get('offer_id', '')
        search = request.args.get('search', '')
        days = int(request.args.get('days', 30))
        unique_only = request.args.get('unique', '') == 'true'

        col = db_instance.get_collection('see_more_clicks')
        if col is None:
            return safe_json_response({'clicks': [], 'total': 0, 'summary': []})

        query = {}
        if offer_id:
            query['offer_id'] = offer_id
        if search:
            query['$or'] = [
                {'ip': {'$regex': search, '$options': 'i'}},
                {'offer_name': {'$regex': search, '$options': 'i'}},
                {'recipient_email': {'$regex': search, '$options': 'i'}},
            ]
        if days:
            query['clicked_at'] = {'$gte': datetime.utcnow() - timedelta(days=days)}

        if unique_only:
            # Get unique by IP
            pipeline = [
                {'$match': query},
                {'$group': {'_id': '$ip', 'doc': {'$first': '$$ROOT'}}},
                {'$replaceRoot': {'newRoot': '$doc'}},
                {'$sort': {'clicked_at': -1}},
                {'$skip': (page - 1) * per_page},
                {'$limit': per_page},
            ]
            clicks = list(col.aggregate(pipeline))
            total = len(list(col.aggregate([{'$match': query}, {'$group': {'_id': '$ip'}}])))
        else:
            total = col.count_documents(query)
            clicks = list(col.find(query).sort('clicked_at', -1).skip((page - 1) * per_page).limit(per_page))

        for c in clicks:
            c['_id'] = str(c['_id'])
            if c.get('clicked_at') and hasattr(c['clicked_at'], 'isoformat'):
                c['clicked_at'] = c['clicked_at'].isoformat() + 'Z'

        # Enrich clicks with recipient info from email_offer_pages
        pages_col = db_instance.get_collection('email_offer_pages')
        if pages_col is not None:
            page_ids = list(set(c.get('page_id', '') for c in clicks if c.get('page_id')))
            if page_ids:
                pages_map = {}
                for p in pages_col.find({'page_id': {'$in': page_ids}}, {'page_id': 1, 'sent_to_emails': 1, 'sent_to_usernames': 1, 'recipient_email': 1}):
                    pages_map[p['page_id']] = p
                for c in clicks:
                    pg = pages_map.get(c.get('page_id', ''))
                    if pg:
                        sent_emails = pg.get('sent_to_emails', [])
                        sent_users = pg.get('sent_to_usernames', [])
                        c['sent_to_emails'] = sent_emails
                        c['sent_to_usernames'] = sent_users
                        if not c.get('recipient_email') and sent_emails:
                            c['recipient_email'] = ', '.join(sent_emails[:3])
                            if len(sent_emails) > 3:
                                c['recipient_email'] += f' +{len(sent_emails) - 3}'

        # Summary by offer
        summary_pipeline = [
            {'$match': query if not unique_only else {k: v for k, v in query.items() if k != '$or'}},
            {'$group': {
                '_id': '$offer_id',
                'offer_name': {'$first': '$offer_name'},
                'total_views': {'$sum': 1},
                'unique_ips': {'$addToSet': '$ip'},
                'unique_emails': {'$addToSet': '$recipient_email'},
            }},
            {'$project': {
                'offer_id': '$_id',
                'offer_name': 1,
                'total_views': 1,
                'unique_visitors': {'$size': '$unique_ips'},
                'unique_recipients': {'$size': '$unique_emails'},
            }},
            {'$sort': {'total_views': -1}},
            {'$limit': 20},
        ]
        summary = list(col.aggregate(summary_pipeline))

        return safe_json_response({
            'clicks': clicks,
            'total': total,
            'summary': summary,
            'pagination': {'page': page, 'per_page': per_page, 'pages': max(1, (total + per_page - 1) // per_page)},
        })
    except Exception as e:
        logging.error(f"See more clicks error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


# ── Email Stats for Offer Access Requests page ──
@preview_tracking_bp.route('/api/admin/email-send-stats', methods=['GET'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def get_email_send_stats():
    """Get email sending stats: total mails sent, unique publishers mailed, publisher interactions."""
    try:
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

        # 1. Total mails sent (from offer_send_history + push_mail_history)
        total_mails = 0
        today_mails = 0
        try:
            send_col = db_instance.get_collection('offer_send_history')
            if send_col is not None:
                total_mails += send_col.count_documents({})
                today_mails += send_col.count_documents({'created_at': {'$gte': today_start}})
            push_col = db_instance.get_collection('push_mail_history')
            if push_col is not None:
                total_mails += push_col.count_documents({})
                today_mails += push_col.count_documents({'created_at': {'$gte': today_start}})
        except Exception:
            pass

        # 2. Total unique publishers mailed (from offer_send_history recipient_user_ids + push_mail_history recipient_ids)
        total_publishers_mailed = 0
        today_publishers_mailed = 0
        try:
            all_user_ids = set()
            today_user_ids = set()

            send_col = db_instance.get_collection('offer_send_history')
            if send_col is not None:
                for doc in send_col.find({}, {'recipient_user_ids': 1, 'recipient_emails': 1, 'created_at': 1}):
                    uids = doc.get('recipient_user_ids') or []
                    emails = doc.get('recipient_emails') or []
                    items = uids if uids else emails
                    all_user_ids.update(items)
                    if doc.get('created_at') and doc['created_at'] >= today_start:
                        today_user_ids.update(items)

            push_col = db_instance.get_collection('push_mail_history')
            if push_col is not None:
                for doc in push_col.find({}, {'recipient_ids': 1, 'recipient_emails': 1, 'created_at': 1}):
                    uids = doc.get('recipient_ids') or []
                    emails = doc.get('recipient_emails') or []
                    items = uids if uids else emails
                    all_user_ids.update(items)
                    if doc.get('created_at') and doc['created_at'] >= today_start:
                        today_user_ids.update(items)

            total_publishers_mailed = len(all_user_ids)
            today_publishers_mailed = len(today_user_ids)
        except Exception:
            pass

        # 3. Publisher interactions (unique IPs from masked_link_clicks + see_more_clicks)
        total_interactions = 0
        today_interactions = 0
        try:
            masked_clicks_col = db_instance.get_collection('masked_link_clicks')
            if masked_clicks_col is not None:
                total_interactions += len(list(masked_clicks_col.aggregate([{'$group': {'_id': '$ip'}}])))
                today_interactions += len(list(masked_clicks_col.aggregate([
                    {'$match': {'clicked_at': {'$gte': today_start}}},
                    {'$group': {'_id': '$ip'}}
                ])))

            see_more_col = db_instance.get_collection('see_more_clicks')
            if see_more_col is not None:
                # Add unique IPs not already counted
                see_more_ips = set(d['_id'] for d in see_more_col.aggregate([{'$group': {'_id': '$ip'}}]))
                masked_ips = set()
                if masked_clicks_col is not None:
                    masked_ips = set(d['_id'] for d in masked_clicks_col.aggregate([{'$group': {'_id': '$ip'}}]))
                total_interactions = len(see_more_ips | masked_ips)

                see_more_today_ips = set(d['_id'] for d in see_more_col.aggregate([
                    {'$match': {'clicked_at': {'$gte': today_start}}},
                    {'$group': {'_id': '$ip'}}
                ]))
                masked_today_ips = set()
                if masked_clicks_col is not None:
                    masked_today_ips = set(d['_id'] for d in masked_clicks_col.aggregate([
                        {'$match': {'clicked_at': {'$gte': today_start}}},
                        {'$group': {'_id': '$ip'}}
                    ]))
                today_interactions = len(see_more_today_ips | masked_today_ips)
        except Exception:
            pass

        # 4. Offers interacted — unique offer_ids that got at least 1 click
        offers_interacted_total = 0
        offers_interacted_today = 0
        try:
            all_offer_ids = set()
            today_offer_ids = set()
            masked_clicks_col = db_instance.get_collection('masked_link_clicks')
            if masked_clicks_col is not None:
                for d in masked_clicks_col.aggregate([{'$group': {'_id': '$offer_id'}}]):
                    if d['_id']:
                        all_offer_ids.add(d['_id'])
                for d in masked_clicks_col.aggregate([{'$match': {'clicked_at': {'$gte': today_start}}}, {'$group': {'_id': '$offer_id'}}]):
                    if d['_id']:
                        today_offer_ids.add(d['_id'])
            see_more_col = db_instance.get_collection('see_more_clicks')
            if see_more_col is not None:
                for d in see_more_col.aggregate([{'$group': {'_id': '$offer_id'}}]):
                    if d['_id']:
                        all_offer_ids.add(d['_id'])
                for d in see_more_col.aggregate([{'$match': {'clicked_at': {'$gte': today_start}}}, {'$group': {'_id': '$offer_id'}}]):
                    if d['_id']:
                        today_offer_ids.add(d['_id'])
            offers_interacted_total = len(all_offer_ids)
            offers_interacted_today = len(today_offer_ids)
        except Exception:
            pass

        # 5. Total clicks — raw count, no uniqueness
        total_clicks = 0
        today_clicks = 0
        try:
            masked_clicks_col = db_instance.get_collection('masked_link_clicks')
            if masked_clicks_col is not None:
                total_clicks += masked_clicks_col.count_documents({})
                today_clicks += masked_clicks_col.count_documents({'clicked_at': {'$gte': today_start}})
            see_more_col = db_instance.get_collection('see_more_clicks')
            if see_more_col is not None:
                total_clicks += see_more_col.count_documents({})
                today_clicks += see_more_col.count_documents({'clicked_at': {'$gte': today_start}})
        except Exception:
            pass

        return jsonify({
            'total_mails_sent': total_mails,
            'today_mails_sent': today_mails,
            'total_publishers_mailed': total_publishers_mailed,
            'today_publishers_mailed': today_publishers_mailed,
            'total_interactions': total_interactions,
            'today_interactions': today_interactions,
            'offers_interacted_total': offers_interacted_total,
            'offers_interacted_today': offers_interacted_today,
            'total_clicks': total_clicks,
            'today_clicks': today_clicks,
        })
    except Exception as e:
        logging.error(f"Email send stats error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500
