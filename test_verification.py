import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from database import db_instance
from models.advertiser import Advertiser
from bson import ObjectId

def main():
    db_instance.is_connected()
    adv_model = Advertiser()
    user_id = "6a30cdb1881451df37951153"
    
    print("Finding advertiser by ID...")
    adv = adv_model.find_by_id(user_id)
    if adv:
        print(f"Found! Email: {adv.get('email')}, Verified: {adv.get('email_verified')}")
    else:
        print("Not found by ID!")
        
    print("\nCalling mark_email_verified...")
    try:
        success = adv_model.mark_email_verified(user_id)
        print(f"Success: {success}")
    except Exception as e:
        print(f"Exception: {e}")
        
    # Re-fetch
    adv = adv_model.find_by_id(user_id)
    print(f"New Verified status: {adv.get('email_verified') if adv else 'N/A'}")

if __name__ == "__main__":
    main()
