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
    },
    'price_mismatch': {
        'subject': '💵 Price Update Alert: {offer_name} - Payout Changed!',
        'title': 'Price Change Alert',
        'subtitle': 'Important payout update for this offer!',
        'cta_text': 'Check Updated Payout',
        'highlight_label': 'Price Change',
        'color': '#ef4444'  # Red
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
        access_requests_collection = db_instance.get_collection('affiliate_requests')  # Offer access requests
        clicks_collection = db_instance.get_collection('clicks')  # Simple tracking clicks
        conversions_collection = db_instance.get_collection('conversions')  # Conversions collection
        dashboard_clicks_collection = db_instance.get_collection('dashboard_clicks')  # Dashboard/Offers page clicks
        offerwall_clicks_collection = db_instance.get_collection('offerwall_clicks')  # Offerwall clicks
        
        start_date = datetime.utcnow() - timedelta(days=days)
        
        offers = []
        
        if insight_type == 'highest_clicks':
            # Aggregate clicks from all sources
            click_counts = {}  # offer_id -> total clicks
            
            # 1. Try tracking_events first
            pipeline = [
                {'$match': {'timestamp': {'$gte': start_date}, 'event_type': 'click'}},
                {'$group': {'_id': '$offer_id', 'clicks': {'$sum': 1}}}
            ]
            for r in tracking_collection.aggregate(pipeline):
                if r['_id']:
                    click_counts[r['_id']] = click_counts.get(r['_id'], 0) + r['clicks']
            
            # 2. Add clicks from simple tracking (clicks collection)
            if clicks_collection is not None:
                pipeline = [
                    {'$match': {'$or': [
                        {'timestamp': {'$gte': start_date}},
                        {'click_time': {'$gte': start_date}}
                    ]}},
                    {'$group': {'_id': '$offer_id', 'clicks': {'$sum': 1}}}
                ]
                for r in clicks_collection.aggregate(pipeline):
                    if r['_id']:
                        click_counts[r['_id']] = click_counts.get(r['_id'], 0) + r['clicks']
            
            # 3. Add clicks from dashboard_clicks
            if dashboard_clicks_collection is not None:
                pipeline = [
                    {'$match': {'timestamp': {'$gte': start_date}}},
                    {'$group': {'_id': '$offer_id', 'clicks': {'$sum': 1}}}
                ]
                for r in dashboard_clicks_collection.aggregate(pipeline):
                    if r['_id']:
                        click_counts[r['_id']] = click_counts.get(r['_id'], 0) + r['clicks']
            
            # 4. Add clicks from offerwall_clicks
            if offerwall_clicks_collection is not None:
                pipeline = [
                    {'$match': {'timestamp': {'$gte': start_date}}},
                    {'$group': {'_id': '$offer_id', 'clicks': {'$sum': 1}}}
                ]
                for r in offerwall_clicks_collection.aggregate(pipeline):
                    if r['_id']:
                        click_counts[r['_id']] = click_counts.get(r['_id'], 0) + r['clicks']
            
            # Sort by clicks and get top N
            sorted_offers = sorted(click_counts.items(), key=lambda x: x[1], reverse=True)[:limit]
            
            # Get offer details
            for offer_id, clicks in sorted_offers:
                offer = offers_collection.find_one({'offer_id': offer_id})
                if offer:
                    offers.append({
                        'offer_id': offer_id,
                        'name': offer.get('name', 'Unknown'),
                        'payout': offer.get('payout', 0),
                        'image_url': offer.get('image_url', ''),
                        'category': offer.get('category', ''),
                        'metric_value': clicks,
                        'metric_label': 'clicks'
                    })
            
            # Fallback: show top offers by payout if no tracking data (clearly labeled)
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
                        'metric_value': 0,
                        'metric_label': 'clicks (no data)',
                        'no_tracking_data': True
                    })
            
        elif insight_type == 'highest_conversions':
            # Aggregate conversions from all sources
            conversion_counts = {}  # offer_id -> total conversions
            
            # 1. Try tracking_events first (check both 'conversion' and 'completion')
            pipeline = [
                {'$match': {'timestamp': {'$gte': start_date}, 'event_type': {'$in': ['conversion', 'completion']}}},
                {'$group': {'_id': '$offer_id', 'conversions': {'$sum': 1}}}
            ]
            for r in tracking_collection.aggregate(pipeline):
                if r['_id']:
                    conversion_counts[r['_id']] = conversion_counts.get(r['_id'], 0) + r['conversions']
            
            # 2. Add conversions from conversions collection
            if conversions_collection is not None:
                pipeline = [
                    {'$match': {'$or': [
                        {'conversion_time': {'$gte': start_date}},
                        {'created_at': {'$gte': start_date}}
                    ]}},
                    {'$group': {'_id': '$offer_id', 'conversions': {'$sum': 1}}}
                ]
                for r in conversions_collection.aggregate(pipeline):
                    if r['_id']:
                        conversion_counts[r['_id']] = conversion_counts.get(r['_id'], 0) + r['conversions']
            
            # 3. Also check forwarded_postbacks collection (another source of conversions)
            forwarded_postbacks = db_instance.get_collection('forwarded_postbacks')
            if forwarded_postbacks is not None:
                pipeline = [
                    {'$match': {'$or': [
                        {'timestamp': {'$gte': start_date}},
                        {'created_at': {'$gte': start_date}}
                    ]}},
                    {'$group': {'_id': '$offer_id', 'conversions': {'$sum': 1}}}
                ]
                for r in forwarded_postbacks.aggregate(pipeline):
                    if r['_id']:
                        conversion_counts[r['_id']] = conversion_counts.get(r['_id'], 0) + r['conversions']
            
            # Sort by conversions and get top N
            sorted_offers = sorted(conversion_counts.items(), key=lambda x: x[1], reverse=True)[:limit]
            
            # Get offer details
            for offer_id, conversions in sorted_offers:
                offer = offers_collection.find_one({'offer_id': offer_id})
                if offer:
                    offers.append({
                        'offer_id': offer_id,
                        'name': offer.get('name', 'Unknown'),
                        'payout': offer.get('payout', 0),
                        'image_url': offer.get('image_url', ''),
                        'category': offer.get('category', ''),
                        'metric_value': conversions,
                        'metric_label': 'conversions'
                    })
            
            # Fallback: show top offers by payout if no conversion data (clearly labeled)
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
                        'metric_value': 0,
                        'metric_label': 'conversions (no data)',
                        'no_tracking_data': True
                    })
                    
        elif insight_type == 'high_clicks_low_conversion':
            # Get offers with high clicks but low conversion rate
            # First aggregate all clicks and conversions per offer
            click_counts = {}  # offer_id -> clicks
            conversion_counts = {}  # offer_id -> conversions
            
            # Aggregate clicks from all sources
            # 1. tracking_events clicks
            pipeline = [
                {'$match': {'timestamp': {'$gte': start_date}, 'event_type': 'click'}},
                {'$group': {'_id': '$offer_id', 'count': {'$sum': 1}}}
            ]
            for r in tracking_collection.aggregate(pipeline):
                if r['_id']:
                    click_counts[r['_id']] = click_counts.get(r['_id'], 0) + r['count']
            
            # 2. clicks collection
            if clicks_collection is not None:
                pipeline = [
                    {'$match': {'$or': [
                        {'timestamp': {'$gte': start_date}},
                        {'click_time': {'$gte': start_date}}
                    ]}},
                    {'$group': {'_id': '$offer_id', 'count': {'$sum': 1}}}
                ]
                for r in clicks_collection.aggregate(pipeline):
                    if r['_id']:
                        click_counts[r['_id']] = click_counts.get(r['_id'], 0) + r['count']
            
            # 3. dashboard_clicks
            if dashboard_clicks_collection is not None:
                pipeline = [
                    {'$match': {'timestamp': {'$gte': start_date}}},
                    {'$group': {'_id': '$offer_id', 'count': {'$sum': 1}}}
                ]
                for r in dashboard_clicks_collection.aggregate(pipeline):
                    if r['_id']:
                        click_counts[r['_id']] = click_counts.get(r['_id'], 0) + r['count']
            
            # 4. offerwall_clicks
            if offerwall_clicks_collection is not None:
                pipeline = [
                    {'$match': {'timestamp': {'$gte': start_date}}},
                    {'$group': {'_id': '$offer_id', 'count': {'$sum': 1}}}
                ]
                for r in offerwall_clicks_collection.aggregate(pipeline):
                    if r['_id']:
                        click_counts[r['_id']] = click_counts.get(r['_id'], 0) + r['count']
            
            # Aggregate conversions
            # 1. tracking_events conversions
            pipeline = [
                {'$match': {'timestamp': {'$gte': start_date}, 'event_type': {'$in': ['conversion', 'completion']}}},
                {'$group': {'_id': '$offer_id', 'count': {'$sum': 1}}}
            ]
            for r in tracking_collection.aggregate(pipeline):
                if r['_id']:
                    conversion_counts[r['_id']] = conversion_counts.get(r['_id'], 0) + r['count']
            
            # 2. conversions collection
            if conversions_collection is not None:
                pipeline = [
                    {'$match': {'$or': [
                        {'conversion_time': {'$gte': start_date}},
                        {'created_at': {'$gte': start_date}}
                    ]}},
                    {'$group': {'_id': '$offer_id', 'count': {'$sum': 1}}}
                ]
                for r in conversions_collection.aggregate(pipeline):
                    if r['_id']:
                        conversion_counts[r['_id']] = conversion_counts.get(r['_id'], 0) + r['count']
            
            # Calculate conversion rates and filter
            offer_stats = []
            for offer_id, clicks in click_counts.items():
                if clicks >= 10:  # At least 10 clicks
                    conversions = conversion_counts.get(offer_id, 0)
                    conversion_rate = (conversions / clicks * 100) if clicks > 0 else 0
                    if conversion_rate < 10:  # Less than 10% CR
                        offer_stats.append({
                            'offer_id': offer_id,
                            'clicks': clicks,
                            'conversions': conversions,
                            'conversion_rate': conversion_rate
                        })
            
            # Sort by clicks descending and limit
            offer_stats.sort(key=lambda x: x['clicks'], reverse=True)
            offer_stats = offer_stats[:limit]
            
            for stat in offer_stats:
                offer = offers_collection.find_one({'offer_id': stat['offer_id']})
                if offer:
                    offers.append({
                        'offer_id': stat['offer_id'],
                        'name': offer.get('name', 'Unknown'),
                        'payout': offer.get('payout', 0),
                        'image_url': offer.get('image_url', ''),
                        'category': offer.get('category', ''),
                        'metric_value': stat['clicks'],
                        'metric_label': 'clicks',
                        'conversion_rate': round(stat['conversion_rate'], 2)
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
                        'metric_label': 'clicks (no data)',
                        'conversion_rate': 0,
                        'no_tracking_data': True
                    })
                    
        elif insight_type == 'most_requested':
            # Get most requested offers from affiliate_requests collection
            pipeline = [
                {'$match': {'$or': [
                    {'requested_at': {'$gte': start_date}},
                    {'created_at': {'$gte': start_date}}
                ]}},
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
                        'metric_label': 'requests (no data)',
                        'no_tracking_data': True
                    })
                    
        elif insight_type == 'price_mismatch':
            # Get offers with price mismatches from price_mismatches collection
            price_mismatches_collection = db_instance.get_collection('price_mismatches')
            
            if price_mismatches_collection is not None:
                # Get pending price mismatches within the time period
                pipeline = [
                    {'$match': {
                        'detected_at': {'$gte': start_date},
                        'status': 'pending'
                    }},
                    {'$sort': {'detected_at': -1}},
                    {'$limit': limit}
                ]
                results = list(price_mismatches_collection.aggregate(pipeline))
                
                for r in results:
                    price_diff = r.get('price_difference', 0)
                    change_type = r.get('price_change_type', 'change')
                    
                    # Format the metric label based on change type
                    if change_type == 'increase':
                        metric_label = f'+${abs(price_diff):.2f}'
                    else:
                        metric_label = f'-${abs(price_diff):.2f}'
                    
                    offers.append({
                        'offer_id': r.get('offer_id', ''),
                        'name': r.get('offer_name', 'Unknown'),
                        'payout': r.get('existing_payout', 0),
                        'new_payout': r.get('new_payout', 0),
                        'image_url': r.get('image_url', ''),
                        'category': r.get('category', ''),
                        'metric_value': price_diff,
                        'metric_label': metric_label,
                        'price_change_type': change_type,
                        'percent_change': r.get('percent_change', 0),
                        'mismatch_id': str(r.get('_id', ''))
                    })
            
            # Fallback: show message if no price mismatches
            if not offers:
                # No fallback needed - just return empty list
                pass
        else:
            return jsonify({'error': 'Invalid insight type'}), 400
        
        # Check if any offer has real tracking data (metric_value > 0)
        has_tracking_data = any(o.get('metric_value', 0) > 0 and not o.get('no_tracking_data', False) for o in offers)
            
        return jsonify({
            'success': True,
            'insight_type': insight_type,
            'offers': offers,
            'template': EMAIL_TEMPLATES.get(insight_type, {}),
            'has_tracking_data': has_tracking_data
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
    """Send insight email to selected partners - supports multiple offers and scheduling"""
    try:
        data = request.get_json()
        logger.info(f"send_insight_email called with data: {data}")
        
        insight_type = data.get('insight_type')
        # Support both single offer (legacy) and multiple offers
        offers = data.get('offers') or ([data.get('offer')] if data.get('offer') else [])
        partner_ids = data.get('partner_ids', [])
        custom_message = data.get('custom_message', '')
        scheduled_at = data.get('scheduled_at')  # ISO datetime string for scheduling
        
        logger.info(f"insight_type={insight_type}, offers_count={len(offers)}, partner_ids={partner_ids}, scheduled_at={scheduled_at}")
        
        if not insight_type or not offers or not partner_ids:
            return jsonify({'error': 'Missing required fields'}), 400
            
        template = EMAIL_TEMPLATES.get(insight_type)
        if not template:
            return jsonify({'error': 'Invalid insight type'}), 400
        
        email_logs_collection = db_instance.get_collection('insight_email_logs')
        
        # If scheduled, save to database and return
        if scheduled_at:
            try:
                scheduled_datetime = datetime.fromisoformat(scheduled_at.replace('Z', '+00:00'))
                if scheduled_datetime <= datetime.utcnow():
                    return jsonify({'error': 'Scheduled time must be in the future'}), 400
                
                # Save scheduled email
                scheduled_email = {
                    'insight_type': insight_type,
                    'offers': offers,
                    'partner_ids': partner_ids,
                    'custom_message': custom_message,
                    'scheduled_at': scheduled_datetime,
                    'status': 'scheduled',
                    'created_by': request.current_user.get('username'),
                    'created_at': datetime.utcnow()
                }
                result = email_logs_collection.insert_one(scheduled_email)
                
                return jsonify({
                    'success': True,
                    'scheduled': True,
                    'email_id': str(result.inserted_id),
                    'scheduled_at': scheduled_at,
                    'offer_count': len(offers),
                    'partner_count': len(partner_ids)
                })
            except ValueError as e:
                return jsonify({'error': f'Invalid scheduled_at format: {str(e)}'}), 400
            
        users_collection = db_instance.get_collection('users')
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
                    
                # Generate email HTML with multiple offers
                email_html = generate_multi_offer_email_html(
                    template=template,
                    offers=offers,
                    partner_name=partner.get('username', 'Partner'),
                    custom_message=custom_message
                )
                
                # Subject based on number of offers
                if len(offers) == 1:
                    subject = template['subject'].format(offer_name=offers[0].get('name', 'Offer'))
                else:
                    subject = f"🔥 {len(offers)} Hot Offers You Should Check Out!"
                
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
        offer_names = ', '.join([o.get('name', 'Unknown') for o in offers[:3]])
        if len(offers) > 3:
            offer_names += f' +{len(offers) - 3} more'
            
        email_logs_collection.insert_one({
            'insight_type': insight_type,
            'offers': offers,
            'offer_name': offer_names,
            'partner_count': len(partner_ids),
            'sent_count': sent_count,
            'failed_count': failed_count,
            'sent_by': request.current_user.get('username'),
            'status': 'sent',
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


@offer_insights_bp.route('/insights/cancel-scheduled/<email_id>', methods=['POST'])
@token_required
@admin_required
def cancel_scheduled_email(email_id):
    """Cancel a scheduled email campaign"""
    try:
        email_logs_collection = db_instance.get_collection('insight_email_logs')
        
        result = email_logs_collection.update_one(
            {'_id': ObjectId(email_id), 'status': 'scheduled'},
            {'$set': {'status': 'cancelled', 'cancelled_at': datetime.utcnow(), 'cancelled_by': request.current_user.get('username')}}
        )
        
        if result.modified_count == 0:
            return jsonify({'error': 'Email not found or already sent/cancelled'}), 404
            
        return jsonify({
            'success': True,
            'message': 'Scheduled email cancelled'
        })
        
    except Exception as e:
        logger.error(f"Error cancelling scheduled email: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@offer_insights_bp.route('/insights/resume-scheduled/<email_id>', methods=['POST'])
@token_required
@admin_required
def resume_scheduled_email(email_id):
    """Resume/reschedule a cancelled email campaign"""
    try:
        data = request.get_json()
        new_scheduled_at = data.get('scheduled_at')
        
        if not new_scheduled_at:
            return jsonify({'error': 'scheduled_at is required'}), 400
            
        try:
            scheduled_datetime = datetime.fromisoformat(new_scheduled_at.replace('Z', '+00:00'))
            if scheduled_datetime <= datetime.utcnow():
                return jsonify({'error': 'Scheduled time must be in the future'}), 400
        except ValueError as e:
            return jsonify({'error': f'Invalid scheduled_at format: {str(e)}'}), 400
        
        email_logs_collection = db_instance.get_collection('insight_email_logs')
        
        result = email_logs_collection.update_one(
            {'_id': ObjectId(email_id), 'status': 'cancelled'},
            {'$set': {
                'status': 'scheduled',
                'scheduled_at': scheduled_datetime,
                'resumed_at': datetime.utcnow(),
                'resumed_by': request.current_user.get('username')
            }}
        )
        
        if result.modified_count == 0:
            return jsonify({'error': 'Email not found or not in cancelled status'}), 404
            
        return jsonify({
            'success': True,
            'message': 'Scheduled email resumed',
            'scheduled_at': new_scheduled_at
        })
        
    except Exception as e:
        logger.error(f"Error resuming scheduled email: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


def generate_insight_email_html(template, offer, partner_name, custom_message=''):
    """Generate beautiful HTML email for offer insights (single offer)"""
    return generate_multi_offer_email_html(template, [offer], partner_name, custom_message)


def generate_multi_offer_email_html(template, offers, partner_name, custom_message=''):
    """Generate beautiful HTML email for offer insights (supports multiple offers)"""
    
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
    
    # Generate offer cards
    offer_cards = ''
    for i, offer in enumerate(offers):
        offer_cards += f'''
        <div style="background:linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);border-radius:12px;padding:25px;border-left:4px solid {color};margin-bottom:15px;">
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
        '''
    
    # Title based on number of offers
    if len(offers) == 1:
        title = template['title']
        subtitle = template['subtitle']
    else:
        title = f"{len(offers)} Hot Offers For You!"
        subtitle = "Check out these top-performing offers"
    
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
<h1 style="color:#ffffff;font-size:28px;margin:0;font-weight:800;">{title}</h1>
<p style="color:rgba(255,255,255,0.9);font-size:16px;margin:10px 0 0 0;">{subtitle}</p>
</td></tr>

<!-- Greeting -->
<tr><td style="padding:30px 40px 20px;">
<p style="color:#333;font-size:16px;margin:0;">Hey <strong>{partner_name}</strong>,</p>
<p style="color:#666;font-size:14px;margin:10px 0 0 0;line-height:1.6;">
We've identified {'an amazing opportunity' if len(offers) == 1 else 'some amazing opportunities'} for you! Check out {'this offer that is' if len(offers) == 1 else 'these offers that are'} performing exceptionally well:
</p>
</td></tr>

<!-- Offer Cards -->
<tr><td style="padding:0 40px;">
{offer_cards}
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
Start promoting {'this offer' if len(offers) == 1 else 'these offers'} now to maximize your earnings. The best performing publishers act fast on trending offers!
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
    """Preview email template with offer data (supports multiple offers)"""
    try:
        data = request.get_json()
        
        insight_type = data.get('insight_type')
        # Support both single offer (legacy) and multiple offers
        offers = data.get('offers') or ([data.get('offer')] if data.get('offer') else [])
        custom_message = data.get('custom_message', '')
        
        if not insight_type or not offers:
            return jsonify({'error': 'Missing required fields'}), 400
            
        template = EMAIL_TEMPLATES.get(insight_type)
        if not template:
            return jsonify({'error': 'Invalid insight type'}), 400
            
        html = generate_multi_offer_email_html(
            template=template,
            offers=offers,
            partner_name='[Partner Name]',
            custom_message=custom_message
        )
        
        # Subject based on number of offers
        if len(offers) == 1:
            subject = template['subject'].format(offer_name=offers[0].get('name', 'Offer'))
        else:
            subject = f"🔥 {len(offers)} Hot Offers You Should Check Out!"
        
        return jsonify({
            'success': True,
            'html': html,
            'subject': subject
        })
        
    except Exception as e:
        logger.error(f"Error previewing email: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500
