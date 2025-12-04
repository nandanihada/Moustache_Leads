#!/usr/bin/env python3
"""
Check partner postback configuration and distribution status
"""

from database import db_instance
from datetime import datetime, timedelta
import logging

logging.basicConfig(level=logging.INFO, format='%(message)s')

def check_postback_system():
    """Check the complete postback system"""
    
    try:
        partners = db_instance.get_collection('partners')
        postback_logs = db_instance.get_collection('partner_postback_logs')
        received_postbacks = db_instance.get_collection('received_postbacks')
        
        if partners is None:
            print("❌ Could not access partners collection")
            return
        
        print("\n" + "="*80)
        print("🔍 POSTBACK SYSTEM STATUS CHECK")
        print("="*80)
        
        # Check 1: Partners with postback URLs
        print("\n📋 PARTNERS WITH POSTBACK URLs:")
        print("-"*80)
        
        active_partners = list(partners.find({
            'status': 'active',
            'postback_url': {'$exists': True, '$ne': ''}
        }))
        
        print(f"\nActive partners with postback URLs: {len(active_partners)}")
        
        if len(active_partners) == 0:
            print("\n⚠️  WARNING: No active partners have postback URLs configured!")
            print("   This means postbacks won't be distributed to anyone.")
        else:
            for i, partner in enumerate(active_partners, 1):
                print(f"\n{i}. Partner: {partner.get('partner_name', 'Unknown')}")
                print(f"   ID: {partner.get('partner_id', 'N/A')}")
                print(f"   Postback URL: {partner.get('postback_url', 'N/A')}")
                print(f"   Method: {partner.get('method', 'GET')}")
        
        # Check 2: All partners (including inactive)
        print("\n" + "="*80)
        print("📊 ALL PARTNERS:")
        print("-"*80)
        
        all_partners = list(partners.find())
        print(f"\nTotal partners: {len(all_partners)}")
        
        for i, partner in enumerate(all_partners, 1):
            has_url = bool(partner.get('postback_url'))
            status = partner.get('status', 'unknown')
            
            print(f"\n{i}. {partner.get('partner_name', 'Unknown')}")
            print(f"   Status: {status}")
            print(f"   Has Postback URL: {'✅ YES' if has_url else '❌ NO'}")
            if has_url:
                print(f"   URL: {partner.get('postback_url')}")
        
        # Check 3: Recent postback distributions
        if postback_logs is not None:
            print("\n" + "="*80)
            print("📤 RECENT POSTBACK DISTRIBUTIONS (Last 10):")
            print("-"*80)
            
            recent_logs = list(postback_logs.find().sort('timestamp', -1).limit(10))
            
            if len(recent_logs) == 0:
                print("\n⚠️  No distribution logs found!")
                print("   Either no postbacks have been received, or distribution is not working.")
            else:
                print(f"\nFound {len(recent_logs)} recent distribution attempts:")
                
                for i, log in enumerate(recent_logs, 1):
                    print(f"\n{i}. Partner: {log.get('partner_name', 'Unknown')}")
                    print(f"   Status: {log.get('status', 'unknown')}")
                    print(f"   Response Code: {log.get('response_code', 'N/A')}")
                    print(f"   URL: {log.get('postback_url', 'N/A')}")
                    print(f"   Time: {log.get('timestamp', 'N/A')}")
                    
                    if log.get('error'):
                        print(f"   ❌ Error: {log.get('error')}")
        
        # Check 4: Recent received postbacks
        if received_postbacks is not None:
            print("\n" + "="*80)
            print("📥 RECENT RECEIVED POSTBACKS (Last 5):")
            print("-"*80)
            
            recent_received = list(received_postbacks.find().sort('timestamp', -1).limit(5))
            
            print(f"\nFound {len(recent_received)} recent received postbacks:")
            
            for i, pb in enumerate(recent_received, 1):
                print(f"\n{i}. Conversion ID: {pb.get('query_params', {}).get('conversion_id', 'N/A')}")
                print(f"   Partner: {pb.get('partner_name', 'Unknown')}")
                print(f"   Time: {pb.get('timestamp', 'N/A')}")
                print(f"   Status: {pb.get('status', 'N/A')}")
        
        # Summary
        print("\n" + "="*80)
        print("📊 SUMMARY:")
        print("="*80)
        
        total_partners = len(all_partners)
        partners_with_urls = len(active_partners)
        
        print(f"\nTotal Partners: {total_partners}")
        print(f"Active Partners with Postback URLs: {partners_with_urls}")
        
        if postback_logs is not None:
            total_distributions = postback_logs.count_documents({})
            successful = postback_logs.count_documents({'status': 'success'})
            failed = postback_logs.count_documents({'status': 'failed'})
            
            print(f"\nTotal Distribution Attempts: {total_distributions}")
            print(f"  Successful: {successful}")
            print(f"  Failed: {failed}")
        
        if received_postbacks is not None:
            total_received = received_postbacks.count_documents({})
            print(f"\nTotal Postbacks Received: {total_received}")
        
        # Recommendations
        print("\n" + "="*80)
        print("💡 RECOMMENDATIONS:")
        print("="*80)
        
        if partners_with_urls == 0:
            print("\n⚠️  ACTION REQUIRED:")
            print("   1. Partners need to configure their postback URLs")
            print("   2. Go to Partner Profile → Set Postback URL")
            print("   3. Format: https://partner-site.com/postback?click_id={click_id}&payout={payout}")
        
        if postback_logs is not None and postback_logs.count_documents({}) == 0:
            print("\n⚠️  NO DISTRIBUTIONS FOUND:")
            print("   Either:")
            print("   - No postbacks have been received yet")
            print("   - Distribution service is not running")
            print("   - Check backend logs for errors")
        
        print("\n✅ Check complete!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    check_postback_system()
