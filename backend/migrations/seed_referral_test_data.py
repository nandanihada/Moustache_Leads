"""
Seed referral test data for UI testing.
Creates multiple referral records with different statuses.
Run: python migrations/seed_referral_test_data.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance
from datetime import datetime, timedelta
from bson import ObjectId

def seed():
    users = db_instance.get_collection('users')
    referrals_p1 = db_instance.get_collection('referrals_p1')
    referrals_p2 = db_instance.get_collection('referrals_p2')
    referral_fraud_log = db_instance.get_collection('referral_fraud_log')
    referral_links = db_instance.get_collection('referral_links')

    # Find admin user (the referrer)
    admin = users.find_one({'username': 'admin'})
    if not admin:
        print("❌ Admin user not found")
        return
    admin_id = str(admin['_id'])
    print(f"✅ Found admin: {admin_id}")

    # Ensure admin has a referral link
    existing_link = referral_links.find_one({'user_id': admin_id})
    if not existing_link:
        referral_links.insert_one({
            'user_id': admin_id,
            'referral_code': 'K65U6A29',
            'created_at': datetime.utcnow(),
            'is_active': True
        })

    # Test referred users data
    test_users = [
        {
            'username': 'alice_media', 'email': 'alice@mediabuyers.com',
            'ip': '103.21.58.44', 'status_p1': 'approved', 'fraud_score': 8,
            'bonus_percent': 2.0, 'bonus_amount': 2.24, 'bonus_released': True,
            'p2_revenue': 620.0, 'p2_commission': 24.80, 'p2_status': 'active', 'p2_qualified': True,
            'checks': [
                {'check_name': 'ipqs_ip_check', 'result': 'pass', 'details': {'fraud_score': 8}},
                {'check_name': 'duplicate_ip', 'result': 'pass', 'details': {'duplicate_found': False}},
                {'check_name': 'duplicate_email', 'result': 'pass', 'details': {'duplicate_found': False}},
                {'check_name': 'duplicate_fingerprint', 'result': 'pass', 'details': {'duplicate_found': False}},
            ]
        },
        {
            'username': 'bob_affiliate', 'email': 'bob@affiliates.net',
            'ip': '49.36.112.70', 'status_p1': 'approved', 'fraud_score': 12,
            'bonus_percent': 2.0, 'bonus_amount': 2.24, 'bonus_released': True,
            'p2_revenue': 340.0, 'p2_commission': 0, 'p2_status': 'tracking', 'p2_qualified': False,
            'checks': [
                {'check_name': 'ipqs_ip_check', 'result': 'pass', 'details': {'fraud_score': 12}},
                {'check_name': 'duplicate_ip', 'result': 'pass', 'details': {'duplicate_found': False}},
                {'check_name': 'duplicate_email', 'result': 'pass', 'details': {'duplicate_found': False}},
                {'check_name': 'duplicate_fingerprint', 'result': 'pass', 'details': {'duplicate_found': False}},
            ]
        },
        {
            'username': 'charlie_sus', 'email': 'charlie99@tempmail.org',
            'ip': '185.220.101.5', 'status_p1': 'rejected', 'fraud_score': 91,
            'bonus_percent': 2.0, 'bonus_amount': 2.24, 'bonus_released': False,
            'p2_revenue': 0, 'p2_commission': 0, 'p2_status': 'tracking', 'p2_qualified': False,
            'checks': [
                {'check_name': 'ipqs_ip_check', 'result': 'block', 'details': {'is_vpn': True, 'is_proxy': True, 'fraud_score': 91}},
                {'check_name': 'duplicate_ip', 'result': 'block', 'details': {'duplicate_found': True}},
                {'check_name': 'duplicate_email', 'result': 'block', 'details': {'duplicate_found': True}},
                {'check_name': 'duplicate_fingerprint', 'result': 'pass', 'details': {'duplicate_found': False}},
            ]
        },
        {
            'username': 'diana_review', 'email': 'diana.t@outlook.com',
            'ip': '157.32.70.11', 'status_p1': 'pending_review', 'fraud_score': 44,
            'bonus_percent': 2.0, 'bonus_amount': 2.24, 'bonus_released': False,
            'p2_revenue': 180.0, 'p2_commission': 0, 'p2_status': 'tracking', 'p2_qualified': False,
            'checks': [
                {'check_name': 'ipqs_ip_check', 'result': 'pass', 'details': {'fraud_score': 30}},
                {'check_name': 'duplicate_ip', 'result': 'pass', 'details': {'duplicate_found': False}},
                {'check_name': 'duplicate_email', 'result': 'pass', 'details': {'duplicate_found': False}},
                {'check_name': 'duplicate_fingerprint', 'result': 'block', 'details': {'duplicate_found': True}},
            ]
        },
    ]

    for u in test_users:
        # Create fake user doc (minimal)
        existing = users.find_one({'email': u['email']})
        if existing:
            user_id = str(existing['_id'])
        else:
            result = users.insert_one({
                'username': u['username'], 'email': u['email'],
                'password': b'$2b$12$fakehash', 'role': 'partner',
                'is_active': True, 'email_verified': u['status_p1'] == 'approved',
                'account_status': 'approved' if u['status_p1'] == 'approved' else 'pending_approval',
                'login_count': 3 if u['status_p1'] == 'approved' else 1,
                'created_at': datetime.utcnow() - timedelta(days=5),
                'referred_by': admin_id, 'referral_code_used': 'K65U6A29',
            })
            user_id = str(result.inserted_id)

        # Skip if P1 already exists
        if referrals_p1.find_one({'referred_email': u['email']}):
            print(f"⏭ Skipping {u['username']} (already exists)")
            continue

        # Create P1 referral
        p1_doc = {
            'referrer_id': admin_id,
            'referred_user_id': user_id,
            'referred_email': u['email'],
            'referred_username': u['username'],
            'bonus_percent': u['bonus_percent'],
            'bonus_amount': u['bonus_amount'],
            'referrer_earnings_at_time': 112.0,
            'status': u['status_p1'],
            'fraud_score': u['fraud_score'],
            'ip_address': u['ip'],
            'device_fingerprint': f'fp_{u["username"]}',
            'user_agent': 'Mozilla/5.0 (Test)',
            'created_at': datetime.utcnow() - timedelta(days=3),
            'updated_at': datetime.utcnow(),
            'bonus_released': u['bonus_released'],
            'bonus_released_at': datetime.utcnow() if u['bonus_released'] else None,
        }
        p1_result = referrals_p1.insert_one(p1_doc)
        p1_id = str(p1_result.inserted_id)

        # Log fraud checks
        referral_fraud_log.insert_one({
            'referral_id': p1_id,
            'referral_type': 'p1',
            'checks': u['checks'],
            'created_at': datetime.utcnow()
        })

        # Create P2 referral
        p2_doc = {
            'referrer_id': admin_id,
            'referred_user_id': user_id,
            'referred_email': u['email'],
            'referred_username': u['username'],
            'revenue_generated': u['p2_revenue'],
            'commission_earned': u['p2_commission'],
            'commission_rate': 0.04,
            'status': u['p2_status'],
            'qualified': u['p2_qualified'],
            'qualified_at': datetime.utcnow() - timedelta(days=1) if u['p2_qualified'] else None,
            'qualification_type': 'cpa' if u['p2_qualified'] else None,
            'months_remaining': 5 if u['p2_qualified'] else 6,
            'expires_at': datetime.utcnow() + timedelta(days=150) if u['p2_qualified'] else None,
            'created_at': datetime.utcnow() - timedelta(days=3),
            'updated_at': datetime.utcnow(),
        }
        referrals_p2.insert_one(p2_doc)

        print(f"✅ Created referral for {u['username']} (P1: {u['status_p1']}, P2: {u['p2_status']})")

    # Update admin stats
    users.update_one(
        {'_id': admin['_id']},
        {'$set': {'referral_bonus_total': 4.48, 'referral_commission_pending': 24.80}}
    )

    print("\n✅ Seed complete! 4 test referrals created.")

if __name__ == '__main__':
    seed()
