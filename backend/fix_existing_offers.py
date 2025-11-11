"""
Add masked links to existing offers that don't have them
Run this to retroactively add masking to all existing offers
"""
from database import db_instance
from models.link_masking import LinkMasking
import logging

logging.basicConfig(level=logging.INFO)

def fix_existing_offers():
    """Add masked links to offers that don't have them"""
    
    print("\n" + "=" * 70)
    print("🔧 FIXING EXISTING OFFERS - Adding Masked Links")
    print("=" * 70)
    
    # Get masking domain
    link_masking = LinkMasking()
    domains = link_masking.get_masking_domains(active_only=True)
    
    if not domains or len(domains) == 0:
        print("❌ NO MASKING DOMAINS FOUND!")
        print("   Please run: python setup_masking_domain.py")
        return False
    
    default_domain = domains[0]
    print(f"\n✅ Using masking domain: {default_domain['domain']}")
    
    # Get all offers without masked URLs
    offers_collection = db_instance.get_collection('offers')
    offers_without_masking = list(offers_collection.find({
        '$or': [
            {'masked_url': {'$exists': False}},
            {'masked_url': None},
            {'masked_url': ''}
        ],
        'is_active': True
    }))
    
    print(f"\n📊 Found {len(offers_without_masking)} offers without masked links")
    
    if len(offers_without_masking) == 0:
        print("✅ All offers already have masked links!")
        return True
    
    # Get admin user for created_by field
    users_collection = db_instance.get_collection('users')
    admin_user = users_collection.find_one({'role': 'admin'})
    admin_id = str(admin_user['_id']) if admin_user else 'system'
    
    # Process each offer
    success_count = 0
    fail_count = 0
    
    for offer in offers_without_masking:
        try:
            offer_id = offer['offer_id']
            target_url = offer.get('target_url', '')
            
            if not target_url:
                print(f"⚠️  Skipping {offer_id} - No target URL")
                fail_count += 1
                continue
            
            print(f"\n🔄 Processing {offer_id}: {offer['name']}")
            print(f"   Target: {target_url[:60]}...")
            
            # Create masked link
            masking_settings = {
                'domain_id': str(default_domain['_id']),
                'redirect_type': '302',
                'subid_append': True,
                'preview_mode': False,
                'auto_rotation': False,
                'code_length': 8
            }
            
            masked_link, error = link_masking.create_masked_link(
                offer_id,
                target_url,
                masking_settings,
                admin_id
            )
            
            if error:
                print(f"   ❌ Failed: {error}")
                fail_count += 1
                continue
            
            # Update offer with masked URL
            result = offers_collection.update_one(
                {'offer_id': offer_id},
                {'$set': {
                    'masked_url': masked_link['masked_url'],
                    'masked_link_id': str(masked_link['_id'])
                }}
            )
            
            if result.modified_count > 0:
                print(f"   ✅ Masked link: {masked_link['masked_url']}")
                success_count += 1
            else:
                print(f"   ⚠️  Update failed")
                fail_count += 1
                
        except Exception as e:
            print(f"   ❌ Exception: {str(e)}")
            fail_count += 1
    
    # Summary
    print("\n" + "=" * 70)
    print("📊 SUMMARY")
    print("=" * 70)
    print(f"✅ Successfully processed: {success_count} offers")
    print(f"❌ Failed: {fail_count} offers")
    print(f"📝 Total: {len(offers_without_masking)} offers")
    print("=" * 70)
    
    return success_count > 0

if __name__ == '__main__':
    success = fix_existing_offers()
    
    if success:
        print("\n✅ Done! All existing offers now have masked links.")
        print("💡 Future offers will automatically get masked links when created.")
    else:
        print("\n⚠️  Some offers could not be processed. Check errors above.")
