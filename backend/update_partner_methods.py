"""
Update existing partners to use POST method for postbacks
"""
from database import db_instance

def update_partner_methods():
    """Update all partners to POST method"""
    
    if not db_instance.is_connected():
        print("❌ Database not connected")
        return
    
    users_collection = db_instance.get_collection('users')
    
    # Find all partners
    partners = list(users_collection.find({
        'role': 'partner',
        'is_active': True
    }))
    
    print(f"\n📊 Found {len(partners)} active partners\n")
    
    for partner in partners:
        username = partner.get('username')
        current_method = partner.get('postback_method', 'Not Set')
        postback_url = partner.get('postback_url', 'Not Set')
        
        print(f"Partner: {username}")
        print(f"  Email: {partner.get('email')}")
        print(f"  Current Method: {current_method}")
        print(f"  Postback URL: {postback_url}")
        
        # Update to POST method
        result = users_collection.update_one(
            {'_id': partner['_id']},
            {'$set': {'postback_method': 'POST'}}
        )
        
        if result.modified_count > 0:
            print(f"  ✅ Updated to POST method")
        else:
            print(f"  ⚠️ No update needed (already POST or no change)")
        print()
    
    print("=" * 60)
    print("✅ All partners processed!")
    print("=" * 60)

if __name__ == '__main__':
    update_partner_methods()
