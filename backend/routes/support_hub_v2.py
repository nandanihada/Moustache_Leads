from flask import Blueprint, request, jsonify
from datetime import datetime
from bson import ObjectId
from database import db_instance
from utils.auth import token_required, admin_required
from models.support_hub import SupportTemplate, SupportConversationV2
import logging

logger = logging.getLogger(__name__)
support_hub_bp = Blueprint('support_hub_v2', __name__)

@support_hub_bp.route('/api/admin/support/hub/templates', methods=['GET'])
@token_required
@admin_required
def get_templates():
    templates = SupportTemplate.get_all()
    return jsonify({'success': True, 'templates': templates})

@support_hub_bp.route('/api/admin/support/hub/templates', methods=['POST'])
@token_required
@admin_required
def create_template():
    data = request.get_json()
    name = data.get('name')
    category = data.get('category')
    body = data.get('body')
    
    if not all([name, category, body]):
        return jsonify({'error': 'Name, category and body are required'}), 400
        
    template = SupportTemplate.create(name, category, body)
    return jsonify({'success': True, 'template': template})

@support_hub_bp.route('/api/admin/support/hub/send', methods=['POST'])
@token_required
@admin_required
def bulk_send():
    data = request.get_json()
    user_ids = data.get('user_ids', [])
    template_id = data.get('template_id')
    channel = data.get('channel', 'Email') # Email, Telegram, Teams, Chat
    
    if not user_ids or not template_id:
        return jsonify({'error': 'Users and template are required'}), 400
        
    template = db_instance.get_collection('support_templates').find_one({'_id': ObjectId(template_id)})
    if not template:
        return jsonify({'error': 'Template not found'}), 404
        
    users_col = db_instance.get_collection('users')
    sent_count = 0
    
    for uid in user_ids:
        user = users_col.find_one({'_id': ObjectId(uid)})
        if not user: continue
        
        # Replace placeholders
        body = template['body']
        body = body.replace('{user}', user.get('username', 'User'))
        body = body.replace('{location}', f"{user.get('city', 'Unknown')}, {user.get('country', 'Unknown')}")
        # Add more placeholder logic here
        
        # Route based on channel
        if channel == 'Email':
            # Logic to send email
            pass
        elif channel == 'Telegram':
            # Logic to send telegram
            pass
        # etc.
        
        # Save to conversation
        conv = SupportConversationV2.create_or_get(uid, channel)
        SupportConversationV2.add_message(conv['_id'], body, 'admin')
        sent_count += 1
        
    return jsonify({'success': True, 'sent_count': sent_count})

@support_hub_bp.route('/api/admin/support/hub/conversations', methods=['GET'])
@token_required
@admin_required
def get_conversations():
    col = SupportConversationV2.get_collection()
    convs = list(col.find().sort('last_message_at', -1))
    for c in convs:
        c['_id'] = str(c['_id'])
    return jsonify({'success': True, 'conversations': convs})
