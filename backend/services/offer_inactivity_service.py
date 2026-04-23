"""
Offer Inactivity Service
Marks running/active offers as inactive if they haven't received any clicks in 70 days.
The 70-day window is rolling — based on the last click date for each offer.
"""

import logging
from datetime import datetime, timedelta
from threading import Thread
import time
from dateutil.parser import parse
from database import db_instance

logger = logging.getLogger(__name__)

INACTIVITY_DAYS = 70
CHECK_INTERVAL_SECONDS = 6 * 3600  # Check every 6 hours


class OfferInactivityService:
    def __init__(self):
        self.offers_collection = db_instance.get_collection('offers')
        self.running = False
        logger.info(f"✅ Offer inactivity service initialized (threshold: {INACTIVITY_DAYS} days)")

    def _to_datetime(self, val):
        """Standardize various date formats into naive UTC datetime objects for consistency."""
        if val is None:
            return None
        if isinstance(val, datetime):
            if val.tzinfo is not None:
                from datetime import timezone
                return val.astimezone(timezone.utc).replace(tzinfo=None)
            return val
        if isinstance(val, str):
            try:
                dt = parse(val)
                if dt.tzinfo is not None:
                    from datetime import timezone
                    dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
                return dt
            except Exception:
                return None
        return None

    def _get_last_click_dates(self, offer_ids):
        """Query all click collections to find the most recent click per offer."""
        last_clicks = {}  # offer_id -> datetime

        click_sources = [
            ('clicks', ['offer_id', 'offerId']),
            ('offerwall_clicks', ['offer_id']),
            ('offerwall_clicks_detailed', ['offer_id']),
            ('dashboard_clicks', ['offer_id']),
        ]

        for col_name, id_fields in click_sources:
            col = db_instance.get_collection(col_name)
            if col is None:
                continue
            try:
                for field in id_fields:
                    pipeline = [
                        {'$match': {field: {'$in': list(offer_ids)}}},
                        {'$group': {
                            '_id': f'${field}',
                            'last_click': {'$max': '$timestamp'},
                        }},
                    ]
                    for doc in col.aggregate(pipeline):
                        oid = str(doc['_id']) if doc['_id'] else None
                        if not oid:
                            continue
                        
                        current_lcd = self._to_datetime(doc.get('last_click'))
                        if not current_lcd:
                            continue
                            
                        existing = self._to_datetime(last_clicks.get(oid))
                        if not existing or current_lcd > existing:
                            last_clicks[oid] = current_lcd
            except Exception as e:
                logger.warning(f"Inactivity check - failed to query {col_name}: {e}")

        return last_clicks

    def check_and_deactivate_inactive_offers(self):
        """Find active offers with no clicks in 30 days and mark them inactive."""
        try:
            if self.offers_collection is None:
                logger.warning("Offers collection not available")
                return 0

            cutoff_date = datetime.utcnow() - timedelta(days=INACTIVITY_DAYS)

            # Get all active offers
            active_offers = list(self.offers_collection.find(
                {'status': 'active'},
                {'offer_id': 1, 'name': 1, 'last_click_date': 1, 'created_at': 1}
            ))

            if not active_offers:
                return 0

            offer_ids = [o['offer_id'] for o in active_offers if o.get('offer_id')]

            # Check last_click_date field first (fast path — set by click tracking)
            # For offers without last_click_date, query click collections
            needs_lookup = []
            candidates = []

            for offer in active_offers:
                lcd_raw = offer.get('last_click_date')
                lcd = self._to_datetime(lcd_raw)
                if lcd:
                    if lcd < cutoff_date:
                        candidates.append(offer)
                    # else: clicked recently, skip
                else:
                    needs_lookup.append(offer)

            # Batch-lookup click dates for offers missing last_click_date
            if needs_lookup:
                lookup_ids = [o['offer_id'] for o in needs_lookup if o.get('offer_id')]
                if lookup_ids:
                    click_dates = self._get_last_click_dates(set(lookup_ids))
                    for offer in needs_lookup:
                        oid = offer.get('offer_id')
                        lcd = self._to_datetime(click_dates.get(oid))
                        if lcd:
                            # Backfill last_click_date on the offer for future fast-path
                            self.offers_collection.update_one(
                                {'offer_id': oid},
                                {'$set': {'last_click_date': lcd}}
                            )
                            if lcd < cutoff_date:
                                candidates.append(offer)
                        else:
                            # Never clicked — check if offer was created more than 30 days ago
                            created = self._to_datetime(offer.get('created_at'))
                            if created and created < cutoff_date:
                                candidates.append(offer)

            # Deactivate candidates
            deactivated = 0
            for offer in candidates:
                try:
                    result = self.offers_collection.update_one(
                        {'offer_id': offer['offer_id'], 'status': 'active'},
                        {'$set': {
                            'status': 'inactive',
                            'auto_deactivated': True,
                            'auto_deactivated_at': datetime.utcnow(),
                            'auto_deactivation_reason': f'No clicks in {INACTIVITY_DAYS} days',
                            'updated_at': datetime.utcnow(),
                        }}
                    )
                    if result.modified_count > 0:
                        deactivated += 1
                        logger.info(
                            f"⏸️ Auto-deactivated offer: {offer.get('name', offer['offer_id'])} "
                            f"(no clicks in {INACTIVITY_DAYS} days)"
                        )
                except Exception as e:
                    logger.error(f"❌ Failed to deactivate offer {offer.get('offer_id')}: {e}")

            if deactivated > 0:
                logger.info(f"📊 Auto-deactivated {deactivated} offers due to inactivity")

            return deactivated

        except Exception as e:
            logger.error(f"❌ Error in offer inactivity check: {e}")
            return 0

    def start_service(self):
        """Start background inactivity check service."""
        if self.running:
            logger.warning("Offer inactivity service already running")
            return

        self.running = True

        def check_loop():
            while self.running:
                try:
                    self.check_and_deactivate_inactive_offers()
                except Exception as e:
                    logger.error(f"Error in offer inactivity loop: {e}")

                time.sleep(CHECK_INTERVAL_SECONDS)

        thread = Thread(target=check_loop, daemon=True)
        thread.start()
        logger.info(f"✅ Offer inactivity service started (checks every {CHECK_INTERVAL_SECONDS // 3600}h)")

    def stop_service(self):
        """Stop the service."""
        self.running = False
        logger.info("Offer inactivity service stopped")


# Singleton
_offer_inactivity_service = OfferInactivityService()


def get_offer_inactivity_service():
    return _offer_inactivity_service
