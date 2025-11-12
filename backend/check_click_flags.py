"""
Check the click flag values
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

client = MongoClient(os.getenv('MONGO_URI', 'mongodb://localhost:27017/'))
db = client['affiliate_system']

clicks = list(db.clicks.find().limit(10))
print('Sample click flag values:')
for i, click in enumerate(clicks):
    print(f'  Click {i+1}: is_unique={click.get("is_unique")}, is_suspicious={click.get("is_suspicious")}, is_rejected={click.get("is_rejected")}')

# Count totals
total_clicks = db.clicks.count_documents({})
unique_clicks = db.clicks.count_documents({'is_unique': True})
suspicious_clicks = db.clicks.count_documents({'is_suspicious': True})
rejected_clicks = db.clicks.count_documents({'is_rejected': True})

print(f'\nTotals:')
print(f'  Total clicks: {total_clicks}')
print(f'  Unique clicks: {unique_clicks}')
print(f'  Suspicious clicks: {suspicious_clicks}')
print(f'  Rejected clicks: {rejected_clicks}')
