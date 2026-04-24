"""
Test Data Generator for Publisher Analytics
Run this script to populate your database with realistic test data
"""

from database import db_instance
from datetime import datetime, timedelta
import random
from bson import ObjectId

def generate_test_data():
    """Generate realistic test data for publisher analytics"""
    
    print("🚀 Starting test data generation...")
    
    # Get collections
    users_col = db_instance.get_collection('users')
    clicks_col = db_instance.get_collection('clicks')
    affiliate_requests_col = db_instance.get_collection('affiliate_requests')
    conversions_col = db_instance.get_collection('conversions')
    offers_col = db_instance.get_collection('offers')
    login_logs_col = db_instance.get_collection('login_logs')
    search_logs_col = db_instance.get_collection('search_logs')
    
    # Get all approved publishers
    publishers = list(users_col.find({'account_status': 'approved', 'role': {'$in': ['publisher', 'user']}}))
    
    if not publishers:
        print("❌ No approved publishers found. Please create some publishers first.")
        return
    
    print(f"✅ Found {len(publishers)} publishers")
    
    # Get all active offers
    offers = list(offers_col.find({'status': 'active'}).limit(50))
    
    if not offers:
        print("❌ No active offers found. Please create some offers first.")
        return
    
    print(f"✅ Found {len(offers)} active offers")
    
    # Countries for geo data
    countries = ['US', 'UK', 'CA', 'AU', 'IN', 'DE', 'FR', 'ES', 'IT', 'BR']
    cities = {
        'US': ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'],
        'UK': ['London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow'],
        'CA': ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa'],
        'AU': ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide'],
        'IN': ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai']
    }
    
    # Search keywords
    search_terms = [
        'finance offers', 'gaming', 'sweepstakes', 'mobile apps',
        'credit cards', 'insurance', 'dating', 'health', 'education',
        'shopping', 'travel', 'crypto', 'surveys', 'cashback'
    ]
    
    total_clicks = 0
    total_requests = 0
    total_conversions = 0
    total_logins = 0
    total_searches = 0
    
    # Generate data for each publisher
    for publisher in publishers:
        pub_id = str(publisher['_id'])
        username = publisher.get('username', '')
        email = publisher.get('email', '')
        
        print(f"\n📊 Generating data for {username}...")
        
        # Determine activity level (some publishers are more active)
        activity_level = random.choice(['low', 'medium', 'high', 'very_high'])
        
        if activity_level == 'low':
            num_clicks = random.randint(5, 20)
            num_requests = random.randint(1, 3)
            num_logins = random.randint(1, 3)
            num_searches = random.randint(0, 5)
        elif activity_level == 'medium':
            num_clicks = random.randint(20, 100)
            num_requests = random.randint(3, 10)
            num_logins = random.randint(3, 10)
            num_searches = random.randint(5, 15)
        elif activity_level == 'high':
            num_clicks = random.randint(100, 500)
            num_requests = random.randint(10, 25)
            num_logins = random.randint(10, 20)
            num_searches = random.randint(15, 30)
        else:  # very_high
            num_clicks = random.randint(500, 2000)
            num_requests = random.randint(25, 50)
            num_logins = random.randint(20, 40)
            num_searches = random.randint(30, 60)
        
        # Pick favorite country for this publisher
        favorite_country = random.choice(countries)
        
        # Generate clicks
        clicks_data = []
        clicked_offers = set()
        
        for _ in range(num_clicks):
            offer = random.choice(offers)
            clicked_offers.add(offer['offer_id'])
            
            # 70% chance to use favorite country, 30% random
            country = favorite_country if random.random() < 0.7 else random.choice(countries)
            city = random.choice(cities.get(country, ['Unknown']))
            
            click_time = datetime.utcnow() - timedelta(
                days=random.randint(0, 30),
                hours=random.randint(0, 23),
                minutes=random.randint(0, 59)
            )
            
            # Time spent: 20% no time, 80% between 10s and 600s
            time_spent = 0 if random.random() < 0.2 else random.randint(10, 600)
            
            clicks_data.append({
                'user_id': pub_id,
                'username': username,
                'offer_id': offer['offer_id'],
                'offer_name': offer.get('name', 'Unknown'),
                'country': country,
                'country_code': country,
                'city': city,
                'region': city,
                'device_type': random.choice(['desktop', 'mobile', 'tablet']),
                'browser': random.choice(['Chrome', 'Firefox', 'Safari', 'Edge']),
                'os': random.choice(['Windows', 'macOS', 'Linux', 'Android', 'iOS']),
                'ip_address': f"{random.randint(1,255)}.{random.randint(1,255)}.{random.randint(1,255)}.{random.randint(1,255)}",
                'timestamp': click_time,
                'time_spent_seconds': time_spent,
                'click_id': f"click_{ObjectId()}",
                'referer': random.choice([
                    'https://google.com',
                    'https://facebook.com',
                    'https://twitter.com',
                    'direct',
                    ''
                ])
            })
        
        if clicks_data:
            clicks_col.insert_many(clicks_data)
            total_clicks += len(clicks_data)
            print(f"  ✓ Created {len(clicks_data)} clicks")
        
        # Generate offer requests (only for offers they clicked)
        requests_data = []
        approved_offers = []
        rejected_offers = []
        
        # Request a subset of clicked offers
        offers_to_request = random.sample(list(clicked_offers), min(num_requests, len(clicked_offers)))
        
        for offer_id in offers_to_request:
            offer = next((o for o in offers if o['offer_id'] == offer_id), None)
            if not offer:
                continue
            
            # 70% approval rate, 30% rejection rate
            status = 'approved' if random.random() < 0.7 else 'rejected'
            
            request_time = datetime.utcnow() - timedelta(
                days=random.randint(0, 25),
                hours=random.randint(0, 23)
            )
            
            request_data = {
                'publisher_id': pub_id,
                'user_id': pub_id,
                'username': username,
                'email': email,
                'offer_id': offer_id,
                'offer_name': offer.get('name', 'Unknown'),
                'status': status,
                'created_at': request_time,
                'updated_at': request_time
            }
            
            if status == 'rejected':
                request_data['rejection_reason'] = random.choice([
                    'Suspicious traffic pattern',
                    'Low quality traffic',
                    'Geo mismatch',
                    'Duplicate request',
                    'Incomplete profile'
                ])
                rejected_offers.append(offer_id)
            else:
                approved_offers.append(offer_id)
            
            requests_data.append(request_data)
        
        if requests_data:
            affiliate_requests_col.insert_many(requests_data)
            total_requests += len(requests_data)
            print(f"  ✓ Created {len(requests_data)} offer requests ({len(approved_offers)} approved, {len(rejected_offers)} rejected)")
        
        # Generate conversions (only for approved offers)
        if approved_offers:
            num_conversions = random.randint(0, len(approved_offers) // 2)  # 50% conversion rate max
            
            conversions_data = []
            for _ in range(num_conversions):
                offer_id = random.choice(approved_offers)
                offer = next((o for o in offers if o['offer_id'] == offer_id), None)
                if not offer:
                    continue
                
                conversion_time = datetime.utcnow() - timedelta(
                    days=random.randint(0, 20),
                    hours=random.randint(0, 23)
                )
                
                payout = offer.get('payout', 0)
                if isinstance(payout, str):
                    payout = float(payout.replace('$', '').replace(',', '').strip() or 0)
                
                conversions_data.append({
                    'publisher_id': pub_id,
                    'user_id': pub_id,
                    'username': username,
                    'offer_id': offer_id,
                    'offer_name': offer.get('name', 'Unknown'),
                    'status': 'approved',
                    'points': payout,
                    'revenue': payout * 1.2,  # 20% markup
                    'currency': 'USD',
                    'timestamp': conversion_time,
                    'time': conversion_time,
                    'country': favorite_country,
                    'click_id': f"click_{ObjectId()}",
                    'transaction_id': f"txn_{ObjectId()}"
                })
            
            if conversions_data:
                conversions_col.insert_many(conversions_data)
                total_conversions += len(conversions_data)
                print(f"  ✓ Created {len(conversions_data)} conversions")
        
        # Generate login logs
        login_data = []
        for _ in range(num_logins):
            login_time = datetime.utcnow() - timedelta(
                days=random.randint(0, 7),
                hours=random.randint(0, 23)
            )
            
            login_data.append({
                'user_id': pub_id,
                'username': username,
                'email': email,
                'status': 'success',
                'login_time': login_time,
                'ip_address': f"{random.randint(1,255)}.{random.randint(1,255)}.{random.randint(1,255)}.{random.randint(1,255)}",
                'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })
        
        if login_data:
            login_logs_col.insert_many(login_data)
            total_logins += len(login_data)
            print(f"  ✓ Created {len(login_data)} login logs")
        
        # Generate search logs
        search_data = []
        for _ in range(num_searches):
            search_time = datetime.utcnow() - timedelta(
                days=random.randint(0, 30),
                hours=random.randint(0, 23)
            )
            
            search_data.append({
                'user_id': pub_id,
                'username': username,
                'email': email,
                'search_term': random.choice(search_terms),
                'timestamp': search_time,
                'results_count': random.randint(5, 50)
            })
        
        if search_data:
            search_logs_col.insert_many(search_data)
            total_searches += len(search_data)
            print(f"  ✓ Created {len(search_data)} search logs")
    
    print("\n" + "="*60)
    print("✅ TEST DATA GENERATION COMPLETE!")
    print("="*60)
    print(f"📊 Summary:")
    print(f"  • Publishers processed: {len(publishers)}")
    print(f"  • Total clicks created: {total_clicks}")
    print(f"  • Total offer requests: {total_requests}")
    print(f"  • Total conversions: {total_conversions}")
    print(f"  • Total login logs: {total_logins}")
    print(f"  • Total search logs: {total_searches}")
    print("\n🎯 Your Publisher Analytics should now show real data!")
    print("   Refresh the page to see the updated statistics.\n")

if __name__ == '__main__':
    try:
        generate_test_data()
    except Exception as e:
        print(f"\n❌ Error generating test data: {e}")
        import traceback
        traceback.print_exc()
