import threading
import time
import logging
from datetime import datetime, timedelta
from models.offer import Offer

class OfferSchedulerService:
    """Service to handle scheduled tasks for offers like auto-locking inactive offers"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.offer_model = Offer()
        self.running = False
        self.scheduler_thread = None
        
    def start_scheduler(self):
        """Start the offer scheduler service"""
        if self.running:
            self.logger.warning("Offer scheduler is already running")
            return
            
        self.running = True
        self.scheduler_thread = threading.Thread(target=self._scheduler_loop, daemon=True)
        self.scheduler_thread.start()
        self.logger.info("✅ Offer scheduler service started")
    
    def stop_scheduler(self):
        """Stop the offer scheduler service"""
        self.running = False
        if self.scheduler_thread:
            self.scheduler_thread.join(timeout=5)
        self.logger.info("🛑 Offer scheduler service stopped")
    
    def _scheduler_loop(self):
        """Main scheduler loop that runs scheduled tasks"""
        while self.running:
            try:
                # Run scheduled tasks
                self._check_inactive_offers()
                self._cleanup_old_requests()
                
                # Sleep for 1 hour before next check
                time.sleep(3600)  # 3600 seconds = 1 hour
                
            except Exception as e:
                self.logger.error(f"Error in scheduler loop: {str(e)}", exc_info=True)
                # Sleep for 5 minutes on error before retrying
                time.sleep(300)
    
    def _check_inactive_offers(self):
        """Check and lock inactive offers"""
        try:
            # DISABLED: Auto-locking is disabled for now to allow testing of approval workflow
            self.logger.debug("⏭️  Auto-locking check disabled for testing")
            # locked_offers = self.offer_model.check_and_lock_inactive_offers()
            # 
            # if locked_offers:
            #     self.logger.info(f"🔒 Locked {len(locked_offers)} inactive offers")
            #     for offer in locked_offers:
            #         self.logger.info(f"  - Locked offer {offer['offer_id']}: {offer['name']}")
            # else:
            #     self.logger.info("✅ No inactive offers found to lock")
                
        except Exception as e:
            self.logger.error(f"Error checking inactive offers: {str(e)}", exc_info=True)
    
    def _cleanup_old_requests(self):
        """Clean up old access requests (optional maintenance task)"""
        try:
            from database import db_instance
            
            # Remove requests older than 90 days that are rejected
            cutoff_date = datetime.utcnow() - timedelta(days=90)
            
            requests_collection = db_instance.get_collection('affiliate_requests')
            if requests_collection is not None:
                result = requests_collection.delete_many({
                    'status': 'rejected',
                    'rejected_at': {'$lt': cutoff_date}
                })
                
                if result.deleted_count > 0:
                    self.logger.info(f"🧹 Cleaned up {result.deleted_count} old rejected requests")
                    
        except Exception as e:
            self.logger.error(f"Error cleaning up old requests: {str(e)}", exc_info=True)
    
    def force_check_inactive_offers(self):
        """Manually trigger check for inactive offers (for admin use)"""
        try:
            return self.offer_model.check_and_lock_inactive_offers()
        except Exception as e:
            self.logger.error(f"Error in force check: {str(e)}", exc_info=True)
            return []

# Global instance
offer_scheduler_service = OfferSchedulerService()
