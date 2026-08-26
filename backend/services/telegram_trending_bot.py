"""
Telegram Bot: Sends top-picked offers on a configurable schedule.
Config is stored in the `telegram_settings` MongoDB collection and is
fully manageable from the admin Telegram Settings panel.

Fallback: if no DB config exists, reads TELEGRAM_BOT_TOKEN / TELEGRAM_CHANNEL_ID
from environment variables for backward compatibility.
"""
import os
import sys
import logging
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load .env so os.getenv() works whether run standalone or imported by Flask
# override=True ensures .env values take precedence over stale OS env cache
from dotenv import load_dotenv
import pathlib
_env_path = pathlib.Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=_env_path, override=True)

from database import db_instance

logger = logging.getLogger(__name__)

FLAG_MAP = {
    'US': '🇺🇸', 'UK': '🇬🇧', 'GB': '🇬🇧', 'CA': '🇨🇦', 'AU': '🇦🇺',
    'DE': '🇩🇪', 'FR': '🇫🇷', 'IT': '🇮🇹', 'ES': '🇪🇸', 'BR': '🇧🇷',
    'IN': '🇮🇳', 'JP': '🇯🇵', 'KR': '🇰🇷', 'NL': '🇳🇱', 'BE': '🇧🇪',
    'SE': '🇸🇪', 'NO': '🇳🇴', 'DK': '🇩🇰', 'PL': '🇵🇱', 'IE': '🇮🇪',
    'NZ': '🇳🇿', 'MX': '🇲🇽', 'AR': '🇦🇷', 'ZA': '🇿🇦', 'AE': '🇦🇪',
    'SA': '🇸🇦', 'TR': '🇹🇷', 'RU': '🇷🇺',
}

CATEGORY_EMOJI = {
    'HEALTH': '💊', 'SURVEY': '📋', 'SWEEPSTAKES': '🎰', 'EDUCATION': '📚',
    'INSURANCE': '🛡️', 'LOAN': '💳', 'FINANCE': '💰', 'DATING': '❤️',
    'FREE_TRIAL': '🎁', 'INSTALLS': '📲', 'GAMES_INSTALL': '🎮',
}


# ─── Config helpers ──────────────────────────────────────────────────────────

def _load_settings() -> dict:
    """Load settings from DB, fall back to Config class (which reads .env)."""
    # Import Config here so we always get the already-loaded values from Flask's env
    try:
        from config import Config
        env_token = getattr(Config, 'TELEGRAM_BOT_TOKEN', '') or os.getenv('TELEGRAM_BOT_TOKEN', '')
        env_channel = getattr(Config, 'TELEGRAM_CHANNEL_ID', '') or os.getenv('TELEGRAM_CHANNEL_ID', '')
    except Exception:
        env_token = os.getenv('TELEGRAM_BOT_TOKEN', '')
        env_channel = os.getenv('TELEGRAM_CHANNEL_ID', '')

    defaults = {
        'bot_token': env_token,
        'channel_id': env_channel,
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
            'categories': [],
            'countries': [],
            'only_active': True,
        },
    }
    try:
        col = db_instance.get_collection('telegram_settings')
        if col is None:
            return defaults
        doc = col.find_one({'_id': 'main'})
        if not doc:
            return defaults
        doc.pop('_id', None)
        # Merge — DB wins, defaults fill gaps
        # IMPORTANT: only use DB token/channel if they are actually set (non-empty)
        # to avoid blank DB values overriding the env fallback
        for k, v in defaults.items():
            if k not in doc:
                doc[k] = v
            elif isinstance(v, dict):
                for kk, vv in v.items():
                    doc.setdefault(k, {})[kk] = doc.get(k, {}).get(kk, vv)
        # Fall back to env for credentials if DB has empty strings
        if not doc.get('bot_token', '').strip():
            doc['bot_token'] = env_token
        if not doc.get('channel_id', '').strip():
            doc['channel_id'] = env_channel
        return doc
    except Exception as e:
        logger.warning(f"[Telegram] Could not load DB settings, using env fallback: {e}")
        return defaults


# ─── Data fetching ───────────────────────────────────────────────────────────

def get_trending_offers(hours: int = 48, limit: int = 7, settings: dict = None) -> list:
    """Get top picked offers, respecting admin-configured filters."""
    if settings is None:
        settings = _load_settings()

    picks_col = db_instance.get_collection('offer_picks')
    if picks_col is None:
        return []

    since = datetime.utcnow() - timedelta(hours=hours)

    pipeline = [
        {'$match': {'picked_at': {'$gte': since}}},
        {'$group': {
            '_id': '$offer_id',
            'pick_count': {'$sum': 1},
            'offer_name': {'$first': '$offer_name'},
            'image_url': {'$first': '$image_url'},
            'country': {'$first': '$country'},
        }},
        {'$sort': {'pick_count': -1}},
        {'$limit': limit * 3},   # over-fetch for filtering
    ]

    results = list(picks_col.aggregate(pipeline))

    # Enrich with offer data
    offers_col = db_instance.get_collection('offers')
    filters = settings.get('filters', {})
    min_payout = float(filters.get('min_payout', 0))
    allowed_cats = [c.upper() for c in filters.get('categories', [])]
    allowed_countries = [c.upper() for c in filters.get('countries', [])]
    only_active = filters.get('only_active', True)

    enriched = []
    if offers_col is not None:
        for r in results:
            offer = offers_col.find_one(
                {'offer_id': r['_id']},
                {'payout': 1, 'status': 1, 'category': 1, 'vertical': 1, 'countries': 1, 'tracking_link': 1, '_id': 0}
            )
            if not offer:
                continue
            if only_active and offer.get('status') not in ('active', 'running'):
                continue
            payout = float(offer.get('payout', 0) or 0)
            if payout < min_payout:
                continue
            cat = (offer.get('vertical') or offer.get('category') or '').upper()
            if allowed_cats and cat not in allowed_cats:
                continue
            offer_countries = [c.upper() for c in (offer.get('countries') or [])]
            if allowed_countries and not any(c in offer_countries for c in allowed_countries):
                continue
            r['payout'] = payout
            r['category'] = cat
            r['tracking_link'] = offer.get('tracking_link', '')
            enriched.append(r)
            if len(enriched) >= limit:
                break

    return enriched if enriched else results[:limit]


# ─── Message formatting ───────────────────────────────────────────────────────

def format_trending_message(offers: list, settings: dict = None) -> str | None:
    """Build the Telegram message string based on admin content settings."""
    if not offers:
        return None

    if settings is None:
        settings = _load_settings()

    content = settings.get('content', {})
    show_payout = content.get('show_payout', True)
    show_picks = content.get('show_pick_count', True)
    show_country = content.get('show_country', True)
    show_category = content.get('show_category', False)
    show_link = content.get('show_tracking_link', False)
    custom_header = content.get('custom_header', '').strip()
    custom_footer = content.get('custom_footer', '').strip()

    header = custom_header or '📊 *Latest Top Offers*'
    lines = [header, '']

    for i, offer in enumerate(offers):
        name = (offer.get('offer_name') or 'Unknown')[:50]
        lines.append(f"{i + 1}. *{name}*")

        detail_parts = []
        if show_payout and offer.get('payout', 0) > 0:
            detail_parts.append(f"💰 ${offer['payout']:.2f}")
        if show_picks and offer.get('pick_count', 0) > 0:
            detail_parts.append(f"🔥 {offer['pick_count']} picks")
        if show_country and offer.get('country'):
            flag = FLAG_MAP.get(str(offer['country']).upper(), '')
            detail_parts.append(f"{flag} {offer['country']}" if flag else offer['country'])
        if show_category and offer.get('category'):
            emoji = CATEGORY_EMOJI.get(offer['category'], '🏷')
            detail_parts.append(f"{emoji} {offer['category'].replace('_', ' ').title()}")

        if detail_parts:
            lines.append('   ' + '  ·  '.join(detail_parts))
        if show_link and offer.get('tracking_link'):
            lines.append(f"   🔗 {offer['tracking_link']}")
        lines.append('')

    if custom_footer:
        lines.append(custom_footer)

    return '\n'.join(lines)


# ─── Send ─────────────────────────────────────────────────────────────────────

def send_trending_to_telegram(settings: dict = None) -> bool:
    """Send the trending-offers message. Returns True on success."""
    if settings is None:
        settings = _load_settings()

    bot_token = settings.get('bot_token', '').strip()
    channel_id = settings.get('channel_id', '').strip()

    if not bot_token or not channel_id:
        logger.warning("[Telegram] bot_token or channel_id not configured — skipping send")
        return False

    if not settings.get('enabled', True):
        logger.info("[Telegram] Bot is disabled in settings — skipping send")
        return False

    try:
        offers = get_trending_offers(
            hours=settings.get('lookback_hours', 48),
            limit=settings.get('offers_per_message', 7),
            settings=settings,
        )
        message = format_trending_message(offers, settings=settings)

        if message is None:
            logger.info("[Telegram] No offers found — skipping send")
            return False

        import requests as _requests
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {
            'chat_id': channel_id,
            'text': message,
            'parse_mode': 'Markdown',
            'disable_web_page_preview': True,
        }
        resp = _requests.post(url, json=payload, timeout=15)
        result = resp.json()

        if result.get('ok'):
            logger.info(f"[Telegram] Sent {len(offers)} offers to channel")
            log_send_history('scheduled', offer_count=len(offers))
            return True
        else:
            err = result.get('description', 'Unknown Telegram API error')
            logger.error(f"[Telegram] API error: {err}")
            log_send_history('scheduled', offer_count=0, error=err)
            return False

    except Exception as e:
        logger.error(f"[Telegram] Failed to send: {e}")
        log_send_history('scheduled', offer_count=0, error=str(e))
        return False


# ─── History logging ──────────────────────────────────────────────────────────

def log_send_history(trigger: str, offer_count: int = 0, error: str = None, triggered_by: str = 'scheduler'):
    """Append an entry to telegram_send_log collection."""
    try:
        col = db_instance.get_collection('telegram_send_log')
        if col is None:
            return
        col.insert_one({
            'trigger': trigger,
            'offer_count': offer_count,
            'error': error,
            'status': 'error' if error else 'ok',
            'triggered_by': triggered_by,
            'sent_at': datetime.utcnow(),
        })
        # Keep only last 200 entries
        total = col.count_documents({})
        if total > 200:
            oldest = list(col.find({}, {'_id': 1}).sort('sent_at', 1).limit(total - 200))
            col.delete_many({'_id': {'$in': [d['_id'] for d in oldest]}})
    except Exception as e:
        logger.warning(f"[Telegram] log_send_history error: {e}")


# ─── Scheduler ────────────────────────────────────────────────────────────────

def run_trending_update():
    """Single synchronous send cycle, reading fresh settings from DB each time."""
    settings = _load_settings()
    send_trending_to_telegram(settings)


def start_scheduler():
    """
    Start a background daemon thread.
    Interval is re-read from DB each cycle so admin changes take effect without restart.
    """
    import threading
    import time as _time

    def _loop():
        logger.info("[Telegram] Scheduler started — interval is read from DB each cycle")
        _time.sleep(300)  # 5-min warm-up to avoid double-send on restart
        try:
            run_trending_update()
        except Exception as e:
            logger.error(f"[Telegram] Scheduler initial run error: {e}")

        while True:
            try:
                settings = _load_settings()
                hours = max(1, int(settings.get('interval_hours', 12)))
                _time.sleep(hours * 3600)
                run_trending_update()
            except Exception as e:
                logger.error(f"[Telegram] Scheduler loop error: {e}")
                _time.sleep(3600)

    t = threading.Thread(target=_loop, daemon=True, name='TelegramScheduler')
    t.start()


# ─── Standalone CLI ───────────────────────────────────────────────────────────
if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)

    import sys as _sys
    if '--loop' in _sys.argv:
        import time as _time
        print("Starting Telegram bot in loop mode...")
        while True:
            run_trending_update()
            settings = _load_settings()
            h = settings.get('interval_hours', 12)
            print(f"Next run in {h} hours...")
            _time.sleep(h * 3600)
    else:
        print("Sending now...")
        run_trending_update()
        print("Done!")
