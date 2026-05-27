from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from bson import ObjectId
import os
import threading
import logging

from database import db_instance
from utils.auth import token_required, subadmin_or_admin_required
from services.email_service import get_email_service
from routes.support_messages import _send_support_notification_email

postback_reminder_bp = Blueprint('postback_reminder', __name__)
logger = logging.getLogger(__name__)

def build_reminder_email_html(username, message_body):
    frontend_url = os.environ.get('FRONTEND_URL', 'https://moustacheleads.com')
    # Replace newlines with <br/> to preserve formatting
    formatted_message = message_body.replace('\n', '<br/>')
    
    html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:40px 20px;font-family:Arial,sans-serif;background:#f5f5f5;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
<div style="text-align:center;margin-bottom:24px;">
<img src="{frontend_url}/logo.png" alt="Moustache Leads" style="height:40px;" onerror="this.style.display='none'" />
<h1 style="margin:8px 0 0;font-size:20px;color:#111;">Moustache Leads</h1>
</div>
<h2 style="margin:0 0 16px;color:#111;font-size:18px;">Postback Configuration Reminder</h2>
<div style="font-size:15px;color:#333;line-height:1.6;background:#fafafa;padding:20px;border-left:4px solid #f97316;border-radius:4px;margin-bottom:24px;">
{formatted_message}
</div>
<div style="text-align:center;margin-top:20px;">
<a href="{frontend_url}/publisher/signin" style="display:inline-block;padding:12px 28px;background:#f97316;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Log in to Update Postback</a>
</div>
<p style="font-size:11px;color:#999;margin-top:32px;text-align:center;">
© {datetime.utcnow().year} Moustache Leads. All rights reserved.
</p>
</div>
</body></html>"""
    return html

def _log_reminder_history(user_id, username, email, message, notification_type, status, error_message=None):
    """Log the reminder in postback_reminder_logs collection"""
    try:
        logs_col = db_instance.get_collection('postback_reminder_logs')
        if logs_col is not None:
            logs_col.insert_one({
                'user_id': ObjectId(user_id),
                'username': username,
                'email': email,
                'message': message,
                'notification_type': notification_type,
                'status': status,
                'error_message': error_message,
                'sent_at': datetime.utcnow()
            })
    except Exception as e:
        logger.error(f"Error logging reminder history: {str(e)}")

def substitute_placeholders(message, user):
    username = user.get('username', 'there')
    postback_url = user.get('postback_url') or 'Not configured'
    return message.replace('{username}', username).replace('{postback_url}', postback_url)

def send_chat_reminder(user, message):
    """Send reminder via support inbox chat"""
    support_col = db_instance.get_collection('support_messages')
    if support_col is None:
        raise Exception("Support message database collection not available")
        
    now = datetime.utcnow()
    
    # Check if there is already an open support ticket for this user containing 'Postback Configuration'
    # Or create a brand new admin-initiated ticket
    doc = {
        'user_id': ObjectId(user['_id']),
        'username': user.get('username', ''),
        'email': user.get('email', ''),
        'subject': 'Postback Configuration Required',
        'body': message,
        'status': 'replied',  # Shows as replied so publisher popup triggers
        'replies': [{
            '_id': ObjectId(),
            'text': message,
            'from': 'admin',
            'created_at': now
        }],
        'created_at': now,
        'updated_at': now,
        'read_by_admin': True,
        'read_by_user': False,
        'is_reminder': True
    }
    
    support_col.insert_one(doc)
    
    # Notify user via standard support email notification
    user_email = user.get('email')
    username = user.get('username', 'there')
    if user_email:
        _send_support_notification_email(user_email, username)

def send_email_reminder(user, message):
    """Send reminder via Hostinger SMTP email service"""
    email_service = get_email_service()
    if not email_service or not email_service.is_configured:
        raise Exception("SMTP Email service is not configured on the server. Please verify SMTP settings.")
        
    user_email = user.get('email')
    if not user_email:
        raise Exception("User has no email address configured")
        
    username = user.get('username', 'there')
    subject = "Action Required: Complete Your Postback Configuration"
    html_content = build_reminder_email_html(username, message)
    
    success = email_service._send_email(user_email, subject, html_content)
    if not success:
        raise Exception("Failed to send email. SMTP server rejected the request.")

@postback_reminder_bp.route('/send-reminder', methods=['POST'])
@token_required
@subadmin_or_admin_required('partners')
def send_reminder():
    """Send a postback reminder to a single user"""
    try:
        data = request.get_json() or {}
        user_id = data.get('userId')
        message = data.get('message')
        notification_type = data.get('notificationType', 'chat')
        
        if not user_id or not message:
            return jsonify({'error': 'userId and message are required'}), 400
            
        users_col = db_instance.get_collection('users')
        user = users_col.find_one({'_id': ObjectId(user_id)})
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        # Anti-spam check: prevent sending reminders too frequently (within 30 seconds)
        last_sent = user.get('lastReminderSent')
        if last_sent:
            if isinstance(last_sent, str):
                try:
                    if last_sent.endswith('Z'):
                        last_sent = last_sent[:-1]
                    last_sent_dt = datetime.fromisoformat(last_sent)
                except Exception:
                    last_sent_dt = None
            else:
                last_sent_dt = last_sent
                
            if last_sent_dt and (datetime.utcnow() - last_sent_dt) < timedelta(seconds=30):
                return jsonify({'error': f"A reminder was already sent to {user.get('username')} within the last 30 seconds. Please wait."}), 429
                
        # Deliver reminder
        try:
            personalized_message = substitute_placeholders(message, user)
            if notification_type == 'email':
                send_email_reminder(user, personalized_message)
            else:
                send_chat_reminder(user, personalized_message)
                
            # Log successful delivery
            _log_reminder_history(user_id, user.get('username'), user.get('email'), personalized_message, notification_type, 'delivered')
        except Exception as delivery_err:
            error_msg = str(delivery_err)
            # Log failed delivery
            _log_reminder_history(user_id, user.get('username'), user.get('email'), message, notification_type, 'failed', error_msg)
            return jsonify({'error': f"Delivery failure: {error_msg}"}), 500
            
        # Update user tracking stats
        postback_url = user.get('postback_url', '')
        postback_configured = bool(postback_url and postback_url.strip())
        has_sub1 = bool(postback_url and '{sub1}' in postback_url)
        
        new_count = user.get('reminderCount', 0) + 1
        now_dt = datetime.utcnow()
        
        users_col.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': {
                'lastReminderSent': now_dt,
                'reminderCount': new_count,
                'notificationType': notification_type,
                'postbackConfigured': postback_configured,
                'hasSub1': has_sub1,
                'updated_at': now_dt
            }}
        )
        
        return jsonify({
            'success': True,
            'message': 'Reminder sent successfully',
            'user': {
                'reminderCount': new_count,
                'lastReminderSent': now_dt.isoformat() + 'Z',
                'notificationType': notification_type
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error sending reminder: {str(e)}")
        return jsonify({'error': str(e)}), 500

@postback_reminder_bp.route('/send-bulk-reminder', methods=['POST'])
@token_required
@subadmin_or_admin_required('partners')
def send_bulk_reminder():
    """Send postback reminders to multiple users in bulk"""
    try:
        data = request.get_json() or {}
        user_ids = data.get('userIds', [])
        message = data.get('message')
        notification_type = data.get('notificationType', 'chat')
        
        if not user_ids or not message:
            return jsonify({'error': 'userIds and message are required'}), 400
            
        users_col = db_instance.get_collection('users')
        
        success_count = 0
        failed_count = 0
        failed_users = []
        
        # Resolve objects from database
        object_ids = [ObjectId(uid) for uid in user_ids]
        users = list(users_col.find({'_id': {'$in': object_ids}}))
        
        now_dt = datetime.utcnow()
        
        for user in users:
            user_id_str = str(user['_id'])
            
            # Anti-spam check (30 seconds) per user
            last_sent = user.get('lastReminderSent')
            is_spam = False
            if last_sent:
                if isinstance(last_sent, str):
                    try:
                        if last_sent.endswith('Z'):
                            last_sent = last_sent[:-1]
                        last_sent_dt = datetime.fromisoformat(last_sent)
                    except Exception:
                        last_sent_dt = None
                else:
                    last_sent_dt = last_sent
                    
                if last_sent_dt and (datetime.utcnow() - last_sent_dt) < timedelta(seconds=30):
                    is_spam = True
                    
            if is_spam:
                failed_count += 1
                failed_users.append({
                    'username': user.get('username'),
                    'reason': 'A reminder was sent too recently (within 30s limit)'
                })
                continue
                
            try:
                personalized_message = substitute_placeholders(message, user)
                if notification_type == 'email':
                    send_email_reminder(user, personalized_message)
                else:
                    send_chat_reminder(user, personalized_message)
                
                # Update user document
                postback_url = user.get('postback_url', '')
                postback_configured = bool(postback_url and postback_url.strip())
                has_sub1 = bool(postback_url and '{sub1}' in postback_url)
                new_count = user.get('reminderCount', 0) + 1
                
                users_col.update_one(
                    {'_id': user['_id']},
                    {'$set': {
                        'lastReminderSent': now_dt,
                        'reminderCount': new_count,
                        'notificationType': notification_type,
                        'postbackConfigured': postback_configured,
                        'hasSub1': has_sub1,
                        'updated_at': now_dt
                    }}
                )
                
                _log_reminder_history(user_id_str, user.get('username'), user.get('email'), personalized_message, notification_type, 'delivered')
                success_count += 1
                
            except Exception as delivery_err:
                error_msg = str(delivery_err)
                _log_reminder_history(user_id_str, user.get('username'), user.get('email'), message, notification_type, 'failed', error_msg)
                failed_count += 1
                failed_users.append({
                    'username': user.get('username'),
                    'reason': error_msg
                })
                
        return jsonify({
            'success': True,
            'message': f"Reminders processed. Succeeded: {success_count}, Failed: {failed_count}",
            'successCount': success_count,
            'failedCount': failed_count,
            'failedUsers': failed_users
        }), 200
        
    except Exception as e:
        logger.error(f"Error sending bulk reminder: {str(e)}")
        return jsonify({'error': str(e)}), 500

@postback_reminder_bp.route('/users/<user_id>/notification-type', methods=['PUT'])
@token_required
@subadmin_or_admin_required('partners')
def update_notification_type(user_id):
    """Update preferred notification type for a user"""
    try:
        data = request.get_json() or {}
        notification_type = data.get('notificationType')
        
        if not notification_type or notification_type not in ['chat', 'email']:
            return jsonify({'error': 'notificationType is required and must be either "chat" or "email"'}), 400
            
        users_col = db_instance.get_collection('users')
        user = users_col.find_one({'_id': ObjectId(user_id)})
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        users_col.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': {
                'notificationType': notification_type,
                'updated_at': datetime.utcnow()
            }}
        )
        
        return jsonify({
            'success': True,
            'message': 'Notification type updated successfully',
            'notificationType': notification_type
        }), 200
        
    except Exception as e:
        logger.error(f"Error updating notification type: {str(e)}")
        return jsonify({'error': str(e)}), 500
