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
        
        # Fetch user early to get all possible identifiers (id, email, username)
        user_identifiers = [user_id]
        user_obj = None
        if 'users' in db.list_collection_names():
            try:
                from bson import ObjectId
                user_obj = db.users.find_one({'$or': [{'_id': ObjectId(user_id)}, {'email': user_id}, {'username': user_id}]})
            except:
                user_obj = db.users.find_one({'$or': [{'_id': user_id}, {'email': user_id}, {'username': user_id}]})
            
            if user_obj:
                user_identifiers.append(str(user_obj.get('_id')))
                if user_obj.get('email'): user_identifiers.append(user_obj.get('email'))
                if user_obj.get('username'): user_identifiers.append(user_obj.get('username'))
        
        # Deduplicate identifiers
        user_identifiers = list(set(user_identifiers))
        query_filter = {'$or': [{'user_id': {'$in': user_identifiers}}, {'email': {'$in': user_identifiers}}, {'username': {'$in': user_identifiers}}]}
        
        # Requests and Approvals count
        if 'affiliate_requests' in db.list_collection_names():
            signals['signal_breakdown']['requests'] = db.affiliate_requests.count_documents(query_filter)
            signals['signal_breakdown']['approvals'] = db.affiliate_requests.count_documents({'$and': [query_filter, {'status': 'approved'}]})
            
        # Views and Clicks count
        if 'offer_views' in db.list_collection_names():
            signals['signal_breakdown']['views'] = db.offer_views.count_documents({'$and': [query_filter, {'clicked': {'$ne': True}}]})
            # Count clicks inside offer_views
            click_count = db.offer_views.count_documents({'$and': [query_filter, {'clicked': True}]})
            signals['signal_breakdown']['clicks'] = click_count
            
        # Add pure clicks from clicks collection
        for click_col in ('clicks', 'offerwall_clicks', 'offerwall_clicks_detailed'):
            if click_col in db.list_collection_names():
                signals['signal_breakdown']['clicks'] = signals['signal_breakdown'].get('clicks', 0) + db[click_col].count_documents(query_filter)
        
        # Calculate Top Categories and Geos from tracking_events, offer_views, and login_logs
        category_counts = {}
        geo_counts = {}
        

        
        # 1. Geo tracking from login_logs
        if 'login_logs' in db.list_collection_names():
            logs = list(db.login_logs.find(query_filter).limit(100))
            for log in logs:
                loc = log.get('location', {})
                if isinstance(loc, dict):
                    country = loc.get('country') or loc.get('country_code') or loc.get('city')
                    if country and str(country).lower() != 'unknown' and country != 'XX':
                        geo_counts[country] = geo_counts.get(country, 0) + 1

        # 2. Category tracking from offer_views
        if 'offer_views' in db.list_collection_names():
            views_data = list(db.offer_views.find({'user_id': {'$in': user_identifiers}}).limit(100))
            for view in views_data:
                # Offer views might have category in 'offer_details' or we can fetch the offer
                cat = view.get('category') or view.get('offer_details', {}).get('category')
                if not cat and view.get('offer_id'):
                    offer = db.offers.find_one({'offer_id': view.get('offer_id')})
                    if offer:
                        cat = offer.get('category')
                
                if cat and str(cat).lower() != 'unknown':
                    category_counts[cat] = category_counts.get(cat, 0) + 1

        # 3. Aggregate tracking_events as well
        if 'tracking_events' in db.list_collection_names():
            events = list(db.tracking_events.find({'user_id': {'$in': user_identifiers}}).limit(100))
            for event in events:
                loc = event.get('location', {})
                if isinstance(loc, dict):
                    country = loc.get('country_code') or loc.get('country')
                    if country and str(country).lower() != 'unknown' and country != 'XX':
                        geo_counts[country] = geo_counts.get(country, 0) + 1
                    
                offer_id = event.get('offer_id')
                if offer_id:
                    offer = db.offers.find_one({'offer_id': offer_id})
                    if offer and offer.get('category'):
                        cat = offer.get('category')
                        if cat and str(cat).lower() != 'unknown':
                            category_counts[cat] = category_counts.get(cat, 0) + 1
        
        top_cats = sorted(category_counts.items(), key=lambda x: x[1], reverse=True)[:3]
        signals['top_categories'] = [c[0] for c in top_cats]
        
        top_geos = sorted(geo_counts.items(), key=lambda x: x[1], reverse=True)[:3]
        signals['top_geos'] = [g[0] for g in top_geos]
        
        # If still empty, fall back to the user's signup profile data
        if not top_cats or not top_geos:
            if 'users' in db.list_collection_names():
                # We might need to query by string ID or ObjectId
                try:
                    from bson import ObjectId
                    user = db.users.find_one({'$or': [{'_id': ObjectId(user_id)}, {'email': user_id}, {'username': user_id}]})
                except:
                    user = db.users.find_one({'$or': [{'_id': user_id}, {'email': user_id}, {'username': user_id}]})
                    
                if user:
                    if not top_cats and user.get('verticals'):
                        signals['top_categories'] = user.get('verticals')[:3]
                    if not top_geos and user.get('geos'):
                        signals['top_geos'] = user.get('geos')[:3]
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
        email_query = {}
        if user_id:
            from models.user import User
            user = User().find_by_id(user_id)
            if user:
                query['recipients'] = user.get('email')
                email_query['to'] = {'$regex': f"^{user.get('email')}$", '$options': 'i'}
                
        activities = []
        docs = list(db.scheduled_emails.find(query).sort('scheduled_at', -1).limit(20))
        for doc in docs:
            activities.append({
                '_id': str(doc['_id']),
                'type': 'email',
                'subject': doc.get('subject', ''),
                'status': doc.get('status', 'scheduled'),
                'scheduled_at': doc.get('scheduled_at').isoformat() + 'Z' if doc.get('scheduled_at') else None
            })
                
        if email_query:
            sent_docs = list(db.login_logs_mail_history.find(email_query).sort('sent_at', -1).limit(20))
            for doc in sent_docs:
                activities.append({
                    '_id': str(doc['_id']),
                    'type': 'email',
                    'subject': doc.get('subject', ''),
                    'status': doc.get('status', 'sent'),
                    'sent_at': doc.get('sent_at').isoformat() + 'Z' if doc.get('sent_at') else None
                })
                
        if user_id:
            # Execute two separate queries instead of $or to avoid MongoDB query planner issues
            docs1 = list(db.offer_send_history.find({'user_id': user_id}).sort('created_at', -1).limit(20))
            docs2 = list(db.offer_send_history.find({'recipient_user_ids': user_id}).sort('created_at', -1).limit(20))
            
            # Merge and deduplicate by _id
            merged_docs = {str(d['_id']): d for d in docs1 + docs2}
            offer_docs = list(merged_docs.values())
            
            # Sort the combined result
            offer_docs.sort(key=lambda x: x.get('created_at') if x.get('created_at') else datetime.min, reverse=True)
            offer_docs = offer_docs[:20]
            
            for doc in offer_docs:
                activities.append({
                    '_id': str(doc['_id']),
                    'type': doc.get('send_via', 'email'),
                    'subject': doc.get('subject', f"Sent {doc.get('offer_count', 1)} offer(s)"),
                    'offer_count': doc.get('offer_count', 0),
                    'offer_names': doc.get('offer_names', []),
                    'status': 'sent',
                    'sent_at': doc.get('created_at').isoformat() + 'Z' if doc.get('created_at') else None
                })
                
        # Sort combined
        activities.sort(key=lambda x: x.get('scheduled_at') or x.get('sent_at') or '', reverse=True)
        return jsonify({'activities': activities[:20]}), 200
    except Exception as e:
        logging.error(f"Error getting scheduled activity: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_activity_logs_bp.route('/scheduled-activity/<activity_id>', methods=['DELETE'])
@token_required
def delete_scheduled_activity(activity_id):
    try:
        from bson import ObjectId
        from database import db_instance
        db = db_instance.get_db()
        result = db.scheduled_emails.delete_one({'_id': ObjectId(activity_id)})
        if result.deleted_count > 0:
            return jsonify({'success': True}), 200
        return jsonify({'error': 'Not found'}), 404
    except Exception as e:
        logging.error(f"Error deleting scheduled activity: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@admin_activity_logs_bp.route('/scheduled-activity/<activity_id>', methods=['PUT'])
@token_required
def update_scheduled_activity(activity_id):
    try:
        from bson import ObjectId
        from database import db_instance
        from datetime import datetime, timezone
        db = db_instance.get_db()
        data = request.get_json()
        if 'scheduled_at' in data:
            scheduled_datetime = datetime.fromisoformat(data['scheduled_at'].replace('Z', '+00:00'))
            if scheduled_datetime.tzinfo is not None:
                scheduled_datetime = scheduled_datetime.astimezone(timezone.utc).replace(tzinfo=None)
            data['scheduled_at'] = scheduled_datetime
            
        result = db.scheduled_emails.update_one({'_id': ObjectId(activity_id)}, {'$set': data})
        if result.modified_count > 0 or result.matched_count > 0:
            return jsonify({'success': True}), 200
        return jsonify({'error': 'Not found'}), 404
    except Exception as e:
        logging.error(f"Error updating scheduled activity: {str(e)}", exc_info=True)
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
