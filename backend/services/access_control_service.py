from database import db_instance
import logging
from datetime import datetime, timedelta
import threading
import time

class AccessControlService:
    """Service to handle offer access control and affiliate permissions"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.offers_collection = db_instance.get_collection('offers')
        self.users_collection = db_instance.get_collection('users')
        self.affiliate_requests_collection = db_instance.get_collection('affiliate_requests')
        self.affiliate_stats_collection = db_instance.get_collection('affiliate_stats')
    
    def check_offer_access(self, offer_id, user_id):
        """
        Check if user has access to an offer
        
        Args:
            offer_id: Offer ID
            user_id: User ID (affiliate)
        
        Returns:
            tuple: (has_access, reason)
        """
        try:
            # Get offer
            offer = self.offers_collection.find_one({'offer_id': offer_id, 'is_active': True})
            if not offer:
                return False, "Offer not found or inactive"
            
            # Check offer status
            if offer.get('status') != 'active':
                return False, f"Offer is {offer.get('status', 'inactive')}"
            
            # Get user
            user = self.users_collection.find_one({'_id': user_id})
            if not user:
                return False, "User not found"
            
            # Check user status
            if not user.get('is_active', True):
                return False, "User account is inactive"
            
            # Check affiliate access level
            affiliate_access = offer.get('affiliates', 'all')
            
            if affiliate_access == 'all':
                return True, "Public access allowed"
            
            elif affiliate_access == 'premium':
                # Check if user is premium
                if user.get('account_type') == 'premium' or user.get('is_premium', False):
                    return True, "Premium access granted"
                else:
                    return False, "Premium account required"
            
            elif affiliate_access == 'selected':
                # Check if user is in selected list
                selected_users = offer.get('selected_users', [])
                if user_id in selected_users or user.get('username') in selected_users:
                    return True, "Selected affiliate access granted"
                else:
                    return False, "Not in selected affiliates list"
            
            elif affiliate_access == 'request':
                # Check if user has requested and been approved
                approval_status = self._check_approval_status(offer_id, user_id)
                if approval_status == 'approved':
                    return True, "Request-based access approved"
                elif approval_status == 'pending':
                    return False, "Access request pending approval"
                else:
                    return False, "Access request required"
            
            else:
                return False, f"Unknown access type: {affiliate_access}"
            
        except Exception as e:
            self.logger.error(f"Error checking offer access: {str(e)}")
            return False, f"Access check error: {str(e)}"
    
    def _check_approval_status(self, offer_id, user_id):
        """Check approval status for request-based access"""
        try:
            request = self.affiliate_requests_collection.find_one({
                'offer_id': offer_id,
                'user_id': user_id
            })
            
            if not request:
                return 'not_requested'
            
            return request.get('status', 'pending')
            
        except Exception:
            return 'not_requested'
    
    def request_offer_access(self, offer_id, user_id, message=None):
        """
        Request access to an offer with enhanced approval workflow
        
        Args:
            offer_id: Offer ID
            user_id: User ID
            message: Optional message from affiliate
        
        Returns:
            dict: Request result
        """
        try:
            # Check if offer exists and requires requests
            offer = self.offers_collection.find_one({'offer_id': offer_id, 'is_active': True})
            if not offer:
                return {'error': 'Offer not found'}
            
            # Check offer approval status
            if offer.get('approval_status') != 'active':
                return {'error': f'Offer is currently {offer.get("approval_status", "inactive")}'}
            
            # Check if offer requires approval
            approval_settings = offer.get('approval_settings', {})
            approval_type = approval_settings.get('type', 'auto_approve')
            
            if approval_type == 'auto_approve' and not approval_settings.get('require_approval', False):
                # Auto-approve immediately
                return self._auto_approve_request(offer_id, user_id, message, offer)
            
            # Check if request already exists
            existing_request = self.affiliate_requests_collection.find_one({
                'offer_id': offer_id,
                'user_id': user_id
            })
            
            if existing_request:
                return {
                    'error': 'Request already exists',
                    'status': existing_request.get('status', 'pending')
                }
            
            # Get user info
            user = self.users_collection.find_one({'_id': user_id})
            if not user:
                return {'error': 'User not found'}
            
            # Create access request
            request_doc = {
                'request_id': f"REQ-{offer_id}-{user_id}-{int(datetime.utcnow().timestamp())}",
                'offer_id': offer_id,
                'user_id': user_id,
                'username': user.get('username'),
                'email': user.get('email'),
                'message': message or '',
                'status': 'pending',
                'requested_at': datetime.utcnow(),
                'created_at': datetime.utcnow(),
                'approval_type': approval_type,
                'approval_settings': approval_settings
            }
            
            result = self.affiliate_requests_collection.insert_one(request_doc)
            request_doc['_id'] = str(result.inserted_id)
            
            # Handle time-based approval
            if approval_type == 'time_based':
                delay_minutes = approval_settings.get('auto_approve_delay', 60)
                self._schedule_auto_approval(request_doc['request_id'], delay_minutes)
            
            return {
                'request': request_doc,
                'message': 'Access request submitted successfully',
                'approval_type': approval_type,
                'estimated_approval_time': self._get_estimated_approval_time(approval_type, approval_settings)
            }
            
        except Exception as e:
            self.logger.error(f"Error requesting offer access: {str(e)}")
            return {'error': str(e)}
    
    def _auto_approve_request(self, offer_id, user_id, message, offer):
        """Auto-approve a request immediately"""
        try:
            user = self.users_collection.find_one({'_id': user_id})
            if not user:
                return {'error': 'User not found'}
            
            # Create and immediately approve request
            request_doc = {
                'request_id': f"REQ-{offer_id}-{user_id}-{int(datetime.utcnow().timestamp())}",
                'offer_id': offer_id,
                'user_id': user_id,
                'username': user.get('username'),
                'email': user.get('email'),
                'message': message or '',
                'status': 'approved',
                'requested_at': datetime.utcnow(),
                'approved_at': datetime.utcnow(),
                'approved_by': 'system',
                'approval_type': 'auto_approve',
                'created_at': datetime.utcnow()
            }
            
            result = self.affiliate_requests_collection.insert_one(request_doc)
            request_doc['_id'] = str(result.inserted_id)
            
            return {
                'request': request_doc,
                'message': 'Access granted immediately',
                'status': 'approved'
            }
            
        except Exception as e:
            self.logger.error(f"Error auto-approving request: {str(e)}")
            return {'error': str(e)}
    
    def _schedule_auto_approval(self, request_id, delay_minutes):
        """Schedule automatic approval after delay"""
        def auto_approve_after_delay():
            time.sleep(delay_minutes * 60)  # Convert minutes to seconds
            try:
                # Check if request still exists and is pending
                request = self.affiliate_requests_collection.find_one({
                    'request_id': request_id,
                    'status': 'pending'
                })
                
                if request:
                    # Auto-approve the request
                    self.affiliate_requests_collection.update_one(
                        {'request_id': request_id},
                        {
                            '$set': {
                                'status': 'approved',
                                'approved_at': datetime.utcnow(),
                                'approved_by': 'system_auto',
                                'approval_notes': f'Auto-approved after {delay_minutes} minutes'
                            }
                        }
                    )
                    self.logger.info(f"Auto-approved request {request_id} after {delay_minutes} minutes")
                
            except Exception as e:
                self.logger.error(f"Error in auto-approval: {str(e)}")
        
        # Start background thread for auto-approval
        thread = threading.Thread(target=auto_approve_after_delay)
        thread.daemon = True
        thread.start()
    
    def _get_estimated_approval_time(self, approval_type, approval_settings):
        """Get estimated approval time for display"""
        if approval_type == 'auto_approve':
            return 'Immediate'
        elif approval_type == 'time_based':
            delay = approval_settings.get('auto_approve_delay', 60)
            if delay < 60:
                return f'{delay} minutes'
            elif delay < 1440:
                return f'{delay // 60} hours'
            else:
                return f'{delay // 1440} days'
        else:
            return 'Manual review required'
    
    def approve_access_request(self, request_id, approved_by, notes=None):
        """
        Approve or deny access request
        
        Args:
            request_id: Request ID
            approved_by: Admin user ID
            notes: Optional approval notes
        
        Returns:
            dict: Approval result
        """
        try:
            # Get request
            request = self.affiliate_requests_collection.find_one({'request_id': request_id})
            if not request:
                return {'error': 'Request not found'}
            
            if request.get('status') != 'pending':
                return {'error': f'Request already {request.get("status")}'}
            
            # Update request status
            update_data = {
                'status': 'approved',
                'approved_by': approved_by,
                'approved_at': datetime.utcnow(),
                'notes': notes or '',
                'updated_at': datetime.utcnow()
            }
            
            self.affiliate_requests_collection.update_one(
                {'request_id': request_id},
                {'$set': update_data}
            )
            
            return {
                'message': 'Access request approved',
                'request_id': request_id
            }
            
        except Exception as e:
            self.logger.error(f"Error approving access request: {str(e)}")
            return {'error': str(e)}
    
    def deny_access_request(self, request_id, denied_by, reason=None):
        """Deny access request"""
        try:
            # Get request
            request = self.affiliate_requests_collection.find_one({'request_id': request_id})
            if not request:
                return {'error': 'Request not found'}
            
            if request.get('status') != 'pending':
                return {'error': f'Request already {request.get("status")}'}
            
            # Update request status
            update_data = {
                'status': 'denied',
                'denied_by': denied_by,
                'denied_at': datetime.utcnow(),
                'denial_reason': reason or '',
                'updated_at': datetime.utcnow()
            }
            
            self.affiliate_requests_collection.update_one(
                {'request_id': request_id},
                {'$set': update_data}
            )
            
            return {
                'message': 'Access request denied',
                'request_id': request_id
            }
            
        except Exception as e:
            self.logger.error(f"Error denying access request: {str(e)}")
            return {'error': f'Failed to deny request: {str(e)}'}
    
    def get_user_accessible_offers(self, user_id, filters=None):
        """
        Get all offers accessible to a user
        
        Args:
            user_id: User ID
            filters: Optional filters (category, network, etc.)
        
        Returns:
            list: List of accessible offers
        """
        try:
            # Get user
            user = self.users_collection.find_one({'_id': user_id})
            if not user:
                return []
            
            # Build query
            query = {
                'is_active': True,
                'status': 'active'
            }
            
            # Add filters
            if filters:
                if filters.get('category'):
                    query['category'] = filters['category']
                if filters.get('network'):
                    query['network'] = {'$regex': filters['network'], '$options': 'i'}
            
            # Get all offers
            all_offers = list(self.offers_collection.find(query))
            
            # Filter by access
            accessible_offers = []
            
            for offer in all_offers:
                has_access, _ = self.check_offer_access(offer['offer_id'], user_id)
                if has_access:
                    accessible_offers.append(offer)
            
            return accessible_offers
            
        except Exception as e:
            self.logger.error(f"Error getting accessible offers: {str(e)}")
            return []
    
    def get_pending_access_requests(self, offer_id=None):
        """Get pending access requests"""
        try:
            query = {'status': 'pending'}
            if offer_id:
                query['offer_id'] = offer_id
            
            requests = list(self.affiliate_requests_collection.find(query).sort('requested_at', -1))
            
            # Enrich with offer and user info
            for request in requests:
                # Get offer info
                offer = self.offers_collection.find_one({'offer_id': request['offer_id']})
                if offer:
                    request['offer_name'] = offer.get('name')
                    request['offer_payout'] = offer.get('payout')
                
                # Get user stats
                stats = self.affiliate_stats_collection.find_one({'user_id': request['user_id']})
                if stats:
                    request['user_stats'] = {
                        'total_clicks': stats.get('total_clicks', 0),
                        'total_conversions': stats.get('total_conversions', 0),
                        'conversion_rate': stats.get('conversion_rate', 0),
                        'total_earnings': stats.get('total_earnings', 0)
                    }
            
            return requests
            
        except Exception as e:
            self.logger.error(f"Error getting pending requests: {str(e)}")
            return []
    
    def check_user_permissions(self, user_id, permission):
        """
        Check if user has specific permission
        
        Args:
            user_id: User ID
            permission: Permission to check (e.g., 'admin', 'manager', 'premium')
        
        Returns:
            bool: Has permission
        """
        try:
            user = self.users_collection.find_one({'_id': user_id})
            if not user:
                return False
            
            # Check user role
            user_role = user.get('role', 'affiliate')
            
            if permission == 'admin':
                return user_role in ['admin', 'super_admin']
            elif permission == 'manager':
                return user_role in ['admin', 'super_admin', 'manager']
            elif permission == 'premium':
                return user.get('account_type') == 'premium' or user.get('is_premium', False)
            elif permission == 'active':
                return user.get('is_active', True)
            
            # Check custom permissions
            user_permissions = user.get('permissions', [])
            return permission in user_permissions
            
        except Exception as e:
            self.logger.error(f"Error checking user permissions: {str(e)}")
            return False
    
    def update_affiliate_stats(self, user_id, stats_update):
        """Update affiliate statistics"""
        try:
            # Upsert stats
            self.affiliate_stats_collection.update_one(
                {'user_id': user_id},
                {
                    '$inc': stats_update,
                    '$set': {'updated_at': datetime.utcnow()}
                },
                upsert=True
            )
            
            # Recalculate conversion rate
            stats = self.affiliate_stats_collection.find_one({'user_id': user_id})
            if stats:
                total_clicks = stats.get('total_clicks', 0)
                total_conversions = stats.get('total_conversions', 0)
                
                conversion_rate = (total_conversions / total_clicks * 100) if total_clicks > 0 else 0
                
                self.affiliate_stats_collection.update_one(
                    {'user_id': user_id},
                    {'$set': {'conversion_rate': round(conversion_rate, 2)}}
                )
            
        except Exception as e:
            self.logger.error(f"Error updating affiliate stats: {str(e)}")
    
    def get_affiliate_performance(self, user_id):
        """Get affiliate performance metrics"""
        try:
            stats = self.affiliate_stats_collection.find_one({'user_id': user_id})
            
            if not stats:
                return {
                    'total_clicks': 0,
                    'total_conversions': 0,
                    'conversion_rate': 0,
                    'total_earnings': 0,
                    'active_offers': 0
                }
            
            # Get active offers count
            accessible_offers = self.get_user_accessible_offers(user_id)
            
            return {
                'total_clicks': stats.get('total_clicks', 0),
                'total_conversions': stats.get('total_conversions', 0),
                'conversion_rate': stats.get('conversion_rate', 0),
                'total_earnings': stats.get('total_earnings', 0),
                'active_offers': len(accessible_offers),
                'last_updated': stats.get('updated_at')
            }
            
        except Exception as e:
            self.logger.error(f"Error getting affiliate performance: {str(e)}")
            return {}
    
    def get_access_requests(self, offer_id=None):
        """Get access requests for an offer or all requests"""
        try:
            query = {}
            if offer_id:
                query['offer_id'] = offer_id
            
            requests = list(self.affiliate_requests_collection.find(query).sort('requested_at', -1))
            
            # Convert ObjectId to string
            for req in requests:
                req['_id'] = str(req['_id'])
            
            return requests
            
        except Exception as e:
            self.logger.error(f"Error getting access requests: {str(e)}")
            return []
    
    def approve_access_request(self, request_id, offer_id):
        """Approve an access request"""
        try:
            result = self.affiliate_requests_collection.update_one(
                {'request_id': request_id, 'offer_id': offer_id},
                {
                    '$set': {
                        'status': 'approved',
                        'approved_at': datetime.utcnow()
                    }
                }
            )
            
            if result.matched_count == 0:
                return {'error': 'Access request not found'}
            
            return {'success': True, 'request_id': request_id}
            
        except Exception as e:
            self.logger.error(f"Error approving access request: {str(e)}")
            return {'error': f'Failed to approve request: {str(e)}'}
    
    def reject_access_request(self, request_id, offer_id, reason=''):
        """Reject an access request"""
        try:
            result = self.affiliate_requests_collection.update_one(
                {'request_id': request_id, 'offer_id': offer_id},
                {
                    '$set': {
                        'status': 'rejected',
                        'rejected_at': datetime.utcnow(),
                        'rejection_reason': reason
                    }
                }
            )
            
            if result.matched_count == 0:
                return {'error': 'Access request not found'}
            
            return {'success': True, 'request_id': request_id}
            
        except Exception as e:
            self.logger.error(f"Error rejecting access request: {str(e)}")
            return {'error': f'Failed to reject request: {str(e)}'}
