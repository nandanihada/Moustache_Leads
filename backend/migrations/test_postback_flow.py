"""
Test Script: Verify the complete postback → conversion → balance flow

This script simulates what happens when cpamerchant sends a postback.
It checks:
1. Can we find the user from user_id?
2. Can we find a matching click (even if all are converted)?
3. Would the conversion be created?
4. Would the balance be updated?

Run: python migrations/test_postback_flow.py <user_id>

Example: python migrations/test_postback_flow.py 69a9a5e655f321cc19f6a74d
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance
from datetime import datetime
from bson import ObjectId
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def test_postback_flow(user_id=None):
    """Test the postback flow for a given user"""
    
    if not user_id:
        if len(sys.argv) > 1:
            user_id = sys.argv[1]
        else:
            print("Usage: python migrations/test_postback_flow.py <user_id>")
            print("Example: python migrations/test_postback_flow.py 69a9a5e655f321cc19f6a74d")
            return
    
    users_col = db_instance.get_collection('users')
    clicks_col = db_instance.get_collection('clicks')
    conversions_col = db_instance.get_collection('conversions')
    received_col = db_instance.get_collection('received_postbacks')
    forwarded_col = db_instance.get_collection('forwarded_postbacks')
    pts_col = db_instance.get_collection('points_transactions')
    offers_col = db_instance.get_collection('offers')
    
    print(f"\n{'='*60}")
    print(f"POSTBACK FLOW TEST — user_id: {user_id}")
    print(f"{'='*60}\n")
    
    # 1. Find user
    print("1️⃣  FINDING USER...")
    user = None
    try:
        user = users_col.find_one({'_id': ObjectId(user_id)})
    except:
        user = users_col.find_one({'username': user_id})
    
    if not user:
        print(f"   ❌ User NOT FOUND: {user_id}")
        return
    
    username = user.get('username', 'Unknown')
    current_balance = user.get('total_points', 0)
    postback_url = user.get('postback_url', '')
    print(f"   ✅ Found: {username}")
    print(f"   💰 Current balance: ${current_balance}")
    print(f"   📤 Postback URL: {postback_url or 'None'}")
    
    # 2. Find clicks
    print(f"\n2️⃣  FINDING CLICKS...")
    all_clicks = list(clicks_col.find({'user_id': user_id}).sort('click_time', -1).limit(10))
    unconverted_clicks = [c for c in all_clicks if not c.get('converted')]
    converted_clicks = [c for c in all_clicks if c.get('converted')]
    
    print(f"   Total clicks (last 10): {len(all_clicks)}")
    print(f"   Unconverted: {len(unconverted_clicks)}")
    print(f"   Converted: {len(converted_clicks)}")
    
    for c in all_clicks[:5]:
        status = "✅ converted" if c.get('converted') else "⬜ unconverted"
        print(f"   - {c.get('click_id')} | {c.get('offer_id')} | {c.get('click_time')} | {status}")
    
    # 3. Check what process_single_postback would do
    print(f"\n3️⃣  SIMULATING process_single_postback...")
    
    # Simulate: cpamerchant sends user_id but no click_id
    simulated_params = {'user_id': user_id, 'payout': '3.00'}
    
    # Strategy A: unconverted click
    if unconverted_clicks:
        print(f"   Strategy A would match: {unconverted_clicks[0].get('click_id')}")
        # Check if conversion already exists
        existing = conversions_col.find_one({'click_id': unconverted_clicks[0].get('click_id')})
        if existing:
            print(f"   ⚠️ BUT conversion already exists for this click: {existing.get('conversion_id')}")
            print(f"   → Would be marked as DUPLICATE")
        else:
            print(f"   → Would CREATE conversion successfully ✅")
    else:
        print(f"   Strategy A: NO unconverted clicks found")
        
        # Strategy B: find click without conversion
        print(f"   Trying Strategy B...")
        found_b = False
        for c in all_clicks:
            existing = conversions_col.find_one({'click_id': c.get('click_id')})
            if not existing:
                print(f"   Strategy B would match: {c.get('click_id')} (no conversion exists)")
                print(f"   → Would CREATE conversion successfully ✅")
                found_b = True
                break
        
        if not found_b:
            print(f"   Strategy B: ALL clicks already have conversions")
            
            # Strategy C: force match
            if all_clicks:
                print(f"   Strategy C (force): would use {all_clicks[0].get('click_id')}")
                print(f"   → Would CREATE conversion (force match) ✅")
            else:
                print(f"   Strategy C: NO clicks at all")
                print(f"   → Would fall through to FALLBACK in postback_receiver ⚠️")
    
    # 4. Check conversions
    print(f"\n4️⃣  EXISTING CONVERSIONS...")
    conversions = list(conversions_col.find({'user_id': user_id}).sort('conversion_time', -1).limit(10))
    print(f"   Total conversions: {len(conversions)}")
    for conv in conversions[:5]:
        print(f"   - {conv.get('conversion_id')} | {conv.get('offer_id')} | {conv.get('conversion_time')} | matched_by={conv.get('matched_by', 'unknown')}")
    
    # 5. Check received postbacks
    print(f"\n5️⃣  RECEIVED POSTBACKS (last 5)...")
    received = list(received_col.find({
        'query_params.user_id': user_id
    }).sort('timestamp', -1).limit(5))
    print(f"   Total received: {len(received)}")
    for pb in received:
        print(f"   - {pb.get('timestamp')} | status={pb.get('status')} | partner={pb.get('partner_name')}")
    
    # 6. Check points transactions
    print(f"\n6️⃣  POINTS TRANSACTIONS (last 5)...")
    pts = list(pts_col.find({'user_id': user_id}).sort('timestamp', -1).limit(5))
    print(f"   Total transactions: {len(pts)}")
    for pt in pts:
        print(f"   - {pt.get('timestamp')} | +${pt.get('points')} | {pt.get('offer_id')} | source={pt.get('source', 'unknown')}")
    
    # 7. Summary
    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"User: {username} ({user_id})")
    print(f"Balance: ${current_balance}")
    print(f"Clicks: {len(all_clicks)} total, {len(unconverted_clicks)} unconverted")
    print(f"Conversions: {len(conversions)}")
    
    # Check if there are unmatched postbacks that should have been credited
    unmatched = list(received_col.find({
        'query_params.user_id': user_id,
        'status': 'unmatched'
    }))
    if unmatched:
        print(f"\n⚠️  UNMATCHED POSTBACKS: {len(unmatched)} — these need to be fixed!")
        for pb in unmatched:
            print(f"   - {pb.get('timestamp')} | {pb.get('partner_name')} | params: {pb.get('query_params')}")
    else:
        print(f"\n✅ No unmatched postbacks — all good!")
    
    print(f"{'='*60}\n")


if __name__ == '__main__':
    test_postback_flow()
