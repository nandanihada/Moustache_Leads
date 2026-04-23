from flask import Blueprint, jsonify, request, redirect
from user_agents import parse
from database import db_instance
from models.smart_link import SmartLink, ClickLog
from models.geolocation import GeolocationService
from models.user import User
from services.smart_link_service import SmartLinkService
import uuid
import hashlib
from datetime import datetime
from utils.auth import token_required
from bson import ObjectId

smart_link_bp = Blueprint('smart_link', __name__)

def _get_frontend_url(request):
    """Detect frontend URL from request headers or environment"""
    host = request.headers.get('Host', '')
    referer = request.headers.get('Referer', '')
    
    # If we are in local dev, prioritize port 8080
    if 'localhost' in host or '127.0.0.1' in host or 'localhost' in referer:
        return 'http://localhost:8080'
    
    # Production fallback
    return 'https://moustacheleads.com'


def _extract_api_key(request):
    api_key = request.args.get('api_key', '').strip()
    if api_key:
        return api_key
    api_key = request.headers.get('X-API-Key', '').strip()
    if api_key:
        return api_key
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('ApiKey '):
        return auth_header.split(' ', 1)[1].strip()
    return ''


def _validate_api_key(api_key):
    if not api_key:
        return None

    user_model = User()
    user = user_model.find_by_api_key(api_key)
    if not user:
        return None

    if not user.get('is_active', True):
        return None

    if user.get('role') != 'admin' and user.get('account_status', 'pending_approval') != 'approved':
        return None

    return user


def _perform_smart_link_redirect(smart_link, request):
    """
    Shared redirect logic for smart link endpoints
    """
    print(f"[TRACE] Entering _perform_smart_link_redirect")
    if not smart_link:
        print("!!! Redirection Attempted with NULL smart_link node.")
        return redirect(f"{_get_frontend_url(request)}/dashboard?error=link_not_found", code=302)

    country = _detect_country(request)
    print(f"[TRACE] Country detected: {country}")
    device_type = _detect_device_type(request)
    print(f"[TRACE] Device detected: {device_type}")
    
    traffic_source = request.args.get('traffic_source', '').strip()
    print(f"[INFO] SHIELD-REDIRECTION | Slug: {smart_link.get('slug')} | Geo: {country} | Device: {device_type} | Pub: {request.args.get('pub_id')}")

    # Validate API key if one is supplied and fallback to publisher_id from request or smart link
    api_key = _extract_api_key(request)
    api_user = None
    if api_key:
        api_user = _validate_api_key(api_key)
        if not api_user:
            print(f"!!! Invalid API key supplied for slug: {smart_link.get('slug')}")
            return redirect(f"{_get_frontend_url(request)}/dashboard?error=invalid_api_key", code=302)
        print(f"[TRACE] Valid API key owner: {api_user.get('username')} (id={api_user.get('_id')})")

    # Extract publisher_id accurately
    publisher_id = request.args.get('pub_id') or smart_link.get('publisher_id')
    if not publisher_id and api_user:
        publisher_id = str(api_user.get('_id'))
    print(f"[TRACE] Publisher ID: {publisher_id}")
    
    smart_link_service = SmartLinkService()
    print(f"[TRACE] Calling select_offer...")
    selected_offer = smart_link_service.select_offer(
        smart_link=smart_link,
        country=country,
        device_type=device_type,
        traffic_source=traffic_source,
        publisher_id=publisher_id
    )
    print(f"[TRACE] Offer selected: {selected_offer.get('offer_id') if selected_offer else 'NONE'}")

    if not selected_offer:
        frontend = _get_frontend_url(request)
        print(f"!!! No offers eligible for slug: {smart_link.get('slug')} in {country}. Redirecting to safe dashboard at {frontend}.")
        fallback_url = smart_link.get('fallback_url') if isinstance(smart_link, dict) else None
        if fallback_url:
            return redirect(fallback_url, code=302)
        # Final fallback - send to dashboard instead of broken offerwall
        return redirect(f"{frontend}/dashboard?info=no_offers", code=302)

    ip = _get_client_ip(request)
    user_agent = request.headers.get('User-Agent', '')

    # Determine rich status for logging (running, approved, requested, rejected)
    offer_status = selected_offer.get('status', 'active')
    try:
        from datetime import timedelta
        cutoff = datetime.utcnow() - timedelta(days=30)
        
        # 1. Check if "running" (has recent clicks in 30 days)
        # We check multiple potential click collections
        is_running = False
        for col_name in ['clicks', 'offerwall_clicks']:
            col = db_instance.get_collection(col_name)
            if col and col.find_one({'offer_id': selected_offer['offer_id'], 'timestamp': {'$gte': cutoff}}):
                is_running = True
                break
        
        if is_running:
            offer_status = 'running'
            
        # 2. Check for publisher-specific status if pub_id is present
        pub_id = request.args.get('pub_id')
        if pub_id:
            requests_col = db_instance.get_collection('affiliate_requests')
            if requests_col:
                # Check for an affiliate request for this offer and publisher
                req_doc = requests_col.find_one(
                    {'offer_id': selected_offer['offer_id'], 'pub_id': pub_id},
                    sort=[('requested_at', -1)]
                )
                if req_doc:
                    req_status = req_doc.get('status', '').lower()
                    # Map into the statuses the user wants to see
                    if req_status == 'approved':
                        offer_status = 'approved'
                    elif req_status == 'rejected':
                        offer_status = 'rejected'
                    elif req_status in ['requested', 'pending']:
                        offer_status = 'requested'
    except Exception as e:
        print(f"Error determining rich status: {e}")

    publisher_id = smart_link.get('publisher_id') or request.args.get('pub_id')
    
    # Generate a session fingerprint based on IP and User-Agent
    session_raw = f"{ip}-{user_agent}"
    session_id = hashlib.md5(session_raw.encode()).hexdigest()[:16]

    click_id = smart_link_service.log_click(
        smart_link_id=str(smart_link['_id']),
        offer_id=selected_offer['offer_id'],
        country=country,
        ip=ip,
        user_agent=user_agent,
        publisher_id=publisher_id,
        device=device_type,
        offer_status=offer_status,
        offer_name=selected_offer.get('name'),
        session_id=session_id
    )

    target_url = selected_offer.get('target_url', '')
    if not target_url and 'url' in selected_offer:
        target_url = selected_offer['url']

    # Prepare context for macro replacement
    context = {
        'click_id': click_id,
        'publisher_id': publisher_id or request.args.get('pub_id', ''),
        'user_id': publisher_id or request.args.get('pub_id', ''), # Fallback for some networks
        'offer_id': selected_offer['offer_id'],
        'country': country,
        'device_type': device_type,
        'ip_address': ip,
        'offer_name': selected_offer.get('name', ''),
        'payout': str(selected_offer.get('payout', '0')),
        'status': offer_status
    }

    # Use MacroReplacementService to inject values
    from services.macro_replacement_service import macro_service
    target_url = macro_service.replace_macros(target_url, context)

    print(f"=== Redirecting to Offer ID: {selected_offer['offer_id']} | URL: {target_url}")
    response = redirect(target_url, code=307)
    # Aggressive Cache Killing to force rotation on every click
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, max-age=0, post-check=0, pre-check=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    response.headers['Vary'] = '*'
    return response

@smart_link_bp.route('/api/publisher/eligible-offers', methods=['GET'])
@token_required
def get_publisher_eligible_offers():
    """
    Get offers currently available for a publisher's smart link.
    Useful for 'See their offers' requirement.
    """
    try:
        current_user = getattr(request, 'current_user', None)
        if not current_user:
            return jsonify({'error': 'Unauthorized'}), 401
            
        pub_id = str(current_user.get('_id'))
        country = _detect_country(request)
        device_type = _detect_device_type(request)
        
        # Virtual link for global stats
        smart_link = {
            'traffic_type': request.args.get('traffic_type', 'mainstream'),
            'allow_adult': request.args.get('allow_adult', 'false').lower() == 'true',
            'rotation_strategy': 'performance'
        }
        
        smart_link_service = SmartLinkService()
        offers = smart_link_service._get_eligible_offers(
            country=country,
            device_type=device_type,
            smart_link=smart_link,
            publisher_id=pub_id
        )
        
        return jsonify({
            'success': True,
            'offers_count': len(offers),
            'offers': offers[:20], # limit to 20 for preview
            'country': country,
            'device': device_type
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@smart_link_bp.route('/smart-link', methods=['GET'])
def smart_link_generic_redirect():
    """
    Generic smart link redirect endpoint for a single surprise link.
    """
    try:
        smart_link_model = SmartLink()
        slug = request.args.get('slug', '').strip()
        if slug:
            smart_link = smart_link_model.get_smart_link_by_slug(slug)
        else:
            smart_link = smart_link_model.get_default_smart_link()

        return _perform_smart_link_redirect(smart_link, request)

    except Exception as e:
        print(f"Smart link generic redirect error: {str(e)}")
        return redirect(f"{_get_frontend_url(request)}/dashboard?error=redirect_fail", code=302)

@smart_link_bp.route('/smart-link/<slug>', methods=['GET'])
@smart_link_bp.route('/smart/<slug>', methods=['GET'])
def smart_link_redirect(slug: str):
    """
    Smart link redirect endpoint - automatically redirects to best offer
    """
    try:
        print(f"[TRACE] Starting redirect for slug: {slug}")
        smart_link_model = SmartLink()
        smart_link = smart_link_model.get_smart_link_by_slug(slug)
        print(f"[TRACE] Smart link found: {smart_link is not None}")
        
        # Also try by ID if slug not found
        if not smart_link:
            try:
                from bson import ObjectId
                link_by_id = db_instance.get_collection('smart_links').find_one({'_id': ObjectId(slug)})
                if link_by_id:
                    smart_link = link_by_id
                    print("[TRACE] Smart link found by ID")
            except:
                pass

        # Virtual Global Smart Link feature for Publishers
        if not smart_link and (slug == 'global' or slug == 'master'):
            pub_id = request.args.get('pub_id', 'anonymous')
            print(f"!!! Initializing Private Master Node for Publisher: {pub_id}")
            smart_link = {
                '_id': f'global_master_{pub_id}', # Unique ID per publisher for independent rotation
                'name': f'Master Node | {pub_id}',
                'slug': slug,
                'status': 'active',
                'traffic_type': 'mainstream',
                'allow_adult': False,
                'rotation_strategy': 'round_robin' # Force variety for users testing in tabs
            }
            
        print(f"[TRACE] Proceeding to _perform_smart_link_redirect")
        return _perform_smart_link_redirect(smart_link, request)

    except Exception as e:
        import traceback
        import urllib.parse
        error_trace = traceback.format_exc()
        error_msg = f"[CRITICAL ERROR] Smart link redirect failed: {str(e)}\n{error_trace}"
        print(error_msg)
        
        # Log to file for AI investigation
        try:
            with open('redirect_error.log', 'w') as f:
                f.write(error_msg)
        except Exception as log_err:
            print(f"Failed to write to local log: {log_err}")
            
        error_short = urllib.parse.quote(str(e))
        return redirect(f"{_get_frontend_url(request)}/dashboard?error=redirect_fail&msg={error_short}", code=302)

@smart_link_bp.route('/api/admin/smart-links', methods=['GET'])
def get_smart_links():
    """
    Get all smart links for admin dashboard
    """
    try:
        smart_link_model = SmartLink()
        smart_links = smart_link_model.get_all_smart_links()
        
        # Enrich links with publisher info and stats
        users_col = db_instance.get_collection('users')
        clicks_col = db_instance.get_collection('smart_link_clicks')
        
        for link in smart_links:
            link['_id'] = str(link['_id'])
            # Fetch publisher name
            if link.get('publisher_id'):
                try:
                    pub = users_col.find_one({'_id': ObjectId(link['publisher_id'])})
                    if pub:
                        link['publisher_name'] = pub.get('username') or pub.get('partner_name')
                except:
                    pass
            
            # Basic stats
            link['total_clicks'] = clicks_col.count_documents({'smart_link_id': link['_id']})

        return jsonify({
            'success': True,
            'smart_links': smart_links
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@smart_link_bp.route('/smart-link/log-click', methods=['POST'])
@token_required
def log_smart_link_click():
    """
    Log a click on a smart link
    """
    try:
        data = request.get_json()
        if not data or not data.get('slug'):
            return jsonify({'error': 'Slug is required'}), 400

        # ... rest of log click logic ...
        return jsonify({'success': True}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@smart_link_bp.route('/api/admin/smart-links/<smart_link_id>', methods=['PUT'])
def update_smart_link(smart_link_id: str):
    """
    Update a smart link
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        smart_link_model = SmartLink()
        success, error = smart_link_model.update_smart_link(smart_link_id, data)

        if not success:
            return jsonify({'error': error}), 400

        return jsonify({'success': True})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@smart_link_bp.route('/api/admin/smart-links/activity-logs', methods=['GET'])
@token_required
def get_admin_smart_link_activity():
    """Get all publisher activity logs for smart links"""
    try:
        limit = int(request.args.get('limit', 100))
        activity_col = db_instance.get_collection('admin_activity_logs')
        
        logs = list(activity_col.find(
            {'resource_type': 'smart_link'}
        ).sort('timestamp', -1).limit(limit))
        
        for log in logs:
            log['_id'] = str(log['_id'])
            if 'timestamp' in log and isinstance(log['timestamp'], datetime):
                log['timestamp'] = log['timestamp'].isoformat()
        
        return jsonify({
            'success': True,
            'logs': logs
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@smart_link_bp.route('/api/publisher/smart-links', methods=['GET'])
@token_required
def get_publisher_smart_links():
    """
    Get smart links for the current publisher
    """
    try:
        current_user = getattr(request, 'current_user', None)
        if not current_user:
            return jsonify({'error': 'Unauthorized'}), 401
            
        publisher_id = str(current_user.get('_id'))
        smart_link_model = SmartLink()
        smart_links = smart_link_model.get_smart_links_by_publisher(publisher_id)
        
        # Add basic stats for each link
        clicks_col = db_instance.get_collection('smart_link_clicks')
        rev_col = db_instance.get_collection('forwarded_postbacks')
        
        for link in smart_links:
            link['_id'] = str(link['_id'])
            link_id_str = link['_id']
            link['total_clicks'] = clicks_col.count_documents({'smart_link_id': link_id_str})
            
            # Revenue calculation from postbacks
            conversions = list(rev_col.find({'smart_link_id': link_id_str}))
            link['revenue'] = sum(float(c.get('revenue', 0)) for c in conversions)

        return jsonify({
            'success': True,
            'smart_links': smart_links
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@smart_link_bp.route('/api/publisher/smart-links/<smart_link_id>', methods=['DELETE'])
@token_required
def delete_publisher_smart_link(smart_link_id: str):
    """
    Delete a smart link belonging to the current publisher.
    Also logs activity for admin tracking.
    """
    try:
        current_user = getattr(request, 'current_user', None)
        if not current_user:
            return jsonify({'error': 'Unauthorized'}), 401
            
        publisher_id = str(current_user.get('_id'))
        smart_link_model = SmartLink()
        
        # Verify ownership
        existing = db_instance.get_collection('smart_links').find_one({'_id': ObjectId(smart_link_id)})
        if not existing or str(existing.get('publisher_id')) != publisher_id:
            return jsonify({'error': 'Link not found or unauthorized'}), 404

        success, error = smart_link_model.delete_smart_link(smart_link_id)
        if success:
            # Log Activity for Admin
            _log_admin_activity(
                user_id=publisher_id,
                action='smart_link_deleted',
                details={'smart_link_id': smart_link_id, 'name': existing.get('name'), 'slug': existing.get('slug')},
                resource_type='smart_link'
            )
            return jsonify({'success': True})
        return jsonify({'error': error}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def _log_admin_activity(user_id, action, details, resource_type):
    """Internal helper to log activity for admin visibility"""
    try:
        activity_col = db_instance.get_collection('admin_activity_logs')
        activity_col.insert_one({
            'user_id': user_id,
            'action': action,
            'resource_type': resource_type,
            'details': details,
            'timestamp': datetime.utcnow()
        })
    except:
        pass

@smart_link_bp.route('/api/publisher/smart-links', methods=['POST'])
@token_required
def create_publisher_smart_link():
    """Create a new smart link for a publisher and log activity"""
    try:
        current_user = getattr(request, 'current_user', None)
        data = request.get_json()
        publisher_id = str(current_user.get('_id'))
        
        smart_link_model = SmartLink()
        result, error = smart_link_model.create_smart_link(
            name=data.get('name'),
            slug=data.get('slug'),
            publisher_id=publisher_id,
            traffic_type=data.get('traffic_type'),
            allow_adult=data.get('allow_adult'),
            rotation_strategy=data.get('rotation_strategy', 'performance'),
            status='active'
        )
        
        if result:
            _log_admin_activity(
                user_id=publisher_id,
                action='smart_link_created',
                details={'smart_link_id': str(result['_id']), 'name': result['name'], 'slug': result['slug']},
                resource_type='smart_link'
            )
            return jsonify({'success': True, 'smart_link': result}), 201
        return jsonify({'error': error}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@smart_link_bp.route('/api/admin/smart-links/<smart_link_id>', methods=['DELETE'])
def delete_smart_link(smart_link_id: str):
    """
    Delete a smart link
    """
    try:
        smart_link_model = SmartLink()
        success, error = smart_link_model.delete_smart_link(smart_link_id)

        if not success:
            return jsonify({'error': error}), 400

        return jsonify({'success': True})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@smart_link_bp.route('/api/admin/smart-links/<smart_link_id>/analytics', methods=['GET'])
def get_smart_link_analytics(smart_link_id: str):
    """
    Get analytics for a specific smart link
    """
    try:
        # Parse query parameters
        start_date = None
        end_date = None
        country = request.args.get('country')

        if request.args.get('start_date'):
            start_date = datetime.fromisoformat(request.args.get('start_date').replace('Z', '+00:00'))
        if request.args.get('end_date'):
            end_date = datetime.fromisoformat(request.args.get('end_date').replace('Z', '+00:00'))

        smart_link_service = SmartLinkService()
        analytics = smart_link_service.get_analytics(
            smart_link_id=smart_link_id,
            start_date=start_date,
            end_date=end_date,
            country=country
        )

        return jsonify({
            'success': True,
            'analytics': analytics
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@smart_link_bp.route('/api/admin/smart-links/logs', methods=['GET'])
def get_smart_link_logs():
    """
    Get raw click logs for admin table
    """
    try:
        filters = {}
        if request.args.get('smart_link_id'): filters['smart_link_id'] = request.args.get('smart_link_id')
        if request.args.get('country'): filters['country'] = request.args.get('country').upper()
        if request.args.get('status'): filters['status'] = request.args.get('status')
        limit = int(request.args.get('limit', 200))

        click_log = ClickLog()
        logs = click_log.get_raw_logs(limit=limit, **filters)

        return jsonify({
            'success': True,
            'logs': logs
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Helper to fetch real public IP for local testing (cached)
_global_public_ip_cache = None

def _get_public_ip_safe():
    global _global_public_ip_cache
    if _global_public_ip_cache:
        return _global_public_ip_cache
    try:
        import requests as requests_lib
        # Fetch actual public IP so we don't use "dummy" data even locally
        resp = requests_lib.get('https://api.ipify.org', timeout=1.5)
        if resp.status_code == 200:
            _global_public_ip_cache = resp.text.strip()
            return _global_public_ip_cache
    except:
        pass
    return None

def _detect_country(request) -> str:
    """
    Detect user's country from request
    """
    try:
        # Allow explicit country override for local testing or proxy headers
        explicit_country = request.args.get('country', '').strip().upper()
        if explicit_country and len(explicit_country) == 2:
            return explicit_country

        header_country = request.headers.get('X-Country-Code') or request.headers.get('X-Geo-Country')
        if header_country and isinstance(header_country, str) and len(header_country.strip()) == 2:
            return header_country.strip().upper()

        # Try Cloudflare header next
        cf_country = request.headers.get('CF-IPCountry')
        if cf_country and isinstance(cf_country, str) and len(cf_country.strip()) == 2:
            return cf_country.strip().upper()

        # Try other headers / IP-based lookup
        client_ip = _get_client_ip(request)

        if client_ip:
            lookup_ip = client_ip
            if client_ip in ['127.0.0.1', '::1', 'localhost', '']:
                # For local development, fetch the machine's real public IP to get accurate GEO
                public_ip = _get_public_ip_safe()
                if public_ip:
                    lookup_ip = public_ip
                
            geo_info = GeolocationService().get_ip_info(lookup_ip)
            code = geo_info.get('country_code') if isinstance(geo_info, dict) else None
            if code and isinstance(code, str) and len(code.strip()) == 2:
                return code.strip().upper()

        return ''

    except Exception:
        return ''

def _detect_device_type(request) -> str:
    """
    Detect device type from user agent
    """
    try:
        user_agent = request.headers.get('User-Agent', '')
        if user_agent:
            ua = parse(user_agent)
            if ua.is_mobile:
                return 'mobile'
            elif ua.is_tablet:
                return 'tablet'
            elif ua.is_pc:
                return 'desktop'
        return 'desktop'  # Default
    except Exception:
        return 'desktop'

def _get_client_ip(request) -> str:
    """
    Get client IP address. 
    If local, tries to fetch public IP to avoid "dummy" data.
    """
    try:
        x_real_ip = request.headers.get('X-Real-IP')
        forwarded_for = request.headers.get('X-Forwarded-For', '')
        ip = ''

        if x_real_ip and isinstance(x_real_ip, str):
            ip = x_real_ip.split(',')[0].strip()
        elif forwarded_for:
            ip = forwarded_for.split(',')[0].strip()
        else:
            ip = request.remote_addr or ''
            
        # If still local, attempt to get real public IP
        if ip in ['127.0.0.1', '::1', 'localhost', '']:
            public_ip = _get_public_ip_safe()
            if public_ip:
                return public_ip
        
        return ip
    except Exception:
        return ''

@smart_link_bp.route('/api/admin/smart-links/exclusions', methods=['GET'])
@token_required
def get_smart_link_exclusions():
    """Fetch excluded offers (both global and per-publisher)"""
    try:
        current_user = getattr(request, 'current_user', None)
        if not current_user or current_user.get('role') != 'admin':
            return jsonify({'error': 'Unauthorized'}), 401

        # Global Exclusions
        global_offers = list(db_instance.get_collection('offers').find(
            {'exclude_from_smart_link': True},
            {'_id': 0, 'offer_id': 1}
        ))
        global_excluded = [o['offer_id'] for o in global_offers if 'offer_id' in o]

        # Publisher Exclusions
        publisher_exclusions = {}
        users = db_instance.get_collection('users').find(
            {'excluded_smart_link_offers': {'$exists': True, '$ne': []}},
            {'username': 1, 'partner_name': 1, 'excluded_smart_link_offers': 1}
        )
        for u in users:
            uid = str(u['_id'])
            name = u.get('username') or u.get('partner_name') or uid
            publisher_exclusions[uid] = {
                'name': name,
                'excluded_offers': u.get('excluded_smart_link_offers', [])
            }

        return jsonify({
            'success': True,
            'global_excluded': global_excluded,
            'publisher_exclusions': publisher_exclusions
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@smart_link_bp.route('/api/admin/smart-links/exclusions', methods=['POST'])
@token_required
def update_smart_link_exclusions():
    """Update excluded offers for global or a specific publisher"""
    try:
        current_user = getattr(request, 'current_user', None)
        if not current_user or current_user.get('role') != 'admin':
            return jsonify({'error': 'Unauthorized'}), 401

        data = request.get_json()
        target = data.get('target') # 'global' or 'publisher'
        publisher_id = data.get('publisher_id')
        offer_id = data.get('offer_id')
        action = data.get('action') # 'add' or 'remove'

        if not target or not offer_id or not action:
            return jsonify({'error': 'Missing parameters'}), 400

        if target == 'global':
            db_instance.get_collection('offers').update_many(
                {'offer_id': offer_id},
                {'$set': {'exclude_from_smart_link': (action == 'add')}}
            )
        elif target == 'publisher' and publisher_id:
            from bson import ObjectId
            if action == 'add':
                db_instance.get_collection('users').update_one(
                    {'_id': ObjectId(publisher_id)},
                    {'$addToSet': {'excluded_smart_link_offers': offer_id}}
                )
            else:
                db_instance.get_collection('users').update_one(
                    {'_id': ObjectId(publisher_id)},
                    {'$pull': {'excluded_smart_link_offers': offer_id}}
                )
        else:
            return jsonify({'error': 'Invalid target or missing publisher_id'}), 400

        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500