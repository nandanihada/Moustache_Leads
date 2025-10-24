"""
Schedule Activation Service
Handles automated offer activation/deactivation based on schedule configuration
"""

from datetime import datetime, timedelta
from models.offer_extended import OfferExtended
import logging
import schedule
import time
import threading

class ScheduleActivationService:
    
    def __init__(self):
        self.offer_model = OfferExtended()
        self.logger = logging.getLogger(__name__)
        self.stats = {
            'last_run': None,
            'offers_processed': 0,
            'offers_activated': 0,
            'offers_deactivated': 0,
            'errors': 0
        }
    
    def run_activation_check(self):
        """Main cron job function - runs every minute"""
        try:
            start_time = datetime.utcnow()
            self.logger.info("🔄 Starting offer activation check...")
            
            # Reset stats
            self.stats['offers_processed'] = 0
            self.stats['offers_activated'] = 0
            self.stats['offers_deactivated'] = 0
            self.stats['errors'] = 0
            
            # STEP 1: Get all offers with schedules
            offers_with_schedules = self.get_scheduled_offers()
            self.logger.info(f"Found {len(offers_with_schedules)} offers with schedules")
            
            # STEP 2: Process each offer
            current_time = datetime.utcnow()
            for offer in offers_with_schedules:
                try:
                    self.process_offer_activation(offer, current_time)
                    self.stats['offers_processed'] += 1
                except Exception as e:
                    self.logger.error(f"Error processing offer {offer.get('offer_id')}: {str(e)}")
                    self.stats['errors'] += 1
            
            # STEP 3: Update stats and log summary
            self.stats['last_run'] = start_time
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            
            self.logger.info(
                f"✅ Activation check completed in {execution_time:.2f}s - "
                f"Processed: {self.stats['offers_processed']}, "
                f"Activated: {self.stats['offers_activated']}, "
                f"Deactivated: {self.stats['offers_deactivated']}, "
                f"Errors: {self.stats['errors']}"
            )
            
        except Exception as e:
            self.logger.error(f"❌ Activation check failed: {str(e)}", exc_info=True)
            self.stats['errors'] += 1
    
    def get_scheduled_offers(self):
        """Get all offers that have schedule configuration"""
        try:
            if not self.offer_model._check_db_connection():
                self.logger.error("Database connection not available")
                return []
            
            # Query offers with schedule subdocument
            pipeline = [
                {
                    '$match': {
                        'is_active': True,
                        'schedule': {'$exists': True, '$ne': None}
                    }
                },
                {
                    '$project': {
                        'offer_id': 1,
                        'name': 1,
                        'status': 1,
                        'schedule': 1,
                        'smartRules': 1
                    }
                }
            ]
            
            return list(self.offer_model.collection.aggregate(pipeline))
            
        except Exception as e:
            self.logger.error(f"Error fetching scheduled offers: {str(e)}")
            return []
    
    def process_offer_activation(self, offer, current_time):
        """Process individual offer activation logic"""
        
        offer_id = offer['offer_id']
        current_status = offer.get('status')
        schedule = offer.get('schedule', {})
        
        # Skip if no schedule configured
        if not schedule:
            return
        
        # Determine if offer should be active
        should_be_active, reason = self.should_offer_be_active(offer, current_time)
        
        # Update offer status if needed
        if should_be_active and current_status != 'Active':
            self.activate_offer(offer_id, reason)
            self.stats['offers_activated'] += 1
            
        elif not should_be_active and current_status == 'Active':
            self.deactivate_offer(offer_id, reason)
            self.stats['offers_deactivated'] += 1
    
    def should_offer_be_active(self, offer, current_time):
        """
        Determine if offer should be active based on schedule and rules
        
        Returns:
            tuple: (should_be_active: bool, reason: str)
        """
        
        schedule = offer.get('schedule', {})
        
        # STEP 1: Check basic schedule status
        if schedule.get('status') != 'Active':
            return False, "Schedule is paused"
        
        # STEP 2: Check date range
        start_at = schedule.get('startAt')
        end_at = schedule.get('endAt')
        
        # Before start time
        if start_at and current_time < start_at:
            return False, f"Offer starts at {start_at.isoformat()}"
        
        # After end time
        if end_at and current_time > end_at:
            return False, f"Offer expired at {end_at.isoformat()}"
        
        # STEP 3: Check recurring schedule
        if schedule.get('isRecurring') and schedule.get('recurringDays'):
            current_day = current_time.strftime('%A')  # Monday, Tuesday, etc.
            recurring_days = schedule.get('recurringDays', [])
            
            if current_day not in recurring_days:
                return False, f"Not scheduled for {current_day} (active: {', '.join(recurring_days)})"
        
        # STEP 4: Check smart rules availability
        smart_rules = offer.get('smartRules', [])
        active_rules = [rule for rule in smart_rules if rule.get('active', True)]
        
        if len(active_rules) == 0:
            return False, "No active smart rules configured"
        
        # STEP 5: All checks passed
        return True, f"Schedule active with {len(active_rules)} smart rules"
    
    def activate_offer(self, offer_id, reason):
        """Activate an offer"""
        try:
            result = self.offer_model.collection.update_one(
                {'offer_id': offer_id},
                {
                    '$set': {
                        'status': 'Active',
                        'last_activation_check': datetime.utcnow(),
                        'activation_reason': reason,
                        'activated_by_scheduler': True
                    }
                }
            )
            
            if result.modified_count > 0:
                self.logger.info(f"✅ Activated offer {offer_id}: {reason}")
            
        except Exception as e:
            self.logger.error(f"Error activating offer {offer_id}: {str(e)}")
            raise
    
    def deactivate_offer(self, offer_id, reason):
        """Deactivate an offer"""
        try:
            result = self.offer_model.collection.update_one(
                {'offer_id': offer_id},
                {
                    '$set': {
                        'status': 'Inactive',
                        'last_activation_check': datetime.utcnow(),
                        'deactivation_reason': reason,
                        'deactivated_by_scheduler': True
                    }
                }
            )
            
            if result.modified_count > 0:
                self.logger.info(f"❌ Deactivated offer {offer_id}: {reason}")
            
        except Exception as e:
            self.logger.error(f"Error deactivating offer {offer_id}: {str(e)}")
            raise
    
    def daily_cleanup(self):
        """Daily cleanup tasks"""
        try:
            self.logger.info("🧹 Running daily cleanup...")
            
            # Clean up old activation logs (keep last 30 days)
            cutoff_date = datetime.utcnow() - timedelta(days=30)
            
            # Update offers to remove old activation data
            result = self.offer_model.collection.update_many(
                {'last_activation_check': {'$lt': cutoff_date}},
                {
                    '$unset': {
                        'activation_reason': '',
                        'deactivation_reason': '',
                        'activated_by_scheduler': '',
                        'deactivated_by_scheduler': ''
                    }
                }
            )
            
            self.logger.info(f"✅ Cleaned up {result.modified_count} old activation records")
            
        except Exception as e:
            self.logger.error(f"Error in daily cleanup: {str(e)}")
    
    def get_stats(self):
        """Get service statistics"""
        return self.stats.copy()
    
    def force_check_offer(self, offer_id):
        """Force activation check for specific offer"""
        try:
            offer = self.offer_model.collection.find_one({
                'offer_id': offer_id,
                'is_active': True
            })
            
            if not offer:
                return False, "Offer not found"
            
            current_time = datetime.utcnow()
            self.process_offer_activation(offer, current_time)
            
            return True, "Activation check completed"
            
        except Exception as e:
            self.logger.error(f"Error in force check for {offer_id}: {str(e)}")
            return False, str(e)

# Singleton instance
_activation_service = None

def get_activation_service():
    """Get singleton activation service instance"""
    global _activation_service
    if _activation_service is None:
        _activation_service = ScheduleActivationService()
    return _activation_service

def setup_activation_scheduler():
    """Setup cron job scheduler for offer activation"""
    
    activation_service = get_activation_service()
    
    # Every minute check
    schedule.every(1).minutes.do(activation_service.run_activation_check)
    
    # Backup check every 15 minutes
    schedule.every(15).minutes.do(activation_service.run_activation_check)
    
    # Daily cleanup at midnight UTC
    schedule.every().day.at("00:00").do(activation_service.daily_cleanup)
    
    # Start scheduler in background thread
    def run_scheduler():
        while True:
            schedule.run_pending()
            time.sleep(1)
    
    scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
    scheduler_thread.start()
    
    logging.info("📅 Schedule activation service started")

if __name__ == "__main__":
    # Test the service
    logging.basicConfig(level=logging.INFO)
    service = ScheduleActivationService()
    service.run_activation_check()
