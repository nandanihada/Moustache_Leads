import pymongo

# Connect to Atlas
uri = "mongodb+srv://nan_db_user:j6trrN5m33t4Jwz8@mustache.0gly4in.mongodb.net/?retryWrites=true&w=majority&tlsAllowInvalidCertificates=true"

client = pymongo.MongoClient(uri)

print("="*80)
print("🔍 CHECKING ALL DATABASES IN ATLAS")
print("="*80)

# List all databases
db_list = client.list_database_names()
print(f"\nFound {len(db_list)} databases:")
for db_name in db_list:
    print(f"  - {db_name}")

print("\n" + "="*80)
print("🔍 CHECKING EACH DATABASE FOR 'offers' COLLECTION")
print("="*80)

for db_name in db_list:
    db = client[db_name]
    collections = db.list_collection_names()
    
    if 'offers' in collections:
        print(f"\n✅ Database: {db_name}")
        print(f"   Has 'offers' collection!")
        
        # Count offers
        offers_count = db['offers'].count_documents({})
        print(f"   Total offers: {offers_count}")
        
        if offers_count > 0:
            # Show first offer
            sample_offer = db['offers'].find_one({}, {'offer_id': 1, 'campaign_id': 1, 'name': 1})
            print(f"\n   Sample offer:")
            print(f"   - offer_id: {sample_offer.get('offer_id')}")
            print(f"   - campaign_id: {sample_offer.get('campaign_id', 'NOT SET')}")
            print(f"   - name: {sample_offer.get('name')}")

print("\n" + "="*80)
