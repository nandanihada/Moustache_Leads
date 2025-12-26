import pymongo

# Connect to MongoDB
client = pymongo.MongoClient("mongodb://localhost:27017/")
db = client["affiliate_network"]
offers_collection = db["offers"]

print("\n" + "="*80)
print("UPDATING OFFER ML-00098 WITH campaign_id")
print("="*80)

# Update the offer to set campaign_id = VBFS6
result = offers_collection.update_one(
    {'offer_id': 'ML-00098'},
    {'$set': {'campaign_id': 'VBFS6'}}
)

if result.matched_count > 0:
    print(f"\n✅ Updated {result.modified_count} offer(s)")
    
    # Verify
    offer = offers_collection.find_one({'offer_id': 'ML-00098'})
    print(f"\nVerification:")
    print(f"   offer_id: {offer.get('offer_id')}")
    print(f"   campaign_id: {offer.get('campaign_id')}")
    print(f"   name: {offer.get('name')}")
else:
    print(f"\n❌ Offer ML-00098 not found")

print("\n" + "="*80)
