"""
Partner Postback Distribution Service
Automatically distributes received postbacks to all active partners
"""

import logging
import requests
from datetime import datetime
from typing import Dict, List, Any, Optional
import time

logger = logging.getLogger(__name__)

class PartnerPostbackService:
    """Service to distribute postbacks to partners"""
    
    def __init__(self):
        self.timeout = 10  # Request timeout in seconds
        self.max_retries = 3  # Maximum retry attempts
        
    def get_active_partners(self, db_instance) -> List[Dict[str, Any]]:
        """Get all active partners with postback URLs configured"""
        try:
            users_collection = db_instance.get_collection('users')
            if users_collection is None:
                logger.error("Users collection not available")
                return []
            
            # Find all active partners with postback URLs
            partners = list(users_collection.find({
                'role': 'partner',
                'is_active': True,
                'postback_url': {'$exists': True, '$ne': ''}
            }))
            
            logger.info(f"📋 Found {len(partners)} active partners with postback URLs")
            return partners
            
        except Exception as e:
            logger.error(f"❌ Error fetching active partners: {str(e)}", exc_info=True)
            return []
    
    def replace_macros(self, url: str, postback_data: Dict[str, Any]) -> str:
        """Replace macros in partner postback URL with actual values"""
        try:
            replaced_url = url
            
            # Common macro mappings
            macro_map = {
                '{click_id}': postback_data.get('click_id', ''),
                '{status}': postback_data.get('status', ''),
                '{payout}': postback_data.get('payout', ''),
                '{offer_id}': postback_data.get('offer_id', ''),
                '{conversion_id}': postback_data.get('conversion_id', ''),
                '{transaction_id}': postback_data.get('transaction_id', ''),
                '{user_id}': postback_data.get('user_id', ''),
                '{affiliate_id}': postback_data.get('affiliate_id', ''),
                '{campaign_id}': postback_data.get('campaign_id', ''),
                '{sub_id}': postback_data.get('sub_id', ''),
                '{sub_id1}': postback_data.get('sub_id1', ''),
                '{sub_id2}': postback_data.get('sub_id2', ''),
                '{sub_id3}': postback_data.get('sub_id3', ''),
                '{sub_id4}': postback_data.get('sub_id4', ''),
                '{sub_id5}': postback_data.get('sub_id5', ''),
                '{ip}': postback_data.get('ip', ''),
                '{country}': postback_data.get('country', ''),
                '{device_id}': postback_data.get('device_id', ''),
                '{timestamp}': postback_data.get('timestamp', str(int(time.time()))),
            }
            
            # Replace all macros
            for macro, value in macro_map.items():
                if macro in replaced_url:
                    replaced_url = replaced_url.replace(macro, str(value))
            
            return replaced_url
            
        except Exception as e:
            logger.error(f"❌ Error replacing macros: {str(e)}", exc_info=True)
            return url
    
    def send_postback_to_partner(
        self, 
        partner: Dict[str, Any], 
        postback_data: Dict[str, Any],
        retry_count: int = 0
    ) -> Dict[str, Any]:
        """Send postback to a single partner"""
        partner_id = str(partner.get('_id', 'unknown'))
        partner_name = f"{partner.get('first_name', '')} {partner.get('last_name', '')}".strip() or partner.get('username', 'Unknown')
        postback_url = partner.get('postback_url', '')
        method = partner.get('postback_method', 'GET').upper()
        
        if not postback_url:
            logger.warning(f"⚠️ Partner {partner_name} has no postback URL")
            return {
                'partner_id': partner_id,
                'partner_name': partner_name,
                'success': False,
                'error': 'No postback URL configured',
                'status_code': None
            }
        
        try:
            # Replace macros in URL
            final_url = self.replace_macros(postback_url, postback_data)
            
            # Filter out empty values from postback_data
            clean_data = {k: v for k, v in postback_data.items() if v and v != ''}
            
            logger.info(f"📤 Sending postback to {partner_name} ({method}): {final_url}")
            logger.info(f"📦 Data being sent: {clean_data}")
            
            # Send request based on method
            start_time = time.time()
            
            if method == 'POST':
                # Send data as JSON in POST body
                response = requests.post(
                    final_url,
                    json=clean_data,
                    timeout=self.timeout,
                    headers={
                        'User-Agent': 'PepeLeads-Postback-Distributor/1.0',
                        'Content-Type': 'application/json'
                    }
                )
            else:  # GET
                # Append data as query parameters
                import urllib.parse
                
                # Parse existing URL
                parsed = urllib.parse.urlparse(final_url)
                
                # Get existing query params
                existing_params = urllib.parse.parse_qs(parsed.query)
                
                # Add new params (flatten list values)
                for key, value in clean_data.items():
                    existing_params[key] = [str(value)]
                
                # Rebuild query string
                new_query = urllib.parse.urlencode(existing_params, doseq=True)
                
                # Rebuild URL
                final_url_with_params = urllib.parse.urlunparse((
                    parsed.scheme,
                    parsed.netloc,
                    parsed.path,
                    parsed.params,
                    new_query,
                    parsed.fragment
                ))
                
                logger.info(f"📍 Final URL with params: {final_url_with_params}")
                
                response = requests.get(
                    final_url_with_params,
                    timeout=self.timeout,
                    headers={'User-Agent': 'PepeLeads-Postback-Distributor/1.0'}
                )
            
            response_time = time.time() - start_time
            
            # Check if successful
            success = 200 <= response.status_code < 300
            
            if success:
                logger.info(f"✅ Postback sent successfully to {partner_name} - Status: {response.status_code} - Time: {response_time:.2f}s")
            else:
                logger.warning(f"⚠️ Postback failed for {partner_name} - Status: {response.status_code}")
            
            # Determine which URL was actually used
            actual_url = final_url_with_params if method == 'GET' else final_url
            
            return {
                'partner_id': partner_id,
                'partner_name': partner_name,
                'partner_email': partner.get('email', ''),
                'postback_url': actual_url,
                'method': method,
                'success': success,
                'status_code': response.status_code,
                'response_body': response.text[:500],  # Limit response size
                'response_time': response_time,
                'retry_count': retry_count,
                'error': None
            }
            
        except requests.Timeout:
            logger.error(f"⏱️ Timeout sending postback to {partner_name}")
            return {
                'partner_id': partner_id,
                'partner_name': partner_name,
                'partner_email': partner.get('email', ''),
                'postback_url': postback_url,
                'method': method,
                'success': False,
                'status_code': None,
                'response_body': None,
                'response_time': self.timeout,
                'retry_count': retry_count,
                'error': 'Request timeout'
            }
            
        except requests.RequestException as e:
            logger.error(f"❌ Error sending postback to {partner_name}: {str(e)}")
            return {
                'partner_id': partner_id,
                'partner_name': partner_name,
                'partner_email': partner.get('email', ''),
                'postback_url': postback_url,
                'method': method,
                'success': False,
                'status_code': None,
                'response_body': None,
                'response_time': None,
                'retry_count': retry_count,
                'error': str(e)
            }
    
    def distribute_to_all_partners(
        self, 
        postback_data: Dict[str, Any],
        db_instance,
        source_log_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Distribute postback to all active partners
        Returns summary of distribution results
        """
        try:
            logger.info(f"🚀 Starting postback distribution - Source: {source_log_id}")
            
            # Get all active partners
            partners = self.get_active_partners(db_instance)
            
            if not partners:
                logger.warning("⚠️ No active partners found for distribution")
                return {
                    'total_partners': 0,
                    'successful': 0,
                    'failed': 0,
                    'results': []
                }
            
            # Send to each partner
            results = []
            successful = 0
            failed = 0
            
            for partner in partners:
                result = self.send_postback_to_partner(partner, postback_data)
                results.append(result)
                
                if result['success']:
                    successful += 1
                else:
                    failed += 1
                
                # Log to partner_postback_logs collection
                self._log_partner_postback(db_instance, result, postback_data, source_log_id)
            
            summary = {
                'total_partners': len(partners),
                'successful': successful,
                'failed': failed,
                'results': results,
                'timestamp': datetime.utcnow()
            }
            
            logger.info(f"✅ Distribution complete - Success: {successful}/{len(partners)}, Failed: {failed}/{len(partners)}")
            
            return summary
            
        except Exception as e:
            logger.error(f"❌ Error in distribute_to_all_partners: {str(e)}", exc_info=True)
            return {
                'total_partners': 0,
                'successful': 0,
                'failed': 0,
                'results': [],
                'error': str(e)
            }
    
    def _log_partner_postback(
        self, 
        db_instance, 
        result: Dict[str, Any],
        postback_data: Dict[str, Any],
        source_log_id: Optional[str]
    ):
        """Log partner postback attempt to database"""
        try:
            partner_logs_collection = db_instance.get_collection('partner_postback_logs')
            if partner_logs_collection is None:
                logger.error("Partner postback logs collection not available")
                return
            
            log_entry = {
                'partner_id': result['partner_id'],
                'partner_name': result['partner_name'],
                'partner_email': result.get('partner_email'),
                'postback_url': result['postback_url'],
                'method': result['method'],
                'success': result['success'],
                'status_code': result.get('status_code'),
                'response_body': result.get('response_body'),
                'response_time': result.get('response_time'),
                'retry_count': result.get('retry_count', 0),
                'error': result.get('error'),
                'source_log_id': source_log_id,
                'postback_data': postback_data,
                'timestamp': datetime.utcnow()
            }
            
            partner_logs_collection.insert_one(log_entry)
            
        except Exception as e:
            logger.error(f"❌ Error logging partner postback: {str(e)}", exc_info=True)
    
    def retry_failed_postbacks(self, db_instance, hours_ago: int = 24) -> Dict[str, Any]:
        """Retry failed postbacks from the last N hours"""
        try:
            from datetime import timedelta
            
            partner_logs_collection = db_instance.get_collection('partner_postback_logs')
            if partner_logs_collection is None:
                return {'error': 'Database not available'}
            
            # Find failed postbacks
            cutoff_time = datetime.utcnow() - timedelta(hours=hours_ago)
            failed_logs = list(partner_logs_collection.find({
                'success': False,
                'retry_count': {'$lt': self.max_retries},
                'timestamp': {'$gte': cutoff_time}
            }).limit(100))  # Limit to prevent overload
            
            logger.info(f"🔄 Found {len(failed_logs)} failed postbacks to retry")
            
            retried = 0
            succeeded = 0
            
            for log in failed_logs:
                # Get partner info
                users_collection = db_instance.get_collection('users')
                partner = users_collection.find_one({'_id': log['partner_id']})
                
                if not partner:
                    continue
                
                # Retry sending
                result = self.send_postback_to_partner(
                    partner, 
                    log['postback_data'],
                    retry_count=log['retry_count'] + 1
                )
                
                retried += 1
                if result['success']:
                    succeeded += 1
                
                # Update log
                self._log_partner_postback(
                    db_instance, 
                    result, 
                    log['postback_data'],
                    log.get('source_log_id')
                )
            
            return {
                'total_retried': retried,
                'succeeded': succeeded,
                'failed': retried - succeeded
            }
            
        except Exception as e:
            logger.error(f"❌ Error retrying failed postbacks: {str(e)}", exc_info=True)
            return {'error': str(e)}

# Global instance
partner_postback_service = PartnerPostbackService()
