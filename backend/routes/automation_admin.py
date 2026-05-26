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
        return jsonify({'error': 'Not found'}), 404
        
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
