#!/usr/bin/env python3
"""
Quick test of incentive type calculation
"""

import sys
sys.path.append('.')

# Test the calculation logic directly
def calculate_incentive_type(payout_type='fixed', revenue_share_percent=None):
    """Calculate incentive type"""
    if payout_type == 'percentage':
        return 'Non-Incent'
    if revenue_share_percent and float(revenue_share_percent) > 0:
        return 'Non-Incent'
    return 'Incent'

# Test cases
test_cases = [
    ('fixed', 0, 'Incent'),
    ('percentage', 10, 'Non-Incent'),
    ('tiered', 0, 'Incent'),
    ('fixed', None, 'Incent'),
]

print("\n" + "="*80)
print("  INCENTIVE TYPE CALCULATION TEST")
print("="*80 + "\n")

print(f"{'Payout Type':<15} {'Revenue %':<12} {'Expected':<15} {'Actual':<15} {'Status':<10}")
print("-" * 70)

all_passed = True
for payout_type, revenue_pct, expected in test_cases:
    actual = calculate_incentive_type(payout_type, revenue_pct)
    status = "✅ PASS" if actual == expected else "❌ FAIL"
    if actual != expected:
        all_passed = False
    
    revenue_str = str(revenue_pct) if revenue_pct is not None else "None"
    print(f"{payout_type:<15} {revenue_str:<12} {expected:<15} {actual:<15} {status:<10}")

print("\n" + "="*80)
if all_passed:
    print("  ✅ ALL TESTS PASSED!")
else:
    print("  ❌ SOME TESTS FAILED!")
print("="*80 + "\n")
