"""
Redirect Receiver Routes
Browser-facing redirect endpoints for survey completion outcomes.

These are given to survey partners (e.g. Voqall) as "Redirection URLs" — 
the respondent's browser lands here after completing/terminating a survey.

They ONLY show a page to the user and log the redirect event.
They do NOT process conversions or create payouts — that is handled
by the separate S2S postback endpoints (/postback/{key}/{event}).

URL format:
  https://postback.moustacheleads.com/redirect/{unique_key}/complete
  https://postback.moustacheleads.com/redirect/{unique_key}/overquota
  https://postback.moustacheleads.com/redirect/{unique_key}/terminate
  https://postback.moustacheleads.com/redirect/{unique_key}/security
"""

from flask import Blueprint, request
from datetime import datetime
import logging
import hashlib
import hmac
import os
from urllib.parse import urlunparse, urlencode, parse_qs, urlparse
from jinja2 import Template

redirect_receiver_bp = Blueprint('redirect_receiver', __name__)
logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# Reuse the same animated page template style from postback_receiver.py
# ──────────────────────────────────────────────────────────────────────────────
REDIRECT_PAGE_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ title }} - Moustache Leads</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #09090b;
            color: #fff;
            overflow: hidden;
        }
        .bg-glow {
            position: fixed;
            width: 500px; height: 500px;
            border-radius: 50%;
            filter: blur(150px);
            opacity: 0.12;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            background: {{ color }};
            animation: breathe 5s ease-in-out infinite;
        }
        .bg-glow-2 {
            position: fixed;
            width: 300px; height: 300px;
            border-radius: 50%;
            filter: blur(100px);
            opacity: 0.08;
            top: 30%; left: 30%;
            background: {{ color }};
            animation: drift 8s ease-in-out infinite;
        }
        @keyframes breathe {
            0%, 100% { opacity: 0.1; transform: translate(-50%, -50%) scale(1); }
            50%       { opacity: 0.18; transform: translate(-50%, -50%) scale(1.15); }
        }
        @keyframes drift {
            0%, 100% { transform: translate(0, 0); }
            50%       { transform: translate(40px, -30px); }
        }
        @keyframes fadeUp {
            from { opacity: 0; transform: translateY(25px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.5); }
            to   { opacity: 1; transform: scale(1); }
        }
        @keyframes drawCircle {
            from { stroke-dashoffset: 166; }
            to   { stroke-dashoffset: 0; }
        }
        @keyframes drawCheck {
            from { stroke-dashoffset: 80; }
            to   { stroke-dashoffset: 0; }
        }
        .container {
            text-align: center;
            padding: 2rem;
            max-width: 460px;
            width: 100%;
            position: relative;
            z-index: 1;
        }
        .anim-icon {
            width: 100px; height: 100px;
            margin: 0 auto 2rem;
            animation: scaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.2s both;
        }
        .anim-icon svg { width: 100%; height: 100%; }
        .anim-icon .circle {
            fill: none;
            stroke: {{ color }};
            stroke-width: 3;
            stroke-dasharray: 166;
            stroke-dashoffset: 166;
            animation: drawCircle 0.8s ease 0.3s forwards;
        }
        .anim-icon .icon-path {
            fill: none;
            stroke: {{ color }};
            stroke-width: 3;
            stroke-linecap: round;
            stroke-linejoin: round;
            stroke-dasharray: 80;
            stroke-dashoffset: 80;
            animation: drawCheck 0.6s ease 0.9s forwards;
        }
        .status-badge {
            display: inline-block;
            padding: 0.4rem 1.2rem;
            border-radius: 100px;
            font-size: 0.65rem;
            font-weight: 600;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            background: {{ color }}15;
            color: {{ color }};
            border: 1px solid {{ color }}30;
            margin-bottom: 1.5rem;
            animation: fadeUp 0.5s ease 0.6s both;
        }
        h1 {
            font-size: 1.8rem;
            font-weight: 800;
            margin-bottom: 1rem;
            color: #fafafa;
            animation: fadeUp 0.5s ease 0.7s both;
        }
        p {
            font-size: 0.9rem;
            color: #71717a;
            line-height: 1.8;
            max-width: 380px;
            margin: 0 auto;
            animation: fadeUp 0.5s ease 0.8s both;
        }
        .footer {
            position: fixed;
            bottom: 2rem; left: 0; right: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.7rem;
            font-size: 0.9rem;
            color: #e4e4e7;
            animation: fadeUp 0.5s ease 1.2s both;
        }
        .footer img {
            width: 36px; height: 36px;
            border-radius: 8px;
            filter: drop-shadow(0 0 12px rgba(255,255,255,0.4)) drop-shadow(0 0 24px rgba(139,92,246,0.5));
            animation: logoGlow 3s ease-in-out infinite;
        }
        @keyframes logoGlow {
            0%, 100% { filter: drop-shadow(0 0 8px rgba(255,255,255,0.3)) drop-shadow(0 0 16px rgba(139,92,246,0.4)); }
            50%       { filter: drop-shadow(0 0 14px rgba(255,255,255,0.5)) drop-shadow(0 0 28px rgba(139,92,246,0.7)); }
        }
    </style>
</head>
<body>
    <div class="bg-glow"></div>
    <div class="bg-glow-2"></div>
    <div class="container">
        <div class="anim-icon">{{ icon_svg|safe }}</div>
        <div class="status-badge">{{ badge }}</div>
        <h1>{{ title }}</h1>
        <p>{{ subtitle }}</p>
    </div>
    <div class="footer">
        <img src="https://moustacheleads.com/logo.png" alt="Moustache Leads" />
        Powered by Moustache Leads
    </div>
</body>
</html>"""

# ──────────────────────────────────────────────────────────────────────────────
# Event type → page content mapping
# ──────────────────────────────────────────────────────────────────────────────
EVENT_CONFIGS = {
    'complete': {
        'title': 'Survey Completed',
        'badge': 'Completed',
        'subtitle': 'Thank you for completing the survey. Your response has been recorded successfully.',
        'color': '#22c55e',
        'icon_svg': '''<svg viewBox="0 0 52 52">
            <circle class="circle" cx="26" cy="26" r="25"/>
            <path class="icon-path" d="M14 27l8 8 16-16"/>
        </svg>''',
    },
    'overquota': {
        'title': 'Quota Full',
        'badge': 'Quota Full',
        'subtitle': 'This survey has reached its response quota. Thank you for your interest.',
        'color': '#f59e0b',
        'icon_svg': '''<svg viewBox="0 0 52 52">
            <circle class="circle" cx="26" cy="26" r="25"/>
            <path class="icon-path" d="M26 16v12M26 34v2"/>
        </svg>''',
    },
    'terminate': {
        'title': 'Survey Ended',
        'badge': 'Not Qualified',
        'subtitle': "You didn't qualify for this survey at this time. Thank you for your participation.",
        'color': '#ef4444',
        'icon_svg': '''<svg viewBox="0 0 52 52">
            <circle class="circle" cx="26" cy="26" r="25"/>
            <path class="icon-path" d="M18 18l16 16M34 18L18 34"/>
        </svg>''',
    },
    'security': {
        'title': 'Security Check',
        'badge': 'Security Terminate',
        'subtitle': 'Your session was flagged for a security review. Please try again later.',
        'color': '#8b5cf6',
        'icon_svg': '''<svg viewBox="0 0 52 52">
            <circle class="circle" cx="26" cy="26" r="25"/>
            <path class="icon-path" d="M20 24v-4a6 6 0 0 1 12 0v4M18 24h16v12H18z"/>
        </svg>''',
    },
}

# Aliases so both spellings work
EVENT_ALIASES = {
    'quota_full': 'overquota',
    'quotafull': 'overquota',
    'terminated': 'terminate',
    'security_terminate': 'security',
    'security_term': 'security',
    'success': 'complete',
    'completed': 'complete',
}


def _get_db_collection(name):
    try:
        from database import db_instance
        if not db_instance.is_connected():
            return None
        return db_instance.get_collection(name)
    except Exception:
        return None


def _render_page(event_type: str) -> str:
    """Render the animated HTML page for the given event type."""
    canonical = EVENT_ALIASES.get(event_type, event_type)
    cfg = EVENT_CONFIGS.get(canonical, EVENT_CONFIGS['complete'])
    tmpl = Template(REDIRECT_PAGE_TEMPLATE)
    return tmpl.render(**cfg)


def _log_redirect(unique_key: str, event_type: str, partner_name: str, partner_id: str):
    """Store a lightweight redirect log — no conversion processing."""
    try:
        col = _get_db_collection('redirect_logs')
        if col is None:
            return
        params = dict(request.args)
        col.insert_one({
            'unique_key': unique_key,
            'partner_id': partner_id,
            'partner_name': partner_name,
            'event_type': event_type,
            'query_params': params,
            'ip_address': request.headers.get('X-Forwarded-For', request.remote_addr),
            'user_agent': request.headers.get('User-Agent', ''),
            'timestamp': datetime.utcnow(),
            'source': 'browser_redirect',
        })
    except Exception as e:
        logger.warning(f"⚠️ redirect_receiver: failed to log redirect — {e}")


# ──────────────────────────────────────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────────────────────────────────────

@redirect_receiver_bp.route('/redirect/<unique_key>/<event_type>', methods=['GET'])
def receive_redirect(unique_key: str, event_type: str):
    """
    Browser redirect endpoint for survey outcomes.

    Partners (e.g. Voqall) send the respondent's browser here after the survey.
    We show an animated status page — no conversion is created here.
    Conversions are handled by the S2S /postback/{key}/{event} endpoint.
    """
    logger.info(f"🔀 REDIRECT received: key={unique_key}, event={event_type}")

    # ── Voqall OutgoingEncryption hash verification ───────────────────────────
    # Voqall appends ?hash=<SHA256> to the redirect URL when OutgoingEncryption
    # is enabled on the supplier account.  We must verify it to avoid accepting
    # tampered/spoofed redirects.
    #
    # Algorithm (from Voqall docs):
    #   1. Take the full redirect URL *without* the &hash=... parameter
    #   2. Compute SHA256(url_without_hash)
    #   3. Compare to the received hash value
    #
    # Key: OutgoingEncryption.EncryptionKey from /supplier-account API
    # ─────────────────────────────────────────────────────────────────────────
    received_hash = request.args.get('hash', '')
    voqall_enc_key = os.environ.get('VOQALL_OUTGOING_ENCRYPTION_KEY', '')

    if received_hash and voqall_enc_key:
        # Reconstruct URL without the hash param
        parsed = urlparse(request.url)
        qs = parse_qs(parsed.query, keep_blank_values=True)
        qs.pop('hash', None)
        # Rebuild query string preserving original param order (best-effort)
        clean_query = '&'.join(
            f"{k}={v[0]}" for k, v in qs.items()
        )
        url_without_hash = urlunparse((
            parsed.scheme, parsed.netloc, parsed.path,
            parsed.params, clean_query, ''
        ))

        expected_hash = hashlib.sha256(url_without_hash.encode('utf-8')).hexdigest()

        if not hmac.compare_digest(expected_hash, received_hash.lower()):
            logger.warning(
                f"⚠️ Voqall hash mismatch on redirect key={unique_key} event={event_type} "
                f"expected={expected_hash[:16]}... received={received_hash[:16]}..."
            )
            # Still show the page — don't expose internal errors to the browser —
            # but log it so we can investigate
        else:
            logger.info(f"✅ Voqall hash verified for key={unique_key} event={event_type}")
    elif received_hash and not voqall_enc_key:
        logger.warning(
            f"⚠️ Voqall sent hash param but VOQALL_OUTGOING_ENCRYPTION_KEY is not set — "
            f"skipping verification. Add key to .env to enable."
        )

    # Resolve partner (best-effort — page still shown even if key unknown)
    partner_name = 'Unknown'
    partner_id = f'redirect_{unique_key[:8]}'
    try:
        col = _get_db_collection('partners')
        if col is not None:
            partner = col.find_one({'unique_postback_key': unique_key})
            if partner:
                partner_name = partner.get('partner_name', 'Unknown')
                partner_id = partner.get('partner_id', partner_id)
            else:
                logger.warning(f"⚠️ redirect_receiver: unknown key {unique_key}")
    except Exception as e:
        logger.warning(f"⚠️ redirect_receiver: DB lookup failed — {e}")

    # Log the redirect (non-blocking)
    _log_redirect(unique_key, event_type, partner_name, partner_id)

    # Render and return the page
    html = _render_page(event_type)
    return html, 200, {'Content-Type': 'text/html; charset=utf-8'}


# ──────────────────────────────────────────────────────────────────────────────
# Admin API — Redirect Logs
# ──────────────────────────────────────────────────────────────────────────────

from utils.auth import token_required

def _admin_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        user = getattr(request, 'current_user', None)
        if not user or user.get('role') not in ('admin', 'subadmin'):
            from flask import jsonify
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated


@redirect_receiver_bp.route('/api/admin/redirect-logs', methods=['GET'])
@token_required
@_admin_required
def get_redirect_logs():
    """Return paginated redirect logs for the admin UI."""
    from flask import jsonify
    try:
        col = _get_db_collection('redirect_logs')
        if col is None:
            return jsonify({'error': 'Database not connected'}), 503

        limit  = min(int(request.args.get('limit', 50)), 200)
        skip   = int(request.args.get('skip', 0))
        partner_id = request.args.get('partner_id', '')
        event_type = request.args.get('event_type', '')

        query = {}
        if partner_id:
            query['partner_id'] = partner_id
        if event_type:
            query['event_type'] = event_type

        logs  = list(col.find(query).sort('timestamp', -1).skip(skip).limit(limit))
        total = col.count_documents(query)

        for log in logs:
            log['_id'] = str(log['_id'])
            if log.get('timestamp'):
                log['timestamp'] = log['timestamp'].isoformat() + 'Z'

        return jsonify({'logs': logs, 'total': total, 'limit': limit, 'skip': skip}), 200
    except Exception as e:
        logger.error(f'Error fetching redirect logs: {e}')
        return jsonify({'error': str(e)}), 500
