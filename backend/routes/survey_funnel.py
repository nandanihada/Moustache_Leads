"""
Survey Funnel Router API
Creates survey chains where users answer questions → pass/fail criteria → redirect to offer or next survey.
Admin configures: survey questions, pass criteria (which answers qualify), redirect URL on pass, fallback to next survey on fail.
All user responses and funnel history are saved.
"""

from flask import Blueprint, request, jsonify
from utils.auth import token_required
from database import db_instance
from datetime import datetime
from bson import ObjectId
import logging
import secrets

logger = logging.getLogger(__name__)

survey_funnel_bp = Blueprint('survey_funnel', __name__)


def get_collection(name):
    return db_instance.get_collection(name)


def generate_funnel_id():
    return f"SF-{secrets.token_hex(4).upper()}"


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
                   'display_title', 'display_description', 'display_image_url', 'display_payout', 'display_category']
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
                'click_url': '',
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

        steps = funnel.get('steps', [])
        if not steps:
            return jsonify({'error': 'Funnel has no steps'}), 400

        # Create history record
        session_id = f"FS-{secrets.token_hex(6).upper()}"
        if history_col is not None:
            history_col.insert_one({
                'session_id': session_id,
                'funnel_id': funnel_id,
                'user_id': user_id,
                'current_step': 0,
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

        # Return first step (without pass criteria — user shouldn't see that)
        first_step = steps[0]
        return jsonify({
            'session_id': session_id,
            'step_index': 0,
            'total_steps': len(steps),
            'survey': {
                'title': first_step.get('survey_title', f'Survey {1}'),
                'questions': first_step.get('questions', []),
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
            # User passed! Redirect to offer URL
            redirect_url = current_step.get('pass_url', '')
            
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
