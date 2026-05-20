"""
Platform Settings Routes
Admin-controlled platform-wide configuration (e.g. search wizard toggles).
Stored in MongoDB collection 'platform_settings' as a single document with key='search_wizard'.
"""

from flask import Blueprint, request, jsonify
from database import db_instance
from utils.auth import token_required, admin_required
import logging

logger = logging.getLogger(__name__)

platform_settings_bp = Blueprint('platform_settings', __name__)

COLLECTION = 'platform_settings'

# Default search wizard config — all steps enabled
DEFAULT_SEARCH_WIZARD = {
    'vertical_enabled': True,
    'geo_enabled': True,
    'payout_enabled': True,
    'placement_enabled': True,
}


def _get_settings_col():
    db = db_instance.get_db()
    if db is None:
        return None
    return db[COLLECTION]


@platform_settings_bp.route('/api/admin/platform-settings/search-wizard', methods=['GET'])
@token_required
@admin_required
def get_search_wizard_settings():
    """Get current search wizard toggle settings (admin only)."""
    try:
        col = _get_settings_col()
        if col is None:
            return jsonify({**DEFAULT_SEARCH_WIZARD}), 200
        doc = col.find_one({'key': 'search_wizard'})
        if not doc:
            return jsonify({**DEFAULT_SEARCH_WIZARD}), 200
        return jsonify({
            'vertical_enabled': doc.get('vertical_enabled', True),
            'geo_enabled': doc.get('geo_enabled', True),
            'payout_enabled': doc.get('payout_enabled', True),
            'placement_enabled': doc.get('placement_enabled', True),
        }), 200
    except Exception as e:
        logger.error(f"Error fetching search wizard settings: {e}")
        return jsonify({'error': str(e)}), 500


@platform_settings_bp.route('/api/admin/platform-settings/search-wizard', methods=['PUT'])
@token_required
@admin_required
def update_search_wizard_settings():
    """Update search wizard toggle settings (admin only)."""
    try:
        data = request.get_json() or {}
        col = _get_settings_col()
        if col is None:
            return jsonify({'error': 'Database unavailable'}), 500

        update = {'key': 'search_wizard'}
        for field in ['vertical_enabled', 'geo_enabled', 'payout_enabled', 'placement_enabled']:
            if field in data:
                update[field] = bool(data[field])

        col.update_one({'key': 'search_wizard'}, {'$set': update}, upsert=True)
        logger.info(f"Search wizard settings updated: {update}")
        return jsonify({'success': True, 'message': 'Search wizard settings updated'}), 200
    except Exception as e:
        logger.error(f"Error updating search wizard settings: {e}")
        return jsonify({'error': str(e)}), 500


@platform_settings_bp.route('/api/platform-settings/search-wizard', methods=['GET'])
def get_search_wizard_settings_public():
    """Public endpoint — publishers need to know which wizard steps are enabled."""
    try:
        col = _get_settings_col()
        if col is None:
            return jsonify({**DEFAULT_SEARCH_WIZARD}), 200
        doc = col.find_one({'key': 'search_wizard'})
        if not doc:
            return jsonify({**DEFAULT_SEARCH_WIZARD}), 200
        return jsonify({
            'vertical_enabled': doc.get('vertical_enabled', True),
            'geo_enabled': doc.get('geo_enabled', True),
            'payout_enabled': doc.get('payout_enabled', True),
            'placement_enabled': doc.get('placement_enabled', True),
        }), 200
    except Exception as e:
        logger.error(f"Error fetching public search wizard settings: {e}")
        return jsonify({**DEFAULT_SEARCH_WIZARD}), 200

# ==========================================
# Review Us Settings
# ==========================================

DEFAULT_REVIEW_US = {
    'url': 'https://trustpilot.com/review/moustacheleads.com',
    'reward_fixed': 5.0,
    'reward_percentage': 10.0
}

@platform_settings_bp.route('/api/admin/platform-settings/review-us', methods=['GET'])
@token_required
@admin_required
def get_review_us_settings():
    """Get current Review Us settings (admin only)."""
    try:
        col = _get_settings_col()
        if col is None:
            return jsonify({**DEFAULT_REVIEW_US}), 200
        doc = col.find_one({'key': 'review_us'})
        if not doc:
            return jsonify({**DEFAULT_REVIEW_US}), 200
        return jsonify({
            'url': doc.get('url', DEFAULT_REVIEW_US['url']),
            'reward_fixed': doc.get('reward_fixed', DEFAULT_REVIEW_US['reward_fixed']),
            'reward_percentage': doc.get('reward_percentage', DEFAULT_REVIEW_US['reward_percentage'])
        }), 200
    except Exception as e:
        logger.error(f"Error fetching review us settings: {e}")
        return jsonify({'error': str(e)}), 500

@platform_settings_bp.route('/api/admin/platform-settings/review-us', methods=['PUT'])
@token_required
@admin_required
def update_review_us_settings():
    """Update Review Us settings (admin only)."""
    try:
        data = request.get_json() or {}
        col = _get_settings_col()
        if col is None:
            return jsonify({'error': 'Database unavailable'}), 500

        update = {
            'key': 'review_us',
            'url': data.get('url', '').strip(),
            'reward_fixed': float(data.get('reward_fixed', DEFAULT_REVIEW_US['reward_fixed'])),
            'reward_percentage': float(data.get('reward_percentage', DEFAULT_REVIEW_US['reward_percentage']))
        }

        col.update_one({'key': 'review_us'}, {'$set': update}, upsert=True)
        logger.info(f"Review Us settings updated: {update}")
        return jsonify({'success': True, 'message': 'Review Us URL updated successfully'}), 200
    except Exception as e:
        logger.error(f"Error updating review us settings: {e}")
        return jsonify({'error': str(e)}), 500

@platform_settings_bp.route('/api/platform-settings/review-us', methods=['GET'])
def get_review_us_settings_public():
    """Public endpoint for user dashboard to get the Review Us URL and reward config."""
    try:
        col = _get_settings_col()
        if col is None:
            return jsonify({**DEFAULT_REVIEW_US}), 200
        doc = col.find_one({'key': 'review_us'})
        if not doc:
            return jsonify({**DEFAULT_REVIEW_US}), 200
        return jsonify({
            'url': doc.get('url', DEFAULT_REVIEW_US['url']),
            'reward_fixed': doc.get('reward_fixed', DEFAULT_REVIEW_US['reward_fixed']),
            'reward_percentage': doc.get('reward_percentage', DEFAULT_REVIEW_US['reward_percentage'])
        }), 200
    except Exception as e:
        logger.error(f"Error fetching public review us settings: {e}")
        return jsonify({**DEFAULT_REVIEW_US}), 200
