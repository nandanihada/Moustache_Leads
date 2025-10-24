#!/usr/bin/env python3
"""
Simple test script for Schedule + Smart Rules functionality
Tests the models directly without requiring authentication
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.offer_extended import OfferExtended
from utils.frontend_mapping import FrontendDatabaseMapper
from datetime import datetime
import json

def test_field_mapping():
    """Test the frontend to database field mapping"""
    print("🧪 Testing Field Mapping...")
    
    frontend_data = {
        "name": "Test Offer - Schedule + Rules",
        "description": "Testing schedule and smart rules",
        "status": "pending",
        "countries": ["US", "CA"],
        "payout": 25.50,
        "schedule": {
            "startDate": "2024-11-01",
            "endDate": "2024-12-31",
            "startTime": "09:00",
            "endTime": "17:00",
            "isRecurring": True,
            "weekdays": ["Monday", "Tuesday", "Wednesday"],
            "status": "Active"
        },
        "smartRules": [
            {
                "type": "GEO",
                "destinationUrl": "https://example.com/us",
                "geo": ["US"],
                "splitPercentage": 70,
                "cap": 300,
                "priority": 1,
                "active": True
            }
        ]
    }
    
    try:
        mapped_data = FrontendDatabaseMapper.map_frontend_to_database(frontend_data)
        
        print("✅ Field mapping successful!")
        print("📋 Frontend Schedule:", json.dumps(frontend_data["schedule"], indent=2))
        print("📋 Mapped Schedule:", json.dumps(mapped_data.get("schedule", {}), indent=2, default=str))
        print("📋 Frontend Smart Rules:", json.dumps(frontend_data["smartRules"], indent=2))
        print("📋 Mapped Smart Rules:", json.dumps(mapped_data.get("smartRules", []), indent=2, default=str))
        
        return mapped_data
        
    except Exception as e:
        print(f"❌ Field mapping failed: {str(e)}")
        return None

def test_offer_extended_model():
    """Test the OfferExtended model functionality"""
    print("\n🧪 Testing OfferExtended Model...")
    
    try:
        model = OfferExtended()
        print("✅ OfferExtended model initialized")
        
        # Test database connection
        if model._check_db_connection():
            print("✅ Database connection successful")
        else:
            print("⚠️ Database connection failed - using fallback mode")
        
        return model
        
    except Exception as e:
        print(f"❌ OfferExtended model failed: {str(e)}")
        return None

def test_validation():
    """Test schedule and smart rules validation"""
    print("\n🧪 Testing Validation...")
    
    try:
        model = OfferExtended()
        
        # Test schedule validation
        schedule_data = {
            "startAt": datetime(2024, 11, 1, 9, 0),
            "endAt": datetime(2024, 12, 31, 17, 0),
            "isRecurring": True,
            "recurringDays": ["Monday", "Tuesday", "Wednesday"],
            "status": "Active"
        }
        
        schedule_valid, schedule_error = model._validate_schedule(schedule_data)
        print(f"Schedule validation: {'✅ PASS' if schedule_valid else '❌ FAIL'} - {schedule_error}")
        
        # Test smart rules validation
        smart_rules_data = [
            {
                "type": "GEO",
                "url": "https://example.com/us",
                "geo": ["US"],
                "percentage": 70,
                "cap": 300,
                "priority": 1,
                "active": True
            }
        ]
        
        rules_valid, rules_error = model._validate_smart_rules(smart_rules_data)
        print(f"Smart Rules validation: {'✅ PASS' if rules_valid else '❌ FAIL'} - {rules_error}")
        
        return schedule_valid and rules_valid
        
    except Exception as e:
        print(f"❌ Validation test failed: {str(e)}")
        return False

def test_data_processing():
    """Test data processing functions"""
    print("\n🧪 Testing Data Processing...")
    
    try:
        model = OfferExtended()
        
        # Test schedule processing
        schedule_input = {
            "startAt": datetime(2024, 11, 1, 9, 0),
            "endAt": datetime(2024, 12, 31, 17, 0),
            "isRecurring": True,
            "recurringDays": ["Monday", "Tuesday", "Wednesday"],
            "status": "Active"
        }
        
        processed_schedule = model._process_schedule_data(schedule_input)
        print("✅ Schedule processing successful")
        print("📋 Processed Schedule:", json.dumps(processed_schedule, indent=2, default=str))
        
        # Test smart rules processing
        rules_input = [
            {
                "type": "GEO",
                "url": "https://example.com/us",
                "geo": ["US"],
                "percentage": 70,
                "cap": 300,
                "priority": 1,
                "active": True
            }
        ]
        
        processed_rules = model._process_smart_rules_data(rules_input)
        print("✅ Smart Rules processing successful")
        print("📋 Processed Rules:", json.dumps(processed_rules, indent=2, default=str))
        
        return True
        
    except Exception as e:
        print(f"❌ Data processing test failed: {str(e)}")
        return False

def test_full_integration():
    """Test full integration from frontend data to processed data"""
    print("\n🧪 Testing Full Integration...")
    
    try:
        # Step 1: Frontend data
        frontend_data = {
            "name": "Integration Test Offer",
            "description": "Full integration test",
            "status": "pending",
            "countries": ["US"],
            "payout": 30.00,
            "schedule": {
                "startDate": "2024-11-01",
                "endDate": "2024-12-31",
                "startTime": "09:00",
                "endTime": "17:00",
                "isRecurring": True,
                "weekdays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                "status": "Active"
            },
            "smartRules": [
                {
                    "type": "GEO",
                    "destinationUrl": "https://example.com/us-landing",
                    "geo": ["US"],
                    "splitPercentage": 80,
                    "cap": 500,
                    "priority": 1,
                    "active": True
                },
                {
                    "type": "Backup",
                    "destinationUrl": "https://example.com/backup",
                    "geo": ["US", "CA"],
                    "splitPercentage": 100,
                    "cap": 0,
                    "priority": 99,
                    "active": True
                }
            ]
        }
        
        print("📥 Frontend Data Ready")
        
        # Step 2: Field mapping
        mapped_data = FrontendDatabaseMapper.map_frontend_to_database(frontend_data)
        print("✅ Field mapping completed")
        
        # Step 3: Model validation
        model = OfferExtended()
        
        schedule_valid, schedule_error = model._validate_schedule(mapped_data.get("schedule", {}))
        rules_valid, rules_error = model._validate_smart_rules(mapped_data.get("smartRules", []))
        
        if not schedule_valid:
            print(f"❌ Schedule validation failed: {schedule_error}")
            return False
            
        if not rules_valid:
            print(f"❌ Smart Rules validation failed: {rules_error}")
            return False
        
        print("✅ Validation completed")
        
        # Step 4: Data processing
        processed_schedule = model._process_schedule_data(mapped_data.get("schedule", {}))
        processed_rules = model._process_smart_rules_data(mapped_data.get("smartRules", []))
        
        print("✅ Data processing completed")
        
        print("\n📋 FINAL RESULTS:")
        print("=" * 50)
        print("Schedule Data:")
        print(json.dumps(processed_schedule, indent=2, default=str))
        print("\nSmart Rules Data:")
        print(json.dumps(processed_rules, indent=2, default=str))
        print("=" * 50)
        
        return True
        
    except Exception as e:
        print(f"❌ Full integration test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print("🚀 STARTING SCHEDULE + SMART RULES TESTS")
    print("=" * 60)
    
    results = {
        "field_mapping": False,
        "model_init": False,
        "validation": False,
        "data_processing": False,
        "full_integration": False
    }
    
    # Test 1: Field Mapping
    mapped_data = test_field_mapping()
    results["field_mapping"] = mapped_data is not None
    
    # Test 2: Model Initialization
    model = test_offer_extended_model()
    results["model_init"] = model is not None
    
    # Test 3: Validation
    results["validation"] = test_validation()
    
    # Test 4: Data Processing
    results["data_processing"] = test_data_processing()
    
    # Test 5: Full Integration
    results["full_integration"] = test_full_integration()
    
    # Summary
    print("\n" + "=" * 60)
    print("🏁 TEST SUMMARY:")
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"   {test_name.replace('_', ' ').title()}: {status}")
    
    all_passed = all(results.values())
    print("=" * 60)
    
    if all_passed:
        print("🎉 ALL TESTS PASSED - Schedule + Smart Rules functionality is working!")
    else:
        print("⚠️ SOME TESTS FAILED - Check the logs above for details")
    
    return all_passed

if __name__ == "__main__":
    main()
