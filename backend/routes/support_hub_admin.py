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

@support_hub_admin_bp.route('/support/templates', methods=['POST'])
@token_required
def create_template():
    user = request.current_user
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    if not data.get('name') or not data.get('body'):
        return jsonify({'error': 'Name and body are required'}), 400
        
    service = get_support_hub_service()
    template = service.create_template(data)
    return jsonify(template)

@support_hub_admin_bp.route('/support/templates/<template_id>', methods=['PUT'])
@token_required
def update_template(template_id):
    user = request.current_user
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    service = get_support_hub_service()
    service.update_template(template_id, data)
    return jsonify({'success': True})

@support_hub_admin_bp.route('/support/templates/<template_id>', methods=['DELETE'])
@token_required
def delete_template(template_id):
    user = request.current_user
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    service = get_support_hub_service()
    service.delete_template(template_id)
    return jsonify({'success': True})

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
    message_prefix = data.get('message_prefix')
    email_settings = data.get('email_settings')
    offer_ids = data.get('offer_ids')
    payout_overrides = data.get('payout_overrides')
    
    service = get_support_hub_service()
    results = service.bulk_send(user_ids, template_id, channel, scheduled_at, message_prefix, email_settings, offer_ids, payout_overrides)
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

@support_hub_admin_bp.route('/support/send', methods=['POST'])
@token_required
def send_outreach():
    user = request.current_user
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    user_id = data.get('user_id')
    subject = data.get('subject')
    body = data.get('body')
    channel = data.get('channel', 'Email')
    email_settings = data.get('email_settings')
    offer_ids = data.get('offer_ids')
    payout_overrides = data.get('payout_overrides')
    
    if not user_id or not body:
        return jsonify({'error': 'User ID and body are required'}), 400
        
    service = get_support_hub_service()
    result = service.send_outreach(user_id, subject, body, channel, scheduled_at, email_settings, offer_ids, payout_overrides)
    return jsonify(result)

@support_hub_admin_bp.route('/support/settings', methods=['GET'])
@token_required
def get_support_settings():
    user = request.current_user
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    service = get_support_hub_service()
    settings = service.get_settings()
    return jsonify(settings)

@support_hub_admin_bp.route('/support/settings', methods=['POST'])
@token_required
def update_support_settings():
    user = request.current_user
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    service = get_support_hub_service()
    service.update_settings(data)
    return jsonify({'success': True})

@support_hub_admin_bp.route('/support/verify-connection', methods=['POST'])
@token_required
def verify_connection():
    user = request.current_user
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    channel = data.get('channel')
    if not channel:
        return jsonify({'error': 'Channel is required'}), 400
        
    service = get_support_hub_service()
    return jsonify(service.verify_connection(channel))

@support_hub_admin_bp.route('/support/search-contacts', methods=['GET'])
@token_required
def search_contacts():
    channel = request.args.get('channel')
    query = request.args.get('query', '')
    
    if channel == 'Telegram':
        results = [
            {'id': '123456', 'name': f'@{query if query else "user"}_telegram', 'platform': 'Telegram'},
            {'id': '789012', 'name': 'Support_Group_Official', 'platform': 'Telegram'}
        ]
    elif channel == 'Teams':
        results = [
            {'id': 'teams-99', 'name': f'{query if query else "John"} Doe (Teams)', 'platform': 'Teams'},
            {'id': 'teams-ch-1', 'name': 'General Marketing Channel', 'platform': 'Teams'}
        ]
    else:
        results = [{'id': 'ext-1', 'name': f'External_{query}', 'platform': channel}]
        
    return jsonify({'results': results})

@support_hub_admin_bp.route('/support/map-contact', methods=['POST'])
@token_required
def map_contact():
    data = request.get_json()
    user_id = data.get('user_id')
    channel = data.get('channel')
    contact_info = data.get('contact_info')
    
    if not user_id or not channel or not contact_info:
        return jsonify({'error': 'Missing parameters'}), 400
        
    service = get_support_hub_service()
    settings = service.get_settings()
    
    if 'channel_configs' not in settings:
        settings['channel_configs'] = {}
    if channel not in settings['channel_configs']:
        settings['channel_configs'][channel] = {}
    if 'user_mappings' not in settings['channel_configs'][channel]:
        settings['channel_configs'][channel]['user_mappings'] = {}
        
    settings['channel_configs'][channel]['user_mappings'][str(user_id)] = contact_info
    service.update_settings(settings)
    
    return jsonify({'status': 'mapped', 'user_id': user_id, 'contact': contact_info})
