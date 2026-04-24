import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import db_instance

polls_col = db_instance.get_collection('polls')

polls = list(polls_col.find().sort('created_at', -1))

print(f"Total polls: {len(polls)}\n")

for poll in polls:
    print("=" * 60)
    print(f"Question: {poll.get('question')}")
    print(f"Active: {poll.get('is_active')}")
    print(f"Created At: {poll.get('created_at')}")
    print(f"Updated At: {poll.get('updated_at')}")
    print(f"Views: {len(poll.get('viewed_users', []))}")
    print(f"Votes: {len(poll.get('voted_users', []))}")
    print(f"Target Countries: {poll.get('target_countries', [])}")
