"""
Login Logs Routes
API endpoints for viewing and managing login logs and activity tracking
"""

from flask import Blueprint, request, jsonify
from models.login_logs import LoginLog
from models.page_visits import PageVisit
from models.active_sessions import ActiveSession
from utils.auth import token_required_with_user, admin_required, subadmin_or_admin_required
from utils.mongodb_json import mongodb_to_json
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

login_logs_bp = Blueprint('login_logs', __name__)

@login_logs_bp.route('/login-logs', methods=['GET'])
@token_required_with_user
@subadmin_or_admin_required('login-logs')
def get_login_logs(current_user):
    """Get login logs with filters and pagination"""
    try:
        # Get query parameters
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 100))
        status = request.args.get('status')
        user_id = request.args.get('user_id')
        email = request.args.get('email')
        login_method = request.args.get('login_method')
        ip_address = request.args.get('ip_address')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        sort_by = request.args.get('sort_by', 'login_time')
        sort_order = int(request.args.get('sort_order', -1))
        
        # Build filters
        filters = {}
        
        if status:
            filters['status'] = status
        
        if user_id:
            filters['user_id'] = user_id
        
        if email:
            filters['email'] = email
        
        if login_method:
            filters['login_method'] = login_method
        
        if ip_address:
            filters['ip_address'] = ip_address
        
        if start_date and end_date:
            try:
                filters['start_date'] = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                filters['end_date'] = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            except ValueError as e:
                return jsonify({'error': f'Invalid date format: {str(e)}'}), 400
        
        # Get login logs
        login_log_model = LoginLog()
        result = login_log_model.get_logs(
            filters=filters,
            page=page,
            limit=limit,
            sort_by=sort_by,
            sort_order=sort_order
        )
        
        # Convert MongoDB objects to JSON-serializable format
        result = mongodb_to_json(result)
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Error getting login logs: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get login logs: {str(e)}'}), 500


@login_logs_bp.route('/login-logs/<log_id>', methods=['GET'])
@token_required_with_user
@subadmin_or_admin_required('login-logs')
def get_login_log(current_user, log_id):
    """Get a specific login log by ID"""
    try:
        login_log_model = LoginLog()
        log = login_log_model.get_log_by_id(log_id)
        
        if not log:
            return jsonify({'error': 'Login log not found'}), 404
        
        return jsonify(mongodb_to_json(log)), 200
        
    except Exception as e:
        logger.error(f"Error getting login log: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get login log: {str(e)}'}), 500


@login_logs_bp.route('/login-logs/user/<user_id>', methods=['GET'])
@token_required_with_user
def get_user_login_history(current_user, user_id):
    """Get login history for a specific user"""
    try:
        # Users can only view their own history unless they're admin
        if current_user.get('role') != 'admin' and str(current_user.get('_id')) != user_id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        limit = int(request.args.get('limit', 50))
        
        login_log_model = LoginLog()
        logs = login_log_model.get_user_login_history(user_id, limit=limit)
        
        return jsonify({'logs': mongodb_to_json(logs)}), 200
        
    except Exception as e:
        logger.error(f"Error getting user login history: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get login history: {str(e)}'}), 500


@login_logs_bp.route('/login-logs/stats', methods=['GET'])
@token_required_with_user
@subadmin_or_admin_required('login-logs')
def get_login_stats(current_user):
    """Get login statistics"""
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # Parse dates if provided
        start_dt = None
        end_dt = None
        
        if start_date:
            try:
                start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            except ValueError:
                return jsonify({'error': 'Invalid start_date format'}), 400
        
        if end_date:
            try:
                end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            except ValueError:
                return jsonify({'error': 'Invalid end_date format'}), 400
        
        login_log_model = LoginLog()
        stats = login_log_model.get_stats(start_date=start_dt, end_date=end_dt)
        
        return jsonify(mongodb_to_json(stats)), 200
        
    except Exception as e:
        logger.error(f"Error getting login stats: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get login stats: {str(e)}'}), 500


@login_logs_bp.route('/login-logs/chart-data', methods=['GET'])
@token_required_with_user
@subadmin_or_admin_required('login-logs')
def get_login_chart_data(current_user):
    """Get login chart data: daily breakdown for last 7/14/30 days with hourly heatmap."""
    try:
        days = int(request.args.get('days', 7))
        # Support custom duration in minutes (30, 60, 120, or custom)
        duration_minutes = request.args.get('duration_minutes')
        custom_start = request.args.get('custom_start')
        custom_end = request.args.get('custom_end')
        
        from database import db_instance
        col = db_instance.get_collection('login_logs')
        if col is None:
            return jsonify({'error': 'Database connection failed'}), 500

        now = datetime.utcnow()
        
        # Determine time range
        if custom_start and custom_end:
            try:
                start = datetime.fromisoformat(custom_start.replace('Z', '+00:00')).replace(tzinfo=None)
                end_time = datetime.fromisoformat(custom_end.replace('Z', '+00:00')).replace(tzinfo=None)
                now = end_time
                days = max(1, (end_time - start).days or 1)
            except ValueError:
                start = now - timedelta(days=days)
        elif duration_minutes:
            mins = int(duration_minutes)
            start = now - timedelta(minutes=mins)
            # For short durations, we'll bucket by smaller intervals
        else:
            start = now - timedelta(days=days)

        # 1. Daily breakdown (or interval breakdown for short durations)
        use_interval = duration_minutes and int(duration_minutes) <= 240
        
        if use_interval:
            mins = int(duration_minutes)
            # Bucket into intervals: 5min for 30min, 10min for 1hr, 15min for 2hr
            if mins <= 30:
                bucket_mins = 5
            elif mins <= 60:
                bucket_mins = 10
            else:
                bucket_mins = 15
            
            # Use aggregation with date truncation
            interval_pipeline = [
                {'$match': {'login_time': {'$gte': start, '$lte': now}}},
                {'$group': {
                    '_id': {
                        'bucket': {
                            '$subtract': [
                                {'$toLong': '$login_time'},
                                {'$mod': [{'$toLong': '$login_time'}, bucket_mins * 60 * 1000]}
                            ]
                        },
                        'status': '$status'
                    },
                    'count': {'$sum': 1}
                }},
                {'$sort': {'_id.bucket': 1}}
            ]
            interval_raw = list(col.aggregate(interval_pipeline))
            
            daily_map = {}
            for d in interval_raw:
                ts = d['_id']['bucket']
                label = datetime.utcfromtimestamp(ts / 1000).strftime('%H:%M')
                status = d['_id'].get('status', 'unknown')
                if label not in daily_map:
                    daily_map[label] = {'date': label, 'success': 0, 'failed': 0, 'total': 0}
                if status == 'success':
                    daily_map[label]['success'] = d['count']
                else:
                    daily_map[label]['failed'] = d['count']
                daily_map[label]['total'] += d['count']
            
            daily = sorted(daily_map.values(), key=lambda x: x['date'])
        else:
            daily_pipeline = [
                {'$match': {'login_time': {'$gte': start, '$lte': now}}},
                {'$group': {
                    '_id': {
                        'date': {'$dateToString': {'format': '%Y-%m-%d', 'date': '$login_time'}},
                        'status': '$status'
                    },
                    'count': {'$sum': 1}
                }},
                {'$sort': {'_id.date': 1}}
            ]
            daily_raw = list(col.aggregate(daily_pipeline))

            daily_map = {}
            for d in daily_raw:
                date = d['_id']['date']
                status = d['_id'].get('status', 'unknown')
                if date not in daily_map:
                    daily_map[date] = {'date': date, 'success': 0, 'failed': 0, 'total': 0}
                if status == 'success':
                    daily_map[date]['success'] = d['count']
                else:
                    daily_map[date]['failed'] = d['count']
                daily_map[date]['total'] += d['count']

            daily = []
            for i in range(days):
                dt = start + timedelta(days=i)
                date_str = dt.strftime('%Y-%m-%d')
                if date_str in daily_map:
                    daily.append(daily_map[date_str])
                else:
                    daily.append({'date': date_str, 'success': 0, 'failed': 0, 'total': 0})

        # 2. Hourly heatmap (0-23 hours, Mon-Sun)
        hourly_pipeline = [
            {'$match': {'login_time': {'$gte': start, '$lte': now}}},
            {'$group': {
                '_id': {
                    'dow': {'$dayOfWeek': '$login_time'},
                    'hour': {'$hour': '$login_time'}
                },
                'count': {'$sum': 1}
            }}
        ]
        hourly_raw = list(col.aggregate(hourly_pipeline))
        heatmap = [{'day': h['_id']['dow'], 'hour': h['_id']['hour'], 'count': h['count']} for h in hourly_raw]

        # 3. Suspicious IPs: same IP, different accounts — now with user details
        suspicious_pipeline = [
            {'$match': {'login_time': {'$gte': start, '$lte': now}, 'status': 'success'}},
            {'$group': {
                '_id': '$ip_address',
                'users': {'$addToSet': {'user_id': '$user_id', 'email': '$email', 'username': '$username'}},
                'user_ids': {'$addToSet': '$user_id'},
                'count': {'$sum': 1},
                'locations': {'$addToSet': {
                    'lat': '$location.latitude',
                    'lng': '$location.longitude',
                    'country': '$location.country',
                    'city': '$location.city'
                }}
            }},
            {'$match': {'$expr': {'$gt': [{'$size': '$user_ids'}, 1]}}},
            {'$sort': {'count': -1}},
            {'$limit': 20}
        ]
        suspicious_raw = list(col.aggregate(suspicious_pipeline))
        suspicious_ips = []
        suspicious_user_ids = set()
        for s in suspicious_raw:
            if not s['_id']:
                continue
            users_list = []
            for u in s.get('users', []):
                if isinstance(u, dict):
                    users_list.append({'user_id': u.get('user_id', ''), 'email': u.get('email', ''), 'username': u.get('username', '')})
                    suspicious_user_ids.add(u.get('user_id', ''))
            loc = s.get('locations', [{}])[0] if s.get('locations') else {}
            suspicious_ips.append({
                'ip': s['_id'],
                'user_count': len(s['user_ids']),
                'login_count': s['count'],
                'users': users_list,
                'location': loc if isinstance(loc, dict) else {}
            })

        # 4. Top countries
        country_pipeline = [
            {'$match': {'login_time': {'$gte': start, '$lte': now}, 'location.country': {'$exists': True, '$ne': None}}},
            {'$group': {'_id': '$location.country', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}},
            {'$limit': 8}
        ]
        top_countries = [{'country': c['_id'], 'count': c['count']} for c in col.aggregate(country_pipeline) if c['_id']]

        # 5. Device breakdown
        device_pipeline = [
            {'$match': {'login_time': {'$gte': start, '$lte': now}}},
            {'$group': {'_id': {'$ifNull': ['$device.type', 'Unknown']}, 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}}
        ]
        devices = [{'device': d['_id'] or 'Unknown', 'count': d['count']} for d in col.aggregate(device_pipeline)]

        # 6. Browser breakdown
        browser_pipeline = [
            {'$match': {'login_time': {'$gte': start, '$lte': now}}},
            {'$group': {'_id': {'$ifNull': ['$device.browser', 'Unknown']}, 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}},
            {'$limit': 6}
        ]
        browsers = [{'browser': b['_id'] or 'Unknown', 'count': b['count']} for b in col.aggregate(browser_pipeline)]

        # 7. Summary stats
        total = col.count_documents({'login_time': {'$gte': start, '$lte': now}})
        success = col.count_documents({'login_time': {'$gte': start, '$lte': now}, 'status': 'success'})
        failed = total - success
        unique_ips = len(col.distinct('ip_address', {'login_time': {'$gte': start, '$lte': now}}))
        unique_users = len(col.distinct('user_id', {'login_time': {'$gte': start, '$lte': now}}))

        return jsonify({
            'success': True,
            'daily': daily,
            'heatmap': heatmap,
            'suspicious_ips': suspicious_ips,
            'suspicious_user_ids': list(suspicious_user_ids),
            'top_countries': top_countries,
            'devices': devices,
            'browsers': browsers,
            'summary': {
                'total': total,
                'success': success,
                'failed': failed,
                'unique_ips': unique_ips,
                'unique_users': unique_users,
                'suspicious_count': len(suspicious_ips),
                'success_rate': round(success / total * 100, 1) if total > 0 else 0,
            },
            'days': days,
        }), 200

    except Exception as e:
        logger.error(f"Error getting login chart data: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@login_logs_bp.route('/login-logs/failed-attempts', methods=['GET'])
@token_required_with_user
@subadmin_or_admin_required('login-logs')
def get_failed_attempts(current_user):
    """Get recent failed login attempts"""
    try:
        user_id = request.args.get('user_id')
        hours = int(request.args.get('hours', 24))
        
        login_log_model = LoginLog()
        attempts = login_log_model.get_failed_login_attempts(user_id=user_id, hours=hours)
        
        return jsonify({'attempts': mongodb_to_json(attempts)}), 200
        
    except Exception as e:
        logger.error(f"Error getting failed attempts: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get failed attempts: {str(e)}'}), 500


@login_logs_bp.route('/active-sessions', methods=['GET'])
@token_required_with_user
@subadmin_or_admin_required('active-users')
def get_active_sessions(current_user):
    """Get all currently active sessions"""
    try:
        include_idle = request.args.get('include_idle', 'true').lower() == 'true'
        
        active_session_model = ActiveSession()
        sessions = active_session_model.get_active_sessions(include_idle=include_idle)
        
        return jsonify({'sessions': mongodb_to_json(sessions), 'count': len(sessions)}), 200
        
    except Exception as e:
        logger.error(f"Error getting active sessions: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get active sessions: {str(e)}'}), 500


@login_logs_bp.route('/active-sessions/<session_id>', methods=['GET'])
@token_required_with_user
def get_session(current_user, session_id):
    """Get a specific session"""
    try:
        active_session_model = ActiveSession()
        session = active_session_model.get_session(session_id)
        
        if not session:
            return jsonify({'error': 'Session not found'}), 404
        
        # Users can only view their own session unless they're admin
        if current_user.get('role') != 'admin' and session.get('user_id') != str(current_user.get('_id')):
            return jsonify({'error': 'Unauthorized'}), 403
        
        return jsonify(mongodb_to_json(session)), 200
        
    except Exception as e:
        logger.error(f"Error getting session: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get session: {str(e)}'}), 500


@login_logs_bp.route('/active-sessions/heartbeat', methods=['POST'])
@token_required_with_user
def update_heartbeat(current_user):
    """Update session heartbeat"""
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        current_page = data.get('current_page')
        
        if not session_id:
            return jsonify({'error': 'session_id is required'}), 400
        
        active_session_model = ActiveSession()
        success = active_session_model.update_heartbeat(session_id, current_page=current_page)
        
        if success:
            return jsonify({'message': 'Heartbeat updated'}), 200
        else:
            return jsonify({'error': 'Failed to update heartbeat'}), 500
        
    except Exception as e:
        logger.error(f"Error updating heartbeat: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to update heartbeat: {str(e)}'}), 500


@login_logs_bp.route('/active-sessions/stats', methods=['GET'])
@token_required_with_user
@subadmin_or_admin_required('active-users')
def get_session_stats(current_user):
    """Get session statistics"""
    try:
        active_session_model = ActiveSession()
        stats = active_session_model.get_stats()
        
        return jsonify(mongodb_to_json(stats)), 200
        
    except Exception as e:
        logger.error(f"Error getting session stats: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get session stats: {str(e)}'}), 500


@login_logs_bp.route('/page-visits/<session_id>', methods=['GET'])
@token_required_with_user
def get_page_visits(current_user, session_id):
    """Get page visits for a session"""
    try:
        limit = int(request.args.get('limit', 10))
        
        # Verify session belongs to user (unless admin)
        if current_user.get('role') != 'admin':
            active_session_model = ActiveSession()
            session = active_session_model.get_session(session_id)
            
            if not session or session.get('user_id') != str(current_user.get('_id')):
                return jsonify({'error': 'Unauthorized'}), 403
        
        page_visit_model = PageVisit()
        visits = page_visit_model.get_session_visits(session_id, limit=limit)
        
        # Convert MongoDB objects to JSON-serializable format
        visits = mongodb_to_json(visits)
        
        return jsonify({'visits': visits}), 200
        
    except Exception as e:
        logger.error(f"Error getting page visits: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get page visits: {str(e)}'}), 500


@login_logs_bp.route('/page-visits/track', methods=['POST'])
@token_required_with_user
def track_page_visit(current_user):
    """Track a page visit"""
    try:
        from services.activity_tracking_service import activity_tracking_service
        
        data = request.get_json()
        session_id = data.get('session_id')
        page_url = data.get('page_url')
        page_title = data.get('page_title', '')
        referrer = data.get('referrer', '')
        
        if not session_id or not page_url:
            return jsonify({'error': 'session_id and page_url are required'}), 400
        
        page_data = {
            'page_url': page_url,
            'page_title': page_title,
            'referrer': referrer
        }
        
        visit_id = activity_tracking_service.track_page_visit(
            session_id,
            str(current_user.get('_id')),
            page_data,
            request
        )
        
        if visit_id:
            return jsonify({'message': 'Page visit tracked', 'visit_id': visit_id}), 200
        else:
            return jsonify({'error': 'Failed to track page visit'}), 500
        
    except Exception as e:
        logger.error(f"Error tracking page visit: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to track page visit: {str(e)}'}), 500


@login_logs_bp.route('/page-visits/popular', methods=['GET'])
@token_required_with_user
@subadmin_or_admin_required('login-logs')
def get_popular_pages(current_user):
    """Get most visited pages"""
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        limit = int(request.args.get('limit', 10))
        
        # Parse dates if provided
        start_dt = None
        end_dt = None
        
        if start_date:
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        
        if end_date:
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        
        page_visit_model = PageVisit()
        pages = page_visit_model.get_popular_pages(
            start_date=start_dt,
            end_date=end_dt,
            limit=limit
        )
        
        return jsonify({'pages': mongodb_to_json(pages)}), 200
        
    except Exception as e:
        logger.error(f"Error getting popular pages: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get popular pages: {str(e)}'}), 500


@login_logs_bp.route('/activity-stats/overview', methods=['GET'])
@token_required_with_user
@subadmin_or_admin_required('login-logs')
def get_activity_overview(current_user):
    """Get comprehensive activity overview"""
    try:
        # Get login stats
        login_log_model = LoginLog()
        login_stats = login_log_model.get_stats()
        
        # Get session stats
        active_session_model = ActiveSession()
        session_stats = active_session_model.get_stats()
        
        # Get popular pages
        page_visit_model = PageVisit()
        popular_pages = page_visit_model.get_popular_pages(limit=5)
        
        return jsonify({
            'login_stats': mongodb_to_json(login_stats),
            'session_stats': mongodb_to_json(session_stats),
            'popular_pages': mongodb_to_json(popular_pages)
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting activity overview: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get activity overview: {str(e)}'}), 500

@login_logs_bp.route('/send-mail', methods=['POST'])
@token_required_with_user
@subadmin_or_admin_required('login-logs')
def send_custom_mail(current_user):
    """Send a custom email or schedule it to users"""
    try:
        data = request.get_json()
        to_emails = data.get('to', [])
        subject = data.get('subject', '')
        body = data.get('body', '')
        schedule_time = data.get('schedule_time')
        
        if not to_emails or not subject or not body:
            return jsonify({'error': 'to, subject, and body are required'}), 400
            
        if schedule_time:
            try:
                from models.scheduled_email import ScheduledEmail
                from database import db_instance
                
                dt = datetime.fromisoformat(schedule_time.replace('Z', '+00:00'))
                db = db_instance.get_db()
                
                email_doc = {
                    'subject': subject,
                    'body': body,
                    'recipients': to_emails,
                    'status': 'pending',
                    'scheduled_at': dt,
                    'created_at': datetime.utcnow(),
                    'created_by': current_user.get('username', 'system')
                }
                
                db['scheduled_emails'].insert_one(email_doc)
                
                return jsonify({'message': f'Scheduled email for {len(to_emails)} users'}), 200
            except Exception as e:
                logger.error(f"Error scheduling email: {str(e)}")
                return jsonify({'error': 'Failed to schedule email'}), 500
        else:
            from services.email_service import get_email_service
            from email.mime.multipart import MIMEMultipart
            from email.mime.text import MIMEText
            
            email_service = get_email_service()
            if not email_service.is_configured:
                return jsonify({'error': 'Email service not configured'}), 500
                
            batch_size = 50
            success_count = 0
            
            for i in range(0, len(to_emails), batch_size):
                batch = to_emails[i:i+batch_size]
                try:
                    msg = MIMEMultipart('alternative')
                    msg['Subject'] = subject
                    msg['From'] = email_service.from_email
                    msg['To'] = email_service.from_email
                    msg['Bcc'] = ', '.join(batch)
                    msg.attach(MIMEText(body, 'html'))
                    
                    if email_service._send_email_smtp(msg):
                        success_count += len(batch)
                except Exception as e:
                    logger.error(f"Error sending immediate batch: {str(e)}")
            
            # Log mail history
            try:
                from database import db_instance as db_inst
                history_col = db_inst.get_collection('login_logs_mail_history')
                if history_col is not None:
                    history_col.insert_one({
                        'to': to_emails,
                        'subject': subject,
                        'body': body[:500],
                        'status': 'sent' if success_count > 0 else 'failed',
                        'recipients_count': len(to_emails),
                        'success_count': success_count,
                        'sent_by': current_user.get('username', 'admin'),
                        'sent_at': datetime.utcnow(),
                    })
            except Exception as hist_err:
                logger.warning(f"Failed to log mail history: {hist_err}")
                    
            return jsonify({'message': f'Sent email to {success_count} recipients'}), 200

    except Exception as e:
        logger.error(f"Error sending email: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to send email: {str(e)}'}), 500


@login_logs_bp.route('/offer-views/<user_id>', methods=['GET'])
@token_required_with_user
@subadmin_or_admin_required('login-logs')
def get_user_offer_views(current_user, user_id):
    """Get offers viewed/clicked by a user from offer_views collection (primary) + click collections"""
    try:
        limit = int(request.args.get('limit', 50))
        username = request.args.get('username', '')
        email = request.args.get('email', '')
        from database import db_instance
        from bson import ObjectId
        
        offer_views = []
        seen_keys = set()
        
        # Build flexible user query — match by user_id OR username OR email
        def build_user_query():
            conditions = [{'user_id': user_id}]
            # Also try ObjectId version
            try:
                conditions.append({'user_id': ObjectId(user_id)})
            except Exception:
                pass
            if username:
                conditions.append({'username': username})
            if email:
                conditions.append({'user_email': email})
                conditions.append({'email': email})
            return {'$or': conditions}
        
        user_query = build_user_query()
        
        # 1. Primary source: offer_views collection
        ov_col = db_instance.get_collection('offer_views')
        if ov_col is not None:
            views = list(ov_col.find(
                user_query,
                {'offer_id': 1, 'offer_name': 1, 'timestamp': 1, 'clicked': 1, 'source': 1, 'network': 1, 'ip_address': 1}
            ).sort('timestamp', -1).limit(limit))
            for v in views:
                v['_id'] = str(v['_id'])
                v['view_type'] = 'clicked' if v.get('clicked') else 'viewed'
                v['source'] = v.get('source', 'offer_view')
                key = f"{v.get('offer_id')}_{v.get('timestamp', '')}"
                seen_keys.add(key)
                offer_views.append(v)
        
        # 2. Also check click collections
        click_user_query = {'$or': [{'user_id': user_id}]}
        try:
            click_user_query['$or'].append({'user_id': ObjectId(user_id)})
        except Exception:
            pass
        
        for col_name in ('offerwall_clicks', 'offerwall_clicks_detailed', 'clicks'):
            col = db_instance.get_collection(col_name)
            if col is None:
                continue
            clicks = list(col.find(
                click_user_query,
                {'offer_id': 1, 'offer_name': 1, 'timestamp': 1, 'click_time': 1, 'click_id': 1, 'country': 1, 'payout': 1}
            ).sort('timestamp', -1).limit(limit))
            for c in clicks:
                ts = c.get('timestamp') or c.get('click_time')
                key = f"{c.get('offer_id')}_{ts}"
                if key not in seen_keys:
                    c['_id'] = str(c['_id'])
                    c['view_type'] = 'clicked'
                    c['source'] = col_name
                    if not c.get('timestamp') and c.get('click_time'):
                        c['timestamp'] = c['click_time']
                    seen_keys.add(key)
                    offer_views.append(c)
        
        # Sort and limit
        offer_views.sort(key=lambda x: str(x.get('timestamp', '') or ''), reverse=True)
        offer_views = offer_views[:limit]
        
        # Enrich with offer details
        offers_col = db_instance.get_collection('offers')
        if offers_col is not None and len(offer_views) > 0:
            offer_ids = list(set(v.get('offer_id', '') for v in offer_views if v.get('offer_id')))
            if offer_ids:
                offers = {o['offer_id']: o for o in offers_col.find(
                    {'offer_id': {'$in': offer_ids}},
                    {'offer_id': 1, 'name': 1, 'payout': 1, 'category': 1, 'network': 1, 'status': 1, 'countries': 1, 'thumbnail': 1}
                ) if o.get('offer_id')}
                for v in offer_views:
                    offer = offers.get(v.get('offer_id', ''), {})
                    v['offer_details'] = {
                        'name': offer.get('name', v.get('offer_name', 'Unknown')),
                        'payout': offer.get('payout', v.get('payout', 0)),
                        'category': offer.get('category', ''),
                        'network': offer.get('network', ''),
                        'status': offer.get('status', ''),
                        'countries': offer.get('countries', []),
                        'thumbnail': offer.get('thumbnail', '')
                    }
        
        return jsonify(mongodb_to_json({'views': offer_views, 'total': len(offer_views)})), 200
        
    except Exception as e:
        logger.error(f"Error getting offer views: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get offer views: {str(e)}'}), 500


@login_logs_bp.route('/inventory-matched-offers/<user_id>', methods=['GET'])
@token_required_with_user
@subadmin_or_admin_required('login-logs')
def get_inventory_matched_offers(current_user, user_id):
    """Get offers matching what a user searched for — based on their search logs keywords"""
    try:
        limit = int(request.args.get('limit', 20))
        from database import db_instance
        
        # Get user's recent search keywords
        search_col = db_instance.get_collection('search_logs')
        if search_col is None:
            return jsonify({'offers': [], 'keywords': []}), 200
        
        recent_searches = list(search_col.find(
            {'user_id': user_id},
            {'keyword': 1}
        ).sort('searched_at', -1).limit(20))
        
        keywords = list(set(s.get('keyword', '').strip().lower() for s in recent_searches if s.get('keyword', '').strip()))
        
        if not keywords:
            return jsonify({'offers': [], 'keywords': []}), 200
        
        # Find active offers matching any of the keywords (name, category, or description)
        offers_col = db_instance.get_collection('offers')
        if offers_col is None:
            return jsonify({'offers': [], 'keywords': keywords}), 200
        
        # Build regex OR query for keywords
        keyword_patterns = [{'name': {'$regex': kw, '$options': 'i'}} for kw in keywords]
        keyword_patterns += [{'category': {'$regex': kw, '$options': 'i'}} for kw in keywords]
        keyword_patterns += [{'description': {'$regex': kw, '$options': 'i'}} for kw in keywords]
        
        matched_offers = list(offers_col.find(
            {'$and': [{'status': 'active'}, {'$or': keyword_patterns}]},
            {'offer_id': 1, 'name': 1, 'payout': 1, 'category': 1, 'network': 1, 'countries': 1, 'status': 1, 'thumbnail': 1}
        ).limit(limit))
        
        for o in matched_offers:
            o['_id'] = str(o['_id'])
        
        return jsonify(mongodb_to_json({'offers': matched_offers, 'keywords': keywords})), 200
        
    except Exception as e:
        logger.error(f"Error getting inventory matched offers: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@login_logs_bp.route('/mail-history', methods=['GET'])
@token_required_with_user
@subadmin_or_admin_required('login-logs')
def get_mail_history(current_user):
    """Get history of emails sent from login logs page"""
    try:
        limit = int(request.args.get('limit', 50))
        user_email = request.args.get('user_email', '')
        
        from database import db_instance
        col = db_instance.get_collection('login_logs_mail_history')
        if col is None:
            return jsonify({'history': [], 'total': 0}), 200
        
        query = {}
        if user_email:
            query['to'] = {'$regex': user_email, '$options': 'i'}
        
        history = list(col.find(query).sort('sent_at', -1).limit(limit))
        total = col.count_documents(query)
        
        for h in history:
            h['_id'] = str(h['_id'])
        
        return jsonify(mongodb_to_json({'history': history, 'total': total})), 200
        
    except Exception as e:
        logger.error(f"Error getting mail history: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@login_logs_bp.route('/collect-search-logs-mail', methods=['POST'])
@token_required_with_user
@subadmin_or_admin_required('login-logs')
def collect_search_logs_for_mail(current_user):
    """Collect selected search logs and compose/send email with the data"""
    try:
        data = request.get_json()
        user_email = data.get('user_email', '')
        user_name = data.get('user_name', '')
        search_log_ids = data.get('search_log_ids', [])
        send_now = data.get('send_now', False)
        
        if not user_email:
            return jsonify({'error': 'user_email is required'}), 400
        
        if not search_log_ids:
            return jsonify({'error': 'No search logs selected'}), 400
        
        from database import db_instance
        from bson import ObjectId
        
        search_col = db_instance.get_collection('search_logs')
        if search_col is None:
            return jsonify({'error': 'Database not connected'}), 500
        
        # Fetch the selected search logs
        obj_ids = []
        for sid in search_log_ids:
            try:
                obj_ids.append(ObjectId(sid))
            except Exception:
                pass
        
        logs = list(search_col.find({'_id': {'$in': obj_ids}}))
        
        if not logs:
            return jsonify({'error': 'No search logs found'}), 404
        
        # Build email body from search logs
        search_summary = []
        for log in logs:
            keyword = log.get('keyword', 'N/A')
            results = log.get('results_count', 0)
            status = log.get('inventory_status', 'N/A')
            picked = log.get('picked_offer', '')
            searched_at = log.get('searched_at', log.get('created_at', ''))
            if hasattr(searched_at, 'strftime'):
                searched_at = searched_at.strftime('%Y-%m-%d %H:%M')
            search_summary.append(f'• Keyword: "{keyword}" | Results: {results} | Status: {status} | Picked: {picked or "None"} | Time: {searched_at}')
        
        body_text = f"Hi {user_name},\n\nHere is a summary of your recent search activity:\n\n" + "\n".join(search_summary) + "\n\nBased on your searches, we have some great offers for you. Check them out!\n\nBest,\nThe Team"
        subject = f"Your Search Activity Summary - {len(logs)} searches"
        
        if send_now:
            from services.email_service import get_email_service
            from email.mime.multipart import MIMEMultipart
            from email.mime.text import MIMEText
            
            email_service = get_email_service()
            if not email_service.is_configured:
                return jsonify({'error': 'Email service not configured'}), 500
            
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = email_service.from_email
            msg['To'] = user_email
            msg.attach(MIMEText(body_text.replace('\n', '<br/>'), 'html'))
            
            success = email_service._send_email_smtp(msg)
            if success:
                return jsonify({'message': 'Email sent successfully', 'subject': subject, 'body': body_text}), 200
            else:
                return jsonify({'error': 'Failed to send email'}), 500
        else:
            # Return composed email for preview in mail tab
            return jsonify({
                'message': 'Email composed',
                'subject': subject,
                'body': body_text,
                'to': user_email,
                'search_count': len(logs)
            }), 200
        
    except Exception as e:
        logger.error(f"Error collecting search logs for mail: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to collect search logs: {str(e)}'}), 500
