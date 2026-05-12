import logging
import threading
import time
from database import db_instance
from services.ipinfo_service import get_ipinfo_service

logger = logging.getLogger(__name__)

class LocationRetryService:
    def __init__(self):
        self.thread = None
        self.stop_event = threading.Event()
        self.running = False

    def start_service(self):
        if self.running:
            return
        
        self.running = True
        self.stop_event.clear()
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()
        logger.info("Location retry service started")

    def stop_service(self):
        if not self.running:
            return
        
        self.stop_event.set()
        self.running = False
        if self.thread:
            self.thread.join(timeout=2.0)
        logger.info("Location retry service stopped")

    def _run_loop(self):
        while not self.stop_event.is_set():
            try:
                self._retry_locations()
            except Exception as e:
                logger.error(f"Error in location retry service: {e}")
            
            # Wait 30 seconds before next check
            self.stop_event.wait(30)

    def _retry_locations(self):
        if not db_instance.is_connected():
            return

        db = db_instance.get_db()
        logs_col = db.login_logs

        # Find recent logs with Unknown location
        unknown_logs = list(logs_col.find(
            {
                'location.country': 'Unknown',
                'ip_address': {'$exists': True, '$ne': None, '$ne': ''}
            },
            sort=[('login_time', -1)],
            limit=50
        ))

        if not unknown_logs:
            return

        ipinfo = get_ipinfo_service()
        updated_count = 0

        for log in unknown_logs:
            if self.stop_event.is_set():
                break

            ip = log.get('ip_address')
            if not ip:
                continue

            # Remove from cache to force fresh lookup
            ipinfo.cache.pop(ip, None)
            
            # This calls the fallback if token is missing
            ip_data = ipinfo.lookup_ip(ip)

            if ip_data and ip_data.get('country') and ip_data.get('country') != 'Unknown':
                # Build location update
                location_update = {
                    'location.ip': ip,
                    'location.city': ip_data.get('city', 'Unknown'),
                    'location.region': ip_data.get('region', 'Unknown'),
                    'location.country': ip_data.get('country', 'Unknown'),
                    'location.country_code': ip_data.get('country_code', 'XX'),
                    'location.latitude': ip_data.get('latitude', 0),
                    'location.longitude': ip_data.get('longitude', 0),
                    'location.timezone': ip_data.get('time_zone', ''),
                    'location.isp': ip_data.get('isp', 'Unknown'),
                    'location.domain': ip_data.get('domain', ''),
                    'location.asn': ip_data.get('asn', ''),
                    'location.org': ip_data.get('org', '')
                }
                
                # If VPN data is present, update it too
                vpn_detection = ip_data.get('vpn_detection')
                update_doc = {'$set': location_update}
                if vpn_detection:
                    update_doc['$set']['vpn_detection'] = vpn_detection

                logs_col.update_one({'_id': log['_id']}, update_doc)
                updated_count += 1
                
                # Update Active Sessions if any
                db.active_sessions.update_many(
                    {'session_id': log.get('session_id')},
                    {'$set': {
                        'location.ip': ip,
                        'location.city': ip_data.get('city', 'Unknown'),
                        'location.region': ip_data.get('region', 'Unknown'),
                        'location.country': ip_data.get('country', 'Unknown'),
                        'location.country_code': ip_data.get('country_code', 'XX')
                    }}
                )

            # Sleep briefly to avoid rate limiting
            time.sleep(1.0)

        if updated_count > 0:
            logger.info(f"Retried and fixed {updated_count} unknown IP locations")

_location_retry_service = LocationRetryService()

def get_location_retry_service():
    return _location_retry_service
