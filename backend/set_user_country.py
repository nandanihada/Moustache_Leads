import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import db_instance

# Get username from command line
if len(sys.argv) < 2:
    print("Usage: python set_user_country.py <username> <country_code>")
    print("Example: python set_user_country.py jatin IN")
    sys.exit(1)

username = sys.argv[1]
country_code = sys.argv[2] if len(sys.argv) > 2 else 'IN'

users_col = db_instance.get_collection('users')

# Find user
user = users_col.find_one({'username': username})

if not user:
    print(f"User '{username}' not found")
    sys.exit(1)

# Update user country
result = users_col.update_one(
    {'_id': user['_id']},
    {'$set': {'country': country_code, 'address.country': country_code}}
)

if result.modified_count > 0:
    print(f"Successfully set country to '{country_code}' for user '{username}'")
    print(f"User: {user.get('username')}")
    print(f"Email: {user.get('email')}")
    print(f"New Country: {country_code}")
else:
    print(f"User already has country set to '{country_code}'")
