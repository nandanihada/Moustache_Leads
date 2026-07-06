"""
Telegram Bot: Sends top picked offers every 12 hours.
Run standalone: python -m services.telegram_trending_bot
Or import schedule_trending_updates() to run in background.

Setup: pip install python-telegram-bot
Add TELEGRAM_BOT_TOKEN to .env
"""
import os
import sys
import logging
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()

from database import db_instance

logger = logging.getLogger(__name__)

BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')
CHANNEL_ID = os.getenv('TELEGRAM_CHANNEL_ID', '-1003645610139')  # Telegram channel for offer updates

FLAG_MAP = {
    'US':'🇺🇸','UK':'🇬🇧','GB':'🇬🇧','CA':'🇨🇦','AU':'🇦🇺','DE':'🇩🇪','FR':'🇫🇷','IT':'🇮🇹',
    'ES':'🇪🇸','BR':'🇧🇷','IN':'🇮🇳','JP':'🇯🇵','KR':'🇰🇷','NL':'🇳🇱','BE':'🇧🇪',
    'SE':'🇸🇪','NO':'🇳🇴','DK':'🇩🇰','PL':'🇵🇱','IE':'🇮🇪','NZ':'🇳🇿','MX':'🇲🇽',
    'AR':'🇦🇷','ZA':'🇿🇦','AE':'🇦🇪','SA':'🇸🇦','TR':'🇹🇷','RU':'🇷🇺',
}


def get_trending_offers(hours=48, limit=7):
    """Get top picked offers in the last N hours, sorted by pick count."""
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
        {'$limit': limit}
    ]
    
    results = list(picks_col.aggregate(pipeline))
    
    # Also get payout for each offer
    offers_col = db_instance.get_collection('offers')
    if offers_col is not None:
        for r in results:
            offer = offers_col.find_one({'offer_id': r['_id']}, {'payout': 1, '_id': 0})
            r['payout'] = float(offer.get('payout', 0) or 0) if offer else 0
    
    return results


def format_trending_message(offers):
    """Format trending offers into a Telegram message."""
    if not offers:
        return None  # Don't send if no picks
    
    lines = ["📊 *Latest Top Offers*\n"]
    
    for i, offer in enumerate(offers):
        name = offer.get('offer_name', 'Unknown')[:45]
        payout = offer.get('payout', 0)
        payout_str = f"${payout:.2f}" if payout > 0 else ""
        
        lines.append(f"{i+1}. *{name}*")
        if payout_str:
            lines.append(f"   💰 {payout_str}")
        lines.append("")
    
    return '\n'.join(lines)


def send_trending_to_telegram():
    """Send trending offers to Telegram channel. Only sends if there are picks in the last 7 hours."""
    if not BOT_TOKEN or not CHANNEL_ID:
        logger.warning("TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL_ID not set")
        return False
    
    try:
        offers = get_trending_offers(hours=48, limit=7)
        message = format_trending_message(offers)
        
        # Don't send if no offers picked in this window
        if message is None:
            logger.info("No picks in the last 2 days — skipping Telegram send")
            return False
        
        # Use requests library for reliability (avoids async event loop issues in Flask)
        import requests
        url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
        payload = {
            'chat_id': CHANNEL_ID,
            'text': message,
            'parse_mode': 'Markdown'
        }
        resp = requests.post(url, json=payload, timeout=10)
        result = resp.json()
        
        if result.get('ok'):
            logger.info(f"Sent trending offers to Telegram channel ({len(offers)} offers)")
            return True
        else:
            logger.error(f"Telegram API error: {result.get('description', 'Unknown error')}")
            return False
    except Exception as e:
        logger.error(f"Failed to send to Telegram channel: {e}")
        return False


def run_trending_update():
    """Synchronous wrapper for the send function."""
    send_trending_to_telegram()


def start_scheduler():
    """Run the bot on a 7-hour loop as a background thread. Call from app.py."""
    import threading
    import time as _time
    
    def _loop():
        logger.info("📡 Telegram trending bot scheduler started (every 12 hours)")
        # Wait 5 minutes before first send (avoids duplicate sends on rapid restarts/deploys)
        _time.sleep(300)
        try:
            run_trending_update()
        except Exception as e:
            logger.error(f"Scheduler initial run error: {e}")
        
        while True:
            _time.sleep(12 * 3600)  # Wait 12 hours
            try:
                run_trending_update()
            except Exception as e:
                logger.error(f"Scheduler error: {e}")
    
    t = threading.Thread(target=_loop, daemon=True)
    t.start()


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    
    import sys
    if '--loop' in sys.argv:
        # Run in continuous loop mode (every 7 hours)
        import time as _time
        print("Starting Telegram bot in loop mode (every 12 hours)...")
        print("Press Ctrl+C to stop.\n")
        while True:
            run_trending_update()
            print(f"Next run in 12 hours...")
            _time.sleep(12 * 3600)
    else:
        # Single run mode
        print("Sending trending offers to Telegram...")
        run_trending_update()
        print("Done!")
