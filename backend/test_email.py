import smtplib
from email.mime.text import MimeText
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_email():
    print("🧪 Testing Email Configuration...")
    
    # Get email settings
    smtp_server = os.getenv('SMTP_SERVER')
    smtp_port = int(os.getenv('SMTP_PORT', '587'))
    smtp_username = os.getenv('SMTP_USERNAME')
    smtp_password = os.getenv('SMTP_PASSWORD')
    from_email = os.getenv('FROM_EMAIL')
    
    print(f"📧 SMTP Server: {smtp_server}:{smtp_port}")
    print(f"📧 Username: {smtp_username}")
    print(f"📧 From Email: {from_email}")
    print(f"📧 Password: {'*' * len(smtp_password) if smtp_password else 'NOT SET'}")
    
    if not smtp_username or not smtp_password:
        print("❌ SMTP credentials not configured!")
        return False
    
    try:
        # Create test message
        msg = MimeText("This is a test email from Ascend system.")
        msg['Subject'] = "🧪 Ascend Email Test"
        msg['From'] = from_email
        msg['To'] = smtp_username  # Send to yourself
        
        # Send email
        print("📤 Sending test email...")
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(smtp_username, smtp_password)
            server.send_message(msg)
        
        print("✅ Test email sent successfully!")
        print(f"📬 Check your inbox: {smtp_username}")
        return True
        
    except Exception as e:
        print(f"❌ Email test failed: {str(e)}")
        return False

if __name__ == "__main__":
    test_email()
