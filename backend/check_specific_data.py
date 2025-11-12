"""
Check specific data for the columns shown in the screenshot
to understand why they're empty and how to populate them
"""

from pymongo import MongoClient
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

load_dotenv()

# Connect to MongoDB
mongo_uri = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
client = MongoClient(mongo_uri)
db = client['affiliate_system']

print("=" * 80)
print("🔍 ANALYZING WHY COLUMNS ARE EMPTY")
print("=" * 80)

# Get sample data
sample_click = db.clicks.find_one()
sample_offer = db.offers.find_one()
sample_conversion = db.conversions.find_one()

print("\n📊 CURRENT DATA STATUS:")
print("-" * 80)

# Check each column from the screenshot
columns_in_screenshot = [
    "Ad Group", "Goal", "Promo Code", "Creative", "Country", 
    "Browser", "Device", "Source", "Adv Sub 1"
]

print(f"\n🔍 ANALYZING COLUMNS FROM SCREENSHOT:")
print("-" * 80)

# 1. Ad Group, Goal, Promo Code - from offers collection
print("\n1️⃣ OFFER-BASED COLUMNS (Ad Group, Goal, Promo Code):")
if sample_offer:
    print(f"   Sample offer: {sample_offer.get('offer_id', 'N/A')}")
    print(f"   ✅ Name: {sample_offer.get('name', 'MISSING')}")
    print(f"   ❌ Ad Group: {sample_offer.get('ad_group', 'MISSING')}")
    print(f"   ❌ Goal: {sample_offer.get('goal', 'MISSING')}")
    print(f"   ❌ Promo Code: {sample_offer.get('promo_code', 'MISSING')}")
    print(f"   💡 SOLUTION: Add these fields to offers collection")
else:
    print("   ❌ No offers found in database")

# 2. Creative, Country, Browser, Device, Source, Adv Sub 1 - from clicks collection
print("\n2️⃣ CLICK-BASED COLUMNS (Creative, Country, Browser, Device, Source, Adv Sub 1):")
if sample_click:
    print(f"   Sample click: {sample_click.get('_id', 'N/A')}")
    print(f"   Country: {sample_click.get('country', 'MISSING')}")
    print(f"   Browser: {sample_click.get('browser', 'MISSING')}")
    print(f"   Device: {sample_click.get('device_type', 'MISSING')}")
    print(f"   Source: {sample_click.get('referer', 'MISSING')}")
    print(f"   Creative: {sample_click.get('creative', 'MISSING')}")
    print(f"   Adv Sub 1: {sample_click.get('advertiser_sub_id1', 'MISSING')}")
else:
    print("   ❌ No clicks found in database")

# Count how many records have each field
print("\n📈 FIELD POPULATION STATISTICS:")
print("-" * 80)

total_clicks = db.clicks.count_documents({})
total_offers = db.offers.count_documents({})

if total_clicks > 0:
    print(f"\n📊 CLICKS COLLECTION ({total_clicks} total):")
    
    # Check click fields
    click_fields = [
        ('country', 'Country'),
        ('browser', 'Browser'), 
        ('device_type', 'Device'),
        ('referer', 'Source'),
        ('creative', 'Creative'),
        ('advertiser_sub_id1', 'Adv Sub 1')
    ]
    
    for field, display_name in click_fields:
        count = db.clicks.count_documents({field: {"$exists": True, "$ne": None, "$ne": ""}})
        percentage = (count / total_clicks) * 100
        if count > 0:
            print(f"   ✅ {display_name}: {count}/{total_clicks} ({percentage:.1f}%)")
        else:
            print(f"   ❌ {display_name}: 0/{total_clicks} (0%) - EMPTY")

if total_offers > 0:
    print(f"\n📊 OFFERS COLLECTION ({total_offers} total):")
    
    # Check offer fields
    offer_fields = [
        ('ad_group', 'Ad Group'),
        ('goal', 'Goal'),
        ('promo_code', 'Promo Code')
    ]
    
    for field, display_name in offer_fields:
        count = db.offers.count_documents({field: {"$exists": True, "$ne": None, "$ne": ""}})
        percentage = (count / total_offers) * 100
        if count > 0:
            print(f"   ✅ {display_name}: {count}/{total_offers} ({percentage:.1f}%)")
        else:
            print(f"   ❌ {display_name}: 0/{total_offers} (0%) - EMPTY")

print("\n" + "=" * 80)
print("💡 HOW TO FIX EACH EMPTY COLUMN:")
print("=" * 80)

print("\n🔧 FOR OFFER-BASED COLUMNS:")
print("   Run this MongoDB command:")
print("   ```")
print("   db.offers.updateMany({}, {")
print("     $set: {")
print("       'ad_group': 'Premium Offers',")
print("       'goal': 'Lead Generation',")
print("       'promo_code': 'SAVE20'")
print("     }")
print("   })")
print("   ```")

print("\n🔧 FOR CLICK-BASED COLUMNS:")
print("   Update your tracking code to capture:")
print("   - Country: Auto-detected from IP (should work)")
print("   - Browser: Auto-detected from User-Agent (should work)")
print("   - Device: Auto-detected from User-Agent (should work)")
print("   - Source: Auto-captured from HTTP Referer (should work)")
print("   - Creative: Pass in tracking URL (?creative=banner_001)")
print("   - Adv Sub 1: Pass in tracking URL (?advertiser_sub_id1=campaign_123)")

print("\n🎯 PRIORITY ORDER:")
print("   1. Fix Country/Browser/Device/Source (should work automatically)")
print("   2. Add Ad Group/Goal/Promo Code to offers (easy database update)")
print("   3. Add Creative/Adv Sub tracking to URLs (requires tracking update)")

client.close()
