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
        
        clicks_col = db_instance.get_collection('offerwall_clicks_detailed')
        
        # Get total count
        total = clicks_col.count_documents(filters)
        
        # Get clicks with all details
        clicks = list(clicks_col.find(filters)
                     .sort('timestamp', -1)
                     .skip(skip)
                     .limit(limit))
        
        # Format response for clicks
        formatted_clicks = []
        for click in clicks:
            formatted_clicks.append({
                'click_id': click.get('click_id'),
                'user_id': click.get('user_id'),
                'publisher_id': click.get('publisher_id'),
                'publisher_name': click.get('publisher_name', 'Unknown'),
                'offer_id': click.get('offer_id'),
                'offer_name': click.get('offer_name'),
                'placement_id': click.get('placement_id'),
                'timestamp': click.get('timestamp').isoformat() if click.get('timestamp') else None,
                'device': click.get('device', {}),
                'network': click.get('network', {}),
                'geo': click.get('geo', {}),
                'fraud_indicators': click.get('fraud_indicators', {}),
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
        # Try to find in clicks first
        clicks_col = db_instance.get_collection('offerwall_clicks_detailed')
        click = clicks_col.find_one({'click_id': click_id})
        
        # If not found, try conversions
        if not click:
            conversions_col = db_instance.get_collection('offerwall_conversions')
            click = conversions_col.find_one({'conversion_id': click_id})
            if click:
                # Mark as conversion
                click['event_type'] = 'conversion'
        
        if not click:
            return jsonify({'error': 'Click/Conversion not found'}), 404
        
        # Format response with all details
        event_type = click.get('event_type', 'click')
        
        # Get publisher name if not in click data
        publisher_name = click.get('publisher_name', 'Unknown')
        publisher_id = click.get('publisher_id')
        
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
            
            # Conversion-specific fields
            'payout_amount': click.get('payout_amount'),
            'points_awarded': click.get('points_awarded'),
            
            'device': {
                'type': click.get('device', {}).get('type'),
                'model': click.get('device', {}).get('model'),
                'os': click.get('device', {}).get('os'),
                'os_version': click.get('device', {}).get('os_version'),
                'browser': click.get('device', {}).get('browser'),
                'browser_version': click.get('device', {}).get('browser_version'),
                'screen_resolution': click.get('device', {}).get('screen_resolution'),
                'screen_dpi': click.get('device', {}).get('screen_dpi'),
                'timezone': click.get('device', {}).get('timezone'),
                'language': click.get('device', {}).get('language'),
            },
            
            'fingerprint': {
                'user_agent_hash': click.get('fingerprint', {}).get('user_agent_hash'),
                'canvas': click.get('fingerprint', {}).get('canvas'),
                'webgl': click.get('fingerprint', {}).get('webgl'),
                'fonts': click.get('fingerprint', {}).get('fonts'),
                'plugins': click.get('fingerprint', {}).get('plugins'),
            },
            
            'network': click.get('network', {}),
            
            'geo': click.get('geo', {}),
            
            'fraud_indicators': click.get('fraud_indicators', {}),
        }
        
        return jsonify({
            'success': True,
            'data': response
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error getting click details: {e}")
        return jsonify({'error': str(e)}), 500


@comprehensive_analytics_bp.route('/api/admin/offerwall/user-click-timeline/<user_id>', methods=['GET'])
def get_user_click_timeline(user_id):
    """Get timeline of all clicks by a specific user"""
    try:
        limit = int(request.args.get('limit', 100))
        
        clicks_col = db_instance.get_collection('offerwall_clicks_detailed')
        
        # Get all clicks for this user
        clicks = list(clicks_col.find({'user_id': user_id})
                     .sort('timestamp', -1)
                     .limit(limit))
        
        # Format as timeline
        timeline = []
        for click in clicks:
            timeline.append({
                'click_id': click.get('click_id'),
                'offer_id': click.get('offer_id'),
                'offer_name': click.get('offer_name'),
                'publisher_id': click.get('publisher_id'),
                'timestamp': click.get('timestamp').isoformat() if click.get('timestamp') else None,
                'device_type': click.get('device', {}).get('type'),
                'country': click.get('geo', {}).get('country'),
                'city': click.get('geo', {}).get('city'),
                'ip_address': click.get('network', {}).get('ip_address'),
                'fraud_status': click.get('fraud_indicators', {}).get('fraud_status'),
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
        
        # Get all clicks for this publisher
        clicks = list(clicks_col.find({'publisher_id': publisher_id})
                     .sort('timestamp', -1)
                     .limit(limit))
        
        # Format as timeline
        timeline = []
        for click in clicks:
            timeline.append({
                'click_id': click.get('click_id'),
                'user_id': click.get('user_id'),
                'offer_id': click.get('offer_id'),
                'offer_name': click.get('offer_name'),
                'timestamp': click.get('timestamp').isoformat() if click.get('timestamp') else None,
                'device_type': click.get('device', {}).get('type'),
                'country': click.get('geo', {}).get('country'),
                'city': click.get('geo', {}).get('city'),
                'ip_address': click.get('network', {}).get('ip_address'),
                'fraud_status': click.get('fraud_indicators', {}).get('fraud_status'),
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
