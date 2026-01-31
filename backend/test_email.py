#!/usr/bin/env python3
"""
Email Configuration Test Script - Hostinger SMTP
Run this to test if your SMTP settings are working correctly.

Usage:
    python test_email.py [recipient_email]
    
If no recipient email is provided, it will just test the connection.
"""

import os
import sys
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_email_config():
    """Test Hostinger SMTP configuration"""
    
    smtp_host = os.getenv('SMTP_HOST', 'smtp.hostinger.com')
    smtp_port = int(os.getenv('SMTP_PORT', '465'))
    smtp_user = os.getenv('SMTP_USER')
    smtp_pass = os.getenv('SMTP_PASS')
    from_email = os.getenv('FROM_EMAIL', smtp_user)
    
    print("=" * 60)
    print("HOSTINGER EMAIL CONFIGURATION TEST")
    print("=" * 60)
    print(f"\nSMTP Host: {smtp_host}")
    print(f"SMTP Port: {smtp_port}")
    print(f"SMTP User: {smtp_user}")
    print(f"SMTP Pass: {'*' * len(smtp_pass) if smtp_pass else 'NOT SET'}")
    print(f"From Email: {from_email}")
    print()
    
    if not all([smtp_host, smtp_user, smtp_pass, from_email]):
        print("ERROR: Missing required email configuration!")
        print("   Please check your .env file has:")
        print("   - SMTP_HOST")
        print("   - SMTP_PORT")
        print("   - SMTP_USER")
        print("   - SMTP_PASS")
        print("   - FROM_EMAIL")
        return False
    
    # Test SSL connection on port 465 (Hostinger standard)
    print("\nTesting Hostinger SMTP SSL connection on port 465...")
    try:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(smtp_host, smtp_port, context=context, timeout=30) as server:
            server.login(smtp_user, smtp_pass)
            print("SUCCESS! SSL connection to Hostinger SMTP works.")
            return True
    except Exception as e:
        print(f"FAILED: {str(e)}")
    
    print("\n" + "=" * 60)
    print("CONNECTION FAILED!")
    print("=" * 60)
    print("\nPossible solutions:")
    print("1. Verify your Hostinger email credentials")
    print("2. Check that the email account exists in Hostinger")
    print("3. Ensure DNS (MX, SPF, DKIM) is properly configured")
    print("4. Try logging into webmail at mail.hostinger.com")
    print()
    return False


def send_test_email(recipient):
    """Send a test email via Hostinger SMTP"""
    
    smtp_host = os.getenv('SMTP_HOST', 'smtp.hostinger.com')
    smtp_port = int(os.getenv('SMTP_PORT', '465'))
    smtp_user = os.getenv('SMTP_USER')
    smtp_pass = os.getenv('SMTP_PASS')
    from_email = os.getenv('FROM_EMAIL', smtp_user)
    
    print(f"\nSending test email to: {recipient}")
    
    # Create message
    msg = MIMEMultipart('alternative')
    msg['Subject'] = "MustacheLeads Email Test"
    msg['From'] = from_email
    msg['To'] = recipient
    
    html_content = """
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h1 style="color: #6366f1;">Email Test Successful!</h1>
        <p>If you're reading this, your Hostinger email configuration is working correctly.</p>
        <p style="color: #666;">This is a test email from MustacheLeads.</p>
    </body>
    </html>
    """
    
    html_part = MIMEText(html_content, 'html')
    msg.attach(html_part)
    
    # Send via SSL on port 465
    try:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(smtp_host, smtp_port, context=context, timeout=30) as server:
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        print(f"Test email sent successfully to {recipient}!")
        return True
    except Exception as e:
        print(f"Failed to send test email: {str(e)}")
        return False


if __name__ == "__main__":
    # Test configuration first
    config_ok = test_email_config()
    
    # If a recipient email was provided and config is OK, send test email
    if len(sys.argv) > 1 and config_ok:
        recipient = sys.argv[1]
        send_test_email(recipient)
    elif len(sys.argv) > 1:
        print("\nCannot send test email - configuration test failed first.")
    else:
        print("\nTip: Run with an email address to send a test email:")
        print("   python test_email.py your@email.com")
