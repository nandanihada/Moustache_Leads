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
    return jsonify({'message': 'Settings updated successfully'})

@automation_admin_bp.route('/automation/queue', methods=['GET'])
@token_required
def get_queue():
    user = request.current_user
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    # Optional filtering/pagination
    limit = int(request.args.get('limit', 1000))
    
    model = AutomationState()
    # Get states without heavy processing for the list view
    queue = list(model.collection.find().sort('next_mail_time', 1).limit(limit))
    
    for item in queue:
        item['_id'] = str(item['_id'])
        # Only provide minimal data for the list
        if 'next_offers' not in item: item['next_offers'] = []
        if 'sent_history' not in item: item['sent_history'] = []
        
    return jsonify({'queue': queue})

@automation_admin_bp.route('/automation/queue/<user_id>', methods=['GET'])
@token_required
def get_queue_item(user_id):
    user = request.current_user
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
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
    
    return jsonify({'item': item})

@automation_admin_bp.route('/automation/sync', methods=['POST'])
@token_required
def sync_queue():
    user = request.current_user
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json() or {}
    force_reset = data.get('force_reset', False)
    
    service = get_automation_service()
    count = service.sync_active_users(force_reset=force_reset)
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
