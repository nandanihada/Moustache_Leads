#!/usr/bin/env python3
"""Test ObjectId conversion"""

from bson import ObjectId

# Test with the signal ID from the test
signal_id_str = "692e9445791b00f07c15498d"

print(f"Original string: {signal_id_str}")
print(f"String length: {len(signal_id_str)}")

try:
    obj_id = ObjectId(signal_id_str)
    print(f"✅ Converted to ObjectId: {obj_id}")
    print(f"ObjectId type: {type(obj_id)}")
except Exception as e:
    print(f"❌ Failed to convert: {e}")
