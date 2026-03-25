"""
Admin Activity Log Service
Lightweight helper to log admin actions from anywhere in the codebase.
Usage:
    from services.admin_activity_log_service import log_admin_activity
    log_admin_activity(
        action='offer_deleted',
        category='offer',
        admin_user=request.current_user,
        details={'offer_name': 'Test Offer', 'network': 'Adgate'},
        affected_items=[{'offer_id': '123', 'name': 'Test Offer'}],
        request_obj=request
    )
"""

import logging
import threading
from flask import request as flask_request

logger = logging.getLogger(__name__)

_log_model = None


def _get_model():
    global _log_model
    if _log_model is None:
        from models.admin_activity_log import AdminActivityLog
        _log_model = AdminActivityLog()
    return _log_model


def log_admin_activity(action, category, admin_user=None, details=None, affected_items=None, affected_count=None, request_obj=None, ip_address=''):
    """
    Fire-and-forget activity logger. Runs in a background thread so it never
    slows down the request.
    """
    admin_id = ''
    admin_username = 'system'

    if admin_user:
        admin_id = str(admin_user.get('_id', ''))
        admin_username = admin_user.get('username', admin_user.get('email', 'unknown'))

    if not ip_address and request_obj:
        try:
            ip_address = request_obj.headers.get('X-Forwarded-For', request_obj.remote_addr or '')
        except Exception:
            pass

    data = {
        'action': action,
        'category': category,
        'admin_id': admin_id,
        'admin_username': admin_username,
        'details': details or {},
        'affected_items': affected_items or [],
        'affected_count': affected_count if affected_count is not None else len(affected_items or []),
        'ip_address': ip_address,
    }

    def _write():
        try:
            _get_model().log_activity(data)
        except Exception as e:
            logger.error(f"Background activity log write failed: {e}")

    thread = threading.Thread(target=_write, daemon=True)
    thread.start()
