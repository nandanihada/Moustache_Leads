#!/usr/bin/env python3
"""
Verify that publishers cannot access the offer now
"""

from database import db_instance
from services.access_control_service import AccessControlService

offers_collection = db_instance.get_collection('offers')
users_collection = db_instance.get_collection('users')

# Get the offer
offer = offers_collection.find_one({'name': {'$regex': 'offer workflow test', '$options': 'i'}})

if not offer:
    print("❌ Offer not found")
    exit(1)

print("\n" + "="*80)
print("🔍 VERIFYING PUBLISHER ACCESS CONTROL")
print("="*80)

print(f"\n📋 Offer: {offer.get('name')} ({offer.get('offer_id')})")
print(f"   Affiliates: {offer.get('affiliates')}")

# Get a publisher user
publisher = users_collection.find_one({'role': 'publisher', 'is_active': True})

if not publisher:
    print("\n❌ No active publisher user found for testing")
    exit(1)

print(f"\n👤 Publisher: {publisher.get('username')} ({publisher.get('email')})")

# Check access using the access control service
access_service = AccessControlService()
has_access, reason = access_service.check_offer_access(offer['offer_id'], publisher['_id'])

print(f"\n🔐 Access Check Result:")
print(f"   Has Access: {has_access}")
print(f"   Reason: {reason}")

print("\n" + "="*80)
if not has_access:
    print("✅ CORRECT! Publisher does NOT have access")
    print("   They will need to request access first")
else:
    print("❌ PROBLEM! Publisher still has access")
    print("   They should NOT have access without approval")
print("="*80 + "\n")
