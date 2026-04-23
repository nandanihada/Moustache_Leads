import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.getcwd(), 'backend', '.env'))

from services.smart_link_service import SmartLinkService
from models.smart_link import SmartLink

def test_logic():
    print("Testing Smart Link Selection Logic...")
    sl = {
        '_id': 'global_publisher_tracking',
        'name': 'Global Auto-Rotating Link',
        'slug': 'global',
        'status': 'active',
        'rotation_strategy': 'round_robin'
    }
    
    service = SmartLinkService()
    try:
        offer = service.select_offer(
            smart_link=sl,
            country='IN',
            device_type='desktop'
        )
        print(f"Selected Offer: {offer.get('offer_id') if offer else 'NONE'}")
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_logic()
