"""Fix network name for offers imported from Eflow/Adtogame API"""
import sys
sys.path.insert(0, '.')
from database import db_instance

col = db_instance.get_collection('offers')
if col is not None:
    # Find offers with eflow in network name
    result = col.update_many(
        {'network': {'$regex': 'eflow', '$options': 'i'}},
        {'$set': {'network': 'Adtogame'}}
    )
    print(f"Updated {result.modified_count} offers from eflow -> Adtogame")
else:
    print("Database not connected")
