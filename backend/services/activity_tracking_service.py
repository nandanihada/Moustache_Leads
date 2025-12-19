"""
Activity Tracking Service
Comprehensive service for tracking user login attempts, page visits, and session activity
"""

from models.login_logs import LoginLog
from models.page_visits import PageVisit
from models.active_sessions import ActiveSession
from datetime import datetime
import logging
import uuid
import re
from user_agents import parse

logger = logging.getLogger(__name__)

class ActivityTrackingService:
    def __init__(self):
        self.login_log_model = LoginLog()
        self.page_visit_model = PageVisit()
        self.active_session_model = ActiveSession()
    
    def track_login_attempt(self, user_data, request, status='success', failure_reason=None, login_method='password'):
        """
        Track a login attempt (successful or failed)
        
        Args:
            user_data: User information dict
            request: Flask request object
            status: 'success' or 'failed'
            failure_reason: Reason for failure if status is 'failed'
            login_method: 'password', 'otp', or 'sso'
        
        Returns:
            session_id if successful, None otherwise
        """
        try:
            # Generate session ID for successful logins
            session_id = str(uuid.uuid4()) if status == 'success' else None
            
            # Extract device and browser info
            device_info = self._parse_user_agent(request.headers.get('User-Agent', ''))
            
            # Get IP address
            ip_address = self._get_client_ip(request)
            
            # Get location (you can integrate with geolocation service)
            location = self._get_location(ip_address)
            
            # 🔍 FRAUD DETECTION - Only for successful logins
            vpn_detection = {}
            device_fingerprint = None
            device_change_detected = False
            session_frequency = {}
            fraud_analysis = {}
            
            if status == 'success':
                try:
                    from services.ipinfo_service import get_ip2location_service
                    from services.fraud_detection_service import get_fraud_detection_service
                    from database import db_instance
                    
                    # 1. IPinfo - Superior IP Intelligence
                    ipinfo_service = get_ip2location_service()
                    ip_data = ipinfo_service.lookup_ip(ip_address)
                    
                    if ip_data:
                        vpn_detection = ip_data.get('vpn_detection', {})
                        logger.info(f"🔍 IPinfo check for {ip_address}: VPN={vpn_detection.get('is_vpn')}, Proxy={vpn_detection.get('is_proxy')}, ISP={vpn_detection.get('isp')}")
                    else:
                        # Fallback to old VPN detection service if IPinfo fails
                        from services.vpn_detection_service import get_vpn_detection_service
                        vpn_service = get_vpn_detection_service(db_instance)
                        vpn_detection = vpn_service.check_ip(ip_address)
                        logger.info(f"🔍 VPN check (fallback) for {ip_address}: {vpn_detection}")
                    
                    # 2. Device Fingerprinting
                    device_fingerprint = self.login_log_model.calculate_device_fingerprint(device_info)
                    
                    # 3. Device Change Detection
                    user_id = user_data.get('_id') or user_data.get('id') or user_data.get('username')
                    device_change_detected = self.login_log_model.check_device_change(user_id, device_fingerprint)
                    
                    # 4. Session Frequency
                    session_frequency = self.login_log_model.calculate_session_frequency(user_id)
                    
                    # 5. Fraud Analysis
                    fraud_service = get_fraud_detection_service()
                    fraud_analysis = fraud_service.analyze_login({
                        'vpn_detection': vpn_detection,
                        'device_change_detected': device_change_detected,
                        'session_frequency': session_frequency,
                        'ip_data': ip_data  # Pass full IP2Location data
                    })
                    
                    # Use IP2Location fraud score if available, otherwise use calculated
                    if ip_data and 'fraud_score' in ip_data:
                        fraud_analysis['fraud_score'] = max(fraud_analysis.get('fraud_score', 0), ip_data['fraud_score'])
                        fraud_analysis['risk_level'] = ip_data.get('risk_level', fraud_analysis.get('risk_level', 'low'))
                    
                    logger.info(f"🚨 Fraud score for {user_data.get('email')}: {fraud_analysis.get('fraud_score')}/100 ({fraud_analysis.get('risk_level')})")
                    
                except Exception as fraud_error:
                    logger.error(f"Error in fraud detection: {fraud_error}", exc_info=True)
                    # Continue even if fraud detection fails
            
            # Create login log
            log_data = {
                'user_id': user_data.get('_id') or user_data.get('id') or user_data.get('username'),
                'email': user_data.get('email', ''),
                'username': user_data.get('username', ''),
                'login_time': datetime.utcnow(),
                'logout_time': None,
                'ip_address': ip_address,
                'device': device_info,
                'location': location,
                'login_method': login_method,
                'status': status,
                'failure_reason': failure_reason,
                'session_id': session_id,
                'user_agent': request.headers.get('User-Agent', ''),
                # Fraud detection fields
                'vpn_detection': vpn_detection,
                'device_fingerprint': device_fingerprint,
                'device_change_detected': device_change_detected,
                'session_frequency': session_frequency,
                'fraud_score': fraud_analysis.get('fraud_score', 0),
                'risk_level': fraud_analysis.get('risk_level', 'low'),
                'fraud_flags': fraud_analysis.get('flags', []),
                'fraud_recommendations': fraud_analysis.get('recommendations', [])
            }
            
            # Save login log
            log_id = self.login_log_model.create_log(log_data)
            
            # If successful login, create active session
            if status == 'success' and session_id:
                session_data = {
                    'session_id': session_id,
                    'user_id': log_data['user_id'],
                    'email': log_data['email'],
                    'username': log_data['username'],
                    'current_page': '/',
                    'ip_address': ip_address,
                    'location': location,
                    'device': device_info
                }
                
                self.active_session_model.create_session(session_data)
                
                logger.info(f"Tracked successful login for user {log_data['email']}, session: {session_id}")
            else:
                logger.info(f"Tracked failed login attempt for {log_data.get('email', 'unknown')}: {failure_reason}")
            
            return session_id
            
        except Exception as e:
            logger.error(f"Error tracking login attempt: {str(e)}", exc_info=True)
            return None
    
    def track_logout(self, session_id):
        """Track user logout"""
        try:
            # Update login log with logout time
            self.login_log_model.update_logout(session_id)
            
            # End active session
            self.active_session_model.end_session(session_id)
            
            logger.info(f"Tracked logout for session {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error tracking logout: {str(e)}", exc_info=True)
            return False
    
    def track_page_visit(self, session_id, user_id, page_data, request):
        """
        Track a page visit
        
        Args:
            session_id: Current session ID
            user_id: User ID
            page_data: Dict with page_url, page_title, referrer, utm params
            request: Flask request object
        """
        try:
            # Extract UTM parameters from URL
            utm_params = self._extract_utm_params(page_data.get('page_url', ''))
            
            # Get device info
            device_info = self._parse_user_agent(request.headers.get('User-Agent', ''))
            
            # Get IP address
            ip_address = self._get_client_ip(request)
            
            visit_data = {
                'session_id': session_id,
                'user_id': user_id,
                'page_url': page_data.get('page_url', ''),
                'page_title': page_data.get('page_title', ''),
                'referrer': page_data.get('referrer', ''),
                'utm_source': utm_params.get('utm_source'),
                'utm_medium': utm_params.get('utm_medium'),
                'utm_campaign': utm_params.get('utm_campaign'),
                'utm_term': utm_params.get('utm_term'),
                'utm_content': utm_params.get('utm_content'),
                'device': device_info,
                'ip_address': ip_address,
                'time_spent': 0
            }
            
            # Save page visit
            visit_id = self.page_visit_model.track_visit(visit_data)
            
            # Update active session with current page
            self.active_session_model.update_heartbeat(
                session_id,
                current_page=page_data.get('page_url', ''),
                ip_address=ip_address
            )
            
            # Check for suspicious activity
            self._check_suspicious_activity(session_id, user_id)
            
            return visit_id
            
        except Exception as e:
            logger.error(f"Error tracking page visit: {str(e)}", exc_info=True)
            return None
    
    def update_heartbeat(self, session_id, current_page=None):
        """Update session heartbeat"""
        try:
            return self.active_session_model.update_heartbeat(session_id, current_page)
        except Exception as e:
            logger.error(f"Error updating heartbeat: {str(e)}", exc_info=True)
            return False
    
    def get_session_activity(self, session_id):
        """Get complete activity for a session"""
        try:
            # Get session info
            session = self.active_session_model.get_session(session_id)
            
            # Get page visits
            page_visits = self.page_visit_model.get_session_visits(session_id, limit=10)
            
            # Get login log
            login_logs = self.login_log_model.get_logs(
                filters={'session_id': session_id},
                limit=1
            )
            
            return {
                'session': session,
                'page_visits': page_visits,
                'login_log': login_logs['logs'][0] if login_logs['logs'] else None
            }
            
        except Exception as e:
            logger.error(f"Error getting session activity: {str(e)}", exc_info=True)
            return None
    
    def _parse_user_agent(self, user_agent_string):
        """Parse user agent string to extract device info"""
        try:
            ua = parse(user_agent_string)
            
            # Determine device type
            if ua.is_mobile:
                device_type = 'mobile'
            elif ua.is_tablet:
                device_type = 'tablet'
            elif ua.is_pc:
                device_type = 'desktop'
            else:
                device_type = 'unknown'
            
            return {
                'type': device_type,
                'os': f"{ua.os.family} {ua.os.version_string}",
                'browser': f"{ua.browser.family} {ua.browser.version_string}",
                'version': ua.browser.version_string,
                'is_mobile': ua.is_mobile,
                'is_tablet': ua.is_tablet,
                'is_pc': ua.is_pc,
                'is_bot': ua.is_bot
            }
            
        except Exception as e:
            logger.error(f"Error parsing user agent: {str(e)}", exc_info=True)
            return {
                'type': 'unknown',
                'os': 'Unknown',
                'browser': 'Unknown',
                'version': ''
            }
    
    def _get_client_ip(self, request):
        """Get client IP address from request"""
        try:
            # Check for proxy headers
            if request.headers.get('X-Forwarded-For'):
                ip = request.headers.get('X-Forwarded-For').split(',')[0].strip()
            elif request.headers.get('X-Real-IP'):
                ip = request.headers.get('X-Real-IP')
            else:
                ip = request.remote_addr
            
            return ip
            
        except Exception as e:
            logger.error(f"Error getting client IP: {str(e)}", exc_info=True)
            return 'unknown'
    
    def _get_location(self, ip_address):
        """Get location and IP intelligence from IP2Location"""
        try:
            # Use IP2Location service for comprehensive IP intelligence
            from services.ip2location_service import get_ip2location_service
            
            ip2location_service = get_ip2location_service()
            ip_data = ip2location_service.lookup_ip(ip_address)
            
            if ip_data:
                # Return location data in expected format
                return {
                    'ip': ip_address,
                    'city': ip_data.get('city', 'Unknown'),
                    'region': ip_data.get('region', 'Unknown'),
                    'country': ip_data.get('country', 'Unknown'),
                    'country_code': ip_data.get('country_code', 'XX'),
                    'latitude': ip_data.get('latitude', 0),
                    'longitude': ip_data.get('longitude', 0),
                    'timezone': ip_data.get('time_zone', 'UTC'),
                    # Additional IP2Location fields
                    'isp': ip_data.get('isp', 'Unknown'),
                    'domain': ip_data.get('domain', ''),
                    'asn': ip_data.get('asn', ''),
                    'usage_type': ip_data.get('usage_type', 'Unknown')
                }
            else:
                # Fallback to default
                return self._get_default_location(ip_address)
            
        except Exception as e:
            logger.error(f"Error getting location from IP2Location: {str(e)}", exc_info=True)
            return self._get_default_location(ip_address)
    
    def _get_default_location(self, ip_address):
        """Get default location data when IP2Location is unavailable"""
        return {
            'ip': ip_address,
            'city': 'Unknown',
            'region': 'Unknown',
            'country': 'Unknown',
            'country_code': 'XX',
            'latitude': 0,
            'longitude': 0,
            'timezone': 'UTC',
            'isp': 'Unknown',
            'domain': '',
            'asn': '',
            'usage_type': 'Unknown'
        }
    
    def _extract_utm_params(self, url):
        """Extract UTM parameters from URL"""
        try:
            utm_params = {}
            
            # Extract query string
            if '?' in url:
                query_string = url.split('?')[1]
                params = query_string.split('&')
                
                for param in params:
                    if '=' in param:
                        key, value = param.split('=', 1)
                        if key.startswith('utm_'):
                            utm_params[key] = value
            
            return utm_params
            
        except Exception as e:
            logger.error(f"Error extracting UTM params: {str(e)}", exc_info=True)
            return {}
    
    def _check_suspicious_activity(self, session_id, user_id):
        """Check for suspicious activity patterns"""
        try:
            # Get recent page visits
            visits = self.page_visit_model.get_session_visits(session_id, limit=20)
            
            # Check for rapid page visits (more than 10 in 1 minute)
            if len(visits) >= 10:
                recent_visits = [v for v in visits if 
                               (datetime.utcnow() - v['timestamp']).total_seconds() < 60]
                
                if len(recent_visits) >= 10:
                    self.active_session_model.mark_suspicious(
                        session_id,
                        reason='Rapid page navigation detected'
                    )
                    logger.warning(f"Suspicious activity detected for session {session_id}: Rapid navigation")
                    return True
            
            # Check for device changes
            if self.page_visit_model.detect_device_change(session_id):
                self.active_session_model.mark_suspicious(
                    session_id,
                    reason='Device change detected during session'
                )
                logger.warning(f"Suspicious activity detected for session {session_id}: Device change")
                return True
            
            # Check for multiple failed logins
            if self.login_log_model.check_suspicious_activity(user_id):
                self.active_session_model.mark_suspicious(
                    session_id,
                    reason='Multiple failed login attempts detected'
                )
                logger.warning(f"Suspicious activity detected for user {user_id}: Multiple failed logins")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking suspicious activity: {str(e)}", exc_info=True)
            return False

# Global instance
activity_tracking_service = ActivityTrackingService()
