#!/usr/bin/env python3
"""
Diagnostic script to check if an offer has correct approval settings
Usage: python diagnose_offer.py <offer_id>
Example: python diagnose_offer.py ML-00082
"""

import sys
from database import db_instance

if len(sys.argv) < 2:
    print("Usage: python diagnose_offer.py <offer_id>")
    print("Example: python diagnose_offer.py ML-00082")
    sys.exit(1)

offer_id = sys.argv[1]

offers_collection = db_instance.get_collection('offers')
offer = offers_collection.find_one({'offer_id': offer_id})

if not offer:
    print(f"❌ Offer {offer_id} not found")
    sys.exit(1)

print(f"\n{'=' * 80}")
print(f"OFFER DIAGNOSTIC: {offer_id}")
print(f"{'=' * 80}\n")

print(f"📋 Basic Info:")
print(f"  - Name: {offer.get('name')}")
print(f"  - Status: {offer.get('status')}")
print(f"  - Is Active: {offer.get('is_active')}")

print(f"\n🔐 Access Control:")
print(f"  - Affiliates: {offer.get('affiliates')}")
print(f"  - Access Type: {offer.get('access_type')}")

print(f"\n✅ Approval Settings:")
approval_settings = offer.get('approval_settings', {})
print(f"  - Approval Status: {offer.get('approval_status')}")
print(f"  - Type: {approval_settings.get('type', 'N/A')}")
print(f"  - Auto-approve Delay: {approval_settings.get('auto_approve_delay', 'N/A')} minutes")
print(f"  - Require Approval: {approval_settings.get('require_approval', False)}")
print(f"  - Approval Message: {approval_settings.get('approval_message', 'N/A')}")
print(f"  - Max Inactive Days: {approval_settings.get('max_inactive_days', 30)}")

print(f"\n🔍 Validation:")
issues = []

# Check if affiliates is correct
if offer.get('affiliates') not in ['all', 'selected', 'premium', 'request']:
    issues.append(f"❌ Invalid affiliates value: {offer.get('affiliates')}")
else:
    print(f"  ✅ Affiliates value is valid: {offer.get('affiliates')}")

# Check if approval settings exist
if not approval_settings:
    issues.append("❌ No approval_settings found")
else:
    print(f"  ✅ Approval settings exist")

# Check if affiliates should be 'request'
approval_type = approval_settings.get('type', 'auto_approve')
require_approval = approval_settings.get('require_approval', False)

should_be_request = require_approval or approval_type in ['time_based', 'manual']

if should_be_request:
    if offer.get('affiliates') == 'request':
        print(f"  ✅ Affiliates correctly set to 'request' (approval required)")
    else:
        issues.append(f"❌ Affiliates should be 'request' but is '{offer.get('affiliates')}'")
else:
    if offer.get('affiliates') == 'all':
        print(f"  ✅ Affiliates correctly set to 'all' (no approval required)")
    else:
        print(f"  ⚠️  Affiliates is '{offer.get('affiliates')}' (auto-approve immediate)")

print(f"\n{'=' * 80}")
if issues:
    print("❌ ISSUES FOUND:")
    for issue in issues:
        print(f"  {issue}")
    print(f"\n💡 Recommendation: This offer may have been created before the fix.")
    print(f"   Create a new offer with the correct approval settings.")
else:
    print("✅ ALL CHECKS PASSED - Offer is configured correctly!")
print(f"{'=' * 80}\n")
