#!/usr/bin/env python3
"""
Setup test rotation rules for testing
"""

def setup_test_rotation_rules():
    """Add rotation rules to an offer for testing"""
    
    try:
        from models.offer_extended import OfferExtended
        
        # Test offer ID
        offer_id = "ML-00037"
        
        # Create test rotation rules
        test_smart_rules = [
            {
                "id": "rule_1",
                "type": "Rotation",
                "url": "https://google.com",
                "geo": [],
                "percentage": 50,  # 50% weight
                "cap": 1000,
                "priority": 1,
                "active": True
            },
            {
                "id": "rule_2", 
                "type": "Rotation",
                "url": "https://bing.com",
                "geo": [],
                "percentage": 30,  # 30% weight
                "cap": 1000,
                "priority": 2,
                "active": True
            },
            {
                "id": "rule_3",
                "type": "Rotation", 
                "url": "https://duckduckgo.com",
                "geo": [],
                "percentage": 20,  # 20% weight
                "cap": 1000,
                "priority": 3,
                "active": True
            }
        ]
        
        print(f"🔧 Setting up test rotation rules for offer {offer_id}")
        print("📊 Rotation Rules:")
        for rule in test_smart_rules:
            print(f"  - {rule['url']} ({rule['percentage']}%)")
        
        # Get the extended model
        extended_model = OfferExtended()
        
        # Get existing offer
        offer = extended_model.get_offer_by_id(offer_id)
        
        if not offer:
            print(f"❌ Offer {offer_id} not found")
            return False
        
        # Update with smart rules
        update_data = {
            "smartRules": test_smart_rules
        }
        
        # Update the offer
        success, error_msg = extended_model.update_offer(offer_id, update_data, "test_user")
        
        if success:
            print(f"✅ Successfully added rotation rules to offer {offer_id}")
            return True
        else:
            print(f"❌ Failed to update offer: {error_msg}")
            return False
            
    except ImportError:
        print("❌ OfferExtended model not available")
        return False
    except Exception as e:
        print(f"❌ Error setting up rotation rules: {str(e)}")
        return False

def verify_rotation_rules():
    """Verify the rotation rules were added correctly"""
    
    try:
        from models.offer_extended import OfferExtended
        
        offer_id = "ML-00037"
        extended_model = OfferExtended()
        
        offer = extended_model.get_offer_by_id(offer_id)
        
        if not offer:
            print(f"❌ Offer {offer_id} not found")
            return
        
        smart_rules = offer.get('smartRules', [])
        rotation_rules = [rule for rule in smart_rules if rule.get('type') == 'Rotation']
        
        print(f"🔍 Verification for offer {offer_id}:")
        print(f"  Total Smart Rules: {len(smart_rules)}")
        print(f"  Rotation Rules: {len(rotation_rules)}")
        
        if rotation_rules:
            print("📊 Rotation Rules Found:")
            total_weight = 0
            for rule in rotation_rules:
                url = rule.get('url', 'N/A')
                # Try different field names for weight
                weight = rule.get('splitPercentage', rule.get('percentage', rule.get('split', 0)))
                active = rule.get('active', False)
                total_weight += weight
                status = "✅ Active" if active else "❌ Inactive"
                print(f"  - {url} ({weight}%) {status}")
                # Debug: show the actual rule structure
                print(f"    Debug: {rule}")
            
            print(f"📊 Total Weight: {total_weight}%")
            
            if total_weight == 100:
                print("✅ Weights sum to 100% - Perfect!")
            else:
                print(f"⚠️ Weights sum to {total_weight}% - Should be 100%")
        else:
            print("❌ No rotation rules found")
            
    except Exception as e:
        print(f"❌ Error verifying rotation rules: {str(e)}")

def main():
    """Setup and verify rotation rules"""
    
    print("🚀 ROTATION RULES SETUP")
    print("=" * 50)
    
    # Setup rotation rules
    success = setup_test_rotation_rules()
    
    if success:
        print("\n" + "=" * 50)
        # Verify they were added
        verify_rotation_rules()
        
        print("\n" + "=" * 50)
        print("🎉 SETUP COMPLETE!")
        print("📋 Next Steps:")
        print("1. Run: python test_rotation_logic.py")
        print("2. Check server logs for rotation selection details")
        print("3. Verify distribution matches expected percentages")
    else:
        print("\n❌ Setup failed - check error messages above")

if __name__ == "__main__":
    main()
