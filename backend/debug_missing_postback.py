#!/usr/bin/env python3
"""
Debug why postback isn't arriving from partner
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import db_instance
from datetime import datetime, timedelta

print("\n🔍 DEBUGGING MISSING POSTBACK")
print("="*70)

# 1. Check if backend received ANY requests recently
print("\n1️⃣ Checking recent activity...")

# Check received_postbacks for last 10 minutes
postbacks_col = db_instance.get_collection('received_postbacks')
recent_time = datetime.utcnow() - timedelta(minutes=10)
recent_postbacks = list(postbacks_col.find({'timestamp': {'$gte': recent_time}}).sort('timestamp', -1))

print(f"   Postbacks in last 10 minutes: {len(recent_postbacks)}")

if recent_postbacks:
    print(f"\n   ✅ POSTBACKS ARE ARRIVING!")
    for pb in recent_postbacks[:3]:
        print(f"      - {pb['timestamp']} from {pb['partner_name']}")
else:
    print(f"\n   ❌ NO POSTBACKS in last 10 minutes")

# 2. Check if any clicks were made recently
clicks_col = db_instance.get_collection('clicks')
recent_clicks = list(clicks_col.find({'click_time': {'$gte': recent_time}}).sort('click_time', -1))

print(f"\n2️⃣ Recent clicks (last 10 min): {len(recent_clicks)}")

if recent_clicks:
    print(f"   ✅ Clicks detected:")
    for click in recent_clicks[:3]:
        print(f"      - Click ID: {click['click_id']}")
        print(f"        Offer: {click.get('offer_id')}")
        print(f"        Time: {click.get('click_time')}")
else:
    print(f"   ⚠️ No recent clicks - Did you click the tracking link first?")

# 3. Check partner configuration
print(f"\n3️⃣ Checking partner configuration...")

partners_col = db_instance.get_collection('partners')
partners = list(partners_col.find({}))

if partners:
    for partner in partners:
        print(f"\n   Partner: {partner.get('partner_name')}")
        print(f"   Partner ID: {partner.get('partner_id')}")
        
        postback_key = partner.get('unique_postback_key')
        if postback_key:
            print(f"   Postback Key: {postback_key}")
            print(f"\n   📍 YOUR POSTBACK URL:")
            print(f"   http://localhost:5000/postback/{postback_key}")
            print(f"\n   🌐 For production/public:")
            print(f"   https://YOUR-DOMAIN.com/postback/{postback_key}")
            
            # Check postback settings
            postback_url = partner.get('postback_url')
            if postback_url:
                print(f"\n   Partner's postback endpoint: {postback_url}")
        else:
            print(f"   ⚠️ NO POSTBACK KEY configured!")
else:
    print(f"   ⚠️ No partners configured in database")

# 4. Check all postbacks ever received
total_postbacks = postbacks_col.count_documents({})
print(f"\n4️⃣ Total postbacks ever received: {total_postbacks}")

if total_postbacks > 0:
    latest = postbacks_col.find_one({}, sort=[('timestamp', -1)])
    print(f"\n   Last postback received:")
    print(f"   - Time: {latest['timestamp']}")
    print(f"   - Partner: {latest['partner_name']}")
    print(f"   - Transaction: {latest.get('post_data', {}).get('transaction_id')}")
else:
    print(f"\n   ⚠️ NEVER received any postbacks")

print("\n" + "="*70)
print("\n💡 COMMON REASONS POSTBACK NOT ARRIVING:")
print("="*70)
print("\n1. ❌ Partner not configured with YOUR postback URL")
print("   → Give them the URL shown above")
print("\n2. ❌ Backend not publicly accessible")
print("   → If testing locally, partner can't reach localhost")
print("   → Use ngrok or deploy to public server")
print("\n3. ❌ Survey completion didn't trigger postback")
print("   → Check partner's dashboard")
print("   → Verify survey was actually completed")
print("\n4. ❌ Wrong click_id or missing parameter")
print("   → Partner needs to pass click_id from your tracking link")
print("\n5. ❌ Partner's postback is delayed")
print("   → Some partners batch postbacks")
print("   → Can take minutes to hours")

print("\n" + "="*70)
print("\n🔧 WHAT TO DO:")
print("="*70)
print("\n1. Check if backend received the request:")
print("   - Look at backend console logs")
print("   - Should see: 📥 Postback received...")
print("\n2. If using localhost:")
print("   - Partner CANNOT reach localhost")
print("   - Use ngrok: ngrok http 5000")
print("   - Or deploy to public server")
print("\n3. Check with partner:")
print("   - Did they receive completion notification?")
print("   - Are they configured to send postbacks?")
print("   - What's their postback URL configured as?")
print("\n4. Test manually:")
print("   - Run: python test_postback_receiver.py")
print("   - Simulates partner postback")

print("\n" + "="*70)
