"""
Super Admin Support Panel — Backend Routes
Handles: Staff Chat, Smart Questions, Offer Check, Quick Links,
         Submitted Data (Intake Sessions), Activity Log, Team Permissions, Settings
"""

from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from bson import ObjectId
import logging
import re

from database import db_instance
from utils.auth import token_required, admin_only_required, admin_required

logger = logging.getLogger(__name__)

superadmin_support_bp = Blueprint('superadmin_support', __name__)


# ─── helpers ──────────────────────────────────────────────────────────────────

def _users():
    return db_instance.get_collection('users')

def _col(name):
    return db_instance.get_collection(name)

def _now():
    return datetime.utcnow()

def _sid(v):
    return str(v['_id']) if isinstance(v, dict) else str(v)

def _log_action(actor_id, actor_name, actor_role, action, details='', ticket_id=None):
    """Append an entry to support_activity_log."""
    try:
        _col('support_activity_log').insert_one({
            'actor_id': str(actor_id),
            'actor_name': actor_name,
            'actor_role': actor_role,
            'action': action,
            'details': details,
            'ticket_id': str(ticket_id) if ticket_id else None,
            'created_at': _now(),
        })
    except Exception as e:
        logger.warning(f'Activity log write failed: {e}')


# ══════════════════════════════════════════════════════════════════════════════
# STAFF CHAT
# ══════════════════════════════════════════════════════════════════════════════

@superadmin_support_bp.route('/api/superadmin/staff-chat/threads', methods=['GET'])
@token_required
@admin_only_required
def get_staff_threads():
    """All subadmins with their last staff-chat message."""
    try:
        users_col = _users()

        # Find all users who have a subadmin_permissions entry (covers role mismatches)
        perm_docs = list(_col('subadmin_permissions').find({}, {'user_id': 1}))
        perm_user_ids = [p['user_id'] for p in perm_docs]

        # Also include users with role=subadmin directly
        role_subadmins = list(users_col.find({'role': 'subadmin'}, {'_id': 1}))
        role_ids = [str(u['_id']) for u in role_subadmins]

        all_ids = list(set(perm_user_ids + role_ids))

        # Fetch user details
        from bson import ObjectId as ObjId
        valid_oids = []
        for uid in all_ids:
            try:
                valid_oids.append(ObjId(uid))
            except Exception:
                pass

        subadmins = list(users_col.find(
            {'_id': {'$in': valid_oids}},
            {'_id': 1, 'username': 1, 'email': 1, 'last_active_at': 1}
        ))

        admin = request.current_user
        admin_id = str(admin['_id'])

        threads = []
        for sa in subadmins:
            sa_id = str(sa['_id'])
            if sa_id == admin_id:
                continue  # skip self
            thread_id = '_'.join(sorted([admin_id, sa_id]))
            last_msg = _col('staff_chat_messages').find_one(
                {'thread_id': thread_id},
                sort=[('created_at', -1)]
            )
            unread = _col('staff_chat_messages').count_documents({
                'thread_id': thread_id,
                'sender_id': sa_id,
                'seen': False,
            })
            threads.append({
                'subadmin_id': sa_id,
                'username': sa.get('username', ''),
                'email': sa.get('email', ''),
                'thread_id': thread_id,
                'last_message': last_msg.get('text', '') if last_msg else '',
                'last_at': last_msg['created_at'].isoformat() + 'Z' if last_msg else None,
                'unread': unread,
            })

        threads.sort(key=lambda t: t['last_at'] or '', reverse=True)
        return jsonify({'success': True, 'threads': threads})
    except Exception as e:
        logger.error(f'get_staff_threads: {e}')
        return jsonify({'error': str(e)}), 500


@superadmin_support_bp.route('/api/superadmin/staff-chat/<thread_id>/messages', methods=['GET'])
@token_required
@admin_only_required
def get_staff_messages(thread_id):
    """Messages in one staff chat thread."""
    try:
        msgs = list(_col('staff_chat_messages').find(
            {'thread_id': thread_id},
            sort=[('created_at', 1)]
        ))
        admin_id = str(request.current_user['_id'])
        # Mark messages sent by subadmin as seen
        _col('staff_chat_messages').update_many(
            {'thread_id': thread_id, 'sender_id': {'$ne': admin_id}, 'seen': False},
            {'$set': {'seen': True, 'seen_at': _now()}}
        )
        for m in msgs:
            m['_id'] = str(m['_id'])
        return jsonify({'success': True, 'messages': msgs})
    except Exception as e:
        logger.error(f'get_staff_messages: {e}')
        return jsonify({'error': str(e)}), 500


@superadmin_support_bp.route('/api/superadmin/staff-chat/<thread_id>/messages', methods=['POST'])
@token_required
@admin_only_required
def send_staff_message(thread_id):
    """Send a message in a staff chat thread."""
    try:
        admin = request.current_user
        data = request.get_json() or {}
        text = (data.get('text') or '').strip()
        if not text:
            return jsonify({'error': 'text is required'}), 400

        doc = {
            'thread_id': thread_id,
            'sender_id': str(admin['_id']),
            'sender_name': admin.get('username', 'Admin'),
            'sender_role': 'admin',
            'text': text,
            'seen': False,
            'seen_at': None,
            'created_at': _now(),
        }
        result = _col('staff_chat_messages').insert_one(doc)
        doc['_id'] = str(result.inserted_id)
        doc['created_at'] = doc['created_at'].isoformat() + 'Z'
        return jsonify({'success': True, 'message': doc}), 201
    except Exception as e:
        logger.error(f'send_staff_message: {e}')
        return jsonify({'error': str(e)}), 500


# Subadmin can also read/send in their own threads
@superadmin_support_bp.route('/api/staff-chat/my-thread/messages', methods=['GET'])
@token_required
def subadmin_get_my_messages():
    """Subadmin reads their own staff chat thread with Super Admin."""
    user = request.current_user
    if user.get('role') not in ('subadmin', 'admin'):
        return jsonify({'error': 'Not allowed'}), 403
    try:
        # Find admin user
        admin_user = _users().find_one({'role': 'admin'}, {'_id': 1})
        if not admin_user:
            return jsonify({'success': True, 'messages': []})
        admin_id = str(admin_user['_id'])
        user_id = str(user['_id'])
        thread_id = '_'.join(sorted([admin_id, user_id]))
        msgs = list(_col('staff_chat_messages').find(
            {'thread_id': thread_id}, sort=[('created_at', 1)]
        ))
        # Mark admin messages as seen
        _col('staff_chat_messages').update_many(
            {'thread_id': thread_id, 'sender_id': admin_id, 'seen': False},
            {'$set': {'seen': True, 'seen_at': _now()}}
        )
        for m in msgs:
            m['_id'] = str(m['_id'])
        return jsonify({'success': True, 'messages': msgs, 'thread_id': thread_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@superadmin_support_bp.route('/api/staff-chat/my-thread/messages', methods=['POST'])
@token_required
def subadmin_send_message():
    """Subadmin sends a message to Super Admin."""
    user = request.current_user
    if user.get('role') not in ('subadmin', 'admin'):
        return jsonify({'error': 'Not allowed'}), 403
    try:
        admin_user = _users().find_one({'role': 'admin'}, {'_id': 1})
        if not admin_user:
            return jsonify({'error': 'No admin found'}), 404
        admin_id = str(admin_user['_id'])
        user_id = str(user['_id'])
        thread_id = '_'.join(sorted([admin_id, user_id]))
        data = request.get_json() or {}
        text = (data.get('text') or '').strip()
        if not text:
            return jsonify({'error': 'text is required'}), 400
        doc = {
            'thread_id': thread_id,
            'sender_id': user_id,
            'sender_name': user.get('username', 'Subadmin'),
            'sender_role': user.get('role', 'subadmin'),
            'text': text,
            'seen': False,
            'seen_at': None,
            'created_at': _now(),
        }
        result = _col('staff_chat_messages').insert_one(doc)
        doc['_id'] = str(result.inserted_id)
        doc['created_at'] = doc['created_at'].isoformat() + 'Z'
        return jsonify({'success': True, 'message': doc}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ══════════════════════════════════════════════════════════════════════════════
# SMART QUESTIONS
# ══════════════════════════════════════════════════════════════════════════════

@superadmin_support_bp.route('/api/superadmin/smart-questions', methods=['GET'])
@token_required
@admin_only_required
def list_sq_publishers():
    """List all Smart Question publisher configs."""
    try:
        search = request.args.get('q', '').strip()
        query = {}
        if search:
            query = {'$or': [
                {'name': {'$regex': re.escape(search), '$options': 'i'}},
                {'email': {'$regex': re.escape(search), '$options': 'i'}},
                {'website': {'$regex': re.escape(search), '$options': 'i'}},
            ]}
        configs = list(_col('smart_question_configs').find(query, sort=[('name', 1)]))
        for c in configs:
            c['_id'] = str(c['_id'])
            ready = sum(1 for q in c.get('questions', []) if q.get('status') == 'ready')
            refine = sum(1 for q in c.get('questions', []) if q.get('status') == 'refine')
            c['ready_count'] = ready
            c['refine_count'] = refine
            c['total'] = len(c.get('questions', []))
            # Check if publisher email matches a real user
            u = _users().find_one({'email': c.get('email', '').lower()}, {'_id': 1})
            c['user_exists'] = u is not None
        return jsonify({'success': True, 'configs': configs})
    except Exception as e:
        logger.error(f'list_sq_publishers: {e}')
        return jsonify({'error': str(e)}), 500


@superadmin_support_bp.route('/api/superadmin/smart-questions', methods=['POST'])
@token_required
@admin_only_required
def create_sq_publisher():
    """Create a new Smart Question publisher config."""
    try:
        admin = request.current_user
        data = request.get_json() or {}
        email = (data.get('email') or '').strip().lower()
        name = (data.get('name') or '').strip()
        website = (data.get('website') or '').strip()
        raw_notes = (data.get('raw_notes') or '').strip()

        if not email:
            return jsonify({'error': 'email is required'}), 400

        if _col('smart_question_configs').find_one({'email': email}):
            return jsonify({'error': 'Publisher with this email already exists'}), 409

        # Auto-generate questions from raw_notes (one per non-empty line)
        questions = []
        if raw_notes:
            for i, line in enumerate(raw_notes.splitlines()):
                line = line.strip()
                if line:
                    questions.append({
                        '_id': str(ObjectId()),
                        'raw_note': line,
                        'question_text': '',
                        'answer_type': 'text',
                        'options': [],
                        'status': 'refine',
                        'order': i,
                    })

        doc = {
            'name': name,
            'email': email,
            'website': website,
            'enabled': True,
            'delay_seconds': 120,
            'questions': questions,
            'created_by': str(admin['_id']),
            'created_at': _now(),
            'updated_at': _now(),
        }
        result = _col('smart_question_configs').insert_one(doc)
        doc['_id'] = str(result.inserted_id)
        doc['created_at'] = doc['created_at'].isoformat() + 'Z'
        _log_action(admin['_id'], admin.get('username', 'Admin'), 'admin', 'Smart Questions config created', f'{name} ({email})')
        return jsonify({'success': True, 'config': doc}), 201
    except Exception as e:
        logger.error(f'create_sq_publisher: {e}')
        return jsonify({'error': str(e)}), 500


@superadmin_support_bp.route('/api/superadmin/smart-questions/<config_id>', methods=['GET'])
@token_required
@admin_only_required
def get_sq_publisher(config_id):
    """Get one Smart Question publisher config."""
    try:
        doc = _col('smart_question_configs').find_one({'_id': ObjectId(config_id)})
        if not doc:
            return jsonify({'error': 'Not found'}), 404
        doc['_id'] = str(doc['_id'])
        u = _users().find_one({'email': doc.get('email', '').lower()}, {'_id': 1})
        doc['user_exists'] = u is not None
        return jsonify({'success': True, 'config': doc})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@superadmin_support_bp.route('/api/superadmin/smart-questions/<config_id>', methods=['PUT'])
@token_required
@admin_only_required
def update_sq_publisher(config_id):
    """Update publisher config meta (name, email, website, enabled, delay)."""
    try:
        data = request.get_json() or {}
        allowed = ['name', 'email', 'website', 'enabled', 'delay_seconds']
        update = {k: data[k] for k in allowed if k in data}
        update['updated_at'] = _now()
        result = _col('smart_question_configs').update_one(
            {'_id': ObjectId(config_id)}, {'$set': update}
        )
        if result.matched_count == 0:
            return jsonify({'error': 'Not found'}), 404
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@superadmin_support_bp.route('/api/superadmin/smart-questions/<config_id>', methods=['DELETE'])
@token_required
@admin_only_required
def delete_sq_publisher(config_id):
    """Delete a Smart Question publisher config."""
    try:
        admin = request.current_user
        result = _col('smart_question_configs').delete_one({'_id': ObjectId(config_id)})
        if result.deleted_count == 0:
            return jsonify({'error': 'Not found'}), 404
        _log_action(admin['_id'], admin.get('username', 'Admin'), 'admin', 'Smart Questions config deleted', config_id)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@superadmin_support_bp.route('/api/superadmin/smart-questions/<config_id>/questions', methods=['POST'])
@token_required
@admin_only_required
def add_sq_question(config_id):
    """Add a question to a Smart Question config."""
    try:
        data = request.get_json() or {}
        doc = _col('smart_question_configs').find_one({'_id': ObjectId(config_id)}, {'questions': 1})
        if not doc:
            return jsonify({'error': 'Not found'}), 404

        question = {
            '_id': str(ObjectId()),
            'raw_note': (data.get('raw_note') or '').strip(),
            'question_text': (data.get('question_text') or '').strip(),
            'answer_type': data.get('answer_type', 'text'),
            'options': data.get('options', []),
            'status': 'ready' if data.get('question_text', '').strip() else 'refine',
            'order': len(doc.get('questions', [])),
        }
        _col('smart_question_configs').update_one(
            {'_id': ObjectId(config_id)},
            {'$push': {'questions': question}, '$set': {'updated_at': _now()}}
        )
        return jsonify({'success': True, 'question': question}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@superadmin_support_bp.route('/api/superadmin/smart-questions/<config_id>/questions/<q_id>', methods=['PUT'])
@token_required
@admin_only_required
def update_sq_question(config_id, q_id):
    """Update a question in a Smart Question config."""
    try:
        data = request.get_json() or {}
        set_fields = {}
        for field in ['raw_note', 'question_text', 'answer_type', 'options', 'status']:
            if field in data:
                set_fields[f'questions.$.{field}'] = data[field]
        # Auto-set status based on question_text if not explicitly provided
        if 'question_text' in data and 'status' not in data:
            set_fields['questions.$.status'] = 'ready' if data['question_text'].strip() else 'refine'
        set_fields['updated_at'] = _now()

        result = _col('smart_question_configs').update_one(
            {'_id': ObjectId(config_id), 'questions._id': q_id},
            {'$set': set_fields}
        )
        if result.matched_count == 0:
            return jsonify({'error': 'Not found'}), 404
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@superadmin_support_bp.route('/api/superadmin/smart-questions/<config_id>/questions/<q_id>', methods=['DELETE'])
@token_required
@admin_only_required
def delete_sq_question(config_id, q_id):
    """Delete a question from a Smart Question config."""
    try:
        result = _col('smart_question_configs').update_one(
            {'_id': ObjectId(config_id)},
            {'$pull': {'questions': {'_id': q_id}}, '$set': {'updated_at': _now()}}
        )
        if result.matched_count == 0:
            return jsonify({'error': 'Not found'}), 404
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ══════════════════════════════════════════════════════════════════════════════
# OFFER CHECK
# ══════════════════════════════════════════════════════════════════════════════

@superadmin_support_bp.route('/api/superadmin/offer-check', methods=['POST'])
@token_required
@admin_only_required
def offer_check():
    """
    Full offer intelligence: paste an offer name or ID and get complete
    click history, conversion history, publisher breakdown, GEO breakdown,
    placement breakdown, and summary stats.
    """
    try:
        admin = request.current_user
        data = request.get_json() or {}
        raw_text = (data.get('text') or '').strip()

        if not raw_text:
            return jsonify({'error': 'text is required'}), 400

        offers_col = _col('offers')

        # ── Parse the pasted text into search terms ───────────────────────
        lines = [l.strip() for l in raw_text.splitlines() if l.strip()]
        cleaned = []
        for line in lines:
            line = re.sub(r'^\s*[\d]+[\.\)\-]\s*', '', line)
            line = re.sub(r'^\s*[•\*\-\–]\s*', '', line)
            line = re.sub(r'[\U0001F1E0-\U0001F1FF]', '', line)
            line = re.sub(r'\[.*?\]|\(.*?\)', '', line)
            line = re.sub(r'\$[\d\.]+', '', line)
            line = re.sub(r'\b(CPE|CPA|CPI|CPC|CPL|CPS)\b', '', line, flags=re.IGNORECASE)
            line = line.strip()
            if line:
                cleaned.append(line)

        has_numbers = any(re.match(r'^\d+[\.\)]', l) for l in lines)
        has_flags = any(re.search(r'[\U0001F1E0-\U0001F1FF]', l) for l in lines)
        detected_format = 'tabular' if '\t' in raw_text else \
                          'numbered-list' if has_numbers else \
                          'flag-list' if has_flags else 'free-form-list'
        rows_read = len(cleaned)

        results = []
        missing = []

        for search_term in cleaned:
            if not search_term:
                continue

            # ── Find the offer ────────────────────────────────────────────
            offer = None
            if re.match(r'^ML-\d+$', search_term.upper()):
                offer = offers_col.find_one({'offer_id': search_term.upper(), 'deleted': {'$ne': True}})
            if not offer:
                offer = offers_col.find_one({
                    'name': {'$regex': re.escape(search_term), '$options': 'i'},
                    'deleted': {'$ne': True}
                })

            if not offer:
                missing.append({'searched_term': search_term})
                continue

            offer_id = offer.get('offer_id', '')
            offer_name = offer.get('name', '')

            # ── Click stats ───────────────────────────────────────────────
            # offerwall_clicks (offerwall embed) — uses offer_id (ML-#####) or offer_name
            ow_clicks = list(_col('offerwall_clicks').find(
                {'$or': [{'offer_id': offer_id}, {'offer_name': offer_name}]},
                {'click_id': 1, 'publisher_id': 1, 'user_id': 1, 'geo': 1,
                 'device': 1, 'timestamp': 1, 'fraud_score': 1, 'placement_id': 1}
            ).sort('timestamp', -1).limit(200))

            # dashboard clicks — uses camelCase offerId field
            dash_clicks = list(_col('clicks').find(
                {'$or': [
                    {'offerId': offer_id},
                    {'offerName': offer_name},
                ]},
                {'userId': 1, 'placementId': 1, 'userIp': 1, 'timestamp': 1, 'createdAt': 1, 'offerId': 1, 'offerName': 1}
            ).sort('createdAt', -1).limit(200))

            total_clicks = len(ow_clicks) + len(dash_clicks)

            # ── Conversion stats ──────────────────────────────────────────
            campaign_id_str = str(offer.get('campaign_id', ''))
            conv_query = {'$or': [{'offer_id': offer_id}]}
            if campaign_id_str:
                conv_query['$or'].append({'campaign_id': campaign_id_str})
            conversions = list(_col('conversions').find(
                conv_query,
                {'conversion_id': 1, 'click_id': 1, 'payout': 1, 'country': 1,
                 'country_code': 1, 'device_type': 1, 'status': 1, 'username': 1,
                 'publisher_id': 1, 'conversion_time': 1, 'partner_name': 1,
                 'source': 1, 'verified': 1}
            ).sort('conversion_time', -1).limit(200))

            total_conversions = len(conversions)
            total_revenue = sum(float(c.get('payout', 0) or 0) for c in conversions)

            # ── Forwarded postbacks (publisher payouts) ───────────────────
            fp_query = {'$or': [{'offer_id': offer_id}, {'offer_name': offer_name}]}
            fwd_postbacks = list(_col('forwarded_postbacks').find(
                fp_query,
                {'publisher_name': 1, 'username': 1, 'publisher_id': 1,
                 'points': 1, 'placement_title': 1, 'placement_id': 1,
                 'country': 1, 'timestamp': 1, 'forward_status': 1}
            ).sort('timestamp', -1).limit(200))

            # ── Publisher breakdown ───────────────────────────────────────
            pub_map: dict = {}
            for fp in fwd_postbacks:
                pub = fp.get('username') or fp.get('publisher_name') or fp.get('publisher_id', 'Unknown')
                if pub not in pub_map:
                    pub_map[pub] = {'publisher': pub, 'conversions': 0, 'revenue': 0.0, 'placements': set()}
                pub_map[pub]['conversions'] += 1
                pub_map[pub]['revenue'] += float(fp.get('points', 0) or 0)
                if fp.get('placement_title'):
                    pub_map[pub]['placements'].add(fp['placement_title'])
            # Also count from conversions
            for c in conversions:
                pub = c.get('username') or c.get('publisher_id', 'Unknown')
                if pub and pub not in pub_map:
                    pub_map[pub] = {'publisher': pub, 'conversions': 0, 'revenue': 0.0, 'placements': set()}
                if pub:
                    pub_map[pub]['conversions'] += 1
                    pub_map[pub]['revenue'] += float(c.get('payout', 0) or 0)

            publishers_breakdown = sorted([
                {**v, 'placements': list(v['placements'])}
                for v in pub_map.values()
            ], key=lambda x: x['conversions'], reverse=True)[:20]

            # ── GEO breakdown ─────────────────────────────────────────────
            geo_map: dict = {}
            for c in conversions:
                geo = c.get('country_code') or c.get('country') or 'Unknown'
                geo_map[geo] = geo_map.get(geo, 0) + 1
            for oc in ow_clicks:
                geo = oc.get('geo', 'Unknown')
                if geo not in geo_map:
                    geo_map[geo] = 0
            geo_breakdown = sorted(
                [{'country': k, 'count': v} for k, v in geo_map.items()],
                key=lambda x: x['count'], reverse=True
            )[:15]

            # ── Recent conversions (last 20) ──────────────────────────────
            recent_conversions = []
            for c in conversions[:20]:
                ts = c.get('conversion_time')
                recent_conversions.append({
                    'conversion_id': c.get('conversion_id', ''),
                    'click_id': c.get('click_id', ''),
                    'publisher': c.get('username') or c.get('publisher_id', ''),
                    'payout': float(c.get('payout', 0) or 0),
                    'country': c.get('country_code') or c.get('country', ''),
                    'device': c.get('device_type', ''),
                    'status': c.get('status', ''),
                    'verified': c.get('verified', False),
                    'source': c.get('source', ''),
                    'time': ts.isoformat() + 'Z' if hasattr(ts, 'isoformat') else str(ts or ''),
                })

            # ── Recent clicks (last 20) ───────────────────────────────────
            recent_clicks = []
            for oc in ow_clicks[:20]:
                ts = oc.get('timestamp')
                recent_clicks.append({
                    'click_id': oc.get('click_id', ''),
                    'publisher_id': oc.get('publisher_id', ''),
                    'geo': oc.get('geo', ''),
                    'device': oc.get('device', ''),
                    'fraud_score': oc.get('fraud_score', 0),
                    'placement_id': oc.get('placement_id', ''),
                    'time': ts.isoformat() + 'Z' if hasattr(ts, 'isoformat') else str(ts or ''),
                })

            # ── CVR ───────────────────────────────────────────────────────
            cvr = round((total_conversions / total_clicks * 100), 2) if total_clicks > 0 else 0

            results.append({
                'searched_term': search_term,
                'offer_id': offer_id,
                'name': offer_name,
                'status': offer.get('status', 'unknown'),
                'payout': float(offer.get('payout', 0) or 0),
                'countries': offer.get('allowed_countries', offer.get('countries', [])),
                'vertical': offer.get('vertical', ''),
                'via': 'iframe' if offer.get('offerwall_exclusive') else 'direct',
                # Stats
                'total_clicks': total_clicks,
                'total_conversions': total_conversions,
                'total_revenue': round(total_revenue, 2),
                'cvr': cvr,
                # Breakdowns
                'publishers': publishers_breakdown,
                'geo_breakdown': geo_breakdown,
                'recent_conversions': recent_conversions,
                'recent_clicks': recent_clicks,
            })

        _log_action(
            admin['_id'], admin.get('username', 'Admin'), 'admin',
            'Offer Check run',
            f'{rows_read} rows, {detected_format}'
        )

        return jsonify({
            'success': True,
            'detected_format': detected_format,
            'rows_read': rows_read,
            'results': results,
            'missing': missing,
        })
    except Exception as e:
        logger.error(f'offer_check: {e}')
        return jsonify({'error': str(e)}), 500


# ══════════════════════════════════════════════════════════════════════════════
# QUICK LINKS  (canned replies are already in support_messages.py)
# ══════════════════════════════════════════════════════════════════════════════

@superadmin_support_bp.route('/api/superadmin/quick-links', methods=['GET'])
@token_required
@admin_required
def get_quick_links():
    try:
        links = list(_col('support_quick_links').find({}, sort=[('created_at', 1)]))
        for l in links:
            l['_id'] = str(l['_id'])
        return jsonify({'success': True, 'links': links})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@superadmin_support_bp.route('/api/superadmin/quick-links', methods=['POST'])
@token_required
@admin_only_required
def create_quick_link():
    try:
        admin = request.current_user
        data = request.get_json() or {}
        title = (data.get('title') or '').strip()
        url = (data.get('url') or '').strip()
        description = (data.get('description') or '').strip()
        if not title or not url:
            return jsonify({'error': 'title and url are required'}), 400
        doc = {
            'title': title, 'url': url, 'description': description,
            'created_by': admin.get('username', 'Admin'),
            'created_at': _now(),
        }
        result = _col('support_quick_links').insert_one(doc)
        doc['_id'] = str(result.inserted_id)
        doc['created_at'] = doc['created_at'].isoformat() + 'Z'
        return jsonify({'success': True, 'link': doc}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@superadmin_support_bp.route('/api/superadmin/quick-links/<link_id>', methods=['PUT'])
@token_required
@admin_only_required
def update_quick_link(link_id):
    try:
        data = request.get_json() or {}
        update = {k: data[k] for k in ['title', 'url', 'description'] if k in data}
        result = _col('support_quick_links').update_one({'_id': ObjectId(link_id)}, {'$set': update})
        if result.matched_count == 0:
            return jsonify({'error': 'Not found'}), 404
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@superadmin_support_bp.route('/api/superadmin/quick-links/<link_id>', methods=['DELETE'])
@token_required
@admin_only_required
def delete_quick_link(link_id):
    try:
        result = _col('support_quick_links').delete_one({'_id': ObjectId(link_id)})
        if result.deleted_count == 0:
            return jsonify({'error': 'Not found'}), 404
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ══════════════════════════════════════════════════════════════════════════════
# SUBMITTED DATA (Intake Sessions)
# ══════════════════════════════════════════════════════════════════════════════

@superadmin_support_bp.route('/api/superadmin/submitted-data', methods=['GET'])
@token_required
@admin_only_required
def get_submitted_data():
    """All intake sessions (submitted and abandoned)."""
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 50))
        topic = request.args.get('topic', '')
        status = request.args.get('status', '')
        search = request.args.get('q', '').strip()

        query = {}
        if topic:
            query['topic'] = topic
        if status:
            query['status'] = status
        if search:
            query['$or'] = [
                {'username': {'$regex': re.escape(search), '$options': 'i'}},
                {'email': {'$regex': re.escape(search), '$options': 'i'}},
                {'answers_text': {'$regex': re.escape(search), '$options': 'i'}},
            ]

        col = _col('intake_sessions')
        total = col.count_documents(query)
        sessions = list(col.find(query, sort=[('created_at', -1)])
                        .skip((page - 1) * limit).limit(limit))
        for s in sessions:
            s['_id'] = str(s['_id'])
        return jsonify({'success': True, 'sessions': sessions, 'total': total, 'page': page})
    except Exception as e:
        logger.error(f'get_submitted_data: {e}')
        return jsonify({'error': str(e)}), 500


@superadmin_support_bp.route('/api/support/intake-session', methods=['POST'])
@token_required
def save_intake_session():
    """
    Called by the frontend when a publisher completes or abandons the wizard.
    Payload: { topic, status, answers, abandoned_at_question }
    """
    try:
        user = request.current_user
        data = request.get_json() or {}
        topic = data.get('topic', 'other')
        status = data.get('status', 'abandoned')  # 'submitted' | 'abandoned'
        answers = data.get('answers', {})
        abandoned_at = data.get('abandoned_at_question', '')

        # Build a flat text for search
        answers_text = ' '.join(str(v) for v in answers.values())

        doc = {
            'user_id': str(user['_id']),
            'username': user.get('username', ''),
            'email': user.get('email', ''),
            'topic': topic,
            'status': status,
            'answers': answers,
            'answers_text': answers_text,
            'abandoned_at_question': abandoned_at,
            'created_at': _now(),
        }
        _col('intake_sessions').insert_one(doc)
        return jsonify({'success': True}), 201
    except Exception as e:
        logger.error(f'save_intake_session: {e}')
        return jsonify({'error': str(e)}), 500


# ══════════════════════════════════════════════════════════════════════════════
# SUPPORT ACTIVITY LOG
# ══════════════════════════════════════════════════════════════════════════════

@superadmin_support_bp.route('/api/superadmin/activity-log', methods=['GET'])
@token_required
@admin_only_required
def get_activity_log():
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 50))
        person = request.args.get('person', '')
        action = request.args.get('action', '')
        days = int(request.args.get('days', 7))
        search = request.args.get('q', '').strip()

        query = {'created_at': {'$gte': _now() - timedelta(days=days)}}
        if person:
            query['actor_name'] = {'$regex': re.escape(person), '$options': 'i'}
        if action:
            query['action'] = {'$regex': re.escape(action), '$options': 'i'}
        if search:
            query['details'] = {'$regex': re.escape(search), '$options': 'i'}

        col = _col('support_activity_log')
        total = col.count_documents(query)
        logs = list(col.find(query, sort=[('created_at', -1)])
                    .skip((page - 1) * limit).limit(limit))
        for l in logs:
            l['_id'] = str(l['_id'])
            if l.get('created_at'):
                l['created_at'] = l['created_at'].isoformat() + 'Z'
        return jsonify({'success': True, 'logs': logs, 'total': total})
    except Exception as e:
        logger.error(f'get_activity_log: {e}')
        return jsonify({'error': str(e)}), 500


# ══════════════════════════════════════════════════════════════════════════════
# TEAM PERMISSIONS
# ══════════════════════════════════════════════════════════════════════════════

# 7 support-specific permissions (separate from the tab-access permissions)
SUPPORT_PERMS = ['reply', 'close', 'flag', 'profile', 'notes', 'quick_links', 'all_tickets']


@superadmin_support_bp.route('/api/superadmin/team-permissions', methods=['GET'])
@token_required
@admin_only_required
def get_team_permissions():
    """All subadmins with their support permission toggles."""
    try:
        users_col = _users()

        # Same logic as staff threads — read from subadmin_permissions collection
        # to find ALL users who are treated as subadmins, regardless of role field
        perm_docs = list(_col('subadmin_permissions').find({}, {'user_id': 1}))
        perm_user_ids = [p['user_id'] for p in perm_docs]

        role_subadmins = list(users_col.find({'role': 'subadmin'}, {'_id': 1}))
        role_ids = [str(u['_id']) for u in role_subadmins]

        all_ids = list(set(perm_user_ids + role_ids))

        from bson import ObjectId as ObjId
        valid_oids = []
        for uid in all_ids:
            try:
                valid_oids.append(ObjId(uid))
            except Exception:
                pass

        subadmins = list(users_col.find(
            {'_id': {'$in': valid_oids}},
            {'_id': 1, 'username': 1, 'email': 1}
        ))

        result = []
        for sa in subadmins:
            sa_id = str(sa['_id'])
            perms_doc = _col('support_team_permissions').find_one({'user_id': sa_id})
            perms = perms_doc.get('permissions', {}) if perms_doc else {}
            normalized = {p: perms.get(p, True) for p in SUPPORT_PERMS}
            result.append({
                'user_id': sa_id,
                'username': sa.get('username', ''),
                'email': sa.get('email', ''),
                'permissions': normalized,
                'granted': sum(1 for v in normalized.values() if v),
                'total': len(SUPPORT_PERMS),
            })
        return jsonify({'success': True, 'team': result, 'permission_keys': SUPPORT_PERMS})
    except Exception as e:
        logger.error(f'get_team_permissions: {e}')
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        logger.error(f'get_team_permissions: {e}')
        return jsonify({'error': str(e)}), 500


@superadmin_support_bp.route('/api/superadmin/team-permissions/<user_id>', methods=['PUT'])
@token_required
@admin_only_required
def update_team_permission(user_id):
    """Toggle a specific permission for a subadmin."""
    try:
        admin = request.current_user
        data = request.get_json() or {}
        perm_key = data.get('key')
        perm_val = data.get('value')

        if perm_key not in SUPPORT_PERMS:
            return jsonify({'error': f'Invalid permission key: {perm_key}'}), 400
        if not isinstance(perm_val, bool):
            return jsonify({'error': 'value must be boolean'}), 400

        _col('support_team_permissions').update_one(
            {'user_id': user_id},
            {'$set': {f'permissions.{perm_key}': perm_val, 'updated_at': _now()}},
            upsert=True
        )
        _log_action(
            admin['_id'], admin.get('username', 'Admin'), 'admin',
            'Permission updated',
            f'{user_id}: {perm_key} = {perm_val}'
        )
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@superadmin_support_bp.route('/api/superadmin/team-permissions/<user_id>/all', methods=['PUT'])
@token_required
@admin_only_required
def update_all_team_permissions(user_id):
    """Set full permissions object for a subadmin at once."""
    try:
        data = request.get_json() or {}
        permissions = data.get('permissions', {})
        normalized = {p: bool(permissions.get(p, True)) for p in SUPPORT_PERMS}
        _col('support_team_permissions').update_one(
            {'user_id': user_id},
            {'$set': {'permissions': normalized, 'updated_at': _now()}},
            upsert=True
        )
        return jsonify({'success': True, 'permissions': normalized})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@superadmin_support_bp.route('/api/support/my-team-permissions', methods=['GET'])
@token_required
def get_my_support_permissions():
    """Subadmin fetches their own support permissions."""
    user = request.current_user
    if user.get('role') == 'admin':
        return jsonify({'success': True, 'permissions': {p: True for p in SUPPORT_PERMS}, 'is_admin': True})
    try:
        user_id = str(user['_id'])
        doc = _col('support_team_permissions').find_one({'user_id': user_id})
        perms = doc.get('permissions', {}) if doc else {}
        normalized = {p: perms.get(p, True) for p in SUPPORT_PERMS}
        return jsonify({'success': True, 'permissions': normalized, 'is_admin': False})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@superadmin_support_bp.route('/api/superadmin/team-permissions/add-admin', methods=['POST'])
@token_required
@admin_only_required
def add_subadmin():
    """
    Promote an existing user to subadmin and set default support permissions.
    The tab-level permissions (SubadminPermissions) are set via the existing
    /subadmins endpoint in admin_subadmin_management.py.
    This endpoint handles support-specific permission initialization.
    """
    try:
        admin = request.current_user
        data = request.get_json() or {}
        user_id = data.get('user_id', '').strip()
        if not user_id:
            return jsonify({'error': 'user_id is required'}), 400

        user = _users().find_one({'_id': ObjectId(user_id)})
        if not user:
            return jsonify({'error': 'User not found'}), 404
        if user.get('role') == 'admin':
            return jsonify({'error': 'Cannot modify an admin user'}), 400

        # Promote to subadmin
        _users().update_one({'_id': ObjectId(user_id)}, {'$set': {'role': 'subadmin'}})
        # Create default support permissions (all on)
        _col('support_team_permissions').update_one(
            {'user_id': user_id},
            {'$setOnInsert': {
                'user_id': user_id,
                'permissions': {p: True for p in SUPPORT_PERMS},
                'created_at': _now(),
                'updated_at': _now(),
            }},
            upsert=True
        )
        _log_action(admin['_id'], admin.get('username', 'Admin'), 'admin', 'Subadmin added', user.get('username', ''))
        return jsonify({'success': True, 'username': user.get('username', ''), 'user_id': user_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ══════════════════════════════════════════════════════════════════════════════
# SETTINGS
# ══════════════════════════════════════════════════════════════════════════════

DEFAULT_SETTINGS = {
    'auto_close_enabled': True,
    'auto_close_min': 1440,        # 24h
    'user_warn_min': 120,          # 2h
    'admin_warn_min': 120,         # 2h
    'smart_questions_enabled': True,
    'sq_delay_sec': 120,           # 2 min
}


@superadmin_support_bp.route('/api/superadmin/support-settings', methods=['GET'])
@token_required
@admin_only_required
def get_support_settings():
    try:
        doc = _col('support_settings').find_one({})
        if not doc:
            return jsonify({'success': True, 'settings': DEFAULT_SETTINGS})
        doc.pop('_id', None)
        # Fill missing keys with defaults
        for k, v in DEFAULT_SETTINGS.items():
            doc.setdefault(k, v)
        return jsonify({'success': True, 'settings': doc})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@superadmin_support_bp.route('/api/superadmin/support-settings', methods=['PUT'])
@token_required
@admin_only_required
def update_support_settings():
    try:
        admin = request.current_user
        data = request.get_json() or {}
        allowed = list(DEFAULT_SETTINGS.keys())
        update = {k: data[k] for k in allowed if k in data}
        update['updated_at'] = _now()
        _col('support_settings').update_one({}, {'$set': update}, upsert=True)
        _log_action(admin['_id'], admin.get('username', 'Admin'), 'admin', 'Support settings updated', str(update))
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ══════════════════════════════════════════════════════════════════════════════
# SUBADMIN-ACCESSIBLE ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

# ── Shared team notes (readable by all admins/subadmins, writable by all) ─────
@superadmin_support_bp.route('/api/support/shared-notes', methods=['GET'])
@token_required
def get_shared_notes():
    """All team notes — visible to all admins and subadmins."""
    user = request.current_user
    if user.get('role') not in ('admin', 'subadmin'):
        return jsonify({'error': 'Not allowed'}), 403
    try:
        notes = list(_col('support_shared_notes').find(
            {}, sort=[('created_at', -1)]
        ).limit(100))
        for n in notes:
            n['_id'] = str(n['_id'])
            if isinstance(n.get('created_at'), datetime):
                n['created_at'] = n['created_at'].isoformat() + 'Z'
        return jsonify({'success': True, 'notes': notes})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@superadmin_support_bp.route('/api/support/shared-notes', methods=['POST'])
@token_required
def add_shared_note():
    """Any admin/subadmin can add a shared team note."""
    user = request.current_user
    if user.get('role') not in ('admin', 'subadmin'):
        return jsonify({'error': 'Not allowed'}), 403
    try:
        data = request.get_json() or {}
        text = (data.get('text') or '').strip()
        if not text:
            return jsonify({'error': 'text is required'}), 400
        doc = {
            'text': text,
            'author_id': str(user['_id']),
            'author_name': user.get('username', 'Admin'),
            'author_role': user.get('role', 'subadmin'),
            'created_at': _now(),
        }
        result = _col('support_shared_notes').insert_one(doc)
        doc['_id'] = str(result.inserted_id)
        doc['created_at'] = doc['created_at'].isoformat() + 'Z'
        return jsonify({'success': True, 'note': doc}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@superadmin_support_bp.route('/api/support/shared-notes/<note_id>', methods=['DELETE'])
@token_required
def delete_shared_note(note_id):
    """Author or admin can delete a shared note."""
    user = request.current_user
    if user.get('role') not in ('admin', 'subadmin'):
        return jsonify({'error': 'Not allowed'}), 403
    try:
        note = _col('support_shared_notes').find_one({'_id': ObjectId(note_id)})
        if not note:
            return jsonify({'error': 'Not found'}), 404
        # Only author or admin can delete
        if user.get('role') != 'admin' and str(note.get('author_id')) != str(user['_id']):
            return jsonify({'error': 'Not allowed'}), 403
        _col('support_shared_notes').delete_one({'_id': ObjectId(note_id)})
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Subadmin: read Smart Questions (view-only) ─────────────────────────────────
@superadmin_support_bp.route('/api/support/smart-questions-view', methods=['GET'])
@token_required
def subadmin_view_smart_questions():
    """Subadmins can read Smart Question configs (view-only)."""
    user = request.current_user
    if user.get('role') not in ('admin', 'subadmin'):
        return jsonify({'error': 'Not allowed'}), 403
    try:
        configs = list(_col('smart_question_configs').find({}, sort=[('name', 1)]))
        for c in configs:
            c['_id'] = str(c['_id'])
            c['ready_count'] = sum(1 for q in c.get('questions', []) if q.get('status') == 'ready')
            c['total'] = len(c.get('questions', []))
        return jsonify({'success': True, 'configs': configs})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Subadmin: tickets assigned to me ──────────────────────────────────────────
@superadmin_support_bp.route('/api/support/my-assignments', methods=['GET'])
@token_required
def get_my_assignments():
    """Returns tickets assigned to the logged-in subadmin."""
    user = request.current_user
    if user.get('role') not in ('admin', 'subadmin'):
        return jsonify({'error': 'Not allowed'}), 403
    try:
        user_id = str(user['_id'])
        tickets = list(
            _col('support_messages').find(
                {'assignee_id': user_id, 'status': {'$ne': 'closed'}},
                sort=[('updated_at', -1)]
            )
        )
        from routes.support_messages import _serialize
        return jsonify({'success': True, 'tickets': [_serialize(t) for t in tickets]})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
