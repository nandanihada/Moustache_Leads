"""
Quick script to check postback system status
"""

from database import db_instance
from datetime import datetime, timedelta

def check_status():
    print("=" * 60)
    print("🔍 POSTBACK SYSTEM STATUS CHECK")
    print("=" * 60)
    
    # Check partners
    partners = db_instance.get_collection('partners')
    active_partners = list(partners.find({'status': 'active'}))
    print(f"\n✅ Active Partners: {len(active_partners)}")
    for p in active_partners:
        print(f"   - {p['partner_name']} (ID: {p['partner_id']})")
    
    # Check offers with partners
    offers = db_instance.get_collection('offers')
    offers_with_partners = list(offers.find({'partner_id': {'$exists': True, '$ne': ''}}))
    print(f"\n✅ Offers Mapped to Partners: {len(offers_with_partners)}")
    for o in offers_with_partners:
        print(f"   - {o['name']} → Partner: {o.get('partner_id')}")
    
    # Check recent conversions
    conversions = db_instance.get_collection('conversions')
    recent_conversions = list(conversions.find().sort('created_at', -1).limit(5))
    print(f"\n✅ Recent Conversions: {len(recent_conversions)}")
    for c in recent_conversions:
        print(f"   - {c['conversion_id']} | Partner: {c.get('partner_id', 'None')} | {c['created_at']}")
    
    # Check postback queue
    queue = db_instance.get_collection('postback_queue')
    pending = list(queue.find({'status': 'pending'}))
    sent = list(queue.find({'status': 'sent'}))
    failed = list(queue.find({'status': 'failed'}))
    
    print(f"\n📤 Postback Queue:")
    print(f"   Pending: {len(pending)}")
    print(f"   Sent: {len(sent)}")
    print(f"   Failed: {len(failed)}")
    
    # Check postback logs (last 24 hours)
    logs = db_instance.get_collection('postback_logs')
    yesterday = datetime.utcnow() - timedelta(days=1)
    recent_logs = list(logs.find({'created_at': {'$gte': yesterday}}).sort('created_at', -1))
    
    success_logs = [l for l in recent_logs if l['status'] == 'success']
    failed_logs = [l for l in recent_logs if l['status'] == 'failed']
    
    print(f"\n📊 Postback Logs (Last 24h):")
    print(f"   Total: {len(recent_logs)}")
    print(f"   Success: {len(success_logs)}")
    print(f"   Failed: {len(failed_logs)}")
    
    if recent_logs:
        print(f"\n   Latest 5 Logs:")
        for log in recent_logs[:5]:
            status_icon = "✅" if log['status'] == 'success' else "❌"
            print(f"   {status_icon} {log['partner_name']} | {log['method']} | {log['response_code']} | {log['sent_at']}")
    
    # Summary
    print("\n" + "=" * 60)
    print("📋 SUMMARY")
    print("=" * 60)
    
    if len(active_partners) == 0:
        print("⚠️ No active partners configured")
        print("   → Go to Admin → Partners to add partners")
    
    if len(offers_with_partners) == 0:
        print("⚠️ No offers mapped to partners")
        print("   → Edit offers and select a partner in Tracking Setup")
    
    if len(recent_conversions) == 0:
        print("⚠️ No conversions found")
        print("   → Run test_postback.py to create test conversion")
    
    if len(pending) > 0:
        print(f"⏳ {len(pending)} postbacks pending (will send within 30 seconds)")
    
    if len(success_logs) > 0:
        success_rate = (len(success_logs) / len(recent_logs) * 100) if recent_logs else 0
        print(f"✅ Postback success rate: {success_rate:.1f}%")
    
    if len(failed_logs) > 0:
        print(f"❌ {len(failed_logs)} failed postbacks (check Postback Logs in UI)")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    check_status()
