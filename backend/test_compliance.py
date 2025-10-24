#!/usr/bin/env python3
"""
Test script to verify compliance functionality in offer creation
"""

import requests
import json

# Configuration
BASE_URL = "http://localhost:5000/api/admin"
LOGIN_URL = "http://localhost:5000/api/auth/login"

def test_compliance_functionality():
    """Test that compliance data is properly saved and retrieved"""
    
    # Step 1: Login to get auth token
    print("🔐 Step 1: Logging in...")
    login_data = {
        "username": "admin",  # You may need to adjust this
        "password": "admin123"  # You may need to adjust this
    }
    
    try:
        login_response = requests.post(LOGIN_URL, json=login_data)
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.text}")
            return False
        
        token = login_response.json().get('token')
        if not token:
            print("❌ No token received from login")
            return False
        
        print("✅ Login successful")
        
    except Exception as e:
        print(f"❌ Login error: {str(e)}")
        return False
    
    # Step 2: Create offer with compliance data
    print("\n📝 Step 2: Creating offer with compliance data...")
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    # Test offer data with compliance fields
    offer_data = {
        # Required fields
        "campaign_id": "TEST-COMPLIANCE-001",
        "name": "Test Compliance Offer - Paramount+ Streaming",
        "description": "Test offer to verify compliance functionality",
        "payout": 9.60,
        "network": "TestNetwork",
        "target_url": "https://www.paramountplus.com/signup",
        "countries": ["US", "CA"],
        
        # Compliance data - THIS IS WHAT WE'RE TESTING
        "allowed_traffic_types": ["Email", "Search", "Display", "Social"],
        "disallowed_traffic_types": ["Adult", "Fraud", "Brand Bidding"],
        "creative_approval_required": True,
        "affiliate_terms": "Test affiliate terms and conditions for compliance testing",
        "brand_guidelines": "Test brand guidelines - no trademark bidding allowed",
        "terms_notes": "Additional compliance notes for testing purposes",
        
        # Other targeting data
        "os_targeting": ["iOS", "Android"],
        "browser_targeting": ["Chrome", "Safari"],
        "carrier_targeting": ["Verizon", "AT&T"],
        "languages": ["en", "es"]
    }
    
    try:
        create_response = requests.post(f"{BASE_URL}/offers", json=offer_data, headers=headers)
        
        if create_response.status_code != 201:
            print(f"❌ Offer creation failed: {create_response.text}")
            return False
        
        created_offer = create_response.json().get('offer')
        if not created_offer:
            print("❌ No offer data returned from creation")
            return False
        
        offer_id = created_offer.get('_id')
        print(f"✅ Offer created successfully with ID: {offer_id}")
        
    except Exception as e:
        print(f"❌ Offer creation error: {str(e)}")
        return False
    
    # Step 3: Retrieve the offer and verify compliance data
    print(f"\n🔍 Step 3: Retrieving offer {offer_id} to verify compliance data...")
    
    try:
        get_response = requests.get(f"{BASE_URL}/offers/{offer_id}", headers=headers)
        
        if get_response.status_code != 200:
            print(f"❌ Offer retrieval failed: {get_response.text}")
            return False
        
        retrieved_offer = get_response.json().get('offer')
        if not retrieved_offer:
            print("❌ No offer data returned from retrieval")
            return False
        
        print("✅ Offer retrieved successfully")
        
    except Exception as e:
        print(f"❌ Offer retrieval error: {str(e)}")
        return False
    
    # Step 4: Verify compliance data integrity
    print("\n✅ Step 4: Verifying compliance data integrity...")
    
    compliance_checks = [
        ("allowed_traffic_types", ["Email", "Search", "Display", "Social"]),
        ("disallowed_traffic_types", ["Adult", "Fraud", "Brand Bidding"]),
        ("creative_approval_required", True),
        ("affiliate_terms", "Test affiliate terms and conditions for compliance testing"),
        ("brand_guidelines", "Test brand guidelines - no trademark bidding allowed"),
        ("terms_notes", "Additional compliance notes for testing purposes"),
        ("os_targeting", ["iOS", "Android"]),
        ("browser_targeting", ["Chrome", "Safari"]),
        ("carrier_targeting", ["Verizon", "AT&T"]),
        ("languages", ["en", "es"])
    ]
    
    all_passed = True
    
    for field_name, expected_value in compliance_checks:
        actual_value = retrieved_offer.get(field_name)
        
        if actual_value == expected_value:
            print(f"  ✅ {field_name}: {actual_value}")
        else:
            print(f"  ❌ {field_name}: Expected {expected_value}, got {actual_value}")
            all_passed = False
    
    # Step 5: Summary
    print(f"\n📊 Test Summary:")
    if all_passed:
        print("🎉 ALL COMPLIANCE TESTS PASSED!")
        print("✅ Comply tab functionality is working correctly")
        print("✅ All compliance data is being saved and retrieved properly")
        return True
    else:
        print("❌ SOME COMPLIANCE TESTS FAILED!")
        print("🔧 The Comply tab needs fixes - some data is not being saved properly")
        return False

if __name__ == "__main__":
    print("🧪 Testing Comply Tab Functionality")
    print("=" * 50)
    
    success = test_compliance_functionality()
    
    print("\n" + "=" * 50)
    if success:
        print("✅ COMPLY TAB IS WORKING CORRECTLY!")
    else:
        print("❌ COMPLY TAB NEEDS FIXES!")
    
    exit(0 if success else 1)
