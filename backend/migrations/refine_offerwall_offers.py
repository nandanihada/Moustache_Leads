"""Refine ONLY the offers currently visible in the offerwall API (no Groq, uses fallback)"""
import sys, os, requests, datetime
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()
from database import db_instance
from services.description_refiner_service import _fallback_parse

col = db_instance.get_collection('offers')

# Get the actual offer IDs from the offerwall API
print("Fetching offers from offerwall API...")
try:
    r = requests.get('http://localhost:5000/api/offerwall/offers?placement_id=test123&user_id=user456&limit=500', timeout=30)
    data = r.json()
    offer_ids = [o['id'] for o in data.get('offers', [])]
    print(f"Offerwall returns {len(offer_ids)} offers")
except Exception as e:
    print(f"Error fetching from API: {e}")
    sys.exit(1)

# Filter to those without refined_description
unrefined_ids = []
for oid in offer_ids:
    doc = col.find_one({'offer_id': oid}, {'refined_description': 1, '_id': 0})
    if doc and not doc.get('refined_description'):
        unrefined_ids.append(oid)

print(f"Already refined: {len(offer_ids) - len(unrefined_ids)}")
print(f"Need refining: {len(unrefined_ids)}")

if not unrefined_ids:
    print("All offerwall offers are refined!")
    sys.exit(0)

# Refine them with fallback parser
updated = 0
for oid in unrefined_ids:
    offer = col.find_one({'offer_id': oid}, {'name': 1, 'description': 1, 'payout': 1, '_id': 0})
    if not offer:
        continue
    
    refined = _fallback_parse(offer.get('name', ''), offer.get('description', ''), float(offer.get('payout', 0) or 0))
    col.update_one({'offer_id': oid}, {'$set': {'refined_description': refined, 'refined_at': datetime.datetime.now(datetime.timezone.utc)}})
    updated += 1
    
print(f"\n✅ Refined {updated} offerwall offers with fallback parser")
print("Reload the offerwall to see updated descriptions.")
