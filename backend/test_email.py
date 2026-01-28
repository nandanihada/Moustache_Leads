#!/usr/bin/env python3
"""
Email Configuration Test Script
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
    """Test email configuration"""
    
    smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
    smtp_port = int(os.getenv('SMTP_PORT', '587'))
    smtp_username = os.getenv('SMTP_USERNAME')
    smtp_password = os.getenv('SMTP_PASSWORD')
    from_email = os.getenv('FROM_EMAIL')
    
    print("=" * 60)
    print("EMAIL CONFIGURATION TEST")
    print("=" * 60)
    print(f"\nSMTP Server: {smtp_server}")
    print(f"SMTP Port: {smtp_port}")
    print(f"Username: {smtp_username}")
    print(f"Password: {'*' * len(smtp_password) if smtp_password else 'NOT SET'}")
    print(f"From Email: {from_email}")
    print()
    
    if not all([smtp_username, smtp_password, from_email]):
        print("❌ ERROR: Missing required email configuration!")
        print("   Please check your .env file has:")
        print("   - SMTP_USERNAME")
        print("   - SMTP_PASSWORD")
        print("   - FROM_EMAIL")
        return False
    
    # Test Method 1: TLS on port 587
    print("\n📧 Testing Method 1: TLS on port 587...")
    try:
        with smtplib.SMTP(smtp_server, 587, timeout=30) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_username, smtp_password)
            print("✅ Method 1 SUCCESS! TLS connection works.")
            return True
    except Exception as e:
        print(f"❌ Method 1 FAILED: {str(e)}")
    
    # Test Method 2: SSL on port 465
    print("\n📧 Testing Method 2: SSL on port 465...")
    try:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(smtp_server, 465, context=context, timeout=30) as server:
            server.login(smtp_username, smtp_password)
            print("✅ Method 2 SUCCESS! SSL connection works.")
            return True
    except Exception as e:
        print(f"❌ Method 2 FAILED: {str(e)}")
    
    # Test Method 3: Relaxed SSL
    print("\n📧 Testing Method 3: Relaxed SSL...")
    try:
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        with smtplib.SMTP_SSL(smtp_server, 465, context=context, timeout=30) as server:
            server.login(smtp_username, smtp_password)
            print("✅ Method 3 SUCCESS! Relaxed SSL connection works.")
            return True
    except Exception as e:
        print(f"❌ Method 3 FAILED: {str(e)}")
    
    print("\n" + "=" * 60)
    print("❌ ALL METHODS FAILED!")
    print("=" * 60)
    print("\nPossible solutions:")
    print("1. For Gmail:")
    print("   - Enable 2-Factor Authentication")
    print("   - Generate a NEW App Password at:")
    print("     https://myaccount.google.com/apppasswords")
    print("   - Use the 16-character password (no spaces)")
    print()
    print("2. Try an alternative SMTP provider:")
    print("   - Brevo (free): smtp-relay.brevo.com")
    print("   - SendGrid (free tier): smtp.sendgrid.net")
    print("   - Mailgun (free tier): smtp.mailgun.org")
    print()
    return False


def send_test_email(recipient):
    """Send a test email"""
    
    smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
    smtp_username = os.getenv('SMTP_USERNAME')
    smtp_password = os.getenv('SMTP_PASSWORD')
    from_email = os.getenv('FROM_EMAIL')
    
    print(f"\n📧 Sending test email to: {recipient}")
    
    # Create message
    msg = MIMEMultipart('alternative')
    msg['Subject'] = "🧪 MustacheLeads Email Test"
    msg['From'] = from_email
    msg['To'] = recipient
    
    html_content = """
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h1 style="color: #6366f1;">✅ Email Test Successful!</h1>
        <p>If you're reading this, your email configuration is working correctly.</p>
        <p style="color: #666;">This is a test email from MustacheLeads.</p>
    </body>
    </html>
    """
    
    html_part = MIMEText(html_content, 'html')
    msg.attach(html_part)
    
    # Try to send
    try:
        with smtplib.SMTP(smtp_server, 587, timeout=30) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_username, smtp_password)
            server.send_message(msg)
        print(f"✅ Test email sent successfully to {recipient}!")
        return True
    except Exception as e:
        print(f"❌ Failed to send test email: {str(e)}")
        
        # Try SSL method
        try:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(smtp_server, 465, context=context, timeout=30) as server:
                server.login(smtp_username, smtp_password)
                server.send_message(msg)
            print(f"✅ Test email sent successfully via SSL to {recipient}!")
            return True
        except Exception as e2:
            print(f"❌ SSL method also failed: {str(e2)}")
            return False


if __name__ == "__main__":
    # Test configuration first
    config_ok = test_email_config()
    
    # If a recipient email was provided and config is OK, send test email
    if len(sys.argv) > 1 and config_ok:
        recipient = sys.argv[1]
        send_test_email(recipient)
    elif len(sys.argv) > 1:
        print("\n⚠️ Cannot send test email - configuration test failed first.")
    else:
        print("\n💡 Tip: Run with an email address to send a test email:")
        print("   python test_email.py your@email.com")
