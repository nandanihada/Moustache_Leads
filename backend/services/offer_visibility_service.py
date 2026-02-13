"""
Offer Visibility Service

Handles offer visibility based on approval workflow settings:
1. auto_approve - Offer is immediately visible and accessible
2. time_based - Offer becomes visible after a delay period
3. manual - Offer requires manual admin approval to be visible

This service determines which offers a user can see and access.
"""

from database import db_instance
from datetime import datetime, timedelta
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)


class OfferVisibilityService:
    """Service to manage offer visibility based on approval workflow"""
    
    def __init__(self):
        self.offers_collection = db_instance.get_collection('offers')
        self.users_collection = db_instance.get_collection('users')
        self.affiliate_requests_collection = db_instance.get_collection('affiliate_requests')
        self.offer_visibility_collection = db_instance.get_collection('offer_visibility')
    
    def get_offer_visibility_status(self, offer, user_id=None):
        """
        Determine the visibility status of an offer for a specific user.
        
        Returns:
            dict: {
                'is_visible': bool,  # Can user see the offer at all
                'is_locked': bool,   # Is the offer locked (visible but not accessible)
                'has_access': bool,  # Does user have full access
                'lock_reason': str,  # Why the offer is locked
                'unlock_time': datetime,  # When the offer will unlock (for time_based)
                'approval_type': str,  # auto_approve, time_based, manual
                'request_status': str  # pending, approved, rejected, not_requested
            }
        """
        try:
            # Get approval settings from offer
            approval_settings = offer.get('approval_settings', {})
            approval_type = approval_settings.get('type', 'manual')  # Default to manual
            require_approval = approval_settings.get('require_approval', False)
            
            # Check affiliates field - this is the PRIMARY indicator of approval requirement
            affiliates = offer.get('affiliates', 'all')
            
            # If affiliates is 'request', it ALWAYS requires manual approval regardless of approval_settings
            if affiliates == 'request':
                approval_type = 'manual'  # Force manual approval
            
            # Default response for public offers (affiliates == 'all' and no special approval required)
            if affiliates == 'all' and approval_type == 'auto_approve' and not require_approval:
                return {
                    'is_visible': True,
                    'is_locked': False,
                    'has_access': True,
                    'lock_reason': None,
                    'unlock_time': None,
                    'approval_type': 'auto_approve',
                    'request_status': 'approved',
                    'estimated_approval_time': 'Immediate'
                }
            
            # For offers requiring approval, check user's access status
            if user_id:
                request_status = self._get_user_request_status(offer.get('offer_id'), user_id)
            else:
                request_status = 'not_requested'
            
            # Determine visibility based on approval type
            if approval_type == 'auto_approve':
                # Auto-approve: visible and accessible immediately
                return {
                    'is_visible': True,
                    'is_locked': False,
                    'has_access': True,
                    'lock_reason': None,
                    'unlock_time': None,
                    'approval_type': 'auto_approve',
                    'request_status': 'approved',
                    'estimated_approval_time': 'Immediate'
                }
            
            elif approval_type == 'time_based':
                # Time-based: visible but locked until delay passes
                delay_minutes = approval_settings.get('auto_approve_delay', 60)
                created_at = offer.get('created_at', datetime.utcnow())
                unlock_time = created_at + timedelta(minutes=delay_minutes)
                
                is_unlocked = datetime.utcnow() >= unlock_time
                
                # Check if user has approved request
                if request_status == 'approved':
                    return {
                        'is_visible': True,
                        'is_locked': False,
                        'has_access': True,
                        'lock_reason': None,
                        'unlock_time': None,
                        'approval_type': 'time_based',
                        'request_status': 'approved',
                        'estimated_approval_time': 'Approved'
                    }
                
                if is_unlocked:
                    # Time has passed, auto-approve any pending requests
                    if request_status == 'pending':
                        self._auto_approve_request(offer.get('offer_id'), user_id)
                    
                    return {
                        'is_visible': True,
                        'is_locked': False,
                        'has_access': True,
                        'lock_reason': None,
                        'unlock_time': None,
                        'approval_type': 'time_based',
                        'request_status': 'approved',
                        'estimated_approval_time': 'Approved'
                    }
                else:
                    # Still locked
                    time_remaining = unlock_time - datetime.utcnow()
                    return {
                        'is_visible': True,
                        'is_locked': True,
                        'has_access': False,
                        'lock_reason': f'Auto-unlocks in {self._format_time_remaining(time_remaining)}',
                        'unlock_time': unlock_time,
                        'approval_type': 'time_based',
                        'request_status': request_status,
                        'estimated_approval_time': self._format_time_remaining(time_remaining)
                    }
            
            elif approval_type == 'manual':
                # Manual: visible but locked until admin approves
                if request_status == 'approved':
                    return {
                        'is_visible': True,
                        'is_locked': False,
                        'has_access': True,
                        'lock_reason': None,
                        'unlock_time': None,
                        'approval_type': 'manual',
                        'request_status': 'approved',
                        'estimated_approval_time': 'Approved'
                    }
                elif request_status == 'pending':
                    return {
                        'is_visible': True,
                        'is_locked': True,
                        'has_access': False,
                        'lock_reason': 'Awaiting admin approval',
                        'unlock_time': None,
                        'approval_type': 'manual',
                        'request_status': 'pending',
                        'estimated_approval_time': 'Pending admin review'
                    }
                elif request_status == 'rejected':
                    return {
                        'is_visible': True,
                        'is_locked': True,
                        'has_access': False,
                        'lock_reason': 'Access request was rejected',
                        'unlock_time': None,
                        'approval_type': 'manual',
                        'request_status': 'rejected',
                        'estimated_approval_time': 'Rejected'
                    }
                else:
                    return {
                        'is_visible': True,
                        'is_locked': True,
                        'has_access': False,
                        'lock_reason': 'Requires admin approval',
                        'unlock_time': None,
                        'approval_type': 'manual',
                        'request_status': 'not_requested',
                        'estimated_approval_time': 'Manual review required'
                    }
            
            # Default fallback
            return {
                'is_visible': True,
                'is_locked': False,
                'has_access': True,
                'lock_reason': None,
                'unlock_time': None,
                'approval_type': approval_type,
                'request_status': request_status,
                'estimated_approval_time': 'Immediate'
            }
            
        except Exception as e:
            logger.error(f"Error getting offer visibility status: {str(e)}")
            # Default to visible and accessible on error
            return {
                'is_visible': True,
                'is_locked': False,
                'has_access': True,
                'lock_reason': None,
                'unlock_time': None,
                'approval_type': 'auto_approve',
                'request_status': 'approved',
                'estimated_approval_time': 'Immediate'
            }
    
    def _get_user_request_status(self, offer_id, user_id):
        """Get the user's access request status for an offer"""
        try:
            if self.affiliate_requests_collection is None:
                logger.warning("affiliate_requests_collection not available")
                return 'not_requested'
            
            # Convert user_id to string for comparison
            user_id_str = str(user_id)
            
            # Try to convert to ObjectId as well
            try:
                from bson import ObjectId
                user_obj_id = ObjectId(user_id_str) if ObjectId.is_valid(user_id_str) else None
            except:
                user_obj_id = None
            
            # Build query to match both string and ObjectId formats
            query = {'offer_id': offer_id}
            or_conditions = [
                {'user_id': user_id_str},
                {'user_id': user_id},
                {'publisher_id': user_id_str},
                {'publisher_id': user_id}
            ]
            if user_obj_id:
                or_conditions.extend([
                    {'user_id': user_obj_id},
                    {'publisher_id': user_obj_id}
                ])
            query['$or'] = or_conditions
            
            request = self.affiliate_requests_collection.find_one(query)
            
            if not request:
                logger.debug(f"No request found for offer {offer_id}, user {user_id_str}")
                return 'not_requested'
            
            status = request.get('status', 'pending')
            logger.info(f"Found request for offer {offer_id}, user {user_id_str}: status={status}")
            return status
            
        except Exception as e:
            logger.error(f"Error getting user request status: {str(e)}")
            return 'not_requested'
    
    def _auto_approve_request(self, offer_id, user_id):
        """Auto-approve a pending request"""
        try:
            if self.affiliate_requests_collection is None:
                return
            
            user_id_str = str(user_id)
            
            self.affiliate_requests_collection.update_one(
                {
                    'offer_id': offer_id,
                    '$or': [
                        {'user_id': user_id_str},
                        {'user_id': user_id}
                    ],
                    'status': 'pending'
                },
                {
                    '$set': {
                        'status': 'approved',
                        'approved_at': datetime.utcnow(),
                        'approved_by': 'system_auto',
                        'approval_notes': 'Auto-approved after time delay'
                    }
                }
            )
            logger.info(f"Auto-approved request for offer {offer_id}, user {user_id}")
            
        except Exception as e:
            logger.error(f"Error auto-approving request: {str(e)}")
    
    def _format_time_remaining(self, time_delta):
        """Format time remaining in human-readable format"""
        total_seconds = int(time_delta.total_seconds())
        
        if total_seconds < 0:
            return 'Now'
        
        if total_seconds < 60:
            return f'{total_seconds} seconds'
        
        minutes = total_seconds // 60
        if minutes < 60:
            return f'{minutes} minute{"s" if minutes != 1 else ""}'
        
        hours = minutes // 60
        if hours < 24:
            remaining_minutes = minutes % 60
            if remaining_minutes > 0:
                return f'{hours} hour{"s" if hours != 1 else ""} {remaining_minutes} min'
            return f'{hours} hour{"s" if hours != 1 else ""}'
        
        days = hours // 24
        remaining_hours = hours % 24
        if remaining_hours > 0:
            return f'{days} day{"s" if days != 1 else ""} {remaining_hours} hr'
        return f'{days} day{"s" if days != 1 else ""}'
    
    def get_offers_with_visibility(self, user_id=None, filters=None):
        """
        Get all offers with their visibility status for a user.
        
        Args:
            user_id: The user ID to check visibility for
            filters: Optional filters (status, category, etc.)
        
        Returns:
            list: List of offers with visibility information
        """
        try:
            # Build query
            query = {
                'is_active': True,
                '$or': [
                    {'deleted': {'$exists': False}},
                    {'deleted': False}
                ]
            }
            
            if filters:
                if filters.get('status'):
                    query['status'] = filters['status']
                if filters.get('category'):
                    query['$or'] = [
                        {'category': {'$regex': filters['category'], '$options': 'i'}},
                        {'vertical': {'$regex': filters['category'], '$options': 'i'}}
                    ]
            
            # Get offers
            offers = list(self.offers_collection.find(query).sort('created_at', -1))
            
            # Add visibility status to each offer
            for offer in offers:
                visibility = self.get_offer_visibility_status(offer, user_id)
                offer['visibility'] = visibility
                offer['is_locked'] = visibility['is_locked']
                offer['has_access'] = visibility['has_access']
                offer['lock_reason'] = visibility['lock_reason']
                offer['approval_type'] = visibility['approval_type']
                offer['request_status'] = visibility['request_status']
                offer['estimated_approval_time'] = visibility['estimated_approval_time']
                
                # Convert ObjectId to string
                offer['_id'] = str(offer['_id'])
            
            return offers
            
        except Exception as e:
            logger.error(f"Error getting offers with visibility: {str(e)}")
            return []
    
    def check_offer_access(self, offer_id, user_id):
        """
        Check if a user has access to a specific offer.
        
        Returns:
            tuple: (has_access: bool, reason: str)
        """
        try:
            offer = self.offers_collection.find_one({'offer_id': offer_id})
            
            if not offer:
                return False, 'Offer not found'
            
            visibility = self.get_offer_visibility_status(offer, user_id)
            
            if visibility['has_access']:
                return True, 'Access granted'
            else:
                return False, visibility['lock_reason'] or 'Access denied'
            
        except Exception as e:
            logger.error(f"Error checking offer access: {str(e)}")
            return False, f'Error: {str(e)}'


# Create singleton instance
offer_visibility_service = OfferVisibilityService()
