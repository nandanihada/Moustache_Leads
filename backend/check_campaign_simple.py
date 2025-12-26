import pymongo

# Connect to MongoDB
client = pymongo.MongoClient("mongodb://localhost:27017/")
db = client["affiliate_network"]
offers_collection = db["offers"]

print("\n" + "="*80)
print("CHECKING OFFERS WITH CAMPAIGN_ID")
print("="*80)

# Find offer with campaign_id = VBFS6
offer = offers_collection.find_one({'campaign_id': 'VBFS6'})

if offer:
    print(f"\n✅ FOUND OFFER with campaign_id = VBFS6:")
    print(f"   offer_id: {offer.get('offer_id')}")
    print(f"   campaign_id: {offer.get('campaign_id')}")
    print(f"   name: {offer.get('name')}")
    print(f"   payout: {offer.get('payout')}")
else:
    print(f"\n❌ NO OFFER FOUND with campaign_id = VBFS6")
    print(f"\nSearching all offers to see what we have...")
    
    # Show all offers
    all_offers = list(offers_collection.find({}, {'offer_id': 1, 'campaign_id': 1, 'name': 1}).limit(10))
    
    print(f"\nFound {len(all_offers)} offers:")
    for o in all_offers:
        print(f"   - offer_id: {o.get('offer_id')}, campaign_id: {o.get('campaign_id')}, name: {o.get('name')}")

print("\n" + "="*80)
