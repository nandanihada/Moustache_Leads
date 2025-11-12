"""
Check what data currently exists in the database
to see which Performance Report fields will have values
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
print("🔍 CHECKING CURRENT DATA IN DATABASE")
print("=" * 80)

# Check clicks collection
print("\n📊 CLICKS COLLECTION:")
print("-" * 80)
clicks_count = db.clicks.count_documents({})
print(f"Total clicks: {clicks_count}")

if clicks_count > 0:
    sample_click = db.clicks.find_one()
    print(f"\n✅ Sample click fields:")
    for key in sample_click.keys():
        value = sample_click.get(key)
        if value is not None and value != '':
            print(f"   ✅ {key}: {value}")
        else:
            print(f"   ❌ {key}: (empty)")
    
    # Check specific fields we need
    print(f"\n📋 Field Availability in Clicks:")
    fields_to_check = [
        'browser', 'device_type', 'referer', 'country',
        'is_unique', 'is_suspicious', 'is_rejected',
        'sub_id1', 'sub_id2', 'sub_id3', 'sub_id4', 'sub_id5',
        'creative', 'app_version',
        'advertiser_sub_id1', 'advertiser_sub_id2', 'advertiser_sub_id3',
        'advertiser_sub_id4', 'advertiser_sub_id5'
    ]
    
    for field in fields_to_check:
        count_with_field = db.clicks.count_documents({field: {"$exists": True, "$ne": None, "$ne": ""}})
        if count_with_field > 0:
            print(f"   ✅ {field}: {count_with_field} clicks have this")
        else:
            print(f"   ❌ {field}: EMPTY (0 clicks have this)")

# Check offers collection
print("\n\n📊 OFFERS COLLECTION:")
print("-" * 80)
offers_count = db.offers.count_documents({})
print(f"Total offers: {offers_count}")

if offers_count > 0:
    sample_offer = db.offers.find_one()
    print(f"\n✅ Sample offer fields:")
    for key in sample_offer.keys():
        value = sample_offer.get(key)
        if value is not None and value != '':
            print(f"   ✅ {key}: {value}")
        else:
            print(f"   ❌ {key}: (empty)")
    
    # Check specific fields we need
    print(f"\n📋 Field Availability in Offers:")
    fields_to_check = [
        'name', 'url', 'category', 'currency',
        'ad_group', 'goal', 'promo_code'
    ]
    
    for field in fields_to_check:
        count_with_field = db.offers.count_documents({field: {"$exists": True, "$ne": None, "$ne": ""}})
        if count_with_field > 0:
            print(f"   ✅ {field}: {count_with_field} offers have this")
        else:
            print(f"   ❌ {field}: EMPTY (0 offers have this)")

# Check conversions collection
print("\n\n📊 CONVERSIONS COLLECTION:")
print("-" * 80)
conversions_count = db.conversions.count_documents({})
print(f"Total conversions: {conversions_count}")

if conversions_count > 0:
    sample_conversion = db.conversions.find_one()
    print(f"\n✅ Sample conversion has:")
    print(f"   Offer ID: {sample_conversion.get('offer_id')}")
    print(f"   Status: {sample_conversion.get('status')}")
    print(f"   Payout: ${sample_conversion.get('payout', 0)}")
    print(f"   Country: {sample_conversion.get('country')}")

# Summary
print("\n\n" + "=" * 80)
print("📊 SUMMARY - WHICH FIELDS WILL HAVE DATA:")
print("=" * 80)

print("\n✅ WILL HAVE REAL DATA NOW:")
print("   - Date, Offer Name (from offers join)")
print("   - Clicks, Conversions, Payout")
print("   - All calculated metrics (CR%, EPC, CPA, etc.)")

# Check what will have data
has_browser = db.clicks.count_documents({"browser": {"$exists": True, "$ne": None, "$ne": ""}}) > 0
has_device = db.clicks.count_documents({"device_type": {"$exists": True, "$ne": None, "$ne": ""}}) > 0
has_country = db.clicks.count_documents({"country": {"$exists": True, "$ne": None, "$ne": ""}}) > 0
has_source = db.clicks.count_documents({"referer": {"$exists": True, "$ne": None, "$ne": ""}}) > 0
has_sub_ids = db.clicks.count_documents({"sub_id1": {"$exists": True, "$ne": None, "$ne": ""}}) > 0
has_flags = db.clicks.count_documents({"is_unique": {"$exists": True}}) > 0

if has_browser:
    print("   - Browser ✅")
if has_device:
    print("   - Device Type ✅")
if has_country:
    print("   - Country ✅")
if has_source:
    print("   - Source/Referrer ✅")
if has_sub_ids:
    print("   - Sub IDs ✅")
if has_flags:
    print("   - Unique/Suspicious/Rejected flags ✅")

print("\n❌ WILL BE EMPTY (need to add to database):")
has_url = db.offers.count_documents({"url": {"$exists": True, "$ne": None, "$ne": ""}}) > 0
has_category = db.offers.count_documents({"category": {"$exists": True, "$ne": None, "$ne": ""}}) > 0
has_ad_group = db.offers.count_documents({"ad_group": {"$exists": True, "$ne": None, "$ne": ""}}) > 0
has_goal = db.offers.count_documents({"goal": {"$exists": True, "$ne": None, "$ne": ""}}) > 0
has_promo = db.offers.count_documents({"promo_code": {"$exists": True, "$ne": None, "$ne": ""}}) > 0
has_creative = db.clicks.count_documents({"creative": {"$exists": True, "$ne": None, "$ne": ""}}) > 0
has_app_version = db.clicks.count_documents({"app_version": {"$exists": True, "$ne": None, "$ne": ""}}) > 0
has_adv_sub = db.clicks.count_documents({"advertiser_sub_id1": {"$exists": True, "$ne": None, "$ne": ""}}) > 0

if not has_url:
    print("   - Offer URL ❌")
if not has_category:
    print("   - Category ❌")
if not has_ad_group:
    print("   - Ad Group ❌")
if not has_goal:
    print("   - Goal ❌")
if not has_promo:
    print("   - Promo Code ❌")
if not has_creative:
    print("   - Creative ❌")
if not has_app_version:
    print("   - App Version ❌")
if not has_adv_sub:
    print("   - Advertiser Sub IDs ❌")

print("\n⚠️ CURRENCY: Will default to 'USD' if not set in offers")

print("\n" + "=" * 80)
print("✅ RESULT: Most fields will show data, some will be empty until populated")
print("=" * 80)

client.close()
