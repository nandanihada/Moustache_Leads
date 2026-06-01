"""
Fix existing offers that have incorrect country ['US'] by re-extracting from offer name.
Uses the updated _extract_countries_from_text with full ISO 3166-1 codes and false positive filtering.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from database import db_instance
from services.network_field_mapper import NetworkFieldMapper

mapper = NetworkFieldMapper()
offers_col = db_instance.get_collection('offers')

# Find offers that only have ['US'] as countries
us_only_offers = list(offers_col.find(
    {'countries': ['US'], 'is_active': True},
    {'name': 1, 'offer_id': 1, 'countries': 1, 'description': 1}
))

print(f"Found {len(us_only_offers)} offers with countries=['US']")
print("=" * 60)

fixed = 0
skipped = 0

for offer in us_only_offers:
    name = offer.get('name', '')
    description = offer.get('description', '')
    
    # Try to extract countries from name
    extracted = mapper._extract_countries_from_text(name)
    
    # If nothing from name, try description
    if not extracted and description:
        extracted = mapper._extract_countries_from_text(description)
    
    if extracted and set(extracted) != {'US'}:
        # Use extracted countries (remove US if it was also found alongside real countries)
        new_countries = [c for c in extracted if c != 'US'] if len(extracted) > 1 else extracted
        if new_countries:
            offers_col.update_one(
                {'_id': offer['_id']},
                {'$set': {'countries': new_countries}}
            )
            print(f"  ✅ {offer.get('offer_id', '?'):12s} | {name[:45]:45s} → {new_countries}")
            fixed += 1
        else:
            skipped += 1
    else:
        skipped += 1

print("=" * 60)
print(f"Fixed: {fixed} offers")
print(f"Skipped: {skipped} offers (genuinely US or no country in name)")
