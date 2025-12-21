"""
Check what data we have for debugging postback forwarding
"""
from database import db_instance

# Connect
if not db_instance.is_connected():
    db_instance.connect()

print("="*80)
print("DIAGNOSTIC CHECK")
print("="*80)

# 1. Check recent clicks
print("\n1️⃣ Recent clicks in 'clicks' collection:")
clicks = db_instance.get_collection('clicks')
recent_clicks = list(clicks.find().sort('timestamp', -1).limit(3))
for click in recent_clicks:
    print(f"   - offer_id: {click.get('offer_id')}, user_id: {click.get('user_id')}, placement_id: {click.get('placement_id')}, sub_id1: {click.get('sub_id1')}")

# 2. Check offerwall_clicks_detailed
print("\n2️⃣ Recent clicks in 'offerwall_clicks_detailed' collection:")
offerwall_clicks = db_instance.get_collection('offerwall_clicks_detailed')
if offerwall_clicks:
    recent_offerwall = list(offerwall_clicks.find().sort('timestamp', -1).limit(3))
    for click in recent_offerwall:
        print(f"   - offer_id: {click.get('offer_id')}, user_id: {click.get('user_id')}, placement_id: {click.get('placement_id')}")
else:
    print("   Collection not found")

# 3. Check offers for external_offer_id mapping
print("\n3️⃣ Check offer ML-00057:")
offers = db_instance.get_collection('offers')
offer = offers.find_one({'offer_id': 'ML-00057'})
if offer:
    print(f"   - offer_id: {offer.get('offer_id')}")
    print(f"   - external_offer_id: {offer.get('external_offer_id')}")
    print(f"   - payout: {offer.get('payout')}")
else:
    print("   Offer not found!")

# 4. Check placements
print("\n4️⃣ Check placement zalUDOuAS0gaBh33:")
placements = db_instance.get_collection('placements')
placement = placements.find_one({'$or': [
    {'_id': 'zalUDOuAS0gaBh33'},
    {'placementId': 'zalUDOuAS0gaBh33'},
    {'placement_id': 'zalUDOuAS0gaBh33'}
]})
if placement:
    print(f"   - _id: {placement.get('_id')}")
    print(f"   - created_by: {placement.get('created_by')}")
    print(f"   - publisherId: {placement.get('publisherId')}")
else:
    print("   ⚠️ Placement NOT FOUND!")

# 5. Check recent postbacks
print("\n5️⃣ Most recent received postback:")
received = db_instance.get_collection('received_postbacks')
recent_pb = list(received.find().sort('timestamp', -1).limit(1))
if recent_pb:
    pb = recent_pb[0]
    print(f"   - timestamp: {pb.get('timestamp')}")
    print(f"   - partner_key: {pb.get('partner_key')}")
    print(f"   - params: {pb.get('params')}")
else:
    print("   No postbacks found")

print("\n" + "="*80)
