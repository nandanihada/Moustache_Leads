"""
Debug script to check partner configuration
Run this to see why partners aren't receiving postbacks
"""

from database import db_instance
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def debug_partners():
    """Check partner configuration"""
    
    print("\n" + "="*60)
    print("PARTNER CONFIGURATION DEBUG")
    print("="*60 + "\n")
    
    # Check database connection
    if not db_instance.is_connected():
        print("❌ ERROR: Database not connected!")
        return
    
    print("✅ Database connected\n")
    
    # Get users collection
    users_collection = db_instance.get_collection('users')
    
    # Check all users
    print("📋 ALL USERS:")
    print("-" * 60)
    all_users = list(users_collection.find({}))
    print(f"Total users: {len(all_users)}\n")
    
    for user in all_users:
        print(f"Username: {user.get('username')}")
        print(f"Email: {user.get('email')}")
        print(f"Role: {user.get('role')}")
        print(f"Is Active: {user.get('is_active')}")
        print(f"Postback URL: {user.get('postback_url', 'NOT SET')}")
        print(f"Postback Method: {user.get('postback_method', 'NOT SET')}")
        print("-" * 60)
    
    # Check partners specifically
    print("\n📋 PARTNERS (role='partner'):")
    print("-" * 60)
    partners = list(users_collection.find({'role': 'partner'}))
    print(f"Total partners: {len(partners)}\n")
    
    for partner in partners:
        print(f"Username: {partner.get('username')}")
        print(f"Email: {partner.get('email')}")
        print(f"Name: {partner.get('first_name')} {partner.get('last_name')}")
        print(f"Company: {partner.get('company_name')}")
        print(f"Is Active: {partner.get('is_active')}")
        print(f"Postback URL: {partner.get('postback_url', 'NOT SET')}")
        print(f"Postback Method: {partner.get('postback_method', 'NOT SET')}")
        print("-" * 60)
    
    # Check ACTIVE partners with postback URLs
    print("\n📋 ACTIVE PARTNERS WITH POSTBACK URLs:")
    print("-" * 60)
    active_partners = list(users_collection.find({
        'role': 'partner',
        'is_active': True,
        'postback_url': {'$exists': True, '$ne': ''}
    }))
    print(f"Total active partners with URLs: {len(active_partners)}\n")
    
    if len(active_partners) == 0:
        print("⚠️ WARNING: No active partners with postback URLs found!")
        print("\nPossible issues:")
        print("1. No users registered with role='partner'")
        print("2. Partners exist but is_active=False")
        print("3. Partners exist but postback_url is empty")
        print("\nTo fix:")
        print("- Register a new partner account")
        print("- Set postback URL in partner profile")
        print("- Ensure is_active=True in database")
    else:
        for partner in active_partners:
            print(f"✅ {partner.get('username')} - {partner.get('postback_url')}")
    
    print("\n" + "="*60)
    
    # Check recent postback logs
    print("\n📋 RECENT PARTNER POSTBACK LOGS:")
    print("-" * 60)
    logs_collection = db_instance.get_collection('partner_postback_logs')
    recent_logs = list(logs_collection.find({}).sort('timestamp', -1).limit(5))
    
    if len(recent_logs) == 0:
        print("⚠️ No partner postback logs found")
        print("This means distribution hasn't been triggered yet")
    else:
        for log in recent_logs:
            print(f"Partner: {log.get('partner_name')}")
            print(f"Success: {log.get('success')}")
            print(f"URL: {log.get('postback_url')}")
            print(f"Error: {log.get('error', 'None')}")
            print(f"Timestamp: {log.get('timestamp')}")
            print("-" * 60)
    
    print("\n" + "="*60)
    
    # Check received postbacks
    print("\n📋 RECENT RECEIVED POSTBACKS:")
    print("-" * 60)
    received_collection = db_instance.get_collection('received_postbacks')
    recent_received = list(received_collection.find({}).sort('timestamp', -1).limit(5))
    
    if len(recent_received) == 0:
        print("⚠️ No received postbacks found")
    else:
        for pb in recent_received:
            print(f"Unique Key: {pb.get('unique_key')}")
            print(f"Params: {pb.get('query_params')}")
            print(f"Timestamp: {pb.get('timestamp')}")
            print("-" * 60)

if __name__ == '__main__':
    debug_partners()
