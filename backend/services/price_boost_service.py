"""
Price Boost Service
Manages time-limited price boosts for offerwall offers.
Checks for expired boosts and reverts them automatically.
"""

import logging
import threading
import time
from datetime import datetime, timedelta
from database import db_instance

logger = logging.getLogger(__name__)


class PriceBoostService:
    """Background service that monitors and expires price boosts on offers."""

    def __init__(self):
        self._running = False
        self._thread = None
        self._check_interval = 60  # Check every 60 seconds

    def start(self):
        """Start the background expiration checker."""
        if self._running:
            logger.info("Price boost service already running")
            return
        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True, name="PriceBoostService")
        self._thread.start()
        logger.info("✅ Price boost expiration service started")

    def stop(self):
        """Stop the background service."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
        logger.info("Price boost service stopped")

    def _run_loop(self):
        """Main loop that checks for expired boosts."""
        while self._running:
            try:
                self._check_expired_boosts()
            except Exception as e:
                logger.error(f"Price boost expiration check failed: {e}")
            time.sleep(self._check_interval)

    def _check_expired_boosts(self):
        """Find and revert expired price boosts."""
        try:
            offers_col = db_instance.get_collection('offers')
            if offers_col is None:
                return

            now = datetime.utcnow()

            # Find offers with expired boosts
            expired_offers = list(offers_col.find({
                'price_boost.expires_at': {'$lte': now},
                'price_boost': {'$exists': True}
            }))

            if not expired_offers:
                return

            reverted_count = 0
            for offer in expired_offers:
                boost = offer.get('price_boost', {})
                original_payout = boost.get('original_payout')
                offer_id = offer.get('offer_id')

                if offer_id:
                    # Revert publisher_payout_override to None (will use default 80% calculation)
                    offers_col.update_one(
                        {'offer_id': offer_id},
                        {
                            '$unset': {'publisher_payout_override': '', 'price_boost': ''}
                        }
                    )
                    reverted_count += 1
                    logger.info(f"🔄 Reverted boost for offer {offer_id} → back to default 80%")

            if reverted_count > 0:
                logger.info(f"✅ Reverted {reverted_count} expired price boosts")

        except Exception as e:
            logger.error(f"Error checking expired boosts: {e}")

    def apply_boost(self, offer_ids: list, percentage: float, direction: str, duration_hours: float, duration_minutes: float = 0) -> dict:
        """
        Apply a price boost to multiple offers.
        
        Boost means: apply percentage as multiplier on the existing publisher payout (80% of admin).
        Example: Admin payout = $31.50, normal publisher = $25.20 (80%)
                 Boost +10% of $25.20 = $27.72
                 Boost -10% of $25.20 = $22.68
        
        Args:
            offer_ids: List of offer_id strings
            percentage: Boost percentage (e.g., 10 means +10% of current publisher payout)
            direction: 'increase' or 'decrease'
            duration_hours: Hours part of duration
            duration_minutes: Minutes part of duration (added to hours)
            
        Returns:
            dict with success count and errors
        """
        offers_col = db_instance.get_collection('offers')
        if offers_col is None:
            return {'success': 0, 'errors': ['Database connection failed']}

        # Total duration = hours + minutes converted to hours
        total_duration_hours = duration_hours + (duration_minutes / 60.0)
        expires_at = datetime.utcnow() + timedelta(hours=total_duration_hours)
        success_count = 0
        errors = []

        for offer_id in offer_ids:
            try:
                offer = offers_col.find_one({'offer_id': offer_id}, {'payout': 1, 'publisher_payout_override': 1, 'price_boost': 1})
                if not offer:
                    errors.append(f"Offer {offer_id} not found")
                    continue

                admin_payout = float(offer.get('payout', 0) or 0)
                
                # Base publisher payout is always 80% of admin payout
                base_publisher_payout = round(admin_payout * 0.8, 2)

                # Apply percentage on the base publisher payout
                # +10% means: $25.20 * 1.10 = $27.72
                # -10% means: $25.20 * 0.90 = $22.68
                multiplier = percentage / 100.0
                if direction == 'increase':
                    new_payout = round(base_publisher_payout * (1 + multiplier), 2)
                else:
                    new_payout = round(base_publisher_payout * (1 - multiplier), 2)
                    new_payout = max(new_payout, 0.01)

                # Update the offer
                offers_col.update_one(
                    {'offer_id': offer_id},
                    {'$set': {
                        'publisher_payout_override': new_payout,
                        'price_boost': {
                            'percentage': percentage,
                            'direction': direction,
                            'expires_at': expires_at,
                            'original_payout': base_publisher_payout,
                            'boosted_payout': new_payout,
                            'admin_payout': admin_payout,
                            'applied_at': datetime.utcnow(),
                            'duration_hours': total_duration_hours
                        }
                    }}
                )
                success_count += 1

            except Exception as e:
                errors.append(f"Offer {offer_id}: {str(e)}")

        return {
            'success': success_count,
            'errors': errors,
            'expires_at': expires_at.isoformat() + 'Z'
        }

    def get_boosted_offers(self) -> list:
        """Get all offers with an active price boost."""
        offers_col = db_instance.get_collection('offers')
        if offers_col is None:
            return []

        now = datetime.utcnow()
        boosted = list(offers_col.find(
            {
                'price_boost': {'$exists': True},
                'price_boost.expires_at': {'$gt': now}
            },
            {
                'offer_id': 1, 'name': 1, 'payout': 1,
                'publisher_payout_override': 1, 'price_boost': 1,
                'network': 1, 'category': 1, 'vertical': 1
            }
        ))

        result = []
        for offer in boosted:
            boost = offer.get('price_boost', {})
            expires_at = boost.get('expires_at')
            result.append({
                'offer_id': offer.get('offer_id', ''),
                'name': offer.get('name', ''),
                'network': offer.get('network', ''),
                'original_payout': boost.get('original_payout', 0),
                'boosted_payout': boost.get('boosted_payout', 0),
                'percentage': boost.get('percentage', 0),
                'direction': boost.get('direction', 'increase'),
                'expires_at': expires_at.isoformat() + 'Z' if isinstance(expires_at, datetime) else str(expires_at or ''),
                'duration_hours': boost.get('duration_hours', 0),
                'applied_at': boost.get('applied_at', ''),
            })

        return result


# Singleton instance
price_boost_service = PriceBoostService()
