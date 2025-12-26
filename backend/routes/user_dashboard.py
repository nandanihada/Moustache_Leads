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
        
        # 4. Get Recent Activity (last 5 conversions)
        recent_activity = list(forwarded_postbacks.find(
            {
                'publisher_id': user_id,
                'forward_status': 'success'
            },
            {
                'timestamp': 1,
                'username': 1,
                'points': 1,
                'offer_id': 1,
                'placement_title': 1
            }
        ).sort('timestamp', -1).limit(5))
        
        # Format recent activity for frontend
        formatted_activity = []
        for activity in recent_activity:
            formatted_activity.append({
                'id': str(activity['_id']),
                'action': 'New conversion',
                'offer': activity.get('offer_id', 'Unknown Offer'),
                'amount': f"${activity.get('points', 0):.2f}",
                'time': _format_time_ago(activity.get('timestamp'))
            })
        
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
