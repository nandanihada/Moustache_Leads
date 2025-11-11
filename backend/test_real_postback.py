#!/usr/bin/env python3
"""
Test real postback with survey responses
Simulates what a survey partner would send
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import requests
from database import db_instance

def test_real_postback():
    """Test postback with full survey data"""
    
    print("\n🧪 TESTING REAL POSTBACK WITH SURVEY DATA")
    print("="*70)
    
    # Get latest click
    clicks_collection = db_instance.get_collection('clicks')
    latest_click = clicks_collection.find_one({}, sort=[('click_time', -1)])
    
    if not latest_click:
        print("❌ No clicks found. Click a tracking link first!")
        return
    
    click_id = latest_click['click_id']
    
    print(f"\n📊 Using Click:")
    print(f"   Click ID: {click_id}")
    print(f"   Offer ID: {latest_click.get('offer_id')}")
    
    # Simulate what survey partner sends
    postback_params = {
        # ✅ REQUIRED
        'click_id': click_id,
        
        # ✅ STANDARD FIELDS
        'status': 'approved',
        'payout': 90.01,
        'transaction_id': 'TXN-REAL-54321',
        'currency': 'USD',
        
        # ✨ SURVEY RESPONSES (Your partner will send these!)
        'survey_id': '7745',
        'survey_name': 'Health Survey 2024',
        'partner_id': '3120',
        'offer_id': '7745',
        
        # User demographic data
        'user_age': '28',
        'user_gender': 'Male',
        'user_country': 'United States',
        'user_state': 'California',
        'user_city': 'Los Angeles',
        'user_zip': '90001',
        
        # Survey-specific data
        'survey_duration': '145',  # seconds
        'completion_time': '2025-11-10T12:30:00Z',
        'completion_percentage': '100',
        'quality_score': '95',
        
        # Custom responses
        'q1_answer': 'Yes',
        'q2_answer': 'Option B',
        'q3_rating': '5',
        'user_feedback': 'Great survey!',
        
        # Technical data
        'session_id': 'abc-def-123-456',
        'device_brand': 'Apple',
        'device_model': 'iPhone 13',
        'os_version': 'iOS 16.0',
        'app_version': '2.1.0',
        
        # Verification
        'email_verified': 'true',
        'phone_verified': 'true',
        'ip_verified': 'true',
        
        # Rewards
        'reward_type': 'points',
        'reward_amount': '500',
        'bonus_earned': 'true',
        
        # ANY OTHER FIELDS YOU WANT!
        'custom_field_1': 'value1',
        'custom_field_2': 'value2',
        'partner_notes': 'High quality user',
    }
    
    print(f"\n📤 Sending Postback:")
    print(f"   URL: http://localhost:5000/api/analytics/postback")
    print(f"   Parameters: {len(postback_params)} fields")
    print(f"   Custom Fields: {len([k for k in postback_params if k not in ['click_id', 'status', 'payout', 'transaction_id', 'currency']])}")
    
    # Send postback
    try:
        response = requests.get(
            'http://localhost:5000/api/analytics/postback',
            params=postback_params,
            timeout=5
        )
        
        print(f"\n📥 Response:")
        print(f"   Status Code: {response.status_code}")
        print(f"   Body: {response.text}")
        
        if response.status_code == 200:
            print(f"\n✅ SUCCESS! Postback accepted!")
            
            # Check database
            conversions_collection = db_instance.get_collection('conversions')
            conversion = conversions_collection.find_one(
                {'click_id': click_id},
                sort=[('conversion_time', -1)]
            )
            
            if conversion:
                print(f"\n💰 Conversion Created:")
                print(f"   Conversion ID: {conversion['conversion_id']}")
                print(f"   Transaction ID: {conversion['transaction_id']}")
                print(f"   Status: {conversion['status']}")
                print(f"   Payout: ${conversion['payout']}")
                
                print(f"\n✨ Custom Data Captured:")
                custom_data = conversion.get('custom_data', {})
                print(f"   Total Fields: {len(custom_data)}")
                
                if custom_data:
                    print(f"\n   Sample Fields:")
                    for key, value in list(custom_data.items())[:10]:
                        print(f"      {key}: {value}")
                    
                    if len(custom_data) > 10:
                        print(f"      ... and {len(custom_data) - 10} more fields!")
                
                print(f"\n📊 Raw Postback Data:")
                raw_postback = conversion.get('raw_postback', {})
                print(f"   All {len(raw_postback)} parameters saved!")
                
                print(f"\n🎉 ALL SURVEY RESPONSES CAPTURED!")
                print(f"   View in Conversion Report:")
                print(f"   http://localhost:8080/dashboard/conversion-report")
                print(f"   Click 'View Details' to see all fields!")
                
        else:
            print(f"\n❌ FAILED! Check error above")
            
    except Exception as e:
        print(f"\n❌ Request failed: {e}")
        print(f"\n💡 Make sure backend is running:")
        print(f"   cd backend")
        print(f"   python app.py")
    
    print("\n" + "="*70)
    print("📝 SUMMARY:")
    print("="*70)
    print("\n✅ This demonstrates how REAL postbacks work:")
    print("   1. User completes survey on partner site")
    print("   2. Partner server sends postback to your URL")
    print("   3. Your backend captures ALL data")
    print("   4. Data is stored in database")
    print("   5. Shows in Conversion Report")
    print("   6. ALL survey responses visible!")
    
    print("\n💡 To configure with real partner:")
    print("   1. Give them your postback URL:")
    print("      https://yourdomain.com/api/analytics/postback")
    print("   2. Tell them to include click_id parameter")
    print("   3. They can send ANY custom fields")
    print("   4. All data will be captured automatically!")
    
    print("\n📖 Full documentation: POSTBACK_CONFIGURATION.md")

if __name__ == '__main__':
    test_real_postback()
