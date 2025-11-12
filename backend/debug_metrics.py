"""
Debug why CR% and EPC are showing 0.00% instead of calculated values
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.user_reports import UserReports
from datetime import datetime
import json

print("🔍 Debugging Metrics Calculation...")
print("=" * 60)

try:
    user_reports = UserReports()
    
    # Test with the actual date range from our data
    date_range = {
        'start': datetime(2025, 11, 1),
        'end': datetime(2025, 11, 15)
    }
    
    print(f"📅 Date range: {date_range['start']} to {date_range['end']}")
    
    report = user_reports.get_performance_report(
        user_id='test-user',
        date_range=date_range,
        group_by=['date', 'offer_id']
    )
    
    data = report.get('data', [])
    print(f"✅ Report generated: {len(data)} rows")
    
    if data:
        print(f"\n🔍 Sample row (first result):")
        sample = data[0]
        
        print(f"\n📊 RAW DATA:")
        for key in ['clicks', 'conversions', 'total_payout', 'cr', 'epc']:
            value = sample.get(key, 'MISSING')
            print(f"  {key}: {value} (type: {type(value)})")
            
        print(f"\n🧮 MANUAL CALCULATION:")
        clicks = sample.get('clicks', 0)
        conversions = sample.get('conversions', 0)
        payout = sample.get('total_payout', 0)
        
        if clicks > 0:
            manual_cr = (conversions / clicks) * 100
            manual_epc = payout / clicks
            print(f"  Manual CR: {manual_cr:.2f}%")
            print(f"  Manual EPC: ${manual_epc:.2f}")
        else:
            print(f"  No clicks to calculate from")
            
        print(f"\n📋 FULL SAMPLE ROW:")
        print(json.dumps(sample, indent=2, default=str))
    
    else:
        print("❌ No data returned!")
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("🎯 DIAGNOSIS COMPLETE")
