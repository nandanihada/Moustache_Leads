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
import time as _time

logger = logging.getLogger(__name__)

user_dashboard_bp = Blueprint('user_dashboard', __name__)

# Per-user dashboard cache (60 second TTL)
_dashboard_cache = {}  # user_id -> {'stats': data, 'chart': data, 'top_offers': data, 'expires': timestamp}
_DASHBOARD_CACHE_TTL = 60  # seconds

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
    Get dashboard statistics for current user (cached for 60 seconds)
    """
    try:
        user = request.current_user
        user_id = str(user['_id'])
        username = user.get('username', 'Unknown')
        
        # Check cache
        cached = _dashboard_cache.get(user_id)
        if cached and cached.get('stats') and _time.time() < cached.get('stats_expires', 0):
            return jsonify(cached['stats']), 200
        
        logger.debug(f"📊 Getting dashboard stats for user: {username} ({user_id})")
        
        # Get collections
        forwarded_postbacks = get_collection('forwarded_postbacks')
        clicks_collection = get_collection('offerwall_clicks_detailed')
        placements_collection = get_collection('placements')
        offers_collection = get_collection('offers')
        
        # Check if any collection is None (MongoDB Collections don't support boolean testing)
        if (forwarded_postbacks is None or clicks_collection is None or 
            placements_collection is None or offers_collection is None):
            return jsonify({'error': 'Database collections not available'}), 503
        
        from routes.user_payments import calculate_user_earnings
        
        earnings_data = calculate_user_earnings(user_id)
        total_revenue = earnings_data['total_balance']
        total_conversions = earnings_data['conversion_earnings'] / 10 if earnings_data['conversion_earnings'] > 0 else 0
        # If we need exact conversion counts we keep the aggregate
        try:
            total_conv_count = list(forwarded_postbacks.aggregate([
                {'$match': {'publisher_id': user_id, 'forward_status': {'$nin': ['reversed']}, 'is_reversal': {'$ne': True}}},
                {'$group': {'_id': None, 'total': {'$sum': 1}}}
            ]))
            total_conversions = total_conv_count[0]['total'] if total_conv_count else 0
        except:
            total_conversions = 0
        
        logger.debug(f"💰 Total revenue: {total_revenue}, Conversions: {total_conversions}")
        
        # 2. Calculate Total Clicks from user's placements AND dashboard clicks
        # First get all user's placement IDs
        user_placements = list(placements_collection.find(
            {'created_by': username},
            {'_id': 1}
        ))
        placement_ids = [str(p['_id']) for p in user_placements]
        
        logger.debug(f"🎯 User has {len(placement_ids)} placements")
        
        # Count clicks from offerwall (placement-based clicks)
        offerwall_clicks = 0
        if placement_ids:
            # Try both string and ObjectId formats for placement_id
            clicks_query = {
                '$or': [
                    {'placement_id': {'$in': placement_ids}},
                    {'placement_id': {'$in': [ObjectId(pid) for pid in placement_ids if ObjectId.is_valid(pid)]}}
                ]
            }
            offerwall_clicks = clicks_collection.count_documents(clicks_query)
        
        # Count clicks from dashboard/offers page
        dashboard_clicks_col = get_collection('dashboard_clicks')
        dashboard_clicks = 0
        if dashboard_clicks_col is not None:
            # Count clicks where user_id matches current user
            dashboard_clicks_query = {
                '$or': [
                    {'user_id': user_id},
                    {'user_id': str(user_id)}
                ]
            }
            dashboard_clicks = dashboard_clicks_col.count_documents(dashboard_clicks_query)
            
        # Count clicks from simple tracking links (clicks collection)
        simple_clicks_col = get_collection('clicks')
        simple_clicks = 0
        if simple_clicks_col is not None:
            simple_clicks_query = {
                '$or': [
                    {'user_id': user_id},
                    {'user_id': str(user_id)}
                ]
            }
            simple_clicks = simple_clicks_col.count_documents(simple_clicks_query)
        
        # Total clicks = offerwall clicks + dashboard clicks + simple clicks
        total_clicks = offerwall_clicks + dashboard_clicks + simple_clicks
        
        logger.debug(f"👆 Total clicks: {total_clicks} (offerwall: {offerwall_clicks}, dashboard: {dashboard_clicks}, simple: {simple_clicks})")
        
        # 3. Get Active Offers Count - Count all offers with status='active'
        active_offers_count = 0
        if offers_collection is not None:
            # Count all active offers (simplified - only check status)
            active_offers_count = offers_collection.count_documents({
                'status': 'active'
            })
        
        logger.debug(f"🎁 Total active offers in system: {active_offers_count}")
        
        # 4. Get Recent Activity - Only show offer-related activities
        # Get collections for recent activity
        offer_requests_col = get_collection('affiliate_requests')
        
        # Try to convert user_id to ObjectId
        try:
            user_obj_id = ObjectId(user_id)
        except:
            user_obj_id = None
        
        all_activities = []
        
        # 4a. Offer access requests (pending) - shows user requested access
        if offer_requests_col is not None:
            pending_query = {'$or': [{'publisher_id': user_id}, {'user_id': user_id}], 'status': 'pending'}
            if user_obj_id:
                pending_query['$or'].extend([{'publisher_id': user_obj_id}, {'user_id': user_obj_id}])
            
            pending_requests = list(offer_requests_col.find(pending_query).sort('requested_at', -1).limit(5))
            
            for req in pending_requests:
                offer_name = req.get('offer_details', {}).get('name', req.get('offer_name', req.get('offer_id', 'Unknown')))
                all_activities.append({
                    'id': str(req['_id']),
                    'action': '⏳ Offer Request Pending',
                    'offer': offer_name,
                    'amount': 'Awaiting Review',
                    'time': _format_time_ago(req.get('requested_at')),
                    'timestamp': req.get('requested_at')
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
        
        # Sort all activities by timestamp (newest first) and take top 5
        all_activities.sort(key=lambda x: x.get('timestamp') or datetime.min, reverse=True)
        formatted_activity = all_activities[:5]
        
        # Remove timestamp from final output (not needed by frontend)
        for activity in formatted_activity:
            activity.pop('timestamp', None)
        
        logger.debug(f"📋 Recent activity: {len(formatted_activity)} items")
        
        # 5. Calculate comparison with last period (for trend indicators)
        # Get stats from 30 days ago to compare
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        sixty_days_ago = datetime.utcnow() - timedelta(days=60)
        
        # Last 30 days revenue
        last_30_days_pipeline = [
            {
                '$match': {
                    'publisher_id': user_id,
                    'forward_status': {'$nin': ['reversed']},
                    'is_reversal': {'$ne': True},
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
                    'forward_status': {'$nin': ['reversed']},
                    'is_reversal': {'$ne': True},
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
        
        # Return dashboard stats (and cache for 60 seconds)
        result = {
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
        }
        
        # Cache the result
        if user_id not in _dashboard_cache:
            _dashboard_cache[user_id] = {}
        _dashboard_cache[user_id]['stats'] = result
        _dashboard_cache[user_id]['stats_expires'] = _time.time() + _DASHBOARD_CACHE_TTL
        
        return jsonify(result), 200
        
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
        
        logger.debug(f"🔔 Getting notifications for user: {username} ({user_id})")
        
        notifications = []
        
        # Try to convert user_id to ObjectId for queries
        try:
            user_obj_id = ObjectId(user_id)
        except:
            user_obj_id = None
        
        # Get collections
        promo_codes_col = get_collection('promo_codes')
        user_promo_codes_col = get_collection('user_promo_codes')
        offer_requests_col = get_collection('affiliate_requests')
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
            
            logger.debug(f"🔍 Found {len(user_placements)} placements for user {user_id}")
            
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
            logger.debug(f"⚠️ User {username} has no approved placement - showing only placement notifications")
            
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
            
            logger.debug(f"🔍 Found {len(applied_promos)} applied promo codes for user {user_id}")
            
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
        
        # Also check for promo codes available to this user (respects user targeting)
        if promo_codes_col is not None:
            public_promos = list(promo_codes_col.find({
                'status': 'active',
                '$or': [
                    {'applicable_offers': {'$size': 0}},
                    {'applicable_offers': {'$exists': False}}
                ]
            }).sort('created_at', -1).limit(10))
            
            for promo in public_promos:
                # Check user targeting — skip codes not meant for this user
                send_to_all = promo.get('send_to_all', True)
                if not send_to_all:
                    target_ids = [str(uid) for uid in promo.get('user_ids', [])]
                    if user_id not in target_ids:
                        continue
                
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
        
        # 1b. GIFT CARD NOTIFICATIONS (limit 6)
        gift_cards_col = get_collection('gift_cards')
        gift_card_redemptions_col = get_collection('gift_card_redemptions')
        
        if gift_cards_col is not None:
            # Show active gift cards available to the user
            active_gc_query = {
                'status': 'active',
                'expiry_date': {'$gte': datetime.utcnow()}
            }
            active_gift_cards = list(gift_cards_col.find(active_gc_query).sort('created_at', -1).limit(6))
            
            for gc in active_gift_cards:
                # Check if user already redeemed
                redeemed_by = gc.get('redeemed_by', [])
                already_redeemed = user_obj_id in redeemed_by if user_obj_id else False
                
                # Check if targeted to specific users
                gc_user_ids = gc.get('user_ids', [])
                send_to_all = gc.get('send_to_all', True)
                
                # If targeted to specific users, check if current user is in the list
                if not send_to_all and gc_user_ids:
                    user_in_list = user_id in [str(uid) for uid in gc_user_ids]
                    if user_obj_id:
                        user_in_list = user_in_list or user_obj_id in gc_user_ids
                    if not user_in_list:
                        continue
                
                # Check if user is excluded
                excluded = gc.get('excluded_users', [])
                if user_obj_id and user_obj_id in excluded:
                    continue
                
                if not already_redeemed:
                    remaining = max(0, gc.get('max_redemptions', 0) - gc.get('redemption_count', 0))
                    notifications.append({
                        'id': f"gc_{str(gc['_id'])}",
                        'type': 'gift_card_available',
                        'icon': 'gift',
                        'title': '🎁 Gift Card Available!',
                        'message': f"Gift card '{gc.get('name', 'Gift Card')}' worth ${gc.get('amount', 0):.2f} — Code: {gc.get('code', 'N/A')} — {remaining} spots left. Redeem now!",
                        'timestamp': gc.get('created_at'),
                        'color': 'purple'
                    })
                else:
                    notifications.append({
                        'id': f"gc_redeemed_{str(gc['_id'])}",
                        'type': 'gift_card_redeemed',
                        'icon': 'gift',
                        'title': 'Gift Card Redeemed',
                        'message': f"✅ You redeemed '{gc.get('name', 'Gift Card')}' worth ${gc.get('amount', 0):.2f}",
                        'timestamp': gc.get('created_at'),
                        'color': 'green'
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
            
            logger.debug(f"🔍 Found {len(approved_requests)} approved offer requests for user {user_id}")
            
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
            
            logger.debug(f"🔍 Found {len(rejected_requests)} rejected offer requests for user {user_id}")
            
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
                'forward_status': {'$nin': ['reversed']},
                'is_reversal': {'$ne': True}
            }
            if user_obj_id:
                conversion_query['$or'].append({'publisher_id': str(user_obj_id)})
            
            successful_conversions = list(forwarded_postbacks_col.find(conversion_query).sort('timestamp', -1).limit(6))
            
            logger.debug(f"🔍 Found {len(successful_conversions)} successful conversions for user {user_id}")
            
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
            
            logger.debug(f"🔍 Found {len(reversals)} reversals for user {user_id}")
            
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

            # 6. CUSTOM NOTIFICATIONS (from admin send-offers, etc.)
            custom_notif_col = get_collection('notifications')
            if custom_notif_col is not None:
                custom_query = {'user_id': user_id, 'read': False}
                custom_notifs = list(custom_notif_col.find(custom_query).sort('created_at', -1).limit(6))
                for cn in custom_notifs:
                    notifications.append({
                        'id': str(cn['_id']),
                        'type': cn.get('type', 'notification'),
                        'icon': 'bell',
                        'title': cn.get('title', 'Notification'),
                        'message': cn.get('message', ''),
                        'timestamp': cn.get('created_at'),
                        'color': 'blue'
                    })

            offerwall_reversal_query = {
                '$or': [
                    {'user_id': user_id}
                ],
                'status': 'reversed'
            }
            if user_obj_id:
                offerwall_reversal_query['$or'].append({'user_id': user_obj_id})
            
            offerwall_reversals = list(conversions_col.find(offerwall_reversal_query).sort('timestamp', -1).limit(6))
            
            logger.debug(f"🔍 Found {len(offerwall_reversals)} offerwall reversals for user {user_id}")
            
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
        
        logger.debug(f"🔔 Returning {len(notifications)} notifications for user {username}")
        
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
        
        logger.debug(f"📖 Marked {len(notification_ids)} notifications as read for user {user_id}")
        
        return jsonify({
            'success': True,
            'message': f'Marked {len(notification_ids)} notifications as read'
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error marking notifications read: {str(e)}")
        return jsonify({'error': str(e)}), 500


@user_dashboard_bp.route('/dashboard/chart-data', methods=['GET'])
@token_required
def get_chart_data():
    """
    Get performance chart data for the last 6 months
    Returns monthly aggregated clicks, conversions, and revenue
    """
    try:
        user = request.current_user
        user_id = str(user['_id'])
        username = user.get('username', 'Unknown')
        
        logger.debug(f"📊 Getting chart data for user: {username} ({user_id})")
        
        # Get collections
        forwarded_postbacks = get_collection('forwarded_postbacks')
        clicks_collection = get_collection('offerwall_clicks_detailed')
        placements_collection = get_collection('placements')
        
        if forwarded_postbacks is None or clicks_collection is None or placements_collection is None:
            return jsonify({'error': 'Database collections not available'}), 503
        
        # Get user's placement IDs
        user_placements = list(placements_collection.find(
            {'created_by': username},
            {'_id': 1}
        ))
        placement_ids = [str(p['_id']) for p in user_placements]
        
        # Generate last 6 months
        chart_data = []
        now = datetime.utcnow()
        
        for i in range(5, -1, -1):  # 5 months ago to current month
            # Calculate month boundaries
            if i == 0:
                month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                month_end = now
            else:
                # Go back i months
                year = now.year
                month = now.month - i
                while month <= 0:
                    month += 12
                    year -= 1
                month_start = datetime(year, month, 1)
                # Get end of month
                if month == 12:
                    month_end = datetime(year + 1, 1, 1)
                else:
                    month_end = datetime(year, month + 1, 1)
            
            month_name = month_start.strftime('%b')
            
            # Get conversions and revenue for this month
            revenue_pipeline = [
                {
                    '$match': {
                        'publisher_id': user_id,
                        'forward_status': {'$nin': ['reversed']},
                        'is_reversal': {'$ne': True},
                        'timestamp': {'$gte': month_start, '$lt': month_end}
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
            
            revenue_result = list(forwarded_postbacks.aggregate(revenue_pipeline))
            month_revenue = revenue_result[0]['revenue'] if revenue_result else 0
            month_conversions = revenue_result[0]['conversions'] if revenue_result else 0
            
            # Get clicks for this month (offerwall + dashboard)
            month_clicks = 0
            if placement_ids:
                clicks_query = {
                    '$or': [
                        {'placement_id': {'$in': placement_ids}},
                        {'placement_id': {'$in': [ObjectId(pid) for pid in placement_ids if ObjectId.is_valid(pid)]}}
                    ],
                    'timestamp': {'$gte': month_start, '$lt': month_end}
                }
                month_clicks = clicks_collection.count_documents(clicks_query)
            
            # Also count dashboard clicks for this month
            dashboard_clicks_col = get_collection('dashboard_clicks')
            if dashboard_clicks_col is not None:
                dashboard_clicks_query = {
                    '$or': [
                        {'user_id': user_id},
                        {'user_id': str(user_id)}
                    ],
                    'timestamp': {'$gte': month_start, '$lt': month_end}
                }
                month_clicks += dashboard_clicks_col.count_documents(dashboard_clicks_query)
                
            # Also count simple clicks for this month
            simple_clicks_col = get_collection('clicks')
            if simple_clicks_col is not None:
                simple_clicks_query = {
                    '$or': [
                        {'user_id': user_id},
                        {'user_id': str(user_id)}
                    ],
                    'timestamp': {'$gte': month_start, '$lt': month_end}
                }
                month_clicks += simple_clicks_col.count_documents(simple_clicks_query)
            
            chart_data.append({
                'name': month_name,
                'clicks': month_clicks,
                'conversions': month_conversions,
                'revenue': round(month_revenue, 2)
            })
        
        logger.debug(f"📈 Chart data generated: {len(chart_data)} months")
        
        return jsonify({
            'success': True,
            'chart_data': chart_data
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error getting chart data: {str(e)}", exc_info=True)
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500


@user_dashboard_bp.route('/dashboard/top-offers', methods=['GET'])
@token_required
def get_top_offers():
    """
    Get top curated offers based on Admin Top Offers configuration
    and overlay user click/conversion performance stats.
    """
    try:
        user = request.current_user
        user_id = str(user['_id'])
        username = user.get('username', 'Unknown')
        
        logger.debug(f"🏆 Getting top offers for user: {username} ({user_id})")
        
        # Get database collections
        settings_col = get_collection('top_offers_settings')
        top_offers_col = get_collection('top_offers')
        offers_col = get_collection('offers')
        clicks_col = get_collection('offerwall_clicks_detailed')
        dashboard_clicks_col = get_collection('dashboard_clicks')
        forwarded_postbacks = get_collection('forwarded_postbacks')
        
        if offers_col is None:
            return jsonify({'error': 'Database collections not available'}), 503
            
        # 1. Load admin top offers settings
        settings = {
            'mode': 'hybrid',
            'auto_criteria': 'conversions'
        }
        if settings_col is not None:
            doc = settings_col.find_one({'key': 'config'})
            if doc:
                settings['mode'] = doc.get('mode', 'hybrid')
                settings['auto_criteria'] = doc.get('auto_criteria', 'conversions')
                
        mode = settings.get('mode', 'hybrid')
        auto_criteria = settings.get('auto_criteria', 'conversions')
        
        # 2. Get manual curated offers
        manual_offers = []
        curated_ids = []
        if top_offers_col is not None and mode in ['manual', 'hybrid']:
            curated_docs = list(top_offers_col.find().sort('position', 1))
            curated_ids = [d['offer_id'] for d in curated_docs]
            if curated_ids:
                # Fetch active offers only
                active_manual_offers = {
                    o['offer_id']: o for o in offers_col.find({
                        'offer_id': {'$in': curated_ids},
                        'status': 'active',
                        '$or': [{'deleted': {'$exists': False}}, {'deleted': False}]
                    })
                }
                # Maintain the custom position order
                for d in curated_docs:
                    oid = d['offer_id']
                    if oid in active_manual_offers:
                        offer_info = dict(active_manual_offers[oid])
                        offer_info['is_pinned'] = True
                        offer_info['pinned_position'] = d['position']
                        manual_offers.append(offer_info)
                        
        manual_offers = manual_offers[:20]
        
        # 3. Resolve auto offers if needed
        resolved_offers = []
        if mode == 'manual' or len(manual_offers) >= 20:
            resolved_offers = manual_offers[:20]
        else:
            needed_count = 20 - len(manual_offers)
            auto_offers = []
            exclude_ids = [o['offer_id'] for o in manual_offers]
            
            # Find active offers not in manual list
            query = {
                'status': 'active',
                '$or': [{'deleted': {'$exists': False}}, {'deleted': False}],
                'offer_id': {'$nin': exclude_ids}
            }
            
            if auto_criteria == 'clicks':
                candidates = list(offers_col.find(query).sort('hits', -1).limit(needed_count))
            elif auto_criteria == 'requests':
                requests_col = get_collection('affiliate_requests')
                if requests_col is not None:
                    pipeline = [
                        {'$group': {'_id': '$offer_id', 'count': {'$sum': 1}}},
                        {'$sort': {'count': -1}}
                    ]
                    req_counts = {str(r['_id']): r['count'] for r in requests_col.aggregate(pipeline) if r['_id']}
                    
                    all_candidates = list(offers_col.find(query))
                    all_candidates.sort(key=lambda o: req_counts.get(o['offer_id'], 0), reverse=True)
                    candidates = all_candidates[:needed_count]
                else:
                    candidates = list(offers_col.find(query).sort('created_at', -1).limit(needed_count))
            else:  # conversions
                postbacks_col = get_collection('forwarded_postbacks')
                if postbacks_col is not None:
                    pipeline = [
                        {'$match': {'forward_status': {'$nin': ['reversed']}, 'is_reversal': {'$ne': True}}},
                        {'$group': {'_id': '$offer_id', 'count': {'$sum': 1}}},
                        {'$sort': {'count': -1}}
                    ]
                    conv_counts = {str(c['_id']): c['count'] for c in postbacks_col.aggregate(pipeline) if c['_id']}
                    
                    all_candidates = list(offers_col.find(query))
                    all_candidates.sort(key=lambda o: conv_counts.get(o['offer_id'], 0), reverse=True)
                    candidates = all_candidates[:needed_count]
                else:
                    candidates = list(offers_col.find(query).sort('created_at', -1).limit(needed_count))
                    
            for o in candidates:
                offer_info = dict(o)
                offer_info['is_pinned'] = False
                auto_offers.append(offer_info)
                
            if mode == 'auto':
                resolved_offers = auto_offers[:20]
            else:
                resolved_offers = (manual_offers + auto_offers)[:20]

        # 4. Gather clicks/conversions/revenue stats for resolved offers
        top_offers = []
        for idx, offer in enumerate(resolved_offers):
            offer_id = offer.get('offer_id')
            
            # Count conversions for current user
            conversions = 0
            revenue = 0.0
            if forwarded_postbacks is not None and offer_id:
                conv_doc = forwarded_postbacks.aggregate([
                    {
                        '$match': {
                            'publisher_id': user_id,
                            'offer_id': offer_id,
                            'forward_status': {'$nin': ['reversed']},
                            'is_reversal': {'$ne': True}
                        }
                    },
                    {
                        '$group': {
                            '_id': None,
                            'revenue': {'$sum': '$points'},
                            'conversions': {'$sum': 1}
                        }
                    }
                ])
                conv_results = list(conv_doc)
                if conv_results:
                    conversions = conv_results[0].get('conversions', 0)
                    revenue = conv_results[0].get('revenue', 0.0)

            # Count clicks
            offerwall_clicks = 0
            if clicks_col is not None and offer_id:
                clicks_query = {
                    '$or': [
                        {'offer_id': offer_id},
                        {'offer_id': str(offer_id)}
                    ]
                }
                offerwall_clicks = clicks_col.count_documents(clicks_query)
                
            dashboard_clicks = 0
            if dashboard_clicks_col is not None and offer_id:
                dashboard_clicks_query = {
                    '$and': [
                        {'$or': [
                            {'user_id': user_id},
                            {'user_id': str(user_id)}
                        ]},
                        {'$or': [
                            {'offer_id': offer_id},
                            {'offer_id': str(offer_id)}
                        ]}
                    ]
                }
                dashboard_clicks = dashboard_clicks_col.count_documents(dashboard_clicks_query)
                
            simple_clicks = 0
            simple_clicks_col = get_collection('clicks')
            if simple_clicks_col is not None and offer_id:
                simple_clicks_query = {
                    '$and': [
                        {'$or': [
                            {'user_id': user_id},
                            {'user_id': str(user_id)}
                        ]},
                        {'$or': [
                            {'offer_id': offer_id},
                            {'offer_id': str(offer_id)}
                        ]}
                    ]
                }
                simple_clicks = simple_clicks_col.count_documents(simple_clicks_query)
                
            clicks = offerwall_clicks + dashboard_clicks + simple_clicks
            conv_rate = (conversions / clicks * 100) if clicks > 0 else 0.0
            
            # Format and append matching all required table fields + extra details
            top_offers.append({
                'id': idx + 1,
                'offer_id': offer_id,
                'name': offer.get('name', 'Unknown Offer'),
                'description': offer.get('description', ''),
                'payout': offer.get('payout', 0.0),
                'category': offer.get('category', 'OTHER'),
                'vertical': offer.get('vertical', 'OTHER'),
                'image_url': offer.get('image_url', ''),
                'is_pinned': offer.get('is_pinned', False),
                'clicks': clicks,
                'conversions': conversions,
                'revenue': f"${revenue:.2f}",
                'conversionRate': f"{conv_rate:.1f}%"
            })
            
        logger.debug(f"🏆 Pinned/Top offers generated: {len(top_offers)} offers")
        
        return jsonify({
            'success': True,
            'top_offers': top_offers
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error getting top offers: {str(e)}", exc_info=True)
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

