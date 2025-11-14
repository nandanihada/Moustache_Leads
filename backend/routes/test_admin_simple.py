from flask import Blueprint, request, jsonify
from utils.auth import token_required, admin_required
from models.user import User
import logging

logger = logging.getLogger(__name__)

test_admin_simple_bp = Blueprint('test_admin_simple', __name__)

@test_admin_simple_bp.route('/test-publishers', methods=['GET'])
@token_required
@admin_required
def test_get_publishers():
    """Simple test route for publishers"""
    try:
        user_model = User()
        
        # Simple query
        publishers = list(user_model.collection.find(
            {'role': {'$in': ['publisher', 'user']}},
            {'username': 1, 'email': 1, 'role': 1}
        ).limit(5))
        
        publisher_list = []
        for publisher in publishers:
            publisher_data = {
                'id': str(publisher['_id']),
                'username': publisher['username'],
                'email': publisher['email'],
                'role': publisher.get('role', 'user')
            }
            publisher_list.append(publisher_data)
        
        return jsonify({
            'publishers': publisher_list,
            'count': len(publisher_list)
        }), 200
        
    except Exception as e:
        logger.error(f"Error in test route: {e}")
        return jsonify({'error': f'Test route error: {str(e)}'}), 500
