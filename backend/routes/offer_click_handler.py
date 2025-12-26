"""
Offer Click Handler Routes
Handles offer click resolution and redirection using smart rules
"""

from flask import Blueprint, request, redirect, jsonify, render_template_string
from services.smart_rules_resolver import resolve_offer_click, get_resolver_service
from services.geo_restriction_service import get_geo_restriction_service
from models.offer import Offer
from datetime import datetime
import logging

# Create blueprint
click_handler_bp = Blueprint('offer_click_handler', __name__)

# Initialize services
offer_model = Offer()
geo_restriction_service = get_geo_restriction_service()

@click_handler_bp.route('/click/<offer_id>')
def handle_offer_click(offer_id):
    """
    Handle offer click and redirect to resolved destination URL
    
    Query Parameters:
        - geo: Country code (e.g., 'US', 'CA')
        - subid: Affiliate/publisher ID
        - source: Traffic source identifier
        - campaign: Campaign identifier
    
    Example: /click/ML-00123?geo=US&subid=affiliate_123&source=facebook
    """
    
    try:
        # Get user's IP address
        user_ip = request.remote_addr
        if request.headers.get('X-Forwarded-For'):
            user_ip = request.headers.get('X-Forwarded-For').split(',')[0].strip()
        
        # Get the offer to check geo-restrictions
        offer = offer_model.get_offer_by_id(offer_id)
        if not offer:
            logging.warning(f"❌ Offer {offer_id} not found")
            return render_error_page(offer_id, "Offer not found"), 404
        
        # Check country-based access restrictions
        user_context = {
            'subid': request.args.get('subid', 'direct'),
            'source': request.args.get('source', 'unknown'),
            'campaign': request.args.get('campaign', ''),
            'user_agent': request.headers.get('User-Agent', ''),
            'referrer': request.headers.get('Referer', '')
        }
        
        logging.info(f"🔍 GEO-CHECK START for offer {offer_id}")
        logging.info(f"   User IP: {user_ip}")
        logging.info(f"   Offer allowed_countries: {offer.get('allowed_countries')}")
        logging.info(f"   Offer non_access_url: {offer.get('non_access_url')}")
        
        access_check = geo_restriction_service.check_country_access(
            offer=offer,
            user_ip=user_ip,
            user_context=user_context
        )
        
        logging.info(f"🔍 GEO-CHECK RESULT:")
        logging.info(f"   Allowed: {access_check['allowed']}")
        logging.info(f"   Country: {access_check['country_code']} ({access_check['country_name']})")
        logging.info(f"   Reason: {access_check['reason']}")
        logging.info(f"   Redirect URL: {access_check['redirect_url']}")
        
        # If access is denied, redirect to non-access URL or show error
        if not access_check['allowed']:
            logging.warning(
                f"🚫 GEO-BLOCKED: {offer_id} - Country: {access_check['country_code']} "
                f"({access_check['country_name']}) - Reason: {access_check['reason']}"
            )
            
            # If non-access URL is provided, redirect there
            if access_check['redirect_url']:
                logging.info(f"↪️ Redirecting to non-access URL: {access_check['redirect_url']}")
                return redirect(access_check['redirect_url'], code=302)
            else:
                # Show error page
                error_message = (
                    f"This offer is not available in your country ({access_check['country_name']}). "
                    f"{access_check['reason']}"
                )
                return render_geo_blocked_page(offer_id, access_check), 403
        
        # Country access allowed - proceed with normal resolution
        logging.info(
            f"✅ GEO-CHECK PASSED: {offer_id} - Country: {access_check['country_code']} "
            f"({access_check['country_name']})"
        )
        
        # Resolve destination URL using smart rules
        result = resolve_offer_click(
            offer_id=offer_id,
            request_args=request.args,
            request_headers=request.headers,
            remote_addr=request.remote_addr
        )
        
        if result['success'] and result['destination_url']:
            # Log successful resolution
            logging.info(
                f"✅ Click resolved: {offer_id} -> {result['destination_url']} "
                f"(Rule: {result['rule_applied']}, GEO: {access_check['country_code']})"
            )
            
            # Redirect to resolved URL
            return redirect(result['destination_url'], code=302)
            
        else:
            # Handle resolution failure
            error_message = result.get('error', 'Unknown resolution error')
            logging.warning(f"❌ Click resolution failed for {offer_id}: {error_message}")
            
            # Return error page
            return render_error_page(offer_id, error_message), 404
            
    except Exception as e:
        logging.error(f"❌ Click handler error for {offer_id}: {str(e)}", exc_info=True)
        return render_error_page(offer_id, "Internal server error"), 500

@click_handler_bp.route('/click/<offer_id>/debug')
def debug_offer_click(offer_id):
    """
    Debug endpoint to see resolution logic without redirecting
    Useful for testing and troubleshooting
    """
    
    try:
        # Resolve destination URL
        result = resolve_offer_click(
            offer_id=offer_id,
            request_args=request.args,
            request_headers=request.headers,
            remote_addr=request.remote_addr
        )
        
        # Add debug information
        debug_info = {
            'offer_id': offer_id,
            'user_context': {
                'geo': request.args.get('geo', 'US'),
                'subid': request.args.get('subid', 'direct'),
                'ip': request.remote_addr,
                'user_agent': request.headers.get('User-Agent', ''),
                'referrer': request.headers.get('Referer', ''),
                'timestamp': datetime.utcnow().isoformat()
            },
            'resolution_result': result,
            'query_params': dict(request.args),
            'headers': dict(request.headers)
        }
        
        return jsonify(debug_info), 200
        
    except Exception as e:
        logging.error(f"Debug handler error for {offer_id}: {str(e)}", exc_info=True)
        return jsonify({
            'error': str(e),
            'offer_id': offer_id
        }), 500

@click_handler_bp.route('/click/<offer_id>/preview')
def preview_offer_destinations(offer_id):
    """
    Preview all possible destinations for an offer based on different contexts
    Useful for testing smart rules configuration
    """
    
    try:
        resolver = get_resolver_service()
        
        # Test different GEO contexts
        test_contexts = [
            {'geo': 'US', 'subid': 'test_us'},
            {'geo': 'CA', 'subid': 'test_ca'},
            {'geo': 'UK', 'subid': 'test_uk'},
            {'geo': 'AU', 'subid': 'test_au'},
            {'geo': 'DE', 'subid': 'test_de'}
        ]
        
        preview_results = []
        
        for context in test_contexts:
            # Add common context fields
            full_context = {
                **context,
                'ip': '127.0.0.1',
                'user_agent': 'Preview Bot',
                'referrer': '',
                'timestamp': datetime.utcnow()
            }
            
            # Resolve for this context
            result = resolver.resolve_destination_url(offer_id, full_context)
            
            preview_results.append({
                'context': context,
                'result': {
                    'destination_url': result.get('destination_url'),
                    'rule_applied': result.get('rule_applied'),
                    'rule_type': result.get('rule_type'),
                    'success': result.get('success', False),
                    'error': result.get('error')
                }
            })
        
        return jsonify({
            'offer_id': offer_id,
            'preview_results': preview_results,
            'generated_at': datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        logging.error(f"Preview handler error for {offer_id}: {str(e)}", exc_info=True)
        return jsonify({
            'error': str(e),
            'offer_id': offer_id
        }), 500

@click_handler_bp.route('/click/<offer_id>/stats')
def get_offer_click_stats(offer_id):
    """
    Get click statistics for an offer
    """
    
    try:
        resolver = get_resolver_service()
        
        # Get cache stats
        cache_stats = resolver.get_cache_stats()
        
        # Get offer info
        offer = resolver.get_active_offer(offer_id)
        
        if not offer:
            return jsonify({'error': 'Offer not found'}), 404
        
        # Count smart rules
        smart_rules = offer.get('smartRules', [])
        active_rules = [r for r in smart_rules if r.get('active', True)]
        
        rule_stats = {}
        for rule in active_rules:
            rule_type = rule.get('type', 'Unknown')
            rule_stats[rule_type] = rule_stats.get(rule_type, 0) + 1
        
        return jsonify({
            'offer_id': offer_id,
            'offer_name': offer.get('name', 'Unknown'),
            'offer_status': offer.get('status', 'Unknown'),
            'smart_rules': {
                'total_rules': len(smart_rules),
                'active_rules': len(active_rules),
                'rule_types': rule_stats
            },
            'cache_stats': cache_stats,
            'checked_at': datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        logging.error(f"Stats handler error for {offer_id}: {str(e)}", exc_info=True)
        return jsonify({
            'error': str(e),
            'offer_id': offer_id
        }), 500

def render_geo_blocked_page(offer_id, access_check):
    """Render a user-friendly geo-blocked error page"""
    
    geo_blocked_template = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Offer Not Available in Your Region</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                text-align: center; 
                padding: 50px; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                margin: 0;
            }
            .error-container { 
                background: white; 
                padding: 50px; 
                border-radius: 15px; 
                box-shadow: 0 10px 40px rgba(0,0,0,0.2); 
                max-width: 600px; 
                margin: 0 auto; 
            }
            .error-icon { 
                font-size: 64px; 
                margin-bottom: 20px; 
            }
            .error-title { 
                font-size: 28px; 
                color: #2c3e50; 
                margin-bottom: 15px;
                font-weight: bold;
            }
            .error-message { 
                color: #7f8c8d; 
                margin-bottom: 25px; 
                line-height: 1.6;
                font-size: 16px;
            }
            .country-info {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 10px;
                margin: 20px 0;
            }
            .country-badge {
                display: inline-block;
                background: #e74c3c;
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                font-weight: bold;
                margin: 5px;
            }
            .allowed-badge {
                display: inline-block;
                background: #27ae60;
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                font-weight: bold;
                margin: 5px;
            }
            .offer-id { 
                font-family: monospace; 
                background: #ecf0f1; 
                padding: 8px 15px; 
                border-radius: 5px; 
                font-size: 14px;
                color: #555;
                margin-top: 20px;
            }
            .info-label {
                font-weight: bold;
                color: #34495e;
                margin-top: 15px;
                margin-bottom: 10px;
            }
        </style>
    </head>
    <body>
        <div class="error-container">
            <div class="error-icon">🌍🚫</div>
            <div class="error-title">Not Available in Your Region</div>
            <div class="error-message">
                Sorry, this offer is not available in your country.
            </div>
            
            <div class="country-info">
                <div class="info-label">Your Location:</div>
                <div class="country-badge">{{ country_name }} ({{ country_code }})</div>
                
                <div class="info-label" style="margin-top: 20px;">This offer is only available in:</div>
                <div>
                    {% if allowed_countries %}
                        {% for country in allowed_countries %}
                            <span class="allowed-badge">{{ country }}</span>
                        {% endfor %}
                    {% else %}
                        <span class="allowed-badge">No countries specified</span>
                    {% endif %}
                </div>
            </div>
            
            <div class="offer-id">Offer ID: {{ offer_id }}</div>
        </div>
    </body>
    </html>
    """
    
    # Get allowed countries from offer
    allowed_countries = []
    if access_check.get('reason'):
        # Extract allowed countries from reason string
        import re
        match = re.search(r'allowed list: (.+)$', access_check['reason'])
        if match:
            allowed_countries = [c.strip() for c in match.group(1).split(',')]
    
    return render_template_string(
        geo_blocked_template, 
        offer_id=offer_id,
        country_name=access_check.get('country_name', 'Unknown'),
        country_code=access_check.get('country_code', 'XX'),
        allowed_countries=allowed_countries
    )

def render_error_page(offer_id, error_message):
    """Render a user-friendly error page"""
    
    error_template = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Offer Not Available</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                text-align: center; 
                padding: 50px; 
                background-color: #f5f5f5; 
            }
            .error-container { 
                background: white; 
                padding: 40px; 
                border-radius: 10px; 
                box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
                max-width: 500px; 
                margin: 0 auto; 
            }
            .error-icon { 
                font-size: 48px; 
                color: #e74c3c; 
                margin-bottom: 20px; 
            }
            .error-title { 
                font-size: 24px; 
                color: #2c3e50; 
                margin-bottom: 15px; 
            }
            .error-message { 
                color: #7f8c8d; 
                margin-bottom: 30px; 
                line-height: 1.5; 
            }
            .offer-id { 
                font-family: monospace; 
                background: #ecf0f1; 
                padding: 5px 10px; 
                border-radius: 3px; 
                font-size: 14px; 
            }
        </style>
    </head>
    <body>
        <div class="error-container">
            <div class="error-icon">⚠️</div>
            <div class="error-title">Offer Not Available</div>
            <div class="error-message">
                Sorry, this offer is currently not available.<br>
                <strong>Reason:</strong> {{ error_message }}
            </div>
            <div class="offer-id">Offer ID: {{ offer_id }}</div>
        </div>
    </body>
    </html>
    """
    
    return render_template_string(
        error_template, 
        offer_id=offer_id, 
        error_message=error_message
    )

# Health check for click handler
@click_handler_bp.route('/click/health')
def click_handler_health():
    """Health check for click handler service"""
    
    try:
        resolver = get_resolver_service()
        cache_stats = resolver.get_cache_stats()
        
        return jsonify({
            'status': 'healthy',
            'service': 'offer_click_handler',
            'cache_stats': cache_stats,
            'timestamp': datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'service': 'offer_click_handler',
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }), 500
