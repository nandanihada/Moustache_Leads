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
# Strategy: Show target URL in a full-screen iframe (user sees and interacts with it),
# then after the timer expires, redirect the whole page to the fallback URL.
# NOTE: X-Frame-Options must NOT be set to DENY on the target site for this to work.
# We removed it from vercel.json so moustacheleads.com URLs work in iframes.
# External sites that block iframes (e.g. google.com) will still show "refused to connect".
FALLBACK_REDIRECT_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ offer_name }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { height: 100%; width: 100%; overflow: hidden; }
        iframe {
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            border: none;
        }
    </style>
</head>
<body>
    <iframe src="{{ target_url }}" allowfullscreen></iframe>
    <script>
        setTimeout(function() {
            window.location.href = "{{ fallback_url }}";
        }, {{ timer }} * 1000);
    </script>
</body>
</html>
"""

# Tracking redirect template — records time spent via beacon before navigating away
# Uses a brief delay so event listeners register before navigation
# NOTE: {% autoescape false %} is needed because target_url contains & characters
TRACKING_REDIRECT_TEMPLATE = """{% autoescape false %}<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Redirecting...</title></head>
<body>
<script>
(function(){
  var start = Date.now();
  var cid = "{{ click_id }}";
  var beacon = "{{ beacon_url }}";
  var sent = false;
  function sendClose(){
    if(sent) return;
    sent = true;
    var elapsed = Math.round((Date.now() - start) / 1000);
    var url = beacon + "?click_id=" + encodeURIComponent(cid) + "&time_spent=" + elapsed;
    try { navigator.sendBeacon(url); } catch(e) { new Image().src = url; }
  }
  document.addEventListener("visibilitychange", function(){ if(document.hidden) sendClose(); });
  window.addEventListener("pagehide", sendClose);
  window.addEventListener("beforeunload", sendClose);
  // Send an initial beacon to mark the click was opened (time_spent=0)
  try { navigator.sendBeacon(beacon + "?click_id=" + encodeURIComponent(cid) + "&time_spent=0"); } catch(e){}
  // Small delay to ensure listeners are registered, then redirect
  setTimeout(function(){ window.location.replace("{{ target_url }}"); }, 50);
})();
</script>
<noscript><meta http-equiv="refresh" content="0;url={{ target_url }}"></noscript>
</body></html>{% endautoescape %}"""

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
        
        # Allow tracking for 'active' and 'hidden' status offers
        # Hidden offers should work for tracking but not show in user panel
        offer_status = offer.get('status', '').lower()
        if offer_status not in ['active', 'hidden']:
            logger.error(f"❌ Offer not active or hidden: {offer_id}, status={offer_status}")
            return jsonify({'error': 'Offer not available'}), 404
        
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
            'payout': str(offer.get('payout', 0) or 0),
            'status': offer.get('status', 'active'),
            'currency': offer.get('currency', 'USD') or 'USD',
            'offer_name': offer.get('name', ''),
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
            'offer_name': offer.get('name', 'Unknown Offer'),
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
            'timestamp': datetime.utcnow(),
            'converted': False,
            'country': 'Unknown',
            'device_type': 'unknown',
            'browser': 'unknown'
        }
        
        # Enrich with device detection from user agent
        ua_lower = user_agent.lower()
        if any(m in ua_lower for m in ['mobile', 'android', 'iphone', 'ipad']):
            click_data['device_type'] = 'mobile'
        elif 'tablet' in ua_lower:
            click_data['device_type'] = 'tablet'
        else:
            click_data['device_type'] = 'desktop'
        
        if 'chrome' in ua_lower and 'edg' not in ua_lower:
            click_data['browser'] = 'Chrome'
        elif 'firefox' in ua_lower:
            click_data['browser'] = 'Firefox'
        elif 'safari' in ua_lower and 'chrome' not in ua_lower:
            click_data['browser'] = 'Safari'
        elif 'edg' in ua_lower:
            click_data['browser'] = 'Edge'
        
        # Enrich with geo data from IP
        try:
            from services.ipinfo_service import get_ipinfo_service
            ipinfo_svc = get_ipinfo_service()
            ip_data = ipinfo_svc.lookup_ip(ip_address)
            if ip_data:
                click_data['country'] = ip_data.get('country', 'Unknown')
                click_data['country_code'] = ip_data.get('country_code', '')
                click_data['city'] = ip_data.get('city', '')
                click_data['region'] = ip_data.get('region', '')
        except Exception as geo_err:
            logger.warning(f"⚠️ Geo lookup failed for {ip_address}: {geo_err}")
        
        # Save click directly to database
        clicks_collection = db_instance.get_collection('clicks')
        if clicks_collection is not None:
            try:
                clicks_collection.insert_one(click_data)
                logger.info(f"✅ Click tracked: {click_id} for offer {offer_id} by user {user_id}")
                
                # Update last_click_date on the offer (rolling 30-day inactivity window)
                try:
                    offers_collection.update_one(
                        {'offer_id': offer_id},
                        {'$set': {'last_click_date': datetime.utcnow()}}
                    )
                except Exception as lcd_err:
                    logger.warning(f"⚠️ Failed to update last_click_date for {offer_id}: {lcd_err}")
                
                # Promote offer to "running" in rotation if it's in the active batch
                try:
                    from services.offer_rotation_service import get_rotation_service
                    rotation_svc = get_rotation_service()
                    rot_state = rotation_svc._get_state()
                    if rot_state.get('enabled') and offer_id in rot_state.get('current_batch_ids', []):
                        rotation_svc.promote_to_running(offer_id)
                except Exception as rot_err:
                    logger.warning(f"⚠️ Rotation promotion check failed: {rot_err}")
                    
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
        
        # Use tracking wrapper page to record time spent
        # Use request host for beacon URL so it works in both local dev and production
        beacon_url = request.host_url.rstrip('/') + '/track/beacon'
        return render_template_string(
            TRACKING_REDIRECT_TEMPLATE,
            click_id=click_id,
            target_url=redirect_url,
            beacon_url=beacon_url
        )
            
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


@simple_tracking_bp.route('/track/beacon', methods=['POST', 'GET'])
def click_beacon():
    """
    Beacon endpoint to record when a user closes/leaves the offer page.
    Called via navigator.sendBeacon() or img pixel from the redirect page.
    Records when_closed and time_spent on the click record.
    """
    try:
        click_id = request.args.get('click_id') or (request.get_json(silent=True) or {}).get('click_id')
        time_spent = request.args.get('time_spent') or (request.get_json(silent=True) or {}).get('time_spent')

        if not click_id:
            return jsonify({'error': 'click_id required'}), 400

        clicks_collection = db_instance.get_collection('clicks')
        if clicks_collection is None:
            return jsonify({'error': 'Database not available'}), 503

        update_data = {}
        time_spent_val = 0
        if time_spent:
            try:
                time_spent_val = float(time_spent)
            except (ValueError, TypeError):
                pass

        if time_spent_val > 0:
            # User is leaving/closing — record when_closed and time_spent
            update_data['when_closed'] = datetime.utcnow()
            update_data['time_spent_seconds'] = time_spent_val
        else:
            # Initial beacon — just mark that the redirect page was opened
            update_data['beacon_received'] = True

        result = clicks_collection.update_one(
            {'click_id': click_id},
            {'$set': update_data}
        )

        # Return 1x1 transparent pixel for img-based beacons
        if request.method == 'GET':
            from flask import Response
            pixel = b'\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00\x21\xf9\x04\x00\x00\x00\x00\x00\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b'
            return Response(pixel, mimetype='image/gif')

        return jsonify({'success': True, 'updated': result.modified_count}), 200

    except Exception as e:
        logger.error(f"Beacon error: {str(e)}")
        return jsonify({'error': 'beacon failed'}), 500


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
