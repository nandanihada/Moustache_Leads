"""
User Dashboard API Routes
Provides real-time statistics for user dashboard
- Total revenue from forwarded postbacks
- Total clicks from click tracking
- Total conversions from forwarded postbacks
- Active offers count
"""

from flask import Blueprint, request, jsonify
from utils.auth import token_required
from datetime import datetime, timedelta
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)

user_dashboard_bp = Blueprint('user_dashboard', __name__)

def get_collection(collection_name):
    """Get collection from database instance"""
    from database import db_instance
    if not db_instance.is_connected():
        logger.error("Database not connected")
        return None
    return db_instance.get_collection(collection_name)

@user_dashboard_bp.route('/dashboard/stats', methods=['GET'])
@token_required
def get_dashboard_stats():
    """
    Get dashboard statistics for current user
    Returns:
    - total_revenue: Sum of all points from forwarded postbacks where user is publisher
    - total_clicks: Count of clicks from user's placements
    - total_conversions: Count of conversions from forwarded postbacks
    - active_offers: Count of unique offers in user's placements
    - recent_activity: Last 5 conversion events
    """
    try:
        user = request.current_user
        user_id = str(user['_id'])
        username = user.get('username', 'Unknown')
        
        logger.info(f"📊 Getting dashboard stats for user: {username} ({user_id})")
        
        # Get collections
        forwarded_postbacks = get_collection('forwarded_postbacks')
        clicks_collection = get_collection('offerwall_clicks_detailed')
        placements_collection = get_collection('placements')
        offers_collection = get_collection('offers')
        
        # Check if any collection is None (MongoDB Collections don't support boolean testing)
        if (forwarded_postbacks is None or clicks_collection is None or 
            placements_collection is None or offers_collection is None):
            return jsonify({'error': 'Database collections not available'}), 503
        
        # 1. Calculate Total Revenue from forwarded postbacks
        # Sum all points where publisher_id matches current user
        revenue_pipeline = [
            {
                '$match': {
                    'publisher_id': user_id,
                    'forward_status': 'success'
                }
            },
            {
                '$group': {
                    '_id': None,
                    'total_revenue': {'$sum': '$points'},
                    'total_conversions': {'$sum': 1}
                }
            }
        ]
        
        revenue_result = list(forwarded_postbacks.aggregate(revenue_pipeline))
        total_revenue = revenue_result[0]['total_revenue'] if revenue_result else 0
        total_conversions = revenue_result[0]['total_conversions'] if revenue_result else 0
        
        logger.info(f"💰 Total revenue: {total_revenue}, Conversions: {total_conversions}")
        
        # 2. Calculate Total Clicks from user's placements
        # First get all user's placement IDs
        user_placements = list(placements_collection.find(
            {'created_by': username},
            {'_id': 1}
        ))
        placement_ids = [str(p['_id']) for p in user_placements]
        
        logger.info(f"🎯 User has {len(placement_ids)} placements")
        
        # Count clicks from these placements
        total_clicks = 0
        if placement_ids:
            # Try both string and ObjectId formats for placement_id
            clicks_query = {
                '$or': [
                    {'placement_id': {'$in': placement_ids}},
                    {'placement_id': {'$in': [ObjectId(pid) for pid in placement_ids if ObjectId.is_valid(pid)]}}
                ]
            }
            total_clicks = clicks_collection.count_documents(clicks_query)
        
        logger.info(f"👆 Total clicks: {total_clicks}")
        
        # 3. Get Active Offers Count
        # Count offers that are active and available
        active_offers_count = offers_collection.count_documents({
            'status': 'active',
            'is_active': True
        })
        
        logger.info(f"🎁 Active offers: {active_offers_count}")
        
        # 4. Get Recent Activity - Include all activity types like notification bar
        # Get additional collections for recent activity
        user_promo_codes_col = get_collection('user_promo_codes')
        promo_codes_col = get_collection('promo_codes')
        offer_requests_col = get_collection('offer_access_requests')
        
        # Try to convert user_id to ObjectId
        try:
            user_obj_id = ObjectId(user_id)
        except:
            user_obj_id = None
        
        all_activities = []
        
        # 4a. Promo codes applied by user
        if user_promo_codes_col is not None:
            user_promo_query = {'$or': [{'user_id': user_id}]}
            if user_obj_id:
                user_promo_query['$or'].append({'user_id': user_obj_id})
            
            applied_promos = list(user_promo_codes_col.find(user_promo_query).sort('applied_at', -1).limit(5))
            
            for applied in applied_promos:
                promo_code_id = applied.get('promo_code_id')
                promo_details = None
                if promo_codes_col is not None and promo_code_id:
                    try:
                        if isinstance(promo_code_id, str):
                            promo_details = promo_codes_col.find_one({'_id': ObjectId(promo_code_id)})
                        else:
                            promo_details = promo_codes_col.find_one({'_id': promo_code_id})
                    except:
                        pass
                
                code_name = applied.get('code', 'N/A')
                bonus_amount = promo_details.get('bonus_amount', 0) if promo_details else 0
                bonus_type = promo_details.get('bonus_type', 'percentage') if promo_details else 'percentage'
                bonus_text = f"+{bonus_amount}%" if bonus_type == 'percentage' else f"+${bonus_amount}"
                
                all_activities.append({
                    'id': str(applied['_id']),
                    'action': '🎉 Promo Code Applied',
                    'offer': f"Code: {code_name}",
                    'amount': bonus_text,
                    'time': _format_time_ago(applied.get('applied_at')),
                    'timestamp': applied.get('applied_at')
                })
        
        # 4b. Offer access approvals
        if offer_requests_col is not None:
            approved_query = {'$or': [{'publisher_id': user_id}, {'user_id': user_id}], 'status': 'approved'}
            if user_obj_id:
                approved_query['$or'].extend([{'publisher_id': user_obj_id}, {'user_id': user_obj_id}])
            
            approved_requests = list(offer_requests_col.find(approved_query).sort('updated_at', -1).limit(5))
            
            for req in approved_requests:
                offer_name = req.get('offer_details', {}).get('name', req.get('offer_name', req.get('offer_id', 'Unknown')))
                all_activities.append({
                    'id': str(req['_id']),
                    'action': '✅ Offer Approved',
                    'offer': offer_name,
                    'amount': 'Access Granted',
                    'time': _format_time_ago(req.get('updated_at') or req.get('requested_at')),
                    'timestamp': req.get('updated_at') or req.get('requested_at')
                })
        
        # 4c. Offer access rejections
        if offer_requests_col is not None:
            rejected_query = {'$or': [{'publisher_id': user_id}, {'user_id': user_id}], 'status': 'rejected'}
            if user_obj_id:
                rejected_query['$or'].extend([{'publisher_id': user_obj_id}, {'user_id': user_obj_id}])
            
            rejected_requests = list(offer_requests_col.find(rejected_query).sort('updated_at', -1).limit(5))
            
            for req in rejected_requests:
                offer_name = req.get('offer_details', {}).get('name', req.get('offer_name', req.get('offer_id', 'Unknown')))
                all_activities.append({
                    'id': str(req['_id']),
                    'action': '❌ Offer Denied',
                    'offer': offer_name,
                    'amount': 'Access Denied',
                    'time': _format_time_ago(req.get('updated_at') or req.get('requested_at')),
                    'timestamp': req.get('updated_at') or req.get('requested_at')
                })
        
        # 4d. Successful conversions/payments (from forwarded_postbacks - same as Conversion Report)
        if forwarded_postbacks is not None:
            conversion_query = {'publisher_id': user_id, 'forward_status': 'success'}
            
            successful_conversions = list(forwarded_postbacks.find(conversion_query).sort('timestamp', -1).limit(5))
            
            logger.info(f"📋 Found {len(successful_conversions)} successful conversions for user {user_id}")
            
            for conv in successful_conversions:
                points = conv.get('points', 0)
                offer_id = conv.get('offer_id', 'Unknown')
                
                # Get offer name from offers collection (same as Conversion Report)
                offer_name = 'Unknown Offer'
                if offers_collection is not None and offer_id:
                    offer = offers_collection.find_one({'offer_id': offer_id})
                    if offer:
                        offer_name = offer.get('name', 'Unknown Offer')
                
                all_activities.append({
                    'id': str(conv['_id']),
                    'action': '💰 Payment Received',
                    'offer': offer_name,
                    'amount': f"${points:.2f}",
                    'time': _format_time_ago(conv.get('timestamp')),
                    'timestamp': conv.get('timestamp')
                })
        
        # 4e. Reversals
        if forwarded_postbacks is not None:
            reversal_query = {
                'publisher_id': user_id,
                '$or': [
                    {'forward_status': 'reversed'},
                    {'status': 'reversed'},
                    {'is_reversal': True}
                ]
            }
            
            reversals = list(forwarded_postbacks.find(reversal_query).sort('timestamp', -1).limit(5))
            
            logger.info(f"📋 Found {len(reversals)} reversals for user {user_id}")
            
            for rev in reversals:
                points = rev.get('points', 0)
                offer_id = rev.get('offer_id', 'Unknown')
                
                # Get offer name from offers collection
                offer_name = 'Unknown Offer'
                if offers_collection is not None and offer_id:
                    offer = offers_collection.find_one({'offer_id': offer_id})
                    if offer:
                        offer_name = offer.get('name', 'Unknown Offer')
                
                all_activities.append({
                    'id': str(rev['_id']),
                    'action': '⚠️ Reversal',
                    'offer': offer_name,
                    'amount': f"-${points:.2f}",
                    'time': _format_time_ago(rev.get('timestamp')),
                    'timestamp': rev.get('timestamp')
                })
        
        # Sort all activities by timestamp (newest first) and take top 5
        all_activities.sort(key=lambda x: x.get('timestamp') or datetime.min, reverse=True)
        formatted_activity = all_activities[:5]
        
        # Remove timestamp from final output (not needed by frontend)
        for activity in formatted_activity:
            activity.pop('timestamp', None)
        
        logger.info(f"📋 Recent activity: {len(formatted_activity)} items")
        
        # 5. Calculate comparison with last period (for trend indicators)
        # Get stats from 30 days ago to compare
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        sixty_days_ago = datetime.utcnow() - timedelta(days=60)
        
        # Last 30 days revenue
        last_30_days_pipeline = [
            {
                '$match': {
                    'publisher_id': user_id,
                    'forward_status': 'success',
                    'timestamp': {'$gte': thirty_days_ago}
                }
            },
            {
                '$group': {
                    '_id': None,
                    'revenue': {'$sum': '$points'},
                    'conversions': {'$sum': 1}
                }
            }
        ]
        
        last_30_result = list(forwarded_postbacks.aggregate(last_30_days_pipeline))
        last_30_revenue = last_30_result[0]['revenue'] if last_30_result else 0
        last_30_conversions = last_30_result[0]['conversions'] if last_30_result else 0
        
        # Previous 30 days (30-60 days ago)
        prev_30_days_pipeline = [
            {
                '$match': {
                    'publisher_id': user_id,
                    'forward_status': 'success',
                    'timestamp': {'$gte': sixty_days_ago, '$lt': thirty_days_ago}
                }
            },
            {
                '$group': {
                    '_id': None,
                    'revenue': {'$sum': '$points'},
                    'conversions': {'$sum': 1}
                }
            }
        ]
        
        prev_30_result = list(forwarded_postbacks.aggregate(prev_30_days_pipeline))
        prev_30_revenue = prev_30_result[0]['revenue'] if prev_30_result else 0
        prev_30_conversions = prev_30_result[0]['conversions'] if prev_30_result else 0
        
        # Calculate percentage changes
        revenue_change = _calculate_percentage_change(prev_30_revenue, last_30_revenue)
        conversions_change = _calculate_percentage_change(prev_30_conversions, last_30_conversions)
        
        # Return dashboard stats
        return jsonify({
            'success': True,
            'stats': {
                'total_revenue': total_revenue,
                'total_clicks': total_clicks,
                'total_conversions': total_conversions,
                'active_offers': active_offers_count,
                'revenue_change': revenue_change,
                'conversions_change': conversions_change,
                'recent_activity': formatted_activity
            }
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error getting dashboard stats: {str(e)}", exc_info=True)
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

def _format_time_ago(timestamp):
    """Format timestamp as 'X minutes/hours/days ago'"""
    if not timestamp:
        return 'Unknown'
    
    try:
        now = datetime.utcnow()
        diff = now - timestamp
        
        seconds = diff.total_seconds()
        
        if seconds < 60:
            return 'Just now'
        elif seconds < 3600:
            minutes = int(seconds / 60)
            return f'{minutes} min ago' if minutes == 1 else f'{minutes} mins ago'
        elif seconds < 86400:
            hours = int(seconds / 3600)
            return f'{hours} hour ago' if hours == 1 else f'{hours} hours ago'
        else:
            days = int(seconds / 86400)
            return f'{days} day ago' if days == 1 else f'{days} days ago'
    except:
        return 'Unknown'

def _calculate_percentage_change(old_value, new_value):
    """Calculate percentage change between two values"""
    if old_value == 0:
        if new_value == 0:
            return {'percentage': 0, 'type': 'neutral'}
        else:
            return {'percentage': 100, 'type': 'positive'}
    
    change = ((new_value - old_value) / old_value) * 100
    
    return {
        'percentage': round(abs(change), 1),
        'type': 'positive' if change > 0 else 'negative' if change < 0 else 'neutral',
        'text': f'+{round(change, 1)}%' if change > 0 else f'{round(change, 1)}%'
    }


@user_dashboard_bp.route('/dashboard/notifications', methods=['GET'])
@token_required
def get_user_notifications():
    """
    Get user notifications for the notification bar
    Returns notifications grouped by type with limits:
    - placement_status: Placement approval/rejection notifications (priority)
    - promo_codes: Promo codes received/redeemed (limit 6)
    - offer_approvals: Offer access approved (limit 6)
    - offer_rejections: Offer access rejected (limit 6)
    - conversions: Successful conversions/payments (limit 6)
    - reversals: Conversion reversals (limit 6)
    
    NOTE: Only shows notifications if user has at least one approved placement
    """
    try:
        user = request.current_user
        user_id = str(user['_id'])
        username = user.get('username', '')
        user_email = user.get('email', '')
        
        logger.info(f"🔔 Getting notifications for user: {username} ({user_id})")
        
        notifications = []
        
        # Try to convert user_id to ObjectId for queries
        try:
            user_obj_id = ObjectId(user_id)
        except:
            user_obj_id = None
        
        # Get collections
        promo_codes_col = get_collection('promo_codes')
        user_promo_codes_col = get_collection('user_promo_codes')
        offer_requests_col = get_collection('offer_access_requests')
        forwarded_postbacks_col = get_collection('forwarded_postbacks')
        conversions_col = get_collection('offerwall_conversions')
        placements_col = get_collection('placements')
        
        # FIRST: Check if user has any placements and their status
        has_approved_placement = False
        placement_notifications = []
        
        if placements_col is not None:
            # Query for user's placements - check both field naming conventions
            placement_query = {'$or': [
                {'publisher_id': user_id}, 
                {'user_id': user_id},
                {'publisherId': user_id}
            ]}
            if user_obj_id:
                placement_query['$or'].extend([
                    {'publisher_id': user_obj_id}, 
                    {'user_id': user_obj_id},
                    {'publisherId': user_obj_id}
                ])
            
            user_placements = list(placements_col.find(placement_query).sort('createdAt', -1))
            
            logger.info(f"🔍 Found {len(user_placements)} placements for user {user_id}")
            
            for placement in user_placements:
                # Check both status field naming conventions (approvalStatus and status)
                approval_status = placement.get('approvalStatus', placement.get('status', 'PENDING_APPROVAL'))
                placement_name = placement.get('offerwallTitle', placement.get('name', placement.get('placement_name', 'Your Placement')))
                
                # Normalize status to uppercase for comparison
                approval_status_upper = approval_status.upper() if isinstance(approval_status, str) else 'PENDING_APPROVAL'
                
                if approval_status_upper == 'APPROVED' or approval_status_upper == 'LIVE':
                    has_approved_placement = True
                    placement_notifications.append({
                        'id': str(placement['_id']),
                        'type': 'placement_approved',
                        'icon': 'check-circle',
                        'title': 'Placement Approved',
                        'message': f"✅ Your placement '{placement_name}' has been approved! You now have full access.",
                        'timestamp': placement.get('approvedAt') or placement.get('approved_at') or placement.get('updatedAt') or placement.get('updated_at') or placement.get('createdAt') or placement.get('created_at'),
                        'color': 'green'
                    })
                elif approval_status_upper == 'REJECTED':
                    rejection_reason = placement.get('rejectionReason', placement.get('rejection_reason', 'Not specified'))
                    placement_notifications.append({
                        'id': str(placement['_id']),
                        'type': 'placement_rejected',
                        'icon': 'x-circle',
                        'title': 'Placement Rejected',
                        'message': f"❌ Your placement '{placement_name}' was rejected. Reason: {rejection_reason}",
                        'timestamp': placement.get('approvedAt') or placement.get('rejected_at') or placement.get('updatedAt') or placement.get('updated_at') or placement.get('createdAt') or placement.get('created_at'),
                        'color': 'red'
                    })
                elif approval_status_upper == 'PENDING_APPROVAL' or approval_status_upper == 'PENDING':
                    placement_notifications.append({
                        'id': str(placement['_id']),
                        'type': 'placement_pending',
                        'icon': 'bell',
                        'title': 'Placement Under Review',
                        'message': f"⏳ Your placement '{placement_name}' is being reviewed. We'll notify you once approved.",
                        'timestamp': placement.get('createdAt') or placement.get('created_at'),
                        'color': 'blue'
                    })
        
        # Add placement notifications first (they are priority)
        notifications.extend(placement_notifications[:3])  # Limit to 3 placement notifications
        
        # If user has NO approved placement, only show placement-related notifications
        # Don't show promo codes, offers, etc. until they have an approved placement
        if not has_approved_placement:
            logger.info(f"⚠️ User {username} has no approved placement - showing only placement notifications")
            
            # Sort and format
            for notif in notifications:
                notif['time_ago'] = _format_time_ago(notif.get('timestamp'))
                if notif.get('timestamp'):
                    notif['timestamp'] = notif['timestamp'].isoformat() if hasattr(notif['timestamp'], 'isoformat') else str(notif['timestamp'])
            
            return jsonify({
                'success': True,
                'notifications': notifications,
                'total': len(notifications),
                'has_approved_placement': False
            }), 200
        
        # User has approved placement - show all notifications
        
        # 1. PROMO CODES APPLIED BY USER (limit 6)
        if user_promo_codes_col is not None:
            user_promo_query = {'$or': [{'user_id': user_id}]}
            if user_obj_id:
                user_promo_query['$or'].append({'user_id': user_obj_id})
            
            applied_promos = list(user_promo_codes_col.find(user_promo_query).sort('applied_at', -1).limit(6))
            
            logger.info(f"🔍 Found {len(applied_promos)} applied promo codes for user {user_id}")
            
            for applied in applied_promos:
                promo_code_id = applied.get('promo_code_id')
                promo_details = None
                if promo_codes_col is not None and promo_code_id:
                    try:
                        if isinstance(promo_code_id, str):
                            promo_details = promo_codes_col.find_one({'_id': ObjectId(promo_code_id)})
                        else:
                            promo_details = promo_codes_col.find_one({'_id': promo_code_id})
                    except:
                        pass
                
                code_name = applied.get('code', 'N/A')
                bonus_amount = promo_details.get('bonus_amount', 0) if promo_details else 0
                bonus_type = promo_details.get('bonus_type', 'percentage') if promo_details else 'percentage'
                
                bonus_text = f"+{bonus_amount}%" if bonus_type == 'percentage' else f"+${bonus_amount}"
                
                notifications.append({
                    'id': str(applied['_id']),
                    'type': 'promo_code',
                    'icon': 'gift',
                    'title': 'Promo Code Applied',
                    'message': f"🎉 Congratulations! You applied promo code '{code_name}' with {bonus_text} bonus",
                    'timestamp': applied.get('applied_at'),
                    'color': 'green'
                })
        
        # Also check for promo codes available to all users (public codes) - only for users with approved placements
        if promo_codes_col is not None:
            public_promos = list(promo_codes_col.find({
                'status': 'active',
                '$or': [
                    {'applicable_offers': {'$size': 0}},
                    {'applicable_offers': {'$exists': False}}
                ]
            }).sort('created_at', -1).limit(3))  # Reduced limit to 3
            
            for promo in public_promos:
                bonus_type = promo.get('bonus_type', 'percentage')
                bonus_amount = promo.get('bonus_amount', 0)
                bonus_text = f"+{bonus_amount}%" if bonus_type == 'percentage' else f"+${bonus_amount}"
                
                notifications.append({
                    'id': str(promo['_id']),
                    'type': 'promo_code_received',
                    'icon': 'tag',
                    'title': 'Promo Code Available',
                    'message': f"🎁 Promo code '{promo.get('code', 'N/A')}' is available with {bonus_text} bonus!",
                    'timestamp': promo.get('created_at'),
                    'color': 'purple'
                })
        
        # 2. OFFER ACCESS APPROVALS (limit 6)
        if offer_requests_col is not None:
            approved_query = {
                '$or': [
                    {'publisher_id': user_id},
                    {'user_id': user_id}
                ],
                'status': 'approved'
            }
            if user_obj_id:
                approved_query['$or'].extend([
                    {'publisher_id': user_obj_id},
                    {'user_id': user_obj_id}
                ])
            
            approved_requests = list(offer_requests_col.find(approved_query).sort('updated_at', -1).limit(6))
            
            logger.info(f"🔍 Found {len(approved_requests)} approved offer requests for user {user_id}")
            
            for req in approved_requests:
                offer_name = req.get('offer_details', {}).get('name', req.get('offer_name', req.get('offer_id', 'Unknown Offer')))
                notifications.append({
                    'id': str(req['_id']),
                    'type': 'offer_approved',
                    'icon': 'check-circle',
                    'title': 'Offer Access Approved',
                    'message': f"✅ Your access request for '{offer_name}' has been approved!",
                    'timestamp': req.get('updated_at') or req.get('requested_at'),
                    'color': 'green'
                })
        
        # 3. OFFER ACCESS REJECTIONS (limit 6)
        if offer_requests_col is not None:
            rejected_query = {
                '$or': [
                    {'publisher_id': user_id},
                    {'user_id': user_id}
                ],
                'status': 'rejected'
            }
            if user_obj_id:
                rejected_query['$or'].extend([
                    {'publisher_id': user_obj_id},
                    {'user_id': user_obj_id}
                ])
            
            rejected_requests = list(offer_requests_col.find(rejected_query).sort('updated_at', -1).limit(6))
            
            logger.info(f"🔍 Found {len(rejected_requests)} rejected offer requests for user {user_id}")
            
            for req in rejected_requests:
                offer_name = req.get('offer_details', {}).get('name', req.get('offer_name', req.get('offer_id', 'Unknown Offer')))
                notifications.append({
                    'id': str(req['_id']),
                    'type': 'offer_rejected',
                    'icon': 'x-circle',
                    'title': 'Offer Access Denied',
                    'message': f"❌ Your access request for '{offer_name}' was denied. Reason: {req.get('rejection_reason', 'Not specified')}",
                    'timestamp': req.get('updated_at') or req.get('requested_at'),
                    'color': 'red'
                })
        
        # 4. SUCCESSFUL CONVERSIONS / PAYMENTS (limit 6)
        if forwarded_postbacks_col is not None:
            conversion_query = {
                '$or': [
                    {'publisher_id': user_id}
                ],
                'forward_status': 'success'
            }
            if user_obj_id:
                conversion_query['$or'].append({'publisher_id': str(user_obj_id)})
            
            successful_conversions = list(forwarded_postbacks_col.find(conversion_query).sort('timestamp', -1).limit(6))
            
            logger.info(f"🔍 Found {len(successful_conversions)} successful conversions for user {user_id}")
            
            for conv in successful_conversions:
                points = conv.get('points', 0)
                offer_id = conv.get('offer_id', 'Unknown')
                offer_name = conv.get('offer_name', offer_id)
                notifications.append({
                    'id': str(conv['_id']),
                    'type': 'conversion',
                    'icon': 'dollar-sign',
                    'title': 'Payment Processed',
                    'message': f"💰 You earned ${points:.2f} from offer '{offer_name}'",
                    'timestamp': conv.get('timestamp'),
                    'color': 'green'
                })
        
        # 5. CONVERSION REVERSALS (limit 6)
        if forwarded_postbacks_col is not None:
            reversal_query = {
                '$or': [
                    {'publisher_id': user_id}
                ],
                '$or': [
                    {'forward_status': 'reversed'},
                    {'status': 'reversed'},
                    {'is_reversal': True}
                ]
            }
            # Build proper query with both user_id formats
            reversal_query = {
                '$and': [
                    {'$or': [{'publisher_id': user_id}]},
                    {'$or': [
                        {'forward_status': 'reversed'},
                        {'status': 'reversed'},
                        {'is_reversal': True}
                    ]}
                ]
            }
            if user_obj_id:
                reversal_query['$and'][0]['$or'].append({'publisher_id': str(user_obj_id)})
            
            reversals = list(forwarded_postbacks_col.find(reversal_query).sort('timestamp', -1).limit(6))
            
            logger.info(f"🔍 Found {len(reversals)} reversals for user {user_id}")
            
            for rev in reversals:
                points = rev.get('points', 0)
                offer_id = rev.get('offer_id', 'Unknown')
                offer_name = rev.get('offer_name', offer_id)
                notifications.append({
                    'id': str(rev['_id']),
                    'type': 'reversal',
                    'icon': 'alert-triangle',
                    'title': 'Conversion Reversed',
                    'message': f"⚠️ A conversion of ${points:.2f} from offer '{offer_name}' was reversed",
                    'timestamp': rev.get('timestamp'),
                    'color': 'orange'
                })
        
        # Also check offerwall_conversions for reversals
        if conversions_col is not None:
            offerwall_reversal_query = {
                '$or': [
                    {'user_id': user_id}
                ],
                'status': 'reversed'
            }
            if user_obj_id:
                offerwall_reversal_query['$or'].append({'user_id': user_obj_id})
            
            offerwall_reversals = list(conversions_col.find(offerwall_reversal_query).sort('timestamp', -1).limit(6))
            
            logger.info(f"🔍 Found {len(offerwall_reversals)} offerwall reversals for user {user_id}")
            
            for rev in offerwall_reversals:
                payout = rev.get('payout_amount', 0)
                offer_name = rev.get('data', {}).get('offer_name', 'Unknown')
                notifications.append({
                    'id': str(rev['_id']),
                    'type': 'reversal',
                    'icon': 'alert-triangle',
                    'title': 'Conversion Reversed',
                    'message': f"⚠️ A conversion of ${payout:.2f} from '{offer_name}' was reversed",
                    'timestamp': rev.get('timestamp'),
                    'color': 'orange'
                })
        
        # Sort all notifications by timestamp (newest first)
        notifications.sort(key=lambda x: x.get('timestamp') or datetime.min, reverse=True)
        
        # Format timestamps for display
        for notif in notifications:
            notif['time_ago'] = _format_time_ago(notif.get('timestamp'))
            if notif.get('timestamp'):
                notif['timestamp'] = notif['timestamp'].isoformat()
        
        # Limit total notifications to 20 for the bar
        notifications = notifications[:20]
        
        logger.info(f"🔔 Returning {len(notifications)} notifications for user {username}")
        
        return jsonify({
            'success': True,
            'notifications': notifications,
            'total': len(notifications),
            'has_approved_placement': has_approved_placement
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error getting notifications: {str(e)}", exc_info=True)
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        return jsonify({'error': f'Failed to get notifications: {str(e)}'}), 500


@user_dashboard_bp.route('/dashboard/notifications/mark-read', methods=['POST'])
@token_required
def mark_notifications_read():
    """Mark notifications as read"""
    try:
        user = request.current_user
        user_id = str(user['_id'])
        
        data = request.get_json() or {}
        notification_ids = data.get('notification_ids', [])
        
        # For now, we just acknowledge the request
        # In a full implementation, you'd store read status in a separate collection
        
        logger.info(f"📖 Marked {len(notification_ids)} notifications as read for user {user_id}")
        
        return jsonify({
            'success': True,
            'message': f'Marked {len(notification_ids)} notifications as read'
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error marking notifications read: {str(e)}")
        return jsonify({'error': str(e)}), 500
