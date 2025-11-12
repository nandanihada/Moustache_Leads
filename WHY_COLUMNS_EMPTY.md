"""
Populate sample data to test all Performance Report columns
This will create realistic test data so you can see all fields working
"""

from pymongo import MongoClient
from datetime import datetime, timedelta
import random
import os
from dotenv import load_dotenv

load_dotenv()

# Connect to MongoDB
mongo_uri = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
client = MongoClient(mongo_uri)
db = client['affiliate_system']

print("🚀 POPULATING SAMPLE DATA FOR ALL COLUMNS")
print("=" * 80)

# Clear existing data (optional - comment out if you want to keep existing data)
print("🧹 Clearing existing data...")
db.clicks.delete_many({})
db.offers.delete_many({})
db.conversions.delete_many({})

# 1. Create Sample Offers with ALL fields
print("\n📝 Creating sample offers...")
offers = [
    {
        "offer_id": "ML-00057",
        "name": "Premium Survey Offer",
        "url": "https://partner.com/survey/premium",
        "category": "Survey",
        "currency": "USD",
        "ad_group": "Premium Offers",
        "goal": "Lead Generation",
        "promo_code": "SAVE20",
        "network": "SurveyNetwork",
        "payout": 2.50
    },
    {
        "offer_id": "ML-00058", 
        "name": "Mobile App Install",
        "url": "https://partner.com/app/install",
        "category": "Mobile App",
        "currency": "USD",
        "ad_group": "Mobile Campaigns",
        "goal": "App Installs",
        "promo_code": "MOBILE10",
        "network": "AppNetwork",
        "payout": 1.75
    },
    {
        "offer_id": "ML-00059",
        "name": "Financial Survey",
        "url": "https://partner.com/finance/survey",
        "category": "Finance",
        "currency": "EUR",
        "ad_group": "Finance Vertical",
        "goal": "Qualified Leads",
        "promo_code": "FINANCE25",
        "network": "FinanceNetwork", 
        "payout": 3.00
    }
]

db.offers.insert_many(offers)
print(f"   ✅ Created {len(offers)} offers with ALL fields")

# 2. Create Sample Clicks with ALL fields
print("\n🖱️ Creating sample clicks...")
browsers = ["Chrome", "Firefox", "Safari", "Edge", "Opera"]
devices = ["Desktop", "Mobile", "Tablet"]
countries = ["US", "UK", "CA", "AU", "DE", "FR", "IT", "ES"]
sources = [
    "https://google.com/search",
    "https://facebook.com/ads",
    "https://twitter.com/promoted",
    "https://youtube.com/video",
    "https://instagram.com/story",
    "direct"
]
creatives = ["banner_001", "banner_002", "video_001", "native_001", "popup_001"]

clicks = []
for i in range(100):
    click_time = datetime.utcnow() - timedelta(days=random.randint(0, 7), 
                                             hours=random.randint(0, 23),
                                             minutes=random.randint(0, 59))
    
    click = {
        "offer_id": random.choice([o["offer_id"] for o in offers]),
        "user_id": f"pub{random.randint(1, 10)}",
        "click_time": click_time,
        "ip_address": f"192.168.{random.randint(1, 255)}.{random.randint(1, 255)}",
        "user_agent": f"Mozilla/5.0 (compatible; TestBot/1.0)",
        
        # Auto-captured fields (should work automatically)
        "country": random.choice(countries),
        "browser": random.choice(browsers),
        "device_type": random.choice(devices),
        "referer": random.choice(sources),
        
        # Tracking flags
        "is_unique": random.random() > 0.3,  # 70% unique
        "is_suspicious": random.random() < 0.05,  # 5% suspicious
        "is_rejected": random.random() < 0.02,  # 2% rejected
        
        # Sub IDs (from tracking URLs)
        "sub_id1": f"sub{random.randint(1, 100)}",
        "sub_id2": f"camp{random.randint(1, 20)}",
        "sub_id3": f"place{random.randint(1, 50)}",
        "sub_id4": f"src{random.randint(1, 10)}",
        "sub_id5": f"kw{random.randint(1, 200)}",
        
        # New fields (need to add to tracking)
        "creative": random.choice(creatives),
        "app_version": f"1.{random.randint(0, 9)}.{random.randint(0, 9)}",
        "advertiser_sub_id1": f"adv_camp_{random.randint(100, 999)}",
        "advertiser_sub_id2": f"adv_place_{random.randint(100, 999)}",
        "advertiser_sub_id3": f"adv_creative_{random.randint(100, 999)}",
        "advertiser_sub_id4": f"adv_keyword_{random.randint(100, 999)}",
        "advertiser_sub_id5": f"adv_audience_{random.randint(100, 999)}",
        
        "created_at": click_time
    }
    clicks.append(click)

db.clicks.insert_many(clicks)
print(f"   ✅ Created {len(clicks)} clicks with ALL fields")

# 3. Create Sample Conversions
print("\n💰 Creating sample conversions...")
conversions = []
conversion_clicks = random.sample(clicks, 25)  # 25% conversion rate

for click in conversion_clicks:
    conversion_time = click["click_time"] + timedelta(minutes=random.randint(1, 120))
    offer = next(o for o in offers if o["offer_id"] == click["offer_id"])
    
    conversion = {
        "offer_id": click["offer_id"],
        "click_id": str(click.get("_id", "test_click")),
        "user_id": click["user_id"],
        "transaction_id": f"TXN{random.randint(100000, 999999)}",
        "conversion_time": conversion_time,
        "payout": offer["payout"] + random.uniform(-0.5, 0.5),  # Slight variation
        "status": random.choice(["approved", "approved", "approved", "pending", "rejected"]),  # 60% approved
        "currency": offer["currency"],
        
        # Copy relevant fields from click
        "country": click["country"],
        "browser": click["browser"],
        "device_type": click["device_type"],
        "source": click["referer"],
        "creative": click["creative"],
        "app_version": click["app_version"],
        "sub_id1": click["sub_id1"],
        "sub_id2": click["sub_id2"],
        "sub_id3": click["sub_id3"],
        
        "created_at": conversion_time
    }
    conversions.append(conversion)

db.conversions.insert_many(conversions)
print(f"   ✅ Created {len(conversions)} conversions")

# 4. Summary
print("\n" + "=" * 80)
print("✅ SAMPLE DATA CREATED SUCCESSFULLY!")
print("=" * 80)

print(f"\n📊 SUMMARY:")
print(f"   • {len(offers)} offers (with ad_group, goal, promo_code)")
print(f"   • {len(clicks)} clicks (with country, browser, device, source, creative, adv_sub_ids)")
print(f"   • {len(conversions)} conversions")

print(f"\n🎯 ALL COLUMNS WILL NOW SHOW DATA:")
print(f"   ✅ Ad Group, Goal, Promo Code")
print(f"   ✅ Creative, Country, Browser, Device, Source")
print(f"   ✅ Advertiser Sub ID 1-5")
print(f"   ✅ All statistics and calculations")

print(f"\n🚀 NEXT STEPS:")
print(f"   1. Refresh your Performance Report")
print(f"   2. Click 'Columns' and select the columns you want to see")
print(f"   3. All fields should now show real data!")

print(f"\n💡 TO REMOVE TEST DATA LATER:")
print(f"   Run: db.clicks.deleteMany({}); db.offers.deleteMany({}); db.conversions.deleteMany({});")

client.close()
