"""
Link Health Service — Geekflare API Integration

Checks offer tracking links for:
1. Hard failures: 4xx/5xx, timeouts, SSL errors (via redirect check)
2. Soft failures: 200 but wrong page content (via web scrape + keyword matching)

Runs as a background thread every 2 hours, checking ~50 links per batch.
Results are saved to the offer document in MongoDB (link_health field).

Credit budget (free tier = 3000 credits/month):
- Redirect check = 1 credit
- Web scrape = 2 credits
- 50 links × 12 runs/day = 600 checks/day → ~1800/month (well within limit)
- Deep scrape only for suspicious links (~5-10% of checks)
"""

import logging
import threading
import time
import requests
from datetime import datetime, timedelta
from database import db_instance
from config import Config

logger = logging.getLogger(__name__)

# ============================================================
# BAD KEYWORD PATTERNS — indicates a broken/wrong landing page
# ============================================================

GLOBAL_BAD_KEYWORDS = [
    'offer has expired',
    'offer expired',
    'offer not found',
    'offer unavailable',
    'offer is no longer available',
    'campaign paused',
    'campaign not found',
    'campaign unavailable',
    'page not found',
    '404 not found',
    'this page doesn\'t exist',
    'domain for sale',
    'parked domain',
    'this domain is for sale',
    'buy this domain',
    'coming soon',
    'under construction',
    'site not available',
    'access denied',
    'forbidden',
    'link disabled',
    'link has been disabled',
    'invalid offer',
    'offer closed',
    'no longer accepting',
    'this link is not valid',
    'url has expired',
    'temporarily unavailable',
    'maintenance mode',
    'we\'re sorry',
    'something went wrong',
    'error occurred',
    'server error',
    'bad gateway',
    'service unavailable',
]

# Domains that indicate parking/expired pages
BAD_DOMAINS = [
    'sedoparking.com',
    'parkingcrew.net',
    'bodis.com',
    'afternic.com',
    'hugedomains.com',
    'dan.com',
    'godaddy.com/forsale',
    'namecheap.com/domains/forwarding',
]

# ============================================================
# GEEKFLARE API CLIENT
# ============================================================

GEEKFLARE_API_BASE = 'https://api.geekflare.com'


def _get_api_key():
    """Get Geekflare API key from config."""
    return Config.GEEKFLARE_API_KEY


def check_redirect_chain(url):
    """
    Call Geekflare redirect check API.
    Returns: {success, hops, final_url, final_status, error}
    Cost: 1 credit
    """
    api_key = _get_api_key()
    if not api_key:
        return {'success': False, 'error': 'GEEKFLARE_API_KEY not configured'}

    try:
        response = requests.post(
            f'{GEEKFLARE_API_BASE}/redirectcheck',
            headers={
                'Content-Type': 'application/json',
                'x-api-key': api_key,
            },
            json={'url': url},
            timeout=30,
        )

        if response.status_code == 402:
            return {'success': False, 'error': 'API credits exhausted'}
        if response.status_code == 429:
            return {'success': False, 'error': 'Rate limit exceeded'}
        if response.status_code not in (200, 201):
            return {'success': False, 'error': f'API returned {response.status_code}'}

        data = response.json()

        if data.get('apiStatus') != 'success':
            return {'success': False, 'error': data.get('apiStatus', 'unknown error')}

        hops = data.get('data', [])
        if not hops:
            return {'success': False, 'error': 'No redirect data returned'}

        # Get final hop info
        final_hop = hops[-1]
        final_url = final_hop.get('url', url)
        final_status = final_hop.get('status', 0)

        # Check for location header in last hop (means there's another redirect we didn't follow)
        for header in final_hop.get('headers', []):
            if header.get('name', '').lower() == 'location':
                final_url = header.get('value', final_url)

        return {
            'success': True,
            'hops': len(hops),
            'final_url': final_url,
            'final_status': final_status,
            'redirect_chain': [{'url': h.get('url'), 'status': h.get('status')} for h in hops],
        }

    except requests.Timeout:
        return {'success': False, 'error': 'Request timeout (30s)'}
    except requests.ConnectionError:
        return {'success': False, 'error': 'Connection error'}
    except Exception as e:
        return {'success': False, 'error': str(e)}


def scrape_page_content(url):
    """
    Scrape page content using Python requests (FREE, no API needed).
    Falls back to Geekflare only if needed for JS-heavy pages.
    Returns: {success, content, error}
    """
    try:
        response = requests.get(
            url,
            timeout=20,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            },
            allow_redirects=True,
        )

        if response.status_code >= 400:
            return {'success': True, 'content': f'HTTP ERROR {response.status_code}'}

        # Get text content, limit to 10KB
        content = response.text[:10000]
        return {'success': True, 'content': content}

    except requests.Timeout:
        return {'success': False, 'error': 'Page timeout (20s)'}
    except requests.ConnectionError:
        return {'success': False, 'error': 'Connection error - site unreachable'}
    except Exception as e:
        return {'success': False, 'error': str(e)}


def check_content_for_bad_keywords(content):
    """
    Check scraped page content against bad keyword list.
    Returns: {is_bad, matched_keywords}
    """
    if not content:
        return {'is_bad': False, 'matched_keywords': []}

    content_lower = content.lower()
    matched = []

    for keyword in GLOBAL_BAD_KEYWORDS:
        if keyword in content_lower:
            matched.append(keyword)

    return {'is_bad': len(matched) > 0, 'matched_keywords': matched[:5]}  # Max 5 matches


def is_suspicious_redirect(original_url, final_url):
    """
    Determine if a redirect looks suspicious (might need deep scrape).
    """
    if not final_url:
        return True

    from urllib.parse import urlparse

    try:
        original_domain = urlparse(original_url).netloc.lower()
        final_domain = urlparse(final_url).netloc.lower()
    except Exception:
        return True

    # Check if final domain is a known bad/parking domain
    for bad_domain in BAD_DOMAINS:
        if bad_domain in final_domain:
            return True

    # If original and final domains are completely different root domains, suspicious
    # (But affiliate redirects often change domain, so only flag certain patterns)
    # E.g., going from tracking.network.com → somerandomparkeddomain.com
    suspicious_tlds = ['.xyz', '.top', '.club', '.work', '.site', '.online']
    for tld in suspicious_tlds:
        if final_domain.endswith(tld) and not original_domain.endswith(tld):
            return True

    return False


# ============================================================
# MAIN HEALTH CHECK LOGIC
# ============================================================

def check_single_offer_link(offer):
    """
    Check a single offer's tracking link health.
    Returns a link_health dict to store on the offer document.
    """
    import re

    offer_id = offer.get('offer_id', '')
    target_url = offer.get('target_url', '')

    if not target_url or not target_url.strip():
        return {
            'status': 'no_url',
            'last_checked': datetime.utcnow(),
            'final_url': None,
            'failure_reason': 'No target_url set on offer',
            'redirect_count': 0,
            'checked_by': 'geekflare',
        }

    # Replace tracking macros with dummy values so the URL is valid for checking
    # Common macros: {sub1}, {sub_id1}, {click_id}, {offer_id}, {aff_sub}, etc.
    check_url = re.sub(r'\{[^}]+\}', 'test123', target_url)
    # Also handle [macros] format
    check_url = re.sub(r'\[[^\]]+\]', 'test123', check_url)

    # Step 1: Check redirect chain (1 credit)
    redirect_result = check_redirect_chain(check_url)

    if not redirect_result['success']:
        return {
            'status': 'error',
            'last_checked': datetime.utcnow(),
            'final_url': None,
            'failure_reason': redirect_result['error'],
            'redirect_count': 0,
            'checked_by': 'geekflare',
        }

    final_url = redirect_result['final_url']
    final_status = redirect_result['final_status']
    redirect_count = redirect_result['hops']

    # Step 2: Check for hard failures (4xx/5xx)
    if final_status >= 400:
        return {
            'status': 'broken',
            'last_checked': datetime.utcnow(),
            'final_url': final_url,
            'final_status': final_status,
            'failure_reason': f'HTTP {final_status} error',
            'redirect_count': redirect_count,
            'redirect_chain': redirect_result.get('redirect_chain', []),
            'checked_by': 'geekflare',
        }

    # Step 3: If status is 200, always do deep content scrape to check for soft failures
    if final_status == 200:
        scrape_result = scrape_page_content(check_url)

        if scrape_result['success']:
            keyword_check = check_content_for_bad_keywords(scrape_result['content'])

            if keyword_check['is_bad']:
                return {
                    'status': 'soft_broken',
                    'last_checked': datetime.utcnow(),
                    'final_url': final_url,
                    'final_status': final_status,
                    'failure_reason': f"Page contains bad keywords: {', '.join(keyword_check['matched_keywords'])}",
                    'matched_keywords': keyword_check['matched_keywords'],
                    'redirect_count': redirect_count,
                    'redirect_chain': redirect_result.get('redirect_chain', []),
                    'checked_by': 'geekflare_deep',
                }
        else:
            # Scrape failed — mark as warning, can't confirm page is actually healthy
            return {
                'status': 'warning',
                'last_checked': datetime.utcnow(),
                'final_url': final_url,
                'final_status': final_status,
                'failure_reason': f"Scrape failed: {scrape_result['error']} (page content could not be verified)",
                'redirect_count': redirect_count,
                'checked_by': 'geekflare',
            }

    # Step 4: All good
    return {
        'status': 'healthy',
        'last_checked': datetime.utcnow(),
        'final_url': final_url,
        'final_status': final_status,
        'failure_reason': None,
        'redirect_count': redirect_count,
        'checked_by': 'geekflare_deep' if final_status == 200 else 'geekflare',
    }


# ============================================================
# BACKGROUND SERVICE (runs every 2 hours)
# ============================================================

_link_health_instance = None
_instance_lock = threading.Lock()


class LinkHealthService:
    """Background service that checks offer link health every 2 hours."""

    BATCH_SIZE = 50  # Links per run
    INTERVAL_SECONDS = 2 * 60 * 60  # 2 hours
    INITIAL_DELAY = 10  # Wait 10 seconds after startup before first run

    def __init__(self):
        self.offers_col = db_instance.get_collection('offers')
        self._thread = None
        self._stop_event = threading.Event()

    def start(self):
        """Start the background health check thread."""
        if not _get_api_key():
            logger.warning("⚠️ Link health service NOT started — GEEKFLARE_API_KEY not set")
            return

        if self._thread and self._thread.is_alive():
            logger.info("Link health service already running")
            return

        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run_loop, daemon=True, name='link-health-checker')
        self._thread.start()
        logger.info("✅ Link health service started (every 2 hours, batch of 50)")
        print("✅ Link health service started (every 2 hours, batch of 50)")  # Force print to console

    def stop(self):
        """Stop the background thread."""
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=5)

    def _run_loop(self):
        """Main loop: sleep → check batch → repeat."""
        # Initial delay
        print(f"🔗 Link health: waiting {self.INITIAL_DELAY}s before first check...")
        self._stop_event.wait(self.INITIAL_DELAY)

        while not self._stop_event.is_set():
            try:
                print("🔗 Link health: starting batch check now...")
                self._check_batch()
            except Exception as e:
                logger.error(f"Link health batch error: {e}")
                print(f"❌ Link health batch error: {e}")

            # Wait for next interval
            self._stop_event.wait(self.INTERVAL_SECONDS)

    def _check_batch(self):
        """Pick the oldest-checked offers and check them. Prioritizes running offers."""
        if self.offers_col is None:
            return

        # Find offers that need checking:
        # Prioritize running offers (serving traffic), then active, then rotating
        query = {
            'status': {'$in': ['running', 'active', 'rotating']},
            'target_url': {'$exists': True, '$ne': ''},
            'deleted': {'$ne': True},
        }

        # Sort: never-checked first, then oldest checked
        offers = list(self.offers_col.find(
            query,
            {'offer_id': 1, 'name': 1, 'target_url': 1, 'network': 1, 'status': 1, 'link_health': 1}
        ).sort([
            ('link_health.last_checked', 1),  # None/oldest first
        ]).limit(self.BATCH_SIZE))

        if not offers:
            logger.info("Link health: no offers to check")
            return

        logger.info(f"🔗 Link health: checking {len(offers)} offers...")

        checked = 0
        broken_count = 0

        for offer in offers:
            if self._stop_event.is_set():
                break

            try:
                result = check_single_offer_link(offer)

                # Save result to offer document
                self.offers_col.update_one(
                    {'_id': offer['_id']},
                    {'$set': {'link_health': result}}
                )

                checked += 1
                if result['status'] in ('broken', 'soft_broken'):
                    broken_count += 1
                    logger.warning(
                        f"🔴 Broken link: {offer.get('offer_id')} — {result['failure_reason']}"
                    )

                # Small delay between API calls to avoid rate limits
                time.sleep(1.5)

            except Exception as e:
                logger.error(f"Error checking offer {offer.get('offer_id')}: {e}")

        logger.info(
            f"✅ Link health batch complete: {checked} checked, {broken_count} broken"
        )

    def check_offer_manually(self, offer_id):
        """Manually trigger a check for a specific offer (called from admin API)."""
        if self.offers_col is None:
            return {'error': 'Database not available'}

        offer = self.offers_col.find_one(
            {'offer_id': offer_id},
            {'offer_id': 1, 'name': 1, 'target_url': 1, 'network': 1}
        )

        if not offer:
            return {'error': f'Offer {offer_id} not found'}

        result = check_single_offer_link(offer)

        # Save result
        self.offers_col.update_one(
            {'_id': offer['_id']},
            {'$set': {'link_health': result}}
        )

        return result

    def get_stats(self):
        """Get summary statistics for the admin panel."""
        if self.offers_col is None:
            return {}

        pipeline = [
            {'$match': {
                'status': {'$in': ['active', 'running', 'rotating']},
                'deleted': {'$ne': True},
                'target_url': {'$exists': True, '$ne': ''},
            }},
            {'$group': {
                '_id': '$link_health.status',
                'count': {'$sum': 1},
            }}
        ]

        results = list(self.offers_col.aggregate(pipeline))
        stats = {r['_id']: r['count'] for r in results if r['_id']}

        # Count never-checked
        never_checked = self.offers_col.count_documents({
            'status': {'$in': ['active', 'running', 'rotating']},
            'deleted': {'$ne': True},
            'target_url': {'$exists': True, '$ne': ''},
            'link_health': {'$exists': False},
        })

        stats['never_checked'] = never_checked
        stats['total_active'] = sum(stats.values())

        return stats


def get_link_health_service():
    """Singleton accessor."""
    global _link_health_instance
    if _link_health_instance is None:
        with _instance_lock:
            if _link_health_instance is None:
                _link_health_instance = LinkHealthService()
    return _link_health_instance
