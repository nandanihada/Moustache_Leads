import os
import sys
from datetime import datetime, timedelta
sys.path.append(os.path.abspath('backend'))
from database import db_instance

db = db_instance.get_db()
print("Collections:", db.list_collection_names())

# Inspect a few users
print("\n--- SAMPLE USER ---")
user = db.users.find_one()
if user:
    for k, v in user.items():
        if k != 'password':
            print(f"  {k}: {type(v).__name__} = {v}")
else:
    print("No users found.")

# Inspect placements
print("\n--- SAMPLE PLACEMENT ---")
if 'placements' in db.list_collection_names():
    placement = db.placements.find_one()
    if placement:
        for k, v in placement.items():
            print(f"  {k}: {v}")
    else:
        print("Placements collection is empty.")
else:
    print("No placements collection.")

# Inspect clicks
print("\n--- SAMPLE CLICK ---")
if 'clicks' in db.list_collection_names():
    click = db.clicks.find_one()
    if click:
        for k, v in click.items():
            print(f"  {k}: {v}")
    else:
        print("Clicks collection is empty.")
else:
    print("No clicks collection.")

# Inspect conversions
print("\n--- SAMPLE CONVERSION ---")
conv_col = 'forwarded_postbacks' if 'forwarded_postbacks' in db.list_collection_names() else 'conversions'
if conv_col in db.list_collection_names():
    conv = db[conv_col].find_one()
    if conv:
        for k, v in conv.items():
            print(f"  {k}: {v}")
    else:
        print(f"Collection {conv_col} is empty.")
else:
    print("No conversions collection.")

# Check login_logs
print("\n--- SAMPLE LOGIN LOG ---")
if 'login_logs' in db.list_collection_names():
    log = db.login_logs.find_one()
    if log:
        for k, v in log.items():
            print(f"  {k}: {v}")
    else:
        print("Login logs collection is empty.")
else:
    print("No login_logs collection.")
