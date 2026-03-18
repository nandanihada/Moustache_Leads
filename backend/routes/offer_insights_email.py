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
                # Strip timezone info to store as naive UTC (consistent with utcnow comparisons)
                if scheduled_datetime.tzinfo is not None:
                    from datetime import timezone
                    scheduled_datetime = scheduled_datetime.astimezone(timezone.utc).replace(tzinfo=None)
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
            # Strip timezone info to store as naive UTC
            if scheduled_datetime.tzinfo is not None:
                from datetime import timezone
                scheduled_datetime = scheduled_datetime.astimezone(timezone.utc).replace(tzinfo=None)
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
<a href="https://moustacheleads.com/publisher/signin" 
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


# ============================================================================
# OFFER VIEW LOGS - Track who viewed/opened offer details
# ============================================================================

@offer_insights_bp.route('/insights/offer-view-logs', methods=['GET'])
@token_required
@admin_required
def get_offer_view_logs():
    """Get offer view logs with filters and pagination.
    Only reads from offer_views collection (publisher offer detail views).
    """
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        
        # Filters
        ip_filter = request.args.get('ip', '').strip()
        email_filter = request.args.get('email', '').strip()
        offer_id_filter = request.args.get('offer_id', '').strip()
        username_filter = request.args.get('username', '').strip()
        
        # Date range
        date_from = request.args.get('date_from', '')
        date_to = request.args.get('date_to', '')
        range_preset = request.args.get('range', '')  # today, 7d, 30d, custom
        
        # Build date filter
        date_query = {}
        now = datetime.utcnow()
        if range_preset == 'today':
            date_query = {'$gte': datetime(now.year, now.month, now.day)}
        elif range_preset == '7d':
            date_query = {'$gte': now - timedelta(days=7)}
        elif range_preset == '30d':
            date_query = {'$gte': now - timedelta(days=30)}
        elif date_from or date_to:
            if date_from:
                try:
                    date_query['$gte'] = datetime.fromisoformat(date_from.replace('Z', '+00:00').replace('+00:00', ''))
                except:
                    date_query['$gte'] = datetime.strptime(date_from[:10], '%Y-%m-%d')
            if date_to:
                try:
                    dt_to = datetime.fromisoformat(date_to.replace('Z', '+00:00').replace('+00:00', ''))
                except:
                    dt_to = datetime.strptime(date_to[:10], '%Y-%m-%d')
                date_query['$lte'] = dt_to + timedelta(days=1)
        
        # Only read from offer_views collection (publisher offer detail views)
        offer_views_col = db_instance.get_collection('offer_views')
        if offer_views_col is None:
            return jsonify({'success': True, 'logs': [], 'total': 0, 'page': 1, 'per_page': per_page, 'pages': 1})
        
        dq = {}
        if date_query:
            dq['timestamp'] = date_query
        if ip_filter:
            dq['ip_address'] = {'$regex': ip_filter, '$options': 'i'}
        if email_filter:
            dq['user_email'] = {'$regex': email_filter, '$options': 'i'}
        if offer_id_filter:
            dq['offer_id'] = offer_id_filter
        if username_filter:
            dq['username'] = {'$regex': username_filter, '$options': 'i'}
        
        total = offer_views_col.count_documents(dq)
        skip = (page - 1) * per_page
        
        cursor = offer_views_col.find(dq).sort('timestamp', -1).skip(skip).limit(per_page)
        
        # Collect offer_ids to batch-lookup network for older logs missing it
        raw_docs = list(cursor)
        offer_ids_to_lookup = set()
        for doc in raw_docs:
            if not doc.get('network'):
                offer_ids_to_lookup.add(doc.get('offer_id', ''))
        
        # Batch lookup networks from offers collection
        network_map = {}
        if offer_ids_to_lookup:
            offers_col = db_instance.get_collection('offers')
            if offers_col is not None:
                for o in offers_col.find({'offer_id': {'$in': list(offer_ids_to_lookup)}}, {'offer_id': 1, 'network': 1}):
                    network_map[o.get('offer_id', '')] = o.get('network', '')
        
        logs = []
        for doc in raw_docs:
            ts = doc.get('timestamp', '')
            if isinstance(ts, datetime):
                ts = ts.isoformat() + 'Z'
            
            network = doc.get('network', '') or network_map.get(doc.get('offer_id', ''), '')
            
            logs.append({
                '_id': str(doc.get('_id', '')),
                'ip': doc.get('ip_address', ''),
                'email': doc.get('user_email', ''),
                'username': doc.get('username', ''),
                'timestamp': ts,
                'offer_id': doc.get('offer_id', ''),
                'offer_name': doc.get('offer_name', ''),
                'network': network,
                'clicked': doc.get('clicked', False),
                'source': doc.get('source', 'publisher_offers'),
                'user_agent': doc.get('user_agent', ''),
            })
        
        return jsonify({
            'success': True,
            'logs': logs,
            'total': total,
            'page': page,
            'per_page': per_page,
            'pages': (total + per_page - 1) // per_page if total > 0 else 1
        })
        
    except Exception as e:
        logger.error(f"Error getting offer view logs: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


# ============================================================================
# CUSTOM EMAIL CAMPAIGN - Reusable email system for Offer Insights
# ============================================================================

@offer_insights_bp.route('/insights/send-custom-email', methods=['POST'])
@token_required
@admin_required
def send_custom_email_campaign():
    """Send a fully custom email campaign with offer batching and intervals.
    
    Batch logic: offers are split into N batches. Each batch becomes one email
    containing a subset of offers. Batches are sent with a configurable interval.
    For scheduled sends, each batch gets its own scheduled_at time staggered by the interval.
    For immediate sends, batches are sent with time.sleep between them.
    
    All recipients receive ALL batches (each batch = different set of offers).
    """
    try:
        import re
        import time as time_module
        
        data = request.get_json()
        
        subject = data.get('subject', '').strip()
        content = data.get('content', '').strip()
        partner_ids = data.get('partner_ids', [])
        custom_emails = data.get('custom_emails', [])
        num_batches = int(data.get('num_batches', 1))
        batch_interval_minutes = int(data.get('batch_interval_minutes', 2))
        scheduled_at = data.get('scheduled_at')
        source_card = data.get('source_card', 'offer_view_logs')
        offer_ids = data.get('offer_ids', [])
        offer_names = data.get('offer_names', [])
        
        if not subject or not content:
            return jsonify({'error': 'Subject and content are required'}), 400
        if not partner_ids and not custom_emails:
            return jsonify({'error': 'At least one recipient is required'}), 400
        
        email_activity_col = db_instance.get_collection('email_activity_logs')
        insight_email_logs_col = db_instance.get_collection('insight_email_logs')
        
        admin_user = request.current_user
        admin_username = admin_user.get('username', 'admin')
        admin_id = str(admin_user.get('_id', ''))
        
        total_recipients = len(partner_ids) + len(custom_emails)
        
        # Split offers into batches
        num_batches = max(1, min(num_batches, max(len(offer_names), 1)))
        batch_interval_minutes = max(1, min(batch_interval_minutes, 60))
        
        offer_batches = []
        if len(offer_names) > 0:
            per_batch = max(1, len(offer_names) // num_batches)
            remainder = len(offer_names) % num_batches
            idx = 0
            for i in range(num_batches):
                size = per_batch + (1 if i < remainder else 0)
                batch_offer_names = offer_names[idx:idx + size]
                batch_offer_ids = offer_ids[idx:idx + size] if idx + size <= len(offer_ids) else offer_ids[idx:]
                offer_batches.append({
                    'offer_names': batch_offer_names,
                    'offer_ids': batch_offer_ids,
                    'batch_number': i + 1
                })
                idx += size
        else:
            # No offers — single batch with empty offers
            offer_batches = [{'offer_names': [], 'offer_ids': [], 'batch_number': 1}]
            num_batches = 1
        
        # Build content for each batch (replace offer list in content)
        def build_batch_content(base_content, batch_offer_names):
            """If content has a numbered offer list, replace it with this batch's offers."""
            if not batch_offer_names:
                return base_content
            # Build the offer list portion
            offer_list = '\n'.join([f"{i+1}. {name}" for i, name in enumerate(batch_offer_names)])
            # Try to replace existing numbered list in content
            # Pattern: lines starting with "1. " through "N. "
            import re as re_mod
            numbered_pattern = re_mod.compile(r'(\d+\.\s+.+\n?)+')
            if numbered_pattern.search(base_content):
                return numbered_pattern.sub(offer_list + '\n', base_content, count=1)
            return base_content
        
        # If scheduled, create separate scheduled records for each batch
        if scheduled_at:
            try:
                scheduled_datetime = datetime.fromisoformat(scheduled_at.replace('Z', '+00:00'))
                if scheduled_datetime.tzinfo is not None:
                    from datetime import timezone
                    scheduled_datetime = scheduled_datetime.astimezone(timezone.utc).replace(tzinfo=None)
                if scheduled_datetime <= datetime.utcnow():
                    return jsonify({'error': 'Scheduled time must be in the future'}), 400
            except ValueError as e:
                return jsonify({'error': f'Invalid date format: {str(e)}'}), 400
            
            batch_ids = []
            for i, batch in enumerate(offer_batches):
                batch_time = scheduled_datetime + timedelta(minutes=i * batch_interval_minutes)
                batch_content = build_batch_content(content, batch.get('offer_names', []))
                
                scheduled_record = {
                    'type': 'custom_campaign',
                    'subject': subject,
                    'content': batch_content,
                    'partner_ids': partner_ids,
                    'custom_emails': custom_emails,
                    'scheduled_at': batch_time,
                    'source_card': source_card,
                    'offer_ids': batch.get('offer_ids', []),
                    'offer_names': batch.get('offer_names', []),
                    'batch_number': batch.get('batch_number', i + 1),
                    'total_batches': len(offer_batches),
                    'batch_interval_minutes': batch_interval_minutes,
                    'status': 'scheduled',
                    'created_by': admin_username,
                    'created_at': datetime.utcnow()
                }
                result = insight_email_logs_col.insert_one(scheduled_record)
                batch_ids.append(str(result.inserted_id))
            
            # Log to email_activity_logs
            if email_activity_col is not None:
                email_activity_col.insert_one({
                    'action': 'scheduled',
                    'source': source_card,
                    'offer_ids': offer_ids,
                    'offer_names': offer_names,
                    'offer_count': len(offer_ids),
                    'recipient_type': 'specific_users',
                    'recipient_count': total_recipients,
                    'batch_count': len(offer_batches),
                    'batch_interval_minutes': batch_interval_minutes,
                    'scheduled_time': scheduled_datetime.isoformat(),
                    'admin_id': admin_id,
                    'admin_username': admin_username,
                    'subject': subject,
                    'created_at': datetime.utcnow()
                })
            
            return jsonify({
                'success': True,
                'scheduled': True,
                'batch_ids': batch_ids,
                'scheduled_at': scheduled_at,
                'partner_count': total_recipients,
                'batch_count': len(offer_batches),
                'batch_interval_minutes': batch_interval_minutes
            })
        
        # Send immediately with intervals between batches
        users_collection = db_instance.get_collection('users')
        email_service = get_email_service()
        
        total_sent = 0
        total_failed = 0
        email_regex = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
        
        for batch_idx, batch in enumerate(offer_batches):
            # Wait for interval between batches (not before first batch)
            if batch_idx > 0:
                wait_seconds = batch_interval_minutes * 60
                logger.info(f"📧 Waiting {batch_interval_minutes} min before batch {batch_idx + 1}/{len(offer_batches)}")
                time_module.sleep(wait_seconds)
            
            batch_content = build_batch_content(content, batch.get('offer_names', []))
            batch_sent = 0
            batch_failed = 0
            
            logger.info(f"📧 Sending batch {batch_idx + 1}/{len(offer_batches)} with {len(batch.get('offer_names', []))} offers to {total_recipients} recipients")
            
            # Send to registered partners
            for partner_id in partner_ids:
                try:
                    partner = users_collection.find_one({'_id': ObjectId(partner_id)})
                    if not partner:
                        batch_failed += 1
                        continue
                    
                    partner_email = partner.get('email')
                    partner_name = partner.get('username', 'Partner')
                    
                    email_html = generate_custom_campaign_html(
                        subject=subject,
                        content=batch_content,
                        partner_name=partner_name
                    )
                    
                    success = email_service._send_email(partner_email, subject, email_html)
                    if success:
                        batch_sent += 1
                    else:
                        batch_failed += 1
                except Exception as e:
                    logger.error(f"Error sending to partner {partner_id}: {e}")
                    batch_failed += 1
            
            # Send to custom email addresses
            for raw_email in custom_emails:
                try:
                    email_addr = raw_email.strip().lower()
                    if not email_addr or not email_regex.match(email_addr):
                        batch_failed += 1
                        continue
                    
                    email_html = generate_custom_campaign_html(
                        subject=subject,
                        content=batch_content,
                        partner_name=email_addr.split('@')[0]
                    )
                    
                    success = email_service._send_email(email_addr, subject, email_html)
                    if success:
                        batch_sent += 1
                    else:
                        batch_failed += 1
                except Exception as e:
                    logger.error(f"Error sending to custom email {raw_email}: {e}")
                    batch_failed += 1
            
            total_sent += batch_sent
            total_failed += batch_failed
            logger.info(f"📧 Batch {batch_idx + 1} done: {batch_sent} sent, {batch_failed} failed")
        
        # Log to insight_email_logs
        insight_email_logs_col.insert_one({
            'type': 'custom_campaign',
            'subject': subject,
            'source_card': source_card,
            'offer_ids': offer_ids,
            'offer_names': offer_names,
            'partner_count': total_recipients,
            'sent_count': total_sent,
            'failed_count': total_failed,
            'batch_count': len(offer_batches),
            'batch_interval_minutes': batch_interval_minutes,
            'sent_by': admin_username,
            'status': 'sent',
            'created_at': datetime.utcnow()
        })
        
        # Log to email_activity_logs
        if email_activity_col is not None:
            email_activity_col.insert_one({
                'action': 'sent',
                'source': source_card,
                'offer_ids': offer_ids,
                'offer_names': offer_names,
                'offer_count': len(offer_ids),
                'recipient_type': 'specific_users',
                'recipient_count': total_recipients,
                'batch_count': len(offer_batches),
                'batch_interval_minutes': batch_interval_minutes,
                'admin_id': admin_id,
                'admin_username': admin_username,
                'subject': subject,
                'sent_count': total_sent,
                'failed_count': total_failed,
                'created_at': datetime.utcnow()
            })
        
        return jsonify({
            'success': True,
            'sent_count': total_sent,
            'failed_count': total_failed,
            'batch_count': len(offer_batches),
            'total_recipients': total_recipients
        })
        
    except Exception as e:
        logger.error(f"Error sending custom email campaign: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


def generate_custom_campaign_html(subject, content, partner_name):
    """Generate HTML email for custom campaigns with professional template"""
    LOGO_URL = "https://moustacheleads.com/logo.png"
    year = datetime.now().year
    
    # Convert newlines in content to <br> tags
    formatted_content = content.replace('\n', '<br>')
    
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
<tr><td style="background:linear-gradient(135deg, #6366f1 0%, #1a1a1a 100%);padding:40px;text-align:center;">
<img src="{LOGO_URL}" alt="MoustacheLeads" style="max-width:180px;margin-bottom:20px;" border="0" />
<h1 style="color:#ffffff;font-size:24px;margin:0;font-weight:800;">{subject}</h1>
</td></tr>

<!-- Greeting -->
<tr><td style="padding:30px 40px 10px;">
<p style="color:#333;font-size:16px;margin:0;">Hey <strong>{partner_name}</strong>,</p>
</td></tr>

<!-- Content -->
<tr><td style="padding:10px 40px 30px;">
<div style="color:#444;font-size:14px;line-height:1.7;">
{formatted_content}
</div>
</td></tr>

<!-- CTA -->
<tr><td style="padding:0 40px 30px;text-align:center;">
<a href="https://moustacheleads.com/publisher/signin" 
   style="display:inline-block;background:#6366f1;color:#ffffff;padding:14px 40px;text-decoration:none;border-radius:50px;font-weight:700;font-size:15px;box-shadow:0 4px 15px rgba(0,0,0,0.2);">
Visit Dashboard
</a>
</td></tr>

<!-- Footer -->
<tr><td style="background-color:#1a1a1a;padding:30px 40px;text-align:center;">
<p style="color:#ffffff;font-size:18px;font-weight:800;margin:0;">MoustacheLeads</p>
<p style="color:#888;font-size:12px;margin:10px 0 0 0;">Your Partner in Affiliate Success</p>
<p style="color:#666;font-size:11px;margin:15px 0 0 0;">&copy; {year} MoustacheLeads. All rights reserved.</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>'''
    
    return html


@offer_insights_bp.route('/insights/preview-custom-email', methods=['POST'])
@token_required
@admin_required
def preview_custom_email():
    """Preview a custom email campaign template"""
    try:
        data = request.get_json()
        subject = data.get('subject', 'Email Preview')
        content = data.get('content', '')
        
        html = generate_custom_campaign_html(
            subject=subject,
            content=content,
            partner_name='[Partner Name]'
        )
        
        return jsonify({
            'success': True,
            'html': html,
            'subject': subject
        })
        
    except Exception as e:
        logger.error(f"Error previewing custom email: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@offer_insights_bp.route('/insights/offer-view-logs', methods=['DELETE'])
@token_required
@admin_required
def delete_offer_view_logs():
    """Delete selected offer view logs by IDs."""
    try:
        data = request.get_json()
        log_ids = data.get('ids', [])
        
        if not log_ids:
            return jsonify({'error': 'No log IDs provided'}), 400
        
        offer_views_col = db_instance.get_collection('offer_views')
        if offer_views_col is None:
            return jsonify({'error': 'Collection not found'}), 404
        
        object_ids = []
        for lid in log_ids:
            try:
                object_ids.append(ObjectId(lid))
            except Exception:
                continue
        
        if not object_ids:
            return jsonify({'error': 'No valid IDs provided'}), 400
        
        result = offer_views_col.delete_many({'_id': {'$in': object_ids}})
        
        return jsonify({
            'success': True,
            'deleted_count': result.deleted_count
        })
        
    except Exception as e:
        logger.error(f"Error deleting offer view logs: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500
