"""
Invoice Scheduler Service
Runs on the 1st of every month to auto-generate invoices for the previous month.
Uses threading.Timer to check daily and trigger on the 1st.
"""

import threading
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

_invoice_scheduler = None


class InvoiceSchedulerService:
    def __init__(self):
        self.running = False
        self.timer = None
        self.last_generated_month = None

    def start(self):
        """Start the daily check loop."""
        if self.running:
            return
        self.running = True
        logger.info("📅 Invoice scheduler started")
        # On startup, backfill any missed months first
        self._backfill_missing_months()
        # Then start the periodic check
        self._check_and_schedule()

    def stop(self):
        """Stop the scheduler."""
        self.running = False
        if self.timer:
            self.timer.cancel()
            self.timer = None
        logger.info("📅 Invoice scheduler stopped")

    def _backfill_missing_months(self):
        """
        On every startup, check all past months that have conversions but no invoice generated.
        Generate invoices for any missing months. This ensures no month is ever missed
        even if the server was down on the 1st.
        """
        try:
            from database import db_instance
            if not db_instance.is_connected():
                return

            conversions_col = db_instance.get_collection('forwarded_postbacks')
            invoices_col = db_instance.get_collection('invoices')
            if conversions_col is None or invoices_col is None:
                return

            now = datetime.utcnow()

            # Find the earliest conversion date to know how far back to check
            earliest = conversions_col.find_one(
                {'source': {'$nin': ['fallback_fake']}},
                sort=[('timestamp', 1)]
            )
            if not earliest or not earliest.get('timestamp'):
                return

            start_date = earliest['timestamp']
            # Generate for each month from start_date up to last month
            current = datetime(start_date.year, start_date.month, 1)
            last_month = datetime(now.year, now.month, 1) - timedelta(days=1)
            last_month_start = datetime(last_month.year, last_month.month, 1)

            months_generated = 0
            while current <= last_month_start:
                year = current.year
                month = current.month

                # Check if any invoice exists for this month (any user)
                # We only need to check if generation was already done
                existing_count = invoices_col.count_documents({
                    'period_start': datetime(year, month, 1)
                })

                if existing_count == 0:
                    # No invoices for this month — generate them
                    try:
                        from routes.admin_invoices import _generate_invoices_for_month
                        count = _generate_invoices_for_month(year, month)
                        if count > 0:
                            months_generated += 1
                            logger.info(f"📅 Backfilled {count} invoices for {year}-{month:02d}")
                    except Exception as e:
                        logger.warning(f"📅 Failed to backfill {year}-{month:02d}: {e}")

                # Move to next month
                if month == 12:
                    current = datetime(year + 1, 1, 1)
                else:
                    current = datetime(year, month + 1, 1)

            if months_generated > 0:
                logger.info(f"📅 Backfill complete: generated invoices for {months_generated} missed months")
            else:
                logger.info("📅 Backfill check: all months already have invoices")

        except Exception as e:
            logger.error(f"📅 Backfill error: {e}")

    def _check_and_schedule(self):
        """Check if today is the 1st and generate invoices if needed."""
        if not self.running:
            return

        try:
            now = datetime.utcnow()
            current_month_key = f"{now.year}-{now.month:02d}"

            # Only run on the 1st of the month (or if we missed it, catch up)
            if now.day <= 3 and self.last_generated_month != current_month_key:
                # Generate for previous month
                prev_month_end = now.replace(day=1) - timedelta(days=1)
                year = prev_month_end.year
                month = prev_month_end.month

                logger.info(f"📅 Auto-generating invoices for {year}-{month:02d}")
                try:
                    from routes.admin_invoices import _generate_invoices_for_month
                    count = _generate_invoices_for_month(year, month)
                    logger.info(f"📅 Auto-generated {count} invoices for {year}-{month:02d}")
                    self.last_generated_month = current_month_key
                except Exception as e:
                    logger.error(f"📅 Failed to auto-generate invoices: {e}")

        except Exception as e:
            logger.error(f"📅 Invoice scheduler error: {e}")

        # Schedule next check in 12 hours
        if self.running:
            self.timer = threading.Timer(43200, self._check_and_schedule)  # 12 hours
            self.timer.daemon = True
            self.timer.start()


def get_invoice_scheduler():
    global _invoice_scheduler
    if _invoice_scheduler is None:
        _invoice_scheduler = InvoiceSchedulerService()
    return _invoice_scheduler
