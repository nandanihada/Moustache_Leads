"""
Test script to send ALL email types to a single recipient.
Run from backend/ directory: python test_all_emails.py
"""
import os
import sys
import time
import logging
import traceback
from pathlib import Path
from dotenv import load_dotenv

# Load env
env_path = Path(__file__).resolve().parent / '.env'
load_dotenv(dotenv_path=env_path)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

TARGET_EMAIL = 'nandanihada2003@gmail.com'
TEST_USERNAME = 'TestPublisher'
DELAY = 5  # seconds between sends — Gmail rate limits aggressively


def safe_send(name, func, *args, **kwargs):
    """Wrapper that catches errors and returns True/False"""
    try:
        logger.info(f"\n📧 Sending: {name}")
        result = func(*args, **kwargs)
        # Some methods return dict, some return bool
        if isinstance(result, dict):
            ok = result.get('sent', 0) > 0 or result.get('success', False)
        else:
            ok = bool(result)
        status = "✅ SENT" if ok else "❌ FAILED (returned False)"
        logger.info(f"  {status}")
        time.sleep(DELAY)
        return ok
    except Exception as e:
        logger.error(f"  ❌ EXCEPTION: {e}")
        traceback.print_exc()
        time.sleep(DELAY)
        return False


def send_all_emails():
    results = []

    # ============================================================
    # GROUP 1: EmailVerificationService emails
    # ============================================================
    logger.info("=" * 60)
    logger.info("GROUP 1: Email Verification Service Emails")
    logger.info("=" * 60)

    from services.email_verification_service import EmailVerificationService
    # Create fresh instance to ensure config is loaded
    v_svc = EmailVerificationService()
    logger.info(f"  Verification service configured: {v_svc.is_configured}")

    # 1
    ok = safe_send("1/15 - Email Verification",
        v_svc.send_verification_email, TARGET_EMAIL, 'test-token-preview-only', TEST_USERNAME)
    results.append(('Email Verification', ok))

    # 2
    ok = safe_send("2/15 - Application Under Review",
        v_svc.send_application_under_review_email, TARGET_EMAIL, TEST_USERNAME)
    results.append(('Application Under Review', ok))

    # 3
    ok = safe_send("3/15 - Account Activated",
        v_svc.send_account_activated_email, TARGET_EMAIL, TEST_USERNAME)
    results.append(('Account Activated', ok))

    # 4
    ok = safe_send("4/15 - Password Reset",
        v_svc.send_password_reset_email, TARGET_EMAIL, 'test-reset-token-xyz', TEST_USERNAME)
    results.append(('Password Reset', ok))

    # 5
    ok = safe_send("5/15 - Placement Created",
        v_svc.send_placement_created_email, TARGET_EMAIL, TEST_USERNAME, 'My Test Placement', 'PL-12345')
    results.append(('Placement Created', ok))

    # 6
    ok = safe_send("6/15 - Advertiser Registration",
        v_svc.send_advertiser_confirmation_email, TARGET_EMAIL, 'TestAdvertiser', 'TestCorp')
    results.append(('Advertiser Registration', ok))

    # 7
    ok = safe_send("7/15 - Advertiser Under Review",
        v_svc.send_advertiser_under_review_email, TARGET_EMAIL, 'TestAdvertiser', 'TestCorp')
    results.append(('Advertiser Under Review', ok))

    # 8
    ok = safe_send("8/15 - Advertiser Activated",
        v_svc.send_advertiser_account_activated_email, TARGET_EMAIL, 'TestAdvertiser', 'TestCorp')
    results.append(('Advertiser Activated', ok))

    # ============================================================
    # GROUP 2: EmailService emails (styled templates)
    # ============================================================
    logger.info("\n" + "=" * 60)
    logger.info("GROUP 2: Email Service Emails (Styled Templates)")
    logger.info("=" * 60)

    from services.email_service import EmailService
    e_svc = EmailService()
    logger.info(f"  Email service configured: {e_svc.is_configured}")

    # 9
    ok = safe_send("9/15 - Offer Approved",
        e_svc.send_approval_notification,
        TARGET_EMAIL, 'Binance WW - Crypto Trading App', 'approved',
        '', 'ML-1234567', 'offer')
    results.append(('Offer Approved', ok))

    # 10
    ok = safe_send("10/15 - Offer Rejected",
        e_svc.send_approval_notification,
        TARGET_EMAIL, 'SomeOffer - Mobile App Install', 'rejected',
        'Does not meet quality standards', 'ML-9999999', 'offer')
    results.append(('Offer Rejected', ok))

    # 11
    ok = safe_send("11/15 - Placement Approved",
        e_svc.send_approval_notification,
        TARGET_EMAIL, 'My Website Banner Placement', 'approved',
        '', 'PL-55555', 'placement')
    results.append(('Placement Approved', ok))

    # 12
    ok = safe_send("12/15 - Placement Rejected",
        e_svc.send_approval_notification,
        TARGET_EMAIL, 'My Blog Sidebar Placement', 'rejected',
        'Traffic source not allowed', 'PL-66666', 'placement')
    results.append(('Placement Rejected', ok))

    # 13
    sample_offer = {
        'name': 'NordVPN - Premium VPN Service',
        'offer_id': 'ML-7777777',
        'payout': 12.50,
        'currency': 'USD',
        'category': 'VPN',
        'countries': ['US', 'UK', 'CA', 'DE'],
        'description': 'Promote NordVPN premium subscription. High converting offer.',
        'network': 'MaxBounty',
    }
    ok = safe_send("13/15 - New Offer Notification",
        e_svc.send_new_offer_notification, sample_offer, [TARGET_EMAIL])
    results.append(('New Offer Notification', ok))

    # 14
    batch_offers = [
        {'name': 'ExpressVPN', 'offer_id': 'ML-1001', 'payout': 15.00, 'currency': 'USD',
         'category': 'VPN', 'countries': ['US', 'UK'], 'description': 'Top VPN', 'network': 'CJ'},
        {'name': 'Coinbase', 'offer_id': 'ML-1003', 'payout': 25.00, 'currency': 'USD',
         'category': 'FINANCE', 'countries': ['US'], 'description': 'Crypto exchange', 'network': 'Partnerize'},
    ]
    ok = safe_send("14/15 - Batch Offers Notification",
        e_svc.send_batch_new_offers_notification, batch_offers, [TARGET_EMAIL])
    results.append(('Batch Offers Notification', ok))

    # 15
    ok = safe_send("15/15 - Promo Code Assigned",
        e_svc.send_promo_code_assigned_to_offer,
        TARGET_EMAIL, 'NordVPN - Premium VPN Service',
        'NORD50OFF', 5.0, 'fixed', 'ML-7777777')
    results.append(('Promo Code Assigned', ok))

    # ============================================================
    # RESULTS
    # ============================================================
    logger.info("\n" + "=" * 60)
    logger.info("RESULTS SUMMARY")
    logger.info("=" * 60)

    success = 0
    failed = 0
    for name, ok in results:
        status = "✅" if ok else "❌"
        logger.info(f"  {status}  {name}")
        if ok:
            success += 1
        else:
            failed += 1

    logger.info(f"\n{success} sent, {failed} failed out of {len(results)}")
    logger.info(f"All emails sent to: {TARGET_EMAIL}")
    if failed > 0:
        logger.info("Check spam folder — Gmail may have grouped or filtered some.")


if __name__ == '__main__':
    logger.info(f"🚀 Sending all 15 email types to {TARGET_EMAIL}")
    logger.info(f"SMTP: {os.getenv('SMTP_HOST')}:{os.getenv('SMTP_PORT')}")
    logger.info(f"From: {os.getenv('FROM_EMAIL')}")
    logger.info(f"Delay between emails: {DELAY}s")
    logger.info("")
    send_all_emails()
