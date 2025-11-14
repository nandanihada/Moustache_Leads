#!/usr/bin/env python3

from models.user import User
from models.placement import Placement
from bson import ObjectId

def debug_api_error():
    print("=== DEBUGGING API ERROR ===")
    
    user_model = User()
    placement_model = Placement()
    
    # Get the user
    user = user_model.find_by_username('nan')
    print(f"User ID: {user['_id']} (type: {type(user['_id'])})")
    
    # Test the placement method directly
    try:
        placements, total, error = placement_model.get_placements_by_publisher(
            publisher_id=str(user['_id']),
            page=1,
            size=10
        )
        
        if error:
            print(f"❌ Error from method: {error}")
        else:
            print(f"✅ Method works! Found {total} placements")
            
            # Test the API response formatting
            placement_list = []
            for placement in placements:
                try:
                    placement_data = {
                        'id': str(placement['_id']),
                        'publisherId': str(placement['publisherId']),
                        'placementIdentifier': placement['placementIdentifier'],
                        'apiKey': placement.get('apiKey', ''),
                        'platformType': placement['platformType'],
                        'offerwallTitle': placement['offerwallTitle'],
                        'currencyName': placement['currencyName'],
                        'exchangeRate': placement['exchangeRate'],
                        'postbackUrl': placement['postbackUrl'],
                        'status': placement['status'],
                        'approvalStatus': placement.get('approvalStatus', 'PENDING_APPROVAL'),
                        'approvedBy': placement.get('approvedBy'),
                        'approvedAt': placement.get('approvedAt').isoformat() if placement.get('approvedAt') and hasattr(placement.get('approvedAt'), 'isoformat') else None,
                        'rejectionReason': placement.get('rejectionReason'),
                        'reviewMessage': placement.get('reviewMessage'),
                        'createdAt': placement['createdAt'].isoformat()
                    }
                    placement_list.append(placement_data)
                    print(f"✅ Formatted placement: {placement['offerwallTitle']}")
                except Exception as e:
                    print(f"❌ Error formatting placement {placement.get('offerwallTitle', 'Unknown')}: {e}")
                    print(f"   Placement data: {placement}")
                    
            print(f"✅ Successfully formatted {len(placement_list)} placements")
            
    except Exception as e:
        print(f"❌ Error in method: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_api_error()
