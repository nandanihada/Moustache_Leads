"""
Fraud Scoring Service (Phase 2.4 + 2.6 + 2.7)

Calculates a 0-100 fraud score for each click based on weighted signals.
Also handles IP velocity tracking, auto-blocking, and user segmentation.

Score ranges:
  0-29  → genuine (green)
  30-69 → suspicious (yellow)
  70+   → fraud (red)

Called at click time from simple_tracking.py.
Does NOT replace existing fraud detection — adds scoring on top.
"""

import logging
from datetime import datetime, timedelta
from database import db_instance

logger = logging.getLogger(__name__)

# ============================================================================
# SCORING WEIGHTS (total can exceed 100 — capped at 100)
# ============================================================================
WEIGHTS = {
    'duplicate_click': 30,       # Same user+offer within 1 hour
    'fast_click': 25,            # Click happened too fast (<500ms from page load)
    'vpn_proxy': 20,             # VPN or proxy detected
    'tor_detected': 30,          # Tor exit node
    'datacenter_ip': 15,         # IP belongs to a datacenter/hosting provider
    'high_velocity_ip': 20,      # Too many clicks from same IP in short window
    'high_velocity_user': 15,    # Too many clicks from same user in short window
    'known_bot_ua': 25,          # User agent matches known bot patterns
    'empty_referer_suspicious': 5,  # No referer (mild signal)
}

# IP velocity thresholds
IP_VELOCITY_WINDOW_MINUTES = 5
IP_VELOCITY_THRESHOLD = 15       # Max clicks per IP in the window
USER_VELOCITY_WINDOW_MINUTES = 10
USER_VELOCITY_THRESHOLD = 30     # Max clicks per user in the window

# Known bot user-agent patterns
BOT_UA_PATTERNS = [
    'bot', 'crawler', 'spider', 'scraper', 'headless',
    'phantomjs', 'selenium', 'puppeteer', 'playwright',
    'wget', 'curl', 'python-requests', 'httpx', 'aiohttp',
    'go-http-client', 'java/', 'libwww', 'lwp-trivial',
]


def classify_score(score):
    """Convert numeric score to classification label."""
    if score >= 70:
        return 'fraud'
    elif score >= 30:
        return 'suspicious'
    return 'genuine'


def calculate_fraud_score(click_data):
    """
    Calculate fraud score for a click. Called at click time.
    
    Args:
        click_data: dict with keys like ip_address, user_id, offer_id, user_agent, etc.
    
    Returns:
        dict: {
            'fraud_score': int (0-100),
            'fraud_classification': str ('genuine'/'suspicious'/'fraud'),
            'signals': list of triggered signal names,
            'details': dict with per-signal info
        }
    """
    score = 0
    signals = []
    details = {}
    
    ip_address = click_data.get('ip_address', '')
    user_id = click_data.get('user_id', '')
    offer_id = click_data.get('offer_id', '')
    user_agent = (click_data.get('user_agent', '') or '').lower()
    
    try:
        clicks_col = db_instance.get_collection('clicks')
        if clicks_col is None:
            return {'fraud_score': 0, 'fraud_classification': 'genuine', 'signals': [], 'details': {}}
        
        now = datetime.utcnow()
        
        # 1. DUPLICATE CLICK — same user + same offer within 1 hour
        if user_id and offer_id:
            one_hour_ago = now - timedelta(hours=1)
            dup_count = clicks_col.count_documents({
                'user_id': user_id,
                'offer_id': offer_id,
                'timestamp': {'$gte': one_hour_ago}
            })
            if dup_count > 0:
                score += WEIGHTS['duplicate_click']
                signals.append('duplicate_click')
                details['duplicate_click'] = {'count_in_last_hour': dup_count}
        
        # 2. IP VELOCITY — too many clicks from same IP in short window
        if ip_address and ip_address not in ('127.0.0.1', '0.0.0.0'):
            ip_window = now - timedelta(minutes=IP_VELOCITY_WINDOW_MINUTES)
            ip_click_count = clicks_col.count_documents({
                'ip_address': ip_address,
                'timestamp': {'$gte': ip_window}
            })
            if ip_click_count >= IP_VELOCITY_THRESHOLD:
                score += WEIGHTS['high_velocity_ip']
                signals.append('high_velocity_ip')
                details['high_velocity_ip'] = {
                    'clicks_in_window': ip_click_count,
                    'window_minutes': IP_VELOCITY_WINDOW_MINUTES,
                    'threshold': IP_VELOCITY_THRESHOLD
                }
        
        # 3. USER VELOCITY — too many clicks from same user in short window
        if user_id:
            user_window = now - timedelta(minutes=USER_VELOCITY_WINDOW_MINUTES)
            user_click_count = clicks_col.count_documents({
                'user_id': user_id,
                'timestamp': {'$gte': user_window}
            })
            if user_click_count >= USER_VELOCITY_THRESHOLD:
                score += WEIGHTS['high_velocity_user']
                signals.append('high_velocity_user')
                details['high_velocity_user'] = {
                    'clicks_in_window': user_click_count,
                    'window_minutes': USER_VELOCITY_WINDOW_MINUTES,
                    'threshold': USER_VELOCITY_THRESHOLD
                }
        
        # 4. KNOWN BOT USER AGENT
        if user_agent:
            for pattern in BOT_UA_PATTERNS:
                if pattern in user_agent:
                    score += WEIGHTS['known_bot_ua']
                    signals.append('known_bot_ua')
                    details['known_bot_ua'] = {'matched_pattern': pattern, 'user_agent': click_data.get('user_agent', '')}
                    break
        
        # 5. EMPTY/MISSING USER AGENT (strong bot signal)
        if not user_agent or len(user_agent) < 10:
            score += WEIGHTS['known_bot_ua']
            signals.append('empty_user_agent')
            details['empty_user_agent'] = True
        
        # Cap at 100
        score = min(score, 100)
        classification = classify_score(score)
        
        return {
            'fraud_score': score,
            'fraud_classification': classification,
            'signals': signals,
            'details': details,
        }
        
    except Exception as e:
        logger.error(f"❌ Fraud scoring error: {e}")
        return {'fraud_score': 0, 'fraud_classification': 'genuine', 'signals': [], 'details': {}}


def enrich_click_with_fraud_score(click_data):
    """
    Convenience function: calculate score and merge into click_data dict.
    Called from simple_tracking.py before inserting the click.
    
    Args:
        click_data: mutable dict — will be modified in place
    
    Returns:
        click_data (same reference, now with fraud_score and fraud_classification set)
    """
    result = calculate_fraud_score(click_data)
    click_data['fraud_score'] = result['fraud_score']
    click_data['fraud_classification'] = result['fraud_classification']
    click_data['fraud_signals'] = result['signals']
    return click_data


# ============================================================================
# PHASE 2.6: IP BLOCKING
# ============================================================================

def is_ip_blocked(ip_address):
    """Check if an IP is in the blocked list."""
    try:
        if not ip_address:
            return False
        blocked_col = db_instance.get_collection('blocked_ips')
        if blocked_col is None:
            return False
        blocked = blocked_col.find_one({
            'ip_address': ip_address,
            'active': True
        })
        return blocked is not None
    except Exception:
        return False


def block_ip(ip_address, reason='auto', blocked_by='system'):
    """Add an IP to the blocked list."""
    try:
        blocked_col = db_instance.get_collection('blocked_ips')
        if blocked_col is None:
            return False
        # Upsert — don't create duplicates
        blocked_col.update_one(
            {'ip_address': ip_address},
            {'$set': {
                'ip_address': ip_address,
                'active': True,
                'reason': reason,
                'blocked_by': blocked_by,
                'blocked_at': datetime.utcnow(),
                'updated_at': datetime.utcnow(),
            }},
            upsert=True
        )
        logger.info(f"🚫 IP blocked: {ip_address} (reason: {reason})")
        return True
    except Exception as e:
        logger.error(f"❌ Error blocking IP: {e}")
        return False


def unblock_ip(ip_address):
    """Remove an IP from the blocked list."""
    try:
        blocked_col = db_instance.get_collection('blocked_ips')
        if blocked_col is None:
            return False
        blocked_col.update_one(
            {'ip_address': ip_address},
            {'$set': {'active': False, 'updated_at': datetime.utcnow()}}
        )
        logger.info(f"✅ IP unblocked: {ip_address}")
        return True
    except Exception as e:
        logger.error(f"❌ Error unblocking IP: {e}")
        return False


def get_blocked_ips(page=1, per_page=50):
    """Get list of blocked IPs with pagination."""
    try:
        blocked_col = db_instance.get_collection('blocked_ips')
        if blocked_col is None:
            return [], 0
        
        query = {'active': True}
        total = blocked_col.count_documents(query)
        skip = (page - 1) * per_page
        
        ips = list(blocked_col.find(query).sort('blocked_at', -1).skip(skip).limit(per_page))
        for ip in ips:
            ip['_id'] = str(ip['_id'])
        
        return ips, total
    except Exception as e:
        logger.error(f"❌ Error getting blocked IPs: {e}")
        return [], 0


def auto_block_high_velocity_ip(ip_address):
    """
    Check if IP exceeds velocity threshold and auto-block if so.
    Called after fraud scoring if high_velocity_ip signal is triggered.
    """
    try:
        clicks_col = db_instance.get_collection('clicks')
        if clicks_col is None:
            return False
        
        # Check velocity in a wider window for auto-blocking (30 min)
        window = datetime.utcnow() - timedelta(minutes=30)
        count = clicks_col.count_documents({
            'ip_address': ip_address,
            'timestamp': {'$gte': window}
        })
        
        # Auto-block if >50 clicks in 30 minutes
        if count >= 50:
            block_ip(ip_address, reason=f'auto_velocity_{count}_clicks_30min', blocked_by='system')
            return True
        
        return False
    except Exception:
        return False


# ============================================================================
# PHASE 2.7: USER SEGMENTATION
# ============================================================================

def calculate_user_segment(user_id):
    """
    Calculate segment label for a user based on their click/conversion/fraud data.
    
    Labels:
      GOOD       — CR > 5%, fraud < 10%
      AVERAGE    — CR 2-5%, fraud 10-30%
      SUSPICIOUS — fraud 30-70%
      FRAUD      — fraud > 70%
    
    Returns:
        dict with segment_label, stats
    """
    try:
        clicks_col = db_instance.get_collection('clicks')
        conversions_col = db_instance.get_collection('conversions')
        
        if clicks_col is None:
            return {'segment_label': 'AVERAGE', 'stats': {}}
        
        # Get click stats for this user
        total_clicks = clicks_col.count_documents({'user_id': user_id})
        
        if total_clicks == 0:
            return {
                'segment_label': 'AVERAGE',
                'stats': {'total_clicks': 0, 'total_conversions': 0, 'cr': 0, 'fraud_pct': 0}
            }
        
        # Count fraud clicks
        fraud_clicks = clicks_col.count_documents({
            'user_id': user_id,
            'fraud_classification': 'fraud'
        })
        suspicious_clicks = clicks_col.count_documents({
            'user_id': user_id,
            'fraud_classification': 'suspicious'
        })
        
        # Count conversions
        total_conversions = 0
        if conversions_col is not None:
            total_conversions = conversions_col.count_documents({'user_id': user_id})
        
        # Also check clicks with postback_received
        postback_conversions = clicks_col.count_documents({
            'user_id': user_id,
            'postback_received': True
        })
        total_conversions = max(total_conversions, postback_conversions)
        
        # Calculate rates
        cr = (total_conversions / total_clicks * 100) if total_clicks > 0 else 0
        fraud_pct = ((fraud_clicks + suspicious_clicks) / total_clicks * 100) if total_clicks > 0 else 0
        
        # Determine segment
        if fraud_pct > 70:
            label = 'FRAUD'
        elif fraud_pct > 30:
            label = 'SUSPICIOUS'
        elif cr > 5 and fraud_pct < 10:
            label = 'GOOD'
        else:
            label = 'AVERAGE'
        
        stats = {
            'total_clicks': total_clicks,
            'total_conversions': total_conversions,
            'fraud_clicks': fraud_clicks,
            'suspicious_clicks': suspicious_clicks,
            'cr': round(cr, 2),
            'fraud_pct': round(fraud_pct, 2),
        }
        
        return {'segment_label': label, 'stats': stats}
        
    except Exception as e:
        logger.error(f"❌ Error calculating user segment: {e}")
        return {'segment_label': 'AVERAGE', 'stats': {}}


def update_user_segment(user_id):
    """Calculate and save segment label to the user document."""
    try:
        result = calculate_user_segment(user_id)
        
        users_col = db_instance.get_collection('users')
        if users_col is not None:
            from bson import ObjectId
            # Try to update by username first, then by _id
            updated = users_col.update_one(
                {'username': user_id},
                {'$set': {
                    'fraud_segment': result['segment_label'],
                    'fraud_segment_stats': result['stats'],
                    'fraud_segment_updated_at': datetime.utcnow(),
                }}
            )
            if updated.matched_count == 0:
                try:
                    users_col.update_one(
                        {'_id': ObjectId(user_id)},
                        {'$set': {
                            'fraud_segment': result['segment_label'],
                            'fraud_segment_stats': result['stats'],
                            'fraud_segment_updated_at': datetime.utcnow(),
                        }}
                    )
                except Exception:
                    pass
        
        return result
    except Exception as e:
        logger.error(f"❌ Error updating user segment: {e}")
        return {'segment_label': 'AVERAGE', 'stats': {}}
