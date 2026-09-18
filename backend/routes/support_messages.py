from flask import Blueprint, request, jsonify, send_from_directory
from datetime import datetime, timedelta
from bson import ObjectId
import os
import uuid
import threading
from werkzeug.utils import secure_filename
from database import db_instance
from utils.auth import token_required, admin_required
from services.email_service import get_email_service

support_bp = Blueprint('support', __name__)

VALID_TOPICS = ['postback', 'iframe', 'offers', 'payment', 'signup', 'credit', 'other']

def admin_or_subadmin_required(f):
    """Allow both admin and subadmin roles to access support endpoints."""
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        user = getattr(request, 'current_user', None)
        if not user:
            return jsonify({'error': 'Authentication required'}), 401
        if user.get('role') not in ('admin', 'subadmin'):
            return jsonify({'error': 'Admin or subadmin access required'}), 403
        return f(*args, **kwargs)
    return decorated

# Upload config
SUPPORT_UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads', 'support')
os.makedirs(SUPPORT_UPLOAD_DIR, exist_ok=True)
ALLOWED_IMAGE_EXT = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB


def _log_email_activity(source: str, recipient_count: int, admin_user: dict = None, note: str = '', recipient_email: str = '') -> None:
    """Insert a record into email_activity_logs so it appears in the Email Activity tab."""
    try:
        col = db_instance.get_collection('email_activity_logs')
        if col is None:
            return
        col.insert_one({
            'action': 'sent',
            'source': source,
            'offer_ids': [],
            'offer_names': [note] if note else [],
            'offer_count': 0,
            'recipient_type': 'specific_users' if source == 'support_reply' else 'all_users',
            'recipient_email': recipient_email,
            'recipient_count': recipient_count,
            'batch_count': 1,
            'offers_per_email': 0,
            'scheduled_time': None,
            'admin_id': str(admin_user['_id']) if admin_user else 'system',
            'admin_username': admin_user.get('username', 'system') if admin_user else 'system',
            'created_at': datetime.utcnow(),
        })
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Email activity log insert failed: {e}")


def _send_support_notification_email(to_email: str, username: str, is_admin_reply: bool = True) -> None:
    """Send a non-blocking email notifying user they have a new support reply."""
    def _send():
        try:
            email_service = get_email_service()
            if not email_service.is_configured:
                import logging
                logging.getLogger(__name__).error(f"âŒ Email service not configured! Cannot send support notification to {to_email}")
                return
            frontend_url = os.environ.get('FRONTEND_URL', 'https://moustacheleads.com')
            if is_admin_reply:
                subject = "You have received a message from admin"
                html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:40px 20px;font-family:Arial,sans-serif;background:#f5f5f5;">
<div style="max-width:500px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
<div style="text-align:center;margin-bottom:24px;">
<img src="{frontend_url}/logo.png" alt="Moustache Leads" style="height:40px;" onerror="this.style.display='none'" />
<h1 style="margin:8px 0 0;font-size:20px;color:#111;">Moustache Leads</h1>
</div>
<h2 style="margin:0 0 16px;color:#111;">Hello {username},</h2>
<p style="font-size:15px;color:#333;line-height:1.6;">You have received a message from admin. Please log in to your dashboard to view and respond.</p>
<div style="text-align:center;margin-top:20px;">
<a href="{frontend_url}/publisher/signin" style="display:inline-block;padding:12px 28px;background:#111;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">View Message</a>
</div>
<p style="font-size:11px;color:#999;margin-top:32px;text-align:center;">
<a href="{frontend_url}/dashboard/settings" style="color:#999;">Unsubscribe</a> from these notifications
</p>
</div>
</body></html>"""
            else:
                subject = "New support ticket received"
                html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:40px 20px;font-family:Arial,sans-serif;background:#f5f5f5;">
<p style="font-size:16px;color:#333;">New support message from {username}.</p>
</body></html>"""
            email_service._send_email(to_email, subject, html)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Support notification email failed: {e}")

    threading.Thread(target=_send, daemon=True).start()


def _col():
    return db_instance.get_collection('support_messages')


def _serialize(doc):
    doc['_id'] = str(doc['_id'])
    if 'user_id' in doc:
        doc['user_id'] = str(doc['user_id'])
    for reply in doc.get('replies', []):
        if '_id' in reply:
            reply['_id'] = str(reply['_id'])
    for note in doc.get('notes', []):
        if '_id' in note:
            note['_id'] = str(note['_id'])
    return doc


# â”€â”€ Image upload endpoint â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@support_bp.route('/api/support/upload-image', methods=['POST'])
@token_required
def upload_support_image():
    """Upload an image for use in support messages (user or admin)."""
    if 'image' not in request.files:
        return jsonify({'error': 'No image file provided'}), 400

    file = request.files['image']
    if not file or file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    if ext not in ALLOWED_IMAGE_EXT:
        return jsonify({'error': f'File type not allowed. Allowed: {", ".join(ALLOWED_IMAGE_EXT)}'}), 400

    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)
    if size > MAX_IMAGE_SIZE:
        return jsonify({'error': 'Image too large. Max 5MB'}), 400

    filename = f"{uuid.uuid4().hex}.{ext}"
    file.save(os.path.join(SUPPORT_UPLOAD_DIR, filename))

    image_url = f"/api/support/images/{filename}"
    return jsonify({'success': True, 'image_url': image_url}), 201


@support_bp.route('/api/support/images/<filename>', methods=['GET'])
def serve_support_image(filename):
    """Serve uploaded support images."""
    safe = secure_filename(filename)
    return send_from_directory(SUPPORT_UPLOAD_DIR, safe)


# â”€â”€ Publisher: send a new message â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@support_bp.route('/api/support/messages', methods=['POST'])
@token_required
def send_message():
    user = request.current_user
    data = request.get_json() or {}
    subject = (data.get('subject') or '').strip()
    body = (data.get('body') or '').strip()
    image_url = (data.get('image_url') or '').strip()
    topic = (data.get('topic') or 'other').strip().lower()
    if topic not in VALID_TOPICS:
        topic = 'other'

    if not body and not image_url:
        return jsonify({'error': 'Message body or image is required'}), 400

    doc = {
        'user_id': ObjectId(str(user['_id'])),
        'username': user.get('username', ''),
        'email': user.get('email', ''),
        'subject': subject or 'General Query',
        'body': body,
        'image_url': image_url or None,
        'topic': topic,
        'status': 'open',
        'replies': [],
        'notes': [],
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'read_by_admin': False,
        'read_by_user': True,
    }
    result = _col().insert_one(doc)
    doc['_id'] = str(result.inserted_id)
    doc['user_id'] = str(doc['user_id'])
    return jsonify({'success': True, 'message': doc}), 201


# â”€â”€ Publisher: reply to a conversation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@support_bp.route('/api/support/messages/<message_id>/reply', methods=['POST'])
@token_required
def user_reply(message_id):
    user = request.current_user
    data = request.get_json() or {}
    reply_text = (data.get('reply') or '').strip()
    image_url = (data.get('image_url') or '').strip()
    if not reply_text and not image_url:
        return jsonify({'error': 'Reply text or image is required'}), 400

    # Verify ownership
    doc = _col().find_one({'_id': ObjectId(message_id), 'user_id': ObjectId(str(user['_id']))})
    if not doc:
        return jsonify({'error': 'Message not found'}), 404

    if doc.get('status') == 'closed':
        return jsonify({'error': 'This conversation is closed'}), 400

    reply = {
        '_id': ObjectId(),
        'text': reply_text,
        'from': 'user',
        'image_url': image_url or None,
        'created_at': datetime.utcnow(),
    }

    _col().update_one(
        {'_id': ObjectId(message_id)},
        {
            '$push': {'replies': reply},
            '$set': {
                'status': 'open',
                'updated_at': datetime.utcnow(),
                'read_by_admin': False,
                'read_by_user': True,
                'last_read_by_user_at': datetime.utcnow(),
            },
            '$unset': {
                'user_draft': ""
            }
        }
    )

    updated = _col().find_one({'_id': ObjectId(message_id)})
    return jsonify({'success': True, 'message': _serialize(updated)})


# â”€â”€ Publisher: get unread count for sidebar badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@support_bp.route('/api/support/unread-count', methods=['GET'])
@token_required
def get_unread_count():
    user = request.current_user
    uid = ObjectId(str(user['_id']))
    count = _col().count_documents({
        'user_id': uid,
        'status': {'$in': ['replied']},
        '$or': [
            {'read_by_user': False},
            {'read_by_user': {'$exists': False}}
        ]
    })
    total = _col().count_documents({'user_id': uid})
    return jsonify({'success': True, 'unread_count': count, 'total_messages': total})


# â”€â”€ Publisher: get own messages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@support_bp.route('/api/support/messages', methods=['GET'])
@token_required
def get_my_messages():
    user = request.current_user
    docs = list(_col().find(
        {'user_id': ObjectId(str(user['_id']))},
        sort=[('created_at', -1)]
    ))
    return jsonify({'success': True, 'messages': [_serialize(d) for d in docs]})


# â”€â”€ Draft endpoints (for both Admin and User) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@support_bp.route('/api/support/messages/<message_id>/draft', methods=['PUT'])
@token_required
def save_draft(message_id):
    user = request.current_user
    data = request.get_json() or {}
    draft_text = (data.get('draft') or '').strip()
    
    is_admin = user.get('role') == 'admin'
    
    query = {'_id': ObjectId(message_id)}
    if not is_admin:
        query['user_id'] = ObjectId(str(user['_id']))
        
    doc = _col().find_one(query)
    if not doc:
        return jsonify({'error': 'Conversation not found'}), 404
        
    field = 'admin_draft' if is_admin else 'user_draft'
    
    if draft_text:
        _col().update_one({'_id': ObjectId(message_id)}, {'$set': {field: draft_text}})
    else:
        _col().update_one({'_id': ObjectId(message_id)}, {'$unset': {field: ""}})
        
    return jsonify({'success': True, 'message': 'Draft saved'})


@support_bp.route('/api/support/messages/<message_id>/draft', methods=['DELETE'])
@token_required
def delete_draft(message_id):
    user = request.current_user
    is_admin = user.get('role') == 'admin'
    
    query = {'_id': ObjectId(message_id)}
    if not is_admin:
        query['user_id'] = ObjectId(str(user['_id']))
        
    doc = _col().find_one(query)
    if not doc:
        return jsonify({'error': 'Conversation not found'}), 404
        
    field = 'admin_draft' if is_admin else 'user_draft'
    _col().update_one({'_id': ObjectId(message_id)}, {'$unset': {field: ""}})
    
    return jsonify({'success': True, 'message': 'Draft deleted'})


# â”€â”€ Publisher: check for admin replies (used on login popup) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@support_bp.route('/api/support/unread-replies', methods=['GET'])
@token_required
def check_unread_replies():
    user = request.current_user
    uid = ObjectId(str(user['_id']))

    # Count messages with status=replied that user hasn't marked as read
    # '$ne': True catches both False and missing field (old messages)
    count = _col().count_documents({
        'user_id': uid,
        'status': 'replied',
        '$or': [
            {'read_by_user': False},
            {'read_by_user': {'$exists': False}}
        ]
    })

    # Fetch the latest replied message for preview text
    latest = _col().find_one(
        {'user_id': uid, 'status': 'replied'},
        sort=[('updated_at', -1)]
    )
    preview = None
    if latest and latest.get('replies'):
        last_reply = latest['replies'][-1]
        preview = last_reply.get('text', '')[:120]

    return jsonify({'success': True, 'unread_count': count, 'preview': preview})


# â”€â”€ Publisher: mark all replies as read by user â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@support_bp.route('/api/support/mark-read', methods=['PUT'])
@token_required
def mark_replies_read():
    user = request.current_user
    now = datetime.utcnow()
    _col().update_many(
        {'user_id': ObjectId(str(user['_id'])), 'status': 'replied'},
        {'$set': {'read_by_user': True, 'last_read_by_user_at': now}}
    )
    return jsonify({'success': True})


# â”€â”€ Admin: get all messages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@support_bp.route('/api/admin/support/messages', methods=['GET'])
@token_required
def admin_get_all_messages():
    user = request.current_user
    if user.get('role') not in ('admin', 'subadmin'):
        return jsonify({'error': 'Admin or subadmin access required'}), 403
    status_filter = request.args.get('status')
    query = {}
    if status_filter == 'draft':
        query['admin_draft'] = {'$exists': True, '$ne': ''}
    elif status_filter and status_filter != 'all':
        query['status'] = status_filter

    docs = list(_col().find(query, sort=[('updated_at', -1)]))

    # Compute counts for all statuses
    total = _col().count_documents({})
    new_count = _col().count_documents({'status': 'open', 'read_by_admin': False})
    open_count = _col().count_documents({'status': 'open'})
    replied_count = _col().count_documents({'status': 'replied'})
    closed_count = _col().count_documents({'status': 'closed'})
    draft_count = _col().count_documents({'admin_draft': {'$exists': True, '$ne': ''}})

    return jsonify({
        'success': True,
        'messages': [_serialize(d) for d in docs],
        'counts': {
            'total': total,
            'new': new_count,
            'open': open_count,
            'replied': replied_count,
            'closed': closed_count,
            'draft': draft_count,
        }
    })


# â”€â”€ Admin: unread count for sidebar badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@support_bp.route('/api/admin/support/unread-count', methods=['GET'])
@token_required
@admin_or_subadmin_required
def admin_unread_count():
    count = _col().count_documents({'read_by_admin': False, 'status': {'$ne': 'closed'}})
    total = _col().count_documents({})
    return jsonify({'success': True, 'unread_count': count, 'total_messages': total})


# â”€â”€ Admin: reply to a message â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@support_bp.route('/api/admin/support/messages/<message_id>/reply', methods=['POST'])
@token_required
@admin_or_subadmin_required
def admin_reply(message_id):
    from datetime import timedelta
    data = request.get_json() or {}
    reply_text = (data.get('reply') or '').strip()
    image_url = (data.get('image_url') or '').strip()
    if not reply_text and not image_url:
        return jsonify({'error': 'Reply text or image is required'}), 400

    reply = {
        '_id': ObjectId(),
        'text': reply_text,
        'from': 'admin',
        'image_url': image_url or None,
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
                'read_by_user': False,   # user hasn't seen this reply yet
                'last_read_by_user_at': datetime.utcnow() - timedelta(days=1), # invalidate to trigger new notification
                'last_read_by_admin_at': datetime.utcnow(),
            },
            '$unset': {
                'admin_draft': ""
            }
        }
    )
    if result.matched_count == 0:
        return jsonify({'error': 'Message not found'}), 404

    doc = _col().find_one({'_id': ObjectId(message_id)})

    # Send email notification to the user
    user_email = doc.get('email', '')
    username = doc.get('username', 'there')
    if user_email:
        _send_support_notification_email(user_email, username)
        _log_email_activity('support_reply', 1, request.current_user, note=f"Reply to {username}", recipient_email=user_email)

    return jsonify({'success': True, 'message': _serialize(doc)})


# â”€â”€ Admin: mark message as read â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@support_bp.route('/api/admin/support/messages/<message_id>/read', methods=['PUT'])
@token_required
@admin_or_subadmin_required
def admin_mark_read(message_id):
    now = datetime.utcnow()
    _col().update_one(
        {'_id': ObjectId(message_id)},
        {'$set': {'read_by_admin': True, 'last_read_by_admin_at': now}}
    )
    return jsonify({'success': True})


# â”€â”€ Close ticket (admin or user) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@support_bp.route('/api/admin/support/messages/<message_id>/close', methods=['PUT'])
@token_required
@admin_or_subadmin_required
def admin_close_ticket(message_id):
    result = _col().update_one(
        {'_id': ObjectId(message_id)},
        {'$set': {'status': 'closed', 'updated_at': datetime.utcnow()}}
    )
    if result.matched_count == 0:
        return jsonify({'error': 'Message not found'}), 404
    doc = _col().find_one({'_id': ObjectId(message_id)})
    return jsonify({'success': True, 'message': _serialize(doc)})


@support_bp.route('/api/support/messages/<message_id>/close', methods=['PUT'])
@token_required
def user_close_ticket(message_id):
    user = request.current_user
    doc = _col().find_one({'_id': ObjectId(message_id), 'user_id': ObjectId(str(user['_id']))})
    if not doc:
        return jsonify({'error': 'Message not found'}), 404
    _col().update_one(
        {'_id': ObjectId(message_id)},
        {'$set': {'status': 'closed', 'updated_at': datetime.utcnow()}}
    )
    updated = _col().find_one({'_id': ObjectId(message_id)})
    return jsonify({'success': True, 'message': _serialize(updated)})


# â”€â”€ Admin: get all publishers (for recipient selector) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@support_bp.route('/api/admin/support/users', methods=['GET'])
@token_required
@admin_or_subadmin_required
def admin_get_users():
    users_col = db_instance.get_collection('users')
    # Fetch all users (excluding admins and subadmins)
    users = list(users_col.find(
        {},
        {'_id': 1, 'username': 1, 'email': 1, 'role': 1}
    ))
    for u in users:
        u['_id'] = str(u['_id'])
    return jsonify({'success': True, 'users': users})


# â”€â”€ Admin: broadcast message to all or selected users â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@support_bp.route('/api/admin/support/broadcast', methods=['POST'])
@token_required
@admin_required
def admin_broadcast():
    data = request.get_json() or {}
    subject = (data.get('subject') or '').strip() or 'Message from MoustacheLeads'
    body = (data.get('body') or '').strip()
    recipient_ids = data.get('recipient_ids')  # None or [] means all users

    if not body:
        return jsonify({'error': 'Message body is required'}), 400

    users_col = db_instance.get_collection('users')

    if recipient_ids and len(recipient_ids) > 0:
        # Specific users
        object_ids = [ObjectId(uid) for uid in recipient_ids]
        users = list(users_col.find(
            {'_id': {'$in': object_ids}},
            {'_id': 1, 'username': 1, 'email': 1}
        ))
    else:
        # All users
        users = list(users_col.find(
            {},
            {'_id': 1, 'username': 1, 'email': 1}
        ))

    if not users:
        return jsonify({'error': 'No recipients found'}), 400

    now = datetime.utcnow()
    docs = []
    for u in users:
        docs.append({
            'user_id': u['_id'],
            'username': u.get('username', ''),
            'email': u.get('email', ''),
            'subject': subject,
            'body': body,
            'status': 'replied',          # admin initiated â€” show as replied so popup fires
            'replies': [{
                '_id': ObjectId(),
                'text': body,
                'from': 'admin',
                'created_at': now,
            }],
            'created_at': now,
            'updated_at': now,
            'read_by_admin': True,
            'read_by_user': False,        # user hasn't seen it yet â†’ triggers popup on login
            'is_broadcast': True,
        })

    result = _col().insert_many(docs)

    # Send one notification email per recipient (no message content, just CTA)
    for u in users:
        u_email = u.get('email', '')
        u_name = u.get('username', 'there')
        if u_email:
            _send_support_notification_email(u_email, u_name)

    _log_email_activity('support_broadcast', len(users), request.current_user, note=f"Broadcast: {subject}")

    return jsonify({'success': True, 'sent_to': len(result.inserted_ids)})


# â”€â”€ Admin: delete a single message (for everyone) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@support_bp.route('/api/admin/support/messages/<message_id>', methods=['DELETE'])
@token_required
@admin_required
def admin_delete_message(message_id):
    """Delete a support message entirely â€” removes it for both admin and user"""
    try:
        result = _col().delete_one({'_id': ObjectId(message_id)})
        if result.deleted_count == 0:
            return jsonify({'error': 'Message not found'}), 404
        return jsonify({'success': True, 'message': 'Message deleted for everyone'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# â”€â”€ Admin: delete a specific reply from a message â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@support_bp.route('/api/admin/support/messages/<message_id>/replies/<reply_id>', methods=['DELETE'])
@token_required
@admin_required
def admin_delete_reply(message_id, reply_id):
    """Delete a specific reply from a message â€” removes it for everyone"""
    try:
        result = _col().update_one(
            {'_id': ObjectId(message_id)},
            {'$pull': {'replies': {'_id': ObjectId(reply_id)}}}
        )
        if result.matched_count == 0:
            return jsonify({'error': 'Message not found'}), 404
        if result.modified_count == 0:
            return jsonify({'error': 'Reply not found'}), 404
        
        doc = _col().find_one({'_id': ObjectId(message_id)})
        return jsonify({'success': True, 'message': _serialize(doc)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# â”€â”€ Admin: bulk delete multiple messages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@support_bp.route('/api/admin/support/messages/bulk-delete', methods=['POST'])
@token_required
@admin_required
def admin_bulk_delete_messages():
    """Delete multiple support messages at once â€” removes them for everyone"""
    try:
        data = request.get_json() or {}
        message_ids = data.get('message_ids', [])
        
        if not message_ids:
            return jsonify({'error': 'No message IDs provided'}), 400
        
        object_ids = [ObjectId(mid) for mid in message_ids]
        result = _col().delete_many({'_id': {'$in': object_ids}})
        
        return jsonify({
            'success': True,
            'deleted_count': result.deleted_count,
            'message': f'Deleted {result.deleted_count} message(s) for everyone'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# â”€â”€ Publisher: rate a closed ticket â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@support_bp.route('/api/support/messages/<message_id>/rate', methods=['POST'])
@token_required
def rate_ticket(message_id):
    user = request.current_user
    data = request.get_json() or {}
    thumbs = data.get('thumbs')  # 'up' or 'down'
    comment = (data.get('comment') or '').strip()[:500]

    if thumbs not in ('up', 'down'):
        return jsonify({'error': 'thumbs must be "up" or "down"'}), 400

    doc = _col().find_one({'_id': ObjectId(message_id), 'user_id': ObjectId(str(user['_id']))})
    if not doc:
        return jsonify({'error': 'Message not found'}), 404

    rating = {'thumbs': thumbs, 'comment': comment, 'at': datetime.utcnow()}
    _col().update_one(
        {'_id': ObjectId(message_id)},
        {'$set': {'user_rating': rating}}
    )
    return jsonify({'success': True})


# â”€â”€ Admin: get notes for a ticket â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@support_bp.route('/api/admin/support/messages/<message_id>/notes', methods=['GET'])
@token_required
@admin_or_subadmin_required
def get_notes(message_id):
    doc = _col().find_one({'_id': ObjectId(message_id)}, {'notes': 1})
    if not doc:
        return jsonify({'error': 'Message not found'}), 404
    notes = doc.get('notes', [])
    for n in notes:
        if '_id' in n:
            n['_id'] = str(n['_id'])
    return jsonify({'success': True, 'notes': notes})


# â”€â”€ Admin: add a note to a ticket â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@support_bp.route('/api/admin/support/messages/<message_id>/notes', methods=['POST'])
@token_required
@admin_or_subadmin_required
def add_note(message_id):
    admin = request.current_user
    data = request.get_json() or {}
    text = (data.get('text') or '').strip()
    if not text:
        return jsonify({'error': 'Note text is required'}), 400

    note = {
        '_id': ObjectId(),
        'text': text,
        'author_id': str(admin['_id']),
        'author_name': admin.get('username', 'Admin'),
        'created_at': datetime.utcnow(),
    }
    result = _col().update_one(
        {'_id': ObjectId(message_id)},
        {'$push': {'notes': note}}
    )
    if result.matched_count == 0:
        return jsonify({'error': 'Message not found'}), 404

    note['_id'] = str(note['_id'])
    note['created_at'] = note['created_at'].isoformat() + 'Z'
    return jsonify({'success': True, 'note': note}), 201


# â”€â”€ Admin: delete a note from a ticket â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@support_bp.route('/api/admin/support/messages/<message_id>/notes/<note_id>', methods=['DELETE'])
@token_required
@admin_or_subadmin_required
def delete_note(message_id, note_id):
    result = _col().update_one(
        {'_id': ObjectId(message_id)},
        {'$pull': {'notes': {'_id': ObjectId(note_id)}}}
    )
    if result.matched_count == 0:
        return jsonify({'error': 'Message not found'}), 404
    return jsonify({'success': True})


# â”€â”€ Admin: canned replies CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def _canned_col():
    return db_instance.get_collection('canned_replies')


@support_bp.route('/api/admin/support/canned-replies', methods=['GET'])
@token_required
@admin_or_subadmin_required
def get_canned_replies():
    docs = list(_canned_col().find({}, sort=[('created_at', 1)]))
    for d in docs:
        d['_id'] = str(d['_id'])
    return jsonify({'success': True, 'canned_replies': docs})


@support_bp.route('/api/admin/support/canned-replies', methods=['POST'])
@token_required
@admin_or_subadmin_required
def create_canned_reply():
    admin = request.current_user
    data = request.get_json() or {}
    title = (data.get('title') or '').strip()
    text = (data.get('text') or '').strip()
    if not title or not text:
        return jsonify({'error': 'title and text are required'}), 400

    doc = {
        'title': title,
        'text': text,
        'created_by': admin.get('username', 'Admin'),
        'created_at': datetime.utcnow(),
    }
    result = _canned_col().insert_one(doc)
    doc['_id'] = str(result.inserted_id)
    doc['created_at'] = doc['created_at'].isoformat() + 'Z'
    return jsonify({'success': True, 'canned_reply': doc}), 201


@support_bp.route('/api/admin/support/canned-replies/<reply_id>', methods=['PUT'])
@token_required
@admin_or_subadmin_required
def update_canned_reply(reply_id):
    data = request.get_json() or {}
    title = (data.get('title') or '').strip()
    text = (data.get('text') or '').strip()
    if not title or not text:
        return jsonify({'error': 'title and text are required'}), 400

    result = _canned_col().update_one(
        {'_id': ObjectId(reply_id)},
        {'$set': {'title': title, 'text': text}}
    )
    if result.matched_count == 0:
        return jsonify({'error': 'Canned reply not found'}), 404
    return jsonify({'success': True})


@support_bp.route('/api/admin/support/canned-replies/<reply_id>', methods=['DELETE'])
@token_required
@admin_or_subadmin_required
def delete_canned_reply(reply_id):
    result = _canned_col().delete_one({'_id': ObjectId(reply_id)})
    if result.deleted_count == 0:
        return jsonify({'error': 'Canned reply not found'}), 404
    return jsonify({'success': True})


# â”€â”€ Intake wizard smart check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@support_bp.route('/api/support/intake-check', methods=['POST'])
@token_required
def intake_check():
    """
    Smart validation called mid-wizard. Checks real data and returns a
    contextual message the wizard displays as an ML chat bubble.

    Payload: { "check_type": "offer_id" | "postback_url" | "email" | "payment", "value": "..." }
    Response: { "ok": bool, "message": "...", "data": {...} }
    """
    user = request.current_user
    data = request.get_json() or {}
    check_type = data.get('check_type', '').strip()
    value = (data.get('value') or '').strip()

    # â”€â”€ 1. Offer ID / name lookup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if check_type == 'offer_id':
        if not value:
            return jsonify({'ok': False, 'message': "Please enter an offer name or ID so I can look it up."})

        offers_col = db_instance.get_collection('offers')
        user_id_str = str(user['_id'])

        # Try exact offer_id match first (ML-##### format)
        query = None
        import re as _re
        if _re.match(r'^ML-\d+$', value.upper()):
            query = {'offer_id': value.upper(), 'deleted': {'$ne': True}}
        else:
            # Fuzzy name search
            query = {
                'name': {'$regex': _re.escape(value), '$options': 'i'},
                'deleted': {'$ne': True}
            }

        offers = list(offers_col.find(query, {
            'offer_id': 1, 'name': 1, 'status': 1, 'payout': 1,
            'daily_cap': 1, 'monthly_cap': 1, 'affiliates': 1,
            'allowed_countries': 1, 'vertical': 1
        }).limit(3))

        if not offers:
            return jsonify({
                'ok': False,
                'message': f"I couldn't find any offer matching **\"{value}\"** in our system. Double-check the offer ID (format: ML-00001) or name and try again â€” or just describe the issue below.",
            })

        offer = offers[0]
        name = offer.get('name', 'Unknown')
        status = offer.get('status', 'unknown').capitalize()
        payout = offer.get('payout', 0)
        oid = offer.get('offer_id', '')
        affiliates = offer.get('affiliates', 'all')

        # Check access
        access_note = ''
        if affiliates == 'request':
            access_note = ' This offer requires a specific access request.'
        elif affiliates not in ('all', None):
            access_note = ' This offer has restricted access.'

        status_emoji = {'Active': 'ðŸŸ¢', 'Running': 'ðŸŸ¢', 'Paused': 'ðŸŸ¡', 'Inactive': 'ðŸ”´'}.get(status, 'âšª')

        message = (
            f"Found it! **{name}** ({oid})\n"
            f"Status: {status_emoji} {status} Â· Payout: ${payout:.2f}{access_note}\n\n"
            f"Great â€” now tell me what's happening with this offer."
        )

        return jsonify({
            'ok': True,
            'message': message,
            'data': {'offer_id': oid, 'name': name, 'status': status, 'payout': payout}
        })

    # â”€â”€ 2. Postback URL validation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    elif check_type == 'postback_url':
        if not value:
            return jsonify({'ok': False, 'message': "Please paste your postback URL so I can check it."})

        import urllib.parse as _up
        issues = []
        hints = []

        # Basic format check
        try:
            parsed = _up.urlparse(value)
            if parsed.scheme not in ('http', 'https'):
                issues.append("URL must start with `http://` or `https://`")
            if not parsed.netloc:
                issues.append("URL is missing a domain")
        except Exception:
            issues.append("This doesn't look like a valid URL")

        if issues:
            return jsonify({
                'ok': False,
                'message': "There's an issue with that URL:\nâ€¢ " + "\nâ€¢ ".join(issues) + "\n\nPlease fix it and try again."
            })

        # Check for required macros â€” at minimum click_id
        query_string = parsed.query.lower()
        full_url = value.lower()
        has_click_id = 'click_id' in full_url or 'clickid' in full_url or '{click_id}' in full_url
        has_payout = 'payout' in full_url or '{payout}' in full_url

        if not has_click_id:
            hints.append("The `{click_id}` macro is missing â€” this is required for conversion tracking")
        if not has_payout:
            hints.append("Consider adding `{payout}` macro for dynamic payout passing")

        # Check if user's stored postback URL matches what they entered
        stored_url = user.get('postback_url', '')
        url_match = stored_url and stored_url.rstrip('/') == value.rstrip('/')
        match_note = ""
        if stored_url:
            if url_match:
                match_note = "\nâœ… This matches the postback URL saved in your account."
            else:
                match_note = f"\nâš ï¸ Note: Your account has a different postback URL saved: `{stored_url[:60]}{'...' if len(stored_url) > 60 else ''}`"

        if hints:
            return jsonify({
                'ok': True,
                'message': "URL looks structurally valid, but I noticed:\nâ€¢ " + "\nâ€¢ ".join(hints) + match_note + "\n\nLet me know the macro(s) giving you trouble below.",
                'data': {'stored_url': stored_url, 'url_match': url_match}
            })

        return jsonify({
            'ok': True,
            'message': "URL looks good âœ…" + match_note + "\n\nWhich macro(s) are giving you trouble? Tap any that apply.",
            'data': {'stored_url': stored_url, 'url_match': url_match}
        })

    # â”€â”€ 3. Email match check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    elif check_type == 'email':
        if not value:
            return jsonify({'ok': False, 'message': "Please enter the email address you're having trouble with."})

        user_email = (user.get('email') or '').lower().strip()
        entered = value.lower().strip()

        if user_email and entered == user_email:
            return jsonify({
                'ok': True,
                'message': f"âœ… That's the email registered on your account. What's the issue with it?",
                'data': {'matches_account': True}
            })
        elif user_email:
            return jsonify({
                'ok': True,
                'message': (
                    f"âš ï¸ Just to note â€” the email on your account is **{user_email}**, "
                    f"but you entered **{entered}**. "
                    f"If you're trying to change your email, mention that below."
                ),
                'data': {'matches_account': False, 'account_email': user_email}
            })
        else:
            return jsonify({
                'ok': True,
                'message': "Got it â€” what issue are you experiencing with this email?",
                'data': {'matches_account': None}
            })

    # â”€â”€ 4. Payment status check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    elif check_type == 'payment':
        try:
            from models.monthly_earnings import MonthlyEarnings
            me_model = MonthlyEarnings()
            user_id_str = str(user['_id'])

            # Get current month earnings
            current, _ = me_model.get_current_month_earnings(user_id_str)
            # Get pending (locked but unpaid)
            pending_total, _ = me_model.get_pending_earnings(user_id_str)
            # Get last 3 months history
            history, _ = me_model.get_monthly_earnings_history(user_id_str, limit=3)

            # Get payout method
            payout_col = db_instance.get_collection('payout_methods')
            payout_doc = payout_col.find_one({'user_id': user['_id']})
            method = payout_doc.get('active_method', 'not set').capitalize() if payout_doc else 'not set'

            current_amount = current.get('amount', 0) if current else 0

            lines = [f"Here's your current payment summary:"]
            lines.append(f"â€¢ **Current month earnings:** ${current_amount:.2f} (accumulating)")
            lines.append(f"â€¢ **Pending payout:** ${pending_total:.2f}")
            lines.append(f"â€¢ **Payment method on file:** {method}")

            if history:
                lines.append("\nRecent months:")
                for h in history:
                    lines.append(f"  â€“ {h['month']}: ${h['amount']:.2f} ({h['status']})")

            lines.append("\nNow â€” describe the specific payment issue you're facing.")

            return jsonify({
                'ok': True,
                'message': '\n'.join(lines),
                'data': {
                    'current_month': current_amount,
                    'pending': pending_total,
                    'method': method
                }
            })
        except Exception as e:
            return jsonify({
                'ok': True,
                'message': "I wasn't able to pull your payment details right now, but please describe the issue below and our team will investigate.",
                'data': {}
            })

    # â”€â”€ Unknown check type â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    else:
        return jsonify({'ok': False, 'message': "Unknown check type."}), 400


# â”€â”€ Publisher: poll for new replies (used for Smart Questions live updates) â”€â”€
@support_bp.route('/api/support/messages/<message_id>/poll', methods=['GET'])
@token_required
def poll_message(message_id):
    """
    Returns all replies (and message status) for a ticket.
    Publisher calls this every 15s to get new system/admin messages.
    Optional ?since=<ISO timestamp> to only get replies after that time.
    """
    user = request.current_user
    since_str = request.args.get('since', '')

    doc = _col().find_one(
        {'_id': ObjectId(message_id), 'user_id': ObjectId(str(user['_id']))},
        {'replies': 1, 'status': 1, 'updated_at': 1, 'sq_state': 1}
    )
    if not doc:
        return jsonify({'error': 'Message not found'}), 404

    replies = doc.get('replies', [])

    # Filter by since timestamp if provided
    if since_str:
        try:
            since_dt = datetime.fromisoformat(since_str.replace('Z', ''))
            replies = [
                r for r in replies
                if r.get('created_at') and r['created_at'] > since_dt
            ]
        except Exception:
            pass

    # Serialize
    serialized = []
    for r in replies:
        r_copy = dict(r)
        if '_id' in r_copy:
            r_copy['_id'] = str(r_copy['_id'])
        if isinstance(r_copy.get('created_at'), datetime):
            r_copy['created_at'] = r_copy['created_at'].isoformat() + 'Z'
        serialized.append(r_copy)

    # Mark smart question replies as seen by user
    _col().update_one(
        {'_id': ObjectId(message_id)},
        {'$set': {'read_by_user': True}}
    )

    updated_at = doc.get('updated_at')
    return jsonify({
        'success': True,
        'status': doc.get('status', 'open'),
        'new_replies': serialized,
        'updated_at': updated_at.isoformat() + 'Z' if isinstance(updated_at, datetime) else str(updated_at or ''),
    })


# â”€â”€ Publisher: answer a smart question â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@support_bp.route('/api/support/messages/<message_id>/sq-answer', methods=['POST'])
@token_required
def answer_smart_question(message_id):
    """
    Publisher answers a smart question injected by the SQ worker.
    The answer is stored as a regular user reply so the worker sees it
    and advances to the next question.
    """
    user = request.current_user
    data = request.get_json() or {}
    answer_text = (data.get('answer') or '').strip()
    sq_reply_id = data.get('sq_reply_id', '')  # which SQ they're answering

    if not answer_text:
        return jsonify({'error': 'answer is required'}), 400

    doc = _col().find_one(
        {'_id': ObjectId(message_id), 'user_id': ObjectId(str(user['_id']))},
        {'_id': 1, 'replies': 1}
    )
    if not doc:
        return jsonify({'error': 'Message not found'}), 404

    reply = {
        '_id': ObjectId(),
        'text': answer_text,
        'from': 'user',
        'is_sq_answer': True,
        'sq_reply_id': sq_reply_id,
        'image_url': None,
        'created_at': datetime.utcnow(),
    }

    # Also mark the original SQ reply as answered
    _col().update_one(
        {'_id': ObjectId(message_id), 'replies._id': ObjectId(sq_reply_id)},
        {'$set': {'replies.$.answered': True}}
    )

    _col().update_one(
        {'_id': ObjectId(message_id)},
        {
            '$push': {'replies': reply},
            '$set': {
                'updated_at': datetime.utcnow(),
                'read_by_admin': False,
                'read_by_user': True,
            }
        }
    )

    reply['_id'] = str(reply['_id'])
    reply['created_at'] = reply['created_at'].isoformat() + 'Z'

    return jsonify({'success': True, 'reply': reply}), 201


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# EXTENDED ADMIN INBOX FEATURES
# Flag/Unflag, Reopen, Assign, Schedule reply, Audit log, Profile, Show deleted
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

def _audit_col():
    return db_instance.get_collection('support_ticket_audit')

def _log_audit(ticket_id: str, actor_id: str, actor_name: str, actor_role: str, action: str, detail: str = ''):
    """Write one audit entry for a ticket."""
    try:
        _audit_col().insert_one({
            'ticket_id': ticket_id,
            'actor_id': actor_id,
            'actor_name': actor_name,
            'actor_role': actor_role,
            'action': action,
            'detail': detail,
            'created_at': datetime.utcnow(),
        })
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f'Audit log write failed: {e}')


# â”€â”€ Admin: reopen a closed ticket â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@support_bp.route('/api/admin/support/messages/<message_id>/reopen', methods=['PUT'])
@token_required
@admin_or_subadmin_required
def admin_reopen_ticket(message_id):
    admin = request.current_user
    result = _col().update_one(
        {'_id': ObjectId(message_id)},
        {'$set': {'status': 'open', 'updated_at': datetime.utcnow()}}
    )
    if result.matched_count == 0:
        return jsonify({'error': 'Message not found'}), 404
    _log_audit(message_id, str(admin['_id']), admin.get('username', 'Admin'), admin.get('role', 'admin'), 'Ticket reopened')
    doc = _col().find_one({'_id': ObjectId(message_id)})
    return jsonify({'success': True, 'message': _serialize(doc)})


# Override close to also log audit
@support_bp.route('/api/admin/support/messages/<message_id>/close-v2', methods=['PUT'])
@token_required
@admin_or_subadmin_required
def admin_close_ticket_v2(message_id):
    admin = request.current_user
    result = _col().update_one(
        {'_id': ObjectId(message_id)},
        {'$set': {'status': 'closed', 'updated_at': datetime.utcnow()}}
    )
    if result.matched_count == 0:
        return jsonify({'error': 'Message not found'}), 404
    _log_audit(message_id, str(admin['_id']), admin.get('username', 'Admin'), admin.get('role', 'admin'), 'Ticket closed')
    doc = _col().find_one({'_id': ObjectId(message_id)})
    return jsonify({'success': True, 'message': _serialize(doc)})


# â”€â”€ Admin: flag / unflag a publisher â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@support_bp.route('/api/admin/support/users/<user_id>/flag', methods=['PUT'])
@token_required
@admin_or_subadmin_required
def flag_user(user_id):
    admin = request.current_user
    data = request.get_json() or {}
    flagged = bool(data.get('flagged', True))
    reason = (data.get('reason') or '').strip()[:300]

    users_col = db_instance.get_collection('users')
    update = {
        'flagged': flagged,
        'flag_reason': reason if flagged else '',
        'flagged_at': datetime.utcnow() if flagged else None,
        'flagged_by': str(admin['_id']) if flagged else None,
    }
    result = users_col.update_one({'_id': ObjectId(user_id)}, {'$set': update})
    if result.matched_count == 0:
        return jsonify({'error': 'User not found'}), 404

    action = f'User {"flagged" if flagged else "unflagged"}'
    detail = reason if flagged else ''
    # Log against all open tickets for this user
    tickets = list(_col().find({'user_id': ObjectId(user_id)}, {'_id': 1}))
    for t in tickets:
        _log_audit(str(t['_id']), str(admin['_id']), admin.get('username', 'Admin'), admin.get('role', 'admin'), action, detail)

    return jsonify({'success': True, 'flagged': flagged})


@support_bp.route('/api/admin/support/users/<user_id>/flag-status', methods=['GET'])
@token_required
@admin_or_subadmin_required
def get_flag_status(user_id):
    users_col = db_instance.get_collection('users')
    user = users_col.find_one({'_id': ObjectId(user_id)}, {'flagged': 1, 'flag_reason': 1, 'flagged_at': 1})
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({
        'success': True,
        'flagged': user.get('flagged', False),
        'flag_reason': user.get('flag_reason', ''),
        'flagged_at': user.get('flagged_at', ''),
    })


# â”€â”€ Admin: assign ticket to admin/subadmin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@support_bp.route('/api/admin/support/messages/<message_id>/assign', methods=['PUT'])
@token_required
@admin_or_subadmin_required
def assign_ticket(message_id):
    admin = request.current_user
    data = request.get_json() or {}
    assignee_id = data.get('assignee_id') or None   # None = unassigned
    assignee_name = (data.get('assignee_name') or 'Unassigned').strip()

    update: dict = {
        'assignee_id': assignee_id,
        'assignee_name': assignee_name,
        'updated_at': datetime.utcnow(),
    }
    result = _col().update_one({'_id': ObjectId(message_id)}, {'$set': update})
    if result.matched_count == 0:
        return jsonify({'error': 'Message not found'}), 404

    detail = f'To {assignee_name}' if assignee_id else 'Unassigned'
    _log_audit(message_id, str(admin['_id']), admin.get('username', 'Admin'), admin.get('role', 'admin'), 'Ticket assigned', detail)

    doc = _col().find_one({'_id': ObjectId(message_id)})
    return jsonify({'success': True, 'message': _serialize(doc)})


# â”€â”€ Admin: list assignable team members (admins + subadmins) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@support_bp.route('/api/admin/support/team-members', methods=['GET'])
@token_required
@admin_or_subadmin_required
def get_team_members():
    """Returns all admin + subadmin users for the assign dropdown."""
    users_col = db_instance.get_collection('users')
    # Also include users with subadmin_permissions (role may not be subadmin yet)
    perm_col = db_instance.get_collection('subadmin_permissions')
    perm_user_ids_str = [p['user_id'] for p in perm_col.find({}, {'user_id': 1})]
    from bson import ObjectId as ObjId
    perm_oids = []
    for uid in perm_user_ids_str:
        try:
            perm_oids.append(ObjId(uid))
        except Exception:
            pass

    team = list(users_col.find(
        {'$or': [
            {'role': {'$in': ['admin', 'subadmin']}},
            {'_id': {'$in': perm_oids}},
        ]},
        {'_id': 1, 'username': 1, 'email': 1, 'role': 1}
    ))
    for u in team:
        u['_id'] = str(u['_id'])
    return jsonify({'success': True, 'team': team})


# â”€â”€ Admin: schedule a reply â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@support_bp.route('/api/admin/support/messages/<message_id>/schedule', methods=['POST'])
@token_required
@admin_or_subadmin_required
def schedule_reply(message_id):
    admin = request.current_user
    data = request.get_json() or {}
    text = (data.get('text') or '').strip()
    send_at_str = (data.get('send_at') or '').strip()  # ISO datetime string
    image_url = (data.get('image_url') or '').strip()

    if not text and not image_url:
        return jsonify({'error': 'Reply text or image is required'}), 400
    if not send_at_str:
        return jsonify({'error': 'send_at is required'}), 400

    try:
        send_at = datetime.fromisoformat(send_at_str.replace('Z', ''))
    except Exception:
        return jsonify({'error': 'Invalid send_at datetime format. Use ISO 8601.'}), 400

    if send_at <= datetime.utcnow():
        return jsonify({'error': 'send_at must be in the future'}), 400

    scheduled = {
        '_id': ObjectId(),
        'text': text,
        'image_url': image_url or None,
        'from': 'admin',
        'scheduled_by': str(admin['_id']),
        'scheduled_by_name': admin.get('username', 'Admin'),
        'send_at': send_at,
        'status': 'pending',  # 'pending' | 'sent' | 'cancelled'
        'created_at': datetime.utcnow(),
    }
    result = _col().update_one(
        {'_id': ObjectId(message_id)},
        {'$push': {'scheduled_replies': scheduled}, '$set': {'updated_at': datetime.utcnow()}}
    )
    if result.matched_count == 0:
        return jsonify({'error': 'Message not found'}), 404

    _log_audit(message_id, str(admin['_id']), admin.get('username', 'Admin'), admin.get('role', 'admin'), 'Reply scheduled', f'Send at: {send_at.isoformat()}')

    scheduled['_id'] = str(scheduled['_id'])
    scheduled['send_at'] = scheduled['send_at'].isoformat() + 'Z'
    scheduled['created_at'] = scheduled['created_at'].isoformat() + 'Z'
    return jsonify({'success': True, 'scheduled': scheduled}), 201


@support_bp.route('/api/admin/support/messages/<message_id>/scheduled', methods=['GET'])
@token_required
@admin_or_subadmin_required
def get_scheduled_replies(message_id):
    doc = _col().find_one({'_id': ObjectId(message_id)}, {'scheduled_replies': 1})
    if not doc:
        return jsonify({'error': 'Message not found'}), 404
    scheduled = doc.get('scheduled_replies', [])
    for s in scheduled:
        if '_id' in s:
            s['_id'] = str(s['_id'])
        if isinstance(s.get('send_at'), datetime):
            s['send_at'] = s['send_at'].isoformat() + 'Z'
        if isinstance(s.get('created_at'), datetime):
            s['created_at'] = s['created_at'].isoformat() + 'Z'
    return jsonify({'success': True, 'scheduled': scheduled})


@support_bp.route('/api/admin/support/messages/<message_id>/scheduled/<sched_id>/cancel', methods=['PUT'])
@token_required
@admin_or_subadmin_required
def cancel_scheduled_reply(message_id, sched_id):
    from bson import ObjectId as ObjId
    result = _col().update_one(
        {'_id': ObjId(message_id), 'scheduled_replies._id': ObjId(sched_id)},
        {'$set': {'scheduled_replies.$.status': 'cancelled'}}
    )
    if result.matched_count == 0:
        return jsonify({'error': 'Not found'}), 404
    return jsonify({'success': True})


# â”€â”€ Admin: per-ticket audit log â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@support_bp.route('/api/admin/support/messages/<message_id>/audit', methods=['GET'])
@token_required
@admin_or_subadmin_required
def get_ticket_audit(message_id):
    logs = list(_audit_col().find(
        {'ticket_id': message_id},
        sort=[('created_at', -1)]
    ).limit(100))
    for l in logs:
        l['_id'] = str(l['_id'])
        if isinstance(l.get('created_at'), datetime):
            l['created_at'] = l['created_at'].isoformat() + 'Z'
    return jsonify({'success': True, 'audit': logs})


# â”€â”€ Admin: publisher profile panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@support_bp.route('/api/admin/support/publisher-profile/<user_id>', methods=['GET'])
@token_required
@admin_or_subadmin_required
def get_publisher_profile(user_id):
    """Full publisher profile for the in-ticket Profile panel."""
    users_col = db_instance.get_collection('users')
    placements_col = db_instance.get_collection('placements')
    earnings_col = db_instance.get_collection('monthly_earnings')
    fp_col = db_instance.get_collection('forwarded_postbacks')

    user = users_col.find_one({'_id': ObjectId(user_id)}, {
        '_id': 1, 'username': 1, 'email': 1, 'role': 1,
        'account_status': 1, 'created_at': 1,
        'postback_url': 1, 'flagged': 1, 'flag_reason': 1,
        'verticals': 1, 'geos': 1, 'last_active_at': 1,
    })
    if not user:
        return jsonify({'error': 'User not found'}), 404
    user['_id'] = str(user['_id'])

    # Placements
    placement_docs = list(placements_col.find(
        {'publisherId': ObjectId(user_id)},
        {'_id': 1, 'placementIdentifier': 1, 'platformType': 1, 'platformName': 1,
         'offerwallTitle': 1, 'postbackUrl': 1, 'status': 1, 'createdAt': 1}
    ).sort('createdAt', -1).limit(10))
    for p in placement_docs:
        p['_id'] = str(p['_id'])

    # Earnings summary
    pending_total = 0
    try:
        from models.monthly_earnings import MonthlyEarnings
        me = MonthlyEarnings()
        pending_total, _ = me.get_pending_earnings(user_id)
        current, _ = me.get_current_month_earnings(user_id)
        current_earnings = current.get('amount', 0) if current else 0
    except Exception:
        current_earnings = 0

    # Total conversions from forwarded_postbacks
    total_conversions = fp_col.count_documents({'publisher_id': user_id})
    total_points = 0
    agg = list(fp_col.aggregate([
        {'$match': {'publisher_id': user_id}},
        {'$group': {'_id': None, 'total': {'$sum': '$points'}}}
    ]))
    if agg:
        total_points = agg[0].get('total', 0)

    # Recent support tickets
    recent_tickets = list(_col().find(
        {'user_id': ObjectId(user_id)},
        {'subject': 1, 'status': 1, 'created_at': 1, 'topic': 1}
    ).sort('created_at', -1).limit(5))
    for t in recent_tickets:
        t['_id'] = str(t['_id'])

    return jsonify({
        'success': True,
        'user': user,
        'placements': placement_docs,
        'stats': {
            'pending_earnings': pending_total,
            'current_month_earnings': current_earnings,
            'total_conversions': total_conversions,
            'total_points_earned': round(float(total_points), 2),
        },
        'recent_tickets': [_serialize(t) for t in recent_tickets],
    })


# â”€â”€ Admin: show deleted replies â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# We soft-delete by moving to a deleted_replies array instead of hard deleting
# (This is a backwards-compatible addition â€” hard deletes still work)
@support_bp.route('/api/admin/support/messages/<message_id>/deleted-replies', methods=['GET'])
@token_required
@admin_or_subadmin_required
def get_deleted_replies(message_id):
    doc = _col().find_one({'_id': ObjectId(message_id)}, {'deleted_replies': 1})
    if not doc:
        return jsonify({'error': 'Message not found'}), 404
    deleted = doc.get('deleted_replies', [])
    for r in deleted:
        if '_id' in r:
            r['_id'] = str(r['_id'])
        if isinstance(r.get('created_at'), datetime):
            r['created_at'] = r['created_at'].isoformat() + 'Z'
        if isinstance(r.get('deleted_at'), datetime):
            r['deleted_at'] = r['deleted_at'].isoformat() + 'Z'
    return jsonify({'success': True, 'deleted_replies': deleted})


# Override soft-delete for admin replies
@support_bp.route('/api/admin/support/messages/<message_id>/replies/<reply_id>/soft-delete', methods=['DELETE'])
@token_required
@admin_or_subadmin_required
def admin_soft_delete_reply(message_id, reply_id):
    admin = request.current_user
    doc = _col().find_one({'_id': ObjectId(message_id)}, {'replies': 1})
    if not doc:
        return jsonify({'error': 'Message not found'}), 404

    target = next((r for r in doc.get('replies', []) if str(r.get('_id', '')) == reply_id), None)
    if not target:
        return jsonify({'error': 'Reply not found'}), 404

    target_copy = dict(target)
    target_copy['deleted_at'] = datetime.utcnow()
    target_copy['deleted_by'] = admin.get('username', 'Admin')

    _col().update_one(
        {'_id': ObjectId(message_id)},
        {
            '$pull': {'replies': {'_id': ObjectId(reply_id)}},
            '$push': {'deleted_replies': target_copy},
        }
    )

    updated = _col().find_one({'_id': ObjectId(message_id)})
    _log_audit(message_id, str(admin['_id']), admin.get('username', 'Admin'), admin.get('role', 'admin'), 'Reply deleted')
    return jsonify({'success': True, 'message': _serialize(updated)})


# â”€â”€ Scheduled reply background processor (called from app startup) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def fire_scheduled_replies():
    """Process pending scheduled replies â€” call this every 30s from a background thread."""
    try:
        now = datetime.utcnow()
        # Find all messages with pending scheduled replies that are due
        docs = list(_col().find(
            {'scheduled_replies': {'$elemMatch': {'status': 'pending', 'send_at': {'$lte': now}}}},
            {'_id': 1, 'scheduled_replies': 1, 'email': 1, 'username': 1}
        ))
        for doc in docs:
            for sched in doc.get('scheduled_replies', []):
                if sched.get('status') != 'pending':
                    continue
                send_at = sched.get('send_at')
                if not send_at or send_at > now:
                    continue

                # Fire it as a real reply
                reply = {
                    '_id': ObjectId(),
                    'text': sched.get('text', ''),
                    'from': 'admin',
                    'image_url': sched.get('image_url'),
                    'scheduled_reply_id': str(sched.get('_id', '')),
                    'created_at': now,
                }
                _col().update_one(
                    {'_id': doc['_id'], 'scheduled_replies._id': sched['_id']},
                    {
                        '$set': {
                            'scheduled_replies.$.status': 'sent',
                            'status': 'replied',
                            'updated_at': now,
                            'read_by_admin': True,
                            'read_by_user': False,
                        },
                        '$push': {'replies': reply},
                        '$unset': {'admin_draft': ''},
                    }
                )
                # Send notification email
                if doc.get('email'):
                    _send_support_notification_email(doc['email'], doc.get('username', ''))

    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f'fire_scheduled_replies error: {e}')
