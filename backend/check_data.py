#!/usr/bin/env python3
"""
Check what data exists in the database
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import db_instance
from datetime import datetime
import jwt
from config import Config

def check_token_user():
    """Check which user the token belongs to"""
    try:
        with open('jwt_token.txt', 'r') as f:
            token = f.read().strip()
        
        # Decode token (without verification for inspection)
        decoded = jwt.decode(token, options={"verify_signature": False})
        print("\n🔑 TOKEN INFO:")
        print("="*70)
        print(f"User ID: {decoded.get('user_id')}")
        print(f"Username: {decoded.get('username', 'N/A')}")
        print(f"Expires: {datetime.fromtimestamp(decoded.get('exp', 0))}")
        return decoded.get('user_id')
    except Exception as e:
        print(f"❌ Error reading token: {e}")
        return None

def check_database_data(user_id):
    """Check what data exists for this user"""
    print("\n📊 DATABASE CHECK:")
    print("="*70)
    
    clicks_collection = db_instance.get_collection('clicks')
    conversions_collection = db_instance.get_collection('conversions')
    
    if clicks_collection is None or conversions_collection is None:
        print("❌ Could not connect to database")
        return
    
    # Check clicks with user_id
    clicks_user_id = clicks_collection.count_documents({'user_id': user_id})
    clicks_affiliate_id = clicks_collection.count_documents({'affiliate_id': user_id})
    
    print(f"\n📍 CLICKS:")
    print(f"  - With 'user_id' = {user_id}: {clicks_user_id}")
    print(f"  - With 'affiliate_id' = {user_id}: {clicks_affiliate_id}")
    
    # Check conversions with user_id
    conv_user_id = conversions_collection.count_documents({'user_id': user_id})
    conv_affiliate_id = conversions_collection.count_documents({'affiliate_id': user_id})
    
    print(f"\n💰 CONVERSIONS:")
    print(f"  - With 'user_id' = {user_id}: {conv_user_id}")
    print(f"  - With 'affiliate_id' = {user_id}: {conv_affiliate_id}")
    
    # Get date range of data
    if conv_user_id > 0 or conv_affiliate_id > 0:
        query = {'$or': [{'user_id': user_id}, {'affiliate_id': user_id}]}
        conversions = list(conversions_collection.find(query).sort('conversion_time', 1).limit(1))
        conversions_end = list(conversions_collection.find(query).sort('conversion_time', -1).limit(1))
        
        if conversions and conversions_end:
            start_date = conversions[0].get('conversion_time')
            end_date = conversions_end[0].get('conversion_time')
            
            print(f"\n📅 DATA DATE RANGE:")
            print(f"  - Earliest: {start_date}")
            print(f"  - Latest: {end_date}")
            
            # Sample conversion
            sample = conversions_collection.find_one(query)
            print(f"\n📝 SAMPLE CONVERSION:")
            print(f"  - Offer: {sample.get('offer_id', 'N/A')}")
            print(f"  - Payout: ${sample.get('payout', 0)}")
            print(f"  - Status: {sample.get('status', 'N/A')}")
            print(f"  - Country: {sample.get('country', 'N/A')}")
            print(f"  - Time: {sample.get('conversion_time')}")
    
    # Check all unique user_ids in conversions
    print(f"\n👥 ALL USERS WITH DATA:")
    all_user_ids = conversions_collection.distinct('user_id')
    all_affiliate_ids = conversions_collection.distinct('affiliate_id')
    
    print(f"  - Unique 'user_id' values: {len(all_user_ids)}")
    if all_user_ids:
        print(f"    {all_user_ids[:5]}")  # Show first 5
    
    print(f"  - Unique 'affiliate_id' values: {len(all_affiliate_ids)}")
    if all_affiliate_ids:
        print(f"    {all_affiliate_ids[:5]}")  # Show first 5
    
    print("\n" + "="*70)
    
    # Recommendations
    if clicks_user_id == 0 and clicks_affiliate_id == 0:
        print("\n⚠️  NO DATA FOUND FOR THIS USER!")
        print("\n💡 SOLUTION:")
        print("   Run: python create_test_data.py")
        print(f"   Use this user ID when prompted: {user_id}")
    else:
        print(f"\n✅ Found {clicks_user_id + clicks_affiliate_id} clicks")
        print(f"✅ Found {conv_user_id + conv_affiliate_id} conversions")
        print("\n💡 Data exists! Chart should work.")

if __name__ == '__main__':
    user_id = check_token_user()
    if user_id:
        check_database_data(user_id)
