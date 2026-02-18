# Offer Insights Email Campaign System
# Send targeted emails to partners about top-performing offers

from flask import Blueprint, request, jsonify
from bson import ObjectId
from datetime import datetime, timedelta
import logging
from database import db_instance
from utils.auth import token_required, admin_required
from services.email_verification_service import EmailVerificationService

offer_insights_bp = Blueprint('offer_insights', __name__)
logger = logging.getLogger(__name__)

# Email templates for each insight type
EMAIL_TEMPLATES = {
    'highest_clicks': {
        'subject': '🔥 Hot Offer Alert: {offer_name} is Getting Massive Clicks!',
        'title': 'Trending Offer Alert',
        'subtitle': 'This offer is on fire with clicks!',
        'cta_text': 'Start Promoting Now',
        'highlight_label': 'Total Clicks',
        'color': '#f97316'  # Orange
    },
    'highest_conversions': {
        'subject': '💰 Top Converting Offer: {offer_name} - Don\'t Miss Out!',
        'title': 'High Converting Offer',
        'subtitle': 'Publishers are earning big with this one!',
        'cta_text': 'Grab This Offer',
        'highlight_label': 'Conversions',
        'color': '#22c55e'  # Green
    },
    'high_clicks_low_conversion': {
        'subject': '📊 Optimization Opportunity: {offer_name} Needs Your Touch',
        'title': 'Optimization Opportunity',
        'subtitle': 'High traffic, room for better conversions',
        'cta_text': 'Optimize Now',
        'highlight_label': 'Click Rate',
        'color': '#eab308'  # Yellow
    },
    'most_requested': {
        'subject': '⭐ Popular Demand: {offer_name} - Everyone Wants This!',
        'title': 'Most Requested Offer',
        'subtitle': 'Publishers are asking for this offer!',
        'cta_text': 'Get Access Now',
        'highlight_label': 'Requests',
        'color': '#8b5cf6'  # Purple
    }
}

def get_email_service():
    return EmailVerificationService()

@offer_insights_bp.route('/insights/offers', methods=['GET'])
@token_required
@admin_required
def get_offer_insights():
    """Get offers categorized by insights (clicks, conversions, etc.)"""
    try:
        insight_type = request.args.get('type', 'highest_clicks')
        limit = int(request.args.get('limit', 10))
        days = int(request.args.get('days', 30))  # Last N days
        
        offers_collection = db_instance.get_collection('offers')
        tracking_collection = db_instance.get_collection('tracking_events')
        access_requests_collection = db_instance.get_collection('offer_access_requests')
        clicks_collection = db_instance.get_collection('clicks')  # Alternative clicks collection
        conversions_collection = db_instance.get_collection('conversions')  # Alternative conversions collection
        
        start_date = datetime.utcnow() - timedelta(days=days)
        
        offers = []
        
        if insight_type == 'highest_clicks':
            # Try tracking_events first
            pipeline = [
                {'$match': {'timestamp': {'$gte': start_date}, 'event_type': 'click'}},
                {'$group': {'_id': '$offer_id', 'clicks': {'$sum': 1}}},
                {'$sort': {'clicks': -1}},
                {'$limit': limit}
            ]
            results = list(tracking_collection.aggregate(pipeline))
            
            # If no results, try clicks collection
            if not results and clicks_collection is not None:
                pipeline = [
                    {'$match': {'created_at': {'$gte': start_date}}},
                    {'$group': {'_id': '$offer_id', 'clicks': {'$sum': 1}}},
                    {'$sort': {'clicks': -1}},
                    {'$limit': limit}
                ]
                results = list(clicks_collection.aggregate(pipeline))
            
            # Get offer details
            for r in results:
                if r['_id']:
                    offer = offers_collection.find_one({'offer_id': r['_id']})
                    if offer:
                        offers.append({
                            'offer_id': r['_id'],
                            'name': offer.get('name', 'Unknown'),
                            'payout': offer.get('payout', 0),
                            'image_url': offer.get('image_url', ''),
                            'category': offer.get('category', ''),
                            'metric_value': r['clicks'],
                            'metric_label': 'clicks'
                        })
            
            # Fallback: show top offers by payout if no tracking data
            if not offers:
                top_offers = list(offers_collection.find(
                    {'is_active': True},
                    {'offer_id': 1, 'name': 1, 'payout': 1, 'image_url': 1, 'category': 1}
                ).sort('payout', -1).limit(limit))
                
                for offer in top_offers:
                    offers.append({
                        'offer_id': offer.get('offer_id', ''),
                        'name': offer.get('name', 'Unknown'),
                        'payout': offer.get('payout', 0),
                        'image_url': offer.get('image_url', ''),
                        'category': offer.get('category', ''),
                        'metric_value': offer.get('payout', 0),
                        'metric_label': 'payout ($)'
                    })
            
        elif insight_type == 'highest_conversions':
            # Try tracking_events first (check both 'conversion' and 'completion')
            pipeline = [
                {'$match': {'timestamp': {'$gte': start_date}, 'event_type': {'$in': ['conversion', 'completion']}}},
                {'$group': {'_id': '$offer_id', 'conversions': {'$sum': 1}}},
                {'$sort': {'conversions': -1}},
                {'$limit': limit}
            ]
            results = list(tracking_collection.aggregate(pipeline))
            
            # If no results, try conversions collection
            if not results and conversions_collection is not None:
                pipeline = [
                    {'$match': {'created_at': {'$gte': start_date}}},
                    {'$group': {'_id': '$offer_id', 'conversions': {'$sum': 1}}},
                    {'$sort': {'conversions': -1}},
                    {'$limit': limit}
                ]
                results = list(conversions_collection.aggregate(pipeline))
            
            for r in results:
                if r['_id']:
                    offer = offers_collection.find_one({'offer_id': r['_id']})
                    if offer:
                        offers.append({
                            'offer_id': r['_id'],
                            'name': offer.get('name', 'Unknown'),
                            'payout': offer.get('payout', 0),
                            'image_url': offer.get('image_url', ''),
                            'category': offer.get('category', ''),
                            'metric_value': r['conversions'],
                            'metric_label': 'conversions'
                        })
            
            # Fallback: show top offers by payout if no conversion data
            if not offers:
                top_offers = list(offers_collection.find(
                    {'is_active': True},
                    {'offer_id': 1, 'name': 1, 'payout': 1, 'image_url': 1, 'category': 1}
                ).sort('payout', -1).limit(limit))
                
                for offer in top_offers:
                    offers.append({
                        'offer_id': offer.get('offer_id', ''),
                        'name': offer.get('name', 'Unknown'),
                        'payout': offer.get('payout', 0),
                        'image_url': offer.get('image_url', ''),
                        'category': offer.get('category', ''),
                        'metric_value': offer.get('payout', 0),
                        'metric_label': 'payout ($)'
                    })
                    
        elif insight_type == 'high_clicks_low_conversion':
            # Get offers with high clicks but low conversion rate
            pipeline = [
                {'$match': {'timestamp': {'$gte': start_date}}},
                {'$group': {
                    '_id': '$offer_id',
                    'clicks': {'$sum': {'$cond': [{'$eq': ['$event_type', 'click']}, 1, 0]}},
                    'conversions': {'$sum': {'$cond': [{'$in': ['$event_type', ['conversion', 'completion']]}, 1, 0]}}
                }},
                {'$match': {'clicks': {'$gte': 10}}},  # At least 10 clicks (lowered threshold)
                {'$addFields': {
                    'conversion_rate': {
                        '$cond': [
                            {'$eq': ['$clicks', 0]},
                            0,
                            {'$multiply': [{'$divide': ['$conversions', '$clicks']}, 100]}
                        ]
                    }
                }},
                {'$match': {'conversion_rate': {'$lt': 10}}},  # Less than 10% CR
                {'$sort': {'clicks': -1}},
                {'$limit': limit}
            ]
            results = list(tracking_collection.aggregate(pipeline))
            
            for r in results:
                if r['_id']:
                    offer = offers_collection.find_one({'offer_id': r['_id']})
                    if offer:
                        offers.append({
                            'offer_id': r['_id'],
                            'name': offer.get('name', 'Unknown'),
                            'payout': offer.get('payout', 0),
                            'image_url': offer.get('image_url', ''),
                            'category': offer.get('category', ''),
                            'metric_value': r['clicks'],
                            'metric_label': 'clicks',
                            'conversion_rate': round(r.get('conversion_rate', 0), 2)
                        })
            
            # Fallback: show random active offers
            if not offers:
                random_offers = list(offers_collection.aggregate([
                    {'$match': {'is_active': True}},
                    {'$sample': {'size': limit}}
                ]))
                
                for offer in random_offers:
                    offers.append({
                        'offer_id': offer.get('offer_id', ''),
                        'name': offer.get('name', 'Unknown'),
                        'payout': offer.get('payout', 0),
                        'image_url': offer.get('image_url', ''),
                        'category': offer.get('category', ''),
                        'metric_value': 0,
                        'metric_label': 'clicks',
                        'conversion_rate': 0
                    })
                    
        elif insight_type == 'most_requested':
            # Get most requested offers from access requests
            pipeline = [
                {'$match': {'created_at': {'$gte': start_date}}},
                {'$group': {'_id': '$offer_id', 'requests': {'$sum': 1}}},
                {'$sort': {'requests': -1}},
                {'$limit': limit}
            ]
            results = list(access_requests_collection.aggregate(pipeline))
            
            for r in results:
                if r['_id']:
                    offer = offers_collection.find_one({'offer_id': r['_id']})
                    if offer:
                        offers.append({
                            'offer_id': r['_id'],
                            'name': offer.get('name', 'Unknown'),
                            'payout': offer.get('payout', 0),
                            'image_url': offer.get('image_url', ''),
                            'category': offer.get('category', ''),
                            'metric_value': r['requests'],
                            'metric_label': 'requests'
                        })
            
            # Fallback: show newest offers
            if not offers:
                newest_offers = list(offers_collection.find(
                    {'is_active': True},
                    {'offer_id': 1, 'name': 1, 'payout': 1, 'image_url': 1, 'category': 1, 'created_at': 1}
                ).sort('created_at', -1).limit(limit))
                
                for offer in newest_offers:
                    offers.append({
                        'offer_id': offer.get('offer_id', ''),
                        'name': offer.get('name', 'Unknown'),
                        'payout': offer.get('payout', 0),
                        'image_url': offer.get('image_url', ''),
                        'category': offer.get('category', ''),
                        'metric_value': 0,
                        'metric_label': 'requests'
                    })
        else:
            return jsonify({'error': 'Invalid insight type'}), 400
            
        return jsonify({
            'success': True,
            'insight_type': insight_type,
            'offers': offers,
            'template': EMAIL_TEMPLATES.get(insight_type, {})
        })
        
    except Exception as e:
        logger.error(f"Error getting offer insights: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@offer_insights_bp.route('/insights/partners', methods=['GET'])
@token_required
@admin_required
def get_partners_for_email():
    """Get list of partners (publishers) to send emails to"""
    try:
        search = request.args.get('search', '')
        status = request.args.get('status', 'active')
        
        users_collection = db_instance.get_collection('users')
        
        # Include all non-admin users as potential partners (publishers)
        query = {'role': {'$in': ['user', 'publisher', 'partner']}}
        if status == 'active':
            query['is_active'] = True
        if search:
            query['$or'] = [
                {'username': {'$regex': search, '$options': 'i'}},
                {'email': {'$regex': search, '$options': 'i'}}
            ]
        
        partners = list(users_collection.find(query, {
            '_id': 1, 'username': 1, 'email': 1, 'is_active': 1, 'created_at': 1, 'role': 1
        }).sort('username', 1).limit(100))
        
        # If still no partners, get all users except admins
        if not partners:
            query = {'role': {'$nin': ['admin', 'superadmin']}}
            if status == 'active':
                query['is_active'] = True
            if search:
                query['$or'] = [
                    {'username': {'$regex': search, '$options': 'i'}},
                    {'email': {'$regex': search, '$options': 'i'}}
                ]
            partners = list(users_collection.find(query, {
                '_id': 1, 'username': 1, 'email': 1, 'is_active': 1, 'created_at': 1, 'role': 1
            }).sort('username', 1).limit(100))
        
        # Convert ObjectId to string
        for p in partners:
            p['_id'] = str(p['_id'])
            
        return jsonify({
            'success': True,
            'partners': partners,
            'total': len(partners)
        })
        
    except Exception as e:
        logger.error(f"Error getting partners: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@offer_insights_bp.route('/insights/send-email', methods=['POST'])
@token_required
@admin_required
def send_insight_email():
    """Send insight email to selected partners"""
    try:
        # Note: We don't check if email service is paused for manual insight emails
        # The pause feature is meant for automated scheduled emails, not manual campaigns
        
        data = request.get_json()
        logger.info(f"send_insight_email called with data: {data}")
        
        insight_type = data.get('insight_type')
        offer = data.get('offer')
        partner_ids = data.get('partner_ids', [])
        custom_message = data.get('custom_message', '')
        
        logger.info(f"insight_type={insight_type}, offer={offer.get('name') if offer else None}, partner_ids={partner_ids}")
        
        if not insight_type or not offer or not partner_ids:
            return jsonify({'error': 'Missing required fields'}), 400
            
        template = EMAIL_TEMPLATES.get(insight_type)
        if not template:
            return jsonify({'error': 'Invalid insight type'}), 400
            
        users_collection = db_instance.get_collection('users')
        email_logs_collection = db_instance.get_collection('insight_email_logs')
        
        email_service = get_email_service()
        logger.info(f"Email service configured: {email_service.is_configured}")
        
        sent_count = 0
        failed_count = 0
        results = []
        
        for partner_id in partner_ids:
            try:
                partner = users_collection.find_one({'_id': ObjectId(partner_id)})
                if not partner:
                    logger.warning(f"Partner not found: {partner_id}")
                    results.append({'partner_id': partner_id, 'status': 'not_found'})
                    failed_count += 1
                    continue
                
                partner_email = partner.get('email')
                logger.info(f"Sending email to partner: {partner.get('username')} ({partner_email})")
                    
                # Generate email HTML
                email_html = generate_insight_email_html(
                    template=template,
                    offer=offer,
                    partner_name=partner.get('username', 'Partner'),
                    custom_message=custom_message
                )
                
                subject = template['subject'].format(offer_name=offer.get('name', 'Offer'))
                logger.info(f"Email subject: {subject}")
                
                # Send email
                success = email_service._send_email(
                    partner_email,
                    subject,
                    email_html
                )
                
                logger.info(f"Email send result for {partner_email}: {success}")
                
                if success:
                    sent_count += 1
                    results.append({'partner_id': partner_id, 'email': partner_email, 'status': 'sent'})
                else:
                    failed_count += 1
                    results.append({'partner_id': partner_id, 'email': partner_email, 'status': 'failed'})
                    
            except Exception as e:
                logger.error(f"Error sending to partner {partner_id}: {e}", exc_info=True)
                failed_count += 1
                results.append({'partner_id': partner_id, 'status': 'error', 'error': str(e)})
        
        # Log the campaign
        email_logs_collection.insert_one({
            'insight_type': insight_type,
            'offer_id': offer.get('offer_id'),
            'offer_name': offer.get('name'),
            'partner_count': len(partner_ids),
            'sent_count': sent_count,
            'failed_count': failed_count,
            'sent_by': request.current_user.get('username'),
            'created_at': datetime.utcnow()
        })
        
        return jsonify({
            'success': True,
            'sent_count': sent_count,
            'failed_count': failed_count,
            'results': results
        })
        
    except Exception as e:
        logger.error(f"Error sending insight emails: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@offer_insights_bp.route('/insights/email-history', methods=['GET'])
@token_required
@admin_required
def get_email_history():
    """Get history of sent insight emails"""
    try:
        email_logs_collection = db_instance.get_collection('insight_email_logs')
        
        logs = list(email_logs_collection.find().sort('created_at', -1).limit(50))
        
        for log in logs:
            log['_id'] = str(log['_id'])
            
        return jsonify({
            'success': True,
            'history': logs
        })
        
    except Exception as e:
        logger.error(f"Error getting email history: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


def generate_insight_email_html(template, offer, partner_name, custom_message=''):
    """Generate beautiful HTML email for offer insights"""
    
    LOGO_URL = "https://moustacheleads.com/logo.png"
    year = datetime.now().year
    color = template.get('color', '#000000')
    
    custom_section = ''
    if custom_message:
        custom_section = f'''
        <div style="background-color:#f8f9fa;padding:20px;border-radius:8px;margin:20px 0;">
            <p style="color:#333;font-size:14px;margin:0;line-height:1.6;">{custom_message}</p>
        </div>
        '''
    
    html = f'''<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f5f5f5;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f5f5;padding:30px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">

<!-- Header -->
<tr><td style="background:linear-gradient(135deg, {color} 0%, #1a1a1a 100%);padding:40px;text-align:center;">
<img src="{LOGO_URL}" alt="MoustacheLeads" style="max-width:180px;margin-bottom:20px;" border="0" />
<h1 style="color:#ffffff;font-size:28px;margin:0;font-weight:800;">{template['title']}</h1>
<p style="color:rgba(255,255,255,0.9);font-size:16px;margin:10px 0 0 0;">{template['subtitle']}</p>
</td></tr>

<!-- Greeting -->
<tr><td style="padding:30px 40px 20px;">
<p style="color:#333;font-size:16px;margin:0;">Hey <strong>{partner_name}</strong>,</p>
<p style="color:#666;font-size:14px;margin:10px 0 0 0;line-height:1.6;">
We've identified an amazing opportunity for you! Check out this offer that's performing exceptionally well:
</p>
</td></tr>

<!-- Offer Card -->
<tr><td style="padding:0 40px;">
<div style="background:linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);border-radius:12px;padding:25px;border-left:4px solid {color};">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="80" valign="top">
<img src="{offer.get('image_url', '')}" alt="{offer.get('name', '')}" 
     style="width:70px;height:70px;border-radius:8px;object-fit:cover;border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,0.1);"
     onerror="this.src='https://via.placeholder.com/70x70?text=Offer'" />
</td>
<td style="padding-left:15px;" valign="top">
<h2 style="color:#1a1a1a;font-size:18px;margin:0 0 8px 0;font-weight:700;">{offer.get('name', 'Offer')}</h2>
<p style="color:#666;font-size:13px;margin:0 0 10px 0;">
<span style="background:{color};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">
{offer.get('category', 'General')}
</span>
</p>
<div style="display:flex;gap:20px;">
<div>
<span style="color:#888;font-size:11px;text-transform:uppercase;">Payout</span>
<p style="color:#22c55e;font-size:20px;font-weight:800;margin:2px 0 0 0;">${offer.get('payout', 0):.2f}</p>
</div>
<div style="margin-left:20px;">
<span style="color:#888;font-size:11px;text-transform:uppercase;">{template['highlight_label']}</span>
<p style="color:{color};font-size:20px;font-weight:800;margin:2px 0 0 0;">{offer.get('metric_value', 0):,}</p>
</div>
</div>
</td>
</tr>
</table>
</div>
</td></tr>

{custom_section}

<!-- CTA Button -->
<tr><td style="padding:30px 40px;text-align:center;">
<a href="https://moustacheleads.com/offers" 
   style="display:inline-block;background:{color};color:#ffffff;padding:16px 48px;text-decoration:none;border-radius:50px;font-weight:700;font-size:16px;box-shadow:0 4px 15px rgba(0,0,0,0.2);">
{template['cta_text']}
</a>
</td></tr>

<!-- Tips Section -->
<tr><td style="padding:0 40px 30px;">
<div style="background-color:#f0fdf4;border-radius:8px;padding:20px;border:1px solid #bbf7d0;">
<p style="color:#166534;font-size:14px;margin:0;font-weight:600;">💡 Pro Tip:</p>
<p style="color:#166534;font-size:13px;margin:8px 0 0 0;line-height:1.5;">
Start promoting this offer now to maximize your earnings. The best performing publishers act fast on trending offers!
</p>
</div>
</td></tr>

<!-- Footer -->
<tr><td style="background-color:#1a1a1a;padding:30px 40px;text-align:center;">
<p style="color:#ffffff;font-size:18px;font-weight:800;margin:0;">MoustacheLeads</p>
<p style="color:#888;font-size:12px;margin:10px 0 0 0;">Your Partner in Affiliate Success</p>
<p style="color:#666;font-size:11px;margin:15px 0 0 0;">© {year} MoustacheLeads. All rights reserved.</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>'''
    
    return html


@offer_insights_bp.route('/insights/preview-email', methods=['POST'])
@token_required
@admin_required
def preview_email():
    """Preview email template with offer data"""
    try:
        data = request.get_json()
        
        insight_type = data.get('insight_type')
        offer = data.get('offer')
        custom_message = data.get('custom_message', '')
        
        if not insight_type or not offer:
            return jsonify({'error': 'Missing required fields'}), 400
            
        template = EMAIL_TEMPLATES.get(insight_type)
        if not template:
            return jsonify({'error': 'Invalid insight type'}), 400
            
        html = generate_insight_email_html(
            template=template,
            offer=offer,
            partner_name='[Partner Name]',
            custom_message=custom_message
        )
        
        return jsonify({
            'success': True,
            'html': html,
            'subject': template['subject'].format(offer_name=offer.get('name', 'Offer'))
        })
        
    except Exception as e:
        logger.error(f"Error previewing email: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500
