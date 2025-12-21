import pymongo

# Use Atlas connection from .env
uri = "mongodb+srv://nan_db_user:j6trrN5m33t4Jwz8@mustache.0gly4in.mongodb.net/ascend_db?retryWrites=true&w=majority&appName=Mustache&tlsAllowInvalidCertificates=true"

client = pymongo.MongoClient(uri)
db = client["ascend_db"]
offers = db["offers"]

print("="*80)
print("✅ CONNECTED TO ATLAS - ascend_db.offers")
print("="*80)

all_offers = list(offers.find({}, {'_id': 0, 'offer_id': 1, 'campaign_id': 1, 'name': 1}))

print(f"\nTotal offers found: {len(all_offers)}\n")

for i, offer in enumerate(all_offers, 1):
    print(f"{i}. Offer ID: {offer.get('offer_id')}")
    print(f"   Campaign ID: {offer.get('campaign_id', 'NOT SET')}")
    print(f"   Name: {offer.get('name')}")
    print()

print("="*80)
