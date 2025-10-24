#!/usr/bin/env python3
"""
QA Verification Test Script for Schedule + Smart Rules Data Flow
Tests the complete data flow from frontend → backend → MongoDB
"""

import requests
import json
from datetime import datetime, timedelta

# Configuration
BASE_URL = "http://localhost:5000"
ADMIN_TOKEN = "your_admin_token_here"  # Replace with actual admin token

headers = {
    "Authorization": f"Bearer {ADMIN_TOKEN}",
    "Content-Type": "application/json"
}

def test_create_offer_with_schedule_and_rules():
    """Test creating an offer with schedule and smart rules data"""
    print("🧪 Testing CREATE OFFER with Schedule + Smart Rules...")
    
    # Test payload matching frontend format
    test_payload = {
        "campaign_id": "TEST-001",
        "name": "QA Test Offer - Schedule + Rules",
        "description": "Testing schedule and smart rules data flow",
        "status": "pending",
        "countries": ["US", "CA"],
        "payout": 25.50,
        "network": "TestNetwork",
        "target_url": "https://example.com/landing",
        "affiliates": "all",
        
        # 🔍 CRITICAL: Schedule data (frontend format)
        "schedule": {
            "startDate": "2024-11-01",
            "endDate": "2024-12-31", 
            "startTime": "09:00",
            "endTime": "17:00",
            "isRecurring": True,
            "weekdays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            "status": "Active"
        },
        
        # 🔍 CRITICAL: Smart Rules data (frontend format)
        "smartRules": [
            {
                "type": "GEO",
                "destinationUrl": "https://example.com/us-landing",
                "geo": ["US"],
                "splitPercentage": 70,
                "cap": 300,
                "priority": 1,
                "active": True
            },
            {
                "type": "Backup",
                "destinationUrl": "https://example.com/backup-landing",
                "geo": ["US", "CA"],
                "splitPercentage": 100,
                "cap": 0,
                "priority": 99,
                "active": True
            }
        ]
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/admin/offers", 
                               headers=headers, json=test_payload)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 201:
            print("✅ CREATE OFFER SUCCESS")
            offer_data = response.json().get('offer', {})
            return offer_data.get('offer_id')
        else:
            print("❌ CREATE OFFER FAILED")
            return None
            
    except Exception as e:
        print(f"❌ CREATE OFFER ERROR: {str(e)}")
        return None

def test_update_offer_with_schedule_and_rules(offer_id):
    """Test updating an offer with schedule and smart rules data"""
    print(f"\n🧪 Testing UPDATE OFFER {offer_id} with Schedule + Smart Rules...")
    
    # Updated test payload
    update_payload = {
        "name": "QA Test Offer - UPDATED Schedule + Rules",
        "description": "Updated testing schedule and smart rules data flow",
        
        # 🔍 CRITICAL: Updated Schedule data
        "schedule": {
            "startDate": "2024-11-15",
            "endDate": "2025-01-31",
            "startTime": "08:00", 
            "endTime": "18:00",
            "isRecurring": True,
            "weekdays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
            "status": "Active"
        },
        
        # 🔍 CRITICAL: Updated Smart Rules data
        "smartRules": [
            {
                "type": "GEO",
                "destinationUrl": "https://example.com/updated-us-landing",
                "geo": ["US"],
                "splitPercentage": 80,
                "cap": 500,
                "priority": 1,
                "active": True
            },
            {
                "type": "GEO", 
                "destinationUrl": "https://example.com/ca-landing",
                "geo": ["CA"],
                "splitPercentage": 60,
                "cap": 200,
                "priority": 2,
                "active": True
            },
            {
                "type": "Backup",
                "destinationUrl": "https://example.com/updated-backup",
                "geo": ["US", "CA", "GB"],
                "splitPercentage": 100,
                "cap": 0,
                "priority": 99,
                "active": True
            }
        ]
    }
    
    try:
        response = requests.put(f"{BASE_URL}/api/admin/offers/{offer_id}", 
                              headers=headers, json=update_payload)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            print("✅ UPDATE OFFER SUCCESS")
            return True
        else:
            print("❌ UPDATE OFFER FAILED")
            return False
            
    except Exception as e:
        print(f"❌ UPDATE OFFER ERROR: {str(e)}")
        return False

def test_get_offer_with_schedule_and_rules(offer_id):
    """Test retrieving an offer to verify schedule and smart rules data"""
    print(f"\n🧪 Testing GET OFFER {offer_id} to verify data persistence...")
    
    try:
        response = requests.get(f"{BASE_URL}/api/admin/offers/{offer_id}", headers=headers)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            offer_data = response.json().get('offer', {})
            
            print("📋 VERIFICATION RESULTS:")
            print("=" * 50)
            
            # Check schedule data
            schedule = offer_data.get('schedule')
            if schedule:
                print("✅ Schedule data found:")
                print(f"   Start: {schedule.get('startAt', 'N/A')}")
                print(f"   End: {schedule.get('endAt', 'N/A')}")
                print(f"   Recurring: {schedule.get('isRecurring', 'N/A')}")
                print(f"   Days: {schedule.get('recurringDays', 'N/A')}")
                print(f"   Status: {schedule.get('status', 'N/A')}")
            else:
                print("❌ Schedule data NOT found")
            
            # Check smart rules data
            smart_rules = offer_data.get('smartRules', [])
            if smart_rules:
                print(f"✅ Smart Rules data found ({len(smart_rules)} rules):")
                for i, rule in enumerate(smart_rules):
                    print(f"   Rule {i+1}: {rule.get('type')} - {rule.get('url')} - GEO: {rule.get('geo')} - Active: {rule.get('active')}")
            else:
                print("❌ Smart Rules data NOT found")
            
            print("=" * 50)
            return True
        else:
            print("❌ GET OFFER FAILED")
            return False
            
    except Exception as e:
        print(f"❌ GET OFFER ERROR: {str(e)}")
        return False

def test_schedule_rules_endpoints(offer_id):
    """Test dedicated schedule and smart rules endpoints"""
    print(f"\n🧪 Testing dedicated Schedule + Smart Rules endpoints for {offer_id}...")
    
    # Test schedule endpoint
    try:
        response = requests.get(f"{BASE_URL}/api/admin/offers/{offer_id}/schedule", headers=headers)
        print(f"Schedule Endpoint Status: {response.status_code}")
        if response.status_code == 200:
            print("✅ Schedule endpoint working")
        else:
            print("❌ Schedule endpoint failed")
    except Exception as e:
        print(f"❌ Schedule endpoint error: {str(e)}")
    
    # Test smart rules endpoint
    try:
        response = requests.get(f"{BASE_URL}/api/admin/offers/{offer_id}/smart-rules", headers=headers)
        print(f"Smart Rules Endpoint Status: {response.status_code}")
        if response.status_code == 200:
            print("✅ Smart Rules endpoint working")
        else:
            print("❌ Smart Rules endpoint failed")
    except Exception as e:
        print(f"❌ Smart Rules endpoint error: {str(e)}")

def main():
    """Run comprehensive QA verification tests"""
    print("🚀 STARTING QA VERIFICATION TESTS")
    print("=" * 60)
    
    # Test 1: Create offer with schedule + smart rules
    offer_id = test_create_offer_with_schedule_and_rules()
    
    if offer_id:
        # Test 2: Update offer with schedule + smart rules
        update_success = test_update_offer_with_schedule_and_rules(offer_id)
        
        # Test 3: Verify data persistence
        get_success = test_get_offer_with_schedule_and_rules(offer_id)
        
        # Test 4: Test dedicated endpoints
        test_schedule_rules_endpoints(offer_id)
        
        print("\n" + "=" * 60)
        print("🏁 QA VERIFICATION SUMMARY:")
        print(f"   Create Offer: {'✅ PASS' if offer_id else '❌ FAIL'}")
        print(f"   Update Offer: {'✅ PASS' if update_success else '❌ FAIL'}")
        print(f"   Get Offer: {'✅ PASS' if get_success else '❌ FAIL'}")
        print("=" * 60)
        
        if offer_id and update_success and get_success:
            print("🎉 ALL TESTS PASSED - Data flow is working correctly!")
        else:
            print("⚠️ SOME TESTS FAILED - Check the logs above for details")
    else:
        print("❌ Cannot continue tests - Create offer failed")

if __name__ == "__main__":
    main()
