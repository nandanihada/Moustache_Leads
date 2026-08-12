"""
Survey Funnel Router API
Creates survey chains where users answer questions → pass/fail criteria → redirect to offer or next survey.
Admin configures: survey questions, pass criteria (which answers qualify), redirect URL on pass, fallback to next survey on fail.
All user responses and funnel history are saved.
"""

from flask import Blueprint, request, jsonify, redirect as flask_redirect
from utils.auth import token_required
from database import db_instance
from datetime import datetime
from bson import ObjectId
import logging
import secrets
import threading

logger = logging.getLogger(__name__)

survey_funnel_bp = Blueprint('survey_funnel', __name__)


def get_collection(name):
    return db_instance.get_collection(name)


def generate_funnel_id():
    return f"SF-{secrets.token_hex(4).upper()}"


def generate_click_id():
    return f"CLK-{secrets.token_hex(6).upper()}"


# ==================== PUBLIC: FUNNEL CLICK TRACKING ====================

@survey_funnel_bp.route('/funnel-track/<funnel_id>', methods=['GET'])
def track_funnel_click(funnel_id):
    """
    Tracking redirect for survey funnel clicks from the offerwall.
    URL: /funnel-track/{funnel_id}?user_id={publisher_id}&pass_url={pepperwahl_url}

    1. Logs a click record with publisher user_id + funnel_id + generated click_id
    2. Appends aff_sub={click_id} to the Pepperwahl survey URL
    3. Redirects the user to Pepperwahl with click_id embedded
    4. When postback arrives with aff_sub=CLK-XXXX, we look up the click → credit publisher
    """
    try:
        user_id = request.args.get('user_id', '')
        pass_url = request.args.get('pass_url', '')
        sub1 = request.args.get('sub1', '')

        if not pass_url:
            # Fallback: try to get pass_url from funnel config
            funnels_col = get_collection('survey_funnels')
            if funnels_col:
                funnel = funnels_col.find_one({'funnel_id': funnel_id})
                if funnel:
                    steps = funnel.get('steps', [])
                    if steps:
                        pass_url = steps[0].get('pass_url', '')

        if not pass_url:
            return flask_redirect('/', code=302)

        # Generate click_id
        click_id = generate_click_id()

        # Save click record in background
        ip_address = request.headers.get('X-Forwarded-For', request.remote_addr)
        user_agent = request.headers.get('User-Agent', '')

        def _save_click():
            try:
                now = datetime.utcnow()
                # ── Resolve publisher from placement_id ──────────────────────
                publisher_user_id = ''
                publisher_username = ''
                placement_id_val = request.args.get('placement_id', '') or sub1
                if placement_id_val:
                    try:
                        placements_col = get_collection('placements')
                        users_col = get_collection('users')
                        if placements_col is not None and users_col is not None:
                            placement = placements_col.find_one({'_id': placement_id_val}) or \
                                        placements_col.find_one({'placement_id': placement_id_val}) or \
                                        placements_col.find_one({'placementKey': placement_id_val})
                            if not placement:
                                # Try by placementKey or shortCode
                                from bson import ObjectId
                                try:
                                    placement = placements_col.find_one({'_id': ObjectId(placement_id_val)})
                                except Exception:
                                    pass
                            if placement:
                                owner_id = placement.get('created_by') or placement.get('user_id') or placement.get('userId')
                                if owner_id:
                                    from bson import ObjectId
                                    try:
                                        pub_user = users_col.find_one({'_id': ObjectId(str(owner_id))})
                                    except Exception:
                                        pub_user = users_col.find_one({'username': str(owner_id)})
                                    if pub_user:
                                        publisher_user_id = str(pub_user['_id'])
                                        publisher_username = pub_user.get('username', '')
                                        logger.info(f"📊 Publisher resolved from placement {placement_id_val}: {publisher_username}")
                    except Exception as pe:
                        logger.warning(f"Could not resolve publisher from placement: {pe}")

                click_doc = {
                    'click_id': click_id,
                    'funnel_id': funnel_id,
                    'offer_id': funnel_id,  # use funnel_id as offer_id so postback processor can find it
                    'offer_name': f'Survey Funnel {funnel_id}',
                    'user_id': publisher_user_id or user_id,  # publisher's user_id
                    'affiliate_id': publisher_user_id or user_id,
                    'username': publisher_username or user_id,
                    'end_user_id': user_id,   # the actual end user who took the survey
                    'placement_id': placement_id_val,
                    'ip_address': ip_address,
                    'user_agent': user_agent,
                    'sub_id1': sub1,
                    'pass_url': pass_url,
                    'click_time': now,
                    'timestamp': now,
                    'converted': False,
                    'country': 'Unknown',
                    'device_type': 'unknown',
                    'payout': 0,
                    'source': 'survey_funnel',
                    'network': 'Pepperwahl',
                }
                # Write to both collections:
                # 1. funnel_clicks — for funnel-specific lookup
                funnel_clicks_col = get_collection('funnel_clicks')
                if funnel_clicks_col is not None:
                    funnel_clicks_col.insert_one(dict(click_doc))
                # 2. clicks — so process_single_postback can find CLK-XXX and forward normally
                clicks_col = get_collection('clicks')
                if clicks_col is not None:
                    clicks_col.insert_one(dict(click_doc))
                logger.info(f"📊 Funnel click logged: {click_id} | funnel={funnel_id} | publisher={publisher_username or user_id}")
            except Exception as e:
                logger.error(f"Funnel click save error: {e}")

        threading.Thread(target=_save_click, daemon=True).start()

        # Append aff_sub=click_id to the pass_url
        separator = '&' if '?' in pass_url else '?'
        redirect_url = f"{pass_url}{separator}aff_sub={click_id}&sub1={click_id}"

        logger.info(f"↗️ Funnel click redirect: {click_id} → {redirect_url[:80]}")
        return flask_redirect(redirect_url, code=302)

    except Exception as e:
        logger.error(f"Funnel track error: {e}")
        return flask_redirect('/', code=302)


# ==================== ADMIN: FUNNEL CRUD ====================

@survey_funnel_bp.route('/api/admin/survey-funnels', methods=['GET'])
@token_required
def get_funnels():
    """Get all survey funnels."""
    try:
        current_user = request.current_user
        if current_user.get('role') not in ('admin', 'subadmin'):
            return jsonify({'error': 'Admin access required'}), 403

        collection = get_collection('survey_funnels')
        if collection is None:
            return jsonify({'error': 'Database connection failed'}), 500

        search = request.args.get('search', '')
        query = {}
        if search:
            query['$or'] = [
                {'name': {'$regex': search, '$options': 'i'}},
                {'funnel_id': {'$regex': search, '$options': 'i'}}
            ]

        funnels = list(collection.find(query).sort('created_at', -1))

        serialized = []
        for f in funnels:
            serialized.append({
                'funnel_id': f.get('funnel_id', ''),
                'name': f.get('name', ''),
                'description': f.get('description', ''),
                'status': f.get('status', 'active'),
                'placement': f.get('placement', 'everywhere'),
                'placement_offer_id': f.get('placement_offer_id', ''),
                'steps': f.get('steps', []),
                'fail_message': f.get('fail_message', 'Sorry, you do not qualify for any offers at this time.'),
                'display_title': f.get('display_title', f.get('name', '')),
                'display_description': f.get('display_description', 'Complete this survey to unlock a special offer!'),
                'display_image_url': f.get('display_image_url', ''),
                'display_payout': f.get('display_payout', 0),
                'display_category': f.get('display_category', 'SURVEY'),
                'stats': f.get('stats', {'total_starts': 0, 'total_passes': 0, 'total_fails': 0}),
                'created_at': f.get('created_at', '').isoformat() + 'Z' if isinstance(f.get('created_at'), datetime) else str(f.get('created_at', '')),
                'updated_at': f.get('updated_at', '').isoformat() + 'Z' if isinstance(f.get('updated_at'), datetime) else str(f.get('updated_at', '')),
            })

        return jsonify({'funnels': serialized}), 200
    except Exception as e:
        logger.error(f"Error getting survey funnels: {e}")
        return jsonify({'error': 'Failed to fetch funnels'}), 500


@survey_funnel_bp.route('/api/admin/survey-funnels', methods=['POST'])
@token_required
def create_funnel():
    """Create a new survey funnel."""
    try:
        current_user = request.current_user
        if current_user.get('role') not in ('admin', 'subadmin'):
            return jsonify({'error': 'Admin access required'}), 403

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        name = data.get('name', '').strip()
        if not name:
            return jsonify({'error': 'Funnel name is required'}), 400

        collection = get_collection('survey_funnels')
        if collection is None:
            return jsonify({'error': 'Database connection failed'}), 500

        funnel_id = generate_funnel_id()

        # Steps structure:
        # Each step = { survey_title, questions: [{text, options}], pass_criteria: {question_index, required_answers: [...]}, pass_url, min_correct (optional) }
        steps = data.get('steps', [])

        funnel_doc = {
            'funnel_id': funnel_id,
            'name': name,
            'description': data.get('description', ''),
            'status': data.get('status', 'active'),
            'placement': data.get('placement', 'everywhere'),  # everywhere, iframe, offerwall, specific_offer
            'placement_offer_id': data.get('placement_offer_id', ''),
            'survey_template': data.get('survey_template', 'modern-card'),
            'questions_per_page': data.get('questions_per_page', 0),
            'spinner_duration': data.get('spinner_duration', 8),
            'survey_timeout': data.get('survey_timeout', 5),
            'steps': steps,
            'fail_message': data.get('fail_message', 'Sorry, you do not qualify for any offers at this time.'),
            # Display settings — how it looks as an offer card on the offerwall
            'display_title': data.get('display_title', name),
            'display_description': data.get('display_description', 'Complete this survey to unlock a special offer!'),
            'display_image_url': data.get('display_image_url', ''),
            'display_payout': data.get('display_payout', 0),
            'display_category': data.get('display_category', 'SURVEY'),
            'stats': {'total_starts': 0, 'total_passes': 0, 'total_fails': 0},
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'created_by': str(current_user.get('_id', current_user.get('user_id', ''))),
        }

        collection.insert_one(funnel_doc)
        logger.info(f"✅ Created survey funnel: {funnel_id} ({name})")

        return jsonify({'success': True, 'funnel_id': funnel_id, 'message': f'Funnel "{name}" created'}), 201
    except Exception as e:
        logger.error(f"Error creating survey funnel: {e}")
        return jsonify({'error': 'Failed to create funnel'}), 500


@survey_funnel_bp.route('/api/admin/survey-funnels/<funnel_id>', methods=['GET'])
@token_required
def get_funnel(funnel_id):
    """Get a single funnel."""
    try:
        current_user = request.current_user
        if current_user.get('role') not in ('admin', 'subadmin'):
            return jsonify({'error': 'Admin access required'}), 403

        collection = get_collection('survey_funnels')
        if collection is None:
            return jsonify({'error': 'Database connection failed'}), 500

        funnel = collection.find_one({'funnel_id': funnel_id})
        if not funnel:
            return jsonify({'error': 'Funnel not found'}), 404

        funnel['_id'] = str(funnel['_id'])
        if isinstance(funnel.get('created_at'), datetime):
            funnel['created_at'] = funnel['created_at'].isoformat() + 'Z'
        if isinstance(funnel.get('updated_at'), datetime):
            funnel['updated_at'] = funnel['updated_at'].isoformat() + 'Z'

        return jsonify({'funnel': funnel}), 200
    except Exception as e:
        logger.error(f"Error getting funnel {funnel_id}: {e}")
        return jsonify({'error': 'Failed to fetch funnel'}), 500


@survey_funnel_bp.route('/api/admin/survey-funnels/<funnel_id>', methods=['PUT'])
@token_required
def update_funnel(funnel_id):
    """Update a funnel."""
    try:
        current_user = request.current_user
        if current_user.get('role') not in ('admin', 'subadmin'):
            return jsonify({'error': 'Admin access required'}), 403

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        collection = get_collection('survey_funnels')
        if collection is None:
            return jsonify({'error': 'Database connection failed'}), 500

        existing = collection.find_one({'funnel_id': funnel_id})
        if not existing:
            return jsonify({'error': 'Funnel not found'}), 404

        update_fields = {'updated_at': datetime.utcnow()}
        allowed = ['name', 'description', 'status', 'placement', 'placement_offer_id', 'steps', 'fail_message',
                   'display_title', 'display_description', 'display_image_url', 'display_payout', 'display_category',
                   'survey_template', 'questions_per_page', 'spinner_duration', 'survey_timeout',
                   'use_survey_router', 'router_provider_id']
        for field in allowed:
            if field in data:
                update_fields[field] = data[field]

        collection.update_one({'funnel_id': funnel_id}, {'$set': update_fields})
        return jsonify({'success': True, 'message': 'Funnel updated'}), 200
    except Exception as e:
        logger.error(f"Error updating funnel {funnel_id}: {e}")
        return jsonify({'error': 'Failed to update funnel'}), 500


@survey_funnel_bp.route('/api/admin/survey-funnels/<funnel_id>', methods=['DELETE'])
@token_required
def delete_funnel(funnel_id):
    """Delete a funnel."""
    try:
        current_user = request.current_user
        if current_user.get('role') not in ('admin', 'subadmin'):
            return jsonify({'error': 'Admin access required'}), 403

        collection = get_collection('survey_funnels')
        if collection is None:
            return jsonify({'error': 'Database connection failed'}), 500

        result = collection.delete_one({'funnel_id': funnel_id})
        if result.deleted_count == 0:
            return jsonify({'error': 'Funnel not found'}), 404

        return jsonify({'success': True, 'message': 'Funnel deleted'}), 200
    except Exception as e:
        logger.error(f"Error deleting funnel {funnel_id}: {e}")
        return jsonify({'error': 'Failed to delete funnel'}), 500


# ==================== PUBLIC: GET ACTIVE FUNNELS FOR OFFERWALL ====================

@survey_funnel_bp.route('/api/survey-funnel/active', methods=['GET'])
def get_active_funnels():
    """Public endpoint: returns active funnels formatted as offer cards for the offerwall."""
    try:
        funnels_col = get_collection('survey_funnels')
        if funnels_col is None:
            return jsonify({'funnels': []}), 200

        placement = request.args.get('placement', 'everywhere')

        query = {
            'status': 'active',
            '$or': [
                {'placement': 'everywhere'},
                {'placement': placement}
            ]
        }

        funnels = list(funnels_col.find(query).sort('created_at', -1))

        offer_cards = []
        for f in funnels:
            offer_cards.append({
                'id': f.get('funnel_id', ''),
                'funnel_id': f.get('funnel_id', ''),
                'is_funnel': True,
                'title': f.get('display_title', f.get('name', 'Survey')),
                'description': f.get('display_description', 'Complete this survey to unlock a special offer!'),
                'image_url': f.get('display_image_url', ''),
                'reward_amount': f.get('display_payout', 0),
                'reward_currency': 'USD',
                'category': f.get('display_category', 'SURVEY'),
                'status': 'active',
                'offer_type': 'survey_funnel',
                'click_url': '',  # Frontend adds user_id param to /funnel-track/{funnel_id}
                'tracking_url': f'/funnel-track/{f.get("funnel_id", "")}',  # Use this for click tracking
                'network': 'Survey Funnel',
                'countries': [],
                'devices': [],
                'device_targeting': '',
                'estimated_time': '2-5 min',
                'payout': f.get('display_payout', 0),
                'star_rating': 5,
                'is_locked': False,
                'has_access': True,
                'requires_approval': False,
                'steps_count': len(f.get('steps', [])),
            })

        return jsonify({'funnels': offer_cards}), 200
    except Exception as e:
        logger.error(f"Error getting active funnels: {e}")
        return jsonify({'funnels': []}), 200


# ==================== PUBLIC: FUNNEL EXECUTION ====================

@survey_funnel_bp.route('/api/survey-funnel/<funnel_id>/start', methods=['POST'])
def start_funnel(funnel_id):
    """Start a funnel for a user. Returns the first survey step."""
    try:
        funnels_col = get_collection('survey_funnels')
        history_col = get_collection('survey_funnel_history')

        if funnels_col is None:
            return jsonify({'error': 'Service unavailable'}), 503

        funnel = funnels_col.find_one({'funnel_id': funnel_id, 'status': 'active'})
        if not funnel:
            return jsonify({'error': 'Funnel not found or inactive'}), 404

        data = request.get_json() or {}
        user_id = data.get('user_id', 'anonymous')
        start_step = int(data.get('start_step', 0))

        steps = funnel.get('steps', [])
        if not steps:
            return jsonify({'error': 'Funnel has no steps'}), 400

        # Validate start_step
        if start_step >= len(steps):
            start_step = 0

        # Create history record
        session_id = f"FS-{secrets.token_hex(6).upper()}"
        if history_col is not None:
            history_col.insert_one({
                'session_id': session_id,
                'funnel_id': funnel_id,
                'user_id': user_id,
                'current_step': start_step,
                'responses': [],
                'status': 'in_progress',
                'started_at': datetime.utcnow(),
                'completed_at': None,
                'result': None,  # 'passed' or 'failed'
                'passed_at_step': None,
                'redirect_url': None,
            })

        # Increment stats
        funnels_col.update_one({'funnel_id': funnel_id}, {'$inc': {'stats.total_starts': 1}})

        # Return the step at start_step index
        target_step = steps[start_step]
        return jsonify({
            'session_id': session_id,
            'step_index': start_step,
            'total_steps': len(steps),
            'survey_template': funnel.get('survey_template', 'modern-card'),
            'questions_per_page': funnel.get('questions_per_page', 0),
            'spinner_duration': funnel.get('spinner_duration', 8),
            'survey_timeout': funnel.get('survey_timeout', 5),
            'survey': {
                'title': target_step.get('survey_title', f'Survey {start_step + 1}'),
                'questions': target_step.get('questions', []),
            }
        }), 200

    except Exception as e:
        logger.error(f"Error starting funnel {funnel_id}: {e}")
        return jsonify({'error': 'Failed to start funnel'}), 500


@survey_funnel_bp.route('/api/survey-funnel/<funnel_id>/submit', methods=['POST'])
def submit_step(funnel_id):
    """Submit answers for current step. Returns pass/fail + next action."""
    try:
        funnels_col = get_collection('survey_funnels')
        history_col = get_collection('survey_funnel_history')

        if funnels_col is None:
            return jsonify({'error': 'Service unavailable'}), 503

        funnel = funnels_col.find_one({'funnel_id': funnel_id})
        if not funnel:
            return jsonify({'error': 'Funnel not found'}), 404

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        session_id = data.get('session_id', '')
        step_index = data.get('step_index', 0)
        answers = data.get('answers', [])  # [{question_index: 0, answer: "Option A"}, ...]

        steps = funnel.get('steps', [])
        if step_index >= len(steps):
            return jsonify({'error': 'Invalid step index'}), 400

        current_step = steps[step_index]
        pass_criteria = current_step.get('pass_criteria', {})
        
        # Evaluate pass/fail
        passed = _evaluate_pass(answers, pass_criteria)

        # Save response to history
        if history_col is not None and session_id:
            history_col.update_one(
                {'session_id': session_id},
                {
                    '$push': {'responses': {
                        'step_index': step_index,
                        'answers': answers,
                        'passed': passed,
                        'submitted_at': datetime.utcnow()
                    }},
                    '$set': {'current_step': step_index + 1}
                }
            )

        if passed:
            # User passed! Check if this step routes to an external survey (survey router)
            redirect_url = current_step.get('pass_url', '')
            use_survey_router = current_step.get('use_survey_router', False)
            router_partner_id = current_step.get('router_partner_id', '')
            router_scenario = current_step.get('router_scenario', 'new_tab')

            # Update history
            if history_col is not None and session_id:
                history_col.update_one(
                    {'session_id': session_id},
                    {'$set': {
                        'status': 'completed',
                        'result': 'passed',
                        'passed_at_step': step_index,
                        'redirect_url': redirect_url,
                        'completed_at': datetime.utcnow()
                    }}
                )
            
            # Update funnel stats
            funnels_col.update_one({'funnel_id': funnel_id}, {'$inc': {'stats.total_passes': 1}})

            # If survey router is enabled for this step, return router info
            if use_survey_router and router_partner_id:
                # Get next step's pass_url for "try another" functionality
                next_step_url = ''
                next_step_index = step_index + 1
                if next_step_index < len(steps):
                    next_step_url = steps[next_step_index].get('pass_url', '')
                
                return jsonify({
                    'result': 'passed',
                    'use_survey_router': True,
                    'router_partner_id': router_partner_id,
                    'router_scenario': router_scenario,
                    'redirect_url': redirect_url,
                    'next_redirect_url': next_step_url,
                    'next_step_index': next_step_index if next_step_index < len(steps) else -1,
                    'message': current_step.get('pass_message', 'Congratulations! You qualify.'),
                }), 200

            return jsonify({
                'result': 'passed',
                'redirect_url': redirect_url,
                'message': current_step.get('pass_message', 'Congratulations! You qualify.'),
            }), 200
        else:
            # User failed this step
            next_step_index = step_index + 1

            if next_step_index < len(steps):
                # There's another survey to try
                next_step = steps[next_step_index]
                return jsonify({
                    'result': 'failed',
                    'message': current_step.get('fail_message', "You didn't qualify for this offer. Try the next one!"),
                    'has_next': True,
                    'next_step_index': next_step_index,
                    'next_survey': {
                        'title': next_step.get('survey_title', f'Survey {next_step_index + 1}'),
                        'questions': next_step.get('questions', []),
                    }
                }), 200
            else:
                # No more surveys — final fail
                if history_col is not None and session_id:
                    history_col.update_one(
                        {'session_id': session_id},
                        {'$set': {
                            'status': 'completed',
                            'result': 'failed',
                            'completed_at': datetime.utcnow()
                        }}
                    )
                
                funnels_col.update_one({'funnel_id': funnel_id}, {'$inc': {'stats.total_fails': 1}})

                return jsonify({
                    'result': 'failed',
                    'message': funnel.get('fail_message', 'Sorry, you do not qualify for any offers at this time.'),
                    'has_next': False,
                }), 200

    except Exception as e:
        logger.error(f"Error submitting funnel step {funnel_id}: {e}")
        return jsonify({'error': 'Failed to submit'}), 500


# ==================== ADMIN: HISTORY ====================

@survey_funnel_bp.route('/api/admin/survey-funnels/history', methods=['GET'])
@token_required
def get_funnel_history():
    """Get funnel response history."""
    try:
        current_user = request.current_user
        if current_user.get('role') not in ('admin', 'subadmin'):
            return jsonify({'error': 'Admin access required'}), 403

        history_col = get_collection('survey_funnel_history')
        if history_col is None:
            return jsonify({'error': 'Database connection failed'}), 500

        funnel_id = request.args.get('funnel_id', '')
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))

        query = {}
        if funnel_id:
            query['funnel_id'] = funnel_id

        total = history_col.count_documents(query)
        skip = (page - 1) * per_page

        records = list(history_col.find(query).sort('started_at', -1).skip(skip).limit(per_page))

        serialized = []
        for r in records:
            serialized.append({
                'session_id': r.get('session_id', ''),
                'funnel_id': r.get('funnel_id', ''),
                'user_id': r.get('user_id', ''),
                'current_step': r.get('current_step', 0),
                'status': r.get('status', ''),
                'result': r.get('result', ''),
                'passed_at_step': r.get('passed_at_step'),
                'redirect_url': r.get('redirect_url', ''),
                'responses': r.get('responses', []),
                'started_at': r.get('started_at', '').isoformat() + 'Z' if isinstance(r.get('started_at'), datetime) else '',
                'completed_at': r.get('completed_at', '').isoformat() + 'Z' if isinstance(r.get('completed_at'), datetime) else '',
            })

        return jsonify({
            'history': serialized,
            'pagination': {'page': page, 'per_page': per_page, 'total': total}
        }), 200
    except Exception as e:
        logger.error(f"Error getting funnel history: {e}")
        return jsonify({'error': 'Failed to fetch history'}), 500


# ==================== HELPERS ====================

def _evaluate_pass(answers, pass_criteria):
    """
    Evaluate if user's answers meet the pass criteria.
    
    pass_criteria format:
    {
        "mode": "any" | "all" | "min_count",
        "min_count": 2,  # only for min_count mode
        "rules": [
            {"question_index": 0, "accepted_answers": ["Option A", "Option B"]},
            {"question_index": 1, "accepted_answers": ["Yes"]},
        ]
    }
    """
    if not pass_criteria or not pass_criteria.get('rules'):
        return True  # No criteria = always pass

    rules = pass_criteria.get('rules', [])
    mode = pass_criteria.get('mode', 'all')
    min_count = pass_criteria.get('min_count', 1)

    # Build answer map: question_index -> answer
    answer_map = {}
    for a in answers:
        q_idx = a.get('question_index', -1)
        answer_map[q_idx] = a.get('answer', '')

    matches = 0
    for rule in rules:
        q_idx = rule.get('question_index', -1)
        accepted = rule.get('accepted_answers', [])
        user_answer = answer_map.get(q_idx, '')

        if user_answer in accepted:
            matches += 1

    if mode == 'any':
        return matches > 0
    elif mode == 'all':
        return matches == len(rules)
    elif mode == 'min_count':
        return matches >= min_count
    else:
        return matches == len(rules)
