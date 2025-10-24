"""
Test script for new offer email notifications
Run this to test the email service before using it in production
"""

import sys
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.email_service import get_email_service

def test_new_offer_email():
    """Test sending new offer notification email"""
    
    print("=" * 60)
    print("🧪 TESTING NEW OFFER EMAIL NOTIFICATION")
    print("=" * 60)
    
    # Get email service
    email_service = get_email_service()
    
    # Check configuration
    if not email_service.is_configured:
        print("\n❌ Email service is not configured!")
        print("Please set SMTP credentials in .env file")
        return False
    
    print(f"\n✅ Email service configured")
    print(f"📧 SMTP Server: {email_service.smtp_server}:{email_service.smtp_port}")
    print(f"📧 From Email: {email_service.from_email}")
    print(f"📧 Debug Mode: {email_service.email_debug}")
    
    # Sample offer data
    sample_offer = {
        'offer_id': 'ML-00001',
        'name': 'Premium Mobile Game Install',
        'description': 'Install our top-rated mobile game and reach level 10 to earn rewards. High conversion rate with excellent user retention.',
        'payout': 5.50,
        'currency': 'USD',
        'category': 'Gaming',
        'network': 'AppLovin',
        'countries': ['US', 'UK', 'CA', 'AU'],
        'status': 'active'
    }
    
    # Test recipients (use your own email for testing)
    test_recipients = [
        email_service.smtp_username  # Send to yourself for testing
    ]
    
    print(f"\n📤 Sending test email to: {', '.join(test_recipients)}")
    print(f"📝 Offer: {sample_offer['name']}")
    print(f"💰 Payout: {sample_offer['currency']} {sample_offer['payout']}")
    
    # Send email
    result = email_service.send_new_offer_notification(
        offer_data=sample_offer,
        recipients=test_recipients
    )
    
    print("\n" + "=" * 60)
    print("📊 RESULTS")
    print("=" * 60)
    print(f"Total Recipients: {result['total']}")
    print(f"✅ Sent Successfully: {result['sent']}")
    print(f"❌ Failed: {result['failed']}")
    
    if result['sent'] > 0:
        print("\n✅ TEST PASSED!")
        if email_service.email_debug:
            print("⚠️  Note: EMAIL_DEBUG is enabled, no actual emails were sent")
            print("   Check the logs above to see the email details")
        else:
            print(f"📬 Check your inbox: {test_recipients[0]}")
        return True
    else:
        print("\n❌ TEST FAILED!")
        if 'error' in result:
            print(f"Error: {result['error']}")
        return False


def test_async_email():
    """Test asynchronous email sending"""
    
    print("\n" + "=" * 60)
    print("🧪 TESTING ASYNC EMAIL NOTIFICATION")
    print("=" * 60)
    
    email_service = get_email_service()
    
    sample_offer = {
        'offer_id': 'ML-00002',
        'name': 'E-commerce Signup Offer',
        'description': 'Sign up for our premium e-commerce platform and get instant rewards.',
        'payout': 12.00,
        'currency': 'USD',
        'category': 'E-commerce',
        'network': 'Direct',
        'countries': ['US'],
        'status': 'active'
    }
    
    test_recipients = [email_service.smtp_username]
    
    print(f"📤 Starting async email send to: {', '.join(test_recipients)}")
    
    # Send async
    email_service.send_new_offer_notification_async(
        offer_data=sample_offer,
        recipients=test_recipients
    )
    
    print("✅ Async email process started in background")
    print("⏳ Emails will be sent in a separate thread")
    print("   Check logs for completion status")
    
    # Wait a bit for the thread to complete
    import time
    print("\n⏳ Waiting 3 seconds for background thread...")
    time.sleep(3)
    
    print("✅ Test complete!")


if __name__ == "__main__":
    print("\n🚀 Starting Email Service Tests\n")
    
    # Test 1: Synchronous email
    success = test_new_offer_email()
    
    # Test 2: Asynchronous email
    if success:
        test_async_email()
    
    print("\n" + "=" * 60)
    print("🏁 ALL TESTS COMPLETE")
    print("=" * 60)
    
    print("\n💡 NEXT STEPS:")
    print("1. If EMAIL_DEBUG=true, set it to false in .env to send real emails")
    print("2. Create a new offer via admin panel to test the integration")
    print("3. Check that publishers receive the email notification")
    print("\n")
