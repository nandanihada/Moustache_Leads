"""Check refined_description for one specific offer"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()
from database import db_instance

col = db_instance.get_collection('offers')

# Check ML-7347258 (Ethos Life - first refined offer)
offer = col.find_one(
    {'offer_id': 'ML-7347258'},
    {'offer_id': 1, 'name': 1, 'refined_description': 1, 'show_in_iframe': 1, 'status': 1, '_id': 0}
)

if offer:
    print(f"Offer: {offer.get('name')}")
    print(f"Status: {offer.get('status')}")
    print(f"show_in_iframe: {offer.get('show_in_iframe')}")
    print(f"Has refined_description: {offer.get('refined_description') is not None}")
    print("")
    rd = offer.get('refined_description')
    if rd:
        print("REFINED DESCRIPTION:")
        print(json.dumps(rd, indent=2))
    else:
        print("NO refined_description found!")
else:
    print("Offer ML-7347258 not found!")
