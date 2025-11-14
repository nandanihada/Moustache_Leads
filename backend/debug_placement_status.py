#!/usr/bin/env python3

import requests
from models.user import User
from models.placement import Placement
from utils.auth import generate_token

def debug_placement_status():
    print("=== DEBUGGING PLACEMENT STATUS ===")
    
    user_model = User()
    publisher_user = user_model.find_by_username('nan')
    publisher_token = generate_token(publisher_user)
    
    # Check placements via API
    headers = {
        'Authorization': f'Bearer {publisher_token}',
        'Content-Type': 'application/json'
    }
    
    response = requests.get('http://localhost:5000/api/placements', headers=headers)
    if response.status_code == 200:
        data = response.json()
        placements = data.get('placements', [])
        
        print(f"📊 Found {len(placements)} placements via API:")
        for placement in placements:
            print(f"  - {placement['offerwallTitle']}")
            print(f"    Status: {placement.get('status', 'N/A')}")
            print(f"    Approval Status: {placement.get('approvalStatus', 'N/A')}")
            print()
    
    # Check placements directly from database
    placement_model = Placement()
    db_placements = list(placement_model.collection.find(
        {'publisherId': publisher_user['_id']},
        {'offerwallTitle': 1, 'status': 1, 'approvalStatus': 1}
    ))
    
    print(f"📊 Found {len(db_placements)} placements in database:")
    for placement in db_placements:
        print(f"  - {placement['offerwallTitle']}")
        print(f"    Status: {placement.get('status', 'N/A')}")
        print(f"    Approval Status: {placement.get('approvalStatus', 'N/A')}")
        print()
    
    # Set one placement to pending for testing
    if db_placements:
        test_placement = db_placements[0]
        print(f"🔧 Setting '{test_placement['offerwallTitle']}' to PENDING_APPROVAL...")
        
        result = placement_model.collection.update_one(
            {'_id': test_placement['_id']},
            {'$set': {'approvalStatus': 'PENDING_APPROVAL'}}
        )
        
        if result.modified_count > 0:
            print("✅ Updated placement status")
            
            # Test API again
            response = requests.get('http://localhost:5000/api/placements', headers=headers)
            if response.status_code == 200:
                data = response.json()
                placements = data.get('placements', [])
                
                pending = [p for p in placements if p.get('approvalStatus') == 'PENDING_APPROVAL']
                print(f"📋 Now showing {len(pending)} pending placements in API")
        else:
            print("❌ Failed to update placement status")

if __name__ == "__main__":
    debug_placement_status()
