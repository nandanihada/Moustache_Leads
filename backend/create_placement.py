from pymongo import MongoClient
import os
from dotenv import load_dotenv
from bson import ObjectId

load_dotenv()

uri = os.getenv('MONGODB_URI')
client = MongoClient(uri)
db = client['ascend_db']

# Create a test placement
placement_id = "mdCFVq5REUxE2pYj"

# First, check if we have any publishers
publishers_col = db.publishers
publisher = publishers_col.find_one()

if not publisher:
    print("No publishers found! Creating a test publisher first...")
    # Create a test publisher
    test_publisher = {
        'name': 'Test Publisher',
        'email': 'test@publisher.com',
        'status': 'active',
        'created_at': '2025-12-03T00:00:00'
    }
    result = publishers_col.insert_one(test_publisher)
    publisher_id = result.inserted_id
    print(f"Created test publisher with ID: {publisher_id}")
else:
    publisher_id = publisher['_id']
    print(f"Found existing publisher: {publisher.get('name')} (ID: {publisher_id})")

# Now create the placement
placements_col = db.placements

# Check if placement already exists
existing = placements_col.find_one({'_id': placement_id})
if existing:
    print(f"\nPlacement {placement_id} already exists!")
else:
    # Create new placement
    new_placement = {
        '_id': placement_id,  # Use the string ID directly
        'publisherId': publisher_id,
        'name': 'Test Offerwall Placement',
        'type': 'offerwall',
        'status': 'active',
        'created_at': '2025-12-03T00:00:00'
    }
    
    placements_col.insert_one(new_placement)
    print(f"\n✅ Created placement: {placement_id}")
    print(f"   Publisher ID: {publisher_id}")
    print(f"   Publisher Name: {publisher.get('name', 'Unknown')}")

# Verify
placement = placements_col.find_one({'_id': placement_id})
if placement:
    print(f"\n✅ Verification successful!")
    print(f"   Placement _id: {placement.get('_id')}")
    print(f"   Publisher ID: {placement.get('publisherId')}")
else:
    print(f"\n❌ Verification failed - placement not found")

client.close()
