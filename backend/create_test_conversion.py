#!/usr/bin/env python3
"""
Create test conversion for testing
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import db_instance
from datetime import datetime
import secrets

def create_test_conversion():
    """Create a test conversion"""
    
    print("\n💰 CREATING TEST CONVERSION")
    print("="*70)
    
    # Get latest click
    clicks_collection = db_instance.get_collection('clicks')
    latest_click = clicks_collection.find_one({}, sort=[('click_time', -1)])
    
    if not latest_click:
        print("❌ No clicks found. Click a tracking link first!")
        return
    
    print(f"\n📊 Using latest click:")
    print(f"   Click ID: {latest_click['click_id']}")
    print(f"   Offer ID: {latest_click['offer_id']}")
    print(f"   User ID: {latest_click['user_id']}")
    
    # Create conversion
    conversions_collection = db_instance.get_collection('conversions')
    
    conversion_id = f"CONV-{secrets.token_hex(6).upper()}"
    
    conversion_data = {
        'conversion_id': conversion_id,
        'click_id': latest_click['click_id'],
        'transaction_id': f'TEST-TXN-{int(datetime.utcnow().timestamp())}',
        'offer_id': latest_click['offer_id'],
        'user_id': latest_click['user_id'],
        'affiliate_id': latest_click['affiliate_id'],
        'status': 'approved',
        'payout': 90.01,
        'currency': 'USD',
        'country': latest_click.get('country', 'Unknown'),
        'device_type': latest_click.get('device_type', 'unknown'),
        'ip_address': latest_click.get('ip_address'),
        'sub_id1': latest_click.get('sub_id1'),
        'sub_id2': latest_click.get('sub_id2'),
        'sub_id3': latest_click.get('sub_id3'),
        'conversion_time': datetime.utcnow()
    }
    
    # Insert conversion
    result = conversions_collection.insert_one(conversion_data)
    
    print(f"\n✅ Conversion created successfully!")
    print(f"\n💰 Conversion Details:")
    print(f"   Conversion ID: {conversion_id}")
    print(f"   Transaction ID: {conversion_data['transaction_id']}")
    print(f"   Status: {conversion_data['status']}")
    print(f"   Payout: ${conversion_data['payout']}")
    print(f"   Offer ID: {conversion_data['offer_id']}")
    
    # Update click as converted
    clicks_collection.update_one(
        {'click_id': latest_click['click_id']},
        {'$set': {'converted': True}}
    )
    
    print(f"\n✅ Click marked as converted")
    
    # Summary
    total_conversions = conversions_collection.count_documents({})
    total_payout = list(conversions_collection.aggregate([
        {'$match': {'status': 'approved'}},
        {'$group': {'_id': None, 'total': {'$sum': '$payout'}}}
    ]))
    
    print(f"\n📊 Your Stats:")
    print(f"   Total Conversions: {total_conversions}")
    print(f"   Total Payout: ${total_payout[0]['total'] if total_payout else 0:.2f}")
    
    print(f"\n🎉 NOW CHECK REPORTS:")
    print(f"   Performance Report: http://localhost:8080/dashboard/performance-report")
    print(f"   Conversion Report: http://localhost:8080/dashboard/conversion-report")
    
    print("\n" + "="*70)

if __name__ == '__main__':
    create_test_conversion()
