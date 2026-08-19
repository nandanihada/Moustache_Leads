"""
Pepperwahl Integration Routes
─────────────────────────────
External endpoint (no auth, API-key protected):
  POST /api/external/pepperwahl/publish   ← Pepperwahl calls this

Admin endpoints (token + admin required):
  GET  /api/admin/pepperwahl/inbox        ← list all incoming requests
  GET  /api/admin/pepperwahl/inbox/<id>   ← single request detail
  POST /api/admin/pepperwahl/process/<id> ← manually process / re-process a request
  PUT  /api/admin/pepperwahl/inbox/<id>/payout  ← set payout after creation
  PUT  /api/admin/pepperwahl/inbox/<id>/status  ← pause / activate the linked offer
  DELETE /api/admin/pepperwahl/inbox/<id> ← soft-delete inbox entry

How it works
────────────
1. Pepperwahl POSTs a JSON body containing the survey link + eligibility questions.
2. We store the raw payload in `pepperwahl_inbox` collection (status=pending).
3. We immediately auto-process it:
   a. Create a Survey in `surveys` collection (questions + qualify_if rules).
   b. Create a full Offer in `offers` collection (category=SURVEY, source=pepperwahl).
      The offer's target_url is a Moustache pre-screening URL, NOT the Pepperwahl link.
      The Pepperwahl link is stored on the survey as `redirect_url`.
4. Return { success, moustache_survey_id, moustache_offer_id, source_survey_id }.
5. Admin sees the inbox entry, can set payout, activate/pause, update.
"""

from flask import Blueprint, request, jsonify
from datetime import datetime
from bson import ObjectId
from database import db_instance
import logging
import os
import hmac
import hashlib

logger = logging.getLogger(__name__)

pepperwahl_integration_bp = Blueprint('pepperwahl_integration', __name__)

# ── API key auth (simple shared secret) ───────────────────────────────────────
PEPPERWAHL_API_KEY = os.environ.get('PEPPERWAHL_API_KEY', 'pw_moustache_secret_key_2025')


def _verify_api_key():
    key = request.headers.get('X-API-Key') or request.args.get('api_key')
    return key == PEPPERWAHL_API_KEY


# ── Admin guard helpers ────────────────────────────────────────────────────────
def _admin_guard(f):
    from utils.auth import token_required, admin_required
    from functools import wraps

    @wraps(f)
    @token_required
    @admin_required
    def wrapper(*args, **kwargs):
        return f(*args, **kwargs)

    return wrapper


# ── Serialiser ────────────────────────────────────────────────────────────────
def _serial(doc):
    if doc is None:
        return None
    doc = dict(doc)
    doc['_id'] = str(doc.get('_id', ''))
    for k, v in doc.items():
        if isinstance(v, datetime):
            doc[k] = v.isoformat() + 'Z'
        elif isinstance(v, ObjectId):
            doc[k] = str(v)
    return doc


# ── Collection helpers ────────────────────────────────────────────────────────
def _inbox_col():
    return db_instance.get_collection('pepperwahl_inbox')


def _surveys_col():
    return db_instance.get_collection('surveys')


def _offers_col():
    return db_instance.get_collection('offers')


def _counter_col():
    return db_instance.get_collection('counters')


# ── Offer-ID generator (reuses existing ML-XXXXX counter) ────────────────────
def _next_offer_id():
    result = _counter_col().find_one_and_update(
        {'_id': 'offer_counter'},
        {'$inc': {'sequence_value': 1}},
        upsert=True,
        return_document=True,
    )
    seq = result['sequence_value']
    return f'ML-{seq:05d}'


# ─────────────────────────────────────────────────────────────────────────────
# VALIDATION
# ─────────────────────────────────────────────────────────────────────────────
def _validate_payload(data):
    """Return list of error strings. Empty = valid."""
    errors = []
    if not data.get('survey_id'):
        errors.append('survey_id is required')
    if not data.get('survey_name'):
        errors.append('survey_name is required')
    if not data.get('survey_link'):
        errors.append('survey_link is required')
    questions = data.get('questions', [])
    if not questions or len(questions) < 1:
        errors.append('At least 1 eligibility question is required')
    for i, q in enumerate(questions):
        if not q.get('question'):
            errors.append(f'questions[{i}].question is required')
        if not q.get('options') or len(q['options']) < 2:
            errors.append(f'questions[{i}].options must have at least 2 choices')
        if not q.get('qualify_if') or len(q['qualify_if']) < 1:
            errors.append(f'questions[{i}].qualify_if must have at least 1 qualifying answer')
    return errors


# ─────────────────────────────────────────────────────────────────────────────
# CORE PROCESSING  — creates Survey + Offer automatically
# ─────────────────────────────────────────────────────────────────────────────
def _process_inbox_entry(inbox_id: str):
    """
    Read an inbox entry, create/update the Survey + Offer, mark as processed.
    Returns (success: bool, message: str, detail: dict)
    """
    inbox = _inbox_col().find_one({'_id': ObjectId(inbox_id)})
    if not inbox:
        return False, 'Inbox entry not found', {}

    payload = inbox.get('payload', {})
    pw_survey_id = payload.get('survey_id', '')
    survey_name = payload.get('survey_name', 'Pepperwahl Survey')
    survey_link = payload.get('survey_link', '')
    questions = payload.get('questions', [])
    country = payload.get('country', '')
    loi = payload.get('loi_minutes')
    topic = payload.get('topic', survey_name)

    # Build survey questions in Moustache format
    survey_questions = []
    for q in questions:
        survey_questions.append({
            'type': 'multiple_choice',
            'question': q['question'],
            'options': q['options'],
            'required': True,
            # Pepperwahl-specific: which answers allow the user to proceed
            'qualify_if': q.get('qualify_if', q['options']),
        })

    now = datetime.utcnow()

    # ── Check if this pw_survey_id already has a survey/offer (update flow) ──
    existing_inbox = _inbox_col().find_one({
        'payload.survey_id': pw_survey_id,
        'status': {'$in': ['processed', 'active', 'paused']},
        '_id': {'$ne': ObjectId(inbox_id)},
    })

    existing_survey_id = inbox.get('moustache_survey_id')
    existing_offer_id = inbox.get('moustache_offer_id')

    if existing_inbox:
        existing_survey_id = existing_survey_id or existing_inbox.get('moustache_survey_id')
        existing_offer_id = existing_offer_id or existing_inbox.get('moustache_offer_id')

    # ── CREATE or UPDATE Survey ───────────────────────────────────────────────
    survey_doc = {
        'name': survey_name,
        'description': f'Pre-screening survey from Pepperwahl. Topic: {topic}',
        'category': 'Survey',
        'questions': survey_questions,
        'captcha_enabled': False,      # Pepperwahl surveys skip captcha
        'template': 'modern-card',
        'questions_per_page': 1,       # One question at a time for better UX
        'is_active': True,
        'updated_at': now,
        # Pepperwahl-specific fields
        'source': 'pepperwahl',
        'pepperwahl_survey_id': pw_survey_id,
        'redirect_url': survey_link,   # Where qualified users go
        'loi_minutes': loi,
        'target_country': country,
        'topic': topic,
        'qualify_mode': True,          # flag: submit handler evaluates qualify_if
    }

    if existing_survey_id:
        try:
            _surveys_col().update_one(
                {'_id': ObjectId(existing_survey_id)},
                {'$set': survey_doc},
            )
            ml_survey_id = existing_survey_id
            survey_action = 'updated'
        except Exception as e:
            logger.error(f'Survey update failed: {e}')
            existing_survey_id = None

    if not existing_survey_id:
        survey_doc['created_by'] = 'pepperwahl'
        survey_doc['created_at'] = now
        survey_doc['total_responses'] = 0
        survey_doc['total_passed'] = 0
        survey_doc['total_failed'] = 0
        survey_doc['total_abandoned'] = 0
        survey_doc['avg_completion_time'] = 0
        result = _surveys_col().insert_one(survey_doc)
        ml_survey_id = str(result.inserted_id)
        survey_action = 'created'

    # ── CREATE or UPDATE Offer ─────────────────────────────────────────────────
    # The offer URL uses the Moustache pre-screening survey path.
    # simple_tracking will route click → /survey/<click_id>
    tracking_base = os.environ.get('TRACKING_BASE_URL', 'https://offers.moustacheleads.com')
    offer_target_url = f'{tracking_base}/survey/{{click_id}}'  # resolved at click time

    loi_text = f' ({loi} min)' if loi else ''
    country_text = f' [{country}]' if country else ''

    offer_fields = {
        'name': f'{survey_name}{country_text}{loi_text}',
        'description': (
            f'Pepperwahl pre-screening survey. Topic: {topic}.'
            f'{" LOI: " + str(loi) + " minutes." if loi else ""}'
            f'{" Country: " + country + "." if country else ""}'
        ),
        'vertical': 'SURVEY',
        'category': 'SURVEY',
        'categories': ['SURVEY'],
        'status': 'active',
        'network': 'Pepperwahl',
        'partner_id': pw_survey_id,
        'target_url': survey_link,     # direct link stored for reference
        'preview_url': survey_link,
        'payout': float(inbox.get('payout', 0)),
        'currency': 'USD',
        'payout_type': 'fixed',
        'incentive_type': 'Incent',
        'offer_type': 'CPA',
        'countries': [country] if country else [],
        'allowed_countries': [country] if country else [],
        'tags': ['pepperwahl', 'survey', 'pre-screening'],
        'keywords': ['survey', 'pepperwahl', topic.lower()],
        # Link back to the survey for the gateway
        'pepperwahl_survey_id': pw_survey_id,
        'moustache_survey_id': ml_survey_id,
        'source': 'pepperwahl',
        'is_active': True,
        'updated_at': now,
        'offer_source': 'pepperwahl',
        # Tracking fields
        'hits': 0 if not existing_offer_id else None,
        'affiliates': 'all',
        'access_type': 'public',
        'is_public': True,
        'tracking_protocol': 's2s',
        'click_expiration': 7,
        'conversion_window': 30,
    }
    # Don't set hits to None on update
    if existing_offer_id and offer_fields.get('hits') is None:
        del offer_fields['hits']

    if existing_offer_id:
        try:
            _offers_col().update_one(
                {'offer_id': existing_offer_id},
                {'$set': offer_fields},
            )
            ml_offer_id = existing_offer_id
            offer_action = 'updated'
        except Exception as e:
            logger.error(f'Offer update failed: {e}')
            existing_offer_id = None

    if not existing_offer_id:
        offer_id = _next_offer_id()
        offer_fields['offer_id'] = offer_id
        offer_fields['campaign_id'] = f'PW-{pw_survey_id}'
        offer_fields['created_by'] = 'pepperwahl'
        offer_fields['created_at'] = now
        offer_fields['hits'] = 0
        _offers_col().insert_one(offer_fields)
        ml_offer_id = offer_id
        offer_action = 'created'

    # Auto-assign the survey to the offer in survey_assignments
    try:
        assignments_col = db_instance.get_collection('survey_assignments')
        assignments_col.update_one(
            {'offer_id': ml_offer_id},
            {'$set': {
                'offer_id': ml_offer_id,
                'survey_id': ml_survey_id,
                'assigned_by': 'pepperwahl_auto',
                'assignment_type': 'pepperwahl',
                'assigned_at': now,
            }},
            upsert=True,
        )
    except Exception as e:
        logger.warning(f'Survey assignment upsert failed: {e}')

    # ── Update inbox entry ─────────────────────────────────────────────────────
    _inbox_col().update_one(
        {'_id': ObjectId(inbox_id)},
        {'$set': {
            'status': 'processed',
            'processed_at': now,
            'moustache_survey_id': ml_survey_id,
            'moustache_offer_id': ml_offer_id,
            'survey_action': survey_action,
            'offer_action': offer_action,
        }},
    )

    return True, 'Processed successfully', {
        'moustache_survey_id': ml_survey_id,
        'moustache_offer_id': ml_offer_id,
        'survey_action': survey_action,
        'offer_action': offer_action,
    }


# ═════════════════════════════════════════════════════════════════════════════
# EXTERNAL ENDPOINT — Pepperwahl calls this
# ═════════════════════════════════════════════════════════════════════════════

@pepperwahl_integration_bp.route('/api/external/pepperwahl/publish', methods=['POST'])
def pepperwahl_publish():
    """
    Pepperwahl calls this endpoint when clicking "Publish to Moustache".

    Required headers:
        X-API-Key: <shared secret>

    Body (JSON):
    {
        "survey_id": "PW-10245",
        "survey_name": "Home Renovation Survey",
        "survey_link": "https://survey.pepperwahl.com/s/PW-10245",
        "questions": [
            {
                "question": "Are you a homeowner?",
                "options": ["Yes", "No"],
                "qualify_if": ["Yes"]
            }
        ],
        "country": "US",          (optional)
        "loi_minutes": 10,        (optional)
        "topic": "Home Renovation" (optional)
    }
    """
    if not _verify_api_key():
        return jsonify({'success': False, 'error': 'Unauthorized — invalid API key'}), 401

    data = request.get_json(silent=True)
    if not data:
        return jsonify({'success': False, 'error': 'JSON body required'}), 400

    errors = _validate_payload(data)
    if errors:
        return jsonify({'success': False, 'errors': errors}), 422

    pw_survey_id = data['survey_id']
    now = datetime.utcnow()

    # Check for existing pending entry for this survey_id (idempotent)
    existing = _inbox_col().find_one({
        'payload.survey_id': pw_survey_id,
        'status': {'$in': ['pending', 'processed', 'active']},
    })

    if existing:
        # Re-publish → update inbox entry and re-process
        _inbox_col().update_one(
            {'_id': existing['_id']},
            {'$set': {
                'payload': data,
                'status': 'pending',
                'received_at': now,
                'resubmitted_at': now,
            }},
        )
        inbox_id = str(existing['_id'])
        is_update = True
    else:
        result = _inbox_col().insert_one({
            'payload': data,
            'status': 'pending',
            'received_at': now,
            'moustache_survey_id': None,
            'moustache_offer_id': None,
            'payout': 0,
            'source_ip': request.headers.get('X-Forwarded-For', request.remote_addr),
        })
        inbox_id = str(result.inserted_id)
        is_update = False

    # Auto-process immediately
    success, message, detail = _process_inbox_entry(inbox_id)

    if not success:
        return jsonify({'success': False, 'error': message}), 500

    status_word = 'updated' if is_update else 'published'
    return jsonify({
        'success': True,
        'source_survey_id': pw_survey_id,
        'moustache_survey_id': detail.get('moustache_survey_id'),
        'moustache_offer_id': detail.get('moustache_offer_id'),
        'status': status_word,
        'message': f'Pre-screening survey {status_word} successfully on Moustache Leads',
    }), 200 if is_update else 201


# ═════════════════════════════════════════════════════════════════════════════
# ADMIN — INBOX LIST
# ═════════════════════════════════════════════════════════════════════════════

@pepperwahl_integration_bp.route('/api/admin/pepperwahl/inbox', methods=['GET'])
@_admin_guard
def inbox_list():
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    status_filter = request.args.get('status')
    search = request.args.get('search', '')

    query = {}
    if status_filter:
        query['status'] = status_filter
    if search:
        query['$or'] = [
            {'payload.survey_id': {'$regex': search, '$options': 'i'}},
            {'payload.survey_name': {'$regex': search, '$options': 'i'}},
            {'payload.topic': {'$regex': search, '$options': 'i'}},
        ]

    total = _inbox_col().count_documents(query)
    docs = list(
        _inbox_col()
        .find(query)
        .sort('received_at', -1)
        .skip((page - 1) * per_page)
        .limit(per_page)
    )

    # Enrich each entry with offer details
    enriched = []
    for doc in docs:
        doc = _serial(doc)
        offer_id = doc.get('moustache_offer_id')
        if offer_id:
            offer = _offers_col().find_one({'offer_id': offer_id}, {
                'name': 1, 'status': 1, 'payout': 1, 'hits': 1, 'vertical': 1,
            })
            if offer:
                doc['offer_details'] = {
                    'name': offer.get('name'),
                    'status': offer.get('status'),
                    'payout': offer.get('payout', 0),
                    'hits': offer.get('hits', 0),
                }
        enriched.append(doc)

    return jsonify({'success': True, 'inbox': enriched, 'total': total, 'page': page})


# ═════════════════════════════════════════════════════════════════════════════
# ADMIN — SINGLE INBOX ENTRY
# ═════════════════════════════════════════════════════════════════════════════

@pepperwahl_integration_bp.route('/api/admin/pepperwahl/inbox/<inbox_id>', methods=['GET'])
@_admin_guard
def inbox_detail(inbox_id):
    try:
        doc = _inbox_col().find_one({'_id': ObjectId(inbox_id)})
    except Exception:
        return jsonify({'success': False, 'error': 'Invalid ID'}), 400

    if not doc:
        return jsonify({'success': False, 'error': 'Not found'}), 404

    doc = _serial(doc)

    # Attach full survey + offer data
    if doc.get('moustache_survey_id'):
        try:
            survey = _surveys_col().find_one({'_id': ObjectId(doc['moustache_survey_id'])})
            if survey:
                survey['_id'] = str(survey['_id'])
                doc['survey'] = survey
        except Exception:
            pass

    if doc.get('moustache_offer_id'):
        offer = _offers_col().find_one({'offer_id': doc['moustache_offer_id']})
        if offer:
            offer['_id'] = str(offer.get('_id', ''))
            doc['offer'] = offer

    return jsonify({'success': True, 'entry': doc})


# ═════════════════════════════════════════════════════════════════════════════
# ADMIN — MANUALLY (RE-)PROCESS AN INBOX ENTRY
# ═════════════════════════════════════════════════════════════════════════════

@pepperwahl_integration_bp.route('/api/admin/pepperwahl/process/<inbox_id>', methods=['POST'])
@_admin_guard
def inbox_process(inbox_id):
    try:
        ObjectId(inbox_id)
    except Exception:
        return jsonify({'success': False, 'error': 'Invalid ID'}), 400

    success, message, detail = _process_inbox_entry(inbox_id)
    if not success:
        return jsonify({'success': False, 'error': message}), 400

    return jsonify({'success': True, 'message': message, **detail})


# ═════════════════════════════════════════════════════════════════════════════
# ADMIN — UPDATE PAYOUT
# ═════════════════════════════════════════════════════════════════════════════

@pepperwahl_integration_bp.route('/api/admin/pepperwahl/inbox/<inbox_id>/payout', methods=['PUT'])
@_admin_guard
def inbox_set_payout(inbox_id):
    data = request.get_json(silent=True) or {}
    payout = data.get('payout')
    if payout is None:
        return jsonify({'success': False, 'error': 'payout is required'}), 400
    try:
        payout = float(payout)
        if payout < 0:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({'success': False, 'error': 'payout must be a non-negative number'}), 400

    try:
        doc = _inbox_col().find_one({'_id': ObjectId(inbox_id)})
    except Exception:
        return jsonify({'success': False, 'error': 'Invalid ID'}), 400

    if not doc:
        return jsonify({'success': False, 'error': 'Not found'}), 404

    # Update inbox payout record
    _inbox_col().update_one(
        {'_id': ObjectId(inbox_id)},
        {'$set': {'payout': payout, 'payout_updated_at': datetime.utcnow()}},
    )

    # Also update the linked offer's payout
    offer_id = doc.get('moustache_offer_id')
    if offer_id:
        _offers_col().update_one(
            {'offer_id': offer_id},
            {'$set': {'payout': payout, 'updated_at': datetime.utcnow()}},
        )

    return jsonify({'success': True, 'message': f'Payout set to ${payout}', 'payout': payout})


# ═════════════════════════════════════════════════════════════════════════════
# ADMIN — TOGGLE STATUS (activate / pause)
# ═════════════════════════════════════════════════════════════════════════════

@pepperwahl_integration_bp.route('/api/admin/pepperwahl/inbox/<inbox_id>/status', methods=['PUT'])
@_admin_guard
def inbox_set_status(inbox_id):
    data = request.get_json(silent=True) or {}
    new_status = data.get('status')  # 'active' | 'paused'
    if new_status not in ('active', 'paused'):
        return jsonify({'success': False, 'error': "status must be 'active' or 'paused'"}), 400

    try:
        doc = _inbox_col().find_one({'_id': ObjectId(inbox_id)})
    except Exception:
        return jsonify({'success': False, 'error': 'Invalid ID'}), 400

    if not doc:
        return jsonify({'success': False, 'error': 'Not found'}), 404

    _inbox_col().update_one(
        {'_id': ObjectId(inbox_id)},
        {'$set': {'status': new_status, 'status_updated_at': datetime.utcnow()}},
    )

    offer_id = doc.get('moustache_offer_id')
    if offer_id:
        offer_status = 'active' if new_status == 'active' else 'paused'
        _offers_col().update_one(
            {'offer_id': offer_id},
            {'$set': {'status': offer_status, 'updated_at': datetime.utcnow()}},
        )

    survey_id = doc.get('moustache_survey_id')
    if survey_id:
        try:
            _surveys_col().update_one(
                {'_id': ObjectId(survey_id)},
                {'$set': {'is_active': new_status == 'active', 'updated_at': datetime.utcnow()}},
            )
        except Exception:
            pass

    return jsonify({'success': True, 'message': f'Survey {"activated" if new_status == "active" else "paused"}', 'status': new_status})


# ═════════════════════════════════════════════════════════════════════════════
# ADMIN — DELETE INBOX ENTRY (soft)
# ═════════════════════════════════════════════════════════════════════════════

@pepperwahl_integration_bp.route('/api/admin/pepperwahl/inbox/<inbox_id>', methods=['DELETE'])
@_admin_guard
def inbox_delete(inbox_id):
    try:
        doc = _inbox_col().find_one({'_id': ObjectId(inbox_id)})
    except Exception:
        return jsonify({'success': False, 'error': 'Invalid ID'}), 400

    if not doc:
        return jsonify({'success': False, 'error': 'Not found'}), 404

    _inbox_col().update_one(
        {'_id': ObjectId(inbox_id)},
        {'$set': {'status': 'deleted', 'deleted_at': datetime.utcnow()}},
    )
    return jsonify({'success': True, 'message': 'Entry removed from inbox'})


# ═════════════════════════════════════════════════════════════════════════════
# ADMIN — STATS SUMMARY
# ═════════════════════════════════════════════════════════════════════════════

@pepperwahl_integration_bp.route('/api/admin/pepperwahl/stats', methods=['GET'])
@_admin_guard
def inbox_stats():
    pipeline = [
        {'$match': {'status': {'$ne': 'deleted'}}},
        {'$group': {'_id': '$status', 'count': {'$sum': 1}}},
    ]
    results = list(_inbox_col().aggregate(pipeline))
    counts = {r['_id']: r['count'] for r in results}
    total = sum(counts.values())

    # Active offers payout sum
    active_offers = list(_offers_col().find(
        {'source': 'pepperwahl', 'status': 'active'},
        {'payout': 1},
    ))
    total_payout = sum(float(o.get('payout', 0)) for o in active_offers)

    return jsonify({
        'success': True,
        'stats': {
            'total': total,
            'pending': counts.get('pending', 0),
            'processed': counts.get('processed', 0),
            'active': counts.get('active', 0),
            'paused': counts.get('paused', 0),
            'active_offers': len(active_offers),
            'total_payout_exposure': round(total_payout, 2),
        },
    })
