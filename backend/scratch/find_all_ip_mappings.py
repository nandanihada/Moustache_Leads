
from database import db_instance
import json

def find_identities_for_ips():
    db = db_instance.get_db()
    
    # Get all unique IPs from clicks/views
    ips = set()
    for col_name in ['masked_link_clicks', 'see_more_clicks']:
        col = db_instance.get_collection(col_name)
        if col is not None:
            ips.update(col.distinct('ip'))
    
    print(f"Found {len(ips)} unique IPs in click logs.")
    
    mapping = {}
    
    # Search login_logs
    logs_col = db_instance.get_collection('login_logs')
    if logs_col is not None:
        for ip in ips:
            log = logs_col.find_one({'ip_address': ip})
            if log:
                mapping[ip] = log.get('email')
    
    # Search for clicks with emails for these IPs
    for col_name in ['masked_link_clicks', 'see_more_clicks']:
        col = db_instance.get_collection(col_name)
        if col is not None:
            for ip in ips:
                if ip in mapping: continue
                doc = col.find_one({'ip': ip, 'recipient_email': {'$ne': None, '$ne': ''}})
                if doc:
                    mapping[ip] = doc.get('recipient_email')

    print(f"Mapped {len(mapping)} IPs to emails.")
    for ip, email in mapping.items():
        print(f"IP: {ip} -> Email: {email}")

if __name__ == "__main__":
    find_identities_for_ips()
