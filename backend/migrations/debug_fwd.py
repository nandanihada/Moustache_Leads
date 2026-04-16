import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from database import db_instance

fwd = db_instance.get_collection('forwarded_postbacks')
conv = db_instance.get_collection('conversions')
pts = db_instance.get_collection('points_transactions')

print("=== FORWARDED POSTBACKS ===")
total = fwd.count_documents({})
with_source = fwd.count_documents({'source': {'$exists': True}})
without_source = fwd.count_documents({'source': {'$exists': False}})
leopard_count = fwd.count_documents({'publisher_name': 'leopard'})
print(f"Total: {total}")
print(f"With source field: {with_source}")
print(f"Without source field: {without_source}")
print(f"Leopard records: {leopard_count}")

# Sample a leopard record
sample = fwd.find_one({'publisher_name': 'leopard'})
if sample:
    print("\n--- Sample leopard forwarded_postback ---")
    sample['_id'] = str(sample['_id'])
    for k, v in sorted(sample.items()):
        print(f"  {k}: {repr(v)[:150]}")

print("\n=== CONVERSIONS ===")
conv_total = conv.count_documents({})
conv_with_source = conv.count_documents({'source': {'$exists': True}})
conv_without_source = conv.count_documents({'source': {'$exists': False}})
print(f"Total: {conv_total}")
print(f"With source: {conv_with_source}")
print(f"Without source: {conv_without_source}")

print("\n=== POINTS TRANSACTIONS ===")
pts_total = pts.count_documents({})
pts_with_source = pts.count_documents({'source': {'$exists': True}})
pts_without_source = pts.count_documents({'source': {'$exists': False}})
pts_offer = pts.count_documents({'type': 'offer_completion'})
print(f"Total: {pts_total}")
print(f"With source: {pts_with_source}")
print(f"Without source: {pts_without_source}")
print(f"Offer completions: {pts_offer}")
