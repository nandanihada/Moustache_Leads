from flask import Blueprint, request, jsonify, send_from_directory
from datetime import datetime
from bson import ObjectId
import os
import uuid
import threading
from werkzeug.utils import secure_filename
from database import db_instance
from utils.auth import token_required, admin_required
from services.email_service import get_email_service

support_bp = Blueprint('support', __name__)

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
                logging.getLogger(__name__).error(f"❌ Email service not configured! Cannot send support notification to {to_email}")
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
    return doc


# ── Image upload endpoint ──────────────────────────────────────────────────────
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


# ── Publisher: send a new message ──────────────────────────────────────────────
@support_bp.route('/api/support/messages', methods=['POST'])
@token_required
def send_message():
    user = request.current_user
    data = request.get_json() or {}
    subject = (data.get('subject') or '').strip()
    body = (data.get('body') or '').strip()
    image_url = (data.get('image_url') or '').strip()

    if not body and not image_url:
        return jsonify({'error': 'Message body or image is required'}), 400

    doc = {
        'user_id': ObjectId(str(user['_id'])),
        'username': user.get('username', ''),
        'email': user.get('email', ''),
        'subject': subject or 'General Query',
        'body': body,
        'image_url': image_url or None,
        'status': 'open',
        'replies': [],
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'read_by_admin': False,
        'read_by_user': True,
    }
    result = _col().insert_one(doc)
    doc['_id'] = str(result.inserted_id)
    doc['user_id'] = str(doc['user_id'])
    return jsonify({'success': True, 'message': doc}), 201


# ── Publisher: reply to a conversation ─────────────────────────────────────────
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
            }
        }
    )

    updated = _col().find_one({'_id': ObjectId(message_id)})
    return jsonify({'success': True, 'message': _serialize(updated)})


# ── Publisher: get unread count for sidebar badge ──────────────────────────────
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


# ── Publisher: check for admin replies (used on login popup) ───────────────────
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


# ── Publisher: mark all replies as read by user ─────────────────────────────────
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


# ── Admin: get all messages ─────────────────────────────────────────────────────
@support_bp.route('/api/admin/support/messages', methods=['GET'])
@token_required
@admin_required
def admin_get_all_messages():
    status_filter = request.args.get('status')
    query = {}
    if status_filter and status_filter != 'all':
        query['status'] = status_filter

    docs = list(_col().find(query, sort=[('updated_at', -1)]))

    # Compute counts for all statuses
    total = _col().count_documents({})
    new_count = _col().count_documents({'status': 'open', 'read_by_admin': False})
    open_count = _col().count_documents({'status': 'open'})
    replied_count = _col().count_documents({'status': 'replied'})
    closed_count = _col().count_documents({'status': 'closed'})

    return jsonify({
        'success': True,
        'messages': [_serialize(d) for d in docs],
        'counts': {
            'total': total,
            'new': new_count,
            'open': open_count,
            'replied': replied_count,
            'closed': closed_count,
        }
    })


# ── Admin: unread count for sidebar badge ──────────────────────────────────────
@support_bp.route('/api/admin/support/unread-count', methods=['GET'])
@token_required
@admin_required
def admin_unread_count():
    count = _col().count_documents({'read_by_admin': False, 'status': {'$ne': 'closed'}})
    total = _col().count_documents({})
    return jsonify({'success': True, 'unread_count': count, 'total_messages': total})


# ── Admin: reply to a message ───────────────────────────────────────────────────
@support_bp.route('/api/admin/support/messages/<message_id>/reply', methods=['POST'])
@token_required
@admin_required
def admin_reply(message_id):
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
                'last_read_by_admin_at': datetime.utcnow(),
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


# ── Admin: mark message as read ─────────────────────────────────────────────────
@support_bp.route('/api/admin/support/messages/<message_id>/read', methods=['PUT'])
@token_required
@admin_required
def admin_mark_read(message_id):
    now = datetime.utcnow()
    _col().update_one(
        {'_id': ObjectId(message_id)},
        {'$set': {'read_by_admin': True, 'last_read_by_admin_at': now}}
    )
    return jsonify({'success': True})


# ── Close ticket (admin or user) ───────────────────────────────────────────────
@support_bp.route('/api/admin/support/messages/<message_id>/close', methods=['PUT'])
@token_required
@admin_required
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


# ── Admin: get all publishers (for recipient selector) ─────────────────────────
@support_bp.route('/api/admin/support/users', methods=['GET'])
@token_required
@admin_required
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


# ── Admin: broadcast message to all or selected users ─────────────────────────
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
            'status': 'replied',          # admin initiated — show as replied so popup fires
            'replies': [{
                '_id': ObjectId(),
                'text': body,
                'from': 'admin',
                'created_at': now,
            }],
            'created_at': now,
            'updated_at': now,
            'read_by_admin': True,
            'read_by_user': False,        # user hasn't seen it yet → triggers popup on login
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


# ── Admin: delete a single message (for everyone) ────────────────────────────
@support_bp.route('/api/admin/support/messages/<message_id>', methods=['DELETE'])
@token_required
@admin_required
def admin_delete_message(message_id):
    """Delete a support message entirely — removes it for both admin and user"""
    try:
        result = _col().delete_one({'_id': ObjectId(message_id)})
        if result.deleted_count == 0:
            return jsonify({'error': 'Message not found'}), 404
        return jsonify({'success': True, 'message': 'Message deleted for everyone'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Admin: delete a specific reply from a message ─────────────────────────────
@support_bp.route('/api/admin/support/messages/<message_id>/replies/<reply_id>', methods=['DELETE'])
@token_required
@admin_required
def admin_delete_reply(message_id, reply_id):
    """Delete a specific reply from a message — removes it for everyone"""
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


# ── Admin: bulk delete multiple messages ──────────────────────────────────────
@support_bp.route('/api/admin/support/messages/bulk-delete', methods=['POST'])
@token_required
@admin_required
def admin_bulk_delete_messages():
    """Delete multiple support messages at once — removes them for everyone"""
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
