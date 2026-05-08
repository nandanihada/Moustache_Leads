from flask import Blueprint, request, jsonify
from services.support_hub_service import get_support_hub_service
from utils.auth import token_required

support_hub_admin_bp = Blueprint('support_hub_admin', __name__)

@support_hub_admin_bp.route('/support/templates', methods=['GET'])
@token_required
def get_templates():
    user = request.current_user
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    service = get_support_hub_service()
    templates = service.get_templates()
    for t in templates:
        t['_id'] = str(t['_id'])
    return jsonify(templates)

@support_hub_admin_bp.route('/support/conversations', methods=['GET'])
@token_required
def get_conversations():
    user = request.current_user
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    service = get_support_hub_service()
    conversations = service.get_conversations()
    for c in conversations:
        c['_id'] = str(c['_id'])
    return jsonify(conversations)

@support_hub_admin_bp.route('/support/bulk-send', methods=['POST'])
@token_required
def bulk_send():
    user = request.current_user
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    user_ids = data.get('user_ids', [])
    template_id = data.get('template_id')
    channel = data.get('channel', 'Email')
    scheduled_at = data.get('scheduled_at')
    
    service = get_support_hub_service()
    results = service.bulk_send(user_ids, template_id, channel, scheduled_at)
    return jsonify({'results': results})

@support_hub_admin_bp.route('/support/conversations/<conv_id>/messages', methods=['GET'])
@token_required
def get_messages(conv_id):
    user = request.current_user
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    service = get_support_hub_service()
    messages = service.get_messages(conv_id)
    return jsonify(messages)

@support_hub_admin_bp.route('/support/conversations/<conv_id>/messages', methods=['POST'])
@token_required
def send_reply(conv_id):
    user = request.current_user
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    body = data.get('body')
    if not body:
        return jsonify({'error': 'Message body is required'}), 400
        
    service = get_support_hub_service()
    message = service.send_message(conv_id, 'admin', body)
    return jsonify(message)
