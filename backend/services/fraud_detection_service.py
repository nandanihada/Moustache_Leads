"""
Fraud Detection Service
Analyzes login attempts for fraud indicators and calculates risk scores
"""

import logging
from typing import Dict, List
from datetime import datetime

logger = logging.getLogger(__name__)

class FraudDetectionService:
    """Service to detect fraudulent login attempts"""
    
    # Fraud scoring weights
    WEIGHTS = {
        'vpn_detected': 30,
        'proxy_detected': 30,
        'tor_detected': 40,
        'datacenter_ip': 40,
        'device_change': 20,
        'session_frequency_medium': 25,
        'session_frequency_high': 40,
        'new_country': 15,
        'multiple_failed_attempts': 20,
    }
    
    def analyze_login(self, log_data: Dict) -> Dict:
        """
        Analyze login for fraud indicators
        
        Args:
            log_data: Login log data including VPN detection, device info, etc.
        
        Returns:
            dict: {
                'fraud_score': int (0-100),
                'risk_level': str ('low', 'medium', 'high', 'critical'),
                'flags': [list of detected issues],
                'recommendations': [list of actions to take]
            }
        """
        try:
            fraud_score = 0
            flags = []
            recommendations = []
            
            # 1. Check VPN/Proxy/Tor
            vpn_detection = log_data.get('vpn_detection', {})
            
            if vpn_detection.get('is_vpn'):
                fraud_score += self.WEIGHTS['vpn_detected']
                flags.append(f"VPN detected ({vpn_detection.get('provider', 'Unknown')})")
                recommendations.append("Verify user identity via email or 2FA")
            
            if vpn_detection.get('is_proxy'):
                fraud_score += self.WEIGHTS['proxy_detected']
                flags.append("Proxy detected")
                recommendations.append("Monitor account activity closely")
            
            if vpn_detection.get('is_tor'):
                fraud_score += self.WEIGHTS['tor_detected']
                flags.append("Tor network detected")
                recommendations.append("Consider blocking Tor access")
            
            if vpn_detection.get('is_datacenter'):
                fraud_score += self.WEIGHTS['datacenter_ip']
                flags.append("Datacenter IP detected")
                recommendations.append("Verify this is not a bot")
            
            # 2. Check device change
            if log_data.get('device_change_detected'):
                fraud_score += self.WEIGHTS['device_change']
                flags.append("Login from new device")
                recommendations.append("Send device change notification to user")
            
            # 3. Check session frequency
            session_freq = log_data.get('session_frequency', {})
            risk_level = session_freq.get('risk_level', 'low')
            
            if risk_level == 'medium':
                fraud_score += self.WEIGHTS['session_frequency_medium']
                flags.append(f"Multiple logins ({session_freq.get('logins_last_hour', 0)} in last hour)")
                recommendations.append("Monitor for account sharing")
            elif risk_level == 'high':
                fraud_score += self.WEIGHTS['session_frequency_high']
                flags.append(f"Excessive logins ({session_freq.get('logins_last_hour', 0)} in last hour)")
                recommendations.append("Consider temporary account lock")
            
            # 4. Check for new country (if we have previous login data)
            # This would require comparing with previous logins
            # Skipping for now, can be added later
            
            # 5. Check for multiple failed attempts before success
            # This would require tracking failed attempts
            # Skipping for now, can be added later
            
            # Cap fraud score at 100
            fraud_score = min(fraud_score, 100)
            
            # Determine risk level
            if fraud_score >= 76:
                risk_level = 'critical'
            elif fraud_score >= 51:
                risk_level = 'high'
            elif fraud_score >= 26:
                risk_level = 'medium'
            else:
                risk_level = 'low'
            
            # Add general recommendations based on risk level
            if risk_level == 'critical':
                recommendations.append("⚠️ CRITICAL: Consider suspending account pending verification")
            elif risk_level == 'high':
                recommendations.append("⚠️ HIGH RISK: Require additional verification")
            
            result = {
                'fraud_score': fraud_score,
                'risk_level': risk_level,
                'flags': flags,
                'recommendations': list(set(recommendations))  # Remove duplicates
            }
            
            logger.info(f"🔍 Fraud analysis: score={fraud_score}, risk={risk_level}, flags={len(flags)}")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Error analyzing login for fraud: {e}", exc_info=True)
            return {
                'fraud_score': 0,
                'risk_level': 'low',
                'flags': [],
                'recommendations': []
            }
    
    def get_risk_color(self, fraud_score: int) -> str:
        """Get color code for fraud score"""
        if fraud_score >= 76:
            return 'red'
        elif fraud_score >= 51:
            return 'orange'
        elif fraud_score >= 26:
            return 'yellow'
        else:
            return 'green'


# Singleton instance
_fraud_detection_service = None

def get_fraud_detection_service():
    """Get singleton instance of fraud detection service"""
    global _fraud_detection_service
    if _fraud_detection_service is None:
        _fraud_detection_service = FraudDetectionService()
    return _fraud_detection_service
