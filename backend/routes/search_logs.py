"""
Search Logs API - Tracks what publishers search for in offers
"""
from flask import Blueprint, request, jsonify
from database import db_instance
from utils.auth import token_required
from datetime import datetime, timedelta
from bson import ObjectId
import logging
import threading

logger = logging.getLogger(__name__)

search_logs_bp = Blueprint('search_logs', __name__)


def log_search(user_id, username, keyword, results_count, matched_offer_ids=None):
    """Log a search query from a publisher (called from publisher_offers route)"""
    try:
        collection = db_instance.get_collection('search_logs')
        if collection is None:
            return

        # Check inventory status for this keyword
        offers_col = db_instance.get_collection('offers')
        inventory_status = 'not_in_inventory'
        total_inventory_count = 0
        active_inventory_count = 0

        if offers_col is not None and keyword:
            search_regex = {'$regex': keyword, '$options': 'i'}
            # Total inventory (all offers matching keyword regardless of status)
            total_inventory_count = offers_col.count_documents({
                '$or': [
                    {'name': search_regex},
                    {'offer_id': search_regex},
                    {'category': search_regex}
                ],
                '$and': [
                    {'$or': [{'deleted': {'$exists': False}}, {'deleted': False}, {'deleted': None}]}
                ]
            })
            # Active inventory (only active + visible offers)
            active_inventory_count = offers_col.count_documents({
                '$or': [
                    {'name': search_regex},
                    {'offer_id': search_regex},
                    {'category': search_regex}
                ],
                'status': 'active',
                '$and': [
                    {'$or': [{'deleted': {'$exists': False}}, {'deleted': False}, {'deleted': None}]},
                    {'$or': [{'is_active': True}, {'is_active': {'$exists': False}}]},
                    {'$or': [{'show_in_offerwall': True}, {'show_in_offerwall': {'$exists': False}}]}
                ]
            })

            if total_inventory_count > 0 and active_inventory_count > 0:
                inventory_status = 'available'
            elif total_inventory_count > 0 and active_inventory_count == 0:
                inventory_status = 'in_inventory_not_active'
            else:
                inventory_status = 'not_in_inventory'

        doc = {
            'user_id': str(user_id),
            'username': username,
            'keyword': keyword.strip(),
            'results_count': results_count,
            'no_result': results_count == 0,
            'inventory_status': inventory_status,
            'total_inventory_count': total_inventory_count,
            'active_inventory_count': active_inventory_count,
            'picked_offer': None,         # offer name picked after search
            'picked_offer_id': None,      # offer id picked after search
            'clicked_preview': False,     # clicked preview landing page
            'clicked_request': False,     # clicked request access
            'clicked_tracking': False,    # clicked/copied tracking link
            'searched_at': datetime.utcnow()
        }
        result = collection.insert_one(doc)
        return str(result.inserted_id) if result else None
    except Exception as e:
        logger.error(f"Failed to log search: {e}")
        return None


def log_search_async(user_id, username, keyword, results_count, matched_offer_ids=None):
    """Non-blocking search logging"""
    thread = threading.Thread(
        target=log_search,
        args=(user_id, username, keyword, results_count, matched_offer_ids),
        daemon=True
    )
    thread.start()


# ============================================================================
# ADMIN ENDPOINTS
# ============================================================================

@search_logs_bp.route('/search-logs', methods=['GET'])
@token_required
def get_search_logs():
    """Get search logs with filters and pagination"""
    try:
        user = request.current_user
        logger.info(f"GET /search-logs - user: {user.get('username')}, role: {user.get('role')}")
        if user.get('role') not in ('admin', 'subadmin'):
            logger.warning(f"Access denied for user {user.get('username')} with role {user.get('role')}")
            return jsonify({'error': 'Admin access required'}), 403

        # Pagination
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 25))
        skip = (page - 1) * per_page

        # Filters
        keyword_filter = request.args.get('keyword', '').strip()
        user_filter = request.args.get('user', '').strip()
        no_result_filter = request.args.get('no_result', '')  # 'true', 'false', or ''
        inventory_filter = request.args.get('inventory_status', '')  # 'available', 'in_inventory_not_active', 'not_in_inventory'
        date_from = request.args.get('date_from', '')
        date_to = request.args.get('date_to', '')

        collection = db_instance.get_collection('search_logs')
        if collection is None:
            return jsonify({'error': 'Database connection failed'}), 500

        query = {}

        if keyword_filter:
            query['keyword'] = {'$regex': keyword_filter, '$options': 'i'}

        if user_filter:
            query['$or'] = [
                {'username': {'$regex': user_filter, '$options': 'i'}},
                {'user_id': {'$regex': user_filter, '$options': 'i'}}
            ]

        if no_result_filter == 'true':
            query['no_result'] = True
        elif no_result_filter == 'false':
            query['no_result'] = False

        if inventory_filter:
            query['inventory_status'] = inventory_filter

        if date_from or date_to:
            date_query = {}
            if date_from:
                date_query['$gte'] = datetime.fromisoformat(date_from.replace('Z', '+00:00').replace('+00:00', ''))
            if date_to:
                date_query['$lte'] = datetime.fromisoformat(date_to.replace('Z', '+00:00').replace('+00:00', ''))
            if date_query:
                query['searched_at'] = date_query

        total = collection.count_documents(query)
        logger.info(f"Search logs query: {query}, total: {total}")
        logs = list(
            collection.find(query)
            .sort('searched_at', -1)
            .skip(skip)
            .limit(per_page)
        )

        # Serialize
        for log in logs:
            log['_id'] = str(log['_id'])
            if isinstance(log.get('searched_at'), datetime):
                log['searched_at'] = log['searched_at'].isoformat() + 'Z'

        # Aggregate stats
        stats = {
            'total_searches': total,
            'no_result_count': collection.count_documents({**query, 'no_result': True}),
            'not_in_inventory': collection.count_documents({**query, 'inventory_status': 'not_in_inventory'}),
            'in_inventory_not_active': collection.count_documents({**query, 'inventory_status': 'in_inventory_not_active'}),
        }

        return jsonify({
            'success': True,
            'logs': logs,
            'stats': stats,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page
            }
        }), 200

    except Exception as e:
        logger.error(f"Error fetching search logs: {e}")
        return jsonify({'error': str(e)}), 500


@search_logs_bp.route('/search-logs/send-email', methods=['POST'])
@token_required
def send_email_to_users():
    """Send email to selected users from search logs"""
    try:
        user = request.current_user
        if user.get('role') not in ('admin', 'subadmin'):
            return jsonify({'error': 'Admin access required'}), 403

        data = request.get_json()
        user_ids = data.get('user_ids', [])
        subject = data.get('subject', '')
        message = data.get('message', '')
        send_to_all = data.get('send_to_all', False)
        custom_emails = data.get('custom_emails', [])

        if not subject or not message:
            return jsonify({'error': 'Subject and message are required'}), 400

        users_col = db_instance.get_collection('users')
        if users_col is None:
            return jsonify({'error': 'Database connection failed'}), 500

        # Get recipient emails from selected users
        recipients = []
        if send_to_all:
            search_logs_col = db_instance.get_collection('search_logs')
            unique_user_ids = search_logs_col.distinct('user_id')
            query = {'$or': [
                {'_id': {'$in': [ObjectId(uid) for uid in unique_user_ids if ObjectId.is_valid(uid)]}},
                {'username': {'$in': unique_user_ids}}
            ]}
            users = list(users_col.find(query, {'email': 1, 'username': 1}))
            recipients = [u['email'] for u in users if u.get('email')]
        elif user_ids:
            query = {'$or': [
                {'_id': {'$in': [ObjectId(uid) for uid in user_ids if ObjectId.is_valid(uid)]}},
                {'username': {'$in': user_ids}}
            ]}
            users = list(users_col.find(query, {'email': 1, 'username': 1}))
            recipients = [u['email'] for u in users if u.get('email')]

        # Merge custom emails (deduplicated)
        if custom_emails:
            import re
            email_regex = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
            for email in custom_emails:
                email = email.strip().lower()
                if email_regex.match(email) and email not in recipients:
                    recipients.append(email)

        if not recipients:
            return jsonify({'error': 'No valid email addresses found'}), 400

        # Send email
        from services.email_service import EmailService
        email_svc = EmailService()

        import os
        frontend_url = os.getenv('FRONTEND_URL', 'https://moustacheleads.com')

        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        current_day = days[datetime.utcnow().weekday()]

        html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f4f6f9;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f9;padding:20px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
    <!-- Header with logo -->
    <tr>
        <td style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:40px 20px;text-align:center;">
            <img src="https://moustacheleads.com/logo.png" alt="MustacheLeads" style="height:60px;margin-bottom:15px;" />
            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">MustacheLeads</h1>
            <p style="margin:8px 0 0 0;color:#ffffff;font-size:16px;opacity:0.9;">Happy {current_day}! 👋</p>
        </td>
    </tr>
    <!-- Body -->
    <tr>
        <td style="padding:40px 30px;">
            <div style="font-size:16px;color:#1f2937;line-height:1.8;white-space:pre-wrap;">{message}</div>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:30px 0;">
                <tr><td align="center">
                    <a href="{frontend_url}/publisher/signin" style="display:inline-block;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);color:#ffffff;padding:16px 50px;text-decoration:none;border-radius:50px;font-weight:700;font-size:16px;text-transform:uppercase;letter-spacing:1px;box-shadow:0 4px 15px rgba(99,102,241,0.4);">VIEW OFFERS →</a>
                </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:30px;padding-top:25px;border-top:2px solid #e5e7eb;">
                <tr><td align="center">
                    <p style="margin:0 0 8px 0;color:#6b7280;font-size:15px;">Thanks for being part of the team!</p>
                    <p style="margin:0;color:#111827;font-size:17px;font-weight:600;">Keep pushing! 🚀</p>
                </td></tr>
            </table>
        </td>
    </tr>
    <!-- Footer -->
    <tr>
        <td style="background-color:#1f2937;padding:30px;text-align:center;">
            <p style="margin:0 0 15px 0;color:#ffffff;font-size:20px;font-weight:700;">MustacheLeads</p>
            <p style="margin:0 0 20px 0;color:#9ca3af;font-size:13px;line-height:1.6;">This email was sent to you because you are a registered publisher.</p>
            <p style="margin:20px 0 0 0;color:#6b7280;font-size:12px;">© {datetime.utcnow().year} MustacheLeads. All rights reserved.</p>
        </td>
    </tr>
</table>
</td></tr></table>
</body></html>"""

        # Send in batches via BCC
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        batch_size = 50
        sent = 0
        failed = 0

        for i in range(0, len(recipients), batch_size):
            batch = recipients[i:i + batch_size]
            try:
                msg = MIMEMultipart('alternative')
                msg['Subject'] = subject
                msg['From'] = email_svc.from_email
                msg['To'] = email_svc.from_email
                msg['Bcc'] = ', '.join(batch)
                msg.attach(MIMEText(html_content, 'html'))

                if email_svc._send_email_smtp(msg):
                    sent += len(batch)
                else:
                    failed += len(batch)
            except Exception as e:
                failed += len(batch)
                logger.error(f"Email batch error: {e}")

        # Log email activity
        if sent > 0:
            try:
                email_logs_col = db_instance.get_collection('email_activity_logs')
                if email_logs_col is not None:
                    email_logs_col.insert_one({
                        'action': 'sent',
                        'source': 'search_logs',
                        'offer_ids': [],
                        'offer_names': [subject],
                        'offer_count': 0,
                        'recipient_type': 'all_users' if send_to_all else 'specific_users',
                        'recipient_count': sent,
                        'batch_count': (len(recipients) + 49) // 50,
                        'offers_per_email': 0,
                        'scheduled_time': None,
                        'admin_id': str(user.get('_id', '')),
                        'admin_username': user.get('username', 'admin'),
                        'created_at': datetime.utcnow()
                    })
            except Exception as log_err:
                logger.error(f"Email activity log insert failed: {log_err}")

        return jsonify({
            'success': True,
            'sent': sent,
            'failed': failed,
            'total': len(recipients)
        }), 200

    except Exception as e:
        logger.error(f"Error sending email from search logs: {e}")
        return jsonify({'error': str(e)}), 500



@search_logs_bp.route('/search-logs/log', methods=['POST'])
@token_required
def log_search_from_frontend():
    """Endpoint for frontend to log a search query (since search is client-side filtered)"""
    try:
        user = request.current_user
        data = request.get_json()
        keyword = (data.get('keyword') or '').strip()
        results_count = int(data.get('results_count', 0))

        if not keyword:
            return jsonify({'error': 'Keyword is required'}), 400

        # Log synchronously so we can return the ID
        log_id = log_search(
            str(user.get('_id', '')),
            user.get('username', ''),
            keyword,
            results_count
        )

        return jsonify({'success': True, 'search_log_id': log_id}), 200
    except Exception as e:
        logger.error(f"Error logging search from frontend: {e}")
        return jsonify({'error': str(e)}), 500


@search_logs_bp.route('/search-logs/track-action', methods=['POST'])
@token_required
def track_search_action():
    """Track a post-search action (offer picked, preview clicked, request, tracking link).
    Updates the most recent search log for this user, or a specific log by ID.
    """
    try:
        user = request.current_user
        data = request.get_json()
        action = data.get('action', '')  # 'picked_offer', 'clicked_preview', 'clicked_request', 'clicked_tracking'
        search_log_id = data.get('search_log_id')  # optional: specific log to update
        offer_name = data.get('offer_name', '')
        offer_id = data.get('offer_id', '')

        if not action:
            return jsonify({'error': 'Action is required'}), 400

        collection = db_instance.get_collection('search_logs')
        if collection is None:
            return jsonify({'error': 'Database connection failed'}), 500

        user_id = str(user.get('_id', ''))

        # Find the target search log
        if search_log_id and ObjectId.is_valid(search_log_id):
            query = {'_id': ObjectId(search_log_id)}
        else:
            # Find the most recent search log for this user (within last 10 minutes)
            ten_min_ago = datetime.utcnow() - timedelta(minutes=10)
            query = {
                'user_id': user_id,
                'searched_at': {'$gte': ten_min_ago}
            }

        # Build update based on action
        update = {}
        if action == 'picked_offer':
            update = {
                '$set': {
                    'picked_offer': offer_name or None,
                    'picked_offer_id': offer_id or None
                }
            }
        elif action == 'clicked_preview':
            update = {'$set': {'clicked_preview': True}}
        elif action == 'clicked_request':
            update = {'$set': {'clicked_request': True}}
        elif action == 'clicked_tracking':
            update = {'$set': {'clicked_tracking': True}}
        else:
            return jsonify({'error': f'Unknown action: {action}'}), 400

        # Update the most recent matching log
        if search_log_id and ObjectId.is_valid(search_log_id):
            result = collection.update_one(query, update)
        else:
            # Find most recent and update it
            log = collection.find_one(query, sort=[('searched_at', -1)])
            if log:
                result = collection.update_one({'_id': log['_id']}, update)
            else:
                # No recent search log found — silently succeed
                return jsonify({'success': True, 'updated': False}), 200

        return jsonify({'success': True, 'updated': result.modified_count > 0 if result else False}), 200

    except Exception as e:
        logger.error(f"Error tracking search action: {e}")
        return jsonify({'error': str(e)}), 500


@search_logs_bp.route('/search-logs/send-inventory-email', methods=['POST'])
@token_required
def send_inventory_email():
    """
    When a search log shows 'In Inventory (Not Active)', admin can send the user
    an email with that offer + up to 7 related offers (by category/keyword proximity).
    Admin can edit offers (image, link, name) before sending.
    """
    try:
        user = request.current_user
        if user.get('role') not in ('admin', 'subadmin'):
            return jsonify({'error': 'Admin access required'}), 403

        data = request.get_json()
        search_log_id = data.get('search_log_id')
        user_id = data.get('user_id')
        keyword = data.get('keyword', '')
        offers_to_send = data.get('offers', [])  # list of {offer_id, name, image_url, target_url, payout}
        custom_subject = data.get('subject', '')
        custom_message = data.get('message', '')

        if not user_id:
            return jsonify({'error': 'user_id is required'}), 400
        if not offers_to_send or len(offers_to_send) == 0:
            return jsonify({'error': 'At least one offer is required'}), 400

        # Get user email
        users_col = db_instance.get_collection('users')
        if users_col is None:
            return jsonify({'error': 'Database connection failed'}), 500

        target_user = None
        if ObjectId.is_valid(user_id):
            target_user = users_col.find_one({'_id': ObjectId(user_id)})
        if not target_user:
            target_user = users_col.find_one({'username': user_id})
        if not target_user or not target_user.get('email'):
            return jsonify({'error': 'User not found or has no email'}), 404

        recipient_email = target_user['email']
        username = target_user.get('username', 'Publisher')

        import os
        frontend_url = os.getenv('FRONTEND_URL', 'https://moustacheleads.com')
        subject = custom_subject or f'🔥 Offers matching "{keyword}" are available for you!'

        # Build offer rows HTML - single column, clean card layout
        offer_rows_html = ''
        for idx, offer in enumerate(offers_to_send[:8]):
            img = offer.get('image_url', '')
            name = offer.get('name', 'Offer')
            payout = offer.get('payout', 0)
            offer_id = offer.get('offer_id', '')

            img_cell = f'''<td style="width:80px;vertical-align:middle;padding-right:15px;">
                <img src="{img}" alt="" style="width:70px;height:70px;object-fit:cover;border-radius:10px;display:block;" />
            </td>''' if img else f'''<td style="width:80px;vertical-align:middle;padding-right:15px;">
                <div style="width:70px;height:70px;background:linear-gradient(135deg,#f97316,#ea580c);border-radius:10px;display:flex;align-items:center;justify-content:center;">
                    <span style="font-size:28px;">📋</span>
                </div>
            </td>'''

            border_top = 'border-top:1px solid #f3f4f6;' if idx > 0 else ''

            offer_rows_html += f'''
            <tr>
                <td style="padding:16px 0;{border_top}">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                            {img_cell}
                            <td style="vertical-align:middle;">
                                <div style="font-weight:600;font-size:15px;color:#1f2937;margin-bottom:3px;">{name}</div>
                                <div style="font-size:12px;color:#9ca3af;margin-bottom:6px;">{offer_id}</div>
                                <div style="display:inline-block;background:#fef3c7;color:#92400e;font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px;">${payout:.2f}</div>
                            </td>
                            <td style="width:100px;vertical-align:middle;text-align:right;">
                                <a href="{frontend_url}/publisher/signin" style="display:inline-block;background:#f97316;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:0.3px;">View →</a>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>'''

        message_section = ''
        if custom_message:
            message_section = f'''<tr><td style="padding:0 30px 20px;">
                <div style="font-size:15px;color:#374151;line-height:1.7;background:#fff7ed;border-left:4px solid #f97316;padding:15px 18px;border-radius:0 8px 8px 0;white-space:pre-wrap;">{custom_message}</div>
            </td></tr>'''

        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,Helvetica,sans-serif;background-color:#f8fafc;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;padding:30px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <!-- Header with Logo -->
    <tr>
        <td style="background:linear-gradient(135deg,#f97316 0%,#ea580c 50%,#dc2626 100%);padding:35px 30px;text-align:center;">
            <img src="https://moustacheleads.com/logo.png" alt="MoustacheLeads" style="height:50px;margin-bottom:12px;display:inline-block;" />
            <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">MoustacheLeads</h1>
            <p style="margin:10px 0 0;color:rgba(255,255,255,0.9);font-size:15px;">Hey {username}! We found offers for you 🎯</p>
        </td>
    </tr>
    <!-- Keyword Banner -->
    <tr>
        <td style="padding:25px 30px 5px;">
            <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px 18px;text-align:center;">
                <span style="font-size:13px;color:#9a3412;font-weight:600;">🔍 Matching your search:</span>
                <span style="display:inline-block;background:#f97316;color:#fff;font-size:14px;font-weight:700;padding:4px 14px;border-radius:20px;margin-left:8px;">{keyword}</span>
            </div>
        </td>
    </tr>
    <!-- Custom Message -->
    {message_section}
    <!-- Offers List -->
    <tr>
        <td style="padding:15px 30px 5px;">
            <h2 style="margin:0 0 5px;font-size:17px;color:#1f2937;font-weight:700;">📦 {len(offers_to_send)} Offers Available</h2>
            <p style="margin:0 0 15px;font-size:13px;color:#6b7280;">These offers are in our inventory and ready for you to promote.</p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                {offer_rows_html}
            </table>
        </td>
    </tr>
    <!-- CTA Button -->
    <tr>
        <td style="padding:20px 30px 30px;text-align:center;">
            <a href="{frontend_url}/publisher/signin" style="display:inline-block;background:linear-gradient(135deg,#f97316,#ea580c);color:#ffffff;padding:16px 50px;text-decoration:none;border-radius:50px;font-weight:800;font-size:15px;letter-spacing:0.5px;box-shadow:0 4px 15px rgba(249,115,22,0.4);">BROWSE ALL OFFERS →</a>
        </td>
    </tr>
    <!-- Divider -->
    <tr><td style="padding:0 30px;"><div style="border-top:1px solid #e5e7eb;"></div></td></tr>
    <!-- Footer -->
    <tr>
        <td style="padding:25px 30px;text-align:center;">
            <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">Thanks for being part of the MoustacheLeads network!</p>
            <p style="margin:0 0 15px;color:#1f2937;font-size:14px;font-weight:600;">Keep pushing! 🚀</p>
            <p style="margin:0;color:#9ca3af;font-size:11px;">© {datetime.utcnow().year} MoustacheLeads. All rights reserved.</p>
            <p style="margin:5px 0 0;color:#9ca3af;font-size:11px;">You received this because you're a registered publisher on MoustacheLeads.</p>
        </td>
    </tr>
</table>
</td></tr></table>
</body></html>"""

        # Send email
        from services.email_service import EmailService
        email_svc = EmailService()
        success = email_svc._send_email(recipient_email, subject, html_content)

        # Log email activity
        try:
            email_logs_col = db_instance.get_collection('email_activity_logs')
            if email_logs_col is not None:
                email_logs_col.insert_one({
                    'action': 'sent',
                    'source': 'search_logs_inventory',
                    'offer_ids': [o.get('offer_id', '') for o in offers_to_send],
                    'offer_names': [o.get('name', '') for o in offers_to_send],
                    'offer_count': len(offers_to_send),
                    'recipient_type': 'specific_user',
                    'recipient_email': recipient_email,
                    'recipient_count': 1,
                    'keyword': keyword,
                    'search_log_id': search_log_id,
                    'admin_id': str(user.get('_id', '')),
                    'admin_username': user.get('username', 'admin'),
                    'created_at': datetime.utcnow()
                })
        except Exception as log_err:
            logger.error(f"Email activity log error: {log_err}")

        if success:
            return jsonify({'success': True, 'message': f'Email sent to {recipient_email} with {len(offers_to_send)} offers'}), 200
        else:
            return jsonify({'error': 'Failed to send email'}), 500

    except Exception as e:
        logger.error(f"Error sending inventory email: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@search_logs_bp.route('/search-logs/related-offers', methods=['GET'])
@token_required
def get_related_offers():
    """
    Get up to 8 related offers for a keyword (the searched offer + 7 nearby).
    Used by admin to preview/edit offers before sending inventory email.
    """
    try:
        user = request.current_user
        if user.get('role') not in ('admin', 'subadmin'):
            return jsonify({'error': 'Admin access required'}), 403

        keyword = request.args.get('keyword', '').strip()
        if not keyword:
            return jsonify({'error': 'keyword is required'}), 400

        offers_col = db_instance.get_collection('offers')
        if offers_col is None:
            return jsonify({'error': 'Database connection failed'}), 500

        search_regex = {'$regex': keyword, '$options': 'i'}

        # Find offers matching the keyword (any status, not deleted)
        matching = list(offers_col.find(
            {
                '$or': [
                    {'name': search_regex},
                    {'offer_id': search_regex},
                    {'category': search_regex},
                    {'vertical': search_regex},
                    {'tags': search_regex},
                    {'keywords': search_regex}
                ],
                '$and': [{'$or': [{'deleted': {'$exists': False}}, {'deleted': False}, {'deleted': None}]}]
            },
            {
                'offer_id': 1, 'name': 1, 'image_url': 1, 'thumbnail_url': 1,
                'target_url': 1, 'preview_url': 1, 'payout': 1, 'status': 1,
                'category': 1, 'vertical': 1, 'countries': 1, 'network': 1,
                'description': 1, 'currency': 1
            }
        ).sort('payout', -1).limit(20))

        # If we have fewer than 8, try to find more by category of the first match
        if len(matching) < 8 and matching:
            category = matching[0].get('vertical') or matching[0].get('category', '')
            if category:
                existing_ids = {o['offer_id'] for o in matching}
                extra = list(offers_col.find(
                    {
                        '$or': [
                            {'category': {'$regex': category, '$options': 'i'}},
                            {'vertical': {'$regex': category, '$options': 'i'}}
                        ],
                        'offer_id': {'$nin': list(existing_ids)},
                        '$and': [{'$or': [{'deleted': {'$exists': False}}, {'deleted': False}, {'deleted': None}]}]
                    },
                    {
                        'offer_id': 1, 'name': 1, 'image_url': 1, 'thumbnail_url': 1,
                        'target_url': 1, 'preview_url': 1, 'payout': 1, 'status': 1,
                        'category': 1, 'vertical': 1, 'countries': 1, 'network': 1,
                        'description': 1, 'currency': 1
                    }
                ).sort('payout', -1).limit(8 - len(matching)))
                matching.extend(extra)

        # Serialize
        result = []
        for o in matching[:8]:
            o['_id'] = str(o['_id'])
            result.append(o)

        return jsonify({'success': True, 'offers': result, 'total': len(result)}), 200

    except Exception as e:
        logger.error(f"Error getting related offers: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500
