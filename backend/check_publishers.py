"""
Quick script to check if publishers exist in database
"""
import sys
import os
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import db_instance

print("=" * 60)
print("🔍 CHECKING PUBLISHERS IN DATABASE")
print("=" * 60)

# Get users collection
users_collection = db_instance.get_collection('users')

if users_collection is None:
    print("❌ Could not connect to database!")
    exit(1)

print("✅ Connected to database")

# Find all publishers
publishers = list(users_collection.find(
    {'role': 'publisher'},
    {'username': 1, 'email': 1, 'role': 1}
))

print(f"\n📊 Found {len(publishers)} publishers:\n")

if publishers:
    for i, pub in enumerate(publishers, 1):
        print(f"{i}. Username: {pub.get('username', 'N/A')}")
        print(f"   Email: {pub.get('email', 'N/A')}")
        print(f"   Role: {pub.get('role', 'N/A')}")
        print()
else:
    print("⚠️  No publishers found!")
    print("\nTo create a publisher account:")
    print("1. Register a new user via the frontend")
    print("2. Make sure the role is set to 'publisher'")
    print("3. Ensure the email field is filled")

print("=" * 60)
