"""
Email Campaign Routes
API endpoints for the Smart Email Campaign system (Offer Audit Dashboard).
"""

from flask import Blueprint, request, jsonify
from utils.auth import token_required, subadmin_or_admin_required
from utils.json_serializer import safe_json_response
from models.email_campaign import EmailCampaign
from services.smart_offer_matcher import SmartOfferMatcher
from database import db_instance
import logging
from datetime import datetime, timedelta, timezone

email_campaigns_bp = Blueprint('email_campaigns', __name__)

# IST = UTC+5:30
IST = timezone(timedelta(hours=5, minutes=30))


def _parse_ist_to_utc(scheduled_at):
    """Parse a datetime string from frontend (IST) and convert to UTC for storage."""
    if not scheduled_at:
        return datetime.utcnow()
    try:
        if isinstance(scheduled_at, str):
            dt = datetime.fromisoformat(scheduled_at.replace('Z', ''))
            if dt.tzinfo is None:
                dt_ist = dt.replace(tzinfo=IST)
                dt_utc = dt_ist.astimezone(timezone.utc).replace(tzinfo=None)
                return dt_utc
            else:
                return dt.astimezone(timezone.utc).replace(tzinfo=None)
        return scheduled_at
    except Exception as e:
        logging.warning(f"Failed to parse scheduled_at '{scheduled_at}': {e}")
        return datetime.utcnow()


@email_campaigns_bp.route('/email-campaigns/preview', methods=['POST'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def preview_campaign():
    """Preview what offers would be sent to each user before creating campaign"""
    try:
        data = request.get_json() or {}
        user_ids = data.get('user_ids', [])
        config = {
            'total_offers_per_user': data.get('total_offers_per_user', 3),
            'offers_per_email': data.get('offers_per_email', 1),
            'source_tab': data.get('source_tab', 'all'),
            'price_percentage': data.get('price_percentage', 80),
        }
        
        if not user_ids:
            return jsonify({'error': 'No users selected'}), 400
        
        matcher = SmartOfferMatcher()
        preview = matcher.preview_campaign(user_ids, config)
        
        return safe_json_response(preview)
    
    except Exception as e:
        logging.error(f"Campaign preview error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@email_campaigns_bp.route('/email-campaigns/create', methods=['POST'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def create_campaign():
    """Create and queue a new email campaign"""
    try:
        data = request.get_json() or {}
        user = request.current_user
        
        user_ids = data.get('user_ids', [])
        if not user_ids:
            return jsonify({'error': 'No users selected'}), 400
        
        # Campaign settings
        total_offers_per_user = data.get('total_offers_per_user', 3)
        offers_per_email = data.get('offers_per_email', 1)
        price_percentage = data.get('price_percentage', 80)
        cooldown_days = data.get('cooldown_days', 1)
        batch_name = data.get('batch_name', '')
        source_tab = data.get('source_tab', 'all')
        subject = data.get('subject', '🚀 Check Out These Offers!')
        message_body = data.get('message_body', '')
        email_settings = data.get('email_settings', {})
        send_type = data.get('send_type', 'send_now')
        scheduled_at = data.get('scheduled_at')
        interval_hours = data.get('interval_hours', 24)
        
        # Custom offer overrides (admin manually adjusted offers in preview)
        custom_offers = data.get('custom_offers', {})  # {user_id: [offer_ids]}
        
        # Create campaign record
        campaign = EmailCampaign.create_campaign({
            'batch_name': batch_name,
            'source_tab': source_tab,
            'user_ids': user_ids,
            'total_offers_per_user': total_offers_per_user,
            'offers_per_email': offers_per_email,
            'cooldown_days': cooldown_days,
            'price_percentage': price_percentage,
            'subject': subject,
            'message_body': message_body,
            'email_settings': email_settings,
            'send_type': send_type,
            'scheduled_at': _parse_ist_to_utc(scheduled_at) if scheduled_at else None,
            'interval_hours': interval_hours,
            'created_by': str(user.get('_id', '')),
            'created_by_username': user.get('username', ''),
        })
        
        if not campaign:
            return jsonify({'error': 'Failed to create campaign'}), 500
        
        campaign_id = str(campaign['_id'])
        
        # Get offer matches for each user
        matcher = SmartOfferMatcher()
        config = {
            'total_offers_per_user': total_offers_per_user,
            'offers_per_email': offers_per_email,
            'source_tab': source_tab,
            'price_percentage': price_percentage,
        }
        
        # Use custom offers if provided, otherwise auto-match
        if custom_offers:
            user_matches = _build_from_custom_offers(custom_offers, offers_per_email)
        else:
            user_matches = matcher.get_offers_for_users(user_ids, config)
        
        # Get user info for emails
        users_col = db_instance.get_collection('users')
        user_info_map = {}
        if users_col is not None:
            from bson import ObjectId
            for uid in user_ids:
                try:
                    u = users_col.find_one({'_id': ObjectId(uid)}, {'username': 1, 'email': 1, 'first_name': 1})
                    if u:
                        user_info_map[uid] = {
                            'username': u.get('username', ''),
                            'email': u.get('email', ''),
                            'first_name': u.get('first_name', ''),
                        }
                except:
                    pass
        
        # Create individual email entries
        total_emails_created = 0
        base_time = _parse_ist_to_utc(scheduled_at) if scheduled_at else datetime.utcnow()
        
        for user_id in user_ids:
            user_data = user_matches.get(user_id, {'emails': []})
            user_info = user_info_map.get(user_id, {'username': '', 'email': '', 'first_name': ''})
            
            if not user_info.get('email'):
                continue
            
            for email_batch in user_data.get('emails', []):
                email_number = email_batch.get('email_number', 1)
                offers = email_batch.get('offers', [])
                
                if not offers:
                    continue
                
                # Calculate scheduled time for this email
                email_offset_hours = (email_number - 1) * interval_hours
                email_scheduled_at = base_time + timedelta(hours=email_offset_hours)
                
                # Build email HTML using template settings
                offer_ids = [o.get('offer_id', '') for o in offers]
                offer_names = [o.get('name', '') for o in offers]
                
                # Apply price percentage to offers
                adjusted_offers = []
                for o in offers:
                    adj = dict(o)
                    raw_payout = float(adj.get('payout', 0) or 0)
                    adj['payout'] = round(raw_payout * (price_percentage / 100.0), 2)
                    adjusted_offers.append(adj)
                
                # Build HTML
                html_body = _build_campaign_email_html(
                    offers=adjusted_offers,
                    recipient_name=user_info.get('first_name') or user_info.get('username', ''),
                    message_body=message_body,
                    email_settings=email_settings,
                    recipient_email=user_info.get('email', ''),
                    batch_id=campaign_id,
                )
                
                # Personalize subject
                personalized_subject = subject.replace(
                    '{username}', user_info.get('username', '')
                ).replace(
                    '{offer_count}', str(len(offers))
                ).replace(
                    '{first_name}', user_info.get('first_name', '')
                )
                
                # Create email record
                EmailCampaign.create_campaign_email({
                    'campaign_id': campaign_id,
                    'user_id': user_id,
                    'username': user_info.get('username', ''),
                    'email': user_info.get('email', ''),
                    'email_number': email_number,
                    'offer_ids': offer_ids,
                    'offer_names': offer_names,
                    'scheduled_at': email_scheduled_at,
                    'subject': personalized_subject,
                    'html_body': html_body,
                })
                
                total_emails_created += 1
        
        # Update campaign with total count
        EmailCampaign.update_campaign(campaign_id, {
            'total_emails': total_emails_created,
            'pending_count': total_emails_created,
            'status': EmailCampaign.STATUS_QUEUED if send_type == 'send_now' else EmailCampaign.STATUS_QUEUED,
            'started_at': datetime.utcnow() if send_type == 'send_now' else None,
        })
        
        return safe_json_response({
            'success': True,
            'campaign_id': campaign_id,
            'total_emails': total_emails_created,
            'message': f'Campaign created with {total_emails_created} emails queued for {len(user_ids)} users',
        })
    
    except Exception as e:
        logging.error(f"Create campaign error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@email_campaigns_bp.route('/email-campaigns', methods=['GET'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def list_campaigns():
    """Get paginated list of campaigns (Queue tab)"""
    try:
        page = max(1, int(request.args.get('page', 1)))
        per_page = min(int(request.args.get('per_page', 20)), 100)
        status = request.args.get('status', 'all')
        
        # Direct query to avoid any issues with the model method
        db = db_instance.get_db()
        if db is None:
            return safe_json_response({'campaigns': [], 'total': 0, 'page': page, 'per_page': per_page, 'pages': 1})
        
        collection = db[EmailCampaign.COLLECTION_NAME]
        
        query = {}
        if status and status != 'all':
            query['status'] = status
        
        total = collection.count_documents(query)
        raw_campaigns = list(
            collection.find(query)
            .sort('created_at', -1)
            .skip((page - 1) * per_page)
            .limit(per_page)
        )
        
        logging.info(f"📧 Campaign list: query={query}, total={total}, found={len(raw_campaigns)}")
        
        campaigns = []
        for c in raw_campaigns:
            campaigns.append({
                '_id': str(c['_id']),
                'batch_name': c.get('batch_name', ''),
                'source_tab': c.get('source_tab', ''),
                'status': c.get('status', ''),
                'user_count': c.get('user_count', 0),
                'total_emails': c.get('total_emails', 0),
                'sent_count': c.get('sent_count', 0),
                'failed_count': c.get('failed_count', 0),
                'pending_count': c.get('pending_count', 0),
                'total_offers_per_user': c.get('total_offers_per_user', 0),
                'offers_per_email': c.get('offers_per_email', 0),
                'price_percentage': c.get('price_percentage', 80),
                'cooldown_days': c.get('cooldown_days', 1),
                'total_opens': c.get('total_opens', 0),
                'total_clicks': c.get('total_clicks', 0),
                'created_by_username': c.get('created_by_username', ''),
                'created_at': c.get('created_at'),
                'started_at': c.get('started_at'),
                'completed_at': c.get('completed_at'),
                'paused_at': c.get('paused_at'),
            })
        
        return safe_json_response({
            'campaigns': campaigns,
            'total': total,
            'page': page,
            'per_page': per_page,
            'pages': max(1, (total + per_page - 1) // per_page),
        })
    
    except Exception as e:
        logging.error(f"List campaigns error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@email_campaigns_bp.route('/email-campaigns/<campaign_id>', methods=['GET'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def get_campaign_detail(campaign_id):
    """Get campaign details with all emails"""
    try:
        campaign = EmailCampaign.get_campaign(campaign_id)
        if not campaign:
            return jsonify({'error': 'Campaign not found'}), 404
        
        emails = EmailCampaign.get_campaign_emails(campaign_id)
        
        email_list = []
        for e in emails:
            email_list.append({
                '_id': str(e['_id']),
                'user_id': e.get('user_id', ''),
                'username': e.get('username', ''),
                'email': e.get('email', ''),
                'email_number': e.get('email_number', 1),
                'offer_ids': e.get('offer_ids', []),
                'offer_names': e.get('offer_names', []),
                'offer_count': e.get('offer_count', 0),
                'status': e.get('status', ''),
                'scheduled_at': e.get('scheduled_at'),
                'sent_at': e.get('sent_at'),
                'error_message': e.get('error_message'),
                'retry_count': e.get('retry_count', 0),
                'opened': e.get('opened', False),
                'opened_at': e.get('opened_at'),
                'clicked': e.get('clicked', False),
                'clicked_at': e.get('clicked_at'),
                'click_count': e.get('click_count', 0),
            })
        
        return safe_json_response({
            'campaign': {
                '_id': str(campaign['_id']),
                'batch_name': campaign.get('batch_name', ''),
                'source_tab': campaign.get('source_tab', ''),
                'status': campaign.get('status', ''),
                'user_ids': campaign.get('user_ids', []),
                'user_count': campaign.get('user_count', 0),
                'total_emails': campaign.get('total_emails', 0),
                'sent_count': campaign.get('sent_count', 0),
                'failed_count': campaign.get('failed_count', 0),
                'pending_count': campaign.get('pending_count', 0),
                'total_offers_per_user': campaign.get('total_offers_per_user', 0),
                'offers_per_email': campaign.get('offers_per_email', 0),
                'price_percentage': campaign.get('price_percentage', 80),
                'cooldown_days': campaign.get('cooldown_days', 1),
                'interval_hours': campaign.get('interval_hours', 24),
                'subject': campaign.get('subject', ''),
                'message_body': campaign.get('message_body', ''),
                'total_opens': campaign.get('total_opens', 0),
                'total_clicks': campaign.get('total_clicks', 0),
                'created_by_username': campaign.get('created_by_username', ''),
                'created_at': campaign.get('created_at'),
                'started_at': campaign.get('started_at'),
                'completed_at': campaign.get('completed_at'),
            },
            'emails': email_list,
        })
    
    except Exception as e:
        logging.error(f"Get campaign detail error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@email_campaigns_bp.route('/email-campaigns/<campaign_id>/pause', methods=['POST'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def pause_campaign(campaign_id):
    """Pause a running campaign"""
    try:
        campaign = EmailCampaign.get_campaign(campaign_id)
        if not campaign:
            return jsonify({'error': 'Campaign not found'}), 404
        
        EmailCampaign.update_campaign(campaign_id, {
            'status': EmailCampaign.STATUS_PAUSED,
            'paused_at': datetime.utcnow(),
        })
        
        return jsonify({'success': True, 'message': 'Campaign paused'})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@email_campaigns_bp.route('/email-campaigns/<campaign_id>/resume', methods=['POST'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def resume_campaign(campaign_id):
    """Resume a paused campaign"""
    try:
        campaign = EmailCampaign.get_campaign(campaign_id)
        if not campaign:
            return jsonify({'error': 'Campaign not found'}), 404
        
        EmailCampaign.update_campaign(campaign_id, {
            'status': EmailCampaign.STATUS_SENDING,
            'paused_at': None,
        })
        
        return jsonify({'success': True, 'message': 'Campaign resumed'})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@email_campaigns_bp.route('/email-campaigns/<campaign_id>/cancel', methods=['POST'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def cancel_campaign(campaign_id):
    """Cancel remaining emails in a campaign"""
    try:
        campaign = EmailCampaign.get_campaign(campaign_id)
        if not campaign:
            return jsonify({'error': 'Campaign not found'}), 404
        
        # Cancel all pending emails
        emails_col = EmailCampaign.get_emails_collection()
        if emails_col is not None:
            emails_col.update_many(
                {
                    'campaign_id': campaign_id,
                    'status': {'$in': [EmailCampaign.EMAIL_PENDING, EmailCampaign.EMAIL_READY]}
                },
                {'$set': {'status': EmailCampaign.EMAIL_CANCELLED, 'updated_at': datetime.utcnow()}}
            )
        
        EmailCampaign.update_campaign(campaign_id, {
            'status': EmailCampaign.STATUS_CANCELLED,
        })
        EmailCampaign.update_campaign_progress(campaign_id)
        
        return jsonify({'success': True, 'message': 'Campaign cancelled'})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@email_campaigns_bp.route('/email-campaigns/<campaign_id>/retry-failed', methods=['POST'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def retry_failed_emails(campaign_id):
    """Retry all failed emails in a campaign"""
    try:
        emails_col = EmailCampaign.get_emails_collection()
        if emails_col is None:
            return jsonify({'error': 'Database error'}), 500
        
        result = emails_col.update_many(
            {
                'campaign_id': campaign_id,
                'status': EmailCampaign.EMAIL_FAILED,
            },
            {'$set': {
                'status': EmailCampaign.EMAIL_PENDING,
                'scheduled_at': datetime.utcnow(),
                'error_message': None,
                'updated_at': datetime.utcnow(),
            }}
        )
        
        # Resume campaign if it was marked as completed/failed
        EmailCampaign.update_campaign(campaign_id, {
            'status': EmailCampaign.STATUS_SENDING,
        })
        EmailCampaign.update_campaign_progress(campaign_id)
        
        return jsonify({
            'success': True,
            'retried': result.modified_count,
            'message': f'{result.modified_count} failed emails queued for retry'
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@email_campaigns_bp.route('/email-campaigns/queue-stats', methods=['GET'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def get_queue_stats():
    """Get overall queue statistics"""
    try:
        campaigns_col = EmailCampaign.get_collection()
        emails_col = EmailCampaign.get_emails_collection()
        
        if campaigns_col is None:
            return jsonify({'error': 'Database error'}), 500
        if emails_col is None:
            return jsonify({'error': 'Database error'}), 500
        
        # Campaign counts by status
        pipeline = [
            {'$group': {'_id': '$status', 'count': {'$sum': 1}}}
        ]
        campaign_stats = {}
        for doc in campaigns_col.aggregate(pipeline):
            campaign_stats[doc['_id']] = doc['count']
        
        # Email counts by status
        email_pipeline = [
            {'$group': {'_id': '$status', 'count': {'$sum': 1}}}
        ]
        email_stats = {}
        for doc in emails_col.aggregate(email_pipeline):
            email_stats[doc['_id']] = doc['count']
        
        # Today's activity
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        sent_today = emails_col.count_documents({
            'status': EmailCampaign.EMAIL_SENT,
            'sent_at': {'$gte': today_start}
        })
        
        return safe_json_response({
            'campaigns': campaign_stats,
            'emails': email_stats,
            'sent_today': sent_today,
            'total_pending': email_stats.get('pending', 0) + email_stats.get('ready', 0),
            'total_sent': email_stats.get('sent', 0),
            'total_failed': email_stats.get('failed', 0),
        })
    
    except Exception as e:
        logging.error(f"Queue stats error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


def _build_campaign_email_html(offers: list, recipient_name: str, message_body: str, 
                                email_settings: dict, recipient_email: str = '', batch_id: str = '') -> str:
    """Build email HTML using the shared template builder with campaign settings"""
    import os
    from utils.email_template_builder import build_offer_email_html
    
    template_style = email_settings.get('templateStyle', 'table')
    visible_fields = email_settings.get('visibleFields', ['name', 'payout', 'countries', 'category', 'network', 'image', 'offer_id'])
    see_more_fields = email_settings.get('seeMoreFields', [])
    default_image = email_settings.get('defaultImage', '')
    payout_type = 'admin'  # We already adjusted the payout via price_percentage
    mask_preview_links = email_settings.get('maskPreviewLinks', False)
    payment_terms = email_settings.get('paymentTerms', '')
    preview_in_email = email_settings.get('previewInEmail', 'both')
    custom_preview_in_email = email_settings.get('customPreviewInEmail', 'both')
    
    return build_offer_email_html(
        offers=offers,
        recipient_name=recipient_name,
        custom_message=message_body,
        template_style=template_style,
        visible_fields=visible_fields,
        see_more_fields=see_more_fields,
        payout_type=payout_type,
        default_image=default_image,
        mask_preview_links=mask_preview_links,
        recipient_email=recipient_email,
        batch_id=batch_id,
        payment_terms=payment_terms,
        preview_in_email=preview_in_email,
        custom_preview_in_email=custom_preview_in_email,
    )


def _build_from_custom_offers(custom_offers: dict, offers_per_email: int) -> dict:
    """Build user matches from admin-provided custom offer selections"""
    offers_col = db_instance.get_collection('offers')
    result = {}
    
    for user_id, offer_ids in custom_offers.items():
        if not offer_ids:
            result[user_id] = {'emails': [], 'total_offers': 0}
            continue
        
        # Fetch offer details
        offers = list(offers_col.find(
            {'offer_id': {'$in': offer_ids}},
            {
                'offer_id': 1, 'name': 1, 'payout': 1, 'network': 1,
                'category': 1, 'vertical': 1, 'countries': 1, 'allowed_countries': 1,
                'status': 1, 'image_url': 1, 'thumbnail_url': 1, 'preview_url': 1,
                'description': 1,
            }
        ))
        
        # Split into email batches
        emails = []
        for i in range(0, len(offers), offers_per_email):
            batch = offers[i:i + offers_per_email]
            if batch:
                emails.append({
                    'email_number': len(emails) + 1,
                    'offers': batch,
                })
        
        result[user_id] = {'emails': emails, 'total_offers': len(offers)}
    
    return result
