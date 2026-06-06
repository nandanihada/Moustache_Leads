"""
Quick fallback refine: Use local parser (NO Groq API) for all offers still missing refined_description.
This provides basic structuring without hitting rate limits.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()
from database import db_instance
from services.description_refiner_service import _fallback_parse
import datetime

col = db_instance.get_collection('offers')

# Find all active offers without refined_description
query = {
    'is_active': True,
    '$or': [
        {'refined_description': {'$exists': False}},
        {'refined_description': None}
    ]
}

offers = list(col.find(query, {'offer_id': 1, 'name': 1, 'description': 1, 'payout': 1, '_id': 0}).limit(1000))
print(f"Found {len(offers)} offers without refined_description")
print("Applying fallback parser (no API calls)...")

updated = 0
for i, offer in enumerate(offers):
    oid = offer.get('offer_id', '')
    name = offer.get('name', '')
    desc = offer.get('description', '')
    payout = float(offer.get('payout', 0) or 0)
    
    refined = _fallback_parse(name, desc, payout)
    
    col.update_one(
        {'offer_id': oid},
        {'$set': {
            'refined_description': refined,
            'refined_at': datetime.datetime.now(datetime.timezone.utc)
        }}
    )
    updated += 1

print(f"\n✅ Updated {updated} offers with fallback-parsed descriptions")
print("These will show basic structure. Re-run the Groq migration tomorrow for AI-quality refinement.")
