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
        from database import db_instance
        col = db_instance.get_collection('login_logs')
        if col is None:
            return jsonify({'error': 'Database connection failed'}), 500

        now = datetime.utcnow()
        start = now - timedelta(days=days)

        # 1. Daily breakdown: success vs failed per day
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

        # Build daily map
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

        # Fill missing days
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
                    'dow': {'$dayOfWeek': '$login_time'},  # 1=Sun, 7=Sat
                    'hour': {'$hour': '$login_time'}
                },
                'count': {'$sum': 1}
            }}
        ]
        hourly_raw = list(col.aggregate(hourly_pipeline))
        heatmap = []
        for h in hourly_raw:
            heatmap.append({
                'day': h['_id']['dow'],
                'hour': h['_id']['hour'],
                'count': h['count']
            })

        # 3. Suspicious IPs: same IP, different accounts
        suspicious_pipeline = [
            {'$match': {'login_time': {'$gte': start, '$lte': now}, 'status': 'success'}},
            {'$group': {
                '_id': '$ip_address',
                'users': {'$addToSet': '$user_id'},
                'count': {'$sum': 1}
            }},
            {'$match': {'$expr': {'$gt': [{'$size': '$users'}, 1]}}},
            {'$sort': {'count': -1}},
            {'$limit': 10}
        ]
        suspicious_raw = list(col.aggregate(suspicious_pipeline))
        suspicious_ips = [{'ip': s['_id'], 'user_count': len(s['users']), 'login_count': s['count']} for s in suspicious_raw if s['_id']]

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
        to_emails = data.get('to', []) # List of emails
        subject = data.get('subject', '')
        body = data.get('body', '')
        schedule_time = data.get('schedule_time') # ISO format
        
        if not to_emails or not subject or not body:
            return jsonify({'error': 'to, subject, and body are required'}), 400
            
        if schedule_time:
            # Schedule it using ScheduledEmail model
            try:
                from models.scheduled_email import ScheduledEmail
                from datetime import datetime
                import pytz
                
                dt = datetime.fromisoformat(schedule_time.replace('Z', '+00:00'))
                
                # Insert into scheduled emails
                # Get DB directly since we might need to insert raw document if ScheduledEmail class doesn't support it directly
                from database import db_instance
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
            # Send immediately via BCC
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
                    
            return jsonify({'message': f'Sent email to {success_count} recipients'}), 200

    except Exception as e:
        logger.error(f"Error sending email: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to send email: {str(e)}'}), 500


@login_logs_bp.route('/login-logs/chart-data', methods=['GET'])
@token_required_with_user
@subadmin_or_admin_required('login-logs')
def get_chart_data(current_user):
    """Get login chart data: daily trend, devices, browsers, countries, hourly heatmap."""
    try:
        days = int(request.args.get('days', 7))
        from database import db_instance
        col = db_instance.get_collection('login_logs')
        if col is None:
            return jsonify({'error': 'Database not connected'}), 500

        cutoff = datetime.utcnow() - timedelta(days=days)
        query = {'login_time': {'$gte': cutoff}}

        logs = list(col.find(query, {
            'login_time': 1, 'status': 1, 'user_id': 1, 'ip_address': 1,
            'location': 1, 'device': 1
        }))

        # Daily trend
        daily_map = {}
        for i in range(days):
            d = (datetime.utcnow() - timedelta(days=days - 1 - i)).strftime('%Y-%m-%d')
            daily_map[d] = {'date': d, 'success': 0, 'failed': 0, 'total': 0}

        unique_users = set()
        unique_ips = set()
        device_counts = {}
        browser_counts = {}
        country_counts = {}
        hourly = [[0] * 24 for _ in range(7)]  # 7 days x 24 hours
        suspicious_ips = set()
        ip_fail_counts = {}

        for log in logs:
            lt = log.get('login_time')
            if not lt:
                continue
            if isinstance(lt, str):
                try:
                    lt = datetime.fromisoformat(lt.replace('Z', ''))
                except Exception:
                    continue

            day_key = lt.strftime('%Y-%m-%d')
            status = log.get('status', 'success')
            uid = log.get('user_id', '')
            ip = log.get('ip_address', '')

            if day_key in daily_map:
                daily_map[day_key]['total'] += 1
                if status == 'failed':
                    daily_map[day_key]['failed'] += 1
                else:
                    daily_map[day_key]['success'] += 1

            if uid:
                unique_users.add(uid)
            if ip:
                unique_ips.add(ip)
                if status == 'failed':
                    ip_fail_counts[ip] = ip_fail_counts.get(ip, 0) + 1
                    if ip_fail_counts[ip] >= 3:
                        suspicious_ips.add(ip)

            # Device
            device = log.get('device', {})
            dtype = device.get('type', 'Unknown') if isinstance(device, dict) else 'Unknown'
            device_counts[dtype] = device_counts.get(dtype, 0) + 1

            browser = device.get('browser', 'Unknown') if isinstance(device, dict) else 'Unknown'
            browser_counts[browser] = browser_counts.get(browser, 0) + 1

            # Country
            loc = log.get('location', {})
            country = loc.get('country', 'Unknown') if isinstance(loc, dict) else 'Unknown'
            country_counts[country] = country_counts.get(country, 0) + 1

            # Hourly heatmap
            try:
                dow = lt.weekday()
                hour = lt.hour
                hourly[dow][hour] += 1
            except Exception:
                pass

        total_success = sum(d['success'] for d in daily_map.values())
        total_failed = sum(d['failed'] for d in daily_map.values())

        return jsonify({
            'summary': {
                'total': total_success + total_failed,
                'success': total_success,
                'failed': total_failed,
                'unique_users': len(unique_users),
                'unique_ips': len(unique_ips),
                'suspicious_count': len(suspicious_ips),
            },
            'daily': list(daily_map.values()),
            'devices': sorted([{'device': k, 'count': v} for k, v in device_counts.items()], key=lambda x: -x['count'])[:6],
            'browsers': sorted([{'browser': k, 'count': v} for k, v in browser_counts.items()], key=lambda x: -x['count'])[:6],
            'top_countries': sorted([{'country': k, 'count': v} for k, v in country_counts.items()], key=lambda x: -x['count'])[:10],
            'hourly_heatmap': hourly,
            'suspicious_ips': [{'ip': ip, 'failed_count': ip_fail_counts.get(ip, 0)} for ip in list(suspicious_ips)[:20]],
        }), 200

    except Exception as e:
        logger.error(f"Error getting chart data: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get chart data: {str(e)}'}), 500
