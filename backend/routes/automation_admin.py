from flask import Blueprint, request, jsonify
from services.automation_service import get_automation_service
from models.automation_state import AutomationState
from utils.auth import token_required
from database import db_instance

automation_admin_bp = Blueprint('automation_admin', __name__)

@automation_admin_bp.route('/automation/settings', methods=['GET'])
@token_required
def get_settings():
    user = request.current_user
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    model = AutomationState()
    settings = model.get_settings()
    settings['_id'] = str(settings['_id'])
    return jsonify({'settings': settings})

@automation_admin_bp.route('/automation/settings', methods=['POST'])
@token_required
def update_settings():
    user = request.current_user
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    model = AutomationState()
    model.update_settings(data)
    
    # Dynamic recalculation for all active users in the queue
    from datetime import datetime, timedelta
    now = datetime.utcnow()
    
    try:
        initial_delay = float(data.get('initial_delay_hours', 5))
        step_interval = int(data.get('step_interval_minutes', 200))
        
        active_users = list(model.collection.find({'queue_status': 'active'}))
        for item in active_users:
            current_step = item.get('current_step', 0)
            
            # Recalculate based on their original time references
            if current_step == 0:
                last_active = item.get('last_login') or item.get('updated_at') or now
                new_time = last_active + timedelta(hours=initial_delay)
            else:
                last_active = item.get('updated_at') or now
                new_time = last_active + timedelta(minutes=step_interval)
                
            model.collection.update_one(
                {'_id': item['_id']},
                {'$set': {'next_mail_time': new_time, 'updated_at': now}}
            )
    except Exception as e:
        import logging
        logging.error(f"Error rescheduling automation queues: {e}")
        
    return jsonify({'message': 'Settings updated and active queues rescheduled successfully'})

@automation_admin_bp.route('/automation/queue', methods=['GET'])
@token_required
def get_queue():
    user = request.current_user
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    # Optional filtering/pagination
    limit = int(request.args.get('limit', 1000))
    
    model = AutomationState()
    queue = list(model.collection.find().sort('next_mail_time', 1).limit(limit))
    
    for item in queue:
        item['_id'] = str(item['_id'])
        item['next_offers'] = []
        item['sent_history'] = []
        item['matched_verticals'] = [v.capitalize() for v in (item.get('matched_verticals') or [])][:3]
        
    return jsonify({'queue': queue})

import time

_queue_item_cache = {}
_queue_item_cache_ttl = 60  # Cache for 1 minute

@automation_admin_bp.route('/automation/queue/<user_id>', methods=['GET'])
@token_required
def get_queue_item(user_id):
    user = request.current_user
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
        
    now = time.time()
    if user_id in _queue_item_cache:
        val, expiry = _queue_item_cache[user_id]
        if now < expiry:
            return jsonify({'item': val}), 200
    
    model = AutomationState()
    item = model.get_user_state(user_id)
    if not item:
        # Auto-initialize state for users who don't have one yet
        service = get_automation_service()
        service.handle_user_activity(user_id, activity_type='AdminView', force_reset=True)
        item = model.get_user_state(user_id)
        if not item:
            # Return a minimal placeholder instead of 404
            return jsonify({'item': {
                '_id': '',
                'user_id': user_id,
                'username': 'Unknown',
                'queue_status': 'active',
                'current_step': 0,
                'delivery_status': 'pending',
                'next_offers': [],
                'sent_history': [],
                'matched_verticals': []
            }}), 200
        
    item['_id'] = str(item['_id'])
    service = get_automation_service()
    
    # Add heavy data only for this single item
    try:
        preview_offers, matched_verticals = service.preview_next_offers(user_id)
        item['next_offers'] = preview_offers
        item['matched_verticals'] = matched_verticals or item.get('matched_verticals', [])
        item['sent_history'] = service.get_sent_history(user_id)
    except Exception as e:
        import logging
        logging.error(f"Error previewing offers for {user_id}: {e}")
        item['next_offers'] = []
        item['sent_history'] = []
    
    _queue_item_cache[user_id] = (item, now + _queue_item_cache_ttl)
    return jsonify({'item': item})

@automation_admin_bp.route('/automation/sync', methods=['POST'])
@token_required
def sync_queue():
    user = request.current_user
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json() or {}
    force_reset = data.get('force_reset', False)
    user_ids = data.get('user_ids', None)
    
    service = get_automation_service()
    count = service.sync_active_users(force_reset=force_reset, user_ids=user_ids)
    return jsonify({'message': f'Synced {count} users successfully', 'count': count})

@automation_admin_bp.route('/automation/override', methods=['POST'])
@token_required
def override_state():
    user = request.current_user
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    user_id = data.get('user_id')
    action = data.get('action')
    step = data.get('step')
    
    if not user_id or not action:
        return jsonify({'error': 'User ID and action are required'}), 400
        
    if user_id in _queue_item_cache:
        del _queue_item_cache[user_id]
        
    service = get_automation_service()
    success, message = service.override_user_state(user_id, action, step, data)
    
    if success:
        return jsonify({'message': message})
    else:
        return jsonify({'error': message}), 400

@automation_admin_bp.route('/automation/send-now', methods=['POST'])
@token_required
def send_now_manual():
    user = request.current_user
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    user_id = data.get('user_id')
    
    if not user_id:
        return jsonify({'error': 'User ID is required'}), 400
        
    service = get_automation_service()
    success, message = service.send_now(user_id, data, admin_username=user.get('username', 'admin'))
    
    if success:
        return jsonify({'message': message})
    else:
        return jsonify({'error': message}), 400
@automation_admin_bp.route('/automation/purge', methods=['POST'])
@token_required
def purge_queue():
    user = request.current_user
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    db = db_instance.get_db()
    db.automation_states.delete_many({})
    return jsonify({'message': 'All automation data has been permanently cleared'})


@automation_admin_bp.route('/automation/email-history', methods=['GET'])
@token_required
def get_email_history():
    """Get full email history for the automation flow with filtering"""
    user = request.current_user
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 50))
    user_id_filter = request.args.get('user_id', '')
    status_filter = request.args.get('status', '')
    username_filter = request.args.get('username', '')
    
    db = db_instance.get_db()
    scheduled_col = db['scheduled_emails']
    
    # If username filter provided, resolve to user_id first
    if username_filter and not user_id_filter:
        users_col = db['users']
        matched_user = users_col.find_one(
            {'username': {'$regex': username_filter, '$options': 'i'}},
            {'_id': 1}
        )
        if matched_user:
            user_id_filter = str(matched_user['_id'])
        else:
            # No user found, return empty
            return jsonify({
                'success': True, 'emails': [], 'total': 0,
                'page': page, 'per_page': per_page, 'pages': 0
            })
    
    # Build query - only automation-related emails
    query = {
        '$or': [
            {'type': {'$regex': '^automation_'}},
            {'created_by': 'automation_engine'}
        ]
    }
    
    if user_id_filter:
        query['user_id'] = user_id_filter
    if status_filter:
        query['status'] = status_filter
    
    total = scheduled_col.count_documents(query)
    skip = (page - 1) * per_page
    
    emails = list(scheduled_col.find(query).sort('created_at', -1).skip(skip).limit(per_page))
    
    # Enrich with username lookup
    user_ids = list(set(str(e.get('user_id', '')) for e in emails if e.get('user_id')))
    users_col = db['users']
    username_map = {}
    if user_ids:
        from bson import ObjectId
        obj_ids = []
        for uid in user_ids:
            try:
                obj_ids.append(ObjectId(uid))
            except:
                pass
        if obj_ids:
            users_data = list(users_col.find({'_id': {'$in': obj_ids}}, {'username': 1, 'email': 1}))
            for u in users_data:
                username_map[str(u['_id'])] = {'username': u.get('username', 'Unknown'), 'email': u.get('email', '')}
    
    result = []
    for e in emails:
        e['_id'] = str(e['_id'])
        uid = str(e.get('user_id', ''))
        user_info = username_map.get(uid, {})
        result.append({
            'id': e['_id'],
            'user_id': uid,
            'username': user_info.get('username', 'Unknown'),
            'user_email': user_info.get('email', e.get('recipients', [''])[0] if e.get('recipients') else ''),
            'subject': e.get('subject', ''),
            'type': e.get('type', ''),
            'step': e.get('step', 0),
            'status': e.get('status', ''),
            'scheduled_at': e.get('scheduled_at').isoformat() + 'Z' if e.get('scheduled_at') else None,
            'created_at': e.get('created_at').isoformat() + 'Z' if e.get('created_at') else None,
            'sent_at': e.get('sent_at').isoformat() + 'Z' if e.get('sent_at') else None,
            'created_by': e.get('created_by', ''),
            'related_offer_ids': e.get('related_offer_ids', []),
            'error_message': e.get('error_message', '')
        })
    
    return jsonify({
        'success': True,
        'emails': result,
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': (total + per_page - 1) // per_page
    })


@automation_admin_bp.route('/automation/email-history', methods=['DELETE'])
@token_required
def delete_email_history():
    """Delete all automation email logs"""
    user = request.current_user
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    db = db_instance.get_db()
    scheduled_col = db['scheduled_emails']
    
    # Only delete automation-related emails
    result = scheduled_col.delete_many({
        '$or': [
            {'type': {'$regex': '^automation_'}},
            {'created_by': 'automation_engine'}
        ]
    })
    
    return jsonify({
        'success': True,
        'deleted_count': result.deleted_count,
        'message': f'Deleted {result.deleted_count} automation email logs'
    })


@automation_admin_bp.route('/automation/emergency-stop', methods=['POST'])
@token_required
def emergency_stop():
    """Emergency stop - cancel ALL pending emails and disable engine"""
    user = request.current_user
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    db = db_instance.get_db()
    
    # 1. Cancel all pending scheduled emails
    result = db['scheduled_emails'].update_many(
        {'status': 'pending'},
        {'$set': {'status': 'cancelled', 'cancelled_at': __import__('datetime').datetime.utcnow()}}
    )
    
    # 2. Disable the automation engine
    db['automation_settings'].update_one(
        {'type': 'global'},
        {'$set': {'enabled': False}},
        upsert=True
    )
    
    # 3. Mark all active users as paused
    db['automation_states'].update_many(
        {'queue_status': 'active'},
        {'$set': {'queue_status': 'paused', 'next_mail_time': None}}
    )
    
    return jsonify({
        'success': True,
        'cancelled_emails': result.modified_count,
        'message': f'EMERGENCY STOP: Cancelled {result.modified_count} pending emails, disabled engine, paused all users.'
    })
