"""
Simple Offer Serving Routes - Tracking Link Handler
Handles click tracking with Schedule + Smart Rules integration
"""

from flask import Blueprint, request, jsonify, redirect
from datetime import datetime
import logging
import urllib.parse

# Create blueprint
offer_serving_bp = Blueprint('offer_serving', __name__)

logger = logging.getLogger(__name__)

@offer_serving_bp.route('/track/click', methods=['GET'])
def track_click_simple():
    """Handle click tracking with query parameters and apply Schedule + Smart Rules"""
    try:
        # Extract parameters from query string
        offer_id = request.args.get('offer_id')
        campaign_id = request.args.get('campaign_id')
        target_url = request.args.get('target')
        
        if not offer_id:
            return jsonify({'error': 'Missing offer_id parameter'}), 400
        
        if not target_url:
            return jsonify({'error': 'Missing target parameter'}), 400
        
        # Decode the target URL properly
        decoded_target = urllib.parse.unquote(target_url)
        
        logger.info(f"🔗 Click tracking: offer_id={offer_id}, campaign_id={campaign_id}")
        logger.info(f"🎯 Target URL: {decoded_target}")
        
        # Apply schedule and smart rules logic
        try:
            from models.offer_extended import OfferExtended
            extended_model = OfferExtended()
            
            # Get offer with schedule and smart rules
            offer = extended_model.get_offer_by_id(offer_id)
            
            if not offer:
                logger.warning(f"❌ Offer {offer_id} not found")
                return jsonify({'error': 'Offer not found'}), 404
            
            # Apply schedule and smart rules
            final_url = apply_schedule_and_smart_rules(offer, decoded_target, request)
            
            logger.info(f"✅ Final redirect URL: {final_url}")
            
            # Redirect to final URL
            return redirect(final_url, code=302)
            
        except ImportError:
            logger.warning("⚠️ OfferExtended model not available, using basic redirect")
            return redirect(decoded_target, code=302)
        except Exception as e:
            logger.error(f"❌ Error applying rules: {str(e)}")
            # Fallback to original URL if rules fail
            return redirect(decoded_target, code=302)
        
    except Exception as e:
        logger.error(f"❌ Error in click tracking: {str(e)}", exc_info=True)
        return jsonify({'error': 'Tracking error'}), 500

@offer_serving_bp.route('/track/click/debug', methods=['GET'])
def debug_click_tracking():
    """Debug endpoint to test click tracking without redirect"""
    try:
        # Extract parameters
        offer_id = request.args.get('offer_id')
        campaign_id = request.args.get('campaign_id')
        target_url = request.args.get('target')
        
        # Decode target URL
        decoded_target = urllib.parse.unquote(target_url) if target_url else None
        
        debug_info = {
            'request_params': {
                'offer_id': offer_id,
                'campaign_id': campaign_id,
                'target_encoded': target_url,
                'target_decoded': decoded_target
            },
            'user_context': {
                'ip': request.remote_addr,
                'user_agent': request.headers.get('User-Agent'),
                'geo_param': request.args.get('geo'),
                'detected_geo': get_user_geo(request)
            },
            'timestamp': datetime.utcnow().isoformat()
        }
        
        # Try to get offer info
        try:
            from models.offer_extended import OfferExtended
            extended_model = OfferExtended()
            offer = extended_model.get_offer_by_id(offer_id) if offer_id else None
            
            if offer:
                debug_info['offer_info'] = {
                    'offer_id': offer.get('offer_id'),
                    'name': offer.get('name'),
                    'status': offer.get('status'),
                    'has_schedule': bool(offer.get('schedule')),
                    'has_smart_rules': bool(offer.get('smartRules')),
                    'smart_rules_count': len(offer.get('smartRules', []))
                }
                
                # Test schedule and rules
                if offer.get('schedule'):
                    debug_info['schedule_check'] = is_within_schedule(offer['schedule'])
                
                if offer.get('smartRules'):
                    final_url = apply_smart_rules(offer['smartRules'], decoded_target, request)
                    debug_info['smart_rules_result'] = {
                        'original_url': decoded_target,
                        'final_url': final_url,
                        'rule_applied': final_url != decoded_target
                    }
            else:
                debug_info['offer_info'] = {'error': 'Offer not found'}
                
        except Exception as e:
            debug_info['offer_info'] = {'error': str(e)}
        
        return jsonify(debug_info), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def apply_schedule_and_smart_rules(offer, default_target_url, request):
    """
    Apply schedule and smart rules to determine the final destination URL
    """
    try:
        logger.info(f"🔍 Applying schedule and smart rules for offer {offer.get('offer_id')}")
        
        # Step 1: Check offer status
        if offer.get('status') != 'Active':
            logger.warning(f"❌ Offer {offer.get('offer_id')} is not active (status: {offer.get('status')})")
            return default_target_url
        
        # Step 2: Check schedule
        schedule = offer.get('schedule', {})
        if schedule:
            if not is_within_schedule(schedule):
                logger.warning(f"❌ Offer {offer.get('offer_id')} is outside scheduled time")
                return default_target_url
        
        # Step 3: Apply smart rules
        smart_rules = offer.get('smartRules', [])
        if smart_rules:
            final_url = apply_smart_rules(smart_rules, default_target_url, request)
            if final_url != default_target_url:
                logger.info(f"✅ Smart rule applied, redirecting to: {final_url}")
                return final_url
        
        # Step 4: Return default URL if no rules applied
        logger.info(f"✅ No rules applied, using default target: {default_target_url}")
        return default_target_url
        
    except Exception as e:
        logger.error(f"❌ Error applying schedule and smart rules: {str(e)}", exc_info=True)
        return default_target_url

def is_within_schedule(schedule):
    """Check if current time is within the offer's schedule"""
    try:
        # Check schedule status
        if schedule.get('status') != 'Active':
            return False
        
        now = datetime.utcnow()
        
        # Check date range
        start_at = schedule.get('startAt')
        end_at = schedule.get('endAt')
        
        if start_at and isinstance(start_at, datetime):
            if now < start_at:
                logger.info(f"⏰ Before start time: {now} < {start_at}")
                return False
        
        if end_at and isinstance(end_at, datetime):
            if now > end_at:
                logger.info(f"⏰ After end time: {now} > {end_at}")
                return False
        
        # Check recurring days
        if schedule.get('isRecurring'):
            recurring_days = schedule.get('recurringDays', [])
            if recurring_days:
                current_day = now.strftime('%A')  # Monday, Tuesday, etc.
                if current_day not in recurring_days:
                    logger.info(f"⏰ Not a recurring day: {current_day} not in {recurring_days}")
                    return False
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error checking schedule: {str(e)}")
        return True  # Default to allowing if error

def apply_smart_rules(smart_rules, default_url, request):
    """Apply smart rules to determine destination URL"""
    try:
        # Get user context
        user_geo = get_user_geo(request)
        
        # Filter active rules
        active_rules = [rule for rule in smart_rules if rule.get('active', True)]
        
        if not active_rules:
            return default_url
        
        # Sort by priority (1 = highest priority)
        sorted_rules = sorted(active_rules, key=lambda x: x.get('priority', 999))
        
        logger.info(f"🎯 Evaluating {len(sorted_rules)} active smart rules for GEO: {user_geo}")
        
        # Apply rules in priority order
        for rule in sorted_rules:
            rule_type = rule.get('type')
            rule_geo = rule.get('geo', [])
            rule_url = rule.get('url', default_url)
            
            logger.info(f"🔍 Checking rule: {rule_type}, GEO: {rule_geo}, URL: {rule_url}")
            
            # GEO targeting rule
            if rule_type == 'GEO':
                if user_geo in rule_geo:
                    logger.info(f"✅ GEO rule matched: {user_geo} in {rule_geo}")
                    return rule_url
                else:
                    logger.info(f"❌ GEO rule not matched: {user_geo} not in {rule_geo}")
            
            # Backup rule (applies to all)
            elif rule_type == 'Backup':
                if not rule_geo or user_geo in rule_geo:
                    logger.info(f"✅ Backup rule applied for GEO: {user_geo}")
                    return rule_url
        
        return default_url
        
    except Exception as e:
        logger.error(f"❌ Error applying smart rules: {str(e)}")
        return default_url

def get_user_geo(request):
    """Determine user's geographic location"""
    try:
        # Check for explicit geo parameter
        geo_param = request.args.get('geo')
        if geo_param:
            return geo_param.upper()
        
        # Check for geo in headers (if set by CDN/proxy)
        geo_header = request.headers.get('CF-IPCountry')  # Cloudflare
        if geo_header:
            return geo_header.upper()
        
        # Default fallback
        return 'US'
        
    except Exception as e:
        logger.error(f"❌ Error determining user geo: {str(e)}")
        return 'US'

@offer_serving_bp.route('/health', methods=['GET'])
def health_check():
    """Health check for offer serving"""
    return jsonify({
        'status': 'healthy',
        'service': 'offer_serving',
        'endpoints': ['/track/click', '/track/click/debug'],
        'timestamp': datetime.utcnow().isoformat()
    }), 200
