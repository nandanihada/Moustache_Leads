"""
Admin endpoint to fix incentive types for all offers
"""

from flask import Blueprint, jsonify
from database import db_instance
from models.offer import calculate_incentive_type
from utils.auth import token_required, admin_required
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

fix_incentives_bp = Blueprint('fix_incentives', __name__)

@fix_incentives_bp.route('/admin/fix-incentive-types', methods=['POST'])
@token_required
@admin_required
def fix_all_incentive_types():
    """
    Fix incentive types for all offers based on payout_type
    This endpoint recalculates and updates incentive_type for all active offers
    """
    try:
        if not db_instance.is_connected():
            return jsonify({'error': 'Database not connected'}), 500
        
        offers_collection = db_instance.get_collection('offers')
        
        # Get all active offers
        offers = list(offers_collection.find({'is_active': True}))
        
        fixed_count = 0
        already_correct = 0
        results = []
        
        for offer in offers:
            offer_id = offer.get('offer_id')
            payout_type = offer.get('payout_type', 'fixed')
            revenue_share = offer.get('revenue_share_percent', 0)
            old_incentive = offer.get('incentive_type', 'Not Set')
            
            # Calculate correct incentive type
            new_incentive = calculate_incentive_type(payout_type, revenue_share)
            
            # Update if different
            if old_incentive != new_incentive:
                offers_collection.update_one(
                    {'_id': offer['_id']},
                    {'$set': {
                        'incentive_type': new_incentive,
                        'updated_at': datetime.utcnow()
                    }}
                )
                
                results.append({
                    'offer_id': offer_id,
                    'name': offer.get('name'),
                    'payout_type': payout_type,
                    'old_incentive': old_incentive,
                    'new_incentive': new_incentive,
                    'status': 'fixed'
                })
                fixed_count += 1
                logger.info(f"✅ Fixed {offer_id}: {old_incentive} → {new_incentive}")
            else:
                already_correct += 1
        
        return jsonify({
            'success': True,
            'message': f'Fixed {fixed_count} offers, {already_correct} already correct',
            'total_offers': len(offers),
            'fixed': fixed_count,
            'already_correct': already_correct,
            'results': results
        }), 200
        
    except Exception as e:
        logger.error(f"Error fixing incentive types: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to fix incentive types: {str(e)}'}), 500
