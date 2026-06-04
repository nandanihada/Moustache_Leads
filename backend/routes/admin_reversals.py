"""
Admin Reversals API Routes
Handles single and bulk conversion reversals from the admin panel.
Reversals set forward_status='reversed', record timestamp & admin ID,
and optionally send a notification to the publisher.
"""

from flask import Blueprint, request, jsonify
from utils.auth import token_required, admin_required
from database import db_instance
from bson import ObjectId
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

admin_reversals_bp = Blueprint('admin_reversals', __name__)


def get_collection(name):
    if not db_instance.is_connected():
        return None
    return db_instance.get_collection(name)


@admin_reversals_bp.route('/api/admin/reversals/single', methods=['POST'])
@token_required
@admin_required
def reverse_single_conversion():
    """Reverse a single conversion by its _id in forwarded_postbacks."""
    try:
        data = request.json
        conversion_id = data.get('conversion_id')
        reason = data.get('reason', '')  # Optional

        if not conversion_id:
            return jsonify({'error': 'conversion_id is required'}), 400

        col = get_collection('forwarded_postbacks')
        if col is None:
            return jsonify({'error': 'Database unavailable'}), 500

        # Find the conversion
        conv = col.find_one({'_id': ObjectId(conversion_id)})
        if not conv:
            return jsonify({'error': 'Conversion not found'}), 404

        # Check if already reversed
        if conv.get('forward_status') == 'reversed' or conv.get('is_reversal'):
            return jsonify({'error': 'Conversion is already reversed'}), 400

        admin_id = str(request.current_user['_id'])
        now = datetime.utcnow()

        # Update the conversion
        update_fields = {
            'forward_status': 'reversed',
            'is_reversal': True,
            'reversed_at': now,
            'reversed_by': admin_id
        }
        if reason:
            update_fields['reversal_reason'] = reason

        col.update_one({'_id': ObjectId(conversion_id)}, {'$set': update_fields})

        # If reason provided, send notification to publisher
        if reason:
            _send_reversal_notification(conv, reason)

        # Update any unpaid invoice for this period
        _update_invoice_on_reversal(conv, now)

        # Clear user dashboard cache
        try:
            from routes.user_dashboard import clear_dashboard_cache
            clear_dashboard_cache(conv.get('publisher_id', ''))
        except Exception as e:
            logger.warning(f"Failed to clear dashboard cache: {e}")

        return jsonify({
            'success': True,
            'message': 'Conversion reversed successfully',
            'conversion_id': conversion_id,
            'reversed_at': now.isoformat() + 'Z'
        }), 200

    except Exception as e:
        logger.error(f"Error reversing conversion: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_reversals_bp.route('/api/admin/reversals/bulk', methods=['POST'])
@token_required
@admin_required
def reverse_bulk_conversions():
    """Reverse multiple conversions at once."""
    try:
        data = request.json
        conversion_ids = data.get('conversion_ids', [])
        reason = data.get('reason', '')  # Optional

        if not conversion_ids or not isinstance(conversion_ids, list):
            return jsonify({'error': 'conversion_ids array is required'}), 400

        col = get_collection('forwarded_postbacks')
        if col is None:
            return jsonify({'error': 'Database unavailable'}), 500

        admin_id = str(request.current_user['_id'])
        now = datetime.utcnow()
        reversed_count = 0
        skipped_count = 0
        affected_publishers = set()

        for cid in conversion_ids:
            try:
                conv = col.find_one({'_id': ObjectId(cid)})
                if not conv:
                    skipped_count += 1
                    continue
                if conv.get('forward_status') == 'reversed' or conv.get('is_reversal'):
                    skipped_count += 1
                    continue

                update_fields = {
                    'forward_status': 'reversed',
                    'is_reversal': True,
                    'reversed_at': now,
                    'reversed_by': admin_id
                }
                if reason:
                    update_fields['reversal_reason'] = reason

                col.update_one({'_id': ObjectId(cid)}, {'$set': update_fields})
                reversed_count += 1

                publisher_id = conv.get('publisher_id', '')
                affected_publishers.add(publisher_id)

                # Send notification if reason provided
                if reason:
                    _send_reversal_notification(conv, reason)

                # Update invoice
                _update_invoice_on_reversal(conv, now)

            except Exception as inner_e:
                logger.warning(f"Failed to reverse conversion {cid}: {inner_e}")
                skipped_count += 1

        # Clear dashboard caches for affected publishers
        for pub_id in affected_publishers:
            try:
                from routes.user_dashboard import clear_dashboard_cache
                clear_dashboard_cache(pub_id)
            except Exception:
                pass

        return jsonify({
            'success': True,
            'message': f'Reversed {reversed_count} conversions, skipped {skipped_count}',
            'reversed_count': reversed_count,
            'skipped_count': skipped_count
        }), 200

    except Exception as e:
        logger.error(f"Error in bulk reversal: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


def _send_reversal_notification(conv, reason):
    """Send a dashboard notification to the publisher about the reversal."""
    try:
        notif_col = get_collection('notifications')
        if notif_col is None:
            return

        publisher_id = conv.get('publisher_id', '')
        offer_name = conv.get('offer_name', conv.get('offer_id', 'Unknown'))
        points = conv.get('points', 0)

        notif_col.insert_one({
            'user_id': publisher_id,
            'type': 'reversal',
            'title': 'Conversion Reversed',
            'message': f"⚠️ ${points:.2f} from '{offer_name}' reversed. Reason: {reason}",
            'read': False,
            'created_at': datetime.utcnow()
        })
    except Exception as e:
        logger.warning(f"Failed to send reversal notification: {e}")


def _update_invoice_on_reversal(conv, reversed_at):
    """
    When a conversion is reversed:
    - If there's an unpaid invoice covering this period → deduct from it
    - If the invoice was already paid → add to next month's carry_forward
    """
    try:
        invoices_col = get_collection('invoices')
        if invoices_col is None:
            return

        publisher_id = conv.get('publisher_id', '')
        conv_timestamp = conv.get('timestamp')
        points = conv.get('points', 0)

        if not conv_timestamp or not publisher_id:
            return

        # Find invoice that covers this conversion's period
        invoice = invoices_col.find_one({
            'user_id': publisher_id,
            'period_start': {'$lte': conv_timestamp},
            'period_end': {'$gte': conv_timestamp}
        })

        if not invoice:
            return

        if invoice.get('status') in ('pending', 'eligible', 'held'):
            # Deduct from unpaid invoice
            new_reversals = (invoice.get('reversals_amount', 0) or 0) + points
            new_net = (invoice.get('gross_amount', 0) or 0) - new_reversals - (invoice.get('carry_forward', 0) or 0)

            update = {
                'reversals_amount': new_reversals,
                'net_amount': new_net,
                'updated_at': datetime.utcnow()
            }

            # Check threshold
            settings_col = get_collection('platform_settings')
            threshold = 50  # default
            if settings_col:
                s = settings_col.find_one({'key': 'payment_threshold'})
                if s:
                    threshold = s.get('value', 50)

            if new_net < threshold:
                update['status'] = 'held'
            elif new_net >= threshold and invoice.get('status') != 'eligible':
                update['status'] = 'eligible'

            invoices_col.update_one({'_id': invoice['_id']}, {'$set': update})

        elif invoice.get('status') == 'paid':
            # Add to carry_forward on next unpaid invoice or create a carry record
            # Find next invoice
            next_invoice = invoices_col.find_one({
                'user_id': publisher_id,
                'period_start': {'$gt': invoice['period_end']},
                'status': {'$in': ['pending', 'eligible', 'held']}
            }, sort=[('period_start', 1)])

            if next_invoice:
                new_carry = (next_invoice.get('carry_forward', 0) or 0) + points
                new_net = (next_invoice.get('gross_amount', 0) or 0) - (next_invoice.get('reversals_amount', 0) or 0) - new_carry
                invoices_col.update_one({'_id': next_invoice['_id']}, {'$set': {
                    'carry_forward': new_carry,
                    'net_amount': new_net,
                    'updated_at': datetime.utcnow()
                }})
            else:
                # Store as pending carry forward for when next invoice is generated
                carry_col = get_collection('carry_forwards')
                if carry_col:
                    carry_col.update_one(
                        {'user_id': publisher_id},
                        {'$inc': {'amount': points}, '$set': {'updated_at': datetime.utcnow()}},
                        upsert=True
                    )

    except Exception as e:
        logger.warning(f"Failed to update invoice on reversal: {e}")
