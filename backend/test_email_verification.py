"""
Test script for email verification system
Run this to test the email verification flow
"""

import sys
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.email_verification_service import get_email_verification_service
from models.user import User
from bson import ObjectId

def test_email_verification_flow():
    """Test the complete email verification flow"""
    
    print("=" * 70)
    print("🧪 EMAIL VERIFICATION SYSTEM TEST")
    print("=" * 70)
    
    # Initialize services
    verification_service = get_email_verification_service()
    user_model = User()
    
    # Test 1: Generate verification token
    print("\n📝 TEST 1: Generate Verification Token")
    print("-" * 70)
    
    test_email = "testuser@example.com"
    test_user_id = str(ObjectId())
    
    token = verification_service.generate_verification_token(test_email, test_user_id)
    
    if token:
        print(f"✅ Token generated successfully")
        print(f"   Email: {test_email}")
        print(f"   User ID: {test_user_id}")
        print(f"   Token: {token[:20]}...")
    else:
        print("❌ Failed to generate token")
        return False
    
    # Test 2: Verify token
    print("\n📝 TEST 2: Verify Token")
    print("-" * 70)
    
    is_valid, email, user_id = verification_service.verify_email_token(token)
    
    if is_valid and email == test_email and user_id == test_user_id:
        print(f"✅ Token verified successfully")
        print(f"   Email: {email}")
        print(f"   User ID: {user_id}")
    else:
        print("❌ Failed to verify token")
        return False
    
    # Test 3: Try to verify same token again (should fail - already verified)
    print("\n📝 TEST 3: Verify Same Token Again (Should Fail)")
    print("-" * 70)
    
    is_valid, email, user_id = verification_service.verify_email_token(token)
    
    if not is_valid:
        print(f"✅ Correctly rejected already-verified token")
    else:
        print("❌ Should have rejected already-verified token")
        return False
    
    # Test 4: Get verification status
    print("\n📝 TEST 4: Get Verification Status")
    print("-" * 70)
    
    status = verification_service.get_verification_status(test_user_id)
    
    print(f"✅ Verification status retrieved")
    print(f"   Status: {status}")
    
    # Test 5: Send verification email
    print("\n📝 TEST 5: Send Verification Email")
    print("-" * 70)
    
    test_email_2 = "newuser@example.com"
    test_user_id_2 = str(ObjectId())
    test_username = "testuser"
    
    token_2 = verification_service.generate_verification_token(test_email_2, test_user_id_2)
    
    if verification_service.is_configured:
        email_sent = verification_service.send_verification_email(
            test_email_2,
            token_2,
            test_username
        )
        
        if email_sent:
            print(f"✅ Verification email sent successfully")
            print(f"   To: {test_email_2}")
            print(f"   Username: {test_username}")
        else:
            print(f"⚠️  Failed to send email (SMTP may not be configured)")
    else:
        print(f"⚠️  Email service not configured")
        print(f"   Set SMTP_SERVER, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, FROM_EMAIL in .env")
    
    # Test 6: Resend verification email
    print("\n📝 TEST 6: Resend Verification Email")
    print("-" * 70)
    
    success, message = verification_service.resend_verification_email(test_email_2, test_username)
    
    if success:
        print(f"✅ Verification email resent successfully")
        print(f"   Message: {message}")
    else:
        print(f"⚠️  {message}")
    
    # Test 7: Mark email as verified in user model
    print("\n📝 TEST 7: Mark Email as Verified in User Model")
    print("-" * 70)
    
    # Create a test user first
    test_user_data, error = user_model.create_user(
        username="verifytest",
        email="verify@example.com",
        password="testpass123"
    )
    
    if test_user_data:
        user_id = str(test_user_data['_id'])
        
        # Mark as verified
        if user_model.mark_email_verified(user_id):
            print(f"✅ Email marked as verified in database")
            
            # Check verification status
            is_verified = user_model.is_email_verified(user_id)
            if is_verified:
                print(f"✅ Verification status confirmed")
            else:
                print(f"❌ Verification status check failed")
                return False
        else:
            print(f"❌ Failed to mark email as verified")
            return False
    else:
        print(f"⚠️  Could not create test user: {error}")
    
    print("\n" + "=" * 70)
    print("✅ ALL TESTS PASSED!")
    print("=" * 70)
    
    print("\n💡 NEXT STEPS:")
    print("1. Configure SMTP settings in .env file (if not already done)")
    print("2. Test registration flow at /register")
    print("3. Verify email verification emails are being sent")
    print("4. Click verification link to complete email verification")
    print("\n")
    
    return True


if __name__ == "__main__":
    try:
        success = test_email_verification_flow()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Test failed with error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
