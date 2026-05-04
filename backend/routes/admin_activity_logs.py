"""
Admin Activity Logs Route
API endpoints for viewing and managing admin activity logs
"""

from flask import Blueprint, request, jsonify
from models.admin_activity_log import AdminActivityLog
from utils.auth import token_required, subadmin_or_admin_required
from datetime import datetime
import logging

admin_activity_logs_bp = Blueprint('admin_activity_logs', __name__)
log_model = AdminActivityLog()


@admin_activity_logs_bp.route('/activity-logs', methods=['GET'])
@token_required
@subadmin_or_admin_required('fraud-management')
def get_activity_logs():
    """Get paginated, filtered activity logs"""
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 25))
        category = request.args.get('category', '')
        action = request.args.get('action', '')
        admin_username = request.args.get('admin', '')
        network = request.args.get('network', '')
        search = request.args.get('search', '')
        date_from = request.args.get('date_from', '')
        date_to = request.args.get('date_to', '')
        sort_field = request.args.get('sort_field', 'timestamp')
        sort_order = int(request.args.get('sort_order', -1))

        filters = {}
        if category:
            filters['category'] = category
        if action:
            filters['action'] = action
        if admin_username:
            filters['admin_username'] = admin_username
        if network:
            filters['network'] = network
        if search:
            filters['search'] = search
        if date_from:
            try:
                filters['date_from'] = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
            except ValueError:
                pass
        if date_to:
            try:
                filters['date_to'] = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
            except ValueError:
                pass

        logs, total = log_model.get_logs(
            filters=filters,
            page=page,
            per_page=per_page,
            sort_field=sort_field,
            sort_order=sort_order
        )

        return jsonify({
            'success': True,
            'logs': logs,
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': (total + per_page - 1) // per_page
        }), 200

    except Exception as e:
        logging.error(f"Get activity logs error: {e}", exc_info=True)
        return jsonify({'error': f'Failed to get activity logs: {str(e)}'}), 500


@admin_activity_logs_bp.route('/activity-logs', methods=['DELETE'])
@token_required
@subadmin_or_admin_required('fraud-management')
def delete_activity_logs():
    """Delete selected activity logs"""
    try:
        data = request.get_json()
        log_ids = data.get('log_ids', [])

        if not log_ids:
            return jsonify({'error': 'No log IDs provided'}), 400

        deleted = log_model.delete_logs(log_ids)

        return jsonify({
            'success': True,
            'deleted_count': deleted,
            'message': f'{deleted} log(s) deleted successfully'
        }), 200

    except Exception as e:
        logging.error(f"Delete activity logs error: {e}", exc_info=True)
        return jsonify({'error': f'Failed to delete logs: {str(e)}'}), 500


@admin_activity_logs_bp.route('/activity-logs/filters', methods=['GET'])
@token_required
@subadmin_or_admin_required('fraud-management')
def get_filter_options():
    """Get distinct filter values for dropdowns"""
    try:
        options = log_model.get_filter_options()
        return jsonify({'success': True, **options}), 200
    except Exception as e:
        logging.error(f"Get filter options error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_activity_logs_bp.route('/activity-logs/users-by-level', methods=['GET'])
@token_required
@subadmin_or_admin_required('fraud-management')
def get_users_by_level():
    """Get users filtered by level with their last 10 activities"""
    try:
        from models.user import User
        from bson import ObjectId
        
        level = request.args.get('level', '')
        if not level:
            return jsonify({'error': 'Level parameter required'}), 400
        
        user_model = User()
        users_collection = user_model.collection
        
        # Find users with the specified level
        users = list(users_collection.find(
            {'level': level, 'role': {'$ne': 'admin'}},
            {'password': 0}
        ).sort('created_at', -1))
        
        result_users = []
        for user in users:
            # Get last 10 activities for this user
            activities = list(log_model.collection.find(
                {'admin_username': user['username']}
            ).sort('timestamp', -1).limit(10))
            
            # Format activities
            formatted_activities = []
            for act in activities:
                formatted_activities.append({
                    'id': str(act['_id']),
                    'type': act.get('action', 'unknown'),
                    'offer': act.get('details', {}).get('offer_name', 'N/A'),
                    'timestamp': act['timestamp'].isoformat() if act.get('timestamp') else None,
                })
            
            result_users.append({
                'id': str(user['_id']),
                'username': user['username'],
                'email': user['email'],
                'level': user.get('level', 'N/A'),
                'activities': formatted_activities,
            })
        
        return jsonify({
            'success': True,
            'users': result_users,
        }), 200
    
    except Exception as e:
        logging.error(f"Get users by level error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


# ── Roopa's new endpoints for Recent Activity / User Intelligence ──

@admin_activity_logs_bp.route('/user-signals/<user_id>', methods=['GET'])
@token_required
def get_user_signals(user_id):
    try:
        from database import db_instance
        db = db_instance.get_db()
        signals = {
            'signal_breakdown': {'requests': 0, 'views': 0},
            'top_categories': [],
            'top_geos': []
        }
        
        # Requests count
        if 'affiliate_requests' in db.list_collection_names():
            signals['signal_breakdown']['requests'] = db.affiliate_requests.count_documents({'user_id': user_id})
            
        # Views count
        if 'offer_views' in db.list_collection_names():
            signals['signal_breakdown']['views'] = db.offer_views.count_documents({'user_id': user_id})
            
        # Calculate Top Categories and Geos from tracking_events
        category_counts = {}
        geo_counts = {}
        
        if 'tracking_events' in db.list_collection_names():
            events = list(db.tracking_events.find({'user_id': user_id}).limit(100))
            for event in events:
                loc = event.get('location', {})
                country = loc.get('country_code') or loc.get('country')
                if country and country != 'Unknown':
                    geo_counts[country] = geo_counts.get(country, 0) + 1
                    
                offer_id = event.get('offer_id')
                if offer_id:
                    offer = db.offers.find_one({'offer_id': offer_id})
                    if offer and offer.get('category'):
                        cat = offer.get('category')
                        category_counts[cat] = category_counts.get(cat, 0) + 1
        
        top_cats = sorted(category_counts.items(), key=lambda x: x[1], reverse=True)[:3]
        signals['top_categories'] = [c[0] for c in top_cats]
        
        top_geos = sorted(geo_counts.items(), key=lambda x: x[1], reverse=True)[:3]
        signals['top_geos'] = [g[0] for g in top_geos]
        
        if not signals['top_categories']:
            signals['top_categories'] = ['GAMES', 'INSTALL', 'INSURANCE']
        if not signals['top_geos']:
            signals['top_geos'] = ['US', 'UK', 'CA']
            
        return jsonify(signals), 200
    except Exception as e:
        logging.error(f"Error getting user signals: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_activity_logs_bp.route('/scheduled-activity', methods=['GET'])
@token_required
def get_scheduled_activity():
    try:
        user_id = request.args.get('user_id')
        from database import db_instance
        db = db_instance.get_db()
        
        query = {}
        if user_id:
            from models.user import User
            user = User().get_by_id(user_id)
            if user:
                query['recipients'] = user.get('email')
                
        activities = []
        if 'scheduled_emails' in db.list_collection_names():
            docs = list(db.scheduled_emails.find(query).sort('scheduled_at', -1).limit(20))
            for doc in docs:
                activities.append({
                    '_id': str(doc['_id']),
                    'type': 'email',
                    'subject': doc.get('subject', ''),
                    'status': doc.get('status', ''),
                    'scheduled_at': doc.get('scheduled_at').isoformat() + 'Z' if doc.get('scheduled_at') else None
                })
        return jsonify({'activities': activities}), 200
    except Exception as e:
        logging.error(f"Error getting scheduled activity: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_activity_logs_bp.route('/user-automations/<user_id>', methods=['GET', 'POST'])
@token_required
def handle_user_automations(user_id):
    try:
        from database import db_instance
        db = db_instance.get_db()
        
        if request.method == 'GET':
            if 'user_automations' in db.list_collection_names():
                auto = db.user_automations.find_one({'user_id': user_id})
                if auto:
                    auto['_id'] = str(auto['_id'])
                    return jsonify(auto), 200
            return jsonify({}), 200
            
        elif request.method == 'POST':
            data = request.get_json()
            db.user_automations.update_one(
                {'user_id': user_id},
                {'$set': data},
                upsert=True
            )
            return jsonify({'success': True}), 200
    except Exception as e:
        logging.error(f"Error handling automations: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500
