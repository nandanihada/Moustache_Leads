"""
Test script for User Reports API
Run this to test the new report endpoints
"""

import requests
from datetime import datetime, timedelta
import json

# Configuration
BASE_URL = "http://localhost:5000"
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiNjhlNGU0MWE0YWQ2NjI1NjNmZGI1NjhhIiwidXNlcm5hbWUiOiJhZG1pbiIsImV4cCI6MTc2MjU5NTY3OSwiaWF0IjoxNzYyNTA5Mjc5fQ.DqRNCHgDOUKfWkQ8nHTCLvXR2JPQ-EaZuOo8Qco93Bk"  # Replace with actual token after logging in

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

def test_performance_report():
    """Test Performance Report endpoint"""
    print("\n" + "="*70)
    print("🧪 TESTING PERFORMANCE REPORT")
    print("="*70)
    
    # Calculate date range (last 7 days)
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=7)
    
    params = {
        'start_date': start_date.isoformat(),
        'end_date': end_date.isoformat(),
        'group_by': 'date,offer_id',
        'page': 1,
        'per_page': 10
    }
    
    response = requests.get(
        f"{BASE_URL}/api/reports/performance",
        headers=headers,
        params=params
    )
    
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print("✅ Performance Report Retrieved Successfully!")
        print(f"\nSummary:")
        print(f"  Total Clicks: {data['report']['summary']['total_clicks']}")
        print(f"  Total Conversions: {data['report']['summary']['total_conversions']}")
        print(f"  Total Payout: ${data['report']['summary']['total_payout']}")
        print(f"  Avg CR: {data['report']['summary']['avg_cr']}%")
        print(f"  Avg EPC: ${data['report']['summary']['avg_epc']}")
        
        print(f"\nData Rows: {len(data['report']['data'])}")
        if len(data['report']['data']) > 0:
            print(f"\nFirst Row:")
            first_row = data['report']['data'][0]
            for key, value in first_row.items():
                print(f"  {key}: {value}")
    else:
        print(f"❌ Error: {response.text}")

def test_conversion_report():
    """Test Conversion Report endpoint"""
    print("\n" + "="*70)
    print("🧪 TESTING CONVERSION REPORT")
    print("="*70)
    
    # Today's date range
    end_date = datetime.utcnow()
    start_date = end_date.replace(hour=0, minute=0, second=0, microsecond=0)
    
    params = {
        'start_date': start_date.isoformat(),
        'end_date': end_date.isoformat(),
        'page': 1,
        'per_page': 10
    }
    
    response = requests.get(
        f"{BASE_URL}/api/reports/conversions",
        headers=headers,
        params=params
    )
    
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print("✅ Conversion Report Retrieved Successfully!")
        print(f"\nSummary:")
        print(f"  Approved Payout: ${data['report']['summary']['approved_payout']}")
        print(f"  Pending Payout: ${data['report']['summary']['pending_payout']}")
        print(f"  Total Conversions: {data['report']['summary']['total_conversions']}")
        
        print(f"\nConversions: {len(data['report']['conversions'])}")
        if len(data['report']['conversions']) > 0:
            print(f"\nFirst Conversion:")
            first_conv = data['report']['conversions'][0]
            print(f"  Time: {first_conv['time']}")
            print(f"  Offer: {first_conv.get('offer_name', 'N/A')}")
            print(f"  Status: {first_conv['status']}")
            print(f"  Payout: ${first_conv['payout']}")
    else:
        print(f"❌ Error: {response.text}")

def test_chart_data():
    """Test Chart Data endpoint"""
    print("\n" + "="*70)
    print("🧪 TESTING CHART DATA")
    print("="*70)
    
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=7)
    
    params = {
        'start_date': start_date.isoformat(),
        'end_date': end_date.isoformat(),
        'metric': 'conversions',
        'granularity': 'day'
    }
    
    response = requests.get(
        f"{BASE_URL}/api/reports/chart-data",
        headers=headers,
        params=params
    )
    
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print("✅ Chart Data Retrieved Successfully!")
        print(f"\nData Points: {len(data['chart_data'])}")
        if len(data['chart_data']) > 0:
            print("\nSample Points:")
            for point in data['chart_data'][:3]:
                print(f"  {point['date']}: {point['value']}")
    else:
        print(f"❌ Error: {response.text}")

def test_summary():
    """Test Summary endpoint"""
    print("\n" + "="*70)
    print("🧪 TESTING SUMMARY")
    print("="*70)
    
    response = requests.get(
        f"{BASE_URL}/api/reports/summary",
        headers=headers
    )
    
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print("✅ Summary Retrieved Successfully!")
        print(f"\nToday:")
        print(f"  Clicks: {data['summary']['today']['total_clicks']}")
        print(f"  Conversions: {data['summary']['today']['total_conversions']}")
        print(f"  Payout: ${data['summary']['today']['total_payout']}")
        
        print(f"\nLast 7 Days:")
        print(f"  Clicks: {data['summary']['last_7_days']['total_clicks']}")
        print(f"  Conversions: {data['summary']['last_7_days']['total_conversions']}")
        print(f"  Payout: ${data['summary']['last_7_days']['total_payout']}")
    else:
        print(f"❌ Error: {response.text}")

if __name__ == '__main__':
    print("\n🚀 USER REPORTS API TEST SUITE")
    print("="*70)
    print(f"Base URL: {BASE_URL}")
    print(f"Token: {TOKEN[:20]}..." if len(TOKEN) > 20 else "⚠️ NO TOKEN SET!")
    
    if TOKEN == "YOUR_JWT_TOKEN_HERE":
        print("\n❌ ERROR: Please set your JWT token first!")
        print("   1. Log in via /api/auth/login")
        print("   2. Copy the token from response")
        print("   3. Set TOKEN variable in this script")
        print("   4. Run again")
    else:
        try:
            test_summary()
            test_performance_report()
            test_conversion_report()
            test_chart_data()
            
            print("\n" + "="*70)
            print("✅ ALL TESTS COMPLETED")
            print("="*70)
        except Exception as e:
            print(f"\n❌ ERROR: {str(e)}")
