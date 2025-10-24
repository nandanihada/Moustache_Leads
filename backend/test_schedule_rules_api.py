#!/usr/bin/env python3
"""
Test Script for Schedule + Smart Rules API
Tests all CRUD endpoints for offer scheduling and smart rules
"""

import requests
import json
from datetime import datetime, timedelta

# Configuration
BASE_URL = "http://localhost:5000/api/admin"
TEST_OFFER_ID = "ML-00001"  # Use existing offer ID
AUTH_TOKEN = "your_admin_token_here"  # Replace with actual token

headers = {
    "Authorization": f"Bearer {AUTH_TOKEN}",
    "Content-Type": "application/json"
}

def test_schedule_endpoints():
    """Test schedule CRUD operations"""
    print("🔄 Testing Schedule Endpoints...")
    
    # Test data
    schedule_data = {
        "schedule": {
            "startDate": "2024-11-01",
            "endDate": "2024-12-31",
            "startTime": "09:00",
            "endTime": "17:00",
            "isRecurring": True,
            "weekdays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            "status": "Active"
        }
    }
    
    # POST - Create schedule
    print("📝 Creating schedule...")
    response = requests.post(f"{BASE_URL}/offers/{TEST_OFFER_ID}/schedule", 
                           headers=headers, json=schedule_data)
    print(f"Status: {response.status_code}")
    if response.status_code == 201:
        print("✅ Schedule created successfully")
    else:
        print(f"❌ Failed: {response.text}")
    
    # GET - Retrieve schedule
    print("📖 Getting schedule...")
    response = requests.get(f"{BASE_URL}/offers/{TEST_OFFER_ID}/schedule", headers=headers)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        print("✅ Schedule retrieved successfully")
        print(json.dumps(response.json(), indent=2))
    else:
        print(f"❌ Failed: {response.text}")

def test_smart_rules_endpoints():
    """Test smart rules CRUD operations"""
    print("\n⚡ Testing Smart Rules Endpoints...")
    
    # Test rule data
    rule_data = {
        "rule": {
            "type": "GEO",
            "destinationUrl": "https://example.com/us-landing",
            "geo": ["US"],
            "splitPercentage": 70,
            "cap": 300,
            "priority": 1,
            "active": True
        }
    }
    
    # POST - Create rule
    print("📝 Creating smart rule...")
    response = requests.post(f"{BASE_URL}/offers/{TEST_OFFER_ID}/smart-rules", 
                           headers=headers, json=rule_data)
    print(f"Status: {response.status_code}")
    if response.status_code == 201:
        print("✅ Smart rule created successfully")
        rule_id = response.json().get("rule", {}).get("id")
        print(f"Rule ID: {rule_id}")
        return rule_id
    else:
        print(f"❌ Failed: {response.text}")
        return None

def test_activation_check():
    """Test activation check endpoint"""
    print("\n🔍 Testing Activation Check...")
    
    response = requests.get(f"{BASE_URL}/offers/{TEST_OFFER_ID}/activation-check", headers=headers)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        print("✅ Activation check successful")
        result = response.json()
        print(f"Active: {result.get('active')}")
        print(f"Reasons: {result.get('reasons', [])}")
    else:
        print(f"❌ Failed: {response.text}")

if __name__ == "__main__":
    print("🚀 Starting Schedule + Smart Rules API Tests")
    print(f"Base URL: {BASE_URL}")
    print(f"Test Offer ID: {TEST_OFFER_ID}")
    
    try:
        test_schedule_endpoints()
        rule_id = test_smart_rules_endpoints()
        test_activation_check()
        
        print("\n✅ All tests completed!")
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {str(e)}")
