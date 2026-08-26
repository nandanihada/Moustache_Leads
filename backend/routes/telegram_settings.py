"""
Telegram Settings Admin API
GET  /api/admin/telegram/settings          — get current settings
PUT  /api/admin/telegram/settings          — save settings
POST /api/admin/telegram/send-now          — manual send
GET  /api/admin/telegram/preview           — preview next message
GET  /api/admin/telegram/history           — last N sends
"""
from flask import Blueprint, request, jsonify
from utils.auth import token_required, admin_required
from database import db_instance
from datetime import datetime
import logging
import os

telegram_settings_bp = Blueprint('telegram_settings', __name__)
logger = logging.getLogger(__name__)

SETTINGS_DOC_ID = 'main'

DEFAULT_SETTINGS = {
    'bot_token': '',
    'channel_id': '',
    'enabled': True,
    'interval_hours': 12,
    'offers_per_message': 7,
    'lookback_hours': 48,
    'content': {
        'show_payout': True,
        'show_pick_count': True,
        'show_country': True,
        'show_category': False,
        'show_tracking_link': False,
        'custom_header': '',
        'custom_footer': '',
    },
    'filters': {
        'min_payout': 0,
        'categories': [],          # empty = all
        'countries': [],           # empty = all
        'only_active': True,
    },
    'updated_at': None,
}


def _get_settings():
    col = db_instance.get_collection('telegram_settings')
    doc = col.find_one({'_id': SETTINGS_DOC_ID})
    if not doc:
        return dict(DEFAULT_SETTINGS)
    doc.pop('_id', None)
    # Back-fill missing keys with defaults
    for k, v in DEFAULT_SETTINGS.items():
        if k not in doc:
            doc[k] = v
        elif isinstance(v, dict):
            for kk, vv in v.items():
                if kk not in doc.get(k, {}):
                    doc.setdefault(k, {})[kk] = vv
    return doc


def _save_settings(data: dict):
    col = db_instance.get_collection('telegram_settings')
    data['updated_at'] = datetime.utcnow()
    col.update_one({'_id': SETTINGS_DOC_ID}, {'$set': data}, upsert=True)


# ── GET settings ──────────────────────────────────────────────────────────────
@telegram_settings_bp.route('/telegram/settings', methods=['GET'])
@token_required
@admin_required
def get_telegram_settings():
    try:
        s = _get_settings()
        # Show only whether credentials are set — never the actual values
        s['bot_token_set'] = bool(s.get('bot_token', '') or os.getenv('TELEGRAM_BOT_TOKEN', ''))
        s['channel_id_set'] = bool(s.get('channel_id', '') or os.getenv('TELEGRAM_CHANNEL_ID', ''))
        s.pop('bot_token', None)
        s.pop('channel_id', None)
        if s.get('updated_at') and hasattr(s['updated_at'], 'isoformat'):
            s['updated_at'] = s['updated_at'].isoformat() + 'Z'
        return jsonify({'success': True, 'settings': s}), 200
    except Exception as e:
        logger.error(f"get_telegram_settings error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


# ── PUT settings ──────────────────────────────────────────────────────────────
@telegram_settings_bp.route('/telegram/settings', methods=['PUT'])
@token_required
@admin_required
def save_telegram_settings():
    try:
        data = request.get_json() or {}
        current = _get_settings()

        # Bot token and channel_id come from env — not editable from UI
        current['enabled']          = bool(data.get('enabled', current['enabled']))
        current['interval_hours']   = max(1, min(168, int(data.get('interval_hours', current['interval_hours']))))
        current['offers_per_message'] = max(1, min(20, int(data.get('offers_per_message', current['offers_per_message']))))
        current['lookback_hours']   = max(1, min(720, int(data.get('lookback_hours', current['lookback_hours']))))

        # Content block
        c_in = data.get('content', {})
        c = current.setdefault('content', {})
        for key in ('show_payout', 'show_pick_count', 'show_country', 'show_category', 'show_tracking_link'):
            if key in c_in:
                c[key] = bool(c_in[key])
        if 'custom_header' in c_in:
            c['custom_header'] = str(c_in['custom_header'])[:500]
        if 'custom_footer' in c_in:
            c['custom_footer'] = str(c_in['custom_footer'])[:500]

        # Filters block
        f_in = data.get('filters', {})
        f = current.setdefault('filters', {})
        if 'min_payout' in f_in:
            f['min_payout'] = max(0, float(f_in['min_payout']))
        if 'categories' in f_in:
            f['categories'] = [str(x).upper().strip() for x in f_in['categories'] if x]
        if 'countries' in f_in:
            f['countries'] = [str(x).upper().strip() for x in f_in['countries'] if x]
        if 'only_active' in f_in:
            f['only_active'] = bool(f_in['only_active'])

        _save_settings(current)
        return jsonify({'success': True, 'message': 'Settings saved'}), 200
    except Exception as e:
        logger.error(f"save_telegram_settings error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


# ── POST manual send ──────────────────────────────────────────────────────────
@telegram_settings_bp.route('/telegram/send-now', methods=['POST'])
@token_required
@admin_required
def telegram_send_now():
    try:
        from services.telegram_trending_bot import send_trending_to_telegram, log_send_history
        success = send_trending_to_telegram()
        if success:
            log_send_history('manual', triggered_by=getattr(request, 'current_user', {}).get('email', 'admin'))
            return jsonify({'success': True, 'message': 'Message sent to Telegram channel'}), 200
        else:
            return jsonify({'success': False, 'error': 'Send failed — check bot token, channel ID, and whether there are recent offer picks'}), 400
    except Exception as e:
        logger.error(f"telegram_send_now error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


# ── GET preview ───────────────────────────────────────────────────────────────
@telegram_settings_bp.route('/telegram/preview', methods=['GET'])
@token_required
@admin_required
def telegram_preview():
    try:
        from services.telegram_trending_bot import get_trending_offers, format_trending_message
        s = _get_settings()
        offers = get_trending_offers(
            hours=s.get('lookback_hours', 48),
            limit=s.get('offers_per_message', 7),
            settings=s,
        )
        message = format_trending_message(offers, settings=s)
        return jsonify({
            'success': True,
            'preview': message or '(No offers found for the selected lookback window)',
            'offer_count': len(offers),
        }), 200
    except Exception as e:
        logger.error(f"telegram_preview error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


# ── GET send history ──────────────────────────────────────────────────────────
@telegram_settings_bp.route('/telegram/history', methods=['GET'])
@token_required
@admin_required
def telegram_history():
    try:
        limit = min(int(request.args.get('limit', 20)), 100)
        col = db_instance.get_collection('telegram_send_log')
        docs = list(col.find({}, {'_id': 0}).sort('sent_at', -1).limit(limit))
        for d in docs:
            if d.get('sent_at') and hasattr(d['sent_at'], 'isoformat'):
                d['sent_at'] = d['sent_at'].isoformat() + 'Z'
        return jsonify({'success': True, 'history': docs}), 200
    except Exception as e:
        logger.error(f"telegram_history error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500
