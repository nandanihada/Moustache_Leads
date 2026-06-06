import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()
from database import db_instance

col = db_instance.get_collection('offers')
# Find Ethos offer
offer = col.find_one({'name': {'$regex': 'Ethos', '$options': 'i'}}, {'offer_id': 1, 'name': 1, 'refined_description': 1, '_id': 0})
if offer:
    print(f"Offer: {offer['name']}")
    print(f"ID: {offer['offer_id']}")
    rd = offer.get('refined_description', {})
    print(f"\nPayout levels: {json.dumps(rd.get('payout_levels', []), indent=2)}")
    print(f"Traffic: {json.dumps(rd.get('traffic_sources', {}), indent=2)}")
    print(f"Restrictions: {rd.get('restrictions', [])}")
    print(f"Summary length: {len(rd.get('summary', ''))}")
