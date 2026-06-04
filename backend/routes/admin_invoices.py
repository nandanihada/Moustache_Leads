"""
Admin Invoices API Routes
Handles invoice generation, viewing, threshold management, and marking as paid.
Auto-generates invoices on 1st of every month for previous month's conversions.
"""

from flask import Blueprint, request, jsonify
from utils.auth import token_required, admin_required
from database import db_instance
from bson import ObjectId
from datetime import datetime, timedelta
import logging
import calendar

logger = logging.getLogger(__name__)

admin_invoices_bp = Blueprint('admin_invoices', __name__)


def get_collection(name):
    if not db_instance.is_connected():
        return None
    return db_instance.get_collection(name)


@admin_invoices_bp.route('/api/admin/invoices', methods=['GET'])
@token_required
@admin_required
def get_invoices():
    """Get all invoices with optional filters."""
    try:
        col = get_collection('invoices')
        if col is None:
            return jsonify({'error': 'Database unavailable'}), 500

        # Filters
        user_id = request.args.get('user_id')
        status = request.args.get('status')
        month = request.args.get('month')  # YYYY-MM format
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 100)

        query = {}
        if user_id:
            query['user_id'] = user_id
        if status and status != 'all':
            query['status'] = status
        if month:
            try:
                year, mon = month.split('-')
                start = datetime(int(year), int(mon), 1)
                last_day = calendar.monthrange(int(year), int(mon))[1]
                end = datetime(int(year), int(mon), last_day, 23, 59, 59)
                query['period_start'] = {'$gte': start}
                query['period_end'] = {'$lte': end}
            except (ValueError, IndexError):
                pass

        total = col.count_documents(query)
        skip = (page - 1) * per_page

        invoices = list(col.find(query).sort('generated_at', -1).skip(skip).limit(per_page))

        # Enrich with username
        users_col = get_collection('users')
        user_cache = {}

        results = []
        for inv in invoices:
            uid = inv.get('user_id', '')
            if uid not in user_cache and users_col:
                try:
                    u = users_col.find_one({'_id': ObjectId(uid)}, {'username': 1, 'email': 1})
                    user_cache[uid] = u if u else {}
                except:
                    user_cache[uid] = {}

            user_data = user_cache.get(uid, {})

            results.append({
                '_id': str(inv['_id']),
                'user_id': uid,
                'username': user_data.get('username', 'Unknown'),
                'email': user_data.get('email', ''),
                'period_start': inv.get('period_start', '').isoformat() + 'Z' if hasattr(inv.get('period_start', ''), 'isoformat') else str(inv.get('period_start', '')),
                'period_end': inv.get('period_end', '').isoformat() + 'Z' if hasattr(inv.get('period_end', ''), 'isoformat') else str(inv.get('period_end', '')),
                'gross_amount': inv.get('gross_amount', 0),
                'reversals_amount': inv.get('reversals_amount', 0),
                'carry_forward': inv.get('carry_forward', 0),
                'net_amount': inv.get('net_amount', 0),
                'threshold': inv.get('threshold', 50),
                'status': inv.get('status', 'pending'),
                'net_terms': inv.get('net_terms', 30),
                'generated_at': inv.get('generated_at', '').isoformat() + 'Z' if hasattr(inv.get('generated_at', ''), 'isoformat') else '',
                'paid_at': inv.get('paid_at', '').isoformat() + 'Z' if hasattr(inv.get('paid_at', ''), 'isoformat') else '',
                'paid_by': inv.get('paid_by', '')
            })

        return jsonify({
            'success': True,
            'invoices': results,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page
            }
        }), 200

    except Exception as e:
        logger.error(f"Error getting invoices: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_invoices_bp.route('/api/admin/invoices/generate', methods=['POST'])
@token_required
@admin_required
def generate_invoices():
    """
    Manually trigger invoice generation for a specific month.
    Body: { "year": 2026, "month": 5 }
    If omitted, generates for previous month.
    """
    try:
        data = request.json or {}
        now = datetime.utcnow()

        year = data.get('year')
        month = data.get('month')

        if not year or not month:
            # Default to previous month
            first_of_current = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            last_month_end = first_of_current - timedelta(seconds=1)
            year = last_month_end.year
            month = last_month_end.month

        count = _generate_invoices_for_month(int(year), int(month))

        return jsonify({
            'success': True,
            'message': f'Generated {count} invoices for {year}-{month:02d}',
            'invoices_generated': count,
            'period': f'{year}-{month:02d}'
        }), 200

    except Exception as e:
        logger.error(f"Error generating invoices: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_invoices_bp.route('/api/admin/invoices/<invoice_id>/pay', methods=['POST'])
@token_required
@admin_required
def mark_invoice_paid(invoice_id):
    """Mark an invoice as paid."""
    try:
        col = get_collection('invoices')
        if col is None:
            return jsonify({'error': 'Database unavailable'}), 500

        invoice = col.find_one({'_id': ObjectId(invoice_id)})
        if not invoice:
            return jsonify({'error': 'Invoice not found'}), 404

        if invoice.get('status') == 'paid':
            return jsonify({'error': 'Invoice is already paid'}), 400

        admin_id = str(request.current_user['_id'])
        now = datetime.utcnow()

        col.update_one({'_id': ObjectId(invoice_id)}, {'$set': {
            'status': 'paid',
            'paid_at': now,
            'paid_by': admin_id,
            'updated_at': now
        }})

        return jsonify({
            'success': True,
            'message': 'Invoice marked as paid',
            'paid_at': now.isoformat() + 'Z'
        }), 200

    except Exception as e:
        logger.error(f"Error marking invoice paid: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_invoices_bp.route('/api/admin/invoices/threshold', methods=['GET'])
@token_required
@admin_required
def get_threshold():
    """Get the global payment threshold."""
    try:
        col = get_collection('platform_settings')
        if col is None:
            return jsonify({'success': True, 'threshold': 50}), 200

        setting = col.find_one({'key': 'payment_threshold'})
        threshold = setting.get('value', 50) if setting else 50

        return jsonify({'success': True, 'threshold': threshold}), 200

    except Exception as e:
        logger.error(f"Error getting threshold: {str(e)}")
        return jsonify({'error': str(e)}), 500


@admin_invoices_bp.route('/api/admin/invoices/threshold', methods=['POST'])
@token_required
@admin_required
def set_threshold():
    """Set the global payment threshold."""
    try:
        data = request.json
        threshold = data.get('threshold')

        if threshold is None or not isinstance(threshold, (int, float)) or threshold < 0:
            return jsonify({'error': 'Valid threshold amount is required'}), 400

        col = get_collection('platform_settings')
        if col is None:
            return jsonify({'error': 'Database unavailable'}), 500

        col.update_one(
            {'key': 'payment_threshold'},
            {'$set': {'key': 'payment_threshold', 'value': float(threshold), 'updated_at': datetime.utcnow()}},
            upsert=True
        )

        return jsonify({'success': True, 'message': f'Threshold updated to ${threshold}', 'threshold': threshold}), 200

    except Exception as e:
        logger.error(f"Error setting threshold: {str(e)}")
        return jsonify({'error': str(e)}), 500


@admin_invoices_bp.route('/api/admin/invoices/stats', methods=['GET'])
@token_required
@admin_required
def get_invoice_stats():
    """Get summary stats for the invoices dashboard."""
    try:
        col = get_collection('invoices')
        if col is None:
            return jsonify({'error': 'Database unavailable'}), 500

        # Aggregate stats
        pipeline = [
            {'$group': {
                '_id': '$status',
                'count': {'$sum': 1},
                'total_amount': {'$sum': '$net_amount'}
            }}
        ]
        results = list(col.aggregate(pipeline))

        stats = {
            'pending': {'count': 0, 'amount': 0},
            'eligible': {'count': 0, 'amount': 0},
            'paid': {'count': 0, 'amount': 0},
            'held': {'count': 0, 'amount': 0}
        }

        for r in results:
            status = r['_id']
            if status in stats:
                stats[status] = {'count': r['count'], 'amount': r['total_amount']}

        # Get threshold
        settings_col = get_collection('platform_settings')
        threshold = 50
        if settings_col:
            s = settings_col.find_one({'key': 'payment_threshold'})
            if s:
                threshold = s.get('value', 50)

        return jsonify({
            'success': True,
            'stats': stats,
            'threshold': threshold
        }), 200

    except Exception as e:
        logger.error(f"Error getting invoice stats: {str(e)}")
        return jsonify({'error': str(e)}), 500


def _generate_invoices_for_month(year, month):
    """
    Generate invoices for all publishers for a given month.
    Returns count of invoices generated.
    """
    invoices_col = get_collection('invoices')
    conversions_col = get_collection('forwarded_postbacks')
    users_col = get_collection('users')
    settings_col = get_collection('platform_settings')
    payout_settings_col = get_collection('user_payout_settings')
    carry_col = get_collection('carry_forwards')

    if not all([invoices_col, conversions_col, users_col]):
        return 0

    # Period boundaries
    last_day = calendar.monthrange(year, month)[1]
    period_start = datetime(year, month, 1, 0, 0, 0)
    period_end = datetime(year, month, last_day, 23, 59, 59)

    # Get threshold
    threshold = 50
    if settings_col:
        s = settings_col.find_one({'key': 'payment_threshold'})
        if s:
            threshold = s.get('value', 50)

    # Aggregate conversions per publisher for the period
    # Non-reversed conversions
    gross_pipeline = [
        {'$match': {
            'timestamp': {'$gte': period_start, '$lte': period_end},
            'forward_status': {'$nin': ['reversed']},
            'is_reversal': {'$ne': True},
            'source': {'$nin': ['fallback_fake']}
        }},
        {'$group': {
            '_id': '$publisher_id',
            'gross_amount': {'$sum': '$points'}
        }}
    ]
    gross_results = list(conversions_col.aggregate(gross_pipeline))
    gross_map = {r['_id']: r['gross_amount'] for r in gross_results}

    # Reversed conversions in this period
    rev_pipeline = [
        {'$match': {
            'timestamp': {'$gte': period_start, '$lte': period_end},
            '$or': [
                {'forward_status': 'reversed'},
                {'is_reversal': True}
            ]
        }},
        {'$group': {
            '_id': '$publisher_id',
            'reversals_amount': {'$sum': '$points'}
        }}
    ]
    rev_results = list(conversions_col.aggregate(rev_pipeline))
    rev_map = {r['_id']: r['reversals_amount'] for r in rev_results}

    # Get all publisher IDs with any activity
    all_publisher_ids = set(list(gross_map.keys()) + list(rev_map.keys()))

    count = 0
    for pub_id in all_publisher_ids:
        if not pub_id:
            continue

        # Skip if invoice already exists for this user/period
        existing = invoices_col.find_one({
            'user_id': pub_id,
            'period_start': period_start,
            'period_end': period_end
        })
        if existing:
            continue

        gross = gross_map.get(pub_id, 0)
        reversals = rev_map.get(pub_id, 0)

        # Get carry_forward from previous unpaid or from carry_forwards collection
        carry_forward = 0
        if carry_col:
            carry_doc = carry_col.find_one({'user_id': pub_id})
            if carry_doc:
                carry_forward = carry_doc.get('amount', 0)
                # Clear the carry after applying
                carry_col.delete_one({'_id': carry_doc['_id']})

        # Also check previous held invoices
        prev_held = invoices_col.find_one({
            'user_id': pub_id,
            'status': 'held',
            'period_end': {'$lt': period_start}
        }, sort=[('period_end', -1)])
        if prev_held:
            # Roll the held amount into this invoice
            carry_forward += prev_held.get('net_amount', 0)
            # Mark previous held invoice as rolled over
            invoices_col.update_one({'_id': prev_held['_id']}, {'$set': {
                'status': 'rolled_over',
                'rolled_into_period': f'{year}-{month:02d}',
                'updated_at': datetime.utcnow()
            }})

        net_amount = gross - reversals - carry_forward

        # Get user's net terms
        net_terms = 30
        if payout_settings_col:
            try:
                ups = payout_settings_col.find_one({'user_id': ObjectId(pub_id)})
                if ups:
                    net_terms = ups.get('net_terms', 30)
            except:
                pass

        # Determine status
        if net_amount < 0:
            status = 'held'
            # Store negative balance for next month
            if carry_col:
                carry_col.update_one(
                    {'user_id': pub_id},
                    {'$set': {'amount': abs(net_amount), 'updated_at': datetime.utcnow()}},
                    upsert=True
                )
            net_amount = 0
        elif net_amount < threshold:
            status = 'held'
        else:
            status = 'eligible'

        invoice_doc = {
            'user_id': pub_id,
            'period_start': period_start,
            'period_end': period_end,
            'gross_amount': round(gross, 2),
            'reversals_amount': round(reversals, 2),
            'carry_forward': round(carry_forward, 2),
            'net_amount': round(net_amount, 2),
            'threshold': threshold,
            'status': status,
            'net_terms': net_terms,
            'generated_at': datetime.utcnow(),
            'paid_at': None,
            'paid_by': None
        }

        invoices_col.insert_one(invoice_doc)
        count += 1

    return count
