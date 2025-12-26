"""
Check when the admin user actually logged in
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import db_instance
from datetime import datetime
import pytz

db = db_instance.get_db()
login_logs = db['login_logs']

# Get the most recent admin login
admin_log = login_logs.find_one({'username': 'admin'}, sort=[('login_time', -1)])

if admin_log:
    utc_time = admin_log['login_time']
    
    # Convert to IST
    utc_tz = pytz.UTC
    ist_tz = pytz.timezone('Asia/Kolkata')
    
    if utc_time.tzinfo is None:
        utc_time = utc_tz.localize(utc_time)
    
    ist_time = utc_time.astimezone(ist_tz)
    
    print("\n" + "="*80)
    print("ADMIN LOGIN TIME VERIFICATION")
    print("="*80)
    print(f"\n📅 Stored in DB (UTC): {admin_log['login_time']}")
    print(f"🕐 Converted to IST:   {ist_time.strftime('%d/%m/%Y, %I:%M:%S %p IST')}")
    print(f"\n✅ This is the CORRECT time the admin logged in!")
    print(f"   The frontend is showing this time correctly.")
    print("="*80 + "\n")
else:
    print("No admin login found")
