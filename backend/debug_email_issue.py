#!/usr/bin/env python3
"""
Debug script to identify why emails are not being sent when creating offers
"""

import os
import sys
from datetime import datetime

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import db_instance
from services.email_service import get_email_service
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def main():
    print("\n" + "="*70)
    print("  EMAIL SENDING DEBUG SCRIPT".center(70))
    print("="*70)
    
    # Step 1: Check email service configuration
    print("\n📧 Step 1: Checking Email Service Configuration")
    print("-" * 70)
    
    email_service = get_email_service()
    
    print(f"✅ SMTP Server: {email_service.smtp_server}")
    print(f"✅ SMTP Port: {email_service.smtp_port}")
    print(f"✅ SMTP Username: {email_service.smtp_username}")
    print(f"✅ From Email: {email_service.from_email}")
    print(f"✅ Email Debug Mode: {email_service.email_debug}")
    print(f"✅ Is Configured: {email_service.is_configured}")
    
    if not email_service.is_configured:
        print("\n❌ ERROR: Email service is NOT configured!")
        return False
    
    # Step 2: Check database connection
    print("\n📊 Step 2: Checking Database Connection")
    print("-" * 70)
    
    users_collection = db_instance.get_collection('users')
    if users_collection is None:
        print("❌ ERROR: Cannot access users collection!")
        return False
    
    print("✅ Database connection successful")
    
    # Step 3: Count publishers
    print("\n👥 Step 3: Counting Publishers")
    print("-" * 70)
    
    all_users = list(users_collection.find({}, {'_id': 1, 'role': 1}))
    print(f"✅ Total users in database: {len(all_users)}")
    
    publishers = list(users_collection.find({'role': 'publisher'}, {'_id': 1, 'username': 1, 'email': 1}))
    print(f"✅ Total publishers: {len(publishers)}")
    
    # Step 4: Check publisher emails
    print("\n📧 Step 4: Checking Publisher Emails")
    print("-" * 70)
    
    publishers_with_email = [p for p in publishers if p.get('email')]
    print(f"✅ Publishers with email: {len(publishers_with_email)}")
    
    if publishers_with_email:
        print("\n   Publishers with email:")
        for pub in publishers_with_email:
            print(f"   • {pub.get('username')} ({pub.get('email')})")
    else:
        print("\n❌ WARNING: No publishers have email addresses!")
        print("   This is why no emails are being sent!")
        return False
    
    # Step 5: Test email sending
    print("\n✉️  Step 5: Testing Email Sending")
    print("-" * 70)
    
    test_email = publishers_with_email[0].get('email')
    print(f"📤 Sending test email to: {test_email}")
    
    test_offer = {
        'name': f'Debug Test Offer - {datetime.now().strftime("%H:%M:%S")}',
        'offer_id': f'DEBUG-{int(datetime.now().timestamp())}',
        'payout': 5.00,
        'currency': 'USD',
        'network': 'Debug Test',
        'category': 'Test',
        'image_url': 'https://images.unsplash.com/photo-1557821552-17105176677c?w=800&h=400&fit=crop'
    }
    
    result = email_service.send_new_offer_notification(
        offer_data=test_offer,
        recipients=[test_email]
    )
    
    print(f"\n📊 Email Sending Result:")
    print(f"   • Total: {result.get('total', 0)}")
    print(f"   • Sent: {result.get('sent', 0)} ✅")
    print(f"   • Failed: {result.get('failed', 0)} ❌")
    
    if result.get('sent', 0) > 0:
        print("\n✅ Email sending is working correctly!")
        return True
    else:
        print("\n❌ Email sending failed!")
        if result.get('error'):
            print(f"   Error: {result.get('error')}")
        return False

if __name__ == "__main__":
    success = main()
    print("\n" + "="*70 + "\n")
    sys.exit(0 if success else 1)
