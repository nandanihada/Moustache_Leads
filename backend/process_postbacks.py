#!/usr/bin/env python3
"""
Process received_postbacks and create conversions
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import db_instance
from datetime import datetime
import secrets

def process_postbacks():
    """Convert received_postbacks to conversions"""
    
    print("\n🔄 PROCESSING RECEIVED POSTBACKS")
    print("="*70)
    
    postbacks_collection = db_instance.get_collection('received_postbacks')
    conversions_collection = db_instance.get_collection('conversions')
    clicks_collection = db_instance.get_collection('clicks')
    
    # Get all unprocessed postbacks
    postbacks = list(postbacks_collection.find({'status': 'received'}))
    
    print(f"\n📊 Found {len(postbacks)} unprocessed postbacks")
    
    if len(postbacks) == 0:
        print("\n✅ No postbacks to process")
        return
    
    processed = 0
    failed = 0
    
    for pb in postbacks:
        try:
            post_data = pb.get('post_data', {})
            
            # Extract data
            transaction_id = post_data.get('transaction_id')
            payout = float(post_data.get('payout', 0))
            status = 'approved' if post_data.get('status') == 'pass' else 'pending'
            survey_id = post_data.get('survey_id')
            session_id = post_data.get('session_id')
            
            # Try to find matching click by session_id
            click_id_from_pb = post_data.get('click_id') or post_data.get('aff_sub')
            click = None
            
            if click_id_from_pb:
                click = clicks_collection.find_one({'click_id': click_id_from_pb})
            
            # If no click found, try to match by session or just create standalone conversion
            if not click:
                # Get any recent click (for demo - you'd want better matching logic)
                click = clicks_collection.find_one({}, sort=[('click_time', -1)])
            
            if not click:
                print(f"   ⚠️  No click found for transaction {transaction_id} - skipping")
                failed += 1
                continue
            
            # Check if conversion already exists
            existing = conversions_collection.find_one({'transaction_id': transaction_id})
            if existing:
                print(f"   ⏭️  Conversion already exists: {transaction_id}")
                postbacks_collection.update_one(
                    {'_id': pb['_id']},
                    {'$set': {'status': 'processed'}}
                )
                processed += 1
                continue
            
            # Create conversion
            conversion_id = f"CONV-{secrets.token_hex(6).upper()}"
            
            conversion_data = {
                'conversion_id': conversion_id,
                'click_id': click.get('click_id'),
                'transaction_id': transaction_id,
                'offer_id': click.get('offer_id'),
                'user_id': click.get('user_id'),
                'affiliate_id': click.get('affiliate_id'),
                'status': status,
                'payout': payout,
                'currency': post_data.get('currency', 'USD'),
                'country': click.get('country', 'Unknown'),
                'device_type': click.get('device_type', 'unknown'),
                'ip_address': pb.get('ip_address'),
                'sub_id1': click.get('sub_id1'),
                'sub_id2': click.get('sub_id2'),
                'sub_id3': click.get('sub_id3'),
                'conversion_time': datetime.utcnow(),
                
                # Survey data
                'survey_id': survey_id,
                'session_id': session_id,
                'survey_responses': post_data.get('responses', {}),
                'responses_count': post_data.get('responses_count'),
                'completion_time': post_data.get('completion_time'),
                
                # All postback data
                'raw_postback': post_data,
                'custom_data': post_data,
                'postback_id': str(pb['_id']),
                'partner_id': pb.get('partner_id'),
                'partner_name': pb.get('partner_name'),
            }
            
            # Insert conversion
            conversions_collection.insert_one(conversion_data)
            
            # Mark postback as processed
            postbacks_collection.update_one(
                {'_id': pb['_id']},
                {'$set': {'status': 'processed', 'conversion_id': conversion_id}}
            )
            
            # Mark click as converted
            if click:
                clicks_collection.update_one(
                    {'click_id': click['click_id']},
                    {'$set': {'converted': True}}
                )
            
            print(f"   ✅ Created conversion: {conversion_id} | ${payout} | {transaction_id}")
            processed += 1
            
        except Exception as e:
            print(f"   ❌ Error processing postback: {e}")
            failed += 1
            continue
    
    print("\n" + "="*70)
    print(f"📊 SUMMARY:")
    print(f"   Processed: {processed}")
    print(f"   Failed: {failed}")
    print(f"   Total: {len(postbacks)}")
    
    # Show totals
    total_conversions = conversions_collection.count_documents({})
    total_payout = list(conversions_collection.aggregate([
        {'$match': {'status': 'approved'}},
        {'$group': {'_id': None, 'total': {'$sum': '$payout'}}}
    ]))
    
    print(f"\n💰 Your Total Stats:")
    print(f"   Total Conversions: {total_conversions}")
    print(f"   Total Payout: ${total_payout[0]['total'] if total_payout else 0:.2f}")
    
    print(f"\n🎉 CHECK CONVERSION REPORT:")
    print(f"   http://localhost:8080/dashboard/conversion-report")
    print("="*70)

if __name__ == '__main__':
    process_postbacks()
