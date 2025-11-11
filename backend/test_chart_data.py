#!/usr/bin/env python3
"""
Quick test to verify chart data is working
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import requests
from datetime import datetime, timedelta

# Configuration
API_BASE_URL = "http://localhost:5000/api"

def test_chart_data(token):
    """Test chart data endpoint"""
    
    print("\n📊 TESTING CHART DATA ENDPOINT")
    print("="*70)
    
    # Calculate date range (last 7 days)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=7)
    
    url = f"{API_BASE_URL}/reports/chart-data"
    params = {
        'start_date': start_date.strftime('%Y-%m-%d'),
        'end_date': end_date.strftime('%Y-%m-%d'),
        'metric': 'conversions',
        'granularity': 'day'
    }
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    print(f"📅 Date Range: {params['start_date']} to {params['end_date']}")
    print(f"📈 Metric: {params['metric']}")
    print(f"📊 Granularity: {params['granularity']}")
    print()
    
    try:
        response = requests.get(url, params=params, headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Chart Data Retrieved Successfully!")
            print()
            
            if data.get('success'):
                chart_data = data.get('chart_data', [])
                print(f"📊 Data Points: {len(chart_data)}")
                
                if chart_data:
                    print("\n📈 Chart Data:")
                    for point in chart_data:
                        print(f"  {point['date']}: {point['value']} conversions")
                else:
                    print("⚠️  No chart data found")
                    print("\n💡 Possible reasons:")
                    print("   - No data in the selected date range")
                    print("   - Logged in as wrong user")
                    print("   - Data has different field names (user_id vs affiliate_id)")
            else:
                print("❌ Request failed:", data.get('error', 'Unknown error'))
        else:
            print(f"❌ Error: {response.text}")
    
    except Exception as e:
        print(f"❌ Error: {str(e)}")
    
    print("="*70)

if __name__ == '__main__':
    # Try to read token from file
    token_file = 'jwt_token.txt'
    
    if os.path.exists(token_file):
        with open(token_file, 'r') as f:
            token = f.read().strip()
        print(f"✅ Using token from {token_file}")
    else:
        print("❌ Token file not found")
        print("\n💡 Run this first:")
        print("   python get_token.py")
        sys.exit(1)
    
    test_chart_data(token)
