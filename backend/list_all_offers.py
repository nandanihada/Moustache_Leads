import pymongo

client = pymongo.MongoClient("mongodb://localhost:27017/")
db = client["affiliate_network"]
offers = db["offers"]

print("="*80)
print("ALL OFFERS IN DATABASE")
print("="*80)

all_offers = list(offers.find({}, {'_id': 0, 'offer_id': 1, 'campaign_id': 1, 'name': 1}))

for i, offer in enumerate(all_offers, 1):
    print(f"\n{i}. Offer ID: {offer.get('offer_id')}")
    print(f"   Campaign ID: {offer.get('campaign_id', 'NOT SET')}")
    print(f"   Name: {offer.get('name')}")

print("\n" + "="*80)
print(f"TOTAL OFFERS: {len(all_offers)}")
print("="*80)
