"""
Admin Dashboard Overview API
Provides real-time statistics for admin dashboard overview boxes
All data is calculated from actual database records - NO FAKE DATA
"""

from flask import Blueprint, request, jsonify
from utils.auth import token_required
from datetime import datetime, timedelta
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)

admin_overview_bp = Blueprint('admin_overview', __name__)

def get_collection(collection_name):
    """Get collection from database instance"""
    from database import db_instance
    if not db_instance.is_connected():
        logger.error("Database not connected")
        return None
    return db_instance.get_collection(collection_name)


def get_24h_window():
    """Get rolling 24-hour window timestamps"""
    now = datetime.utcnow()
    return now - timedelta(hours=24), now


def get_7d_window():
    """Get rolling 7-day window timestamps"""
    now = datetime.utcnow()
    return now - timedelta(days=7), now


# ============================================================================
# BOX 1: ERROR SUMMARY (Admin Only)
# ============================================================================
def get_error_summary():
    """Get error counts for last 24h and 7 days"""
    try:
        error_logs = get_collection('error_logs')
        system_events = get_collection('system_events')
        postback_logs = get_collection('postback_logs')
        forwarded_postbacks = get_collection('forwarded_postbacks')
        
        start_24h, now = get_24h_window()
        start_7d, _ = get_7d_window()
        
        errors = {
            'api_failures_24h': 0,
            'api_failures_7d': 0,
            'offer_import_failures_24h': 0,
            'offer_import_failures_7d': 0,
            'category_mismatches_24h': 0,
            'category_mismatches_7d': 0,
            'server_errors_24h': 0,
            'server_errors_7d': 0,
            'cors_issues_24h': 0,
            'cors_issues_7d': 0,
            'incoming_postback_failures_24h': 0,
            'incoming_postback_failures_7d': 0,
            'outgoing_postback_failures_24h': 0,
            'outgoing_postback_failures_7d': 0,
        }
        
        # Count from error_logs collection
        if error_logs is not None:
            # API failures
            errors['api_failures_24h'] = error_logs.count_documents({
                'type': 'api_error',
                'timestamp': {'$gte': start_24h}
            })
            errors['api_failures_7d'] = error_logs.count_documents({
                'type': 'api_error',
                'timestamp': {'$gte': start_7d}
            })
            
            # Server errors
            errors['server_errors_24h'] = error_logs.count_documents({
                'type': {'$in': ['server_error', '500', 'internal_error']},
                'timestamp': {'$gte': start_24h}
            })
            errors['server_errors_7d'] = error_logs.count_documents({
                'type': {'$in': ['server_error', '500', 'internal_error']},
                'timestamp': {'$gte': start_7d}
            })
            
            # CORS issues
            errors['cors_issues_24h'] = error_logs.count_documents({
                'type': 'cors_error',
                'timestamp': {'$gte': start_24h}
            })
            errors['cors_issues_7d'] = error_logs.count_documents({
                'type': 'cors_error',
                'timestamp': {'$gte': start_7d}
            })
        
        # Count from system_events collection
        if system_events is not None:
            # Offer import failures
            errors['offer_import_failures_24h'] = system_events.count_documents({
                'event_type': 'offer_import_failed',
                'timestamp': {'$gte': start_24h}
            })
            errors['offer_import_failures_7d'] = system_events.count_documents({
                'event_type': 'offer_import_failed',
                'timestamp': {'$gte': start_7d}
            })
            
            # Category mismatches
            errors['category_mismatches_24h'] = system_events.count_documents({
                'event_type': 'category_mismatch',
                'timestamp': {'$gte': start_24h}
            })
            errors['category_mismatches_7d'] = system_events.count_documents({
                'event_type': 'category_mismatch',
                'timestamp': {'$gte': start_7d}
            })
        
        # Count postback failures
        if postback_logs is not None:
            # Incoming postback failures
            errors['incoming_postback_failures_24h'] = postback_logs.count_documents({
                'direction': 'incoming',
                'status': {'$in': ['failed', 'error']},
                'timestamp': {'$gte': start_24h}
            })
            errors['incoming_postback_failures_7d'] = postback_logs.count_documents({
                'direction': 'incoming',
                'status': {'$in': ['failed', 'error']},
                'timestamp': {'$gte': start_7d}
            })
        
        if forwarded_postbacks is not None:
            # Outgoing postback failures
            errors['outgoing_postback_failures_24h'] = forwarded_postbacks.count_documents({
                'forward_status': {'$in': ['failed', 'error']},
                'timestamp': {'$gte': start_24h}
            })
            errors['outgoing_postback_failures_7d'] = forwarded_postbacks.count_documents({
                'forward_status': {'$in': ['failed', 'error']},
                'timestamp': {'$gte': start_7d}
            })
        
        # Calculate totals
        errors['total_24h'] = (
            errors['api_failures_24h'] + errors['offer_import_failures_24h'] +
            errors['category_mismatches_24h'] + errors['server_errors_24h'] +
            errors['cors_issues_24h'] + errors['incoming_postback_failures_24h'] +
            errors['outgoing_postback_failures_24h']
        )
        errors['total_7d'] = (
            errors['api_failures_7d'] + errors['offer_import_failures_7d'] +
            errors['category_mismatches_7d'] + errors['server_errors_7d'] +
            errors['cors_issues_7d'] + errors['incoming_postback_failures_7d'] +
            errors['outgoing_postback_failures_7d']
        )
        
        return errors
    except Exception as e:
        logger.error(f"Error getting error summary: {e}")
        return None


# ============================================================================
# BOX 2: TOTAL USERS (Admin + Sub-admin)
# ============================================================================
def get_total_users():
    """Get total registered users and new signups in last 24h"""
    try:
        users = get_collection('users')
        login_logs = get_collection('login_logs')
        
        if users is None:
            return {'total': 0, 'last_24h': 0}
        
        start_24h, now = get_24h_window()
        
        total = users.count_documents({})
        
        # New signups - check created_at field
        new_24h = users.count_documents({
            '$or': [
                {'created_at': {'$gte': start_24h}},
                {'createdAt': {'$gte': start_24h}},
                {'signup_date': {'$gte': start_24h}}
            ]
        })
        
        return {'total': total, 'last_24h': new_24h}
    except Exception as e:
        logger.error(f"Error getting total users: {e}")
        return {'total': 0, 'last_24h': 0}


# ============================================================================
# BOX 3: ACTIVE USERS (Admin + Sub-admin)
# ============================================================================
def get_active_users():
    """
    Get active users - users who have logged in successfully.
    Active = user with at least one successful login.
    This counts UNIQUE users from login_logs with status='success'.
    """
    try:
        login_logs = get_collection('login_logs')
        
        start_24h, now = get_24h_window()
        
        if login_logs is None:
            return {'total': 0, 'last_24h': 0}
        
        # Total unique users who have ever logged in successfully
        total_active = len(login_logs.distinct('user_id', {'status': 'success'}))
        
        # Unique users who logged in successfully in last 24h
        active_24h = len(login_logs.distinct('user_id', {
            'status': 'success',
            'login_time': {'$gte': start_24h}
        }))
        
        return {
            'total': total_active,
            'last_24h': active_24h
        }
    except Exception as e:
        logger.error(f"Error getting active users: {e}")
        return {'total': 0, 'last_24h': 0}


# ============================================================================
# BOX 4: FRAUD USERS (Admin Only)
# ============================================================================
def get_fraud_users():
    """Get fraud flagged users"""
    try:
        login_logs = get_collection('login_logs')
        fraud_signals = get_collection('offerwall_fraud_signals')
        
        start_24h, now = get_24h_window()
        
        fraud_user_ids = set()
        fraud_24h_user_ids = set()
        
        # From login logs with high fraud score
        if login_logs is not None:
            # Total fraud users (fraud_score >= 50 or risk_level in ['medium', 'high'])
            fraud_logins = login_logs.find({
                '$or': [
                    {'fraud_score': {'$gte': 50}},
                    {'risk_level': {'$in': ['medium', 'high']}}
                ]
            }, {'user_id': 1, 'login_time': 1})
            
            for log in fraud_logins:
                if log.get('user_id'):
                    fraud_user_ids.add(str(log['user_id']))
                    if log.get('login_time') and log['login_time'] >= start_24h:
                        fraud_24h_user_ids.add(str(log['user_id']))
        
        # From fraud signals collection
        if fraud_signals is not None:
            signal_users = fraud_signals.distinct('user_id')
            fraud_user_ids.update([str(u) for u in signal_users if u])
            
            recent_signals = fraud_signals.distinct('user_id', {'timestamp': {'$gte': start_24h}})
            fraud_24h_user_ids.update([str(u) for u in recent_signals if u])
        
        return {
            'total': len(fraud_user_ids),
            'last_24h': len(fraud_24h_user_ids)
        }
    except Exception as e:
        logger.error(f"Error getting fraud users: {e}")
        return {'total': 0, 'last_24h': 0}


# ============================================================================
# BOX 5: FAILED SIGNUPS (Admin + Sub-admin)
# ============================================================================
def get_failed_signups():
    """
    Get failed signup attempts from signup_attempts collection.
    Status values: 'started', 'success', 'error'
    Failed = status is 'error' OR status is 'started' (incomplete signup)
    """
    try:
        signup_attempts = get_collection('signup_attempts')
        
        start_24h, now = get_24h_window()
        
        if signup_attempts is None:
            return {'total': 0, 'last_24h': 0}
        
        # Count failed/incomplete signup attempts (status = 'error' or 'started')
        # 'started' means they began but never completed
        total = signup_attempts.count_documents({
            'status': {'$in': ['error', 'started']}
        })
        
        # Last 24h
        last_24h = signup_attempts.count_documents({
            'status': {'$in': ['error', 'started']},
            'timestamp': {'$gte': start_24h}
        })
        
        return {'total': total, 'last_24h': last_24h}
    except Exception as e:
        logger.error(f"Error getting failed signups: {e}")
        return {'total': 0, 'last_24h': 0}


# ============================================================================
# BOX 6: TOTAL OFFERS (Admin + Sub-admin)
# ============================================================================
def get_total_offers():
    """Get total offers and new offers in last 24h"""
    try:
        offers = get_collection('offers')
        
        if offers is None:
            return {'total': 0, 'last_24h': 0}
        
        start_24h, now = get_24h_window()
        
        total = offers.count_documents({})
        
        # New offers added in last 24h
        new_24h = offers.count_documents({
            '$or': [
                {'created_at': {'$gte': start_24h}},
                {'createdAt': {'$gte': start_24h}},
                {'date_added': {'$gte': start_24h}}
            ]
        })
        
        return {'total': total, 'last_24h': new_24h}
    except Exception as e:
        logger.error(f"Error getting total offers: {e}")
        return {'total': 0, 'last_24h': 0}


# ============================================================================
# BOX 7: REQUESTED OFFERS (Admin + Sub-admin)
# ============================================================================
def get_requested_offers():
    """
    Get offer access requests from affiliate_requests collection ONLY.
    This is for publishers requesting access to specific offers.
    Does NOT include missing_offers (which is a different feature).
    """
    try:
        affiliate_requests = get_collection('affiliate_requests')
        
        start_24h, now = get_24h_window()
        
        if affiliate_requests is None:
            return {'total': 0, 'last_24h': 0}
        
        # Total affiliate requests
        total = affiliate_requests.count_documents({})
        
        # Requests in last 24h
        last_24h = affiliate_requests.count_documents({
            '$or': [
                {'requested_at': {'$gte': start_24h}},
                {'created_at': {'$gte': start_24h}},
                {'createdAt': {'$gte': start_24h}}
            ]
        })
        
        return {'total': total, 'last_24h': last_24h}
    except Exception as e:
        logger.error(f"Error getting requested offers: {e}")
        return {'total': 0, 'last_24h': 0}


# ============================================================================
# BOX 8: ACTIVE PLACEMENTS (Admin + Sub-admin)
# ============================================================================
def get_active_placements():
    """
    Get active placements (approved/live status).
    Checks both approvalStatus and status fields.
    """
    try:
        placements = get_collection('placements')
        
        if placements is None:
            return {'total': 0, 'last_24h': 0}
        
        start_24h, now = get_24h_window()
        
        # Active placements - check approvalStatus field (primary)
        # Based on debug: approvalStatus=APPROVED: 32, approvalStatus=approved: 1
        total = placements.count_documents({
            'approvalStatus': {'$in': ['APPROVED', 'approved']}
        })
        
        # New placements created in last 24h (regardless of status)
        new_24h = placements.count_documents({
            '$or': [
                {'createdAt': {'$gte': start_24h}},
                {'created_at': {'$gte': start_24h}}
            ]
        })
        
        return {'total': total, 'last_24h': new_24h}
    except Exception as e:
        logger.error(f"Error getting active placements: {e}")
        return {'total': 0, 'last_24h': 0}


# ============================================================================
# BOX 9: IFRAMES INSTALLED (Admin + Sub-admin)
# ============================================================================
def get_iframes_installed():
    """Get iframe installation count"""
    try:
        placements = get_collection('placements')
        system_events = get_collection('system_events')
        
        start_24h, now = get_24h_window()
        
        total = 0
        last_24h = 0
        
        # Count placements with iframe type or iframe_installed flag
        if placements is not None:
            total = placements.count_documents({
                '$or': [
                    {'type': 'iframe'},
                    {'iframe_installed': True},
                    {'integration_type': 'iframe'}
                ]
            })
            
            last_24h = placements.count_documents({
                '$and': [
                    {'$or': [
                        {'type': 'iframe'},
                        {'iframe_installed': True},
                        {'integration_type': 'iframe'}
                    ]},
                    {'$or': [
                        {'createdAt': {'$gte': start_24h}},
                        {'created_at': {'$gte': start_24h}}
                    ]}
                ]
            })
        
        # Also check system_events for iframe installation events
        if system_events is not None:
            total += system_events.count_documents({
                'event_type': 'iframe_installed'
            })
            last_24h += system_events.count_documents({
                'event_type': 'iframe_installed',
                'timestamp': {'$gte': start_24h}
            })
        
        return {'total': total, 'last_24h': last_24h}
    except Exception as e:
        logger.error(f"Error getting iframes installed: {e}")
        return {'total': 0, 'last_24h': 0}


# ============================================================================
# BOX 10: CLICKS (Admin + Sub-admin)
# ============================================================================
def get_total_clicks():
    """
    Get total clicks from the main clicks collection.
    Uses 'clicks' collection as the primary source.
    """
    try:
        clicks = get_collection('clicks')
        
        start_24h, now = get_24h_window()
        
        if clicks is None:
            return {'total': 0, 'last_24h': 0}
        
        # Total clicks
        total = clicks.count_documents({})
        
        # Clicks in last 24h
        last_24h = clicks.count_documents({
            '$or': [
                {'timestamp': {'$gte': start_24h}},
                {'clicked_at': {'$gte': start_24h}},
                {'created_at': {'$gte': start_24h}}
            ]
        })
        
        return {'total': total, 'last_24h': last_24h}
    except Exception as e:
        logger.error(f"Error getting total clicks: {e}")
        return {'total': 0, 'last_24h': 0}


# ============================================================================
# BOX 11: UNIQUE CLICKS (Admin + Sub-admin)
# ============================================================================
def get_unique_clicks():
    """
    Get unique clicks in last 24h.
    Unique = unique user_id + offer_id combination from clicks collection.
    """
    try:
        clicks = get_collection('clicks')
        
        start_24h, now = get_24h_window()
        
        if clicks is None:
            return {'last_24h': 0}
        
        # Count unique user_id + offer_id combinations in last 24h
        pipeline = [
            {'$match': {
                '$or': [
                    {'timestamp': {'$gte': start_24h}},
                    {'clicked_at': {'$gte': start_24h}},
                    {'created_at': {'$gte': start_24h}}
                ]
            }},
            {'$group': {
                '_id': {
                    'user_id': '$user_id',
                    'offer_id': '$offer_id'
                }
            }},
            {'$count': 'unique_clicks'}
        ]
        
        result = list(clicks.aggregate(pipeline))
        unique_24h = result[0]['unique_clicks'] if result else 0
        
        return {'last_24h': unique_24h}
    except Exception as e:
        logger.error(f"Error getting unique clicks: {e}")
        return {'last_24h': 0}


# ============================================================================
# BOX 12: SUSPICIOUS CLICKS (Admin + Sub-admin)
# ============================================================================
def get_suspicious_clicks():
    """
    Get suspicious clicks in last 24h.
    Checks fraud_signals collection for click-related fraud.
    """
    try:
        fraud_signals = get_collection('fraud_signals')
        clicks = get_collection('clicks')
        
        start_24h, now = get_24h_window()
        
        suspicious_24h = 0
        
        # From fraud_signals collection
        if fraud_signals is not None:
            suspicious_24h = fraud_signals.count_documents({
                '$or': [
                    {'timestamp': {'$gte': start_24h}},
                    {'created_at': {'$gte': start_24h}}
                ]
            })
        
        # Also check clicks with fraud indicators
        if clicks is not None:
            suspicious_24h += clicks.count_documents({
                '$and': [
                    {'$or': [
                        {'timestamp': {'$gte': start_24h}},
                        {'clicked_at': {'$gte': start_24h}}
                    ]},
                    {'$or': [
                        {'is_suspicious': True},
                        {'fraud_score': {'$gte': 50}}
                    ]}
                ]
            })
        
        return {'last_24h': suspicious_24h}
    except Exception as e:
        logger.error(f"Error getting suspicious clicks: {e}")
        return {'last_24h': 0}


# ============================================================================
# BOX 13: CONVERSIONS (Admin + Sub-admin)
# ============================================================================
def get_total_conversions():
    """
    Get total conversions from conversions collection.
    Uses 'conversions' as the primary source (141 documents).
    Does NOT double count from multiple collections.
    """
    try:
        conversions = get_collection('conversions')
        
        start_24h, now = get_24h_window()
        
        if conversions is None:
            return {'total': 0, 'last_24h': 0}
        
        # Total conversions
        total = conversions.count_documents({})
        
        # Conversions in last 24h
        last_24h = conversions.count_documents({
            '$or': [
                {'timestamp': {'$gte': start_24h}},
                {'created_at': {'$gte': start_24h}},
                {'converted_at': {'$gte': start_24h}}
            ]
        })
        
        return {'total': total, 'last_24h': last_24h}
    except Exception as e:
        logger.error(f"Error getting total conversions: {e}")
        return {'total': 0, 'last_24h': 0}


# ============================================================================
# BOX 14: REVENUE (Admin Only)
# ============================================================================
def get_total_revenue():
    """
    Get total revenue from offerwall_conversions payout_amount field.
    This is the actual revenue/payout amount, not points.
    """
    try:
        conversions = get_collection('offerwall_conversions')
        
        start_24h, now = get_24h_window()
        
        if conversions is None:
            return {'total': 0.0, 'last_24h': 0.0}
        
        # Total revenue from payout_amount
        total_pipeline = [
            {'$group': {
                '_id': None,
                'total': {'$sum': {'$ifNull': ['$payout_amount', 0]}}
            }}
        ]
        result = list(conversions.aggregate(total_pipeline))
        total = result[0].get('total', 0) if result else 0
        
        # Last 24h revenue
        recent_pipeline = [
            {'$match': {'timestamp': {'$gte': start_24h}}},
            {'$group': {
                '_id': None,
                'total': {'$sum': {'$ifNull': ['$payout_amount', 0]}}
            }}
        ]
        result = list(conversions.aggregate(recent_pipeline))
        last_24h = result[0].get('total', 0) if result else 0
        
        return {'total': round(total, 2), 'last_24h': round(last_24h, 2)}
    except Exception as e:
        logger.error(f"Error getting total revenue: {e}")
        return {'total': 0.0, 'last_24h': 0.0}


# ============================================================================
# BOX 15: REVERSALS (Admin Only)
# ============================================================================
def get_total_reversals():
    """
    Get total reversals from conversions collection.
    Checks for status='reversed' or is_reversal=True.
    """
    try:
        conversions = get_collection('conversions')
        
        start_24h, now = get_24h_window()
        
        if conversions is None:
            return {'total': 0, 'last_24h': 0}
        
        # Total reversals
        total = conversions.count_documents({
            '$or': [
                {'status': 'reversed'},
                {'is_reversal': True}
            ]
        })
        
        # Reversals in last 24h
        last_24h = conversions.count_documents({
            '$and': [
                {'$or': [
                    {'status': 'reversed'},
                    {'is_reversal': True}
                ]},
                {'$or': [
                    {'timestamp': {'$gte': start_24h}},
                    {'reversed_at': {'$gte': start_24h}}
                ]}
            ]
        })
        
        return {'total': total, 'last_24h': last_24h}
    except Exception as e:
        logger.error(f"Error getting total reversals: {e}")
        return {'total': 0, 'last_24h': 0}


# ============================================================================
# BOX 16: POSTBACK FAILURES (Admin Only)
# ============================================================================
def get_postback_failures():
    """Get total postback failures (inbound + outbound)"""
    try:
        postback_logs = get_collection('postback_logs')
        forwarded_postbacks = get_collection('forwarded_postbacks')
        
        start_24h, now = get_24h_window()
        
        total = 0
        last_24h = 0
        
        # Inbound failures
        if postback_logs is not None:
            total += postback_logs.count_documents({
                'status': {'$in': ['failed', 'error']}
            })
            last_24h += postback_logs.count_documents({
                'status': {'$in': ['failed', 'error']},
                'timestamp': {'$gte': start_24h}
            })
        
        # Outbound failures
        if forwarded_postbacks is not None:
            total += forwarded_postbacks.count_documents({
                'forward_status': {'$in': ['failed', 'error']}
            })
            last_24h += forwarded_postbacks.count_documents({
                'forward_status': {'$in': ['failed', 'error']},
                'timestamp': {'$gte': start_24h}
            })
        
        return {'total': total, 'last_24h': last_24h}
    except Exception as e:
        logger.error(f"Error getting postback failures: {e}")
        return {'total': 0, 'last_24h': 0}


# ============================================================================
# MAIN API ENDPOINT
# ============================================================================

@admin_overview_bp.route('/api/admin/overview-stats', methods=['GET'])
@token_required
def get_overview_stats():
    """
    Get all overview statistics for admin dashboard
    Returns data for all 16 boxes with role-based visibility
    
    Admin sees: All 16 boxes
    Sub-admin sees: Boxes 2-13 (excludes Error Summary, Fraud Users, Revenue, Reversals, Postback Failures)
    """
    try:
        user = request.current_user
        user_role = user.get('role', 'user')
        
        # Only admin and subadmin can access
        if user_role not in ['admin', 'subadmin']:
            return jsonify({'error': 'Admin or subadmin access required'}), 403
        
        is_admin = user_role == 'admin'
        
        logger.info(f"📊 Getting overview stats for {user.get('username')} (role: {user_role})")
        
        # Get current timestamp for "Last Updated"
        last_updated = datetime.utcnow().isoformat() + 'Z'
        
        # Build response based on role
        response = {
            'success': True,
            'last_updated': last_updated,
            'user_role': user_role,
            'stats': {}
        }
        
        # Box 1: Error Summary (Admin Only)
        if is_admin:
            response['stats']['error_summary'] = get_error_summary()
        
        # Box 2: Total Users (Admin + Sub-admin)
        response['stats']['total_users'] = get_total_users()
        
        # Box 3: Active Users (Admin + Sub-admin)
        response['stats']['active_users'] = get_active_users()
        
        # Box 4: Fraud Users (Admin Only)
        if is_admin:
            response['stats']['fraud_users'] = get_fraud_users()
        
        # Box 5: Failed Signups (Admin + Sub-admin)
        response['stats']['failed_signups'] = get_failed_signups()
        
        # Box 6: Total Offers (Admin + Sub-admin)
        response['stats']['total_offers'] = get_total_offers()
        
        # Box 7: Requested Offers (Admin + Sub-admin)
        response['stats']['requested_offers'] = get_requested_offers()
        
        # Box 8: Active Placements (Admin + Sub-admin)
        response['stats']['active_placements'] = get_active_placements()
        
        # Box 9: Iframes Installed (Admin + Sub-admin)
        response['stats']['iframes_installed'] = get_iframes_installed()
        
        # Box 10: Clicks (Admin + Sub-admin)
        response['stats']['clicks'] = get_total_clicks()
        
        # Box 11: Unique Clicks (Admin + Sub-admin)
        response['stats']['unique_clicks'] = get_unique_clicks()
        
        # Box 12: Suspicious Clicks (Admin + Sub-admin)
        response['stats']['suspicious_clicks'] = get_suspicious_clicks()
        
        # Box 13: Conversions (Admin + Sub-admin)
        response['stats']['conversions'] = get_total_conversions()
        
        # Box 14: Revenue (Admin Only)
        if is_admin:
            response['stats']['revenue'] = get_total_revenue()
        
        # Box 15: Reversals (Admin Only)
        if is_admin:
            response['stats']['reversals'] = get_total_reversals()
        
        # Box 16: Postback Failures (Admin Only)
        if is_admin:
            response['stats']['postback_failures'] = get_postback_failures()
        
        logger.info(f"✅ Overview stats retrieved successfully")
        return jsonify(response), 200
        
    except Exception as e:
        logger.error(f"❌ Error getting overview stats: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@admin_overview_bp.route('/api/admin/overview-stats/<box_name>', methods=['GET'])
@token_required
def get_single_box_stats(box_name):
    """
    Get stats for a single box (for testing individual boxes)
    """
    try:
        user = request.current_user
        user_role = user.get('role', 'user')
        
        # Only admin and subadmin can access
        if user_role not in ['admin', 'subadmin']:
            return jsonify({'error': 'Admin or subadmin access required'}), 403
        
        is_admin = user_role == 'admin'
        
        # Admin-only boxes
        admin_only_boxes = ['error_summary', 'fraud_users', 'revenue', 'reversals', 'postback_failures']
        
        if box_name in admin_only_boxes and not is_admin:
            return jsonify({
                'success': False,
                'error': 'Admin access required for this box'
            }), 403
        
        # Map box names to functions
        box_functions = {
            'error_summary': get_error_summary,
            'total_users': get_total_users,
            'active_users': get_active_users,
            'fraud_users': get_fraud_users,
            'failed_signups': get_failed_signups,
            'total_offers': get_total_offers,
            'requested_offers': get_requested_offers,
            'active_placements': get_active_placements,
            'iframes_installed': get_iframes_installed,
            'clicks': get_total_clicks,
            'unique_clicks': get_unique_clicks,
            'suspicious_clicks': get_suspicious_clicks,
            'conversions': get_total_conversions,
            'revenue': get_total_revenue,
            'reversals': get_total_reversals,
            'postback_failures': get_postback_failures
        }
        
        if box_name not in box_functions:
            return jsonify({
                'success': False,
                'error': f'Unknown box: {box_name}'
            }), 400
        
        data = box_functions[box_name]()
        
        return jsonify({
            'success': True,
            'box_name': box_name,
            'last_updated': datetime.utcnow().isoformat() + 'Z',
            'data': data
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error getting {box_name} stats: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
