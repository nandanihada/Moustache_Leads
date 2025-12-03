#!/usr/bin/env python3
"""Test if global tracker is set"""

print("🔍 Checking if global tracker is set...")

from routes.offerwall import comprehensive_tracker_global

print(f"comprehensive_tracker_global: {comprehensive_tracker_global}")

if comprehensive_tracker_global is None:
    print("❌ Global tracker is None!")
else:
    print(f"✅ Global tracker is set: {type(comprehensive_tracker_global)}")
