#!/usr/bin/env python3
"""
Test script to verify email sending functionality
Run this to test if emails are being sent correctly
"""

import os
import sys
from datetime import datetime

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.email_service import get_email_service
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_email_configuration():
    """Test if email service is properly configured"""
    print("\n" + "="*60)
    print("📧 EMAIL SERVICE CONFIGURATION TEST")
    print("="*60)
    
    email_service = get_email_service()
    
    print(f"\n✅ SMTP Server: {email_service.smtp_server}")
    print(f"✅ SMTP Port: {email_service.smtp_port}")
    print(f"✅ SMTP Username: {email_service.smtp_username}")
    print(f"✅ From Email: {email_service.from_email}")
    print(f"✅ Email Debug Mode: {email_service.email_debug}")
    print(f"✅ Is Configured: {email_service.is_configured}")
    
    if not email_service.is_configured:
        print("\n❌ ERROR: Email service is NOT properly configured!")
        print("   Please check your .env file for:")
        print("   - SMTP_SERVER")
        print("   - SMTP_PORT")
        print("   - SMTP_USERNAME")
        print("   - SMTP_PASSWORD")
        print("   - FROM_EMAIL")
        return False
    
    print("\n✅ Email service is properly configured!")
    return True

def test_approval_email():
    """Test sending an approval email"""
    print("\n" + "="*60)
    print("📧 APPROVAL EMAIL TEST")
    print("="*60)
    
    email_service = get_email_service()
    
    # Test data
    test_email = "nandani.h@pepeleads.com"  # Send to yourself for testing
    offer_name = "Test Offer - Approval"
    
    print(f"\n📤 Sending approval email to: {test_email}")
    print(f"📝 Offer Name: {offer_name}")
    print(f"✅ Status: approved")
    
    # Send email
    result = email_service.send_approval_notification(
        recipient_email=test_email,
        offer_name=offer_name,
        status='approved',
        reason='',
        offer_id='test_offer_123'
    )
    
    if result:
        print("\n✅ Approval email sent successfully!")
        return True
    else:
        print("\n❌ Failed to send approval email!")
        return False

def test_rejection_email():
    """Test sending a rejection email"""
    print("\n" + "="*60)
    print("📧 REJECTION EMAIL TEST")
    print("="*60)
    
    email_service = get_email_service()
    
    # Test data
    test_email = "nandani.h@pepeleads.com"  # Send to yourself for testing
    offer_name = "Test Offer - Rejection"
    reason = "Offer does not meet quality standards"
    
    print(f"\n📤 Sending rejection email to: {test_email}")
    print(f"📝 Offer Name: {offer_name}")
    print(f"❌ Status: rejected")
    print(f"📋 Reason: {reason}")
    
    # Send email
    result = email_service.send_approval_notification(
        recipient_email=test_email,
        offer_name=offer_name,
        status='rejected',
        reason=reason,
        offer_id='test_offer_456'
    )
    
    if result:
        print("\n✅ Rejection email sent successfully!")
        return True
    else:
        print("\n❌ Failed to send rejection email!")
        return False

def test_async_email():
    """Test sending email asynchronously"""
    print("\n" + "="*60)
    print("📧 ASYNC EMAIL TEST")
    print("="*60)
    
    email_service = get_email_service()
    
    # Test data
    test_email = "nandani.h@pepeleads.com"
    offer_name = "Test Offer - Async"
    
    print(f"\n📤 Sending async approval email to: {test_email}")
    print(f"📝 Offer Name: {offer_name}")
    
    # Send email asynchronously
    email_service.send_approval_notification_async(
        recipient_email=test_email,
        offer_name=offer_name,
        status='approved',
        reason='',
        offer_id='test_offer_789'
    )
    
    print("\n✅ Async email sent (background thread started)")
    print("   Check your email in a few seconds...")
    return True

def main():
    """Run all email tests"""
    print("\n")
    print("╔" + "="*58 + "╗")
    print("║" + " "*58 + "║")
    print("║" + "  EMAIL SENDING TEST SUITE".center(58) + "║")
    print("║" + " "*58 + "║")
    print("╚" + "="*58 + "╝")
    
    results = {}
    
    # Test 1: Configuration
    print("\n[1/4] Testing email configuration...")
    results['config'] = test_email_configuration()
    
    if not results['config']:
        print("\n❌ Email service not configured. Skipping remaining tests.")
        return
    
    # Test 2: Approval Email
    print("\n[2/4] Testing approval email...")
    try:
        results['approval'] = test_approval_email()
    except Exception as e:
        print(f"\n❌ Error sending approval email: {str(e)}")
        results['approval'] = False
    
    # Test 3: Rejection Email
    print("\n[3/4] Testing rejection email...")
    try:
        results['rejection'] = test_rejection_email()
    except Exception as e:
        print(f"\n❌ Error sending rejection email: {str(e)}")
        results['rejection'] = False
    
    # Test 4: Async Email
    print("\n[4/4] Testing async email...")
    try:
        results['async'] = test_async_email()
    except Exception as e:
        print(f"\n❌ Error sending async email: {str(e)}")
        results['async'] = False
    
    # Summary
    print("\n" + "="*60)
    print("📊 TEST SUMMARY")
    print("="*60)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name.upper()}: {status}")
    
    all_passed = all(results.values())
    
    print("\n" + "="*60)
    if all_passed:
        print("✅ ALL TESTS PASSED!")
        print("Email sending is working correctly.")
    else:
        print("❌ SOME TESTS FAILED!")
        print("Please check the errors above.")
    print("="*60 + "\n")

if __name__ == "__main__":
    main()
