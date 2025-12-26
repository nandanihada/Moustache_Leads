"""
Simple Offer Serving Routes - Tracking Link Handler
Handles click tracking with Schedule + Smart Rules integration
Includes geo-restriction for country-based access control
"""

from flask import Blueprint, request, jsonify, redirect, render_template_string
from datetime import datetime
import logging
import urllib.parse

# Create blueprint
offer_serving_bp = Blueprint('offer_serving', __name__)

logger = logging.getLogger(__name__)

# Default fallback URL for geo-restricted users (can be overridden in config)
DEFAULT_NON_ACCESS_URL = 'https://example.com/not-available'


def check_geo_access(offer, user_country):
    """
    Check if user's country is allowed to access the offer.
    
    Args:
        offer: Offer document with allowed_countries and non_access_url
        user_country: User's country code (e.g., 'US', 'IN')
        
    Returns:
        Tuple of (is_allowed: bool, redirect_url: str or None)
        - If allowed: (True, None)
        - If blocked: (False, redirect_url)
    """
    allowed_countries = offer.get('allowed_countries', [])
    
    # If no geo-restriction configured, allow access
    if not allowed_countries:
        return True, None
    
    # Normalize country codes to uppercase
    allowed_countries = [c.upper() for c in allowed_countries]
    user_country = user_country.upper() if user_country else ''
    
    # Check if user's country is in allowed list
    if user_country in allowed_countries:
        logger.info(f"✅ Geo-check passed: {user_country} in {allowed_countries}")
        return True, None
    
    # User is blocked - get redirect URL
    non_access_url = offer.get('non_access_url', '').strip()
    if not non_access_url:
        non_access_url = DEFAULT_NON_ACCESS_URL
    
    logger.warning(f"🚫 Geo-blocked: {user_country} not in {allowed_countries}, redirecting to {non_access_url}")
    return False, non_access_url

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
    Apply schedule, geo-restriction, and smart rules to determine the final destination URL
    """
    try:
        logger.info(f"🔍 Applying schedule and smart rules for offer {offer.get('offer_id')}")
        
        # Step 1: Check offer status
        if offer.get('status') != 'Active':
            logger.warning(f"❌ Offer {offer.get('offer_id')} is not active (status: {offer.get('status')})")
            return default_target_url
        
        # Step 2: Check geo-restriction (NEW)
        user_geo = get_user_geo(request)
        is_geo_allowed, geo_redirect_url = check_geo_access(offer, user_geo)
        if not is_geo_allowed:
            logger.warning(f"🚫 Offer {offer.get('offer_id')} geo-blocked for {user_geo}")
            return geo_redirect_url
        
        # Step 3: Check schedule
        schedule = offer.get('schedule', {})
        if schedule:
            if not is_within_schedule(schedule):
                logger.warning(f"❌ Offer {offer.get('offer_id')} is outside scheduled time")
                return default_target_url
        
        # Step 4: Apply smart rules
        smart_rules = offer.get('smartRules', [])
        if smart_rules:
            final_url = apply_smart_rules(smart_rules, default_target_url, request)
            if final_url != default_target_url:
                logger.info(f"✅ Smart rule applied, redirecting to: {final_url}")
                return final_url
        
        # Step 5: Return default URL if no rules applied
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
        'endpoints': ['/track/click', '/track/click/debug', '/preview/<offer_id>'],
        'timestamp': datetime.utcnow().isoformat()
    }), 200


# Preview page HTML template with 8-second countdown
PREVIEW_PAGE_TEMPLATE = '''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ offer_name }} - Preview</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .preview-card {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 500px;
            width: 100%;
            overflow: hidden;
        }
        .preview-header {
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: white;
            padding: 24px;
            text-align: center;
        }
        .preview-header h1 {
            font-size: 1.5rem;
            margin-bottom: 8px;
        }
        .preview-header p {
            opacity: 0.9;
            font-size: 0.9rem;
        }
        .preview-body {
            padding: 32px 24px;
            text-align: center;
        }
        .offer-image {
            width: 120px;
            height: 120px;
            border-radius: 12px;
            object-fit: cover;
            margin-bottom: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .offer-name {
            font-size: 1.25rem;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 8px;
        }
        .offer-description {
            color: #6b7280;
            font-size: 0.95rem;
            line-height: 1.5;
            margin-bottom: 20px;
        }
        .payout-badge {
            display: inline-block;
            background: #ecfdf5;
            color: #059669;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 1.1rem;
            margin-bottom: 24px;
        }
        .countdown-section {
            background: #f9fafb;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .countdown-text {
            color: #6b7280;
            font-size: 0.9rem;
            margin-bottom: 8px;
        }
        .countdown-number {
            font-size: 2.5rem;
            font-weight: 700;
            color: #4f46e5;
        }
        .progress-bar {
            width: 100%;
            height: 6px;
            background: #e5e7eb;
            border-radius: 3px;
            overflow: hidden;
            margin-top: 12px;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #4f46e5, #7c3aed);
            border-radius: 3px;
            transition: width 1s linear;
        }
        .skip-btn {
            background: #4f46e5;
            color: white;
            border: none;
            padding: 14px 32px;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            width: 100%;
        }
        .skip-btn:hover {
            background: #4338ca;
            transform: translateY(-1px);
        }
        .skip-btn:disabled {
            background: #9ca3af;
            cursor: not-allowed;
            transform: none;
        }
    </style>
</head>
<body>
    <div class="preview-card">
        <div class="preview-header">
            <h1>Offer Preview</h1>
            <p>Please wait while we prepare your offer</p>
        </div>
        <div class="preview-body">
            {% if image_url %}
            <img src="{{ image_url }}" alt="{{ offer_name }}" class="offer-image" onerror="this.style.display='none'">
            {% endif %}
            <div class="offer-name">{{ offer_name }}</div>
            <div class="offer-description">{{ description }}</div>
            {% if payout %}
            <div class="payout-badge">Earn {{ payout }} {{ currency }}</div>
            {% endif %}
            <div class="countdown-section">
                <div class="countdown-text">Redirecting in</div>
                <div class="countdown-number" id="countdown">8</div>
                <div class="progress-bar">
                    <div class="progress-fill" id="progress" style="width: 0%"></div>
                </div>
            </div>
            <button class="skip-btn" id="skipBtn" onclick="skipToOffer()">Skip & Continue</button>
        </div>
    </div>

    <script>
        const redirectUrl = "{{ redirect_url }}";
        let countdown = 8;
        const countdownEl = document.getElementById('countdown');
        const progressEl = document.getElementById('progress');
        const skipBtn = document.getElementById('skipBtn');
        
        function updateCountdown() {
            countdown--;
            countdownEl.textContent = countdown;
            progressEl.style.width = ((8 - countdown) / 8 * 100) + '%';
            
            if (countdown <= 0) {
                skipToOffer();
            }
        }
        
        function skipToOffer() {
            skipBtn.disabled = true;
            skipBtn.textContent = 'Redirecting...';
            window.location.href = redirectUrl;
        }
        
        // Start countdown
        setInterval(updateCountdown, 1000);
    </script>
</body>
</html>
'''


@offer_serving_bp.route('/preview/<offer_id>', methods=['GET'])
def preview_offer(offer_id):
    """
    Show preview page for an offer with 8-second countdown before redirect.
    Redirects to target_url after countdown.
    """
    try:
        logger.info(f"📄 Preview page requested for offer: {offer_id}")
        
        # Try to get offer details
        offer = None
        try:
            from models.offer_extended import OfferExtended
            extended_model = OfferExtended()
            offer = extended_model.get_offer_by_id(offer_id)
        except ImportError:
            try:
                from models.offer import Offer
                offer_model = Offer()
                offer = offer_model.get_offer_by_id(offer_id)
            except:
                pass
        
        if not offer:
            logger.warning(f"❌ Offer not found for preview: {offer_id}")
            # Return a simple error page
            return jsonify({'error': 'Offer not found'}), 404
        
        # Get redirect URL - use target_url (the actual offer URL)
        redirect_url = offer.get('target_url', '').strip()
        if not redirect_url:
            # Fallback to preview_url if target_url is empty
            redirect_url = offer.get('preview_url', '').strip()
        if not redirect_url:
            redirect_url = 'https://google.com'  # Last resort fallback
        
        # Prepare template data
        template_data = {
            'offer_name': offer.get('name', 'Offer'),
            'description': offer.get('description', 'Complete this offer to earn rewards.'),
            'image_url': offer.get('image_url', ''),
            'payout': offer.get('payout', ''),
            'currency': offer.get('currency', 'USD'),
            'redirect_url': redirect_url
        }
        
        logger.info(f"✅ Rendering preview page, redirect to: {redirect_url}")
        
        return render_template_string(PREVIEW_PAGE_TEMPLATE, **template_data)
        
    except Exception as e:
        logger.error(f"❌ Error rendering preview page: {str(e)}", exc_info=True)
        return jsonify({'error': 'Preview error'}), 500
