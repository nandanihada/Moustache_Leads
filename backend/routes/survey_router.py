"""
Survey Router - Routes users to external surveys (Pepperwahl or partners)
and handles postbacks + return URLs.

Two scenarios:
1. Same-tab (Pepperwahl): Redirect user, receive postback, user returns via URL
2. New-tab (External): Open in new tab, frontend polls for postback status

Collections used:
- survey_router_sessions: Tracks the full user journey
- survey_router_postbacks: Logs all incoming postbacks (dedup)
- survey_router_providers: Admin-configured survey providers
"""

from flask import Blueprint, request, jsonify, redirect, render_template_string
from database import db_instance
from datetime import datetime
from bson import ObjectId
import logging
import secrets
import urllib.parse
import threading

logger = logging.getLogger(__name__)

survey_router_bp = Blueprint('survey_router', __name__)


def get_collection(name):
    return db_instance.get_collection(name)


def generate_session_id():
    return f"SES-{secrets.token_hex(6).upper()}"


def generate_attempt_id():
    return f"SAT-{secrets.token_hex(6).upper()}"


# ============================================================
# ADMIN: Survey Provider CRUD
# ============================================================

@survey_router_bp.route('/api/admin/survey-router/providers', methods=['GET'])
def get_providers():
    """List all configured survey providers."""
    from utils.auth import token_required
    # Manual auth check
    auth_header = request.headers.get('Authorization', '')
    if not auth_header:
        return jsonify({'error': 'Auth required'}), 401

    col = get_collection('survey_router_providers')
    if col is None:
        return jsonify({'providers': []}), 200

    providers = list(col.find().sort('created_at', -1))
    for p in providers:
        p['_id'] = str(p['_id'])
        if isinstance(p.get('created_at'), datetime):
            p['created_at'] = p['created_at'].isoformat() + 'Z'
        if isinstance(p.get('updated_at'), datetime):
            p['updated_at'] = p['updated_at'].isoformat() + 'Z'

    return jsonify({'providers': providers}), 200


@survey_router_bp.route('/api/admin/survey-router/providers', methods=['POST'])
def create_provider():
    """Create a new survey provider configuration."""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header:
        return jsonify({'error': 'Auth required'}), 401

    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'error': 'Provider name required'}), 400

    col = get_collection('survey_router_providers')
    if col is None:
        return jsonify({'error': 'Database unavailable'}), 503

    provider_id = f"PROV-{secrets.token_hex(4).upper()}"

    doc = {
        'provider_id': provider_id,
        'name': data['name'].strip(),
        'base_url': data.get('base_url', '').strip(),
        'scenario': data.get('scenario', 'new_tab'),  # same_tab or new_tab
        'is_own_website': data.get('is_own_website', False),
        'postback_param_mapping': data.get('postback_param_mapping', {
            'session_id': 'session_id',
            'attempt_id': 'attempt_id',
            'status': 'status',
            'payout': 'payout',
            'transaction_id': 'transaction_id'
        }),
        'redirect_url_template': data.get('redirect_url_template', ''),
        'surveys': data.get('surveys', []),
        'status': 'active',
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
    }

    col.insert_one(doc)
    logger.info(f"Created survey provider: {provider_id} ({data['name']})")
    return jsonify({'success': True, 'provider_id': provider_id}), 201


@survey_router_bp.route('/api/admin/survey-router/providers/<provider_id>', methods=['PUT'])
def update_provider(provider_id):
    """Update a survey provider."""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header:
        return jsonify({'error': 'Auth required'}), 401

    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data'}), 400

    col = get_collection('survey_router_providers')
    if col is None:
        return jsonify({'error': 'Database unavailable'}), 503

    allowed = ['name', 'base_url', 'scenario', 'is_own_website',
               'postback_param_mapping', 'redirect_url_template', 'surveys', 'status']
    update = {'updated_at': datetime.utcnow()}
    for k in allowed:
        if k in data:
            update[k] = data[k]

    result = col.update_one({'provider_id': provider_id}, {'$set': update})
    if result.matched_count == 0:
        return jsonify({'error': 'Provider not found'}), 404

    return jsonify({'success': True}), 200


@survey_router_bp.route('/api/admin/survey-router/providers/<provider_id>', methods=['DELETE'])
def delete_provider(provider_id):
    """Delete a survey provider."""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header:
        return jsonify({'error': 'Auth required'}), 401

    col = get_collection('survey_router_providers')
    if col is None:
        return jsonify({'error': 'Database unavailable'}), 503

    col.delete_one({'provider_id': provider_id})
    return jsonify({'success': True}), 200


# ============================================================
# PUBLIC: Start a survey router session
# ============================================================

@survey_router_bp.route('/api/survey-router/start', methods=['POST'])
def start_router_session():
    """
    Called after user passes qualification questions.
    Creates a session and returns the first survey to route to.

    Body: {
        user_id, funnel_id, qualification_answers,
        provider_id (optional - if not provided, picks first available)
    }
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data'}), 400

    sessions_col = get_collection('survey_router_sessions')
    if sessions_col is None:
        return jsonify({'error': 'Service unavailable'}), 503

    user_id = data.get('user_id', 'anonymous')
    funnel_id = data.get('funnel_id', '')
    qualification_answers = data.get('qualification_answers', [])
    partner_id = data.get('partner_id', '')
    redirect_url = data.get('redirect_url', '')
    scenario = data.get('scenario', 'new_tab')
    next_redirect_url = data.get('next_redirect_url', '')

    # Find partner to get their unique_postback_key
    partners_col = get_collection('partners')
    partner = None
    partner_name = 'Unknown'
    partner_unique_key = ''
    
    if partner_id and partners_col is not None:
        partner = partners_col.find_one({'partner_id': partner_id})
        if partner:
            partner_name = partner.get('partner_name', 'Unknown')
            partner_unique_key = partner.get('unique_postback_key', '')
    session_id = generate_session_id()
    attempt_id = generate_attempt_id()

    # Build the postback URL that Pepperwahl should call
    backend_url = request.host_url.rstrip('/')
    postback_url = f"{backend_url}/postback/{partner_unique_key}?session_id={session_id}&status=completed"

    # Build return URLs (for same-tab scenario — Pepperwahl redirects user back here)
    frontend_url = request.headers.get('Origin', 'https://moustacheleads.com')
    base_return = f"{frontend_url}/survey-router/return"
    success_url = f"{base_return}?session_id={session_id}&attempt_id={attempt_id}&status=completed&funnel_id={funnel_id}"
    fail_url = f"{base_return}?session_id={session_id}&attempt_id={attempt_id}&status=failed&funnel_id={funnel_id}"
    if next_redirect_url:
        fail_url += f"&next_survey_url={urllib.parse.quote(next_redirect_url, safe='')}"
    quota_url = f"{base_return}?session_id={session_id}&attempt_id={attempt_id}&status=quota_full&funnel_id={funnel_id}"
    if next_redirect_url:
        quota_url += f"&next_survey_url={urllib.parse.quote(next_redirect_url, safe='')}"

    # Append router params to the redirect URL so Pepperwahl knows about the session
    if redirect_url:
        separator = '&' if '?' in redirect_url else '?'
        redirect_url_with_params = (
            f"{redirect_url}{separator}"
            f"session_id={session_id}"
            f"&postback_url={urllib.parse.quote(postback_url, safe='')}"
            f"&success_url={urllib.parse.quote(success_url, safe='')}"
            f"&fail_url={urllib.parse.quote(fail_url, safe='')}"
            f"&quota_url={urllib.parse.quote(quota_url, safe='')}"
        )
    else:
        redirect_url_with_params = redirect_url

    # Create attempt record
    attempt = {
        'attempt_id': attempt_id,
        'partner_id': partner_id,
        'partner_name': partner_name,
        'partner_unique_key': partner_unique_key,
        'redirect_url': redirect_url,
        'status': 'pending',
        'payout': 0,
        'transaction_id': '',
        'redirected_at': datetime.utcnow(),
        'postback_received_at': None,
        'completed_at': None,
    }

    # Create session
    session_doc = {
        'session_id': session_id,
        'user_id': user_id,
        'funnel_id': funnel_id,
        'ip_address': request.headers.get('X-Forwarded-For', request.remote_addr),
        'user_agent': request.headers.get('User-Agent', ''),
        'qualification_answers': qualification_answers,
        'current_attempt': attempt,
        'attempts': [attempt],
        'scenario': scenario,
        'status': 'in_progress',
        'total_payout': 0,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
    }

    sessions_col.insert_one(session_doc)
    logger.info(f"Survey router session started: {session_id} -> partner {partner_name} ({scenario})")

    return jsonify({
        'success': True,
        'session_id': session_id,
        'attempt_id': attempt_id,
        'redirect_url': redirect_url_with_params,
        'scenario': scenario,
        'partner_name': partner_name,
        'success_url': success_url,
        'fail_url': fail_url,
        'quota_url': quota_url,
    }), 200


# ============================================================
# PUBLIC: Postback receiver (called by Pepperwahl / partners)
# ============================================================

@survey_router_bp.route('/survey-router/postback', methods=['GET', 'POST'])
def receive_survey_router_postback():
    """
    Universal postback endpoint for survey partners.
    GET /survey-router/postback?session_id=X&attempt_id=Y&status=completed&payout=1.5&transaction_id=Z
    """
    # Read params from query string or POST body
    if request.method == 'POST':
        post_data = request.get_json(silent=True) or {}
        def get_param(key, default=''):
            return post_data.get(key, request.args.get(key, default))
    else:
        def get_param(key, default=''):
            return request.args.get(key, default)

    session_id = get_param('session_id') or get_param('click_id')
    attempt_id = get_param('attempt_id') or get_param('sub1')
    status = get_param('status', 'completed')
    payout = 0
    try:
        payout = float(get_param('payout', '0') or '0')
    except (ValueError, TypeError):
        payout = 0
    transaction_id = get_param('transaction_id', '')

    logger.info(f"Survey router postback: session={session_id}, attempt={attempt_id}, status={status}, payout={payout}")

    if not session_id:
        return jsonify({'status': 'error', 'message': 'session_id required'}), 400

    sessions_col = get_collection('survey_router_sessions')
    postbacks_col = get_collection('survey_router_postbacks')

    if sessions_col is None:
        return jsonify({'status': 'error', 'message': 'Service unavailable'}), 503

    # Deduplication check
    if transaction_id and postbacks_col is not None:
        existing = postbacks_col.find_one({'transaction_id': transaction_id})
        if existing:
            logger.info(f"Duplicate postback ignored: {transaction_id}")
            return jsonify({'status': 'duplicate'}), 200

    # Find session
    session = sessions_col.find_one({'session_id': session_id})
    if not session:
        logger.warning(f"Survey router postback: session not found: {session_id}")
        return jsonify({'status': 'error', 'message': 'Session not found'}), 404

    # Normalize status
    status_lower = status.lower().strip()
    if status_lower in ('complete', 'completed', 'success', '1'):
        status_normalized = 'completed'
    elif status_lower in ('fail', 'failed', 'disqualified', 'dq', 'screenout', '0'):
        status_normalized = 'failed'
    elif status_lower in ('quota_full', 'quotafull', 'over_quota', 'overquota', '2'):
        status_normalized = 'quota_full'
    else:
        status_normalized = status_lower

    now = datetime.utcnow()

    # Update the specific attempt
    if attempt_id:
        sessions_col.update_one(
            {'session_id': session_id, 'attempts.attempt_id': attempt_id},
            {'$set': {
                'attempts.$.status': status_normalized,
                'attempts.$.payout': payout,
                'attempts.$.transaction_id': transaction_id,
                'attempts.$.postback_received_at': now,
                'attempts.$.completed_at': now,
                'current_attempt.status': status_normalized,
                'current_attempt.payout': payout,
                'current_attempt.postback_received_at': now,
                'updated_at': now,
            }}
        )
    else:
        # No attempt_id — update current attempt
        sessions_col.update_one(
            {'session_id': session_id},
            {'$set': {
                'current_attempt.status': status_normalized,
                'current_attempt.payout': payout,
                'current_attempt.postback_received_at': now,
                'updated_at': now,
            }}
        )

    # If completed, update session total payout and status
    if status_normalized == 'completed':
        sessions_col.update_one(
            {'session_id': session_id},
            {
                '$inc': {'total_payout': payout},
                '$set': {'status': 'completed', 'updated_at': now}
            }
        )
        # Credit publisher (background)
        _credit_publisher_background(session, payout)

    # Log the postback
    if postbacks_col is not None:
        postbacks_col.insert_one({
            'session_id': session_id,
            'attempt_id': attempt_id,
            'status': status_normalized,
            'payout': payout,
            'transaction_id': transaction_id,
            'received_at': now,
            'ip_address': request.headers.get('X-Forwarded-For', request.remote_addr),
            'user_agent': request.headers.get('User-Agent', ''),
            'raw_params': dict(request.args),
        })

    return jsonify({'status': 'ok'}), 200


# ============================================================
# PUBLIC: Return handler (Scenario 1 - same tab redirect back)
# ============================================================

@survey_router_bp.route('/survey-router/return', methods=['GET'])
def handle_return():
    """
    User is redirected back here after completing survey on Pepperwahl.
    Renders a simple page that shows result or redirects to frontend.
    """
    session_id = request.args.get('session_id', '')
    attempt_id = request.args.get('attempt_id', '')
    status = request.args.get('status', 'pending')

    # Redirect to frontend return page which handles the UI
    frontend_url = 'https://moustacheleads.com'
    # Try to detect from referer or use default
    redirect_target = f"{frontend_url}/survey-router/return?session_id={session_id}&attempt_id={attempt_id}&status={status}"

    return redirect(redirect_target, code=302)


# ============================================================
# PUBLIC: Status polling (Scenario 2 - new tab, frontend polls)
# ============================================================

@survey_router_bp.route('/api/survey-router/status', methods=['GET'])
def check_status():
    """
    Frontend polls this to check if postback has arrived.
    GET /api/survey-router/status?session_id=X&attempt_id=Y
    """
    session_id = request.args.get('session_id', '')
    attempt_id = request.args.get('attempt_id', '')

    if not session_id:
        return jsonify({'status': 'error', 'message': 'session_id required'}), 400

    sessions_col = get_collection('survey_router_sessions')
    if sessions_col is None:
        return jsonify({'status': 'error'}), 503

    session = sessions_col.find_one({'session_id': session_id})
    if not session:
        return jsonify({'status': 'not_found'}), 404

    # Find specific attempt or use current
    if attempt_id:
        attempt = next(
            (a for a in session.get('attempts', []) if a.get('attempt_id') == attempt_id),
            None
        )
        # Fallback to current_attempt if array entry not updated yet
        if attempt and attempt.get('status') == 'pending':
            current = session.get('current_attempt', {})
            if current.get('attempt_id') == attempt_id and current.get('status') != 'pending':
                attempt = current
    else:
        attempt = session.get('current_attempt')

    if not attempt:
        return jsonify({'status': 'not_found'}), 404

    return jsonify({
        'status': attempt.get('status', 'pending'),
        'payout': attempt.get('payout', 0),
        'provider_name': attempt.get('provider_name', ''),
        'survey_name': attempt.get('survey_name', ''),
        'session_status': session.get('status', 'in_progress'),
        'total_payout': session.get('total_payout', 0),
    }), 200


# ============================================================
# PUBLIC: Route to next survey (after fail/quota_full)
# ============================================================

@survey_router_bp.route('/api/survey-router/next', methods=['POST'])
def route_to_next():
    """
    Find and return the next available survey for this session.
    Called when current survey returned failed or quota_full.
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data'}), 400

    session_id = data.get('session_id', '')
    if not session_id:
        return jsonify({'error': 'session_id required'}), 400

    sessions_col = get_collection('survey_router_sessions')
    if sessions_col is None:
        return jsonify({'error': 'Service unavailable'}), 503

    session = sessions_col.find_one({'session_id': session_id})
    if not session:
        return jsonify({'error': 'Session not found'}), 404

    # Mark session as exhausted — the funnel step logic handles "next survey" via its own steps
    sessions_col.update_one(
        {'session_id': session_id},
        {'$set': {'status': 'exhausted', 'updated_at': datetime.utcnow()}}
    )
    return jsonify({'success': False, 'exhausted': True, 'message': 'No more surveys available'}), 200


# ============================================================
# ADMIN: Sessions & Analytics
# ============================================================

@survey_router_bp.route('/api/admin/survey-router/sessions', methods=['GET'])
def get_sessions():
    """Get all survey router sessions (admin)."""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header:
        return jsonify({'error': 'Auth required'}), 401

    sessions_col = get_collection('survey_router_sessions')
    if sessions_col is None:
        return jsonify({'sessions': [], 'total': 0}), 200

    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 50))
    status_filter = request.args.get('status', '')

    query = {}
    if status_filter:
        query['status'] = status_filter

    total = sessions_col.count_documents(query)
    sessions = list(
        sessions_col.find(query)
        .sort('created_at', -1)
        .skip((page - 1) * per_page)
        .limit(per_page)
    )

    for s in sessions:
        s['_id'] = str(s['_id'])
        if isinstance(s.get('created_at'), datetime):
            s['created_at'] = s['created_at'].isoformat() + 'Z'
        if isinstance(s.get('updated_at'), datetime):
            s['updated_at'] = s['updated_at'].isoformat() + 'Z'

    return jsonify({'sessions': sessions, 'total': total, 'page': page}), 200


@survey_router_bp.route('/api/admin/survey-router/stats', methods=['GET'])
def get_router_stats():
    """Get survey router statistics."""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header:
        return jsonify({'error': 'Auth required'}), 401

    sessions_col = get_collection('survey_router_sessions')
    if sessions_col is None:
        return jsonify({'stats': {}}), 200

    total = sessions_col.count_documents({})
    completed = sessions_col.count_documents({'status': 'completed'})
    failed = sessions_col.count_documents({'status': {'$in': ['failed', 'exhausted']}})
    in_progress = sessions_col.count_documents({'status': 'in_progress'})

    # Total payout
    pipeline = [
        {'$group': {'_id': None, 'total_payout': {'$sum': '$total_payout'}}}
    ]
    payout_result = list(sessions_col.aggregate(pipeline))
    total_payout = payout_result[0]['total_payout'] if payout_result else 0

    return jsonify({
        'stats': {
            'total_sessions': total,
            'completed': completed,
            'failed': failed,
            'in_progress': in_progress,
            'total_payout': round(total_payout, 2),
            'completion_rate': round(completed / total * 100, 1) if total > 0 else 0,
        }
    }), 200


# ============================================================
# HELPER: Credit publisher in background
# ============================================================

def _credit_publisher_background(session, payout):
    """Credit the publisher who sent this user. Runs in background thread."""
    def _do_credit():
        try:
            user_id = session.get('user_id', '')
            if not user_id or user_id == 'anonymous' or payout <= 0:
                return

            users_col = get_collection('users')
            if users_col is None:
                return

            # Try to find user and credit balance
            from bson import ObjectId as ObjId
            user = None
            try:
                user = users_col.find_one({'_id': ObjId(user_id)})
            except Exception:
                user = users_col.find_one({'username': user_id})

            if user:
                users_col.update_one(
                    {'_id': user['_id']},
                    {'$inc': {'balance': payout}}
                )
                logger.info(f"Credited {payout} to user {user.get('username', user_id)} from survey router")
        except Exception as e:
            logger.error(f"Error crediting publisher from survey router: {e}")

    thread = threading.Thread(target=_do_credit, daemon=True)
    thread.start()
