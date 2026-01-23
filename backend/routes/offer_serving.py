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
            background: #f5f5f5;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }
        
        /* Top banner - clean minimal design */
        .preview-banner {
            background: #ffffff;
            border-bottom: 1px solid #e0e0e0;
            padding: 10px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
            position: relative;
            z-index: 1000;
        }
        
        .banner-left {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .preview-badge {
            background: #f0f0f0;
            color: #666;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
        }
        
        .offer-name-small {
            font-size: 14px;
            font-weight: 500;
            color: #333;
            max-width: 300px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .banner-right {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        .countdown-text {
            font-size: 13px;
            color: #666;
        }
        
        .countdown-number {
            font-size: 18px;
            font-weight: 600;
            color: #333;
            font-family: 'Courier New', monospace;
            min-width: 24px;
            text-align: center;
        }
        
        .close-button {
            background: #f5f5f5;
            color: #333;
            border: 1px solid #ddd;
            padding: 6px 14px;
            border-radius: 4px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            text-decoration: none;
        }
        
        .close-button:hover {
            background: #e8e8e8;
            border-color: #ccc;
        }
        
        /* Progress bar */
        .progress-container {
            width: 100%;
            height: 2px;
            background: #e0e0e0;
            position: absolute;
            bottom: 0;
            left: 0;
        }
        
        .progress-bar {
            height: 100%;
            background: #333;
            width: 100%;
            animation: progress 8s linear forwards;
        }
        
        @keyframes progress {
            from { width: 100%; }
            to { width: 0%; }
        }
        
        /* Preview iframe container */
        .preview-container {
            flex: 1;
            width: 100%;
            height: calc(100vh - 50px);
            position: relative;
            background: #fff;
        }
        
        .preview-iframe {
            width: 100%;
            height: 100%;
            border: none;
            background: white;
        }
        
        /* Loading state */
        .loading-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: #fafafa;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #666;
            font-size: 14px;
            z-index: 999;
        }
        
        .loading-overlay.hidden {
            display: none;
        }
        
        .spinner {
            border: 2px solid #e0e0e0;
            border-top: 2px solid #666;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            animation: spin 0.8s linear infinite;
            margin-right: 10px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        /* Mobile responsive */
        @media (max-width: 600px) {
            .preview-banner {
                flex-direction: column;
                gap: 8px;
                padding: 8px 12px;
            }
            .banner-right {
                width: 100%;
                justify-content: space-between;
            }
            .offer-name-small {
                max-width: 200px;
                font-size: 13px;
            }
        }
    </style>
</head>
<body>
    <!-- Top banner - minimal design -->
    <div class="preview-banner">
        <div class="banner-left">
            <span class="preview-badge">Preview</span>
            <span class="offer-name-small">{{ offer_name }}</span>
        </div>
        
        <div class="banner-right">
            <span class="countdown-text">Closing in <span class="countdown-number" id="countdown">8</span>s</span>
            <a href="{{ redirect_url }}" class="close-button" id="closeButton">Close</a>
        </div>
        
        <div class="progress-container">
            <div class="progress-bar" id="progressBar"></div>
        </div>
    </div>
    
    <!-- Preview content -->
    <div class="preview-container">
        <div class="loading-overlay" id="loadingOverlay">
            <div class="spinner"></div>
            <span>Loading preview...</span>
        </div>
        <iframe 
            id="previewFrame"
            class="preview-iframe" 
            src="{{ preview_url }}"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            onload="document.getElementById('loadingOverlay').classList.add('hidden')"
        ></iframe>
    </div>
    
    <script>
        let timeLeft = 8;
        const countdownElement = document.getElementById('countdown');
        const redirectUrl = "{{ redirect_url }}";
        
        const countdownInterval = setInterval(() => {
            timeLeft--;
            countdownElement.textContent = timeLeft;
            
            if (timeLeft <= 0) {
                clearInterval(countdownInterval);
                window.location.href = redirectUrl;
            }
        }, 1000);
        
        document.getElementById('closeButton').addEventListener('click', (e) => {
            clearInterval(countdownInterval);
        });
        
        setTimeout(() => {
            document.getElementById('loadingOverlay').classList.add('hidden');
        }, 5000);
    </script>
</body>
</html>
'''


@offer_serving_bp.route('/preview/<offer_id>', methods=['GET'])
def preview_offer(offer_id):
    """
    Show preview page for an offer with 8-second countdown before redirect.
    Uses preview_url if set, otherwise defaults to google.com.
    After countdown, redirects to google.com (not the actual offer).
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
        
        # Get preview URL - use preview_url if set, otherwise default to google.com
        # This is for showing the landing page preview in the iframe
        preview_url = offer.get('preview_url', '').strip()
        if not preview_url:
            preview_url = 'https://www.google.com'  # Default preview
        
        # After countdown, always redirect to google.com (not the actual offer)
        # This is a preview, not an actual click
        redirect_url = 'https://www.google.com'
        
        # Prepare template data
        template_data = {
            'offer_name': offer.get('name', 'Offer'),
            'description': offer.get('description', 'Complete this offer to earn rewards.'),
            'image_url': offer.get('image_url', ''),
            'payout': offer.get('payout', ''),
            'currency': offer.get('currency', 'USD'),
            'redirect_url': redirect_url,
            'preview_url': preview_url
        }
        
        logger.info(f"✅ Rendering preview page, showing: {preview_url}, redirect to: {redirect_url}")
        
        return render_template_string(PREVIEW_PAGE_TEMPLATE, **template_data)
        
    except Exception as e:
        logger.error(f"❌ Error rendering preview page: {str(e)}", exc_info=True)
        return jsonify({'error': 'Preview error'}), 500
