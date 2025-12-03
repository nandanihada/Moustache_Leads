#!/usr/bin/env python
"""
Check ALL clicks for fraud status
"""
from database import db_instance
import json
from datetime import datetime, timedelta

print("=" * 100)
print("🔍 CHECKING ALL CLICKS FOR FRAUD")
print("=" * 100)

try:
    clicks_col = db_instance.get_collection('offerwall_clicks_detailed')
    
    # Get all clicks with fraud status
    all_clicks = list(clicks_col.find({})
                         .sort('timestamp', -1))
    
    print(f"\n📊 Total clicks in database: {len(all_clicks)}")
    
    fraud_counts = {
        'Clean': 0,
        'Low Risk': 0,
        'Medium Risk': 0,
        'High Risk': 0,
        'Unknown': 0
    }
    
    for click in all_clicks:
        fraud = click.get('fraud_indicators', {})
        status = fraud.get('fraud_status', 'Unknown')
        score = fraud.get('fraud_score', 0)
        
        fraud_counts[status] = fraud_counts.get(status, 0) + 1
        
        if status != 'Clean' and status != 'Unknown':
            print(f"\n⚠️  FRAUD DETECTED:")
            print(f"   Click ID: {click.get('click_id')}")
            print(f"   User ID: {click.get('user_id')}")
            print(f"   Status: {status}")
            print(f"   Score: {score}")
            print(f"   Time: {click.get('timestamp')}")
            
            # Show why it was flagged
            indicators = []
            if fraud.get('duplicate_click'): indicators.append('Duplicate Click')
            if fraud.get('fast_click'): indicators.append('Fast Click')
            if fraud.get('bot_like'): indicators.append('Bot-like')
            if fraud.get('vpn_detected'): indicators.append('VPN')
            if fraud.get('proxy_detected'): indicators.append('Proxy')
            if fraud.get('tor_detected'): indicators.append('Tor')
            if fraud.get('hosting_detected'): indicators.append('Hosting')
            
            if indicators:
                print(f"   Reasons: {', '.join(indicators)}")
    
    print(f"\n📊 FRAUD STATUS SUMMARY:")
    for status, count in fraud_counts.items():
        print(f"   {status}: {count}")
    
    # Check recent clicks (last hour)
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)
    recent_clicks = [c for c in all_clicks if c.get('timestamp') and c.get('timestamp') >= one_hour_ago]
    
    print(f"\n⏰ RECENT CLICKS (Last Hour): {len(recent_clicks)}")
    for click in recent_clicks:
        fraud = click.get('fraud_indicators', {})
        print(f"   {click.get('user_id')} - {fraud.get('fraud_status', 'Unknown')} - {click.get('timestamp')}")
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 100)
print("✅ ANALYSIS COMPLETE")
print("=" * 100)
