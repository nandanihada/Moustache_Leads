import pymongo
from datetime import datetime

# Connect to Atlas (same as backend)
uri = "mongodb+srv://nan_db_user:j6trrN5m33t4Jwz8@mustache.0gly4in.mongodb.net/ascend_db?retryWrites=true&w=majority&tlsAllowInvalidCertificates=true"

client = pymongo.MongoClient(uri)
db = client["ascend_db"]
offers = db["offers"]

print("="*80)
print("CREATING TEST OFFER IN ATLAS")
print("="*80)

# Check if offer already exists
existing = offers.find_one({'campaign_id': 'VBFS6'})

if existing:
    print("\nOffer with campaign_id=VBFS6 already exists!")
    print(f"  offer_id: {existing.get('offer_id')}")
    print(f"  campaign_id: {existing.get('campaign_id')}")
    print(f"  name: {existing.get('name')}")
else:
    # Create new offer
    new_offer = {
        'offer_id': 'ML-TEST-001',
        'campaign_id': 'VBFS6',
        'name': 'Test Survey Offer',
        'payout': 500,
        'currency': 'USD',
        'network': 'Direct',
        'target_url': 'https://example.com/test',
        'status': 'active',
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow()
    }
    
    result = offers.insert_one(new_offer)
    print(f"\n✅ Created new offer:")
    print(f"  _id: {result.inserted_id}")
    print(f"  offer_id: ML-TEST-001")
    print(f"  campaign_id: VBFS6")
    print(f"  payout: 500")

print("\n" + "="*80)
print("VERIFICATION")
print("="*80)

# Verify we can find it
verify = offers.find_one({'campaign_id': 'VBFS6'})
if verify:
    print("\n✅ SUCCESS! Offer can be found by campaign_id")
    print(f"\nOffer details:")
    print(f"  offer_id: {verify.get('offer_id')}")
    print(f"  campaign_id: {verify.get('campaign_id')}")
    print(f"  name: {verify.get('name')}")
    print(f"  payout: {verify.get('payout')}")
else:
    print("\n❌ FAILED - Cannot find offer")

print("\n" + "="*80)
print("Now restart backend and test postback!")
print("="*80)
