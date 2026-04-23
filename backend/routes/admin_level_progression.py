from flask import Blueprint, request, jsonify
from utils.auth import token_required
from database import db_instance
from bson import ObjectId
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

admin_level_progression_bp = Blueprint('admin_level_progression', __name__)

def admin_required(f):
    """Decorator to require admin role"""
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = getattr(request, 'current_user', None)
        if not user or user.get('role') not in ('admin', 'subadmin'):
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated_function


def check_level_upgrade_eligibility(user, user_stats):
    """
    Check if a user qualifies for the next level based on their activity.
    
    Level System:
    L1 → L2: Browsed offers (offers_viewed > 0)
    L2 → L3: Placed/activated account (has login activity)
    L3 → L4: Requested an offer (offers_requested > 0)
    L4 → L5: Offer approved (approved_offers > 0)
    L5 → L6: Suspicious activity detected (suspicious = True)
    L6 → L7: Activity cleared, genuine but no conversion (suspicious = False, conversions = 0)
    L7 → Stay: Genuine, no conversion (final level)
    
    Returns:
        dict with: qualifies_for_upgrade, next_level, upgrade_reason
    """
    current_level = user.get('level', 'L1')
    
    # Extract stats
    offers_viewed = user_stats.get('offers_viewed', 0)
    offers_requested = user_stats.get('offers_requested', 0)
    approved_offers_count = len(user_stats.get('approved_offers', []))
    suspicious = user_stats.get('suspicious', False)
    conversions = user_stats.get('conversions', 0)
    logins_7d = user_stats.get('logins_7d', 0)
    
    # Level upgrade logic
    if current_level == 'L1':
        # L1 → L2: Browsed offers
        if offers_viewed > 0:
            return {
                'qualifies_for_upgrade': True,
                'next_level': 'L2',
                'upgrade_reason': f'Browsed {offers_viewed} offers'
            }
    
    elif current_level == 'L2':
        # L2 → L3: Placed/activated account (has login activity)
        if logins_7d > 0:
            return {
                'qualifies_for_upgrade': True,
                'next_level': 'L3',
                'upgrade_reason': f'Active account with {logins_7d} logins in last 7 days'
            }
    
    elif current_level == 'L3':
        # L3 → L4: Requested an offer (MOST IMPORTANT)
        if offers_requested > 0:
            return {
                'qualifies_for_upgrade': True,
                'next_level': 'L4',
                'upgrade_reason': f'Requested {offers_requested} offer(s)'
            }
    
    elif current_level == 'L4':
        # L4 → L5: Offer approved
        if approved_offers_count > 0:
            return {
                'qualifies_for_upgrade': True,
                'next_level': 'L5',
                'upgrade_reason': f'{approved_offers_count} offer(s) approved'
            }
    
    elif current_level == 'L5':
        # L5 → L6: Suspicious activity detected
        if suspicious:
            return {
                'qualifies_for_upgrade': True,
                'next_level': 'L6',
                'upgrade_reason': 'Suspicious activity detected'
            }
    
    elif current_level == 'L6':
        # L6 → L7: Activity cleared, genuine but no conversion
        if not suspicious and conversions == 0:
            return {
                'qualifies_for_upgrade': True,
                'next_level': 'L7',
                'upgrade_reason': 'Activity cleared, genuine publisher'
            }
    
    # No upgrade available
    return {
        'qualifies_for_upgrade': False,
        'next_level': None,
        'upgrade_reason': None
    }


@admin_level_progression_bp.route('/api/admin/publishers/level-check', methods=['POST'])
@token_required
@admin_required
def check_publisher_levels():
    """
    Check level upgrade eligibility for multiple publishers.
    Returns upgrade status for each publisher.
    """
    try:
        data = request.get_json()
        publisher_ids = data.get('publisher_ids', [])
        
        if not publisher_ids:
            return jsonify({'error': 'No publishers provided'}), 400
        
        users_col = db_instance.get_collection('users')
        clicks_col = db_instance.get_collection('clicks')
        user_offers_col = db_instance.get_collection('user_offers')
        logins_col = db_instance.get_collection('logins')
        
        if users_col is None:
            return jsonify({'error': 'Database not available'}), 503
        
        # Get publishers
        publishers = list(users_col.find(
            {'_id': {'$in': [ObjectId(pid) for pid in publisher_ids if ObjectId.is_valid(pid)]}},
            {'username': 1, 'level': 1, 'previous_level': 1, 'level_updated_at': 1, 'suspicious': 1}
        ))
        
        results = []
        
        for publisher in publishers:
            publisher_id = publisher['_id']
            
            # Get actual stats from database
            # Count offers viewed
            offers_viewed = 0
            if clicks_col is not None:
                offers_viewed = clicks_col.count_documents({'user_id': publisher_id})
            
            # Count offers requested
            offers_requested = 0
            approved_offers = []
            if user_offers_col is not None:
                offers_requested = user_offers_col.count_documents({'user_id': publisher_id})
                approved_offers = list(user_offers_col.find({'user_id': publisher_id, 'status': 'approved'}))
            
            # Count logins in last 7 days
            logins_7d = 0
            if logins_col is not None:
                from datetime import timedelta
                seven_days_ago = datetime.utcnow() - timedelta(days=7)
                logins_7d = logins_col.count_documents({
                    'user_id': publisher_id,
                    'timestamp': {'$gte': seven_days_ago}
                })
            
            # Get suspicious flag
            suspicious = publisher.get('suspicious', False)
            
            # Count conversions (simplified - you may have a conversions collection)
            conversions = 0
            
            user_stats = {
                'offers_viewed': offers_viewed,
                'offers_requested': offers_requested,
                'approved_offers': approved_offers,
                'suspicious': suspicious,
                'conversions': conversions,
                'logins_7d': logins_7d
            }
            
            # Check upgrade eligibility
            upgrade_info = check_level_upgrade_eligibility(publisher, user_stats)
            
            # Build criteria_met dict
            criteria_met = {}
            current_level = publisher.get('level', 'L1')
            
            if current_level == 'L1':
                criteria_met['offers_viewed'] = offers_viewed > 0
            elif current_level == 'L2':
                criteria_met['active_logins'] = logins_7d > 0
            elif current_level == 'L3':
                criteria_met['offers_requested'] = offers_requested > 0
            elif current_level == 'L4':
                criteria_met['offers_approved'] = len(approved_offers) > 0
            elif current_level == 'L5':
                criteria_met['suspicious_activity'] = suspicious
            elif current_level == 'L6':
                criteria_met['activity_cleared'] = not suspicious
                criteria_met['no_conversions'] = conversions == 0
            
            results.append({
                'publisher_id': str(publisher['_id']),
                'username': publisher.get('username'),
                'current_level': current_level,
                'next_level': upgrade_info.get('next_level'),
                'eligible': upgrade_info.get('qualifies_for_upgrade', False),
                'reason': upgrade_info.get('upgrade_reason', ''),
                'criteria_met': criteria_met,
                'previous_level': publisher.get('previous_level'),
                'level_updated_at': publisher.get('level_updated_at')
            })
        
        return jsonify({
            'success': True,
            'results': results
        }), 200
        
    except Exception as e:
        logger.error(f"Error checking publisher levels: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to check levels: {str(e)}'}), 500


@admin_level_progression_bp.route('/api/admin/publishers/<publisher_id>/upgrade-level', methods=['POST'])
@token_required
@admin_required
def upgrade_publisher_level(publisher_id):
    """
    Manually upgrade a publisher to the next level.
    Auto-detects next level or accepts manual override.
    """
    try:
        users_col = db_instance.get_collection('users')
        if users_col is None:
            return jsonify({'error': 'Database not available'}), 503
        
        # Get current user
        user = users_col.find_one({'_id': ObjectId(publisher_id)})
        if not user:
            return jsonify({'error': 'Publisher not found'}), 404
        
        current_level = user.get('level', 'L1')
        
        # Auto-detect next level
        data = request.get_json() or {}
        new_level = data.get('new_level')
        
        if not new_level:
            # Auto-increment level
            level_num = int(current_level.replace('L', ''))
            if level_num < 7:
                new_level = f'L{level_num + 1}'
            else:
                return jsonify({'error': 'Already at maximum level L7'}), 400
        
        # Validate level format
        valid_levels = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7']
        if new_level not in valid_levels:
            return jsonify({'error': f'Invalid level. Must be one of: {", ".join(valid_levels)}'}), 400
        
        # Update level
        result = users_col.update_one(
            {'_id': ObjectId(publisher_id)},
            {
                '$set': {
                    'level': new_level,
                    'previous_level': current_level,
                    'level_updated_at': datetime.utcnow()
                }
            }
        )
        
        if result.modified_count > 0:
            return jsonify({
                'success': True,
                'message': f'Publisher upgraded from {current_level} to {new_level}',
                'previous_level': current_level,
                'new_level': new_level
            }), 200
        else:
            return jsonify({'error': 'Failed to update level'}), 500
        
    except Exception as e:
        logger.error(f"Error upgrading publisher level: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to upgrade level: {str(e)}'}), 500


@admin_level_progression_bp.route('/api/admin/publishers/upgrade-eligible', methods=['GET'])
@token_required
@admin_required
def get_upgrade_eligible_publishers():
    """
    Get all publishers who qualify for level upgrade.
    Returns count and list of eligible publishers.
    """
    try:
        users_col = db_instance.get_collection('users')
        if users_col is None:
            return jsonify({'error': 'Database not available'}), 503
        
        # Get all approved publishers
        publishers = list(users_col.find(
            {'account_status': 'approved'},
            {'username': 1, 'level': 1, 'email': 1}
        ))
        
        eligible_publishers = []
        
        for publisher in publishers:
            # Get stats (simplified - you'll need actual stats)
            user_stats = {
                'offers_viewed': 0,
                'offers_requested': 0,
                'approved_offers': [],
                'suspicious': False,
                'conversions': 0,
                'logins_7d': 0
            }
            
            upgrade_info = check_level_upgrade_eligibility(publisher, user_stats)
            
            if upgrade_info['qualifies_for_upgrade']:
                eligible_publishers.append({
                    'publisher_id': str(publisher['_id']),
                    'username': publisher.get('username'),
                    'email': publisher.get('email'),
                    'current_level': publisher.get('level', 'L1'),
                    'next_level': upgrade_info['next_level'],
                    'upgrade_reason': upgrade_info['upgrade_reason']
                })
        
        return jsonify({
            'success': True,
            'count': len(eligible_publishers),
            'eligible_publishers': eligible_publishers
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting eligible publishers: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get eligible publishers: {str(e)}'}), 500
