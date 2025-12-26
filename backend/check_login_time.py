"""
Check the actual login times in the database and verify IST conversion
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import db_instance
from datetime import datetime
import pytz

db = db_instance.get_db()
login_logs = db['login_logs']

# Get the most recent login log
recent_log = login_logs.find_one(sort=[('login_time', -1)])

if recent_log:
    print("\n" + "="*80)
    print("CHECKING TIMEZONE CONVERSION")
    print("="*80 + "\n")
    
    login_time_utc = recent_log['login_time']
    print(f"📅 Login Time (stored in DB as UTC):")
    print(f"   Raw value: {login_time_utc}")
    print(f"   Type: {type(login_time_utc)}")
    
    # Convert to IST
    utc_tz = pytz.UTC
    ist_tz = pytz.timezone('Asia/Kolkata')
    
    # If it's a naive datetime, assume it's UTC
    if login_time_utc.tzinfo is None:
        login_time_utc = utc_tz.localize(login_time_utc)
    
    login_time_ist = login_time_utc.astimezone(ist_tz)
    
    print(f"\n🕐 Converted to IST:")
    print(f"   IST time: {login_time_ist.strftime('%d/%m/%Y, %I:%M:%S %p IST')}")
    
    print(f"\n🕐 Current Time:")
    current_utc = datetime.now(utc_tz)
    current_ist = current_utc.astimezone(ist_tz)
    print(f"   Current IST: {current_ist.strftime('%d/%m/%Y, %I:%M:%S %p IST')}")
    
    print(f"\n📊 Time Difference:")
    diff = current_ist - login_time_ist
    print(f"   Login was {diff} ago")
    
    print(f"\n👤 User Info:")
    print(f"   Username: {recent_log.get('username', 'N/A')}")
    print(f"   Email: {recent_log.get('email', 'N/A')}")
    print(f"   IP: {recent_log.get('ip_address', 'N/A')}")
    
else:
    print("No login logs found in database")
