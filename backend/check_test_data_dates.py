"""
Check what dates our test data has
"""

from pymongo import MongoClient
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

client = MongoClient(os.getenv('MONGO_URI', 'mongodb://localhost:27017/'))
db = client['affiliate_system']

print("🔍 Checking Test Data Dates...")
print("=" * 50)

# Check clicks
clicks = list(db.clicks.find({}, {'click_time': 1, 'offer_id': 1, 'country': 1, 'browser': 1}).limit(5))
print(f"📊 Sample clicks ({len(clicks)}):")
for click in clicks:
    print(f"  Date: {click.get('click_time')}")
    print(f"  Offer: {click.get('offer_id')}")
    print(f"  Country: {click.get('country')}")
    print(f"  Browser: {click.get('browser')}")
    print("  ---")

# Get date range of all clicks
if clicks:
    all_dates = [c['click_time'] for c in db.clicks.find({}, {'click_time': 1})]
    min_date = min(all_dates)
    max_date = max(all_dates)
    print(f"📅 Date range in database:")
    print(f"  From: {min_date}")
    print(f"  To: {max_date}")
    
    # Test with the actual date range
    print(f"\n🔍 Testing with actual date range...")
    
    import sys
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    from models.user_reports import UserReports
    
    user_reports = UserReports()
    
    # Use the actual date range from our data
    date_range = {
        'start': min_date,
        'end': max_date
    }
    
    report = user_reports.get_performance_report(
        user_id='test-user',
        date_range=date_range,
        group_by=['date', 'offer_id']
    )
    
    data = report.get('data', [])
    print(f"✅ Report with correct dates: {len(data)} rows")
    
    if data:
        sample = data[0]
        print(f"\n🎯 SCREENSHOT COLUMNS STATUS:")
        screenshot_columns = {
            'ad_group': 'Ad Group',
            'goal': 'Goal', 
            'promo_code': 'Promo Code',
            'creative': 'Creative',
            'country': 'Country',
            'browser': 'Browser',
            'device_type': 'Device',
            'source': 'Source',
            'advertiser_sub_id1': 'Adv Sub 1'
        }
        
        for field, display_name in screenshot_columns.items():
            value = sample.get(field, 'MISSING')
            if value and value != 'MISSING' and value != '' and value != '-' and value is not None:
                print(f"  ✅ {display_name}: '{value}'")
            else:
                print(f"  ❌ {display_name}: EMPTY")

client.close()
