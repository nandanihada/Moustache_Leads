from flask import Blueprint, request, jsonify
from datetime import datetime
from bson import ObjectId
from database import db_instance
from utils.auth import token_required, admin_required

support_bp = Blueprint('support', __name__)


def _col():
    return db_instance.get_collection('support_messages')


def _serialize(doc):
    doc['_id'] = str(doc['_id'])
    if 'user_id' in doc:
        doc['user_id'] = str(doc['user_id'])
    for reply in doc.get('replies', []):
        if '_id' in reply:
            reply['_id'] = str(reply['_id'])
    return doc


# ── Publisher: send a new message ──────────────────────────────────────────────
@support_bp.route('/api/support/messages', methods=['POST'])
@token_required
def send_message():
    user = request.current_user
    data = request.get_json() or {}
    subject = (data.get('subject') or '').strip()
    body = (data.get('body') or '').strip()

    if not body:
        return jsonify({'error': 'Message body is required'}), 400

    doc = {
        'user_id': ObjectId(str(user['_id'])),
        'username': user.get('username', ''),
        'email': user.get('email', ''),
        'subject': subject or 'General Query',
        'body': body,
        'status': 'open',          # open | replied | closed
        'replies': [],
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'read_by_admin': False,
    }
    result = _col().insert_one(doc)
    doc['_id'] = str(result.inserted_id)
    doc['user_id'] = str(doc['user_id'])
    return jsonify({'success': True, 'message': doc}), 201


# ── Publisher: get own messages ─────────────────────────────────────────────────
@support_bp.route('/api/support/messages', methods=['GET'])
@token_required
def get_my_messages():
    user = request.current_user
    docs = list(_col().find(
        {'user_id': ObjectId(str(user['_id']))},
        sort=[('created_at', -1)]
    ))
    return jsonify({'success': True, 'messages': [_serialize(d) for d in docs]})


# ── Admin: get all messages ─────────────────────────────────────────────────────
@support_bp.route('/api/admin/support/messages', methods=['GET'])
@token_required
@admin_required
def admin_get_all_messages():
    status_filter = request.args.get('status')
    query = {}
    if status_filter and status_filter != 'all':
        query['status'] = status_filter

    docs = list(_col().find(query, sort=[('created_at', -1)]))
    return jsonify({'success': True, 'messages': [_serialize(d) for d in docs]})


# ── Admin: reply to a message ───────────────────────────────────────────────────
@support_bp.route('/api/admin/support/messages/<message_id>/reply', methods=['POST'])
@token_required
@admin_required
def admin_reply(message_id):
    data = request.get_json() or {}
    reply_text = (data.get('reply') or '').strip()
    if not reply_text:
        return jsonify({'error': 'Reply text is required'}), 400

    reply = {
        '_id': ObjectId(),
        'text': reply_text,
        'from': 'admin',
        'created_at': datetime.utcnow(),
    }

    result = _col().update_one(
        {'_id': ObjectId(message_id)},
        {
            '$push': {'replies': reply},
            '$set': {
                'status': 'replied',
                'updated_at': datetime.utcnow(),
                'read_by_admin': True,
            }
        }
    )
    if result.matched_count == 0:
        return jsonify({'error': 'Message not found'}), 404

    doc = _col().find_one({'_id': ObjectId(message_id)})
    return jsonify({'success': True, 'message': _serialize(doc)})


# ── Admin: mark message as read ─────────────────────────────────────────────────
@support_bp.route('/api/admin/support/messages/<message_id>/read', methods=['PUT'])
@token_required
@admin_required
def admin_mark_read(message_id):
    _col().update_one(
        {'_id': ObjectId(message_id)},
        {'$set': {'read_by_admin': True}}
    )
    return jsonify({'success': True})
