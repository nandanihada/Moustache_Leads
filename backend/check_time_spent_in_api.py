"""
Check if time spent data is in API response
"""

import requests
import json

print("🔍 Checking Time Spent in API Response...")
print("=" * 60)

try:
    # Call the API
    url = "http://localhost:5000/api/reports/performance"
    params = {
        'start_date': '2025-11-01',
        'end_date': '2025-11-15',
        'group_by': 'date,offer_id'
    }
    
    headers = {
        'Authorization': 'Bearer test-token'
    }
    
    response = requests.get(url, params=params, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        rows = data.get('report', {}).get('data', [])
        
        print(f"✅ Got {len(rows)} rows")
        
        # Find rows with conversions
        conversion_rows = [row for row in rows if row.get('conversions', 0) > 0]
        print(f"📊 Rows with conversions: {len(conversion_rows)}")
        
        if conversion_rows:
            sample = conversion_rows[0]
            print(f"\n📋 SAMPLE CONVERSION ROW:")
            print(f"  Date: {sample.get('date')}")
            print(f"  Offer: {sample.get('offer_name')}")
            print(f"  Clicks: {sample.get('clicks', 0)}")
            print(f"  Conversions: {sample.get('conversions', 0)}")
            print(f"  Time Spent: {sample.get('avg_time_spent_seconds', 'MISSING')}")
            
            # Check if time spent field exists
            has_time_spent = 'avg_time_spent_seconds' in sample
            print(f"  Has time_spent field: {has_time_spent}")
            
            if has_time_spent:
                time_spent = sample.get('avg_time_spent_seconds')
                if time_spent:
                    if time_spent < 60:
                        print(f"  Time Spent Formatted: {round(time_spent)}s")
                    else:
                        print(f"  Time Spent Formatted: {round(time_spent/60)}m")
                else:
                    print(f"  Time Spent: No data (0 or None)")
            
            print(f"\n📋 ALL FIELDS IN SAMPLE:")
            for key, value in sample.items():
                if 'time' in key.lower() or 'spent' in key.lower():
                    print(f"  {key}: {value}")
        else:
            print("❌ No conversion rows found")
    else:
        print(f"❌ API Error: {response.status_code}")
        print(response.text)
        
except Exception as e:
    print(f"❌ Error: {e}")

print("\n" + "=" * 60)
print("🎯 TIME SPENT CHECK COMPLETE")
