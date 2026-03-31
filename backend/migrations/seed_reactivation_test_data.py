"""
Seed script for Reactivation test data.
Creates fake inactive users with login logs, search logs, clicks, and conversions
so you can test the Reactivation page end-to-end.

Run from backend/:
    python migrations/seed_reactivation_test_data.py

To clean up:
    python migrations/seed_reactivation_test_data.py --cleanup
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance
from datetime import datetime, timedelta
from bson import ObjectId
import bcrypt
import random

SEED_TAG = '__reactivation_seed_v2__'

FAKE_USERS = [
    {'username': 'tanvir_r', 'email': 'tanvir@example.com', 'first_name': 'Tanvir', 'last_name': 'R',
     'country': 'Bangladesh', 'country_code': 'BD', 'city': 'Chittagong', 'lat': 22.35, 'lng': 91.78,
     'days_inactive': 200, 'clicks': 18, 'conversions': 9, 'earnings': 287, 'searches': ['gaming offers bd', 'sweepstakes', 'high payout'],
     'email_verified': True, 'has_placement': True},
    {'username': 'priya_m', 'email': 'priya@example.com', 'first_name': 'Priya', 'last_name': 'M',
     'country': 'India', 'country_code': 'IN', 'city': 'Mumbai', 'lat': 19.07, 'lng': 72.87,
     'days_inactive': 45, 'clicks': 32, 'conversions': 15, 'earnings': 520, 'searches': ['survey apps', 'gaming cpa', 'install offers'],
     'email_verified': True, 'has_placement': True},
    {'username': 'rahul_k', 'email': 'rahul@example.com', 'first_name': 'Rahul', 'last_name': 'K',
     'country': 'India', 'country_code': 'IN', 'city': 'Bangalore', 'lat': 12.97, 'lng': 77.59,
     'days_inactive': 120, 'clicks': 5, 'conversions': 0, 'earnings': 0, 'searches': ['crypto offers', 'high payout'],
     'email_verified': True, 'has_placement': False},
    {'username': 'ahmed_s', 'email': 'ahmed@example.com', 'first_name': 'Ahmed', 'last_name': 'S',
     'country': 'Egypt', 'country_code': 'EG', 'city': 'Cairo', 'lat': 30.04, 'lng': 31.23,
     'days_inactive': 15, 'clicks': 8, 'conversions': 3, 'earnings': 45, 'searches': ['sweepstakes', 'gaming'],
     'email_verified': False, 'has_placement': True},
    {'username': 'maria_g', 'email': 'maria@example.com', 'first_name': 'Maria', 'last_name': 'G',
     'country': 'Brazil', 'country_code': 'BR', 'city': 'Sao Paulo', 'lat': -23.55, 'lng': -46.63,
     'days_inactive': 300, 'clicks': 0, 'conversions': 0, 'earnings': 0, 'searches': [],
     'email_verified': False, 'has_placement': False},
]


MORE_USERS = [
    {'username': 'john_d', 'email': 'john@example.com', 'first_name': 'John', 'last_name': 'D',
     'country': 'United States', 'country_code': 'US', 'city': 'New York', 'lat': 40.71, 'lng': -74.00,
     'days_inactive': 60, 'clicks': 25, 'conversions': 8, 'earnings': 190, 'searches': ['finance offers', 'credit card', 'insurance'],
     'email_verified': True, 'has_placement': True},
    {'username': 'fatima_z', 'email': 'fatima@example.com', 'first_name': 'Fatima', 'last_name': 'Z',
     'country': 'Pakistan', 'country_code': 'PK', 'city': 'Karachi', 'lat': 24.86, 'lng': 67.01,
     'days_inactive': 90, 'clicks': 12, 'conversions': 4, 'earnings': 78, 'searches': ['survey', 'app install', 'earn money'],
     'email_verified': True, 'has_placement': False},
    {'username': 'alex_w', 'email': 'alex@example.com', 'first_name': 'Alex', 'last_name': 'W',
     'country': 'United Kingdom', 'country_code': 'GB', 'city': 'London', 'lat': 51.50, 'lng': -0.12,
     'days_inactive': 10, 'clicks': 40, 'conversions': 20, 'earnings': 850, 'searches': ['gaming cpa', 'sweepstakes uk', 'high payout offers'],
     'email_verified': True, 'has_placement': True},
    {'username': 'chen_l', 'email': 'chen@example.com', 'first_name': 'Chen', 'last_name': 'L',
     'country': 'Philippines', 'country_code': 'PH', 'city': 'Manila', 'lat': 14.59, 'lng': 120.98,
     'days_inactive': 180, 'clicks': 3, 'conversions': 1, 'earnings': 12, 'searches': ['download apps'],
     'email_verified': False, 'has_placement': False},
    {'username': 'omar_b', 'email': 'omar@example.com', 'first_name': 'Omar', 'last_name': 'B',
     'country': 'Morocco', 'country_code': 'MA', 'city': 'Casablanca', 'lat': 33.57, 'lng': -7.58,
     'days_inactive': 250, 'clicks': 7, 'conversions': 2, 'earnings': 35, 'searches': ['crypto', 'trading', 'bitcoin'],
     'email_verified': True, 'has_placement': True},
    {'username': 'sofia_r', 'email': 'sofia@example.com', 'first_name': 'Sofia', 'last_name': 'R',
     'country': 'Turkey', 'country_code': 'TR', 'city': 'Istanbul', 'lat': 41.00, 'lng': 28.97,
     'days_inactive': 35, 'clicks': 15, 'conversions': 6, 'earnings': 110, 'searches': ['survey offers', 'signup bonus'],
     'email_verified': True, 'has_placement': True},
    {'username': 'diego_m', 'email': 'diego@example.com', 'first_name': 'Diego', 'last_name': 'M',
     'country': 'Mexico', 'country_code': 'MX', 'city': 'Mexico City', 'lat': 19.43, 'lng': -99.13,
     'days_inactive': 400, 'clicks': 0, 'conversions': 0, 'earnings': 0, 'searches': [],
     'email_verified': False, 'has_placement': False},
]

ALL_USERS = FAKE_USERS + MORE_USERS

OFFER_NAMES = ['Gaming CPA Pro', 'Sweepstakes Gold', 'Survey Master', 'Crypto Trading App',
               'Finance Plus', 'App Install Bonus', 'Casino Royale', 'High Payout VIP',
               'Sign Up Rewards', 'Mobile Games Bundle']
OFFER_CATEGORIES = ['Gaming', 'Sweepstakes', 'Survey', 'Crypto', 'Finance', 'App Install',
                    'Casino', 'High Payout', 'Sign Up', 'Gaming']


def seed():
    now = datetime.utcnow()
    users_col = db_instance.get_collection('users')
    login_col = db_instance.get_collection('login_logs')
    search_col = db_instance.get_collection('search_logs')
    clicks_col = db_instance.get_collection('offerwall_clicks_detailed')
    conv_col = db_instance.get_collection('offerwall_conversions_detailed')
    placements_col = db_instance.get_collection('placements')

    created_ids = []
    hashed_pw = bcrypt.hashpw(b'test123', bcrypt.gensalt())

    for u in ALL_USERS:
        # Check if already exists
        existing = users_col.find_one({'email': u['email']})
        if existing:
            print(f"  ⏭ User {u['username']} already exists, skipping")
            created_ids.append(str(existing['_id']))
            continue

        user_doc = {
            'username': u['username'],
            'email': u['email'],
            'password': hashed_pw,
            'first_name': u['first_name'],
            'last_name': u['last_name'],
            'role': 'user',
            'is_active': True,
            'email_verified': u['email_verified'],
            'email_verified_at': now - timedelta(days=u['days_inactive'] + 30) if u['email_verified'] else None,
            'account_status': 'approved',
            'account_status_updated_at': now - timedelta(days=u['days_inactive'] + 20),
            'created_at': now - timedelta(days=u['days_inactive'] + 60),
            'updated_at': now - timedelta(days=u['days_inactive']),
            '_seed': SEED_TAG,
        }
        result = users_col.insert_one(user_doc)
        uid = str(result.inserted_id)
        created_ids.append(uid)
        print(f"  ✅ Created user: {u['username']} ({uid})")

        # Login logs (last login = days_inactive ago)
        last_login = now - timedelta(days=u['days_inactive'])
        for i in range(random.randint(3, 10)):
            login_time = last_login - timedelta(days=random.randint(0, 30), hours=random.randint(0, 23))
            login_col.insert_one({
                'user_id': uid,
                'username': u['username'],
                'login_time': login_time,
                'status': 'success',
                'ip_address': f'{random.randint(1,255)}.{random.randint(1,255)}.{random.randint(1,255)}.{random.randint(1,255)}',
                'device_info': {
                    'device_type': random.choice(['Mobile', 'Desktop']),
                    'browser': random.choice(['Chrome', 'Firefox', 'Safari']),
                    'os': random.choice(['Android', 'iOS', 'Windows', 'macOS']),
                    'device_fingerprint': f'fp_{uid}_{i}',
                },
                'geo_data': {
                    'country': u['country'],
                    'country_code': u['country_code'],
                    'city': u['city'],
                    'latitude': u['lat'],
                    'longitude': u['lng'],
                },
                '_seed': SEED_TAG,
            })

        # Search logs
        for kw in u.get('searches', []):
            search_col.insert_one({
                'user_id': uid,
                'username': u['username'],
                'keyword': kw,
                'results_count': random.randint(1, 20),
                'timestamp': last_login - timedelta(days=random.randint(0, 15)),
                '_seed': SEED_TAG,
            })

        # Clicks
        for _ in range(u.get('clicks', 0)):
            offer_idx = random.randint(0, len(OFFER_NAMES) - 1)
            clicks_col.insert_one({
                'user_id': uid,
                'offer_id': f'offer_{offer_idx}',
                'offer_name': OFFER_NAMES[offer_idx],
                'offer_category': OFFER_CATEGORIES[offer_idx],
                'timestamp': last_login - timedelta(days=random.randint(0, 30), hours=random.randint(0, 23)),
                '_seed': SEED_TAG,
            })

        # Conversions
        for _ in range(u.get('conversions', 0)):
            offer_idx = random.randint(0, len(OFFER_NAMES) - 1)
            payout = round(random.uniform(5, 50), 2)
            conv_col.insert_one({
                'user_id': uid,
                'offer_id': f'offer_{offer_idx}',
                'offer_name': OFFER_NAMES[offer_idx],
                'payout': payout,
                'timestamp': last_login - timedelta(days=random.randint(0, 30)),
                '_seed': SEED_TAG,
            })

        # Placement
        if u.get('has_placement'):
            placements_col.insert_one({
                'publisher_id': uid,
                'name': f'{u["username"]}_placement',
                'status': 'approved',
                'created_at': now - timedelta(days=u['days_inactive'] + 10),
                '_seed': SEED_TAG,
            })

    print(f"\n🎉 Seeded {len(created_ids)} users with behavior data!")
    print("   You can now test the Reactivation page at /admin/reactivation")


def cleanup():
    """Remove all seeded test data"""
    users_col = db_instance.get_collection('users')
    login_col = db_instance.get_collection('login_logs')
    search_col = db_instance.get_collection('search_logs')
    clicks_col = db_instance.get_collection('offerwall_clicks_detailed')
    conv_col = db_instance.get_collection('offerwall_conversions_detailed')
    placements_col = db_instance.get_collection('placements')
    outreach_col = db_instance.get_collection('reactivation_outreach')

    for col, name in [(users_col, 'users'), (login_col, 'login_logs'), (search_col, 'search_logs'),
                      (clicks_col, 'clicks'), (conv_col, 'conversions'), (placements_col, 'placements'),
                      (outreach_col, 'outreach')]:
        if col is not None:
            r = col.delete_many({'_seed': SEED_TAG})
            print(f"  🗑 Deleted {r.deleted_count} seeded {name}")

    print("\n✅ Cleanup complete!")


if __name__ == '__main__':
    if '--cleanup' in sys.argv:
        print("🧹 Cleaning up seed data...")
        cleanup()
    else:
        print("🌱 Seeding reactivation test data...")
        seed()
