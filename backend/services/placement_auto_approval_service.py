"""
Placement Auto-Approval Service
Auto-approves placements after 3 days if admin hasn't acted
"""

import logging
from datetime import datetime, timedelta
from threading import Thread
import time
from bson import ObjectId
from database import db_instance

logger = logging.getLogger(__name__)

AUTO_APPROVAL_DAYS = 3  # Days before auto-approval


class PlacementAutoApprovalService:
    def __init__(self):
        self.placements_collection = db_instance.get_collection('placements')
        self.running = False
        logger.info(f"✅ Placement auto-approval service initialized (auto-approve after {AUTO_APPROVAL_DAYS} days)")

    def auto_approve_old_placements(self):
        """Find and auto-approve placements older than 3 days"""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=AUTO_APPROVAL_DAYS)
            
            # Find pending placements older than 3 days
            pending_placements = self.placements_collection.find({
                'approvalStatus': 'PENDING_APPROVAL',
                'createdAt': {'$lt': cutoff_date}
            })
            
            approved_count = 0
            for placement in pending_placements:
                try:
                    result = self.placements_collection.update_one(
                        {'_id': placement['_id']},
                        {'$set': {
                            'approvalStatus': 'APPROVED',
                            'status': 'LIVE',
                            'approvedBy': None,  # System auto-approved
                            'approvedAt': datetime.utcnow(),
                            'reviewMessage': 'Auto-approved after 3 days.',
                            'autoApproved': True,
                            'updatedAt': datetime.utcnow()
                        }}
                    )
                    
                    if result.modified_count > 0:
                        approved_count += 1
                        logger.info(f"✅ Auto-approved placement: {placement.get('placementIdentifier', placement['_id'])}")
                        
                except Exception as e:
                    logger.error(f"❌ Failed to auto-approve placement {placement['_id']}: {e}")
            
            if approved_count > 0:
                logger.info(f"📊 Auto-approved {approved_count} placements")
            
            return approved_count
            
        except Exception as e:
            logger.error(f"❌ Error in auto-approval check: {e}")
            return 0

    def start_service(self):
        """Start background auto-approval service"""
        if self.running:
            logger.warning("Auto-approval service already running")
            return
        
        self.running = True
        
        def check_loop():
            while self.running:
                try:
                    self.auto_approve_old_placements()
                except Exception as e:
                    logger.error(f"Error in auto-approval loop: {e}")
                
                # Check every hour
                time.sleep(3600)
        
        thread = Thread(target=check_loop, daemon=True)
        thread.start()
        logger.info("✅ Placement auto-approval service started (checks every hour)")

    def stop_service(self):
        """Stop the service"""
        self.running = False
        logger.info("Placement auto-approval service stopped")


# Singleton instance
placement_auto_approval_service = PlacementAutoApprovalService()


def get_placement_auto_approval_service():
    return placement_auto_approval_service
