import os
import sys
sys.path.append(os.path.abspath('backend'))
from database import db_instance

db = db_instance.get_db()
placements_col = db_instance.get_collection('placements')
clicks_col = db_instance.get_collection('clicks')
conversions_col = db_instance.get_collection('forwarded_postbacks')
login_logs_col = db_instance.get_collection('login_logs')

# Test placement aggregation
placements_map = {}
approved_placements_map = {}
if placements_col is not None:
    pipeline = [
        {"$group": {
            "_id": "$publisherId",
            "total": {"$sum": 1},
            "approved": {"$sum": {"$cond": [{"$eq": ["$approvalStatus", "APPROVED"]}, 1, 0]}}
        }}
    ]
    for doc in placements_col.aggregate(pipeline):
        pid = str(doc["_id"]) if doc["_id"] else ""
        placements_map[pid] = doc["total"]
        approved_placements_map[pid] = doc["approved"] > 0
print("Placements Map:", list(placements_map.items())[:5])

# Test clicks aggregation
clicks_map = {}
if clicks_col is not None:
    pipeline = [
        {"$group": {
            "_id": "$affiliate_id",
            "total": {"$sum": 1}
        }}
    ]
    for doc in clicks_col.aggregate(pipeline):
        pid = str(doc["_id"]) if doc["_id"] else ""
        clicks_map[pid] = doc["total"]
print("Clicks Map:", list(clicks_map.items())[:5])

# Test conversions aggregation
conversions_map = {}
if conversions_col is not None:
    pipeline = [
        {"$group": {
            "_id": "$publisher_id",
            "total": {"$sum": 1}
        }}
    ]
    for doc in conversions_col.aggregate(pipeline):
        pid = str(doc["_id"]) if doc["_id"] else ""
        conversions_map[pid] = doc["total"]
print("Conversions Map:", list(conversions_map.items())[:5])

# Test latest logins aggregation
latest_login_map = {}
if login_logs_col is not None:
    pipeline = [
        {"$sort": {"login_time": 1}},
        {"$group": {
            "_id": "$user_id",
            "latest": {"$last": "$login_time"}
        }}
    ]
    for doc in login_logs_col.aggregate(pipeline):
        pid = str(doc["_id"]) if doc["_id"] else ""
        latest_login_map[pid] = doc["latest"]
print("Latest Logins Map:", list(latest_login_map.items())[:5])
