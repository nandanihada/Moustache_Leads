"""
Add external_offer_id mapping to offers
This maps the upward partner's offer ID to your internal offer ID
"""
from database import db_instance
from datetime import datetime

# Connect to database
if not db_instance.is_connected():
    db_instance.connect()

offers_collection = db_instance.get_collection('offers')

print("="*80)
print("ADD EXTERNAL OFFER ID MAPPING")
print("="*80)

# Show existing offers
print("\n📋 Your Existing Offers:")
offers = list(offers_collection.find({}, {'offer_id': 1, 'name': 1, 'external_offer_id': 1}))

for i, offer in enumerate(offers, 1):
    external_id = offer.get('external_offer_id', 'Not set')
    print(f"{i}. {offer.get('offer_id')} - {offer.get('name')} (External: {external_id})")

if not offers:
    print("   No offers found!")
else:
    print("\n" + "="*80)
    
    # Get user input
    choice = input("\nEnter offer number to update (or 'q' to quit): ").strip()
    
    if choice.lower() != 'q' and choice.isdigit():
        idx = int(choice) - 1
        if 0 <= idx < len(offers):
            selected_offer = offers[idx]
            
            print(f"\n✅ Selected: {selected_offer.get('name')} ({selected_offer.get('offer_id')})")
            
            external_id = input("\nEnter upward partner's offer ID (e.g., VBFS6): ").strip()
            
            if external_id:
                # Update the offer
                result = offers_collection.update_one(
                    {'_id': selected_offer['_id']},
                    {
                        '$set': {
                            'external_offer_id': external_id,
                            'updated_at': datetime.utcnow()
                        }
                    }
                )
                
                if result.modified_count > 0:
                    print(f"\n✅ Mapping Added Successfully!")
                    print(f"   Your Offer ID: {selected_offer.get('offer_id')}")
                    print(f"   External Offer ID: {external_id}")
                    print(f"\n📝 When upward partner sends postback with offer_id={external_id},")
                    print(f"   system will map it to {selected_offer.get('offer_id')} and find the correct click!")
                else:
                    print("\n⚠️ No changes made")
            else:
                print("\n❌ External offer ID cannot be empty")
        else:
            print("\n❌ Invalid choice")
    else:
        print("\n👋 Cancelled")

print("\n" + "="*80)
