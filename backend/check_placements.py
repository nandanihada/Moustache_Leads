from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

uri = os.getenv('MONGODB_URI')
client = MongoClient(uri)
db = client['ascend_db']

placement_id = "mdCFVq5REUxE2pYj"

print(f"Searching for placement ID: {placement_id}")
print("=" * 80)

# Check what fields placements have
placements_col = db.placements
sample_placement = placements_col.find_one()

if sample_placement:
    print("\nSample placement structure:")
    for key, value in sample_placement.items():
        print(f"  {key}: {type(value).__name__} = {value}")

# Try to find the specific placement
print(f"\n\nSearching for placement: {placement_id}")
print("-" * 80)

# Try different search methods
placement1 = placements_col.find_one({'_id': placement_id})
print(f"Search by _id (string): {placement1 is not None}")

placement2 = placements_col.find_one({'placement_id': placement_id})
print(f"Search by placement_id field: {placement2 is not None}")

placement3 = placements_col.find_one({'placementId': placement_id})
print(f"Search by placementId field: {placement3 is not None}")

# Show all placements
print(f"\n\nAll placements in database:")
print("-" * 80)
all_placements = list(placements_col.find().limit(10))
for p in all_placements:
    print(f"ID: {p.get('_id')}, placement_id: {p.get('placement_id')}, placementId: {p.get('placementId')}, publisherId: {p.get('publisherId')}")

client.close()
