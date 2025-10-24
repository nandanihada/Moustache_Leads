"""
Smart Rules Resolver Service
Handles real-time destination URL resolution based on smart rules logic
"""

from datetime import datetime, date, timedelta
from models.offer_extended import OfferExtended
from services.tracking_service import TrackingService
import logging
import hashlib
import random

class SmartRulesResolver:
    
    def __init__(self):
        self.offer_model = OfferExtended()
        self.tracking_service = TrackingService()
        self.logger = logging.getLogger(__name__)
        self.cache = {}  # Simple in-memory cache
        self.cache_ttl = 60  # 60 seconds cache TTL
    
    def resolve_destination_url(self, offer_id, user_context):
        """
        Main resolver function - determines destination URL
        
        Args:
            offer_id: Offer identifier (ML-00123)
            user_context: {
                'geo': 'US',
                'subid': 'affiliate_123',
                'ip': '192.168.1.1',
                'user_agent': 'Mozilla/5.0...',
                'timestamp': datetime.utcnow(),
                'referrer': 'https://example.com'
            }
        
        Returns:
            {
                'destination_url': 'https://example.com/landing',
                'rule_applied': 'GEO_US_Priority_1',
                'rule_id': '507f1f77bcf86cd799439011',
                'tracking_data': {...},
                'success': True
            }
        """
        
        try:
            start_time = datetime.utcnow()
            
            # STEP 1: Get offer and validate
            offer = self.get_active_offer(offer_id)
            if not offer:
                return self.get_error_response("Offer not found or inactive")
            
            # STEP 2: Get applicable smart rules
            applicable_rules = self.get_applicable_rules(offer, user_context)
            if not applicable_rules:
                return self.get_fallback_response(offer, "No applicable rules found")
            
            # STEP 3: Apply rule resolution logic
            selected_rule = self.apply_resolution_logic(applicable_rules, user_context)
            if not selected_rule:
                return self.get_fallback_response(offer, "Rule resolution failed")
            
            # STEP 4: Check caps and limits
            if not self.check_rule_caps(selected_rule, offer_id):
                # Try backup rules
                backup_rule = self.get_backup_rule(applicable_rules, offer_id)
                if backup_rule:
                    selected_rule = backup_rule
                    self.logger.info(f"Using backup rule for {offer_id}: cap reached on primary rule")
                else:
                    return self.get_fallback_response(offer, "All rules at capacity")
            
            # STEP 5: Track click and return URL
            tracking_data = self.track_click(offer_id, selected_rule, user_context)
            
            # Calculate resolution time
            resolution_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            
            return {
                'destination_url': selected_rule['url'],
                'rule_applied': f"{selected_rule['type']}_Priority_{selected_rule['priority']}",
                'rule_id': str(selected_rule['_id']),
                'rule_type': selected_rule['type'],
                'tracking_data': tracking_data,
                'resolution_time_ms': round(resolution_time, 2),
                'success': True
            }
            
        except Exception as e:
            self.logger.error(f"Resolution failed for {offer_id}: {str(e)}", exc_info=True)
            return self.get_error_response(f"Internal resolution error: {str(e)}")
    
    def get_active_offer(self, offer_id):
        """Get active offer with caching"""
        
        cache_key = f"offer_{offer_id}"
        
        # Check cache first
        if cache_key in self.cache:
            cached_data, timestamp = self.cache[cache_key]
            if (datetime.utcnow() - timestamp).total_seconds() < self.cache_ttl:
                return cached_data
        
        try:
            if not self.offer_model._check_db_connection():
                return None
            
            offer = self.offer_model.collection.find_one({
                'offer_id': offer_id,
                'is_active': True,
                'status': 'Active'
            })
            
            # Cache the result
            self.cache[cache_key] = (offer, datetime.utcnow())
            
            return offer
            
        except Exception as e:
            self.logger.error(f"Error fetching offer {offer_id}: {str(e)}")
            return None
    
    def get_applicable_rules(self, offer, user_context):
        """Filter rules based on user context"""
        
        smart_rules = offer.get('smartRules', [])
        applicable_rules = []
        
        for rule in smart_rules:
            # Skip inactive rules
            if not rule.get('active', True):
                continue
            
            # Check GEO targeting
            rule_geo = rule.get('geo', [])
            if rule_geo and user_context['geo'] not in rule_geo:
                continue
            
            # Check time-based rules (if type is 'Time')
            if rule.get('type') == 'Time':
                if not self.check_time_constraints(rule, user_context['timestamp']):
                    continue
            
            applicable_rules.append(rule)
        
        return applicable_rules
    
    def apply_resolution_logic(self, rules, user_context):
        """Apply smart rules resolution logic"""
        
        # STEP 1: Sort by priority (1 = highest priority)
        rules.sort(key=lambda x: x.get('priority', 999))
        
        # STEP 2: Apply rule type logic
        for rule in rules:
            rule_type = rule.get('type')
            
            if rule_type == 'GEO':
                # Direct GEO match - highest priority
                if user_context['geo'] in rule.get('geo', []):
                    self.logger.debug(f"Selected GEO rule for {user_context['geo']}: Priority {rule.get('priority')}")
                    return rule
            
            elif rule_type == 'Rotation':
                # Percentage-based rotation
                if self.check_rotation_percentage(rule, user_context):
                    self.logger.debug(f"Selected Rotation rule: {rule.get('percentage')}% - Priority {rule.get('priority')}")
                    return rule
            
            elif rule_type == 'Time':
                # Time-based routing
                if self.check_time_constraints(rule, user_context['timestamp']):
                    self.logger.debug(f"Selected Time rule: Priority {rule.get('priority')}")
                    return rule
            
            elif rule_type == 'Backup':
                # Backup rules - process last
                continue
        
        # STEP 3: If no specific rule matched, try backup rules
        backup_rules = [r for r in rules if r.get('type') == 'Backup']
        if backup_rules:
            # Sort backup rules by priority
            backup_rules.sort(key=lambda x: x.get('priority', 999))
            self.logger.debug(f"Using backup rule: Priority {backup_rules[0].get('priority')}")
            return backup_rules[0]
        
        return None
    
    def check_rotation_percentage(self, rule, user_context):
        """Check if user falls within rotation percentage"""
        
        percentage = rule.get('percentage', 0)
        if percentage <= 0:
            return False
        
        if percentage >= 100:
            return True
        
        # Use consistent hash for rotation
        hash_input = f"{rule['_id']}_{user_context['subid']}_{user_context['ip']}"
        hash_value = int(hashlib.md5(hash_input.encode()).hexdigest()[:8], 16)
        
        # Convert to percentage (0-100)
        user_percentage = (hash_value % 100) + 1
        
        return user_percentage <= percentage
    
    def check_time_constraints(self, rule, timestamp):
        """Check time-based rule constraints"""
        
        # Get current hour (0-23)
        current_hour = timestamp.hour
        
        # Get time constraints from rule metadata
        time_constraints = rule.get('timeConstraints', {})
        
        # Default to always active if no constraints
        if not time_constraints:
            return True
        
        start_hour = time_constraints.get('startHour', 0)
        end_hour = time_constraints.get('endHour', 23)
        
        # Handle overnight time ranges (e.g., 22:00 - 06:00)
        if start_hour <= end_hour:
            return start_hour <= current_hour <= end_hour
        else:
            return current_hour >= start_hour or current_hour <= end_hour
    
    def check_rule_caps(self, rule, offer_id):
        """Check if rule has reached its cap limit"""
        
        cap = rule.get('cap', 0)
        if cap <= 0:  # No cap limit
            return True
        
        try:
            # Get current click count for this rule today
            today = datetime.utcnow().date()
            clicks_today = self.get_rule_clicks_today(offer_id, str(rule['_id']), today)
            
            return clicks_today < cap
            
        except Exception as e:
            self.logger.error(f"Error checking rule caps: {str(e)}")
            return True  # Allow traffic if cap check fails
    
    def get_rule_clicks_today(self, offer_id, rule_id, date):
        """Get click count for rule today (with caching)"""
        
        cache_key = f"clicks_{offer_id}_{rule_id}_{date}"
        
        # Check cache
        if cache_key in self.cache:
            cached_count, timestamp = self.cache[cache_key]
            if (datetime.utcnow() - timestamp).total_seconds() < 300:  # 5 minute cache
                return cached_count
        
        try:
            # Query tracking service or database
            if hasattr(self.tracking_service, 'get_rule_clicks_count'):
                count = self.tracking_service.get_rule_clicks_count(offer_id, rule_id, date)
            else:
                # Fallback: query database directly
                count = self.offer_model.collection.count_documents({
                    'offer_id': offer_id,
                    'smartRules._id': rule_id,
                    'clicks.date': {
                        '$gte': datetime.combine(date, datetime.min.time()),
                        '$lt': datetime.combine(date + timedelta(days=1), datetime.min.time())
                    }
                })
            
            # Cache the result
            self.cache[cache_key] = (count, datetime.utcnow())
            return count
            
        except Exception as e:
            self.logger.error(f"Error getting rule clicks: {str(e)}")
            return 0
    
    def get_backup_rule(self, rules, offer_id):
        """Get backup rule when primary rules fail"""
        
        backup_rules = [r for r in rules if r.get('type') == 'Backup' and r.get('active', True)]
        
        if backup_rules:
            # Sort by priority and return first available
            backup_rules.sort(key=lambda x: x.get('priority', 999))
            
            for backup in backup_rules:
                # Check caps for backup rules too
                if self.check_rule_caps(backup, offer_id):
                    return backup
        
        return None
    
    def track_click(self, offer_id, rule, user_context):
        """Track the click for analytics"""
        
        click_data = {
            'offer_id': offer_id,
            'rule_id': str(rule['_id']),
            'rule_type': rule['type'],
            'rule_priority': rule.get('priority', 0),
            'destination_url': rule['url'],
            'geo': user_context['geo'],
            'subid': user_context['subid'],
            'ip': user_context['ip'],
            'user_agent': user_context['user_agent'],
            'referrer': user_context.get('referrer', ''),
            'timestamp': user_context['timestamp']
        }
        
        try:
            if hasattr(self.tracking_service, 'track_click'):
                self.tracking_service.track_click(click_data)
            else:
                # Fallback: log the click
                self.logger.info(f"Click tracked: {offer_id} -> {rule['url']} (Rule: {rule['type']})")
            
            return click_data
            
        except Exception as e:
            self.logger.error(f"Error tracking click: {str(e)}")
            return click_data
    
    def get_fallback_response(self, offer, message):
        """Return fallback response using offer's primary URL"""
        
        fallback_url = offer.get('target_url')
        if fallback_url:
            self.logger.warning(f"Using fallback URL for {offer['offer_id']}: {message}")
            return {
                'destination_url': fallback_url,
                'rule_applied': 'FALLBACK',
                'rule_id': None,
                'rule_type': 'Fallback',
                'tracking_data': {
                    'offer_id': offer['offer_id'],
                    'fallback_reason': message,
                    'timestamp': datetime.utcnow().isoformat()
                },
                'success': True,
                'fallback': True
            }
        else:
            return self.get_error_response(f"No fallback URL available: {message}")
    
    def get_error_response(self, message):
        """Return error response"""
        return {
            'destination_url': None,
            'error': message,
            'rule_applied': None,
            'rule_id': None,
            'rule_type': None,
            'tracking_data': None,
            'success': False
        }
    
    def clear_cache(self):
        """Clear resolver cache"""
        self.cache.clear()
        self.logger.info("Resolver cache cleared")
    
    def get_cache_stats(self):
        """Get cache statistics"""
        return {
            'cache_size': len(self.cache),
            'cache_ttl': self.cache_ttl
        }

# Singleton instance
_resolver_service = None

def get_resolver_service():
    """Get singleton resolver service instance"""
    global _resolver_service
    if _resolver_service is None:
        _resolver_service = SmartRulesResolver()
    return _resolver_service

# Utility functions for route handlers
def resolve_offer_click(offer_id, request_args, request_headers, remote_addr):
    """
    Utility function to resolve offer click from Flask request
    
    Args:
        offer_id: Offer ID from URL
        request_args: Flask request.args
        request_headers: Flask request.headers
        remote_addr: Flask request.remote_addr
    
    Returns:
        Resolution result dictionary
    """
    
    # Extract user context from request
    user_context = {
        'geo': request_args.get('geo', 'US'),
        'subid': request_args.get('subid', 'direct'),
        'ip': remote_addr or '127.0.0.1',
        'user_agent': request_headers.get('User-Agent', ''),
        'referrer': request_headers.get('Referer', ''),
        'timestamp': datetime.utcnow()
    }
    
    # Resolve destination URL
    resolver = get_resolver_service()
    return resolver.resolve_destination_url(offer_id, user_context)

if __name__ == "__main__":
    # Test the resolver
    logging.basicConfig(level=logging.INFO)
    
    resolver = SmartRulesResolver()
    
    # Test context
    test_context = {
        'geo': 'US',
        'subid': 'test_affiliate',
        'ip': '192.168.1.1',
        'user_agent': 'Mozilla/5.0 Test',
        'referrer': 'https://test.com',
        'timestamp': datetime.utcnow()
    }
    
    # Test resolution
    result = resolver.resolve_destination_url('ML-00001', test_context)
    print(f"Resolution result: {result}")
