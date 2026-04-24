import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import db_instance
from datetime import datetime

polls_col = db_instance.get_collection('polls')

# Find polls without created_at
polls_without_date = list(polls_col.find({'created_at': {'$exists': False}}))

print(f"Found {len(polls_without_date)} polls without created_at field")

if len(polls_without_date) == 0:
    print("All polls already have created_at field!")
    sys.exit(0)

print("\nAdding created_at to existing polls...")

for poll in polls_without_date:
    # Use updated_at if it exists, otherwise use current time
    created_time = poll.get('updated_at', datetime.utcnow())
    
    result = polls_col.update_one(
        {'_id': poll['_id']},
        {'$set': {'created_at': created_time}}
    )
    
    if result.modified_count > 0:
        print(f"  Updated poll: {poll.get('question', 'Unknown')[:50]}")
        print(f"    Created at: {created_time}")

print(f"\nSuccessfully updated {len(polls_without_date)} polls!")
