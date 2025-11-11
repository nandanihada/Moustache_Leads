#!/usr/bin/env python3
"""
Test Reports API with actual data
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import requests
import json
from datetime import datetime, timedelta

def test_reports_api():
    """Test if reports API returns data"""
    
    print("\n🧪 TESTING REPORTS API")
    print("="*70)
    
    # Get token
    try:
        with open('jwt_token.txt', 'r') as f:
            token = f.read().strip()
    except:
        print("❌ No token found. Run: python create_test_user.py")
        return
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    # Test 1: Performance Report
    print("\n📊 TEST 1: Performance Report")
    print("="*70)
    
    # Date range: last 30 days
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=30)
    
    params = {
        'start_date': start_date.strftime('%Y-%m-%d'),
        'end_date': end_date.strftime('%Y-%m-%d'),
        'page': 1,
        'per_page': 10
    }
    
    print(f"Request: GET /api/reports/performance")
    print(f"Params: {json.dumps(params, indent=2)}")
    
    try:
        response = requests.get(
            'http://localhost:5000/api/reports/performance',
            headers=headers,
            params=params
        )
        
        print(f"\nStatus Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            print(f"\n✅ Success!")
            print(f"\nSummary:")
            summary = data.get('summary', {})
            print(f"  Total Clicks: {summary.get('total_clicks', 0)}")
            print(f"  Total Conversions: {summary.get('total_conversions', 0)}")
            print(f"  Total Payout: ${summary.get('total_payout', 0):.2f}")
            print(f"  CR: {summary.get('conversion_rate', 0):.2f}%")
            
            rows = data.get('data', [])
            print(f"\nData Rows: {len(rows)}")
            
            if rows:
                print(f"\nFirst row:")
                print(json.dumps(rows[0], indent=2, default=str))
            else:
                print("\n⚠️  No data rows returned (but API works!)")
                print("     This means:")
                print("     - Click exists in database")
                print("     - But query filters might be excluding it")
                print("     - Or date grouping might have issues")
        else:
            print(f"❌ Error: {response.text}")
            
    except Exception as e:
        print(f"❌ Request failed: {e}")
    
    # Test 2: Conversion Report
    print("\n\n📊 TEST 2: Conversion Report")
    print("="*70)
    
    print(f"Request: GET /api/reports/conversions")
    print(f"Params: {json.dumps(params, indent=2)}")
    
    try:
        response = requests.get(
            'http://localhost:5000/api/reports/conversions',
            headers=headers,
            params=params
        )
        
        print(f"\nStatus Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            print(f"\n✅ Success!")
            print(f"\nSummary:")
            summary = data.get('summary', {})
            print(f"  Approved: ${summary.get('approved_payout', 0):.2f} ({summary.get('approved_count', 0)} convs)")
            print(f"  Pending: ${summary.get('pending_payout', 0):.2f} ({summary.get('pending_count', 0)} convs)")
            print(f"  Rejected: ${summary.get('rejected_payout', 0):.2f} ({summary.get('rejected_count', 0)} convs)")
            
            convs = data.get('conversions', [])
            print(f"\nConversions: {len(convs)}")
            
            if convs:
                print(f"\nFirst conversion:")
                print(json.dumps(convs[0], indent=2, default=str))
            else:
                print("\n⚠️  No conversions (expected - haven't simulated any yet)")
        else:
            print(f"❌ Error: {response.text}")
            
    except Exception as e:
        print(f"❌ Request failed: {e}")
    
    # Test 3: Chart Data
    print("\n\n📊 TEST 3: Chart Data")
    print("="*70)
    
    chart_params = {
        **params,
        'chart_type': 'conversions'
    }
    
    try:
        response = requests.get(
            'http://localhost:5000/api/reports/chart-data',
            headers=headers,
            params=chart_params
        )
        
        print(f"\nStatus Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            print(f"\n✅ Success!")
            chart_data = data.get('data', [])
            print(f"Chart Data Points: {len(chart_data)}")
            
            if chart_data:
                print(f"\nFirst data point:")
                print(json.dumps(chart_data[0], indent=2, default=str))
        else:
            print(f"❌ Error: {response.text}")
            
    except Exception as e:
        print(f"❌ Request failed: {e}")
    
    print("\n" + "="*70)
    print("🎯 SUMMARY:")
    print("="*70)
    print("\n✅ If all tests returned 200 OK:")
    print("   - API is working correctly")
    print("   - Check frontend date range")
    print("   - Make sure frontend is logged in")
    print("   - Try refreshing the page")
    
    print("\n💡 Next steps:")
    print("   1. Check frontend console for errors")
    print("   2. Verify token in localStorage")
    print("   3. Check Network tab in browser DevTools")
    print("   4. Try clicking tracking link again")

if __name__ == '__main__':
    test_reports_api()
