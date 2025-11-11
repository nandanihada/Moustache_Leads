#!/usr/bin/env python3
"""
Check conversion data and date ranges
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import jwt
from database import db_instance
from datetime import datetime

def get_current_user_id():
    """Get user ID from token file"""
    try:
        with open('jwt_token.txt', 'r') as f:
            token = f.read().strip()
        decoded = jwt.decode(token, options={"verify_signature": False})
        return decoded.get('user_id')
    except Exception as e:
        print(f"❌ Error reading token: {e}")
        return None

def check_conversions(user_id):
    """Check conversion data"""
    
    print(f"\n💰 CHECKING CONVERSIONS FOR USER: {user_id}")
    print("="*70)
    
    conversions_collection = db_instance.get_collection('conversions')
    
    if conversions_collection is None:
        print("❌ Database connection failed")
        return
    
    # Count conversions
    query = {'$or': [{'user_id': user_id}, {'affiliate_id': user_id}]}
    total_conversions = conversions_collection.count_documents(query)
    
    print(f"\n📊 Total Conversions: {total_conversions}")
    
    if total_conversions == 0:
        print("⚠️  No conversions found!")
        return
    
    # Get date range
    conversions = list(conversions_collection.find(query).sort('conversion_time', 1))
    
    if conversions:
        earliest = conversions[0]['conversion_time']
        latest = conversions[-1]['conversion_time']
        
        print(f"\n📅 Date Range:")
        print(f"  Earliest: {earliest}")
        print(f"  Latest: {latest}")
        
        # Count by status
        approved = conversions_collection.count_documents({**query, 'status': 'approved'})
        pending = conversions_collection.count_documents({**query, 'status': 'pending'})
        rejected = conversions_collection.count_documents({**query, 'status': 'rejected'})
        
        print(f"\n📋 By Status:")
        print(f"  ✅ Approved: {approved}")
        print(f"  ⏰ Pending: {pending}")
        print(f"  ❌ Rejected: {rejected}")
        
        # Sample conversions
        print(f"\n📝 Sample Conversions (latest 5):")
        samples = list(conversions_collection.find(query).sort('conversion_time', -1).limit(5))
        for conv in samples:
            print(f"  - {conv['conversion_time']} | Status: {conv['status']} | Payout: ${conv.get('payout', 0)}")
        
        print("\n" + "="*70)
        print("✅ Conversion data exists!")
        print(f"\n💡 FRONTEND DATE RANGE:")
        print(f"  Start: {earliest.strftime('%Y-%m-%d')}")
        print(f"  End: {latest.strftime('%Y-%m-%d')}")
        print("\n📍 To see data in frontend:")
        print("  1. Refresh the page (frontend should auto-load now)")
        print("  2. Or manually set date range to dates above")
        print("  3. Click 'Last 7 Days' from Date Presets dropdown")

if __name__ == '__main__':
    user_id = get_current_user_id()
    if user_id:
        check_conversions(user_id)
    else:
        print("❌ Could not get user ID from token")
