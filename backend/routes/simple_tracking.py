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
import threading

simple_tracking_bp = Blueprint('simple_tracking', __name__)
analytics_model = Analytics()
logger = logging.getLogger(__name__)

# In-memory offer cache (offer_id -> {offer_data, expires_at})
# Avoids hitting MongoDB on every single click
_offer_cache = {}
_OFFER_CACHE_TTL = 300  # 5 minutes

def _get_offer_cached(offer_id):
    """Get offer from cache or DB. Caches for 5 minutes."""
    import time
    now = time.time()
    
    cached = _offer_cache.get(offer_id)
    if cached and cached['expires'] > now:
        return cached['data']
    
    offers_collection = db_instance.get_collection('offers')
    if offers_collection is None:
        return None
    
    # Only fetch fields needed for tracking redirect
    offer = offers_collection.find_one(
        {'offer_id': offer_id},
        {'offer_id': 1, 'name': 1, 'status': 1, 'target_url': 1, 'payout': 1, 
         'currency': 1, 'network': 1, 'category': 1, 'vertical': 1,
         'campaign_id': 1, 'fallback_redirect_enabled': 1, 
         'fallback_redirect_url': 1, 'fallback_redirect_timer': 1}
    )
    
    if offer:
        _offer_cache[offer_id] = {'data': offer, 'expires': now + _OFFER_CACHE_TTL}
        # Evict old entries if cache grows too large (>2000 offers)
        if len(_offer_cache) > 2000:
            expired = [k for k, v in _offer_cache.items() if v['expires'] < now]
            for k in expired:
                del _offer_cache[k]
    
    return offer

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
    
    Strategy: Redirect FIRST, process click in background thread.
    This ensures the user gets redirected instantly and the server
    doesn't block workers on slow operations (geo lookup, fraud scoring).
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
        
        logger.debug(f"📊 Tracking click: offer={offer_id}, user={user_id}, sub1={sub1}")
        
        # Get offer from cache (avoids DB hit on every click)
        offer = _get_offer_cached(offer_id)
        
        if not offer:
            logger.error(f"❌ Offer not found: {offer_id}")
            return jsonify({'error': 'Offer not found'}), 404
        
        # Allow tracking for 'active', 'hidden', and 'running' status offers
        offer_status = offer.get('status', '').lower()
        if offer_status not in ['active', 'hidden', 'running']:
            return jsonify({'error': 'Offer not available'}), 404
        
        target_url = offer.get('target_url')
        if target_url:
            target_url = target_url.strip().replace('\n', '').replace('\r', '')
        if not target_url:
            return jsonify({'error': 'Invalid offer configuration'}), 400
        
        # Generate unique click ID
        click_id = generate_click_id()
        
        # Macro context — skip username DB lookup (use user_id directly, resolve in background)
        macro_context = {
            'user_id': user_id or '',
            'sub1': sub1 or '',
            'username': user_id or '',  # Use user_id as username (fast, no DB hit)
            'click_id': click_id,
            'session_id': sub1 or '',
            'placement_id': sub1 or '',
            'publisher_id': user_id or '',
            'country': 'Unknown',
            'device_type': 'unknown',
            'ip_address': ip_address,
            'offer_id': offer_id,
            'cid': offer_id,
            'payout': str(offer.get('payout', 0) or 0),
            'status': offer.get('status', 'active'),
            'currency': offer.get('currency', 'USD') or 'USD',
            'offer_name': offer.get('name', ''),
            'cname': offer.get('name', ''),
        }
        
        # Replace macros in target URL
        if macro_service.has_macros(target_url):
            logger.debug(f"🔄 Replacing macros in URL for offer {offer_id}")
            target_url = macro_service.replace_macros(target_url, macro_context)
            logger.debug(f"✅ Macros replaced. Final URL: {target_url}")
        
        # === REDIRECT FIRST, PROCESS LATER ===
        # Prepare minimal data needed, redirect immediately, then process in background
        redirect_url = target_url
        
        # 🔄 CHECK FOR FALLBACK REDIRECT WITH TIMER
        fallback_enabled = offer.get('fallback_redirect_enabled', False)
        fallback_url = offer.get('fallback_redirect_url', '')
        fallback_timer = offer.get('fallback_redirect_timer', 0)
        
        if fallback_enabled and fallback_url and fallback_timer > 0:
            if not fallback_url.startswith('http://') and not fallback_url.startswith('https://'):
                fallback_url = 'https://' + fallback_url
            try:
                fallback_timer = int(fallback_timer)
            except (ValueError, TypeError):
                fallback_timer = 10

            # Fire background processing
            _process_click_background(click_id, offer_id, offer, user_id, ip_address, user_agent, referer, sub1, sub2, sub3, sub4, sub5)
            
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
        
        # Strip any whitespace/newlines from URL
        redirect_url = redirect_url.strip().replace('\n', '').replace('\r', '')
        
        # 🛡️ SURVEY GATEWAY: Check if this offer has a survey assigned
        try:
            from models.survey import Survey
            survey_model = Survey()
            survey = survey_model.get_survey_for_offer(offer)
            if survey:
                # Survey needs click saved synchronously
                _save_click_sync(click_id, offer_id, offer, user_id, ip_address, user_agent, referer, sub1, sub2, sub3, sub4, sub5)
                clicks_collection = db_instance.get_collection('clicks')
                clicks_collection.update_one(
                    {'click_id': click_id},
                    {'$set': {'target_url': redirect_url, 'survey_id': str(survey.get('_id', ''))}}
                )
                logger.info(f"🛡️ Survey gateway active for offer {offer_id}, redirecting to survey")
                return redirect(f'/survey/{click_id}', code=302)
        except Exception as survey_err:
            logger.warning(f"⚠️ Survey gateway check failed (non-critical): {survey_err}")
        
        # Fire background processing (non-blocking)
        _process_click_background(click_id, offer_id, offer, user_id, ip_address, user_agent, referer, sub1, sub2, sub3, sub4, sub5)
        
        logger.info(f"↗️  Redirecting to: {redirect_url}")
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


def _process_click_background(click_id, offer_id, offer, user_id, ip_address, user_agent, referer, sub1, sub2, sub3, sub4, sub5):
    """Fire click processing in a background thread so the redirect returns instantly."""
    # RATE LIMIT: Skip DB insert if user has too many clicks (>10/minute)
    # Still redirects the user, just doesn't waste DB resources on spam
    from services.fraud_scoring_service import _get_user_count, _record_click
    _record_click(ip_address, user_id, offer_id)
    
    # If user has more than 10 clicks in the last 5 minutes, skip processing entirely
    if user_id and _get_user_count(user_id) > 50:
        return  # Don't even spawn a thread — save CPU + DB
    
    thread = threading.Thread(
        target=_save_click_sync,
        args=(click_id, offer_id, offer, user_id, ip_address, user_agent, referer, sub1, sub2, sub3, sub4, sub5),
        daemon=True
    )
    thread.start()


def _save_click_sync(click_id, offer_id, offer, user_id, ip_address, user_agent, referer, sub1, sub2, sub3, sub4, sub5):
    """Synchronous click processing — fraud scoring (in-memory), DB insert. Runs in background thread."""
    try:
        click_data = {
            'click_id': click_id,
            'offer_id': offer_id,
            'offer_name': offer.get('name', 'Unknown Offer'),
            'user_id': user_id,
            'affiliate_id': user_id,
            'placement_id': sub1,
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
            'browser': 'unknown',
            'campaign_id': offer.get('campaign_id', ''),
            'network': offer.get('network', ''),
            'category': offer.get('category', '') or offer.get('vertical', ''),
            'payout': offer.get('payout', 0),
            'currency': offer.get('currency', 'USD') or 'USD',
            'os': 'unknown',
            'fraud_score': 0,
            'fraud_classification': 'genuine',
            'event_status': 'no_event',
            'postback_received': False,
            'postback_event_type': '',
            'postback_revenue': 0,
        }

        # Device/browser/OS detection (pure CPU, instant)
        ua_lower = (user_agent or '').lower()
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

        if 'windows' in ua_lower:
            click_data['os'] = 'Windows'
        elif 'mac' in ua_lower and 'iphone' not in ua_lower and 'ipad' not in ua_lower:
            click_data['os'] = 'macOS'
        elif 'android' in ua_lower:
            click_data['os'] = 'Android'
        elif 'iphone' in ua_lower or 'ipad' in ua_lower:
            click_data['os'] = 'iOS'
        elif 'linux' in ua_lower:
            click_data['os'] = 'Linux'

        # Fraud scoring (NOW IN-MEMORY — zero DB queries!)
        try:
            from services.fraud_scoring_service import enrich_click_with_fraud_score, auto_block_high_velocity_ip
            enrich_click_with_fraud_score(click_data)
            if 'high_velocity_ip' in click_data.get('fraud_signals', []):
                auto_block_high_velocity_ip(ip_address)
        except Exception:
            pass

        # Geo lookup — only if not already cached (IPinfo service handles caching)
        try:
            from services.ipinfo_service import get_ipinfo_service
            ipinfo_svc = get_ipinfo_service()
            ip_data = ipinfo_svc.lookup_ip(ip_address)
            if ip_data:
                click_data['country'] = ip_data.get('country', 'Unknown')
                click_data['country_code'] = ip_data.get('country_code', '')
                click_data['city'] = ip_data.get('city', '')
                click_data['region'] = ip_data.get('region', '')
        except Exception:
            pass

        # Save to DB (single insert)
        clicks_collection = db_instance.get_collection('clicks')
        if clicks_collection is not None:
            clicks_collection.insert_one(click_data)

        # Update last_click_date (lightweight update)
        try:
            offers_col = db_instance.get_collection('offers')
            if offers_col:
                offers_col.update_one({'offer_id': offer_id}, {'$set': {'last_click_date': datetime.utcnow()}})
        except Exception:
            pass

    except Exception as e:
        logger.error(f"❌ Background click processing failed for {click_id}: {e}")


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
