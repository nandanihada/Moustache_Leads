"""
Test script to verify API import uses ONLY real data (no fake defaults)
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from services.network_field_mapper import network_field_mapper

# Sample offer data from HasOffers API
sample_offer_with_full_data = {
    'Offer': {
        'id': '5404',
        'name': 'Test_Offer_With_Full_Data',
        'description': '<p>This is a real description from API</p>',
        'default_payout': '2.50',
        'currency': 'USD',
        'status': 'active',
        'preview_url': 'https://example.com/offer',
        'conversion_type': 'Survey Complete',
        'device_targeting': 'mobile',
        'traffic_type': 'email',
        'click_expiration_days': 7,
        'protocol': 's2s',
        'payout_type': 'cpa',
        'category': 'Finance',
    },
    'Country': {
        '1': {'code': 'US', 'name': 'United States'},
        '2': {'code': 'CA', 'name': 'Canada'}
    },
    'Thumbnail': {
        'url': 'https://example.com/image.jpg'
    }
}

sample_offer_with_minimal_data = {
    'Offer': {
        'id': '5405',
        'name': 'Test_Offer_Minimal_Data',
        'description': 'Simple description',
        'default_payout': '1.00',
        'preview_url': 'https://example.com/offer2',
        # NO conversion_type, device_targeting, traffic_type, etc.
    }
}

print("="*80)
print("🧪 TESTING REAL DATA EXTRACTION")
print("="*80)

print("\n1️⃣ Testing offer WITH full data:")
print("-" * 80)
mapped1 = network_field_mapper.map_to_db_format(
    sample_offer_with_full_data, 
    network_type='hasoffers',
    network_id='cpamerchant'
)

print(f"\n✅ Mapped fields:")
print(f"   Name: {mapped1.get('name')}")
print(f"   Description: {mapped1.get('description')[:50]}...")
print(f"   Conversion Type: {mapped1.get('conversion_type')} (should be 'Survey Complete')")
print(f"   Device Targeting: {mapped1.get('device_targeting')} (should be 'mobile')")
print(f"   Traffic Type: {mapped1.get('traffic_type')} (should be 'email')")
print(f"   Conversion Window: {mapped1.get('conversion_window')} (should be 7)")
print(f"   Protocol: {mapped1.get('tracking_protocol')} (should be 's2s')")
print(f"   Payout Type: {mapped1.get('offer_type')} (should be 'CPA')")
print(f"   Vertical: {mapped1.get('vertical')} (should be 'Finance')")

# Verify NO fake data in description
description = mapped1.get('description', '')
has_fake_data = any(x in description for x in ['Conversion:', 'Devices:', 'Traffic:'])
print(f"\n   ❌ Has fake data in description: {has_fake_data} (should be False)")

print("\n" + "="*80)
print("2️⃣ Testing offer WITH minimal data (no optional fields):")
print("-" * 80)
mapped2 = network_field_mapper.map_to_db_format(
    sample_offer_with_minimal_data,
    network_type='hasoffers',
    network_id='cpamerchant'
)

print(f"\n✅ Mapped fields:")
print(f"   Name: {mapped2.get('name')}")
print(f"   Description: {mapped2.get('description')}")
print(f"   Conversion Type: '{mapped2.get('conversion_type')}' (should be empty '')")
print(f"   Device Targeting: '{mapped2.get('device_targeting')}' (should be empty '')")
print(f"   Traffic Type: '{mapped2.get('traffic_type')}' (should be empty '')")
print(f"   Conversion Window: {mapped2.get('conversion_window')} (should be None)")
print(f"   Protocol: '{mapped2.get('tracking_protocol')}' (should be empty '')")
print(f"   Vertical: '{mapped2.get('vertical')}' (should be empty '')")

# Verify NO fake defaults
print(f"\n🔍 Checking for fake defaults:")
print(f"   ❌ Device = 'all': {mapped2.get('device_targeting') == 'all'} (should be False)")
print(f"   ❌ Window = 30: {mapped2.get('conversion_window') == 30} (should be False)")
print(f"   ❌ Protocol = 'pixel': {mapped2.get('tracking_protocol') == 'pixel'} (should be False)")
print(f"   ❌ Vertical = 'Lifestyle': {mapped2.get('vertical') == 'Lifestyle'} (should be False)")

print("\n" + "="*80)
print("✅ TEST COMPLETE")
print("="*80)
print("\nExpected results:")
print("  - Full data offer: All fields should have real values from API")
print("  - Minimal data offer: Missing fields should be empty ('', None, []) NOT fake defaults")
print("  - NO 'Conversion:', 'Devices:', 'Traffic:' in description")
print("="*80)
