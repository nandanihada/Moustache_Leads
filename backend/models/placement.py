from datetime import datetime
from bson import ObjectId
from database import db_instance
import secrets
import string
import re
import logging

logger = logging.getLogger(__name__)


def generate_placement_identifier():
    """Generate a unique placement identifier"""
    return ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(16))


def generate_api_key():
    """Generate a secure API key for placement access"""
    return ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32))


def validate_url(url):
    """Validate URL format"""
    url_pattern = re.compile(
        r'^https?://'  # http:// or https://
        r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain...
        r'localhost|'  # localhost...
        r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
        r'(?::\d+)?'  # optional port
        r'(?:/?|[/?]\S+)$', re.IGNORECASE)
    return url_pattern.match(url) is not None


class Placement:
    def __init__(self):
        self.collection = db_instance.get_collection('placements')
    
    def _check_db_connection(self):
        """Check if database is connected and usable"""
        if self.collection is None or not db_instance.is_connected():
            return False
        
        try:
            self.collection.find_one({}, {'_id': 1})
            return True
        except Exception:
            return False
    
    def create_placement(self, publisher_id, placement_data):
        """Create a new placement"""
        if not self._check_db_connection():
            return None, "Database connection not available"
        
        # Validate required fields
        required_fields = ['platformType', 'offerwallTitle', 'currencyName', 'exchangeRate', 'postbackUrl']
        for field in required_fields:
            if field not in placement_data or not placement_data[field]:
                return None, f"{field} is required"
        
        # Validate platform type
        valid_platforms = ['website', 'iOS', 'android']
        if placement_data['platformType'] not in valid_platforms:
            return None, f"platformType must be one of: {', '.join(valid_platforms)}"
        
        # Validate exchange rate
        try:
            exchange_rate = float(placement_data['exchangeRate'])
            if exchange_rate <= 0:
                return None, "Exchange rate must be greater than 0"
        except (ValueError, TypeError):
            return None, "Exchange rate must be a valid number"
        
        # Validate postback URL
        if not validate_url(placement_data['postbackUrl']):
            return None, "Invalid postback URL format"
        
        # Validate status - now includes approval statuses
        valid_statuses = ['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'LIVE', 'PAUSED', 'INACTIVE']
        status = placement_data.get('status', 'PENDING_APPROVAL')  # Default to pending approval
        if status not in valid_statuses:
            return None, f"Status must be one of: {', '.join(valid_statuses)}"
        
        # Create placement document
        placement_doc = {
            'publisherId': ObjectId(publisher_id),
            'placementIdentifier': generate_placement_identifier(),
            'apiKey': generate_api_key(),
            'platformType': placement_data['platformType'],
            'offerwallTitle': placement_data['offerwallTitle'].strip(),
            'currencyName': placement_data['currencyName'].strip(),
            'exchangeRate': exchange_rate,
            'postbackUrl': placement_data['postbackUrl'].strip(),
            'status': status,
            'approvalStatus': status if status in ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'] else 'PENDING_APPROVAL',
            'approvedBy': None,
            'approvedAt': None,
            'rejectionReason': None,
            'reviewMessage': 'Your placement is under review. We will notify you once it\'s approved.',
            'createdAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow()
        }
        
        try:
            result = self.collection.insert_one(placement_doc)
            placement_doc['_id'] = result.inserted_id
            return placement_doc, None
        except Exception as e:
            logger.error(f"Error creating placement: {e}")
            return None, f"Error creating placement: {str(e)}"
    
    def get_placements_by_publisher(self, publisher_id, page=1, size=10, status_filter=None, platform_filter=None):
        """Get placements for a publisher with pagination and filters"""
        if not self._check_db_connection():
            return [], 0, "Database connection not available"
        
        try:
            # Build query filter
            query_filter = {'publisherId': ObjectId(publisher_id)}
            
            if status_filter:
                query_filter['status'] = status_filter
            
            if platform_filter:
                query_filter['platformType'] = platform_filter
            
            # Calculate skip value for pagination
            skip = (page - 1) * size
            
            # Get total count
            total = self.collection.count_documents(query_filter)
            
            # Get placements with pagination
            placements = list(
                self.collection.find(query_filter)
                .skip(skip)
                .limit(size)
                .sort('createdAt', -1)
            )
            
            return placements, total, None
        except Exception as e:
            logger.error(f"Error fetching placements: {e}")
            return [], 0, f"Error fetching placements: {str(e)}"
    
    def get_placement_by_id(self, placement_id, publisher_id):
        """Get a specific placement by ID (with publisher ownership check)"""
        if not self._check_db_connection():
            return None, "Database connection not available"
        
        try:
            placement = self.collection.find_one({
                '_id': ObjectId(placement_id),
                'publisherId': ObjectId(publisher_id)
            })
            return placement, None
        except Exception as e:
            logger.error(f"Error fetching placement: {e}")
            return None, f"Error fetching placement: {str(e)}"
    
    def update_placement(self, placement_id, publisher_id, update_data):
        """Update a placement"""
        if not self._check_db_connection():
            return None, "Database connection not available"
        
        try:
            # Verify placement exists and belongs to publisher
            existing = self.collection.find_one({
                '_id': ObjectId(placement_id),
                'publisherId': ObjectId(publisher_id)
            })
            
            if not existing:
                return None, "Placement not found"
            
            # Validate update data
            valid_fields = ['offerwallTitle', 'currencyName', 'exchangeRate', 'postbackUrl', 'status']
            update_doc = {}
            
            for field, value in update_data.items():
                if field in valid_fields and value is not None:
                    if field == 'exchangeRate':
                        try:
                            exchange_rate = float(value)
                            if exchange_rate <= 0:
                                return None, "Exchange rate must be greater than 0"
                            update_doc[field] = exchange_rate
                        except (ValueError, TypeError):
                            return None, "Exchange rate must be a valid number"
                    elif field == 'postbackUrl':
                        if not validate_url(value):
                            return None, "Invalid postback URL format"
                        update_doc[field] = value.strip()
                    elif field == 'status':
                        valid_statuses = ['LIVE', 'PAUSED', 'INACTIVE']
                        if value not in valid_statuses:
                            return None, f"Status must be one of: {', '.join(valid_statuses)}"
                        update_doc[field] = value
                    elif field in ['offerwallTitle', 'currencyName']:
                        if not value.strip():
                            return None, f"{field} cannot be empty"
                        update_doc[field] = value.strip()
            
            if not update_doc:
                return None, "No valid fields to update"
            
            # Add updated timestamp
            update_doc['updatedAt'] = datetime.utcnow()
            
            # Update placement
            result = self.collection.update_one(
                {'_id': ObjectId(placement_id)},
                {'$set': update_doc}
            )
            
            if result.modified_count == 0:
                return None, "No changes made"
            
            # Return updated placement
            updated_placement = self.collection.find_one({'_id': ObjectId(placement_id)})
            return updated_placement, None
            
        except Exception as e:
            logger.error(f"Error updating placement: {e}")
            return None, f"Error updating placement: {str(e)}"
    
    def delete_placement(self, placement_id, publisher_id):
        """Delete a placement (soft delete by setting status to INACTIVE)"""
        if not self._check_db_connection():
            return False, "Database connection not available"
        
        try:
            # Verify placement exists and belongs to publisher
            existing = self.collection.find_one({
                '_id': ObjectId(placement_id),
                'publisherId': ObjectId(publisher_id)
            })
            
            if not existing:
                return False, "Placement not found"
            
            # Soft delete by setting status to INACTIVE
            result = self.collection.update_one(
                {'_id': ObjectId(placement_id)},
                {'$set': {
                    'status': 'INACTIVE',
                    'deletedAt': datetime.utcnow(),
                    'updatedAt': datetime.utcnow()
                }}
            )
            
            return result.modified_count > 0, None
            
        except Exception as e:
            logger.error(f"Error deleting placement: {e}")
            return False, f"Error deleting placement: {str(e)}"
    
    def validate_placement_access(self, placement_id, api_key):
        """Validate placement exists, is active, and API key matches"""
        if not self._check_db_connection():
            return None, "Database connection not available"
        
        try:
            placement = self.collection.find_one({
                'placementIdentifier': placement_id,
                'apiKey': api_key,
                'status': 'LIVE'  # Only allow access to LIVE placements
            })
            
            if not placement:
                return None, "Invalid placement ID, API key, or placement not active"
            
            return placement, None
            
        except Exception as e:
            logger.error(f"Error validating placement access: {e}")
            return None, f"Error validating placement access: {str(e)}"
    
    def migrate_add_api_keys(self):
        """Add API keys to existing placements that don't have them"""
        if not self._check_db_connection():
            return False, "Database connection not available"
        
        try:
            # Find placements without apiKey field
            placements_without_keys = self.collection.find({'apiKey': {'$exists': False}})
            updated_count = 0
            
            for placement in placements_without_keys:
                # Generate API key for this placement
                api_key = generate_api_key()
                
                # Update the placement
                result = self.collection.update_one(
                    {'_id': placement['_id']},
                    {
                        '$set': {
                            'apiKey': api_key,
                            'updatedAt': datetime.utcnow()
                        }
                    }
                )
                
                if result.modified_count > 0:
                    updated_count += 1
                    logger.info(f"Added API key to placement {placement['placementIdentifier']}")
            
            return True, f"Added API keys to {updated_count} placements"
            
        except Exception as e:
            logger.error(f"Error migrating API keys: {e}")
            return False, f"Error migrating API keys: {str(e)}"
    
    def get_all_placements_for_admin(self, page=1, size=10, status_filter=None, platform_filter=None):
        """Get all placements for admin review with pagination and filters"""
        if not self._check_db_connection():
            return [], 0, "Database connection not available"
        
        try:
            # Build query filter
            query_filter = {}
            
            if status_filter:
                query_filter['approvalStatus'] = status_filter
            
            if platform_filter:
                query_filter['platformType'] = platform_filter
            
            # Calculate skip value for pagination
            skip = (page - 1) * size
            
            # Get total count
            total = self.collection.count_documents(query_filter)
            
            # Get placements with pagination and populate publisher info
            pipeline = [
                {'$match': query_filter},
                {'$lookup': {
                    'from': 'users',
                    'localField': 'publisherId',
                    'foreignField': '_id',
                    'as': 'publisher'
                }},
                {'$unwind': {
                    'path': '$publisher',
                    'preserveNullAndEmptyArrays': True
                }},
                {'$addFields': {
                    'publisherName': {'$ifNull': ['$publisher.username', 'Unknown']},
                    'publisherEmail': {'$ifNull': ['$publisher.email', 'N/A']},
                    'publisherRole': {'$ifNull': ['$publisher.role', 'user']},
                    'publisherCreatedAt': {'$ifNull': ['$publisher.created_at', None]}
                }},
                {'$sort': {'createdAt': -1}},
                {'$skip': skip},
                {'$limit': size}
            ]
            
            placements = list(self.collection.aggregate(pipeline))
            
            return placements, total, None
        except Exception as e:
            logger.error(f"Error fetching admin placements: {e}")
            return [], 0, f"Error fetching admin placements: {str(e)}"
    
    def approve_placement(self, placement_id, admin_user_id, message=None):
        """Approve a placement"""
        if not self._check_db_connection():
            return None, "Database connection not available"
        
        try:
            # Check if placement exists and is pending
            placement = self.collection.find_one({
                '_id': ObjectId(placement_id),
                'approvalStatus': 'PENDING_APPROVAL'
            })
            
            if not placement:
                return None, "Placement not found or already processed"
            
            # Update placement to approved
            update_doc = {
                'approvalStatus': 'APPROVED',
                'status': 'LIVE',  # Automatically set to LIVE when approved
                'approvedBy': ObjectId(admin_user_id),
                'approvedAt': datetime.utcnow(),
                'reviewMessage': message or 'Your placement has been approved and is now live!',
                'updatedAt': datetime.utcnow()
            }
            
            result = self.collection.update_one(
                {'_id': ObjectId(placement_id)},
                {'$set': update_doc}
            )
            
            if result.modified_count == 0:
                return None, "Failed to approve placement"
            
            # Return updated placement
            updated_placement = self.collection.find_one({'_id': ObjectId(placement_id)})
            return updated_placement, None
            
        except Exception as e:
            logger.error(f"Error approving placement: {e}")
            return None, f"Error approving placement: {str(e)}"
    
    def reject_placement(self, placement_id, admin_user_id, reason, message=None):
        """Reject a placement"""
        if not self._check_db_connection():
            return None, "Database connection not available"
        
        try:
            # Check if placement exists and is pending
            placement = self.collection.find_one({
                '_id': ObjectId(placement_id),
                'approvalStatus': 'PENDING_APPROVAL'
            })
            
            if not placement:
                return None, "Placement not found or already processed"
            
            # Update placement to rejected
            update_doc = {
                'approvalStatus': 'REJECTED',
                'status': 'INACTIVE',  # Set to inactive when rejected
                'approvedBy': ObjectId(admin_user_id),
                'approvedAt': datetime.utcnow(),
                'rejectionReason': reason,
                'reviewMessage': message or f'Your placement has been rejected. Reason: {reason}',
                'updatedAt': datetime.utcnow()
            }
            
            result = self.collection.update_one(
                {'_id': ObjectId(placement_id)},
                {'$set': update_doc}
            )
            
            if result.modified_count == 0:
                return None, "Failed to reject placement"
            
            # Return updated placement
            updated_placement = self.collection.find_one({'_id': ObjectId(placement_id)})
            return updated_placement, None
            
        except Exception as e:
            logger.error(f"Error rejecting placement: {e}")
            return None, f"Error rejecting placement: {str(e)}"
    
    def get_pending_placements_count(self):
        """Get count of pending placements for admin dashboard"""
        if not self._check_db_connection():
            return 0
        
        try:
            return self.collection.count_documents({'approvalStatus': 'PENDING_APPROVAL'})
        except Exception as e:
            logger.error(f"Error getting pending count: {e}")
            return 0
