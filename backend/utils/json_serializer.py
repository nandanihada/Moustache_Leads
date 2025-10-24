"""
JSON Serialization Utilities
Handles MongoDB ObjectId conversion for JSON serialization
"""

from bson import ObjectId
from datetime import datetime
import json

def convert_objectids_to_strings(obj):
    """
    Recursively convert ObjectId objects to strings in a dictionary or list
    
    Args:
        obj: Dictionary, list, or any object that might contain ObjectIds
        
    Returns:
        Object with all ObjectIds converted to strings
    """
    if isinstance(obj, dict):
        return {key: convert_objectids_to_strings(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_objectids_to_strings(item) for item in obj]
    elif isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, datetime):
        return obj.isoformat()
    else:
        return obj

def serialize_for_json(obj):
    """
    Prepare object for JSON serialization by converting ObjectIds and dates
    
    Args:
        obj: Object to serialize
        
    Returns:
        JSON-serializable object
    """
    return convert_objectids_to_strings(obj)

class MongoJSONEncoder(json.JSONEncoder):
    """
    Custom JSON encoder that handles MongoDB ObjectIds and datetime objects
    """
    
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        elif isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

def safe_json_response(data, status_code=200):
    """
    Create a Flask JSON response with proper ObjectId handling
    
    Args:
        data: Data to serialize
        status_code: HTTP status code
        
    Returns:
        Flask JSON response
    """
    from flask import jsonify
    
    # Convert ObjectIds to strings
    serialized_data = serialize_for_json(data)
    
    return jsonify(serialized_data), status_code

# Utility functions for common response patterns
def success_response(message, data=None, status_code=200):
    """Create a standardized success response"""
    response_data = {'success': True, 'message': message}
    if data is not None:
        response_data['data'] = data
    return safe_json_response(response_data, status_code)

def error_response(message, error_code=None, status_code=400):
    """Create a standardized error response"""
    response_data = {'success': False, 'error': message}
    if error_code:
        response_data['error_code'] = error_code
    return safe_json_response(response_data, status_code)

def paginated_response(items, page, per_page, total, additional_data=None):
    """Create a standardized paginated response"""
    response_data = {
        'items': serialize_for_json(items),
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': total,
            'pages': (total + per_page - 1) // per_page
        }
    }
    
    if additional_data:
        response_data.update(additional_data)
    
    return safe_json_response(response_data)

# Example usage:
# from utils.json_serializer import safe_json_response, serialize_for_json
# 
# # In route handlers:
# return safe_json_response({'offers': offers, 'total': total})
# 
# # Or for manual serialization:
# clean_data = serialize_for_json(mongodb_data)
# return jsonify(clean_data)
