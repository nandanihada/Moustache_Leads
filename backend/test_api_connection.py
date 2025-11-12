"""
Test API connection and performance report
"""

import requests
import json

print("🔍 Testing API Connection...")
print("=" * 50)

try:
    # Test basic connection
    print("1. Testing basic connection...")
    response = requests.get("http://localhost:5000/api/health", timeout=5)
    print(f"   Health check: {response.status_code}")
    
    # Test performance report
    print("2. Testing performance report...")
    url = "http://localhost:5000/api/reports/performance"
    params = {
        'start_date': '2025-11-01',
        'end_date': '2025-11-15',
        'group_by': 'date,offer_id'
    }
    headers = {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json'
    }
    
    response = requests.get(url, params=params, headers=headers, timeout=10)
    print(f"   Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        if data.get('success'):
            report_data = data.get('report', {}).get('data', [])
            print(f"   ✅ Success! Got {len(report_data)} rows")
            
            if report_data:
                sample = report_data[0]
                print(f"   Sample: {sample.get('date')} - {sample.get('offer_name')} - {sample.get('clicks')} clicks")
        else:
            print(f"   ❌ API returned success=false")
            print(f"   Error: {data.get('error', 'Unknown error')}")
    else:
        print(f"   ❌ HTTP Error: {response.status_code}")
        print(f"   Response: {response.text[:200]}...")
        
except requests.exceptions.ConnectionError:
    print("   ❌ Connection Error: Backend not running or not accessible")
except requests.exceptions.Timeout:
    print("   ❌ Timeout Error: Backend taking too long to respond")
except Exception as e:
    print(f"   ❌ Error: {e}")

print("\n" + "=" * 50)
print("🎯 API TEST COMPLETE")
