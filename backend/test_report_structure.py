"""
Test the performance report structure
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.user_reports import UserReports
from datetime import datetime
import json

print("🔍 Testing Performance Report Structure...")
print("=" * 60)

try:
    user_reports = UserReports()
    
    # Test with a date range that includes our test data
    date_range = {
        'start': datetime(2024, 11, 5),
        'end': datetime(2024, 11, 15)
    }
    
    print(f"📅 Date range: {date_range['start']} to {date_range['end']}")
    
    report = user_reports.get_performance_report(
        user_id='test-user',
        date_range=date_range,
        group_by=['date', 'offer_id']
    )
    
    print(f"✅ Query successful!")
    print(f"📊 Report keys: {list(report.keys())}")
    
    # Check data section
    data = report.get('data', [])
    print(f"📊 Data count: {len(data)}")
    
    if data:
        sample = data[0]
        print(f"\n🔍 Sample row:")
        
        print(f"\n📋 ALL FIELDS:")
        for key, value in sorted(sample.items()):
            print(f"  {key}: {value}")
            
        print(f"\n🎯 SCREENSHOT COLUMNS STATUS:")
        screenshot_columns = {
            'ad_group': 'Ad Group',
            'goal': 'Goal', 
            'promo_code': 'Promo Code',
            'creative': 'Creative',
            'country': 'Country',
            'browser': 'Browser',
            'device_type': 'Device',
            'source': 'Source',
            'advertiser_sub_id1': 'Adv Sub 1'
        }
        
        for field, display_name in screenshot_columns.items():
            value = sample.get(field, 'MISSING')
            if value and value != 'MISSING' and value != '' and value != '-' and value is not None:
                print(f"  ✅ {display_name}: '{value}'")
            else:
                print(f"  ❌ {display_name}: EMPTY (value: {repr(value)})")
                
        print(f"\n🔢 STATISTICS:")
        stats_fields = ['clicks', 'conversions', 'total_payout', 'cr', 'epc']
        for field in stats_fields:
            value = sample.get(field, 0)
            print(f"  📈 {field}: {value}")
            
        print(f"\n🔍 FULL SAMPLE ROW JSON:")
        print(json.dumps(sample, indent=2, default=str))
    
    else:
        print("❌ No data in report!")
        print(f"📊 Full report structure:")
        print(json.dumps(report, indent=2, default=str))
        
except Exception as e:
    print(f"❌ Query failed: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("🎯 DIAGNOSIS COMPLETE")
