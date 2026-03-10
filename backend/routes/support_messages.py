from flask import Blueprint, request, jsonify
from datetime import datetime
from bson import ObjectId
import os
import threading
from database import db_instance
from utils.auth import token_required, admin_required
from services.email_service import get_email_service

support_bp = Blueprint('support', __name__)


def _log_email_activity(source: str, recipient_count: int, admin_user: dict = None, note: str = '') -> None:
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


def _send_support_notification_email(to_email: str, username: str) -> None:
    """Send a non-blocking email notifying user they have a new support reply."""
    def _send():
        try:
            frontend_url = os.getenv('FRONTEND_URL', 'https://moustacheleads.com')
            dashboard_url = f"{frontend_url}/dashboard/support"
            email_service = get_email_service()

            logo_url = f"{frontend_url}/logo.png"
            year = datetime.utcnow().year

            html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>We got back to you — MoustacheLeads Support</title>
</head>
<body style="margin:0;padding:0;background-color:#0f0f0f;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0f0f0f;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%;">

          <!-- Logo header -->
          <tr>
            <td align="center" style="padding:0 0 28px 0;">
              <img src="{logo_url}" alt="MoustacheLeads" width="160" style="display:block;height:auto;" />
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#1a1a1a;border-radius:16px;overflow:hidden;border:1px solid #2a2a2a;">

              <!-- Amber top bar -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:linear-gradient(90deg,#f59e0b,#d97706);height:4px;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Body -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:48px 44px 40px 44px;">

                    <!-- Icon badge -->
                    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 28px auto;">
                      <tr>
                        <td align="center" style="background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:50%;width:56px;height:56px;font-size:26px;line-height:56px;text-align:center;">
                          💬
                        </td>
                      </tr>
                    </table>

                    <!-- Headline -->
                    <p style="margin:0 0 8px 0;text-align:center;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">
                      We got back to you, {username}
                    </p>
                    <p style="margin:0 0 32px 0;text-align:center;font-size:15px;color:#9ca3af;line-height:1.6;">
                      Our support team has responded to your message.<br>
                      Head over to your dashboard to continue the conversation.
                    </p>

                    <!-- Divider -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 32px 0;">
                      <tr><td style="border-top:1px solid #2a2a2a;font-size:0;line-height:0;">&nbsp;</td></tr>
                    </table>

                    <!-- Info blurb -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#111111;border-radius:10px;margin:0 0 32px 0;">
                      <tr>
                        <td style="padding:20px 24px;">
                          <p style="margin:0 0 6px 0;font-size:12px;font-weight:600;color:#f59e0b;text-transform:uppercase;letter-spacing:1px;">From the Support Team</p>
                          <p style="margin:0;font-size:14px;color:#d1d5db;line-height:1.7;">
                            We've reviewed your query and left a response waiting for you. Log in to your dashboard to read it and reply if needed — we're here to help.
                          </p>
                        </td>
                      </tr>
                    </table>

                    <!-- CTA button -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center">
                          <a href="{dashboard_url}" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#d97706);color:#000000;padding:15px 52px;text-decoration:none;border-radius:50px;font-weight:700;font-size:15px;letter-spacing:0.3px;">
                            View My Response →
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Fallback link -->
                    <p style="margin:24px 0 0 0;text-align:center;font-size:12px;color:#4b5563;">
                      Button not working? <a href="{dashboard_url}" style="color:#f59e0b;text-decoration:underline;">Click here</a>
                    </p>

                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:28px 0 0 0;text-align:center;">
              <p style="margin:0 0 6px 0;font-size:13px;color:#6b7280;">
                You're receiving this because you have an open support ticket with MoustacheLeads.
              </p>
              <p style="margin:0;font-size:12px;color:#374151;">
                © {year} MoustacheLeads. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

            email_service._send_email(to_email, "You have a new reply from MoustacheLeads Support", html)
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
        'status': 'open',
        'replies': [],
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'read_by_admin': False,
        'read_by_user': True,   # user just wrote it, so they've "read" it
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
    _col().update_many(
        {'user_id': ObjectId(str(user['_id'])), 'status': 'replied'},
        {'$set': {'read_by_user': True}}
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
                'read_by_user': False,   # user hasn't seen this reply yet
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
        _log_email_activity('support_reply', 1, request.current_user, note=f"Reply to {username}")

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
