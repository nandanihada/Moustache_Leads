"""
MongoDB JSON Serialization Helper
Converts MongoDB objects (ObjectId, datetime) to JSON-serializable format
"""

from bson import ObjectId
from datetime import datetime

def mongodb_to_json(obj):
    """
    Recursively convert MongoDB objects to JSON-serializable format
    """
    if isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, dict):
        return {key: mongodb_to_json(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [mongodb_to_json(item) for item in obj]
    else:
        return obj
