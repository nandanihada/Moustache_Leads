import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from database import db_instance
from models.advertiser import Advertiser

def main():
    print("Connecting to DB...")
    db_instance.is_connected()
    
    adv_model = Advertiser()
    email = "micequha@forexzig.com"
    adv = adv_model.find_by_email(email)
    
    if adv:
        print("Advertiser found:")
        print(f"ID: {adv['_id']}")
        print(f"Email: {adv['email']}")
        print(f"Email Verified: {adv.get('email_verified')}")
        print(f"Account Status: {adv.get('account_status')}")
    else:
        print(f"No advertiser found with email {email}")

if __name__ == "__main__":
    main()
