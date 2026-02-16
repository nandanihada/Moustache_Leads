#!/usr/bin/env python3
"""
Simple tracking endpoint for publisher links
Format: /track/{offer_id}?user_id={publisher_id}&sub1=...
"""

from flask import Blueprint, request, redirect, jsonify, render_template_string
from models.analytics import Analytics
from database import db_instance
from services.macro_replacement_service import macro_service
import logging
from datetime import datetime
import secrets

simple_tracking_bp = Blueprint('simple_tracking', __name__)
analytics_model = Analytics()
logger = logging.getLogger(__name__)

def generate_click_id():
    """Generate unique click ID"""
    return f"CLK-{secrets.token_hex(6).upper()}"

# HTML template for fallback redirect with timer
# Strategy: Redirect to target URL immediately, user sees target site
# The fallback redirect happens BEFORE going to target - we can't control after
# So we redirect: Our Page -> Target URL (user stays there for timer) -> then we can't redirect them
# 
# NEW APPROACH: Since we can't control external sites, we do:
# 1. Show target URL in iframe (if it works)
# 2. If iframe blocked, just redirect to target URL directly (no fallback possible)
# 3. If iframe works, redirect to fallback after timer
FALLBACK_REDIRECT_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ offer_name }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { height: 100%; width: 100%; overflow: hidden; background: #fff; }
        #targetFrame {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            width: 100%; height: 100%;
            border: none;
        }
    </style>
</head>
<body>
    <iframe id="targetFrame" src="{{ target_url }}"></iframe>
    <script>
        (function() {
            var timer = {{ timer }};
            var fallbackUrl = "{{ fallback_url }}";
            var targetUrl = "{{ target_url }}";
            
            // Start redirect timer immediately
            // After timer expires, redirect to fallback URL
            setTimeout(function() {
                window.location.href = fallbackUrl;
            }, timer * 1000);
        })();
    </script>
</body>
</html>
"""

@simple_tracking_bp.route('/track/<offer_id>', methods=['GET'])
def track_offer_click(offer_id):
    """
    Simple tracking endpoint for publishers
    URL format: /track/{offer_id}?user_id={publisher_id}&sub1=val1&sub2=val2...
    
    1. Records click in database
    2. Redirects user to offer target URL
    """
    try:
        # Get parameters
        user_id = request.args.get('user_id')  # Publisher/affiliate ID
        sub1 = request.args.get('sub1', '')
        sub2 = request.args.get('sub2', '')
        sub3 = request.args.get('sub3', '')
        sub4 = request.args.get('sub4', '')
        sub5 = request.args.get('sub5', '')
        
        # Get user info
        ip_address = request.headers.get('X-Forwarded-For', request.remote_addr)
        user_agent = request.headers.get('User-Agent', '')
        referer = request.headers.get('Referer', '')
        
        logger.info(f"📊 Tracking click: offer={offer_id}, user={user_id}, sub1={sub1}")
        
        # Get offer details
        offers_collection = db_instance.get_collection('offers')
        offer = offers_collection.find_one({'offer_id': offer_id})
        
        if not offer:
            logger.error(f"❌ Offer not found: {offer_id}")
            return jsonify({'error': 'Offer not found'}), 404
        
        if offer.get('status', '').lower() != 'active':
            logger.error(f"❌ Offer not active: {offer_id}, status={offer.get('status')}")
            return jsonify({'error': 'Offer not active'}), 404
        
        target_url = offer.get('target_url')
        if not target_url:
            logger.error(f"❌ No target URL for offer: {offer_id}")
            return jsonify({'error': 'Invalid offer configuration'}), 400
        
        # Generate unique click ID
        click_id = generate_click_id()
        
        # 🔄 MACRO REPLACEMENT: Replace {user_id}, {click_id}, etc. in target URL
        macro_context = {
            'user_id': user_id or '',
            'username': user_id or '',  # Use user_id as username fallback
            'click_id': click_id,
            'session_id': sub1 or '',  # Use sub1 as session_id
            'placement_id': sub1 or '',  # Use sub1 as placement_id
            'publisher_id': user_id or '',
            'country': 'Unknown',  # Will be enhanced with geo-detection
            'device_type': 'unknown',
            'ip_address': ip_address,
            'offer_id': offer_id,
        }
        
        # Replace macros in target URL
        if macro_service.has_macros(target_url):
            logger.info(f"🔄 Replacing macros in URL for offer {offer_id}")
            target_url = macro_service.replace_macros(target_url, macro_context)
            logger.info(f"✅ Macros replaced. Final URL: {target_url}")
        
        # Prepare click data for database
        click_data = {
            'click_id': click_id,
            'offer_id': offer_id,
            'user_id': user_id,  # Publisher who shared the link
            'affiliate_id': user_id,  # Same as user_id for consistency
            'placement_id': sub1,  # Placement/offerwall ID (usually in sub1)
            'ip_address': ip_address,
            'user_agent': user_agent,
            'referer': referer,
            'sub_id1': sub1,
            'sub_id2': sub2,
            'sub_id3': sub3,
            'sub_id4': sub4,
            'sub_id5': sub5,
            'click_time': datetime.utcnow(),
            'timestamp': datetime.utcnow(),  # Add timestamp for sorting
            'converted': False,
            'country': 'Unknown',  # Will be enhanced later
            'device_type': 'unknown',  # Will be enhanced later
            'browser': 'unknown'  # Will be enhanced later
        }
        
        # Save click directly to database
        clicks_collection = db_instance.get_collection('clicks')
        if clicks_collection is not None:
            try:
                clicks_collection.insert_one(click_data)
                logger.info(f"✅ Click tracked: {click_id} for offer {offer_id} by user {user_id}")
            except Exception as db_error:
                logger.error(f"❌ Failed to save click to database: {db_error}")
        else:
            logger.error("❌ Could not access clicks collection")
        
        # NOTE: We already replaced macros above, so target_url is ready to use
        # No need to append click_id since it's already in the URL if partner needs it
        redirect_url = target_url
        
        # 🔄 CHECK FOR FALLBACK REDIRECT WITH TIMER
        fallback_enabled = offer.get('fallback_redirect_enabled', False)
        fallback_url = offer.get('fallback_redirect_url', '')
        fallback_timer = offer.get('fallback_redirect_timer', 0)
        
        if fallback_enabled and fallback_url and fallback_timer > 0:
            # Ensure fallback URL has protocol
            if not fallback_url.startswith('http://') and not fallback_url.startswith('https://'):
                fallback_url = 'https://' + fallback_url
            
            # Ensure timer is an integer
            try:
                fallback_timer = int(fallback_timer)
            except (ValueError, TypeError):
                fallback_timer = 10  # Default to 10 seconds
            
            logger.info(f"⏱️ Fallback redirect enabled:")
            logger.info(f"   - Timer: {fallback_timer} seconds (type: {type(fallback_timer).__name__})")
            logger.info(f"   - Fallback URL: {fallback_url}")
            logger.info(f"   - Target URL: {redirect_url}")
            
            # Show intermediate page with timer
            return render_template_string(
                FALLBACK_REDIRECT_TEMPLATE,
                offer_name=offer.get('name', 'Special Offer'),
                offer_image=offer.get('image_url', ''),
                description=offer.get('description', ''),
                payout=offer.get('payout', 0),
                target_url=redirect_url,
                fallback_url=fallback_url,
                timer=fallback_timer
            )
        
        logger.info(f"↗️  Redirecting to: {redirect_url}")
        
        # Redirect to offer
        return redirect(redirect_url, code=302)
            
    except Exception as e:
        logger.error(f"❌ Error in track_offer_click: {str(e)}", exc_info=True)
        
        # Try to redirect to offer anyway
        try:
            offers_collection = db_instance.get_collection('offers')
            offer = offers_collection.find_one({'offer_id': offer_id})
            if offer and offer.get('target_url'):
                return redirect(offer['target_url'], code=302)
        except:
            pass
        
        return jsonify({'error': 'Tracking error'}), 500


@simple_tracking_bp.route('/track/<offer_id>/test', methods=['GET'])
def test_tracking_link(offer_id):
    """
    Test endpoint - shows what would happen without redirect
    """
    try:
        user_id = request.args.get('user_id')
        sub1 = request.args.get('sub1', '')
        
        offers_collection = db_instance.get_collection('offers')
        offer = offers_collection.find_one({'offer_id': offer_id})
        
        if not offer:
            return jsonify({'error': 'Offer not found'}), 404
        
        # Include fallback redirect info in test response
        fallback_info = {
            'fallback_redirect_enabled': offer.get('fallback_redirect_enabled', False),
            'fallback_redirect_url': offer.get('fallback_redirect_url', ''),
            'fallback_redirect_timer': offer.get('fallback_redirect_timer', 0),
            'fallback_redirect_timer_type': type(offer.get('fallback_redirect_timer', 0)).__name__
        }
        
        return jsonify({
            'success': True,
            'offer_id': offer_id,
            'offer_name': offer.get('name'),
            'target_url': offer.get('target_url'),
            'user_id': user_id,
            'sub1': sub1,
            'fallback_redirect': fallback_info,
            'message': 'Tracking link is valid! Remove /test to use real link.'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@simple_tracking_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'simple_tracking',
        'endpoints': [
            'GET /track/<offer_id>',
            'GET /track/<offer_id>/test'
        ]
    }), 200
