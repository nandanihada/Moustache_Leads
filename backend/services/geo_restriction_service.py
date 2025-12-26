"""
Geo-Restriction Service
Handles country-based offer access control with IP geolocation
"""

import logging
from datetime import datetime
from database import db_instance
from services.ipinfo_service import get_ipinfo_service

logger = logging.getLogger(__name__)


class GeoRestrictionService:
    """
    Service for managing country-based offer access restrictions
    """
    
    def __init__(self):
        self.ipinfo = get_ipinfo_service()
        self.access_logs_collection = db_instance.get_collection('geo_access_logs')
        
    def check_country_access(self, offer, user_ip, user_context=None):
        """
        Check if user from detected country can access the offer
        
        Args:
            offer: Offer document from database
            user_ip: User's IP address
            user_context: Additional context (optional)
            
        Returns:
            dict: {
                'allowed': bool,
                'country_code': str,
                'country_name': str,
                'reason': str,
                'redirect_url': str or None
            }
        """
        try:
            # Get allowed countries from offer
            allowed_countries = offer.get('allowed_countries', [])
            
            # If no restrictions, allow access
            if not allowed_countries or len(allowed_countries) == 0:
                logger.debug(f"No country restrictions for offer {offer.get('offer_id')}")
                return {
                    'allowed': True,
                    'country_code': None,
                    'country_name': None,
                    'reason': 'No restrictions',
                    'redirect_url': None
                }
            
            # Detect user's country from IP
            ip_data = self.ipinfo.lookup_ip(user_ip)
            user_country_code = ip_data.get('country_code', 'XX')
            user_country_name = ip_data.get('country', 'Unknown')
            
            logger.info(f"🌍 Detected country: {user_country_name} ({user_country_code}) for IP {user_ip}")
            
            # Normalize country codes to uppercase
            allowed_countries_upper = [c.upper().strip() for c in allowed_countries]
            user_country_upper = user_country_code.upper().strip()
            
            # Check if user's country is in allowed list
            if user_country_upper in allowed_countries_upper:
                logger.info(f"✅ Access ALLOWED for {user_country_code} to offer {offer.get('offer_id')}")
                return {
                    'allowed': True,
                    'country_code': user_country_code,
                    'country_name': user_country_name,
                    'reason': 'Country is in allowed list',
                    'redirect_url': None
                }
            else:
                # Access denied - get non-access URL
                non_access_url = offer.get('non_access_url', '').strip()
                
                logger.warning(
                    f"🚫 Access DENIED for {user_country_code} to offer {offer.get('offer_id')}. "
                    f"Allowed countries: {', '.join(allowed_countries_upper)}"
                )
                
                # Log the blocked access attempt
                self.log_blocked_access(
                    offer_id=offer.get('offer_id'),
                    user_ip=user_ip,
                    user_country_code=user_country_code,
                    user_country_name=user_country_name,
                    allowed_countries=allowed_countries_upper,
                    non_access_url=non_access_url,
                    user_context=user_context,
                    ip_data=ip_data
                )
                
                return {
                    'allowed': False,
                    'country_code': user_country_code,
                    'country_name': user_country_name,
                    'reason': f'Country {user_country_code} not in allowed list: {", ".join(allowed_countries_upper)}',
                    'redirect_url': non_access_url if non_access_url else None
                }
                
        except Exception as e:
            logger.error(f"Error checking country access: {str(e)}", exc_info=True)
            # On error, deny access for safety
            return {
                'allowed': False,
                'country_code': 'XX',
                'country_name': 'Unknown',
                'reason': f'Error during geo-check: {str(e)}',
                'redirect_url': None
            }
    
    def log_blocked_access(self, offer_id, user_ip, user_country_code, user_country_name, 
                          allowed_countries, non_access_url, user_context=None, ip_data=None):
        """
        Log blocked access attempt to database
        
        Args:
            offer_id: Offer ID
            user_ip: User's IP address
            user_country_code: Detected country code
            user_country_name: Detected country name
            allowed_countries: List of allowed countries
            non_access_url: Non-access URL shown to user
            user_context: Additional user context
            ip_data: Full IP geolocation data
        """
        try:
            log_entry = {
                'offer_id': offer_id,
                'user_ip': user_ip,
                'user_country_code': user_country_code,
                'user_country_name': user_country_name,
                'allowed_countries': allowed_countries,
                'non_access_url': non_access_url,
                'blocked_at': datetime.utcnow(),
                'user_context': user_context or {},
                'ip_data': {
                    'city': ip_data.get('city') if ip_data else None,
                    'region': ip_data.get('region') if ip_data else None,
                    'isp': ip_data.get('isp') if ip_data else None,
                    'vpn_detected': ip_data.get('vpn_detection', {}).get('is_vpn', False) if ip_data else False,
                    'proxy_detected': ip_data.get('vpn_detection', {}).get('is_proxy', False) if ip_data else False,
                    'fraud_score': ip_data.get('fraud_score', 0) if ip_data else 0
                } if ip_data else {}
            }
            
            self.access_logs_collection.insert_one(log_entry)
            logger.info(f"📝 Logged blocked access attempt for offer {offer_id} from {user_country_code}")
            
        except Exception as e:
            logger.error(f"Error logging blocked access: {str(e)}", exc_info=True)
    
    def get_blocked_access_logs(self, offer_id=None, country_code=None, limit=100, skip=0):
        """
        Retrieve blocked access logs with optional filtering
        
        Args:
            offer_id: Filter by offer ID (optional)
            country_code: Filter by country code (optional)
            limit: Maximum number of logs to return
            skip: Number of logs to skip (pagination)
            
        Returns:
            list: List of blocked access log entries
        """
        try:
            query = {}
            
            if offer_id:
                query['offer_id'] = offer_id
            
            if country_code:
                query['user_country_code'] = country_code.upper()
            
            logs = list(
                self.access_logs_collection
                .find(query)
                .sort('blocked_at', -1)
                .skip(skip)
                .limit(limit)
            )
            
            # Convert ObjectId to string
            for log in logs:
                log['_id'] = str(log['_id'])
            
            return logs
            
        except Exception as e:
            logger.error(f"Error retrieving blocked access logs: {str(e)}", exc_info=True)
            return []
    
    def get_blocked_access_stats(self, offer_id=None, days=7):
        """
        Get statistics on blocked access attempts
        
        Args:
            offer_id: Filter by offer ID (optional)
            days: Number of days to look back
            
        Returns:
            dict: Statistics on blocked access
        """
        try:
            from datetime import timedelta
            
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            
            query = {'blocked_at': {'$gte': cutoff_date}}
            if offer_id:
                query['offer_id'] = offer_id
            
            # Get total blocked attempts
            total_blocked = self.access_logs_collection.count_documents(query)
            
            # Get blocked attempts by country
            pipeline = [
                {'$match': query},
                {
                    '$group': {
                        '_id': '$user_country_code',
                        'count': {'$sum': 1},
                        'country_name': {'$first': '$user_country_name'}
                    }
                },
                {'$sort': {'count': -1}},
                {'$limit': 10}
            ]
            
            by_country = list(self.access_logs_collection.aggregate(pipeline))
            
            # Get blocked attempts by offer
            if not offer_id:
                pipeline_by_offer = [
                    {'$match': query},
                    {
                        '$group': {
                            '_id': '$offer_id',
                            'count': {'$sum': 1}
                        }
                    },
                    {'$sort': {'count': -1}},
                    {'$limit': 10}
                ]
                
                by_offer = list(self.access_logs_collection.aggregate(pipeline_by_offer))
            else:
                by_offer = []
            
            return {
                'total_blocked': total_blocked,
                'by_country': by_country,
                'by_offer': by_offer,
                'period_days': days,
                'generated_at': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting blocked access stats: {str(e)}", exc_info=True)
            return {
                'total_blocked': 0,
                'by_country': [],
                'by_offer': [],
                'period_days': days,
                'error': str(e)
            }


# Singleton instance
_geo_restriction_service = None

def get_geo_restriction_service():
    """Get singleton instance of geo-restriction service"""
    global _geo_restriction_service
    if _geo_restriction_service is None:
        _geo_restriction_service = GeoRestrictionService()
    return _geo_restriction_service
