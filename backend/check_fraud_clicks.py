#!/usr/bin/env python
"""
Check why clicks are being flagged as fraud
"""
from database import db_instance
import json
from datetime import datetime, timedelta

print("=" * 100)
print("🔍 CHECKING FRAUD DETECTION REASONS")
print("=" * 100)

try:
    clicks_col = db_instance.get_collection('offerwall_clicks_detailed')
    
    # Get the most recent 3 clicks
    recent_clicks = list(clicks_col.find({})
                         .sort('timestamp', -1)
                         .limit(3))
    
    print(f"\n📊 Found {len(recent_clicks)} recent clicks")
    
    for i, click in enumerate(recent_clicks, 1):
        print(f"\n{'='*60}")
        print(f"🔍 CLICK #{i}")
        print(f"{'='*60}")
        
        print(f"\n📋 BASIC INFO:")
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
        print(f"   VPN Detected: {fraud.get('vpn_detected', False)}")
        print(f"   Proxy Detected: {fraud.get('proxy_detected', False)}")
        print(f"   Tor Detected: {fraud.get('tor_detected', False)}")
        print(f"   Hosting Detected: {fraud.get('hosting_detected', False)}")
        
        print(f"\n🌐 NETWORK INFO:")
        geo = click.get('geo', {})
        print(f"   IP Address: {geo.get('ip_address', 'Unknown')}")
        print(f"   User Agent: {click.get('fingerprint', {}).get('user_agent', 'Unknown')[:100]}...")
        
        print(f"\n⏱️ CLICK TIMING:")
        click_context = click.get('click_context', {})
        time_to_click = click_context.get('time_to_click', 0)
        print(f"   Time to Click: {time_to_click}ms")
        if time_to_click and time_to_click < 100:
            print(f"   ⚠️  FAST CLICK DETECTED (< 100ms)")
        
        # Check for duplicate clicks
        if fraud.get('duplicate_click'):
            print(f"   ⚠️  DUPLICATE CLICK DETECTED")
            # Find the duplicate
            user_id = click.get('user_id')
            offer_id = click.get('offer_id')
            placement_id = click.get('placement_id')
            timestamp = click.get('timestamp')
            
            if timestamp:
                # Look for clicks within 5 minutes
                five_min_ago = timestamp - timedelta(minutes=5)
                duplicates = list(clicks_col.find({
                    'user_id': user_id,
                    'offer_id': offer_id,
                    'placement_id': placement_id,
                    'timestamp': {'$gte': five_min_ago, '$lt': timestamp}
                }))
                print(f"   Found {len(duplicates)} previous clicks within 5 minutes")
        
        # Check for bot-like user agent
        user_agent = click.get('fingerprint', {}).get('user_agent', '').lower()
        bot_keywords = ['bot', 'crawler', 'spider', 'scraper', 'curl', 'wget', 'python', 'java']
        if any(keyword in user_agent for keyword in bot_keywords):
            print(f"   ⚠️  BOT-LIKE USER AGENT DETECTED")
            for keyword in bot_keywords:
                if keyword in user_agent:
                    print(f"   Found keyword: '{keyword}'")
                    break
        
        print(f"\n📊 FRAUD SCORE BREAKDOWN:")
        score = fraud.get('fraud_score', 0)
        if score == 0:
            print(f"   ✅ Clean (Score: 0)")
        elif score < 15:
            print(f"   ✅ Clean (Score: {score})")
        elif score < 30:
            print(f"   ⚠️  Low Risk (Score: {score})")
        elif score < 50:
            print(f"   ⚠️  Medium Risk (Score: {score})")
        else:
            print(f"   ❌ High Risk (Score: {score})")
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 100)
print("✅ ANALYSIS COMPLETE")
print("=" * 100)
