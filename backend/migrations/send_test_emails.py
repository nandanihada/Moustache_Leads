"""
Send test emails for:
1. New offer creation notification
2. Offer approval notification (redesigned)
3. Placement approval notification (redesigned)

Usage: python migrations/send_test_emails.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

from services.email_service import EmailService

TARGET = '[email protected]'

def main():
    svc = EmailService()
    if not svc.is_configured:
        print('Email service not configured. Check .env SMTP settings.')
        return

    # 1. New offer creation email (using shared template)
    print('1/3 — Sending new offer creation email...')
    offer_data = {
        'name': 'Binance WW - Crypto Trading App',
        'payout': 25.00,
        'category': 'FINANCE',
        'network': 'ADWhapper',
        'countries': ['US', 'CA', 'GB', 'AU', 'DE'],
        'image_url': 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=600&h=300&fit=crop',
    }
    result = svc.send_new_offer_notification(
        offer_data=offer_data,
        recipients=[TARGET],
        template_settings={
            'template_style': 'card',
            'visible_fields': ['name', 'payout', 'countries', 'category', 'image'],
            'payout_type': 'publisher',
            'subject': 'New Offer: Binance WW - Push More Traffic!',
            'message': 'We just added a high-converting finance offer. Start promoting now!',
        }
    )
    print(f'   Result: {result}')

    # 2. Offer approval email (redesigned with details)
    print('2/3 — Sending offer approval email...')
    ok = svc.send_approval_notification(
        recipient_email=TARGET,
        offer_name='Binance WW - Crypto Trading App',
        status='approved',
        reason='',
        offer_id='ML-1234567',
        notification_type='offer',
        extra_data={
            'payout': '25.00',
            'category': 'FINANCE',
            'network': 'ADWhapper',
            'countries': 'US, CA, GB, AU, DE',
        }
    )
    print(f'   Result: {ok}')

    # 3. Placement approval email (redesigned)
    print('3/3 — Sending placement approval email...')
    ok2 = svc.send_approval_notification(
        recipient_email=TARGET,
        offer_name='My Website Banner - Top Sidebar',
        status='approved',
        reason='',
        offer_id='',
        notification_type='placement',
    )
    print(f'   Result: {ok2}')

    print('\nDone! Check your inbox.')

if __name__ == '__main__':
    main()
