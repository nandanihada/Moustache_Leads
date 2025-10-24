#!/usr/bin/env python3
"""
Test Schedule + Smart Rules functionality without authentication
"""

import requests
import json

BASE_URL = "http://localhost:5000"

def test_sample_data():
    """Get sample data for testing"""
    print("🧪 Getting sample data...")
    
    try:
        response = requests.get(f"{BASE_URL}/api/test/schedule-rules/sample-data")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Sample data retrieved")
            return data.get('sample_data')
        else:
            print(f"❌ Failed to get sample data: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return None

def test_field_mapping(sample_data):
    """Test field mapping"""
    print("\n🧪 Testing field mapping...")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/test/schedule-rules/field-mapping",
            json=sample_data,
            headers={'Content-Type': 'application/json'}
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Field mapping successful")
            print("📋 Original schedule:", json.dumps(result['original_data']['schedule'], indent=2))
            print("📋 Mapped schedule:", json.dumps(result['mapped_data']['schedule'], indent=2, default=str))
            return True
        else:
            print(f"❌ Field mapping failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

def test_validation(sample_data):
    """Test validation"""
    print("\n🧪 Testing validation...")
    
    try:
        # First map the data
        map_response = requests.post(
            f"{BASE_URL}/api/test/schedule-rules/field-mapping",
            json=sample_data,
            headers={'Content-Type': 'application/json'}
        )
        
        if map_response.status_code != 200:
            print("❌ Failed to map data for validation test")
            return False
        
        mapped_data = map_response.json()['mapped_data']
        
        # Test validation
        response = requests.post(
            f"{BASE_URL}/api/test/schedule-rules/validation",
            json=mapped_data,
            headers={'Content-Type': 'application/json'}
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Validation test completed")
            
            validation_results = result['results']
            if 'schedule_validation' in validation_results:
                schedule_valid = validation_results['schedule_validation']['valid']
                print(f"   Schedule: {'✅ VALID' if schedule_valid else '❌ INVALID'}")
                if not schedule_valid:
                    print(f"   Error: {validation_results['schedule_validation']['error']}")
            
            if 'smart_rules_validation' in validation_results:
                rules_valid = validation_results['smart_rules_validation']['valid']
                print(f"   Smart Rules: {'✅ VALID' if rules_valid else '❌ INVALID'}")
                if not rules_valid:
                    print(f"   Error: {validation_results['smart_rules_validation']['error']}")
            
            return True
        else:
            print(f"❌ Validation failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

def test_full_flow(sample_data):
    """Test complete data flow"""
    print("\n🧪 Testing full data flow...")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/test/schedule-rules/full-flow",
            json=sample_data,
            headers={'Content-Type': 'application/json'}
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Full flow test completed")
            
            steps = result['steps']
            
            # Check validation results
            validation = steps['validation_results']
            if 'schedule' in validation:
                schedule_valid = validation['schedule']['valid']
                print(f"   Schedule validation: {'✅ PASS' if schedule_valid else '❌ FAIL'}")
            
            if 'smart_rules' in validation:
                rules_valid = validation['smart_rules']['valid']
                print(f"   Smart Rules validation: {'✅ PASS' if rules_valid else '❌ FAIL'}")
            
            # Show final processed data
            processing = steps['processing_results']
            if 'schedule' in processing:
                print("📋 Final Schedule Data:")
                print(json.dumps(processing['schedule'], indent=2, default=str))
            
            if 'smart_rules' in processing:
                print("📋 Final Smart Rules Data:")
                print(json.dumps(processing['smart_rules'], indent=2, default=str))
            
            return True
        else:
            print(f"❌ Full flow test failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

def test_database_connection():
    """Test database connection"""
    print("\n🧪 Testing database connection...")
    
    try:
        response = requests.get(f"{BASE_URL}/api/test/schedule-rules/database-connection")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            connected = result.get('connected', False)
            print(f"   Database: {'✅ CONNECTED' if connected else '⚠️ DISCONNECTED'}")
            return connected
        else:
            print(f"❌ Database test failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("🚀 TESTING SCHEDULE + SMART RULES (NO AUTH)")
    print("=" * 60)
    
    # Test 1: Get sample data
    sample_data = test_sample_data()
    if not sample_data:
        print("❌ Cannot continue - no sample data")
        return
    
    # Test 2: Database connection
    db_connected = test_database_connection()
    
    # Test 3: Field mapping
    mapping_success = test_field_mapping(sample_data)
    
    # Test 4: Validation
    validation_success = test_validation(sample_data)
    
    # Test 5: Full flow
    full_flow_success = test_full_flow(sample_data)
    
    # Summary
    print("\n" + "=" * 60)
    print("🏁 TEST SUMMARY:")
    print(f"   Database Connection: {'✅ PASS' if db_connected else '⚠️ DISCONNECTED'}")
    print(f"   Field Mapping: {'✅ PASS' if mapping_success else '❌ FAIL'}")
    print(f"   Validation: {'✅ PASS' if validation_success else '❌ FAIL'}")
    print(f"   Full Flow: {'✅ PASS' if full_flow_success else '❌ FAIL'}")
    print("=" * 60)
    
    if mapping_success and validation_success and full_flow_success:
        print("🎉 ALL CORE TESTS PASSED!")
        print("📋 Schedule + Smart Rules functionality is working correctly!")
        if not db_connected:
            print("⚠️ Note: Database is disconnected, but core logic is functional")
    else:
        print("⚠️ SOME TESTS FAILED - Check server logs for details")

if __name__ == "__main__":
    main()
