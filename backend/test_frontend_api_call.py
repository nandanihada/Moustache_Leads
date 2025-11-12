"""
Test the exact API call that the frontend is making
"""

import requests
import json

# Test the exact endpoint and parameters the frontend uses
url = "http://localhost:5000/api/reports/performance"

params = {
    'start_date': '2025-11-01',
    'end_date': '2025-11-15', 
    'group_by': 'date,offer_id',
    'page': 1,
    'per_page': 20
}

print("🔍 Testing Frontend API Call...")
print("=" * 60)
print(f"URL: {url}")
print(f"Params: {params}")

# Test without authentication (see what error we get)
try:
    print("\n1. Testing without authentication...")
    response = requests.get(url, params=params, timeout=10)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
    
except Exception as e:
    print(f"Error: {e}")

# Check if there's a different endpoint
print("\n2. Checking available endpoints...")
try:
    # Test root
    response = requests.get("http://localhost:5000/", timeout=5)
    print(f"Root status: {response.status_code}")
    
    # Test API root
    response = requests.get("http://localhost:5000/api/", timeout=5)
    print(f"API root status: {response.status_code}")
    
except Exception as e:
    print(f"Error checking endpoints: {e}")

# Check if we can bypass auth for testing
print("\n3. Looking for test endpoints...")
test_endpoints = [
    "/api/reports/performance",
    "/api/performance-report", 
    "/reports/performance",
    "/performance-report"
]

for endpoint in test_endpoints:
    try:
        test_url = f"http://localhost:5000{endpoint}"
        response = requests.get(test_url, params=params, timeout=5)
        print(f"{endpoint}: {response.status_code} - {response.text[:100]}...")
    except Exception as e:
        print(f"{endpoint}: Error - {e}")

print("\n" + "=" * 60)
print("🎯 DIAGNOSIS COMPLETE")
