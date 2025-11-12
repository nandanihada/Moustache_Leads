"""
Debug what the API is actually returning to see if metrics are calculated
"""

import requests
import json

print("🔍 Testing API Response...")
print("=" * 60)

url = "http://localhost:5000/api/reports/performance"
params = {
    'start_date': '2025-11-01',
    'end_date': '2025-11-15',
    'group_by': 'date,offer_id'
}

try:
    response = requests.get(url, params=params, timeout=10)
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        
        if data.get('success') and data.get('report', {}).get('data'):
            report_data = data['report']['data']
            print(f"✅ Got {len(report_data)} rows")
            
            if report_data:
                sample = report_data[0]
                print(f"\n📊 SAMPLE ROW:")
                
                # Check key metrics
                metrics_to_check = [
                    'clicks', 'conversions', 'total_payout', 
                    'cr', 'epc', 'ctr', 'cpa', 'cpc'
                ]
                
                for metric in metrics_to_check:
                    value = sample.get(metric, 'MISSING')
                    print(f"  {metric}: {value}")
                
                print(f"\n📋 FULL SAMPLE ROW:")
                print(json.dumps(sample, indent=2, default=str))
                
                # Check if any row has non-zero conversions
                rows_with_conversions = [r for r in report_data if r.get('conversions', 0) > 0]
                print(f"\n💰 ROWS WITH CONVERSIONS: {len(rows_with_conversions)}")
                
                if rows_with_conversions:
                    conv_sample = rows_with_conversions[0]
                    print(f"  Sample conversion row:")
                    print(f"    Clicks: {conv_sample.get('clicks', 0)}")
                    print(f"    Conversions: {conv_sample.get('conversions', 0)}")
                    print(f"    Payout: ${conv_sample.get('total_payout', 0)}")
                    print(f"    CR: {conv_sample.get('cr', 0)}%")
                    print(f"    EPC: ${conv_sample.get('epc', 0)}")
            else:
                print("❌ No data in response")
        else:
            print(f"❌ API Error: {data}")
    else:
        print(f"❌ HTTP Error: {response.text}")
        
except Exception as e:
    print(f"❌ Request failed: {e}")

print("\n" + "=" * 60)
print("🎯 API TEST COMPLETE")
