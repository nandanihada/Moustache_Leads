#!/usr/bin/env python3
"""
Complete Email Workflow Test Script
Tests all three scenarios:
1. Create offer and send emails to all publishers
2. Approve offer access and send email
3. Approve placement and send email
"""

import os
import sys
import json
from datetime import datetime
from bson import ObjectId

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import db_instance
from services.email_service import get_email_service
from services.access_control_service import AccessControlService
from models.user import User
from models.offer import Offer
from models.placement import Placement
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class EmailWorkflowTester:
    def __init__(self):
        self.email_service = get_email_service()
        self.access_service = AccessControlService()
        self.user_model = User()
        self.offer_model = Offer()
        self.placement_model = Placement()
        self.test_results = {
            'test1': {'status': 'pending', 'details': {}},
            'test2': {'status': 'pending', 'details': {}},
            'test3': {'status': 'pending', 'details': {}}
        }

    def print_header(self, title):
        """Print formatted header"""
        print("\n" + "="*70)
        print(f"  {title}".center(70))
        print("="*70)

    def print_section(self, title):
        """Print formatted section"""
        print(f"\n📋 {title}")
        print("-" * 70)

    def test1_create_offer_and_send_emails(self):
        """Test 1: Create offer and send emails to all users and publishers"""
        self.print_header("TEST 1: CREATE OFFER & SEND EMAILS TO ALL USERS")
        
        try:
            # Step 1: Get all users and publishers
            self.print_section("Step 1: Finding all users and publishers")
            users_collection = db_instance.get_collection('users')
            all_users = list(users_collection.find(
                {'email': {'$exists': True, '$ne': ''}},
                {'email': 1, 'username': 1, '_id': 1, 'role': 1}
            ))
            
            # Separate by role
            publishers = [u for u in all_users if u.get('role') == 'publisher']
            other_users = [u for u in all_users if u.get('role') != 'publisher']
            
            print(f"✅ Found {len(publishers)} publishers:")
            for pub in publishers:
                email = pub.get('email')
                username = pub.get('username')
                if email:
                    print(f"   • {username} ({email}) [Publisher]")
            
            print(f"\n✅ Found {len(other_users)} other users:")
            for user in other_users:
                email = user.get('email')
                username = user.get('username')
                role = user.get('role', 'user')
                if email:
                    print(f"   • {username} ({email}) [{role}]")
            
            # Collect all emails
            all_emails = []
            for user in all_users:
                email = user.get('email')
                if email:
                    all_emails.append(email)
            
            if not all_emails:
                print("❌ No users with email found!")
                self.test_results['test1']['status'] = 'failed'
                self.test_results['test1']['details'] = {'error': 'No users with email'}
                return False
            
            # Step 2: Create test offer
            self.print_section("Step 2: Creating test offer")
            test_offer_data = {
                'name': f'Test Offer - {datetime.now().strftime("%H:%M:%S")}',
                'offer_id': f'TEST-{int(datetime.now().timestamp())}',
                'target_url': 'https://example.com/offer',
                'payout': 5.00,
                'currency': 'USD',
                'network': 'Test Network',
                'category': 'Test',
                'description': 'This is a test offer for email notification testing',
                'status': 'active',
                'is_active': True,
                'image_url': 'https://images.unsplash.com/photo-1557821552-17105176677c?w=800&h=400&fit=crop',
                'countries': ['US', 'UK', 'CA'],
                'affiliates': 'all'
            }
            
            print(f"✅ Test offer data prepared:")
            print(f"   • Offer ID: {test_offer_data['offer_id']}")
            print(f"   • Name: {test_offer_data['name']}")
            print(f"   • Payout: {test_offer_data['payout']} {test_offer_data['currency']}")
            
            # Step 3: Send emails
            self.print_section("Step 3: Sending emails to all users and publishers")
            print(f"📧 Sending emails to {len(all_emails)} total recipients...")
            
            result = self.email_service.send_new_offer_notification(
                offer_data=test_offer_data,
                recipients=all_emails
            )
            
            print(f"\n📊 Email Sending Results:")
            print(f"   • Total Recipients: {result.get('total', 0)}")
            print(f"   • Sent: {result.get('sent', 0)} ✅")
            print(f"   • Failed: {result.get('failed', 0)} ❌")
            print(f"   • Offer Name: {result.get('offer_name', 'N/A')}")
            
            # Step 4: Log recipients
            self.print_section("Step 4: Email Recipients Summary")
            print(f"✅ Emails sent to {len(all_emails)} total recipients:")
            print(f"\n   Publishers ({len(publishers)}):")
            for pub in publishers:
                print(f"   • {pub.get('username')} ({pub.get('email')})")
            print(f"\n   Other Users ({len(other_users)}):")
            for user in other_users:
                print(f"   • {user.get('username')} ({user.get('email')}) [{user.get('role', 'user')}]")
            
            self.test_results['test1']['status'] = 'passed' if result.get('sent', 0) > 0 else 'failed'
            self.test_results['test1']['details'] = {
                'offer_id': test_offer_data['offer_id'],
                'offer_name': test_offer_data['name'],
                'total_recipients': len(all_emails),
                'publishers': len(publishers),
                'other_users': len(other_users),
                'emails_sent': result.get('sent', 0),
                'emails_failed': result.get('failed', 0),
                'recipients': all_emails
            }
            
            return result.get('sent', 0) > 0
            
        except Exception as e:
            print(f"❌ Error in Test 1: {str(e)}")
            self.test_results['test1']['status'] = 'failed'
            self.test_results['test1']['details'] = {'error': str(e)}
            return False

    def test2_approve_offer_access_and_send_email(self):
        """Test 2: Approve offer access and send email"""
        self.print_header("TEST 2: APPROVE OFFER ACCESS & SEND EMAIL")
        
        try:
            # Step 1: Find a publisher
            self.print_section("Step 1: Finding a test publisher")
            users_collection = db_instance.get_collection('users')
            publisher = users_collection.find_one({'role': 'publisher', 'email': {'$exists': True}})
            
            if not publisher:
                print("❌ No publisher found!")
                self.test_results['test2']['status'] = 'failed'
                self.test_results['test2']['details'] = {'error': 'No publisher found'}
                return False
            
            publisher_id = publisher.get('_id')
            publisher_email = publisher.get('email')
            publisher_username = publisher.get('username')
            
            print(f"✅ Found publisher:")
            print(f"   • Username: {publisher_username}")
            print(f"   • Email: {publisher_email}")
            print(f"   • ID: {publisher_id}")
            
            # Step 2: Find or create an offer with approval required
            self.print_section("Step 2: Finding or creating offer with approval required")
            offers_collection = db_instance.get_collection('offers')
            
            # Try to find existing offer with approval required
            offer = offers_collection.find_one({
                'affiliates': 'request',
                'status': 'active'
            })
            
            if not offer:
                print("⚠️  No offer with approval required found, creating one...")
                offer_data = {
                    'name': f'Approval Test Offer - {datetime.now().strftime("%H:%M:%S")}',
                    'offer_id': f'APPR-{int(datetime.now().timestamp())}',
                    'target_url': 'https://example.com/approval-test',
                    'payout': 10.00,
                    'currency': 'USD',
                    'network': 'Test Network',
                    'category': 'Test',
                    'status': 'active',
                    'is_active': True,
                    'image_url': 'https://images.unsplash.com/photo-1557821552-17105176677c?w=800&h=400&fit=crop',
                    'countries': ['US'],
                    'affiliates': 'request',
                    'approval_settings': {
                        'type': 'manual',
                        'require_approval': True
                    }
                }
                offers_collection.insert_one(offer_data)
                offer = offer_data
                print(f"✅ Created test offer: {offer['offer_id']}")
            
            offer_id = offer.get('offer_id')
            offer_name = offer.get('name')
            
            print(f"✅ Using offer:")
            print(f"   • Offer ID: {offer_id}")
            print(f"   • Name: {offer_name}")
            print(f"   • Affiliates: {offer.get('affiliates')}")
            
            # Step 3: Create access request
            self.print_section("Step 3: Creating access request")
            requests_collection = db_instance.get_collection('affiliate_requests')
            
            # Check if request already exists
            existing_request = requests_collection.find_one({
                'offer_id': offer_id,
                'user_id': publisher_id
            })
            
            if existing_request:
                request_id = existing_request.get('request_id')
                print(f"⚠️  Request already exists: {request_id}")
            else:
                request_id = f"REQ-{int(datetime.now().timestamp())}"
                request_data = {
                    'request_id': request_id,
                    'offer_id': offer_id,
                    'user_id': publisher_id,
                    'status': 'pending',
                    'requested_at': datetime.now(),
                    'message': 'Test access request'
                }
                requests_collection.insert_one(request_data)
                print(f"✅ Created access request: {request_id}")
            
            # Step 4: Approve the request
            self.print_section("Step 4: Approving access request")
            requests_collection.update_one(
                {'request_id': request_id},
                {
                    '$set': {
                        'status': 'approved',
                        'approved_at': datetime.now(),
                        'approved_by': 'admin_test'
                    }
                }
            )
            print(f"✅ Request approved: {request_id}")
            
            # Step 5: Send approval email
            self.print_section("Step 5: Sending approval email")
            print(f"📧 Sending approval email to {publisher_email}...")
            
            email_sent = self.email_service.send_approval_notification(
                recipient_email=publisher_email,
                offer_name=offer_name,
                status='approved',
                reason='',
                offer_id=offer_id
            )
            
            if email_sent:
                print(f"✅ Approval email sent successfully!")
            else:
                print(f"❌ Failed to send approval email!")
            
            self.test_results['test2']['status'] = 'passed' if email_sent else 'failed'
            self.test_results['test2']['details'] = {
                'publisher_email': publisher_email,
                'publisher_username': publisher_username,
                'offer_id': offer_id,
                'offer_name': offer_name,
                'request_id': request_id,
                'email_sent': email_sent
            }
            
            return email_sent
            
        except Exception as e:
            print(f"❌ Error in Test 2: {str(e)}")
            import traceback
            traceback.print_exc()
            self.test_results['test2']['status'] = 'failed'
            self.test_results['test2']['details'] = {'error': str(e)}
            return False

    def test3_approve_placement_and_send_email(self):
        """Test 3: Approve placement and send email"""
        self.print_header("TEST 3: APPROVE PLACEMENT & SEND EMAIL")
        
        try:
            # Step 1: Find a publisher
            self.print_section("Step 1: Finding a test publisher")
            users_collection = db_instance.get_collection('users')
            publisher = users_collection.find_one({'role': 'publisher', 'email': {'$exists': True}})
            
            if not publisher:
                print("❌ No publisher found!")
                self.test_results['test3']['status'] = 'failed'
                self.test_results['test3']['details'] = {'error': 'No publisher found'}
                return False
            
            publisher_id = publisher.get('_id')
            publisher_email = publisher.get('email')
            publisher_username = publisher.get('username')
            
            print(f"✅ Found publisher:")
            print(f"   • Username: {publisher_username}")
            print(f"   • Email: {publisher_email}")
            print(f"   • ID: {publisher_id}")
            
            # Step 2: Find or create a pending placement
            self.print_section("Step 2: Finding or creating pending placement")
            placements_collection = db_instance.get_collection('placements')
            
            placement = placements_collection.find_one({
                'publisher_id': publisher_id,
                'approvalStatus': 'pending'
            })
            
            if not placement:
                print("⚠️  No pending placement found, creating one...")
                placement_data = {
                    'name': f'Test Placement - {datetime.now().strftime("%H:%M:%S")}',
                    'publisher_id': publisher_id,
                    'status': 'active',
                    'approvalStatus': 'pending',
                    'created_at': datetime.now(),
                    'description': 'Test placement for email notification'
                }
                result = placements_collection.insert_one(placement_data)
                placement = placement_data
                placement['_id'] = result.inserted_id
                print(f"✅ Created test placement: {placement['name']}")
            
            placement_id = str(placement.get('_id'))
            placement_name = placement.get('name')
            
            print(f"✅ Using placement:")
            print(f"   • Placement ID: {placement_id}")
            print(f"   • Name: {placement_name}")
            print(f"   • Status: {placement.get('approvalStatus')}")
            
            # Step 3: Approve the placement
            self.print_section("Step 3: Approving placement")
            placements_collection.update_one(
                {'_id': ObjectId(placement_id)},
                {
                    '$set': {
                        'approvalStatus': 'approved',
                        'approved_at': datetime.now(),
                        'approved_by': 'admin_test'
                    }
                }
            )
            print(f"✅ Placement approved: {placement_id}")
            
            # Step 4: Send approval email
            self.print_section("Step 4: Sending approval email")
            print(f"📧 Sending approval email to {publisher_email}...")
            
            email_sent = self.email_service.send_approval_notification(
                recipient_email=publisher_email,
                offer_name=placement_name,
                status='approved',
                reason='',
                offer_id=placement_id
            )
            
            if email_sent:
                print(f"✅ Approval email sent successfully!")
            else:
                print(f"❌ Failed to send approval email!")
            
            self.test_results['test3']['status'] = 'passed' if email_sent else 'failed'
            self.test_results['test3']['details'] = {
                'publisher_email': publisher_email,
                'publisher_username': publisher_username,
                'placement_id': placement_id,
                'placement_name': placement_name,
                'email_sent': email_sent
            }
            
            return email_sent
            
        except Exception as e:
            print(f"❌ Error in Test 3: {str(e)}")
            import traceback
            traceback.print_exc()
            self.test_results['test3']['status'] = 'failed'
            self.test_results['test3']['details'] = {'error': str(e)}
            return False

    def print_summary(self):
        """Print test summary"""
        self.print_header("TEST SUMMARY")
        
        print("\n📊 Test Results:")
        print("-" * 70)
        
        for test_name, result in self.test_results.items():
            status_icon = "✅" if result['status'] == 'passed' else "❌"
            print(f"\n{status_icon} {test_name.upper()}: {result['status'].upper()}")
            
            if result['details']:
                for key, value in result['details'].items():
                    if isinstance(value, list):
                        print(f"   • {key}:")
                        for item in value:
                            print(f"     - {item}")
                    else:
                        print(f"   • {key}: {value}")
        
        # Overall status
        all_passed = all(r['status'] == 'passed' for r in self.test_results.values())
        
        print("\n" + "="*70)
        if all_passed:
            print("✅ ALL TESTS PASSED!".center(70))
        else:
            print("❌ SOME TESTS FAILED!".center(70))
        print("="*70 + "\n")
        
        return all_passed

    def run_all_tests(self):
        """Run all tests"""
        print("\n")
        print("╔" + "="*68 + "╗")
        print("║" + " "*68 + "║")
        print("║" + "  COMPLETE EMAIL WORKFLOW TEST SUITE".center(68) + "║")
        print("║" + " "*68 + "║")
        print("╚" + "="*68 + "╝")
        
        print("\n🚀 Starting tests...\n")
        
        # Run tests
        test1_passed = self.test1_create_offer_and_send_emails()
        test2_passed = self.test2_approve_offer_access_and_send_email()
        test3_passed = self.test3_approve_placement_and_send_email()
        
        # Print summary
        all_passed = self.print_summary()
        
        return all_passed

if __name__ == "__main__":
    tester = EmailWorkflowTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
