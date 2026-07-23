"""
MarketXcel S2S Callback Service
Handles sending respondent status updates to MarketXcel after conversions.

POST https://api.marketxcel.co.in/webservices/callback/updateRespondentStatus
Headers: X-Api-Key: {api_key}, Content-Type: application/json
Body: {"respondentId": "ABC123", "status": 1}

Status codes:
  1 = Complete
  2 = Terminate
  3 = OverQuota
  4 = Security
"""

import logging
import requests
from config import Config

logger = logging.getLogger(__name__)

# MarketXcel callback endpoint
MARKETXCEL_CALLBACK_URL = "https://api.marketxcel.co.in/webservices/callback/updateRespondentStatus"

# API key for callback authentication (stored in .env)
# Falls back to empty string if not configured
MARKETXCEL_API_KEY = getattr(Config, 'MARKETXCEL_API_KEY', '') or ''


def fire_marketxcel_callback(respondent_id: str, status: int = 1) -> bool:
    """
    Fire S2S callback to MarketXcel to update respondent status.
    
    Args:
        respondent_id: The respondent/click ID that was passed as [identifier] in the survey URL
        status: Status code (1=Complete, 2=Terminate, 3=OverQuota, 4=Security)
        
    Returns:
        True if callback was successful, False otherwise
    """
    if not respondent_id:
        logger.warning("MarketXcel callback skipped: no respondent_id provided")
        return False
    
    if not MARKETXCEL_API_KEY:
        logger.warning("MarketXcel callback skipped: MARKETXCEL_API_KEY not configured in .env")
        return False
    
    try:
        headers = {
            'X-Api-Key': MARKETXCEL_API_KEY,
            'Content-Type': 'application/json'
        }
        
        payload = {
            'respondentId': respondent_id,
            'status': status
        }
        
        logger.info(f"🔄 MarketXcel S2S callback: respondent={respondent_id}, status={status}")
        
        response = requests.post(
            MARKETXCEL_CALLBACK_URL,
            headers=headers,
            json=payload,
            timeout=15
        )
        
        if response.status_code == 200:
            logger.info(f"✅ MarketXcel callback success: respondent={respondent_id}, status={status}")
            return True
        else:
            logger.warning(
                f"⚠️ MarketXcel callback returned {response.status_code}: {response.text[:200]}"
            )
            return False
            
    except requests.exceptions.Timeout:
        logger.warning(f"⚠️ MarketXcel callback timed out for respondent={respondent_id}")
        return False
    except requests.exceptions.ConnectionError:
        logger.warning(f"⚠️ MarketXcel callback connection error for respondent={respondent_id}")
        return False
    except Exception as e:
        logger.error(f"❌ MarketXcel callback error: {str(e)}")
        return False
