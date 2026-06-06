import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()
from database import db_instance

col = db_instance.get_collection('offers')
count1 = col.count_documents({'refined_description': {'$exists': True}})
count2 = col.count_documents({'refined_description': {'$type': 'object'}})
print(f"Has refined_description field: {count1}")
print(f"refined_description is object: {count2}")

# Check the specific Disney offer
one = col.find_one({'offer_id': 'ML-1827595'}, {'offer_id':1, 'is_active':1, '_id':0})
if one:
    print(f"ML-1827595 is_active: {one.get('is_active')}")
else:
    print("ML-1827595 NOT FOUND")

# Check how many offers are in the offerwall response (status running/active)
active_running = col.count_documents({'is_active': True, 'status': {'$in': ['running', 'active']}})
print(f"Active+Running offers: {active_running}")
