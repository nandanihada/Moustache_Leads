"""
Offer Status Signals Admin API
Provides endpoints for the admin panel to view, apply, ignore, and configure
offer status signals received from network webhooks.
"""

from flask import Blueprint, request, jsonify
from datetime import datetime
from bson import ObjectId
import logging
from utils.auth import token_required, subadmin_or_admin_required

offer_status_signals_bp = Blueprint('offer_status_signals', __name__)
logger = logging.getLogger(__name__)


def get_collection(name):
    from database import db_instance
    return db_instance.get_collection(name)


@offer_status_signals_bp.route('/offer-status-signals', methods=['GET'])
@token_required
@subadmin_or_admin_required('offers')
def list_signals():
    """List offer status signals with filters and pagination"""
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 50))
        network = request.args.get('network', '')
        status_filter = request.args.get('status', '')  # pending, applied, ignored
        search = request.args.get('search', '')

        signals_col = get_collection('offer_status_signals')
        if signals_col is None:
            return jsonify({'signals': [], 'total': 0, 'pending_count': 0}), 200

        # Build query
        query = {}
        if network:
            query['network'] = network
        if status_filter == 'pending':
            query['applied'] = False
            query['ignored'] = False
        elif status_filter == 'applied':
            query['applied'] = True
        elif status_filter == 'ignored':
            query['ignored'] = True
        if search:
            query['$or'] = [
                {'matched_offer_name': {'$regex': search, '$options': 'i'}},
                {'offer_id_received': {'$regex': search, '$options': 'i'}},
                {'status_received': {'$regex': search, '$options': 'i'}},
            ]

        total = signals_col.count_documents(query)
        pending_count = signals_col.count_documents({'applied': False, 'ignored': False})

        signals = list(signals_col.find(query)
                       .sort('received_at', -1)
                       .skip((page - 1) * limit)
                       .limit(limit))

        # Serialize
        for s in signals:
            s['_id'] = str(s['_id'])
            if s.get('received_at'):
                s['received_at'] = s['received_at'].isoformat() + 'Z'
            if s.get('applied_at'):
                s['applied_at'] = s['applied_at'].isoformat() + 'Z'

        # Get distinct networks for filter dropdown
        networks = signals_col.distinct('network')

        return jsonify({
            'signals': signals,
            'total': total,
            'pending_count': pending_count,
            'networks': networks,
            'page': page,
            'limit': limit,
        }), 200

    except Exception as e:
        logger.error(f"List signals error: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@offer_status_signals_bp.route('/offer-status-signals/apply', methods=['POST'])
@token_required
@subadmin_or_admin_required('offers')
def apply_signals():
    """Apply status change to matched offers"""
    try:
        data = request.get_json()
        signal_ids = data.get('signal_ids', [])
        target_status = data.get('target_status', 'inactive')

        if not signal_ids:
            return jsonify({'error': 'signal_ids required'}), 400

        valid_statuses = ['active', 'inactive', 'paused', 'hidden']
        if target_status not in valid_statuses:
            return jsonify({'error': f'Invalid status. Must be one of: {valid_statuses}'}), 400

        signals_col = get_collection('offer_status_signals')
        offers_col = get_collection('offers')

        if signals_col is None or offers_col is None:
            return jsonify({'error': 'Database error'}), 500

        # Get signals
        obj_ids = [ObjectId(sid) for sid in signal_ids if ObjectId.is_valid(sid)]
        signals = list(signals_col.find({'_id': {'$in': obj_ids}, 'applied': False}))

        applied_count = 0
        for signal in signals:
            offer_id_received = signal.get('offer_id_received')
            network = signal.get('network', '')

            if not offer_id_received:
                continue

            # Find and update the offer
            update_result = offers_col.update_one(
                {
                    'campaign_id': str(offer_id_received),
                    '$or': [
                        {'network': network},
                        {'network_type': network},
                        {'network': {'$regex': network, '$options': 'i'}},
                    ]
                },
                {'$set': {'status': target_status, 'updated_at': datetime.utcnow()}}
            )

            if update_result.modified_count > 0:
                applied_count += 1

            # Mark signal as applied
            signals_col.update_one(
                {'_id': signal['_id']},
                {'$set': {
                    'applied': True,
                    'applied_at': datetime.utcnow(),
                    'applied_status': target_status,
                    'applied_by': str(request.current_user.get('_id', 'admin')),
                }}
            )

        logger.info(f"✅ Applied {applied_count} offer status changes to '{target_status}'")

        return jsonify({
            'success': True,
            'applied': applied_count,
            'total_signals': len(signals),
            'status': target_status,
        }), 200

    except Exception as e:
        logger.error(f"Apply signals error: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@offer_status_signals_bp.route('/offer-status-signals/ignore', methods=['POST'])
@token_required
@subadmin_or_admin_required('offers')
def ignore_signals():
    """Mark signals as ignored"""
    try:
        data = request.get_json()
        signal_ids = data.get('signal_ids', [])

        if not signal_ids:
            return jsonify({'error': 'signal_ids required'}), 400

        signals_col = get_collection('offer_status_signals')
        if signals_col is None:
            return jsonify({'error': 'Database error'}), 500

        obj_ids = [ObjectId(sid) for sid in signal_ids if ObjectId.is_valid(sid)]
        result = signals_col.update_many(
            {'_id': {'$in': obj_ids}},
            {'$set': {'ignored': True, 'ignored_at': datetime.utcnow()}}
        )

        return jsonify({
            'success': True,
            'ignored': result.modified_count,
        }), 200

    except Exception as e:
        logger.error(f"Ignore signals error: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@offer_status_signals_bp.route('/offer-status-signals/stats', methods=['GET'])
@token_required
@subadmin_or_admin_required('offers')
def signal_stats():
    """Get summary stats for the signals dashboard"""
    try:
        signals_col = get_collection('offer_status_signals')
        if signals_col is None:
            return jsonify({'pending': 0, 'applied': 0, 'ignored': 0, 'total': 0}), 200

        pending = signals_col.count_documents({'applied': False, 'ignored': False})
        applied = signals_col.count_documents({'applied': True})
        ignored = signals_col.count_documents({'ignored': True})
        total = pending + applied + ignored

        return jsonify({
            'pending': pending,
            'applied': applied,
            'ignored': ignored,
            'total': total,
        }), 200

    except Exception as e:
        logger.error(f"Signal stats error: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500
