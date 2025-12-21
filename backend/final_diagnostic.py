import pymongo

# Connect to Atlas
uri = "mongodb+srv://nan_db_user:j6trrN5m33t4Jwz8@mustache.0gly4in.mongodb.net/?retryWrites=true&w=majority&tlsAllowInvalidCertificates=true"

client = pymongo.MongoClient(uri)

print("="*80)
print("FINAL DIAGNOSTIC: Finding offers in Atlas")
print("="*80)

# List all databases
print("\n1. All databases in cluster:")
db_list = client.list_database_names()
for db_name in db_list:
    print(f"   - {db_name}")

# Check each database for offers with campaign_id
print("\n2. Searching for offers with campaign_id=VBFS6...")

found_db = None
found_offer = None

for db_name in db_list:
    db = client[db_name]
    
    # Skip system databases
    if db_name in ['admin', 'local', 'config']:
        continue
        
    collections = db.list_collection_names()
    if 'offers' in collections:
        offers = db['offers']
        offer = offers.find_one({'campaign_id': 'VBFS6'})
        
        if offer:
            found_db = db_name
            found_offer = offer
            print(f"\n✅ FOUND in database: {db_name}")
            print(f"   Offer ID: {offer.get('offer_id')}")
            print(f"   Campaign ID: {offer.get('campaign_id')}")
            print(f"   Name: {offer.get('name')}")
            break

print("\n" + "="*80)
print("RESULT:")
print("="*80)

if found_db:
    print(f"\n✅ Offers exist in database: '{found_db}'")
    print(f"\nCurrent config.py says: DATABASE_NAME = 'ascend_db'")
    
    if found_db != 'ascend_db':
        print(f"\n⚠️  MISMATCH DETECTED!")
        print(f"\n   Backend is using: 'ascend_db'")
        print(f"   Offers are in: '{found_db}'")
        print(f"\n   👉 SOLUTION: Update config.py line 13 to:")
        print(f"      DATABASE_NAME = '{found_db}'")
    else:
        print(f"\n✅ Database name matches! Something else is wrong.")
else:
    print(f"\n❌ No offers with campaign_id=VBFS6 found in any database")

print("\n" + "="*80)
