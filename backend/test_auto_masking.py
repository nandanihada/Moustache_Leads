"""
Test script to verify automatic link masking functionality
Run this after setting up a masking domain
"""
from database import db_instance
from models.offer import Offer
from models.link_masking import LinkMasking
import logging

logging.basicConfig(level=logging.INFO)

def test_auto_masking():
    """Test automatic masked link creation when creating an offer"""
    
    print("=" * 70)
    print("🧪 TESTING AUTOMATIC LINK MASKING")
    print("=" * 70)
    
    # Step 1: Check masking domains
    print("\n1️⃣ Checking masking domains...")
    link_masking = LinkMasking()
    domains = link_masking.get_masking_domains(active_only=True)
    
    if not domains or len(domains) == 0:
        print("❌ NO MASKING DOMAINS FOUND!")
        print("   Please run: python setup_masking_domain.py")
        return False
    
    print(f"✅ Found {len(domains)} active masking domain(s):")
    for domain in domains:
        print(f"   - {domain['domain']} (Priority: {domain.get('priority', 1)})")
    
    # Step 2: Get admin user
    print("\n2️⃣ Getting admin user...")
    users_collection = db_instance.get_collection('users')
    admin_user = users_collection.find_one({'role': 'admin'})
    
    if not admin_user:
        print("❌ NO ADMIN USER FOUND!")
        return False
    
    admin_id = str(admin_user['_id'])
    print(f"✅ Admin user found: {admin_user.get('username', 'Unknown')}")
    
    # Step 3: Create test offer
    print("\n3️⃣ Creating test offer...")
    offer_model = Offer()
    
    test_offer_data = {
        'campaign_id': 'TEST-AUTO-MASK-001',
        'name': 'Test Automatic Masking Offer',
        'description': 'This is a test offer to verify automatic link masking',
        'target_url': 'https://example.com/test-offer?aff=test123',
        'preview_url': 'https://example.com/preview',
        'payout': 10.50,
        'network': 'TestNetwork',
        'countries': ['US', 'CA'],
        'device_targeting': 'all',
        'affiliates': 'all',
        'status': 'active'
    }
    
    offer_data, error = offer_model.create_offer(test_offer_data, admin_id)
    
    if error:
        print(f"❌ OFFER CREATION FAILED: {error}")
        return False
    
    print(f"✅ Offer created: {offer_data['offer_id']}")
    
    # Step 4: Simulate automatic masking (as done in admin_offers.py)
    print("\n4️⃣ Generating automatic masked link...")
    
    try:
        default_domain = domains[0]
        
        masking_settings = {
            'domain_id': str(default_domain['_id']),
            'redirect_type': '302',
            'subid_append': True,
            'preview_mode': False,
            'auto_rotation': False,
            'code_length': 8
        }
        
        masked_link, mask_error = link_masking.create_masked_link(
            offer_data['offer_id'],
            offer_data['target_url'],
            masking_settings,
            admin_id
        )
        
        if mask_error:
            print(f"❌ MASKED LINK CREATION FAILED: {mask_error}")
            return False
        
        print(f"✅ Masked link created: {masked_link['masked_url']}")
        print(f"   Short code: {masked_link['short_code']}")
        print(f"   Domain: {masked_link['domain_name']}")
        
        # Step 5: Update offer with masked URL
        print("\n5️⃣ Updating offer with masked URL...")
        from bson import ObjectId
        offer_collection = db_instance.get_collection('offers')
        
        result = offer_collection.update_one(
            {'offer_id': offer_data['offer_id']},
            {'$set': {
                'masked_url': masked_link['masked_url'],
                'masked_link_id': str(masked_link['_id'])
            }}
        )
        
        if result.modified_count > 0:
            print("✅ Offer updated with masked URL")
        else:
            print("⚠️  Offer update failed or no changes made")
        
        # Step 6: Verify the complete flow
        print("\n6️⃣ Verifying complete flow...")
        updated_offer = offer_model.get_offer_by_id(offer_data['offer_id'])
        
        if updated_offer and updated_offer.get('masked_url'):
            print("✅ VERIFICATION SUCCESSFUL!")
            print("\n" + "=" * 70)
            print("📊 FINAL OFFER DATA:")
            print("=" * 70)
            print(f"Offer ID: {updated_offer['offer_id']}")
            print(f"Name: {updated_offer['name']}")
            print(f"Target URL: {updated_offer['target_url']}")
            print(f"Masked URL: {updated_offer['masked_url']}")
            print(f"Masked Link ID: {updated_offer.get('masked_link_id', 'N/A')}")
            print("=" * 70)
            
            # Cleanup option
            print("\n💡 Test offer created successfully!")
            cleanup = input("\nDo you want to delete the test offer? (y/n): ").lower().strip()
            
            if cleanup == 'y':
                # Delete offer
                offer_collection.delete_one({'offer_id': offer_data['offer_id']})
                # Delete masked link
                masked_links_collection = db_instance.get_collection('masked_links')
                masked_links_collection.delete_one({'_id': masked_link['_id']})
                print("✅ Test data cleaned up")
            else:
                print("ℹ️  Test offer kept in database")
            
            return True
        else:
            print("❌ VERIFICATION FAILED - Offer does not have masked_url")
            return False
            
    except Exception as e:
        print(f"❌ EXCEPTION OCCURRED: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = test_auto_masking()
    
    if success:
        print("\n" + "=" * 70)
        print("✅ ALL TESTS PASSED!")
        print("=" * 70)
        print("\n📝 Next Steps:")
        print("   1. The automatic masking is working correctly")
        print("   2. All new offers will automatically get masked links")
        print("   3. Users will see masked URLs in the offer details")
    else:
        print("\n" + "=" * 70)
        print("❌ TESTS FAILED - Please check the errors above")
        print("=" * 70)
