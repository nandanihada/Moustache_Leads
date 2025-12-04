#!/usr/bin/env python3
"""
Test performance report endpoint
"""

import requests
from datetime import datetime, timedelta

# Test the endpoint
base_url = "http://localhost:5000"

# Set date range
end_date = datetime.now()
start_date = end_date - timedelta(days=7)

params = {
    'start_date': start_date.strftime('%Y-%m-%d'),
    'end_date': end_date.strftime('%Y-%m-%d'),
    'group_by': 'date',
    'page': 1,
    'per_page': 20
}

print("Testing Performance Report Endpoint")
print("="*80)
print(f"URL: {base_url}/api/reports/performance")
print(f"Params: {params}")
print("="*80)

try:
    response = requests.get(f"{base_url}/api/reports/performance", params=params)
    print(f"\nStatus Code: {response.status_code}")
    print(f"Response: {response.text[:1000]}")  # First 1000 chars
    
    if response.status_code == 200:
        data = response.json()
        print("\n✅ Success!")
        print(f"Report data: {data}")
    else:
        print(f"\n❌ Error: {response.status_code}")
        print(f"Response: {response.text}")
        
except Exception as e:
    print(f"\n❌ Exception: {e}")
    import traceback
    traceback.print_exc()
