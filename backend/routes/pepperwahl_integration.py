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
def _funnels_col():
    return db_instance.get_collection('survey_funnels')


def _generate_funnel_id():
    import secrets
    return f"SF-{secrets.token_hex(4).upper()}"


def _process_inbox_entry(inbox_id: str):
    """
    Read an inbox entry, create/update a Survey Funnel + Offer, mark as processed.

    Correct flow:
    1. Build a Survey Funnel (survey_funnels collection) from Pepperwahl's questions.
       - Each question becomes a funnel step with pass_criteria using qualify_if.
       - pass_url on the final step = Pepperwahl's survey_link (redirect on qualify).
    2. Create an Offer (offers collection) whose target_url = Moustache funnel URL
       (survey.moustacheleads.com/funnel/<funnel_id>).
       The Pepperwahl link is NEVER the offer target_url — it is only stored internally
       as the funnel's redirect destination.
    3. Link offer → funnel via linked_offer_id / source_funnel_id.

    Returns (success: bool, message: str, detail: dict)
    """
    inbox = _inbox_col().find_one({'_id': ObjectId(inbox_id)})
    if not inbox:
        return False, 'Inbox entry not found', {}

    payload = inbox.get('payload', {})
    pw_survey_id = payload.get('survey_id', '')
    survey_name = payload.get('survey_name', 'Pepperwahl Survey')
    survey_link = payload.get('survey_link', '')   # Pepperwahl destination — used as pass_url
    questions = payload.get('questions', [])
    country = payload.get('country', '')
    loi = payload.get('loi_minutes')
    topic = payload.get('topic', survey_name)

    # ── Map all incoming fields ───────────────────────────────────────────────
    payout      = float(payload.get('payout_usd') or payload.get('payout') or inbox.get('payout') or 0)
    description = payload.get('description', '')
    survey_type = payload.get('survey_type', '')   # e.g. product_interest, consumer_research
    min_age     = payload.get('min_age')
    max_age     = payload.get('max_age')

    # Normalise country — WW / empty means worldwide (no geo restriction)
    if not country or country.upper() in ('WW', 'WORLDWIDE', 'ALL', 'GLOBAL'):
        country = ''

    now = datetime.utcnow()

    # ── Check for existing processed entry for this pw_survey_id (update flow) ──
    existing_inbox = _inbox_col().find_one({
        'payload.survey_id': pw_survey_id,
        'status': {'$in': ['processed', 'active', 'paused']},
        '_id': {'$ne': ObjectId(inbox_id)},
    })

    existing_funnel_id = inbox.get('moustache_funnel_id') or (existing_inbox or {}).get('moustache_funnel_id')
    existing_offer_id  = inbox.get('moustache_offer_id')  or (existing_inbox or {}).get('moustache_offer_id')

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 1 — Build Survey Funnel steps from Pepperwahl questions
    #
    # Each question from Pepperwahl becomes ONE funnel step with ONE question.
    # pass_criteria uses qualify_if answers.
    # The LAST step (or every step that qualifies) sets pass_url = survey_link.
    # ─────────────────────────────────────────────────────────────────────────
    funnel_steps = []
    for q in questions:
        qualify_if = q.get('qualify_if', q.get('options', []))
        funnel_steps.append({
            'survey_title': survey_name,
            'questions': [
                {
                    'text': q['question'],
                    'options': q.get('options', []),
                }
            ],
            'pass_criteria': {
                'mode': 'all',
                'rules': [
                    {
                        'question_index': 0,
                        'accepted_answers': qualify_if,
                    }
                ],
            },
            # On pass at this step → send user to Pepperwahl survey
            'pass_url': survey_link,
            'pass_message': 'You qualify! Taking you to the survey now...',
            'fail_message': "Sorry, you don't qualify for this survey.",
        })

    loi_text = f' ({loi} min)' if loi else ''
    country_text = f' [{country}]' if country else ''
    funnel_name = f'{survey_name}{country_text}{loi_text}'

    funnel_doc = {
        'name': funnel_name,
        'description': description or f'Auto-created from Pepperwahl survey {pw_survey_id}. Topic: {topic}.',
        'status': 'active',
        'placement': 'everywhere',
        'survey_template': 'modern-card',
        'questions_per_page': 1,
        'spinner_duration': 3,
        'survey_timeout': 5,
        'steps': funnel_steps,
        'fail_message': "Thank you for your time! Unfortunately you don't qualify for this survey.",
        'display_title': survey_name,
        'display_description': (
            description or
            f'Answer a few quick questions to see if you qualify.'
            f'{" Estimated time: " + str(loi) + " minutes." if loi else ""}'
        ),
        'display_payout': payout,
        'display_category': survey_type.upper() if survey_type else 'SURVEY',
        # Pepperwahl metadata
        'source': 'pepperwahl',
        'pepperwahl_survey_id': pw_survey_id,
        'pepperwahl_survey_type': survey_type,
        'pepperwahl_redirect_url': survey_link,   # stored for reference — NOT the offer URL
        'target_country': country,
        'countries': [country] if country else [],
        'loi_minutes': loi,
        'topic': topic,
        'min_age': min_age,
        'max_age': max_age,
        'updated_at': now,
        'stats': {'total_starts': 0, 'total_passes': 0, 'total_fails': 0},
    }

    # ── CREATE or UPDATE Survey Funnel ────────────────────────────────────────
    if existing_funnel_id:
        _funnels_col().update_one(
            {'funnel_id': existing_funnel_id},
            {'$set': funnel_doc},
        )
        ml_funnel_id = existing_funnel_id
        funnel_action = 'updated'
    else:
        ml_funnel_id = _generate_funnel_id()
        funnel_doc['funnel_id'] = ml_funnel_id
        funnel_doc['created_at'] = now
        funnel_doc['created_by'] = 'pepperwahl'
        _funnels_col().insert_one(funnel_doc)
        funnel_action = 'created'

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 2 — Create Offer whose target_url = Moustache funnel URL
    #
    # target_url = https://survey.moustacheleads.com/funnel/<funnel_id>
    # The Pepperwahl link is NEVER stored here — it lives inside the funnel step.
    # ─────────────────────────────────────────────────────────────────────────
    funnel_url = f'https://survey.moustacheleads.com/funnel/{ml_funnel_id}'

    offer_fields = {
        'name': 'YIS Survey',
        'description': description or funnel_doc['description'],
        'vertical': survey_type.upper() if survey_type else 'SURVEY',
        'category': survey_type.upper() if survey_type else 'SURVEY',
        'categories': [survey_type.upper() if survey_type else 'SURVEY'],
        'status': 'active',
        'network': 'Pepperwahl',
        'partner_id': pw_survey_id,
        'target_url': funnel_url,     # Moustache funnel URL
        'preview_url': '',            # intentionally blank — no external preview link
        'payout': payout,
        'currency': 'USD',
        'payout_type': 'CPA',
        'incentive_type': 'Incent',
        'offer_type': 'CPA',
        'countries': [country] if country else [],
        'allowed_countries': [country] if country else [],
        'tags': ['pepperwahl', 'survey', 'pre-screening'],
        'keywords': ['survey', 'pepperwahl', topic.lower() if topic else ''],
        'source': 'pepperwahl',
        'offer_source': 'pepperwahl',
        'is_survey_funnel': True,
        'source_funnel_id': ml_funnel_id,
        'pepperwahl_survey_id': pw_survey_id,
        'pepperwahl_survey_type': survey_type,
        'min_age': min_age,
        'max_age': max_age,
        'loi_minutes': loi,
        # Subwall automation — auto-mark as exclusive for Moustache Survey's sub-wall
        'subwall_exclusive': True,
        'show_in_offerwall': False,
        'is_active': True,
        'affiliates': 'all',
        'access_type': 'public',
        'is_public': True,
        'tracking_protocol': 's2s',
        'click_expiration': 7,
        'conversion_window': 30,
        'updated_at': now,
    }

    if existing_offer_id:
        # Remove hits from update so we don't reset click counter
        _offers_col().update_one(
            {'offer_id': existing_offer_id},
            {'$set': offer_fields},
        )
        ml_offer_id = existing_offer_id
        offer_action = 'updated'
    else:
        ml_offer_id = _next_offer_id()
        offer_fields['offer_id'] = ml_offer_id
        offer_fields['campaign_id'] = f'PW-{pw_survey_id}'
        offer_fields['created_by'] = 'pepperwahl'
        offer_fields['created_at'] = now
        offer_fields['hits'] = 0
        _offers_col().insert_one(offer_fields)
        offer_action = 'created'

    # ── Link offer → funnel ───────────────────────────────────────────────────
    _funnels_col().update_one(
        {'funnel_id': ml_funnel_id},
        {'$set': {'linked_offer_id': ml_offer_id}},
    )

    # ── Update inbox entry ────────────────────────────────────────────────────
    _inbox_col().update_one(
        {'_id': ObjectId(inbox_id)},
        {'$set': {
            'status': 'processed',
            'processed_at': now,
            'moustache_funnel_id': ml_funnel_id,
            'moustache_offer_id': ml_offer_id,
            'funnel_action': funnel_action,
            'offer_action': offer_action,
            'payout': payout,             # store resolved payout so UI shows correct value
            'moustache_survey_id': ml_funnel_id,
        }},
    )

    # ── Auto-add to Moustache Survey's sub-wall ───────────────────────────────
    try:
        from services.voqall_subwall_service import TARGET_SUBWALL_SLUG
        sub_walls_col = db_instance.get_collection('sub_walls')
        sub_wall = sub_walls_col.find_one({'slug': TARGET_SUBWALL_SLUG})
        if sub_wall:
            sub_walls_col.update_one(
                {'slug': TARGET_SUBWALL_SLUG},
                {'$addToSet': {'offer_ids': ml_offer_id},
                 '$set': {'updated_at': now}}
            )
            logger.info(f'Pepperwahl offer {ml_offer_id} added to sub-wall {TARGET_SUBWALL_SLUG}')
        else:
            logger.warning(f'Sub-wall {TARGET_SUBWALL_SLUG} not found — skipping sub-wall add')
    except Exception as e:
        logger.warning(f'Sub-wall auto-add failed (non-fatal): {e}')

    # ── Auto-send email notification if toggle is ON and this is a new offer ──
    if offer_action == 'created':
        try:
            import threading
            t = threading.Thread(
                target=_send_pepperwahl_offer_email,
                args=(ml_offer_id, ml_funnel_id, survey_name),
                daemon=True,
            )
            t.start()
        except Exception as e:
            logger.warning(f'Could not start email thread: {e}')

    return True, 'Processed successfully', {
        'moustache_funnel_id': ml_funnel_id,
        'moustache_survey_id': ml_funnel_id,   # backwards compat
        'moustache_offer_id': ml_offer_id,
        'funnel_url': funnel_url,
        'funnel_action': funnel_action,
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
            'payout': float(data.get('payout_usd') or data.get('payout') or 0),
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
        'moustache_funnel_id': detail.get('moustache_funnel_id'),
        'moustache_survey_id': detail.get('moustache_funnel_id'),  # backwards compat
        'moustache_offer_id': detail.get('moustache_offer_id'),
        'funnel_url': detail.get('funnel_url'),
        'status': status_word,
        'message': f'Pre-screening survey funnel {status_word} successfully on Moustache Leads',
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
# ADMIN — EMAIL SETTINGS  (toggle + template prefs)
# ═════════════════════════════════════════════════════════════════════════════

@pepperwahl_integration_bp.route('/api/admin/pepperwahl/email-settings', methods=['GET'])
@_admin_guard
def get_email_settings():
    """
    Returns the current Pepperwahl auto-email settings stored in `platform_settings`.
    If no settings exist yet, returns safe defaults (toggle OFF).
    """
    col = db_instance.get_collection('platform_settings')
    doc = col.find_one({'key': 'pepperwahl_email_settings'}) or {}
    settings = doc.get('value', {})
    return jsonify({
        'success': True,
        'settings': {
            'enabled': settings.get('enabled', False),
            'template_style': settings.get('template_style', 'table'),
            'payout_type': settings.get('payout_type', 'publisher'),
            'visible_fields': settings.get('visible_fields', ['name', 'payout', 'countries', 'category', 'image', 'offer_id']),
            'see_more_fields': settings.get('see_more_fields', []),
            'default_image': settings.get('default_image', ''),
            'payment_terms': settings.get('payment_terms', ''),
            'recipient_mode': settings.get('recipient_mode', 'all'),   # 'all' | 'include' | 'exclude'
            'recipient_ids': settings.get('recipient_ids', []),
            'custom_message': settings.get('custom_message', ''),
        }
    })


@pepperwahl_integration_bp.route('/api/admin/pepperwahl/email-settings', methods=['PUT'])
@_admin_guard
def save_email_settings():
    """Save Pepperwahl auto-email settings."""
    data = request.get_json(silent=True) or {}
    col = db_instance.get_collection('platform_settings')
    col.update_one(
        {'key': 'pepperwahl_email_settings'},
        {'$set': {
            'key': 'pepperwahl_email_settings',
            'value': {
                'enabled': bool(data.get('enabled', False)),
                'template_style': data.get('template_style', 'table'),
                'payout_type': data.get('payout_type', 'publisher'),
                'visible_fields': data.get('visible_fields', ['name', 'payout', 'countries', 'category', 'image', 'offer_id']),
                'see_more_fields': data.get('see_more_fields', []),
                'default_image': data.get('default_image', ''),
                'payment_terms': data.get('payment_terms', ''),
                'recipient_mode': data.get('recipient_mode', 'all'),
                'recipient_ids': data.get('recipient_ids', []),
                'custom_message': data.get('custom_message', ''),
            },
            'updated_at': datetime.utcnow(),
        }},
        upsert=True,
    )
    return jsonify({'success': True, 'message': 'Email settings saved'})


def _send_pepperwahl_offer_email(offer_id: str, funnel_id: str, survey_name: str):
    """
    Auto-send offer notification email when a new Pepperwahl survey is processed.
    Reads email settings from platform_settings, respects toggle and recipient filters.
    Uses the same generate_multi_offer_email_html template as the offer insights system.
    """
    try:
        col = db_instance.get_collection('platform_settings')
        settings_doc = col.find_one({'key': 'pepperwahl_email_settings'}) or {}
        settings = settings_doc.get('value', {})

        if not settings.get('enabled', False):
            logger.info(f'Pepperwahl email toggle is OFF — skipping email for {offer_id}')
            return

        # Load the offer for email content
        offer = _offers_col().find_one({'offer_id': offer_id})
        if not offer:
            logger.warning(f'Offer {offer_id} not found for email send')
            return

        payout_type = settings.get('payout_type', 'publisher')
        raw_payout = float(offer.get('payout', 0) or 0)
        display_payout = round(raw_payout * 0.8, 2) if payout_type == 'publisher' else raw_payout

        offer_data = {
            'name': offer.get('name', survey_name),
            'payout': display_payout,
            'image_url': offer.get('image_url', settings.get('default_image', '')),
            'category': offer.get('category', 'SURVEY'),
            'offer_id': offer_id,
            'countries': ', '.join(offer.get('countries', [])),
            'metric_value': 0,
            'metric_label': 'New Survey',
        }

        template = {
            'title': 'New Survey Available',
            'subtitle': '',
            'cta_text': 'View Survey Offer',
            'highlight_label': 'Category',
            'color': '#8b5cf6',
        }

        custom_message = settings.get('custom_message', '')

        # Build recipient list
        users_col = db_instance.get_collection('users')
        recipient_mode = settings.get('recipient_mode', 'all')
        recipient_ids = settings.get('recipient_ids', [])

        if recipient_mode == 'all':
            users = list(users_col.find(
                {'role': {'$nin': ['admin', 'superadmin']}, 'email': {'$exists': True}},
                {'_id': 1, 'username': 1, 'email': 1}
            ))
        elif recipient_mode == 'include':
            from bson import ObjectId as _ObjId
            oids = []
            for rid in recipient_ids:
                try: oids.append(_ObjId(rid))
                except: pass
            users = list(users_col.find({'_id': {'$in': oids}}, {'_id': 1, 'username': 1, 'email': 1}))
        elif recipient_mode == 'exclude':
            from bson import ObjectId as _ObjId
            oids = []
            for rid in recipient_ids:
                try: oids.append(_ObjId(rid))
                except: pass
            users = list(users_col.find(
                {'_id': {'$nin': oids}, 'role': {'$nin': ['admin', 'superadmin']}, 'email': {'$exists': True}},
                {'_id': 1, 'username': 1, 'email': 1}
            ))
        else:
            users = []

        if not users:
            logger.info(f'No recipients for Pepperwahl email ({recipient_mode})')
            return

        # Import the email generator from offer_insights
        from routes.offer_insights_email import generate_multi_offer_email_html
        from services.email_verification_service import EmailVerificationService
        email_svc = EmailVerificationService()

        subject = f'🔔 New Survey Offer: {offer.get("name", survey_name)}'
        sent = 0
        failed = 0

        for user in users:
            try:
                html = generate_multi_offer_email_html(
                    template=template,
                    offers=[offer_data],
                    partner_name=user.get('username', 'Partner'),
                    custom_message=custom_message,
                )
                ok = email_svc._send_email(user.get('email'), subject, html)
                if ok: sent += 1
                else: failed += 1
            except Exception as e:
                logger.error(f'Email send failed for {user.get("email")}: {e}')
                failed += 1

        # Log the campaign
        db_instance.get_collection('insight_email_logs').insert_one({
            'type': 'pepperwahl_auto',
            'offer_id': offer_id,
            'offer_name': offer.get('name', survey_name),
            'funnel_id': funnel_id,
            'sent_count': sent,
            'failed_count': failed,
            'recipient_mode': recipient_mode,
            'sent_by': 'pepperwahl_auto',
            'status': 'sent',
            'created_at': datetime.utcnow(),
        })
        logger.info(f'Pepperwahl auto-email: {sent} sent, {failed} failed for offer {offer_id}')

    except Exception as e:
        logger.error(f'_send_pepperwahl_offer_email error: {e}', exc_info=True)


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
