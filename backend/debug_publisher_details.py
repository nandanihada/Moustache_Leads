#!/usr/bin/env python3

import requests
import json
from models.user import User
from utils.auth import generate_token

def debug_publisher_details():
    print("🔍 DEBUGGING PUBLISHER DETAILS API")
    print("=" * 60)
    
    user_model = User()
    
    # Get admin user
    admin_user = user_model.find_by_username('admin')
    if not admin_user:
        print("❌ Admin user not found")
        return
    
    admin_token = generate_token(admin_user)
    headers = {
        'Authorization': f'Bearer {admin_token}',
        'Content-Type': 'application/json'
    }
    
    # First get the list of publishers
    print("1️⃣ Getting publisher list...")
    try:
        response = requests.get('http://localhost:5000/api/admin/publishers', headers=headers)
        if response.status_code == 200:
            data = response.json()
            publishers = data.get('publishers', [])
            print(f"Found {len(publishers)} publishers")
            
            for pub in publishers:
                print(f"\n📋 Publisher: {pub.get('username')}")
                print(f"   ID: {pub.get('id')}")
                print(f"   Email: {pub.get('email')}")
                print(f"   Password: {pub.get('password', 'NOT FOUND')}")
                print(f"   Company: {pub.get('companyName', 'N/A')}")
                
                # Test detailed view for this publisher
                print(f"\n2️⃣ Getting details for {pub.get('username')}...")
                detail_response = requests.get(f"http://localhost:5000/api/admin/publishers/{pub.get('id')}", headers=headers)
                
                if detail_response.status_code == 200:
                    detail_data = detail_response.json()
                    print(f"✅ Details retrieved successfully")
                    print(f"   Username: {detail_data.get('username')}")
                    print(f"   Password: {detail_data.get('password', 'NOT FOUND')}")
                    print(f"   Placements count: {len(detail_data.get('placements', []))}")
                    
                    # Show first few placements
                    placements = detail_data.get('placements', [])
                    if placements:
                        print(f"   First placement: {placements[0].get('offerwallTitle', 'No title')}")
                else:
                    print(f"❌ Failed to get details: {detail_response.status_code}")
                    print(f"   Response: {detail_response.text}")
                
                print("-" * 40)
        else:
            print(f"❌ Failed to get publishers: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    debug_publisher_details()
