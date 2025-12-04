#!/usr/bin/env python3
"""
Check what data exists for different users
"""

from database import db_instance
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO, format='%(message)s')

def check_user_data():
    """Check data for all users"""
    
    try:
        clicks = db_instance.get_collection('clicks')
        conversions = db_instance.get_collection('conversions')
        users = db_instance.get_collection('users')
        
        if clicks is None or conversions is None or users is None:
            print("❌ Could not access collections")
            return
        
        print("\n" + "="*80)
        print("👥 All Users in Database:")
        print("="*80)
        
        all_users = list(users.find())
        print(f"\nTotal users: {len(all_users)}")
        
        for i, user in enumerate(all_users, 1):
            user_id = str(user.get('_id'))
            username = user.get('username', 'N/A')
            email = user.get('email', 'N/A')
            role = user.get('role', 'N/A')
            
            print(f"\n{i}. User ID: {user_id}")
            print(f"   Username: {username}")
            print(f"   Email: {email}")
            print(f"   Role: {role}")
            
            # Count data for this user
            user_clicks = clicks.count_documents({'user_id': user_id})
            user_conversions = conversions.count_documents({'user_id': user_id})
            
            # Also check with affiliate_id
            affiliate_clicks = clicks.count_documents({'affiliate_id': user_id})
            affiliate_conversions = conversions.count_documents({'affiliate_id': user_id})
            
            print(f"   Clicks (user_id): {user_clicks}")
            print(f"   Clicks (affiliate_id): {affiliate_clicks}")
            print(f"   Conversions (user_id): {user_conversions}")
            print(f"   Conversions (affiliate_id): {affiliate_conversions}")
        
        print("\n" + "="*80)
        print("📊 Data by User ID:")
        print("="*80)
        
        # Get all unique user_ids from clicks
        unique_user_ids = clicks.distinct('user_id')
        print(f"\nUnique user_ids in clicks: {len(unique_user_ids)}")
        
        for user_id in unique_user_ids:
            click_count = clicks.count_documents({'user_id': user_id})
            conv_count = conversions.count_documents({'user_id': user_id})
            
            # Get latest click
            latest_click = clicks.find_one({'user_id': user_id}, sort=[('click_time', -1)])
            latest_time = latest_click.get('click_time') if latest_click else 'N/A'
            
            print(f"\nUser ID: {user_id}")
            print(f"  Clicks: {click_count}")
            print(f"  Conversions: {conv_count}")
            print(f"  Latest Click: {latest_time}")
        
        print("\n" + "="*80)
        print("📊 Recent Clicks (last 10):")
        print("="*80)
        
        recent_clicks = list(clicks.find().sort('click_time', -1).limit(10))
        for i, click in enumerate(recent_clicks, 1):
            print(f"\n{i}. Click ID: {click.get('click_id', 'N/A')}")
            print(f"   User ID: {click.get('user_id', 'N/A')}")
            print(f"   Affiliate ID: {click.get('affiliate_id', 'N/A')}")
            print(f"   Offer ID: {click.get('offer_id', 'N/A')}")
            print(f"   Time: {click.get('click_time', 'N/A')}")
        
        print("\n" + "="*80)
        print("📊 Recent Conversions (last 10):")
        print("="*80)
        
        recent_convs = list(conversions.find().sort('conversion_time', -1).limit(10))
        for i, conv in enumerate(recent_convs, 1):
            print(f"\n{i}. Conversion ID: {conv.get('conversion_id', 'N/A')}")
            print(f"   User ID: {conv.get('user_id', 'N/A')}")
            print(f"   Affiliate ID: {conv.get('affiliate_id', 'N/A')}")
            print(f"   Offer ID: {conv.get('offer_id', 'N/A')}")
            print(f"   Payout: {conv.get('payout', 0)}")
            print(f"   Time: {conv.get('conversion_time', 'N/A')}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    check_user_data()
