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


def determine_correct_level(user_stats):
    """
    Determine the correct level based on actual user activity.
    This ensures users are at the right level regardless of their current assignment.
    
    Level Logic - Priority Order:
    L1: Signed up, no engagement (offers_viewed = 0)
    L2: Browsed offers (offers_viewed > 0)
    L3: Active account (logins_7d > 0)
    L4: Requested offers (offers_requested > 0)
    L5: Approved offers (approved_offers > 0)
    L6: Suspicious activity (suspicious = True)
    L7: Genuine, no conversion (approved_offers > 0 AND conversions = 0 AND suspicious = False)
    """
    offers_viewed = user_stats.get('offers_viewed', 0)
    offers_requested = user_stats.get('offers_requested', 0)
    approved_offers_count = len(user_stats.get('approved_offers', []))
    suspicious = user_stats.get('suspicious', False)
    conversions = user_stats.get('conversions', 0)
    logins_7d = user_stats.get('logins_7d', 0)
    
    # L6: Suspicious activity takes highest priority
    if suspicious:
        return 'L6'
    
    # L7: Genuine publisher with approved offers but no conversions
    # This is for publishers who are cleared (not suspicious) but haven't generated conversions yet
    if approved_offers_count > 0 and conversions == 0 and not suspicious:
        return 'L7'
    
    # L5: Has approved offers AND has conversions (successful publisher)
    if approved_offers_count > 0 and conversions > 0:
        return 'L5'
    
    # L4: Has requested offers but none approved yet
    if offers_requested > 0:
        return 'L4'
    
    # L3: Has login activity in last 7 days
    if logins_7d > 0:
        return 'L3'
    
    # L2: Has viewed offers
    if offers_viewed > 0:
        return 'L2'
    
    # L1: No engagement
    return 'L1'


def check_level_upgrade_eligibility(user, user_stats):
    """
    Check if a user qualifies for the next level based on their activity.
    
    Level System:
    L1 → L2: Browsed offers (offers_viewed > 0)
    L2 → L3: Placed/activated account (has login activity)
    L3 → L4: Requested an offer (offers_requested > 0)
    L4 → L5: Offer approved AND has conversions (approved_offers > 0 AND conversions > 0)
    L4 → L7: Offer approved but NO conversions (approved_offers > 0 AND conversions = 0)
    L5 → L6: Suspicious activity detected (suspicious = True)
    L6 → L7: Activity cleared, genuine but no conversion (suspicious = False, conversions = 0)
    L7 → L5: Generated first conversion (conversions > 0)
    
    Returns:
        dict with: qualifies_for_upgrade, next_level, upgrade_reason
    """
    current_level = user.get('level', 'L1')
    
    # Determine what level they SHOULD be at based on activity
    correct_level = determine_correct_level(user_stats)
    
    # Extract stats
    offers_viewed = user_stats.get('offers_viewed', 0)
    offers_requested = user_stats.get('offers_requested', 0)
    approved_offers_count = len(user_stats.get('approved_offers', []))
    suspicious = user_stats.get('suspicious', False)
    conversions = user_stats.get('conversions', 0)
    logins_7d = user_stats.get('logins_7d', 0)
    
    # If current level doesn't match correct level, flag for correction
    if current_level != correct_level:
        level_names = {
            'L1': 'No engagement',
            'L2': 'Browsed offers',
            'L3': 'Active account',
            'L4': 'Requested offers',
            'L5': 'Approved offers with conversions',
            'L6': 'Suspicious',
            'L7': 'Genuine, no conversions'
        }
        return {
            'qualifies_for_upgrade': True,
            'next_level': correct_level,
            'upgrade_reason': f'Level correction needed: {level_names.get(correct_level, correct_level)}',
            'is_correction': True
        }
    
    # Level upgrade logic (for natural progression)
    if current_level == 'L1':
        if offers_viewed > 0:
            return {
                'qualifies_for_upgrade': True,
                'next_level': 'L2',
                'upgrade_reason': f'Browsed {offers_viewed} offers'
            }
    
    elif current_level == 'L2':
        if logins_7d > 0:
            return {
                'qualifies_for_upgrade': True,
                'next_level': 'L3',
                'upgrade_reason': f'Active account with {logins_7d} logins in last 7 days'
            }
    
    elif current_level == 'L3':
        if offers_requested > 0:
            return {
                'qualifies_for_upgrade': True,
                'next_level': 'L4',
                'upgrade_reason': f'Requested {offers_requested} offer(s)'
            }
    
    elif current_level == 'L4':
        if approved_offers_count > 0:
            # Check if they have conversions
            if conversions > 0:
                return {
                    'qualifies_for_upgrade': True,
                    'next_level': 'L5',
                    'upgrade_reason': f'{approved_offers_count} offer(s) approved with {conversions} conversion(s)'
                }
            else:
                # Approved offers but no conversions = L7
                return {
                    'qualifies_for_upgrade': True,
                    'next_level': 'L7',
                    'upgrade_reason': f'{approved_offers_count} offer(s) approved, awaiting conversions'
                }
    
    elif current_level == 'L5':
        if suspicious:
            return {
                'qualifies_for_upgrade': True,
                'next_level': 'L6',
                'upgrade_reason': 'Suspicious activity detected'
            }
    
    elif current_level == 'L6':
        if not suspicious:
            # Cleared from suspicious
            if conversions > 0:
                return {
                    'qualifies_for_upgrade': True,
                    'next_level': 'L5',
                    'upgrade_reason': 'Activity cleared, has conversions'
                }
            else:
                return {
                    'qualifies_for_upgrade': True,
                    'next_level': 'L7',
                    'upgrade_reason': 'Activity cleared, genuine publisher'
                }
    
    elif current_level == 'L7':
        # L7 can upgrade to L5 if they get conversions
        if conversions > 0:
            return {
                'qualifies_for_upgrade': True,
                'next_level': 'L5',
                'upgrade_reason': f'Generated {conversions} conversion(s)'
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
        affiliate_requests_col = db_instance.get_collection('affiliate_requests')
        login_logs_col = db_instance.get_collection('login_logs')
        
        if users_col is None:
            return jsonify({'error': 'Database not available'}), 503
        
        # Get publishers
        publishers = list(users_col.find(
            {'_id': {'$in': [ObjectId(pid) for pid in publisher_ids if ObjectId.is_valid(pid)]}},
            {'username': 1, 'level': 1, 'previous_level': 1, 'level_updated_at': 1, 'suspicious': 1}
        ))
        
        results = []
        
        for publisher in publishers:
            publisher_id = str(publisher['_id'])
            
            # Get actual stats from database
            username = publisher.get('username', '')
            
            # Count offers viewed (from ALL click collections)
            offers_viewed = 0
            if clicks_col is not None:
                # Check multiple field variations
                offers_viewed += clicks_col.count_documents({'$or': [
                    {'user_id': publisher_id},
                    {'affiliate_id': publisher_id},
                    {'publisher_id': publisher_id},
                    {'username': username}
                ]})
            
            # Also check offerwall_clicks
            offerwall_clicks_col = db_instance.get_collection('offerwall_clicks')
            if offerwall_clicks_col is not None:
                offers_viewed += offerwall_clicks_col.count_documents({'$or': [
                    {'user_id': publisher_id},
                    {'publisher_id': publisher_id},
                    {'username': username}
                ]})
            
            # Check dashboard_clicks
            dashboard_clicks_col = db_instance.get_collection('dashboard_clicks')
            if dashboard_clicks_col is not None:
                offers_viewed += dashboard_clicks_col.count_documents({'$or': [
                    {'user_id': publisher_id},
                    {'username': username}
                ]})
            
            # Check offerwall_clicks_detailed
            offerwall_detailed_col = db_instance.get_collection('offerwall_clicks_detailed')
            if offerwall_detailed_col is not None:
                offers_viewed += offerwall_detailed_col.count_documents({'$or': [
                    {'user_id': publisher_id},
                    {'publisher_name': username}
                ]})
            
            # Count offers requested from affiliate_requests
            offers_requested = 0
            approved_offers = []
            if affiliate_requests_col is not None:
                # Check multiple field variations for affiliate_requests
                offers_requested = affiliate_requests_col.count_documents({'$or': [
                    {'user_id': publisher_id},
                    {'user_id': ObjectId(publisher_id)},
                    {'username': username}
                ]})
                approved_offers = list(affiliate_requests_col.find({
                    '$or': [
                        {'user_id': publisher_id},
                        {'user_id': ObjectId(publisher_id)},
                        {'username': username}
                    ],
                    'status': 'approved'
                }))
            
            # Count logins in last 7 days
            logins_7d = 0
            if login_logs_col is not None:
                from datetime import timedelta
                seven_days_ago = datetime.utcnow() - timedelta(days=7)
                logins_7d = login_logs_col.count_documents({
                    '$or': [
                        {'user_id': publisher_id},
                        {'username': username}
                    ],
                    'status': 'success',
                    'login_time': {'$gte': seven_days_ago}
                })
            
            # Get suspicious flag
            suspicious = publisher.get('suspicious', False)
            
            # Count conversions from forwarded_postbacks or conversions collection
            conversions = 0
            conversions_col = db_instance.get_collection('forwarded_postbacks')
            if conversions_col is not None:
                conversions = conversions_col.count_documents({'publisher_id': publisher_id})
            
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
            
            # Build comprehensive criteria_met dict showing data for ALL levels
            criteria_met = {
                'L1_no_engagement': offers_viewed == 0,
                'L2_browsed_offers': offers_viewed > 0,
                'L3_active_account': logins_7d > 0,
                'L4_requested_offers': offers_requested > 0,
                'L5_approved_offers': len(approved_offers) > 0,
                'L6_suspicious_activity': suspicious,
                'L7_genuine_cleared': not suspicious and len(approved_offers) > 0 and conversions == 0,
                # Additional data for debugging
                'offers_viewed': offers_viewed,
                'offers_requested': offers_requested,
                'approved_offers_count': len(approved_offers),
                'suspicious': suspicious,
                'conversions': conversions,
                'logins_7d': logins_7d
            }
            
            # Get current level (will be corrected if needed)
            current_level = publisher.get('level', 'L1')
            
            results.append({
                'publisher_id': str(publisher['_id']),
                'username': publisher.get('username'),
                'current_level': current_level,
                'next_level': upgrade_info.get('next_level'),
                'eligible': upgrade_info.get('qualifies_for_upgrade', False),
                'reason': upgrade_info.get('upgrade_reason', ''),
                'is_correction': upgrade_info.get('is_correction', False),
                'criteria_met': criteria_met,
                'previous_level': publisher.get('previous_level'),
                'level_updated_at': publisher.get('level_updated_at'),
                # Debug info
                'debug': {
                    'offers_viewed': offers_viewed,
                    'offers_requested': offers_requested,
                    'approved_count': len(approved_offers),
                    'logins_7d': logins_7d,
                    'suspicious': suspicious,
                    'conversions': conversions
                }
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


@admin_level_progression_bp.route('/api/admin/publishers/level-distribution', methods=['GET'])
@token_required
@admin_required
def get_level_distribution():
    """
    Get level distribution with change indicators.
    Shows count per level and recent changes (last 24 hours).
    """
    try:
        users_col = db_instance.get_collection('users')
        if users_col is None:
            return jsonify({'error': 'Database not available'}), 503
        
        # Get all approved publishers
        publishers = list(users_col.find(
            {'account_status': 'approved'},
            {'level': 1, 'previous_level': 1, 'level_updated_at': 1}
        ))
        
        # Count by level
        level_counts = {'L1': 0, 'L2': 0, 'L3': 0, 'L4': 0, 'L5': 0, 'L6': 0, 'L7': 0}
        level_changes = {'L1': [], 'L2': [], 'L3': [], 'L4': [], 'L5': [], 'L6': [], 'L7': []}
        
        from datetime import timedelta
        twenty_four_hours_ago = datetime.utcnow() - timedelta(hours=24)
        
        for pub in publishers:
            current_level = pub.get('level', 'L1')
            level_counts[current_level] = level_counts.get(current_level, 0) + 1
            
            # Check if level changed in last 24 hours
            level_updated_at = pub.get('level_updated_at')
            previous_level = pub.get('previous_level')
            
            if level_updated_at and level_updated_at >= twenty_four_hours_ago and previous_level:
                # Determine direction
                prev_num = int(previous_level.replace('L', ''))
                curr_num = int(current_level.replace('L', ''))
                direction = 'up' if curr_num > prev_num else 'down' if curr_num < prev_num else 'same'
                
                level_changes[current_level].append({
                    'from': previous_level,
                    'to': current_level,
                    'direction': direction,
                    'changed_at': level_updated_at.isoformat()
                })
        
        # Calculate change summary per level
        level_summary = []
        for level in ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7']:
            changes = level_changes[level]
            upgrades = len([c for c in changes if c['direction'] == 'up'])
            downgrades = len([c for c in changes if c['direction'] == 'down'])
            
            level_summary.append({
                'level': level,
                'count': level_counts[level],
                'recent_upgrades': upgrades,
                'recent_downgrades': downgrades,
                'net_change': upgrades - downgrades
            })
        
        return jsonify({
            'success': True,
            'distribution': level_summary,
            'total_publishers': len(publishers)
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting level distribution: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get level distribution: {str(e)}'}), 500
