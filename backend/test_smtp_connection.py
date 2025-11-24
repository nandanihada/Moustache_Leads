"""
Test SMTP connection and email sending
Run this to verify Gmail SMTP is working correctly
"""

import smtplib
import os
from dotenv import load_dotenv
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Load environment variables
load_dotenv()

def test_smtp_connection():
    """Test SMTP connection"""
    
    print("=" * 70)
    print("🧪 SMTP CONNECTION TEST")
    print("=" * 70)
    
    # Get SMTP settings
    smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
    smtp_port = int(os.getenv('SMTP_PORT', '587'))
    smtp_username = os.getenv('SMTP_USERNAME')
    smtp_password = os.getenv('SMTP_PASSWORD')
    from_email = os.getenv('FROM_EMAIL')
    
    print(f"\n📧 SMTP Configuration:")
    print(f"   Server: {smtp_server}")
    print(f"   Port: {smtp_port}")
    print(f"   Username: {smtp_username}")
    print(f"   From Email: {from_email}")
    print(f"   Password: {'*' * len(smtp_password) if smtp_password else 'NOT SET'}")
    
    # Check if credentials are set
    if not smtp_username or not smtp_password:
        print("\n❌ ERROR: SMTP credentials not configured!")
        print("   Set SMTP_USERNAME and SMTP_PASSWORD in .env")
        return False
    
    # Check for spaces in password
    if ' ' in smtp_password:
        print("\n⚠️  WARNING: Password contains spaces!")
        print("   Gmail app passwords should NOT have spaces")
        print(f"   Current password: '{smtp_password}'")
        print("   Remove spaces and try again")
        return False
    
    # Test connection
    print(f"\n🔌 Attempting to connect to {smtp_server}:{smtp_port}...")
    
    try:
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            print("   ✅ Connected to SMTP server")
            
            print("   🔐 Starting TLS encryption...")
            server.starttls()
            print("   ✅ TLS encryption enabled")
            
            print("   🔑 Attempting to login...")
            server.login(smtp_username, smtp_password)
            print("   ✅ Login successful!")
        
        print("\n✅ SMTP CONNECTION TEST PASSED!")
        return True
        
    except smtplib.SMTPAuthenticationError as e:
        print(f"\n❌ AUTHENTICATION FAILED!")
        print(f"   Error: {str(e)}")
        print("\n   Troubleshooting:")
        print("   1. Verify Gmail 2-Factor Authentication is enabled")
        print("   2. Generate new App Password at https://myaccount.google.com/apppasswords")
        print("   3. Remove any spaces from the app password")
        print("   4. Update SMTP_PASSWORD in .env")
        print("   5. Restart the backend server")
        return False
        
    except smtplib.SMTPException as e:
        print(f"\n❌ SMTP ERROR!")
        print(f"   Error: {str(e)}")
        print("\n   Troubleshooting:")
        print("   1. Check SMTP_SERVER and SMTP_PORT are correct")
        print("   2. Verify firewall allows port 587")
        print("   3. Try port 465 (SSL) instead of 587 (TLS)")
        return False
        
    except Exception as e:
        print(f"\n❌ CONNECTION ERROR!")
        print(f"   Error: {str(e)}")
        return False


def test_email_sending():
    """Test sending an email"""
    
    print("\n" + "=" * 70)
    print("📧 EMAIL SENDING TEST")
    print("=" * 70)
    
    # Get SMTP settings
    smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
    smtp_port = int(os.getenv('SMTP_PORT', '587'))
    smtp_username = os.getenv('SMTP_USERNAME')
    smtp_password = os.getenv('SMTP_PASSWORD')
    from_email = os.getenv('FROM_EMAIL')
    
    if not smtp_username or not smtp_password:
        print("\n⚠️  Skipping email test - credentials not configured")
        return False
    
    # Send test email to yourself
    to_email = smtp_username
    
    print(f"\n📤 Sending test email to: {to_email}")
    
    try:
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = "🧪 SMTP Test Email"
        msg['From'] = from_email
        msg['To'] = to_email
        
        # Create HTML content
        html_content = """
        <html>
            <body style="font-family: Arial, sans-serif;">
                <h2>✅ SMTP Test Successful!</h2>
                <p>This is a test email from your Ascend system.</p>
                <p>If you received this email, your SMTP configuration is working correctly.</p>
                <hr>
                <p><strong>Email Details:</strong></p>
                <ul>
                    <li>From: """ + from_email + """</li>
                    <li>To: """ + to_email + """</li>
                    <li>Server: """ + smtp_server + """</li>
                    <li>Port: """ + str(smtp_port) + """</li>
                </ul>
            </body>
        </html>
        """
        
        # Attach HTML
        html_part = MIMEText(html_content, 'html')
        msg.attach(html_part)
        
        # Send email
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(smtp_username, smtp_password)
            server.send_message(msg)
        
        print("   ✅ Email sent successfully!")
        print(f"   📬 Check your inbox: {to_email}")
        return True
        
    except Exception as e:
        print(f"   ❌ Failed to send email: {str(e)}")
        return False


if __name__ == "__main__":
    print("\n🚀 Starting SMTP Tests\n")
    
    # Test 1: Connection
    connection_ok = test_smtp_connection()
    
    # Test 2: Email sending (only if connection works)
    if connection_ok:
        email_ok = test_email_sending()
    else:
        email_ok = False
    
    # Summary
    print("\n" + "=" * 70)
    print("📊 TEST SUMMARY")
    print("=" * 70)
    print(f"SMTP Connection: {'✅ PASSED' if connection_ok else '❌ FAILED'}")
    print(f"Email Sending: {'✅ PASSED' if email_ok else '⚠️  SKIPPED' if not connection_ok else '❌ FAILED'}")
    
    if connection_ok and email_ok:
        print("\n✅ ALL TESTS PASSED!")
        print("Email verification system is ready to use!")
    else:
        print("\n❌ TESTS FAILED!")
        print("Please fix the issues above and try again.")
    
    print("\n")
