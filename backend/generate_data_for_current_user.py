#!/usr/bin/env python3
"""
Generate test data for the currently logged-in user (from token)
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import jwt
from database import db_instance
from datetime import datetime, timedelta
import random
import uuid

def get_current_user_id():
    """Get user ID from token file"""
    try:
        with open('jwt_token.txt', 'r') as f:
            token = f.read().strip()
        decoded = jwt.decode(token, options={"verify_signature": False})
        return decoded.get('user_id')
    except Exception as e:
        print(f"❌ Error reading token: {e}")
        return None

def generate_test_data(user_id):
    """Generate test data for user"""
    
    print(f"\n🎲 GENERATING TEST DATA FOR USER: {user_id}")
    print("="*70)
    
    clicks_collection = db_instance.get_collection('clicks')
    conversions_collection = db_instance.get_collection('conversions')
    offers_collection = db_instance.get_collection('offers')
    
    if clicks_collection is None or conversions_collection is None:
        print("❌ Database connection failed")
        return
    
    # Get or create test offer
    test_offer = offers_collection.find_one({'name': {'$regex': 'Test', '$options': 'i'}})
    if not test_offer:
        test_offer = offers_collection.find_one()
    
    if not test_offer:
        print("❌ No offers found in database")
        return
    
    print(f"📦 Using offer: {test_offer.get('name', 'Test Offer')}")
    
    # Generate data for last 7 days
    total_clicks = 0
    total_conversions = 0
    
    countries = ['US', 'UK', 'CA', 'AU', 'DE']
    devices = ['desktop', 'mobile', 'tablet']
    browsers = ['Chrome', 'Firefox', 'Safari', 'Edge']
    statuses = ['approved', 'pending', 'rejected']
    
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=7)
    
    print(f"\n📅 Generating data from {start_date.date()} to {end_date.date()}")
    
    for day in range(7):
        current_date = start_date + timedelta(days=day)
        clicks_per_day = random.randint(80, 120)
        
        for _ in range(clicks_per_day):
            # Random time during the day
            hour = random.randint(0, 23)
            minute = random.randint(0, 59)
            click_time = current_date.replace(hour=hour, minute=minute, second=0)
            
            country = random.choice(countries)
            device = random.choice(devices)
            browser = random.choice(browsers)
            click_id = f"CLK-{uuid.uuid4().hex[:16].upper()}"
            
            # Create click
            click = {
                'click_id': click_id,
                'user_id': user_id,
                'affiliate_id': user_id,  # Add both fields
                'offer_id': test_offer['offer_id'],
                'country': country,
                'device_type': device,
                'browser': browser,
                'ip_address': f"192.168.{random.randint(1,255)}.{random.randint(1,255)}",
                'click_time': click_time,
                'is_unique': random.random() > 0.3,
                'is_suspicious': random.random() < 0.05,
                'is_rejected': random.random() < 0.02,
                'is_fraud': random.random() < 0.05,
                'sub_id1': f"sub{random.randint(1,100)}",
                'sub_id2': f"camp{random.randint(1,10)}",
                'created_at': click_time
            }
            
            clicks_collection.insert_one(click)
            total_clicks += 1
            
            # 15% conversion rate
            if random.random() < 0.15:
                conversion_time = click_time + timedelta(minutes=random.randint(1, 120))
                status = random.choice(statuses)
                payout = test_offer.get('payout', 2.50)
                
                conversion = {
                    'conversion_id': f"CONV-{uuid.uuid4().hex[:16].upper()}",
                    'click_id': click_id,
                    'user_id': user_id,
                    'affiliate_id': user_id,  # Add both fields
                    'offer_id': test_offer['offer_id'],
                    'transaction_id': f"TXN-{uuid.uuid4().hex[:12].upper()}",
                    'status': status,
                    'payout': payout if status == 'approved' else 0,
                    'currency': 'USD',
                    'country': country,
                    'device_type': device,
                    'conversion_time': conversion_time,
                    'ip_address': click['ip_address'],
                    'sub_id1': click['sub_id1'],
                    'sub_id2': click['sub_id2'],
                    'created_at': conversion_time
                }
                
                conversions_collection.insert_one(conversion)
                total_conversions += 1
        
        print(f"  Day {day + 1}: {clicks_per_day} clicks generated")
    
    print("\n" + "="*70)
    print(f"✅ GENERATION COMPLETE!")
    print(f"📊 Total Clicks: {total_clicks}")
    print(f"💰 Total Conversions: {total_conversions}")
    print(f"📈 Conversion Rate: {(total_conversions/total_clicks*100):.2f}%")
    
    approved_conversions = conversions_collection.count_documents({
        'user_id': user_id,
        'status': 'approved'
    })
    total_revenue = approved_conversions * test_offer.get('payout', 2.50)
    print(f"💵 Estimated Revenue: ${total_revenue:.2f}")
    
    print("\n🎉 Ready to test reports!")
    print("\n📍 Next Steps:")
    print("   1. Run: python test_chart_data.py")
    print("   2. Open: http://localhost:8080/dashboard/performance-report")
    print("   3. View your data!")

if __name__ == '__main__':
    user_id = get_current_user_id()
    if user_id:
        generate_test_data(user_id)
    else:
        print("❌ Could not get user ID from token")
        print("💡 Run: python get_token.py first")
