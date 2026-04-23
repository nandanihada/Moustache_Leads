from flask import Blueprint, request, jsonify
from utils.auth import token_required
from database import db_instance
from bson import ObjectId
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
import os

logger = logging.getLogger(__name__)

admin_publisher_email_bp = Blueprint('admin_publisher_email', __name__)

def admin_required(f):
    """Decorator to require admin role"""
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = getattr(request, 'current_user', None)
        if not user or user.get('role') not in ('admin', 'subadmin'):
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated_function

def send_email_to_publisher(recipient_email, recipient_name, subject, message_body, sender_name):
    """Send email to publisher using SMTP"""
    try:
        smtp_host = os.getenv('SMTP_HOST', 'smtp.gmail.com')
        smtp_port = int(os.getenv('SMTP_PORT', 587))
        smtp_user = os.getenv('SMTP_USER', 'business@moustacheleads.com')
        smtp_pass = os.getenv('SMTP_PASS', '').strip()
        from_email = os.getenv('FROM_EMAIL', 'business@moustacheleads.com')
        
        # Validate SMTP credentials
        if not smtp_pass:
            logger.error("SMTP_PASS not configured in .env file")
            raise ValueError("Email configuration missing")
        
        logger.info(f"Attempting to send email to {recipient_email} via {smtp_host}:{smtp_port}")
        
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"{sender_name} <{from_email}>"
        msg['To'] = recipient_email
        
        # Create HTML email template
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    margin: 0;
                    padding: 0;
                    background-color: #f4f4f4;
                }}
                .container {{
                    max-width: 600px;
                    margin: 20px auto;
                    background: white;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }}
                .header {{
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 30px;
                    text-align: center;
                }}
                .header h1 {{
                    margin: 0;
                    font-size: 24px;
                    font-weight: 600;
                }}
                .content {{
                    padding: 30px;
                }}
                .greeting {{
                    font-size: 18px;
                    font-weight: 600;
                    color: #333;
                    margin-bottom: 20px;
                }}
                .message {{
                    color: #555;
                    line-height: 1.8;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }}
                .footer {{
                    background: #f8f9fa;
                    padding: 20px 30px;
                    text-align: center;
                    border-top: 1px solid #e9ecef;
                }}
                .footer p {{
                    margin: 5px 0;
                    color: #6c757d;
                    font-size: 14px;
                }}
                .button {{
                    display: inline-block;
                    padding: 12px 30px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    text-decoration: none;
                    border-radius: 6px;
                    margin: 20px 0;
                    font-weight: 600;
                }}
                .divider {{
                    height: 1px;
                    background: #e9ecef;
                    margin: 20px 0;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎯 Moustache Leads</h1>
                </div>
                <div class="content">
                    <div class="greeting">Hi {recipient_name},</div>
                    <div class="message">{message_body}</div>
                    <div class="divider"></div>
                    <p style="color: #6c757d; font-size: 14px; margin-top: 20px;">
                        Best regards,<br>
                        <strong>{sender_name}</strong><br>
                        Moustache Leads Team
                    </p>
                    <a href="https://moustacheleads.com/dashboard" class="button">Go to Dashboard</a>
                </div>
                <div class="footer">
                    <p><strong>Moustache Leads</strong></p>
                    <p>Your trusted affiliate marketing platform</p>
                    <p style="font-size: 12px; color: #adb5bd; margin-top: 10px;">
                        This email was sent from Publisher Analytics. If you have any questions, please contact us.
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Plain text version
        text_body = f"""
Hi {recipient_name},

{message_body}

Best regards,
{sender_name}
Moustache Leads Team

---
Moustache Leads
Your trusted affiliate marketing platform
        """
        
        # Attach both versions
        part1 = MIMEText(text_body, 'plain')
        part2 = MIMEText(html_body, 'html')
        msg.attach(part1)
        msg.attach(part2)
        
        # Send email
        with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as server:
            server.set_debuglevel(0)
            logger.info("Connecting to SMTP server...")
            server.starttls()
            logger.info("Starting TLS...")
            server.login(smtp_user, smtp_pass)
            logger.info("Login successful, sending message...")
            server.send_message(msg)
            logger.info(f"Email sent successfully to {recipient_email}")
        
        return True
        
    except smtplib.SMTPAuthenticationError as e:
        logger.error(f"SMTP Authentication failed: {str(e)}")
        return False
    except smtplib.SMTPException as e:
        logger.error(f"SMTP error sending to {recipient_email}: {str(e)}")
        return False
    except Exception as e:
        logger.error(f"Failed to send email to {recipient_email}: {str(e)}", exc_info=True)
        return False


@admin_publisher_email_bp.route('/api/admin/publishers/<publisher_id>/send-email', methods=['POST'])
@token_required
@admin_required
def send_email_to_specific_publisher(publisher_id):
    """Send email to a specific publisher from Publisher Analytics"""
    try:
        current_user = request.current_user
        admin_name = current_user.get('name') or current_user.get('username') or 'Admin'
        
        data = request.get_json()
        subject = data.get('subject', '').strip()
        message = data.get('message', '').strip()
        
        # Validation
        if not subject:
            return jsonify({'error': 'Subject is required'}), 400
        if not message:
            return jsonify({'error': 'Message is required'}), 400
        if len(subject) > 200:
            return jsonify({'error': 'Subject too long (max 200 characters)'}), 400
        if len(message) > 5000:
            return jsonify({'error': 'Message too long (max 5000 characters)'}), 400
        
        # Get publisher details
        users_col = db_instance.get_collection('users')
        if users_col is None:
            return jsonify({'error': 'Database not available'}), 503
        
        publisher = users_col.find_one({'_id': ObjectId(publisher_id)})
        if not publisher:
            return jsonify({'error': 'Publisher not found'}), 404
        
        recipient_email = publisher.get('email')
        if not recipient_email:
            return jsonify({'error': 'Publisher has no email address'}), 400
        
        recipient_name = publisher.get('first_name') or publisher.get('name') or publisher.get('username') or 'Publisher'
        
        # Send email
        success = send_email_to_publisher(
            recipient_email=recipient_email,
            recipient_name=recipient_name,
            subject=subject,
            message_body=message,
            sender_name=admin_name
        )
        
        if not success:
            return jsonify({'error': 'Failed to send email. Please try again.'}), 500
        
        # Log email in database
        email_logs_col = db_instance.get_collection('email_logs')
        if email_logs_col is not None:
            email_logs_col.insert_one({
                'type': 'admin_to_publisher',
                'from_user_id': str(current_user['_id']),
                'from_name': admin_name,
                'to_user_id': publisher_id,
                'to_email': recipient_email,
                'to_name': recipient_name,
                'subject': subject,
                'message': message,
                'status': 'sent',
                'sent_at': datetime.utcnow(),
                'source': 'publisher_analytics'
            })
        
        return jsonify({
            'success': True,
            'message': f'Email sent successfully to {recipient_name} ({recipient_email})'
        }), 200
        
    except Exception as e:
        logger.error(f"Error sending email to publisher: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to send email: {str(e)}'}), 500


@admin_publisher_email_bp.route('/api/admin/publishers/send-bulk-email', methods=['POST'])
@token_required
@admin_required
def send_bulk_email_to_publishers():
    """Send email to multiple publishers at once"""
    try:
        current_user = request.current_user
        admin_name = current_user.get('name') or current_user.get('username') or 'Admin'
        
        data = request.get_json()
        publisher_ids = data.get('publisher_ids', [])
        subject = data.get('subject', '').strip()
        message = data.get('message', '').strip()
        
        # Validation
        if not publisher_ids or len(publisher_ids) == 0:
            return jsonify({'error': 'No publishers selected'}), 400
        if len(publisher_ids) > 100:
            return jsonify({'error': 'Cannot send to more than 100 publishers at once'}), 400
        if not subject:
            return jsonify({'error': 'Subject is required'}), 400
        if not message:
            return jsonify({'error': 'Message is required'}), 400
        
        # Get all publishers
        users_col = db_instance.get_collection('users')
        if users_col is None:
            return jsonify({'error': 'Database not available'}), 503
        
        publishers = list(users_col.find(
            {'_id': {'$in': [ObjectId(pid) for pid in publisher_ids if ObjectId.is_valid(pid)]}},
            {'email': 1, 'first_name': 1, 'name': 1, 'username': 1}
        ))
        
        if not publishers:
            return jsonify({'error': 'No valid publishers found'}), 404
        
        # Send emails
        success_count = 0
        failed_count = 0
        results = []
        
        email_logs_col = db_instance.get_collection('email_logs')
        
        for publisher in publishers:
            recipient_email = publisher.get('email')
            if not recipient_email:
                failed_count += 1
                results.append({
                    'publisher_id': str(publisher['_id']),
                    'status': 'failed',
                    'reason': 'No email address'
                })
                continue
            
            recipient_name = publisher.get('first_name') or publisher.get('name') or publisher.get('username') or 'Publisher'
            
            success = send_email_to_publisher(
                recipient_email=recipient_email,
                recipient_name=recipient_name,
                subject=subject,
                message_body=message,
                sender_name=admin_name
            )
            
            if success:
                success_count += 1
                results.append({
                    'publisher_id': str(publisher['_id']),
                    'email': recipient_email,
                    'status': 'sent'
                })
                
                # Log email
                if email_logs_col is not None:
                    email_logs_col.insert_one({
                        'type': 'admin_bulk_email',
                        'from_user_id': str(current_user['_id']),
                        'from_name': admin_name,
                        'to_user_id': str(publisher['_id']),
                        'to_email': recipient_email,
                        'to_name': recipient_name,
                        'subject': subject,
                        'message': message,
                        'status': 'sent',
                        'sent_at': datetime.utcnow(),
                        'source': 'publisher_analytics_bulk'
                    })
            else:
                failed_count += 1
                results.append({
                    'publisher_id': str(publisher['_id']),
                    'email': recipient_email,
                    'status': 'failed',
                    'reason': 'SMTP error'
                })
        
        return jsonify({
            'success': True,
            'message': f'Sent {success_count} emails successfully, {failed_count} failed',
            'success_count': success_count,
            'failed_count': failed_count,
            'results': results
        }), 200
        
    except Exception as e:
        logger.error(f"Error sending bulk emails: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to send bulk emails: {str(e)}'}), 500
