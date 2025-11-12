"""
Check when clicks with flags were created
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

client = MongoClient(os.getenv('MONGO_URI', 'mongodb://localhost:27017/'))
db = client['affiliate_system']

# Find clicks with boolean flags
clicks_with_flags = list(db.clicks.find({'is_unique': {'$ne': None}}).limit(5))
print('Clicks with boolean flags:')
for click in clicks_with_flags:
    print(f'  Date: {click.get("click_time")}, is_unique: {click.get("is_unique")}')

# Find clicks with None flags  
clicks_with_none = list(db.clicks.find({'is_unique': None}).limit(5))
print('\nClicks with None flags:')
for click in clicks_with_none:
    print(f'  Date: {click.get("click_time")}, is_unique: {click.get("is_unique")}')

# Count each type
total_clicks = db.clicks.count_documents({})
clicks_with_bool_flags = db.clicks.count_documents({'is_unique': {'$ne': None}})
clicks_with_none_flags = db.clicks.count_documents({'is_unique': None})

print(f'\nSummary:')
print(f'  Total clicks: {total_clicks}')
print(f'  Clicks with boolean flags: {clicks_with_bool_flags}')
print(f'  Clicks with None flags: {clicks_with_none_flags}')
