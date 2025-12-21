import pymongo

uri = "mongodb+srv://nan_db_user:j6trrN5m33t4Jwz8@mustache.0gly4in.mongodb.net/?retryWrites=true&w=majority&tlsAllowInvalidCertificates=true"
client = pymongo.MongoClient(uri)

print("="*80)
print("DATABASE DIAGNOSTIC")
print("="*80)

# Check each database
found_in = None

for db_name in client.list_database_names():
    if db_name in ['admin', 'local', 'config']:
        continue
        
    db = client[db_name]
    if 'offers' in db.list_collection_names():
        offer = db['offers'].find_one({'campaign_id': 'VBFS6'})
        if offer:
            found_in = db_name
            print(f"\nFOUND in database: {db_name}")
            print(f"Offer ID: {offer.get('offer_id')}")
            print(f"Campaign ID: {offer.get('campaign_id')}")
            break

print("\n" + "="*80)
if found_in:
    print(f"Backend config says: ascend_db")
    print(f"Offers actually in: {found_in}")
    if found_in != 'ascend_db':
        print(f"\nMISMATCH! Update config.py line 13 to: DATABASE_NAME = '{found_in}'")
    else:
        print("\nDatabase name is correct!")
else:
    print("No offers found with campaign_id=VBFS6")
print("="*80)
