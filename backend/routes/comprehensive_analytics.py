"""
Comprehensive Offerwall Analytics API
All tracking details, reports, and analytics
"""
from flask import Blueprint, request, jsonify
from functools import wraps
import logging
from datetime import datetime, timedelta
from bson import ObjectId
from utils.auth import token_required, subadmin_or_admin_required

logger = logging.getLogger(__name__)

comprehensive_analytics_bp = Blueprint('comprehensive_analytics', __name__)

# Global tracker instance (will be set during app initialization)
comprehensive_tracker = None
db_instance = None


def set_tracker(tracker, db):
    """Set tracker instance"""
    global comprehensive_tracker, db_instance
    comprehensive_tracker = tracker
    db_instance = db


def admin_required(f):
    """Decorator to require admin role"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = getattr(request, 'current_user', None)
        if not user or user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated_function


# ============================================================================
# ADMIN ENDPOINTS - COMPREHENSIVE ANALYTICS
# ============================================================================

@comprehensive_analytics_bp.route('/api/admin/offerwall/comprehensive-analytics', methods=['GET'])
def get_comprehensive_analytics():
    """Get comprehensive analytics with all details"""
    try:
        # Get filters from query params
        placement_id = request.args.get('placement_id')
        publisher_id = request.args.get('publisher_id')
        user_id = request.args.get('user_id')
        offer_id = request.args.get('offer_id')
        
        filters = {}
        if placement_id:
            filters['placement_id'] = placement_id
        if publisher_id:
            filters['publisher_id'] = publisher_id
        if user_id:
            filters['user_id'] = user_id
        if offer_id:
            filters['offer_id'] = offer_id
        
        analytics = comprehensive_tracker.get_comprehensive_analytics(filters)
        
        return jsonify({
            'success': True,
            'data': analytics
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error getting comprehensive analytics: {e}")
        return jsonify({'error': str(e)}), 500


@comprehensive_analytics_bp.route('/api/admin/offerwall/detailed-events', methods=['GET'])
def get_detailed_events():
    """Get detailed event log with all information"""
    try:
        event_type = request.args.get('type', 'all')  # all, impression, click, conversion
        limit = int(request.args.get('limit', 100))
        skip = int(request.args.get('skip', 0))
        
        filters = {}
        
        if event_type == 'impression':
            collection = db_instance.get_collection('offerwall_impressions_detailed')
        elif event_type == 'click':
            collection = db_instance.get_collection('offerwall_clicks_detailed')
        elif event_type == 'conversion':
            collection = db_instance.get_collection('offerwall_conversions_detailed')
        else:
            # Return all events
            collections = {
                'impressions': db_instance.get_collection('offerwall_impressions_detailed'),
                'clicks': db_instance.get_collection('offerwall_clicks_detailed'),
                'conversions': db_instance.get_collection('offerwall_conversions_detailed'),
            }
            
            all_events = []
            for event_type_name, col in collections.items():
                events = list(col.find({}).sort('timestamp', -1).limit(limit).skip(skip))
                for event in events:
                    event['_id'] = str(event['_id'])
                    event['event_type'] = event_type_name
                all_events.extend(events)
            
            all_events.sort(key=lambda x: x['timestamp'], reverse=True)
            
            return jsonify({
                'success': True,
                'data': all_events[:limit]
            }), 200
        
        events = list(collection.find({}).sort('timestamp', -1).limit(limit).skip(skip))
        for event in events:
            event['_id'] = str(event['_id'])
        
        return jsonify({
            'success': True,
            'data': events
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error getting detailed events: {e}")
        return jsonify({'error': str(e)}), 500


@comprehensive_analytics_bp.route('/api/admin/offerwall/user-tracking/<user_id>', methods=['GET'])
def get_user_tracking_details(user_id):
    """Get complete tracking details for a specific user"""
    try:
        # Get all sessions for user
        sessions_col = db_instance.get_collection('offerwall_sessions_detailed')
        sessions = list(sessions_col.find({'user_id': user_id}))
        
        # Get all impressions
        impressions_col = db_instance.get_collection('offerwall_impressions_detailed')
        impressions = list(impressions_col.find({'user_id': user_id}))
        
        # Get all clicks
        clicks_col = db_instance.get_collection('offerwall_clicks_detailed')
        clicks = list(clicks_col.find({'user_id': user_id}))
        
        # Get all conversions
        conversions_col = db_instance.get_collection('offerwall_conversions_detailed')
        conversions = list(conversions_col.find({'user_id': user_id}))
        
        # Get fraud signals
        fraud_col = db_instance.get_collection('offerwall_fraud_signals')
        fraud_signals = list(fraud_col.find({'user_id': user_id}))
        
        # Get user points
        points_col = db_instance.get_collection('user_points')
        user_points = points_col.find_one({'user_id': user_id})
        
        # Convert ObjectIds to strings
        for item in sessions + impressions + clicks + conversions + fraud_signals:
            item['_id'] = str(item['_id'])
        
        if user_points:
            user_points['_id'] = str(user_points['_id'])
        
        return jsonify({
            'success': True,
            'data': {
                'user_id': user_id,
                'sessions': sessions,
                'impressions': impressions,
                'clicks': clicks,
                'conversions': conversions,
                'fraud_signals': fraud_signals,
                'points': user_points,
                'summary': {
                    'total_sessions': len(sessions),
                    'total_impressions': len(impressions),
                    'total_clicks': len(clicks),
                    'total_conversions': len(conversions),
                    'total_fraud_signals': len(fraud_signals),
                    'total_points': user_points.get('total_points', 0) if user_points else 0,
                }
            }
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error getting user tracking: {e}")
        return jsonify({'error': str(e)}), 500


@comprehensive_analytics_bp.route('/api/admin/offerwall/publisher-tracking/<publisher_id>', methods=['GET'])
def get_publisher_tracking_details(publisher_id):
    """Get complete tracking details for a specific publisher"""
    try:
        # Get all placements
        placements_col = db_instance.get_collection('placements')
        placements = list(placements_col.find({'publisherId': ObjectId(publisher_id)}))
        
        # Get all clicks for publisher
        clicks_col = db_instance.get_collection('offerwall_clicks_detailed')
        clicks = list(clicks_col.find({'publisher_id': publisher_id}))
        
        # Get all conversions
        conversions_col = db_instance.get_collection('offerwall_conversions_detailed')
        conversions = list(conversions_col.find({'publisher_id': publisher_id}))
        
        # Get publisher earnings
        earnings_col = db_instance.get_collection('publisher_earnings')
        earnings = list(earnings_col.find({'publisher_id': publisher_id}))
        
        # Calculate totals
        total_clicks = len(clicks)
        total_conversions = len(conversions)
        total_earnings = sum(e['earnings'] for e in earnings)
        
        # Convert ObjectIds
        for item in placements + clicks + conversions + earnings:
            if '_id' in item:
                item['_id'] = str(item['_id'])
        
        return jsonify({
            'success': True,
            'data': {
                'publisher_id': publisher_id,
                'placements': placements,
                'clicks': clicks,
                'conversions': conversions,
                'earnings': earnings,
                'summary': {
                    'total_placements': len(placements),
                    'total_clicks': total_clicks,
                    'total_conversions': total_conversions,
                    'total_earnings': round(total_earnings, 2),
                    'ctr': round((total_clicks / len(clicks)) * 100, 2) if clicks else 0,
                    'cvr': round((total_conversions / total_clicks) * 100, 2) if total_clicks > 0 else 0,
                }
            }
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error getting publisher tracking: {e}")
        return jsonify({'error': str(e)}), 500


@comprehensive_analytics_bp.route('/api/admin/offerwall/offer-tracking/<offer_id>', methods=['GET'])
def get_offer_tracking_details(offer_id):
    """Get complete tracking details for a specific offer"""
    try:
        # Get all clicks for offer
        clicks_col = db_instance.get_collection('offerwall_clicks_detailed')
        clicks = list(clicks_col.find({'offer_id': offer_id}))
        
        # Get all conversions
        conversions_col = db_instance.get_collection('offerwall_conversions_detailed')
        conversions = list(conversions_col.find({'offer_id': offer_id}))
        
        # Get impressions
        impressions_col = db_instance.get_collection('offerwall_impressions_detailed')
        impressions = list(impressions_col.find({'offer_id': offer_id}))
        
        # Calculate metrics
        total_impressions = len(impressions)
        total_clicks = len(clicks)
        total_conversions = len(conversions)
        total_payout = sum(c['payout']['network_payout'] for c in conversions)
        
        ctr = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0
        cvr = (total_conversions / total_clicks * 100) if total_clicks > 0 else 0
        
        # Convert ObjectIds
        for item in clicks + conversions + impressions:
            if '_id' in item:
                item['_id'] = str(item['_id'])
        
        return jsonify({
            'success': True,
            'data': {
                'offer_id': offer_id,
                'impressions': impressions,
                'clicks': clicks,
                'conversions': conversions,
                'summary': {
                    'total_impressions': total_impressions,
                    'total_clicks': total_clicks,
                    'total_conversions': total_conversions,
                    'ctr': round(ctr, 2),
                    'cvr': round(cvr, 2),
                    'total_payout': round(total_payout, 2),
                    'avg_payout': round(total_payout / total_conversions, 2) if total_conversions > 0 else 0,
                }
            }
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error getting offer tracking: {e}")
        return jsonify({'error': str(e)}), 500


@comprehensive_analytics_bp.route('/api/admin/offerwall/reports/<report_type>', methods=['GET'])
def get_detailed_reports(report_type):
    """Get detailed reports by type"""
    try:
        filters = {}
        
        report = comprehensive_tracker.get_detailed_report(report_type, filters)
        
        return jsonify({
            'success': True,
            'report_type': report_type,
            'data': report
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error getting report: {e}")
        return jsonify({'error': str(e)}), 500


@comprehensive_analytics_bp.route('/api/admin/offerwall/fraud-analysis', methods=['GET'])
def get_fraud_analysis():
    """Get comprehensive fraud analysis"""
    try:
        fraud_col = db_instance.get_collection('offerwall_fraud_signals')
        
        # Get fraud signals by type
        fraud_by_type = list(fraud_col.aggregate([
            {'$group': {
                '_id': '$type',
                'count': {'$sum': 1},
                'severity': {'$first': '$severity'},
                'users': {'$addToSet': '$user_id'},
            }},
            {'$sort': {'count': -1}}
        ]))
        
        # Get fraud signals by user
        fraud_by_user = list(fraud_col.aggregate([
            {'$group': {
                '_id': '$user_id',
                'count': {'$sum': 1},
                'types': {'$addToSet': '$type'},
                'severity_levels': {'$addToSet': '$severity'},
            }},
            {'$sort': {'count': -1}},
            {'$limit': 50}
        ]))
        
        # Get recent fraud signals
        recent_fraud = list(fraud_col.find({}).sort('timestamp', -1).limit(100))
        for item in recent_fraud:
            item['_id'] = str(item['_id'])
        
        return jsonify({
            'success': True,
            'data': {
                'fraud_by_type': fraud_by_type,
                'fraud_by_user': fraud_by_user,
                'recent_fraud': recent_fraud,
                'total_fraud_signals': fraud_col.count_documents({}),
            }
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error getting fraud analysis: {e}")
        return jsonify({'error': str(e)}), 500


@comprehensive_analytics_bp.route('/api/admin/offerwall/revenue-analysis', methods=['GET'])
def get_revenue_analysis():
    """Get comprehensive revenue analysis"""
    try:
        conversions_col = db_instance.get_collection('offerwall_conversions_detailed')
        
        # Revenue by offer
        revenue_by_offer = list(conversions_col.aggregate([
            {'$group': {
                '_id': '$offer_id',
                'offer_name': {'$first': '$offer_name'},
                'network_payout': {'$sum': '$payout.network_payout'},
                'user_reward': {'$sum': '$payout.user_reward'},
                'publisher_commission': {'$sum': '$payout.publisher_commission'},
                'platform_revenue': {'$sum': '$payout.platform_revenue'},
                'conversions': {'$sum': 1},
            }},
            {'$sort': {'platform_revenue': -1}},
            {'$limit': 50}
        ]))
        
        # Revenue by publisher
        revenue_by_publisher = list(conversions_col.aggregate([
            {'$group': {
                '_id': '$publisher_id',
                'publisher_commission': {'$sum': '$payout.publisher_commission'},
                'conversions': {'$sum': 1},
                'avg_commission': {'$avg': '$payout.publisher_commission'},
            }},
            {'$sort': {'publisher_commission': -1}},
            {'$limit': 50}
        ]))
        
        # Revenue by network
        revenue_by_network = list(conversions_col.aggregate([
            {'$group': {
                '_id': '$offer.network',
                'network_payout': {'$sum': '$payout.network_payout'},
                'conversions': {'$sum': 1},
                'avg_payout': {'$avg': '$payout.network_payout'},
            }},
            {'$sort': {'network_payout': -1}}
        ]))
        
        # Total revenue
        totals = list(conversions_col.aggregate([
            {'$group': {
                '_id': None,
                'total_network_payout': {'$sum': '$payout.network_payout'},
                'total_user_reward': {'$sum': '$payout.user_reward'},
                'total_publisher_commission': {'$sum': '$payout.publisher_commission'},
                'total_platform_revenue': {'$sum': '$payout.platform_revenue'},
            }}
        ]))
        
        total_data = totals[0] if totals else {}
        
        return jsonify({
            'success': True,
            'data': {
                'revenue_by_offer': revenue_by_offer,
                'revenue_by_publisher': revenue_by_publisher,
                'revenue_by_network': revenue_by_network,
                'totals': {
                    'network_payout': round(total_data.get('total_network_payout', 0), 2),
                    'user_reward': round(total_data.get('total_user_reward', 0), 2),
                    'publisher_commission': round(total_data.get('total_publisher_commission', 0), 2),
                    'platform_revenue': round(total_data.get('total_platform_revenue', 0), 2),
                }
            }
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error getting revenue analysis: {e}")
        return jsonify({'error': str(e)}), 500


@comprehensive_analytics_bp.route('/api/admin/offerwall/export-report', methods=['POST'])
def export_report():
    """Export detailed report as CSV/JSON"""
    try:
        data = request.get_json()
        report_type = data.get('report_type', 'conversions')
        format_type = data.get('format', 'json')  # json or csv
        
        if report_type == 'conversions':
            conversions_col = db_instance.get_collection('offerwall_conversions_detailed')
            records = list(conversions_col.find({}))
        elif report_type == 'clicks':
            clicks_col = db_instance.get_collection('offerwall_clicks_detailed')
            records = list(clicks_col.find({}))
        else:
            records = []
        
        # Convert ObjectIds to strings
        for record in records:
            record['_id'] = str(record['_id'])
        
        if format_type == 'csv':
            # Convert to CSV
            import csv
            import io
            
            output = io.StringIO()
            if records:
                writer = csv.DictWriter(output, fieldnames=records[0].keys())
                writer.writeheader()
                writer.writerows(records)
            
            return output.getvalue(), 200, {
                'Content-Disposition': f'attachment; filename="offerwall_{report_type}.csv"',
                'Content-Type': 'text/csv'
            }
        else:
            return jsonify({
                'success': True,
                'data': records
            }), 200
        
    except Exception as e:
        logger.error(f"❌ Error exporting report: {e}")
        return jsonify({'error': str(e)}), 500


# ============================================================================
# TRACKING ENDPOINTS - FOR COMPREHENSIVE DATA COLLECTION
# ============================================================================

@comprehensive_analytics_bp.route('/api/comprehensive/track/session', methods=['POST'])
def track_comprehensive_session():
    """Create comprehensive session"""
    try:
        data = request.get_json()
        session_id, error = comprehensive_tracker.create_session(data)
        
        if error:
            return jsonify({'error': error}), 400
        
        return jsonify({
            'success': True,
            'session_id': session_id
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error creating session: {e}")
        return jsonify({'error': str(e)}), 500


@comprehensive_analytics_bp.route('/api/comprehensive/track/impression', methods=['POST'])
def track_comprehensive_impression():
    """Track impression with comprehensive details"""
    try:
        data = request.get_json()
        impression_id, error = comprehensive_tracker.track_impression(data)
        
        if error:
            return jsonify({'error': error}), 400
        
        return jsonify({
            'success': True,
            'impression_id': impression_id
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error tracking impression: {e}")
        return jsonify({'error': str(e)}), 500


@comprehensive_analytics_bp.route('/api/comprehensive/track/click', methods=['POST'])
def track_comprehensive_click():
    """Track click with comprehensive details"""
    try:
        data = request.get_json()
        click_id, error = comprehensive_tracker.track_click(data)
        
        if error:
            return jsonify({'error': error}), 400
        
        return jsonify({
            'success': True,
            'click_id': click_id
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error tracking click: {e}")
        return jsonify({'error': str(e)}), 500


@comprehensive_analytics_bp.route('/api/comprehensive/track/conversion', methods=['POST'])
def track_comprehensive_conversion():
    """Track conversion with comprehensive details"""
    try:
        data = request.get_json()
        conversion_id, error = comprehensive_tracker.track_conversion(data)
        
        if error:
            return jsonify({'error': error}), 400
        
        return jsonify({
            'success': True,
            'conversion_id': conversion_id
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error tracking conversion: {e}")
        return jsonify({'error': str(e)}), 500


# ============================================================================
# DETAILED CLICK HISTORY ENDPOINTS
# ============================================================================

@comprehensive_analytics_bp.route('/api/admin/offerwall/click-history', methods=['GET'])
@token_required
@subadmin_or_admin_required('comprehensive-analytics')
def get_click_history():
    """Get detailed click history with all information"""
    try:
        limit = int(request.args.get('limit', 50))
        skip = int(request.args.get('skip', 0))
        user_id = request.args.get('user_id')
        publisher_id = request.args.get('publisher_id')
        offer_id = request.args.get('offer_id')
        
        filters = {}
        if user_id:
            filters['user_id'] = user_id
        if publisher_id:
            filters['publisher_id'] = publisher_id
        if offer_id:
            filters['offer_id'] = offer_id
        
        # Get all click collections
        clicks_detailed_col = db_instance.get_collection('offerwall_clicks_detailed')
        clicks_offerwall_col = db_instance.get_collection('offerwall_clicks')
        clicks_simple_col = db_instance.get_collection('clicks')  # Simple tracking clicks
        
        all_clicks = []
        
        # 1. Get clicks from offerwall_clicks_detailed
        if clicks_detailed_col is not None:
            detailed_clicks = list(clicks_detailed_col.find(filters)
                                  .sort('timestamp', -1)
                                  .limit(limit))
            all_clicks.extend(detailed_clicks)
        
        # 2. Get clicks from offerwall_clicks (basic)
        if clicks_offerwall_col is not None:
            offerwall_clicks = list(clicks_offerwall_col.find(filters)
                                   .sort('timestamp', -1)
                                   .limit(limit))
            all_clicks.extend(offerwall_clicks)
        
        # 3. Get clicks from simple tracking (clicks collection)
        if clicks_simple_col is not None:
            simple_filters = {}
            if user_id:
                simple_filters['user_id'] = user_id
            if publisher_id:
                simple_filters['affiliate_id'] = publisher_id  # Simple tracking uses affiliate_id
            if offer_id:
                simple_filters['offer_id'] = offer_id
            
            simple_clicks = list(clicks_simple_col.find(simple_filters)
                                .sort('timestamp', -1)
                                .limit(limit))
            all_clicks.extend(simple_clicks)
        
        # Remove duplicates by click_id and sort by timestamp
        seen_click_ids = set()
        unique_clicks = []
        for click in all_clicks:
            click_id = click.get('click_id')
            if click_id and click_id not in seen_click_ids:
                seen_click_ids.add(click_id)
                unique_clicks.append(click)
        
        # Sort by timestamp descending
        unique_clicks.sort(key=lambda x: x.get('timestamp') or datetime.min, reverse=True)
        unique_clicks = unique_clicks[:limit]
        
        # Format response for clicks
        formatted_clicks = []
        for click in unique_clicks:
            # Handle different click formats (detailed, basic, simple)
            # Extract device info - handle both nested and flat structures
            device_info = click.get('device', {})
            if not device_info or not isinstance(device_info, dict):
                device_info = {}
            
            # Build device response with fallbacks
            device_response = {
                'type': device_info.get('type') or click.get('device_type') or 'Unknown',
                'browser': device_info.get('browser') or click.get('browser') or 'Unknown',
                'os': device_info.get('os') or click.get('os') or 'Unknown'
            }
            
            # Extract geo info - handle both nested and flat structures
            geo_info = click.get('geo', {})
            if not geo_info or not isinstance(geo_info, dict):
                geo_info = {}
            
            geo_response = {
                'country': geo_info.get('country') or click.get('country') or 'Unknown',
                'city': geo_info.get('city') or click.get('city') or 'Unknown',
                'region': geo_info.get('region') or click.get('region') or 'Unknown'
            }
            
            # Extract network info
            network_info = click.get('network', {})
            if not network_info or not isinstance(network_info, dict):
                network_info = {}
            
            network_response = {
                'ip_address': network_info.get('ip_address') or geo_info.get('ip_address') or click.get('ip_address') or 'Unknown',
                'isp': network_info.get('isp') or geo_info.get('isp') or click.get('isp') or 'Unknown'
            }
            
            # Extract fraud indicators
            fraud_info = click.get('fraud_indicators', {})
            if not fraud_info or not isinstance(fraud_info, dict):
                fraud_info = {}
            
            fraud_response = {
                'fraud_score': fraud_info.get('fraud_score') or click.get('fraud_score', 0),
                'fraud_status': fraud_info.get('fraud_status') or click.get('fraud_status', 'clean'),
                'is_duplicate': fraud_info.get('duplicate_click') or click.get('is_duplicate', False)
            }
            
            # Get offer name from different possible fields
            offer_name = (click.get('offer_name') or 
                         click.get('data', {}).get('offer_name') or 
                         'Unknown Offer')
            
            # Get publisher_id from different possible fields
            pub_id = click.get('publisher_id') or click.get('affiliate_id') or 'Unknown'
            
            formatted_clicks.append({
                'click_id': click.get('click_id'),
                'user_id': click.get('user_id'),
                'publisher_id': pub_id,
                'publisher_name': click.get('publisher_name', 'Unknown'),
                'offer_id': click.get('offer_id'),
                'offer_name': offer_name,
                'placement_id': click.get('placement_id') or click.get('sub_id1', ''),
                'timestamp': click.get('timestamp').isoformat() if click.get('timestamp') else None,
                'device': device_response,
                'network': network_response,
                'geo': geo_response,
                'fraud_indicators': fraud_response,
                'event_type': 'click',
            })
        
        # Also get conversions for the same filters
        conversions_col = db_instance.get_collection('offerwall_conversions')
        conversion_query = {}
        if user_id:
            conversion_query['user_id'] = user_id
        if publisher_id:
            conversion_query['publisher_id'] = publisher_id
        if offer_id:
            conversion_query['offer_id'] = offer_id
        
        conversions = list(conversions_col.find(conversion_query)
                          .sort('timestamp', -1)
                          .limit(limit))
        
        # Format conversions
        for conversion in conversions:
            formatted_clicks.append({
                'click_id': conversion.get('conversion_id'),
                'user_id': conversion.get('user_id'),
                'publisher_id': conversion.get('publisher_id'),
                'publisher_name': 'Unknown',
                'offer_id': conversion.get('offer_id'),
                'offer_name': conversion.get('data', {}).get('offer_name', 'Unknown Offer'),
                'placement_id': conversion.get('placement_id'),
                'timestamp': conversion.get('timestamp').isoformat() if conversion.get('timestamp') else None,
                'device': {},
                'network': {},
                'geo': {},
                'fraud_indicators': {},
                'event_type': 'conversion',
                'payout_amount': conversion.get('payout_amount'),
                'points_awarded': conversion.get('points_awarded'),
            })
        
        # Sort all events by timestamp (newest first)
        formatted_clicks.sort(key=lambda x: x['timestamp'] if x['timestamp'] else '', reverse=True)
        
        return jsonify({
            'success': True,
            'total': len(formatted_clicks),
            'limit': limit,
            'skip': skip,
            'data': formatted_clicks
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error getting click history: {e}")
        return jsonify({'error': str(e)}), 500


@comprehensive_analytics_bp.route('/api/admin/offerwall/click-details/<click_id>', methods=['GET'])
@token_required
@subadmin_or_admin_required('comprehensive-analytics')
def get_click_details(click_id):
    """Get detailed information about a specific click or conversion"""
    try:
        click = None
        source_collection = None
        
        # Try to find in detailed clicks first
        clicks_col = db_instance.get_collection('offerwall_clicks_detailed')
        if clicks_col is not None:
            click = clicks_col.find_one({'click_id': click_id})
            if click:
                source_collection = 'offerwall_clicks_detailed'
        
        # If not found in detailed, try basic offerwall_clicks collection
        if not click:
            clicks_basic_col = db_instance.get_collection('offerwall_clicks')
            if clicks_basic_col is not None:
                click = clicks_basic_col.find_one({'click_id': click_id})
                if click:
                    source_collection = 'offerwall_clicks'
        
        # If not found, try simple tracking clicks collection
        if not click:
            clicks_simple_col = db_instance.get_collection('clicks')
            if clicks_simple_col is not None:
                click = clicks_simple_col.find_one({'click_id': click_id})
                if click:
                    source_collection = 'clicks'
        
        # If not found, try conversions
        if not click:
            conversions_col = db_instance.get_collection('offerwall_conversions')
            if conversions_col is not None:
                click = conversions_col.find_one({'conversion_id': click_id})
                if click:
                    # Mark as conversion
                    click['event_type'] = 'conversion'
                    source_collection = 'offerwall_conversions'
        
        if not click:
            return jsonify({'error': 'Click/Conversion not found'}), 404
        
        logger.info(f"✅ Found click in collection: {source_collection}")
        
        # Format response with all details
        event_type = click.get('event_type', 'click')
        
        # Get publisher name if not in click data
        publisher_name = click.get('publisher_name', 'Unknown')
        publisher_id = click.get('publisher_id') or click.get('affiliate_id')
        
        if publisher_name == 'Unknown' and click.get('placement_id'):
            try:
                # Try to get publisher name from placement
                placements_col = db_instance.get_collection('placements')
                placement_id_to_search = click.get('placement_id')
                
                # Try multiple search strategies for placement
                placement = None
                
                # Strategy 1: Try as ObjectId
                try:
                    from bson import ObjectId
                    placement = placements_col.find_one({'_id': ObjectId(placement_id_to_search)})
                except:
                    pass
                
                # Strategy 2: Try by placement_id field as string
                if not placement:
                    placement = placements_col.find_one({'placement_id': placement_id_to_search})
                
                # Strategy 3: Try by _id as string
                if not placement:
                    placement = placements_col.find_one({'_id': placement_id_to_search})
                
                # Strategy 4: Try by placementId field (camelCase)
                if not placement:
                    placement = placements_col.find_one({'placementId': placement_id_to_search})
                
                if placement and placement.get('publisherId'):
                    publishers_col = db_instance.get_collection('publishers')
                    publisher = publishers_col.find_one({'_id': ObjectId(placement['publisherId'])})
                    if publisher:
                        publisher_name = publisher.get('name', 'Unknown')
                        publisher_id = str(placement['publisherId'])
                        logger.info(f"✅ Retrieved publisher name: {publisher_name}")
            except Exception as e:
                logger.warning(f"⚠️ Error fetching publisher name: {e}")
        
        # Extract device info - handle both nested and flat structures
        device_info = click.get('device', {})
        if not device_info or not isinstance(device_info, dict):
            device_info = {}
        
        # Fallback to flat fields if nested is empty
        device_response = {
            'type': device_info.get('type') or click.get('device_type') or 'Unknown',
            'model': device_info.get('model'),
            'os': device_info.get('os') or click.get('os') or 'Unknown',
            'os_version': device_info.get('os_version'),
            'browser': device_info.get('browser') or click.get('browser') or 'Unknown',
            'browser_version': device_info.get('browser_version'),
            'screen_resolution': device_info.get('screen_resolution'),
            'screen_dpi': device_info.get('screen_dpi'),
            'timezone': device_info.get('timezone'),
            'language': device_info.get('language'),
        }
        
        # Extract geo info - handle both nested and flat structures
        geo_info = click.get('geo', {})
        if not geo_info or not isinstance(geo_info, dict):
            geo_info = {}
        
        geo_response = {
            'country': geo_info.get('country') or click.get('country') or 'Unknown',
            'country_code': geo_info.get('country_code') or click.get('country_code'),
            'region': geo_info.get('region') or click.get('region') or 'Unknown',
            'city': geo_info.get('city') or click.get('city') or 'Unknown',
            'postal_code': geo_info.get('postal_code') or click.get('postal_code'),
            'latitude': geo_info.get('latitude') or click.get('latitude'),
            'longitude': geo_info.get('longitude') or click.get('longitude'),
            'timezone': geo_info.get('timezone'),
            'ip_address': geo_info.get('ip_address') or click.get('ip_address'),
            'isp': geo_info.get('isp') or click.get('isp'),
            'asn': geo_info.get('asn') or click.get('asn'),
            'organization': geo_info.get('organization') or click.get('organization'),
        }
        
        # Extract network info
        network_info = click.get('network', {})
        if not network_info or not isinstance(network_info, dict):
            network_info = {}
        
        network_response = {
            'ip_address': network_info.get('ip_address') or geo_response.get('ip_address') or click.get('ip_address'),
            'ip_version': network_info.get('ip_version'),
            'asn': network_info.get('asn') or geo_response.get('asn'),
            'isp': network_info.get('isp') or geo_response.get('isp'),
            'organization': network_info.get('organization') or geo_response.get('organization'),
            'proxy_detected': network_info.get('proxy_detected') or click.get('proxy_detected', False),
            'vpn_detected': network_info.get('vpn_detected') or click.get('vpn_detected', False),
            'tor_detected': network_info.get('tor_detected') or click.get('tor_detected', False),
            'datacenter_detected': network_info.get('datacenter_detected') or click.get('hosting_detected', False),
            'connection_type': network_info.get('connection_type'),
        }
        
        # Extract fraud indicators
        fraud_info = click.get('fraud_indicators', {})
        if not fraud_info or not isinstance(fraud_info, dict):
            fraud_info = {}
        
        fraud_response = {
            'fraud_score': fraud_info.get('fraud_score') or click.get('fraud_score', 0),
            'fraud_status': fraud_info.get('fraud_status') or click.get('fraud_status', 'clean'),
            'duplicate_click': fraud_info.get('duplicate_click') or click.get('is_duplicate', False),
            'fast_click': fraud_info.get('fast_click', False),
            'bot_like': fraud_info.get('bot_like', False),
            'vpn_detected': fraud_info.get('vpn_detected') or network_response.get('vpn_detected', False),
            'proxy_detected': fraud_info.get('proxy_detected') or network_response.get('proxy_detected', False),
            'tor_detected': fraud_info.get('tor_detected') or network_response.get('tor_detected', False),
        }
        
        # Extract fingerprint info
        fingerprint_info = click.get('fingerprint', {})
        if not fingerprint_info or not isinstance(fingerprint_info, dict):
            fingerprint_info = {}
        
        fingerprint_response = {
            'user_agent_hash': fingerprint_info.get('user_agent_hash'),
            'user_agent': fingerprint_info.get('user_agent') or click.get('user_agent'),
            'canvas': fingerprint_info.get('canvas_fingerprint'),
            'webgl': fingerprint_info.get('webgl_fingerprint'),
            'fonts': fingerprint_info.get('fonts_fingerprint'),
            'plugins': fingerprint_info.get('plugins_fingerprint'),
        }

        response = {
            'click_id': click.get('click_id') or click.get('conversion_id'),
            'user_id': click.get('user_id'),
            'publisher_id': publisher_id or click.get('publisher_id') or 'unknown',
            'publisher_name': publisher_name,
            'offer_id': click.get('offer_id'),
            'offer_name': click.get('offer_name') or click.get('data', {}).get('offer_name', 'Unknown Offer'),
            'placement_id': click.get('placement_id'),
            'session_id': click.get('session_id'),
            'timestamp': click.get('timestamp').isoformat() if click.get('timestamp') else None,
            'event_type': event_type,
            'source_collection': source_collection,
            
            # Conversion-specific fields
            'payout_amount': click.get('payout_amount'),
            'points_awarded': click.get('points_awarded'),
            
            'device': device_response,
            'fingerprint': fingerprint_response,
            'network': network_response,
            'geo': geo_response,
            'fraud_indicators': fraud_response,
        }
        
        return jsonify({
            'success': True,
            'data': response
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error getting click details: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@comprehensive_analytics_bp.route('/api/admin/offerwall/user-click-timeline/<user_id>', methods=['GET'])
def get_user_click_timeline(user_id):
    """Get timeline of all clicks by a specific user"""
    try:
        limit = int(request.args.get('limit', 100))
        
        clicks_col = db_instance.get_collection('offerwall_clicks_detailed')
        clicks_basic_col = db_instance.get_collection('offerwall_clicks')
        
        # Get all clicks for this user from detailed collection
        clicks = list(clicks_col.find({'user_id': user_id})
                     .sort('timestamp', -1)
                     .limit(limit))
        
        # If no clicks in detailed, try basic collection
        if not clicks:
            clicks = list(clicks_basic_col.find({'user_id': user_id})
                         .sort('timestamp', -1)
                         .limit(limit))
        
        # Format as timeline
        timeline = []
        for click in clicks:
            timeline.append({
                'click_id': click.get('click_id'),
                'offer_id': click.get('offer_id'),
                'offer_name': click.get('offer_name') or click.get('data', {}).get('offer_name', 'Unknown Offer'),
                'publisher_id': click.get('publisher_id'),
                'timestamp': click.get('timestamp').isoformat() if click.get('timestamp') else None,
                'device_type': click.get('device', {}).get('type') or click.get('device_type'),
                'country': click.get('geo', {}).get('country') or click.get('country'),
                'city': click.get('geo', {}).get('city') or click.get('city'),
                'ip_address': click.get('network', {}).get('ip_address') or click.get('ip_address'),
                'fraud_status': click.get('fraud_indicators', {}).get('fraud_status') or click.get('fraud_status', 'clean'),
            })
        
        return jsonify({
            'success': True,
            'user_id': user_id,
            'total_clicks': len(timeline),
            'timeline': timeline
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error getting user timeline: {e}")
        return jsonify({'error': str(e)}), 500


@comprehensive_analytics_bp.route('/api/admin/offerwall/publisher-click-timeline/<publisher_id>', methods=['GET'])
def get_publisher_click_timeline(publisher_id):
    """Get timeline of all clicks for a specific publisher"""
    try:
        limit = int(request.args.get('limit', 100))
        
        clicks_col = db_instance.get_collection('offerwall_clicks_detailed')
        clicks_basic_col = db_instance.get_collection('offerwall_clicks')
        
        # Get all clicks for this publisher from detailed collection
        clicks = list(clicks_col.find({'publisher_id': publisher_id})
                     .sort('timestamp', -1)
                     .limit(limit))
        
        # If no clicks in detailed, try basic collection
        if not clicks:
            clicks = list(clicks_basic_col.find({'publisher_id': publisher_id})
                         .sort('timestamp', -1)
                         .limit(limit))
        
        # Format as timeline
        timeline = []
        for click in clicks:
            timeline.append({
                'click_id': click.get('click_id'),
                'user_id': click.get('user_id'),
                'offer_id': click.get('offer_id'),
                'offer_name': click.get('offer_name') or click.get('data', {}).get('offer_name', 'Unknown Offer'),
                'timestamp': click.get('timestamp').isoformat() if click.get('timestamp') else None,
                'device_type': click.get('device', {}).get('type') or click.get('device_type'),
                'country': click.get('geo', {}).get('country') or click.get('country'),
                'city': click.get('geo', {}).get('city') or click.get('city'),
                'ip_address': click.get('network', {}).get('ip_address') or click.get('ip_address'),
                'fraud_status': click.get('fraud_indicators', {}).get('fraud_status') or click.get('fraud_status', 'clean'),
            })
        
        return jsonify({
            'success': True,
            'publisher_id': publisher_id,
            'total_clicks': len(timeline),
            'timeline': timeline
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error getting publisher timeline: {e}")
        return jsonify({'error': str(e)}), 500


# ============================================================================
# DASHBOARD CLICK TRACKING ENDPOINTS (Offers Page Clicks)
# ============================================================================

@comprehensive_analytics_bp.route('/api/dashboard/track-click', methods=['POST'])
def track_dashboard_click():
    """Track a click from the dashboard/offers page (not offerwall)"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Required fields
        offer_id = data.get('offer_id')
        user_id = data.get('user_id')
        
        if not offer_id:
            return jsonify({'error': 'offer_id is required'}), 400
        
        # Get real client IP from headers (handle proxies/load balancers)
        ip_address = None
        # Try multiple headers in order of preference
        ip_headers = [
            'HTTP_X_FORWARDED_FOR',
            'HTTP_X_REAL_IP', 
            'HTTP_CF_CONNECTING_IP',  # Cloudflare
            'HTTP_TRUE_CLIENT_IP',    # Akamai
            'REMOTE_ADDR'
        ]
        
        for header in ip_headers:
            ip_value = request.environ.get(header)
            if ip_value:
                # X-Forwarded-For can contain multiple IPs, take the first (client IP)
                if ',' in ip_value:
                    ip_address = ip_value.split(',')[0].strip()
                else:
                    ip_address = ip_value.strip()
                logger.info(f"📍 Got IP from {header}: {ip_address}")
                break
        
        if not ip_address:
            ip_address = request.remote_addr or '0.0.0.0'
            logger.warning(f"⚠️ Using fallback IP: {ip_address}")
        
        user_agent = request.headers.get('User-Agent', '')
        
        # Generate click ID
        import secrets
        click_id = f"DASH-{secrets.token_hex(8).upper()}"
        
        # Get IP location info using IPinfo service
        geo_data = {
            'country': '',
            'country_code': '',
            'region': '',
            'city': '',
            'postal_code': '',
            'latitude': None,
            'longitude': None,
            'timezone': '',
        }
        network_data = {
            'ip_address': ip_address,
            'asn': '',
            'isp': '',
            'organization': '',
            'vpn_detected': False,
            'proxy_detected': False,
            'tor_detected': False,
            'datacenter_detected': False,
        }
        
        try:
            from services.ipinfo_service import get_ipinfo_service
            ipinfo_service = get_ipinfo_service()
            ip_info = ipinfo_service.lookup_ip(ip_address)
            
            if ip_info:
                logger.info(f"✅ IPinfo lookup successful for {ip_address}: {ip_info.get('city')}, {ip_info.get('country')}")
                
                geo_data = {
                    'country': ip_info.get('country', ''),
                    'country_code': ip_info.get('country_code', ''),
                    'region': ip_info.get('region', ''),
                    'city': ip_info.get('city', ''),
                    'postal_code': ip_info.get('zip_code', ''),
                    'latitude': ip_info.get('latitude'),
                    'longitude': ip_info.get('longitude'),
                    'timezone': ip_info.get('time_zone', ''),
                }
                
                vpn_detection = ip_info.get('vpn_detection', {})
                network_data = {
                    'ip_address': ip_address,
                    'asn': ip_info.get('asn', ''),
                    'isp': ip_info.get('isp', ''),
                    'organization': ip_info.get('org', ''),
                    'vpn_detected': vpn_detection.get('is_vpn', False),
                    'proxy_detected': vpn_detection.get('is_proxy', False),
                    'tor_detected': vpn_detection.get('is_tor', False),
                    'datacenter_detected': vpn_detection.get('is_datacenter', False),
                }
            else:
                logger.warning(f"⚠️ IPinfo returned no data for {ip_address}")
        except Exception as e:
            logger.error(f"❌ Failed to get IP info: {e}", exc_info=True)
        
        # Detect device info from user agent
        device_data = {
            'type': 'desktop',
            'browser': 'unknown',
            'os': 'unknown',
        }
        
        ua_lower = user_agent.lower()
        if any(m in ua_lower for m in ['mobile', 'android', 'iphone', 'ipad']):
            device_data['type'] = 'mobile'
        elif 'tablet' in ua_lower:
            device_data['type'] = 'tablet'
        
        if 'chrome' in ua_lower and 'edg' not in ua_lower:
            device_data['browser'] = 'Chrome'
        elif 'firefox' in ua_lower:
            device_data['browser'] = 'Firefox'
        elif 'safari' in ua_lower and 'chrome' not in ua_lower:
            device_data['browser'] = 'Safari'
        elif 'edg' in ua_lower:
            device_data['browser'] = 'Edge'
        
        if 'windows' in ua_lower:
            device_data['os'] = 'Windows'
        elif 'mac' in ua_lower:
            device_data['os'] = 'macOS'
        elif 'linux' in ua_lower and 'android' not in ua_lower:
            device_data['os'] = 'Linux'
        elif 'android' in ua_lower:
            device_data['os'] = 'Android'
        elif 'iphone' in ua_lower or 'ipad' in ua_lower:
            device_data['os'] = 'iOS'
        
        # Determine fraud status based on VPN/proxy detection
        fraud_status = 'clean'
        fraud_score = 0
        if network_data.get('tor_detected'):
            fraud_status = 'suspicious'
            fraud_score = 80
        elif network_data.get('proxy_detected'):
            fraud_status = 'suspicious'
            fraud_score = 60
        elif network_data.get('vpn_detected'):
            fraud_status = 'suspicious'
            fraud_score = 40
        elif network_data.get('datacenter_detected'):
            fraud_status = 'suspicious'
            fraud_score = 30
        
        # Create click record
        click_record = {
            'click_id': click_id,
            'source': 'dashboard',  # Key differentiator from offerwall clicks
            'offer_id': offer_id,
            'offer_name': data.get('offer_name', ''),
            'user_id': user_id,
            'user_email': data.get('user_email', ''),
            'user_role': data.get('user_role', ''),
            'timestamp': datetime.utcnow(),
            'device': device_data,
            'network': network_data,
            'geo': geo_data,
            'user_agent': user_agent,
            'referrer': request.headers.get('Referer', ''),
            'fraud_indicators': {
                'fraud_status': fraud_status,
                'fraud_score': fraud_score,
                'vpn_detected': network_data.get('vpn_detected', False),
                'proxy_detected': network_data.get('proxy_detected', False),
                'tor_detected': network_data.get('tor_detected', False),
                'datacenter_detected': network_data.get('datacenter_detected', False),
                'duplicate_click': False,
                'fast_click': False,
                'bot_like': False,
            },
        }
        
        # Insert into dashboard_clicks collection
        dashboard_clicks_col = db_instance.get_collection('dashboard_clicks')
        result = dashboard_clicks_col.insert_one(click_record)
        
        logger.info(f"✅ Dashboard click tracked: {click_id} | Offer: {offer_id} | User: {user_id} | IP: {ip_address} | Location: {geo_data.get('city')}, {geo_data.get('country')}")
        
        return jsonify({
            'success': True,
            'click_id': click_id,
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error tracking dashboard click: {e}")
        return jsonify({'error': str(e)}), 500


@comprehensive_analytics_bp.route('/api/admin/dashboard/click-history', methods=['GET'])
@token_required
@subadmin_or_admin_required('comprehensive-analytics')
def get_dashboard_click_history():
    """Get click history from dashboard/offers page (not offerwall)"""
    try:
        limit = int(request.args.get('limit', 50))
        skip = int(request.args.get('skip', 0))
        user_id = request.args.get('user_id')
        offer_id = request.args.get('offer_id')
        
        filters = {'source': 'dashboard'}
        if user_id:
            filters['user_id'] = user_id
        if offer_id:
            filters['offer_id'] = offer_id
        
        dashboard_clicks_col = db_instance.get_collection('dashboard_clicks')
        
        # Get total count
        total = dashboard_clicks_col.count_documents(filters)
        
        # Get clicks
        clicks = list(dashboard_clicks_col.find(filters)
                     .sort('timestamp', -1)
                     .skip(skip)
                     .limit(limit))
        
        # Format response
        formatted_clicks = []
        for click in clicks:
            formatted_clicks.append({
                'click_id': click.get('click_id'),
                'user_id': click.get('user_id'),
                'user_email': click.get('user_email'),
                'user_role': click.get('user_role'),
                'offer_id': click.get('offer_id'),
                'offer_name': click.get('offer_name'),
                'timestamp': click.get('timestamp').isoformat() if click.get('timestamp') else None,
                'device': click.get('device', {}),
                'network': click.get('network', {}),
                'geo': click.get('geo', {}),
                'fraud_indicators': click.get('fraud_indicators', {}),
                'source': 'dashboard',
            })
        
        return jsonify({
            'success': True,
            'total': total,
            'limit': limit,
            'skip': skip,
            'data': formatted_clicks
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error getting dashboard click history: {e}")
        return jsonify({'error': str(e)}), 500


@comprehensive_analytics_bp.route('/api/admin/dashboard/click-details/<click_id>', methods=['GET'])
@token_required
@subadmin_or_admin_required('comprehensive-analytics')
def get_dashboard_click_details(click_id):
    """Get detailed information about a specific dashboard click"""
    try:
        dashboard_clicks_col = db_instance.get_collection('dashboard_clicks')
        click = dashboard_clicks_col.find_one({'click_id': click_id})
        
        if not click:
            return jsonify({'error': 'Click not found'}), 404
        
        # Format response with all details matching the frontend expectations
        response = {
            'click_id': click.get('click_id'),
            'source': 'dashboard',
            'user_id': click.get('user_id'),
            'user_email': click.get('user_email'),
            'user_role': click.get('user_role'),
            'publisher_id': click.get('user_id'),  # For dashboard clicks, user is the "publisher"
            'publisher_name': click.get('user_email', 'Unknown'),
            'offer_id': click.get('offer_id'),
            'offer_name': click.get('offer_name'),
            'placement_id': 'dashboard',
            'timestamp': click.get('timestamp').isoformat() if click.get('timestamp') else None,
            
            'device': {
                'type': click.get('device', {}).get('type'),
                'model': click.get('device', {}).get('model'),
                'os': click.get('device', {}).get('os'),
                'os_version': click.get('device', {}).get('os_version'),
                'browser': click.get('device', {}).get('browser'),
                'browser_version': click.get('device', {}).get('browser_version'),
                'screen_resolution': click.get('device', {}).get('screen_resolution'),
                'screen_dpi': click.get('device', {}).get('screen_dpi'),
                'timezone': click.get('geo', {}).get('timezone'),
                'language': click.get('device', {}).get('language'),
            },
            
            'fingerprint': {
                'user_agent_hash': None,
                'canvas': None,
                'webgl': None,
                'fonts': None,
                'plugins': None,
            },
            
            'network': {
                'ip_address': click.get('network', {}).get('ip_address'),
                'ip_version': 'IPv4' if '.' in click.get('network', {}).get('ip_address', '') else 'IPv6',
                'asn': click.get('network', {}).get('asn'),
                'isp': click.get('network', {}).get('isp'),
                'organization': click.get('network', {}).get('organization'),
                'proxy_detected': click.get('network', {}).get('proxy_detected', False),
                'vpn_detected': click.get('network', {}).get('vpn_detected', False),
                'tor_detected': click.get('network', {}).get('tor_detected', False),
                'datacenter_detected': click.get('network', {}).get('datacenter_detected', False),
                'connection_type': click.get('network', {}).get('connection_type'),
            },
            
            'geo': {
                'country': click.get('geo', {}).get('country'),
                'country_code': click.get('geo', {}).get('country_code'),
                'region': click.get('geo', {}).get('region'),
                'city': click.get('geo', {}).get('city'),
                'postal_code': click.get('geo', {}).get('postal_code'),
                'latitude': click.get('geo', {}).get('latitude'),
                'longitude': click.get('geo', {}).get('longitude'),
                'timezone': click.get('geo', {}).get('timezone'),
            },
            
            'fraud_indicators': {
                'duplicate_detected': click.get('fraud_indicators', {}).get('duplicate_click', False),
                'fast_click': click.get('fraud_indicators', {}).get('fast_click', False),
                'vpn_proxy': click.get('fraud_indicators', {}).get('vpn_detected', False) or click.get('fraud_indicators', {}).get('proxy_detected', False),
                'bot_like': click.get('fraud_indicators', {}).get('bot_like', False),
                'fraud_score': click.get('fraud_indicators', {}).get('fraud_score', 0),
                'fraud_status': click.get('fraud_indicators', {}).get('fraud_status', 'clean'),
                'vpn_detected': click.get('fraud_indicators', {}).get('vpn_detected', False),
                'proxy_detected': click.get('fraud_indicators', {}).get('proxy_detected', False),
                'tor_detected': click.get('fraud_indicators', {}).get('tor_detected', False),
                'datacenter_detected': click.get('fraud_indicators', {}).get('datacenter_detected', False),
            },
            
            'user_agent': click.get('user_agent', ''),
            'referrer': click.get('referrer', ''),
        }
        
        return jsonify({
            'success': True,
            'data': response
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error getting dashboard click details: {e}")
        return jsonify({'error': str(e)}), 500


@comprehensive_analytics_bp.route('/api/admin/offerwall/fraud-signals/<signal_id>', methods=['PUT'])
@token_required
@subadmin_or_admin_required('comprehensive-analytics')
def update_fraud_signal(signal_id):
    """Update fraud signal status (mark as false positive or confirm fraud)"""
    try:
        from bson import ObjectId
        
        data = request.get_json()
        status = data.get('status')  # 'false_positive' or 'confirmed'
        
        if not status:
            return jsonify({'error': 'Status is required'}), 400
        
        # Update the fraud signal
        fraud_col = db_instance.get_collection('fraud_signals')
        
        # Try to convert to ObjectId
        signal_id_obj = None
        try:
            signal_id_obj = ObjectId(signal_id)
            logger.info(f"Converted signal_id to ObjectId: {signal_id_obj}")
        except Exception as e:
            logger.warning(f"Failed to convert signal_id to ObjectId: {e}, using string: {signal_id}")
            signal_id_obj = signal_id
        
        logger.info(f"Updating fraud signal with _id: {signal_id_obj}")
        
        result = fraud_col.update_one(
            {'_id': signal_id_obj},
            {
                '$set': {
                    'status': status,
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        logger.info(f"Update result - matched: {result.matched_count}, modified: {result.modified_count}")
        
        if result.matched_count == 0:
            logger.error(f"Signal not found with _id: {signal_id_obj}")
            return jsonify({'error': 'Signal not found'}), 404
        
        return jsonify({
            'success': True,
            'message': f'Signal marked as {status}',
            'signal_id': str(signal_id)
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error updating fraud signal: {e}")
        return jsonify({'error': str(e)}), 500
