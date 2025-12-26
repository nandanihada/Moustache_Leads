#!/usr/bin/env python
"""
Check why chintu's click is in fraud management
"""
from database import db_instance
import json

print("=" * 100)
print("🔍 CHECKING CHINTU'S CLICK")
print("=" * 100)

try:
    clicks_col = db_instance.get_collection('offerwall_clicks_detailed')
    
    # Find chintu's clicks
    chintu_clicks = list(clicks_col.find({'user_id': 'chintu'})
                         .sort('timestamp', -1))
    
    print(f"\n📊 Found {len(chintu_clicks)} clicks for user 'chintu'")
    
    if chintu_clicks:
        click = chintu_clicks[0]
        
        print(f"\n📋 CLICK DETAILS:")
        print(f"   Click ID: {click.get('click_id')}")
        print(f"   User ID: {click.get('user_id')}")
        print(f"   Offer: {click.get('offer_name')}")
        print(f"   Time: {click.get('timestamp')}")
        
        print(f"\n🤖 FRAUD INDICATORS:")
        fraud = click.get('fraud_indicators', {})
        print(f"   Status: {fraud.get('fraud_status', 'Unknown')}")
        print(f"   Score: {fraud.get('fraud_score', 0)}")
        print(f"   Duplicate Click: {fraud.get('duplicate_click', False)}")
        print(f"   Fast Click: {fraud.get('fast_click', False)}")
        print(f"   Bot-like: {fraud.get('bot_like', False)}")
        print(f"   VPN: {fraud.get('vpn_detected', False)}")
        print(f"   Proxy: {fraud.get('proxy_detected', False)}")
        print(f"   Tor: {fraud.get('tor_detected', False)}")
        print(f"   Hosting: {fraud.get('hosting_detected', False)}")
        
        print(f"\n⏱️ TIMING:")
        click_context = click.get('click_context', {})
        time_to_click = click_context.get('time_to_click', 0)
        print(f"   Time to Click: {time_to_click}ms")
        
        print(f"\n🌐 USER AGENT:")
        user_agent = click.get('fingerprint', {}).get('user_agent', 'Unknown')
        print(f"   {user_agent}")
        
        # Check if any keyword triggers bot detection
        bot_keywords = ['bot', 'crawler', 'spider', 'scraper', 'curl', 'wget', 'python', 'java']
        for keyword in bot_keywords:
            if keyword in user_agent.lower():
                print(f"   ⚠️  FOUND BOT KEYWORD: '{keyword}'")
        
        print(f"\n📊 FRAUD SCORE BREAKDOWN:")
        score = fraud.get('fraud_score', 0)
        print(f"   Total Score: {score}")
        if score >= 50:
            print(f"   Status: ❌ HIGH RISK (>= 50)")
        elif score >= 30:
            print(f"   Status: ⚠️  MEDIUM RISK (>= 30)")
        elif score >= 15:
            print(f"   Status: ⚠️  LOW RISK (>= 15)")
        else:
            print(f"   Status: ✅ CLEAN (< 15)")
            
        print(f"\n💡 WHY IT'S IN FRAUD MANAGEMENT:")
        if score >= 15:
            print(f"   Because fraud_score is {score} (>= 15)")
            print(f"   The frontend filters clicks with score >= 15 into Fraud tab")
        else:
            print(f"   It should NOT be in Fraud Management!")
            print(f"   Check frontend filtering logic")
    else:
        print("\n❌ No clicks found for user 'chintu'")
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 100)
