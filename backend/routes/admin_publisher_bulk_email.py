from flask import Blueprint, request, jsonify
from utils.auth import token_required
from database import db_instance
from bson import ObjectId
import logging
from datetime import datetime, timedelta
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

logger = logging.getLogger(__name__)

admin_publisher_bulk_email_bp = Blueprint('admin_publisher_bulk_email', __name__)

@admin_publisher_bulk_email_bp.route('/api/admin/publishers/test-bulk', methods=['GET'])
def test_bulk_endpoint():
    """Test endpoint to verify blueprint is registered"""
    return jsonify({'message': 'Bulk email blueprint is working!'}), 200

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


def get_matched_offers_for_publisher(publisher, offer_types, limit=5):
    """
    Get matched offers for a specific publisher based on their profile and selected offer types.
    
    Args:
        publisher: Publisher user document
        offer_types: List of offer type filters (e.g., ['top_requested', 'geo_matched'])
        limit: Max offers per type
        
    Returns:
        List of matched offers with metadata
    """
    offers_col = db_instance.get_collection('offers')
    clicks_col = db_instance.get_collection('clicks')
    requests_col = db_instance.get_collection('affiliate_requests')
    
    if offers_col is None:
        logger.error("Offers collection not available")
        return []
    
    matched_offers = []
    seen_offer_ids = set()
    
    # Get publisher profile data
    publisher_id = str(publisher['_id'])
    publisher_level = publisher.get('level', 'L1')
    publisher_geo = publisher.get('preferred_geo') or publisher.get('country')
    publisher_vertical = publisher.get('top_vertical')
    
    logger.info(f"Matching offers for publisher {publisher_id}: level={publisher_level}, geo={publisher_geo}, vertical={publisher_vertical}")
    
    # Base query for active offers - SIMPLIFIED to find ANY active offers
    base_query = {
        '$or': [
            {'status': 'active'},
            {'status': 'running'}
        ]
    }
    
    # Count total active offers
    total_active = offers_col.count_documents(base_query)
    logger.info(f"Total active offers in database: {total_active}")
    
    for offer_type in offer_types:
        type_offers = []
        
        if offer_type == 'top_requested':
            # Get offers with highest request count
            pipeline = [
                {'$match': base_query},
                {'$lookup': {
                    'from': 'affiliate_requests',
                    'localField': 'offer_id',
                    'foreignField': 'offer_id',
                    'as': 'requests'
                }},
                {'$addFields': {'request_count': {'$size': '$requests'}}},
                {'$sort': {'request_count': -1}},
                {'$limit': limit * 2}  # Get more to ensure we have enough
            ]
            type_offers = list(offers_col.aggregate(pipeline))
            logger.info(f"Found {len(type_offers)} top_requested offers")
            
        elif offer_type == 'highest_clicked':
            # Get offers with highest click volume
            pipeline = [
                {'$match': base_query},
                {'$lookup': {
                    'from': 'clicks',
                    'localField': 'offer_id',
                    'foreignField': 'offer_id',
                    'as': 'clicks'
                }},
                {'$addFields': {'click_count': {'$size': '$clicks'}}},
                {'$sort': {'click_count': -1}},
                {'$limit': limit * 2}
            ]
            type_offers = list(offers_col.aggregate(pipeline))
            logger.info(f"Found {len(type_offers)} highest_clicked offers")
            
        elif offer_type == 'most_approved':
            # Get offers with best approval rate - RELAXED criteria
            pipeline = [
                {'$match': base_query},
                {'$lookup': {
                    'from': 'affiliate_requests',
                    'localField': 'offer_id',
                    'foreignField': 'offer_id',
                    'as': 'requests'
                }},
                {'$addFields': {
                    'total_requests': {'$size': '$requests'},
                    'approved_requests': {
                        '$size': {
                            '$filter': {
                                'input': '$requests',
                                'as': 'req',
                                'cond': {'$eq': ['$$req.status', 'approved']}
                            }
                        }
                    }
                }},
                {'$addFields': {
                    'approval_rate': {
                        '$cond': [
                            {'$gt': ['$total_requests', 0]},
                            {'$divide': ['$approved_requests', '$total_requests']},
                            0
                        ]
                    }
                }},
                {'$match': {'total_requests': {'$gte': 1}}},  # Min 1 request (relaxed from 5)
                {'$sort': {'approval_rate': -1}},
                {'$limit': limit * 2}
            ]
            type_offers = list(offers_col.aggregate(pipeline))
            logger.info(f"Found {len(type_offers)} most_approved offers")
            
        elif offer_type == 'recently_added':
            # Get recently added or edited offers - EXTENDED to 30 days
            cutoff_date = datetime.utcnow() - timedelta(days=30)
            query = {**base_query, 'created_at': {'$gte': cutoff_date}}
            type_offers = list(offers_col.find(query).sort('created_at', -1).limit(limit * 2))
            logger.info(f"Found {len(type_offers)} recently_added offers")
            
        elif offer_type == 'geo_matched':
            # Get offers matching publisher's geo OR global offers
            if publisher_geo:
                query = {
                    **base_query,
                    '$or': [
                        {'allowed_countries': publisher_geo},
                        {'countries': publisher_geo},
                        {'allowed_countries': {'$size': 0}},
                        {'allowed_countries': {'$exists': False}},
                        {'allowed_countries': []}
                    ]
                }
            else:
                # If no geo, just get any active offers
                query = base_query
            type_offers = list(offers_col.find(query).limit(limit * 2))
            logger.info(f"Found {len(type_offers)} geo_matched offers for geo={publisher_geo}")
            
        elif offer_type == 'vertical_matched':
            # Get offers matching publisher's vertical
            if publisher_vertical:
                query = {
                    **base_query,
                    '$or': [
                        {'vertical': publisher_vertical},
                        {'category': publisher_vertical}
                    ]
                }
            else:
                # If no vertical, just get any active offers
                query = base_query
            type_offers = list(offers_col.find(query).limit(limit * 2))
            logger.info(f"Found {len(type_offers)} vertical_matched offers for vertical={publisher_vertical}")
            
        elif offer_type == 'custom':
            # Custom selection will be handled separately
            continue
        
        # If no offers found for this type, get ANY active offers as fallback
        if not type_offers:
            logger.warning(f"No offers found for type {offer_type}, using fallback")
            type_offers = list(offers_col.find(base_query).limit(limit))
            logger.info(f"Fallback found {len(type_offers)} offers")
        
        # Add offers to matched list (deduplicate)
        for offer in type_offers:
            offer_id = offer.get('offer_id')
            if offer_id and offer_id not in seen_offer_ids:
                seen_offer_ids.add(offer_id)
                matched_offers.append({
                    'offer_id': offer_id,
                    'name': offer.get('name'),
                    'payout': offer.get('payout', 0),
                    'vertical': offer.get('vertical') or offer.get('category', 'N/A'),
                    'countries': offer.get('allowed_countries') or offer.get('countries', []),
                    'match_type': offer_type,
                    'match_score': calculate_match_score(offer, publisher)
                })
    
    # Sort by match score
    matched_offers.sort(key=lambda x: x.get('match_score', 0), reverse=True)
    
    logger.info(f"Total matched offers for publisher {publisher_id}: {len(matched_offers)}")
    
    return matched_offers[:20]  # Max 20 offers per publisher


def calculate_match_score(offer, publisher):
    """Calculate how well an offer matches a publisher's profile (0-100)"""
    score = 50  # Base score
    
    publisher_geo = publisher.get('preferred_geo') or publisher.get('country')
    publisher_vertical = publisher.get('top_vertical')
    
    # Geo match (+20)
    if publisher_geo:
        offer_countries = offer.get('allowed_countries') or offer.get('countries', [])
        if publisher_geo in offer_countries:
            score += 20
    
    # Vertical match (+20)
    if publisher_vertical:
        offer_vertical = offer.get('vertical') or offer.get('category')
        if offer_vertical == publisher_vertical:
            score += 20
    
    # Level match (+10)
    publisher_level = publisher.get('level', 'L1')
    if publisher_level in ['L4', 'L5', 'L7']:  # Active publishers
        score += 10
    
    return min(score, 100)


def send_bulk_email_with_offers(recipient_email, recipient_name, subject, message, offers, sender_name):
    """Send email with personalized offer list"""
    try:
        smtp_host = os.getenv('SMTP_HOST', 'smtp.gmail.com')
        smtp_port = int(os.getenv('SMTP_PORT', 587))
        smtp_user = os.getenv('SMTP_USER', 'business@moustacheleads.com')
        smtp_pass = os.getenv('SMTP_PASS', '').strip()
        from_email = os.getenv('FROM_EMAIL', 'business@moustacheleads.com')
        
        logger.info(f"Attempting to send email to {recipient_email}")
        logger.info(f"SMTP Config: host={smtp_host}, port={smtp_port}, user={smtp_user}")
        logger.info(f"SMTP_PASS configured: {bool(smtp_pass)}")
        
        if not smtp_pass:
            logger.error("SMTP_PASS not configured in .env file")
            return False, "Email configuration missing"
        
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"{sender_name} <{from_email}>"
        msg['To'] = recipient_email
        
        # Build offers HTML
        offers_html = ""
        if offers:
            offers_html = '<div style="margin: 20px 0;"><h3 style="color: #667eea; margin-bottom: 15px;">🎯 Recommended Offers for You</h3>'
            for offer in offers:
                countries_str = ', '.join(offer.get('countries', [])[:3])
                offers_html += f'''
                <div style="background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 8px; padding: 15px; margin-bottom: 10px; border-left: 4px solid #667eea;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1;">
                            <h4 style="margin: 0 0 5px 0; color: #333; font-size: 16px;">{offer.get('name', 'Unnamed Offer')}</h4>
                            <p style="margin: 5px 0; color: #666; font-size: 13px;">
                                <strong>Vertical:</strong> {offer.get('vertical', 'N/A')} | 
                                <strong>Geo:</strong> {countries_str or 'Global'}
                            </p>
                        </div>
                        <div style="text-align: right; margin-left: 15px;">
                            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 8px 15px; border-radius: 6px; font-weight: bold; font-size: 14px;">
                                ${offer.get('payout', 0):.2f}
                            </div>
                            <div style="margin-top: 5px; font-size: 11px; color: #667eea; font-weight: 600;">
                                {offer.get('match_score', 0)}% Match
                            </div>
                        </div>
                    </div>
                </div>
                '''
            offers_html += '</div>'
        
        # Create HTML email
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4;">
            <div style="max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 600;">🎯 Moustache Leads</h1>
                </div>
                <div style="padding: 30px;">
                    <div style="font-size: 18px; font-weight: 600; color: #333; margin-bottom: 20px;">Hi {recipient_name},</div>
                    <div style="color: #555; line-height: 1.8; white-space: pre-wrap; word-wrap: break-word;">{message}</div>
                    
                    {offers_html}
                    
                    <div style="height: 1px; background: #e9ecef; margin: 20px 0;"></div>
                    <p style="color: #6c757d; font-size: 14px; margin-top: 20px;">
                        Best regards,<br>
                        <strong>{sender_name}</strong><br>
                        Moustache Leads Team
                    </p>
                    <a href="https://moustacheleads.com/dashboard" style="display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600;">Go to Dashboard</a>
                </div>
                <div style="background: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #e9ecef;">
                    <p style="margin: 5px 0; color: #6c757d; font-size: 14px;"><strong>Moustache Leads</strong></p>
                    <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Your trusted affiliate marketing platform</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Plain text version
        offers_text = ""
        if offers:
            offers_text = "\n\n🎯 RECOMMENDED OFFERS FOR YOU:\n" + "="*50 + "\n"
            for i, offer in enumerate(offers, 1):
                countries_str = ', '.join(offer.get('countries', [])[:3])
                offers_text += f"\n{i}. {offer.get('name', 'Unnamed Offer')}\n"
                offers_text += f"   Payout: ${offer.get('payout', 0):.2f}\n"
                offers_text += f"   Vertical: {offer.get('vertical', 'N/A')}\n"
                offers_text += f"   Geo: {countries_str or 'Global'}\n"
                offers_text += f"   Match: {offer.get('match_score', 0)}%\n"
        
        text_body = f"""
Hi {recipient_name},

{message}
{offers_text}

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
        logger.info(f"Connecting to SMTP server {smtp_host}:{smtp_port}...")
        with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as server:
            logger.info("Starting TLS...")
            server.starttls()
            logger.info(f"Logging in as {smtp_user}...")
            server.login(smtp_user, smtp_pass)
            logger.info("Sending message...")
            server.send_message(msg)
            logger.info(f"Email sent successfully to {recipient_email}")
        
        return True, None
        
    except smtplib.SMTPAuthenticationError as e:
        error_msg = f"SMTP Authentication failed: {str(e)}"
        logger.error(error_msg)
        return False, error_msg
    except smtplib.SMTPException as e:
        error_msg = f"SMTP error: {str(e)}"
        logger.error(error_msg)
        return False, error_msg
    except Exception as e:
        error_msg = f"Failed to send email: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return False, error_msg


@admin_publisher_bulk_email_bp.route('/api/admin/publishers/bulk-email', methods=['POST', 'OPTIONS'])
@token_required
@admin_required
def send_bulk_email_to_publishers():
    """Send personalized emails with matched offers to multiple publishers"""
    try:
        current_user = request.current_user
        admin_name = current_user.get('name') or current_user.get('username') or 'Admin'
        
        data = request.get_json()
        publisher_ids = data.get('publisher_ids', [])
        offer_types = data.get('offer_types', [])
        subject = data.get('subject', '').strip()
        message = data.get('message', '').strip()
        custom_offer_ids = data.get('custom_offer_ids', [])  # For custom selection
        
        # Validation
        if not publisher_ids or len(publisher_ids) == 0:
            return jsonify({'error': 'No publishers selected'}), 400
        if len(publisher_ids) > 100:
            return jsonify({'error': 'Cannot send to more than 100 publishers at once'}), 400
        if not subject:
            return jsonify({'error': 'Subject is required'}), 400
        if not message:
            return jsonify({'error': 'Message is required'}), 400
        if not offer_types or len(offer_types) == 0:
            return jsonify({'error': 'At least one offer type must be selected'}), 400
        
        # Get all publishers
        users_col = db_instance.get_collection('users')
        if users_col is None:
            return jsonify({'error': 'Database not available'}), 503
        
        publishers = list(users_col.find(
            {'_id': {'$in': [ObjectId(pid) for pid in publisher_ids if ObjectId.is_valid(pid)]}},
            {'email': 1, 'first_name': 1, 'name': 1, 'username': 1, 'level': 1, 'preferred_geo': 1, 'country': 1, 'top_vertical': 1}
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
            
            # Get matched offers for this publisher
            if 'custom' in offer_types and custom_offer_ids:
                # Use custom selected offers
                offers_col = db_instance.get_collection('offers')
                if offers_col is None:
                    matched_offers = []
                else:
                    matched_offers = []
                    for offer_id in custom_offer_ids:
                        offer = offers_col.find_one({'offer_id': offer_id})
                        if offer:
                            matched_offers.append({
                            'offer_id': offer_id,
                            'name': offer.get('name'),
                            'payout': offer.get('payout'),
                            'vertical': offer.get('vertical') or offer.get('category'),
                            'countries': offer.get('allowed_countries') or offer.get('countries', []),
                            'match_type': 'custom',
                            'match_score': calculate_match_score(offer, publisher)
                        })
            else:
                matched_offers = get_matched_offers_for_publisher(publisher, offer_types)
            
            # Send email
            success, error_msg = send_bulk_email_with_offers(
                recipient_email=recipient_email,
                recipient_name=recipient_name,
                subject=subject,
                message=message,
                offers=matched_offers,
                sender_name=admin_name
            )
            
            if success:
                success_count += 1
                results.append({
                    'publisher_id': str(publisher['_id']),
                    'email': recipient_email,
                    'status': 'sent',
                    'offers_count': len(matched_offers)
                })
                
                # Log email
                if email_logs_col is not None:
                    email_logs_col.insert_one({
                        'type': 'admin_bulk_email_with_offers',
                        'from_user_id': str(current_user['_id']),
                        'from_name': admin_name,
                        'to_user_id': str(publisher['_id']),
                        'to_email': recipient_email,
                        'to_name': recipient_name,
                        'subject': subject,
                        'message': message,
                        'offer_types': offer_types,
                        'offers_sent': [o['offer_id'] for o in matched_offers],
                        'offers_count': len(matched_offers),
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
                    'reason': error_msg or 'SMTP error'
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


@admin_publisher_bulk_email_bp.route('/api/admin/publishers/email-logs', methods=['GET'])
@token_required
@admin_required
def get_email_logs():
    """Get email logs history"""
    try:
        email_logs_col = db_instance.get_collection('email_logs')
        if email_logs_col is None:
            return jsonify({'error': 'Database not available'}), 503
        
        # Get query parameters
        limit = int(request.args.get('limit', 50))
        skip = int(request.args.get('skip', 0))
        
        # Fetch logs sorted by most recent
        logs = list(email_logs_col.find(
            {'type': 'admin_bulk_email_with_offers'},
            {'_id': 0}
        ).sort('sent_at', -1).skip(skip).limit(limit))
        
        # Get total count
        total_count = email_logs_col.count_documents({'type': 'admin_bulk_email_with_offers'})
        
        return jsonify({
            'success': True,
            'logs': logs,
            'total_count': total_count,
            'limit': limit,
            'skip': skip
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching email logs: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to fetch email logs: {str(e)}'}), 500


@admin_publisher_bulk_email_bp.route('/api/admin/publishers/preview-offers', methods=['POST', 'OPTIONS'])
@token_required
@admin_required
def preview_matched_offers():
    """Preview matched offers for selected publishers before sending"""
    try:
        logger.info("Preview offers endpoint called")
        data = request.get_json()
        logger.info(f"Request data: {data}")
        
        publisher_ids = data.get('publisher_ids', [])
        offer_types = data.get('offer_types', [])
        custom_offer_ids = data.get('custom_offer_ids', [])
        
        logger.info(f"Publisher IDs: {publisher_ids}")
        logger.info(f"Offer types: {offer_types}")
        
        if not publisher_ids:
            logger.error("No publishers selected")
            return jsonify({'error': 'No publishers selected'}), 400
        
        users_col = db_instance.get_collection('users')
        if users_col is None:
            return jsonify({'error': 'Database not available'}), 503
        
        publishers = list(users_col.find(
            {'_id': {'$in': [ObjectId(pid) for pid in publisher_ids if ObjectId.is_valid(pid)]}},
            {'email': 1, 'first_name': 1, 'name': 1, 'username': 1, 'level': 1, 'preferred_geo': 1, 'country': 1, 'top_vertical': 1}
        ))
        
        preview_data = []
        
        for publisher in publishers:
            publisher_name = publisher.get('first_name') or publisher.get('name') or publisher.get('username') or 'Publisher'
            
            # Get matched offers
            if 'custom' in offer_types and custom_offer_ids:
                offers_col = db_instance.get_collection('offers')
                if offers_col is None:
                    matched_offers = []
                else:
                    matched_offers = []
                    for offer_id in custom_offer_ids:
                        offer = offers_col.find_one({'offer_id': offer_id})
                        if offer:
                            matched_offers.append({
                            'offer_id': offer_id,
                            'name': offer.get('name'),
                            'payout': offer.get('payout'),
                            'vertical': offer.get('vertical') or offer.get('category'),
                            'countries': offer.get('allowed_countries') or offer.get('countries', []),
                            'match_type': 'custom',
                            'match_score': calculate_match_score(offer, publisher)
                        })
            else:
                matched_offers = get_matched_offers_for_publisher(publisher, offer_types)
            
            preview_data.append({
                'publisher_id': str(publisher['_id']),
                'publisher_name': publisher_name,
                'publisher_level': publisher.get('level', 'L1'),
                'publisher_geo': publisher.get('preferred_geo') or publisher.get('country'),
                'publisher_vertical': publisher.get('top_vertical'),
                'matched_offers': matched_offers,
                'offers_count': len(matched_offers)
            })
        
        return jsonify({
            'success': True,
            'preview_data': preview_data
        }), 200
        
    except Exception as e:
        logger.error(f"Error previewing offers: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to preview offers: {str(e)}'}), 500
