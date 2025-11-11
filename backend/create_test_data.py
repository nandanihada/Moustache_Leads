#!/usr/bin/env python3
"""
Generate Test Data for User Reports
Creates sample clicks and conversions in MongoDB
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import db_instance
from datetime import datetime, timedelta
import random
import uuid

def generate_test_data(user_id, days=7, clicks_per_day=50):
    """
    Generate test clicks and conversions for a user
    
    Args:
        user_id: The user ID to create data for
        days: Number of days of historical data
        clicks_per_day: Average clicks per day
    """
    
    print(f"\n🚀 GENERATING TEST DATA")
    print("="*70)
    print(f"User ID: {user_id}")
    print(f"Days: {days}")
    print(f"Clicks per day: ~{clicks_per_day}")
    print("="*70)
    
    # Get collections
    clicks_collection = db_instance.get_collection('clicks')
    conversions_collection = db_instance.get_collection('conversions')
    offers_collection = db_instance.get_collection('offers')
    
    if clicks_collection is None or offers_collection is None:
        print("❌ Failed to connect to database")
        return
    
    # Get existing offers
    offers = list(offers_collection.find({'status': 'active'}).limit(5))
    
    if not offers:
        print("⚠️  No active offers found. Creating sample offer...")
        # Create a sample offer
        sample_offer = {
            'offer_id': f'OFFER-{uuid.uuid4().hex[:8].upper()}',
            'name': 'Test Offer - Survey Rewards',
            'status': 'active',
            'payout': 2.50,
            'currency': 'USD',
            'target_url': 'https://example.com/offer',
            'countries': ['US', 'UK', 'CA', 'AU'],
            'created_at': datetime.utcnow(),
            'created_by': user_id
        }
        offers_collection.insert_one(sample_offer)
        offers = [sample_offer]
        print(f"✅ Created offer: {sample_offer['name']}")
    
    print(f"\n📦 Using {len(offers)} offers for test data")
    for offer in offers:
        print(f"   - {offer.get('name', offer['offer_id'])}")
    
    # Generate data
    countries = ['US', 'UK', 'CA', 'AU', 'DE', 'FR', 'IN']
    devices = ['mobile', 'desktop', 'tablet']
    browsers = ['Chrome', 'Firefox', 'Safari', 'Edge']
    statuses = ['approved', 'approved', 'approved', 'pending', 'rejected']  # More approved
    
    total_clicks = 0
    total_conversions = 0
    
    end_date = datetime.utcnow()
    
    for day in range(days):
        date = end_date - timedelta(days=day)
        day_clicks = random.randint(int(clicks_per_day * 0.7), int(clicks_per_day * 1.3))
        
        print(f"\n📅 {date.strftime('%Y-%m-%d')}: Generating {day_clicks} clicks...")
        
        for _ in range(day_clicks):
            offer = random.choice(offers)
            country = random.choice(countries)
            device = random.choice(devices)
            browser = random.choice(browsers)
            
            # Random time during the day
            hour = random.randint(0, 23)
            minute = random.randint(0, 59)
            click_time = date.replace(hour=hour, minute=minute, second=0, microsecond=0)
            
            click_id = f"CLK-{uuid.uuid4().hex[:16].upper()}"
            
            # Create click
            click = {
                'click_id': click_id,
                'user_id': user_id,
                'offer_id': offer['offer_id'],
                'country': country,
                'device_type': device,
                'browser': browser,
                'ip_address': f"192.168.{random.randint(1,255)}.{random.randint(1,255)}",
                'click_time': click_time,
                'is_unique': random.random() > 0.3,  # 70% unique
                'is_suspicious': random.random() < 0.05,  # 5% suspicious
                'is_rejected': random.random() < 0.02,  # 2% rejected
                'sub_id1': f"sub{random.randint(1,100)}",
                'sub_id2': f"camp{random.randint(1,10)}",
                'created_at': click_time
            }
            
            clicks_collection.insert_one(click)
            total_clicks += 1
            
            # 10-20% conversion rate
            if random.random() < random.uniform(0.10, 0.20):
                conversion_time = click_time + timedelta(minutes=random.randint(1, 120))
                status = random.choice(statuses)
                payout = offer.get('payout', 2.50)
                
                conversion = {
                    'conversion_id': f"CNV-{uuid.uuid4().hex[:16].upper()}",
                    'click_id': click_id,
                    'transaction_id': f"TXN-{uuid.uuid4().hex[:12].upper()}",
                    'user_id': user_id,
                    'offer_id': offer['offer_id'],
                    'status': status,
                    'payout': payout if status == 'approved' else 0,
                    'currency': 'USD',
                    'country': country,
                    'ip_address': click['ip_address'],
                    'device_type': device,
                    'browser': browser,
                    'conversion_time': conversion_time,
                    'click_time': click_time,
                    'sub_id1': click['sub_id1'],
                    'sub_id2': click['sub_id2'],
                    'created_at': conversion_time
                }
                
                conversions_collection.insert_one(conversion)
                total_conversions += 1
    
    print("\n" + "="*70)
    print("✅ TEST DATA GENERATED SUCCESSFULLY!")
    print("="*70)
    print(f"📊 Total Clicks: {total_clicks}")
    print(f"💰 Total Conversions: {total_conversions}")
    print(f"📈 Conversion Rate: {(total_conversions/total_clicks*100):.2f}%")
    print(f"💵 Estimated Revenue: ${total_conversions * 2.50:.2f}")
    print("\n🎉 Ready to test reports!")
    print("\n📍 Next Steps:")
    print("   1. Go to: http://localhost:8080/dashboard/performance-report")
    print("   2. Select date range")
    print("   3. View your data!")
    print("="*70)

if __name__ == '__main__':
    print("\n🔍 FIND YOUR USER ID")
    print("="*70)
    
    # Get users collection
    users_collection = db_instance.get_collection('users')
    
    if users_collection is None:
        print("❌ Could not connect to database")
        sys.exit(1)
    
    # Show available users
    users = list(users_collection.find({}, {'_id': 1, 'username': 1, 'email': 1, 'role': 1}))
    
    if not users:
        print("❌ No users found in database")
        print("\n💡 Create a user first:")
        print("   python create_test_user.py")
        sys.exit(1)
    
    print("\n📋 Available Users:")
    print("="*70)
    for idx, user in enumerate(users, 1):
        role = user.get('role', 'user')  # Default to 'user' if no role
        print(f"{idx}. Username: {user['username']:<20} Role: {role:<10} ID: {str(user['_id'])}")
    
    print("\n" + "="*70)
    
    # Get user selection
    try:
        selection = input("\n👤 Enter user number (or press Enter for first user): ").strip()
        
        if selection == '':
            selected_user = users[0]
        else:
            idx = int(selection) - 1
            if idx < 0 or idx >= len(users):
                print("❌ Invalid selection")
                sys.exit(1)
            selected_user = users[idx]
        
        print(f"\n✅ Selected: {selected_user['username']}")
        
        # Ask for customization
        days = input("\n📅 How many days of data? (default: 7): ").strip()
        days = int(days) if days else 7
        
        clicks = input(f"📊 Clicks per day? (default: 50): ").strip()
        clicks = int(clicks) if clicks else 50
        
        # Generate data
        generate_test_data(str(selected_user['_id']), days=days, clicks_per_day=clicks)
        
    except KeyboardInterrupt:
        print("\n\n👋 Cancelled")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        sys.exit(1)
