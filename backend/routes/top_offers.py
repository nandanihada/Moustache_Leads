from flask import Blueprint, request, jsonify
from utils.auth import token_required, admin_required
from bson import ObjectId
from datetime import datetime
import logging
from database import db_instance

logger = logging.getLogger(__name__)

top_offers_bp = Blueprint('top_offers', __name__)

DEFAULT_SETTINGS = {
    'key': 'config',
    'mode': 'hybrid',  # manual, auto, hybrid
    'auto_criteria': 'conversions',  # conversions, clicks, requests
}

def _get_collection(name):
    return db_instance.get_collection(name)

@top_offers_bp.route('/top-offers/settings', methods=['GET'])
@token_required
@admin_required
def get_top_offers_settings():
    """Get current Top Offers settings (Admin only)."""
    try:
        col = _get_collection('top_offers_settings')
        if col is None:
            return jsonify({**DEFAULT_SETTINGS}), 200
        doc = col.find_one({'key': 'config'})
        if not doc:
            return jsonify({**DEFAULT_SETTINGS}), 200
        return jsonify({
            'mode': doc.get('mode', DEFAULT_SETTINGS['mode']),
            'auto_criteria': doc.get('auto_criteria', DEFAULT_SETTINGS['auto_criteria'])
        }), 200
    except Exception as e:
        logger.error(f"Error fetching top offers settings: {e}")
        return jsonify({'error': str(e)}), 500

@top_offers_bp.route('/top-offers/settings', methods=['PUT'])
@token_required
@admin_required
def update_top_offers_settings():
    """Update Top Offers settings (Admin only)."""
    try:
        data = request.get_json() or {}
        mode = data.get('mode', 'hybrid')
        auto_criteria = data.get('auto_criteria', 'conversions')

        if mode not in ['manual', 'auto', 'hybrid']:
            return jsonify({'error': 'Invalid mode'}), 400
        if auto_criteria not in ['conversions', 'clicks', 'requests']:
            return jsonify({'error': 'Invalid auto criteria'}), 400

        col = _get_collection('top_offers_settings')
        if col is None:
            return jsonify({'error': 'Database unavailable'}), 500

        update = {
            'key': 'config',
            'mode': mode,
            'auto_criteria': auto_criteria,
            'updated_at': datetime.utcnow()
        }
        col.update_one({'key': 'config'}, {'$set': update}, upsert=True)
        return jsonify({'success': True, 'message': 'Top Offers settings updated successfully'}), 200
    except Exception as e:
        logger.error(f"Error updating top offers settings: {e}")
        return jsonify({'error': str(e)}), 500

@top_offers_bp.route('/top-offers', methods=['GET'])
@token_required
@admin_required
def get_admin_top_offers():
    """Get curated manual Top Offers, current settings, and all active offers for selection (Admin only)."""
    try:
        # 1. Fetch settings
        settings_col = _get_collection('top_offers_settings')
        settings = DEFAULT_SETTINGS.copy()
        if settings_col is not None:
            doc = settings_col.find_one({'key': 'config'})
            if doc:
                settings['mode'] = doc.get('mode', DEFAULT_SETTINGS['mode'])
                settings['auto_criteria'] = doc.get('auto_criteria', DEFAULT_SETTINGS['auto_criteria'])

        # 2. Fetch manual curated offers
        top_offers_col = _get_collection('top_offers')
        offers_col = _get_collection('offers')
        
        curated_offers = []
        if top_offers_col is not None and offers_col is not None:
            curated_docs = list(top_offers_col.find().sort('position', 1))
            curated_ids = [d['offer_id'] for d in curated_docs]
            
            # Retrieve details from offers collection
            offer_details = {
                o['offer_id']: o for o in offers_col.find({
                    'offer_id': {'$in': curated_ids},
                    '$or': [{'deleted': {'$exists': False}}, {'deleted': False}]
                })
            }
            
            for d in curated_docs:
                oid = d['offer_id']
                if oid in offer_details:
                    details = offer_details[oid]
                    curated_offers.append({
                        'offer_id': oid,
                        'name': details.get('name', 'Unknown Offer'),
                        'payout': details.get('payout', 0),
                        'category': details.get('category', 'OTHER'),
                        'vertical': details.get('vertical', 'OTHER'),
                        'status': details.get('status', 'active'),
                        'position': d.get('position', 0),
                        'is_pinned': d.get('is_pinned', True)
                    })

        # 3. Fetch all active offers for list/dropdown selection
        active_offers = []
        if offers_col is not None:
            active_docs = list(offers_col.find({
                'status': 'active',
                '$or': [{'deleted': {'$exists': False}}, {'deleted': False}]
            }, {
                'offer_id': 1, 'name': 1, 'payout': 1, 'category': 1, 'vertical': 1, 'status': 1
            }).sort('name', 1))
            
            # Filter out offers that are already manually curated
            curated_ids_set = set(curated_ids) if 'curated_ids' in locals() else set()
            for doc in active_docs:
                oid = doc.get('offer_id')
                if oid and oid not in curated_ids_set:
                    active_offers.append({
                        'offer_id': oid,
                        'name': doc.get('name', 'Unknown Offer'),
                        'payout': doc.get('payout', 0),
                        'category': doc.get('category', 'OTHER'),
                        'vertical': doc.get('vertical', 'OTHER'),
                        'status': doc.get('status', 'active')
                    })

        return jsonify({
            'success': True,
            'settings': settings,
            'top_offers': curated_offers,
            'active_offers': active_offers
        }), 200
    except Exception as e:
        logger.error(f"Error fetching admin top offers: {e}")
        return jsonify({'error': str(e)}), 500

@top_offers_bp.route('/top-offers/add', methods=['POST'])
@token_required
@admin_required
def add_top_offer():
    """Add an offer to the curated Top Offers list manually (Admin only)."""
    try:
        data = request.get_json() or {}
        offer_id = data.get('offer_id')

        if not offer_id:
            return jsonify({'error': 'Missing offer_id'}), 400

        top_offers_col = _get_collection('top_offers')
        offers_col = _get_collection('offers')
        if top_offers_col is None or offers_col is None:
            return jsonify({'error': 'Database unavailable'}), 500

        # Check if offer exists and is active/valid
        offer = offers_col.find_one({
            'offer_id': offer_id,
            '$or': [{'deleted': {'$exists': False}}, {'deleted': False}]
        })
        if not offer:
            return jsonify({'error': 'Offer not found or deleted'}), 404

        # Check if already added
        existing = top_offers_col.find_one({'offer_id': offer_id})
        if existing:
            return jsonify({'error': 'Offer already added to Top Offers'}), 400

        # Limit to 20 manual offers
        count = top_offers_col.count_documents({})
        if count >= 20:
            return jsonify({'error': 'Cannot add more than 20 offers to Top Offers. Please remove some first.'}), 400

        # Find the next position index
        next_pos = count
        
        top_offers_col.insert_one({
            'offer_id': offer_id,
            'position': next_pos,
            'is_pinned': True,
            'added_at': datetime.utcnow()
        })

        return jsonify({'success': True, 'message': f"Offer '{offer.get('name')}' added to Top Offers"}), 200
    except Exception as e:
        logger.error(f"Error adding top offer: {e}")
        return jsonify({'error': str(e)}), 500

@top_offers_bp.route('/top-offers/remove/<offer_id>', methods=['DELETE'])
@token_required
@admin_required
def remove_top_offer(offer_id):
    """Remove/unpin an offer from the curated Top Offers list (Admin only)."""
    try:
        top_offers_col = _get_collection('top_offers')
        if top_offers_col is None:
            return jsonify({'error': 'Database unavailable'}), 500

        result = top_offers_col.delete_one({'offer_id': offer_id})
        if result.deleted_count == 0:
            return jsonify({'error': 'Offer not found in Top Offers list'}), 404

        # Re-index positions of remaining offers to ensure no gaps
        remaining = list(top_offers_col.find().sort('position', 1))
        for idx, doc in enumerate(remaining):
            top_offers_col.update_one({'_id': doc['_id']}, {'$set': {'position': idx}})

        return jsonify({'success': True, 'message': 'Offer removed from Top Offers list'}), 200
    except Exception as e:
        logger.error(f"Error removing top offer: {e}")
        return jsonify({'error': str(e)}), 500

@top_offers_bp.route('/top-offers/reorder', methods=['PUT'])
@token_required
@admin_required
def reorder_top_offers():
    """Update order of curated Top Offers manually via drag-and-drop (Admin only)."""
    try:
        data = request.get_json() or {}
        ordered_ids = data.get('ordered_ids', [])

        if not isinstance(ordered_ids, list):
            return jsonify({'error': 'ordered_ids must be a list'}), 400

        top_offers_col = _get_collection('top_offers')
        if top_offers_col is None:
            return jsonify({'error': 'Database unavailable'}), 500

        # Update position for each offer_id in ordered list
        for idx, oid in enumerate(ordered_ids):
            top_offers_col.update_one({'offer_id': oid}, {'$set': {'position': idx}})

        return jsonify({'success': True, 'message': 'Top Offers order updated successfully'}), 200
    except Exception as e:
        logger.error(f"Error reordering top offers: {e}")
        return jsonify({'error': str(e)}), 500
