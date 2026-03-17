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

        if offers_col and keyword:
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
            'searched_at': datetime.utcnow()
        }
        collection.insert_one(doc)
    except Exception as e:
        logger.error(f"Failed to log search: {e}")


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
        if user.get('role') not in ('admin', 'subadmin'):
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

        if not subject or not message:
            return jsonify({'error': 'Subject and message are required'}), 400

        users_col = db_instance.get_collection('users')
        if users_col is None:
            return jsonify({'error': 'Database connection failed'}), 500

        # Get recipient emails
        if send_to_all:
            # Get all unique user_ids from search logs
            search_logs_col = db_instance.get_collection('search_logs')
            unique_user_ids = search_logs_col.distinct('user_id')
            query = {'$or': [
                {'_id': {'$in': [ObjectId(uid) for uid in unique_user_ids if ObjectId.is_valid(uid)]}},
                {'username': {'$in': unique_user_ids}}
            ]}
        else:
            if not user_ids:
                return jsonify({'error': 'No users selected'}), 400
            query = {'$or': [
                {'_id': {'$in': [ObjectId(uid) for uid in user_ids if ObjectId.is_valid(uid)]}},
                {'username': {'$in': user_ids}}
            ]}

        users = list(users_col.find(query, {'email': 1, 'username': 1}))
        recipients = [u['email'] for u in users if u.get('email')]

        if not recipients:
            return jsonify({'error': 'No valid email addresses found'}), 400

        # Send email
        from services.email_service import EmailService
        email_svc = EmailService()

        import os
        frontend_url = os.getenv('FRONTEND_URL', 'https://moustacheleads.com')

        html_content = f"""
<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6f9;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:20px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
<tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:40px 20px;text-align:center;">
<h1 style="margin:0;color:#fff;font-size:28px;">MustacheLeads</h1>
</td></tr>
<tr><td style="padding:40px 30px;">
<div style="font-size:16px;color:#1f2937;line-height:1.8;white-space:pre-wrap;">{message}</div>
<table width="100%" style="margin:30px 0;"><tr><td align="center">
<a href="{frontend_url}/dashboard/offers" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:14px 40px;text-decoration:none;border-radius:50px;font-weight:700;">VIEW OFFERS →</a>
</td></tr></table>
</td></tr>
<tr><td style="background:#1f2937;padding:25px;text-align:center;">
<p style="margin:0;color:#9ca3af;font-size:12px;">© {datetime.utcnow().year} MustacheLeads. All rights reserved.</p>
</td></tr>
</table></td></tr></table>
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

        log_search_async(
            str(user.get('_id', '')),
            user.get('username', ''),
            keyword,
            results_count
        )

        return jsonify({'success': True}), 200
    except Exception as e:
        logger.error(f"Error logging search from frontend: {e}")
        return jsonify({'error': str(e)}), 500
