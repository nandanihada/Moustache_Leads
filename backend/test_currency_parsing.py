"""
Test script to demonstrate currency parsing functionality for bulk offer uploads
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from utils.bulk_offer_upload import parse_payout_value

# Test cases for currency parsing
test_cases = [
    # Format: (input, expected_output)
    ("$42", (42.0, 0, 'USD')),
    ("€30", (30.0, 0, 'EUR')),
    ("£25", (25.0, 0, 'GBP')),
    ("₹100", (100.0, 0, 'INR')),
    ("¥500", (500.0, 0, 'JPY')),
    ("4%", (0, 4.0, 'USD')),
    ("50%", (0, 50.0, 'USD')),
    ("10.50", (10.50, 0, 'USD')),
    ("$10.50", (10.50, 0, 'USD')),
    ("€15.75", (15.75, 0, 'EUR')),
    ("R$50", (50.0, 0, 'BRL')),
    ("C$35", (35.0, 0, 'CAD')),
    ("A$40", (40.0, 0, 'AUD')),
]

print("=" * 80)
print("CURRENCY PARSING TEST RESULTS")
print("=" * 80)
print()

passed = 0
failed = 0

for input_str, expected in test_cases:
    try:
        result = parse_payout_value(input_str)
        if result == expected:
            print(f"✅ PASS: '{input_str}' -> {result}")
            passed += 1
        else:
            print(f"❌ FAIL: '{input_str}'")
            print(f"   Expected: {expected}")
            print(f"   Got:      {result}")
            failed += 1
    except Exception as e:
        print(f"❌ ERROR: '{input_str}' raised {type(e).__name__}: {e}")
        failed += 1

print()
print("=" * 80)
print(f"SUMMARY: {passed} passed, {failed} failed out of {len(test_cases)} tests")
print("=" * 80)
