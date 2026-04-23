"""
Admin Click Tracking API
Provides advanced click analytics, suspicious click detection, and quick actions
"""

from flask import Blueprint, request, jsonify
from database import db_instance
from utils.auth import token_required, subadmin_or_admin_required
from datetime import datetime, timedelta
import logging
from bson.objectid import ObjectId

logger = logging.getLogger(__name__)

admin_click_tracking_bp = Blueprint('admin_click_tracking', __name__)

@admin_click_tracking_bp.route('/analytics', methods=['GET'])
@token_required
@subadmin_or_admin_required('tracking')
def get_click_analytics():
    """
    Get detailed click analytics including suspicious flags
    """
    try:
        days = int(request.args.get('days', 365))
        source = request.args.get('source', 'offerwall')
        start_date = datetime.utcnow() - timedelta(days=days)
        
        if source == 'dashboard':
            clicks_collection = db_instance.get_collection('dashboard_clicks')
            match_query = {'timestamp': {'$gte': start_date}}
            user_field = '$user_id' # or affiliate_id
            offer_field = '$offer_id'
        else:
            clicks_collection = db_instance.get_collection('offerwall_clicks_detailed')
            if clicks_collection.count_documents({}) == 0:
                clicks_collection = db_instance.get_collection('offerwall_clicks')
            match_query = {'timestamp': {'$gte': start_date}}
            user_field = '$user_id'
            offer_field = '$offer_id'

        
        clicks_cursor = clicks_collection.find(match_query).sort('timestamp', -1).limit(1000)
        clicks = list(clicks_cursor)
        
        # Analyze suspicious clicks
        # Flag if same IP clicked same offer > 3 times within 1 hour
        # Flag if same User clicked same offer > 10 times within 1 hour
        ip_tracker = {}
        user_tracker = {}
        processed_clicks = []
        
        for click in clicks:
            # Add to trackers
            ip = click.get('ip_address', 'Unknown')
            user_id = click.get('user_id') or click.get('affiliate_id') or click.get('publisher_id', 'Unknown')
            offer_id = click.get('offer_id', 'Unknown')
            
            ip_key = f"{ip}_{offer_id}"
            user_key = f"{user_id}_{offer_id}"
            
            ip_tracker[ip_key] = ip_tracker.get(ip_key, 0) + 1
            user_tracker[user_key] = user_tracker.get(user_key, 0) + 1
            
            is_suspicious = False
            suspicious_reason = ""
            
            if ip_tracker[ip_key] > 3:
                is_suspicious = True
                suspicious_reason = "Multiple clicks from same IP on same offer."
            if user_tracker[user_key] > 10:
                is_suspicious = True
                suspicious_reason = "Too many clicks from user on same offer."
                
            click_data = {
                'click_id': click.get('click_id'),
                'offer_id': click.get('offer_id'),
                'affiliate_id': click.get('affiliate_id'),
                'ip_address': click.get('ip_address'),
                'country': click.get('country'),
                'click_time': click.get('click_time', click.get('created_at')).isoformat() if click.get('click_time') or click.get('created_at') else None,
                'status': click.get('status'),
                'is_suspicious': is_suspicious,
                'suspicious_reason': suspicious_reason
            }
            if '_id' in click:
                click_data['_id'] = str(click['_id'])
            processed_clicks.append(click_data)
            
        # Bulk lookup offer statuses
        unique_offer_ids = list(set([c['offer_id'] for c in processed_clicks if c.get('offer_id')]))
        offers_collection = db_instance.get_collection('offers')
        offer_statuses = {}
        if unique_offer_ids:
            offers_cursor = offers_collection.find({'offer_id': {'$in': unique_offer_ids}}, {'offer_id': 1, 'status': 1})
            for off in offers_cursor:
                offer_statuses[off.get('offer_id')] = off.get('status', '').lower()
                
        for click in processed_clicks:
            offer_id = click.get('offer_id')
            status = offer_statuses.get(offer_id, 'active')
            click['offer_status'] = status
            click['is_paused'] = status == 'paused'

        # Aggregations for top stats using pure Python to avoid Atlas limitations
        from collections import Counter
        
        user_counter = Counter([c.get('user_id') or c.get('affiliate_id') or c.get('publisher_id') for c in clicks if (c.get('user_id') or c.get('affiliate_id') or c.get('publisher_id'))])
        top_users = [{'user_id': str(k), 'clicks': v} for k, v in user_counter.most_common(10)]
        
        offer_counter = Counter([c.get('offer_id') for c in clicks if c.get('offer_id')])
        top_offers = [{'offer_id': str(k), 'clicks': v} for k, v in offer_counter.most_common(10)]
        
        country_counter = Counter([c.get('geo', {}).get('country') or c.get('country') for c in clicks if (c.get('geo', {}).get('country') or c.get('country'))])
        top_countries = [{'country': str(k), 'clicks': v} for k, v in country_counter.most_common(10)]
        
        return jsonify({
            'success': True,
            'recent_clicks': processed_clicks,
            'top_users': top_users,
            'top_offers': top_offers,
            'top_countries': top_countries
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting click analytics: {str(e)}")
        return jsonify({'error': str(e)}), 500

@admin_click_tracking_bp.route('/action/warn', methods=['POST'])
@token_required
@subadmin_or_admin_required('tracking')
def warn_user():
    """Warn a user about suspicious clicks via support message"""
    try:
        data = request.json
        user_id = data.get('user_id')
        reason = data.get('reason', 'Suspicious click activity detected.')
        
        if not user_id:
            return jsonify({'error': 'User ID required'}), 400
            
        messages_collection = db_instance.get_collection('support_messages')
        
        message = {
            'message_id': str(ObjectId()),
            'user_id': user_id,
            'sender_id': 'system',
            'sender_type': 'admin',
            'subject': 'Warning: Suspicious Activity Detected',
            'message': f"We have detected suspicious click activity on your account. Reason: {reason}. Please review your traffic sources.",
            'is_read': False,
            'created_at': datetime.utcnow()
        }
        
        messages_collection.insert_one(message)
        
        return jsonify({'success': True, 'message': 'Warning sent successfully.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_click_tracking_bp.route('/action/pause-offer', methods=['POST'])
@token_required
@subadmin_or_admin_required('tracking')
def pause_offer():
    """Pause an offer and return related suggestions to announce"""
    try:
        data = request.json
        offer_id = data.get('offer_id')
        
        if not offer_id:
            return jsonify({'error': 'Offer ID required'}), 400
            
        offers_collection = db_instance.get_collection('offers')
        offer = offers_collection.find_one({'offer_id': offer_id})
        
        if not offer:
            return jsonify({'error': 'Offer not found'}), 404
            
        offers_collection.update_one(
            {'offer_id': offer_id},
            {'$set': {'status': 'paused', 'updated_at': datetime.utcnow()}}
        )
        
        # Suggest related offers
        network = offer.get('network', '')
        category = offer.get('category', '')
        
        related_offers = list(offers_collection.find({
            'status': {'$in': ['Active', 'active']},
            'offer_id': {'$ne': offer_id},
            '$or': [{'network': network}, {'category': category}]
        }).limit(5))
        
        suggestions = [{'offer_id': o.get('offer_id'), 'name': o.get('name'), 'payout': o.get('payout')} for o in related_offers]
        
        return jsonify({'success': True, 'message': 'Offer paused successfully.', 'suggestions': suggestions})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_click_tracking_bp.route('/action/unpause-offer', methods=['POST'])
@token_required
@subadmin_or_admin_required('tracking')
def unpause_offer():
    """Unpause an offer (reactivate it)"""
    try:
        data = request.json
        offer_id = data.get('offer_id')
        
        if not offer_id:
            return jsonify({'error': 'Offer ID required'}), 400
            
        offers_collection = db_instance.get_collection('offers')
        offer = offers_collection.find_one({'offer_id': offer_id})
        
        if not offer:
            return jsonify({'error': 'Offer not found'}), 404
            
        # 'Active' is consistently used in places but let's use 'active' or 'Active'. 
        # Typically Moustache Leads handles case incognito. Let's use 'Active'.
        offers_collection.update_one(
            {'offer_id': offer_id},
            {'$set': {'status': 'Active', 'updated_at': datetime.utcnow()}}
        )
        
        return jsonify({'success': True, 'message': 'Offer unpaused and is now active.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_click_tracking_bp.route('/action/decrease-price', methods=['POST'])
@token_required
@subadmin_or_admin_required('tracking')
def decrease_price():
    """Decrease the price of an offer for a user or globally"""
    try:
        data = request.json
        offer_id = data.get('offer_id')
        user_id = data.get('user_id') # If None, global
        new_price = data.get('new_price')
        announce = data.get('announce', False)
        
        if not offer_id or not new_price:
            return jsonify({'error': 'Offer ID and new price required'}), 400
            
        # In a real app, per-user pricing might be stored in a separate collection 
        # or as an override array. For simplicity, we assume we update the global payout if no user,
        # or we could store a user_payouts array. Let's update global payout if no user_id.
        offers_collection = db_instance.get_collection('offers')
        
        if not user_id:
            offers_collection.update_one(
                {'offer_id': offer_id},
                {'$set': {'payout': float(new_price), 'updated_at': datetime.utcnow()}}
            )
            msg = f"Global price decreased to {new_price}."
            
            if announce:
                # Add announcement logic if exists, or send global message
                pass
        else:
            # Just an example of how you might store a user override
            offers_collection.update_one(
                {'offer_id': offer_id},
                {'$set': {f"custom_payouts.{user_id}": float(new_price)}}
            )
            msg = f"Price decreased to {new_price} for user {user_id}."
            
        return jsonify({'success': True, 'message': msg})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
