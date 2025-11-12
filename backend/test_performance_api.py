"""
Test the performance report API directly to see if data is being returned
"""

import requests
import json
from datetime import datetime, timedelta

# Test the performance report endpoint
url = "http://localhost:5000/api/reports/performance"

# Try without authentication first (might work for testing)
params = {
    'start_date': '2024-11-01',
    'end_date': '2024-11-15',
    'group_by': 'date,offer_id'
}

print("🔍 Testing Performance Report API...")
print("=" * 60)

try:
    # Test without auth
    print("\n1. Testing without authentication...")
    response = requests.get(url, params=params, timeout=10)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text[:500]}...")
    
except Exception as e:
    print(f"Error: {e}")

# Test with a mock token
try:
    print("\n2. Testing with mock token...")
    headers = {'Authorization': 'Bearer mock-token'}
    response = requests.get(url, params=params, headers=headers, timeout=10)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text[:500]}...")
    
except Exception as e:
    print(f"Error: {e}")

# Test the direct database query
print("\n3. Testing direct database query...")
try:
    from models.user_reports import UserReportsModel
    from datetime import datetime
    
    user_reports = UserReportsModel()
    
    # Test with a mock user_id
    date_range = {
        'start': datetime(2024, 11, 1),
        'end': datetime(2024, 11, 15)
    }
    
    report = user_reports.get_performance_report(
        user_id='test-user',
        date_range=date_range,
        group_by=['date', 'offer_id']
    )
    
    print(f"✅ Direct query successful!")
    print(f"Report data count: {len(report)}")
    
    if report:
        print(f"\nSample row:")
        sample = report[0]
        for key, value in sample.items():
            print(f"  {key}: {value}")
            
        print(f"\nChecking specific columns from screenshot:")
        for col in ['ad_group', 'goal', 'promo_code', 'creative', 'country', 'browser', 'device_type', 'source', 'advertiser_sub_id1']:
            value = sample.get(col, 'MISSING')
            status = "✅" if value and value != 'MISSING' and value != '' else "❌"
            print(f"  {status} {col}: {value}")
    
except Exception as e:
    print(f"❌ Direct query failed: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("🎯 DIAGNOSIS COMPLETE")
