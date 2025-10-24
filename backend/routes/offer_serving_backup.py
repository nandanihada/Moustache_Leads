from flask import Blueprint, request, jsonify, redirect
from datetime import datetime, time
import logging
import urllib.parse

# Create blueprint
offer_serving_bp = Blueprint('offer_serving', __name__)

logger = logging.getLogger(__name__)

@offer_serving_bp.route('/api/offers/accessible', methods=['GET'])
@token_required
def get_accessible_offers(current_user):
    """Get offers accessible to current user"""
    try:
        # Get filters from query params
        filters = {}
        if request.args.get('category'):
            filters['category'] = request.args.get('category')
        if request.args.get('network'):
            filters['network'] = request.args.get('network')
        
        # Get accessible offers
        offers = access_service.get_user_accessible_offers(current_user['_id'], filters)
        
        # Add tracking links for each offer
        for offer in offers:
            tracking_info = tracking_service.generate_tracking_link(
                offer['offer_id'], 
                current_user['_id']
            )
            
            if 'error' not in tracking_info:
                offer['tracking_url'] = tracking_info['tracking_url']
                offer['click_id'] = tracking_info['click_id']
        
        return jsonify({
            'offers': offers,
            'total': len(offers)
        })
        
    except Exception as e:
        logger.error(f"Error getting accessible offers: {str(e)}")
        return jsonify({'error': 'Failed to get offers'}), 500

@offer_serving_bp.route('/api/offers/<offer_id>/request-access', methods=['POST'])
@token_required
def request_offer_access(current_user, offer_id):
    """Request access to an offer"""
    try:
        data = request.get_json() or {}
        message = data.get('reason', '')
        
        result = access_service.request_offer_access(offer_id, current_user['_id'], message)
        
        if 'error' in result:
            return jsonify(result), 400
        
        return jsonify({
            'message': 'Access request submitted successfully',
            'request_id': result.get('request_id')
        })
        
    except Exception as e:
        logger.error(f"Error requesting offer access: {str(e)}")
        return jsonify({'error': 'Failed to request access'}), 500

@offer_serving_bp.route('/api/offers/<offer_id>/check-access', methods=['GET'])
@token_required
def check_offer_access(current_user, offer_id):
    """Check if user has access to an offer"""
    try:
        has_access, reason = access_service.check_offer_access(offer_id, current_user['_id'])
        
        return jsonify({
            'has_access': has_access,
            'reason': reason,
            'offer_id': offer_id
        })
        
    except Exception as e:
        logger.error(f"Error checking offer access: {str(e)}")
        return jsonify({'error': str(e)}), 500

@offer_serving_bp.route('/api/offers/<offer_id>/tracking-link', methods=['POST'])
@token_required
def generate_tracking_link(current_user, offer_id):
    """Generate tracking link for an offer"""
    try:
        # Check access first
        has_access, reason = access_service.check_offer_access(offer_id, current_user['_id'])
        if not has_access:
            return jsonify({'error': reason}), 403
        
        # Get sub IDs from request
        data = request.get_json() or {}
        sub_ids = [
            data.get('sub1', ''),
            data.get('sub2', ''),
            data.get('sub3', ''),
            data.get('sub4', ''),
            data.get('sub5', '')
        ]
        
        # Generate tracking link
        tracking_info = tracking_service.generate_tracking_link(
            offer_id, 
            current_user['_id'], 
            sub_ids
        )
        
        if 'error' in tracking_info:
            return jsonify(tracking_info), 400
        
        return jsonify(tracking_info)
        
    except Exception as e:
        logger.error(f"Error generating tracking link: {str(e)}")
        return jsonify({'error': str(e)}), 500

@offer_serving_bp.route('/track/click', methods=['GET'])
def track_click_simple():
    """Handle click tracking with query parameters (for backward compatibility)"""
    try:
        # Extract offer_id from query parameters
        offer_id = request.args.get('offer_id')
        campaign_id = request.args.get('campaign_id')
        target_url = request.args.get('target')
        
        if not offer_id:
            return jsonify({'error': 'Missing offer_id parameter'}), 400
        
        if not target_url:
            return jsonify({'error': 'Missing target parameter'}), 400
        
        # Decode the target URL properly
        import urllib.parse
        decoded_target = urllib.parse.unquote(target_url)
        
        logger.info(f"🔗 Click tracking: offer_id={offer_id}, target={decoded_target}")
        
        # Apply schedule and smart rules logic here
        from models.offer_extended import OfferExtended
        extended_model = OfferExtended()
        
        # Get offer with schedule and smart rules
        offer = extended_model.get_offer_by_id(offer_id)
        
        if not offer:
            return jsonify({'error': 'Offer not found'}), 404
        
        # Check if offer is active and within schedule
        final_url = apply_schedule_and_smart_rules(offer, decoded_target, request)
        
        logger.info(f"🎯 Final redirect URL: {final_url}")
        
        # Redirect to final URL
        return redirect(final_url, code=302)
        
    except Exception as e:
        logger.error(f"Error in click tracking: {str(e)}", exc_info=True)
        return jsonify({'error': 'Tracking error'}), 500

@offer_serving_bp.route('/track/click/<click_id>', methods=['GET'])
def track_click(click_id):
    """Handle click tracking and redirect"""
    try:
        # Extract request information
        request_info = targeting_service.extract_request_info(request)
        
        # Add URL parameters
        request_info.update({
            'offer_id': request.args.get('offer_id'),
            'aff_id': request.args.get('aff_id'),
            'hash': request.args.get('hash'),
            'sub1': request.args.get('sub1', ''),
            'sub2': request.args.get('sub2', ''),
            'sub3': request.args.get('sub3', ''),
            'sub4': request.args.get('sub4', ''),
            'sub5': request.args.get('sub5', ''),
            'referer': request.headers.get('Referer', '')
        })
        
        # Record click
        click_result = tracking_service.record_click(click_id, request_info)
        
        if 'error' in click_result:
            return jsonify(click_result), 400
        
        # Get offer for targeting validation
        from models.offer import Offer
        offer_model = Offer()
        offer = offer_model.get_offer_by_id(request_info['offer_id'])
        
        if not offer:
            return jsonify({'error': 'Offer not found'}), 404
        
        # Validate targeting
        targeting_valid, targeting_reason = targeting_service.validate_targeting(offer, request_info)
        if not targeting_valid:
            logger.warning(f"Targeting failed for click {click_id}: {targeting_reason}")
            # You might want to redirect to a fallback URL or show an error
            # For now, we'll still redirect but log the issue
        
        # Validate traffic source
        traffic_valid, traffic_reason = tracking_service.validate_traffic_source(offer, request_info)
        if not traffic_valid:
            logger.warning(f"Traffic source validation failed for click {click_id}: {traffic_reason}")
        
        # Check caps
        cap_status = cap_service.check_offer_caps(request_info['offer_id'])
        if cap_status.get('auto_paused'):
            logger.warning(f"Offer {request_info['offer_id']} was auto-paused due to cap limits")
            # Redirect to fallback URL if available
            fallback_url = offer.get('fallback_url')
            if fallback_url:
                return redirect(fallback_url)
        
        # Redirect to offer
        redirect_url = click_result['redirect_url']
        return redirect(redirect_url)
        
    except Exception as e:
        logger.error(f"Error tracking click: {str(e)}")
        return jsonify({'error': 'Tracking error'}), 500

@offer_serving_bp.route('/api/postback/conversion', methods=['GET', 'POST'])
def handle_conversion_postback():
    """Handle conversion postback from advertiser"""
    try:
        # Get parameters from GET or POST
        if request.method == 'GET':
            params = request.args.to_dict()
        else:
            params = request.get_json() or request.form.to_dict()
        
        # Extract conversion data
        conversion_data = {
            'click_id': params.get('click_id'),
            'payout': float(params.get('payout', 0)) if params.get('payout') else None,
            'status': params.get('status', 'pending'),
            'external_id': params.get('external_id'),
            'revenue': float(params.get('revenue', 0)) if params.get('revenue') else None
        }
        
        # Record conversion
        result = tracking_service.record_conversion(conversion_data)
        
        if 'error' in result:
            return jsonify(result), 400
        
        # Update affiliate stats
        conversion = result['conversion']
        stats_update = {
            'total_conversions': 1,
            'total_earnings': conversion['payout']
        }
        access_service.update_affiliate_stats(conversion['affiliate_id'], stats_update)
        
        # Check caps after conversion
        cap_service.check_offer_caps(conversion['offer_id'])
        
        return jsonify({
            'status': 'success',
            'conversion_id': conversion['conversion_id'],
            'message': 'Conversion recorded successfully'
        })
        
    except Exception as e:
        logger.error(f"Error handling conversion postback: {str(e)}")
        return jsonify({'error': 'Postback processing error'}), 500

@offer_serving_bp.route('/api/offers/<offer_id>/caps', methods=['GET'])
@token_required
def get_offer_caps(current_user, offer_id):
    """Get current cap status for an offer"""
    try:
        # Check if user has access (admin/manager only)
        if not access_service.check_user_permissions(current_user['_id'], 'manager'):
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        cap_status = cap_service.check_offer_caps(offer_id)
        
        return jsonify(cap_status)
        
    except Exception as e:
        logger.error(f"Error getting offer caps: {str(e)}")
        return jsonify({'error': str(e)}), 500

@offer_serving_bp.route('/api/admin/access-requests', methods=['GET'])
@token_required
def get_access_requests(current_user):
    """Get pending access requests (admin only)"""
    try:
        # Check admin permissions
        if not access_service.check_user_permissions(current_user['_id'], 'admin'):
            return jsonify({'error': 'Admin access required'}), 403
        
        offer_id = request.args.get('offer_id')
        requests = access_service.get_pending_access_requests(offer_id)
        
        return jsonify({
            'requests': requests,
            'total': len(requests)
        })
        
    except Exception as e:
        logger.error(f"Error getting access requests: {str(e)}")
        return jsonify({'error': str(e)}), 500

@offer_serving_bp.route('/api/admin/access-requests/<request_id>/approve', methods=['POST'])
@token_required
def approve_access_request(current_user, request_id):
    """Approve access request (admin only)"""
    try:
        # Check admin permissions
        if not access_service.check_user_permissions(current_user['_id'], 'admin'):
            return jsonify({'error': 'Admin access required'}), 403
        
        data = request.get_json() or {}
        notes = data.get('notes', '')
        
        result = access_service.approve_access_request(
            request_id, 
            current_user['_id'], 
            notes
        )
        
        if 'error' in result:
            return jsonify(result), 400
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error approving access request: {str(e)}")
        return jsonify({'error': str(e)}), 500

@offer_serving_bp.route('/api/admin/access-requests/<request_id>/deny', methods=['POST'])
@token_required
def deny_access_request(current_user, request_id):
    """Deny access request (admin only)"""
    try:
        # Check admin permissions
        if not access_service.check_user_permissions(current_user['_id'], 'admin'):
            return jsonify({'error': 'Admin access required'}), 403
        
        data = request.get_json() or {}
        reason = data.get('reason', '')
        
        result = access_service.deny_access_request(
            request_id, 
            current_user['_id'], 
            reason
        )
        
        if 'error' in result:
            return jsonify(result), 400
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error denying access request: {str(e)}")
        return jsonify({'error': str(e)}), 500

@offer_serving_bp.route('/api/affiliate/performance', methods=['GET'])
@token_required
def get_affiliate_performance(current_user):
    """Get affiliate performance metrics"""
    try:
        performance = access_service.get_affiliate_performance(current_user['_id'])
        
        return jsonify(performance)
        
    except Exception as e:
        logger.error(f"Error getting affiliate performance: {str(e)}")
        return jsonify({'error': str(e)}), 500

def apply_schedule_and_smart_rules(offer, default_target_url, request):
    """
    Apply schedule and smart rules to determine the final destination URL
    
    Args:
        offer: Offer document with schedule and smartRules
        default_target_url: Original target URL
        request: Flask request object
        
    Returns:
        str: Final destination URL after applying rules
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
    """
    Check if current time is within the offer's schedule
    
    Args:
        schedule: Schedule object with startAt, endAt, isRecurring, recurringDays, status
        
    Returns:
        bool: True if within schedule, False otherwise
    """
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
    """
    Apply smart rules to determine destination URL
    
    Args:
        smart_rules: List of smart rule objects
        default_url: Default target URL
        request: Flask request object
        
    Returns:
        str: Final destination URL
    """
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
            
            # Time-based rule (future implementation)
            elif rule_type == 'Time':
                # TODO: Implement time-based rules
                pass
            
            # Rotation rule (future implementation)
            elif rule_type == 'Rotation':
                # TODO: Implement rotation rules
                pass
        
        return default_url
        
    except Exception as e:
        logger.error(f"❌ Error applying smart rules: {str(e)}")
        return default_url

def get_user_geo(request):
    """
    Determine user's geographic location
    
    Args:
        request: Flask request object
        
    Returns:
        str: Country code (e.g., 'US', 'CA')
    """
    try:
        # Check for explicit geo parameter
        geo_param = request.args.get('geo')
        if geo_param:
            return geo_param.upper()
        
        # Check for geo in headers (if set by CDN/proxy)
        geo_header = request.headers.get('CF-IPCountry')  # Cloudflare
        if geo_header:
            return geo_header.upper()
        
        # Get IP address
        ip_address = request.remote_addr
        if ip_address and ip_address != '127.0.0.1':
            # TODO: Implement IP geolocation lookup
            # For now, default to US
            pass
        
        # Default fallback
        return 'US'
        
    except Exception as e:
        logger.error(f"❌ Error determining user geo: {str(e)}")
        return 'US'
