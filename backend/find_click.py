from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

uri = os.getenv('MONGODB_URI')
client = MongoClient(uri)
db = client['ascend_db']

click_id = "9743656b-1ed3-4f43-91f3-be44c4b01006"

print(f"Searching for click ID: {click_id}")
print("=" * 80)

# Check all click-related collections
collections_to_check = [
    'offerwall_clicks_detailed',
    'offerwall_clicks',
    'clicks',
    'click_tracking'
]

for coll_name in collections_to_check:
    coll = db[coll_name]
    click = coll.find_one({'click_id': click_id})
    if click:
        print(f"\nFOUND in collection: {coll_name}")
        print("=" * 80)
        
        # Print all fields
        for key, value in click.items():
            if key != '_id':
                if isinstance(value, dict):
                    print(f"\n{key}:")
                    for k, v in value.items():
                        print(f"  {k}: {v}")
                else:
                    print(f"{key}: {value}")
        break
else:
    print("\nNOT FOUND in any collection!")

client.close()
